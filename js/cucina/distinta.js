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
  altezzeCassettiDi, cassettoSopraDi, infoTavolo, spessoreTavolo, moduloDaOrdinare, PROFONDITA_PENSILE, categoriaTipo, dimMobile, nomeTipo, anteDiMobile, infoAngoloCieco, portaBassaColonna, frontiCassetti, anteBaseAngolo, fasceCierreTecho, pannelliSottoPonte, spessorePannelloPonte, pontiSopra, sceltePorte, sceltePorteGruppo, golaSuMobile, golaProgetto, altezzaAntaGola, spazioGola, profiliGola, barreGola, nomeColoreGola, pezziColonnaMisura, ripianiColonnaMisura, pezziCorniceVano, altezzaVanoColonna, apertoDi, pezziMobileAperto, latoApertoDi, coloreParteAperto, ledStrisceAperto,
  costadoCopreAnte, costadoColonnaATerra, cimaColonne, fronteCieco, piediniCucina, zoccoloColonnaDi, zoccoliContinui, angoliZoccolo,
  altezzaAlzatina, antePensileAngolo, antaCiaflan, MODULI_SPECIALI, scendeAntaPensile, golaColonna, goleDiColonna, goleVerticali, golaScelta, cassettiDelMobile, impostaProgettoFerramenta } from './modello.js?v=20261126l';
import { parametri, tipoCassetto, pezziCassettoNostro, profiloFingerPull } from '../parametri.js?v=20261126l';
import { nomeFinituraManiglia } from '../finiture-maniglia.js?v=20261126l';
import { lastrePiano, ledCucina, spessorePianoDi, spessorePannelloPiano, defPiano, SP_SCHIENALE } from './geometria.js?v=20261126l';

const SP = 18;        // ante/fronti e pannelli (mm)
const THK_REG = 20;   // spessore regletta d'angolo (mm)
const round = (n) => Math.round(n);
let _progDist = null;                    // la cucina della distinta in calcolo (piedini scelti)
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
  if (!scelte || scelte.push) return 0;
  // FINGER-PULL con il profilo (⚙ Parametri): l'anta si accorcia del profilo; fresato: anta intera
  if (scelte.fp) { const P = profiloFingerPull(); if (P) _nomeRid = 'profilo finger-pull'; return P; }
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
  const hTot = H + (categoriaTipo(m.tipo) === 'pensile' ? scendeAntaPensile(progetto, H) : 0);
  for (const p of pezziMobileAperto(m, latoApertoDi(progetto, m), hTot)) {
    const { parte, ...x } = p;
    const c = coloreParteAperto(m, parte);
    pz.push({ modulo: mod, ...x, aperto: true,
      materiale: c === 'struttura' ? 'melaminico' : 'anta',
      ...(c !== 'ante' && c !== 'struttura' ? { materialeNome: nomeMateriale(c, 'Materiale da scegliere') } : {}) });
  }
}

// L'anta del pensile sporge 2 cm sotto (70→72, 90→92) con l'opzione attiva.

const NOMI_VETRO = { trasparente: 'trasparente', satinato: 'satinato', fume: 'fumé' };
/**
 * CERNIERE delle ante dei PENSILI (per l'esportazione): 2 cerniere standard a `cerniera` mm dal bordo sopra
 * e da quello sotto; l'anta che scende di più (72, 92, personalizzata) sotto ha i mm in più (92 → 115).
 * Lato delle cerniere: opposto alla maniglia (lato = dove si apre / sta la maniglia).
 */
function notaCerniere(sopra, sotto, latoCerniere) {
  return `2 cerniere standard: ${sopra} mm da sopra, ${sotto} mm da sotto${latoCerniere ? ` · cerniere a ${latoCerniere === 'sx' ? 'sinistra' : 'destra'}` : ''}`;
}
function anteModulo(pz, mod, L, H, N, lato, altAnta, sporg, vetrina, rJ = 0, extra = '', cerniere = null) {
  if (sporg) rJ = 0;                                  // anta sporgente: si apre da sotto, niente maniglia
  const a = dimAnta(L, H, N, rJ);
  // ante dei pensili: ogni anta con le sue cerniere. Misure uguali sopra e sotto (anta normale): il lato non
  // conta. Misure diverse (anta che scende: 72, 92…): conta da che lato sono le cerniere, se no la misura più
  // grande finisce in alto → 2 ante = una con le cerniere a sinistra e una a destra
  if (cerniere && lato !== 'alto' && cerniere.sopra === cerniere.sotto) {
    const prima = pz.length;
    anteModulo(pz, mod, L, H, N, lato, altAnta, sporg, vetrina, rJ, extra, null);
    for (let i = prima; i < pz.length; i++) pz[i].cerniere = notaCerniere(cerniere.sopra, cerniere.sotto, null);
    return;
  }
  if (cerniere && lato !== 'alto') {
    const lati = N === 1 ? [lato === 'sx' ? 'dx' : 'sx'] : N === 2 ? ['sx', 'dx'] : null;
    if (lati) {
      const prima = pz.length;
      anteModulo(pz, mod, L, H, N, lato, altAnta, sporg, vetrina, rJ, extra, null);
      const pezzo = pz.splice(prima, 1)[0];
      if (pezzo) for (const lc of lati) pz.push({ ...pezzo, quantita: pezzo.quantita / lati.length, cerniere: notaCerniere(cerniere.sopra, cerniere.sotto, lc) });
      return;
    }
  }
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
function cassettoMelaminico(pz, mod, L, hCassetto, nc, c = parametri().cassetti) {
  // CASSETTO FATTO DA NOI: la scatola la tagliamo noi (fianchi, dietro, davanti, fondo)
  if (c.tipo === 'nostro') {
    for (const p of pezziCassettoNostro(c, L - 2 * c.fianchiMobile, hCassetto, c.profondita, nc)) pz.push({ modulo: mod, ...p, materiale: 'melaminico' });
    return;
  }
  const t = tipoCassetto(hCassetto, parametri(), c);
  pz.push({ modulo: mod, nome: 'Cassetto · fondo', larghezza: round(L - c.fondoMeno), altezza: round(c.fondoProfondita), spessore: c.spessore, materiale: 'melaminico', quantita: nc });
  pz.push({ modulo: mod, nome: `Cassetto · trasera ${t.tipo}`, larghezza: round(L - c.traseraMeno), altezza: round(t.trasera), spessore: c.spessore, materiale: 'melaminico', quantita: nc });
}

// Regletta d'angolo e pannello cieco sul modulo "cieco" dell'angolo.
function reglettaAngolo(pz, mod, progetto, m, H, conPannello = true) {
  if (progetto.autoRegletta === false) return;
  const info = infoAngoloCieco(progetto, m);
  if (!info) return;
  // alti come le ANTE e i cassetti accanto (con la gola sotto il profilo: 700 → 675)
  const hF = golaSuMobile(progetto, m) ? altezzaAntaGola(H) : round(H - ariaH());
  // PANNELLO CIECO: la parte del fronte che ha davanti il mobile dell'altra fila (+ la regletta)
  const fc = fronteCieco(progetto, m);
  if (fc && conPannello) pz.push({ modulo: mod, nome: 'Pannello cieco (angolo)', larghezza: round(fc.ciecoW - ariaL()), altezza: hF, spessore: SP, materiale: 'anta', quantita: 1 });
  const P = parametri().regletta, ra = progetto.reglettaAngolo || {};
  const spess = ra.spessore != null ? Number(ra.spessore) : P.spessoreAnta;
  const vis = fc ? fc.regletta : (info.gap != null && info.gap > 0) ? Math.max(spess || 18, info.gap) : (ra.base || P.vista);
  // i due pezzi della L: uno largo quanto si vede, l'altro + lo spessore dell'anta (sormonta il primo)
  pz.push({ modulo: mod, nome: 'Regletta angolo (pezzo corto)', larghezza: round(vis), altezza: hF, spessore: THK_REG, materiale: 'anta', quantita: 1 });
  pz.push({ modulo: mod, nome: `Regletta angolo (pezzo lungo, + spessore anta ${round(spess)})`, larghezza: round(vis + spess), altezza: hF, spessore: THK_REG, materiale: 'anta', quantita: 1 });
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
  const hAp = H + (cat === 'pensile' ? scendeAntaPensile(progetto, H) : 0);   // con le ante da 72 / 92 (o personalizzate)
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
    const { a, b } = anteBaseAngolo(m);
    for (const aw of a === b ? [a] : [a, b]) {
      const q = a === b ? 2 : 1;
      pz.push({ modulo: mod, nome: 'Anta (base angolo)' + GN, larghezza: Math.max(1, round(aw - aL)), altezza: gola ? altG : round(H - aH - rJ), spessore: SP, materiale: 'anta', quantita: q });
    }
  } else if (cat === 'base') {
    // carcassa, ripiani e cassetti interni: già nel modulo (non si tagliano)
    // ANGOLO: come nel 3D, anche cassettiere e forno. Coperti dall'altra fila → ante sulla parte libera
    // + pannello cieco; solo vicini (con la luce della regletta) → restano com'erano, + la regletta
    const angC = m.tipo !== 'base-ante' && m.tipo !== 'lavello' && !apertoDi(m) && progetto.autoRegletta !== false ? infoAngoloCieco(progetto, m) : null;
    const fcC = angC ? fronteCieco(progetto, m) : null;
    if (angC && angC.coperto && fcC) {
      anteModulo(pz, mod, fcC.liberoW, H, fcC.nAnte, m.antaLato, altG, false, null, rJ, GN + ' · angolo, parte libera');
      reglettaAngolo(pz, mod, progetto, m, H);
    } else if (m.tipo === 'base-cassetti') {
      const nc = Math.max(1, m.cassetti || 3);
      // FUGHE: una in più dei cassetti, da 2 mm; frontali per difetto. Tutti
      // uguali, oppure uno piccolo in alto e gli altri uguali.
      const alt = frontiCassetti(H, nc, m.cassettoPiccolo_mm, gola, altezzeCassettiDi(m));
      const perH = new Map(); alt.forEach((h) => perH.set(h, (perH.get(h) || 0) + 1));
      for (const [hf, q] of perH) {
        const piccolo = m.cassettoPiccolo_mm && alt.length > 1 && hf === alt[0] && hf !== alt[1];
        const hJ = hf - rJ;                          // con la maniglia a J il frontale si accorcia
        pz.push({ modulo: mod, nome: (piccolo ? 'Fronte cassetto piccolo' : 'Fronte cassetto') + GN + (rJ ? ` · ${_nomeRid} (−${rJ} mm)` : ''), larghezza: round(L - aL), altezza: hJ, spessore: SP, materiale: 'anta', quantita: q });
        // parti per fare i cassetti: fondo e trasera in melaminico (sistema dei ⚙ Parametri)
        cassettoMelaminico(pz, mod, L, hJ, q, cassettiDelMobile(progetto, m));
      }
      if (angC) reglettaAngolo(pz, mod, progetto, m, H, false);
    } else if (m.tipo === 'forno') {
      // sotto il forno un pannello del colore delle ante (griglia sopra = accessorio)
      // con la gola il forno sta subito sotto la gola (l'aria passa dalla gola: niente griglia)
      const aT = parametri().ante.ariaTraAnte;                  // le fughe fra griglia, forno e pannello (come nel 3D)
      const hp = gola ? round(H - spazioGola() - H_FORNO_INCASSO - aT) : round(H - aH - GRIGLIA_FORNO - aT - H_FORNO_INCASSO - aT);
      if (hp > 15) pz.push({ modulo: mod, nome: 'Pannello sotto forno', larghezza: round(L - aL), altezza: hp, spessore: SP, materiale: 'anta', quantita: 1 });
      if (angC) reglettaAngolo(pz, mod, progetto, m, H, false);
    } else {
      // base-ante / lavello
      const N = m.tipo === 'lavello' ? (L >= 600 ? 2 : 1) : anteDiMobile(m);
      // MOBILE CIECO D'ANGOLO: ante solo sulla parte libera (il resto è il pannello cieco, sotto)
      const fc = !apertoDi(m) && progetto.autoRegletta !== false ? fronteCieco(progetto, m) : null;
      const cs = !fc ? cassettoSopraDi(m) : 0;
      if (apertoDi(m)) mobileAperto(pz, mod, progetto, m);          // APERTO: niente ante
      else if (fc) anteModulo(pz, mod, fc.liberoW, H, fc.nAnte, m.antaLato, altG, false, m.tipo === 'base-ante' ? m.vetrina : null, rJ, GN + ' · angolo, parte libera');
      else if (cs) {
        // CASSETTO SOPRA + ANTA SOTTO: il cassetto è lo spazio scritto meno l'aria (o la gola), l'anta il resto
        const passoC = gola ? spazioGola() : parametri().ante.ariaCassetti;
        const hC = cs - passoC;
        pz.push({ modulo: mod, nome: `Fronte cassetto (sopra l'anta)${GN}${rJ ? ` · ${_nomeRid} (−${rJ} mm)` : ''}`, larghezza: round(L - aL), altezza: round(hC - rJ), spessore: SP, materiale: 'anta', quantita: 1 });
        cassettoMelaminico(pz, mod, L, hC - rJ, 1, cassettiDelMobile(progetto, m));
        const resto = H - cs;
        anteModulo(pz, mod, L, resto, N, m.antaLato, gola ? altezzaAntaGola(resto) : null, false, null, rJ, GN + ' · sotto il cassetto');
      }
      else anteModulo(pz, mod, L, H, N, m.antaLato, altG, false, m.tipo === 'base-ante' ? m.vetrina : null, rJ, GN);
      reglettaAngolo(pz, mod, progetto, m, H);
    }
  } else if (cat === 'pensile') {
    if (m.tipo === 'pensile-angolo' || m.tipo === 'pensile-angolo-45') {
      // PENSILE ANGOLO a L: le due ante si incontrano nell'angolo, la grande fino all'angolo e la piccola
      // contro di lei (63×63 → 295 e 276: antePensileAngolo, come nel 3D). CIAFLAN: un'anta sola
      const pa = m.tipo === 'pensile-angolo' ? antePensileAngolo(m) : null;
      // CIAFLAN: un'anta sola in diagonale, larga come scritto per il mobile o nei ⚙ Parametri (come nel 3D)
      const lati = pa ? [pa.grande, pa.piccola] : [antaCiaflan(m).anta];
      // MODULO SPECIALE: misure da controllare, cambiano da una marca all'altra
      const avv = ' · ⚠ misura da controllare (cambia da marca a marca)';
      const nomi = pa ? [' grande (fino all\'angolo)' + avv, ' piccola (contro l\'anta grande)' + avv] : [' Ciaflan (in diagonale)' + avv];
      // con l'anta sporgente (70 → 72, 90 → 92 o personalizzata) anche qui l'anta scende, come nel 3D
      const scA = scendeAntaPensile(progetto, H), K = parametri().cucina;
      lati.forEach((_, i) => {
        pz.push({ modulo: mod, nome: (scA ? 'Anta sporgente' : 'Anta') + nomi[i], larghezza: Math.max(100, lati[i]), altezza: scA ? round(H + scA) : round(H - aH - rJ), spessore: SP, materiale: 'anta', quantita: 1,
          cerniere: notaCerniere(K.cernieraSopra, K.cernieraSotto + (scA || 0), null) });
      });
    } else {
      // Pensile: con l'anta sporgente la porta è H + quanto scende (70 → 72, 90 → 92, o personalizzata), altrimenti H − 2.
      const sporg = scendeAntaPensile(progetto, H);
      if (apertoDi(m)) mobileAperto(pz, mod, progetto, m);          // APERTO: niente ante
      else {
        const K = parametri().cucina;
        anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, sporg ? H + sporg : null, sporg, m.vetrina, rJ, '', { sopra: K.cernieraSopra, sotto: K.cernieraSotto + (sporg || 0) });
      }
    }
  } else if (cat === 'colonna') {
    const abC = portaBassaColonna(progetto, m);      // alta come i mobili bassi
    // Due ante reali: sotto = porta bassa − 2 (come il mobile base 70/80),
    // sopra = lo spazio che resta − 2 (tolto forno/microonde/vano, come nel 3D).
    const ab = abC;
    const aw = round(L - aL);                       // larghezza anta (1 anta)
    const topDoor = restoAntaColonna(m, H - ab);
    // ogni porta con le SUE scelte (porta normale / finger-pull, maniglia / push, verso)
    const g = progetto.fingerPull, pu = progetto.push || {};
    const fpGr = g === true || !!(g && typeof g === 'object' && g.colonna), pushGr = !!pu.colonna;
    // CUCINA CON GOLA: la colonna non ha maniglie (si apre dalla gola verticale), anta larga come la colonna
    const golaC = golaColonna(progetto, m);
    const porta = (chiave, nome, alt) => {
      const o = (m.porte && m.porte[chiave]) || {};
      const fpP = golaC ? false : o.fp != null ? !!o.fp : fpGr, pushP = golaC ? false : o.push != null ? !!o.push : pushGr;
      const lato = o.lato || (m.antaLato === 'sx' ? 'sx' : 'dx');
      const rJp = golaC ? 0 : riduzioneJ({ ...scP, fp: fpP, push: pushP });
      const desc = ` (apertura ${lato === 'alto' ? "verso l'alto" : lato}${golaC ? ' · gola verticale' : ''}${fpP ? ' · finger-pull' : ''}${pushP ? ' · push' : ''}${rJp ? ` · ${_nomeRid} (−${rJp} mm)` : ''})`;
      // maniglia a profilo sul bordo: con l'apertura di lato è VERTICALE (si toglie dalla larghezza),
      // con l'apertura verso l'alto è sul bordo basso (si toglie dall'altezza) — come nel 3D
      const awJ = lato === 'alto' ? aw : round(aw - rJp), ahJ = lato === 'alto' ? round(alt - rJp) : round(alt);
      if (o.vetro) {
        // PORTA IN VETRO: come le ante vetrina dei pensili (telaio in legno con il vano per il vetro, o telaio da ordinare)
        const ah = ahJ, vt = NOMI_VETRO[o.vetro.vetro] || 'trasparente';
        if ((o.vetro.telaio || 'legno') === 'legno') pz.push({ modulo: mod, nome: `${nome} vetrina (telaio 50 mm, vano vetro da fresare)${desc}`, larghezza: awJ, altezza: ah, spessore: SP, materiale: 'anta', quantita: 1, lato,
          vetro: { w: Math.max(10, awJ - 80), h: Math.max(10, ah - 80), tipo: vt } });
        else { const tel = o.vetro.telaio === 'nero' ? 'nero' : 'alluminio'; pz.push({ modulo: mod, nome: `${nome} vetrina telaio ${tel} + vetro ${vt} (da ordinare)${desc}`, larghezza: aw, altezza: ah, spessore: 20, materiale: 'vetrina', quantita: 1, lato, materialeNome: `Telaio ${tel} + vetro ${vt}` }); }
        return;
      }
      pz.push({ modulo: mod, nome: `${nome}${desc}`, larghezza: awJ, altezza: ahJ, spessore: SP, materiale: 'anta', quantita: 1, fp: fpP, push: pushP, lato });
    };
    if (m.variante === 'intera') porta('intera', 'Anta intera', H - aH);   // PORTA INTERA: una sola, da terra in cima
    else {
      porta('bassa', 'Anta bassa', ab - aH);
      if (topDoor > 60) porta('alta', 'Anta alta', topDoor - aH);
    }
    // COLONNA SU MISURA: la struttura la facciamo noi → tutti i pezzi (montaggio 2)
    if (m.tipo === 'colonna-misura') {
      // con la gola verticale il fianco accanto alla gola si accorcia di 12 mm (in profondità)
      const nG = golaC ? new Set(goleDiColonna(progetto, m).filter((x) => x.accorcia).map((x) => x.lato)).size : 0;
      for (const p0 of pezziColonnaMisura(m)) {
        const fianco = /^Fianco/.test(p0.nome) && nG > 0;
        const lista = !fianco ? [p0] : [
          ...(p0.quantita - nG > 0 ? [{ ...p0, quantita: p0.quantita - nG }] : []),
          { ...p0, nome: `${p0.nome} · ⚠ accorciato di ${golaScelta(progetto).accorcia} mm per la gola`, larghezza: p0.larghezza - golaScelta(progetto).accorcia, quantita: nG },
        ];
        for (const p of lista) {
        pz.push({ modulo: mod, ...p, materiale: 'carcassa', struttura: true,
          ...(m.struttura === 'bianco' ? { materialeNome: nomeInterno(progetto) } : {}) });
        }
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
      if (best && dMin < 2500) { const hp = best.altezza_mm || 700; hC = hp + scendeAntaPensile(progetto, hp); }
    }
    // COSTADO ESTERNO DELLE COLONNE: fino a terra (colonna + piedini 10 o 15 cm), come nel 3D
    const aTerra = costadoColonnaATerra(progetto, m) && cimaColonne(progetto) != null;
    if (aTerra) hC = Math.max(hC, cimaColonne(progetto));
    // accanto ai mobili il costado copre anche le ante (2 cm oltre la cassa): misura vera da tagliare
    pz.push({ modulo: mod, nome: 'Pannello fianco (costado)' + (aTerra ? ' · fino a terra' : ''), larghezza: round((m.profondita_mm || d.d || 620) + costadoCopreAnte(progetto, m)), altezza: hC, spessore: m.spessore_mm || 20, materiale: 'anta', quantita: 1 });
  } else if (cat === 'pannello') {
    pz.push({ modulo: mod, nome: nomeTipo(m.tipo), larghezza: round(m.larghezza_mm || L), altezza: H, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'regletta') {
    // con la GOLA è alta come le ante (700 → 675): il profilo L le passa sopra
    // a L come nel 3D: il lato davanti (largo come si vede) e il lato in profondità, dietro al primo
    const hR = golaSuMobile(progetto, m) ? altezzaAntaGola(H) : H, pB = round((m.latoB_mm || 30) - SP);
    pz.push({ modulo: mod, nome: `${nomeTipo(m.tipo)} · lato davanti`, larghezza: round(m.latoA_mm || 30), altezza: hR, spessore: SP, materiale: 'anta', quantita: 1 });
    if (pB > 0) pz.push({ modulo: mod, nome: `${nomeTipo(m.tipo)} · lato in profondità (dietro al lato davanti)`, larghezza: pB, altezza: hR, spessore: SP, materiale: 'anta', quantita: 1 });
  } else if (cat === 'altillo') {
    // MOBILE SOPRA FRIGO: la carcassa si ordina come i pensili; qui le ante (H − aria)
    anteModulo(pz, mod, L, H, anteDiMobile(m), m.antaLato, null, false, null, rJ);
  } else if (cat === 'frigo') {
    // Frigo: elettrodomestico comprato, niente da tagliare (niente zoccolo)
  } else if (cat === 'lavatrice' || cat === 'lavastoviglie') {
    // Elettrodomestico: NON si tagliano carcassa/ante (è un apparecchio comprato).
    // Ma va calcolato come un modulo da 45/60 per le MISURE: occupa il suo spazio
    // (già nel conteggio moduli e nel 3D con piano sopra) e la sua parte di ZOCCOLO
    // (nello zoccolo continuo della cucina: zoccoliContinui).
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
  if (['tavolo', 'vetro', 'gambe', 'piano'].includes(p.materiale)) return 'Piani e tavoli';   // piano di lavoro, alzatina, piano / tavolo e i suoi appoggi
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
// GLI ELETTRODOMESTICI (frigo, lavastoviglie, lavatrice) NON vanno in distinta: li compra il cliente. Restano
// solo i pezzi che facciamo noi intorno (l'anta della lavastoviglie integrata, lo zoccolo davanti).
const ORDINE_MODULI = ['Colonne', 'Moduli alti', 'Moduli bassi'];
function gruppoModulo(cat) {
  if (cat === 'colonna') return 'Colonne';
  if (cat === 'pensile' || cat === 'altillo') return 'Moduli alti';
  if (cat === 'base') return 'Moduli bassi';
  return null;
}

export function calcolaDistintaCucina(progetto) {
  _progDist = progetto;
  impostaProgettoFerramenta(progetto);            // gola e cassetti scelti in questa cucina
  // Gli "oggetti" (sgabelli, decor) sono arredo, non moduli di cucina:
  // non entrano né nei moduli né nei pezzi della distinta.
  const mobili = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) !== 'oggetto');

  // 1) LISTA MODULI DA ORDINARE, per gruppo (colonne, alti, bassi, elettrodomestici).
  const goleV = goleVerticali(progetto);
  const modMap = new Map();
  for (const m of mobili) {
    const gruppo = m.tipo === 'colonna-misura' ? null : gruppoModulo(categoriaTipo(m.tipo));   // su misura: la facciamo noi
    if (!gruppo || apertoDi(m)) continue;                     // mobile aperto: anche lui fatto da noi, a pezzi
    const L = dimMobile(m).w;
    // FUORI MISURA: si ordina il modulo standard più vicino (più grande) e si taglia (es. 700 → 630)
    const od = moduloDaOrdinare(m), Lo = od ? od.ordina : L;
    const misura = m.altezza_mm ? `${m.altezza_mm}×${Lo}` : `${Lo}`;
    // CUCINA CON GOLA: la colonna accanto alla gola verticale va modificata (fianco accorciato di 12 mm)
    const latiG = golaColonna(progetto, m) ? [...new Set(goleDiColonna(progetto, m, goleV).filter((x) => x.accorcia).map((x) => x.lato))].sort() : [];
    // MODULI SPECIALI (pensile angolo a L, Ciaflan): da una marca all'altra le misure cambiano
    const avvSpec = !MODULI_SPECIALI.includes(m.tipo) ? null : m.tipo === 'pensile-angolo'
      ? (() => { const a = antePensileAngolo(m); return `Mi raccomando: controlla le misure del pensile angolo, da una marca all'altra possono cambiare (qui ante da ${a.grande} e ${a.piccola} mm)`; })()
      : `Mi raccomando: controlla la misura del Ciaflan, da una marca all'altra può cambiare (qui anta da ${antaCiaflan(m).anta} mm)`;
    const avviso = [latiG.length ? `Attenzione: la colonna va modificata per poter inserire la gola (${latiG.length === 2 ? 'tutti e due i fianchi accorciati' : latiG[0] > 0 ? 'fianco destro accorciato' : 'fianco sinistro accorciato'} di ${golaScelta(progetto).accorcia} mm)` : null, avvSpec].filter(Boolean).join(' · ') || null;
    const key = `${gruppo}|${m.tipo}|${misura}|${od ? od.taglio : m.fuoriMisura ? 1 : 0}|${avviso || ''}`;
    if (!modMap.has(key)) modMap.set(key, { gruppo, nome: `${nomeTipo(m.tipo)} · interno ${progetto.coloreInterno === 'antracite' ? 'antracite' : 'bianco'}`, misura, tipo: nomeTipo(m.tipo), fuoriMisura: !!(od || m.fuoriMisura), taglio: od ? od.taglio : null, avviso, quantita: 0 });
    modMap.get(key).quantita++;
  }
  const moduli = [...modMap.values()].sort((a, b) => ORDINE_MODULI.indexOf(a.gruppo) - ORDINE_MODULI.indexOf(b.gruppo));

  // 2) LISTA PEZZI DA FARE: ante/frontali e pezzi in legno nostri, aggregati per tipo+misura.
  const raw = [];
  for (const m of mobili) raw.push(...pezziDiModulo(progetto, m));
  // ZOCCOLO CONTINUO: un pezzo per ogni tratto, lungo quanto nel 3D (stesso calcolo: zoccoliContinui) + il
  // MARGINE dei ⚙ Parametri (di partenza 10 cm, per tagliarlo sul posto); copre anche reglette e
  // lavastoviglie, e negli angoli arriva fino allo zoccolo dell'altra fila
  // PEZZO PIÙ LUNGO (⚙ Parametri, di partenza 4 m): un tratto più lungo va in più pezzi da giuntare: pezzi interi
  // più l'ultimo che resta, ognuno con il suo margine
  const trattiZoccolo = zoccoliContinui(progetto), Kz = parametri().cucina, margineZ = Kz.margineZoccolo;
  const utileZ = Math.max(500, Kz.zoccoloMax - margineZ);            // quanto zoccolo «vero» sta in un pezzo
  for (const T of trattiZoccolo) {
    if (T.lunghezza < 1) continue;
    const n = Math.ceil(T.lunghezza / utileZ);
    const nome = 'Zoccolo (frontale)' + (margineZ ? ` · con ${String(margineZ / 10).replace('.', ',')} cm di margine` : '')
      + (n > 1 ? ` · tratto di ${String(Math.round(T.lunghezza / 10) / 100).replace('.', ',')} m in ${n} pezzi da giuntare` : '');
    for (let i = 0; i < n; i++) {
      const parte = i < n - 1 ? utileZ : T.lunghezza - utileZ * (n - 1);
      raw.push({ nome, larghezza: Math.round(parte + margineZ), altezza: Math.round(T.zocc), spessore: SP, materiale: 'zoccolo',
        materialeNome: nomeMateriale(progetto.zoccoloColore || 'nero-opaco', 'Zoccolo'), quantita: 1 });
    }
  }
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
  // PIANO DI LAVORO e PANNELLO DIETRO IL PIANO / ALZATINA: le lastre del 3D (lastrePiano), stesse misure.
  // Ogni lastra: lunga × profonda, spessa come il pannello del piano (più pannelli incollati = più pezzi),
  // con i FORI di lavello e piano cottura (centro del foro dal bordo sinistro, guardando il piano da davanti)
  // e i TAGLI dove passa un piano/tavolo (se lo taglia da parte a parte: due pezzi)
  {
    const encDef = defPiano(progetto);
    const spTop = spessorePianoDi(progetto, encDef), uno = spessorePannelloPiano(progetto, encDef);
    const strati = Math.max(1, Math.min(3, Number(progetto.encimera && progetto.encimera.strati) || 1));
    const nomePiano = nomeMateriale(progetto.encimera && progetto.encimera.materiale, 'Nero standard');
    const sch = progetto.schienale || {};
    const nomeSch = sch.materiale ? nomeMateriale(sch.materiale, 'Materiale da scegliere') : nomePiano;
    const alzatina = !!altezzaAlzatina(progetto);
    const NOMI_FORO = { lavello: 'foro lavello', placca: 'foro piano cottura' };
    for (const L of lastrePiano(progetto, spTop).lastre) {
      for (const P of L.pezzi) {
        const note = [];
        for (const f of L.fori) {
          if (f.u < P.u0 || f.u > P.u1) continue;
          note.push(`${NOMI_FORO[f.tipo]} ${round(f.w)}×${round(f.d)} (centro a ${round(f.u - P.u0)} mm da sinistra)`);
        }
        for (const t of L.tagli) {                     // tacca / buco per il piano o tavolo che passa
          const u0 = Math.max(t.u0, P.u0), u1 = Math.min(t.u1, P.u1), v0 = Math.max(t.v0, -L.depth / 2), v1 = Math.min(t.v1, L.depth / 2);
          if (u1 - u0 < 1 || v1 - v0 < 1) continue;
          const dove = v1 >= L.depth / 2 - 1 ? 'sul davanti' : v0 <= -L.depth / 2 + 1 ? 'dietro' : 'in mezzo';
          note.push(`taglio per il piano / tavolo ${round(u1 - u0)}×${round(v1 - v0)} ${dove} (centro a ${round((u0 + u1) / 2 - P.u0)} mm da sinistra)`);
        }
        raw.push({ nome: (strati > 1 ? `Piano di lavoro (${strati} pannelli incollati)` : 'Piano di lavoro') + note.map((n) => ' · ' + n).join(''),
          larghezza: round(P.u1 - P.u0), altezza: round(L.depth), spessore: uno, materiale: 'piano', materialeNome: nomePiano, quantita: strati });
      }
      const nomeP = alzatina ? 'Alzatina' : 'Pannello dietro il piano';
      if (L.retro) raw.push({ nome: nomeP, larghezza: round(L.retro.len), altezza: round(L.retro.H), spessore: SP_SCHIENALE, materiale: 'piano', materialeNome: nomeSch, quantita: 1 });
      for (const F of L.fianchiSchienale) {
        raw.push({ nome: `${nomeP} · fianco contro il muro`, larghezza: round(F.prof), altezza: round(F.H), spessore: SP_SCHIENALE, materiale: 'piano', materialeNome: nomeSch, quantita: 1 });
      }
    }
  }
  // FINGER-PULL FRESATO: sull'anta / sul frontale la nota della presa da fresare (con il profilo il nome
  // dice già di quanto è più corto)
  if (!profiloFingerPull()) {
    const perIdF = new Map(mobili.map((m) => [m.id, m]));
    for (const p of raw) {
      if (!/^anta|^fronte cassetto/i.test(p.nome) || /sporgente/i.test(p.nome)) continue;
      const m = perIdF.get(p.moduloId); if (!m) continue;
      const sc = sceltePorte(progetto, m);
      if (!sc.gola && (p.fp != null ? p.fp : sc.fp)) p.nome += ' · presa finger-pull da fresare';
    }
  }
  const aggMap = new Map();
  for (const p of raw) {
    const gruppo = gruppoPezzo(p);
    const key = [gruppo, p.nome, p.larghezza, p.altezza, p.spessore, p.materiale, p.materialeNome, p.cerniere || ''].join('|');
    if (!aggMap.has(key)) aggMap.set(key, { gruppo, nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore, materiale: p.materiale, materialeNome: p.materialeNome, cerniere: p.cerniere || null, quantita: 0 });
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
  // STRISCE LED sotto i pensili e sotto il ponte: come nel 3D (ledCucina), una per fila, lunga quanto lì
  for (const S of ledCucina(progetto)) {
    const dove = S.dove === 'pensili' ? 'sotto i pensili' : S.dove === 'ponte' ? 'sotto il ponte' : 'sotto pensili e ponte';
    aggiungi(`Striscia LED ${round(S.lunghezza)} mm (${dove})`, 1);
  }
  // VETRI delle ante vetrina con telaio in legno (misura del vetro da ordinare)
  for (const p of raw) if (p.vetro) aggiungi(`Vetro ${p.vetro.tipo} ${p.vetro.w}×${p.vetro.h} (anta vetrina)`, p.quantita);
  // CASSETTI (guide/scatola) del sistema dei ⚙ Parametri: uno per frontale, piccolo / medio / grande
  for (const p of raw) {
    if (!p.nome.startsWith('Fronte cassetto')) continue;
    const c = cassettiDelMobile(progetto, perId.get(p.moduloId));       // il sistema di QUESTA cassettiera
    if (c.tipo === 'nostro') { aggiungi(`Guide per cassetto ${c.profondita} mm (coppia)${c.marca ? ' · ' + c.marca : ''}`, p.quantita); continue; }
    aggiungi(`Cassetti${c.marca ? ' ' + c.marca : ''} profondità ${c.profondita / 10} cm · ${tipoCassetto(p.altezza, parametri(), c).tipo}`, p.quantita);
  }
  // MANIGLIE: una per porta e per frontale, dove non c'è il finger-pull
  for (const p of raw) {
    if (!/^anta|^fronte cassetto/i.test(p.nome)) continue;
    if (/sporgente/i.test(p.nome)) continue;                     // anta sporgente: si apre da sotto, niente maniglia (come nel 3D)
    const cassetto = /^fronte cassetto/i.test(p.nome);           // i cassetti non hanno mai il push
    if (scelteDi(p).gola || fpDi(p) || (!cassetto && pushDi(p))) continue;
    aggiungi(`Maniglie · ${nomeManiglia(p)}`, p.quantita);
  }
  // PROFILO FINGER-PULL (⚙ Parametri): uno per anta / frontale, lungo come il suo bordo
  // (sulle colonne con l'apertura di lato è verticale: lungo come l'anta)
  {
    const Pfp = profiloFingerPull();
    if (Pfp) for (const p of raw) {
      if (!/^anta|^fronte cassetto/i.test(p.nome) || /sporgente/i.test(p.nome) || scelteDi(p).gola || !fpDi(p)) continue;
      const vert = (p.lato === 'sx' || p.lato === 'dx') && /^Anta (bassa|alta|intera)/.test(p.nome);
      aggiungi(`Profilo finger-pull ${Pfp} mm · lungo ${Math.round(vert ? p.altezza : p.larghezza)} mm`, p.quantita);
    }
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
      // da 10 o da 15 cm, come lo zoccolo (le colonne come i bassi)
      const hp = cat === 'colonna' ? zoccoloColonnaDi(progetto, m) : piediniCucina(progetto, m.altezza_mm || 700);
      aggiungi(`Piedini regolabili da ${hp / 10} cm`, m.tipo === 'base-angolo' ? 6 : piediniDi(L));
      aggiungi('Grappe zoccolo (fissaggio ai piedini)', 1);
    }
    if (cat === 'pensile') aggiungi('Kit per appendere i pensili', 1);
    if (m.tipo === 'forno' && !golaSuMobile(progetto, m)) aggiungi(`Griglia aerazione forno ${round(L - ariaL())} mm`, 1);
  }
  // GOLA IN ALLUMINIO: profili L (sotto il piano) e C (fra i cassetti) in barre da 4 m,
  // tappi sui capi liberi, angoli interni/esterni, supporti di fissaggio (uno per fianco)
  { const gc = golaProgetto(progetto);
    if (gc.base) {
      const pg = profiliGola(progetto), col = nomeColoreGola(gc.colore), GS = golaScelta(progetto);
      const marca = GS.nome ? ` · ${GS.nome}` : '', mBarra = (mm) => String(Math.round(mm) / 1000).replace('.', ',');
      for (const t of ['L', 'C']) {
        const prof = pg[t];
        if (!prof.length) continue;
        const b = barreGola(prof.map((p) => p.lung), GS.barra);
        aggiungi(`Profilo gola ${t}${marca} · ${col} · barre da ${mBarra(GS.barra)} m (tagli ${b.tagli.join(' + ')} mm)`, b.barre);
        aggiungi(`Tappi gola ${t}${marca} · ${col}`, prof.reduce((n, p) => n + p.capiLiberi, 0));
      }
      aggiungi(`Angoli interni gola L · ${col}`, pg.angoliInterni);
      aggiungi(`Angoli esterni gola L · ${col}`, pg.angoliEsterni);
      aggiungi('Supporti fissaggio gola (uno per fianco)', pg.fianchi);
      // COLONNE: profilo verticale centrale (fra due colonne) o laterale (verso il costado), 2 tappi ciascuno
      const gv = goleVerticali(progetto);
      for (const tipo of ['centrale', 'laterale']) {
        for (const sp of [16, 18]) {
          const lst = gv.filter((x) => x.tipo === tipo && (x.sp >= 17 ? 18 : 16) === sp);
          if (!lst.length) continue;
          const b = barreGola(lst.map((x) => x.lung), GS.barraV);
          aggiungi(`Profilo gola verticale ${tipo} ${String(lst[0].larghezza).replace('.', ',')} mm (fianchi da ${sp})${marca} · ${col} · barre da ${mBarra(GS.barraV)} m (tagli ${b.tagli.join(' + ')} mm)`, b.barre);
          aggiungi(`Tappi gola verticale ${tipo} (sopra e sotto)${marca} · ${col}`, 2 * lst.length);
        }
      }
    } }
  // ANGOLARI dello zoccolo: uno per ogni angolo a 90° (cucina a L 1, a U 2…), alti come lo zoccolo (10 o 15)
  for (const a of angoliZoccolo(trattiZoccolo)) aggiungi(`Angolari zoccolo 90° da ${String(a.zocc / 10).replace('.', ',')} cm`, 1);
  const ORDINE_ACC = ['Cerniere', 'Cassetti', 'Maniglie', 'Push', 'Profilo gola', 'Tappi gola', 'Angoli interni gola', 'Angoli esterni gola', 'Supporti fissaggio gola', 'Kit', 'Piedini', 'Grappe', 'Angolari', 'Griglia'];
  const pos = (n) => { const i = ORDINE_ACC.findIndex((k) => n.startsWith(k)); return i < 0 ? 99 : i; };
  const accessori = [...acc.entries()].map(([nome, quantita]) => ({ nome, quantita })).sort((x, y) => pos(x.nome) - pos(y.nome));

  // 4) Riepilogo.
  let totalePezzi = 0, mqAnte = 0, mqZoccolo = 0, mqMelaminico = 0;
  for (const p of pezzi) {
    totalePezzi += p.quantita;
    const mq = (p.larghezza * p.altezza * p.quantita) / 1e6;
    if (p.materiale === 'zoccolo') mqZoccolo += mq;
    else if (p.materiale === 'melaminico') mqMelaminico += mq;
    else if (['tavolo', 'vetro', 'gambe', 'piano'].includes(p.materiale)) continue;   // non sono ante (piano di lavoro, piano / tavolo)
    else mqAnte += mq;
  }
  const piedini = [...acc.entries()].filter(([k]) => k.startsWith('Piedini regolabili')).reduce((t, [, v]) => t + v, 0);
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
