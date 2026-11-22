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
  // REGLETTA D'ANGOLO (cucina): quanto se ne vede (3 × 3 cm) e lo spessore dell'anta. I due pezzi:
  // uno largo quanto si vede (30) e l'altro + lo spessore dell'anta (30 + 18 = 48), che sormonta il primo
  regletta: {
    vista: 30,
    spessoreAnta: 18,
  },
  // CUCINA: piedini di partenza di ogni cucina nuova (0 = automatico: bassi da 70 → 15 cm, da 80 → 10 cm)
  cucina: {
    piedini: 0,
  },
  // BINARI degli armadi scorrevoli: ognuno con i suoi numeri per calcolare le ante.
  //   larghezza anta = larghezza esterna ÷ n° ante − larghezzaMeno − profilo
  //   (di partenza: l'anta è larga come il modulo, es. armadio 1000 a 2 moduli → 500;
  //    ogni falegname toglie poi quello che serve al suo binario)
  //   altezza anta   = altezza esterna totale − altezzaMeno
  //   profilo = i profili verticali sui due lati di ogni anta (si toglie alla larghezza)
  binari: [
    { id: 'syscore', nome: 'Syscore', larghezzaMeno: 0, altezzaMeno: 82, maniglia: 0 },
  ],
  // ANTE INTERNE degli armadi a battente (l'anta sta DENTRO il vano, a filo della struttura):
  //   anta larga = (modulo − 2 fianchi − aria × (n° ante + 1)) ÷ n° ante
  //   anta alta  = altezza − top − fondo − 2 × aria
  //   ripiani    = profondità − anta − schiena − spazioRipiano (stanno più indietro dell'anta)
  anteInterne: {
    aria: 2,              // mm attorno a ogni anta e fra un'anta e l'altra
    spazioRipiano: 10,    // mm liberi fra l'anta chiusa e il ripiano
  },
  // COME MONTI GLI ARMADI: valori di partenza di ogni armadio nuovo (nel singolo armadio si cambiano)
  armadi: {
    setup: 1,             // struttura: 1 = top e fondo sopra e sotto i fianchi (standard) · 2 = fianchi esterni, top e fondo dentro
    ante: 'sopra',        // ante a battente: 'sopra' la struttura (normali) · 'interne' (dentro il vano)
    schiena: 'dietro',    // 'dietro' avvitata dietro · 'filo' incassata a filo del retro · 'canale' nel canale
    spessoreSchiena: 10,  // mm
    canale: 8,            // mm: profondità del canale (la schiena entra tanto per lato)
    dentro: 10,           // mm: quanto dentro sta la schiena (dal retro dei fianchi al canale)
  },
  // IMPOSTAZIONI SALTATE nella configurazione guidata («lo imposto dopo»): restano a 0 e la distinta
  // avvisa che mancano. Si tolgono da qui appena il falegname le imposta in ⚙ Parametri.
  daImpostare: [],
  // ARMADI SCORREVOLI: la struttura si fa come il battente (uguale) o in un altro modo (stesse domande)
  scorrevoli: {
    uguale: true,         // true = struttura e schiena come gli armadi a battente
    setup: 1, schiena: 'dietro', spessoreSchiena: 10, canale: 8, dentro: 10,
  },
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
  const mancano = [...new Set((Array.isArray(s && s.daImpostare) ? s.daImpostare : []).filter((g) => g in GRUPPI_DA_IMPOSTARE))];
  const visti = new Set();
  // v3: la larghezza delle ante scorrevoli parte dal modulo intero (prima si toglievano i fianchi e 35):
  // il vecchio numero di partenza di Syscore (35) torna a 0; i numeri scritti dal falegname restano
  const vecchi = s && (s.v || 1) < 3;
  const binari = (Array.isArray(s && s.binari) ? s.binari : []).filter((b) => b && typeof b === 'object').map((b, i) => {
    if (vecchi && b.id === 'syscore' && Number(b.larghezzaMeno) === 35) b = { ...b, larghezzaMeno: 0 };
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
    v: 3,
    ante: {
      ariaAltezza: Math.max(0, num(a.ariaAltezza, D.ante.ariaAltezza)),
      ariaLarghezza: Math.max(0, num(a.ariaLarghezza, D.ante.ariaLarghezza)),
      ariaTraAnte: Math.max(0, num(a.ariaTraAnte, D.ante.ariaTraAnte)),
      ariaCassetti: Math.max(0, num(a.ariaCassetti, D.ante.ariaCassetti)),
    },
    manigliaJ: { spessore: Math.max(0, num(j.spessore, D.manigliaJ.spessore)) },
    daImpostare: mancano,
    // saltate («lo imposto dopo»): restano a 0 finché non si impostano
    gola: { spazio: Math.max(mancano.includes('gola') ? 0 : 10, Math.min(60, num(go.spazio, D.gola.spazio))) },
    regletta: {
      vista: Math.max(mancano.includes('regletta') ? 0 : 5, num(((s && s.regletta) || {}).vista, D.regletta.vista)),
      spessoreAnta: Math.max(0, num(((s && s.regletta) || {}).spessoreAnta, D.regletta.spessoreAnta)),
    },
    binari: binari.length ? binari : D.binari.map((b) => ({ ...b })),
    cucina: { piedini: [100, 150].includes(Number(((s && s.cucina) || {}).piedini)) ? Number(s.cucina.piedini) : 0 },
    armadi: (() => { const a = (s && s.armadi) || {}, d = D.armadi; return {
      setup: Number(a.setup) === 2 ? 2 : 1,
      ante: a.ante === 'interne' ? 'interne' : 'sopra',
      schiena: ['filo', 'canale'].includes(a.schiena) ? a.schiena : 'dietro',
      spessoreSchiena: Math.max(1, num(a.spessoreSchiena, d.spessoreSchiena)),
      canale: Math.max(0, num(a.canale, d.canale)),
      dentro: Math.max(0, num(a.dentro, d.dentro)),
    }; })(),
    scorrevoli: (() => { const a = (s && s.scorrevoli) || {}, d = D.scorrevoli; return {
      uguale: a.uguale !== false,
      setup: Number(a.setup) === 2 ? 2 : 1,
      schiena: ['filo', 'canale'].includes(a.schiena) ? a.schiena : 'dietro',
      spessoreSchiena: Math.max(1, num(a.spessoreSchiena, d.spessoreSchiena)),
      canale: Math.max(0, num(a.canale, d.canale)),
      dentro: Math.max(0, num(a.dentro, d.dentro)),
    }; })(),
    anteInterne: {
      aria: Math.max(0, num(((s && s.anteInterne) || {}).aria, D.anteInterne.aria)),
      spazioRipiano: Math.max(0, num(((s && s.anteInterne) || {}).spazioRipiano, D.anteInterne.spazioRipiano)),
    },
    cassetti: {
      marca: String(c.marca ?? D.cassetti.marca).trim(),
      profondita: Math.max(0, num(c.profondita, D.cassetti.profondita)),
      spessore: Math.max(1, num(c.spessore, D.cassetti.spessore)),
      fondoMeno: num(c.fondoMeno, D.cassetti.fondoMeno),
      fondoProfondita: Math.max(mancano.includes('cassetti') ? 0 : 1, num(c.fondoProfondita, D.cassetti.fondoProfondita)),
      traseraMeno: num(c.traseraMeno, D.cassetti.traseraMeno),
      piccoloFinoA: Math.max(0, num(c.piccoloFinoA, D.cassetti.piccoloFinoA)),
      piccoloTrasera: Math.max(mancano.includes('cassetti') ? 0 : 1, num(c.piccoloTrasera, D.cassetti.piccoloTrasera)),
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

/**
 * Come si monta un armadio di quel tipo ('battente' | 'scorrevole'): struttura e schiena.
 * Lo scorrevole usa le scelte del battente se in ⚙ Parametri hai detto che la struttura è uguale.
 */
export function montaggioArmadio(tipo, P = parametri()) {
  const a = tipo === 'scorrevole' && !P.scorrevoli.uguale ? P.scorrevoli : P.armadi;
  return { setup: a.setup, schiena: a.schiena, spessoreSchiena: a.spessoreSchiena, canale: a.canale, dentro: a.dentro };
}

// =============================================================================
// IMPOSTAZIONI DA FARE (saltate nella configurazione guidata con «Salta, lo imposto dopo»)
// =============================================================================
export const GRUPPI_DA_IMPOSTARE = {
  scorrevoli: 'Armadi scorrevoli: struttura e schiena',
  binario: 'Binario degli armadi scorrevoli',
  gola: 'Gola (spazio per le dita)',
  regletta: "Regletta d'angolo",
  cassetti: 'Cassetti: misure di fondo e trasera',
};
/** Le impostazioni ancora da fare (lista di chiavi di GRUPPI_DA_IMPOSTARE). */
export function daImpostare(P = parametri()) { return P.daImpostare || []; }
/** Salta un gruppo: resta a 0 e diventa «da impostare». */
export function saltaImpostazione(gruppo) {
  const n = JSON.parse(JSON.stringify(parametri()));
  if (!n.daImpostare.includes(gruppo)) n.daImpostare.push(gruppo);
  if (gruppo === 'gola') n.gola.spazio = 0;
  if (gruppo === 'regletta') { n.regletta.vista = 0; n.regletta.spessoreAnta = 0; }
  if (gruppo === 'binario' && n.binari[0]) Object.assign(n.binari[0], { larghezzaMeno: 0, altezzaMeno: 0, maniglia: 0 });
  if (gruppo === 'cassetti') Object.assign(n.cassetti, { fondoMeno: 0, fondoProfondita: 0, traseraMeno: 0, piccoloTrasera: 0, medioTrasera: null, grandeTrasera: null });
  return salvaParametri(n);
}
/** Il gruppo è stato impostato: l'avviso sparisce. */
export function segnaImpostato(...gruppi) {
  const P = parametri();
  if (!gruppi.some((g) => P.daImpostare.includes(g))) return P;
  const n = JSON.parse(JSON.stringify(P));
  n.daImpostare = n.daImpostare.filter((g) => !gruppi.includes(g));
  return salvaParametri(n);
}
