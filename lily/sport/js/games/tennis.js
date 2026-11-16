// games/tennis.js — Tennis Rally (turn-based, one rally per player)
// Each player runs a solo rally vs the AI. A timing bar swings when the ball reaches you;
// tap in the green to return cleanly. Miss = rally ends. Score = rally length.
Games.register({
  id: 'tennis',
  title: 'Tennis Rally',
  sport: 'Tennis',
  theme: 'court',
  icon: '🎾',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Keep the rally alive. When the ball reaches your side, a timing bar appears — tap in the green to return. Sweet spot stays narrower as you go. Highest rally wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const players = ctx.players;
    let turnIdx = 0;
    let rallies = players.map(() => 0);
    let phase = 'await-start';  // 'await-start' | 'ai-out' | 'ai-in' | 'await-swing' | 'returning' | 'resolved' | 'done'
    let ballPos = { x: 0, y: 0 };
    let ballFrom = { x: 0, y: 0 };
    let ballTo = { x: 0, y: 0 };
    let ballT = 0;
    let ballDur = 0.9;
    let timing = 0, timingDir = 1;
    let lockedTiming = 0;
    let resolvedMissed = false;
    let rallyCount = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const netY = h * 0.5;
      const playerY = h - 60;
      const aiY = 60;
      const courtLeft = 20;
      const courtRight = w - 20;
      return { w, h, netY, playerY, aiY, courtLeft, courtRight };
    }

    function newRally() {
      rallyCount = 0;
      phase = 'ai-out';
      hitFromAI();
      updateStatus();
    }

    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Rally: ${rallyCount}`);
    }

    function hitFromAI() {
      const g = geom();
      ballFrom = { x: lerp(g.courtLeft + 40, g.courtRight - 40, Math.random()), y: g.aiY };
      ballTo = { x: lerp(g.courtLeft + 40, g.courtRight - 40, Math.random()), y: g.playerY };
      ballT = 0;
      const diff = Math.max(0.45, 0.9 - rallyCount * 0.03); // gets faster
      ballDur = diff;
      phase = 'ai-in';
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newRally(); return; }
      if (phase === 'await-swing') { lockedTiming = timing; return swing(); }
      if (phase === 'resolved') advance();
    }

    function swing() {
      // sweet spot tightens as rally grows
      const sweetW = Math.max(0.08, 0.22 - rallyCount * 0.008);
      const sweet = { center: 0.5, width: sweetW };
      const dist = Math.abs(lockedTiming - sweet.center);
      if (dist > sweet.width / 2) {
        return missReturn();
      }
      rallyCount += 1;
      rallies[turnIdx] = rallyCount;
      phase = 'returning';
      const g = geom();
      ballFrom = { x: ballPos.x, y: g.playerY };
      ballTo = { x: lerp(g.courtLeft + 30, g.courtRight - 30, Math.random()), y: g.aiY };
      ballT = 0;
      ballDur = 0.55;
      updateStatus();
    }

    function missReturn() {
      phase = 'resolved';
      resolvedMissed = true;
      ctx.setOverlay(`<div>Out of reach!<br><small>Rally: ${rallyCount}</small></div>`, { small: true });
      setTimeout(advance, 1300);
    }

    function update(dt) {
      if (phase === 'ai-in' || phase === 'returning') {
        ballT += dt / 1000;
        const u = Math.min(1, ballT / ballDur);
        ballPos.x = lerp(ballFrom.x, ballTo.x, u);
        // arc parabola
        const peakOffset = -40;
        ballPos.y = lerp(ballFrom.y, ballTo.y, u) + (1 - 2 * Math.abs(u - 0.5)) * peakOffset;
        if (u >= 1) {
          if (phase === 'ai-in') {
            // ball arrived at player; prompt swing
            phase = 'await-swing';
            timing = 0; timingDir = 1; lockedTiming = 0;
            // window timer
            setTimeout(() => {
              if (phase === 'await-swing') missReturn();
            }, 1100);
          } else {
            // returning -> AI hits back
            // AI might miss after long rallies, but mostly continues
            const aiMissChance = Math.max(0.02, 0.04 + rallyCount * 0.004);
            if (Math.random() < aiMissChance) {
              // AI missed -> rally continues w/ a free point? Let's keep it simple: rally ends in win for player
              phase = 'resolved';
              ctx.setOverlay(`<div>AI dropped it!<br><small>Rally: ${rallyCount}</small></div>`, { small: true });
              setTimeout(advance, 1300);
              return;
            }
            hitFromAI();
          }
        }
      } else if (phase === 'await-swing') {
        const o = Meters.oscillate(timing, timingDir, 1.0, dt);
        timing = o.value; timingDir = o.dir;
      }
    }

    function advance() {
      ctx.setOverlay(null);
      if (turnIdx >= players.length - 1) return finishGame();
      turnIdx++;
      promptStart();
    }

    function finishGame() {
      phase = 'done';
      const results = players.map((p, i) => ({
        playerIdx: p.slot,
        score: rallies[i],
        displayScore: `${rallies[i]} returns`,
      }));
      ctx.finish(results);
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start the rally</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'RETURN', tap);
      updateStatus();
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // court
      c.fillStyle = '#1d4ed8';
      c.fillRect(g.courtLeft, 30, g.courtRight - g.courtLeft, g.h - 60);
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      // outer
      c.strokeRect(g.courtLeft, 30, g.courtRight - g.courtLeft, g.h - 60);
      // net (horizontal middle)
      c.fillStyle = '#fff';
      c.fillRect(g.courtLeft - 6, g.netY - 2, g.courtRight - g.courtLeft + 12, 4);
      // service boxes
      c.beginPath();
      c.moveTo(g.courtLeft + 30, g.netY - 60); c.lineTo(g.courtRight - 30, g.netY - 60);
      c.moveTo(g.courtLeft + 30, g.netY + 60); c.lineTo(g.courtRight - 30, g.netY + 60);
      c.moveTo((g.courtLeft + g.courtRight) / 2, g.netY - 60); c.lineTo((g.courtLeft + g.courtRight) / 2, g.netY + 60);
      c.stroke();

      // AI on top
      drawPlayerFig(c, g.w / 2, g.aiY - 8, '#94a3b8');
      // player on bottom
      drawPlayerFig(c, g.w / 2, g.playerY - 8, curPlayer().color);

      // ball
      if (phase === 'ai-in' || phase === 'returning' || phase === 'await-swing') {
        drawBall(c, ballPos.x, ballPos.y);
      }

      // timing bar when await-swing
      if (phase === 'await-swing') {
        const sweetW = Math.max(0.08, 0.22 - rallyCount * 0.008);
        const sweet = { center: 0.5, width: sweetW };
        const barW = Math.min(g.w * 0.7, 320);
        const barX = (g.w - barW) / 2;
        const barY = g.h - 32;
        Meters.drawTimingBar(c, barX, barY, barW, 14, timing, sweet, false, 'SWING');
      }

      // rally counter
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 110, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 13px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Rally: ${rallyCount}`, 22, 25);
      c.restore();
    }

    function drawPlayerFig(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 12, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y - 8, 12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.restore();
    }

    function drawBall(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x + 2, y + 6, 6, 2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fde047';
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
      c.restore();
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
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
