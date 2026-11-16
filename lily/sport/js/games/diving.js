// games/diving.js — Platform Diving (timed mid-air QTEs)
// During a 3-second fall, 4 quick-time prompts appear at specific moments.
// Each timed within its 350ms window = trick scored. Entry split = small bonus
// based on how many tricks landed cleanly.
Games.register({
  id: 'diving',
  title: 'Platform Dive',
  sport: 'Diving',
  theme: 'pool',
  icon: '🤿',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'You\'ll fall in 3 seconds. Four trick prompts appear mid-air — tap the matching button within its window. Each landed trick = 10 pts. Two dives per player.',
  controls: 'Touch: 4 arrow buttons (← ↑ → ↓). Keyboard: arrow keys.',
  create(ctx) {
    const DIVES = 2;
    const FALL_MS = 3000;
    const WINDOW_MS = 380;
    const PROMPT_COUNT = 4;
    const players = ctx.players;
    let turnIdx = 0;
    let diveIdx = 0;
    let totals = players.map(() => 0);
    const results = [];

    let phase = 'await-start'; // 'falling' | 'resolved' | 'done'
    let fallStart = 0;
    let prompts = [];      // [{atMs, dir, hit, missed}]
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null;

    function curPlayer() { return players[turnIdx]; }

    function newDive() {
      // 4 prompts spaced through fall, random directions
      prompts = [];
      for (let i = 0; i < PROMPT_COUNT; i++) {
        prompts.push({
          atMs: (i + 1) * (FALL_MS / (PROMPT_COUNT + 1)),
          dir: Math.floor(Math.random() * 4),  // 0:←  1:↑  2:→  3:↓
          hit: false,
          missed: false,
        });
      }
      phase = 'falling';
      fallStart = performance.now();
      ctx.setOverlay(null);
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Dive ${diveIdx + 1}/${DIVES} · Total: ${totals[turnIdx]}`);
    }

    function press(dir) {
      if (phase === 'await-start') { ctx.setOverlay(null); newDive(); return; }
      if (phase !== 'falling') return;
      const now = performance.now() - fallStart;
      // find an active unresolved prompt within its window
      for (const pr of prompts) {
        if (pr.hit || pr.missed) continue;
        if (Math.abs(now - pr.atMs) <= WINDOW_MS / 2 && pr.dir === dir) {
          pr.hit = true;
          totals[turnIdx] += 10;
          return;
        }
      }
    }

    function update(dt) {
      if (phase !== 'falling') return;
      const now = performance.now() - fallStart;
      // mark missed any prompt whose window has passed
      prompts.forEach(pr => {
        if (!pr.hit && !pr.missed && now > pr.atMs + WINDOW_MS / 2) pr.missed = true;
      });
      if (now >= FALL_MS) {
        // entry splash bonus
        const cleanCount = prompts.filter(p => p.hit).length;
        const bonus = cleanCount === PROMPT_COUNT ? 15 : cleanCount * 2;
        totals[turnIdx] += bonus;
        ctx.setOverlay(`<div>+${cleanCount * 10}${bonus > 0 ? ' + ' + bonus + ' splash' : ''}</div>`, { small: true });
        phase = 'resolved';
        setTimeout(advance, 1300);
      }
    }

    function advance() {
      ctx.setOverlay(null);
      diveIdx++;
      if (diveIdx >= DIVES) {
        diveIdx = 0;
        results.push({
          playerIdx: curPlayer().slot,
          score: totals[turnIdx],
          displayScore: `${totals[turnIdx]} pts`,
        });
        if (turnIdx >= players.length - 1) { phase = 'done'; ctx.finish(results); return; }
        turnIdx++; promptStart(); return;
      }
      newDive();
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap an arrow to dive</small></div>`);
      buildController();
      updateStatus();
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'tap-row';
      ['←', '↑', '→', '↓'].forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'tap-btn';
        b.style.setProperty('--player-color', curPlayer().color);
        b.style.fontSize = '22px';
        b.textContent = label;
        b.addEventListener('pointerdown', e => { e.preventDefault(); press(i); });
        row.appendChild(b);
      });
      ctx.controllerHost.appendChild(row);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // platform top
      c.fillStyle = '#1e293b';
      c.fillRect(w * 0.3, 30, w * 0.4, 20);
      // water at bottom
      c.fillStyle = 'rgba(14, 165, 233, 0.6)';
      c.fillRect(0, h - 60, w, 60);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      for (let x = 0; x < w; x += 12) {
        c.moveTo(x, h - 60); c.quadraticCurveTo(x + 6, h - 56, x + 12, h - 60);
      }
      c.stroke();

      // diver — falling
      const diverY = phase === 'falling'
        ? 50 + ((performance.now() - fallStart) / FALL_MS) * (h - 130)
        : 50;
      const rot = phase === 'falling' ? ((performance.now() - fallStart) / 500) : 0;
      drawDiver(c, w / 2, diverY, curPlayer().color, curPlayer().avatar.emoji, rot);

      // active prompt
      if (phase === 'falling') {
        const now = performance.now() - fallStart;
        for (const pr of prompts) {
          if (pr.hit || pr.missed) continue;
          if (Math.abs(now - pr.atMs) <= WINDOW_MS / 2) {
            const labels = ['←', '↑', '→', '↓'];
            const remaining = (pr.atMs + WINDOW_MS / 2 - now) / WINDOW_MS;
            c.save();
            c.fillStyle = 'rgba(0,0,0,0.55)';
            c.fillRect(w / 2 - 50, diverY + 40, 100, 60);
            c.fillStyle = '#fbbf24';
            c.fillRect(w / 2 - 50, diverY + 95, 100 * remaining, 5);
            c.fillStyle = '#fff';
            c.font = 'bold 44px sans-serif';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(labels[pr.dir], w / 2, diverY + 70);
            c.restore();
            break;
          }
        }
      }

      // prompt timeline at the top
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(20, 12, w - 40, 12);
      prompts.forEach(pr => {
        const px = 20 + (pr.atMs / FALL_MS) * (w - 40);
        let col = 'rgba(255,255,255,0.5)';
        if (pr.hit) col = '#22c55e';
        else if (pr.missed) col = '#ef4444';
        c.fillStyle = col;
        c.beginPath(); c.arc(px, 18, 5, 0, Math.PI * 2); c.fill();
      });
      // playhead
      if (phase === 'falling') {
        const now = performance.now() - fallStart;
        const px = 20 + (now / FALL_MS) * (w - 40);
        c.fillStyle = '#fff';
        c.fillRect(px - 1, 8, 2, 20);
      }
      c.restore();

      // HUD
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, h - 32, 200, 22);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Dive ${diveIdx + 1}/${DIVES} · ${totals[turnIdx]} pts`, 22, h - 21);
      c.restore();
    }

    function drawDiver(c, x, y, color, emoji, rot) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.fillStyle = color;
      c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, 0, 0);
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
          const map = { 'ArrowLeft': 0, 'ArrowUp': 1, 'ArrowRight': 2, 'ArrowDown': 3 };
          if (map[e.key] !== undefined) { e.preventDefault(); press(map[e.key]); }
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
