// Mini-game registry. Each entry has:
//   name, icon, description
//   start(container, { onEnd, avatarEmoji, variant }) -> { cleanup }
// onEnd is called with { score, diamonds, summary }.
//
// variant (optional):
//   { theme, bgClass, speedMul, spawnMul, tier }
// Games apply variant via applyVariant() — themed background + speed multiplier.

const MiniGames = {};

function applyVariant(area, opts) {
  const v = (opts && opts.variant) || {};
  if (area && v.bgClass) area.classList.add(v.bgClass);
  return {
    speedMul: v.speedMul || 1,
    spawnMul: v.spawnMul || 1,
    tier:     v.tier     || 0
  };
}


/* =====================================================
   STAR CATCHER (reaction)
   ===================================================== */
MiniGames.reaction = {
  name: 'Star Catcher',
  icon: '⭐',
  description: 'Click the stars before they vanish! 30 seconds of cosmic mayhem.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-reaction">
        <div class="mg-info">
          <span>Time: <strong id="rxn-time">30</strong>s</span>
          <span>Stars: <strong id="rxn-hits">0</strong></span>
        </div>
        <div class="mg-area" id="rxn-area"></div>
      </div>
    `;
    const area = container.querySelector('#rxn-area');
    const timeEl = container.querySelector('#rxn-time');
    const hitsEl = container.querySelector('#rxn-hits');
    const v = applyVariant(area, opts);

    let timeLeft = 30, hits = 0, active = true;
    const timeouts = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => { timeouts.delete(id); if (active) fn(); }, ms);
      timeouts.add(id);
      return id;
    };

    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);

    function spawnStar() {
      if (!active) return;
      const rect = area.getBoundingClientRect();
      const size = 60;
      const star = document.createElement('button');
      star.className = 'rxn-star';
      star.type = 'button';
      const x = Math.random() * Math.max(0, rect.width - size);
      const y = Math.random() * Math.max(0, rect.height - size);
      star.style.left = x + 'px';
      star.style.top = y + 'px';
      star.textContent = Math.random() < 0.85 ? '⭐' : '🌟';
      area.appendChild(star);
      const removeId = later(() => star.remove(), 1500 / v.speedMul);
      star.addEventListener('click', () => {
        clearTimeout(removeId);
        timeouts.delete(removeId);
        if (!active) return;
        hits += 1;
        hitsEl.textContent = hits;
        spawnBurst(area, x + size / 2, y + size / 2);
        star.classList.add('popped');
        later(() => star.remove(), 200);
      });
      later(spawnStar, (500 + Math.random() * 400) / v.spawnMul);
    }
    spawnStar();
    later(spawnStar, 250);

    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      timeouts.forEach(clearTimeout);
      area.querySelectorAll('.rxn-star').forEach(s => s.remove());
      const diamonds = hits * 2 + (hits >= 15 ? 10 : 0);
      opts.onEnd({ score: hits, diamonds, summary: `You caught ${hits} star${hits === 1 ? '' : 's'}!` });
    }
    return { cleanup() { active = false; clearInterval(timer); timeouts.forEach(clearTimeout); } };
  }
};


/* =====================================================
   FRUIT SLICE — inspired by Fruit Ninja
   ===================================================== */
MiniGames.fruit_slice = {
  name: 'Fruit Slice',
  icon: '🍉',
  description: 'Swipe across fruit to slice it! Avoid the bombs. 45 seconds of sweet chaos.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-slice">
        <div class="mg-info">
          <span>Time: <strong id="fs-time">45</strong>s</span>
          <span>Score: <strong id="fs-score">0</strong></span>
          <span>Lives: <strong id="fs-lives">❤️❤️❤️</strong></span>
        </div>
        <div class="mg-area" id="fs-area"></div>
        <p class="hint">Drag your mouse or finger across the fruit!</p>
      </div>
    `;
    const area = container.querySelector('#fs-area');
    const timeEl = container.querySelector('#fs-time');
    const scoreEl = container.querySelector('#fs-score');
    const livesEl = container.querySelector('#fs-lives');
    const v = applyVariant(area, opts);

    let active = true, timeLeft = 45, score = 0, lives = 3;
    const objects = [];
    let rafId = null, dragging = false, lastX = 0, lastY = 0;

    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);

    function updateLives() {
      livesEl.textContent = lives > 0 ? '❤️'.repeat(lives) : '💔';
    }

    function spawn() {
      if (!active) return;
      const fruits = ['🍎','🍊','🍌','🍇','🍓','🍉','🥝','🍑','🥥','🍍'];
      const isBomb = Math.random() < 0.18;
      const el = document.createElement('div');
      el.className = 'fruit' + (isBomb ? ' bomb' : '');
      el.textContent = isBomb ? '💣' : fruits[Math.floor(Math.random() * fruits.length)];
      const w = area.clientWidth;
      const x = randInt(60, Math.max(61, w - 60));
      const vx = (randInt(-3, 3) * 0.6) * v.speedMul;
      const vy = -(11 + Math.random() * 3) * Math.sqrt(v.speedMul);
      el.style.left = (x - 28) + 'px';
      el.style.top = (area.clientHeight - 60) + 'px';
      area.appendChild(el);
      objects.push({ el, x, y: area.clientHeight - 60, vx, vy, kind: isBomb ? 'bomb' : 'fruit', sliced: false });
      setTimeout(spawn, (700 + Math.random() * 600) / v.spawnMul);
    }
    setTimeout(spawn, 400);

    function tick() {
      if (!active) return;
      const h = area.clientHeight;
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        o.vy += 0.32 * v.speedMul;
        o.x += o.vx;
        o.y += o.vy;
        o.el.style.left = (o.x - 28) + 'px';
        o.el.style.top = o.y + 'px';
        if (o.y > h + 80) {
          if (!o.sliced && o.kind === 'fruit') {
            lives -= 1;
            updateLives();
            if (lives <= 0) { end(); return; }
          }
          o.el.remove();
          objects.splice(i, 1);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function checkSlice(x, y) {
      for (const o of objects) {
        if (o.sliced) continue;
        const dx = o.x - x, dy = (o.y + 28) - y;
        if (Math.sqrt(dx * dx + dy * dy) < 38) {
          o.sliced = true;
          if (o.kind === 'fruit') {
            score += 10;
            scoreEl.textContent = score;
            o.el.classList.add('sliced');
            spawnBurst(area, o.x, o.y + 28);
          } else {
            score = Math.max(0, score - 20);
            scoreEl.textContent = score;
            lives -= 1;
            updateLives();
            o.el.classList.add('bomb-hit');
            if (lives <= 0) { end(); return; }
          }
        }
      }
    }

    function pointerXY(e) {
      const rect = area.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - rect.left, y: cy - rect.top };
    }
    const onDown = e => {
      dragging = true;
      const p = pointerXY(e);
      lastX = p.x; lastY = p.y;
      if (e.touches) e.preventDefault();
    };
    const onMove = e => {
      if (!dragging) return;
      const p = pointerXY(e);
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const tx = lastX + (p.x - lastX) * i / steps;
        const ty = lastY + (p.y - lastY) * i / steps;
        checkSlice(tx, ty);
        const dot = document.createElement('div');
        dot.className = 'slice-trail';
        dot.style.left = tx + 'px';
        dot.style.top = ty + 'px';
        area.appendChild(dot);
        setTimeout(() => dot.remove(), 300);
      }
      lastX = p.x; lastY = p.y;
      if (e.touches) e.preventDefault();
    };
    const onUp = () => { dragging = false; };

    area.addEventListener('mousedown', onDown);
    area.addEventListener('mousemove', onMove);
    area.addEventListener('mouseup', onUp);
    area.addEventListener('mouseleave', onUp);
    area.addEventListener('touchstart', onDown, { passive: false });
    area.addEventListener('touchmove', onMove, { passive: false });
    area.addEventListener('touchend', onUp);

    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      if (rafId) cancelAnimationFrame(rafId);
      const diamonds = Math.max(5, Math.floor(score / 3));
      opts.onEnd({ score, diamonds, summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); if (rafId) cancelAnimationFrame(rafId); } };
  }
};


/* =====================================================
   MEMORY MATCH
   ===================================================== */
MiniGames.memory = {
  name: 'Memory Match',
  icon: '🃏',
  description: 'Flip cards to find matching pairs. Fewer wrong guesses = more diamonds!',
  start(container, opts) {
    // Theme-aware symbol sets keep memory feeling fresh per variant.
    const SYMBOL_SETS = {
      classic:  ['🍎','🍌','🍇','🍓','🍑','🍒','🍉','🥝'],
      cosmic:   ['🌟','🚀','🪐','👽','🛸','☄️','🌌','🌙'],
      ocean:    ['🐠','🐟','🦀','🐙','🦑','🐢','🐬','🦈'],
      lava:     ['🔥','🌋','💥','🧨','🪨','☄️','🦂','🐉'],
      frozen:   ['❄️','⛄','🧊','☃️','🥶','🧣','🦌','🐻‍❄️'],
      candy:    ['🍭','🍬','🍫','🍩','🧁','🍪','🍰','🍦'],
      spooky:   ['🎃','👻','🦇','🕷️','💀','🧛','🧟','🕯️'],
      jungle:   ['🦁','🐯','🐵','🦜','🐍','🦒','🐘','🦓'],
      magic:    ['🪄','🔮','✨','🎩','🧙','🧚','🦄','🌠'],
      midnight: ['🌙','🌚','⭐','✨','🦉','🦇','🌌','🪐'],
      desert:   ['🌵','🐪','🦎','☀️','🏜️','🦂','🪨','🦅'],
      rainbow:  ['🌈','🦄','🌸','🌺','🌻','🌷','🦋','🍭']
    };
    const themeId = (opts.variant && opts.variant.theme) || 'classic';
    const symbols = SYMBOL_SETS[themeId] || SYMBOL_SETS.classic;
    const deck = shuffle([...symbols, ...symbols]);

    container.innerHTML = `
      <div class="mg-memory">
        <div class="mg-info">
          <span>Pairs: <strong id="mem-pairs">0</strong> / ${symbols.length}</span>
          <span>Attempts: <strong id="mem-attempts">0</strong></span>
        </div>
        <div class="mg-grid" id="mem-grid"></div>
      </div>
    `;
    const grid = container.querySelector('#mem-grid');
    const pairsEl = container.querySelector('#mem-pairs');
    const attemptsEl = container.querySelector('#mem-attempts');
    const v = applyVariant(grid, opts);
    let firstCard = null, lock = false, pairsFound = 0, attempts = 0, active = true;

    deck.forEach((symbol, idx) => {
      const card = document.createElement('button');
      card.className = 'mem-card';
      card.type = 'button';
      card.dataset.symbol = symbol;
      card.dataset.idx = String(idx);
      card.innerHTML = `<span class="back">?</span><span class="front">${symbol}</span>`;
      card.addEventListener('click', () => onClick(card));
      grid.appendChild(card);
    });

    function onClick(card) {
      if (!active || lock) return;
      if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
      card.classList.add('flipped');
      if (!firstCard) { firstCard = card; return; }
      attempts += 1;
      attemptsEl.textContent = attempts;
      if (firstCard.dataset.symbol === card.dataset.symbol) {
        firstCard.classList.add('matched');
        card.classList.add('matched');
        firstCard = null;
        pairsFound += 1;
        pairsEl.textContent = pairsFound;
        if (pairsFound === symbols.length) setTimeout(end, 600);
      } else {
        lock = true;
        const a = firstCard, b = card;
        setTimeout(() => {
          a.classList.remove('flipped');
          b.classList.remove('flipped');
          firstCard = null;
          lock = false;
        }, 850 / v.speedMul);
      }
    }
    function end() {
      if (!active) return;
      active = false;
      const extra = Math.max(0, attempts - symbols.length);
      const diamonds = Math.max(15, 60 - extra * 4);
      opts.onEnd({ score: attempts, diamonds, summary: `Solved in ${attempts} attempts` });
    }
    return { cleanup() { active = false; } };
  }
};


/* =====================================================
   SKY HOP — inspired by Flappy Bird
   ===================================================== */
MiniGames.sky_hop = {
  name: 'Sky Hop',
  icon: '🐦',
  description: 'Tap, click, or press SPACE to flap! Squeeze through the gaps between pipes.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-flappy">
        <div class="mg-info">
          <span>Score: <strong id="sh-score">0</strong></span>
        </div>
        <div class="mg-area" id="sh-area">
          <div id="sh-bird">${opts.avatarEmoji || '🐦'}</div>
          <div class="sh-start-banner" id="sh-banner">Tap to start!</div>
        </div>
        <p class="hint">Tap / click / SPACE to flap</p>
      </div>
    `;
    const area = container.querySelector('#sh-area');
    const bird = container.querySelector('#sh-bird');
    const scoreEl = container.querySelector('#sh-score');
    const banner = container.querySelector('#sh-banner');
    const v = applyVariant(area, opts);

    const BIRD_SIZE = 40, PIPE_W = 64, GAP = 150, GROUND = 40;
    let active = true, started = false, score = 0;
    let birdY = 180, vy = 0;
    const pipes = [];
    let rafId = null;

    function placeBird() {
      bird.style.top = birdY + 'px';
      bird.style.transform = `rotate(${Math.max(-25, Math.min(70, vy * 5))}deg)`;
    }
    placeBird();

    function flap() {
      if (!active) return;
      if (!started) { started = true; banner.style.display = 'none'; }
      vy = -8.5;
    }
    area.addEventListener('mousedown', flap);
    area.addEventListener('touchstart', e => { flap(); e.preventDefault(); }, { passive: false });
    const onKey = e => { if (e.code === 'Space') { flap(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey);

    function spawnPipe() {
      const w = area.clientWidth, h = area.clientHeight;
      const gapY = randInt(70, h - GAP - GROUND - 70);
      const top = document.createElement('div');
      top.className = 'sh-pipe top';
      top.style.left = w + 'px';
      top.style.height = gapY + 'px';
      const bot = document.createElement('div');
      bot.className = 'sh-pipe bottom';
      bot.style.left = w + 'px';
      bot.style.top = (gapY + GAP) + 'px';
      bot.style.height = (h - gapY - GAP - GROUND) + 'px';
      area.appendChild(top);
      area.appendChild(bot);
      pipes.push({ topEl: top, botEl: bot, x: w, gapY, passed: false });
    }

    function tick() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      if (started) {
        vy += 0.45;
        birdY += vy;
        placeBird();

        if (birdY + BIRD_SIZE > h - GROUND) { end(); return; }
        if (birdY < 0) { birdY = 0; vy = 0; }

        const scroll = 3 * v.speedMul;
        for (let i = pipes.length - 1; i >= 0; i--) {
          const p = pipes[i];
          p.x -= scroll;
          p.topEl.style.left = p.x + 'px';
          p.botEl.style.left = p.x + 'px';
          const birdLeft = 60, birdRight = 60 + BIRD_SIZE;
          if (birdRight > p.x && birdLeft < p.x + PIPE_W) {
            if (birdY < p.gapY || birdY + BIRD_SIZE > p.gapY + GAP) { end(); return; }
          }
          if (!p.passed && p.x + PIPE_W < 60) {
            p.passed = true;
            score += 1;
            scoreEl.textContent = score;
          }
          if (p.x < -PIPE_W - 10) {
            p.topEl.remove();
            p.botEl.remove();
            pipes.splice(i, 1);
          }
        }
        if (pipes.length === 0 || pipes[pipes.length - 1].x < w - 220) {
          spawnPipe();
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      area.removeEventListener('mousedown', flap);
      window.removeEventListener('keydown', onKey);
      const diamonds = Math.max(3, score * 5);
      opts.onEnd({ score, diamonds, summary: `Pipes passed: ${score}` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   TREAT CATCHER (dodge)
   ===================================================== */
MiniGames.dodge = {
  name: 'Treat Catcher',
  icon: '🧺',
  description: 'Move with ← → arrows, mouse, or touch. Catch treats, dodge bombs! 30 seconds.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-dodge">
        <div class="mg-info">
          <span>Time: <strong id="dg-time">30</strong>s</span>
          <span>Score: <strong id="dg-score">0</strong></span>
        </div>
        <div class="mg-area" id="dg-area">
          <div id="dg-player">${opts.avatarEmoji || '🧺'}</div>
        </div>
        <p class="hint">Use ← → arrows, mouse, or touch to move</p>
      </div>
    `;
    const area = container.querySelector('#dg-area');
    const player = container.querySelector('#dg-player');
    const timeEl = container.querySelector('#dg-time');
    const scoreEl = container.querySelector('#dg-score');
    const v = applyVariant(area, opts);

    const PLAYER_W = 52, ITEM_W = 40;
    let playerX = 0.5, timeLeft = 30, score = 0, active = true, rafId = null;
    const items = [], keys = { left: false, right: false };

    function placePlayer() {
      const w = area.clientWidth;
      player.style.left = playerX * Math.max(1, w - PLAYER_W) + 'px';
    }
    requestAnimationFrame(placePlayer);

    const onKey = (e, down) => {
      if (e.key === 'ArrowLeft') keys.left = down;
      else if (e.key === 'ArrowRight') keys.right = down;
      else return;
      e.preventDefault();
    };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const moveByPointer = clientX => {
      const rect = area.getBoundingClientRect();
      playerX = clamp((clientX - rect.left) / rect.width, 0, 1);
    };
    const onMouse = e => moveByPointer(e.clientX);
    const onTouch = e => { if (e.touches[0]) { moveByPointer(e.touches[0].clientX); e.preventDefault(); } };
    area.addEventListener('mousemove', onMouse);
    area.addEventListener('touchstart', onTouch, { passive: false });
    area.addEventListener('touchmove', onTouch, { passive: false });

    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);

    function spawn() {
      if (!active) return;
      const w = area.clientWidth;
      const isBomb = Math.random() < 0.25;
      const el = document.createElement('div');
      el.className = 'dg-item ' + (isBomb ? 'bomb' : 'treat');
      el.textContent = isBomb ? '💣' : ['🍭','🍪','🍩','🍫','🍬','🧁'][Math.floor(Math.random()*6)];
      const x = Math.random() * Math.max(0, w - ITEM_W);
      el.style.left = x + 'px';
      el.style.top = '-40px';
      area.appendChild(el);
      items.push({ el, x, y: -40, vy: (2.2 + Math.random() * 2.2) * v.speedMul, kind: isBomb ? 'bomb' : 'treat' });
      setTimeout(spawn, (450 + Math.random() * 500) / v.spawnMul);
    }
    setTimeout(spawn, 500);

    function tick() {
      if (!active) return;
      const h = area.clientHeight, w = area.clientWidth;
      if (keys.left) playerX = clamp(playerX - 0.022, 0, 1);
      if (keys.right) playerX = clamp(playerX + 0.022, 0, 1);
      placePlayer();
      const playerLeft = playerX * Math.max(1, w - PLAYER_W);
      const playerTop = h - PLAYER_W - 8;
      for (let i = items.length - 1; i >= 0; i--) {
        const t = items[i];
        t.y += t.vy;
        t.el.style.top = t.y + 'px';
        const itemBottom = t.y + ITEM_W, itemRight = t.x + ITEM_W;
        if (itemBottom >= playerTop && t.y <= playerTop + PLAYER_W &&
            itemRight > playerLeft && t.x < playerLeft + PLAYER_W) {
          if (t.kind === 'treat') score += 5; else score = Math.max(0, score - 3);
          scoreEl.textContent = score;
          t.el.remove();
          items.splice(i, 1);
        } else if (t.y > h) {
          t.el.remove();
          items.splice(i, 1);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      area.removeEventListener('mousemove', onMouse);
      area.removeEventListener('touchstart', onTouch);
      area.removeEventListener('touchmove', onTouch);
      opts.onEnd({ score, diamonds: Math.floor(score / 2), summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); } };
  }
};


/* =====================================================
   STACK IT — inspired by Stack (Ketchapp)
   ===================================================== */
MiniGames.stack_it = {
  name: 'Stack It',
  icon: '🟦',
  description: 'A block slides side to side. Tap to drop it on the tower. Stay aligned to keep growing!',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-stack">
        <div class="mg-info">
          <span>Height: <strong id="st-height">0</strong></span>
          <span>Perfect: <strong id="st-perfect">0</strong></span>
        </div>
        <div class="mg-area" id="st-area"></div>
        <p class="hint">Tap, click, or SPACE to drop</p>
      </div>
    `;
    const area = container.querySelector('#st-area');
    const heightEl = container.querySelector('#st-height');
    const perfectEl = container.querySelector('#st-perfect');
    const v = applyVariant(area, opts);

    const BLOCK_H = 26, START_W = 180;
    let active = true, height = 0, perfect = 0, scrollY = 0;
    let currentWidth = START_W, currentX = -START_W, dir = 1, speed = 3.4 * v.speedMul;
    let currentBlock = null;
    const stacked = [];
    let rafId = null;

    function placeBaseline() {
      const w = area.clientWidth;
      const x = (w - currentWidth) / 2;
      const base = makeBlock(currentWidth, x, 0, palette(0));
      base.classList.remove('moving');
      stacked.push({ el: base, x, w: currentWidth, y: 0 });
    }
    function makeBlock(width, x, y, color) {
      const el = document.createElement('div');
      el.className = 'st-block moving';
      el.style.width = width + 'px';
      el.style.height = BLOCK_H + 'px';
      el.style.left = x + 'px';
      el.style.bottom = (y - scrollY) + 'px';
      el.style.background = color;
      area.appendChild(el);
      return el;
    }
    function palette(i) {
      const hues = [210, 200, 190, 270, 320, 30, 50, 130, 150];
      const hue = hues[i % hues.length];
      return `linear-gradient(135deg, hsl(${hue}, 80%, 65%), hsl(${hue}, 85%, 45%))`;
    }

    function nextBlock() {
      const yPos = stacked.length * (BLOCK_H + 2);
      currentX = -currentWidth;
      dir = 1;
      currentBlock = makeBlock(currentWidth, currentX, yPos, palette(stacked.length));
    }

    function drop() {
      if (!active || !currentBlock) return;
      const prev = stacked[stacked.length - 1];
      const curLeft = parseFloat(currentBlock.style.left);
      const overlapLeft = Math.max(curLeft, prev.x);
      const overlapRight = Math.min(curLeft + currentWidth, prev.x + prev.w);
      const overlap = overlapRight - overlapLeft;
      if (overlap <= 0) { end(); return; }

      const trimLeft = curLeft < prev.x ? curLeft : prev.x + prev.w;
      const trimWidth = curLeft < prev.x ? prev.x - curLeft : (curLeft + currentWidth) - (prev.x + prev.w);
      if (trimWidth > 0) {
        const trim = document.createElement('div');
        trim.className = 'st-block falling';
        trim.style.width = trimWidth + 'px';
        trim.style.height = BLOCK_H + 'px';
        trim.style.left = trimLeft + 'px';
        trim.style.bottom = currentBlock.style.bottom;
        trim.style.background = currentBlock.style.background;
        area.appendChild(trim);
        setTimeout(() => trim.remove(), 800);
      }

      currentBlock.classList.remove('moving');
      currentBlock.style.left = overlapLeft + 'px';
      currentBlock.style.width = overlap + 'px';
      stacked.push({ el: currentBlock, x: overlapLeft, w: overlap, y: stacked.length * (BLOCK_H + 2) });
      currentWidth = overlap;
      height = stacked.length - 1;
      heightEl.textContent = height;
      if (trimWidth < 4) { perfect += 1; perfectEl.textContent = perfect; }
      else perfect = 0;

      if (currentWidth < 12) { end(); return; }

      const newTopY = stacked.length * (BLOCK_H + 2);
      const h = area.clientHeight;
      if (newTopY - scrollY > h * 0.55) {
        scrollY = newTopY - h * 0.45;
        for (const s of stacked) s.el.style.bottom = (s.y - scrollY) + 'px';
      }
      speed = Math.min(7 * v.speedMul, speed + 0.08);
      nextBlock();
    }

    function tick() {
      if (!active) return;
      const w = area.clientWidth;
      if (currentBlock && currentBlock.classList.contains('moving')) {
        currentX += dir * speed;
        if (currentX <= -currentWidth + 8) dir = 1;
        if (currentX >= w - 8) dir = -1;
        currentBlock.style.left = currentX + 'px';
      }
      rafId = requestAnimationFrame(tick);
    }

    area.addEventListener('mousedown', drop);
    area.addEventListener('touchstart', e => { drop(); e.preventDefault(); }, { passive: false });
    const onKey = e => { if (e.code === 'Space') { drop(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey);

    placeBaseline();
    nextBlock();
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      const diamonds = height * 3 + perfect * 2;
      opts.onEnd({ score: height, diamonds, summary: `Tower height: ${height} (${perfect} perfect)` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   PATTERN REPEAT (Simon)
   ===================================================== */
MiniGames.pattern = {
  name: 'Pattern Repeat',
  icon: '🎨',
  description: 'Watch the colours, then repeat the pattern in the same order. How far can you go?',
  start(container, opts) {
    const colors = ['red', 'green', 'blue', 'yellow'];
    container.innerHTML = `
      <div class="mg-pattern">
        <div class="mg-info">
          <span>Round: <strong id="pt-round">1</strong></span>
        </div>
        <div class="pt-board">
          ${colors.map(c => `<button class="pt-pad pt-${c}" data-color="${c}" type="button" aria-label="${c}"></button>`).join('')}
        </div>
        <p id="pt-status">Watch carefully...</p>
      </div>
    `;
    const board = container.querySelector('.pt-board');
    const pads = Array.from(container.querySelectorAll('.pt-pad'));
    const roundEl = container.querySelector('#pt-round');
    const statusEl = container.querySelector('#pt-status');
    const v = applyVariant(board, opts);

    let sequence = [], userIndex = 0, acceptInput = false, active = true;
    const timeouts = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => { timeouts.delete(id); if (active) fn(); }, ms);
      timeouts.add(id);
    };

    function nextRound() {
      if (!active) return;
      sequence.push(colors[Math.floor(Math.random() * colors.length)]);
      roundEl.textContent = sequence.length;
      userIndex = 0;
      acceptInput = false;
      statusEl.textContent = 'Watch carefully...';
      playSequence();
    }
    function playSequence() {
      const speed = Math.max(180, (600 - sequence.length * 20) / v.speedMul);
      let i = 0;
      function step() {
        if (!active) return;
        if (i >= sequence.length) { acceptInput = true; statusEl.textContent = 'Your turn!'; return; }
        const pad = pads.find(p => p.dataset.color === sequence[i]);
        pad.classList.add('lit');
        later(() => { pad.classList.remove('lit'); i++; later(step, 180 / v.speedMul); }, speed);
      }
      later(step, 600 / v.speedMul);
    }
    pads.forEach(pad => pad.addEventListener('click', () => {
      if (!active || !acceptInput) return;
      pad.classList.add('lit');
      later(() => pad.classList.remove('lit'), 220);
      if (pad.dataset.color === sequence[userIndex]) {
        userIndex++;
        if (userIndex === sequence.length) {
          acceptInput = false;
          statusEl.textContent = 'Nice!';
          later(nextRound, 700 / v.speedMul);
        }
      } else end();
    }));
    nextRound();

    function end() {
      if (!active) return;
      active = false;
      acceptInput = false;
      const rounds = Math.max(0, sequence.length - 1);
      statusEl.textContent = `Reached round ${rounds}!`;
      setTimeout(() => opts.onEnd({ score: rounds, diamonds: rounds * 6,
        summary: `Repeated ${rounds} round${rounds === 1 ? '' : 's'} correctly` }), 1200);
    }
    return { cleanup() { active = false; timeouts.forEach(clearTimeout); } };
  }
};


/* =====================================================
   GEO DASH — inspired by Geometry Dash
   ===================================================== */
MiniGames.geo_dash = {
  name: 'Geo Dash',
  icon: '🟧',
  description: 'Tap, click, or SPACE to jump! Soar over the spikes — how far can you run?',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-dash">
        <div class="mg-info">
          <span>Score: <strong id="gd-score">0</strong></span>
          <span>Speed: <strong id="gd-speed">×1.0</strong></span>
        </div>
        <div class="mg-area" id="gd-area">
          <div id="gd-cube"></div>
        </div>
        <p class="hint">Tap / click / SPACE to jump</p>
      </div>
    `;
    const area = container.querySelector('#gd-area');
    const cube = container.querySelector('#gd-cube');
    const scoreEl = container.querySelector('#gd-score');
    const speedEl = container.querySelector('#gd-speed');
    const v = applyVariant(area, opts);

    const GROUND = 60, CUBE_SIZE = 40;
    let active = true, score = 0;
    let cubeY = 0, vy = 0;
    let onGround = true;
    const baseSpeed = 4.5;
    let scrollSpeed = baseSpeed * v.speedMul;
    const obstacles = [];
    let spawnTimer = 0;
    let rafId = null;

    function placeCube() {
      cube.style.bottom = (GROUND + cubeY) + 'px';
      cube.style.transform = `rotate(${(-cubeY * 1.5)}deg)`;
    }
    placeCube();

    function jump() {
      if (!active || !onGround) return;
      vy = 11.5;
      onGround = false;
    }
    area.addEventListener('mousedown', jump);
    area.addEventListener('touchstart', e => { jump(); e.preventDefault(); }, { passive: false });
    const onKey = e => { if (e.code === 'Space' || e.code === 'ArrowUp') { jump(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey);

    function spawnObstacle() {
      const w = area.clientWidth;
      const isDouble = Math.random() < 0.15;
      const count = isDouble ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'gd-spike';
        el.style.left = (w + i * 32) + 'px';
        area.appendChild(el);
        obstacles.push({ el, x: w + i * 32, w: 28, passed: false });
      }
    }

    function tick() {
      if (!active) return;
      vy -= 0.6;
      cubeY = Math.max(0, cubeY + vy);
      if (cubeY === 0) { vy = 0; onGround = true; } else onGround = false;
      placeCube();

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= scrollSpeed;
        o.el.style.left = o.x + 'px';
        const cubeLeft = 80, cubeRight = 80 + CUBE_SIZE;
        if (o.x < cubeRight && o.x + o.w > cubeLeft) {
          if (cubeY < 26) { end(); return; }
        }
        if (!o.passed && o.x + o.w < cubeLeft) {
          o.passed = true;
          score += 1;
          scoreEl.textContent = score;
          if (score % 8 === 0) {
            scrollSpeed = Math.min(9 * v.speedMul, scrollSpeed + 0.4);
            speedEl.textContent = '×' + (scrollSpeed / baseSpeed).toFixed(1);
          }
        }
        if (o.x < -40) { o.el.remove(); obstacles.splice(i, 1); }
      }

      spawnTimer -= scrollSpeed;
      if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = randInt(180, 260);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      opts.onEnd({ score, diamonds: score * 4 + 5, summary: `${score} obstacles cleared` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   SNAKE
   ===================================================== */
MiniGames.snake = {
  name: 'Snake',
  icon: '🐍',
  description: 'Eat the food and grow longer! Use arrow keys or WASD. Don\'t hit yourself.',
  start(container, opts) {
    const COLS = 16, ROWS = 12;
    container.innerHTML = `
      <div class="mg-snake">
        <div class="mg-info">
          <span>Score: <strong id="sn-score">0</strong></span>
          <span>Length: <strong id="sn-len">3</strong></span>
        </div>
        <div class="snake-board" id="sn-board"
          style="grid-template-columns: repeat(${COLS}, 1fr); width: min(420px, 100%);"></div>
        <p class="hint">Arrow keys or WASD to steer</p>
      </div>
    `;
    const board = container.querySelector('#sn-board');
    const scoreEl = container.querySelector('#sn-score');
    const lenEl = container.querySelector('#sn-len');
    const v = applyVariant(board, opts);

    const cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = document.createElement('div');
      c.className = 'snake-cell';
      board.appendChild(c);
      cells.push(c);
    }
    const idx = (x, y) => y * COLS + x;

    let snake = [{ x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 }];
    let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let food = spawnFood();
    let score = 0, active = true, stepMs = Math.round(180 / v.speedMul);

    function spawnFood() {
      const free = [];
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          if (!snake.some(s => s.x === x && s.y === y))
            free.push({ x, y });
      return free[Math.floor(Math.random() * free.length)];
    }
    function render() {
      cells.forEach(c => c.className = 'snake-cell');
      cells[idx(food.x, food.y)].classList.add('food');
      snake.forEach((s, i) => {
        cells[idx(s.x, s.y)].classList.add(i === 0 ? 'head' : 'snake');
      });
    }
    render();

    const onKey = e => {
      const k = e.key;
      const d =
        (k === 'ArrowUp'    || k === 'w' || k === 'W') ? { x:  0, y: -1 } :
        (k === 'ArrowDown'  || k === 's' || k === 'S') ? { x:  0, y:  1 } :
        (k === 'ArrowLeft'  || k === 'a' || k === 'A') ? { x: -1, y:  0 } :
        (k === 'ArrowRight' || k === 'd' || k === 'D') ? { x:  1, y:  0 } : null;
      if (!d) return;
      if (d.x === -dir.x && d.y === -dir.y) return;
      nextDir = d;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);

    function step() {
      if (!active) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return end();
      if (snake.some(s => s.x === head.x && s.y === head.y)) return end();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = score;
        lenEl.textContent = snake.length;
        food = spawnFood();
        if (!food) return end();
        if (stepMs > 90) stepMs -= 4;
      } else {
        snake.pop();
      }
      render();
    }

    let stepTimer = setInterval(step, stepMs);
    const speedInterval = setInterval(() => {
      clearInterval(stepTimer);
      stepTimer = setInterval(step, stepMs);
    }, 1000);

    function end() {
      if (!active) return;
      active = false;
      clearInterval(stepTimer);
      clearInterval(speedInterval);
      window.removeEventListener('keydown', onKey);
      const diamonds = Math.max(5, score);
      opts.onEnd({ score, diamonds, summary: `Snake grew to ${snake.length} cells` });
    }
    return { cleanup() {
      active = false;
      clearInterval(stepTimer);
      clearInterval(speedInterval);
      window.removeEventListener('keydown', onKey);
    } };
  }
};


/* =====================================================
   BRICK BREAKER — inspired by Breakout
   ===================================================== */
MiniGames.brick = {
  name: 'Brick Breaker',
  icon: '🧱',
  description: 'Move the paddle to bounce the ball into bricks. Clear them all!',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-brick">
        <div class="mg-info">
          <span>Score: <strong id="bk-score">0</strong></span>
          <span>Bricks: <strong id="bk-bricks">0</strong></span>
          <span>Lives: <strong id="bk-lives">❤️❤️❤️</strong></span>
        </div>
        <div class="mg-area" id="bk-area">
          <div id="bk-paddle"></div>
          <div id="bk-ball"></div>
        </div>
        <p class="hint">Move with mouse or ← →</p>
      </div>
    `;
    const area = container.querySelector('#bk-area');
    const paddle = container.querySelector('#bk-paddle');
    const ball = container.querySelector('#bk-ball');
    const scoreEl = container.querySelector('#bk-score');
    const bricksEl = container.querySelector('#bk-bricks');
    const livesEl = container.querySelector('#bk-lives');
    const v = applyVariant(area, opts);

    const PADDLE_W = 100, PADDLE_H = 14, BALL = 14;
    let paddleX = 0.5, ballX = 200, ballY = 300;
    let ballVX = 3 * v.speedMul, ballVY = -3 * v.speedMul;
    let score = 0, lives = 3, active = true, rafId = null;
    const bricks = [];
    const keys = { left: false, right: false };

    function placePaddle() {
      const w = area.clientWidth;
      paddle.style.left = (paddleX * (w - PADDLE_W)) + 'px';
    }
    function placeBall() {
      ball.style.left = (ballX - BALL / 2) + 'px';
      ball.style.top = (ballY - BALL / 2) + 'px';
    }

    requestAnimationFrame(() => {
      const w = area.clientWidth;
      const COLS = 8, ROWS = 4;
      const brickW = (w - 24) / COLS;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const el = document.createElement('div');
          el.className = 'bk-brick';
          el.style.left = (12 + c * brickW + 2) + 'px';
          el.style.top = (24 + r * 26) + 'px';
          el.style.width = (brickW - 4) + 'px';
          el.style.height = '22px';
          const hue = 200 - r * 40;
          el.style.background = `linear-gradient(135deg, hsl(${hue}, 75%, 60%), hsl(${hue}, 80%, 45%))`;
          area.appendChild(el);
          bricks.push({ el, x: 12 + c * brickW + 2, y: 24 + r * 26, w: brickW - 4, h: 22, alive: true });
        }
      }
      bricksEl.textContent = bricks.length;
      ballX = w / 2; ballY = area.clientHeight - 80;
      placePaddle(); placeBall();
    });

    const onMouse = e => {
      const rect = area.getBoundingClientRect();
      paddleX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    };
    area.addEventListener('mousemove', onMouse);
    const kd = e => {
      if (e.key === 'ArrowLeft') keys.left = true;
      else if (e.key === 'ArrowRight') keys.right = true;
      else return;
      e.preventDefault();
    };
    const ku = e => {
      if (e.key === 'ArrowLeft') keys.left = false;
      else if (e.key === 'ArrowRight') keys.right = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    function tick() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      if (keys.left) paddleX = clamp(paddleX - 0.018, 0, 1);
      if (keys.right) paddleX = clamp(paddleX + 0.018, 0, 1);
      placePaddle();

      ballX += ballVX; ballY += ballVY;
      if (ballX < BALL / 2) { ballX = BALL / 2; ballVX = Math.abs(ballVX); }
      if (ballX > w - BALL / 2) { ballX = w - BALL / 2; ballVX = -Math.abs(ballVX); }
      if (ballY < BALL / 2) { ballY = BALL / 2; ballVY = Math.abs(ballVY); }

      const pLeft = paddleX * (w - PADDLE_W);
      const pTop = h - PADDLE_H - 16;
      if (ballY + BALL / 2 >= pTop && ballY - BALL / 2 <= pTop + PADDLE_H &&
          ballX >= pLeft && ballX <= pLeft + PADDLE_W && ballVY > 0) {
        ballVY = -Math.abs(ballVY);
        const hitPos = (ballX - pLeft) / PADDLE_W - 0.5;
        ballVX = clamp(ballVX + hitPos * 3, -5 * v.speedMul, 5 * v.speedMul);
        ballY = pTop - BALL / 2;
      }
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ballX + BALL/2 > b.x && ballX - BALL/2 < b.x + b.w &&
            ballY + BALL/2 > b.y && ballY - BALL/2 < b.y + b.h) {
          b.alive = false;
          b.el.classList.add('broken');
          setTimeout(() => b.el.remove(), 300);
          score += 10; scoreEl.textContent = score;
          bricksEl.textContent = bricks.filter(b => b.alive).length;
          ballVY = -ballVY;
          if (!bricks.some(b => b.alive)) { end(true); return; }
          break;
        }
      }
      if (ballY > h) {
        lives -= 1;
        livesEl.textContent = lives > 0 ? '❤️'.repeat(lives) : '💔';
        if (lives <= 0) { end(false); return; }
        ballX = w / 2; ballY = h - 80;
        ballVX = 3 * v.speedMul * (Math.random() < 0.5 ? -1 : 1);
        ballVY = -3 * v.speedMul;
      }
      placeBall();
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end(won) {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      area.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      const diamonds = Math.floor(score / 5) + (won ? 30 : 0);
      opts.onEnd({ score, diamonds, summary: won ? 'Cleared all bricks!' : `${score / 10} bricks broken` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId);
      area.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); } };
  }
};


/* =====================================================
   WHACK-A-MOLE (no numbers — just smash moles)
   ===================================================== */
MiniGames.whack = {
  name: 'Whack-a-Mole',
  icon: '🐹',
  description: 'Moles pop out of holes — whack them fast! Avoid the bombs.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-mole">
        <div class="mg-info">
          <span>Time: <strong id="wm-time">30</strong>s</span>
          <span>Score: <strong id="wm-score">0</strong></span>
        </div>
        <div class="wm-grid" id="wm-grid"></div>
      </div>
    `;
    const grid = container.querySelector('#wm-grid');
    const timeEl = container.querySelector('#wm-time');
    const scoreEl = container.querySelector('#wm-score');
    const v = applyVariant(grid, opts);

    let timeLeft = 30, score = 0, active = true;
    const holes = [];
    for (let i = 0; i < 9; i++) {
      const hole = document.createElement('div');
      hole.className = 'wm-hole';
      const popup = document.createElement('div');
      popup.className = 'wm-popup';
      hole.appendChild(popup);
      hole.addEventListener('click', () => onHit(i));
      grid.appendChild(hole);
      holes.push({ hole, popup, kind: null, up: false });
    }
    function onHit(i) {
      if (!active) return;
      const h = holes[i];
      if (!h.up) return;
      if (h.kind === 'mole') score += 5;
      else score = Math.max(0, score - 3);
      scoreEl.textContent = score;
      h.popup.classList.add('hit');
      h.up = false;
      setTimeout(() => h.popup.classList.remove('hit', 'up'), 220);
    }
    function popUp() {
      if (!active) return;
      const free = holes.filter(h => !h.up);
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        const isBomb = Math.random() < 0.18;
        h.kind = isBomb ? 'bomb' : 'mole';
        h.popup.textContent = isBomb ? '💣' : '🐹';
        h.popup.classList.remove('hit');
        h.popup.classList.add('up');
        h.up = true;
        setTimeout(() => {
          if (!active) return;
          if (h.up) { h.popup.classList.remove('up'); h.up = false; }
        }, (900 + Math.random() * 400) / v.speedMul);
      }
      setTimeout(popUp, (400 + Math.random() * 400) / v.spawnMul);
    }
    popUp();
    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      opts.onEnd({ score, diamonds: Math.max(5, Math.floor(score / 2)), summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); } };
  }
};


/* =====================================================
   TAP RHYTHM — inspired by Beatstar / Tap Tap Revenge
   ===================================================== */
MiniGames.rhythm = {
  name: 'Tap Rhythm',
  icon: '🎵',
  description: 'Notes fall down 4 lanes. Tap the lane when a note crosses the line!',
  start(container, opts) {
    const LANES = 4;
    const KEYS = ['a', 's', 'd', 'f'];
    container.innerHTML = `
      <div class="mg-rhythm">
        <div class="mg-info">
          <span>Time: <strong id="rh-time">35</strong>s</span>
          <span>Score: <strong id="rh-score">0</strong></span>
          <span>Combo: <strong id="rh-combo">0</strong></span>
        </div>
        <div class="mg-area" id="rh-area">
          ${Array.from({length: LANES}).map((_,i) => `<div class="rh-lane" data-lane="${i}"><div class="rh-target"></div></div>`).join('')}
        </div>
        <p class="hint">Tap a lane or press A S D F when a note crosses the line</p>
      </div>
    `;
    const area = container.querySelector('#rh-area');
    const lanes = Array.from(container.querySelectorAll('.rh-lane'));
    const timeEl = container.querySelector('#rh-time');
    const scoreEl = container.querySelector('#rh-score');
    const comboEl = container.querySelector('#rh-combo');
    const v = applyVariant(area, opts);

    let timeLeft = 35, score = 0, combo = 0, active = true, rafId = null;
    const notes = [];
    lanes.forEach((lane, i) => {
      lane.addEventListener('mousedown', () => hit(i));
      lane.addEventListener('touchstart', e => { hit(i); e.preventDefault(); }, { passive: false });
    });
    const onKey = e => {
      const idx = KEYS.indexOf(e.key.toLowerCase());
      if (idx >= 0) { hit(idx); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    function hit(laneIdx) {
      if (!active) return;
      const targetY = area.clientHeight - 60;
      let best = null, bestDist = 80;
      for (const n of notes) {
        if (n.dead || n.lane !== laneIdx) continue;
        const dist = Math.abs(n.y - targetY);
        if (dist < bestDist) { best = n; bestDist = dist; }
      }
      const indicator = lanes[laneIdx].querySelector('.rh-target');
      indicator.classList.add('flash');
      setTimeout(() => indicator.classList.remove('flash'), 180);
      if (best) {
        best.dead = true;
        best.el.classList.add('hit');
        setTimeout(() => best.el.remove(), 200);
        score += bestDist < 25 ? 10 : 5;
        combo += 1;
      } else {
        combo = 0;
      }
      scoreEl.textContent = score;
      comboEl.textContent = combo;
    }
    function spawn() {
      if (!active) return;
      const lane = Math.floor(Math.random() * LANES);
      const el = document.createElement('div');
      el.className = 'rh-note';
      lanes[lane].appendChild(el);
      notes.push({ el, lane, y: -30, vy: (3 + Math.random() * 1.5) * v.speedMul, dead: false });
      setTimeout(spawn, (600 + Math.random() * 400) / v.spawnMul);
    }
    setTimeout(spawn, 500);

    function tick() {
      if (!active) return;
      const h = area.clientHeight;
      const targetY = h - 60;
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (n.dead) { notes.splice(i, 1); continue; }
        n.y += n.vy;
        n.el.style.top = n.y + 'px';
        if (n.y > targetY + 50) {
          n.el.remove(); notes.splice(i, 1);
          combo = 0; comboEl.textContent = combo;
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer); if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      opts.onEnd({ score, diamonds: Math.max(5, Math.floor(score / 2)), summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   TILE MATCH — inspired by Mahjong / Tile Master
   ===================================================== */
MiniGames.tile = {
  name: 'Tile Match',
  icon: '🀄',
  description: 'Tap two matching tiles to clear them. Clear all 8 pairs!',
  start(container, opts) {
    const SYMBOL_SETS = {
      classic:  ['🌸','🌺','🌻','🌷','🌼','🌹','🍀','🌿'],
      cosmic:   ['🌟','🚀','🪐','👽','🛸','☄️','🌌','🌙'],
      ocean:    ['🐠','🐟','🦀','🐙','🦑','🐢','🐬','🦈'],
      lava:     ['🔥','🌋','💥','🧨','🪨','☄️','🦂','🐉'],
      frozen:   ['❄️','⛄','🧊','☃️','🥶','🧣','🦌','🐻‍❄️'],
      candy:    ['🍭','🍬','🍫','🍩','🧁','🍪','🍰','🍦'],
      spooky:   ['🎃','👻','🦇','🕷️','💀','🧛','🧟','🕯️'],
      jungle:   ['🦁','🐯','🐵','🦜','🐍','🦒','🐘','🦓'],
      magic:    ['🪄','🔮','✨','🎩','🧙','🧚','🦄','🌠'],
      midnight: ['🌙','🌚','⭐','✨','🦉','🦇','🌌','🪐'],
      desert:   ['🌵','🐪','🦎','☀️','🏜️','🦂','🪨','🦅'],
      rainbow:  ['🌈','🦄','🌸','🌺','🌻','🌷','🦋','🍭']
    };
    const themeId = (opts.variant && opts.variant.theme) || 'classic';
    const symbols = SYMBOL_SETS[themeId] || SYMBOL_SETS.classic;
    container.innerHTML = `
      <div class="mg-tile">
        <div class="mg-info">
          <span>Time: <strong id="tl-time">60</strong>s</span>
          <span>Pairs: <strong id="tl-pairs">0</strong> / 8</span>
        </div>
        <div class="tile-grid" id="tl-grid"></div>
      </div>
    `;
    const grid = container.querySelector('#tl-grid');
    const timeEl = container.querySelector('#tl-time');
    const pairsEl = container.querySelector('#tl-pairs');
    const v = applyVariant(grid, opts);

    let timeLeft = 60, pairs = 0, active = true, selected = null;
    const tiles = shuffle([...symbols, ...symbols]);
    tiles.forEach(sym => {
      const tile = document.createElement('button');
      tile.className = 'tile-card';
      tile.type = 'button';
      tile.textContent = sym;
      tile.dataset.sym = sym;
      tile.addEventListener('click', () => onTap(tile));
      grid.appendChild(tile);
    });
    function onTap(tile) {
      if (!active) return;
      if (tile.classList.contains('cleared') || tile.classList.contains('selected')) return;
      tile.classList.add('selected');
      if (!selected) { selected = tile; return; }
      if (selected.dataset.sym === tile.dataset.sym && selected !== tile) {
        selected.classList.add('cleared');
        tile.classList.add('cleared');
        pairs += 1;
        pairsEl.textContent = pairs;
        selected = null;
        if (pairs === symbols.length) setTimeout(end, 400);
      } else {
        const prev = selected;
        selected = null;
        setTimeout(() => {
          prev.classList.remove('selected');
          tile.classList.remove('selected');
        }, 400);
      }
    }
    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000 / v.speedMul);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      const diamonds = pairs * 8 + (pairs === symbols.length ? 30 : 0);
      opts.onEnd({ score: pairs, diamonds, summary: `Cleared ${pairs}/${symbols.length} pairs` });
    }
    return { cleanup() { active = false; clearInterval(timer); } };
  }
};


/* =====================================================
   ASTEROID DODGE — inspired by Asteroids
   ===================================================== */
MiniGames.asteroid = {
  name: 'Asteroid Dodge',
  icon: '🚀',
  description: 'Pilot your ship through the asteroid field. Grab the gems!',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-asteroid">
        <div class="mg-info">
          <span>Time: <strong id="as-time">45</strong>s</span>
          <span>Score: <strong id="as-score">0</strong></span>
          <span>Lives: <strong id="as-lives">❤️❤️❤️</strong></span>
        </div>
        <div class="mg-area" id="as-area">
          <div id="as-ship">🚀</div>
        </div>
        <p class="hint">WASD or arrow keys to fly</p>
      </div>
    `;
    const area = container.querySelector('#as-area');
    const ship = container.querySelector('#as-ship');
    const timeEl = container.querySelector('#as-time');
    const scoreEl = container.querySelector('#as-score');
    const livesEl = container.querySelector('#as-lives');
    const v = applyVariant(area, opts);

    let timeLeft = 45, score = 0, lives = 3, active = true, invuln = 0, rafId = null;
    let shipX = 0.5, shipY = 0.5;
    const keys = { up: false, down: false, left: false, right: false };
    const asteroids = [];

    function placeShip() {
      const w = area.clientWidth, h = area.clientHeight;
      ship.style.left = (shipX * (w - 50)) + 'px';
      ship.style.top = (shipY * (h - 50)) + 'px';
    }
    requestAnimationFrame(placeShip);
    const onKey = (e, down) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') keys.up = down;
      else if (k === 'arrowdown' || k === 's') keys.down = down;
      else if (k === 'arrowleft' || k === 'a') keys.left = down;
      else if (k === 'arrowright' || k === 'd') keys.right = down;
      else return;
      e.preventDefault();
    };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    function spawn() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      const side = Math.floor(Math.random() * 4);
      let x, y, vx, vy;
      const sp = (2 + Math.random() * 2.5) * v.speedMul;
      if (side === 0)      { x = Math.random() * w; y = -30; vx = (Math.random() - 0.5) * 2; vy = sp; }
      else if (side === 1) { x = w + 30; y = Math.random() * h; vx = -sp; vy = (Math.random() - 0.5) * 2; }
      else if (side === 2) { x = Math.random() * w; y = h + 30; vx = (Math.random() - 0.5) * 2; vy = -sp; }
      else                 { x = -30; y = Math.random() * h; vx = sp; vy = (Math.random() - 0.5) * 2; }
      const isGem = Math.random() < 0.15;
      const el = document.createElement('div');
      el.className = 'as-obj ' + (isGem ? 'gem' : 'rock');
      el.textContent = isGem ? '💎' : '☄️';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      area.appendChild(el);
      asteroids.push({ el, x, y, vx, vy, kind: isGem ? 'gem' : 'rock' });
      setTimeout(spawn, (500 + Math.random() * 400) / v.spawnMul);
    }
    setTimeout(spawn, 500);

    function tick() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      if (keys.left) shipX = clamp(shipX - 0.016, 0, 1);
      if (keys.right) shipX = clamp(shipX + 0.016, 0, 1);
      if (keys.up) shipY = clamp(shipY - 0.016, 0, 1);
      if (keys.down) shipY = clamp(shipY + 0.016, 0, 1);
      placeShip();
      const shipLeft = shipX * (w - 50), shipTop = shipY * (h - 50);
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.x += a.vx; a.y += a.vy;
        a.el.style.left = a.x + 'px';
        a.el.style.top = a.y + 'px';
        if (a.x < -60 || a.x > w + 60 || a.y < -60 || a.y > h + 60) {
          a.el.remove(); asteroids.splice(i, 1);
          continue;
        }
        const dx = (a.x + 18) - (shipLeft + 25);
        const dy = (a.y + 18) - (shipTop + 25);
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
          a.el.remove(); asteroids.splice(i, 1);
          if (a.kind === 'gem') { score += 15; scoreEl.textContent = score; }
          else if (invuln <= 0) {
            lives -= 1;
            livesEl.textContent = lives > 0 ? '❤️'.repeat(lives) : '💔';
            invuln = 60;
            if (lives <= 0) { end(); return; }
          }
        }
      }
      if (invuln > 0) { invuln -= 1; ship.style.opacity = (invuln % 8 < 4) ? 0.35 : 1; }
      else ship.style.opacity = 1;
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      score += 1;
      scoreEl.textContent = score;
      if (timeLeft <= 0) end();
    }, 1000);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer); if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      opts.onEnd({ score, diamonds: Math.max(5, Math.floor(score / 2)), summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); } };
  }
};


/* =====================================================
   CROSSY HOP — inspired by Crossy Road
   ===================================================== */
MiniGames.crossy = {
  name: 'Crossy Hop',
  icon: '🐸',
  description: 'Hop across roads, dodge cars! Arrows or WASD to move.',
  start(container, opts) {
    const COLS = 9, VISIBLE_ROWS = 8, TILE = 48;
    container.innerHTML = `
      <div class="mg-crossy">
        <div class="mg-info">
          <span>Distance: <strong id="cx-dist">0</strong></span>
        </div>
        <div class="mg-area" id="cx-area" style="height: ${VISIBLE_ROWS * TILE + 8}px;"></div>
        <p class="hint">Arrows or WASD to hop one square</p>
      </div>
    `;
    const area = container.querySelector('#cx-area');
    const distEl = container.querySelector('#cx-dist');
    const v = applyVariant(area, opts);

    let active = true, playerRow = 0, playerCol = 4, distance = 0, cameraRow = 0, rafId = null;
    const lanes = [];
    const cars = [];
    const player = document.createElement('div');
    player.id = 'cx-player';
    player.textContent = opts.avatarEmoji || '🐸';
    function generateLane(idx) {
      if (idx === 0) { lanes[idx] = { type: 'grass' }; return; }
      const isRoad = Math.random() < 0.65;
      lanes[idx] = { type: isRoad ? 'road' : 'grass' };
      if (isRoad) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = (1.4 + Math.random() * 1.6) * v.speedMul * dir;
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const el = document.createElement('div');
          el.className = 'cx-car';
          el.textContent = dir > 0 ? '🚗' : '🚙';
          area.appendChild(el);
          cars.push({ el, row: idx, x: Math.random() * COLS * TILE, vx: speed });
        }
      }
    }
    for (let r = 0; r < VISIBLE_ROWS + 3; r++) generateLane(r);

    function renderLanes() {
      area.querySelectorAll('.cx-lane').forEach(e => e.remove());
      for (let r = cameraRow; r < cameraRow + VISIBLE_ROWS; r++) {
        const lane = lanes[r];
        if (!lane) continue;
        const div = document.createElement('div');
        div.className = 'cx-lane cx-' + lane.type;
        div.style.top = ((VISIBLE_ROWS - 1 - (r - cameraRow)) * TILE) + 'px';
        div.style.height = TILE + 'px';
        area.appendChild(div);
      }
      area.appendChild(player);
    }
    renderLanes();

    function placePlayer() {
      player.style.left = (playerCol * TILE + TILE / 2 - 22) + 'px';
      player.style.top = ((VISIBLE_ROWS - 1 - (playerRow - cameraRow)) * TILE + 6) + 'px';
    }
    placePlayer();

    function hop(dr, dc) {
      if (!active) return;
      const newRow = playerRow + dr, newCol = playerCol + dc;
      if (newCol < 0 || newCol >= COLS || newRow < 0) return;
      playerRow = newRow; playerCol = newCol;
      if (playerRow > distance) {
        distance = playerRow;
        distEl.textContent = distance;
      }
      const desiredCamera = Math.max(0, playerRow - (VISIBLE_ROWS - 3));
      if (desiredCamera > cameraRow) {
        cameraRow = desiredCamera;
        while (lanes.length < cameraRow + VISIBLE_ROWS + 3) generateLane(lanes.length);
        renderLanes();
      }
      placePlayer();
    }
    const onKey = e => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') { hop(1, 0); e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { hop(-1, 0); e.preventDefault(); }
      else if (k === 'arrowleft' || k === 'a') { hop(0, -1); e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { hop(0, 1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    function tick() {
      if (!active) return;
      for (const car of cars) {
        car.x += car.vx;
        if (car.x < -100) car.x = COLS * TILE + 50;
        if (car.x > COLS * TILE + 100) car.x = -50;
        const visIdx = car.row - cameraRow;
        if (visIdx >= 0 && visIdx < VISIBLE_ROWS) {
          car.el.style.display = 'block';
          car.el.style.left = car.x + 'px';
          car.el.style.top = ((VISIBLE_ROWS - 1 - visIdx) * TILE + 6) + 'px';
        } else {
          car.el.style.display = 'none';
        }
        const carCol = (car.x + 24) / TILE;
        if (car.row === playerRow && Math.abs(carCol - playerCol) < 0.85) { end(); return; }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      opts.onEnd({ score: distance, diamonds: Math.max(5, distance * 2), summary: `Hopped ${distance} squares` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   DOODLE CLIMB — inspired by Doodle Jump
   ===================================================== */
MiniGames.climb = {
  name: 'Doodle Climb',
  icon: '🦘',
  description: 'Auto-jump higher! Move left/right to land on platforms.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-climb">
        <div class="mg-info">
          <span>Height: <strong id="cl-h">0</strong></span>
        </div>
        <div class="mg-area" id="cl-area">
          <div id="cl-player">${opts.avatarEmoji || '🦘'}</div>
        </div>
        <p class="hint">← → arrows or move your mouse</p>
      </div>
    `;
    const area = container.querySelector('#cl-area');
    const player = container.querySelector('#cl-player');
    const heightEl = container.querySelector('#cl-h');
    const v = applyVariant(area, opts);

    const PLATFORM_W = 80, PLAYER_SIZE = 50;
    let active = true, heightMax = 0, vy = 0, playerX = 0.5, playerY = 80, camera = 0, rafId = null;
    const keys = { left: false, right: false };
    const platforms = [];

    function makePlatform(x, y) {
      const el = document.createElement('div');
      el.className = 'cl-platform';
      el.style.left = x + 'px';
      el.style.width = PLATFORM_W + 'px';
      area.appendChild(el);
      return { el, x, y };
    }
    requestAnimationFrame(() => {
      const w = area.clientWidth, h = area.clientHeight;
      platforms.push(makePlatform(w / 2 - PLATFORM_W / 2, 40));
      for (let y = 100; y < h * 4; y += 50 + Math.random() * 50) {
        platforms.push(makePlatform(Math.random() * (w - PLATFORM_W), y));
      }
      placeAll();
    });
    function placeAll() {
      const w = area.clientWidth;
      player.style.left = (playerX * (w - PLAYER_SIZE)) + 'px';
      player.style.bottom = (playerY - camera) + 'px';
      for (const p of platforms) p.el.style.bottom = (p.y - camera) + 'px';
    }
    const onKey = (e, down) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
      else return;
      e.preventDefault();
    };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const onMouse = e => {
      const rect = area.getBoundingClientRect();
      playerX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    };
    area.addEventListener('mousemove', onMouse);

    function tick() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      if (keys.left) playerX = clamp(playerX - 0.02, 0, 1);
      if (keys.right) playerX = clamp(playerX + 0.02, 0, 1);
      vy -= 0.45;
      playerY += vy;
      if (vy < 0) {
        const pLeft = playerX * (w - PLAYER_SIZE);
        const pRight = pLeft + PLAYER_SIZE;
        for (const p of platforms) {
          if (playerY <= p.y + 16 && playerY >= p.y - 5 &&
              pRight > p.x && pLeft < p.x + PLATFORM_W) {
            vy = 12 * v.speedMul;
            playerY = p.y + 5;
            break;
          }
        }
      }
      if (playerY > heightMax) {
        heightMax = playerY;
        heightEl.textContent = Math.floor(heightMax / 10);
      }
      if (playerY - camera > h * 0.55) camera = playerY - h * 0.45;
      const top = platforms[platforms.length - 1];
      while (top && platforms[platforms.length - 1].y < camera + h * 1.5) {
        const newY = platforms[platforms.length - 1].y + 50 + Math.random() * 55;
        platforms.push(makePlatform(Math.random() * (w - PLATFORM_W), newY));
      }
      for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y < camera - 120) { platforms[i].el.remove(); platforms.splice(i, 1); }
      }
      placeAll();
      if (playerY - camera < -50) { end(); return; }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      const score = Math.floor(heightMax / 10);
      opts.onEnd({ score, diamonds: Math.max(5, score), summary: `Climbed ${score}m` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); } };
  }
};


/* =====================================================
   COLOR SWITCH — inspired by Color Switch
   ===================================================== */
MiniGames.color_switch = {
  name: 'Color Switch',
  icon: '🔴',
  description: 'Tap to switch the ball\'s colour. Match the rings to pass through!',
  start(container, opts) {
    const COLORS = ['#ef4444', '#fbbf24', '#10b981', '#3b82f6'];
    container.innerHTML = `
      <div class="mg-cs">
        <div class="mg-info">
          <span>Rings: <strong id="cs-score">0</strong></span>
        </div>
        <div class="mg-area" id="cs-area">
          <div id="cs-ball"></div>
        </div>
        <p class="hint">Tap, click, or SPACE to switch colour</p>
      </div>
    `;
    const area = container.querySelector('#cs-area');
    const ball = container.querySelector('#cs-ball');
    const scoreEl = container.querySelector('#cs-score');
    const v = applyVariant(area, opts);

    let active = true, score = 0, ballIdx = 0, rafId = null;
    const rings = [];
    function setBallColor() { ball.style.background = COLORS[ballIdx]; }
    setBallColor();
    function switchColor() {
      if (!active) return;
      ballIdx = (ballIdx + 1) % COLORS.length;
      setBallColor();
    }
    area.addEventListener('mousedown', switchColor);
    area.addEventListener('touchstart', e => { switchColor(); e.preventDefault(); }, { passive: false });
    const onKey = e => { if (e.code === 'Space') { switchColor(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey);

    function spawn() {
      if (!active) return;
      const ring = document.createElement('div');
      ring.className = 'cs-ring';
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      ring.style.borderColor = color;
      ring.style.top = area.clientHeight + 'px';
      area.appendChild(ring);
      rings.push({ el: ring, y: area.clientHeight, color, checked: false });
      setTimeout(spawn, (1000 + Math.random() * 400) / v.spawnMul);
    }
    setTimeout(spawn, 600);

    function tick() {
      if (!active) return;
      const ballY = area.clientHeight / 2;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.y -= 2 * v.speedMul;
        r.el.style.top = r.y + 'px';
        if (!r.checked && r.y < ballY - 10 && r.y > ballY - 35) {
          r.checked = true;
          if (r.color === COLORS[ballIdx]) {
            score += 5;
            scoreEl.textContent = score;
            r.el.classList.add('cs-pass');
          } else {
            r.el.classList.add('cs-fail');
            end();
            return;
          }
        }
        if (r.y < -100) { r.el.remove(); rings.splice(i, 1); }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      opts.onEnd({ score, diamonds: Math.max(3, score * 3), summary: `Passed ${score} rings` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   MAZE RUN — find the exit
   ===================================================== */
MiniGames.maze = {
  name: 'Maze Run',
  icon: '🌀',
  description: 'Find the exit! Use arrows or WASD. How many mazes can you solve?',
  start(container, opts) {
    const SIZE = 11;
    container.innerHTML = `
      <div class="mg-maze">
        <div class="mg-info">
          <span>Solved: <strong id="mz-solved">0</strong></span>
          <span>Time: <strong id="mz-time">60</strong>s</span>
        </div>
        <div class="maze-grid" id="mz-grid" style="grid-template-columns: repeat(${SIZE}, 1fr); width: min(440px, 100%);"></div>
        <p class="hint">Arrows or WASD to move</p>
      </div>
    `;
    const grid = container.querySelector('#mz-grid');
    const solvedEl = container.querySelector('#mz-solved');
    const timeEl = container.querySelector('#mz-time');
    const v = applyVariant(grid, opts);

    let solved = 0, timeLeft = 60, active = true;
    let maze = null, playerR = 1, playerC = 1, exitR = 1, exitC = 1;

    function generate() {
      maze = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 1));
      const stack = [[1, 1]];
      maze[1][1] = 0;
      while (stack.length) {
        const [r, c] = stack[stack.length - 1];
        const candidates = shuffle([[-2, 0], [2, 0], [0, -2], [0, 2]]);
        let advanced = false;
        for (const [dr, dc] of candidates) {
          const nr = r + dr, nc = c + dc;
          if (nr > 0 && nr < SIZE - 1 && nc > 0 && nc < SIZE - 1 && maze[nr][nc] === 1) {
            maze[r + dr / 2][c + dc / 2] = 0;
            maze[nr][nc] = 0;
            stack.push([nr, nc]);
            advanced = true;
            break;
          }
        }
        if (!advanced) stack.pop();
      }
      playerR = 1; playerC = 1;
      let maxDist = 0;
      for (let r = 1; r < SIZE - 1; r += 2) {
        for (let c = 1; c < SIZE - 1; c += 2) {
          if (maze[r][c] === 0) {
            const d = Math.abs(r - 1) + Math.abs(c - 1);
            if (d > maxDist) { maxDist = d; exitR = r; exitC = c; }
          }
        }
      }
    }
    function render() {
      grid.innerHTML = '';
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cell = document.createElement('div');
          cell.className = 'maze-cell ' + (maze[r][c] === 1 ? 'wall' : 'path');
          if (r === playerR && c === playerC) cell.classList.add('player');
          else if (r === exitR && c === exitC) cell.classList.add('exit');
          grid.appendChild(cell);
        }
      }
    }
    function move(dr, dc) {
      if (!active) return;
      const nr = playerR + dr, nc = playerC + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return;
      if (maze[nr][nc] === 1) return;
      playerR = nr; playerC = nc;
      render();
      if (playerR === exitR && playerC === exitC) {
        solved += 1;
        solvedEl.textContent = solved;
        generate();
        render();
      }
    }
    const onKey = e => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') { move(-1, 0); e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { move(1, 0); e.preventDefault(); }
      else if (k === 'arrowleft' || k === 'a') { move(0, -1); e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { move(0, 1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    generate();
    render();
    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000 / v.speedMul);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      opts.onEnd({ score: solved, diamonds: solved * 15, summary: `Solved ${solved} maze${solved === 1 ? '' : 's'}` });
    }
    return { cleanup() { active = false; clearInterval(timer); window.removeEventListener('keydown', onKey); } };
  }
};


/* =====================================================
   PLINKO DROP — inspired by Plinko / The Price is Right
   ===================================================== */
MiniGames.plinko = {
  name: 'Plinko Drop',
  icon: '🎯',
  description: 'Aim and drop balls through the pegs into the high-score slots!',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-plinko">
        <div class="mg-info">
          <span>Balls: <strong id="pk-balls">10</strong></span>
          <span>Score: <strong id="pk-score">0</strong></span>
        </div>
        <div class="mg-area" id="pk-area">
          <div id="pk-aim"></div>
        </div>
        <p class="hint">Move mouse to aim, click to drop</p>
      </div>
    `;
    const area = container.querySelector('#pk-area');
    const aim = container.querySelector('#pk-aim');
    const ballsEl = container.querySelector('#pk-balls');
    const scoreEl = container.querySelector('#pk-score');
    const v = applyVariant(area, opts);

    let active = true, ballsLeft = 10, score = 0, aimX = 0.5, setupDone = false, rafId = null;
    const balls = [], pegs = [], slots = [];

    function setup() {
      const w = area.clientWidth, h = area.clientHeight;
      const ROWS = 8, COLS = 9;
      const sx = w / (COLS + 1), sy = (h - 100) / (ROWS + 1);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const offX = (r % 2) ? sx / 2 : 0;
          const x = (c + 1) * sx + offX;
          const y = 50 + (r + 1) * sy;
          const el = document.createElement('div');
          el.className = 'pk-peg';
          el.style.left = (x - 5) + 'px';
          el.style.top = (y - 5) + 'px';
          area.appendChild(el);
          pegs.push({ x, y });
        }
      }
      const vals = [10, 5, 2, 1, 25, 1, 2, 5, 10];
      const sw = w / vals.length;
      for (let i = 0; i < vals.length; i++) {
        const el = document.createElement('div');
        el.className = 'pk-slot';
        el.style.left = (i * sw) + 'px';
        el.style.width = sw + 'px';
        el.textContent = vals[i];
        area.appendChild(el);
        slots.push({ x: i * sw, w: sw, value: vals[i], el });
      }
      setupDone = true;
    }
    requestAnimationFrame(() => { setup(); placeAim(); });
    function placeAim() {
      aim.style.left = (aimX * area.clientWidth - 8) + 'px';
    }
    area.addEventListener('mousemove', e => {
      const rect = area.getBoundingClientRect();
      aimX = clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95);
      placeAim();
    });
    area.addEventListener('mousedown', () => {
      if (!active || ballsLeft <= 0) return;
      ballsLeft--;
      ballsEl.textContent = ballsLeft;
      const el = document.createElement('div');
      el.className = 'pk-ball';
      area.appendChild(el);
      balls.push({ el, x: aimX * area.clientWidth, y: 20, vx: 0, vy: 0 });
    });

    function tick() {
      if (!active) { return; }
      if (!setupDone) { rafId = requestAnimationFrame(tick); return; }
      const w = area.clientWidth, h = area.clientHeight;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.vy += 0.3 * v.speedMul;
        b.x += b.vx; b.y += b.vy;
        for (const p of pegs) {
          const dx = b.x - p.x, dy = b.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 12) {
            const nx = dx / d, ny = dy / d;
            b.x = p.x + nx * 12;
            b.y = p.y + ny * 12;
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.7;
            b.vy = (b.vy - 2 * dot * ny) * 0.7;
            b.vx += (Math.random() - 0.5) * 0.6;
          }
        }
        if (b.x < 5) { b.x = 5; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > w - 5) { b.x = w - 5; b.vx = -Math.abs(b.vx) * 0.5; }
        b.el.style.left = (b.x - 6) + 'px';
        b.el.style.top = (b.y - 6) + 'px';
        if (b.y > h - 40) {
          for (const s of slots) {
            if (b.x >= s.x && b.x < s.x + s.w) {
              score += s.value;
              scoreEl.textContent = score;
              s.el.classList.add('hit');
              setTimeout(() => s.el.classList.remove('hit'), 300);
              break;
            }
          }
          b.el.remove();
          balls.splice(i, 1);
          if (ballsLeft === 0 && balls.length === 0) { setTimeout(end, 600); return; }
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function end() {
      if (!active) return;
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      opts.onEnd({ score, diamonds: Math.max(5, score * 2), summary: `Total score: ${score}` });
    }
    return { cleanup() { active = false; if (rafId) cancelAnimationFrame(rafId); } };
  }
};


/* =====================================================
   TAP TARGETS — fast reaction with bonuses & traps
   ===================================================== */
MiniGames.targets = {
  name: 'Tap Targets',
  icon: '🎯',
  description: 'Tap the targets and stars — but avoid the skulls! 30 seconds.',
  start(container, opts) {
    container.innerHTML = `
      <div class="mg-targets">
        <div class="mg-info">
          <span>Time: <strong id="tg-time">30</strong>s</span>
          <span>Score: <strong id="tg-score">0</strong></span>
        </div>
        <div class="mg-area" id="tg-area"></div>
      </div>
    `;
    const area = container.querySelector('#tg-area');
    const timeEl = container.querySelector('#tg-time');
    const scoreEl = container.querySelector('#tg-score');
    const v = applyVariant(area, opts);

    let timeLeft = 30, score = 0, active = true;
    const spawnedTimers = new Set();
    function spawn() {
      if (!active) return;
      const w = area.clientWidth, h = area.clientHeight;
      const roll = Math.random();
      const kind = roll < 0.2 ? 'trap' : (roll < 0.35 ? 'bonus' : 'normal');
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tg-target ' + kind;
      el.textContent = kind === 'trap' ? '💀' : kind === 'bonus' ? '⭐' : '🎯';
      const size = 60;
      el.style.left = (Math.random() * Math.max(0, w - size)) + 'px';
      el.style.top = (Math.random() * Math.max(0, h - size)) + 'px';
      area.appendChild(el);
      const remove = setTimeout(() => el.remove(), 1400 / v.speedMul);
      spawnedTimers.add(remove);
      el.addEventListener('click', () => {
        clearTimeout(remove);
        spawnedTimers.delete(remove);
        if (!active) return;
        if (kind === 'trap') score = Math.max(0, score - 5);
        else if (kind === 'bonus') score += 10;
        else score += 3;
        scoreEl.textContent = score;
        el.classList.add('hit');
        setTimeout(() => el.remove(), 180);
      });
      setTimeout(spawn, (440 + Math.random() * 360) / v.spawnMul);
    }
    spawn();
    const timer = setInterval(() => {
      if (!active) return;
      timeLeft -= 1;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) end();
    }, 1000);
    function end() {
      if (!active) return;
      active = false;
      clearInterval(timer);
      spawnedTimers.forEach(clearTimeout);
      area.querySelectorAll('.tg-target').forEach(e => e.remove());
      opts.onEnd({ score, diamonds: Math.max(5, Math.floor(score / 2)), summary: `Score: ${score}` });
    }
    return { cleanup() { active = false; clearInterval(timer); spawnedTimers.forEach(clearTimeout); } };
  }
};


/* =====================================================
   HELPERS
   ===================================================== */
function spawnBurst(area, cx, cy) {
  const colors = ['#fbbf24', '#ff5fa2', '#4ca5ff', '#10b981', '#a855f7'];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'rxn-burst';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.color = colors[i % colors.length];
    p.style.background = colors[i % colors.length];
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 40 + Math.random() * 30;
    p.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--by', Math.sin(angle) * dist + 'px');
    area.appendChild(p);
    setTimeout(() => p.remove(), 600);
  }
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
