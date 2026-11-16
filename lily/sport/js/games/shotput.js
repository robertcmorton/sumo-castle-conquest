// games/shotput.js — Shot Put (hold-and-release windup)
// Press and HOLD the button to wind up your spin; the charge meter fills.
// Release when the meter is near the gold zone for max distance.
// Over-charge (top of bar) = foul (0). Each player gets 3 puts; best counts.
Games.register({
  id: 'shotput',
  title: 'Shot Put',
  sport: 'Athletics',
  theme: 'stadium',
  icon: '🥏',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Press and HOLD to wind up your spin — the meter fills. RELEASE when it\'s in the gold zone for max distance. Over-charge and you spin out of the circle for a foul.',
  controls: 'Press and HOLD the big button or Space; release to throw.',
  create(ctx) {
    const THROWS = 3;
    const MAX_DIST = 22;
    const SWEET = { center: 0.88, width: 0.12 };
    const FOUL_AT = 1.05;
    const FILL_RATE = 0.7;  // per second
    const players = ctx.players;
    let turnIdx = 0, throwIdx = 0;
    let best = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let charge = 0;
    let holding = false;
    let projectile = null;
    let landedDist = 0;
    let rafId = null;
    let unsubInput = null;
    let kdHandler = null, kuHandler = null;
    let controllerBtn = null;

    function curPlayer() { return players[turnIdx]; }

    function newThrow() {
      charge = 0;
      holding = false;
      projectile = null;
      landedDist = 0;
      phase = 'charging-ready';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Put ${throwIdx + 1}/${THROWS} · Best: ${best[turnIdx].toFixed(1)}m`);
    }

    function startHold() {
      if (phase === 'await-start') { ctx.setOverlay(null); newThrow(); }
      if (phase === 'charging-ready') {
        phase = 'charging';
        holding = true;
        charge = 0;
      }
    }
    function releaseHold() {
      if (!holding) return;
      holding = false;
      if (phase !== 'charging') return;
      finishThrow(charge);
    }

    function finishThrow(c) {
      let dist = 0;
      if (c >= FOUL_AT) {
        dist = 0;
      } else if (c >= SWEET.center - SWEET.width / 2 && c <= SWEET.center + SWEET.width / 2) {
        dist = MAX_DIST * (0.85 + 0.15 * (1 - Math.abs(c - SWEET.center) / (SWEET.width / 2)));
      } else if (c < SWEET.center) {
        dist = MAX_DIST * c * 0.85;
      } else {
        // between sweet upper and foul
        const t = (c - (SWEET.center + SWEET.width / 2)) / (FOUL_AT - (SWEET.center + SWEET.width / 2));
        dist = MAX_DIST * (0.95 - t * 0.4);
      }
      dist = Math.max(0, Math.min(MAX_DIST, dist));
      landedDist = dist;
      // launch projectile for visual
      phase = 'flying';
      const angle = 38 * Math.PI / 180;
      projectile = {
        x: 0, y: 0,
        vx: Math.cos(angle) * (8 + dist * 0.6),
        vy: -Math.sin(angle) * (8 + dist * 0.6),
        rot: 0,
        t: 0,
        targetDist: dist,
      };
    }

    function resolve() {
      history[turnIdx][throwIdx] = landedDist;
      if (landedDist > best[turnIdx]) best[turnIdx] = landedDist;
      phase = 'resolved';
      const msg = landedDist === 0
        ? 'Foul! Spun out 🚫'
        : landedDist >= 20 ? `${landedDist.toFixed(1)}m — Monster!`
        : landedDist >= 14 ? `${landedDist.toFixed(1)}m — Solid`
        : `${landedDist.toFixed(1)}m`;
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1200);
    }

    function advance() {
      ctx.setOverlay(null);
      throwIdx++;
      if (throwIdx >= THROWS) {
        throwIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++;
        promptStart();
        return;
      }
      newThrow();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: Math.round(best[i] * 10),
        displayScore: `${best[i].toFixed(1)}m`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Press &amp; HOLD to wind up</small></div>`);
      buildController();
      updateStatus();
    }

    function buildController() {
      ctx.controllerHost.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.borderColor = curPlayer().color;
      btn.textContent = 'HOLD';
      const down = e => { e.preventDefault(); startHold(); };
      const up = e => { e.preventDefault(); releaseHold(); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      controllerBtn = btn;
      ctx.controllerHost.appendChild(btn);
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const groundY = h - 60;
      const startX = 70;
      const pxPerMetre = (w - 100) / MAX_DIST;
      return { w, h, groundY, startX, pxPerMetre };
    }

    function update(dt) {
      if (phase === 'charging' && holding) {
        charge += FILL_RATE * (dt / 1000);
        if (charge >= FOUL_AT) {
          // auto-release as foul
          holding = false;
          finishThrow(charge);
        }
      } else if (phase === 'flying' && projectile) {
        const step = dt / 16.67;
        projectile.x += projectile.vx * step;
        projectile.y += projectile.vy * step;
        projectile.vy += 0.42 * step;
        projectile.rot += 0.15 * step;
        const g = geom();
        const worldY = (g.groundY - 32) + projectile.y;
        if (worldY >= g.groundY) resolve();
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      c.fillStyle = '#9a3412';
      c.beginPath(); c.arc(g.startX, g.groundY, 24, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(0, g.groundY, g.w, g.h - g.groundY);
      c.fillStyle = '#fbbf24';
      c.fillRect(0, g.groundY, g.w, 4);
      c.font = 'bold 10px "Fredoka", sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.textAlign = 'center';
      for (let m = 5; m <= MAX_DIST; m += 5) {
        const x = g.startX + m * g.pxPerMetre;
        c.beginPath(); c.moveTo(x, g.groundY); c.lineTo(x, g.groundY + 10); c.stroke();
        c.fillText(`${m}m`, x, g.groundY + 22);
      }

      // athlete + spin animation when holding
      const spin = holding ? performance.now() / 90 : 0;
      drawAthlete(c, g.startX, g.groundY, curPlayer().color, spin);

      // projectile
      if (phase === 'flying' || phase === 'resolved') {
        const wx = g.startX + (projectile ? projectile.x : 0);
        const wy = phase === 'resolved' ? g.groundY - 4 : (g.groundY - 32) + (projectile ? projectile.y : 0);
        drawShot(c, wx, wy, projectile ? projectile.rot : 0);
      }

      // tall vertical charge meter on the left with gold sweet zone + red foul zone
      drawChargeBar(c, 22, 40, 22, g.h - 140, charge);

      drawHistory(c, 12, g.h - 32);
    }

    function drawChargeBar(c, x, y, w, h, value) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, w, h);
      // green base
      const fillT = Math.min(1, value);
      const fillH = h * fillT;
      const grad = c.createLinearGradient(0, y + h, 0, y);
      grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.7, '#facc15'); grad.addColorStop(1, '#fb923c');
      c.fillStyle = grad;
      c.fillRect(x, y + h - fillH, w, fillH);
      // sweet zone (gold band)
      const sweetY = y + h - (SWEET.center + SWEET.width / 2) * h;
      const sweetH = SWEET.width * h;
      c.fillStyle = 'rgba(251,191,36,0.45)';
      c.fillRect(x, sweetY, w, sweetH);
      c.strokeStyle = '#fbbf24'; c.lineWidth = 1.5;
      c.strokeRect(x, sweetY, w, sweetH);
      // foul zone (red top)
      const foulY = y + h - FOUL_AT * h;
      const foulHeight = (FOUL_AT - 1) * h + 8;
      // foul is above the bar top
      c.fillStyle = 'rgba(239,68,68,0.45)';
      c.fillRect(x, y - 16, w, 16);
      c.fillStyle = '#ef4444';
      c.font = 'bold 9px "Fredoka", sans-serif';
      c.textAlign = 'center';
      c.fillText('FOUL', x + w / 2, y - 4);
      // border
      c.strokeStyle = holding ? '#22c55e' : '#fff'; c.lineWidth = 2;
      c.strokeRect(x, y, w, h);
      // label
      c.fillStyle = '#fff';
      c.font = 'bold 11px "Fredoka", sans-serif';
      c.textAlign = 'left';
      c.fillText('CHARGE', x - 4, y + h + 14);
      c.restore();
    }

    function drawAthlete(c, x, y, color, spin) {
      c.save();
      c.translate(x, y - 18);
      c.rotate(spin);
      c.fillStyle = color;
      c.fillRect(-9, -16, 18, 24);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(0, -22, 8, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y - 2, 18, 4, 0, 0, Math.PI * 2); c.fill();
    }

    function drawShot(c, x, y, rot) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath(); c.ellipse(0, 4, 8, 3, 0, 0, Math.PI * 2); c.fill();
      const grad = c.createRadialGradient(-3, -3, 1, 0, 0, 9);
      grad.addColorStop(0, '#e5e7eb'); grad.addColorStop(1, '#475569');
      c.fillStyle = grad;
      c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawHistory(c, x, y) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, 220, 24);
      c.fillStyle = '#fff';
      c.font = 'bold 12px "Baloo 2", sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const p = curPlayer();
      const h = history[turnIdx];
      const parts = [0, 1, 2].map(i => h[i] !== undefined ? (h[i] === 0 ? 'X' : `${h[i].toFixed(1)}m`) : '–').join('  ');
      c.fillText(`${p.avatar.emoji} ${p.name}: ${parts}`, x + 6, y + 12);
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
        // keyboard hold/release on space
        kdHandler = (e) => {
          if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startHold(); }
        };
        kuHandler = (e) => {
          if (e.code === 'Space') { e.preventDefault(); releaseHold(); }
        };
        document.addEventListener('keydown', kdHandler);
        document.addEventListener('keyup', kuHandler);
        promptStart();
        lastT = 0;
        rafId = requestAnimationFrame(loop);
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
