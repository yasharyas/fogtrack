import { expect, type Page, type BrowserContext } from '@playwright/test';

export function watchErrors(page: Page, sink: string[]) {
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) sink.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !((globalThis as any).process?.env?.IGNORE_FONT_404 && r.url().includes('/fonts/'))) sink.push('http ' + r.status() + ' ' + r.url()); });
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
}

export const state = (page: Page): Promise<string> => page.evaluate(() => (window as any).__fog.state());

export async function waitState(page: Page, s: string, timeout = 30_000) {
  await expect.poll(() => state(page), { timeout, intervals: [50] }).toBe(s);
}

/** Play one round: wait for answer state, tap spots until it leaves 'pin'. */
export async function playRound(page: Page) {
  await waitState(page, 'pin');
  const box = (await page.getByTestId('field').boundingBox())!;
  const spots = [[0.3, 0.4], [0.65, 0.55], [0.5, 0.3], [0.4, 0.7]];
  for (let i = 0; i < 4; i++) {
    if ((await state(page)) !== 'pin') break;
    const [fx, fy] = spots[i];
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(80);
  }
}

export async function playSession(page: Page) {
  await page.getByTestId('start').click();
  for (let r = 0; r < 8; r++) {
    await playRound(page);
    await expect.poll(async () => (await state(page)) !== 'pin', { timeout: 20_000 }).toBe(true);
  }
  await waitState(page, 'score', 40_000);
}

/** From the score screen, reach the initials screen (auto-advance, else Enter). */
export async function toInitials(page: Page) {
  await waitState(page, 'score');
  await page.getByTestId('continue').click({ timeout: 3_000 }).catch(() => {});
  await waitState(page, 'initials', 15_000);
}

export async function openGame(ctx: BrowserContext, errs: string[], query = '?seed=20261121&fast=1') {
  const page = await ctx.newPage();
  watchErrors(page, errs);
  await page.goto('/' + query);
  await waitState(page, 'attract');
  return page;
}

export async function openBoard(ctx: BrowserContext, errs: string[]) {
  const page = await ctx.newPage();
  watchErrors(page, errs);
  await page.goto('/board.html');
  return page;
}
