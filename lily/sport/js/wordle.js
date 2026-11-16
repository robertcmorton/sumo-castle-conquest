// wordle.js — sports-themed daily Wordle. Self-contained: own state, UI, persistence.
const Wordle = (() => {
  const WORDS = [
    'SCORE','MEDAL','ARENA','PITCH','SHOOT','COURT','PUNCH','RACER','SPEED','POWER',
    'ARROW','FIELD','CATCH','THROW','SWING','TRACK','SLIDE','BLOCK','REACH','PIVOT',
    'SERVE','SMASH','DRILL','COACH','RALLY','MATCH','TITLE','SKATE','CYCLE','FAULT',
    'WHIFF','EAGLE','BOGEY','SPIKE','JUMPS','KICKS','SHOTS','SPINS','GLOVE','BOOTS',
    'CLEAT','DUNKS','DERBY','CHASE','CHAMP','RUGBY','GUARD','BIRDY','SCRUM','RELAY',
  ];
  const ROWS = 6;
  const COLS = 5;

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function yesterdayKey() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function answerFor(dateKey) {
    return WORDS[hashStr(dateKey) % WORDS.length];
  }

  function loadMeta() {
    return Storage.get('wordleMeta', { streak: 0, lastSuccessDate: null });
  }
  function saveMeta(m) { Storage.set('wordleMeta', m); }
  function loadDay(key) { return Storage.get('wordleDay:' + key, null); }
  function saveDay(key, day) { Storage.set('wordleDay:' + key, day); }

  // ---- score a guess against the answer ----
  function scoreGuess(guess, answer) {
    const result = new Array(COLS).fill('miss');
    const ansArr = answer.split('');
    const used = new Array(COLS).fill(false);
    // first pass: greens
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === ansArr[i]) { result[i] = 'hit'; used[i] = true; }
    }
    // second pass: yellows
    for (let i = 0; i < COLS; i++) {
      if (result[i] === 'hit') continue;
      for (let j = 0; j < COLS; j++) {
        if (!used[j] && guess[i] === ansArr[j]) { result[i] = 'near'; used[j] = true; break; }
      }
    }
    return result;
  }

  // -------- runtime state --------
  let host = null;
  let current = '';       // current row input
  let onKeyHandler = null;

  function mount() {
    const key = todayKey();
    let day = loadDay(key);
    if (!day) {
      day = { date: key, answer: answerFor(key), guesses: [], scores: [], won: false, finished: false };
      saveDay(key, day);
    }
    current = '';
    render(day);
    // physical keyboard binding
    if (onKeyHandler) document.removeEventListener('keydown', onKeyHandler);
    onKeyHandler = (e) => handleKey(e, day);
    document.addEventListener('keydown', onKeyHandler);
  }

  function unmount() {
    if (onKeyHandler) {
      document.removeEventListener('keydown', onKeyHandler);
      onKeyHandler = null;
    }
  }

  function render(day) {
    const grid = document.getElementById('wordle-grid');
    grid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      const row = document.createElement('div');
      row.className = 'wordle-row';
      const guess = day.guesses[r];
      const score = day.scores[r];
      const isCurrent = !day.finished && r === day.guesses.length;
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'wordle-cell';
        let ch = '';
        if (guess) {
          ch = guess[c];
          if (score) cell.classList.add(score[c]);
        } else if (isCurrent) {
          ch = current[c] || '';
          if (ch) cell.classList.add('filled');
        }
        cell.textContent = ch;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    }
    renderKeyboard(day);
    renderMeta(day);
    renderResult(day);
  }

  function renderMeta(day) {
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    document.getElementById('wordle-date').textContent = dateStr;
    const m = loadMeta();
    // expire streak if lastSuccess older than yesterday
    if (m.lastSuccessDate && m.lastSuccessDate !== todayKey() && m.lastSuccessDate !== yesterdayKey()) {
      m.streak = 0;
      saveMeta(m);
    }
    const sk = m.streak;
    const el = document.getElementById('wordle-streak');
    el.hidden = sk === 0;
    document.getElementById('wordle-streak-count').textContent = sk;
  }

  function renderResult(day) {
    const msg = document.getElementById('wordle-msg');
    const res = document.getElementById('wordle-result');
    msg.textContent = '';
    if (!day.finished) {
      res.hidden = true;
      return;
    }
    res.hidden = false;
    res.className = 'wordle-result ' + (day.won ? 'win' : 'lose');
    res.textContent = day.won
      ? `Solved in ${day.guesses.length}! Come back tomorrow.`
      : `The word was ${day.answer}. Come back tomorrow.`;
  }

  function renderKeyboard(day) {
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const kb = document.getElementById('wordle-keyboard');
    kb.innerHTML = '';
    // accumulate the best status per letter
    const status = {};
    for (let r = 0; r < day.guesses.length; r++) {
      const g = day.guesses[r], s = day.scores[r];
      for (let c = 0; c < COLS; c++) {
        const ch = g[c], st = s[c];
        const prev = status[ch];
        if (prev === 'hit') continue;
        if (st === 'hit') status[ch] = 'hit';
        else if (st === 'near' && prev !== 'hit') status[ch] = 'near';
        else if (!prev) status[ch] = 'miss';
      }
    }
    rows.forEach((rowStr, idx) => {
      const row = document.createElement('div');
      row.className = 'wordle-krow';
      if (idx === 2) {
        row.appendChild(makeKey('ENTER', true, () => submit(day)));
      }
      rowStr.split('').forEach(ch => {
        const k = makeKey(ch, false, () => addChar(ch, day));
        if (status[ch]) k.classList.add(status[ch]);
        row.appendChild(k);
      });
      if (idx === 2) {
        row.appendChild(makeKey('⌫', true, () => backspace(day)));
      }
      kb.appendChild(row);
    });
  }

  function makeKey(text, wide, onTap) {
    const b = document.createElement('button');
    b.className = 'wordle-key' + (wide ? ' wide' : '');
    b.textContent = text;
    b.addEventListener('click', e => { e.preventDefault(); onTap(); });
    return b;
  }

  function addChar(ch, day) {
    if (day.finished) return;
    if (current.length >= COLS) return;
    current += ch;
    render(day);
  }
  function backspace(day) {
    if (day.finished) return;
    if (current.length === 0) return;
    current = current.slice(0, -1);
    render(day);
  }
  function submit(day) {
    if (day.finished) return;
    if (current.length !== COLS) {
      flashMsg('Need 5 letters.');
      return;
    }
    const guess = current.toUpperCase();
    const score = scoreGuess(guess, day.answer);
    day.guesses.push(guess);
    day.scores.push(score);
    current = '';
    if (score.every(s => s === 'hit')) {
      day.won = true; day.finished = true;
      awardWin(day);
    } else if (day.guesses.length >= ROWS) {
      day.finished = true;
    }
    saveDay(day.date, day);
    render(day);
  }

  function awardWin(day) {
    // streak update
    const m = loadMeta();
    if (m.lastSuccessDate === yesterdayKey()) m.streak += 1;
    else if (m.lastSuccessDate !== day.date) m.streak = 1;
    m.lastSuccessDate = day.date;
    saveMeta(m);
    // coin reward
    const guessesUsed = day.guesses.length;
    const reward = 40 + (ROWS - guessesUsed) * 20 + Math.min(60, m.streak * 5);
    Shop.addCoins(reward);
    flashMsg(`+${reward} 🪙`);
  }

  function flashMsg(text) {
    const el = document.getElementById('wordle-msg');
    el.textContent = text;
  }

  function handleKey(e, day) {
    if (document.getElementById('wordle-screen').classList.contains('active') === false) return;
    if (day.finished) return;
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); submit(day); return; }
    if (k === 'Backspace') { e.preventDefault(); backspace(day); return; }
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      addChar(k.toUpperCase(), day);
    }
  }

  return { mount, unmount };
})();
