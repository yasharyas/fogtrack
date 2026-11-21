import { test, expect } from '@playwright/test';
import { openGame, openBoard, playSession, toInitials, waitState } from './helpers';

test('full loop: play, initials ABC, board shows it, idle reset', async ({ context }) => {
  const errs: string[] = [];
  const game = await openGame(context, errs);
  await expect(game.getByTestId('screen-attract')).toBeVisible();
  await playSession(game);
  await expect(game.getByTestId('screen-score')).toBeVisible();
  const total = Number((await game.getByTestId('total').innerText()).replace(/\D/g, ''));
  expect(total).toBeGreaterThanOrEqual(0);
  expect(total).toBeLessThanOrEqual(8000);

  await toInitials(game);
  await expect(game.getByTestId('screen-initials')).toBeVisible();
  for (const k of 'ABC') await game.getByTestId(`key-${k}`).click();
  await game.getByTestId('initials-done').click();

  const board = await openBoard(context, errs);
  await expect(board.locator('body')).toContainText('ABC', { timeout: 10_000 });

  await waitState(game, 'attract', 40_000);
  await expect(game.getByTestId('screen-attract')).toBeVisible();
  await game.getByTestId('start').click();
  await waitState(game, 'countdown', 5_000);
  expect(errs).toEqual([]);
});

test('skip initials path returns to attract, board has no new entry', async ({ context }) => {
  const errs: string[] = [];
  const board = await openBoard(context, errs);
  const game = await openGame(context, errs);
  await playSession(game);
  await toInitials(game);
  await game.getByTestId('initials-skip').click();
  await waitState(game, 'attract', 40_000);
  await board.reload();
  await expect(board.locator('body')).not.toContainText('ABC');
  expect(errs).toEqual([]);
});
