import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db.ts';
import { at, setup } from './harness.ts';

describe('the Task List', () => {
  it('starts empty after migrations are applied to an empty database', async () => {
    const api = setup();
    expect(await api.taskList()).toEqual([]);
  });

  it('keeps a written Task with the id the web app chose, its text, and a UTC creation time', async () => {
    const api = setup(at('2026-09-24', '10:30'));
    const id = crypto.randomUUID();
    const res = await api.write('Buy milk', id);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id,
      text: 'Buy milk',
      createdAt: at('2026-09-24', '10:30').toISOString(),
      matrixDate: null,
      quadrant: null,
      completedAt: null,
    });
    expect(await api.taskList()).toEqual([res.body]);
  });

  it('puts a newly written Task at the top', async () => {
    const api = setup();
    await api.writeAll('first', 'second', 'third');
    expect(await api.taskListTexts()).toEqual(['third', 'second', 'first']);
  });

  it('trims the text of a written Task', async () => {
    const api = setup();
    expect(await api.write('  Buy milk  ')).toMatchObject({ status: 201, body: { text: 'Buy milk' } });
  });

  it('refuses a Task with empty text', async () => {
    const api = setup();
    expect(await api.write('')).toMatchObject({ status: 409, body: { reason: 'empty_text' } });
    expect(await api.write('   ')).toMatchObject({ status: 409, body: { reason: 'empty_text' } });
    expect(await api.taskList()).toEqual([]);
  });

  it('refuses a second Task with the same id', async () => {
    const api = setup();
    const id = crypto.randomUUID();
    await api.write('once', id);
    expect(await api.write('twice', id)).toMatchObject({ status: 409, body: { reason: 'task_exists' } });
    expect(await api.taskListTexts()).toEqual(['once']);
  });

  it('rejects a malformed request', async () => {
    const api = setup();
    expect((await api.write('no uuid', 'not-a-uuid')).status).toBe(400);
    expect((await api.call('POST', '/tasks', { id: crypto.randomUUID() })).status).toBe(400);
    expect((await api.call('POST', '/tasks', [])).status).toBe(400);
  });

  it('changes the text of a Task, trimmed, keeping its place', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk', 'Call Mum');
    expect(await api.edit(milk!, '  Buy oat milk ')).toMatchObject({ status: 200, body: { id: milk, text: 'Buy oat milk' } });
    expect(await api.taskListTexts()).toEqual(['Call Mum', 'Buy oat milk']);
  });

  it('refuses to change a Task to empty text', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.edit(milk!, '')).toMatchObject({ status: 409, body: { reason: 'empty_text' } });
    expect(await api.edit(milk!, '  ')).toMatchObject({ status: 409, body: { reason: 'empty_text' } });
    expect(await api.taskListTexts()).toEqual(['Buy milk']);
  });

  it('refuses to change a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.edit(crypto.randomUUID(), 'Buy milk')).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });

  it('deletes a Task for good, so its id can be written again', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk', 'Call Mum');
    expect((await api.remove(milk!)).status).toBe(204);
    expect(await api.taskListTexts()).toEqual(['Call Mum']);
    expect((await api.write('Buy milk again', milk)).status).toBe(201);
  });

  it('refuses to delete a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.remove(crypto.randomUUID())).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });

  it('moves a Task to the position asked for', async () => {
    const api = setup();
    const [a, b, c, d] = await api.writeAll('a', 'b', 'c', 'd');
    // The Task List is now d, c, b, a.
    expect(await api.move(a!, 0)).toMatchObject({ status: 200, body: { id: a } });
    expect(await api.taskListTexts()).toEqual(['a', 'd', 'c', 'b']);
    await api.move(d!, 3);
    expect(await api.taskListTexts()).toEqual(['a', 'c', 'b', 'd']);
    await api.move(c!, 2);
    expect(await api.taskListTexts()).toEqual(['a', 'b', 'c', 'd']);
    await api.move(b!, 1);
    expect(await api.taskListTexts()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moves a Task to the bottom when asked for a position past the end', async () => {
    const api = setup();
    const [a] = await api.writeAll('a', 'b', 'c');
    await api.move(a!, 0);
    await api.move(a!, 99);
    expect(await api.taskListTexts()).toEqual(['c', 'b', 'a']);
  });

  it('keeps the order right through many moves into the same gap', async () => {
    const api = setup();
    const ids = await api.writeAll('a', 'b', 'c', 'd', 'e', 'f');
    // The Task List is f, e, d, c, b, a; repeatedly squeeze the bottom Task in just below the top one.
    for (let i = 0; i < 4; i++) await api.move(ids[i]!, 1);
    expect(await api.taskListTexts()).toEqual(['f', 'd', 'c', 'b', 'a', 'e']);
  });

  it('rewrites only the moved Task when moving it', async () => {
    // The one test that looks at the rows themselves: the positions are hidden from the API, and the issue asks
    // that a move leaves every other row as it was.
    const db = openDatabase(':memory:');
    const api = setup(undefined, db);
    const [a] = await api.writeAll('a', 'b', 'c', 'd');
    const rows = () => db.$client.prepare('select * from tasks order by id').all() as { id: string }[];
    const before = rows();
    await api.move(a!, 2);
    const after = rows();
    expect(after.filter((r) => r.id !== a)).toEqual(before.filter((r) => r.id !== a));
    expect(after.find((r) => r.id === a)).not.toEqual(before.find((r) => r.id === a));
  });

  it('refuses to move a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.move(crypto.randomUUID(), 0)).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });

  it('rejects a move without a sensible position', async () => {
    const api = setup();
    const [a] = await api.writeAll('a');
    for (const index of [-1, 1.5, '0', null]) expect((await api.call('POST', `/tasks/${a}/move`, { index })).status).toBe(400);
    expect((await api.call('POST', `/tasks/${a}/move`, {})).status).toBe(400);
  });

  it('answers 404 for an unknown API path', async () => {
    const api = setup();
    expect((await api.call('GET', '/nothing-here')).status).toBe(404);
  });
});
