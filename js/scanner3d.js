// =============================================================================
// SCANNER 3D A PEZZI — dalle foto (davanti, lato, sopra) + misure vere.
// Come lavora un modellatore (e ChatGPT): prima decide cosa è CORPO e cosa è PEZZO,
// poi costruisce il corpo liscio con una formula e i pezzi come solidi a sé.
//  1. contorno preciso di ogni foto (marching squares, sotto-pixel)
//  2. i PEZZI si staccano dove si stringono: due angoli rientranti vicini → taglio corto
//     (regola del "taglio più corto" della letteratura sulla scomposizione delle forme)
//  3. il CORPO (contorno senza pezzi) dà larghezza e profondità a ogni altezza → pelle liscia
// Le stesse regole valgono per ogni oggetto: niente tarature per il singolo prodotto.
// =============================================================================

// ---------------------------------------------------------------- maschera ----
/** Maschera 0..1 di una foto ritagliata (alfa), a risoluzione di lavoro. */
export function maschera(src, lato = 800) {
  if (!src) return null;
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, lato / Math.max(w0, h0));
  const w = Math.max(4, Math.round(w0 * k)), h = Math.max(4, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 5) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((q) => (d[q] + d[(w - 1) * 4 + q] + d[(h - 1) * w * 4 + q] + d[((h - 1) * w + w - 1) * 4 + q]) / 4);
  const A = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (haAlfa) A[i] = d[i * 4 + 3] / 255;
    else { const dd = Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]); A[i] = Math.max(0, Math.min(1, (dd - 25) / 30)); }
  }
  // solo il pezzo più grande (via puntini e scritte staccate)
  const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = A[i] > 0.5 ? 1 : 0;
  const lab = new Int32Array(w * h).fill(-1), st = new Int32Array(w * h); let best = -1, bestA = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    let sp = 0, a = 0; st[sp++] = i; lab[i] = n;
    while (sp) { const j = st[--sp], x = j % w; a++; for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) if (q >= 0 && q < w * h && m[q] && lab[q] < 0) { lab[q] = n; st[sp++] = q; } }
    if (a > bestA) { bestA = a; best = n; } n++;
  }
  if (best < 0) return null;
  for (let i = 0; i < w * h; i++) if (lab[i] !== best) A[i] = Math.min(A[i], 0.49);
  // chiudo i buchi interni (riflessi): per il CONTORNO conta solo il bordo esterno
  return { w, h, A, src, k, d };
}
const alfa = (M, x, y) => {                                    // bilineare, 0 fuori
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= M.w || yy >= M.h ? 0 : M.A[yy * M.w + xx]);
  return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
};

// ---------------------------------------------------------------- contorno ----
const area = (P) => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const perimetro = (P) => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };

/** Contorno esterno (marching squares con interpolazione: preciso al decimo di pixel). */
export function contorno(M) {
  const { w, h, A } = M;
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : A[y * w + x]);
  const W2 = w + 2;
  const hid = (x, y) => ((y + 1) * W2 + (x + 1)) * 2, vid = (x, y) => ((y + 1) * W2 + (x + 1)) * 2 + 1;
  const pt = new Map(), seg = [], adj = new Map();
  const lerp = (a, b) => { const t = (0.5 - a) / ((b - a) || 1e-6); return Math.max(0, Math.min(1, t)); };
  const punto = (id, x, y, vert) => {
    if (!pt.has(id)) {
      if (vert) pt.set(id, [x, y + lerp(v(x, y), v(x, y + 1))]);
      else pt.set(id, [x + lerp(v(x, y), v(x + 1, y)), y]);
    }
    return id;
  };
  const add = (a, b) => { const s = seg.length; seg.push([a, b]); for (const e of [a, b]) { if (!adj.has(e)) adj.set(e, []); adj.get(e).push(s); } };
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const a = v(x, y) > 0.5, b = v(x + 1, y) > 0.5, c = v(x + 1, y + 1) > 0.5, d = v(x, y + 1) > 0.5;
    const caso = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
    if (caso === 0 || caso === 15) continue;
    const T = () => punto(hid(x, y), x, y, false), B = () => punto(hid(x, y + 1), x, y + 1, false);
    const L = () => punto(vid(x, y), x, y, true), R = () => punto(vid(x + 1, y), x + 1, y, true);
    const centro = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 > 0.5;
    switch (caso) {
      case 1: case 14: add(L(), B()); break;
      case 2: case 13: add(B(), R()); break;
      case 3: case 12: add(L(), R()); break;
      case 4: case 11: add(T(), R()); break;
      case 6: case 9: add(T(), B()); break;
      case 7: case 8: add(T(), L()); break;
      case 5: if (centro) { add(T(), L()); add(B(), R()); } else { add(T(), R()); add(L(), B()); } break;
      case 10: if (centro) { add(T(), R()); add(L(), B()); } else { add(T(), L()); add(B(), R()); } break;
    }
  }
  // collego i segmenti in anelli chiusi; tengo il più grande
  const usato = new Uint8Array(seg.length);
  let migliore = null, aMax = 0;
  for (let s0 = 0; s0 < seg.length; s0++) {
    if (usato[s0]) continue;
    const anello = []; let s = s0, da = seg[s0][0];
    while (s >= 0 && !usato[s]) {
      usato[s] = 1; const [e0, e1] = seg[s]; const verso = e0 === da ? e1 : e0;
      anello.push(pt.get(verso));
      const lista = adj.get(verso) || []; s = -1;
      for (const q of lista) if (!usato[q]) { s = q; break; }
      da = verso;
    }
    const a = Math.abs(area(anello));
    if (M.conBuchi) (M._anelli = M._anelli || []).push(anello);
    if (a > aMax) { aMax = a; migliore = anello; }
  }
  if (!migliore || migliore.length < 8) return null;
  if (area(migliore) < 0) migliore.reverse();
  if (M.conBuchi) {
    // i BUCHI veri (lo spazio tra i montanti di un supporto, dentro un manico): gli altri anelli dentro
    const buchi = [];
    // (rifaccio il giro degli anelli: quelli già visti sono nell'ordine di prima)
    M._anelli.forEach((an) => { if (an !== migliore && Math.abs(area(an)) > aMax * 0.004 && dentro(migliore, an[0][0], an[0][1])) buchi.push(liscia(ricampiona(an, 1), 3)); });
    return { esterno: liscia(ricampiona(migliore, 1), 3), buchi };
  }
  return liscia(ricampiona(migliore, 1), 3);
}
/** Punti a distanza costante lungo il contorno. */
function ricampiona(P, passo) {
  const L = perimetro(P), n = Math.max(16, Math.min(5000, Math.round(L / passo)));
  const out = []; let i = 0, acc = 0, t = 0;
  const seg = (k) => { const a = P[k % P.length], b = P[(k + 1) % P.length]; return [a, b, Math.hypot(b[0] - a[0], b[1] - a[1])]; };
  let [a, b, l] = seg(0);
  for (let q = 0; q < n; q++) {
    const target = (q * L) / n;
    while (acc + l < target && i < P.length * 2) { acc += l; i++; [a, b, l] = seg(i); }
    t = l > 0 ? (target - acc) / l : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
/** Contorno lisciato con una gaussiana di sigma (in punti), chiuso. */
function lisciaGauss(P, sigma) {
  const n = P.length, r = Math.ceil(sigma * 3), w = [];
  for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const sw = w.reduce((a, b) => a + b, 0);
  return P.map((_, i) => { let x = 0, y = 0; for (let k = -r; k <= r; k++) { const q = P[(i + k + n * 8) % n]; x += q[0] * w[k + r]; y += q[1] * w[k + r]; } return [x / sw, y / sw]; });
}
/** Ammorbidisce il contorno (via i dentini dei pixel), passate [1 2 1]/4 circolari. */
function liscia(P, passate) {
  let Q = P;
  for (let k = 0; k < passate; k++) { const n = Q.length; Q = Q.map((p, i) => { const a = Q[(i + n - 1) % n], c = Q[(i + 1) % n]; return [(a[0] + 2 * p[0] + c[0]) / 4, (a[1] + 2 * p[1] + c[1]) / 4]; }); }
  return Q;
}

// --------------------------------------------------------- corpo e pezzi ----
/** quanto gira il contorno al punto i (scala k): > 0 convesso, < 0 rientrante */
function curvatura(P, i, k) {
  const n = P.length, a = P[(i - k + n * 4) % n], p = P[i], b = P[(i + k) % n];
  const ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}
/** pixel dentro un poligono (pari-dispari) */
function dentro(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/**
 * STACCA I PEZZI dal contorno: cerca due punti rientranti vicini tra loro ma lontani lungo
 * il contorno (il "collo" di un pezzo: base della manopola, gambo della leva, attacco dei
 * piedini o della maniglia) e taglia lì con un segmento dritto. Ripete finché non trova più
 * pezzi. Ritorna { corpo: contorno senza pezzi, pezzi: [{ arco, a, b, area, prof, pieno }] }.
 */
export function separaPezzi(P0, M, dbg = null) {
  let P = P0;
  const pezzi = [];
  const xs = P0.map((p) => p[0]), ys = P0.map((p) => p[1]);
  const Lmax = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const aTot = Math.abs(area(P0));
  for (let giro = 0; giro < 16; giro++) {
    const n = P.length;
    const k1 = Math.max(3, Math.round(n * 0.0035)), k2 = Math.max(5, Math.round(n * 0.009));
    const cur = P.map((_, i) => Math.min(curvatura(P, i, k1), curvatura(P, i, k2)));
    // punti rientranti: minimi locali di curvatura sotto −20°
    const cand = [];
    for (let i = 0; i < n; i++) {
      if (cur[i] > -0.35) continue;
      let min = true; for (let q = -k1; q <= k1 && min; q++) if (q && cur[(i + q + n) % n] < cur[i]) min = false;
      if (min) cand.push(i);
    }
    if (dbg && giro === 0) dbg.cand = cand.map((i) => P[i]);
    const kt = Math.max(4, k2);
    // direzione del contorno (media su kt punti) in avanti e all'indietro dal punto i
    const dirAvanti = (i) => { const a = P[i], b = P[(i + kt) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const dirIndietro = (i) => { const a = P[(i - kt + n * 4) % n], b = P[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const arcoAvanti = (a, b) => (a <= b ? P.slice(a, b + 1) : P.slice(a).concat(P.slice(0, b + 1)));
    const angolo = (u, cx, cy) => Math.acos(Math.max(-1, Math.min(1, u[0] * cx + u[1] * cy)));
    let best = null;
    /**
     * prova un taglio tra i punti i e j. pezzoDa: 'i' = il pezzo va da i a j in avanti, 'j' = da j a i,
     * null = il lato con l'area più piccola. raggio = il taglio continua il bordo da i (controlli solo in i).
     */
    const motivo = (i, j, m) => { if (dbg && giro === 0) (dbg.motivi = dbg.motivi || []).push([P[i].map(Math.round), P[j].map(Math.round), m]); };
    const prova = (i, j, pezzoDa, raggio) => {
      if (i === j) return;
      const pa = P[i], pb = P[j];
      const c = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (c < 2 || c > Lmax * 0.65) return;
      const arcoI = arcoAvanti(i, j), arcoJ = arcoAvanti(j, i);
      const aI = Math.abs(area(arcoI)), aJ = Math.abs(area(arcoJ));
      const daI = pezzoDa ? pezzoDa === 'i' : aI <= aJ;
      const arco = daI ? arcoI : arcoJ, ap = daI ? aI : aJ;
      if (ap > aTot * 0.3 || ap > (daI ? aJ : aI) * 0.45 || arco.length < 6) return motivo(i, j, 'area');
      // il taglio deve CONTINUARE il bordo del corpo (come la linea che c'era sotto il pezzo):
      // il corpo arriva a un estremo, prosegue dritto lungo il taglio e riparte dall'altro
      // nella stessa direzione. Un taglio di traverso staccherebbe un angolo del corpo.
      const [e2, e1] = daI ? [i, j] : [j, i];                 // il pezzo va da e2 a e1 (in avanti); il taglio da e2 a e1
      const cx = (P[e1][0] - P[e2][0]) / c, cy = (P[e1][1] - P[e2][1]) / c;
      const ang1 = angolo(dirIndietro(e2), cx, cy), ang2 = angolo(dirAvanti(e1), cx, cy);
      // e il PEZZO si stacca dal corpo con decisione (gira verso fuori di almeno ~43°):
      // staccare un angolo del corpo seguirebbe il contorno senza staccarsi
      const st1 = angolo(dirAvanti(e2), cx, cy), st2 = angolo(dirIndietro(e1), cx, cy);
      const controllaE2 = !raggio || e2 === i, controllaE1 = !raggio || e1 === i;
      const stacchi = [controllaE2 ? st1 : 9, controllaE1 ? st2 : 9];
      if (Math.min(...stacchi) < (raggio ? 1.05 : 0.75)) return motivo(i, j, 'stacco ' + stacchi.map((x) => Math.round(x * 57)));
      // attacchi NETTI (maniglie, beccucci): il corpo lì può anche curvare
      const netto = Math.min(...stacchi) > 1.2;
      const cont = Math.max(controllaE2 ? ang1 : 0, controllaE1 ? ang2 : 0);
      if (cont > (netto ? 0.8 : 0.5)) return motivo(i, j, 'continua ' + Math.round(cont * 57));   // oltre ~28° (45° se netti): non è il bordo del corpo
      // il taglio deve passare DENTRO il contorno (anche attraverso il buco di una maniglia)
      for (let q = 1; q < 8; q++) {
        const t2 = q / 8, x = pa[0] + (pb[0] - pa[0]) * t2, y = pa[1] + (pb[1] - pa[1]) * t2;
        if (alfa(M, x, y) < 0.3 && !dentro(P, x, y)) return motivo(i, j, 'fuori');
      }
      // quanto sporge il pezzo oltre il taglio
      const ux = (pb[0] - pa[0]) / c, uy = (pb[1] - pa[1]) / c;
      let prof = 0; for (const p of arco) prof = Math.max(prof, Math.abs((p[0] - pa[0]) * uy - (p[1] - pa[1]) * ux));
      if (prof < Math.max(2, Lmax * 0.012)) return motivo(i, j, 'poco ' + prof.toFixed(1));
      // quanto è "pieno" il pezzo (una maniglia ad anello ha un buco)
      let tot = 0, pien = 0;
      { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of arco) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        const st = Math.max(1, Math.max(x1 - x0, y1 - y0) / 40);
        // pieno = oggetto vero; il bianco piatto come lo sfondo dentro il pezzo è il BUCO di un manico
        // (il ritaglio lo chiude perché è circondato dall'oggetto)
        const sfondo = (x, y) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= M.w || yi >= M.h || !M.d) return false; const i = (yi * M.w + xi) * 4, r = M.d[i], g = M.d[i + 1], b = M.d[i + 2]; return 0.299 * r + 0.587 * g + 0.114 * b > 236 && Math.max(r, g, b) - Math.min(r, g, b) < 14; };
        for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) if (dentro(arco, x, y)) { tot++; if (alfa(M, x, y) > 0.5 && !sfondo(x, y)) pien++; } }
      const pieno = tot ? pien / tot : 1;
      if (c > Lmax * 0.45 && pieno > 0.75 && !netto) return motivo(i, j, 'lungo');             // tagli lunghi solo per maniglie (con il buco)
      if (prof / c < (netto ? 0.04 : 0.15) && pieno > 0.75) return motivo(i, j, 'gobba ' + (prof / c).toFixed(2));   // gobbe basse e larghe con attacchi morbidi: è il corpo
      // prima i tagli più CORTI (i pezzi piccoli e ben attaccati), come fa un modellatore
      const punti = -c;
      if (!best || punti > best.punti) best = { i, j, arco, ap, c, prof, pieno, punti, angoli: [ang1, ang2, st1, st2], daI, raggio };
    };
    for (let s = 0; s < cand.length; s++) for (let t = s + 1; t < cand.length; t++) prova(cand[s], cand[t], null, false);
    if (!best) break;
    const { i, j } = best;
    pezzi.push({ arco: best.arco, a: P[i], b: P[j], area: best.ap, prof: best.prof, pieno: best.pieno, angoli: best.angoli, c: best.c, raggio: best.raggio });
    // il corpo è l'altro arco, chiuso dal taglio dritto
    const corpo = best.daI ? arcoAvanti(j, i) : arcoAvanti(i, j);
    P = ricampiona(corpo, 1);
  }
  return { corpo: P, pezzi };
}

// ------------------------------------------------------------- profili ----
/** Bordo sinistro e destro del contorno alla riga y (intersezioni esatte). */
function bordiRiga(P, y) {
  let l = Infinity, r = -Infinity;
  for (let i = 0, n = P.length; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    if ((a[1] <= y) === (b[1] <= y)) continue;
    const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
    if (x < l) l = x; if (x > r) r = x;
  }
  return r > l ? [l, r] : null;
}
/** Curva liscia (Whittaker) di una serie con buchi (NaN). */
function curvaLiscia(y, lambda) {
  const n = y.length; if (n < 5) return Float64Array.from(y);
  const d0 = new Float64Array(n), d1 = new Float64Array(n), d2 = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ok = !Number.isNaN(y[i]); d0[i] = ok ? 1 : 0; b[i] = ok ? y[i] : 0; }
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
  for (let i = 0; i < n; i++) if (Number.isNaN(y[i])) x[i] = NaN;
  return x;
}

/**
 * VISTA analizzata: contorno, corpo, pezzi e la conversione pixel → mm.
 * larg/alt = misure vere (mm) della foto: tutto il riquadro dell'oggetto = quelle misure.
 */
export function analizzaVista(src, larg, alt, dbg = null) {
  const M = maschera(src); if (!M) return null;
  const P = contorno(M); if (!P) return null;
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = larg / Math.max(1e-6, x1 - x0), sy = alt / Math.max(1e-6, y1 - y0);
  const { corpo, pezzi } = separaPezzi(P, M, dbg);
  // in mm: u da sinistra (0..larg), v dall'alto (0..alt)
  const mm = (p) => [(p[0] - x0) * sx, (p[1] - y0) * sy];
  // il CORPO di un elettrodomestico è una forma morbida: via le onde del ritaglio
  // (gaussiana di ~1% del contorno: gli spigoli restano, le ondine no)
  const corpoL = lisciaGauss(ricampiona(corpo, 1), Math.max(2, perimetro(corpo) * 0.008));
  const corpoMm = corpoL.map(mm);
  const pezziMm = pezzi.map((q) => ({ ...q, arco: q.arco.map(mm), a: mm(q.a), b: mm(q.b) }));
  // profilo del corpo riga per riga (in mm), lisciato appena
  const N = 400, L = new Float64Array(N + 1), R = new Float64Array(N + 1);
  let vMin = Infinity, vMax = -Infinity; for (const p of corpoMm) { vMin = Math.min(vMin, p[1]); vMax = Math.max(vMax, p[1]); }
  for (let r = 0; r <= N; r++) {
    const v = vMin + ((vMax - vMin) * r) / N, b = bordiRiga(corpoMm, Math.min(vMax - 1e-6, Math.max(vMin + 1e-6, v)));
    L[r] = b ? b[0] : NaN; R[r] = b ? b[1] : NaN;
  }
  const lam = Math.pow((N * 0.03) / (2 * Math.PI), 4);
  const Ls = curvaLiscia(L, lam), Rs = curvaLiscia(R, lam);
  const bordi = (v) => {                                    // [sinistra, destra] in mm alla quota v (dall'alto), o null
    if (v < vMin || v > vMax) return null;
    const x = ((v - vMin) / Math.max(1e-6, vMax - vMin)) * N, i = Math.min(N - 1, Math.floor(x)), t = x - i;
    const l = Ls[i] * (1 - t) + Ls[i + 1] * t, r = Rs[i] * (1 - t) + Rs[i + 1] * t;
    return Number.isNaN(l) || Number.isNaN(r) ? null : [l, r];
  };
  return { M, P, corpo: corpoL, pezzi, corpoMm, pezziMm, larg, alt, vMin, vMax, bordi, px: { x0, y0, sx, sy } };
}

// ------------------------------------------------------- forma da sopra ----
/** Superellisse che sta meglio su dei punti (Nelder–Mead): { cx, cy, a, b, n }. */
export function fitSuperellisse(P) {
  const passo = Math.max(1, Math.floor(P.length / 600)), Q = P.filter((_, k) => k % passo === 0);
  const xs = Q.map((p) => p[0]), ys = Q.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const start = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, Math.log(3)];
  const res = new Float64Array(Q.length);
  const costo = ([cx, cy, a, b, ln]) => {
    if (a < 1 || b < 1 || ln < Math.log(1.6) || ln > Math.log(30)) return 1e12;
    const n = Math.exp(ln);
    for (let k = 0; k < Q.length; k++) {
      const dx = Math.abs(Q[k][0] - cx), dy = Math.abs(Q[k][1] - cy), rho = Math.hypot(dx, dy);
      if (rho < 1e-6) { res[k] = Math.min(a, b); continue; }
      const F = Math.pow(dx / a, n) + Math.pow(dy / b, n);
      res[k] = rho * (1 - Math.pow(F, -1 / n));
    }
    const ord = Array.from(res, Math.abs).sort((p, q) => p - q), kk = Math.floor(ord.length * 0.9);
    let s = 0; for (let k = 0; k < kk; k++) s += ord[k] * ord[k];
    return s / kk;
  };
  const passi = [start[2] * 0.05, start[3] * 0.05, start[2] * 0.05, start[3] * 0.05, 0.3];
  let S = [start, ...passi.map((d, j) => { const q = start.slice(); q[j] += d; return q; })].map((x) => ({ x, f: costo(x) }));
  for (let it = 0; it < 500; it++) {
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
  return { cx, cy, a, b, n: Math.max(2, Math.min(16, Math.exp(ln))) };
}

// ---------------------------------------------------------------- corpo 3D ----
/**
 * CORPO LISCIO: a ogni altezza una superellisse larga come il corpo nella foto davanti e
 * profonda come il corpo nella foto di lato (i pezzi sono già tolti: niente fasce).
 * fr(y) → [xl, xr] mm, la(y) → [zb, zf] mm (y = altezza da terra). Ritorna { vert, ind }.
 */
export function corpoLiscio(fr, la, yMin, yMax, nSup) {
  const M = 160, NY = 180;
  const ANG = Array.from({ length: M }, (_, q) => (q / M) * Math.PI * 2);
  const anelli = [];
  for (let j = 0; j <= NY; j++) {
    const t = j / NY, s = t - (Math.sin(2 * Math.PI * t) / (2 * Math.PI)) * 0.75;    // più fitto in cima e in fondo
    const y = yMin + (yMax - yMin) * s;
    const X = fr(y), Z = la(y); if (!X || !Z) continue;
    const [xl, xr] = X, [zb, zf] = Z;
    if (xr - xl < 0.5 || zf - zb < 0.5) continue;
    const cx = (xl + xr) / 2, cz = (zb + zf) / 2, hx = (xr - xl) / 2, hz = (zf - zb) / 2;
    anelli.push({ y, p: ANG.map((th) => { const c = Math.cos(th), sn = Math.sin(th); return [cx + hx * Math.sign(c) * Math.pow(Math.abs(c), 2 / nSup), cz + hz * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / nSup)]; }) });
  }
  if (anelli.length < 2) return null;
  const vert = [], ind = [];
  anelli.forEach((r) => { for (const [x, z] of r.p) vert.push(x, r.y, z); });
  for (let r = 0; r < anelli.length - 1; r++) for (let q = 0; q < M; q++) {
    const a = r * M + q, b = r * M + ((q + 1) % M), c = (r + 1) * M + q, d = (r + 1) * M + ((q + 1) % M);
    ind.push(a, b, c, b, d, c);
  }
  for (const [r, giu] of [[0, true], [anelli.length - 1, false]]) {
    let sx = 0, sz = 0; for (const [x, z] of anelli[r].p) { sx += x; sz += z; }
    const ci = vert.length / 3; vert.push(sx / M, anelli[r].y, sz / M);
    for (let q = 0; q < M; q++) { const a = r * M + q, b = r * M + ((q + 1) % M); if (giu) ind.push(ci, a, b); else ind.push(ci, b, a); }
  }
  // facce rivolte FUORI: se il volume viene negativo, giro tutti i triangoli
  let vol = 0;
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
    vol += vert[a] * (vert[b + 1] * vert[c + 2] - vert[b + 2] * vert[c + 1]) - vert[a + 1] * (vert[b] * vert[c + 2] - vert[b + 2] * vert[c]) + vert[a + 2] * (vert[b] * vert[c + 1] - vert[b + 1] * vert[c]);
  }
  if (vol < 0) for (let t = 0; t < ind.length; t += 3) { const x = ind[t + 1]; ind[t + 1] = ind[t + 2]; ind[t + 2] = x; }
  return { vert, ind };
}

// ------------------------------------------------------------ forma intera ----
/**
 * FORMA DELL'OGGETTO dalle foto (già girate: sopra con il davanti in basso).
 * Ritorna { corpo: { vert, ind }, davantiSx, viste: { F, S, T }, nSup } o null.
 */
export function formaOggetto(foto, W, D, H, THREE = null, pianta = 'auto') {
  const F = analizzaVista(foto.fronte, W, H); if (!F) return null;
  const S = foto.lato ? analizzaVista(foto.lato, D, H) : null;
  const T = foto.sopra ? analizzaVista(foto.sopra, W, D) : null;
  // nella foto di lato il DAVANTI è dove stanno i comandi: i pezzi attaccati a quel bordo
  let davantiSx = foto.latoDavanti === 'sx';
  if (S && !foto.latoDavanti) {
    let sx = 0, dx = 0;
    for (const q of S.pezziMm) { const xm = (q.a[0] + q.b[0]) / 2; if (xm < D * 0.2) sx += q.area; else if (xm > D * 0.8) dx += q.area; }
    davantiSx = sx > dx;
  }
  const fr = (y) => { const b = F.bordi(H - y); return b ? [b[0] - W / 2, b[1] - W / 2] : null; };
  const la = S ? (y) => { const b = S.bordi(H - y); if (!b) return null; return davantiSx ? [D / 2 - b[1], D / 2 - b[0]] : [b[0] - D / 2, b[1] - D / 2]; } : () => [-D / 2, D / 2];
  let yMin = H - F.vMax, yMax = H - F.vMin;
  if (S) { yMin = Math.max(yMin, H - S.vMax); yMax = Math.min(yMax, H - S.vMin); }
  // forma vista da sopra: superellisse sul corpo della foto da sopra, se è davvero dall'alto
  // senza la foto da sopra: la forma vista da sopra si capisce dalla CIMA delle foto. Una cupola
  // (bollitore) = corpo tondo; spalle strette (tostapane) = rettangolo con angoli tondi;
  // spigoli vivi (microonde, frigo) = quasi squadrato
  const cupola = (V) => {
    if (!V) return null;
    let mw = 0; for (let t = 0; t <= 200; t++) { const b = V.bordi(V.vMin + ((V.vMax - V.vMin) * t) / 200); if (b) mw = Math.max(mw, b[1] - b[0]); }
    for (let t = 0; t <= 200; t++) { const b = V.bordi(V.vMin + ((V.vMax - V.vMin) * t) / 200); if (b && b[1] - b[0] >= mw * 0.9) return t / 200; }
    return null;
  };
  const cF = cupola(F), cS = cupola(S), cc = [cF, cS].filter((v) => v != null);
  const h90 = cc.length ? cc.reduce((a, b) => a + b, 0) / cc.length : 0.12;
  let nSup = h90 > 0.22 ? 2.2 : h90 > 0.1 ? 3.5 : h90 > 0.05 ? 5 : 8;
  if (pianta === 'tonda' || pianta === 'ovale') nSup = 2; else if (pianta === 'squadrata') nSup = 8;   // scelta a mano (senza foto da sopra)
  if (T) {
    const f = fitSuperellisse(T.corpoMm);
    if (Math.abs(Math.log((f.a / f.b) / (W / D))) < 0.5) nSup = f.n;
  }
  const corpo = corpoLiscio(fr, la, yMin, yMax, nSup);
  if (!corpo) return null;
  const pezzi3d = THREE ? pezziSolidi({ F, S, T }, davantiSx, W, D, H, fr, la, yMin, yMax, THREE, nSup) : [];
  return { corpo, pezzi3d, davantiSx, viste: { F, S, T }, nSup, yMin, yMax };
}

// --------------------------------------------------------------- pezzi 3D ----
/** Forma di un pezzo nella sua foto: asse del taglio, larghezze man mano che si allontana dal corpo. */
function formaPezzo(q) {
  const [ax, ay] = q.a, [bx, by] = q.b, c = Math.max(1e-6, Math.hypot(bx - ax, by - ay));
  const tx = (bx - ax) / c, ty = (by - ay) / c;
  let nx = -ty, ny = tx;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  let gx = 0, gy = 0; for (const p of q.arco) { gx += p[0]; gy += p[1]; } gx /= q.arco.length; gy /= q.arco.length;
  if ((gx - mx) * nx + (gy - my) * ny < 0) { nx = -nx; ny = -ny; }
  // coordinate del pezzo: s lungo il taglio (dal centro), d verso fuori
  const pts = q.arco.map((p) => [(p[0] - mx) * tx + (p[1] - my) * ty, (p[0] - mx) * nx + (p[1] - my) * ny]);
  pts.push(pts[0]);
  let prof = 0; for (const p of pts) prof = Math.max(prof, p[1]);
  const K = 16, fette = [];
  for (let k = 0; k < K; k++) {
    const d = ((k + 0.5) / K) * prof; let lo = Infinity, hi = -Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [s1, d1] = pts[i], [s2, d2] = pts[i + 1];
      if ((d1 <= d) === (d2 <= d)) continue;
      const s = s1 + ((d - d1) * (s2 - s1)) / (d2 - d1); if (s < lo) lo = s; if (s > hi) hi = s;
    }
    fette.push(hi > lo ? { d, lo, hi, w: hi - lo, cen: (lo + hi) / 2 } : { d, lo: 0, hi: 0, w: 0, cen: 0 });
  }
  // COLLO (gambo sottile) e TESTA (pallina, manopola) lungo l'uscita
  const collo = Math.min(...fette.slice(1, Math.round(K * 0.55)).map((f) => f.w || Infinity));
  let testa = fette[Math.round(K * 0.55)], iT = Math.round(K * 0.55);
  for (let k = Math.round(K * 0.5); k < K; k++) if (fette[k].w > testa.w) { testa = fette[k]; iT = k; }
  return { mid: [mx, my], t: [tx, ty], n: [nx, ny], c, prof, fette, collo, testa, iT };
}
/** dalla foto: (u, v) in mm → 3D, e direzione (nu, nv) → 3D. ignoto = asse che la foto non vede */
function asseVista(vista, davantiSx, W, D, H) {
  if (vista === 'F') return { p: (u, v, w = 0) => [u - W / 2, H - v, w], d: (nu, nv) => [nu, -nv, 0], ignoto: 2 };
  if (vista === 'S') return { p: (u, v, w = 0) => [w, H - v, davantiSx ? D / 2 - u : u - D / 2], d: (nu, nv) => [0, -nv, davantiSx ? -nu : nu], ignoto: 0 };
  return { p: (u, v, w = 0) => [u - W / 2, w, v - D / 2], d: (nu, nv) => [nu, 0, nv], ignoto: 1 };
}
/**
 * PEZZI SOLIDI: ogni pezzo staccato dalle foto diventa una forma ideale.
 *  - con un collo (gambo sottile e testa più larga): gambo cilindrico + sfera (leva)
 *  - compatto: cilindro (manopola, tasto) o blocco arrotondato (maniglia), sporgente quanto nella foto
 *  - sotto il corpo: piedini (posizioni da davanti × lato)
 * La posizione sull'asse che una foto non vede viene dall'altra foto (sopra, davanti) o dal centro.
 */
function pezziSolidi(viste, davantiSx, W, D, H, fr, la, yMin, yMax, THREE, nSup = 3) {
  const out = [];
  const forme = [];
  for (const k of ['F', 'S', 'T']) {
    const v = viste[k]; if (!v) continue;
    const ax = asseVista(k, davantiSx, W, D, H);
    for (const q of v.pezziMm) {
      const f = formaPezzo(q);
      const dir = ax.d(f.n[0], f.n[1]);
      forme.push({ vista: k, q, f, ax, dir, usato: false });
    }
  }
  const aggiungi = (geo, mat4) => { geo.applyMatrix4(mat4); out.push(geo); };
  const orienta = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  // ---- PIEDINI: pezzi rivolti in giù (davanti e lato insieme)
  const giuF = forme.filter((x) => x.vista === 'F' && x.dir[1] < -0.8), giuS = forme.filter((x) => x.vista === 'S' && x.dir[1] < -0.8);
  if (giuF.length || giuS.length) {
    const xs = giuF.length ? giuF.map((x) => ({ c: x.ax.p(x.f.mid[0], x.f.mid[1])[0], w: x.f.c, h: x.f.prof })) : null;
    const zs = giuS.length ? giuS.map((x) => ({ c: x.ax.p(x.f.mid[0], x.f.mid[1])[2], w: x.f.c, h: x.f.prof })) : null;
    // un piedino visto da una parte sola: il suo gemello è dall'altra parte (oggetti simmetrici)
    const gemelli = (l, est) => (l && l.length === 1 && Math.abs(l[0].c) > est * 0.15 ? [l[0], { ...l[0], c: -l[0].c }] : l);
    const lx = gemelli(xs, W) || [{ c: -W * 0.35, w: (zs[0].w), h: zs[0].h }, { c: W * 0.35, w: zs[0].w, h: zs[0].h }];
    const lz = gemelli(zs, D) || [{ c: -D * 0.35, w: lx[0].w, h: lx[0].h }, { c: D * 0.35, w: lx[0].w, h: lx[0].h }];
    // i piedini stanno SOTTO la base: dentro la sua impronta (superellisse del fondo del corpo)
    const X = fr(yMin + 0.5) || [-W / 2, W / 2], Z = la(yMin + 0.5) || [-D / 2, D / 2];
    const cx = (X[0] + X[1]) / 2, cz = (Z[0] + Z[1]) / 2, hx = (X[1] - X[0]) / 2, hz = (Z[1] - Z[0]) / 2;
    const dentroBase = (x, z) => Math.pow(Math.abs(x - cx) / hx, nSup) + Math.pow(Math.abs(z - cz) / hz, nSup) <= 1;
    for (const a of lx) for (const b of lz) {
      const rx = (a.w * 0.9) / 2, rz = (b.w * 0.9) / 2, h = Math.max(a.h, b.h) + 2;
      let px = a.c, pz = b.c;
      for (let k = 0; k < 40; k++) {                                   // lo avvicino al centro finché sta tutto dentro
        const sx = Math.sign(px - cx) || 1, sz = Math.sign(pz - cz) || 1;
        if (dentroBase(px + sx * rx * 1.05, pz + sz * rz * 1.05)) break;
        px = cx + (px - cx) * 0.97; pz = cz + (pz - cz) * 0.97;
      }
      const g = new THREE.CylinderGeometry(1, 1, h, 32, 1); g.scale(rx, 1, rz);
      aggiungi(g, new THREE.Matrix4().makeTranslation(px, h / 2 - 1, pz));
    }
    for (const x of giuF.concat(giuS)) x.usato = true;
  }
  // ---- pezzi di lato/davanti/dietro: abbino quelli visti in due foto
  for (const x of forme) {
    if (x.usato || x.dir[1] < -0.8 || x.vista === 'T') continue;
    // l'asse che questa foto non vede: dalla foto da sopra (stessa direzione, sporgenza simile)
    let w = 0, largh = null;
    const altri = forme.filter((o) => !o.usato && o !== x && o.vista === 'T' && o.dir[0] * x.dir[0] + o.dir[2] * x.dir[2] > 0.7);
    if (altri.length) {
      altri.sort((p, q) => Math.abs(p.f.prof - x.f.prof) - Math.abs(q.f.prof - x.f.prof));
      const o = altri[0];
      if (Math.abs(o.f.prof - x.f.prof) < Math.max(x.f.prof, o.f.prof) * 0.6) {
        const p3 = o.ax.p(o.f.mid[0], o.f.mid[1]);
        w = x.ax.ignoto === 0 ? p3[0] : p3[2];
        largh = o.f.c; o.usato = true;
      }
    }
    x.usato = true;
    const f = x.f, dir = new THREE.Vector3(...x.dir).normalize();
    const base = new THREE.Vector3(...x.ax.p(f.mid[0], f.mid[1], w));
    const conCollo = f.testa.w > Math.max(f.collo * 1.45, f.c * 1.3) && Number.isFinite(f.collo);
    if (x.q.pieno < 0.85 && f.c > f.prof * 0.8) {
      // MANICO AD ANELLO (con il buco): un tubo che segue la curva del manico
      const r = Math.max(3, Math.min(largh ? largh / 2 : f.c * 0.08, f.prof * 0.3));
      const [mx, my] = f.mid, [nx, ny] = f.n;
      const pts = [];
      const arco = x.q.arco, passo = Math.max(1, Math.floor(arco.length / 40));
      for (let k = 0; k < arco.length; k += passo) {
        const p = arco[k], d = (p[0] - mx) * nx + (p[1] - my) * ny;
        if (d < r * 0.5) continue;                                   // i punti sul corpo non fanno parte del manico
        // dal bordo esterno verso l'interno di un raggio (il centro del tubo)
        const k0 = Math.max(0, k - 3), k1 = Math.min(arco.length - 1, k + 3);
        let tx = arco[k1][0] - arco[k0][0], ty = arco[k1][1] - arco[k0][1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        let ix = -ty, iy = tx;                                       // normale: verso l'interno del pezzo
        const gx = arco.reduce((t, q) => t + q[0], 0) / arco.length, gy = arco.reduce((t, q) => t + q[1], 0) / arco.length;
        if ((gx - p[0]) * ix + (gy - p[1]) * iy < 0) { ix = -ix; iy = -iy; }
        pts.push(new THREE.Vector3(...x.ax.p(p[0] + ix * r, p[1] + iy * r, w)));
      }
      // i due capi entrano nel corpo
      if (pts.length >= 4) {
        const a0 = new THREE.Vector3(...x.ax.p(x.q.a[0], x.q.a[1], w)), b0 = new THREE.Vector3(...x.ax.p(x.q.b[0], x.q.b[1], w));
        const [inizio, fine] = pts[0].distanceTo(a0) < pts[0].distanceTo(b0) ? [a0, b0] : [b0, a0];
        const curva = new THREE.CatmullRomCurve3([inizio.clone().addScaledVector(dir, -r), ...pts, fine.clone().addScaledVector(dir, -r)]);
        aggiungi(new THREE.TubeGeometry(curva, 80, r, 16, false), new THREE.Matrix4());
        continue;
      }
    }
    // PEZZO LUNGO E SOTTILE (maniglia, gancio, barra, beccuccio): un tubo lungo la sua LINEA DI
    // MEZZO, grosso come nella foto. La linea di mezzo: i due lati del pezzo, percorsi insieme
    // dall'attacco alla punta, e il punto a metà tra loro.
    if (!conCollo) {
      const arco = x.q.arco, n = arco.length;
      const lung = [0]; for (let k = 1; k < n; k++) lung.push(lung[k - 1] + Math.hypot(arco[k][0] - arco[k - 1][0], arco[k][1] - arco[k - 1][1]));
      const Lp = lung[n - 1];
      const aDist = (t) => { let k = 1; while (k < n - 1 && lung[k] < t) k++; const u = (t - lung[k - 1]) / Math.max(1e-6, lung[k] - lung[k - 1]); return [arco[k - 1][0] + (arco[k][0] - arco[k - 1][0]) * u, arco[k - 1][1] + (arco[k][1] - arco[k - 1][1]) * u]; };
      const K = 40, centro = [], spess = [];
      for (let k = 0; k <= K; k++) {
        const t = (k / K) * (Lp / 2), a = aDist(t), b = aDist(Lp - t);
        centro.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); spess.push(Math.hypot(a[0] - b[0], a[1] - b[1]));
      }
      let lungC = 0; for (let k = 1; k <= K; k++) lungC += Math.hypot(centro[k][0] - centro[k - 1][0], centro[k][1] - centro[k - 1][1]);
      const sp = spess.slice(Math.round(K * 0.2), Math.round(K * 0.85)).sort((p, q) => p - q);
      const grosso = sp.length ? sp[sp.length >> 1] : f.c;
      if (lungC > grosso * 2.6 && grosso > 1) {
        const r = Math.max(2, Math.min(grosso / 2, largh ? largh / 2 : grosso / 2));
        const pts = [];
        for (let k = 0; k <= K; k += 2) pts.push(new THREE.Vector3(...x.ax.p(centro[k][0], centro[k][1], w)));
        // l'attacco entra un po' nel corpo
        pts[0].addScaledVector(dir, -r);
        const curva = new THREE.CatmullRomCurve3(pts);
        aggiungi(new THREE.TubeGeometry(curva, 80, r, 16, false), new THREE.Matrix4());
        // punta chiusa (mezza sfera)
        const fine = curva.getPoint(1);
        aggiungi(new THREE.SphereGeometry(r, 16, 10), new THREE.Matrix4().makeTranslation(fine.x, fine.y, fine.z));
        continue;
      }
    }
    if (conCollo) {
      // LEVA: gambo + pallina
      const r = f.testa.w / 2, dC = Math.min(f.prof - r, f.testa.d);
      const st = Math.max(1.5, Math.min(f.collo, f.c) / 2);
      const centro = base.clone().addScaledVector(dir, Math.max(r, f.prof - r));
      const lateral = new THREE.Vector3(...x.ax.d(f.t[0], f.t[1])).normalize();
      centro.addScaledVector(lateral, f.testa.cen);
      const g1 = new THREE.CylinderGeometry(st, st, Math.max(1, f.prof - r) + 3, 24, 1);
      const m1 = new THREE.Matrix4().compose(base.clone().addScaledVector(dir, (Math.max(1, f.prof - r) + 3) / 2 - 3), orienta(x.dir), new THREE.Vector3(1, 1, 1));
      aggiungi(g1, m1);
      const g2 = new THREE.SphereGeometry(r, 32, 20);
      aggiungi(g2, new THREE.Matrix4().makeTranslation(centro.x, centro.y, centro.z));
    } else {
      // MANOPOLA / TASTO / MANIGLIA: cilindro se è tondo (largo uguale da due foto), se no blocco
      const alto = f.c, prof = f.prof + 3, lg = largh || f.c;
      const tondo = !largh || Math.abs(Math.log(lg / alto)) < 0.35;
      const centro = base.clone().addScaledVector(dir, prof / 2 - 3);
      if (tondo) {
        const g = new THREE.CylinderGeometry((alto + lg) / 4, (alto + lg) / 4, prof, 40, 1);
        aggiungi(g, new THREE.Matrix4().compose(centro, orienta(x.dir), new THREE.Vector3(1, 1, 1)));
      } else {
        const g = new THREE.BoxGeometry(x.ax.ignoto === 0 ? lg : prof, alto, x.ax.ignoto === 0 ? prof : lg, 2, 2, 2);
        aggiungi(g, new THREE.Matrix4().makeTranslation(centro.x, centro.y, centro.z));
      }
    }
  }
  return out;
}

// ------------------------------------------------------------ sagoma estrusa ----
/**
 * SAGOMA CON SPESSORE: il ritaglio della foto diventa un solido spesso "prof" mm, con gli
 * spigoli arrotondati e i vuoti veri lasciati vuoti (tra i montanti di un supporto, dentro un
 * manico). Visto davanti è IDENTICO alla foto. Per oggetti piatti o composti (ceppo dei
 * coltelli, tagliere, cornice) o quando c'è una sola foto dritta.
 */
export function sagomaEstrusa(src, larg, alt, prof, THREE) {
  const M = maschera(src); if (!M) return null;
  M.conBuchi = true;
  const C = contorno(M); if (!C) return null;
  const { esterno, buchi } = C;
  const xs = esterno.map((p) => p[0]), ys = esterno.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = larg / Math.max(1e-6, x1 - x0), sy = alt / Math.max(1e-6, y1 - y0);
  const semplice = (P, n) => ricampiona(P, Math.max(1, perimetro(P) / n));
  const mm = (p) => new THREE.Vector2((p[0] - x0) * sx - larg / 2, alt - (p[1] - y0) * sy);
  const forma = new THREE.Shape(semplice(esterno, 320).map(mm));
  for (const b of buchi) forma.holes.push(new THREE.Path(semplice(b, 120).map(mm)));
  const sm = Math.max(1, Math.min(prof * 0.12, 8));
  const g = new THREE.ExtrudeGeometry(forma, { depth: Math.max(1, prof - 2 * sm), bevelEnabled: true, bevelThickness: sm, bevelSize: sm * 0.6, bevelOffset: -sm * 0.6, bevelSegments: 3, curveSegments: 4, steps: 1 });
  g.translate(0, 0, -(prof - 2 * sm) / 2);
  return g;
}
/**
 * SOLIDO "AL TORNIO" da UNA foto davanti, per gli oggetti TONDI (sgabelli, lampade, vasi, bottiglie,
 * caraffe): a ogni altezza la larghezza della foto diventa un'ellisse larga così e profonda
 * larghezza × prof/larg. Le parti staccate (seduta, asta, poggiapiedi, base, leva) restano
 * pezzi separati che seguono la foto. Prima questi oggetti venivano "estrusi": visti di lato
 * erano una lastra piena profonda quanto l'oggetto.
 */
export function solidoDiRotazione(src, larg, alt, prof, THREE) {
  const M = maschera(src, 600); if (!M) return null;
  const { w, h, A } = M;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return null;
  const sx = larg / (x1 - x0 + 1), sy = alt / (y1 - y0 + 1), kz = prof / larg, xm = (x0 + x1 + 1) / 2;
  const SEG = 40;
  // i tratti pieni di una riga, con il bordo a metà pixel (alfa 0,5)
  const tratti = (y) => {
    const out = []; let a = -1;
    const pieno = (x) => A[y * w + x] > 0.5;
    for (let x = x0; x <= x1 + 1; x++) {
      const p = x <= x1 && pieno(x);
      if (p && a < 0) a = x;
      if (!p && a >= 0) {
        const ea = a > 0 ? a - 0.5 + (0.5 - A[y * w + a - 1]) / Math.max(1e-3, A[y * w + a] - A[y * w + a - 1]) : a;
        const eb = x - 1 < w - 1 ? x - 0.5 + (A[y * w + x - 1] - 0.5) / Math.max(1e-3, A[y * w + x - 1] - A[y * w + Math.min(w - 1, x)]) : x;
        if (x - a >= 1) out.push([Math.max(a - 1, ea), Math.min(x, eb)]);
        a = -1;
      }
    }
    return out;
  };
  // TUBI: un tratto continua il tubo della riga sotto se si toccano e nessuno dei due si divide
  const tubi = [], attivi = [];
  const passo = Math.max(1, Math.round((y1 - y0) / 260));
  const anello = (tr, y) => ({ cx: ((tr[0] + tr[1]) / 2 - xm) * sx, a: Math.max(0.6, (tr[1] - tr[0]) / 2 * sx), y: alt - (y - y0 + 0.5) * sy });
  for (let y = y1; y >= y0 - passo; y -= passo) {
    const riga = y >= y0 ? tratti(y) : [];
    const tocca = (t, r) => r[0] <= t.ult[1] + 1 && r[1] >= t.ult[0] - 1;
    const nuovi = [];
    const usati = new Set();
    for (const r of riga) {
      const cand = attivi.filter((t) => tocca(t, r));
      const unico = cand.length === 1 && riga.filter((q) => tocca(cand[0], q)).length === 1 && !usati.has(cand[0]);
      if (unico) { const t = cand[0]; t.anelli.push(anello(r, y)); t.ult = r; usati.add(t); nuovi.push(t); }
      else {
        // si divide o si unisce: tubo nuovo, che parte dalla riga di prima (niente fessure)
        const t = { anelli: [anello(r, Math.min(y1, y + passo)), anello(r, y)], ult: r };
        tubi.push(t); nuovi.push(t);
      }
    }
    attivi.length = 0; attivi.push(...nuovi);
    if (!tubi.length && riga.length) { /* primo giro */ }
    for (const t of nuovi) if (!tubi.includes(t)) tubi.push(t);
  }
  // geometria: anelli ellittici uniti, con il tappo sotto e sopra
  const pos = [], ind = [];
  for (const t of tubi) {
    if (t.anelli.length < 2) continue;
    const base = pos.length / 3;
    for (const r of t.anelli) for (let k = 0; k < SEG; k++) { const th = (k / SEG) * Math.PI * 2; pos.push(r.cx + r.a * Math.cos(th), r.y, r.a * kz * Math.sin(th)); }
    for (let i = 0; i < t.anelli.length - 1; i++) for (let k = 0; k < SEG; k++) {
      const a0 = base + i * SEG + k, a1 = base + i * SEG + (k + 1) % SEG, b0 = a0 + SEG, b1 = a1 + SEG;
      ind.push(a0, b0, a1, a1, b0, b1);
    }
    for (const [i, giu] of [[0, true], [t.anelli.length - 1, false]]) {
      const r = t.anelli[i], c = pos.length / 3; pos.push(r.cx, r.y, 0);
      for (let k = 0; k < SEG; k++) { const a0 = base + i * SEG + k, a1 = base + i * SEG + (k + 1) % SEG; if (giu) ind.push(c, a0, a1); else ind.push(c, a1, a0); }
    }
  }
  if (!ind.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  return g;
}
/** Quanto la sagoma è "piena" rispetto al suo involucro convesso (1 = forma semplice). */
export function compattezza(src) {
  const M = maschera(src, 400); if (!M) return 1;
  const P = contorno(M); if (!P) return 1;
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  return Math.abs(area(P)) / Math.max(1e-6, Math.abs(area(hull)));
}
