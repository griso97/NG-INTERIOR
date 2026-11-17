// =============================================================================
// BOZZA DELLA SCHEDA OGGETTO — NG INTERIOR
// Le foto già scontornate (e quella in lavorazione) restano salvate sul telefono
// mentre la scheda è aperta: se il telefono ricarica la pagina (iPhone lo fa quando
// la memoria finisce) le foto non si perdono e la scheda si riapre da sola.
// Archivio a parte ('ng-bozze'): non finisce nel catalogo né nella copia completa.
// =============================================================================

const DB = 'ng-bozze', STORE = 'kv', CHIAVE = 'oggetto';
const VALIDITA = 2 * 864e5;              // una bozza più vecchia di 2 giorni non si riprende

function apri() {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') { ko(new Error('IndexedDB non disponibile')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function op(modo, fn) {
  const db = await apri();
  try {
    return await new Promise((ok, ko) => {
      const t = db.transaction(STORE, modo), r = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
    });
  } finally { db.close(); }
}

// le scritture vanno in fila (l'ultima vince, mai due insieme)
let _coda = Promise.resolve();
/** Salva (sostituisce) la bozza. Gli errori non fermano niente: è solo una sicurezza. */
export function salvaBozza(bozza) {
  _coda = _coda.then(() => op('readwrite', (s) => s.put({ ...bozza, quando: Date.now() }, CHIAVE))).catch(() => {});
  return _coda;
}
/** La bozza, se c'è e non è vecchia; altrimenti null. */
export async function leggiBozza() {
  await _coda;
  try {
    const b = await op('readonly', (s) => s.get(CHIAVE));
    return b && Date.now() - (b.quando || 0) < VALIDITA ? b : null;
  } catch (_) { return null; }
}
export function cancellaBozza() {
  _coda = _coda.then(() => op('readwrite', (s) => s.delete(CHIAVE))).catch(() => {});
  return _coda;
}
