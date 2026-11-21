import { CHANNEL, ROUNDS, STORE_KEY } from '../shared/types';
import type { BoardScope, ScoreEntry } from '../shared/types';
import { clearScores, isValidEntry, loadScores, rankScores, removeLast } from '../shared/store';

const HOT_MS = 6000;
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const seedToday = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};
const el = (tag: string, cls: string, text = '') => {
  const n = document.createElement(tag);
  n.className = cls;
  n.textContent = text;
  return n;
};

const hot = new Map<string, number>(); // entry id -> expiry
const entering = new Set<string>();
let seen: Set<string> | null = null;

let timer = 0;
function markHot(id: string) {
  if (hot.has(id)) return;
  hot.set(id, Date.now() + HOT_MS);
  entering.add(id);
}

function row(rank: number, e: ScoreEntry | undefined) {
  const li = el('li', 'row');
  li.appendChild(el('span', 'rank', String(rank)));
  if (!e) {
    li.classList.add('empty');
    li.appendChild(el('span', 'ini', '---'));
    li.appendChild(el('span', 'bars'));
    li.appendChild(el('span', 'pts', '----'));
    return li;
  }
  li.appendChild(el('span', 'ini', e.initials));
  const bars = el('span', 'bars');
  for (const [k, v] of [['track', e.track], ['read', e.read]] as const) {
    const b = el('span', 'bar ' + k);
    const f = el('i', 'fill');
    f.style.width = `${Math.round(v * 100)}%`; // CSSOM, allowed under style-src 'self'
    b.appendChild(f);
    bars.appendChild(b);
  }
  li.appendChild(bars);
  li.appendChild(el('span', 'pts', String(e.total)));
  if ((hot.get(e.id) ?? 0) > Date.now()) li.classList.add('hot');
  if (entering.has(e.id)) li.classList.add('enter');
  return li;
}

function fill(list: HTMLElement, top: ScoreEntry[]) {
  list.replaceChildren(...Array.from({ length: 10 }, (_, i) => row(i + 1, top[i])));
}

function render() {
  clearTimeout(timer);
  const seed = seedToday();
  const all = loadScores(); // parse once
  const today = rankScores(all, 'today', 10, seed);
  const ever = rankScores(all, 'all', 10, seed);
  if (seen) for (const e of [...today, ...ever]) if (!seen.has(e.id)) markHot(e.id);
  seen = new Set([...(seen ?? []), ...today.map((e) => e.id), ...ever.map((e) => e.id)]);
  for (const [id, t] of hot) if (t < Date.now()) hot.delete(id);
  fill($('list-today'), today);
  fill($('list-all'), ever);
  entering.clear(); // class already applied above; the animation runs once
  // one coalesced timer: re-render when the next highlight expires
  if (hot.size) timer = window.setTimeout(render, Math.min(...hot.values()) - Date.now() + 50);
}

let stale = 0;
const STALE_MS = 15_000;
function live(round: number | null) {
  clearTimeout(stale);
  const on = round !== null;
  if (on) stale = window.setTimeout(() => live(null), STALE_MS); // game closed mid-round: drop stale state
  $('live').dataset.state = on ? 'playing' : 'idle';
  $('howto').dataset.on = on ? '0' : '1';
  $('live-text').textContent = on ? `Now playing - round ${round + 1} of ${ROUNDS}` : 'Next player up';
  Array.from($("ticks").children).forEach((t, i) => t.classList.toggle('on', on && i <= round));
}

for (let i = 0; i < ROUNDS; i++) $('ticks').appendChild(el('i', 'tick'));

/** round is the 0-based Round.index (0..7); shown as round+1 of 8. */
function onMsg(d: unknown) {
  if (!d || typeof d !== 'object') return;
  const m = d as Record<string, unknown>;
  if (m.type === 'idle') live(null);
  else if (m.type === 'playing' && Number.isInteger(m.round) && (m.round as number) >= 0 && (m.round as number) < ROUNDS) live(m.round as number);
  else if (m.type === 'score' && isValidEntry(m.entry)) { live(null); markHot(m.entry.id); render(); }
}

try {
  new BroadcastChannel(CHANNEL).onmessage = (ev) => onMsg(ev.data);
} catch { /* no BroadcastChannel: storage event still updates the board */ }
addEventListener('storage', (ev) => { if (ev.key === null || ev.key === STORE_KEY) render(); });

live(null);
render();
setInterval(render, 60_000); // rolls "Today" over at midnight

// ---- Operator overlay: Ctrl+Shift+O, auto-closes after 20 s, destructive actions need a second click ----
const OP_MS = 20_000;
let op: HTMLElement | null = null;
let opTimer = 0;

function csv() {
  const rows = loadScores().map((e) => [e.initials, e.total, e.track, e.read, new Date(e.at).toISOString()].join(','));
  return ['initials,total,track,read,date', ...rows].join('\n') + '\n';
}

function closeOp() {
  clearTimeout(opTimer);
  op?.remove();
  op = null;
}

function openOp() {
  closeOp();
  opTimer = window.setTimeout(closeOp, OP_MS);
  const msg = el('p', 'op-msg', `${loadScores().length} ${loadScores().length === 1 ? "entry" : "entries"} stored.`);
  const btns: HTMLButtonElement[] = [];
  const add = (label: string, confirmLabel: string | null, run: () => string) => {
    const b = el('button', 'op-btn', label) as HTMLButtonElement;
    b.type = 'button';
    b.onclick = () => {
      if (confirmLabel && b.dataset.armed !== '1') {
        for (const o of btns) { o.dataset.armed = ''; o.textContent = o.dataset.label ?? ''; }
        b.dataset.armed = '1';
        b.textContent = confirmLabel;
        return;
      }
      b.dataset.armed = '';
      b.textContent = label;
      msg.textContent = run();
      render();
    };
    b.dataset.label = label;
    btns.push(b);
    return b;
  };
  const exp = add('Export CSV', null, () => {
    const url = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fogtrack-scores.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'CSV exported.';
  });
  const rm = add('Remove last entry', 'Confirm: remove last entry', () => {
    const r = removeLast();
    return r ? `Removed ${r.initials} ${r.total}.` : 'Nothing to remove.';
  });
  const clr = add('Clear all scores', 'Confirm: clear all scores', () => { clearScores(); return 'All scores cleared.'; });
  const close = el('button', 'op-btn op-close', 'Close (Esc)') as HTMLButtonElement;
  close.type = 'button';
  close.onclick = closeOp;
  op = el('div', 'op');
  const box = el('div', 'op-box');
  box.append(el('h2', 'op-title', 'Operator'), msg, exp, rm, clr, close);
  op.appendChild(box);
  document.body.appendChild(op);
  exp.focus();
}

addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyO') { ev.preventDefault(); op ? closeOp() : openOp(); }
  else if (ev.key === 'Escape' && op) closeOp();
});
