// =============================================================================
// MANIGLIE 3D: modelli VERI per tipo (barra, piatta, profilo, pomolo, incasso,
// a bordo), con la misura e la finitura (inox, nero, oro…) della maniglia.
// =============================================================================
// La foto serve per riconoscere la finitura (colore) e per l'anteprima nel
// catalogo; la forma 3D è un modello pulito, così il risultato è sempre
// realistico qualunque foto carichi il cliente (anche storta o con sfondo).
// Assi (mm): x = lunghezza (−L/2..L/2) · y = altezza · z = sporgenza (0 = anta)
// =============================================================================
import * as THREE from 'three';

export const FORME_MANIGLIA = [
  { id: 'barra', nome: 'Barra tonda', svg: '<svg viewBox="0 0 48 24"><line x1="6" y1="9" x2="42" y2="9" stroke-width="5" stroke-linecap="round"/><line x1="12" y1="9" x2="12" y2="19"/><line x1="36" y1="9" x2="36" y2="19"/></svg>' },
  { id: 'piatta', nome: 'Barra piatta', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="6" rx="1"/><line x1="12" y1="12" x2="12" y2="19"/><line x1="36" y1="12" x2="36" y2="19"/></svg>' },
  { id: 'profilo', nome: 'Profilo (a J)', svg: '<svg viewBox="0 0 48 24"><polyline points="6,20 6,6 42,6 42,20" fill="none"/><line x1="6" y1="6" x2="6" y2="2"/><line x1="42" y1="6" x2="42" y2="2"/></svg>' },
  { id: 'bordo', nome: 'A bordo anta', svg: '<svg viewBox="0 0 48 24"><rect x="12" y="4" width="24" height="5"/><rect x="12" y="9" width="24" height="9" fill="none"/></svg>' },
  { id: 'pomolo', nome: 'Pomolo', svg: '<svg viewBox="0 0 48 24"><circle cx="24" cy="12" r="8"/></svg>' },
  { id: 'incasso', nome: 'Incasso (conchiglia)', svg: '<svg viewBox="0 0 48 24"><rect x="10" y="6" width="28" height="12" rx="5" fill="none"/><rect x="14" y="9" width="20" height="6" rx="3"/></svg>' },
];

export const FINITURE_MANIGLIA = [
  { id: 'inox', nome: 'Acciaio inox', colore: 0xc5c8cc, metal: 0.9, rough: 0.28 },
  { id: 'alluminio', nome: 'Alluminio', colore: 0xb9bcc0, metal: 0.75, rough: 0.42 },
  { id: 'nero', nome: 'Nero opaco', colore: 0x1c1c1c, metal: 0.35, rough: 0.5 },
  { id: 'antracite', nome: 'Antracite / titanio', colore: 0x4a4c50, metal: 0.8, rough: 0.35 },
  { id: 'oro', nome: 'Oro / ottone', colore: 0xc9a65c, metal: 0.92, rough: 0.28 },
  { id: 'bronzo', nome: 'Bronzo', colore: 0x6f5238, metal: 0.85, rough: 0.38 },
  { id: 'rame', nome: 'Rame', colore: 0xb2704a, metal: 0.9, rough: 0.3 },
  { id: 'bianco', nome: 'Bianco', colore: 0xeeeeec, metal: 0.05, rough: 0.4 },
];

/** Finitura più vicina a un colore (dalla foto). */
export function finituraVicina(col) {
  if (col == null) return 'inox';
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
  // grigi: dalla luminosità (la foto di un metallo lucido è spesso più scura o più chiara)
  if (sat < 28) return l < 55 ? 'nero' : l < 115 ? 'antracite' : l > 225 ? 'bianco' : l > 175 ? 'inox' : 'alluminio';
  let best = 'inox', bd = Infinity;
  for (const f of FINITURE_MANIGLIA) {
    const fr = (f.colore >> 16) & 255, fg = (f.colore >> 8) & 255, fb = f.colore & 255;
    const d = (r - fr) ** 2 * 0.3 + (g - fg) ** 2 * 0.59 + (b - fb) ** 2 * 0.11;
    if (d < bd) { bd = d; best = f.id; }
  }
  return best;
}

/** Forma proposta dalla sagoma della foto (rapporto lato corto / lato lungo). */
export function formaDaRapporto(rapporto) {
  if (rapporto > 0.6) return 'pomolo';
  return 'barra';
}

const _mat = new Map();
export function materialeFinitura(id) {
  if (_mat.has(id)) return _mat.get(id);
  const f = FINITURE_MANIGLIA.find((x) => x.id === id) || FINITURE_MANIGLIA[0];
  const m = new THREE.MeshStandardMaterial({ color: f.colore, metalness: f.metal, roughness: f.rough, envMapIntensity: f.metal > 0.5 ? 1.0 : 0.4 });
  _mat.set(id, m);
  return m;
}
const matOmbra = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9, metalness: 0 });

/** Cilindro lungo l'asse x. */
function barraX(L, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 24), mat);
  m.rotation.z = Math.PI / 2; return m;
}
/** Piedino (cilindro lungo z) da z=0 a z=h. */
function piedino(x, r, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, 0, h / 2); return m;
}
function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}

/**
 * Maniglia 3D pronta, centrata in (0,0) sulla faccia dell'anta (z = 0).
 * forma: id di FORME_MANIGLIA · finitura: id di FINITURE_MANIGLIA · L: lunghezza mm.
 * Per profilo / a bordo il lato "bordo anta" è in alto (+y).
 */
export function costruisciManiglia(forma, finitura, L) {
  const mat = materialeFinitura(finitura);
  const g = new THREE.Group();
  L = Math.max(20, L || 160);
  const inter = Math.max(L * 0.5, L - Math.max(24, L * 0.18));     // interasse dei piedini
  switch (forma) {
    case 'piatta': {
      const T = 6, H = Math.max(10, Math.min(16, L * 0.08)), sp = 26;
      g.add(box(L, H, T, 0, 0, sp + T / 2, mat));
      for (const s of [-inter / 2, inter / 2]) g.add(box(Math.min(10, H), Math.min(8, H * 0.7), sp, s, 0, sp / 2, mat));
      break;
    }
    case 'profilo': {
      // profilo in alluminio a J sul bordo dell'anta: piastra + labbro che sporge e scende
      const t = 2;
      g.add(box(L, 38, t, 0, -2, t / 2, mat));                // piastra sull'anta
      g.add(box(L, t, 22, 0, 17, 11, mat));                    // labbro sopra (sporge)
      g.add(box(L, 14, t, 0, 11, 22 - t / 2, mat));            // davanti che scende
      g.add(box(L, 12, 18, 0, 10, 11.5, matOmbra));            // ombra dentro la presa
      break;
    }
    case 'bordo': {
      // maniglia a bordo: aletta sul davanti dell'anta che gira sopra il bordo
      const t = 2.5;
      g.add(box(L, 30, t, 0, -4, t / 2, mat));
      g.add(box(L, t, 26, 0, 11, 13, mat));
      g.add(box(L, 12, t, 0, 5, 26, mat));
      break;
    }
    case 'pomolo': {
      const D = Math.max(18, Math.min(L, 45));
      g.add(piedino(0, Math.max(5, D * 0.22), 20, mat));
      const testa = new THREE.Mesh(new THREE.SphereGeometry(D / 2, 28, 18), mat);
      testa.scale.set(1, 1, 0.55); testa.position.set(0, 0, 20 + D * 0.25); g.add(testa);
      break;
    }
    case 'incasso': {
      // conchiglia a filo anta: cornice metallica + fondo scuro
      const H = Math.max(28, Math.min(48, L * 0.3)), c = 4, sp = 2;
      g.add(box(L, c, sp, 0, H / 2 - c / 2, sp / 2, mat));
      g.add(box(L, c, sp, 0, -H / 2 + c / 2, sp / 2, mat));
      g.add(box(c, H, sp, -L / 2 + c / 2, 0, sp / 2, mat));
      g.add(box(c, H, sp, L / 2 - c / 2, 0, sp / 2, mat));
      g.add(box(L - 2 * c, H - 2 * c, 1, 0, 0, 0.6, matOmbra));
      g.add(box(L - 2 * c, (H - 2 * c) * 0.45, 1.2, 0, (H - 2 * c) * 0.27, 0.9, mat));   // labbro di presa
      break;
    }
    default: {   // barra tonda a ponte
      const r = Math.max(5, Math.min(7, L * 0.04)), sp = 30;
      g.add((() => { const b = barraX(L, r, mat); b.position.z = sp + r; return b; })());
      for (const s of [-inter / 2, inter / 2]) g.add(piedino(s, r * 0.8, sp + r, mat));
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// =============================================================================
// 3D REALE DALLE FOTO (davanti + sopra + lato): volume dalle sagome, superficie
// liscia (marching cubes) e colori veri delle foto proiettati sulle facce.
// =============================================================================
import { edgeTable, triTable } from '../vendor/three/addons/objects/mc-tabelle.js';

/** Vista: alfa + colori di una foto scontornata (PNG trasparente), assi scambiabili. */
function vista(src, scambia = false) {
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 360 / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  // senza trasparenza (foto vecchie): sfondo = colore degli angoli
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 5) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((q) => (d[q] + d[(w - 1) * 4 + q] + d[(h - 1) * w * 4 + q] + d[((h - 1) * w + w - 1) * 4 + q]) / 4);
  const A = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = haAlfa ? d[i * 4 + 3] / 255 : (Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > 40 ? 1 : 0);
  // contorno della sagoma (u = primo asse, v = secondo)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const V = { w, h, A, d, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, scambia, flipU: false, flipV: false };
  V.eu = scambia ? V.bh : V.bw; V.ev = scambia ? V.bw : V.bh;      // estensioni sui due assi
  V.idx = (u, v) => {                                                // u,v in 0..1 sul contorno
    if (V.flipU) u = 1 - u; if (V.flipV) v = 1 - v;
    let x, y;
    if (scambia) { x = V.x0 + v * (V.bw - 1); y = V.y0 + u * (V.bh - 1); }
    else { x = V.x0 + u * (V.bw - 1); y = V.y0 + v * (V.bh - 1); }
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    return y * w + x;
  };
  V.alfa = (u, v) => { if (u < 0 || u > 1 || v < 0 || v > 1) return 0; const i = V.idx(u, v); return i < 0 ? 0 : A[i]; };
  V.col = (u, v) => { const i = V.idx(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))); return i < 0 || A[i] < 0.5 ? null : [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; };
  // pienezza media delle righe lungo v (per capire da che parte c'è l'anta)
  V.pieno = (v0, v1) => { let s = 0, n = 0; for (let v = v0; v <= v1; v += 0.02) for (let u = 0.02; u < 1; u += 0.04) { s += V.alfa(u, v) > 0.5 ? 1 : 0; n++; } return s / Math.max(1, n); };
  let sr = 0, sg = 0, sb = 0, nn = 0; for (let i = 0; i < w * h; i += 2) if (A[i] > 0.5) { sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; nn++; }
  V.media = [sr / nn, sg / nn, sb / nn];
  return V;
}

/** Lato dell'anta (z = 0) sul secondo asse: dove la sagoma è più "vuota" (piedini). */
function orientaVersoAnta(V) {
  const a = V.pieno(0, 0.22), b = V.pieno(0.78, 1);
  V.flipV = a < b - 0.04;           // v = 0 deve essere il lato LONTANO, v = 1 l'anta
}

/**
 * Geometria 3D dalla foto davanti (obbligatoria) e da sopra / di lato (facoltative).
 * L = lunghezza reale (mm). Ritorna { geo, L, T, D } con colori per vertice.
 */
export function geometriaDaViste(fronte, sopra, lato, L) {
  const F = vista(fronte, false);
  if (!F) return null;
  if (F.eu < F.ev) { F.scambia = true; F.eu = F.bh; F.ev = F.bw; }  // foto verticale → lunghezza sul primo asse
  const T = L * F.ev / F.eu;
  let S = sopra ? vista(sopra) : null, Lt = lato ? vista(lato) : null;
  let D = null;
  if (S) { if (S.bw < S.bh) { S = vista(sopra, true); } D = L * S.ev / S.eu; orientaVersoAnta(S); }
  if (Lt) {
    // di lato: un asse è l'altezza T, l'altro la sporgenza; scelgo l'abbinamento più coerente
    const prova = (sc) => { const V = vista(lato, sc); return { V, Dl: T * V.eu / V.ev }; };     // u = sporgenza, v = altezza
    const a = prova(false), b = prova(true);
    let sc;
    if (D) sc = Math.abs(a.Dl - D) <= Math.abs(b.Dl - D) ? a : b;
    else sc = a.Dl >= b.Dl ? a : b;                                // senza vista da sopra: la sporgenza è il lato lungo
    Lt = sc.V; if (!D) D = sc.Dl;
    // anta sul primo asse (u): scambio u/v per riusare la stessa misura
    const pu = (u0, u1) => { let s = 0, n = 0; for (let u = u0; u <= u1; u += 0.02) for (let v = 0.02; v < 1; v += 0.04) { s += Lt.alfa(u, v) > 0.5 ? 1 : 0; n++; } return s / Math.max(1, n); };
    Lt.flipU = pu(0, 0.22) < pu(0.78, 1) - 0.04;                  // u = 0 lontano, u = 1 anta
  }
  if (!D) D = Math.max(20, Math.min(60, T * 2.5));
  D = Math.max(6, Math.min(120, D));
  // griglia (anisotropa) con un bordo vuoto
  const NX = 120, NY = Math.max(18, Math.min(48, Math.round(120 * T / L * 1.6))), NZ = Math.max(18, Math.min(48, Math.round(120 * D / L * 1.6)));
  const GX = NX + 2, GY = NY + 2, GZ = NZ + 2;
  const occ = new Float32Array(GX * GY * GZ);
  const id = (i, j, k) => (k * GY + j) * GX + i;
  for (let k = 1; k <= NZ; k++) for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
    const u = (i - 0.5) / NX, vy = 1 - (j - 0.5) / NY, wz = (k - 0.5) / NZ;      // vy: 0 = sopra
    let o = F.alfa(u, vy) > 0.5;
    if (o && S) o = S.alfa(u, 1 - wz) > 0.5;                       // sopra: v = 1 anta (z = 0)
    if (o && Lt) o = Lt.alfa(1 - wz, vy) > 0.5;                    // lato: u = 1 anta
    occ[id(i, j, k)] = o ? 1 : 0;
  }
  // ammorbidisco (3×3×3) → bordi arrotondati come un pezzo vero
  const f = new Float32Array(occ.length);
  for (let k = 1; k < GZ - 1; k++) for (let j = 1; j < GY - 1; j++) for (let i = 1; i < GX - 1; i++) {
    let s = 0; for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += occ[id(i + a, j + b, k + c)];
    f[id(i, j, k)] = s / 27;
  }
  // posizione del nodo (mm): x −L/2..L/2, y −T/2..T/2, z 0..D
  const pos = (i, j, k) => [(i - 0.5) / NX * L - L / 2, (j - 0.5) / NY * T - T / 2, (k - 0.5) / NZ * D];
  // MARCHING CUBES con vertici condivisi sugli spigoli
  const vert = [], ind = [], cache = new Map();
  const ang = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const spig = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const ISO = 0.5;
  for (let k = 0; k < GZ - 1; k++) for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
    let cubo = 0; const val = [];
    for (let c = 0; c < 8; c++) { const v = f[id(i + ang[c][0], j + ang[c][1], k + ang[c][2])]; val.push(v); if (v > ISO) cubo |= 1 << c; }
    // tabelle three.js: bit = vertice SOTTO soglia → inverto
    const ci = (~cubo) & 255;
    if (!edgeTable[ci]) continue;
    const vSp = new Array(12);
    for (let e = 0; e < 12; e++) {
      if (!(edgeTable[ci] & (1 << e))) continue;
      const [a, b] = spig[e];
      const A = [i + ang[a][0], j + ang[a][1], k + ang[a][2]], B = [i + ang[b][0], j + ang[b][1], k + ang[b][2]];
      const ka = id(...A), kb = id(...B), chiave = ka < kb ? ka * 1e7 + kb : kb * 1e7 + ka;
      let vi = cache.get(chiave);
      if (vi === undefined) {
        const t = (ISO - val[a]) / ((val[b] - val[a]) || 1e-6);
        const pa = pos(...A), pb = pos(...B);
        vi = vert.length / 3; vert.push(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
        cache.set(chiave, vi);
      }
      vSp[e] = vi;
    }
    for (let q = 0; triTable[ci * 16 + q] !== -1; q += 3) ind.push(vSp[triTable[ci * 16 + q]], vSp[triTable[ci * 16 + q + 1]], vSp[triTable[ci * 16 + q + 2]]);
  }
  if (!ind.length) return null;
  // LEVIGATURA (Taubin: liscia senza restringere) → niente gradini dei voxel
  {
    const nV = vert.length / 3, vic = Array.from({ length: nV }, () => new Set());
    for (let q = 0; q < ind.length; q += 3) { const [a, b, c] = [ind[q], ind[q + 1], ind[q + 2]]; vic[a].add(b).add(c); vic[b].add(a).add(c); vic[c].add(a).add(b); }
    const passo = (fatt) => {
      const nuovo = new Float32Array(vert.length);
      for (let v = 0; v < nV; v++) {
        let sx = 0, sy = 0, sz = 0, n = 0; for (const u of vic[v]) { sx += vert[u * 3]; sy += vert[u * 3 + 1]; sz += vert[u * 3 + 2]; n++; }
        for (let a = 0; a < 3; a++) { const m = n ? [sx, sy, sz][a] / n : vert[v * 3 + a]; nuovo[v * 3 + a] = vert[v * 3 + a] + fatt * (m - vert[v * 3 + a]); }
      }
      for (let i = 0; i < vert.length; i++) vert[i] = nuovo[i];
    };
    for (let it = 0; it < 6; it++) { passo(0.5); passo(-0.53); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  // le facce devono guardare fuori: se la normale media punta dentro, giro i triangoli
  const nrm = geo.attributes.normal, P = geo.attributes.position;
  let segno = 0; for (let v = 0; v < P.count; v += 7) segno += nrm.getX(v) * P.getX(v) + nrm.getY(v) * P.getY(v) + nrm.getZ(v) * (P.getZ(v) - D / 2);
  if (segno < 0) { for (let q = 0; q < ind.length; q += 3) { const t = ind[q + 1]; ind[q + 1] = ind[q + 2]; ind[q + 2] = t; } geo.setIndex(ind); geo.computeVertexNormals(); }
  // COLORI VERI dalle foto: ogni faccia prende la foto che la guarda
  const lin = (c) => Math.pow(c / 255, 2.2);
  const cols = new Float32Array(P.count * 3);
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const nx = Math.abs(nrm.getX(v)), ny = Math.abs(nrm.getY(v)), nz = Math.abs(nrm.getZ(v));
    const u = (x + L / 2) / L, vy = 0.5 - y / T, wz = z / D;
    const cand = [];
    const cF = F.col(u, vy); if (cF) cand.push([cF, nz + 0.15]);
    if (S) { const c = S.col(u, 1 - wz); if (c) cand.push([c, ny + 0.05]); }
    if (Lt) { const c = Lt.col(1 - wz, vy); if (c) cand.push([c, nx + 0.05]); }
    let r = 0, g = 0, b = 0, sw = 0;
    for (const [c, wgt] of cand) { r += c[0] * wgt; g += c[1] * wgt; b += c[2] * wgt; sw += wgt; }
    const m = sw ? [r / sw, g / sw, b / sw] : F.media;
    cols[v * 3] = lin(m[0]); cols[v * 3 + 1] = lin(m[1]); cols[v * 3 + 2] = lin(m[2]);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const med = F.media;
  return { geo, L, T, D, colore: (Math.round(med[0]) << 16) | (Math.round(med[1]) << 8) | Math.round(med[2]) };
}

/** Materiale per la maniglia dalle foto: colori della foto + lucentezza della finitura. */
function materialeDaFoto(finitura) {
  const f = FINITURE_MANIGLIA.find((x) => x.id === finitura) || FINITURE_MANIGLIA[0];
  return new THREE.MeshStandardMaterial({ vertexColors: true, metalness: Math.min(0.75, f.metal), roughness: Math.max(0.3, f.rough), envMapIntensity: 0.8 });
}

const _cacheFoto = new Map();     // id → { mesh dati } | 'attesa' | 'errore'
function caricaImg(url) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; }); }

/**
 * Maniglia dalle foto del catalogo (def.texture davanti, def.vistaSopra, def.vistaLato).
 * Ritorna { geo, mat } se pronta; altrimenti la prepara e richiama quandoPronta.
 */
export function manigliaDaFoto(def, quandoPronta) {
  const c = _cacheFoto.get(def.id);
  if (c && c !== 'attesa' && c !== 'errore') return c;
  if (c) return null;
  _cacheFoto.set(def.id, 'attesa');
  Promise.all([caricaImg(def.texture), def.vistaSopra ? caricaImg(def.vistaSopra) : null, def.vistaLato ? caricaImg(def.vistaLato) : null])
    .then(([f, s, l]) => {
      const r = geometriaDaViste(f, s, l, def.lunghezzaMm || 160);
      if (!r) { _cacheFoto.set(def.id, 'errore'); return; }
      _cacheFoto.set(def.id, { geo: r.geo, mat: materialeDaFoto(def.finitura || finituraVicina(r.colore)) });
      if (quandoPronta) quandoPronta();
    })
    .catch(() => _cacheFoto.set(def.id, 'errore'));
  return null;
}

/**
 * ANTEPRIMA 3D nella scheda: la maniglia costruita dalle viste, che gira e si
 * può ruotare col dito. Ritorna una funzione per chiuderla.
 */
export async function anteprimaManiglia(box, fronte, sopra, lato, L, finitura, forma = 'barra') {
  const { OrbitControls } = await import('../vendor/three/addons/controls/OrbitControls.js');
  box.innerHTML = '';
  const W = Math.min(box.clientWidth || 320, 420), H = 220;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(W, H);
  r.outputColorSpace = THREE.SRGBColorSpace;
  box.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xeae7e1);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, 2, 3); sc.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.6); dl2.position.set(-2, -1, 1); sc.add(dl2);
  // ambiente semplice per i riflessi del metallo
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color(0xd8d4cc);
  const lampada = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })); lampada.position.set(0, 2, 0); lampada.rotation.x = Math.PI / 2; env.add(lampada);
  sc.environment = pm.fromScene(env, 0.04).texture;
  // con sopra/lato: 3D ricostruito dalle foto; con la sola foto davanti: modello della forma scelta
  const res = (sopra || lato) ? geometriaDaViste(fronte, sopra, lato, L) : null;
  const grp = new THREE.Group();
  let misure;
  if (res) {
    grp.add(new THREE.Mesh(res.geo, materialeDaFoto(finitura || finituraVicina(res.colore))));
    misure = { T: res.T, D: res.D };
  } else {
    const gp = costruisciManiglia(forma || 'barra', finitura || 'inox', L); grp.add(gp);
    const bb = new THREE.Box3().setFromObject(gp); misure = { T: bb.max.y - bb.min.y, D: bb.max.z };
  }
  const res2 = misure;
  // pezzo di anta dietro (per capire come sporge)
  const anta = new THREE.Mesh(new THREE.BoxGeometry(L * 1.3, Math.max(res2.T * 3, 60), 4), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.8 }));
  anta.position.z = -2; grp.add(anta);
  sc.add(grp);
  const cam = new THREE.PerspectiveCamera(30, W / H, 1, 5000);
  const R = Math.max(L, res2.D * 3) * 1.25;
  cam.position.set(R * 0.45, R * 0.35, R * 0.85); cam.lookAt(0, 0, res2.D / 2);
  const ctr = new OrbitControls(cam, r.domElement); ctr.target.set(0, 0, res2.D / 2); ctr.enablePan = false; ctr.autoRotate = true; ctr.autoRotateSpeed = 2.5;
  let vivo = true;
  const giro = () => { if (!vivo) return; ctr.update(); r.render(sc, cam); requestAnimationFrame(giro); };
  giro();
  box._misure = res2;
  return () => { vivo = false; ctr.dispose(); r.dispose(); };
}
