// Lily's Fun Park — shared by the five new games: one wallet (🪙 coins and 💎 diamonds),
// one avatar with a floatie and a glider, a shop, and a top bar.
//
// API (everything hangs off the global `Park`):
//   Park.state                      saved state (see DEFAULT below); Park.save() after changing it
//   Park.game(id)                   this game's own saved object, e.g. Park.game('pizza').day
//   Park.addCoins(n) / Park.addDiamonds(n)   add (or remove with a negative n), saves, updates the bar
//   Park.spend(coins, diamonds)     true if you could afford it (and it's taken), false otherwise
//   Park.topBar({ title, emoji, help })  draws the bar at the top: title, 🪙, 💎, 🛍️ Shop, ❓ How to play
//   Park.openShop(tab?)             'look' | 'floatie' | 'glider'
//   Park.modal(title, html|Node, { wide, onClose }) → { body, close }
//   Park.toast(text, ms?)
//   Park.confetti()
//   Park.drawAvatar(ctx, x, y, size, av?, opts?)  x,y = feet; size ≈ height in px; opts.pose 'stand'|'run'|'jump'|'slide'|'sit', opts.t (seconds, for animation), opts.face (1 right, -1 left)
//   Park.drawFloatie(ctx, x, y, size, id?)        x,y = centre
//   Park.drawGlider(ctx, x, y, size, id?)         x,y = centre (the rider hangs under it)
//   Park.rng(seed)                  repeatable random numbers (0..1), for levels
//   Park.sound(name)                tiny beeps: 'coin' | 'good' | 'bad' | 'pop' | 'win' | 'jump' | 'splash'

const Park = (() => {
  const KEY = 'lily-fun-park-v1';
  const DEFAULT = {
    coins: 50, diamonds: 2,
    avatar: { skin: '#f6c9a3', hair: 'long', hairColor: '#5a3825', outfit: '#ec4899', pants: '#3b82f6', hat: 'none', glasses: 'none' },
    floatie: 'ring-red', glider: 'kite-rainbow',
    owned: {},          // 'hat:crown': true
    games: {},          // per-game saves
    sound: true,
  };

  // ---------- shop catalogue ----------
  const LOOK = {
    skin: [['#ffe0c7', 'Light'], ['#f6c9a3', 'Peach'], ['#e8b48a', 'Tan'], ['#c98e62', 'Caramel'], ['#a26b45', 'Brown'], ['#6e4429', 'Deep']],
    hair: [['long', 'Long', 0], ['short', 'Short', 0], ['bun', 'Bun', 0], ['pigtails', 'Pigtails', 15], ['ponytail', 'Ponytail', 15], ['curly', 'Curly', 20], ['spiky', 'Spiky', 20], ['bob', 'Bob', 15]],
    hairColor: [['#2b1d14', 'Black'], ['#5a3825', 'Brown'], ['#a0522d', 'Auburn'], ['#e5c07b', 'Blonde'], ['#f97316', 'Ginger'], ['#ec4899', 'Pink', 25], ['#8b5cf6', 'Purple', 25], ['#38bdf8', 'Blue', 25], ['#22c55e', 'Green', 25]],
    outfit: [['#ec4899', 'Pink'], ['#8b5cf6', 'Purple'], ['#3b82f6', 'Blue'], ['#22c55e', 'Green'], ['#f59e0b', 'Yellow'], ['#ef4444', 'Red'], ['#14b8a6', 'Teal', 10], ['#111827', 'Black', 10], ['#f8fafc', 'White', 10]],
    pants: [['#3b82f6', 'Blue'], ['#111827', 'Black'], ['#f8fafc', 'White'], ['#ec4899', 'Pink', 10], ['#a3e635', 'Lime', 10], ['#f59e0b', 'Yellow', 10]],
    hat: [['none', 'None', 0], ['cap', 'Cap', 20], ['bow', 'Bow', 20], ['flower', 'Flower', 25], ['beanie', 'Beanie', 30], ['sunhat', 'Sun hat', 40], ['party', 'Party hat', 40], ['headphones', 'Headphones', 60], ['crown', 'Crown', 0, 5], ['tiara', 'Tiara', 0, 8], ['unicorn', 'Unicorn horn', 0, 12]],
    glasses: [['none', 'None', 0], ['round', 'Round glasses', 20], ['sunnies', 'Sunnies', 30], ['heart', 'Heart sunnies', 45], ['star', 'Star glasses', 0, 4]],
  };
  // [id, name, coins, diamonds, colours...]
  const FLOATIES = [
    ['ring-red', 'Red ring', 0, 0], ['ring-blue', 'Blue ring', 30, 0], ['donut', 'Sprinkle donut', 60, 0], ['watermelon', 'Watermelon', 80, 0],
    ['duck', 'Rubber duck', 120, 0], ['flamingo', 'Flamingo', 0, 5], ['unicorn', 'Unicorn', 0, 8], ['shark', 'Shark', 150, 0], ['rainbow', 'Rainbow ring', 0, 12], ['gold', 'Golden ring', 0, 25],
  ];
  const GLIDERS = [
    ['kite-rainbow', 'Rainbow kite', 0, 0], ['kite-blue', 'Sky kite', 30, 0], ['paper', 'Paper plane', 60, 0], ['butterfly', 'Butterfly', 100, 0],
    ['bird', 'Bird wings', 140, 0], ['bat', 'Bat wings', 0, 6], ['dragon', 'Dragon wings', 0, 10], ['fairy', 'Fairy wings', 0, 14], ['rocket', 'Rocket wing', 0, 25],
  ];

  let state = null;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { state = null; }
    state = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), state || {});
    state.avatar = Object.assign({}, DEFAULT.avatar, state.avatar);
    return state;
  }
  // Several games can be open at once (the Lily's Games menu keeps them loaded in the background),
  // and they all share this one save. So: each page only ever writes its OWN games' entries
  // (the ids it asked for with Park.game(id)), takes everyone else's from the latest save, and
  // picks up wallet / avatar / shop changes from other pages as soon as they happen.
  const mine = new Set();
  function readStored() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function mergeOthers(latest) {
    if (!latest) return;
    for (const [gid, g] of Object.entries(latest.games || {})) if (!mine.has(gid)) state.games[gid] = g;
    for (const gid of Object.keys(state.games)) if (!mine.has(gid) && !(latest.games || {})[gid]) delete state.games[gid];
  }
  function save() {
    mergeOthers(readStored());
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked — play on */ }
    refreshBar();
  }
  // another page (another game) saved: take its wallet, look and shop changes, and its game entries
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const latest = readStored(); if (!latest) return;
    for (const k of ['coins', 'diamonds', 'floatie', 'glider', 'sound']) if (k in latest) state[k] = latest[k];
    Object.assign(state.avatar, latest.avatar || {});        // same object, so drawings pick it up
    state.owned = Object.assign(state.owned || {}, latest.owned || {});
    mergeOthers(latest);
    refreshBar();
  });
  load();

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- sound ----------
  let actx = null;
  function sound(name) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { coin: [[988, .06], [1319, .1]], good: [[660, .08], [880, .12]], bad: [[220, .18]], pop: [[1200, .05]], win: [[523, .1], [659, .1], [784, .1], [1047, .25]], jump: [[440, .06], [660, .08]], splash: [[300, .05], [180, .2]] }[name] || [[600, .1]];
      let t = actx.currentTime;
      for (const [f, d] of notes) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = name === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
      }
    } catch (e) { /* no sound — fine */ }
  }

  // ---------- money ----------
  function addCoins(n) { state.coins = Math.max(0, Math.round(state.coins + n)); save(); if (n > 0) { sound('coin'); bump('coins'); } }
  function addDiamonds(n) { state.diamonds = Math.max(0, Math.round(state.diamonds + n)); save(); if (n > 0) { sound('good'); bump('diamonds'); } }
  function spend(c = 0, d = 0) {
    if (state.coins < c || state.diamonds < d) { toast(`Not enough ${state.coins < c ? '🪙 coins' : '💎 diamonds'} yet!`); sound('bad'); return false; }
    state.coins -= c; state.diamonds -= d; save(); return true;
  }
  function game(id) { mine.add(id); if (!state.games[id]) state.games[id] = {}; return state.games[id]; }

  // ---------- top bar ----------
  let bar = null;
  function topBar({ title, emoji = '🎮', help = '' }) {
    injectCss();
    bar = el('div', 'pk-bar', `
      <div class="pk-title">${emoji} <b>${esc(title)}</b></div>
      <div class="pk-right">
        <span class="pk-pill" data-k="coins">🪙 <b>0</b></span>
        <span class="pk-pill" data-k="diamonds">💎 <b>0</b></span>
        <button class="pk-btn" data-a="shop" title="Shop">🛍️<span class="pk-shop-label"> Shop</span></button>
        ${help ? '<button class="pk-btn ghost" data-a="help" title="How to play">❓</button>' : ''}
        <button class="pk-btn ghost" data-a="sound" title="Sound on/off"></button>
      </div>`);
    document.body.prepend(bar);
    bar.querySelector('[data-a="shop"]').onclick = () => openShop('look');
    if (help) bar.querySelector('[data-a="help"]').onclick = () => modal(`${emoji} How to play`, `<div class="pk-help">${help}</div>`);
    bar.querySelector('[data-a="sound"]').onclick = () => { state.sound = !state.sound; save(); };
    refreshBar();
    return bar;
  }
  function refreshBar() {
    if (!bar) return;
    bar.querySelector('[data-k="coins"] b').textContent = state.coins;
    bar.querySelector('[data-k="diamonds"] b').textContent = state.diamonds;
    bar.querySelector('[data-a="sound"]').textContent = state.sound ? '🔊' : '🔇';
  }
  function bump(k) { const p = bar && bar.querySelector(`[data-k="${k}"]`); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }

  // ---------- modal / toast / confetti ----------
  function modal(title, content, opts = {}) {
    injectCss();
    const ov = el('div', 'pk-ov');
    const box = el('div', 'pk-modal' + (opts.wide ? ' wide' : ''), `<div class="pk-mhead"><h2>${esc(title)}</h2><button class="pk-x" title="Close">✕</button></div><div class="pk-mbody"></div>`);
    ov.appendChild(box); document.body.appendChild(ov);
    const body = box.querySelector('.pk-mbody');
    if (typeof content === 'string') body.innerHTML = content; else if (content) body.appendChild(content);
    const close = () => { ov.remove(); if (opts.onClose) opts.onClose(); };
    box.querySelector('.pk-x').onclick = close;
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov && !opts.sticky) close(); });
    return { body, close, box };
  }
  function toast(text, ms = 2200) {
    injectCss();
    let wrap = document.querySelector('.pk-toasts'); if (!wrap) { wrap = el('div', 'pk-toasts'); document.body.appendChild(wrap); }
    const t = el('div', 'pk-toast', esc(text)); wrap.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
  }
  function confetti() {
    injectCss();
    const c = el('div', 'pk-confetti');
    for (let i = 0; i < 70; i++) {
      const p = el('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = `hsl(${Math.random() * 360},90%,60%)`;
      p.style.animationDelay = Math.random() * 0.5 + 's'; p.style.transform = `rotate(${Math.random() * 360}deg)`; c.appendChild(p);
    }
    document.body.appendChild(c); setTimeout(() => c.remove(), 3000);
  }

  // ---------- drawing: avatar ----------
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.min(255, Math.max(0, r * f)); g = Math.min(255, Math.max(0, g * f)); b = Math.min(255, Math.max(0, b * f)); return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // Draws a cute character standing with feet at (x, y). size ≈ total height in px.
  function drawAvatar(ctx, x, y, size, av = state.avatar, opts = {}) {
    const s = size / 100, pose = opts.pose || 'stand', t = opts.t || 0, face = opts.face || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    const swing = pose === 'run' ? Math.sin(t * 14) : 0;
    const sitting = pose === 'sit' || pose === 'slide';
    // legs
    ctx.lineCap = 'round'; ctx.strokeStyle = av.pants; ctx.lineWidth = 11;
    if (sitting) { ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(16, -26); ctx.moveTo(4, -30); ctx.lineTo(24, -24); ctx.stroke(); }
    else if (pose === 'jump') { ctx.beginPath(); ctx.moveTo(-5, -34); ctx.lineTo(-10, -14); ctx.moveTo(5, -34); ctx.lineTo(12, -18); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-5, -34); ctx.lineTo(-5 - swing * 8, -4); ctx.moveTo(5, -34); ctx.lineTo(5 + swing * 8, -4); ctx.stroke(); }
    // shoes
    if (!sitting) { ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; for (const sx of pose === 'jump' ? [[-10, -12], [12, -16]] : [[-5 - swing * 8, -3], [5 + swing * 8, -3]]) { ctx.beginPath(); ctx.ellipse(sx[0] + 3, sx[1], 8, 4.5, 0, 0, 7); ctx.fill(); ctx.stroke(); } }
    // body
    ctx.fillStyle = av.outfit; rr(ctx, -15, sitting ? -62 : -66, 30, 34, 10); ctx.fill();
    ctx.fillStyle = shade(av.outfit, 0.85); ctx.fillRect(-15, sitting ? -36 : -40, 30, 6);
    // arms
    ctx.strokeStyle = av.skin; ctx.lineWidth = 8;
    const armY = sitting ? -56 : -60;
    if (pose === 'jump' || pose === 'slide') { ctx.beginPath(); ctx.moveTo(-13, armY); ctx.lineTo(-24, armY - 18); ctx.moveTo(13, armY); ctx.lineTo(24, armY - 18); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-13, armY); ctx.lineTo(-20 + swing * 6, armY + 22); ctx.moveTo(13, armY); ctx.lineTo(20 - swing * 6, armY + 22); ctx.stroke(); }
    // head
    const hy = sitting ? -80 : -84;
    hairBack(ctx, av, hy);
    ctx.fillStyle = av.skin; ctx.beginPath(); ctx.arc(0, hy, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(-6, hy + 1, 2.4, 0, 7); ctx.arc(6, hy + 1, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(244,114,182,.45)'; ctx.beginPath(); ctx.arc(-10, hy + 7, 3.4, 0, 7); ctx.arc(10, hy + 7, 3.4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, hy + 6, 5, 0.2, Math.PI - 0.2); ctx.stroke();
    hairFront(ctx, av, hy);
    glasses(ctx, av.glasses, hy);
    hat(ctx, av.hat, hy);
    ctx.restore();
  }
  function hairBack(ctx, av, hy) {
    ctx.fillStyle = av.hairColor;
    if (av.hair === 'long') { rr(ctx, -19, hy - 8, 38, 40, 12); ctx.fill(); }
    if (av.hair === 'bob') { rr(ctx, -20, hy - 8, 40, 26, 12); ctx.fill(); }
    if (av.hair === 'ponytail') { ctx.beginPath(); ctx.ellipse(18, hy + 4, 7, 16, -0.4, 0, 7); ctx.fill(); }
    if (av.hair === 'pigtails') { ctx.beginPath(); ctx.arc(-21, hy + 6, 8, 0, 7); ctx.arc(21, hy + 6, 8, 0, 7); ctx.fill(); }
    if (av.hair === 'curly') { for (let a = 0; a < 10; a++) { ctx.beginPath(); ctx.arc(Math.cos(a / 10 * 7) * 19, hy + Math.sin(a / 10 * 7) * 17, 8, 0, 7); ctx.fill(); } }
  }
  function hairFront(ctx, av, hy) {
    ctx.fillStyle = av.hairColor;
    ctx.beginPath(); ctx.arc(0, hy - 2, 18, Math.PI, 0); ctx.lineTo(18, hy - 2); ctx.quadraticCurveTo(4, hy - 12, -18, hy - 2); ctx.fill();
    if (av.hair === 'bun') { ctx.beginPath(); ctx.arc(0, hy - 20, 9, 0, 7); ctx.fill(); }
    if (av.hair === 'spiky') { ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 7 - 5, hy - 12); ctx.lineTo(i * 7, hy - 27); ctx.lineTo(i * 7 + 5, hy - 12); } ctx.fill(); }
    if (av.hair === 'pigtails') { ctx.fillStyle = '#f472b6'; ctx.fillRect(-17, hy + 1, 4, 5); ctx.fillRect(13, hy + 1, 4, 5); }
  }
  function glasses(ctx, g, hy) {
    if (!g || g === 'none') return;
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#111827';
    if (g === 'round') { ctx.beginPath(); ctx.arc(-6, hy + 1, 5, 0, 7); ctx.moveTo(11, hy + 1); ctx.arc(6, hy + 1, 5, 0, 7); ctx.moveTo(-1, hy + 1); ctx.lineTo(1, hy + 1); ctx.stroke(); }
    if (g === 'sunnies') { ctx.fillStyle = '#111827'; rr(ctx, -12, hy - 3, 10, 7, 3); ctx.fill(); rr(ctx, 2, hy - 3, 10, 7, 3); ctx.fill(); ctx.fillRect(-2, hy - 1, 4, 2); }
    if (g === 'heart' || g === 'star') {
      ctx.fillStyle = g === 'heart' ? '#ec4899' : '#facc15';
      for (const cx of [-6, 6]) { ctx.save(); ctx.translate(cx, hy + 1); ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g === 'heart' ? '♥' : '★', 0, 0); ctx.restore(); }
    }
  }
  function hat(ctx, h, hy) {
    if (!h || h === 'none') return;
    const top = hy - 16;
    switch (h) {
      case 'cap': ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, top + 6, 17, Math.PI, 0); ctx.fill(); ctx.fillRect(0, top + 3, 24, 4); break;
      case 'bow': ctx.fillStyle = '#ec4899'; ctx.beginPath(); ctx.moveTo(8, top + 2); ctx.lineTo(0, top - 6); ctx.lineTo(0, top + 8); ctx.closePath(); ctx.moveTo(8, top + 2); ctx.lineTo(18, top - 6); ctx.lineTo(18, top + 8); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(9, top + 2, 3, 0, 7); ctx.fill(); break;
      case 'flower': for (let a = 0; a < 5; a++) { ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(10 + Math.cos(a * 1.26) * 5, top + 2 + Math.sin(a * 1.26) * 5, 4, 0, 7); ctx.fill(); } ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(10, top + 2, 3, 0, 7); ctx.fill(); break;
      case 'beanie': ctx.fillStyle = '#8b5cf6'; ctx.beginPath(); ctx.arc(0, top + 8, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(-18, top + 4, 36, 6); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, top - 10, 5, 0, 7); ctx.fill(); break;
      case 'sunhat': ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(0, top + 6, 30, 6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, top + 5, 14, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f472b6'; ctx.fillRect(-14, top + 1, 28, 4); break;
      case 'party': ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(-10, top + 4); ctx.lineTo(10, top + 4); ctx.lineTo(0, top - 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, top - 22, 4, 0, 7); ctx.fill(); break;
      case 'headphones': ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, hy, 20, Math.PI * 1.05, -0.05); ctx.stroke(); ctx.fillStyle = '#ec4899'; rr(ctx, -24, hy - 4, 8, 13, 3); ctx.fill(); rr(ctx, 16, hy - 4, 8, 13, 3); ctx.fill(); break;
      case 'crown': ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-13, top + 4); ctx.lineTo(-13, top - 10); ctx.lineTo(-6, top - 3); ctx.lineTo(0, top - 13); ctx.lineTo(6, top - 3); ctx.lineTo(13, top - 10); ctx.lineTo(13, top + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, top - 1, 2.5, 0, 7); ctx.fill(); break;
      case 'tiara': ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, top + 10, 15, Math.PI * 1.1, -0.1 * Math.PI); ctx.stroke(); ctx.fillStyle = '#a5f3fc'; ctx.beginPath(); ctx.moveTo(0, top - 10); ctx.lineTo(5, top - 3); ctx.lineTo(0, top + 2); ctx.lineTo(-5, top - 3); ctx.closePath(); ctx.fill(); break;
      case 'unicorn': ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(-5, top + 2); ctx.lineTo(5, top + 2); ctx.lineTo(0, top - 22); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, top - 4); ctx.lineTo(3, top - 7); ctx.moveTo(-2, top - 11); ctx.lineTo(2, top - 14); ctx.stroke(); break;
    }
  }

  // ---------- drawing: floatie (a ring seen from slightly above), centre (x, y) ----------
  function drawFloatie(ctx, x, y, size, id = state.floatie) {
    const s = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const ring = (outer, inner, fill) => { ctx.beginPath(); ctx.ellipse(0, 0, 50, 26, 0, 0, 7); ctx.ellipse(0, -2, 24, 11, 0, 0, 7, true); ctx.fillStyle = fill; ctx.fill('evenodd'); };
    const look = {
      'ring-red': ['#ef4444', '#fff'], 'ring-blue': ['#3b82f6', '#fff'], donut: ['#f9a8d4', null], watermelon: ['#22c55e', null], duck: ['#facc15', null],
      flamingo: ['#f472b6', null], unicorn: ['#f5f3ff', null], shark: ['#64748b', null], rainbow: [null, null], gold: ['#facc15', '#fef9c3'],
    }[id] || ['#ef4444', '#fff'];
    if (id === 'rainbow') { const g = ctx.createLinearGradient(-50, 0, 50, 0); ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((c, i) => g.addColorStop(i / 5, c)); ring(0, 0, g); }
    else ring(0, 0, look[0]);
    if (look[1]) { ctx.strokeStyle = look[1]; ctx.lineWidth = 7; for (const a of [0.4, 1.9, 3.3, 4.7]) { ctx.beginPath(); ctx.ellipse(0, 0, 37, 18.5, 0, a, a + 0.5); ctx.stroke(); } }
    if (id === 'donut') { const cs = ['#fff', '#38bdf8', '#facc15', '#22c55e']; for (let i = 0; i < 16; i++) { const a = i * 0.4; ctx.fillStyle = cs[i % 4]; ctx.fillRect(Math.cos(a) * 37 - 2, Math.sin(a) * 18 - 1, 5, 2); } }
    if (id === 'watermelon') { ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, -1, 32, 15, 0, 0, 7); ctx.stroke(); }
    const headAt = (col, beak) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(36, -22, 7, 16, 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(40, -38, 10, 0, 7); ctx.fill(); ctx.fillStyle = beak; ctx.beginPath(); ctx.moveTo(48, -40); ctx.lineTo(58, -36); ctx.lineTo(48, -33); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(43, -41, 1.8, 0, 7); ctx.fill(); };
    if (id === 'duck') headAt('#facc15', '#f97316');
    if (id === 'flamingo') headAt('#f472b6', '#111827');
    if (id === 'unicorn') { headAt('#f5f3ff', '#f5f3ff'); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(38, -46); ctx.lineTo(44, -47); ctx.lineTo(40, -64); ctx.fill(); ctx.fillStyle = '#c084fc'; ctx.fillRect(28, -42, 5, 14); }
    if (id === 'shark') { ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(8, -18); ctx.lineTo(-6, -44); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 9, 20); ctx.lineTo(-16 + i * 9, 13); ctx.lineTo(-12 + i * 9, 20); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-26, -12, 10, 4, -0.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- drawing: glider (wings seen from behind), centre (x, y) ----------
  function drawGlider(ctx, x, y, size, id = state.glider) {
    const s = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const wing = (fillL, fillR) => {
      ctx.fillStyle = fillL; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26, -60, -10); ctx.lineTo(-48, 8); ctx.quadraticCurveTo(-24, 0, 0, 10); ctx.fill();
      ctx.fillStyle = fillR || fillL; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -26, 60, -10); ctx.lineTo(48, 8); ctx.quadraticCurveTo(24, 0, 0, 10); ctx.fill();
    };
    if (id === 'kite-rainbow' || id === 'kite-blue') {
      const g = ctx.createLinearGradient(-60, 0, 60, 0);
      (id === 'kite-blue' ? ['#38bdf8', '#1d4ed8', '#38bdf8'] : ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6']).forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.quadraticCurveTo(0, -36, 60, 0); ctx.quadraticCurveTo(0, -18, -60, 0); ctx.fill();
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(0, 30); ctx.lineTo(58, 0); ctx.stroke();
    } else if (id === 'paper') { ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-60, 4); ctx.lineTo(0, -16); ctx.lineTo(60, 4); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (id === 'butterfly') { wing('#f472b6', '#f472b6'); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(-32, -6, 7, 0, 7); ctx.arc(32, -6, 7, 0, 7); ctx.fill(); }
    else if (id === 'bird') { wing('#92400e'); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-i * 12, -6 + i); ctx.lineTo(-i * 12 + 4, 6); ctx.moveTo(i * 12, -6 + i); ctx.lineTo(i * 12 - 4, 6); ctx.stroke(); } }
    else if (id === 'bat') wing('#312e81');
    else if (id === 'dragon') { wing('#16a34a'); ctx.strokeStyle = '#14532d'; ctx.lineWidth = 2; for (const sx of [-1, 1]) for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx * (18 + i * 13), -18 + i * 6); ctx.stroke(); } }
    else if (id === 'fairy') { ctx.globalAlpha = 0.7; wing('#a5f3fc', '#f5d0fe'); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(-50 + i * 14, -8 + (i % 2) * 8, 1.6, 0, 7); ctx.fill(); } }
    else if (id === 'rocket') { ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(-60, 6); ctx.lineTo(0, -10); ctx.lineTo(60, 6); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.lineTo(0, 26 + Math.random() * 6); ctx.fill(); }
    ctx.restore();
  }

  // ---------- shop ----------
  function openShop(tab = 'look') {
    const wrap = el('div', 'pk-shop');
    const m = modal('🛍️ Shop', wrap, { wide: true });
    const render = () => {
      const a = state.avatar;
      wrap.innerHTML = `
        <div class="pk-shop-side"><canvas width="360" height="440"></canvas><div class="pk-wallet">🪙 ${state.coins} · 💎 ${state.diamonds}</div></div>
        <div class="pk-shop-main">
          <div class="pk-tabs">${[['look', '👕 Look'], ['floatie', '🛟 Floaties'], ['glider', '🪁 Gliders']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="pk-items"></div>
        </div>`;
      const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 360, 440);
      if (tab === 'floatie') { drawFloatie(ctx, 180, 300, 260); drawAvatar(ctx, 180, 300, 220, a, { pose: 'sit' }); }
      else if (tab === 'glider') { drawGlider(ctx, 180, 120, 300); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 125); ctx.lineTo(170, 210); ctx.moveTo(250, 125); ctx.lineTo(190, 210); ctx.stroke(); drawAvatar(ctx, 180, 400, 220, a, { pose: 'jump' }); }
      else drawAvatar(ctx, 180, 420, 380, a);
      wrap.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
      const items = wrap.querySelector('.pk-items');
      const row = (label) => { const r = el('div', 'pk-row', `<h4>${label}</h4><div class="pk-opts"></div>`); items.appendChild(r); return r.querySelector('.pk-opts'); };
      const opt = (holder, key, id, name, coins, dias, swatch, isOn, choose) => {
        const owned = (!coins && !dias) || state.owned[`${key}:${id}`];
        const b = el('button', 'pk-opt' + (isOn ? ' on' : '') + (owned ? '' : ' locked'));
        b.innerHTML = `${swatch}<span>${esc(name)}</span>${owned ? '' : `<em>${coins ? `🪙 ${coins}` : `💎 ${dias}`}</em>`}`;
        b.onclick = () => {
          if (!owned) {
            if (!spend(coins, dias)) return;
            state.owned[`${key}:${id}`] = true; sound('good'); toast(`🎉 You got ${name}!`);
          }
          choose(); save(); render();
        };
        holder.appendChild(b);
      };
      if (tab === 'look') {
        for (const [key, label] of [['skin', 'Skin'], ['hair', 'Hair'], ['hairColor', 'Hair colour'], ['outfit', 'Top'], ['pants', 'Pants'], ['hat', 'Hat'], ['glasses', 'Glasses']]) {
          const h = row(label);
          for (const [id, name, coins = 0, dias = 0] of LOOK[key]) {
            const sw = id.startsWith('#') ? `<i class="pk-sw" style="background:${id}"></i>` : `<canvas class="pk-mini" width="64" height="64" data-k="${key}" data-id="${id}"></canvas>`;
            opt(h, key, id, name, coins, dias, sw, a[key] === id, () => { a[key] = id; });
          }
        }
        items.querySelectorAll('canvas.pk-mini').forEach(c => { const cx = c.getContext('2d'); const v = Object.assign({}, a, { [c.dataset.k]: c.dataset.id }); drawAvatar(cx, 32, 158, 140, v); });   // zoomed on the head
      } else {
        const list = tab === 'floatie' ? FLOATIES : GLIDERS, cur = tab === 'floatie' ? state.floatie : state.glider;
        const h = row(tab === 'floatie' ? 'Floaties — for the waterslides' : 'Gliders — for the big jump into the pool');
        for (const [id, name, coins, dias] of list) {
          const sw = `<canvas class="pk-mini" width="96" height="64" data-id="${id}"></canvas>`;
          opt(h, tab, id, name, coins, dias, sw, cur === id, () => { state[tab] = id; });
        }
        items.querySelectorAll('canvas.pk-mini').forEach(c => { const cx = c.getContext('2d'); if (tab === 'floatie') drawFloatie(cx, 48, 36, 80, c.dataset.id); else drawGlider(cx, 48, 36, 75, c.dataset.id); });
      }
    };
    render();
    return m;
  }

  // ---------- styles ----------
  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
      .pk-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 8px 12px; padding-top: max(8px, env(safe-area-inset-top)); font-family: Fredoka, system-ui, sans-serif; pointer-events: none; }
      .pk-bar > * { pointer-events: auto; }
      .pk-title { background: rgba(255,255,255,.92); border-radius: 999px; padding: 6px 14px; font-size: 18px; box-shadow: 0 2px 10px rgba(0,0,0,.12); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 38vw; }
      .pk-right { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
      .pk-pill { background: rgba(255,255,255,.95); border-radius: 999px; padding: 5px 12px; font-size: 17px; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
      .pk-pill.bump { animation: pkbump .4s; }
      @keyframes pkbump { 50% { transform: scale(1.25); } }
      .pk-btn { border: 0; border-radius: 999px; padding: 7px 14px; font: 600 16px Fredoka, sans-serif; cursor: pointer; background: linear-gradient(90deg,#8b5cf6,#ec4899); color: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
      .pk-btn.ghost { background: rgba(255,255,255,.95); color: #1f2937; padding: 7px 11px; }
      @media (max-width: 640px) { .pk-title { font-size: 15px; max-width: 30vw; } .pk-pill { font-size: 14px; padding: 4px 9px; } .pk-btn { font-size: 14px; padding: 6px 10px; } .pk-bar { top: 40px; } }
      /* phones: keep the bar on one row — short title, icon-only buttons */
      @media (max-width: 480px) { .pk-right { flex-wrap: nowrap; gap: 4px; } .pk-title { font-size: 13px; padding: 5px 9px; max-width: 26vw; }
        .pk-pill { font-size: 13px; padding: 4px 7px; } .pk-btn { font-size: 13px; padding: 5px 8px; } .pk-btn.ghost { padding: 5px 7px; } .pk-bar { padding-left: 6px; padding-right: 6px; } .pk-shop-label { display: none; } }
      .pk-ov { position: fixed; inset: 0; z-index: 200; background: rgba(15,23,42,.45); display: grid; place-items: center; padding: 14px; font-family: Fredoka, system-ui, sans-serif; }
      .pk-modal { background: #fff; border-radius: 22px; width: min(520px, 100%); max-height: calc(100vh - 28px); display: flex; flex-direction: column; box-shadow: 0 16px 50px rgba(0,0,0,.3); }
      .pk-modal.wide { width: min(920px, 100%); }
      .pk-mhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 6px; }
      .pk-mhead h2 { margin: 0; font-size: 24px; }
      .pk-x { border: 0; background: #f1f5f9; border-radius: 50%; width: 36px; height: 36px; font-size: 18px; cursor: pointer; }
      .pk-mbody { padding: 6px 18px 18px; overflow-y: auto; }
      .pk-help { font-size: 17px; line-height: 1.5; }
      .pk-shop { display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
      .pk-shop-side { text-align: center; position: sticky; top: 0; align-self: start; }
      .pk-shop-side canvas { width: 220px; height: auto; background: linear-gradient(#e0f2fe,#fce7f3); border-radius: 18px; }
      .pk-wallet { font-size: 18px; margin-top: 6px; font-weight: 600; }
      .pk-tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
      .pk-tabs button { border: 2px solid #e5e7eb; background: #fff; border-radius: 999px; padding: 6px 14px; font: 600 15px Fredoka, sans-serif; cursor: pointer; }
      .pk-tabs button.on { background: #8b5cf6; color: #fff; border-color: #8b5cf6; }
      .pk-row h4 { margin: 10px 0 6px; }
      .pk-opts { display: flex; flex-wrap: wrap; gap: 6px; }
      .pk-opt { border: 2px solid #e5e7eb; background: #fff; border-radius: 14px; padding: 5px 7px; display: flex; flex-direction: column; align-items: center; gap: 2px; font: 13px Fredoka, sans-serif; cursor: pointer; min-width: 66px; }
      .pk-opt.on { border-color: #8b5cf6; background: #f5f3ff; }
      .pk-opt.locked { opacity: .8; }
      .pk-opt em { font-style: normal; font-size: 12px; background: #fef3c7; border-radius: 999px; padding: 0 6px; }
      .pk-sw { width: 30px; height: 30px; border-radius: 50%; display: block; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; }
      .pk-mini { width: 48px; height: auto; }
      @media (max-width: 640px) { .pk-shop { grid-template-columns: 1fr; } .pk-shop-side { position: static; } .pk-shop-side canvas { width: 150px; } }
      .pk-toasts { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 300; display: flex; flex-direction: column; gap: 6px; align-items: center; pointer-events: none; font-family: Fredoka, system-ui, sans-serif; }
      .pk-toast { background: rgba(17,24,39,.9); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 16px; transition: opacity .4s, transform .4s; }
      .pk-toast.out { opacity: 0; transform: translateY(8px); }
      .pk-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 400; overflow: hidden; }
      .pk-confetti i { position: absolute; top: -12px; width: 9px; height: 14px; border-radius: 2px; animation: pkfall 2.6s ease-in forwards; }
      @keyframes pkfall { to { top: 105vh; transform: rotate(720deg); } }`;
    document.head.appendChild(st);
  }

  return {
    get state() { return state; }, save, load, game, addCoins, addDiamonds, spend, topBar, refreshBar, openShop, modal, toast, confetti,
    drawAvatar, drawFloatie, drawGlider, rng, sound, esc, el, rr, shade, LOOK, FLOATIES, GLIDERS,
  };
})();
