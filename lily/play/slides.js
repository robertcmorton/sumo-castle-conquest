// Splash Slides — race 5 rivals down a water park in three sections:
//   1. Twisty Flume (steer round the bends on your floatie, grab stars and bubbles, boost)
//   2. Tunnel Rapids (dark tunnel with drops, rocks to dodge and logs to jump)
//   3. Big Launch (fly off the ramp on your glider, through rings, land on the target in the pool)
// Points go on the Splash Chart, which pays out coins and diamonds at milestones and unlocks parks.
'use strict';
(() => {
  // ---------- world constants ----------
  const SEG = 200, ROADW = 1000, CAMH = 1000, DEPTH = 0.84, PLAYERZ = CAMH * DEPTH, DRAW = 120;
  const MAXSPEED = SEG * 40, AIRSPEED = MAXSPEED * 0.75, A0 = 7000;
  const RACER_W = 420, RIDER_H = 360, POOL_R = 4800, POOL_RZ = 3400;
  const SECTION = ['', 'Twisty Flume', 'Tunnel Rapids', 'Big Launch'];
  const RAINBOW = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'];

  const PARKS = [
    { id: 'lagoon', name: 'Lagoon Lane', emoji: '🏝️', need: 0, mult: 1, len: [460, 460, 300], curve: 3, obst: 0.45,
      sky: ['#38bdf8', '#e0f2fe'], hills: ['#34d399', '#10b981'], ground: ['#86efac', '#6ee7b7'], slide: ['#f472b6', '#ec4899'], lip: '#fff1f2',
      water: ['#0ea5e9', '#38bdf8'], tunnel: '#0b1b3a', rock: '#1e3a8a', lamps: ['#facc15', '#f472b6'], deco: ['palm', 'umbrella'], sun: '#fde047', card: 'linear-gradient(135deg,#22d3ee,#34d399)' },
    { id: 'jungle', name: 'Jungle Jumble', emoji: '🌴', need: 300, mult: 1.25, len: [540, 540, 330], curve: 3.8, obst: 0.6,
      sky: ['#22d3ee', '#d9f99d'], hills: ['#15803d', '#166534'], ground: ['#4ade80', '#22c55e'], slide: ['#fb923c', '#f97316'], lip: '#ffedd5',
      water: ['#14b8a6', '#2dd4bf'], tunnel: '#052e16', rock: '#14532d', lamps: ['#a3e635', '#facc15'], deco: ['jtree', 'flower'], sun: '#fef08a', card: 'linear-gradient(135deg,#16a34a,#f97316)' },
    { id: 'volcano', name: 'Volcano Vortex', emoji: '🌋', need: 900, mult: 1.5, len: [620, 620, 360], curve: 4.6, obst: 0.75,
      sky: ['#7c3aed', '#fb923c'], hills: ['#44403c', '#292524'], ground: ['#78716c', '#57534e'], slide: ['#ef4444', '#dc2626'], lip: '#fee2e2',
      water: ['#06b6d4', '#22d3ee'], tunnel: '#1c0a00', rock: '#7c2d12', lamps: ['#f97316', '#ef4444'], deco: ['lavarock', 'torch'], sun: '#fdba74', card: 'linear-gradient(135deg,#7c3aed,#ef4444)' },
    { id: 'ice', name: 'Icicle Island', emoji: '🧊', need: 1800, mult: 1.75, len: [700, 700, 390], curve: 5.2, obst: 0.85,
      sky: ['#60a5fa', '#e0f2fe'], hills: ['#f8fafc', '#cbd5e1'], ground: ['#f1f5f9', '#e2e8f0'], slide: ['#a78bfa', '#8b5cf6'], lip: '#f5f3ff',
      water: ['#38bdf8', '#7dd3fc'], tunnel: '#172554', rock: '#1e40af', lamps: ['#a5f3fc', '#ffffff'], deco: ['pine', 'snowman'], sun: '#fefce8', card: 'linear-gradient(135deg,#60a5fa,#a78bfa)' },
    { id: 'sky', name: 'Rainbow Sky Park', emoji: '🌈', need: 3200, mult: 2, len: [780, 780, 420], curve: 5.8, obst: 1, rainbow: true,
      sky: ['#f0abfc', '#bae6fd'], hills: ['#ffffff', '#f5d0fe'], ground: ['#fdf4ff', '#fae8ff'], slide: ['#f472b6', '#a78bfa'], lip: '#ffffff',
      water: ['#818cf8', '#a5b4fc'], tunnel: '#2e1065', rock: '#6d28d9', lamps: ['#f472b6', '#facc15', '#4ade80', '#38bdf8'], deco: ['cloud', 'balloon'], sun: '#fef9c3', card: 'linear-gradient(135deg,#f472b6,#facc15,#38bdf8)' },
  ];

  // The Splash Chart: total points → rewards. `park` unlocks that park.
  const MILESTONES = [
    { at: 100, coins: 25 }, { at: 300, diamonds: 1, park: 1 }, { at: 600, coins: 50 }, { at: 900, diamonds: 2, park: 2 },
    { at: 1300, coins: 75 }, { at: 1800, diamonds: 2, park: 3 }, { at: 2400, coins: 100 }, { at: 3200, diamonds: 3, park: 4 },
    { at: 4200, coins: 150 }, { at: 5500, diamonds: 5, title: 'Slide Legend' },
  ];
  for (let at = 7000, k = 0; at <= 60000; at += 1500, k++) MILESTONES.push(k % 2 ? { at, diamonds: 2 } : { at, coins: 150 });

  // Top 10 board: best single-race scores of the park's famous sliders.
  const BOARD = [['Captain Coral', 880], ['Marina Mae', 760], ['Finn Flipper', 660], ['Pip Puddle', 580], ['Ziggy Zoom', 500], ['Juno Jets', 430],
    ['Bodhi Bubbles', 360], ['Tilly Tide', 300], ['Kai Kerplunk', 240], ['Nova Noodle', 180], ['Sunny Snorkel', 120]];
  const PLACE_PTS = [120, 90, 70, 50, 35, 25];
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
  const MEDAL = ['', '🥇', '🥈', '🥉', '🏅', '🏅', '🏅'];

  // ---------- save ----------
  function G() {
    const o = Park.game('slides');
    o.total = o.total || 0; o.claimed = o.claimed || 0; o.best = o.best || 0; o.races = o.races || 0; o.wins = o.wins || 0;
    o.parkBest = o.parkBest || {}; o.park = o.park || 'lagoon';
    return o;
  }
  const unlocked = (park) => G().total >= park.need;

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eio = (t) => t * t * (3 - 2 * t);

  // ---------- canvas ----------
  const cv = $('#game'), ctx = cv.getContext('2d');
  let W = 0, H = 0, K = 1, HORIZ = 0, hudTop = 70;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    K = Math.min(W * 0.56, H * 0.42);
    HORIZ = Math.max(H * 0.4, H - K - Math.max(140, H * 0.22));
    const bar = document.querySelector('.pk-bar');
    hudTop = bar ? Math.max(60, bar.getBoundingClientRect().bottom + 6) : 70;
  }
  function proj(wx, wy, wz, camX, camY, camZ, near = 1) {
    const cz = wz - camZ, s = DEPTH / Math.max(cz, near);
    return { x: W / 2 + s * (wx - camX) * K, y: HORIZ - s * (wy - camY) * K, w: s * ROADW * K, s, cz };
  }

  // ---------- track ----------
  function buildTrack(park, seed) {
    const R = Park.rng(seed), segs = [];
    const rand = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rand(a, b + 1));
    let y = 0;
    function piece(n, curve, dy, sec) {
      const y0 = y, enter = Math.max(1, Math.floor(n * 0.3)), leave = Math.max(1, Math.floor(n * 0.3));
      for (let k = 0; k < n; k++) {
        let c = curve;
        if (k < enter) c = curve * eio(k / enter); else if (k >= n - leave) c = curve * eio((n - k) / leave);
        segs.push({ i: segs.length, curve: c, y1: y0 + dy * eio(k / n), y2: y0 + dy * eio((k + 1) / n), sec, items: [], deco: [] });
      }
      y = y0 + dy;
    }
    const [L1, L2, L3] = park.len;
    // section 1: twisty flume
    piece(28, 0, 0, 1);
    while (segs.length < L1 - 40) {
      const dir = R() < 0.5 ? -1 : 1, c = dir * park.curve * rand(0.55, 1), k = R();
      if (k < 0.2) piece(ri(20, 40), 0, -rand(200, 800), 1);
      else if (k < 0.5) { piece(ri(30, 50), c, -rand(300, 900), 1); piece(ri(30, 50), -c, -rand(300, 900), 1); }
      else piece(ri(40, 90), c, -rand(200, 1200), 1);
    }
    piece(30, 0, -300, 1);
    const s1End = segs.length;
    // section 2: tunnel rapids
    piece(24, 0, 0, 2);
    while (segs.length < s1End + L2 - 50) {
      const k = R();
      if (k < 0.3) piece(ri(25, 40), 0, -rand(1800, 3200), 2);                 // big drop!
      else if (k < 0.42) piece(ri(25, 40), 0, rand(300, 700), 2);              // hump
      else piece(ri(40, 80), (R() < 0.5 ? -1 : 1) * park.curve * rand(0.4, 0.85), -rand(200, 800), 2);
    }
    piece(26, 0, 0, 2); piece(22, 0, 900, 2);                                  // launch ramp
    const s2End = segs.length;
    // section 3: the air above the park
    for (let k = 0; k < L3; k++) segs.push({ i: segs.length, curve: 0, y1: 0, y2: 0, sec: 3, items: [], deco: [] });

    // items, section 1
    for (let i = 40; i < s1End - 18;) {
      const r = R(), x = rand(-0.65, 0.65);
      if (r < 0.4) { const n = ri(3, 4); for (let k = 0; k < n; k++) segs[i + k * 3].items.push({ t: 'star', x }); i += n * 3; }
      else if (r < 0.72) segs[i].items.push({ t: 'bubble', x });
      else if (r < 0.9) segs[i].items.push({ t: 'pad', x });
      else { segs[i].items.push({ t: 'bubble', x: -0.5 }); segs[i].items.push({ t: 'star', x: 0.5 }); }
      i += ri(18, 30);
    }
    // items, section 2
    for (let i = s1End + 34; i < s2End - 60;) {
      const r = R(), x = rand(-0.6, 0.6);
      if (r < park.obst * 0.3) {
        segs[i - 28].items.push({ t: 'warn', x: -1.2 }, { t: 'warn', x: 1.2 });
        segs[i].items.push({ t: 'log', x: 0 });
        segs[i + 8].items.push({ t: 'star', x: 0 });
        i += 12;
      } else if (r < park.obst * 0.75) {
        segs[i].items.push({ t: 'rock', x });
        if (R() < park.obst * 0.5) segs[i + 2].items.push({ t: 'rock', x: x > 0 ? x - 0.95 : x + 0.95 });
      } else if (r < 0.8) { const n = 3; for (let k = 0; k < n; k++) segs[i + k * 3].items.push({ t: 'star', x }); i += n * 3; }
      else if (r < 0.92) segs[i].items.push({ t: 'ramp', x });
      else segs[i].items.push({ t: 'bubble', x });
      i += ri(15, 26) - Math.round(park.obst * 4);
    }
    segs[s2End - 30].items.push({ t: 'sign', x: -1.25, text: 'LAUNCH!' }, { t: 'sign', x: 1.25, text: 'LAUNCH!' });
    // scenery next to the flume and on the ground under the launch
    for (let i = 2; i < s1End; i += 4) {
      const side = (i / 4) % 2 ? 1 : -1;
      segs[i].deco.push({ t: park.deco[ri(0, 1)], x: side * rand(1.7, 3.2), size: rand(700, 1100) });
      if (R() < 0.5) segs[i].deco.push({ t: park.deco[0], x: -side * rand(3.6, 6), size: rand(900, 1500) });
    }
    for (let i = s2End; i < segs.length; i += 3) {
      segs[i].deco.push({ t: park.deco[ri(0, 1)], x: (R() < 0.5 ? -1 : 1) * rand(4.6, 12), size: rand(800, 1400) });
    }
    // rings in the air
    const rings = []; let rx = 0;
    for (let k = 24; k < L3 - 45; k += ri(28, 40)) { rx = clamp(rx + rand(-1.5, 1.5), -2.2, 2.2); rings.push({ z: (s2End + k) * SEG, x: rx, hit: false, miss: false }); }
    return { segs, s1End, s2End, airStart: s2End * SEG, end: segs.length * SEG, rings, targetX: rand(-1.6, 1.6) };
  }
  const segAt = (T, z) => T.segs[clamp(Math.floor(z / SEG), 0, T.segs.length - 1)];
  const secOf = (T, z) => (z >= T.airStart ? 3 : z >= T.s1End * SEG ? 2 : 1);
  const altAt = (T, z) => A0 * clamp(1 - (z - T.airStart) / (T.end - T.airStart), 0, 1);
  const yAt = (T, z) => { const s = segAt(T, z); return lerp(s.y1, s.y2, (z % SEG) / SEG); };

  // ---------- race ----------
  let race = null;
  function randomLook(R) {
    const pick = (a) => a[Math.floor(R() * a.length)][0], L = Park.LOOK;
    return { skin: pick(L.skin), hair: pick(L.hair), hairColor: pick(L.hairColor), outfit: pick(L.outfit), pants: pick(L.pants),
      hat: R() < 0.5 ? 'none' : pick(L.hat), glasses: R() < 0.65 ? 'none' : pick(L.glasses) };
  }
  function newRace(park, demo) {
    const seed = (Math.random() * 1e9) | 0, R = Park.rng(seed + 7), T = buildTrack(park, seed);
    const pi = PARKS.indexOf(park);
    const names = BOARD.map(b => b[0]).sort(() => R() - 0.5).slice(0, 5);
    const startZ = 6 * SEG;
    const rivals = names.map((name, k) => ({
      name, av: randomLook(R), floatie: Park.FLOATIES[Math.floor(R() * Park.FLOATIES.length)][0], glider: Park.GLIDERS[Math.floor(R() * Park.GLIDERS.length)][0],
      z: startZ + (k + 1) * SEG * 1.3, x: k % 2 ? 0.45 : -0.45, speed: 0, base: 0.89 + k * 0.026 + pi * 0.02 + R() * 0.03,
      lane: 0, laneT: 0, slowT: 0, boostT: 0, done: false, alt: A0, ringI: 0, err: (R() - 0.5) * 2.4,
    }));
    return {
      park, T, demo: !!demo, t: 0, phase: demo ? 'go' : 'count', count: 3.5, section: 1, bgX: 0,
      player: { z: startZ, x: 0, vx: 0, speed: 0, h: 0, vh: 0, boostT: 0, meter: 0.34, stars: 0, rings: 0, wallCd: 0, alt: A0, steer: 0, ringI: 0 },
      rivals, finished: [], place: 0, splashT: 0, splashPts: 0, splashName: '', banner: null, flash: 0,
      particles: [], floats: [], bumpCd: 0, hintCd: 0,
    };
  }

  // ---------- input ----------
  const keys = { left: false, right: false };
  const ptrs = new Map();
  function steerInput() {
    let l = keys.left, r = keys.right;
    for (const side of ptrs.values()) { if (side < 0) l = true; else r = true; }
    return (r ? 1 : 0) - (l ? 1 : 0);
  }
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = true;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = true;
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) action(); }
    else if (k === 'Enter' && !$('#results').hidden && !document.querySelector('.pk-ov')) { startRace(race ? race.park : currentPark()); }
    else return;
    if (race && !race.demo) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; ptrs.clear(); });
  cv.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, e.clientX < W / 2 ? -1 : 1); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, e.clientX < W / 2 ? -1 : 1); });
  const up = (e) => ptrs.delete(e.pointerId);
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  const actBtn = $('#act');
  actBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  function action() {
    const r = race;
    if (!r || r.demo || r.phase !== 'go') return;
    const p = r.player, sec = secOf(r.T, p.z);
    if (sec === 2) {
      if (p.h <= 0.01) { p.vh = 10; Park.sound('jump'); }
    } else if (p.meter >= 0.33) {
      p.meter -= 0.33; p.boostT = 1.6; Park.sound('good'); spray(r, 18, '#e0f2fe');
    } else if (r.hintCd <= 0) { floatText(r, 'Grab bubbles to boost!', '#fff'); r.hintCd = 1.5; }
  }

  // ---------- effects ----------
  function floatText(r, text, color = '#fff', big) { r.floats.push({ text, color, x: W / 2, y: HORIZ + K * 0.55, life: 1.2, big }); }
  function spray(r, n, color) {
    const y = HORIZ + K;
    for (let i = 0; i < n; i++) r.particles.push({ x: W / 2 + (Math.random() - 0.5) * K * 0.5, y, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 320 - 80, life: 0.7, max: 0.7, rad: 2 + Math.random() * 4, c: color });
  }
  function sparkle(r, x, y, color) {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; r.particles.push({ x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 0.5, max: 0.5, rad: 3, c: color, g: 0 }); }
  }

  // ---------- update ----------
  function update(dt) {
    const r = race; if (!r) return;
    r.t += dt;
    const p = r.player, T = r.T;
    if (r.phase === 'count') {
      const before = Math.ceil(r.count - 0.5);
      r.count -= dt;
      const after = Math.ceil(r.count - 0.5);
      if (after !== before && after > 0) Park.sound('pop');
      if (r.count <= 0.5) { r.phase = 'go'; Park.sound('win'); r.banner = { text: 'Section 1: ' + SECTION[1], sub: 'Steer round the bends!', t: 2.4 }; }
    } else if (r.phase === 'go') {
      const sec = secOf(T, p.z);
      if (sec !== r.section) enterSection(r, sec);
      if (sec < 3) updateSlide(r, dt); else updateAir(r, dt);
      updateRivals(r, dt);
    } else if (r.phase === 'splash') {
      r.splashT += dt; updateRivals(r, dt);
      if (r.splashT > 2.2 && !r.demo) { r.phase = 'done'; finishRace(); }
      if (r.splashT > 2.2 && r.demo) race = newRace(r.park, true);
    }
    // effects
    for (const q of r.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 700) * dt; }
    r.particles = r.particles.filter(q => q.life > 0);
    for (const f of r.floats) { f.life -= dt; f.y -= 40 * dt; }
    r.floats = r.floats.filter(f => f.life > 0);
    if (r.banner) { r.banner.t -= dt; if (r.banner.t <= 0) r.banner = null; }
    r.flash = Math.max(0, r.flash - dt * 1.5);
    r.bumpCd -= dt; r.hintCd -= dt;
  }
  function enterSection(r, sec) {
    r.section = sec;
    const p = r.player;
    if (sec === 2) {
      r.banner = { text: 'Section 2: ' + SECTION[2], sub: 'Dodge rocks · JUMP the logs!', t: 2.8 };
      Park.sound('good');
    } else if (sec === 3) {
      r.banner = { text: 'Section 3: ' + SECTION[3] + '!', sub: 'Fly through rings · land on the target!', t: 3 };
      p.speed = AIRSPEED * 1.25; p.h = 0; p.vh = 0; r.flash = 1;
      Park.sound('jump'); setTimeout(() => Park.sound('good'), 160);
    }
    if (!r.demo) actBtn.textContent = sec === 2 ? '⤴️ Jump' : '🚀 Boost';
  }
  function autoSteer(r, sec) {
    const p = r.player, T = r.T;
    let target;
    if (sec < 3) {
      target = 0;
      for (let k = 1; k < 8; k++) { const s = T.segs[Math.floor(p.z / SEG) + k]; if (s) for (const it of s.items) { if (it.t === 'rock') target = it.x > 0 ? -0.5 : 0.5; if (it.t === 'log' && k < 5 && p.h <= 0) p.vh = 10; } }
      target += segAt(T, p.z).curve * 0.05;
    } else {
      const ring = T.rings[p.ringI];
      target = ring ? ring.x : T.targetX;
    }
    const d = target - p.x;
    return Math.abs(d) < 0.08 ? 0 : Math.sign(d);
  }
  function updateSlide(r, dt) {
    const p = r.player, T = r.T, seg = segAt(T, p.z);
    const pct = p.speed / MAXSPEED, steer = r.demo ? autoSteer(r, seg.sec) : steerInput();
    p.steer = lerp(p.steer, steer, Math.min(1, dt * 8));
    const dx = dt * 2.4 * Math.min(1, 0.35 + pct);
    p.x += steer * dx;
    p.x -= dx * pct * seg.curve * 0.13;          // the bend pushes you to the outside
    p.x += p.vx * dt; p.vx *= Math.pow(0.03, dt);
    r.bgX += seg.curve * pct * dt * 14;
    // speed: gravity pulls you down the slide, big drops make you fly
    const slope = (seg.y2 - seg.y1) / SEG;
    let cap = MAXSPEED * (p.boostT > 0 ? 1.45 : 1);
    if (slope < -0.3) cap *= 1.3;
    p.speed += MAXSPEED * 0.4 * dt - slope * MAXSPEED * 0.9 * dt;
    if (p.speed > cap) p.speed = Math.max(cap, p.speed - MAXSPEED * 0.9 * dt);
    p.speed = Math.max(p.speed, MAXSPEED * 0.3);
    // walls
    if (Math.abs(p.x) > 1) {
      const sg = Math.sign(p.x);
      p.x = sg * 0.97; p.vx = -sg * 1.6;
      if (p.wallCd <= 0) { p.speed *= 0.8; p.wallCd = 0.45; if (!r.demo) { Park.sound('bad'); floatText(r, 'Bonk!', '#fde68a'); } spray(r, 8, '#fff'); }
    }
    p.wallCd -= dt;
    // jumping
    if (p.h > 0 || p.vh > 0) { p.vh -= 30 * dt; p.h += p.vh * dt; if (p.h <= 0) { p.h = 0; p.vh = 0; spray(r, 14, '#e0f2fe'); if (!r.demo) Park.sound('splash'); } }
    p.boostT -= dt;
    if (p.boostT > 0 && Math.random() < dt * 30) spray(r, 1, '#fff');
    // move & pick things up
    const oldI = Math.floor(p.z / SEG);
    p.z = Math.min(p.z + p.speed * dt, T.airStart + 1);
    const newI = Math.floor(p.z / SEG);
    for (let i = oldI + 1; i <= newI; i++) { const s = T.segs[i]; if (s) for (const it of s.items) touchItem(r, it); }
    // bump rivals
    for (const rv of r.rivals) {
      if (rv.done || secOf(T, rv.z) === 3) continue;
      if (Math.abs(rv.z - p.z) < SEG * 1.5 && Math.abs(rv.x - p.x) < 0.32) {
        const sg = Math.sign(p.x - rv.x) || 1;
        p.vx += sg * 1.4; rv.x -= sg * 0.12;
        if (p.z < rv.z) p.speed *= 0.96; else rv.speed *= 0.9;
        if (r.bumpCd <= 0 && !r.demo) { Park.sound('pop'); floatText(r, 'Bump!', '#fbcfe8'); r.bumpCd = 0.6; }
      }
    }
  }
  function touchItem(r, it) {
    if (it.got) return;
    const p = r.player, d = Math.abs(p.x - it.x), air = p.h > 0.4, sx = W / 2, sy = HORIZ + K * 0.8;
    if (it.t === 'star' && d < 0.32) { it.got = true; p.stars++; if (!r.demo) Park.sound('coin'); sparkle(r, sx, sy, '#facc15'); }
    else if (it.t === 'bubble' && d < 0.32) { it.got = true; p.meter = Math.min(1, p.meter + 0.34); if (!r.demo) { Park.sound('pop'); floatText(r, '+Boost', '#bae6fd'); } sparkle(r, sx, sy, '#bae6fd'); }
    else if (it.t === 'pad' && d < 0.38) { it.got = true; p.boostT = Math.max(p.boostT, 1.3); if (!r.demo) { Park.sound('good'); floatText(r, 'Whoosh!', '#a5f3fc'); } spray(r, 14, '#fff'); }
    else if (it.t === 'ramp' && d < 0.4 && !air) { it.got = true; p.vh = 11; p.boostT = Math.max(p.boostT, 0.9); if (!r.demo) { Park.sound('jump'); floatText(r, 'Wheee!', '#fde68a'); } }
    else if (it.t === 'rock' && d < 0.3 && !air) { it.got = true; p.speed *= 0.55; p.vx = (p.x >= it.x ? 1 : -1) * 1.8; if (!r.demo) { Park.sound('bad'); floatText(r, 'Ouch, a rock!', '#fecaca'); } spray(r, 10, '#94a3b8'); }
    else if (it.t === 'log') {
      it.got = true;
      if (air) { p.stars++; if (!r.demo) { Park.sound('good'); floatText(r, 'Great jump! +⭐', '#bbf7d0'); } }
      else { p.speed *= 0.45; if (!r.demo) { Park.sound('bad'); floatText(r, 'Splat! Jump the logs!', '#fecaca'); } spray(r, 12, '#a16207'); }
    }
  }
  function updateAir(r, dt) {
    const p = r.player, T = r.T;
    const steer = r.demo ? autoSteer(r, 3) : steerInput();
    p.steer = lerp(p.steer, steer, Math.min(1, dt * 6));
    p.x = clamp(p.x + steer * dt * 2.6, -3.4, 3.4);
    p.boostT -= dt;
    const target = AIRSPEED * (p.boostT > 0 ? 1.4 : 1);
    p.speed += (target - p.speed) * Math.min(1, dt * 1.5);
    const oldZ = p.z;
    p.z = Math.min(T.end, p.z + p.speed * dt);
    p.alt = altAt(T, p.z);
    while (p.ringI < T.rings.length && T.rings[p.ringI].z <= p.z) {
      const ring = T.rings[p.ringI++];
      if (ring.z <= oldZ) continue;
      if (Math.abs(p.x - ring.x) < 0.6) { ring.hit = true; p.rings++; p.boostT = Math.max(p.boostT, 0.9); if (!r.demo) { Park.sound('good'); floatText(r, 'Ring! +Zoom', '#fde68a'); } sparkle(r, W / 2, HORIZ + K * 0.4, '#facc15'); }
      else ring.miss = true;
    }
    if (p.z >= T.end) land(r);
  }
  function land(r) {
    const p = r.player, T = r.T;
    r.phase = 'splash'; r.splashT = 0; p.alt = 0;
    r.place = r.finished.length + 1;
    const d = Math.abs(p.x - T.targetX);
    [r.splashPts, r.splashName] = d < 0.35 ? [100, 'BULLSEYE!'] : d < 0.8 ? [60, 'Great splash!'] : d < 1.4 ? [30, 'Nice splash!'] : [10, 'Splash!'];
    if (!r.demo) Park.sound('splash');
    for (let i = 0; i < 60; i++) { const a = -Math.PI * Math.random(); const v = 200 + Math.random() * 500; r.particles.push({ x: W / 2, y: HORIZ + K, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v, life: 1.4, max: 1.4, rad: 3 + Math.random() * 6, c: Math.random() < 0.5 ? '#fff' : '#bae6fd' }); }
    if (!r.demo) floatText(r, r.splashName + ' +' + r.splashPts, '#fff', true);
  }
  function updateRivals(r, dt) {
    const p = r.player, T = r.T, playing = r.phase === 'go';
    for (const rv of r.rivals) {
      if (rv.done) continue;
      const sec = secOf(T, rv.z);
      let target;
      if (sec < 3) {
        const s = segAt(T, rv.z), slope = (s.y2 - s.y1) / SEG;
        target = MAXSPEED * rv.base * (slope < -0.3 ? 1.28 : 1);
        if (rv.slowT > 0) { target *= 0.6; rv.slowT -= dt; } else if (Math.random() < dt * 0.07) rv.slowT = 0.7;
        rv.laneT -= dt; if (rv.laneT <= 0) { rv.lane = (Math.random() - 0.5) * 1.4; rv.laneT = 1 + Math.random() * 2; }
        rv.x += (clamp(rv.lane - s.curve * 0.04, -0.85, 0.85) - rv.x) * Math.min(1, dt * 1.2);
      } else {
        rv.boostT -= dt;
        target = AIRSPEED * (0.95 + rv.base * 0.08) * (rv.boostT > 0 ? 1.35 : 1);
        const ring = T.rings[rv.ringI];
        if (ring && ring.z <= rv.z) { rv.ringI++; if (Math.random() < 0.55) rv.boostT = 0.9; }
        const aim = T.end - rv.z < 40 * SEG ? T.targetX + rv.err : ring ? ring.x + rv.err * 0.4 : T.targetX;
        rv.x += (aim - rv.x) * Math.min(1, dt * 0.9);
        rv.alt = altAt(T, rv.z);
      }
      if (playing && !r.demo) {   // keep the race close and exciting
        const gap = rv.z - p.z;
        if (gap > 20 * SEG) target *= 0.92; else if (gap < -10 * SEG) target *= 1.12;
      }
      if (rv.speed === 0) rv.speed = target * 0.3;
      rv.speed += (target - rv.speed) * Math.min(1, dt * (r.phase === 'count' ? 0 : 1.4));
      if (r.phase === 'count') continue;
      rv.z += rv.speed * dt;
      if (rv.z >= T.end) { rv.z = T.end; rv.done = true; r.finished.push(rv); }
    }
  }

  // ---------- drawing: bits ----------
  function star(x, y, rad, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * 0.45 : rad; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.max(1, rad * 0.12); ctx.strokeStyle = '#b45309'; ctx.stroke();
  }
  function quad(x1, y1, x2, y2, x3, y3, x4, y4, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill(); }
  function text(str, x, y, size, fill = '#fff', align = 'center', stroke = 'rgba(15,23,42,.75)') {
    ctx.font = `700 ${size}px Fredoka, 'Baloo 2', sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }
  function drawDeco(t, x, y, s) {   // y = ground, s = height in px
    if (s < 3 || x < -s * 2 || x > W + s * 2) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
    switch (t) {
      case 'palm':
        ctx.strokeStyle = '#a16207'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -50, 4, -92); ctx.stroke();
        ctx.fillStyle = '#16a34a';
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.55; ctx.beginPath(); ctx.ellipse(4 + Math.cos(a) * 24, -92 + Math.sin(a) * 12 + 8, 28, 8, a, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(0, -86, 5, 0, 7); ctx.arc(9, -86, 5, 0, 7); ctx.fill(); break;
      case 'umbrella':
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-2, -70, 4, 70);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ef4444'; ctx.beginPath(); ctx.moveTo(0, -78); ctx.arc(0, -66, 40, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = '#fde68a'; ctx.fillRect(-26, -10, 52, 8); break;
      case 'jtree':
        ctx.fillStyle = '#713f12'; ctx.fillRect(-6, -60, 12, 60);
        ctx.fillStyle = '#15803d'; for (const [cx, cy, rr] of [[-22, -70, 26], [22, -70, 26], [0, -95, 30], [0, -62, 22]]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(-8, -100, 12, 0, 7); ctx.fill(); break;
      case 'flower':
        ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(0, -18, 34, 20, 0, 0, 7); ctx.fill();
        for (const [cx, cy, c] of [[-18, -26, '#f472b6'], [8, -32, '#facc15'], [20, -18, '#f472b6'], [-4, -14, '#fb923c']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill(); } break;
      case 'lavarock':
        ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-30, -40); ctx.lineTo(-5, -60); ctx.lineTo(25, -45); ctx.lineTo(40, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-5, -58); ctx.lineTo(-10, -30); ctx.lineTo(5, -12); ctx.moveTo(20, -42); ctx.lineTo(12, -20); ctx.stroke(); break;
      case 'torch':
        ctx.fillStyle = '#78350f'; ctx.fillRect(-4, -70, 8, 70);
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(0, -82, 10, 16, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(0, -78, 5, 9, 0, 0, 7); ctx.fill(); break;
      case 'pine':
        ctx.fillStyle = '#713f12'; ctx.fillRect(-5, -16, 10, 16);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.moveTo(-34 + i * 7, -14 - i * 26); ctx.lineTo(34 - i * 7, -14 - i * 26); ctx.lineTo(0, -54 - i * 26); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-10 + i * 2, -44 - i * 26); ctx.lineTo(10 - i * 2, -44 - i * 26); ctx.lineTo(0, -54 - i * 26); ctx.fill(); } break;
      case 'snowman':
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
        for (const [cy, rr] of [[-20, 20], [-52, 15], [-76, 11]]) { ctx.beginPath(); ctx.arc(0, cy, rr, 0, 7); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(0, -76); ctx.lineTo(14, -74); ctx.lineTo(0, -72); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-14, -66, 28, 5); break;
      case 'cloud':
        ctx.fillStyle = 'rgba(255,255,255,.95)'; for (const [cx, cy, rr] of [[-26, -20, 20], [0, -32, 26], [26, -20, 20], [0, -14, 22]]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill(); } break;
      case 'balloon': {
        const c = RAINBOW[Math.abs(Math.round(x)) % 6];
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -30, 0, -60); ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -80, 18, 22, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-6, -88, 4, 7, 0.3, 0, 7); ctx.fill(); break;
      }
    }
    ctx.restore();
  }
  function drawItem(it, x, y, w, r) {   // w = half-width of the water in px here
    if (it.got && it.t !== 'log' && it.t !== 'ramp') return;
    const u = w / ROADW;   // px per world unit
    const bob = Math.sin(r.t * 5 + x * 0.05) * u * 30;
    switch (it.t) {
      case 'star': star(x, y - u * 200 + bob, u * 110, '#facc15'); break;
      case 'bubble': {
        const rad = u * 105, cy = y - u * 180 + bob;
        ctx.fillStyle = 'rgba(186,230,253,.55)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, u * 14);
        ctx.beginPath(); ctx.arc(x, cy, rad, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - rad * 0.35, cy - rad * 0.35, rad * 0.25, rad * 0.15, -0.6, 0, 7); ctx.fill(); break;
      }
      case 'pad':
        for (let k = 0; k < 3; k++) {
          const yy = y - k * u * 70;
          ctx.fillStyle = k % 2 ? '#a5f3fc' : '#fff'; ctx.beginPath(); ctx.moveTo(x - u * 180, yy); ctx.lineTo(x, yy - u * 70); ctx.lineTo(x + u * 180, yy); ctx.lineTo(x + u * 180, yy + u * 30); ctx.lineTo(x, yy - u * 40); ctx.lineTo(x - u * 180, yy + u * 30); ctx.closePath(); ctx.fill();
        } break;
      case 'rock':
        ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.ellipse(x, y - u * 80, u * 170, u * 120, 0, Math.PI, 0); ctx.lineTo(x + u * 170, y); ctx.lineTo(x - u * 170, y); ctx.fill();
        ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(x - u * 50, y - u * 150, u * 60, u * 30, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - u * 200, y - u * 12, u * 400, u * 18); break;
      case 'log':
        ctx.fillStyle = '#92400e'; Park.rr(ctx, x - w * 1.05, y - u * 130, w * 2.1, u * 130, u * 60); ctx.fill();
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1, u * 12); ctx.beginPath(); ctx.moveTo(x - w * 0.9, y - u * 80); ctx.lineTo(x + w * 0.9, y - u * 80); ctx.stroke();
        ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.ellipse(x + w * 1.0, y - u * 65, u * 40, u * 62, 0, 0, 7); ctx.fill(); break;
      case 'ramp':
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(x - u * 200, y); ctx.lineTo(x + u * 200, y); ctx.lineTo(x + u * 160, y - u * 120); ctx.lineTo(x - u * 160, y - u * 120); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f97316'; ctx.fillRect(x - u * 160, y - u * 125, u * 320, u * 20);
        if (u * 100 > 8) text('⤴', x, y - u * 60, u * 100, '#fff'); break;
      case 'warn': case 'sign': {
        const label = it.t === 'warn' ? 'JUMP!' : it.text;
        ctx.fillStyle = '#475569'; ctx.fillRect(x - u * 15, y - u * 500, u * 30, u * 500);
        ctx.fillStyle = it.t === 'warn' ? '#facc15' : '#ec4899'; Park.rr(ctx, x - u * 260, y - u * 700, u * 520, u * 220, u * 40); ctx.fill();
        if (u * 120 > 6) text(label, x, y - u * 590, u * 120, '#fff', 'center', '#0f172a'); break;
      }
    }
  }
  function drawRacer(x, y, size, av, floatie, t, tilt = 0, h = 0, name) {
    if (size < 4 || x < -size || x > W + size) return;
    if (h > 0) { ctx.fillStyle = 'rgba(15,23,42,.25)'; ctx.beginPath(); ctx.ellipse(x, y + size * 0.1, size * 0.45, size * 0.1, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(x, y - h * size * 0.55); ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(0, size * 0.14, size * 0.62, size * 0.15, 0, 0, 7); ctx.fill();
    Park.drawFloatie(ctx, 0, 0, size, floatie);
    Park.drawAvatar(ctx, 0, size * 0.04, size * 0.85, av, { pose: h > 0 ? 'slide' : 'sit', t });
    ctx.restore();
    if (name && size > 34) text(name, x, y - size * 1.12 - h * size * 0.55, Math.min(18, size * 0.2), '#fff');
  }
  function drawGlideRider(x, y, S, av, glider, t, tilt = 0, name) {   // y = feet, S = avatar height
    if (S < 3 || x < -S * 2 || x > W + S * 2) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const gy = -S * 1.35;
    ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(1, S * 0.012);
    ctx.beginPath(); ctx.moveTo(-S * 0.36, gy + S * 0.06); ctx.lineTo(-S * 0.13, -S * 0.78); ctx.moveTo(S * 0.36, gy + S * 0.06); ctx.lineTo(S * 0.13, -S * 0.78); ctx.stroke();
    Park.drawGlider(ctx, 0, gy, S * 1.4, glider);
    Park.drawAvatar(ctx, 0, Math.sin(t * 3) * S * 0.03, S, av, { pose: 'jump', t });
    ctx.restore();
    if (name && S > 30) text(name, x, y - S * 1.8, Math.min(18, S * 0.22), '#fff');
  }

  // ---------- drawing: backdrops ----------
  function hillsLayer(off, baseY, amp, color, freq, seed) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, baseY + 2);
    for (let x = 0; x <= W + 20; x += 20) { const u = (x + off) * freq; ctx.lineTo(x, baseY - amp * (0.55 + 0.3 * Math.sin(u + seed) + 0.15 * Math.sin(u * 2.7 + seed * 2))); }
    ctx.lineTo(W, baseY + 2); ctx.closePath(); ctx.fill();
  }
  function drawSky(r) {
    const park = r.park;
    const g = ctx.createLinearGradient(0, 0, 0, HORIZ); g.addColorStop(0, park.sky[0]); g.addColorStop(1, park.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZ + 1);
    const off = r.bgX;
    ctx.fillStyle = park.sun; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(W * 0.78 - off * 0.05, HORIZ * 0.38, Math.min(W, H) * 0.06, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (park.id === 'sky') {
      ctx.lineWidth = Math.min(W, H) * 0.025;
      RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(W * 0.35 - off * 0.1, HORIZ, Math.min(W, H) * 0.42 - i * ctx.lineWidth, Math.PI, 0); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 4; i++) {   // clouds
      const cx = ((i * 337 + r.t * 8 - off * 0.2) % (W + 300) + W + 300) % (W + 300) - 150;
      drawDeco('cloud', cx, HORIZ * (0.25 + (i % 3) * 0.17), 60 + (i % 2) * 30);
    }
    if (park.id === 'volcano') {
      const vx = W * 0.3 - off * 0.15;
      ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.moveTo(vx - HORIZ * 0.9, HORIZ); ctx.lineTo(vx - HORIZ * 0.18, HORIZ * 0.35); ctx.lineTo(vx + HORIZ * 0.18, HORIZ * 0.35); ctx.lineTo(vx + HORIZ * 0.9, HORIZ); ctx.fill();
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(vx - HORIZ * 0.18, HORIZ * 0.35); ctx.lineTo(vx + HORIZ * 0.18, HORIZ * 0.35); ctx.lineTo(vx + HORIZ * 0.05, HORIZ * 0.6); ctx.lineTo(vx - HORIZ * 0.1, HORIZ * 0.5); ctx.fill();
      ctx.fillStyle = 'rgba(120,113,108,.6)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(vx + Math.sin(r.t + i) * 10, HORIZ * 0.3 - i * HORIZ * 0.08 - (r.t * 10 % 20), HORIZ * 0.05 + i * 4, 0, 7); ctx.fill(); }
    }
    if (park.id === 'ice') {
      for (let i = 0; i < 5; i++) {
        const mx = ((i * W * 0.3 - off * 0.2) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.2, mh = HORIZ * (0.45 + (i % 3) * 0.12);
        ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(mx - mh, HORIZ); ctx.lineTo(mx, HORIZ - mh); ctx.lineTo(mx + mh, HORIZ); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx - mh * 0.3, HORIZ - mh * 0.7); ctx.lineTo(mx, HORIZ - mh); ctx.lineTo(mx + mh * 0.3, HORIZ - mh * 0.7); ctx.fill();
      }
    }
    hillsLayer(off * 0.3, HORIZ, HORIZ * 0.22, park.hills[1], 0.006, 1);
    hillsLayer(off * 0.6, HORIZ, HORIZ * 0.12, park.hills[0], 0.011, 4);
    ctx.fillStyle = park.ground[0]; ctx.fillRect(0, HORIZ, W, H - HORIZ);
  }
  function drawTunnelBack(r) {
    const park = r.park;
    const g = ctx.createRadialGradient(W / 2, HORIZ, 5, W / 2, HORIZ, Math.max(W, H) * 0.8);
    g.addColorStop(0, park.rock); g.addColorStop(0.35, park.tunnel); g.addColorStop(1, '#020617');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = Park.rng(42);
    for (let i = 0; i < 50; i++) {   // glow-worms on the tunnel roof
      const x = ((R() * W * 1.6 - r.bgX * 0.4) % W + W) % W, y = R() * HORIZ * 1.1;
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(r.t * 2 + i)); ctx.fillStyle = park.lamps[i % park.lamps.length];
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- drawing: slide sections ----------
  function renderSlide(r, sec) {
    const park = r.park, T = r.T, p = r.player;
    const camZ = Math.max(0, p.z - PLAYERZ);
    const baseI = Math.floor(camZ / SEG), basePct = (camZ % SEG) / SEG;
    const camY = yAt(T, p.z) + CAMH, camX = p.x * ROADW;
    if (sec === 1) drawSky(r); else drawTunnelBack(r);
    let x = 0, dx = -(T.segs[baseI].curve * basePct);
    const vis = [];
    const last = Math.min(T.s2End - 1, baseI + DRAW);
    for (let i = baseI; i <= last; i++) {
      const s = T.segs[i];
      const a = proj(0, s.y1, i * SEG, camX - x, camY, camZ, 10), b = proj(0, s.y2, (i + 1) * SEG, camX - x - dx, camY, camZ, 10);
      x += dx; dx += s.curve;
      vis.push({ s, a, b });
    }
    const bucket = new Map();
    for (const rv of r.rivals) {
      if (rv.done || rv.z >= T.airStart) continue;
      const i = Math.floor(rv.z / SEG);
      if (i >= baseI && i <= last && rv.z > camZ + 60) { if (!bucket.has(i)) bucket.set(i, []); bucket.get(i).push(rv); }
    }
    // light at the end of the tunnel
    if (last === T.s2End - 1 && sec === 2) {
      const e = vis[vis.length - 1].b;
      const lg = ctx.createRadialGradient(e.x, e.y - e.w * 0.6, 2, e.x, e.y - e.w * 0.6, e.w * 2.2);
      lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.5, park.sky[1]); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.w * 0.4, e.w * 2.2, e.w * 1.9, 0, 0, 7); ctx.fill();
    }
    for (let k = vis.length - 1; k >= 0; k--) {
      const { s, a, b } = vis[k];
      if (a.cz <= 10) continue;
      const alt = Math.floor(s.i / 3) % 2;
      if (s.i === T.s1End && sec === 1) drawPortal(r, a);
      if (b.y < a.y) {
        if (s.sec === 1) { ctx.fillStyle = park.ground[alt]; ctx.fillRect(0, b.y, W, a.y - b.y + 1); }
        else { ctx.fillStyle = alt ? park.tunnel : '#020617'; ctx.fillRect(0, b.y, W, a.y - b.y + 1); }
        // water
        let wc = park.water[alt];
        if (s.sec === 2 && s.i % 6 === 0) wc = '#bae6fd';
        quad(a.x - a.w, a.y, a.x + a.w, a.y, b.x + b.w, b.y + 0.5, b.x - b.w, b.y + 0.5, wc);
        // walls of the flume
        const wallC = park.rainbow ? RAINBOW[Math.floor(s.i / 2) % 6] : s.sec === 2 ? (alt ? park.rock : park.tunnel) : park.slide[alt];
        const lipC = s.sec === 2 ? park.lamps[0] : park.lip;
        for (const sd of [-1, 1]) {
          quad(a.x + sd * a.w, a.y, a.x + sd * a.w * 1.3, a.y - a.w * 0.45, b.x + sd * b.w * 1.3, b.y - b.w * 0.45, b.x + sd * b.w, b.y, wallC);
          quad(a.x + sd * a.w * 1.3, a.y - a.w * 0.45, a.x + sd * a.w * 1.36, a.y - a.w * 0.47, b.x + sd * b.w * 1.36, b.y - b.w * 0.47, b.x + sd * b.w * 1.3, b.y - b.w * 0.45, lipC);
        }
      }
      // sprites in this segment, back to front
      for (const d of s.deco) drawDeco(d.t, a.x + a.w * d.x, a.y, a.s * K * d.size);
      for (const it of s.items) drawItem(it, a.x + a.w * it.x, a.y, a.w, r);
      const list = bucket.get(s.i);
      if (list) {
        list.sort((m, n) => n.z - m.z);
        for (const rv of list) {
          const f = (rv.z % SEG) / SEG, sx = lerp(a.x, b.x, f), sy = lerp(a.y, b.y, f), ww = lerp(a.w, b.w, f);
          drawRacer(sx + ww * rv.x, sy, ww / ROADW * RACER_W, rv.av, rv.floatie, r.t, 0, 0, rv.name);
        }
      }
      // tunnel ribs with lamps
      if (s.sec === 2 && s.i % 8 === 0) {
        ctx.strokeStyle = park.rock; ctx.lineWidth = Math.max(1, a.w * 0.12);
        const cy = a.y - a.w * 0.2, rx = a.w * 1.6, ry = a.w * 1.45;
        ctx.beginPath(); ctx.ellipse(a.x, cy, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
        for (let j = 1; j < 8; j++) {
          const ang = Math.PI + j * Math.PI / 8, lx = a.x + Math.cos(ang) * rx, ly = cy + Math.sin(ang) * ry, lc = park.lamps[(j + s.i) % park.lamps.length];
          ctx.fillStyle = lc; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(lx, ly, a.w * 0.12, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(lx, ly, a.w * 0.045, 0, 7); ctx.fill();
        }
      }
    }
    // the player
    const bob = Math.sin(r.t * 7) * 2;
    drawRacer(W / 2, HORIZ + K + bob, (DEPTH / PLAYERZ) * K * RACER_W, Park.state.avatar, Park.state.floatie, r.t, p.steer * 0.18, p.h);
    if (p.boostT > 0) { ctx.globalAlpha = 0.6; for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - K * 0.5 + i * K * 0.33, HORIZ + K + 10 + ((r.t * 400 + i * 30) % 40), 3, 14); } ctx.globalAlpha = 1; }
  }
  function drawPortal(r, a) {
    const park = r.park, cy = a.y - a.w * 0.2, rx = a.w * 1.55, ry = a.w * 1.45;
    ctx.fillStyle = park.rock;
    ctx.beginPath(); ctx.rect(a.x - a.w * 3.4, a.y - a.w * 2.6, a.w * 6.8, a.w * 2.6);
    ctx.ellipse(a.x, cy, rx, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill('evenodd');
    const g = ctx.createRadialGradient(a.x, cy, 2, a.x, cy, rx); g.addColorStop(0, park.tunnel); g.addColorStop(1, '#020617');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, cy, rx, ry, 0, Math.PI, Math.PI * 2); ctx.lineTo(a.x + rx, a.y); ctx.lineTo(a.x - rx, a.y); ctx.closePath(); ctx.fill();
    for (let j = 1; j < 10; j++) { const ang = Math.PI + j * Math.PI / 10; ctx.fillStyle = park.lamps[j % park.lamps.length]; ctx.beginPath(); ctx.arc(a.x + Math.cos(ang) * rx * 1.08, cy + Math.sin(ang) * ry * 1.08, a.w * 0.06, 0, 7); ctx.fill(); }
    if (a.w > 20) text('TUNNEL RAPIDS', a.x, a.y - a.w * 2.1, a.w * 0.36, '#fde68a');
  }

  // ---------- drawing: the big launch ----------
  function renderAir(r) {
    const park = r.park, T = r.T, p = r.player;
    const camZ = p.z - PLAYERZ, camX = p.x * ROADW, camY = p.alt + CAMH;
    drawSky(r);
    // ground stripes rushing by
    const step = SEG * 3;
    for (let zb = Math.ceil((camZ + 50) / step) * step, k = 0; k < 200; k++, zb += step) {
      const y0 = HORIZ + DEPTH / (zb - camZ) * camY * K, y1 = HORIZ + DEPTH / (zb + step - camZ) * camY * K;
      if (y0 - y1 < 0.4) break;
      if (y1 >= H) continue;
      if (Math.round(zb / step) % 2) { ctx.fillStyle = park.ground[1]; ctx.fillRect(0, y1, W, Math.min(H, y0) - y1 + 0.5); }
    }
    // the big pool and the target
    const ring = (cx, rx, rz, fill, stroke, lw) => {
      // circle on the ground, clipped against the camera's near plane so it never folds over
      const nearZ = camZ + 120, pts = [], out = [];
      for (let k = 0; k < 48; k++) { const th = k / 48 * Math.PI * 2; pts.push([cx + rx * Math.cos(th), T.end + rz * Math.sin(th)]); }
      for (let k = 0; k < 48; k++) {
        const P = pts[k], Q = pts[(k + 1) % 48], pin = P[1] >= nearZ, qin = Q[1] >= nearZ;
        if (pin) out.push(P);
        if (pin !== qin) { const f = (nearZ - P[1]) / (Q[1] - P[1]); out.push([P[0] + (Q[0] - P[0]) * f, nearZ]); }
      }
      if (out.length < 3) return;
      ctx.beginPath();
      out.forEach(([wx, wz], k) => { const q = proj(wx, 0, wz, camX, camY, camZ); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    };
    if (T.end + POOL_RZ - camZ > 0) {
      ring(0, POOL_R * 1.15, POOL_RZ * 1.2, '#fde68a');
      ring(0, POOL_R, POOL_RZ, park.water[1], '#fff', 3);
      const tx = T.targetX * ROADW;
      ring(tx, 1.4 * ROADW, 1.4 * ROADW, 'rgba(255,255,255,.85)');
      ring(tx, 0.8 * ROADW, 0.8 * ROADW, '#f472b6');
      ring(tx, 0.35 * ROADW, 0.35 * ROADW, '#facc15', '#fff', 2);
    }
    // sprites: scenery, rings, rivals — far to near
    const sprites = [];
    const i0 = Math.max(T.s2End, Math.floor(camZ / SEG)), i1 = Math.min(T.segs.length - 1, i0 + DRAW * 3);
    for (let i = i0; i <= i1; i++) for (const d of T.segs[i].deco) sprites.push({ z: i * SEG, d });
    for (const rg of T.rings) if (rg.z > camZ + 80 && !rg.hit) sprites.push({ z: rg.z, rg });
    for (const rv of r.rivals) if (rv.z >= T.airStart && rv.z > camZ + 80 && !rv.done) sprites.push({ z: rv.z, rv });
    sprites.sort((m, n) => n.z - m.z);
    for (const sp of sprites) {
      if (sp.d) { const q = proj(sp.d.x * ROADW, 0, sp.z, camX, camY, camZ); drawDeco(sp.d.t, q.x, q.y, q.s * K * sp.d.size); }
      else if (sp.rg) {
        const q = proj(sp.rg.x * ROADW, altAt(T, sp.rg.z) + 260, sp.rg.z, camX, camY, camZ), rad = q.s * K * 560;
        if (rad < 1.5) continue;
        ctx.lineWidth = Math.max(2, rad * 0.16); ctx.strokeStyle = sp.rg.miss ? 'rgba(148,163,184,.6)' : '#facc15';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, rad, rad * 0.95, 0, 0, 7); ctx.stroke();
        if (!sp.rg.miss) { ctx.lineWidth = Math.max(1, rad * 0.05); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(q.x, q.y, rad * 0.92, rad * 0.87, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke(); }
      } else {
        const rv = sp.rv, q = proj(rv.x * ROADW, rv.alt, rv.z, camX, camY, camZ);
        drawGlideRider(q.x, q.y, q.s * K * RIDER_H, rv.av, rv.glider, r.t, 0, rv.name);
      }
    }
    // player's shadow on the ground shows where you'll land
    const sh = proj(camX, 0, p.z, camX, camY, camZ, 60);
    if (r.phase !== 'splash' && sh.y < H) { ctx.fillStyle = 'rgba(15,23,42,.3)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, Math.max(3, sh.s * K * 260), Math.max(1.5, sh.s * K * 90), 0, 0, 7); ctx.fill(); }
    const S = (DEPTH / PLAYERZ) * K * RIDER_H;
    if (r.phase === 'splash') {
      const sink = Math.min(1, r.splashT * 1.5);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HORIZ + K + S * 0.1); ctx.clip();
      drawGlideRider(W / 2, HORIZ + K + sink * S * 0.9, S, Park.state.avatar, Park.state.glider, r.t, 0);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(W / 2, HORIZ + K + S * 0.1, S * (0.6 + r.splashT * 0.8), S * (0.15 + r.splashT * 0.1), 0, 0, 7); ctx.fill();
    } else {
      drawGlideRider(W / 2, HORIZ + K + Math.sin(r.t * 2.5) * 4, S, Park.state.avatar, Park.state.glider, r.t, p.steer * 0.25);
      if (p.boostT > 0) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const lx = (i * 173 + r.t * 900) % W; ctx.beginPath(); ctx.moveTo(lx, H * 0.2 + i * 40); ctx.lineTo(lx + 30, H * 0.2 + i * 40); ctx.stroke(); } ctx.globalAlpha = 1; }
    }
  }

  // ---------- HUD ----------
  function placeNow(r) {
    if (r.place) return r.place;
    let n = 1; for (const rv of r.rivals) if (rv.done || rv.z > r.player.z) n++;
    return n;
  }
  function drawHud(r) {
    const p = r.player, T = r.T, small = W < 500, fs = small ? 22 : 30;
    // position
    const pl = placeNow(r);
    text(ORD[pl], 16, hudTop + fs * 0.7, fs * 1.3, pl === 1 ? '#fde047' : '#fff', 'left');
    const ow = ctx.measureText(ORD[pl]).width;
    text('of 6', 16 + ow + 8, hudTop + fs * 0.85, fs * 0.6, '#fff', 'left');
    // stars, rings
    const sec = secOf(T, p.z);
    text('⭐ ' + p.stars + (sec === 3 || p.rings ? '   💍 ' + p.rings : ''), W - 16, hudTop + fs * 0.6, fs * 0.8, '#fff', 'right');
    // boost meter (3 chunks)
    if (sec !== 2) {
      const bw = small ? 26 : 34, bx = W - 16 - bw * 3 - 8, by = hudTop + fs * 1.3;
      for (let i = 0; i < 3; i++) {
        const fill = clamp((p.meter - i * 0.333) / 0.333, 0, 1);
        ctx.fillStyle = 'rgba(15,23,42,.45)'; Park.rr(ctx, bx + i * (bw + 4), by, bw, 12, 6); ctx.fill();
        ctx.fillStyle = fill >= 1 ? '#38bdf8' : '#7dd3fc'; if (fill > 0) { Park.rr(ctx, bx + i * (bw + 4), by, bw * fill, 12, 6); ctx.fill(); }
      }
      text('boost', bx - 6, by + 6, small ? 13 : 15, '#e0f2fe', 'right');
    }
    // progress strip: 3 sections + racers
    const px0 = 16, px1 = W - 16, py = hudTop + fs * 2.3, len = px1 - px0;
    const cut1 = T.s1End * SEG / T.end, cut2 = T.airStart / T.end;
    const cols = ['#f472b6', '#6366f1', '#facc15'];
    [[0, cut1], [cut1, cut2], [cut2, 1]].forEach(([a, b], i) => {
      ctx.fillStyle = cols[i]; ctx.globalAlpha = sec === i + 1 ? 1 : 0.55; Park.rr(ctx, px0 + a * len + 1, py, (b - a) * len - 2, 10, 5); ctx.fill();
    });
    ctx.globalAlpha = 1;
    for (const rv of r.rivals) { const fx = px0 + clamp(rv.z / T.end, 0, 1) * len; ctx.fillStyle = rv.av.outfit; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, py + 5, 6, 0, 7); ctx.fill(); ctx.stroke(); }
    const fx = px0 + clamp(p.z / T.end, 0, 1) * len;
    ctx.fillStyle = Park.state.avatar.outfit; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, py + 5, 9, 0, 7); ctx.fill(); ctx.stroke();
    text('🏊', px1, py - 12, 16, '#fff', 'right');
    // warnings
    if (sec === 2) {
      const i0 = Math.floor(p.z / SEG);
      for (let k = 1; k < 26; k++) { const s = T.segs[i0 + k]; if (s && s.items.some(it => it.t === 'log' && !it.got) && Math.sin(r.t * 14) > -0.3) { text('JUMP!  ⤴', W / 2, HORIZ - 20, small ? 30 : 42, '#fde047'); break; } }
    }
    if (sec === 3 && T.end - p.z < 45 * SEG && r.phase === 'go') text('🎯 Land on the target!', W / 2, HORIZ * 0.75, small ? 22 : 30, '#fde047');
  }
  function drawOverlays(r) {
    for (const q of r.particles) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.rad, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (r.demo) return;
    for (const f of r.floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); text(f.text, f.x, f.y, f.big ? Math.min(46, W * 0.09) : Math.min(28, W * 0.065), f.color); }
    ctx.globalAlpha = 1;
    if (r.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${r.flash})`; ctx.fillRect(0, 0, W, H); }
    if (r.banner) {
      const b = r.banner, a = clamp(b.t * 2, 0, 1), y = H * 0.3;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(15,23,42,.55)'; Park.rr(ctx, W / 2 - Math.min(W - 24, 560) / 2, y - 44, Math.min(W - 24, 560), 92, 24); ctx.fill();
      text(b.text, W / 2, y - 12, Math.min(34, W * 0.075), '#fde047');
      text(b.sub, W / 2, y + 24, Math.min(20, W * 0.048), '#fff');
      ctx.globalAlpha = 1;
    }
    if (r.phase === 'count') {
      const n = Math.ceil(r.count - 0.5);
      text(n > 0 ? String(n) : 'SPLASH!', W / 2, H * 0.32, Math.min(120, W * 0.25), '#fde047');
      text('Hold ◀ left / right ▶ to steer', W / 2, H * 0.32 + Math.min(80, W * 0.17), Math.min(22, W * 0.05), '#fff');
    }
  }

  function render() {
    const r = race;
    if (!r) { ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0, 0, W, H); return; }
    const sec = secOf(r.T, r.player.z);
    if (sec === 3) renderAir(r); else renderSlide(r, sec);
    if (!r.demo) drawHud(r);
    drawOverlays(r);
  }

  // ---------- loop ----------
  let lastT = 0, frame = 0, debugPause = false;
  function loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000 || 0.016)); lastT = ts;
    const paused = debugPause || !!document.querySelector('.pk-ov');
    if (!paused) update(dt);
    render();
    if (++frame % 30 === 0 && !$('#menu').hidden) drawMe();
    requestAnimationFrame(loop);
  }

  // ---------- screens ----------
  function currentPark() { return PARKS.find(p => p.id === G().park && unlocked(p)) || PARKS[0]; }
  function startRace(park) {
    G().park = park.id; Park.save();
    $('#menu').hidden = true; $('#results').hidden = true;
    race = newRace(park, false);
    actBtn.textContent = '🚀 Boost'; actBtn.style.display = 'block';
    keys.left = keys.right = false; ptrs.clear();
  }
  function showMenu() {
    $('#results').hidden = true; $('#menu').hidden = false; actBtn.style.display = 'none';
    race = newRace(currentPark(), true);
    renderParks(); drawMe();
    $('#menuChart').innerHTML = chartHtml(G().total, G().total) + `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="topBtn">🏆 Top 10 Sliders</button></div>`;
    $('#topBtn').onclick = () => Park.modal('🏆 Top 10 Sliders', top10Html());
  }
  function renderParks() {
    const cur = currentPark(), box = $('#parks');
    box.innerHTML = PARKS.map((p, i) => {
      const ok = unlocked(p), best = G().parkBest[p.id];
      return `<div class="pcard ${ok ? '' : 'locked'} ${p === cur ? 'on' : ''}" data-i="${i}" style="background:${p.card}">
        <span class="em">${ok ? p.emoji : '🔒'}</span>${p.name}
        <small>${ok ? `×${p.mult} points${best ? ` · best ${best}` : ''}` : `Unlocks at ${p.need} chart pts`}</small></div>`;
    }).join('');
    box.querySelectorAll('.pcard').forEach(el => el.onclick = () => {
      const p = PARKS[+el.dataset.i];
      if (!unlocked(p)) { Park.toast(`🔒 Get ${p.need} points on the Splash Chart to open ${p.name}!`); Park.sound('bad'); return; }
      G().park = p.id; Park.save(); Park.sound('pop'); renderParks(); race = newRace(p, true);
    });
    $('#goBtn').textContent = `🏁 Race in ${cur.name}!`;
  }
  function drawMe() {
    const c = $('#me'); if (!c) return;
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    Park.drawGlider(x, 150, 70, 200);
    Park.drawFloatie(x, 150, 270, 200);
    Park.drawAvatar(x, 150, 274, 170, Park.state.avatar, { pose: 'sit' });
  }
  function msIcon(m) { return m.park ? '🔓' : m.diamonds ? '💎' : m.title ? '👑' : '🪙'; }
  function msText(m) { return [m.coins ? `🪙 ${m.coins}` : '', m.diamonds ? `💎 ${m.diamonds}` : '', m.park ? `opens ${PARKS[m.park].name}` : '', m.title ? `“${m.title}”` : ''].filter(Boolean).join(' + '); }
  function chartHtml(oldT, newT) {
    let iLo = -1; MILESTONES.forEach((m, i) => { if (m.at <= oldT) iLo = i; });
    let iHi = MILESTONES.findIndex(m => m.at > newT); if (iHi < 0) iHi = MILESTONES.length - 1;
    iHi = Math.min(MILESTONES.length - 1, Math.max(iHi + 1, iLo + 3));
    const lo = iLo >= 0 ? MILESTONES[iLo].at : 0, hi = MILESTONES[iHi].at, pct = (v) => clamp((v - lo) / (hi - lo) * 100, 0, 100);
    const marks = MILESTONES.slice(iLo + 1, iHi + 1).map(m => `<div class="ch-mk ${m.at <= oldT ? 'got' : ''}" data-at="${m.at}" style="left:${pct(m.at)}%">${msIcon(m)}<span>${m.at}</span></div>`).join('');
    const next = MILESTONES.find(m => m.at > newT);
    return `<div class="chart"><div class="ch-head"><b>📈 Splash Chart</b><span><span class="ch-total">${oldT}</span> pts</span></div>
      <div class="ch-track"><div class="ch-fill" style="width:${pct(oldT)}%" data-to="${pct(newT)}"></div>${marks}</div>
      <div class="ch-next">${next ? `Next: <b>${next.at}</b> pts → ${msText(next)}` : 'You topped the chart!'}</div></div>`;
  }
  function top10Html(highlight) {
    const g = G();
    const rows = BOARD.map(([n, s]) => ({ n, s })).concat(g.best ? [{ n: '⭐ You', s: g.best, you: true }] : []);
    rows.sort((a, b) => b.s - a.s);
    const top = rows.slice(0, 10);
    let html = '<table class="top">' + top.map((r, i) => `<tr class="${r.you ? 'you' : ''}"><td>${i + 1}</td><td>${Park.esc(r.n)}</td><td>${r.s}</td></tr>`).join('') + '</table>';
    if (g.best && !top.some(r => r.you)) html += `<p style="text-align:center">Your best: <b>${g.best}</b> — beat <b>${top[9].s}</b> to get on the chart!</p>`;
    if (!g.best) html += '<p style="text-align:center">Finish a race to get on the board!</p>';
    if (highlight) html = `<p style="text-align:center;font-weight:700;color:#7c3aed">${highlight}</p>` + html;
    return html;
  }
  function finishRace() {
    const r = race, p = r.player, park = r.park, g = G();
    const pos = r.place, placePts = PLACE_PTS[pos - 1], starPts = p.stars * 5, ringPts = p.rings * 15;
    const raw = placePts + starPts + ringPts + r.splashPts, pts = Math.round(raw * park.mult);
    const oldT = g.total, oldBoardPos = boardPos(g.best);
    g.total += pts; g.races++; if (pos === 1) g.wins++;
    const newBest = pts > g.best; if (newBest) g.best = pts;
    g.parkBest[park.id] = Math.max(g.parkBest[park.id] || 0, pts);
    const coins = Math.max(5, Math.round(pts / 8)), diamonds = pos === 1 ? (PARKS.indexOf(park) >= 2 ? 2 : 1) : 0;
    const reached = [];
    while (g.claimed < MILESTONES.length && MILESTONES[g.claimed].at <= g.total) reached.push(MILESTONES[g.claimed++]);
    Park.save();
    Park.addCoins(coins); if (diamonds) Park.addDiamonds(diamonds);
    let mc = 0, md = 0; for (const m of reached) { mc += m.coins || 0; md += m.diamonds || 0; }
    if (mc || md) setTimeout(() => { if (mc) Park.addCoins(mc); if (md) Park.addDiamonds(md); }, 2000);
    if (pos <= 3) { Park.confetti(); Park.sound('win'); }
    const newBoard = boardPos(g.best);
    const boardMsg = newBest && newBoard <= 10 && newBoard < oldBoardPos ? `🎉 New best! You're #${newBoard} on the Top 10!` : newBest ? '🎉 New personal best!' : '';
    actBtn.style.display = 'none';
    const ov = $('#results');
    ov.innerHTML = `<div class="wrap">
      <div class="card res-head"><div class="medal">${MEDAL[pos]}</div><h2>${ORD[pos]} place!</h2><div>${park.emoji} ${park.name}</div></div>
      <div class="card"><div class="lines">
        <div><span>🏁 Finished ${ORD[pos]}</span><b>+${placePts}</b></div>
        <div><span>⭐ Stars ${p.stars} × 5</span><b>+${starPts}</b></div>
        <div><span>💍 Rings ${p.rings} × 15</span><b>+${ringPts}</b></div>
        <div><span>🎯 ${r.splashName}</span><b>+${r.splashPts}</b></div>
        ${park.mult > 1 ? `<div><span>${park.emoji} Park bonus</span><b>×${park.mult}</b></div>` : ''}
        <div class="tot"><span>Points</span><span>${pts}</span></div>
      </div>
      <div class="gain">+🪙 ${coins}${diamonds ? ` &nbsp; +💎 ${diamonds} for winning!` : ''}</div></div>
      <div class="card">${chartHtml(oldT, g.total)}</div>
      <div class="card"><h3>🏆 Top 10 Sliders</h3>${top10Html(boardMsg)}</div>
      <div class="row" style="justify-content:center">
        <button class="go" id="againBtn" style="width:auto;flex:1 1 200px">🔁 Race again</button>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn pink" id="parksBtn">🗺️ Parks</button>
        <button class="btn pink" id="shopBtn">🛍️ Shop</button>
      </div></div>`;
    ov.hidden = false; ov.scrollTop = 0;
    $('#againBtn').onclick = () => startRace(park);
    $('#parksBtn').onclick = showMenu;
    $('#shopBtn').onclick = () => Park.openShop('floatie');
    animateChart(ov, oldT, g.total, reached, oldT);
  }
  function boardPos(score) { if (!score) return 99; return 1 + BOARD.filter(b => b[1] > score).length; }
  function animateChart(root, from, to, reached) {
    const fill = root.querySelector('.ch-fill'), tot = root.querySelector('.ch-total');
    setTimeout(() => { fill.style.width = fill.dataset.to + '%'; }, 400);
    const t0 = Date.now() + 400, dur = 1800;
    const tick = setInterval(() => {
      const k = clamp((Date.now() - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3), v = Math.round(from + (to - from) * e);
      tot.textContent = v;
      root.querySelectorAll('.ch-mk:not(.got)').forEach(mk => { if (+mk.dataset.at <= v) { mk.classList.add('got', 'pop'); Park.sound('coin'); } });
      if (k >= 1) clearInterval(tick);
    }, 60);
    reached.forEach((m, i) => setTimeout(() => {
      Park.toast(`📈 Chart ${m.at}! ${msText(m)}`, 3000);
      if (m.park) { Park.toast(`🎉 ${PARKS[m.park].emoji} ${PARKS[m.park].name} is open!`, 3500); Park.confetti(); }
    }, 1200 + i * 900));
  }

  // ---------- boot ----------
  Park.topBar({
    title: 'Splash Slides', emoji: '🛝',
    help: `<p><b>Race 5 rivals</b> down the water park in <b>3 sections</b>:</p>
      <p>🛝 <b>1. Twisty Flume</b> — steer round the bends or you'll bonk the walls and slow down. Grab ⭐ stars, pop bubbles to fill your <b>boost</b>, ride the arrow pads.</p>
      <p>🌊 <b>2. Tunnel Rapids</b> — big drops! Dodge the rocks and <b>JUMP</b> the logs.</p>
      <p>🪂 <b>3. Big Launch</b> — fly your glider through the gold rings (each one zooms you forward) and land on the <b>🎯 target</b> in the pool. Watch your shadow!</p>
      <p><b>Controls:</b> ← → or A / D to steer, <b>Space</b> to boost (or jump in the tunnel). On iPad: hold the left or right side of the screen, and tap the big button.</p>
      <p><b>Points</b> = finish place + stars + rings + splash. They go on the <b>Splash Chart</b> to win 🪙 coins, 💎 diamonds and new parks. Spend them in the 🛍️ Shop on looks, floaties and gliders!</p>`,
  });
  document.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => Park.openShop(b.dataset.shop));
  $('#goBtn').onclick = () => startRace(currentPark());
  window.addEventListener('resize', resize);
  resize();
  showMenu();
  requestAnimationFrame(loop);

  // handy for testing from the console
  window.SplashSlides = { update, render, startRace, showMenu, finishRace, action, PARKS, MILESTONES, get race() { return race; }, keys, set pause(v) { debugPause = !!v; } };
})();
