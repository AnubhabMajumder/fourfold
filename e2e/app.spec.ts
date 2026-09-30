import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const taskList = (page: Page) => page.getByRole('complementary', { name: 'Task List' });
const rows = (page: Page) => taskList(page).getByRole('listitem');
const input = (page: Page) => page.getByRole('textbox', { name: 'New Task' });

async function write(page: Page, ...texts: string[]) {
  for (const text of texts) {
    await input(page).fill(text);
    await input(page).press('Enter');
  }
}

test.describe('first launch', () => {
  test('shows an empty Task List, with nothing in it, and the input focused', async ({ app }) => {
    await expect(input(app)).toBeFocused();
    await expect(input(app)).toHaveAttribute('placeholder', 'Write a Task…');
    await expect(rows(app)).toHaveCount(0);
    await expect(taskList(app).getByRole('checkbox')).toHaveCount(0);
    await expect(taskList(app)).toHaveText(/^Task List\s*add$/);
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
