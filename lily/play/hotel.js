// Sparkle Suites — a cosy hotel-cleaning game for Lily's Fun Park.
// You're on the hotel staff: clean beds, toilets, rubbish and towels, check guests in,
// earn 💵 and spend it on new rooms, floors, a pool, a spa… and more staff.
(() => {
  'use strict';

  // ---------- saved progress ----------
  const G = Park.game('hotel');
  const DEF = { day: 1, money: 40, stars: 3, rooms: 2, floors: 1, amen: {}, staff: { cleaner: 0, plumber: 0, receptionist: 0, porter: 0 }, tools: {}, guestsEver: 0, seenIntro: false };
  for (const k in DEF) if (G[k] === undefined) G[k] = JSON.parse(JSON.stringify(DEF[k]));
  G.staff = Object.assign({}, DEF.staff, G.staff);

  // ---------- catalogue ----------
  const AMEN = {
    restaurant: { name: 'Restaurant', emoji: '🍝', price: 300, bonus: 5, where: 'ground', side: 1, desc: 'Yummy dinners! Every guest pays +$5.' },
    games: { name: 'Games Room', emoji: '🕹️', price: 450, bonus: 5, where: 'roof', side: 1, desc: 'Arcade games on the roof. +$5 per guest, more guests come.' },
    pool: { name: 'Swimming Pool', emoji: '🏊', price: 600, bonus: 7, where: 'base', side: 0, desc: 'A splashy pool in the basement. +$7 per guest.' },
    spa: { name: 'Bubble Spa', emoji: '🫧', price: 750, bonus: 8, where: 'base', side: 1, desc: 'Hot tub and fluffy robes. +$8 per guest.' },
    garden: { name: 'Rooftop Garden', emoji: '🌻', price: 900, bonus: 9, where: 'roof', side: 0, desc: 'Flowers and fairy lights on the roof. +$9 per guest.' },
  };
  const STAFF = {
    cleaner: { name: 'Cleaner', emoji: '🧽', hire: [100, 180, 260], wage: 10, max: 3, outfit: '#14b8a6', hat: 'bow', desc: 'Makes beds and picks up rubbish, towels and spills.' },
    plumber: { name: 'Plumber', emoji: '🪠', hire: [140, 240], wage: 14, max: 2, outfit: '#2563eb', hat: 'cap', desc: 'Fixes dirty toilets and BLOCKED toilets.' },
    receptionist: { name: 'Receptionist', emoji: '🛎️', hire: [120], wage: 10, max: 1, outfit: '#8b5cf6', hat: 'none', desc: 'Checks guests in at the desk for you.' },
    porter: { name: 'Porter', emoji: '🧳', hire: [160], wage: 10, max: 1, outfit: '#dc2626', hat: 'cap', desc: 'Carries bags so guests get to rooms fast, and they tip +$3.' },
  };
  const TOOLS = {
    sneakers: { name: 'Zoomy Sneakers', emoji: '👟', price: 80, desc: 'You walk 40% faster.' },
    vacuum: { name: 'Turbo Vacuum', emoji: '🌀', price: 120, desc: 'Beds, rubbish and spills clean 60% faster (staff too).' },
    cart: { name: 'Cleaning Cart', emoji: '🛒', price: 150, desc: 'Towels and rubbish twice as fast. Staff walk faster.' },
    plunger: { name: 'Golden Plunger', emoji: '🏆', price: 200, desc: 'Blocked toilets 3× faster, toilets 50% faster.' },
  };
  const roomPrice = () => 120 + 70 * (G.rooms - 2);
  const floorPrice = () => 300 + 250 * (G.floors - 1);

  // job types: work = seconds for you at normal speed
  const JT = {
    bed: { work: 3, pay: 3, staff: 'cleaner', icon: '🛏️' },
    rubbish: { work: 1.6, pay: 2, staff: 'cleaner', icon: '🗑️' },
    towels: { work: 2, pay: 2, staff: 'cleaner', icon: '🧺' },
    toilet: { work: 3, pay: 3, staff: 'plumber', icon: '🚽' },
    blocked: { work: 10, pay: 8, staff: 'plumber', icon: '🪠' },
    spill: { work: 2.4, pay: 4, staff: 'cleaner', icon: '💦' },
    checkin: { work: 1, pay: 0, staff: 'receptionist', icon: '🛎️' },
  };
  const SPILL_ICON = { pool: '💦', restaurant: '🍝', spa: '🧴', garden: '🍂', games: '🍿' };

  // ---------- world geometry ----------
  const W = 950, SKY = 78, ROOF_H = 120, FH = 150, WALL = 10, SX = 90, SW = 210, LIFT_X = 55;
  const DOOR_X = 118, QX = 372, DESK_SX = 466, DAY_LEN = 150, LIFT_SPEED = 1.6;
  const roofLv = () => G.floors + 1;
  const yOf = (lv) => SKY + ROOF_H + (roofLv() - lv) * FH;
  const worldH = () => yOf(-1) + 46;
  const WALLS = ['#fbcfe8', '#ddd6fe', '#bbf7d0', '#fde68a', '#bae6fd', '#fed7aa', '#e9d5ff', '#ccfbf1', '#fecdd3', '#d9f99d', '#c7d2fe', '#fef08a'];
  const BLANKETS = ['#ec4899', '#8b5cf6', '#22c55e', '#f59e0b', '#0ea5e9', '#f97316', '#a855f7', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1', '#eab308'];
  function amenGeom(k) {
    const a = AMEN[k];
    const lv = a.where === 'base' ? -1 : a.where === 'ground' ? 0 : roofLv();
    return { lv, x0: SX + a.side * 420, w: 420 };
  }

  // ---------- canvas ----------
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  let view = { s: 1, ox: 0, oy: 0, w: 0, h: 0, top: 0, dpr: 1 };
  function resize() {
    const hud = document.getElementById('hud');
    const top = Math.round(hud.getBoundingClientRect().bottom + 4);
    const w = window.innerWidth, h = Math.max(120, window.innerHeight - top);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.top = top + 'px'; cv.style.height = h + 'px'; cv.style.width = w + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    view = { w, h, top, dpr, s: 1, ox: 0, oy: 0 };
    fitView();
  }
  function fitView() {
    const H = worldH();
    const s = Math.min(view.w / W, (view.h - 40) / H);
    view.s = s; view.ox = (view.w - W * s) / 2; view.oy = Math.max(0, (view.h - 40 - H * s) / 2);
  }
  window.addEventListener('resize', resize);

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rr = (x, y, w, h, r) => Park.rr(ctx, x, y, w, h, r);
  function lerpCol(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  function randAv(r = Math.random) {
    const L = Park.LOOK, pick = (a) => a[Math.floor(r() * a.length)][0];
    return {
      skin: pick(L.skin), hair: pick(L.hair), hairColor: pick(L.hairColor.slice(0, 6)), outfit: pick(L.outfit), pants: pick(L.pants),
      hat: r() < 0.3 ? pick(L.hat.slice(1, 8)) : 'none', glasses: r() < 0.25 ? pick(L.glasses.slice(1, 4)) : 'none',
    };
  }
  function staffAv(role, k) {
    const r = Park.rng(role.length * 1013 + k * 97 + 7), av = randAv(r);
    av.outfit = STAFF[role].outfit; av.pants = role === 'plumber' ? '#1e3a8a' : '#334155'; av.hat = STAFF[role].hat; av.glasses = role === 'receptionist' ? 'round' : 'none';
    return av;
  }

  // ---------- runtime state ----------
  let S = null;          // the current day
  let T = 0;             // animation clock (always ticks)
  const P = [];          // particles
  const FT = [];         // floating texts
  const ptr = { down: false, wx: 0, wy: 0, moveT: -9 };
  let jobId = 1;

  function prepDay() {
    S = {
      t: 0, running: false, rooms: [], jobs: [], guests: [], queue: [], staff: [], deco: {},
      nextGuest: G.day === 1 ? 7 : 4, amenT: {}, saveT: 0,
      stats: { earned: 0, rooms: 0, tips: 0, clean: 0, guests: 0, grumpy: 0, starsStart: G.stars },
      lily: { x: DESK_SX - 30, lv: 0, queue: [], walkTo: null, working: null, face: -1, moving: false, sparkT: 0 },
      desk: { id: 'desk', type: 'checkin', x: 420, lv: 0, dy: -52, sx: DESK_SX, face: -1, progress: 0, done: false },
      hintT: 0, rubHinted: false,
    };
    for (let i = 0; i < G.rooms; i++) {
      S.rooms.push({ i, lv: 1 + Math.floor(i / 4), x0: SX + (i % 4) * SW, num: (1 + Math.floor(i / 4)) * 100 + (i % 4) + 1, state: 'clean', jobs: [], guest: null, messySince: 0, readyT: -9 });
    }
    // the night guest left room 1 messy — something to do straight away
    makeMess(S.rooms[0], ['bed', 'toilet', 'rubbish']);
    let k = 0;
    for (const role in STAFF) for (let n = 0; n < G.staff[role]; n++) {
      const home = role === 'porter' ? { x: 165, lv: 0 } : role === 'receptionist' ? { x: DESK_SX + 14, lv: 0 } : { x: 482 + (k++ % 3) * 11, lv: 0 };
      S.staff.push({ role, av: staffAv(role, n), x: home.x, lv: 0, home, job: null, face: -1, moving: false, escort: null, t: Math.random() * 5 });
    }
    for (const a in AMEN) if (G.amen[a]) {
      const g = amenGeom(a), arr = [];
      for (let n = 0; n < 3; n++) arr.push({ av: randAv(), x: g.x0 + 60 + n * 120 + rand(-20, 20), ph: Math.random() * 6 });
      S.deco[a] = arr; S.amenT[a] = rand(15, 30);
    }
    jobsChanged();
    fitView();
  }

  function makeMess(room, forced) {
    let types = forced;
    if (!types) {
      types = ['bed'];
      const blockedChance = G.day <= 1 ? 0 : Math.min(0.18, 0.07 + G.day * 0.015);
      if (Math.random() < 0.72) types.push(Math.random() < blockedChance ? 'blocked' : 'toilet');
      if (Math.random() < 0.5) types.push('rubbish');
      if (Math.random() < 0.5 || types.length < 2) types.push('towels');
    }
    const fy = 0, x0 = room.x0;
    const POS = {
      bed: { x: x0 + 58, dy: -30, sx: x0 + 118, face: -1 },
      rubbish: { x: x0 + 128, dy: -8, sx: x0 + 108, face: 1 },
      towels: { x: x0 + 164, dy: -8, sx: x0 + 146, face: 1 },
      toilet: { x: x0 + 184, dy: -26, sx: x0 + 160, face: 1 },
      blocked: { x: x0 + 184, dy: -26, sx: x0 + 160, face: 1 },
    };
    for (const ty of types) {
      const p = POS[ty];
      const j = { id: jobId++, type: ty, room, amen: null, x: p.x, lv: room.lv, dy: p.dy + fy, sx: p.sx, face: p.face, progress: 0, claim: null, done: false, born: S.t };
      room.jobs.push(j); S.jobs.push(j);
    }
    room.state = 'messy'; room.messySince = S.t; room.guest = null;
  }

  function spawnSpill(a) {
    const g = amenGeom(a);
    const x = g.x0 + rand(50, 370);
    const j = { id: jobId++, type: 'spill', room: null, amen: a, x, lv: g.lv, dy: -8, sx: x + 20, face: -1, progress: 0, claim: null, done: false, born: S.t };
    S.jobs.push(j);
  }

  function jobsChanged() { /* hook for future */ }

  // ---------- money / rating ----------
  function earn(n, x, lv, label, kind) {
    if (n <= 0) return;
    G.money += n; S.stats.earned += n; S.stats[kind] = (S.stats[kind] || 0) + n;
    FT.push({ x, y: yOf(lv) - 80, text: (label ? label + ' ' : '') + '+$' + n, life: 1.6, col: '#15803d' });
    const chip = document.getElementById('moneyChip'); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
    Park.sound('coin');
  }
  function rate(d) { G.stars = clamp(G.stars + d, 1, 5); }
  const roomRate = () => 16 + Math.round(G.stars * 2) + Object.keys(AMEN).reduce((s, a) => s + (G.amen[a] ? AMEN[a].bonus : 0), 0);
  const amenCount = () => Object.keys(AMEN).filter((a) => G.amen[a]).length;

  // ---------- particles ----------
  function burst(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(30, 140);
      P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.5, 1.1), max: 1, kind: kind || (Math.random() < 0.5 ? 'star' : 'bubble'), col: ['#fde047', '#f9a8d4', '#a5f3fc', '#fff'][i % 4], r: rand(3, 7) });
    }
  }

  // ---------- movement ----------
  function moveEnt(e, tx, tlv, speed, dt) {
    if (Math.abs(e.lv - tlv) > 0.001) {
      if (Math.abs(e.x - LIFT_X) > 1.5) { stepX(e, LIFT_X, speed, dt); return false; }
      const d = tlv - e.lv, st = LIFT_SPEED * dt;
      e.lv = Math.abs(d) <= st ? tlv : e.lv + Math.sign(d) * st; e.moving = true; return false;
    }
    e.lv = tlv;
    if (Math.abs(e.x - tx) > 1.5) { stepX(e, tx, speed, dt); return false; }
    e.x = tx; e.moving = false; return true;
  }
  function stepX(e, tx, speed, dt) {
    const d = tx - e.x, st = speed * dt;
    e.face = d > 0 ? 1 : -1; e.x = Math.abs(d) <= st ? tx : e.x + Math.sign(d) * st; e.moving = true;
  }

  // ---------- work ----------
  function workRate(j, who) {
    let r = who === 'lily' ? 1 : 0.6;
    const t = G.tools;
    if (t.vacuum && (j.type === 'bed' || j.type === 'rubbish' || j.type === 'spill')) r *= 1.6;
    if (t.cart && (j.type === 'towels' || j.type === 'rubbish')) r *= 2;
    if (t.plunger && j.type === 'blocked') r *= 3;
    if (t.plunger && j.type === 'toilet') r *= 1.5;
    if (j.type === 'blocked' && who === 'plumber') r *= 2.2; // plumbers are experts
    if (j.type === 'checkin' && who === 'receptionist') r = 0.9;
    return r;
  }
  function workOn(j, r, dt) {
    j.progress += dt * r / JT[j.type].work; j.busy = 2;
    if (j.progress >= 1) {
      if (j === S.desk) { j.progress = 0; checkIn(); return; }
      if (!j.done) finishJob(j);
    }
  }
  function finishJob(j) {
    j.done = true;
    S.jobs = S.jobs.filter((o) => o !== j);
    const cy = yOf(j.lv) + j.dy;
    burst(j.x, cy, 16);
    Park.sound('pop');
    earn(JT[j.type].pay, j.x, j.lv, '', 'clean');
    const room = j.room;
    if (room) {
      room.jobs = room.jobs.filter((o) => o !== j);
      if (!room.jobs.length) {
        room.state = 'clean'; room.readyT = S.t;
        burst(room.x0 + 105, yOf(room.lv) - 60, 30, 'star');
        Park.sound('good');
        if (S.t - room.messySince < 22) { earn(5, room.x0 + 105, room.lv, '⚡ Speedy clean!', 'tips'); rate(0.03); }
        FT.push({ x: room.x0 + 105, y: yOf(room.lv) - 110, text: '✨ Room ' + room.num + ' ready!', life: 2, col: '#7c3aed' });
      }
    }
  }

  // ---------- guests ----------
  function spawnGuest() {
    const g = { av: randAv(), x: DOOR_X, lv: 0, state: 'queue', pat: G.day === 1 ? 90 : Math.max(55, 75 - G.day * 2), patMax: 0, waited: 0, face: 1, moving: true, alpha: 0, room: null, stay: 0, fast: false, bubble: null };
    g.patMax = g.pat;
    S.guests.push(g); S.queue.push(g); G.guestsEver++;
    Park.sound('jump');
  }
  const freeRooms = () => S.rooms.filter((r) => r.state === 'clean');
  const frontGuest = () => { const g = S.queue[0]; return g && Math.abs(g.x - QX) < 3 && g.lv === 0 ? g : null; };
  function checkIn() {
    const g = frontGuest(); if (!g) return false;
    const free = freeRooms(); if (!free.length) return false;
    free.sort((a, b) => a.lv - b.lv || a.readyT - b.readyT);
    const room = free[0];
    S.queue.shift(); g.state = 'toRoom'; g.room = room; room.state = 'booked'; room.guest = g;
    const pay = roomRate();
    let tip = 0, label = '';
    if (g.waited < 12) { tip = 8; label = '⚡ Super speedy!'; rate(0.08); }
    else if (g.waited < 28) { tip = 4; label = '😊 Quick!'; rate(0.05); }
    else rate(0.01);
    earn(pay, QX, 0, '🔑 Room ' + room.num, 'rooms');
    if (tip) setTimeout(() => S && earn(tip, QX, 0.25, label, 'tips'), 350);
    const porter = S.staff.find((s) => s.role === 'porter' && !s.escort);
    if (porter) { porter.escort = g; g.fast = true; setTimeout(() => S && earn(3, QX - 40, 0.45, '🧳', 'tips'), 700); }
    S.stats.guests++;
    g.bubble = { text: '😊', t: 1.5 };
    Park.sound('good');
    return true;
  }

  function updateGuests(dt) {
    for (const g of S.guests) {
      g.alpha = Math.min(1, g.alpha + dt * 2.5);
      if (g.bubble) { g.bubble.t -= dt; if (g.bubble.t <= 0) g.bubble = null; }
      const sp = g.fast ? 150 : 95;
      if (g.state === 'queue') {
        const idx = S.queue.indexOf(g);
        moveEnt(g, QX - idx * 30, 0, sp, dt);
        if (!g.moving) g.face = 1;
        g.waited += dt; g.pat -= dt * (S.running ? 1 : 0);
        if (g.pat <= 0) {
          S.queue = S.queue.filter((o) => o !== g); g.state = 'angry'; g.bubble = { text: '😠', t: 3 };
          rate(-0.25); S.stats.grumpy++; Park.sound('bad'); Park.toast('A guest got tired of waiting 😢');
        }
      } else if (g.state === 'toRoom') {
        if (moveEnt(g, g.room.x0 + 40, g.room.lv, sp, dt)) {
          g.state = 'inRoom'; g.room.state = 'occupied'; g.stay = rand(16, 28); g.fast = false;
        }
      } else if (g.state === 'inRoom') {
        g.stay -= dt;
        if (g.stay <= 0) {
          g.state = 'leaving'; g.x = g.room.x0 + 100; g.lv = g.room.lv; g.alpha = 0.3;
          makeMess(g.room); g.bubble = { text: '❤️', t: 2 };
          if (amenCount() && Math.random() < 0.5) g.bubble = { text: ['🏊', '🍝', '🌻', '🕹️', '🫧'][Math.floor(Math.random() * 5)] + '❤️', t: 2 };
        }
      } else if (g.state === 'leaving' || g.state === 'angry') {
        if (moveEnt(g, DOOR_X - 10, 0, g.state === 'angry' ? 130 : 95, dt)) g.state = 'gone';
      }
    }
    S.guests = S.guests.filter((g) => g.state !== 'gone');
  }

  // ---------- you (the player) ----------
  function updateLily(dt) {
    const L = S.lily;
    L.queue = L.queue.filter((j) => (j === S.desk ? S.queue.length > 0 : !j.done));
    const j = L.queue[0];
    const sp = 175 * (G.tools.sneakers ? 1.4 : 1);
    L.working = null;
    if (j) {
      L.walkTo = null;
      if (moveEnt(L, j.sx, j.lv, sp, dt)) {
        L.face = j.face; L.working = j;
        if (j === S.desk && !freeRooms().length) { L.queue.shift(); Park.toast('No clean rooms yet — clean one first! 🧹'); return; }
        if (j === S.desk && !frontGuest()) { j.waiting = true; return; }
        j.waiting = false;
        const cx = j.x, cy = yOf(j.lv) + j.dy;
        let boost = 1;
        if (ptr.down && Math.hypot(ptr.wx - cx, ptr.wy - cy) < 85) boost = T - ptr.moveT < 0.2 ? 2.6 : 1.8;
        L.boost = boost;
        workOn(j, workRate(j, 'lily') * boost, dt);
        L.sparkT -= dt;
        if (L.sparkT <= 0) { L.sparkT = boost > 1 ? 0.05 : 0.12; P.push({ x: cx + rand(-18, 18), y: cy + rand(-14, 8), vx: rand(-20, 20), vy: rand(-60, -20), life: 0.8, max: 0.8, kind: Math.random() < 0.6 ? 'bubble' : 'star', col: '#fff', r: rand(2, 5) }); }
        if (j === S.desk && L.queue[0] === S.desk && j.progress === 0 && !(S.queue.length && freeRooms().length)) L.queue.shift();
      }
    } else if (L.walkTo) {
      if (moveEnt(L, L.walkTo.x, L.walkTo.lv, sp, dt)) L.walkTo = null;
    } else L.moving = false;
  }

  // ---------- staff ----------
  function updateStaff(dt) {
    const fast = G.tools.cart ? 1.25 : 1;
    for (const st of S.staff) {
      st.t += dt;
      if (st.role === 'porter') {
        const g = st.escort;
        if (g && g.state === 'toRoom') {
          const gInLift = Math.abs(g.lv - Math.round(g.lv)) > 0.01;
          if (gInLift && Math.abs(st.x - LIFT_X) < 4) { st.x = LIFT_X; st.lv = g.lv; st.moving = true; }
          else moveEnt(st, gInLift ? LIFT_X : clamp(g.x - 22 * g.face, 30, 920), gInLift ? st.lv : g.lv, 170, dt);
        }
        else { st.escort = null; moveEnt(st, st.home.x, st.home.lv, 140, dt); if (!st.moving) st.face = 1; }
        continue;
      }
      if (st.role === 'receptionist') {
        if (moveEnt(st, st.home.x, st.home.lv, 120, dt)) {
          st.face = -1;
          if (S.running && frontGuest() && freeRooms().length) workOn(S.desk, workRate(S.desk, 'receptionist'), dt);
        }
        continue;
      }
      if (st.job && st.job.done) st.job = null;
      if (!st.job) {
        let best = null, bc = 1e9;
        for (const j of S.jobs) {
          if (j.done || j.claim || JT[j.type].staff !== st.role) continue;
          if (S.lily.working === j) continue;
          const c = Math.abs(j.lv - st.lv) * 500 + Math.abs(j.sx - st.x);
          if (c < bc) { bc = c; best = j; }
        }
        if (best) { best.claim = st; st.job = best; }
      }
      if (st.job) {
        const j = st.job;
        if (moveEnt(st, j.sx + (S.lily.working === j ? 14 : 0), j.lv, 120 * fast, dt)) {
          st.face = j.face; workOn(j, workRate(j, st.role), dt);
          if (j.done) st.job = null;
        }
      } else if (moveEnt(st, st.home.x, st.home.lv, 110 * fast, dt)) st.face = -1;
    }
  }

  // ---------- main update ----------
  function update(dt) {
    T += dt;
    for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'drop' ? 400 : 60) * dt; p.life -= dt; }
    for (let i = P.length - 1; i >= 0; i--) if (P[i].life <= 0) P.splice(i, 1);
    for (const f of FT) { f.y -= 28 * dt; f.life -= dt; }
    for (let i = FT.length - 1; i >= 0; i--) if (FT[i].life <= 0) FT.splice(i, 1);
    if (!S || !S.running) return;
    S.t += dt;
    for (const j of S.jobs) if (j.busy) j.busy--;
    S.desk.busy && S.desk.busy--;
    // guests arrive
    S.nextGuest -= dt;
    if (S.nextGuest <= 0 && S.t < DAY_LEN * 0.86) {
      if (S.queue.length < 5) spawnGuest();
      const cap = S.rooms.length + amenCount() * 0.3;
      S.nextGuest = (36 / cap) * (1.3 - (G.stars - 1) * 0.1) * rand(0.75, 1.25);
      if (G.day === 1) S.nextGuest *= 1.15;
    }
    // amenity messes
    for (const a in S.amenT) {
      S.amenT[a] -= dt;
      if (S.amenT[a] <= 0) { S.amenT[a] = rand(25, 45); if (S.jobs.filter((j) => j.amen === a).length < 2) spawnSpill(a); }
    }
    updateGuests(dt);
    updateLily(dt);
    updateStaff(dt);
    S.saveT += dt; if (S.saveT > 4) { S.saveT = 0; Park.save(); }
    if (S.t >= DAY_LEN) endDay();
  }

  // ---------- drawing ----------
  let skyTop = '#7cc8f5', skyBot = '#d8f1ff';
  function dayFrac() { return S ? clamp(S.t / DAY_LEN, 0, 1) : 0; }
  function draw() {
    const p = dayFrac();
    const e = clamp((p - 0.65) / 0.35, 0, 1);
    skyTop = lerpCol('#6ec3f4', '#7c6fd0', e); skyBot = lerpCol('#d8f1ff', '#fdba8c', e);
    const { dpr, s, ox, oy } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky and ground (screen space, full width)
    const groundY = oy + yOf(0) * s;
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, groundY);
    ctx.fillStyle = '#86d46b'; ctx.fillRect(0, groundY, view.w, 14 * s);
    ctx.fillStyle = '#a0764f'; ctx.fillRect(0, groundY + 14 * s, view.w, view.h);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let x = (T * 0) % 40; x < view.w; x += 38) for (let y = groundY + 30 * s; y < view.h; y += 34) { ctx.beginPath(); ctx.arc(x + (y % 20), y, 3, 0, 7); ctx.fill(); }

    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    drawSkyBits(p);
    drawBuilding();
    drawJobs();
    drawEntities();
    // particles
    for (const q of P) {
      ctx.globalAlpha = clamp(q.life / (q.max || 1), 0, 1);
      if (q.kind === 'star') drawStar(q.x, q.y, q.r, q.col);
      else if (q.kind === 'drop') { ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.fillStyle = 'rgba(186,230,253,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of FT) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = '700 17px Fredoka, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rad = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill();
  }

  function drawSkyBits(p) {
    // sun
    const sx = 60 + p * (W - 120), sy = 70 - Math.sin(p * Math.PI) * 40;
    ctx.fillStyle = 'rgba(253,224,71,.35)'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
    ctx.fillStyle = p > 0.8 ? '#fb923c' : '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 3; i++) {
      const cx = ((T * (6 + i * 3) + i * 340) % (W + 200)) - 100, cy = 30 + i * 18;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.arc(cx + 16, cy - 6, 17, 0, 7); ctx.arc(cx + 34, cy, 13, 0, 7); ctx.fill();
    }
  }

  function drawBuilding() {
    const top = yOf(roofLv()) - ROOF_H, bot = yOf(-1);
    // basement dirt
    ctx.fillStyle = '#8b6343'; ctx.fillRect(0, yOf(0) + 14, W, bot - yOf(0) + 40);
    ctx.fillStyle = '#76533a'; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc((i * 97) % W, yOf(0) + 30 + (i * 53) % 120, 4 + (i % 3), 0, 7); ctx.fill(); }
    // outer walls (guest floors + ground)
    ctx.fillStyle = '#f2c99b'; ctx.fillRect(12, yOf(G.floors) - FH, W - 24, yOf(0) - yOf(G.floors) + FH + 2);
    ctx.fillStyle = '#e8b887'; for (let y = yOf(G.floors) - FH + 8; y < yOf(0); y += 18) for (let x = 14 + ((y / 18) % 2) * 15; x < W - 40; x += 30) ctx.fillRect(x, y, 26, 2);
    // basement shell
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(12, yOf(-1) - FH, W - 24, FH + 8);
    // floors
    for (let lv = -1; lv <= G.floors; lv++) {
      const fy = yOf(lv), it = fy - FH + WALL;
      if (lv === -1) drawBasement(fy, it);
      else if (lv === 0) drawGround(fy, it);
      else for (let s = 0; s < 4; s++) {
        const i = (lv - 1) * 4 + s, room = S && S.rooms[i];
        if (room) drawRoom(room); else drawForSale(SX + s * SW, fy, it);
      }
      // slab
      ctx.fillStyle = lv === 0 ? '#7c5a3c' : '#b07a4f'; ctx.fillRect(12, fy, W - 24, lv === 0 ? 14 : 8);
      // room dividers
      ctx.fillStyle = '#e0ad7b';
      for (let s = 0; s <= 4; s++) if (!(lv <= 0 && (s === 1 || s === 3))) ctx.fillRect(SX + s * SW - 3, it, 6, fy - it);
    }
    drawRoof(top);
    drawLift();
  }

  function drawLift() {
    const top = yOf(roofLv()) - ROOF_H + 10, bot = yOf(-1);
    ctx.fillStyle = '#64748b'; ctx.fillRect(20, top, 70, bot - top);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(45, top); ctx.lineTo(45, bot); ctx.moveTo(65, top); ctx.lineTo(65, bot); ctx.stroke();
    for (let lv = -1; lv <= roofLv(); lv++) {
      const fy = yOf(lv);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(24, fy - 88, 62, 88);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(26, fy - 86, 28, 86); ctx.fillRect(56, fy - 86, 28, 86);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(54.5, fy - 86, 1.5, 86);
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(55, fy - 100, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f2937'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lv === -1 ? 'B' : lv === 0 ? 'G' : lv === roofLv() ? 'R' : String(lv), 55, fy - 99.5);
      ctx.fillStyle = '#b07a4f'; ctx.fillRect(20, fy, 70, 8);
    }
  }

  function drawRoof(top) {
    const fy = yOf(roofLv());
    // parapet line + sign
    ctx.fillStyle = '#db2777'; rr(SX + 210, top - 28, 420, 40, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 26px "Baloo 2", Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✨ SPARKLE SUITES ✨', SX + 420, top - 7);
    ctx.fillStyle = '#9d174d'; ctx.fillRect(SX + 300, top + 12, 6, fy - top - 92); ctx.fillRect(SX + 534, top + 12, 6, fy - top - 92);
    // fairy lights on the sign
    for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#fde047', '#a5f3fc', '#f9a8d4'][(i + Math.floor(T * 3)) % 3]; ctx.beginPath(); ctx.arc(SX + 222 + i * 30, top - 28, 3.5, 0, 7); ctx.fill(); }
    for (const k of ['garden', 'games']) {
      const g = amenGeom(k);
      if (G.amen[k]) (k === 'garden' ? drawGarden : drawGames)(g.x0, fy, fy - ROOF_H + 14, k);
      else drawLocked(g.x0, fy, fy - ROOF_H + 24, k, true);
    }
    ctx.fillStyle = '#e0ad7b'; ctx.fillRect(12, fy - 14, 8, 14); ctx.fillRect(W - 20, fy - 14, 8, 14);
  }

  function drawGround(fy, it) {
    // lobby
    const x0 = SX;
    ctx.fillStyle = '#fef3c7'; ctx.fillRect(x0, it, 420, fy - it);
    ctx.fillStyle = 'rgba(251,191,36,.18)'; for (let x = x0 + 10; x < x0 + 420; x += 26) ctx.fillRect(x, it, 10, fy - it - 30);
    ctx.fillStyle = '#b45309'; ctx.fillRect(x0, fy - 30, 420, 4);
    // checker floor
    for (let x = x0; x < x0 + 420; x += 20) { ctx.fillStyle = (x / 20) % 2 ? '#fde68a' : '#fff7ed'; ctx.fillRect(x, fy - 8, 20, 8); }
    // red carpet
    ctx.fillStyle = '#e11d48'; ctx.fillRect(x0 + 10, fy - 5, 300, 5);
    // entrance door
    ctx.fillStyle = '#92400e'; rr(DOOR_X - 24, fy - 100, 48, 100, 6); ctx.fill();
    ctx.fillStyle = '#bae6fd'; rr(DOOR_X - 18, fy - 94, 17, 88, 4); ctx.fill(); rr(DOOR_X + 1, fy - 94, 17, 88, 4); ctx.fill();
    ctx.fillStyle = '#fbbf24'; ctx.font = '600 11px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WELCOME', DOOR_X, fy - 108);
    // chandelier
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 230, it); ctx.lineTo(x0 + 230, it + 18); ctx.stroke();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(x0 + 230, it + 24, 22, 7, 0, 0, 7); ctx.fill();
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(x0 + 230 + i * 9, it + 32 + Math.abs(i) * -2, 3, 0, 7); ctx.fill(); }
    // plant
    plant(x0 + 175, fy);
    // reception sign + desk
    ctx.fillStyle = '#7c3aed'; rr(390, it + 8, 100, 22, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.fillText('RECEPTION', 440, it + 19.5);
    ctx.fillStyle = '#a16207'; ctx.fillRect(476, it + 40, 30, 50); ctx.fillStyle = '#fde68a';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(479 + c * 14, it + 43 + r * 16, 10, 12); // key board
    ctx.fillStyle = '#9333ea'; rr(392, fy - 52, 58, 52, 6); ctx.fill();
    ctx.fillStyle = '#c084fc'; ctx.fillRect(388, fy - 56, 66, 8);
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(408, fy - 58, 7, Math.PI, 0); ctx.fill(); ctx.fillRect(400, fy - 58, 16, 2);
    // staff door
    ctx.fillStyle = '#64748b'; rr(x0 + 405, fy - 70, 12, 70, 3); ctx.fill();
    // restaurant slot
    const rg = amenGeom('restaurant');
    if (G.amen.restaurant) drawRestaurant(rg.x0, fy, it); else drawLocked(rg.x0, fy, it, 'restaurant');
  }

  function plant(x, fy) {
    ctx.fillStyle = '#c2410c'; rr(x - 10, fy - 22, 20, 22, 4); ctx.fill();
    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(T * 1.5 + i) * 0.04; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 16, fy - 22 + Math.sin(a) * 16, 12, 5, a, 0, 7); ctx.fill(); }
  }

  function drawBasement(fy, it) {
    for (const k of ['pool', 'spa']) {
      const g = amenGeom(k);
      if (G.amen[k]) (k === 'pool' ? drawPool : drawSpa)(g.x0, fy, it, k);
      else {
        ctx.fillStyle = '#8b6343'; ctx.fillRect(g.x0, it, 420, fy - it);
        ctx.fillStyle = '#76533a'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(g.x0 + 20 + i * 41, it + 30 + (i * 37) % 90, 6, 0, 7); ctx.fill(); }
        drawLocked(g.x0, fy, it, k, true);
      }
    }
  }

  function drawLocked(x0, fy, it, k, noBg) {
    if (!noBg) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x0, it, 420, fy - it); }
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; rr(x0 + 14, it + 10, 392, fy - it - 20, 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.88)'; rr(x0 + 110, (it + fy) / 2 - 22, 200, 44, 22); ctx.fill();
    ctx.fillStyle = '#475569'; ctx.font = '600 17px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔒 ' + AMEN[k].emoji + ' ' + AMEN[k].name, x0 + 210, (it + fy) / 2);
  }

  function drawForSale(x0, fy, it) {
    ctx.fillStyle = '#d6d3d1'; ctx.fillRect(x0, it, SW, fy - it);
    ctx.fillStyle = '#d97706';
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(x0 + SW / 2, it + 30 + i * 28); ctx.rotate((i % 2 ? 1 : -1) * 0.12); ctx.fillRect(-90, -7, 180, 14); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,.9)'; rr(x0 + 30, (it + fy) / 2 - 16, 150, 32, 16); ctx.fill();
    ctx.fillStyle = '#475569'; ctx.font = '600 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔨 Room for sale', x0 + SW / 2, (it + fy) / 2);
  }

  function drawRoom(r) {
    const x0 = r.x0, fy = yOf(r.lv), it = fy - FH + WALL, h = fy - it;
    const has = (t) => r.jobs.some((j) => j.type === t);
    // wallpaper
    ctx.fillStyle = WALLS[r.i % WALLS.length]; ctx.fillRect(x0, it, 146, h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let x = x0 + 6; x < x0 + 140; x += 18) ctx.fillRect(x, it, 7, h - 30);
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x0, fy - 30, 146, 3);
    // bathroom tiles
    ctx.fillStyle = '#e0f2fe'; ctx.fillRect(x0 + 146, it, SW - 146, h);
    ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let y = it + 12; y < fy; y += 14) { ctx.moveTo(x0 + 146, y); ctx.lineTo(x0 + SW, y); } for (let x = x0 + 158; x < x0 + SW; x += 14) { ctx.moveTo(x, it); ctx.lineTo(x, fy); } ctx.stroke();
    ctx.fillStyle = '#d6b48c'; ctx.fillRect(x0 + 143, it, 5, h - 70);
    // floor
    ctx.fillStyle = '#c99566'; ctx.fillRect(x0, fy - 6, 146, 6); ctx.fillStyle = '#93c5fd'; ctx.fillRect(x0 + 146, fy - 6, SW - 146, 6);
    // window with sky
    const wg = ctx.createLinearGradient(0, it + 14, 0, it + 64); wg.addColorStop(0, skyTop); wg.addColorStop(1, skyBot);
    ctx.fillStyle = '#fff'; rr(x0 + 36, it + 12, 62, 54, 6); ctx.fill();
    ctx.fillStyle = wg; ctx.fillRect(x0 + 40, it + 16, 54, 46);
    ctx.fillStyle = '#fff'; ctx.fillRect(x0 + 66, it + 16, 2, 46);
    ctx.fillStyle = BLANKETS[r.i % BLANKETS.length]; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.moveTo(x0 + 34, it + 10); ctx.lineTo(x0 + 50, it + 10); ctx.quadraticCurveTo(x0 + 42, it + 40, x0 + 48, it + 70); ctx.lineTo(x0 + 34, it + 70); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0 + 100, it + 10); ctx.lineTo(x0 + 84, it + 10); ctx.quadraticCurveTo(x0 + 92, it + 40, x0 + 86, it + 70); ctx.lineTo(x0 + 100, it + 70); ctx.fill();
    ctx.globalAlpha = 1;
    // wall lamp + picture
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(x0 + 116, it + 40); ctx.lineTo(x0 + 132, it + 40); ctx.lineTo(x0 + 128, it + 28); ctx.lineTo(x0 + 120, it + 28); ctx.fill();
    // mirror + sink
    ctx.fillStyle = '#f8fafc'; rr(x0 + 158, it + 16, 22, 30, 10); ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.stroke();
    // door plaque
    ctx.fillStyle = '#fbbf24'; rr(x0 + 6, it + 6, 30, 16, 5); ctx.fill();
    ctx.fillStyle = '#78350f'; ctx.font = '700 11px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(r.num), x0 + 21, it + 14.5);

    drawBed(x0 + 14, fy, r, has('bed'));
    drawToilet(x0 + 184, fy, has('toilet') ? 'dirty' : has('blocked') ? 'blocked' : 'clean', r);
    if (has('rubbish')) drawRubbish(x0 + 128, fy);
    if (has('towels')) drawTowels(x0 + 164, fy);

    // status tag
    let tag = null, col = '#22c55e';
    if (r.state === 'clean') tag = '✓ READY';
    else if (r.state === 'messy') { tag = '🧹 MESSY'; col = '#f97316'; }
    else if (r.state === 'occupied') { tag = '💤 GUEST'; col = '#6366f1'; }
    else if (r.state === 'booked') { tag = '🔑 BOOKED'; col = '#6366f1'; }
    if (tag) {
      ctx.font = '700 11px Fredoka, sans-serif'; const tw = ctx.measureText(tag).width + 12;
      ctx.fillStyle = col; rr(x0 + SW - tw - 6, it + 4, tw, 16, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(tag, x0 + SW - tw / 2 - 6, it + 12.5);
    }
    if (r.state === 'clean' && S && S.t - r.readyT < 2.5) {
      const k = (S.t - r.readyT) / 2.5;
      ctx.globalAlpha = 1 - k; for (let i = 0; i < 6; i++) drawStar(x0 + 20 + i * 34, it + 50 + Math.sin(i * 2 + T * 6) * 20, 7, '#fde047'); ctx.globalAlpha = 1;
    } else if (r.state === 'clean' && Math.sin(T * 2 + r.i) > 0.92) drawStar(x0 + 60, fy - 40, 5, '#fff');
  }

  function drawBed(x, fy, r, messy) {
    const blanket = BLANKETS[r.i % BLANKETS.length];
    ctx.fillStyle = '#92400e'; rr(x, fy - 64, 10, 64, 4); ctx.fill();           // headboard
    ctx.fillRect(x + 84, fy - 30, 6, 30);                                        // foot post
    ctx.fillStyle = '#b45309'; ctx.fillRect(x + 6, fy - 22, 84, 10);           // frame
    ctx.fillStyle = '#fff'; rr(x + 8, fy - 34, 82, 14, 5); ctx.fill();          // mattress
    if (r.state === 'occupied' && r.guest) {
      ctx.save(); ctx.translate(x + 78, fy - 28); ctx.rotate(-Math.PI / 2);
      Park.drawAvatar(ctx, 0, 0, 62, r.guest.av, { pose: 'stand' });
      ctx.restore();
      ctx.fillStyle = blanket; rr(x + 32, fy - 44, 60, 22, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 32, fy - 40, 60, 4);
      ctx.fillStyle = '#6366f1'; ctx.font = '700 14px Fredoka, sans-serif'; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const k = (T * 0.6 + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.fillText('z', x + 26 + k * 20, fy - 78 - k * 30); }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = '#f1f5f9'; rr(x + 12, fy - 44, 24, 12, 6); ctx.fill();     // pillow
    if (!messy) {
      ctx.fillStyle = blanket; rr(x + 34, fy - 38, 58, 20, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 34, fy - 34, 58, 4);
      ctx.fillStyle = '#fef3c7'; rr(x + 52, fy - 42, 14, 6, 3); ctx.fill(); // chocolate on the pillow
    } else {
      ctx.save(); ctx.translate(x + 60, fy - 32); ctx.rotate(-0.12);
      ctx.fillStyle = blanket; ctx.beginPath(); ctx.moveTo(-34, -6);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-34 + i * 12, -10 - (i % 2) * 8);
      ctx.lineTo(40, 18); ctx.lineTo(-30, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(x + 30, fy - 40); ctx.rotate(0.6); ctx.fillStyle = '#f1f5f9'; rr(-12, -6, 24, 12, 6); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(120,80,40,.45)'; ctx.beginPath(); ctx.ellipse(x + 50, fy - 30, 8, 4, 0, 0, 7); ctx.ellipse(x + 74, fy - 34, 5, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f472b6'; rr(x + 70, fy - 6, 12, 5, 2); ctx.fill(); // sock
    }
  }

  function drawToilet(x, fy, st) {
    // tank
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
    rr(x + 4, fy - 50, 16, 26, 4); ctx.fill(); ctx.stroke();
    // bowl
    ctx.beginPath(); ctx.moveTo(x - 18, fy - 26); ctx.lineTo(x + 10, fy - 26); ctx.quadraticCurveTo(x + 10, fy - 12, x + 2, fy - 10); ctx.lineTo(x + 4, fy); ctx.lineTo(x - 10, fy); ctx.lineTo(x - 8, fy - 12); ctx.quadraticCurveTo(x - 18, fy - 16, x - 18, fy - 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x - 20, fy - 29, 32, 4);
    if (st === 'dirty') {
      ctx.fillStyle = 'rgba(132,104,30,.7)'; ctx.beginPath(); ctx.ellipse(x - 6, fy - 18, 6, 3, 0.3, 0, 7); ctx.ellipse(x + 4, fy - 40, 4, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(101,163,13,.55)'; ctx.beginPath(); ctx.ellipse(x - 12, fy - 24, 4, 2, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 2; i++) { // flies
        const fx = x - 4 + Math.sin(T * 7 + i * 3) * 14, fly = fy - 46 + Math.cos(T * 9 + i) * 8;
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(fx - 2, fly - 2, 3, 2, -0.5, 0, 7); ctx.ellipse(fx + 2, fly - 2, 3, 2, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(fx, fly, 2, 0, 7); ctx.fill();
      }
    } else if (st === 'blocked') {
      const pw = 30 + Math.sin(T * 2) * 4 + 10;
      ctx.fillStyle = 'rgba(96,165,250,.55)'; ctx.beginPath(); ctx.ellipse(x - 14, fy - 2, pw, 5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const k = (T * 1.6 + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(x - 6, fy - 28); ctx.quadraticCurveTo(x - 10 - i * 6, fy - 46 - 10 * k, x - 20 - i * 8 - k * 10, fy - 26 + k * 20); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.08) P.push({ x: x - 6, y: fy - 30, vx: rand(-80, -20), vy: rand(-140, -60), life: 0.7, max: 0.7, kind: 'drop', r: 2.5 });
    } else if (Math.sin(T * 1.7 + x) > 0.95) drawStar(x - 4, fy - 30, 4, '#bae6fd');
  }

  function drawRubbish(x, fy) {
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(x - 16, fy - 3); ctx.quadraticCurveTo(x - 10, fy - 14, x - 4, fy - 3); ctx.quadraticCurveTo(x - 10, fy - 7, x - 16, fy - 3); ctx.fill(); // banana skin
    ctx.fillStyle = '#ef4444'; ctx.save(); ctx.translate(x + 8, fy - 5); ctx.rotate(1.3); ctx.fillRect(-4, -7, 8, 14); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-4, -7, 8, 2); ctx.restore(); // can
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
    for (const [dx, r] of [[-2, 6], [16, 5]]) { ctx.beginPath(); ctx.arc(x + dx, fy - r, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + dx - 3, fy - r - 2); ctx.lineTo(x + dx + 2, fy - r + 1); ctx.stroke(); }
  }

  function drawTowels(x, fy) {
    ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.ellipse(x - 4, fy - 6, 16, 7, 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#f9fafb'; ctx.beginPath(); ctx.ellipse(x + 6, fy - 11, 12, 6, -0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#60a5fa'; const k = (T * 1.5) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(x + 10, fy - 4 + k * 4, 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }

  // --- amenities ---
  function decoPeople(k, fy, pose, dyFn) {
    if (!S || !S.deco[k]) return;
    for (const d of S.deco[k]) {
      const dy = dyFn ? dyFn(d) : 0;
      Park.drawAvatar(ctx, d.x + Math.sin(T * 0.5 + d.ph) * 10, fy + dy, 52, d.av, { pose, t: T + d.ph, face: Math.sin(T * 0.3 + d.ph) > 0 ? 1 : -1 });
    }
  }
  function drawPool(x0, fy, it, k) {
    ctx.fillStyle = '#dbeafe'; ctx.fillRect(x0, it, 420, fy - it);
    ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = x0; x < x0 + 420; x += 16) { ctx.moveTo(x, it); ctx.lineTo(x, fy); } ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x0, fy - 64, 420, 6);
    const wl = fy - 56;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 20, wl - 60, 380, fy - wl + 60); ctx.clip();
    decoPeople(k, fy - 22, 'sit', (d) => Math.sin(T * 2 + d.ph) * 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(56,189,248,.75)'; ctx.beginPath(); ctx.moveTo(x0 + 20, fy);
    for (let x = 0; x <= 380; x += 10) ctx.lineTo(x0 + 20 + x, wl + Math.sin(x / 22 + T * 2.4) * 3);
    ctx.lineTo(x0 + 400, fy); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 30; x < 380; x += 60) { ctx.moveTo(x0 + x, wl + 18); ctx.quadraticCurveTo(x0 + x + 12, wl + 13, x0 + x + 24, wl + 18); } ctx.stroke();
    // ladder + rubber duck + slide
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + 380, wl - 24); ctx.lineTo(x0 + 380, wl + 20); ctx.moveTo(x0 + 392, wl - 24); ctx.lineTo(x0 + 392, wl + 20); ctx.stroke();
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦆', x0 + 200 + Math.sin(T * 0.7) * 120, wl - 4 + Math.sin(T * 3) * 2);
    ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(x0 + 22, it + 20); ctx.quadraticCurveTo(x0 + 70, it + 30, x0 + 90, wl - 4); ctx.lineTo(x0 + 78, wl - 4); ctx.quadraticCurveTo(x0 + 60, it + 40, x0 + 22, it + 34); ctx.fill();
  }
  function drawSpa(x0, fy, it, k) {
    ctx.fillStyle = '#ede9fe'; ctx.fillRect(x0, it, 420, fy - it);
    ctx.fillStyle = '#c4b5fd'; for (let x = x0 + 20; x < x0 + 420; x += 60) { ctx.beginPath(); ctx.arc(x, it + 30, 10, 0, 7); ctx.fill(); }
    // hot tub
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 120, it, 220, fy - it - 30); ctx.clip();
    if (S && S.deco[k]) S.deco[k].slice(0, 2).forEach((d, i) => Park.drawAvatar(ctx, x0 + 180 + i * 90, fy - 10, 52, d.av, { pose: 'sit', face: i ? -1 : 1 }));
    ctx.restore();
    ctx.fillStyle = '#a78bfa'; rr(x0 + 120, fy - 40, 220, 40, 12); ctx.fill();
    ctx.fillStyle = '#67e8f9'; rr(x0 + 128, fy - 44, 204, 12, 6); ctx.fill();
    for (let i = 0; i < 8; i++) { const k2 = (T * 0.5 + i / 8) % 1; ctx.globalAlpha = 0.5 * (1 - k2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + 140 + i * 25 + Math.sin(T + i) * 6, fy - 50 - k2 * 50, 6 + k2 * 6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // candles + robe hook
    for (const cx of [x0 + 40, x0 + 70]) { ctx.fillStyle = '#fef3c7'; ctx.fillRect(cx - 4, fy - 20, 8, 20); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(cx, fy - 25 + Math.sin(T * 10 + cx) * 0.6, 3, 5, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; rr(x0 + 370, it + 30, 26, 60, 8); ctx.fill(); ctx.strokeStyle = '#ddd6fe'; ctx.stroke();
    plant(x0 + 390, fy);
  }
  function drawRestaurant(x0, fy, it, k) {
    ctx.fillStyle = '#fee2e2'; ctx.fillRect(x0, it, 420, fy - it);
    ctx.fillStyle = '#fecaca'; for (let x = x0; x < x0 + 420; x += 24) ctx.fillRect(x, it, 12, 26);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(x0, fy - 6, 420, 6);
    // kitchen hatch with chef hat
    ctx.fillStyle = '#e5e7eb'; rr(x0 + 320, it + 30, 90, 50, 6); ctx.fill();
    ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👨‍🍳', x0 + 365, it + 58 + Math.sin(T * 3) * 2);
    decoPeople(k, fy, 'sit');
    for (let i = 0; i < 3; i++) {
      const tx = x0 + 60 + i * 120;
      ctx.fillStyle = '#fff'; rr(tx - 30, fy - 46, 60, 10, 4); ctx.fill();
      ctx.fillStyle = '#ef4444'; for (let c = 0; c < 6; c++) if (c % 2 === 0) ctx.fillRect(tx - 30 + c * 10, fy - 46, 10, 10);
      ctx.fillStyle = '#78350f'; ctx.fillRect(tx - 3, fy - 36, 6, 36);
      ctx.font = '16px sans-serif'; ctx.fillText(['🍕', '🍝', '🍰'][i], tx, fy - 54);
    }
  }
  function drawGarden(x0, fy, it, k) {
    ctx.fillStyle = '#86efac'; ctx.fillRect(x0, fy - 14, 420, 14);
    // string lights
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 10, it + 10); ctx.quadraticCurveTo(x0 + 210, it + 50, x0 + 410, it + 10); ctx.stroke();
    for (let i = 1; i < 12; i++) { const t = i / 12, lx = x0 + 10 + t * 400, ly = it + 10 + 4 * t * (1 - t) * 30; ctx.fillStyle = ['#fde047', '#f9a8d4', '#a5f3fc'][(i + Math.floor(T * 2)) % 3]; ctx.beginPath(); ctx.arc(lx, ly + 3, 4, 0, 7); ctx.fill(); }
    // trees
    for (const tx of [x0 + 40, x0 + 380]) { ctx.fillStyle = '#92400e'; ctx.fillRect(tx - 4, fy - 60, 8, 50); ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(tx, fy - 70, 24 + Math.sin(T + tx) * 1, 0, 7); ctx.fill(); }
    decoPeople(k, fy - 10, 'stand');
    // flowers
    for (let i = 0; i < 18; i++) { const fx = x0 + 20 + i * 22, sw = Math.sin(T * 2 + i) * 2; ctx.strokeStyle = '#15803d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy - 10); ctx.lineTo(fx + sw, fy - 26); ctx.stroke(); ctx.fillStyle = ['#f472b6', '#facc15', '#a78bfa', '#fb7185'][i % 4]; ctx.beginPath(); ctx.arc(fx + sw, fy - 28, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(fx + sw, fy - 28, 2, 0, 7); ctx.fill(); }
  }
  function drawGames(x0, fy, it, k) {
    ctx.fillStyle = 'rgba(224,242,254,.7)'; rr(x0 + 6, it, 408, fy - it, 16); ctx.fill();
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#312e81'; ctx.fillRect(x0 + 6, fy - 8, 408, 8);
    for (let i = 0; i < 3; i++) {
      const ax = x0 + 40 + i * 50;
      ctx.fillStyle = ['#ec4899', '#8b5cf6', '#0ea5e9'][i]; rr(ax - 18, fy - 76, 36, 70, 6); ctx.fill();
      ctx.fillStyle = `hsl(${(T * 120 + i * 90) % 360},90%,65%)`; ctx.fillRect(ax - 12, fy - 68, 24, 18);
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(ax - 5, fy - 40, 3, 0, 7); ctx.arc(ax + 6, fy - 40, 3, 0, 7); ctx.fill();
    }
    // ping-pong table
    ctx.fillStyle = '#16a34a'; ctx.fillRect(x0 + 230, fy - 40, 120, 8); ctx.fillStyle = '#fff'; ctx.fillRect(x0 + 289, fy - 50, 2, 10);
    ctx.fillStyle = '#334155'; ctx.fillRect(x0 + 240, fy - 32, 5, 32); ctx.fillRect(x0 + 335, fy - 32, 5, 32);
    const bp = (Math.sin(T * 3) + 1) / 2; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(x0 + 240 + bp * 100, fy - 46 - Math.abs(Math.sin(T * 6)) * 18, 3.5, 0, 7); ctx.fill();
    if (S && S.deco[k]) { Park.drawAvatar(ctx, x0 + 215, fy - 8, 52, S.deco[k][0].av, { face: 1 }); Park.drawAvatar(ctx, x0 + 370, fy - 8, 52, S.deco[k][1].av, { face: -1 }); }
  }

  // --- jobs (bubbles + progress) ---
  function drawJobs() {
    if (!S) return;
    const L = S.lily;
    const list = S.jobs.slice();
    if (S.queue.length) list.push(S.desk);
    for (const j of list) {
      const cy = yOf(j.lv) + j.dy;
      if (j.type === 'spill') drawSpill(j, cy);
      const by = cy - 40 + Math.sin(T * 4 + j.x) * 3;
      const icon = j.type === 'spill' ? SPILL_ICON[j.amen] : JT[j.type].icon;
      const urgent = j.type === 'blocked' || (j === S.desk);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = urgent ? '#ef4444' : '#f472b6'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(j.x, by, 15, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(j.x - 5, by + 13); ctx.lineTo(j.x, by + 21); ctx.lineTo(j.x + 5, by + 13); ctx.fill();
      ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, j.x, by + 1);
      if (j.progress > 0) {
        ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(j.x, by, 20, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#22c55e'; ctx.beginPath(); ctx.arc(j.x, by, 20, -Math.PI / 2, -Math.PI / 2 + j.progress * Math.PI * 2); ctx.stroke();
      }
      const qi = L.queue.indexOf(j);
      if (qi >= 0) {
        ctx.fillStyle = '#db2777'; ctx.beginPath(); ctx.arc(j.x + 15, by - 13, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.fillText(String(qi + 1), j.x + 15, by - 12.5);
      }
      if (j === S.desk && j.waiting && L.working === j) {
        ctx.font = '600 13px Fredoka, sans-serif'; ctx.fillStyle = '#b91c1c'; ctx.fillText(freeRooms().length ? 'Waiting…' : 'No clean room!', j.x, by - 30);
      }
      // scrubbing sponge
      if (j.busy && j !== S.desk) {
        const sx = j.x + Math.sin(T * 22) * 10, sy = cy + Math.cos(T * 22) * 4;
        ctx.fillStyle = '#facc15'; rr(sx - 8, sy - 5, 16, 10, 3); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.fillRect(sx - 8, sy - 5, 16, 3);
      }
    }
  }
  function drawSpill(j, cy) {
    const x = j.x;
    if (j.amen === 'pool') { ctx.fillStyle = 'rgba(96,165,250,.6)'; ctx.beginPath(); ctx.ellipse(x, cy + 6, 22, 5, 0, 0, 7); ctx.fill(); }
    else if (j.amen === 'restaurant') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 6, cy + 4, 12, 4, 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(x + 8, cy + 6, 12, 4, 0, 0, 7); ctx.fill(); }
    else if (j.amen === 'spa') { ctx.fillStyle = '#f9fafb'; ctx.beginPath(); ctx.ellipse(x, cy + 3, 16, 7, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else if (j.amen === 'garden') { for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ea580c', '#ca8a04', '#b45309'][i % 3]; ctx.beginPath(); ctx.ellipse(x - 15 + i * 6, cy + 4 - (i % 2) * 3, 5, 3, i, 0, 7); ctx.fill(); } }
    else { for (let i = 0; i < 7; i++) { ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(x - 14 + i * 5, cy + 5 - (i % 3) * 2, 3, 0, 7); ctx.fill(); } }
  }

  // --- people ---
  function drawPerson(e, av, opts) {
    const y = yOf(e.lv);
    const inLift = Math.abs(e.lv - Math.round(e.lv)) > 0.01;
    if (inLift) {
      ctx.fillStyle = '#fef3c7'; ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3; rr(25, y - 86, 60, 86, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d97706'; ctx.fillRect(53, y - 100, 4, 14);
    }
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    const pose = e.moving && !inLift ? 'run' : 'stand';
    const size = opts.size || 62;
    Park.drawAvatar(ctx, e.x, y, size, av, { pose, t: T, face: e.face || 1 });
    if (opts.apron) drawApron(e.x, y, size, e.face || 1, opts.apron);
    if (opts.tool) drawHeld(e.x, y, size, e.face || 1, opts.tool);
    ctx.globalAlpha = 1;
    return y;
  }
  function drawApron(x, y, size, face, col) {
    const s = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    ctx.fillStyle = '#fff'; rr(-12, -58, 24, 28, 6); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -58); ctx.lineTo(-11, -66); ctx.moveTo(9, -58); ctx.lineTo(11, -66); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-2.5, -44, 3, 0, 7); ctx.arc(2.5, -44, 3, 0, 7); ctx.moveTo(-5.5, -43); ctx.lineTo(0, -37); ctx.lineTo(5.5, -43); ctx.fill();
    ctx.restore();
  }
  function drawHeld(x, y, size, face, tool) {
    const s = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    if (tool === 'duster') { ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, -38); ctx.lineTo(30, -62); ctx.stroke(); ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(31, -66, 8, 0, 7); ctx.fill(); }
    if (tool === 'plunger') { ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, -38); ctx.lineTo(24, -4); ctx.stroke(); ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(24, -4, 8, Math.PI, 0); ctx.fill(); }
    if (tool === 'case') { ctx.fillStyle = '#7c3aed'; rr(16, -34, 20, 26, 4); ctx.fill(); ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 2; ctx.strokeRect(22, -38, 8, 5); }
    if (tool === 'gold') { ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, -38); ctx.lineTo(24, -4); ctx.stroke(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(24, -4, 8, Math.PI, 0); ctx.fill(); }
    ctx.restore();
  }
  function bubble(x, y, text) {
    ctx.font = '18px sans-serif'; const w = Math.max(30, ctx.measureText(text).width + 14);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; rr(x - w / 2, y - 15, w, 28, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  }
  function drawEntities() {
    if (!S) return;
    for (const st of S.staff) {
      const tool = st.role === 'cleaner' ? 'duster' : st.role === 'plumber' ? 'plunger' : st.role === 'porter' && st.escort ? 'case' : null;
      const y = drawPerson(st, st.av, { apron: st.role === 'cleaner' ? '#14b8a6' : null, tool, size: 60 });
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(st.x, y - 74, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillText(STAFF[st.role].emoji, st.x, y - 73);
      if (!st.job && !st.escort && !st.moving && st.role !== 'receptionist' && Math.sin(st.t * 0.8) > 0.6) bubble(st.x + 14, y - 96, '☕');
    }
    for (const g of S.guests) {
      if (g.state === 'inRoom') continue;
      const y = drawPerson(g, g.av, { alpha: g.alpha, tool: g.state === 'queue' || g.state === 'leaving' || (g.state === 'toRoom' && !g.fast) ? 'case' : null, size: 58 });
      if (g.state === 'queue') {
        const f = g.pat / g.patMax;
        const face = !freeRooms().length && S.queue[0] === g ? '⏳' : f > 0.6 ? '🙂' : f > 0.3 ? '😐' : '😟';
        bubble(g.x, y - 84, face);
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(g.x - 14, y - 66, 28, 4);
        ctx.fillStyle = f > 0.6 ? '#22c55e' : f > 0.3 ? '#f59e0b' : '#ef4444'; ctx.fillRect(g.x - 14, y - 66, 28 * clamp(f, 0, 1), 4);
      } else if (g.bubble) bubble(g.x, y - 84, g.bubble.text);
    }
    const L = S.lily;
    const tool = G.tools.plunger && L.working && (L.working.type === 'blocked' || L.working.type === 'toilet') ? 'gold' : L.working && (L.working.type === 'blocked') ? 'plunger' : 'duster';
    const y = drawPerson(L, Park.state.avatar, { apron: '#ec4899', tool, size: 66 });
    // "you" marker
    const by = y - 92 + Math.sin(T * 4) * 3;
    ctx.fillStyle = '#ec4899'; ctx.beginPath(); ctx.moveTo(L.x - 8, by - 8); ctx.lineTo(L.x + 8, by - 8); ctx.lineTo(L.x, by + 2); ctx.fill();
    if (L.working && L.working !== S.desk && !S.rubHinted && S.t > 0) {
      ctx.font = '600 14px Fredoka, sans-serif'; ctx.fillStyle = '#be185d'; ctx.textAlign = 'center'; ctx.fillText('Rub it to scrub faster! 👆', L.x, by - 18);
    }
  }

  // ---------- input ----------
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
  }
  function lvAtY(y) {
    for (let lv = -1; lv <= roofLv(); lv++) { const fy = yOf(lv); if (y <= fy + 6 && y > fy - (lv === roofLv() ? ROOF_H : FH) + 6) return lv; }
    return null;
  }
  function hitJob(p) {
    let best = null, bd = 48;
    for (const j of S.jobs) {
      const cy = yOf(j.lv) + j.dy;
      const d = Math.min(Math.hypot(p.x - j.x, p.y - cy), Math.hypot(p.x - j.x, p.y - (cy - 40)));
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }
  function queueJob(j) {
    const L = S.lily;
    if (L.queue.includes(j)) return;
    if (L.queue.length >= 6) { Park.toast('Your to-do list is full — finish a job first!'); return; }
    L.queue.push(j); L.walkTo = null; Park.sound('pop');
    S.tapped = true;
  }
  function onDown(e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    const p = toWorld(e);
    ptr.down = true; ptr.wx = p.x; ptr.wy = p.y; ptr.sx = e.clientX; ptr.sy = e.clientY;
    if (!S || !S.running) return;
    const L = S.lily;
    // rubbing the job you're already on
    if (L.working && L.working !== S.desk && Math.hypot(p.x - L.working.x, p.y - (yOf(L.working.lv) + L.working.dy)) < 60) return;
    const j = hitJob(p);
    if (j) { queueJob(j); return; }
    const lv = lvAtY(p.y);
    if (lv === 0 && p.x > 200 && p.x < 520 && S.queue.length) {
      if (!freeRooms().length) Park.toast('No clean rooms yet — clean one first! 🧹');
      queueJob(S.desk); return;
    }
    if (lv != null && p.x > 20 && p.x < W - 20) {
      // tapped a messy room? pick its nearest job
      const room = S.rooms.find((r) => r.lv === lv && p.x >= r.x0 && p.x < r.x0 + SW);
      if (room && room.jobs.length) {
        const nj = room.jobs.slice().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).find((o) => !L.queue.includes(o));
        if (nj) { queueJob(nj); return; }
      }
      if (!L.queue.length) L.walkTo = { x: clamp(p.x, 30, W - 30), lv };
    }
  }
  function onMove(e) {
    if (!ptr.down) return;
    const p = toWorld(e);
    if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 3) {
      ptr.moveT = T; ptr.sx = e.clientX; ptr.sy = e.clientY;
      if (S && S.lily.working && S.lily.working !== S.desk) S.rubHinted = S.rubHinted || (S.lily.boost > 2);
    }
    ptr.wx = p.x; ptr.wy = p.y;
  }
  const onUp = () => { ptr.down = false; };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- HUD ----------
  const $ = (id) => document.getElementById(id);
  let lastHud = '';
  function hud() {
    const p = dayFrac();
    const mins = Math.floor(8 * 60 + p * 12 * 60), h = Math.floor(mins / 60), m = mins % 60;
    const time = `${((h + 11) % 12) + 1}:${String(Math.floor(m / 15) * 15).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
    const full = Math.round(G.stars);
    const stars = '⭐'.repeat(full) + '☆'.repeat(5 - full);
    const key = [G.day, time, G.money, stars, Math.round(p * 100)].join('|');
    if (key !== lastHud) {
      lastHud = key;
      $('dayTxt').textContent = 'Day ' + G.day; $('timeTxt').textContent = time; $('moneyTxt').textContent = G.money;
      $('starTxt').textContent = stars; $('clockBar').style.width = (p * 100) + '%';
    }
    // hint
    let hint = '';
    if (S && S.running) {
      const L = S.lily, staffRecept = G.staff.receptionist > 0;
      if (S.queue.length && !freeRooms().length) hint = '⏳ Guests are waiting — clean a room so they can check in!';
      else if (frontGuest() && !staffRecept && !L.queue.includes(S.desk)) hint = '🛎️ A guest is waiting! Tap the reception desk to check them in.';
      else if (L.working && L.working !== S.desk && !S.rubHinted) hint = '👆 Rub the mess with your finger (or mouse) to scrub faster!';
      else if (!L.queue.length && S.jobs.length && G.day <= 3) hint = 'Tap a mess bubble (🛏️ 🚽 🗑️ 🧺) to go and clean it.';
      else if (S.jobs.some((j) => j.type === 'blocked') && !G.staff.plumber && G.day <= 5) hint = '🪠 Blocked toilet! It takes a while — a Plumber would help.';
    }
    if ($('hint').textContent !== hint) $('hint').textContent = hint;
  }

  // ---------- panels ----------
  const panel = $('panel'), card = $('panelCard');
  function showPanel(html) { card.innerHTML = html; panel.classList.add('on'); }
  function hidePanel() { panel.classList.remove('on'); }

  function introPanel() {
    const first = G.day === 1;
    showPanel(`
      <h1>🏨 Sparkle Suites</h1>
      <canvas id="introAv" width="240" height="240"></canvas>
      <p>${first ? 'You just got a job at a little hotel! Guests check in, sleep, and leave their rooms <b>messy</b>.' : 'Welcome back! Ready for another busy day?'}</p>
      ${first ? '<p>👆 <b>Tap a mess</b> to walk there and clean it. Rub it to scrub faster!<br>🛎️ <b>Tap the desk</b> to check guests in.<br>💵 Spend your money on new rooms and helpers.</p>' : ''}
      <p><b>Day ${G.day}</b> · 💵 ${G.money} · ${'⭐'.repeat(Math.round(G.stars))}</p>
      ${first ? '' : '<button class="bigbtn alt" id="btnBuild">🛠️ Build & Hire</button>'}
      <button class="bigbtn" id="btnStart">▶ Start Day ${G.day}</button>`);
    const c = $('introAv').getContext('2d');
    Park.drawAvatar(c, 120, 225, 200, Park.state.avatar, { pose: 'stand' });
    $('btnStart').onclick = startDay;
    if ($('btnBuild')) $('btnBuild').onclick = openBuild;
  }

  function startDay() {
    hidePanel();
    prepDay();
    S.running = true;
    G.seenIntro = true; Park.save();
    Park.sound('good');
    Park.toast(`☀️ Day ${G.day} — the hotel is open!`);
  }

  function endDay() {
    S.running = false;
    const st = S.stats;
    let wages = 0;
    for (const r in STAFF) wages += G.staff[r] * STAFF[r].wage;
    const paid = Math.min(wages, G.money); G.money -= paid;
    const coins = Math.min(30, Math.max(2, Math.round(st.earned * 0.1)));
    const starDelta = G.stars - st.starsStart;
    G.day++;
    Park.save();
    Park.addCoins(coins);
    Park.sound('win'); Park.confetti();
    const cheer = st.grumpy === 0 ? 'Every guest was happy! 🥰' : st.guests > st.grumpy * 3 ? 'Great work today!' : 'Phew, what a busy day!';
    showPanel(`
      <h1>🌙 Day ${G.day - 1} done!</h1>
      <p>${cheer}</p>
      <table>
        <tr><td>🔑 Guests checked in</td><td>${st.guests}</td></tr>
        ${st.grumpy ? `<tr><td>😠 Guests who left</td><td>${st.grumpy}</td></tr>` : ''}
        <tr><td>🛏️ Room money</td><td>$${st.rooms || 0}</td></tr>
        <tr><td>🧽 Cleaning money</td><td>$${st.clean || 0}</td></tr>
        <tr><td>⚡ Tips & bonuses</td><td>$${st.tips || 0}</td></tr>
        ${wages ? `<tr><td>👷 Staff wages</td><td>−$${paid}</td></tr>` : ''}
        <tr class="tot"><td>💵 Hotel money</td><td>$${G.money}</td></tr>
        <tr><td>⭐ Rating</td><td>${G.stars.toFixed(1)} ${starDelta >= 0 ? '▲' : '▼'}</td></tr>
        <tr><td>🪙 Park coins</td><td>+${coins}</td></tr>
      </table>
      <button class="bigbtn alt" id="btnBuild">🛠️ Build & Hire</button>
      <button class="bigbtn" id="btnStart">▶ Day ${G.day}</button>`);
    $('btnStart').onclick = startDay;
    $('btnBuild').onclick = openBuild;
  }

  // ---------- build & hire ----------
  let buildTab = 'build';
  function openBuild() {
    prepDay(); // so new parts appear behind the menu right away
    const wrap = document.createElement('div');
    const m = Park.modal('🛠️ Build & Hire', wrap, { wide: true, onClose: () => introPanel() });
    hidePanel();
    const render = () => {
      const items = [];
      if (buildTab === 'build') {
        if (G.rooms < G.floors * 4) items.push({ id: 'room', em: '🛏️', name: 'New guest room', desc: `Room ${(1 + Math.floor(G.rooms / 4)) * 100 + (G.rooms % 4) + 1}. More rooms = more guests!`, price: roomPrice() });
        else if (G.floors < 3) items.push({ id: 'floor', em: '🏗️', name: 'New floor', desc: 'Build another storey with space for 4 rooms (comes with 1 room).', price: floorPrice() });
        else items.push({ id: 'none', em: '🏰', name: 'All rooms built!', desc: 'Your hotel is as tall as it can go.', owned: true });
        for (const a in AMEN) items.push({ id: 'amen:' + a, em: AMEN[a].emoji, name: AMEN[a].name, desc: AMEN[a].desc, price: AMEN[a].price, owned: G.amen[a] });
      } else if (buildTab === 'staff') {
        for (const r in STAFF) {
          const S2 = STAFF[r], n = G.staff[r];
          items.push({ id: 'staff:' + r, em: S2.emoji, name: `${S2.name} (${n}/${S2.max})`, desc: `${S2.desc} Wage $${S2.wage} a day.`, price: n < S2.max ? S2.hire[n] : 0, owned: n >= S2.max });
        }
      } else {
        for (const t in TOOLS) items.push({ id: 'tool:' + t, em: TOOLS[t].emoji, name: TOOLS[t].name, desc: TOOLS[t].desc, price: TOOLS[t].price, owned: G.tools[t] });
      }
      let wages = 0; for (const r in STAFF) wages += G.staff[r] * STAFF[r].wage;
      wrap.innerHTML = `
        <div class="shop-money">💵 $${G.money} ${wages ? `<small style="font-weight:500;color:#64748b">· wages $${wages}/day</small>` : ''}</div>
        <div class="pk-tabs">
          <button data-t="build" class="${buildTab === 'build' ? 'on' : ''}">🏗️ Build</button>
          <button data-t="staff" class="${buildTab === 'staff' ? 'on' : ''}">👷 Hire staff</button>
          <button data-t="tools" class="${buildTab === 'tools' ? 'on' : ''}">🧰 Tools</button>
        </div>
        <div class="shop-grid">${items.map((it) => `
          <div class="item ${it.owned ? 'owned' : ''}">
            <div class="em">${it.em}</div><b>${it.name}</b><small>${it.desc}</small>
            ${it.owned ? '<button disabled>✓ Got it</button>' : `<button data-buy="${it.id}" data-price="${it.price}" ${G.money < it.price ? 'disabled' : ''}>Buy $${it.price}</button>`}
          </div>`).join('')}</div>
        <p style="text-align:center"><button class="bigbtn" id="buildStart">▶ Start Day ${G.day}</button></p>`;
      wrap.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { buildTab = b.dataset.t; render(); }; });
      wrap.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => buy(b.dataset.buy, +b.dataset.price); });
      wrap.querySelector('#buildStart').onclick = () => { m.box.parentNode.remove(); startDay(); };
    };
    const buy = (id, price) => {
      if (G.money < price) { Park.toast('Not enough 💵 yet!'); Park.sound('bad'); return; }
      G.money -= price;
      let msg = '';
      if (id === 'room') { G.rooms++; msg = '🛏️ New room built!'; }
      else if (id === 'floor') { G.floors++; G.rooms++; msg = '🏗️ A whole new floor!'; }
      else if (id.startsWith('amen:')) { G.amen[id.slice(5)] = true; msg = AMEN[id.slice(5)].emoji + ' ' + AMEN[id.slice(5)].name + ' is open!'; Park.confetti(); }
      else if (id.startsWith('staff:')) { G.staff[id.slice(6)]++; msg = STAFF[id.slice(6)].emoji + ' Welcome to the team!'; }
      else if (id.startsWith('tool:')) { G.tools[id.slice(5)] = true; msg = TOOLS[id.slice(5)].emoji + ' ' + TOOLS[id.slice(5)].name + '!'; }
      Park.save(); Park.sound('win'); Park.toast(msg);
      prepDay();
      render();
    };
    render();
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); fitView(); draw(); hud();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  Park.topBar({
    title: 'Sparkle Suites', emoji: '🏨', help: `
      <p>You work at <b>Sparkle Suites</b>! Guests arrive, check in, sleep, and leave their rooms messy.</p>
      <p>👆 <b>Tap a mess bubble</b> (🛏️ bed, 🚽 toilet, 🗑️ rubbish, 🧺 towels) and you'll walk there and clean it. You can line up to 6 jobs — they get pink numbers.</p>
      <p>✨ <b>Rub</b> the mess with your finger or mouse while you're cleaning to scrub much faster!</p>
      <p>🛎️ <b>Tap the reception desk</b> to check a waiting guest in. They need a clean room, so clean fast! Quick check-ins earn tips and ⭐ stars.</p>
      <p>🪠 A <b>blocked toilet</b> takes ages — a Plumber or the Golden Plunger helps a lot.</p>
      <p>🌙 At the end of each day you get Park 🪙 coins, and you can spend your hotel 💵 on new rooms, floors, a pool, spa, restaurant, games room and rooftop garden — and hire cleaners, plumbers, a receptionist and a porter to help.</p>` });
  resize();
  prepDay();
  introPanel();
  requestAnimationFrame(frame);
  // let the fonts land, then re-measure the HUD
  if (document.fonts) document.fonts.ready.then(resize);

  // for testing in the console
  window.__hotel = { get S() { return S; }, G, update, draw, endDay, startDay, openBuild, checkIn, queueJob, hud };
})();
