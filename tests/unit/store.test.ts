import { beforeEach, describe, expect, it } from 'vitest';
import { addScore, clearScores, isValidEntry, loadScores, makeEntry, removeLast, topScores } from '../../src/shared/store';
import { STORE_CAP, STORE_KEY } from '../../src/shared/types';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const e = (o: object = {}) => ({ id: 'a', initials: 'ABC', total: 100, track: 0.5, read: 0.5, seed: 20261121, at: 1.8e12, ...o });

beforeEach(() => mem.clear());

describe('store', () => {
  it('validates strictly', () => {
    expect(isValidEntry(e())).toBe(true);
    for (const bad of [
      e({ initials: 'abc' }), e({ initials: 'ABCD' }), e({ initials: '<b>' }), e({ total: 8001 }), e({ total: -1 }),
      e({ total: 1.5 }), e({ track: 1.1 }), e({ read: -0.1 }), e({ seed: 123 }), e({ at: NaN }), e({ at: 1 }), e({ at: -5 }), e({ at: 5e12 }), e({ id: 'x'.repeat(41) }),
      e({ id: '' }), null, 'x', [],
    ]) expect(isValidEntry(bad)).toBe(false);
  });

  it('survives junk storage and drops bad entries', () => {
    mem.set(STORE_KEY, '{not json');
    expect(loadScores()).toEqual([]);
    mem.set(STORE_KEY, JSON.stringify({ a: 1 }));
    expect(loadScores()).toEqual([]);
    mem.set(STORE_KEY, JSON.stringify([e(), e({ initials: 'x' }), 5]));
    expect(loadScores()).toHaveLength(1);
  });

  it('adds, rejects invalid, sorts by total then earlier at, scopes by seed', () => {
    expect(addScore(e({ id: '1', total: 500, at: 1.8e12 + 5 }))).toBe(true);
    expect(addScore(e({ id: '2', total: 500, at: 1.8e12 + 2 }))).toBe(true);
    expect(addScore(e({ id: '3', total: 900, seed: 20260101 }))).toBe(true);
    expect(addScore(e({ initials: 'no' }))).toBe(false);
    expect(topScores('all', 10, 20261121).map((x) => x.id)).toEqual(['3', '2', '1']);
    expect(topScores('today', 10, 20261121).map((x) => x.id)).toEqual(['2', '1']);
    expect(topScores('all', 1, 20261121)).toHaveLength(1);
  });

  it('caps at STORE_CAP dropping oldest, and clears', () => {
    mem.set(STORE_KEY, JSON.stringify(Array.from({ length: STORE_CAP }, (_, i) => e({ id: 'i' + i }))));
    addScore(e({ id: 'new' }));
    const l = loadScores();
    expect(l).toHaveLength(STORE_CAP);
    expect(l[0].id).toBe('i1');
    expect(l[l.length - 1].id).toBe('new');
    clearScores();
    expect(loadScores()).toEqual([]);
  });

  it('dedupes by id on load and add', () => {
    mem.set(STORE_KEY, JSON.stringify([e({ id: 'd', total: 1 }), e({ id: 'd', total: 2 }), e({ id: 'z' })]));
    expect(loadScores().map((x) => x.id)).toEqual(['d', 'z']);
    expect(addScore(e({ id: 'z' }))).toBe(false);
    expect(addScore(e({ id: 'n' }))).toBe(true);
    expect(loadScores()).toHaveLength(3);
  });

  it('removeLast drops the newest stored entry', () => {
    expect(removeLast()).toBeNull();
    addScore(e({ id: '1' }));
    addScore(e({ id: '2' }));
    expect(removeLast()?.id).toBe('2');
    expect(loadScores().map((x) => x.id)).toEqual(['1']);
  });

  it('makeEntry yields a valid entry', () => {
    const m = makeEntry('YAS', { total: 1234.4, track: 0.7, read: 0.2 }, 20261121);
    expect(isValidEntry(m)).toBe(true);
    expect(m.total).toBe(1234);
  });
});
