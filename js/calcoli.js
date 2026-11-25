// =============================================================================
// MOTORE DISTINTA DI TAGLIO - NG INTERIOR
// =============================================================================
// Modulo PURO e INDIPENDENTE dalla grafica 3D.
// Contiene SOLO le formule per calcolare le misure di ogni pezzo.
// Ogni funzione restituisce array di pezzi {modulo, nome, larghezza, altezza,
// spessore, materiale, quantita}. Tutte le misure in millimetri (mm).
//
// IMPORTANTE: le formule qui dentro sono quelle definite dall'utente nel
// prompt. NON modificarle "per ottimizzare": una distinta sbagliata spreca
// materiale.
// =============================================================================

import { binarioScorrevole, tiradorScorrevole, parametri, cassettiDi, sistemiCassetti, pezziCassettoNostro, cassettieraArmadio, tipoCassetto } from './parametri.js?v=20261126g';

/**
 * Profondità dei pezzi "esterni" della carcassa.
 * BATTENTE  (Passo 0):           Pc = P − sA − sS
 * SCORREVOLE (Passo 0a) top/fondo/fianco LARGO/ripiani:
 *                                Pc = P − sS
 */
export function profonditaCarcassa(config) {
  // la SCHIENA AVVITATA DIETRO sta fuori dalla struttura (si toglie); a filo o in canale sta dentro
  const sS = tipoSchiena(config) === 'dietro' ? config.spessoreSchiena : 0;
  if (config.tipoArmadio === 'scorrevole') return config.profonditaEsterna - sS;
  // ANTE INTERNE: l'anta sta dentro il vano, la struttura arriva fino davanti (non si toglie l'anta)
  if (anteInterne(config)) return config.profonditaEsterna - sS;
  return config.profonditaEsterna - config.spessoreAnte - sS;
}

/**
 * SCHIENA: come è montata (⚙ Parametri → Armadi, e nel singolo armadio).
 *   'dietro' = avvitata dietro (copre tutto il retro: modulo − 2 × altezza − 2) — come sempre
 *   'filo'   = incassata dentro, a filo del retro dei fianchi (vano interno: modulo − 2·sC × altezza − 2·sC)
 *   'canale' = nel canale fatto su fianchi, top e fondo, «dentro» mm dal retro, canale profondo «canale» mm
 *              (più grande del vano: + 2 × canale per lato)
 */
export function tipoSchiena(config) {
  const t = config && config.schiena && config.schiena.tipo;
  return t === 'filo' || t === 'canale' ? t : 'dietro';
}
export function misureSchiena(config) {
  const s = (config && config.schiena) || {};
  const n = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.max(0, Number(v)) : d);
  return { tipo: tipoSchiena(config), canale: n(s.canale, 8), dentro: n(s.dentro, 10) };
}
/** Quanti mm dal retro della struttura occupa la schiena (dietro 0 · a filo = spessore · in canale = dentro + spessore). */
export function schienaDentro(config) {
  const m = misureSchiena(config), sS = config.spessoreSchiena;
  return m.tipo === 'dietro' ? 0 : m.tipo === 'filo' ? sS : m.dentro + sS;
}

/** Armadio a battente con le ANTE INTERNE (dentro il vano, a filo della struttura)? */
export function anteInterne(config) {
  return config.tipoArmadio !== 'scorrevole' && config.anteInterne === true;
}
/**
 * Profondità dello spazio DENTRO, dietro le ante (cassettiere, barra): a battente P − sA − sS
 * (con le ante sopra o interne è la stessa); scorrevole = profondità della carcassa.
 */
export function profonditaDentro(config) {
  // davanti alla schiena (a filo o in canale sta dentro la struttura) e dietro l'anta
  const p = profonditaCarcassa(config) - schienaDentro(config);
  if (config.tipoArmadio === 'scorrevole') return p;
  return p - (anteInterne(config) ? config.spessoreAnte : 0);
}
/** Profondità dei RIPIANI: lo spazio dentro; con le ANTE INTERNE ancora indietro di «spazio anta–ripiano» (10 mm). */
export function profonditaRipiani(config) {
  // SCORREVOLE: davanti c'è il binario (le ante scorrono lì): i ripiani arrivano fino al binario
  if (config.tipoArmadio === 'scorrevole') return profonditaDentro(config) - (config.scorrevole?.binario ?? 75);
  return profonditaDentro(config) - (anteInterne(config) ? parametri().anteInterne.spazioRipiano : 0);
}
/** MANIGLIA delle ante a battente (catalogo materiali), o null. */
export function manigliaArmadio(config) {
  const id = config && config.maniglia;
  if (!id || id === 'nessuna' || typeof window === 'undefined') return null;
  return (window.NG_MATERIALI || []).find((m) => m.id === id && m.categoria === 'maniglia') || null;
}
/** Lunghezza standard della maniglia (quelle del catalogo con la loro misura; le altre 30 cm). */
export function lunghezzaManiglia(def) { return def.texture && def.lunghezzaMm ? def.lunghezzaMm : 300; }
/**
 * Lunghezza della maniglia SU QUESTA ANTA: quella scelta per l'armadio (config.manigliaLunghezza:
 * mm, oppure 'anta' = alta come l'anta) o quella del catalogo; MAI più lunga dell'anta (4 cm dai bordi).
 */
export function lunghezzaManigliaAnta(def, config, altAnta) {
  const scelta = config && config.manigliaLunghezza;
  const L = scelta === 'anta' ? altAnta - 80 : Number(scelta) > 0 ? Number(scelta) : lunghezzaManiglia(def);
  return Math.max(40, Math.min(L, altAnta - 80));
}
/**
 * MANIGLIA A PROFILO SUL BORDO (a J o «sul bordo»): sta sul bordo che apre, quindi l'anta è più
 * stretta del suo spessore (spessoreJ della maniglia, altrimenti ⚙ Parametri → maniglia a J).
 */
export function riduzioneManigliaArmadio(config) {
  const def = manigliaArmadio(config);
  if (!def || !['profilo', 'bordol'].includes(def.forma)) return 0;
  return Number(def.spessoreJ) > 0 ? Number(def.spessoreJ) : parametri().manigliaJ.spessore;
}
function nomeRiduzioneManiglia(config) {
  const def = manigliaArmadio(config);
  return def && def.forma === 'bordol' ? 'maniglia sul bordo' : 'maniglia a J';
}
/** Cerniere per anta, dall'altezza dell'anta. */
export function cerniereAnta(h) {
  return h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : h <= 2400 ? 5 : 6;
}

/**
 * SCORREVOLE (Passo 0b) — profondità del FIANCO INTERNO (stretto),
 * arretrato per far scorrere l'anta: Pint = P − sS − B.
 * B = binario (75 default, 85 opzione).
 */
export function profonditaFiancoInterno(config) {
  const B = config.scorrevole?.binario ?? 75;
  return profonditaCarcassa(config) - B;                 // P − sS − B (schiena dietro); P − B se la schiena sta dentro
}

/**
 * Calcola i pezzi della CARCASSA (top, fondo, fianchi) di UN modulo.
 *
 * BATTENTE:
 *   - Setup 1 (DEFAULT, top/fondo passanti): top e fondo coprono tutta la
 *     larghezza del modulo, i fianchi stanno in mezzo.
 *   - Setup 2 (fianchi passanti): i fianchi sono interi, top e fondo stanno
 *     in mezzo tra i fianchi.
 *
 * SCORREVOLE:
 *   - Setup 1 (top/fondo passanti, fianchi incassati) o setup 2 (fianchi esterni, top/fondo dentro).
 *   - Ogni modulo ha 2 fianchi, uno può essere "largo" (prof = P−sS) oppure
 *     "stretto" (prof = P−sS−B). Regola di posizione:
 *       • 1 solo modulo → entrambi larghi
 *       • N moduli (N≥2):
 *           fianco sx del modulo 0 = largo; fianco dx del modulo N−1 = largo;
 *           tutti gli altri = stretti.
 */
export function pezziCarcassaModulo(config, modulo, indiceModulo, totaleModuli = 1) {
  const prof = profonditaCarcassa(config);
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const pezzi = [];

  if (config.tipoArmadio === 'scorrevole') {
    // Scorrevole: struttura standard (top/fondo passanti, fianchi dentro) oppure FIANCHI ESTERNI
    // (setup 2: fianchi alti quanto l'armadio, top e fondo fra i fianchi: modulo − 2 × struttura).
    // Top e Fondo sono IDENTICI → un solo pezzo con quantità 2. Fianchi larghi/stretti come sempre.
    const fianchiEsterni = config.setupCarcassa === 2;
    pezzi.push({
      modulo: nomeModulo, nome: 'Top / Fondo',
      larghezza: fianchiEsterni ? modulo.larghezza - 2 * config.spessoreCarcassa : modulo.larghezza, altezza: prof,
      spessore: config.spessoreCarcassa, materiale: 'carcassa', quantita: 2,
    });
    const altFianco = fianchiEsterni ? config.altezzaEsterna : config.altezzaEsterna - 2 * config.spessoreCarcassa;
    const profStretto = profonditaFiancoInterno(config);
    // Regola larghi/stretti
    const sxLargo = indiceModulo === 0;
    const dxLargo = indiceModulo === totaleModuli - 1;
    pezzi.push({
      modulo: nomeModulo,
      nome: `Fianco sinistro (${sxLargo ? 'largo' : 'stretto'})`,
      larghezza: sxLargo ? prof : profStretto,
      altezza: altFianco,
      spessore: config.spessoreCarcassa, materiale: 'carcassa', quantita: 1,
    });
    pezzi.push({
      modulo: nomeModulo,
      nome: `Fianco destro (${dxLargo ? 'largo' : 'stretto'})`,
      larghezza: dxLargo ? prof : profStretto,
      altezza: altFianco,
      spessore: config.spessoreCarcassa, materiale: 'carcassa', quantita: 1,
    });
    return pezzi;
  }

  if (config.setupCarcassa === 1) {
    // Top/fondo passanti → larghezza = larghezza_modulo
    // Top e Fondo identici → un solo pezzo con quantità 2.
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Top / Fondo',
      larghezza: modulo.larghezza,
      altezza: prof,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 2,
    });
    // Fianchi: altezza = altezza_esterna − 2 × spessore_carcassa (stanno in mezzo)
    const altFianco = config.altezzaEsterna - 2 * config.spessoreCarcassa;
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Fianco sinistro',
      larghezza: prof,
      altezza: altFianco,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Fianco destro',
      larghezza: prof,
      altezza: altFianco,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
  } else {
    // Setup 2 — fianchi passanti → altezza = altezza_esterna
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Fianco sinistro',
      larghezza: prof,
      altezza: config.altezzaEsterna,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Fianco destro',
      larghezza: prof,
      altezza: config.altezzaEsterna,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
    // Top/fondo: larghezza = larghezza_modulo − 2 × spessore_carcassa
    // Top e Fondo identici → un solo pezzo con quantità 2.
    const larTF = modulo.larghezza - 2 * config.spessoreCarcassa;
    pezzi.push({
      modulo: nomeModulo,
      nome: 'Top / Fondo',
      larghezza: larTF,
      altezza: prof,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 2,
    });
  }

  return pezzi;
}

/**
 * Calcola la SCHIENA di un modulo.
 * Formula: (larghezza_modulo − 2) × (altezza_esterna − 2), spessore schiena.
 * I −2 mm sono tolleranza di taglio (viene avvitata sul retro).
 */
export function pezziSchienaModulo(config, modulo, indiceModulo) {
  const ms = misureSchiena(config), sC = config.spessoreCarcassa;
  // vano interno del modulo (fra i fianchi, fra top e fondo): la schiena a filo è grande così, in canale + 2 × canale
  const piu = ms.tipo === 'canale' ? 2 * ms.canale : 0;
  const dietro = ms.tipo === 'dietro';
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: dietro ? 'Schiena' : ms.tipo === 'filo' ? 'Schiena (incassata a filo)' : `Schiena (nel canale da ${ms.canale} mm)`,
    larghezza: dietro ? modulo.larghezza - 2 : modulo.larghezza - 2 * sC + piu,
    altezza: dietro ? config.altezzaEsterna - 2 : config.altezzaEsterna - 2 * sC + piu,
    spessore: config.spessoreSchiena,
    materiale: 'schiena',
    quantita: 1,
  }];
}

/**
 * Calcola i RIPIANI di un modulo.
 * Larghezza = larghezza_modulo − 2 × spessore_carcassa (sta tra i fianchi).
 * Profondità = profondita_carcassa, meno una eventuale riduzione utente.
 */
export function pezziRipianiModulo(config, modulo, indiceModulo) {
  if (!modulo.ripiani || modulo.ripiani <= 0) return [];
  const prof = profonditaRipiani(config);                // con le ante interne: 10 mm più indietro dell'anta
  const profRipiano = prof - (modulo.riduzioneRipiano || 0);
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: modulo.riduzioneRipiano
      ? `Ripiano (ridotto -${modulo.riduzioneRipiano})`
      : 'Ripiano',
    larghezza: modulo.larghezza - 2 * config.spessoreCarcassa,
    altezza: profRipiano,
    spessore: config.spessoreCarcassa,
    materiale: 'carcassa',
    quantita: modulo.ripiani,
  }];
}

/** PERCHERO del modulo: la barra con la sua misura + 2 ganci (ferramenta, non si taglia dal pannello). */
export function pezziBarraModulo(config, modulo, indiceModulo) {
  if (!modulo.barra) return [];
  const fin = modulo.barra === 'nero' ? 'nero' : 'alluminio satinato';
  return [
    { modulo: `Modulo ${indiceModulo + 1}`, nome: `Perchero ${fin} (barra ovale 30×15)`,
      larghezza: modulo.larghezza - 2 * config.spessoreCarcassa - 2, altezza: 30, spessore: 15,
      materiale: 'accessorio', finitura: modulo.barra, quantita: 1 },
    { modulo: `Modulo ${indiceModulo + 1}`, nome: `Gancio perchero ${fin}`,
      larghezza: null, altezza: null, spessore: null,
      materiale: 'accessorio', finitura: modulo.barra, quantita: 2 },
  ];
}

/**
 * Calcola le ANTE A BATTENTE di un modulo.
 * Formula UNICA (i tamponamenti NON influenzano questa formula):
 *   larghezza_anta = (larghezza_modulo − (N + 1) × 2) ÷ N
 *   altezza_anta   = altezza_esterna − 4
 */
export function pezziAnteModulo(config, modulo, indiceModulo) {
  const N = modulo.numeroAnte || 1;
  // maniglia a profilo sul bordo che apre: l'anta è più stretta del suo spessore (come nel 3D)
  const rid = riduzioneManigliaArmadio(config);
  const suff = rid ? ` · ${nomeRiduzioneManiglia(config)} (−${rid} mm)` : '';
  // le MANIGLIE che si vedono nel 3D: una per anta, con la sua lunghezza
  const def = manigliaArmadio(config);
  const maniglie = (altA) => def ? [{
    modulo: `Modulo ${indiceModulo + 1}`, nome: `${/^maniglia/i.test(def.nome || '') ? '' : 'Maniglia '}${def.nome} · ${Math.round(lunghezzaManigliaAnta(def, config, altA))} mm`,
    larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', finitura: def.id, finituraNome: def.nome, quantita: N,
  }] : [];
  if (anteInterne(config)) {
    // ANTE INTERNE: dentro il vano (modulo − 2 fianchi) × (altezza − top − fondo), con l'aria attorno
    //   larghezza = (Lm − 2·sC − (N + 1) × aria) ÷ N   ·   altezza = H − 2·sC − 2 × aria
    //   es. 1000 × 2000, 2 ante, struttura 18, aria 2 → (1000 − 36 − 6) ÷ 2 = 479 × (2000 − 36 − 4) = 1960
    const a = parametri().anteInterne.aria, sC = config.spessoreCarcassa;
    const larI = (modulo.larghezza - 2 * sC - (N + 1) * a) / N - rid;
    const altI = config.altezzaEsterna - 2 * sC - 2 * a;
    return [{
      modulo: `Modulo ${indiceModulo + 1}`,
      nome: (N === 1 ? `Anta interna (apertura ${modulo.antaLato === 'sx' ? 'sx' : 'dx'})` : `Anta interna (×${N})`) + suff,
      larghezza: larI, altezza: altI, spessore: config.spessoreAnte, materiale: 'ante', quantita: N,
    }, {
      modulo: `Modulo ${indiceModulo + 1}`, nome: 'Cerniere a gomito per anta interna',
      larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', finituraNome: 'Acciaio',
      quantita: N * cerniereAnta(altI),
    }, ...maniglie(altI)];
  }
  const larAnta = (modulo.larghezza - (N + 1) * 2) / N - rid;
  const altAnta = config.altezzaEsterna - 4;
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: (N === 1
      ? `Anta (apertura ${modulo.antaLato === 'sx' ? 'sx' : 'dx'})`
      : `Anta (×${N})`) + suff,
    larghezza: larAnta,
    altezza: altAnta,
    spessore: config.spessoreAnte,
    materiale: 'ante',
    quantita: N,
  }, {
    modulo: `Modulo ${indiceModulo + 1}`, nome: 'Cerniere per anta',
    larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', finituraNome: 'Acciaio',
    quantita: N * cerniereAnta(altAnta),
  }, ...maniglie(altAnta)];
}

// Spessore del melaminico bianco (fondo + trasera cassetto).
const SP_MEL_ARM = 16;

/**
 * GEOMETRIA di UNA cassettiera dentro un modulo largo Lm: la usano la distinta e il 3D.
 * Misure dai ⚙ Parametri (Armadio a battente / scorrevole → Cassettiera); di partenza:
 *   Battente:   scatola larga Lm − 2·sC − 2·40, profonda spazio dentro − 80 − sC (davanti resta lo spazio per la maniglia)
 *   Scorrevole: scatola larga Lm − 4·sC, profonda (spazio dentro − binario) − sC − 2 − M (M = spazio maniglia)
 *   Scatola alta AltMax − 2·sC: sotto le fascette sotto (sC), sopra il ripiano (top della cassettiera, sC)
 *   Frontali: larghi scatola − 2 fughe; ogni cassetto (As − (N+1) fughe) ÷ N; ribassati = più bassi di «ribasso»
 *   Ripiano sopra: scorrevole come gli altri ripiani (fino al binario); battente a filo dei frontali,
 *   con la maniglia fino alla maniglia.
 */
export function geometriaCassettiera(config, c, Lm) {
  const scorrevole = config.tipoArmadio === 'scorrevole';
  const P = cassettieraArmadio(scorrevole ? 'scorrevole' : 'battente');
  const sC = config.spessoreCarcassa;
  const N = Math.max(1, c.numCassetti || 4);
  const AltMax = Math.max(100, c.altMax || 800);
  // APERTURA: maniglia incassata (di partenza, fresata nel frontale: non sporge niente), maniglia esterna
  // (sporge di quanto scritto nella cassettiera), frontali ribassati (senza maniglia)
  const apertura = c.apertura === 'ribassati' ? 'ribassati' : c.apertura === 'maniglia' ? 'maniglia' : 'incassata';
  const ribassati = apertura === 'ribassati';
  const sporgenza = apertura === 'maniglia' && Number(c.sporgenza) > 0 ? Number(c.sporgenza) : 0;
  const sporgenzaMancante = apertura === 'maniglia' && !(Number(c.sporgenza) > 0);
  let larTF, profScatola, profRipiano;
  if (scorrevole) {
    const Pcas = profonditaDentro(config) - (config.scorrevole?.binario ?? 75);   // dalla schiena fino al binario
    larTF = Lm - 4 * sC;
    profScatola = Pcas - sC - P.ariaBinario - sporgenza;
    profRipiano = Pcas;                                   // come gli altri ripiani
  } else {
    larTF = Lm - 2 * sC - 2 * P.fascia;
    profScatola = profonditaDentro(config) - P.ariaDavanti - sporgenza - sC;
    const fronte = profScatola + 1 + sC;                  // faccia davanti dei frontali (dalla schiena)
    profRipiano = Math.min(profonditaDentro(config), apertura === 'maniglia' ? fronte + sporgenza : fronte);
  }
  const As = AltMax - 2 * sC;                             // fra la fascetta sotto e il ripiano
  const fuga = P.fuga;
  // ribasso: quello scritto nella cassettiera, altrimenti quello di partenza dei Parametri
  const ribasso = Number.isFinite(Number(c.ribasso)) && c.ribasso !== '' && c.ribasso != null ? Math.max(0, Number(c.ribasso)) : P.ribasso;
  // FRONTALI dall'alto in basso: { slot (spazio del cassetto), h (frontale da tagliare), y (bordo basso, da sopra la fascetta) }
  //   tutti uguali: (As − (N + 1) fughe) ÷ N
  //   personalizzati: il falegname scrive lo spazio di ogni cassetto; il frontale è quello meno la fuga
  //   (es. 150 → 148); gli spazi riempiono As − 1 fuga (la fuga sotto il ripiano)
  const spazioCassetti = As - fuga;
  const pers = c.divisione === 'personalizzata' && Array.isArray(c.altezze) && c.altezze.length === N
    && c.altezze.every((v) => Number(v) > 0);
  const fronti = [];
  if (pers) {
    let y = 0;
    const dalBasso = [];
    for (let i = N - 1; i >= 0; i--) { const sl = Number(c.altezze[i]); dalBasso.push({ i, slot: sl, y: y + fuga, h0: sl - fuga }); y += sl; }
    for (const f of dalBasso.reverse()) fronti.push(f);
  } else {
    const h0 = Math.floor((As - (N + 1) * fuga) / N);
    for (let i = 0; i < N; i++) fronti.push({ i, slot: h0 + fuga, y: fuga + (N - 1 - i) * (h0 + fuga), h0 });
  }
  for (const f of fronti) f.h = ribassati ? Math.max(20, f.h0 - ribasso) : f.h0;
  const sommaSpazi = fronti.reduce((t, f) => t + f.slot, 0);
  return {
    scorrevole, P, sC, N, AltMax, guida: c.guida || 500, apertura, ribassati, maniglia: apertura === 'maniglia',
    incassata: apertura === 'incassata', sporgenza, sporgenzaMancante,
    larTF, profScatola, profRipiano, As, fronti, personalizzata: pers,
    spazioCassetti: pers ? spazioCassetti : null, differenza: pers ? Math.round(spazioCassetti - sommaSpazi) : 0,
    altFronte: fronti[0].h0, ribasso, altFrontale: fronti[0].h,
    larFronte: larTF - 2 * fuga, fuga,
    fascia: P.fascia, fasciaSotto: P.fasciaSotto,
    larRipiano: Lm - 2 * sC, interno: larTF - 2 * sC,
  };
}
/** Spazi dei cassetti di partenza per «personalizzata»: tutti uguali, il resto all'ultimo. */
export function spaziCassettiDiPartenza(config, c, Lm) {
  const G = geometriaCassettiera(config, { ...c, divisione: 'uguali' }, Lm);
  const N = G.N, tot = G.As - G.fuga, base = Math.floor(tot / N);
  return Array.from({ length: N }, (_, i) => (i === N - 1 ? tot - base * (N - 1) : base));
}

/**
 * Fondo + trasera del cassetto A SISTEMA (guide e fianchi del produttore), oppure i pezzi del
 * cassetto SU MISURA. `altF` = altezza dello spazio del cassetto (dice se è piccolo, medio o grande).
 * Fondo profondo guida − «fondoMeno» (di partenza 20: guida 500 → 480).
 * Trasera: altezza dal sistema di cassetti dei ⚙ Parametri (di partenza 59 fino al frontale da 155, poi 155).
 * LARGHEZZA: dallo spazio fra i fianchi della cassettiera (`interno`), come in cucina:
 * fondo = interno − (53 − 2 × 18), trasera = interno − (72 − 2 × 18).
 * Es. battente, modulo 500: interno 348 → fondo 331 (= 500 − 169), trasera 312 (= 500 − 188).
 */
function _cassettoMelArmadio(pezzi, nomeModulo, Lm, altF, guida, N, cassettiera = null, interno = null, fondoMeno = 20) {
  // CASSETTO SU MISURA (scelto nella cassettiera): scatola tagliata da noi nello spazio della cassettiera
  const sis = cassettiera && cassettiera.sistemaCassetti ? cassettiDi(cassettiera.sistemaCassetti) : null;
  if (sis && sis.tipo === 'nostro' && interno) {
    for (const p of pezziCassettoNostro(sis, interno, altF, guida, N)) pezzi.push({ modulo: nomeModulo, ...p, materiale: 'melaminico' });
    pezzi.push({ modulo: nomeModulo, nome: `Guide per cassetto ${guida} mm (coppia)${sis.marca ? ' · ' + sis.marca : ''}`, larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', quantita: N });
    return;
  }
  // sistema a guide comprate: quello della cassettiera, se è a sistema, altrimenti il primo a sistema dei Parametri
  const sisC = sis && sis.tipo !== 'nostro' ? sis : (sistemiCassetti().find((x) => x.tipo !== 'nostro') || parametri().cassetti);
  const t = tipoCassetto(altF, parametri(), sisC);
  const fm2 = 2 * (sisC.fianchiMobile ?? 18);                      // i 2 fianchi del mobile da cucina, già dentro 53 e 72
  const larFondo = interno != null ? interno - (sisC.fondoMeno - fm2) : Lm - sisC.fondoMeno;
  const larTrasera = interno != null ? interno - (sisC.traseraMeno - fm2) : Lm - sisC.traseraMeno;
  pezzi.push({ modulo: nomeModulo, nome: 'Cassetto · fondo',
    larghezza: Math.round(larFondo), altezza: Math.round(guida - fondoMeno),
    spessore: SP_MEL_ARM, materiale: 'melaminico', quantita: N });
  pezzi.push({ modulo: nomeModulo, nome: `Cassetto · trasera ${t.tipo}`,
    larghezza: Math.round(larTrasera), altezza: t.trasera,
    spessore: SP_MEL_ARM, materiale: 'melaminico', quantita: N });
}

/**
 * Pezzi di UNA cassettiera in UN modulo (la cassettiera è globale: si ripete nei moduli del suo campo `moduli`).
 * Frontali, scatola (top e fondo, fianchi fra top e fondo), cornice (fascette laterali e fascetta sotto
 * davanti, a filo dei frontali) + fascetta sotto dietro, ripiano sopra (top), maniglie, fondo e trasera.
 */
function _pezziCassettiera(config, c, modulo, indiceModulo) {
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const G = geometriaCassettiera(config, c, modulo.larghezza);
  const { sC, N } = G;
  const str = { spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura' };
  const pezzi = [];
  // FRONTALI (uguali o di misure diverse): uno per misura
  const nomeF = G.ribassati ? 'Cassettiera · Fronte cassetto (ribassato)'
    : G.incassata ? 'Cassettiera · Fronte cassetto (fresata per la maniglia incassata)' : 'Cassettiera · Fronte cassetto';
  const perH = new Map();
  for (const f of G.fronti) { const k = `${f.h}|${f.h0}`; perH.set(k, { h: f.h, h0: f.h0, q: ((perH.get(k) || {}).q || 0) + 1 }); }
  for (const { h, q } of perH.values()) pezzi.push({ modulo: nomeModulo, nome: nomeF, larghezza: Math.round(G.larFronte), altezza: Math.round(h), spessore: sC, materiale: 'carcassa', parteMateriale: 'cassFronti', quantita: q });
  pezzi.push(
    { modulo: nomeModulo, nome: 'Cassettiera · Top / Fondo', larghezza: G.larTF, altezza: G.profScatola, ...str, quantita: 2 },
    { modulo: nomeModulo, nome: 'Cassettiera · Fianco', larghezza: G.profScatola, altezza: G.AltMax - 4 * sC, ...str, quantita: 2 },
    { modulo: nomeModulo, nome: 'Cassettiera · Fascetta laterale', larghezza: G.fascia, altezza: G.AltMax - sC, ...str, quantita: 2 },
    { modulo: nomeModulo, nome: 'Cassettiera · Fascetta sotto', larghezza: G.larTF, altezza: G.fasciaSotto, ...str, quantita: 2 },
    { modulo: nomeModulo, nome: 'Cassettiera · Ripiano sopra (top)', larghezza: G.larRipiano, altezza: G.profRipiano, spessore: sC, materiale: 'carcassa', quantita: 1 },
  );
  const acc = (nome) => pezzi.push({ modulo: nomeModulo, nome, larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', quantita: N });
  if (G.incassata) acc('Maniglia incassata (da incassare nel frontale)');
  else if (G.maniglia) acc(G.sporgenzaMancante ? 'Maniglia cassetto · ATTENZIONE: sporgenza da scegliere' : `Maniglia cassetto · sporge ${G.sporgenza} mm`);
  // cassetto: nello spazio fra i fianchi della cassettiera; piccolo/medio/grande dallo spazio del cassetto
  const perSlot = new Map();
  for (const f of G.fronti) perSlot.set(f.h0, (perSlot.get(f.h0) || 0) + 1);
  for (const [h0, q] of perSlot) _cassettoMelArmadio(pezzi, nomeModulo, modulo.larghezza, h0, G.guida, q, c, G.interno, G.P.fondoMeno);
  return pezzi;
}
/** Cassettiere con la maniglia esterna senza la sporgenza scritta (prima di esportare si avvisa). */
export function cassettiereSenzaSporgenza(config) {
  return (config.cassettiere || []).map((c, j) => ({ c, j })).filter(({ c }) => c.apertura === 'maniglia' && !(Number(c.sporgenza) > 0)).map(({ j }) => j + 1);
}

/**
 * Produce tutti i pezzi di TUTTE le cassettiere dell'armadio, leggendo da
 * `config.cassettiere` (lista globale). Ogni cassettiera ha `moduli: [i,...]`
 * che indica in quali moduli (indici 0-based) va replicata.
 */
export function pezziCassettiereArmadio(config) {
  const casse = config.cassettiere || [];
  if (casse.length === 0) return [];
  const pezzi = [];
  casse.forEach((cas) => {
    const idxs = Array.isArray(cas.moduli) && cas.moduli.length > 0
      ? cas.moduli
      : config.moduli.map((_, i) => i); // di default in tutti i moduli
    idxs.forEach((i) => {
      const m = config.moduli[i];
      if (m) pezzi.push(..._pezziCassettiera(config, cas, m, i));
    });
  });
  return pezzi;
}

/**
 * CASSETTIERA SCORREVOLE (sezione 5 del documento).
 *
 * Variabili:
 *   Lm       = larghezza modulo
 *   AltMax   = altezza zona cassettiera (input utente)
 *   N        = numero cassetti
 *   M        = spazio maniglia (0 se OFF, default 50 se ON, modificabile)
 *   Pcas     = P − sS − B                (riferimento fianco stretto)
 *   Pscatola = Pcas − sC − 2             (profondità vera della scatola)
 *   As       = AltMax − 2·sC             (altezza scatola, divide i cassetti)
 *
 * Pezzi generati per ogni cassettiera:
 *   Top/Fondo  (Lm − 4·sC) × (Pscatola − M) × sC          q 1+1
 *   Fianchi    (Pscatola − M) × (AltMax − 4·sC) × sC      q 2
 *   Fasc. lat. 50 × (AltMax − sC) × sC   (profondità propria 50, non Pcas)  q 2
 *   Fasc. sotto (Lm − 4·sC) × 50 × sC    (profondità propria 50)            q 2 (1 + scorta)
 *   Fronte cassetto (Lm − 4·sC − 4) × ((As − (N+1)·2)/N) × sC [MATERIALE sC!]  q N
 */
export function pezziCassettieraScorrevoleModulo(config, modulo, indiceModulo) {
  if (!modulo.cassettiere || modulo.cassettiere.length === 0) return [];
  if (config.tipoArmadio !== 'scorrevole') return [];
  const pezzi = [];
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const Lm = modulo.larghezza;
  const sC = config.spessoreCarcassa;
  const Pcas = profonditaDentro(config) - (config.scorrevole?.binario ?? 75);   // P − sS − B (davanti alla schiena)
  const Pscatola = Pcas - sC - 2;                        // 5.1

  modulo.cassettiere.forEach((c) => {
    const N = Math.max(1, c.numCassetti || 4);
    const AltMax = Math.max(100, c.altMax || 800);
    const M = c.maniglia?.attiva ? (c.maniglia.M ?? 50) : 0;
    const larTF = Lm - 4 * sC;                           // 5.2
    const profScatolaM = Pscatola - M;                   // 5.6 maniglia
    const altFianchi = AltMax - 4 * sC;                  // 5.3
    const As = AltMax - 2 * sC;                          // 5.4
    const larFronte = larTF - 4;                         // 5.7
    const altFronte = Math.floor((As - (N + 1) * 2) / N);            // 5.7

    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Top / Fondo',
      larghezza: larTF, altezza: profScatolaM,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fianco',
      larghezza: profScatolaM, altezza: altFianchi,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    // 5.5 Fascette laterali — profondità propria 50 mm (non Pcas)
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta laterale',
      larghezza: 50, altezza: AltMax - sC,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    // 5.5 Fascette sotto ×2 (1 + 1 scorta)
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta sotto',
      larghezza: larTF, altezza: 50,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    // 5.7 Fronte cassetto — SPESSORE sC (struttura), NON ante
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fronte cassetto',
      larghezza: larFronte, altezza: altFronte,
      spessore: sC, materiale: 'carcassa', quantita: N });
  });
  return pezzi;
}

/**
 * CASSETTIERA BATTENTE (sezione 5BIS del documento).
 *
 * Differenze rispetto allo scorrevole:
 *   - Profondità scatola = Pc − 80 − sC   (Pc = P − sA − sS, no binario)
 *   - Larghezza top/fondo = Lm − 2·sC − 80  (fascette di PIATTO, 40 mm per lato)
 *   - Fascette di piatto: pezzo 40 × lunghezza × sC (profondità propria 40)
 *   - Fronte cassetto larghezza = (Lm − 2·sC − 80) − 4
 *   - Fronte cassetto spessore = sC
 *   - Nessuna opzione maniglia nel battente (non prevista dalla spec)
 */
export function pezziCassettieraBattenteModulo(config, modulo, indiceModulo) {
  if (!modulo.cassettiere || modulo.cassettiere.length === 0) return [];
  if (config.tipoArmadio === 'scorrevole') return [];
  const pezzi = [];
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const Lm = modulo.larghezza;
  const sC = config.spessoreCarcassa;
  const Pc = profonditaDentro(config);                   // P − sA − sS (anche con le ante interne: sta dietro l'anta)
  const Pscatola = Pc - 80 - sC;                         // 5BIS.1

  modulo.cassettiere.forEach((c) => {
    const N = Math.max(1, c.numCassetti || 4);
    const AltMax = Math.max(100, c.altMax || 800);
    const larTF = Lm - 2 * sC - 80;                      // 5BIS.2
    const altFianchi = AltMax - 4 * sC;                  // uguale allo scorrevole
    const As = AltMax - 2 * sC;                          // uguale
    const larFronte = larTF - 4;                         // 5BIS.4
    const altFronte = Math.floor((As - (N + 1) * 2) / N);            // uguale

    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Top / Fondo',
      larghezza: larTF, altezza: Pscatola,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fianco',
      larghezza: Pscatola, altezza: altFianchi,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    // 5BIS.3 Fascette di PIATTO (profondità propria 40, non 50)
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta laterale',
      larghezza: 40, altezza: AltMax - sC,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta sotto',
      larghezza: larTF, altezza: 40,
      spessore: sC, materiale: 'carcassa', quantita: 2 });
    // 5BIS.4 Fronte cassetto — spessore sC (struttura)
    pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fronte cassetto',
      larghezza: larFronte, altezza: altFronte,
      spessore: sC, materiale: 'carcassa', quantita: N });
  });
  return pezzi;
}

/**
 * Dispatcher: sceglie la cassettiera giusta in base al tipo di armadio.
 */
export function pezziCassettiereModulo(config, modulo, indiceModulo) {
  if (config.tipoArmadio === 'scorrevole') {
    return pezziCassettieraScorrevoleModulo(config, modulo, indiceModulo);
  }
  return pezziCassettieraBattenteModulo(config, modulo, indiceModulo);
}

/**
 * Calcola i TAMPONAMENTI (fino a 4: sinistro, destro, sopra, sotto).
 * Ogni tamponamento ATTIVO è un pezzo a L = faccia frontale + fascia.
 *   - Faccia frontale: spessore ante, larghezza = valore utente,
 *     lunghezza secondo il lato:
 *       laterale (sx/dx) → altezza_esterna
 *       sopra/sotto     → larghezza_totale + tamp_sx + tamp_dx
 *   - Fascia di fissaggio: spessore carcassa, profondità 30 mm,
 *     lunghezza = lunghezza_faccia − 2 mm (tolleranza).
 */
export function pezziTamponamenti(config) {
  // sul lato con il COSTADO a vista il tamponamento laterale non c'è (l'armadio non è incassato lì)
  const cos = misureCostado(config), t0 = config.tamponamenti || {};
  const t = { ...t0, sx: cos.sx ? null : t0.sx, dx: cos.dx ? null : t0.dx };
  const pezzi = [];

  const larSx = t.sx && t.sx.attivo ? t.sx.larghezza : 0;
  const larDx = t.dx && t.dx.attivo ? t.dx.larghezza : 0;

  // Laterale sinistro
  if (t.sx && t.sx.attivo) {
    const lunghezza = config.altezzaEsterna;
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Faccia tamponamento SX',
      larghezza: t.sx.larghezza,
      altezza: lunghezza,
      spessore: config.spessoreAnte,
      materiale: 'ante',
      quantita: 1,
    });
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Fascia fissaggio SX',
      larghezza: 30,
      altezza: lunghezza - 2,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
  }

  // Laterale destro
  if (t.dx && t.dx.attivo) {
    const lunghezza = config.altezzaEsterna;
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Faccia tamponamento DX',
      larghezza: t.dx.larghezza,
      altezza: lunghezza,
      spessore: config.spessoreAnte,
      materiale: 'ante',
      quantita: 1,
    });
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Fascia fissaggio DX',
      larghezza: 30,
      altezza: lunghezza - 2,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
  }

  // Sopra (versione B: appoggia SOPRA i laterali e copre tutto il fronte)
  if (t.sopra && t.sopra.attivo) {
    const lunghezza = config.larghezzaTotale + larSx + larDx;
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Faccia tamponamento SOPRA',
      larghezza: lunghezza,
      altezza: t.sopra.larghezza,
      spessore: config.spessoreAnte,
      materiale: 'ante',
      quantita: 1,
    });
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Fascia fissaggio SOPRA',
      larghezza: lunghezza - 2,
      altezza: 30,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
  }

  // Sotto (versione B)
  if (t.sotto && t.sotto.attivo) {
    const lunghezza = config.larghezzaTotale + larSx + larDx;
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Faccia tamponamento SOTTO',
      larghezza: lunghezza,
      altezza: t.sotto.larghezza,
      spessore: config.spessoreAnte,
      materiale: 'ante',
      quantita: 1,
    });
    pezzi.push({
      modulo: 'Tamponamenti',
      nome: 'Fascia fissaggio SOTTO',
      larghezza: lunghezza - 2,
      altezza: 30,
      spessore: config.spessoreCarcassa,
      materiale: 'carcassa',
      quantita: 1,
    });
  }

  return pezzi;
}

/**
 * COSTADI (fianchi a vista, per gli armadi NON incassati): un pannello per lato, scelto
 * dall'utente (nessuno, solo sinistro, solo destro, tutti e due). Formula dell'utente:
 *   Altezza    = altezza TOTALE dell'armadio (H, più i tamponamenti sopra/sotto se ci sono:
 *                il costado va dal pavimento fino in cima)
 *   Profondità = top (profondità carcassa) + schiena + spessore ante + sporgenza (2 mm)
 *                es. top 500 + schiena 10 + ante 18 + 2 = 530 mm
 *                (SCORREVOLE: le ante scorrono dentro la profondità del top → top + schiena + 2)
 *   Spessore   = spessore ante (o quello scelto), materiale «costadi» (di partenza come le ante)
 * Il costado sta FUORI dalla larghezza dei moduli: la larghezza totale diventa L + i costadi.
 */
export function misureCostado(config) {
  const c = config.costadi || {};
  const lati = c.lati || 'nessuno';
  const battente = config.tipoArmadio !== 'scorrevole';
  const top = profonditaCarcassa(config);
  const sporgenza = Number.isFinite(c.sporgenza) ? Math.max(0, c.sporgenza) : 2;
  const t = config.tamponamenti || {};
  const sopra = t.sopra && t.sopra.attivo ? t.sopra.larghezza : 0;
  const sotto = t.sotto && t.sotto.attivo ? t.sotto.larghezza : 0;
  return {
    sx: lati === 'sx' || lati === 'entrambi',
    dx: lati === 'dx' || lati === 'entrambi',
    spessore: c.spessore > 0 ? c.spessore : config.spessoreAnte,
    sporgenza, top, battente, sopra, sotto,
    // con le ANTE INTERNE davanti non c'è l'anta: la struttura arriva già fino davanti
    profondita: top + (tipoSchiena(config) === 'dietro' ? config.spessoreSchiena : 0) + (battente && !anteInterne(config) ? config.spessoreAnte : 0) + sporgenza,
    altezza: config.altezzaEsterna + sopra + sotto,
  };
}

export function pezziCostadi(config) {
  const c = misureCostado(config), pezzi = [];
  for (const [attivo, lato] of [[c.sx, 'SX'], [c.dx, 'DX']]) {
    if (!attivo) continue;
    pezzi.push({
      modulo: 'Costadi', nome: `Costado ${lato}`,
      larghezza: c.profondita, altezza: c.altezza, spessore: c.spessore,
      materiale: 'costadi', quantita: 1,
    });
  }
  return pezzi;
}

/**
 * ANTE SCORREVOLI — con i numeri del BINARIO scelto (⚙ Impostazioni → Parametri → Binari):
 *
 *   Larghezza anta = larghezza esterna ÷ numero di ante − larghezzaMeno − profilo
 *   Altezza anta   = H − altezzaMeno   (H = altezza esterna totale: fianchi + top + fondo)
 *   Spessore       = sA
 *
 * Di partenza l'anta è larga come il MODULO (larghezzaMeno e profilo = 0): armadio 1000 a 2 moduli,
 * 1 anta per modulo → 500. Ogni falegname toglie poi quello che serve al suo binario.
 * profilo = i profili verticali a tutta altezza sui due lati di ogni anta (al posto delle maniglie).
 * Esempio altezza: armadio alto 2500 → anta 2500 − 82 = 2418
 */
export function binarioArmadio(config) {
  return binarioScorrevole(config.scorrevole?.tipoBinario);
}
/** Il TIRADOR scelto per le ante scorrevoli (profilo a tutta altezza sui due lati; ⚙ Parametri). */
export function tiradorArmadio(config) {
  return tiradorScorrevole(config.scorrevole?.tirador);
}
/** La maniglia è alta come l'anta (da terra a soffitto)? (ante a battente) */
export function manigliaTuttaAltezza(config) {
  return !!config.maniglia && config.manigliaLunghezza === 'anta';
}
export function numeroAnteScorrevoli(config) {
  return Math.max(1, (config.moduli || []).length * (config.scorrevole?.anteModulo ?? 1));
}
export function larghezzaAntaScorrevole(config) {
  const b = binarioArmadio(config);
  const Lest = (config.moduli || []).reduce((t, m) => t + (Number(m.larghezza) || 0), 0);
  return Lest / numeroAnteScorrevoli(config) - b.larghezzaMeno - tiradorArmadio(config).togli;
}
export function altezzaAntaScorrevole(config) {
  return config.altezzaEsterna - binarioArmadio(config).altezzaMeno;
}
/** Colore dei profili delle ante scorrevoli (come i binari; di partenza bianco). */
export const PROFILO_SCORREVOLE_DEFAULT = 'binario-bianco';
export function coloreProfiloScorrevole(config) { return config.scorrevole?.coloreProfilo || PROFILO_SCORREVOLE_DEFAULT; }
function nomeColoreProfilo(id) {
  const m = typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === id);
  if (m) return m.nome;
  return { 'binario-bianco': 'Bianco', 'binario-nero': 'Nero', 'binario-grigio': 'Grigio' }[id] || id;
}
export function pezziAnteScorrevoliModulo(config, modulo, indiceModulo) {
  const N = config.scorrevole?.anteModulo ?? 1;
  const larAnta = larghezzaAntaScorrevole(config);
  const altAnta = altezzaAntaScorrevole(config);
  const col = coloreProfiloScorrevole(config);
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: N === 1 ? 'Anta scorrevole' : `Anta scorrevole (×${N})`,
    larghezza: larAnta,
    altezza: altAnta,
    spessore: config.spessoreAnte,
    materiale: 'ante',
    quantita: N,
  }, {
    // PROFILO VERTICALE a tutta altezza su ENTRAMBI i lati di ogni anta (al posto delle maniglie)
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: `Tirador ${tiradorArmadio(config).nome || ''} (profilo verticale anta scorrevole) · ${nomeColoreProfilo(col)}`.replace('Tirador  (', 'Tirador ('),
    larghezza: null, altezza: Math.round(altAnta), spessore: null,
    materiale: 'accessorio', finitura: col === 'binario-nero' ? 'nero' : col, finituraNome: nomeColoreProfilo(col),
    quantita: 2 * N,
  }];
}

/**
 * Costruisce la distinta COMPLETA dell'armadio: somma i pezzi di ogni
 * modulo (carcassa, schiena, ripiani, ante o ante scorrevoli, cassettiere)
 * più i tamponamenti d'insieme. I pezzi identici (stesse dimensioni,
 * materiale e spessore) vengono raggruppati con la somma delle quantità.
 */
export function calcolaDistintaCompleta(config) {
  const pezzi = [];
  const battente = config.tipoArmadio !== 'scorrevole';
  const N = config.moduli.length;
  config.moduli.forEach((m, i) => {
    pezzi.push(...pezziCarcassaModulo(config, m, i, N));
    pezzi.push(...pezziSchienaModulo(config, m, i));
    pezzi.push(...pezziRipianiModulo(config, m, i));
    pezzi.push(...pezziBarraModulo(config, m, i));
    if (battente) {
      pezzi.push(...pezziAnteModulo(config, m, i));
    } else {
      pezzi.push(...pezziAnteScorrevoliModulo(config, m, i));
    }
  });
  // Cassettiere: ora sono globali (config.cassettiere), con moduli[] = indici
  pezzi.push(...pezziCassettiereArmadio(config));
  pezzi.push(...pezziTamponamenti(config));
  pezzi.push(...pezziCostadi(config));
  // REGOLA GLOBALE: tutte le misure arrotondate PER DIFETTO (floor).
  // Vale per ogni pezzo della distinta, per non mai dare misure "più grandi
  // del reale" che potrebbero far sprecare materiale.
  const arrotondati = pezzi.map((p) => ({
    ...p,
    larghezza: p.larghezza == null ? null : Math.floor(p.larghezza),
    altezza: p.altezza == null ? null : Math.floor(p.altezza),
    spessore: p.spessore == null ? null : Math.floor(p.spessore),
  }));
  const raggruppati = raggruppaPezzi(arrotondati);
  return {
    pezzi: raggruppati,
    riepilogo: calcolaRiepilogo(raggruppati),
  };
}

/**
 * Normalizza il nome del pezzo togliendo "sinistro/destro" e "SX/DX",
 * così pezzi fisicamente identici si raggruppano con un solo nome.
 */
function normalizzaNome(nome) {
  return nome
    .replace(/\s+sinistro/i, '')
    .replace(/\s+destro/i, '')
    .replace(/\s+SX\b/, ' laterale')
    .replace(/\s+DX\b/, ' laterale')
    .replace(/\s*\(cassettiera\s*\d+\)/i, '')
    .replace(/\s*\(×\d+\)/, '')
    .trim();
}

/**
 * Raggruppa i pezzi uguali (nome normalizzato + larghezza + altezza +
 * spessore + materiale) sommando le quantità.
 */
export function raggruppaPezzi(pezzi) {
  const mappa = new Map();
  for (const p of pezzi) {
    const nomeN = normalizzaNome(p.nome);
    const chiave = `${nomeN}|${p.larghezza}|${p.altezza}|${p.spessore}|${p.materiale}`;
    if (mappa.has(chiave)) {
      mappa.get(chiave).quantita += p.quantita;
    } else {
      mappa.set(chiave, { ...p, nome: nomeN });
    }
  }
  return Array.from(mappa.values());
}

/**
 * Totali: conta pezzi e calcola i metri quadri di pannello per materiale.
 */
export function calcolaRiepilogo(pezzi) {
  const totali = { carcassa: 0, schiena: 0, ante: 0 };
  let totalePezzi = 0;
  pezzi.forEach((p) => {
    if (p.materiale === 'accessorio') { totalePezzi += p.quantita; return; }   // ferramenta: niente m²
    const mq = (p.larghezza * p.altezza) / 1_000_000; // mm² → m²
    totali[p.materiale] = (totali[p.materiale] || 0) + mq * p.quantita;
    totalePezzi += p.quantita;
  });
  return {
    totalePezzi,
    mqCarcassa: totali.carcassa,
    mqSchiena: totali.schiena,
    mqAnte: totali.ante,
    mqMelaminico: totali.melaminico || 0,
    mqCostadi: totali.costadi || 0,
  };
}

/**
 * Validazione di base della configurazione — ritorna un array di errori
 * (stringhe) o vuoto se tutto è ok. Non blocca il calcolo, serve all'UI.
 */
export function validaConfig(config) {
  const errori = [];
  if (config.larghezzaTotale <= 0) errori.push('Larghezza totale non valida');
  if (config.altezzaEsterna <= 0) errori.push('Altezza esterna non valida');
  if (config.profonditaEsterna <= 0) errori.push('Profondità esterna non valida');
  // Nota: non valido la somma moduli perché, applicando l'arrotondamento
  // per difetto, la somma può essere leggermente inferiore a L (max n-1 mm).
  // È uno scarto accettato: tutte le misure sono "al minimo intero".
  // Tamponamenti: minimo 20 mm
  ['sx', 'dx', 'sopra', 'sotto'].forEach((lato) => {
    const t = config.tamponamenti?.[lato];
    if (t && t.attivo && t.larghezza < 20) {
      errori.push(`Tamponamento ${lato}: minimo 20 mm.`);
    }
  });
  // Scorrevole: parametri validi (binario 75/85, ante per modulo ≥1)
  if (config.tipoArmadio === 'scorrevole') {
    const s = config.scorrevole || {};
    if ((s.anteModulo || 2) < 1) errori.push('Scorrevole: almeno 1 anta per modulo.');
    const B = s.binario ?? 75;
    if (B !== 75 && B !== 85) errori.push('Scorrevole: binario deve essere 75 o 85.');
  }
  return errori;
}
