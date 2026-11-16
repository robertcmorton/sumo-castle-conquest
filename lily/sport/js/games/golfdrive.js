// games/golfdrive.js — Golf Drive (three-click swing)
// Click 1: start backswing (a marker rises up a power arc).
// Click 2: lock power (where the marker stopped).
// Click 3: lock accuracy (marker now sweeps back down through an accuracy zone).
// Distance ~ power × accuracy. 3 drives per player; best counts.
Games.register({
  id: 'golfdrive',
  title: 'Golf Drive',
  sport: 'Golf',
  theme: 'forest',
  icon: '🏌️',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Three-click swing. Tap to start the backswing. Tap again at the top of the arc for power. The marker sweeps back down — tap once more inside the green for accuracy. Distance = power × accuracy. Three drives, best one counts.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const DRIVES = 3;
    const MAX_DIST = 300;        // yards (visual scale)
    const players = ctx.players;
    let turnIdx = 0;
    let driveIdx = 0;
    let best = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';   // 'backswing' | 'downswing' | 'flying' | 'resolved'
    let arc = 0;                  // 0..1, used in both swings
    let arcDir = 1;
    let lockedPower = 0;
    let lockedAccuracy = 0;
    let ball = null;              // {x,y,vx,vy,t,T,targetDist}
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newDrive() {
      arc = 0; arcDir = 1; lockedPower = 0; lockedAccuracy = 0;
      ball = null;
      phase = 'backswing';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Drive ${driveIdx + 1}/${DRIVES} · Best: ${best[turnIdx].toFixed(0)}y`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newDrive(); return; }
      if (phase === 'backswing') {
        lockedPower = arc;
        // start downswing
        phase = 'downswing';
        arc = 1; arcDir = -1; // sweeps back down
        return;
      }
      if (phase === 'downswing') {
        // accuracy: how close to 0.5 (sweet centre at "contact point")
        const off = Math.abs(arc - 0.5);
        lockedAccuracy = 1 - Math.min(1, off * 2.2); // 1 perfect, 0 worst
        hit();
        return;
      }
      if (phase === 'resolved') return advance();
    }

    function hit() {
      phase = 'flying';
      const dist = MAX_DIST * lockedPower * (0.4 + 0.6 * lockedAccuracy);
      const g = geom();
      ball = {
        startX: g.teeX, startY: g.teeY,
        x: 0, y: 0,
        t: 0,
        T: 1.2,
        targetDist: dist,
      };
    }

    function advance() {
      ctx.setOverlay(null);
      driveIdx++;
      if (driveIdx >= DRIVES) {
        driveIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++; promptStart(); return;
      }
      newDrive();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: Math.round(best[i]),
        displayScore: `${best[i].toFixed(0)} yds`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to begin your swing</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'SWING', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const groundY = h - 60;
      const teeX = 60;
      const teeY = groundY - 6;
      const pxPerYd = (w - 90) / MAX_DIST;
      return { w, h, groundY, teeX, teeY, pxPerYd };
    }

    function update(dt) {
      if (phase === 'backswing') {
        // rises from 0 → 1 then back; one direction first (rises)
        arc += arcDir * (dt / 800); // ~0.8s up
        if (arc >= 1) { arc = 1; arcDir = -1; }
        else if (arc <= 0 && arcDir < 0) { arc = 0; arcDir = 1; }
      } else if (phase === 'downswing') {
        arc += arcDir * (dt / 500); // faster sweep down ~0.5s
        if (arc <= 0) {
          arc = 0;
          // missed window — auto resolve with 0 accuracy
          lockedAccuracy = 0;
          hit();
        }
      } else if (phase === 'flying' && ball) {
        ball.t += dt / 1000;
        if (ball.t >= ball.T) {
          const dist = ball.targetDist;
          history[turnIdx][driveIdx] = dist;
          if (dist > best[turnIdx]) best[turnIdx] = dist;
          phase = 'resolved';
          const msg = dist >= 260 ? `${dist.toFixed(0)} yds — Bomb!` : dist >= 180 ? `${dist.toFixed(0)} yds` : `${dist.toFixed(0)} yds — short`;
          ctx.setOverlay(`<div>${msg}</div>`, { small: true });
          setTimeout(advance, 1200);
        }
      }
    }

    function ballPos() {
      if (!ball) return null;
      const g = geom();
      const u = Math.min(1, ball.t / ball.T);
      const endX = g.teeX + ball.targetDist * g.pxPerYd;
      const peakY = -120 - ball.targetDist * 0.15;
      const y = (1 - u) * (1 - u) * ball.startY + 2 * (1 - u) * u * (ball.startY + peakY) + u * u * (g.groundY - 4);
      const x = g.teeX + (endX - g.teeX) * u;
      return { x, y };
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // fairway
      c.fillStyle = '#16a34a';
      c.fillRect(0, g.groundY, g.w, g.h - g.groundY);
      // yardage markers
      c.font = 'bold 10px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.textAlign = 'center';
      for (let y = 100; y < MAX_DIST; y += 100) {
        const x = g.teeX + y * g.pxPerYd;
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(x, g.groundY, 1, 6);
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.fillText(`${y}y`, x, g.groundY + 18);
      }

      // golfer
      drawGolfer(c, g.teeX, g.groundY, curPlayer().color);

      // ball
      if (phase === 'flying' && ball) {
        const p = ballPos();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.fill();
      } else if (phase !== 'flying') {
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(g.teeX + 10, g.teeY - 2, 5, 0, Math.PI * 2); c.fill();
      }

      // power arc visualization
      if (phase === 'backswing' || phase === 'downswing') {
        const barX = g.w - 60, barY = 50, barW = 22, barH = g.h - 140;
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(barX, barY, barW, barH);
        // power fill
        const filT = phase === 'backswing' ? arc : lockedPower;
        const filH = barH * filT;
        const grad = c.createLinearGradient(0, barY + barH, 0, barY);
        grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.7, '#facc15'); grad.addColorStop(1, '#ef4444');
        c.fillStyle = grad;
        c.fillRect(barX, barY + barH - filH, barW, filH);
        // accuracy sweet zone at the middle when in downswing
        if (phase === 'downswing') {
          const sy = barY + (1 - 0.5) * barH - barH * 0.07;
          const sh = barH * 0.14;
          c.fillStyle = 'rgba(34,197,94,0.45)';
          c.fillRect(barX, sy, barW, sh);
          // marker
          const my = barY + (1 - arc) * barH;
          c.fillStyle = '#fff';
          c.fillRect(barX - 4, my - 2, barW + 8, 4);
        }
        c.strokeStyle = '#fff'; c.lineWidth = 1.5;
        c.strokeRect(barX, barY, barW, barH);
        c.fillStyle = '#fff';
        c.font = 'bold 11px "Fredoka", sans-serif';
        c.textAlign = 'center';
        c.fillText(phase === 'backswing' ? 'POWER' : 'CONTACT', barX + barW / 2, barY - 5);
      }

      // history
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(12, g.h - 30, 240, 22);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      const h = history[turnIdx];
      const parts = [0,1,2].map(i => h[i] !== undefined ? `${h[i].toFixed(0)}y` : '–').join(' ');
      c.fillText(`${p.avatar.emoji} ${p.name}: ${parts}`, 22, g.h - 19);
      c.restore();
    }

    function drawGolfer(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y - 2, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 7, y - 28, 14, 24);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 32, 7, 0, Math.PI * 2);
      c.fill();
      // club
      c.strokeStyle = color; c.lineWidth = 3;
      const clubAngle = phase === 'backswing' ? -1.2 + arc * 1.6 : phase === 'downswing' ? 0.4 - arc * 1.6 : -0.3;
      c.beginPath();
      c.moveTo(x + 4, y - 18);
      c.lineTo(x + 4 + Math.cos(clubAngle) * 28, y - 18 + Math.sin(clubAngle) * 28);
      c.stroke();
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
