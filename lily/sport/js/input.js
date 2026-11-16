// input.js — abstract input layer.
// Games register listeners for "player N took action X". The source can be
// keyboard, touch, or (later) a remote phone-controller.
const Input = (() => {
  const listeners = new Set();

  // Keyboard map: each player has two keys for alternating-tap mechanics,
  // plus a primary key for single-action games. Indexed by player slot (0-7).
  const KEY_MAP = [
    { primary: 'a', left: 'a', right: 's' },         // P1
    { primary: 'l', left: 'k', right: 'l' },         // P2
    { primary: 'g', left: 'g', right: 'h' },         // P3
    { primary: '.', left: ',', right: '.' },         // P4
    { primary: 'q', left: 'q', right: 'w' },         // P5
    { primary: 'p', left: 'o', right: 'p' },         // P6
    { primary: 'z', left: 'z', right: 'x' },         // P7
    { primary: 'm', left: 'n', right: 'm' },         // P8
  ];

  // global key -> {player, role} lookup
  let keyLookup = {};
  function rebuildKeyLookup(activePlayerCount) {
    keyLookup = {};
    for (let i = 0; i < Math.min(activePlayerCount, KEY_MAP.length); i++) {
      const k = KEY_MAP[i];
      keyLookup[k.left] = { player: i, role: 'left' };
      keyLookup[k.right] = { player: i, role: 'right' };
      // also expose primary if different from left
      if (k.primary && k.primary !== k.left && k.primary !== k.right) {
        keyLookup[k.primary] = { player: i, role: 'primary' };
      }
    }
  }

  function emit(event) {
    listeners.forEach(fn => {
      try { fn(event); } catch (e) { console.warn('input listener threw', e); }
    });
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === ' ') {
      emit({ type: 'press', player: 0, role: 'primary', source: 'kb', key: 'space' });
      return;
    }
    if (key === 'enter') {
      emit({ type: 'press', player: 0, role: 'primary', source: 'kb', key: 'enter' });
      return;
    }
    const hit = keyLookup[key];
    if (!hit) return;
    e.preventDefault();
    emit({ type: 'press', player: hit.player, role: hit.role, source: 'kb', key });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function setActivePlayerCount(n) { rebuildKeyLookup(n); }

  // emit synthetic events from controller UI (touch buttons)
  function fire(player, role, source = 'touch') {
    emit({ type: 'press', player, role, source });
  }

  function attach() {
    document.addEventListener('keydown', onKeyDown);
  }
  function detach() {
    document.removeEventListener('keydown', onKeyDown);
    listeners.clear();
  }
  function clear() {
    listeners.clear();
  }

  // Build a touch controller UI for a list of players.
  // mode: 'single' (one big button per player), 'dual' (left/right pair per player)
  function buildController(host, players, mode = 'single', labels = {}) {
    host.innerHTML = '';
    if (mode === 'single') {
      const row = document.createElement('div');
      row.className = 'tap-row';
      players.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'tap-btn';
        btn.style.setProperty('--player-color', p.color);
        btn.innerHTML = `<span class="player-tag">P${i + 1}</span><span class="player-name">${escapeHtml(p.name)}</span>`;
        bindTap(btn, () => fire(i, 'primary'));
        row.appendChild(btn);
      });
      host.appendChild(row);
    } else if (mode === 'dual') {
      players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'tap-row';
        const left = document.createElement('button');
        left.className = 'tap-btn';
        left.style.setProperty('--player-color', p.color);
        left.innerHTML = `<span class="player-tag">${escapeHtml(p.name)}</span><span class="player-name">${labels.left || 'L'}</span>`;
        bindTap(left, () => fire(i, 'left'));
        const right = document.createElement('button');
        right.className = 'tap-btn';
        right.style.setProperty('--player-color', p.color);
        right.innerHTML = `<span class="player-tag">${escapeHtml(p.name)}</span><span class="player-name">${labels.right || 'R'}</span>`;
        bindTap(right, () => fire(i, 'right'));
        row.appendChild(left);
        row.appendChild(right);
        host.appendChild(row);
      });
    } else if (mode === 'big') {
      // One big button (turn-based; current player only)
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      const p = players[0];
      btn.style.borderColor = p.color;
      btn.innerHTML = labels.label || 'TAP!';
      bindTap(btn, () => fire(0, 'primary'));
      host.appendChild(btn);
    }
  }

  function bindTap(el, handler) {
    let down = false;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (down) return;
      down = true;
      handler();
    });
    const up = () => { down = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  function clearController(host) { if (host) host.innerHTML = ''; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // keyboard hint text per player
  function keyHint(playerIdx, mode) {
    const k = KEY_MAP[playerIdx];
    if (!k) return '';
    if (mode === 'dual') return `${k.left.toUpperCase()} / ${k.right.toUpperCase()}`;
    return k.primary.toUpperCase();
  }

  return { attach, detach, subscribe, clear, setActivePlayerCount, buildController, clearController, keyHint, fire };
})();
