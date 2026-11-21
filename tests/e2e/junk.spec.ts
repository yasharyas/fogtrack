import { test, expect } from '@playwright/test';
import { openGame, openBoard, waitState } from './helpers';

const JUNK_STORE = [
  'not json', '{}', '[1,2,3]', 'null',
  '[{"initials":"<img src=x onerror=alert(1)>","total":"x"}]',
  '[{"id":"a","initials":"abc","total":99999,"track":2,"read":-1,"seed":1,"at":1}]',
  '[{"id":"a","initials":"ZZZZ","total":10,"track":0,"read":0,"seed":1,"at":1}]',
];
const JUNK_MSGS: unknown[] = [
  null, 42, 'str', [], {}, { type: 'score' }, { type: 'score', entry: null },
  { type: 'score', entry: { initials: '<b>x</b>', total: 'NaN' } },
  { type: 'playing', round: 'x' }, { type: 'playing', round: 1e9 }, { type: '__proto__' },
  { type: 'idle', extra: { a: 1 } },
];

test('junk in localStorage does not break game or board', async ({ browser }) => {
  const errs: string[] = [];
  for (const junk of JUNK_STORE) {
    const context = await browser.newContext();
    await context.addInitScript((j) => { try { localStorage.setItem('fogtrack.v1.scores', j); } catch { /* ignore */ } }, junk);
    const game = await openGame(context, errs);
    const board = await openBoard(context, errs);
    await expect(board.locator('body')).toBeVisible();
    await expect(board.locator('body')).not.toContainText('ZZZZ');
    expect(await board.locator('img[src="x"]').count()).toBe(0);
    await context.close();
  }
  expect(errs).toEqual([]);
});

test('junk BroadcastChannel messages do not break either page', async ({ context }) => {
  const errs: string[] = [];
  const game = await openGame(context, errs);
  const board = await openBoard(context, errs);
  const sender = await context.newPage();
  await sender.goto('/board.html');
  await sender.evaluate((msgs) => {
    const ch = new BroadcastChannel('fogtrack');
    for (const m of msgs) ch.postMessage(m);
    ch.close();
  }, JUNK_MSGS);
  await sender.waitForTimeout(500);
  await expect(board.locator('body')).toBeVisible();
  await expect(board.locator('body')).not.toContainText('<b>');
  expect(await board.locator('b').count()).toBe(0);
  await waitState(game, 'attract');
  await game.getByTestId('start').click();
  await waitState(game, 'countdown', 5_000);
  expect(errs).toEqual([]);
});
