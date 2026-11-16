// Main game controller.
const App = {
  // 9 mini-games — all non-number, all inspired by real App Store games.
  // Cycle won't repeat for 9 levels straight.
  miniGameOrder: [
    'reaction',    // Star Catcher
    'fruit_slice', // Fruit Ninja
    'memory',      // Memory Match
    'sky_hop',     // Flappy Bird
    'dodge',       // Treat Catcher
    'stack_it',    // Stack
    'pattern',     // Simon Says
    'geo_dash',    // Geometry Dash
    'snake'        // Snake
  ],

  state: null,
  currentMiniGame: null,
  currentMath: null,
  shopOrigin: 'home',
  pendingTier: null, // tier object queued for tier-up screen

  init() {
    this.state = Storage.load();
    Numerdle.syncForToday(this.state.daily);
    Storage.save(this.state);
    this.bindUI();
    this.refreshAll();
    this.showScreen('home-screen');
  },

  bindUI() {
    document.getElementById('play-btn').addEventListener('click', () => this.openLevelIntro());
    document.getElementById('daily-btn').addEventListener('click', () => this.openDaily());
    document.getElementById('shop-btn').addEventListener('click', () => this.openShop('home'));
    document.getElementById('leaderboard-btn').addEventListener('click', () => this.openLeaderboard());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetProgress());

    document.getElementById('back-home-btn').addEventListener('click', () => this.showScreen('home-screen'));
    document.getElementById('start-level-btn').addEventListener('click', () => this.beginMiniGame());
    document.getElementById('quit-btn').addEventListener('click', () => this.quitMiniGame());
    document.getElementById('submit-answer-btn').addEventListener('click', () => this.checkMathAnswer());
    document.getElementById('math-answer').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.checkMathAnswer(); }
    });

    document.getElementById('post-level-shop-btn').addEventListener('click', () => this.openShop('post-level'));
    document.getElementById('shop-back-btn').addEventListener('click', () => this.exitShop());

    document.getElementById('tierup-continue-btn').addEventListener('click', () => this.continueAfterTier());

    document.getElementById('daily-back-btn').addEventListener('click', () => this.showScreen('home-screen'));
    document.getElementById('leaderboard-back-btn').addEventListener('click', () => this.showScreen('home-screen'));

    this.bindNumpad();
    this.bindShopFilters();
  },

  bindNumpad() {
    const pad = document.getElementById('numpad');
    if (!pad) return;
    pad.addEventListener('click', e => {
      const btn = e.target.closest('.numpad-key');
      if (!btn) return;
      const key = btn.dataset.key;
      const input = document.getElementById('math-answer');
      if (key === 'clear') {
        input.value = input.value.slice(0, -1);
        const feedback = document.getElementById('math-feedback');
        if (feedback.classList.contains('wrong')) {
          feedback.textContent = '';
          feedback.className = 'math-feedback';
        }
      } else if (key === 'enter') {
        this.checkMathAnswer();
      } else if (input.value.length < 5) {
        input.value = input.value + key;
      }
    });
  },

  bindShopFilters() {
    const wrap = document.getElementById('shop-filters');
    if (!wrap) return;
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      wrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Shop.setFilter(btn.dataset.filter);
      this.renderShop();
    });
  },

  /* ---------- Level config ---------- */
  // Levels are themed variants of base games — see js/levels.js.
  // 9 base games × 12 themes × 2 difficulty tiers = up to 216 unique levels.
  getLevelConfig(levelNum) {
    const level = Levels.get(levelNum);
    return {
      level: levelNum,
      levelData: level,
      miniGameId: level.gameId,
      mathLevel: levelNum
    };
  },

  /* ---------- Screen routing ---------- */
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  /* ---------- HUD / home refresh ---------- */
  refreshAll() {
    this.refreshHUD();
    this.refreshHome();
  },

  refreshHUD() {
    document.getElementById('diamond-count').textContent = this.state.diamonds.toLocaleString();
    document.getElementById('level-count').textContent = this.state.level;
    const av = getAvatar(this.state.selectedAvatar);
    document.getElementById('avatar-display').textContent = av.emoji;
    document.getElementById('profile-avatar').textContent = av.emoji;

    const tier = Tiers.forLevel(this.state.level);
    const hudTier = document.getElementById('hud-tier');
    hudTier.className = 'tier-chip tier-' + tier.id;
    document.getElementById('hud-tier-icon').textContent = tier.icon;
    document.getElementById('hud-tier-name').textContent = tier.name;

    document.getElementById('shop-diamond-count').textContent = this.state.diamonds.toLocaleString();
  },

  refreshHome() {
    const tier = Tiers.forLevel(this.state.level);
    document.getElementById('profile-level').textContent = this.state.level;

    // Rank banner — big and bold
    const rankBanner = document.getElementById('rank-banner');
    rankBanner.className = 'rank-banner tier-' + tier.id;
    document.getElementById('rank-medal').textContent = tier.icon;
    document.getElementById('rank-name').textContent = tier.name;

    // Tier progress
    const prog = Tiers.progress(this.state.level);
    const fill = document.getElementById('tier-progress-fill');
    fill.style.width = (prog.fraction * 100).toFixed(1) + '%';
    const label = document.getElementById('tier-progress-label');
    if (prog.next) {
      label.textContent = `Next: ${prog.next.icon} ${prog.next.name} in ${prog.levelsToGo} level${prog.levelsToGo === 1 ? '' : 's'}`;
    } else {
      label.textContent = 'Maximum tier reached! 👑';
    }

    // Next level preview — show the variant name (e.g. "Cosmic Snake")
    const cfg = this.getLevelConfig(this.state.level);
    document.getElementById('home-level-num').textContent = cfg.level;
    document.getElementById('home-game-name').textContent = cfg.levelData.name;

    // Daily status
    Numerdle.syncForToday(this.state.daily);
    const dailyStatus = document.getElementById('daily-status');
    const dailyBadge = document.getElementById('daily-badge');
    if (this.state.daily.solved) {
      dailyStatus.textContent = `Solved! 🔥 ${this.state.daily.streak}-day streak`;
      dailyBadge.hidden = true;
    } else if (this.state.daily.failed) {
      dailyStatus.textContent = 'Tomorrow brings a new puzzle';
      dailyBadge.hidden = true;
    } else if (this.state.daily.guesses.length > 0) {
      dailyStatus.textContent = `In progress (${this.state.daily.guesses.length}/${Numerdle.MAX_GUESSES})`;
      dailyBadge.hidden = true;
    } else {
      dailyStatus.textContent = 'Numerdle awaits!';
      dailyBadge.hidden = false;
    }

    // Shop count
    document.getElementById('shop-sub').textContent = `Owned: ${this.state.ownedAvatars.length}`;

    // Leaderboard hint
    const ranks = Leaderboard.rankings(this.state);
    const myRank = ranks.findIndex(p => p.isMe) + 1;
    document.getElementById('leaderboard-sub').textContent = `You're #${myRank} of ${ranks.length}`;

    // Stats row
    document.getElementById('stat-games').textContent = this.state.stats.gamesPlayed.toLocaleString();
    document.getElementById('stat-streak').textContent = `${this.state.daily.streak} 🔥`;
    document.getElementById('stat-best').textContent = Math.max(this.state.level, this.state.stats.highestLevel);
    document.getElementById('stat-avatars').textContent = this.state.ownedAvatars.length;
  },

  setRankStrip(stripId, medalId, nameId) {
    const tier = Tiers.forLevel(this.state.level);
    const strip = document.getElementById(stripId);
    if (!strip) return;
    strip.className = 'rank-strip tier-' + tier.id;
    document.getElementById(medalId).textContent = tier.icon;
    document.getElementById(nameId).textContent = tier.name;
  },

  /* ---------- Level flow ---------- */
  openLevelIntro() {
    const cfg = this.getLevelConfig(this.state.level);
    const mg = MiniGames[cfg.miniGameId];
    const level = cfg.levelData;
    document.getElementById('intro-level-num').textContent = cfg.level;
    document.getElementById('intro-game-name').textContent = level.name;
    document.getElementById('intro-icon').textContent = level.icon || mg.icon;
    const tierNote = level.tier > 0 ? ` This is a ${level.tierLabel} variant — faster than normal!` : '';
    document.getElementById('intro-instructions').textContent = mg.description + tierNote;
    this.setRankStrip('intro-rank-strip', 'intro-rank-medal', 'intro-rank-name');
    this.showScreen('level-intro-screen');
  },

  beginMiniGame() {
    const cfg = this.getLevelConfig(this.state.level);
    const mg = MiniGames[cfg.miniGameId];
    const level = cfg.levelData;
    document.getElementById('game-status').textContent = `Level ${cfg.level} — ${level.name}`;
    const canvas = document.getElementById('game-canvas');
    canvas.innerHTML = '';
    this.showScreen('game-screen');
    const av = getAvatar(this.state.selectedAvatar);
    this.currentMiniGame = mg.start(canvas, {
      avatarEmoji: av.emoji,
      variant: level.params,
      onEnd: result => this.onMiniGameEnd(result)
    });
  },

  quitMiniGame() {
    if (this.currentMiniGame && this.currentMiniGame.cleanup) this.currentMiniGame.cleanup();
    this.currentMiniGame = null;
    document.getElementById('game-canvas').innerHTML = '';
    this.showScreen('home-screen');
  },

  onMiniGameEnd(result) {
    this.currentMiniGame = null;
    document.getElementById('game-canvas').innerHTML = '';

    this.state.diamonds += result.diamonds;
    this.state.stats.gamesPlayed += 1;
    Storage.save(this.state);
    this.refreshHUD();

    const cfg = this.getLevelConfig(this.state.level);
    this.currentMath = MathGate.generate(cfg.mathLevel);

    document.getElementById('diamonds-earned').textContent = result.diamonds;
    const completedName = cfg.levelData.name;
    document.getElementById('round-summary').textContent =
      `Completed ${completedName}${result.summary ? ' • ' + result.summary : ''}`;
    document.getElementById('next-level-num').textContent = this.state.level + 1;
    document.getElementById('math-question').textContent = this.currentMath.question;
    const input = document.getElementById('math-answer');
    input.value = '';
    input.classList.remove('shake');
    const feedback = document.getElementById('math-feedback');
    feedback.textContent = '';
    feedback.className = 'math-feedback';

    this.setRankStrip('complete-rank-strip', 'complete-rank-medal', 'complete-rank-name');
    this.showScreen('level-complete-screen');
    if (!('ontouchstart' in window)) setTimeout(() => input.focus(), 120);
  },

  checkMathAnswer() {
    const input = document.getElementById('math-answer');
    const feedback = document.getElementById('math-feedback');
    const value = input.value.trim();

    if (value === '') {
      feedback.textContent = 'Type your answer first!';
      feedback.className = 'math-feedback hint';
      return;
    }
    const guess = Number(value);
    if (!Number.isFinite(guess)) {
      feedback.textContent = 'Numbers only please.';
      feedback.className = 'math-feedback hint';
      return;
    }

    this.state.stats.mathAttempts += 1;
    if (guess === this.currentMath.answer) {
      this.state.stats.mathCorrect += 1;
      this.state.diamonds += 5;
      const oldLevel = this.state.level;
      this.state.level += 1;
      if (this.state.level > this.state.stats.highestLevel) {
        this.state.stats.highestLevel = this.state.level;
      }
      const crossedTier = Tiers.crossedTier(oldLevel, this.state.level);
      if (crossedTier && crossedTier.reward) {
        this.pendingTier = crossedTier;
      }
      Storage.save(this.state);
      this.refreshHUD();
      feedback.textContent = `Correct! +5 💎 — heading to Level ${this.state.level}...`;
      feedback.className = 'math-feedback correct';
      this.launchConfetti();
      setTimeout(() => {
        if (this.pendingTier) {
          this.showTierUp(this.pendingTier);
        } else {
          this.refreshHome();
          this.showScreen('home-screen');
        }
      }, 1800);
    } else {
      feedback.textContent = 'Not quite — try again!';
      feedback.className = 'math-feedback wrong';
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      input.select();
      Storage.save(this.state);
    }
  },

  /* ---------- Tier-up ---------- */
  showTierUp(tier) {
    // Award reward
    this.state.diamonds += tier.reward.diamonds;
    if (tier.reward.avatarId && !this.state.ownedAvatars.includes(tier.reward.avatarId)) {
      this.state.ownedAvatars.push(tier.reward.avatarId);
    }
    this.state.tierId = tier.id;
    Storage.save(this.state);
    this.refreshHUD();

    const banner = document.getElementById('tierup-banner');
    banner.style.borderColor = ({
      bronze: '#b45309', silver: '#64748b', gold: '#ca8a04',
      platinum: '#0891b2', diamond: '#1d4ed8', master: '#7e22ce'
    })[tier.id] || '#fbbf24';

    document.getElementById('tierup-medal').textContent = tier.icon;
    document.getElementById('tierup-name').textContent = tier.name;
    const newAvatar = getAvatar(tier.reward.avatarId);
    document.getElementById('tierup-reward').innerHTML =
      `+${tier.reward.diamonds.toLocaleString()} 💎 &nbsp; • &nbsp; new avatar ${newAvatar.emoji} ${newAvatar.name}`;
    document.querySelector('.tierup-name').style.background =
      getComputedStyle(document.documentElement).getPropertyValue('--tier-' + tier.id);
    document.querySelector('.tierup-name').style.webkitBackgroundClip = 'text';
    document.querySelector('.tierup-name').style.backgroundClip = 'text';

    this.showScreen('tierup-screen');
    this.launchConfetti(120);
  },

  continueAfterTier() {
    this.pendingTier = null;
    this.refreshAll();
    this.showScreen('home-screen');
  },

  /* ---------- Daily Numerdle ---------- */
  openDaily() {
    Numerdle.syncForToday(this.state.daily);
    Storage.save(this.state);
    this.renderDaily();
    this.showScreen('daily-screen');
  },

  renderDaily() {
    const daily = this.state.daily;
    document.getElementById('daily-streak').textContent = daily.streak;
    document.getElementById('daily-date').textContent = Numerdle.prettyDate();

    const board = document.getElementById('numerdle-board');
    board.innerHTML = '';
    const currentRow = daily.guesses.length;
    for (let r = 0; r < Numerdle.MAX_GUESSES; r++) {
      const row = document.createElement('div');
      row.className = 'numerdle-row';
      const guess = daily.guesses[r];
      for (let c = 0; c < Numerdle.LENGTH; c++) {
        const cell = document.createElement('div');
        cell.className = 'numerdle-cell';
        if (guess) {
          cell.textContent = guess.digits[c];
          cell.classList.add(guess.result[c]);
        } else if (r === currentRow) {
          cell.classList.add('active');
          if (this._draft && c < this._draft.length) {
            cell.textContent = this._draft[c];
            cell.classList.add('filled');
          }
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    }

    const msg = document.getElementById('numerdle-message');
    if (daily.solved) {
      msg.textContent = `Solved in ${daily.guesses.length}! +${Numerdle.computeReward(daily.guesses.length)} 💎 earned today.`;
      msg.className = 'numerdle-message win';
    } else if (daily.failed) {
      msg.textContent = `The answer was ${daily.answer}. Come back tomorrow!`;
      msg.className = 'numerdle-message lose';
    } else {
      msg.textContent = '';
      msg.className = 'numerdle-message';
    }

    this.renderNumerdleKeyboard();
  },

  renderNumerdleKeyboard() {
    const kb = document.getElementById('numerdle-keyboard');
    kb.innerHTML = '';
    const daily = this.state.daily;
    const finished = daily.solved || daily.failed;

    // Aggregate best status per digit
    const best = {};
    const rank = { absent: 1, present: 2, correct: 3 };
    for (const g of daily.guesses) {
      for (let i = 0; i < g.digits.length; i++) {
        const d = g.digits[i], s = g.result[i];
        if (!best[d] || rank[s] > rank[best[d]]) best[d] = s;
      }
    }

    const digits = ['1','2','3','4','5','6','7','8','9','0'];
    digits.forEach(d => {
      const k = document.createElement('button');
      k.className = 'numerdle-key';
      k.type = 'button';
      k.textContent = d;
      if (best[d]) k.classList.add(best[d]);
      if (finished) k.disabled = true;
      k.addEventListener('click', () => this.numerdleType(d));
      kb.appendChild(k);
    });
    const del = document.createElement('button');
    del.className = 'numerdle-key del wide';
    del.type = 'button';
    del.textContent = '⌫';
    del.addEventListener('click', () => this.numerdleDelete());
    if (finished) del.disabled = true;
    kb.appendChild(del);

    const enter = document.createElement('button');
    enter.className = 'numerdle-key enter wide';
    enter.type = 'button';
    enter.textContent = 'Enter';
    enter.addEventListener('click', () => this.numerdleSubmit());
    if (finished) enter.disabled = true;
    kb.appendChild(enter);
  },

  numerdleType(d) {
    if (this.state.daily.solved || this.state.daily.failed) return;
    this._draft = this._draft || '';
    if (this._draft.length < Numerdle.LENGTH) {
      this._draft += d;
      this.renderDaily();
    }
  },

  numerdleDelete() {
    if (this.state.daily.solved || this.state.daily.failed) return;
    this._draft = (this._draft || '').slice(0, -1);
    this.renderDaily();
  },

  numerdleSubmit() {
    const daily = this.state.daily;
    if (daily.solved || daily.failed) return;
    const draft = this._draft || '';
    if (draft.length !== Numerdle.LENGTH) {
      const msg = document.getElementById('numerdle-message');
      msg.textContent = `Enter ${Numerdle.LENGTH} digits.`;
      msg.className = 'numerdle-message';
      return;
    }
    const result = Numerdle.evaluate(draft, daily.answer);
    daily.guesses.push({ digits: draft, result });
    this._draft = '';

    if (result.every(r => r === 'correct')) {
      daily.solved = true;
      const reward = Numerdle.computeReward(daily.guesses.length);
      this.state.diamonds += reward;
      const today = Numerdle.todayKey();
      // Streak: if yesterday was completed, +1; else reset to 1
      if (daily.lastCompletedDate === Numerdle.yesterdayKey()) {
        daily.streak += 1;
      } else {
        daily.streak = 1;
      }
      daily.lastCompletedDate = today;
      this.state.stats = this.state.stats || {};
      Storage.save(this.state);
      this.refreshHUD();
      this.launchConfetti(100);
    } else if (daily.guesses.length >= Numerdle.MAX_GUESSES) {
      daily.failed = true;
      daily.streak = 0;
      Storage.save(this.state);
    } else {
      Storage.save(this.state);
    }
    this.renderDaily();
  },

  /* ---------- Shop ---------- */
  openShop(origin) {
    this.shopOrigin = origin;
    this.renderShop();
    this.showScreen('shop-screen');
  },

  renderShop() {
    const container = document.getElementById('avatar-grid');
    Shop.render(container, this.state, {
      onBuy: av => this.buyAvatar(av),
      onSelect: av => this.selectAvatar(av)
    });
    document.getElementById('shop-diamond-count').textContent = this.state.diamonds.toLocaleString();
  },

  buyAvatar(av) {
    if (this.state.ownedAvatars.includes(av.id)) return;
    if (av.tier) return; // tier rewards are not for sale
    if (this.state.diamonds < av.cost) return;
    this.state.diamonds -= av.cost;
    this.state.ownedAvatars.push(av.id);
    this.state.selectedAvatar = av.id;
    Storage.save(this.state);
    this.refreshHUD();
    this.renderShop();
  },

  selectAvatar(av) {
    if (!this.state.ownedAvatars.includes(av.id)) return;
    this.state.selectedAvatar = av.id;
    Storage.save(this.state);
    this.refreshHUD();
    this.renderShop();
  },

  exitShop() {
    if (this.shopOrigin === 'post-level') {
      this.showScreen('level-complete-screen');
      if (!('ontouchstart' in window)) setTimeout(() => document.getElementById('math-answer').focus(), 120);
    } else {
      this.refreshHome();
      this.showScreen('home-screen');
    }
  },

  /* ---------- Leaderboard ---------- */
  openLeaderboard() {
    Leaderboard.render(document.getElementById('leaderboard-list'), this.state);
    this.showScreen('leaderboard-screen');
  },

  /* ---------- Confetti ---------- */
  launchConfetti(count = 80) {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    const colors = ['#2186ff', '#fb923c', '#fbbf24', '#10b981', '#a855f7', '#ec4899', '#06b6d4'];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (2.2 + Math.random() * 2.2) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      const w = 8 + Math.random() * 8;
      piece.style.width = w + 'px';
      piece.style.height = (12 + Math.random() * 10) + 'px';
      if (Math.random() < 0.35) piece.style.borderRadius = '50%';
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 5000);
    }
  },

  /* ---------- Reset ---------- */
  resetProgress() {
    const ok = window.confirm('Reset all progress, diamonds, tier, daily streak, and avatars? This cannot be undone.');
    if (!ok) return;
    this.state = Storage.reset();
    Numerdle.syncForToday(this.state.daily);
    Storage.save(this.state);
    this.refreshAll();
    this.showScreen('home-screen');
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
