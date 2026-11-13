// =============================================================================
// MANIGLIA 3D DALLE FOTO (in automatico, per qualsiasi cliente)
// =============================================================================
// Dalle sagome delle foto della maniglia (davanti, e se ci sono lato e sopra)
// si ricava il VOLUME vero: si tiene solo lo spazio che sta dentro a tutte le
// sagome ("involucro visivo"). Poi la superficie si leviga e si colora con i
// colori veri delle foto. Assi della maniglia (in mm):
//   x = lunghezza (−L/2..L/2) · y = altezza (−T/2..T/2) · z = sporgenza (0 = anta)
// Nessuna vista è obbligatoria oltre a una: con la sola foto davanti si usa
// la barra con i piedini (scena3d.js).
// =============================================================================
import * as THREE from 'three';

const _cache = new Map();          // id → { geo, colore } | 'attesa'

function caricaImg(url) {
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
}

/** Maschera (sagoma) + colori di una foto già scontornata (PNG con trasparenza). */
function maschera(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height;
  // trasparenza se c'è, altrimenti differenza dal colore degli angoli (sfondo)
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((k) => (d[k] + d[(w - 1) * 4 + k] + d[((h - 1) * w) * 4 + k] + d[((h - 1) * w + w - 1) * 4 + k]) / 4);
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    m[i] = haAlfa ? (d[i * 4 + 3] > 128 ? 1 : 0)
      : (Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > 40 ? 1 : 0);
  }
  // ritaglio al contorno della sagoma
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  return { m, d, w, h, x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
}

/** Vista come funzione (u,v ∈ 0..1 nel riquadro della sagoma) → dentro? e colore. */
function vista(M, ruota = false, specchiaU = false, specchiaV = false) {
  const lato = (u, v) => {
    if (ruota) [u, v] = [v, u];
    if (specchiaU) u = 1 - u;
    if (specchiaV) v = 1 - v;
    const x = Math.min(M.x1, Math.max(M.x0, Math.round(M.x0 + u * (M.bw - 1))));
    const y = Math.min(M.y1, Math.max(M.y0, Math.round(M.y0 + v * (M.bh - 1))));
    return y * M.w + x;
  };
  return {
    dentro: (u, v) => M.m[lato(u, v)] === 1,
    colore: (u, v) => { const i = lato(u, v) * 4; return [M.d[i], M.d[i + 1], M.d[i + 2]]; },
    larg: ruota ? M.bh : M.bw, alt: ruota ? M.bw : M.bh,
  };
}

/** Copertura media delle due metà (per capire da che parte c'è l'anta). */
function piuPienoVersoFine(V, lungoV) {
  let a = 0, b = 0, n = 0;
  for (let s = 0; s < 40; s++) for (let t = 0; t < 10; t++) {
    const p = (s + 0.5) / 40, q = (t + 0.5) / 20;          // prima metà / seconda metà
    if (lungoV) { a += V.dentro(p, q); b += V.dentro(p, 1 - q); } else { a += V.dentro(q, p); b += V.dentro(1 - q, p); }
    n++;
  }
  return b > a;
}

/**
 * Costruisce (una volta per maniglia) la geometria 3D dalle viste.
 * def: { id, texture (davanti), vistaSopra?, vistaLato?, lunghezzaMm }
 * Ritorna la voce di cache quando pronta, null se non serve (solo davanti).
 */
export function maniglia3D(def, quandoPronta) {
  if (!def || !(def.vistaSopra || def.vistaLato)) return null;
  const c = _cache.get(def.id);
  if (c && c !== 'attesa') return c;
  if (!c) {
    _cache.set(def.id, 'attesa');
    costruisci(def).then((r) => { _cache.set(def.id, r); if (r && quandoPronta) quandoPronta(); })
      .catch((e) => { console.warn('Maniglia 3D non costruita', e); _cache.set(def.id, null); });
  }
  return null;
}

async function costruisci(def) {
  const [iF, iS, iL] = await Promise.all([def.texture, def.vistaSopra, def.vistaLato].map((u) => (u ? caricaImg(u) : null)));
  const mF = iF && maschera(iF), mS = iS && maschera(iS), mL = iL && maschera(iL);
  // DAVANTI: lunghezza in orizzontale (x), altezza in verticale (y)
  let F = mF ? vista(mF, mF.bh > mF.bw) : null;
  const L = def.lunghezzaMm || 150;
  let T = F ? L * F.alt / F.larg : L * 0.08;
  // SOPRA: lunghezza (x) × sporgenza (z); il lato più "pieno" è la barra (davanti)
  let S = null, P = null;
  if (mS) {
    S = vista(mS, mS.bh > mS.bw);
    P = L * S.alt / S.larg;
    // v = 0 in alto nella foto: voglio v → z crescente dall'anta (0) alla barra (1)
    const barraInAlto = !piuPienoVersoFine(S, true);
    S = vista(mS, mS.bh > mS.bw, false, barraInAlto);
  }
  // LATO: se è una vista "lunga" (lunghezza × sporgenza) vale come vista da sopra;
  // altrimenti è la sezione: sporgenza (orizzontale) × altezza (verticale)
  let Lt = null;
  if (mL) {
    const lungo = Math.max(mL.bw, mL.bh) / Math.min(mL.bw, mL.bh) > 3;
    if (lungo && !S) {
      S = vista(mL, mL.bh > mL.bw); P = L * S.alt / S.larg;
      S = vista(mL, mL.bh > mL.bw, false, !piuPienoVersoFine(S, true));
    } else if (!lungo) {
      Lt = vista(mL, false);                               // u = sporgenza, v = altezza
      if (!P) P = T * Lt.larg / Lt.alt;
      Lt = vista(mL, false, !piuPienoVersoFine(Lt, false), false);
    }
  }
  if (!P) P = 30;
  P = Math.max(10, Math.min(120, P));
  // GRIGLIA di cubetti: dentro se è dentro a TUTTE le sagome presenti
  const NX = 180, vs = L / NX;
  const NY = Math.max(6, Math.min(60, Math.round(T / vs))), NZ = Math.max(6, Math.min(80, Math.round(P / vs)));
  const vy = T / NY, vz = P / NZ;
  const pieno = new Uint8Array(NX * NY * NZ);
  const idx = (i, j, k) => (k * NY + j) * NX + i;
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const u = (i + 0.5) / NX, v = 1 - (j + 0.5) / NY, w = (k + 0.5) / NZ;   // v: immagine dall'alto
    if (F && !F.dentro(u, v)) continue;
    if (S && !S.dentro(u, w)) continue;
    if (Lt && !Lt.dentro(w, v)) continue;
    pieno[idx(i, j, k)] = 1;
  }
  // SUPERFICIE: facce dei cubetti verso il vuoto, vertici condivisi
  const vert = new Map(), pos = [], tri = [];
  const vId = (i, j, k) => {
    const key = (k * (NY + 1) + j) * (NX + 1) + i;
    let id = vert.get(key);
    if (id === undefined) { id = pos.length / 3; vert.set(key, id); pos.push(i * vs - L / 2, j * vy - T / 2, k * vz); }
    return id;
  };
  const vuoto = (i, j, k) => i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ || !pieno[idx(i, j, k)];
  const quad = (a, b, c, d) => { tri.push(a, b, c, a, c, d); };
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!pieno[idx(i, j, k)]) continue;
    if (vuoto(i + 1, j, k)) quad(vId(i + 1, j, k), vId(i + 1, j + 1, k), vId(i + 1, j + 1, k + 1), vId(i + 1, j, k + 1));
    if (vuoto(i - 1, j, k)) quad(vId(i, j, k), vId(i, j, k + 1), vId(i, j + 1, k + 1), vId(i, j + 1, k));
    if (vuoto(i, j + 1, k)) quad(vId(i, j + 1, k), vId(i, j + 1, k + 1), vId(i + 1, j + 1, k + 1), vId(i + 1, j + 1, k));
    if (vuoto(i, j - 1, k)) quad(vId(i, j, k), vId(i + 1, j, k), vId(i + 1, j, k + 1), vId(i, j, k + 1));
    if (vuoto(i, j, k + 1)) quad(vId(i, j, k + 1), vId(i + 1, j, k + 1), vId(i + 1, j + 1, k + 1), vId(i, j + 1, k + 1));
    if (vuoto(i, j, k - 1)) quad(vId(i, j, k), vId(i, j + 1, k), vId(i + 1, j + 1, k), vId(i + 1, j, k));
  }
  if (!tri.length) return null;
  // LEVIGATURA (niente gradini): ogni vertice verso la media dei vicini
  const nV = pos.length / 3, vicini = Array.from({ length: nV }, () => new Set());
  for (let t = 0; t < tri.length; t += 3) {
    const [a, b, c] = [tri[t], tri[t + 1], tri[t + 2]];
    vicini[a].add(b).add(c); vicini[b].add(a).add(c); vicini[c].add(a).add(b);
  }
  let P0 = Float32Array.from(pos);
  for (let it = 0; it < 16; it++) {
    const P1 = new Float32Array(P0.length), lam = it % 2 ? -0.52 : 0.5;   // Taubin: non si restringe
    for (let v = 0; v < nV; v++) {
      let sx = 0, sy = 0, sz = 0; for (const n of vicini[v]) { sx += P0[n * 3]; sy += P0[n * 3 + 1]; sz += P0[n * 3 + 2]; }
      const c = vicini[v].size || 1;
      for (let q = 0; q < 3; q++) P1[v * 3 + q] = P0[v * 3 + q] + lam * ([sx, sy, sz][q] / c - P0[v * 3 + q]);
      if (P0[v * 3 + 2] <= 0.01) P1[v * 3 + 2] = 0;      // la base resta appoggiata all'anta
    }
    P0 = P1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P0, 3));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  // COLORI dalle foto: ogni punto prende il colore della vista da cui si vede
  const nor = geo.attributes.normal, col = new Float32Array(nV * 3);
  const media = [0, 0, 0]; let nm = 0;
  for (let v = 0; v < nV; v++) {
    const x = (P0[v * 3] + L / 2) / L, y = 1 - (P0[v * 3 + 1] + T / 2) / T, z = P0[v * 3 + 2] / P;
    const ax = Math.abs(nor.getX(v)), ay = Math.abs(nor.getY(v)), az = Math.abs(nor.getZ(v));
    let c = null;
    if (az >= ax && az >= ay && F) c = F.colore(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    else if (ay >= ax && S) c = S.colore(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, z)));
    else if (Lt) c = Lt.colore(Math.min(1, Math.max(0, z)), Math.min(1, Math.max(0, y)));
    else if (F) c = F.colore(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    if (c) { col[v * 3] = c[0] / 255; col[v * 3 + 1] = c[1] / 255; col[v * 3 + 2] = c[2] / 255; media[0] += c[0]; media[1] += c[1]; media[2] += c[2]; nm++; }
  }
  for (let v = 0; v < nV; v++) if (!col[v * 3] && !col[v * 3 + 1] && !col[v * 3 + 2] && nm) {
    col[v * 3] = media[0] / nm / 255; col[v * 3 + 1] = media[1] / nm / 255; col[v * 3 + 2] = media[2] / nm / 255;
  }
  // colori della foto (sRGB) → lineari per il rendering
  for (let q = 0; q < col.length; q++) col[q] = col[q] <= 0.04045 ? col[q] / 12.92 : Math.pow((col[q] + 0.055) / 1.055, 2.4);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cm = new THREE.Color(nm ? media[0] / nm / 255 : 0.5, nm ? media[1] / nm / 255 : 0.5, nm ? media[2] / nm / 255 : 0.5);
  const hsl = {}; cm.getHSL(hsl);
  const metallo = hsl.s < 0.18;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metallo ? 0.32 : 0.5,
    metalness: metallo ? 0.7 : 0.1, envMapIntensity: metallo ? 0.9 : 0.4 });
  return { geo, mat, L, T, P };
}
