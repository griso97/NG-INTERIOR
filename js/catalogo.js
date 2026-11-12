// =============================================================================
// CATALOGO PRODOTTI — archivio della carpinteria
// =============================================================================
// Cosa contiene:
//   - prodotti PROPRI (aggiunti con una foto del campione + misure reali);
//   - prodotti NASCOSTI per sezione (un prodotto può sparire solo da una
//     sezione, es. dal Finger-pull, e restare nelle altre);
//   - modifiche ai prodotti predefiniti (nome, tipo, spessore, colore…).
// Le foto stanno a parte (Blob) per non appesantire i dati.
//
// Oggi l'archivio è nel browser (IndexedDB). Le funzioni qui sotto sono le
// sole porte d'accesso: per il salvataggio online si cambia solo questo file.
// Nessuna dipendenza da three.js: lo usano anche le pagine senza 3D.
// =============================================================================

export const SEZIONI = [
  { id: 'legno',      nome: 'Legni e colori',           desc: 'Ante e frontali di cucina, armadi e mobili modulari.' },
  { id: 'fingerpull', nome: 'Finger-pull',              desc: 'Ante con gola finger-pull. Ogni legno o colore crea in automatico il suo finger-pull.' },
  { id: 'encimera',   nome: 'Encimere',                 desc: 'Piani di lavoro della cucina.' },
  { id: 'pannello',   nome: 'Pannello dietro il piano', desc: 'Materiali per il pannello tra piano di lavoro e pensili. Prende in automatico legni, colori ed encimere.' },
  { id: 'zoccolo',    nome: 'Zoccoli',                  desc: 'Colori e materiali dello zoccolo della cucina.' },
  { id: 'maniglie',   nome: 'Maniglie',                 desc: 'Maniglie applicate alle ante quando si sceglie la maniglia.' },
];

const DB = 'ng-catalogo', STORE = 'kv', VERSIONE = 1;
const VUOTO = () => ({ versione: 1, prodotti: [], nascosti: {}, modifiche: {} });

let dbPromessa = null;
function apri() {
  if (dbPromessa) return dbPromessa;
  dbPromessa = new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') { ko(new Error('IndexedDB non disponibile')); return; }
    const r = indexedDB.open(DB, VERSIONE);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return dbPromessa;
}
async function get(k) {
  const db = await apri();
  return new Promise((ok, ko) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function put(k, v) {
  const db = await apri();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(v, k);
    t.oncomplete = () => ok(); t.onerror = () => ko(t.error);
  });
}
async function del(k) {
  const db = await apri();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(k);
    t.oncomplete = () => ok(); t.onerror = () => ko(t.error);
  });
}

/** Stato del catalogo ({ prodotti, nascosti, modifiche }). Mai errori: al peggio vuoto. */
export async function leggiCatalogo() {
  try {
    const s = await get('stato');
    return s && typeof s === 'object' ? { ...VUOTO(), ...s } : VUOTO();
  } catch { return VUOTO(); }
}
export async function salvaCatalogo(stato) { await put('stato', stato); avvisaCambio(); }

export async function leggiFoto(id, tipo = 'foto') { try { return await get(`${tipo}:${id}`); } catch { return null; } }
export async function salvaFoto(id, blob, tipo = 'foto') { await put(`${tipo}:${id}`, blob); }
export async function eliminaFoto(id) { await del(`foto:${id}`); await del(`thumb:${id}`); }

/** Nascosto in quella sezione? */
export function nascosto(stato, sezione, id) { return ((stato.nascosti || {})[sezione] || []).includes(id); }
export function impostaNascosto(stato, sezione, id, si) {
  const l = new Set((stato.nascosti || {})[sezione] || []);
  if (si) l.add(id); else l.delete(id);
  stato.nascosti = { ...(stato.nascosti || {}), [sezione]: [...l] };
}

export const nuovoId = () => 'cat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Le pagine aperte si aggiornano quando il catalogo cambia (anche da un'altra scheda)
const CANALE = 'ng-catalogo';
let bc = null;
try { bc = new BroadcastChannel(CANALE); } catch { /* browser vecchio */ }
function avvisaCambio() { try { bc && bc.postMessage('cambiato'); localStorage.setItem('ng-catalogo-agg', String(Date.now())); } catch { /* niente */ } }
export function quandoCambia(fn) {
  try { bc && bc.addEventListener('message', fn); } catch { /* niente */ }
  window.addEventListener('storage', (e) => { if (e.key === 'ng-catalogo-agg') fn(); });
}

// ---------------------------------------------------------------------------
// Foto → texture e miniatura (stessi pixel, nessuna correzione di colore)
// ---------------------------------------------------------------------------
/**
 * img: HTMLImageElement/ImageBitmap; ritaglio {x,y,w,h} in pixel dell'immagine.
 * Ritorna { foto: Blob (lato max 2048), thumb: Blob (192×192), colore: 0xRRGGBB }.
 * Si ridimensiona solo se la foto è enorme; i colori non vengono toccati.
 */
export async function preparaFoto(img, ritaglio) {
  const r = ritaglio || { x: 0, y: 0, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  const MAX = 2048;
  const k = Math.min(1, MAX / Math.max(r.w, r.h));
  const W = Math.max(1, Math.round(r.w * k)), H = Math.max(1, Math.round(r.h * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, W, H);
  const foto = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.95));
  // colore medio (per il quadratino mentre la texture si carica)
  const p = document.createElement('canvas'); p.width = p.height = 16;
  p.getContext('2d').drawImage(c, 0, 0, 16, 16);
  const d = p.getContext('2d').getImageData(0, 0, 16, 16).data;
  let R = 0, G = 0, B = 0;
  for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
  const n = d.length / 4;
  const colore = (Math.round(R / n) << 16) | (Math.round(G / n) << 8) | Math.round(B / n);
  // miniatura quadrata dal centro
  const t = document.createElement('canvas'); t.width = t.height = 192;
  const lato = Math.min(W, H);
  t.getContext('2d').drawImage(c, (W - lato) / 2, (H - lato) / 2, lato, lato, 0, 0, 192, 192);
  const thumb = await new Promise((ok) => t.toBlob(ok, 'image/jpeg', 0.9));
  return { foto, thumb, colore };
}
