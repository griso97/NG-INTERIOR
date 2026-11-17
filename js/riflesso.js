// =============================================================================
// RIFLESSO SUL PAVIMENTO — NG INTERIOR
// Nelle foto prodotto su un piano lucido sotto l'oggetto c'è il suo RIFLESSO: lo
// specchio dell'oggetto, capovolto, sbiadito e più chiaro. Lo scontorno a volte lo
// prende come parte dell'oggetto (l'oggetto viene più alto e il 3D sbagliato).
// Qui lo riconosco (somiglia, capovolto, a quello che sta sopra la linea d'appoggio;
// ha molto meno contrasto; è più chiaro) e lo tolgo. Se non c'è, non tocco niente.
// =============================================================================

/**
 * Toglie il riflesso sotto l'oggetto da un ritaglio (canvas con trasparenza).
 * Ritorna { canvas, tolto: frazione dell'altezza tolta } (lo stesso canvas se non c'è riflesso).
 */
export function togliRiflesso(cv) {
  const W0 = cv.width, H0 = cv.height;
  if (W0 < 8 || H0 < 8) return { canvas: cv, tolto: 0 };
  // analisi su una copia piccola
  const k = Math.min(1, 160 / W0, 400 / H0);
  const w = Math.max(4, Math.round(W0 * k)), h = Math.max(4, Math.round(H0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const A = new Uint8Array(w * h), L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { A[i] = d[i * 4 + 3] > 128 ? 1 : 0; L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; }
  let y0 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) n += A[y * w + x]; if (n) { if (y0 < 0) y0 = y; y1 = y; } }
  if (y0 < 0) return { canvas: cv, tolto: 0 };
  const H = y1 - y0 + 1;
  // luminosità media e contrasto di ogni riga (solo i pixel dell'oggetto)
  const media = new Float32Array(h), dev = new Float32Array(h);
  for (let y = y0; y <= y1; y++) {
    let n = 0, s = 0, s2 = 0;
    for (let x = 0; x < w; x++) { const i = y * w + x; if (A[i]) { n++; s += L[i]; s2 += L[i] * L[i]; } }
    if (n) { media[y] = s / n; dev[y] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)); }
  }
  // 1) c'è un riflesso? Cerco la riga yc dove sotto c'è lo specchio di sopra
  let best = null;
  for (let yc = Math.round(y0 + 0.5 * H); yc < y1 - 0.03 * H; yc++) {
    const hb = Math.min(y1 - yc, Math.round(0.3 * H), yc - y0);
    if (hb < 0.03 * H) continue;
    let n = 0, sp = 0, sq = 0, spp = 0, sqq = 0, spq = 0;
    for (let j = 1; j <= hb; j++) {
      const ra = (yc - j) * w, rb = (yc + j) * w;
      for (let x = 0; x < w; x++) {
        if (!A[ra + x] || !A[rb + x]) continue;
        const p = L[ra + x], q = L[rb + x];
        n++; sp += p; sq += q; spp += p * p; sqq += q * q; spq += p * q;
      }
    }
    if (n < 50) continue;
    const mp = sp / n, mq = sq / n, vp = spp / n - mp * mp, vq = sqq / n - mq * mq;
    if (vp < 1 || vq < 0.25) continue;
    const ncc = (spq / n - mp * mq) / Math.sqrt(vp * vq);
    const sbiadito = Math.sqrt(vq / vp), chiaro = mq - mp, taglio = (y1 - yc) / H;
    // il riflesso: somiglia BENE capovolto (non basta poco: una base cromata sotto un corpo nero somiglia un po'),
    // ha meno della metà del contrasto, è più chiaro, sta in fondo
    if (ncc > 0.5 && sbiadito < 0.4 && chiaro > 12 && taglio < 0.3 && (!best || ncc > best.ncc)) best = { yc, ncc };
  }
  if (!best) return { canvas: cv, tolto: 0 };
  // 2) la LINEA D'APPOGGIO: salendo da yc, la prima riga che non è più "riflesso" (più scura o con contrasto da oggetto)
  let rif = 0, nr = 0; for (let y = best.yc; y <= y1; y++) { rif += media[y]; nr++; } rif /= Math.max(1, nr);
  const devOgg = [...dev.slice(y0, Math.round(y0 + 0.6 * H))].sort((a, b) => a - b);
  const contrOgg = devOgg[devOgg.length >> 1] || 0;
  let y = best.yc;
  while (y > y0 + 0.5 * H && media[y] >= rif - 25 && dev[y] <= 0.45 * contrOgg) y--;
  const taglia = Math.min(H0, Math.ceil((y + 1) / k));
  if (taglia >= H0 - 1) return { canvas: cv, tolto: 0 };
  // 3) tolgo tutto sotto la linea d'appoggio e ritaglio
  const out = document.createElement('canvas'); out.width = W0; out.height = taglia;
  out.getContext('2d').drawImage(cv, 0, 0, W0, taglia, 0, 0, W0, taglia);
  return { canvas: out, tolto: 1 - taglia / H0 };
}
