// =============================================================================
// PARAMETRI DELLA FALEGNAMERIA — i numeri del proprio modo di lavorare
// =============================================================================
// Ogni carpinteria lavora un po' a modo suo: quanta aria lascia alle ante, che
// sistema di cassetti usa (fondo e trasera hanno misure diverse da marca a marca),
// che profilo a J mette sopra le ante. Qui stanno quei numeri: li cambia l'utente in
// ⚙ Impostazioni → Parametri e li usano la distinta e il 3D della cucina.
// Salvati sul dispositivo (localStorage 'ng-parametri'); la «copia completa» li porta
// sull'altro dispositivo insieme a tutto il resto.
// I valori di partenza sono quelli usati finora dal programma (nessun calcolo cambia
// finché l'utente non tocca un numero).
// =============================================================================

const CHIAVE = 'ng-parametri';

export const PARAMETRI_DEFAULT = Object.freeze({
  ante: {
    ariaAltezza: 2,       // mm tolti all'altezza di ogni anta (sopra + sotto): 700 → 698
    ariaLarghezza: 3,     // mm tolti alla larghezza (sui due lati): modulo 600, 1 anta → 597
    ariaTraAnte: 3,       // mm tra due ante dello stesso modulo
    ariaCassetti: 2,      // mm tra un frontale di cassetto e l'altro (e sopra e sotto)
  },
  manigliaJ: {
    spessore: 2,          // mm del profilo a J sopra l'anta: l'anta si accorcia di tanto (700 → 698 → 696)
  },
  gola: {
    spazio: 25,           // mm per le dita con la GOLA in alluminio: dal piano all'anta (profilo L) e fra i cassetti (profilo C)
  },
  // BINARI degli armadi scorrevoli: ognuno con i suoi numeri per calcolare le ante.
  //   larghezza anta = (larghezza esterna − 2 fianchi) ÷ n° ante − larghezzaMeno
  //   altezza anta   = altezza esterna totale − altezzaMeno
  //   con la maniglia alta come l'anta: larghezza anta − maniglia
  binari: [
    { id: 'syscore', nome: 'Syscore', larghezzaMeno: 35, altezzaMeno: 82, maniglia: 0 },
  ],
  cassetti: {
    marca: 'Syscore',     // sistema di cassetti usato (scritto nella lista accessori)
    profondita: 500,      // mm: cassetto / guide
    spessore: 16,         // mm: fondo e trasera (melaminico)
    fondoMeno: 53,        // fondo: larghezza = modulo − fondoMeno
    fondoProfondita: 480, // fondo: profondità (sempre uguale)
    traseraMeno: 72,      // trasera: larghezza = modulo − traseraMeno
    piccoloFinoA: 155,    // frontale fino a… mm → cassetto piccolo
    piccoloTrasera: 59,   // altezza trasera del cassetto piccolo
    medioFinoA: null,     // frontale fino a… mm → cassetto medio (vuoto = tutti i frontali più alti del piccolo)
    medioTrasera: 155,    // altezza trasera del cassetto medio
    grandeTrasera: null,  // altezza trasera del cassetto grande (vuoto = non si usa; frontali più alti del medio)
  },
});

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== null ? n : d; };
const numVuoto = (v) => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/** Unisce i valori salvati con quelli di partenza (un numero mancante o sbagliato → quello di partenza). */
function completa(s) {
  // prima versione: il cassetto da 155 si chiamava «grande» e il medio era vuoto → ora è il MEDIO
  if (s && s.cassetti && !s.v && s.cassetti.medioTrasera == null && Number(s.cassetti.grandeTrasera) > 0) {
    s = { ...s, cassetti: { ...s.cassetti, medioTrasera: s.cassetti.grandeTrasera, grandeTrasera: null } };
  }
  const D = PARAMETRI_DEFAULT, a = (s && s.ante) || {}, j = (s && s.manigliaJ) || {}, c = (s && s.cassetti) || {}, go = (s && s.gola) || {};
  const visti = new Set();
  const binari = (Array.isArray(s && s.binari) ? s.binari : []).filter((b) => b && typeof b === 'object').map((b, i) => {
    let id = String(b.id || '').trim() || `b${i}`;
    while (visti.has(id)) id += 'x';
    visti.add(id);
    return {
      id, nome: String(b.nome ?? '').trim(),
      larghezzaMeno: Math.max(0, num(b.larghezzaMeno, 0)),
      altezzaMeno: Math.max(0, num(b.altezzaMeno, 0)),
      maniglia: Math.max(0, num(b.maniglia, 0)),
    };
  });
  return {
    v: 2,
    ante: {
      ariaAltezza: Math.max(0, num(a.ariaAltezza, D.ante.ariaAltezza)),
      ariaLarghezza: Math.max(0, num(a.ariaLarghezza, D.ante.ariaLarghezza)),
      ariaTraAnte: Math.max(0, num(a.ariaTraAnte, D.ante.ariaTraAnte)),
      ariaCassetti: Math.max(0, num(a.ariaCassetti, D.ante.ariaCassetti)),
    },
    manigliaJ: { spessore: Math.max(0, num(j.spessore, D.manigliaJ.spessore)) },
    gola: { spazio: Math.max(10, Math.min(60, num(go.spazio, D.gola.spazio))) },
    binari: binari.length ? binari : D.binari.map((b) => ({ ...b })),
    cassetti: {
      marca: String(c.marca ?? D.cassetti.marca).trim(),
      profondita: Math.max(0, num(c.profondita, D.cassetti.profondita)),
      spessore: Math.max(1, num(c.spessore, D.cassetti.spessore)),
      fondoMeno: num(c.fondoMeno, D.cassetti.fondoMeno),
      fondoProfondita: Math.max(1, num(c.fondoProfondita, D.cassetti.fondoProfondita)),
      traseraMeno: num(c.traseraMeno, D.cassetti.traseraMeno),
      piccoloFinoA: Math.max(0, num(c.piccoloFinoA, D.cassetti.piccoloFinoA)),
      piccoloTrasera: Math.max(1, num(c.piccoloTrasera, D.cassetti.piccoloTrasera)),
      medioFinoA: 'medioFinoA' in c ? numVuoto(c.medioFinoA) : D.cassetti.medioFinoA,
      medioTrasera: 'medioTrasera' in c ? numVuoto(c.medioTrasera) : D.cassetti.medioTrasera,
      grandeTrasera: 'grandeTrasera' in c ? numVuoto(c.grandeTrasera) : D.cassetti.grandeTrasera,
    },
  };
}

let _cache = null;
/** I parametri in uso (sempre completi). */
export function parametri() {
  if (_cache) return _cache;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch (_) { s = null; }
  _cache = completa(s);
  return _cache;
}
/** Salva (e completa) i parametri. */
export function salvaParametri(p) {
  _cache = completa(p);
  try { localStorage.setItem(CHIAVE, JSON.stringify(_cache)); } catch (_) { /* spazio pieno: restano in memoria */ }
  return _cache;
}
/** Torna ai valori di partenza. */
export function ripristinaParametri() {
  try { localStorage.removeItem(CHIAVE); } catch (_) { /* niente */ }
  _cache = null; return parametri();
}
// un'altra scheda (o la copia completa) ha cambiato i parametri: si rileggono
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === CHIAVE || e.key === null) _cache = null; });

/** I binari degli armadi scorrevoli (almeno uno). */
export function binariScorrevoli(p = parametri()) { return p.binari; }
/** Il binario scelto (per id); se non c'è più, il primo dell'elenco. */
export function binarioScorrevole(id, p = parametri()) {
  return p.binari.find((b) => b.id === id) || p.binari[0];
}

/** Che cassetto è (dall'altezza del frontale): 'piccolo' | 'medio' | 'grande', con l'altezza della trasera.
 *  piccolo: frontale fino a piccoloFinoA · grande (solo se ha la sua trasera): frontale più alto del
 *  medio (medioFinoA) · medio: tutti gli altri. Un tipo senza trasera non si usa. */
export function tipoCassetto(hFrontale, p = parametri()) {
  const c = p.cassetti;
  const piccolo = { tipo: 'piccolo', trasera: c.piccoloTrasera }, medio = c.medioTrasera ? { tipo: 'medio', trasera: c.medioTrasera } : null;
  const grande = c.grandeTrasera ? { tipo: 'grande', trasera: c.grandeTrasera } : null;
  if (hFrontale <= c.piccoloFinoA) return piccolo;
  if (grande && (!medio || (c.medioFinoA && hFrontale > c.medioFinoA))) return grande;
  return medio || grande || piccolo;
}
