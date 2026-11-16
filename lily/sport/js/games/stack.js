// games/stack.js — Stack Tower (classic-style minigame)
// Each player takes one turn building as tall a tower as possible.
// Tap to drop a moving block; only the overlap with the previous block survives.
// When overlap = 0, the run ends. Score = number of floors stacked.
Games.register({
  id: 'stack',
  title: 'Stack Tower',
  sport: 'Classic',
  theme: 'space',
  icon: '🟦',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Stop each moving block so it lands on the one below. Only the overlap stays — miss it and your run ends. Stack as high as you can.',
  controls: 'Tap the screen / tap button / press Space to drop.',
  create(ctx) {
    const BLOCK_H = 28;
    const BASE_W = 140;
    const COLORS = ['#fbbf24', '#fb7185', '#60a5fa', '#34d399', '#c084fc', '#f97316'];

    let players = ctx.players;
    let turnIdx = 0;
    let results = []; // [{playerIdx, score, displayScore}]

    let phase = 'await-start'; // 'await-start' | 'playing' | 'between-turns' | 'done'
    let tower = [];
    let moving = null;
    let score = 0;
    let camY = 0;          // camera offset (positive = scrolled up)
    let targetCamY = 0;
    let speed = 2.2;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function resetRun() {
      tower = [];
      score = 0;
      camY = 0;
      targetCamY = 0;
      speed = 2.2;
      // start the base block
      const w = BASE_W;
      const cx = ctx.width / 2;
      tower.push({ x: cx - w / 2, w, color: '#94a3b8', floor: 0 });
      spawnMoving();
    }

    function spawnMoving() {
      const top = tower[tower.length - 1];
      const dir = Math.random() < 0.5 ? 1 : -1;
      const w = top.w;
      moving = {
        x: dir === 1 ? -w : ctx.width,
        w,
        dir,
        vx: speed,
        color: COLORS[tower.length % COLORS.length],
      };
    }

    function nextTurn() {
      if (turnIdx >= players.length - 1) {
        phase = 'done';
        ctx.finish(results);
        return;
      }
      turnIdx++;
      promptStart();
    }

    function promptStart() {
      phase = 'await-start';
      ctx.setStatus(`${curPlayer().name}'s turn`);
      ctx.setOverlay(`<div>${curPlayer().avatar.emoji} ${escape(curPlayer().name)}<br><small>Tap to start</small></div>`);
      // controller: big TAP button styled with player color
      ctx.controllerHost.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderColor = curPlayer().color;
      btn.textContent = 'TAP TO DROP';
      btn.addEventListener('pointerdown', e => { e.preventDefault(); handleTap(); });
      ctx.controllerHost.appendChild(btn);
    }

    function handleTap() {
      if (phase === 'await-start') {
        resetRun();
        ctx.setOverlay(null);
        phase = 'playing';
        return;
      }
      if (phase !== 'playing') return;
      // drop the moving block
      const top = tower[tower.length - 1];
      const left = Math.max(moving.x, top.x);
      const right = Math.min(moving.x + moving.w, top.x + top.w);
      const overlap = right - left;
      if (overlap <= 0) {
        endRun();
        return;
      }
      tower.push({ x: left, w: overlap, color: moving.color, floor: tower.length });
      score += 1;
      // grow speed slightly each block (clamped)
      speed = Math.min(7.5, 2.2 + score * 0.18);
      // camera follow: keep top block ~40% from top
      const stackTopY = ctx.height - (tower.length) * BLOCK_H;
      targetCamY = Math.max(0, ctx.height * 0.4 - stackTopY);
      spawnMoving();
    }

    function endRun() {
      const cur = curPlayer();
      results.push({
        playerIdx: cur.slot,
        score,
        displayScore: `${score} floor${score === 1 ? '' : 's'}`,
      });
      phase = 'between-turns';
      ctx.setOverlay(`<div>${cur.avatar.emoji} ${escape(cur.name)}: <strong>${score}</strong> floors</div>`);
      setTimeout(() => {
        if (turnIdx >= players.length - 1) {
          // finished all turns
          ctx.finish(results);
        } else {
          nextTurn();
        }
      }, 1400);
    }

    function update(dt) {
      if (phase === 'playing' && moving) {
        moving.x += moving.dir * speed * (dt / 16.67);
        if (moving.dir === 1 && moving.x + moving.w >= ctx.width) {
          moving.x = ctx.width - moving.w;
          moving.dir = -1;
        } else if (moving.dir === -1 && moving.x <= 0) {
          moving.x = 0;
          moving.dir = 1;
        }
      }
      // smooth camera
      camY += (targetCamY - camY) * 0.12;
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width;
      const h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // ground
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(0, h - 6 + camY, w, 6);

      // draw tower from bottom up
      tower.forEach((b, i) => {
        const y = h - (i + 1) * BLOCK_H + camY;
        drawBlock(c, b.x, y, b.w, BLOCK_H, b.color);
      });

      // moving block sits one floor above the tower top
      if (moving && phase === 'playing') {
        const y = h - (tower.length + 1) * BLOCK_H + camY;
        drawBlock(c, moving.x, y, moving.w, BLOCK_H, moving.color, true);
      }

      // HUD: floor counter (top-left)
      if (phase === 'playing' || phase === 'between-turns') {
        c.save();
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.fillRect(10, 10, 110, 38);
        c.fillStyle = '#fff';
        c.font = 'bold 16px "Baloo 2", sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`Floor ${score}`, 20, 29);
        c.restore();
      }
      // current player chip top-right
      if (phase !== 'done') {
        const p = curPlayer();
        c.save();
        c.fillStyle = p.color;
        c.fillRect(w - 130, 10, 120, 38);
        c.fillStyle = '#0b1733';
        c.font = 'bold 13px "Baloo 2", sans-serif';
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(`${p.avatar.emoji} ${p.name}`, w - 16, 29);
        c.restore();
      }
    }

    function drawBlock(c, x, y, w, h, color, glow = false) {
      c.save();
      if (glow) {
        c.shadowColor = color;
        c.shadowBlur = 18;
      }
      c.fillStyle = color;
      roundRect(c, x, y, w, h, 4);
      c.fill();
      // top highlight
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.fillRect(x, y, w, 3);
      c.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }

    let lastT = 0;
    function loop(t) {
      const dt = lastT ? Math.min(50, t - lastT) : 16;
      lastT = t;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function escape(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    return {
      start() {
        unsubInput = Input.subscribe(e => {
          if (e.type === 'press') handleTap();
        });
        // tap on canvas also drops
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
      onResize(w, h) { targetCamY = camY; },
    };

    function onCanvasTap(e) { e.preventDefault(); handleTap(); }
  },
});
