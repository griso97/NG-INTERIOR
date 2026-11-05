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
  moduliDiParete, PROFONDITA_BASE,
} from './modello.js';

export const MONTAGGIO_PENSILE = 1400;   // altezza da terra del basso dei pensili
const SP_TOP = 40;
// Zoccolo (piedini) in base all'altezza della porta:
//  porta 70 → zoccolo 150 mm · porta 80 → zoccolo 100 mm
function zoccoloPerAltezza(h) { return h >= 800 ? 100 : 150; }
const ALT_MURO = 2600;
const H_FORNO = 600;
const H_MICRO = 380;

let scene, camera, renderer, controls, gruppo, canvasEl;
let animazioneAttiva = false;
const texCache = {};

const COL = {
  corpo:   0x4a4026,
  anta:    0x6f5e36,
  cassetto:0x6a5a34,
  pensile: 0x7d6a3a,
  colonna: 0x5a4d2c,
  regletta:0xc9a94a,
  top:     0x232323,
  muro:    0x3a362c,
  pav:     0x121212,
  oro:     0xc9a94a,
};
const matOro = new THREE.LineBasicMaterial({ color: COL.oro });
const matManiglia = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.35, metalness: 0.6 });

// ---------------------------------------------------------------------------
export function montaScena3d(canvas, progetto) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(50, w / h, 10, 60000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x20200f, 0.8));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.0);
  key.position.set(3000, 6000, 4000); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.35);
  fill.position.set(-4000, 3000, -2000); scene.add(fill);

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

// ---------------------------------------------------------------------------
// Primitive
function corpo(w, h, d, colore) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colore, roughness: 0.7, metalness: 0.05 })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro));
  return g;
}

/** Pannello (anta/cassetto) sporgente sul fronte locale (+Z). */
function pannello(g, px, py, z, pw, ph, colore) {
  const geo = new THREE.BoxGeometry(pw, ph, 20);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colore, roughness: 0.6, metalness: 0.08 }));
  mesh.position.set(px, py, z + 10);
  g.add(mesh);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
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
function ante(g, w, h, d, n) {
  const mg = 14, gap = 16, z = d / 2;
  const uw = w - 2 * mg, ph = h - 2 * mg;
  const pw = (uw - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const px = -uw / 2 + pw / 2 + i * (pw + gap);
    pannello(g, px, 0, z, pw, ph, COL.anta);
    const hx = n === 1 ? px + pw / 2 - 35 : (i === 0 ? px + pw / 2 - 22 : px - pw / 2 + 22);
    maniglia(g, hx, 0, z, false, Math.min(260, ph * 0.5));
  }
}
function cassetti(g, w, h, d, n) {
  const mg = 14, gap = 14, z = d / 2;
  const uw = w - 2 * mg, uh = h - 2 * mg;
  const ph = (uh - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const py = -uh / 2 + ph / 2 + i * (ph + gap);
    pannello(g, 0, py, z, uw, ph, COL.cassetto);
    maniglia(g, 0, py + ph / 2 - Math.min(28, ph * 0.3), z, true, Math.min(uw * 0.5, 320));
  }
}
function pianoCottura(g, w, h, d) {
  const z = d / 2, yTop = h / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 20, 20, d - 20),
    new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.4, metalness: 0.2 }));
  slab.position.set(0, yTop + 10, 0); g.add(slab);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.14, 8, 8, 24),
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
function colonnaFronte(g, w, h, d, m) {
  const z = d / 2;
  const pw = w - 24;
  const ab = m.altezzaBassa_mm || 700;
  const bottom = -h / 2;
  const porta = (yB, segH) => {
    const cyc = yB + segH / 2;
    pannello(g, 0, cyc, z, pw, segH - 14, COL.anta);
    maniglia(g, pw / 2 - 30, cyc, z, false, Math.min(260, (segH - 14) * 0.4));
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

/** Costruisce il mobile completo centrato nell'origine (corpo + fronti). */
function costruisciMobile(cat, tipo, m, w, h, d) {
  const g = new THREE.Group();
  const coloreCorpo = cat === 'pensile' ? COL.pensile : cat === 'colonna' ? COL.colonna
    : cat === 'regletta' ? COL.regletta : COL.corpo;
  g.add(corpo(w, h, d, coloreCorpo));
  if (cat === 'regletta') return g;
  if (cat === 'colonna') { colonnaFronte(g, w, h, d, m); return g; }
  if (tipo === 'base-cassetti') { cassetti(g, w, h, d, Math.max(1, m.cassetti || 3)); return g; }
  if (tipo === 'lavello') { ante(g, w, h, d, w >= 900 ? 2 : 1); lavelloTop(g, w, h, d); return g; }
  if (tipo === 'forno') { pannelloElettro(g, -h * 0.05, d / 2, w - 24, h * 0.7, 'forno'); pianoCottura(g, w, h, d); return g; }
  // base con ante / pensile
  ante(g, w, h, d, w >= 900 ? 2 : 1);
  return g;
}

function collocaMobile(g, cx, yBottom, cz, h, rotGradi) {
  g.position.set(cx, yBottom + h / 2, cz);
  g.rotation.y = -(rotGradi || 0) * Math.PI / 180;
  return g;
}

/** Zoccolo (piedini): scatola bassa, più scura e un po' arretrata sul fronte. */
function aggiungiZoccolo(cx, cz, w, d, zocc, rotGradi) {
  const geo = new THREE.BoxGeometry(w - 40, zocc, d - 100);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x15130d, roughness: 0.85 }));
  const g = new THREE.Group();
  mesh.position.z = -50; // arretrato rispetto al fronte
  g.add(mesh);
  gruppo.add(collocaMobile(g, cx, 0, cz, zocc, rotGradi));
}

// ---------------------------------------------------------------------------
export function aggiornaScena3d(progetto, reframe = false) {
  if (!scene) return;
  while (gruppo.children.length) gruppo.remove(gruppo.children[0]);
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const bb = bbox(progetto, vertici);

  // Pavimento + griglia
  const padW = (bb.maxX - bb.minX) + 2000, padD = (bb.maxY - bb.minY) + 2000;
  const cxF = (bb.minX + bb.maxX) / 2, czF = -(bb.minY + bb.maxY) / 2;
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD),
    new THREE.MeshStandardMaterial({ color: COL.pav, roughness: 0.95 }));
  pav.rotation.x = -Math.PI / 2; pav.position.set(cxF, 0, czF); gruppo.add(pav);
  const grid = new THREE.GridHelper(Math.max(padW, padD), Math.round(Math.max(padW, padD) / 500), 0x2a2416, 0x1a1810);
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
      aggiungiZoccolo(px, -py, mm.larghezza_mm, PROFONDITA_BASE, zocc, p.angolo_gradi);
      if (mm.categoria === 'fascia') {
        const box = corpo(mm.larghezza_mm, porta, PROFONDITA_BASE, COL.regletta);
        gruppo.add(collocaMobile(box, px, zocc, -py, porta, p.angolo_gradi));
        continue;
      }
      const g = costruisciMobile('base', mm.tipo, { ...mm, altezza_mm: porta }, mm.larghezza_mm, porta, PROFONDITA_BASE);
      gruppo.add(collocaMobile(g, px, zocc, -py, porta, p.angolo_gradi));
      gruppo.add(collocaMobile(corpo(mm.larghezza_mm + 20, SP_TOP, PROFONDITA_BASE + 40, COL.top),
        px, zocc + porta, -py, SP_TOP, p.angolo_gradi));
    }
  });

  // Mobili liberi
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    const dim = dimMobile(m);
    const cx = m.x, cz = -m.y;
    if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      gruppo.add(collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d), cx, MONTAGGIO_PENSILE, cz, h, m.rot));
    } else if (cat === 'colonna') {
      // Zoccolo in base alla porta bassa; la carcassa riempie fino alla cima
      const h = m.altezza_mm || 2200;
      const zocc = zoccoloPerAltezza(m.altezzaBassa_mm || 700);
      const hCar = h - zocc;
      aggiungiZoccolo(cx, cz, dim.w, dim.d, zocc, m.rot);
      gruppo.add(collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, hCar, dim.d), cx, zocc, cz, hCar, m.rot));
    } else if (cat === 'regletta') {
      // La regletta è alta come la porta e poggia sullo zoccolo: stessa quota
      const h = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(h);
      aggiungiZoccolo(cx, cz, dim.w, dim.d, zocc, m.rot);
      gruppo.add(collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d), cx, zocc, cz, h, m.rot));
    } else {
      // base / lavello / forno: porta = altezza scelta, zoccolo 150/100, piano sopra
      const porta = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(porta);
      aggiungiZoccolo(cx, cz, dim.w, dim.d, zocc, m.rot);
      gruppo.add(collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, porta, dim.d), cx, zocc, cz, porta, m.rot));
      gruppo.add(collocaMobile(corpo(dim.w + 20, SP_TOP, dim.d + 40, COL.top), cx, zocc + porta, cz, SP_TOP, m.rot));
    }
  }

  if (reframe) inquadra(bb);
  if (renderer) renderer.render(scene, camera);
}

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
