import type { Page } from '@playwright/test';
import { expect, test, type apiClient } from './fixtures.ts';

type Api = ReturnType<typeof apiClient>;

const TODAY = '2026-09-24';
const matrix = (page: Page) => page.getByRole('region', { name: /^Matrix for / });
const gear = (page: Page) => matrix(page).getByRole('button', { name: 'Settings' });
const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const scheme = (page: Page, name: string) => settings(page).getByRole('group', { name: 'Colours' }).getByRole('radio', { name, exact: true });
const strikeStyle = (page: Page, name: string) => settings(page).getByRole('group', { name: 'Strike' }).getByRole('radio', { name, exact: true });
const placed = (page: Page, text: string) => matrix(page).getByRole('listitem').filter({ hasText: text });
const checkbox = (page: Page, text: string) => matrix(page).getByRole('checkbox', { name: text, exact: true });
/** The strike's ink, one group per line of text, drawn in the given style. */
const strike = (page: Page, text: string, style: 'zigzag' | 'rough-line') => placed(page, text).locator(`.strike > svg.${style}[aria-hidden="true"] > g`);
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Writes a Task, places it in Important + Urgent, and opens the app afresh. */
async function place(app: Page, api: Api, text: string) {
  const [id] = await api.write(text);
  await api.place(id!, TODAY, 'important-urgent');
  await app.reload();
}

test.describe('the settings gear', () => {
  test("is a keyboard-reachable button in the Matrix's bottom-right corner that opens a sketched pop-over", async ({ app }) => {
    await expect(settings(app)).toBeHidden();
    const box = (await gear(app).boundingBox())!;
    const m = (await matrix(app).boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(m.x + m.width - 60);
    expect(box.y + box.height).toBeGreaterThan(m.y + m.height - 60);
    await expect(gear(app).locator('svg[aria-hidden="true"] path').first()).toBeAttached();

    await gear(app).focus();
    await expect(gear(app)).toHaveCSS('outline', 'rgb(28, 28, 28) solid 2px');
    await app.keyboard.press('Enter');
    await expect(settings(app)).toBeVisible();
    await expect(settings(app).locator('svg[aria-hidden="true"] path').first()).toBeAttached();
    await expect(settings(app).getByRole('radio')).toHaveCount(8);

    // The keyboard reaches the choices, and Esc closes the pop-over.
    await app.keyboard.press('Tab');
    await expect(scheme(app, 'plain')).toBeFocused();
    await app.keyboard.press('Escape');
    await expect(settings(app)).toBeHidden();
  });

  test('offers six colour schemes, plain by default, and the zigzag strike by default', async ({ app }) => {
    await gear(app).click();
    const names = ['plain', 'ivory & navy', 'ivory & black', 'chalkboard', 'noir & cobalt strike', 'noir & steel lines'];
    for (const name of names) await expect(scheme(app, name)).toBeVisible();
    await expect(scheme(app, 'plain')).toBeChecked();
    await expect(strikeStyle(app, 'zigzag')).toBeChecked();
    await expect(strikeStyle(app, 'rough line')).not.toBeChecked();
    expect(await background(app)).toBe('rgb(250, 250, 249)');
  });

  test('closes when the user clicks elsewhere', async ({ app }) => {
    await gear(app).click();
    await expect(settings(app)).toBeVisible();
    await app.getByRole('heading', { name: 'Task List' }).click();
    await expect(settings(app)).toBeHidden();
  });

  test('remembers the colour scheme across reloads, with the strike and tick in its strike colour', async ({ app, api }) => {
    await place(app, api, 'Buy milk');
    await gear(app).click();
    await scheme(app, 'chalkboard').check();
    expect(await background(app)).toBe('rgb(35, 43, 42)');

    await app.reload();
    expect(await background(app)).toBe('rgb(35, 43, 42)');
    await checkbox(app, 'Buy milk').check();
    const chalk = 'rgb(244, 241, 226)';
    await expect(placed(app, 'Buy milk').locator('.strike > svg')).toHaveCSS('color', chalk);
    await expect(placed(app, 'Buy milk').locator('.tick')).toHaveCSS('color', chalk);
    // Completed text keeps full ink.
    await expect(placed(app, 'Buy milk').locator('.strike > span')).toHaveCSS('color', 'rgb(236, 238, 230)');

    await gear(app).click();
    await expect(scheme(app, 'chalkboard')).toBeChecked();
    await scheme(app, 'noir & steel lines').check();
    await app.reload();
    expect(await background(app)).toBe('rgb(18, 18, 18)');
    await expect(placed(app, 'Buy milk').locator('.strike > svg')).toHaveCSS('color', 'rgb(159, 179, 204)');
  });

  test('remembers the strike style across reloads, striking each line with a rough pencil line', async ({ app, api }) => {
    await place(app, api, 'Buy milk');
    await gear(app).click();
    await strikeStyle(app, 'rough line').check();
    await app.keyboard.press('Escape');

    await checkbox(app, 'Buy milk').check();
    await expect(strike(app, 'Buy milk', 'rough-line')).toHaveCount(1);
    // Wiped on, only when the user completes the Task.
    await expect(placed(app, 'Buy milk').locator('.wiping-on')).toHaveCount(1);
    await expect(strike(app, 'Buy milk', 'zigzag')).toHaveCount(0);

    await app.reload();
    await expect(strike(app, 'Buy milk', 'rough-line')).toHaveCount(1);
    await expect(placed(app, 'Buy milk').locator('.wiping-on')).toHaveCount(0);
    await gear(app).click();
    await expect(strikeStyle(app, 'rough line')).toBeChecked();

    await strikeStyle(app, 'zigzag').check();
    await expect(strike(app, 'Buy milk', 'zigzag')).toHaveCount(1);
    await app.reload();
    await expect(strike(app, 'Buy milk', 'zigzag')).toHaveCount(1);
  });

  test('strikes each line of a long Task with the rough line', async ({ app, api }) => {
    const long = 'Write the long letter to the council about the hedge, the bins, and the parking on the corner of the street';
    await place(app, api, long);
    await gear(app).click();
    await strikeStyle(app, 'rough line').check();
    await app.keyboard.press('Escape');
    await checkbox(app, long).check();
    const lines = await placed(app, long)
      .locator('.strike > span')
      .evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
      });
    expect(lines).toBeGreaterThan(1);
    await expect(strike(app, long, 'rough-line')).toHaveCount(lines);
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('shows the rough line already drawn, and removes it at once', async ({ app, api }) => {
      await place(app, api, 'Buy milk');
      await gear(app).click();
      await strikeStyle(app, 'rough line').check();
      await app.keyboard.press('Escape');
      await checkbox(app, 'Buy milk').check();
      await expect(strike(app, 'Buy milk', 'rough-line')).toHaveCount(1);
      await expect(placed(app, 'Buy milk').locator('.wiping-on')).toHaveCount(0);
      expect(await app.evaluate(() => document.getAnimations().length)).toBe(0);
      await checkbox(app, 'Buy milk').uncheck();
      expect(await placed(app, 'Buy milk').locator('.strike > svg').count()).toBe(0);
    });
  });
});
