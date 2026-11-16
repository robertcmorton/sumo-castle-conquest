// games/penalty.js — Penalty Shootout (turn-based, 5 shots per player)
// Two-tap mechanic: tap-1 locks power (oscillating meter), tap-2 locks aim (swinging arrow).
// Computer goalkeeper picks a dive direction; matching direction + low power = save.
Games.register({
  id: 'penalty',
  title: 'Penalty Shootout',
  sport: 'Football',
  theme: 'pitch',
  icon: '⚽',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Each player takes 5 penalty kicks. Tap once to lock power, tap again to lock direction. The keeper dives — beat them to score!',
  controls: 'Tap the screen / tap the big button / press Space to lock each meter.',
  create(ctx) {
    const SHOTS_PER_PLAYER = 5;
    const players = ctx.players;

    let turnIdx = 0;
    let shotIdx = 0;
    let goals = players.map(() => 0); // goals scored per player
    let phase = 'await-start'; // 'await-start' | 'aim-power' | 'aim-dir' | 'shooting' | 'resolved' | 'done'
    let rafId = null;
    let unsubInput = null;

    // shot state
    let power = 0;       // 0..1, oscillates
    let powerDir = 1;
    let lockedPower = 0;
    let aim = 0;         // -1..1, oscillates
    let aimDir = 1;
    let lockedAim = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let keeper = { x: 0, target: 0, dive: 0 }; // dive: -1 left, 0 center, 1 right
    let resolvedText = '';

    function curPlayer() { return players[turnIdx]; }

    function newShot() {
      power = 0; powerDir = 1; lockedPower = 0;
      aim = 0; aimDir = 1; lockedAim = 0;
      resolvedText = '';
      // keeper dive picked at moment of shot (so player can't see it ahead)
      keeper.dive = 0;
      // place ball on penalty spot — set in draw based on size
      phase = 'aim-power';
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Shot ${shotIdx + 1}/${SHOTS_PER_PLAYER} · Goals: ${goals[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') {
        promptHide();
        newShot();
        return;
      }
      if (phase === 'aim-power') {
        lockedPower = power;
        phase = 'aim-dir';
        return;
      }
      if (phase === 'aim-dir') {
        lockedAim = aim;
        startShot();
        return;
      }
      if (phase === 'resolved') {
        advance();
      }
    }

    function startShot() {
      phase = 'shooting';
      // keeper picks dive direction based on slight aim leak + randomness
      const r = Math.random();
      // 55% chance to dive a random direction (-1,0,1); 45% chance to guess closer to actual aim
      let dive;
      if (r < 0.45) {
        dive = lockedAim < -0.33 ? -1 : (lockedAim > 0.33 ? 1 : 0);
      } else {
        const opts = [-1, 0, 1];
        dive = opts[Math.floor(Math.random() * 3)];
      }
      keeper.dive = dive;
      // configure ball trajectory: lockedAim controls landing x, lockedPower controls speed/height
      ball.vy = -8 - lockedPower * 6;       // upward
      ball.vx = lockedAim * (4 + lockedPower * 3);
    }

    const history = players.map(() => []);
    function resolve(scored, msg) {
      phase = 'resolved';
      resolvedText = msg;
      history[turnIdx][shotIdx] = scored;
      if (scored) goals[turnIdx] += 1;
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1200);
    }

    function advance() {
      ctx.setOverlay(null);
      shotIdx++;
      if (shotIdx >= SHOTS_PER_PLAYER) {
        // next player or end
        shotIdx = 0;
        if (turnIdx >= players.length - 1) {
          finishGame();
          return;
        }
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
        score: goals[i],
        displayScore: `${goals[i]}/${SHOTS_PER_PLAYER} goals`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to take your first penalty</small></div>`);
      buildBigButton();
      updateStatus();
    }

    function promptHide() {
      ctx.setOverlay(null);
    }

    function buildBigButton() {
      ctx.controllerHost.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      const p = curPlayer();
      btn.style.borderColor = p.color;
      btn.textContent = 'TAP';
      btn.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
      ctx.controllerHost.appendChild(btn);
    }

    function update(dt) {
      if (phase === 'aim-power') {
        power += powerDir * (dt / 1100); // full cycle ~2.2s
        if (power >= 1) { power = 1; powerDir = -1; }
        else if (power <= 0) { power = 0; powerDir = 1; }
      } else if (phase === 'aim-dir') {
        aim += aimDir * (dt / 900);
        if (aim >= 1) { aim = 1; aimDir = -1; }
        else if (aim <= -1) { aim = -1; aimDir = 1; }
      } else if (phase === 'shooting') {
        // ball update done in draw against the geometry; recompute here
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vy += 0.15; // tiny gravity for arc feel
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width;
      const h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // goal geometry
      const goalW = Math.min(w * 0.7, 380);
      const goalH = 100;
      const goalX = (w - goalW) / 2;
      const goalY = 36;
      // back of net
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(goalX, goalY, goalW, goalH);
      // net pattern
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1;
      for (let i = 1; i < 12; i++) {
        const xx = goalX + (i / 12) * goalW;
        c.beginPath(); c.moveTo(xx, goalY); c.lineTo(xx, goalY + goalH); c.stroke();
      }
      for (let i = 1; i < 4; i++) {
        const yy = goalY + (i / 4) * goalH;
        c.beginPath(); c.moveTo(goalX, yy); c.lineTo(goalX + goalW, yy); c.stroke();
      }
      // posts + crossbar
      c.fillStyle = '#fff';
      c.fillRect(goalX - 4, goalY - 4, 4, goalH + 4);
      c.fillRect(goalX + goalW, goalY - 4, 4, goalH + 4);
      c.fillRect(goalX - 4, goalY - 4, goalW + 8, 4);

      // penalty arc / spot
      const spotX = w / 2;
      const spotY = h - 50;
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(spotX, spotY, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.beginPath(); c.arc(spotX, goalY + goalH + 60, 80, Math.PI, Math.PI * 2); c.stroke();

      // keeper
      let keeperX = goalX + goalW / 2;
      if (phase === 'shooting' || phase === 'resolved') {
        // animate keeper toward dive side
        const dest = goalX + goalW / 2 + keeper.dive * (goalW / 2 - 26);
        keeperX = lerp(keeper.x || keeperX, dest, 0.18);
        keeper.x = keeperX;
      } else {
        keeper.x = keeperX;
      }
      drawKeeper(c, keeperX, goalY + goalH - 8);

      // ball position
      if (phase === 'aim-power' || phase === 'aim-dir' || phase === 'await-start' || phase === 'resolved') {
        // sit on penalty spot for setup phases
        ball.x = spotX;
        ball.y = spotY;
      }
      drawBall(c, ball.x, ball.y, curPlayer().color);

      // power meter (left side)
      if (phase === 'aim-power' || phase === 'aim-dir' || phase === 'shooting') {
        drawPowerMeter(c, 16, h / 2 - 80, 18, 160, phase === 'aim-power' ? power : lockedPower, phase !== 'aim-power');
      }
      // aim arrow (above ball) when aiming direction
      if (phase === 'aim-dir' || phase === 'aim-power') {
        const ax = spotX + (phase === 'aim-dir' ? aim : 0) * (goalW / 2 - 20);
        const ay = spotY - 40;
        drawAimArrow(c, ax, ay, curPlayer().color, phase === 'aim-dir');
      }

      // shooting resolution check
      if (phase === 'shooting') {
        // did ball reach goal line?
        if (ball.y <= goalY + goalH / 2) {
          // determine zone by ball.x
          const rel = (ball.x - (goalX + goalW / 2)) / (goalW / 2); // -1..1
          let ballZone;
          if (rel < -0.33) ballZone = -1;
          else if (rel > 0.33) ballZone = 1;
          else ballZone = 0;
          if (ball.x < goalX || ball.x > goalX + goalW) {
            resolve(false, 'Wide! 🙈');
          } else if (ballZone === keeper.dive && lockedPower < 0.85) {
            resolve(false, 'Saved! 🧤');
          } else {
            resolve(true, 'GOAL! ⚽');
          }
        }
      }

      // scoreboard top-left: dots for shots taken
      drawScoreboard(c, 12, 12);
    }

    function drawBall(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 7, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.stroke();
      // pentagon hint
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(x - 2, y - 2, 1.5, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawKeeper(c, x, y) {
      c.save();
      // body
      c.fillStyle = '#fbbf24';
      c.fillRect(x - 9, y - 36, 18, 22);
      // head
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 42, 7, 0, Math.PI * 2);
      c.fill();
      // gloves outstretched
      c.fillStyle = '#fff';
      c.fillRect(x - 18, y - 30, 6, 6);
      c.fillRect(x + 12, y - 30, 6, 6);
      c.restore();
    }

    function drawPowerMeter(c, x, y, w, h, value, locked) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 2, y - 2, w + 4, h + 4);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(x, y, w, h);
      const fillH = h * value;
      const grad = c.createLinearGradient(0, y + h, 0, y);
      grad.addColorStop(0, '#22c55e');
      grad.addColorStop(0.5, '#facc15');
      grad.addColorStop(1, '#ef4444');
      c.fillStyle = grad;
      c.fillRect(x, y + h - fillH, w, fillH);
      // border
      c.strokeStyle = locked ? '#22c55e' : '#fff';
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);
      // label
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'left';
      c.fillText('POWER', x - 2, y - 6);
      c.restore();
    }

    function drawAimArrow(c, x, y, color, active) {
      c.save();
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y + 16);
      c.lineTo(x, y - 6);
      c.stroke();
      c.beginPath();
      c.moveTo(x - 6, y - 4);
      c.lineTo(x, y - 14);
      c.lineTo(x + 6, y - 4);
      c.closePath();
      c.fill();
      if (active) {
        c.fillStyle = '#fff';
        c.font = 'bold 11px "Fredoka", sans-serif';
        c.textAlign = 'center';
        c.fillText('AIM', x, y + 30);
      }
      c.restore();
    }

    function drawScoreboard(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 220, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const p = curPlayer();
      c.fillText(`${p.avatar.emoji} ${p.name}`, x + 8, y + 13);
      // dots: scored = green, missed = red, pending = grey
      const dotsStartX = x + 110;
      for (let i = 0; i < SHOTS_PER_PLAYER; i++) {
        let color = 'rgba(255,255,255,0.25)';
        if (i < shotIdx) {
          // need to know whether this shot was a goal — but we only track totals, so approximate with last goal count tally
          // simpler: use a per-player history we maintain
          color = (history[turnIdx] || [])[i] ? '#22c55e' : '#ef4444';
        }
        c.beginPath();
        c.arc(dotsStartX + i * 14, y + 13, 4, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
      }
      c.restore();
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function escape(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    return {
      start() {
        unsubInput = Input.subscribe(e => {
          if (e.type === 'press') tap();
        });
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
