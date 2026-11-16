// games/waterpolo.js — Water Polo (whack-a-mole goal corners)
// One of 4 goal corners lights up at a time, briefly. Tap your matching corner button
// while it's open to shoot a goal. Each player gets 12 seconds; score = goals.
Games.register({
  id: 'waterpolo',
  title: 'Water Polo',
  sport: 'Water Polo',
  theme: 'pool',
  icon: '🤽',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'A corner of the goal lights up — tap the matching corner button before it closes! 12 seconds to score as many as you can.',
  controls: 'Touch: four corner buttons. Keyboard: 1/2 (top L/R), 3/4 (bottom L/R) or arrow keys.',
  create(ctx) {
    const RUN_MS = 12000;
    const OPEN_MS = 700;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let goals = 0, misses = 0;
    let runStart = 0;
    let countdownStart = 0;
    let activeCorner = -1;  // 0:TL 1:TR 2:BL 3:BR
    let openSince = 0;
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      goals = 0; misses = 0; activeCorner = -1;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap any corner to start</small></div>`);
      buildController();
      ctx.setStatus(`${p.name} treading water`);
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gap = '8px';
      grid.style.marginTop = '8px';
      ['↖ TL', '↗ TR', '↙ BL', '↘ BR'].forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'tap-btn';
        b.style.setProperty('--player-color', curPlayer().color);
        b.style.fontSize = '20px';
        b.textContent = label;
        b.addEventListener('pointerdown', e => { e.preventDefault(); press(i); });
        grid.appendChild(b);
      });
      ctx.controllerHost.appendChild(grid);
    }

    function press(idx) {
      if (phase === 'prompt') { phase = 'countdown'; countdownStart = performance.now(); return; }
      if (phase !== 'running') return;
      if (activeCorner === idx) {
        goals++;
        activeCorner = -1;
      } else {
        misses++;
      }
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) {
          phase = 'running';
          runStart = performance.now();
          ctx.setOverlay(null);
          spawnNew();
        } else {
          ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        }
        return;
      }
      if (phase !== 'running') return;
      const elapsed = performance.now() - runStart;
      const remaining = Math.max(0, RUN_MS - elapsed);
      ctx.setStatus(`${curPlayer().name} · ${(remaining / 1000).toFixed(1)}s · ${goals} goals`);
      if (elapsed >= RUN_MS) return finishTurn();
      // close active corner if expired
      if (activeCorner !== -1 && performance.now() - openSince > OPEN_MS) {
        misses++;
        activeCorner = -1;
      }
      if (activeCorner === -1 && Math.random() < 0.06) spawnNew();
    }

    function spawnNew() {
      activeCorner = Math.floor(Math.random() * 4);
      openSince = performance.now();
    }

    function finishTurn() {
      phase = 'turn-done';
      const score = Math.max(0, goals * 100 - misses * 20);
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: `${goals} goals · ${misses} miss`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br><strong>${goals}</strong> goals</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1400);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // pool surface
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(0, 0, w, h);

      // goal
      const goalW = Math.min(w * 0.6, 320);
      const goalH = Math.min(h * 0.5, 220);
      const goalX = (w - goalW) / 2;
      const goalY = 40;
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.fillRect(goalX, goalY, goalW, goalH);
      c.strokeStyle = '#ef4444'; c.lineWidth = 4;
      c.strokeRect(goalX, goalY, goalW, goalH);
      // net
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const xx = goalX + i * (goalW / 8);
        c.beginPath(); c.moveTo(xx, goalY); c.lineTo(xx, goalY + goalH); c.stroke();
      }
      // 4 corners
      const cornerR = Math.min(goalW, goalH) * 0.18;
      const corners = [
        { x: goalX + cornerR + 12, y: goalY + cornerR + 12 },
        { x: goalX + goalW - cornerR - 12, y: goalY + cornerR + 12 },
        { x: goalX + cornerR + 12, y: goalY + goalH - cornerR - 12 },
        { x: goalX + goalW - cornerR - 12, y: goalY + goalH - cornerR - 12 },
      ];
      corners.forEach((cc, i) => {
        const open = i === activeCorner;
        c.fillStyle = open ? 'rgba(34,197,94,0.85)' : 'rgba(8,47,73,0.25)';
        c.beginPath(); c.arc(cc.x, cc.y, cornerR, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      });

      // swimmer
      const swX = w / 2, swY = h - 70;
      drawPolo(c, swX, swY, curPlayer().color, curPlayer().avatar.emoji);

      // HUD
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 200, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Goals ${goals} · Miss ${misses}`, 22, 25);
      c.restore();
    }

    function drawPolo(c, x, y, color, emoji) {
      c.save();
      // water ripples
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.beginPath(); c.arc(x, y + 20, 26, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(x, y + 20, 18, 0, Math.PI * 2); c.stroke();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y);
      // cap
      c.fillStyle = '#fbbf24';
      c.beginPath(); c.arc(x, y - 10, 8, Math.PI, Math.PI * 2); c.fill();
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
        kdHandler = (e) => {
          const map = {
            '1': 0, '2': 1, '3': 2, '4': 3,
            'q': 0, 'w': 1, 'a': 2, 's': 3,
            'ArrowUp': 0, 'ArrowRight': 1, 'ArrowLeft': 2, 'ArrowDown': 3,
          };
          const k = map[e.key];
          if (k !== undefined) { e.preventDefault(); press(k); }
        };
        document.addEventListener('keydown', kdHandler);
        promptStart();
        lastT = 0; rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (kdHandler) document.removeEventListener('keydown', kdHandler);
      },
      onResize() {},
    };
  },
});
