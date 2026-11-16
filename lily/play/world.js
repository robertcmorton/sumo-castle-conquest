// Colour the World — paint every country on the map!
// World map (real shapes, TopoJSON) + a territory-painting arena for each country.
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';

  Park.topBar({
    title: 'Colour the World', emoji: '🗺️',
    help: `<p><b>Colour in the whole world, one country at a time!</b></p>
      <p>🗺️ Tap a country on the map (or find it in the list) and press <b>Play</b>.</p>
      <p>🎨 You start with a little patch of paint. When you walk off your patch you leave a dotted <b>trail</b>.
      Walk back onto your patch and everything inside your loop turns your colour!</p>
      <p>⌨️ Steer with the <b>arrow keys</b> or <b>W A S D</b>. 📱 On a tablet, touch the screen and <b>slide</b> your finger the way you want to go (or hold your finger where you want to go).</p>
      <p>⚠️ Watch out! If a rival blob bumps into your trail you lose a ❤️. If <b>you</b> cross a rival's trail, they pop! 💥 Don't cross your own trail either.</p>
      <p>🏁 Colour enough of the country (look for the black line on the bar) to win. Then it lights up on the world map! 🪙 Bigger countries give more coins, and finishing a whole continent gives 💎.</p>`,
  });

  // ---------- save ----------
  const SAVE = Park.game('world');
  SAVE.done = SAVE.done || {}; SAVE.best = SAVE.best || {}; SAVE.contDone = SAVE.contDone || {};

  // ---------- country facts ----------
  const NICE = {
    'United States of America': 'United States', 'W. Sahara': 'Western Sahara', 'Dem. Rep. Congo': 'DR Congo', 'Central African Rep.': 'Central African Republic',
    'Dominican Rep.': 'Dominican Republic', 'Eq. Guinea': 'Equatorial Guinea', 'Bosnia and Herz.': 'Bosnia & Herzegovina', 'Macedonia': 'North Macedonia',
    'Falkland Is.': 'Falkland Islands', 'Solomon Is.': 'Solomon Islands', 'Fr. S. Antarctic Lands': 'French Southern Lands', 'S. Sudan': 'South Sudan', 'N. Cyprus': 'Northern Cyprus',
  };
  const nice = (n) => NICE[n] || n;
  const CONT = {
    Europe: ['Russia', 'Norway', 'France', 'Sweden', 'Belarus', 'Ukraine', 'Poland', 'Austria', 'Hungary', 'Moldova', 'Romania', 'Lithuania', 'Latvia', 'Estonia', 'Germany', 'Bulgaria', 'Greece', 'Albania', 'Croatia', 'Switzerland', 'Luxembourg', 'Belgium', 'Netherlands', 'Portugal', 'Spain', 'Ireland', 'Italy', 'Denmark', 'United Kingdom', 'Iceland', 'Slovenia', 'Finland', 'Slovakia', 'Czechia', 'Bosnia and Herz.', 'Macedonia', 'Serbia', 'Montenegro', 'Kosovo', 'Cyprus', 'N. Cyprus'],
    Africa: ['Tanzania', 'W. Sahara', 'Dem. Rep. Congo', 'Somalia', 'Kenya', 'Sudan', 'Chad', 'South Africa', 'Lesotho', 'Zimbabwe', 'Botswana', 'Namibia', 'Senegal', 'Mali', 'Mauritania', 'Benin', 'Niger', 'Nigeria', 'Cameroon', 'Togo', 'Ghana', "Côte d'Ivoire", 'Guinea', 'Guinea-Bissau', 'Liberia', 'Sierra Leone', 'Burkina Faso', 'Central African Rep.', 'Congo', 'Gabon', 'Eq. Guinea', 'Zambia', 'Malawi', 'Mozambique', 'eSwatini', 'Angola', 'Burundi', 'Madagascar', 'Gambia', 'Tunisia', 'Algeria', 'Morocco', 'Egypt', 'Libya', 'Ethiopia', 'Djibouti', 'Somaliland', 'Uganda', 'Rwanda', 'Eritrea', 'S. Sudan'],
    'North America': ['Canada', 'United States of America', 'Mexico', 'Greenland', 'Haiti', 'Dominican Rep.', 'Bahamas', 'Panama', 'Costa Rica', 'Nicaragua', 'Honduras', 'El Salvador', 'Guatemala', 'Belize', 'Puerto Rico', 'Jamaica', 'Cuba', 'Trinidad and Tobago'],
    'South America': ['Argentina', 'Chile', 'Falkland Is.', 'Uruguay', 'Brazil', 'Bolivia', 'Peru', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'Ecuador', 'Paraguay'],
    Oceania: ['Fiji', 'Papua New Guinea', 'Vanuatu', 'New Caledonia', 'Solomon Is.', 'New Zealand', 'Australia'],
    Antarctica: ['Antarctica', 'Fr. S. Antarctic Lands'],
  };
  const CONT_ORDER = ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania', 'Antarctica'];
  const CONT_EMOJI = { Europe: '🏰', Africa: '🦁', Asia: '🐼', 'North America': '🦅', 'South America': '🦜', Oceania: '🦘', Antarctica: '🐧' };
  const continentOf = (n) => { for (const k in CONT) if (CONT[k].includes(n)) return k; return 'Asia'; };
  const TIERS = [
    { name: 'Tiny', maxKm: 50e3, cells: 650, rivals: 2, target: 70, coins: 10, stars: 1, rspeed: 4.4, aggr: 0.12 },
    { name: 'Small', maxKm: 250e3, cells: 1000, rivals: 2, target: 70, coins: 15, stars: 2, rspeed: 4.7, aggr: 0.15 },
    { name: 'Medium', maxKm: 800e3, cells: 1450, rivals: 3, target: 65, coins: 25, stars: 3, rspeed: 5.0, aggr: 0.2 },
    { name: 'Big', maxKm: 2.5e6, cells: 2000, rivals: 3, target: 65, coins: 35, stars: 4, rspeed: 5.2, aggr: 0.25 },
    { name: 'Huge', maxKm: Infinity, cells: 2700, rivals: 4, target: 60, coins: 50, stars: 5, rspeed: 5.4, aggr: 0.3 },
  ];
  const KM2_PER_DEG2 = 12364;
  const MAP_TOP = 84, MAP_H = 84 + 66, MAP_W = 360;

  function hashHue(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
  function ringArea(r) { // shoelace on lon/lat, corrected by cos(lat): square degrees at the equator
    let s = 0, lat = 0;
    for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; lat += a[1]; }
    return Math.abs(s / 2) * Math.cos((lat / r.length) * Math.PI / 180);
  }
  const shoelace = (r) => { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
  const centroid = (r) => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };

  // ---------- load the world ----------
  let countries = [];
  const byName = {};
  let suggestOrder = [];
  let totalArea = 1;

  function prep(topo) {
    const fc = topojson.feature(topo, topo.objects.countries);
    countries = [];
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      if (!polys.length) continue;
      const name = f.properties.name;
      const path = new Path2D();
      let area = 0, best = -1, cx = 0, cy = 0, bb = null;
      for (const poly of polys) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], j) => { const x = lon + 180, y = MAP_TOP - lat; if (j) path.lineTo(x, y); else path.moveTo(x, y); });
          path.closePath();
        }
        const a = ringArea(poly[0]); area += a;
        if (a > best) {
          best = a; [cx, cy] = centroid(poly[0]);
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (const [lon, lat] of poly[0]) { x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat); }
          bb = [x0, y0, x1, y1];
        }
      }
      const km = area * KM2_PER_DEG2;
      const tier = TIERS.find(t => km < t.maxKm);
      const compact = best / Math.max(1e-6, (bb[2] - bb[0]) * (bb[3] - bb[1]) * Math.cos(cy * Math.PI / 180));
      const C = { name, nice: nice(name), cont: continentOf(name), polys, path, area, km, tier, cx: cx + 180, cy: MAP_TOP - cy, bb, nPolys: polys.length, hue: hashHue(name), compact };
      C.score = tier.stars + (1 - Math.min(1, compact)) * 1.6 + (C.nPolys > 2 ? 0.8 : 0) + (C.cont === 'Antarctica' ? 3 : 0);
      countries.push(C); byName[name] = C;
    }
    totalArea = countries.reduce((s, c) => s + c.area, 0);
    suggestOrder = countries.slice().sort((a, b) => a.score - b.score);
  }

  async function loadWorld() {
    const st = $('#status');
    st.hidden = false; st.innerHTML = '<div><span class="big">🌍</span>Unrolling the world map…</div>';
    try {
      if (typeof topojson === 'undefined') throw new Error('no topojson');
      const res = await fetch(ATLAS);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      prep(await res.json());
      st.hidden = true;
      const first = suggestOrder.find(c => !SAVE.done[c.name]) || suggestOrder[0];
      select(first, false);
      refreshMapUI();
    } catch (e) {
      st.innerHTML = `<div><span class="big">📡</span><b>Oops, the world map couldn't download.</b><br>This game needs the internet to fetch the map. Check you're online, then<br><button class="play" id="retry" style="margin-top:10px;align-self:center">🔄 Try again</button></div>`;
      // the topojson helper may also have failed to load: reload the page in that case
      $('#retry').onclick = () => { if (typeof topojson === 'undefined') location.reload(); else loadWorld(); };
      $('#pick').innerHTML = '<p class="muted">The map is needed before you can play. 🌐</p>';
    }
  }

  // =====================================================================
  //  WORLD MAP SCREEN
  // =====================================================================
  const mapCv = $('#worldMap'), mapCtx = mapCv.getContext('2d');
  const view = { k: 1, x: MAP_W / 2, y: MAP_H / 2 };
  let selected = null, contFilter = null, celebrate = null, mode = 'map';
  let mapDpr = 1, mapW = 300, mapH = 125;

  function sizeMap() {
    mapDpr = Math.min(2, window.devicePixelRatio || 1);
    mapW = mapCv.clientWidth || 300; mapH = Math.round(mapW * MAP_H / MAP_W);
    mapCv.style.height = mapH + 'px';
    mapCv.width = Math.round(mapW * mapDpr); mapCv.height = Math.round(mapH * mapDpr);
  }
  function mapScale() { return (mapW / MAP_W) * view.k; }
  function clampView() {
    const s = mapScale(), hw = mapW / 2 / s, hh = mapH / 2 / s;
    view.x = Math.min(MAP_W - hw, Math.max(hw, view.x));
    view.y = Math.min(MAP_H - hh, Math.max(hh, view.y));
    mapCv.style.touchAction = view.k > 1.01 ? 'none' : 'pan-y';
  }
  const toMap = (px, py) => { const s = mapScale(); return [view.x + (px - mapW / 2) / s, view.y + (py - mapH / 2) / s]; };
  const toScreen = (mx, my) => { const s = mapScale(); return [(mx - view.x) * s + mapW / 2, (my - view.y) * s + mapH / 2]; };

  function drawMap(t) {
    const ctx = mapCtx, s = mapScale();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0, 0, mapCv.width, mapCv.height);
    if (!countries.length) return;
    const d = mapDpr * s;
    ctx.setTransform(d, 0, 0, d, (mapW / 2 - view.x * s) * mapDpr, (mapH / 2 - view.y * s) * mapDpr);
    // faint grid lines
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8 / s; ctx.beginPath();
    for (let x = 0; x <= 360; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); }
    for (let lat = 60; lat >= -60; lat -= 30) { ctx.moveTo(0, MAP_TOP - lat); ctx.lineTo(360, MAP_TOP - lat); }
    ctx.stroke();
    const next = new Set(suggestOrder.filter(c => !SAVE.done[c.name]).slice(0, 4));
    for (const C of countries) {
      const done = !!SAVE.done[C.name];
      ctx.fillStyle = done ? `hsl(${C.hue},85%,58%)` : next.has(C) ? '#c7d2fe' : '#d6dce4';
      if (contFilter && C.cont !== contFilter && !done) ctx.fillStyle = '#e8ecf1';
      ctx.fill(C.path, 'evenodd');
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7 / s; ctx.lineJoin = 'round';
    for (const C of countries) ctx.stroke(C.path);
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 220);
      ctx.fillStyle = SAVE.done[selected.name] ? `hsl(${selected.hue},90%,${55 + pulse * 10}%)` : `rgba(253,224,71,${0.75 + pulse * 0.25})`;
      ctx.fill(selected.path, 'evenodd');
      ctx.strokeStyle = '#be185d'; ctx.lineWidth = (2 + pulse) / s; ctx.stroke(selected.path);
      // tiny countries get a ring so you can find them
      const [x0, y0, x1, y1] = selected.bb;
      if ((x1 - x0) * s < 16 && (y1 - y0) * s < 16) {
        ctx.beginPath(); ctx.arc(selected.cx, selected.cy, (12 + pulse * 4) / s, 0, 7); ctx.strokeStyle = '#be185d'; ctx.lineWidth = 2.5 / s; ctx.stroke();
      }
    }
    if (celebrate) {
      const age = (t - celebrate.t) / 1000;
      if (age > 3) celebrate = null;
      else {
        ctx.beginPath(); ctx.arc(celebrate.C.cx, celebrate.C.cy, (10 + age * 40) / s, 0, 7);
        ctx.strokeStyle = `rgba(236,72,153,${1 - age / 3})`; ctx.lineWidth = 4 / s; ctx.stroke();
      }
    }
  }

  function pickAt(px, py) {
    const [mx, my] = toMap(px, py);
    mapCtx.save(); mapCtx.setTransform(1, 0, 0, 1, 0, 0);
    let hit = null;
    for (const C of countries) if (mapCtx.isPointInPath(C.path, mx, my, 'evenodd')) { hit = C; break; }
    mapCtx.restore();
    if (hit) return hit;
    // nothing under the finger: pick the nearest small country (within ~26px)
    let bestD = 26, best = null;
    for (const C of countries) { const [sx, sy] = toScreen(C.cx, C.cy); const dd = Math.hypot(sx - px, sy - py); if (dd < bestD) { bestD = dd; best = C; } }
    return best;
  }

  // map pointer: tap = pick, drag = pan (when zoomed), pinch / wheel = zoom
  const ptrs = new Map();
  let drag = null;
  mapCv.addEventListener('pointerdown', (e) => {
    ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (ptrs.size === 1) drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, moved: false };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, moved: true }; }
    if (view.k > 1.01) try { mapCv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  });
  mapCv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !drag) return;
    ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (drag.pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      view.k = Math.min(10, Math.max(1, drag.k * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch)); clampView();
    } else if (!drag.pinch) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.hypot(dx, dy) > 7) drag.moved = true;
      if (drag.moved && view.k > 1.01) { const s = mapScale(); view.x = drag.vx - dx / s; view.y = drag.vy - dy / s; clampView(); }
    }
  });
  const endPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (drag && !drag.moved && !drag.pinch && e.type === 'pointerup') { const C = pickAt(e.offsetX, e.offsetY); if (C) { select(C, false); Park.sound('pop'); } }
    if (!ptrs.size) drag = null;
  };
  mapCv.addEventListener('pointerup', endPtr);
  mapCv.addEventListener('pointercancel', endPtr);
  mapCv.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && view.k <= 1.01 && e.deltaY > 0) return; // let the page scroll
    e.preventDefault();
    const [mx, my] = toMap(e.offsetX, e.offsetY);
    view.k = Math.min(10, Math.max(1, view.k * (e.deltaY < 0 ? 1.25 : 0.8)));
    const s = mapScale(); view.x = mx - (e.offsetX - mapW / 2) / s; view.y = my - (e.offsetY - mapH / 2) / s; clampView();
  }, { passive: false });
  $('#zin').onclick = () => { view.k = Math.min(10, view.k * 1.6); if (selected) { view.x = selected.cx; view.y = selected.cy; } clampView(); };
  $('#zout').onclick = () => { view.k = Math.max(1, view.k / 1.6); clampView(); };

  function focusOn(C) {
    const w = (C.bb[2] - C.bb[0]) || 1;
    view.k = Math.min(8, Math.max(1, MAP_W / (w * 7)));
    view.x = C.cx; view.y = C.cy; clampView();
  }

  function stars(n) { return '⭐'.repeat(n); }
  function select(C, zoom) {
    selected = C;
    if (zoom) focusOn(C);
    const done = !!SAVE.done[C.name], best = SAVE.best[C.name] || 0;
    $('#pick').innerHTML = `
      <p class="muted" style="margin:0">${CONT_EMOJI[C.cont]} ${C.cont}</p>
      <p class="name">${Park.esc(C.nice)}</p>
      <div class="facts">
        <span class="chip">${stars(C.tier.stars)} ${C.tier.name}</span>
        <span class="chip">🎯 Colour ${C.tier.target}%</span>
        <span class="chip">👾 ${C.tier.rivals} rivals</span>
        <span class="chip">🪙 ${done ? 3 : C.tier.coins}</span>
        ${done ? '<span class="chip done">✅ Coloured!</span>' : best ? `<span class="chip">Best: ${best}%</span>` : ''}
      </div>
      <button class="play" id="playBtn">▶ ${done ? 'Play again' : 'Play'}</button>`;
    $('#playBtn').onclick = () => startCountry(C);
    renderNext(); renderList();
  }

  function refreshMapUI() {
    const n = Object.keys(SAVE.done).filter(k => byName[k]).length;
    const area = countries.filter(c => SAVE.done[c.name]).reduce((s, c) => s + c.area, 0);
    const pct = countries.length ? 100 * area / totalArea : 0;
    $('#ringPct').textContent = (pct > 0 && pct < 1 ? pct.toFixed(2) : Math.round(pct * 10) / 10) + '%';
    $('#ring').style.background = `conic-gradient(#ec4899 ${pct * 3.6}deg, #e2e8f0 0)`;
    $('#doneCount').textContent = `${n} of ${countries.length} countries`;
    $('#doneSub').textContent = n ? 'of the world is coloured in!' : 'Pick a country to start!';
    renderConts(); renderNext(); renderList();
  }
  function renderConts() {
    const box = $('#conts'); box.innerHTML = '';
    for (const k of CONT_ORDER) {
      const list = countries.filter(c => c.cont === k); if (!list.length) continue;
      const d = list.filter(c => SAVE.done[c.name]).length;
      const b = document.createElement('button');
      b.className = 'cont' + (contFilter === k ? ' on' : '');
      b.innerHTML = `${CONT_EMOJI[k]} <b>${k}</b> ${SAVE.contDone[k] ? '💎' : ''}<div class="bar"><i style="width:${100 * d / list.length}%"></i></div><small>${d} / ${list.length} countries</small>`;
      b.onclick = () => { contFilter = contFilter === k ? null : k; renderConts(); renderList(); };
      box.appendChild(b);
    }
  }
  function renderNext() {
    const box = $('#next'); if (!box) return; box.innerHTML = '';
    const list = suggestOrder.filter(c => !SAVE.done[c.name]).slice(0, 5);
    if (!list.length) { box.innerHTML = '<span>🎉 You coloured the whole world!</span>'; return; }
    for (const C of list) {
      const b = document.createElement('button');
      b.className = selected === C ? 'sel' : '';
      b.textContent = `${CONT_EMOJI[C.cont]} ${C.nice}`;
      b.onclick = () => select(C, true);
      box.appendChild(b);
    }
  }
  function renderList() {
    const box = $('#clist'); box.innerHTML = '';
    const q = $('#search').value.trim().toLowerCase();
    const list = suggestOrder.filter(c => (!contFilter || c.cont === contFilter) && (!q || c.nice.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)));
    if (!list.length) { box.innerHTML = '<span class="muted">No country with that name on this map. Try another spelling!</span>'; return; }
    for (const C of list) {
      const b = document.createElement('button');
      const done = !!SAVE.done[C.name];
      b.className = (done ? 'd' : '') + (selected === C ? ' sel' : '');
      b.textContent = `${done ? '✅' : CONT_EMOJI[C.cont]} ${C.nice} ${stars(C.tier.stars)}`;
      b.onclick = () => { select(C, true); mapCv.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      box.appendChild(b);
    }
  }
  $('#search').addEventListener('input', renderList);

  // =====================================================================
  //  ARENA: rasterise the country into a grid
  // =====================================================================
  const PAD = 2;
  function buildArena(C) {
    let minLon = 1e9, maxLon = -1e9;
    for (const poly of C.polys) for (const [lon] of poly[0]) { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); }
    const wrap = maxLon - minLon > 200; // crosses the date line (Russia, Fiji…)
    const P = C.polys.map(poly => poly.map(ring => ring.map(([lon, lat]) => [wrap && lon < 0 ? lon + 360 : lon, lat])));
    let minLat = 90, maxLat = -90;
    for (const poly of P) for (const [, lat] of poly[0]) { minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }
    const kx = Math.max(0.25, Math.cos(((minLat + maxLat) / 2) * Math.PI / 180));
    let proj = P.map(poly => poly.map(ring => ring.map(([lon, lat]) => [lon * kx, -lat])));
    // keep the main island plus big nearby ones (France's mainland but not French Guiana)
    const areas = proj.map(poly => shoelace(poly[0]));
    let bi = 0; areas.forEach((a, i) => { if (a > areas[bi]) bi = i; });
    const bc = centroid(proj[bi][0]), reach = 3.5 * Math.sqrt(areas[bi]) + 2;
    const keepIdx = proj.map((p, i) => i).filter(i => i === bi || (areas[i] >= 0.08 * areas[bi] && Math.hypot(centroid(proj[i][0])[0] - bc[0], centroid(proj[i][0])[1] - bc[1]) < reach));
    proj = keepIdx.map(i => proj[i]);
    const keptArea = keepIdx.reduce((s, i) => s + areas[i], 0);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const poly of proj) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let s = Math.sqrt(keptArea / C.tier.cells);
    const MAXD = 230;
    let W = Math.ceil((x1 - x0) / s) + 2 * PAD + 1, H = Math.ceil((y1 - y0) / s) + 2 * PAD + 1;
    if (Math.max(W, H) > MAXD) { s *= Math.max(W, H) / MAXD; W = Math.ceil((x1 - x0) / s) + 2 * PAD + 1; H = Math.ceil((y1 - y0) / s) + 2 * PAD + 1; }
    const N = W * H;
    const outline = new Path2D();
    for (const poly of proj) for (const ring of poly) {
      ring.forEach(([x, y], j) => { const gx = (x - x0) / s + PAD, gy = (y - y0) / s + PAD; if (j) outline.lineTo(gx, gy); else outline.moveTo(gx, gy); });
      outline.closePath();
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#000'; c.fill(outline, 'evenodd');
    const px = c.getImageData(0, 0, W, H).data;
    const land = new Uint8Array(N), bridge = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (x < PAD || y < PAD || x >= W - PAD || y >= H - PAD) continue;
      if (px[i * 4 + 3] >= 110) land[i] = 1;
    }
    // connected pieces: keep the biggest, join big islands with bridges, drop specks
    const comp = new Int32Array(N).fill(-1), comps = [];
    for (let i = 0; i < N; i++) {
      if (!land[i] || comp[i] >= 0) continue;
      const id = comps.length, cells = [i]; comp[i] = id;
      for (let k = 0; k < cells.length; k++) {
        const q = cells[k];
        for (const nb of [q + 1, q - 1, q + W, q - W]) if (land[nb] && comp[nb] < 0) { comp[nb] = id; cells.push(nb); }
      }
      comps.push(cells);
    }
    comps.sort((a, b) => b.length - a.length);
    const inMain = new Uint8Array(N), main = comps.length ? comps[0].slice() : [];
    for (const q of main) inMain[q] = 1;
    for (let k = 1; k < comps.length; k++) {
      const B = comps[k];
      if (B.length < Math.max(14, 0.04 * comps[0].length)) continue;
      const sb = Math.max(1, Math.floor(B.length / 220)), sm = Math.max(1, Math.floor(main.length / 700));
      let bd = 1e9, ba = 0, bb2 = 0;
      for (let i = 0; i < B.length; i += sb) {
        const bx = B[i] % W, by = (B[i] / W) | 0;
        for (let j = 0; j < main.length; j += sm) {
          const mx = main[j] % W, my = (main[j] / W) | 0, dd = (bx - mx) ** 2 + (by - my) ** 2;
          if (dd < bd) { bd = dd; ba = main[j]; bb2 = B[i]; }
        }
      }
      const ax = ba % W, ay = (ba / W) | 0, bx = bb2 % W, by = (bb2 / W) | 0, steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1;
      for (let t = 0; t <= steps; t++) {
        const lx = Math.round(ax + (bx - ax) * t / steps), ly = Math.round(ay + (by - ay) * t / steps);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const X = lx + ox, Y = ly + oy; if (X < PAD || Y < PAD || X >= W - PAD || Y >= H - PAD) continue;
          const q = Y * W + X; if (!inMain[q]) { inMain[q] = 1; main.push(q); if (!land[q]) bridge[q] = 1; }
        }
      }
      for (const q of B) if (!inMain[q]) { inMain[q] = 1; main.push(q); }
    }
    for (let i = 0; i < N; i++) { land[i] = inMain[i]; if (!land[i]) bridge[i] = 0; }
    // distance to the sea (for good start spots)
    const dsea = new Int16Array(N).fill(-1), qq = [];
    for (let i = 0; i < N; i++) if (!land[i]) { dsea[i] = 0; qq.push(i); }
    for (let k = 0; k < qq.length; k++) {
      const q = qq[k], x = q % W;
      for (const nb of [x < W - 1 ? q + 1 : -1, x > 0 ? q - 1 : -1, q + W, q - W]) if (nb >= 0 && nb < N && dsea[nb] < 0) { dsea[nb] = dsea[q] + 1; qq.push(nb); }
    }
    return { W, H, N, land, bridge, dsea, outline, total: main.length };
  }

  // =====================================================================
  //  PLAY
  // =====================================================================
  const RIVALS = [
    { name: 'Mango', color: '#f59e0b' }, { name: 'Pip', color: '#22c55e' }, { name: 'Bloop', color: '#3b82f6' },
    { name: 'Zuzu', color: '#a855f7' }, { name: 'Ruby', color: '#ef4444' }, { name: 'Coco', color: '#14b8a6' }, { name: 'Fizz', color: '#f472b6' },
  ];
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const u32 = ([r, g, b], a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const gameCv = $('#game'), gctx = gameCv.getContext('2d');
  let G = null;

  function makeEnt(id, name, color, isPlayer) {
    const rgb = hexRgb(color);
    return {
      id, name, color, isPlayer, alive: true, trail: [], cell: 0, prev: 0, prog: 0, fx: 0, fy: 0, dir: 0, mode: 'home', legs: [], legDir: 0, turn: 1, homeWait: 0,
      terrU: u32(rgb), terrU2: u32(mix(rgb, [0, 0, 0], 0.08)), trailU: u32(mix(rgb, [255, 255, 255], 0.5)), respawn: 0, lastHome: -1, dark: `rgb(${mix(rgb, [0, 0, 0], 0.3).join(',')})`,
    };
  }

  function startCountry(C) {
    let A;
    try { A = buildArena(C); } catch (e) { Park.toast('Hmm, that country would not load. Try another!'); console.error(e); return; }
    const { W, H, N } = A;
    const playerColor = Park.state.avatar.outfit && Park.state.avatar.outfit !== '#f8fafc' && Park.state.avatar.outfit !== '#111827' ? Park.state.avatar.outfit : '#ec4899';
    const pr = hexRgb(playerColor);
    const rivals = RIVALS.filter(r => { const c = hexRgb(r.color); return Math.hypot(c[0] - pr[0], c[1] - pr[1], c[2] - pr[2]) > 120; });
    const rnd = Park.rng((Date.now() & 0xffff) ^ hashHue(C.name));
    G = {
      C, A, W, H, N, land: A.land, owner: new Uint8Array(N), trail: new Uint8Array(N), lab: new Int32Array(N), stack: new Int32Array(N + 8),
      bstamp: new Int32Array(N), bprev: new Int32Array(N), bq: new Int32Array(N), stampN: 0,
      ents: [], counts: [], target: C.tier.target, lives: 3, started: false, over: false, t: 0, fx: [], rnd,
      gridCv: document.createElement('canvas'), dirty: true, keys: new Set(), ptr: null, pctShown: -1,
    };
    G.gridCv.width = W; G.gridCv.height = H;
    G.gctx = G.gridCv.getContext('2d');
    G.img = G.gctx.createImageData(W, H);
    G.px = new Uint32Array(G.img.data.buffer);
    G.neutral = [u32([246, 238, 216]), u32([238, 228, 203])];
    G.bridgeU = [u32([214, 164, 107]), u32([201, 148, 96])];
    const P = makeEnt(1, 'You', playerColor, true);
    P.speed = 6 + C.tier.stars * 0.25;
    P.vx = 1; P.vy = 0;
    G.ents.push(P);
    const nR = Math.min(C.tier.rivals, rivals.length);
    const order = rivals.slice().sort(() => rnd() - 0.5);
    for (let i = 0; i < nR; i++) {
      const r = makeEnt(2 + i, order[i].name, order[i].color, false);
      r.speed = C.tier.rspeed * (0.92 + rnd() * 0.12); r.aggr = C.tier.aggr; G.ents.push(r);
    }
    for (let i = 0; i < N; i++) paint(i);
    // player start: the cosiest spot (far from the coast, near the middle)
    let best = -1, bs = -1e9;
    const cxm = W / 2, cym = H / 2;
    for (let i = 0; i < N; i++) {
      if (!A.land[i]) continue;
      const sc = Math.min(A.dsea[i], 6) * 10 - Math.hypot(i % W - cxm, ((i / W) | 0) - cym) * 0.3;
      if (sc > bs) { bs = sc; best = i; }
    }
    spawnPatch(P, best, 3);
    for (const r of G.ents) if (!r.isPlayer) { const sp = findSpawn(); if (sp >= 0) spawnPatch(r, sp, 2); else r.alive = false; }
    recount();
    // screen
    mode = 'play';
    document.body.classList.add('playing');
    $('#mapScreen').hidden = true; $('#playScreen').hidden = false;
    $('#hName').textContent = C.nice;
    $('#hGoal').style.left = C.tier.target + '%';
    $('#hFill').style.background = playerColor;
    $('#sTitle').textContent = `${CONT_EMOJI[C.cont]} ${C.nice}`;
    $('#sText').innerHTML = `Colour <b>${C.tier.target}%</b> of ${Park.esc(C.nice)} to win! Watch out for ${G.ents.length - 1} rival blobs.`;
    $('#startov').hidden = false;
    updateHud(true);
    sizeGame();
    window.scrollTo(0, 0);
  }

  function paint(i) {
    const g = G, x = i % g.W, y = (i / g.W) | 0, ch = (x + y) & 1;
    let c = 0;
    if (g.land[i]) {
      if (g.trail[i]) c = g.ents[g.trail[i] - 1].trailU;
      else if (g.owner[i]) { const e = g.ents[g.owner[i] - 1]; c = ch ? e.terrU2 : e.terrU; }
      else c = g.A.bridge[i] ? g.bridgeU[ch] : g.neutral[ch];
    }
    g.px[i] = c; g.dirty = true;
  }

  function findSpawn() {
    const g = G, P = g.ents[0];
    for (let tries = 0; tries < 400; tries++) {
      const i = Math.floor(g.rnd() * g.N);
      if (!g.land[i] || g.A.dsea[i] < 2) continue;
      const x = i % g.W, y = (i / g.W) | 0;
      let ok = true;
      for (let oy = -2; oy <= 2 && ok; oy++) for (let ox = -2; ox <= 2 && ok; ox++) { const q = i + ox + oy * g.W; if (!g.land[q] || g.owner[q] || g.trail[q]) ok = false; }
      if (!ok) continue;
      const px = P.cell % g.W, py = (P.cell / g.W) | 0;
      const far = Math.max(6, Math.min(14, Math.sqrt(g.A.total) / 4));
      if (P.alive && Math.hypot(px - x, py - y) < far && tries < 300) continue;
      let near = false;
      for (const e of g.ents) if (!e.isPlayer && e.alive && e.cell && Math.hypot(e.cell % g.W - x, ((e.cell / g.W) | 0) - y) < 6) near = true;
      if (near && tries < 300) continue;
      return i;
    }
    return -1;
  }

  function spawnPatch(e, center, r) {
    const g = G, cx = center % g.W, cy = (center / g.W) | 0;
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      if (ox * ox + oy * oy > r * r + 1) continue;
      const X = cx + ox, Y = cy + oy; if (X < 0 || Y < 0 || X >= g.W || Y >= g.H) continue;
      const q = Y * g.W + X; if (!g.land[q]) continue;
      if (g.trail[q]) { const o = g.ents[g.trail[q] - 1]; o.trail = o.trail.filter(c => c !== q); g.trail[q] = 0; }
      g.owner[q] = e.id; paint(q);
    }
    e.alive = true; e.cell = e.prev = center; e.lastHome = center; e.prog = 0; e.trail = [];
    e.fx = cx + 0.5; e.fy = cy + 0.5; e.mode = 'home'; e.homeWait = 1 + Math.floor(g.rnd() * 4); e.dir = Math.floor(g.rnd() * 4);
  }

  function recount() {
    const g = G, c = new Array(g.ents.length + 2).fill(0);
    for (let i = 0; i < g.N; i++) if (g.owner[i]) c[g.owner[i]]++;
    g.counts = c;
  }
  const pctOf = (id) => Math.floor(100 * (G.counts[id] || 0) / G.A.total);

  // a creature steps into cell c
  function enter(e, c) {
    const g = G;
    if (!e.alive || g.over) return;
    e.prev = e.cell; e.cell = c;
    const t = g.trail[c];
    if (t && t !== e.id) knock(g.ents[t - 1], e);
    if (!e.alive || g.over) return;
    if (g.trail[c] === e.id) {
      if (e.trail.lastIndexOf(c) < e.trail.length - 4) knock(e, e);
      return;
    }
    if (g.owner[c] === e.id) { e.lastHome = c; if (e.trail.length) claim(e); return; }
    g.trail[c] = e.id; e.trail.push(c); paint(c);
  }

  function addFx(x, y, text, color) { G.fx.push({ x, y, text, color, t: 0 }); }

  function knock(v, by) {
    const g = G;
    if (!v.alive) return;
    for (const c of v.trail) if (g.trail[c] === v.id) { g.trail[c] = 0; paint(c); }
    v.trail = [];
    addFx(v.fx, v.fy, '💥');
    if (v.isPlayer) {
      g.lives--;
      Park.sound('bad');
      Park.toast(!g.counts[1] ? 'Oh no, your patch was taken! 😮' : by === v ? 'Oops! You crossed your own trail 🌀' : by ? `Oops! ${by.name} bumped your trail 💥` : 'Oops! 💥');
      if (g.lives <= 0) { v.alive = false; updateHud(true); gameOver(); return; }
      // back home
      let home = g.owner[v.lastHome] === 1 ? v.lastHome : -1;
      if (home < 0) { for (let i = 0; i < g.N; i++) if (g.owner[i] === 1) { home = i; break; } }
      if (home < 0) { const sp = findSpawn(); spawnPatch(v, sp >= 0 ? sp : v.cell, 3); recount(); }
      else { v.cell = v.prev = home; v.fx = home % g.W + 0.5; v.fy = ((home / g.W) | 0) + 0.5; }
      v.ghost = 1.2;
      updateHud(true);
    } else {
      v.alive = false; v.respawn = 5 + g.rnd() * 3;
      for (let i = 0; i < g.N; i++) if (g.owner[i] === v.id) { g.owner[i] = 0; paint(i); }
      recount();
      if (by && by.isPlayer) { Park.sound('pop'); Park.toast(`You popped ${v.name}! 💥`); Park.addCoins(1); }
    }
  }

  function claim(e) {
    const g = G, { W, N, land, owner, trail, lab, stack } = g, id = e.id;
    const loopLen = e.trail.length;
    for (const c of e.trail) { trail[c] = 0; owner[c] = id; paint(c); }
    e.trail = [];
    // split the rest of the land into regions. Regions walled in only by your colour are yours;
    // regions squeezed against the coast are yours too if they're not too big for the loop you drew
    lab.fill(0);
    const sizes = [0], coast = [0];
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (!land[i] || owner[i] === id || lab[i]) continue;
      n++; let sz = 0, sp = 0, sea = 0; stack[sp++] = i; lab[i] = n;
      while (sp) {
        const q = stack[--sp]; sz++;
        for (const nb of [q + 1, q - 1, q + W, q - W]) {
          if (!land[nb]) { sea = 1; continue; }
          if (owner[nb] !== id && !lab[nb]) { lab[nb] = n; stack[sp++] = nb; }
        }
      }
      sizes.push(sz); coast.push(sea);
    }
    if (n > 1) {
      let big = 1; for (let k = 2; k <= n; k++) if (sizes[k] > sizes[big]) big = k;
      const limit = Math.max(40, (loopLen * loopLen) / (e.isPlayer ? 3 : 7));
      const take = new Uint8Array(n + 1);
      for (let k = 1; k <= n; k++) take[k] = k !== big && (!coast[k] || sizes[k] <= limit) ? 1 : 0;
      for (let i = 0; i < N; i++) if (lab[i] && take[lab[i]]) { owner[i] = id; paint(i); }
    }
    recount();
    if (e.isPlayer) Park.sound('good');
    // anyone who lost their whole patch pops
    for (const o of g.ents) if (o !== e && o.alive && !g.counts[o.id]) knock(o, e);
    if (e.isPlayer) { updateHud(true); if (pctOf(1) >= g.target) win(); }
    else updateHud(false);
  }

  // ---------- rival brains ----------
  function safe(r, c) { return G.land[c] && G.trail[c] !== r.id; }
  function bfsHome(r) {
    const g = G, { W, land, trail, owner, bstamp, bprev, bq } = g;
    const st = ++g.stampN;
    let h = 0, tl = 0; bq[tl++] = r.cell; bstamp[r.cell] = st; bprev[r.cell] = -1;
    while (h < tl) {
      const q = bq[h++];
      if (owner[q] === r.id && q !== r.cell) {
        let c = q; while (bprev[c] !== r.cell && bprev[c] >= 0) c = bprev[c];
        for (let d = 0; d < 4; d++) if (r.cell + DX[d] + DY[d] * W === c) return d;
        return -1;
      }
      for (let d = 0; d < 4; d++) {
        const nb = q + DX[d] + DY[d] * W;
        if (bstamp[nb] === st || !land[nb] || trail[nb] === r.id) continue;
        bstamp[nb] = st; bprev[nb] = q; bq[tl++] = nb;
      }
    }
    return -1;
  }
  function towards(r, tx, ty) {
    const W = G.W, x = r.cell % W, y = (r.cell / W) | 0;
    let best = -1, bd = 1e9;
    for (let d = 0; d < 4; d++) {
      if (d === (r.dir + 2) % 4 && r.trail.length) continue;
      const nc = r.cell + DX[d] + DY[d] * W; if (!safe(r, nc)) continue;
      const dd = Math.abs(x + DX[d] - tx) + Math.abs(y + DY[d] - ty) + G.rnd() * 0.5;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }
  function chooseDir(r) {
    const g = G, W = g.W, P = g.ents[0];
    const home = g.owner[r.cell] === r.id;
    const x = r.cell % W, y = (r.cell / W) | 0;
    if (home && !r.trail.length && r.mode !== 'home' && r.mode !== 'out') { r.mode = 'home'; r.homeWait = 2 + Math.floor(g.rnd() * 6); }
    let want = -1;
    // danger: the player is close to our trail head → hurry home
    if (r.trail.length && P.alive) {
      const pd = Math.abs((P.cell % W) - x) + Math.abs(((P.cell / W) | 0) - y);
      if (pd < 4 || r.trail.length > 10 + g.C.tier.stars * 4) r.mode = 'return';
    }
    // sometimes chase the player's trail
    if (P.alive && P.trail.length && r.trail.length < 8 && g.rnd() < r.aggr) {
      let bd = 7, tgt = -1;
      for (let k = Math.max(0, P.trail.length - 60); k < P.trail.length; k++) {
        const c = P.trail[k], d = Math.abs(c % W - x) + Math.abs(((c / W) | 0) - y);
        if (d < bd) { bd = d; tgt = c; }
      }
      if (tgt >= 0) want = towards(r, tgt % W, (tgt / W) | 0);
    }
    if (want < 0) {
      if (r.mode === 'return') {
        want = bfsHome(r);
        if (want < 0) return -1;
      } else if (r.mode === 'home') {
        // rivals stop growing once they're big enough, so the country can always be won
        const cap = 0.7 * (100 - g.target) / 100 / Math.max(1, g.ents.length - 1);
        if ((g.counts[r.id] || 0) > cap * g.A.total) {
          r.homeWait = 3;
          const stay = [0, 1, 2, 3].filter(d => g.owner[r.cell + DX[d] + DY[d] * W] === r.id);
          if (stay.length) return stay.includes(r.dir) && g.rnd() < 0.7 ? r.dir : stay[Math.floor(g.rnd() * stay.length)];
        }
        if (--r.homeWait <= 0) {
          r.mode = 'out'; r.legDir = Math.floor(g.rnd() * 4); r.turn = g.rnd() < 0.5 ? 1 : 3;
          const L = 3 + g.C.tier.stars;
          r.legs = [2 + Math.floor(g.rnd() * L), 2 + Math.floor(g.rnd() * L), 2 + Math.floor(g.rnd() * L)];
        }
        want = g.rnd() < 0.3 ? Math.floor(g.rnd() * 4) : r.dir;
      }
      if (r.mode === 'out') {
        if (!home) { r.legs[0]--; if (r.legs[0] <= 0) { r.legs.shift(); r.legDir = (r.legDir + r.turn) % 4; } }
        if (!r.legs.length) { r.mode = 'return'; want = bfsHome(r); if (want < 0) return -1; }
        else want = r.legDir;
      }
    }
    const back = (r.dir + 2) % 4;
    const ok = (d) => d >= 0 && safe(r, r.cell + DX[d] + DY[d] * W) && !(d === back && r.trail.length);
    if (ok(want)) return want;
    if (r.mode === 'out') r.legDir = (r.legDir + r.turn) % 4;
    const opts = [0, 1, 2, 3].filter(ok);
    if (opts.length) return opts[Math.floor(g.rnd() * opts.length)];
    return safe(r, r.cell + DX[back] + DY[back] * W) ? back : -1;
  }
  function rivalStep(r) {
    const d = chooseDir(r);
    if (d < 0) { knock(r, null); return; }
    r.dir = d;
    enter(r, r.cell + DX[d] + DY[d] * G.W);
  }

  // ---------- player movement ----------
  function steerPlayer() {
    const g = G, P = g.ents[0];
    let vx = 0, vy = 0;
    const k = g.keys;
    if (k.has('left')) vx -= 1; if (k.has('right')) vx += 1; if (k.has('up')) vy -= 1; if (k.has('down')) vy += 1;
    if (vx || vy) { const l = Math.hypot(vx, vy); P.vx = vx / l; P.vy = vy / l; return; }
    const p = g.ptr;
    if (p) {
      const dx = p.x - p.ax, dy = p.y - p.ay, l = Math.hypot(dx, dy);
      if (l > 16) { P.vx = dx / l; P.vy = dy / l; p.slid = true; }
      else if (!p.slid && performance.now() - p.t0 > 220 && g.view) {
        // holding still: walk towards the finger
        const sx = (P.fx - g.view.cx) * g.view.cp, sy = (P.fy - g.view.cy) * g.view.cp;
        const ex = p.x - sx, ey = p.y - sy, el = Math.hypot(ex, ey);
        if (el > g.view.cp * 0.8) { P.vx = ex / el; P.vy = ey / el; }
      }
    }
  }
  function movePlayer(dt) {
    const g = G, P = g.ents[0], W = g.W;
    if (!P.alive) return;
    let dist = P.speed * dt;
    while (dist > 1e-6 && P.alive && !g.over) {
      const d = Math.min(dist, 0.35); dist -= d;
      const tries = [[P.vx * d, P.vy * d], [Math.sign(P.vx) * d * (Math.abs(P.vx) > 0.2 ? 1 : 0), 0], [0, Math.sign(P.vy) * d * (Math.abs(P.vy) > 0.2 ? 1 : 0)]];
      let moved = false;
      for (const [dx, dy] of tries) {
        if (!dx && !dy) continue;
        const nx = P.fx + dx, ny = P.fy + dy, c = Math.floor(ny) * W + Math.floor(nx);
        if (!g.land[c]) continue;
        const ox = Math.floor(P.fx), oy = Math.floor(P.fy);
        P.fx = nx; P.fy = ny; moved = true;
        const cx = Math.floor(nx), cy = Math.floor(ny);
        if (cx !== ox || cy !== oy) {
          if (cx !== ox && cy !== oy) { // diagonal: step through a side cell so trails stay joined
            const m1 = oy * W + cx, m2 = cy * W + ox;
            enter(P, g.land[m1] ? m1 : m2);
          }
          if (P.alive && !g.over && P.cell !== c) enter(P, c);
        }
        break;
      }
      if (!moved) break;
    }
  }

  // ---------- update / draw ----------
  function update(dt) {
    const g = G; if (!g || g.over) return;
    g.t += dt;
    for (const f of g.fx) f.t += dt;
    g.fx = g.fx.filter(f => f.t < 1);
    if (!g.started) return;
    steerPlayer();
    const P = g.ents[0];
    if (P.ghost) P.ghost = Math.max(0, P.ghost - dt);
    movePlayer(dt);
    for (const r of g.ents) {
      if (r.isPlayer || g.over) continue;
      if (!r.alive) {
        r.respawn -= dt;
        if (r.respawn <= 0) { const sp = findSpawn(); if (sp >= 0) { spawnPatch(r, sp, 2); recount(); updateHud(false); } else r.respawn = 2; }
        continue;
      }
      r.prog += r.speed * dt;
      while (r.prog >= 1 && r.alive && !g.over) { r.prog -= 1; rivalStep(r); }
    }
  }

  function sizeGame() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    gameCv.width = Math.round(gameCv.clientWidth * dpr); gameCv.height = Math.round(gameCv.clientHeight * dpr);
    if (G) { G.dpr = dpr; G.topPad = 0; }
  }

  function drawBlob(ctx, x, y, r, e, t) {
    const sq = 1 + Math.sin(t * 10 + e.id) * 0.06;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.9, r * 0.3, 0, 0, 7); ctx.fill();
    ctx.scale(1 / sq, sq);
    ctx.fillStyle = e.color; ctx.strokeStyle = e.dark; ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.3, r * 0.18, -0.5, 0, 7); ctx.fill();
    const lx = DX[e.dir] * r * 0.15, ly = DY[e.dir] * r * 0.15;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * 0.33, -r * 0.1, r * 0.26, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(s * r * 0.33 + lx, -r * 0.1 + ly, r * 0.13, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(244,114,182,.6)'; ctx.beginPath(); ctx.arc(-r * 0.6, r * 0.25, r * 0.12, 0, 7); ctx.arc(r * 0.6, r * 0.25, r * 0.12, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.beginPath(); ctx.arc(0, r * 0.22, r * 0.2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
  }
  function drawPlayer(ctx, x, y, r, P, t) {
    ctx.save();
    if (P.ghost) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 12));
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.95, r * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = P.color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth / 2, 0, 7); ctx.clip();
    ctx.fillStyle = '#fff7ed'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    const s = (r * 0.6) / 17;
    Park.drawAvatar(ctx, x, y + 84 * s + r * 0.08, 100 * s, Park.state.avatar, { face: P.vx < -0.1 ? -1 : 1 });
    ctx.restore();
    ctx.restore();
  }

  function draw() {
    const g = G; if (!g) return;
    const ctx = gctx, dpr = g.dpr || 1, vw = gameCv.width / dpr, vh = gameCv.height / dpr;
    if (!vw || !vh) return;
    if (g.dirty) { g.gctx.putImageData(g.img, 0, 0); g.dirty = false; }
    if (!g.topPad) g.topPad = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top')) || 62) + 50;
    const topPad = g.topPad;
    const avH = vh - topPad - 10, avW = vw - 20;
    const innerW = g.W - 2 * PAD + 2, innerH = g.H - 2 * PAD + 2;
    const fit = Math.min(avW / innerW, avH / innerH);
    const want = Math.max(12, Math.min(30, Math.min(vw, vh) / 26));
    const cp = Math.min(40, Math.max(fit, want));
    const P = g.ents[0];
    // camera: follow the player, but keep the map on screen
    const viewW = vw / cp, viewH = avH / cp;
    let cx, cy;
    if (g.W * cp <= vw) cx = g.W / 2 - viewW / 2; else cx = Math.min(g.W - viewW, Math.max(0, P.fx - viewW / 2));
    if (g.H * cp <= avH) cy = g.H / 2 - viewH / 2; else cy = Math.min(g.H - viewH, Math.max(0, P.fy - viewH / 2));
    cy -= topPad / cp;
    if (g.view && g.view.cp === cp && Math.abs(cx - g.view.cx) < viewW / 3 && Math.abs(cy - g.view.cy) < viewH / 3) { g.view.cx += (cx - g.view.cx) * 0.25; g.view.cy += (cy - g.view.cy) * 0.25; }
    else g.view = { cx, cy, cp };
    const V = g.view;
    // sea
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#5ec3ef'; ctx.fillRect(0, 0, vw, vh);
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.beginPath();
    const wv = (g.t * 12) % 40;
    for (let y = 30 - ((V.cy * cp) % 60 + 60) % 60; y < vh; y += 60) for (let x = -40 + wv - ((V.cx * cp) % 80 + 80) % 80; x < vw; x += 80) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 6, x + 20, y); ctx.quadraticCurveTo(x + 30, y + 6, x + 40, y); }
    ctx.stroke();
    // land grid
    ctx.setTransform(dpr * cp, 0, 0, dpr * cp, -V.cx * cp * dpr, -V.cy * cp * dpr);
    ctx.fillStyle = 'rgba(15,60,90,.18)'; ctx.fill(g.A.outline, 'evenodd');
    ctx.save(); ctx.translate(0.25, 0.35); ctx.globalAlpha = 0.25; ctx.imageSmoothingEnabled = false; ctx.drawImage(g.gridCv, 0, 0); ctx.restore();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(g.gridCv, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2 / cp; ctx.stroke(g.A.outline);
    // creatures
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.max(11, Math.min(26, cp * 0.95));
    ctx.font = `600 ${Math.round(Math.max(11, R * 0.6))}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    for (const r of g.ents) {
      if (r.isPlayer || !r.alive) continue;
      const fx = (r.prev % g.W) + ((r.cell % g.W) - (r.prev % g.W)) * Math.min(1, r.prog) + 0.5;
      const fy = ((r.prev / g.W) | 0) + (((r.cell / g.W) | 0) - ((r.prev / g.W) | 0)) * Math.min(1, r.prog) + 0.5;
      r.fx = fx; r.fy = fy;
      const sx = (fx - V.cx) * cp, sy = (fy - V.cy) * cp;
      if (sx < -50 || sy < -50 || sx > vw + 50 || sy > vh + 50) continue;
      drawBlob(ctx, sx, sy, R * 0.85, r, g.t);
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(r.name, sx, sy - R - 4); ctx.fillStyle = r.dark; ctx.fillText(r.name, sx, sy - R - 4);
    }
    if (P.alive) drawPlayer(ctx, (P.fx - V.cx) * cp, (P.fy - V.cy) * cp, R, P, g.t);
    for (const f of g.fx) {
      ctx.globalAlpha = 1 - f.t; ctx.font = `${Math.round(R * (1.2 + f.t))}px sans-serif`;
      ctx.fillText(f.text, (f.x - V.cx) * cp, (f.y - V.cy) * cp - f.t * 30);
      ctx.globalAlpha = 1;
    }
    // mini map when the country is bigger than the screen
    if (innerW * cp > vw + 2 || innerH * cp > avH + 2) {
      const mw = Math.min(140, vw * 0.3), ms = mw / Math.max(g.W, g.H), mx = vw - g.W * ms - 10, my = vh - g.H * ms - 10;
      ctx.fillStyle = 'rgba(255,255,255,.7)'; Park.rr(ctx, mx - 5, my - 5, g.W * ms + 10, g.H * ms + 10, 10); ctx.fill();
      ctx.imageSmoothingEnabled = true; ctx.drawImage(g.gridCv, mx, my, g.W * ms, g.H * ms);
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5;
      ctx.strokeRect(mx + Math.max(0, V.cx) * ms, my + Math.max(0, V.cy + topPad / cp) * ms, Math.min(g.W, viewW) * ms, Math.min(g.H, viewH) * ms);
      ctx.fillStyle = P.color; ctx.beginPath(); ctx.arc(mx + P.fx * ms, my + P.fy * ms, 3.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }

  function updateHud(force) {
    const g = G; if (!g) return;
    const p = pctOf(1);
    if (force || p !== g.pctShown) {
      g.pctShown = p;
      $('#hPct').textContent = `${p}% / ${g.target}%`;
      $('#hFill').style.width = Math.min(100, p) + '%';
    }
    $('#hHearts').textContent = '❤️'.repeat(Math.max(0, Math.min(5, g.lives))) + '🤍'.repeat(Math.max(0, 3 - g.lives));
  }

  function begin() {
    if (!G || G.started || G.over) return;
    G.started = true; $('#startov').hidden = true; Park.sound('jump');
  }

  // ---------- endings ----------
  function rememberBest() {
    if (!G) return;
    const n = G.C.name, p = Math.min(100, pctOf(1));
    if (p > (SAVE.best[n] || 0)) { SAVE.best[n] = p; Park.save(); }
  }
  function win() {
    const g = G; g.over = true;
    const C = g.C, first = !SAVE.done[C.name];
    rememberBest();
    SAVE.done[C.name] = Date.now();
    Park.save();
    let msg = '';
    const coins = first ? C.tier.coins : 3;
    Park.addCoins(coins);
    msg += `<div class="reward">+${coins} 🪙</div>`;
    if (first) {
      const nDone = Object.keys(SAVE.done).length;
      const contList = countries.filter(c => c.cont === C.cont);
      if (!SAVE.contDone[C.cont] && contList.every(c => SAVE.done[c.name])) {
        SAVE.contDone[C.cont] = 1; Park.addDiamonds(5);
        msg += `<div class="reward">${CONT_EMOJI[C.cont]} You coloured ALL of ${C.cont}! +5 💎</div>`;
      } else if (nDone % 5 === 0) { Park.addDiamonds(1); msg += `<div class="reward">${nDone} countries coloured! +1 💎</div>`; }
      if (countries.every(c => SAVE.done[c.name])) { Park.addDiamonds(20); msg += '<div class="reward">🌍 THE WHOLE WORLD! +20 💎</div>'; }
      Park.save();
    }
    Park.sound('win'); Park.confetti();
    celebrate = { C, t: performance.now() + 400 };
    endModal(`🎉 You coloured ${C.nice}!`, `<div class="bigmsg">You painted <b>${pctOf(1)}%</b> of ${Park.esc(C.nice)}. It's now bright and colourful on your world map!${msg}</div>`, true);
  }
  function gameOver() {
    G.over = true; rememberBest();
    endModal('😵 Out of hearts!', `<div class="bigmsg">You coloured <b>${pctOf(1)}%</b> of ${Park.esc(G.C.nice)} (you need ${G.target}%).<br>Keep your trails short and hurry home when a rival comes close!</div>`, false);
  }
  function endModal(title, html, won) {
    const C = G.C;
    const box = document.createElement('div');
    box.innerHTML = html + `<div class="mbtns"><button class="go" data-a="map">🗺️ ${won ? 'See it on the map' : 'Back to map'}</button><button data-a="again">🔁 ${won ? 'Play again' : 'Try again'}</button></div>`;
    let action = 'map';
    const m = Park.modal(title, box, { onClose: () => { if (action === 'again') startCountry(C); else goMap(C); } });
    box.querySelector('[data-a="map"]').onclick = () => { action = 'map'; m.close(); };
    box.querySelector('[data-a="again"]').onclick = () => { action = 'again'; m.close(); };
  }

  function goMap(C) {
    if (G && !G.over) rememberBest();
    G = null; mode = 'map';
    document.body.classList.remove('playing');
    $('#playScreen').hidden = true; $('#mapScreen').hidden = false;
    sizeMap(); clampView();
    if (C) select(C, false);
    refreshMapUI();
    window.scrollTo(0, 0);
  }
  $('#backBtn').onclick = () => goMap(G && G.C);

  // ---------- input ----------
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
  window.addEventListener('keydown', (e) => {
    if (mode !== 'play' || !G || document.querySelector('.pk-ov')) return;
    const k = KEYMAP[e.key];
    if (k) { e.preventDefault(); G.keys.add(k); begin(); }
    else if (e.key === ' ') { e.preventDefault(); begin(); }
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k && G) G.keys.delete(k); });
  window.addEventListener('blur', () => { if (G) { G.keys.clear(); G.ptr = null; } });
  gameCv.addEventListener('pointerdown', (e) => {
    if (!G) return;
    e.preventDefault();
    try { gameCv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    G.ptr = { id: e.pointerId, x: e.offsetX, y: e.offsetY, ax: e.offsetX, ay: e.offsetY, t0: performance.now(), slid: false };
    begin();
  });
  gameCv.addEventListener('pointermove', (e) => {
    const p = G && G.ptr; if (!p || p.id !== e.pointerId) return;
    p.x = e.offsetX; p.y = e.offsetY;
    const dx = p.x - p.ax, dy = p.y - p.ay, l = Math.hypot(dx, dy);
    if (l > 50) { p.ax = p.x - dx / l * 50; p.ay = p.y - dy / l * 50; } // the "joystick" follows your finger
  });
  const upG = (e) => { if (G && G.ptr && G.ptr.id === e.pointerId) G.ptr = null; };
  gameCv.addEventListener('pointerup', upG);
  gameCv.addEventListener('pointercancel', upG);

  // ---------- main loop ----------
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
    if (mode === 'play' && G) { update(dt); draw(); }
    else if (mode === 'map') drawMap(t);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => { if (mode === 'map') { sizeMap(); clampView(); } else sizeGame(); });

  sizeMap(); clampView();
  requestAnimationFrame(frame);
  loadWorld();

  // handy for testing from the console
  window.WorldGame = {
    get G() { return G; }, get countries() { return countries; }, byName, update, draw, drawMap, startCountry, goMap, begin, win, enter, claim, buildArena, loadWorld,
  };
})();
