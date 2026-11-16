// games/sumo.js — Sumo Mash (turn-based, 1-6 players)
// Each player gets 15 seconds to tap as many times as possible. Highest tap count wins.
Games.register({
  id: 'sumo',
  title: 'Sumo Mash',
  sport: 'Wrestling',
  theme: 'dojo',
  icon: '🤼',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Pure mash. 15-second window. Every tap pushes your wrestler forward. Most taps wins.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const WINDOW_MS = 15000;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';   // 'prompt' | 'countdown' | 'mashing' | 'turn-done' | 'done'
    let taps = 0;
    let countdownStart = 0;
    let startMs = 0;
    let elapsed = 0;
    let lastTapMs = 0;
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      taps = 0;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to begin</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'MASH', tap);
      ctx.setStatus(`${p.name} ready`);
    }

    function startCountdown() {
      phase = 'countdown';
      countdownStart = performance.now();
      ctx.setOverlay('<div>READY</div>');
    }

    function startMash() {
      phase = 'mashing';
      startMs = performance.now();
      ctx.setOverlay(null);
    }

    function tap() {
      if (phase === 'prompt') return startCountdown();
      if (phase !== 'mashing') return;
      const now = performance.now();
      if (now - lastTapMs < 30) return; // anti-cheat: ~33 taps/sec cap
      lastTapMs = now;
      taps++;
    }

    function update() {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) startMash();
        else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'HAKKE!'}</div>`);
        return;
      }
      if (phase !== 'mashing') return;
      elapsed = performance.now() - startMs;
      const remaining = Math.max(0, WINDOW_MS - elapsed);
      ctx.setStatus(`${curPlayer().name} · ${(remaining / 1000).toFixed(1)}s · ${taps} taps`);
      if (elapsed >= WINDOW_MS) finishTurn();
    }

    function finishTurn() {
      phase = 'turn-done';
      const p = curPlayer();
      results.push({
        playerIdx: p.slot,
        score: taps,
        displayScore: `${taps} taps`,
      });
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><strong>${taps}</strong> taps</div>`, { small: true });
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

      // ring
      const cx = w / 2, cy = h / 2 + 10;
      const ringR = Math.min(w, h) * 0.35;
      c.fillStyle = '#d97706';
      c.beginPath(); c.arc(cx, cy, ringR + 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fde68a';
      c.beginPath(); c.arc(cx, cy, ringR, 0, Math.PI * 2); c.fill();

      // wrestler — visual size grows slightly with taps
      const p = curPlayer();
      const scale = 1 + Math.min(0.6, taps * 0.004);
      drawWrestler(c, cx, cy, p.color, p.avatar.emoji, scale);

      // big tap counter
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(cx - 110, 30, 220, 60);
      c.fillStyle = '#fff';
      c.font = 'bold 36px "Baloo 2", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`${taps}`, cx, 60);
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillText('TAPS', cx, 84);
      c.restore();

      // results so far
      if (results.length) {
        c.save();
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.fillRect(12, h - 30 - results.length * 16, 180, results.length * 16 + 14);
        c.fillStyle = '#fff';
        c.font = 'bold 11px "Fredoka", sans-serif';
        c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('Standings:', 20, h - 26 - results.length * 16);
        results.forEach((r, i) => {
          const pl = players.find(p => p.slot === r.playerIdx);
          c.fillStyle = pl ? pl.color : '#fff';
          c.fillRect(20, h - 8 - (results.length - i) * 16, 8, 8);
          c.fillStyle = '#fff';
          c.fillText(`${pl ? pl.name : '?'}  ${r.score} taps`, 34, h - 10 - (results.length - i) * 16);
        });
        c.restore();
      }
    }

    function drawWrestler(c, x, y, color, emoji, scale) {
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0, 32, 30, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, 6, 32, 24, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1f2937';
      c.fillRect(-18, 14, 36, 8);
      c.fillStyle = '#fde68a';
      c.beginPath(); c.arc(0, -16, 14, 0, Math.PI * 2); c.fill();
      c.font = '18px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#7c2d12';
      c.fillText(emoji, 0, -16);
      c.restore();
    }

    let lastT = 0;
    function loop(t) {
      lastT = t;
      update();
      draw();
      rafId = requestAnimationFrame(loop);
    }
    function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    return {
      start() {
        unsubInput = Input.subscribe(e => { if (e.type === 'press') tap(); });
        ctx.canvas.style.pointerEvents = 'auto';
        ctx.canvas.addEventListener('pointerdown', onCanvasTap);
        promptStart();
        rafId = requestAnimationFrame(loop);
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
