// games/hockey.js — Top-Corner Spinner Shot (turn-based, 5 shots per player)
// A pointer rotates around the goal mouth. Tap to lock the angle — the puck flies to one of
// four corners. The goalie covers one corner at random. Hit an open corner = GOAL.
Games.register({
  id: 'hockey',
  title: 'Top-Corner Hockey',
  sport: 'Ice Hockey',
  theme: 'ice',
  icon: '🏒',
  minPlayers: 1,
  maxPlayers: 6,
  simultaneous: false,
  instructions: 'Five shots each. A pointer spins around the goal — tap to release. The puck flies to whichever of the four corners the pointer points at. Goalie covers one corner; the other three are open.',
  controls: 'Tap the screen / big button / press Space.',
  create(ctx) {
    const SHOTS = 5;
    const players = ctx.players;
    let turnIdx = 0;
    let shotIdx = 0;
    let goals = players.map(() => 0);
    let history = players.map(() => []);

    let phase = 'await-start'; // | 'spinning' | 'shooting' | 'resolved' | 'done'
    let angle = 0;            // 0..2π
    let spinSpeed = 0;        // rad/sec
    let lockedAngle = 0;
    let chosenCorner = 0;     // 0=TL 1=TR 2=BL 3=BR
    let goalieCorner = 0;
    let puck = { x: 0, y: 0, t: 0, T: 0.5, fromX: 0, fromY: 0, toX: 0, toY: 0 };
    let rafId = null;
    let unsubInput = null;

    function curPlayer() { return players[turnIdx]; }

    function newShot() {
      angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      spinSpeed = 4.5 + Math.random() * 1.5; // rad/sec
      lockedAngle = 0;
      chosenCorner = 0;
      goalieCorner = Math.floor(Math.random() * 4);
      phase = 'spinning';
      updateStatus();
    }
    function updateStatus() {
      const p = curPlayer();
      ctx.setStatus(`${p.name} — Shot ${shotIdx + 1}/${SHOTS} · Goals: ${goals[turnIdx]}`);
    }

    function tap() {
      if (phase === 'await-start') { ctx.setOverlay(null); newShot(); return; }
      if (phase === 'spinning') return lockShot();
      if (phase === 'resolved') return advance();
    }

    function lockShot() {
      lockedAngle = angle;
      // figure out which quadrant the pointer is in.
      // Pointer is on a circle around the goal centre. Map angle -> corner.
      // We bias: angle in upper-left = TL, etc.
      const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      // 0 right, π/2 down, π left, 3π/2 up
      // Top-left:    π .. 3π/2
      // Top-right:   3π/2 .. 2π
      // Bottom-right: 0 .. π/2
      // Bottom-left:  π/2 .. π
      if (a < Math.PI / 2) chosenCorner = 3;          // BR
      else if (a < Math.PI) chosenCorner = 2;         // BL
      else if (a < 3 * Math.PI / 2) chosenCorner = 0; // TL
      else chosenCorner = 1;                          // TR
      phase = 'shooting';
      const g = geom();
      const corner = cornerCenter(g, chosenCorner);
      puck.fromX = g.shooterX;
      puck.fromY = g.shooterY;
      puck.toX = corner.x;
      puck.toY = corner.y;
      puck.t = 0;
    }

    function cornerCenter(g, idx) {
      const inset = 18;
      switch (idx) {
        case 0: return { x: g.goalX + inset, y: g.goalY + inset };
        case 1: return { x: g.goalX + g.goalW - inset, y: g.goalY + inset };
        case 2: return { x: g.goalX + inset, y: g.goalY + g.goalH - inset };
        case 3: return { x: g.goalX + g.goalW - inset, y: g.goalY + g.goalH - inset };
      }
    }

    function resolve(scored, msg) {
      phase = 'resolved';
      history[turnIdx][shotIdx] = scored;
      if (scored) goals[turnIdx] += 1;
      ctx.setOverlay(`<div>${msg}</div>`, { small: true });
      setTimeout(advance, 1100);
    }

    function advance() {
      ctx.setOverlay(null);
      shotIdx++;
      if (shotIdx >= SHOTS) {
        shotIdx = 0;
        if (turnIdx >= players.length - 1) return finishGame();
        turnIdx++; promptStart(); return;
      }
      newShot();
    }

    function finishGame() {
      phase = 'done';
      ctx.finish(players.map((p, i) => ({
        playerIdx: p.slot,
        score: goals[i],
        displayScore: `${goals[i]}/${SHOTS} goals`,
      })));
    }

    function promptStart() {
      phase = 'await-start';
      const p = curPlayer();
      ctx.setOverlay(`<div>${p.avatar.emoji} ${escape(p.name)}<br><small>Tap to wind up</small></div>`);
      Meters.bigTapButton(ctx.controllerHost, p, 'TAP', tap);
      updateStatus();
    }

    function geom() {
      const w = ctx.width, h = ctx.height;
      const goalW = Math.min(w * 0.55, 280);
      const goalH = 110;
      const goalX = (w - goalW) / 2;
      const goalY = 60;
      const cx = goalX + goalW / 2;
      const cy = goalY + goalH / 2;
      const orbitR = Math.max(goalW, goalH) * 0.75;
      const shooterX = w / 2;
      const shooterY = h - 60;
      return { w, h, goalW, goalH, goalX, goalY, cx, cy, orbitR, shooterX, shooterY };
    }

    function update(dt) {
      if (phase === 'spinning') {
        angle += spinSpeed * (dt / 1000);
      } else if (phase === 'shooting') {
        puck.t += dt / 1000;
        if (puck.t >= puck.T) {
          // resolve: did goalie cover chosenCorner?
          if (chosenCorner === goalieCorner) resolve(false, 'SAVE! 🧤');
          else resolve(true, 'TOP CORNER! 🏒');
        }
      }
    }

    function draw() {
      const c = ctx.canvasCtx;
      const g = geom();
      Themes.paintBackground(c, g.w, g.h, ctx.themeName);

      // ice
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(0, g.goalY + g.goalH, g.w, g.h - (g.goalY + g.goalH));

      // goal mouth (white background with red posts)
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.fillRect(g.goalX, g.goalY, g.goalW, g.goalH);
      c.strokeStyle = '#dc2626'; c.lineWidth = 4;
      c.strokeRect(g.goalX, g.goalY, g.goalW, g.goalH);
      // net
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const xx = g.goalX + i * (g.goalW / 10);
        c.beginPath(); c.moveTo(xx, g.goalY); c.lineTo(xx, g.goalY + g.goalH); c.stroke();
      }

      // corner dots (4 targets)
      for (let i = 0; i < 4; i++) {
        const cc = cornerCenter(g, i);
        c.fillStyle = (phase === 'resolved' || phase === 'shooting') && i === goalieCorner ? '#94a3b8' : 'rgba(34,197,94,0.7)';
        c.beginPath(); c.arc(cc.x, cc.y, 14, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      }

      // goalie revealed in shooting/resolved
      if (phase === 'shooting' || phase === 'resolved') {
        const gc = cornerCenter(g, goalieCorner);
        drawGoalie(c, gc.x, gc.y);
      }

      // spinning pointer around the goal centre
      if (phase === 'spinning' || phase === 'shooting') {
        const useAngle = phase === 'spinning' ? angle : lockedAngle;
        const px = g.cx + Math.cos(useAngle) * g.orbitR;
        const py = g.cy + Math.sin(useAngle) * g.orbitR;
        c.save();
        c.strokeStyle = phase === 'spinning' ? '#fbbf24' : '#22c55e';
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(g.cx, g.cy); c.lineTo(px, py); c.stroke();
        c.fillStyle = c.strokeStyle;
        c.beginPath(); c.arc(px, py, 7, 0, Math.PI * 2); c.fill();
        c.restore();
      }

      // shooter
      drawShooter(c, g.shooterX, g.shooterY, curPlayer().color);

      // puck
      if (phase === 'shooting') {
        const u = Math.min(1, puck.t / puck.T);
        const x = puck.fromX + (puck.toX - puck.fromX) * u;
        const y = puck.fromY + (puck.toY - puck.fromY) * u - 60 * Math.sin(u * Math.PI);
        drawPuck(c, x, y, curPlayer().color);
      } else {
        drawPuck(c, g.shooterX, g.shooterY - 4, curPlayer().color);
      }

      drawScoreboard(c, 12, 12);
    }

    function drawShooter(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(x, y + 6, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = color;
      c.fillRect(x - 8, y - 30, 16, 24);
      c.beginPath();
      c.fillStyle = '#fde68a';
      c.arc(x, y - 36, 7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#92400e'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + 4, y - 18); c.lineTo(x + 26, y - 2); c.stroke();
      c.restore();
    }

    function drawGoalie(c, x, y) {
      c.save();
      c.fillStyle = '#1e3a8a';
      c.fillRect(x - 10, y - 12, 20, 22);
      c.beginPath();
      c.fillStyle = '#cbd5e1';
      c.arc(x, y - 18, 8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#dbeafe';
      c.fillRect(x - 16, y - 4, 6, 14);
      c.fillRect(x + 10, y - 4, 6, 14);
      c.restore();
    }

    function drawPuck(c, x, y, color) {
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.ellipse(x, y + 3, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0f172a';
      c.beginPath(); c.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
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
      c.fillText(`${p.avatar.emoji} ${p.name}`, x + 8, y + 13);
      const dotsX = x + 110;
      for (let i = 0; i < SHOTS; i++) {
        const v = history[turnIdx][i];
        let col = 'rgba(255,255,255,0.25)';
        if (v === true) col = '#22c55e';
        else if (v === false) col = '#ef4444';
        c.fillStyle = col;
        c.beginPath(); c.arc(dotsX + i * 14, y + 13, 4, 0, Math.PI * 2); c.fill();
      }
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
        lastT = 0;
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
