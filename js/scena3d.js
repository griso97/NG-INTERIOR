// =============================================================================
// VISTA 3D - NG STUDIO
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
import { spessoreMateriale, profonditaBinario, profonditaCarcassa, profonditaFiancoInterno, misureCostado, anteInterne, profonditaDentro, profonditaRipiani, misureSchiena, schienaDentro, tiradorArmadio, geometriaCassettiera, lunghezzaManigliaCassetto, riduzioneManigliaArmadio, larghezzaAntaScorrevole, altezzaAntaScorrevole, lunghezzaManiglia as lungManigliaStd, lunghezzaManigliaAnta as lungManigliaAnta } from './calcoli.js?v=20261127f';
import { parametri } from './parametri.js?v=20261127f';
import { getMaterialeTHREE, impostaUnitaUV, taraLuceCatalogo, uvInScala, MATERIALI, BINARIO_DEFAULT } from './materiali.js?v=20261127f';
import { costruisciManiglia, manigliaDaFoto, adattaSporgenza } from './maniglia3d.js?v=20261127f';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from './logo.js?v=20261127f';
import { sfondoDi } from './sfondi.js?v=20261127f';
import { creaResa, nearSegueLaVista, inquadraOmbre, ombreSuTutto, pavimentoVero } from './resa.js?v=20261127f';
import { riprendiRiflessiLaccati } from './riflessi-laccati.js?v=20261127f';

// Scala fisica del tiling della texture legno: 1 "ripetizione" = N mm.
// Il campione reale è ~400×200mm → uso 300mm come compromesso: su un'anta
// alta 2m si vedono ~7 ripetizioni, su un ripiano di 600mm ~2 ripetizioni.
// Non stira mai la texture, replica la fotografia.
const TEX_MM = 300;

// Incasso della maniglia incassata (fresata nel frontale): scuro, opaco
const MAT_INCASSO = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.8, metalness: 0.2 });
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

// Binario scorrevole: colore dal catalogo (Impostazioni → Binari); grigio di partenza.
function matBinarioDi(config) {
  const id = config.scorrevole?.coloreBinario;
  const ok = id && MATERIALI.some((m) => m.id === id && m.categoria === 'binario');
  return getMaterialeTHREE(ok ? id : BINARIO_DEFAULT, () => { if (resa) resa.cambiato(); else renderer?.render(scene, camera); });
}

// Per le altre parti usiamo materiali derivati dalla config.materiali,
// risolti al momento del render via getMaterialeTHREE().
// MANIGLIE delle ante (dal catalogo, come in cucina): config.maniglia = id
// (vuoto o 'nessuna' = ante lisce). Verticali, vicino al bordo che si apre:
// al centro, o dal fondo dell'anta per quelle oltre 1 metro (a scelta).
let _cfgUltima = null;
function manigliaScelta(config) {
  const id = config.maniglia;
  if (!id || id === 'nessuna') return null;
  return MATERIALI.find((m) => m.id === id && m.categoria === 'maniglia') || null;
}
/** Lunghezza vera della maniglia (quella standard: 30 cm). */
export function lunghezzaManiglia(def) { return lungManigliaStd(def); }   // la stessa della distinta (calcoli.js)
/**
 * Lunghezza della maniglia SU QUESTA ANTA: quella scelta per l'armadio (config.manigliaLunghezza:
 * mm, oppure 'anta' = alta come l'anta) o quella del catalogo; MAI più lunga dell'anta (4 cm dai bordi).
 */
export function lunghezzaManigliaAnta(def, config, altAnta) { return lungManigliaAnta(def, config, altAnta); }
/** Maniglia GRANDE (oltre 1 metro): si può far partire dal centro o dal fondo dell'anta. */
export const MANIGLIA_GRANDE_MM = 1000;
/**
 * Centro della maniglia rispetto al centro dell'anta (yBase = quota da terra
 * del bordo basso dell'anta). Le maniglie normali stanno al centro (a ~105 cm
 * da terra, mai sopra metà anta); quelle grandi, se scelto "dal fondo"
 * (config.manigliaPosizione, di partenza), partono dal bordo basso e salgono.
 */
function yManiglia(def, altAnta, yBase, config) {
  const L = lunghezzaManigliaAnta(def, config, altAnta);
  if (L > MANIGLIA_GRANDE_MM && (config.manigliaPosizione || 'fondo') === 'fondo') return -altAnta / 2 + L / 2;
  const centro = Math.min(yBase + altAnta / 2, 1050) - yBase;          // da terra → sull'anta
  const c = Math.max(L / 2, Math.min(altAnta - L / 2, centro));        // tutta dentro l'anta
  return c - altAnta / 2;
}
function aggiungiManiglia(parent, def, x, y, z, L = lunghezzaManiglia(def), rotZ = Math.PI / 2) {
  let grp = null;
  if (def.texture && def.lunghezzaMm && (def.forma === 'foto' || !def.formaV)) {
    // maniglia dalle foto: 3D vero ricostruito dalle viste (si ridisegna quando è pronta)
    const r = manigliaDaFoto(def, () => { if (_cfgUltima) aggiornaScena(_cfgUltima); });
    if (r) {
      // lunga come in distinta: sul cassetto / anta più piccola della foto si accorcia (stesso profilo)
      const mesh = new THREE.Mesh(r.geo, r.mat); if (L < def.lunghezzaMm) mesh.scale.x = L / def.lunghezzaMm;
      grp = new THREE.Group(); grp.add(mesh);
      adattaSporgenza(grp, def.sporgenzaMm);         // sporge quanto scritto nella scheda
    }
  }
  if (!grp) {
    const catalogo = !!(def.texture && def.lunghezzaMm);
    const forma = catalogo ? (!def.forma || def.forma === 'foto' ? 'barra' : def.forma) : 'barra';
    grp = costruisciManiglia(forma, catalogo ? def.finitura : 'inox', L, catalogo ? def.colore : null, catalogo ? def.sporgenzaMm : null);
  }
  grp.position.set(x, y, z);                       // z = faccia davanti dell'anta
  grp.rotation.z = rotZ;                           // verticale (il risvolto dei profili verso il bordo che apre)
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.tipo = 'maniglia-anta'; } });
  parent.add(grp);
}

function matDi(config, parte) {
  const id = config.materiali?.[parte] ?? (parte === 'costadi' ? config.materiali?.ante : undefined)
    ?? ({ ante: 'roble-denver', carcassa: 'roble-hera', costadi: 'roble-denver',
          schiena: 'roble-hera', tamponamenti: 'roble-denver' }[parte]);
  // texture arrivata: la vista veloce si aggiorna, quella realistica si rifà (senza c'era la foto vecchia)
  return getMaterialeTHREE(id, () => { if (resa) resa.cambiato(); else renderer?.render(scene, camera); });
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
let pavimentoAttuale = null;
export function impostaSfondo(id, pavimento = pavimentoAttuale) {
  if (!scene || (id === sfondoAttuale && (pavimento || null) === pavimentoAttuale)) return;
  sfondoAttuale = id; pavimentoAttuale = pavimento || null;
  const sf = sfondoDi(id);
  scene.background = new THREE.Color(sf.bg);
  // pavimento vero (parquet / gres, o quello scelto: legni, marmi, pietre), niente griglia da disegno tecnico
  if (floorMesh) { floorMesh.material.dispose(); floorMesh.material = pavimentoVero(id, sf.pav, 30000, 30000, () => { riflessiLucidi(); if (resa) resa.cambiato(); }, pavimentoAttuale); }
  if (gridMesh) { scene.remove(gridMesh); gridMesh = null; }
  riflessiLucidi();
  if (resa) resa.cambiato();
}

// Ante LACCATE LUCIDE: riflettono la stanza vera (pavimento, muro, finestra alle spalle di chi
// guarda, plafoniere) come in cucina; si rifà quando cambiano l'armadio, lo sfondo o il pavimento.
function riflessiLucidi() {
  if (!renderer || !scene || !gruppoArmadio || !gruppoArmadio.children.length) return;
  gruppoArmadio.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(gruppoArmadio);
  if (bb.isEmpty()) return;
  try {
    riprendiRiflessiLaccati({
      renderer, scene, radice: gruppoArmadio, dir: { x: 0, z: 1 },
      centro: { x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2 },
      largo: bb.max.x - bb.min.x, altLuci: Math.max(2690, bb.max.y + 250),
    });
  } catch (e) { console.warn('Riflessi dei lucidi', e); }
}

export function inizializzaScena(canvas) {
  impostaUnitaUV(TEX_MM);              // foto del catalogo in scala vera (UV in unità di TEX_MM)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);

  // Camera prospettica
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(45, w / h, 10, 20000);
  camera.position.set(3000, 2200, 3800);

  // Renderer: resa realistica (tone mapping cinematografico + colori sRGB)
  // niente preserveDrawingBuffer (più leggero): l'immagine si legge subito dopo averla disegnata.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 3;
  luceOmbre = key;
  scene.add(key); scene.add(key.target);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.7);
  fill.position.set(-2500, 2000, -1500);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, 1800, -4000);
  scene.add(rim);
  taraLuceCatalogo(renderer, scene, [[0, 0, 1]]); // ante di fronte · prodotti del catalogo: colori identici alla foto

  // Pavimento (colore impostato da impostaSfondo)
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(30000, 30000),
    new THREE.MeshStandardMaterial({ color: 0xd7d0c4, roughness: 0.95 }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  // MURO dietro l'armadio (intonaco): l'armadio appoggiato al suo muro, come
  // nella realtà; da dietro non si vede (una faccia sola)
  muroDietro = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 }));
  muroDietro.receiveShadow = true; muroDietro.visible = false;
  scene.add(muroDietro);

  // Sfondo iniziale
  impostaSfondo('chiaro');

  // Controlli orbitali: rotazione + pan + zoom liberi come prima
  controls = new OrbitControls(camera, renderer.domElement);
  nearSegueLaVista(camera, controls);              // profondità precisa: niente triangoli sui fondi
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

  resa = creaResa({ renderer, scene, camera, raggio: 260, intensita: 0.9 });
  animate();
}

let pausa3d = false;
let resa = null, luceOmbre = null, muroDietro = null;
function animate() {
  requestAnimationFrame(animate);
  if (pausa3d) return;
  controls.update();
  // disegna solo quando serve (vista ferma = nessun lavoro); mentre si trascina un ripiano disegna leggero
  if (resa) resa.tick(!!trascRip); else renderer.render(scene, camera);
}

/**
 * FOTO dell'armadio: la stessa resa realistica della vista 3D (luce, ombre,
 * ombre di contatto, legno identico alla foto) a grande risoluzione, subito.
 */
export async function fotoRealisticaArmadio(opz = {}) {
  if (!renderer || !resa) return null;
  const lato = Math.max(opz.larghezza || 0, opz.altezza || 0) || latoMaxExport();
  return resa.foto(lato);
}

function ridimensiona(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (resa) { resa.dimensiona(); resa.cambiato(); } else renderer.setSize(w, h, false);
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
  let canvas2d = null;
  if (resa) {
    try { canvas2d = componiConLogo(resa.foto(Math.max(tw, th))); } catch (e) { canvas2d = null; }
  } else {
    renderer.setPixelRatio(1);
    renderer.setSize(tw, th, false);
    camera.aspect = tw / th; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    try { canvas2d = componiConLogo(canvas); } catch (e) { canvas2d = null; }
    renderer.setPixelRatio(pr0);
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
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
  if (resa) resa.cambiato();
  if (renderer) renderer.shadowMap.needsUpdate = true;
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
  if (!hit) return false;
  if (hit.object.userData.tipo === 'barra') return iniziaSpostamentoPerchero(hit);
  if (hit.object.userData.tipo !== 'ripiano') return false;
  // piano verticale rivolto alla camera, passante per il punto toccato
  const n = new THREE.Vector3(); camera.getWorldDirection(n); n.y = 0;
  if (n.lengthSq() < 1e-6) n.set(0, 0, -1);
  n.normalize();
  const piano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point);
  // limiti: tra il ripiano sotto e quello sopra (non si scavalcano)
  const m = hit.object, u = m.userData, sC = m.geometry.parameters.height;
  const altri = gruppoArmadio.children.filter((o) => o !== m && o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo).map((o) => o.position.y);
  // il perchero dello stesso modulo: il ripiano non ci passa sopra
  const perch = gruppoArmadio.children.filter((o) => o.userData.tipo === 'perchero' && o.userData.modulo === u.modulo).map((o) => o.position.y);
  const lo = Math.max(u.yMin, ...altri.filter((y) => y < m.position.y).map((y) => y + sC + 30), ...perch.filter((y) => y < m.position.y).map((y) => y + sC / 2 + 40));
  const hi = Math.min(u.yMax, ...altri.filter((y) => y > m.position.y).map((y) => y - sC - 30), ...perch.filter((y) => y > m.position.y).map((y) => y - sC / 2 - 30));
  trascRip = { mesh: m, piano, dy: m.position.y - hit.point.y, lo, hi };
  controls.enabled = false;
  renderer.domElement.style.cursor = 'ns-resize';
  return true;
}
/** PERCHERO: si trascina su e giù come un ripiano, senza passare oltre i ripiani vicini. */
function iniziaSpostamentoPerchero(hit) {
  const g = hit.object.userData.gruppo, u = g.userData;
  const n = new THREE.Vector3(); camera.getWorldDirection(n); n.y = 0;
  if (n.lengthSq() < 1e-6) n.set(0, 0, -1);
  n.normalize();
  const piano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point);
  const rip = gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo);
  const sC = rip.length ? rip[0].geometry.parameters.height : 18;
  const ys = rip.map((o) => o.position.y);
  const lo = Math.max(u.yMin, ...ys.filter((y) => y < g.position.y).map((y) => y + sC / 2 + 40));
  const hi = Math.min(u.yMax, ...ys.filter((y) => y > g.position.y).map((y) => y - sC / 2 - 30));
  trascRip = { mesh: g, piano, dy: g.position.y - hit.point.y, lo, hi, perchero: true, sC };
  controls.enabled = false;
  renderer.domElement.style.cursor = 'ns-resize';
  return true;
}
function misurePerchero(g, sC) {
  const ys = gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === g.userData.modulo).map((o) => o.position.y);
  const y = g.position.y;
  const giu = Math.max(g.userData.yMin - 150, ...ys.filter((v) => v < y).map((v) => v + sC / 2));
  const su = Math.min(g.userData.yMax + 40, ...ys.filter((v) => v > y).map((v) => v - sC / 2));
  return { daTerra: Math.round(y), sotto: Math.round(y - 15 - giu), sopra: Math.round(su - (y + 15)) };
}
/** Sposta il ripiano; ritorna { daTerra, sotto, sopra } in mm per l'etichetta. */
export function muoviSpostamentoRipiano(clientX, clientY) {
  if (!trascRip) return null;
  const p = new THREE.Vector3();
  if (!raggio(clientX, clientY).ray.intersectPlane(trascRip.piano, p)) return null;
  const m = trascRip.mesh;
  m.position.y = Math.round(Math.min(trascRip.hi, Math.max(trascRip.lo, p.y + trascRip.dy)));
  return trascRip.perchero ? misurePerchero(m, trascRip.sC) : misureRipiano(m);
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
  const u = trascRip.mesh.userData, per = trascRip.perchero, yP = Math.round(trascRip.mesh.position.y);
  trascRip = null;
  controls.enabled = true;
  renderer.domElement.style.cursor = '';
  if (per) return { modulo: u.modulo, barraY: yP };
  const ys = gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === u.modulo)
    .sort((a, b) => a.userData.indice - b.userData.indice).map((o) => Math.round(o.position.y));
  return { modulo: u.modulo, ripianiY: ys };
}
export function porteSonoAperte() { return porteAperte; }

// -----------------------------------------------------------------------------
// TOCCO NEL 3D (a porte aperte): ripiano toccato, o modulo + altezza toccati.
// -----------------------------------------------------------------------------
export function toccoArmadio(clientX, clientY) {
  if (!porteAperte || !gruppoArmadio || !camera) return null;
  const hit = raggio(clientX, clientY).intersectObjects(gruppoArmadio.children, true)[0];
  if (!hit) return null;
  const u = hit.object.userData;
  if (u.tipo === 'ripiano') return { tipo: 'ripiano', modulo: u.modulo, indice: u.indice };
  if (u.tipo === 'barra' && u.gruppo) return { tipo: 'perchero', modulo: u.gruppo.userData.modulo };
  const loc = gruppoArmadio.worldToLocal(hit.point.clone());
  const k = _zoneModuli.findIndex((z) => z && loc.x >= z.x0 && loc.x <= z.x1);
  return k < 0 ? null : { tipo: 'modulo', modulo: k, y: Math.round(loc.y) };
}
/** Altezze (centro, mm) dei ripiani di un modulo, nell'ordine dei ripiani. */
export function ripianiCorrenti(modulo) {
  if (!gruppoArmadio) return [];
  return gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === modulo)
    .sort((a, b) => a.userData.indice - b.userData.indice).map((o) => Math.round(o.position.y));
}
/**
 * Dove mettere un ripiano in più nel modulo: all'altezza voluta se c'è posto
 * (almeno 3 cm dagli altri ripiani e dal perchero), altrimenti a metà dello
 * spazio libero più grande. null = non c'è posto.
 */
export function posizioneNuovoRipiano(modulo, yVoluto = null) {
  const z = _zoneModuli[modulo]; if (!z) return null;
  const d = z.sC + 30;
  const occ = [...ripianiCorrenti(modulo).map((y) => ({ y, d })),
    ...gruppoArmadio.children.filter((o) => o.userData.tipo === 'perchero' && o.userData.modulo === modulo).map((o) => ({ y: o.position.y, d: z.sC / 2 + 40 }))]
    .sort((a, b) => a.y - b.y);
  const liberi = []; let lo = z.yMin;
  for (const o of occ) { liberi.push([lo, o.y - o.d]); lo = Math.max(lo, o.y + o.d); }
  liberi.push([lo, z.yMax]);
  const validi = liberi.filter(([a, b]) => b >= a);
  if (!validi.length) return null;
  if (yVoluto != null) { const g = validi.find(([a, b]) => yVoluto >= a && yVoluto <= b); if (g) return Math.round(yVoluto); }
  const [a, b] = validi.reduce((m, g) => (g[1] - g[0] > m[1] - m[0] ? g : m));
  return Math.round((a + b) / 2);
}
/** Contorno dorato sul ripiano selezionato (null = nessuno); indice 'perchero' = il perchero del modulo. */
let _selRip = null;
export function evidenziaRipiano(modulo, indice) {
  if (_selRip) { _selRip.parent?.remove(_selRip); _selRip.geometry.dispose(); _selRip = null; }
  if (modulo == null || !gruppoArmadio) return;
  if (indice === 'perchero') {
    const g = gruppoArmadio.children.find((o) => o.userData.tipo === 'perchero' && o.userData.modulo === modulo);
    const tubo = g && g.children.find((o) => o.userData.tipo === 'barra');
    if (!tubo) return;
    _selRip = new THREE.LineSegments(new THREE.EdgesGeometry(tubo.geometry), new THREE.LineBasicMaterial({ color: 0xe0b450 }));
    _selRip.scale.setScalar(1.25);
    _selRip.raycast = () => {};
    tubo.add(_selRip);
    return;
  }
  const m = gruppoArmadio.children.find((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === modulo && o.userData.indice === indice);
  if (!m) return;
  _selRip = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xe0b450 }));
  _selRip.scale.setScalar(1.01);
  _selRip.raycast = () => {};                                       // non intralcia il tocco/trascinamento
  m.add(_selRip);
}

// Alias per compatibilità con chi aggancia il vecchio toggle
export function toggleAnte(valore) { impostaApertura(valore); }

/**
 * Pulisce e ricostruisce l'intera scena a partire da una config.
 */
export function aggiornaScena(config) {
  if (!gruppoArmadio) return;
  _cfgUltima = config;
  if (resa) resa.cambiato();
  _zoneModuli = []; _selRip = null;
  impostaSfondo(config.sfondo || 'chiaro', config.pavimento || null);
  // Pulisce i figli precedenti
  // (tutti i pezzi, anche quelli dentro i gruppi: prima solo il primo livello e la memoria
  // della scheda grafica cresceva a ogni modifica)
  while (gruppoArmadio.children.length) {
    const c = gruppoArmadio.children.pop();
    c.traverse((o) => o.geometry?.dispose?.());
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
    costruisciAnteScorrevoliGlobali(config);
  }

  costruisciTamponamenti(config);
  costruisciCostadi(config);

  // Se c'è il tamp sotto, alzo tutto il mobile così il tamp resta sopra il
  // pavimento virtuale e si vede.
  const tampSotto = config.tamponamenti?.sotto;
  const yOffset = tampSotto?.attivo ? tampSotto.larghezza : 0;
  gruppoArmadio.position.y = yOffset;

  uvInScala(gruppoArmadio);       // prodotti del catalogo: foto in scala vera
  // OMBRE: tutto l'armadio fa e riceve ombra; muro dietro e luce inquadrati sull'armadio
  ombreSuTutto(gruppoArmadio);
  // il mobile FA ombra (su pavimento e muro) ma non la riceve dal sole: dentro i vani il sole
  // disegnava strisce diagonali chiare e scure sui fianchi e sulla schiena (in una stanza vera la
  // luce dentro un armadio è diffusa); gli angoli e i ripiani restano scuriti dalle ombre di contatto
  gruppoArmadio.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  gruppoArmadio.updateMatrixWorld(true);
  const bbA = new THREE.Box3().setFromObject(gruppoArmadio);
  if (!bbA.isEmpty() && muroDietro) {
    const larg = bbA.max.x - bbA.min.x + 3600, alt = Math.max(2700, bbA.max.y + 400);
    muroDietro.scale.set(larg, alt, 1);
    muroDietro.position.set((bbA.min.x + bbA.max.x) / 2, alt / 2, bbA.min.z - 2);
    muroDietro.visible = true;
  }
  if (luceOmbre && !bbA.isEmpty()) inquadraOmbre(renderer, luceOmbre, bbA, new THREE.Vector3(0.55, 1.3, 1));
  riflessiLucidi();

  // INQUADRATURA: 3/4 adatta al mobile SOLO la prima volta. Dopo la vista resta dove l'ha messa
  // chi lavora (cambiando un colore, una maniglia… non si gira più); se cambiano le misure
  // dell'armadio la vista si sposta con il suo centro, con lo stesso angolo e la stessa distanza.
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna + yOffset;
  const D = config.profonditaEsterna;
  const centro = new THREE.Vector3(W / 2, H / 2, D / 2);
  if (!_vistaArmadio) {
    controls.target.copy(centro);
    const distMax = Math.max(W, H);
    camera.position.set(W / 2 + distMax * 1.1, H * 0.75, D + distMax * 1.6);
  } else if (centro.distanceTo(_vistaArmadio) > 1) {
    const off = camera.position.clone().sub(controls.target);
    controls.target.add(centro.clone().sub(_vistaArmadio));
    camera.position.copy(controls.target).add(off);
  }
  _vistaArmadio = centro;
  controls.update();
}
let _vistaArmadio = null;        // centro dell'armadio all'ultima inquadratura (null = mai inquadrato)

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

// FUGHE tra le ante (vere, 2 mm): da lontano sono più sottili di un pixel e il 3D le disegnerebbe
// "a pezzi". Una RIGA scura sul bordo di ogni anta (una linea è sempre larga almeno un pixel:
// resta continua a qualunque distanza) e, dietro l'anta, un FONDO scuro che si vede solo dentro
// la fuga (da vicino si vede l'ombra, non la carcassa chiara).
const matFugaLinea = new THREE.LineBasicMaterial({ color: 0x1c1a17, transparent: true, opacity: 0.6 });
const matFugaFondo = new THREE.MeshBasicMaterial({ color: 0x15130f });
function fugheAnta(gruppo, cx, cy, w, h, sp, fondo = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z = sp / 2 + 0.4;
  const v = [[x0, y0], [x1, y0], [x1, y0], [x1, y1], [x1, y1], [x0, y1], [x0, y1], [x0, y0]].map(([x, y]) => new THREE.Vector3(x, y, z));
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(v), matFugaLinea); l.userData.tipo = 'fuga'; gruppo.add(l);
  if (fondo) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w + fondo, h + fondo), matFugaFondo);
    f.position.set(cx, cy, -sp / 2 + 0.6); f.userData.tipo = 'fuga'; gruppo.add(f);
  }
}

/**
 * Costruisce un singolo modulo (carcassa + schiena + ripiani + ante +
 * eventuali cassettiere) con lo stesso schema delle formule.
 */
const _geoBarra = new THREE.CylinderGeometry(1, 1, 1, 28);
const _matBarra = {};
/** Alluminio satinato o nero (metallo). */
function materialeBarra(id) {
  if (!_matBarra[id]) _matBarra[id] = id === 'nero'
    ? new THREE.MeshStandardMaterial({ color: 0x1d1d1d, metalness: 0.45, roughness: 0.42 })
    : new THREE.MeshStandardMaterial({ color: 0xc4c7cb, metalness: 0.85, roughness: 0.38 });
  return _matBarra[id];
}

/** Zona dove possono stare i ripiani di un modulo (sopra le cassettiere, sotto il cielo). */
function zonaRipiani(config, modulo, indice) {
  const sC = config.spessoreCarcassa, H = config.altezzaEsterna;
  let yOccupato = 0;
  (config.cassettiere || []).forEach((cas) => {
    const idxs = Array.isArray(cas.moduli) && cas.moduli.length > 0 ? cas.moduli : config.moduli.map((_, i) => i);
    if (idxs.includes(indice)) yOccupato += Math.max(100, cas.altMax || 800) + 10;
  });
  const yBase = sC + yOccupato, yFine = H - sC;
  return { yMin: yBase + sC / 2 + 20, yMax: yFine - sC / 2 - 20, sC };
}
let _zoneModuli = [];          // per modulo: x0, x1 (coordinate dell'armadio), yMin, yMax dei ripiani

function costruisciModulo(config, modulo, xOffset, prof, indice = 0, totali = 1) {
  _zoneModuli[indice] = { x0: xOffset, x1: xOffset + modulo.larghezza, ...zonaRipiani(config, modulo, indice) };
  const sC = config.spessoreCarcassa;
  const sS = config.spessoreSchiena;
  const sA = config.spessoreAnte;
  const H = config.altezzaEsterna;
  const W = modulo.larghezza;
  const scorrevole = config.tipoArmadio === 'scorrevole';

  // Z di riferimento: retro della struttura. Con la schiena AVVITATA DIETRO la struttura parte dopo
  // la schiena; a filo o in canale la schiena sta dentro e la struttura tocca il muro.
  const ms = misureSchiena(config);
  const zRetro = ms.tipo === 'dietro' ? sS : 0;
  const zUtile = zRetro + schienaDentro(config);   // davanti alla schiena: da qui partono ripiani e barra
  const zCarcassaCentro = zRetro + prof / 2;
  const zFrontePezzi = zRetro + prof; // z del fronte carcassa
  // ANTE INTERNE: l'anta sta dentro il vano, a filo del fronte della struttura (non davanti)
  const interne = anteInterne(config);
  const zAnteCentro = interne ? zFrontePezzi - sA / 2 : zFrontePezzi + sA / 2;

  if (scorrevole) {
    // SCORREVOLE: standard (top/fondo passanti, fianchi dentro) o FIANCHI ESTERNI (setup 2: fianchi
    // alti quanto l'armadio, top e fondo fra i fianchi). prof = P - sS; fianchi larghi/stretti.
    const fEst = config.setupCarcassa === 2;
    const wTF = fEst ? W - 2 * sC : W;
    aggiungiBox(wTF, sC, prof, xOffset + W / 2, H - sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'top');
    aggiungiBox(wTF, sC, prof, xOffset + W / 2, sC / 2, zCarcassaCentro,
      matDi(config, "carcassa"), 'fondo');
    const altFianco = fEst ? H : H - 2 * sC;
    const yFianco = fEst ? H / 2 : sC + altFianco / 2;
    const profStretto = profonditaFiancoInterno(config);
    const sxLargo = indice === 0;
    const dxLargo = indice === totali - 1;
    // Fianco sx
    const pSx = sxLargo ? prof : profStretto;
    aggiungiBox(sC, altFianco, pSx,
      xOffset + sC / 2, yFianco, zRetro + pSx / 2,
      matDi(config, "carcassa"), 'fianco');
    // Fianco dx
    const pDx = dxLargo ? prof : profStretto;
    aggiungiBox(sC, altFianco, pDx,
      xOffset + W - sC / 2, yFianco, zRetro + pDx / 2,
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

  // Schiena: dietro (copre tutto), a filo del retro dei fianchi o nel canale (fra fianchi, top e fondo;
  // la parte che entra nel canale è nascosta dentro i pannelli)
  if (ms.tipo === 'dietro') {
    aggiungiBox(W - 2, H - 2, sS, xOffset + W / 2, H / 2, sS / 2, matDi(config, "schiena"), 'schiena');
  } else {
    const zS = (ms.tipo === 'canale' ? ms.dentro : 0) + sS / 2;
    aggiungiBox(W - 2 * sC, H - 2 * sC, sS, xOffset + W / 2, H / 2, zS, matDi(config, "schiena"), 'schiena');
  }

  // Ripiani — distribuiti uniformemente nello spazio LIBERO del modulo.
  // Se ci sono cassettiere (appoggiate in basso), i ripiani si centrano
  // SOPRA la cassettiera e sono equidistanti tra sé e tra top/cassettiera.
  if (modulo.ripiani > 0) {
    const larRipiano = W - 2 * sC;
    // dietro le ante (con le ante interne 10 mm più indietro dell'anta), come in distinta
    // come in distinta: scorrevole fino al binario, meno l'eventuale riduzione
    const profRipianoVisivo = profonditaRipiani(config) - (modulo.riduzioneRipiano || 0);
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
        zUtile + profRipianoVisivo / 2,
        matDi(config, "carcassa"), 'ripiano');
      Object.assign(m.userData, { modulo: indice, indice: r - 1, yMin, yMax });
    }
  }

  // BARRA APPENDIABITI (ovale 30×15) 6 cm sotto il ripiano più alto, o sotto il cielo
  if (modulo.barra) {
    const larInt = W - 2 * sC;
    const ys = gruppoArmadio.children.filter((o) => o.userData.tipo === 'ripiano' && o.userData.modulo === indice).map((o) => o.position.y);
    const ySotto = ys.length ? Math.max(...ys) - sC / 2 : H - sC;
    // spostato a mano (trascinandolo a porte aperte) oppure 6 cm sotto il ripiano più alto
    const yMinB = sC + 150, yMaxB = H - sC - 40;
    const yBarra = Number.isFinite(modulo.barraY) ? Math.min(yMaxB, Math.max(yMinB, modulo.barraY)) : ySotto - 60;
    const profUtile = scorrevole ? prof - profonditaBinario(config) : profonditaDentro(config);
    const zB = zUtile + profUtile / 2;
    const matB = materialeBarra(modulo.barra);
    const gB = new THREE.Group();
    gB.position.set(xOffset + W / 2, yBarra, zB);
    Object.assign(gB.userData, { tipo: 'perchero', modulo: indice, yMin: yMinB, yMax: yMaxB });
    const tubo = new THREE.Mesh(_geoBarra, matB);
    tubo.scale.set(15, larInt - 2, 7.5);                           // come in distinta: spazio dentro − 2
    tubo.rotation.z = Math.PI / 2;
    tubo.castShadow = true;
    Object.assign(tubo.userData, { tipo: 'barra', gruppo: gB });
    gB.add(tubo);
    for (const lato of [-1, 1]) {                                   // i 2 ganci sui fianchi
      const sup = new THREE.Mesh(new THREE.BoxGeometry(10, 44, 26), matB);
      sup.position.set(lato * (larInt / 2 - 5), 4, 0);
      Object.assign(sup.userData, { tipo: 'barra', gruppo: gB });
      gB.add(sup);
    }
    gruppoArmadio.add(gB);
  }

  // Ante a battente (solo se tipo = battente)
  // Ogni anta è dentro un pivot posizionato sul cardine; la rotazione del
  // pivot apre/chiude la porta senza dover rifare il mesh.
  if (config.tipoArmadio !== 'scorrevole') {
    const N = modulo.numeroAnte || 1;
    // sopra la struttura: (W − (N+1)·2) ÷ N × (H − 4) · INTERNE: dentro il vano, con l'aria attorno
    const aI = interne ? parametri().anteInterne.aria : 2;
    const x0V = interne ? sC : 0;                                  // le ante interne partono dentro il fianco
    const ridJ = riduzioneManigliaArmadio(config);                  // maniglia a profilo sul bordo: anta più stretta
    const larAnta = (interne ? (W - 2 * sC - (N + 1) * aI) / N : (W - (N + 1) * 2) / N) - ridJ;
    const altAnta = interne ? H - 2 * sC - 2 * aI : H - 4;
    for (let k = 0; k < N; k++) {
      const xStart = xOffset + x0V + aI + k * (larAnta + ridJ + aI); // bordo sinistro dello spazio dell'anta
      // Regola cardini:
      // - 1 anta: lato scelto dall'utente (antaLato). 'dx' (maniglia a destra)
      //   = cardine a sinistra; 'sx' (maniglia a sinistra) = cardine a destra.
      // - 2+ ante: prima metà a sinistra, seconda metà a destra.
      const cardineSx = (N === 1)
        ? (modulo.antaLato !== 'sx')
        : (k < Math.ceil(N / 2));
      const hingeX = cardineSx ? xStart : xStart + larAnta + ridJ;
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
      fugheAnta(pivot, mesh.position.x, 0, larAnta, altAnta, sA, aI);
      // maniglia sul bordo che si apre (lontano dal cardine)
      const man = manigliaScelta(config);
      if (man) {
        // profilo / a bordo: sul bordo che apre; le altre a 40 mm dal bordo
        const dB = man.forma === 'bordol' ? 0 : ['profilo', 'bordo'].includes(man.forma) ? 17 : 40;
        aggiungiManiglia(pivot, man, cardineSx ? larAnta - dB : -larAnta + dB, yManiglia(man, altAnta, H / 2 - altAnta / 2, config), sA / 2,
          lunghezzaManigliaAnta(man, config, altAnta), cardineSx ? -Math.PI / 2 : Math.PI / 2);
      }
      gruppoArmadio.add(pivot);
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
      // stesse misure della distinta (calcoli.js → geometriaCassettiera, ⚙ Parametri → Cassettiera)
      const G = geometriaCassettiera(config, c, W);
      const { AltMax, larTF, profScatola, As, larFronte, fasciaSotto } = G;
      const altFianchi = AltMax - 4 * sC;
      const xCentro = xOffset + W / 2;
      // SCATOLA appoggiata alla schiena, sopra le fascette sotto (sC); sopra la scatola il ripiano (top della cassettiera)
      const zScatolaFronte = zUtile + profScatola;
      const zScatolaCentro = zUtile + profScatola / 2;
      const yScatola = yCassBase + sC;
      const matStr = matDi(config, "cassStruttura");
      aggiungiBox(larTF, sC, profScatola,
        xCentro, yScatola + As - sC / 2, zScatolaCentro,
        matStr, 'cass-top');
      aggiungiBox(larTF, sC, profScatola,
        xCentro, yScatola + sC / 2, zScatolaCentro,
        matStr, 'cass-fondo');
      const yFianchi = yScatola + sC + altFianchi / 2;
      aggiungiBox(sC, altFianchi, profScatola,
        xCentro - larTF / 2 + sC / 2, yFianchi, zScatolaCentro,
        matStr, 'cass-fianco');
      aggiungiBox(sC, altFianchi, profScatola,
        xCentro + larTF / 2 - sC / 2, yFianchi, zScatolaCentro,
        matStr, 'cass-fianco');
      // CORNICE a filo dei frontali: fascette laterali (alte AltMax − sC, fino sotto il ripiano)
      // fra il fianco del modulo e la scatola, e la fascetta sotto davanti; più la fascetta sotto dietro.
      const zCornice = zScatolaFronte + 1 + sC;                // faccia davanti dei frontali e della cornice
      const altFL = AltMax - sC;
      // di taglio (si vede lo spessore) o di piatto (larga quanto scritto) + il pannellino a L dietro, contro il
      // fianco dell'armadio (come in distinta)
      const { fasciaVista: fV, fasciaProf: fP } = G;
      for (const lato of [-1, 1]) {
        aggiungiBox(fV, altFL, fP,
          xCentro + lato * (larTF / 2 + fV / 2), yCassBase + altFL / 2, zCornice - fP / 2,
          matStr, 'cass-fascetta');
        if (G.pannellinoL) aggiungiBox(sC, altFL, G.pannellinoL,
          xCentro + lato * (larTF / 2 + fV - sC / 2), yCassBase + altFL / 2, zCornice - fP - G.pannellinoL / 2,
          matStr, 'cass-fascetta');
      }
      aggiungiBox(larTF, sC, fasciaSotto, xCentro, yCassBase + sC / 2, zCornice - fasciaSotto / 2, matStr, 'cass-fascetta');
      aggiungiBox(larTF, sC, fasciaSotto, xCentro, yCassBase + sC / 2, zUtile + fasciaSotto / 2, matStr, 'cass-fascetta');
      // RIPIANO SOPRA (top della cassettiera): sopra le fascette laterali, largo come lo spazio del modulo
      aggiungiBox(G.larRipiano, sC, G.profRipiano, xCentro, yCassBase + AltMax - sC / 2, zUtile + G.profRipiano / 2,
        matDi(config, "carcassa"), 'cass-ripiano');
      // FRONTALI davanti alla scatola (1 mm), fra la fascetta sotto e il ripiano; ribassati = più bassi, il vuoto resta sopra
      const matFronti = matDi(config, "cassFronti");
      const zFronte = zScatolaFronte + 1 + sC / 2;
      for (const f of G.fronti) {                              // dall'alto in basso, uguali o di misure diverse
        const cy = yScatola + f.y + f.h / 2;
        aggiungiBox(larFronte, f.h, sC, xCentro, cy, zFronte, matFronti, 'cassetto');
        const lman = Math.min(larFronte * 0.5, 300);
        const hman = Math.min(f.h0 * 0.14, 22);
        const yMan = cy + f.h / 2 - Math.min(f.h0 * 0.22, 55);
        if (G.incassata) {
          // MANIGLIA INCASSATA: fresata nel frontale, a filo (non sporge niente)
          const inc = new THREE.Mesh(new THREE.BoxGeometry(Math.min(larFronte * 0.4, 200), Math.max(14, hman), 2), MAT_INCASSO);
          inc.position.set(xCentro, yMan, zFronte + sC / 2 - 0.6);
          inc.userData.tipo = 'maniglia-incassata';
          gruppoArmadio.add(inc);
          continue;
        }
        if (!G.maniglia) continue;
        if (G.defMan) {
          // MANIGLIA SCELTA PER I CASSETTI (Materiali → Cassettiera · Maniglie): orizzontale, lunga come in distinta;
          // profilo sul bordo / a J: sul bordo alto del frontale (il frontale è già più basso del suo spessore)
          const def = G.defMan, Lc = lunghezzaManigliaCassetto(def, larFronte);
          const dB = def.forma === 'bordol' ? 0 : ['profilo', 'bordo'].includes(def.forma) ? 17 : null;
          const gm = new THREE.Group();
          gm.userData.tipo = 'maniglia-cassetto';           // dentro l'armadio: si vede a porte aperte
          gm.visible = porteAperte;
          aggiungiManiglia(gm, def, xCentro, dB == null ? yMan : cy + f.h / 2 - dB, zFronte + sC / 2, Lc, 0);
          gruppoArmadio.add(gm);
          continue;
        }
        // MANIGLIA ESTERNA: barra che sporge dal frontale quanto scritto nella cassettiera
        const sp = G.sporgenza || 25;
        const man = new THREE.Mesh(new THREE.BoxGeometry(lman, hman, sp), MAT_METALLO);
        man.position.set(xCentro, yMan, zFronte + sC / 2 + sp / 2);
        man.castShadow = true;
        // cassettiera DENTRO l'armadio: la maniglia si vede solo a porte aperte
        man.userData.tipo = 'maniglia-cassetto';
        man.visible = porteAperte;
        gruppoArmadio.add(man);
      }
      yCassBase += AltMax + 10;
    });
  }
}

/**
 * ANTE SCORREVOLI di tutto l'armadio, con le MISURE DELLA DISTINTA (calcoli.js):
 * larghezza = L ÷ n° ante − «larghezza meno» del binario − tirador, altezza = H − «altezza meno».
 * Le ante sono distribuite su tutta la larghezza, alternate avanti/dietro; aprendo, quella
 * davanti scorre sopra quella dietro accanto.
 */
function costruisciAnteScorrevoliGlobali(config) {
  const sA = config.spessoreAnte;
  const B = profonditaBinario(config);                    // spazio del binario (⚙ Parametri → Binari)
  const L = config.moduli.reduce((t, m) => t + (Number(m.larghezza) || 0), 0);
  const nTot = Math.max(1, config.moduli.length * (config.scorrevole?.anteModulo ?? 1));
  const larAntaSc = larghezzaAntaScorrevole(config);
  const altAntaSc = altezzaAntaScorrevole(config);
  const zAvanti = config.profonditaEsterna - sA / 2 - 2;
  const zDietro = config.profonditaEsterna - sA - sA / 2 - 4;
  const matAnteSc = matDi(config, "ante");
  const cy = (B * 0.4) + altAntaSc / 2;                        // appoggiata sul binario di sotto

  // SCORREVOLI: niente maniglie; su ENTRAMBI i lati di ogni anta il PROFILO verticale a tutta
  // altezza (alluminio, colori del binario, di partenza bianco) che abbraccia il bordo dell'anta
  const idProf = config.scorrevole?.coloreProfilo || 'binario-bianco';
  const matProf = getMaterialeTHREE(MATERIALI.some((m) => m.id === idProf && m.categoria === 'binario') ? idProf : 'binario-bianco',
    () => { if (resa) resa.cambiato(); else renderer?.render(scene, camera); });
  // TIRADOR scelto (⚙ Parametri): faccia vista, sporgenza e forma; lungo come l'anta (come in distinta)
  const tir = tiradorArmadio(config);
  const profili = (pivot, w, h) => {
    const PW = tir.larghezza, SP = tir.sporgenza;
    for (const lato of [-1, 1]) {
      const x = lato * (w / 2 - PW / 2 + 2);
      const metti = (geo, px, pz, rotY = 0) => {
        const pr = new THREE.Mesh(geo, matProf);
        pr.position.set(px, 0, pz); pr.rotation.y = rotY;
        pr.castShadow = true; pr.userData.tipo = 'profilo-anta';
        pivot.add(pr);
      };
      if (tir.forma === 'piatto') {
        metti(new THREE.BoxGeometry(PW, h, Math.max(2, SP)), x, sA / 2 + Math.max(2, SP) / 2);
      } else if (tir.forma === 'tondo') {
        const r = PW / 2, g = new THREE.CylinderGeometry(r, r, h, 20, 1, false, 0, Math.PI);
        metti(g, x, sA / 2, -Math.PI / 2);
        metti(new THREE.BoxGeometry(3, h, sA + 2), lato * (w / 2 - 1.5 + 2), 0);   // risvolto sul fianco dell'anta
      } else {
        metti(new THREE.BoxGeometry(PW, h, sA + 2 * SP), x, 0);                    // avvolgente
      }
    }
  };
  const creaAnta = (xBase, cz, xOffsetAperto) => {
    const pivot = new THREE.Group();
    pivot.position.set(xBase + (porteAperte ? xOffsetAperto : 0), cy, cz);
    pivot.userData.tipo = 'pivot-anta-scorrevole';
    pivot.userData.xBase = xBase;
    pivot.userData.xOffsetAperto = xOffsetAperto;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(larAntaSc, altAntaSc, sA), matAnteSc);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.tipo = 'anta';
    pivot.add(mesh);
    fugheAnta(pivot, 0, 0, larAntaSc, altAntaSc, sA);
    profili(pivot, larAntaSc, altAntaSc);
    gruppoArmadio.add(pivot);
  };
  // distribuite su tutta la larghezza (la prima a sinistra, l'ultima a destra), alternate avanti/dietro
  const passo = nTot > 1 ? (L - larAntaSc) / (nTot - 1) : 0;
  for (let k = 0; k < nTot; k++) {
    const avanti = k % 2 === 0;
    creaAnta(larAntaSc / 2 + k * passo, avanti ? zAvanti : zDietro, avanti && k < nTot - 1 ? passo : 0);
  }
}

/**
 * Costruisce solo i BINARI (sup + inf) che attraversano tutto l'armadio.
 * NON entrano nella distinta (sono componenti a parte dell'utente).
 */
function costruisciBinariGlobali(config) {
  const B = profonditaBinario(config);                    // spazio del binario (⚙ Parametri → Binari)
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna;
  const D = config.profonditaEsterna;
  const sC = config.spessoreCarcassa;
  const altBinSup = B * 0.6;
  const altBinInf = B * 0.4;
  const matBinario = matBinarioDi(config);
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
 * COSTADI a vista (armadio non incassato): fuori dalla larghezza dei moduli, dal retro della
 * schiena fino a 2 mm (sporgenza) davanti alle ante, dal pavimento (anche sotto il tamponamento
 * sotto) fino in cima (anche il tamponamento sopra). Misure da misureCostado (calcoli.js).
 */
function costruisciCostadi(config) {
  const c = misureCostado(config);
  if (!c.sx && !c.dx) return;
  const W = config.larghezzaTotale, H = config.altezzaEsterna;
  const yC = (H + c.sopra - c.sotto) / 2;
  if (c.sx) aggiungiBox(c.spessore, c.altezza, c.profondita, -c.spessore / 2, yC, c.profondita / 2, matDi(config, 'costadi'), 'costado');
  if (c.dx) aggiungiBox(c.spessore, c.altezza, c.profondita, W + c.spessore / 2, yC, c.profondita / 2, matDi(config, 'costadi'), 'costado');
}

/**
 * Posiziona i tamponamenti all'esterno dell'armadio, con fascia a L dietro.
 */
function costruisciTamponamenti(config) {
  // sul lato con il COSTADO a vista niente tamponamento laterale
  const cos = misureCostado(config), t0 = config.tamponamenti || {};
  const t = { ...t0, sx: cos.sx ? null : t0.sx, dx: cos.dx ? null : t0.dx };
  const W = config.larghezzaTotale;
  const H = config.altezzaEsterna;
  const D = config.profonditaEsterna;
  const sA = spessoreMateriale(config.materiali && config.materiali.tamponamenti) || config.spessoreAnte;   // come in distinta
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
