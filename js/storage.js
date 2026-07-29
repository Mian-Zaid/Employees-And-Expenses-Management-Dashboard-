/*
 * storage.js — Client-side data layer (localStorage).
 *
 * Following the serverless / backend-free pattern: all data lives on the
 * device in localStorage. No server, no login required. Works offline.
 * (An optional Google Sheets sync layer can be added later — see ARCHITECTURE.md.)
 */
const Store = (() => {
  const KEY = "thekedar.dashboard.v1";

  const empty = () => ({ workers: [], entries: [], settings: {} });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      return {
        workers: Array.isArray(data.workers) ? data.workers : [],
        entries: Array.isArray(data.entries) ? data.entries : [],
        settings: data.settings || {},
      };
    } catch (e) {
      console.error("Failed to load data", e);
      return empty();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let db = load();

  return {
    // ---- Workers ----
    getWorkers: () => [...db.workers],
    getWorker: (id) => db.workers.find((w) => w.id === id) || null,
    addWorker(worker) {
      const w = { id: uid(), active: true, createdAt: Date.now(), ...worker };
      db.workers.push(w);
      save(db);
      return w;
    },
    updateWorker(id, patch) {
      const w = db.workers.find((x) => x.id === id);
      if (!w) return null;
      Object.assign(w, patch);
      save(db);
      return w;
    },
    deleteWorker(id) {
      db.workers = db.workers.filter((w) => w.id !== id);
      db.entries = db.entries.filter((e) => e.workerId !== id);
      save(db);
    },

    // ---- Entries ----
    getEntries: () => [...db.entries],
    getEntriesBetween(startISO, endISO) {
      return db.entries.filter((e) => e.date >= startISO && e.date <= endISO);
    },
    addEntry(entry) {
      const e = { id: uid(), createdAt: Date.now(), ...entry };
      db.entries.push(e);
      save(db);
      return e;
    },
    deleteEntry(id) {
      db.entries = db.entries.filter((e) => e.id !== id);
      save(db);
    },

    // ---- Settings ----
    getSetting: (k, fallback) => (k in db.settings ? db.settings[k] : fallback),
    setSetting(k, v) {
      db.settings[k] = v;
      save(db);
    },

    // ---- Utilities ----
    exportJSON: () => JSON.stringify(db, null, 2),
    reload() {
      db = load();
    },
  };
})();
