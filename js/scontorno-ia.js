// =============================================================================
// SCONTORNO CON L'IA — NG INTERIOR
// Toglie lo sfondo da QUALSIASI foto (anche ambientata: stanza, mensole, oggetti
// attorno), come i siti professionali, tutto dentro il sito e gratis:
//  - COMPUTER: modello ISNet "general use" (DIS, licenza Apache-2.0, xuebinqin/DIS), lavora a
//    1024 px, pesi salvati a 8 bit (stesso risultato dell'originale, file da 47 MB);
//  - TELEFONO / TABLET: modello U²-Net (licenza Apache-2.0, xuebinqin/U-2-Net), lavora a 320 px:
//    quasi lo stesso risultato con molta meno memoria (con ISNet l'iPhone chiudeva la pagina
//    e le foto sparivano). Pesi a 8 bit, file da 44 MB;
//  - motore onnxruntime-web 1.31.1 (licenza MIT, Microsoft): scheda grafica (WebGPU)
//    dove c'è, se no il processore (WebAssembly). Niente server, la foto resta sul telefono.
// Il modello si scarica la PRIMA volta e poi resta sul dispositivo (cache).
// =============================================================================

const VENDOR = new URL('../vendor/', import.meta.url).href;
const ORT_DIR = `${VENDOR}onnxruntime-web/1.31.1/`;
import { togliRiflesso } from './riflesso.js?v=20261126f';
const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
const TELEFONO = /iPhone|iPad|iPod|Android|Mobile/i.test(UA)
  || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/.test(UA))   // iPad "da computer"
  || (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4);
const CFG = TELEFONO
  ? { file: `${VENDOR}modelli/u2net-ng.onnx`, mb: 44, lato: 320, media: [0.485, 0.456, 0.406], dev: [0.229, 0.224, 0.225] }
  : { file: `${VENDOR}modelli/isnet-ng.onnx`, mb: 47, lato: 1024, media: [0.5, 0.5, 0.5], dev: [1, 1, 1] };
const MODELLO = CFG.file, MODELLO_MB = CFG.mb, LATO = CFG.lato, MEDIA = CFG.media, DEV = CFG.dev;
// se il calcolo ha già fatto chiudere la pagina su questo dispositivo, non lo rifaccio (si usa lo scontorno classico)
// (2 chiusure di fila = il dispositivo non ce la fa: per un mese si usa lo scontorno classico)
const IN_CORSO = 'ng-ia-in-corso', NO_IA = 'ng-ia-no', CHIUSURE = 'ng-ia-chiusure';
/** true se la pagina si è appena riaperta perché il telefono l'ha chiusa durante lo scontorno */
export let chiusaDuranteIA = false;
try {
  if (localStorage.getItem(IN_CORSO)) {
    chiusaDuranteIA = true;
    localStorage.removeItem(IN_CORSO);
    const n = (Number(localStorage.getItem(CHIUSURE)) || 0) + 1;
    localStorage.setItem(CHIUSURE, String(n));
    if (n >= 2) localStorage.setItem(NO_IA, String(Date.now()));
  }
} catch (_) { /* niente */ }
const fineCalcolo = (ok) => { try { localStorage.removeItem(IN_CORSO); if (ok) localStorage.removeItem(CHIUSURE); } catch (_) { /* niente */ } };

let _sessione = null, _caricamento = null, _ort = null, _dati = null, _soloCpu = false;

/** Scarica il modello (con avanzamento) e lo tiene nella cache del dispositivo. */
async function scaricaModello(avanza) {
  let cache = null;
  try { cache = await caches.open('ng-modelli-ia'); } catch (_) { /* senza cache: si scarica ogni volta */ }
  if (cache) {
    const vecchia = await cache.match(MODELLO);
    if (vecchia) return new Uint8Array(await vecchia.arrayBuffer());
  }
  const r = await fetch(MODELLO);
  if (!r.ok || !r.body) throw new Error(`modello non trovato (${r.status})`);
  const tot = Number(r.headers.get('content-length')) || MODELLO_MB * 1e6;
  const lettore = r.body.getReader(), pezzi = [];
  let n = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    pezzi.push(value); n += value.length;
    if (avanza) avanza({ fase: 'scarico', frazione: Math.min(1, n / tot) });
  }
  const buf = new Uint8Array(n);
  let o = 0; for (const p of pezzi) { buf.set(p, o); o += p.length; }
  if (cache) { try { await cache.put(MODELLO, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })); } catch (_) { /* spazio pieno: pazienza */ } }
  return buf;
}

async function sessione(avanza) {
  if (_sessione) return _sessione;
  if (!_caricamento) {
    _caricamento = (async () => {
      const prove = [];
      if (!_soloCpu && !TELEFONO && typeof navigator !== 'undefined' && navigator.gpu) {
        // scheda grafica VERA: quella "simulata" via software è lentissima, meglio il processore
        let vera = false;
        try { const ad = await navigator.gpu.requestAdapter(); vera = !!ad && !(ad.info && ad.info.isFallbackAdapter) && !ad.isFallbackAdapter && !/swiftshader|llvmpipe|software/i.test(`${ad.info && ad.info.vendor} ${ad.info && ad.info.architecture} ${ad.info && ad.info.description}`); } catch (_) { vera = false; }
        if (vera) prove.push(['webgpu']);
      }
      prove.push(['wasm']);
      // solo processore: il calcolo va in un lavoratore a parte (la pagina resta libera: si vede
      // l'avanzamento, si tocca lo schermo, il telefono non sembra bloccato)
      const aParte = prove.length === 1 && typeof Worker !== 'undefined';
      if (!_ort) {
        _ort = await import(`${ORT_DIR}ort.webgpu.min.mjs`);
        _ort.env.wasm.wasmPaths = ORT_DIR;
        _ort.env.wasm.numThreads = (!TELEFONO && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
        _ort.env.wasm.proxy = aParte;
      }
      const dati = _dati || (_dati = await scaricaModello(avanza));
      if (avanza) avanza({ fase: 'preparo', frazione: 1 });
      let ultimo = null;
      for (const ep of prove) {
        // telefono: memoria al minimo (niente riserve, i pesi restano a 8 bit finché servono)
        const opz = TELEFONO ? { executionProviders: ep, graphOptimizationLevel: 'disabled', enableCpuMemArena: false, enableMemPattern: false }
          : { executionProviders: ep, graphOptimizationLevel: 'all' };
        try {
          const ses = await _ort.InferenceSession.create(dati, opz);
          if (_ort.env.wasm.proxy) _dati = null;       // il modello ora sta nel lavoratore: qui non serve più
          return ses;
        } catch (e) { ultimo = e; }
      }
      throw ultimo || new Error('motore IA non disponibile');
    })();
    _caricamento.catch(() => { _caricamento = null; });     // al prossimo tentativo si riprova
  }
  _sessione = await _caricamento;
  return _sessione;
}

/** Il dispositivo può farlo? (WebAssembly c'è su tutti i telefoni e PC moderni) */
export function scontornoIaPossibile() {
  let bloccata = false;
  try { const t = Number(localStorage.getItem(NO_IA)); bloccata = t > 0 && Date.now() - t < 30 * 864e5; } catch (_) { /* niente */ }
  return !bloccata && typeof WebAssembly === 'object' && typeof fetch === 'function';
}

/**
 * SCONTORNA una foto con l'IA. Ritorna { canvas, colore, zona, w, h, angolo: 0 } come lo
 * scontorno classico (oggetto ritagliato su sfondo trasparente, lato lungo fino a 1024 px),
 * oppure null se nella foto non trova un oggetto.
 * opz.avanza({ fase: 'scarico'|'preparo'|'calcolo', frazione }) per mostrare a che punto è.
 */
export async function scontornaIA(img, opz = {}) {
  const avanza = opz.avanza || null;
  const s = await sessione(avanza);
  if (avanza) avanza({ fase: 'calcolo', frazione: 0 });
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  // 1) foto → 1024 × 1024, valori normalizzati come nell'addestramento
  const c = document.createElement('canvas'); c.width = LATO; c.height = LATO;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, LATO, LATO);
  const px = g.getImageData(0, 0, LATO, LATO).data, N = LATO * LATO;
  const x = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) for (let q = 0; q < 3; q++) x[q * N + i] = (px[i * 4 + q] / 255 - MEDIA[q]) / DEV[q];
  const ingresso = new _ort.Tensor('float32', x, [1, 3, LATO, LATO]);
  let uscite;
  try { localStorage.setItem(IN_CORSO, '1'); } catch (_) { /* niente */ }
  try {
    uscite = await s.run({ [s.inputNames[0]]: ingresso });
  } catch (e) {
    // la scheda grafica non ce la fa (limiti di WebGPU su alcuni dispositivi): rifaccio col processore
    if (_soloCpu) { fineCalcolo(false); throw e; }
    _soloCpu = true; _sessione = null; _caricamento = null;
    try {
      const s2 = await sessione(avanza);
      uscite = await s2.run({ [s2.inputNames[0]]: ingresso });
    } catch (e2) { fineCalcolo(false); throw e2; }
    return dopoIA(uscite, _sessione, img, W0, H0, avanza);
  }
  return dopoIA(uscite, s, img, W0, H0, avanza);
}

/** Dalla probabilità dell'IA all'oggetto ritagliato (vedi scontornaIA). */
function dopoIA(uscite, s, img, W0, H0, avanza) {
  fineCalcolo(true);
  const N = LATO * LATO;
  const y = uscite[s.outputNames[0]].data;
  // 2) probabilità (0..1, riportata fra minimo e massimo come nell'originale) → maschera
  let mi = Infinity, ma = -Infinity;
  for (let i = 0; i < N; i++) { if (y[i] < mi) mi = y[i]; if (y[i] > ma) ma = y[i]; }
  if (!(ma - mi > 1e-4)) return null;
  const p = new Float32Array(N);
  for (let i = 0; i < N; i++) p[i] = (y[i] - mi) / (ma - mi);
  // 3) tengo l'oggetto PRINCIPALE: il pezzo più grande, più i pezzi grandi (≥ 25% di lui) o
  //    vicini a lui (parti staccate da una fessura); via vasi, frutta, quadri lontani
  const lab = new Int32Array(N).fill(-1), aree = [];
  for (let i = 0; i < N; i++) {
    if (p[i] < 0.5 || lab[i] >= 0) continue;
    const id = aree.length; let a = 0; const pila = [i]; lab[i] = id;
    while (pila.length) {
      const j = pila.pop(); a++;
      const xx = j % LATO, yy = (j / LATO) | 0;
      for (const k of [xx > 0 ? j - 1 : -1, xx < LATO - 1 ? j + 1 : -1, yy > 0 ? j - LATO : -1, yy < LATO - 1 ? j + LATO : -1]) {
        if (k >= 0 && lab[k] < 0 && p[k] >= 0.5) { lab[k] = id; pila.push(k); }
      }
    }
    aree.push(a);
  }
  if (!aree.length) return null;
  const maxA = Math.max(...aree), principale = aree.indexOf(maxA);
  if (maxA < N * 0.002) return null;
  const box = aree.map(() => [LATO, LATO, -1, -1]);
  for (let i = 0; i < N; i++) { const l = lab[i]; if (l < 0) continue; const b = box[l], xx = i % LATO, yy = (i / LATO) | 0; if (xx < b[0]) b[0] = xx; if (yy < b[1]) b[1] = yy; if (xx > b[2]) b[2] = xx; if (yy > b[3]) b[3] = yy; }
  const P0 = box[principale], marg = LATO * 0.03;
  const vicino = (b) => b[0] <= P0[2] + marg && b[2] >= P0[0] - marg && b[1] <= P0[3] + marg && b[3] >= P0[1] - marg;
  const tieni = aree.map((a, l) => l === principale || a >= maxA * 0.25 || (a >= maxA * 0.002 && vicino(box[l])));
  // maschera morbida (bordo dell'IA) solo sui pezzi tenuti; il bordo sfumato resta vicino ai pezzi tenuti
  const alfa = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) {
    if (lab[i] >= 0) { if (tieni[lab[i]]) alfa[i] = Math.round(p[i] * 255); continue; }
    if (p[i] < 0.02) continue;
    const xx = i % LATO, yy = (i / LATO) | 0;            // pixel di bordo: tengo se accanto a un pezzo tenuto
    let vicino = false;
    for (let dy = -2; dy <= 2 && !vicino; dy++) for (let dx = -2; dx <= 2; dx++) {
      const a = xx + dx, b = yy + dy; if (a < 0 || b < 0 || a >= LATO || b >= LATO) continue;
      const l = lab[b * LATO + a]; if (l >= 0 && tieni[l]) { vicino = true; break; }
    }
    if (vicino) alfa[i] = Math.round(p[i] * 255);
  }
  // 4) riquadro dell'oggetto nella foto originale
  let x0 = LATO, y0 = LATO, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) if (alfa[i] > 127) { const xx = i % LATO, yy = (i / LATO) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < 0) return null;
  const sx = W0 / LATO, sy = H0 / LATO;
  const bx = Math.max(0, (x0 - 2) * sx), by = Math.max(0, (y0 - 2) * sy);
  const bw = Math.min(W0, (x1 + 3) * sx) - bx, bh = Math.min(H0, (y1 + 3) * sy) - by;
  const fo = Math.min(1, 1024 / Math.max(bw, bh));
  const OW = Math.max(4, Math.round(bw * fo)), OH = Math.max(4, Math.round(bh * fo));
  // 5) uscita: colori della foto + trasparenza dell'IA (ingrandita morbida)
  const mc = document.createElement('canvas'); mc.width = LATO; mc.height = LATO;
  const mg = mc.getContext('2d'); const md = mg.createImageData(LATO, LATO);
  for (let i = 0; i < N; i++) { md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = alfa[i]; }
  mg.putImageData(md, 0, 0);
  const out = document.createElement('canvas'); out.width = OW; out.height = OH;
  const og = out.getContext('2d', { willReadFrequently: true });
  og.imageSmoothingQuality = 'high';
  og.drawImage(img, bx, by, bw, bh, 0, 0, OW, OH);
  og.globalCompositeOperation = 'destination-in';
  og.drawImage(mc, bx / sx, by / sy, bw / sx, bh / sy, 0, 0, OW, OH);
  og.globalCompositeOperation = 'source-over';
  // 6) il RIFLESSO sul pavimento (foto su piano lucido) non è l'oggetto: lo tolgo
  const rf = togliRiflesso(out);
  const fin = rf.canvas, FH = fin.height;
  // 7) colore mediano dell'oggetto
  const od = fin.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, OW, FH).data, cols = [[], [], []];
  for (let i = 0; i < OW * FH; i += 3) if (od[i * 4 + 3] > 200) for (let q = 0; q < 3; q++) cols[q].push(od[i * 4 + q]);
  const med = cols.map((v) => { v.sort((a, b) => a - b); return v[v.length >> 1] || 0; });
  if (avanza) avanza({ fase: 'calcolo', frazione: 1 });
  return {
    canvas: fin, w: OW, h: FH, angolo: 0,
    zona: { x: bx, y: by, w: bw, h: bh * (FH / OH) },
    colore: (med[0] << 16) | (med[1] << 8) | med[2],
    rapporto: Math.min(OW, FH) / Math.max(OW, FH),
    ia: true,
  };
}
