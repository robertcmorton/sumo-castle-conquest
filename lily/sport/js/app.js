// app.js — runtime: navigation, state, game lifecycle, results, shop, leaderboard.
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    playerCount: 0,
    nameEntry: null,
    selectedGame: null,
    runningGame: null,
    canvasResizeObserver: null,
    shopFilter: 'all',
    lbFilter: 'all',
  };

  // -------------------- NAVIGATION --------------------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
    // Mark the body so non-home screens can hide the sports-ball decor entirely.
    document.body.classList.toggle('home-active', id === 'home-screen');
    // Force scroll to top in multiple ways so the new screen always starts visible.
    try { window.scrollTo(0, 0); } catch (e) {}
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      navigateTo(target);
    });
  });

  function navigateTo(id) {
    if (id === 'shop-screen') refreshShop();
    if (id === 'leaderboard-screen') refreshLeaderboard();
    if (id === 'home-screen') refreshHome();
    if (id === 'wordle-screen') Wordle.mount();
    show(id);
  }

  // -------------------- HOME --------------------
  function refreshHome() {
    const coins = Shop.coins();
    $('home-coin-count').textContent = coins;
    // The hero Play button stretches with coin count.
    // 220px base + 1px per coin, capped to 95vw. Visible on small phones too.
    const baseW = 220;
    const desired = baseW + Math.max(0, coins);
    const vw = window.innerWidth || 360;
    const maxW = Math.floor(vw * 0.92);
    const widthPx = Math.min(maxW, desired);
    document.documentElement.style.setProperty('--play-button-w', widthPx + 'px');
    const hint = $('coin-hint');
    if (hint) hint.textContent = coins > 0 ? `(stretches the Play button)` : '';
    Themes.reset();
  }
  window.addEventListener('resize', () => {
    if ($('home-screen').classList.contains('active')) refreshHome();
  });

  // -------------------- PLAYER COUNT --------------------
  document.querySelectorAll('.count-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const n = parseInt(tile.dataset.count, 10);
      state.playerCount = n;
      const sub = $('select-player-count');
      if (sub) sub.textContent = n;
      buildNameEntry(n);
      show('player-names-screen');
    });
  });

  function buildNameEntry(n) {
    const host = $('player-list');
    state.nameEntry = Players.renderEntry(host, n);
  }

  $('names-continue-btn').addEventListener('click', () => {
    if (!state.nameEntry) return;
    const data = state.nameEntry.collect();
    Players.setActive(data);
    const c = Players.count();
    $('select-player-count').textContent = c;
    Games.renderTiles($('game-grid'), c, pickGame);
    show('game-select-screen');
  });

  // -------------------- GAME SELECT → INTRO --------------------
  function pickGame(game) {
    state.selectedGame = game;
    $('intro-icon').textContent = game.icon;
    $('intro-title').textContent = game.title;
    $('intro-theme').textContent = Themes.get(game.theme).name;
    $('intro-instructions').textContent = game.instructions;
    $('intro-controls').textContent = game.controls;
    const chips = $('intro-players');
    chips.innerHTML = '';
    Players.getActive().forEach((p, i) => {
      const c = document.createElement('span');
      c.className = 'intro-player-chip';
      c.innerHTML = `<span class="swatch" style="--player-color:${p.color}">${p.avatar.emoji}</span> ${escapeHtml(p.name)}`;
      chips.appendChild(c);
    });
    show('game-intro-screen');
  }

  $('start-game-btn').addEventListener('click', startGame);

  // -------------------- GAME RUNTIME --------------------
  function setupCanvas() {
    const canvas = $('game-canvas');
    const stage = document.getElementById('game-stage');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.runningGame && state.runningGame.onResize) {
        state.runningGame.onResize(w, h);
      }
    }
    resize();
    if (state.canvasResizeObserver) state.canvasResizeObserver.disconnect();
    state.canvasResizeObserver = new ResizeObserver(resize);
    state.canvasResizeObserver.observe(stage);

    return { canvas, ctx: canvas.getContext('2d'), get width() { return stage.clientWidth; }, get height() { return stage.clientHeight; } };
  }

  function startGame() {
    if (!state.selectedGame) return;
    const game = state.selectedGame;
    Themes.apply(game.theme);
    Input.setActivePlayerCount(Players.count());
    Input.clear();
    Input.attach();

    show('game-screen');

    $('game-title').textContent = `${game.icon} ${game.title}`;
    $('game-status').textContent = '';
    $('game-overlay').innerHTML = '';
    $('game-controller').innerHTML = '';

    // setupCanvas needs the screen to be visible first (for clientWidth/Height)
    requestAnimationFrame(() => {
      const canvasRef = setupCanvas();
      const ctx = {
        canvas: canvasRef.canvas,
        canvasCtx: canvasRef.ctx,
        get width() { return canvasRef.width; },
        get height() { return canvasRef.height; },
        players: Players.getActive(),
        controllerHost: $('game-controller'),
        themeName: game.theme,
        setStatus(s) { $('game-status').textContent = s || ''; },
        setOverlay(html, opts = {}) {
          const ov = $('game-overlay');
          if (!html) { ov.innerHTML = ''; return; }
          const cls = 'overlay-msg' + (opts.small ? ' small' : '');
          ov.innerHTML = `<div class="${cls}">${html}</div>`;
        },
        finish(results) { finishGame(results); },
      };
      const instance = game.create(ctx);
      state.runningGame = instance;
      instance.start();
    });
  }

  function stopRunningGame() {
    if (state.runningGame && state.runningGame.stop) {
      try { state.runningGame.stop(); } catch (e) { console.warn(e); }
    }
    state.runningGame = null;
    if (state.canvasResizeObserver) {
      state.canvasResizeObserver.disconnect();
      state.canvasResizeObserver = null;
    }
    Input.detach();
    Themes.reset();
  }

  $('quit-btn').addEventListener('click', () => {
    stopRunningGame();
    show('game-select-screen');
  });

  // -------------------- RESULTS --------------------
  function finishGame(rawResults) {
    stopRunningGame();
    const players = Players.getActive();

    // normalize + sort by score desc; assign places with ties
    const enriched = rawResults.map(r => ({
      playerIdx: r.playerIdx,
      score: Math.round(r.score || 0),
      displayScore: r.displayScore,
      unit: r.unit,
      name: players[r.playerIdx].name,
      color: players[r.playerIdx].color,
      avatar: players[r.playerIdx].avatar,
    }));
    enriched.sort((a, b) => b.score - a.score);
    let lastScore = null; let lastPlace = 0;
    enriched.forEach((r, i) => {
      if (lastScore === null || r.score !== lastScore) {
        lastPlace = i + 1;
        lastScore = r.score;
      }
      r.place = lastPlace;
    });

    // award coins (group pool)
    const base = 5 * enriched.length;
    let winnerBonus = 0;
    enriched.forEach(r => { if (r.place === 1) winnerBonus += 15; });
    const totalAward = base + winnerBonus;
    Shop.addCoins(totalAward);

    // record on leaderboard
    Leaderboard.recordRound(state.selectedGame.id, enriched);

    renderResults(enriched, totalAward);
    show('results-screen');
  }

  function renderResults(rows, coinsAwarded) {
    $('results-game-name').textContent = state.selectedGame.title;
    // Podium: place 1 (center), place 2 (left), place 3 (right) if present.
    const podium = $('podium');
    podium.innerHTML = '';
    const byPlace = (p) => rows.find(r => r.place === p);
    const slots = [
      { key: 2, cls: 'p2' },
      { key: 1, cls: 'p1' },
      { key: 3, cls: 'p3' },
    ];
    slots.forEach(s => {
      const r = byPlace(s.key);
      const step = document.createElement('div');
      step.className = 'podium-step ' + s.cls;
      if (r) {
        step.style.setProperty('--player-color', r.color);
        step.innerHTML = `
          <div class="pos">${r.place}</div>
          <div class="who">${r.avatar.emoji} ${escapeHtml(r.name)}</div>
          <div class="score">${escapeHtml(r.displayScore || String(r.score))}</div>
        `;
      } else {
        step.innerHTML = `<div class="pos" style="opacity:.3">—</div>`;
      }
      podium.appendChild(step);
    });

    const list = $('results-list');
    list.innerHTML = '';
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.style.setProperty('--player-color', r.color);
      row.innerHTML = `
        <span class="who">${r.place}. ${r.avatar.emoji} ${escapeHtml(r.name)}</span>
        <span class="score">${escapeHtml(r.displayScore || String(r.score))}</span>
      `;
      list.appendChild(row);
    });

    $('coin-earned').innerHTML = `+ ${coinsAwarded} 🪙 to the group pool`;
  }

  $('play-again-btn').addEventListener('click', startGame);
  $('pick-another-btn').addEventListener('click', () => {
    Games.renderTiles($('game-grid'), Players.count(), pickGame);
    show('game-select-screen');
  });
  $('results-home-btn').addEventListener('click', () => navigateTo('home-screen'));

  // -------------------- SHOP --------------------
  function refreshShop() {
    $('shop-coin-count').textContent = Shop.coins();
    Shop.renderGrid($('avatar-grid'), state.shopFilter, onAvatarPick);
  }
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.shopFilter = btn.dataset.filter;
      refreshShop();
    });
  });
  function onAvatarPick(a) {
    if (Shop.isOwned(a.id)) {
      toast(`You own ${a.name}.`);
      return;
    }
    if (Shop.coins() < a.price) {
      toast(`Need ${a.price - Shop.coins()} more 🪙`);
      return;
    }
    const res = Shop.buy(a.id);
    toast(res.msg);
    refreshShop();
  }

  // -------------------- LEADERBOARD --------------------
  function refreshLeaderboard() {
    Leaderboard.renderList($('leaderboard-list'), state.lbFilter);
  }
  document.querySelectorAll('[data-lb-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-lb-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.lbFilter = btn.dataset.lbFilter;
      refreshLeaderboard();
    });
  });

  // -------------------- SETTINGS --------------------
  $('setting-sound').checked = Storage.get('sound', true);
  $('setting-haptics').checked = Storage.get('haptics', true);
  $('setting-sound').addEventListener('change', e => Storage.set('sound', e.target.checked));
  $('setting-haptics').addEventListener('change', e => Storage.set('haptics', e.target.checked));
  $('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all progress? This clears coins, avatars, and leaderboard.')) {
      Storage.clearAll();
      toast('All progress cleared.');
      refreshHome();
      navigateTo('home-screen');
    }
  });

  // -------------------- TOAST --------------------
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // -------------------- INIT --------------------
  refreshHome();
  window.LPS = { state, navigateTo, toast };
})();
