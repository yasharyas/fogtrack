import { describe, expect, it } from 'vitest';
import { ROUNDS } from '../../src/shared/types';
import type { Round, Vec } from '../../src/shared/types';
import { dailySeed, makeRng } from '../../src/core/rng';
import { HI, KINDS, LO, generateSession, positionAt } from '../../src/core/rounds';
import { scoreRound, scoreSession } from '../../src/core/scoring';

const truth = (r: Round): Vec[] => r.paths.map((p) => positionAt(p, r.showMs + r.jumpMs));
const off = (v: Vec, dx: number): Vec => ({ x: v.x + dx, y: v.y });

describe('rng', () => {
  it('is deterministic and in [0,1)', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
  it('dailySeed is local YYYYMMDD', () => {
    expect(dailySeed(new Date(2026, 0, 5))).toBe(20260105);
    expect(dailySeed(new Date(2026, 11, 31))).toBe(20261231);
  });
});

describe('positionAt', () => {
  const path = [
    { t: 0, p: { x: 0.2, y: 0.2 } },
    { t: 1000, p: { x: 0.6, y: 0.4 } },
    { t: 2000, p: { x: 0.6, y: 0.8 } },
  ];
  it('interpolates', () => {
    const m = positionAt(path, 500);
    expect(m.x).toBeCloseTo(0.4, 9);
    expect(m.y).toBeCloseTo(0.3, 9);
    expect(positionAt(path, 1500).y).toBeCloseTo(0.6, 9);
  });
  it('clamps before and after', () => {
    expect(positionAt(path, -50)).toEqual({ x: 0.2, y: 0.2 });
    expect(positionAt(path, 9999)).toEqual({ x: 0.6, y: 0.8 });
  });
});

describe('generateSession', () => {
  it('is deterministic and varies by seed', () => {
    expect(generateSession(20260101)).toEqual(generateSession(20260101));
    expect(generateSession(1)).not.toEqual(generateSession(2));
  });
  it('has the right shape and difficulty ramp', () => {
    const s = generateSession(7);
    expect(s).toHaveLength(ROUNDS);
    expect(s.map((r) => r.kind)).toEqual(KINDS);
    s.forEach((r, i) => {
      expect(r.index).toBe(i);
      expect(r.showMs).toBe(2500);
      expect(r.paths).toHaveLength(r.kind === 'pair' ? 2 : 1);
      if (i) expect(r.jumpMs).toBeGreaterThanOrEqual(s[i - 1].jumpMs);
      r.paths.forEach((p) => expect(p[p.length - 1].t).toBe(r.showMs + r.jumpMs));
    });
    expect(s[0].jumpMs).toBe(1500);
    expect(s[7].jumpMs).toBe(3000);
  });
  it('keeps every sampled position in bounds for 50 seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const r of generateSession(seed * 7919)) {
        for (const p of r.paths) {
          for (let t = 0; t <= r.showMs + r.jumpMs; t += 100) {
            const v = positionAt(p, t);
            expect(v.x).toBeGreaterThanOrEqual(LO - 1e-9);
            expect(v.x).toBeLessThanOrEqual(HI + 1e-9);
            expect(v.y).toBeGreaterThanOrEqual(LO - 1e-9);
            expect(v.y).toBeLessThanOrEqual(HI + 1e-9);
          }
        }
      }
    }
  });
  it('kind behaviours hold for 50 seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const r of generateSession(seed)) {
        const p = r.paths[0];
        const dir = (i: number) => ({ x: p[i + 1].p.x - p[i].p.x, y: p[i + 1].p.y - p[i].p.y });
        if (r.kind === 'turner') {
          const [a, b] = [dir(0), dir(1)];
          const cos = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
          expect(Math.abs(cos)).toBeLessThan(0.3); // within ~17 deg of 90
        }
        if (r.kind === 'stopper') expect(p[2].p).toEqual(p[1].p);
        if (r.kind === 'doubleback') {
          const [a, b] = [dir(0), dir(1)];
          expect(a.x * b.x + a.y * b.y).toBeLessThan(0);
        }
        if (r.kind === 'pair') {
          const [u, v] = truth(r);
          expect(Math.hypot(u.x - v.x, u.y - v.y)).toBeGreaterThan(0.1);
        }
      }
    }
  });
  it('events happen at visible marks and turners turn toward room', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const r of generateSession(seed)) {
        if (r.kind === 'runner' || r.kind === 'pair') {
          expect(r.marks).toEqual([]);
          continue;
        }
        expect(r.marks).toHaveLength(1);
        const p = r.paths[0];
        const [m, ev] = [r.marks[0], p[1].p];
        expect(Math.hypot(m.x - ev.x, m.y - ev.y)).toBeLessThan(0.01);
        expect(p[1].t).toBeGreaterThan(r.showMs);
        if (r.kind === 'turner') {
          const e = [ev.x, 1 - ev.x, ev.y, 1 - ev.y];
          const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][e.indexOf(Math.min(...e))];
          expect((p[2].p.x - ev.x) * n[0] + (p[2].p.y - ev.y) * n[1]).toBeGreaterThan(0);
        }
      }
    }
  });
  it('dots get faster over the session', () => {
    const s = generateSession(3);
    const speed = (r: Round) => {
      const [a, b] = [r.paths[0][0], r.paths[0][1]];
      return Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) / (b.t - a.t);
    };
    expect(speed(s[3])).toBeGreaterThan(speed(s[0]));
  });
});

describe('scoreRound', () => {
  const s = generateSession(11);
  it('perfect pins score 1000 on every round', () => {
    for (const r of s) {
      const sc = scoreRound(r, truth(r));
      expect(sc.points).toBe(1000);
      expect(sc.track).toBe(1);
      expect(sc.read).toBe(1);
    }
  });
  it('points decrease monotonically with distance', () => {
    const r = s[0];
    const [t] = truth(r);
    let prev = Infinity;
    for (const d of [0, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5]) {
      const pts = scoreRound(r, [off(t, d)]).points;
      expect(pts).toBeLessThanOrEqual(prev);
      prev = pts;
    }
    expect(scoreRound(r, [off(t, 0.5)]).points).toBe(0);
  });
  it('read separates predicting the turn from naive extrapolation', () => {
    const r = s[1];
    const [t] = truth(r);
    const p = r.paths[0];
    const now = positionAt(p, r.showMs);
    const before = positionAt(p, r.showMs - 200);
    const k = r.jumpMs / 200;
    const naive = { x: now.x + (now.x - before.x) * k, y: now.y + (now.y - before.y) * k };
    expect(scoreRound(r, [t]).read).toBe(1);
    expect(scoreRound(r, [off(naive, 0.35)]).read).toBeLessThan(1);
  });
  it('matching is order independent', () => {
    const r = s[4];
    const [a, b] = truth(r);
    const x = scoreRound(r, [off(a, 0.03), off(b, 0.06)]);
    const y = scoreRound(r, [off(b, 0.06), off(a, 0.03)]);
    expect(y).toEqual(x);
    expect(x.errors[0]).toBeCloseTo(0.03, 9);
    expect(x.errors[1]).toBeCloseTo(0.06, 9);
  });
  it('missing pins count as error 1', () => {
    const r = s[4];
    const [a] = truth(r);
    const one = scoreRound(r, [a]);
    expect([...one.errors].sort()).toEqual([0, 1]);
    expect(one.track).toBeCloseTo(0.5, 9);
    expect(scoreRound(r, []).points).toBe(0);
  });
  it('ignores extra pins beyond the dot count', () => {
    const r = s[0];
    const [t] = truth(r);
    expect(scoreRound(r, [t, { x: 0, y: 0 }]).points).toBe(1000);
  });
});

describe('scoreSession', () => {
  it('sums points and means track/read', () => {
    const s = generateSession(5);
    const perfect = scoreSession(s.map((r) => scoreRound(r, truth(r))));
    expect(perfect.total).toBe(8000);
    expect(perfect.track).toBe(1);
    expect(perfect.read).toBe(1);
    const mixed = scoreSession([
      { index: 0, points: 100, track: 0.2, read: 0.4, errors: [] },
      { index: 1, points: 300, track: 0.6, read: 0.8, errors: [] },
    ]);
    expect(mixed.total).toBe(400);
    expect(mixed.track).toBeCloseTo(0.4, 9);
    expect(mixed.read).toBeCloseTo(0.6, 9);
    expect(scoreSession([]).total).toBe(0);
  });
});
