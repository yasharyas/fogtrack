import { ROUNDS } from '../shared/types';
import type { Path, Round, RoundKind, Vec } from '../shared/types';
import { makeRng } from './rng';

export const LO = 0.08;
export const HI = 0.92;
export const SHOW_MS = 2500;
export const KINDS: RoundKind[] = [
  'runner', 'turner', 'stopper', 'runner', 'pair', 'turner', 'doubleback', 'pair',
];

const clamp = (v: number) => Math.min(HI, Math.max(LO, v));
const inB = (p: Vec) => p.x >= LO && p.x <= HI && p.y >= LO && p.y <= HI;

/** Linear interpolation along waypoints; clamps before first and after last. */
export function positionAt(path: Path, tMs: number): Vec {
  if (path.length === 0) return { x: 0.5, y: 0.5 };
  if (tMs <= path[0].t) return { ...path[0].p };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (tMs <= b.t) {
      const k = b.t === a.t ? 1 : (tMs - a.t) / (b.t - a.t);
      return { x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k };
    }
  }
  return { ...path[path.length - 1].p };
}

/** Leg: heading (rad), duration (ms), speed multiplier. */
type Leg = [number, number, number];

function walk(s: Vec, speed: number, legs: Leg[]): Path {
  let t = 0;
  let p = s;
  const path: Path = [{ t, p }];
  for (const [a, ms, m] of legs) {
    t += ms;
    const d = speed * m * (ms / 1000);
    p = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
    path.push({ t, p });
  }
  return path;
}

// Rejection sampling: random start and heading until the whole path fits in bounds.
function place(rng: () => number, speed: number, mk: (a: number, s: Vec) => Leg[] | null): Path {
  let path: Path = [];
  for (let i = 0; i < 500; i++) {
    const s = { x: LO + rng() * (HI - LO), y: LO + rng() * (HI - LO) };
    const legs = mk(rng() * 2 * Math.PI, s);
    if (!legs) continue;
    path = walk(s, speed, legs);
    if (path.every((w) => inB(w.p))) return path;
  }
  // ponytail: fallback clamp bends the path; not reached in practice at these speeds
  return path.map((w) => ({ t: w.t, p: { x: clamp(w.p.x), y: clamp(w.p.y) } }));
}

export function generateSession(seed: number): Round[] {
  const rng = makeRng(seed);
  return Array.from({ length: ROUNDS }, (_, i) => {
    const d = i / (ROUNDS - 1);
    const kind = KINDS[i];
    const jumpMs = Math.round(1500 + 1500 * d);
    const T = SHOW_MS + jumpMs;
    const speed = 0.07 + 0.07 * d; // field units per second
    // event time (after the fog drops); the event point is always a visible mark
    const tEv = SHOW_MS + jumpMs * (0.2 + 0.2 * rng());
    const run = (): Path => place(rng, speed, (a) => [[a, T, 1]]);
    let paths: Path[];
    let marks: Vec[] = [];
    if (kind === 'runner') paths = [run()];
    else if (kind === 'turner') {
      // turn exactly at the mark, 90 deg, away from the nearest wall edge (toward more room)
      paths = [place(rng, speed, (a, s) => {
        const k = (speed * tEv) / 1000;
        const m = { x: s.x + Math.cos(a) * k, y: s.y + Math.sin(a) * k };
        const e = [m.x, 1 - m.x, m.y, 1 - m.y];
        const w = e.indexOf(Math.min(...e));
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][w]; // points away from that wall
        const dot = -Math.sin(a) * n[0] + Math.cos(a) * n[1]; // component of a +90 turn along n
        if (Math.abs(dot) < 0.3) return null; // ambiguous, resample
        return [[a, tEv, 1], [a + Math.sign(dot) * (Math.PI / 2), T - tEv, 1]];
      })];
      marks = [paths[0][1].p];
    } else if (kind === 'stopper') {
      paths = [place(rng, speed, (a) => [[a, tEv, 1], [a, T - tEv, 0]])];
      marks = [paths[0][1].p];
    } else if (kind === 'doubleback') {
      paths = [place(rng, speed, (a) => [[a, tEv, 1], [a + Math.PI, T - tEv, 1]])];
      marks = [paths[0][1].p];
    } else {
      const a = run();
      let b = run();
      const end = (p: Path) => p[p.length - 1].p;
      const far = (u: Vec, v: Vec) => Math.hypot(u.x - v.x, u.y - v.y) > 0.2;
      for (let k = 0; k < 50 && !(far(a[0].p, b[0].p) && far(end(a), end(b))); k++) b = run();
      paths = [a, b];
    }
    return { index: i, kind, paths, showMs: SHOW_MS, jumpMs, marks };
  });
}
