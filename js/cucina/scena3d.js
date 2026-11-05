// =============================================================================
// VISTA 3D — Progettazione cucina (Step 3)
// =============================================================================
// Disegna in 3D i mobili posati in pianta, con le loro altezze reali.
// Unità in MILLIMETRI (coerenti con la pianta).
// Assi: X = pianta x · Y = altezza (0 = pavimento) · Z = −(pianta y).
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  calcolaVertici, dimMobile, categoriaTipo, nomeTipo,
  moduliDiParete, PROFONDITA_BASE,
} from './modello.js';

// Altezza da terra a cui è appeso il BASSO dei pensili (mm). Modificabile.
export const MONTAGGIO_PENSILE = 1400;
const ALT_ZOCCOLO = 100;   // zoccolo sotto le basi (mm)
const SP_TOP = 40;         // spessore piano di lavoro (mm)
const ALT_MURO = 2600;     // altezza muri di riferimento (mm)

let scene, camera, renderer, controls, gruppo, canvasEl;
let animazioneAttiva = false;

const COLORI = {
  base:    0x6a5b33,
  pensile: 0x7d6a3a,
  colonna: 0x5a4d2c,
  regletta:0xc9a94a,
  top:     0x2a2a2a,
  muro:    0x3a362c,
  pavimento: 0x121212,
};

export function montaScena3d(canvas, progetto) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(50, w / h, 10, 60000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);

  // Luci: ambiente caldo + direzionale principale
  scene.add(new THREE.HemisphereLight(0xffffff, 0x20200f, 0.75));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.0);
  key.position.set(3000, 6000, 4000);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.35);
  fill.position.set(-4000, 3000, -2000);
  scene.add(fill);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05; // non andare sotto il pavimento

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

/** Crea una scatola con gli spigoli dorati. */
function scatola(w, h, d, colore) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: colore, roughness: 0.7, metalness: 0.05 });
  g.add(new THREE.Mesh(geo, mat));
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xc9a94a })
  );
  g.add(edges);
  return g;
}

/** Posiziona un gruppo con centro (cx,cy,cz) e rotazione attorno a Y. */
function collocaBox(obj, cx, cyBottom, cz, h, rotGradi) {
  obj.position.set(cx, cyBottom + h / 2, cz);
  obj.rotation.y = -(rotGradi || 0) * Math.PI / 180;
  return obj;
}

export function aggiornaScena3d(progetto, reframe = false) {
  if (!scene) return;
  // Svuota il gruppo
  while (gruppo.children.length) gruppo.remove(gruppo.children[0]);

  const pareti = (progetto.piano.pareti || []).filter((p) => !p.assente);
  const vertici = calcolaVertici(progetto.piano.pareti);
  const full = progetto.piano.pareti || [];

  // --- Pavimento + griglia su bounding box ---
  const bb = bbox(progetto, vertici);
  const padW = (bb.maxX - bb.minX) + 2000;
  const padD = (bb.maxY - bb.minY) + 2000;
  const cxFloor = (bb.minX + bb.maxX) / 2;
  const czFloor = -(bb.minY + bb.maxY) / 2;
  const pav = new THREE.Mesh(
    new THREE.PlaneGeometry(padW, padD),
    new THREE.MeshStandardMaterial({ color: COLORI.pavimento, roughness: 0.95 })
  );
  pav.rotation.x = -Math.PI / 2;
  pav.position.set(cxFloor, 0, czFloor);
  gruppo.add(pav);
  const grid = new THREE.GridHelper(Math.max(padW, padD), Math.round(Math.max(padW, padD) / 500), 0x2a2416, 0x1a1810);
  grid.position.set(cxFloor, 1, czFloor);
  gruppo.add(grid);

  // --- Muri di riferimento (sottili, semi-trasparenti) ---
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const muro = new THREE.Mesh(
      new THREE.BoxGeometry(L, ALT_MURO, 60),
      new THREE.MeshStandardMaterial({ color: COLORI.muro, roughness: 0.9, transparent: true, opacity: 0.35 })
    );
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    muro.position.set(mx, ALT_MURO / 2, -my);
    muro.rotation.y = -Math.atan2(dy, dx);
    gruppo.add(muro);
  });

  // --- Moduli agganciati ai muri (sistema "parete attiva") + fasce ---
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;  // verso interno
    for (const m of moduliDiParete(progetto, p.id)) {
      const centro = m.posizione_mm + m.larghezza_mm / 2;
      const px = a.x + ux * centro + nx * (PROFONDITA_BASE / 2);
      const py = a.y + uy * centro + ny * (PROFONDITA_BASE / 2);
      const h = 700;
      const colore = m.categoria === 'fascia' ? COLORI.regletta : COLORI.base;
      const box = scatola(m.larghezza_mm, h - ALT_ZOCCOLO, PROFONDITA_BASE, colore);
      gruppo.add(collocaBox(box, px, ALT_ZOCCOLO, -py, h - ALT_ZOCCOLO, p.angolo_gradi));
      if (m.categoria !== 'fascia') {
        gruppo.add(collocaBox(
          scatola(m.larghezza_mm + 20, SP_TOP, PROFONDITA_BASE + 40, COLORI.top),
          px, h, -py, SP_TOP, p.angolo_gradi));
      }
    }
  });

  // --- Mobili liberi ---
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    const dim = dimMobile(m);
    const cx = m.x, cz = -m.y;

    if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      gruppo.add(collocaBox(scatola(dim.w, h, dim.d, COLORI.pensile), cx, MONTAGGIO_PENSILE, cz, h, m.rot));
    } else if (cat === 'colonna') {
      const h = m.altezza_mm || 2200;
      gruppo.add(collocaBox(scatola(dim.w, h, dim.d, COLORI.colonna), cx, 0, cz, h, m.rot));
    } else if (cat === 'regletta') {
      const h = m.altezza_mm || 700;
      gruppo.add(collocaBox(scatola(dim.w, h, dim.d, COLORI.regletta), cx, 0, cz, h, m.rot));
    } else {
      // base: zoccolo + corpo + piano di lavoro
      const hTot = m.altezza_mm || 700;
      const hCorpo = hTot - ALT_ZOCCOLO;
      gruppo.add(collocaBox(scatola(dim.w, hCorpo, dim.d, COLORI.base), cx, ALT_ZOCCOLO, cz, hCorpo, m.rot));
      // piano di lavoro (leggermente più profondo e largo)
      gruppo.add(collocaBox(scatola(dim.w + 20, SP_TOP, dim.d + 40, COLORI.top), cx, hTot, cz, SP_TOP, m.rot));
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
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

function inquadra(bb) {
  const cx = (bb.minX + bb.maxX) / 2;
  const cz = -(bb.minY + bb.maxY) / 2;
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
