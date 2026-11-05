// =============================================================================
// VISTA 3D - NG INTERIOR
// =============================================================================
// Rendering dell'armadio con Three.js. Separato dalla logica di calcolo:
// qui si disegna soltanto, le misure arrivano già pronte dal config.
// Sistema di assi:
//   X = larghezza (0 = fianco sinistro dell'armadio)
//   Y = altezza   (0 = pavimento)
//   Z = profondità (0 = parete di fondo, +Z = verso l'osservatore)
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { profonditaCarcassa, profonditaFiancoInterno } from './calcoli.js';
import { getMaterialeTHREE } from './materiali.js';

// Scala fisica del tiling della texture legno: 1 "ripetizione" = N mm.
// Il campione reale è ~400×200mm → uso 300mm come compromesso: su un'anta
// alta 2m si vedono ~7 ripetizioni, su un ripiano di 600mm ~2 ripetizioni.
// Non stira mai la texture, replica la fotografia.
const TEX_MM = 300;

/**
 * Imposta le UV di un BoxGeometry in base a una "strategia":
 *  - 'default': tiling fisico uniforme (ripete ogni TEX_MM mm)
 *  - 'tamp-verticale': pezzo verticale e stretto (tamp sx/dx) — la texture
 *    occupa TUTTA la larghezza (no "strisciolina") e si ripete solo in
 *    altezza, mantenendo la venatura verticale continua.
 *  - 'tamp-orizzontale': pezzo orizzontale lungo (tamp sopra/sotto) — la
 *    texture occupa tutta l'altezza (venatura verticale nei 60mm del
 *    fronte) e si ripete solo nella direzione lunga.
 */
function tilingPerDimensioni(geo, strategia = 'default') {
  const { width: w, height: h, depth: d } = geo.parameters;
  const uv = geo.attributes.uv;
  // Ordine facce di BoxGeometry (Three.js): +X, -X, +Y, -Y, +Z, -Z
  const facce = [
    [d, h], [d, h],   // laterali: profondità × altezza
    [w, d], [w, d],   // top/bottom: larghezza × profondità
    [w, h], [w, h],   // front/back: larghezza × altezza
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = facce[f];
    let su, sv;
    if (strategia === 'tamp-verticale') {
      su = 1;
      sv = Math.max(1, fh / 600);
    } else if (strategia === 'tamp-orizzontale') {
      su = Math.max(1, fw / 600);
      sv = 1;
    } else {
      su = fw / TEX_MM;
      sv = fh / TEX_MM;
    }
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setX(i, uv.getX(i) * su);
      uv.setY(i, uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
}

let scene, camera, renderer, controls;
let gruppoArmadio;           // nodo che contiene tutti i mesh dell'armadio
let porteAperte = false;     // toggle: false = chiuse, true = aperte

// Binario scorrevole: materiale metallico fisso (non è legno).
const matBinario = new THREE.MeshStandardMaterial({
  color: 0x5f5f5f, roughness: 0.55, metalness: 0.4,
});

// Per le altre parti usiamo materiali derivati dalla config.materiali,
// risolti al momento del render via getMaterialeTHREE().
function matDi(config, parte) {
  const id = config.materiali?.[parte]
    ?? ({ ante: 'roble-denver', carcassa: 'roble-hera',
          schiena: 'roble-hera', tamponamenti: 'roble-denver' }[parte]);
  return getMaterialeTHREE(id, () => renderer?.render(scene, camera));
}

/**
 * Inizializza scena, camera, luci e controlli dentro il canvas dato.
 */
export function inizializzaScena(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Camera prospettica
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(45, w / h, 10, 20000);
  camera.position.set(3000, 2200, 3800);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;

  // Luci: ambient + due direzionali per far "respirare" i materiali
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(2500, 4000, 3000);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf0d090, 0.35);
  fill.position.set(-2500, 2000, -1500);
  scene.add(fill);

  // Pavimento neutro, elegante
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Griglia tenue oro, per riferimento
  const grid = new THREE.GridHelper(8000, 16, 0x8a7030, 0x2a2015);
  grid.position.y = 0.1;
  scene.add(grid);

  // Controlli orbitali: rotazione + pan + zoom liberi come prima
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(1000, 1100, 300);
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  gruppoArmadio = new THREE.Group();
  scene.add(gruppoArmadio);

  // Resize
  window.addEventListener('resize', () => ridimensiona(canvas));

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function ridimensiona(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function forzaResize(canvas) { ridimensiona(canvas); }

/**
 * Apre/chiude le porte.
 * - BATTENTE: ruota ogni anta attorno al suo cardine (lato interno ruota
 *   verso l'esterno di ~100°).
 * - SCORREVOLE: le ante "avanti" scorrono lateralmente coprendo quelle
 *   "dietro", rivelando l'interno dal lato opposto.
 */
export function impostaApertura(valore) {
  porteAperte = valore;
  if (!gruppoArmadio) return;
  gruppoArmadio.children.forEach((child) => {
    if (child.userData?.tipo === 'pivot-anta-battente') {
      child.rotation.y = valore ? child.userData.rotAperta : 0;
    } else if (child.userData?.tipo === 'pivot-anta-scorrevole') {
      child.position.x = child.userData.xBase
        + (valore ? child.userData.xOffsetAperto : 0);
    }
  });
}

// Alias per compatibilità con chi aggancia il vecchio toggle
export function toggleAnte(valore) { impostaApertura(valore); }

/**
 * Pulisce e ricostruisce l'intera scena a partire da una config.
 */
export function aggiornaScena(config) {
  if (!gruppoArmadio) return;
  // Pulisce i figli precedenti
  while (gruppoArmadio.children.length) {
    const c = gruppoArmadio.children.pop();
    c.geometry?.dispose?.();
  }

  const prof = profonditaCarcassa(config);
  const totali = config.moduli.length;
  let xOffset = 0;
  config.moduli.forEach((modulo, i) => {
    costruisciModulo(config, modulo, xOffset, prof, i, totali);
    xOffset += modulo.larghezza;
  });

  if (config.tipoArmadio === 'scorrevole') {
    costruisciBinariGlobali(config);
  }

  costruisciTamponamenti(config);

  // Se c'è il tamp sotto, alzo tutto il mobile così il tamp resta sopra il
  // pavimento virtuale e si vede.
  const tampSotto = config.tamponamenti?.sotto;
  const yOffset = tampSotto?.attivo ? tampSotto.larghezza : 0;
  gruppoArmadio.position.y = yOffset;

  // Inquadratura 3/4 fissa, adatta alle dimensioni del mobile
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna + yOffset;
  const D = config.profonditaEsterna;
  controls.target.set(W / 2, H / 2, D / 2);
  const distMax = Math.max(W, H);
  camera.position.set(W / 2 + distMax * 1.1, H * 0.75, D + distMax * 1.6);
  controls.update();
}

/**
 * Crea un box 3D con nome, posizione (centro) e dimensioni date.
 */
function aggiungiBox(sx, sy, sz, cx, cy, cz, materiale, tipo, strategia) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  // Applica sempre il tiling: per le tinte solide (senza texture) le UV
  // non hanno effetto; per i legni la texture viene replicata al giusto
  // rapporto fisico anziché stirata sulla faccia.
  tilingPerDimensioni(geo, strategia);
  const mesh = new THREE.Mesh(geo, materiale);
  mesh.position.set(cx, cy, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.tipo = tipo;
  gruppoArmadio.add(mesh);
  return mesh;
}

/**
 * Costruisce un singolo modulo (carcassa + schiena + ripiani + ante +
 * eventuali cassettiere) con lo stesso schema delle formule.
 */
function costruisciModulo(config, modulo, xOffset, prof, indice = 0, totali = 1) {
  const sC = config.spessoreCarcassa;
  const sS = config.spessoreSchiena;
  const sA = config.spessoreAnte;
  const H = config.altezzaEsterna;
  const W = modulo.larghezza;
  const scorrevole = config.tipoArmadio === 'scorrevole';

  // Z di riferimento: retro al muro (dopo schiena), carcassa davanti
  const zRetro = sS;
  const zCarcassaCentro = zRetro + prof / 2;
  const zFrontePezzi = zRetro + prof; // z del fronte carcassa
  const zAnteCentro = zFrontePezzi + sA / 2;

  if (scorrevole) {
    // SCORREVOLE: setup unico top/fondo passanti, prof = P - sS
    aggiungiBox(W, sC, prof, xOffset + W / 2, H - sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'top');
    aggiungiBox(W, sC, prof, xOffset + W / 2, sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fondo');
    const altFianco = H - 2 * sC;
    const profStretto = profonditaFiancoInterno(config);
    const sxLargo = indice === 0;
    const dxLargo = indice === totali - 1;
    // Fianco sx
    const pSx = sxLargo ? prof : profStretto;
    aggiungiBox(sC, altFianco, pSx,
      xOffset + sC / 2, sC + altFianco / 2, zRetro + pSx / 2,
      matDi(config, "carcassa"), 'fianco');
    // Fianco dx
    const pDx = dxLargo ? prof : profStretto;
    aggiungiBox(sC, altFianco, pDx,
      xOffset + W - sC / 2, sC + altFianco / 2, zRetro + pDx / 2,
      matDi(config, "carcassa"), 'fianco');
  } else if (config.setupCarcassa === 1) {
    // BATTENTE setup 1: top/fondo passanti, fianchi in mezzo
    aggiungiBox(W, sC, prof, xOffset + W / 2, H - sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'top');
    aggiungiBox(W, sC, prof, xOffset + W / 2, sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fondo');
    const altFianco = H - 2 * sC;
    aggiungiBox(sC, altFianco, prof,
      xOffset + sC / 2, sC + altFianco / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fianco');
    aggiungiBox(sC, altFianco, prof,
      xOffset + W - sC / 2, sC + altFianco / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fianco');
  } else {
    // BATTENTE setup 2: fianchi passanti
    aggiungiBox(sC, H, prof, xOffset + sC / 2, H / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fianco');
    aggiungiBox(sC, H, prof, xOffset + W - sC / 2, H / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fianco');
    const larTF = W - 2 * sC;
    aggiungiBox(larTF, sC, prof,
      xOffset + W / 2, H - sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'top');
    aggiungiBox(larTF, sC, prof,
      xOffset + W / 2, sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fondo');
  }

  // Schiena (dietro)
  aggiungiBox(W - 2, H - 2, sS,
    xOffset + W / 2, H / 2, sS / 2,
    matDi(config, "schiena"), 'schiena');

  // Ripiani — distribuiti uniformemente nello spazio LIBERO del modulo.
  // Se ci sono cassettiere (appoggiate in basso), i ripiani si centrano
  // SOPRA la cassettiera e sono equidistanti tra sé e tra top/cassettiera.
  if (modulo.ripiani > 0) {
    const larRipiano = W - 2 * sC;
    let profRipianoVisivo = prof - (modulo.riduzioneRipiano || 0);
    if (scorrevole) {
      const B = config.scorrevole?.binario ?? 75;
      profRipianoVisivo = Math.min(profRipianoVisivo, prof - B);
    }
    // Calcolo dello spazio OCCUPATO dalle cassettiere di questo modulo
    const casseGlob = config.cassettiere || [];
    const casseQui = casseGlob.filter((cas) => {
      const idxs = Array.isArray(cas.moduli) && cas.moduli.length > 0
        ? cas.moduli : config.moduli.map((_, i) => i);
      return idxs.includes(indice);
    });
    let yOccupato = 0;
    casseQui.forEach((c) => {
      const AltMax = Math.max(100, c.altMax || 800);
      yOccupato += AltMax + 10; // 10mm di gap tra cassettiere consecutive
    });
    // Spazio libero sopra la cassettiera in cui distribuire i ripiani
    const yBase = sC + yOccupato;                  // sotto il primo ripiano
    const yFine = H - sC;                          // sotto il top
    const altLibera = Math.max(0, yFine - yBase);
    const passo = altLibera / (modulo.ripiani + 1);
    for (let r = 1; r <= modulo.ripiani; r++) {
      const yCentro = yBase + r * passo;
      aggiungiBox(larRipiano, sC, profRipianoVisivo,
        xOffset + W / 2, yCentro,
        sS + profRipianoVisivo / 2,
        matDi(config, "carcassa"), 'ripiano');
    }
  }

  // Ante a battente (solo se tipo = battente)
  // Ogni anta è dentro un pivot posizionato sul cardine; la rotazione del
  // pivot apre/chiude la porta senza dover rifare il mesh.
  if (config.tipoArmadio !== 'scorrevole') {
    const N = modulo.numeroAnte || 1;
    const larAnta = (W - (N + 1) * 2) / N;
    const altAnta = H - 4;
    for (let k = 0; k < N; k++) {
      const xStart = xOffset + 2 + k * (larAnta + 2); // bordo sinistro
      // Regola cardini: prima metà a sinistra, seconda metà a destra
      const cardineSx = k < Math.ceil(N / 2);
      const hingeX = cardineSx ? xStart : xStart + larAnta;
      const rotAperta = cardineSx ? -Math.PI * 0.55 : Math.PI * 0.55; // ~100°

      const pivot = new THREE.Group();
      pivot.position.set(hingeX, H / 2, zAnteCentro);
      pivot.userData.tipo = 'pivot-anta-battente';
      pivot.userData.rotAperta = rotAperta;
      if (porteAperte) pivot.rotation.y = rotAperta;

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(larAnta, altAnta, sA),
        matDi(config, "ante"),
      );
      mesh.position.x = cardineSx ? larAnta / 2 : -larAnta / 2;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.tipo = 'anta';
      pivot.add(mesh);
      gruppoArmadio.add(pivot);
    }
  }

  // ANTE SCORREVOLI (per modulo) — formula definitiva (sez. 4.5):
  // larghezza = Lm − 25, altezza = H − 47. Due casi di layout:
  //   N === 1 : 1 anta per modulo, alternata avanti/dietro tra moduli
  //             adiacenti (modulo 0 avanti, modulo 1 dietro, ...).
  //             L'apertura fa scorrere l'anta "avanti" di W a destra,
  //             sopra l'anta "dietro" del modulo successivo.
  //   N >= 2 : più ante per modulo, alternate avanti/dietro dentro il
  //            modulo stesso; la "avanti" scorre di un passo a destra.
  if (scorrevole) {
    const N = config.scorrevole?.anteModulo ?? 2;
    // Formula definitiva sez. 4.5
    const larAntaSc = W - 25;                            // Lm − 25
    const altAntaSc = H - 47;                            // H − 47
    const zAvanti = config.profonditaEsterna - sA / 2 - 2;
    const zDietro = config.profonditaEsterna - sA - sA / 2 - 4;
    const matAnteSc = matDi(config, "ante");
    const cy = 25 + altAntaSc / 2; // 25mm da terra per lasciare spazio al binario inferiore

    const creaAnta = (xBase, cz, xOffsetAperto) => {
      const pivot = new THREE.Group();
      pivot.position.set(xBase + (porteAperte ? xOffsetAperto : 0), cy, cz);
      pivot.userData.tipo = 'pivot-anta-scorrevole';
      pivot.userData.xBase = xBase;
      pivot.userData.xOffsetAperto = xOffsetAperto;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(larAntaSc, altAntaSc, sA), matAnteSc);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.tipo = 'anta';
      pivot.add(mesh);
      gruppoArmadio.add(pivot);
    };

    if (N === 1) {
      // 1 anta per modulo: alternata avanti/dietro tra moduli adiacenti
      const avanti = (indice % 2 === 0);
      const cz = avanti ? zAvanti : zDietro;
      const xBase = xOffset + W / 2;
      const siApre = avanti && indice < totali - 1;
      const xOffsetAperto = siApre ? W : 0;
      creaAnta(xBase, cz, xOffsetAperto);
    } else {
      // N≥2 per modulo: le ante si sovrappongono dentro il modulo,
      // alternate avanti/dietro; "avanti" scorrono verso destra all'apertura
      const passo = (W - larAntaSc) / (N - 1) + larAntaSc / 2;
      const spaziatura = (W - larAntaSc) / Math.max(1, N - 1);
      for (let k = 0; k < N; k++) {
        const xBase = xOffset + larAntaSc / 2 + k * spaziatura;
        const cz = (k % 2 === 0) ? zAvanti : zDietro;
        const siApre = (k % 2 === 0) && k < N - 1;
        const xOffsetAperto = siApre ? spaziatura : 0;
        creaAnta(xBase, cz, xOffsetAperto);
      }
    }
  }

  // Cassettiere — ora lette da config.cassettiere (globale). Per ciascuna
  // cassettiera, se questo modulo è elencato in `cas.moduli`, la disegno.
  const casseGlobali = config.cassettiere || [];
  const casseDiQuestoModulo = casseGlobali.filter((cas) => {
    const idxs = Array.isArray(cas.moduli) && cas.moduli.length > 0
      ? cas.moduli : config.moduli.map((_, i) => i);
    return idxs.includes(indice);
  });
  if (casseDiQuestoModulo.length > 0) {
    let yCassBase = sC; // appoggiata al fondo del modulo
    casseDiQuestoModulo.forEach((c) => {
      const N = Math.max(1, c.numCassetti || 4);
      const AltMax = Math.max(100, c.altMax || 800);
      // Dimensioni che dipendono dal tipo
      let larTF, profScatola, zScatolaFronte;
      if (scorrevole) {
        const B = config.scorrevole?.binario ?? 75;
        const Pcas = config.profonditaEsterna - sS - B;
        const Pscatola = Pcas - sC - 2;
        const M = c.maniglia?.attiva ? (c.maniglia.M ?? 50) : 0;
        larTF = W - 4 * sC;
        profScatola = Pscatola - M;
        zScatolaFronte = sS + Pcas; // fronte della scatola allineato con i binari
      } else {
        // BATTENTE: la cassettiera resta INTERNA al mobile (dietro le ante).
        // Il fronte della scatola è arretrato di sC + 3mm rispetto al retro
        // delle ante, così il fronte cassetto (spessore sC) sta dietro
        // l'anta e si vede solo quando si aprono le porte.
        const Pc = config.profonditaEsterna - config.spessoreAnte - sS;
        larTF = W - 2 * sC - 80;
        profScatola = Pc - 80 - sC;
        zScatolaFronte = config.profonditaEsterna - config.spessoreAnte - sC - 3;
      }
      const altFianchi = AltMax - 4 * sC;
      const As = AltMax - 2 * sC;
      const altFronte = (As - (N + 1) * 2) / N;
      const larFronte = larTF - 4;
      const xCentro = xOffset + W / 2;
      const zScatolaCentro = zScatolaFronte - profScatola / 2;
      // Scatola: top, fondo, fianchi (materiale "cassStruttura")
      const matStr = matDi(config, "cassStruttura");
      aggiungiBox(larTF, sC, profScatola,
        xCentro, yCassBase + AltMax - sC / 2, zScatolaCentro,
        matStr, 'cass-top');
      aggiungiBox(larTF, sC, profScatola,
        xCentro, yCassBase + sC + sC / 2, zScatolaCentro,
        matStr, 'cass-fondo');
      const yFianchi = yCassBase + 2 * sC + altFianchi / 2;
      aggiungiBox(sC, altFianchi, profScatola,
        xCentro - larTF / 2 + sC / 2, yFianchi, zScatolaCentro,
        matStr, 'cass-fianco');
      aggiungiBox(sC, altFianchi, profScatola,
        xCentro + larTF / 2 - sC / 2, yFianchi, zScatolaCentro,
        matStr, 'cass-fianco');
      // Fronti cassetto — materiale "cassFronti" (scelta separata dall'utente)
      const matFronti = matDi(config, "cassFronti");
      const zFronte = zScatolaFronte + sC / 2 + 1;
      for (let k = 0; k < N; k++) {
        const cy = yCassBase + 2 * sC + 2 + k * (altFronte + 2) + altFronte / 2;
        aggiungiBox(larFronte, altFronte, sC,
          xCentro, cy, zFronte,
          matFronti, 'cassetto');
      }
      yCassBase += AltMax + 10;
    });
  }
}

/**
 * Costruisce solo i BINARI (sup + inf) che attraversano tutto l'armadio.
 * NON entrano nella distinta (sono componenti a parte dell'utente).
 */
function costruisciBinariGlobali(config) {
  const B = config.scorrevole?.binario ?? 75;
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna;
  const D = config.profonditaEsterna;
  const sC = config.spessoreCarcassa;
  const altBinSup = B * 0.6;
  const altBinInf = B * 0.4;
  // Binario superiore (sotto il top)
  aggiungiBox(W, altBinSup, B,
    W / 2, H - sC - altBinSup / 2, D - B / 2,
    matBinario, "binario");
  // Binario inferiore (sopra il fondo)
  aggiungiBox(W, altBinInf, B,
    W / 2, sC + altBinInf / 2, D - B / 2,
    matBinario, "binario");
}

/**
 * Posiziona i tamponamenti all'esterno dell'armadio, con fascia a L dietro.
 */
function costruisciTamponamenti(config) {
  const t = config.tamponamenti || {};
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna;
  const D = config.profonditaEsterna;
  const sA = config.spessoreAnte;
  const sC = config.spessoreCarcassa;

  const larSx = t.sx?.attivo ? t.sx.larghezza : 0;
  const larDx = t.dx?.attivo ? t.dx.larghezza : 0;

  if (t.sx?.attivo) {
    aggiungiBox(t.sx.larghezza, H, sA,
      -t.sx.larghezza / 2, H / 2, D - sA / 2,
      matDi(config, "tamponamenti"), 'tamp-faccia', 'tamp-verticale');
    aggiungiBox(sC, H - 2, 30,
      -sC / 2, H / 2, D - sA - 15,
      matDi(config, "carcassa"), "tamp-fascia");
  }
  if (t.dx?.attivo) {
    aggiungiBox(t.dx.larghezza, H, sA,
      W + t.dx.larghezza / 2, H / 2, D - sA / 2,
      matDi(config, "tamponamenti"), 'tamp-faccia', 'tamp-verticale');
    aggiungiBox(sC, H - 2, 30,
      W + sC / 2, H / 2, D - sA - 15,
      matDi(config, "carcassa"), "tamp-fascia");
  }
  if (t.sopra?.attivo) {
    const lung = W + larSx + larDx;
    const cxTamp = (W + larDx - larSx) / 2;
    aggiungiBox(lung, t.sopra.larghezza, sA,
      cxTamp, H + t.sopra.larghezza / 2, D - sA / 2,
      matDi(config, "tamponamenti"), 'tamp-faccia', 'tamp-orizzontale');
    aggiungiBox(lung - 2, 30, sC,
      cxTamp, H + 15, D - sA - sC / 2,
      matDi(config, "carcassa"), "tamp-fascia");
  }
  if (t.sotto?.attivo) {
    const lung = W + larSx + larDx;
    const cxTamp = (W + larDx - larSx) / 2;
    aggiungiBox(lung, t.sotto.larghezza, sA,
      cxTamp, -t.sotto.larghezza / 2, D - sA / 2,
      matDi(config, "tamponamenti"), 'tamp-faccia', 'tamp-orizzontale');
    aggiungiBox(lung - 2, 30, sC,
      cxTamp, -15, D - sA - sC / 2,
      matDi(config, "carcassa"), "tamp-fascia");
  }
}
