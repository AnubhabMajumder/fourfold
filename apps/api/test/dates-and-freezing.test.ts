import { describe, expect, it } from 'vitest';
import { at, setup } from './harness.ts';

const YESTERDAY = '2026-09-23';
const TODAY = '2026-09-24';
const TOMORROW = '2026-09-25';
const DAY_AFTER_TOMORROW = '2026-09-26';

describe('the dates that have a Matrix', () => {
  it('are none at first', async () => {
    const api = setup();
    expect(await api.call('GET', '/matrices')).toMatchObject({ status: 200, body: [] });
  });

  it('are the dates with a placed Task, oldest first, and a date goes when its last Task is returned', async () => {
    const api = setup(at('2026-09-20'));
    const [a, b, c] = await api.writeAll('a', 'b', 'c');
    await api.place(a!, '2026-09-20', 'important-urgent');
    api.setTime(at(TODAY));
    await api.place(b!, TODAY, 'important-urgent');
    await api.place(c!, TODAY, 'important-not-urgent');
    expect((await api.call('GET', '/matrices')).body).toEqual(['2026-09-20', TODAY]);
    await api.return(b!);
    expect((await api.call('GET', '/matrices')).body).toEqual(['2026-09-20', TODAY]);
    await api.return(c!);
    expect((await api.call('GET', '/matrices')).body).toEqual(['2026-09-20']);
  });
});

describe('placing into tomorrow', () => {
  it('is refused at 19:59, creating no Matrix', async () => {
    const api = setup(at(TODAY, '19:59'));
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.place(milk!, TOMORROW, 'important-urgent')).toMatchObject({ status: 409, body: { reason: 'date_not_placeable' } });
    expect((await api.matrix(TOMORROW)).status).toBe(404);
  });

  it('is accepted from 20:00', async () => {
    const api = setup(at(TODAY, '20:00'));
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.place(milk!, TOMORROW, 'important-urgent')).toMatchObject({ status: 200, body: { matrixDate: TOMORROW } });
    expect(await api.quadrantTexts(TOMORROW, 'important-urgent')).toEqual(['Buy milk']);
  });
});

describe('placing into the day after tomorrow', () => {
  it('is always refused, even late in the evening', async () => {
    const api = setup(at(TODAY, '00:00'));
    const [milk] = await api.writeAll('Buy milk');
    for (const time of ['00:00', '19:59', '20:00', '23:59']) {
      api.setTime(at(TODAY, time));
      expect(await api.place(milk!, DAY_AFTER_TOMORROW, 'important-urgent')).toMatchObject({ status: 409, body: { reason: 'date_not_placeable' } });
    }
    expect((await api.matrix(DAY_AFTER_TOMORROW)).status).toBe(404);
  });
});

describe('placing into an earlier date', () => {
  it('is accepted until its Matrix freezes, even when it has no Matrix yet', async () => {
    const api = setup(at(TODAY, '05:59'));
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.place(milk!, YESTERDAY, 'important-urgent')).toMatchObject({ status: 200, body: { matrixDate: YESTERDAY } });
  });
});

/**
 * Yesterday's Matrix, with an unfinished Task, a Completed Task and one Task waiting in the Task List, at `time` today.
 */
async function yesterdaysMatrixAt(time: string) {
  const api = setup(at(YESTERDAY, '10:00'));
  const [open, done, waiting, other] = await api.writeAll('open', 'done', 'waiting', 'other');
  await api.place(open!, YESTERDAY, 'important-urgent');
  await api.place(done!, YESTERDAY, 'important-urgent');
  await api.place(other!, YESTERDAY, 'not-important-urgent');
  await api.complete(done!);
  api.setTime(at(TODAY, time));
  return { api, open: open!, done: done!, waiting: waiting!, other: other! };
}

describe('a Matrix at 05:59 the day after its date', () => {
  it('still accepts place, move, return, edit, complete and un-complete', async () => {
    const { api, open, done, waiting, other } = await yesterdaysMatrixAt('05:59');
    expect((await api.place(waiting, YESTERDAY, 'important-urgent', 0)).status).toBe(200);
    expect((await api.move(open, 0, { date: YESTERDAY, quadrant: 'important-not-urgent' })).status).toBe(200);
    expect((await api.return(other)).status).toBe(200);
    expect((await api.edit(open, 'open, edited')).status).toBe(200);
    expect((await api.complete(open)).status).toBe(200);
    expect((await api.uncomplete(done)).status).toBe(200);
  });
});

describe('a Matrix from 06:00 the day after its date', () => {
  const frozen = { status: 409, body: { reason: 'matrix_frozen' } };

  it('refuses Placement into it', async () => {
    const { api, waiting } = await yesterdaysMatrixAt('06:00');
    expect(await api.place(waiting, YESTERDAY, 'important-urgent')).toMatchObject(frozen);
    expect(await api.taskListTexts()).toEqual(['waiting']);
  });

  it('refuses Placement into its date even when it has no Matrix, creating none', async () => {
    const api = setup(at(TODAY, '06:00'));
    const [milk] = await api.writeAll('Buy milk');
    expect(await api.place(milk!, YESTERDAY, 'important-urgent')).toMatchObject(frozen);
    expect((await api.matrix(YESTERDAY)).status).toBe(404);
  });

  it('refuses moving a Task within it, or within or between its Quadrants', async () => {
    const { api, open, done } = await yesterdaysMatrixAt('06:00');
    expect(await api.move(open, 1, { date: YESTERDAY, quadrant: 'important-urgent' })).toMatchObject(frozen);
    expect(await api.move(open, 0, { date: YESTERDAY, quadrant: 'important-not-urgent' })).toMatchObject(frozen);
    expect(await api.move(done, 0, { date: YESTERDAY, quadrant: 'important-urgent' })).toMatchObject(frozen);
    expect(await api.quadrantTexts(YESTERDAY, 'important-urgent')).toEqual(['open', 'done']);
  });

  it('refuses moving a Task out of it into today’s Matrix', async () => {
    const { api, open } = await yesterdaysMatrixAt('06:00');
    expect(await api.move(open, 0, { date: TODAY, quadrant: 'important-urgent' })).toMatchObject(frozen);
  });

  it('refuses returning a Task from it, keeping the Matrix', async () => {
    const { api, other } = await yesterdaysMatrixAt('06:00');
    expect(await api.return(other)).toMatchObject(frozen);
    expect(await api.quadrantTexts(YESTERDAY, 'not-important-urgent')).toEqual(['other']);
  });

  it('refuses editing a Task in it, unfinished or Completed', async () => {
    const { api, open, done } = await yesterdaysMatrixAt('06:00');
    expect(await api.edit(open, 'changed')).toMatchObject(frozen);
    expect(await api.edit(done, 'changed')).toMatchObject(frozen);
    expect(await api.quadrantTexts(YESTERDAY, 'important-urgent')).toEqual(['open', 'done']);
  });

  it('refuses completing and un-completing a Task in it', async () => {
    const { api, open, done } = await yesterdaysMatrixAt('06:00');
    expect(await api.complete(open)).toMatchObject(frozen);
    expect(await api.uncomplete(done)).toMatchObject(frozen);
    const tasks = (await api.matrix(YESTERDAY)).body.quadrants['important-urgent'];
    expect(tasks.map((t) => t.completedAt === null)).toEqual([true, false]);
  });

  it('refuses deleting a Task in it', async () => {
    const { api, open, done } = await yesterdaysMatrixAt('06:00');
    expect(await api.remove(open)).toMatchObject(frozen);
    expect(await api.remove(done)).toMatchObject(frozen);
  });

  it('is kept, and can still be viewed, long after', async () => {
    const { api } = await yesterdaysMatrixAt('06:00');
    api.setTime(at('2027-09-24'));
    expect(await api.quadrantTexts(YESTERDAY, 'important-urgent')).toEqual(['open', 'done']);
    expect((await api.call('GET', '/matrices')).body).toEqual([YESTERDAY]);
  });

  it('leaves the Task List and today’s Matrix free to change', async () => {
    const { api, waiting } = await yesterdaysMatrixAt('06:00');
    expect((await api.edit(waiting, 'still waiting')).status).toBe(200);
    expect((await api.place(waiting, TODAY, 'important-urgent')).status).toBe(200);
    expect((await api.complete(waiting)).status).toBe(200);
  });
});
