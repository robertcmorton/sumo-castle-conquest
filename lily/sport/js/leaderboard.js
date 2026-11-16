// leaderboard.js — cumulative scores + wins per player (by name) for this device.
const Leaderboard = (() => {
  // Persisted shape:
  // {
  //   "Alice": { games: 7, wins: 3, totalScore: 1240, perGame: { stack: { plays: 3, best: 24, totalScore: 50 } } }
  // }

  function load() { return Storage.get('leaderboard', {}); }
  function save(data) { Storage.set('leaderboard', data); }

  function recordRound(gameId, results) {
    // results: [{ name, score, place }], sorted/with place set, lower place = better
    const data = load();
    results.forEach(r => {
      const name = r.name;
      const entry = data[name] || { games: 0, wins: 0, totalScore: 0, perGame: {} };
      entry.games += 1;
      entry.totalScore += r.score;
      if (r.place === 1) entry.wins += 1;
      const g = entry.perGame[gameId] || { plays: 0, best: 0, totalScore: 0 };
      g.plays += 1;
      g.totalScore += r.score;
      if (r.score > g.best) g.best = r.score;
      entry.perGame[gameId] = g;
      data[name] = entry;
    });
    save(data);
  }

  function topByScore() {
    const data = load();
    return Object.entries(data)
      .map(([name, e]) => ({ name, ...e }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }
  function topByWins() {
    const data = load();
    return Object.entries(data)
      .map(([name, e]) => ({ name, ...e }))
      .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);
  }

  function clear() { Storage.remove('leaderboard'); }

  function renderList(host, filter) {
    host.innerHTML = '';
    const rows = filter === 'wins' ? topByWins() : topByScore();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'No scores yet. Play a game to start the board.';
      host.appendChild(empty);
      return;
    }
    rows.slice(0, 24).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      row.innerHTML = `
        <span class="rank">${medal}</span>
        <span class="who">${escapeHtml(r.name)}</span>
        <span class="stat">${r.games}g · ${r.wins}w</span>
        <span class="score">${r.totalScore}</span>
      `;
      host.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  return { recordRound, topByScore, topByWins, clear, renderList };
})();
