// 200-level plan. Each level = (base game) × (theme) × (difficulty tier).
//
// 20 base games × 12 themes = 240 unique (game, theme) configurations.
// Tier ramps independently every 80 levels:
//   levels   1-80  → tier 0 (normal)
//   levels  81-160 → tier 1 (Hyper, +20% speed)
//   levels 161-240 → tier 2 (Master, +40% speed)

const LEVEL_THEMES = [
  { id: 'classic',   name: 'Classic',   icon: '⭐' },
  { id: 'cosmic',    name: 'Cosmic',    icon: '🌌' },
  { id: 'ocean',     name: 'Ocean',     icon: '🌊' },
  { id: 'lava',      name: 'Lava',      icon: '🔥' },
  { id: 'frozen',    name: 'Frozen',    icon: '❄️' },
  { id: 'candy',     name: 'Candy',     icon: '🍭' },
  { id: 'spooky',    name: 'Spooky',    icon: '🎃' },
  { id: 'jungle',    name: 'Jungle',    icon: '🌴' },
  { id: 'magic',     name: 'Magic',     icon: '🪄' },
  { id: 'midnight',  name: 'Midnight',  icon: '🌙' },
  { id: 'desert',    name: 'Desert',    icon: '🏜️' },
  { id: 'rainbow',   name: 'Rainbow',   icon: '🌈' }
];

// 20 base games — every level pairs one with a theme. 20 × 12 = 240 unique
// configurations; the first 200 fill the level plan.
const LEVEL_BASE_GAMES = [
  { id: 'reaction',     short: 'Catcher' },
  { id: 'fruit_slice',  short: 'Slicer'  },
  { id: 'memory',       short: 'Match'   },
  { id: 'sky_hop',      short: 'Pipes'   },
  { id: 'dodge',        short: 'Catch'   },
  { id: 'stack_it',     short: 'Stack'   },
  { id: 'pattern',      short: 'Pattern' },
  { id: 'geo_dash',     short: 'Dash'    },
  { id: 'snake',        short: 'Snake'   },
  { id: 'brick',        short: 'Bricks'  },
  { id: 'whack',        short: 'Whack'   },
  { id: 'rhythm',       short: 'Beat'    },
  { id: 'tile',         short: 'Tiles'   },
  { id: 'asteroid',     short: 'Asteroid'},
  { id: 'crossy',       short: 'Hop'     },
  { id: 'climb',        short: 'Climb'   },
  { id: 'color_switch', short: 'Switch'  },
  { id: 'maze',         short: 'Maze'    },
  { id: 'plinko',       short: 'Plinko'  },
  { id: 'targets',      short: 'Targets' }
];

const LEVEL_TIERS = [
  { id: 0, prefix: '',       speedMul: 1.0,  spawnMul: 1.0  },
  { id: 1, prefix: 'Hyper ', speedMul: 1.20, spawnMul: 1.25 },
  { id: 2, prefix: 'Master ',speedMul: 1.40, spawnMul: 1.50 }
];

const Levels = {
  TOTAL: 200,

  get(n) {
    if (n < 1) n = 1;
    const games = LEVEL_BASE_GAMES.length;   // 20
    const themes = LEVEL_THEMES.length;      // 12
    const cycle = games * themes;            // 240
    // Difficulty tier ramps every 80 levels for steady progression.
    const tier = Math.min(LEVEL_TIERS.length - 1, Math.floor((n - 1) / 80));
    // Game and theme cycle through all 240 combinations before repeating.
    const inCycle = (n - 1) % cycle;
    const themeIdx = Math.floor(inCycle / games) % themes;
    const gameIdx = inCycle % games;

    const game = LEVEL_BASE_GAMES[gameIdx];
    const theme = LEVEL_THEMES[themeIdx];
    const tierData = LEVEL_TIERS[tier];

    return {
      id: n,
      gameId: game.id,
      name: `${tierData.prefix}${theme.name} ${game.short}`.trim(),
      icon: theme.icon,
      themeId: theme.id,
      themeName: theme.name,
      tier: tier,
      tierLabel: tier === 0 ? '' : tierData.prefix.trim(),
      params: {
        theme: theme.id,
        bgClass: 'theme-' + theme.id,
        speedMul: tierData.speedMul,
        spawnMul: tierData.spawnMul,
        tier: tier
      }
    };
  }
};
