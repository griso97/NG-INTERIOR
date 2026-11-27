// =============================================================================
// FOTO CONTINUA dei materiali: la usano l'aggiunta dei materiali (Impostazioni → catalogo) e il
// caricamento dei legni e colori del sito (materiali.js). Niente da importare: si carica leggera.
/** Media mobile (box) separabile, raggio r, su un canale Float32 W×H. */
export function boxBlur(a, W, H, r) {
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let acc = 0; const row = y * W;
    for (let x = -r; x <= r; x++) acc += a[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      t[row + x] = acc / (2 * r + 1);
      acc += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += t[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      o[y * W + x] = acc / (2 * r + 1);
      acc += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x];
    }
  }
  return o;
}

// =============================================================================
// CAMPIONE CONTINUO: il pezzo di foto (es. un campione da 50 × 50 cm) si ripete sui pannelli
// grandi. Perché non si vedano i quadrati:
// 1) LUCE E COLORE UNIFORMI: ogni canale è diviso per la sua media «lenta» (sfocatura larga):
//    spariscono le zone più chiare o più scure della foto (che ripetute fanno le fasce),
//    le venature e il disegno restano come sono;
// 2) BORDI RACCORDATI: il lato destro continua nel sinistro e il basso nell'alto. Prima in
//    orizzontale, poi in verticale (spostando la foto solo in quel verso le venature dritte
//    restano dritte), con il contrasto delle venature mantenuto anche nel raccordo.
// Ritorna un canvas nuovo delle stesse misure.
// =============================================================================
export function rendiContinua(src) {
  const W = src.width, H = src.height, N = W * H;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  if (W < 32 || H < 32) return c;
  const im = g.getImageData(0, 0, W, H), d = im.data;
  const ch = [0, 1, 2].map((q) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = d[i * 4 + q]; return a; });
  // 1) luce e colore uniformi
  const r = Math.max(6, Math.round(Math.min(W, H) / 10));
  const medie = ch.map((a) => {
    let b = boxBlur(a, W, H, r); b = boxBlur(b, W, H, r); b = boxBlur(b, W, H, r);   // ≈ gaussiana larga
    let m = 0; for (let i = 0; i < N; i++) m += a[i]; m /= N;
    for (let i = 0; i < N; i++) a[i] *= Math.min(1.8, Math.max(0.55, m / Math.max(1, b[i])));
    return m;
  });
  // 2) bordi raccordati: R = O·m + S·(1 − m), S = la foto spostata di metà; varianza mantenuta
  const liscia = (t) => t * t * (3 - 2 * t);
  const raccorda = (orizz) => {
    const L = orizz ? W : H, B = Math.max(4, Math.round(L * 0.22));
    const peso = new Float32Array(L);
    for (let k = 0; k < L; k++) peso[k] = liscia(Math.min(1, Math.min(k, L - 1 - k) / B));
    ch.forEach((a, q) => {
      const mu = medie[q], o = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const j = orizz ? y * W + ((x + (W >> 1)) % W) : ((y + (H >> 1)) % H) * W + x;
        const m = peso[orizz ? x : y], n = 1 - m;
        o[i] = mu + (m * (a[i] - mu) + n * (a[j] - mu)) / Math.sqrt(m * m + n * n);
      }
      ch[q] = o;
    });
  };
  raccorda(true);
  raccorda(false);
  for (let i = 0; i < N; i++) for (let q = 0; q < 3; q++) d[i * 4 + q] = Math.max(0, Math.min(255, Math.round(ch[q][i])));
  g.putImageData(im, 0, 0);
  return c;
}

// =============================================================================
// LEGNO ALLUNGATO LUNGO LA VENATURA (anta intera senza ripetizioni in altezza)
// La foto di un campione (es. 50 × 50 cm) deve coprire un'anta alta 2,5 m. Ripeterla in
// altezza fa vedere dove il legno «ricomincia» (anche sfumando le giunte); a specchio fa
// disegni simmetrici. Qui la foto:
//  1) luce e colore uniformi (via le zone più chiare o più scure del fotografo);
//  2) venatura raddrizzata (nelle foto è spesso un filo inclinata);
//  3) continua a SINISTRA ↔ DESTRA con un TAGLIO PULITO che segue la venatura (il punto
//     dove la fine e l'inizio della foto si somigliano di più, riga per riga), senza sfumature;
//  4) in ALTEZZA non si ripete: il 3D la stira lungo la venatura finché copre l'anta intera
//     (vedi materiali.js: ALTEZZA_LEGNO) e ogni pezzo ne prende un tratto, sempre dentro la foto.
// Ritorna { canvas, fx } (fx = quanto della larghezza del campione resta dopo il taglio) o null.
// =============================================================================
export function legnoAllungato(img) {
  const W0 = img && (img.naturalWidth || img.width), H0 = img && (img.naturalHeight || img.height);
  if (!(W0 > 32) || !(H0 > 32)) return null;
  const k = Math.min(1, 1024 / W0, 1024 / H0);
  const W = Math.round(W0 * k), H = Math.round(H0 * k), N = W * H;
  const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
  const g0 = c0.getContext('2d', { willReadFrequently: true });
  g0.imageSmoothingQuality = 'high';
  let d;
  try { g0.drawImage(img, 0, 0, W, H); d = g0.getImageData(0, 0, W, H).data; } catch (_) { return null; }
  let ch = [0, 1, 2].map((q) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = d[i * 4 + q]; return a; });
  // 1) luce e colore uniformi: ogni punto diviso per la media della sua zona (sfocatura larga)
  const r = Math.max(6, Math.round(Math.min(W, H) / 10));
  ch.forEach((a) => {
    let b = boxBlur(a, W, H, r); b = boxBlur(b, W, H, r); b = boxBlur(b, W, H, r);
    let m = 0; for (let i = 0; i < N; i++) m += a[i]; m /= N;
    for (let i = 0; i < N; i++) a[i] *= Math.min(1.8, Math.max(0.55, m / Math.max(1, b[i])));
  });
  const lum = (i) => 0.3 * ch[0][i] + 0.59 * ch[1][i] + 0.11 * ch[2][i];
  // 2) venatura dritta: di quanto si spostano le righe fra la fascia alta e la bassa
  {
    const fascia = (y0, y1) => { const p = new Float32Array(W); for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) p[x] += lum(y * W + x); for (let x = 0; x < W; x++) p[x] /= (y1 - y0); return p; };
    const su = fascia(0, Math.floor(H / 4)), giu = fascia(Math.floor(3 * H / 4), H);
    const mx = Math.round(W * 0.08), x0 = Math.round(W * 0.12), x1 = Math.round(W * 0.88);
    let best = 0, eb = Infinity;
    for (let dd = -mx; dd <= mx; dd++) {
      let ms = 0, mg = 0;
      for (let x = x0; x < x1; x++) { ms += su[x]; mg += giu[x + dd]; }
      ms /= x1 - x0; mg /= x1 - x0;
      let e = 0; for (let x = x0; x < x1; x++) e += Math.abs((su[x] - ms) - (giu[x + dd] - mg));
      if (e < eb) { eb = e; best = dd; }
    }
    if (best) {
      const kk = best / (H * 0.75);
      ch = ch.map((a) => {
        const o = new Float32Array(N);
        for (let y = 0; y < H; y++) {
          const sh = kk * (y - H / 2);
          for (let x = 0; x < W; x++) {
            const sx = Math.min(W - 1, Math.max(0, x + sh)), xa = Math.floor(sx), xb = Math.min(W - 1, xa + 1), f = sx - xa;
            o[y * W + x] = a[y * W + xa] * (1 - f) + a[y * W + xb] * f;
          }
        }
        return o;
      });
    }
  }
  // 3) sinistra ↔ destra: la fine della foto (A) si sovrappone all'inizio (B) per «ov» colonne;
  //    riga per riga il taglio passa dove A e B si somigliano di più (cammino di costo minimo
  //    dall'alto in basso, si sposta al massimo di una colonna per riga: segue la venatura)
  const ov = Math.max(8, Math.round(W * 0.18)), Q = W - ov;
  const E = new Float64Array(H * ov), P = new Int32Array(H * ov);
  for (let y = 0; y < H; y++) for (let x = 0; x < ov; x++) {
    const ia = y * W + (W - ov + x), ib = y * W + x;
    let e = 0; for (let q = 0; q < 3; q++) { const t = ch[q][ia] - ch[q][ib]; e += t * t; }
    E[y * ov + x] = e;
  }
  for (let y = 1; y < H; y++) for (let x = 0; x < ov; x++) {
    let bk = x, bv = E[(y - 1) * ov + x];
    if (x > 0 && E[(y - 1) * ov + x - 1] < bv) { bv = E[(y - 1) * ov + x - 1]; bk = x - 1; }
    if (x < ov - 1 && E[(y - 1) * ov + x + 1] < bv) { bv = E[(y - 1) * ov + x + 1]; bk = x + 1; }
    E[y * ov + x] += bv; P[y * ov + x] = bk;
  }
  const taglio = new Int32Array(H);
  { let bx = 0; for (let x = 1; x < ov; x++) if (E[(H - 1) * ov + x] < E[(H - 1) * ov + bx]) bx = x; taglio[H - 1] = bx; }
  for (let y = H - 1; y > 0; y--) taglio[y - 1] = P[y * ov + taglio[y]];
  const out = document.createElement('canvas'); out.width = Q; out.height = H;
  const go = out.getContext('2d'); const im = go.createImageData(Q, H), o = im.data;
  for (let y = 0; y < H; y++) {
    const cx = taglio[y];
    for (let x = 0; x < Q; x++) {
      const j = (y * Q + x) * 4;
      for (let q = 0; q < 3; q++) {
        let v;
        if (x >= ov) v = ch[q][y * W + x];                                   // il centro della foto, com'è
        else {
          const va = ch[q][y * W + (W - ov + x)], vb = ch[q][y * W + x];
          v = x < cx ? va : vb;
          if (x === cx || x === cx - 1) v = 0.5 * (va + vb);                 // 2 px di raccordo sul taglio
        }
        o[j + q] = Math.max(0, Math.min(255, v + 0.5));
      }
      o[j + 3] = 255;
    }
  }
  go.putImageData(im, 0, 0);
  return { canvas: out, fx: Q / W };
}
