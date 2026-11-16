// games/putting.js — Putting Green (turn-based, 3 holes per player)
// Top-down view. Tap to lock aim direction (swinging arc).
// Tap to lock power (oscillating meter).
// Ball rolls with friction; closer at rest to the hole = more points; sink = bonus.
Games.register({
  id: 'putting',
  title: 'Putting Green',
  sport: 'Golf',
  theme: 'forest',
  icon: '⛳',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three holes. Tap to lock the aim arc, tap to lock the power meter. Sink it for 10, leave it close for partial credit. Best total wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const HOLES = 3;
    const players = ctx.players;
    let turnIdx = 0;
    let holeIdx = 0;
    let totals = players.map(() => 0);
    let history = players.map(() => []); // points per hole

    let phase = 'await-start';
    let aimAng = 0, aimDir = 1;        // 0..1 → maps to angle within sweep
    let lockedAng = 0;
    let power = 0, powerDir = 1;
    let lockedPower = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let hole = { x: 0, y: 0, r: 12 };
    let rafId = null;
    let unsubInput = null;
    let trail = [];

    function curPlayer() { return players[turnIdx]; }

    function newHole() {
      const w = ctx.width, h = ctx.height;
      ball.x = w * 0.5;
      ball.y = h - 60;
      ball.vx = 0; ball.vy = 0;
      // hole somewhere in the upper 60% of the green
      hole.x = w * (0.25 + Math.random() * 0.5);
      hole.y = h * (0.18 + Math.random() * 0.35);
      hole.r = 12;
      aimAng = 0; aimDir = 1; lockedAng = 0;
      power = 0; powerDir = 1; lockedPower = 0;
      trail = [];
      phase = 'aim-dir';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Hole ${holeIdx + 1}/${HOLES} · Total: ${totals[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newHole(); return; }
      if (phase === 'aim-dir') { lockedAng = aimAng; phase = 'aim-power'; return; }
      if (phase === 'aim-power') { lockedPower = power; putt(); return; }
      if (phase === 'resolved') advance();
    }

    function aimVector() {
      // sweep ±60° around the line from ball toward hole
      const baseAng = Math.atan2(hole.y - ball.y, hole.x - ball.x);
      const sweepRad = (60 * Math.PI / 180);
      const ang = baseAng + (aimAng - 0.5) * 2 * sweepRad;
      return ang;
    }
    function lockedVector() {
      const baseAng = Math.atan2(hole.y - ball.y, hole.x - ball.x);
      const sweepRad = (60 * Math.PI / 180);
      return baseAng + (lockedAng - 0.5) * 2 * sweepRad;
    }

    function putt() {
      phase = 'rolling';
      const a = lockedVector();
      // power -> initial speed
      const v0 = 4 + lockedPower * 13;
      ball.vx = Math.cos(a) * v0;
      ball.vy = Math.sin(a) * v0;
      trail = [{ x: ball.x, y: ball.y }];
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
        // friction
        const friction = Math.pow(0.965, step);
        ball.vx *= friction;
        ball.vy *= friction;
        if (Math.hypot(ball.vx, ball.vy) < 0.15) {
          ball.vx = 0; ball.vy = 0;
          resolveStop();
          return;
        }
        // record trail
        if (trail.length === 0 || Math.hypot(ball.x - trail[trail.length - 1].x, ball.y - trail[trail.length - 1].y) > 4) {
          trail.push({ x: ball.x, y: ball.y });
        }
        // bounce off walls
        if (ball.x < 12) { ball.x = 12; ball.vx *= -0.5; }
        if (ball.x > ctx.width - 12) { ball.x = ctx.width - 12; ball.vx *= -0.5; }
        if (ball.y < 12) { ball.y = 12; ball.vy *= -0.5; }
        if (ball.y > ctx.height - 12) { ball.y = ctx.height - 12; ball.vy *= -0.5; }
        // sink check
        const d = Math.hypot(ball.x - hole.x, ball.y - hole.y);
        if (d < hole.r - 3 && Math.hypot(ball.vx, ball.vy) < 6) {
          // sunk!
          resolveSunk();
        }
      }
    }

    function resolveSunk() {
      const pts = 10;
      history[turnIdx][holeIdx] = pts;
      totals[turnIdx] += pts;
      phase = 'resolved';
      ctx.setOverlay(`<div>HOLE IN ONE! +10</div>`, { small: true });
      setTimeout(advance, 1300);
    }

    function resolveStop() {
      const d = Math.hypot(ball.x - hole.x, ball.y - hole.y);
      let pts;
      if (d < hole.r * 1.5) pts = 7;
      else if (d < hole.r * 3) pts = 5;
      else if (d < hole.r * 6) pts = 3;
      else if (d < hole.r * 10) pts = 1;
      else pts = 0;
      history[turnIdx][holeIdx] = pts;
      totals[turnIdx] += pts;
      phase = 'resolved';
      ctx.setOverlay(`<div>${pts > 0 ? `+${pts}` : 'Wide!'}</div>`, { small: true });
      setTimeout(advance, 1100);
    }

    function advance() {
      ctx.setOverlay(null);
      holeIdx++;
      if (holeIdx >= HOLES) {
        holeIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newHole();
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
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to address the ball</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      // green
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0e3e1e');
      grad.addColorStop(1, '#1f6e3f');
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
      // grass texture
      c.fillStyle = 'rgba(255,255,255,0.04)';
      for (let i = 0; i < 60; i++) {
        const x = (i * 73) % w;
        const y = (i * 47) % h;
        c.fillRect(x, y, 6, 1);
      }
      // hole
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
      c.fill();
      // flag
      c.strokeStyle = '#fde68a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(hole.x, hole.y);
      c.lineTo(hole.x, hole.y - 40);
      c.stroke();
      c.fillStyle = '#ef4444';
      c.beginPath();
      c.moveTo(hole.x, hole.y - 40);
      c.lineTo(hole.x + 14, hole.y - 34);
      c.lineTo(hole.x, hole.y - 28);
      c.closePath();
      c.fill();

      // trail
      if (trail.length > 1) {
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.setLineDash([3, 4]);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y);
        c.stroke();
        c.setLineDash([]);
      }

      // ball
      drawBall(c, ball.x, ball.y, curPlayer().color);

      // aim arrow
      if (phase === 'aim-dir' || phase === 'aim-power') {
        const ang = (phase === 'aim-dir') ? aimVector() : lockedVector();
        const len = 70 + (phase === 'aim-power' ? lockedPower * 60 : 0);
        const tx = ball.x + Math.cos(ang) * len;
        const ty = ball.y + Math.sin(ang) * len;
        c.strokeStyle = phase === 'aim-power' ? '#22c55e' : '#fff';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(ball.x, ball.y);
        c.lineTo(tx, ty);
        c.stroke();
        c.fillStyle = c.strokeStyle;
        c.beginPath();
        c.arc(tx, ty, 4, 0, Math.PI * 2);
        c.fill();
      }

      // power meter (left)
      if (phase === 'aim-power') {
        Meters.drawPowerMeter(c, 18, 30, 16, 150, power, false);
      }

      // status overlay
      drawHistory(c, 12, h - 30);
    }

    function drawBall(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(x + 1, y + 2, 7, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.stroke();
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
      let txt = `${p.avatar.emoji} ${p.name}: ` + [0, 1, 2].map(i => h[i] !== undefined ? `${h[i]}` : '–').join('  ');
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
