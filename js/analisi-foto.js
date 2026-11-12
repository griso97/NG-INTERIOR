// =============================================================================
// ANALISI AUTOMATICA DELLA FOTO (catalogo prodotti)
// =============================================================================
// Dalla foto di un campione o di una porta trova da solo:
//   - l'OGGETTO (campione/porta) separato dallo sfondo;
//   - la GOLA del finger-pull: la fascia di colore diverso lungo un lato
//     (sopra, sotto, a sinistra o a destra);
//   - la zona "pulita" da usare come materiale: lontana da bordi, linee,
//     maniglie e ombre.
// Tutti i rettangoli tornano in pixel della foto originale {x, y, w, h}.
// =============================================================================

const MAX_LATO = 480;              // l'analisi lavora su una copia piccola (veloce)

function pixelPiccoli(img) {
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  const k = Math.min(1, MAX_LATO / Math.max(W0, H0));
  const w = Math.max(8, Math.round(W0 * k)), h = Math.max(8, Math.round(H0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return { d: g.getImageData(0, 0, w, h).data, w, h, k, W0, H0 };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function mediana(col) {
  const s = (i) => col.map((c) => c[i]).sort((x, y) => x - y)[Math.floor(col.length / 2)];
  return [s(0), s(1), s(2)];
}
const px = (P, x, y) => { const i = (y * P.w + x) * 4; return [P.d[i], P.d[i + 1], P.d[i + 2]]; };

/** Trova l'oggetto rispetto allo sfondo. Se la foto è tutta campione → foto intera. */
function trovaOggetto(P) {
  const { w, h } = P;
  const bordo = [];
  for (let x = 0; x < w; x += 2) { bordo.push(px(P, x, 0), px(P, x, h - 1)); }
  for (let y = 0; y < h; y += 2) { bordo.push(px(P, 0, y), px(P, w - 1, y)); }
  const bg = mediana(bordo);
  // soglia adattiva: quanto "varia" lo sfondo (rumore, luce non uniforme)
  const scarti = bordo.map((c) => dist(c, bg)).sort((a, b) => a - b);
  const rumore = scarti[Math.floor(scarti.length * 0.5)];
  const soglia = Math.max(12, Math.min(45, rumore * 4 + 8));
  // il bordo è uniforme? (sennò la foto è già tutta campione)
  const sparsi = scarti.filter((d) => d > Math.max(30, soglia * 2)).length / scarti.length;
  const centro = px(P, Math.floor(w / 2), Math.floor(h / 2));
  const intera = { x: 0, y: 0, w, h, sfondo: false, bg, soglia };
  if (sparsi > 0.35 || dist(centro, bg) < soglia) return intera;
  // proiezioni: righe/colonne con abbastanza pixel diversi dallo sfondo
  const righe = new Array(h).fill(0), colonne = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (dist(px(P, x, y), bg) > soglia) { righe[y]++; colonne[x]++; }
  }
  const primo = (a, sg) => a.findIndex((v) => v > sg);
  const ultimo = (a, sg) => a.length - 1 - [...a].reverse().findIndex((v) => v > sg);
  const y0 = primo(righe, w * 0.2), y1 = ultimo(righe, w * 0.2);
  const x0 = primo(colonne, h * 0.2), x1 = ultimo(colonne, h * 0.2);
  if (y0 < 0 || x0 < 0 || y1 - y0 < h * 0.15 || x1 - x0 < w * 0.15) return intera;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, sfondo: true, bg, soglia };
}

/** Rettangolo rientrato di una frazione per lato (via bordi, fughe, ombre). */
const rientra = (r, fx, fy = fx) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy, w: r.w * (1 - 2 * fx), h: r.h * (1 - 2 * fy) });

/** Rettangolo più grande tutto dentro la maschera (algoritmo dell'istogramma). */
function rettangoloMassimo(mask, w, h, x0 = 0, y0 = 0, x1 = w, y1 = h) {
  const alt = new Int32Array(w);
  let best = { a: 0, x: 0, y: 0, w: 0, h: 0 };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) alt[x] = mask[y * w + x] ? alt[x] + 1 : 0;
    const pila = [];
    for (let x = x0; x <= x1; x++) {
      const hx = x < x1 ? alt[x] : 0;
      let inizio = x;
      while (pila.length && pila[pila.length - 1][1] >= hx) {
        const [xi, hi] = pila.pop();
        const area = hi * (x - xi);
        // preferisco rettangoli non troppo sottili
        if (area > best.a && hi >= 2 && x - xi >= 2) best = { a: area, x: xi, y: y - hi + 1, w: x - xi, h: hi };
        inizio = xi;
      }
      pila.push([inizio, hx]);
    }
  }
  return best.a ? { x: best.x, y: best.y, w: best.w, h: best.h } : null;
}

/** Gruppi di colore (k-means) dei pixel dell'oggetto; i gruppi simili si uniscono. */
function gruppiColore(P, mask) {
  const pts = [];
  for (let i = 0, n = P.w * P.h; i < n; i += 3) if (mask[i]) pts.push([P.d[i * 4], P.d[i * 4 + 1], P.d[i * 4 + 2]]);
  if (pts.length < 30) return [];
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const ord = [...pts].sort((a, b) => lum(a) - lum(b));
  let cen = [ord[Math.floor(ord.length * 0.05)], ord[Math.floor(ord.length * 0.5)], ord[Math.floor(ord.length * 0.95)]].map((c) => [...c]);
  let ass = new Int32Array(pts.length);
  for (let it = 0; it < 12; it++) {
    const som = cen.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      let m = 0, md = Infinity;
      cen.forEach((c, j) => { const dd = dist(p, c); if (dd < md) { md = dd; m = j; } });
      ass[i] = m; som[m][0] += p[0]; som[m][1] += p[1]; som[m][2] += p[2]; som[m][3]++;
    });
    cen = cen.map((c, j) => (som[j][3] ? [som[j][0] / som[j][3], som[j][1] / som[j][3], som[j][2] / som[j][3]] : c));
  }
  let gruppi = cen.map((c, j) => ({ c, n: ass.filter((a) => a === j).length }));
  // unisco i gruppi vicini (es. venature chiare/scure dello stesso legno)
  gruppi = gruppi.filter((g) => g.n > 0).sort((a, b) => b.n - a.n);
  const uniti = [];
  for (const g of gruppi) {
    const croma = (c) => Math.max(...c) - Math.min(...c);
    const vicino = uniti.find((u) => dist(u.c, g.c) < 70 && Math.abs(croma(u.c) - croma(g.c)) < 28);
    if (vicino) {
      const n = vicino.n + g.n;
      vicino.c = vicino.c.map((v, i) => (v * vicino.n + g.c[i] * g.n) / n); vicino.n = n;
      vicino.membri.push(g.c);
    } else uniti.push({ ...g, membri: [g.c] });
  }
  return uniti.sort((a, b) => b.n - a.n);
}

/** Maschera dei pixel che appartengono a un gruppo (vicini a uno dei suoi colori). */
function mascheraGruppo(P, base, gruppo, altri) {
  const m = new Uint8Array(P.w * P.h);
  for (let i = 0, n = P.w * P.h; i < n; i++) {
    if (!base[i]) continue;
    const c = [P.d[i * 4], P.d[i * 4 + 1], P.d[i * 4 + 2]];
    const dMio = Math.min(...gruppo.membri.map((x) => dist(c, x)));
    const dAltri = Math.min(Infinity, ...altri.flatMap((g) => g.membri.map((x) => dist(c, x))));
    if (dMio < dAltri) m[i] = 1;
  }
  return m;
}

/**
 * tipo: 'base' (campione), 'fp' (porta finger-pull), 'man' (maniglia).
 * Funziona anche con foto in prospettiva: lavora per colori, non per righe.
 * Ritorna { oggetto, main?, porta?, gola?, coloreGola?, sfondo, messaggio }.
 */
export function analizzaFoto(img, tipo = 'base') {
  const P = pixelPiccoli(img);
  const su = (r) => ({ x: Math.max(0, Math.round(r.x / P.k)), y: Math.max(0, Math.round(r.y / P.k)),
    w: Math.max(1, Math.min(P.W0, Math.round(r.w / P.k))), h: Math.max(1, Math.min(P.H0, Math.round(r.h / P.k))) });
  const o = trovaOggetto(P);
  const out = { oggetto: su(o), sfondo: o.sfondo };
  if (tipo === 'man') {
    const r = o.sfondo ? rientra(o, -0.04) : o;
    out.main = su({ x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(P.w - Math.max(0, r.x), r.w), h: Math.min(P.h - Math.max(0, r.y), r.h) });
    return out;
  }
  // maschera dell'oggetto: dentro il suo riquadro e diverso dallo sfondo
  const bg = o.bg;
  const obj = new Uint8Array(P.w * P.h);
  for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) {
    obj[y * P.w + x] = !o.sfondo || dist(px(P, x, y), bg) > o.soglia ? 1 : 0;
  }
  if (tipo === 'fp') {
    const gr = gruppiColore(P, obj);
    if (!gr.length) { out.porta = su(rientra(o, 0.08)); out.messaggio = 'Non riesco a leggere la porta: correggi a mano.'; return out; }
    const corpo = gr[0];
    // gola: il gruppo più diverso dal corpo, con almeno l'1% dei pixel
    const tot = gr.reduce((t, g) => t + g.n, 0);
    const gola = gr.slice(1).filter((g) => g.n / tot > 0.01 && dist(g.c, corpo.c) > 60 && (!o.sfondo || dist(g.c, bg) > o.soglia * 2))
      .sort((a, b) => dist(b.c, corpo.c) - dist(a.c, corpo.c))[0];
    const altri = gr.filter((g) => g !== corpo);
    const mPorta = mascheraGruppo(P, obj, corpo, altri);
    const rp = rettangoloMassimo(mPorta, P.w, P.h);
    out.porta = su(rp ? rientra(rp, 0.04) : rientra(o, 0.08));
    if (gola) {
      const mGola = mascheraGruppo(P, obj, gola, gr.filter((g) => g !== gola));
      // La gola è la parte SUPERIORE della porta (anche inclinata nelle foto a
      // 45°): la cerco prima in alto, poi in basso, poi sui lati. Il bordo
      // laterale (spessore della porta) ha lo stesso colore ma non è la gola.
      const fascia = (y0, y1, x0, x1) => rettangoloMassimo(mGola, P.w, P.h,
        Math.max(0, Math.round(x0)), Math.max(0, Math.round(y0)), Math.min(P.w, Math.round(x1)), Math.min(P.h, Math.round(y1)));
      const minimo = Math.max(6, o.w * o.h * 0.002);
      const ok = (r) => r && r.w * r.h >= minimo;
      // in alto/in basso guardo solo la parte centrale: i fianchi neri (spessore) restano fuori
      const alto = fascia(o.y, o.y + o.h * 0.3, o.x + o.w * 0.15, o.x + o.w * 0.85);
      const basso = fascia(o.y + o.h * 0.7, o.y + o.h, o.x + o.w * 0.15, o.x + o.w * 0.85);
      const rg = ok(alto) ? alto : ok(basso) ? basso : rettangoloMassimo(mGola, P.w, P.h);
      out.golaLato = rg && rg.h > rg.w * 1.5 ? 'lato' : ok(alto) ? 'alto' : ok(basso) ? 'basso' : 'lato';
      if (rg) out.gola = su(rg.w > 6 && rg.h > 6 ? rientra(rg, 0.15) : rg);
      out.coloreGola = (Math.round(gola.c[0]) << 16) | (Math.round(gola.c[1]) << 8) | Math.round(gola.c[2]);
      out.messaggio = { alto: 'Porta e gola riconosciute (gola in alto).', basso: 'Porta e gola riconosciute (gola in basso).', lato: 'Porta e gola riconosciute (gola di lato).' }[out.golaLato];
    } else out.messaggio = 'Non trovo una gola di colore diverso: controlla la foto o correggi a mano.';
    return out;
  }
  // campione: il rettangolo più grande tutto dentro l'oggetto (anche in prospettiva)
  const r = o.sfondo ? rettangoloMassimo(obj, P.w, P.h) : o;
  out.main = su(rientra(r || o, 0.03));
  return out;
}

/** Misura reale (cm) di una zona, sapendo la misura reale dell'oggetto intero. */
export function cmZona(zona, oggetto, oggW, oggH) {
  return { w: Math.round((zona.w / oggetto.w) * oggW * 10) / 10, h: Math.round((zona.h / oggetto.h) * oggH * 10) / 10 };
}

// =============================================================================
// QUADRILATERI: la porta segue il suo asse (foto inclinate / in prospettiva)
// =============================================================================

/** Tiene solo la parte connessa più grande della maschera. */
function componentePrincipale(mask, w, h) {
  const lab = new Int32Array(w * h); let best = 0, bestN = 0, id = 0;
  const coda = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    id++; let n = 0, t = 0; coda[t++] = i; lab[i] = id;
    for (let q = 0; q < t; q++) {
      const p = coda[q], x = p % w, y = (p - x) / w; n++;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; coda[t++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; coda[t++] = p + 1; }
      if (y > 0 && mask[p - w] && !lab[p - w]) { lab[p - w] = id; coda[t++] = p - w; }
      if (y < h - 1 && mask[p + w] && !lab[p + w]) { lab[p + w] = id; coda[t++] = p + w; }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = lab[i] === best ? 1 : 0;
  return { m: out, n: bestN };
}

/** Erosione: toglie le linee sottili (bordi, antialias, fili d'ombra). */
function erodi(mask, w, h, volte = 2) {
  let m = mask;
  for (let k = 0; k < volte; k++) {
    const o = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      o[i] = m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w] ? 1 : 0;
    }
    m = o;
  }
  return m;
}

/** Inviluppo convesso (monotone chain) di punti [x,y]. */
function inviluppo(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Quadrilatero che approssima la maschera: inviluppo ridotto a 4 vertici. */
function quadDaMaschera(mask, w, h) {
  const pts = [];
  for (let y = 0; y < h; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) { pts.push([a, y]); pts.push([b + 1, y]); }
  }
  for (let x = 0; x < w; x++) {
    let a = -1, b = -1;
    for (let y = 0; y < h; y++) if (mask[y * w + x]) { if (a < 0) a = y; b = y; }
    if (a >= 0) { pts.push([x, a]); pts.push([x, b + 1]); }
  }
  if (pts.length < 8) return null;
  let hull = inviluppo(pts);
  const area = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  while (hull.length > 4) {
    let mi = 0, ma = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const v = area(hull[(i - 1 + hull.length) % hull.length], hull[i], hull[(i + 1) % hull.length]);
      if (v < ma) { ma = v; mi = i; }
    }
    hull.splice(mi, 1);
  }
  if (hull.length < 4) return null;
  // ordine: alto-sx, alto-dx, basso-dx, basso-sx (in senso orario sullo schermo)
  const cx = hull.reduce((t, p) => t + p[0], 0) / 4, cy = hull.reduce((t, p) => t + p[1], 0) / 4;
  hull.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const i0 = hull.reduce((bi, p, i) => (p[0] + p[1] < hull[bi][0] + hull[bi][1] ? i : bi), 0);
  return [0, 1, 2, 3].map((k) => hull[(i0 + k) % 4]);
}

/** Omografia (3×3) che porta i 4 punti src nei 4 punti dst. */
function omografia(src, dst) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // eliminazione di Gauss
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const h = B.map((b, i) => b / A[i][i]);
  return [...h, 1];
}
const applica = (H, x, y) => { const d = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d]; };

let _srcCache = null;
function pixelGrandi(img) {
  if (_srcCache && _srcCache.img === img) return _srcCache;
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  const k = Math.min(1, 2400 / Math.max(W0, H0));
  const w = Math.round(W0 * k), h = Math.round(H0 * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  _srcCache = { img, d: g.getImageData(0, 0, w, h).data, w, h, k };
  return _srcCache;
}

/**
 * RADDRIZZA: il quadrilatero (punti in pixel della foto originale, ordine
 * alto-sx, alto-dx, basso-dx, basso-sx) diventa un rettangolo dritto, come
 * visto di fronte. rientro = frazione tolta su ogni lato (bordi, fughe).
 */
export function raddrizza(img, quad, outW, outH, rientro = 0) {
  const S = pixelGrandi(img);
  const q = quad.map(([x, y]) => [x * S.k, y * S.k]);
  // dst rettangolo → src quad (per ogni pixel di uscita cerco il pixel della foto)
  const r = rientro;
  const H = omografia([[outW * -r / (1 - 2 * r), outH * -r / (1 - 2 * r)], [outW * (1 - r) / (1 - 2 * r), outH * -r / (1 - 2 * r)],
    [outW * (1 - r) / (1 - 2 * r), outH * (1 - r) / (1 - 2 * r)], [outW * -r / (1 - 2 * r), outH * (1 - r) / (1 - 2 * r)]], q);
  const c = document.createElement('canvas'); c.width = outW; c.height = outH;
  const g = c.getContext('2d'); const im = g.createImageData(outW, outH); const o = im.data;
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const [sx, sy] = applica(H, x + 0.5, y + 0.5);
    const x0 = Math.max(0, Math.min(S.w - 2, Math.floor(sx - 0.5))), y0 = Math.max(0, Math.min(S.h - 2, Math.floor(sy - 0.5)));
    const fx = Math.max(0, Math.min(1, sx - 0.5 - x0)), fy = Math.max(0, Math.min(1, sy - 0.5 - y0));
    const i00 = (y0 * S.w + x0) * 4, i10 = i00 + 4, i01 = i00 + S.w * 4, i11 = i01 + 4, j = (y * outW + x) * 4;
    for (let k = 0; k < 3; k++) {
      o[j + k] = (S.d[i00 + k] * (1 - fx) + S.d[i10 + k] * fx) * (1 - fy) + (S.d[i01 + k] * (1 - fx) + S.d[i11 + k] * fx) * fy;
    }
    o[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** Colore medio di un canvas. */
export function coloreMedio(c) {
  const p = document.createElement('canvas'); p.width = p.height = 16;
  p.getContext('2d').drawImage(c, 0, 0, 16, 16);
  const d = p.getContext('2d').getImageData(0, 0, 16, 16).data;
  let R = 0, G = 0, B = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
  const n = d.length / 4;
  return (Math.round(R / n) << 16) | (Math.round(G / n) << 8) | Math.round(B / n);
}

/**
 * ANALISI CON QUADRILATERI (porta finger-pull o campione, anche inclinati).
 * Ritorna { porta|main: [4 punti], gola?: [4 punti], coloreGola?, lato, messaggio }
 * con i punti in pixel della foto originale.
 */
export function analizzaQuad(img, tipo = 'fp') {
  const P = pixelPiccoli(img);
  const su = (q) => q.map(([x, y]) => [x / P.k, y / P.k]);
  const o = trovaOggetto(P);
  const bg = o.bg;
  // oggetto in TUTTA la foto (non solo nel riquadro: gli angoli di una porta
  // ruotata restano dentro), poi solo la parte connessa più grande
  const obj = new Uint8Array(P.w * P.h);
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    obj[y * P.w + x] = !o.sfondo || dist(px(P, x, y), bg) > o.soglia ? 1 : 0;
  }
  const intera = [[0, 0], [P.w, 0], [P.w, P.h], [0, P.h]];
  if (tipo !== 'fp') {
    const qm = o.sfondo ? quadDaMaschera(componentePrincipale(erodi(obj, P.w, P.h, 2), P.w, P.h).m, P.w, P.h) : null;
    return { main: su(qm || intera), messaggio: qm ? 'Campione trovato e raddrizzato.' : 'Campione trovato.' };
  }
  const gr = gruppiColore(P, obj);
  if (!gr.length) return { porta: su(intera), messaggio: 'Non riesco a leggere la porta: correggi a mano.' };
  const corpo = gr[0];
  const tot = gr.reduce((t, g) => t + g.n, 0);
  const gola = gr.slice(1).filter((g) => g.n / tot > 0.01 && dist(g.c, corpo.c) > 60 && (!o.sfondo || dist(g.c, bg) > o.soglia * 2))
    .sort((a, b) => dist(b.c, corpo.c) - dist(a.c, corpo.c))[0];
  const mPorta = componentePrincipale(erodi(mascheraGruppo(P, obj, corpo, gr.filter((g) => g !== corpo)), P.w, P.h, 2), P.w, P.h).m;
  const qp = quadDaMaschera(mPorta, P.w, P.h);
  if (!qp) return { porta: su(intera), messaggio: 'Non riesco a leggere la porta: correggi a mano.' };
  const out = { porta: su(qp) };
  // colore della porta (media dei pixel della porta)
  let pr = 0, pg = 0, pb = 0, pn = 0;
  for (let i = 0; i < P.w * P.h; i += 2) if (mPorta[i]) { pr += P.d[i * 4]; pg += P.d[i * 4 + 1]; pb += P.d[i * 4 + 2]; pn++; }
  const colPorta = pn ? [pr / pn, pg / pn, pb / pn] : corpo.c;
  // GOLA: pixel del gruppo "gola"; se non c'è un gruppo diverso (es. porta verde
  // con gola verde più scura) uso i pixel dell'oggetto di tono diverso dalla porta
  let mGola;
  if (gola) mGola = mascheraGruppo(P, obj, gola, gr.filter((g) => g !== gola));
  else {
    mGola = new Uint8Array(P.w * P.h);
    for (let i = 0; i < P.w * P.h; i++) {
      if (!obj[i] || mPorta[i]) continue;
      const c = [P.d[i * 4], P.d[i * 4 + 1], P.d[i * 4 + 2]];
      if (dist(c, colPorta) > 18 && (!o.sfondo || dist(c, bg) > o.soglia)) mGola[i] = 1;
    }
  }
  // per ogni lato del quadrilatero: quanto è spessa la fascia di "gola" appena fuori
  const cx = qp.reduce((t, p) => t + p[0], 0) / 4, cy = qp.reduce((t, p) => t + p[1], 0) / 4;
  const lati = [];
  for (let e = 0; e < 4; e++) {
    const a = qp[e], b = qp[(e + 1) % 4];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }     // verso l'esterno
    const spessori = [];
    for (let s = 1; s <= 11; s++) {
      const t = 0.15 + 0.7 * (s - 1) / 10;
      const sx = a[0] + (b[0] - a[0]) * t, sy = a[1] + (b[1] - a[1]) * t;
      let n = 0, buchi = 0;
      for (let d = 1; d < Math.max(P.w, P.h) * 0.25; d++) {
        const x = Math.round(sx + nx * d), y = Math.round(sy + ny * d);
        if (x < 0 || y < 0 || x >= P.w || y >= P.h) break;
        if (mGola[y * P.w + x]) { n = d; buchi = 0; } else if (++buchi > 3) break;
      }
      spessori.push(n);
    }
    const pieni = spessori.filter((v) => v >= 2);
    const sp = pieni.length ? pieni.sort((x, y) => x - y)[Math.floor(pieni.length / 2)] : 0;
    lati.push({ e, a, b, nx, ny, sp, frazione: pieni.length / spessori.length, alto: (a[1] + b[1]) / 2 });
  }
  const validi = lati.filter((l) => l.frazione >= 0.5 && l.sp >= 2);
  // preferisco il lato in ALTO (la gola sta sopra), se ha la fascia
  const perAltezza = [...lati].sort((x, y) => x.alto - y.alto);
  const lAlto = perAltezza[0], lBasso = perAltezza[3];
  const scelto = validi.includes(lAlto) ? lAlto : validi.sort((x, y) => y.frazione * y.sp - x.frazione * x.sp)[0];
  // colore della gola: dal gruppo, oppure (gola dello stesso tono) dai suoi pixel
  const hex = (c) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
  if (gola) out.coloreGola = hex(gola.c);
  else {
    let r = 0, g2 = 0, b2 = 0, n = 0;
    for (let i = 0; i < P.w * P.h; i++) if (mGola[i]) { r += P.d[i * 4]; g2 += P.d[i * 4 + 1]; b2 += P.d[i * 4 + 2]; n++; }
    out.coloreGola = hex(n > 20 ? [r / n, g2 / n, b2 / n] : colPorta.map((v) => v * 0.7));   // niente gola visibile: tono più scuro della porta
  }
  if (scelto) {
    const { nx, ny, sp } = scelto;
    // fascia gola: dentro la fascia (no bordi) e lontano dagli angoli
    const a = [scelto.a[0] + (scelto.b[0] - scelto.a[0]) * 0.08, scelto.a[1] + (scelto.b[1] - scelto.a[1]) * 0.08];
    const b = [scelto.a[0] + (scelto.b[0] - scelto.a[0]) * 0.92, scelto.a[1] + (scelto.b[1] - scelto.a[1]) * 0.92];
    const d0 = sp * 0.25 + 1, d1 = sp * 0.8;
    out.gola = su([[a[0] + nx * d1, a[1] + ny * d1], [b[0] + nx * d1, b[1] + ny * d1], [b[0] + nx * d0, b[1] + ny * d0], [a[0] + nx * d0, a[1] + ny * d0]]);
    out.lato = scelto === lAlto ? 'alto' : scelto === lBasso ? 'basso' : 'lato';
    out.messaggio = { alto: 'Porta e gola riconosciute (gola in alto).', basso: 'Porta e gola riconosciute (gola in basso).', lato: 'Porta e gola riconosciute (gola di lato).' }[out.lato];
  } else out.messaggio = 'Porta riconosciuta; la gola la prendo dal suo colore.';
  return out;
}

// =============================================================================
// ANALISI SULLA PORTA RADDRIZZATA (metodo principale)
// 1) tolgo lo sfondo e trovo i 4 angoli dell'oggetto (porta + gola + spessori)
// 2) lo raddrizzo: vista di fronte, righe orizzontali
// 3) sulla porta dritta cerco le FASCE di colore diverso vicino ai bordi:
//    in alto (o in basso / di lato) è la gola — anche se è un po' dentro la
//    porta (es. Canto Creativo); ai lati sono gli spessori, da togliere
// 4) il materiale è il resto, preso pixel per pixel dalla foto
// =============================================================================

/** Mappa (u,v) del quadrilatero (0..1) → pixel della foto. */
function daUnita(quad) {
  const H = omografia([[0, 0], [1, 0], [1, 1], [0, 1]], quad);
  return (u, v) => applica(H, u, v);
}

export function analizzaPorta(img, tipo = 'fp') {
  const P = pixelPiccoli(img);
  const o = trovaOggetto(P);
  const obj = new Uint8Array(P.w * P.h);
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    obj[y * P.w + x] = !o.sfondo || dist(px(P, x, y), o.bg) > o.soglia ? 1 : 0;
  }
  const intera = [[0, 0], [P.w, 0], [P.w, P.h], [0, P.h]];
  const qs = o.sfondo ? quadDaMaschera(componentePrincipale(erodi(obj, P.w, P.h, 2), P.w, P.h).m, P.w, P.h) : null;
  const quad = (qs || intera).map(([x, y]) => [x / P.k, y / P.k]);           // pixel originali
  const L = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const largh = (L(quad[0], quad[1]) + L(quad[3], quad[2])) / 2, alt = (L(quad[0], quad[3]) + L(quad[1], quad[2])) / 2;
  const W = 300, H = Math.max(60, Math.min(900, Math.round(300 * alt / Math.max(1, largh))));
  const R = raddrizza(img, quad, W, H, 0);
  const d = R.getContext('2d').getImageData(0, 0, W, H).data;
  const pr = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  // colore della porta: centro della porta raddrizzata
  const centro = [];
  for (let y = Math.round(H * 0.3); y < H * 0.7; y += 3) for (let x = Math.round(W * 0.25); x < W * 0.75; x += 3) centro.push(pr(x, y));
  const colPorta = mediana(centro);
  // media di una riga / colonna (sulla parte centrale) e quanto si stacca dalla porta
  const riga = (y) => { let r = 0, g = 0, b = 0, n = 0; for (let x = Math.round(W * 0.15); x < W * 0.85; x++) { const c = pr(x, y); r += c[0]; g += c[1]; b += c[2]; n++; } return dist([r / n, g / n, b / n], colPorta); };
  const col = (x) => { let r = 0, g = 0, b = 0, n = 0; for (let y = Math.round(H * 0.15); y < H * 0.85; y++) { const c = pr(x, y); r += c[0]; g += c[1]; b += c[2]; n++; } return dist([r / n, g / n, b / n], colPorta); };
  const dr = [...Array(H)].map((_, y) => riga(y)), dc = [...Array(W)].map((_, x) => col(x));
  // soglia: quanto variano righe/colonne nel corpo della porta (venature) + margine
  const varia = (arr, a, b) => { const v = arr.slice(Math.round(a), Math.round(b)).sort((p, q) => p - q); return v[Math.floor(v.length * 0.95)] || 0; };
  const T = Math.max(14, Math.max(varia(dr, H * 0.3, H * 0.7), varia(dc, W * 0.3, W * 0.7)) * 1.4 + 6);
  // fascia "diversa" più marcata entro il 25% dal bordo (anche staccata dal bordo)
  const fascia = (arr, n, dalFondo) => {
    const max = Math.round(n * 0.25);
    let best = null, ini = -1, somma = 0;
    for (let i = 0; i <= max; i++) {
      const v = i < max ? arr[dalFondo ? n - 1 - i : i] : 0;
      if (v > T) { if (ini < 0) { ini = i; somma = 0; } somma += v; }
      else if (ini >= 0) { const f = { da: ini, a: i - 1, forza: somma }; if (!best || f.forza > best.forza) best = f; ini = -1; }
    }
    return best && best.a - best.da + 1 >= Math.max(2, n * 0.012) ? best : null;
  };
  const fAlto = fascia(dr, H, false), fBasso = fascia(dr, H, true), fSx = fascia(dc, W, false), fDx = fascia(dc, W, true);
  // la gola: prima in alto, poi in basso, poi di lato
  const gola = fAlto ? { lato: 'alto', f: fAlto } : fBasso ? { lato: 'basso', f: fBasso } : (fSx || fDx) ? { lato: 'lato', f: (fSx && (!fDx || fSx.forza >= fDx.forza)) ? fSx : fDx, sx: fSx && (!fDx || fSx.forza >= fDx.forza) } : null;
  // zona della porta: tolgo le fasce (gola e spessori) + un piccolo margine
  let y0 = 0, y1 = H, x0 = 0, x1 = W;
  if (fAlto) y0 = fAlto.a + 1; if (fBasso) y1 = H - 1 - fBasso.a;
  if (fSx) x0 = fSx.a + 1; if (fDx) x1 = W - 1 - fDx.a;
  const m = 0.035;
  const uv = (x, y) => [x / W, y / H];
  const zona = (ax, ay, bx, by) => { const f = daUnita(quad); return [f(...uv(ax, ay)), f(...uv(bx, ay)), f(...uv(bx, by)), f(...uv(ax, by))]; };
  const pw = x1 - x0, ph = y1 - y0;
  const out = { oggetto: quad, porta: zona(x0 + pw * m, y0 + ph * m, x1 - pw * m, y1 - ph * m),
    portaFrazione: { w: (pw * (1 - 2 * m)) / W, h: (ph * (1 - 2 * m)) / H } };
  if (tipo !== 'fp') { out.main = out.porta; delete out.porta; out.messaggio = qs ? 'Campione trovato e raddrizzato.' : 'Campione trovato.'; return out; }
  // colore della gola: solo i pixel della fascia davvero diversi dalla porta
  const media = (ax, ay, bx, by) => {
    const pts = [];
    for (let y = Math.max(0, Math.round(ay) - 2); y < Math.min(H, by + 2); y++) for (let x = Math.round(ax); x < bx; x++) {
      const c = pr(x, y); if (dist(c, colPorta) > T) pts.push(c);
    }
    const c = pts.length ? mediana(pts) : colPorta.map((v) => v * 0.7);
    media.pulita = pts.length / Math.max(1, (Math.min(H, by + 2) - Math.max(0, Math.round(ay) - 2)) * (bx - Math.round(ax)));
    return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
  };
  if (gola) {
    const { f } = gola, sp = f.a - f.da + 1;
    let g;
    if (gola.lato === 'alto') g = [W * 0.08, f.da + sp * 0.2, W * 0.92, f.a + 1 - sp * 0.2];
    else if (gola.lato === 'basso') g = [W * 0.08, H - 1 - f.a + sp * 0.2, W * 0.92, H - f.da - sp * 0.2];
    else if (gola.sx) g = [f.da + sp * 0.2, H * 0.08, f.a + 1 - sp * 0.2, H * 0.92];
    else g = [W - 1 - f.a + sp * 0.2, H * 0.08, W - f.da - sp * 0.2, H * 0.92];
    out.coloreGola = media(...g);
    // la foto della gola solo se la fascia è "pulita"; se è sottile/mista basta il colore
    if (media.pulita >= 0.85) out.gola = zona(...g);
    out.golaZona = zona(...g);                               // per il disegno di controllo
    out.lato = gola.lato;
    out.messaggio = { alto: 'Porta e gola riconosciute (gola in alto).', basso: 'Porta e gola riconosciute (gola in basso).', lato: 'Porta e gola riconosciute (gola di lato).' }[gola.lato];
  } else {
    const c = colPorta.map((v) => v * 0.7);
    out.coloreGola = (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
    out.messaggio = 'Porta riconosciuta; non vedo una gola di colore diverso (uso un tono più scuro della porta).';
  }
  return out;
}
