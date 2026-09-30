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
