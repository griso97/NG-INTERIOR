// =============================================================================
// VISTA 3D — Progettazione cucina (Step 3)
// =============================================================================
// Disegna in 3D i mobili posati in pianta, CON I FRONTI REALI: ante, cassetti
// (nel numero scelto), colonne (porta bassa + forno/microonde/porta), piani di
// lavoro, lavello e piano cottura. Forno e microonde usano un'immagine
// "standard" generata al volo (nessun file esterno).
// Unità in MILLIMETRI. Assi: X = pianta x · Y = altezza · Z = −(pianta y).
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  calcolaVertici, dimMobile, categoriaTipo,
  moduliDiParete, PROFONDITA_BASE, infoAngoloCieco, SPESSORE_ANTA,
} from './modello.js';
import { getMaterialeTHREE, MATERIALI } from '../materiali.js';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js';
import { sfondoDi } from '../sfondi.js';
export { MATERIALI } from '../materiali.js';
export { SFONDI_LISTA } from '../sfondi.js';

export const MONTAGGIO_PENSILE = 1400;   // altezza da terra del basso dei pensili
const SP_TOP = 40;
// Zoccolo (piedini) in base all'altezza della porta:
//  porta 70 → zoccolo 150 mm · porta 80 → zoccolo 100 mm
function zoccoloPerAltezza(h) { return h >= 800 ? 100 : 150; }

// Quota della cima delle colonne (cassa + zoccolo). null se non ci sono colonne.
function quotaAltaColonne(progetto) {
  const cols = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) === 'colonna');
  if (cols.length === 0) return null;
  return Math.max(...cols.map((c) => (c.altezza_mm || 2200) + zoccoloPerAltezza(c.altezzaBassa_mm || 700)));
}
const ALT_MURO = 2600;
const H_FORNO = 600;
const H_MICRO = 380;

let scene, camera, renderer, controls, gruppo, canvasEl;
let animazioneAttiva = false;
let selId = null;             // mobile evidenziato (selezionato nel 3D)
let ultimoProgetto = null;    // ultimo progetto reso (per ricostruire al caricamento texture)
const texCache = {};

/** Evidenzia un gruppo: bordi bianchi + leggero bagliore sul corpo. */
function evidenzia(g) {
  g.traverse((o) => {
    if (o.isLineSegments) {
      o.material = new THREE.LineBasicMaterial({ color: 0xffffff });
    } else if (o.isMesh && o.material && o.material.emissive !== undefined) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(0x9a7a28);
      o.material.emissiveIntensity = 1.0;
    }
  });
}

/** Lavello / piano cottura / rubinetto posati SOPRA la superficie del top. */
function aggiungiAccessorioTop(a) {
  const g = new THREE.Group();
  g.position.set(a.x, a.surfaceY, -a.y);
  g.rotation.y = -(a.rot || 0) * Math.PI / 180;
  if (a.id !== undefined) g.userData.mobId = a.id;
  if (a.placca) {
    // Piano a induzione: vetro nero lucido + zone di cottura (cerchi)
    const pw = Math.min(a.w - 40, 580), pd = Math.min(a.d - 80, 480);
    const vetro = new THREE.Mesh(new THREE.BoxGeometry(pw, 12, pd),
      new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.12, metalness: 0.35 }));
    vetro.position.set(0, 6, 0); g.add(vetro);
    const pos = a.fuochi === 2 ? [[0, -1], [0, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const rz = Math.min(pw, pd) * (a.fuochi === 2 ? 0.26 : 0.2);
    const matZona = new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.3, roughness: 0.5 });
    for (const [sx, sz] of pos) {
      const anello = new THREE.Mesh(new THREE.TorusGeometry(rz, 4, 8, 40), matZona);
      anello.rotation.x = Math.PI / 2;
      anello.position.set(sx * pw * 0.24, 13, sz * pd * 0.22); g.add(anello);
    }
    // Pannello comandi (striscia chiara davanti)
    const comandi = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.5, 2, 40),
      new THREE.MeshStandardMaterial({ color: 0x202028, roughness: 0.4, metalness: 0.3 }));
    comandi.position.set(0, 13, pd / 2 - 35); g.add(comandi);
  }
  if (a.lavello) {
    const matInox = new THREE.MeshStandardMaterial({ color: 0xcacace, roughness: 0.18, metalness: 0.9 });
    const matInt = new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.25, metalness: 0.85 });
    const vw = Math.min(a.w * 0.56, 500), vd = Math.min(a.d * 0.52, 400);
    const prof = 180, t = 14, zc = -a.d * 0.03;
    const iw = vw - 2 * t, id = vd - 2 * t;        // apertura interna
    // Cornice a filo del top (4 lati) → l'apertura centrale resta VUOTA (si vede la vasca)
    const br = 28;                                   // larghezza cornice
    const corniceGeo = [
      [0, 0, zc - vd / 2 - br / 2, vw + 2 * br, br],
      [0, 0, zc + vd / 2 + br / 2, vw + 2 * br, br],
      [-vw / 2 - br / 2, 0, zc, br, vd],
      [vw / 2 + br / 2, 0, zc, br, vd],
    ];
    for (const [px, , pz, sw, sd] of corniceGeo) {
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(sw, 12, sd), matInox);
      c2.position.set(px, 2, pz); g.add(c2);
    }
    // Pareti interne della vasca (scatola aperta sopra, scende sotto il top)
    for (const [px, pz, sw, sd] of [
      [0, zc - id / 2, iw, t], [0, zc + id / 2, iw, t],
      [-iw / 2, zc, t, id], [iw / 2, zc, t, id],
    ]) {
      const par = new THREE.Mesh(new THREE.BoxGeometry(sw, prof, sd), matInt);
      par.position.set(px, -prof / 2, pz); g.add(par);
    }
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(iw, t, id), matInt);
    fondo.position.set(0, -prof, zc); g.add(fondo);
    const scarico = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.6 }));
    scarico.position.set(0, -prof + 8, zc); g.add(scarico);
    // Rubinetto a miscelatore: base + colonna + canna orizzontale (collegati)
    const matMet = new THREE.MeshStandardMaterial({ color: 0xdedee2, roughness: 0.15, metalness: 0.95 });
    const zr = -a.d * 0.34, hTop = 300;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(28, 34, 26, 20), matMet);
    base.position.set(0, 13, zr); g.add(base);
    const colonna = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, hTop, 16), matMet);
    colonna.position.set(0, 13 + hTop / 2, zr); g.add(colonna);
    // Raccordo in cima (sfera) + canna che va in avanti e scende
    const nodo = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 16), matMet);
    nodo.position.set(0, 13 + hTop, zr); g.add(nodo);
    const canna = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 190, 16), matMet);
    canna.rotation.x = Math.PI / 2;
    canna.position.set(0, 13 + hTop, zr + 95); g.add(canna);
    const beccuccio = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 55, 16), matMet);
    beccuccio.position.set(0, 13 + hTop - 27, zr + 185); g.add(beccuccio);
    const leva = new THREE.Mesh(new THREE.CapsuleGeometry(8, 70, 4, 8), matMet);
    leva.rotation.z = Math.PI / 2;
    leva.position.set(44, 52, zr); g.add(leva);
  }
  gruppo.add(g);
}

const COL = {
  // Carcassa e fronti di default in tono NEUTRO (niente oro/olivastro):
  // quando si sceglie un colore/legno le ante lo prendono, la cassa resta neutra.
  corpo:   0xb7b1a4,
  anta:    0xcac4b8,
  cassetto:0xc7c1b5,
  pensile: 0xb9b3a6,
  colonna: 0xb3ada0,
  regletta:0xbdb7aa,
  costado: 0xc0b9ac,
  top:     0x232323,
  muro:    0x3a362c,
  pav:     0xd7d0c4,
  oro:     0xc9a94a,
};
// Linee di contorno discrete (niente oro): un filo scuro che fa da fuga/ombra.
const matOro = new THREE.LineBasicMaterial({ color: 0x3b3833, transparent: true, opacity: 0.55 });
const matManiglia = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.35, metalness: 0.6 });

// Ambiente IBL: gradiente (soffitto chiaro → pavimento scuro) per riflessi soft.
function creaAmbiente(rnd) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.0, '#eae4d6');
  grd.addColorStop(0.45, '#b7b0a0');
  grd.addColorStop(0.55, '#5a564c');
  grd.addColorStop(1.0, '#1a1a1a');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(rnd);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

// ---------------------------------------------------------------------------
export function montaScena3d(canvas, progetto) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(50, w / h, 10, 60000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  // Resa più realistica: tone mapping cinematografico + colori sRGB
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Illuminazione d'ambiente (image-based) per riflessi e materiali reali
  scene.environment = creaAmbiente(renderer);

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x403828, 1.6));
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
  key.position.set(3000, 6000, 4000); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.9);
  fill.position.set(-4000, 3000, -2000); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(0, 2000, -5000); scene.add(rim);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;

  gruppo = new THREE.Group();
  scene.add(gruppo);
  aggiornaScena3d(progetto, true);

  window.addEventListener('resize', forzaResize3d);
  animazioneAttiva = true;
  animate();
}

function animate() {
  if (!animazioneAttiva) return;
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export function forzaResize3d() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

/** Salva l'immagine del rendering in ALTA QUALITÀ (PNG). */
export function esportaImmagine3d(nomeFile = 'cucina.png', latoMax = latoMaxExport()) {
  if (!renderer || !scene || !camera || !canvasEl) return false;
  const cw = canvasEl.clientWidth || canvasEl.width;
  const ch = canvasEl.clientHeight || canvasEl.height;
  const pr0 = renderer.getPixelRatio();
  const scala = Math.max(1, latoMax / Math.max(cw, ch));
  const tw = Math.round(cw * scala), th = Math.round(ch * scala);
  renderer.setPixelRatio(1);
  renderer.setSize(tw, th, false);
  camera.aspect = tw / th; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  let canvas2d = null;
  try { canvas2d = componiConLogo(canvasEl); } catch (e) { canvas2d = null; }
  renderer.setPixelRatio(pr0);
  renderer.setSize(cw, ch, false);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  if (!canvas2d) return false;
  return salvaImmagineCanvas(canvas2d, nomeFile);
}

const rayPick = new THREE.Raycaster();
/** Dato un punto schermo, ritorna l'id del mobile cliccato (o null). */
export function pickMobile(clientX, clientY) {
  if (!renderer || !camera || !gruppo) return null;
  const rect = canvasEl.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  rayPick.setFromCamera(mouse, camera);
  const hits = rayPick.intersectObjects(gruppo.children, true);
  for (const hit of hits) {
    let o = hit.object;
    while (o && o.userData.mobId === undefined) o = o.parent;
    if (o && o.userData.mobId !== undefined) return o.userData.mobId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Primitive
function corpo(w, h, d, coloreOMat) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = (coloreOMat && coloreOMat.isMaterial)
    ? coloreOMat
    : new THREE.MeshStandardMaterial({ color: coloreOMat, roughness: 0.7, metalness: 0.05 });
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro));
  return g;
}

/** Pannello (anta/cassetto) sporgente sul fronte locale (+Z). */
function pannello(g, px, py, z, pw, ph, mat) {
  // Anta: uso direttamente il materiale (legno con texture o tinta piena),
  // così la venatura compare su tutte le facce dell'anta.
  const materiale = (mat && mat.isMaterial)
    ? mat
    : new THREE.MeshStandardMaterial({ color: (mat || COL.anta), roughness: 0.6, metalness: 0.08 });
  const box = new THREE.BoxGeometry(pw, ph, 20);
  const mesh = new THREE.Mesh(box, materiale);
  mesh.position.set(px, py, z + 10);
  g.add(mesh);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), matOro);
  e.position.copy(mesh.position);
  g.add(e);
}

function maniglia(g, x, y, z, orizz, lung) {
  const geo = orizz ? new THREE.BoxGeometry(lung, 16, 16) : new THREE.BoxGeometry(16, lung, 16);
  const m = new THREE.Mesh(geo, matManiglia);
  m.position.set(x, y, z + 24);
  g.add(m);
}

/** Immagine "standard" di forno o microonde su canvas → texture. */
function texElettro(tipo) {
  if (texCache[tipo]) return texCache[tipo];
  const c = document.createElement('canvas');
  c.width = 256; c.height = tipo === 'microonde' ? 150 : 200;
  const x = c.getContext('2d');
  x.fillStyle = '#17171a'; x.fillRect(0, 0, c.width, c.height);
  const grd = x.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#34343a'); grd.addColorStop(0.5, '#1c1c20'); grd.addColorStop(1, '#101014');
  if (tipo === 'forno') {
    x.fillStyle = '#0c0c0d'; x.fillRect(0, 0, c.width, 34);
    x.fillStyle = '#c9a94a';
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(40 + i * 56, 17, 8, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = grd; x.fillRect(18, 48, c.width - 36, c.height - 64);
    x.strokeStyle = '#3a3a40'; x.lineWidth = 2; x.strokeRect(30, 60, c.width - 60, c.height - 88);
    x.fillStyle = '#d8d8d8'; x.fillRect(18, 40, c.width - 36, 7);
  } else {
    x.fillStyle = grd; x.fillRect(10, 10, c.width - 78, c.height - 20);
    x.strokeStyle = '#3a3a40'; x.lineWidth = 2; x.strokeRect(22, 22, c.width - 102, c.height - 44);
    x.fillStyle = '#0c0c0d'; x.fillRect(c.width - 62, 10, 52, c.height - 20);
    x.fillStyle = '#c9a94a';
    for (let i = 0; i < 3; i++) x.fillRect(c.width - 52, 24 + i * 24, 32, 9);
    x.fillStyle = '#2a2a30';
    for (let i = 0; i < 2; i++) x.fillRect(c.width - 52, 110 + i * 14, 32, 8);
    x.fillStyle = '#d8d8d8'; x.fillRect(c.width - 70, 14, 6, c.height - 28);
  }
  const t = new THREE.CanvasTexture(c);
  texCache[tipo] = t;
  return t;
}

/** Pannello elettrodomestico con immagine (forno/microonde). */
function pannelloElettro(g, py, z, pw, ph, tipo) {
  const tex = texElettro(tipo);
  const geo = new THREE.BoxGeometry(pw, ph, 22);
  const matFronte = new THREE.MeshBasicMaterial({ map: tex });
  const matLato = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.6 });
  // Ordine facce BoxGeometry: +X,-X,+Y,-Y,+Z,-Z → la texture solo sul +Z
  const mats = [matLato, matLato, matLato, matLato, matFronte, matLato];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.position.set(0, py, z + 11);
  g.add(mesh);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
  e.position.copy(mesh.position); g.add(e);
}

// ---------------------------------------------------------------------------
// Fronti per categoria. Corpo centrato nell'origine: x[-w/2,w/2] y[-h/2,h/2] z[-d/2,d/2]
// Fughe reali delle ante: in LARGHEZZA si toglie 3 mm totali (1,5 per lato),
// in ALTEZZA 2 mm (1 sopra, 1 sotto). GAP = fuga fra due ante/cassetti.
const FUGA_W = 3, FUGA_H = 2, GAP_ANTE = 3;
function ante(g, w, h, d, n, matAnta, sporg) {
  const z = d / 2;
  const uw = w - FUGA_W;
  const pw = (uw - (n - 1) * GAP_ANTE) / n;
  // sporgente: anta = h + 20 che avanza 2 cm SOTTO (bordo alto a filo).
  const ph = sporg ? (h + 20) : (h - FUGA_H);
  const py = sporg ? -10 : 0;
  for (let i = 0; i < n; i++) {
    const px = -uw / 2 + pw / 2 + i * (pw + GAP_ANTE);
    pannello(g, px, py, z, pw, ph, matAnta || COL.anta);
    const hx = n === 1 ? px + pw / 2 - 35 : (i === 0 ? px + pw / 2 - 22 : px - pw / 2 + 22);
    maniglia(g, hx, py, z, false, Math.min(260, ph * 0.5));
  }
}
function cassetti(g, w, h, d, n, matAnta) {
  const z = d / 2;
  const uw = w - FUGA_W, uh = h - FUGA_H;
  const ph = (uh - (n - 1) * GAP_ANTE) / n;
  for (let i = 0; i < n; i++) {
    const py = -uh / 2 + ph / 2 + i * (ph + GAP_ANTE);
    pannello(g, 0, py, z, uw, ph, matAnta || COL.cassetto);
    maniglia(g, 0, py + ph / 2 - Math.min(28, ph * 0.3), z, true, Math.min(uw * 0.5, 320));
  }
}
// Numero di fuochi in base alla larghezza del mobile: piccolo → 2, grande → 4.
function fuochiPerLarghezza(w) { return w < 600 ? 2 : 4; }

/** L'anta del pensile sporge 2 cm sotto? Dipende dall'opzione e dall'altezza. */
function antaPensileSporge(opt, h) {
  if (opt === 'sporg70') return Math.abs(h - 700) < 40;
  if (opt === 'sporg90') return Math.abs(h - 900) < 40;
  return false;
}

function pianoCottura(g, w, h, d, fuochi = 4) {
  const yTop = h / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 20, 20, d - 20),
    new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.4, metalness: 0.2 }));
  slab.position.set(0, yTop + 10, 0); g.add(slab);
  const pos = fuochi === 2
    ? [[-1, 0], [1, 0]]
    : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const r = Math.min(w, d) * (fuochi === 2 ? 0.16 : 0.14);
  for (const [sx, sz] of pos) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 8, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x33333a, metalness: 0.4, roughness: 0.5 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(sx * w * 0.22, yTop + 22, sz * d * 0.18); g.add(ring);
  }
}
function lavelloTop(g, w, h, d) {
  const z = d / 2, yTop = h / 2;
  const vasca = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 60, d * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.3, metalness: 0.5 }));
  vasca.position.set(0, yTop - 20, 0); g.add(vasca);
  const rub = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 180, 10),
    new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.3, metalness: 0.6 }));
  rub.position.set(0, yTop + 90, -d * 0.28); g.add(rub);
}
function colonnaFronte(g, w, h, d, m, matAnta) {
  const z = d / 2;
  const pw = w - FUGA_W;
  const ab = m.altezzaBassa_mm || 700;
  const bottom = -h / 2;
  const porta = (yB, segH) => {
    const cyc = yB + segH / 2;
    pannello(g, 0, cyc, z, pw, segH - FUGA_H, matAnta || COL.anta);
    maniglia(g, pw / 2 - 30, cyc, z, false, Math.min(260, (segH - FUGA_H) * 0.4));
  };
  porta(bottom, ab);                 // porta bassa
  let y0 = bottom + ab;
  const rem = h - ab;
  if (m.variante === 'forno') {
    const ho = Math.min(H_FORNO, rem - 300);
    pannelloElettro(g, y0 + ho / 2, z, pw, ho - 10, 'forno');
    porta(y0 + ho, rem - ho);
  } else if (m.variante === 'microonde') {
    const ho = Math.min(H_MICRO, rem - 300);
    pannelloElettro(g, y0 + ho / 2, z, pw, ho - 10, 'microonde');
    porta(y0 + ho, rem - ho);
  } else {
    porta(y0, rem);                  // porta unica a tutta altezza
  }
}

/** Lavastoviglie a incasso: anta unica + striscia comandi inox in alto. */
function lavastoviglieFronte(g, w, h, d, matAnta) {
  const z = d / 2;
  const pw = w - FUGA_W;
  const hStrip = 55;                              // fascia comandi in alto
  const ph = h - FUGA_H - hStrip;
  const cy = -h / 2 + FUGA_H / 2 + ph / 2;        // anta sotto la fascia
  pannello(g, 0, cy, z, pw, ph, matAnta || COL.anta);
  // Fascia comandi inox
  const strip = new THREE.Mesh(new THREE.BoxGeometry(pw, hStrip - 6, 22),
    new THREE.MeshStandardMaterial({ color: 0xc8c8cc, roughness: 0.3, metalness: 0.75 }));
  strip.position.set(0, h / 2 - FUGA_H / 2 - (hStrip - 6) / 2, z + 11);
  g.add(strip);
  // Spie/comandi
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.4, metalness: 0.5 }));
    led.rotation.x = Math.PI / 2;
    led.position.set(-pw / 2 + 40 + i * 26, h / 2 - FUGA_H / 2 - (hStrip - 6) / 2, z + 24);
    g.add(led);
  }
  // Maniglia a incasso sotto la fascia comandi
  maniglia(g, 0, h / 2 - FUGA_H / 2 - hStrip - 20, z, true, Math.min(pw * 0.55, 320));
}

/**
 * Fronte di un mobile ad ANGOLO CIECO: anta apribile sulla parte libera +
 * pannello cieco (fisso, senza maniglia) sulla parte coperta dall'altro mobile.
 */
function anteCieche(g, w, h, d, matAnta, cieco) {
  const z = d / 2;
  // Il pannello cieco si estende di `blindExtra` verso il centro del mobile:
  // è la striscia sotto cui passa il braccio lungo della regletta a L.
  // Così l'anta apribile parte DOPO la regletta e la regletta resta visibile.
  const extra = Math.max(0, cieco.blindExtra || 0);
  const coveredW = Math.max(40, Math.min(w - 80, cieco.coveredW + extra));
  const freeW = w - coveredW;
  const latoDx = cieco.latoDx;                      // copertura sul lato +x?
  const doorCx = latoDx ? (-w / 2 + freeW / 2) : (w / 2 - freeW / 2);
  const blindCx = latoDx ? (w / 2 - coveredW / 2) : (-w / 2 + coveredW / 2);
  // Anta/e apribili sulla parte libera
  const nAnte = freeW >= 900 ? 2 : 1;
  const uw = freeW - FUGA_W;
  const pw = (uw - (nAnte - 1) * GAP_ANTE) / nAnte;
  for (let i = 0; i < nAnte; i++) {
    const px = doorCx - uw / 2 + pw / 2 + i * (pw + GAP_ANTE);
    pannello(g, px, 0, z, pw, h - FUGA_H, matAnta || COL.anta);
    const hx = latoDx ? (px + pw / 2 - 30) : (px - pw / 2 + 30);
    maniglia(g, hx, 0, z, false, Math.min(260, (h - FUGA_H) * 0.5));
  }
  // Pannello cieco (fisso): stessa finitura, nessuna maniglia
  pannello(g, blindCx, 0, z, coveredW - FUGA_W, h - FUGA_H, matAnta || COL.anta);
}

/**
 * Regletta a L nell'angolo interno tra due mobili (uno cieco): due pezzi a 90°,
 * uno da 30 mm e uno da 30+spessore anta (48 con ante da 18), così uno sormonta
 * l'altro. Sta sul fronte, a filo dei due mobili.
 */
function aabbPlan(q) {
  const d = dimMobile(q);
  const rotN = ((Math.round((q.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const horiz = rotN % 180 === 0;
  const hx = (horiz ? d.w : d.d) / 2, hy = (horiz ? d.d : d.w) / 2;
  return { x0: q.x - hx, x1: q.x + hx, y0: q.y - hy, y1: q.y + hy, cx: q.x, cy: q.y };
}
function frontDirPlan(q) {
  const r = (q.rot || 0) * Math.PI / 180;
  return [-Math.sin(r), -Math.cos(r)];               // fronte 3D in pianta
}

function renderRegolettaAngolo(cieco, m, h, zocc, matAnta, dims) {
  const base = (dims && dims.base) || 30;
  const spess = (dims && dims.spessore != null) ? dims.spessore : SPESSORE_ANTA;
  const o = cieco.o;
  const THK = 20;                                        // spessore pannello (come le ante)
  const AVANZ = 22;                                      // a filo ante (20) + 2 mm proud → sempre visibile
  const hP = h;                                          // ALTEZZA PIENA del modulo (NO -2mm come le ante)

  const A = aabbPlan(m), B = aabbPlan(o);
  const fm = frontDirPlan(m), fo = frontDirPlan(o);

  // Quale mobile ha il fronte ORIZZONTALE (lungo ±y) e quale VERTICALE (lungo ±x).
  // Il braccio lungo (base+spess, es. 4.8) va sul mobile a fronte orizzontale.
  let H, Hf, V, Vf, legH, legV;
  if (Math.abs(fm[1]) > 0.5) { H = A; Hf = fm; V = B; Vf = fo; legH = base + spess; legV = base; }
  else { H = B; Hf = fo; V = A; Vf = fm; legH = base + spess; legV = base; }

  const frontY = (Hf[1] > 0) ? H.y1 : H.y0;            // linea del fronte orizzontale
  const frontX = (Vf[0] > 0) ? V.x1 : V.x0;            // linea del fronte verticale
  const cornerX = frontX, cornerY = frontY;            // angolo interno (incrocio fronti)

  const dirHx = (V.cx >= cornerX) ? -1 : 1;            // braccio orizz. si allontana da V
  const dirVy = (H.cy >= cornerY) ? -1 : 1;            // braccio vert. si allontana da H

  const planeY = frontY + Hf[1] * (AVANZ - THK / 2);   // piano anta (faccia a filo+2)
  const planeX = frontX + Vf[0] * (AVANZ - THK / 2);

  // Regletta BLU di debug: lasciata appositamente visibile per verificare a
  // occhio che sia posizionata bene dopo il restringimento del pannello cieco.
  // Da rimettere matAnta/COL.anta solo quando confermato OK.
  const mat = new THREE.MeshStandardMaterial({ color: 0x1e66ff, roughness: 0.45, metalness: 0.05 });
  const yC = zocc + hP / 2;
  const addBox = (sx, sz, cx, cy) => {
    const geo = new THREE.BoxGeometry(sx, hP, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, yC, -cy);
    gruppo.add(mesh);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
    e.position.copy(mesh.position); gruppo.add(e);
  };
  // Lateralmente (dove ci sono le ante) 3 mm d'aria per lato: i bracci partono
  // a FUGA_W dall'angolo, così c'è un reveal da 3 mm tra regletta e ante.
  // Braccio ORIZZONTALE: lungo legH in x, spesso THK in y; dall'angolo verso il lato esposto.
  addBox(legH, THK, cornerX + dirHx * (FUGA_W + legH / 2), planeY);
  // Braccio VERTICALE: spesso THK in x, lungo legV in y.
  addBox(THK, legV, planeX, cornerY + dirVy * (FUGA_W + legV / 2));
}

// Colori LED per temperatura (K approssimativi): caldo ~3000K, medio ~4000K,
// freddo ~6500K. Valori scelti per leggibilita' sul 3D, non riflettenti
// perche' le strisce LED viste di sotto appaiono molto luminose.
const LED_COLORI = {
  caldo:  0xffb878,   // bianco caldo (giallo/ambra)
  medio:  0xffe8c8,   // bianco neutro (crema)
  freddo: 0xc8dcff,   // bianco freddo (azzurrino)
};

/**
 * Strip LED sotto un pensile: una barra sottile emissiva appesa al bordo
 * inferiore della cassa, leggermente spostata verso il fronte. Si vede
 * anche con la camera dal basso e non interferisce con il magnete o
 * la geometria del mobile.
 */
function aggiungiLedPensile(g, w, h, d, colore) {
  const hex = LED_COLORI[colore] || LED_COLORI.caldo;
  const stripW = Math.max(60, w - 40);              // un filo piu' stretta della cassa
  const stripH = 6;                                 // sottile
  const stripD = 18;                                // profondita' della barra
  // Materiale "pieno" di colore (non reagisce all'illuminazione): la barra
  // appare sempre ben visibile anche in scene scure.
  const mat = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  const geo = new THREE.BoxGeometry(stripW, stripH, stripD);
  const mesh = new THREE.Mesh(geo, mat);
  // Posizione: sotto la cassa (y = -h/2 + mezza barra), spinta verso il
  // fronte del pensile (+z nella locale del mobile).
  mesh.position.set(0, -h / 2 + stripH / 2, d / 2 - stripD / 2 - 4);
  g.add(mesh);
  // Un alone piu' largo e meno saturo poco sotto per suggerire la luce
  // proiettata (senza usare una luce reale, che sarebbe pesante).
  const aloneMat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.22, toneMapped: false });
  const aloneGeo = new THREE.BoxGeometry(stripW + 60, 2, stripD + 40);
  const alone = new THREE.Mesh(aloneGeo, aloneMat);
  alone.position.set(0, -h / 2 - 6, d / 2 - (stripD + 40) / 2 - 4);
  g.add(alone);
}

/** Pensile ad angolo (63×63): cassa quadrata + anta diagonale a 45°. */
function pensileAngoloFronte(g, w, h, d, matAnta) {
  const mat = (matAnta && matAnta.isMaterial)
    ? matAnta
    : new THREE.MeshStandardMaterial({ color: COL.anta, roughness: 0.6, metalness: 0.08 });
  const diag = Math.min(w, d) * 1.18;              // larghezza anta diagonale
  const geo = new THREE.BoxGeometry(diag, h - FUGA_H, 18);
  const porta = new THREE.Mesh(geo, mat);
  porta.rotation.y = -Math.PI / 4;                 // fronte verso l'angolo stanza
  porta.position.set(w * 0.16, 0, d * 0.16);
  g.add(porta);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
  e.position.copy(porta.position); e.rotation.copy(porta.rotation); g.add(e);
  // Maniglia verticale sul fronte diagonale
  const nx = Math.sin(Math.PI / 4), nz = Math.cos(Math.PI / 4);  // normale anta
  const man = new THREE.Mesh(new THREE.BoxGeometry(16, Math.min(300, (h - FUGA_H) * 0.45), 16), matManiglia);
  man.position.set(w * 0.16 + nx * 16 - 120 * nz, 0, d * 0.16 + nz * 16 + 120 * nx);
  g.add(man);
}

/** Costruisce il mobile completo centrato nell'origine (corpo + fronti). */
function costruisciMobile(cat, tipo, m, w, h, d, matAnta, opt = {}) {
  const g = new THREE.Group();
  const coloreCorpo = cat === 'pensile' ? COL.pensile : cat === 'colonna' ? COL.colonna
    : cat === 'regletta' ? COL.regletta : COL.corpo;
  g.add(corpo(w, h, d, coloreCorpo));
  if (cat === 'regletta') return g;
  if (opt.cieco && opt.cieco.coperto) { anteCieche(g, w, h, d, matAnta, opt.cieco); return g; }
  if (tipo === 'pensile-angolo') { pensileAngoloFronte(g, w, h, d, matAnta); return g; }
  if (cat === 'colonna') { colonnaFronte(g, w, h, d, m, matAnta); return g; }
  if (tipo === 'base-cassetti') { cassetti(g, w, h, d, Math.max(1, m.cassetti || 3), matAnta); return g; }
  if (tipo === 'lavello') { ante(g, w, h, d, w >= 900 ? 2 : 1, matAnta); return g; } // lavello disegnato sopra il top
  if (tipo === 'lavastoviglie') { lavastoviglieFronte(g, w, h, d, matAnta); return g; }
  if (tipo === 'forno') { pannelloElettro(g, -h * 0.05, d / 2, w - 24, h * 0.7, 'forno'); return g; } // placca sopra il top
  // base con ante / pensile (il pensile può avere l'anta sporgente sotto)
  ante(g, w, h, d, w >= 900 ? 2 : 1, matAnta, opt.sporg);
  return g;
}

function collocaMobile(g, cx, yBottom, cz, h, rotGradi) {
  g.position.set(cx, yBottom + h / 2, cz);
  g.rotation.y = -(rotGradi || 0) * Math.PI / 180;
  return g;
}

// ---------------------------------------------------------------------------
export function aggiornaScena3d(progetto, reframe = false, selezionato = null) {
  if (!scene) return;
  selId = selezionato;
  while (gruppo.children.length) gruppo.remove(gruppo.children[0]);
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const bb = bbox(progetto, vertici);

  // Sfondo/pavimento scelti (solo estetica, non tocca luci/riflessi)
  const sf = sfondoDi(progetto.sfondo);
  scene.background = new THREE.Color(sf.bg);

  // Pavimento + griglia
  const padW = (bb.maxX - bb.minX) + 2000, padD = (bb.maxY - bb.minY) + 2000;
  const cxF = (bb.minX + bb.maxX) / 2, czF = -(bb.minY + bb.maxY) / 2;
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD),
    new THREE.MeshStandardMaterial({ color: sf.pav, roughness: 0.95 }));
  pav.rotation.x = -Math.PI / 2; pav.position.set(cxF, 0, czF); gruppo.add(pav);
  const grid = new THREE.GridHelper(Math.max(padW, padD), Math.round(Math.max(padW, padD) / 500), sf.g1, sf.g2);
  grid.position.set(cxF, 1, czF); gruppo.add(grid);

  // Muri di riferimento
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(L, ALT_MURO, 60),
      new THREE.MeshStandardMaterial({ color: COL.muro, roughness: 0.9, transparent: true, opacity: 0.3 }));
    muro.position.set((a.x + b.x) / 2, ALT_MURO / 2, -(a.y + b.y) / 2);
    muro.rotation.y = -Math.atan2(dy, dx);
    gruppo.add(muro);
  });

  // Raccolgo le basi per il piano continuo e gli accessori (placca/lavello)
  const basiTop = [];
  const accessori = [];
  const fianchi = [];   // costadi e colonne: delimitano il top (lo taglia/estende)
  const zoccoli = [];   // TUTTO ciò che poggia a terra (basi, colonne, reglette):
                        // lo zoccolo è un unico pezzo continuo che li copre tutti

  // Materiale delle ante per gruppo (bassi / pensili / colonne). null = colore di default.
  const col = progetto.coloriFronti || {};
  ultimoProgetto = progetto;
  const reRender = () => { if (ultimoProgetto) aggiornaScena3d(ultimoProgetto, false, selId); };
  const matBase = col.base ? getMaterialeTHREE(col.base, reRender) : null;
  const matPensile = col.pensile ? getMaterialeTHREE(col.pensile, reRender) : null;
  const matColonna = col.colonna ? getMaterialeTHREE(col.colonna, reRender) : null;
  const matCostado = col.costado ? getMaterialeTHREE(col.costado, reRender) : null;
  // Encimera (piano di lavoro): materiale e spessore dall'eventuale scelta
  // utente. Nessuna scelta -> colore COL.top e spessore SP_TOP come prima.
  const encId = progetto.encimera && progetto.encimera.materiale;
  const encDef = encId ? MATERIALI.find((m) => m.id === encId) : null;
  const matTop = encId ? getMaterialeTHREE(encId, reRender) : null;
  const spTop = (encDef && encDef.spessore != null) ? encDef.spessore : SP_TOP;

  // Moduli agganciati ai muri + fasce
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;
    for (const mm of moduliDiParete(progetto, p.id)) {
      const centro = mm.posizione_mm + mm.larghezza_mm / 2;
      const px = a.x + ux * centro + nx * (PROFONDITA_BASE / 2);
      const py = a.y + uy * centro + ny * (PROFONDITA_BASE / 2);
      const porta = 700;               // porta/anta
      const zocc = zoccoloPerAltezza(porta);
      basiTop.push({ x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE, zocc, topY: zocc + porta });
      zoccoli.push({ x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE, zocc });
      if (mm.categoria === 'fascia') {
        const box = corpo(mm.larghezza_mm, porta, PROFONDITA_BASE, COL.regletta);
        gruppo.add(collocaMobile(box, px, zocc, -py, porta, p.angolo_gradi));
        continue;
      }
      const g = costruisciMobile('base', mm.tipo, { ...mm, altezza_mm: porta }, mm.larghezza_mm, porta, PROFONDITA_BASE, matBase);
      gruppo.add(collocaMobile(g, px, zocc, -py, porta, p.angolo_gradi));
      if (mm.tipo === 'forno' || mm.tipo === 'lavello') {
        accessori.push({ id: mm.id, x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE,
          surfaceY: zocc + porta + spTop, placca: mm.tipo === 'forno', lavello: mm.tipo === 'lavello',
          fuochi: fuochiPerLarghezza(mm.larghezza_mm) });
      }
    }
  });

  // Quota alta = cima delle colonne (cassa + zoccolo). Pensili e costadi alti
  // si allineano a questa quota; se non ci sono colonne, uso un valore di
  // riferimento (2350).
  const topLine = quotaAltaColonne(progetto);
  const QUOTA_RIF = topLine != null ? topLine : 2350;

  // Mobili liberi
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    const dim = dimMobile(m);
    const cx = m.x, cz = -m.y;
    let g3d = null;
    if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      // Se ci sono colonne, la CIMA del pensile va alla cima delle colonne;
      // altrimenti resta appeso all'altezza standard (140 cm da terra).
      const base = topLine != null ? (topLine - h) : MONTAGGIO_PENSILE;
      const sporg = antaPensileSporge(progetto.antaPensile, h);
      const gPens = costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matPensile, { sporg });
      // LED sotto i pensili (opzionale, con scelta temperatura colore).
      // Il pensile-angolo (diagonale) non lo prende: ha una geometria dedicata.
      if (progetto.led && progetto.led.attivo && m.tipo !== 'pensile-angolo') {
        aggiungiLedPensile(gPens, dim.w, h, dim.d, progetto.led.colore);
      }
      g3d = collocaMobile(gPens, cx, base, cz, h, m.rot);
    } else if (cat === 'colonna') {
      // L'altezza della colonna (es. 2200) è la CASSA; il totale è cassa +
      // zoccolo. Così un costado da 2350 (= 2200 + 15 di piedini) combacia.
      const h = m.altezza_mm || 2200;
      const zocc = zoccoloPerAltezza(m.altezzaBassa_mm || 700);
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h: h + zocc, cat: 'colonna' });
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matColonna), cx, zocc, cz, h, m.rot);
    } else if (cat === 'regletta') {
      const h = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(h);
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d), cx, zocc, cz, h, m.rot);
    } else if (cat === 'pannello') {
      // Pannello su misura: box 18 mm di spessore, finitura come le ante.
      // Va da terra fino all'altezza scelta, niente zoccolo e niente top.
      const h = m.altezza_mm || 2200;
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matBase || COL.anta), cx, 0, cz, h, m.rot);
    } else if (cat === 'costado') {
      const h = m.altezza_mm || 850;
      const base = h >= 1500 ? Math.max(0, QUOTA_RIF - h) : 0;
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h, cat: 'costado' });
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matCostado || COL.costado), cx, base, cz, h, m.rot);
    } else {
      // base / lavello / forno: porta = altezza scelta, zoccolo 150/100.
      // Il piano di lavoro NON si disegna qui: è un pezzo unico continuo (dopo).
      const porta = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(porta);
      const cieco = infoAngoloCieco(progetto, m);
      let ciecoOpt = cieco;
      if (cieco && cieco.coperto) {
        const rd = progetto.reglettaAngolo || { base: 30, spessore: SPESSORE_ANTA };
        const spess = (rd.spessore != null) ? rd.spessore : SPESSORE_ANTA;
        // Sul mobile a fronte orizzontale va il braccio lungo (base+spessore),
        // sul mobile a fronte verticale va il braccio corto (base).
        const legOnMe = cieco.horizMe ? (rd.base + spess) : rd.base;
        ciecoOpt = { ...cieco, blindExtra: legOnMe + FUGA_W };
      }
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, porta, dim.d, matBase, { cieco: ciecoOpt }), cx, zocc, cz, porta, m.rot);
      if (cieco) renderRegolettaAngolo(cieco, m, porta, zocc, matBase, progetto.reglettaAngolo);
      basiTop.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc, topY: zocc + porta });
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      // Placca / lavello (tipi forno/lavello oppure aggiunti a mano): sopra il top
      const hasPlacca = m.tipo === 'forno' || m.placca;
      const hasLavello = m.tipo === 'lavello' || m.lavello;
      if (hasPlacca || hasLavello) {
        accessori.push({ id: m.id, x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d,
          surfaceY: zocc + porta + spTop, placca: hasPlacca, lavello: hasLavello,
          fuochi: fuochiPerLarghezza(dim.w) });
      }
    }
    if (g3d) { g3d.userData.mobId = m.id; if (m.id === selId) evidenzia(g3d); gruppo.add(g3d); }
  }

  // Zoccolo continuo (un unico pezzo per fila: basi + colonne insieme) +
  // piano di lavoro continuo che non entra nei costadi/colonne
  renderZoccoliContinui(zoccoli, materialeZoccolo(progetto.zoccoloColore));
  renderTopContinui(basiTop, fianchi, spTop, matTop);
  // Lavello, piano cottura e rubinetto SOPRA il top
  for (const a of accessori) aggiungiAccessorioTop(a);

  if (reframe) inquadra(bb);
  if (renderer) renderer.render(scene, camera);
}

/**
 * Disegna un piano di lavoro CONTINUO: raggruppa le basi che stanno sulla
 * stessa fila (stesso orientamento, stessa linea e stessa quota) e ne copre
 * l'intera lunghezza con un unico pezzo, invece di un pezzo per modulo.
 */
/** Normalizza una rotazione a 0/90/180/270. */
function rotNorm(r) { return ((Math.round((r || 0) / 90) * 90) % 360 + 360) % 360; }

/**
 * Divide gli elementi di una fila (stessa linea/quota) in tratti CONTIGUI:
 * dove c'è un vuoto (es. una colonna in mezzo) si spezza, così top e zoccolo
 * non attraversano i buchi. Ritorna [{lo, hi, items}] in coordinate "along".
 */
function tratti(items, c, s) {
  const arr = items.map((b) => {
    const along = b.x * c + b.y * s;
    return { b, lo: along - b.w / 2, hi: along + b.w / 2 };
  }).sort((p, q) => p.lo - q.lo);
  const runs = [];
  let cur = null;
  for (const it of arr) {
    if (!cur || it.lo > cur.hi + 60) { cur = { lo: it.lo, hi: it.hi, items: [it.b] }; runs.push(cur); }
    else { cur.hi = Math.max(cur.hi, it.hi); cur.items.push(it.b); }
  }
  return runs;
}

/** Proiezione di un fianco (costado/colonna) sull'asse della fila: [near, far]. */
function proiettaFianco(f, c, s) {
  const along = f.x * c + f.y * s;
  const perp = f.x * (-s) + f.y * c;
  const fc = Math.cos((f.rot || 0) * Math.PI / 180), fs = Math.sin((f.rot || 0) * Math.PI / 180);
  const hU = (f.w / 2) * Math.abs(c * fc + s * fs) + (f.d / 2) * Math.abs(-c * fs + s * fc);
  return { along, perp, near: along - hU, far: along + hU };
}

/**
 * Piano di lavoro CONTINUO che rispetta i costadi e le colonne:
 * - alle estremità libere ha una piccola sporgenza;
 * - se c'è una COLONNA (o un costado a tutta altezza) il top si ferma lì
 *   (parte dalla colonna, non le entra sopra);
 * - se c'è un COSTADO basso il top arriva fino alla sua faccia ESTERNA
 *   (il modulo si appoggia al costado, il top lo copre).
 */
// Cache: dato il materiale "nudo" dell'encimera, ritorna un nuovo materiale
// con la texture ruotata di 90 gradi. Serve per il TOP della cucina, dove
// la venatura del legno (o la direzione della lastra) deve andare lungo la
// LUNGHEZZA del top, non lungo la profondita'. Le immagini-texture sono
// generate con la fibra verticale: senza rotazione risulterebbero
// trasversali al top.
// Nota: NON cloniamo il materiale originale (mat.clone() di Three.js puo'
// perdere setting specifici). Ricostruiamo un materiale standard da zero
// copiando solo map / color / roughness / metalness. E' sufficiente qui.
const _matTopCache = new WeakMap();
const _texTopCache = new WeakMap();
function materialePerTop(mat) {
  if (!mat || !mat.map) return mat;
  let tex = _texTopCache.get(mat.map);
  if (!tex) {
    tex = mat.map.clone();
    tex.colorSpace = mat.map.colorSpace || THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = mat.map.anisotropy || 4;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.needsUpdate = true;
    _texTopCache.set(mat.map, tex);
  }
  const hit = _matTopCache.get(mat);
  if (hit) { hit.map = tex; hit.needsUpdate = true; return hit; }
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    // Marmo/pietra compatto: superficie meno lucida, meno riflessi ambiente,
    // cosi' il bianco del marmo non "brucia" le venature nel rendering 3D.
    roughness: 0.75,
    metalness: 0.0,
    envMapIntensity: 0.45,
  });
  _matTopCache.set(mat, m);
  return m;
}

function renderTopContinui(basi, fianchi = [], thickness = SP_TOP, mat = null) {
  const matTop = materialePerTop(mat);
  const gruppi = {};
  for (const b of basi) {
    const rotN = rotNorm(b.rot);
    const rad = rotN * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const perp = Math.round((b.x * (-s) + b.y * c) / 5) * 5;
    const key = `${rotN}|${perp}|${Math.round(b.topY)}`;
    (gruppi[key] ||= { rotN, c, s, topY: b.topY, d: b.d || PROFONDITA_BASE, items: [] }).items.push(b);
  }
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, topY } = G;
    for (const run of tratti(G.items, c, s)) {
      let lo = run.lo, hi = run.hi;
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      let endLo = lo - 20, endHi = hi + 20;   // estremità libere: piccola sporgenza
      for (const f of fianchi) {
        const pf = proiettaFianco(f, c, s);
        if (Math.abs(pf.perp - perp) > 350) continue;   // non sulla stessa linea
        const tall = (f.h || 0) >= 1500;
        if (pf.along >= hi - 1 && pf.near <= hi + 90) {          // estremità destra
          endHi = (f.cat === 'costado' && !tall) ? pf.far : hi;
        }
        if (pf.along <= lo + 1 && pf.far >= lo - 90) {           // estremità sinistra
          endLo = (f.cat === 'costado' && !tall) ? pf.near : lo;
        }
      }
      const len = endHi - endLo;
      const centerAlong = (endLo + endHi) / 2;
      const cx = c * centerAlong + (-s) * perp;
      const cy = s * centerAlong + c * perp;
      const slab = corpo(len, thickness, G.d + 40, matTop || COL.top);
      gruppo.add(collocaMobile(slab, cx, topY, -cy, thickness, rotN));
    }
  }
}

/**
 * Zoccolo (piedini) CONTINUO: un unico pezzo per fila di basi, da un bordo
 * all'altro (quindi da costado a costado, coprendo tutti i moduli).
 */
function renderZoccoliContinui(basi, mat) {
  const gruppi = {};
  for (const b of basi) {
    const rotN = rotNorm(b.rot);
    const rad = rotN * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const perp = Math.round((b.x * (-s) + b.y * c) / 5) * 5;
    const key = `${rotN}|${perp}|${Math.round(b.zocc || 150)}`;
    (gruppi[key] ||= { rotN, c, s, zocc: b.zocc || 150, d: b.d || PROFONDITA_BASE, items: [] }).items.push(b);
  }
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, zocc } = G;
    for (const run of tratti(G.items, c, s)) {
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      const len = run.hi - run.lo;
      const centerAlong = (run.lo + run.hi) / 2;
      const cx = c * centerAlong + (-s) * perp;
      const cy = s * centerAlong + c * perp;
      const geo = new THREE.BoxGeometry(len, zocc, G.d - 100);
      const mesh = new THREE.Mesh(geo, mat ? mat.clone() : new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 0.96, metalness: 0 }));
      mesh.position.z = -50;                 // arretrato rispetto al fronte
      const g = new THREE.Group(); g.add(mesh);
      gruppo.add(collocaMobile(g, cx, 0, -cy, zocc, rotN));
    }
  }
}

/** Materiale dello zoccolo in base al colore scelto (default: nero opaco). */
function materialeZoccolo(id) {
  switch (id) {
    case 'bianco-opaco':
      return new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 1.0, metalness: 0.0 });
    case 'acciaio':
      return new THREE.MeshStandardMaterial({ color: 0xc6cace, roughness: 0.42, metalness: 0.72 });
    case 'nero-opaco':
    default:
      return new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 1.0, metalness: 0.0 });
  }
}
export const COLORI_ZOCCOLO = [
  { id: 'nero-opaco', nome: 'Nero opaco', css: '#17171a' },
  { id: 'bianco-opaco', nome: 'Bianco opaco', css: '#eceae4' },
  { id: 'acciaio', nome: 'Acciaio', css: 'linear-gradient(135deg,#d6dadf,#9aa0a6 55%,#c2c7cc)' },
];

function bbox(progetto, vertici) {
  const xs = [], ys = [];
  (progetto.piano.pareti || []).forEach((p, i) => {
    if (p.assente) return;
    xs.push(vertici[i].x, vertici[i + 1].x);
    ys.push(vertici[i].y, vertici[i + 1].y);
  });
  for (const m of (progetto.mobiliLiberi || [])) { xs.push(m.x); ys.push(m.y); }
  if (xs.length === 0) return { minX: 0, maxX: 3000, minY: 0, maxY: 2000 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function inquadra(bb) {
  const cx = (bb.minX + bb.maxX) / 2, cz = -(bb.minY + bb.maxY) / 2;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) + 2000;
  controls.target.set(cx, 800, cz);
  camera.position.set(cx + diag * 0.7, diag * 0.75 + 1500, cz + diag * 0.9);
  camera.updateProjectionMatrix();
  controls.update();
}

export function smontaScena3d() {
  animazioneAttiva = false;
  window.removeEventListener('resize', forzaResize3d);
}
