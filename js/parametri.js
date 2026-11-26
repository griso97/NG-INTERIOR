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
  // FINGER-PULL (cucina, al posto della maniglia): 'fresato' = anta intera, la presa si scava nel bordo;
  // 'profilo' = profilo in alluminio sul bordo dell'anta, che si accorcia di «profilo» mm
  fingerPull: { tipo: 'fresato', profilo: 25 },
  manigliaJ: {
    spessore: 2,          // mm del profilo a J sopra l'anta: l'anta si accorcia di tanto (700 → 698 → 696)
  },
  // GOLA: la prima è quella di partenza; goleAltre = altre marche / modelli, ognuna con le sue misure
  gola: {
    id: 'syskor', nome: 'Syskor',
    spazio: 25,           // mm per le dita con la GOLA in alluminio: dal piano all'anta (profilo L) e fra i cassetti (profilo C)
    spazioV: 30,          // mm fra colonna e colonna (o costado) per la gola VERTICALE
    accorcia: 12,         // mm di cui si accorcia il fianco della colonna dal lato della gola
    centrale16: 62.6, centrale18: 66.6,   // larghezza del profilo verticale centrale (fianchi da 16 / 18)
    laterale16: 46.3, laterale18: 48.3,   // larghezza del profilo verticale laterale (fianchi da 16 / 18)
    barra: 4000,          // mm: barre dei profili L e C
    barraV: 2600,         // mm: barre dei profili verticali delle colonne
  },
  goleAltre: [],
  // REGLETTA D'ANGOLO (cucina): quanto se ne vede (3 × 3 cm) e lo spessore dell'anta. I due pezzi:
  // uno largo quanto si vede (30) e l'altro + lo spessore dell'anta (30 + 18 = 48), che sormonta il primo
  //   i due pezzi sono spessi come le ANTE; dietro, 2 PANNELLINI in melaminico (bianco o antracite come
  //   l'interno dei mobili) alti come la regletta e profondi «pannellinoProfondita»
  regletta: {
    vista: 30,
    spessoreAnta: 18,
    pannellinoProfondita: 30,
    pannellinoSpessore: 16,
  },
  // CUCINA: piedini di partenza di ogni cucina nuova (0 = automatico: bassi da 70 → 15 cm, da 80 → 10 cm)
  cucina: {
    piedini: 0,
    // ZOCCOLO: in distinta ogni pezzo è più lungo di questo margine (per tagliarlo sul posto); il 3D no
    margineZoccolo: 100,
    // ZOCCOLO: lunghezza massima di un pezzo (le barre da 4 m): un tratto più lungo va in più pezzi da giuntare
    zoccoloMax: 4000,
    // PIANO DI LAVORO: profondità (mm, dal muro: si appoggia al muro come i mobili; di serie 625 = 25 davanti
    // alle ante dei mobili da 600); sui lati niente sporgenza. Alzatina sul muro sì/no e altezza
    profonditaPiano: 625,
    // CERNIERE DEI PENSILI (misura standard 95 da sopra e 95 da sotto): con l'anta che scende di più
    // (72, 92 o personalizzata) sotto si aggiungono da soli i mm in più (92 → 115)
    cernieraSopra: 95,
    cernieraSotto: 95,
    // PENSILE ANGOLO a L: anta grande (fino all'angolo) = lato − profondità pensile − aria;
    // anta piccola (contro la grande) = la stessa misura − spessore dell'anta (regletta) − giunto. 63×63 → 295 e 276
    angoloAria: 5,
    angoloGiunto: 1,
    // CIAFLAN (un'anta sola in diagonale): larghezza dell'anta del 63×63 (diagonale fra due pensili da 33 = 424, − 3)
    ciaflanAnta: 421,
    // ANTE DEI PENSILI CHE SCENDONO sotto il mobile (per aprirle da sotto): ogni voce = pensili alti «altezza»
    // (0 = tutti i pensili) → l'anta scende di «scende» mm. Si scelgono in ogni cucina (Ante pensili)
    anteScendono: [
      { id: 'sporg70', altezza: 700, scende: 20 },
      { id: 'sporg90', altezza: 900, scende: 20 },
    ],
    alzatina: false,
    altezzaAlzatina: 100,
  },
  // BINARI degli armadi scorrevoli: ognuno con i suoi numeri per calcolare le ante.
  //   porta (finita, con i tiradores) = larghezza esterna ÷ n° ante − larghezzaMeno; anta (pannello) = porta − 2 × tirador per lato
  //   (di partenza: l'anta è larga come il modulo, es. armadio 1000 a 2 moduli → 500;
  //    ogni falegname toglie poi quello che serve al suo binario)
  //   altezza anta   = altezza esterna totale − altezzaMeno
  //   profilo = i profili verticali sui due lati di ogni anta (si toglie alla larghezza)
  //   profondita = spazio che prende il binario davanti (mm): si sceglie in ogni armadio fra queste (la prima di partenza)
  binari: [
    { id: 'syscore', nome: 'Syscore', larghezzaMeno: 0, altezzaMeno: 82, maniglia: 0, profondita: [75, 85] },
  ],
  // TIRADORES degli armadi scorrevoli: il profilo a tutta altezza sui due lati di ogni anta (niente
  // maniglie che sporgono: le ante scorrono una dietro l'altra). Ognuno con nome, misure e forma.
  //   togli = mm tolti alla larghezza di ogni anta per i profili · larghezza = faccia che si vede
  //   sporgenza = quanto esce davanti e dietro l'anta · forma = come si vede nel 3D
  tiradori: [
    { id: 'syskor', nome: 'Syskor', lato: 0, togli: 0, larghezza: 22, sporgenza: 4, forma: 'avvolgente' },
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
  // CASSETTIERA DENTRO GLI ARMADI (mm): scatola, fascette che fanno la cornice dei frontali, ripiano sopra (top)
  //   battente:   fascette laterali larghe «fascia» (di piatto; fino allo spessore di taglio, profonde «profTaglio»); scatola = spazio dentro − ariaDavanti − sporgenza maniglia − struttura
  //   scorrevole: fascette laterali larghe «vista» (fino allo spessore di taglio, profonde «fascia»);
  //               scatola = fino al binario − struttura − ariaBinario − sporgenza maniglia
  //   pannellino: fascette di piatto (più larghe dello spessore) → dietro ognuna un pannellino a L, profondo così,
  //               se «pannellinoSi» (1 = sì, in automatico · 0 = no, si fissano in un altro modo)
  //   di partenza MANIGLIA INCASSATA (fresata nel frontale): non sporge niente; con la maniglia esterna la
  //   sporgenza si scrive nella cassettiera (senza, l'esportazione avvisa)
  //   frontali: fuga fra uno e l'altro e ai lati · «ribasso» = quanto più bassi con i frontali ribassati (senza maniglia)
  //   fondo del cassetto = guida − fondoMeno
  // PIEDINI E ZOCCOLO di partenza di ogni armadio / mobile nuovo (nel singolo progetto si cambia):
  //   si = piedini (1 sì · 0 no), altezza dei piedini, zoccolo (1 sì · 0 no, solo con i piedini),
  //   rientro = quanto lo zoccolo sta indietro rispetto al fronte (0 = a filo); rientroCostadi = lo stesso quando
  //   ci sono i costadi fino a terra (lo zoccolo va incassato fra i costadi, come in cucina);
  //   lateraleSx / lateraleDx = zoccolo anche sul fianco (1 sì · 0 no; dove c'è il costado non serve)
  piedini: {
    battente:   { si: 0, altezza: 100, zoccolo: 1, rientro: 0, rientroCostadi: 50, lateraleSx: 0, lateraleDx: 0 },
    scorrevole: { si: 0, altezza: 100, zoccolo: 1, rientro: 0, rientroCostadi: 50, lateraleSx: 0, lateraleDx: 0 },
    modulari:   { si: 0, altezza: 100, zoccolo: 1, rientro: 50, rientroCostadi: 50, lateraleSx: 0, lateraleDx: 0 },
  },
  cassettieraArmadio: {
    battente:   { fascia: 40, fasciaSotto: 40, ariaDavanti: 2, fuga: 2, ribasso: 30, fondoMeno: 20, pannellino: 30, pannellinoSi: 1, profTaglio: 50 },
    scorrevole: { fascia: 50, fasciaSotto: 50, ariaBinario: 2, fuga: 2, ribasso: 30, fondoMeno: 20, vista: 18, pannellino: 30, pannellinoSi: 1 },
  },
  // MOBILI MODULARI (sottoscala, nicchie, mansarde): valori di partenza di ogni progetto nuovo
  //   spessori di struttura, schiena e ante · abbondanza sul lato inclinato (si rifila in opera)
  //   altezzaManiglia: centro delle maniglie da terra, uguale per tutte le ante (come negli armadi)
  modulari: { carcassa: 18, schiena: 10, ante: 18, abbFianchi: 20, abbTop: 40, abbAnte: 20, altezzaManiglia: 1050 },
  // IMPOSTAZIONI SALTATE nella configurazione guidata («lo imposto dopo»): restano a 0 e la distinta
  // avvisa che mancano. Si tolgono da qui appena il falegname le imposta in ⚙ Parametri.
  daImpostare: [],
  // ARMADI SCORREVOLI: la struttura si fa come il battente (uguale) o in un altro modo (stesse domande)
  scorrevoli: {
    uguale: true,         // true = struttura e schiena come gli armadi a battente
    setup: 1, schiena: 'dietro', spessoreSchiena: 10, canale: 8, dentro: 10,
  },
  // CASSETTI: il primo è quello di partenza; cassettiAltri = altre marche (Blum, Novatec…), ognuno con le sue misure
  cassettiAltri: [],
  cassetti: {
    id: 'syskor',
    marca: 'Syscore',     // sistema di cassetti usato (scritto nella lista accessori)
    profondita: 500,      // mm: cassetto / guide (in cucina)
    // GUIDE che si possono usare (mm): negli armadi ogni cassettiera usa la più lunga che entra nella sua profondità
    guide: [500, 400, 350, 300],
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

/**
 * GUIDE DEI CASSETTI: elenco di misure (mm) scritto in ⚙ Parametri («500, 400, 350, 300»), anche come testo;
 * dalla più lunga alla più corta, senza doppioni; vuoto → quelle di partenza.
 */
function elencoGuide(v) { return elencoMm(v, PARAMETRI_DEFAULT.cassetti.guide, 100, 1500, true); }
/**
 * ELENCO DI MISURE (mm) scritto come testo «500, 400» o come lista: misure intere, senza doppioni,
 * fra min e max; dalla più grande alla più piccola (o nell'ordine scritto); vuoto → quelle di partenza.
 */
function elencoMm(v, partenza, min, max, ordina = false) {
  // separate da virgola, punto o spazio (sul telefono la tastiera dei numeri ha solo la virgola)
  const lista = (Array.isArray(v) ? v : String(v ?? '').split(/[^0-9]+/)).map((x) => Math.round(Number(x)))
    .filter((x) => Number.isFinite(x) && x >= min && x <= max);
  const u = [...new Set(lista)];
  if (ordina) u.sort((a, b) => b - a);
  return u.length ? u : [...partenza];
}
/**
 * La GUIDA per una cassettiera profonda `prof` (mm) con questo sistema di cassetti: la più lunga delle sue
 * guide che entra. Se non entra neanche la più corta: { guida: la più corta, entra: false }.
 */
export function guidaPerProfondita(sis, prof) {
  const g = (sis && Array.isArray(sis.guide) && sis.guide.length) ? sis.guide : PARAMETRI_DEFAULT.cassetti.guide;
  const ok = g.find((x) => prof >= x);
  return { guida: ok || g[g.length - 1], entra: ok != null, minima: g[g.length - 1], guide: g };
}
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
  // v4: il profilo delle ante scorrevoli diventa il TIRADOR (con nome, misure e forma): il numero
  // «profili: togli» del primo binario passa al primo tirador
  const v4 = s && (s.v || 1) < 4;
  const maniglia0 = v4 && Array.isArray(s.binari) && s.binari[0] ? Math.max(0, num(s.binari[0].maniglia, 0)) : 0;
  const idUnico = (id, pre, i, visti2) => { let x = String(id || '').trim() || `${pre}${i}`; while (visti2.has(x)) x += 'x'; visti2.add(x); return x; };
  const idsCass = new Set(), idsGola = new Set(), idsTir = new Set();
  const compCassetti = (c, i) => ({
    id: idUnico(c.id || (i === 0 ? 'syskor' : ''), 'c', i, idsCass),
    marca: String(c.marca ?? (i === 0 ? D.cassetti.marca : '')).trim(),
    profondita: Math.max(0, num(c.profondita, D.cassetti.profondita)),
    guide: elencoGuide(c.guide),
    spessore: Math.max(1, num(c.spessore, D.cassetti.spessore)),
    fondoMeno: num(c.fondoMeno, D.cassetti.fondoMeno),
    fondoProfondita: Math.max(i === 0 && mancano.includes('cassetti') ? 0 : 1, num(c.fondoProfondita, D.cassetti.fondoProfondita)),
    traseraMeno: num(c.traseraMeno, D.cassetti.traseraMeno),
    piccoloFinoA: Math.max(0, num(c.piccoloFinoA, D.cassetti.piccoloFinoA)),
    piccoloTrasera: Math.max(i === 0 && mancano.includes('cassetti') ? 0 : 1, num(c.piccoloTrasera, D.cassetti.piccoloTrasera)),
    medioFinoA: 'medioFinoA' in c ? numVuoto(c.medioFinoA) : D.cassetti.medioFinoA,
    medioTrasera: 'medioTrasera' in c ? numVuoto(c.medioTrasera) : D.cassetti.medioTrasera,
    grandeTrasera: 'grandeTrasera' in c ? numVuoto(c.grandeTrasera) : D.cassetti.grandeTrasera,
    // CASSETTO FATTO DA NOI (tipo 'nostro'): la scatola la tagliamo noi
    tipo: c.tipo === 'nostro' ? 'nostro' : 'comprato',
    montaggio: c.montaggio === '3lati' ? '3lati' : '4lati',       // 4 lati + frontale · 3 lati (il frontale fa da davanti)
    spazioGuide: Math.max(0, num(c.spazioGuide, 13)),            // mm per lato per le guide
    spessoreScatola: Math.max(1, num(c.spessoreScatola, 16)),    // fianchi, dietro, davanti
    altezzaModo: c.altezzaModo === 'tipo' ? 'tipo' : 'frontale', // fianchi: frontale meno X, oppure fissi per tipo
    altezzaMeno: Math.max(0, num(c.altezzaMeno, 40)),
    altezzaPiccolo: Math.max(20, num(c.altezzaPiccolo, 80)), altezzaMedio: Math.max(20, num(c.altezzaMedio, 150)), altezzaGrande: Math.max(20, num(c.altezzaGrande, 200)),
    dietroMeno: Math.max(0, num(c.dietroMeno, 0)),               // il dietro è più basso dei fianchi di
    fondoSpessore: Math.max(1, num(c.fondoSpessore, 8)),
    fondoCanale: Math.max(0, num(c.fondoCanale, 8)),             // 0 = fondo avvitato sotto
    fianchiMobile: Math.max(1, num(c.fianchiMobile, 18)),        // cucina: fianchi del mobile (lo spazio dentro = modulo − 2 ×)
    materialeScatola: String(c.materialeScatola ?? 'Melaminico bianco 16').trim(),
    materialeFondo: String(c.materialeFondo ?? 'Compensato 8').trim(),
  });
  const compGola = (g, i) => { const d = D.gola; return {
    id: idUnico(g.id || (i === 0 ? 'syskor' : ''), 'g', i, idsGola),
    nome: String(g.nome ?? (i === 0 ? d.nome : '')).trim(),
    spazio: Math.max(i === 0 && mancano.includes('gola') ? 0 : 10, Math.min(60, num(g.spazio, d.spazio))),
    spazioV: Math.max(10, Math.min(80, num(g.spazioV, d.spazioV))),
    accorcia: Math.max(0, Math.min(40, num(g.accorcia, d.accorcia))),
    centrale16: Math.max(20, num(g.centrale16, d.centrale16)), centrale18: Math.max(20, num(g.centrale18, d.centrale18)),
    laterale16: Math.max(20, num(g.laterale16, d.laterale16)), laterale18: Math.max(20, num(g.laterale18, d.laterale18)),
    barra: Math.max(500, num(g.barra, d.barra)), barraV: Math.max(500, num(g.barraV, d.barraV)),
  }; };
  const FORME_TIRADOR = ['avvolgente', 'piatto', 'tondo'];
  const compTirador = (t, i) => ({
    id: idUnico(t.id || (i === 0 ? 'syskor' : ''), 't', i, idsTir),
    nome: String(t.nome ?? '').trim(),
    // DA TOGLIERE PER LATO: l'anta (pannello) è larga porta − 2 × lato. Prima c'era un solo numero «togli» per
    // tutti e due i lati: diventa metà per lato
    lato: t.lato != null && t.lato !== '' ? Math.max(0, num(t.lato, 0)) : Math.max(0, num(t.togli, 0)) / 2,
    togli: 0,
    larghezza: Math.max(5, Math.min(120, num(t.larghezza, 22))),
    sporgenza: Math.max(0, Math.min(40, num(t.sporgenza, 4))),
    forma: FORME_TIRADOR.includes(t.forma) ? t.forma : 'avvolgente',
  });
  const tiradoriS = Array.isArray(s && s.tiradori) && s.tiradori.length ? s.tiradori.filter((t) => t && typeof t === 'object')
    : D.tiradori.map((t, i) => (i === 0 ? { ...t, togli: maniglia0 } : { ...t }));
  const binari = (Array.isArray(s && s.binari) ? s.binari : []).filter((b) => b && typeof b === 'object').map((b, i) => {
    if (vecchi && b.id === 'syscore' && Number(b.larghezzaMeno) === 35) b = { ...b, larghezzaMeno: 0 };
    let id = String(b.id || '').trim() || `b${i}`;
    while (visti.has(id)) id += 'x';
    visti.add(id);
    return {
      id, nome: String(b.nome ?? '').trim(),
      larghezzaMeno: Math.max(0, num(b.larghezzaMeno, 0)),
      altezzaMeno: Math.max(0, num(b.altezzaMeno, 0)),
      profondita: elencoMm(b.profondita, [75, 85], 20, 300),     // spazio del binario (di partenza 75, oppure 85)
      maniglia: 0,          // (dalla v4 i profili delle ante sono nel tirador)
    };
  });
  return {
    v: 4,
    ante: {
      ariaAltezza: Math.max(0, num(a.ariaAltezza, D.ante.ariaAltezza)),
      ariaLarghezza: Math.max(0, num(a.ariaLarghezza, D.ante.ariaLarghezza)),
      ariaTraAnte: Math.max(0, num(a.ariaTraAnte, D.ante.ariaTraAnte)),
      ariaCassetti: Math.max(0, num(a.ariaCassetti, D.ante.ariaCassetti)),
    },
    manigliaJ: { spessore: Math.max(0, num(j.spessore, D.manigliaJ.spessore)) },
    fingerPull: (() => { const f = (s && s.fingerPull) || {}; return { tipo: f.tipo === 'profilo' ? 'profilo' : 'fresato', profilo: Math.max(0, num(f.profilo, D.fingerPull.profilo)) }; })(),
    daImpostare: mancano,
    // saltate («lo imposto dopo»): restano a 0 finché non si impostano
    gola: compGola(go, 0),
    goleAltre: (Array.isArray(s && s.goleAltre) ? s.goleAltre : []).filter((g) => g && typeof g === 'object').map((g, i) => compGola(g, i + 1)),
    tiradori: tiradoriS.map(compTirador),
    regletta: {
      vista: Math.max(mancano.includes('regletta') ? 0 : 5, num(((s && s.regletta) || {}).vista, D.regletta.vista)),
      spessoreAnta: Math.max(0, num(((s && s.regletta) || {}).spessoreAnta, D.regletta.spessoreAnta)),
      pannellinoProfondita: Math.max(0, num(((s && s.regletta) || {}).pannellinoProfondita, D.regletta.pannellinoProfondita)),
      pannellinoSpessore: Math.max(1, num(((s && s.regletta) || {}).pannellinoSpessore, D.regletta.pannellinoSpessore)),
    },
    binari: binari.length ? binari : D.binari.map((b) => ({ ...b })),
    cucina: (() => { const k = (s && s.cucina) || {}, d = D.cucina; return {
      piedini: [100, 150].includes(Number(k.piedini)) ? Number(k.piedini) : 0,
      margineZoccolo: Math.max(0, Math.min(500, num(k.margineZoccolo, d.margineZoccolo))),
      zoccoloMax: Math.max(1000, Math.min(6000, num(k.zoccoloMax, d.zoccoloMax))),
      profonditaPiano: Math.max(500, Math.min(1200, num(k.profonditaPiano, d.profonditaPiano))),
      alzatina: k.alzatina === true,
      altezzaAlzatina: Math.max(20, Math.min(600, num(k.altezzaAlzatina, d.altezzaAlzatina))),
      // (prima c'era un numero solo per sopra e sotto: vale per tutti e due)
      cernieraSopra: Math.max(20, Math.min(300, num(k.cernieraSopra, num(k.cerniera, d.cernieraSopra)))),
      cernieraSotto: Math.max(20, Math.min(300, num(k.cernieraSotto, num(k.cerniera, d.cernieraSotto)))),
      // (per poco si chiamavano ciaflanAria / ciaflanGiunto)
      angoloAria: Math.max(0, Math.min(50, num(k.angoloAria, num(k.ciaflanAria, d.angoloAria)))),
      angoloGiunto: Math.max(0, Math.min(20, num(k.angoloGiunto, num(k.ciaflanGiunto, d.angoloGiunto)))),
      ciaflanAnta: Math.max(100, Math.min(1200, num(k.ciaflanAnta, d.ciaflanAnta))),
      anteScendono: (() => {
        const ids = new Set();
        const l = Array.isArray(k.anteScendono) ? k.anteScendono : d.anteScendono;
        return l.filter((x) => x && typeof x === 'object').map((x, i) => ({
          id: idUnico(x.id, 'as', i, ids),
          altezza: Math.max(0, Math.min(3000, Math.round(num(x.altezza, 0)))),
          scende: Math.max(0, Math.min(300, Math.round(num(x.scende, 20)))),
        }));
      })(),
    }; })(),
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
    modulari: (() => { const m = (s && s.modulari) || {}, d = D.modulari; return {
      carcassa: Math.max(1, num(m.carcassa, d.carcassa)), schiena: Math.max(1, num(m.schiena, d.schiena)), ante: Math.max(1, num(m.ante, d.ante)),
      abbFianchi: Math.max(0, num(m.abbFianchi, d.abbFianchi)), abbTop: Math.max(0, num(m.abbTop, d.abbTop)), abbAnte: Math.max(0, num(m.abbAnte, d.abbAnte)),
      altezzaManiglia: Math.max(0, num(m.altezzaManiglia, d.altezzaManiglia)),
    }; })(),
    piedini: (() => { const s0 = (s && s.piedini) || {}, out = {};
      for (const t of ['battente', 'scorrevole', 'modulari']) {
        const a = s0[t] || {}, d = D.piedini[t]; out[t] = {};
        for (const k of Object.keys(d)) out[t][k] = Math.max(0, num(a[k], d[k]));
      }
      return out; })(),
    cassettieraArmadio: (() => { const s0 = (s && s.cassettieraArmadio) || {}, out = {};
      for (const t of ['battente', 'scorrevole']) {
        const a = s0[t] || {}, d = D.cassettieraArmadio[t]; out[t] = {};
        for (const k of Object.keys(d)) out[t][k] = Math.max(0, num(a[k], d[k]));
      }
      return out; })(),
    anteInterne: {
      aria: Math.max(0, num(((s && s.anteInterne) || {}).aria, D.anteInterne.aria)),
      spazioRipiano: Math.max(0, num(((s && s.anteInterne) || {}).spazioRipiano, D.anteInterne.spazioRipiano)),
    },
    cassetti: compCassetti(c, 0),
    cassettiAltri: (Array.isArray(s && s.cassettiAltri) ? s.cassettiAltri : []).filter((x) => x && typeof x === 'object').map((x, i) => compCassetti(x, i + 1)),
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

/** Nome di una voce «anta del pensile che scende»: «Sporgente sotto · 70 → 72» (o tutti i pensili + mm). */
export function nomeAntaScende(v) {
  const cm = (mm) => String(Math.round(mm) / 10).replace('.', ',');
  return v.altezza ? `Sporgente sotto · ${cm(v.altezza)} → ${cm(v.altezza + v.scende)}` : `Sporgente sotto · tutti i pensili +${v.scende} mm`;
}
/** I binari degli armadi scorrevoli (almeno uno). */
export function binariScorrevoli(p = parametri()) { return p.binari; }
/** Il binario scelto (per id); se non c'è più, il primo dell'elenco. */
export function binarioScorrevole(id, p = parametri()) {
  return p.binari.find((b) => b.id === id) || p.binari[0];
}

// ---- FERRAMENTA PER MARCA: la prima voce di ogni lista è quella di partenza ----
/** Tutti i sistemi di cassetti (il primo è quello di partenza). */
export function sistemiCassetti(p = parametri()) { return [p.cassetti, ...p.cassettiAltri]; }
/** Il sistema di cassetti scelto (per id); se non c'è più, quello di partenza. */
/** FINGER-PULL con il profilo: di quanti mm si accorcia l'anta (0 = fresato, anta intera). */
export function profiloFingerPull(p = parametri()) { return p.fingerPull.tipo === 'profilo' && p.fingerPull.profilo > 0 ? p.fingerPull.profilo : 0; }
/**
 * PIEDINI E ZOCCOLO di un progetto: la scelta del progetto (o = { si, altezza, zoccolo: { si, auto, larghezza,
 * altezza } }), e dove manca quella dei ⚙ Parametri (dove = 'battente' | 'scorrevole' | 'modulari').
 * → { si, h (altezza piedini, 0 = niente), zoccolo: null | { auto, L (larghezza o null = automatica), H, rientro } }
 */
export function piediniDi(o, dove, p = parametri()) {
  const P = p.piedini[dove] || p.piedini.battente, c = o || {};
  const si = c.si != null ? !!c.si : !!P.si;
  const h = si ? Math.max(1, Math.round(Number(c.altezza ?? P.altezza) || 100)) : 0;
  const zc = c.zoccolo || {};
  const zSi = si && (zc.si != null ? !!zc.si : !!P.zoccolo);
  if (!zSi) return { si, h, zoccolo: null };
  const auto = zc.auto !== false;
  return { si, h, zoccolo: { auto, L: auto ? null : Math.max(50, Math.round(Number(zc.larghezza) || 0)) || null,
    H: auto ? h : Math.max(10, Math.round(Number(zc.altezza) || h)), rientro: P.rientro, rientroCostadi: P.rientroCostadi,
    latSx: zc.latSx != null ? !!zc.latSx : !!P.lateraleSx, latDx: zc.latDx != null ? !!zc.latDx : !!P.lateraleDx } };
}
/** Misure della cassettiera dentro l'armadio ('battente' | 'scorrevole'). */
export function cassettieraArmadio(tipo, p = parametri()) { return p.cassettieraArmadio[tipo === 'scorrevole' ? 'scorrevole' : 'battente']; }
/** Nome nelle tendine: «Syskor (a sistema)», «Cassetto legno 16 (su misura)». */
export function nomeSistemaCassetti(c) { return `${(c && c.marca) || '—'} (${c && c.tipo === 'nostro' ? 'su misura' : 'a sistema'})`; }
export function cassettiDi(id, p = parametri()) { return sistemiCassetti(p).find((c) => c.id === id) || p.cassetti; }
/** Tutte le gole (la prima è quella di partenza). */
export function sistemiGola(p = parametri()) { return [p.gola, ...p.goleAltre]; }
export function golaSistema(id, p = parametri()) { return sistemiGola(p).find((g) => g.id === id) || p.gola; }
/** I tiradores degli armadi scorrevoli (almeno uno) e quello scelto (se non c'è più, il primo). */
export function tiradoriScorrevoli(p = parametri()) { return p.tiradori; }
/**
 * SPESSORE DEL TIRADOR DA TOGLIERE ALL'ANTA (mm), dal lato dove sta la maniglia.
 * Si sceglie nella scheda di ogni maniglia (Impostazioni → Maniglie): «Sottrai lo spessore del
 * tirador dall'anta: sì / no» e i mm. Maniglie salvate prima della scelta: i profili a J e sul
 * bordo tolgono il loro spessore (quello della maniglia o ⚙ Parametri → maniglia a J), le altre niente.
 */
export function spessoreTirador(def, p = parametri()) {
  if (!def || def.sottraiSpessore === false) return 0;
  const proprio = Number(def.spessoreTirador) > 0 ? Number(def.spessoreTirador) : Number(def.spessoreJ) > 0 ? Number(def.spessoreJ) : p.manigliaJ.spessore;
  if (def.sottraiSpessore === true) return proprio;
  return ['profilo', 'bordol'].includes(def.forma) ? proprio : 0;
}
/**
 * TIRADOR: profilo che corre lungo il bordo dell'anta o del frontale (sul bordo con la L, a J, a bordo)
 * o maniglia che toglie il suo spessore all'anta (scheda della maniglia: sottrai sì).
 */
export function eTirador(def) {
  if (!def) return false;
  const forma = def.texture && def.lunghezzaMm && def.formaV ? def.forma : null;
  return ['bordol', 'profilo', 'bordo'].includes(forma) || spessoreTirador(def) > 0;
}
/**
 * Lunghezza della maniglia su un bordo lungo `lato` (mm), uguale per 3D e distinta:
 * il TIRADOR più lungo del bordo diventa lungo come il bordo (cassetto da 800 → tirador da 800);
 * le altre maniglie restano 4 cm dentro ai bordi.
 */
export function lunghezzaSulBordo(def, L, lato) {
  return Math.min(L, eTirador(def) ? lato : lato - 80);
}
/** Come si chiama in distinta la maniglia che accorcia l'anta. */
export function nomeTirador(def) {
  return def && def.forma === 'bordol' ? 'maniglia sul bordo' : def && def.forma === 'profilo' ? 'maniglia a J' : 'tirador';
}
export function tiradorScorrevole(id, p = parametri()) { return p.tiradori.find((t) => t.id === id) || p.tiradori[0]; }

/** Cassetto fatto da noi: che tipo è dal frontale (piccolo fino a piccoloFinoA, grande oltre medioFinoA). */
export function tipoCassettoNostro(hF, sis) {
  if (hF <= sis.piccoloFinoA) return 'piccolo';
  if (sis.medioFinoA && hF > sis.medioFinoA) return 'grande';
  return 'medio';
}
/**
 * CASSETTO FATTO DA NOI: i pezzi di N cassetti con il frontale alto hF, dentro uno spazio largo `interno`
 * (fra i fianchi del mobile o della cassettiera), guide lunghe `guida`.
 *   scatola larga = interno − 2 × spazio guide · dietro / davanti = scatola − 2 × spessore
 *   fianchi alti = frontale − X (modo «frontale») o fissi per tipo (modo «tipo»), lunghi come le guide
 *   fondo in canale: + 2 × canale (4 lati: guida − 2 × spessore + 2 × canale; 3 lati: guida − spessore + canale)
 *   fondo avvitato sotto (canale 0): largo come la scatola, lungo come le guide
 */
export function pezziCassettoNostro(sis, interno, hF, guida, N) {
  const sp = sis.spessoreScatola, W = interno - 2 * sis.spazioGuide, Wi = W - 2 * sp;
  const t = tipoCassettoNostro(hF, sis);
  const hFi = Math.max(20, sis.altezzaModo === 'tipo' ? (t === 'piccolo' ? sis.altezzaPiccolo : t === 'grande' ? sis.altezzaGrande : sis.altezzaMedio) : hF - sis.altezzaMeno);
  const c = sis.fondoCanale, quattro = sis.montaggio !== '3lati', R = (x) => Math.round(x);
  const out = [
    { nome: 'Cassetto su misura · fianco', larghezza: R(guida), altezza: R(hFi), spessore: sp, quantita: 2 * N, materialeNome: sis.materialeScatola },
    { nome: 'Cassetto su misura · trasera', larghezza: R(Wi), altezza: R(hFi - sis.dietroMeno), spessore: sp, quantita: N, materialeNome: sis.materialeScatola },
  ];
  if (quattro) out.push({ nome: 'Cassetto su misura · davanti interno', larghezza: R(Wi), altezza: R(hFi), spessore: sp, quantita: N, materialeNome: sis.materialeScatola });
  out.push(c > 0
    ? { nome: 'Cassetto su misura · fondo (in canale)', larghezza: R(Wi + 2 * c), altezza: R(quattro ? guida - 2 * sp + 2 * c : guida - sp + c), spessore: sis.fondoSpessore, quantita: N, materialeNome: sis.materialeFondo }
    : { nome: 'Cassetto su misura · fondo (avvitato sotto)', larghezza: R(W), altezza: R(guida), spessore: sis.fondoSpessore, quantita: N, materialeNome: sis.materialeFondo });
  return out;
}

/** Che cassetto è (dall'altezza del frontale): 'piccolo' | 'medio' | 'grande', con l'altezza della trasera.
 *  piccolo: frontale fino a piccoloFinoA · grande (solo se ha la sua trasera): frontale più alto del
 *  medio (medioFinoA) · medio: tutti gli altri. Un tipo senza trasera non si usa. */
export function tipoCassetto(hFrontale, p = parametri(), sistema = null) {
  const c = sistema || p.cassetti;
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
  if (gruppo === 'binario' && n.binari[0]) { Object.assign(n.binari[0], { larghezzaMeno: 0, altezzaMeno: 0, maniglia: 0 }); if (n.tiradori[0]) { n.tiradori[0].togli = 0; n.tiradori[0].lato = 0; } }
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
