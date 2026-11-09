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
} from './modello.js?v=20261109r';

const SP = 18;        // pannelli carcassa e ante/fronti (mm)
const SP_SK = 4;      // schiena (mm)
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

function anteModulo(pz, mod, L, H, N, lato) {
  const a = dimAnta(L, H, N);
  const nota = N === 1 ? ` (apertura ${lato === 'sx' ? 'sx' : 'dx'})` : '';
  pz.push({ modulo: mod, nome: `Anta${nota}`, larghezza: a.w, altezza: a.h, spessore: SP, materiale: 'anta', quantita: N });
}

function zoccolo(pz, mod, L, H) {
  pz.push({ modulo: mod, nome: 'Zoccolo (frontale)', larghezza: round(L), altezza: zoccoloH(H), spessore: SP, materiale: 'zoccolo', quantita: 1 });
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
  const mod = `#${m.id} ${nomeTipo(m.tipo)} · ${L}${m.altezza_mm ? '×' + m.altezza_mm : ''}`
    + (m.fuoriMisura ? ' ⚠ da tagliare' : '');
  const pz = [];

  if (cat === 'base') {
    const prof = d.d || 600;                         // 600
    const profCassa = prof - 20;                     // la cassa è un po' più corta dell'anta
    if (m.tipo === 'base-cassetti') {
      carcassa(pz, mod, L, H, profCassa, true);
      zoccolo(pz, mod, L, H);
      const nc = Math.max(1, m.cassetti || 3);
      const hf = round((H - (nc - 1) * 3) / nc - 2);
      pz.push({ modulo: mod, nome: 'Fronte cassetto', larghezza: round(L - 3), altezza: hf, spessore: SP, materiale: 'anta', quantita: nc });
      // scatola cassetto (semplificata)
      pz.push({ modulo: mod, nome: 'Cassetto · fianco', larghezza: round(profCassa - 30), altezza: 120, spessore: SP, materiale: 'carcassa', quantita: 2 * nc });
      pz.push({ modulo: mod, nome: 'Cassetto · fondo/schiena', larghezza: round(L - 2 * SP - 30), altezza: 120, spessore: SP, materiale: 'carcassa', quantita: 2 * nc });
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
      anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato);
    }
  } else if (cat === 'colonna') {
    const prof = (d.d || 600) - 20;
    carcassa(pz, mod, L, H, prof, false);
    ripiani(pz, mod, L, prof, 4);
    zoccolo(pz, mod, L, 700);
    // due ante (sopra/sotto) sulla colonna
    const a = dimAnta(L, H / 2, 1);
    pz.push({ modulo: mod, nome: 'Anta', larghezza: a.w, altezza: a.h, spessore: SP, materiale: 'anta', quantita: 2 });
  } else if (cat === 'costado') {
    pz.push({ modulo: mod, nome: 'Pannello fianco (costado)', larghezza: round(m.profondita_mm || d.d || 600), altezza: H, spessore: m.spessore_mm || 20, materiale: 'anta', quantita: 1 });
  } else if (cat === 'pannello') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.larghezza_mm || L), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'regletta') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.latoA_mm || 30), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else {
    // fallback generico
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(L), altezza: H, spessore: SP, materiale: 'carcassa', quantita: 1 });
  }
  return pz;
}

export function calcolaDistintaCucina(progetto) {
  const mobili = (progetto.mobiliLiberi || []);
  const pezzi = [];
  for (const m of mobili) pezzi.push(...pezziDiModulo(progetto, m));

  let totalePezzi = 0, mqCarcassa = 0, mqAnte = 0, mqSchiena = 0;
  for (const p of pezzi) {
    totalePezzi += p.quantita;
    const mq = (p.larghezza * p.altezza * p.quantita) / 1e6;
    if (p.materiale === 'schiena') mqSchiena += mq;
    else if (p.materiale === 'anta') mqAnte += mq;
    else mqCarcassa += mq;                            // carcassa + zoccolo
  }
  return {
    pezzi,
    riepilogo: {
      moduli: mobili.length,
      totalePezzi,
      mqCarcassa, mqAnte, mqSchiena,
    },
  };
}
