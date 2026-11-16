// games/skateboard.js — Skateboard Trick (Simon-says sequence)
// A sequence of 4 directional symbols is shown. Player must reproduce in order.
// 3 tricks, increasing length. Score = correct inputs.
Games.register({
  id: 'skateboard',
  title: 'Skate Trick',
  sport: 'Skateboarding',
  theme: 'halfpipe',
  icon: '🛹',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three tricks. Watch the sequence of arrows light up, then enter them in the same order. Each correct tap is a point. Mistake ends the trick.',
  controls: 'Touch: 4 arrow buttons (← ↑ → ↓). Keyboard: arrow keys.',
  create(ctx) {
    const TRICKS = 3;
    const players = ctx.players;
    let turnIdx = 0;
    const results = [];

    let phase = 'prompt';   // 'prompt' | 'show' | 'play' | 'turn-done' | 'done'
    let trickIdx = 0;
    let totalScore = 0;
    let sequence = [];
    let showIdx = -1;
    let inputIdx = 0;
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      trickIdx = 0; totalScore = 0;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start your tricks</small></div>`);
      buildController();
      ctx.setStatus(`${p.name} on deck`);
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'tap-row';
      const arrows = ['←', '↑', '→', '↓'];
      arrows.forEach((label, i) => {
        const b = document.createElement('button');
        b.className = 'tap-btn';
        b.style.setProperty('--player-color', curPlayer().color);
        b.style.fontSize = '24px';
        b.textContent = label;
        b.addEventListener('pointerdown', e => { e.preventDefault(); pressDir(i); });
        row.appendChild(b);
      });
      ctx.controllerHost.appendChild(row);
    }

    function nextTrick() {
      // sequence length grows: 4, 5, 6
      const len = 4 + trickIdx;
      sequence = [];
      for (let i = 0; i < len; i++) sequence.push(Math.floor(Math.random() * 4));
      showSequence();
    }

    function showSequence() {
      phase = 'show';
      showIdx = 0;
      ctx.setStatus(`Watch! Trick ${trickIdx + 1}/${TRICKS}`);
      const tick = () => {
        if (showIdx >= sequence.length) {
          phase = 'play';
          inputIdx = 0;
          ctx.setStatus(`Your turn — repeat the sequence`);
          return;
        }
        showIdx++;
        setTimeout(tick, 550);
      };
      setTimeout(tick, 700);
    }

    function pressDir(dir) {
      if (phase === 'prompt') {
        ctx.setOverlay(null);
        nextTrick();
        return;
      }
      if (phase !== 'play') return;
      if (sequence[inputIdx] === dir) {
        totalScore += 1;
        inputIdx++;
        if (inputIdx >= sequence.length) {
          // trick complete bonus
          totalScore += 3;
          trickIdx++;
          if (trickIdx >= TRICKS) finishTurn();
          else nextTrick();
        }
      } else {
        // wrong → end this trick
        ctx.setOverlay(`<div>Bailed!</div>`, { small: true });
        setTimeout(() => {
          ctx.setOverlay(null);
          trickIdx++;
          if (trickIdx >= TRICKS) finishTurn();
          else nextTrick();
        }, 900);
        phase = 'between';
      }
    }

    function finishTurn() {
      phase = 'turn-done';
      results.push({
        playerIdx: curPlayer().slot,
        score: totalScore,
        displayScore: `${totalScore} pts`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}: <strong>${totalScore}</strong> pts</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // halfpipe sketch
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.moveTo(0, h - 30); c.quadraticCurveTo(w / 2, h - 110, w, h - 30);
      c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();

      // skater
      const skX = w / 2;
      const skY = h - 80;
      c.fillStyle = curPlayer().color;
      c.beginPath(); c.arc(skX, skY, 16, 0, Math.PI * 2); c.fill();
      c.font = '20px sans-serif'; c.fillStyle = '#fff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(curPlayer().avatar.emoji, skX, skY);

      // sequence display
      const labels = ['←', '↑', '→', '↓'];
      const cellW = 56, cellH = 56, gap = 8;
      const total = sequence.length * (cellW + gap) - gap;
      const startX = (w - total) / 2;
      const topY = 40;
      for (let i = 0; i < sequence.length; i++) {
        const x = startX + i * (cellW + gap);
        let bg = 'rgba(255,255,255,0.15)';
        let col = '#fff';
        if (phase === 'show') {
          if (i === showIdx - 1) { bg = '#fbbf24'; col = '#1a1306'; }
        } else if (phase === 'play') {
          if (i < inputIdx) { bg = '#22c55e'; col = '#fff'; }
        }
        c.fillStyle = bg;
        c.fillRect(x, topY, cellW, cellH);
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.strokeRect(x, topY, cellW, cellH);
        // show arrow only during show phase (revealed for the active one)
        // and entire sequence visible during play (challenge mode? let's keep visible to help)
        if (phase === 'show' && i <= showIdx - 1) {
          c.fillStyle = col;
          c.font = 'bold 32px sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(labels[sequence[i]], x + cellW / 2, topY + cellH / 2);
        } else if (phase === 'play' && i < inputIdx) {
          c.fillStyle = col;
          c.font = 'bold 32px sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(labels[sequence[i]], x + cellW / 2, topY + cellH / 2);
        }
      }

      // status text
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, h - 30, 220, 22);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Trick ${Math.min(TRICKS, trickIdx + 1)}/${TRICKS} · ${totalScore} pts`, 22, h - 19);
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
        unsubInput = null;
        kdHandler = (e) => {
          const map = { 'ArrowLeft': 0, 'ArrowUp': 1, 'ArrowRight': 2, 'ArrowDown': 3 };
          if (map[e.key] !== undefined) {
            e.preventDefault();
            pressDir(map[e.key]);
          } else if (e.code === 'Space' && phase === 'prompt') {
            e.preventDefault();
            pressDir(0); // any key starts on prompt
          }
        };
        document.addEventListener('keydown', kdHandler);
        promptStart();
        rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (kdHandler) document.removeEventListener('keydown', kdHandler);
      },
      onResize() {},
    };
  },
});
