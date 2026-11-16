// games/cricket.js — Cricket Over (turn-based, 6 balls per player)
// Timing bar swings; tap to swing the bat. Sweet centre = SIX, near = FOUR, edges = 1-2, outside = 0.
Games.register({
  id: 'cricket',
  title: 'Cricket Over',
  sport: 'Cricket',
  theme: 'pitch',
  icon: '🏏',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Face six balls. A timing marker sweeps — tap in the green for a SIX, near it for a FOUR, edges scrape singles. Most runs wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const BALLS = 6;
    const SWEET = { center: 0.5, width: 0.10 };
    const NEAR  = 0.12;
    const players = ctx.players;
    let turnIdx = 0;
    let ballIdx = 0;
    let runs = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let timing = 0, timingDir = 1;
    let lockedTiming = 0;
    let ball = null;     // {x,y,vx,vy,t,outcome}
    let outcomeText = '';
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newBall() {
      timing = 0; timingDir = 1; lockedTiming = 0;
      ball = null;
      outcomeText = '';
      phase = 'await-swing';
      updateStatus();
      // pitcher releases — show a delay then enable swing window
      setTimeout(() => { if (phase === 'await-swing') phase = 'swinging'; }, 300);
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Ball ${ballIdx + 1}/${BALLS} · Runs: ${runs[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newBall(); return; }
      if (phase === 'swinging') { lockedTiming = timing; resolveSwing(); return; }
      if (phase === 'resolved') advance();
    }

    function resolveSwing() {
      phase = 'flying';
      const dist = Math.abs(lockedTiming - SWEET.center);
      let pts = 0; let label = '';
      if (dist <= SWEET.width / 2) { pts = 6; label = 'SIX! 🚀'; }
      else if (dist <= (SWEET.width / 2) + NEAR / 2) { pts = 4; label = 'FOUR! 🏏'; }
      else if (dist <= (SWEET.width / 2) + NEAR) { pts = 2; label = '+2 runs'; }
      else if (dist <= (SWEET.width / 2) + NEAR * 1.4) { pts = 1; label = '+1 run'; }
      else { pts = 0; label = 'Missed it!'; }
      runs[turnIdx] += pts;
      history[turnIdx][ballIdx] = pts;
      const g = geom();
      ball = { x: g.batX, y: g.batY, vx: 0, vy: 0, t: 0, outcome: pts };
      // animate based on outcome
      if (pts === 6) { ball.vx = 6.5; ball.vy = -7.5; }
      else if (pts === 4) { ball.vx = 5; ball.vy = -3.5; }
      else if (pts >= 1) { ball.vx = 3; ball.vy = -1.5; }
      else { ball.vx = -3; ball.vy = -1; }
      outcomeText = label;
      ctx.setOverlay(`<div>${label}</div>`, { small: true });
      setTimeout(advance, 1200);
    }

    function advance() {
      ctx.setOverlay(null);
      ballIdx++;
      if (ballIdx >= BALLS) {
        ballIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newBall();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: runs[i],
        displayScore: `${runs[i]} runs`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to face the over</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'SWING', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const pitchTop = 50;
      const pitchBottom = h - 80;
      const bowlerX = w * 0.5;
      const bowlerY = pitchTop;
      const batX = w * 0.5;
      const batY = pitchBottom;
      return { w, h, bowlerX, bowlerY, batX, batY };
    }

    function update(dt) {
      if (phase === 'swinging') {
        const o = Meters.oscillate(timing, timingDir, 0.95, dt);
        timing = o.value; timingDir = o.dir;
      } else if (phase === 'flying' && ball) {
        const step = dt / 16.67;
        ball.x += ball.vx * step;
        ball.y += ball.vy * step;
        ball.vy += 0.32 * step;
        ball.t += dt;
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // pitch (vertical strip of brown earth between bowler & batter)
      c.fillStyle = '#a16207';
      c.fillRect(g.w / 2 - 32, g.bowlerY, 64, g.batY - g.bowlerY);
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      // creases
      c.beginPath();
      c.moveTo(g.w / 2 - 36, g.bowlerY + 8); c.lineTo(g.w / 2 + 36, g.bowlerY + 8);
      c.moveTo(g.w / 2 - 36, g.batY - 8); c.lineTo(g.w / 2 + 36, g.batY - 8);
      c.stroke();
      // stumps at each end
      drawStumps(c, g.w / 2, g.bowlerY + 8);
      drawStumps(c, g.w / 2, g.batY - 8);

      // bowler
      drawFigure(c, g.bowlerX, g.bowlerY - 14, '#475569');
      // batter
      drawFigure(c, g.batX, g.batY - 18, curPlayer().color, true);

      // ball
      if (phase === 'flying' && ball) {
        c.save();
        c.fillStyle = '#ef4444';
        c.beginPath(); c.arc(ball.x, ball.y, 5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
        c.restore();
      }

      // timing bar
      if (phase === 'swinging' || phase === 'flying' || phase === 'resolved') {
        const barW = Math.min(g.w * 0.7, 360);
        const barX = (g.w - barW) / 2;
        const barY = 22;
        Meters.drawTimingBar(c, barX, barY, barW, 16, phase === 'swinging' ? timing : lockedTiming, SWEET, phase !== 'swinging', 'TIMING');
      }

      drawScoreboard(c, 12, g.h - 32);
    }

    function drawStumps(c, x, y) {
      c.save();
      c.strokeStyle = '#fef3c7';
      c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(x + i * 6, y);
        c.lineTo(x + i * 6, y - 16);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(x - 9, y - 16); c.lineTo(x + 9, y - 16);
      c.stroke();
      c.restore();
    }

    function drawFigure(c, x, y, color, withBat = false) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 22, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 7, y - 4, 14, 22);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 12, 7, 0, Math.PI * 2);
      c.fill();
      if (withBat) {
        c.strokeStyle = '#fde68a';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x + 4, y + 4); c.lineTo(x + 18, y + 18);
        c.stroke();
      }
      c.restore();
    }

    function drawScoreboard(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 240, 24);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      const h = history[turnIdx];
      const parts = [];
      for (let i = 0; i < BALLS; i++) {
        if (h[i] === undefined) parts.push('•');
        else if (h[i] === 6) parts.push('6');
        else if (h[i] === 4) parts.push('4');
        else parts.push(`${h[i]}`);
      }
      c.fillText(`${p.avatar.emoji} ${p.name}: ${parts.join(' ')}`, x + 6, y + 12);
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
