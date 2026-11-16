// games/_registry.js — central registry for all minigames.
//
// Game contract:
//   Games.register({
//     id, title, sport, theme, icon,
//     minPlayers, maxPlayers,
//     simultaneous: boolean,         // true = all play at once; false = turn-based
//     instructions: string,
//     controls: string,              // human-readable controls description
//     create(ctx) -> {
//       start(),
//       stop()
//     }
//   })
//
// ctx provides:
//   - canvas:       HTMLCanvasElement
//   - players:      [{name, color, avatar, slot}]
//   - setStatus(s): update top HUD text
//   - setOverlay(html | null, opts): show/hide overlay message
//   - finish(results): results = [{playerIdx, score}] — runtime sorts/presents
//   - controllerHost: HTMLElement for touch-controller UI
const Games = (() => {
  const registry = [];

  function register(def) {
    registry.push(def);
  }

  function all() { return registry.slice(); }

  function get(id) { return registry.find(g => g.id === id); }

  function forPlayerCount(n) {
    return registry.filter(g => n >= g.minPlayers && n <= g.maxPlayers);
  }

  function renderTiles(host, count, onPick) {
    host.innerHTML = '';
    const list = forPlayerCount(count);
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'No games for this size yet.';
      host.appendChild(empty);
      return;
    }
    list.forEach(g => {
      const tile = document.createElement('button');
      tile.className = 'game-tile';
      const theme = Themes.get(g.theme);
      tile.innerHTML = `
        <span class="game-tile-theme-tag">${escapeHtml(theme.name)}</span>
        <span class="game-tile-icon">${g.icon}</span>
        <span class="game-tile-title">${escapeHtml(g.title)}</span>
        <span class="game-tile-sport">${escapeHtml(g.sport)}</span>
        <span class="game-tile-meta">${g.minPlayers === g.maxPlayers ? g.minPlayers : g.minPlayers + '–' + g.maxPlayers} players · ${g.simultaneous ? 'Simultaneous' : 'Turn-based'}</span>
      `;
      tile.addEventListener('click', () => onPick(g));
      host.appendChild(tile);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  return { register, all, get, forPlayerCount, renderTiles };
})();
