// =============================================================================
// MODELLO DATI — Progetto cucina
// =============================================================================
// Struttura unica condivisa tra i 4 step del wizard. Ogni step legge/arricchisce
// questo stesso oggetto senza duplicare dati.
// Tutte le misure sono in MILLIMETRI.
// =============================================================================
import { parametri } from '../parametri.js?v=20261119y';

/**
 * Costruisce un progetto cucina vuoto (default = lineare 3000 mm).
 */
export function progettoDefault() {
  return {
    versione: 1,
    versioneRot: 1,          // rotazione "girato a mano" (rotManuale) gestita
    stepCorrente: 1,
    passi5: true,           // passi: 1 Pianta · 2 Bassi · 3 Alti · 4 Accessori · 5 Rendering (prima il rendering era il 4)
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
// COLONNA SU MISURA (montaggio 2): profondità struttura finita e spessori di default
export const PROF_STRUTTURA_MISURA = 580, SP_STRUTTURA_MISURA = 18, SP_SCHIENA_MISURA = 10;
/**
 * PEZZI della COLONNA SU MISURA, montaggio 2 (fianchi interi, top e fondo fra i fianchi):
 *  - fianchi: altezza H × (P − schiena)                              ×2
 *  - top e fondo: (L − 2 × spessore) × (P − schiena)                 ×2
 *  - schiena da 10 mm avvitata dietro: (L − 2) × (H − 2)             ×1
 *  - ripiani (4 di default): (L − 2 × spessore) × (P − schiena)       ×n  (+ 4 portaripiani l'uno)
 * Es. 2300 × 400, P 580: fianchi 2300×570, top/fondo 364×570, schiena 398×2298.
 */
/** Spessore del FIANCO della struttura della colonna: 16 le colonne del fornitore, quello scelto la su misura. */
export function spFiancoColonna(m) { return m.tipo === 'colonna-misura' ? (m.spStruttura_mm || SP_STRUTTURA_MISURA) : 16; }
/** Profondità della STRUTTURA della colonna (senza le ante): 580 di solito. */
export function profStrutturaColonna(m) { return m.tipo === 'colonna-misura' ? (m.profStruttura_mm || PROF_STRUTTURA_MISURA) : dimMobile(m).d - 20; }
/** Altezza del VANO APERTO della colonna (come la porta alta: resto − vano). */
export function altezzaVanoColonna(m, rem) { return Math.max(100, Math.min(m.altezzaVano_mm || 600, rem - 100)); }
/**
 * CORNICE DEL VANO APERTO della colonna, nel colore delle ANTE (così la struttura bianca non si vede):
 *  - 2 ripiani (sopra e sotto): larghezza interna (L − 2 fianchi) × profondità struttura
 *  - 2 listelli sul bordo dei fianchi: larghi come il fianco (16), spessi come le ante (18), alti come il vano
 *  - 2 fianchetti dentro: profondità struttura × (vano − i 2 ripiani)
 * Es. colonna da 60, vano 45: ripiani 568×580, listelli 16×450 sp 18, fianchetti 580×414.
 */
export function pezziCorniceVano(m, vanoH, spAnta = 18) {
  const L = m.larghezza_mm || 600, sp = spFiancoColonna(m), P = profStrutturaColonna(m);
  return [
    { nome: 'Ripiano vano (cornice)', larghezza: L - 2 * sp, altezza: P, spessore: spAnta, quantita: 2 },
    { nome: 'Listello vano (cornice)', larghezza: sp, altezza: vanoH, spessore: spAnta, quantita: 2 },
    { nome: 'Fianchetto vano (cornice)', larghezza: P, altezza: vanoH - 2 * spAnta, spessore: spAnta, quantita: 2 },
  ];
}
/** Ripiani della colonna su misura: quelli scelti, 4 se non è stato scelto niente. */
export function ripianiColonnaMisura(m) { return m.ripiani != null ? Number(m.ripiani) || 0 : 4; }
export function pezziColonnaMisura(m) {
  const L = m.larghezza_mm || 600, H = m.altezza_mm || 2200;
  const P = m.profStruttura_mm || PROF_STRUTTURA_MISURA, sp = m.spStruttura_mm || SP_STRUTTURA_MISURA, sS = SP_SCHIENA_MISURA;
  const prof = P - sS, interno = L - 2 * sp;
  const pz = [
    { nome: 'Fianco (colonna su misura)', larghezza: prof, altezza: H, spessore: sp, quantita: 2 },
    { nome: 'Top / Fondo (colonna su misura)', larghezza: interno, altezza: prof, spessore: sp, quantita: 2 },
    { nome: 'Schiena (colonna su misura)', larghezza: L - 2, altezza: H - 2, spessore: sS, quantita: 1 },
  ];
  const nRip = ripianiColonnaMisura(m);
  if (nRip > 0) pz.push({ nome: 'Ripiano (colonna su misura)', larghezza: interno, altezza: prof, spessore: sp, quantita: nRip });
  return pz;
}
// Costadi (fianchi di finitura): altezze standard, tutte in profondità 600
export const ALTEZZE_COSTADO = [720, 850, 900, 920, 2200, 2300, 2350, 2450];

export const TIPI_MODULO_BASE = [
  { id: 'base-ante',     nome: 'Base con ante',     larghezze: LARGHEZZE_BASE },
  { id: 'base-cassetti', nome: 'Base cassetti',     larghezze: LARGHEZZE_BASE },
  { id: 'lavello',       nome: 'Modulo lavandino',  larghezze: LARGHEZZE_BASE },
  { id: 'lavastoviglie', nome: 'Lavastoviglie',     larghezze: [600, 450] },
  { id: 'lavatrice',     nome: 'Lavatrice',         larghezze: [600, 450] },
  { id: 'forno',         nome: 'Modulo forno',      larghezze: [600] },
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
  { id: 'lavello',       nome: 'Modulo lavandino', categoria: 'base',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'lavastoviglie', nome: 'Lavastoviglie', categoria: 'lavastoviglie',
    larghezze: [600, 450], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'lavatrice',     nome: 'Lavatrice', categoria: 'lavatrice',
    larghezze: [600, 450], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  { id: 'forno',         nome: 'Modulo forno', categoria: 'base',
    larghezze: [600], altezze: ALTEZZE_BASE, profondita: PROFONDITA_BASE },
  // Base ANGOLO a L: lo STESSO mobile del pensile angolo (stesse ante), solo
  // profondo come gli altri bassi → ogni lato cresce della profondità in più:
  // 630 + (600 − 350) = 880. Lati e profondità si cambiano dal pannello
  // (latoB_mm, profBraccio_mm); le ante sono lato − profondità.
  { id: 'base-angolo',   nome: 'Base angolo', categoria: 'base',
    larghezze: [880], altezze: ALTEZZE_BASE, profondita: 880 },
  { id: 'pensile',       nome: 'Pensile', categoria: 'pensile',
    larghezze: LARGHEZZE_BASE, altezze: ALTEZZE_PENSILE, profondita: PROFONDITA_PENSILE },
  { id: 'pensile-angolo', nome: 'Pensile angolo', categoria: 'pensile',
    larghezze: [630], altezze: ALTEZZE_PENSILE, profondita: 630 },
  { id: 'pensile-angolo-45', nome: 'Ciaflan', categoria: 'pensile',
    larghezze: [630], altezze: ALTEZZE_PENSILE, profondita: 630 },
  { id: 'colonna',       nome: 'Colonna', categoria: 'colonna',
    larghezze: [600], altezze: ALTEZZE_COLONNA, profondita: 600 },
  // COLONNA SU MISURA: la costruiamo NOI con i pezzi (montaggio 2: fianchi interi, top e fondo
  // fra i fianchi, schiena da 10 mm dietro). Larghezza, altezza e profondità libere; 4 piedini.
  { id: 'colonna-misura', nome: 'Colonna su misura', categoria: 'colonna',
    larghezze: [300, 400, 450, 500, 600], altezze: ALTEZZE_COLONNA, profondita: 600 },
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
  // FRIGO libero (elettrodomestico, a terra, niente zoccolo): di solito tra due
  // costadi alti, con il MOBILE SOPRA FRIGO in cima
  // misura standard di un frigo combinato: 60 di larghezza (standard); altezze
  // più comuni 186 (es. Balay) e 203 (es. Bosch KGN39), 176; profondo ~66 con la porta
  { id: 'frigo',         nome: 'Frigo', categoria: 'frigo',
    larghezze: [600, 700], altezze: [1860, 2030, 1760], profondita: 660 },
  // Mobile sopra il frigo: la CIMA va a filo con la cosa alta accanto (costado,
  // colonna, pannello); l'altezza la scegli tu (es. 35 cm)
  // Misure standard: 60 di larghezza, 35 o 45 di altezza, profondo come i mobili
  // bassi (58 + anta = 60); tutte modificabili a mano
  { id: 'sopra-frigo',   nome: 'Mobile sopra frigo', categoria: 'altillo',
    larghezze: [600], altezze: [350, 450], profondita: PROFONDITA_BASE },
  // CUCINA A PONTE: il "ponte" sono mobili profondi come le colonne (60), uno
  // sopra ogni base, larghi come lei, con la cima a filo con le colonne ai lati
  { id: 'ponte',         nome: 'Ponte', categoria: 'altillo',
    larghezze: LARGHEZZE_BASE, altezze: [360, 240, 480, 600], profondita: PROFONDITA_BASE },
  // Oggetti 3D (arredo/decor): non sono moduli, si posano liberamente.
  { id: 'sgabello',      nome: 'Sgabello bar', categoria: 'oggetto',
    larghezze: [527], altezze: [880], profondita: 430 },
];

// Colori del frigo libero
export const COLORI_FRIGO = [
  { id: 'bianco', nome: 'Bianco', css: '#f2f2ef' },
  { id: 'nero', nome: 'Nero', css: '#161618' },
  { id: 'acciaio', nome: 'Acciaio inox', css: 'linear-gradient(135deg,#e1e3e6,#a4a8ad 55%,#cfd2d5)' },
];
export function nomeColoreFrigo(id) { return (COLORI_FRIGO.find((c) => c.id === id) || COLORI_FRIGO[0]).nome; }

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
  if (t.categoria === 'frigo') {
    return [
      { campo: 'larghezza_mm', et: 'Larghezza (mm)', tipo: 'numero', min: 300, step: 10, opzioni: t.larghezze, default: 600 },
      { campo: 'altezza_mm',   et: 'Altezza (mm)', tipo: 'numero', min: 500, step: 1, opzioni: t.altezze, default: 1860 },
      { campo: 'profondita_mm', et: 'Profondità con la porta (mm)', tipo: 'numero', min: 300, step: 1, opzioni: [660, 665, 600], default: 660 },
      { campo: 'colore', et: 'Colore', opzioni: COLORI_FRIGO.map((c) => ({ v: c.id, l: c.nome })), default: 'bianco' },
    ];
  }
  if (t.categoria === 'altillo') {
    return [
      { campo: 'larghezza_mm',  et: 'Larghezza (mm)', tipo: 'numero', min: 100, step: 10, opzioni: t.larghezze, default: 600 },
      { campo: 'altezza_mm',    et: 'Altezza (mm)', tipo: 'numero', min: 100, step: 10, opzioni: t.altezze, default: t.altezze[0] },
      { campo: 'profondita_mm', et: 'Profondità con le ante (mm)', tipo: 'numero', min: 200, step: 10, opzioni: [PROFONDITA_BASE], default: PROFONDITA_BASE },
    ];
  }
  if (tipoId === 'colonna-misura') {
    return [
      { campo: 'larghezza_mm',    et: 'Larghezza (mm)', tipo: 'numero', min: 150, step: 1, opzioni: [300, 400, 450, 500, 600], default: 600 },
      { campo: 'altezza_mm',      et: 'Altezza struttura = altezza dei fianchi (mm), senza i piedini', tipo: 'numero', min: 400, step: 1, opzioni: [2000, 2100, 2200, 2300, 2400], default: 2200 },
      { campo: 'profStruttura_mm', et: 'Profondità struttura finita, schiena compresa (mm)', tipo: 'numero', min: 150, step: 1, opzioni: [580, 560, 350], default: PROF_STRUTTURA_MISURA },
      { campo: 'spStruttura_mm',  et: 'Spessore struttura (mm)', tipo: 'numero', min: 8, step: 1, opzioni: [16, 18, 19], default: SP_STRUTTURA_MISURA },
      { campo: 'struttura',       et: 'Materiale della struttura (fianchi, top, fondo, schiena)',
        opzioni: [{ v: 'ante', l: 'Come le ante della colonna' }, { v: 'bianco', l: 'Come l\'interno degli armadi (bianco o antracite)' }], default: 'ante' },
      { campo: 'ripiani',         et: 'Ripiani interni (4 portaripiani ciascuno)', opzioni: [0, 1, 2, 3, 4, 5, 6], default: 4 },
      { campo: 'altezzaBassa_mm', et: 'Porta bassa (mm) — con i mobili bassi si allinea da sola', opzioni: ALTEZZE_BASE, default: ALTEZZE_BASE[0] },
      { campo: 'variante',        et: 'Parte alta', opzioni: VARIANTI_COLONNA.map((v) => ({ v: v.id, l: v.nome })), default: 'porta' },
      { campo: 'altezzaVano_mm',  et: 'Altezza vano aperto (mm) — solo con "Vano aperto"',
        tipo: 'numero', default: 600, min: 100, step: 10, opzioni: [400, 500, 600, 700] },
    ];
  }
  if (t.categoria === 'colonna') {
    return [
      { campo: 'altezza_mm',      et: 'Altezza totale (mm)', opzioni: ALTEZZE_COLONNA, default: ALTEZZE_COLONNA[0] },
      { campo: 'altezzaBassa_mm', et: 'Porta bassa (mm) — con i mobili bassi si allinea da sola',    opzioni: ALTEZZE_BASE,    default: ALTEZZE_BASE[0] },
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
  if (m.tipo === 'colonna-misura') {
    return `${m.larghezza_mm}×${m.altezza_mm} · p ${m.profStruttura_mm || PROF_STRUTTURA_MISURA} · ${nomeVarianteColonna(m.variante)}`;
  }
  if (cat === 'colonna') {
    return `${m.larghezza_mm}×${m.altezza_mm} · ${nomeVarianteColonna(m.variante)}`;
  }
  if (cat === 'frigo') return `${m.larghezza_mm}×${m.altezza_mm} · p ${m.profondita_mm || 660} · ${nomeColoreFrigo(m.colore)}`;
  if (cat === 'altillo') {
    const na = anteDiMobile(m);
    return `${m.larghezza_mm}×${m.altezza_mm} · p ${m.profondita_mm || 600} · ${na === 1 ? `1 anta ${m.antaLato === 'sx' ? 'sx' : 'dx'}` : '2 ante'}`;
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
  if (m.tipo === 'base-angolo') {
    const w = m.larghezza_mm || 880;
    return { w, d: m.latoB_mm || w };
  }
  if (cat === 'altillo') return { w: m.larghezza_mm || 600, d: m.profondita_mm || 600 };
  // colonna su misura: in pianta struttura + anta (18) + fuga (2) → 580 → 600 come le colonne
  if (m.tipo === 'colonna-misura') return { w: m.larghezza_mm || 600, d: (m.profStruttura_mm || PROF_STRUTTURA_MISURA) + 20 };
  if (cat === 'frigo') return { w: m.larghezza_mm || 600, d: m.profondita_mm || 660 };
  if (typeof m.tipo === 'string' && m.tipo.startsWith('ogg:')) return { w: m.larghezza_mm || 300, d: m.profondita_mm || profonditaTipo(m.tipo) };
  return { w: m.larghezza_mm, d: profonditaTipo(m.tipo) };
}

/**
 * Il FRIGO che sta sotto il mobile sopra frigo (in pianta si sovrappongono),
 * oppure null.
 */
export function frigoSottoAltillo(progetto, m) {
  const box = (o) => { const d = dimMobile(o), rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
    const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2; return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy }; };
  const A = box(m);
  let best = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id || categoriaTipo(o.tipo) !== 'frigo') continue;
    const B = box(o);
    if (Math.max(B.x0 - A.x1, A.x0 - B.x1) < -20 && Math.max(B.y0 - A.y1, A.y0 - B.y1) < -20
      && (!best || (o.altezza_mm || 1850) > (best.altezza_mm || 1850))) best = o;
  }
  return best;
}

/** Rettangolo in pianta (assi del mondo, rotazioni a 90°). */
function boxPiantaR(o) {
  const d = dimMobile(o), rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
  const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2;
  return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy };
}
/** Costadi ALTI (a terra, profondi) attaccati ai fianchi del mobile sopra frigo. */
export function costadiDelFrigo(progetto, altillo) {
  const A = boxPiantaR(altillo);
  return (progetto.mobiliLiberi || []).filter((o) => {
    if (categoriaTipo(o.tipo) !== 'costado' || (o.profondita_mm || 620) < 500 || (o.altezza_mm || 0) < 1500) return false;
    const B = boxPiantaR(o);
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    return (gx <= 60 && gy < -100) || (gy <= 60 && gx < -100);       // accanto, sulla stessa linea
  });
}
/** Cima (mm da terra) del mobile sopra frigo con la distanza scelta a mano, o null. */
export function cimaMobileSopraFrigo(progetto, a) {
  if (!a || a.distanzaFrigo_mm == null) return null;
  const fr = frigoSottoAltillo(progetto, a);
  return fr ? (fr.altezza_mm || 1850) + Math.max(0, a.distanzaFrigo_mm) + (a.altezza_mm || 350) : null;
}
/**
 * FRIGO + COSTADI + MOBILE SOPRA: tutto alla stessa altezza.
 * Con la distanza dal frigo scelta a mano, i costadi attaccati al mobile sopra
 * frigo diventano alti fino alla sua cima (la misura vera, anche nella lista
 * dei pezzi: es. 2270). Se cambi a mano l'altezza di uno di questi costadi
 * (`cambiato`), si sposta il mobile (la distanza dal frigo) e gli altri costadi.
 */
export function sincronizzaFrigo(progetto, cambiato = null) {
  const mob = progetto.mobiliLiberi || [];
  if (cambiato && categoriaTipo(cambiato.tipo) === 'costado' && cambiato.seguiFrigo != null) {
    const a = mob.find((x) => x.id === cambiato.seguiFrigo);
    const fr = a && frigoSottoAltillo(progetto, a);
    if (a && fr) a.distanzaFrigo_mm = Math.max(0, (cambiato.altezza_mm || 0) - (fr.altezza_mm || 1850) - (a.altezza_mm || 350));
  }
  const legati = new Set();
  for (const a of mob) {
    if (categoriaTipo(a.tipo) !== 'altillo') continue;
    const T = cimaMobileSopraFrigo(progetto, a);
    if (T == null) continue;
    for (const c of costadiDelFrigo(progetto, a)) { c.altezza_mm = Math.round(T); c.seguiFrigo = a.id; legati.add(c.id); }
  }
  for (const c of mob) if (c.seguiFrigo != null && !legati.has(c.id)) delete c.seguiFrigo;   // staccato: tiene la sua misura
}

/**
 * OGGETTO DEL CATALOGO (microonde, macchina del caffè…) lasciato sopra una
 * colonna con VANO APERTO: va dentro il vano, appoggiato sul ripiano (lo fa il
 * 3D), centrato in larghezza, quasi a filo davanti e girato come la colonna.
 * Ritorna la colonna se l'ha messo nel vano, se no null.
 */
export function mettiNelVano(progetto, m) {
  if (!m || typeof m.tipo !== 'string' || !m.tipo.startsWith('ogg:')) return null;
  const dm = dimMobile(m);
  for (const c of (progetto.mobiliLiberi || [])) {
    if (categoriaTipo(c.tipo) !== 'colonna' || c.variante !== 'vano') continue;
    const dc = dimMobile(c), r = ((c.rot || 0) * Math.PI) / 180;
    const fx = -Math.sin(r), fy = -Math.cos(r);               // verso il fronte della colonna
    const dx = m.x - c.x, dy = m.y - c.y;
    const lungo = dx * fx + dy * fy, largo = -dx * fy + dy * fx;
    if (Math.abs(largo) > dc.w / 2 || Math.abs(lungo) > dc.d / 2) continue;
    // davanti: 2 cm dentro il filo delle ante; dietro: non oltre la schiena (18 mm)
    const davanti = dc.d / 2 - 20 - dm.d / 2, dietro = -dc.d / 2 + 18 + dm.d / 2;
    const t = davanti >= dietro ? davanti : 0;
    m.x = Math.round(c.x + fx * t); m.y = Math.round(c.y + fy * t);
    m.rot = c.rot || 0;
    return c;
  }
  return null;
}

/**
 * Livello di un singolo mobile per il blocco a schermate (basso/alto):
 * i pensili sono "alti"; un costado dipende dalla sua profondità
 * (60 = basso/colonna, 35 = alto/pensile); gli altri sono "bassi".
 */
export function livelloDiMobile(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'pensile' || cat === 'altillo') return 'alto';
  if (cat === 'costado') return (m.profondita_mm || 620) >= 500 ? 'basso' : 'alto';
  return 'basso';
}

export function infoTipo(tipoId) {
  // OGGETTI del catalogo (friggitrice, microonde… creati dalle foto): "ogg:<id>"
  if (typeof tipoId === 'string' && tipoId.startsWith('ogg:')) {
    const def = typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === tipoId.slice(4));
    return { id: tipoId, nome: def ? def.nome : 'Oggetto', categoria: 'oggetto',
      larghezze: [def && def.misure ? def.misure.w : 300], altezze: [def && def.misure ? def.misure.h : 300], profondita: def && def.misure ? def.misure.d : 300 };
  }
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
  // Mobile sopra frigo: sta in alto (sopra il frigo, che non tocca), accanto ai costadi alti
  if (cat === 'altillo') return [2300, 4000];
  const h = m.altezza_mm || (cat === 'colonna' ? 2200 : 700);
  return [0, h];
}
/**
 * La COLONNA prende il posto dei pensili / del ponte: mentre la metti non la
 * respingono (i pezzi alti che restano dentro la colonna si tolgono da soli).
 */
function nonUrta(m, o) {
  return categoriaTipo(m.tipo) === 'colonna' && livelloDiMobile(o) === 'alto';
}
/** Toglie pensili e pezzi del ponte rimasti DENTRO una colonna. Ritorna quanti. */
export function togliAltiDentroColonne(progetto) {
  const mob = progetto.mobiliLiberi || [];
  const col = mob.filter((o) => categoriaTipo(o.tipo) === 'colonna');
  if (!col.length) return 0;
  const via = new Set();
  for (const a of mob) {
    const c = categoriaTipo(a.tipo);
    if (c !== 'pensile' && a.tipo !== 'ponte') continue;
    const A = aabb(a, a.x, a.y);
    for (const k of col) {
      const B = aabb(k, k.x, k.y);
      if ((A.hx + B.hx) - Math.abs(a.x - k.x) > 50 && (A.hy + B.hy) - Math.abs(a.y - k.y) > 50) { via.add(a.id); break; }
    }
  }
  if (via.size) progetto.mobiliLiberi = mob.filter((o) => !via.has(o.id));
  return via.size;
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
  // Isola (o mobile lontano dai muri, es. i pezzi della penisola): niente
  // "lungo il muro", uso l'asse di minore compenetrazione.
  const u = modoIsola(progetto, m, x, y) ? null : muroPiuVicino(progetto, x, y);
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (categoriaTipo(o.tipo) === 'oggetto') continue;   // l'arredo non respinge i mobili
    if (nonUrta(m, o)) continue;                          // la colonna prende il posto dei pensili
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
/** Muro più vicino (dal lato interno) al punto (x,y): {dist, nx, ny} o null. */
function muroVicino(progetto, x, y) {
  const full = progetto.piano.pareti || [];
  if (full.length === 0) return null;
  const vertici = calcolaVertici(full);
  let best = null;
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
    if (!best || dist < best.dist) best = { dist, nx, ny };
  }
  return best;
}

export function orientaVersoMuro(progetto, m, x, y) {
  if (m.isola) return null;                        // isola: orientamento manuale
  if (m.rotManuale) return null;                   // girato a mano (es. penisola): resta com'è
  const w = muroVicino(progetto, x, y);
  // Troppo lontano da un muro: si orienta solo se lo SCHIENALE può stare al
  // muro (centro entro mezza profondità + 40 cm). Più in là è un pezzo di
  // isola/penisola e tiene la sua rotazione.
  if (!w || w.dist > Math.max(600, dimMobile(m).d / 2 + 400)) return null;
  const { nx, ny } = w;
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
 * Il mobile in (x,y) si comporta da ISOLA? Sì se è marcato isola o se è
 * lontano dai muri (i pezzi di una penisola dopo il primo, un'isola al
 * centro): allora si accosta e si allinea agli altri mobili e non "scorre
 * lungo il muro". Un pezzo girato a mano ma appoggiato a un muro (il primo
 * pezzo della penisola, col fianco al muro) resta "a muro".
 */
export function modoIsola(progetto, m, x, y) {
  if (m.isola) return true;
  const auto = orientaVersoMuro(progetto, { ...m, isola: false, rotManuale: false }, x, y);
  if (auto === null) return true;
  // girato di traverso rispetto al muro (pezzo di penisola): "a muro" solo se
  // lo tocca col fianco; staccato dal muro si accosta come un'isola, lungo la
  // fila della penisola
  const r = ((m.rot || 0) % 360 + 360) % 360;
  if (Math.abs(r - auto) % 180 !== 90) return false;
  const w = muroVicino(progetto, x, y);
  return !!w && w.dist - dimMobile(m).w / 2 > 150;
}

const FILA_ROTAZIONE = ['base', 'colonna', 'lavastoviglie', 'lavatrice', 'pensile', 'frigo', 'altillo'];
/**
 * Rotazione automatica mentre si trascina un mobile (o quando nasce):
 *  · vicino a un muro → ante verso la stanza (orientaVersoMuro);
 *  · lontano dai muri e accanto a un pezzo di penisola/isola → la STESSA
 *    rotazione di quel pezzo, così la penisola si allunga mettendo i mobili
 *    uno accanto all'altro senza doverli girare tutti a mano.
 * null = tieni la rotazione attuale (anche se l'utente l'ha girato a mano).
 */
export function rotazioneAutomatica(progetto, m, x, y) {
  if (m.isola || m.rotManuale) return null;
  const pen = rotazionePenisola(progetto, m, x, y);
  if (pen !== null) return pen;
  return orientaVersoMuro(progetto, m, x, y);
}

/**
 * Rotazione del pezzo di penisola/isola in fila col quale il mobile in (x,y)
 * si sta mettendo (accanto, sulla stessa linea), o null. Vale anche vicino al
 * muro (penisola con basi strette): la fila della penisola va PERPENDICOLARE
 * al muro a cui è attaccata, mentre le file a muro gli corrono parallele.
 */
function rotazionePenisola(progetto, m, x, y) {
  if (!FILA_ROTAZIONE.includes(categoriaTipo(m.tipo)) || /angolo/.test(m.tipo)) return null;
  const rv = rangeVerticale(m), dm = dimMobile(m);
  let best = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id || /angolo/.test(o.tipo)) continue;
    if (!FILA_ROTAZIONE.includes(categoriaTipo(o.tipo))) continue;
    if (!rangeSovrappone(rv, rangeVerticale(o))) continue;
    const rotO = ((o.rot || 0) % 360 + 360) % 360;
    // solo pezzi di isola/penisola: lontani dai muri, o messi di traverso
    // rispetto al muro vicino (la fila della penisola). Le file a muro gli
    // corrono parallele e restano fuori.
    if (!o.isola) {
      const autoO = orientaVersoMuro(progetto, { ...o, isola: false, rotManuale: false }, o.x, o.y);
      if (autoO !== null && Math.abs(rotO - autoO) % 180 !== 90) continue;
    }
    const ro = (rotO * Math.PI) / 180, ax = Math.cos(ro), ay = Math.sin(ro);
    const dO = dimMobile(o);
    const du = Math.abs((x - o.x) * ax + (y - o.y) * ay);       // lungo la fila di o
    const dv = Math.abs((x - o.x) * -ay + (y - o.y) * ax);      // fuori dalla fila
    const gap = du - (dm.w + dO.w) / 2;
    if (dv > dO.d / 2 || gap > 250) continue;                   // non è in fila accanto a o
    if (!best || gap < best.gap) best = { gap, rot: rotO };
  }
  return best ? best.rot : null;
}

/**
 * Progetti salvati prima del "girato a mano": la rotazione scelta non veniva
 * ricordata. I mobili messi a mano LONTANO dai muri (isola, pezzo di penisola
 * girato al centro) tengono la rotazione che hanno: portati al muro non si
 * rigirano più da soli. Una volta sola per progetto.
 */
export function migraRotazioni(progetto) {
  if (!progetto || (progetto.versioneRot || 0) >= 1) return;
  for (const m of (progetto.mobiliLiberi || [])) {
    if (!m.posManuale || m.isola || m.rotManuale) continue;
    if (!FILA_ROTAZIONE.includes(categoriaTipo(m.tipo)) || /angolo/.test(m.tipo)) continue;
    if (orientaVersoMuro(progetto, m, m.x, m.y) === null) m.rotManuale = true;
  }
  progetto.versioneRot = 1;
}

/**
 * Lo SCHIENALE del mobile è contro un muro? (centro vicino al muro, dentro la
 * sua lunghezza, e fronte che guarda la stanza). Un pezzo di penisola col
 * fianco al muro NON è a muro: le ante non guardano la stanza da quel muro.
 */
export function retroAMuro(progetto, b) {
  if (b.isola) return false;
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const rad = ((b.rot || 0) * Math.PI) / 180, Fx = -Math.sin(rad), Fy = -Math.cos(rad);
  const d = dimMobile(b).d;
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
    if (dist < -50 || dist > d / 2 + 220) continue;
    if (Fx * nx + Fy * ny > 0.7) return true;          // ante verso la stanza
  }
  return false;
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
    if (String(m.tipo).startsWith('pensile-angolo') || m.tipo === 'base-angolo') continue;
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
  // Mobile lontano dai muri (isola, anche senza "Isola (libero)" attivato): si comporta da isola
  const inIsola = modoIsola(progetto, m, x, y);
  const u = inIsola ? asseMobile(m) : (muroPiuVicino(progetto, x, y) || asseMobile(m));
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
  const puoAllineare = inIsola && catM !== 'costado' && catM !== 'regletta' && catM !== 'pannello';
  // fronte (ante) in pianta: (−sin r, −cos r); i FRONTI si allineano (anche con profondità diverse)
  const rF = ((m.rot || 0) * Math.PI) / 180, Fx = -Math.sin(rF), Fy = -Math.cos(rF);
  const eFm = A.hx * Math.abs(Fx) + A.hy * Math.abs(Fy);
  const [sx, sy] = asseMobile(m);
  const pvx = -sy, pvy = sx;                   // perpendicolare (profondità)
  const eUmS = A.hx * Math.abs(sx) + A.hy * Math.abs(sy);
  let best = null;      // accostamento lungo la fila (toccarsi senza spazio)
  let align = null;     // allineamento perpendicolare (fronti/schiene in riga)
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (categoriaTipo(o.tipo) === 'oggetto') continue;   // niente aggancio magnetico all'arredo
    if (nonUrta(m, o)) continue;
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
    // COSTADO dell'isola accanto a un modulo: il suo davanti a filo con il davanti delle ANTE
    // (se è più profondo, la parte in più va dietro, verso gli sgabelli)
    if (inIsola && catM === 'costado' && !['costado', 'regletta', 'pannello', 'oggetto'].includes(catO)) {
      const ro = ((o.rot || 0) * Math.PI) / 180, Fox = -Math.sin(ro), Foy = -Math.cos(ro), aox = Math.cos(ro), aoy = Math.sin(ro);
      const du = (x - o.x) * aox + (y - o.y) * aoy;
      const eUmO = A.hx * Math.abs(aox) + A.hy * Math.abs(aoy), eUoO = B.hx * Math.abs(aox) + B.hy * Math.abs(aoy);
      const eFmO = A.hx * Math.abs(Fox) + A.hy * Math.abs(Foy), eFoO = B.hx * Math.abs(Fox) + B.hy * Math.abs(Foy);
      const dF = ((o.x - x) * Fox + (o.y - y) * Foy) + (eFoO - eFmO);
      if (Math.abs(du) <= eUmO + eUoO + soglia && Math.abs(dF) > 0.5 && Math.abs(dF) <= SNAP_ALLINEA) {
        if (!align || Math.abs(dF) < align.adv) align = { adv: Math.abs(dF), dx: Fox * dF, dy: Foy * dF };
      }
    }
    if (puoAllineare && catO !== 'costado' && catO !== 'regletta' && catO !== 'pannello') {
      const ao = asseMobile(o);
      const dotO = sx * ao[0] + sy * ao[1];
      const stessaOrient = Math.abs(dotO) > 0.9;
      if (dotO > 0.9) {
        // stesso verso: fronte su fronte
        const eUoS = B.hx * Math.abs(sx) + B.hy * Math.abs(sy);
        const duS = (x - o.x) * sx + (y - o.y) * sy;
        const eFo = B.hx * Math.abs(Fx) + B.hy * Math.abs(Fy);
        const dF = ((o.x - x) * Fx + (o.y - y) * Fy) + (eFo - eFm);   // quanto spostare m lungo il fronte
        if (Math.abs(duS) <= (eUmS + eUoS) + soglia && Math.abs(dF) > 0.5 && Math.abs(dF) <= SNAP_ALLINEA) {
          if (!align || Math.abs(dF) < align.adv) align = { adv: Math.abs(dF), dx: Fx * dF, dy: Fy * dF };
        }
      } else if (stessaOrient) {
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
export function posizionaVincolata(progetto, m, x, y, libera = false, info = null) {
  if (info) info.bloccato = false;
  // Oggetti d'arredo (sgabelli, decor): posizione TOTALMENTE libera, si mettono
  // a mano dove si vuole — niente vincolo ai muri, niente respinta, niente
  // aggancio magnetico ai mobili.
  if (categoriaTipo(m.tipo) === 'oggetto') return { x, y };
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
  // MAI SOVRAPPOSTI: se resta dentro a un altro mobile (es. trascinato sopra
  // un mobile in fondo contro il muro, che non può spingerlo oltre), provo le
  // posizioni ATTACCATE a quel mobile (prima/dopo lungo il muro, o sui 4 lati
  // per l'isola) e prendo la più vicina al dito; se non c'è posto resta dov'era.
  const urto = sovrapposto(progetto, m, x, y);
  if (urto) {
    const voluto = { x, y };
    const isolaM = modoIsola(progetto, m, x, y);
    const cand = [];
    for (const o of urto) {
      const A = aabb(m, 0, 0), B = aabb(o, o.x, o.y);
      const u = (libero || isolaM) ? null : muroPiuVicino(progetto, o.x, o.y);
      const passi = u ? [[u[0], u[1]], [-u[0], -u[1]]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [ux, uy] of passi) {
        const e = (A.hx + B.hx) * Math.abs(ux) + (A.hy + B.hy) * Math.abs(uy);
        let c = { x: o.x + ux * e, y: o.y + uy * e };
        if (!u) c = { x: ux ? c.x : voluto.x, y: uy ? c.y : voluto.y };
        if (!libero) c = vincolaAiMuri(progetto, m, c.x, c.y);
        if (!sovrapposto(progetto, m, c.x, c.y)) cand.push(c);
      }
    }
    cand.sort((a, b) => Math.hypot(a.x - voluto.x, a.y - voluto.y) - Math.hypot(b.x - voluto.x, b.y - voluto.y));
    if (!cand[0] && info) info.bloccato = true;       // non c'è posto: resta dov'era (chi chiama può avvisare)
    return cand[0] || { x: m.x, y: m.y };
  }
  return { x, y };
}

/**
 * Il mobile NON ENTRA dove l'hai lasciato? Lo porto contro il muro in (x, y) e
 * guardo se finisce dentro un altro mobile: ritorna di quanti mm si
 * sovrappone (cioè quanto spazio manca), oppure 0 se entra.
 */
export function spazioMancante(progetto, m, x, y) {
  const w = vincolaAiMuri(progetto, m, x, y);
  const urti = sovrapposto(progetto, m, w.x, w.y);
  if (!urti) return 0;
  const A = aabb(m, w.x, w.y);
  let manca = 0;
  for (const o of urti) {
    const B = aabb(o, o.x, o.y);
    const ox = (A.hx + B.hx) - Math.abs(w.x - o.x), oy = (A.hy + B.hy) - Math.abs(w.y - o.y);
    manca += Math.min(ox, oy);                       // da tutti e due i lati: quanto manca in tutto
  }
  return Math.round(manca);
}
/** Mobili (stessa fascia di altezza) dentro cui il mobile m finirebbe in (x,y). */
function sovrapposto(progetto, m, x, y) {
  const rv = rangeVerticale(m), A = aabb(m, x, y), out = [];
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id || categoriaTipo(o.tipo) === 'oggetto' || nonUrta(m, o)) continue;
    if (!rangeSovrappone(rv, rangeVerticale(o))) continue;
    const B = aabb(o, o.x, o.y);
    if ((A.hx + B.hx) - Math.abs(x - o.x) > 2 && (A.hy + B.hy) - Math.abs(y - o.y) > 2) out.push(o);
  }
  return out.length ? out : null;
}

export const LARGHEZZA_ANGOLO = 630;  // pensile d'angolo nelle cucine a L/U

/**
 * La base è appoggiata a un MURO? (serve per i pensili automatici: sopra le
 * isole/penisole NON vanno messi pensili, sennò restano appesi nel vuoto.)
 * Vero se il centro base è dentro la lunghezza di un muro e a breve distanza
 * dal lato interno. Un mobile marcato "isola" non è mai a muro.
 */
export function baseAMuro(progetto, b) {
  return retroAMuro(progetto, b);
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
/**
 * CUCINA A PONTE: crea il PONTE, un modulo sopra ogni base (stessa larghezza,
 * allineato) fra le colonne / i costadi alti ai lati, alto `altezza` (24, 36,
 * 48, 60 cm…), profondo come le basi; la cima va a filo con le colonne.
 * Sostituisce il ponte che c'era. Ritorna quanti moduli ha creato (0 = non ci
 * sono basi fra due mobili alti sulla stessa fila).
 */
export function generaPonteAuto(progetto, altezza, altezzaPensili = 0) {
  const mob = (progetto.mobiliLiberi || []);
  progetto.mobiliLiberi = mob.filter((m) => m.tipo !== 'ponte' && !m.sottoPonte);
  let nextId = Math.max(0, ...progetto.mobiliLiberi.map((m) => m.id)) + 1;
  const alto = (o) => { const c = categoriaTipo(o.tipo);
    return c === 'colonna' || c === 'frigo' || (c === 'costado' && (o.profondita_mm || 620) >= 500 && (o.altezza_mm || 0) >= 1500)
      || (c === 'pannello' && (o.altezza_mm || 0) >= 1500); };
  const alti = progetto.mobiliLiberi.filter(alto);
  const nuovi = [];
  for (const b of progetto.mobiliLiberi) {
    const c = categoriaTipo(b.tipo);
    if (!['base', 'lavastoviglie', 'lavatrice'].includes(c) || /angolo/.test(b.tipo)) continue;
    const rad = (b.rot || 0) * Math.PI / 180, ax = Math.cos(rad), ay = Math.sin(rad);
    const fx = -Math.sin(rad), fy = -Math.cos(rad);
    // un mobile alto a sinistra e uno a destra, sulla stessa fila
    let sx = false, dx = false;
    for (const o of alti) {
      const lungo = (o.x - b.x) * ax + (o.y - b.y) * ay, fuori = (o.x - b.x) * fx + (o.y - b.y) * fy;
      if (Math.abs(fuori) > 400) continue;
      if (lungo < 0) sx = true; else if (lungo > 0) dx = true;
    }
    if (!sx || !dx) continue;
    const w = Math.round(dimMobile(b).w);
    const p = { id: nextId++, tipo: 'ponte', larghezza_mm: w, altezza_mm: altezza, profondita_mm: PROFONDITA_BASE,
      x: b.x, y: b.y, rot: b.rot || 0, sopraBase: b.id };
    if (b.antaLato != null) p.antaLato = b.antaLato;
    if (b.ante != null) p.ante = b.ante;
    nuovi.push(p);
    // PENSILI SOTTO IL PONTE (profondi 35, larghi come la base, contro il muro)
    if (altezzaPensili > 0) {
      // via il pensile che c'era sopra questa base: lo sostituisce quello sotto il ponte
      progetto.mobiliLiberi = progetto.mobiliLiberi.filter((o) => !(categoriaTipo(o.tipo) === 'pensile' && o.sopraBase === b.id));
      const OFF = (PROFONDITA_BASE - PROFONDITA_PENSILE) / 2;
      const pens = { id: nextId++, tipo: 'pensile', larghezza_mm: w, altezza_mm: altezzaPensili,
        x: Math.round(b.x - fx * OFF), y: Math.round(b.y - fy * OFF), rot: b.rot || 0,
        fuoriMisura: !LARGHEZZE_BASE.includes(w), sopraBase: b.id, sottoPonte: true };
      if (b.antaLato != null) pens.antaLato = b.antaLato;
      if (b.ante != null) pens.ante = b.ante;
      nuovi.push(pens);
    }
  }
  progetto.mobiliLiberi.push(...nuovi);
  return nuovi.filter((x) => x.tipo === 'ponte').length;
}
/** Spessore del PANNELLO SOTTO IL PONTE (0 = niente pannello). */
export function spessorePannelloPonte(progetto) {
  const p = progetto.pannelloPonte || {};
  if (p.attivo === false) return 0;
  if (Number(p.spessore) > 0) return Math.max(5, Math.round(Number(p.spessore)));   // scelto a mano
  return spessoreAntePonte(progetto);
}
/**
 * Spessore delle ANTE del ponte (dal catalogo: il materiale scelto per il
 * ponte / le colonne; es. 19 se il pannello è da 19). Se il catalogo non lo
 * dice, 18.
 */
export function spessoreAntePonte(progetto) {
  const col = progetto.coloriFronti || {};
  const ponte = (progetto.mobiliLiberi || []).find((m) => m.tipo === 'ponte' && m.coloreFronte);
  const id = (ponte && ponte.coloreFronte) || col.colonna || col.pensile || null;
  const def = id && typeof window !== 'undefined' ? (window.NG_MATERIALI || []).find((x) => x.id === id) : null;
  const sp = def ? Number((def.info && def.info.spessore) || def.spessore) : NaN;
  return sp >= 10 && sp <= 30 ? Math.round(sp) : 18;
}
export const PANNELLO_PONTE_MAX = 2750;   // lunghezza massima del pannello (mm)
/**
 * PANNELLO SOTTO IL PONTE: un pannello orizzontale che copre il fondo dei
 * moduli del ponte (profondi 60), sopra i pensili piccoli, per tutta la fila.
 * Una fila = moduli del ponte attaccati, stessa rotazione e stessa linea.
 * Ritorna [{ x, y, rot, w, d, ids }] (centro in pianta, w lungo la fila).
 */
export function pannelliSottoPonte(progetto) {
  if (!spessorePannelloPonte(progetto)) return [];
  const out = [];
  const alti = (progetto.mobiliLiberi || []).filter((o) => { const c = categoriaTipo(o.tipo);
    return c === 'colonna' || (c === 'costado' && (o.altezza_mm || 0) >= 1500) || (c === 'pannello' && (o.altezza_mm || 0) >= 1500); });
  for (const f of fileDelPonte(progetto)) {
    // PROFONDITÀ: come la colonna / il costado ai lati della fila (il più profondo); se non c'è, come il ponte
    let dRif = 0, riferimento = null;
    for (const o of alti) {
      const lungo = o.x * f.ax + o.y * f.ay, fuori = o.x * f.fx + o.y * f.fy;
      if (Math.abs(fuori - f.perp) > 400) continue;
      const d = dimMobile(o), mezzo = (categoriaTipo(o.tipo) === 'costado' ? d.w : d.w) / 2;
      const tocca = Math.abs(lungo - mezzo - f.a1) <= 60 || Math.abs(lungo + mezzo - f.a0) <= 60;
      if (!tocca) continue;
      const prof = categoriaTipo(o.tipo) === 'costado' ? (o.profondita_mm || 620) : categoriaTipo(o.tipo) === 'pannello' ? f.d : d.d;
      if (prof > dRif) { dRif = prof; riferimento = categoriaTipo(o.tipo); }
    }
    const d = dRif || f.d;
    // il pannello parte dalla SCHIENA del ponte (contro il muro) e va avanti per la sua profondità
    const perp = f.perp - f.d / 2 + d / 2;
    // PEZZI: al massimo 2750; si taglia vicino alla metà, fra due moduli o a metà di un modulo (fra le ante)
    const L = f.a1 - f.a0, n = Math.max(1, Math.ceil(L / PANNELLO_PONTE_MAX));
    const tagliPossibili = [];
    for (const m of f.moduli) { tagliPossibili.push(m.a1); tagliPossibili.push((m.a0 + m.a1) / 2); }
    const tagli = [];
    let da = f.a0;
    for (let k = 1; k < n; k++) {
      const ideale = f.a0 + (L * k) / n;
      const cand = tagliPossibili.filter((t) => t > da + 100 && t < f.a1 - 100 && t - da <= PANNELLO_PONTE_MAX)
        .sort((p, q) => Math.abs(p - ideale) - Math.abs(q - ideale));
      const t = cand.length ? cand[0] : Math.min(da + PANNELLO_PONTE_MAX, ideale);
      tagli.push(t); da = t;
    }
    const bordi = [f.a0, ...tagli, f.a1];
    for (let i = 0; i < bordi.length - 1; i++) {
      const c = (bordi[i] + bordi[i + 1]) / 2;
      out.push({ x: c * f.ax + perp * f.fx, y: c * f.ay + perp * f.fy, rot: f.rot, w: Math.round(bordi[i + 1] - bordi[i]), d: Math.round(d),
        ids: f.ids, pezzo: i + 1, pezzi: bordi.length - 1, riferimento, lunghezzaFila: Math.round(L) });
    }
  }
  return out;
}
/** File del ponte (moduli del ponte attaccati, stessa rotazione e linea). */
export function fileDelPonte(progetto) {
  const ponti = (progetto.mobiliLiberi || []).filter((m) => m.tipo === 'ponte');
  const gruppi = [];
  for (const m of ponti) {
    const rot = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360, r = rot * Math.PI / 180;
    const ax = Math.round(Math.cos(r)), ay = Math.round(Math.sin(r)), fx = -Math.round(Math.sin(r)), fy = -Math.round(Math.cos(r));
    const d = dimMobile(m);
    const lungo = m.x * ax + m.y * ay, perp = m.x * fx + m.y * fy;
    let g = gruppi.find((G) => G.rot === rot && Math.abs(G.perp - perp) < 40);
    if (!g) { g = { rot, ax, ay, fx, fy, perp, pezzi: [] }; gruppi.push(g); }
    g.pezzi.push({ id: m.id, a0: lungo - d.w / 2, a1: lungo + d.w / 2, d: d.d });
  }
  const out = [];
  for (const g of gruppi) {
    g.pezzi.sort((p, q) => p.a0 - q.a0);
    let fila = null;
    const chiudi = () => {
      if (!fila) return;
      const c = (fila.a0 + fila.a1) / 2;
      out.push({ x: c * g.ax + g.perp * g.fx, y: c * g.ay + g.perp * g.fy, rot: g.rot, w: Math.round(fila.a1 - fila.a0), d: fila.d, ids: fila.ids,
        ax: g.ax, ay: g.ay, fx: g.fx, fy: g.fy, perp: g.perp, a0: fila.a0, a1: fila.a1, moduli: fila.moduli });
    };
    for (const p of g.pezzi) {
      if (fila && p.a0 - fila.a1 <= 5) { fila.a1 = Math.max(fila.a1, p.a1); fila.d = Math.max(fila.d, p.d); fila.ids.push(p.id); fila.moduli.push(p); }
      else { chiudi(); fila = { a0: p.a0, a1: p.a1, d: p.d, ids: [p.id], moduli: [p] }; }
    }
    chiudi();
  }
  return out;
}
/** Moduli del PONTE sopra un mobile (in pianta si sovrappongono). */
/**
 * PORTE: le scelte (finger-pull, push, maniglia) valgono per gruppo: bassi, pensili, colonne.
 * Il PONTE e i PENSILI SOTTO IL PONTE hanno scelte PROPRIE ('ponte', 'pensiliPonte'):
 * finché non si sceglie niente, il ponte fa come le colonne e i pensili sotto come i pensili.
 */
export function gruppoPorte(progetto, m) {
  const cat = categoriaTipo(m.tipo);
  if (m.tipo === 'ponte') return { proprio: 'ponte', segue: 'colonna' };
  if (cat === 'pensile') return { proprio: pontiSopra(progetto, m).length ? 'pensiliPonte' : null, segue: 'pensile' };
  if (cat === 'colonna' || cat === 'altillo') return { proprio: null, segue: 'colonna' };
  if (cat === 'base') return { proprio: null, segue: 'base' };
  return { proprio: null, segue: null };
}
/** Scelte delle porte per un gruppo ('ponte' / 'pensiliPonte' con il gruppo che seguono). */
export function sceltePorteGruppo(progetto, proprio, segue) {
  const fp = progetto.fingerPull, fpO = fp && typeof fp === 'object' ? fp : {};
  const pu = progetto.push || {}, ma = progetto.maniglie || {};
  return {
    fp: proprio && fpO[proprio] != null ? !!fpO[proprio] : !!(segue && (fp === true || fpO[segue])),
    push: proprio && pu[proprio] != null ? !!pu[proprio] : !!(segue && pu[segue]),
    maniglia: (proprio && ma[proprio]) || (segue && ma[segue]) || null,
    proprie: !!proprio && (fpO[proprio] != null || pu[proprio] != null || ma[proprio] != null),
  };
}
/** Scelte delle porte di UN mobile: { fp, push, maniglia (id o null) }. */
export function sceltePorte(progetto, m) {
  const { proprio, segue } = gruppoPorte(progetto, m);
  return sceltePorteGruppo(progetto, proprio, segue);
}
export function pontiSopra(progetto, m) {
  const A = boxPiantaR(m);
  return (progetto.mobiliLiberi || []).filter((o) => {
    if (o.tipo !== 'ponte' || o.id === m.id) return false;
    const B = boxPiantaR(o);
    return Math.max(B.x0 - A.x1, A.x0 - B.x1) < -20 && Math.max(B.y0 - A.y1, A.y0 - B.y1) < -20;
  });
}
/**
 * PENSILE SOTTO IL PONTE: cambia la sua altezza e quella dei pensili sotto
 * la stessa fila di ponte; il PONTE sopra si adatta (diventa più basso o più
 * alto della stessa misura), così cima e spazio sul piano restano uguali.
 * Ritorna { ok, errore }.
 */
export function cambiaPensileSottoPonte(progetto, pensile, nuovaH) {
  const sopra = pontiSopra(progetto, pensile);
  if (!sopra.length) return { ok: false, errore: 'Questo pensile non è sotto il ponte.' };
  const fila = fileDelPonte(progetto).find((f) => f.ids.includes(sopra[0].id));
  const ponti = (fila ? fila.ids : [sopra[0].id]).map((id) => trovaMobileLibero(progetto, id)).filter(Boolean);
  const coppie = [];
  for (const pt of ponti) {
    for (const pe of (progetto.mobiliLiberi || [])) {
      if (categoriaTipo(pe.tipo) !== 'pensile') continue;
      if (pontiSopra(progetto, pe).some((x) => x.id === pt.id)) coppie.push([pt, pe]);
    }
  }
  if (!coppie.length) coppie.push([sopra[0], pensile]);
  for (const [pt, pe] of coppie) {
    const hp = (pt.altezza_mm || 360) - (nuovaH - (pe.altezza_mm || 700));
    if (hp < 100) return { ok: false, errore: `Il ponte sopra diventerebbe ${Math.round(hp / 10)} cm: troppo basso. Scegli un pensile più basso.` };
  }
  const fatti = new Set();
  for (const [pt, pe] of coppie) {
    if (!fatti.has(pt.id)) { pt.altezza_mm = Math.round((pt.altezza_mm || 360) - (nuovaH - (pe.altezza_mm || 700))); fatti.add(pt.id); }
  }
  for (const [, pe] of coppie) pe.altezza_mm = Math.round(nuovaH);
  return { ok: true };
}
export function ruotaMobileLibero(progetto, id) {
  const m = trovaMobileLibero(progetto, id);
  if (!m) return;
  m.rot = ((m.rot || 0) + 90) % 360;
  // Girato a mano: resta così (penisola, mobile girato apposta). Se il giro
  // lo riporta all'orientamento automatico (ante verso la stanza dal muro
  // vicino), torna automatico.
  const auto = orientaVersoMuro(progetto, { ...m, rotManuale: false }, m.x, m.y);
  if (auto !== null && auto === m.rot) delete m.rotManuale;
  else m.rotManuale = true;
}

/**
 * Numero di ante di un modulo (base con ante / pensile): 1 o 2.
 * Se l'utente non ha scelto, default automatico per larghezza (≥900 → 2).
 */
export function anteDiMobile(m) {
  if (m.ante === 1 || m.ante === 2) return m.ante;
  // DI DEFAULT: da 60 cm in su DUE ANTE (bassi e alti), sotto i 60 una.
  // Fra 60 e 90 cm, se è già stato scelto il lato dell'anta singola (progetti fatti
  // quando lì l'anta era una sola), resta UNA: non cambio quello che è stato deciso.
  const w = m.larghezza_mm || 600;
  if (w >= 900) return 2;
  if (w >= 600) return m.antaLato ? 1 : 2;
  return 1;
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
      const angolare = /^(pensile|base)-angolo/.test(String(a.tipo)) || /^(pensile|base)-angolo/.test(String(b.tipo));
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
      // perp = mobile dell'ALTRO muro (girato di 90°): nell'angolo
      const perp = Math.abs(c * ux + s * uy) < 0.5;
      const cost = categoriaTipo(m.tipo) === 'costado';
      if (hi > lo) intervalli.push([lo, hi, perp, cost]);
    }
    intervalli.sort((a2, b2) => a2[0] - b2[0]);
    const blocchi = [];
    for (const iv of intervalli) {
      const ult = blocchi[blocchi.length - 1];
      if (ult && iv[0] <= ult.hi) { if (iv[1] > ult.hi) { ult.hi = iv[1]; ult.perpHi = iv[2]; ult.costHi = iv[3]; } }
      else blocchi.push({ lo: iv[0], hi: iv[1], perpLo: iv[2], perpHi: iv[2], costLo: iv[3], costHi: iv[3] });
    }
    let coperto = blocchi.reduce((t, k) => t + (k.hi - k.lo), 0);
    // COSTADO che chiude la fila: lo spazio fra il costado e la fine del muro
    // (es. l'angolo dietro la fila dell'altro muro) non si può riempire: non è libero.
    let morto = 0;
    if (blocchi.length) {
      const primo = blocchi[0], ultimo = blocchi[blocchi.length - 1];
      if (primo.costLo && primo.lo > 0) morto += primo.lo;
      if (ultimo.costHi && ultimo.hi < L) morto += L - ultimo.hi;
    }
    coperto += morto;
    // REGLETTA D'ANGOLO: lo spazietto (3 cm) fra il mobile dell'angolo e la fila
    // di questo muro NON è libero: ci va la regletta. Non lo conto come spazio.
    let regletta = 0;
    if (progetto.autoRegletta !== false) {
      const rb = ((progetto.reglettaAngolo && progetto.reglettaAngolo.base) || 30) + 5;
      for (let k = 0; k < blocchi.length - 1; k++) {
        const g = blocchi[k + 1].lo - blocchi[k].hi;
        if (g > 0 && g <= rb && (blocchi[k].perpHi || blocchi[k + 1].perpLo)) regletta += g;
      }
    }
    coperto += regletta;
    out.push({
      id: p.id, idx: i, lunghezza: Math.round(L),
      coperto: Math.round(coperto), libero: Math.max(0, Math.round(L - coperto)), regletta: Math.round(regletta), morto: Math.round(morto),
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
 * Il FRONTE (ante) del mobile m guarda il mobile o, a meno di `tol` mm?
 * (o sta nella striscia davanti alle ante di m, sovrapposto per larghezza).
 */
function fronteVerso(m, A, B, tol = 155) {
  const rad = ((Math.round((m.rot || 0) / 90) * 90) * Math.PI) / 180;
  const Fx = Math.round(-Math.sin(rad)), Fy = Math.round(-Math.cos(rad));
  if (Fy !== 0) {                                       // ante verso ±Y
    if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) <= 5) return false;
    const f = Fy > 0 ? A.y1 : A.y0;
    const s0 = Fy > 0 ? f - A.d / 2 : f - tol, s1 = Fy > 0 ? f + tol : f + A.d / 2;
    return Math.min(s1, B.y1) - Math.max(s0, B.y0) > 0;
  }
  if (Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) <= 5) return false;
  const f = Fx > 0 ? A.x1 : A.x0;
  const s0 = Fx > 0 ? f - A.d / 2 : f - tol, s1 = Fx > 0 ? f + tol : f + A.d / 2;
  return Math.min(s1, B.x1) - Math.max(s0, B.x0) > 0;
}

/**
 * Info per il mobile "ad angolo cieco": trova la base PERPENDICOLARE che lo
 * copre all'angolo e calcola quanta parte del fronte è coperta e da che lato.
 * Ritorna null se il mobile non è segnato cieco o non trova il mobile che copre.
 * { coveredW, latoDx (true=copertura sul lato +), corner:{x,y} }.
 */
export function infoAngoloCieco(progetto, m) {
  if (!m || categoriaTipo(m.tipo) !== 'base') return null;
  if (m.tipo === 'base-angolo') return null;           // la base a L è già il modulo d'angolo
  if (m.angoloCieco === false) return null;            // forzato normale
  const A = aabbMondo(m);
  const TOL = 150;                                     // mm: due basi perpendicolari entro
                                                       // questa distanza formano un angolo a L
  let best = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (categoriaTipo(o.tipo) !== 'base' || o.tipo === 'base-angolo') continue;
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
    // Chi è il CIECO della coppia? Quello che ha le ANTE contro l'altro mobile.
    // Se nessuno dei due ha le ante verso l'altro (es. penisola col retro o il
    // fianco contro la fine della fila) non è un angolo. Se non si capisce
    // (sovrapposti) è il più largo (2 ante, una bloccata). Override manuale
    // con angoloCieco true/false.
    const fM = fronteVerso(m, A, B), fO = fronteVerso(o, B, A);
    if (!fM && !fO && m.angoloCieco !== true && o.angoloCieco !== true) continue;
    let mCieco;
    if (m.angoloCieco === true) mCieco = true;
    else if (o.angoloCieco === true) mCieco = false;
    else if (fM !== fO) mCieco = fM;
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
const FILA_TERRA = ['base', 'colonna', 'lavastoviglie', 'lavatrice', 'frigo'];
/** Pezzi che stanno nella fila a terra e si spostano con lei (anche costadi, reglette, pannelli). */
const FILA_PEZZI = [...FILA_TERRA, 'costado', 'regletta', 'pannello', 'altillo'];

/**
 * Sposta lungo il suo muro il mobile `primo` di `shift` mm in direzione `dir`
 * (+1/−1 sull'asse lungo del mobile). Se si allontana dall'angolo spinge con sé
 * la FILA attaccata (es. base + colonne sullo stesso muro), così niente finisce
 * dentro un altro mobile. Controlla muri e sovrapposizioni: se non c'è posto non
 * sposta niente e ritorna false.
 */
function spostaFila(progetto, primo, dir, shift, escludi = []) {
  if (Math.abs(shift) < 0.5) return true;
  const P = aabbMondo(primo), asseX = P.horiz;
  const pos = (B) => asseX ? [B.x0, B.x1] : [B.y0, B.y1];
  const catena = [primo];
  if (shift > 0) {
    // stessi allineamento e orientamento di `primo`, dalla parte verso cui si sposta
    const fila = (progetto.mobiliLiberi || []).filter((o) => {
      if (o.id === primo.id || escludi.includes(o.id) || !FILA_PEZZI.includes(categoriaTipo(o.tipo))) return false;
      const B = aabbMondo(o);
      const prof = asseX ? [Math.abs(B.y0 - P.y0), Math.abs(B.y1 - P.y1)] : [Math.abs(B.x0 - P.x0), Math.abs(B.x1 - P.x1)];
      if (Math.min(...prof) > 50) return false;
      const c = asseX ? o.x : o.y, c0 = asseX ? primo.x : primo.y;
      return (c - c0) * dir > 0;
    }).sort((a, b) => ((asseX ? a.x - b.x : a.y - b.y) * dir));
    let [p0, p1] = pos(P);
    let fronte = dir > 0 ? p1 + shift : p0 - shift;                    // dove arriva la catena spostata
    for (const o of fila) {
      const [q0, q1] = pos(aabbMondo(o));
      const tocca = dir > 0 ? q0 < fronte - 1 : q1 > fronte + 1;
      if (!tocca) break;
      catena.push(o);
      fronte = dir > 0 ? Math.max(fronte, q1 + shift) : Math.min(fronte, q0 - shift);
    }
  }
  const prima = catena.map((o) => ({ o, x: o.x, y: o.y }));
  for (const o of catena) { if (asseX) o.x = Math.round(o.x + dir * shift); else o.y = Math.round(o.y + dir * shift); }
  const ids = new Set([...catena.map((o) => o.id), ...escludi]);
  let ok = true;
  for (const o of catena) {
    const v = vincolaAiMuri(progetto, o, o.x, o.y);
    if (Math.abs(v.x - o.x) > 1 || Math.abs(v.y - o.y) > 1) { ok = false; break; }
    const urto = sovrapposto(progetto, o, o.x, o.y);
    if (urto && urto.some((u) => !ids.has(u.id) && FILA_PEZZI.includes(categoriaTipo(u.tipo)))) { ok = false; break; }
  }
  if (!ok) for (const r of prima) { r.o.x = r.x; r.o.y = r.y; }
  return ok;
}

/**
 * MOBILE D'ANGOLO TRASCINATO IN UN ANGOLO GIÀ OCCUPATO (es. muro sinistro già
 * pieno di colonne e basi, poi la base da 1000 nell'angolo): la base va
 * nell'angolo e la fila dell'altro muro scorre in avanti quanto serve per la
 * regletta (3 cm). Così l'ordine in cui si mettono i mobili non conta e
 * funziona uguale in tutti gli angoli. Ritorna true se l'ha fatto.
 */
export function inserisciInAngolo(progetto, m, tx, ty) {
  if (progetto.autoRegletta === false || m.isola) return false;
  if (categoriaTipo(m.tipo) !== 'base' || m.tipo === 'base-angolo') return false;
  const base = (progetto.reglettaAngolo && progetto.reglettaAngolo.base) || 30;
  if (m.rotManuale) return false;                                  // pezzo di penisola girato a mano
  const W = vincolaAiMuri(progetto, m, tx, ty);
  if (!retroAMuro(progetto, { ...m, x: W.x, y: W.y })) return false;
  const urti = sovrapposto(progetto, m, W.x, W.y);
  if (!urti) return false;
  const A = aabbMondo({ ...m, x: W.x, y: W.y });
  // tutti gli urti: mobili a terra PERPENDICOLARI (la fila dell'altro muro), più stretti del nostro
  for (const o of urti) {
    if (!FILA_PEZZI.includes(categoriaTipo(o.tipo))) return false;
    if (aabbMondo(o).horiz === A.horiz) return false;
  }
  const asseO = !aabbMondo(urti[0]).horiz ? 'y' : 'x';             // asse lungo della fila dell'altro muro
  const cm = asseO === 'y' ? W.y : W.x;
  const primo = urti.reduce((a, b) => (Math.abs((asseO === 'y' ? a.y : a.x) - cm) <= Math.abs((asseO === 'y' ? b.y : b.x) - cm) ? a : b));
  if (dimMobile(primo).w >= A.w) return false;                    // il mobile d'angolo (cieco) è il più largo
  const B = aabbMondo(primo);
  const dir = ((asseO === 'y' ? primo.y : primo.x) - cm) >= 0 ? 1 : -1;   // via dall'angolo
  const shift = asseO === 'y'
    ? (dir > 0 ? A.y1 + base - B.y0 : B.y1 - (A.y0 - base))
    : (dir > 0 ? A.x1 + base - B.x0 : B.x1 - (A.x0 - base));
  if (!(shift > 0)) return false;
  const vecchio = { x: m.x, y: m.y };
  m.x = W.x; m.y = W.y;                                           // il mobile d'angolo al suo posto
  if (!spostaFila(progetto, primo, dir, shift, [m.id])) { m.x = vecchio.x; m.y = vecchio.y; return false; }
  // ancora qualcosa sotto il mobile d'angolo? allora rinuncio
  const resto = sovrapposto(progetto, m, m.x, m.y);
  if (resto && resto.some((u) => FILA_PEZZI.includes(categoriaTipo(u.tipo)))) {
    spostaFila(progetto, primo, dir, -shift, [m.id]);
    m.x = vecchio.x; m.y = vecchio.y; return false;
  }
  return true;
}

/**
 * Sposta di `shift` mm (lungo X se asseX, altrimenti Y) il pezzo libero `primo`
 * con tutti i pezzi a terra attaccati a lui che NON sono a muro (la penisola o
 * l'isola intera, con costadi e pannelli). Se dall'altra parte c'è una fila a
 * muro, la fa scorrere lungo il suo muro per fare posto. Se qualcosa esce dai
 * muri o non c'è posto non sposta niente. Ritorna true se l'ha fatto.
 */
function spostaBlocco(progetto, primo, asseX, shift, escludi = []) {
  const tutti = (progetto.mobiliLiberi || []).filter((o) => FILA_PEZZI.includes(categoriaTipo(o.tipo)));
  const blocco = [primo], visti = new Set([primo.id, ...escludi]);
  for (let k = 0; k < blocco.length; k++) {
    const P = aabbMondo(blocco[k]);
    for (const o of tutti) {
      if (visti.has(o.id)) continue;
      const cat = categoriaTipo(o.tipo);
      if (!['costado', 'regletta', 'pannello'].includes(cat) && retroAMuro(progetto, o)) continue;   // le file a muro restano ferme
      const B = aabbMondo(o);
      const sx = Math.max(B.x0 - P.x1, P.x0 - B.x1), sy = Math.max(B.y0 - P.y1, P.y0 - B.y1);
      const tocca = (sx <= 5 && sy < -20) || (sy <= 5 && sx < -20);
      if (!tocca) continue;
      visti.add(o.id); blocco.push(o);
    }
  }
  const salva = (progetto.mobiliLiberi || []).map((o) => [o, o.x, o.y]);
  const ripristina = () => { for (const [o, x, y] of salva) { o.x = x; o.y = y; } };
  for (const o of blocco) { if (asseX) o.x = Math.round(o.x + shift); else o.y = Math.round(o.y + shift); }
  const ids = new Set(blocco.map((o) => o.id));
  for (let giro = 0; giro < 2; giro++) {
    const urtati = [];
    for (const o of blocco) {
      const v = vincolaAiMuri(progetto, o, o.x, o.y);
      if (Math.abs(v.x - o.x) > 1 || Math.abs(v.y - o.y) > 1) { ripristina(); return false; }
      for (const u of (sovrapposto(progetto, o, o.x, o.y) || [])) {
        if (!ids.has(u.id) && FILA_PEZZI.includes(categoriaTipo(u.tipo))) urtati.push([o, u]);
      }
    }
    if (!urtati.length) return true;
    if (giro === 1) break;
    // Dall'altra parte c'è la fila a muro (es. una base sopra la penisola):
    // scorre lungo il suo muro quel tanto che serve, con i mobili attaccati.
    for (const [o, u] of urtati) {
      const U = aabbMondo(u), O = aabbMondo(o);
      if (U.horiz !== asseX || !retroAMuro(progetto, u)) { ripristina(); return false; }
      const serve = asseX ? (shift > 0 ? O.x1 - U.x0 : U.x1 - O.x0) : (shift > 0 ? O.y1 - U.y0 : U.y1 - O.y0);
      if (serve > 0.5 && !spostaFila(progetto, u, shift > 0 ? 1 : -1, serve, [...ids, ...escludi])) { ripristina(); return false; }
    }
  }
  ripristina();
  return false;
}

function contaInFila(progetto, m) {
  if (categoriaTipo(m.tipo) !== 'base') return 0;
  const A = aabbMondo(m);
  const rotN = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const horizM = rotN % 180 === 0;
  let count = 0;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    if (!FILA_TERRA.includes(categoriaTipo(o.tipo))) continue;     // anche colonne, lavastoviglie…
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
    // PENISOLA: uno dei due è un pezzo libero (non ha lo schienale a un muro) e
    // l'altro sta nella fila a muro → si sposta SEMPRE il pezzo libero, con
    // tutta la penisola attaccata, via dall'altro lungo la direzione delle ante
    // del cieco. La fila a muro resta ferma (niente rimbalzi con l'altro angolo).
    const cLib = !retroAMuro(progetto, c), oLib = !retroAMuro(progetto, o);
    if (cLib !== oLib) {
      const lib = cLib ? c : o, fermo = cLib ? o : c;
      const C = aabbMondo(c), O = aabbMondo(o);
      const asseX = !C.horiz;                      // ante del cieco lungo X o lungo Y
      const ov = asseX ? Math.min(C.x1, O.x1) - Math.max(C.x0, O.x0) : Math.min(C.y1, O.y1) - Math.max(C.y0, O.y0);
      const delta = ov + base;
      if (Math.abs(delta) < 0.5) continue;
      const dir = (asseX ? lib.x - fermo.x : lib.y - fermo.y) >= 0 ? 1 : -1;
      spostaBlocco(progetto, lib, asseX, dir * delta, [fermo.id]);
      continue;
    }
    // Auto-regletta attiva → il gap d'angolo si apre SEMPRE in automatico,
    // anche se i mobili sono stati messi a mano: così la regletta ci sta
    // sempre (niente avviso "0 spazio" da risolvere a mano).
    // Decido chi resta fermo e chi si sposta in base ai VICINI:
    // più vicini in fila = fila principale = resta fermo.
    // Il mobile CIECO (il più largo, es. 1000) resta nell'angolo e si sposta
    // l'altro con la sua fila; a pari larghezza resta fermo chi ha più vicini.
    let fisso, mobile;
    const wc = dimMobile(c).w, wo = dimMobile(o).w;
    if (wc !== wo || c.angoloCieco === true) { fisso = c; mobile = o; }
    else {
      const nc = contaInFila(progetto, c), no = contaInFila(progetto, o);
      if (no > nc) { fisso = o; mobile = c; } else { fisso = c; mobile = o; }
    }
    const F = aabbMondo(fisso), M = aabbMondo(mobile);
    // il mobile scorre lungo la sua parete (asse lungo del mobile)
    const axisX = M.horiz;
    const overlap = axisX
      ? Math.min(F.x1, M.x1) - Math.max(F.x0, M.x0)
      : Math.min(F.y1, M.y1) - Math.max(F.y0, M.y0);
    const delta = overlap + base;                  // porta la luce a `base`
    if (Math.abs(delta) < 0.5) continue;           // già a posto → idempotente
    const dir = (axisX ? mobile.x : mobile.y) >= (axisX ? fisso.x : fisso.y) ? 1 : -1;
    // si sposta con la sua fila (mai dentro una colonna o un altro mobile);
    // se su quel muro non c'è posto, provo a spostare l'altro
    if (spostaFila(progetto, mobile, dir, delta, [fisso.id])) continue;
    const ax2 = F.horiz;
    const ov2 = ax2 ? Math.min(F.x1, M.x1) - Math.max(F.x0, M.x0) : Math.min(F.y1, M.y1) - Math.max(F.y0, M.y0);
    const dir2 = (ax2 ? fisso.x : fisso.y) >= (ax2 ? mobile.x : mobile.y) ? 1 : -1;
    spostaFila(progetto, fisso, dir2, ov2 + base, [mobile.id]);
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
  const p0 = progetto.piano.pareti[0];
  if (p0 && (p0.x0 || p0.y0)) {                      // primo vertice spostato: ruota anche lui
    const r = (delta * Math.PI) / 180, x = p0.x0 || 0, y = p0.y0 || 0;
    p0.x0 = Math.round(x * Math.cos(r) - y * Math.sin(r)); p0.y0 = Math.round(x * Math.sin(r) + y * Math.cos(r));
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
  const p0 = progetto.piano.pareti[0];
  if (p0 && p0.y0) p0.y0 = -p0.y0;
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
  // punto di partenza: (0,0), o quello salvato sulla prima parete se il primo
  // vertice è stato spostato a mano libera
  const o = (pareti && pareti[0]) || {};
  let x = Number(o.x0) || 0, y = Number(o.y0) || 0;
  const pts = [{ x, y }];
  for (const p of pareti) {
    const rad = (p.angolo_gradi * Math.PI) / 180;
    x += p.lunghezza_mm * Math.cos(rad);
    y += p.lunghezza_mm * Math.sin(rad);
    pts.push({ x, y });
  }
  return pts;
}

// --------- SOFFITTO («Tetto sì»): dove sta e quanto è grande (in pianta, mm) ---------
const SOFF_MURO = 60;           // spessore dei muri: il soffitto arriva alla loro faccia esterna
const SOFF_FRONTE = 2000;       // davanti ai mobili, verso la stanza: isola, lampade, sgabelli, passaggio
const SOFF_LATI = 1200;         // ai lati (e dietro) dove non c'è muro
/**
 * Il SOFFITTO in pianta. AUTOMATICO: fino ai muri (faccia esterna); dove un lato non ha muro va
 * oltre i mobili, 2 m davanti (verso la stanza) e 1,2 m ai lati. L'utente può scrivere la
 * PROFONDITÀ (dal muro verso la stanza) e la LARGHEZZA (lungo il muro) in
 * progetto.soffittoProfondita / soffittoLarghezza (mm; vuoto = automatico). Le misure vanno dal
 * filo interno del muro (dove cominciano i mobili); la lastra copre anche lo spessore del muro.
 * → { x0, x1, y0, y1, asse ('x'|'y': asse della profondità), fronte ('x0'|'x1'|'y0'|'y1': il lato
 *     verso la stanza), profondita, larghezza,
 *     autoProfondita, autoLarghezza }
 */
export function rettangoloSoffitto(progetto) {
  const pareti = (progetto.piano && progetto.piano.pareti) || [];
  const V = calcolaVertici(pareti);
  const muri = [];
  let nx = 0, ny = 0;                       // da che parte sta la stanza (normali interne × lunghezza)
  pareti.forEach((p, i) => {
    const a = V[i], b = V[i + 1];
    if (p.assente || !a || !b) return;
    muri.push([a, b]);
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    nx += -(b.y - a.y) * sgn; ny += (b.x - a.x) * sgn;
  });
  const xs = [], ys = [];
  for (const [a, b] of muri) xs.push(a.x, b.x), ys.push(a.y, b.y);
  // lungo ogni muro ci sono (o ci saranno) i mobili: la loro profondità sta sempre sotto il soffitto
  pareti.forEach((p, i) => {
    const a = V[i], b = V[i + 1];
    if (p.assente || !a || !b) return;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, sgn = p.latoInterno === 'interno' ? 1 : -1;
    const ix = (-(b.y - a.y) / L) * sgn * PROFONDITA_BASE, iy = ((b.x - a.x) / L) * sgn * PROFONDITA_BASE;
    xs.push(a.x + ix, b.x + ix); ys.push(a.y + iy, b.y + iy);
  });
  for (const m of (progetto.mobiliLiberi || [])) {
    const d = dimMobile(m), r = ((m.rot || 0) * Math.PI) / 180;
    const ex = Math.abs(Math.cos(r)) * d.w / 2 + Math.abs(Math.sin(r)) * d.d / 2, ey = Math.abs(Math.sin(r)) * d.w / 2 + Math.abs(Math.cos(r)) * d.d / 2;
    xs.push(m.x - ex, m.x + ex); ys.push(m.y - ey, m.y + ey);
  }
  if (!xs.length) xs.push(0, 3000), ys.push(0, 600);
  // asse della profondità: quello verso cui guarda la stanza (senza muri: y, stanza verso +y)
  const asse = Math.abs(nx) > Math.abs(ny) ? 'x' : 'y';
  const verso = (asse === 'x' ? nx : ny) < 0 ? -1 : 1;
  // c'è un muro lungo questo lato? (un muro dritto che sta sul bordo)
  const lungo = (k, v) => muri.some(([a, b]) => Math.abs(a[k] - v) < 120 && Math.abs(b[k] - v) < 120 && Math.hypot(b.x - a.x, b.y - a.y) > 400);
  const intervallo = (k, vals, oltreLo, oltreHi, misura, ancora) => {
    const lo = Math.min(...vals), hi = Math.max(...vals), mLo = lungo(k, lo), mHi = lungo(k, hi);
    let a = mLo ? lo : lo - oltreLo, b = mHi ? hi : hi + oltreHi;
    const auto = b - a;
    const M = Number(misura) > 0 ? Math.max(500, Number(misura)) : null;
    const anc = ancora || (mLo && !mHi ? 'lo' : mHi && !mLo ? 'hi' : 'centro');
    if (M) {
      if (anc === 'lo') b = a + M; else if (anc === 'hi') a = b - M;
      else { const c = (a + b) / 2; a = c - M / 2; b = c + M / 2; }
    }
    // la lastra copre anche lo spessore dei muri (se il bordo è ancora sul muro)
    if (mLo && Math.abs(a - lo) < 1) a -= SOFF_MURO;
    if (mHi && Math.abs(b - hi) < 1) b += SOFF_MURO;
    return { a, b, auto, misura: M || auto };
  };
  const prof = intervallo(asse, asse === 'x' ? xs : ys, verso > 0 ? SOFF_LATI : SOFF_FRONTE, verso > 0 ? SOFF_FRONTE : SOFF_LATI,
    progetto.soffittoProfondita, verso > 0 ? 'lo' : 'hi');
  const lar = intervallo(asse === 'x' ? 'y' : 'x', asse === 'x' ? ys : xs, SOFF_LATI, SOFF_LATI, progetto.soffittoLarghezza, null);
  const [X, Y] = asse === 'x' ? [prof, lar] : [lar, prof];
  return { x0: X.a, x1: X.b, y0: Y.a, y1: Y.b, asse, fronte: asse + (verso > 0 ? '1' : '0'),
    profondita: Math.round(prof.misura), larghezza: Math.round(lar.misura),
    autoProfondita: Math.round(prof.auto), autoLarghezza: Math.round(lar.auto) };
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

/**
 * Altezza dei mobili BASSI della cucina (la più usata: 700 o 800). Serve
 * per allineare tutta la parte bassa: la porta bassa delle colonne è alta
 * come i bassi, così le linee di porte e cassetti sono tutte alla stessa quota.
 * null se non ci sono mobili bassi.
 */
const CAT_NON_BASSE_M = new Set(['pensile', 'colonna', 'regletta', 'pannello', 'costado', 'oggetto', 'frigo', 'altillo']);
export function altezzaBassiCucina(progetto) {
  const conteggio = new Map();
  for (const m of (progetto.mobiliLiberi || [])) {
    if (CAT_NON_BASSE_M.has(categoriaTipo(m.tipo))) continue;
    const h = m.altezza_mm || 700;
    conteggio.set(h, (conteggio.get(h) || 0) + 1);
  }
  if (!conteggio.size) return null;
  let best = null, bestN = -1;
  for (const [h, n] of conteggio) if (n > bestN) { bestN = n; best = h; }
  return best;
}
/** Porta bassa della colonna: alta come i mobili bassi (se ce ne sono). */
export function portaBassaColonna(progetto, m) {
  return altezzaBassiCucina(progetto) ?? m.altezzaBassa_mm ?? 700;
}

/**
 * Altezze dei FRONTALI dei cassetti (dall'alto in basso), in mm interi per
 * difetto. Fughe da 2 mm, una in più dei cassetti.
 * - tutti uguali: (H − (n+1)·2) ÷ n
 * - con un cassetto PICCOLO in alto (piccolo = sua altezza): gli altri si
 *   dividono in parti uguali lo spazio che resta.
 */
export function frontiCassetti(H, n, piccolo = null) {
  n = Math.max(1, n || 3);
  const fc = parametri().ante.ariaCassetti;            // aria tra i frontali (⚙ Parametri)
  const netto = H - (n + 1) * fc;
  if (!piccolo || n < 2) return Array(n).fill(Math.floor(netto / n));
  const hs = Math.floor(Math.max(60, Math.min(Number(piccolo), netto - (n - 1) * 80)));
  return [hs, ...Array(n - 1).fill(Math.floor((netto - hs) / (n - 1)))];
}

// =============================================================================
// PIANTA A MANO LIBERA: vertici spostabili, angoli, pareti tirate col mouse
// =============================================================================
const normA = (a) => { let x = a % 360; if (x <= -180) x += 360; if (x > 180) x -= 360; return x; };
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Angolo INTERNO al vertice k (tra la parete k−1 e la parete k), in gradi
 * 0..360: 90 = angolo retto verso l'interno, 180 = dritto, >180 = verso fuori.
 * null per i vertici d'estremità.
 */
export function angoloInternoVertice(pareti, k) {
  if (k <= 0 || k >= pareti.length) return null;
  const a = pareti[k - 1], b = pareti[k];
  const sgn = a.latoInterno === 'esterno' ? -1 : 1;
  let v = 180 - sgn * normA(b.angolo_gradi - a.angolo_gradi);
  if (v <= 0) v += 360; if (v > 360) v -= 360;
  return r1(v);
}

/** Scrive l'angolo interno al vertice k: ruota la parete k e tutte le seguenti. */
export function impostaAngoloVertice(progetto, k, gradi) {
  const pareti = progetto.piano.pareti;
  if (k <= 0 || k >= pareti.length) return;
  const a = pareti[k - 1];
  const sgn = a.latoInterno === 'esterno' ? -1 : 1;
  const nuovo = a.angolo_gradi + sgn * (180 - Number(gradi));
  const diff = nuovo - pareti[k].angolo_gradi;
  for (let j = k; j < pareti.length; j++) pareti[j].angolo_gradi = r1(pareti[j].angolo_gradi + diff);
  progetto.pianoConfermato = false;
}

/** Imposta la parete i a partire da due punti (lunghezza e direzione). */
function pareteDaPunti(p, A, B) {
  p.lunghezza_mm = Math.max(50, Math.round(Math.hypot(B.x - A.x, B.y - A.y)));
  p.angolo_gradi = r1((Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI);
}

/**
 * Sposta il vertice k nel punto (x,y): cambiano solo le due pareti che ci
 * arrivano, il resto della pianta resta fermo.
 */
export function muoviVertice(progetto, k, x, y) {
  const pareti = progetto.piano.pareti;
  const V = calcolaVertici(pareti);
  const P = { x, y };
  if (k === 0) {
    const v1 = V[1];
    pareti[0].x0 = Math.round(x); pareti[0].y0 = Math.round(y);
    pareteDaPunti(pareti[0], P, v1);
  } else if (k === pareti.length) {
    pareteDaPunti(pareti[k - 1], V[k - 1], P);
  } else {
    pareteDaPunti(pareti[k - 1], V[k - 1], P);
    pareteDaPunti(pareti[k], P, V[k + 1]);
  }
  progetto.pianoConfermato = false;
}

/**
 * "Squadra": il punto P (vertice spostato o fine di una nuova parete) si
 * aggancia alle direzioni a 0/90/180/270° dalle pareti vicine se ci è vicino
 * (entro `tol` gradi). ancore = punti fissi collegati a P.
 */
export function agganciaSquadra(P, ancore, tol = 6) {
  const linee = [];
  for (const A of ancore) {
    if (!A) continue;
    const ang = (Math.atan2(P.y - A.y, P.x - A.x) * 180) / Math.PI;
    const q = Math.round(ang / 90) * 90;
    if (Math.abs(normA(ang - q)) <= tol) linee.push({ A, ang: (q * Math.PI) / 180 });
  }
  if (linee.length === 0) return { ...P, agganciato: false };
  if (linee.length === 1 || Math.abs(normA((linee[0].ang - linee[1].ang) * 180 / Math.PI)) % 180 < 1) {
    const { A, ang } = linee[0], c = Math.cos(ang), s = Math.sin(ang);
    const t = (P.x - A.x) * c + (P.y - A.y) * s;
    return { x: A.x + c * t, y: A.y + s * t, agganciato: true };
  }
  // due direzioni: incrocio delle due rette
  const [l1, l2] = linee;
  const c1 = Math.cos(l1.ang), s1 = Math.sin(l1.ang), c2 = Math.cos(l2.ang), s2 = Math.sin(l2.ang);
  const den = c1 * s2 - s1 * c2;
  if (Math.abs(den) < 1e-6) return { ...P, agganciato: false };
  const t = ((l2.A.x - l1.A.x) * s2 - (l2.A.y - l1.A.y) * c2) / den;
  return { x: l1.A.x + c1 * t, y: l1.A.y + s1 * t, agganciato: true };
}

/**
 * Aggiunge una parete a un'ESTREMITÀ della pianta ('fine' o 'inizio'), lunga
 * `lung` mm in direzione `ang` gradi (dall'estremità verso fuori).
 * Ritorna l'id della nuova parete.
 */
export function aggiungiPareteLibera(progetto, estremo, lung, ang) {
  const pareti = progetto.piano.pareti;
  const id = pareti.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  const vicino = estremo === 'inizio' ? pareti[0] : pareti[pareti.length - 1];
  const lato = (vicino && vicino.latoInterno) || 'interno';
  if (estremo === 'inizio' && pareti.length) {
    const V = calcolaVertici(pareti);
    const rad = (ang * Math.PI) / 180;
    const nuovoInizio = { x: V[0].x + Math.cos(rad) * lung, y: V[0].y + Math.sin(rad) * lung };
    delete pareti[0].x0; delete pareti[0].y0;
    pareti.unshift({ id, lunghezza_mm: Math.round(lung), angolo_gradi: r1(normA(ang + 180)), latoInterno: lato,
      x0: Math.round(nuovoInizio.x), y0: Math.round(nuovoInizio.y) });
  } else {
    pareti.push({ id, lunghezza_mm: Math.round(lung), angolo_gradi: r1(normA(ang)), latoInterno: lato });
  }
  progetto.piano.tipologia = 'personalizzata';
  progetto.pianoConfermato = false;
  return id;
}

/**
 * LATO INTERNO SEMPRE VERSO L'INTERNO della forma (L, U, personalizzata):
 * dalla somma delle svolte (sinistra = +, destra = −) si capisce da che parte
 * è l'interno, e tutte le pareti lo prendono da quel lato. Così, comunque si
 * giri, specchi o modifichi la pianta, i mobili vanno dentro e non dietro il
 * muro. Una parete sola (lineare) resta come l'ha scelta l'utente.
 * Ritorna true se ha cambiato qualcosa.
 */
export function correggiLatoInterno(progetto) {
  const pareti = (progetto.piano && progetto.piano.pareti) || [];
  if (pareti.length < 2) return false;
  let svolte = 0;
  for (let i = 1; i < pareti.length; i++) svolte += normA(pareti[i].angolo_gradi - pareti[i - 1].angolo_gradi);
  if (Math.abs(svolte) < 1) return false;            // nessun angolo netto: decide l'utente
  const lato = svolte > 0 ? 'interno' : 'esterno';   // 'interno' = a sinistra del verso della parete
  let cambiato = false;
  for (const p of pareti) if (p.latoInterno !== lato) { p.latoInterno = lato; cambiato = true; }
  return cambiato;
}

/** Il lato interno è deciso dalla forma (pianta con angoli)? */
export function latoInternoAutomatico(progetto) {
  const pareti = (progetto.piano && progetto.piano.pareti) || [];
  let svolte = 0;
  for (let i = 1; i < pareti.length; i++) svolte += normA(pareti[i].angolo_gradi - pareti[i - 1].angolo_gradi);
  return pareti.length >= 2 && Math.abs(svolte) >= 1;
}

/** Mobili d'angolo a L (pensile angolo e base angolo): profondità dei bracci. */
export function profBraccioL(tipo, m = null) {
  if (tipo === 'base-angolo') return (m && m.profBraccio_mm) || PROFONDITA_BASE;
  return tipo === 'pensile-angolo' ? PROFONDITA_PENSILE : null;
}
/** Larghezza delle due ante della base angolo (lato − profondità braccio). */
export function anteBaseAngolo(m) {
  const d = dimMobile(m), P = profBraccioL('base-angolo', m);
  return { a: Math.round(d.w - P), b: Math.round(d.d - P) };
}
/**
 * Aggancio di un mobile a L all'ANGOLO INTERNO più vicino (entro ~1 m): lo
 * mette con l'angolo pieno nel vertice e lo gira nel verso giusto.
 * Ritorna { x, y, rot } oppure null se non c'è un angolo vicino.
 */
export function agganciaAngoloL(progetto, m, x, y) {
  const prof = profBraccioL(m.tipo, m);
  if (!prof) return null;
  const full = progetto.piano.pareti || [];
  const V = calcolaVertici(full);
  const W = m.larghezza_mm || dimMobile(m).w, half = W / 2;
  let best = null;
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i], b = full[i + 1];
    if (a.assente || b.assente || !angoloInterno(a, b)) continue;
    const v = V[i + 1], v2 = V[i + 2], v0 = V[i];
    const u2 = { x: v2.x - v.x, y: v2.y - v.y }, l2 = Math.hypot(u2.x, u2.y) || 1;
    const u1 = { x: v0.x - v.x, y: v0.y - v.y }, l1 = Math.hypot(u1.x, u1.y) || 1;
    // centro: a mezza L da entrambi i muri, dal lato interno
    const cx = v.x + (u1.x / l1) * half + (u2.x / l2) * half;
    const cy = v.y + (u1.y / l1) * half + (u2.y / l2) * half;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 1000 && (!best || d < best.d)) best = { d, x: cx, y: cy, rot: orientaLVersoAngolo(cx, cy, v, W, prof) };
  }
  return best ? { x: Math.round(best.x), y: Math.round(best.y), rot: best.rot } : null;
}

// =============================================================================
// CIERRE A TECHO che SEGUE IL FRONTE DEI MOBILI: per ogni fila di mobili alti
// (pensili e colonne sullo stesso muro) una fascia continua che sta a filo del
// fronte di ogni mobile: sopra le colonne a filo colonne (colore colonne), sopra
// i pensili a filo pensili (colore pensili); dove la profondità cambia c'è il
// pezzettino che RIENTRA (colore del mobile più profondo, es. colonne).
// Negli angoli una fascia passa (fino all'incrocio + lo spessore) e l'altra ci
// si appoggia. Ritorna i PEZZI:
//  { tipo: 'fronte', a0, a1, front } · { tipo: 'rientro', a0, a1, f0, f1 }
//  con rot, ux, uy, fx, fy (assi della fila), gruppo ('pensile'|'colonna'),
//  ids (mobili sotto), lunghezza (mm del pezzo da tagliare).
// =============================================================================
export function fasceCierreTecho(progetto, spessore = 18) {
  const ct = progetto.cierreTecho;
  if (!ct || !ct.attivo) return [];
  const SP_ANTA_3D = 20;                                        // anta: dalla cassa in avanti
  const assi = (r) => { const th = r * Math.PI / 180; return { ux: Math.round(Math.cos(th)), uy: -Math.round(Math.sin(th)), fx: -Math.round(Math.sin(th)), fy: -Math.round(Math.cos(th)) }; };
  const file = [];
  const aggiungi = (r, a0, a1, dietro, fronte, pz) => {
    let f = file.find((q) => q.rot === r && Math.abs(q.dietro - dietro) < 60);
    if (!f) { f = { rot: r, ...assi(r), dietro, pezzi: [], fine: [] }; file.push(f); }
    (pz.fine ? f.fine : f.pezzi).push({ ...pz, a0, a1, fronte, dietro });
  };
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    // pannelli alti a fine fila (costado, regletta grande): la fascia ci passa sopra
    const fine = (cat === 'costado' && ((m.altezza_mm || 850) >= 1500 || (m.profondita_mm || 620) < 500))
      || (m.tipo === 'regletta-grande' && (m.altezza_mm || 0) >= 1500);
    if (cat !== 'pensile' && cat !== 'colonna' && !fine) continue;
    const d = dimMobile(m), r = ((Math.round((m.rot || 0) / 90) * 90) % 360 + 360) % 360, A = assi(r);
    const a = m.x * A.ux + m.y * A.uy, c = m.x * A.fx + m.y * A.fy;
    if (m.tipo === 'pensile-angolo') {
      // PENSILE D'ANGOLO a L: due bracci profondi come i pensili, uno per muro;
      // ciascun braccio entra nella fila del suo muro. (Nel 3D la L gira di +rot:
      // braccio A lungo x locale con il fronte verso +z, braccio B lungo z con
      // il fronte verso +x, angolo pieno in (-x, -z).)
      const P = PROFONDITA_PENSILE, rA = (360 - r) % 360, rB = (630 - r) % 360;
      const QA = assi(rA), QB = assi(rB);
      const aA = m.x * QA.ux + m.y * QA.uy, cA = m.x * QA.fx + m.y * QA.fy;
      const aB = m.x * QB.ux + m.y * QB.uy, cB = m.x * QB.fx + m.y * QB.fy;
      aggiungi(rA, aA - d.w / 2, aA + d.w / 2, cA - d.d / 2, cA - d.d / 2 + P + SP_ANTA_3D, { id: m.id, gruppo: 'pensile' });
      aggiungi(rB, aB - d.d / 2, aB + d.d / 2, cB - d.w / 2, cB - d.w / 2 + P + SP_ANTA_3D, { id: m.id, gruppo: 'pensile' });
      continue;
    }
    if (fine) { aggiungi(r, a - d.w / 2, a + d.w / 2, c - d.d / 2, c + d.d / 2, { id: m.id, fine: true }); continue; }
    aggiungi(r, a - d.w / 2, a + d.w / 2, c - d.d / 2, c + d.d / 2 + SP_ANTA_3D, { id: m.id, gruppo: cat === 'pensile' ? 'pensile' : 'colonna' });
  }
  // TRATTI: mobili consecutivi con lo stesso fronte; i buchi (es. cappa, fino a 1 m) si chiudono
  const fasce = [];
  for (const f of file) {
    f.pezzi.sort((p, q) => p.a0 - q.a0);
    let fascia = null;
    const n0 = fasce.length;
    for (const pz of f.pezzi) {
      if (!fascia || pz.a0 - fascia.tratti[fascia.tratti.length - 1].a1 > 1000) {
        fascia = { rot: f.rot, ux: f.ux, uy: f.uy, fx: f.fx, fy: f.fy, dietro: pz.dietro, tratti: [] };
        fasce.push(fascia);
      }
      fascia.dietro = Math.min(fascia.dietro, pz.dietro);
      const ult = fascia.tratti[fascia.tratti.length - 1];
      if (ult && Math.abs(ult.front - pz.fronte) < 15 && ult.gruppo === pz.gruppo) {
        ult.a1 = Math.max(ult.a1, pz.a1); ult.ids.push(pz.id); continue;
      }
      // buco tra due tratti: lo copre il tratto MENO profondo (la fascia resta continua)
      if (ult && pz.a0 > ult.a1) { if (pz.fronte < ult.front) pz.a0 = ult.a1; else ult.a1 = pz.a0; }
      fascia.tratti.push({ a0: pz.a0, a1: pz.a1, front: pz.fronte, gruppo: pz.gruppo, ids: [pz.id] });
    }
    // fine fila: la fascia copre anche il costado (o la regletta) a filo del suo fronte
    for (const fascia of fasce.slice(n0)) {
      for (let giro = 0; giro < 2; giro++) for (const e of f.fine) {
        const t0 = fascia.tratti[0], t1 = fascia.tratti[fascia.tratti.length - 1];
        if (Math.abs(e.a1 - t0.a0) < 30 && Math.abs(e.fronte - t0.front) < 30) t0.a0 = Math.min(t0.a0, e.a0);
        else if (Math.abs(e.a0 - t1.a1) < 30 && Math.abs(e.fronte - t1.front) < 30) t1.a1 = Math.max(t1.a1, e.a1);
      }
    }
  }
  // ANGOLI: le due fasce perpendicolari arrivano all'incrocio dei loro fronti
  const fatti = new Set();
  for (let i = 0; i < fasce.length; i++) for (let j = i + 1; j < fasce.length; j++) {
    const A = fasce[i], B = fasce[j];
    if (A.ux * B.ux + A.uy * B.uy !== 0) continue;
    const det = A.fx * B.fy - A.fy * B.fx; if (!det) continue;
    const capo = (F, fine) => (fine === 'a0' ? F.tratti[0] : F.tratti[F.tratti.length - 1]);
    for (const fineA of ['a0', 'a1']) for (const fineB of ['a0', 'a1']) {
      if (fatti.has(`${i}${fineA}`) || fatti.has(`${j}${fineB}`)) continue;
      const tA = capo(A, fineA), tB = capo(B, fineB);
      const Xx = (tA.front * B.fy - A.fy * tB.front) / det, Xy = (A.fx * tB.front - tA.front * B.fx) / det;
      const aA = Xx * A.ux + Xy * A.uy, aB = Xx * B.ux + Xy * B.uy;
      if (Math.abs(aA - tA[fineA]) > 900 || Math.abs(aB - tB[fineB]) > 900) continue;
      // l'incrocio deve stare dalla parte di quell'estremità
      if ((fineA === 'a0' ? aA > tA.a1 : aA < tA.a0) || (fineB === 'a0' ? aB > tB.a1 : aB < tB.a0)) continue;
      // un vero angolo: ogni fascia si allunga (o si accorcia) al massimo di quanto
      // è profonda l'altra fila lì (passa sopra i suoi mobili, mai nel vuoto)
      const varA = Math.abs(aA - tA[fineA]), varB = Math.abs(aB - tB[fineB]);
      if (varA > Math.abs(tB.front - B.dietro) + 30 || varB > Math.abs(tA.front - A.dietro) + 30) continue;
      fatti.add(`${i}${fineA}`); fatti.add(`${j}${fineB}`);
      tA[fineA] = aA; tB[fineB] = aB;
      const lunga = (A.tratti.at(-1).a1 - A.tratti[0].a0) >= (B.tratti.at(-1).a1 - B.tratti[0].a0);
      const [t, fine] = lunga ? [tA, fineA] : [tB, fineB];
      t[fine] += fine === 'a0' ? -spessore : spessore;
    }
  }
  // Muri della stanza: una fascia che finisce contro un muro è già chiusa di lato
  const pareti = (progetto.piano && progetto.piano.pareti) || [];
  const V = calcolaVertici(pareti);
  const muri = pareti.map((p, i) => (p.assente ? null : [V[i], V[i + 1]])).filter(Boolean);
  const controMuro = (x, y) => muri.some(([p, q]) => {
    const dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / L2));
    return Math.hypot(x - (p.x + t * dx), y - (p.y + t * dy)) < 40;
  });
  // PEZZI: fronte di ogni tratto + rientri dove cambia la profondità
  // + TESTATE dove la fascia finisce nel vuoto (fianco dal muro al pannello davanti)
  const pezzi = [];
  fasce.forEach((F, iF) => {
    const base = { rot: F.rot, ux: F.ux, uy: F.uy, fx: F.fx, fy: F.fy };
    for (const fine of ['a0', 'a1']) {
      if (fatti.has(`${iF}${fine}`)) continue;                  // angolo: ci si appoggia l'altra fascia
      const t = fine === 'a0' ? F.tratti[0] : F.tratti[F.tratti.length - 1];
      const aE = t[fine], fM = (F.dietro + t.front) / 2;
      if (controMuro(aE * F.ux + fM * F.fx, aE * F.uy + fM * F.fy)) continue;
      const f0 = F.dietro, f1 = t.front - spessore;
      if (f1 - f0 < 30) continue;
      pezzi.push({ ...base, tipo: 'testata', a0: fine === 'a0' ? aE : aE - spessore, a1: fine === 'a0' ? aE + spessore : aE,
        f0, f1, gruppo: t.gruppo, ids: t.ids, lunghezza: Math.round(f1 - f0) });
    }
    F.tratti.forEach((t, k) => {
      pezzi.push({ ...base, tipo: 'fronte', a0: t.a0, a1: t.a1, front: t.front, gruppo: t.gruppo, ids: t.ids, lunghezza: Math.round(t.a1 - t.a0) });
      const nx = F.tratti[k + 1];
      if (!nx || Math.abs(nx.front - t.front) < 15) return;
      // rientro sul fianco del mobile più profondo, dal fronte dell'altro al suo
      const prof = t.front > nx.front ? t : nx, basso = prof === t ? nx : t;
      const bordo = prof === t ? t.a1 : nx.a0, dentro = prof === t ? -1 : 1;
      const a0 = Math.min(bordo, bordo + dentro * spessore), a1 = Math.max(bordo, bordo + dentro * spessore);
      const f0 = basso.front - spessore, f1 = prof.front - spessore;
      pezzi.push({ ...base, tipo: 'rientro', a0, a1, f0, f1, gruppo: prof.gruppo, ids: [...t.ids, ...nx.ids], lunghezza: Math.round(f1 - f0) });
    });
  });
  return pezzi;
}

