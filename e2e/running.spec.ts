// Running Fourfold day to day: what the app does when the API goes away and comes back, keeping windows in step,
// and being installable.
import type { Page } from '@playwright/test';
import { BASE_URL, at, expect, test } from './fixtures.ts';

const taskList = (page: Page) => page.getByRole('complementary', { name: 'Task List' });
const rows = (page: Page) => taskList(page).getByRole('listitem');
const input = (page: Page) => page.getByRole('textbox', { name: 'New Task' });
const card = (page: Page) => page.getByRole('alertdialog', { name: 'Fourfold isn’t running' });
const quadrant = (page: Page, name: string) => page.getByRole('region', { name: /^Matrix for / }).getByRole('region', { name, exact: true });

async function write(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press('Enter');
}

/** What the window does when the user switches back to it. */
const refocus = (page: Page) => page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')));

/** The times, in ms, at which the page asks the API for the Task List from now on. */
function taskListFetches(page: Page) {
  const times: number[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/task-list') times.push(Date.now());
  });
  return times;
}

test.describe('when Fourfold isn’t running', () => {
  test('snaps a change back and covers the dimmed page with the card, as worded', async ({ app, api, server }) => {
    await api.write('Buy milk');
    await app.reload();
    await expect(rows(app)).toHaveText(['Buy milk']);

    await server.stop();
    await write(app, 'Call Mum');
    await expect(card(app)).toBeVisible();
    await expect(card(app)).toHaveText(['Fourfold isn’t running', 'Start it with the Start Fourfold shortcut.', 'This page will catch up by itself.'].join(''));
    await expect(rows(app)).toHaveText(['Buy milk']);
  });

  test('can’t be dismissed, and the page behind takes no changes', async ({ app, api, server }) => {
    await api.write('Buy milk');
    await app.reload();
    await server.stop();
    await write(app, 'Call Mum');
    await expect(card(app)).toBeVisible();

    await app.keyboard.press('Escape');
    await app.mouse.click(5, 5);
    await expect(card(app)).toBeVisible();
    // Neither the pointer nor the keyboard reaches the page behind.
    await expect(input(app).click({ timeout: 1000 })).rejects.toThrow();
    await app.keyboard.type('Pay rent');
    await app.keyboard.press('Enter');
    await expect(input(app)).not.toBeFocused();

    await server.run();
    await expect(card(app)).toBeHidden({ timeout: 10_000 });
    await expect(rows(app)).toHaveText(['Buy milk']);
    expect((await api.taskList()).map((t) => t.text)).toEqual(['Buy milk']);
  });

  test('checks every 3 s, and once the API answers re-fetches everything and goes, with no message', async ({ app, api, server }) => {
    await server.stop();
    await write(app, 'Call Mum');
    await expect(card(app)).toBeVisible();
    const fetches = taskListFetches(app);
    await expect.poll(() => fetches.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    const gap = fetches[1]! - fetches[0]!;
    expect(gap).toBeGreaterThan(2_700);
    expect(gap).toBeLessThan(4_000);

    await server.run();
    const [id] = await api.write('Written while the card was up', 'Pay rent');
    await api.place(id!, '2026-09-24', 'important-urgent');
    await expect(card(app)).toBeHidden({ timeout: 5_000 });
    await expect(rows(app)).toHaveText(['Pay rent']);
    await expect(quadrant(app, 'Important + Urgent').getByRole('listitem')).toHaveText(['Written while the card was up']);
    await expect(app.getByRole('status')).toHaveCount(0);
    await expect(app.getByRole('alert')).toHaveCount(0);
  });

  test('keeps checking if the API at first answers with an error', async ({ app, server }) => {
    await server.stop();
    await write(app, 'Call Mum');
    await expect(card(app)).toBeVisible();
    await app.route('**/api/task-list', (route) => route.fulfill({ status: 500, body: 'starting up' }), { times: 1 });
    await server.run();
    await expect(card(app)).toBeHidden({ timeout: 10_000 });
  });

  test('stops checking once a re-fetch on focus finds the API back', async ({ app }) => {
    await app.route('**/api/task-list', (route) => route.abort(), { times: 1 });
    await refocus(app);
    await expect(card(app)).toBeVisible();
    await refocus(app);
    await expect(card(app)).toBeHidden();
    const fetches = taskListFetches(app);
    await app.waitForTimeout(4_000);
    expect(fetches).toEqual([]);
  });

  test('never shows for a refusal', async ({ app }) => {
    await app.route('**/api/tasks', (route) => route.fulfill({ status: 409, json: { reason: 'empty_text' } }));
    await write(app, 'Buy milk');
    await expect(rows(app)).toHaveCount(0);
    await expect(card(app)).toHaveCount(0);
  });

  test('asks the API nothing while it’s running and nothing is happening', async ({ app }) => {
    await expect(rows(app)).toHaveCount(0);
    const fetches = taskListFetches(app);
    await app.waitForTimeout(4_000);
    expect(fetches).toEqual([]);
  });
});

test.describe('switching back to the window, before 6am', () => {
  test.use({ startAt: at('2026-09-24', '05:00') });

  test('re-fetches the dates that have a Matrix, so ‹ reaches one made in another window', async ({ app, api }) => {
    const [id] = await api.write('Placed in another window');
    await api.place(id!, '2026-09-23', 'important-urgent');
    await refocus(app);
    await expect(rows(app)).toHaveCount(0);
    await app.getByRole('button', { name: 'Previous date' }).click();
    await expect(app.getByRole('region', { name: /^Matrix for / })).toHaveAccessibleName('Matrix for Wednesday, 23 September');
  });
});

test.describe('switching back to the window', () => {
  test('re-fetches the Task List and the Matrix on screen', async ({ app, api }) => {
    const [placed] = await api.write('Placed in another window', 'Written in another window');
    await api.place(placed!, '2026-09-24', 'not-important-urgent');
    await expect(rows(app)).toHaveCount(0);

    await refocus(app);
    await expect(rows(app)).toHaveText(['Written in another window']);
    await expect(quadrant(app, 'Not Important + Urgent').getByRole('listitem')).toHaveText(['Placed in another window']);
  });

  test('shows the card if the re-fetch fails', async ({ app, server }) => {
    await server.stop();
    await refocus(app);
    await expect(card(app)).toBeVisible();
    await server.run();
    await expect(card(app)).toBeHidden({ timeout: 5_000 });
  });
});

test.describe('installing', () => {
  test('offers a web app manifest with icons', async ({ app }) => {
    const href = await app.locator('link[rel="manifest"]').getAttribute('href');
    const res = await fetch(new URL(href!, BASE_URL));
    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    const manifest = (await res.json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string }[] };
    expect(manifest).toMatchObject({ name: 'Fourfold', start_url: '/', display: 'standalone' });
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) expect((await fetch(new URL(icon.src, BASE_URL))).ok).toBe(true);

    // Chrome itself reads the manifest without complaint.
    const cdp = await app.context().newCDPSession(app);
    const { url, errors } = await cdp.send('Page.getAppManifest');
    expect(url).toBe(`${BASE_URL}/manifest.webmanifest`);
    expect(errors).toEqual([]);
  });

  test('registers no service worker', async ({ app }) => {
    await app.waitForLoadState('load');
    expect(await app.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  });
});
