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
/** Legno disegnato (canvas): BAMBÙ (strisce fini e nodi) o ULIVO (crema con venature scure a onde).
 *  rip: ripetizioni per mm (lastre) o per unità di UV (tornio, con ripXY). */
function legnoDisegnato(tipo, rip, ripXY = null) {
  const k = `legno|${tipo}|${rip}|${ripXY}`;
  if (_tex.has(k)) return _tex.get(k);
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let s = tipo === 'bambu' ? 17 : 29; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (tipo === 'bambu') {
    g.fillStyle = '#d6b583'; g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x += 2) { g.fillStyle = `rgba(${120 + r() * 40},${80 + r() * 30},${30 + r() * 20},${0.06 + r() * 0.12})`; g.fillRect(x, 0, 1 + r() * 2, N); }
    for (let i = 0; i < 18; i++) { const x = r() * N; g.fillStyle = `rgba(150,105,55,${0.12 + r() * 0.15})`; g.fillRect(x, 0, 6 + r() * 10, N); }   // listelli
    for (const y of [N * 0.3, N * 0.78]) { g.fillStyle = 'rgba(120,80,40,0.35)'; g.fillRect(0, y, N, 3); g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(0, y + 3, N, 2); }   // nodi
  } else {
    // ULIVO: miele chiaro con bande morbide e venature scure ondulate (fitte, mai a "tratto di penna")
    g.fillStyle = '#d2b07e'; g.fillRect(0, 0, N, N);
    const onda = (y0, amp, fr, ph, x) => y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.3 + ph * 1.7) * amp * 0.35;
    g.filter = 'blur(6px)';
    for (let i = 0; i < 26; i++) {
      const y0 = r() * N, amp = 10 + r() * 30, fr = 0.008 + r() * 0.012, ph = r() * 6;
      g.strokeStyle = r() < 0.6 ? `rgba(120,80,40,${0.1 + r() * 0.15})` : `rgba(240,215,170,${0.15 + r() * 0.15})`; g.lineWidth = 10 + r() * 30; g.beginPath();
      for (let x = -8; x <= N + 8; x += 8) { const y = onda(y0, amp, fr, ph, x); if (x > -8) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    g.filter = 'blur(0.8px)';
    for (let i = 0; i < 120; i++) {
      const y0 = r() * N, amp = 6 + r() * 22, fr = 0.008 + r() * 0.016, ph = r() * 6, scura = r() < 0.35;
      g.strokeStyle = scura ? `rgba(70,45,22,${0.35 + r() * 0.35})` : `rgba(130,90,45,${0.12 + r() * 0.2})`; g.lineWidth = scura ? 1 + r() * 2.5 : 0.6 + r() * 1.5; g.beginPath();
      for (let x = -4; x <= N + 4; x += 4) { const y = onda(y0, amp, fr, ph, x); if (x > -4) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (ripXY) t.repeat.set(...ripXY); else t.repeat.set(rip, rip);
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
    case 'metallo-bianco': m = new THREE.MeshStandardMaterial({ color: 0xf1efea, metalness: 0.15, roughness: 0.45 }); break;
    case 'nero-satinato': m = new THREE.MeshStandardMaterial({ color: 0x0f0f10, metalness: 0.35, roughness: 0.5 }); break;
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
    // ---- legni chiari e naturali (texture disegnate qui: venature vere, nessun file) ----
    case 'bambu': m = new THREE.MeshStandardMaterial({ map: legnoDisegnato('bambu', 1 / 260), roughness: 0.55 }); break;
    case 'bambu-tornio': m = new THREE.MeshStandardMaterial({ map: legnoDisegnato('bambu', 1, [6, 1]), roughness: 0.55 }); break;
    case 'ulivo': m = new THREE.MeshStandardMaterial({ map: legnoDisegnato('ulivo', 1 / 320), roughness: 0.42 }); break;
    case 'ulivo-tornio': m = new THREE.MeshStandardMaterial({ map: legnoDisegnato('ulivo', 1, [3, 1]), roughness: 0.42 }); break;
    case 'rovere-tornio': m = new THREE.MeshStandardMaterial({ map: tex('rovere-nodoso.jpg', 1), roughness: 0.55 }); break;
    case 'intreccio': m = new THREE.MeshStandardMaterial({ color: 0xc9a46c, roughness: 0.7, emissive: 0x3a2408, emissiveIntensity: 0.25 }); break;
    case 'marmo-grande': m = new THREE.MeshStandardMaterial({ map: tex('compacto-bernini.jpg', 0.0008), roughness: 0.28 }); break;
    case 'marmo-nero-grande': m = new THREE.MeshStandardMaterial({ map: tex('compacto-negro.jpg', 0.0008), roughness: 0.22 }); break;
    case 'rovere-grande': m = new THREE.MeshStandardMaterial({ map: tex('rovere-nodoso.jpg', 0.0009), roughness: 0.5 }); break;
    case 'champagne': m = new THREE.MeshStandardMaterial({ color: 0xbfae8e, metalness: 1, roughness: 0.34, roughnessMap: grana(121, 10) }); break;
    case 'bronzo': m = new THREE.MeshStandardMaterial({ color: 0x5e4733, metalness: 1, roughness: 0.38, roughnessMap: grana(127, 10) }); break;
    case 'oro-satinato': m = new THREE.MeshStandardMaterial({ color: 0xc9a85e, metalness: 1, roughness: 0.27 }); break;
    case 'pietra-calda': m = new THREE.MeshStandardMaterial({ map: tex('compacto-siena.jpg', 0.0022), color: 0xc49a78, roughness: 0.3 }); break;
    case 'led': m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d2, emissiveIntensity: 1.8, roughness: 0.4 }); break;
    case 'velluto-sabbia': m = new THREE.MeshPhysicalMaterial({ color: 0xc9b79c, roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xf2e6d2), bumpMap: grana(131, 30), bumpScale: 0.4 }); break;
    case 'velluto-salvia': m = new THREE.MeshPhysicalMaterial({ color: 0x8e9a82, roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xd8e2cc), bumpMap: grana(137, 30), bumpScale: 0.4 }); break;
    case 'terracotta-bruna': m = new THREE.MeshStandardMaterial({ color: 0x74412f, roughness: 0.88, roughnessMap: grana(117), bumpMap: grana(117, 6), bumpScale: 0.8 }); break;
    case 'terracotta': m = new THREE.MeshStandardMaterial({ color: 0xb4643f, roughness: 0.92, roughnessMap: grana(61), bumpMap: grana(61, 5), bumpScale: 1.2 }); break;
    case 'cemento': m = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.95, roughnessMap: grana(67, 3), bumpMap: grana(67, 3), bumpScale: 2.5 }); break;
    case 'terriccio': m = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 1, bumpMap: grana(71, 12), bumpScale: 4 }); break;
    case 'corda': m = new THREE.MeshStandardMaterial({ color: 0xc8b089, roughness: 1, bumpMap: grana(73, 60), bumpScale: 1.5 }); break;
    case 'vetro-verde': m = new THREE.MeshPhysicalMaterial({ color: 0x2a4a2c, metalness: 0, roughness: 0.04, transmission: 0.55, thickness: 4, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.6, attenuationColor: new THREE.Color(0x0d2412), attenuationDistance: 12 }); break;
    case 'etichetta': m = new THREE.MeshStandardMaterial({ color: 0xebe3d1, roughness: 0.85, bumpMap: grana(79, 3), bumpScale: 0.3 }); break;
    case 'etichetta-scura': m = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.6 }); break;
    case 'capsula': m = new THREE.MeshStandardMaterial({ color: 0x4e1420, metalness: 0.55, roughness: 0.35 }); break;
    case 'formaggio': m = new THREE.MeshStandardMaterial({ color: 0xe9c870, roughness: 0.65, bumpMap: grana(83, 8), bumpScale: 1.5 }); break;
    case 'crosta': m = new THREE.MeshStandardMaterial({ color: 0xbf8f45, roughness: 0.85, bumpMap: grana(89, 6), bumpScale: 2 }); break;
    case 'acciaio-satinato': m = new THREE.MeshStandardMaterial({ color: 0xcfd1d4, metalness: 1, roughness: 0.36, roughnessMap: grana(97, 30) }); break;
    case 'gomma-nera': m = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.75 }); break;
    case 'quadrante': m = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.3 }); break;
    case 'ceramica-salvia': m = new THREE.MeshStandardMaterial({ color: 0x9aa58f, roughness: 0.7, roughnessMap: grana(101), bumpMap: grana(101), bumpScale: 0.5 }); break;
    case 'ceramica-terra': m = new THREE.MeshStandardMaterial({ color: 0xa4643f, roughness: 0.55, roughnessMap: grana(103), bumpMap: grana(103), bumpScale: 0.4 }); break;
    case 'ceramica-crema': m = new THREE.MeshStandardMaterial({ color: 0xe4dac6, roughness: 0.6, roughnessMap: grana(107), bumpMap: grana(107), bumpScale: 0.5 }); break;
    case 'marmo-bianco': m = new THREE.MeshStandardMaterial({ map: tex('compacto-bernini.jpg', 1), roughness: 0.35 }); break;
    case 'oliva': m = new THREE.MeshStandardMaterial({ color: 0x3d4a22, roughness: 0.3 }); break;
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
  const g = new THREE.LatheGeometry(v, seg); g.computeVertexNormals(); g.userData.profilo = v; return g;
}
/** Un solido al tornio visto dall'alto: l'altezza della superficie più alta a ogni raggio. */
function sopraTornio(v) {
  return (r) => {
    let h = -Infinity;
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1], b = v[i], lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      if (r < lo || r > hi) continue;
      const y = hi - lo < 1e-6 ? Math.max(a.y, b.y) : a.y + ((r - a.x) / (b.x - a.x)) * (b.y - a.y);
      if (y > h) h = y;
    }
    return h;
  };
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
/** Numeri "a caso" ma sempre uguali per lo stesso seme: un oggetto è identico in miniatura e in cucina. */
function generatore(seme) { let s = (seme % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const semeDi = (t) => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h; };
let rnd = generatore(7);

// ------------------------------------------------------------- frutta ----
const _frutti = new Map();
/** I frutti di una scansione (un file può averne più d'uno: le pere sono 5): ognuno centrato, in mm. */
async function frutto(id) {
  if (!_frutti.has(id)) {
    _frutti.set(id, (async () => {
      const { GLTFLoader } = await import('../vendor/three/addons/loaders/GLTFLoader.js');
      if (id.startsWith('proc:')) return [fruttoDisegnato(id.slice(5))];
      if (id.startsWith('lib:')) {
        // un modello della LIBRERIA (es. il pane), intero, alla scala chiesta: "lib:<id>@<scala>"
        const [nome, sc] = id.slice(4).split('@');
        const gl = await new GLTFLoader().loadAsync(qui(`../oggetti/libreria/${nome}.glb`));
        gl.scene.updateMatrixWorld(true);
        const g0 = new THREE.Group();
        gl.scene.traverse((o) => { if (o.isMesh) { const m = new THREE.Mesh(o.geometry, o.material); m.applyMatrix4(o.matrixWorld); g0.add(m); } });
        g0.scale.setScalar(1000 * (Number(sc) || 1)); g0.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(g0), c = b.getCenter(new THREE.Vector3());
        g0.position.sub(c);
        const g = new THREE.Group(); g.add(g0); g.userData.r = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2;
        return [g];
      }
      const gl = await new GLTFLoader().loadAsync(qui(`../oggetti/moderni/${id}/${id}.gltf`));
      gl.scene.updateMatrixWorld(true);
      const pezzi = [];
      gl.scene.traverse((o) => { if (o.isMesh) pezzi.push(o); });
      return pezzi.map((o) => {
        const m = new THREE.Mesh(o.geometry, o.material);
        m.applyMatrix4(o.matrixWorld); m.scale.multiplyScalar(1000); m.position.multiplyScalar(1000); m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
        m.position.sub(c);                                         // centrato: si gira bene
        // un frutto lungo e in piedi (avocado, pera lunga) si posa SDRAIATO, come succede davvero
        if (b.max.y - b.min.y > 1.3 * Math.max(b.max.x - b.min.x, b.max.z - b.min.z)) m.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        const g = new THREE.Group(); g.add(m); g.userData.r = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2;
        return g;
      });
    })());
  }
  return _frutti.get(id);
}
/** Buccia d'arancia: arancio con i pori (canvas), anche come rilievo. */
function bucciaArancia() {
  const k = 'buccia-arancia';
  if (_tex.has(k)) return _tex.get(k);
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#e57d1c'; g.fillRect(0, 0, N, N);
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? `rgba(160,70,0,${0.15 + r() * 0.25})` : `rgba(255,190,90,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(r() * N, r() * N, 0.6 + r() * 1.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.48, bumpMap: t, bumpScale: 1.2 });
  _tex.set(k, m); return m;
}
/** Frutti disegnati qui (non c'è una scansione libera): ARANCIA e GRAPPOLO d'uva (verde o nera), in mm, centrati. */
function fruttoDisegnato(tipo) {
  const g0 = new THREE.Group(); let r;
  if (tipo === 'arancia') {
    const a = new THREE.Mesh(new THREE.SphereGeometry(38, 48, 32), bucciaArancia()); a.scale.y = 0.93; g0.add(a);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 4, 10), new THREE.MeshStandardMaterial({ color: 0x5a6a2a, roughness: 0.8 })); p.position.y = 36; g0.add(p);
    r = 38;
  } else {
    // grappolo sdraiato lungo x: acini su un cono che si stringe verso la punta, raspo in mezzo
    const nera = tipo === 'uva-nera';
    const acino = new THREE.MeshPhysicalMaterial({ color: nera ? 0x2c1630 : 0x9db046, emissive: nera ? 0x000000 : 0x1a2206, roughness: nera ? 0.55 : 0.32, clearcoat: nera ? 0.1 : 0.3, clearcoatRoughness: 0.3, sheen: nera ? 1 : 0, sheenColor: new THREE.Color(0x8a8aa0) });
    const geo = new THREE.SphereGeometry(1, 20, 14), L = 135;
    let s = nera ? 41 : 43; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const posti = [];
    // acini FITTI: tanti tentativi, più fitti verso il centro e verso l'attacco (la parte larga)
    for (let i = 0; i < 6000 && posti.length < 80; i++) {
      const t = Math.pow(rr(), 0.8), raggio = (1 - t) * 26 + 6, a = rr() * Math.PI * 2, d = Math.pow(rr(), 0.7) * raggio, ra = 9 + rr() * 1.6;
      const P = V3(-L / 2 + t * L, Math.cos(a) * d * 0.8, Math.sin(a) * d);
      if (posti.some((q) => q.P.distanceTo(P) < (q.r + ra) * 0.9)) continue;
      posti.push({ P, r: ra });
    }
    for (const { P, r: ra } of posti) { const m = new THREE.Mesh(geo, acino); m.scale.set(ra, ra * 1.08, ra); m.position.copy(P); g0.add(m); }
    const raspo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-L / 2 - 26, 8, 0), V3(-L / 2 + 6, 3, 0), V3(L / 2 - 30, 0, 0)]), 16, 2.2, 6), mat('ramo'));
    g0.add(raspo);
    r = L / 2;
  }
  g0.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g0), c = b.getCenter(new THREE.Vector3()); g0.position.sub(c);
  const g = new THREE.Group(); g.add(g0); g.userData.r = r; return g;
}
/** L'impronta di un frutto (già ruotato) su una griglia di lato C: per ogni cella la quota
 *  più bassa (sotto) e più alta (sopra) della buccia, rispetto al centro del frutto. */
function impronta(fr, C) {
  fr.updateMatrixWorld(true);
  const pts = [], tri = [], v = new THREE.Vector3();
  fr.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, base = pts.length / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
    const idx = o.geometry.index;
    if (idx) for (let i = 0; i < idx.count; i++) tri.push(base + idx.getX(i));
    else for (let i = 0; i < p.count; i++) tri.push(base + i);
  });
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 2]); z1 = Math.max(z1, pts[i + 2]); }
  const i0 = Math.floor(x0 / C), j0 = Math.floor(z0 / C), nx = Math.floor(x1 / C) - i0 + 1, nz = Math.floor(z1 / C) - j0 + 1;
  const sotto = new Float32Array(nx * nz).fill(Infinity), sopra = new Float32Array(nx * nz).fill(-Infinity);
  const metti = (x, y, z) => {
    const k = (Math.floor(z / C) - j0) * nx + (Math.floor(x / C) - i0);
    if (y < sotto[k]) sotto[k] = y; if (y > sopra[k]) sopra[k] = y;
  };
  for (let i = 0; i < pts.length; i += 3) metti(pts[i], pts[i + 1], pts[i + 2]);
  // i triangoli: ogni centro di cella che cade dentro (visto dall'alto) prende la quota del triangolo
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const ax = pts[a], az = pts[a + 2], bx = pts[b], bz = pts[b + 2], cx = pts[c], cz = pts[c + 2];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) continue;
    const ia = Math.floor(Math.min(ax, bx, cx) / C), ib = Math.floor(Math.max(ax, bx, cx) / C);
    const ja = Math.floor(Math.min(az, bz, cz) / C), jb = Math.floor(Math.max(az, bz, cz) / C);
    for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
      const px = (i + 0.5) * C, pz = (j + 0.5) * C;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      metti(px, l1 * pts[a + 1] + l2 * pts[b + 1] + l3 * pts[c + 1], pz);
    }
  }
  return { i0, j0, nx, nz, sotto, sopra, mezzo: Math.max(x1 - x0, z1 - z0) / 2 };
}
/** Riempie una ciotola con la frutta, come se ogni frutto ci CADESSE dentro: si posa nel punto
 *  più basso che trova, appoggiato davvero (sul fondo, sulla parete o sugli altri frutti), mai
 *  sospeso e mai dentro un altro. superficie(r) = quota della ciotola al raggio r (vista dall'alto,
 *  -Infinity fuori); bordo = raggio della ciotola: il CENTRO del frutto resta sopra la ciotola,
 *  il frutto può sporgere un poco oltre il bordo (come nella realtà), mai più di SPORGE. */
async function riempi(gruppo, tipi, superficie, bordo, quanti) {
  const perTipo = await Promise.all(tipi.map(frutto));
  const rnd = generatore(semeDi(tipi.join('|') + quanti));      // la sua sequenza: non dipende da cosa si crea insieme
  const SPORGE = 30, C = 2.5, n = Math.ceil((bordo + SPORGE) / C), lato = 2 * n;
  // mappa delle altezze: ciotola, poi a mano a mano anche i frutti posati
  const H = new Float32Array(lato * lato);
  for (let j = 0; j < lato; j++) for (let i = 0; i < lato; i++) {
    const r = Math.hypot((i - n + 0.5) * C, (j - n + 0.5) * C);
    H[j * lato + i] = r > bordo + SPORGE ? NaN : superficie(r);
  }
  const AFFONDA = 0.8;                                             // il frutto "siede" (niente fessura di luce)
  for (let q = 0; q < quanti; q++) {
    const lista = perTipo[q % perTipo.length], m = lista[Math.floor(q / perTipo.length) % lista.length];
    // la quota a cui il frutto si ferma con il centro sulla cella (oi, oj); null = sporgerebbe
    const caduta = (imp, oi, oj) => {
      let y = -Infinity;
      for (let j = 0; j < imp.nz; j++) for (let i = 0; i < imp.nx; i++) {
        const s = imp.sotto[j * imp.nx + i]; if (s === Infinity) continue;
        const gi = imp.i0 + i + oi + n, gj = imp.j0 + j + oj + n;
        if (gi < 0 || gj < 0 || gi >= lato || gj >= lato) return null;
        const h = H[gj * lato + gi]; if (Number.isNaN(h)) return null;
        if (h - s > y) y = h - s;
      }
      return y === -Infinity ? null : y;
    };
    let best = null;
    const prova = (f, imp, oi, oj) => {
      // il centro del frutto sopra la ciotola, con un margine di mezzo frutto
      if (Math.hypot(oi, oj) * C > bordo - imp.mezzo * 0.5) return;
      const y = caduta(imp, oi, oj); if (y === null) return;
      const voto = y + 0.04 * Math.hypot(oi, oj) * C + rnd() * 0.5;   // a parità d'altezza, verso il centro
      if (!best || voto < best.voto) best = { voto, y: y - AFFONDA, oi, oj, f, imp };
    };
    // si prova TUTTA la ciotola (passo di 3 celle), in 3 giri diversi, poi si rifinisce il punto migliore
    for (let giro = 0; giro < 3; giro++) {
      const f = m.clone(true);
      f.rotation.set(rnd() * 0.5 - 0.25, rnd() * Math.PI * 2, rnd() * 0.5 - 0.25);
      const imp = impronta(f, C), sfasa = Math.floor(rnd() * 3);
      for (let oj = -n + sfasa; oj < n; oj += 3) for (let oi = -n + sfasa; oi < n; oi += 3) prova(f, imp, oi, oj);
    }
    if (best) { const { f, imp, oi: bi, oj: bj } = best; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) prova(f, imp, bi + di, bj + dj); }
    if (!best) continue;                                           // non c'è più posto
    const { f, imp, oi, oj, y } = best;
    f.position.set(oi * C, y, oj * C); gruppo.add(f);
    for (let j = 0; j < imp.nz; j++) for (let i = 0; i < imp.nx; i++) {
      const s = imp.sopra[j * imp.nx + i]; if (s === -Infinity) continue;
      const k = (imp.j0 + j + oj + n) * lato + (imp.i0 + i + oi + n);
      if (y + s > H[k]) H[k] = y + s;
    }
  }
}

// ------------------------------------------------------------- oggetti ----
/** Fruttiera bassa e larga (Ø 320) in pietra o ceramica, piena di frutta vera. */
async function fruttiera(materiale, frutti, quanti) {
  const g = new THREE.Group();
  const prof = [[0, 0], [62, 0], [66, 6], [64, 12], [95, 20], [128, 38], [152, 62], [160, 82], [157, 86], [151, 83], [143, 64], [118, 42], [84, 27], [45, 20], [0, 18]];
  const geo = tornio(prof, 128);
  g.add(new THREE.Mesh(geo, mat(materiale)));
  await riempi(g, frutti, sopraTornio(geo.userData.profilo), 158, quanti);
  return ombre(g);
}
/** LUXURY — alzata in ottone spazzolato con frutta mista. */
async function alzata() {
  const g = new THREE.Group();
  const prof = [[0, 0], [72, 0], [74, 5], [62, 10], [16, 15], [11, 28], [10, 105], [14, 114], [42, 119], [100, 125], [138, 134], [150, 147], [147, 150], [135, 139], [96, 130], [40, 125], [0, 124]];
  const geo = tornio(prof, 128);
  g.add(new THREE.Mesh(geo, mat('ottone-spazzolato')));
  await riempi(g, ['food_pomegranate_01', 'lemon', 'food_apple_01', 'food_lime_01', 'food_pears_asian_01'], sopraTornio(geo.userData.profilo), 150, 5);
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
function lampada(tipo, soffitto = SOFFITTO) {
  const g = new THREE.Group(), y0 = Y_LAMPADA, cavo = soffitto - Y_LAMPADA - 190 - 22;
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
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; x.userData.senzaOmbra = true; } });
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

// ------------------------------------------------------- legno e bambù ----
// Oggetti in legno (rovere, ulivo) e bambù: il tocco caldo che stacca su cucine chiare e scure.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** Tutto il gruppo appoggiato a y = 0 e centrato in x/z. */
function centra(g) {
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3());
  for (const ch of g.children) ch.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  return g;
}
/** Cilindro (anche rastremato) da a a b. */
function asta(a, b, r0, r1, materiale, lati = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), lati), mat(materiale));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
/** Tubo rastremato lungo una curva (tronchi e rami). */
function tuboRastremato(curva, r0, r1, segL = 48, segR = 10) {
  const fr = curva.computeFrenetFrames(segL, false), pos = [], ind = [], uv = [];
  for (let i = 0; i <= segL; i++) {
    const t = i / segL, P = curva.getPointAt(t), r = r0 + (r1 - r0) * t, N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= segR; j++) {
      const a = (j / segR) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(P.x + r * (c * N.x + s * B.x), P.y + r * (c * N.y + s * B.y), P.z + r * (c * N.z + s * B.z)); uv.push(j / segR, t * 4);
    }
  }
  for (let i = 0; i < segL; i++) for (let j = 0; j < segR; j++) { const a = i * (segR + 1) + j, b = a + segR + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
  return g;
}
/** Foglie su un ramo (a coppie o alterne): matrici per un InstancedMesh. */
function foglieSu(curva, n, { da = 0.15, sx = 1, sy = 1, apri = 0.8, coppie = true, alterna = 1.35 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = da + (i / n) * (1 - da), P = curva.getPointAt(t), T = curva.getTangentAt(t);
    for (const lato of coppie ? [-1, 1] : [i % 2 ? 1 : -1]) {
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), T);
      const giro = new THREE.Quaternion().setFromAxisAngle(T, i * alterna + rnd() * 0.3 + (lato > 0 ? Math.PI : 0));
      const ap = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), apri + rnd() * 0.4 - t * 0.2);
      const k = 0.8 + rnd() * 0.4;
      out.push({ m: new THREE.Matrix4().compose(P, giro.multiply(q).multiply(ap), V3(sx * k, sy * k, k)), c: rnd() });
    }
  }
  return out;
}
function foglieMesh(lista, geo, c1, c2) {
  const im = new THREE.InstancedMesh(geo, mat('foglia-ulivo'), lista.length), a = new THREE.Color(c1), b = new THREE.Color(c2), tmp = new THREE.Color();
  lista.forEach((f, i) => { im.setMatrixAt(i, f.m); im.setColorAt(i, tmp.copy(a).lerp(b, f.c)); });
  im.castShadow = true; im.receiveShadow = true; return im;
}
let _tonda = null;
/** Foglia tonda (eucalipto), appena a coppa. */
function geoFogliaTonda() {
  if (_tonda) return _tonda;
  const g = new THREE.CircleGeometry(16, 14); g.translate(0, 16, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - 16; p.setZ(i, (x * x + y * y) * 0.006); }
  g.computeVertexNormals(); _tonda = g; return g;
}
/** Tagliere: rettangolo arrotondato con manico (verso +x) e foro. */
function formaTagliere(w, d, lm = 70, rm = 22, r = 24) {
  const s = new THREE.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, -rm - 10); s.quadraticCurveTo(x1, -rm, x1 + 14, -rm); s.lineTo(x1 + lm - rm, -rm); s.absarc(x1 + lm - rm, 0, rm, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(x1 + 14, rm); s.quadraticCurveTo(x1, rm, x1, rm + 10);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const foro = new THREE.Path(); foro.absarc(x1 + lm - rm, 0, 9, 0, Math.PI * 2, true); s.holes.push(foro);
  return s;
}
/** Lastra IN PIEDI: forma nel piano x-y (manico in alto), spessa sp verso -z (schiena a z = 0 → -sp). */
function lastraInPiedi(shape, sp, smusso = 1.5) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: sp - 2 * smusso, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 3, curveSegments: 24 });
  g.translate(0, 0, -(sp - smusso)); g.computeVertexNormals(); return g;
}
/** 1 — Due taglieri appoggiati al muro: rovere grande dietro, bambù davanti (manico in alto). */
function taglieriMuro() {
  const g = new THREE.Group();
  const tagliere = (larg, alt, sp, materiale, lean, x, z) => {
    const geo = lastraInPiedi(formaTagliere(alt, larg, 80, 24), sp); geo.rotateZ(Math.PI / 2);   // manico in alto
    geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0);
    const t = new THREE.Mesh(geo, mat(materiale)); t.rotation.x = -lean; t.position.set(x, 0, z); g.add(t);
  };
  tagliere(300, 420, 22, 'rovere', 0.2, -35, -20);       // dietro, più alto, più inclinato
  tagliere(240, 330, 16, 'bambu', 0.13, 55, 30);         // davanti
  return ombre(centra(g));
}
/** Bottiglia d'olio in vetro (per vassoi). */
function bottigliaOlio(alt = 260, r = 30) {
  const b = new THREE.Group();
  const prof = [[0, 0], [r, 0], [r + 2, 4], [r + 2, alt * 0.62], [r - 4, alt * 0.74], [12, alt * 0.86], [11, alt * 0.97], [12, alt], [9, alt], [8, alt * 0.97], [9, alt * 0.86], [r - 6, alt * 0.74], [r - 1, alt * 0.62], [r - 1, 5], [0, 4]];
  b.add(new THREE.Mesh(tornio(prof, 64), mat('vetro')));
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(r - 1.5, r - 1.5, alt * 0.52, 48), mat('olio')); liq.position.y = 5 + alt * 0.26; b.add(liq);
  const tappo = new THREE.Mesh(tornio([[0, 0], [9, 0], [10, 10], [7, 24], [0, 26]], 32, false), mat('ulivo-tornio')); tappo.position.y = alt - 4; b.add(tappo);
  return b;
}
/** 2 — Vassoio in bambù con olio, sale e macinapepe in legno d'ulivo. */
function vassoioBambu() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(rettTondo(380, 170, 16), 10, 1.5), mat('bambu')));
  const bordo = rettTondo(380, 170, 16); bordo.holes.push(rettTondo(364, 154, 9));
  g.add(new THREE.Mesh(lastra(bordo, 30, 1.5), mat('bambu')));
  const o = bottigliaOlio(270, 30); o.position.set(-110, 10, 0); g.add(o);
  const mac = new THREE.Mesh(tornio([[0, 0], [26, 0], [28, 6], [24, 40], [20, 90], [21, 140], [26, 165], [27, 185], [22, 195], [9, 200], [10, 214], [0, 216]], 64), mat('ulivo-tornio'));
  mac.position.set(10, 10, -10); g.add(mac);
  const sale = new THREE.Group();
  sale.add(new THREE.Mesh(tornio([[0, 0], [30, 0], [36, 8], [40, 40], [37, 42], [33, 10], [0, 8]], 64), mat('ulivo-tornio')));
  const cop = new THREE.Mesh(tornio([[0, 0], [41, 0], [42, 6], [38, 9], [8, 10], [8, 22], [5, 24], [0, 24]], 64), mat('ulivo-tornio')); cop.position.y = 41; sale.add(cop);
  sale.position.set(105, 10, 10); g.add(sale);
  return ombre(centra(g));
}
/** Mestolo / spatola in legno d'ulivo, dalla punta del manico (y = 0) in su. */
function mestolo(tipo, L = 310) {
  const u = new THREE.Group();
  const manico = new THREE.Mesh(new THREE.CylinderGeometry(9, 6, L * 0.68, 20), mat('ulivo-tornio')); manico.position.y = L * 0.34; u.add(manico);
  if (tipo === 'cucchiaio') {
    const testa = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('ulivo-tornio'));
    testa.scale.set(1, 0.32, 1.45); testa.rotation.x = Math.PI / 2; testa.position.y = L * 0.68 + 38; u.add(testa);
  } else {
    const pala = new THREE.Mesh(lastra(rettTondo(62, 96, 20), 6, 1.5), mat('ulivo')); pala.rotation.x = Math.PI / 2; pala.position.set(0, L * 0.68 + 48, 3); u.add(pala);
  }
  return u;
}
/** 3 — Portamestoli in ceramica crema con mestoli e spatole in legno d'ulivo. */
function portamestoli() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tornio([[0, 0], [60, 0], [63, 4], [64, 90], [66, 170], [62, 172], [58, 168], [57, 14], [0, 12]], 96), mat('ceramica-crema')));
  const tipi = ['cucchiaio', 'spatola', 'cucchiaio', 'spatola', 'cucchiaio'];
  tipi.forEach((t, i) => {
    const a = (i / tipi.length) * Math.PI * 2 + 0.4, u = mestolo(t, 300 + (i % 3) * 18);
    u.rotation.set(Math.sin(a) * 0.2, a, Math.cos(a) * 0.2); u.position.set(Math.cos(a) * 14, 14, Math.sin(a) * 14); g.add(u);
  });
  return ombre(g);
}
/** 4 — Ciotola in legno d'ulivo piena di limoni (appoggiati davvero). */
async function ciotolaUlivo() {
  const g = new THREE.Group();
  const geo = tornio([[0, 0], [70, 0], [74, 4], [110, 30], [138, 62], [148, 90], [144, 94], [136, 89], [126, 62], [100, 35], [64, 17], [0, 15]], 128);
  g.add(new THREE.Mesh(geo, mat('ulivo-tornio')));
  await riempi(g, ['lemon'], sopraTornio(geo.userData.profilo), 146, 10);
  return ombre(g);
}
let _trama = null;
/** Intreccio (cesti): strisce che passano sopra e sotto. */
function trama() {
  if (_trama) return _trama;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#6e4f2c'; g.fillRect(0, 0, N, N);
  const S = 32;
  for (let y = 0; y < N; y += S) for (let x = 0; x < N; x += S) {
    const su = ((x + y) / S) % 2 === 0, gr = g.createLinearGradient(x, y, su ? x + S : x, su ? y : y + S);
    gr.addColorStop(0, '#b48a55'); gr.addColorStop(0.5, '#dcb98a'); gr.addColorStop(1, '#b48a55');
    g.fillStyle = gr; if (su) g.fillRect(x + 1, y + 3, S - 2, S - 6); else g.fillRect(x + 3, y + 1, S - 6, S - 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(26, 4); t.anisotropy = 8;
  _trama = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, bumpMap: t, bumpScale: 2 }); return _trama;
}
/** 5 — Cesto in bambù intrecciato con il pane (pane vero, scansionato). */
async function cestoPane() {
  const g = new THREE.Group();
  const geo = tornio([[0, 0], [110, 0], [118, 6], [140, 60], [152, 112], [147, 116], [140, 110], [128, 60], [108, 12], [0, 10]], 96);
  g.add(new THREE.Mesh(geo, trama()));
  const orlo = new THREE.Mesh(new THREE.TorusGeometry(149, 5, 10, 96), mat('bambu-tornio')); orlo.rotation.x = Math.PI / 2; orlo.position.y = 114; g.add(orlo);
  await riempi(g, ['lib:skf95a2e18@0.62', 'lib:sk35c647c3@0.6'], sopraTornio(geo.userData.profilo), 146, 3);
  return ombre(g);
}
/** Spicchio di formaggio (crosta sull'arco). */
function spicchio(r, ang, h) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, r, -ang / 2, ang / 2, false); s.lineTo(0, 0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(s, h, 1), mat('formaggio')));
  const crosta = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 1.5, h - 1, 24, 1, true, Math.PI / 2 - ang / 2, ang), mat('crosta'));
  crosta.position.y = h / 2; g.add(crosta);
  return g;
}
/** 6 — Tagliere in ulivo con pane, formaggi e olive. */
async function tagliereFormaggi() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(formaTagliere(420, 280, 80, 24), 22, 2), mat('ulivo')));
  const [pane] = await frutto('lib:skf95a2e18@0.78');
  const p = pane.clone(true); p.updateMatrixWorld(true);
  const bp = new THREE.Box3().setFromObject(p); p.position.set(-95, 22 - bp.min.y - 1, -20); p.rotation.y = 0.4; g.add(p);
  const s1 = spicchio(95, 0.75, 58); s1.position.set(60, 22, -60); s1.rotation.y = 2.2; g.add(s1);
  const s2 = spicchio(80, 0.6, 48); s2.position.set(120, 22, 40); s2.rotation.y = -2.4; g.add(s2);
  const tondo = new THREE.Group();
  tondo.add(new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 36, 48), mat('crosta')));
  const fetta = new THREE.Mesh(new THREE.CylinderGeometry(44.5, 44.5, 36.5, 48, 1, false, 0, 0.9), mat('formaggio')); tondo.add(fetta);
  tondo.position.set(10, 22 + 18, 80); g.add(tondo);
  const ciot = new THREE.Group();
  const cg = tornio([[0, 0], [26, 0], [30, 3], [44, 20], [48, 34], [45, 35], [41, 21], [27, 8], [0, 6]], 64);
  ciot.add(new THREE.Mesh(cg, mat('ceramica-salvia')));
  for (let i = 0; i < 9; i++) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), mat('oliva')); o.scale.set(1, 0.8, 1.35);
    const a = i * 2.4, rr = i < 6 ? 22 : 8; o.position.set(Math.cos(a) * rr, 14 + (i < 6 ? 2 : 11), Math.sin(a) * rr); o.rotation.y = a; ciot.add(o);
  }
  ciot.position.set(-150, 22, 95); g.add(ciot);
  return ombre(centra(g));
}
/** Rametto di basilico: gambo e foglie larghe a coppie. */
function basilico(base, dir, h, foglie) {
  const fine = base.clone().add(dir.clone().multiplyScalar(h));
  const curva = new THREE.CatmullRomCurve3([base, base.clone().lerp(fine, 0.5).add(V3(rnd() * 10 - 5, 0, rnd() * 10 - 5)), fine]);
  foglie.push(...foglieSu(curva, 4 + Math.floor(rnd() * 3), { da: 0.3, sx: 2.6, sy: 0.75, apri: 0.9, alterna: Math.PI / 2 }));
  return new THREE.Mesh(new THREE.TubeGeometry(curva, 12, 2, 6), mat('stelo'));
}
/** 7 — Mortaio in marmo con pestello e basilico. */
function mortaio() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tornio([[0, 0], [58, 0], [66, 6], [74, 40], [76, 82], [72, 92], [64, 94], [60, 86], [54, 52], [38, 32], [0, 28]], 96), mat('marmo-bianco')));
  const pest = new THREE.Mesh(tornio([[0, 0], [16, 2], [20, 14], [17, 40], [13, 110], [15, 150], [12, 168], [0, 170]], 48), mat('marmo-bianco'));
  pest.position.set(10, 30, 6); pest.rotation.set(0.15, 0, -0.55); g.add(pest);
  const foglie = [];
  for (let i = 0; i < 3; i++) { const a = 2.2 + i * 0.5; g.add(basilico(V3(-10 + i * 8, 40, -8), V3(Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.5).normalize(), 120 + i * 20, foglie)); }
  // un rametto appoggiato sul piano, accanto
  g.add(basilico(V3(70, 4, 50), V3(1, 0.02, 0.4).normalize(), 130, foglie));
  g.add(foglieMesh(foglie, geoFoglia(), 0x2f6b22, 0x5c9a3a));
  return ombre(centra(g));
}
/** Vasetto di terracotta con il terriccio (r = raggio alla bocca). */
function vasetto(r = 62, h = 112) {
  const v = new THREE.Group();
  v.add(new THREE.Mesh(tornio([[0, 0], [r * 0.78, 0], [r * 0.8, 4], [r * 0.95, h - 22], [r + 3, h - 20], [r + 4, h], [r - 3, h], [r - 4, h - 18], [r * 0.74, 10], [0, 8]], 72, false), mat('terracotta')));
  const t = new THREE.Mesh(new THREE.CircleGeometry(r - 5, 40).rotateX(-Math.PI / 2), mat('terriccio')); t.position.y = h - 14; v.add(t);
  return v;
}
/** 8 — Tre erbe aromatiche (basilico, rosmarino, timo) in terracotta su un vassoio di legno. */
function erbe() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(rettTondo(450, 170, 14), 14, 1.5), mat('rovere')));
  const xs = [-140, 0, 140], h = 112, y0 = 14 + h - 14;
  xs.forEach((x) => { const v = vasetto(62, h); v.position.set(x, 14, 0); g.add(v); });
  const fBas = [], fRos = [], fTim = [];
  for (let i = 0; i < 7; i++) { const a = i * 2.4; g.add(basilico(V3(xs[0] + Math.cos(a) * 18, y0, Math.sin(a) * 18), V3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize(), 120 + rnd() * 80, fBas)); }
  for (let i = 0; i < 11; i++) {
    const a = i * 2.1, b = V3(xs[1] + Math.cos(a) * 20, y0, Math.sin(a) * 20), hh = 220 + rnd() * 110;
    const curva = new THREE.CatmullRomCurve3([b, b.clone().add(V3(Math.cos(a) * 15, hh * 0.5, Math.sin(a) * 15)), b.clone().add(V3(Math.cos(a) * 35, hh, Math.sin(a) * 35))]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 1.8, 5), mat('ramo')));
    fRos.push(...foglieSu(curva, 34, { da: 0.12, sx: 0.28, sy: 0.4, apri: 0.7, coppie: true, alterna: 2.1 }));
  }
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39, b = V3(xs[2] + Math.cos(a) * 25, y0, Math.sin(a) * 25), hh = 80 + rnd() * 70, fuori = 0.6 + rnd() * 0.5;
    const curva = new THREE.CatmullRomCurve3([b, b.clone().add(V3(Math.cos(a) * 25 * fuori, hh * 0.6, Math.sin(a) * 25 * fuori)), b.clone().add(V3(Math.cos(a) * 55 * fuori, hh, Math.sin(a) * 55 * fuori))]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 10, 1, 4), mat('ramo')));
    fTim.push(...foglieSu(curva, 14, { da: 0.2, sx: 0.55, sy: 0.17, apri: 0.9, alterna: 1.6 }));
  }
  g.add(foglieMesh(fBas, geoFoglia(), 0x2f6b22, 0x5c9a3a));
  g.add(foglieMesh(fRos, geoFoglia(), 0x3f5a3e, 0x7e927a));
  g.add(foglieMesh(fTim, geoFoglia(), 0x4d6644, 0x839a72));
  return ombre(centra(g));
}
/** 9 — Ulivo grande (170 cm) in vaso di cemento, a terra. */
function ulivoGrande() {
  const g = new THREE.Group(), H = 460;
  g.add(new THREE.Mesh(tornio([[0, 0], [190, 0], [196, 6], [222, H - 30], [236, H - 26], [238, H], [222, H], [208, H - 26], [184, 14], [0, 12]], 96, false), mat('cemento')));
  const t = new THREE.Mesh(new THREE.CircleGeometry(214, 48).rotateX(-Math.PI / 2), mat('terriccio')); t.position.y = H - 40; g.add(t);
  // tronco contorto che si apre in rami
  const y0 = H - 40, tronco = new THREE.CatmullRomCurve3([V3(0, y0 - 20, 0), V3(25, y0 + 200, 10), V3(-15, y0 + 420, -10), V3(10, y0 + 600, 15)]);
  const corteccia = new THREE.MeshStandardMaterial({ color: 0x6d6456, roughness: 1, bumpMap: grana(113, 3), bumpScale: 6 });
  g.add(new THREE.Mesh(tuboRastremato(tronco, 42, 24, 40, 12), corteccia));
  const foglie = [], top = tronco.getPointAt(1);
  const nRami = 7;
  for (let b = 0; b < nRami; b++) {
    const a = (b / nRami) * Math.PI * 2 + rnd() * 0.5, sp = 300 + rnd() * 200, h = 330 + rnd() * 420;
    const pts = [top.clone()];
    for (let k = 1; k <= 4; k++) { const t2 = k / 4, cr = sp * Math.pow(t2, 1.1); pts.push(V3(top.x + Math.cos(a + t2 * 0.5) * cr, top.y + h * t2 - sp * 0.15 * t2 * t2, top.z + Math.sin(a + t2 * 0.5) * cr)); }
    const ramo = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(tuboRastremato(ramo, 18, 4, 30, 8), corteccia));
    foglie.push(...foglieSu(ramo, 55, { da: 0.25, sx: 1.05, sy: 1.05, apri: 0.75 }));
    // rametti laterali
    for (let k = 0; k < 6; k++) {
      const t2 = 0.3 + k * 0.11, P = ramo.getPointAt(t2), d = ramo.getTangentAt(t2), lat = V3(-d.z, 0.3, d.x).normalize().multiplyScalar(k % 2 ? 1 : -1);
      const fine = P.clone().add(lat.multiplyScalar(160 + rnd() * 120)).add(V3(0, 90 + rnd() * 120, 0));
      const r2 = new THREE.CatmullRomCurve3([P, P.clone().lerp(fine, 0.5).add(V3(0, 30, 0)), fine]);
      g.add(new THREE.Mesh(tuboRastremato(r2, 5, 2, 12, 6), corteccia));
      foglie.push(...foglieSu(r2, 24, { da: 0.12, sx: 1, sy: 1, apri: 0.8 }));
    }
  }
  g.add(foglieMesh(foglie, geoFoglia(), 0x55634a, 0xa8b29c));
  return ombre(centra(g));
}
/** 10 — Rami di eucalipto in una bottiglia di vetro. */
function eucalipto() {
  const g = new THREE.Group(), alt = 290;
  g.add(new THREE.Mesh(tornio([[0, 0], [48, 0], [50, 4], [50, 170], [44, 200], [20, 240], [17, alt - 10], [19, alt], [15, alt], [14, alt - 10], [16, 240], [40, 200], [47, 170], [47, 6], [0, 5]], 72), mat('vetro')));
  const acqua = new THREE.Mesh(new THREE.CylinderGeometry(46.5, 46.5, 120, 48), mat('acqua')); acqua.position.y = 65; g.add(acqua);
  const foglie = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.4, h = 420 + rnd() * 260, ap = 90 + rnd() * 140;
    const b = V3(Math.cos(a) * 6, 150, Math.sin(a) * 6);
    const curva = new THREE.CatmullRomCurve3([b, V3(Math.cos(a) * 12, alt + 20, Math.sin(a) * 12), V3(Math.cos(a) * ap * 0.6, alt + h * 0.6, Math.sin(a) * ap * 0.6), V3(Math.cos(a) * ap, alt + h - ap * 0.2, Math.sin(a) * ap)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 30, 1.8, 5), mat('stelo')));
    foglie.push(...foglieSu(curva, 16, { da: 0.4, sx: 1, sy: 1, apri: 1.0, coppie: true, alterna: Math.PI / 2 }));
  }
  g.add(foglieMesh(foglie, geoFogliaTonda(), 0x7f968b, 0xb2c2b8));
  return ombre(centra(g));
}
/** Paralume intrecciato: spirali nei due versi su una superficie al tornio r(t), y(t), t in [0,1]. */
function intrecciato(rDi, yDi, nSp = 18, giri = 0.55) {
  const g = new THREE.Group(), m = mat('intreccio');
  for (const verso of [1, -1]) for (let i = 0; i < nSp; i++) {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, a = (i / nSp) * Math.PI * 2 + verso * t * giri * Math.PI * 2, r = rDi(t) + (verso > 0 ? 1.6 : -1.6) * Math.sin(t * 40);
      pts.push(V3(Math.cos(a) * r, yDi(t), Math.sin(a) * r));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 2.6, 5), m));
  }
  for (const t of [0, 1]) { const anello = new THREE.Mesh(new THREE.TorusGeometry(rDi(t), 4, 8, 64), mat('bambu-tornio')); anello.rotation.x = Math.PI / 2; anello.position.y = yDi(t); g.add(anello); }
  return g;
}
/** 11 / 12 — Sospensione in bambù intrecciato (sfera o campana): corpo a 165 cm, cavo fino al soffitto. */
function lampadaBambu(forma, soffitto = SOFFITTO) {
  const g = new THREE.Group();
  let hCorpo;
  if (forma === 'sfera') {
    const R = 215, t0 = 0.07;
    g.add(intrecciato((t) => R * Math.sin(Math.PI * (t0 + t * (1 - 2 * t0))), (t) => R - R * Math.cos(Math.PI * (t0 + t * (1 - 2 * t0))), 20, 0.5));
    hCorpo = 2 * R * Math.cos(Math.PI * t0) / 2 + R; hCorpo = R - R * Math.cos(Math.PI * (1 - t0));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(34, 24, 16), mat('luce-calda')); lamp.position.y = R; g.add(lamp);
  } else {
    const H = 300;
    g.add(intrecciato((t) => 235 - 195 * Math.pow(t, 0.7), (t) => H * t, 22, 0.45));
    hCorpo = H;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(34, 24, 16), mat('luce-calda')); lamp.position.y = H * 0.55; g.add(lamp);
  }
  const cavo = soffitto - Y_LAMPADA - hCorpo - 22;
  const filo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, cavo, 8), mat('cavo')); filo.position.y = hCorpo + cavo / 2; g.add(filo);
  const rosone = new THREE.Mesh(tornio([[0, 0], [55, 0], [60, 6], [60, 24], [0, 24]], 64, false), mat('bambu-tornio')); rosone.position.y = hCorpo + cavo - 2; g.add(rosone);
  g.children.forEach((c) => { c.position.y += Y_LAMPADA; });
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; x.userData.senzaOmbra = true; } });
  return g;
}
/** 13 — Sgabello alto in rovere con la seduta intrecciata in corda (seduta a 66 cm). */
function sgabelloCorda() {
  const g = new THREE.Group(), H = 660, L = 380, legno = 'rovere-tornio';
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const gamba = asta(V3(sx * (L / 2 + 22), 0, sz * (L / 2 + 22)), V3(sx * (L / 2 - 14), H, sz * (L / 2 - 14)), 15, 22, legno, 4);
    gamba.rotateY(Math.PI / 4); g.add(gamba);
  }
  // telaio della seduta e traversi
  for (const [a, b, y, r] of [[[-1, -1], [1, -1], H - 24, 18], [[1, -1], [1, 1], H - 24, 18], [[1, 1], [-1, 1], H - 24, 18], [[-1, 1], [-1, -1], H - 24, 18],
    [[-1, 1], [1, 1], 270, 14], [[-1, -1], [1, -1], 330, 12], [[-1, -1], [-1, 1], 300, 12], [[1, -1], [1, 1], 300, 12]]) {
    const k = (y / H) * -36 + 22 + 14 * 0;
    const off = L / 2 + 22 - (36 * y) / H;
    g.add(asta(V3(a[0] * off, y, a[1] * off), V3(b[0] * off, y, b[1] * off), r, r, legno, 12)); void k;
  }
  // la corda: trama e ordito che passano sopra e sotto
  const sp = 9, n = Math.floor((L - 30) / sp), y = H - 18;
  for (const asse of ['x', 'z']) for (let i = 0; i < n; i++) {
    const c = -((n - 1) * sp) / 2 + i * sp, pts = [];
    for (let k = 0; k <= 60; k++) {
      const u = -L / 2 + 6 + (k / 60) * (L - 12), onda = 2.4 * Math.sin((u / sp) * Math.PI + (i % 2 ? Math.PI : 0)) * (asse === 'x' ? 1 : -1);
      pts.push(asse === 'x' ? V3(u, y + onda, c) : V3(c, y + onda, u));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 3.4, 6), mat('corda')));
  }
  return ombre(centra(g));
}
/** 14 — Pila di ciotole in ceramica (salvia, crema, terra, nera), una dentro l'altra. */
function ciotolePila() {
  const g = new THREE.Group();
  const prof = [[0, 0], [40, 0], [44, 4], [70, 28], [88, 58], [90, 63], [86, 64], [82, 58], [66, 31], [40, 10], [0, 8]];
  ['ceramica-nera', 'ceramica-terra', 'ceramica-crema', 'ceramica-salvia'].forEach((m, i) => {
    const c = new THREE.Mesh(tornio(prof.map(([r, y]) => [r * (1 - i * 0.02), y]), 96), mat(m)); c.position.y = i * 13; c.rotation.y = rnd() * 6; g.add(c);
  });
  return ombre(g);
}
/** 15 — Macchina da espresso in acciaio satinato, portafiltro con manico in legno d'ulivo. */
function espresso() {
  const g = new THREE.Group(), W = 300, D = 380, H = 390;
  const corpo = new THREE.Mesh(lastra(rettTondo(W, D, 18), H - 20, 3), mat('acciaio-satinato')); corpo.position.y = 20; g.add(corpo);
  for (const [x, z] of [[-120, -160], [120, -160], [120, 160], [-120, 160]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 20, 20), mat('gomma-nera')); p.position.set(x, 10, z); g.add(p); }
  // scaldatazze in cima
  for (const x of [-W / 2 + 16, W / 2 - 16]) g.add(asta(V3(x, H + 18, -D / 2 + 20), V3(x, H + 18, D / 2 - 20), 4, 4, 'acciaio', 12));
  for (const z of [-D / 2 + 20, D / 2 - 20]) g.add(asta(V3(-W / 2 + 16, H + 18, z), V3(W / 2 - 16, H + 18, z), 4, 4, 'acciaio', 12));
  for (const x of [-W / 2 + 16, W / 2 - 16]) for (const z of [-D / 2 + 20, D / 2 - 20]) g.add(asta(V3(x, H, z), V3(x, H + 18, z), 4, 4, 'acciaio', 12));
  const zF = D / 2;
  // gruppo e portafiltro
  const gr = new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 34, 40), mat('acciaio')); gr.position.set(0, 262, zF + 30); g.add(gr);
  g.add(asta(V3(0, 262, zF - 5), V3(0, 262, zF + 14), 30, 30, 'acciaio', 32).rotateX(0));
  const pf = new THREE.Mesh(new THREE.CylinderGeometry(38, 34, 26, 40), mat('acciaio')); pf.position.set(0, 232, zF + 30); g.add(pf);
  const manico = asta(V3(14, 228, zF + 60), V3(70, 214, zF + 170), 11, 15, 'ulivo-tornio', 24); g.add(manico);
  // vaschetta con griglia
  const v = new THREE.Mesh(lastra(rettTondo(230, 150, 10), 22, 2), mat('acciaio')); v.position.set(0, 20, zF + 10); g.add(v);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 5), mat('gomma-nera')); f.position.set(0, 42.5, zF - 45 + i * 12); g.add(f); }
  // tazzina in ceramica sulla griglia, sotto il portafiltro
  const tz = new THREE.Mesh(tornio([[0, 0], [20, 0], [24, 4], [30, 30], [32, 52], [29, 52], [27, 32], [21, 9], [0, 8]], 48), mat('ceramica-bianca')); tz.position.set(0, 44, zF + 28); g.add(tz);
  const caffe = new THREE.Mesh(new THREE.CircleGeometry(26, 32).rotateX(-Math.PI / 2), mat('caffe')); caffe.position.set(0, 44 + 40, zF + 28); g.add(caffe);
  // manometro, lancia vapore, manopole
  const man = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 6, 48), mat('quadrante')); man.rotation.x = Math.PI / 2; man.position.set(0, 335, zF + 3); g.add(man);
  const ghiera = new THREE.Mesh(new THREE.TorusGeometry(31, 3.5, 10, 48), mat('acciaio')); ghiera.position.set(0, 335, zF + 6); g.add(ghiera);
  const ago = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 1), mat('gomma-nera')); ago.position.set(4, 340, zF + 7); ago.rotation.z = -0.6; g.add(ago);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(110, 300, zF + 5), V3(118, 300, zF + 35), V3(122, 230, zF + 45), V3(124, 140, zF + 52)]), 40, 4.5, 10), mat('acciaio')));
  for (const x of [-110, 110]) { const k = asta(V3(x, 370, zF - 40), V3(x, H + 1, zF - 40), 16, 16, 'gomma-nera', 24); g.add(k); }
  return ombre(centra(g));
}
/** Bottiglia di vino (bordolese) in vetro verde scuro, con etichetta e capsula. */
function bottigliaVino(alt = 300) {
  const b = new THREE.Group(), r = 37;
  b.add(new THREE.Mesh(tornio([[0, 4], [20, 10], [r - 3, 0], [r, 4], [r, alt * 0.66], [r - 6, alt * 0.74], [16, alt * 0.8], [14, alt * 0.97], [15.5, alt], [0, alt]], 64), mat('vetro-verde')));
  const et = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 82, 48, 1, true, -1.2, 2.4), mat('etichetta')); et.position.y = 105; b.add(et);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.8, r + 0.8, 10, 48, 1, true, -1.2, 2.4), mat('etichetta-scura')); fascia.position.y = 120; b.add(fascia);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(15.8, 15, alt * 0.16, 32), mat('capsula')); cap.position.y = alt - alt * 0.08 + 1; b.add(cap);
  return b;
}
/** 16 — Bottiglie di vino e calici su un vassoio di rovere. */
function viniVassoio() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lastra(rettTondo(440, 230, 18), 16, 2), mat('rovere')));
  [[-140, -40, 0.3], [-55, -55, 2.1], [30, -30, 4.2]].forEach(([x, z, rot]) => { const b = bottigliaVino(300); b.position.set(x, 16, z); b.rotation.y = rot - Math.PI / 2 - 0.3; g.add(b); });
  for (const [x, z] of [[110, 40], [165, -25]]) {
    const c = new THREE.Mesh(tornio([[0, 0], [36, 0], [38, 2], [8, 6], [4, 14], [4, 110], [10, 114], [36, 140], [44, 180], [40, 215], [38, 215], [42, 180], [34, 142], [8, 117], [0, 116]], 64), mat('cristallo'));
    c.position.set(x, 16, z); g.add(c);
  }
  return ombre(centra(g));
}

// ------------------------------------------------------ fruttiere di design ----
/** Ciotola al tornio "di design": profilo [r, y] (fuori in su, bordo, dentro in giù; bordo = punto più alto),
 *  coste verticali sul fuori (n, profondità; torsione = giro in radianti dal fondo al bordo), bordo a onde (k, ampiezza). */
function ciotolaDesign(prof, { coste = 0, prof: pc = 3, torsione = 0, onde = 0, amp = 0, seg = 192 } = {}) {
  let v = prof.map(([r, y]) => new THREE.Vector2(r, y));
  v = new THREE.SplineCurve(v).getPoints(v.length * 8);
  let iBordo = 0; v.forEach((p, i) => { if (p.y > v[iBordo].y) iBordo = i; });
  const H = v[iBordo].y, geo = new THREE.LatheGeometry(v, seg), P = geo.attributes.position, nP = v.length;
  for (let i = 0; i < P.count; i++) {
    const j = i % nP, x = P.getX(i), y = P.getY(i), z = P.getZ(i), rr = Math.hypot(x, z);
    if (rr < 1e-6) continue;
    let a = Math.atan2(z, x), r = rr, yy = y;
    if (coste && j < iBordo - 2 && y > 6) {
      const aa = a + torsione * (y / H), sc = Math.pow(Math.abs(Math.cos((coste * aa) / 2)), 0.6);
      r -= pc * (1 - sc) * Math.min(1, y / 20, (H - y) / 15);
    }
    if (onde) yy += amp * Math.sin(onde * a) * Math.pow(Math.max(0, y) / H, 3);
    P.setXYZ(i, (x / rr) * r, yy, (z / rr) * r);
  }
  geo.computeVertexNormals(); geo.userData.profilo = v;
  // la superficie per la frutta: quella al tornio, un po' più alta verso il bordo dove ci sono le onde
  const base = sopraTornio(v), sup = (r) => base(r) + (onde ? amp * Math.pow(Math.max(0, base(r)) / H, 3) : 0);
  return { geo, sup, H };
}
/** Fruttiera di design con frutta mista ammucchiata (posata davvero, un frutto alla volta). */
async function fruttieraDesign(tipo) {
  const g = new THREE.Group();
  let c, frutti, bordo;
  if (tipo === 'onda') {
    // terracotta bruna opaca, coste verticali, bordo morbido a onde
    c = ciotolaDesign([[0, 0], [70, 0], [74, 4], [124, 34], [158, 80], [170, 120], [166, 125], [160, 120], [146, 82], [112, 40], [64, 16], [0, 14]], { coste: 84, prof: 4, onde: 5, amp: 9 });
    g.add(new THREE.Mesh(c.geo, mat('terracotta-bruna'))); bordo = 168;
    frutti = ['food_apple_01', 'proc:arancia', 'food_pears_asian_01', 'food_apple_01', 'proc:arancia', 'food_pears_asian_01', 'food_apple_01', 'proc:arancia', 'food_apple_01', 'proc:uva-verde'];
  } else if (tipo === 'spirale') {
    // ceramica crema, coste che girano a spirale dal fondo al bordo
    c = ciotolaDesign([[0, 0], [62, 0], [66, 4], [106, 40], [136, 90], [146, 122], [142, 126], [136, 121], [126, 91], [96, 44], [56, 16], [0, 14]], { coste: 40, prof: 4.5, torsione: 1.2 });
    g.add(new THREE.Mesh(c.geo, mat('ceramica-crema'))); bordo = 144;
    frutti = ['proc:arancia', 'lemon', 'proc:arancia', 'food_lime_01', 'lemon', 'proc:arancia', 'lemon', 'food_lime_01', 'proc:arancia', 'lemon', 'proc:arancia', 'lemon', 'food_lime_01'];
  } else if (tipo === 'verde') {
    // bassa e larga, nera opaca, bordo a onde: frutta verde
    c = ciotolaDesign([[0, 0], [90, 0], [94, 4], [150, 30], [184, 72], [192, 92], [188, 96], [182, 91], [172, 72], [140, 36], [86, 18], [0, 16]], { onde: 7, amp: 10 });
    g.add(new THREE.Mesh(c.geo, mat('ceramica-nera'))); bordo = 190;
    frutti = ['food_avocado_01', 'food_lime_01', 'food_kiwi_01', 'food_pears_asian_01', 'food_lime_01', 'food_avocado_01', 'food_kiwi_01', 'food_lime_01', 'food_kiwi_01', 'proc:uva-verde'];
  } else {
    // cesto a fili d'ottone: fondo pieno, fili curvi, due anelli
    const prof = [[0, 0], [80, 0], [84, 3], [128, 40], [158, 100], [168, 150]], vv = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(60);
    const fondo = new THREE.Mesh(tornio([[0, 0], [84, 0], [86, 3], [84, 6], [0, 6]], 96, false), mat('ottone-spazzolato')); g.add(fondo);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, pts = vv.map((p) => V3(Math.cos(a) * p.x, p.y, Math.sin(a) * p.x));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 2.4, 6), mat('ottone-spazzolato')));
    }
    for (const t of [0.55, 1]) { const p = vv[Math.round(t * (vv.length - 1))], an = new THREE.Mesh(new THREE.TorusGeometry(p.x, t === 1 ? 4 : 3, 10, 128), mat('ottone-spazzolato')); an.rotation.x = Math.PI / 2; an.position.y = p.y; g.add(an); }
    c = { sup: sopraTornio(vv), H: 150 }; bordo = 166;
    frutti = ['bananas', 'proc:arancia', 'food_apple_01', 'proc:arancia', 'food_apple_01', 'proc:uva-nera'];
  }
  await riempi(g, frutti, c.sup, bordo, frutti.length);
  return ombre(g);
}

// ------------------------------------------------------------- design ----
// Pezzi di design disegnati da noi: tavoli con basi scultoree, lampade LED, sgabello e sedia imbottiti.
/** Nastro (sezione rettangolare largh × sp) lungo una curva. asse: verso fisso della larghezza (es. z),
 *  se no la larghezza resta orizzontale. Ogni faccia ha i suoi vertici (spigoli netti). */
function nastro(punti, largh, sp, { chiuso = false, seg = 240, asse = null } = {}) {
  const curva = new THREE.CatmullRomCurve3(punti, chiuso, 'centripetal');
  const S = [];
  for (let i = 0; i <= seg; i++) {
    const t = chiuso ? (i % seg) / seg : i / seg, P = curva.getPointAt(t), T = curva.getTangentAt(t);
    let W = asse ? asse.clone().addScaledVector(T, -asse.dot(T)) : new THREE.Vector3().crossVectors(T, V3(0, 1, 0));
    if (W.lengthSq() < 1e-8) W = V3(0, 0, 1); W.normalize();
    const N = new THREE.Vector3().crossVectors(W, T).normalize(), w = typeof largh === 'function' ? largh(t) : largh;
    S.push([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P.clone().addScaledVector(W, (a * w) / 2).addScaledVector(N, (b * sp) / 2)));
  }
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
  for (let i = 0; i < seg; i++) for (let k = 0; k < 4; k++) quad(S[i][k], S[i][(k + 1) % 4], S[i + 1][k], S[i + 1][(k + 1) % 4]);
  if (!chiuso) { const a = S[0], b = S[seg]; quad(a[0], a[3], a[1], a[2]); quad(b[0], b[1], b[3], b[2]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
/** Piano del tavolo: ceramica/marmo (forma: 'rett' | 'stadio' | 'ovale'), con il telaio sotto rientrato. */
function pianoTavolo(L, D, forma, materiale, sp = 12, quota = 750) {
  const g = new THREE.Group();
  let s;
  if (forma === 'ovale') { s = new THREE.Shape(); s.absellipse(0, 0, L / 2, D / 2, 0, Math.PI * 2, false); }
  else if (forma === 'stadio') s = rettTondo(L, D, D * 0.42);
  else s = rettTondo(L, D, 24);
  const top = new THREE.Mesh(lastra(s, sp, 2), mat(materiale)); top.position.y = quota - sp; g.add(top);
  const filo = new THREE.Mesh(lastra(s, 4, 1), mat('gomma-nera')); filo.scale.set(0.996, 1, 0.992); filo.position.y = quota - sp - 4; g.add(filo);
  const telaio = new THREE.Mesh(lastra(forma === 'ovale' ? (() => { const e = new THREE.Shape(); e.absellipse(0, 0, L * 0.36, D * 0.34, 0, Math.PI * 2, false); return e; })() : rettTondo(L * 0.72, D * 0.7, 20), 26, 2), mat('metallo-nero'));
  telaio.position.y = quota - sp - 30; g.add(telaio);
  return g;
}
/** T1 — «Farfalla»: due anelli a goccia inclinati che si incrociano, ceramica bianca venata. */
function tavoloFarfalla() {
  const g = new THREE.Group(), H = 708;
  for (const lato of [-1, 1]) {
    const pts = [];
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push(V3(Math.sin(a) * 280, H / 2 - Math.cos(a) * (H / 2) * (1 - 0.18 * Math.sin(a) ** 2), 0)); }
    const m = new THREE.Mesh(nastro(pts, 150, 16, { chiuso: true, asse: V3(0, 0, 1) }), mat('champagne'));
    m.rotation.z = lato * 0.55; m.position.set(lato * 270, 0, lato * 60); g.add(m);
  }
  // a terra e sotto il piano, esatti
  g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g);
  for (const c of g.children) { c.position.y -= b.min.y; } const k = H / (b.max.y - b.min.y); g.scale.y = k;
  const tutto = new THREE.Group(); tutto.add(g); tutto.add(pianoTavolo(1900, 950, 'stadio', 'marmo-grande'));
  return ombre(tutto);
}
/** T2 — «Infinito»: un nastro unico che scende al centro e sale ai lati, bronzo scuro; piano ovale. */
function tavoloInfinito() {
  const pts = [];
  for (let k = 0; k < 64; k++) { const t = (k / 64) * Math.PI * 2; pts.push(V3(620 * Math.sin(t), 360 - 335 * Math.cos(2 * t), 230 * Math.sin(2 * t) + 70 * Math.cos(t))); }
  const base = new THREE.Mesh(nastro(pts, 120, 18, { chiuso: true, seg: 400 }), mat('bronzo'));
  const g = new THREE.Group(); g.add(base); g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g); base.position.y = -b.min.y; base.scale.y = 708 / (b.max.y - b.min.y);
  const t = new THREE.Group(); t.add(g); t.add(pianoTavolo(2200, 1100, 'ovale', 'marmo-grande'));
  return ombre(t);
}
/** T3 — «Mikado»: aste dorate incrociate, piano in pietra calda. */
function tavoloMikado() {
  // le aste inclinate scendono di ~19 mm sotto i punti di partenza: tutto più basso di tanto, così
  // appoggiato a terra il piano sta a 75 cm
  const g = new THREE.Group(), H = 689;
  const aste = [[-520, -160, 380, 120], [520, -160, -380, 120], [-470, 170, 420, -150], [470, 170, -420, -150], [-300, -40, 520, 40], [300, 40, -520, -40]];
  for (const [x0, z0, x1, z1] of aste) g.add(asta(V3(x0, 0, z0), V3(x1, H, z1), 19, 19, 'oro-satinato', 24));
  const t = new THREE.Group(); t.add(g); t.add(pianoTavolo(2000, 1000, 'ovale', 'pietra-calda', 12, 731));
  return ombre(t);
}
/** T4 — «Ics»: gambe a X in metallo nero (sezione quadra), piano spesso in rovere. */
function tavoloIcs() {
  // le gambe a sezione quadra inclinate scendono di ~45 mm: appoggiato a terra il piano sta a 75 cm
  const g = new THREE.Group(), H = 655;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const a = V3(sx * 760, 0, sz * 300), b = V3(-sx * 640, H, -sz * 250);       // tutte passano dal centro: una X vista da ogni lato
    const m = asta(a, b, 38, 38, 'metallo-nero', 4); m.rotateY(Math.PI / 4); g.add(m);
  }
  const piano = new THREE.Mesh(lastra(rettTondo(2200, 1000, 8), 50, 3), mat('rovere-grande')); piano.position.y = H; g.add(piano);
  return ombre(g);
}
/** T5 — «Ricciolo»: una lama larga che scende, fa un ricciolo e risale, nero opaco; piano in ceramica nera. */
function tavoloRicciolo() {
  const pts = [V3(-760, 700, 0), V3(-560, 420, 0), V3(-330, 40, 0), V3(-60, 0, 0), V3(170, 120, 0), V3(250, 360, 0), V3(120, 540, 0), V3(-60, 470, 0), V3(-40, 250, 0), V3(150, 70, 0), V3(420, 20, 0), V3(600, 300, 0), V3(760, 700, 0)];
  const base = new THREE.Mesh(nastro(pts, 520, 18, { asse: V3(0, 0, 1), seg: 300 }), mat('metallo-nero'));
  const g = new THREE.Group(); g.add(base); g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g); base.position.y = -b.min.y; base.scale.y = 708 / (b.max.y - b.min.y);
  const t = new THREE.Group(); t.add(g); t.add(pianoTavolo(2400, 1050, 'rett', 'marmo-nero-grande'));
  return ombre(t);
}
/** Cavi sottili dal corpo al soffitto (punti già alla quota vera), con un piccolo attacco tondo. */
function caviAlSoffitto(g, punti, soffitto, colore = 'acciaio') {
  for (const P of punti) {
    const l = soffitto - P.y; if (l <= 5) continue;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, l, 6), mat(colore)); c.position.set(P.x, P.y + l / 2, P.z); g.add(c);
    const at = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 10, 20), mat(colore)); at.position.set(P.x, soffitto - 5, P.z); g.add(at);
  }
}
/** Anello LED: profilo in metallo e la striscia accesa sul lato interno-basso. */
function anelloLed(R, metallo = 'oro-satinato') {
  const a = new THREE.Group();
  a.add(new THREE.Mesh(new THREE.TorusGeometry(R, 11, 14, 160), mat(metallo)));
  const led = new THREE.Mesh(new THREE.TorusGeometry(R - 12, 5, 10, 160), mat('led')); led.position.y = -10; a.add(led);
  a.children.forEach((c) => { c.rotation.x = Math.PI / 2; });
  return a;
}
/** L1–L4 — Lampade LED di design: corpo con il fondo a 165 cm, appese con cavi d'acciaio al soffitto. */
function lampadaLed(tipo, soffitto = SOFFITTO) {
  const g = new THREE.Group(), y0 = Y_LAMPADA, attacchi = [];
  if (tipo === 'anelli') {
    // tre anelli intrecciati, inclinati in versi diversi
    [[340, 0.32, 0, 0], [280, -0.28, 0.9, 1], [220, 0.22, 2.1, 2]].forEach(([R, inc, giro]) => {
      const a = anelloLed(R); a.rotation.set(inc, giro, 0); a.position.y = 380; g.add(a);
      g.updateMatrixWorld(true);
    });
    for (const a of [0, 2.1, 4.2]) attacchi.push(V3(Math.cos(a) * 300, 380 + 60, Math.sin(a) * 300));
  } else if (tipo === 'infinito') {
    const pts = [];
    for (let k = 0; k < 80; k++) { const t = (k / 80) * Math.PI * 2, d = 1 + Math.sin(t) ** 2; pts.push(V3((560 * Math.cos(t)) / d, 60 + 35 * Math.sin(2 * t), (560 * Math.sin(t) * Math.cos(t)) / d)); }
    const curva = new THREE.CatmullRomCurve3(pts, true);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 400, 12, 12, true), mat('metallo-nero')));
    const led = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(V3(0, -15, 0))), true), 400, 5, 8, true), mat('led')); g.add(led);
    attacchi.push(V3(-430, 70, 0), V3(430, 70, 0));
  } else if (tipo === 'linee') {
    // barre LED incrociate (tipo shanghai), quasi orizzontali
    const barre = [[-520, -80, 0, 520, 120, 40], [-480, 160, 30, 500, -150, 0], [-300, -260, 10, 360, 260, 60], [-560, 40, 50, 420, 20, 10], [-200, 260, 20, 240, -280, 45]];
    for (const [x0, z0, y0b, x1, z1, y1b] of barre) {
      const a = V3(x0, 100 + y0b, z0), b = V3(x1, 100 + y1b, z1);
      const m = asta(a, b, 14, 14, 'metallo-nero', 4); m.rotateY(Math.PI / 4); g.add(m);
      const l = asta(a.clone().add(V3(0, -15, 0)), b.clone().add(V3(0, -15, 0)), 6, 6, 'led', 4); l.rotateY(Math.PI / 4); g.add(l);
    }
    attacchi.push(V3(-400, 160, 0), V3(400, 160, 20), V3(0, 160, 200), V3(0, 160, -200));
  } else {
    // «orbita»: un grande anello orizzontale e uno più piccolo inclinato che lo attraversa
    const a = anelloLed(480, 'champagne'); a.position.y = 260; g.add(a);
    const b = anelloLed(300, 'champagne'); b.rotation.set(1.15, 0.4, 0); b.position.y = 260; g.add(b);
    for (const t of [0, 2.09, 4.19]) attacchi.push(V3(Math.cos(t) * 480, 272, Math.sin(t) * 480));
  }
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  g.children.forEach((c) => { c.position.y += y0 - b.min.y; });
  caviAlSoffitto(g, attacchi.map((p) => p.clone().add(V3(0, y0 - b.min.y, 0))), soffitto);
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; x.userData.senzaOmbra = true; } });
  return g;
}
const _lati = new Map();
/** Lo stesso materiale visto da un lato diverso: una copia (fatta una volta), il materiale comune non cambia. */
function lato(m, side) { const k = `${m.uuid}|${side}`; if (!_lati.has(k)) { const c = m.clone(); c.side = side; _lati.set(k, c); } return _lati.get(k); }
/** Scatola (mm) centrata, con un materiale. */
function scatola(w, h, d, materiale) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(materiale)); }
/**
 * LAMPADE LUNGHE (per isole e tavoli lunghi, 1,2–1,8 m): il corpo con il fondo a 165 cm, appese con
 * cavi d'acciaio al soffitto. Forme generiche di design (barre LED, coni, globi, cupole, trave,
 * anello ovale, dischi, cascata di sfere).
 */
function lampadaLunga(tipo, soffitto = SOFFITTO) {
  const g = new THREE.Group(), attacchi = [];
  const fila = (n, L) => Array.from({ length: n }, (_, i) => -L / 2 + (L / (n - 1)) * i);
  const barraLed = (L, metallo) => {
    const corpo = scatola(L, 42, 52, metallo); corpo.position.y = 21; g.add(corpo);
    const diff = scatola(L - 16, 5, 38, 'led'); diff.position.y = -1; g.add(diff);
    for (const sx of [-1, 1]) { const tappo = scatola(4, 44, 54, metallo); tappo.position.set(sx * (L / 2 + 1), 21, 0); g.add(tappo); }
    attacchi.push(V3(-L / 2 + 120, 42, 0), V3(L / 2 - 120, 42, 0));
  };
  if (tipo === 'barra-nera') barraLed(1500, 'metallo-nero');
  else if (tipo === 'barra-bianca') barraLed(1800, 'metallo-bianco');
  else if (tipo === 'tubo-ottone') {
    const L = 1300, tubo = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, L, 32), mat('oro-satinato'));
    tubo.rotation.z = Math.PI / 2; tubo.position.y = 20; g.add(tubo);
    const led = scatola(L - 30, 4, 16, 'led'); led.position.y = 1; g.add(led);
    for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 12), mat('oro-satinato')); t.position.set(sx * L / 2, 20, 0); g.add(t); }
    attacchi.push(V3(-L / 2 + 100, 39, 0), V3(L / 2 - 100, 39, 0));
  } else if (tipo === 'coni-neri') {
    const L = 1600; const barra = scatola(L, 22, 22, 'metallo-nero'); barra.position.y = 300; g.add(barra);
    for (const x of fila(5, L - 160)) {
      g.add(asta(V3(x, 290, 0), V3(x, 190, 0), 4, 4, 'metallo-nero', 8));
      // (copie dei materiali: il lato visibile cambia solo qui, non negli altri oggetti)
      const fuori = new THREE.Mesh(tornio([[0, 190], [18, 190], [30, 170], [80, 20], [82, 0]], 64, false), lato(mat('metallo-nero'), THREE.DoubleSide)); fuori.position.x = x; g.add(fuori);
      const dentro = new THREE.Mesh(tornio([[0, 186], [16, 186], [27, 168], [76, 22], [78, 3]], 64, false), lato(mat('oro-satinato'), THREE.DoubleSide)); dentro.position.x = x; g.add(dentro);
      const bulbo = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), mat('opalino')); bulbo.position.set(x, 55, 0); g.add(bulbo);
    }
    attacchi.push(V3(-L / 2 + 80, 311, 0), V3(L / 2 - 80, 311, 0));
  } else if (tipo === 'globi-ottone') {
    const L = 1700; const barra = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, L, 20), mat('oro-satinato')); barra.rotation.z = Math.PI / 2; barra.position.y = 260; g.add(barra);
    for (const x of fila(6, L - 140)) {
      g.add(asta(V3(x, 252, 0), V3(x, 160, 0), 5, 5, 'oro-satinato', 10));
      const attacco = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 26, 20), mat('oro-satinato')); attacco.position.set(x, 160, 0); g.add(attacco);
      const globo = new THREE.Mesh(new THREE.SphereGeometry(75, 32, 22), mat('opalino')); globo.position.set(x, 75, 0); g.add(globo);
    }
    attacchi.push(V3(-L / 2 + 60, 269, 0), V3(L / 2 - 60, 269, 0));
  } else if (tipo === 'cupole-fume') {
    const L = 1500; const barra = scatola(L, 24, 24, 'metallo-nero'); barra.position.y = 330; g.add(barra);
    for (const x of fila(4, L - 260)) {
      g.add(asta(V3(x, 318, 0), V3(x, 175, 0), 4, 4, 'metallo-nero', 8));
      const cupola = new THREE.Mesh(tornio([[0, 175], [20, 175], [70, 160], [112, 110], [130, 40], [132, 0]], 64), lato(mat('vetro-fume'), THREE.DoubleSide)); cupola.position.x = x; g.add(cupola);
      const port = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 40, 16), mat('metallo-nero')); port.position.set(x, 150, 0); g.add(port);
      const bulbo = new THREE.Mesh(new THREE.SphereGeometry(32, 20, 14), mat('opalino')); bulbo.position.set(x, 105, 0); g.add(bulbo);
    }
    attacchi.push(V3(-L / 2 + 90, 342, 0), V3(L / 2 - 90, 342, 0));
  } else if (tipo === 'trave-rovere') {
    const L = 1600; const trave = scatola(L, 70, 90, 'rovere'); trave.position.y = 480; g.add(trave);
    for (const x of fila(4, L - 300)) {
      g.add(asta(V3(x, 445, 0), V3(x, 230, 0), 2.5, 2.5, 'cavo', 8));
      const port = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 34, 16), mat('ottone')); port.position.set(x, 215, 0); g.add(port);
      const vetro = new THREE.Mesh(new THREE.CylinderGeometry(62, 62, 200, 40, 1, true), lato(mat('vetro'), THREE.DoubleSide)); vetro.position.set(x, 100, 0); g.add(vetro);
      const bulbo = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), mat('opalino')); bulbo.position.set(x, 120, 0); g.add(bulbo);
    }
    attacchi.push(V3(-L / 2 + 120, 515, 0), V3(L / 2 - 120, 515, 0));
  } else if (tipo === 'ovale-led') {
    // anello ovale allungato (pista): due tratti dritti e due mezzi cerchi
    const L = 1500, R = 250, dritto = L - 2 * R, pts = [];
    for (let k = 0; k <= 24; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 24; pts.push(V3(dritto / 2 + R * Math.cos(a), 0, R * Math.sin(a))); }
    for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + (Math.PI * k) / 24; pts.push(V3(-dritto / 2 + R * Math.cos(a), 0, R * Math.sin(a))); }
    const curva = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 300, 14, 14, true), mat('champagne')); tubo.position.y = 30; g.add(tubo);
    const led = new THREE.Mesh(new THREE.TubeGeometry(curva, 300, 6, 10, true), mat('led')); led.position.y = 15; g.add(led);
    attacchi.push(V3(-dritto / 2, 44, -R), V3(dritto / 2, 44, -R), V3(-dritto / 2, 44, R), V3(dritto / 2, 44, R));
  } else if (tipo === 'dischi') {
    for (const x of fila(3, 1300)) {
      const disco = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 24, 64), mat('metallo-nero')); disco.position.set(x, 12, 0); g.add(disco);
      const luce = new THREE.Mesh(new THREE.CylinderGeometry(178, 178, 3, 64), mat('led')); luce.position.set(x, -1, 0); g.add(luce);
      attacchi.push(V3(x, 24, 0));
    }
  } else {
    // «cascata»: sfere di vetro con la lampadina, a altezze diverse lungo 1,5 m, ognuna col suo cavo
    const xs = fila(8, 1500), alt = [0, 160, 60, 240, 30, 200, 90, 260], rag = [70, 60, 78, 62, 72, 58, 76, 64];
    xs.forEach((x, i) => {
      const z = (i % 2 ? 1 : -1) * 70, y = alt[i] + rag[i];
      const sfera = new THREE.Mesh(new THREE.SphereGeometry(rag[i], 32, 22), mat('vetro')); sfera.position.set(x, y, z); g.add(sfera);
      const bulbo = new THREE.Mesh(new THREE.SphereGeometry(rag[i] * 0.35, 18, 12), mat('opalino')); bulbo.position.set(x, y, z); g.add(bulbo);
      const port = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 26, 14), mat('ottone')); port.position.set(x, y + rag[i] + 8, z); g.add(port);
      attacchi.push(V3(x, y + rag[i] + 21, z));
    });
  }
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), y0 = Y_LAMPADA;
  g.children.forEach((c) => { c.position.y += y0 - b.min.y; });
  caviAlSoffitto(g, attacchi.map((p) => p.clone().add(V3(0, y0 - b.min.y, 0))), soffitto);
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; x.userData.senzaOmbra = true; } });
  return g;
}
// ---------------------------------------------------------------------------
// LAMPADE DI LUSSO, LUNGHE (isole e tavoli da 2,5–3 m): LED che si incrociano, nero satinato, oro,
// noce. Pezzi costruiti come quelli veri: profilo in metallo con il diffusore LED su un lato,
// giunti e terminali in ottone, cavi d'acciaio fino al soffitto.
// ---------------------------------------------------------------------------
/** Profilo LED rettangolare da a a b (larghezza w, altezza h), diffusore acceso sul lato basso. */
function profiloLed(a, b, w, h, metallo, conLed = true) {
  const g = new THREE.Group(), dir = b.clone().sub(a), L = dir.length(); dir.normalize();
  const su = V3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)); if (su.lengthSq() < 1e-6) su.set(1, 0, 0); su.normalize();
  const z = new THREE.Vector3().crossVectors(dir, su);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(L, h, w), mat(metallo)));
  if (conLed) { const led = new THREE.Mesh(new THREE.BoxGeometry(L - 8, 6, w - 4), mat('led')); led.position.y = -h / 2 - 2; g.add(led); }
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, su, z));
  g.position.copy(a).add(b).multiplyScalar(0.5);
  return g;
}
/** Tubo lungo una curva con la striscia LED sotto (stesso percorso, più in basso e più sottile). */
function tuboLed(curva, r, metallo, chiusa = false, seg = 400) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, seg, r, 16, chiusa), mat(metallo)));
  // la linea LED: un po' più larga e sporgente sotto il tubo, così si vede accesa anche di lato
  const pts = curva.getPoints(seg).map((p) => p.clone().add(V3(0, -r * 0.62, 0)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, chiusa), seg, r * 0.55, 10, chiusa), mat('led')));
  return g;
}
/** Anello ovale (pista) come curva chiusa, lungo L e largo D, nel piano XZ. */
function curvaOvale(L, D) {
  const R = D / 2, dritto = L - D, pts = [];
  for (let k = 0; k < 24; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 24; pts.push(V3(dritto / 2 + R * Math.cos(a), 0, R * Math.sin(a))); }
  for (let k = 0; k < 24; k++) { const a = Math.PI / 2 + (Math.PI * k) / 24; pts.push(V3(-dritto / 2 + R * Math.cos(a), 0, R * Math.sin(a))); }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}
function giunto(p, r, h, materiale = 'oro-satinato') { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(materiale)); m.position.copy(p); return m; }
function lampadaLusso(tipo, soffitto = SOFFITTO) {
  const g = new THREE.Group(), attacchi = [];
  if (tipo === 'mikado') {
    // barre LED nere che si incrociano a angoli bassi, quasi orizzontali, giunti in oro
    const barre = [[-900, -60, 40, 880, 70, 120], [-860, 90, 130, 900, -80, 30], [-700, -160, 90, 760, 150, 60], [-940, 10, 200, 620, 30, 0],
      [-560, 170, 10, 940, -40, 180], [-780, -110, 150, 820, -150, 80]];
    for (const [x0, z0, y0, x1, z1, y1] of barre) g.add(profiloLed(V3(x0, y0, z0), V3(x1, y1, z1), 26, 26, 'nero-satinato'));
    for (const [x, y, z] of [[-40, 80, 5], [300, 100, 25], [-380, 120, 10], [520, 60, -40]]) g.add(giunto(V3(x, y, z), 22, 60));
    attacchi.push(V3(-650, 240, 0), V3(0, 240, 0), V3(650, 240, 0));
  } else if (tipo === 'ovali') {
    // tre anelli ovali dorati intrecciati, ognuno inclinato in modo diverso
    [[1700, 460, 0.18, 0.05, 140], [1450, 400, -0.2, -0.08, 160], [1200, 340, 0.1, 0.16, 180]].forEach(([L, D, rx, rz, y]) => {
      const a = tuboLed(curvaOvale(L, D), 13, 'oro-satinato', true); a.rotation.set(rx, 0, rz); a.position.y = y; g.add(a);
    });
    attacchi.push(V3(-650, 320, 0), V3(650, 320, 0), V3(0, 330, 0));
  } else if (tipo === 'onda') {
    // un nastro LED nero che ondeggia (su e giù e di lato) per 1,8 m, terminali in ottone
    const pts = []; for (let k = 0; k <= 60; k++) { const t = k / 60, x = -900 + 1800 * t; pts.push(V3(x, 90 + 70 * Math.sin(t * Math.PI * 3), 90 * Math.sin(t * Math.PI * 2 + 0.6))); }
    const curva = new THREE.CatmullRomCurve3(pts);
    g.add(tuboLed(curva, 16, 'nero-satinato'));
    for (const t of [0, 1]) { const q = curva.getPoint(t); const c = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 14), mat('ottone-spazzolato')); c.position.copy(q); g.add(c); }
    attacchi.push(curva.getPoint(0.12).add(V3(0, 18, 0)), curva.getPoint(0.5).add(V3(0, 18, 0)), curva.getPoint(0.88).add(V3(0, 18, 0)));
  } else if (tipo === 'elica') {
    // due tubi LED attorcigliati (doppia elica) lungo 1,6 m: uno oro, uno nero
    for (const [fase, metallo] of [[0, 'oro-satinato'], [Math.PI, 'nero-satinato']]) {
      const pts = []; for (let k = 0; k <= 120; k++) { const t = k / 120; pts.push(V3(-800 + 1600 * t, 120 + 85 * Math.sin(t * Math.PI * 4 + fase), 85 * Math.cos(t * Math.PI * 4 + fase))); }
      g.add(tuboLed(new THREE.CatmullRomCurve3(pts), 11, metallo));
    }
    for (const x of [-800, 800]) g.add(giunto(V3(x, 120, 0), 26, 30, 'ottone-spazzolato')).children;
    attacchi.push(V3(-700, 215, 0), V3(700, 215, 0));
  } else if (tipo === 'noce') {
    // lastra sospesa in noce con il LED sotto e una linea di luce sopra; aste e terminali in ottone
    const L = 1700;
    const lastra = new THREE.Mesh(new THREE.BoxGeometry(L, 36, 190), mat('noce')); lastra.position.y = 60; g.add(lastra);
    const sotto = new THREE.Mesh(new THREE.BoxGeometry(L - 120, 4, 120), mat('led')); sotto.position.y = 40; g.add(sotto);
    const sopra = new THREE.Mesh(new THREE.BoxGeometry(L - 200, 4, 18), mat('led')); sopra.position.y = 80; g.add(sopra);
    for (const sx of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(14, 44, 196), mat('ottone-spazzolato')); t.position.set(sx * (L / 2 + 7), 60, 0); g.add(t);
      g.add(asta(V3(sx * (L / 2 - 160), 78, 0), V3(sx * (L / 2 - 160), 300, 0), 6, 6, 'ottone-spazzolato', 12));
    }
    attacchi.push(V3(-(L / 2 - 160), 300, 0), V3(L / 2 - 160, 300, 0));
  } else if (tipo === 'costellazione') {
    // asta in ottone; da lei scendono steli sottili, ognuno con una goccia di luce, a altezze diverse
    const L = 1700; g.add(asta(V3(-L / 2, 420, 0), V3(L / 2, 420, 0), 8, 8, 'ottone-spazzolato', 16));
    const n = 15;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 50 + ((L - 100) * i) / (n - 1), z = Math.sin(i * 2.3) * 70, y = 60 + ((i * 97) % 230);
      g.add(asta(V3(x, 420, 0), V3(x, y + 34, z), 2, 2, 'ottone-spazzolato', 8));
      const goccia = new THREE.Mesh(tornio([[0, 0], [10, 6], [16, 20], [13, 34], [0, 40]], 32), mat('led')); goccia.position.set(x, y - 6, z); g.add(goccia);
      g.add(giunto(V3(x, y + 34, z), 5, 8, 'ottone-spazzolato'));
    }
    attacchi.push(V3(-650, 428, 0), V3(650, 428, 0));
  } else if (tipo === 'prisma') {
    // prisma esagonale allungato: spigoli in nero satinato con il LED, nodi in oro
    const L = 1600, R = 170, angoli = Array.from({ length: 6 }, (_, k) => (Math.PI / 3) * k + Math.PI / 6);
    const P = (x, a) => V3(x, 200 + R * Math.sin(a), R * Math.cos(a));
    for (const a of angoli) g.add(profiloLed(P(-L / 2, a), P(L / 2, a), 16, 16, 'nero-satinato'));
    for (const x of [-L / 2, L / 2]) for (let k = 0; k < 6; k++) {
      g.add(profiloLed(P(x, angoli[k]), P(x, angoli[(k + 1) % 6]), 16, 16, 'nero-satinato', false));
      const nodo = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), mat('oro-satinato')); nodo.position.copy(P(x, angoli[k])); g.add(nodo);
    }
    attacchi.push(V3(-L / 2, 200 + R + 10, 0), V3(L / 2, 200 + R + 10, 0));
  } else {
    // «catena»: cinque anelli LED dorati concatenati in fila, inclinati alternati
    const n = 5, R = 210, passo = 320;
    for (let i = 0; i < n; i++) {
      const pts = []; for (let k = 0; k < 64; k++) { const t = (k / 64) * Math.PI * 2; pts.push(V3(R * Math.cos(t), 0, R * Math.sin(t))); }
      const a = tuboLed(new THREE.CatmullRomCurve3(pts, true), 11, i % 2 ? 'nero-satinato' : 'oro-satinato', true, 160);
      a.rotation.set(i % 2 ? Math.PI / 2 : 0.0, 0, i % 2 ? 0 : 0); a.position.set(-((n - 1) * passo) / 2 + i * passo, 230, 0); g.add(a);
    }
    attacchi.push(V3(-((n - 1) * passo) / 2, 245, 0), V3(((n - 1) * passo) / 2, 245, 0));
  }
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), y0 = Y_LAMPADA;
  g.children.forEach((c) => { c.position.y += y0 - b.min.y; });
  caviAlSoffitto(g, attacchi.map((p) => p.clone().add(V3(0, y0 - b.min.y, 0))), soffitto);
  g.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.receiveShadow = false; x.userData.senzaOmbra = true; } });
  return g;
}
/** Schienale avvolgente imbottito: arco (gradi) di raggio r, alto h, spesso sp. */
function schienale(r, arco, h, sp, materiale) {
  const s = new THREE.Shape(), a0 = Math.PI / 2 - (arco * Math.PI) / 360, a1 = Math.PI / 2 + (arco * Math.PI) / 360;
  s.absarc(0, 0, r, a0, a1, false); s.absarc(0, 0, r - sp, a1, a0, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h - 2 * 14, bevelEnabled: true, bevelThickness: 14, bevelSize: Math.min(14, sp / 2 - 1), bevelSegments: 6, curveSegments: 48 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 14, 0); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(materiale));                                          // schiena verso -z
}
/** S1 — Sgabello «Conchiglia»: seduta e schienale avvolgente in velluto, gambe sottili in ottone (seduta a 66 cm). */
function sgabelloConchiglia() {
  const g = new THREE.Group(), H = 660;
  const sed = new THREE.Mesh(lastra(rettTondo(440, 420, 150), 80, 26), mat('velluto-sabbia')); sed.position.y = H - 80; g.add(sed);
  const sc = schienale(230, 200, 220, 70, 'velluto-sabbia'); sc.position.set(0, H - 30, 20); g.add(sc);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(asta(V3(sx * 215, 0, sz * 205), V3(sx * 150, H - 70, sz * 140), 9, 11, 'oro-satinato', 16));
  const yA = 260, k = yA / (H - 70), rx = 215 + (150 - 215) * k, rz = 205 + (140 - 205) * k;
  for (const [a, b] of [[[-1, 1], [1, 1]], [[-1, -1], [1, -1]], [[-1, -1], [-1, 1]], [[1, -1], [1, 1]]]) g.add(asta(V3(a[0] * rx, yA, a[1] * rz), V3(b[0] * rx, yA, b[1] * rz), 8, 8, 'oro-satinato', 12));
  return ombre(centra(g));
}
/** C1 — Sedia «Avvolgente»: guscio imbottito in velluto, gambe sottili leggermente aperte (seduta a 47 cm). */
function sediaAvvolgente(tessuto = 'velluto-sabbia', gambe = 'oro-satinato') {
  const g = new THREE.Group(), H = 470;
  const sed = new THREE.Mesh(lastra(rettTondo(500, 480, 170), 90, 30), mat(tessuto)); sed.position.y = H - 90; g.add(sed);
  const sc = schienale(270, 230, 360, 80, tessuto); sc.position.set(0, H - 40, 30); g.add(sc);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(asta(V3(sx * 245, 0, sz * 235), V3(sx * 175, H - 85, sz * 165), 10, 12, gambe, 16));
  return ombre(centra(g));
}

// ------------------------------------------------------------- catalogo ----
export const COLLEZIONE = [
  { id: 'fruttiera-limoni', nome: 'Fruttiera in marmo con limoni', es: 'Frutero de mármol con limones', misure: { w: 320, d: 320, h: 200 }, crea: () => fruttiera('marmo', ['lemon'], 11) },
  { id: 'fruttiera-pere', nome: 'Fruttiera nera con pere e lime', es: 'Frutero negro con peras y limas', misure: { w: 320, d: 320, h: 155 }, crea: () => fruttiera('ceramica-nera', ['food_pears_asian_01', 'food_lime_01'], 13) },
  { id: 'fruttiera-mista', nome: 'Fruttiera in travertino con frutta mista', es: 'Frutero de travertino con fruta variada', misure: { w: 320, d: 320, h: 240 }, crea: () => fruttiera('travertino', ['food_apple_01', 'lemon', 'food_pomegranate_01', 'food_lime_01', 'food_pears_asian_01'], 10) },
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
  { id: 'lux-lampada-ottone', linea: 'luxury', appeso: true, nome: 'Lampada a sospensione in ottone', es: 'Lámpara colgante de latón', misure: { w: 305, d: 305, h: 2700 }, crea: async (s) => lampada('ottone', s) },
  { id: 'lux-lampada-globo', linea: 'luxury', appeso: true, nome: 'Lampada a sospensione globo opalino', es: 'Lámpara colgante globo opalino', misure: { w: 250, d: 250, h: 2700 }, crea: async (s) => lampada('globo', s) },
  // ---- DESIGN (prova: tavoli scultorei, lampade LED, sgabello e sedia imbottiti) ----
  { id: 'ds-tavolo-farfalla', nome: 'Tavolo «Farfalla», anelli incrociati e ceramica bianca', es: 'Mesa «Mariposa», aros cruzados y cerámica blanca', misure: { w: 1904, d: 954, h: 750 }, crea: async () => tavoloFarfalla() },
  { id: 'ds-tavolo-infinito', nome: 'Tavolo «Infinito», nastro in bronzo e piano ovale', es: 'Mesa «Infinito», cinta de bronce y tapa ovalada', misure: { w: 2204, d: 1104, h: 750 }, crea: async () => tavoloInfinito() },
  { id: 'ds-tavolo-mikado', nome: 'Tavolo «Mikado», aste dorate e pietra calda', es: 'Mesa «Mikado», varillas doradas y piedra cálida', misure: { w: 2004, d: 1004, h: 751 }, crea: async () => tavoloMikado() },
  { id: 'ds-tavolo-ics', nome: 'Tavolo a X nero con piano in rovere', es: 'Mesa en X negra con tapa de roble', misure: { w: 2206, d: 1006, h: 751 }, crea: async () => tavoloIcs() },
  { id: 'ds-tavolo-ricciolo', nome: 'Tavolo «Ricciolo», lama nera e ceramica nera', es: 'Mesa «Rizo», lámina negra y cerámica negra', misure: { w: 2404, d: 1054, h: 750 }, crea: async () => tavoloRicciolo() },
  { id: 'ds-led-anelli', appeso: true, nome: 'Lampada LED, tre anelli intrecciati', es: 'Lámpara LED, tres aros entrelazados', misure: { w: 818, d: 792, h: 2700 }, crea: async (s) => lampadaLed('anelli', s) },
  { id: 'ds-led-infinito', appeso: true, nome: 'Lampada LED «Infinito»', es: 'Lámpara LED «Infinito»', misure: { w: 1144, d: 420, h: 2700 }, crea: async (s) => lampadaLed('infinito', s) },
  { id: 'ds-led-linee', appeso: true, nome: 'Lampada LED, linee incrociate', es: 'Lámpara LED, líneas cruzadas', misure: { w: 1084, d: 562, h: 2700 }, crea: async (s) => lampadaLed('linee', s) },
  { id: 'ds-lin-barra-nera', appeso: true, nome: 'Lampada lunga, barra LED nera 150 cm', es: 'Lámpara larga, barra LED negra 150 cm', misure: { w: 1506, d: 54, h: 2700 }, crea: async (s) => lampadaLunga('barra-nera', s) },
  { id: 'ds-lin-barra-bianca', appeso: true, nome: 'Lampada lunga, barra LED bianca 180 cm', es: 'Lámpara larga, barra LED blanca 180 cm', misure: { w: 1806, d: 54, h: 2700 }, crea: async (s) => lampadaLunga('barra-bianca', s) },
  { id: 'ds-lin-tubo-ottone', appeso: true, nome: 'Lampada lunga, tubo LED in ottone 130 cm', es: 'Lámpara larga, tubo LED de latón 130 cm', misure: { w: 1340, d: 40, h: 2700 }, crea: async (s) => lampadaLunga('tubo-ottone', s) },
  { id: 'ds-lin-coni-neri', appeso: true, nome: 'Lampada lunga, cinque coni neri e ottone', es: 'Lámpara larga, cinco conos negros y latón', misure: { w: 1604, d: 164, h: 2700 }, crea: async (s) => lampadaLunga('coni-neri', s) },
  { id: 'ds-lin-globi-ottone', appeso: true, nome: 'Lampada lunga, sei globi opalini su barra in ottone', es: 'Lámpara larga, seis globos opalinos en barra de latón', misure: { w: 1710, d: 150, h: 2700 }, crea: async (s) => lampadaLunga('globi-ottone', s) },
  { id: 'ds-lin-cupole-fume', appeso: true, nome: 'Lampada lunga, quattro cupole in vetro fumé', es: 'Lámpara larga, cuatro cúpulas de vidrio ahumado', misure: { w: 1504, d: 264, h: 2700 }, crea: async (s) => lampadaLunga('cupole-fume', s) },
  { id: 'ds-lin-trave-rovere', appeso: true, nome: 'Lampada lunga, trave in rovere con paralumi in vetro', es: 'Lámpara larga, viga de roble con pantallas de vidrio', misure: { w: 1600, d: 124, h: 2700 }, crea: async (s) => lampadaLunga('trave-rovere', s) },
  { id: 'ds-lin-ovale-led', appeso: true, nome: 'Lampada lunga, anello LED ovale 150 cm', es: 'Lámpara larga, aro LED ovalado 150 cm', misure: { w: 1527, d: 536, h: 2700 }, crea: async (s) => lampadaLunga('ovale-led', s) },
  { id: 'ds-lin-dischi', appeso: true, nome: 'Lampada lunga, tre dischi LED neri', es: 'Lámpara larga, tres discos LED negros', misure: { w: 1680, d: 380, h: 2700 }, crea: async (s) => lampadaLunga('dischi', s) },
  { id: 'ds-lin-cascata', appeso: true, nome: 'Lampada lunga, cascata di sfere in vetro', es: 'Lámpara larga, cascada de esferas de vidrio', misure: { w: 1634, d: 282, h: 2700 }, crea: async (s) => lampadaLunga('cascata', s) },
  { id: 'ds-lux-mikado', appeso: true, nome: 'Lampada di lusso «Mikado», barre LED nere incrociate e oro', es: 'Lámpara de lujo «Mikado», barras LED negras cruzadas y oro', misure: { w: 1885, d: 356, h: 2700 }, crea: async (s) => lampadaLusso('mikado', s) },
  { id: 'ds-lux-ovali', appeso: true, nome: 'Lampada di lusso, tre ovali LED dorati intrecciati', es: 'Lámpara de lujo, tres óvalos LED dorados entrelazados', misure: { w: 1725, d: 507, h: 2700 }, crea: async (s) => lampadaLusso('ovali', s) },
  { id: 'ds-lux-onda', appeso: true, nome: 'Lampada di lusso «Onda», nastro LED nero e ottone', es: 'Lámpara de lujo «Onda», cinta LED negra y latón', misure: { w: 1840, d: 212, h: 2700 }, crea: async (s) => lampadaLusso('onda', s) },
  { id: 'ds-lux-elica', appeso: true, nome: 'Lampada di lusso «Elica», LED oro e nero attorcigliati', es: 'Lámpara de lujo «Hélice», LED oro y negro trenzados', misure: { w: 1652, d: 192, h: 2700 }, crea: async (s) => lampadaLusso('elica', s) },
  { id: 'ds-lux-noce', appeso: true, nome: 'Lampada di lusso, lastra in noce con LED e ottone', es: 'Lámpara de lujo, lámina de nogal con LED y latón', misure: { w: 1728, d: 196, h: 2700 }, crea: async (s) => lampadaLusso('noce', s) },
  { id: 'ds-lux-costellazione', appeso: true, nome: 'Lampada di lusso «Costellazione», gocce di luce e ottone', es: 'Lámpara de lujo «Constelación», gotas de luz y latón', misure: { w: 1700, d: 169, h: 2700 }, crea: async (s) => lampadaLusso('costellazione', s) },
  { id: 'ds-lux-prisma', appeso: true, nome: 'Lampada di lusso «Prisma», linee LED nere e nodi oro', es: 'Lámpara de lujo «Prisma», líneas LED negras y nudos oro', misure: { w: 1636, d: 322, h: 2700 }, crea: async (s) => lampadaLusso('prisma', s) },
  { id: 'ds-lux-catena', appeso: true, nome: 'Lampada di lusso «Catena», anelli LED oro e neri', es: 'Lámpara de lujo «Cadena», aros LED oro y negros', misure: { w: 1722, d: 442, h: 2700 }, crea: async (s) => lampadaLusso('catena', s) },
  { id: 'ds-led-orbita', appeso: true, nome: 'Lampada LED «Orbita», due anelli', es: 'Lámpara LED «Órbita», dos aros', misure: { w: 989, d: 982, h: 2700 }, crea: async (s) => lampadaLed('orbita', s) },
  { id: 'ds-sgabello-conchiglia', nome: 'Sgabello «Conchiglia» in velluto e ottone', es: 'Taburete «Concha» de terciopelo y latón', misure: { w: 492, d: 472, h: 852 }, crea: async () => sgabelloConchiglia() },
  { id: 'ds-sedia-avvolgente', nome: 'Sedia «Avvolgente» in velluto e ottone', es: 'Silla «Envolvente» de terciopelo y latón', misure: { w: 568, d: 540, h: 794 }, crea: async () => sediaAvvolgente() },
  { id: 'ds-sedia-avvolgente-salvia', nome: 'Sedia «Avvolgente» velluto salvia, gambe nere', es: 'Silla «Envolvente» terciopelo salvia, patas negras', misure: { w: 568, d: 540, h: 794 }, crea: async () => sediaAvvolgente('velluto-salvia', 'metallo-nero') },
  // ---- FRUTTIERE DI DESIGN ----
  { id: 'fd-onda', nome: 'Fruttiera a onde in terracotta con frutta mista', es: 'Frutero ondulado de terracota con fruta variada', misure: { w: 348, d: 341, h: 197 }, crea: () => fruttieraDesign('onda') },
  { id: 'fd-spirale', nome: 'Fruttiera a spirale crema con agrumi', es: 'Frutero en espiral crema con cítricos', misure: { w: 294, d: 296, h: 175 }, crea: () => fruttieraDesign('spirale') },
  { id: 'fd-verde', nome: 'Fruttiera bassa nera con frutta verde', es: 'Frutero bajo negro con fruta verde', misure: { w: 384, d: 384, h: 153 }, crea: () => fruttieraDesign('verde') },
  { id: 'fd-ottone', nome: 'Cesto in fili d\'ottone con banane e frutta', es: 'Cesta de alambre de latón con plátanos y fruta', misure: { w: 344, d: 353, h: 198 }, crea: () => fruttieraDesign('ottone') },
  // ---- LEGNO E BAMBÙ ----
  { id: 'lb-taglieri-muro', nome: 'Taglieri in rovere e bambù al muro', es: 'Tablas de roble y bambú contra la pared', misure: { w: 363, d: 171, h: 497 }, crea: async () => taglieriMuro() },
  { id: 'lb-vassoio-bambu', nome: 'Vassoio in bambù con olio, sale e pepe', es: 'Bandeja de bambú con aceite, sal y pimienta', misure: { w: 383, d: 173, h: 302 }, crea: async () => vassoioBambu() },
  { id: 'lb-portamestoli', nome: 'Portamestoli con mestoli in ulivo', es: 'Bote con cucharas de olivo', misure: { w: 167, d: 208, h: 332 }, crea: async () => portamestoli() },
  { id: 'lb-ciotola-ulivo', nome: 'Ciotola in legno d\'ulivo con limoni', es: 'Cuenco de madera de olivo con limones', misure: { w: 296, d: 296, h: 172 }, crea: () => ciotolaUlivo() },
  { id: 'lb-cesto-pane', nome: 'Cesto intrecciato con il pane', es: 'Cesta trenzada con pan', misure: { w: 321, d: 308, h: 180 }, crea: () => cestoPane() },
  { id: 'lb-tagliere-formaggi', nome: 'Tagliere con pane, formaggi e olive', es: 'Tabla con pan, quesos y aceitunas', misure: { w: 504, d: 302, h: 119 }, crea: () => tagliereFormaggi() },
  { id: 'lb-mortaio', nome: 'Mortaio in marmo con basilico', es: 'Mortero de mármol con albahaca', misure: { w: 361, d: 220, h: 233 }, crea: async () => mortaio() },
  { id: 'lb-erbe', nome: 'Erbe aromatiche in terracotta su vassoio', es: 'Hierbas aromáticas en terracota sobre bandeja', misure: { w: 486, d: 205, h: 432 }, crea: async () => erbe() },
  { id: 'lb-ulivo', nome: 'Ulivo in vaso di cemento', es: 'Olivo en maceta de cemento', misure: { w: 909, d: 1032, h: 1808 }, crea: async () => ulivoGrande() },
  { id: 'lb-eucalipto', nome: 'Rami di eucalipto in bottiglia di vetro', es: 'Ramas de eucalipto en botella de vidrio', misure: { w: 313, d: 333, h: 935 }, crea: async () => eucalipto() },
  { id: 'lb-lampada-sfera', appeso: true, nome: 'Sospensione in bambù intrecciato, sfera', es: 'Colgante de bambú trenzado, esfera', misure: { w: 437, d: 437, h: 2700 }, crea: async (s) => lampadaBambu('sfera', s) },
  { id: 'lb-lampada-campana', appeso: true, nome: 'Sospensione in bambù intrecciato, campana', es: 'Colgante de bambú trenzado, campana', misure: { w: 478, d: 478, h: 2700 }, crea: async (s) => lampadaBambu('campana', s) },
  { id: 'lb-sgabello-corda', nome: 'Sgabello in rovere con seduta in corda', es: 'Taburete de roble con asiento de cuerda', misure: { w: 486, d: 486, h: 663 }, crea: async () => sgabelloCorda() },
  { id: 'lb-ciotole', nome: 'Pila di ciotole in ceramica', es: 'Pila de cuencos de cerámica', misure: { w: 229, d: 229, h: 104 }, crea: async () => ciotolePila() },
  { id: 'lb-espresso', nome: 'Macchina da espresso in acciaio', es: 'Cafetera espresso de acero', misure: { w: 306, d: 561, h: 412 }, crea: async () => espresso() },
  { id: 'lb-vini', nome: 'Bottiglie di vino e calici su vassoio', es: 'Botellas de vino y copas sobre bandeja', misure: { w: 444, d: 234, h: 317 }, crea: async () => viniVassoio() },
];

const _pronti = new Map();
/** Il modello (una volta sola): gruppo con le misure vere. */
export function creaModerno(id, soffitto = SOFFITTO) {
  const voce = COLLEZIONE.find((c) => c.id === id), chiave = voce && voce.appeso ? `${id}|${soffitto}` : id;
  if (!_pronti.has(chiave)) {
    if (voce) rnd = generatore(semeDi(id));
    const p = voce ? Promise.resolve(voce.crea(soffitto)).then((g) => {
      let b = new THREE.Box3().setFromObject(g);
      // un oggetto APPOGGIA sul suo punto più basso: niente pezzi sotto il piano o sotto il pavimento
      // (es. le gambe inclinate di un tavolo); le lampade invece pendono dal soffitto
      if (!voce.appeso && b.min.y < -0.5) { const dy = -b.min.y; for (const c of g.children) c.position.y += dy; g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); }
      g.userData.dim = { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; return g;
    }) : Promise.reject(new Error('oggetto sconosciuto'));
    p.catch(() => _pronti.delete(chiave));
    _pronti.set(chiave, p);
  }
  return _pronti.get(chiave);
}
const _fatti = new Map();
/** In CUCINA: l'oggetto alle misure scelte; null finché non è pronto (poi quandoPronto()). */
export function oggettoModerno(id, misure, quandoPronto, soffitto = SOFFITTO) {
  const voce = COLLEZIONE.find((c) => c.id === id), chiave = voce && voce.appeso ? `${id}|${soffitto}` : id;
  const t = _fatti.get(chiave);
  if (t && t !== 'attesa' && t !== 'errore') {
    // misure scelte in cucina rispetto a quelle del CATALOGO (uguali = grandezza vera);
    // le lampade non si schiacciano in altezza (la fa il soffitto)
    const g = t.clone(true), m0 = voce ? voce.misure : null;
    if (misure && m0) g.scale.set((misure.w || m0.w) / m0.w, voce.appeso ? 1 : (misure.h || m0.h) / m0.h, (misure.d || m0.d) / m0.d);
    return g;
  }
  if (!t) { _fatti.set(chiave, 'attesa'); creaModerno(id, soffitto).then((g) => { _fatti.set(chiave, g); if (quandoPronto) quandoPronto(); }).catch(() => _fatti.set(chiave, 'errore')); }
  return null;
}
