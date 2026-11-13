// =============================================================================
// DISTINTA DI TAGLIO DELLA CUCINA
// =============================================================================
// I MODULI (basi, pensili, colonne) arrivano già completi dal fornitore, con
// fianchi, fondo, top, schiena e ripiani già tagliati: in distinta vanno solo
// come elenco DA ORDINARE. Da fare noi: ANTE e FRONTALI, più tutto quello che
// aggiungiamo in legno (costadi, reglette, pannelli, zoccolo). A parte gli
// ACCESSORI: piedini, griglie del forno. Solo calcolo: la tabella sta in main.js.
//
// Ogni pezzo: { modulo, nome, larghezza, altezza, spessore, materiale, quantita }
//   materiale: 'anta' | 'zoccolo' | 'melaminico'
// =============================================================================

import {
  categoriaTipo, dimMobile, nomeTipo, anteDiMobile, infoAngoloCieco, portaBassaColonna, frontiCassetti, anteBaseAngolo,
} from './modello.js?v=20261114t';

const SP = 18;        // ante/fronti e pannelli (mm)
const SP_MEL = 16;    // melaminico bianco (fondo + trasera cassetto) (mm)
const THK_REG = 20;   // spessore regletta d'angolo (mm)
const round = (n) => Math.round(n);
const zoccoloH = (h) => (h >= 800 ? 100 : 150);
const GRIGLIA_FORNO = 45, H_FORNO_INCASSO = 595;   // come nel 3D (scena3d.js)
// Piedini: 4 per modulo a terra, 6 se è più largo di 90 cm
const piediniDi = (L) => (L > 900 ? 6 : 4);

// Dimensioni di UN'anta/fronte: N ante su larghezza L, altezza H (come il 3D:
// 3 mm di fuga totale in larghezza, 2 mm in altezza, 3 mm tra le ante).
function dimAnta(L, H, N) {
  const uw = L - 3;
  const pw = (uw - (N - 1) * 3) / N;
  return { w: round(pw), h: round(H - 2) };
}

// --- costruttori per categoria ------------------------------------------------

// L'anta del pensile sporge 2 cm sotto (70→72, 90→92) con l'opzione attiva.
function pensileAntaSporge(opt, h) {
  if (opt === 'sporg70') return Math.abs(h - 700) < 40;
  if (opt === 'sporg90') return Math.abs(h - 900) < 40;
  return false;
}

function anteModulo(pz, mod, L, H, N, lato, altAnta, sporg) {
  const a = dimAnta(L, H, N);
  const nota = (N === 1 ? ` (apertura ${lato === 'sx' ? 'sx' : 'dx'})` : '') + (sporg ? ' sporgente' : '');
  pz.push({ modulo: mod, nome: `Anta${nota}`, larghezza: a.w, altezza: altAnta != null ? altAnta : a.h, spessore: SP, materiale: 'anta', quantita: N });
}

function zoccolo(pz, mod, L, H) {
  pz.push({ modulo: mod, nome: 'Zoccolo (frontale)', larghezza: round(L), altezza: zoccoloH(H), spessore: SP, materiale: 'zoccolo', quantita: 1 });
}

// Altezza dell'anta SUPERIORE della colonna: lo spazio che resta sopra la
// porta bassa, tolto l'eventuale forno/microonde/vano (stessa logica del 3D).
function restoAntaColonna(m, rem) {
  const H_FORNO = 600, H_MICRO = 380;
  if (m.variante === 'forno') { const ho = Math.min(H_FORNO, rem - 300); return rem - ho; }
  if (m.variante === 'microonde') { const ho = Math.min(H_MICRO, rem - 300); return rem - ho; }
  if (m.variante === 'forno-micro') {
    const hf = Math.max(200, Math.min(H_FORNO, rem - H_MICRO - 250));
    const hm = Math.max(150, Math.min(H_MICRO, rem - hf - 200));
    return rem - hf - hm;
  }
  if (m.variante === 'vano') {
    const vanoH = Math.max(100, Math.min(m.altezzaVano_mm || 600, rem - 100));
    return rem - vanoH;   // porta alta = resto − vano
  }
  return rem; // porta unica
}

// Fondo + trasera del cassetto in MELAMINICO BIANCO (guide metalliche: niente
// sponde di legno). Misure FISSE: fondo profondità 480; trasera alta 59 se il
// cassetto è basso (≤155) o 155 se è alto (>155). La LUNGHEZZA varia col
// modulo: fondo = L−53, trasera = L−72. `hCassetto` = altezza del fronte.
function cassettoMelaminico(pz, mod, L, hCassetto, nc) {
  const grande = hCassetto > 155;
  pz.push({ modulo: mod, nome: 'Cassetto · fondo', larghezza: round(L - 53), altezza: 480, spessore: SP_MEL, materiale: 'melaminico', quantita: nc });
  pz.push({ modulo: mod, nome: `Cassetto · trasera ${grande ? 'grande' : 'ridotta'}`, larghezza: round(L - 72), altezza: grande ? 155 : 59, spessore: SP_MEL, materiale: 'melaminico', quantita: nc });
}

// Regletta d'angolo (o pannello cieco) sul modulo "cieco" dell'angolo.
function reglettaAngolo(pz, mod, progetto, m, H) {
  if (progetto.autoRegletta === false) return;
  const info = infoAngoloCieco(progetto, m);
  if (!info) return;
  if (info.coperto) {
    pz.push({ modulo: mod, nome: 'Pannello cieco (angolo)', larghezza: round(info.coveredW || 0), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else {
    const ra = progetto.reglettaAngolo || {};
    const vis = (info.gap != null && info.gap > 0) ? Math.max(ra.spessore || 18, info.gap) : (ra.base || 30);
    pz.push({ modulo: mod, nome: 'Regletta angolo (braccio)', larghezza: round(vis), altezza: H, spessore: THK_REG, materiale: 'anta', quantita: 2 });
  }
}

/** Nome del materiale dal catalogo (quello caricato nella pagina). */
function nomeMateriale(id, altrimenti) {
  if (!id) return altrimenti;
  const def = typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === id);
  return def ? def.nome : altrimenti;
}

// --- un modulo → i suoi pezzi -------------------------------------------------

function pezziDiModulo(progetto, m) {
  const cat = categoriaTipo(m.tipo);
  const d = dimMobile(m);
  const L = d.w;
  const H = m.altezza_mm || 720;
  // Etichetta semplice: "Modulo da <altezza>×<larghezza>".
  const mod = `Modulo da ${m.altezza_mm ? `${m.altezza_mm}×${L}` : L}`
    + (m.fuoriMisura ? ' ⚠ da tagliare' : '');
  const pz = [];

  if (cat === 'base' && m.tipo === 'base-angolo') {
    // BASE ANGOLO a L: 2 ante larghe come quelle del pensile angolo
    // (larghezza − profondità bassi = 280), alte come la base (−2 mm);
    // zoccolo sulle due facce interne (arretrato 5 cm: +50 per lato)
    const { a, b } = anteBaseAngolo(m);
    for (const aw of a === b ? [a] : [a, b]) {
      const q = a === b ? 2 : 1;
      pz.push({ modulo: mod, nome: 'Anta (base angolo)', larghezza: Math.max(1, aw), altezza: round(H - 2), spessore: SP, materiale: 'anta', quantita: q });
      pz.push({ modulo: mod, nome: 'Zoccolo (frontale)', larghezza: Math.max(1, aw) + 50, altezza: zoccoloH(H), spessore: SP, materiale: 'zoccolo', quantita: q });
    }
  } else if (cat === 'base') {
    // carcassa, ripiani e cassetti interni: già nel modulo (non si tagliano)
    zoccolo(pz, mod, L, H);
    if (m.tipo === 'base-cassetti') {
      const nc = Math.max(1, m.cassetti || 3);
      // FUGHE: una in più dei cassetti, da 2 mm; frontali per difetto. Tutti
      // uguali, oppure uno piccolo in alto e gli altri uguali.
      const alt = frontiCassetti(H, nc, m.cassettoPiccolo_mm);
      const perH = new Map(); alt.forEach((h) => perH.set(h, (perH.get(h) || 0) + 1));
      for (const [hf, q] of perH) {
        const piccolo = m.cassettoPiccolo_mm && alt.length > 1 && hf === alt[0] && hf !== alt[1];
        pz.push({ modulo: mod, nome: piccolo ? 'Fronte cassetto piccolo' : 'Fronte cassetto', larghezza: round(L - 3), altezza: hf, spessore: SP, materiale: 'anta', quantita: q });
        // parti per fare i cassetti: fondo e trasera in melaminico bianco
        cassettoMelaminico(pz, mod, L, hf, q);
      }
    } else if (m.tipo === 'forno') {
      // sotto il forno un pannello del colore delle ante (griglia sopra = accessorio)
      const hp = round(H - 2 - GRIGLIA_FORNO - 3 - H_FORNO_INCASSO - 3);
      if (hp > 15) pz.push({ modulo: mod, nome: 'Pannello sotto forno', larghezza: round(L - 3), altezza: hp, spessore: SP, materiale: 'anta', quantita: 1 });
    } else {
      // base-ante / lavello
      const N = m.tipo === 'lavello' ? (L >= 900 ? 2 : 1) : anteDiMobile(m);
      anteModulo(pz, mod, L, H, N, m.antaLato);
      reglettaAngolo(pz, mod, progetto, m, H);
    }
  } else if (cat === 'pensile') {
    if (m.tipo === 'pensile-angolo' || m.tipo === 'pensile-angolo-45') {
      const aw = m.tipo === 'pensile-angolo-45' ? round(L * 0.5) : round(L - 350);
      pz.push({ modulo: mod, nome: 'Anta', larghezza: Math.max(100, aw), altezza: round(H - 2), spessore: SP, materiale: 'anta', quantita: m.tipo === 'pensile-angolo-45' ? 1 : 2 });
    } else {
      // Pensile 70/90: con l'anta sporgente la porta è 72/92 (H + 20), altrimenti H − 2.
      const sporg = pensileAntaSporge(progetto.antaPensile, H);
      anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, sporg ? H + 20 : null, sporg);
    }
  } else if (cat === 'colonna') {
    // Zoccolo della colonna: segue la porta bassa (70→150, 80→100), come i mobili bassi.
    const abC = portaBassaColonna(progetto, m);      // alta come i mobili bassi
    zoccolo(pz, mod, L, abC);
    // Due ante reali: sotto = porta bassa − 2 (come il mobile base 70/80),
    // sopra = lo spazio che resta − 2 (tolto forno/microonde/vano, come nel 3D).
    const ab = abC;
    const aw = round(L - 3);                        // larghezza anta (1 anta)
    const topDoor = restoAntaColonna(m, H - ab);
    pz.push({ modulo: mod, nome: 'Anta bassa', larghezza: aw, altezza: round(ab - 2), spessore: SP, materiale: 'anta', quantita: 1 });
    if (topDoor > 60) pz.push({ modulo: mod, nome: 'Anta alta', larghezza: aw, altezza: round(topDoor - 2), spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'costado') {
    // costado ALTO: alto come le ante del pensile vicino (70/72/90/92), come nel 3D
    let hC = H;
    if ((m.profondita_mm || 620) < 500) {
      let best = null, dMin = Infinity;
      for (const x of progetto.mobiliLiberi || []) {
        if (categoriaTipo(x.tipo) !== 'pensile') continue;
        const dd = Math.hypot(x.x - m.x, x.y - m.y); if (dd < dMin) { dMin = dd; best = x; }
      }
      if (best && dMin < 2500) { const hp = best.altezza_mm || 700; hC = hp + (pensileAntaSporge(progetto.antaPensile, hp) ? 20 : 0); }
    }
    pz.push({ modulo: mod, nome: 'Pannello fianco (costado)', larghezza: round(m.profondita_mm || d.d || 620), altezza: hC, spessore: m.spessore_mm || 20, materiale: 'anta', quantita: 1 });
  } else if (cat === 'pannello') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.larghezza_mm || L), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'regletta') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.latoA_mm || 30), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'lavatrice' || cat === 'lavastoviglie') {
    // Elettrodomestico: NON si tagliano carcassa/ante (è un apparecchio comprato).
    // Ma va calcolato come un modulo da 45/60 per le MISURE: occupa il suo spazio
    // (già nel conteggio moduli e nel 3D con piano sopra) e dà la sua quota di
    // ZOCCOLO, così lo zoccolo continuo della cucina ha la lunghezza giusta.
    zoccolo(pz, mod, L, H);
  } else {
    // fallback generico
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(L), altezza: H, spessore: SP, materiale: 'carcassa', quantita: 1 });
  }
  // NOME DEL MATERIALE di ogni pezzo (es. "Roble Sonoma"), come nel 3D:
  // ante del gruppo (bassi / pensili / colonne), costado alto = ante pensili,
  // zoccolo = colore zoccolo, cassetti = melaminico bianco.
  const col = progetto.coloriFronti || {};
  const alto = cat === 'costado' && (m.profondita_mm || 620) < 500;
  let idAnte = cat === 'pensile' ? col.pensile : cat === 'colonna' ? col.colonna
    : cat === 'costado' ? ((progetto.costadiDiversi && m.colore) || (alto ? (col.pensile || col.costado)
      : (col.costado || ((m.altezza_mm || 0) >= 1500 ? (col.colonna || col.base) : col.base)))) : col.base;
  // costado "come il piano di lavoro": materiale dell'encimera
  if (idAnte === '@piano') idAnte = (progetto.encimera && progetto.encimera.materiale) || null;
  const pianoStd = cat === 'costado' && idAnte === null && ((progetto.costadiDiversi && m.colore) === '@piano' || col.costado === '@piano');
  for (const p of pz) {
    p.moduloId = m.id;                                // chiave di raggruppamento univoca
    p.materialeNome = p.materiale === 'melaminico' ? 'Melaminico bianco'
      : p.materiale === 'zoccolo' ? nomeMateriale(progetto.zoccoloColore || 'nero-opaco', 'Zoccolo')
      : pianoStd ? 'Come il piano di lavoro (nero standard)' : nomeMateriale(idAnte, 'Colore da scegliere');
  }
  return pz;
}

// Gruppi SEPARATI della lista pezzi: porte, frontali, parti dei cassetti,
// costadi, reglette, pannelli, zoccoli.
const ORDINE_GRUPPI = ['Porte', 'Frontali cassetto', 'Cassetti (fondo e trasera)', 'Costadi',
  'Reglette', 'Pannelli', 'Zoccoli', 'Varie'];
function gruppoPezzo(p) {
  const n = String(p.nome).toLowerCase();
  if (n.includes('regletta')) return 'Reglette';
  if (n.includes('costado')) return 'Costadi';
  if (n.includes('fronte cassetto')) return 'Frontali cassetto';
  if (n.includes('cassetto')) return 'Cassetti (fondo e trasera)';
  if (n.includes('pannello cieco') || n.includes('anta') || n.includes('sotto forno')) return 'Porte';
  if (p.materiale === 'zoccolo' || n.includes('zoccolo')) return 'Zoccoli';
  if (n.includes('pannello') || n.includes('regletta grande')) return 'Pannelli';
  return 'Varie';
}

// Gruppi dei MODULI da ordinare (costadi, reglette e pannelli no: li facciamo noi).
const ORDINE_MODULI = ['Colonne', 'Moduli alti', 'Moduli bassi', 'Elettrodomestici'];
function gruppoModulo(cat) {
  if (cat === 'colonna') return 'Colonne';
  if (cat === 'pensile') return 'Moduli alti';
  if (cat === 'base') return 'Moduli bassi';
  if (cat === 'lavastoviglie' || cat === 'lavatrice') return 'Elettrodomestici';
  return null;
}

/**
 * Angoli a 90° dello zoccolo: dove due file di moduli a terra con direzioni
 * diverse (cucine a L / U) si toccano, lo zoccolo gira → 1 angolo.
 * Ogni fila = moduli contigui con la stessa rotazione e sulla stessa linea.
 */
function angoliZoccolo(mobili) {
  const aTerra = mobili.filter((m) => { const c = categoriaTipo(m.tipo); return c === 'base' || c === 'colonna' || c === 'lavastoviglie' || c === 'lavatrice'; });
  const rotN = (r) => ((Math.round((r || 0) / 90) * 90) % 360 + 360) % 360;
  // ingombro in pianta di ogni modulo (rettangolo allineato agli assi)
  const box = (m) => { const d = dimMobile(m); const r = rotN(m.rot) % 180 === 0; const w = r ? d.w : d.d, h = r ? d.d : d.w;
    return { x0: m.x - w / 2, x1: m.x + w / 2, y0: m.y - h / 2, y1: m.y + h / 2, rot: rotN(m.rot) }; };
  // file: unisco i moduli con la stessa rotazione che si toccano
  const file = [];
  for (const b of aTerra.map(box)) {
    const f = file.find((F) => F.rot === b.rot && F.items.some((q) => Math.max(q.x0, b.x0) - Math.min(q.x1, b.x1) < 60 && Math.max(q.y0, b.y0) - Math.min(q.y1, b.y1) < 60));
    if (f) f.items.push(b); else file.push({ rot: b.rot, items: [b] });
  }
  let angoli = 0;
  for (let i = 0; i < file.length; i++) for (let j = i + 1; j < file.length; j++) {
    if ((file[i].rot - file[j].rot + 360) % 180 === 0) continue;       // stessa direzione: niente angolo
    const tocca = file[i].items.some((a) => file[j].items.some((b) =>
      Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) < 60 && Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) < 60));
    if (tocca) angoli++;
  }
  return angoli;
}

export function calcolaDistintaCucina(progetto) {
  // Gli "oggetti" (sgabelli, decor) sono arredo, non moduli di cucina:
  // non entrano né nei moduli né nei pezzi della distinta.
  const mobili = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) !== 'oggetto');

  // 1) LISTA MODULI DA ORDINARE, per gruppo (colonne, alti, bassi, elettrodomestici).
  const modMap = new Map();
  for (const m of mobili) {
    const gruppo = gruppoModulo(categoriaTipo(m.tipo));
    if (!gruppo) continue;
    const L = dimMobile(m).w;
    const misura = m.altezza_mm ? `${m.altezza_mm}×${L}` : `${L}`;
    const key = `${gruppo}|${m.tipo}|${misura}|${m.fuoriMisura ? 1 : 0}`;
    if (!modMap.has(key)) modMap.set(key, { gruppo, nome: nomeTipo(m.tipo), misura, tipo: nomeTipo(m.tipo), fuoriMisura: !!m.fuoriMisura, quantita: 0 });
    modMap.get(key).quantita++;
  }
  const moduli = [...modMap.values()].sort((a, b) => ORDINE_MODULI.indexOf(a.gruppo) - ORDINE_MODULI.indexOf(b.gruppo));

  // 2) LISTA PEZZI DA FARE: ante/frontali e pezzi in legno nostri, aggregati per tipo+misura.
  const raw = [];
  for (const m of mobili) raw.push(...pezziDiModulo(progetto, m));
  const aggMap = new Map();
  for (const p of raw) {
    const gruppo = gruppoPezzo(p);
    const key = [gruppo, p.nome, p.larghezza, p.altezza, p.spessore, p.materiale, p.materialeNome].join('|');
    if (!aggMap.has(key)) aggMap.set(key, { gruppo, nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore, materiale: p.materiale, materialeNome: p.materialeNome, quantita: 0 });
    aggMap.get(key).quantita += p.quantita;
  }
  const pezzi = [...aggMap.values()].sort((a, b) =>
    (ORDINE_GRUPPI.indexOf(a.gruppo) - ORDINE_GRUPPI.indexOf(b.gruppo)) || (b.larghezza - a.larghezza));

  // 3) ACCESSORI da ordinare (non si tagliano).
  const acc = new Map();
  const aggiungi = (nome, q) => { if (q > 0) acc.set(nome, (acc.get(nome) || 0) + q); };
  const perId = new Map(mobili.map((m) => [m.id, m]));
  // finger-pull e maniglia scelti per gruppo (bassi / pensili / colonne)
  const grp = (cat) => (cat === 'pensile' ? 'pensile' : cat === 'colonna' ? 'colonna' : 'base');
  const fp = progetto.fingerPull;
  const conFP = (cat) => fp === true || !!(fp && typeof fp === 'object' && fp[grp(cat)]);
  const nomeManiglia = (cat) => {
    const id = (progetto.maniglie || {})[grp(cat)];
    const def = id && typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === id);
    return def ? def.nome : 'standard';
  };

  // CERNIERE: porte da 70 a 92 → 2 (110°); pensile angolo 63×63 → 2 per porta
  // a 165°; porta della colonna frigo → 4 se più alta di 1,10 m, se no 3.
  for (const p of raw) {
    if (!/^anta/i.test(p.nome)) continue;
    const m = perId.get(p.moduloId) || {};
    // pensile angolo 63×63 e Ciaflan: cerniere ad apertura grande (165°)
    if (m.tipo === 'pensile-angolo' || m.tipo === 'pensile-angolo-45' || m.tipo === 'base-angolo') { aggiungi('Cerniere 165° (angoli e Ciaflan)', 2 * p.quantita); continue; }
    // colonna frigo: la porta bassa (70 o 80) ha 2 cerniere come le altre;
    // la porta del frigo (alta) 4 se supera 1,10 m, se no 3
    if (categoriaTipo(m.tipo) === 'colonna' && (m.variante || 'porta') === 'porta' && p.altezza > 950) {
      aggiungi('Cerniere colonna frigo', (p.altezza > 1100 ? 4 : 3) * p.quantita); continue;
    }
    const n = p.altezza <= 950 ? 2 : p.altezza > 1100 ? 4 : 3;
    aggiungi('Cerniere 110°', n * p.quantita);
  }
  // CASSETTI (guide/scatola) profondità 50 cm: uno per frontale
  for (const p of raw) {
    if (!p.nome.startsWith('Fronte cassetto')) continue;
    aggiungi(`Cassetti profondità 50 cm · ${p.altezza > 155 ? 'altezza grande' : 'altezza bassa'}`, p.quantita);
  }
  // MANIGLIE: una per porta e per frontale, dove non c'è il finger-pull
  for (const p of raw) {
    if (!/^anta|^fronte cassetto/i.test(p.nome)) continue;
    const cat = categoriaTipo((perId.get(p.moduloId) || {}).tipo);
    if (conFP(cat)) continue;
    aggiungi(`Maniglie · ${nomeManiglia(cat)}`, p.quantita);
  }
  // A TERRA: piedini, grappe dello zoccolo; PENSILI: kit per appenderli
  for (const m of mobili) {
    const cat = categoriaTipo(m.tipo), L = dimMobile(m).w;
    if (cat === 'base' || cat === 'colonna') {
      aggiungi('Piedini regolabili', m.tipo === 'base-angolo' ? 6 : piediniDi(L));
      aggiungi('Grappe zoccolo (fissaggio ai piedini)', 1);
    }
    if (cat === 'pensile') aggiungi('Kit per appendere i pensili', 1);
    if (m.tipo === 'forno') aggiungi(`Griglia aerazione forno ${round(L - 3)} mm`, 1);
  }
  // la base angolo ha il suo angolo di zoccolo (interno) e non fa da fila a parte
  aggiungi('Angoli zoccolo 90°', angoliZoccolo(mobili.filter((m) => m.tipo !== 'base-angolo'))
    + mobili.filter((m) => m.tipo === 'base-angolo').length);
  const ORDINE_ACC = ['Cerniere', 'Cassetti', 'Maniglie', 'Kit', 'Piedini', 'Grappe', 'Angoli', 'Griglia'];
  const pos = (n) => { const i = ORDINE_ACC.findIndex((k) => n.startsWith(k)); return i < 0 ? 99 : i; };
  const accessori = [...acc.entries()].map(([nome, quantita]) => ({ nome, quantita })).sort((x, y) => pos(x.nome) - pos(y.nome));

  // 4) Riepilogo.
  let totalePezzi = 0, mqAnte = 0, mqZoccolo = 0, mqMelaminico = 0;
  for (const p of pezzi) {
    totalePezzi += p.quantita;
    const mq = (p.larghezza * p.altezza * p.quantita) / 1e6;
    if (p.materiale === 'zoccolo') mqZoccolo += mq;
    else if (p.materiale === 'melaminico') mqMelaminico += mq;
    else mqAnte += mq;
  }
  const piedini = acc.get('Piedini regolabili') || 0;
  const cerniere = [...acc.entries()].filter(([k]) => k.startsWith('Cerniere')).reduce((t, [, v]) => t + v, 0);

  return {
    moduli,
    pezzi,
    accessori,
    gruppiOrdine: ORDINE_GRUPPI,
    gruppiModuli: ORDINE_MODULI,
    riepilogo: { moduli: moduli.reduce((t, m) => t + m.quantita, 0), totalePezzi, mqAnte, mqZoccolo, mqMelaminico, piedini, cerniere },
  };
}
