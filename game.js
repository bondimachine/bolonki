/* ==========================================================================
   BOLONKI  -  EAGLE Software 1993  -  Adrian J. Garelik
   JavaScript port of BOL02.BAS (QuickBASIC 4.5), reconstructed from BOL02.OBJ.

   Sprites, level maps and level codes are the originals, decoded from the
   DATA statements of the decompiled listing. Game logic follows the
   decompiled control flow; the conditions and array subscripts that the
   decompiler could not recover were reconstructed from context (see NOTES.md).
   ========================================================================== */
(() => {
'use strict';

/* ---------------------------------------------------------------- screen ---
   SCREEN 9 = 640x350, 16 EGA colours. Everything is drawn into a raw pixel
   buffer so the result is bit-exact and never antialiased.                  */

const SW = 640, SH = 350;
const EGA = [[0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],[170,85,0],[170,170,170],
             [85,85,85],[85,85,255],[85,255,85],[85,255,255],[255,85,85],[255,85,255],[255,255,85],[255,255,255]];

const cv  = document.getElementById('scr');
const ctx = cv.getContext('2d', {alpha:false});
cv.width = SW; cv.height = SH;
const frameImg = ctx.createImageData(SW, SH);
const px32 = new Uint32Array(frameImg.data.buffer);
const PAL  = EGA.map(([r,g,b]) => (255<<24)|(b<<16)|(g<<8)|r);

function pset(x, y, c) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  px32[y*SW + x] = PAL[c];
}
function boxFill(x1, y1, x2, y2, c) {          /* QB: LINE (x1,y1)-(x2,y2),c,BF */
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  x1 = Math.max(0, x1|0); y1 = Math.max(0, y1|0);
  x2 = Math.min(SW-1, x2|0); y2 = Math.min(SH-1, y2|0);
  const v = PAL[c];
  for (let y = y1; y <= y2; y++) { const o = y*SW; for (let x = x1; x <= x2; x++) px32[o+x] = v; }
}
function boxLine(x1, y1, x2, y2, c) {          /* QB: LINE (x1,y1)-(x2,y2),c,B  */
  boxFill(x1, y1, x2, y1, c); boxFill(x1, y2, x2, y2, c);
  boxFill(x1, y1, x1, y2, c); boxFill(x2, y1, x2, y2, c);
}
function line(x1, y1, x2, y2, c) {             /* QB: LINE, Bresenham           */
  x1|=0; y1|=0; x2|=0; y2|=0;
  if (y1 === y2 || x1 === x2) { boxFill(x1, y1, x2, y2, c); return; }
  let dx = Math.abs(x2-x1), dy = Math.abs(y2-y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    pset(x1, y1, c);
    if (x1 === x2 && y1 === y2) break;
    const e2 = err << 1;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 <  dx) { err += dx; y1 += sy; }
  }
}
function cls() { px32.fill(PAL[0]); }
function flush() { ctx.putImageData(frameImg, 0, 0); }

/* ------------------------------------------------------------------ font ---
   The DOS 8x14 ROM font is not in the object file, so one is synthesised
   once at start-up: each glyph is rendered into an 8x14 cell and thresholded
   to 1 bit, which keeps DOS text metrics (8x14 cells, LOCATE row,col) and a
   crisp non-antialiased look.                                              */

const CHARSET = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`' +
                'abcdefghijklmnopqrstuvwxyz{|}~ñÑáéíóú';
const FONT = Object.create(null);

function buildFont() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 14;
  const g = c.getContext('2d', {willReadFrequently:true});
  for (const ch of CHARSET) {
    g.clearRect(0, 0, 8, 14);
    g.fillStyle = '#fff';
    g.font = '600 12px "DejaVu Sans Mono","Liberation Mono","Menlo","Consolas",monospace';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(ch, 4, 11);
    const d = g.getImageData(0, 0, 8, 14).data, rows = new Uint8Array(14);
    for (let y = 0; y < 14; y++) {
      let bits = 0;
      for (let x = 0; x < 8; x++) if (d[(y*8+x)*4+3] > 108) bits |= 1 << x;
      rows[y] = bits;
    }
    FONT[ch] = rows;
  }
}
function glyph(x, y, ch, c, s) {
  const m = FONT[ch] || FONT['?'] || FONT[' '];
  s = s || 1;
  if (s === 1) boxFill(x, y, x+7, y+13, 0);      /* PRINT paints its background */
  for (let j = 0; j < 14; j++) {
    const bits = m[j]; if (!bits) continue;
    for (let i = 0; i < 8; i++) if (bits >> i & 1) {
      if (s === 1) pset(x+i, y+j, c);
      else boxFill(x+i*s, y+j*s, x+i*s+s-1, y+j*s+s-1, c);
    }
  }
}
/* QB LOCATE row,col -> pixel (col-1)*8, (row-1)*14 */
function print(row, col, str, c) {
  let x = (col-1)*8; const y = (row-1)*14;
  for (const ch of str) { glyph(x, y, ch, c); x += 8; }
}
function printBig(x, y, str, c, s) { for (const ch of str) { glyph(x, y, ch, c, s); x += 8*s; } }

/* QB PRINT of a numeric: leading space for the sign, trailing space. */
function qbNum(v) {
  let s;
  if (Number.isInteger(v)) s = String(v);
  else s = String(Math.round(v*100)/100);
  return (v < 0 ? '' : ' ') + s + ' ';
}

/* ----------------------------------------------------------------- sound ---
   SOUND freq, duration  (duration in 18.2 Hz clock ticks). QuickBASIC queues
   notes in the background, so these are scheduled rather than blocking.

   Safari on iOS asks for more than desktop browsers do:
     1. the context has to be created AND resumed inside a real user gesture;
     2. something has to actually be played through it once inside that
        gesture, or it stays mute - a one-sample silent buffer is enough;
     3. the ringer switch silences Web Audio unless the page claims a
        'playback' audio session (Safari 16.4+). Before that API existed the
        only lever was a looping silent <audio> element, which flips the same
        session category, so that is the fallback;
     4. an oscillator started at exactly currentTime gets dropped, so notes
        are always scheduled a little ahead.
   And notes must never be banked against a frozen clock: while the context
   is suspended currentTime does not advance, so accumulating sndAt would run
   past the queue window and silence everything from then on.               */

const SILENT_WAV = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

let ac = null, master = null, sndAt = 0, unlocked = false, sessionAsked = false, quiet = null;
const LOOKAHEAD = 0.03;

/* iPhone / iPad, including iPadOS which reports itself as a Mac */
const APPLE_TOUCH = !/Android/.test(navigator.userAgent) &&
                    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function claimPlaybackSession() {
  if (sessionAsked) return;
  sessionAsked = true;
  try {
    if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
  } catch (e) { /* fall through to the element trick */ }
  if (!APPLE_TOUCH) return;               /* nothing else needs this */
  try {                                   /* iOS before 16.4 */
    quiet = document.createElement('audio');
    quiet.src = SILENT_WAV;
    quiet.loop = true;
    quiet.volume = 0.0001;
    quiet.setAttribute('playsinline', '');
    quiet.style.display = 'none';
    document.body.appendChild(quiet);     /* Safari is happier with it attached */
    const p = quiet.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function audioOn() {
  claimPlaybackSession();                 /* must happen inside the gesture */
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { ac = new Ctx({latencyHint: 'interactive'}); }
    catch (e) { try { ac = new Ctx(); } catch (e2) { return; } }
    if (ac.addEventListener) ac.addEventListener('statechange', syncSound);
    master = ac.createGain();             /* single tap point for every note */
    master.gain.value = 1;
    master.connect(ac.destination);
  }
  if (ac.state !== 'running' && ac.resume) {
    const p = ac.resume();
    if (p && p.then) p.then(syncSound, () => {});
  }
  if (!unlocked) {                        /* play one silent sample */
    try {
      const src = ac.createBufferSource();
      src.buffer = ac.createBuffer(1, 1, ac.sampleRate);
      src.connect(ac.destination);
      src.start(0);
      unlocked = true;
    } catch (e) {}
  }
  if (quiet && quiet.paused) { const p = quiet.play(); if (p && p.catch) p.catch(() => {}); }
  syncSound();
}

function sound(freq, ticks) {
  if (!window.SFX_ON || !ac || ac.state !== 'running') return;
  const dur = Math.max(0.006, ticks / 18.2);
  const now = ac.currentTime;
  if (sndAt < now + LOOKAHEAD) sndAt = now + LOOKAHEAD;
  if (sndAt > now + 0.45) return;                /* QB's note queue is finite  */
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square';
  o.frequency.value = Math.max(37, Math.min(20000, freq));
  g.gain.setValueAtTime(0.0001, sndAt);
  g.gain.exponentialRampToValueAtTime(0.075, sndAt + 0.004);
  g.gain.setValueAtTime(0.075, Math.max(sndAt + 0.005, sndAt + dur * 0.8));
  g.gain.exponentialRampToValueAtTime(0.0001, sndAt + dur);
  o.connect(g); g.connect(master || ac.destination);
  o.start(sndAt); o.stop(sndAt + dur + 0.02);
  sndAt += dur;
}

/* Keep the labels honest about whether audio is actually live, and pick the
   context back up after an iOS interruption (a call, or backgrounding). */
function syncSound() {
  const on   = !!window.SFX_ON;
  const live = on && ac && ac.state === 'running';
  const chip = document.getElementById('sfx');
  if (chip) chip.textContent = 'Sonido: ' + (!on ? 'OFF' : live ? 'ON' : 'ON (toca para activar)');
  for (const el of document.querySelectorAll('[data-act="sfx"]')) el.classList.toggle('muted', !on);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ac && ac.state !== 'running' && ac.resume) {
    const p = ac.resume(); if (p && p.then) p.then(syncSound, () => {});
  }
});
function sweep(from, to, step, ticks) {          /* FOR f = a TO b STEP s: SOUND f,t */
  if (step > 0) for (let f = from; f <= to; f += step) sound(f, ticks);
  else          for (let f = from; f >= to; f += step) sound(f, ticks);
}

/* ----------------------------------------------------------------- input --- */

const keyq = [];
let anyKey = false;
function keyName(e) {
  switch (e.key) {
    case 'ArrowLeft':  return 'LEFT';
    case 'ArrowRight': return 'RIGHT';
    case 'ArrowUp':    return 'UP';
    case 'ArrowDown':  return 'DOWN';
    case 'Escape':     return 'ESC';
    case 'Enter':      return 'ENTER';
    case 'Backspace':  return 'BS';
  }
  return e.key.length === 1 ? e.key : null;
}
/* Everything that can produce a keystroke - the keyboard, the on-screen pad,
   swipes, and the hidden field the phone keyboard types into - comes through
   here, so the game itself only ever sees INKEY$-style values. */
const kbdEl = document.getElementById('kbd');

function pushKey(k) {
  audioOn();
  anyKey = true;
  if (keyq.length < 16) keyq.push(k);
}

addEventListener('keydown', e => {
  if (e.target === kbdEl) return;          /* the field's own listeners handle it */
  const k = keyName(e);
  if (!k) return;
  e.preventDefault();
  pushKey(k);
}, {passive:false});

/* --- on-screen buttons: press and hold repeats, like DOS typematic ------- */
let padOn = false;

const padReleases = new Set();
const releaseAllPad = () => { for (const r of [...padReleases]) r(); };

function bindPad() {
  /* both the portrait pad and the landscape overlay; CSS picks which shows */
  for (const el of document.querySelectorAll('[data-key]')) {
    const key = el.dataset.key, repeats = el.hasAttribute('data-repeat');
    let first = null, tick = null;
    const release = () => {
      el.classList.remove('on');
      clearTimeout(first); clearInterval(tick); first = tick = null;
      padReleases.delete(release);
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      el.classList.add('on');
      padReleases.add(release);
      pushKey(key);
      if (repeats) first = setTimeout(() => { tick = setInterval(() => pushKey(key), 80); }, 220);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, release);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  /* buttons that act on the page rather than pushing a key */
  for (const el of document.querySelectorAll('[data-act="sfx"]')) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); toggleSound(); });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  /* never let a repeat run away if the release event goes missing */
  addEventListener('pointerup', releaseAllPad);
  addEventListener('pointercancel', releaseAllPad);
  addEventListener('blur', releaseAllPad);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllPad(); });
}

/* --- a tap on the screen stands in for "presiona una tecla" -------------
   Only while the touch controls are up; no swipe or drag is interpreted.  */
function bindScreenTap() {
  cv.addEventListener('pointerup', e => {
    if (!padOn || e.pointerType === 'mouse') return;
    pushKey(' ');
  });
  cv.addEventListener('pointerdown', () => { if (padOn) audioOn(); });
}

/* --- the level-code screen needs letters, so borrow the phone keyboard ---- */
function bindSoftKeyboard() {
  if (!kbdEl) return;
  kbdEl.addEventListener('input', () => {
    for (const ch of kbdEl.value) if (/[A-Za-z0-9]/.test(ch)) pushKey(ch.toUpperCase());
    kbdEl.value = '';
  });
  kbdEl.addEventListener('keydown', e => {
    if (e.key === 'Enter')     { e.preventDefault(); pushKey('ENTER'); }
    if (e.key === 'Backspace') { e.preventDefault(); pushKey('BS'); }
  });
}
function softKeyboard(on) {
  if (!kbdEl || !padOn) return;
  if (on) { kbdEl.value = ''; kbdEl.focus({preventScroll:true}); }
  else kbdEl.blur();
}

function inkey()     { return keyq.length ? keyq.shift() : ''; }
function flushKeys() { keyq.length = 0; anyKey = false; }
/* requestAnimationFrame drives the game whenever the page is live. Embedded
   and hidden contexts never fire it and throttle timers to about 1 Hz, which
   would freeze the game, so a message-channel clock takes over in that case. */
const mchan = new MessageChannel();
let mqueue = [];
mchan.port1.onmessage = () => { const q = mqueue; mqueue = []; for (const f of q) f(); };
const post = fn => { mqueue.push(fn); mchan.port2.postMessage(0); };

let rafAlive = true;
function frame() {
  return new Promise(res => {
    let done = false;
    const t0 = performance.now();
    const fin = live => { if (done) return; done = true; rafAlive = live; flush(); res(); };
    requestAnimationFrame(() => fin(true));
    if (!rafAlive) {
      const spin = () => {
        if (done) return;
        if (performance.now() - t0 >= 16) fin(false); else post(spin);
      };
      post(spin);
    }
    setTimeout(() => fin(false), 120);
  });
}
async function sleep(ms) { const t = performance.now(); while (performance.now() - t < ms) await frame(); }
async function waitKey() {                        /* QB SLEEP 0 */
  flushKeys();
  while (!keyq.length) await frame();
  return keyq.shift();
}

/* ---------------------------------------------------------------- assets --- */

const SPR = {};
for (const [name, rows] of Object.entries(ASSETS.sprites)) {
  const a = new Uint8Array(24*24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) a[y*24+x] = parseInt(rows[y][x], 16);
  SPR[name] = a;
}
function put(x, y, name) {                        /* QB PUT (x,y), arr, OR */
  const s = SPR[name];
  for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
    const c = s[j*24+i];
    if (c) pset(x+i, y+j, c);
  }
}

const CODES  = ASSETS.names;                      /* the 30 level codes        */
const LEVELS = ASSETS.levels;                     /* 18 maps + spawn tail      */
const NLEV   = 18;                                /* n11! = 18                 */
/* code index that unlocks each level block, in the original's RESTORE table   */
const LEVEL_CODE_IX = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,20,28,29,30];

/* tile -> sprite (from the drawing routine at L499A) */
const TILE_SPR = {1:'arr15', 2:'arr17', 3:'arr19', 4:'arr16', 5:'arr18', 6:'arr20',
                  7:'arr14', 8:'arr24', 9:'arr25', 10:'arr26'};
const IND_SPR  = {4:'arr21', 5:'arr22', 6:'arr23'};

/* ------------------------------------------------------------------ state --- */

const S = {
  grid: [],            /* [row][col], 1-based, tile codes 0..10               */
  block: 1,            /* n20! - level number, 1..18                          */
  col: 1, row: 1,      /* n23!, n24! - ball cell                              */
  vy: 1,               /* n25! - vertical direction, +1 down / -1 up          */
  hdir: 0,             /* n14! - last horizontal direction                    */
  colour: 0,           /* n6!  - current ball colour, 0 / 4 / 5 / 6           */
  speed: 1,            /* n27! - 1..4 in 0.5 steps                            */
  minSpeed: 1,         /* n29! - level's initial speed, also the lower clamp   */
  bricks: 0,           /* n15! - matching blocks left in the level            */
  gold: 0, goldTotal: 0,     /* n17!, n16!                                    */
  score: 0, scoreTotal: 0,   /* n19!, n18!                                    */
  moved: 2,            /* n26! - 0 free, 1 moved this step, 2 blocked         */
  bounces: 0,          /* n22! - bounces during this step                     */
};

const cellX = col => col*24 - 22;
const cellY = row => row*24 - 22;
const tileAt = (col, row) => (row < 1 || row > 10 || col < 1 || col > 20) ? 0 : S.grid[row][col];
const eraseCell = (col, row) => boxFill(cellX(col), cellY(row), cellX(col)+23, cellY(row)+23, 0);

/* ------------------------------------------------------------ level frame --- */

function readLevel() {                            /* GOSUB L483C */
  const L = LEVELS[S.block - 1];
  S.grid = [];
  for (let r = 1; r <= 10; r++) {
    S.grid[r] = [];
    for (let c = 1; c <= 20; c++) S.grid[r][c] = L.grid[(r-1)*20 + (c-1)];
  }
  S.spawn = L.tail.slice();                       /* n30!, n31!, n32!, n33!    */
}

function drawLevel() {                            /* GOSUB L498B  (also the death / ESC reset) */
  boxFill(1, 1, 482, 242, 0);
  S.bricks = 0;
  for (let r = 1; r <= 10; r++) for (let c = 1; c <= 20; c++) {
    const t = S.grid[r][c];
    if (!t) continue;
    put(cellX(c), cellY(r), TILE_SPR[t]);
    if (t >= 1 && t <= 3) S.bricks++;
  }
  const [c0, x0, y0, d0] = S.spawn;
  S.col = x0; S.row = y0; S.colour = c0;
  S.vy = d0 >= 0 ? 1 : -1;
  S.minSpeed = Math.abs(d0) || 1;
  S.speed = S.minSpeed;
  S.gold = 0; S.score = 0; S.hdir = 0;
  put(cellX(S.col), cellY(S.row), S.vy < 0 ? 'arr5' : 'arr4');
  boxLine(0, 0, 483, 243, 15);
  drawStatus();
}

function drawStatus() {                           /* GOSUB L42FF */
  if (S.goldTotal + S.gold === 50) bonus();
  print(22,  1, 'Color:', 15);
  print(22, 20, 'Puntos:', 15);  print(22, 27, qbNum(S.scoreTotal + S.score) + '   ', 14);
  print(22, 39, 'Velocidad:', 15); print(22, 49, qbNum(S.speed) + '   ', 14);
  print(22, 58, 'Oro:', 15);     print(22, 62, qbNum(S.goldTotal + S.gold) + '   ', 14);
  print(3, 64, '           ', 15);
  print(3, 64, CODES[LEVEL_CODE_IX[S.block-1] - 1], 15);
  boxFill(61, 288, 84, 311, 0);
  boxLine(60, 287, 85, 312, 15);
  if (IND_SPR[S.colour]) put(61, 288, IND_SPR[S.colour]);
}

function bonus() {                                /* GOSUB L4692 - 50 gold */
  print(21, 20, 'BONUS 10000 Ptos.!', 14);
  for (let i = 1; i <= 1000; i++) { S.score += 10; if (i % 40 === 0) sound(i + 1000, 0.6); }
  print(22, 20, 'Puntos:', 15); print(22, 27, qbNum(S.scoreTotal + S.score) + '   ', 14);
  flush();
  S.gold = 0; S.goldTotal = 0;
  pendingClear = () => print(21, 20, ' '.repeat(19), 14);
}
let pendingClear = null;

/* ------------------------------------------------------------- animations --- */

async function wipeDiagonal() {                   /* GOSUB L4187 */
  let n4 = 1;
  for (let n2 = 1; n2 <= 481; n2++) {
    line(n2, 1, 1, n4, 0); n4 += 0.5;
    if (n2 % 12 === 0) await frame();
  }
  n4 = 1;
  for (let n2 = 1; n2 <= 241; n2 += 0.5) {
    line(n4, 241, 481, n2, 0); n4 += 1;
    if ((n4|0) % 12 === 0) await frame();
  }
  await frame();
}

async function wipeVertical() {                   /* GOSUB L4083 */
  let n4 = 481;
  for (let n2 = 2; n2 <= 480; n2 += 2) {
    line(n2, 1, n2, 241, 0);
    line(n4, 1, n4, 241, 0);
    n4 -= 2;
    if (n2 % 12 === 0) await frame();
  }
  await frame();
}

async function wipeBox() {                        /* the Info screen shutter */
  let a = 1, b = 242;
  for (let n6 = 482; n6 >= 241; n6--) {
    boxLine(a, a, n6, b, 0);
    a += 1; b -= 1;
    if (n6 % 8 === 0) await frame();
  }
  await frame();
}

/* --------------------------------------------------------------- gameplay --- */

const OUT = {};                                   /* out-of-band results       */

function clearTile(col, row) {
  if (row >= 1 && row <= 10 && col >= 1 && col <= 20) S.grid[row][col] = 0;
  eraseCell(col, row);
}

/* --- blocks 1..3 : destroyed only when (tile + 3) === current colour ------- */
function brickHoriz(t) {                          /* GOSUB L35D8 */
  S.moved = 2;
  if (S.bounces < 2) sound(500, 0.8);
  if (t + 3 !== S.colour) return null;
  if (S.bounces < 2) sound(1000, 0.8);
  clearTile(S.col + S.hdir, S.row);
  S.bricks--;
  S.score += S.speed * 10;
  drawStatus();
  return S.bricks === 0 ? 'clear' : null;
}
function brickVert(t) {                           /* GOSUB L33EA */
  sound(500, 0.8);
  if (t + 3 !== S.colour) { S.vy = -S.vy; S.bounces++; return 'recheck'; }
  sound(1000, 0.8);
  clearTile(S.col, S.row + S.vy);
  S.bricks--;
  S.score += S.speed * 10;
  drawStatus();
  return S.bricks === 0 ? 'clear' : null;
}

/* --- paint 4..6 : sets the ball colour, and bounces it -------------------- */
function paintHoriz(t) {                          /* GOSUB L398A */
  if (S.bounces < 2) sweep(1000, 1500, 10, 0.1);
  S.colour = t;
  boxFill(61, 288, 84, 311, 0);
  put(61, 288, IND_SPR[t]);
  S.moved = 2;
  return null;
}
function paintVert(t) {                           /* GOSUB L37E5 */
  sweep(1000, 1500, 10, 0.1);
  S.moved = 2;
  S.colour = t;
  boxFill(61, 288, 84, 311, 0);
  put(61, 288, IND_SPR[t]);
  S.vy = -S.vy; S.bounces++;
  return 'recheck';
}

/* --- 10 : gold ------------------------------------------------------------ */
function goldHoriz() {                            /* GOSUB L2BAC */
  S.gold++;
  clearTile(S.col + S.hdir, S.row);
  sound(1500, 0.5); sound(1000, 0.3); sound(1700, 0.5);
  drawStatus();
  return null;
}
function goldVert() {                             /* GOSUB L2CEB */
  S.gold++;
  clearTile(S.col, S.row + S.vy);
  sound(1500, 1); sound(1000, 0.5); sound(1700, 1);
  drawStatus();
  return null;
}

/* --- 9 : wipes every skull off the board --------------------------------- */
async function bombSweep() {
  for (let r = 1; r <= 10; r++) for (let c = 1; c <= 20; c++) {
    if (S.grid[r][c] !== 7) continue;
    S.grid[r][c] = 0;
    eraseCell(c, r);
    sweep(1500, 1000, -10, 0.1);
    await sleep(28);
  }
}
async function bombHoriz() {                      /* GOSUB L3B22 */
  await bombSweep();
  clearTile(S.col + S.hdir, S.row);
  return null;
}
async function bombVert() {                       /* GOSUB L3DBC */
  await bombSweep();
  clearTile(S.col, S.row + S.vy);
  S.vy = -S.vy; S.bounces++;
  return 'recheck';
}

/* --- 7 : the skull, i.e. death ------------------------------------------- */
async function die() {                            /* GOSUB L2E2A */
  const frames = S.vy < 0 ? ['arr10','arr11','arr12','arr13'] : ['arr6','arr7','arr8','arr9'];
  for (const f of frames) {
    put(cellX(S.col), cellY(S.row), f);
    await sleep(70);
  }
  eraseCell(S.col, S.row);
  await wipeDiagonal();
  drawLevel();
}

/* --- horizontal move attempt (arrow left / right) ------------------------ */
async function tryMove(hd) {
  if (S.moved === 1) return null;                 /* one sideways step per drop */
  S.hdir = hd;
  const t = tileAt(S.col + hd, S.row);
  let res = null;

  if (t === 0 && (hd > 0 ? S.col < 20 : S.col > 1)) S.moved = 0;
  if (t === 8) S.moved = 2;
  if (hd > 0 && S.col > 20) { S.col = 20; S.moved = 2; }
  if (hd < 0 && S.col < 1)  { S.col = 1;  S.moved = 2; }

  if (t >= 1 && t <= 3)      res = brickHoriz(t);
  else if (t >= 4 && t <= 6) res = paintHoriz(t);
  else if (t === 7)          { await die(); return null; }
  else if (t === 9)          res = await bombHoriz();
  else if (t === 10)         res = goldHoriz();

  if (S.moved !== 2) {
    S.moved = 1;
    S.col += hd;
    eraseCell(S.col - hd, S.row);                 /* rub out the cell behind   */
  }
  return res;
}

/* --- vertical collision resolution --------------------------------------- */
async function collide() {                        /* GOSUB L26CA */
  for (;;) {
    put(cellX(S.col), cellY(S.row), S.vy < 0 ? 'arr5' : 'arr4');

    if (S.bounces > 4) { const r = await stuck(); if (r) return r; }

    if (S.row === 1)  { S.vy = 1;  if (S.bounces < 2) sound(1100, 0.8); }
    if (S.row === 10) { S.vy = -1; S.bounces++; if (S.bounces < 2) sound(1000, 0.8); }

    const t = tileAt(S.col, S.row + S.vy);
    let res = null;

    if (t === 8) { S.vy = -S.vy; S.bounces++; if (S.bounces < 2) sound(1500, 0.8); }
    else if (t >= 1 && t <= 3) res = brickVert(t);
    else if (t >= 4 && t <= 6) res = paintVert(t);
    else if (t === 7)          { await die(); return null; }
    else if (t === 9)          res = await bombVert();
    else if (t === 10)         res = goldVert();

    if (res === 'recheck') continue;              /* the original's GOTO L26CA */
    return res;
  }
}

/* --- the panel keys, shared by the drop loop and the trapped-ball loop ---- */
async function panelKey(k) {
  if (k === 'P' || k === 'p') { await waitKey(); return null; }
  if (k === 'UP')   { S.speed = Math.min(4, S.speed + 0.5); drawStatus(); return null; }
  if (k === 'DOWN') { S.speed = Math.max(S.minSpeed, S.speed - 0.5); drawStatus(); return null; }
  if (k === 'ESC')  { await wipeDiagonal(); drawLevel(); return 'reset'; }
  if (k === 'S' || k === 's') return 'quit';
  if (k === 'C' || k === 'c') {
    await codeEntry();
    await wipeDiagonal();
    readLevel(); drawLevel();
    return 'reset';
  }
  return null;
}

/* --- trapped between two walls: a sideways move is the way out -----------
   L5B31 only looked at the arrow keys, so a ball with no sideways escape
   locked the original up for good; the panel keys are honoured here too.   */
async function stuck() {                          /* GOSUB L5B1C */
  for (;;) {
    S.moved = 2;
    const k = inkey();
    if (k === 'RIGHT' || k === 'LEFT') {
      const r = await tryMove(k === 'RIGHT' ? 1 : -1);
      if (r === 'clear') return 'clear';
      if (S.moved === 1) return null;
    } else if (k) {
      const r = await panelKey(k);
      if (r) return r;
    }
    put(cellX(S.col), cellY(S.row), S.vy < 0 ? 'arr5' : 'arr4');
    await frame();
  }
}

/* --- the delay / input phase of one drop -------------------------------- */
const TICK_MS = 2.4;                              /* one iteration of the DOS delay loop */

async function inputPhase() {                     /* GOSUB L1AA3 */
  S.moved = 2;
  const iters = Math.floor(50 / S.speed);         /* n7! = 50 / n27! */
  const until = performance.now() + iters * TICK_MS;
  let res = null;
  do {
    let k;
    while ((k = inkey())) {
      if (k === 'RIGHT' || k === 'LEFT') {
        const r = await tryMove(k === 'RIGHT' ? 1 : -1);
        if (r) res = r;
      } else {
        const r = await panelKey(k);
        if (r) return r;
      }
      if (res) return res;
    }
    put(cellX(S.col), cellY(S.row), S.vy < 0 ? 'arr5' : 'arr4');
    await frame();
  } while (performance.now() < until);
  return res;
}

/* --- one level ----------------------------------------------------------- */
async function playLevel() {                      /* the L1949 loop */
  print(5, 64, 'Empezar!', 8);
  print(9, 64, 'Info', 8);
  for (;;) {
    if (pendingClear) { pendingClear(); pendingClear = null; }
    S.bounces = 0;
    eraseCell(S.col, S.row);
    S.row += S.vy;
    if (S.row < 1)  { S.row = 1;  S.vy = 1;  }    /* guards the original could trip over */
    if (S.row > 10) { S.row = 10; S.vy = -1; }

    let r = await inputPhase();
    if (r === 'quit')  return 'quit';
    if (r === 'reset') continue;
    if (r !== 'clear') r = await collide();
    if (r === 'quit')  return 'quit';
    if (r === 'reset') continue;
    if (r === 'clear') {
      await wipeVertical();
      S.scoreTotal += S.score; S.score = 0;
      S.goldTotal  += S.gold;  S.gold  = 0;
      S.block++;
      if (S.block > NLEV) return 'end';
      drawStatus();
      readLevel(); drawLevel();
      print(5, 64, 'Empezar!', 8);
      print(9, 64, 'Info', 8);
    }
  }
}

/* ------------------------------------------------------------------ menu --- */

/* Stand-in for BOLONKI.DIB, which is not in the object file (see NOTES.md). */
function titleArt() {
  const x = 74, y = 88, s = 6;
  printBig(x+3, y+3, 'BOLONKI', 4,  s);
  printBig(x,   y,   'BOLONKI', 14, s);
  put(20, 92,  'arr1');  put(439, 92,  'arr2');
  put(20, 140, 'arr4');  put(439, 140, 'arr5');
  put(230, 178, 'arr26');
}

function menuFrame() {
  print(2, 64, 'C', 14); print(2, 65, 'odigo', 7);
  print(3, 64, CODES[LEVEL_CODE_IX[S.block-1] - 1], 15);
  print(5, 64, 'E', 14); print(5, 65, 'mpezar!', 7);
  print(7, 64, 'S', 14); print(7, 65, 'alir al DOS', 7);
  print(9, 64, 'I', 14); print(9, 65, 'nfo', 7);
  print(16, 31, 'Bolonki', 14); print(16, 38, ' - EAGLE Software 1993', 15);
  print(17, 31, 'Programado por Adrian Garelik', 13);
}

function drawMenu() {
  cls();
  boxLine(0, 0, 483, 243, 15);
  titleArt();
  menuFrame();
}

async function infoScreen() {                     /* GOSUB L135D */
  print(9, 64, 'Info', 14);
  await wipeBox();
  print(2,  3, 'Programa y graficos:', 14);
  print(3,  8, 'Adrian J. Garelik', 15);
  print(7, 15, 'Diseño de niveles:', 14);
  print(8, 20, 'Ruben A. Altman', 15);
  print(9, 20, 'Adrian J. Garelik', 15);
  print(13, 28, 'Colaboraron:', 14);
  print(14, 33, 'Adolfo Razo', 15);
  print(15, 33, 'Solomeo de Latorre', 15);
  await waitKey();
  print(9, 64, 'I', 14); print(9, 65, 'nfo', 7);
  await wipeBox();
  titleArt();
  print(16, 31, 'Bolonki', 14); print(16, 38, ' - EAGLE Software 1993', 15);
  print(17, 31, 'Programado por Adrian Garelik', 13);
}

async function codeEntry() {                      /* GOSUB L5184 */
  print(2, 64, 'Codigo', 14);
  let s5 = '';
  print(3, 64, '           ', 15);
  softKeyboard(true);
  for (;;) {
    const k = inkey();
    if (!k) { await frame(); continue; }
    if (k === 'ENTER') break;
    if (k === 'BS') { s5 = s5.slice(0, -1); print(3, 64, (s5 + '           ').slice(0, 11), 15); continue; }
    if (k === 'ESC') { s5 = ''; break; }
    if (k.length !== 1 || !/[A-Za-z0-9]/.test(k)) continue;
    s5 += k.toUpperCase();                        /* ASC > 96 AND < 123 -> upcase */
    print(3, 64, s5, 15);
    if (s5.length === 10) break;
  }
  S.scoreTotal = 0; S.goldTotal = 0; S.block = 1;
  const ix = CODES.indexOf(s5);                   /* 1-based code number = ix+1 */
  if (ix >= 0) {
    const b = LEVEL_CODE_IX.indexOf(ix + 1);
    if (b >= 0) S.block = b + 1;
  }
  softKeyboard(false);
  print(2, 64, 'C', 14); print(2, 65, 'odigo', 7);
  print(3, 64, '           ', 15);
  print(3, 64, CODES[LEVEL_CODE_IX[S.block-1] - 1], 15);
}

async function ending() {                         /* GOSUB L63CB */
  cls();
  printBig(40, 66, 'FIN', 14, 5);
  put(40, 130, 'arr4'); put(80, 130, 'arr26'); put(120, 130, 'arr5');
  print(4, 26, 'Felicitaciones!', 15);
  print(5, 26, 'Has logrado completar todos los', 7);
  print(6, 26, 'niveles!', 7);
  print(7, 26, 'Pero la diversion no termina!', 7);
  print(8, 26, 'Registrate y conseguiras nuevas', 7);
  print(9, 26, 'versiones de este juego, con mas', 7);
  print(10, 26, 'niveles, graficos, animaciones y', 7);
  print(11, 26, 'sonidos!', 7);
  print(12, 26, 'Tendras cientos de horas mas de', 7);
  print(13, 26, 'diversion con Bolonki.', 7);
  print(16, 26, 'Puntaje final:' + qbNum(S.scoreTotal), 14);
  print(24, 26, 'Presiona una tecla...', 8);
  await sleep(400);
  await waitKey();
}

async function goodbye() {                        /* "Salir al DOS" */
  cls();
  print(12, 26, 'Gracias por jugar Bolonki.', 15);
  print(14, 26, 'EAGLE Software 1993 - Adrian J. Garelik', 7);
  print(17, 26, 'Presiona una tecla para volver al menu.', 8);
  await sleep(300);
  await waitKey();
}

/* ---------------------------------------------------------------- startup --- */

async function loadingScreen() {                  /* the CARGANDO screen */
  cls();
  print(7, 36, 'CARGANDO', 12);
  print(8, 28, 'Descomprimiendo Graficos', 7);
  let pct = 100, flip = true;
  for (let i = 0; i < 46; i++) {
    put(170, 95, flip ? 'arr1' : 'arr2');
    put(436, 95, flip ? 'arr2' : 'arr1');
    flip = !flip;
    pct -= 100/46;
    print(9, 38, qbNum(Math.max(0, Math.floor(pct))) + '   ', 14);
    sound(90 + i*6, 0.4);
    await sleep(52);
  }
  await sleep(160);
}

async function splash() {
  cls();
  printBig(112, 100, 'BOLONKI', 14, 5);
  print(14, 30, 'EAGLE Software 1993 - Adrian J. Garelik', 7);
  print(18, 30, 'Presiona una tecla para empezar', 15);
  print(20, 30, 'QuickBASIC 4.5 -> JavaScript', 8);
  flush();
  await waitKey();
}

addEventListener('error', e => console.error('BOLONKI', e.message, e.filename + ':' + e.lineno));
addEventListener('unhandledrejection', e => console.error('BOLONKI reject', e.reason));

async function main() {
  buildFont();
  window.SFX_ON = true;
  syncSound();
  await splash();
  await loadingScreen();
  for (;;) {
    S.block = Math.min(S.block, NLEV) || 1;
    drawMenu();
    let go = false;
    while (!go) {
      const k = inkey();
      if (!k) { await frame(); continue; }
      if (k === 'C' || k === 'c') await codeEntry();
      else if (k === 'I' || k === 'i') await infoScreen();
      else if (k === 'S' || k === 's') { await goodbye(); drawMenu(); }
      else if (k === 'E' || k === 'e') go = true;
    }
    await wipeDiagonal();
    readLevel(); drawLevel();
    const r = await playLevel();
    if (r === 'end') await ending();
    else if (r === 'quit') await goodbye();
    S.scoreTotal = 0; S.goldTotal = 0; S.score = 0; S.gold = 0; S.block = 1;
  }
}

/* Integer upscale with square pixels. A real EGA monitor stretched 640x350 to
   4:3, i.e. by about 1.37 vertically; the sprites were drawn on a square 24x24
   grid, so they are shown as drawn. Set STRETCH to 1.371 for the CRT geometry. */
const STRETCH = 1;
const stage = document.getElementById('stage');

/* Zoom. `auto` takes the largest size that still fits the window, in half
   steps: whole steps alone jump from 640 to 1280 wide, so a window that can
   take 1.9x would be stuck showing 1x. Halves land on exact device pixels at
   devicePixelRatio 2 and stay close enough at 1 that the 24 px tiles and the
   8x14 text hold up. Below 1x the scale is free, so phones fill what they have. */
const ZOOM_STEPS = [0, 1, 1.5, 2, 2.5, 3, 4];      /* 0 = auto */
let zoomPref = 0;
try { zoomPref = parseFloat(localStorage.getItem('bolonki.zoom')) || 0; } catch (e) {}

function maxScale() {
  const availW = (stage ? stage.clientWidth : innerWidth) - 8;
  const availH = (stage ? stage.clientHeight : innerHeight) - 8;
  if (availW <= 0 || availH <= 0) return 0;
  const raw = Math.min(availW / SW, availH / (SH * STRETCH));
  return raw >= 1 ? Math.floor(raw * 2) / 2 : Math.max(0.3, raw);
}

function fit() {
  const max = maxScale();
  if (!max) return;
  const s = zoomPref ? Math.min(zoomPref, max) : max;
  cv.style.width  = Math.round(SW * s) + 'px';
  cv.style.height = Math.round(SH * s * STRETCH) + 'px';
  if (zoomBtn) zoomBtn.textContent = 'Zoom: ' + (zoomPref ? zoomPref + 'x' : 'auto (' + s + 'x)');
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
/* Re-fit whenever the space around the canvas changes - the pad appearing, an
   orientation flip, the phone keyboard sliding in. */
if (window.ResizeObserver && stage) {
  let inFit = false;
  new ResizeObserver(() => {
    if (inFit) return;
    inFit = true;
    requestAnimationFrame(() => { fit(); inFit = false; });
  }).observe(stage);
}

/* --------------------------------------------------- who gets the pad? ---
   A phone-sized viewport driven by a finger. There is no web API that
   reports whether a physical keyboard is attached, so the next best thing
   is to watch for one being used: a keystroke carrying a real KeyboardEvent
   `code` can only come from hardware - phone keyboards report an empty code
   or 'Unidentified' - and when one arrives the controls stand down. The chip
   in the footer overrides the decision either way.                        */
let sawHardwareKey = false;
let forcedPad = false;

const PHYSICAL = /^(Key[A-Z]|Digit\d|Numpad\d|Arrow(Up|Down|Left|Right)|Escape|Enter|Space|Backspace|Tab)$/;

function looksMobile() {
  const finger = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const small  = Math.min(innerWidth, innerHeight) <= 600;
  return finger && small;
}

function applyControls() {
  padOn = forcedPad || (looksMobile() && !sawHardwareKey);
  document.body.classList.toggle('mob', padOn);
  if (!padOn) releaseAllPad();
  if (padBtn) padBtn.textContent = 'Controles tactiles' + (padOn ? ': ON' : '');
  fit();
}

function toggleSound() {
  window.SFX_ON = !window.SFX_ON;
  if (window.SFX_ON) audioOn();          /* the tap that turned it on unlocks it */
  else syncSound();
}

const btn = document.getElementById('sfx');
const padBtn = document.getElementById('padtoggle');
const zoomBtn = document.getElementById('zoom');

if (btn) btn.onclick = () => { toggleSound(); btn.blur(); };
syncSound();
if (zoomBtn) zoomBtn.onclick = () => {
  /* offer only sizes this window can actually show, so the chip never
     advertises a scale that fit() would then clamp away */
  const max = maxScale();
  const usable = ZOOM_STEPS.filter(z => z === 0 || z <= max);
  const i = usable.indexOf(zoomPref);
  zoomPref = usable[(i + 1) % usable.length];
  try { localStorage.setItem('bolonki.zoom', String(zoomPref)); } catch (e) {}
  fit();
  zoomBtn.blur();
};
if (padBtn) padBtn.onclick = () => { forcedPad = !padOn; applyControls(); padBtn.blur(); };

addEventListener('keydown', e => {
  if (sawHardwareKey || e.target === kbdEl) return;
  if (!e.code || !PHYSICAL.test(e.code)) return;
  sawHardwareKey = true;
  if (!forcedPad) applyControls();
}, {capture:true});

addEventListener('resize', applyControls);
addEventListener('orientationchange', () => setTimeout(applyControls, 200));

bindPad(); bindScreenTap(); bindSoftKeyboard();
applyControls();

main();
})();
