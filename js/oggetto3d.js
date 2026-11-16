// =============================================================================
// OGGETTI ED ELETTRODOMESTICI DALLE FOTO → 3D (friggitrice, microonde, vasi…)
// =============================================================================
// Stessa tecnica delle maniglie, con le FOTO VERE sopra:
// 1) ogni foto è già isolata dallo sfondo (PNG trasparente, alta risoluzione);
// 2) FORMA: le sagome (davanti, lato, sopra), portate alle misure reali
//    (larghezza × profondità × altezza), si incrociano e danno il volume; la
//    superficie si leviga (marching cubes + Taubin). Senza la foto da sopra:
//    - le parti che sporgono davanti (es. la maniglia del cestello) prendono la
//      larghezza vista nella foto davanti, non tutta la larghezza;
//    - la pianta può essere squadrata, tonda o ovale (scelta nella scheda);
// 3) ASPETTO: ogni faccia prende la FOTO che la guarda, in alta risoluzione:
//    davanti, dietro, i due lati (la stessa foto, specchiata), sopra.
// Assi (mm): x = larghezza (centro 0) · y = altezza (0 = appoggio) · z = profondità (+ = davanti)
// =============================================================================
import * as THREE from 'three';
import { edgeTable, triTable } from '../vendor/three/addons/objects/mc-tabelle.js';

/** Analisi di una foto isolata: sagoma (alfa), colori, contorno, simmetria, dettaglio. */
function vista(src) {
  if (!src) return null;
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 360 / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 5) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((q) => (d[q] + d[(w - 1) * 4 + q] + d[(h - 1) * w * 4 + q] + d[((h - 1) * w + w - 1) * 4 + q]) / 4);
  const A = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = haAlfa ? d[i * 4 + 3] / 255 : (Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > 40 ? 1 : 0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const V = { src, w, h, A, d, x0, y0, bw, bh, flipU: false };
  V.aspetto = bw / bh;
  const X = (u) => x0 + (V.flipU ? 1 - u : u) * (bw - 1), Y = (v) => y0 + v * (bh - 1);
  V.alfa = (u, v) => {                                     // bilineare, 0 fuori dal contorno
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const x = X(u), y = Y(v);
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : A[yy * w + xx]);
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
  V.col = (u, v) => {
    const xi = Math.round(X(Math.min(1, Math.max(0, u)))), yi = Math.round(Y(Math.min(1, Math.max(0, v))));
    const i = yi * w + xi; return A[i] > 0.6 ? [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] : null;
  };
  // colore mediano dell'oggetto
  const rr = [], gg = [], bb = [];
  for (let i = 0; i < w * h; i += 3) if (A[i] > 0.6) { rr.push(d[i * 4]); gg.push(d[i * 4 + 1]); bb.push(d[i * 4 + 2]); }
  const med = (l) => { l.sort((p, q) => p - q); return l[l.length >> 1] || 128; };
  V.media = [med(rr), med(gg), med(bb)];
  // SIMMETRIA destra/sinistra della sagoma (davanti/dietro ~1, lato con maniglia < 1)
  let inter = 0, uni = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const a = A[y * w + x] > 0.5, b = A[y * w + (x0 + x1 - x)] > 0.5;
    if (a && b) inter++; if (a || b) uni++;
  }
  V.simmetria = uni ? inter / uni : 1;
  // DETTAGLIO: bordi interni + scritte/luci chiare (il davanti ha comandi, display, logo)
  let bordi = 0, chiari = 0, n = 0;
  const lum = (i) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const Lm = 0.299 * V.media[0] + 0.587 * V.media[1] + 0.114 * V.media[2];
  for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) {
    const i = y * w + x; if (A[i] < 0.9 || A[i - 2] < 0.9 || A[i + 2] < 0.9 || A[i - 2 * w] < 0.9 || A[i + 2 * w] < 0.9) continue;
    n++;
    const gx = lum(i + 1) - lum(i - 1), gy = lum(i + w) - lum(i - w);
    if (Math.hypot(gx, gy) > 40) bordi++;
    if (lum(i) > Lm + 70) chiari++;
  }
  V.dettaglio = n ? (bordi + 3 * chiari) / n : 0;
  return V;
}

/**
 * RICONOSCE LE VISTE: date le foto messe nelle caselle { fronte, dietro, lato, sopra },
 * dice in quale casella va davvero ognuna. Le foto prodotto del davanti sono spesso
 * scattate un po' dall'alto e finiscono in "sopra": se una foto ha la stessa sagoma
 * simmetrica del davanti/dietro, è un davanti o un dietro; il DAVANTI è quella con
 * più dettagli (comandi, display, logo, maniglia). Il LATO è la sagoma asimmetrica.
 * Ritorna { fronte: chiaveOrigine, … } solo per le caselle che cambiano, o null.
 */
export function riconosciViste(foto) {
  const V = {};
  for (const k of ['fronte', 'dietro', 'lato', 'sopra']) if (foto[k]) V[k] = vista(foto[k]);
  const chiavi = Object.keys(V).filter((k) => V[k]);
  if (chiavi.length < 2) return null;
  const nuovo = {};
  // lato: la più asimmetrica, se è chiaramente meno simmetrica delle altre
  const perSim = [...chiavi].sort((a, b) => V[a].simmetria - V[b].simmetria);
  const lato = V[perSim[0]].simmetria < 0.86 && (perSim.length < 2 || V[perSim[1]].simmetria - V[perSim[0]].simmetria > 0.05) ? perSim[0] : (V.lato ? 'lato' : null);
  // davanti/dietro: le sagome simmetriche con proporzioni simili
  const rif = ['fronte', 'dietro', 'sopra'].filter((k) => V[k] && k !== lato);
  const simili = [];
  for (const k of rif) {
    if (V[k].simmetria < 0.86) continue;
    const altri = rif.filter((q) => q !== k && V[q].simmetria >= 0.86);
    const ok = !altri.length || altri.some((q) => Math.abs(V[q].aspetto - V[k].aspetto) / V[q].aspetto < 0.14);
    if (k !== 'sopra' || (altri.length && ok)) simili.push(k);
  }
  simili.sort((a, b) => V[b].dettaglio - V[a].dettaglio);
  // davanti/dietro si decidono solo confrontando almeno DUE foto simili; se no ognuna resta dov'è
  if (simili.length >= 2) { nuovo.fronte = simili[0]; nuovo.dietro = simili[1]; }
  else for (const k of rif) if (k !== 'sopra' || !V.sopra || simili.includes('sopra')) nuovo[k] = k;
  if (lato) nuovo.lato = lato;
  const usate = new Set(Object.values(nuovo));
  const resto = chiavi.filter((k) => !usate.has(k));
  if (resto.length && !nuovo.sopra) { const s = resto.find((k) => k === 'sopra') || resto[0]; if (!nuovo[s] || s === 'sopra') nuovo.sopra = s; }
  // solo i cambi veri
  const cambi = {};
  for (const [dest, orig] of Object.entries(nuovo)) if (dest !== orig) cambi[dest] = orig;
  return Object.keys(cambi).length ? { mappa: nuovo, cambi } : null;
}

/**
 * PROFILO di una sagoma riga per riga: per ogni riga v (0 = in alto) il bordo
 * sinistro e destro (u 0..1, con la frazione di pixel), ripulito: filtro mediano
 * e, dove il bordo è quasi dritto, raddrizzato del tutto (facce piatte, niente gradini).
 */
function profilo(V) {
  const { w, A, x0, y0, bw, bh } = V;
  const n = bh, L = new Float32Array(n).fill(NaN), R = new Float32Array(n).fill(NaN);
  for (let r = 0; r < n; r++) {
    const y = y0 + r, base = y * w;
    let l = -1, rr = -1;
    for (let x = x0; x < x0 + bw; x++) if (A[base + x] > 0.5) { if (l < 0) l = x; rr = x; }
    if (l < 0) continue;
    // bordo al pixel con la frazione (dove l'alfa passa 0.5)
    const al = l > 0 ? A[base + l - 1] : 0, ar = rr < w - 1 ? A[base + rr + 1] : 0;
    const fl = l - Math.max(0, Math.min(1, (A[base + l] - 0.5) / Math.max(0.01, A[base + l] - al))) + 0.5;
    const fr = rr + Math.max(0, Math.min(1, (A[base + rr] - 0.5) / Math.max(0.01, A[base + rr] - ar))) - 0.5;
    L[r] = (fl - x0) / Math.max(1, bw - 1); R[r] = (fr - x0) / Math.max(1, bw - 1);
  }
  const mediana = (arr) => { const t = [...arr].filter((x) => !Number.isNaN(x)).sort((p, q) => p - q); return t.length ? t[t.length >> 1] : NaN; };
  const filtra = (arr) => {
    const out = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      if (Number.isNaN(arr[r])) { out[r] = NaN; continue; }
      const fin = []; for (let q = Math.max(0, r - 3); q <= Math.min(n - 1, r + 3); q++) if (!Number.isNaN(arr[q])) fin.push(arr[q]);
      fin.sort((p, q) => p - q); out[r] = fin[fin.length >> 1];
    }
    const m = mediana(out);
    for (let r = 0; r < n; r++) if (!Number.isNaN(out[r]) && Math.abs(out[r] - m) < 0.018) out[r] = m;   // quasi dritto → dritto
    return { v: out, m };
  };
  const fl = filtra(L), fr = filtra(R);
  const at = (arr, v) => {                                 // valore alla riga v (0..1), interpolato
    const x = Math.min(n - 1, Math.max(0, v * (n - 1))), i = Math.floor(x), t = x - i;
    const a0 = arr[i], a1 = arr[Math.min(n - 1, i + 1)];
    if (Number.isNaN(a0)) return a1; if (Number.isNaN(a1)) return a0;
    return a0 * (1 - t) + a1 * t;
  };
  return { sx: (v) => at(fl.v, v), dx: (v) => at(fr.v, v), mSx: fl.m, mDx: fr.m, righe: n };
}

/** Maniglia (sporgenza davanti) nella foto davanti: le colonne diverse dal cassetto AI SUOI LATI. */
function trovaManiglia(F, v0, v1) {
  const ref = [];
  for (let v = v0; v <= v1; v += (v1 - v0) / 20 || 0.01) for (const u of [0.08, 0.12, 0.16, 0.84, 0.88, 0.92]) { const c = F.col(u, v); if (c) ref.push(c); }
  if (ref.length < 6) return null;
  const mc = [0, 1, 2].map((q) => ref.map((c) => c[q]).sort((a, b) => a - b)[ref.length >> 1]);
  const N = 200, fr = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N; let si = 0, n = 0;
    for (let k = 0; k <= 24; k++) {
      const v = v0 + (v1 - v0) * (0.1 + 0.8 * k / 24), c = F.col(u, v); if (!c) continue;
      n++; if (Math.hypot(c[0] - mc[0], c[1] - mc[1], c[2] - mc[2]) > 20) si++;
    }
    fr[i] = n ? si / n : 0;
  }
  const on = fr.map((x) => x > 0.45);
  let best = null;
  for (let i = 0; i < N;) {
    if (!on[i]) { i++; continue; }
    let j = i; while (j + 1 < N && (on[j + 1] || (j + 3 < N && (on[j + 2] || on[j + 3])))) j++;
    const a = i / N, b = (j + 1) / N, cen = (a + b) / 2;
    if (cen > 0.2 && cen < 0.8 && (!best || Math.abs(cen - 0.5) < Math.abs((best.a + best.b) / 2 - 0.5))) best = { a, b };
    i = j + 1;
  }
  if (!best || best.b - best.a < 0.04 || best.b - best.a > 0.8) return null;
  return best;
}

/** Texture ad alta risoluzione della foto isolata, col colore che "trabocca" oltre il bordo (niente aloni). */
function texturaVista(src) {
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 1024 / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const im = g.getImageData(0, 0, w, h), d = im.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const pieno = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i * 4 + 3] > 128) { pieno[i] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  for (let pass = 0; pass < 10; pass++) {
    const nuovi = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (pieno[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || !pieno[j]) continue; r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
      }
      if (n) nuovi.push([i, r / n, gg / n, b / n]);
    }
    if (!nuovi.length) break;
    for (const [i, r, gg, b] of nuovi) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; pieno[i] = 1; }
  }
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  g.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, bx0: x0 / w, by0: y0 / h, bw: (x1 - x0 + 1) / w, bh: (y1 - y0 + 1) / h };
}
const hex = (rgb) => (Math.round(rgb[0]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[2]);

/**
 * Geometria 3D dell'oggetto + materiali con le foto. foto: { fronte (obbligatoria),
 * lato, sopra, dietro } (immagini isolate); W, D, H in mm; pianta: 'squadrata' |
 * 'tonda' | 'ovale' (solo senza la foto da sopra). Ritorna { geo, mats, colore } o null.
 */
/**
 * DAVANTI o LATO? Con le MISURE si capisce quale foto è quale: il davanti è
 * largo come la larghezza, il lato come la profondità (in proporzione
 * all'altezza). Se le due foto sono messe al contrario (es. tostapane: foto
 * stretta come davanti e foto lunga come lato) ritorna true = vanno scambiate.
 */
export function vistaScambiata(fFronte, fLato, W, D, H) {
  const F = vista(fFronte), S = vista(fLato);
  if (!F || !S || !(W > 0 && D > 0 && H > 0)) return false;
  const eF = W / H, eS = D / H;
  if (Math.abs(Math.log(eF / eS)) < 0.15) return false;           // larghezza ≈ profondità: non si capisce
  const err = (a, e) => Math.abs(Math.log(a / e));
  return err(S.aspetto, eF) + err(F.aspetto, eS) + 0.15 < err(F.aspetto, eF) + err(S.aspetto, eS);
}
/** Canvas girato di 90° (verso 1 = orario, −1 = antiorario). */
export function ruotaCanvas(src, verso = 1) {
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const c = document.createElement('canvas'); c.width = h0; c.height = w0;
  const g = c.getContext('2d');
  if (verso > 0) { g.translate(h0, 0); g.rotate(Math.PI / 2); } else { g.translate(0, w0); g.rotate(-Math.PI / 2); }
  g.drawImage(src, 0, 0);
  return c;
}
/**
 * Da che parte (sinistra / destra) la sagoma ha un pezzo che SPORGE (leva,
 * manopola, cursore): lì c'è il davanti. null se non si capisce.
 */
function latoSporgente(V) {
  const { w, A, x0, y0, bw, bh } = V;
  const alt = new Float32Array(bw);
  for (let i = 0; i < bw; i++) { let n = 0; for (let y = y0; y < y0 + bh; y++) if (A[y * w + x0 + i] > 0.5) n++; alt[i] = n; }
  const centro = [...alt.slice(Math.floor(bw * 0.2), Math.ceil(bw * 0.8))].sort((a, b) => a - b);
  const med = centro[centro.length >> 1] || 0;
  let sx = 0; while (sx < bw * 0.4 && alt[sx] < med * 0.7) sx++;
  let dx = 0; while (dx < bw * 0.4 && alt[bw - 1 - dx] < med * 0.7) dx++;
  if (Math.abs(sx - dx) < bw * 0.02) return null;
  return sx > dx ? 'sx' : 'dx';
}
/**
 * FOTO DA SOPRA DI TRAVERSO: le foto prodotto da sopra hanno spesso l'oggetto
 * in orizzontale. Se le proporzioni corrispondono a profondità × larghezza
 * (invece di larghezza × profondità) la giro di 90°, con il davanti (il lato
 * dove sporge la leva / il comando) in basso. Ritorna il canvas girato o null.
 */
export function orientaSopra(src, W, D) {
  const V = vista(src);
  if (!V || !(W > 0 && D > 0) || Math.abs(Math.log(W / D)) < 0.12) return null;
  const err = (e) => Math.abs(Math.log(V.aspetto / e));
  if (err(D / W) >= err(W / D)) return null;                      // già dritta
  const lato = latoSporgente(V);
  return ruotaCanvas(src, lato === 'sx' ? -1 : 1);                // il lato del davanti va in basso
}
/**
 * Raggio (mm) degli spigoli in alto della sagoma: quanto la sagoma si stringe
 * in cima (es. tostapane bombato ~4 cm, scatola squadrata ~0).
 */
function raggioCima(p, largh, alt) {
  const m = p.mDx - p.mSx;
  if (!(m > 0)) return 0;
  let v = 0;
  while (v < 0.4 && (p.dx(v) - p.sx(v)) < m * 0.97) v += 0.004;
  const restr = Math.max(0, (m - (p.dx(0.004) - p.sx(0.004))) / 2) * largh;   // quanto è più stretta la prima riga
  return Math.min(v * alt, restr * 1.2 + v * alt * 0.2);
}

export function geometriaOggetto(foto, W, D, H, pianta = 'auto') {
  W = Math.max(10, W); D = Math.max(10, D); H = Math.max(10, H);
  // foto da sopra di traverso: la giro (davanti in basso)
  if (foto.sopra) { const r = orientaSopra(foto.sopra, W, D); if (r) foto = { ...foto, sopra: r }; }
  // davanti e lato al contrario (si vede dalle misure): li scambio da solo
  let scambiate = false;
  if (foto.fronte && foto.lato && vistaScambiata(foto.fronte, foto.lato, W, D, H)) {
    foto = { ...foto, fronte: foto.lato, lato: foto.fronte, dietro: null };
    scambiate = true;
  }
  const F = vista(foto.fronte); if (!F) return null;
  const S = vista(foto.lato), B = foto.dietro ? true : false;
  // foto DA SOPRA: per la FORMA solo se è davvero dall'alto (proporzioni come larghezza × profondità);
  // le foto prodotto "da sopra" sono spesso di tre quarti e farebbero forme storte → solo per l'aspetto
  const Tv = vista(foto.sopra);
  // CORPO nella foto da sopra: le righe a tutta larghezza (leve, manopole, cursori che sporgono restano fuori)
  let corpoT = null;
  if (Tv) {
    const pp = profilo(Tv), mw = pp.mDx - pp.mSx;
    let t0 = 0, t1 = 1;
    while (t0 < 0.45 && (pp.dx(t0) - pp.sx(t0)) < mw * 0.6) t0 += 0.002;
    while (t1 > 0.55 && (pp.dx(t1) - pp.sx(t1)) < mw * 0.6) t1 -= 0.002;
    corpoT = { p: pp, t0, t1, aspetto: Tv.bw / Math.max(1, Tv.bh * (t1 - t0)) };
  }
  const T = Tv && Math.abs(Math.log(corpoT.aspetto / (W / D))) < 0.25 ? Tv : null;
  // PROFILI riga per riga (davanti, lato, sopra) → volume con facce piatte
  const pF = profilo(F);
  const pS = S ? profilo(S) : null, pT = T ? corpoT.p : null;
  // lato: il davanti è dove sporge qualcosa (maniglia); fascia e profondità della sporgenza
  let davantiSx = true, corpoF = 0, banda = null, man = null;
  if (pS) {
    const sporgeSx = [], sporgeDx = [];
    for (let k = 0; k <= 100; k++) { const v = k / 100; sporgeSx.push(pS.mSx - pS.sx(v)); sporgeDx.push(pS.dx(v) - pS.mDx); }
    const nSx = sporgeSx.filter((x) => x > 0.025).length, nDx = sporgeDx.filter((x) => x > 0.025).length;
    davantiSx = nSx >= nDx;
    // il davanti nella foto di lato è dove SPORGE la leva / il comando (più affidabile)
    const ls = latoSporgente(S);
    if (ls) davantiSx = ls === 'sx';
    const sp = davantiSx ? sporgeSx : sporgeDx;
    const righe = sp.map((x, k) => (x > 0.025 ? k / 100 : null)).filter((x) => x !== null);
    corpoF = davantiSx ? pS.mSx : 1 - pS.mDx;                 // dalla punta davanti all'inizio del corpo (0..1 di D)
    if (righe.length >= 3) {
      banda = [Math.min(...righe), Math.max(...righe)];
      // quanto è largo il pezzo che sporge: lo dice la foto davanti. Se lì non si vede una
      // maniglia vera (es. leva o manopola piccole), niente sporgenza: niente barre finte.
      man = trovaManiglia(F, banda[0], banda[1]);
      const contigue = righe.length / ((banda[1] - banda[0]) * 100 + 1);
      if (!man || contigue < 0.7) { banda = null; man = null; corpoF = 0; }
    } else corpoF = 0;
  }
  const passo = Math.max(W, D, H) / 170;
  const NX = Math.max(16, Math.round(W / passo)), NY = Math.max(16, Math.round(H / passo)), NZ = Math.max(16, Math.round(D / passo));
  const GX = NX + 2, GY = NY + 2, GZ = NZ + 2;
  const id = (i, j, k) => (k * GY + j) * GX + i;
  const f = new Float32Array(GX * GY * GZ);
  const tonda = !T && (pianta === 'tonda' || pianta === 'ovale');
  // FORMA DA SOPRA AUTOMATICA (senza la foto da sopra): rettangolo con gli
  // spigoli arrotondati come si vede nelle foto (in cima davanti e di lato);
  // le misure restano esatte. 'squadrata' = spigoli appena smussati.
  let rr = Math.min(W, D) * 0.045;
  if (!T && pianta !== 'squadrata' && !tonda) {
    const rF = raggioCima(pF, W, H), rS = pS ? raggioCima(pS, D, H) : rF;
    rr = Math.max(rr, Math.min(Math.min(W, D) * 0.48, (rF + rS) / 2));
  }
  const zCorpo = D / 2 - corpoF * D;                       // faccia davanti del corpo (oltre: solo la maniglia)
  const dentro = (dd) => Math.max(0, Math.min(1, 0.5 + dd / passo));
  for (let j = 1; j <= NY; j++) {
    const y = (j - 0.5) / NY * H, vy = 1 - y / H;
    const xl = pF.sx(vy) * W - W / 2, xr = pF.dx(vy) * W - W / 2;
    if (Number.isNaN(xl) || Number.isNaN(xr)) continue;
    let zf = D / 2, zb = -D / 2;
    if (pS) {
      let a = pS.sx(vy), b = pS.dx(vy);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      if (!banda) {
        // niente maniglia vera: della foto di lato conta solo il CORPO (leve e manopole che sporgono fuori)
        const m0 = pS.mSx, m1 = pS.mDx, L = Math.max(1e-3, m1 - m0);
        a = Math.max(0, (a - m0) / L); b = Math.min(1, (b - m0) / L);
      }
      if (davantiSx) { zf = D / 2 - a * D; zb = D / 2 - b * D; } else { zf = D / 2 - (1 - b) * D; zb = D / 2 - (1 - a) * D; }
    }
    const sporgeQui = banda && vy >= banda[0] - 0.01 && vy <= banda[1] + 0.01;
    for (let k = 1; k <= NZ; k++) {
      const z = (k - 0.5) / NZ * D - D / 2, wz = (z + D / 2) / D;
      for (let i = 1; i <= NX; i++) {
        const x = (i - 0.5) / NX * W - W / 2;
        // corpo: dentro al profilo davanti (x) e di lato (z), spigoli verticali arrotondati
        const zfc = Math.min(zf, zCorpo + (sporgeQui ? 0 : 0));
        const hx = (xr - xl) / 2, hz = (zfc - zb) / 2, cx = (xl + xr) / 2, cz = (zfc + zb) / 2;
        let dd;
        if (pT) {
          // FORMA VERA DA SOPRA: a ogni altezza il contorno visto da sopra, largo e
          // profondo come dicono le foto davanti e di lato a quell'altezza
          const v = (zfc - z) / Math.max(1, zfc - zb);                 // 0 = davanti … 1 = dietro
          const vT = corpoT.t0 + (1 - v) * (corpoT.t1 - corpoT.t0);  // nella foto da sopra: in alto = dietro, in basso = davanti (solo il corpo)
          if (v < 0 || v > 1) dd = -Math.max(z - zfc, zb - z, passo);
          else {
            const a = pT.sx(vT), b = pT.dx(vT);
            if (Number.isNaN(a) || Number.isNaN(b)) dd = -passo;
            else {
              const xa = xl + a * (xr - xl), xb = xl + b * (xr - xl);
              dd = Math.min(x - xa, xb - x, z - zb, zfc - z);
            }
          }
        } else if (tonda) {
          const ex = (x - cx) / Math.max(1, hx), ez = (z - cz) / Math.max(1, hz);
          dd = (1 - Math.sqrt(ex * ex + ez * ez)) * Math.min(hx, hz);
        } else {
          const qx = Math.abs(x - cx) - (hx - rr), qz = Math.abs(z - cz) - (hz - rr);
          dd = -(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rr);
        }
        let o = dentro(dd);
        // MANIGLIA: davanti al corpo, solo dove è nella foto davanti
        if (sporgeQui && z > zCorpo - passo && zf > zCorpo + passo) {
          const mx0 = man ? man.a * W - W / 2 : -Infinity, mx1 = man ? man.b * W - W / 2 : Infinity;
          const dm = Math.min(x - mx0, mx1 - x, zf - z, z - (zCorpo - 2 * passo), x - xl, xr - x);
          o = Math.max(o, dentro(dm));
        }
        f[id(i, j, k)] = o;
      }
    }
  }
  // sopra e sotto: chiusura morbida (prima e ultima fila)
  for (let k = 1; k <= NZ; k++) for (let i = 1; i <= NX; i++) {
    f[id(i, 1, k)] = Math.min(f[id(i, 1, k)], 0.75); f[id(i, NY, k)] = Math.min(f[id(i, NY, k)], 0.75);
  }
  const pos = (i, j, k) => [(i - 0.5) / NX * W - W / 2, (j - 0.5) / NY * H, (k - 0.5) / NZ * D - D / 2];
  // MARCHING CUBES
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
  {                                                        // LEVIGATURA (Taubin)
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
    for (let it = 0; it < 4; it++) { passoT(0.5); passoT(-0.53); }
  }
  const gi = new THREE.BufferGeometry();
  gi.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
  gi.setIndex(ind);
  gi.computeVertexNormals();
  const N0 = gi.attributes.normal, P0 = gi.attributes.position;
  let segno = 0; for (let v = 0; v < P0.count; v += 7) segno += N0.getX(v) * P0.getX(v) + N0.getY(v) * (P0.getY(v) - H / 2) + N0.getZ(v) * P0.getZ(v);
  if (segno < 0) { for (let q = 0; q < ind.length; q += 3) { const t = ind[q + 1]; ind[q + 1] = ind[q + 2]; ind[q + 2] = t; } gi.setIndex(ind); gi.computeVertexNormals(); }
  // ASPETTO REALISTICO: ogni punto MESCOLA le foto che lo guardano (davanti,
  // dietro, lati, sopra) secondo da che parte è rivolto, con passaggi morbidi
  // (niente "toppe" né spigoli di foto), e un materiale lucido con i riflessi.
  const tF = texturaVista(foto.fronte);
  const tB = B ? texturaVista(foto.dietro) : null;
  const tS = S ? texturaVista(foto.lato) : null;
  const tT = Tv ? texturaVista(foto.sopra) : null;
  const uvDa = (t, u, v) => (t ? [t.bx0 + Math.min(1, Math.max(0, u)) * t.bw, 1 - (t.by0 + Math.min(1, Math.max(0, v)) * t.bh)] : [0, 0]);
  const P = gi.attributes.position, nV = P.count;
  const uvF = new Float32Array(nV * 2), uvB = new Float32Array(nV * 2), uvS = new Float32Array(nV * 2), uvS2 = new Float32Array(nV * 2), uvT = new Float32Array(nV * 2);
  for (let v = 0; v < nV; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const u = (x + W / 2) / W, vy = 1 - y / H, wz = (z + D / 2) / D;
    uvF.set(uvDa(tF, u, vy), v * 2);
    uvB.set(uvDa(tB || tF, 1 - u, vy), v * 2);                     // dietro: la sua foto, se no il davanti specchiato
    // lato fotografato: la foto com'è; lato opposto: la stessa foto NON specchiata (scritte e loghi leggibili)
    const us = davantiSx ? 1 - wz : wz;
    const corpoS = (q) => (pS && !banda ? pS.mSx + q * (pS.mDx - pS.mSx) : q);
    uvS.set(uvDa(tS, corpoS(us), vy), v * 2);
    uvS2.set(uvDa(tS, corpoS(1 - us), vy), v * 2);
    uvT.set(uvDa(tT, u, corpoT ? corpoT.t0 + wz * (corpoT.t1 - corpoT.t0) : wz), v * 2);
  }
  gi.setAttribute('uvF', new THREE.BufferAttribute(uvF, 2));
  gi.setAttribute('uvB', new THREE.BufferAttribute(uvB, 2));
  gi.setAttribute('uvS', new THREE.BufferAttribute(uvS, 2));
  gi.setAttribute('uvS2', new THREE.BufferAttribute(uvS2, 2));
  gi.setAttribute('uvT', new THREE.BufferAttribute(uvT, 2));
  const cimaCol = (() => { const l = []; for (let u = 0.15; u <= 0.85; u += 0.05) for (let v = 0.005; v < 0.05; v += 0.01) { const c = F.col(u, v); if (c) l.push(c); } return l.length ? [0, 1, 2].map((q) => l.map((c) => c[q]).sort((a, b) => a - b)[l.length >> 1]) : F.media; })();
  const lin = (c) => new THREE.Color().setRGB(...c.map((x) => Math.pow(x / 255, 2.2)));
  const corpoCol = S ? S.media : F.media;
  // lucido o opaco? dai riflessi nella foto davanti (tanti punti molto chiari su un colore scuro = lucido)
  const Lm = 0.299 * F.media[0] + 0.587 * F.media[1] + 0.114 * F.media[2];
  const lucido = Lm < 150 ? 0.28 : 0.4;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: lucido, metalness: 0.05, envMapIntensity: 1.0 });
  const vuota = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); vuota.needsUpdate = true;
  const U = {
    oF: { value: tF.tex }, oB: { value: (tB || tF).tex }, oS: { value: tS ? tS.tex : vuota }, oT: { value: tT ? tT.tex : vuota },
    haS: { value: tS ? 1 : 0 }, haT: { value: tT ? 1 : 0 },
    latoFoto: { value: davantiSx ? 1 : -1 },                     // lato fotografato: x > 0 se nella foto il davanti è a sinistra
    cS: { value: lin(corpoCol) }, cT: { value: lin(cimaCol) }, cU: { value: lin(F.media.map((x) => x * 0.55)) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 uvF; attribute vec2 uvB; attribute vec2 uvS; attribute vec2 uvS2; attribute vec2 uvT;
varying vec2 vUvF; varying vec2 vUvB; varying vec2 vUvS; varying vec2 vUvS2; varying vec2 vUvT; varying vec3 vObjN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vUvF = uvF; vUvB = uvB; vUvS = uvS; vUvS2 = uvS2; vUvT = uvT; vObjN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D oF; uniform sampler2D oB; uniform sampler2D oS; uniform sampler2D oT;
uniform float haS; uniform float haT; uniform float latoFoto; uniform vec3 cS; uniform vec3 cT; uniform vec3 cU;
varying vec2 vUvF; varying vec2 vUvB; varying vec2 vUvS; varying vec2 vUvS2; varying vec2 vUvT; varying vec3 vObjN;`)
      .replace('#include <map_fragment>', `
{
  vec3 n = normalize(vObjN), a = abs(n);
  float k = 5.0;
  float wF = n.z > 0.0 ? pow(a.z, k) : 0.0, wB = n.z < 0.0 ? pow(a.z, k) : 0.0;
  float wS = pow(a.x, k), wT = n.y > 0.0 ? pow(a.y, k) : 0.0, wU = n.y < 0.0 ? pow(a.y, k) : 0.0;
  float tot = max(1e-4, wF + wB + wS + wT + wU);
  vec3 c = texture2D(oF, vUvF).rgb * wF + texture2D(oB, vUvB).rgb * wB
    + mix(cS, texture2D(oS, n.x * latoFoto > 0.0 ? vUvS : vUvS2).rgb, haS) * wS + mix(cT, texture2D(oT, vUvT).rgb, haT) * wT + cU * wU;
  diffuseColor.rgb *= c / tot;
}`);
  };
  mat.customProgramCacheKey = () => 'ogg-proiezione-v2';
  const mats = mat;
  const geo = gi;
  return { geo, mats, W, D, H, colore: hex(F.media), scambiate };
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
      _cache.set(chiave, { geo: r.geo, mat: r.mats });
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
  if (res.scambiate && box.dataset) box.dataset.scambiate = '1'; else if (box.dataset) delete box.dataset.scambiate;
  const LW = Math.min(box.clientWidth || 320, 520), LH = Math.round(LW * 0.75);
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(LW, LH);
  r.outputColorSpace = THREE.SRGBColorSpace;
  box.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xeae7e1);
  sc.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.9));
  const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(1, 2, 3); sc.add(dl);
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color(0x8d8a84);
  // pannelli di luce (come finestre e lampade): danno i riflessi veri sulle superfici lucide
  for (const [x, y, z, w, h] of [[0, 6, 0, 8, 8], [-7, 2, 3, 2, 5], [7, 3, -2, 3, 4], [0, 2, 8, 6, 2]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    pl.position.set(x, y, z); pl.lookAt(0, 0, 0); env.add(pl);
  }
  sc.environment = pm.fromScene(env, 0.04).texture;
  sc.add(new THREE.Mesh(res.geo, res.mats));
  const piano = new THREE.Mesh(new THREE.BoxGeometry(W * 1.6 + 200, 20, D * 1.6 + 200), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.7 }));
  piano.position.y = -10; sc.add(piano);
  const cam = new THREE.PerspectiveCamera(30, LW / LH, 1, 20000);
  const R = Math.max(W, D, H) * 2.7;
  cam.position.set(R * 0.45, H * 0.5 + R * 0.22, R * 0.85);
  const ctr = new OrbitControls(cam, r.domElement); ctr.target.set(0, H / 2, 0); ctr.enablePan = false; ctr.autoRotate = true; ctr.autoRotateSpeed = 2;
  let vivo = true;
  const giro = () => { if (!vivo) return; ctr.update(); r.render(sc, cam); requestAnimationFrame(giro); };
  giro();
  return () => { vivo = false; ctr.dispose(); r.dispose(); };
}
