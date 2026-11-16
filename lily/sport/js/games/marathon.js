// games/marathon.js — Marathon (stamina management)
// Stamina constantly drains. Tap rhythmically to keep it topped up — but tap TOO fast
// (overexert) and stamina drains faster. Find the sweet rhythm. Last as long as you can.
Games.register({
  id: 'marathon',
  title: 'Marathon',
  sport: 'Athletics',
  theme: 'forest',
  icon: '🥵',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Stamina drains constantly. Each tap refills a tiny bit — but tapping faster than the green tempo overexerts and DRAINS instead. Find the rhythm and last as long as possible.',
  controls: 'Tap the screen / big button / press Space — to the beat.',
  create(ctx) {
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let stamina = 1;          // 0..1
    let lastTap = 0;
    let elapsed = 0;
    let runStart = 0;
    let countdownStart = 0;
    let rafId = null;
    let unsubInput = null;
    const TARGET_TAP_MS = 500;   // sweet tempo

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      stamina = 1; lastTap = 0; elapsed = 0;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to begin</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'STRIDE', tap);
      ctx.setStatus(`${p.name} at the start`);
    }

    function tap() {
      if (phase === 'prompt') { phase = 'countdown'; countdownStart = performance.now(); return; }
      if (phase !== 'running') return;
      const now = performance.now();
      if (lastTap === 0) {
        // first tap — neutral
        stamina += 0.04;
      } else {
        const gap = now - lastTap;
        const off = Math.abs(gap - TARGET_TAP_MS);
        if (off < 90) stamina += 0.08;          // great rhythm
        else if (off < 180) stamina += 0.04;    // ok
        else if (gap < 180) stamina -= 0.06;    // too fast (overexert)
        else stamina -= 0.02;                   // too slow (lost pace)
      }
      stamina = Math.max(0, Math.min(1, stamina));
      lastTap = now;
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) {
          phase = 'running'; runStart = performance.now(); ctx.setOverlay(null);
        } else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        return;
      }
      if (phase !== 'running') return;
      elapsed = performance.now() - runStart;
      // passive drain
      stamina -= (0.10 * dt) / 1000;
      if (stamina <= 0) {
        stamina = 0;
        return finishTurn();
      }
      ctx.setStatus(`${curPlayer().name} · ${(elapsed / 1000).toFixed(1)}s · ${(stamina * 100).toFixed(0)}%`);
    }

    function finishTurn() {
      phase = 'turn-done';
      const seconds = elapsed / 1000;
      const score = Math.round(seconds * 10);
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: `${seconds.toFixed(1)}s`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br><strong>${seconds.toFixed(1)}s</strong></div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // road
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(0, h - 50, w, 50);
      c.fillStyle = '#fbbf24';
      const t = performance.now() / 40;
      for (let i = 0; i < 10; i++) {
        const x = ((i * 80 + t) % (w + 80)) - 40;
        c.fillRect(x, h - 28, 30, 4);
      }

      // runner
      const cx = w / 2;
      const cy = h - 80;
      drawRunner(c, cx, cy, curPlayer().color, curPlayer().avatar.emoji, phase === 'running');

      // stamina bar
      const barW = w - 60, barX = 30, barY = 30, barH = 22;
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(barX, barY, barW, barH);
      const grad = c.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#ef4444'); grad.addColorStop(0.5, '#facc15'); grad.addColorStop(1, '#22c55e');
      c.fillStyle = grad;
      c.fillRect(barX, barY, barW * stamina, barH);
      c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.strokeRect(barX, barY, barW, barH);
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'center';
      c.fillText('STAMINA', w / 2, barY - 4);

      // metronome pulse
      const beat = (performance.now() % TARGET_TAP_MS) / TARGET_TAP_MS;
      c.save();
      c.fillStyle = `rgba(34,197,94,${0.4 + 0.6 * (1 - beat)})`;
      c.beginPath(); c.arc(w / 2, h - 110, 6 + (1 - beat) * 10, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawRunner(c, x, y, color, emoji, running) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 18, 14, 4, 0, 0, Math.PI * 2); c.fill();
      const bob = running ? Math.sin(performance.now() / 120) * 4 : 0;
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y + bob, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y + bob);
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
