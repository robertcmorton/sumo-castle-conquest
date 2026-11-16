// storage.js — thin wrapper around localStorage with namespacing + defaults
const Storage = (() => {
  const NS = 'lps:';

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Storage.get failed', key, e);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed', key, e);
    }
  }

  function remove(key) {
    localStorage.removeItem(NS + key);
  }

  function clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  return { get, set, remove, clearAll };
})();
