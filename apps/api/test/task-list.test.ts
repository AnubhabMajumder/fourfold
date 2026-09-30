import { describe, expect, it } from 'vitest';
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

  it('answers 404 for an unknown API path', async () => {
    const api = setup();
    expect((await api.call('GET', '/nothing-here')).status).toBe(404);
  });
});
