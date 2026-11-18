// =============================================================================
// COLLEZIONE MODERNA — NG INTERIOR
// Oggetti d'arredo per cucine di livello, modellati qui (nostri, nessuna licenza):
// fruttiere, vasi, rami d'ulivo, taglieri, libri, olio e aceto, barattoli, sgabelli.
// Misure vere in mm; materiali: ceramica opaca, marmo, noce, rovere, ottone, vetro,
// metallo nero. La frutta è scansionata dal vero (Poly Haven, CC0: oggetti/moderni).
// Assi: x larghezza, y altezza (0 = appoggio), z profondità (+ = davanti).
// =============================================================================
import * as THREE from 'three';

const qui = (p) => new URL(p, import.meta.url).href;

// ------------------------------------------------------------- materiali ----
const _tex = new Map();
function tex(file, rip = 1, colore = true) {
  const k = `${file}|${rip}`;
  if (!_tex.has(k)) {
    const t = new THREE.TextureLoader().load(qui(`../materials/${file}`));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rip, rip); t.anisotropy = 8;
    if (colore) t.colorSpace = THREE.SRGBColorSpace;
    _tex.set(k, t);
  }
  return _tex.get(k);
}
/** Grana fine (ceramica, lino, impasto): una texture di rumore morbido, per la ruvidità. */
function grana(seme = 1, scala = 4) {
  const k = `grana|${seme}|${scala}`;
  if (_tex.has(k)) return _tex.get(k);
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  let s = seme * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const base = new Float32Array(N * N); for (let i = 0; i < N * N; i++) base[i] = rnd();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { v += base[((y + dy + N) % N) * N + ((x + dx + N) % N)]; n++; }
    const q = Math.round(200 + (v / n - 0.5) * 90);
    im.data.set([q, q, q, 255], (y * N + x) * 4);
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(scala, scala);
  _tex.set(k, t); return t;
}
const _mat = new Map();
function mat(nome) {
  if (_mat.has(nome)) return _mat.get(nome);
  let m;
  switch (nome) {
    case 'ceramica-bianca': m = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.82, roughnessMap: grana(3), bumpMap: grana(3), bumpScale: 0.6 }); break;
    case 'ceramica-sabbia': m = new THREE.MeshStandardMaterial({ color: 0xcfc1a8, roughness: 0.88, roughnessMap: grana(5), bumpMap: grana(5, 3), bumpScale: 1.2 }); break;
    case 'ceramica-nera': m = new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.7, roughnessMap: grana(7), bumpMap: grana(7), bumpScale: 0.6 }); break;
    case 'marmo': m = new THREE.MeshStandardMaterial({ map: tex('compacto-bernini.jpg', 0.0025), roughness: 0.32, metalness: 0 }); break;
    case 'travertino': m = new THREE.MeshStandardMaterial({ map: tex('compacto-siena.jpg', 0.003), roughness: 0.55, bumpMap: grana(11, 6), bumpScale: 0.8 }); break;
    case 'noce': m = new THREE.MeshStandardMaterial({ map: tex('noce-caldo.jpg', 0.0022), roughness: 0.5 }); break;
    case 'rovere': m = new THREE.MeshStandardMaterial({ map: tex('rovere-nodoso.jpg', 0.0022), roughness: 0.55 }); break;
    case 'ottone': m = new THREE.MeshStandardMaterial({ color: 0xc8a565, metalness: 1, roughness: 0.32 }); break;
    case 'acciaio': m = new THREE.MeshStandardMaterial({ color: 0xd8d9db, metalness: 1, roughness: 0.25 }); break;
    case 'metallo-nero': m = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.42 }); break;
    // vetro: trasparente vero; i LIQUIDI dentro sono "pieni" (un trasparente dentro un altro non si vedrebbe)
    case 'vetro': m = new THREE.MeshPhysicalMaterial({ color: 0xf4f8f5, metalness: 0, roughness: 0.03, transmission: 1, thickness: 4, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.6, attenuationColor: new THREE.Color(0xdfeee4), attenuationDistance: 120 }); break;
    case 'olio': m = new THREE.MeshPhysicalMaterial({ color: 0xa88a18, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x3a2c00, emissiveIntensity: 0.35 }); break;
    case 'aceto': m = new THREE.MeshPhysicalMaterial({ color: 0x3a120a, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }); break;
    case 'ottone-spazzolato': m = new THREE.MeshStandardMaterial({ color: 0xc6a05e, metalness: 1, roughness: 0.3, roughnessMap: grana(47, 20) }); break;
    case 'marmo-nero': m = new THREE.MeshStandardMaterial({ map: tex('compacto-negro.jpg', 0.0025), roughness: 0.22, metalness: 0 }); break;
    case 'vetro-fume': m = new THREE.MeshPhysicalMaterial({ color: 0x8c8a86, metalness: 0, roughness: 0.04, transmission: 1, thickness: 6, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.6, attenuationColor: new THREE.Color(0x3b3632), attenuationDistance: 18 }); break;
    case 'cristallo': m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.01, transmission: 1, thickness: 5, ior: 1.56, specularIntensity: 1, envMapIntensity: 2 }); break;
    case 'acqua': m = new THREE.MeshPhysicalMaterial({ color: 0xdcebee, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.35, clearcoat: 1 }); break;
    case 'boucle': m = new THREE.MeshStandardMaterial({ color: 0xeee9df, roughness: 1, bumpMap: grana(53, 40), bumpScale: 6 }); break;
    case 'cera': m = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.55 }); break;
    case 'pampas': m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }); break;
    case 'stelo': m = new THREE.MeshStandardMaterial({ color: 0xbfa985, roughness: 0.9 }); break;
    case 'opalino': m = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.35, emissive: 0xfff1d6, emissiveIntensity: 0.55 }); break;
    case 'luce-calda': m = new THREE.MeshBasicMaterial({ color: 0xfff1d2 }); break;
    case 'cavo': m = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }); break;
    case 'pelle-cognac': m = new THREE.MeshStandardMaterial({ color: 0x6f4128, roughness: 0.5, bumpMap: grana(43, 14), bumpScale: 0.6 }); break;
    case 'sughero': m = new THREE.MeshStandardMaterial({ color: 0xb9925f, roughness: 0.9, bumpMap: grana(13, 8), bumpScale: 1.5 }); break;
    case 'pasta': m = new THREE.MeshStandardMaterial({ color: 0xe0c27e, roughness: 0.75, bumpMap: grana(17, 10), bumpScale: 4 }); break;
    case 'caffe': m = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.55, bumpMap: grana(19, 14), bumpScale: 5 }); break;
    case 'riso': m = new THREE.MeshStandardMaterial({ color: 0xf1ede3, roughness: 0.8, bumpMap: grana(23, 16), bumpScale: 3 }); break;
    case 'carta': m = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.95, bumpMap: grana(29, 2), bumpScale: 0.4 }); break;
    case 'lino-tortora': m = new THREE.MeshStandardMaterial({ color: 0xb3a592, roughness: 0.92, bumpMap: grana(31, 12), bumpScale: 0.8 }); break;
    case 'lino-antracite': m = new THREE.MeshStandardMaterial({ color: 0x2e2e30, roughness: 0.9, bumpMap: grana(37, 12), bumpScale: 0.8 }); break;
    case 'lino-avorio': m = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.92, bumpMap: grana(41, 12), bumpScale: 0.8 }); break;
    case 'ramo': m = new THREE.MeshStandardMaterial({ color: 0x6b6152, roughness: 0.9 }); break;
    case 'foglia-ulivo': m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide }); break;
    default: m = new THREE.MeshStandardMaterial({ color: 0x999999 });
  }
  _mat.set(nome, m); return m;
}
const ombre = (o) => { o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); return o; };

// ------------------------------------------------------------- forme ----
/** Profilo liscio (punti [raggio, altezza] in mm) → solido al tornio. */
function tornio(punti, seg = 96, morbido = true) {
  let v = punti.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  if (morbido && v.length > 3) v = new THREE.SplineCurve(v).getPoints(v.length * 8);
  const g = new THREE.LatheGeometry(v, seg); g.computeVertexNormals(); return g;
}
/** Rettangolo arrotondato (mm). */
function rettTondo(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** Lastra: forma 2D (piano x-z) spessa h, con lo spigolo smussato. */
function lastra(shape, h, smusso = 1.5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * smusso, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.translate(0, smusso, 0); g.computeVertexNormals(); return g;
}
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

// ------------------------------------------------------------- frutta ----
const _frutti = new Map();
/** I frutti di una scansione (un file può averne più d'uno: le pere sono 5): ognuno centrato, in mm. */
async function frutto(id) {
  if (!_frutti.has(id)) {
    _frutti.set(id, (async () => {
      const { GLTFLoader } = await import('../vendor/three/addons/loaders/GLTFLoader.js');
      const gl = await new GLTFLoader().loadAsync(qui(`../oggetti/moderni/${id}/${id}.gltf`));
      gl.scene.updateMatrixWorld(true);
      const pezzi = [];
      gl.scene.traverse((o) => { if (o.isMesh) pezzi.push(o); });
      return pezzi.map((o) => {
        const m = new THREE.Mesh(o.geometry, o.material);
        m.applyMatrix4(o.matrixWorld); m.scale.multiplyScalar(1000); m.position.multiplyScalar(1000); m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
        m.position.sub(c);                                         // centrato: si gira bene
        const g = new THREE.Group(); g.add(m); g.userData.r = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2;
        return g;
      });
    })());
  }
  return _frutti.get(id);
}
/** Riempie una ciotola (profilo interno: altezza del fondo a ogni raggio) con la frutta, a strati. */
async function riempi(gruppo, tipi, fondo, rMax, quanti) {
  const perTipo = await Promise.all(tipi.map(frutto));
  const posati = [];
  for (let i = 0; i < quanti; i++) {
    const lista = perTipo[i % perTipo.length], m = lista[Math.floor(i / perTipo.length) % lista.length], r = m.userData.r;
    let best = null;
    for (let t = 0; t < 60; t++) {                                 // il punto più basso libero
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * Math.max(0, rMax - r * 0.9);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      let y = fondo(rr) + r * 0.92;
      for (const p of posati) { const dx = x - p.x, dz = z - p.z, dd = Math.hypot(dx, dz), min = (r + p.r) * 0.9; if (dd < min) y = Math.max(y, p.y + Math.sqrt(Math.max(0, min * min - dd * dd))); }
      if (!best || y < best.y) best = { x, y, z };
    }
    const f = m.clone(true); f.position.set(best.x, best.y, best.z);
    f.rotation.set(rnd() * 0.8 - 0.4, rnd() * Math.PI * 2, rnd() * 0.8 - 0.4);
    gruppo.add(f); posati.push({ ...best, r });
  }
}

// ------------------------------------------------------------- oggetti ----
/** Fruttiera bassa e larga (Ø 320) in pietra o ceramica, piena di frutta vera. */
async function fruttiera(materiale, frutti, quanti) {
  const g = new THREE.Group();
  const prof = [[0, 0], [62, 0], [66, 6], [64, 12], [95, 20], [128, 38], [152, 62], [160, 82], [157, 86], [151, 83], [143, 64], [118, 42], [84, 27], [45, 20], [0, 18]];
  g.add(new THREE.Mesh(tornio(prof, 128), mat(materiale)));
  // fondo interno: altezza a ogni raggio (dal profilo interno)
  const interno = [[0, 18], [45, 20], [84, 27], [118, 42], [143, 64], [151, 83]];
  const fondo = (r) => { for (let i = 1; i < interno.length; i++) if (r <= interno[i][0]) { const [r0, y0] = interno[i - 1], [r1, y1] = interno[i]; return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0); } return 83; };
  await riempi(g, frutti, fondo, 136, quanti);
  return ombre(g);
}
/** LUXURY — alzata in ottone spazzolato con frutta mista. */
async function alzata() {
  const g = new THREE.Group();
  const prof = [[0, 0], [72, 0], [74, 5], [62, 10], [16, 15], [11, 28], [10, 105], [14, 114], [42, 119], [100, 125], [138, 134], [150, 147], [147, 150], [135, 139], [96, 130], [40, 125], [0, 124]];
  g.add(new THREE.Mesh(tornio(prof, 128), mat('ottone-spazzolato')));
  const interno = [[0, 124], [40, 125], [96, 130], [135, 139]];
  const fondo = (r) => { for (let i = 1; i < interno.length; i++) if (r <= interno[i][0]) { const [r0, y0] = interno[i - 1], [r1, y1] = interno[i]; return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0); } return 139; };
  await riempi(g, ['food_pomegranate_01', 'lemon', 'food_apple_01', 'food_lime_01', 'food_pears_asian_01'], fondo, 125, 5);
  return ombre(g);
}
/** Superficie al tornio CANNETTATA (scanalature verticali): r(y) del profilo + le scanalature. */
function cannettato(profilo, H, n = 26, prof = 3.2, segU = 208, segV = 90) {
  const curva = new THREE.SplineCurve(profilo.map(([r, y]) => new THREE.Vector2(r, y)));
  const rDi = (y) => { const pts = curva.getPoints(300); for (let i = 1; i < pts.length; i++) if (y <= pts[i].y) { const a = pts[i - 1], b = pts[i]; return a.x + ((y - a.y) / Math.max(1e-6, b.y - a.y)) * (b.x - a.x); } return pts[pts.length - 1].x; };
  const pos = [], ind = [], uv = [];
  for (let j = 0; j <= segV; j++) {
    const y = (j / segV) * H, r0 = rDi(y);
    for (let i = 0; i <= segU; i++) {
      const a = (i / segU) * Math.PI * 2, sc = Math.pow(Math.abs(Math.cos((n * a) / 2)), 0.6);
      const rr = r0 - prof * (1 - sc) * Math.min(1, y / 25, (H - y) / 25);   // scanalature, morbide alle estremità
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); uv.push(i / segU, j / segV);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const a = j * (segU + 1) + i, b = a + segU + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
  return { geo: g, rTop: rDi(H), rBase: rDi(0) };
}
/** LUXURY — vaso cannettato in ceramica bianca opaca con pampas. */
function vasoPampas() {
  const g = new THREE.Group(), H = 360;
  const c = cannettato([[78, 0], [96, 40], [104, 120], [98, 220], [80, 300], [70, 345], [72, 360]], H);
  const mt = mat('ceramica-bianca');
  g.add(new THREE.Mesh(c.geo, mt));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(c.rBase, 64).rotateX(Math.PI / 2), mt));
  const bordo = new THREE.Mesh(new THREE.TorusGeometry(c.rTop - 3, 3.5, 10, 96), mt); bordo.rotation.x = Math.PI / 2; bordo.position.y = H; g.add(bordo);
  const dentro = new THREE.Mesh(new THREE.CircleGeometry(c.rTop - 5, 48).rotateX(-Math.PI / 2), mat('ceramica-nera')); dentro.position.y = H - 40; g.add(dentro);
  // PAMPAS: steli lunghi e piumini color crema
  const ciuffi = [], tmp = new THREE.Color(), c1 = new THREE.Color(0xe9dfc8), c2 = new THREE.Color(0xd4c3a0);
  const nSteli = 7;
  for (let k = 0; k < nSteli; k++) {
    const a = (k / nSteli) * Math.PI * 2 + rnd() * 0.5, apre = 0.12 + rnd() * 0.22, alt = 520 + rnd() * 380;
    const top = new THREE.Vector3(Math.cos(a) * alt * apre, H + alt, Math.sin(a) * alt * apre);
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a) * 15, H - 30, Math.sin(a) * 15), new THREE.Vector3(Math.cos(a) * alt * apre * 0.3, H + alt * 0.55, Math.sin(a) * alt * apre * 0.3), top);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 2.4, 5), mat('stelo')));
    const n = 230;
    for (let i = 0; i < n; i++) {
      const t = 0.62 + 0.38 * Math.pow(rnd(), 0.8), P = curva.getPoint(t), T = curva.getTangent(t);
      const giro = rnd() * Math.PI * 2, piega = 0.35 + rnd() * 0.55 * (1 - (t - 0.62) / 0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), T);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), piega));
      const sc = 0.7 + rnd() * 0.6;
      ciuffi.push({ m: new THREE.Matrix4().compose(P, q, new THREE.Vector3(sc, sc * (0.8 + rnd() * 0.5), sc)), c: rnd() });
    }
  }
  const piuma = new THREE.PlaneGeometry(7, 70, 1, 4); piuma.translate(0, 35, 0);
  const pp = piuma.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setX(i, pp.getX(i) * (1 - y / 80)); pp.setZ(i, (y / 70) ** 2 * 10); }
  piuma.computeVertexNormals();
  const im = new THREE.InstancedMesh(piuma, mat('pampas'), ciuffi.length);
  ciuffi.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, tmp.copy(c1).lerp(c2, f.c)); });
  g.add(im);
  return ombre(g);
}
/** LUXURY — vaso in vetro fumé, pancia larga e collo stretto. */
function vasoFume() {
  const prof = [[0, 0], [70, 0], [76, 6], [96, 60], [100, 120], [86, 190], [52, 245], [38, 285], [40, 300], [35, 300], [33, 286], [47, 245], [80, 190], [94, 120], [90, 62], [70, 10], [0, 8]];
  return ombre(new THREE.Group().add(new THREE.Mesh(tornio(prof, 112), mat('vetro-fume'))));
}
/** LUXURY — tre candelieri in ottone con candele bianche. */
function candelieri() {
  const g = new THREE.Group();
  for (const [x, z, h] of [[-90, 10, 180], [0, -30, 270], [85, 20, 350]]) {
    const prof = [[0, 0], [45, 0], [47, 4], [40, 9], [9, 16], [7, 40], [6, h - 30], [9, h - 22], [18, h - 14], [17, h], [0, h]];
    const c = new THREE.Mesh(tornio(prof, 64), mat('ottone-spazzolato')); c.position.set(x, 0, z); g.add(c);
    const candela = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 240, 32), mat('cera')); candela.position.set(x, h + 120, z); g.add(candela);
    const stoppino = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 6), mat('cavo')); stoppino.position.set(x, h + 245, z); g.add(stoppino);
  }
  return ombre(g);
}
/** LUXURY — scultura: anello in travertino su base di marmo nero, sfera in ottone. */
function scultura() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(rettTondo(180, 120, 6), 30, 2), mat('marmo-nero')));
  const anello = new THREE.Mesh(new THREE.TorusGeometry(105, 32, 48, 128), mat('travertino')); anello.position.set(-15, 30 + 105 + 32 - 6, 0); g.add(anello);
  const sfera = new THREE.Mesh(new THREE.SphereGeometry(28, 48, 32), mat('ottone-spazzolato')); sfera.position.set(62, 30 + 28, 18); g.add(sfera);
  return ombre(g);
}
/** LUXURY — caraffa e due bicchieri in cristallo su vassoio tondo di marmo nero. */
function caraffa() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tornio([[0, 0], [150, 0], [160, 4], [162, 18], [156, 20], [150, 10], [0, 10]], 128, false), mat('marmo-nero')));
  const car = [[0, 0], [52, 0], [56, 6], [62, 70], [58, 150], [42, 215], [36, 250], [40, 262], [35, 262], [31, 250], [37, 215], [53, 150], [57, 70], [51, 8], [0, 6]];
  const c = new THREE.Mesh(tornio(car, 96), mat('cristallo')); c.position.set(-45, 10, -20); g.add(c);
  const ac = new THREE.Mesh(tornio([[0, 0], [51, 0], [56, 64], [54, 120], [0, 120]], 64, false), mat('acqua')); ac.position.set(-45, 17, -20); g.add(ac);
  for (const [x, z] of [[70, -40], [85, 55]]) {
    const b = new THREE.Mesh(tornio([[0, 0], [36, 0], [38, 3], [40, 95], [37, 95], [35, 8], [0, 7]], 64, false), mat('cristallo')); b.position.set(x, 10, z); g.add(b);
  }
  return ombre(g);
}
/** LUXURY — sgabello alto: seduta in bouclé, colonna e base in ottone. */
function sgabelloBoucle() {
  const g = new THREE.Group(), H = 650;
  g.add(new THREE.Mesh(tornio([[0, 0], [205, 0], [210, 4], [208, 12], [0, 12]], 96, false), mat('ottone-spazzolato')));
  g.add(new THREE.Mesh(tornio([[0, 0], [30, 12], [24, 40], [22, H - 120], [30, H - 92], [120, H - 86], [118, H - 80], [0, H - 80]], 64, false), mat('ottone-spazzolato')));
  const anello = new THREE.Mesh(new THREE.TorusGeometry(160, 8, 12, 96), mat('ottone-spazzolato')); anello.rotation.x = Math.PI / 2; anello.position.y = 300; g.add(anello);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, raggio = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 140, 10), mat('ottone-spazzolato')); raggio.rotation.z = Math.PI / 2; raggio.rotation.y = a; raggio.position.set(Math.cos(a) * 90, 300, -Math.sin(a) * 90); g.add(raggio); }
  const cuscino = new THREE.Mesh(tornio([[0, 0], [175, 0], [196, 12], [205, 42], [196, 72], [170, 86], [0, 90]], 96), mat('boucle')); cuscino.position.y = H - 86; g.add(cuscino);
  return ombre(g);
}
/** LUXURY — lampada a sospensione: pende dal SOFFITTO (270 cm), il paralume a 165 cm da terra
 *  (75 cm sopra un piano di 90), qualunque cosa ci sia sotto. */
const SOFFITTO = 2700, Y_LAMPADA = 1650;
function lampada(tipo) {
  const g = new THREE.Group(), y0 = Y_LAMPADA, cavo = SOFFITTO - Y_LAMPADA - 190 - 22;
  if (tipo === 'ottone') {
    g.add(new THREE.Mesh(tornio([[150, 0], [152, 3], [140, 60], [105, 120], [45, 160], [16, 172], [16, 190], [12, 190], [12, 168], [42, 154], [100, 116], [135, 58], [146, 2]], 112), mat('ottone-spazzolato')));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(42, 32, 16), mat('luce-calda')); lamp.position.y = 70; g.add(lamp);
    const d = new THREE.Mesh(new THREE.CircleGeometry(144, 64).rotateX(Math.PI / 2), mat('opalino')); d.position.y = 6; g.add(d);
  } else {
    const globo = new THREE.Mesh(new THREE.SphereGeometry(125, 64, 48), mat('opalino')); globo.position.y = 125; g.add(globo);
    g.add(new THREE.Mesh(tornio([[0, 236], [38, 236], [44, 250], [30, 270], [10, 280], [10, 300], [0, 300]], 64, false), mat('ottone-spazzolato')));
  }
  const filo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, cavo, 8), mat('cavo')); filo.position.y = 190 + cavo / 2; g.add(filo);
  const rosone = new THREE.Mesh(tornio([[0, 0], [55, 0], [60, 6], [60, 24], [0, 24]], 64, false), mat(tipo === 'ottone' ? 'ottone-spazzolato' : 'cavo')); rosone.position.y = 190 + cavo - 2; g.add(rosone);
  g.children.forEach((c) => { c.position.y += y0; });
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; } });
  return g;
}
/** Vaso scultura (ceramica opaca), linea morbida. */
function vasoScultura(materiale = 'ceramica-sabbia') {
  const prof = [[0, 0], [62, 0], [70, 4], [98, 45], [118, 120], [121, 190], [108, 260], [80, 320], [55, 360], [44, 395], [48, 418], [52, 422], [47, 424], [41, 418], [37, 392], [47, 355], [72, 318], [99, 258], [111, 190], [108, 122], [88, 50], [58, 14], [0, 12]];
  return ombre(new THREE.Group().add(new THREE.Mesh(tornio(prof, 128), mat(materiale))));
}
/** Foglia d'ulivo (lunga e stretta, appena curva). */
let _foglia = null;
function geoFoglia() {
  if (_foglia) return _foglia;
  const L = 72, Wd = 12, s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(Wd * 0.9, L * 0.35, 0, L); s.quadraticCurveTo(-Wd * 0.9, L * 0.35, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, (y / L) ** 2 * 6 + Math.abs(x) * 0.25); }
  g.computeVertexNormals(); _foglia = g; return g;
}
/** Vaso nero alto con rami d'ulivo. */
function vasoUlivo() {
  const g = new THREE.Group();
  const prof = [[0, 0], [58, 0], [64, 5], [84, 70], [90, 170], [80, 250], [52, 315], [32, 352], [30, 372], [34, 380], [30, 382], [26, 372], [26, 350], [46, 312], [72, 250], [82, 170], [76, 75], [52, 14], [0, 12]];
  g.add(new THREE.Mesh(tornio(prof, 112), mat('ceramica-nera')));
  const foglie = [];
  const nRami = 6;
  for (let b = 0; b < nRami; b++) {
    const a = (b / nRami) * Math.PI * 2 + rnd() * 0.6, sp = 90 + rnd() * 140, h = 330 + rnd() * 320;
    const pts = [new THREE.Vector3(0, 360, 0)];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4, cr = sp * Math.pow(t, 1.3);
      pts.push(new THREE.Vector3(Math.cos(a + t * 0.4) * cr, 360 + h * t - sp * 0.25 * t * t, Math.sin(a + t * 0.4) * cr));
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 2.2 - b * 0.1, 6), mat('ramo')));
    // foglie A COPPIE (come l'ulivo vero), fitte, che si aprono verso l'esterno
    const nodi = 24 + Math.floor(rnd() * 8);
    for (let i = 0; i < nodi; i++) {
      const t = 0.12 + (i / nodi) * 0.88, P = curva.getPointAt(t), T = curva.getTangentAt(t);
      const ruota = i * 1.35 + rnd() * 0.3;
      for (const lato of [-1, 1]) {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), T);
        const giro = new THREE.Quaternion().setFromAxisAngle(T, ruota + (lato > 0 ? Math.PI : 0));
        const apri = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.75 + rnd() * 0.45 - t * 0.25);
        const qq = giro.multiply(q).multiply(apri);
        const sc = (0.8 + rnd() * 0.4) * (1.05 - t * 0.3);
        foglie.push({ m: new THREE.Matrix4().compose(P, qq, new THREE.Vector3(sc, sc, sc)), c: rnd() });
      }
    }
  }
  const im = new THREE.InstancedMesh(geoFoglia(), mat('foglia-ulivo'), foglie.length);
  const c1 = new THREE.Color(0x55634a), c2 = new THREE.Color(0xa8b29c), tmp = new THREE.Color();   // verde scuro sopra, argento sotto
  foglie.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, tmp.copy(c1).lerp(c2, f.c)); });
  g.add(im);
  return ombre(g);
}
/** Due taglieri sovrapposti: noce con manico, rovere sopra. */
function taglieri() {
  const g = new THREE.Group();
  const manico = new THREE.Path(); manico.absarc(250, 0, 12, 0, Math.PI * 2, true);
  // tagliere con manico: rettangolo + manico tondo a destra
  const forma = new THREE.Shape();
  forma.moveTo(-170, -125); forma.lineTo(170, -125); forma.quadraticCurveTo(210, -125, 210, -85); forma.lineTo(210, -38);
  forma.quadraticCurveTo(212, -28, 228, -26); forma.lineTo(262, -24); forma.quadraticCurveTo(290, -24, 290, 0); forma.quadraticCurveTo(290, 24, 262, 24);
  forma.lineTo(228, 26); forma.quadraticCurveTo(212, 28, 210, 38); forma.lineTo(210, 85); forma.quadraticCurveTo(210, 125, 170, 125);
  forma.lineTo(-170, 125); forma.quadraticCurveTo(-210, 125, -210, 85); forma.lineTo(-210, -85); forma.quadraticCurveTo(-210, -125, -170, -125);
  forma.holes.push(manico);
  const a = new THREE.Mesh(lastra(forma, 22, 2), mat('noce')); a.position.x = -40; g.add(a);
  const b = new THREE.Mesh(lastra(rettTondo(300, 190, 30), 18, 2), mat('rovere'));
  b.position.set(-70, 22, 6); b.rotation.y = 0.14; g.add(b);
  return ombre(g);
}
/** Pila di 3 libri di cucina (copertine in lino) con una ciotolina in ottone sopra. */
function libri() {
  const g = new THREE.Group();
  const dati = [[270, 210, 30, 'lino-antracite', 0], [250, 195, 24, 'lino-tortora', 0.08], [235, 180, 20, 'lino-avorio', -0.05]];
  let y = 0;
  for (const [w, d, h, m, rot] of dati) {
    const b = new THREE.Group();
    const cop = 2.5;
    b.add(new THREE.Mesh(lastra(rettTondo(w, d, 2), cop, 0.8), mat(m)));                          // piatto sotto
    const top = new THREE.Mesh(lastra(rettTondo(w, d, 2), cop, 0.8), mat(m)); top.position.y = h - cop; b.add(top);
    const dorso = new THREE.Mesh(new THREE.BoxGeometry(cop * 1.6, h, d), mat(m)); dorso.position.set(-w / 2 + cop * 0.8, h / 2, 0); b.add(dorso);
    const pagine = new THREE.Mesh(new THREE.BoxGeometry(w - 8, h - 2 * cop, d - 8), mat('carta')); pagine.position.set(2, h / 2, 0); b.add(pagine);
    b.position.y = y; b.rotation.y = rot; g.add(b); y += h;
  }
  const ciot = new THREE.Mesh(tornio([[0, 0], [28, 0], [52, 18], [62, 34], [58, 35], [48, 22], [26, 6], [0, 5]], 96), mat('ottone'));
  ciot.position.set(20, y, 6); g.add(ciot);
  return ombre(g);
}
/** Olio e aceto: due bottiglie di vetro su un vassoio di marmo. */
function olioAceto() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(rettTondo(300, 150, 20), 12, 2), mat('marmo')));
  const bott = (x, liquido, alt) => {
    const b = new THREE.Group();
    const prof = [[0, 0], [33, 0], [35, 4], [35, alt * 0.66], [30, alt * 0.76], [15, alt * 0.86], [12, alt * 0.97], [13, alt], [10, alt], [9, alt * 0.97], [12, alt * 0.86], [27, alt * 0.76], [32, alt * 0.66], [32, 5], [0, 4]];
    b.add(new THREE.Mesh(tornio(prof, 64), mat('vetro')));
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(30.5, 30.5, alt * 0.6, 48), mat(liquido)); liq.position.y = 5 + alt * 0.3; b.add(liq);
    const tappo = new THREE.Mesh(tornio([[0, 0], [9, 0], [9.5, 12], [6, 26], [3, 34], [0, 34]], 32, false), mat('acciaio')); tappo.position.y = alt - 6; b.add(tappo);
    b.position.set(x, 12, 0); return b;
  };
  g.add(bott(-70, 'olio', 290)); g.add(bott(55, 'aceto', 240));
  return ombre(g);
}
/** Tre barattoli di vetro con coperchio in rovere: pasta, caffè, riso. */
function barattoli() {
  const g = new THREE.Group();
  const dati = [[-125, 105, 230, 'pasta'], [0, 95, 180, 'caffe'], [112, 85, 140, 'riso']];
  for (const [x, D, H, cont] of dati) {
    const r = D / 2, b = new THREE.Group();
    const prof = [[0, 0], [r - 3, 0], [r, 3], [r, H - 2], [r - 2.5, H], [r - 2.5, 4], [0, 4]];
    b.add(new THREE.Mesh(tornio(prof, 72, false), mat('vetro')));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r - 3.5, r - 3.5, H * 0.72, 48), mat(cont)); c.position.y = 4 + H * 0.36; b.add(c);
    const coperchio = new THREE.Mesh(tornio([[0, 0], [r + 1, 0], [r + 2, 3], [r + 2, 24], [r, 27], [0, 27]], 72, false), mat('rovere'));
    coperchio.position.y = H - 4; b.add(coperchio);
    b.position.x = x; g.add(b);
  }
  return ombre(g);
}
/** Sgabello alto (seduta 65 cm): telaio in metallo nero, seduta tonda in noce. */
function sgabello() {
  const g = new THREE.Group(), H = 650;
  const seduta = new THREE.Mesh(tornio([[0, 0], [170, 0], [186, 6], [190, 22], [186, 38], [172, 44], [0, 44]], 96), mat('pelle-cognac'));
  seduta.position.y = H - 44; g.add(seduta);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const top = new THREE.Vector3(Math.cos(a) * 125, H - 44, Math.sin(a) * 125), bot = new THREE.Vector3(Math.cos(a) * 205, 0, Math.sin(a) * 205);
    const len = top.distanceTo(bot), gamba = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, len, 16), mat('metallo-nero'));
    gamba.position.copy(top).add(bot).multiplyScalar(0.5);
    gamba.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bot.clone().sub(top).normalize()); g.add(gamba);
    const piede = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 6, 16), mat('metallo-nero')); piede.position.set(bot.x, 3, bot.z); g.add(piede);
  }
  const yAnello = 300, rA = 125 + (205 - 125) * ((H - 44 - yAnello) / (H - 44));
  const anello = new THREE.Mesh(new THREE.TorusGeometry(rA, 8, 12, 96), mat('ottone')); anello.rotation.x = Math.PI / 2; anello.position.y = yAnello; g.add(anello);
  return ombre(g);
}

// ------------------------------------------------------------- catalogo ----
export const COLLEZIONE = [
  { id: 'fruttiera-limoni', nome: 'Fruttiera in marmo con limoni', es: 'Frutero de mármol con limones', misure: { w: 320, d: 320, h: 200 }, crea: () => fruttiera('marmo', ['lemon'], 7) },
  { id: 'fruttiera-pere', nome: 'Fruttiera nera con pere e lime', es: 'Frutero negro con peras y limas', misure: { w: 320, d: 320, h: 155 }, crea: () => fruttiera('ceramica-nera', ['food_pears_asian_01', 'food_lime_01'], 8) },
  { id: 'fruttiera-mista', nome: 'Fruttiera in travertino con frutta mista', es: 'Frutero de travertino con fruta variada', misure: { w: 320, d: 320, h: 240 }, crea: () => fruttiera('travertino', ['food_apple_01', 'lemon', 'food_pomegranate_01', 'food_lime_01', 'food_pears_asian_01'], 8) },
  { id: 'vaso-scultura', nome: 'Vaso scultura in ceramica sabbia', es: 'Jarrón escultura de cerámica arena', misure: { w: 242, d: 242, h: 424 }, crea: async () => vasoScultura() },
  { id: 'vaso-ulivo', nome: 'Vaso nero con rami d\'ulivo', es: 'Jarrón negro con ramas de olivo', misure: { w: 390, d: 490, h: 960 }, crea: async () => vasoUlivo() },
  { id: 'taglieri', nome: 'Taglieri in noce e rovere', es: 'Tablas de nogal y roble', misure: { w: 505, d: 255, h: 40 }, crea: async () => taglieri() },
  { id: 'libri', nome: 'Libri di cucina con ciotola in ottone', es: 'Libros de cocina con cuenco de latón', misure: { w: 270, d: 210, h: 110 }, crea: async () => libri() },
  { id: 'olio-aceto', nome: 'Olio e aceto su vassoio di marmo', es: 'Aceite y vinagre en bandeja de mármol', misure: { w: 300, d: 150, h: 340 }, crea: async () => olioAceto() },
  { id: 'barattoli', nome: 'Barattoli in vetro con coperchio in rovere', es: 'Tarros de vidrio con tapa de roble', misure: { w: 336, d: 110, h: 253 }, crea: async () => barattoli() },
  { id: 'sgabello', nome: 'Sgabello alto pelle cognac e nero', es: 'Taburete alto piel coñac y negro', misure: { w: 380, d: 380, h: 652 }, crea: async () => sgabello() },
  // ---- LUXURY ----
  { id: 'lux-alzata', linea: 'luxury', nome: 'Alzata in ottone con frutta mista', es: 'Frutero alto de latón con fruta variada', misure: { w: 300, d: 300, h: 285 }, crea: () => alzata() },
  { id: 'lux-vaso-pampas', linea: 'luxury', nome: 'Vaso cannettato bianco con pampas', es: 'Jarrón acanalado blanco con pampas', misure: { w: 530, d: 350, h: 1335 }, crea: async () => vasoPampas() },
  { id: 'lux-vaso-fume', linea: 'luxury', nome: 'Vaso in vetro fumé', es: 'Jarrón de vidrio ahumado', misure: { w: 200, d: 200, h: 300 }, crea: async () => vasoFume() },
  { id: 'lux-candelieri', linea: 'luxury', nome: 'Candelieri in ottone', es: 'Candelabros de latón', misure: { w: 274, d: 150, h: 600 }, crea: async () => candelieri() },
  { id: 'lux-scultura', linea: 'luxury', nome: 'Scultura travertino, marmo nero e ottone', es: 'Escultura de travertino, mármol negro y latón', misure: { w: 270, d: 120, h: 300 }, crea: async () => scultura() },
  { id: 'lux-caraffa', linea: 'luxury', nome: 'Caraffa e bicchieri in cristallo su marmo nero', es: 'Jarra y vasos de cristal sobre mármol negro', misure: { w: 324, d: 324, h: 272 }, crea: async () => caraffa() },
  { id: 'lux-sgabello', linea: 'luxury', nome: 'Sgabello alto bouclé e ottone', es: 'Taburete alto bouclé y latón', misure: { w: 420, d: 420, h: 650 }, crea: async () => sgabelloBoucle() },
  { id: 'lux-lampada-ottone', linea: 'luxury', appeso: true, nome: 'Lampada a sospensione in ottone', es: 'Lámpara colgante de latón', misure: { w: 305, d: 305, h: 2700 }, crea: async () => lampada('ottone') },
  { id: 'lux-lampada-globo', linea: 'luxury', appeso: true, nome: 'Lampada a sospensione globo opalino', es: 'Lámpara colgante globo opalino', misure: { w: 250, d: 250, h: 2700 }, crea: async () => lampada('globo') },
];

const _pronti = new Map();
/** Il modello (una volta sola): gruppo con le misure vere. */
export function creaModerno(id) {
  if (!_pronti.has(id)) {
    const voce = COLLEZIONE.find((c) => c.id === id);
    const p = voce ? Promise.resolve(voce.crea()).then((g) => { const b = new THREE.Box3().setFromObject(g); g.userData.dim = { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; return g; }) : Promise.reject(new Error('oggetto sconosciuto'));
    p.catch(() => _pronti.delete(id));
    _pronti.set(id, p);
  }
  return _pronti.get(id);
}
const _fatti = new Map();
/** In CUCINA: l'oggetto alle misure scelte; null finché non è pronto (poi quandoPronto()). */
export function oggettoModerno(id, misure, quandoPronto) {
  const t = _fatti.get(id);
  if (t && t !== 'attesa' && t !== 'errore') {
    // misure scelte in cucina rispetto a quelle del CATALOGO (uguali = grandezza vera)
    const g = t.clone(true), voce = COLLEZIONE.find((c) => c.id === id), m0 = voce ? voce.misure : null;
    if (misure && m0) g.scale.set((misure.w || m0.w) / m0.w, (misure.h || m0.h) / m0.h, (misure.d || m0.d) / m0.d);
    return g;
  }
  if (!t) { _fatti.set(id, 'attesa'); creaModerno(id).then((g) => { _fatti.set(id, g); if (quandoPronto) quandoPronto(); }).catch(() => _fatti.set(id, 'errore')); }
  return null;
}
