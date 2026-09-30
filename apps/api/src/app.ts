import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { Hono, type Context } from 'hono';
import { isBlank, newTask, type Refusal, type Task } from '@fourfold/core';
import type { Db } from './db.ts';
import { tasks, type TaskRow } from './schema.ts';

export type Clock = () => Date;
export type AppOptions = { db: Db; clock?: Clock };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class BadRequest extends Error {}

const toTask = ({ position: _, ...t }: TaskRow): Task => t;

/** The local API: every change is checked against the rules in `core`, and refused with 409 if they forbid it. */
export function createApp({ db, clock = () => new Date() }: AppOptions) {
  const taskList = () => db.select().from(tasks).where(isNull(tasks.matrixDate)).orderBy(asc(tasks.position));

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

  /** Why the Task can't be changed as a Task in the Task List, if it can't. */
  function notInTaskList(tx: Pick<Db, 'select'>, id: string): Refusal | null {
    const row = tx.select({ matrixDate: tasks.matrixDate }).from(tasks).where(eq(tasks.id, id)).get();
    if (!row) return 'task_not_found';
    return row.matrixDate === null ? null : 'task_already_placed';
  }

  const api = new Hono()
    .onError((err, c) => (err instanceof BadRequest ? c.json({ error: err.message }, 400) : c.json({ error: 'Internal error' }, 500)))

    .get('/task-list', (c) => c.json(taskList().all().map(toTask)))

    .post('/tasks', async (c) => {
      const b = await body(c);
      if (typeof b.id !== 'string' || !UUID.test(b.id)) throw new BadRequest('id must be a UUID');
      if (typeof b.text !== 'string') throw new BadRequest('text must be a string');
      if (isBlank(b.text)) return refuse(c, 'empty_text');
      const id = b.id;
      const text = b.text.trim();
      const now = clock();
      return db.transaction((tx) => {
        if (tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get()) return refuse(c, 'task_exists');
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
      const row = db.update(tasks).set({ text: b.text.trim() }).where(eq(tasks.id, c.req.param('id'))).returning().get();
      return row ? c.json(toTask(row)) : refuse(c, 'task_not_found');
    })

    .delete('/tasks/:id', (c) => {
      const id = c.req.param('id');
      return db.transaction((tx) => {
        const refusal = notInTaskList(tx, id);
        if (refusal) return refuse(c, refusal);
        tx.delete(tasks).where(eq(tasks.id, id)).run();
        return c.body(null, 204);
      });
    })

    .post('/tasks/:id/move', async (c) => {
      const b = await body(c);
      const { index } = b;
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) throw new BadRequest('index must be a whole number, 0 or more');
      const id = c.req.param('id');
      return db.transaction((tx) => {
        const refusal = notInTaskList(tx, id);
        if (refusal) return refuse(c, refusal);
        // The Task List as it will be around the moved Task; a key between its new neighbours puts it at `index`
        // while every other row keeps its key.
        const others = tx
          .select({ position: tasks.position })
          .from(tasks)
          .where(and(isNull(tasks.matrixDate), ne(tasks.id, id)))
          .orderBy(asc(tasks.position))
          .all();
        const at = Math.min(index, others.length);
        const position = generateKeyBetween(others[at - 1]?.position ?? null, others[at]?.position ?? null);
        const moved = tx.update(tasks).set({ position }).where(eq(tasks.id, id)).returning().get()!;
        return c.json(toTask(moved));
      });
    });

  return new Hono().route('/api', api).all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
}
