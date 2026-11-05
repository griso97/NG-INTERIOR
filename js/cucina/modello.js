// =============================================================================
// MODELLO DATI — Progetto cucina
// =============================================================================
// Struttura unica condivisa tra i 4 step del wizard. Ogni step legge/arricchisce
// questo stesso oggetto senza duplicare dati.
// Tutte le misure sono in MILLIMETRI.
// =============================================================================

/**
 * Costruisce un progetto cucina vuoto (default = lineare 3000 mm).
 */
export function progettoDefault() {
  return {
    versione: 1,
    stepCorrente: 1,
    piano: {
      tipologia: 'lineare',
      pareti: [
        { id: 1, lunghezza_mm: 3000, angolo_gradi: 0, latoInterno: 'interno' },
      ],
    },
    pianoConfermato: false,
    // Moduli a terra (Step 2)
    moduliBase: [],
    moduliBaseConfermati: false,
    // Moduli alti / colonne (Step 3) e fronti (Step 4) — vuoti in Step 2
    moduliAlti: [],
    colonne: [],
    fasce: [],
    reglette: [],
    mostraAlti: false,
    // Mobili liberi piazzati sulla pianta (x,y = centro in mm, rot in gradi)
    mobiliLiberi: [],
  };
}

// =============================================================================
// CATALOGO MODULI BASE (Step 2)
// =============================================================================
export const PROFONDITA_BASE = 600;              // mm, fissa (ante incluse)
export const PROFONDITA_PENSILE = 350;           // mm, pensili (armadi sopra)
export const LARGHEZZE_BASE = [300, 400, 500, 600, 700, 800, 900, 1000];
export const ALTEZZE_BASE = [700, 800];          // armadi bassi
export const ALTEZZE_PENSILE = [700, 900];       // armadi sopra
export const ALTEZZE_COLONNA = [2200, 2300];     // colonne, altezza totale

export const TIPI_MODULO_BASE = [
  { id: 'base-ante',     nome: 'Base con ante',     larghezze: LARGHEZZE_BASE },
  { id: 'base-cassetti', nome: 'Base cassetti',     larghezze: LARGHEZZE_BASE },
  { id: 'lavello',       nome: 'Lavello',           larghezze: LARGHEZZE_BASE },
  { id: 'forno',         nome: 'Forno + placca',    larghezze: [600] },
];

/**
 * CATALOGO dei mobili che si posano liberamente sulla pianta (barra icone).
 * Ogni voce ha: larghezze e altezze selezionabili, profondità e categoria.
 * Le altezze non si vedono in pianta (vista dall'alto) ma vengono salvate
 * e servono per la vista 3D e la distinta.
 */
export const CATALOGO_MOBILI = [
  { id: 'base-ante',     nome: 'Base con ante', categoria: 'base',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'base-cassetti', nome: 'Base cassetti', categoria: 'base',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'lavello',       nome: 'Lavello', categoria: 'base',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'forno',         nome: 'Forno + placca', categoria: 'base',
    larghezze: [600], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'pensile',       nome: 'Pensile', categoria: 'pensile',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_PENSILE, profondita: PROFONDITA_PENSILE },
  { id: 'colonna',       nome: 'Colonna', categoria: 'colonna',
    larghezze: [600], altezze: ALTEZZE_COLONNA, profondita: 600 },
];

// Colonne (armadi a tutta altezza)
export const H_VANO_FORNO = 600;                 // vano forno da incasso (modificabile)
export const H_VANO_MICRO = 380;                 // vano microonde da incasso (modificabile)
export const VARIANTI_COLONNA = [
  { id: 'porta',     nome: 'Porta unica' },
  { id: 'forno',     nome: 'Forno + porta' },
  { id: 'microonde', nome: 'Microonde + porta' },
];
export function nomeVarianteColonna(id) {
  return VARIANTI_COLONNA.find((v) => v.id === id)?.nome || id;
}

/**
 * Campi da scegliere nella finestra quando si posa/modifica un mobile.
 * Ogni campo: { campo, et (etichetta), opzioni: [valore | {v,l}], default }.
 * La colonna ha più campi (altezza totale, porta bassa, parte alta).
 */
export function campiMobile(tipoId) {
  const t = infoTipo(tipoId);
  if (!t) return [];
  if (t.categoria === 'colonna') {
    return [
      { campo: 'altezza_mm',      et: 'Altezza totale (mm)', opzioni: ALTEZZE_COLONNA, default: ALTEZZE_COLONNA[0] },
      { campo: 'altezzaBassa_mm', et: 'Porta bassa (mm)',    opzioni: ALTEZZE_BASE,    default: ALTEZZE_BASE[0] },
      { campo: 'variante',        et: 'Parte alta',
        opzioni: VARIANTI_COLONNA.map((v) => ({ v: v.id, l: v.nome })), default: 'porta' },
    ];
  }
  const campi = [
    { campo: 'larghezza_mm', et: 'Larghezza (mm)', opzioni: t.larghezze, default: t.larghezze.includes(600) ? 600 : t.larghezze[0] },
  ];
  if (t.altezze.length > 1) {
    campi.push({ campo: 'altezza_mm', et: 'Altezza (mm)', opzioni: t.altezze, default: t.altezze[0] });
  }
  return campi;
}

/** Descrizione breve del mobile (per etichette e pannello). */
export function descrizioneMobile(m) {
  if (categoriaTipo(m.tipo) === 'colonna') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${nomeVarianteColonna(m.variante)}`;
  }
  return m.altezza_mm ? `${m.larghezza_mm}×${m.altezza_mm}` : `${m.larghezza_mm}`;
}

export function infoTipo(tipoId) {
  return CATALOGO_MOBILI.find((t) => t.id === tipoId)
    || TIPI_MODULO_BASE.find((t) => t.id === tipoId)
    || null;
}
export function profonditaTipo(tipoId) { return infoTipo(tipoId)?.profondita || PROFONDITA_BASE; }
export function categoriaTipo(tipoId) { return infoTipo(tipoId)?.categoria || 'base'; }
export function altezzeTipo(tipoId) { return infoTipo(tipoId)?.altezze || ALTEZZE_BASE; }

export function nomeTipo(tipoId) {
  if (tipoId === 'fascia') return 'Fascia chiusura';
  return infoTipo(tipoId)?.nome || tipoId;
}

/**
 * Moduli (base + fasce) presenti su una parete, ordinati per posizione.
 * Usato per validazione, UI e rendering in pianta.
 */
export function moduliDiParete(progetto, pareteId) {
  const base = (progetto.moduliBase || [])
    .filter((m) => m.parete_id === pareteId)
    .map((m) => ({ ...m, categoria: 'base' }));
  const fasce = (progetto.fasce || [])
    .filter((f) => f.parete_id === pareteId)
    .map((f) => ({ ...f, categoria: 'fascia', tipo: 'fascia' }));
  return [...base, ...fasce].sort((a, b) => a.posizione_mm - b.posizione_mm);
}

/**
 * Spazio totale/occupato/libero su una singola parete (in mm).
 */
export function spazioLiberoParete(progetto, pareteId) {
  const parete = progetto.piano.pareti.find((p) => p.id === pareteId);
  if (!parete) return { totale: 0, occupato: 0, libero: 0 };
  const occupato = moduliDiParete(progetto, pareteId)
    .reduce((s, m) => s + m.larghezza_mm, 0);
  return {
    totale: parete.lunghezza_mm,
    occupato,
    libero: parete.lunghezza_mm - occupato,
  };
}

/**
 * Aggiunge un modulo base in coda ai moduli della parete.
 * Ritorna { ok, errore? } — rifiuta se non c'è spazio libero sufficiente.
 */
export function aggiungiModuloBase(progetto, pareteId, tipo, larghezza_mm) {
  if (muroTolto(progetto, pareteId)) return { ok: false, errore: 'Questo muro è stato tolto' };
  const s = spazioLiberoParete(progetto, pareteId);
  if (larghezza_mm > s.libero) {
    return { ok: false, errore:
      `Modulo troppo grande: spazio libero ${s.libero} mm, modulo richiesto ${larghezza_mm} mm` };
  }
  const nuovoId = Math.max(0, ...(progetto.moduliBase || []).map((m) => m.id || 0)) + 1;
  progetto.moduliBase.push({
    id: nuovoId, parete_id: pareteId, tipo,
    larghezza_mm, posizione_mm: s.occupato,
  });
  progetto.moduliBaseConfermati = false;
  return { ok: true };
}

/**
 * Aggiunge una FASCIA di chiusura (filler) su una parete, con larghezza libera.
 */
export function aggiungiFascia(progetto, pareteId, larghezza_mm, contesto = 'parete') {
  if (muroTolto(progetto, pareteId)) return { ok: false, errore: 'Questo muro è stato tolto' };
  const s = spazioLiberoParete(progetto, pareteId);
  if (larghezza_mm > s.libero) {
    return { ok: false, errore:
      `Fascia troppo grande: spazio libero ${s.libero} mm, fascia richiesta ${larghezza_mm} mm` };
  }
  const nuovoId = Math.max(0, ...(progetto.fasce || []).map((f) => f.id || 0)) + 1;
  progetto.fasce.push({
    id: nuovoId, parete_id: pareteId,
    larghezza_mm, posizione_mm: s.occupato, contesto,
  });
  progetto.moduliBaseConfermati = false;
  return { ok: true };
}

export function rimuoviModuloBase(progetto, moduloId) {
  progetto.moduliBase = progetto.moduliBase.filter((m) => m.id !== moduloId);
  ricompattaPosizioni(progetto);
  progetto.moduliBaseConfermati = false;
}
export function rimuoviFascia(progetto, fasciaId) {
  progetto.fasce = progetto.fasce.filter((f) => f.id !== fasciaId);
  ricompattaPosizioni(progetto);
  progetto.moduliBaseConfermati = false;
}

export function muroTolto(progetto, pareteId) {
  return !!progetto.piano.pareti.find((p) => p.id === pareteId)?.assente;
}

/**
 * "Toglie" un muro (o lo rimette). Il muro resta nel percorso, così gli altri
 * muri non si spostano; semplicemente non viene disegnato come parete e non
 * può avere moduli. Non si può togliere un muro che ha ancora moduli sopra.
 */
export function toggleParete(progetto, pareteId) {
  const p = progetto.piano.pareti.find((x) => x.id === pareteId);
  if (!p) return { ok: false, errore: 'Muro non trovato' };
  if (!p.assente && moduliDiParete(progetto, pareteId).length > 0) {
    return { ok: false, errore:
      'Togli prima i moduli da questo muro (Step 2), poi toglilo.' };
  }
  p.assente = !p.assente;
  progetto.pianoConfermato = false;
  return { ok: true };
}

// --- Mobili liberi (piazzati sulla pianta, spostabili) ---
const PASSO_SNAP = 50; // mm
export function snap(v) { return Math.round(v / PASSO_SNAP) * PASSO_SNAP; }

/** Centro della pianta (bbox dei muri presenti), per piazzare un nuovo mobile. */
export function centroPianta(progetto) {
  const pareti = progetto.piano.pareti.filter((p) => !p.assente);
  if (pareti.length === 0) return { x: 1000, y: 500 };
  const bb = bboxPerimetro(pareti);
  return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
}

export function aggiungiMobileLibero(progetto, tipo, props = {}) {
  const c = centroPianta(progetto);
  const n = progetto.mobiliLiberi.length;
  // Sfalsa i nuovi mobili così non nascono uno sopra l'altro
  const id = Math.max(0, ...progetto.mobiliLiberi.map((m) => m.id)) + 1;
  const info = infoTipo(tipo);
  const base = {
    larghezza_mm: info?.larghezze[0] ?? 600,
    altezza_mm: altezzeTipo(tipo)[0],
  };
  progetto.mobiliLiberi.push({
    id, tipo, ...base, ...props,
    x: snap(c.x + (n % 4) * 150), y: snap(c.y - (n % 4) * 150), rot: 0,
  });
  return id;
}
export function trovaMobileLibero(progetto, id) {
  return progetto.mobiliLiberi.find((m) => m.id === id);
}
export function ruotaMobileLibero(progetto, id) {
  const m = trovaMobileLibero(progetto, id);
  if (m) m.rot = ((m.rot || 0) + 90) % 360;
}
export function rimuoviMobileLibero(progetto, id) {
  progetto.mobiliLiberi = progetto.mobiliLiberi.filter((m) => m.id !== id);
}

/**
 * Sposta un modulo (base o fascia) di una posizione verso l'inizio (dir = -1)
 * o verso la fine (dir = +1) della sua parete, scambiandolo col vicino.
 */
export function spostaModulo(progetto, categoria, id, dir) {
  const lista = categoria === 'fascia' ? progetto.fasce : progetto.moduliBase;
  const el = lista.find((x) => x.id === id);
  if (!el) return;
  const mods = moduliDiParete(progetto, el.parete_id);
  const i = mods.findIndex((m) => m.categoria === categoria && m.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mods.length) return;
  [mods[i], mods[j]] = [mods[j], mods[i]];
  let pos = 0;
  for (const m of mods) {
    const src = (m.categoria === 'fascia' ? progetto.fasce : progetto.moduliBase)
      .find((x) => x.id === m.id);
    if (src) src.posizione_mm = pos;
    pos += m.larghezza_mm;
  }
  progetto.moduliBaseConfermati = false;
}

/**
 * VALIDAZIONE INGOMBRI.
 * 1) Pareti in cui i moduli superano la lunghezza (es. parete accorciata
 *    dopo aver inserito i moduli).
 * 2) Angoli interni: dove due pareti consecutive si incontrano verso il lato
 *    dei mobili, gli ultimi PROFONDITA_BASE mm della prima e i primi
 *    PROFONDITA_BASE mm della seconda sono lo STESSO spazio fisico. Se
 *    entrambe le pareti hanno un modulo base (non una fascia) in quella zona,
 *    i mobili si scontrano.
 * Ritorna un array di { tipo, pareti: [id...], messaggio }.
 */
export function problemiIngombri(progetto) {
  const out = [];
  const pareti = progetto.piano.pareti || [];
  pareti.forEach((p, i) => {
    if (p.assente) return;
    const s = spazioLiberoParete(progetto, p.id);
    if (s.libero < 0) {
      out.push({ tipo: 'eccesso', pareti: [p.id], messaggio:
        `Parete ${i + 1}: i moduli superano la parete di ${-s.libero} mm` });
    }
  });
  for (let i = 0; i < pareti.length - 1; i++) {
    const a = pareti[i], b = pareti[i + 1];
    if (a.assente || b.assente) continue;
    if (!angoloInterno(a, b)) continue;
    const finA = a.lunghezza_mm - PROFONDITA_BASE;
    const occA = moduliDiParete(progetto, a.id).some((m) =>
      m.categoria === 'base' && m.posizione_mm + m.larghezza_mm > finA);
    const occB = moduliDiParete(progetto, b.id).some((m) =>
      m.categoria === 'base' && m.posizione_mm < PROFONDITA_BASE);
    if (occA && occB) {
      out.push({ tipo: 'angolo', pareti: [a.id, b.id], messaggio:
        `Angolo tra parete ${i + 1} e ${i + 2}: i moduli si sovrappongono. ` +
        `Lascia ${PROFONDITA_BASE} mm liberi (o una fascia) a fine parete ${i + 1} ` +
        `oppure a inizio parete ${i + 2}.` });
    }
  }
  return out;
}

/**
 * True se l'angolo tra la parete a e la successiva b "chiude" verso il lato
 * dove stanno i mobili (quindi le due file di moduli condividono l'angolo).
 */
export function angoloInterno(a, b) {
  if (a.latoInterno !== b.latoInterno) return false;
  let delta = (b.angolo_gradi - a.angolo_gradi) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  const sgn = a.latoInterno === 'interno' ? 1 : -1; // interno = sinistra
  return delta * sgn > 0;
}

/**
 * Dopo una rimozione, ricompatta le posizioni di tutti i moduli lungo
 * ogni parete (così non restano buchi a sinistra).
 */
function ricompattaPosizioni(progetto) {
  for (const parete of progetto.piano.pareti) {
    const mods = moduliDiParete(progetto, parete.id);
    let pos = 0;
    for (const m of mods) {
      if (m.categoria === 'base') {
        const b = progetto.moduliBase.find((x) => x.id === m.id);
        if (b) b.posizione_mm = pos;
      } else {
        const f = progetto.fasce.find((x) => x.id === m.id);
        if (f) f.posizione_mm = pos;
      }
      pos += m.larghezza_mm;
    }
  }
}

/**
 * TIPOLOGIE preset della cucina. Ciascuna definisce le pareti iniziali
 * (lunghezza + angolo). L'utente può poi modificare singole misure.
 * Angolo in gradi (sistema di coordinate standard: 0° = verso destra,
 * 90° = verso alto, 180° = verso sinistra, 270° = verso basso).
 */
export const TIPOLOGIE = [
  {
    id: 'lineare', nome: 'Lineare', descrizione: '1 parete',
    pareti: [{ lunghezza_mm: 3000, angolo_gradi: 0 }],
  },
  {
    id: 'L', nome: 'A L', descrizione: '2 pareti a 90°',
    pareti: [
      { lunghezza_mm: 3000, angolo_gradi: 0 },
      { lunghezza_mm: 2500, angolo_gradi: 90 },
    ],
  },
  {
    id: 'U', nome: 'A U', descrizione: '3 pareti',
    // Percorso antiorario (giù → destra → su): il lato "interno" (sinistra
    // rispetto alla direzione di percorrenza) cade dentro la U.
    pareti: [
      { lunghezza_mm: 2500, angolo_gradi: -90 },
      { lunghezza_mm: 3000, angolo_gradi: 0 },
      { lunghezza_mm: 2500, angolo_gradi: 90 },
    ],
  },
  {
    id: 'penisola', nome: 'Penisola', descrizione: 'L + ala verso il centro',
    pareti: [
      { lunghezza_mm: 3000, angolo_gradi: 0 },
      { lunghezza_mm: 1500, angolo_gradi: 90 },
    ],
  },
  {
    id: 'isola', nome: 'Isola', descrizione: 'Solo isola (nessun muro)',
    pareti: [],
  },
  {
    id: 'personalizzata', nome: 'Personalizzata',
    descrizione: 'Perimetro libero',
    pareti: [{ lunghezza_mm: 3000, angolo_gradi: 0 }],
  },
];

/**
 * Applica un preset alle pareti del progetto (sostituendo quelle esistenti).
 * Gli ID vengono rigenerati. Il lato interno è "interno" di default (mobili
 * appoggiati al muro dall'interno del perimetro).
 */
export function applicaPreset(progetto, tipoId) {
  const preset = TIPOLOGIE.find((t) => t.id === tipoId) || TIPOLOGIE[0];
  progetto.piano.tipologia = tipoId;
  progetto.piano.pareti = preset.pareti.map((p, i) => ({
    id: i + 1,
    lunghezza_mm: p.lunghezza_mm,
    angolo_gradi: p.angolo_gradi,
    latoInterno: 'interno',
  }));
  progetto.pianoConfermato = false;
}

/**
 * Aggiunge una parete alla fine (serve in modalità "personalizzata").
 * La nuova parete continua dall'ultimo punto, ruotando di 90° rispetto
 * alla precedente (o 0° se è la prima).
 */
export function aggiungiParete(progetto, lunghezza = 2000) {
  const pareti = progetto.piano.pareti;
  const ultimoAng = pareti.length > 0 ? pareti[pareti.length - 1].angolo_gradi : 0;
  const nuovoId = pareti.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  pareti.push({
    id: nuovoId,
    lunghezza_mm: lunghezza,
    angolo_gradi: ultimoAng + 90,
    latoInterno: 'interno',
  });
  progetto.pianoConfermato = false;
}

export function rimuoviParete(progetto, idParete) {
  progetto.piano.pareti = progetto.piano.pareti.filter((p) => p.id !== idParete);
  progetto.pianoConfermato = false;
}

// Normalizza un angolo in (-180, 180].
function normAngolo(a) {
  let x = a % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
}

/**
 * Ruota l'intera pianta di `delta` gradi (di solito ±90): tutti i muri
 * girano insieme mantenendo la forma.
 */
export function ruotaPianta(progetto, delta = 90) {
  for (const p of progetto.piano.pareti) {
    p.angolo_gradi = normAngolo(p.angolo_gradi + delta);
  }
  progetto.pianoConfermato = false;
}

/**
 * Specchia la pianta (riflessione orizzontale): angolo → −angolo. La forma
 * si ribalta a specchio. Il lato interno dei mobili viene invertito perché
 * la riflessione scambia sinistra e destra.
 */
export function specchiaPianta(progetto) {
  for (const p of progetto.piano.pareti) {
    p.angolo_gradi = normAngolo(-p.angolo_gradi);
    p.latoInterno = p.latoInterno === 'interno' ? 'esterno' : 'interno';
  }
  progetto.pianoConfermato = false;
}

/**
 * Inverte il verso di un angolo (giunto all'inizio della parete `pareteId`,
 * cioè tra questa parete e la precedente): una svolta a destra diventa a
 * sinistra e viceversa. Tutte le pareti successive ruotano di conseguenza,
 * così la forma oltre quell'angolo si ribalta ma resta rigida.
 */
export function inverteAngolo(progetto, pareteId) {
  const pareti = progetto.piano.pareti;
  const i = pareti.findIndex((p) => p.id === pareteId);
  if (i <= 0) return { ok: false, errore: 'La prima parete non ha un angolo da girare' };
  const svolta = normAngolo(pareti[i].angolo_gradi - pareti[i - 1].angolo_gradi);
  const delta = -2 * svolta; // porta la svolta da +X a −X
  for (let j = i; j < pareti.length; j++) {
    pareti[j].angolo_gradi = normAngolo(pareti[j].angolo_gradi + delta);
  }
  progetto.pianoConfermato = false;
  return { ok: true };
}

/**
 * Calcola i vertici del perimetro (punti con coordinate in mm) percorrendo
 * le pareti nell'ordine dato. Parte da (0, 0).
 * Ritorna: array di punti { x, y } compresi il punto iniziale e quello finale.
 */
export function calcolaVertici(pareti) {
  const pts = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  for (const p of pareti) {
    const rad = (p.angolo_gradi * Math.PI) / 180;
    x += p.lunghezza_mm * Math.cos(rad);
    y += p.lunghezza_mm * Math.sin(rad);
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Bounding box del perimetro (serve per calcolare il viewBox SVG).
 */
export function bboxPerimetro(pareti) {
  const pts = calcolaVertici(pareti);
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}
