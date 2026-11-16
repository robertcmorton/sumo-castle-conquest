// games/longjump.js — Long Jump (turn-based, 3 jumps per player)
// Phase 1: Speed meter oscillates left↔right, tap to lock.
// Phase 2: Takeoff bar — a marker sweeps toward the takeoff line; tap close to lock-in.
//          Tap too late (past the line) = foul (0). Tap in the green = best.
Games.register({
  id: 'longjump',
  title: 'Long Jump',
  sport: 'Athletics',
  theme: 'beach',
  icon: '🏖️',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three jumps. Tap to lock your run-up speed. Then tap as the takeoff marker hits the green zone — past the foul line and your jump is scratched.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const JUMPS = 3;
    const MAX_DIST = 9; // metres
    const players = ctx.players;
    let turnIdx = 0;
    let jumpIdx = 0;
    let best = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let speed = 0, speedDir = 1;
    let lockedSpeed = 0;
    let timing = 0, timingDir = 1; // 0..1; sweet near 0.85, foul above 0.95
    let lockedTiming = 0;
    let foul = false;
    let landedDist = 0;
    let projectile = null;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newJump() {
      speed = 0; speedDir = 1; lockedSpeed = 0;
      timing = 0; timingDir = 1; lockedTiming = 0;
      foul = false;
      landedDist = 0;
      projectile = null;
      phase = 'aim-speed';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Jump ${jumpIdx + 1}/${JUMPS} · Best: ${best[turnIdx].toFixed(2)}m`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newJump(); return; }
      if (phase === 'aim-speed') { lockedSpeed = speed; phase = 'aim-timing'; return; }
      if (phase === 'aim-timing') { lockedTiming = timing; launch(); return; }
      if (phase === 'resolved') advance();
    }

    function launch() {
      phase = 'flying';
      // sweet zone: 0.78..0.93. Anything > 0.95 = foul. < 0.78 = scrubbed.
      const t = lockedTiming;
      if (t > 0.95) {
        foul = true;
        resolve(0, 'Foul! 🚫');
        return;
      }
      // timing factor: 1.0 at center (0.855), drops off
      const sweetCenter = 0.855;
      const offset = Math.abs(t - sweetCenter);
      const timingFactor = Math.max(0.45, 1 - offset * 3.2);
      const dist = MAX_DIST * lockedSpeed * timingFactor;
      // launch projectile for visual arc
      const g = geom();
      const v0 = 9 + lockedSpeed * 8;
      const a = (timingFactor > 0.8 ? 24 : 20) * Math.PI / 180;
      projectile = {
        startX: g.takeoffX,
        startY: g.groundY,
        x: 0, y: 0,
        vx: Math.cos(a) * v0,
        vy: -Math.sin(a) * v0,
      };
      // animate; resolve once landed
      projectile.targetDist = dist;
    }

    function update(dt) {
      if (phase === 'aim-speed') {
        const o = Meters.oscillate(speed, speedDir, 1.1, dt);
        speed = o.value; speedDir = o.dir;
      } else if (phase === 'aim-timing') {
        const o = Meters.oscillate(timing, timingDir, 0.95, dt, 0, 1);
        timing = o.value; timingDir = o.dir;
      } else if (phase === 'flying' && projectile) {
        const step = dt / 16.67;
        projectile.x += projectile.vx * step;
        projectile.y += projectile.vy * step;
        projectile.vy += 0.4 * step;
        const g = geom();
        const realDist = projectile.x / g.pxPerMetre;
        if (realDist >= projectile.targetDist || projectile.y > 0) {
          resolve(projectile.targetDist, projectile.targetDist >= 7 ? `${projectile.targetDist.toFixed(2)}m — Huge!` : `${projectile.targetDist.toFixed(2)}m`);
        }
      }
    }

    function resolve(dist, msg) {
      landedDist = dist;
      history[turnIdx][jumpIdx] = dist;
      if (dist > best[turnIdx]) best[turnIdx] = dist;
      phase = 'resolved';
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1100);
    }

    function advance() {
      ctx.setOverlay(null);
      jumpIdx++;
      if (jumpIdx >= JUMPS) {
        jumpIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newJump();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: Math.round(best[i] * 100),
        displayScore: `${best[i].toFixed(2)}m`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to begin run-up</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const groundY = h - 80;
      const takeoffX = w * 0.35;
      const pitWidth = w - takeoffX - 30;
      const pxPerMetre = pitWidth / MAX_DIST;
      return { w, h, groundY, takeoffX, pxPerMetre };
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // runway
      c.fillStyle = '#9a3412';
      c.fillRect(0, g.groundY, g.takeoffX, 14);
      // foul line
      c.fillStyle = '#fff';
      c.fillRect(g.takeoffX - 3, g.groundY - 4, 3, 18);
      // sand pit
      c.fillStyle = '#fcd34d';
      c.fillRect(g.takeoffX, g.groundY, g.w - g.takeoffX, g.h - g.groundY);
      c.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < 30; i++) {
        c.fillRect(g.takeoffX + (i * 31 + 3) % (g.w - g.takeoffX), g.groundY + 8 + (i * 17 % (g.h - g.groundY - 12)), 2, 2);
      }
      // metre markers in the pit
      c.font = 'bold 10px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.textAlign = 'center';
      for (let m = 2; m <= 9; m += 1) {
        const x = g.takeoffX + m * g.pxPerMetre;
        c.fillRect(x, g.groundY + 6, 1, 6);
        if (m % 2 === 0) c.fillText(`${m}m`, x, g.groundY + 22);
      }

      // jumper
      if (phase === 'aim-speed' || phase === 'aim-timing') {
        const runX = g.takeoffX - 30 - (1 - lockedSpeed) * 60; // hints at run-up
        drawJumper(c, runX, g.groundY, curPlayer().color, false);
      } else if (phase === 'flying' && projectile) {
        const x = projectile.startX + projectile.x;
        const y = projectile.startY + projectile.y;
        drawJumper(c, x, y, curPlayer().color, true);
      } else if (phase === 'resolved' && !foul) {
        const x = g.takeoffX + landedDist * g.pxPerMetre;
        drawJumper(c, x, g.groundY, curPlayer().color, false);
        // landing marker
        c.strokeStyle = '#ef4444';
        c.lineWidth = 2;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(x, g.groundY);
        c.lineTo(x, g.groundY + 30);
        c.stroke();
        c.setLineDash([]);
      }

      // meters
      if (phase === 'aim-speed' || phase === 'aim-timing') {
        Meters.drawPowerMeter(c, 18, 30, 16, 130, phase === 'aim-speed' ? speed : lockedSpeed, phase !== 'aim-speed', { label: 'SPEED' });
      }
      if (phase === 'aim-timing') {
        // timing bar centered horizontally; sweet at 0.855, foul above 0.95
        const barW = Math.min(g.w * 0.7, 360);
        const barX = (g.w - barW) / 2;
        const barY = 28;
        Meters.drawTimingBar(c, barX, barY, barW, 18, timing, { center: 0.855, width: 0.15 }, false, 'TAKEOFF');
        // foul zone
        const c2 = ctx.canvasCtx;
        c2.save();
        c2.fillStyle = 'rgba(239,68,68,0.5)';
        const foulX = barX + 0.95 * barW;
        c2.fillRect(foulX, barY, barW - (foulX - barX), 18);
        c2.restore();
      }

      drawHistory(c, 12, g.h - 32);
    }

    function drawJumper(c, x, y, color, airborne) {
      c.save();
      if (!airborne) {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath(); c.ellipse(x, y, 12, 3, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = color;
      c.fillRect(x - 6, y - 28, 12, 22);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 34, 7, 0, Math.PI * 2);
      c.fill();
      // legs
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.beginPath();
      if (airborne) {
        c.moveTo(x - 4, y - 6); c.lineTo(x + 8, y - 10);
        c.moveTo(x + 2, y - 6); c.lineTo(x + 12, y - 16);
      } else {
        c.moveTo(x - 4, y - 6); c.lineTo(x - 8, y);
        c.moveTo(x + 4, y - 6); c.lineTo(x + 8, y);
      }
      c.stroke();
      c.restore();
    }

    function drawHistory(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 240, 24);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const p = curPlayer();
      const h = history[turnIdx];
      let txt = `${p.avatar.emoji} ${p.name}: ` + [0, 1, 2].map(i => h[i] !== undefined ? (h[i] === 0 ? 'X' : `${h[i].toFixed(1)}`) : '–').join('  ');
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
