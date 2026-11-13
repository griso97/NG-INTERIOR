// =============================================================================
// RICONOSCIMENTO DELLA MANIGLIA IN UNA FOTO (in automatico, per ogni cliente)
// =============================================================================
// 1) modello dello SFONDO dal bordo della foto (anche con luce non uniforme:
//    piano inclinato di colore) + colori di sfondo più frequenti;
// 2) soglia automatica (Otsu) sulla differenza dallo sfondo;
// 3) affinamento a due modelli di colore (maniglia / sfondo) tipo "GrabCut";
// 4) pulizia (apertura/chiusura), tengo il pezzo principale, chiudo i buchini;
// 5) RADDRIZZO (asse principale orizzontale/verticale) e ritaglio con la
//    trasparenza (PNG), alla risoluzione della foto.
// =============================================================================

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** k-means semplice su colori RGB. */
function kmeans(pts, k, iter = 8) {
  if (!pts.length) return [];
  const c = [];
  for (let i = 0; i < k; i++) c.push(pts[Math.floor((i + 0.5) * pts.length / k)].slice());
  for (let it = 0; it < iter; it++) {
    const s = c.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < k; i++) { const d = dist2(p, c[i]); if (d < bd) { bd = d; bi = i; } }
      const t = s[bi]; t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3]++;
    }
    for (let i = 0; i < k; i++) if (s[i][3]) c[i] = [s[i][0] / s[i][3], s[i][1] / s[i][3], s[i][2] / s[i][3]];
  }
  return c;
}

/** Soglia di Otsu su valori 0..255. */
function otsu(vals) {
  const h = new Float64Array(256); for (const v of vals) h[Math.min(255, Math.max(0, v | 0))]++;
  const n = vals.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, best = 0, t = 30;
  for (let i = 0; i < 256; i++) {
    wB += h[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; t = i; }
  }
  return t;
}

/** Erosione/dilatazione con quadrato (r). */
function morf(m, w, h, r, dilata) {
  const o = new Uint8Array(w * h), tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = dilata ? 0 : 1;
    for (let d = -r; d <= r; d++) { const xx = x + d; const q = xx < 0 || xx >= w ? 0 : m[y * w + xx]; if (dilata ? q : !q) { v = dilata ? 1 : 0; break; } }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = dilata ? 0 : 1;
    for (let d = -r; d <= r; d++) { const yy = y + d; const q = yy < 0 || yy >= h ? 0 : tmp[yy * w + x]; if (dilata ? q : !q) { v = dilata ? 1 : 0; break; } }
    o[y * w + x] = v;
  }
  return o;
}

/** Componenti connesse (4-vicini): etichette + aree. */
function componenti(m, w, h) {
  const lab = new Int32Array(w * h).fill(-1), aree = [], box = [];
  const st = new Int32Array(w * h);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    let sp = 0; st[sp++] = i; lab[i] = n; let a = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (sp) {
      const j = st[--sp]; a++; const x = j % w, y = (j / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const q of nb) if (q >= 0 && m[q] && lab[q] < 0) { lab[q] = n; st[sp++] = q; }
    }
    aree.push(a); box.push({ x0, y0, x1, y1 }); n++;
  }
  return { lab, aree, box };
}

/**
 * Isola la maniglia. img: Image/canvas; zona (facoltativa): {x,y,w,h} in pixel
 * della foto dove cercarla (es. corretta a mano). tol: 0.5..2 (più alto = toglie
 * più sfondo). Ritorna { canvas (PNG trasparente, raddrizzato), maschera,
 * w, h, angolo, zona (riquadro trovato nella foto), colore, rapporto } o null.
 */
export function segmentaManiglia(img, zona = null, tol = 1) {
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  // regione di lavoro: la zona (allargata) o tutta la foto
  let R = zona ? { x: zona.x - zona.w * 0.08, y: zona.y - zona.h * 0.08, w: zona.w * 1.16, h: zona.h * 1.16 } : { x: 0, y: 0, w: W0, h: H0 };
  R = { x: Math.max(0, R.x), y: Math.max(0, R.y) }; R.w = Math.min(W0 - R.x, zona ? zona.w * 1.16 : W0); R.h = Math.min(H0 - R.y, zona ? zona.h * 1.16 : H0);
  const k = Math.min(1, 420 / Math.max(R.w, R.h));
  const w = Math.max(8, Math.round(R.w * k)), h = Math.max(8, Math.round(R.h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, R.x, R.y, R.w, R.h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];

  // 1) sfondo: piano di colore (a + b·x + c·y) dal bordo + cluster del bordo
  const bordo = [], bxy = [];
  const passo = Math.max(1, Math.round(Math.min(w, h) / 120));
  for (let x = 0; x < w; x += passo) for (const y of [0, 1, h - 2, h - 1]) { bordo.push(px(y * w + x)); bxy.push([x / w, y / h]); }
  for (let y = 0; y < h; y += passo) for (const x of [0, 1, w - 2, w - 1]) { bordo.push(px(y * w + x)); bxy.push([x / w, y / h]); }
  // minimi quadrati 3×3 per canale (scarto i punti molto lontani dalla mediana: oggetti sul bordo)
  const med = [0, 1, 2].map((q) => { const s = bordo.map((p) => p[q]).sort((a, b) => a - b); return s[s.length >> 1]; });
  const okB = bordo.map((p) => dist2(p, med) < 70 * 70);
  const piano = [0, 1, 2].map((q) => {
    let A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    bordo.forEach((p, i) => { if (!okB[i]) return; const v = [1, bxy[i][0], bxy[i][1]]; for (let r = 0; r < 3; r++) { B[r] += v[r] * p[q]; for (let s = 0; s < 3; s++) A[r][s] += v[r] * v[s]; } });
    // Cramer
    const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A); if (Math.abs(D) < 1e-6) return [med[q], 0, 0];
    return [0, 1, 2].map((col) => det(A.map((row, r) => row.map((v, s) => (s === col ? B[r] : v)))) / D);
  });
  const sfondoIn = (x, y) => piano.map((P) => P[0] + P[1] * x / w + P[2] * y / h);
  const cB = kmeans(bordo.filter((_, i) => okB[i]), 3);

  // 2) differenza dallo sfondo + soglia automatica
  const diff = new Float32Array(w * h), vals = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = px(i);
    let dd = Math.sqrt(dist2(p, sfondoIn(x, y)));
    for (const q of cB) dd = Math.min(dd, Math.sqrt(dist2(p, q)) * 1.1);
    diff[i] = dd; vals.push(Math.min(255, dd));
  }
  const t = Math.max(16, Math.min(90, otsu(vals) * 0.8)) * tol;
  let m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = diff[i] > t ? 1 : 0;

  // 3) affinamento a due modelli di colore (maniglia sicura / sfondo sicuro)
  const fgP = [], bgP = [];
  for (let i = 0; i < w * h; i += 2) { if (diff[i] > t * 1.8) fgP.push(px(i)); else if (diff[i] < t * 0.5) bgP.push(px(i)); }
  if (fgP.length > 30 && bgP.length > 30) {
    const cF = kmeans(fgP, 4), cG = kmeans(bgP, 4);
    for (let i = 0; i < w * h; i++) {
      if (diff[i] > t * 1.8 || diff[i] < t * 0.5) continue;           // sicuri: restano
      const p = px(i);
      const dF = Math.min(...cF.map((q) => dist2(p, q))), dG = Math.min(...cG.map((q) => dist2(p, q)));
      m[i] = dF < dG ? 1 : 0;
    }
  }
  // 4) pulizia
  const r = Math.max(1, Math.round(Math.min(w, h) / 220));
  m = morf(morf(m, w, h, r, false), w, h, r, true);           // apertura (puntini)
  m = morf(morf(m, w, h, r + 1, true), w, h, r + 1, false);   // chiusura (crepe)
  const cc = componenti(m, w, h);
  if (!cc.aree.length) return null;
  // pezzo principale (+ pezzi grandi vicini, es. piedini staccati)
  const imax = cc.aree.indexOf(Math.max(...cc.aree)), B0 = cc.box[imax];
  const tieni = new Set([imax]);
  cc.aree.forEach((a, i) => {
    if (i === imax || a < cc.aree[imax] * 0.12) return;
    const b = cc.box[i], gap = Math.max(b.x0 - B0.x1, B0.x0 - b.x1, b.y0 - B0.y1, B0.y0 - b.y1);
    if (gap >= Math.max(w, h) * 0.06) return;
    // un pezzo grande ACCANTO (non in fila sulla stessa barra) è un'altra maniglia: non la prendo
    if (a > cc.aree[imax] * 0.4) {
      const orizz = (B0.x1 - B0.x0) >= (B0.y1 - B0.y0);
      const [p0, p1, q0, q1] = orizz ? [B0.y0, B0.y1, b.y0, b.y1] : [B0.x0, B0.x1, b.x0, b.x1];
      const sov = Math.max(0, Math.min(p1, q1) - Math.max(p0, q0)) / Math.max(1, Math.min(p1 - p0, q1 - q0));
      if (sov < 0.6) return;
    }
    tieni.add(i);
  });
  for (let i = 0; i < w * h; i++) m[i] = cc.lab[i] >= 0 && tieni.has(cc.lab[i]) ? 1 : 0;
  // buchini chiusi (riflessi interni), non i vuoti veri (tra barra e piedini)
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = m[i] ? 0 : 1;
  const ci = componenti(inv, w, h);
  let areaOgg = 0; for (let i = 0; i < w * h; i++) areaOgg += m[i];
  ci.aree.forEach((a, i) => {
    const b = ci.box[i]; if (b.x0 === 0 || b.y0 === 0 || b.x1 === w - 1 || b.y1 === h - 1) return;
    if (a < areaOgg * 0.03) for (let j = 0; j < w * h; j++) if (ci.lab[j] === i) m[j] = 1;
  });
  // se ha preso quasi tutto il riquadro, lo sfondo non si distingue: niente da fare
  areaOgg = 0; for (let i = 0; i < w * h; i++) areaOgg += m[i];
  if (areaOgg < 12 || areaOgg > w * h * 0.92) return null;

  // 5) asse principale (PCA) → raddrizzo all'asse più vicino
  let sx = 0, sy = 0; for (let i = 0; i < w * h; i++) if (m[i]) { sx += i % w; sy += (i / w) | 0; }
  const mx = sx / areaOgg, my = sy / areaOgg; let cxx = 0, cyy = 0, cxy = 0;
  for (let i = 0; i < w * h; i++) if (m[i]) { const x = i % w - mx, y = ((i / w) | 0) - my; cxx += x * x; cyy += y * y; cxy += x * y; }
  let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);                         // asse principale
  while (ang > Math.PI / 4) ang -= Math.PI / 2; while (ang < -Math.PI / 4) ang += Math.PI / 2;
  if (Math.abs(ang) < 0.012) ang = 0;
  const cs = Math.cos(-ang), sn = Math.sin(-ang);
  // estensione nel sistema raddrizzato
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < w * h; i++) if (m[i]) {
    const x = i % w - mx, y = ((i / w) | 0) - my, u = x * cs - y * sn, v = x * sn + y * cs;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  u0 -= 1.5; u1 += 1.5; v0 -= 1.5; v1 += 1.5;
  // uscita alla risoluzione della foto (lato lungo max 1024)
  const fo = Math.min(1 / k, 1024 / Math.max(u1 - u0, v1 - v0));       // px uscita per px di lavoro
  const OW = Math.max(4, Math.round((u1 - u0) * fo)), OH = Math.max(4, Math.round((v1 - v0) * fo));
  const out = document.createElement('canvas'); out.width = OW; out.height = OH;
  const og = out.getContext('2d');
  // colore: la foto ruotata (trasformazione inversa)
  og.save();
  og.scale(fo, fo); og.translate(-u0, -v0);
  og.rotate(-ang); og.translate(-mx, -my);
  og.drawImage(img, R.x, R.y, R.w, R.h, 0, 0, w, h);
  og.restore();
  // trasparenza: maschera ruotata e ammorbidita
  const mc = document.createElement('canvas'); mc.width = w; mc.height = h;
  const mg = mc.getContext('2d'); const md = mg.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = m[i] ? 255 : 0; }
  mg.putImageData(md, 0, 0);
  const al = document.createElement('canvas'); al.width = OW; al.height = OH;
  const ag = al.getContext('2d'); ag.imageSmoothingEnabled = true;
  ag.save(); ag.scale(fo, fo); ag.translate(-u0, -v0); ag.rotate(-ang); ag.translate(-mx, -my);
  ag.drawImage(mc, 0, 0); ag.restore();
  og.globalCompositeOperation = 'destination-in'; og.drawImage(al, 0, 0); og.globalCompositeOperation = 'source-over';
  // colore mediano della maniglia
  const cols = []; for (let i = 0; i < w * h; i += 3) if (m[i]) cols.push(px(i));
  const mc3 = [0, 1, 2].map((q) => { const s = cols.map((p) => p[q]).sort((a, b) => a - b); return Math.round(s[s.length >> 1] || 0); });
  // riquadro nella foto (per "Correggi a mano")
  let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
  for (let i = 0; i < w * h; i++) if (m[i]) { const x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  return {
    canvas: out, w: OW, h: OH, angolo: ang,
    zona: { x: R.x + bx0 / k, y: R.y + by0 / k, w: (bx1 - bx0 + 1) / k, h: (by1 - by0 + 1) / k },
    colore: (mc3[0] << 16) | (mc3[1] << 8) | mc3[2],
    rapporto: Math.min(OW, OH) / Math.max(OW, OH),
  };
}

/** Canvas → Blob PNG. */
export function canvasPng(c) { return new Promise((ok) => c.toBlob(ok, 'image/png')); }
