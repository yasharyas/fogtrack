import { STORE_KEY, STORE_CAP } from './types';
import type { ScoreEntry, BoardScope, SessionResult } from './types';

const AT_MIN = Date.UTC(2020, 0, 1), AT_MAX = Date.UTC(2100, 0, 1);
const unit = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;

/** Strict schema check; everything from storage or channels is untrusted. */
export function isValidEntry(x: unknown): x is ScoreEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 40 &&
    typeof e.initials === 'string' && /^[A-Z]{3}$/.test(e.initials) &&
    Number.isInteger(e.total) && (e.total as number) >= 0 && (e.total as number) <= 8000 &&
    unit(e.track) && unit(e.read) &&
    typeof e.seed === 'number' && /^\d{8}$/.test(String(e.seed)) &&
    typeof e.at === 'number' && e.at >= AT_MIN && e.at < AT_MAX
  );
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const ids = new Set<string>();
    return raw.filter((x) => isValidEntry(x) && !ids.has(x.id) && ids.add(x.id));
  } catch {
    return [];
  }
}

function save(list: ScoreEntry[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* quota or blocked: board just stays as is */ }
}

export function addScore(entry: ScoreEntry): boolean {
  if (!isValidEntry(entry)) return false;
  const list = loadScores();
  if (list.some((x) => x.id === entry.id)) return false;
  list.push({ ...entry });
  save(list.length > STORE_CAP ? list.slice(list.length - STORE_CAP) : list);
  return true;
}

/** Sort once over an already-loaded list. */
export function rankScores(list: ScoreEntry[], scope: BoardScope, n: number, seed: number): ScoreEntry[] {
  return list
    .filter((e) => scope === 'all' || e.seed === seed)
    .sort((a, b) => b.total - a.total || a.at - b.at)
    .slice(0, n);
}

export const topScores = (scope: BoardScope, n: number, seed: number) => rankScores(loadScores(), scope, n, seed);

/** Operator: drop the most recently stored entry; returns it, or null if empty. */
export function removeLast(): ScoreEntry | null {
  const list = loadScores();
  const last = list.pop() ?? null;
  if (last) save(list);
  return last;
}

export function clearScores() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

export function makeEntry(initials: string, result: Pick<SessionResult, 'total' | 'track' | 'read'>, seed: number): ScoreEntry {
  return {
    id: crypto.randomUUID(),
    initials,
    total: Math.round(result.total),
    track: result.track,
    read: result.read,
    seed,
    at: Date.now(),
  };
}
