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
  refusalToPlace,
  type CalendarDate,
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

/** The local API: every change is checked against the rules in `core`, and refused with 409 if they forbid it. */
export function createApp({ db, clock = () => new Date() }: AppOptions) {
  const taskList = () => db.select().from(tasks).where(isNull(tasks.matrixDate)).orderBy(asc(tasks.position));
  const quadrant = (tx: Pick<Db, 'select'>, date: CalendarDate, q: Quadrant) =>
    tx.select().from(tasks).where(and(eq(tasks.matrixDate, date), eq(tasks.quadrant, q))).orderBy(asc(tasks.position));
  const findTask = (tx: Pick<Db, 'select'>, id: string) => tx.select().from(tasks).where(eq(tasks.id, id)).get();

  async function body(c: Context): Promise<Record<string, unknown>> {
    try {
      const b: unknown = await c.req.json();
      if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
    } catch {
      // fall through
    }
    throw new BadRequest('Expected a JSON object');
  }

  const refuse = (c: Context, reason: Refusal) => c.json({ reason }, 409);

  const api = new Hono()
    .onError((err, c) => (err instanceof BadRequest ? c.json({ error: err.message }, 400) : c.json({ error: 'Internal error' }, 500)))

    .get('/task-list', (c) => c.json(taskList().all().map(toTask)))

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

    .delete('/tasks/:id', (c) =>
      db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalFor('delete', task);
        if (refusal) return refuse(c, refusal);
        tx.delete(tasks).where(eq(tasks.id, task.id)).run();
        return c.body(null, 204);
      }),
    )

    /** Body: `date`, `quadrant`, and optionally `position`, the index in the Quadrant the Task is placed at. */
    .post('/tasks/:id/place', async (c) => {
      const b = await body(c);
      const date = calendarDate(b.date);
      if (!QUADRANTS.includes(b.quadrant as Quadrant)) throw new BadRequest(`quadrant must be one of ${QUADRANTS.join(', ')}`);
      const q = b.quadrant as Quadrant;
      const at = b.position;
      if (at !== undefined && !(Number.isInteger(at) && (at as number) >= 0)) throw new BadRequest('position must be an index, 0 or more');
      const now = clock();
      return db.transaction((tx) => {
        const task = findTask(tx, c.req.param('id'));
        if (!task) return refuse(c, 'task_not_found');
        const refusal = refusalToPlace(task, date, now);
        if (refusal) return refuse(c, refusal);
        // The first Placement on a date creates its Matrix, in this same transaction.
        tx.insert(matrices).values({ date }).onConflictDoNothing().run();
        const keys = quadrant(tx, date, q).all().map((t) => t.position);
        const i = Math.min((at as number | undefined) ?? keys.length, keys.length);
        const position = generateKeyBetween(keys[i - 1] ?? null, keys[i] ?? null);
        const row = tx.update(tasks).set({ matrixDate: date, quadrant: q, position }).where(eq(tasks.id, task.id)).returning().get()!;
        return c.json(toTask(row));
      });
    });

  return new Hono().route('/api', api).all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
}
