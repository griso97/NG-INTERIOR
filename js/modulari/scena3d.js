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
import { getMaterialeTHREE, impostaUnitaUV, taraLuceCatalogo, uvInScala } from '../materiali.js?v=20261125b';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js?v=20261125b';
import { creaResa, nearSegueLaVista, inquadraOmbre, ombreSuTutto, pavimentoVero } from '../resa.js?v=20261125b';
import { riprendiRiflessiLaccati } from '../riflessi-laccati.js?v=20261125b';

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
    pavimentoVero('chiaro', 0xd2cbbf, 30000, 30000, () => { riflessiLucidi(); if (resa) resa.cambiato(); }));
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
// Vano: muro di fondo + muri/soffitto intorno in UN PEZZO SOLO (angoli chiusi),
// e sopra l'inclinata (sottoscala) una SCALA VERA
// ---------------------------------------------------------------------------
const LEGNO_SCALA = 'noce-panarea-yoku';   // pedate in noce (catalogo): staccano dal pavimento e dai mobili chiari
const ALZATA = 175;                   // mm: alzata comoda di una scala vera (si adatta alla salita)
const SP_PEDATA = 40;                 // spessore della pedata in legno
const NASO = 25;                      // la pedata sporge davanti all'alzata
const SBALZO = 20;                    // e sul lato aperto della scala

/** Retta della parete i spostata verso fuori di t: { A, d } (punto e direzione). */
function rettaFuori(a, b, t) {
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const d = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const nx = d.y, ny = -d.x;                                  // normale esterna (punti antiorari)
  return { A: { x: a.x + nx * t, y: a.y + ny * t }, d, n: { x: nx, y: ny } };
}
function incrocio(r1, r2) {
  const cr = r1.d.x * r2.d.y - r1.d.y * r2.d.x;
  if (Math.abs(cr) < 1e-9) return null;
  const s = ((r2.A.x - r1.A.x) * r2.d.y - (r2.A.y - r1.A.y) * r2.d.x) / cr;
  return { x: r1.A.x + r1.d.x * s, y: r1.A.y + r1.d.y * s };
}

/**
 * Geometria della scala sopra la parete inclinata iS: parte dal PAVIMENTO (anche oltre il
 * muretto basso), alzate tutte uguali di circa 17-18 cm, arriva in cima a filo del piano di
 * sopra (soletta spessa T sotto i gradini, misurata in perpendicolare all'inclinata).
 */
function geometriaScala(pts, iS, T) {
  const n = pts.length, a = pts[iS], b = pts[(iS + 1) % n];
  const loIsA = a.y < b.y;
  const lo = loIsA ? a : b, hi = loIsA ? b : a;
  const run = Math.abs(hi.x - lo.x), rise = hi.y - lo.y;
  if (run < 50 || rise < 50) return null;
  const m = rise / run, D = T * Math.hypot(1, m);            // spessore verticale della soletta
  const dir = Math.sign(hi.x - lo.x) || 1;
  const R = hi.y + D;                                         // quota del piano di sopra
  const uF = -(lo.y + D) / m;                                 // primo gradino (a terra)
  const nG = Math.max(3, Math.round(R / ALZATA));
  const r = R / nG, g = (run - uF) / nG;
  const X = (u) => lo.x + dir * u;
  const iLo = loIsA ? iS : (iS + 1) % n, iHi = loIsA ? (iS + 1) % n : iS;
  return { lo, hi, loIsA, run, m, D, dir, R, uF, nG, r, g, X, iLo, iHi, tt: SP_PEDATA };
}

function vano(forma, P, conGradini, matLegno) {
  const pts = forma.punti, n = pts.length, par = forma.pareti, T = SP_MURO;
  const prof = P + T + 60;                                    // profondità di muri e scala
  prisma(pts.map((p) => [p.x, p.y]), -T, T, matMuroFondo, false);
  const iF = par.findIndex((p) => p.tipo === 'pavimento');
  const iS = conGradini ? par.findIndex((p) => p.tipo === 'inclinata') : -1;
  const S = iS >= 0 ? geometriaScala(pts, iS, T) : null;
  const ext = { xMin: 0, xMax: forma.larghezza };
  const allarga = (x) => { ext.xMin = Math.min(ext.xMin, x); ext.xMax = Math.max(ext.xMax, x); };
  // parete accanto alla scala in alto / in basso
  const iNbHi = S ? (S.loIsA ? (iS + 1) % n : (iS - 1 + n) % n) : -1;
  const iNbLo = S ? (S.loIsA ? (iS - 1 + n) % n : (iS + 1) % n) : -1;
  const soffittoInCima = S && par[iNbHi].tipo === 'soffitto';
  // spessore di ogni parete (il pavimento è la retta y = 0); il soffitto piano accanto alla scala
  // è il piano di sopra: alto quanto il pianerottolo
  const spes = par.map((p, i) => (p.tipo === 'pavimento' ? 0 : (soffittoInCima && i === iNbHi ? S.R - S.tt - S.hi.y : T)));
  const rette = par.map((p, i) => rettaFuori(pts[i], pts[(i + 1) % n], spes[i]));
  // Spigolo esterno nel vertice j (fra la parete j-1 e la parete j): punto d'incontro delle due
  // facce esterne (angolo chiuso); se l'angolo è molto acuto lo smusso
  const giunto = (j) => {
    const i0 = (j - 1 + n) % n, i1 = j, v = pts[j];
    const M = incrocio(rette[i0], rette[i1]);
    const conPav = par[i0].tipo === 'pavimento' || par[i1].tipo === 'pavimento';
    if (M && (conPav || Math.hypot(M.x - v.x, M.y - v.y) <= 4 * T)) return [M];
    const e0 = { x: v.x + rette[i0].n.x * spes[i0], y: v.y + rette[i0].n.y * spes[i0] };
    const s1 = { x: v.x + rette[i1].n.x * spes[i1], y: v.y + rette[i1].n.y * spes[i1] };
    return [e0, s1];
  };
  const giunti = pts.map((_, j) => giunto(j));
  let profiloScala = [];
  if (S) {
    const { X, uF, nG, r, g, tt, R, dir, hi, lo } = S;
    // piede: comincia a terra (oltre il muretto basso, se c'è)
    const piede = { x: X(uF), y: 0 };
    // scalini: alzata, poi letto della pedata (la pedata in legno ci va sopra)
    const scalini = [piede];
    for (let k = 0; k < nG; k++) {
      scalini.push({ x: X(uF + k * g), y: (k + 1) * r - tt });
      scalini.push({ x: X(uF + (k + 1) * g), y: (k + 1) * r - tt });
    }
    // in alto: pianerottolo sopra il muro alto, o il soffitto piano che diventa il piano di sopra
    const cima = soffittoInCima ? [] : [{ x: hi.x + dir * T, y: R - tt }];
    // in basso: muretto → il piede è a terra dopo il muretto; pavimento → il piede È lo spigolo
    const xMur = lo.x - dir * T;
    const baseLo = par[iNbLo].tipo === 'pavimento' ? [] : [{ x: xMur, y: 0 }];
    // giunti dei due vertici della scala (in ordine lo → hi), poi girati se la parete va hi → lo
    const gLo = [...baseLo, piede], gHi = [{ x: hi.x, y: R - tt }, ...cima];
    giunti[S.iLo] = S.loIsA ? gLo : [...gLo].reverse();
    giunti[S.iHi] = S.loIsA ? gHi : [...gHi].reverse();
    profiloScala = S.loIsA ? scalini.slice(1) : scalini.slice(1).reverse();
  }
  // ANELLO unico: faccia interna (pareti) + faccia esterna al contrario → nessuna fessura
  const interno = [], esterno = [];
  for (let s = 1; s <= n; s++) interno.push(pts[(iF + s) % n]);
  esterno.push(...giunti[(iF + 1) % n]);
  for (let s = 1; s < n; s++) {
    const w = (iF + s) % n;
    if (w === iS && S) esterno.push(...profiloScala);
    esterno.push(...giunti[(w + 1) % n]);
  }
  const anello = [...interno, ...esterno.reverse()]
    .filter((p, i, A) => i === 0 || Math.hypot(p.x - A[i - 1].x, p.y - A[i - 1].y) > 0.5);
  anello.forEach((p) => allarga(p.x));
  prisma(anello.map((p) => [p.x, p.y]), -T, prof, matMuro);
  // PEDATE in legno: spessore 4 cm, naso davanti e sbalzo sul lato aperto; l'ultima continua
  // sul pianerottolo (o su tutto il piano di sopra)
  if (S && matLegno) {
    const { X, uF, nG, r, g, tt, dir, hi } = S;
    for (let k = 0; k < nG; k++) {
      const ua = uF + k * g - NASO;
      let xb = X(uF + (k + 1) * g);
      if (k === nG - 1) {
        if (soffittoInCima) { const vf = pts[S.loIsA ? (S.iHi + 1) % n : (S.iHi - 1 + n) % n]; xb = vf.x + dir * T; }
        else xb = hi.x + dir * T;
      }
      const xa = X(ua);
      prisma(rett(Math.min(xa, xb), (k + 1) * r - tt, Math.max(xa, xb), (k + 1) * r), -T, prof + SBALZO, matLegno);
      allarga(xa); allarga(xb);
    }
  }
  return ext;
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
  const estVano = vano(forma, opz.P, opz.conGradini, opz.conGradini ? mat(LEGNO_SCALA) : null);
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
  const nuova = { W: forma.larghezza, H: forma.altezzaMax, P: opz.P, x0: estVano.xMin, x1: estVano.xMax };   // x0..x1: anche la scala
  const cambiata = !ultimaVista || ['W', 'H', 'P'].some((k) => Math.abs(ultimaVista[k] - nuova[k]) > 1);
  ultimaVista = nuova;
  disegnaSelezione();
  if (opz.reinquadra || cambiata) inquadra('tre4');
  riflessiLucidi();
}

// Ante LACCATE LUCIDE: riflettono la stanza vera (pavimento, finestra alle spalle di chi guarda,
// plafoniere) come in cucina e negli armadi; si rifà quando cambiano i mobili o arriva il pavimento.
function riflessiLucidi() {
  if (!renderer || !scene || !gruppo || !ultimaVista) return;
  const { W, H, P } = ultimaVista;
  try {
    riprendiRiflessiLaccati({
      renderer, scene, radice: gruppo, dir: { x: 0, z: 1 }, centro: { x: W / 2, z: P / 2 },
      largo: W, altLuci: Math.max(2690, H + 250),
    });
  } catch (e) { console.warn('Riflessi dei lucidi', e); }
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
  const { H, P } = ultimaVista;
  // la scala può uscire dal vano (piede oltre il muretto, pianerottolo): inquadro anche lei
  const x0 = Math.min(0, ultimaVista.x0 ?? 0), x1 = Math.max(ultimaVista.W, ultimaVista.x1 ?? ultimaVista.W);
  const W = x1 - x0, cx = (x0 + x1) / 2;
  const S = Math.max(W, H);
  const target = new THREE.Vector3(cx, H * 0.45, P / 2);
  // Distanza per far stare tutto il vano (+ margine) nello schermo, sia in
  // altezza sia in larghezza: su telefono (schermo stretto) si allontana.
  const vf = (camera.fov * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = Math.max((H * 0.62) / Math.tan(vf / 2), (W * 0.62 + 300) / Math.tan(hf / 2)) + P;
  if (tipo === 'frontale') camera.position.set(cx, H * 0.5, P / 2 + dist);
  else {
    const dir = new THREE.Vector3(0.38, 0.22, 1).normalize();
    camera.position.copy(target).addScaledVector(dir, dist * 1.08);
  }
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
  const key = scene.children.find((o) => o.isDirectionalLight && o.castShadow);
  if (key) { key.target.position.copy(target); key.position.set(cx + S, H + S * 1.2, P + S * 1.6); }
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
