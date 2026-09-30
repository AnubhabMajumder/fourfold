import type { Page } from '@playwright/test';
import { BASE_URL, expect, test } from './fixtures.ts';

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

/** Presses on a Task and drags it with the mouse to just above or below another, leaving the button down. */
async function dragOver(page: Page, text: string, target: string, where: 'above' | 'below') {
  const from = (await row(page, text).boundingBox())!;
  const to = (await row(page, target).boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + from.height / 2 + 6, { steps: 3 });
  await page.mouse.move(to.x + 30, where === 'above' ? to.y + 3 : to.y + to.height - 3, { steps: 6 });
}

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

  test('snaps a dragged Task back when dropped outside the Task List or with Esc', async ({ app, api }) => {
    await api.write('a', 'b');
    await app.reload();
    await dragOver(app, 'a', 'b', 'above');
    const box = (await matrix(app).boundingBox())!;
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
