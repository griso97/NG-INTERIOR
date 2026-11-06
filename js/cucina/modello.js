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
// Costadi (fianchi di finitura): altezze standard, tutte in profondità 600
export const ALTEZZE_COSTADO = [850, 900, 2200, 2300, 2350, 2450];

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
  { id: 'regletta',      nome: 'Regletta a L', categoria: 'regletta',
    larghezze: [30], altezze: ALTEZZE_BASE, profondita: 30 },
  { id: 'costado',       nome: 'Costado', categoria: 'costado',
    larghezze: [20], altezze: ALTEZZE_COSTADO, profondita: 600 },
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
  if (t.categoria === 'regletta') {
    return [
      { campo: 'latoA_mm',  et: 'Lato 1 (mm)', tipo: 'numero', default: 30, min: 10, step: 5 },
      { campo: 'latoB_mm',  et: 'Lato 2 (mm)', tipo: 'numero', default: 30, min: 10, step: 5 },
      { campo: 'altezza_mm', et: 'Altezza (mm)', opzioni: ALTEZZE_BASE, default: ALTEZZE_BASE[0] },
    ];
  }
  if (t.categoria === 'costado') {
    // Tutti liberi (modalità custom); i valori standard sono scorciatoie
    return [
      { campo: 'altezza_mm',    et: 'Altezza (mm)', tipo: 'numero', default: 850, min: 50, step: 10, opzioni: ALTEZZE_COSTADO },
      { campo: 'profondita_mm', et: 'Profondità (mm)', tipo: 'numero', default: 600, min: 50, step: 10, opzioni: [600, 350] },
      { campo: 'spessore_mm',   et: 'Spessore (mm)', tipo: 'numero', default: 18, min: 5, step: 1, opzioni: [18, 20, 25, 30] },
    ];
  }
  if (t.categoria === 'colonna') {
    return [
      { campo: 'altezza_mm',      et: 'Altezza totale (mm)', opzioni: ALTEZZE_COLONNA, default: ALTEZZE_COLONNA[0] },
      { campo: 'altezzaBassa_mm', et: 'Porta bassa (mm)',    opzioni: ALTEZZE_BASE,    default: ALTEZZE_BASE[0] },
      { campo: 'variante',        et: 'Parte alta',
        opzioni: VARIANTI_COLONNA.map((v) => ({ v: v.id, l: v.nome })), default: 'porta' },
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
  if (cat === 'costado') {
    return `${m.altezza_mm}×${m.profondita_mm} · sp ${m.spessore_mm}`;
  }
  if (cat === 'colonna') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${nomeVarianteColonna(m.variante)}`;
  }
  if (m.tipo === 'base-cassetti') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${m.cassetti || 3} cassetti`;
  }
  return m.altezza_mm ? `${m.larghezza_mm}×${m.altezza_mm}` : `${m.larghezza_mm}`;
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
  if (cat === 'costado') {
    return { w: m.spessore_mm || 20, d: m.profondita_mm || 600 };
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
  if (cat === 'costado') return (m.profondita_mm || 600) >= 500 ? 'basso' : 'alto';
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
      // (b) estremi: se il mobile è appoggiato a questo muro, resta tra 0 e L
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
  const u = muroPiuVicino(progetto, x, y);
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
  // Il fronte (ante) di default guarda la direzione (sin, −cos) della rotazione
  let bestRot = m.rot || 0, bestVal = -Infinity;
  for (const r of [0, 90, 180, 270]) {
    const rad = r * Math.PI / 180;
    const v = Math.sin(rad) * nx + (-Math.cos(rad)) * ny;
    if (v > bestVal) { bestVal = v; bestRot = r; }
  }
  return bestRot;
}

/**
 * Posizione finale vincolata: alterna respinta dagli altri mobili e blocco
 * ai muri, così si assesta rispettando tutto.
 */
export function posizionaVincolata(progetto, m, x, y) {
  for (let pass = 0; pass < 6; pass++) {
    ({ x, y } = respingiDaMobili(progetto, m, x, y));
    ({ x, y } = vincolaAiMuri(progetto, m, x, y));
  }
  return { x, y };
}

export const LARGHEZZA_ANGOLO = 630;  // pensile d'angolo nelle cucine a L/U

/**
 * Genera automaticamente i pensili: uno sopra ogni base (stessa larghezza,
 * allineato, appoggiato allo stesso muro) all'altezza scelta (700/900), più
 * un pensile d'angolo da 630 in ogni angolo interno (cucine a L/U).
 * Sostituisce i pensili esistenti. Ritorna quanti ne ha creati.
 */
export function generaPensiliAuto(progetto, altezzaPensile) {
  // Via i pensili attuali, riparto da zero
  progetto.mobiliLiberi = (progetto.mobiliLiberi || [])
    .filter((m) => categoriaTipo(m.tipo) !== 'pensile');
  let nextId = Math.max(0, ...progetto.mobiliLiberi.map((m) => m.id)) + 1;
  const nuovi = [];
  const OFFSET = (PROFONDITA_BASE - PROFONDITA_PENSILE) / 2; // 125 mm

  // Un pensile sopra ogni base (non sopra colonne/reglette/costadi)
  for (const b of progetto.mobiliLiberi) {
    if (categoriaTipo(b.tipo) !== 'base') continue;
    const rad = (b.rot || 0) * Math.PI / 180;
    const nx = Math.sin(rad), ny = -Math.cos(rad); // normale verso la stanza (fronte base)
    nuovi.push({
      id: nextId++, tipo: 'pensile',
      larghezza_mm: dimMobile(b).w, altezza_mm: altezzaPensile,
      x: b.x - nx * OFFSET, y: b.y - ny * OFFSET, rot: b.rot || 0,
    });
  }

  // Pensile d'angolo (630) in ogni angolo interno
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
    const cAlong = LARGHEZZA_ANGOLO / 2;
    const cx = a2.x + ux * cAlong + nx * (PROFONDITA_PENSILE / 2);
    const cy = a2.y + uy * cAlong + ny * (PROFONDITA_PENSILE / 2);
    const p = { id: nextId++, tipo: 'pensile', larghezza_mm: LARGHEZZA_ANGOLO, altezza_mm: altezzaPensile, x: cx, y: cy, rot: 0 };
    const rot = orientaVersoMuro(progetto, p, cx, cy);
    if (rot !== null) p.rot = rot;
    // Niente modulo d'angolo se l'angolo è occupato da una colonna
    // (la colonna è a tutta altezza: il pensile ci finirebbe dentro)
    const A = aabb(p, p.x, p.y);
    const angoloOccupato = progetto.mobiliLiberi.some((o) => {
      if (categoriaTipo(o.tipo) !== 'colonna') return false;
      const B = aabb(o, o.x, o.y);
      return Math.abs(p.x - o.x) < A.hx + B.hx - 20 && Math.abs(p.y - o.y) < A.hy + B.hy - 20;
    });
    if (angoloOccupato) { nextId--; continue; }
    nuovi.push(p);
  }

  progetto.mobiliLiberi.push(...nuovi);
  // Assesto (muri + niente sovrapposizioni fra loro)
  for (const p of nuovi) {
    const v = posizionaVincolata(progetto, p, p.x, p.y);
    p.x = snap(v.x); p.y = snap(v.y);
  }
  return nuovi.length;
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
