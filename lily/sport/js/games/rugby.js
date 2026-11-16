// games/rugby.js — Rugby Try Dash (reactive directional taps)
// Tacklers come from random sides. Each one shows an arrow above it — tap the OPPOSITE
// direction in time to dodge. Score = tacklers dodged in 20 seconds.
Games.register({
  id: 'rugby',
  title: 'Try Dash',
  sport: 'Rugby',
  theme: 'pitch',
  icon: '🏉',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'A tackler appears from the left or right with an arrow above them. Tap the OPPOSITE direction to dodge. You have a half-second to react. 20-second turn.',
  controls: 'Touch: ◀ / ▶ buttons. Keyboard: A/S.',
  create(ctx) {
    const RUN_MS = 20000;
    const REACT_MS = 700;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let dodged = 0, tackled = 0;
    let runStart = 0;
    let countdownStart = 0;
    let tackler = null;     // {side: 'left'|'right', spawnedAt, resolved}
    let spawnNextAt = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      dodged = 0; tackled = 0; tackler = null;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap a direction to start</small></div>`);
      buildController();
      ctx.setStatus(`${p.name} ready`);
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'tap-row';
      const left = makeBtn('◀ DODGE LEFT', () => press('left'));
      const right = makeBtn('▶ DODGE RIGHT', () => press('right'));
      left.style.setProperty('--player-color', curPlayer().color);
      right.style.setProperty('--player-color', curPlayer().color);
      row.appendChild(left); row.appendChild(right);
      ctx.controllerHost.appendChild(row);
    }
    function makeBtn(label, onTap) {
      const b = document.createElement('button');
      b.className = 'tap-btn';
      b.textContent = label;
      b.addEventListener('pointerdown', e => { e.preventDefault(); onTap(); });
      return b;
    }

    function press(dir) {
      if (phase === 'prompt') { phase = 'countdown'; countdownStart = performance.now(); return; }
      if (phase !== 'running' || !tackler || tackler.resolved) return;
      const correct = (tackler.side === 'left' ? 'right' : 'left');
      if (dir === correct) {
        tackler.resolved = 'dodged';
        dodged++;
      } else {
        tackler.resolved = 'tackled';
        tackled++;
      }
      setTimeout(() => { if (tackler && tackler.resolved) tackler = null; }, 350);
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) {
          phase = 'running';
          runStart = performance.now();
          spawnNextAt = performance.now() + 700;
          ctx.setOverlay(null);
        } else {
          ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        }
        return;
      }
      if (phase !== 'running') return;
      const elapsed = performance.now() - runStart;
      const remaining = Math.max(0, RUN_MS - elapsed);
      ctx.setStatus(`${curPlayer().name} · ${(remaining / 1000).toFixed(1)}s · ${dodged} dodged`);
      if (elapsed >= RUN_MS) return finishTurn();

      // spawn tacklers
      if (!tackler && performance.now() >= spawnNextAt) {
        tackler = {
          side: Math.random() < 0.5 ? 'left' : 'right',
          spawnedAt: performance.now(),
          resolved: null,
        };
      }
      // auto-tackle if not pressed in REACT_MS
      if (tackler && !tackler.resolved && performance.now() - tackler.spawnedAt > REACT_MS) {
        tackler.resolved = 'tackled';
        tackled++;
        setTimeout(() => { if (tackler && tackler.resolved) tackler = null; }, 350);
      }
      // schedule next
      if (!tackler && performance.now() > spawnNextAt + 400) {
        spawnNextAt = performance.now() + 400 + Math.random() * 400;
      }
    }

    function finishTurn() {
      phase = 'turn-done';
      const score = Math.max(0, dodged * 100 - tackled * 30);
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: `${dodged} dodged · ${tackled} tackled`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br><strong>${score}</strong> pts</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1400);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // pitch
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(0, h * 0.5, w, h * 0.5);

      // runner (current player) centre
      const runnerX = w / 2, runnerY = h - 100;
      // draw shifted by recent dodge
      let offset = 0;
      if (tackler && tackler.resolved === 'dodged') offset = tackler.side === 'left' ? 28 : -28;
      drawRunner(c, runnerX + offset, runnerY, curPlayer().color, curPlayer().avatar.emoji);

      // tackler approaching
      if (tackler && !tackler.resolved) {
        const elapsed = performance.now() - tackler.spawnedAt;
        const progress = Math.min(1, elapsed / REACT_MS);
        const fromX = tackler.side === 'left' ? 30 : w - 30;
        const toX = runnerX;
        const tx = fromX + (toX - fromX) * progress;
        const ty = runnerY - 20 + progress * 20;
        // arrow above showing where they're coming from
        c.save();
        c.fillStyle = '#ef4444';
        c.font = 'bold 32px sans-serif';
        c.textAlign = 'center';
        c.fillText(tackler.side === 'left' ? '→' : '←', tx, ty - 30);
        c.restore();
        drawTackler(c, tx, ty);
      } else if (tackler && tackler.resolved === 'tackled') {
        c.save();
        c.font = 'bold 24px "Baloo 2", sans-serif';
        c.fillStyle = '#ef4444'; c.textAlign = 'center';
        c.fillText('TACKLED!', runnerX, runnerY - 40);
        c.restore();
      } else if (tackler && tackler.resolved === 'dodged') {
        c.save();
        c.font = 'bold 22px "Baloo 2", sans-serif';
        c.fillStyle = '#22c55e'; c.textAlign = 'center';
        c.fillText('SIDESTEP!', runnerX + offset, runnerY - 40);
        c.restore();
      }

      // HUD
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 220, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Dodged ${dodged} · Tackled ${tackled}`, 22, 25);
      c.restore();
    }

    function drawRunner(c, x, y, color, emoji) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 16, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y);
      // ball
      c.fillStyle = '#92400e';
      c.beginPath(); c.ellipse(x + 10, y + 4, 8, 4, -0.3, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawTackler(c, x, y) {
      c.save();
      c.fillStyle = '#1e293b';
      c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#fff';
      c.font = '16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🛡️', x, y);
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
        unsubInput = Input.subscribe(e => {
          if (e.type !== 'press') return;
          if (e.role === 'left') press('left');
          else if (e.role === 'right') press('right');
        });
        promptStart();
        lastT = 0; rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (unsubInput) unsubInput();
      },
      onResize() {},
    };
  },
});
