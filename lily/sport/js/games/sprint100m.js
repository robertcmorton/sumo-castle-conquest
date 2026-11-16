// games/sprint100m.js — 100m Sprint (SIMULTANEOUS race, 1-6 players)
// All players race at the same time. Each player alternates their own two buttons
// (or two keyboard keys) to power their runner forward. First to 100m wins.
// Race ends when everyone finishes or 30 seconds elapse.
Games.register({
  id: 'sprint100m',
  title: '100m Sprint',
  sport: 'Athletics',
  theme: 'stadium',
  icon: '🏃',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: true,
  instructions: 'All players race at once! Alternate your two buttons — left, right, left, right — to sprint. First to 100m wins. 30-second cap.',
  controls: 'Touch: each player has their own pair of L/R buttons. Keyboard: P1 A/S · P2 K/L · P3 G/H · P4 ,/. · P5 Q/W · P6 O/P',
  create(ctx) {
    const TIME_LIMIT_MS = 30000;
    const STEP_M = 1.8;
    const TRACK_M = 100;

    const players = ctx.players;
    const runners = players.map(p => ({
      slot: p.slot,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      meters: 0,
      lastFoot: null,
      finished: false,
      finishMs: null,
      bob: 0,
    }));

    let phase = 'countdown';
    let countdownStart = 0;
    let raceStart = 0;
    let elapsed = 0;
    let rafId = null;
    let unsubInput = null;

    function tap(playerIdx, role) {
      if (phase !== 'racing') return;
      const r = runners[playerIdx];
      if (!r || r.finished) return;
      if (role !== 'left' && role !== 'right') return;
      if (r.lastFoot === role) return;  // require alternation
      r.lastFoot = role;
      r.meters = Math.min(TRACK_M, r.meters + STEP_M);
      r.bob += 0.6;
      if (r.meters >= TRACK_M) {
        r.finished = true;
        r.finishMs = elapsed;
      }
      if (runners.every(x => x.finished)) endRace();
    }

    function endRace() {
      if (phase === 'done') return;
      phase = 'done';
      const results = runners.map(r => {
        if (r.finished) {
          return {
            playerIdx: r.slot,
            score: Math.round(30000 - r.finishMs),    // faster time = higher score
            displayScore: `${(r.finishMs / 1000).toFixed(2)}s`,
          };
        }
        return {
          playerIdx: r.slot,
          score: Math.round(r.meters * 10),           // partial credit, always below any finisher
          displayScore: `${r.meters.toFixed(0)}m`,
        };
      });
      setTimeout(() => ctx.finish(results), 1400);
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) {
          phase = 'racing';
          raceStart = performance.now();
          ctx.setOverlay(null);
        } else {
          ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        }
        return;
      }
      if (phase !== 'racing') return;
      elapsed = performance.now() - raceStart;
      const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);
      ctx.setStatus(`${(remaining / 1000).toFixed(1)}s left`);
      if (elapsed >= TIME_LIMIT_MS) endRace();
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      const trackLeft = 20, trackRight = w - 20;
      const trackW = trackRight - trackLeft;
      const laneH = (h - 80) / runners.length;
      const laneTop = 40;

      // 25m gridlines
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1;
      c.setLineDash([4, 6]);
      for (let m = 25; m < 100; m += 25) {
        const x = trackLeft + (m / TRACK_M) * trackW;
        c.beginPath();
        c.moveTo(x, laneTop);
        c.lineTo(x, laneTop + laneH * runners.length);
        c.stroke();
      }
      c.setLineDash([]);
      // start + finish lines
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(trackLeft, laneTop);  c.lineTo(trackLeft, laneTop + laneH * runners.length);
      c.moveTo(trackRight, laneTop); c.lineTo(trackRight, laneTop + laneH * runners.length);
      c.stroke();
      drawCheckers(c, trackRight - 14, laneTop, 14, laneH * runners.length);

      // lanes + runners
      runners.forEach((r, i) => {
        const yTop = laneTop + i * laneH;
        c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
        c.fillRect(trackLeft, yTop, trackW, laneH);
        // colored lane edge
        c.fillStyle = r.color + '33';
        c.fillRect(trackLeft, yTop, 8, laneH);
        // name + distance
        c.fillStyle = '#fff';
        c.font = 'bold 13px "Baloo 2", sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(`${r.name}  ${r.meters.toFixed(0)}m`, trackLeft + 14, yTop + 4);
        // runner
        const cx = trackLeft + (r.meters / TRACK_M) * trackW;
        const cy = yTop + laneH * 0.65 + Math.sin(r.bob) * 3;
        drawRunner(c, cx, cy, r.color, r.avatar.emoji, r.finished);
        // keyboard hint during countdown
        if (phase === 'countdown') {
          const hint = Input.keyHint(r.slot, 'dual');
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.font = '11px "Fredoka", sans-serif';
          c.textAlign = 'right';
          c.fillText(`Keys: ${hint}`, trackRight - 20, yTop + 4);
        }
      });
    }

    function drawRunner(c, x, y, color, emoji, finished) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 18, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y);
      if (finished) { c.font = '20px sans-serif'; c.fillText('🏁', x + 22, y - 6); }
      c.restore();
    }

    function drawCheckers(c, x, y, w, h) {
      const sq = 6;
      for (let row = 0; row * sq < h; row++) {
        for (let col = 0; col * sq < w; col++) {
          c.fillStyle = (row + col) % 2 === 0 ? '#fff' : '#000';
          c.fillRect(x + col * sq, y + row * sq, sq, sq);
        }
      }
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt); draw();
      rafId = requestAnimationFrame(loop);
    }

    return {
      start() {
        // build a dual controller for every player — they all race at once
        Input.buildController(ctx.controllerHost, players, 'dual', { left: 'L', right: 'R' });
        unsubInput = Input.subscribe(e => {
          if (e.type === 'press' && (e.role === 'left' || e.role === 'right')) {
            tap(e.player, e.role);
          }
        });
        countdownStart = performance.now();
        ctx.setOverlay('<div>READY</div>');
        lastT = 0;
        rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (unsubInput) unsubInput();
      },
      onResize() {},
    };
  },
});
