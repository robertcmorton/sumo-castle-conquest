// players.js — player slots, names, colors, persisted recents.
const Players = (() => {
  const COLORS = [
    '#ef4444', // P1 red
    '#3b82f6', // P2 blue
    '#22c55e', // P3 green
    '#f59e0b', // P4 amber
    '#a855f7', // P5 purple
    '#06b6d4', // P6 cyan
    '#ec4899', // P7 pink
    '#84cc16', // P8 lime
  ];
  const DEFAULT_NAMES = ['Red', 'Blue', 'Green', 'Amber', 'Purple', 'Cyan', 'Pink', 'Lime'];

  // Active session players: [{ name, color, avatar }]
  let active = [];

  function colorFor(i) { return COLORS[i % COLORS.length]; }
  function placeholderFor(i) { return DEFAULT_NAMES[i % DEFAULT_NAMES.length]; }

  function recents() {
    return Storage.get('recentNames', []);
  }
  function pushRecent(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const r = recents().filter(n => n.toLowerCase() !== trimmed.toLowerCase());
    r.unshift(trimmed);
    Storage.set('recentNames', r.slice(0, 16));
  }

  function setActive(list) {
    active = list.map((p, i) => ({
      name: (p.name || '').trim() || placeholderFor(i),
      color: colorFor(i),
      avatar: p.avatar || Shop.defaultAvatar(),
      slot: i,
    }));
    active.forEach(p => pushRecent(p.name));
    Storage.set('lastRoster', active.map(p => ({ name: p.name, avatar: p.avatar })));
  }
  function getActive() { return active.slice(); }
  function count() { return active.length; }

  function lastRoster(n) {
    const last = Storage.get('lastRoster', []);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(last[i] || { name: '', avatar: null });
    }
    return out;
  }

  // Render a name-entry list inside `host`. Returns a getter for the entered names.
  function renderEntry(host, count) {
    host.innerHTML = '';
    const last = lastRoster(count);
    const rows = [];
    for (let i = 0; i < count; i++) {
      const row = document.createElement('label');
      row.className = 'player-row';
      const color = colorFor(i);
      row.style.setProperty('--player-color', color);
      const avatar = (last[i].avatar) || Shop.defaultAvatar();
      row.innerHTML = `
        <span class="swatch" style="--player-color:${color}">${avatar.emoji || '🙂'}</span>
        <span class="player-label">P${i + 1}</span>
        <input type="text" maxlength="14" placeholder="${placeholderFor(i)}" value="${escapeAttr(last[i].name || '')}">
      `;
      host.appendChild(row);
      rows.push({ row, input: row.querySelector('input'), avatar });
    }
    return {
      collect() {
        return rows.map(r => ({ name: r.input.value, avatar: r.avatar }));
      },
    };
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  return { COLORS, colorFor, placeholderFor, recents, setActive, getActive, count, lastRoster, renderEntry };
})();
