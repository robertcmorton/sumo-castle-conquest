// games/surfing.js — Surfing Balance (continuous teeter compensation)
// A balance meter drifts left↔right autonomously. Hold ◀ or ▶ to tilt back the other way.
// Stay within tolerance; cumulative time balanced = score. 25-second run.
Games.register({
  id: 'surfing',
  title: 'Surfing',
  sport: 'Surfing',
  theme: 'beach',
  icon: '🏄',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'You\'re on a wave. The balance meter drifts. HOLD ◀ or ▶ to lean back. The more time you stay near centre, the higher your score. Wipe out if you drift to the edge.',
  controls: 'Touch: ◀ / ▶ hold-buttons. Keyboard: A/S.',
  create(ctx) {
    const RUN_MS = 25000;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let balance = 0;      // -1..1
    let drift = 0;        // current drift velocity per second
    let leanL = false, leanR = false;
    let goodTime = 0;     // ms spent within [-0.4, 0.4]
    let wipedOut = false;
    let runStart = 0;
    let countdownStart = 0;
    let driftFlipTimer = 0;
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null, kuHandler = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      balance = 0; drift = 0.2; leanL = false; leanR = false;
      goodTime = 0; wipedOut = false; driftFlipTimer = 0;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Hold ◀ or ▶ to start</small></div>`);
      buildController();
      ctx.setStatus(`${p.name} paddling out`);
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'tap-row';
      const left = makeBtn('◀', () => leanL = true, () => leanL = false);
      const right = makeBtn('▶', () => leanR = true, () => leanR = false);
      left.style.setProperty('--player-color', curPlayer().color);
      right.style.setProperty('--player-color', curPlayer().color);
      row.appendChild(left); row.appendChild(right);
      ctx.controllerHost.appendChild(row);
    }
    function makeBtn(label, onDown, onUp) {
      const b = document.createElement('button');
      b.className = 'tap-btn';
      b.style.fontSize = '24px';
      b.textContent = label;
      const down = e => { e.preventDefault(); onDown(); if (phase === 'prompt') startCountdown(); };
      const up = e => { e.preventDefault(); onUp(); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      return b;
    }

    function startCountdown() {
      phase = 'countdown';
      countdownStart = performance.now();
    }

    function startRun() {
      phase = 'surfing';
      runStart = performance.now();
      ctx.setOverlay(null);
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) startRun();
        else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        return;
      }
      if (phase !== 'surfing') return;
      const elapsed = performance.now() - runStart;
      const remaining = Math.max(0, RUN_MS - elapsed);
      ctx.setStatus(`${curPlayer().name} · ${(remaining / 1000).toFixed(1)}s · ${(goodTime / 1000).toFixed(1)}s balanced`);
      if (elapsed >= RUN_MS) return finishTurn();

      // drift changes direction occasionally
      driftFlipTimer -= dt;
      if (driftFlipTimer <= 0) {
        drift = (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.35);
        driftFlipTimer = 600 + Math.random() * 1200;
      }
      // apply drift + lean
      let v = drift;
      if (leanL && !leanR) v -= 0.85;
      if (leanR && !leanL) v += 0.85;
      balance += v * (dt / 1000);
      if (Math.abs(balance) >= 1) {
        wipedOut = true;
        return finishTurn();
      }
      if (Math.abs(balance) <= 0.4) goodTime += dt;
    }

    function finishTurn() {
      phase = 'turn-done';
      const score = Math.round(goodTime / 100);
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: wipedOut ? `Wiped out · ${(goodTime / 1000).toFixed(1)}s` : `${(goodTime / 1000).toFixed(1)}s balanced`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br><strong>${score}</strong> pts</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // wave
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      const t = performance.now() / 400;
      c.moveTo(0, h * 0.5);
      for (let x = 0; x <= w; x += 16) {
        c.lineTo(x, h * 0.5 + Math.sin((x + t * 60) / 40) * 12);
      }
      c.lineTo(w, h); c.lineTo(0, h);
      c.closePath();
      c.fillStyle = 'rgba(14,165,233,0.7)';
      c.fill();

      // board with surfer — tilts with balance
      const sx = w / 2 + balance * (w * 0.3);
      const sy = h * 0.5 - 6;
      drawSurfer(c, sx, sy, balance, curPlayer().color, curPlayer().avatar.emoji);

      // balance meter at top
      const barX = 30, barY = 26, barW = w - 60, barH = 16;
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.fillRect(barX, barY, barW, barH);
      // safe zone
      const safeX = barX + (0.5 - 0.2) * barW;
      const safeW = 0.4 * barW;
      c.fillStyle = 'rgba(34,197,94,0.4)';
      c.fillRect(safeX, barY, safeW, barH);
      // marker
      const mx = barX + (balance / 2 + 0.5) * barW;
      c.fillStyle = wipedOut ? '#ef4444' : '#fbbf24';
      c.fillRect(mx - 3, barY - 4, 6, barH + 8);
      c.strokeStyle = '#fff'; c.lineWidth = 1;
      c.strokeRect(barX, barY, barW, barH);
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'center';
      c.fillText('BALANCE', w / 2, barY - 6);
    }

    function drawSurfer(c, x, y, balance, color, emoji) {
      c.save();
      const tilt = balance * 0.5;
      c.translate(x, y);
      c.rotate(tilt);
      // board
      c.fillStyle = '#fde68a';
      c.beginPath(); c.ellipse(0, 14, 36, 8, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#92400e'; c.lineWidth = 1; c.stroke();
      // surfer
      c.fillStyle = color;
      c.fillRect(-8, -16, 16, 22);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(0, -22, 8, 0, Math.PI * 2);
      c.fill();
      c.font = '14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#7c2d12';
      c.fillText(emoji, 0, -22);
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
        kdHandler = e => {
          if (e.repeat) return;
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { e.preventDefault(); leanL = true; if (phase === 'prompt') startCountdown(); }
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') { e.preventDefault(); leanR = true; if (phase === 'prompt') startCountdown(); }
        };
        kuHandler = e => {
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') leanL = false;
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') leanR = false;
        };
        document.addEventListener('keydown', kdHandler);
        document.addEventListener('keyup', kuHandler);
        promptStart();
        lastT = 0; rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (kdHandler) document.removeEventListener('keydown', kdHandler);
        if (kuHandler) document.removeEventListener('keyup', kuHandler);
      },
      onResize() {},
    };
  },
});
