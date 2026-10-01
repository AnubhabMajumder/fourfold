import { and, asc, eq, isNull } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { Hono, type Context } from 'hono';
import {
  emptyMatrix,
  isBlank,
  isCalendarDate,
  newTask,
  QUADRANTS,
  refusalFor,
  refusalToMove,
  refusalToPlace,
  type CalendarDate,
  type Destination,
  type Quadrant,
  type Refusal,
  type Task,
} from '@fourfold/core';
import type { Db } from './db.ts';
import { matrices, tasks, type TaskRow } from './schema.ts';

export type Clock = () => Date;
export type AppOptions = { db: Db; clock?: Clock };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class BadRequest extends Error {}

const toTask = ({ position: _, ...t }: TaskRow): Task => t;

function calendarDate(s: unknown): CalendarDate {
  if (typeof s !== 'string' || !isCalendarDate(s)) throw new BadRequest('date must be a calendar date, YYYY-MM-DD');
  return s;
}

function quadrantOf(s: unknown): Quadrant {
  if (!QUADRANTS.includes(s as Quadrant)) throw new BadRequest(`quadrant must be one of ${QUADRANTS.join(', ')}`);
  return s as Quadrant;
}

/** The local API: every change is checked against the rules in `core`, and refused with 409 if they forbid it. */
export function createApp({ db, clock = () => new Date() }: AppOptions) {
  const taskList = (tx: Pick<Db, 'select'> = db) => tx.select().from(tasks).where(isNull(tasks.matrixDate)).orderBy(asc(tasks.position));
  const quadrant = (tx: Pick<Db, 'select'>, date: CalendarDate, q: Quadrant) =>
    tx.select().from(tasks).where(and(eq(tasks.matrixDate, date), eq(tasks.quadrant, q))).orderBy(asc(tasks.position));
  const findTask = (tx: Pick<Db, 'select'>, id: string) => tx.select().from(tasks).where(eq(tasks.id, id)).get();

  /** The request's JSON object; with `optional`, an empty body counts as an empty object. */
  async function body(c: Context, { optional = false } = {}): Promise<Record<string, unknown>> {
    try {
      const text = await c.req.text();
      if (optional && text === '') return {};
      const b: unknown = JSON.parse(text);
      if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
    } catch {
      // fall through
    }
    throw new BadRequest('Expected a JSON object');
  }

  /** An optional index into a list: a whole number, 0 or more. */
  function index(value: unknown, name: string): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    throw new BadRequest(`${name} must be an index, 0 or more`);
  }

  /** A position key that puts a row at index `i` of a list with these keys (sorted), leaving every other key as it is. */
  const keyAt = (keys: string[], i: number) => {
    const at = Math.min(i, keys.length);
    return generateKeyBetween(keys[at - 1] ?? null, keys[at] ?? null);
  };

  const refuse = (c: Context, reason: Refusal) => c.json({ reason }, 409);

  const api = new Hono()
    .onError((err, c) => (err instanceof BadRequest ? c.json({ error: err.message }, 400) : c.json({ error: 'Internal error' }, 500)))

    .get('/task-list', (c) => c.json(taskList().all().map(toTask)))

    /** The dates that have a Matrix, oldest first. */
    .get('/matrices', (c) =>
      c.json(
        db
          .select()
          .from(matrices)
          .orderBy(asc(matrices.date))
          .all()
          .map((m) => m.date),
      ),
    )

    .get('/matrices/:date', (c) => {
      const date = calendarDate(c.req.param('date'));
      if (!db.select().from(matrices).where(eq(matrices.date, date)).get()) return c.json({ error: 'No Matrix for this date' }, 404);
      const matrix = emptyMatrix(date);
      for (const q of QUADRANTS) matrix.quadrants[q] = quadrant(db, date, q).all().map(toTask);
      return c.json(matrix);
    })

    .post('/tasks', async (c) => {
      const b = await body(c);
      if (typeof b.id !== 'string' || !UUID.test(b.id)) throw new BadRequest('id must be a UUID');
      if (typeof b.text !== 'string') throw new BadRequest('text must be a string');
      if (isBlank(b.text)) return refuse(c, 'empty_text');
      const id = b.id;
      const text = b.text.trim();
      const now = clock();
      return db.transaction((tx) => {
        if (findTask(tx, id)) return refuse(c, 'task_exists');
        // A position key that sorts before every Task already in the Task List: new Tasks go to the top.
        const top = tx.select({ position: tasks.position }).from(tasks).where(isNull(tasks.matrixDate)).orderBy(asc(tasks.position)).limit(1).get();
        const row: TaskRow = { ...newTask(id, text, now.toISOString()), position: generateKeyBetween(null, top?.position ?? null) };
        tx.insert(tasks).values(row).run();
        return c.json(toTask(row), 201);
      });
    })

    .patch('/tasks/:id', async (c) => {
      const b = await body(c);
      if (typeof b.text !== 'string') throw new BadRequest('text must be a string');
      if (isBlank(b.text)) return refuse(c, 'empty_text');
      const text = b.text.trim();
      const now = clock();
      return db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalFor('edit', task, now);
        if (refusal) return refuse(c, refusal);
        return c.json(toTask(tx.update(tasks).set({ text }).where(eq(tasks.id, task.id)).returning().get()!));
      });
    })

    .delete('/tasks/:id', (c) =>
      db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalFor('delete', task, clock());
        if (refusal) return refuse(c, refusal);
        tx.delete(tasks).where(eq(tasks.id, task.id)).run();
        return c.body(null, 204);
      }),
    )

    /**
     * Body: `index`, where the Task ends up in its list, counted from the top; and, for a placed Task, the `date` and
     * `quadrant` it moves to, which must be in its own Matrix.
     */
    .post('/tasks/:id/move', async (c) => {
      const b = await body(c);
      const at = index(b.index, 'index');
      if (at === undefined) throw new BadRequest('index must be an index, 0 or more');
      if ((b.date === undefined) !== (b.quadrant === undefined)) throw new BadRequest('date and quadrant go together');
      const to: Destination = b.date === undefined ? 'task-list' : { date: calendarDate(b.date), quadrant: quadrantOf(b.quadrant) };
      const id = c.req.param('id');
      return db.transaction((tx) => {
        const task = findTask(tx, id);
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalToMove(task, to, clock());
        if (refusal) return refuse(c, refusal);
        // The list as it will be around the moved Task; a key between its new neighbours puts it at `index` while
        // every other row keeps its key.
        const list = to === 'task-list' ? taskList(tx) : quadrant(tx, to.date, to.quadrant);
        const others = list.all().filter((t) => t.id !== id);
        const position = keyAt(others.map((t) => t.position), at);
        const moved = tx.update(tasks).set({ quadrant: to === 'task-list' ? null : to.quadrant, position }).where(eq(tasks.id, id)).returning().get()!;
        return c.json(toTask(moved));
      });
    })

    /** Body: `date`, `quadrant`, and optionally `position`, the index in the Quadrant the Task is placed at. */
    .post('/tasks/:id/place', async (c) => {
      const b = await body(c);
      const date = calendarDate(b.date);
      const q = quadrantOf(b.quadrant);
      const at = index(b.position, 'position');
      const now = clock();
      return db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalToPlace(task, date, now);
        if (refusal) return refuse(c, refusal);
        // The first Placement on a date creates its Matrix, in this same transaction.
        tx.insert(matrices).values({ date }).onConflictDoNothing().run();
        const keys = quadrant(tx, date, q).all().map((t) => t.position);
        const position = keyAt(keys, at ?? keys.length);
        const row = tx.update(tasks).set({ matrixDate: date, quadrant: q, position }).where(eq(tasks.id, task.id)).returning().get()!;
        return c.json(toTask(row));
      });
    })

    /** Completing and un-completing a placed Task change only `completed_at`: it stays where it is. */
    .post('/tasks/:id/complete', (c) => setCompleted(c, 'complete'))
    .post('/tasks/:id/uncomplete', (c) => setCompleted(c, 'uncomplete'))

    /** Body (optional): `position`, the index in the Task List the Task is returned to; without one, the top. */
    .post('/tasks/:id/return', async (c) => {
      const at = index((await body(c, { optional: true })).position, 'position');
      return db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalFor('return', task, clock());
        if (refusal) return refuse(c, refusal);
        const keys = taskList(tx).all().map((t) => t.position);
        const position = keyAt(keys, at ?? 0);
        // Returning leaves no trace in the Matrix, and it's unfinished anyway, so every Matrix field is emptied.
        const row = tx
          .update(tasks)
          .set({ matrixDate: null, quadrant: null, completedAt: null, position })
          .where(eq(tasks.id, task.id))
          .returning()
          .get()!;
        // Returning the last Task deletes its Matrix in the same transaction: there is never an empty Matrix.
        if (!tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.matrixDate, task.matrixDate!)).limit(1).get())
          tx.delete(matrices).where(eq(matrices.date, task.matrixDate!)).run();
        return c.json(toTask(row));
      });
    });

  function setCompleted(c: Context, change: 'complete' | 'uncomplete') {
    const now = clock();
    const completedAt = change === 'complete' ? now.toISOString() : null;
    return db.transaction((tx) => {
      const task = findTask(tx, c.req.param('id')!);
      if (!task) return refuse(c, 'task_not_found');
      const refusal = refusalFor(change, task, now);
      if (refusal) return refuse(c, refusal);
      return c.json(toTask(tx.update(tasks).set({ completedAt }).where(eq(tasks.id, task.id)).returning().get()!));
    });
  }

  return new Hono().route('/api', api).all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
}
