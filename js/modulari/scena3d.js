// =============================================================================
// MOBILI MODULARI — Rendering 3D
// =============================================================================
// Ogni pezzo è il suo PROFILO in vista frontale (piano XY) estruso in
// profondità (asse Z): così top inclinato, fianchi col bordo inclinato,
// schiena e ante a trapezio sono esatti come nella distinta.
// Assi: x = larghezza (mm), y = altezza, z = profondità (muro di fondo a z=0,
// fronte delle ante a z = P). Stesso assemblaggio degli armadi.
// =============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getMaterialeTHREE, impostaUnitaUV, taraLuceCatalogo, uvInScala } from '../materiali.js?v=20261114p';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js?v=20261111b';

// Venatura: una ripetizione ogni 70 cm in larghezza e 2 m in altezza, a specchio
// (MirroredRepeat) → niente "scacchiera" di giunte sulle ante grandi.
const TEX_U = 700, TEX_V = 2000;
impostaUnitaUV(TEX_U, TEX_V);        // foto del catalogo in scala vera
const SP_MURO = 120;                // spessore muri del vano (solo scena)

let scene, camera, renderer, controls, gruppo, canvasEl;
let attiva = false;
let ultimaVista = null;             // { W, H, P } per le inquadrature
// Ante apribili (come negli armadi): ogni anta sta in un "cardine" che ruota
// attorno all'asse verticale del lato cerniera. Apertura animata.
const ANGOLO_APERTA = (100 * Math.PI) / 180;
let anteAperte = false;
let cardini = [];                   // [{ g, verso }] verso = +1/-1

const matMuro = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.95 });
const matMuroFondo = new THREE.MeshStandardMaterial({ color: 0xdedad1, roughness: 0.95 });
const matGradino = new THREE.MeshStandardMaterial({ color: 0xcbb89a, roughness: 0.8 });
const matMetallo = new THREE.MeshStandardMaterial({ color: 0xc9cbcf, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.8 });

function creaAmbiente(rnd) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, '#ffffff'); grd.addColorStop(0.34, '#e4ded2');
  grd.addColorStop(0.5, '#8f897d'); grd.addColorStop(0.7, '#4a4740'); grd.addColorStop(1.0, '#191814');
  x.fillStyle = grd; x.fillRect(0, 0, 32, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(rnd);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

export function monta(canvas) {
  if (renderer) return;
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(40, w / h, 10, 60000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.environment = creaAmbiente(renderer);

  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x4a4a52, 1.2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.7);
  key.position.set(2500, 4500, 5000);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5000, right: 5000, top: 5000, bottom: -5000, near: 100, far: 20000 });
  scene.add(key); scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.6);
  fill.position.set(-3000, 2000, 3000);
  scene.add(fill);
  taraLuceCatalogo(renderer, scene, [[0, 0, 1]]); // ante di fronte · prodotti del catalogo: colori identici alla foto

  const pav = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000),
    new THREE.MeshStandardMaterial({ color: 0xd2cbbf, roughness: 0.95 }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = -1; pav.receiveShadow = true;
  scene.add(pav);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;

  gruppo = new THREE.Group();
  scene.add(gruppo);
  window.addEventListener('resize', ridimensiona);
  ciclo();
}

function ciclo() {
  requestAnimationFrame(ciclo);
  if (!attiva || !renderer) return;
  for (const c of cardini) {
    const target = anteAperte ? c.verso * ANGOLO_APERTA : 0;
    const d = target - c.g.rotation.y;
    if (Math.abs(d) > 0.001) c.g.rotation.y += d * 0.16; else c.g.rotation.y = target;
  }
  controls.update();
  renderer.render(scene, camera);
}
export function attivaRendering(si) { attiva = si; if (si) ridimensiona(); }

function ridimensiona() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Pezzi: profilo XY estruso lungo Z
// ---------------------------------------------------------------------------
export function impostaAnte(aperte) { anteAperte = !!aperte; }
export function anteSonoAperte() { return anteAperte; }

function prisma(punti, z0, profondita, mat, ombra = true, padre = gruppo) {
  const s = new THREE.Shape();
  punti.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: profondita, bevelEnabled: false });
  // UV in mm → una ripetizione della texture ogni TEX_MM (non 1 per mm)
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TEX_U, uv.getY(i) / TEX_V);
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mat);
  m.position.z = z0;
  m.castShadow = ombra; m.receiveShadow = true;
  padre.add(m);
  return m;
}
const rett = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * Un mobile: base a y0, da x0 a x0+L, altezze esterne hL (sx) e hR (dx).
 * e = { x0, y0, L, hL, hR, ante, lato, ripiani }
 */
function mobile(e, P, sp, matS, matA) {
  const { x0, y0, L, hL, hR } = e;
  const x1 = x0 + L;
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS;
  const zC = sS;                                    // inizio carcassa
  const alfa = Math.atan2(Math.abs(hR - hL), L);
  const tv = sC / Math.cos(alfa);                   // spessore verticale del top
  const yt = (x) => y0 + hL + ((hR - hL) * (x - x0)) / L;  // sopra del top
  const yu = (x) => yt(x) - tv;                             // sotto del top
  // Fondo, top (passanti), fianchi in mezzo (bordo alto secondo il top)
  prisma(rett(x0, y0, x1, y0 + sC), zC, Pc, matS);
  prisma([[x0, yu(x0)], [x1, yu(x1)], [x1, yt(x1)], [x0, yt(x0)]], zC, Pc, matS);
  prisma([[x0, y0 + sC], [x0 + sC, y0 + sC], [x0 + sC, yu(x0 + sC)], [x0, yu(x0)]], zC, Pc, matS);
  prisma([[x1 - sC, y0 + sC], [x1, y0 + sC], [x1, yu(x1)], [x1 - sC, yu(x1 - sC)]], zC, Pc, matS);
  // Schiena (trapezio se inclinato)
  prisma([[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x1 - 1, yt(x1) - 1], [x0 + 1, yt(x0) - 1]], 0, sS, matS);
  // Ripiani: sotto il lato basso, così sono interi
  const hBasso = Math.min(hL, hR) - tv;
  const n = e.ripiani || 0;
  for (let k = 1; k <= n; k++) {
    const yk = y0 + sC + (k * (hBasso - 2 * sC)) / (n + 1);
    prisma(rett(x0 + sC, yk - sC / 2, x1 - sC, yk + sC / 2), zC, Pc - 10, matS);
  }
  // Ante (trapezi), 2 mm di fuga come in distinta, + maniglia
  const N = Math.max(0, Math.round(e.ante || 0));
  if (N > 0) {
    const la = (L - (N + 1) * 2) / N;
    for (let i = 0; i < N; i++) {
      const xa = x0 + 2 + i * (la + 2), xb = xa + la;
      // maniglia a sinistra (sx) → cerniera a destra, e viceversa
      const sx = N === 1 ? e.lato === 'sx' : i === 1;
      const xh = sx ? xb : xa;                       // asse del cardine
      const zh = zC + Pc;                            // retro dell'anta
      const g = new THREE.Group();
      g.position.set(xh, 0, zh);
      gruppo.add(g);
      cardini.push({ g, verso: sx ? 1 : -1 });
      const rel = (pts) => pts.map(([x, y]) => [x - xh, y]);
      prisma(rel([[xa, y0 + 2], [xb, y0 + 2], [xb, yt(xb) - 2], [xa, yt(xa) - 2]]), 0, sA, matA, true, g);
      const xm = sx ? xa + 40 : xb - 52;
      const hDoor = Math.min(yt(xa), yt(xb)) - y0;
      const lm = Math.min(220, hDoor * 0.35);
      const ym = y0 + Math.min(hDoor * 0.55, 1000);
      prisma(rel(rett(xm, ym - lm / 2, xm + 12, ym + lm / 2)), sA, 18, matMetallo, true, g);
      g.rotation.y = anteAperte ? (sx ? 1 : -1) * ANGOLO_APERTA : 0;
    }
  }
}

/**
 * Modulo di chiusura in fondo (punta bassa del sottoscala).
 * ch = risultato di geometriaChiusura (calcoli.js)
 */
function chiusura(ch, P, sp, matS, matA) {
  if (ch.fronte === 'fisso') {
    // pannello fisso a filo delle ante (non si apre)
    prisma(ch.pannello.profilo, P - sp.ante, sp.ante, matA);
    return;
  }
  const ante = ch.fronte === 'anta' ? 1 : 0;
  if (!ch.triangolare) {
    mobile({ x0: ch.x0, y0: 0, L: ch.larghezza, hL: ch.hL, hR: ch.hR, ante, lato: ch.daSinistra ? 'dx' : 'sx', ripiani: 0 }, P, sp, matS, matA);
    return;
  }
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS, zC = sS;
  const f = ch.profili;
  prisma(f.fondo, zC, Pc, matS);
  prisma(f.top, zC, Pc, matS);
  prisma(f.fianco, zC, Pc, matS);
  prisma(f.schiena, 0, sS, matS);
  if (ante) {
    // cerniere sul lato alto; si apre a pressione (niente maniglia)
    const xh = f.anta[0][0];
    const g = new THREE.Group();
    g.position.set(xh, 0, zC + Pc);
    gruppo.add(g);
    const verso = -ch.dir;
    cardini.push({ g, verso });
    prisma(f.anta.map(([x, y]) => [x - xh, y]), 0, sA, matA, true, g);
    g.rotation.y = anteAperte ? verso * ANGOLO_APERTA : 0;
  }
}

// ---------------------------------------------------------------------------
// Vano: muro di fondo, muri/soffitto intorno, gradini sopra la scala
// ---------------------------------------------------------------------------
function vano(forma, P, conGradini) {
  const pts = forma.punti, n = pts.length;
  prisma(pts.map((p) => [p.x, p.y]), -SP_MURO, SP_MURO, matMuroFondo, false);
  forma.pareti.forEach((par, i) => {
    if (par.tipo === 'pavimento') return;
    const a = pts[i], b = pts[(i + 1) % n];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (b.y - a.y) / L, ny = -(b.x - a.x) / L;     // normale esterna
    const T = SP_MURO;
    prisma([[a.x, a.y], [b.x, b.y], [b.x + nx * T, b.y + ny * T], [a.x + nx * T, a.y + ny * T]], -SP_MURO, P + SP_MURO + 60, matMuro);
    // Scala sopra l'inclinata (solo sottoscala): la soletta inclinata è il
    // muro qui sopra; i gradini sono TRIANGOLI appoggiati sopra la soletta
    // (alzata verticale + pedata orizzontale), quindi non entrano nel vano.
    if (conGradini && par.tipo === 'inclinata') {
      const lo = a.y < b.y ? a : b, hi = a.y < b.y ? b : a;
      const run = Math.abs(hi.x - lo.x), rise = hi.y - lo.y;
      const passi = Math.max(3, Math.round(run / 280));
      const D = T / Math.cos(Math.atan2(rise, run));          // spessore verticale soletta
      const dir = Math.sign(hi.x - lo.x) || 1;
      const sopra = (x) => lo.y + (rise * Math.abs(x - lo.x)) / run + D;   // sopra della soletta
      for (let k = 0; k < passi; k++) {
        const xa = lo.x + (dir * run * k) / passi, xb = lo.x + (dir * run * (k + 1)) / passi;
        const yp = sopra(xb);                                      // quota della pedata
        // stessa profondità della soletta: niente gradini che sporgono davanti alle ante
        prisma([[xa, sopra(xa)], [xb, yp], [xa, yp]], -SP_MURO, P + SP_MURO + 60, matGradino);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Aggiornamento scena
// ---------------------------------------------------------------------------
/**
 * forma: risultato di calcolaForma; elementi: [{x0,y0,L,hL,hR,ante,lato,ripiani}]
 * opz: { P, spessori, materiali:{struttura, ante}, conGradini, chiusura, reinquadra }
 */
export function aggiorna(forma, elementi, opz) {
  if (!gruppo) return;
  while (gruppo.children.length) {
    const c = gruppo.children.pop();
    c.traverse((o) => o.geometry?.dispose());
  }
  cardini = [];
  const ridisegna = () => { if (renderer && attiva) renderer.render(scene, camera); };
  // Texture a specchio (vale per questa pagina: la cache materiali è sua)
  const specchia = (m) => { if (m && m.map && m.map.wrapS !== THREE.MirroredRepeatWrapping) {
    m.map.wrapS = m.map.wrapT = THREE.MirroredRepeatWrapping; m.map.needsUpdate = true; } };
  // Materiali per id (ogni modulo può avere la sua finitura: e.mat = {struttura, ante})
  const usati = new Map();
  const mat = (id) => {
    if (!usati.has(id)) {
      let m = null;
      m = getMaterialeTHREE(id, () => { specchia(m); ridisegna(); });
      specchia(m); usati.set(id, m);
    }
    return usati.get(id);
  };
  const fin = (e) => e.mat || opz.materiali;
  vano(forma, opz.P, opz.conGradini);
  for (const e of elementi) mobile(e, opz.P, opz.spessori, mat(fin(e).struttura), mat(fin(e).ante));
  if (opz.chiusura) {
    const f = fin(opz.chiusura);
    chiusura(opz.chiusura, opz.P, opz.spessori, mat(f.struttura), mat(f.ante));
  }
  uvInScala(gruppo);                 // foto del catalogo: centrata su ogni pannello, misura vera
  const nuova = { W: forma.larghezza, H: forma.altezzaMax, P: opz.P };
  const cambiata = !ultimaVista || ['W', 'H', 'P'].some((k) => Math.abs(ultimaVista[k] - nuova[k]) > 1);
  ultimaVista = nuova;
  if (opz.reinquadra || cambiata) inquadra('tre4');
}

/** Inquadrature: 'frontale' (dritta davanti) o 'tre4' (di tre quarti, dall'alto). */
export function inquadra(tipo = 'tre4') {
  if (!camera || !ultimaVista) return;
  const { W, H, P } = ultimaVista;
  const S = Math.max(W, H);
  const target = new THREE.Vector3(W / 2, H * 0.45, P / 2);
  // Distanza per far stare tutto il vano (+ margine) nello schermo, sia in
  // altezza sia in larghezza: su telefono (schermo stretto) si allontana.
  const vf = (camera.fov * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = Math.max((H * 0.62) / Math.tan(vf / 2), (W * 0.62 + 300) / Math.tan(hf / 2)) + P;
  if (tipo === 'frontale') camera.position.set(W / 2, H * 0.5, P / 2 + dist);
  else {
    const dir = new THREE.Vector3(0.38, 0.22, 1).normalize();
    camera.position.copy(target).addScaledVector(dir, dist * 1.08);
  }
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
  const key = scene.children.find((o) => o.isDirectionalLight && o.castShadow);
  if (key) { key.target.position.copy(target); key.position.set(W / 2 + S, H + S * 1.2, P + S * 1.6); }
}

/** Salva l'immagine (alta risoluzione, con logo). */
export function salvaImmagine(nome = 'mobili-modulari.png') {
  if (!renderer) return false;
  const c = renderer.domElement;
  const cw = c.clientWidth || c.width, ch = c.clientHeight || c.height;
  const pr0 = renderer.getPixelRatio();
  const scala = Math.max(1, latoMaxExport() / Math.max(cw, ch));
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(cw * scala), Math.round(ch * scala), false);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  let out = null;
  try { out = componiConLogo(c); } catch { out = null; }
  renderer.setPixelRatio(pr0);
  renderer.setSize(cw, ch, false);
  renderer.render(scene, camera);
  return out ? salvaImmagineCanvas(out, nome) : false;
}
