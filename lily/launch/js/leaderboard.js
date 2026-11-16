// Local leaderboard with synthetic competitors. Stable each session.
const FAKE_PLAYERS = [
  { name: 'Iris',   emoji: '👽', level: 158, diamonds: 18500, avatarsOwned: 22, dailyStreak: 47 },
  { name: 'Ash',    emoji: '🤖', level: 138, diamonds: 12400, avatarsOwned: 18, dailyStreak: 31 },
  { name: 'Max',    emoji: '🐲', level: 124, diamonds: 8200,  avatarsOwned: 15, dailyStreak: 24 },
  { name: 'Theo',   emoji: '🦉', level: 110, diamonds: 5600,  avatarsOwned: 14, dailyStreak: 19 },
  { name: 'Luna',   emoji: '🦄', level: 95,  diamonds: 4100,  avatarsOwned: 12, dailyStreak: 15 },
  { name: 'Zoe',    emoji: '🦊', level: 87,  diamonds: 2400,  avatarsOwned: 10, dailyStreak: 11 },
  { name: 'Felix',  emoji: '🦁', level: 82,  diamonds: 3300,  avatarsOwned: 11, dailyStreak: 8  },
  { name: 'Niko',   emoji: '🦝', level: 73,  diamonds: 2890,  avatarsOwned: 9,  dailyStreak: 14 },
  { name: 'Sam',    emoji: '🐱', level: 65,  diamonds: 1750,  avatarsOwned: 8,  dailyStreak: 6  },
  { name: 'Bea',    emoji: '🐝', level: 56,  diamonds: 1240,  avatarsOwned: 7,  dailyStreak: 9  },
  { name: 'Mia',    emoji: '🐬', level: 48,  diamonds: 1100,  avatarsOwned: 6,  dailyStreak: 5  },
  { name: 'Pip',    emoji: '🐧', level: 42,  diamonds: 950,   avatarsOwned: 6,  dailyStreak: 3  },
  { name: 'Rex',    emoji: '🐺', level: 31,  diamonds: 620,   avatarsOwned: 5,  dailyStreak: 7  },
  { name: 'Otto',   emoji: '🐙', level: 27,  diamonds: 540,   avatarsOwned: 4,  dailyStreak: 2  },
  { name: 'Pia',    emoji: '🦋', level: 19,  diamonds: 380,   avatarsOwned: 3,  dailyStreak: 4  }
];

const Leaderboard = {
  score(p) {
    return (p.level || 0) * 100
         + (p.diamonds || 0)
         + (p.avatarsOwned || 0) * 50
         + (p.dailyStreak || 0) * 80;
  },

  rankings(state) {
    const me = {
      name: 'You',
      emoji: getAvatar(state.selectedAvatar).emoji,
      level: state.level,
      diamonds: state.diamonds,
      avatarsOwned: state.ownedAvatars.length,
      dailyStreak: state.daily.streak || 0,
      isMe: true
    };
    const all = [me, ...FAKE_PLAYERS].map(p => ({ ...p, total: this.score(p) }));
    all.sort((a, b) => b.total - a.total);
    return all.map((p, i) => ({ ...p, rank: i + 1 }));
  },

  render(container, state) {
    container.innerHTML = '';
    const list = this.rankings(state);
    for (const p of list) {
      const row = document.createElement('div');
      row.className = 'lb-row';
      if (p.isMe) row.classList.add('me');
      if (p.rank === 1) row.classList.add('top-1');
      else if (p.rank === 2) row.classList.add('top-2');
      else if (p.rank === 3) row.classList.add('top-3');

      row.innerHTML = `
        <div class="lb-rank">${p.rank}</div>
        <div class="lb-avatar">${p.emoji}</div>
        <div class="lb-info">
          <div class="lb-name">${p.isMe ? '<strong>You</strong>' : p.name}</div>
          <div class="lb-meta">Lvl ${p.level} • 💎 ${p.diamonds.toLocaleString()} • 🔥 ${p.dailyStreak}</div>
        </div>
        <div class="lb-score">${p.total.toLocaleString()}</div>
      `;
      container.appendChild(row);
    }
  }
};
