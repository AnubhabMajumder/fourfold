import { describe, expect, it } from 'vitest';
import { QUADRANTS } from '@fourfold/core';
import { at, setup } from './harness.ts';

const TODAY = '2026-09-24';

describe('placing a Task', () => {
  it('moves it out of the Task List into the Quadrant, keeping its text and creation time', async () => {
    const api = setup(at(TODAY, '10:30'));
    const [milk] = await api.writeAll('Buy milk', 'Call Mum');
    const res = await api.place(milk!, TODAY, 'important-urgent');
    expect(res).toMatchObject({
      status: 200,
      body: { id: milk, text: 'Buy milk', createdAt: at(TODAY, '10:30').toISOString(), matrixDate: TODAY, quadrant: 'important-urgent', completedAt: null },
    });
    expect(await api.taskListTexts()).toEqual(['Call Mum']);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['Buy milk']);
  });

  it('creates the Matrix with the first Placement on a date', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    expect((await api.matrix(TODAY)).status).toBe(404);
    await api.place(milk!, TODAY, 'not-important-urgent');
    expect(await api.matrix(TODAY)).toMatchObject({ status: 200, body: { date: TODAY } });
  });

  it('puts a Task placed without a position at the bottom of the Quadrant', async () => {
    const api = setup();
    const [a, b, c] = await api.writeAll('first', 'second', 'third');
    for (const id of [a, b, c]) expect((await api.place(id!, TODAY, 'important-not-urgent')).status).toBe(200);
    expect(await api.quadrantTexts(TODAY, 'important-not-urgent')).toEqual(['first', 'second', 'third']);
  });

  it('puts a Task placed at a position there, before the Task that was at it', async () => {
    const api = setup();
    const [a, b, c, d] = await api.writeAll('a', 'b', 'c', 'd');
    await api.place(a!, TODAY, 'important-urgent');
    await api.place(b!, TODAY, 'important-urgent');
    await api.place(c!, TODAY, 'important-urgent', 0);
    await api.place(d!, TODAY, 'important-urgent', 2);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['c', 'a', 'd', 'b']);
  });

  it('puts a Task placed at a position past the end at the bottom', async () => {
    const api = setup();
    const [a, b] = await api.writeAll('a', 'b');
    await api.place(a!, TODAY, 'important-urgent');
    await api.place(b!, TODAY, 'important-urgent', 99);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a', 'b']);
  });

  it('keeps each Quadrant its own list', async () => {
    const api = setup();
    const [a, b] = await api.writeAll('a', 'b');
    await api.place(a!, TODAY, 'important-urgent');
    await api.place(b!, TODAY, 'important-not-urgent', 0);
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['a']);
    expect(await api.quadrantTexts(TODAY, 'important-not-urgent')).toEqual(['b']);
  });

  it('refuses to place a Task that is already placed', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    await api.place(milk!, TODAY, 'important-urgent');
    expect(await api.place(milk!, TODAY, 'not-important-urgent')).toMatchObject({ status: 409, body: { reason: 'task_already_placed' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['Buy milk']);
    expect(await api.quadrantTexts(TODAY, 'not-important-urgent')).toEqual([]);
  });

  it('refuses to place a Task that no longer exists, creating no Matrix', async () => {
    const api = setup();
    expect(await api.place(crypto.randomUUID(), TODAY, 'important-urgent')).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
    expect((await api.matrix(TODAY)).status).toBe(404);
  });

  it('refuses to place a Task into a date after today, creating no Matrix', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.place(milk!, '2026-09-26', 'important-urgent')).toMatchObject({ status: 409, body: { reason: 'date_not_placeable' } });
    expect((await api.matrix('2026-09-26')).status).toBe(404);
    expect(await api.taskListTexts()).toEqual(['Buy milk']);
  });

  it('rejects a malformed Placement', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    const place = (body: unknown) => api.call('POST', `/tasks/${milk}/place`, body);
    expect((await place({ date: '24/09/2026', quadrant: 'important-urgent' })).status).toBe(400);
    expect((await place({ date: '2026-02-30', quadrant: 'important-urgent' })).status).toBe(400);
    expect((await place({ date: TODAY, quadrant: 'urgent' })).status).toBe(400);
    expect((await place({ date: TODAY, quadrant: 'important-urgent', position: -1 })).status).toBe(400);
    expect((await place({ date: TODAY, quadrant: 'important-urgent', position: 1.5 })).status).toBe(400);
    expect((await place({ date: TODAY, quadrant: 'important-urgent', position: '0' })).status).toBe(400);
    expect(await api.taskListTexts()).toEqual(['Buy milk']);
  });
});

describe('a Matrix', () => {
  it('gives its Tasks grouped by Quadrant, each in order', async () => {
    const api = setup();
    const [a, b, c, d] = await api.writeAll('a', 'b', 'c', 'd');
    await api.place(a!, TODAY, 'not-important-not-urgent');
    await api.place(b!, TODAY, 'important-urgent');
    await api.place(c!, TODAY, 'not-important-not-urgent');
    await api.place(d!, TODAY, 'important-urgent', 0);
    const { body } = await api.matrix(TODAY);
    expect(Object.keys(body.quadrants)).toEqual([...QUADRANTS]);
    expect(Object.fromEntries(QUADRANTS.map((q) => [q, body.quadrants[q].map((t) => t.text)]))).toEqual({
      'important-urgent': ['d', 'b'],
      'important-not-urgent': [],
      'not-important-urgent': [],
      'not-important-not-urgent': ['a', 'c'],
    });
  });

  it('is not found for a date without one, and a malformed date is rejected', async () => {
    const api = setup();
    expect((await api.matrix(TODAY)).status).toBe(404);
    expect((await api.matrix('yesterday')).status).toBe(400);
  });

  it('cannot be created or deleted through the API directly', async () => {
    const api = setup();
    expect((await api.call('POST', '/matrices', { date: TODAY })).status).toBe(404);
    expect((await api.call('PUT', `/matrices/${TODAY}`)).status).toBe(404);
    expect((await api.call('DELETE', `/matrices/${TODAY}`)).status).toBe(404);
  });
});

describe('deleting a Task', () => {
  it('deletes a Task in the Task List', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk', 'Call Mum');
    expect((await api.remove(milk!)).status).toBe(204);
    expect(await api.taskListTexts()).toEqual(['Call Mum']);
  });

  it('refuses to delete a placed Task', async () => {
    const api = setup();
    const [milk] = await api.writeAll('Buy milk');
    await api.place(milk!, TODAY, 'important-urgent');
    expect(await api.remove(milk!)).toMatchObject({ status: 409, body: { reason: 'task_already_placed' } });
    expect(await api.quadrantTexts(TODAY, 'important-urgent')).toEqual(['Buy milk']);
  });

  it('refuses to delete a Task that no longer exists', async () => {
    const api = setup();
    expect(await api.remove(crypto.randomUUID())).toMatchObject({ status: 409, body: { reason: 'task_not_found' } });
  });
});
