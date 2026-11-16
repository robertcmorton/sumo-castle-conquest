// games/threepoint.js — 3-Point Shootout (turn-based, 5 shots per player)
// Single tap on a swinging timing bar. Land in the green = swish, near-green = rim, off = brick.
Games.register({
  id: 'threepoint',
  title: '3-Point Shootout',
  sport: 'Basketball',
  theme: 'stadium',
  icon: '🏀',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Five shots from beyond the arc. A marker sweeps along the timing bar — tap when it\'s inside the green zone for a swish. Edges get rim-outs.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const SHOTS = 5;
    const SWEET = { center: 0.5, width: 0.16 };
    const RIM   = 0.12; // additional rim width on each side
    const players = ctx.players;
    let turnIdx = 0;
    let shotIdx = 0;
    let made = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let timing = 0, timingDir = 1;
    let lockedTiming = 0;
    let ball = null;        // {x,y,vx,vy,outcome}
    let result = null;      // 'swish'|'rim'|'miss'
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newShot() {
      timing = 0; timingDir = 1;
      lockedTiming = 0;
      ball = null;
      result = null;
      phase = 'aim-timing';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Shot ${shotIdx + 1}/${SHOTS} · Made: ${made[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newShot(); return; }
      if (phase === 'aim-timing') { lockedTiming = timing; release(); return; }
      if (phase === 'resolved') advance();
    }

    function release() {
      phase = 'flying';
      const dist = Math.abs(lockedTiming - SWEET.center);
      if (dist <= SWEET.width / 2) {
        result = 'swish';
      } else if (dist <= SWEET.width / 2 + RIM / 2) {
        result = 'rim';
      } else {
        result = 'miss';
      }
      // launch ball; trajectory depends on outcome
      const g = geom();
      ball = {
        startX: g.shooterX,
        startY: g.shooterY - 24,
        x: 0, y: 0,
        t: 0,
        T: 0.7, // seconds in air
        targetX: g.hoopX,
        targetY: g.hoopY,
        outcome: result,
      };
    }

    function update(dt) {
      if (phase === 'aim-timing') {
        const o = Meters.oscillate(timing, timingDir, 0.85, dt);
        timing = o.value; timingDir = o.dir;
      } else if (phase === 'flying' && ball) {
        ball.t += dt / 1000;
        if (ball.t >= ball.T) {
          // resolution
          if (ball.outcome === 'swish') {
            made[turnIdx] += 1;
            history[turnIdx][shotIdx] = 1;
            phase = 'resolved';
            ctx.setOverlay(`<div>SWISH! 🏀</div>`, { small: true });
          } else if (ball.outcome === 'rim') {
            history[turnIdx][shotIdx] = 0;
            phase = 'resolved';
            ctx.setOverlay(`<div>Rim out!</div>`, { small: true });
          } else {
            history[turnIdx][shotIdx] = 0;
            phase = 'resolved';
            ctx.setOverlay(`<div>Brick.</div>`, { small: true });
          }
          setTimeout(advance, 900);
        }
      }
    }

    function advance() {
      ctx.setOverlay(null);
      shotIdx++;
      if (shotIdx >= SHOTS) {
        shotIdx = 0;
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
        score: made[i],
        displayScore: `${made[i]}/${SHOTS} made`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to take your first shot</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const courtY = h - 40;
      const shooterX = w * 0.22;
      const shooterY = courtY - 8;
      const hoopX = w * 0.82;
      const hoopY = h * 0.34;
      return { w, h, courtY, shooterX, shooterY, hoopX, hoopY };
    }

    function ballPos() {
      // Parabolic interpolation
      const u = Math.min(1, ball.t / ball.T);
      let endX = ball.targetX;
      let endY = ball.targetY;
      if (ball.outcome === 'rim') {
        // bounce off front rim — undershoot slightly
        endX = ball.targetX - 28;
        endY = ball.targetY + 22;
      } else if (ball.outcome === 'miss') {
        // far short or long; pick deterministically by sign of timing deviation
        const sign = Math.sign(lockedTiming - SWEET.center) || 1;
        endX = ball.targetX + sign * 80;
        endY = ball.targetY + 90;
      }
      const x = ball.startX + (endX - ball.startX) * u;
      const peakY = Math.min(ball.startY, endY) - 130;
      const arcY = (1 - u) * (1 - u) * ball.startY + 2 * (1 - u) * u * peakY + u * u * endY;
      return { x, y: arcY };
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // floor
      c.fillStyle = '#92400e';
      c.fillRect(0, g.courtY, g.w, g.h - g.courtY);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, g.courtY, g.w, 4);
      // 3-pt line arc
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(g.shooterX, g.courtY);
      c.lineTo(g.shooterX, g.courtY - 6);
      c.stroke();

      // hoop + backboard
      drawHoop(c, g.hoopX, g.hoopY);

      // shooter
      drawShooter(c, g.shooterX, g.shooterY, curPlayer().color);

      // ball
      if (phase === 'flying' && ball) {
        const p = ballPos();
        drawBall(c, p.x, p.y);
      } else if (phase !== 'flying') {
        drawBall(c, g.shooterX + 12, g.shooterY - 20);
      }

      // timing bar
      if (phase === 'aim-timing' || phase === 'flying' || phase === 'resolved') {
        const barW = Math.min(g.w * 0.7, 360);
        const barX = (g.w - barW) / 2;
        const barY = 32;
        const value = phase === 'aim-timing' ? timing : lockedTiming;
        Meters.drawTimingBar(c, barX, barY, barW, 16, value, SWEET, phase !== 'aim-timing', 'RELEASE');
      }

      // scoreboard
      drawHistory(c, 12, g.h - 32);
    }

    function drawHoop(c, x, y) {
      c.save();
      // backboard
      c.fillStyle = '#fff';
      c.fillRect(x + 18, y - 30, 5, 60);
      // rim
      c.strokeStyle = '#ef4444';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x - 14, y + 8);
      c.lineTo(x + 18, y + 8);
      c.stroke();
      // net
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const px = x - 14 + i * 6;
        c.beginPath();
        c.moveTo(px, y + 8);
        c.lineTo(x - 14 + (i + 0.5) * 5, y + 26);
        c.stroke();
      }
      // pole
      c.strokeStyle = '#92400e';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x + 21, y);
      c.lineTo(x + 21, y + 200);
      c.stroke();
      c.restore();
    }

    function drawShooter(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 8, y - 30, 16, 24);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 36, 7, 0, Math.PI * 2);
      c.fill();
      // arms holding ball
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x + 6, y - 22); c.lineTo(x + 14, y - 20);
      c.moveTo(x - 6, y - 22); c.lineTo(x + 8, y - 20);
      c.stroke();
      c.restore();
    }

    function drawBall(c, x, y) {
      c.save();
      c.fillStyle = '#f97316';
      c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.7)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.stroke();
      c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x, y + 7); c.stroke();
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
      c.fillText(`${p.avatar.emoji} ${p.name}`, x + 6, y + 12);
      const dotsX = x + 110;
      for (let i = 0; i < SHOTS; i++) {
        const v = history[turnIdx][i];
        let col = 'rgba(255,255,255,0.2)';
        if (v === 1) col = '#22c55e';
        else if (v === 0) col = '#ef4444';
        c.fillStyle = col;
        c.beginPath();
        c.arc(dotsX + i * 14, y + 12, 4, 0, Math.PI * 2);
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
