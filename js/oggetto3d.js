// =============================================================================
// OGGETTI ED ELETTRODOMESTICI DALLE FOTO → 3D (friggitrice, microonde, vasi…)
// =============================================================================
// Stessa tecnica delle maniglie: ogni foto (davanti, lato, sopra) è già isolata
// dallo sfondo (PNG trasparente); le sagome, portate alle misure reali
// (larghezza × profondità × altezza), si incrociano e danno il volume; la
// superficie si leviga (marching cubes + Taubin) e prende i colori veri delle
// foto (anche quella da dietro, se c'è). Senza la foto da sopra la pianta è
// squadrata, tonda o ovale (scelta nella scheda).
// Assi (mm): x = larghezza (centro 0) · y = altezza (0 = appoggio) · z = profondità (+ = davanti)
// =============================================================================
import * as THREE from 'three';
import { edgeTable, triTable } from '../vendor/three/addons/objects/mc-tabelle.js';

/** Vista: alfa e colori di una foto isolata, normalizzata al suo contorno (u,v in 0..1). */
function vista(src) {
  if (!src) return null;
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 320 / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 5) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((q) => (d[q] + d[(w - 1) * 4 + q] + d[(h - 1) * w * 4 + q] + d[((h - 1) * w + w - 1) * 4 + q]) / 4);
  const A = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = haAlfa ? d[i * 4 + 3] / 255 : (Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > 40 ? 1 : 0);
  // bordo morbido (niente scalini)
  for (let pass = 0; pass < 2; pass++) {
    const B = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += A[yy * w + xx]; n++; } }
      B[y * w + x] = s / n;
    }
    A.set(B);
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const V = { w, h, A, d };
  V.alfa = (u, v) => {                                   // bilineare, 0 fuori dal contorno
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const x = x0 + u * (bw - 1), y = y0 + v * (bh - 1);
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : A[yy * w + xx]);
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
  V.col = (u, v) => {                                    // colore del pixel pieno più vicino
    u = Math.min(1, Math.max(0, u)); v = Math.min(1, Math.max(0, v));
    const cx = Math.round(x0 + u * (bw - 1)), cy = Math.round(y0 + v * (bh - 1));
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const i = yy * w + xx; if (A[i] > 0.6) return [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    }
    return null;
  };
  let sr = 0, sg = 0, sb = 0, nn = 0; for (let i = 0; i < w * h; i += 2) if (A[i] > 0.6) { sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; nn++; }
  V.media = nn ? [sr / nn, sg / nn, sb / nn] : [160, 160, 160];
  return V;
}

/**
 * Geometria 3D dell'oggetto. foto: { fronte (obbligatoria), lato, sopra, dietro }
 * (immagini isolate); W, D, H in mm; pianta: 'squadrata' | 'tonda' | 'ovale'
 * (vale solo senza la foto da sopra). Ritorna { geo, W, D, H, colore } o null.
 */
export function geometriaOggetto(foto, W, D, H, pianta = 'squadrata') {
  const F = vista(foto.fronte); if (!F) return null;
  const S = vista(foto.lato), T = vista(foto.sopra), B = vista(foto.dietro);
  W = Math.max(10, W); D = Math.max(10, D); H = Math.max(10, H);
  const passo = Math.max(W, D, H) / 96;
  const NX = Math.max(16, Math.round(W / passo)), NY = Math.max(16, Math.round(H / passo)), NZ = Math.max(16, Math.round(D / passo));
  const GX = NX + 2, GY = NY + 2, GZ = NZ + 2;
  const id = (i, j, k) => (k * GY + j) * GX + i;
  const occ = new Float32Array(GX * GY * GZ);
  const tonda = !T && (pianta === 'tonda' || pianta === 'ovale');
  for (let k = 1; k <= NZ; k++) for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
    const u = (i - 0.5) / NX, vy = 1 - (j - 0.5) / NY, wz = (k - 0.5) / NZ;          // wz: 0 = dietro, 1 = davanti
    let o = F.alfa(u, vy);
    if (o > 0 && S) o = Math.min(o, S.alfa(1 - wz, vy));                           // lato: a sinistra il davanti
    if (o > 0 && T) o = Math.min(o, T.alfa(u, wz));                                // sopra: in basso il davanti
    if (o > 0 && tonda) {
      const ex = (u - 0.5) * 2, ez = (wz - 0.5) * 2, r = Math.sqrt(ex * ex + ez * ez);
      o = Math.min(o, Math.max(0, Math.min(1, 0.5 + (1 - r) * Math.min(NX, NZ) / 2)));
    }
    occ[id(i, j, k)] = o;
  }
  // ammorbidisco (3×3×3)
  const f = new Float32Array(occ.length);
  for (let k = 1; k < GZ - 1; k++) for (let j = 1; j < GY - 1; j++) for (let i = 1; i < GX - 1; i++) {
    let s = 0; for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += occ[id(i + a, j + b, k + c)];
    f[id(i, j, k)] = s / 27;
  }
  const pos = (i, j, k) => [(i - 0.5) / NX * W - W / 2, (j - 0.5) / NY * H, (k - 0.5) / NZ * D - D / 2];
  // MARCHING CUBES con vertici condivisi
  const vert = [], ind = [], cache = new Map();
  const ang = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const spig = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const ISO = 0.5;
  for (let k = 0; k < GZ - 1; k++) for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
    let cubo = 0; const val = [];
    for (let c = 0; c < 8; c++) { const v = f[id(i + ang[c][0], j + ang[c][1], k + ang[c][2])]; val.push(v); if (v > ISO) cubo |= 1 << c; }
    const ci = (~cubo) & 255;
    if (!edgeTable[ci]) continue;
    const vSp = new Array(12);
    for (let e = 0; e < 12; e++) {
      if (!(edgeTable[ci] & (1 << e))) continue;
      const [a, b] = spig[e];
      const Aa = [i + ang[a][0], j + ang[a][1], k + ang[a][2]], Bb = [i + ang[b][0], j + ang[b][1], k + ang[b][2]];
      const ka = id(...Aa), kb = id(...Bb), chiave = ka < kb ? ka * 1e7 + kb : kb * 1e7 + ka;
      let vi = cache.get(chiave);
      if (vi === undefined) {
        const t = (ISO - val[a]) / ((val[b] - val[a]) || 1e-6);
        const pa = pos(...Aa), pb = pos(...Bb);
        vi = vert.length / 3; vert.push(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
        cache.set(chiave, vi);
      }
      vSp[e] = vi;
    }
    for (let q = 0; triTable[ci * 16 + q] !== -1; q += 3) ind.push(vSp[triTable[ci * 16 + q]], vSp[triTable[ci * 16 + q + 1]], vSp[triTable[ci * 16 + q + 2]]);
  }
  if (!ind.length) return null;
  // LEVIGATURA (Taubin)
  {
    const nV = vert.length / 3, vic = Array.from({ length: nV }, () => new Set());
    for (let q = 0; q < ind.length; q += 3) { const [a, b, c] = [ind[q], ind[q + 1], ind[q + 2]]; vic[a].add(b).add(c); vic[b].add(a).add(c); vic[c].add(a).add(b); }
    const passoT = (fatt) => {
      const nuovo = new Float32Array(vert.length);
      for (let v = 0; v < nV; v++) {
        let sx = 0, sy = 0, sz = 0, n = 0; for (const u of vic[v]) { sx += vert[u * 3]; sy += vert[u * 3 + 1]; sz += vert[u * 3 + 2]; n++; }
        for (let a = 0; a < 3; a++) { const m = n ? [sx, sy, sz][a] / n : vert[v * 3 + a]; nuovo[v * 3 + a] = vert[v * 3 + a] + fatt * (m - vert[v * 3 + a]); }
      }
      for (let i = 0; i < vert.length; i++) vert[i] = nuovo[i];
    };
    for (let it = 0; it < 6; it++) { passoT(0.5); passoT(-0.53); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, P = geo.attributes.position;
  let segno = 0; for (let v = 0; v < P.count; v += 7) segno += nrm.getX(v) * P.getX(v) + nrm.getY(v) * (P.getY(v) - H / 2) + nrm.getZ(v) * P.getZ(v);
  if (segno < 0) { for (let q = 0; q < ind.length; q += 3) { const t = ind[q + 1]; ind[q + 1] = ind[q + 2]; ind[q + 2] = t; } geo.setIndex(ind); geo.computeVertexNormals(); }
  // COLORI VERI: ogni faccia prende la foto che la guarda
  const lin = (c) => Math.pow(c / 255, 2.2);
  const cols = new Float32Array(P.count * 3);
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const nx = nrm.getX(v), ny = nrm.getY(v), nz = nrm.getZ(v);
    const u = (x + W / 2) / W, vy = 1 - y / H, wz = (z + D / 2) / D;
    const cand = [];
    if (nz > -0.2) { const c = F.col(u, vy); if (c) cand.push([c, Math.max(0.05, nz) + 0.1]); }
    if (nz < 0) { const c = B ? B.col(1 - u, vy) : F.col(u, vy); if (c) cand.push([c, -nz]); }
    if (S && Math.abs(nx) > 0.2) { const c = S.col(1 - wz, vy); if (c) cand.push([c, Math.abs(nx)]); }
    if (T && ny > 0.2) { const c = T.col(u, wz); if (c) cand.push([c, ny]); }
    let r = 0, g = 0, b = 0, sw = 0;
    for (const [c, wgt] of cand) { r += c[0] * wgt; g += c[1] * wgt; b += c[2] * wgt; sw += wgt; }
    const m = sw ? [r / sw, g / sw, b / sw] : F.media;
    cols[v * 3] = lin(m[0]); cols[v * 3 + 1] = lin(m[1]); cols[v * 3 + 2] = lin(m[2]);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const med = F.media;
  return { geo, W, D, H, colore: (Math.round(med[0]) << 16) | (Math.round(med[1]) << 8) | Math.round(med[2]) };
}

export function materialeOggetto() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12, envMapIntensity: 0.7 });
}

// ------------------------------------------------------------------ in cucina
const _cache = new Map();
function caricaImg(url) { return new Promise((ok, ko) => { if (!url) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; }); }
/**
 * Oggetto del catalogo (def.viste = { fronte, lato, sopra, dietro } URL, def.misure
 * = { w, d, h } mm, def.pianta). Ritorna { geo, mat } se pronto; altrimenti lo
 * prepara e richiama quandoPronto.
 */
export function oggettoDaFoto(def, quandoPronto) {
  const mi = def.misure || {};
  const chiave = `${def.id}|${mi.w}|${mi.d}|${mi.h}|${def.pianta}`;
  const c = _cache.get(chiave);
  if (c && c !== 'attesa' && c !== 'errore') return c;
  if (c) return null;
  _cache.set(chiave, 'attesa');
  const v = def.viste || {};
  Promise.all([caricaImg(v.fronte), caricaImg(v.lato), caricaImg(v.sopra), caricaImg(v.dietro)])
    .then(([fronte, lato, sopra, dietro]) => {
      const r = geometriaOggetto({ fronte, lato, sopra, dietro }, mi.w, mi.d, mi.h, def.pianta);
      if (!r) { _cache.set(chiave, 'errore'); return; }
      _cache.set(chiave, { geo: r.geo, mat: materialeOggetto() });
      if (quandoPronto) quandoPronto();
    })
    .catch(() => _cache.set(chiave, 'errore'));
  return null;
}

/** ANTEPRIMA 3D nella scheda: l'oggetto che gira, con un pezzo di piano sotto. */
export async function anteprimaOggetto(box, foto, W, D, H, pianta) {
  const { OrbitControls } = await import('../vendor/three/addons/controls/OrbitControls.js');
  box.innerHTML = '';
  const res = geometriaOggetto(foto, W, D, H, pianta);
  if (!res) { box.innerHTML = '<div class="imp-aiuto">Non riesco a costruire il 3D: controlla la foto davanti.</div>'; return () => {}; }
  const LW = Math.min(box.clientWidth || 320, 420), LH = 260;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(LW, LH);
  r.outputColorSpace = THREE.SRGBColorSpace;
  box.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xeae7e1);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 1.7); dl.position.set(1, 2, 3); sc.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.5); dl2.position.set(-2, 1, -1); sc.add(dl2);
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color(0xd8d4cc);
  sc.environment = pm.fromScene(env, 0.04).texture;
  sc.add(new THREE.Mesh(res.geo, materialeOggetto()));
  const piano = new THREE.Mesh(new THREE.BoxGeometry(W * 1.6 + 200, 20, D * 1.6 + 200), new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.6 }));
  piano.position.y = -10; sc.add(piano);
  const cam = new THREE.PerspectiveCamera(30, LW / LH, 1, 20000);
  const R = Math.max(W, D, H) * 2.9;
  cam.position.set(R * 0.5, H * 0.5 + R * 0.3, R * 0.8);
  const ctr = new OrbitControls(cam, r.domElement); ctr.target.set(0, H / 2, 0); ctr.enablePan = false; ctr.autoRotate = true; ctr.autoRotateSpeed = 2.2;
  let vivo = true;
  const giro = () => { if (!vivo) return; ctr.update(); r.render(sc, cam); requestAnimationFrame(giro); };
  giro();
  return () => { vivo = false; ctr.dispose(); r.dispose(); };
}
