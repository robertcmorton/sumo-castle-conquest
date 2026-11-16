// games/baseball.js — Home Run Derby (positional bat-zone)
// A horizontal bat slider sweeps left↔right at the plate. The pitched ball reveals where
// it will land. Tap to swing — the bat freezes at its current x. Overlap the ball's landing
// spot for a HOME RUN. Close = single. Off = strike.
Games.register({
  id: 'baseball',
  title: 'Home Run Derby',
  sport: 'Baseball',
  theme: 'stadium',
  icon: '⚾',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'A bat sweeps along the plate. Each pitch shows you where it will land — tap to FREEZE the bat. Overlap the ball for a home run, near miss for a single, way off for a strike.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const PITCHES = 5;
    const players = ctx.players;
    let turnIdx = 0;
    let pitchIdx = 0;
    let hrs = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start'; // 'pitching' | 'swinging' | 'flying' | 'resolved' | 'done'
    let batX = 0;               // bat slider position (0..1)
    let batDir = 1;
    let batSpeed = 0.95;
    let lockedBat = 0;
    let ballTargetX = 0;        // 0..1 — where the ball will arrive on the plate line
    let ballState = null;        // {t, T, outcome, startX, startY, endX, endY}
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newPitch() {
      batX = 0.5; batDir = (Math.random() < 0.5 ? -1 : 1);
      batSpeed = 0.85 + Math.random() * 0.5;
      lockedBat = 0;
      ballTargetX = 0.15 + Math.random() * 0.7;
      ballState = null;
      phase = 'swinging';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Pitch ${pitchIdx + 1}/${PITCHES} · HRs: ${hrs[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newPitch(); return; }
      if (phase === 'swinging') return swing();
      if (phase === 'resolved') return advance();
    }

    function swing() {
      lockedBat = batX;
      // outcome based on distance between lockedBat and ballTargetX (both 0..1)
      const d = Math.abs(lockedBat - ballTargetX);
      let outcome, msg;
      if (d <= 0.045) { outcome = 'HR'; msg = 'HOME RUN! 💥'; hrs[turnIdx]++; }
      else if (d <= 0.12) { outcome = 'hit'; msg = 'Just a single.'; }
      else { outcome = 'strike'; msg = 'Whiff!'; }
      history[turnIdx][pitchIdx] = outcome;
      phase = 'flying';
      const g = geom();
      ballState = {
        t: 0, T: outcome === 'HR' ? 1.2 : 0.7,
        outcome,
        startX: g.mountX, startY: g.mountY - 18,
        targetX: g.plateLeft + lockedBat * g.plateW,
        targetY: g.plateY,
      };
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1300);
    }

    function advance() {
      ctx.setOverlay(null);
      pitchIdx++;
      if (pitchIdx >= PITCHES) {
        pitchIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++; promptStart(); return;
      }
      newPitch();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: hrs[i],
        displayScore: `${hrs[i]} HRs`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap when ready to bat</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'SWING', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const groundY = h - 50;
      const mountX = w / 2;
      const mountY = h * 0.32;
      const plateLeft = 30;
      const plateRight = w - 30;
      const plateW = plateRight - plateLeft;
      const plateY = groundY - 30;
      return { w, h, groundY, mountX, mountY, plateLeft, plateRight, plateW, plateY };
    }

    function update(dt) {
      if (phase === 'swinging') {
        const o = Meters.oscillate(batX, batDir, batSpeed, dt, 0, 1);
        batX = o.value; batDir = o.dir;
      } else if (phase === 'flying' && ballState) {
        ballState.t += dt / 1000;
      }
    }

    function ballPos() {
      if (!ballState) return null;
      const u = Math.min(1, ballState.t / ballState.T);
      let endX = ballState.targetX, endY = ballState.targetY;
      let peakY = -120;
      if (ballState.outcome === 'HR') {
        endX = ballState.targetX + (ballState.targetX > ctx.width / 2 ? 60 : -60);
        endY = ctx.height * 0.18; peakY = -180;
      } else if (ballState.outcome === 'hit') {
        endX = ballState.targetX + 30;
        endY = ctx.height * 0.55; peakY = -90;
      }
      const x = ballState.startX + (endX - ballState.startX) * u;
      const arcY = (1 - u) * (1 - u) * ballState.startY + 2 * (1 - u) * u * (ballState.startY + peakY) + u * u * endY;
      return { x, y: arcY };
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // field
      c.fillStyle = '#16a34a';
      c.fillRect(0, g.groundY - 40, g.w, g.h - (g.groundY - 40));
      c.fillStyle = '#a16207';
      c.beginPath(); c.ellipse(g.mountX, g.mountY + 6, 80, 16, 0, 0, Math.PI * 2); c.fill();
      // outfield fence
      c.fillStyle = '#0f172a';
      c.fillRect(0, g.h * 0.28, g.w, 6);
      c.fillStyle = '#fbbf24';
      c.fillRect(0, g.h * 0.28 - 4, g.w, 4);

      // plate strip
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(g.plateLeft, g.plateY - 8, g.plateW, 16);
      c.strokeStyle = '#fff'; c.lineWidth = 1; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(g.plateLeft, g.plateY); c.lineTo(g.plateRight, g.plateY); c.stroke();
      c.setLineDash([]);

      // ball target marker (the predicted landing spot)
      if (phase === 'swinging' || phase === 'flying' || phase === 'resolved') {
        const tx = g.plateLeft + ballTargetX * g.plateW;
        c.strokeStyle = 'rgba(239,68,68,0.85)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(tx, g.plateY, 12, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.moveTo(tx - 16, g.plateY); c.lineTo(tx + 16, g.plateY);
        c.moveTo(tx, g.plateY - 16); c.lineTo(tx, g.plateY + 16);
        c.stroke();
      }

      // bat slider
      const bx = phase === 'swinging' ? batX : lockedBat;
      const batCenterX = g.plateLeft + bx * g.plateW;
      drawBat(c, batCenterX, g.plateY - 4, curPlayer().color, phase !== 'swinging');

      // pitcher (always at mound)
      drawFigure(c, g.mountX, g.mountY - 10, '#475569');

      // ball
      if (phase === 'flying' && ballState) {
        const p = ballPos();
        if (p) drawBall(c, p.x, p.y);
      } else if (phase === 'swinging' || phase === 'await-start' || phase === 'resolved') {
        drawBall(c, g.mountX, g.mountY - 18);
      }

      drawScoreboard(c, 12, g.h - 32);
    }

    function drawBat(c, x, y, color, locked) {
      c.save();
      c.strokeStyle = locked ? '#22c55e' : color;
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - 30, y); c.lineTo(x + 30, y);
      c.stroke();
      // bat head dot
      c.fillStyle = locked ? '#22c55e' : '#fff';
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawFigure(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 12, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 6, y - 18, 12, 20);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 22, 6, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function drawBall(c, x, y) {
      c.save();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#dc2626'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x - 1, y - 1, 3.5, 0, Math.PI * 1.5); c.stroke();
      c.restore();
    }

    function drawScoreboard(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 240, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      c.fillText(`${p.avatar.emoji} ${p.name}`, x + 8, y + 13);
      const dotsX = x + 110;
      for (let i = 0; i < PITCHES; i++) {
        const v = history[turnIdx][i];
        let col = 'rgba(255,255,255,0.25)';
        if (v === 'HR') col = '#facc15';
        else if (v === 'hit') col = '#94a3b8';
        else if (v === 'strike') col = '#ef4444';
        c.fillStyle = col;
        c.beginPath(); c.arc(dotsX + i * 14, y + 13, 4, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }

    function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt); draw();
      rafId = requestAnimationFrame(loop);
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
