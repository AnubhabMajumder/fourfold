import type { Locator, Page } from '@playwright/test';
import type { Quadrant } from '@fourfold/core';
import { BASE_URL, expect, test, type apiClient } from './fixtures.ts';

type Api = ReturnType<typeof apiClient>;

const taskList = (page: Page) => page.getByRole('complementary', { name: 'Task List' });
const rows = (page: Page) => taskList(page).getByRole('listitem');
const input = (page: Page) => page.getByRole('textbox', { name: 'New Task' });

async function write(page: Page, ...texts: string[]) {
  for (const text of texts) {
    await input(page).fill(text);
    await input(page).press('Enter');
  }
}

const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
const apiTexts = async (api: { taskList: () => Promise<{ text: string }[]> }) => (await api.taskList()).map((t) => t.text);

/** Double-clicks a Task's text and types over it, leaving the edit open. */
async function startEdit(page: Page, text: string, replacement: string) {
  await row(page, text).getByText(text).dblclick();
  const edit = taskList(page).getByRole('textbox', { name: 'Task text' });
  await expect(edit).toBeFocused();
  await edit.fill(replacement);
  return edit;
}

/**
 * Presses on a Task and drags it with the mouse to just above or below another element (or into its middle),
 * leaving the button down.
 */
async function drag(page: Page, task: Locator, target: Locator, where: 'above' | 'below' | 'into') {
  // Pressed on its text: its buttons and checkbox don't start a drag.
  const from = (await task.locator('.task-text').boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 10, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + from.height / 2 + 6, { steps: 3 });
  const y = where === 'above' ? to.y + 3 : where === 'below' ? to.y + to.height - 3 : to.y + to.height / 2;
  await page.mouse.move(to.x + 30, y, { steps: 6 });
}

/** Drags a Task List Task to just above or below another, leaving the button down. */
const dragOver = (page: Page, text: string, target: string, where: 'above' | 'below') => drag(page, row(page, text), row(page, target), where);

const matrix = (page: Page) => page.getByRole('region', { name: /^Matrix for / });

/** Every sketched line on the page, in order. */
const sketches = (page: Page) => page.locator('[aria-hidden="true"] path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')));

test.describe('first launch', () => {
  test('shows an empty Task List, with nothing in it, and the input focused', async ({ app }) => {
    await expect(input(app)).toBeFocused();
    await expect(input(app)).toHaveAttribute('placeholder', 'Write a Task…');
    await expect(rows(app)).toHaveCount(0);
    await expect(taskList(app).getByRole('checkbox')).toHaveCount(0);
    await expect(taskList(app)).toHaveText(/^Task List\s*add$/);
  });

  test("shows today's date between ‹ and ›, and nothing else in the header", async ({ app }) => {
    const header = app.getByRole('banner');
    await expect(header.getByRole('heading', { name: 'Fourfold' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Previous date' })).toHaveText('‹');
    await expect(header.getByRole('button', { name: 'Next date' })).toHaveText('›');
    await expect(header).toHaveText(/^Fourfold\s*‹\s*Thursday, 24 September\s*›$/);
  });

  test("draws today's Matrix empty: four Quadrants, felt-pen dividers and the axis headers", async ({ app }) => {
    await expect(matrix(app)).toHaveAccessibleName('Matrix for Thursday, 24 September');
    await expect(matrix(app).getByRole('region')).toHaveText(['', '', '', '']);
    const quadrants = ['Important + Urgent', 'Important + Not Urgent', 'Not Important + Urgent', 'Not Important + Not Urgent'];
    for (const [i, name] of quadrants.entries()) await expect(matrix(app).getByRole('region').nth(i)).toHaveAccessibleName(name);
    await expect(matrix(app).getByRole('listitem')).toHaveCount(0);
    await expect(matrix(app)).toHaveText(/^urgent\s*not urgent\s*important\s*not important$/);
    await expect(matrix(app).locator('.dividers path')).toHaveCount(2);
  });

  test('shows nothing but the header, the Task List and the Matrix', async ({ app }) => {
    await expect(app.locator('#root')).toHaveText(
      /^Fourfold\s*‹\s*Thursday, 24 September\s*›\s*Task List\s*add\s*urgent\s*not urgent\s*important\s*not important$/,
    );
  });
});

test.describe('the hand-drawn look', () => {
  test('uses the bundled handwriting fonts, loaded before anything is drawn', async ({ page, server: _ }) => {
    const offOrigin: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(BASE_URL)) offOrigin.push(r.url());
    });
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: 'Task List' })).toBeVisible();
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replaceAll('"', '')} ${f.weight}`),
    );
    expect(loaded).toEqual(expect.arrayContaining(['Kalam 400', 'Kalam 700', 'Caveat 700']));
    expect(offOrigin).toEqual([]);
  });

  test('sets text in Kalam and headings in Caveat, at the sizes of the design', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    const font = async (l: ReturnType<Page['locator']>, family: string, size: string) => {
      await expect(l).toHaveCSS('font-family', new RegExp(`^"?${family}`));
      await expect(l).toHaveCSS('font-size', size);
    };
    await font(rows(app).first(), 'Kalam', '19px');
    await expect(rows(app).first()).toHaveCSS('line-height', '24.7px');
    await font(app.getByRole('heading', { name: 'Fourfold' }), 'Caveat', '36px');
    await font(app.getByText('Thursday, 24 September'), 'Caveat', '26px');
    await font(app.getByRole('heading', { name: 'Task List' }), 'Caveat', '30px');
    await font(app.getByText('not urgent'), 'Caveat', '26px');
    await font(app.getByRole('button', { name: 'add' }), 'Caveat', '22px');
  });

  test('draws every sketched line the same after a reload', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    await expect(matrix(app).locator('.dividers path')).toHaveCount(2);
    const before = await sketches(app);
    expect(before.length).toBeGreaterThan(2);
    await app.reload();
    await expect(matrix(app).locator('.dividers path')).toHaveCount(2);
    expect(await sketches(app)).toEqual(before);
  });

  test('keeps the Task List a fixed-width column beside the Matrix', async ({ app }) => {
    const list = (await taskList(app).boundingBox())!;
    const matrixBox = (await matrix(app).boundingBox())!;
    expect(list.width).toBe(320);
    expect(matrixBox.x).toBeGreaterThanOrEqual(list.x + list.width);
    await app.setViewportSize({ width: 1600, height: 900 });
    expect((await taskList(app).boundingBox())!.width).toBe(320);
  });

  test('outlines focused controls in the strike colour', async ({ app }) => {
    await app.keyboard.press('Tab');
    const add = app.getByRole('button', { name: 'add' });
    await expect(add).toBeFocused();
    await expect(add).toHaveCSS('outline', 'rgb(28, 28, 28) solid 2px');
  });
});

test.describe('placing with the mini-Matrix buttons', () => {
  const TODAY = '2026-09-24';
  const quadrant = (page: Page, name: string) => matrix(page).getByRole('region', { name, exact: true });
  const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
  const placeButton = (page: Page, text: string) => row(page, text).getByRole('button', { name: 'Place in the Matrix' });

  test('moves a Task at once to the bottom of the chosen Quadrant', async ({ app, api }) => {
    const [milk] = await api.write('Buy milk', 'Call Mum', 'Pay rent');
    await api.place(milk!, TODAY, 'important-not-urgent');
    await app.reload();

    await placeButton(app, 'Pay rent').click();
    const buttons = row(app, 'Pay rent').getByRole('group', { name: 'Quadrants' }).getByRole('button');
    const names = ['Important + Urgent', 'Important + Not Urgent', 'Not Important + Urgent', 'Not Important + Not Urgent'];
    await expect(buttons).toHaveCount(4);
    for (const [i, name] of names.entries()) await expect(buttons.nth(i)).toHaveAccessibleName(`Place in ${name}`);
    await buttons.nth(1).click();

    await expect(rows(app)).toHaveText(['Call Mum']);
    await expect(quadrant(app, 'Important + Not Urgent').getByRole('listitem')).toHaveText(['Buy milk', 'Pay rent']);
    await expect
      .poll(async () => (await api.matrix(TODAY))?.quadrants['important-not-urgent'].map((t) => t.text))
      .toEqual(['Buy milk', 'Pay rent']);

    await app.reload();
    await expect(quadrant(app, 'Important + Not Urgent').getByRole('listitem')).toHaveText(['Buy milk', 'Pay rent']);
    await expect(rows(app)).toHaveText(['Call Mum']);
  });

  test('draws each Quadrant button as a mini-Matrix with its Quadrant marked', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    const icon = placeButton(app, 'Buy milk').locator('svg[aria-hidden="true"] path');
    const pathsIn = (l: ReturnType<Page['locator']>) => l.evaluateAll((ps) => ps.length);
    const plain = await pathsIn(icon);
    expect(plain).toBeGreaterThan(0);
    await placeButton(app, 'Buy milk').click();
    for (const b of await row(app, 'Buy milk').getByRole('group').getByRole('button').all()) {
      expect(await pathsIn(b.locator('svg[aria-hidden="true"] path'))).toBeGreaterThan(plain);
    }
  });

  test('works from the keyboard, and Escape closes the Quadrant buttons', async ({ app, api }) => {
    await api.write('Buy milk', 'Call Mum');
    await app.reload();
    await placeButton(app, 'Call Mum').focus();
    await app.keyboard.press('Enter');
    await expect(placeButton(app, 'Call Mum')).toHaveAttribute('aria-expanded', 'true');
    await expect(app.getByRole('button', { name: 'Place in Important + Urgent' })).toBeFocused();
    await app.keyboard.press('Escape');
    await expect(app.getByRole('group', { name: 'Quadrants' })).toHaveCount(0);
    await expect(placeButton(app, 'Call Mum')).toBeFocused();

    await app.keyboard.press('Enter');
    await app.keyboard.press('Tab');
    await app.keyboard.press('Tab');
    await expect(app.getByRole('button', { name: 'Place in Not Important + Urgent' })).toBeFocused();
    await app.keyboard.press('Enter');
    await expect(quadrant(app, 'Not Important + Urgent').getByRole('listitem')).toHaveText(['Call Mum']);
    // The focus goes on to the next Task, ready to place it too.
    await expect(placeButton(app, 'Buy milk')).toBeFocused();
  });

  test('closes the Quadrant buttons when the focus moves away', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    await placeButton(app, 'Buy milk').click();
    await expect(app.getByRole('group', { name: 'Quadrants' })).toBeVisible();
    await input(app).click();
    await expect(app.getByRole('group', { name: 'Quadrants' })).toHaveCount(0);
  });

  test('snaps a Task back to its place in the Task List if the API refuses it', async ({ app, api }) => {
    await api.write('Buy milk', 'Call Mum', 'Pay rent');
    await app.reload();
    let release!: () => void;
    const answered = new Promise<void>((r) => (release = r));
    await app.route('**/api/tasks/*/place', async (route) => {
      await answered;
      await route.fulfill({ status: 409, json: { reason: 'task_already_placed' } });
    });
    await placeButton(app, 'Call Mum').click();
    await app.getByRole('button', { name: 'Place in Important + Urgent' }).click();
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Call Mum']);
    await expect(rows(app)).toHaveText(['Pay rent', 'Buy milk']);
    release();
    await expect(rows(app)).toHaveText(['Pay rent', 'Call Mum', 'Buy milk']);
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveCount(0);
  });

  test.describe('left open past midnight', () => {
    test.use({ startAt: new Date(`${TODAY}T23:59:58`) });

    test("places into the new day's Matrix", async ({ app, api }) => {
      const [, probe] = await api.write('Buy milk', 'Probe');
      await app.reload();
      // Both clocks go past midnight: the server's runs on (the probe goes in once it has), the page's is moved on.
      await expect
        .poll(() => api.place(probe!, '2026-09-25', 'not-important-not-urgent').then(() => true, () => false), { timeout: 5_000 })
        .toBe(true);
      await app.clock.setFixedTime(new Date('2026-09-25T00:00:05'));

      await placeButton(app, 'Buy milk').click();
      await app.getByRole('button', { name: 'Place in Important + Urgent' }).click();

      await expect(matrix(app)).toHaveAccessibleName('Matrix for Friday, 25 September');
      await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk']);
      await expect.poll(async () => (await api.matrix('2026-09-25'))?.quadrants['important-urgent'].map((t) => t.text)).toEqual(['Buy milk']);
    });
  });

  test('lets each Quadrant scroll on its own when it overflows, drawing Tasks straight', async ({ app, api }) => {
    const texts = Array.from({ length: 30 }, (_, i) => `Task ${i + 1}`);
    for (const id of await api.write(...texts)) await api.place(id, TODAY, 'important-urgent');
    await app.reload();
    const full = quadrant(app, 'Important + Urgent').getByRole('list');
    await expect(full.getByRole('listitem')).toHaveCount(30);
    const size = (l: ReturnType<Page['locator']>) => l.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    const { client, scroll } = await size(full);
    expect(scroll).toBeGreaterThan(client);
    expect((await size(quadrant(app, 'Not Important + Urgent').getByRole('list'))).client).toBe(client);
    const viewport = app.viewportSize()!;
    const box = (await matrix(app).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expect(full.getByRole('listitem').first()).toHaveCSS('transform', 'none');
    await expect(full.getByRole('listitem').first()).toHaveCSS('rotate', 'none');
  });
});

test.describe('the Task List', () => {
  test('writes Tasks with Enter or the add button, newest at the top, without checkboxes', async ({ app, api }) => {
    await write(app, 'first');
    await input(app).fill('second');
    await app.getByRole('button', { name: 'add' }).click();
    await expect(rows(app)).toHaveText(['second', 'first']);
    await expect(input(app)).toHaveValue('');
    await expect(taskList(app).getByRole('checkbox')).toHaveCount(0);
    await expect.poll(async () => (await api.taskList()).map((t) => t.text)).toEqual(['second', 'first']);
  });

  test('shows a new Task before the API has answered', async ({ app, api }) => {
    let release!: () => void;
    const answered = new Promise<void>((r) => (release = r));
    await app.route('**/api/tasks', async (route) => {
      await answered;
      await route.continue();
    });
    await write(app, 'Buy milk');
    await expect(rows(app)).toHaveText(['Buy milk']);
    expect(await api.taskList()).toEqual([]);
    release();
    await expect.poll(async () => (await api.taskList()).map((t) => t.text)).toEqual(['Buy milk']);
  });

  test('keeps a Task written while the Task List is still loading', async ({ app, api }) => {
    await api.write('Buy milk');
    let release!: () => void;
    const loaded = new Promise<void>((r) => (release = r));
    await app.route('**/api/task-list', async (route) => {
      await loaded;
      await route.continue();
    });
    await app.reload();
    await write(app, 'Call Mum');
    release();
    await expect(rows(app)).toHaveText(['Call Mum', 'Buy milk']);
  });

  test('ignores empty text', async ({ app, api }) => {
    await write(app, '   ');
    await app.getByRole('button', { name: 'add' }).click();
    await expect(rows(app)).toHaveCount(0);
    expect(await api.taskList()).toEqual([]);
  });

  test('snaps a Task back if the API refuses it', async ({ app }) => {
    await app.route('**/api/tasks', (route) => route.fulfill({ status: 409, json: { reason: 'empty_text' } }));
    await write(app, 'Buy milk');
    await expect(rows(app)).toHaveCount(0);
  });

  test('re-fetches the Task List after the API refuses a Task', async ({ app, api }) => {
    await app.route('**/api/tasks', async (route) => {
      await api.write('Written in another window');
      await route.fulfill({ status: 409, json: { reason: 'empty_text' } });
    });
    await write(app, 'Buy milk');
    await expect(rows(app)).toHaveText(['Written in another window']);
  });

  test('edits a Task in place on double-click, saving with Enter', async ({ app, api }) => {
    await api.write('Buy milk', 'Call Mum');
    await app.reload();
    const edit = await startEdit(app, 'Buy milk', 'Buy oat milk');
    await expect(edit).toHaveValue('Buy oat milk');
    await edit.press('Enter');
    await expect(rows(app)).toHaveText(['Call Mum', 'Buy oat milk']);
    await expect(taskList(app).getByRole('textbox', { name: 'Task text' })).toHaveCount(0);
    await expect.poll(() => apiTexts(api)).toEqual(['Call Mum', 'Buy oat milk']);
  });

  test('saves an edit when clicking away', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    await startEdit(app, 'Buy milk', 'Buy bread');
    await app.getByRole('heading', { name: 'Task List' }).click();
    await expect(rows(app)).toHaveText(['Buy bread']);
    await expect.poll(() => apiTexts(api)).toEqual(['Buy bread']);
  });

  test('cancels an edit with Esc', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    const edit = await startEdit(app, 'Buy milk', 'Buy bread');
    await edit.press('Escape');
    await expect(rows(app)).toHaveText(['Buy milk']);
    await expect(taskList(app).getByRole('textbox', { name: 'Task text' })).toHaveCount(0);
    expect(await apiTexts(api)).toEqual(['Buy milk']);
  });

  test('deletes a Task saved with empty text', async ({ app, api }) => {
    await api.write('Buy milk', 'Call Mum');
    await app.reload();
    const edit = await startEdit(app, 'Buy milk', '   ');
    await edit.press('Enter');
    await expect(rows(app)).toHaveText(['Call Mum']);
    await expect.poll(() => apiTexts(api)).toEqual(['Call Mum']);
  });

  test('shows an edit before the API has answered, and snaps it back if refused', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    let release!: () => void;
    const answered = new Promise<void>((r) => (release = r));
    await app.route('**/api/tasks/*', async (route) => {
      await answered;
      await route.fulfill({ status: 409, json: { reason: 'task_not_found' } });
    });
    await (await startEdit(app, 'Buy milk', 'Buy bread')).press('Enter');
    await expect(rows(app)).toHaveText(['Buy bread']);
    release();
    await expect(rows(app)).toHaveText(['Buy milk']);
  });

  test('shows a sketched × on hover that deletes the Task at once', async ({ app, api }) => {
    await api.write('Buy milk', 'Call Mum');
    await app.reload();
    const remove = row(app, 'Buy milk').getByRole('button', { name: 'Delete' });
    await expect(remove).toHaveCSS('opacity', '0');
    await expect(remove.locator('svg[aria-hidden="true"] path')).toHaveCount(2);
    await row(app, 'Buy milk').hover();
    await expect(remove).toHaveCSS('opacity', '1');
    await expect(remove).toHaveCSS('color', 'rgb(85, 85, 85)');
    await remove.hover();
    await expect(remove).toHaveCSS('color', 'rgb(176, 50, 31)');
    await remove.click();
    await expect(rows(app)).toHaveText(['Call Mum']);
    await expect.poll(() => apiTexts(api)).toEqual(['Call Mum']);
  });

  test('drags a Task to a new position, showing a drop line and a floating card', async ({ app, api }) => {
    await api.write('a', 'b', 'c', 'd');
    await app.reload();
    await expect(rows(app)).toHaveText(['d', 'c', 'b', 'a']);

    await dragOver(app, 'a', 'c', 'above');
    const line = taskList(app).locator('.drop-line');
    await expect(line).toBeVisible();
    await expect(line).toHaveCSS('height', '3px');
    const card = app.locator('.floating-card');
    await expect(card).toHaveText('a');
    await expect(card).toHaveCSS('transform', /^matrix/);
    await app.mouse.up();
    await expect(line).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await expect(rows(app)).toHaveText(['d', 'a', 'c', 'b']);
    await expect.poll(() => apiTexts(api)).toEqual(['d', 'a', 'c', 'b']);

    await dragOver(app, 'd', 'b', 'below');
    await app.mouse.up();
    await expect(rows(app)).toHaveText(['a', 'c', 'b', 'd']);
    await expect.poll(() => apiTexts(api)).toEqual(['a', 'c', 'b', 'd']);

    await app.reload();
    await expect(rows(app)).toHaveText(['a', 'c', 'b', 'd']);
  });

  test('snaps a dragged Task back when dropped outside any list or with Esc', async ({ app, api }) => {
    await api.write('a', 'b');
    await app.reload();
    await dragOver(app, 'a', 'b', 'above');
    const box = (await app.getByRole('banner').boundingBox())!;
    await app.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(taskList(app).locator('.drop-line')).toHaveCount(0);
    await app.mouse.up();
    await dragOver(app, 'a', 'b', 'above');
    await app.keyboard.press('Escape');
    await expect(app.locator('.floating-card')).toHaveCount(0);
    await app.mouse.up();
    await expect(rows(app)).toHaveText(['b', 'a']);
    expect(await apiTexts(api)).toEqual(['b', 'a']);
  });

  test.describe('on touch', () => {
    test.use({ hasTouch: true });

    /** Touches a Task, holds for `holdMs`, then slides to just above another Task and lets go. */
    async function touchDrag(page: Page, text: string, target: string, holdMs: number) {
      const cdp = await page.context().newCDPSession(page);
      const from = (await row(page, text).boundingBox())!;
      const to = (await row(page, target).boundingBox())!;
      const touch = (type: string, x: number, y: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      const [x, y] = [from.x + 20, from.y + from.height / 2];
      await touch('touchStart', x, y);
      await page.waitForTimeout(holdMs);
      for (let i = 1; i <= 6; i++) await touch('touchMove', x, y + ((to.y + 3 - y) * i) / 6);
      await touch('touchEnd', 0, 0);
    }

    test('press-and-hold drags a Task to a new position', async ({ app, api }) => {
      await api.write('a', 'b', 'c');
      await app.reload();
      await touchDrag(app, 'a', 'c', 600);
      await expect(rows(app)).toHaveText(['a', 'c', 'b']);
      await expect.poll(() => apiTexts(api)).toEqual(['a', 'c', 'b']);
    });

    test('double-tap edits a Task in place', async ({ app, api }) => {
      await api.write('Buy milk');
      await app.reload();
      const box = (await row(app, 'Buy milk').getByText('Buy milk').boundingBox())!;
      await app.touchscreen.tap(box.x + 10, box.y + box.height / 2);
      await app.touchscreen.tap(box.x + 10, box.y + box.height / 2);
      await expect(taskList(app).getByRole('textbox', { name: 'Task text' })).toBeFocused();
    });

    test('a quick swipe does not drag', async ({ app, api }) => {
      await api.write('a', 'b', 'c');
      await app.reload();
      await touchDrag(app, 'a', 'c', 0);
      await expect(app.locator('.floating-card')).toHaveCount(0);
      await expect(rows(app)).toHaveText(['c', 'b', 'a']);
    });
  });

  test('keeps Tasks after a reload and after the API restarts', async ({ app, api, server }) => {
    await write(app, 'Buy milk', 'Call Mum');
    await expect.poll(async () => (await api.taskList()).length).toBe(2);

    await app.reload();
    await expect(rows(app)).toHaveText(['Call Mum', 'Buy milk']);

    await server.stop();
    await server.run();
    await app.reload();
    await expect(rows(app)).toHaveText(['Call Mum', 'Buy milk']);
  });
});

test.describe('working with placed Tasks', () => {
  const TODAY = '2026-09-24';
  const quadrant = (page: Page, name: string) => matrix(page).getByRole('region', { name, exact: true });
  const placed = (page: Page, text: string) => matrix(page).getByRole('listitem').filter({ hasText: text });
  /** The strike's ink: one filled zigzag per line of text (not the masks it's drawn on with). */
  const strike = (page: Page, text: string) => placed(page, text).locator('.strike > svg[aria-hidden="true"] > g > path');
  const checkbox = (page: Page, text: string) => matrix(page).getByRole('checkbox', { name: text, exact: true });
  const completedAt = async (api: Api, text: string) =>
    Object.values((await api.matrix(TODAY))!.quadrants)
      .flat()
      .find((t) => t.text === text)?.completedAt;
  const quadrantTexts = async (api: Api) => (await api.matrix(TODAY))?.quadrants['important-urgent'].map((t) => t.text);

  /** Writes Tasks and places them, in order, in Important + Urgent, then opens the app afresh. */
  async function placeAll(app: Page, api: Api, ...texts: string[]) {
    for (const id of await api.write(...texts)) await api.place(id, TODAY, 'important-urgent');
    await app.reload();
  }

  test('completes a placed Task with its checkbox, labelled by its text, and un-completes it', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk', 'Call Mum');
    const box = checkbox(app, 'Buy milk');
    await expect(box).not.toBeChecked();
    await expect(strike(app, 'Buy milk')).toHaveCount(0);

    await box.check();
    await expect(box).toBeChecked();
    await expect(strike(app, 'Buy milk')).toHaveCount(1);
    await expect(placed(app, 'Buy milk').locator('.tick')).toHaveCSS('color', 'rgb(28, 28, 28)');
    // It stays where it was, with full-ink text.
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk', 'Call Mum']);
    await expect(placed(app, 'Buy milk').getByText('Buy milk')).toHaveCSS('opacity', '1');
    await expect.poll(() => completedAt(api, 'Buy milk')).not.toBeNull();

    await box.uncheck();
    await expect(box).not.toBeChecked();
    await expect(strike(app, 'Buy milk')).toHaveCount(0);
    await expect(placed(app, 'Buy milk').locator('.tick')).toHaveCount(0);
    await expect.poll(() => completedAt(api, 'Buy milk')).toBeNull();
    expect(await quadrantTexts(api)).toEqual(['Buy milk', 'Call Mum']);
  });

  test('works the checkbox from the keyboard, with the focus outline on its sketched box', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    await checkbox(app, 'Buy milk').focus();
    await app.keyboard.press('Space');
    await expect(checkbox(app, 'Buy milk')).toBeChecked();
    await expect(placed(app, 'Buy milk').locator('.checkbox-mark')).toHaveCSS('outline', 'rgb(28, 28, 28) solid 2px');
    await expect.poll(() => completedAt(api, 'Buy milk')).not.toBeNull();
  });

  test('draws the strike on when completing, never on load, and gives it no meaning of its own', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    await checkbox(app, 'Buy milk').check();
    await expect(placed(app, 'Buy milk').locator('.drawing-on')).toHaveCount(1);
    await expect.poll(() => completedAt(api, 'Buy milk')).not.toBeNull();

    await app.reload();
    await expect(checkbox(app, 'Buy milk')).toBeChecked();
    await expect(strike(app, 'Buy milk')).toHaveCount(1);
    await expect(placed(app, 'Buy milk').locator('.drawing-on')).toHaveCount(0);
    expect(await app.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(matrix(app).locator('s, del, [aria-checked]')).toHaveCount(0);
  });

  test('strikes each line of a long Task', async ({ app, api }) => {
    const long = 'Write the long letter to the council about the hedge, the bins, and the parking on the corner of the street';
    await placeAll(app, api, long);
    await checkbox(app, long).check();
    const lines = await placed(app, long)
      .locator('.strike > span')
      .evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
      });
    expect(lines).toBeGreaterThan(1);
    await expect(strike(app, long)).toHaveCount(lines);
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('shows the strike already drawn, and removes it at once', async ({ app, api }) => {
      await placeAll(app, api, 'Buy milk');
      const box = checkbox(app, 'Buy milk');
      await box.check();
      await expect(strike(app, 'Buy milk')).toHaveCount(1);
      await expect(placed(app, 'Buy milk').locator('.drawing-on')).toHaveCount(0);
      expect(await app.evaluate(() => document.getAnimations().length)).toBe(0);
      await box.uncheck();
      expect(await placed(app, 'Buy milk').locator('.strike > svg').count()).toBe(0);
    });
  });

  test('follows reduced motion being turned on while the app is open', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    await app.emulateMedia({ reducedMotion: 'reduce' });
    await checkbox(app, 'Buy milk').check();
    await expect(strike(app, 'Buy milk')).toHaveCount(1);
    await expect(placed(app, 'Buy milk').locator('.drawing-on')).toHaveCount(0);
  });

  test('hatches a Quadrant across its whole frame when all its Tasks are Completed', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk', 'Call Mum');
    const q = quadrant(app, 'Important + Urgent');
    await checkbox(app, 'Buy milk').check();
    await expect(q.locator('.hatching')).toHaveCount(0);
    await checkbox(app, 'Call Mum').check();
    await expect(q.locator('.hatching[aria-hidden="true"] path').first()).toBeAttached();
    expect(await q.locator('.hatching').boundingBox()).toEqual(await q.boundingBox());
    await expect(quadrant(app, 'Important + Not Urgent').locator('.hatching')).toHaveCount(0);
    await checkbox(app, 'Call Mum').uncheck();
    await expect(q.locator('.hatching')).toHaveCount(0);
  });

  test('returns an unfinished Task to the top of the Task List with the mini-list button shown on hover', async ({ app, api }) => {
    await api.write('Waiting');
    await placeAll(app, api, 'Buy milk', 'Call Mum');
    const returnButton = placed(app, 'Buy milk').getByRole('button', { name: 'Return to the Task List' });
    await expect(returnButton).toHaveCSS('opacity', '0');
    await expect(returnButton.locator('svg[aria-hidden="true"] path').first()).toBeAttached();
    await placed(app, 'Buy milk').hover();
    await expect(returnButton).toHaveCSS('opacity', '1');
    await returnButton.click();

    await expect(rows(app)).toHaveText(['Buy milk', 'Waiting']);
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Call Mum']);
    await expect.poll(() => apiTexts(api)).toEqual(['Buy milk', 'Waiting']);
    await app.reload();
    await expect(rows(app)).toHaveText(['Buy milk', 'Waiting']);
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Call Mum']);
  });

  test('returns a Task from the keyboard, and returning the last one removes the Matrix', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    const returnButton = placed(app, 'Buy milk').getByRole('button', { name: 'Return to the Task List' });
    await returnButton.focus();
    await expect(returnButton).toHaveCSS('opacity', '1');
    await app.keyboard.press('Enter');
    await expect(rows(app)).toHaveText(['Buy milk']);
    await expect(matrix(app).getByRole('listitem')).toHaveCount(0);
    await expect.poll(() => api.matrix(TODAY)).toBeNull();
  });

  test('offers no mini-list button on a Completed Task', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    await checkbox(app, 'Buy milk').check();
    await expect(placed(app, 'Buy milk').getByRole('button')).toHaveCount(0);
    await checkbox(app, 'Buy milk').uncheck();
    await expect(placed(app, 'Buy milk').getByRole('button', { name: 'Return to the Task List' })).toHaveCount(1);
  });

  test('edits a placed or Completed Task in place, saving with Enter or clicking away, cancelling with Esc', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk', 'Call Mum');
    await checkbox(app, 'Call Mum').check();
    const edit = matrix(app).getByRole('textbox', { name: 'Task text' });

    await placed(app, 'Buy milk').getByText('Buy milk').dblclick();
    await expect(edit).toBeFocused();
    await edit.fill('Buy oat milk');
    await edit.press('Enter');
    await placed(app, 'Call Mum').getByText('Call Mum').dblclick();
    await edit.fill('Call Mum back');
    await app.getByRole('heading', { name: 'Task List' }).click();
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy oat milk', 'Call Mum back']);
    await expect(checkbox(app, 'Call Mum back')).toBeChecked();
    await expect(strike(app, 'Call Mum back')).toHaveCount(1);

    await placed(app, 'Buy oat milk').getByText('Buy oat milk').dblclick();
    await edit.fill('Something else');
    await edit.press('Escape');
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy oat milk', 'Call Mum back']);
    await expect.poll(() => quadrantTexts(api)).toEqual(['Buy oat milk', 'Call Mum back']);
  });

  test('keeps the old text when a placed Task is saved with empty text', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    await placed(app, 'Buy milk').getByText('Buy milk').dblclick();
    const edit = matrix(app).getByRole('textbox', { name: 'Task text' });
    await edit.fill('   ');
    await edit.press('Enter');
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk']);
    await app.reload();
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Buy milk']);
    expect(await quadrantTexts(api)).toEqual(['Buy milk']);
  });

  test('snaps a tick back if the API refuses it', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    let release!: () => void;
    const answered = new Promise<void>((r) => (release = r));
    await app.route('**/api/tasks/*/complete', async (route) => {
      await answered;
      await route.fulfill({ status: 409, json: { reason: 'task_already_completed' } });
    });
    const box = checkbox(app, 'Buy milk');
    await box.check();
    await expect(box).toBeChecked();
    release();
    await expect(box).not.toBeChecked();
  });

  test('shows the strike already drawn when a refused un-tick snaps back, without drawing it on again', async ({ app, api }) => {
    await placeAll(app, api, 'Buy milk');
    const box = checkbox(app, 'Buy milk');
    await box.check();
    await expect.poll(() => completedAt(api, 'Buy milk')).not.toBeNull();
    let release!: () => void;
    const answered = new Promise<void>((r) => (release = r));
    await app.route('**/api/tasks/*/uncomplete', async (route) => {
      await answered;
      await route.fulfill({ status: 409, json: { reason: 'task_not_completed' } });
    });
    await box.uncheck();
    release();
    await expect(box).toBeChecked();
    await expect(strike(app, 'Buy milk')).toHaveCount(1);
    await expect(placed(app, 'Buy milk').locator('.drawing-on, .rubbing-out')).toHaveCount(0);
  });
});

test.describe('dragging into, within and out of the Matrix', () => {
  const TODAY = '2026-09-24';
  const quadrant = (page: Page, name: string) => matrix(page).getByRole('region', { name, exact: true });
  const placed = (page: Page, text: string) => matrix(page).getByRole('listitem').filter({ hasText: text });
  const quadrantRows = (page: Page, name: string) => quadrant(page, name).getByRole('listitem');
  const apiQuadrant = async (api: Api, q: Quadrant) => (await api.matrix(TODAY))?.quadrants[q].map((t) => t.text);

  /** Writes Tasks and places them, in order, in Important + Urgent, then opens the app afresh. */
  async function placeAll(app: Page, api: Api, ...texts: string[]) {
    for (const id of await api.write(...texts)) await api.place(id, TODAY, 'important-urgent');
    await app.reload();
  }

  test('drags a Task from the Task List into a Quadrant, landing at the drop line', async ({ app, api }) => {
    await api.write('Waiting');
    await placeAll(app, api, 'a', 'b');
    await drag(app, row(app, 'Waiting'), placed(app, 'b'), 'above');
    const line = quadrant(app, 'Important + Urgent').locator('.drop-line');
    await expect(line).toBeVisible();
    await expect(app.locator('.floating-card')).toHaveText('Waiting');
    await app.mouse.up();
    await expect(line).toHaveCount(0);
    await expect(rows(app)).toHaveCount(0);
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['a', 'Waiting', 'b']);
    await expect.poll(() => apiQuadrant(api, 'important-urgent')).toEqual(['a', 'Waiting', 'b']);
  });

  test('drags a Task into an empty Quadrant, making the first Placement', async ({ app, api }) => {
    await api.write('Buy milk');
    await app.reload();
    await drag(app, row(app, 'Buy milk'), quadrant(app, 'Not Important + Urgent'), 'into');
    await app.mouse.up();
    await expect(quadrantRows(app, 'Not Important + Urgent')).toHaveText(['Buy milk']);
    await expect.poll(() => apiQuadrant(api, 'not-important-urgent')).toEqual(['Buy milk']);
  });

  test('drags a placed Task within its Quadrant and into another, Completed ones too', async ({ app, api }) => {
    await placeAll(app, api, 'a', 'b', 'c');
    await drag(app, placed(app, 'c'), placed(app, 'a'), 'above');
    await app.mouse.up();
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['c', 'a', 'b']);
    await expect.poll(() => apiQuadrant(api, 'important-urgent')).toEqual(['c', 'a', 'b']);

    await matrix(app).getByRole('checkbox', { name: 'a', exact: true }).check();
    await drag(app, placed(app, 'a'), quadrant(app, 'Important + Not Urgent'), 'into');
    await app.mouse.up();
    await drag(app, placed(app, 'b'), placed(app, 'a'), 'above');
    await app.mouse.up();
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['c']);
    await expect(quadrantRows(app, 'Important + Not Urgent')).toHaveText(['b', 'a']);
    await expect.poll(() => apiQuadrant(api, 'important-not-urgent')).toEqual(['b', 'a']);
    expect((await api.matrix(TODAY))!.quadrants['important-not-urgent'][1]!.completedAt).not.toBeNull();
    await app.reload();
    await expect(quadrantRows(app, 'Important + Not Urgent')).toHaveText(['b', 'a']);
  });

  test('drags an unfinished Task back to the Task List, landing at the drop line', async ({ app, api }) => {
    await api.write('x', 'y');
    await placeAll(app, api, 'Buy milk', 'Call Mum');
    await expect(rows(app)).toHaveText(['y', 'x']);
    await drag(app, placed(app, 'Buy milk'), row(app, 'x'), 'above');
    await expect(taskList(app).locator('.drop-line')).toBeVisible();
    await app.mouse.up();
    await expect(rows(app)).toHaveText(['y', 'Buy milk', 'x']);
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['Call Mum']);
    await expect.poll(() => apiTexts(api)).toEqual(['y', 'Buy milk', 'x']);
  });

  test('does not offer the Task List to a Completed Task, which snaps back', async ({ app, api }) => {
    await api.write('x');
    await placeAll(app, api, 'Buy milk');
    await matrix(app).getByRole('checkbox', { name: 'Buy milk', exact: true }).check();
    await drag(app, placed(app, 'Buy milk'), row(app, 'x'), 'above');
    await expect(app.locator('.floating-card')).toHaveText('Buy milk');
    await expect(taskList(app).locator('.drop-line')).toHaveCount(0);
    await app.mouse.up();
    await expect(rows(app)).toHaveText(['x']);
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['Buy milk']);
    expect(await apiTexts(api)).toEqual(['x']);
  });

  test('snaps a dragged Task back if the API refuses it', async ({ app, api }) => {
    await placeAll(app, api, 'a', 'b');
    await app.route('**/api/tasks/*/move', (route) => route.fulfill({ status: 409, json: { reason: 'task_in_another_matrix' } }));
    await drag(app, placed(app, 'b'), placed(app, 'a'), 'above');
    const sent = app.waitForRequest('**/api/tasks/*/move');
    await app.mouse.up();
    await sent;
    await expect(quadrantRows(app, 'Important + Urgent')).toHaveText(['a', 'b']);
  });

  test('does not start a drag from the checkbox', async ({ app, api }) => {
    await placeAll(app, api, 'a', 'b');
    const box = (await placed(app, 'b').locator('.checkbox').boundingBox())!;
    await app.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await app.mouse.down();
    await app.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 5 });
    await expect(app.locator('.floating-card')).toHaveCount(0);
    await app.mouse.up();
  });
});
