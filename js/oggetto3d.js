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
import { formaOggetto, sagomaEstrusa, compattezza } from './scanner3d.js?v=20261118q';
import { edgeTable, triTable } from '../vendor/three/addons/objects/mc-tabelle.js';

/** Distanza (chamfer 3-4, in pixel) di ogni pixel dal più vicino pixel "fuori" (m = 0). */
function distanza(m, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3); else v = Math.min(v, 3);
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); } else v = Math.min(v, 3);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3); else v = Math.min(v, 3);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); } else v = Math.min(v, 3);
    d[i] = v;
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}
/** Pezzi connessi (4-vicini) di una maschera 0/1: etichette e aree. */
function pezzi(m, w, h) {
  const lab = new Int32Array(w * h).fill(-1), aree = [], st = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    const n = aree.length; let sp = 0, a = 0; st[sp++] = i; lab[i] = n;
    while (sp) {
      const j = st[--sp], x = j % w; a++;
      for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) if (q >= 0 && q < w * h && m[q] && lab[q] < 0) { lab[q] = n; st[sp++] = q; }
    }
    aree.push(a);
  }
  return { lab, aree };
}
/**
 * CORPO della sagoma: si passa una "gomma tonda" di raggio r lungo il bordo (apertura).
 * Tutto quello che è più sottile di 2r — asticella e pallina della leva, manopoline,
 * piedini — esce dalla FORMA; il corpo resta. Gli spigoli veri del corpo (che la gomma
 * arrotonda appena) tornano com'erano. La foto resta intera: quei pezzi si vedono comunque.
 */
function corpoSagoma(A, w, h, r) {
  const N = w * h, m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = A[i] > 0.5 ? 1 : 0;
  const dIn = distanza(m, w, h);                                      // erosione: resta dove ci sta la gomma
  const fuoriEr = new Uint8Array(N); for (let i = 0; i < N; i++) fuoriEr[i] = dIn[i] > r ? 0 : 1;
  const dEr = distanza(fuoriEr, w, h);                                // dilatazione: la gomma ripassata dentro
  const ap = new Uint8Array(N); for (let i = 0; i < N; i++) ap[i] = m[i] && dEr[i] <= r + 0.5 ? 1 : 0;
  // solo il pezzo più grande (una pallina grossa resterebbe staccata dal corpo)
  const pa = pezzi(ap, w, h);
  if (!pa.aree.length) return Float32Array.from(m);
  const big = pa.aree.indexOf(Math.max(...pa.aree));
  for (let i = 0; i < N; i++) ap[i] = pa.lab[i] === big ? 1 : 0;
  // quello che la gomma ha tolto: se sporge poco dal corpo (meno di 0,6 r) è uno spigolo
  // vero → torna; se sporge di più è una leva, una pallina, un piedino → resta fuori
  const nonAp = new Uint8Array(N); for (let i = 0; i < N; i++) nonAp[i] = ap[i] ? 0 : 1;
  const dAp = distanza(nonAp, w, h);                                  // quanto un pixel sta fuori dal corpo
  const tolto = new Uint8Array(N); for (let i = 0; i < N; i++) tolto[i] = m[i] && !ap[i] ? 1 : 0;
  const pt = pezzi(tolto, w, h), sporge = pt.aree.map(() => 0), aTerra = pt.aree.map(() => false);
  let yFondo = 0; for (let i = 0; i < N; i++) if (m[i]) yFondo = (i / w) | 0;
  for (let i = 0; i < N; i++) { const c = pt.lab[i]; if (c < 0) continue; if (dAp[i] > sporge[c]) sporge[c] = dAp[i]; if (((i / w) | 0) >= yFondo - 1) aTerra[c] = true; }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c = pt.lab[i];
    // i PIEDINI (toccano il piano): via solo la parte che sporge, lo spigolo della base sopra resta
    out[i] = ap[i] || (c >= 0 && (sporge[c] <= r * 0.6 || (aTerra[c] && dAp[i] <= r * 0.6))) ? 1 : 0;
  }
  return out;
}

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
  // per la FORMA: il corpo senza i pezzi sottili (gomma ~3,5% del lato lungo dell'oggetto)
  V.Ac = corpoSagoma(A, w, h, Math.max(2, Math.round(Math.max(bw, bh) * 0.035)));
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
/**
 * CURVA LISCIA (smoother di Whittaker): la curva più vicina ai punti che però non può
 * piegarsi di colpo (penalità sulla curvatura, peso lambda). I punti NaN non contano
 * e restano NaN. Sistema a banda risolto con Cholesky: veloce anche con 1000 punti.
 */
function curvaLiscia(y, lambda, pesi = null) {
  const n = y.length;
  if (n < 5) return Float32Array.from(y);
  const d0 = new Float64Array(n), d1 = new Float64Array(n), d2 = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ok = !Number.isNaN(y[i]); d0[i] = ok ? (pesi ? pesi[i] : 1) : 0; b[i] = ok ? d0[i] * y[i] : 0; }
  const c = [1, -2, 1];
  for (let k = 0; k < n - 2; k++) for (let a = 0; a < 3; a++) for (let q = a; q < 3; q++) {
    const v = lambda * c[a] * c[q], i = k + a;
    if (q === a) d0[i] += v; else if (q === a + 1) d1[i] += v; else d2[i] += v;
  }
  const e = new Float64Array(n), f = new Float64Array(n), g = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    e[i] = i >= 2 ? d2[i - 2] / g[i - 2] : 0;
    f[i] = i >= 1 ? (d1[i - 1] - (i >= 2 ? e[i] * f[i - 1] : 0)) / g[i - 1] : 0;
    g[i] = Math.sqrt(Math.max(1e-12, d0[i] - e[i] * e[i] - f[i] * f[i]));
  }
  const z = new Float64Array(n), x = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = (b[i] - (i >= 2 ? e[i] * z[i - 2] : 0) - (i >= 1 ? f[i] * z[i - 1] : 0)) / g[i];
  for (let i = n - 1; i >= 0; i--) x[i] = (z[i] - (i + 1 < n ? f[i + 1] * x[i + 1] : 0) - (i + 2 < n ? e[i + 2] * x[i + 2] : 0)) / g[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Number.isNaN(y[i]) ? NaN : x[i];
  return out;
}

function profilo(V) {
  const { w, x0, y0, bw, bh } = V;
  const n = bh, L = new Float32Array(n).fill(NaN), R = new Float32Array(n).fill(NaN);
  // bordo sinistro e destro di una riga della maschera, al pixel con la frazione (dove l'alfa passa 0.5)
  const bordi = (A, r) => {
    const y = y0 + r, base = y * w;
    let l = -1, rr = -1;
    for (let x = x0; x < x0 + bw; x++) if (A[base + x] > 0.5) { if (l < 0) l = x; rr = x; }
    if (l < 0) return null;
    const al = l > 0 ? A[base + l - 1] : 0, ar = rr < w - 1 ? A[base + rr + 1] : 0;
    const fl = l - Math.max(0, Math.min(1, (A[base + l] - 0.5) / Math.max(0.01, A[base + l] - al))) + 0.5;
    const fr = rr + Math.max(0, Math.min(1, (A[base + rr] - 0.5) / Math.max(0.01, A[base + rr] - ar))) - 0.5;
    return [(fl - x0) / Math.max(1, bw - 1), (fr - x0) / Math.max(1, bw - 1)];
  };
  // la FORMA si legge dal CORPO (senza leve, palline, piedini)
  const C = V.Ac || V.A;
  let mwC = 0;
  for (let r = 0; r < n; r++) { const b = bordi(C, r); if (b) { L[r] = b[0]; R[r] = b[1]; mwC = Math.max(mwC, b[1] - b[0]); } }
  // SOTTO il corpo: se ci sono i PIEDINI (pezzi separati sulla stessa riga) il corpo scende
  // dritto fino al piano d'appoggio, largo come la sua base; se il fondo rientra in un pezzo
  // unico (fondo tondo) segue la sagoma vera della foto, mai più largo della base
  if (V.Ac) {
    const pezziRiga = (A, r) => {                          // quanti pezzi (separati da ≥ 3 px vuoti) ha la riga
      const base = (y0 + r) * w; let k = 0, vuoto = 99;
      for (let x = x0; x < x0 + bw; x++) { if (A[base + x] > 0.5) { if (vuoto >= 3) k++; vuoto = 0; } else vuoto++; }
      return k;
    };
    let rb = -1;
    for (let r = n - 1; r >= 0; r--) if (!Number.isNaN(L[r]) && R[r] - L[r] >= mwC * 0.5 && pezziRiga(C, r) === 1) { rb = r; break; }
    let piedini = false;
    if (rb >= 0) for (let r = rb + 1; r < n; r++) {
      if (!piedini && pezziRiga(V.A, r) > 1) piedini = true;
      if (piedini) { L[r] = L[rb]; R[r] = R[rb]; continue; }
      const b = bordi(V.A, r);
      if (!b) { L[r] = R[r] = NaN; continue; }
      L[r] = Math.max(b[0], L[rb]); R[r] = Math.min(b[1], R[rb]);
      if (R[r] - L[r] < 0.01) { L[r] = R[r] = NaN; }
    }
  }
  const mediana = (arr) => { const t = [...arr].filter((x) => !Number.isNaN(x)).sort((p, q) => p - q); return t.length ? t[t.length >> 1] : NaN; };
  const filtra = (arr) => {
    const out = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      if (Number.isNaN(arr[r])) { out[r] = NaN; continue; }
      const hw = Math.max(3, Math.round(n * 0.02));           // via i "dentini" del ritaglio (riflessi sul bordo, ganci piccoli)
      const fin = []; for (let q = Math.max(0, r - hw); q <= Math.min(n - 1, r + hw); q++) if (!Number.isNaN(arr[q])) fin.push(arr[q]);
      fin.sort((p, q) => p - q); out[r] = fin[fin.length >> 1];
    }
    const m = mediana(out);
    // CURVA LISCIA (come la disegnerebbe un modellatore): passa sul bordo della foto ma non
    // può fare onde più corte di ~10% dell'altezza → spalle tonde e lati dritti restano,
    // i "dentini" e le ondine del ritaglio (che col lucido diventavano strisce) no
    const lam = Math.pow((n * 0.10) / (2 * Math.PI), 4);
    let lis = curvaLiscia(out, lam);
    // ROBUSTA: i pezzetti corti che escono o rientrano dal contorno (manopola, clip, gradino
    // tra corpo e base) non sono la forma del corpo: si ignorano e la curva ci passa sopra dritta.
    // Distanza misurata di traverso alla curva (in pixel), così le spalle tonde restano.
    const pesi = new Float32Array(n);
    for (let it = 0; it < 6; it++) {
      for (let r = 0; r < n; r++) {
        if (Number.isNaN(out[r])) { pesi[r] = 0; continue; }
        const r0 = Math.max(0, r - 1), r1 = Math.min(n - 1, r + 1);
        const pend = ((lis[r1] - lis[r0]) / Math.max(1, r1 - r0)) * bw;      // pixel di x per pixel di y
        const dist = (Math.abs(out[r] - lis[r]) * bw) / Math.sqrt(1 + pend * pend);
        pesi[r] = dist > 2 ? 0.01 : 1;
      }
      lis = curvaLiscia(out, lam, pesi);
    }
    return { v: lis, m };
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
  // quello che resta vuoto (buchi grandi, es. dentro un manico): il colore medio dell'oggetto, mai nero
  { let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < w * h; i++) if (pieno[i]) { r += d[i * 4]; gg += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; }
    if (n) for (let i = 0; i < w * h; i++) if (!pieno[i]) { d[i * 4] = r / n; d[i * 4 + 1] = gg / n; d[i * 4 + 2] = b / n; } }
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
  // giro, poi guardo dove resta la sporgenza (leva, cursore): deve stare in basso (davanti)
  let c = ruotaCanvas(src, 1);
  const Vr = vista(c);
  if (Vr) {
    const { t0, t1 } = estremiCorpo(profilo(Vr));
    if (t0 > (1 - t1) + 0.02) c = ruotaCanvas(src, -1);           // la sporgenza è finita in alto: giro dall'altra parte
  }
  return c;
}
/**
 * CORPO nella foto da sopra (lungo l'asse verticale della foto): dove inizia e
 * dove finisce, senza le sporgenze. Una SPORGENZA (leva, cursore, manopola,
 * gambo) è un pezzo in fondo più stretto del corpo che, arrivando al corpo, si
 * ALLARGA DI COLPO; le estremità arrotondate invece si allargano poco alla
 * volta e restano corpo. Ritorna { t0, t1 } (0..1).
 */
function estremiCorpo(p) {
  const N = 500, mw = p.mDx - p.mSx;
  const w = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const v = p.dx(i / N) - p.sx(i / N); w[i] = Number.isNaN(v) ? 0 : v; }
  // corpo centrale sicuro: dove è largo almeno l'80%
  let b0 = 0, b1 = N;
  while (b0 < N && w[b0] < mw * 0.8) b0++;
  while (b1 > 0 && w[b1] < mw * 0.8) b1--;
  if (b1 <= b0) return { t0: 0, t1: 1 };
  const W20 = 20;                                                    // finestra = 4% della lunghezza
  const lato = (dir) => {
    const i0 = dir < 0 ? b0 : b1;
    let e = dir < 0 ? 0 : N;
    while (e !== i0 && w[e] < mw * 0.15) e -= dir;                   // gambi sottilissimi (pomelli, perni): mai corpo
    // un tratto PIANO più stretto del corpo (largo uguale per il 4%) = una sporgenza (leva, cursore)
    let piano = null;
    for (let st = i0; dir < 0 ? st - W20 >= e : st + W20 <= e; st += dir) {
      let mn = Infinity, mx = -Infinity; const seg = [];
      for (let q = 0; q <= W20; q++) { const v = w[st + q * dir]; seg.push(v); if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mn >= mw * 0.15 && mx < mw * 0.7 && mx - mn < mw * 0.08) { seg.sort((a, b) => a - b); piano = seg[seg.length >> 1]; break; }
    }
    if (piano == null) return e / N;                                 // estremità arrotondata: è tutta corpo
    let k = i0; while (k !== e && w[k] > piano * 1.15) k += dir;     // il corpo finisce dove si arriva alla larghezza della sporgenza
    return k / N;
  };
  return { t0: lato(-1), t1: lato(1) };
}
/**
 * FORMA VISTA DA SOPRA: la curva ideale che sta meglio sul contorno del CORPO nella foto da
 * sopra — una superellisse: 2 = ovale, 3-4 = rettangolo con angoli molto tondi, 8+ = quasi
 * squadrato. I punti del contorno che non stanno sulla curva (leva, pallina, manopola,
 * blocchi attaccati) si scartano da soli (si tiene il 65% che sta meglio).
 * Ritorna { n, aspetto (larghezza/profondità), cx, cy, a, b (frazioni della foto) } o null.
 */
function formaDaSopra(V) {
  const { w, h } = V, A = V.Ac || V.A;
  const tutti = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (A[i] > 0.5 && (A[i - 1] <= 0.5 || A[i + 1] <= 0.5 || A[i - w] <= 0.5 || A[i + w] <= 0.5)) tutti.push([x, y]);
  }
  if (tutti.length < 40) return null;
  const passo = Math.max(1, Math.floor(tutti.length / 700)), P = tutti.filter((_, k) => k % passo === 0);
  // partenza: il corpo secondo le righe (senza le sporgenze alle estremità)
  const pp = profilo(V), e = estremiCorpo(pp);
  let mw = 0, sc = 0, nn = 0;
  for (let k = 0; k <= 50; k++) { const v = e.t0 + (e.t1 - e.t0) * k / 50, a = pp.sx(v), b = pp.dx(v); if (Number.isNaN(a) || Number.isNaN(b)) continue; mw = Math.max(mw, b - a); sc += (a + b) / 2; nn++; }
  if (!nn) return null;
  const start = [V.x0 + (sc / nn) * (V.bw - 1), V.y0 + ((e.t0 + e.t1) / 2) * (V.bh - 1), Math.max(4, mw * (V.bw - 1) / 2), Math.max(4, (e.t1 - e.t0) * (V.bh - 1) / 2), Math.log(4)];
  const res = new Float64Array(P.length);
  const costo = ([cx, cy, a, b, ln]) => {
    if (a < 3 || b < 3 || ln < Math.log(1.6) || ln > Math.log(30)) return 1e12;
    const n = Math.exp(ln);
    for (let k = 0; k < P.length; k++) {
      const dx = Math.abs(P[k][0] - cx), dy = Math.abs(P[k][1] - cy), rho = Math.hypot(dx, dy);
      if (rho < 1e-6) { res[k] = Math.min(a, b); continue; }
      const F = Math.pow(dx / a, n) + Math.pow(dy / b, n);
      res[k] = Math.abs(rho * (1 - Math.pow(F, -1 / n)));                 // distanza lungo il raggio dalla curva
    }
    const ord = Array.from(res).sort((p, q) => p - q), kk = Math.floor(ord.length * 0.65);
    let sq = 0; for (let k = 0; k < kk; k++) sq += ord[k] * ord[k];
    return sq / kk;
  };
  // Nelder–Mead (5 numeri: centro, semiassi, esponente)
  const passi = [start[2] * 0.1, start[3] * 0.1, start[2] * 0.1, start[3] * 0.1, 0.4];
  let S = [start, ...passi.map((d, j) => { const q = start.slice(); q[j] += d; return q; })].map((x) => ({ x, f: costo(x) }));
  for (let it = 0; it < 400; it++) {
    S.sort((p, q) => p.f - q.f);
    const c = [0, 1, 2, 3, 4].map((j) => S.slice(0, 5).reduce((t, p) => t + p.x[j], 0) / 5);
    const pt = (t) => c.map((v, j) => v + t * (S[5].x[j] - v));
    const r = pt(-1), fr = costo(r);
    if (fr < S[0].f) { const e2 = pt(-2), fe = costo(e2); S[5] = fe < fr ? { x: e2, f: fe } : { x: r, f: fr }; }
    else if (fr < S[4].f) S[5] = { x: r, f: fr };
    else {
      const k = pt(0.5), fk = costo(k);
      if (fk < S[5].f) S[5] = { x: k, f: fk };
      else S = S.map((p, i) => (i ? (() => { const x = p.x.map((v, j) => S[0].x[j] + 0.5 * (v - S[0].x[j])); return { x, f: costo(x) }; })() : p));
    }
  }
  S.sort((p, q) => p.f - q.f);
  const [cx, cy, a, b, ln] = S[0].x;
  if (!(S[0].f < 1e11)) return null;
  return { n: Math.max(2, Math.min(16, Math.exp(ln))), aspetto: a / b, cx: cx / w, cy: cy / h, a: a / w, b: b / h };
}
/**
 * LE MISURE TORNANO CON LE FOTO? Le proporzioni del CORPO in ogni foto (leve e
 * manopole escluse) dicono quanto devono stare larghezza, profondità e altezza
 * tra loro. Se una misura scritta non torna (oltre ~8%), ritorna
 * { campo: 'w'|'d'|'h', mm: valore secondo le foto, scarto } — se no null.
 */
export function controllaMisure(foto, W, D, H) {
  if (!(W > 0 && D > 0 && H > 0) || !foto.fronte) return null;
  if (foto.fronte && foto.lato && vistaScambiata(foto.fronte, foto.lato, W, D, H)) foto = { ...foto, fronte: foto.lato, lato: foto.fronte };
  const sopra = foto.sopra ? (orientaSopra(foto.sopra, W, D) || foto.sopra) : null;
  // proporzioni delle SAGOME ESATTE (tutta la foto, come la usa il 3D)
  const Fv = vista(foto.fronte), Sv = foto.lato ? vista(foto.lato) : null, Tv = sopra ? vista(sopra) : null;
  if (!Fv) return null;
  const rF = Fv.aspetto;                                        // larghezza / altezza
  const rS = Sv ? Sv.aspetto : null;                            // profondità / altezza
  const rT = Tv ? 1 / Tv.aspetto : null;                        // profondità / larghezza
  const e = (a, b) => Math.log(a / b);
  const eF = e(W / H, rF), eS = rS ? e(D / H, rS) : null, eT = rT ? e(D / W, rT) : null;
  const lim = 0.12;
  const fuori = (x) => x != null && Math.abs(x) > lim;
  // quale misura non torna: quella che spiega da sola gli scarti
  if (!fuori(eF) && (fuori(eS) || fuori(eT))) {                 // larghezza e altezza tornano → è la PROFONDITÀ
    const st = [rS ? H * rS : null, rT ? W * rT : null].filter(Boolean);
    const mm = st.reduce((a, b) => a + b, 0) / st.length;
    return Math.abs(Math.log(mm / D)) > lim ? { campo: 'd', mm: Math.round(mm), scarto: mm / D } : null;
  }
  if (fuori(eF) && eT != null && fuori(eT) && Math.sign(eF) === -Math.sign(eT) && !fuori(eS)) {   // è la LARGHEZZA
    const mm = (H * rF + D / rT) / 2;
    return { campo: 'w', mm: Math.round(mm), scarto: mm / W };
  }
  if (fuori(eF) && (eS == null || (fuori(eS) && Math.sign(eF) === Math.sign(eS)))) {             // è l'ALTEZZA
    const st = [W / rF, rS ? D / rS : null].filter(Boolean);
    const mm = st.reduce((a, b) => a + b, 0) / st.length;
    return { campo: 'h', mm: Math.round(mm), scarto: mm / H };
  }
  return null;
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

/**
 * QUALE FOTO È QUALE, dalle proporzioni (le misure scritte sono vere):
 *  - dritta davanti: larga/alta come larghezza × altezza
 *  - dritta di lato: come profondità × altezza
 *  - di TRE QUARTI (a 45°): non torna con nessuna delle due (si vedono due facce insieme):
 *    non serve per la forma.
 * foto.tipi = scelte dell'utente per casella ('dritta' | '45'): vincono sulle proporzioni.
 * Ritorna { davanti, lato, dietro, scambiate, girata, W, D, tipi: per casella 'dritta'|'45' }.
 */
export function assegnaViste(foto, W, D, H) {
  const scelte = foto.tipi || {};
  const tipo = (k) => {
    const src = foto[k]; const V = src ? vista(src) : null; if (!V) return null;
    if (scelte[k] === '45') return { k, src, f: null, l: null };
    if (scelte[k] === 'dritta') return { k, src, f: k === 'lato' ? null : 0, l: k === 'lato' ? 0 : null };
    const f = Math.abs(Math.log(V.aspetto / (W / H))), l = Math.abs(Math.log(V.aspetto / (D / H)));
    return { k, src, f: f < 0.16 ? f : null, l: l < 0.16 ? l : null };
  };
  const qF = tipo('fronte'), qL = tipo('lato');
  if (!qF && !qL) return null;
  let davanti = null, lato = null, scambiate = false;
  // il davanti: la foto nella casella "davanti" se è dritta davanti, se no quella di lato se lo è
  if (qF && qF.f != null && (!qL || qL.f == null || qF.f <= qL.f || qL.l != null)) davanti = qF.src;
  else if (qL && qL.f != null) { davanti = qL.src; scambiate = true; }
  // il lato: la foto (non usata come davanti) che è dritta di lato
  for (const t of [qL, qF]) if (!lato && t && t.src !== davanti && t.l != null) lato = t.src;
  // solo una foto dritta, ed è di LATO (es. impastatrice fotografata di fianco): la uso come davanti
  let girata = false;
  if (!davanti && lato) { davanti = lato; lato = null; [W, D] = [D, W]; girata = true; }
  const nessunaDritta = !davanti;
  if (!davanti) davanti = foto.fronte || foto.lato;          // nessuna dritta: uso quella che c'è
  // dietro: solo se è dritta (come il davanti)
  let dietro = null;
  if (foto.dietro && !scambiate && !girata) {
    const V = vista(foto.dietro);
    if (scelte.dietro === 'dritta' || (scelte.dietro !== '45' && V && Math.abs(Math.log(V.aspetto / (W / H))) < 0.16)) dietro = foto.dietro;
  }
  const tipi = {};
  for (const k of ['fronte', 'lato']) if (foto[k]) tipi[k] = !nessunaDritta && (foto[k] === davanti || foto[k] === lato) ? 'dritta' : '45';
  if (foto.dietro) tipi.dietro = dietro ? 'dritta' : '45';
  if (foto.sopra) {
    const T = orientaSopra(foto.sopra, W, D) || foto.sopra, Tv = vista(T), f = Tv ? formaDaSopra(Tv) : null;
    tipi.sopra = scelte.sopra === 'dritta' || (scelte.sopra !== '45' && f && Math.abs(Math.log(f.aspetto / (W / D))) < 0.5) ? 'dritta' : '45';
  }
  return { davanti, lato, dietro, scambiate, girata, W, D, tipi };
}

export function geometriaOggetto(foto, W, D, H, pianta = 'auto') {
  W = Math.max(10, W); D = Math.max(10, D); H = Math.max(10, H);
  // foto da sopra di traverso: la giro (davanti in basso)
  if (foto.sopra) { const r = orientaSopra(foto.sopra, W, D); if (r) foto = { ...foto, sopra: r }; }
  // QUALE FOTO È QUALE (dritta davanti, dritta di lato, di tre quarti): vedi assegnaViste
  const av = assegnaViste(foto, W, D, H);
  if (!av) return null;
  const { scambiate, girata } = av;
  W = av.W; D = av.D;
  foto = { ...foto, fronte: av.davanti, lato: av.lato, dietro: av.dietro };
  const F = vista(foto.fronte); if (!F) return null;
  const S = vista(foto.lato);
  const B = foto.dietro ? true : false;
  // foto DA SOPRA: per la FORMA solo se è davvero dall'alto (proporzioni come larghezza × profondità);
  // le foto prodotto "da sopra" sono spesso di tre quarti e farebbero forme storte → solo per l'aspetto
  const Tv = vista(foto.sopra);
  // la foto DA SOPRA dà la FORMA del contorno (ovale, tonda, squadrata…) del CORPO, senza
  // le sporgenze (leva, cursore): il contorno si disegna dentro davanti × lato a ogni altezza,
  // così davanti e lato restano ESATTI come le loro foto
  const formaT = Tv ? formaDaSopra(Tv) : null;
  const sceltaT = (foto.tipi || {}).sopra;
  const T = Tv && (sceltaT === 'dritta' || (sceltaT !== '45' && formaT && Math.abs(Math.log(formaT.aspetto / (W / D))) < 0.5)) ? Tv : null;   // foto storte di tre quarti: solo per l'aspetto
  // FORMA A PEZZI (scanner3d.js): il CORPO liscio dai contorni senza pezzi, e i PEZZI
  // (leve, manopole, maniglie, piedini) come solidi a sé — niente fasce né anelli
  // OGGETTI PIATTI O COMPOSTI (ceppo dei coltelli con supporto, tagliere, impastatrice con la
  // ciotola) o una sola foto dritta di un oggetto sottile: la SAGOMA della foto con il suo
  // spessore vero, identica alla foto vista davanti
  const estrusa = compattezza(foto.fronte) < 0.85 || (!S && D < W * 0.6);
  let forma = null, davantiSx = S ? latoSporgente(S) === 'sx' : false;
  const vert = [], ind = [], pezzi = [];
  if (estrusa) {
    const g = sagomaEstrusa(foto.fronte, W, H, D, THREE); if (!g) return null;
    pezzi.push(g);
  } else {
    forma = formaOggetto({ fronte: foto.fronte, lato: foto.lato, sopra: T ? foto.sopra : null }, W, D, H, THREE, pianta);
    if (!forma) return null;
    davantiSx = forma.davantiSx;
    for (const v of forma.corpo.vert) vert.push(v);
    for (const v of forma.corpo.ind) ind.push(v);
    pezzi.push(...forma.pezzi3d);
  }
  for (const g of pezzi) {
    const gg = g.index ? g : null; const pos = g.attributes.position, off = vert.length / 3;
    for (let i = 0; i < pos.count; i++) vert.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (gg) for (let i = 0; i < gg.index.count; i++) ind.push(gg.index.getX(i) + off);
    else for (let i = 0; i < pos.count; i++) ind.push(i + off);
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
  // AFFIDABILITÀ di ogni foto in quel punto: vicino al bordo della foto (dove la superficie
  // gira e la foto si "stira") conta meno → niente righe tirate sulle parti curve
  const aff = new Float32Array(nV * 3);
  const liscia = (t) => { const q = Math.max(0, Math.min(1, t)); return q * q * (3 - 2 * q); };
  const uvF = new Float32Array(nV * 2), uvB = new Float32Array(nV * 2), uvS = new Float32Array(nV * 2), uvS2 = new Float32Array(nV * 2), uvT = new Float32Array(nV * 2);
  for (let v = 0; v < nV; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const u = (x + W / 2) / W, vy = 1 - y / H, wz = (z + D / 2) / D;
    uvF.set(uvDa(tF, u, vy), v * 2);
    aff[v * 3] = 0.3 + 0.7 * liscia(Math.min(u, 1 - u) / 0.14);              // davanti / dietro: bordi sinistro e destro
    aff[v * 3 + 1] = 0.08 + 0.92 * liscia(Math.min(wz, 1 - wz) / 0.14);      // lati: bordi davanti e dietro
    aff[v * 3 + 2] = 1;                                                     // sopra: la foto dall'alto vale ovunque guardi in su
    uvB.set(uvDa(tB || tF, 1 - u, vy), v * 2);                     // dietro: la sua foto, se no il davanti specchiato
    // lato fotografato: la foto com'è; lato opposto: la stessa foto NON specchiata (scritte e loghi leggibili)
    const us = davantiSx ? 1 - wz : wz;                             // la foto di lato esatta, su tutta la profondità
    uvS.set(uvDa(tS, us, vy), v * 2);
    uvS2.set(uvDa(tS, 1 - us, vy), v * 2);
    // sopra: il corpo trovato nella foto da sopra (senza leve e blocchi attaccati) va su larghezza × profondità
    if (T) uvT.set([Math.min(1, Math.max(0, formaT.cx + (u - 0.5) * 2 * formaT.a)), 1 - Math.min(1, Math.max(0, formaT.cy + (wz - 0.5) * 2 * formaT.b))], v * 2);
    else uvT.set(uvDa(tT, u, wz), v * 2);
  }
  gi.setAttribute('uvF', new THREE.BufferAttribute(uvF, 2));
  gi.setAttribute('uvB', new THREE.BufferAttribute(uvB, 2));
  gi.setAttribute('uvS', new THREE.BufferAttribute(uvS, 2));
  gi.setAttribute('uvS2', new THREE.BufferAttribute(uvS2, 2));
  gi.setAttribute('affid', new THREE.BufferAttribute(aff, 3));
  gi.setAttribute('uvT', new THREE.BufferAttribute(uvT, 2));
  const cimaCol = (() => { const l = []; for (let u = 0.15; u <= 0.85; u += 0.05) for (let v = 0.005; v < 0.05; v += 0.01) { const c = F.col(u, v); if (c) l.push(c); } return l.length ? [0, 1, 2].map((q) => l.map((c) => c[q]).sort((a, b) => a - b)[l.length >> 1]) : F.media; })();
  const lin = (c) => new THREE.Color().setRGB(...c.map((x) => Math.pow(x / 255, 2.2)));
  const corpoCol = S ? S.media : F.media;
  // lucido o opaco? dai riflessi nella foto davanti (tanti punti molto chiari su un colore scuro = lucido)
  const Lm = 0.299 * F.media[0] + 0.587 * F.media[1] + 0.114 * F.media[2];
  const lucido = Lm < 150 ? 0.28 : 0.4;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: lucido, metalness: 0.05, envMapIntensity: 1.0, side: THREE.DoubleSide });
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
attribute vec2 uvF; attribute vec2 uvB; attribute vec2 uvS; attribute vec2 uvS2; attribute vec2 uvT; attribute vec3 affid;
varying vec2 vUvF; varying vec2 vUvB; varying vec2 vUvS; varying vec2 vUvS2; varying vec2 vUvT; varying vec3 vObjN; varying vec3 vAff;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vUvF = uvF; vUvB = uvB; vUvS = uvS; vUvS2 = uvS2; vUvT = uvT; vObjN = normal; vAff = affid;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D oF; uniform sampler2D oB; uniform sampler2D oS; uniform sampler2D oT;
uniform float haS; uniform float haT; uniform float latoFoto; uniform vec3 cS; uniform vec3 cT; uniform vec3 cU;
varying vec2 vUvF; varying vec2 vUvB; varying vec2 vUvS; varying vec2 vUvS2; varying vec2 vUvT; varying vec3 vObjN; varying vec3 vAff;
vec3 vFotoCol = vec3(0.0);`)
      .replace('#include <map_fragment>', `
{
  vec3 n = normalize(vObjN), a = abs(n);
  float k = 6.0;
  float wF = n.z > 0.0 ? pow(a.z, k) * vAff.x : 0.0, wB = n.z < 0.0 ? pow(a.z, k) * vAff.x : 0.0;
  float wS = pow(a.x, k) * vAff.y, wT = n.y > 0.0 ? pow(a.y, k) * vAff.z : 0.0, wU = n.y < 0.0 ? pow(a.y, k) : 0.0;
  float tot = max(1e-4, wF + wB + wS + wT + wU);
  vec3 c = texture2D(oF, vUvF).rgb * wF + texture2D(oB, vUvB).rgb * wB
    + mix(cS, texture2D(oS, n.x * latoFoto > 0.0 ? vUvS : vUvS2).rgb, haS) * wS + mix(cT, texture2D(oT, vUvT).rgb, haT) * wT + cU * wU;
  diffuseColor.rgb *= c / tot;
  vFotoCol = c / tot;
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vFotoCol * 0.22;      // la foto resta luminosa come è (non più scura e spenta)`);
  };
  mat.customProgramCacheKey = () => 'ogg-proiezione-v4';
  const mats = mat;
  const geo = gi;
  return { geo, mats, W, D, H, colore: hex(F.media), scambiate, girata, estrusa };
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
  const chiave = `${def.id}|${mi.w}|${mi.d}|${mi.h}|${def.pianta}|${JSON.stringify(def.tipi || {})}`;
  const c = _cache.get(chiave);
  if (c && c !== 'attesa' && c !== 'errore') return c;
  if (c) return null;
  _cache.set(chiave, 'attesa');
  const v = def.viste || {};
  Promise.all([caricaImg(v.fronte), caricaImg(v.lato), caricaImg(v.sopra), caricaImg(v.dietro)])
    .then(([fronte, lato, sopra, dietro]) => {
      const r = geometriaOggetto({ fronte, lato, sopra, dietro, tipi: def.tipi || {} }, mi.w, mi.d, mi.h, def.pianta);
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
