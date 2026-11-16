// games/swimming.js — Rhythm Freestyle (turn-based, 1-6 players)
// A metronome bar sweeps left ↔ right. Tap when the marker is in the green zone for a full stroke.
// Hit the green = +2.0m. Yellow edges = +1.0m. Outside = stall (+0.2m + tiny delay).
// 50m to finish or 30s cap. Fastest time wins.
Games.register({
  id: 'swimming',
  title: '50m Freestyle',
  sport: 'Swimming',
  theme: 'pool',
  icon: '🏊',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Time your strokes with the metronome. Tap when the marker is in the green for a full stroke; edges still pull but slower. Outside the zone wastes your move. 50m, 30s cap.',
  controls: 'Tap the screen / big button / press Space — to the beat.',
  create(ctx) {
    const TIME_LIMIT_MS = 30000;
    const TRACK_M = 50;
    const SWEET = { center: 0.5, width: 0.18 };
    const NEAR = 0.12;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let swimmer = null;
    let bar = 0, barDir = 1;
    let stallUntil = 0;
    let raceStart = 0;
    let elapsed = 0;
    let countdownStart = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to dive in</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'STROKE', tap);
      ctx.setStatus(`${p.name} on the blocks`);
    }

    function startCountdown() {
      phase = 'countdown';
      countdownStart = performance.now();
      ctx.setOverlay('<div>READY</div>');
    }

    function startRace() {
      phase = 'racing';
      raceStart = performance.now();
      ctx.setOverlay(null);
      const p = curPlayer();
      swimmer = { meters: 0, color: p.color, avatar: p.avatar, name: p.name, splashPhase: 0, finished: false, finishMs: null };
      bar = 0; barDir = 1; stallUntil = 0;
    }

    function tap() {
      if (phase === 'prompt') return startCountdown();
      if (phase !== 'racing' || !swimmer || swimmer.finished) return;
      const now = performance.now();
      if (now < stallUntil) return;
      const dist = Math.abs(bar - SWEET.center);
      let gain;
      if (dist <= SWEET.width / 2) gain = 2.0;
      else if (dist <= SWEET.width / 2 + NEAR / 2) gain = 1.0;
      else { gain = 0.2; stallUntil = now + 250; } // wasted stroke
      swimmer.meters = Math.min(TRACK_M, swimmer.meters + gain);
      swimmer.splashPhase = 10;
      if (swimmer.meters >= TRACK_M) {
        swimmer.finished = true;
        swimmer.finishMs = elapsed;
        finishTurn();
      }
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) startRace();
        else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        return;
      }
      if (phase !== 'racing' || !swimmer) return;
      // bar tempo speeds up as you progress
      const speed = 1.0 + swimmer.meters / TRACK_M * 0.4;
      const o = Meters.oscillate(bar, barDir, speed, dt);
      bar = o.value; barDir = o.dir;
      if (swimmer.splashPhase > 0) swimmer.splashPhase -= dt / 60;
      elapsed = performance.now() - raceStart;
      const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);
      ctx.setStatus(`${swimmer.name} · ${(remaining / 1000).toFixed(1)}s · ${swimmer.meters.toFixed(0)}m`);
      if (elapsed >= TIME_LIMIT_MS && !swimmer.finished) finishTurn();
    }

    function finishTurn() {
      phase = 'turn-done';
      const r = swimmer;
      let score, displayScore;
      if (r.finished) {
        score = Math.round(30000 - r.finishMs);
        displayScore = `${(r.finishMs / 1000).toFixed(2)}s`;
      } else {
        score = Math.round(r.meters * 10);
        displayScore = `${r.meters.toFixed(0)}m`;
      }
      results.push({ playerIdx: curPlayer().slot, score, displayScore });
      ctx.setOverlay(`<div>${r.avatar.emoji} ${escape(r.name)}: <strong>${displayScore}</strong></div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) { phase = 'done'; ctx.finish(results); }
        else { turnIdx++; promptStart(); }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      const trackLeft = 20, trackRight = w - 20;
      const trackW = trackRight - trackLeft;
      const laneTop = 80, laneH = h - 180;

      // pool
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(trackLeft, laneTop, trackW, laneH);
      // lane ropes
      c.fillStyle = 'rgba(255,255,255,0.4)';
      for (let lane = 1; lane < 4; lane++) {
        const y = laneTop + lane * (laneH / 4);
        for (let x = trackLeft; x < trackRight; x += 14) {
          c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
        }
      }
      // walls
      c.fillStyle = '#fef9c3'; c.fillRect(trackLeft - 6, laneTop, 6, laneH);
      c.fillStyle = '#fff'; c.fillRect(trackRight, laneTop, 6, laneH);
      // 10m markers
      c.font = 'bold 10px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.textAlign = 'center';
      for (let m = 10; m < TRACK_M; m += 10) {
        const x = trackLeft + (m / TRACK_M) * trackW;
        c.fillText(`${m}m`, x, laneTop - 6);
      }

      // swimmer
      if (swimmer) {
        const cx = trackLeft + (swimmer.meters / TRACK_M) * trackW;
        const cy = laneTop + laneH * 0.5;
        if (swimmer.splashPhase > 0) {
          c.fillStyle = `rgba(255,255,255,${Math.min(0.5, swimmer.splashPhase / 12)})`;
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2;
            const rr = 10 + swimmer.splashPhase;
            c.beginPath();
            c.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1.6, 0, Math.PI * 2);
            c.fill();
          }
        }
        c.fillStyle = swimmer.color;
        c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#fff';
        c.font = '14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(swimmer.avatar.emoji, cx, cy);
        if (swimmer.finished) { c.font = '18px sans-serif'; c.fillText('🏁', cx + 20, cy - 6); }
        // name + distance
        c.fillStyle = '#fff';
        c.font = 'bold 13px "Baloo 2", sans-serif';
        c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText(`${swimmer.name}  ${swimmer.meters.toFixed(0)}m`, trackLeft + 8, laneTop + laneH + 6);
      }

      // metronome timing bar at the bottom
      if (phase === 'racing') {
        const barW = Math.min(w * 0.8, 420);
        const barX = (w - barW) / 2;
        const barY = h - 38;
        Meters.drawTimingBar(c, barX, barY, barW, 18, bar, SWEET, false, 'TIMING');
      }
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
