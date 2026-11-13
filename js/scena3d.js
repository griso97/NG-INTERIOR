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
import { profonditaCarcassa, profonditaFiancoInterno } from './calcoli.js?v=20261111b';
import { getMaterialeTHREE, impostaUnitaUV, taraLuceCatalogo, uvInScala } from './materiali.js?v=20261114h';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from './logo.js?v=20261111b';
import { sfondoDi } from './sfondi.js?v=20261111b';

// Scala fisica del tiling della texture legno: 1 "ripetizione" = N mm.
// Il campione reale è ~400×200mm → uso 300mm come compromesso: su un'anta
// alta 2m si vedono ~7 ripetizioni, su un ripiano di 600mm ~2 ripetizioni.
// Non stira mai la texture, replica la fotografia.
const TEX_MM = 300;
impostaUnitaUV(TEX_MM);              // foto del catalogo in scala vera (UV in unità di TEX_MM)

// Materiale metallico per le maniglie (cassettiera, ecc.)
const MAT_METALLO = new THREE.MeshStandardMaterial({ color: 0xd0d2d6, roughness: 0.28, metalness: 0.9 });

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
let floorMesh, gridMesh;     // pavimento + griglia (per cambiare sfondo)
let sfondoAttuale = null;    // id sfondo applicato

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
// Ambiente IBL: gradiente (soffitto chiaro → pavimento scuro) per riflessi
// morbidi e realistici sui materiali laccati lucidi.
function creaAmbiente(rnd) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const x = c.getContext('2d');
  // Gradiente FORTE soffitto→pavimento: i laccati LUCIDI lo riflettono come
  // una "velatura" (chiaro in alto, scuro in basso) → stacco netto rispetto
  // agli OPACHI che restano uniformi.
  const grd = x.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, '#ffffff');
  grd.addColorStop(0.34, '#e4ded2');
  grd.addColorStop(0.5, '#8f897d');
  grd.addColorStop(0.7, '#4a4740');
  grd.addColorStop(1.0, '#191814');
  x.fillStyle = grd; x.fillRect(0, 0, 32, 128);
  // Striscia luminosa netta appena sopra l'orizzonte = riflesso "finestra".
  const sb = x.createLinearGradient(0, 44, 0, 60);
  sb.addColorStop(0.0, 'rgba(255,255,255,0)');
  sb.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  sb.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = sb; x.fillRect(0, 44, 32, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(rnd);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

/**
 * Cambia lo sfondo/pavimento/griglia della vista 3D (solo estetica: luci e
 * riflessi restano identici). id: 'chiaro' | 'neutro' | 'scuro'.
 */
export function impostaSfondo(id) {
  if (!scene || id === sfondoAttuale) return;
  sfondoAttuale = id;
  const sf = sfondoDi(id);
  scene.background = new THREE.Color(sf.bg);
  if (floorMesh) floorMesh.material.color.setHex(sf.pav);
  if (gridMesh) scene.remove(gridMesh);
  gridMesh = new THREE.GridHelper(8000, 16, sf.g1, sf.g2);
  gridMesh.position.y = 0.1;
  scene.add(gridMesh);
}

export function inizializzaScena(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);

  // Camera prospettica
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(45, w / h, 10, 20000);
  camera.position.set(3000, 2200, 3800);

  // Renderer: resa realistica (tone mapping cinematografico + colori sRGB)
  // preserveDrawingBuffer: serve per salvare l'immagine (toDataURL).
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Environment (IBL): indispensabile per i riflessi dei laccati LUCIDI,
  // così lo stacco lucido/opaco si vede davvero.
  scene.environment = creaAmbiente(renderer);

  // Luci: hemisphere + ambient + key/fill/rim, più luminose e naturali
  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x4a4a52, 1.3));
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.8);
  key.position.set(2500, 4000, 3000);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.7);
  fill.position.set(-2500, 2000, -1500);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, 1800, -4000);
  scene.add(rim);
  taraLuceCatalogo(renderer, scene, [[0, 0, 1]]); // ante di fronte · prodotti del catalogo: colori identici alla foto

  // Pavimento (colore impostato da impostaSfondo)
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshStandardMaterial({ color: 0xd7d0c4, roughness: 0.95 }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Sfondo iniziale
  impostaSfondo('chiaro');

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
 * Salva l'immagine del rendering in ALTA QUALITÀ (PNG). Rende la scena a una
 * risoluzione molto più alta del canvas a video, scarica il file, poi
 * ripristina la dimensione a video.
 */
export function esportaImmagine(nomeFile = 'render.png', latoMax = latoMaxExport()) {
  if (!renderer || !scene || !camera) return false;
  const canvas = renderer.domElement;
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  const pr0 = renderer.getPixelRatio();
  // Dimensione alta mantenendo le proporzioni a video
  const scala = Math.max(1, latoMax / Math.max(cw, ch));
  const tw = Math.round(cw * scala), th = Math.round(ch * scala);
  renderer.setPixelRatio(1);
  renderer.setSize(tw, th, false);
  camera.aspect = tw / th; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  let canvas2d = null;
  try { canvas2d = componiConLogo(canvas); } catch (e) { canvas2d = null; }
  // Ripristina
  renderer.setPixelRatio(pr0);
  renderer.setSize(cw, ch, false);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  if (!canvas2d) return false;
  return salvaImmagineCanvas(canvas2d, nomeFile);
}

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
    } else if (child.userData?.tipo === 'maniglia-cassetto') {
      child.visible = valore;
    }
  });
}

// ---------------------------------------------------------------------------
// SPOSTARE I RIPIANI (a porte aperte): si trascina un ripiano su e giù.
// ---------------------------------------------------------------------------
let trascRip = null;    // { mesh, piano, dy }
const _ray = new THREE.Raycaster();
function raggio(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  _ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
  return _ray;
}
export function iniziaSpostamentoRipiano(clientX, clientY) {
  if (!porteAperte || !gruppoArmadio || !camera) return false;
  const hit = raggio(clientX, clientY).intersectObjects(gruppoArmadio.children, true)[0];
  if (!hit || hit.object.userData.tipo !== 'ripiano') return false;
  // piano verticale rivolto alla camera, passante per il punto toccato
  const n = new THREE.Vector3(); camera.getWorldDirection(n); n.y = 0;
  if (n.lengthSq() < 1e-6) n.set(0, 0, -1);
  n.normalize();
  const piano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point);
  // limiti: tra il ripiano sotto e quello sopra (non si scavalcano)
  const m = hit.object, u = m.userData, sC = m.geometry.parameters.height;
  const altri = gruppoArmadio.children.filter((o) => o !== m && o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo).map((o) => o.position.y);
  const lo = Math.max(u.yMin, ...altri.filter((y) => y < m.position.y).map((y) => y + sC + 30));
  const hi = Math.min(u.yMax, ...altri.filter((y) => y > m.position.y).map((y) => y - sC - 30));
  trascRip = { mesh: m, piano, dy: m.position.y - hit.point.y, lo, hi };
  controls.enabled = false;
  renderer.domElement.style.cursor = 'ns-resize';
  return true;
}
/** Sposta il ripiano; ritorna { daTerra, sotto, sopra } in mm per l'etichetta. */
export function muoviSpostamentoRipiano(clientX, clientY) {
  if (!trascRip) return null;
  const p = new THREE.Vector3();
  if (!raggio(clientX, clientY).ray.intersectPlane(trascRip.piano, p)) return null;
  const m = trascRip.mesh;
  m.position.y = Math.round(Math.min(trascRip.hi, Math.max(trascRip.lo, p.y + trascRip.dy)));
  return misureRipiano(m);
}
function misureRipiano(m) {
  const u = m.userData, sC = m.geometry.parameters.height;
  const altri = gruppoArmadio.children.filter((o) => o !== m && o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo)
    .map((o) => o.position.y);
  const giu = Math.max(u.yMin - 20 - sC / 2, ...altri.filter((y) => y < m.position.y).map((y) => y + sC / 2));
  const su = Math.min(u.yMax + 20 + sC / 2, ...altri.filter((y) => y > m.position.y).map((y) => y - sC / 2));
  return { daTerra: Math.round(m.position.y + sC / 2), sotto: Math.round(m.position.y - sC / 2 - giu), sopra: Math.round(su - (m.position.y + sC / 2)) };
}
/** Fine: ritorna { modulo, ripianiY: [...] } con le altezze di tutti i ripiani del modulo. */
export function fineSpostamentoRipiano() {
  if (!trascRip) return null;
  const u = trascRip.mesh.userData;
  trascRip = null;
  controls.enabled = true;
  renderer.domElement.style.cursor = '';
  const ys = gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo)
    .sort((a, b) => a.userData.indice - b.userData.indice).map((o) => Math.round(o.position.y));
  return { modulo: u.modulo, ripianiY: ys };
}
export function porteSonoAperte() { return porteAperte; }

// Alias per compatibilità con chi aggancia il vecchio toggle
export function toggleAnte(valore) { impostaApertura(valore); }

/**
 * Pulisce e ricostruisce l'intera scena a partire da una config.
 */
export function aggiornaScena(config) {
  if (!gruppoArmadio) return;
  impostaSfondo(config.sfondo || 'chiaro');
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

  uvInScala(gruppoArmadio);       // prodotti del catalogo: foto in scala vera

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
    // Posizioni scelte a mano (trascinando i ripiani nel 3D a porte aperte):
    // valgono se il numero di ripiani è lo stesso; restano dentro il vano.
    const yMin = yBase + sC / 2 + 20, yMax = yFine - sC / 2 - 20;
    const aMano = Array.isArray(modulo.ripianiY) && modulo.ripianiY.length === modulo.ripiani;
    for (let r = 1; r <= modulo.ripiani; r++) {
      const yCentro = aMano ? Math.min(yMax, Math.max(yMin, modulo.ripianiY[r - 1])) : yBase + r * passo;
      const m = aggiungiBox(larRipiano, sC, profRipianoVisivo,
        xOffset + W / 2, yCentro,
        sS + profRipianoVisivo / 2,
        matDi(config, "carcassa"), 'ripiano');
      Object.assign(m.userData, { modulo: indice, indice: r - 1, yMin, yMax });
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
      // Regola cardini:
      // - 1 anta: lato scelto dall'utente (antaLato). 'dx' (maniglia a destra)
      //   = cardine a sinistra; 'sx' (maniglia a sinistra) = cardine a destra.
      // - 2+ ante: prima metà a sinistra, seconda metà a destra.
      const cardineSx = (N === 1)
        ? (modulo.antaLato !== 'sx')
        : (k < Math.ceil(N / 2));
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
    // Il rendering 3D usa dimensioni "visive" (W/N + 20) per far vedere
    // chiaramente la sovrapposizione e lo scorrimento. La DISTINTA invece
    // usa la formula ufficiale Lm − 25 (vedi calcoli.js) che resta corretta.
    const N = config.scorrevole?.anteModulo ?? 2;
    const B = config.scorrevole?.binario ?? 75;
    const altAntaSc = H - B;
    const larAntaSc = W / N + 20;
    const zAvanti = config.profonditaEsterna - sA / 2 - 2;
    const zDietro = config.profonditaEsterna - sA - sA / 2 - 4;
    const matAnteSc = matDi(config, "ante");
    const cy = (B * 0.4) + altAntaSc / 2;

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
      // 1 anta per modulo: alternata avanti/dietro tra moduli adiacenti,
      // scorre di tutta la larghezza del modulo verso il modulo successivo.
      const avanti = (indice % 2 === 0);
      const cz = avanti ? zAvanti : zDietro;
      const xBase = xOffset + W / 2;
      const siApre = avanti && indice < totali - 1;
      const xOffsetAperto = siApre ? W : 0;
      creaAnta(xBase, cz, xOffsetAperto);
    } else {
      // N≥2 ante per modulo: le ante si sovrappongono dentro il modulo,
      // alternate avanti/dietro. L'anta "avanti" scorre di un passo
      // (larAnta − overlap) verso destra all'apertura.
      const passo = larAntaSc - 20;
      for (let k = 0; k < N; k++) {
        const xBase = xOffset + larAntaSc / 2 + k * passo;
        const cz = (k % 2 === 0) ? zAvanti : zDietro;
        const siApre = (k % 2 === 0) && k < N - 1;
        const xOffsetAperto = siApre ? passo : 0;
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
      const altFronte = Math.floor((As - (N + 1) * 2) / N);   // per difetto, come in distinta
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
        // Maniglia: barra metallica orizzontale vicino al bordo alto del fronte
        const lman = Math.min(larFronte * 0.5, 300);
        const hman = Math.min(altFronte * 0.14, 22);
        const man = new THREE.Mesh(new THREE.BoxGeometry(lman, hman, 20), MAT_METALLO);
        man.position.set(xCentro, cy + altFronte / 2 - Math.min(altFronte * 0.22, 55), zFronte + sC / 2 + 11);
        man.castShadow = true;
        // cassettiera DENTRO l'armadio: la maniglia si vede solo a porte
        // aperte (a porte chiuse sbucherebbe attraverso le ante)
        man.userData.tipo = 'maniglia-cassetto';
        man.visible = porteAperte;
        gruppoArmadio.add(man);
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
