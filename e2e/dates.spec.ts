import type { Locator, Page } from '@playwright/test';
import { at, expect, test, type apiClient } from './fixtures.ts';

type Api = ReturnType<typeof apiClient>;

const TODAY = '2026-09-24';
const YESTERDAY = '2026-09-23';

const header = (page: Page) => page.getByRole('banner');
const previous = (page: Page) => page.getByRole('button', { name: 'Previous date' });
const next = (page: Page) => page.getByRole('button', { name: 'Next date' });
const matrix = (page: Page) => page.getByRole('region', { name: /^Matrix for / });
const noEarlier = (page: Page) => page.getByRole('region', { name: 'No earlier Matrix' });
const quadrant = (page: Page, name: string) => matrix(page).getByRole('region', { name, exact: true });
const placed = (page: Page, text: string) => matrix(page).getByRole('listitem').filter({ hasText: text });
const taskList = (page: Page) => page.getByRole('complementary', { name: 'Task List' });
const rows = (page: Page) => taskList(page).getByRole('listitem');
const row = (page: Page, text: string) => rows(page).filter({ hasText: text });

/** Presses on a Task's text and drags it with the mouse to just above another element (or into its middle), leaving the button down. */
async function drag(page: Page, task: Locator, target: Locator, where: 'above' | 'into') {
  const from = (await task.locator('.task-text').boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 10, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + from.height / 2 + 6, { steps: 3 });
  await page.mouse.move(to.x + 30, where === 'above' ? to.y + 3 : to.y + to.height / 2, { steps: 6 });
}

/** Writes Tasks and places them, in order, in Important + Urgent of `date`'s Matrix. */
async function placeAll(api: Api, date: string, ...texts: string[]) {
  const ids = await api.write(...texts);
  for (const id of ids) await api.place(id, date, 'important-urgent');
  return ids;
}

const apiQuadrant = async (api: Api, date: string) => (await api.matrix(date))?.quadrants['important-urgent'].map((t) => t.text);

test.describe('getting around Matrices', () => {
  test('says "No earlier Matrix" past the oldest one, with ‹ faded and disabled; › returns', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    await expect(next(app)).toBeDisabled();
    await previous(app).click();

    await expect(noEarlier(app)).toHaveText('No earlier Matrix');
    await expect(noEarlier(app)).toHaveCSS('font-weight', '700');
    await expect(noEarlier(app)).toHaveCSS('font-family', /Caveat/);
    await expect(noEarlier(app).getByRole('region')).toHaveCount(0);
    await expect(matrix(app)).toHaveCount(0);
    await expect(header(app)).toHaveText(/^Fourfold\s*‹\s*›$/);
    await expect(previous(app)).toBeDisabled();
    await expect(app.locator('.date-nav .sketch-box').first()).toHaveCSS('opacity', '0.3');
    await expect(rows(app)).toHaveText(['Buy milk']);

    await next(app).click();
    await expect(matrix(app)).toHaveAccessibleName('Matrix for Thursday, 24 September');
    await expect(header(app)).toHaveText(/^Fourfold\s*‹\s*Thursday, 24 September\s*›$/);
    await expect(previous(app)).toBeEnabled();
  });

  test('the Task List can still be reordered while "No earlier Matrix" shows', async ({ app, api }) => {
    await api.write('Buy milk', 'Call mum');
    await app.reload();
    await expect(rows(app)).toHaveText(['Call mum', 'Buy milk']);
    await previous(app).click();
    await expect(noEarlier(app)).toBeVisible();

    await drag(app, row(app, 'Buy milk'), row(app, 'Call mum'), 'above');
    await app.mouse.up();

    await expect(rows(app)).toHaveText(['Buy milk', 'Call mum']);
    await expect.poll(async () => (await api.taskList()).map((t) => t.text)).toEqual(['Buy milk', 'Call mum']);
  });

  test.describe('days after Matrices were made', () => {
    // The Matrices are made on the 20th and 21st; the page is opened on the 24th.
    test.use({ startAt: at('2026-09-21', '05:00'), pageAt: at(TODAY) });

    test('opens on today; ‹ skips straight to each earlier Matrix and › comes back, stopping at today', async ({ app, api }) => {
      await placeAll(api, '2026-09-20', 'old');
      await placeAll(api, '2026-09-21', 'newer');
      await api.write('waiting');
      await app.reload();

      await expect(matrix(app)).toHaveAccessibleName('Matrix for Thursday, 24 September');
      await expect(matrix(app).getByRole('listitem')).toHaveCount(0);
      await expect(next(app)).toBeDisabled();

      await previous(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Monday, 21 September');
      await expect(header(app)).toHaveText(/^Fourfold\s*‹\s*Monday, 21 September\s*›$/);
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['newer']);
      await previous(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Sunday, 20 September');
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['old']);
      await expect(rows(app)).toHaveText(['waiting']);
      await previous(app).click();
      await expect(noEarlier(app)).toBeVisible();

      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Sunday, 20 September');
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Monday, 21 September');
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Thursday, 24 September');
      await expect(matrix(app).getByRole('listitem')).toHaveCount(0);
      await expect(next(app)).toBeDisabled();
    });
  });

  test.describe('just before 8pm', () => {
    test.use({ startAt: at(TODAY, '19:59') });

    test('› stops at today until 20:00, then reaches tomorrow, and looking at it creates nothing', async ({ app, api }) => {
      await expect(next(app)).toBeDisabled();
      await app.clock.setFixedTime(at(TODAY, '20:00'));
      await expect(next(app)).toBeEnabled();
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Friday, 25 September');
      await expect(header(app)).toHaveText(/^Fourfold\s*‹\s*Friday, 25 September\s*›$/);
      await expect(matrix(app).getByRole('region')).toHaveCount(4);
      await expect(next(app)).toBeDisabled();
      expect(await api.matrixDates()).toEqual([]);
      await previous(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Thursday, 24 September');
    });
  });

  test.describe('from 8pm', () => {
    test.use({ startAt: at(TODAY, '20:00') });

    test("places into tomorrow's Matrix while viewing it", async ({ app, api }) => {
      await api.write('Buy milk');
      await app.reload();
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Friday, 25 September');
      await row(app, 'Buy milk').getByRole('button', { name: 'Place in the Matrix' }).click();
      await app.getByRole('button', { name: 'Place in Important + Urgent' }).click();
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk']);
      await expect.poll(() => apiQuadrant(api, '2026-09-25')).toEqual(['Buy milk']);
      expect(await api.matrixDates()).toEqual(['2026-09-25']);
    });

    /** Holds every request to `path` until the returned function is called. */
    async function hold(page: Page, path: string) {
      let release!: () => void;
      const released = new Promise<void>((r) => (release = r));
      await page.route(path, async (route) => {
        await released;
        await route.continue();
      });
      return release;
    }

    test('a Placement still being sent stays out of the Task List when another date is chosen', async ({ app, api }) => {
      await api.write('Buy milk', 'Call mum');
      await app.reload();
      const release = await hold(app, '**/api/tasks/*/place');
      await row(app, 'Buy milk').getByRole('button', { name: 'Place in the Matrix' }).click();
      await app.getByRole('button', { name: 'Place in Important + Urgent' }).click();
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Friday, 25 September');
      await expect(rows(app)).toHaveText(['Call mum']);
      await expect(previous(app)).toBeEnabled();

      release();
      await expect.poll(() => apiQuadrant(api, TODAY)).toEqual(['Buy milk']);
      await expect(rows(app)).toHaveText(['Call mum']);
      await previous(app).click();
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk']);
    });

    test('a return still being sent shows in the Task List when another date is chosen', async ({ app, api }) => {
      await placeAll(api, TODAY, 'Buy milk');
      await api.write('Call mum');
      await app.reload();
      const release = await hold(app, '**/api/tasks/*/return');
      await placed(app, 'Buy milk').getByRole('button', { name: 'Return to the Task List' }).click();
      await next(app).click();
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Friday, 25 September');
      await expect(rows(app)).toHaveText(['Buy milk', 'Call mum']);

      release();
      await expect.poll(() => api.matrixDates()).toEqual([]);
      await expect(rows(app)).toHaveText(['Buy milk', 'Call mum']);
    });
  });
});

test.describe('a Frozen Matrix', () => {
  // Yesterday's Matrix is made yesterday; the page looks at it from 06:00 today, when it's frozen.
  test.use({ startAt: at(YESTERDAY), pageAt: at(TODAY, '06:00') });

  /** Yesterday's Matrix with an unfinished and a Completed Task, a Task waiting in the Task List, on screen. */
  async function openYesterday(app: Page, api: Api) {
    const [, done] = await placeAll(api, YESTERDAY, 'open', 'done');
    await api.complete(done!);
    await api.write('waiting');
    await app.reload();
    await previous(app).click();
    await expect(matrix(app)).toHaveAccessibleName('Matrix for Wednesday, 23 September');
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['open', 'done']);
  }

  test('refuses every change, looking just like an editable one', async ({ app, api }) => {
    await openYesterday(app, api);
    const changes: string[] = [];
    app.on('request', (r) => r.method() !== 'GET' && changes.push(r.url()));

    // Checkboxes: disabled, so announced "dimmed", but drawn as usual.
    const open = matrix(app).getByRole('checkbox', { name: 'open', exact: true });
    const done = matrix(app).getByRole('checkbox', { name: 'done', exact: true });
    await expect(open).toBeDisabled();
    await expect(open).not.toBeChecked();
    await expect(done).toBeDisabled();
    await expect(done).toBeChecked();
    await expect(placed(app, 'open').locator('.checkbox-mark')).toHaveCSS('opacity', '1');
    await placed(app, 'open').locator('.checkbox').click({ force: true });
    await expect(open).not.toBeChecked();

    // Double-click does nothing.
    await placed(app, 'open').getByText('open').dblclick();
    await expect(matrix(app).getByRole('textbox')).toHaveCount(0);

    // The mini-list button isn't usable.
    await placed(app, 'open').hover();
    await expect(placed(app, 'open').getByRole('button', { name: 'Return to the Task List' })).toBeDisabled();

    // Its Quadrants don't accept a drop, and the Quadrant buttons place nothing.
    await drag(app, row(app, 'waiting'), quadrant(app, 'Important + Not Urgent'), 'into');
    await expect(app.locator('.floating-card')).toHaveText('waiting');
    await expect(matrix(app).locator('.drop-line')).toHaveCount(0);
    await app.mouse.up();
    await row(app, 'waiting').getByRole('button', { name: 'Place in the Matrix' }).click();
    await app.getByRole('button', { name: 'Place in Important + Urgent' }).click();
    await expect(rows(app)).toHaveText(['waiting']);

    // Its Tasks can't be dragged.
    await drag(app, placed(app, 'done'), placed(app, 'open'), 'above');
    await expect(app.locator('.floating-card')).toHaveCount(0);
    await app.mouse.up();

    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['open', 'done']);
    await expect(quadrant(app, 'Important + Not Urgent').getByRole('listitem')).toHaveCount(0);
    expect(changes).toEqual([]);
    expect(await apiQuadrant(api, YESTERDAY)).toEqual(['open', 'done']);
  });

  test.describe('freezing while on screen', () => {
    test.use({ pageAt: at(TODAY, '05:59') });

    test('stays on screen and starts refusing; a drag in progress snaps back', async ({ app, api }) => {
      await openYesterday(app, api);
      const changes: string[] = [];
      app.on('request', (r) => r.method() !== 'GET' && changes.push(r.url()));
      const open = matrix(app).getByRole('checkbox', { name: 'open', exact: true });
      await expect(open).toBeEnabled();
      await drag(app, placed(app, 'done'), placed(app, 'open'), 'above');
      await expect(matrix(app).locator('.drop-line')).toBeVisible();

      await app.clock.setFixedTime(at(TODAY, '06:00'));
      await expect(open).toBeDisabled();
      await app.mouse.up();

      await expect(app.locator('.floating-card')).toHaveCount(0);
      await expect(matrix(app)).toHaveAccessibleName('Matrix for Wednesday, 23 September');
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['open', 'done']);
      // The server's clock is still yesterday's, so the move would have been accepted had the page sent it.
      expect(changes).toEqual([]);
      expect(await apiQuadrant(api, YESTERDAY)).toEqual(['open', 'done']);
    });
  });
});
