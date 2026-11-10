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

/**
 * Profondità dei pezzi "esterni" della carcassa.
 * BATTENTE  (Passo 0):           Pc = P − sA − sS
 * SCORREVOLE (Passo 0a) top/fondo/fianco LARGO/ripiani:
 *                                Pc = P − sS
 */
export function profonditaCarcassa(config) {
  if (config.tipoArmadio === 'scorrevole') {
    return config.profonditaEsterna - config.spessoreSchiena;
  }
  return config.profonditaEsterna - config.spessoreAnte - config.spessoreSchiena;
}

/**
 * SCORREVOLE (Passo 0b) — profondità del FIANCO INTERNO (stretto),
 * arretrato per far scorrere l'anta: Pint = P − sS − B.
 * B = binario (75 default, 85 opzione).
 */
export function profonditaFiancoInterno(config) {
  const B = config.scorrevole?.binario ?? 75;
  return config.profonditaEsterna - config.spessoreSchiena - B;
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
 *   - Setup unico (top/fondo passanti, fianchi incassati).
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
    // Scorrevole: setup unico (top/fondo passanti).
    // Top e Fondo sono IDENTICI → un solo pezzo con quantità 2.
    pezzi.push({
      modulo: nomeModulo, nome: 'Top / Fondo',
      larghezza: modulo.larghezza, altezza: prof,
      spessore: config.spessoreCarcassa, materiale: 'carcassa', quantita: 2,
    });
    const altFianco = config.altezzaEsterna - 2 * config.spessoreCarcassa;
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
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: 'Schiena',
    larghezza: modulo.larghezza - 2,
    altezza: config.altezzaEsterna - 2,
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
  const prof = profonditaCarcassa(config);
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

/**
 * Calcola le ANTE A BATTENTE di un modulo.
 * Formula UNICA (i tamponamenti NON influenzano questa formula):
 *   larghezza_anta = (larghezza_modulo − (N + 1) × 2) ÷ N
 *   altezza_anta   = altezza_esterna − 4
 */
export function pezziAnteModulo(config, modulo, indiceModulo) {
  const N = modulo.numeroAnte || 1;
  const larAnta = (modulo.larghezza - (N + 1) * 2) / N;
  const altAnta = config.altezzaEsterna - 4;
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: N === 1
      ? `Anta (apertura ${modulo.antaLato === 'sx' ? 'sx' : 'dx'})`
      : `Anta (×${N})`,
    larghezza: larAnta,
    altezza: altAnta,
    spessore: config.spessoreAnte,
    materiale: 'ante',
    quantita: N,
  }];
}

/**
 * Costruisce i pezzi di UNA cassettiera scorrevole in UN modulo.
 * La cassettiera non è più "per modulo" ma globale: viene replicata
 * in ciascuno dei moduli selezionati nel suo campo `moduli` (indici 0-based).
 */
function _pezziCasScorrevole(config, cassettiera, modulo, indiceModulo) {
  const pezzi = [];
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const Lm = modulo.larghezza;
  const sC = config.spessoreCarcassa;
  const Pcas = profonditaFiancoInterno(config);
  const Pscatola = Pcas - sC - 2;

  const c = cassettiera;
  const N = Math.max(1, c.numCassetti || 4);
  const AltMax = Math.max(100, c.altMax || 800);
  const M = c.maniglia?.attiva ? (c.maniglia.M ?? 50) : 0;
  const larTF = Lm - 4 * sC;
  const profScatolaM = Pscatola - M;
  const altFianchi = AltMax - 4 * sC;
  const As = AltMax - 2 * sC;
  const larFronte = larTF - 4;
  const altFronte = (As - (N + 1) * 2) / N;

  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Top / Fondo',
    larghezza: larTF, altezza: profScatolaM,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fianco',
    larghezza: profScatolaM, altezza: altFianchi,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta laterale',
    larghezza: 50, altezza: AltMax - sC,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta sotto',
    larghezza: larTF, altezza: 50,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fronte cassetto',
    larghezza: larFronte, altezza: altFronte,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassFronti', quantita: N });
  return pezzi;
}

/**
 * Costruisce i pezzi di UNA cassettiera battente in UN modulo.
 */
function _pezziCasBattente(config, cassettiera, modulo, indiceModulo) {
  const pezzi = [];
  const nomeModulo = `Modulo ${indiceModulo + 1}`;
  const Lm = modulo.larghezza;
  const sC = config.spessoreCarcassa;
  const Pc = profonditaCarcassa(config);
  const Pscatola = Pc - 80 - sC;

  const c = cassettiera;
  const N = Math.max(1, c.numCassetti || 4);
  const AltMax = Math.max(100, c.altMax || 800);
  const larTF = Lm - 2 * sC - 80;
  const altFianchi = AltMax - 4 * sC;
  const As = AltMax - 2 * sC;
  const larFronte = larTF - 4;
  const altFronte = (As - (N + 1) * 2) / N;

  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Top / Fondo',
    larghezza: larTF, altezza: Pscatola,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fianco',
    larghezza: Pscatola, altezza: altFianchi,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta laterale',
    larghezza: 40, altezza: AltMax - sC,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fascetta sotto',
    larghezza: larTF, altezza: 40,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassStruttura', quantita: 2 });
  pezzi.push({ modulo: nomeModulo, nome: 'Cassettiera · Fronte cassetto',
    larghezza: larFronte, altezza: altFronte,
    spessore: sC, materiale: 'carcassa', parteMateriale: 'cassFronti', quantita: N });
  return pezzi;
}

/**
 * Produce tutti i pezzi di TUTTE le cassettiere dell'armadio, leggendo da
 * `config.cassettiere` (lista globale). Ogni cassettiera ha `moduli: [i,...]`
 * che indica in quali moduli (indici 0-based) va replicata.
 */
export function pezziCassettiereArmadio(config) {
  const casse = config.cassettiere || [];
  if (casse.length === 0) return [];
  const scorrevole = config.tipoArmadio === 'scorrevole';
  const builder = scorrevole ? _pezziCasScorrevole : _pezziCasBattente;
  const pezzi = [];
  casse.forEach((cas) => {
    const idxs = Array.isArray(cas.moduli) && cas.moduli.length > 0
      ? cas.moduli
      : config.moduli.map((_, i) => i); // di default in tutti i moduli
    idxs.forEach((i) => {
      const m = config.moduli[i];
      if (m) pezzi.push(...builder(config, cas, m, i));
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
  const Pcas = profonditaFiancoInterno(config);          // P − sS − B
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
    const altFronte = (As - (N + 1) * 2) / N;            // 5.7

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
  const Pc = profonditaCarcassa(config);                 // P − sA − sS
  const Pscatola = Pc - 80 - sC;                         // 5BIS.1

  modulo.cassettiere.forEach((c) => {
    const N = Math.max(1, c.numCassetti || 4);
    const AltMax = Math.max(100, c.altMax || 800);
    const larTF = Lm - 2 * sC - 80;                      // 5BIS.2
    const altFianchi = AltMax - 4 * sC;                  // uguale allo scorrevole
    const As = AltMax - 2 * sC;                          // uguale
    const larFronte = larTF - 4;                         // 5BIS.4
    const altFronte = (As - (N + 1) * 2) / N;            // uguale

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
  const t = config.tamponamenti || {};
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
 * ANTE SCORREVOLI (sezione 4.5 del documento) — formula definitiva.
 *
 *   Altezza anta   = H − 47
 *   Larghezza anta = Lm − 25  (dove Lm = L / numero_moduli)
 *   Spessore       = sA
 *
 * N = numero di ante per modulo (scelto dall'utente; default 2):
 *   - 1 ante/modulo → 1 anta che copre tutto il modulo, scorre sopra il
 *     modulo adiacente
 *   - 2 ante/modulo → 2 ante che si sovrappongono dentro lo stesso modulo
 *
 * Esempio (L=2000, 2 moduli, H=2400): Lm=1000 → anta 975 × 2353 × sA
 */
export function pezziAnteScorrevoliModulo(config, modulo, indiceModulo) {
  const N = config.scorrevole?.anteModulo ?? 2;
  const larAnta = modulo.larghezza - 25;
  const altAnta = config.altezzaEsterna - 47;
  return [{
    modulo: `Modulo ${indiceModulo + 1}`,
    nome: N === 1 ? 'Anta scorrevole' : `Anta scorrevole (×${N})`,
    larghezza: larAnta,
    altezza: altAnta,
    spessore: config.spessoreAnte,
    materiale: 'ante',
    quantita: N,
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
    if (battente) {
      pezzi.push(...pezziAnteModulo(config, m, i));
    } else {
      pezzi.push(...pezziAnteScorrevoliModulo(config, m, i));
    }
  });
  // Cassettiere: ora sono globali (config.cassettiere), con moduli[] = indici
  pezzi.push(...pezziCassettiereArmadio(config));
  pezzi.push(...pezziTamponamenti(config));
  // REGOLA GLOBALE: tutte le misure arrotondate PER DIFETTO (floor).
  // Vale per ogni pezzo della distinta, per non mai dare misure "più grandi
  // del reale" che potrebbero far sprecare materiale.
  const arrotondati = pezzi.map((p) => ({
    ...p,
    larghezza: Math.floor(p.larghezza),
    altezza: Math.floor(p.altezza),
    spessore: Math.floor(p.spessore),
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
    const mq = (p.larghezza * p.altezza) / 1_000_000; // mm² → m²
    totali[p.materiale] = (totali[p.materiale] || 0) + mq * p.quantita;
    totalePezzi += p.quantita;
  });
  return {
    totalePezzi,
    mqCarcassa: totali.carcassa,
    mqSchiena: totali.schiena,
    mqAnte: totali.ante,
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
