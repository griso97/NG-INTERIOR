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
import { getMaterialeTHREE, impostaUnitaUV, taraLuceCatalogo, uvInScala } from '../materiali.js?v=20261122t';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js?v=20261122t';
import { creaResa, nearSegueLaVista, inquadraOmbre, ombreSuTutto, pavimentoVero } from '../resa.js?v=20261122t';

// Venatura: una ripetizione ogni 70 cm in larghezza e 2 m in altezza, a specchio
// (MirroredRepeat) → niente "scacchiera" di giunte sulle ante grandi.
const TEX_U = 700, TEX_V = 2000;
const SP_MURO = 120;                // spessore muri del vano (solo scena)

let scene, camera, renderer, controls, gruppo, canvasEl;
let attiva = false;
let ultimaVista = null;             // { W, H, P } per le inquadrature
// Ante apribili (come negli armadi): ogni anta sta in un "cardine" che ruota
// attorno all'asse verticale del lato cerniera. Apertura animata.
const ANGOLO_APERTA = (100 * Math.PI) / 180;
let anteAperte = false;
let cardini = [];                   // [{ g, verso }] verso = +1/-1
// MODULO SCELTO toccandolo nel 3D: ogni modulo è un gruppo con la sua chiave;
// quello scelto ha un contorno oro (i colori restano veri, niente tinta).
let padreMobile = null;             // gruppo del modulo che si sta costruendo
const contorni = new Map();         // chiave → poligono frontale [[x,y]…] del modulo
let selChiave = null, selGrp = null, ultimaP = 600;
const matSel = new THREE.MeshBasicMaterial({ color: 0xd9ad3c });

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
  impostaUnitaUV(TEX_U, TEX_V);        // foto del catalogo in scala vera
  if (renderer) return;
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(40, w / h, 10, 60000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });   // niente preserveDrawingBuffer: più leggero; scheda grafica più potente
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
    pavimentoVero('chiaro', 0xd2cbbf, 30000, 30000, () => { if (resa) resa.cambiato(); }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = -1; pav.receiveShadow = true;
  scene.add(pav);

  controls = new OrbitControls(camera, renderer.domElement);
  nearSegueLaVista(camera, controls);              // profondità precisa: niente triangoli sui fondi
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;

  gruppo = new THREE.Group();
  scene.add(gruppo);
  window.addEventListener('resize', ridimensiona);
  resa = creaResa({ renderer, scene, camera, raggio: 260, intensita: 0.9 });
  ciclo();
}

let pausa3d = false;
let resa = null;
function ciclo() {
  requestAnimationFrame(ciclo);
  if (!attiva || !renderer || pausa3d) return;
  let anteInMoto = false;
  for (const c of cardini) {
    const target = anteAperte ? c.verso * ANGOLO_APERTA : 0;
    const d = target - c.g.rotation.y;
    if (Math.abs(d) > 0.001) { c.g.rotation.y += d * 0.16; anteInMoto = true; } else c.g.rotation.y = target;
  }
  controls.update();
  // disegna solo quando serve; mentre le ante si muovono disegna leggero
  if (resa) resa.tick(anteInMoto); else renderer.render(scene, camera);
}
export function attivaRendering(si) { attiva = si; if (si) ridimensiona(); }

function ridimensiona() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (resa) { resa.dimensiona(); resa.cambiato(); } else renderer.setSize(w, h, false);
}

// ---------------------------------------------------------------------------
// Pezzi: profilo XY estruso lungo Z
// ---------------------------------------------------------------------------
export function impostaAnte(aperte) { anteAperte = !!aperte; }
export function anteSonoAperte() { return anteAperte; }

function prisma(punti, z0, profondita, mat, ombra = true, padre = padreMobile || gruppo) {
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
      (padreMobile || gruppo).add(g);
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
    (padreMobile || gruppo).add(g);
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
  if (resa) resa.cambiato();
  while (gruppo.children.length) {
    const c = gruppo.children.pop();
    c.traverse((o) => o.geometry?.dispose());
  }
  cardini = [];
  // texture arrivata: la vista veloce si aggiorna, quella realistica si rifà
  const ridisegna = () => { if (resa) resa.cambiato(); };
  // Texture a specchio (vale per questa pagina: la cache materiali è sua);
  // il legno continuo dei prodotti del catalogo si ripete già senza giunte
  const specchia = (m) => { if (m && m.map && !m.userData.continuo && m.map.wrapS !== THREE.MirroredRepeatWrapping) {
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
  contorni.clear(); ultimaP = opz.P;
  // ogni modulo nel suo gruppo (chiave): si sceglie toccandolo nel 3D
  const nelGruppo = (chiave, profilo, fai) => {
    const gm = new THREE.Group();
    gm.userData.chiave = chiave;
    gruppo.add(gm);
    padreMobile = gm;
    try { fai(); } finally { padreMobile = null; }
    if (chiave != null && profilo) contorni.set(chiave, profilo);
  };
  const profiloMobile = (x0, y0, L, hL, hR) => [[x0, y0], [x0 + L, y0], [x0 + L, y0 + hR], [x0, y0 + hL]];
  for (const e of elementi) {
    nelGruppo(e.chiave, profiloMobile(e.x0, e.y0 || 0, e.L, e.hL, e.hR),
      () => mobile(e, opz.P, opz.spessori, mat(fin(e).struttura), mat(fin(e).ante)));
  }
  if (opz.chiusura) {
    const ch = opz.chiusura, f = fin(ch);
    const prof = ch.fronte === 'fisso' ? ch.pannello?.profilo
      : ch.triangolare ? ch.profili?.schiena : profiloMobile(ch.x0, 0, ch.larghezza, ch.hL, ch.hR);
    nelGruppo(ch.chiave ?? 'chiusura', prof, () => chiusura(ch, opz.P, opz.spessori, mat(f.struttura), mat(f.ante)));
  }
  uvInScala(gruppo);                 // foto del catalogo: centrata su ogni pannello, misura vera
  ombreSuTutto(gruppo);              // tutto fa e riceve ombra
  // il mobile FA ombra (su pavimento e muro) ma non la riceve dal sole: dentro i vani il sole
  // disegnava strisce diagonali chiare e scure sui fianchi e sulla schiena (in una stanza vera la
  // luce dentro un armadio è diffusa); gli angoli e i ripiani restano scuriti dalle ombre di contatto
  gruppo.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  if (renderer) renderer.shadowMap.needsUpdate = true;
  const nuova = { W: forma.larghezza, H: forma.altezzaMax, P: opz.P };
  const cambiata = !ultimaVista || ['W', 'H', 'P'].some((k) => Math.abs(ultimaVista[k] - nuova[k]) > 1);
  ultimaVista = nuova;
  disegnaSelezione();
  if (opz.reinquadra || cambiata) inquadra('tre4');
}

// ---------------------------------------------------------------------------
// Scelta del modulo toccandolo nel 3D
// ---------------------------------------------------------------------------
const rayPick = new THREE.Raycaster();
/** Chiave del modulo sotto il dito (o null se il tocco è sul vano / nel vuoto). */
export function pickModulo(clientX, clientY) {
  if (!renderer || !camera || !gruppo) return null;
  const r = canvasEl.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  rayPick.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
  for (const hit of rayPick.intersectObjects(gruppo.children, true)) {
    let o = hit.object;
    while (o && o !== gruppo && o.userData.chiave === undefined) o = o.parent;
    // il primo pezzo colpito decide: se è il muro (davanti al modulo) non scelgo niente
    return o && o !== gruppo ? o.userData.chiave : null;
  }
  return null;
}

/** Evidenzia il modulo scelto (contorno oro) o nessuno (null). */
export function evidenziaModulo(chiave) {
  selChiave = chiave ?? null;
  disegnaSelezione();
}

function disegnaSelezione() {
  if (!scene) return;
  if (selGrp) { scene.remove(selGrp); selGrp.traverse((o) => o.geometry?.dispose()); selGrp = null; }
  const pts = selChiave != null ? contorni.get(selChiave) : null;
  if (pts && pts.length >= 3) {
    // barrette oro lungo il profilo davanti e dietro + gli spigoli in profondità:
    // spesse quanto basta per vederle anche sul telefono
    const S = ultimaVista ? Math.max(ultimaVista.W, ultimaVista.H) : 2500;
    const t = Math.max(16, S / 90);
    const zF = ultimaP + t / 2 + 2, zB = -t / 2 + 1;
    const g = new THREE.Group();
    const asse = new THREE.Vector3(1, 0, 0);
    const barra = (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a), L = d.length();
      if (L < 1) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L + t, t, t), matSel);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(asse, d.normalize());
      g.add(m);
    };
    const v = (p, z) => new THREE.Vector3(p[0], p[1], z);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      barra(v(p, zF), v(q, zF));
      barra(v(p, zB), v(q, zB));
      barra(v(p, zB), v(p, zF));
    });
    selGrp = g;
    scene.add(g);
  }
  if (resa) resa.cambiato();
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

/**
 * FOTO: la stessa resa realistica della vista 3D (luce, ombre, ombre di
 * contatto, legno identico alla foto) a grande risoluzione, subito.
 */
export async function fotoRealisticaModulari(opz = {}) {
  if (!renderer || !resa) return null;
  const lato = Math.max(opz.larghezza || 0, opz.altezza || 0) || latoMaxExport();
  return senzaSelezione(() => resa.foto(lato));
}
/** Nelle foto il contorno del modulo scelto non c'è. */
function senzaSelezione(fai) {
  const vis = selGrp ? selGrp.visible : false;
  if (selGrp) selGrp.visible = false;
  try { return fai(); } finally { if (selGrp) { selGrp.visible = vis; if (resa) resa.cambiato(); } }
}

/** Salva l'immagine (alta risoluzione, con logo). */
export function salvaImmagine(nome = 'mobili-modulari.png') {
  if (!renderer) return false;
  const c = renderer.domElement;
  const cw = c.clientWidth || c.width, ch = c.clientHeight || c.height;
  let out = null;
  try { out = senzaSelezione(() => componiConLogo(resa ? resa.foto(latoMaxExport()) : (renderer.render(scene, camera), c))); } catch { out = null; }
  return out ? salvaImmagineCanvas(out, nome) : false;
}
