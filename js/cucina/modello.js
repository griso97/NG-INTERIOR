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
    // Colore/materiale delle ante per gruppo (id materiale, null = default)
    coloriFronti: { base: null, pensile: null, colonna: null, costado: null },
    zoccoloColore: 'nero-opaco',
    sfondo: 'chiaro',            // sfondo vista 3D: chiaro | neutro | scuro
    reglettaAngolo: { base: 30, spessore: 18 },  // regletta a L d'angolo (mm)
    autoRegletta: true,          // regletta d'angolo automatica (3×3 cm) on/off
    // Stile anta pensili: 'standard' (−2 alt / −3 largh come i bassi),
    // 'sporg70' (pensili 70 → anta 72, sporge 2cm sotto),
    // 'sporg90' (pensili 90 → anta 92, sporge 2cm sotto).
    antaPensile: 'standard',
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
// Costadi (fianchi di finitura): altezze standard, tutte in profondità 600
export const ALTEZZE_COSTADO = [720, 850, 900, 920, 2200, 2300, 2350, 2450];

export const TIPI_MODULO_BASE = [
  { id: 'base-ante',     nome: 'Base con ante',     larghezze: LARGHEZZE_BASE },
  { id: 'base-cassetti', nome: 'Base cassetti',     larghezze: LARGHEZZE_BASE },
  { id: 'lavello',       nome: 'Lavello',           larghezze: LARGHEZZE_BASE },
  { id: 'lavastoviglie', nome: 'Lavastoviglie',     larghezze: [450, 600] },
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
  { id: 'lavastoviglie', nome: 'Lavastoviglie', categoria: 'base',
    larghezze: [450, 600], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'forno',         nome: 'Forno + placca', categoria: 'base',
    larghezze: [600], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'pensile',       nome: 'Pensile', categoria: 'pensile',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_PENSILE, profondita: PROFONDITA_PENSILE },
  { id: 'pensile-angolo', nome: 'Pensile angolo', categoria: 'pensile',
    larghezze: [630], altezze: ALTEZZE_PENSILE, profondita: 630 },
  { id: 'pensile-angolo-45', nome: 'Ciaflan', categoria: 'pensile',
    larghezze: [630], altezze: ALTEZZE_PENSILE, profondita: 630 },
  { id: 'colonna',       nome: 'Colonna', categoria: 'colonna',
    larghezze: [600], altezze: ALTEZZE_COLONNA, profondita: 600 },
  { id: 'regletta',      nome: 'Regletta a L', categoria: 'regletta',
    larghezze: [30], altezze: ALTEZZE_BASE, profondita: 30 },
  // Pannelli su misura (spessore fisso 18 mm, come le ante):
  // - regletta-grande: tamponamento verticale a tutta altezza (es. gap frigo-muro)
  // - pannello-copertura: pannello grande per schiena/lato isole e penisole
  { id: 'regletta-grande', nome: 'Regletta grande', categoria: 'pannello',
    larghezze: [30, 50, 80, 100, 150], altezze: [2200, 2300, 900, 700], profondita: 18 },
  // Pannello di copertura: va DIETRO ai moduli dell'isola come un costado grande.
  // Altezza = quella dei moduli + piedini (base 70+15 = 85, base 80+10 = 90).
  // Larghezza = somma dei moduli dell'isola (l'utente la decide di volta in volta).
  { id: 'pannello-copertura', nome: 'Pannello copertura', categoria: 'pannello',
    larghezze: [1200, 1800, 2400, 3000], altezze: [850, 900], profondita: 18 },
  { id: 'costado',       nome: 'Costado', categoria: 'costado',
    larghezze: [20], altezze: ALTEZZE_COSTADO, profondita: 620 },
];

// Colonne (armadi a tutta altezza)
export const H_VANO_FORNO = 600;                 // vano forno da incasso (modificabile)
export const H_VANO_MICRO = 380;                 // vano microonde da incasso (modificabile)
export const VARIANTI_COLONNA = [
  { id: 'porta',       nome: 'Porta unica' },
  { id: 'forno',       nome: 'Forno + porta' },
  { id: 'microonde',   nome: 'Microonde + porta' },
  { id: 'forno-micro', nome: 'Forno + microonde + porta' },
  { id: 'vano',        nome: 'Vano aperto + porta' },
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
  if (t.categoria === 'regletta') {
    return [
      { campo: 'latoA_mm',  et: 'Larghezza (mm)', tipo: 'numero', default: 30, min: 10, step: 5, opzioni: [20, 30, 40, 50, 100] },
      { campo: 'latoB_mm',  et: 'Profondità (mm)', tipo: 'numero', default: PROFONDITA_BASE, min: 10, step: 5, opzioni: [PROFONDITA_BASE, 350, 100, 30] },
      { campo: 'altezza_mm', et: 'Altezza (mm)', opzioni: ALTEZZE_BASE, default: ALTEZZE_BASE[0] },
    ];
  }
  if (t.categoria === 'pannello') {
    // Pannelli su misura: larghezza e altezza ENTRAMBE libere, spessore fisso 18 mm.
    // Le opzioni standard sono scorciatoie; il campo numerico accetta qualsiasi valore.
    const etLarg = tipoId === 'regletta-grande' ? 'Larghezza (mm)' : 'Larghezza (mm)';
    return [
      { campo: 'larghezza_mm', et: etLarg, tipo: 'numero',
        min: 20, step: 1, opzioni: t.larghezze, default: t.larghezze[0] },
      { campo: 'altezza_mm',   et: 'Altezza (mm)', tipo: 'numero',
        min: 50, step: 1, opzioni: t.altezze, default: t.altezze[0] },
    ];
  }
  if (t.categoria === 'costado') {
    // Tutti liberi (modalità custom); i valori standard sono scorciatoie
    return [
      { campo: 'altezza_mm',    et: 'Altezza (mm)', tipo: 'numero', default: 850, min: 50, step: 10, opzioni: ALTEZZE_COSTADO },
      { campo: 'profondita_mm', et: 'Profondità (mm)', tipo: 'numero', default: 620, min: 50, step: 10, opzioni: [620, 600, 350] },
      { campo: 'spessore_mm',   et: 'Spessore (mm)', tipo: 'numero', default: 18, min: 5, step: 1, opzioni: [18, 20, 25, 30] },
    ];
  }
  if (t.categoria === 'colonna') {
    return [
      { campo: 'altezza_mm',      et: 'Altezza totale (mm)', opzioni: ALTEZZE_COLONNA, default: ALTEZZE_COLONNA[0] },
      { campo: 'altezzaBassa_mm', et: 'Porta bassa (mm)',    opzioni: ALTEZZE_BASE,    default: ALTEZZE_BASE[0] },
      { campo: 'variante',        et: 'Parte alta',
        opzioni: VARIANTI_COLONNA.map((v) => ({ v: v.id, l: v.nome })), default: 'porta' },
      { campo: 'altezzaVano_mm',  et: 'Altezza vano aperto (mm) — solo con "Vano aperto"',
        tipo: 'numero', default: 600, min: 100, step: 10, opzioni: [400, 500, 600, 700] },
    ];
  }
  const campi = [
    // Larghezza libera (puoi scrivere qualsiasi misura); le standard sono scorciatoie
    { campo: 'larghezza_mm', et: 'Larghezza (mm)', tipo: 'numero', min: 100, step: 10,
      opzioni: t.larghezze, default: t.larghezze.includes(600) ? 600 : t.larghezze[0] },
  ];
  if (t.altezze.length > 1) {
    campi.push({ campo: 'altezza_mm', et: 'Altezza (mm)', opzioni: t.altezze, default: t.altezze[0] });
  }
  if (tipoId === 'base-cassetti') {
    campi.push({ campo: 'cassetti', et: 'Numero cassetti', opzioni: [1, 2, 3, 4, 5, 6], default: 3 });
  }
  return campi;
}

/** Descrizione breve del mobile (per etichette e pannello). */
export function descrizioneMobile(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'regletta') {
    return `${m.latoA_mm}×${m.latoB_mm} · h${m.altezza_mm}`;
  }
  if (cat === 'pannello') {
    return `${m.larghezza_mm}×${m.altezza_mm} · sp 18`;
  }
  if (cat === 'costado') {
    return `${m.altezza_mm}×${m.profondita_mm} · sp ${m.spessore_mm}`;
  }
  if (cat === 'colonna') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${nomeVarianteColonna(m.variante)}`;
  }
  const extra = (m.placca ? ' · piano cottura' : '') + (m.lavello ? ' · lavello' : '');
  if (m.tipo === 'base-cassetti') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${m.cassetti || 3} cassetti${extra}`;
  }
  const dim = m.altezza_mm ? `${m.larghezza_mm}×${m.altezza_mm}` : `${m.larghezza_mm}`;
  if (m.tipo === 'base-ante' || m.tipo === 'pensile') {
    const na = anteDiMobile(m);
    const ante = na === 1 ? `1 anta ${m.antaLato === 'sx' ? 'sx' : 'dx'}` : '2 ante';
    return `${dim} · ${ante}${extra}`;
  }
  return dim + extra;
}

/**
 * Ingombro in pianta di un mobile: { w (lungo il fronte), d (profondità) }.
 * La regletta usa i suoi due lati; gli altri la larghezza + profondità del tipo.
 */
export function dimMobile(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'regletta') {
    return { w: m.latoA_mm || 30, d: m.latoB_mm || 30 };
  }
  if (cat === 'pannello') {
    // Il pannello ha sempre 18 mm di spessore: si vede "di faccia" sulla larghezza.
    return { w: m.larghezza_mm || 50, d: 18 };
  }
  if (cat === 'costado') {
    return { w: m.spessore_mm || 20, d: m.profondita_mm || 620 };
  }
  return { w: m.larghezza_mm, d: profonditaTipo(m.tipo) };
}

/**
 * Livello di un singolo mobile per il blocco a schermate (basso/alto):
 * i pensili sono "alti"; un costado dipende dalla sua profondità
 * (60 = basso/colonna, 35 = alto/pensile); gli altri sono "bassi".
 */
export function livelloDiMobile(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'pensile') return 'alto';
  if (cat === 'costado') return (m.profondita_mm || 620) >= 500 ? 'basso' : 'alto';
  return 'basso';
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
const PASSO_SNAP = 10; // mm (fine: permette di accostare i mobili con precisione)
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

/**
 * Vincola una posizione (x,y) del CENTRO di un mobile in modo che il suo
 * ingombro NON esca da nessun muro presente: ogni muro è una barriera verso
 * l'esterno. Negli angoli i due muri fermano il mobile insieme.
 * Ritorna {x, y} eventualmente spostati verso l'interno.
 */
export function vincolaAiMuri(progetto, m, x, y) {
  const full = progetto.piano.pareti || [];
  const pareti = full.filter((p) => !p.assente);
  if (pareti.length === 0) return { x, y };
  const vertici = calcolaVertici(full);
  const d = dimMobile(m);
  const rad = ((m.rot || 0) * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const hw = d.w / 2, hd = d.d / 2;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < full.length; i++) {
      const p = full[i];
      if (p.assente) continue;
      const a = vertici[i], b = vertici[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;                 // lungo il muro
      const sgn = p.latoInterno === 'interno' ? 1 : -1;
      const nx = -dy / L * sgn, ny = dx / L * sgn;    // normale verso l'interno
      const extU = Math.abs(hw * (c * ux + s * uy)) + Math.abs(hd * (-s * ux + c * uy));
      const extN = Math.abs(hw * (c * nx + s * ny)) + Math.abs(hd * (-s * nx + c * ny));
      // (a) barriera: non attraversare il muro verso l'esterno
      const distN = (x - a.x) * nx + (y - a.y) * ny;
      if (distN < extN) { const sp = extN - distN; x += nx * sp; y += ny * sp; }
      // (b) estremi: se il mobile è appoggiato a questo muro, resta tra 0 e L.
      const distN2 = (x - a.x) * nx + (y - a.y) * ny;
      if (distN2 <= extN + 150) {
        const tC = (x - a.x) * ux + (y - a.y) * uy;
        const lo = extU, hi = L - extU;
        const target = lo > hi ? L / 2 : Math.min(hi, Math.max(lo, tC));
        const shift = target - tC;
        x += ux * shift; y += uy * shift;
      }
    }
  }
  return { x, y };
}

// Estensione verticale occupata da un mobile (mm): [basso, alto].
const MONT_PENSILE_MM = 1400;
export function rangeVerticale(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'pensile') { const h = m.altezza_mm || 700; return [MONT_PENSILE_MM, MONT_PENSILE_MM + h]; }
  const h = m.altezza_mm || (cat === 'colonna' ? 2200 : 700);
  return [0, h];
}
function rangeSovrappone(a, b) { return a[0] < b[1] - 1 && b[0] < a[1] - 1; }
function aabb(m, x, y) {
  const d = dimMobile(m);
  const rad = ((m.rot || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  return { hx: (d.w / 2) * c + (d.d / 2) * s, hy: (d.w / 2) * s + (d.d / 2) * c };
}

/** Direzione del muro più vicino (tangente u), o null se lontano da ogni muro. */
function muroPiuVicino(progetto, x, y) {
  const full = progetto.piano.pareti || [];
  if (full.length === 0) return null;
  const vertici = calcolaVertici(full);
  let bestDist = Infinity, bestU = null;
  for (let i = 0; i < full.length; i++) {
    const p = full[i];
    if (p.assente) continue;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;
    const t = (x - a.x) * ux + (y - a.y) * uy;
    const dist = (x - a.x) * nx + (y - a.y) * ny;
    if (dist < -400 || t < -300 || t > L + 300) continue;
    if (dist < bestDist) { bestDist = dist; bestU = [ux, uy]; }
  }
  return (bestU && bestDist <= 900) ? bestU : null;
}

/**
 * Respinge un mobile dagli altri mobili che occupano la STESSA fascia di
 * altezza, così non si sormontano (un pensile sopra una base è permesso).
 * Se il mobile è appoggiato a un muro, lo fa scorrere LUNGO il muro (così i
 * mobili si affiancano invece di spingersi in profondità contro la parete);
 * altrimenti (isola) usa l'asse di minore compenetrazione.
 */
export function respingiDaMobili(progetto, m, x, y) {
  const rv = rangeVerticale(m);
  // Isola: niente "lungo il muro", uso l'asse di minore compenetrazione.
  const u = m.isola ? null : muroPiuVicino(progetto, x, y);
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (!rangeSovrappone(rv, rangeVerticale(o))) continue;
    const A = aabb(m, x, y), B = aabb(o, o.x, o.y);
    if (u) {
      // Risoluzione lungo il muro (u) e perpendicolare (v)
      const [ux, uy] = u, vx = -uy, vy = ux;
      const eUm = A.hx * Math.abs(ux) + A.hy * Math.abs(uy);
      const eUo = B.hx * Math.abs(ux) + B.hy * Math.abs(uy);
      const eVm = A.hx * Math.abs(vx) + A.hy * Math.abs(vy);
      const eVo = B.hx * Math.abs(vx) + B.hy * Math.abs(vy);
      const du = (x - o.x) * ux + (y - o.y) * uy;
      const dv = (x - o.x) * vx + (y - o.y) * vy;
      const ou = (eUm + eUo) - Math.abs(du);
      const ov = (eVm + eVo) - Math.abs(dv);
      if (ou > 0 && ov > 0) {
        const s = du >= 0 ? 1 : -1;
        x += ux * s * ou; y += uy * s * ou;
      }
    } else {
      const dx = x - o.x, dy = y - o.y;
      const ox = (A.hx + B.hx) - Math.abs(dx);
      const oy = (A.hy + B.hy) - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        if (ox <= oy) x += (dx >= 0 ? 1 : -1) * ox;
        else y += (dy >= 0 ? 1 : -1) * oy;
      }
    }
  }
  return { x, y };
}

/**
 * Orientamento automatico: restituisce la rotazione (0/90/180/270) che fa
 * guardare le ante verso l'INTERNO della stanza quando il mobile è appoggiato
 * al muro più vicino (schienale al muro). Ritorna null se non è vicino a
 * nessun muro (allora si tiene la rotazione attuale, es. isola al centro).
 */
export function orientaVersoMuro(progetto, m, x, y) {
  if (m.isola) return null;                        // isola: orientamento manuale
  const full = progetto.piano.pareti || [];
  if (full.length === 0) return null;
  const vertici = calcolaVertici(full);
  let bestDist = Infinity, bestN = null;
  for (let i = 0; i < full.length; i++) {
    const p = full[i];
    if (p.assente) continue;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;   // verso interno
    const t = (x - a.x) * ux + (y - a.y) * uy;     // posizione lungo il muro
    const dist = (x - a.x) * nx + (y - a.y) * ny;  // distanza dal muro
    if (dist < -400) continue;                     // dal lato sbagliato
    if (t < -300 || t > L + 300) continue;         // fuori dalla parete
    if (dist < bestDist) { bestDist = dist; bestN = [nx, ny]; }
  }
  if (!bestN || bestDist > 900) return null;       // troppo lontano da un muro
  const [nx, ny] = bestN;
  // Il fronte (ante) in pianta, nel rendering 3D, guarda (−sin, −cos) della
  // rotazione. Scelgo la rotazione il cui fronte 3D guarda verso l'interno.
  let bestRot = m.rot || 0, bestVal = -Infinity;
  for (const r of [0, 90, 180, 270]) {
    const rad = r * Math.PI / 180;
    const v = (-Math.sin(rad)) * nx + (-Math.cos(rad)) * ny;
    if (v > bestVal) { bestVal = v; bestRot = r; }
  }
  return bestRot;
}

/**
 * Orienta un pensile ad angolo a L (ingombro w×w) così che la sua parte
 * PIENA (baricentro spostato verso l'angolo interno) guardi il vertice
 * dell'angolo della stanza. Prova le 4 rotazioni e sceglie quella che
 * avvicina di più il baricentro pieno al vertice.
 */
export function orientaLVersoAngolo(cx, cy, vertice, w, prof) {
  const hw = w / 2;
  const Ainc = (w - prof) * (w - prof);
  const AL = w * w - Ainc;
  // Baricentro della parte piena in coordinate locali (incavo in lx>0, ly<0).
  const cxInc = prof / 2, cyInc = -prof / 2;
  const gx = (-cxInc * Ainc) / AL;
  const gy = (-cyInc * Ainc) / AL;
  let bestRot = 0, bestDist = Infinity;
  for (const r of [0, 90, 180, 270]) {
    const rad = r * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const wx = cx + gx * c - gy * s;
    const wy = cy + gx * s + gy * c;
    const dist = Math.hypot(wx - vertice.x, wy - vertice.y);
    if (dist < bestDist) { bestDist = dist; bestRot = r; }
  }
  return bestRot;
}

/**
 * Ri-orienta tutti i mobili a parete verso l'interno (ante verso la stanza),
 * così la rotazione salvata resta sempre corretta anche sui mobili già piazzati.
 * Le isole/penisole (isola) mantengono l'orientamento manuale.
 */
export function riorientaMobili(progetto) {
  for (const m of (progetto.mobiliLiberi || [])) {
    delete m.orientManuale;                          // flag obsoleto
    if (m.isola) continue;
    if (m.posManuale) continue;                      // posizione confermata a mano: non toccare
    const cat = categoriaTipo(m.tipo);
    if (cat === 'costado' || cat === 'regletta') continue;
    // I pensili d'angolo (L / Ciaflan) hanno un orientamento dedicato: non
    // vanno ri-orientati "verso il muro" o perderebbero la forma d'angolo.
    if (String(m.tipo).startsWith('pensile-angolo')) continue;
    const rot = orientaVersoMuro(progetto, m, m.x, m.y);
    if (rot !== null) m.rot = rot;
  }
}

/**
 * Aggancio magnetico: se un bordo del mobile è VICINO (entro `soglia`) al bordo
 * di un altro mobile della stessa fascia di altezza e affiancato sulla stessa
 * linea, lo fa scorrere lungo il muro quel tanto che basta per farli combaciare
 * ESATTAMENTE (zero spazio). Così accostando due mobili si attaccano perfetti.
 */
/** Asse di "larghezza" di un mobile in base alla sua rotazione. */
function asseMobile(m) {
  const r = ((m.rot || 0) * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

export function aggancioMagnetico(progetto, m, x, y, soglia = 160) {
  const rv = rangeVerticale(m);
  // Accostamento: lungo l'asse del muro vicino (mobili a parete) o del mobile.
  const u = m.isola ? asseMobile(m) : (muroPiuVicino(progetto, x, y) || asseMobile(m));
  const [ux, uy] = u, vx = -uy, vy = ux;
  const A = aabb(m, x, y);
  const eUm = A.hx * Math.abs(ux) + A.hy * Math.abs(uy);
  const eVm = A.hx * Math.abs(vx) + A.hy * Math.abs(vy);
  // Allineamento in fila SOLO per le ISOLE (mobili liberi, senza parete dietro):
  // lì serve una "connessione" forte così i moduli restano in riga perfetta.
  // I mobili normali (a parete) NON si allineano: vanno dove li metti. Costadi e
  // reglette (pezzi sottili di finitura) non si allineano mai.
  const SNAP_ALLINEA = 300;     // mm: zona di aggancio perpendicolare (forte, solo isole)
  const catM = categoriaTipo(m.tipo);
  const puoAllineare = !!m.isola && catM !== 'costado' && catM !== 'regletta';
  const [sx, sy] = asseMobile(m);
  const pvx = -sy, pvy = sx;                   // perpendicolare (profondità)
  const eUmS = A.hx * Math.abs(sx) + A.hy * Math.abs(sy);
  let best = null;      // accostamento lungo la fila (toccarsi senza spazio)
  let align = null;     // allineamento perpendicolare (fronti/schiene in riga)
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (!rangeSovrappone(rv, rangeVerticale(o))) continue;
    const B = aabb(o, o.x, o.y);
    const eUo = B.hx * Math.abs(ux) + B.hy * Math.abs(uy);
    const eVo = B.hx * Math.abs(vx) + B.hy * Math.abs(vy);
    const du = (x - o.x) * ux + (y - o.y) * uy;
    const dv = (x - o.x) * vx + (y - o.y) * vy;
    // Accostamento: affiancati sulla stessa linea (sovrapposti in perpendicolare).
    if (Math.abs(dv) < (eVm + eVo) - 1) {
      const gap = Math.abs(du) - (eUm + eUo);   // >0 = spazio tra i bordi
      if (gap > 1 && gap <= soglia && (!best || gap < best.gap)) {
        const s = du >= 0 ? 1 : -1;             // da che lato sta m rispetto a o
        best = { gap, dx: -ux * s * gap, dy: -uy * s * gap };
      }
    }
    // Allineamento in fila: stessa orientazione, affiancati lungo la fila e GIÀ
    // VICINI alla linea (entro SNAP_ALLINEA) → snap gentile sulla stessa linea.
    const catO = categoriaTipo(o.tipo);
    if (puoAllineare && catO !== 'costado' && catO !== 'regletta') {
      const ao = asseMobile(o);
      const stessaOrient = Math.abs(sx * ao[0] + sy * ao[1]) > 0.9;
      if (stessaOrient) {
        const eUoS = B.hx * Math.abs(sx) + B.hy * Math.abs(sy);
        const duS = (x - o.x) * sx + (y - o.y) * sy;
        const dvS = (x - o.x) * pvx + (y - o.y) * pvy;
        if (Math.abs(duS) <= (eUmS + eUoS) + soglia && Math.abs(dvS) > 1 && Math.abs(dvS) <= SNAP_ALLINEA) {
          if (!align || Math.abs(dvS) < align.adv) {
            align = { adv: Math.abs(dvS), dx: -pvx * dvS, dy: -pvy * dvS };
          }
        }
      }
    }
  }
  if (best) { x += best.dx; y += best.dy; }
  if (align) { x += align.dx; y += align.dy; }   // allineamento in fila
  return { x, y };
}

/**
 * Posizione finale vincolata: alterna respinta dagli altri mobili e blocco
 * ai muri, così si assesta rispettando tutto. Infine aggancio magnetico ai
 * mobili vicini, così si accostano combaciando senza lasciare spazio.
 */
export function posizionaVincolata(progetto, m, x, y, libera = false) {
  // Isola/libero: niente vincolo ai muri (posizione libera), ma SEMPRE respinta
  // dagli altri mobili e aggancio magnetico (si attaccano perfetti tra loro).
  const libero = !!m.isola;
  // libera = true (Ctrl): spostamento totalmente libero — niente calamita né
  // respinta dai vicini. Resta solo il vincolo ai muri (non esce dalla stanza).
  if (libera) {
    if (!libero) ({ x, y } = vincolaAiMuri(progetto, m, x, y));
    return { x, y };
  }
  for (let pass = 0; pass < 6; pass++) {
    ({ x, y } = respingiDaMobili(progetto, m, x, y));
    if (!libero) ({ x, y } = vincolaAiMuri(progetto, m, x, y));
  }
  ({ x, y } = aggancioMagnetico(progetto, m, x, y));
  if (!libero) ({ x, y } = vincolaAiMuri(progetto, m, x, y));
  return { x, y };
}

export const LARGHEZZA_ANGOLO = 630;  // pensile d'angolo nelle cucine a L/U

/**
 * La base è appoggiata a un MURO? (serve per i pensili automatici: sopra le
 * isole/penisole NON vanno messi pensili, sennò restano appesi nel vuoto.)
 * Vero se il centro base è dentro la lunghezza di un muro e a breve distanza
 * dal lato interno. Un mobile marcato "isola" non è mai a muro.
 */
export function baseAMuro(progetto, b) {
  if (b.isola) return false;
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  for (let i = 0; i < full.length; i++) {
    const p = full[i];
    if (p.assente) continue;
    const a = vertici[i], c = vertici[i + 1];
    const dx = c.x - a.x, dy = c.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;
    const t = (b.x - a.x) * ux + (b.y - a.y) * uy;     // lungo il muro
    const dist = (b.x - a.x) * nx + (b.y - a.y) * ny;  // distanza dal lato interno
    if (t < -150 || t > L + 150) continue;             // fuori dalla lunghezza
    if (dist >= -50 && dist <= PROFONDITA_BASE / 2 + 220) return true;
  }
  return false;
}

/**
 * Genera automaticamente i pensili: uno sopra ogni base (stessa larghezza,
 * allineato, appoggiato allo stesso muro) all'altezza scelta (700/900), più
 * un pensile d'angolo da 630 in ogni angolo interno (cucine a L/U).
 * Sostituisce i pensili esistenti. Ritorna quanti ne ha creati.
 */
/**
 * Accorcia un pensile (centro px,py, larghezza w lungo l'asse ax,ay della
 * parete) rimuovendo la parte che entra nell'ingombro del pensile d'angolo
 * `ang`. Serve a coprire con un pensile la parte di base che la L non copre.
 * Ritorna {px,py,w} aggiornati, oppure null se non c'è sovrapposizione.
 */
function accorciaPensileControAngolo(px, py, w, ax, ay, ang) {
  const A = aabb(ang, ang.x, ang.y);
  const sC = px * ax + py * ay, sAng = ang.x * ax + ang.y * ay;
  const angHalf = A.hx * Math.abs(ax) + A.hy * Math.abs(ay);
  const angLo = sAng - angHalf, angHi = sAng + angHalf;
  const pLo = sC - w / 2, pHi = sC + w / 2;
  // Stessa fila (vicini in perpendicolare)?
  const qx = -ay, qy = ax;
  const perpC = px * qx + py * qy, perpAng = ang.x * qx + ang.y * qy;
  const perpHalf = A.hx * Math.abs(qx) + A.hy * Math.abs(qy);
  if (Math.abs(perpC - perpAng) > perpHalf + PROFONDITA_PENSILE / 2 - 20) return null;
  if (Math.min(pHi, angHi) - Math.max(pLo, angLo) <= 1) return null;  // no overlap
  let nLo = pLo, nHi = pHi;
  if (sC >= sAng) nLo = Math.max(pLo, angHi);        // taglia lato verso l'angolo
  else nHi = Math.min(pHi, angLo);
  const nw = nHi - nLo;
  if (nw <= 1) return { px, py, w: 0 };
  const nC = (nLo + nHi) / 2;
  return { px: px + ax * (nC - sC), py: py + ay * (nC - sC), w: nw };
}

export function generaPensiliAuto(progetto, altezzaPensile) {
  // Via i pensili attuali, riparto da zero
  progetto.mobiliLiberi = (progetto.mobiliLiberi || [])
    .filter((m) => categoriaTipo(m.tipo) !== 'pensile');
  let nextId = Math.max(0, ...progetto.mobiliLiberi.map((m) => m.id)) + 1;
  const nuovi = [];
  const OFFSET = (PROFONDITA_BASE - PROFONDITA_PENSILE) / 2; // 125 mm

  // 1) PRIMA i pensili d'angolo a L (630) in ogni angolo interno, così i
  //    pensili normali sanno dove sono e possono "cedere" lo spazio d'angolo.
  const angolari = [];
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i], b = full[i + 1];
    if (a.assente || b.assente || !angoloInterno(a, b)) continue;
    const a2 = vertici[i + 1], b2 = vertici[i + 2];
    const dx = b2.x - a2.x, dy = b2.y - a2.y;
    const L2 = Math.hypot(dx, dy) || 1;
    const ux = dx / L2, uy = dy / L2;
    const sgn = b.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L2 * sgn, ny = dx / L2 * sgn;
    // Il pensile L e' 63x63: il centro va a mezza L (315) da ENTRAMBI i muri,
    // cosi' l'angolo esterno della L tocca il vertice e NON entra nel muro
    // (prima la componente perpendicolare usava mezza profondita' pensile = 175
    // e la L sforava di 140 mm dentro la parete).
    const cHalf = LARGHEZZA_ANGOLO / 2;
    const cx = a2.x + ux * cHalf + nx * cHalf;
    const cy = a2.y + uy * cHalf + ny * cHalf;
    const p = { id: nextId++, tipo: 'pensile-angolo', larghezza_mm: LARGHEZZA_ANGOLO, altezza_mm: altezzaPensile, x: cx, y: cy, rot: 0 };
    p.rot = orientaLVersoAngolo(cx, cy, a2, LARGHEZZA_ANGOLO, PROFONDITA_PENSILE);
    // Niente modulo d'angolo se l'angolo è occupato da una colonna.
    const A = aabb(p, p.x, p.y);
    const angoloOccupato = progetto.mobiliLiberi.some((o) => {
      if (categoriaTipo(o.tipo) !== 'colonna') return false;
      const B = aabb(o, o.x, o.y);
      return Math.abs(p.x - o.x) < A.hx + B.hx - 20 && Math.abs(p.y - o.y) < A.hy + B.hy - 20;
    });
    if (angoloOccupato) { nextId--; continue; }
    angolari.push(p);
    nuovi.push(p);
  }

  // 2) Un pensile sopra ogni base A MURO, allineato alla base. Dove c'è un
  //    pensile d'angolo a L, il pensile viene ACCORCIATO alla parte di base
  //    che la L non copre (es. base 100 + L 63 -> pensile da 37), così si
  //    copre tutta la base. Se la larghezza che ne risulta non e' standard,
  //    il pensile viene marcato "fuoriMisura" (da tagliare).
  for (const b of progetto.mobiliLiberi) {
    if (categoriaTipo(b.tipo) !== 'base') continue;
    if (!baseAMuro(progetto, b)) continue;
    const rad = (b.rot || 0) * Math.PI / 180;
    const nx = -Math.sin(rad), ny = -Math.cos(rad); // normale fronte (verso stanza)
    const ax = Math.cos(rad), ay = Math.sin(rad);   // asse larghezza (lungo parete)
    let w = dimMobile(b).w;
    let px = b.x - nx * OFFSET, py = b.y - ny * OFFSET;
    for (const ang of angolari) {
      const r = accorciaPensileControAngolo(px, py, w, ax, ay, ang);
      if (r) { px = r.px; py = r.py; w = r.w; }
    }
    if (w < 80) continue;                            // residuo troppo piccolo
    const wr = Math.round(w);
    const standard = LARGHEZZE_BASE.includes(wr);
    const pens = { id: nextId++, tipo: 'pensile', larghezza_mm: wr,
      altezza_mm: altezzaPensile, x: px, y: py, rot: b.rot || 0,
      fuoriMisura: !standard, sopraBase: b.id };
    // Eredita la configurazione ante dalla base sotto (numero solo se stessa
    // larghezza; lato di apertura sempre).
    if (b.antaLato != null) pens.antaLato = b.antaLato;
    if (wr === Math.round(dimMobile(b).w) && b.ante != null) pens.ante = b.ante;
    nuovi.push(pens);
  }

  progetto.mobiliLiberi.push(...nuovi);
  // Assesto solo ai muri (i pensili normali seguono le basi, già allineati;
  // niente repulsione reciproca che li sparpaglierebbe disallineandoli).
  for (const p of nuovi) {
    if (p.tipo === 'pensile-angolo') continue;     // L: posizione già calcolata
    const v = vincolaAiMuri(progetto, p, p.x, p.y);
    p.x = snap(v.x); p.y = snap(v.y);
  }
  return nuovi.length;
}
export function ruotaMobileLibero(progetto, id) {
  const m = trovaMobileLibero(progetto, id);
  if (m) m.rot = ((m.rot || 0) + 90) % 360;
}

/**
 * Numero di ante di un modulo (base con ante / pensile): 1 o 2.
 * Se l'utente non ha scelto, default automatico per larghezza (≥900 → 2).
 */
export function anteDiMobile(m) {
  if (m.ante === 1 || m.ante === 2) return m.ante;
  return (m.larghezza_mm || 600) >= 900 ? 2 : 1;
}

/**
 * Copia la configurazione ante (numero + lato apertura) da una base al pensile
 * generato SOPRA di essa, così l'armadio alto rispecchia quello basso.
 * Il numero di ante si copia solo a parità di larghezza (il pensile accorciato
 * contro l'angolo ha meno spazio); il lato di apertura si copia sempre.
 */
export function sincronizzaAntePensile(progetto, base) {
  if (!base || categoriaTipo(base.tipo) !== 'base') return;
  const pensile = (progetto.mobiliLiberi || []).find(
    (p) => p.tipo === 'pensile' && p.sopraBase === base.id);
  if (!pensile) return;
  const stessaLargh = Math.round(dimMobile(pensile).w) === Math.round(dimMobile(base).w);
  if (stessaLargh) { if (base.ante != null) pensile.ante = base.ante; else delete pensile.ante; }
  if (base.antaLato != null) pensile.antaLato = base.antaLato; else delete pensile.antaLato;
}
export function rimuoviMobileLibero(progetto, id) {
  progetto.mobiliLiberi = progetto.mobiliLiberi.filter((m) => m.id !== id);
}

/**
 * Sposta un mobile libero di (dx, dy) mm in modo ESATTO (per allineare bene
 * reglette e mobili). Niente aggancio magnetico: la posizione è precisa.
 */
export function muoviMobileLibero(progetto, id, dx, dy) {
  const m = trovaMobileLibero(progetto, id);
  if (!m) return;
  m.x = Math.round(m.x + dx);
  m.y = Math.round(m.y + dy);
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
 * VALIDAZIONE MOBILI LIBERI: rileva mobili dello stesso livello (basso/alto)
 * che si SOVRAPPONGONO. Ritorna un array di { tipo, messaggio }.
 * Per le forme ad angolo (L) l'AABB sovrastima (c'è l'incavo), quindi si usa
 * una soglia di compenetrazione più alta per non dare falsi allarmi.
 */
export function problemiMobiliLiberi(progetto) {
  const out = [];
  const mob = (progetto.mobiliLiberi || []).filter((m) => {
    const c = categoriaTipo(m.tipo);
    return c === 'base' || c === 'pensile' || c === 'colonna';
  });
  const visti = new Set();
  for (let i = 0; i < mob.length; i++) {
    for (let j = i + 1; j < mob.length; j++) {
      const a = mob[i], b = mob[j];
      if (livelloDiMobile(a) !== livelloDiMobile(b)) continue;
      const A = aabb(a, a.x, a.y), B = aabb(b, b.x, b.y);
      const ox = (A.hx + B.hx) - Math.abs(a.x - b.x);
      const oy = (A.hy + B.hy) - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      const angolare = String(a.tipo).startsWith('pensile-angolo') || String(b.tipo).startsWith('pensile-angolo');
      const soglia = angolare ? 200 : 25;          // mm di compenetrazione
      if (ox > soglia && oy > soglia) {
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (visti.has(key)) continue;
        visti.add(key);
        out.push({ tipo: 'sovrapposizione', messaggio:
          `⚠ ${nomeTipo(a.tipo)} e ${nomeTipo(b.tipo)} si sovrappongono — spostane uno o riduci la misura.` });
      }
    }
  }
  // CASSETTIERA NELL'ANGOLO CIECO: una base cassetti non può essere il mobile
  // "coperto" dell'angolo. La parte di fronte nascosta dall'altro mobile
  // resterebbe senza cassetti (sarebbero larghi pochi cm = impossibili da
  // costruire). Serve una base ad ante, oppure va spostata fuori dall'angolo.
  for (const m of (progetto.mobiliLiberi || [])) {
    if (m.tipo !== 'base-cassetti') continue;
    const info = infoAngoloCieco(progetto, m);
    if (info && info.coperto) {
      out.push({ tipo: 'cassettiera-angolo', messaggio:
        `❓ ${nomeTipo(m.tipo)} nell'angolo: impossibile creare cassettiera così piccola. ` +
        `Nell'angolo cieco mettici una base ad ante, oppure sposta la cassettiera fuori dall'angolo.` });
    }
  }
  // SPAZIO REGLETTA D'ANGOLO: la regletta non può essere più piccola dello
  // spessore dell'anta. Se due mobili d'angolo (che "si toccano") sono troppo
  // vicini, la regletta non si riesce a fare → avviso. Solo con auto-regletta.
  if (progetto.autoRegletta !== false) {
    const ra = progetto.reglettaAngolo || {};
    const spess = ra.spessore != null ? ra.spessore : 18;
    const vistiReg = new Set();
    for (const m of (progetto.mobiliLiberi || [])) {
      const info = infoAngoloCieco(progetto, m);
      if (!info || info.coperto) continue;            // solo angoli "che si toccano"
      if (info.gap == null || info.gap >= spess) continue;
      const key = m.id < info.o.id ? `${m.id}-${info.o.id}` : `${info.o.id}-${m.id}`;
      if (vistiReg.has(key)) continue;
      vistiReg.add(key);
      out.push({ tipo: 'regletta-stretta', messaggio:
        `⚠ Manca spazio per la regletta nell'angolo: tra gli armadi ci sono ${Math.max(0, info.gap)} mm ` +
        `ma la regletta non può essere più sottile dello spessore anta (${spess} mm). Allontana un armadio.` });
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
 * Spazio libero su ogni muro, tenendo conto dei MOBILI LIBERI appoggiati.
 * Un mobile conta su un muro se sta sul lato interno vicino a quel muro.
 * Ritorna [{ id, idx, lunghezza, coperto, libero }] (mm), solo muri presenti.
 */
export function liberoPareti(progetto) {
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const mobili = progetto.mobiliLiberi || [];
  const out = [];
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;                 // versore lungo il muro
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;    // normale verso l'interno
    const intervalli = [];
    for (const m of mobili) {
      const d = dimMobile(m);
      const rad = ((m.rot || 0) * Math.PI) / 180;
      const c = Math.cos(rad), s = Math.sin(rad);
      const hw = d.w / 2, hd = d.d / 2;
      const rx = m.x - a.x, ry = m.y - a.y;
      const tC = rx * ux + ry * uy;                 // proiezione del centro lungo il muro
      const dC = rx * nx + ry * ny;                 // distanza dal muro (verso interno)
      // Semi-ingombro proiettato lungo muro e lungo normale (bounding box orientato)
      const extU = Math.abs(hw * (c * ux + s * uy)) + Math.abs(hd * (-s * ux + c * uy));
      const extN = Math.abs(hw * (c * nx + s * ny)) + Math.abs(hd * (-s * nx + c * ny));
      if (dC - extN > 300) continue;                // troppo dentro: non è su questo muro
      if (dC + extN < -80) continue;                // dal lato sbagliato (fuori)
      const lo = Math.max(0, tC - extU);
      const hi = Math.min(L, tC + extU);
      if (hi > lo) intervalli.push([lo, hi]);
    }
    intervalli.sort((a2, b2) => a2[0] - b2[0]);
    let coperto = 0, cur = null;
    for (const iv of intervalli) {
      if (!cur) cur = [...iv];
      else if (iv[0] <= cur[1]) cur[1] = Math.max(cur[1], iv[1]);
      else { coperto += cur[1] - cur[0]; cur = [...iv]; }
    }
    if (cur) coperto += cur[1] - cur[0];
    out.push({
      id: p.id, idx: i, lunghezza: Math.round(L),
      coperto: Math.round(coperto), libero: Math.max(0, Math.round(L - coperto)),
    });
  });
  return out;
}

// Spessore anta standard (per il calcolo della regletta a L d'angolo).
export const SPESSORE_ANTA = 18;

/** AABB (assi del mondo) di un mobile: {x0,x1,y0,y1}. */
function aabbMondo(m) {
  const d = dimMobile(m);
  const rotN = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const horiz = rotN % 180 === 0;             // larghezza lungo X
  const hx = (horiz ? d.w : d.d) / 2;
  const hy = (horiz ? d.d : d.w) / 2;
  return { x0: m.x - hx, x1: m.x + hx, y0: m.y - hy, y1: m.y + hy, horiz, w: d.w, d: d.d };
}

/**
 * Info per il mobile "ad angolo cieco": trova la base PERPENDICOLARE che lo
 * copre all'angolo e calcola quanta parte del fronte è coperta e da che lato.
 * Ritorna null se il mobile non è segnato cieco o non trova il mobile che copre.
 * { coveredW, latoDx (true=copertura sul lato +), corner:{x,y} }.
 */
export function infoAngoloCieco(progetto, m) {
  if (!m || categoriaTipo(m.tipo) !== 'base') return null;
  if (m.angoloCieco === false) return null;            // forzato normale
  const A = aabbMondo(m);
  const TOL = 150;                                     // mm: due basi perpendicolari entro
                                                       // questa distanza formano un angolo a L
  let best = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (categoriaTipo(o.tipo) !== 'base') continue;
    const B = aabbMondo(o);
    if (B.horiz === A.horiz) continue;                 // non perpendicolare
    // Separazione su ciascun asse: negativa = si sovrappongono, ~0 = si toccano,
    // positiva = c'è spazio. Un angolo a L richiede "ingaggio" su ENTRAMBI gli assi.
    const sepX = Math.max(B.x0 - A.x1, A.x0 - B.x1);
    const sepY = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    if (sepX > TOL || sepY > TOL) continue;            // troppo lontani: non è un angolo
    // Sovrapposizione reale dei footprint: se c'è, un mobile COPRE il fronte
    // dell'altro (angolo cieco vero → serve pannello cieco). Se si toccano soltanto,
    // entrambe le ante si aprono → serve solo la regletta a L.
    const ix0 = Math.max(A.x0, B.x0), ix1 = Math.min(A.x1, B.x1);
    const iy0 = Math.max(A.y0, B.y0), iy1 = Math.min(A.y1, B.y1);
    const coperto = (ix1 - ix0 > 5) && (iy1 - iy0 > 5);
    // Chi è il CIECO della coppia? Chi non può aprire un'anta = il più largo
    // (ha 2 ante, una bloccata). Override manuale con angoloCieco true/false.
    let mCieco;
    if (m.angoloCieco === true) mCieco = true;
    else if (o.angoloCieco === true) mCieco = false;
    else { const wm = A.w, wo = B.w; mCieco = wm > wo || (wm === wo && m.id < o.id); }
    if (!mCieco) continue;
    let coveredW, latoDx, cornerX, cornerY;
    if (A.horiz) {                                      // larghezza lungo X
      coveredW = coperto ? (ix1 - ix0) : Math.min(B.d, A.w);
      latoDx = o.x > m.x;                               // l'altro mobile sta a destra?
      cornerX = latoDx ? A.x1 : A.x0;                   // spigolo verso l'altro mobile
      cornerY = m.y;
    } else {                                            // larghezza lungo Y
      coveredW = coperto ? (iy1 - iy0) : Math.min(B.d, A.w);
      latoDx = o.y > m.y;
      cornerY = latoDx ? A.y1 : A.y0;
      cornerX = m.x;
    }
    // Preferisci coperture reali; a parità, l'angolo più "stretto" (mobili più vicini).
    const score = coperto ? (1e6 + (ix1 - ix0) * (iy1 - iy0)) : (1e3 - (sepX + sepY));
    if (!best || score > best.score) {
      best = { o, score, coperto, coveredW: Math.round(coveredW), latoDx, horizMe: A.horiz,
        gap: Math.round(Math.max(sepX, sepY)),   // luce tra i due mobili (mm): spazio per la regletta
        corner: { x: cornerX, y: cornerY } };
    }
  }
  return best;
}

/**
 * Conta i mobili base allineati sulla stessa FILA di m (stesso orientamento e
 * stessa coordinata di profondità). Serve a capire se m appartiene a una fila
 * principale (più mobili attaccati) o è un pezzo isolato: nell'angolo cieco,
 * chi è in fila con altri resta fermo, chi è isolato si sposta.
 */
function contaInFila(progetto, m) {
  if (categoriaTipo(m.tipo) !== 'base') return 0;
  const A = aabbMondo(m);
  const rotN = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const horizM = rotN % 180 === 0;
  let count = 0;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (categoriaTipo(o.tipo) !== 'base') continue;
    const rotO = ((Math.round((o.rot || 0) / 90) * 90) % 360 + 360) % 360;
    if ((rotO % 180 === 0) !== horizM) continue;         // stesso orientamento
    const B = aabbMondo(o);
    // In fila se i bordi di profondità sono allineati (tolleranza 50 mm).
    if (horizM) {
      if (Math.abs(A.y0 - B.y0) > 50 && Math.abs(A.y1 - B.y1) > 50) continue;
    } else {
      if (Math.abs(A.x0 - B.x0) > 50 && Math.abs(A.x1 - B.x1) > 50) continue;
    }
    count++;
  }
  return count;
}

/**
 * Spostamento automatico per l'angolo cieco (mobili che si toccano): resta
 * fermo il mobile che ha più vicini sulla sua stessa fila (= quello della
 * fila principale, già collegato ad altri armadi). L'altro, quello isolato
 * nell'angolo, si sposta lungo la SUA PARETE (asse lungo del mobile) finché
 * tra i due c'è esattamente `base` mm di luce = la larghezza della regletta.
 * Esempio: fila orizzontale di 3 basi + 1 armadio verticale nell'angolo in
 * alto: si sposta l'armadio verticale verso l'alto, la fila resta ferma.
 * Idempotente: quando la luce è già = base non muove più nulla.
 */
export function applicaRegletteAngolo(progetto) {
  const base = (progetto.reglettaAngolo && progetto.reglettaAngolo.base) || 30;
  const mob = progetto.mobiliLiberi || [];
  for (const c of mob) {
    const info = infoAngoloCieco(progetto, c);
    if (!info || info.coperto) continue;           // solo angoli "che si toccano"
    const o = info.o;
    if (!o) continue;
    // Auto-regletta attiva → il gap d'angolo si apre SEMPRE in automatico,
    // anche se i mobili sono stati messi a mano: così la regletta ci sta
    // sempre (niente avviso "0 spazio" da risolvere a mano).
    // Decido chi resta fermo e chi si sposta in base ai VICINI:
    // più vicini in fila = fila principale = resta fermo.
    const nc = contaInFila(progetto, c);
    const no = contaInFila(progetto, o);
    let fisso, mobile;
    if (no > nc) { fisso = o; mobile = c; }
    else { fisso = c; mobile = o; }
    const F = aabbMondo(fisso), M = aabbMondo(mobile);
    // il mobile scorre lungo la sua parete (asse lungo del mobile)
    const axisX = M.horiz;
    const overlap = axisX
      ? Math.min(F.x1, M.x1) - Math.max(F.x0, M.x0)
      : Math.min(F.y1, M.y1) - Math.max(F.y0, M.y0);
    const delta = overlap + base;                  // porta la luce a `base`
    if (Math.abs(delta) < 0.5) continue;           // già a posto → idempotente
    const dir = (axisX ? mobile.x : mobile.y) >= (axisX ? fisso.x : fisso.y) ? 1 : -1;
    if (axisX) mobile.x = Math.round(mobile.x + dir * delta);
    else mobile.y = Math.round(mobile.y + dir * delta);
  }
}

/**
 * Trova gli SPAZI VUOTI tra due mobili bassi affiancati sulla stessa linea
 * (stessa fila/orientamento), es. il salto di ~3 cm quando ci si allinea a un
 * pensile d'angolo da 630. Ritorna, per ogni spazio, centro (x,y), larghezza
 * (gap in mm), orientamento e profondità. Le reglette già presenti "occupano"
 * lo spazio, così un buco già riempito non viene più segnalato.
 */
export function spaziTraMobili(progetto, min = 10, max = 300) {
  const mob = (progetto.mobiliLiberi || []).filter((m) => {
    const cat = categoriaTipo(m.tipo);
    return cat === 'base' || cat === 'regletta';
  });
  const gruppi = {};
  for (const m of mob) {
    const d = dimMobile(m);
    const rotN = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360;
    const horiz = rotN % 180 === 0;                   // larghezza lungo X
    const line = horiz ? Math.round(m.y / 5) * 5 : Math.round(m.x / 5) * 5;
    const pos = horiz ? m.x : m.y;
    const half = d.w / 2;                             // mezza larghezza lungo l'asse
    const key = `${horiz ? 'H' : 'V'}|${line}`;
    (gruppi[key] ||= { horiz, line, items: [] }).items.push({ pos, half, m });
  }
  const out = [];
  for (const k in gruppi) {
    const G = gruppi[k];
    G.items.sort((a, b) => a.pos - b.pos);
    for (let i = 0; i < G.items.length - 1; i++) {
      const A = G.items[i], B = G.items[i + 1];
      const gap = (B.pos - B.half) - (A.pos + A.half);
      if (gap < min || gap > max) continue;
      // se uno dei due è già una regletta, lo spazio è di fatto riempito
      if (categoriaTipo(A.m.tipo) === 'regletta' || categoriaTipo(B.m.tipo) === 'regletta') continue;
      const center = (A.pos + A.half + (B.pos - B.half)) / 2;
      out.push({
        x: G.horiz ? center : G.line,
        y: G.horiz ? G.line : center,
        gap: Math.round(gap),
        rot: A.m.rot || 0,
        depth: Math.round(Math.max(dimMobile(A.m).d, dimMobile(B.m).d)),
      });
    }
  }
  return out;
}

/**
 * Riempie automaticamente gli spazi tra i mobili con una regletta dello
 * spessore esatto del vuoto. Ritorna quante reglette ha inserito.
 */
export function riempiSpaziReglette(progetto) {
  const gaps = spaziTraMobili(progetto);
  if (gaps.length === 0) return 0;
  let nextId = Math.max(0, ...progetto.mobiliLiberi.map((m) => m.id)) + 1;
  let n = 0;
  for (const g of gaps) {
    progetto.mobiliLiberi.push({
      id: nextId++, tipo: 'regletta',
      latoA_mm: g.gap, latoB_mm: g.depth, altezza_mm: 700,
      x: g.x, y: g.y, rot: g.rot,
    });
    n++;
  }
  return n;
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
