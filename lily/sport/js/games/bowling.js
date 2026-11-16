// games/bowling.js — Bowling (turn-based, 3 frames per player)
// Tap to lock aim (swinging arrow). Tap to lock power. Ball rolls, knocks pins.
// Each frame = single throw. Strike = +5 bonus. Top-down lane view.
Games.register({
  id: 'bowling',
  title: 'Bowling',
  sport: 'Bowling',
  theme: 'dojo',
  icon: '🎳',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three frames per player. Tap to lock the aim, tap to lock the power. Strike all 10 pins for a bonus. Most pins wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const FRAMES = 3;
    const players = ctx.players;
    let turnIdx = 0;
    let frameIdx = 0;
    let totals = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let aimAng = 0, aimDir = 1;          // 0..1
    let lockedAng = 0;
    let power = 0, powerDir = 1;
    let lockedPower = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0, active: false };
    let pins = [];          // {x, y, alive}
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function laneGeom() {
      const w = ctx.width, h = ctx.height;
      // top-down view: lane vertical, ball at bottom, pins at top.
      const laneW = Math.min(w * 0.5, 220);
      const laneX = (w - laneW) / 2;
      const laneY = 20;
      const laneH = h - 80;
      return { laneX, laneY, laneW, laneH };
    }

    function resetPins() {
      const g = laneGeom();
      const pinTopY = g.laneY + 50;
      const rowGap = 22;
      const pinR = 11;
      pins = [];
      // standard 10-pin triangle: rows of 1,2,3,4 from front to back
      for (let row = 0; row < 4; row++) {
        const count = row + 1;
        const rowW = (count - 1) * (pinR * 2 + 4);
        for (let i = 0; i < count; i++) {
          const cx = g.laneX + g.laneW / 2 - rowW / 2 + i * (pinR * 2 + 4);
          const cy = pinTopY + row * rowGap;
          pins.push({ x: cx, y: cy, r: pinR, alive: true });
        }
      }
    }

    function newFrame() {
      const g = laneGeom();
      ball.x = g.laneX + g.laneW / 2;
      ball.y = g.laneY + g.laneH - 30;
      ball.vx = 0; ball.vy = 0;
      ball.active = false;
      aimAng = 0; aimDir = 1; lockedAng = 0;
      power = 0; powerDir = 1; lockedPower = 0;
      resetPins();
      phase = 'aim-dir';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Frame ${frameIdx + 1}/${FRAMES} · Total: ${totals[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newFrame(); return; }
      if (phase === 'aim-dir') { lockedAng = aimAng; phase = 'aim-power'; return; }
      if (phase === 'aim-power') { lockedPower = power; roll(); return; }
      if (phase === 'resolved') advance();
    }

    function aimToAngle(t) {
      // sweep ±25° around straight up
      const center = -Math.PI / 2;
      const sweep = (25 * Math.PI / 180);
      return center + (t - 0.5) * 2 * sweep;
    }

    function roll() {
      phase = 'rolling';
      const a = aimToAngle(lockedAng);
      const v0 = 7 + lockedPower * 13;
      ball.vx = Math.cos(a) * v0;
      ball.vy = Math.sin(a) * v0;
      ball.active = true;
    }

    function update(dt) {
      if (phase === 'aim-dir') {
        const o = Meters.oscillate(aimAng, aimDir, 0.85, dt);
        aimAng = o.value; aimDir = o.dir;
      } else if (phase === 'aim-power') {
        const o = Meters.oscillate(power, powerDir, 1.0, dt);
        power = o.value; powerDir = o.dir;
      } else if (phase === 'rolling') {
        const step = dt / 16.67;
        ball.x += ball.vx * step;
        ball.y += ball.vy * step;
        // very mild friction so it crosses the lane reliably
        ball.vx *= Math.pow(0.998, step);
        ball.vy *= Math.pow(0.998, step);
        // collisions: when ball passes by a pin, knock it
        pins.forEach(p => {
          if (!p.alive) return;
          if (Math.hypot(p.x - ball.x, p.y - ball.y) < p.r + 6) {
            p.alive = false;
            // chain reaction: nearby pins might fall too
            chainKnock(p);
          }
        });
        // ball off the top or sides -> end frame
        const g = laneGeom();
        if (ball.y < g.laneY - 20 || ball.x < g.laneX - 10 || ball.x > g.laneX + g.laneW + 10) {
          resolve();
        }
      }
    }

    function chainKnock(origin) {
      pins.forEach(p => {
        if (!p.alive) return;
        const d = Math.hypot(p.x - origin.x, p.y - origin.y);
        if (d < 26 && Math.random() < 0.7) {
          p.alive = false;
          // recursive but capped by the live set
          chainKnock(p);
        }
      });
    }

    function resolve() {
      const down = pins.filter(p => !p.alive).length;
      let pts = down;
      let msg = `${down} pins`;
      if (down === 10) {
        pts += 5;
        msg = 'STRIKE! +10 (+5 bonus)';
      } else if (down >= 8) {
        msg = `${down} pins — nice!`;
      } else if (down === 0) {
        msg = 'Gutter ball!';
      }
      history[turnIdx][frameIdx] = pts;
      totals[turnIdx] += pts;
      phase = 'resolved';
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1200);
    }

    function advance() {
      ctx.setOverlay(null);
      frameIdx++;
      if (frameIdx >= FRAMES) {
        frameIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newFrame();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: totals[i],
        displayScore: `${totals[i]} pts`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to step up to the lane</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      const g = laneGeom();
      // lane (light wood)
      c.fillStyle = '#fef3c7';
      c.fillRect(g.laneX, g.laneY, g.laneW, g.laneH);
      // lane plank lines
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      c.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const x = g.laneX + i * (g.laneW / 6);
        c.beginPath();
        c.moveTo(x, g.laneY);
        c.lineTo(x, g.laneY + g.laneH);
        c.stroke();
      }
      // gutters
      c.fillStyle = '#1f2937';
      c.fillRect(g.laneX - 12, g.laneY, 12, g.laneH);
      c.fillRect(g.laneX + g.laneW, g.laneY, 12, g.laneH);
      // foul line at bottom
      c.fillStyle = '#ef4444';
      c.fillRect(g.laneX, g.laneY + g.laneH - 8, g.laneW, 2);

      // pins
      pins.forEach(p => {
        if (!p.alive) return;
        drawPin(c, p.x, p.y, p.r);
      });

      // ball
      drawBall(c, ball.x, ball.y, curPlayer().color);

      // aim arrow above ball
      if (phase === 'aim-dir' || phase === 'aim-power') {
        const a = (phase === 'aim-dir') ? aimToAngle(aimAng) : aimToAngle(lockedAng);
        const len = 80 + (phase === 'aim-power' ? lockedPower * 60 : 0);
        const tx = ball.x + Math.cos(a) * len;
        const ty = ball.y + Math.sin(a) * len;
        c.strokeStyle = phase === 'aim-power' ? '#22c55e' : '#fff';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(ball.x, ball.y);
        c.lineTo(tx, ty);
        c.stroke();
      }

      // power meter
      if (phase === 'aim-power' || phase === 'rolling' || phase === 'resolved') {
        Meters.drawPowerMeter(c, 18, 30, 16, 150, phase === 'aim-power' ? power : lockedPower, phase !== 'aim-power');
      }

      drawHistory(c, 12, h - 32);
    }

    function drawPin(c, x, y, r) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.ellipse(x + 1, y + r * 0.6, r * 0.6, r * 0.18, 0, 0, Math.PI * 2);
      c.fill();
      // body
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
      c.fill();
      // neck rings
      c.strokeStyle = '#ef4444';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - r * 0.4, y - r * 0.4);
      c.lineTo(x + r * 0.4, y - r * 0.4);
      c.stroke();
      c.restore();
    }

    function drawBall(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x + 2, y + 3, 9, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill();
      // finger holes
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.beginPath(); c.arc(x - 3, y - 3, 1.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 3, y - 3, 1.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill();
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
      const parts = [0, 1, 2].map(i => h[i] !== undefined ? `${h[i]}` : '–').join('  ');
      c.fillText(`${p.avatar.emoji} ${p.name}: ${parts}`, x + 6, y + 12);
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
