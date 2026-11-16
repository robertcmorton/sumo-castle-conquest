// games/hurdles.js — Hurdles (turn-based, sequenced tap-jumps)
// 6 hurdles approach in sequence. Tap as each hurdle reaches the jump zone.
// Perfect timing = clean clear; off = stumble. Score = clean clears.
Games.register({
  id: 'hurdles',
  title: '110m Hurdles',
  sport: 'Athletics',
  theme: 'stadium',
  icon: '🏃‍♂️',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Six hurdles approach. Tap as each one reaches the jump zone. Too early or too late = stumble.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const HURDLES = 6;
    const players = ctx.players;
    let turnIdx = 0;
    const results = [];

    let phase = 'prompt';
    let clean = 0;
    let stumbles = 0;
    let hurdleX = 0; // next hurdle position 0..1 (1 = at jump zone)
    let hurdleIdx = 0;
    let hurdleSpeed = 0.7;
    let jumping = 0; // frames remaining of jump anim
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      clean = 0; stumbles = 0; hurdleIdx = 0; hurdleX = -0.2; hurdleSpeed = 0.7; jumping = 0;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to take off</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'JUMP', tap);
      ctx.setStatus(`${p.name} — ready`);
    }

    function tap() {
      if (phase === 'prompt') { ctx.setOverlay(null); phase = 'running'; return; }
      if (phase !== 'running') return;
      // judge: if hurdle is between 0.85 and 1.05, it's clean
      if (hurdleX >= 0.82 && hurdleX <= 1.08) {
        clean++;
        jumping = 12;
        // advance past hurdle
        nextHurdle();
      } else {
        stumbles++;
        jumping = 6;
        hurdleSpeed *= 0.7;
        // still skip the hurdle so they don't get blocked
        nextHurdle();
      }
    }

    function nextHurdle() {
      hurdleIdx++;
      hurdleX = -0.2;
      hurdleSpeed = 0.7 + hurdleIdx * 0.04;
      if (hurdleIdx >= HURDLES) finishTurn();
    }

    function update(dt) {
      if (phase !== 'running') return;
      hurdleX += hurdleSpeed * (dt / 1000);
      if (jumping > 0) jumping--;
      if (hurdleX > 1.4) {
        // missed completely
        stumbles++;
        nextHurdle();
      }
      ctx.setStatus(`${curPlayer().name} · ${hurdleIdx}/${HURDLES} · ${clean} clean`);
    }

    function finishTurn() {
      phase = 'turn-done';
      const score = clean * 100 - stumbles * 25;
      results.push({
        playerIdx: curPlayer().slot,
        score: Math.max(0, score),
        displayScore: `${clean}/${HURDLES} clean`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}: <strong>${clean}/${HURDLES}</strong></div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1400);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      const groundY = h - 60;
      const runnerX = w * 0.18;
      // track
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(0, groundY, w, h - groundY);
      c.fillStyle = '#9a3412';
      c.fillRect(0, groundY, w, 4);

      // sweet zone marker
      const zoneX = runnerX + 10;
      c.fillStyle = 'rgba(34,197,94,0.18)';
      c.fillRect(zoneX - 22, groundY - 36, 44, 36);
      c.strokeStyle = 'rgba(34,197,94,0.6)';
      c.lineWidth = 1; c.strokeRect(zoneX - 22, groundY - 36, 44, 36);

      // hurdle moving from right to runner
      if (phase === 'running' && hurdleIdx < HURDLES) {
        const hX = runnerX + (1 - hurdleX) * (w - runnerX - 40) + 40;
        drawHurdle(c, hX, groundY);
      }

      // runner
      const runY = groundY - 24 - (jumping > 0 ? 28 : 0);
      drawRunner(c, runnerX, runY, curPlayer().color, curPlayer().avatar.emoji);

      // HUD
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 220, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Hurdle ${Math.min(HURDLES, hurdleIdx + 1)} of ${HURDLES} · ${clean} clean`, 22, 25);
      c.restore();
    }

    function drawHurdle(c, x, y) {
      c.save();
      c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x - 14, y); c.lineTo(x - 14, y - 30); c.stroke();
      c.beginPath(); c.moveTo(x + 14, y); c.lineTo(x + 14, y - 30); c.stroke();
      c.fillStyle = '#ef4444';
      c.fillRect(x - 16, y - 28, 32, 8);
      c.restore();
    }

    function drawRunner(c, x, y, color, emoji) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 22, 12, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y);
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
