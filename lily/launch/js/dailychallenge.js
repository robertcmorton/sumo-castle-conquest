// Daily Numerdle: 4-digit Wordle. Everyone gets the same puzzle each day.
const Numerdle = {
  LENGTH: 4,
  MAX_GUESSES: 6,

  todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  prettyDate() {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  // Date-seeded answer (deterministic, same for everyone)
  generateAnswer(dateKey) {
    let seed = 0;
    for (let i = 0; i < dateKey.length; i++) {
      seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
    }
    let s = seed || 1;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    let result = '';
    for (let i = 0; i < this.LENGTH; i++) {
      result += Math.floor(rand() * 10);
    }
    return result;
  },

  // Wordle scoring: greens first, then yellows accounting for duplicates.
  evaluate(guess, answer) {
    const result = new Array(answer.length).fill('absent');
    const counts = {};
    for (const c of answer) counts[c] = (counts[c] || 0) + 1;

    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === answer[i]) {
        result[i] = 'correct';
        counts[guess[i]]--;
      }
    }
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === 'correct') continue;
      if (counts[guess[i]] > 0) {
        result[i] = 'present';
        counts[guess[i]]--;
      }
    }
    return result;
  },

  // Award diamonds based on how few guesses it took.
  computeReward(guessCount) {
    const table = [200, 150, 110, 80, 60, 40]; // 1st .. 6th attempt
    return table[guessCount - 1] || 30;
  },

  // Bring a state's daily block in sync with today. Returns true if the
  // puzzle was rolled over to a new day.
  syncForToday(daily) {
    const today = this.todayKey();
    if (daily.dateKey !== today) {
      const yesterdaySolved = daily.solved && daily.dateKey === this.yesterdayKey();
      daily.dateKey = today;
      daily.answer = this.generateAnswer(today);
      daily.guesses = [];
      daily.solved = false;
      daily.failed = false;
      // If they didn't play yesterday, break the streak (but don't double-decrement)
      if (!yesterdaySolved && daily.lastCompletedDate !== this.yesterdayKey()) {
        daily.streak = 0;
      }
      return true;
    }
    return false;
  },

  yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};
