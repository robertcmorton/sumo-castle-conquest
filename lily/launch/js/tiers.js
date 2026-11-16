// Tier system: rank up every 20 levels, with diamond bonus + exclusive avatar.
const TIERS = [
  { id: 'starter',  name: 'Starter',  minLevel: 1,   icon: '🌱' },
  { id: 'bronze',   name: 'Bronze',   minLevel: 20,  icon: '🥉', reward: { diamonds: 250,   avatarId: 'champion'   } },
  { id: 'silver',   name: 'Silver',   minLevel: 40,  icon: '🥈', reward: { diamonds: 600,   avatarId: 'astronaut'  } },
  { id: 'gold',     name: 'Gold',     minLevel: 60,  icon: '🥇', reward: { diamonds: 1500,  avatarId: 'king'       } },
  { id: 'platinum', name: 'Platinum', minLevel: 80,  icon: '💠', reward: { diamonds: 3000,  avatarId: 'hero'       } },
  { id: 'diamond',  name: 'Diamond',  minLevel: 100, icon: '💎', reward: { diamonds: 6000,  avatarId: 'superstar'  } },
  { id: 'master',   name: 'Master',   minLevel: 120, icon: '👑', reward: { diamonds: 12000, avatarId: 'legend'     } }
];

const Tiers = {
  forLevel(level) {
    let current = TIERS[0];
    for (const t of TIERS) {
      if (level >= t.minLevel) current = t;
    }
    return current;
  },

  next(level) {
    for (const t of TIERS) {
      if (t.minLevel > level) return t;
    }
    return null;
  },

  progress(level) {
    const current = this.forLevel(level);
    const next = this.next(level);
    if (!next) {
      return { current, next: null, fraction: 1, levelsToGo: 0 };
    }
    const span = next.minLevel - current.minLevel;
    const into = level - current.minLevel;
    return {
      current,
      next,
      fraction: Math.max(0, Math.min(1, into / span)),
      levelsToGo: next.minLevel - level
    };
  },

  // Returns the highest *new* tier crossed when going from oldLevel -> newLevel,
  // or null if no tier boundary was crossed.
  crossedTier(oldLevel, newLevel) {
    let highest = null;
    for (const t of TIERS) {
      if (t.minLevel > oldLevel && t.minLevel <= newLevel) {
        highest = t;
      }
    }
    return highest;
  }
};
