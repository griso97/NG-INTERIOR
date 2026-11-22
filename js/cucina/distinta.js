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
  infoTavolo, spessoreTavolo, moduloDaOrdinare, PROFONDITA_PENSILE, categoriaTipo, dimMobile, nomeTipo, anteDiMobile, infoAngoloCieco, portaBassaColonna, frontiCassetti, anteBaseAngolo, fasceCierreTecho, pannelliSottoPonte, spessorePannelloPonte, pontiSopra, sceltePorte, sceltePorteGruppo, golaSuMobile, golaProgetto, altezzaAntaGola, spazioGola, profiliGola, barreGola, nomeColoreGola, pezziColonnaMisura, ripianiColonnaMisura, pezziCorniceVano, altezzaVanoColonna, apertoDi, pezziMobileAperto, latoApertoDi, coloreParteAperto, ledStrisceAperto,
  costadoCopreAnte,
} from './modello.js?v=20261123q';
import { parametri, tipoCassetto } from '../parametri.js?v=20261123q';
import { nomeFinituraManiglia } from '../finiture-maniglia.js?v=20261123q';

const SP = 18;        // ante/fronti e pannelli (mm)
const THK_REG = 20;   // spessore regletta d'angolo (mm)
const round = (n) => Math.round(n);
const zoccoloH = (h) => (h >= 800 ? 100 : 150);
const GRIGLIA_FORNO = 45, H_FORNO_INCASSO = 595;   // come nel 3D (scena3d.js)
// Piedini: 4 per modulo a terra, 6 se è più largo di 90 cm
const piediniDi = (L) => (L > 900 ? 6 : 4);

// Dimensioni di UN'anta/fronte: N ante su larghezza L, altezza H, con l'ARIA dei
// ⚙ Parametri (di partenza: 3 mm in larghezza, 2 in altezza, 3 tra le ante; come il 3D).
// rJ = spessore del profilo a J sopra l'anta (0 se la maniglia non è a J).
function dimAnta(L, H, N, rJ = 0) {
  const A = parametri().ante;
  const uw = L - A.ariaLarghezza;
  const pw = (uw - (N - 1) * A.ariaTraAnte) / N;
  return { w: round(pw), h: round(H - A.ariaAltezza - rJ) };
}
const ariaH = () => parametri().ante.ariaAltezza, ariaL = () => parametri().ante.ariaLarghezza;
/** Maniglia a J (profilo sopra l'anta) con queste scelte di porta? → di quanto si accorcia l'anta (mm). */
/** Come si chiama la maniglia che accorcia l'anta (per la distinta). */
let _nomeRid = 'maniglia a J';
function riduzioneJ(scelte) {
  if (!scelte || scelte.fp || scelte.push) return 0;
  const def = scelte.maniglia && typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === scelte.maniglia);
  if (!def || !['profilo', 'bordol'].includes(def.forma)) return 0;      // a J o profilo sul bordo
  _nomeRid = def.forma === 'bordol' ? 'maniglia sul bordo' : 'maniglia a J';
  return Number(def.spessoreJ) > 0 ? Number(def.spessoreJ) : parametri().manigliaJ.spessore;
}

// --- costruttori per categoria ------------------------------------------------

/** MOBILE A GIORNO, fatto a pezzi: ogni pezzo nel suo colore (come le ante, melaminico come la
 *  struttura o un altro materiale). */
function mobileAperto(pz, mod, progetto, m) {
  const H = m.altezza_mm || 700;
  const hTot = H + (categoriaTipo(m.tipo) === 'pensile' && pensileAntaSporge(progetto.antaPensile, H) ? 20 : 0);
  for (const p of pezziMobileAperto(m, latoApertoDi(progetto, m), hTot)) {
    const { parte, ...x } = p;
    const c = coloreParteAperto(m, parte);
    pz.push({ modulo: mod, ...x, aperto: true,
      materiale: c === 'struttura' ? 'melaminico' : 'anta',
      ...(c !== 'ante' && c !== 'struttura' ? { materialeNome: nomeMateriale(c, 'Materiale da scegliere') } : {}) });
  }
}

// L'anta del pensile sporge 2 cm sotto (70→72, 90→92) con l'opzione attiva.
function pensileAntaSporge(opt, h) {
  if (opt === 'sporg70') return Math.abs(h - 700) < 40;
  if (opt === 'sporg90') return Math.abs(h - 900) < 40;
  return false;
}

const NOMI_VETRO = { trasparente: 'trasparente', satinato: 'satinato', fume: 'fumé' };
function anteModulo(pz, mod, L, H, N, lato, altAnta, sporg, vetrina, rJ = 0, extra = '') {
  if (sporg) rJ = 0;                                  // anta sporgente: si apre da sotto, niente maniglia
  const a = dimAnta(L, H, N, rJ);
  const nota = (N === 1 ? ` (apertura ${lato === 'alto' ? "verso l'alto" : lato === 'sx' ? 'sx' : 'dx'})` : '') + (sporg ? ' sporgente' : '') + extra;
  if (vetrina) {
    // ANTA VETRINA: telaio in legno (si fresa il vano e si mette il vetro) o telaio alluminio/nero da ordinare
    const ah = altAnta != null ? altAnta : a.h, vt = NOMI_VETRO[vetrina.vetro] || 'trasparente';
    if ((vetrina.telaio || 'legno') === 'legno') {
      pz.push({ modulo: mod, nome: `Anta vetrina${nota} (telaio 50 mm, vano vetro da fresare)`, larghezza: a.w, altezza: ah, spessore: SP, materiale: 'anta', quantita: N,
        vetro: { w: Math.max(10, a.w - 80), h: Math.max(10, ah - 80), tipo: vt } });
    } else {
      const tel = vetrina.telaio === 'nero' ? 'nero' : 'alluminio';
      pz.push({ modulo: mod, nome: `Anta vetrina${nota} telaio ${tel} + vetro ${vt} (da ordinare)`, larghezza: a.w, altezza: ah, spessore: 20, materiale: 'vetrina', quantita: N,
        materialeNome: `Telaio ${tel} + vetro ${vt}` });
    }
    return;
  }
  pz.push({ modulo: mod, nome: `Anta${nota}${rJ ? ` · ${_nomeRid} (−${rJ} mm)` : ''}`, larghezza: a.w, altezza: altAnta != null ? altAnta : a.h, spessore: SP, materiale: 'anta', quantita: N });
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
  if (m.variante === 'vano') return rem - altezzaVanoColonna(m, rem);   // porta alta = resto − vano
  return rem; // porta unica
}

// Fondo + trasera del cassetto in MELAMINICO (guide metalliche: niente sponde di
// legno), con le misure del SISTEMA DI CASSETTI dei ⚙ Parametri (di partenza:
// fondo = L − 53 × 480; trasera = L − 72, alta 59 sul cassetto piccolo, 155 sul grande).
// `hCassetto` = altezza del fronte: dice se il cassetto è piccolo, medio o grande.
function cassettoMelaminico(pz, mod, L, hCassetto, nc) {
  const c = parametri().cassetti, t = tipoCassetto(hCassetto);
  pz.push({ modulo: mod, nome: 'Cassetto · fondo', larghezza: round(L - c.fondoMeno), altezza: round(c.fondoProfondita), spessore: c.spessore, materiale: 'melaminico', quantita: nc });
  pz.push({ modulo: mod, nome: `Cassetto · trasera ${t.tipo}`, larghezza: round(L - c.traseraMeno), altezza: round(t.trasera), spessore: c.spessore, materiale: 'melaminico', quantita: nc });
}

// Regletta d'angolo (o pannello cieco) sul modulo "cieco" dell'angolo.
function reglettaAngolo(pz, mod, progetto, m, H) {
  if (progetto.autoRegletta === false) return;
  const info = infoAngoloCieco(progetto, m);
  if (!info) return;
  // alti come le ANTE e i cassetti accanto (con la gola sotto il profilo: 700 → 675)
  const hF = golaSuMobile(progetto, m) ? altezzaAntaGola(H) : round(H - ariaH());
  if (info.coperto) {
    pz.push({ modulo: mod, nome: 'Pannello cieco (angolo)', larghezza: round(info.coveredW || 0), altezza: hF, spessore: SP, materiale: 'anta', quantita: 1 });
  } else {
    const ra = progetto.reglettaAngolo || {};
    const vis = (info.gap != null && info.gap > 0) ? Math.max(ra.spessore || 18, info.gap) : (ra.base || 30);
    pz.push({ modulo: mod, nome: 'Regletta angolo (braccio)', larghezza: round(vis), altezza: hF, spessore: THK_REG, materiale: 'anta', quantita: 2 });
  }
}

/** Melaminico dell'INTERNO degli armadi (scelto nel 3D): bianco o antracite. */
function nomeInterno(progetto) { return progetto.coloreInterno === 'antracite' ? 'Melaminico antracite' : 'Melaminico bianco'; }

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
  const odM = moduloDaOrdinare(m);
  // MOBILE APERTO: lo facciamo noi a pezzi, alla misura vera (niente modulo da ordinare né da tagliare)
  const latoAp = apertoDi(m) ? latoApertoDi(progetto, m) : null;
  const hAp = H + (cat === 'pensile' && pensileAntaSporge(progetto.antaPensile, H) ? 20 : 0);   // con le ante da 72 / 92
  const mod = apertoDi(m)
    ? `Mobile a giorno ${hAp}×${L}${latoAp ? ` · senza fianco ${latoAp === 'dx' ? 'destro' : 'sinistro'}` : ''}`
    : `Modulo da ${m.altezza_mm ? `${m.altezza_mm}×${L}` : L}`
    + (odM ? ` ⚠ (modulo da ${odM.ordina} tagliato a ${L})` : m.fuoriMisura ? ' ⚠ da tagliare' : '');
  const pz = [];
  // aria delle ante (⚙ Parametri) e maniglia a J: l'anta si accorcia dello spessore del profilo
  const aH = ariaH(), aL = ariaL(), scP = sceltePorte(progetto, m), rJ = riduzioneJ(scP);
  // GOLA in alluminio: l'anta parte 25 mm sotto il piano (profilo L), fra i cassetti 25 mm (profilo C)
  const gola = golaSuMobile(progetto, m), altG = gola ? altezzaAntaGola(H) : null, GN = gola ? ' · gola' : '';

  if (cat === 'base' && m.tipo === 'base-angolo') {
    // BASE ANGOLO a L: 2 ante larghe come quelle del pensile angolo
    // (larghezza − profondità bassi = 280), alte come la base (−2 mm);
    // zoccolo sulle due facce interne (arretrato 5 cm: +50 per lato)
    const { a, b } = anteBaseAngolo(m);
    for (const aw of a === b ? [a] : [a, b]) {
      const q = a === b ? 2 : 1;
      pz.push({ modulo: mod, nome: 'Anta (base angolo)' + GN, larghezza: Math.max(1, aw), altezza: gola ? altG : round(H - aH - rJ), spessore: SP, materiale: 'anta', quantita: q });
      pz.push({ modulo: mod, nome: 'Zoccolo (frontale)', larghezza: Math.max(1, aw) + 50, altezza: zoccoloH(H), spessore: SP, materiale: 'zoccolo', quantita: q });
    }
  } else if (cat === 'base') {
    // carcassa, ripiani e cassetti interni: già nel modulo (non si tagliano)
    zoccolo(pz, mod, L, H);
    if (m.tipo === 'base-cassetti') {
      const nc = Math.max(1, m.cassetti || 3);
      // FUGHE: una in più dei cassetti, da 2 mm; frontali per difetto. Tutti
      // uguali, oppure uno piccolo in alto e gli altri uguali.
      const alt = frontiCassetti(H, nc, m.cassettoPiccolo_mm, gola);
      const perH = new Map(); alt.forEach((h) => perH.set(h, (perH.get(h) || 0) + 1));
      for (const [hf, q] of perH) {
        const piccolo = m.cassettoPiccolo_mm && alt.length > 1 && hf === alt[0] && hf !== alt[1];
        const hJ = hf - rJ;                          // con la maniglia a J il frontale si accorcia
        pz.push({ modulo: mod, nome: (piccolo ? 'Fronte cassetto piccolo' : 'Fronte cassetto') + GN + (rJ ? ` · ${_nomeRid} (−${rJ} mm)` : ''), larghezza: round(L - aL), altezza: hJ, spessore: SP, materiale: 'anta', quantita: q });
        // parti per fare i cassetti: fondo e trasera in melaminico (sistema dei ⚙ Parametri)
        cassettoMelaminico(pz, mod, L, hJ, q);
      }
    } else if (m.tipo === 'forno') {
      // sotto il forno un pannello del colore delle ante (griglia sopra = accessorio)
      // con la gola il forno sta subito sotto la gola (l'aria passa dalla gola: niente griglia)
      const hp = gola ? round(H - spazioGola() - H_FORNO_INCASSO - 3) : round(H - aH - GRIGLIA_FORNO - 3 - H_FORNO_INCASSO - 3);
      if (hp > 15) pz.push({ modulo: mod, nome: 'Pannello sotto forno', larghezza: round(L - aL), altezza: hp, spessore: SP, materiale: 'anta', quantita: 1 });
    } else {
      // base-ante / lavello
      const N = m.tipo === 'lavello' ? (L >= 600 ? 2 : 1) : anteDiMobile(m);
      if (apertoDi(m)) mobileAperto(pz, mod, progetto, m);          // APERTO: niente ante
      else anteModulo(pz, mod, L, H, N, m.antaLato, altG, false, m.tipo === 'base-ante' ? m.vetrina : null, rJ, GN);
      reglettaAngolo(pz, mod, progetto, m, H);
    }
  } else if (cat === 'pensile') {
    if (m.tipo === 'pensile-angolo' || m.tipo === 'pensile-angolo-45') {
      const aw = m.tipo === 'pensile-angolo-45' ? round(L * 0.5) : round(L - PROFONDITA_PENSILE);   // 63 − 33 = 30
      pz.push({ modulo: mod, nome: 'Anta', larghezza: Math.max(100, aw), altezza: round(H - aH - rJ), spessore: SP, materiale: 'anta', quantita: m.tipo === 'pensile-angolo-45' ? 1 : 2 });
    } else {
      // Pensile 70/90: con l'anta sporgente la porta è 72/92 (H + 20), altrimenti H − 2.
      const sporg = pensileAntaSporge(progetto.antaPensile, H);
      if (apertoDi(m)) mobileAperto(pz, mod, progetto, m);          // APERTO: niente ante
      else anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, sporg ? H + 20 : null, sporg, m.vetrina, rJ);
    }
  } else if (cat === 'colonna') {
    // Zoccolo della colonna: segue la porta bassa (70→150, 80→100), come i mobili bassi.
    const abC = portaBassaColonna(progetto, m);      // alta come i mobili bassi
    zoccolo(pz, mod, L, abC);
    // Due ante reali: sotto = porta bassa − 2 (come il mobile base 70/80),
    // sopra = lo spazio che resta − 2 (tolto forno/microonde/vano, come nel 3D).
    const ab = abC;
    const aw = round(L - aL);                       // larghezza anta (1 anta)
    const topDoor = restoAntaColonna(m, H - ab);
    // ogni porta con le SUE scelte (porta normale / finger-pull, maniglia / push, verso)
    const g = progetto.fingerPull, pu = progetto.push || {};
    const fpGr = g === true || !!(g && typeof g === 'object' && g.colonna), pushGr = !!pu.colonna;
    const porta = (chiave, nome, alt) => {
      const o = (m.porte && m.porte[chiave]) || {};
      const fpP = o.fp != null ? !!o.fp : fpGr, pushP = o.push != null ? !!o.push : pushGr;
      const lato = o.lato || (m.antaLato === 'sx' ? 'sx' : 'dx');
      const rJp = riduzioneJ({ ...scP, fp: fpP, push: pushP });
      const desc = ` (apertura ${lato === 'alto' ? "verso l'alto" : lato}${fpP ? ' · finger-pull' : ''}${pushP ? ' · push' : ''}${rJp ? ` · ${_nomeRid} (−${rJp} mm)` : ''})`;
      if (o.vetro) {
        // PORTA IN VETRO: come le ante vetrina dei pensili (telaio in legno con il vano per il vetro, o telaio da ordinare)
        const ah = round(alt - rJp), vt = NOMI_VETRO[o.vetro.vetro] || 'trasparente';
        if ((o.vetro.telaio || 'legno') === 'legno') pz.push({ modulo: mod, nome: `${nome} vetrina (telaio 50 mm, vano vetro da fresare)${desc}`, larghezza: aw, altezza: ah, spessore: SP, materiale: 'anta', quantita: 1, lato,
          vetro: { w: Math.max(10, aw - 80), h: Math.max(10, ah - 80), tipo: vt } });
        else { const tel = o.vetro.telaio === 'nero' ? 'nero' : 'alluminio'; pz.push({ modulo: mod, nome: `${nome} vetrina telaio ${tel} + vetro ${vt} (da ordinare)${desc}`, larghezza: aw, altezza: ah, spessore: 20, materiale: 'vetrina', quantita: 1, lato, materialeNome: `Telaio ${tel} + vetro ${vt}` }); }
        return;
      }
      pz.push({ modulo: mod, nome: `${nome}${desc}`, larghezza: aw, altezza: round(alt - rJp), spessore: SP, materiale: 'anta', quantita: 1, fp: fpP, push: pushP, lato });
    };
    if (m.variante === 'intera') porta('intera', 'Anta intera', H - aH);   // PORTA INTERA: una sola, da terra in cima
    else {
      porta('bassa', 'Anta bassa', ab - aH);
      if (topDoor > 60) porta('alta', 'Anta alta', topDoor - aH);
    }
    // COLONNA SU MISURA: la struttura la facciamo noi → tutti i pezzi (montaggio 2)
    if (m.tipo === 'colonna-misura') {
      for (const p of pezziColonnaMisura(m)) {
        pz.push({ modulo: mod, ...p, materiale: 'carcassa', struttura: true,
          ...(m.struttura === 'bianco' ? { materialeNome: nomeInterno(progetto) } : {}) });
      }
    }
    // VANO APERTO: cornice nel colore delle ante (ripiani, listelli, fianchetti): la struttura non si vede
    if (m.variante === 'vano') {
      for (const p of pezziCorniceVano(m, altezzaVanoColonna(m, H - ab), SP)) pz.push({ modulo: mod, ...p, materiale: 'anta', cornice: true });
    }
  } else if (cat === 'tavolo') {
    // PIANO / TAVOLO: la lastra e i suoi appoggi (dove il piano è libero)
    const enc = progetto.encimera && progetto.encimera.materiale;
    const spTop = (Number(progetto.encimera && progetto.encimera.spessore) > 0 ? Number(progetto.encimera.spessore)
      : (() => { const def = enc && typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === enc); return def && def.spessore != null ? def.spessore : 40; })())
      * Math.max(1, Math.min(3, Number(progetto.encimera && progetto.encimera.strati) || 1));
    const info = infoTavolo(progetto, m, spTop);
    // pannelli uno sopra l'altro: ogni strato è un pezzo (spessore di un pannello)
    const strati = Math.max(1, Math.min(3, m.strati || 1)), sp = Math.max(6, m.spessore_mm || 40), P = m.profondita_mm || 900;
    const nomeMat = m.materiale ? nomeMateriale(m.materiale, 'Materiale da scegliere') : nomeMateriale(enc, 'Come il piano di lavoro');
    const modT = `Piano / tavolo ${L}×${P}`;
    pz.push({ modulo: modT, nome: strati > 1 ? `Piano / tavolo (${strati} pannelli incollati)` : 'Piano / tavolo', larghezza: round(L), altezza: round(P), spessore: sp, materiale: 'tavolo', quantita: strati, materialeNome: nomeMat });
    const app = m.appoggio || 'cascata';
    const liberi = info.estremi.filter((x) => x.libero).length;
    const n = app === 'cascata-due' ? 2 : app === 'nessuno' ? 0 : liberi;
    const hG = round(info.gamba);
    if (n && hG > 30) {
      if (app === 'cascata' || app === 'cascata-due') pz.push({ modulo: modT, nome: strati > 1 ? `Fianco a cascata (${strati} pannelli incollati)` : 'Fianco a cascata', larghezza: round(P), altezza: hG, spessore: sp, materiale: 'tavolo', quantita: n * strati, materialeNome: nomeMat });
      else if (app === 'vetro') pz.push({ modulo: modT, nome: 'Gamba in vetro (da ordinare)', larghezza: Math.max(100, round(P - 160)), altezza: hG, spessore: 12, materiale: 'vetro', quantita: n, materialeNome: 'Vetro temperato extrachiaro 12 mm' });
      else if (app === 'una-nera' || app === 'una-oro') pz.push({ modulo: modT, nome: 'Gamba 80×80 (da ordinare)', larghezza: 80, altezza: hG, spessore: 80, materiale: 'gambe', quantita: n, materialeNome: app === 'una-oro' ? 'Metallo ottone' : 'Metallo nero' });
      else pz.push({ modulo: modT, nome: 'Gamba 50×50 (da ordinare)', larghezza: 50, altezza: hG, spessore: 50, materiale: 'gambe', quantita: n * 2, materialeNome: app === 'gambe-oro' ? 'Metallo ottone' : 'Metallo nero' });
    }
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
    // accanto ai mobili il costado copre anche le ante (2 cm oltre la cassa): misura vera da tagliare
    pz.push({ modulo: mod, nome: 'Pannello fianco (costado)', larghezza: round((m.profondita_mm || d.d || 620) + costadoCopreAnte(progetto, m)), altezza: hC, spessore: m.spessore_mm || 20, materiale: 'anta', quantita: 1 });
  } else if (cat === 'pannello') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.larghezza_mm || L), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'regletta') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.latoA_mm || 30), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'altillo') {
    // MOBILE SOPRA FRIGO: la carcassa si ordina come i pensili; qui le ante (H − aria)
    anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, null, false, null, rJ);
  } else if (cat === 'frigo') {
    // Frigo: elettrodomestico comprato, niente da tagliare (niente zoccolo)
  } else if (cat === 'lavatrice' || cat === 'lavastoviglie') {
    // Elettrodomestico: NON si tagliano carcassa/ante (è un apparecchio comprato).
    // Ma va calcolato come un modulo da 45/60 per le MISURE: occupa il suo spazio
    // (già nel conteggio moduli e nel 3D con piano sopra) e dà la sua quota di
    // ZOCCOLO, così lo zoccolo continuo della cucina ha la lunghezza giusta.
    zoccolo(pz, mod, L, H);
    // lavastoviglie INTEGRATA: l'anta davanti la facciamo noi, come quelle dei mobili bassi
    if (m.tipo === 'lavastoviglie' && m.colore === 'integrata') anteModulo(pz, mod, L, H, 1, m.antaLato, altG, false, null, rJ, GN);
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
    : cat === 'altillo' ? (col.colonna || col.pensile)
    : cat === 'costado' ? ((progetto.costadiDiversi && m.colore) || (alto ? (col.pensile || col.costado)
      : (col.costado || ((m.altezza_mm || 0) >= 1500 ? (col.colonna || col.base) : col.base)))) : col.base;
  // costado "come il piano di lavoro": materiale dell'encimera
  // CUCINA A PONTE: colori propri del ponte e dei pensili sotto il ponte
  const cpD = progetto.coloriPonte || {};
  if (m.tipo === 'ponte' && cpD.ponte) idAnte = cpD.ponte;
  if (cat === 'pensile' && cpD.pensili && pontiSopra(progetto, m).length) idAnte = cpD.pensili;
  if (m.coloreFronte && cat !== 'costado') idAnte = m.coloreFronte;   // colore proprio di questo modulo
  if (idAnte === '@piano') idAnte = (progetto.encimera && progetto.encimera.materiale) || null;
  const pianoStd = cat === 'costado' && idAnte === null && ((progetto.costadiDiversi && m.colore) === '@piano' || col.costado === '@piano');
  for (const p of pz) {
    p.moduloId = m.id;                                // chiave di raggruppamento univoca
    if (p.materialeNome) continue;                    // già detto (es. anta vetrina da ordinare)
    p.materialeNome = p.materiale === 'melaminico' ? nomeInterno(progetto)
      : p.materiale === 'zoccolo' ? nomeMateriale(progetto.zoccoloColore || 'nero-opaco', 'Zoccolo')
      : pianoStd ? 'Come il piano di lavoro (nero standard)' : nomeMateriale(idAnte, 'Colore da scegliere');
  }
  return pz;
}

// Gruppi SEPARATI della lista pezzi: porte, frontali, parti dei cassetti,
// costadi, reglette, pannelli, zoccoli.
const ORDINE_GRUPPI = ['Strutture su misura', 'Cornici vano', 'Mobili a giorno', 'Porte', 'Frontali cassetto', 'Cassetti (fondo e trasera)', 'Costadi',
  'Reglette', 'Pannelli', 'Piani e tavoli', 'Zoccoli', 'Varie'];
function gruppoPezzo(p) {
  if (p.struttura) return 'Strutture su misura';
  if (p.cornice) return 'Cornici vano';
  if (p.aperto) return 'Mobili a giorno';            // cornice, rivestimento e ripiani dei mobili senza ante            // fianchi, top/fondo, schiena, ripiani della colonna su misura
  if (['tavolo', 'vetro', 'gambe'].includes(p.materiale)) return 'Piani e tavoli';   // piano / tavolo e i suoi appoggi
  const n = String(p.nome).toLowerCase();
  if (n.includes('regletta')) return 'Reglette';
  if (n.includes('costado')) return 'Costadi';
  if (n.includes('fronte cassetto')) return 'Frontali cassetto';
  if (n.includes('cassetto')) return 'Cassetti (fondo e trasera)';
  if (n.includes('pannello cieco') || n.includes('anta') || n.includes('sotto forno')) return 'Porte';
  if (p.materiale === 'zoccolo' || n.includes('zoccolo')) return 'Zoccoli';
  if (n.includes('pannello') || n.includes('cierre') || n.includes('regletta grande')) return 'Pannelli';
  return 'Varie';
}

// Gruppi dei MODULI da ordinare (costadi, reglette e pannelli no: li facciamo noi).
const ORDINE_MODULI = ['Colonne', 'Moduli alti', 'Moduli bassi', 'Elettrodomestici'];
function gruppoModulo(cat) {
  if (cat === 'colonna') return 'Colonne';
  if (cat === 'pensile' || cat === 'altillo') return 'Moduli alti';
  if (cat === 'base') return 'Moduli bassi';
  if (cat === 'lavastoviglie' || cat === 'lavatrice' || cat === 'frigo') return 'Elettrodomestici';
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
    const gruppo = m.tipo === 'colonna-misura' ? null : gruppoModulo(categoriaTipo(m.tipo));   // su misura: la facciamo noi
    if (!gruppo || apertoDi(m)) continue;                     // mobile aperto: anche lui fatto da noi, a pezzi
    const L = dimMobile(m).w;
    // FUORI MISURA: si ordina il modulo standard più vicino (più grande) e si taglia (es. 700 → 630)
    const od = moduloDaOrdinare(m), Lo = od ? od.ordina : L;
    const misura = m.altezza_mm ? `${m.altezza_mm}×${Lo}` : `${Lo}`;
    const key = `${gruppo}|${m.tipo}|${misura}|${od ? od.taglio : m.fuoriMisura ? 1 : 0}`;
    if (!modMap.has(key)) modMap.set(key, { gruppo, nome: `${nomeTipo(m.tipo)} · interno ${progetto.coloreInterno === 'antracite' ? 'antracite' : 'bianco'}`, misura, tipo: nomeTipo(m.tipo), fuoriMisura: !!(od || m.fuoriMisura), taglio: od ? od.taglio : null, quantita: 0 });
    modMap.get(key).quantita++;
  }
  const moduli = [...modMap.values()].sort((a, b) => ORDINE_MODULI.indexOf(a.gruppo) - ORDINE_MODULI.indexOf(b.gruppo));

  // 2) LISTA PEZZI DA FARE: ante/frontali e pezzi in legno nostri, aggregati per tipo+misura.
  const raw = [];
  for (const m of mobili) raw.push(...pezziDiModulo(progetto, m));
  // CIERRE A TECHO: fasce a filo del fronte dei mobili + pezzi che rientrano (negli angoli una passa + spessore)
  const ct = progetto.cierreTecho;
  if (ct && ct.attivo) {
    const col = progetto.coloriFronti || {};
    for (const f of fasceCierreTecho(progetto, SP)) {
      raw.push({ nome: f.tipo === 'rientro' ? 'Cierre a techo (pezzo che rientra)' : f.tipo === 'testata' ? 'Cierre a techo (fianco di chiusura)'
        : f.lunghezza > 2800 ? 'Cierre a techo (fascia, oltre 2800: da giuntare)' : 'Cierre a techo (fascia)',
        larghezza: f.lunghezza, altezza: Math.max(20, Math.round(Number(ct.altezza) || 300)), spessore: SP, materiale: 'anta',
        materialeNome: nomeMateriale(f.gruppo === 'pensile' ? col.pensile : col.colonna, 'Colore da scegliere'), quantita: 1 });
    }
  }
  // PANNELLO SOTTO IL PONTE: uno per fila di ponte, lungo quanto la fila, profondo come il ponte
  {
    const spP = spessorePannelloPonte(progetto), col = progetto.coloriFronti || {};
    for (const f of pannelliSottoPonte(progetto)) {
      const primo = (progetto.mobiliLiberi || []).find((o) => o.id === f.ids[0]);
      raw.push({ nome: f.pezzi > 1 ? `Pannello sotto ponte (pezzo ${f.pezzo} di ${f.pezzi})` : 'Pannello sotto ponte',
        larghezza: f.w, altezza: Math.round(f.d), spessore: spP, materiale: 'anta',
        materialeNome: nomeMateriale((progetto.coloriPonte || {}).pannello || (primo && primo.coloreFronte) || (progetto.coloriPonte || {}).ponte || col.colonna || col.pensile, 'Colore da scegliere'), quantita: 1 });
    }
  }
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
  // finger-pull, push e maniglia: per gruppo (bassi / pensili / colonne / ponte / pensili sotto il ponte)
  // (il ponte e i pensili sotto il ponte possono avere scelte loro: sceltePorte)
  const scelte = new Map(mobili.map((m) => [m.id, sceltePorte(progetto, m)]));
  const scelteDi = (p) => scelte.get(p.moduloId) || sceltePorteGruppo(progetto, null, 'base');
  // per ogni pezzo: le scelte della porta (le colonne le hanno porta per porta), se no quelle del mobile
  const fpDi = (p) => (p.fp != null ? p.fp : scelteDi(p).fp);
  const pushDi = (p) => (p.push != null ? p.push : scelteDi(p).push);
  const nomeManiglia = (p) => {
    const sc = scelteDi(p), id = sc.maniglia;
    const def = id && typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === id);
    const col = sc.coloreManiglia ? nomeFinituraManiglia(sc.coloreManiglia) : '';
    return (def ? def.nome : 'standard') + (col ? ` · ${col}` : '');
  };

  // CERNIERE: porte da 70 a 92 → 2 (110°); pensile angolo 63×63 → 2 per porta
  // a 165°; porta della colonna frigo → 4 se più alta di 1,10 m, se no 3.
  for (const p of raw) {
    if (!/^anta/i.test(p.nome)) continue;
    const m = perId.get(p.moduloId) || {};
    // apertura VERSO L'ALTO: cerniere / meccanismo diversi (da definire)
    if (p.lato === 'alto' || /verso l'alto/.test(p.nome)) { aggiungi("Cerniere apertura verso l'alto (da definire)", p.quantita); continue; }
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
  // MOBILI APERTI: 4 reggipiani per ripiano
  for (const p of raw) if (p.nome === 'Ripiano (mobile a giorno)') aggiungi('Reggipiani (mobili a giorno)', 4 * p.quantita);
  // MOBILI A GIORNO: strisce LED sotto il top e sotto i ripiani (lunghe quanto il dentro meno 2 cm)
  for (const m of mobili) {
    const l = ledStrisceAperto(m, latoApertoDi(progetto, m));
    if (l.n) aggiungi(`Striscia LED ${Math.round(l.mm / 10)} cm (mobili a giorno)`, l.n);
  }
  // VETRI delle ante vetrina con telaio in legno (misura del vetro da ordinare)
  for (const p of raw) if (p.vetro) aggiungi(`Vetro ${p.vetro.tipo} ${p.vetro.w}×${p.vetro.h} (anta vetrina)`, p.quantita);
  // CASSETTI (guide/scatola) del sistema dei ⚙ Parametri: uno per frontale, piccolo / medio / grande
  { const c = parametri().cassetti;
    for (const p of raw) {
      if (!p.nome.startsWith('Fronte cassetto')) continue;
      aggiungi(`Cassetti${c.marca ? ' ' + c.marca : ''} profondità ${c.profondita / 10} cm · ${tipoCassetto(p.altezza).tipo}`, p.quantita);
    } }
  // MANIGLIE: una per porta e per frontale, dove non c'è il finger-pull
  for (const p of raw) {
    if (!/^anta|^fronte cassetto/i.test(p.nome)) continue;
    const cassetto = /^fronte cassetto/i.test(p.nome);           // i cassetti non hanno mai il push
    if (scelteDi(p).gola || fpDi(p) || (!cassetto && pushDi(p))) continue;
    aggiungi(`Maniglie · ${nomeManiglia(p)}`, p.quantita);
  }
  // PUSH: per ogni porta un push pull e la sua base
  for (const p of raw) {
    if (!/^anta/i.test(p.nome)) continue;
    if (!pushDi(p)) continue;
    aggiungi('Push pull', p.quantita);
    aggiungi('Push pull · base', p.quantita);
  }
  // COLONNA SU MISURA: 4 portaripiani per ogni ripiano (4 ripiani → 16)
  for (const m of mobili) if (m.tipo === 'colonna-misura') aggiungi('Portaripiani', 4 * ripianiColonnaMisura(m));
  // A TERRA: piedini, grappe dello zoccolo; PENSILI: kit per appenderli
  for (const m of mobili) {
    const cat = categoriaTipo(m.tipo), L = dimMobile(m).w;
    if (cat === 'base' || cat === 'colonna') {
      aggiungi('Piedini regolabili', m.tipo === 'base-angolo' ? 6 : piediniDi(L));
      aggiungi('Grappe zoccolo (fissaggio ai piedini)', 1);
    }
    if (cat === 'pensile') aggiungi('Kit per appendere i pensili', 1);
    if (m.tipo === 'forno' && !golaSuMobile(progetto, m)) aggiungi(`Griglia aerazione forno ${round(L - ariaL())} mm`, 1);
  }
  // GOLA IN ALLUMINIO: profili L (sotto il piano) e C (fra i cassetti) in barre da 4 m,
  // tappi sui capi liberi, angoli interni/esterni, supporti di fissaggio (uno per fianco)
  { const gc = golaProgetto(progetto);
    if (gc.base) {
      const pg = profiliGola(progetto), col = nomeColoreGola(gc.colore);
      for (const t of ['L', 'C']) {
        const prof = pg[t];
        if (!prof.length) continue;
        const b = barreGola(prof.map((p) => p.lung));
        aggiungi(`Profilo gola ${t} · ${col} · barre da 4 m (tagli ${b.tagli.join(' + ')} mm)`, b.barre);
        aggiungi(`Tappi gola ${t} · ${col}`, prof.reduce((n, p) => n + p.capiLiberi, 0));
      }
      aggiungi(`Angoli interni gola L · ${col}`, pg.angoliInterni);
      aggiungi(`Angoli esterni gola L · ${col}`, pg.angoliEsterni);
      aggiungi('Supporti fissaggio gola (uno per fianco)', pg.fianchi);
    } }
  // la base angolo ha il suo angolo di zoccolo (interno) e non fa da fila a parte
  aggiungi('Angoli zoccolo 90°', angoliZoccolo(mobili.filter((m) => m.tipo !== 'base-angolo'))
    + mobili.filter((m) => m.tipo === 'base-angolo').length);
  const ORDINE_ACC = ['Cerniere', 'Cassetti', 'Maniglie', 'Push', 'Profilo gola', 'Tappi gola', 'Angoli interni gola', 'Angoli esterni gola', 'Supporti fissaggio gola', 'Kit', 'Piedini', 'Grappe', 'Angoli', 'Griglia'];
  const pos = (n) => { const i = ORDINE_ACC.findIndex((k) => n.startsWith(k)); return i < 0 ? 99 : i; };
  const accessori = [...acc.entries()].map(([nome, quantita]) => ({ nome, quantita })).sort((x, y) => pos(x.nome) - pos(y.nome));

  // 4) Riepilogo.
  let totalePezzi = 0, mqAnte = 0, mqZoccolo = 0, mqMelaminico = 0;
  for (const p of pezzi) {
    totalePezzi += p.quantita;
    const mq = (p.larghezza * p.altezza * p.quantita) / 1e6;
    if (p.materiale === 'zoccolo') mqZoccolo += mq;
    else if (p.materiale === 'melaminico') mqMelaminico += mq;
    else if (['tavolo', 'vetro', 'gambe'].includes(p.materiale)) continue;   // non sono ante (piano / tavolo)
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
