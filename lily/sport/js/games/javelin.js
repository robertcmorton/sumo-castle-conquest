// games/javelin.js — Javelin Throw (turn-based, 3 throws per player)
// Tap to lock angle (0°..80°), tap to lock power, javelin arcs and lands.
// Best throw counts. Distance peaks near 45°.
Games.register({
  id: 'javelin',
  title: 'Javelin Throw',
  sport: 'Athletics',
  theme: 'stadium',
  icon: '🤾',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three throws. Tap to lock the angle, tap to lock the power, then watch it fly. 45° + max power = your longest throw. Best of three counts.',
  controls: 'Tap the screen / big button / press Space to lock each meter.',
  create(ctx) {
    const THROWS = 3;
    const MAX_DIST = 100; // metres displayed
    const players = ctx.players;
    let turnIdx = 0;
    let throwIdx = 0;
    let best = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let angle = 0, angleDir = 1;       // 0..1
    let power = 0, powerDir = 1;
    let lockedAngle = 0, lockedPower = 0;
    let projectile = null;
    let landedDist = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newThrow() {
      angle = 0; angleDir = 1;
      power = 0; powerDir = 1;
      lockedAngle = 0; lockedPower = 0;
      projectile = null;
      landedDist = 0;
      phase = 'aim-angle';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Throw ${throwIdx + 1}/${THROWS} · Best: ${best[turnIdx].toFixed(1)}m`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newThrow(); return; }
      if (phase === 'aim-angle') { lockedAngle = angle; phase = 'aim-power'; return; }
      if (phase === 'aim-power') { lockedPower = power; launch(); return; }
      if (phase === 'resolved') advance();
    }

    function launch() {
      phase = 'flying';
      // angleDeg in [0, 80], speed = lockedPower * v0
      const angleDeg = lockedAngle * 80;
      const a = angleDeg * Math.PI / 180;
      const v0 = 14 + lockedPower * 22;     // px/frame-ish
      projectile = {
        x: 0, y: 0,
        vx: Math.cos(a) * v0,
        vy: -Math.sin(a) * v0,
        rot: a,
        t: 0,
      };
    }

    function resolve(dist) {
      landedDist = dist;
      history[turnIdx][throwIdx] = dist;
      if (dist > best[turnIdx]) best[turnIdx] = dist;
      phase = 'resolved';
      const msg = dist >= 90 ? `${dist.toFixed(1)}m — Huge!` : dist >= 60 ? `${dist.toFixed(1)}m — Solid!` : `${dist.toFixed(1)}m`;
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1100);
    }

    function advance() {
      ctx.setOverlay(null);
      throwIdx++;
      if (throwIdx >= THROWS) {
        throwIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newThrow();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: Math.round(best[i] * 10),
        displayScore: `${best[i].toFixed(1)}m`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start your run-up</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const groundY = h - 60;
      const startX = 60;
      const pxPerMetre = (w - 90) / MAX_DIST;
      return { w, h, groundY, startX, pxPerMetre };
    }

    function update(dt) {
      if (phase === 'aim-angle') {
        const o = Meters.oscillate(angle, angleDir, 0.95, dt);
        angle = o.value; angleDir = o.dir;
      } else if (phase === 'aim-power') {
        const o = Meters.oscillate(power, powerDir, 1.05, dt);
        power = o.value; powerDir = o.dir;
      } else if (phase === 'flying' && projectile) {
        const step = dt / 16.67;
        projectile.x += projectile.vx * step;
        projectile.y += projectile.vy * step;
        projectile.vy += 0.35 * step;     // gravity
        projectile.rot = Math.atan2(projectile.vy, projectile.vx);
        projectile.t += dt;
        const g = geom();
        // The projectile.y coordinate is offset from launch height (top of athlete).
        // Land when world-y reaches groundY.
        const worldY = (g.groundY - 40) + projectile.y;
        if (worldY >= g.groundY) {
          const dist = projectile.x / g.pxPerMetre;
          resolve(Math.min(MAX_DIST, Math.max(0, dist)));
        }
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // sand/track
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(0, g.groundY, g.w, g.h - g.groundY);
      c.fillStyle = '#9a3412';
      c.fillRect(0, g.groundY, g.w, 6);
      // distance markers
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 1;
      c.font = 'bold 10px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.textAlign = 'center';
      for (let m = 25; m <= MAX_DIST; m += 25) {
        const x = g.startX + m * g.pxPerMetre;
        c.beginPath();
        c.moveTo(x, g.groundY);
        c.lineTo(x, g.groundY + 12);
        c.stroke();
        c.fillText(`${m}m`, x, g.groundY + 24);
      }

      // athlete
      drawAthlete(c, g.startX, g.groundY, curPlayer().color);

      // projectile
      if (phase === 'flying' || phase === 'resolved') {
        const worldX = g.startX + (projectile ? projectile.x : 0);
        const worldY = phase === 'resolved'
          ? g.groundY - 2
          : (g.groundY - 40) + (projectile ? projectile.y : 0);
        drawJavelin(c, worldX, worldY, projectile ? projectile.rot : 0);
      }

      // meters
      if (phase === 'aim-angle' || phase === 'aim-power') {
        Meters.drawAngleDial(c, 90, 100, 56, phase === 'aim-angle' ? angle : lockedAngle, phase !== 'aim-angle', curPlayer().color, 80, 'ANGLE');
      }
      if (phase === 'aim-power' || phase === 'flying' || phase === 'resolved') {
        Meters.drawPowerMeter(c, 20, 40, 16, 120, phase === 'aim-power' ? power : lockedPower, phase !== 'aim-power');
      }

      // history
      drawHistory(c, 12, g.h - 32);
    }

    function drawAthlete(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y - 2, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 7, y - 32, 14, 26);
      c.beginPath();
      c.arc(x, y - 38, 8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#fde68a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 4, y - 28);
      c.lineTo(x + 18, y - 36);
      c.stroke();
      c.restore();
    }

    function drawJavelin(c, x, y, rot) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.fillStyle = '#e5e7eb';
      c.fillRect(-18, -1.5, 36, 3);
      c.fillStyle = '#fbbf24';
      c.beginPath();
      c.moveTo(18, 0);
      c.lineTo(12, -3);
      c.lineTo(12, 3);
      c.closePath();
      c.fill();
      c.restore();
    }

    function drawHistory(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 220, 24);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const p = curPlayer();
      const h = history[turnIdx];
      let txt = `${p.avatar.emoji} ${p.name}: ` + [0, 1, 2].map(i => h[i] !== undefined ? `${h[i].toFixed(0)}m` : '–').join('  ');
      c.fillText(txt, x + 6, y + 12);
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
