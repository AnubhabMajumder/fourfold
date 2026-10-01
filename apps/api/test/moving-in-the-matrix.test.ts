import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db.ts';
import { at, setup } from './harness.ts';

const TODAY = '2026-09-24';
const YESTERDAY = '2026-09-23';
const IU = { date: TODAY, quadrant: 'important-urgent' } as const;
const INU = { date: TODAY, quadrant: 'important-not-urgent' } as const;

/** A fresh API with Tasks written and placed in Important + Urgent of today's Matrix, in the order given. */
async function placed(...texts: string[]) {
  const db = openDatabase(':memory:');
  const api = setup(at(TODAY, '10:30'), db);
  const ids = await api.writeAll(...texts);
  for (const id of ids) expect((await api.place(id, TODAY, 'important-urgent')).status).toBe(200);
  return { api, db, ids };
}

describe('moving a placed Task within its Matrix', () => {
  it('moves it to the position asked for in its Quadrant', async () => {
    const { api, ids } = await placed('a', 'b', 'c', 'd');
    const [a, , c, d] = ids;
    expect(await api.move(a!, 2, IU)).toMatchObject({ status: 200, body: { id: a, matrixDate: TODAY, quadrant: 'important-urgent' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['b', 'c', 'a', 'd']);
    await api.move(d!, 0, IU);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['d', 'b', 'c', 'a']);
    await api.move(c!, 99, IU);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['d', 'b', 'a', 'c']);
  });

  it('moves it into another Quadrant of the same Matrix, at the position asked for', async () => {
    const { api, ids } = await placed('a', 'b', 'c');
    const [a, b, c] = ids;
    expect(await api.move(b!, 0, INU)).toMatchObject({ status: 200, body: { id: b, matrixDate: TODAY, quadrant: 'important-not-urgent' } });
    await api.move(a!, 99, INU);
    await api.move(c!, 1, INU);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual([]);
    expect(await api.quadrantTexts(TODAY, 'important-not-urgent')).toEqual(['b', 'c', 'a']);
  });

  it('moves a Completed Task like any other, keeping it Completed', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.complete(ids[0]!);
    const res = await api.move(ids[0]!, 0, INU);
    expect(res).toMatchObject({ status: 200, body: { quadrant: 'important-not-urgent' } });
    expect(res.body.completedAt).not.toBeNull();
    await api.move(ids[0]!, 1, IU);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['b', 'a']);
  });

  it('rewrites only the moved Task', async () => {
    const { api, db, ids } = await placed('a', 'b', 'c');
    await api.writeAll('waiting');
    const rows = () => db.$client.prepare('select * from tasks order by id').all() as { id: string }[];
    const before = rows();
    await api.move(ids[0]!, 1, INU);
    const after = rows();
    expect(after.filter((r) => r.id !== ids[0])).toEqual(before.filter((r) => r.id !== ids[0]));
    expect(after.find((r) => r.id === ids[0])).not.toEqual(before.find((r) => r.id === ids[0]));
  });

  it('refuses to move it into a different Matrix', async () => {
    const api = setup(at(YESTERDAY, '10:30'));
    const [old, a] = await api.writeAll('old', 'a');
    await api.place(old!, YESTERDAY, 'important-urgent');
    api.setTime(at(TODAY, '05:30'));
    await api.place(a!, TODAY, 'important-urgent');
    expect(await api.move(old!, 0, IU)).toMatchObject({ status: 409, body: { reason: 'task_in_another_matrix' } });
    expect(await api.move(a!, 0, { date: YESTERDAY, quadrant: 'important-urgent' })).toMatchObject({
      status: 409,
      body: { reason: 'task_in_another_matrix' },
    });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
    expect(await api.quadrantTexts(YESTERDAY, 'important-urgent')).toEqual(['old']);
  });

  it('refuses to move it to a date with no Matrix', async () => {
    const { api, ids } = await placed('a');
    expect(await api.move(ids[0]!, 0, { date: '2026-09-25', quadrant: 'important-urgent' })).toMatchObject({
      status: 409,
      body: { reason: 'task_in_another_matrix' },
    });
  });
});

describe('moving between the Task List and a Matrix', () => {
  it('is refused: placing a Task List Task takes a Placement', async () => {
    const api = setup();
    const [a] = await api.writeAll('a');
    expect(await api.move(a!, 0, IU)).toMatchObject({ status: 409, body: { reason: 'task_not_placed' } });
    expect(await api.taskListTexts()).toEqual(['a']);
    expect((await api.matrix(TODAY)).status).toBe(404);
  });

  it('is refused: sending a placed Task back takes a return', async () => {
    const { api, ids } = await placed('a');
    expect(await api.move(ids[0]!, 0)).toMatchObject({ status: 409, body: { reason: 'task_already_placed' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
    expect(await api.taskList()).toEqual([]);
  });
});

describe('a move into a Quadrant', () => {
  it('needs a date and a Quadrant together, both valid', async () => {
    const { api, ids } = await placed('a');
    const move = (body: object) => api.call('POST', `/tasks/${ids[0]}/move`, { index: 0, ...body });
    expect((await move({ date: TODAY })).status).toBe(400);
    expect((await move({ quadrant: 'important-urgent' })).status).toBe(400);
    expect((await move({ date: '24/09/2026', quadrant: 'important-urgent' })).status).toBe(400);
    expect((await move({ date: TODAY, quadrant: 'urgent' })).status).toBe(400);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
  });
});
