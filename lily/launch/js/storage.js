// Persistent state for the game, backed by localStorage.
const STORAGE_KEY = 'lilys-math-quest-v2';

const DEFAULT_STATE = {
  diamonds: 0,
  level: 1,
  ownedAvatars: ['bunny'],
  selectedAvatar: 'bunny',
  tierId: 'starter',
  daily: {
    answer: null,
    dateKey: null,
    guesses: [],
    solved: false,
    failed: false,
    streak: 0,
    lastCompletedDate: null,
    totalSolved: 0
  },
  stats: {
    gamesPlayed: 0,
    mathCorrect: 0,
    mathAttempts: 0,
    highestLevel: 1
  }
};

const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      const merged = clone(DEFAULT_STATE);
      // Deep merge, preserving nested defaults
      for (const k of Object.keys(parsed)) {
        if (k === 'daily' || k === 'stats') {
          merged[k] = Object.assign({}, merged[k], parsed[k] || {});
        } else {
          merged[k] = parsed[k];
        }
      }
      return merged;
    } catch (e) {
      console.warn('Could not load saved game; starting fresh.', e);
      return clone(DEFAULT_STATE);
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save game.', e);
    }
  },

  reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    return clone(DEFAULT_STATE);
  }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
