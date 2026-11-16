// shop.js — avatar catalog + ownership + coin economy
const Shop = (() => {
  // Avatar catalog. Emoji + name + price (coins). First avatar is free/default.
  const CATALOG = [
    // free starter
    { id: 'runner',       emoji: '🏃',  name: 'Runner',       price: 0 },
    // ball sports
    { id: 'soccer',       emoji: '⚽',  name: 'Footballer',   price: 75 },
    { id: 'baller',       emoji: '🏀',  name: 'Baller',       price: 75 },
    { id: 'tennis',       emoji: '🎾',  name: 'Tennis Ace',   price: 75 },
    { id: 'baseball',     emoji: '⚾',  name: 'Slugger',      price: 80 },
    { id: 'cricketer',    emoji: '🏏',  name: 'Cricketer',    price: 80 },
    { id: 'volleyball',   emoji: '🏐',  name: 'Volleyballer', price: 90 },
    { id: 'rugby',        emoji: '🏉',  name: 'Rugby Player', price: 95 },
    { id: 'football_am',  emoji: '🏈',  name: 'QB',           price: 95 },
    // stick/club sports
    { id: 'golfer',       emoji: '🏌️',  name: 'Golfer',       price: 100 },
    { id: 'fieldhockey',  emoji: '🏑',  name: 'Field Hockey', price: 90 },
    { id: 'icehockey',    emoji: '🏒',  name: 'Ice Hockey',   price: 95 },
    { id: 'bowler',       emoji: '🎳',  name: 'Bowler',       price: 110 },
    { id: 'darts',        emoji: '🎯',  name: 'Darts',        price: 110 },
    // water/endurance
    { id: 'swimmer',      emoji: '🏊',  name: 'Swimmer',      price: 100 },
    { id: 'cyclist',      emoji: '🚴',  name: 'Cyclist',      price: 100 },
    { id: 'mtb',          emoji: '🚵',  name: 'Mountain Biker', price: 130 },
    { id: 'rower',        emoji: '🚣',  name: 'Rower',        price: 160 },
    { id: 'surfer',       emoji: '🏄',  name: 'Surfer',       price: 175 },
    { id: 'diver',        emoji: '🤿',  name: 'Diver',        price: 140 },
    { id: 'waterpolo',    emoji: '🤽',  name: 'Water Polo',   price: 180 },
    // combat / target
    { id: 'archer',       emoji: '🏹',  name: 'Archer',       price: 120 },
    { id: 'boxer',        emoji: '🥊',  name: 'Boxer',        price: 150 },
    { id: 'karate',       emoji: '🥋',  name: 'Karate',       price: 130 },
    { id: 'fencer',       emoji: '🤺',  name: 'Fencer',       price: 200 },
    { id: 'wrestler',     emoji: '🤼',  name: 'Wrestler',     price: 180 },
    // winter / board
    { id: 'skier',        emoji: '⛷️',  name: 'Skier',        price: 150 },
    { id: 'snowboarder',  emoji: '🏂',  name: 'Snowboarder',  price: 150 },
    { id: 'iceskater',    emoji: '⛸️',  name: 'Ice Skater',   price: 140 },
    { id: 'curler',       emoji: '🥌',  name: 'Curler',       price: 160 },
    { id: 'skater',       emoji: '🛹',  name: 'Skateboarder', price: 130 },
    // skill / form
    { id: 'gymnast',      emoji: '🤸',  name: 'Gymnast',      price: 160 },
    { id: 'yogi',         emoji: '🧘',  name: 'Yogi',         price: 160 },
    { id: 'jockey',       emoji: '🏇',  name: 'Jockey',       price: 200 },
    { id: 'weightlift',   emoji: '🏋️',  name: 'Lifter',       price: 220 },
    { id: 'climber',      emoji: '🧗',  name: 'Climber',      price: 240 },
    // medals / trophies
    { id: 'medal_bronze', emoji: '🥉',  name: 'Bronze',       price: 200 },
    { id: 'medal_silver', emoji: '🥈',  name: 'Silver',       price: 320 },
    { id: 'medal_gold',   emoji: '🥇',  name: 'Gold',         price: 480 },
    { id: 'astronaut',    emoji: '🧑‍🚀', name: 'Astronaut',    price: 300 },
    { id: 'trophy',       emoji: '🏆',  name: 'Champion',     price: 650 },
  ];

  function defaultAvatar() { return CATALOG[0]; }
  function find(id) { return CATALOG.find(a => a.id === id); }

  function owned() {
    const list = Storage.get('owned', null);
    if (list && list.length) return list;
    Storage.set('owned', ['runner']);
    return ['runner'];
  }
  function isOwned(id) { return owned().includes(id); }

  function coins() { return Storage.get('coins', 0); }
  function addCoins(n) {
    const c = Math.max(0, coins() + n);
    Storage.set('coins', c);
    return c;
  }
  function spend(n) {
    const c = coins();
    if (c < n) return false;
    Storage.set('coins', c - n);
    return true;
  }

  function buy(id) {
    const a = find(id);
    if (!a) return { ok: false, msg: 'Unknown avatar' };
    if (isOwned(id)) return { ok: false, msg: 'Already owned' };
    if (!spend(a.price)) return { ok: false, msg: 'Not enough coins' };
    const list = owned();
    list.push(id);
    Storage.set('owned', list);
    return { ok: true, msg: `Unlocked ${a.name}!` };
  }

  // Render the shop grid. `host` = container, `filter` = 'all' | 'owned' | 'affordable'.
  function renderGrid(host, filter, onBuy) {
    host.innerHTML = '';
    const c = coins();
    const ownedSet = new Set(owned());
    const items = CATALOG.filter(a => {
      if (filter === 'owned') return ownedSet.has(a.id);
      if (filter === 'affordable') return !ownedSet.has(a.id) && a.price <= c;
      return true;
    });
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = filter === 'affordable' ? 'Play some games to earn coins!' : 'No avatars here yet.';
      host.appendChild(empty);
      return;
    }
    items.forEach(a => {
      const owned = ownedSet.has(a.id);
      const card = document.createElement('button');
      card.className = 'avatar-card' + (owned ? ' owned' : '');
      card.innerHTML = `
        <div class="emoji">${a.emoji}</div>
        <div class="name">${escapeHtml(a.name)}</div>
        <div class="price">${owned ? 'Owned' : (a.price === 0 ? 'Free' : `🪙 ${a.price}`)}</div>
      `;
      card.addEventListener('click', () => onBuy(a));
      host.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  return { CATALOG, defaultAvatar, find, owned, isOwned, coins, addCoins, spend, buy, renderGrid };
})();
