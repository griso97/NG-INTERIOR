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
