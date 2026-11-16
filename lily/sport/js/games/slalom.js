// games/slalom.js — Slalom Ski (turn-based time trial, 1-6 players)
// Each player skis solo for 25 seconds. Match the gate colour as it passes — red = stay left, blue = stay right.
// Score = gates cleared.
Games.register({
  id: 'slalom',
  title: 'Slalom Ski',
  sport: 'Winter',
  theme: 'snow',
  icon: '⛷️',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Match your skier\'s side to the gate colour as it reaches you. RED = stay LEFT, BLUE = stay RIGHT. 25 seconds per player.',
  controls: 'Touch: tap the left or right side of the slope, or the ◀ / ▶ buttons. Keyboard: A/S.',
  create(ctx) {
    const RACE_MS = 25000;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';  // 'prompt' | 'countdown' | 'racing' | 'done-turn' | 'done'
    let skier = null;
    let gates = [];
    let spawnAccum = 0;
    let GATE_SPAWN_MS = 700;
    let countdownStart = 0;
    let raceStart = 0;
    let elapsed = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start your run, then tap left or right</small></div>`);
      Input.buildController(ctx.controllerHost, [p], 'dual', { left: '◀', right: '▶' });
      ctx.setStatus(`${p.name} at the gate`);
    }

    function startCountdown() {
      phase = 'countdown';
      countdownStart = performance.now();
      ctx.setOverlay('<div>READY</div>');
    }

    function startRun() {
      phase = 'racing';
      raceStart = performance.now();
      ctx.setOverlay(null);
      const p = curPlayer();
      skier = { side: 0, cleared: 0, missed: 0, color: p.color, avatar: p.avatar, name: p.name };
      gates = [];
      spawnAccum = GATE_SPAWN_MS - 200;
    }

    function tap(role) {
      if (phase === 'prompt') return startCountdown();
      if (phase !== 'racing' || !skier) return;
      if (role === 'left') skier.side = -1;
      else if (role === 'right') skier.side = 1;
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) startRun();
        else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        return;
      }
      if (phase !== 'racing' || !skier) return;
      elapsed = performance.now() - raceStart;
      const remaining = Math.max(0, RACE_MS - elapsed);
      ctx.setStatus(`${skier.name} · ${(remaining / 1000).toFixed(1)}s · ${skier.cleared} cleared`);
      if (elapsed >= RACE_MS) return finishTurn();

      const w = ctx.width, h = ctx.height;
      const skierY = h - 80;
      const top = 40;
      const scrollSpeed = 0.35; // px/ms
      spawnAccum += dt;
      if (spawnAccum >= GATE_SPAWN_MS) {
        spawnAccum -= GATE_SPAWN_MS;
        const side = Math.random() < 0.5 ? -1 : 1;
        gates.push({ y: top - 20, side, passed: false });
      }
      for (let i = gates.length - 1; i >= 0; i--) {
        const g = gates[i];
        g.y += scrollSpeed * dt;
        if (!g.passed && g.y > skierY) {
          g.passed = true;
          if (skier.side === g.side) skier.cleared += 1;
          else skier.missed += 1;
        }
        if (g.y > h + 30) gates.splice(i, 1);
      }
    }

    function finishTurn() {
      phase = 'done-turn';
      const r = skier;
      results.push({
        playerIdx: curPlayer().slot,
        score: r.cleared,
        displayScore: `${r.cleared} gates`,
      });
      ctx.setOverlay(`<div>${r.avatar.emoji} ${escape(r.name)}: <strong>${r.cleared}</strong> gates</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) {
          phase = 'done';
          ctx.finish(results);
        } else {
          turnIdx++;
          promptStart();
        }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      const top = 40;
      const bottom = h - 16;
      const laneW = Math.min(w * 0.6, 320);
      const laneX = (w - laneW) / 2;
      // lane bg
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(laneX, top, laneW, bottom - top);
      // center
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.setLineDash([6, 8]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(laneX + laneW / 2, top); c.lineTo(laneX + laneW / 2, bottom); c.stroke();
      c.setLineDash([]);
      // edges
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(laneX, top); c.lineTo(laneX, bottom);
      c.moveTo(laneX + laneW, top); c.lineTo(laneX + laneW, bottom);
      c.stroke();

      // gates
      gates.forEach(g => {
        const sideX = g.side === -1 ? laneX + laneW * 0.25 : laneX + laneW * 0.75;
        drawGate(c, sideX, g.y, g.side === -1 ? '#ef4444' : '#3b82f6');
      });

      // skier
      if (skier) {
        const sideX = skier.side <= 0 ? laneX + laneW * 0.32 : laneX + laneW * 0.68;
        drawSkier(c, sideX, h - 80, skier.color, skier.avatar.emoji);
        // HUD
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(laneX, top + 4, laneW, 22);
        c.fillStyle = '#fff';
        c.font = 'bold 12px "Baloo 2", sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(`${skier.name} · ${skier.cleared} cleared`, laneX + laneW / 2, top + 15);
      }
    }

    function drawGate(c, x, y, color) {
      c.save();
      c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x, y + 4); c.stroke();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x, y - 22); c.lineTo(x + 14, y - 16); c.lineTo(x, y - 10); c.closePath(); c.fill();
      c.beginPath(); c.arc(x, y + 4, 3, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawSkier(c, x, y, color, emoji) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 8, 12, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y - 4, 12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke();
      c.font = '16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y - 4);
      c.restore();
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt); draw();
      rafId = requestAnimationFrame(loop);
    }
    // Tap the slope itself: tap to start, then tap the left or right side (or right on a gate) to ski that way
    function onCanvasTap(e) {
      e.preventDefault();
      if (phase === 'prompt') return startCountdown();
      const r = ctx.canvas.getBoundingClientRect();
      tap(e.clientX - r.left < r.width / 2 ? 'left' : 'right');
    }
    function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    return {
      start() {
        unsubInput = Input.subscribe(e => {
          if (e.type !== 'press') return;
          if (e.role === 'left' || e.role === 'right') tap(e.role);
          else if (e.role === 'primary' && phase === 'prompt') startCountdown();
        });
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
  },
});
