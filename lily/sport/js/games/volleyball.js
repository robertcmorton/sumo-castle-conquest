// games/volleyball.js — Volleyball Spike (vertical jump timing)
// A vertical bar rises (your jump). Tap at the apex to spike. Hitting the peak
// = SPIKE for points; mid-rise = weak hit; bottom = miss. 5 attempts each.
Games.register({
  id: 'volleyball',
  title: 'Volley Spike',
  sport: 'Volleyball',
  theme: 'court',
  icon: '🏐',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Five spikes. The jump bar rises and falls — tap when you\'re at the apex to slam the ball down. Peak = SPIKE, off-peak = soft tap, miss = whiff.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const ATTEMPTS = 5;
    const players = ctx.players;
    let turnIdx = 0;
    let attemptIdx = 0;
    let totals = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start'; // 'jumping' | 'hitting' | 'resolved'
    let jump = 0;          // 0..1
    let jumpDir = 1;
    let lockedJump = 0;
    let ballY = 0;
    let ballGoingDown = false;
    let outcome = null;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newAttempt() {
      jump = 0; jumpDir = 1; lockedJump = 0;
      ballY = 0; ballGoingDown = false; outcome = null;
      phase = 'jumping';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Spike ${attemptIdx + 1}/${ATTEMPTS} · ${totals[turnIdx]} pts`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newAttempt(); return; }
      if (phase === 'jumping') return spike();
      if (phase === 'resolved') return advance();
    }

    function spike() {
      lockedJump = jump;
      // Score: peak = >= 0.9 = SPIKE (10), 0.65-0.9 = strong (6), 0.4-0.65 = soft (3), <0.4 = miss (0)
      let pts, msg;
      if (jump >= 0.9) { pts = 10; msg = 'SPIKE! 💥'; }
      else if (jump >= 0.65) { pts = 6; msg = 'Strong hit!'; }
      else if (jump >= 0.4) { pts = 3; msg = 'Soft tap.'; }
      else { pts = 0; msg = 'Whiff!'; }
      totals[turnIdx] += pts;
      history[turnIdx][attemptIdx] = pts;
      outcome = { pts, msg };
      phase = 'resolved';
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1100);
    }

    function advance() {
      ctx.setOverlay(null);
      attemptIdx++;
      if (attemptIdx >= ATTEMPTS) {
        attemptIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++; promptStart(); return;
      }
      newAttempt();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: totals[i],
        displayScore: `${totals[i]} pts`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to set up the spike</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'SPIKE', tap);
      updateStatus();
    }

    function update(dt) {
      if (phase === 'jumping') {
        const o = Meters.oscillate(jump, jumpDir, 1.1, dt, 0, 1);
        jump = o.value; jumpDir = o.dir;
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // net
      const netY = h * 0.42;
      c.fillStyle = '#fff';
      c.fillRect(w * 0.18, netY, w * 0.64, 4);
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      for (let x = w * 0.18; x < w * 0.82; x += 8) {
        c.beginPath(); c.moveTo(x, netY); c.lineTo(x, netY + 70); c.stroke();
      }

      // floor
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(0, h - 40, w, 40);

      // ball — descending toward our side; for visual, just stay near top until spike
      const ballX = w * 0.3;
      const ballYY = h * 0.18 + (1 - jump) * 30;
      drawBall(c, ballX, ballYY);

      // player jumping
      const playerX = w * 0.3;
      const baseY = h - 80;
      const jumpHeight = jump * 100;
      const playerY = baseY - jumpHeight;
      drawPlayer(c, playerX, playerY, curPlayer().color, curPlayer().avatar.emoji);

      // jump bar on right side with sweet zone at top
      const barX = w - 56, barY = 40, barW = 22, barH = h - 100;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(barX, barY, barW, barH);
      // sweet zone
      const sweetH = barH * 0.1;
      c.fillStyle = 'rgba(34,197,94,0.45)';
      c.fillRect(barX, barY, barW, sweetH);
      // marker
      const my = barY + (1 - jump) * barH;
      c.fillStyle = '#fbbf24';
      c.fillRect(barX - 4, my - 3, barW + 8, 6);
      c.strokeStyle = '#fff'; c.lineWidth = 1;
      c.strokeRect(barX, barY, barW, barH);
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'center';
      c.fillText('JUMP', barX + barW / 2, barY - 6);

      drawScoreboard(c, 12, 12);
    }

    function drawPlayer(c, x, y, color, emoji) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 30, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 8, y - 12, 16, 28);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 20, 9, 0, Math.PI * 2);
      c.fill();
      c.font = '14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#7c2d12';
      c.fillText(emoji, x, y - 20);
      // arm reaching up
      c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + 6, y - 8); c.lineTo(x + 16, y - 32); c.stroke();
      c.restore();
    }

    function drawBall(c, x, y) {
      c.save();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0c4a6e'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x - 8, y - 6); c.bezierCurveTo(x - 3, y - 2, x + 3, y - 2, x + 8, y - 6); c.stroke();
      c.beginPath(); c.moveTo(x - 8, y + 6); c.bezierCurveTo(x - 3, y + 2, x + 3, y + 2, x + 8, y + 6); c.stroke();
      c.restore();
    }

    function drawScoreboard(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 220, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      const hist = history[turnIdx];
      c.fillText(`${p.avatar.emoji} ${p.name}: ${hist.map(v => v === undefined ? '–' : v).join(' ')}`, x + 8, y + 13);
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
