// =============================================================================
// DISTINTA DI TAGLIO DELLA CUCINA
// =============================================================================
// Per ogni modulo in scena calcola i suoi pezzi componenti (fianchi, fondo,
// schiena, ripiani, ante/fronti, zoccolo, regletta d'angolo, ...), come nella
// distinta dell'armadio. Solo calcolo: il rendering tabella sta in main.js.
//
// Ogni pezzo: { modulo, nome, larghezza, altezza, spessore, materiale, quantita }
//   materiale: 'carcassa' | 'anta' | 'schiena' | 'zoccolo'
// =============================================================================

import {
  categoriaTipo, dimMobile, nomeTipo, anteDiMobile, infoAngoloCieco,
} from './modello.js?v=20261111s';

const SP = 18;        // pannelli carcassa e ante/fronti (mm)
const SP_SK = 4;      // schiena (mm)
const SP_MEL = 16;    // melaminico bianco (fondo + trasera cassetto) (mm)
const THK_REG = 20;   // spessore regletta d'angolo (mm)
const round = (n) => Math.round(n);
const zoccoloH = (h) => (h >= 800 ? 100 : 150);

// Dimensioni di UN'anta/fronte: N ante su larghezza L, altezza H (come il 3D:
// 3 mm di fuga totale in larghezza, 2 mm in altezza, 3 mm tra le ante).
function dimAnta(L, H, N) {
  const uw = L - 3;
  const pw = (uw - (N - 1) * 3) / N;
  return { w: round(pw), h: round(H - 2) };
}

// --- costruttori per categoria ------------------------------------------------

// Carcassa comune di una base/pensile a muro: fianchi + fondo + schiena.
function carcassa(pz, mod, L, H, prof, conReggitop) {
  pz.push({ modulo: mod, nome: 'Fianco', larghezza: prof, altezza: H, spessore: SP, materiale: 'carcassa', quantita: 2 });
  if (conReggitop) {
    // Base: niente cielo pieno (c'è il piano di lavoro sopra), ma 2 traverse.
    pz.push({ modulo: mod, nome: 'Fondo', larghezza: round(L - 2 * SP), altezza: prof, spessore: SP, materiale: 'carcassa', quantita: 1 });
    pz.push({ modulo: mod, nome: 'Reggitop (traversa)', larghezza: round(L - 2 * SP), altezza: 100, spessore: SP, materiale: 'carcassa', quantita: 2 });
  } else {
    // Pensile/colonna: top e fondo pieni.
    pz.push({ modulo: mod, nome: 'Top / Fondo', larghezza: round(L - 2 * SP), altezza: prof, spessore: SP, materiale: 'carcassa', quantita: 2 });
  }
  pz.push({ modulo: mod, nome: 'Schiena', larghezza: round(L - 2), altezza: round(H - 2), spessore: SP_SK, materiale: 'schiena', quantita: 1 });
}

function ripiani(pz, mod, L, prof, n) {
  if (n <= 0) return;
  pz.push({ modulo: mod, nome: 'Ripiano', larghezza: round(L - 2 * SP - 2), altezza: round(prof - 20), spessore: SP, materiale: 'carcassa', quantita: n });
}

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

  if (cat === 'base') {
    const prof = d.d || 600;                         // 600
    const profCassa = prof - 20;                     // la cassa è un po' più corta dell'anta
    if (m.tipo === 'base-cassetti') {
      carcassa(pz, mod, L, H, profCassa, true);
      zoccolo(pz, mod, L, H);
      const nc = Math.max(1, m.cassetti || 3);
      const hf = round((H - (nc - 1) * 3) / nc - 2);   // altezza del fronte cassetto
      pz.push({ modulo: mod, nome: 'Fronte cassetto', larghezza: round(L - 3), altezza: hf, spessore: SP, materiale: 'anta', quantita: nc });
      // Fondo e trasera del cassetto in MELAMINICO BIANCO.
      // Misure FISSE: fondo prof. 480 · trasera 59 (cassetto basso) o 155 (alto).
      // Misura VARIABILE: la lunghezza, in base al modulo (fondo = L−53, trasera = L−72).
      cassettoMelaminico(pz, mod, L, hf, nc);
    } else if (m.tipo === 'forno') {
      carcassa(pz, mod, L, H, profCassa, true);
      zoccolo(pz, mod, L, H);
      // niente ante: vano forno
    } else {
      // base-ante / lavello
      carcassa(pz, mod, L, H, profCassa, true);
      zoccolo(pz, mod, L, H);
      if (m.tipo !== 'lavello') ripiani(pz, mod, L, profCassa, 1);
      const N = m.tipo === 'lavello' ? (L >= 900 ? 2 : 1) : anteDiMobile(m);
      anteModulo(pz, mod, L, H, N, m.antaLato);
      reglettaAngolo(pz, mod, progetto, m, H);
    }
  } else if (cat === 'pensile') {
    if (m.tipo === 'pensile-angolo' || m.tipo === 'pensile-angolo-45') {
      // L / Ciaflan: due bracci, due ante. Semplificato (63×63, prof 35).
      const prof = 350;
      pz.push({ modulo: mod, nome: 'Fianco', larghezza: prof, altezza: H, spessore: SP, materiale: 'carcassa', quantita: 2 });
      pz.push({ modulo: mod, nome: 'Cielo / Fondo', larghezza: round(L - SP), altezza: prof, spessore: SP, materiale: 'carcassa', quantita: 2 });
      pz.push({ modulo: mod, nome: 'Schiena', larghezza: round(L - 2), altezza: round(H - 2), spessore: SP_SK, materiale: 'schiena', quantita: 2 });
      const aw = m.tipo === 'pensile-angolo-45' ? round(L * 0.5) : round(L - 350);
      pz.push({ modulo: mod, nome: 'Anta', larghezza: Math.max(100, aw), altezza: round(H - 2), spessore: SP, materiale: 'anta', quantita: m.tipo === 'pensile-angolo-45' ? 1 : 2 });
    } else {
      const prof = 350;
      const profCassa = prof - 20;
      carcassa(pz, mod, L, H, profCassa, false);
      ripiani(pz, mod, L, profCassa, 1);
      // Pensile 70/90: con l'anta sporgente la porta è 72/92 (H + 20), altrimenti H − 2.
      const sporg = pensileAntaSporge(progetto.antaPensile, H);
      anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, sporg ? H + 20 : null, sporg);
    }
  } else if (cat === 'colonna') {
    const prof = (d.d || 600) - 20;
    carcassa(pz, mod, L, H, prof, false);
    // Variante "vano aperto": 2 ripiani (sotto e sopra il vano); altrimenti 4.
    ripiani(pz, mod, L, prof, m.variante === 'vano' ? 2 : 4);
    // Zoccolo della colonna: segue la porta bassa (70→150, 80→100), come i mobili bassi.
    zoccolo(pz, mod, L, m.altezzaBassa_mm || 700);
    // Due ante reali: sotto = porta bassa − 2 (come il mobile base 70/80),
    // sopra = lo spazio che resta − 2 (tolto forno/microonde/vano, come nel 3D).
    const ab = m.altezzaBassa_mm || 700;
    const aw = round(L - 3);                        // larghezza anta (1 anta)
    const topDoor = restoAntaColonna(m, H - ab);
    pz.push({ modulo: mod, nome: 'Anta bassa', larghezza: aw, altezza: round(ab - 2), spessore: SP, materiale: 'anta', quantita: 1 });
    if (topDoor > 60) pz.push({ modulo: mod, nome: 'Anta alta', larghezza: aw, altezza: round(topDoor - 2), spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'costado') {
    pz.push({ modulo: mod, nome: 'Pannello fianco (costado)', larghezza: round(m.profondita_mm || d.d || 620), altezza: H, spessore: m.spessore_mm || 20, materiale: 'anta', quantita: 1 });
  } else if (cat === 'pannello') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.larghezza_mm || L), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'regletta') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.latoA_mm || 30), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'lavatrice') {
    // Elettrodomestico: NON si tagliano carcassa/ante (è un apparecchio comprato).
    // Ma va calcolato come un modulo da 45/60 per le MISURE: occupa il suo spazio
    // (già nel conteggio moduli e nel 3D con piano sopra) e dà la sua quota di
    // ZOCCOLO, così lo zoccolo continuo della cucina ha la lunghezza giusta.
    zoccolo(pz, mod, L, H);
  } else {
    // fallback generico
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(L), altezza: H, spessore: SP, materiale: 'carcassa', quantita: 1 });
  }
  for (const p of pz) p.moduloId = m.id;             // chiave di raggruppamento univoca
  return pz;
}

// Categoria del pezzo per la lista raggruppata (ante, reglette, costadi, ...).
const ORDINE_GRUPPI = ['Ante / Fronti', 'Reglette', 'Costadi', 'Pannelli',
  'Fianchi', 'Top / Fondi', 'Ripiani', 'Schiene', 'Zoccoli', 'Cassetti', 'Varie'];
function gruppoPezzo(p) {
  const n = String(p.nome).toLowerCase();
  if (n.includes('regletta')) return 'Reglette';
  if (n.includes('costado')) return 'Costadi';
  if (n.includes('pannello cieco') || n.includes('anta') || n.includes('fronte cassetto')) return 'Ante / Fronti';
  if (n.includes('pannello di copertura')) return 'Pannelli';
  if (n.includes('cassetto')) return 'Cassetti';
  if (n.includes('fianco')) return 'Fianchi';
  if (n.includes('ripiano')) return 'Ripiani';
  if (n.includes('schiena')) return 'Schiene';
  if (n.includes('zoccolo')) return 'Zoccoli';
  if (n.includes('fondo') || n.includes('top') || n.includes('reggitop') || n.includes('cielo')) return 'Top / Fondi';
  return 'Varie';
}

export function calcolaDistintaCucina(progetto) {
  const mobili = (progetto.mobiliLiberi || []);

  // 1) LISTA MODULI: aggrega i moduli uguali (stessa etichetta + tipo).
  const modMap = new Map();
  for (const m of mobili) {
    const L = dimMobile(m).w;
    const nome = `Modulo da ${m.altezza_mm ? `${m.altezza_mm}×${L}` : L}`;
    const key = `${nome}|${m.tipo}|${m.fuoriMisura ? 1 : 0}`;
    if (!modMap.has(key)) modMap.set(key, { nome, tipo: nomeTipo(m.tipo), fuoriMisura: !!m.fuoriMisura, quantita: 0 });
    modMap.get(key).quantita++;
  }
  const moduli = [...modMap.values()];

  // 2) LISTA PEZZI: tutti i pezzi di tutti i moduli, aggregati per tipo+misura.
  const raw = [];
  for (const m of mobili) raw.push(...pezziDiModulo(progetto, m));
  const aggMap = new Map();
  for (const p of raw) {
    const gruppo = gruppoPezzo(p);
    const key = [gruppo, p.nome, p.larghezza, p.altezza, p.spessore, p.materiale].join('|');
    if (!aggMap.has(key)) aggMap.set(key, { gruppo, nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore, materiale: p.materiale, quantita: 0 });
    aggMap.get(key).quantita += p.quantita;
  }
  const pezzi = [...aggMap.values()].sort((a, b) =>
    (ORDINE_GRUPPI.indexOf(a.gruppo) - ORDINE_GRUPPI.indexOf(b.gruppo)) || (b.larghezza - a.larghezza));

  // 3) Riepilogo.
  let totalePezzi = 0, mqCarcassa = 0, mqAnte = 0, mqSchiena = 0, mqMelaminico = 0;
  for (const p of pezzi) {
    totalePezzi += p.quantita;
    const mq = (p.larghezza * p.altezza * p.quantita) / 1e6;
    if (p.materiale === 'schiena') mqSchiena += mq;
    else if (p.materiale === 'anta') mqAnte += mq;
    else if (p.materiale === 'melaminico') mqMelaminico += mq;
    else mqCarcassa += mq;                            // carcassa + zoccolo
  }

  return {
    moduli,
    pezzi,
    gruppiOrdine: ORDINE_GRUPPI,
    riepilogo: { moduli: mobili.length, totalePezzi, mqCarcassa, mqAnte, mqSchiena, mqMelaminico },
  };
}
