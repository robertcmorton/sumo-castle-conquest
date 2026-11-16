// games/cycling.js — Cycling (continuous steering dodge)
// Hold left/right to steer your cyclist around oncoming obstacles on a scrolling track.
// 30-second run; score = obstacles dodged - obstacles hit × 3.
Games.register({
  id: 'cycling',
  title: 'Velodrome Sprint',
  sport: 'Cycling',
  theme: 'velodrome',
  icon: '🚴',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'HOLD left or right to steer your cyclist around the cones on the track. Each cone dodged is a point; collisions cost points. 30-second run, take turns.',
  controls: 'Hold ◀ / ▶ buttons. Keyboard: A/S (or arrow keys).',
  create(ctx) {
    const RUN_MS = 30000;
    const players = ctx.players;
    const results = [];
    let turnIdx = 0;

    let phase = 'prompt';
    let cyclistX = 0.5;
    let holdLeft = false, holdRight = false;
    let cones = [];
    let scrollY = 0;
    let spawnAccum = 0;
    let dodged = 0, hits = 0;
    let runStart = 0;
    let countdownStart = 0;
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null, kuHandler = null;

    function curPlayer() { return players[turnIdx]; }

    function promptStart() {
      phase = 'prompt';
      cyclistX = 0.5;
      cones = []; spawnAccum = 0; dodged = 0; hits = 0;
      holdLeft = holdRight = false;
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap a button to start</small></div>`);
      buildController();
      ctx.setStatus(`${p.name} at the line`);
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'tap-row';
      const left = makeHoldBtn('◀', () => holdLeft = true, () => holdLeft = false);
      const right = makeHoldBtn('▶', () => holdRight = true, () => holdRight = false);
      left.style.setProperty('--player-color', curPlayer().color);
      right.style.setProperty('--player-color', curPlayer().color);
      row.appendChild(left); row.appendChild(right);
      ctx.controllerHost.appendChild(row);
    }

    function makeHoldBtn(label, onDown, onUp) {
      const b = document.createElement('button');
      b.className = 'tap-btn';
      b.style.fontSize = '24px';
      b.textContent = label;
      const down = e => {
        e.preventDefault();
        onDown();
        if (phase === 'prompt') startCountdown();
      };
      const up = e => { e.preventDefault(); onUp(); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      return b;
    }

    function startCountdown() {
      phase = 'countdown';
      countdownStart = performance.now();
    }

    function startRun() {
      phase = 'riding';
      runStart = performance.now();
      ctx.setOverlay(null);
    }

    function update(dt) {
      if (phase === 'countdown') {
        const since = (performance.now() - countdownStart) / 1000;
        if (since >= 3) startRun();
        else ctx.setOverlay(`<div>${since < 1 ? 'READY' : since < 2 ? 'SET' : 'GO!'}</div>`);
        return;
      }
      if (phase !== 'riding') return;
      const elapsed = performance.now() - runStart;
      const remaining = Math.max(0, RUN_MS - elapsed);
      ctx.setStatus(`${curPlayer().name} · ${(remaining / 1000).toFixed(1)}s · ${dodged} dodged`);
      if (elapsed >= RUN_MS) return finishTurn();

      // steering
      const steerSpeed = 0.0014;
      if (holdLeft && !holdRight) cyclistX = Math.max(0.06, cyclistX - steerSpeed * dt);
      if (holdRight && !holdLeft) cyclistX = Math.min(0.94, cyclistX + steerSpeed * dt);

      // scroll
      const scrollSpeed = 0.36;
      scrollY += scrollSpeed * dt;
      spawnAccum += dt;
      if (spawnAccum > 600) {
        spawnAccum = 0;
        cones.push({ x: 0.1 + Math.random() * 0.8, y: -40, hit: false, scored: false });
      }
      const cyclistY = ctx.height - 80;
      cones.forEach(co => {
        co.y += scrollSpeed * dt;
        if (!co.scored && Math.abs(co.y - cyclistY) < 14) {
          if (Math.abs(co.x - cyclistX) < 0.07) {
            co.hit = true; hits++;
          } else {
            dodged++;
          }
          co.scored = true;
        }
      });
      cones = cones.filter(co => co.y < ctx.height + 30);
    }

    function finishTurn() {
      phase = 'turn-done';
      const score = Math.max(0, dodged - hits * 3);
      results.push({
        playerIdx: curPlayer().slot,
        score,
        displayScore: `${dodged} dodged · ${hits} hits`,
      });
      ctx.setOverlay(`<div>${curPlayer().name}<br><strong>${score}</strong> pts</div>`, { small: true });
      setTimeout(() => {
        if (turnIdx >= players.length - 1) ctx.finish(results);
        else { turnIdx++; promptStart(); }
      }, 1500);
    }

    function draw() {
      const c = ctx.canvasCtx;
      const w = ctx.width, h = ctx.height;
      Themes.paintBackground(c, w, h, ctx.themeName);

      // track with lane edges
      const trackLeft = w * 0.12, trackRight = w * 0.88;
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(trackLeft, 0, trackRight - trackLeft, h);
      // dashed centre
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.setLineDash([10, 14]);
      c.lineWidth = 2;
      c.beginPath();
      const dashOffset = scrollY % 24;
      c.moveTo(w / 2, -dashOffset);
      c.lineTo(w / 2, h);
      c.stroke();
      c.setLineDash([]);
      // edges
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      c.moveTo(trackLeft, 0); c.lineTo(trackLeft, h);
      c.moveTo(trackRight, 0); c.lineTo(trackRight, h);
      c.stroke();

      // cones
      cones.forEach(co => {
        const x = trackLeft + co.x * (trackRight - trackLeft);
        drawCone(c, x, co.y, co.hit);
      });

      // cyclist
      const cyclistY = h - 80;
      const cx = trackLeft + cyclistX * (trackRight - trackLeft);
      drawCyclist(c, cx, cyclistY, curPlayer().color, curPlayer().avatar.emoji);

      // HUD
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, 12, 200, 26);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`Dodged ${dodged} · Hits ${hits}`, 22, 25);
      c.restore();
    }

    function drawCone(c, x, y, hit) {
      c.save();
      c.fillStyle = hit ? 'rgba(239,68,68,0.6)' : '#f97316';
      c.beginPath();
      c.moveTo(x, y - 14); c.lineTo(x - 8, y + 4); c.lineTo(x + 8, y + 4); c.closePath();
      c.fill();
      c.fillStyle = '#fff';
      c.fillRect(x - 6, y - 6, 12, 3);
      c.restore();
    }

    function drawCyclist(c, x, y, color, emoji) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(x, y + 16, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.font = '16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(emoji, x, y);
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
        // keyboard hold A/S or arrows
        kdHandler = (e) => {
          if (e.repeat) return;
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { e.preventDefault(); holdLeft = true; if (phase === 'prompt') startCountdown(); }
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') { e.preventDefault(); holdRight = true; if (phase === 'prompt') startCountdown(); }
        };
        kuHandler = (e) => {
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') holdLeft = false;
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') holdRight = false;
        };
        document.addEventListener('keydown', kdHandler);
        document.addEventListener('keyup', kuHandler);
        promptStart();
        lastT = 0; rafId = requestAnimationFrame(loop);
      },
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        if (kdHandler) document.removeEventListener('keydown', kdHandler);
        if (kuHandler) document.removeEventListener('keyup', kuHandler);
      },
      onResize() {},
    };
  },
});
