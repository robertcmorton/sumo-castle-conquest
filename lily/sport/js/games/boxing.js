// games/boxing.js — Reaction Boxing (turn-based, 1-6 players)
// Each player faces 5 reaction trials. Wait for the "GO!" then tap as fast as you can.
// Score = better of (best_ms, average_ms). False starts add a 500ms penalty.
Games.register({
  id: 'boxing',
  title: 'Reaction Boxing',
  sport: 'Boxing',
  theme: 'dojo',
  icon: '🥊',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Five rounds, each a reaction test. Wait for the bell — when you see GO!, tap as fast as you can. Jumping early adds a 500ms penalty. Fastest average wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const TRIALS = 5;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';   // 'prompt' | 'wait' | 'go' | 'between' | 'turn-done' | 'done'
    let trialIdx = 0;
    let trialTimes = [];     // ms per trial for current player
    let goAt = 0;
    let goTimer = null;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      trialIdx = 0;
      trialTimes = [];
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to step into the ring</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', press);
      ctx.setStatus(`${p.name} · Trial 1/${TRIALS}`);
    }

    function startTrial() {
      phase = 'wait';
      ctx.setOverlay('<div>Wait for it…</div>', { small: true });
      clearTimeout(goTimer);
      const delay = 900 + Math.random() * 2400;
      goTimer = setTimeout(() => {
        if (phase !== 'wait') return;
        phase = 'go';
        goAt = performance.now();
        ctx.setOverlay('<div>GO!</div>');
      }, delay);
    }

    function press() {
      if (phase === 'prompt') { ctx.setOverlay(null); startTrial(); return; }
      if (phase === 'wait') {
        // false start
        clearTimeout(goTimer);
        const penalty = 800;
        trialTimes.push(penalty);
        ctx.setOverlay(`<div>False start! +${penalty}ms</div>`, { small: true });
        return advance();
      }
      if (phase === 'go') {
        const ms = performance.now() - goAt;
        trialTimes.push(ms);
        ctx.setOverlay(`<div>${ms.toFixed(0)}ms</div>`, { small: true });
        return advance();
      }
      if (phase === 'between') {
        // tap to continue to next trial early
        // (no-op — auto-advance handles it)
      }
    }

    function advance() {
      phase = 'between';
      setTimeout(() => {
        trialIdx++;
        if (trialIdx >= TRIALS) {
          return finishTurn();
        }
        ctx.setStatus(`${curPlayer().name} · Trial ${trialIdx + 1}/${TRIALS}`);
        startTrial();
      }, 1200);
    }

    function finishTurn() {
      phase = 'turn-done';
      const avg = trialTimes.reduce((a, b) => a + b, 0) / trialTimes.length;
      const best = Math.min(...trialTimes);
      // Score: lower avg = higher score. Use 2000 - avg, floor at 0.
      const score = Math.max(0, Math.round(2000 - avg));
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: `avg ${avg.toFixed(0)}ms · best ${best.toFixed(0)}ms`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br>avg <strong>${avg.toFixed(0)}ms</strong></div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) {
          phase = 'done';
          ctx.finish(results);
        } else {
          turnIdx++;
          promptStart();
        }
      }, 1600);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // ring ropes
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.moveTo(0, 30 + i * 12); c.lineTo(w, 30 + i * 12); c.stroke();
      }
      // ring floor
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(0, h - 80, w, 80);

      // boxer (current player)
      const cx = w / 2;
      const boxerY = h - 100;
      const p = curPlayer();
      drawBoxer(c, cx, boxerY, p.color, p.avatar.emoji, phase === 'go');

      // bell/state
      let label = '', col = '#fff', bgcol = 'rgba(0,0,0,0.5)';
      if (phase === 'prompt') label = 'READY?';
      else if (phase === 'wait') { label = '…'; col = '#fbbf24'; }
      else if (phase === 'go') { label = 'GO!'; col = '#22c55e'; bgcol = 'rgba(0,80,40,0.7)'; }
      else if (phase === 'between' || phase === 'turn-done') {
        if (trialTimes.length) label = `${trialTimes[trialTimes.length - 1].toFixed(0)}ms`;
      }
      if (label) {
        c.save();
        c.fillStyle = bgcol;
        c.fillRect(cx - 100, h / 2 - 40, 200, 60);
        c.fillStyle = col;
        c.font = 'bold 30px "Baloo 2", sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(label, cx, h / 2 - 10);
        c.restore();
      }

      // trial dots
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 200, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`${p.avatar.emoji} ${p.name}`, 22, 25);
      for (let i = 0; i < TRIALS; i++) {
        const dx = 140 + i * 14;
        c.fillStyle = i < trialTimes.length ? p.color : 'rgba(255,255,255,0.2)';
        c.beginPath(); c.arc(dx, 25, 4, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }

    function drawBoxer(c, x, y, color, emoji, punchOut) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 12, 26, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 18, y - 40, 36, 40);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 52, 16, 0, Math.PI * 2);
      c.fill();
      c.font = '18px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#7c2d12';
      c.fillText(emoji, x, y - 52);
      // gloves — punch outward when GO
      c.fillStyle = '#ef4444';
      const off = punchOut ? 30 : 18;
      c.beginPath(); c.arc(x - off, y - 26, 10, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + off, y - 26, 10, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    let lastT = 0;
    function loop(t) {
      lastT = t;
      draw();
      rafId = requestAnimationFrame(loop);
    }
    function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    return {
      start() {
        unsubInput = Input.subscribe(e => {
          if (e.type === 'press') press();
        });
        ctx.canvas.style.pointerEvents = 'auto';
        ctx.canvas.addEventListener('pointerdown', onCanvasTap);
        promptStart();
        rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (unsubInput) unsubInput();
        ctx.canvas.removeEventListener('pointerdown', onCanvasTap);
        clearTimeout(goTimer);
      },
      onResize() {},
    };
    function onCanvasTap(e) { e.preventDefault(); press(); }
  },
});
