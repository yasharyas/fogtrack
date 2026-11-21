/// <reference types="vite/client" />
import { CHANNEL, type BoardMsg, type Pin, type Round, type RoundScore, type SessionResult, type Vec } from '../shared/types';
import { dailySeed } from '../core/rng';
import { generateSession, positionAt } from '../core/rounds';
import { scoreRound, scoreSession } from '../core/scoring';
import { addScore, loadScores, makeEntry, rankScores } from '../shared/store';

type State = 'attract' | 'countdown' | 'show' | 'fog' | 'pin' | 'reveal' | 'score' | 'initials';

// ?seed and ?fast are test hooks: dev server or a VITE_TEST=1 build only, never the kiosk build.
const TEST = import.meta.env.DEV || import.meta.env.VITE_TEST === '1';
const q = new URLSearchParams(TEST ? location.search : '');
const S = q.get('fast') === '1' ? 0.1 : 1; // ponytail: one global time scale, tests only
const seedParam = Number(q.get('seed'));
const seed = q.has('seed') && Number.isInteger(seedParam) && seedParam >= 0 ? seedParam : dailySeed(new Date());

const COUNT_STEP = 800 * S, FOG_MS = 1300 * S, PIN_MS = 6000 * S, REVEAL_MS = 1200 * S, AUTO_MS = 6000 * S, IDLE_MS = 10000 * S, HANDOFF_MS = 1500 * S;
const KIND_NAME: Record<string, string> = { runner: 'Run', turner: 'Turn', stopper: 'Stop', pair: 'Pair', doubleback: 'Back' };
const nth = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th');
const PIN_HIT = 24; // css px: click within this of a pin removes it
const C = { paper: '#F4F1EA', ink: '#1B1F1D', orange: '#E8622C', teal: '#0F8A85', coral: '#E4574A' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('field');
const ctx = canvas.getContext('2d')!;
const screens: Record<string, HTMLElement> = { attract: $('s-attract'), countdown: $('s-countdown'), play: $('s-play'), score: $('s-score'), initials: $('s-initials') };
const screenOf = (s: State) => (s === 'show' || s === 'fog' || s === 'pin' || s === 'reveal' ? 'play' : s);
const ch = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
const post = (m: BoardMsg) => { try { ch?.postMessage(m); } catch { /* board is optional */ } };

// ---- game state (all of it lives here; reset() clears it) ----
let st: State = 'attract', t0 = 0, now = 0, lastAct = 0;
let ri = 0, rounds: Round[] = [], pins: Pin[] = [], scores: RoundScore[] = [], result: SessionResult | null = null, initials = '';
let truth: Vec[] = [], links: [number, number][] = [], lastPts = 0, total = 0;

function reset() { ri = 0; rounds = []; pins = []; scores = []; result = null; initials = ''; truth = []; links = []; lastPts = 0; total = 0; }

function go(s: State) {
  st = s; t0 = now; lastAct = now;
  for (const k in screens) screens[k].classList.toggle('on', k === screenOf(s));
  if (screenOf(s) === 'play') screens.play.setAttribute('data-testid', `screen-${s}`);
  hud();
}

// ---- layout ----
let W = 0, H = 0, dpr = 1, fx = 0, fy = 0, fs = 0;
let mapCache: HTMLCanvasElement | null = null;
const grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d')!, im = g.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random(); im.data[i] = 27; im.data[i + 1] = 31; im.data[i + 2] = 29; im.data[i + 3] = v < 0.18 ? 70 : v < 0.5 ? 22 : 0; }
  g.putImageData(im, 0, 0); return c;
})();
const fogPat = ctx.createPattern(grain, 'repeat')!;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3); W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const top = 76, pad = 16;
  fs = Math.max(120, Math.min(W - pad * 2, H - top - pad)); fx = (W - fs) / 2; fy = top + (H - top - pad - fs) / 2;
  mapCache = drawMap();
}

// original site plan: bays, walls, crates, lanes (normalised coords)
const WALLS: number[][] = [[0.28, 0.16, 0.03, 0.3], [0.28, 0.43, 0.2, 0.03], [0.68, 0.56, 0.03, 0.3], [0.46, 0.8, 0.25, 0.03], [0.08, 0.3, 0.1, 0.03]];
const CRATES: number[][] = [[0.14, 0.6], [0.18, 0.66], [0.78, 0.2], [0.83, 0.25], [0.56, 0.26], [0.42, 0.62], [0.86, 0.7]];

function drawMap() {
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d')!; g.scale(dpr, dpr);
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  g.save(); g.translate(fx, fy);
  g.strokeStyle = 'rgba(27,31,29,0.08)'; g.lineWidth = 1; g.beginPath();
  for (let i = 1; i < 20; i++) { const p = (i / 20) * fs; g.moveTo(p, 0); g.lineTo(p, fs); g.moveTo(0, p); g.lineTo(fs, p); }
  g.stroke();
  g.setLineDash([fs * 0.02, fs * 0.015]); g.strokeStyle = 'rgba(27,31,29,0.28)'; g.lineWidth = 2; g.beginPath();
  g.moveTo(0, fs * 0.58); g.lineTo(fs, fs * 0.58); g.moveTo(fs * 0.12, 0); g.lineTo(fs * 0.12, fs); g.moveTo(fs * 0.88, 0); g.lineTo(fs * 0.88, fs);
  g.stroke(); g.setLineDash([]);
  g.fillStyle = C.ink;
  for (const [x, y, w, h] of WALLS) g.fillRect(x * fs, y * fs, w * fs, h * fs);
  const cs = fs * 0.05; g.strokeStyle = C.ink; g.lineWidth = 2;
  for (const [x, y] of CRATES) { g.strokeRect(x * fs, y * fs, cs, cs); g.beginPath(); g.moveTo(x * fs, y * fs); g.lineTo(x * fs + cs, y * fs + cs); g.moveTo(x * fs + cs, y * fs); g.lineTo(x * fs, y * fs + cs); g.stroke(); }
  g.lineWidth = 4; g.strokeRect(0, 0, fs, fs);
  g.restore(); return c;
}

// ---- draw ----
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const px = (v: Vec): [number, number] => [fx + v.x * fs, fy + v.y * fs];
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function dot(v: Vec, a = 1) {
  const [x, y] = px(v), r = Math.max(7, fs * 0.017);
  ctx.globalAlpha = a; ctx.fillStyle = C.orange; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}
function ring(v: Vec, dashed = true) {
  const [x, y] = px(v); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.globalAlpha = 0.45; ctx.setLineDash(dashed ? [4, 4] : []);
  ctx.beginPath(); ctx.arc(x, y, Math.max(9, fs * 0.022), 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function pin(v: Vec) {
  const [x, y] = px(v), r = Math.max(9, fs * 0.021);
  ctx.fillStyle = C.teal; ctx.strokeStyle = C.paper; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 7); ctx.fill();
}
function mark(v: Vec) { // post: paper halo, dashed ink ring, ink block with an orange flag: "dots change here"
  const [x, y] = px(v), s = Math.max(10, fs * 0.022);
  ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, s * 2.1, 0, 7); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, s * 2.1, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.ink; ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.6);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y - s * 1.8); ctx.stroke();
  ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(x, y - s * 1.8); ctx.lineTo(x + s * 1.3, y - s * 1.4); ctx.lineTo(x, y - s * 1); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function fog(a: number) {
  if (a <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fs, fs); ctx.clip();
  ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#E6E1D5'; ctx.fillRect(fx, fy, fs, fs);
  const o = (now / 40) % 160; ctx.globalAlpha = a; ctx.translate(-o, -o * 0.5); ctx.fillStyle = fogPat; ctx.fillRect(fx, fy, fs + 160, fs + 160);
  ctx.restore(); ctx.globalAlpha = 1;
}
function dial(cx: number, cy: number, r: number, ms: number, jump: number) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(228,87,74,0.35)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.86, -Math.PI / 2, -Math.PI / 2 + (ms / 3000) * Math.PI * 2); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2 - Math.PI / 2, l = i % 5 === 0 ? 0.16 : 0.08; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * (1 - l), Math.sin(a) * r * (1 - l)); ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97); ctx.stroke(); }
  const a = (ms / 3000) * Math.PI * 2 - Math.PI / 2; ctx.strokeStyle = C.coral; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.stroke();
  ctx.font = `800 ${Math.max(18, r * 0.36)}px 'JetBrains Mono', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = `+${(ms / 1000).toFixed(1)}s`;
  ctx.lineWidth = 5; ctx.strokeStyle = C.paper; ctx.lineJoin = 'round'; ctx.strokeText(lab, 0, r * 0.42);
  ctx.fillStyle = C.ink; ctx.fillText(lab, 0, r * 0.42);
  ctx.restore(); void jump;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(mapCache!, 0, 0, W, H);
  const el = now - t0, R = rounds[ri];
  if (st === 'attract' || st === 'countdown') {
    const ph = (now / 1000) % 9, a = ph < 5 ? 0 : ph < 5.4 ? ease((ph - 5) / 0.4) : ph < 7 ? 1 : 1 - ease((ph - 7) / 1);
    for (let k = 0; k < 3; k++) dot({ x: 0.5 + 0.3 * Math.sin(now / 1900 + k * 2.1), y: 0.5 + 0.28 * Math.sin(now / 1300 + k * 1.7 + 1) });
    fog(a); return;
  }
  if (!R) return;
  const T = R.showMs + R.jumpMs;
  if (st === 'show') {
    const t = Math.min(el / S, R.showMs);
    for (const p of R.paths) {
      for (let k = 6; k >= 1; k--) dot(positionAt(p, Math.max(0, t - k * 70)), 0.07 * (7 - k));
      dot(positionAt(p, t));
    }
  } else if (st === 'fog' || st === 'pin') {
    for (const p of R.paths) ring(positionAt(p, R.showMs));
    fog(st === 'fog' ? ease(el / (300 * S)) : 1);
  } else if (st === 'reveal') {
    fog(1 - ease(el / (250 * S)));
    for (const p of R.paths) {
      ctx.strokeStyle = C.orange; ctx.globalAlpha = 0.45; ctx.lineWidth = 3; ctx.setLineDash([2, 6]); ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const [x, y] = px(positionAt(p, (T * i) / 24)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    const lp = ease(el / (350 * S));
    ctx.strokeStyle = C.coral; ctx.lineWidth = 3.5;
    for (const [pi, ti] of links) { const [ax, ay] = px(pins[pi]), [bx, by] = px(truth[ti]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * lp, ay + (by - ay) * lp); ctx.stroke(); }
    for (const v of truth) dot(v);
  }
  for (const m of R.marks) mark(m);
  for (const p of pins) pin(p);
  if (st === 'fog') dial(fx + fs / 2, fy + fs / 2, fs * 0.14, Math.floor(Math.min(1, el / FOG_MS) * R.jumpMs / 100) * 100, R.jumpMs);
  else if (st === 'pin') { const k = ease(el / (250 * S)), r = fs * (0.14 - 0.05 * k); dial(fx + fs * (0.5 + 0.38 * k), fy + fs * (0.5 - 0.38 * k), r, R.jumpMs, R.jumpMs); }
  if (st === 'reveal') {
    const k = ease(el / (200 * S)); ctx.save(); ctx.translate(fx + fs / 2, fy + fs * 0.1); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); ctx.globalAlpha = k;
    ctx.font = `900 ${fs * 0.09}px 'Satoshi', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = fs * 0.02; ctx.strokeStyle = C.paper; ctx.lineJoin = 'round'; ctx.strokeText(`+${lastPts}`, 0, 0);
    ctx.fillStyle = C.ink; ctx.fillText(`+${lastPts}`, 0, 0); ctx.restore();
  }
}

// ---- HUD / screens ----
const cache = new Map<string, string>();
const txt = (id: string, v: string) => { if (cache.get(id) !== v) { cache.set(id, v); $(id).textContent = v; } };
function hud() {
  const R = rounds[ri];
  if (screenOf(st) !== 'play' || !R) return;
  txt('h-round', `ROUND ${ri + 1} / ${rounds.length}`); txt('h-total', total.toLocaleString('en-US'));
  const need = R.paths.length - pins.length;
  txt('h-msg', st === 'show' ? 'Watch the orange' : st === 'fog' ? 'Time jumps ahead' : st === 'pin' ? `Tap where ${R.paths.length > 1 ? 'they are' : 'it is'} now (${need} left) - ${Math.max(0, Math.ceil((PIN_MS - (now - t0)) / (1000 * S)))}s` : `+${lastPts} points`);
  const bar = $('h-timer'); const left = st === 'pin' ? 1 - (now - t0) / PIN_MS : 0;
  bar.style.transform = `scaleX(${Math.max(0, left)})`; bar.classList.toggle('low', left < 0.3);
}

function startRound(i: number) { ri = i; pins = []; go('show'); post({ type: 'playing', round: rounds[i].index }); }

function lock() {
  const R = rounds[ri], sc = scoreRound(R, pins), T = R.showMs + R.jumpMs;
  scores.push(sc); lastPts = sc.points; total += sc.points;
  truth = R.paths.map((p) => positionAt(p, T));
  links = pins.length === 2 && truth.length >= 2
    ? (dist(pins[0], truth[0]) + dist(pins[1], truth[1]) <= dist(pins[0], truth[1]) + dist(pins[1], truth[0]) ? [[0, 0], [1, 1]] : [[0, 1], [1, 0]])
    : pins.map((p, i) => [i, truth.reduce((b, t, j) => (dist(p, t) < dist(p, truth[b]) ? j : b), 0)] as [number, number]);
  go('reveal');
}

function finish() {
  result = scoreSession(scores);
  txt('total', String(result.total)); txt('seedlab', `DAILY SEED ${seed}`);
  const pc = (v: number) => `${Math.round(v * 100)}`;
  $('b-track').style.width = `${pc(result.track)}%`; $('b-read').style.width = `${pc(result.read)}%`;
  txt('v-track', `${pc(result.track)} / 100`); txt('v-read', `${pc(result.read)} / 100`);
  const better = rankScores(loadScores(), 'today', Infinity, seed).filter((e) => e.total > result!.total).length;
  txt('rank', `${nth(better + 1)} today`);
  const strip = $('strip'); strip.replaceChildren();
  const top = Math.max(300, ...result.rounds.map((r) => r.points)); // bars scale to the best round, never below 300
  for (const r of result.rounds) {
    const d = document.createElement('div'), c = document.createElement('div'), i = document.createElement('i');
    const s = document.createElement('span'), n = document.createElement('b'), k = document.createElement('small');
    i.style.height = r.points > 0 ? `${Math.max(8, (r.points / top) * 100)}%` : "8px"; i.className = r.points > 0 ? "" : "zero"; c.className = 'col'; c.append(i);
    s.textContent = String(r.points); n.textContent = `R${r.index + 1}`; k.textContent = KIND_NAME[rounds[r.index]?.kind] ?? '';
    d.append(s, c, n, k); strip.append(d);
  }
  go('score');
}

function toAttract() { reset(); initials = ''; drawSlots(); go('attract'); post({ type: 'idle' }); }
function start() { reset(); rounds = generateSession(seed); go('countdown'); }

function drawSlots() {
  const sl = $('slots').children;
  for (let i = 0; i < 3; i++) { sl[i].textContent = initials[i] ?? ''; sl[i].classList.toggle('cur', i === initials.length); }
  ($('s-initials').querySelector('[data-act="done"]') as HTMLButtonElement).disabled = initials.length !== 3;
}
function typeKey(k: string) {
  if (k === 'back') initials = initials.slice(0, -1);
  else if (/^[A-Z]$/.test(k) && initials.length < 3) initials += k;
  drawSlots();
}
function done() {
  if (initials.length !== 3 || !result) return;
  const entry = makeEntry(initials, result, seed), ok = addScore(entry);
  if (ok) post({ type: 'score', entry });
  toAttract();
  if (!ok) flash('Not saved');
}
let noteT = 0;
function flash(msg: string) { // brief status line over the attract screen
  const n = $('note'); n.textContent = msg; n.classList.add('on'); clearTimeout(noteT);
  noteT = window.setTimeout(() => n.classList.remove('on'), 2500);
}

// keyboard: A-Z buttons, built once
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.dataset.act = 'key'; b.dataset.k = c; b.setAttribute('data-testid', `key-${c}`); $('keys').append(b);
}
{ const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Del'; b.className = 'wide'; b.dataset.act = 'key'; b.dataset.k = 'back'; b.setAttribute('data-testid', 'key-back'); $('keys').append(b); }

// ---- input (registered once) ----
function act(a: string, k?: string) {
  if (a === 'start' && st === 'attract') start();
  else if (a === 'continue' && st === 'score') go('initials');
  else if (a === 'key' && st === 'initials' && k) typeKey(k);
  else if (a === 'done' && st === 'initials') done();
  else if (a === 'skip' && st === 'initials') toAttract();
}
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (t) act(t.dataset.act!, t.dataset.k);
});
canvas.addEventListener('pointerdown', (e) => {
  if (st !== 'pin') return;
  const rc = canvas.getBoundingClientRect(), cx = e.clientX - rc.left, cy = e.clientY - rc.top;
  const hit = pins.findIndex((p) => Math.hypot(fx + p.x * fs - cx, fy + p.y * fs - cy) < PIN_HIT);
  if (hit >= 0) pins.splice(hit, 1);
  else if (cx >= fx && cx <= fx + fs && cy >= fy && cy <= fy + fs && pins.length < rounds[ri].paths.length) {
    pins.push({ x: (cx - fx) / fs, y: (cy - fy) / fs });
    if (pins.length === rounds[ri].paths.length) lock();
  }
  hud();
});
addEventListener('pointerdown', () => { lastAct = now; }, true);
// kiosk hardening: no context menu, drag, selection, browser shortcuts, zoom or back navigation
for (const ev of ['contextmenu', 'dragstart', 'selectstart']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // middle-click autoscroll
addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
history.pushState(null, '', location.href);
addEventListener('popstate', () => history.pushState(null, '', location.href));
addEventListener('pagehide', () => post({ type: 'idle' }));
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) e.preventDefault();
  lastAct = now;
  const onBtn = (e.target as HTMLElement).tagName === 'BUTTON';
  if (st === 'attract' && (e.key === 'Enter' || e.key === ' ') && !onBtn) start();
  else if (st === 'score' && e.key === 'Enter' && !onBtn) go('initials');
  else if (st === 'initials') {
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) typeKey(e.key.toUpperCase());
    else if (e.key === 'Backspace') typeKey('back');
    else if (e.key === 'Enter' && !onBtn) done();
  }
});
addEventListener('resize', resize);

// ---- the one loop ----
function tick(t: number) {
  now = t; const el = now - t0;
  switch (st) {
    case 'countdown': { const n = 3 - Math.floor(el / COUNT_STEP); if (n < 1) startRound(0); else { const c = $('count'); if (c.textContent !== String(n)) { c.textContent = String(n); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } } break; }
    case 'show': if (el >= rounds[ri].showMs * S) go('fog'); break;
    case 'fog': if (el >= FOG_MS) go('pin'); break;
    case 'pin': if (el >= PIN_MS) lock(); else hud(); break;
    case 'reveal': if (el >= REVEAL_MS) { if (ri < rounds.length - 1) startRound(ri + 1); else finish(); } break;
    case 'score': if (el >= AUTO_MS) go('initials'); break;
  }
  const waiting = st === 'score' || st === 'initials', idle = now - lastAct;
  $('handoff').classList.toggle('on', waiting && idle > IDLE_MS - HANDOFF_MS);
  if (waiting && idle > IDLE_MS) toAttract();
  draw(); requestAnimationFrame(tick);
}

(window as unknown as { __fog: unknown }).__fog = { state: () => st, seed };
resize(); toAttract(); requestAnimationFrame(tick);
