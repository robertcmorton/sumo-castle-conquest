// games/darts.js — Darts (steady-aim throw)
// The reticle drifts continuously in a small Lissajous wobble (no oscillator).
// 5 throws — tap once each to release. Closer to bullseye = more points.
Games.register({
  id: 'darts',
  title: 'Darts',
  sport: 'Darts',
  theme: 'dojo',
  icon: '🎯',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Five throws each. The crosshair drifts — tap to release a dart. Bullseye = 50, outer rings step down. Steady wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const THROWS = 5;
    const players = ctx.players;
    let turnIdx = 0, throwIdx = 0;
    let totals = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let driftT = 0;
    let driftPhaseX = 0, driftPhaseY = 0;
    let darts = []; // array of {x,y,pts}
    let lockedXY = null;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newThrow() {
      driftT = 0;
      driftPhaseX = Math.random() * Math.PI * 2;
      driftPhaseY = Math.random() * Math.PI * 2;
      lockedXY = null;
      phase = 'aiming';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Throw ${throwIdx + 1}/${THROWS} · Total: ${totals[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newThrow(); return; }
      if (phase === 'aiming') return release();
      if (phase === 'resolved') return advance();
    }

    function reticlePos() {
      const g = geom();
      // wobble around the bullseye plus a slow drift
      const x = g.cx + Math.sin(driftT * 1.2 + driftPhaseX) * g.r * 0.4 + Math.sin(driftT * 2.3 + driftPhaseY) * g.r * 0.15;
      const y = g.cy + Math.cos(driftT * 1.1 + driftPhaseY) * g.r * 0.4 + Math.cos(driftT * 2.7 + driftPhaseX) * g.r * 0.15;
      return { x, y };
    }

    function release() {
      const r = reticlePos();
      lockedXY = r;
      const g = geom();
      const dist = Math.hypot(r.x - g.cx, r.y - g.cy);
      // map distance to points (concentric rings)
      let pts;
      if (dist < g.r * 0.07) pts = 50;       // bullseye
      else if (dist < g.r * 0.20) pts = 25;
      else if (dist < g.r * 0.35) pts = 15;
      else if (dist < g.r * 0.55) pts = 10;
      else if (dist < g.r * 0.75) pts = 6;
      else if (dist <= g.r)       pts = 3;
      else                        pts = 0;
      darts.push({ x: r.x, y: r.y, pts });
      totals[turnIdx] += pts;
      history[turnIdx][throwIdx] = pts;
      phase = 'resolved';
      ctx.setOverlay(`<div>+${pts} pts</div>`, { small: true });
      setTimeout(advance, 1000);
    }

    function advance() {
      ctx.setOverlay(null);
      throwIdx++;
      if (throwIdx >= THROWS) {
        throwIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        darts = [];
        promptStart();
        return;
      }
      newThrow();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: totals[i],
        displayScore: `${totals[i]} pts`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      darts = [];
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start aiming</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'THROW', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const cx = w / 2;
      const cy = h * 0.45;
      const r = Math.min(w, h) * 0.32;
      return { w, h, cx, cy, r };
    }

    function update(dt) {
      if (phase === 'aiming') driftT += dt / 1000;
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // dartboard rings
      const rings = [
        { r: g.r,          fill: '#fff' },
        { r: g.r * 0.75,   fill: '#000' },
        { r: g.r * 0.55,   fill: '#fff' },
        { r: g.r * 0.35,   fill: '#000' },
        { r: g.r * 0.20,   fill: '#22c55e' },
        { r: g.r * 0.07,   fill: '#ef4444' },
      ];
      rings.forEach(ring => {
        c.fillStyle = ring.fill;
        c.beginPath(); c.arc(g.cx, g.cy, ring.r, 0, Math.PI * 2); c.fill();
      });
      // wedges for visual
      c.save();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        c.beginPath();
        c.moveTo(g.cx, g.cy);
        c.lineTo(g.cx + Math.cos(a) * g.r, g.cy + Math.sin(a) * g.r);
        c.stroke();
      }
      c.restore();

      // darts that have landed this turn
      darts.forEach(d => drawDart(c, d.x, d.y, curPlayer().color));

      // reticle when aiming
      if (phase === 'aiming') {
        const r = reticlePos();
        drawReticle(c, r.x, r.y);
      } else if (phase === 'resolved' && lockedXY) {
        drawReticle(c, lockedXY.x, lockedXY.y, '#22c55e');
      }

      // scoreboard
      drawScoreboard(c, 12, 12);
    }

    function drawReticle(c, x, y, color = '#fff') {
      c.save();
      c.strokeStyle = color; c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, 12, 0, Math.PI * 2);
      c.moveTo(x - 16, y); c.lineTo(x - 4, y);
      c.moveTo(x + 4, y); c.lineTo(x + 16, y);
      c.moveTo(x, y - 16); c.lineTo(x, y - 4);
      c.moveTo(x, y + 4); c.lineTo(x, y + 16);
      c.stroke();
      c.restore();
    }

    function drawDart(c, x, y, color) {
      c.save();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 14, y - 4);
      c.lineTo(x - 14, y + 4);
      c.closePath(); c.fill();
      c.fillStyle = '#fde68a';
      c.beginPath();
      c.moveTo(x - 14, y - 4); c.lineTo(x - 22, y - 6);
      c.lineTo(x - 22, y + 6); c.lineTo(x - 14, y + 4); c.closePath(); c.fill();
      c.restore();
    }

    function drawScoreboard(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(x, y, 220, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      const hist = history[turnIdx];
      c.fillText(`${p.avatar.emoji} ${p.name}: ${hist.map(v => v === undefined ? '–' : v).join(' ')}`, x + 8, y + 13);
      c.restore();
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt); draw();
      rafId = requestAnimationFrame(loop);
    }
    function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    return {
      start() {
        unsubInput = Input.subscribe(e => { if (e.type === 'press') tap(); });
        ctx.canvas.style.pointerEvents = 'auto';
        ctx.canvas.addEventListener('pointerdown', onCanvasTap);
        promptStart();
        lastT = 0; rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (unsubInput) unsubInput();
        ctx.canvas.removeEventListener('pointerdown', onCanvasTap);
      },
      onResize() {},
    };
    function onCanvasTap(e) { e.preventDefault(); tap(); }
  },
});
