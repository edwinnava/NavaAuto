// Persistence: small state in localStorage, file attachments (diagrams/PDFs) in IndexedDB.
const Store = (() => {
  const KEY = 'navaauto.v1';
  const defaults = () => ({
    vehicles: [
      { id: 'v-q50', year: 2018, make: 'INFINITI', model: 'Q50', engine: '3.0t (VR30DDTT)', nickname: 'My Q50', mileage: '' }
    ],
    settings: { laborRate: 150, partsMarkup: 40, currency: 'USD' },
    progress: {},   // "vid:rid" -> [bool per step]
    notes: {},      // "vid:rid" -> string
    videos: {},     // "vid:rid" -> [{ url, title }]
    custom: [],     // user-authored repairs (same shape as repairs.json + vid)
    log: []         // { id, vid, rid, title, date, miles, cost, notes }
  });

  let state;
  try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { state = defaults(); }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  };

  // ---- IndexedDB attachments ----
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const req = indexedDB.open('navaauto', 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore('files', { keyPath: 'id' });
      s.createIndex('key', 'key');
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));

  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('files', mode);
      const out = fn(t.objectStore('files'));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  };

  const files = {
    add: (key, file) => tx('readwrite', s => s.put({
      id: 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      key, name: file.name, type: file.type, blob: file, added: Date.now()
    })),
    list: key => tx('readonly', s => s.index('key').getAll(key)),
    all: () => tx('readonly', s => s.getAll()),
    remove: id => tx('readwrite', s => s.delete(id)),
    put: rec => tx('readwrite', s => s.put(rec))
  };

  return {
    get state() { return state; },
    save,
    reset() { state = defaults(); save(); },
    replace(next) { state = Object.assign(defaults(), next); save(); },
    files,
    uid: p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  };
})();
