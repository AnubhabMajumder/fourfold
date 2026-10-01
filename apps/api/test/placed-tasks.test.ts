import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db.ts';
import { at, setup } from './harness.ts';

const TODAY = '2026-09-24';

/** A fresh API with Tasks written and placed in one Quadrant of today's Matrix, in the order given. */
async function placed(...texts: string[]) {
  const api = setup(at(TODAY, '10:30'));
  const ids = await api.writeAll(...texts);
  for (const id of ids) expect((await api.place(id, TODAY, 'important-urgent')).status).toBe(200);
  return { api, ids };
}

describe('completing a Task', () => {
  it('marks a placed Task Completed at the time, keeping it where it is', async () => {
    const { api, ids } = await placed('a', 'b', 'c');
    api.setTime(at(TODAY, '11:15'));
    expect(await api.complete(ids[1]!)).toMatchObject({
      status: 200,
      body: { id: ids[1], text: 'b', matrixDate: TODAY, quadrant: 'important-urgent', completedAt: at(TODAY, '11:15').toISOString() },
    });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a', 'b', 'c']);
    expect((await api.matrix(TODAY)).body.quadrants['important-urgent'][1]!.completedAt).toBe(at(TODAY, '11:15').toISOString());
  });

  it('leaves the row’s position as it was', async () => {
    // Like the move test in the Task List, this looks at the rows: positions are hidden from the API.
    const db = openDatabase(':memory:');
    const api = setup(at(TODAY), db);
    const [a] = await api.writeAll('a');
    await api.place(a!, TODAY, 'important-urgent');
    const position = () => db.$client.prepare('select position from tasks where id = ?').pluck().get(a);
    const before = position();
    await api.complete(a!);
    expect(position()).toBe(before);
    await api.uncomplete(a!);
    expect(position()).toBe(before);
  });

  it('refuses to complete a Task in the Task List', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.complete(milk!)).toMatchObject({ status: 409, body: { reason: 'task_not_placed' } });
    expect((await api.taskList())[0]!.completedAt).toBeNull();
  });

  it('refuses to complete a Task that is already Completed', async () => {
    const { api, ids } = await placed('a');
    await api.complete(ids[0]!);
    expect(await api.complete(ids[0]!)).toMatchObject({ status: 409, body: { reason: 'task_already_completed' } });
  });

  it('refuses to complete a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.complete(crypto.randomUUID())).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });
});

describe('un-completing a Task', () => {
  it('makes a Completed Task unfinished again, in the same place', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.complete(ids[0]!);
    expect(await api.uncomplete(ids[0]!)).toMatchObject({ status: 200, body: { id: ids[0], completedAt: null, matrixDate: TODAY } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a', 'b']);
  });

  it('refuses to un-complete an unfinished placed Task', async () => {
    const { api, ids } = await placed('a');
    expect(await api.uncomplete(ids[0]!)).toMatchObject({ status: 409, body: { reason: 'task_not_completed' } });
  });

  it('refuses to un-complete a Task in the Task List', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.uncomplete(milk!)).toMatchObject({ status: 409, body: { reason: 'task_not_placed' } });
  });

  it('refuses to un-complete a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.uncomplete(crypto.randomUUID())).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });
});

describe('returning a Task to the Task List', () => {
  it('puts it at the top of the Task List by default, leaving no trace in the Matrix', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.writeAll('waiting', 'newest');
    expect(await api.return(ids[0]!)).toMatchObject({
      status: 200,
      body: { id: ids[0], text: 'a', createdAt: at(TODAY, '10:30').toISOString(), matrixDate: null, quadrant: null, completedAt: null },
    });
    expect(await api.taskListTexts()).toEqual(['a', 'newest', 'waiting']);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['b']);
  });

  it('puts it at the position asked for', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.writeAll('x', 'y', 'z');
    // The Task List is z, y, x.
    await api.return(ids[0]!, 1);
    expect(await api.taskListTexts()).toEqual(['z', 'a', 'y', 'x']);
    await api.return(ids[1]!, 99);
    expect(await api.taskListTexts()).toEqual(['z', 'a', 'y', 'x', 'b']);
  });

  it('removes the Matrix when its last Task is returned, and the next Placement makes a new one', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.return(ids[0]!);
    expect((await api.matrix(TODAY)).status).toBe(200);
    await api.return(ids[1]!);
    expect((await api.matrix(TODAY)).status).toBe(404);
    expect(await api.taskListTexts()).toEqual(['b', 'a']);
    await api.place(ids[0]!, TODAY, 'not-important-urgent');
    expect(await api.quadrantTexts(TODAY, 'not-important-urgent')).toEqual(['a']);
  });

  it('keeps the Matrix while a Completed Task is still in it', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.complete(ids[1]!);
    await api.return(ids[0]!);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['b']);
  });

  it('can return a Task that was Completed and then un-completed', async () => {
    const { api, ids } = await placed('a');
    await api.complete(ids[0]!);
    await api.uncomplete(ids[0]!);
    expect(await api.return(ids[0]!)).toMatchObject({ status: 200, body: { matrixDate: null, quadrant: null, completedAt: null } });
    expect((await api.matrix(TODAY)).status).toBe(404);
  });

  it('refuses to return a Completed Task', async () => {
    const { api, ids } = await placed('a');
    await api.complete(ids[0]!);
    expect(await api.return(ids[0]!)).toMatchObject({ status: 409, body: { reason: 'completed_task_not_returnable' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
    expect(await api.taskList()).toEqual([]);
  });

  it('refuses to return a Task that is already in the Task List', async () => {
    const api = setup();
    const [a] = await api.writeAll('a', 'b');
    expect(await api.return(a!)).toMatchObject({ status: 409, body: { reason: 'task_not_placed' } });
    expect(await api.taskListTexts()).toEqual(['b', 'a']);
  });

  it('refuses to return a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.return(crypto.randomUUID())).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });

  it('rejects a return without a sensible position', async () => {
    const { api, ids } = await placed('a');
    for (const position of [-1, 1.5, '0', null]) expect((await api.call('POST', `/tasks/${ids[0]}/return`, { position })).status).toBe(400);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
  });

  it('accepts a return with no body at all', async () => {
    const { api, ids } = await placed('a');
    expect((await api.call('POST', `/tasks/${ids[0]}/return`)).status).toBe(200);
  });
});

describe('editing a placed Task', () => {
  it('changes the text of a placed or Completed Task, keeping its place and state', async () => {
    const { api, ids } = await placed('a', 'b');
    await api.complete(ids[1]!);
    expect(await api.edit(ids[0]!, ' a2 ')).toMatchObject({ status: 200, body: { text: 'a2', completedAt: null, matrixDate: TODAY } });
    expect(await api.edit(ids[1]!, 'b2')).toMatchObject({ status: 200, body: { text: 'b2', matrixDate: TODAY } });
    const { body } = await api.matrix(TODAY);
    expect(body.quadrants['important-urgent'].map((t) => [t.text, t.completedAt !== null])).toEqual([
      ['a2', false],
      ['b2', true],
    ]);
  });

  it('refuses empty text for a placed Task', async () => {
    const { api, ids } = await placed('a');
    expect(await api.edit(ids[0]!, '  ')).toMatchObject({ status: 409, body: { reason: 'empty_text' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
  });
});

describe('deleting a Completed Task', () => {
  it('is refused; un-completing it first still leaves a placed Task, which is not deletable either', async () => {
    const { api, ids } = await placed('a');
    await api.complete(ids[0]!);
    expect(await api.remove(ids[0]!)).toMatchObject({ status: 409, body: { reason: 'completed_task_not_deletable' } });
    await api.uncomplete(ids[0]!);
    expect(await api.remove(ids[0]!)).toMatchObject({ status: 409, body: { reason: 'task_already_placed' } });
    await api.return(ids[0]!);
    expect((await api.remove(ids[0]!)).status).toBe(204);
    expect(await api.taskList()).toEqual([]);
  });
});
