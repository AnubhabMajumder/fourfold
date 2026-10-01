// Drives the API over HTTP, in-process, with a fresh in-memory database and a clock the test controls.
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { CalendarDate, Matrix, Quadrant, Task } from '@fourfold/core';
import { createApp } from '../src/app.ts';
import { openDatabase, type Db } from '../src/db.ts';

/** Local time on a calendar date, e.g. at('2026-09-24', '19:59'). */
export function at(date: string, time = '10:00'): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm);
}

export type Response<T = unknown> = { status: number; body: T };

export function setup(start: Date = at('2026-09-24'), db: Db = openDatabase(':memory:')) {
  let now = start;
  const app = createApp({ db, clock: () => now });

  /** A Matrix exists only while it holds a Task, whatever calls came before: checked after every call. */
  const expectNoEmptyMatrix = () =>
    expect(
      db.$client.prepare('select date from matrices m where not exists (select 1 from tasks t where t.matrix_date = m.date)').pluck().all(),
    ).toEqual([]);

  async function call<T = Task>(method: string, path: string, body?: unknown): Promise<Response<T>> {
    const res = await app.request(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    expectNoEmptyMatrix();
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
  }

  const api = {
    call,
    setTime: (d: Date) => {
      now = d;
    },
    write: (text: string, id: string = randomUUID()) => call('POST', '/tasks', { id, text }),
    edit: (id: string, text: string) => call('PATCH', `/tasks/${id}`, { text }),
    remove: (id: string) => call('DELETE', `/tasks/${id}`),
    /** Moves a Task so that it ends up at `index` (counted from the top) of the Task List, or of a Quadrant with `to`. */
    move: (id: string, index: number, to?: { date: CalendarDate; quadrant: Quadrant }) => call('POST', `/tasks/${id}/move`, { index, ...to }),
    place: (id: string, date: CalendarDate, quadrant: Quadrant, position?: number) =>
      call('POST', `/tasks/${id}/place`, { date, quadrant, position }),
    complete: (id: string) => call('POST', `/tasks/${id}/complete`),
    uncomplete: (id: string) => call('POST', `/tasks/${id}/uncomplete`),
    /** Returns a placed Task to the Task List, at `position` there, or at the top without one. */
    return: (id: string, position?: number) => call('POST', `/tasks/${id}/return`, position === undefined ? undefined : { position }),
    taskList: async () => (await call<Task[]>('GET', '/task-list')).body,
    matrix: (date: CalendarDate) => call<Matrix>('GET', `/matrices/${date}`),

    /** Writes Tasks in order and returns their ids (the Task List ends up newest first). */
    async writeAll(...texts: string[]) {
      const ids: string[] = [];
      for (const text of texts) {
        const res = await api.write(text);
        expect(res.status).toBe(201);
        ids.push(res.body.id);
      }
      return ids;
    },
    taskListTexts: async () => (await api.taskList()).map((t) => t.text),
    /** The texts in one Quadrant of a date's Matrix, in order. */
    quadrantTexts: async (date: CalendarDate, quadrant: Quadrant) => (await api.matrix(date)).body.quadrants[quadrant].map((t) => t.text),
  };
  return api;
}
