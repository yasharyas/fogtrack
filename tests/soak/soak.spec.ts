import { test, expect } from '@playwright/test';
import { watchErrors, waitState, playSession } from '../e2e/helpers';

// Run with: SOAK=1 npx playwright test tests/soak
test('soak: 150 sessions @soak', async ({ page }) => {
  test.setTimeout(3_600_000);
  const errs: string[] = [];
  watchErrors(page, errs);
  await page.goto('/?seed=20261121&fast=1');
  await waitState(page, 'attract');
  const heap = () => page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
  const client = await page.context().newCDPSession(page);
  const gc = () => client.send('HeapProfiler.collectGarbage').catch(() => {});
  let base: number | null = null;
  for (let i = 0; i < 150; i++) {
    await playSession(page);
    // fast mode idles quickly: skip from initials if still there, else the idle reset is fine
    await waitState(page, 'score');
    await page.getByTestId('continue').click({ timeout: 3_000 }).catch(() => {});
    await page.getByTestId('initials-skip').click({ timeout: 3_000 }).catch(() => {});
    await waitState(page, 'attract', 40_000);
    if (i === 9) { await gc(); base = await heap(); }
  }
  await gc();
  const end = await heap();
  if (base && end) expect(end).toBeLessThan(base * 2);
  expect(errs).toEqual([]);
});
