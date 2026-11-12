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
    const vicino = uniti.find((u) => dist(u.c, g.c) < 70);
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
      const rg = rettangoloMassimo(mGola, P.w, P.h);
      if (rg) out.gola = su(rg.w > 6 && rg.h > 6 ? rientra(rg, 0.15) : rg);
      out.coloreGola = (Math.round(gola.c[0]) << 16) | (Math.round(gola.c[1]) << 8) | Math.round(gola.c[2]);
      out.messaggio = 'Porta e gola riconosciute.';
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
