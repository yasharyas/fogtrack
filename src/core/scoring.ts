import type { Pin, Round, RoundScore, SessionResult, Vec } from '../shared/types';
import { positionAt } from './rounds';

const SCALE = 0.35;
const VEL_WINDOW_MS = 200;
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Brute-force best assignment of pins to dots (<=2 each). Returns pin index per dot, -1 = missing (error 1). */
function match(truth: Vec[], pins: Pin[]): number[] {
  let best = Infinity;
  let bestAssign: number[] = truth.map(() => -1);
  const go = (i: number, used: number, cost: number, cur: number[]) => {
    if (cost >= best) return;
    if (i === truth.length) {
      best = cost;
      bestAssign = cur;
      return;
    }
    for (let j = 0; j < pins.length; j++) {
      if (used & (1 << j)) continue;
      go(i + 1, used | (1 << j), cost + Math.min(1, dist(truth[i], pins[j])), [...cur, j]);
    }
    go(i + 1, used, cost + 1, [...cur, -1]);
  };
  go(0, 0, 0, []);
  return bestAssign;
}

export function scoreRound(round: Round, pins: Pin[]): RoundScore {
  const T = round.showMs + round.jumpMs;
  const used = pins.slice(0, round.paths.length);
  const truth = round.paths.map((p) => positionAt(p, T));
  const assign = match(truth, used);
  const errors = truth.map((t, i) => (assign[i] < 0 ? 1 : Math.min(1, dist(t, used[assign[i]]))));
  const track = mean(errors.map((e) => Math.max(0, 1 - e / SCALE)));
  const reads = round.paths.map((path, i) => {
    const now = positionAt(path, round.showMs);
    const before = positionAt(path, round.showMs - VEL_WINDOW_MS);
    const k = round.jumpMs / VEL_WINDOW_MS;
    const naive = { x: now.x + (now.x - before.x) * k, y: now.y + (now.y - before.y) * k };
    // 1 when the pin is at least as close as the naive guess, else fades to 0
    return Math.max(0, Math.min(1, 1 - (errors[i] - dist(naive, truth[i])) / SCALE));
  });
  const read = mean(reads);
  return { index: round.index, points: Math.round(1000 * (0.75 * track + 0.25 * read)), track, read, errors };
}

export function scoreSession(rounds: RoundScore[]): SessionResult {
  return {
    total: rounds.reduce((s, r) => s + r.points, 0),
    track: mean(rounds.map((r) => r.track)),
    read: mean(rounds.map((r) => r.read)),
    rounds,
  };
}
