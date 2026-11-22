// =============================================================================
// COPIA COMPLETA — NG INTERIOR
// Tutto quello che c'è su QUESTO dispositivo in un file solo, per portarlo su un
// altro (es. dal computer al telefono): progetti aperti (cucina, ponte, armadi,
// modulari), catalogo (colori, maniglie, oggetti aggiunti, con le loro foto),
// preventivi e impostazioni (lingua, tema). Niente server: il file lo porti tu
// (AirDrop, WhatsApp, mail, iCloud) e lo carichi sull'altro dispositivo.
// =============================================================================

// impostazioni che valgono solo per il dispositivo dove sono nate (velocità del 3D, larghezze…)
const SOLO_QUI = new Set(['ng-3d-livello-fermo', 'ng-3d-fermo-v2', 'ng-3d-moto-v2', 'ng-3d-moto-livello', 'ng-3d-ao-leggera', 'ng-3d-fluidita', 'ng-catalogo-agg', 'ng-distinta-width',
  'ng-ia-in-corso', 'ng-ia-chiusure', 'ng-ia-no']);

function apriDb(nome, versione, crea) {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') { ko(new Error('IndexedDB non disponibile')); return; }
    const r = indexedDB.open(nome, versione);
    r.onupgradeneeded = () => crea(r.result);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
const dbCatalogo = () => apriDb('ng-catalogo', 1, (db) => { if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); });
const dbPreventivi = () => apriDb('ng-preventivi', 1, (db) => { if (!db.objectStoreNames.contains('preventivi')) db.createObjectStore('preventivi', { keyPath: 'id' }); });

/** Tutte le coppie [chiave, valore] di un archivio. */
function tutto(db, store) {
  return new Promise((ok, ko) => {
    const out = [], r = db.transaction(store, 'readonly').objectStore(store).openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) { ok(out); return; } out.push([c.key, c.value]); c.continue(); };
    r.onerror = () => ko(r.error);
  });
}
function scrivi(db, store, coppie, conChiave) {
  return new Promise((ok, ko) => {
    const t = db.transaction(store, 'readwrite'), st = t.objectStore(store);
    for (const [k, v] of coppie) { if (conChiave) st.put(v, k); else st.put(v); }
    t.oncomplete = () => ok(); t.onerror = () => ko(t.error);
  });
}

// foto (Blob) ↔ testo dentro il file
const blobInTesto = (b) => new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok({ __foto: f.result }); f.onerror = () => ko(f.error); f.readAsDataURL(b); });
async function testoInBlob(v) { return (await fetch(v.__foto)).blob(); }
async function versoFile(v) {
  if (v instanceof Blob) return blobInTesto(v);
  if (Array.isArray(v)) return Promise.all(v.map(versoFile));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await versoFile(x); return o; }
  return v;
}
async function dalFile(v) {
  if (v && typeof v === 'object' && typeof v.__foto === 'string' && Object.keys(v).length === 1) return testoInBlob(v);
  if (Array.isArray(v)) return Promise.all(v.map(dalFile));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await dalFile(x); return o; }
  return v;
}

/** Prepara e scarica il file con TUTTO. Ritorna i numeri di cosa c'è dentro. */
export async function scaricaCopiaCompleta() {
  const locale = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ng-') && !SOLO_QUI.has(k)) locale[k] = localStorage.getItem(k);
  }
  let catalogo = [], preventivi = [];
  try { const db = await dbCatalogo(); catalogo = await versoFile(await tutto(db, 'kv')); db.close(); } catch (_) { /* niente catalogo */ }
  try { const db = await dbPreventivi(); preventivi = (await tutto(db, 'preventivi')).map(([, v]) => v); db.close(); } catch (_) { /* niente preventivi */ }
  const stato = (catalogo.find(([k]) => k === 'stato') || [])[1] || {};
  const dati = { ngCopiaCompleta: 1, salvato: new Date().toISOString(), locale, catalogo, preventivi };
  const blob = new Blob([JSON.stringify(dati)], { type: 'application/json' });
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `NG-copia-completa-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { progetti: Object.keys(locale).filter((k) => /progetto|ponte|configuratore|modulari/.test(k)).length,
    prodotti: (stato.prodotti || []).length, preventivi: preventivi.length, mb: Math.round(blob.size / 1e5) / 10 };
}

/**
 * Carica una copia completa su questo dispositivo:
 *  - prodotti del catalogo e preventivi: si UNISCONO (se lo stesso c'è da tutte e due le parti
 *    vince il più recente);
 *  - progetti aperti e impostazioni: prendono quelli della copia.
 */
export async function caricaCopiaCompleta(file) {
  const j = JSON.parse(await file.text());
  if (!j || j.ngCopiaCompleta !== 1) throw new Error('Questo file non è una copia completa del sito.');
  // 1) progetti aperti e impostazioni
  let progetti = 0;
  for (const [k, v] of Object.entries(j.locale || {})) {
    if (!k.startsWith('ng-') || SOLO_QUI.has(k) || typeof v !== 'string') continue;
    try { localStorage.setItem(k, v); if (/progetto|ponte|configuratore|modulari/.test(k)) progetti++; } catch (_) { /* spazio pieno */ }
  }
  // 2) catalogo: unione per prodotto (il più recente vince), con le sue foto
  let prodotti = 0;
  if (Array.isArray(j.catalogo) && j.catalogo.length) {
    const db = await dbCatalogo();
    const qui = new Map(await tutto(db, 'kv'));
    const statoQui = qui.get('stato') || { versione: 1, prodotti: [], nascosti: {}, modifiche: {} };
    const arrivo = new Map(j.catalogo);
    const statoArr = arrivo.get('stato') || { prodotti: [] };
    const perId = new Map((statoQui.prodotti || []).map((p) => [p.id, p]));
    const daCopiare = [];
    for (const p of statoArr.prodotti || []) {
      const c = perId.get(p.id);
      if (!c || (p.aggiornato || 0) > (c.aggiornato || 0)) { perId.set(p.id, p); daCopiare.push(p.id); prodotti++; }
    }
    const nascosti = { ...(statoQui.nascosti || {}) };
    for (const [sez, l] of Object.entries(statoArr.nascosti || {})) nascosti[sez] = [...new Set([...(nascosti[sez] || []), ...l])];
    const nuovoStato = { ...statoQui, prodotti: [...perId.values()], nascosti, modifiche: { ...(statoQui.modifiche || {}), ...(statoArr.modifiche || {}) } };
    const coppie = [['stato', nuovoStato]];
    // CUCINE DI ESEMPIO modificate (esempio:<id> + le sue foto): vince la versione salvata più di recente
    for (const [k, v] of arrivo) {
      if (!String(k).startsWith('esempio:')) continue;
      const id = String(k).slice(8), c = qui.get(k);
      if (!c || ((v && v.aggiornato) || 0) > ((c && c.aggiornato) || 0)) daCopiare.push(id);
    }
    for (const [k, v] of arrivo) {
      if (k === 'stato') continue;
      const id = String(k).slice(String(k).indexOf(':') + 1);
      if (daCopiare.includes(id) || !qui.has(k)) coppie.push([k, await dalFile(v)]);
    }
    await scrivi(db, 'kv', coppie, true);
    db.close();
    try { localStorage.setItem('ng-catalogo-agg', String(Date.now())); } catch (_) { /* niente */ }
  }
  // 3) preventivi: unione (il più recente vince)
  let preventivi = 0;
  if (Array.isArray(j.preventivi) && j.preventivi.length) {
    const db = await dbPreventivi();
    const qui = new Map((await tutto(db, 'preventivi')).map(([, v]) => [v.id, v]));
    const nuovi = j.preventivi.filter((p) => p && p.id && (!qui.has(p.id) || (p.aggiornato || 0) > (qui.get(p.id).aggiornato || 0)));
    await scrivi(db, 'preventivi', nuovi.map((p) => [p.id, p]), false);
    preventivi = nuovi.length;
    db.close();
  }
  return { progetti, prodotti, preventivi };
}
