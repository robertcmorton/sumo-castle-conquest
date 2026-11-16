// games/curling.js — Curling (aim + sweep mash)
// Tap to lock direction (oscillating aim). Then MASH the button while the stone slides
// to keep it from slowing down. Final distance from the house centre determines points.
Games.register({
  id: 'curling',
  title: 'Curling',
  sport: 'Curling',
  theme: 'ice',
  icon: '🥌',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Tap to lock your aim. Then MASH the button while the stone slides — every sweep cancels a little friction. Closer to the bullseye = more points. Three stones each.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const STONES = 3;
    const players = ctx.players;
    let turnIdx = 0;
    let stoneIdx = 0;
    let totals = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start';
    let aim = 0, aimDir = 1;
    let lockedAim = 0;
    let stone = null;        // {x,y,vx,vy,active}
    let sweepBoost = 0;     // each mash adds boost while sliding
    let landed = null;       // {x,y,pts}
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newStone() {
      aim = 0; aimDir = 1; lockedAim = 0;
      stone = null; sweepBoost = 0; landed = null;
      phase = 'aiming';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Stone ${stoneIdx + 1}/${STONES} · ${totals[turnIdx]} pts`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newStone(); return; }
      if (phase === 'aiming') return commitAim();
      if (phase === 'sliding') { sweepBoost += 0.06; return; }
      if (phase === 'resolved') return advance();
    }

    function commitAim() {
      lockedAim = aim;
      const g = geom();
      // Aim oscillates -1..1 → angle around straight forward
      const baseAng = -Math.PI / 2;     // straight up
      const ang = baseAng + lockedAim * (15 * Math.PI / 180);
      const v0 = 7.5;
      stone = {
        x: g.startX, y: g.startY,
        vx: Math.cos(ang) * v0,
        vy: Math.sin(ang) * v0,
        active: true,
      };
      phase = 'sliding';
    }

    function update(dt) {
      if (phase === 'aiming') {
        const o = Meters.oscillate(aim, aimDir, 1.0, dt, -1, 1);
        aim = o.value; aimDir = o.dir;
      } else if (phase === 'sliding' && stone) {
        const step = dt / 16.67;
        // friction; sweep reduces friction temporarily
        const fric = Math.max(0.984, 0.992 - sweepBoost * 0.005);
        sweepBoost = Math.max(0, sweepBoost - 0.02 * step);
        stone.x += stone.vx * step;
        stone.y += stone.vy * step;
        stone.vx *= Math.pow(fric, step);
        stone.vy *= Math.pow(fric, step);
        const speed = Math.hypot(stone.vx, stone.vy);
        if (speed < 0.18) {
          stoneStopped();
        }
      }
    }

    function stoneStopped() {
      const g = geom();
      const dx = stone.x - g.houseX, dy = stone.y - g.houseY;
      const dist = Math.hypot(dx, dy);
      let pts;
      if (dist < g.houseR * 0.18) pts = 8;
      else if (dist < g.houseR * 0.45) pts = 4;
      else if (dist < g.houseR * 0.75) pts = 2;
      else if (dist <= g.houseR)      pts = 1;
      else                            pts = 0;
      landed = { x: stone.x, y: stone.y, pts };
      totals[turnIdx] += pts;
      history[turnIdx][stoneIdx] = pts;
      phase = 'resolved';
      ctx.setOverlay(`<div>+${pts} pts</div>`, { small: true });
      setTimeout(advance, 1200);
    }

    function advance() {
      ctx.setOverlay(null);
      stoneIdx++;
      if (stoneIdx >= STONES) {
        stoneIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++; promptStart(); return;
      }
      newStone();
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
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to start the throw</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const startX = w / 2;
      const startY = h - 50;
      const houseX = w / 2;
      const houseY = 90;
      const houseR = Math.min(w, h) * 0.18;
      return { w, h, startX, startY, houseX, houseY, houseR };
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // ice
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(g.w * 0.18, 60, g.w * 0.64, g.h - 80);
      // house concentric rings
      [
        { r: g.houseR,        fill: '#bfdbfe' },
        { r: g.houseR * 0.75, fill: '#fff' },
        { r: g.houseR * 0.45, fill: '#fecaca' },
        { r: g.houseR * 0.18, fill: '#fff' },
      ].forEach(ring => {
        c.fillStyle = ring.fill;
        c.beginPath(); c.arc(g.houseX, g.houseY, ring.r, 0, Math.PI * 2); c.fill();
      });
      c.strokeStyle = '#0c4a6e'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(g.houseX, g.houseY, g.houseR, 0, Math.PI * 2); c.stroke();

      // aim arrow from start
      if (phase === 'aiming' || phase === 'sliding') {
        const baseAng = -Math.PI / 2;
        const ang = baseAng + (phase === 'aiming' ? aim : lockedAim) * (15 * Math.PI / 180);
        const len = 60;
        c.strokeStyle = phase === 'aiming' ? '#fbbf24' : '#22c55e';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(g.startX, g.startY);
        c.lineTo(g.startX + Math.cos(ang) * len, g.startY + Math.sin(ang) * len);
        c.stroke();
      }

      // stone
      if (stone) drawStone(c, stone.x, stone.y, curPlayer().color);
      else drawStone(c, g.startX, g.startY - 10, curPlayer().color);

      // sweep boost indicator
      if (phase === 'sliding') {
        c.save();
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.fillRect(g.w - 130, 12, 118, 22);
        c.fillStyle = '#fbbf24';
        c.fillRect(g.w - 128, 14, Math.min(1, sweepBoost) * 114, 18);
        c.fillStyle = '#fff';
        c.font = 'bold 11px "Fredoka", sans-serif';
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText('SWEEP! mash button', g.w - 124, 24);
        c.restore();
      }

      drawScoreboard(c, 12, 12);
    }

    function drawStone(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#475569';
      c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y - 2, 5, 0, Math.PI * 2); c.fill();
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
      const h = history[turnIdx];
      c.fillText(`${p.avatar.emoji} ${p.name}: ${[0,1,2].map(i => h[i] === undefined ? '–' : h[i]).join(' ')}`, x + 8, y + 13);
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
