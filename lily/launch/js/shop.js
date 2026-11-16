// Avatar catalogue and shop rendering.
// `tier` makes an avatar a tier reward — not for sale, granted at that rank.
const AVATARS = [
  // Starter (free)
  { id: 'bunny',     name: 'Bunny',     emoji: '🐰', cost: 0 },

  // Common (under 200)
  { id: 'cat',       name: 'Cat',       emoji: '🐱', cost: 30 },
  { id: 'dog',       name: 'Dog',       emoji: '🐶', cost: 55 },
  { id: 'frog',      name: 'Frog',      emoji: '🐸', cost: 90 },
  { id: 'hamster',   name: 'Hamster',   emoji: '🐹', cost: 110 },
  { id: 'panda',     name: 'Panda',     emoji: '🐼', cost: 140 },
  { id: 'cow',       name: 'Cow',       emoji: '🐮', cost: 170 },
  { id: 'tiger',     name: 'Tiger',     emoji: '🐯', cost: 190 },

  // Rare (200-799)
  { id: 'fox',       name: 'Fox',       emoji: '🦊', cost: 220 },
  { id: 'monkey',    name: 'Monkey',    emoji: '🐵', cost: 270 },
  { id: 'koala',     name: 'Koala',     emoji: '🐨', cost: 320 },
  { id: 'penguin',   name: 'Penguin',   emoji: '🐧', cost: 380 },
  { id: 'wolf',      name: 'Wolf',      emoji: '🐺', cost: 450 },
  { id: 'lion',      name: 'Lion',      emoji: '🦁', cost: 520 },
  { id: 'bee',       name: 'Bee',       emoji: '🐝', cost: 580 },
  { id: 'butterfly', name: 'Butterfly', emoji: '🦋', cost: 640 },
  { id: 'turtle',    name: 'Turtle',    emoji: '🐢', cost: 720 },

  // Epic (800-2999)
  { id: 'octopus',   name: 'Octopus',   emoji: '🐙', cost: 850 },
  { id: 'dolphin',   name: 'Dolphin',   emoji: '🐬', cost: 1000 },
  { id: 'owl',       name: 'Owl',       emoji: '🦉', cost: 1200 },
  { id: 'unicorn',   name: 'Unicorn',   emoji: '🦄', cost: 1450 },
  { id: 'whale',     name: 'Whale',     emoji: '🐳', cost: 1700 },
  { id: 'shark',     name: 'Shark',     emoji: '🦈', cost: 2000 },
  { id: 'dragon',    name: 'Dragon',    emoji: '🐲', cost: 2300 },
  { id: 'peacock',   name: 'Peacock',   emoji: '🦚', cost: 2700 },

  // Legendary (3000+)
  { id: 'robot',     name: 'Robot',     emoji: '🤖', cost: 3200 },
  { id: 'alien',     name: 'Alien',     emoji: '👽', cost: 4200 },
  { id: 'ghost',     name: 'Ghost',     emoji: '👻', cost: 5500 },
  { id: 'wizard',    name: 'Wizard',    emoji: '🧙', cost: 7500 },
  { id: 'genie',     name: 'Genie',     emoji: '🧞', cost: 10000 },

  // Tier rewards (not for sale — earned by ranking up)
  { id: 'champion',  name: 'Champion',  emoji: '🏆', cost: 0, tier: 'bronze'   },
  { id: 'astronaut', name: 'Astronaut', emoji: '🧑‍🚀', cost: 0, tier: 'silver'   },
  { id: 'king',      name: 'King',      emoji: '🤴', cost: 0, tier: 'gold'     },
  { id: 'hero',      name: 'Hero',      emoji: '🦸', cost: 0, tier: 'platinum' },
  { id: 'superstar', name: 'Superstar', emoji: '🌟', cost: 0, tier: 'diamond'  },
  { id: 'legend',    name: 'Legend',    emoji: '⚡', cost: 0, tier: 'master'   }
];

function getAvatar(id) {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

function getRarity(av) {
  if (av.tier) return { tier: 'tier', label: 'Tier' };
  if (av.cost === 0) return null;
  if (av.cost < 200) return { tier: 'common',    label: 'Common'    };
  if (av.cost < 800) return { tier: 'rare',      label: 'Rare'      };
  if (av.cost < 3000) return { tier: 'epic',     label: 'Epic'      };
  return { tier: 'legendary', label: 'Legendary' };
}

const Shop = {
  currentFilter: 'all',

  render(container, state, handlers) {
    container.innerHTML = '';
    const filter = this.currentFilter;

    for (const av of AVATARS) {
      const owned = state.ownedAvatars.includes(av.id);
      const selected = state.selectedAvatar === av.id;
      const affordable = state.diamonds >= av.cost;
      const tierLocked = av.tier && !owned;

      if (filter === 'owned' && !owned) continue;
      if (filter === 'affordable' && (owned || tierLocked || !affordable)) continue;
      if (filter === 'tier' && !av.tier) continue;

      const card = document.createElement('div');
      card.className = 'avatar-card';
      if (selected) card.classList.add('selected');
      else if (owned) card.classList.add('owned');
      else if (tierLocked) card.classList.add('tier-locked');
      else if (!affordable) card.classList.add('locked');

      let actionHTML;
      if (owned) {
        actionHTML = selected
          ? '<span class="selected-tag">Equipped</span>'
          : '<button class="select-btn" type="button">Equip</button>';
      } else if (av.tier) {
        const tier = TIERS.find(t => t.id === av.tier);
        actionHTML = `<span class="tier-lock-tag">${tier.icon} ${tier.name} Reward</span>`;
      } else if (affordable) {
        actionHTML = `<span class="cost"><span class="diamond-icon">💎</span> ${av.cost}</span>
                      <button class="buy-btn" type="button">Buy</button>`;
      } else {
        actionHTML = `<span class="cost"><span class="diamond-icon">💎</span> ${av.cost}</span>
                      <span class="locked-tag">Locked</span>`;
      }

      const rarity = getRarity(av);
      const rarityHTML = rarity
        ? `<span class="rarity-tag rarity-${rarity.tier}">${rarity.label}</span>`
        : '';

      card.innerHTML = `
        ${rarityHTML}
        <div class="avatar-emoji">${av.emoji}</div>
        <div class="avatar-name">${av.name}</div>
        <div class="avatar-price">${actionHTML}</div>
      `;

      const buyBtn = card.querySelector('.buy-btn');
      if (buyBtn) buyBtn.addEventListener('click', () => handlers.onBuy(av));
      const selectBtn = card.querySelector('.select-btn');
      if (selectBtn) selectBtn.addEventListener('click', () => handlers.onSelect(av));

      container.appendChild(card);
    }
  },

  setFilter(name) { this.currentFilter = name; }
};
