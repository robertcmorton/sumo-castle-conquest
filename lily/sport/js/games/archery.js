// games/archery.js — Archery (turn-based, 5 arrows per player)
// A reticle drifts in a small Lissajous wobble around an aim point you can move.
// Tap once to lock horizontal aim, tap again to lock vertical aim, then shoots.
// Closer to center = more points. Wind nudges the arrow on the way.
Games.register({
  id: 'archery',
  title: 'Archery',
  sport: 'Archery',
  theme: 'forest',
  icon: '🏹',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Take 5 arrows. A swinging line picks your horizontal aim; tap to lock. Then a vertical bar picks your height; tap to lock. Center = 10, outer rim = 1. Watch the wind!',
  controls: 'Tap the screen / tap button / press Space to lock each meter.',
  create(ctx) {
    const ARROWS = 5;
    const players = ctx.players;
    let turnIdx = 0;
    let arrowIdx = 0;
    let scores = players.map(() => 0);
    let history = players.map(() => []); // points per arrow

    let phase = 'await-start'; // 'await-start' | 'aim-x' | 'aim-y' | 'flying' | 'resolved' | 'done'
    let aimX = 0, aimXDir = 1;     // 0..1 → maps to target horizontal
    let aimY = 0, aimYDir = 1;
    let lockedX = 0.5, lockedY = 0.5;
    let wind = 0;                  // -1..1
    let arrow = { x: 0, y: 0, vx: 0, vy: 0, lockedX: 0, lockedY: 0 };
    let resultText = '';

    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newShot() {
      aimX = 0; aimXDir = 1;
      aimY = 0; aimYDir = 1;
      lockedX = 0.5; lockedY = 0.5;
      wind = (Math.random() - 0.5) * 0.6; // -0.3..0.3
      phase = 'aim-x';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Arrow ${arrowIdx + 1}/${ARROWS} · Score: ${scores[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newShot(); return; }
      if (phase === 'aim-x') { lockedX = aimX; phase = 'aim-y'; return; }
      if (phase === 'aim-y') { lockedY = aimY; shoot(); return; }
      if (phase === 'resolved') advance();
    }

    function shoot() {
      phase = 'flying';
      // arrow starts from archer bottom-left
      arrow.x = 60;
      arrow.y = ctx.height - 60;
      arrow.lockedX = lockedX;
      arrow.lockedY = lockedY;
      arrow.t = 0;
    }

    function advance() {
      ctx.setOverlay(null);
      arrowIdx++;
      if (arrowIdx >= ARROWS) {
        arrowIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newShot();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: scores[i],
        displayScore: `${scores[i]} pts`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to draw your bow</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function targetGeom() {
      const w = ctx.width, h = ctx.height;
      const cx = w * 0.72;
      const cy = h * 0.42;
      const radius = Math.min(w, h) * 0.22;
      return { cx, cy, radius };
    }

    function update(dt) {
      if (phase === 'aim-x') {
        const o = Meters.oscillate(aimX, aimXDir, 0.9, dt);
        aimX = o.value; aimXDir = o.dir;
      } else if (phase === 'aim-y') {
        const o = Meters.oscillate(aimY, aimYDir, 0.9, dt);
        aimY = o.value; aimYDir = o.dir;
      } else if (phase === 'flying') {
        arrow.t += dt / 1000;
        // Arrow flies in ~0.45s. We interpolate from start to target.
        const T = 0.45;
        const u = Math.min(1, arrow.t / T);
        const start = { x: 60, y: ctx.height - 60 };
        const g = targetGeom();
        const targetX = g.cx + (arrow.lockedX - 0.5) * g.radius * 1.8 + wind * g.radius * 0.6 * u;
        const targetY = g.cy + (arrow.lockedY - 0.5) * g.radius * 1.8;
        // slight arc upward
        const arc = -40 * Math.sin(u * Math.PI);
        arrow.x = start.x + (targetX - start.x) * u;
        arrow.y = start.y + (targetY - start.y) * u + arc;
        if (u >= 1) resolveHit();
      }
    }

    function resolveHit() {
      const g = targetGeom();
      const dx = arrow.x - g.cx;
      const dy = arrow.y - g.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 10 rings from r/10 inwards: outer = 1, bullseye = 10
      let pts = 0;
      if (dist <= g.radius) {
        const ring = Math.floor((dist / g.radius) * 10);
        pts = Math.max(1, 10 - ring);
      }
      history[turnIdx][arrowIdx] = pts;
      scores[turnIdx] += pts;
      resultText = pts >= 9 ? `Bullseye! +${pts}` : pts >= 5 ? `+${pts}` : pts === 0 ? 'Missed!' : `+${pts}`;
      phase = 'resolved';
      ctx.setOverlay(`<div>${resultText}</div>`, { small: true });
      setTimeout(advance, 1000);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // ground line
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, h - 32, w, 32);

      // archer (left side)
      drawArcher(c, 60, h - 60, curPlayer().color);

      // target
      const g = targetGeom();
      drawTarget(c, g.cx, g.cy, g.radius);

      // arrow
      if (phase === 'flying' || phase === 'resolved') {
        drawArrow(c, arrow.x, arrow.y);
      }

      // aim x: a horizontal line that sweeps left-right across the target area
      if (phase === 'aim-x' || phase === 'aim-y') {
        const xVal = (phase === 'aim-x' ? aimX : lockedX);
        const lineX = g.cx + (xVal - 0.5) * g.radius * 2.2;
        c.strokeStyle = phase === 'aim-x' ? '#fff' : 'rgba(34,197,94,0.85)';
        c.lineWidth = 2;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(lineX, g.cy - g.radius - 16);
        c.lineTo(lineX, g.cy + g.radius + 16);
        c.stroke();
        c.setLineDash([]);
      }
      if (phase === 'aim-y') {
        const yVal = aimY;
        const lineY = g.cy + (yVal - 0.5) * g.radius * 2.2;
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(g.cx - g.radius - 16, lineY);
        c.lineTo(g.cx + g.radius + 16, lineY);
        c.stroke();
        c.setLineDash([]);
      }

      // wind indicator
      drawWind(c, w - 110, 24, wind);

      // arrow history dots
      drawHistory(c, 12, 12);
    }

    function drawArcher(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y - 12, 12, 0, Math.PI * 2); c.fill();
      // bow arc
      c.strokeStyle = '#a16207';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x + 16, y - 12, 20, -Math.PI * 0.6, Math.PI * 0.6);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 8, y - 30);
      c.lineTo(x + 8, y + 6);
      c.stroke();
      c.restore();
    }

    function drawTarget(c, cx, cy, r) {
      const rings = [
        { r: r, fill: '#fff' },
        { r: r * 0.85, fill: '#000' },
        { r: r * 0.7, fill: '#3b82f6' },
        { r: r * 0.55, fill: '#ef4444' },
        { r: r * 0.35, fill: '#facc15' },
        { r: r * 0.15, fill: '#facc15' },
      ];
      c.save();
      // stand
      c.fillStyle = '#7c2d12';
      c.fillRect(cx - 4, cy + r, 8, 30);
      rings.forEach(ring => {
        c.fillStyle = ring.fill;
        c.beginPath();
        c.arc(cx, cy, ring.r, 0, Math.PI * 2);
        c.fill();
      });
      // bull's-eye dot
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(cx, cy, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function drawArrow(c, x, y) {
      c.save();
      c.strokeStyle = '#1f2937';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 20, y); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#fde68a';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 6, y - 4);
      c.lineTo(x - 6, y + 4);
      c.closePath();
      c.fill();
      c.restore();
    }

    function drawWind(c, x, y, wind) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 96, 22);
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'left';
      c.fillText('WIND', x + 6, y + 14);
      // bar
      const cx = x + 60, cy = y + 11;
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(cx - 18, cy - 3, 36, 6);
      c.fillStyle = Math.abs(wind) < 0.1 ? '#22c55e' : '#fbbf24';
      const barW = wind * 18;
      c.fillRect(cx, cy - 3, barW, 6);
      c.restore();
    }

    function drawHistory(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 200, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const p = curPlayer();
      c.fillText(`${p.avatar.emoji} ${p.name}`, x + 8, y + 13);
      const dotsX = x + 100;
      for (let i = 0; i < ARROWS; i++) {
        const v = history[turnIdx][i];
        let col = 'rgba(255,255,255,0.2)';
        if (v !== undefined) {
          col = v >= 9 ? '#facc15' : v >= 5 ? '#22c55e' : v >= 1 ? '#fb923c' : '#ef4444';
        }
        c.fillStyle = col;
        c.beginPath();
        c.arc(dotsX + i * 14, y + 13, 4, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function escape(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    return {
      start() {
        unsubInput = Input.subscribe(e => { if (e.type === 'press') tap(); });
        ctx.canvas.style.pointerEvents = 'auto';
        ctx.canvas.addEventListener('pointerdown', onCanvasTap);
        promptStart();
        lastT = 0;
        rafId = requestAnimationFrame(loop);
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
