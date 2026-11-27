// =============================================================================
// GEOMETRIA DELLA CUCINA: una sola per il 3D e per la distinta
// =============================================================================
// Quote dei moduli alti (pensili, ponte), PIANO DI LAVORO continuo (lastre con i
// fori di lavello e piano cottura e i tagli dove passa un piano/tavolo), PANNELLO
// DIETRO IL PIANO / ALZATINA e STRISCE LED sotto i pensili. Solo calcoli, niente
// three.js: il 3D disegna questi pezzi e la distinta li elenca con le stesse misure.
// Coordinate: pianta (x, y) in mm; nel 3D x = x, z = −y.
// =============================================================================

import {
  categoriaTipo, dimMobile, frigoSottoAltillo, spessorePannelloPonte, pannelliSottoPonte, piediniCucina, zoccoloColonnaDi,
  cimaColonne, cimaCostadoATerra, costadoColonnaATerra, costadoCopreAnte, scendeAntaPensile, apertoDi, altezzaAlzatina,
  sporgenzaPiano, calcolaVertici, PROFONDITA_BASE, PROFONDITA_PENSILE,
} from './modello.js?v=20261127q';

export const MONTAGGIO_PENSILE = 1400;   // altezza da terra del basso dei pensili
export const SP_TOP = 40;                // spessore del piano di lavoro di partenza (mm)
export const SP_SCHIENALE = 12;          // spessore del pannello dietro il piano
export const H_SCHIENALE = 600;          // altezza se sopra non ci sono pensili

/** Spessore del piano di lavoro: scelto a mano per questa cucina, se no quello del materiale (nero standard 40). */
export function spessorePianoDi(progetto, encDef) {
  const enc = (progetto && progetto.encimera) || {};
  const mano = Number(enc.spessore);
  const uno = mano > 0 ? mano : (encDef && encDef.spessore != null) ? encDef.spessore : SP_TOP;
  return uno * Math.max(1, Math.min(3, Number(enc.strati) || 1));          // pannelli uno sopra l'altro
}
/** Spessore di UN pannello del piano (senza gli strati incollati). */
export function spessorePannelloPiano(progetto, encDef) {
  const enc = (progetto && progetto.encimera) || {};
  const mano = Number(enc.spessore);
  return mano > 0 ? mano : (encDef && encDef.spessore != null) ? encDef.spessore : SP_TOP;
}
/** Il materiale del piano dal catalogo caricato nella pagina (null = nero standard). */
export function defPiano(progetto) {
  const id = progetto && progetto.encimera && progetto.encimera.materiale;
  return (id && typeof window !== 'undefined' && (window.NG_MATERIALI || []).find((x) => x.id === id)) || null;
}

export function rotNorm(r) { return ((Math.round((r || 0) / 90) * 90) % 360 + 360) % 360; }

export function fuochiPerLarghezza(w) { return w < 600 ? 2 : 4; }

/** Dimensioni e posizione della vasca del lavello (il 3D del lavello e il FORO nel piano di lavoro). */
export function dimVasca(w, d) {
  const vw = Math.min(w * 0.56, 500);
  const vd = Math.min(d * 0.52, 400);
  const zc = -d * 0.03;                 // leggermente arretrata rispetto al centro
  return { vw, vd, zc };
}

/** Misura del vetro del piano cottura (e del suo foro nel piano di lavoro). */
// PLACCA a 2 fuochi = «domino» stretto (29 × 51 cm, zone una dietro l'altra); a 4 fuochi = 58 × 48
export function dimPlacca(w, d, fuochi = 4) {
  return fuochi === 2 ? { pw: Math.min(w - 40, 290), pd: Math.min(d - 80, 510) } : { pw: Math.min(w - 40, 580), pd: Math.min(d - 80, 480) };
}

/** Distanza di un punto (pianta) dal segmento ab. */
export function distSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Divide gli elementi di una fila (stessa linea/quota) in tratti CONTIGUI:
 * dove c'è un vuoto (es. una colonna in mezzo) si spezza, così top e zoccolo
 * non attraversano i buchi. Ritorna [{lo, hi, items}] in coordinate "along".
 */
export function tratti(items, c, s) {
  const arr = items.map((b) => {
    const along = b.x * c + b.y * s;
    return { b, lo: along - b.w / 2, hi: along + b.w / 2 };
  }).sort((p, q) => p.lo - q.lo);
  const runs = [];
  let cur = null;
  for (const it of arr) {
    if (!cur || it.lo > cur.hi + 60) { cur = { lo: it.lo, hi: it.hi, items: [it.b] }; runs.push(cur); }
    else { cur.hi = Math.max(cur.hi, it.hi); cur.items.push(it.b); }
  }
  return runs;
}

/** Proiezione di un fianco (costado/colonna) sull'asse della fila: [near, far]. */
export function proiettaFianco(f, c, s) {
  const along = f.x * c + f.y * s;
  const perp = f.x * (-s) + f.y * c;
  const fc = Math.cos((f.rot || 0) * Math.PI / 180), fs = Math.sin((f.rot || 0) * Math.PI / 180);
  const hU = (f.w / 2) * Math.abs(c * fc + s * fs) + (f.d / 2) * Math.abs(-c * fs + s * fc);
  return { along, perp, near: along - hU, far: along + hU };
}

// --- QUOTE DEI MODULI ALTI --------------------------------------------------
/** Cima più alta dei costadi (profondi, a terra) e dei pannelli alti (≥ 150 cm); null se non ce ne sono. */
export function quotaAltaPannelli(progetto) {
  let q = null;
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo), h = m.altezza_mm || 0;
    if (h < 1500) continue;
    if ((cat === 'costado' && (m.profondita_mm || 620) >= 500) || cat === 'pannello') q = Math.max(q ?? 0, h);
  }
  return q;
}
/**
 * CIMA DEI MODULI ALTI scelta con la "distanza dal frigo" di un mobile sopra
 * frigo (frigo + distanza + altezza del mobile), oppure null.
 */
export function cimaDaDistanzaFrigo(progetto) {
  for (const m of (progetto.mobiliLiberi || [])) {
    if (categoriaTipo(m.tipo) !== 'altillo' || m.distanzaFrigo_mm == null) continue;
    const fr = frigoSottoAltillo(progetto, m);
    if (fr) return (fr.altezza_mm || 1850) + Math.max(0, m.distanzaFrigo_mm) + (m.altezza_mm || 350);
  }
  return null;
}
/** Quote del sistema alto: { topLine (colonne), cimaAlta (pensili), scelta (dalla distanza dal frigo) }. */
export function quoteAlte(progetto) {
  const topLine = cimaColonne(progetto);
  const scelta = cimaDaDistanzaFrigo(progetto);
  const cimaAlta = scelta != null ? scelta : (topLine != null ? topLine : quotaAltaPannelli(progetto));
  return { topLine, cimaAlta, scelta };
}
/**
 * MOBILE SOPRA FRIGO: la sua cima va a filo con la cosa alta che ha accanto
 * (costado alto, colonna, pannello alto); se non tocca niente di alto, con la
 * cima delle colonne, se no 235 cm. Non scende mai dentro il frigo sotto.
 * Ritorna la quota del suo fondo (mm da terra).
 */
export function baseAltillo(progetto, m, topLine, cimaAlta = topLine, cimaScelta = null) {
  const h = m.altezza_mm || 350, dm = dimMobile(m);
  // DISTANZA DAL FRIGO scelta a mano: il mobile sta a quella distanza dal frigo;
  // gli altri mobili sopra frigo seguono la stessa cima (come i pensili)
  const fr = frigoSottoAltillo(progetto, m);
  if (fr && m.distanzaFrigo_mm != null) return (fr.altezza_mm || 1850) + Math.max(0, m.distanzaFrigo_mm);
  if (cimaScelta != null) return Math.max(cimaScelta - h, fr ? (fr.altezza_mm || 1850) + 10 : 0);
  const box = (o, d) => { const rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
    const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2; return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy }; };
  const A = box(m, dm);
  let cima = null, frigoSotto = 0;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    const cat = categoriaTipo(o.tipo);
    const B = box(o, dimMobile(o));
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    if (cat === 'frigo' && gx < -20 && gy < -20) { frigoSotto = Math.max(frigoSotto, o.altezza_mm || 1850); continue; }
    if (gx > 60 || gy > 60) continue;                      // non lo tocca
    let c = null;
    if (cat === 'colonna') c = (o.altezza_mm || 2200) + zoccoloColonnaDi(progetto, o);
    else if (cat === 'costado' && (o.profondita_mm || 620) >= 500 && (o.altezza_mm || 0) >= 1500) c = cimaCostadoATerra(o, topLine);
    else if (cat === 'pannello' && (o.altezza_mm || 0) >= 1500) c = o.altezza_mm;
    if (c != null) cima = Math.max(cima ?? 0, c);
  }
  if (cima == null) cima = cimaAlta != null ? cimaAlta : 2350;
  return Math.max(cima - h, frigoSotto ? frigoSotto + 10 : 0);
}

/** Rettangolo in pianta (rotazioni a 90°). */
export function boxPianta(o) {
  const d = dimMobile(o), rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
  const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2;
  return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy };
}
export function siSovrappongono(a, b) {
  const A = boxPianta(a), B = boxPianta(b);
  return Math.max(B.x0 - A.x1, A.x0 - B.x1) < -20 && Math.max(B.y0 - A.y1, A.y0 - B.y1) < -20;
}
/**
 * PENSILE SOTTO IL PONTE (o sotto un mobile sopra frigo): la sua cima tocca il
 * fondo del ponte. Ritorna la quota del fondo del ponte sopra m, o null.
 */
export function fondoPonteSopra(progetto, m, q) {
  let fondo = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id || categoriaTipo(o.tipo) !== 'altillo' || !siSovrappongono(m, o)) continue;
    // sotto il ponte c'è il PANNELLO che ne copre il fondo: il pensile va sotto di lui
    const b = baseAltillo(progetto, o, q.topLine, q.cimaAlta, q.scelta) - (o.tipo === 'ponte' ? spessorePannelloPonte(progetto) : 0);
    fondo = fondo == null ? b : Math.min(fondo, b);
  }
  return fondo;
}

/** Dove vanno i LED nella cucina a ponte, SEMPRE sotto: 'pensili' (sotto ogni pensile, anche quelli sotto
 *  il ponte), 'ponte' (sotto il ponte dove non ci sono pensili: il suo fondo si vede) o 'entrambi'.
 *  (Le scelte di prima: sotto → entrambi, come faceva; sopra → ponte.) */
export const ledPonte = (progetto) => { const v = (progetto.led && progetto.led.ponte) || 'entrambi'; return v === 'sotto' ? 'entrambi' : v === 'sopra' ? 'ponte' : v; };

/** Quota del FONDO di un pensile (mm da terra): a filo sopra con le colonne, se no appeso a 140 cm;
 *  sotto il PONTE la sua cima tocca il fondo del ponte. q = quoteAlte(progetto). */
export function basePensile(progetto, m, q) {
  const h = m.altezza_mm || 700;
  let base = q.cimaAlta != null ? (q.cimaAlta - h) : MONTAGGIO_PENSILE;
  const fondoPonte = fondoPonteSopra(progetto, m, q);
  if (fondoPonte != null) base = fondoPonte - h;
  return { base, fondoPonte };
}
/** Cima di ogni pensile e altezza delle sue ante (per i costadi alti, che vanno a filo sopra col pensile vicino). */
export function cimePensili(progetto, q) {
  return (progetto.mobiliLiberi || []).filter((x) => categoriaTipo(x.tipo) === 'pensile')
    .map((x) => { const h = x.altezza_mm || 700; return { x: x.x, y: x.y, cima: (q.cimaAlta != null ? q.cimaAlta - h : MONTAGGIO_PENSILE) + h,
      hAnta: h + scendeAntaPensile(progetto, h) }; });
}
/** Altezza e quota del fondo di un COSTADO: { h, base, alto }. Alto (profondità da pensile): a filo sopra col
 *  pensile vicino, alto come le sue ante; a terra: a filo sopra con le colonne; esterno delle colonne: fino a terra. */
export function quoteCostado(progetto, m, topLine, cimeP) {
  let h = m.altezza_mm || 850;
  const alto = (m.profondita_mm || 620) < 500;
  let base = alto ? MONTAGGIO_PENSILE : cimaCostadoATerra(m, topLine) - h;
  if (!alto && base > 0 && costadoColonnaATerra(progetto, m)) { h += base; base = 0; }
  if (alto) {
    let vicino = null, dMin = Infinity;
    for (const pz of cimeP) { const dd = Math.hypot(pz.x - m.x, pz.y - m.y); if (dd < dMin) { dMin = dd; vicino = pz; } }
    if (vicino && dMin < 2500) { h = vicino.hAnta; base = vicino.cima - h; }
    else if (topLine != null) base = topLine - h;
  }
  return { h, base, alto };
}
/** I muri della cucina (segmenti in pianta), quelli presenti. */
export function muriCucina(progetto) {
  const full = (progetto.piano && progetto.piano.pareti) || [];
  const V = calcolaVertici(full);
  return full.map((p, i) => (p.assente ? null : { a: V[i], b: V[i + 1] })).filter(Boolean);
}

// categorie che NON sono mobili bassi (niente piano di lavoro sopra)
const NON_BASSI = ['oggetto', 'pensile', 'colonna', 'frigo', 'altillo', 'regletta', 'pannello', 'costado', 'tavolo'];

/**
 * Cosa serve al PIANO DI LAVORO: i mobili bassi sotto di lui (basiTop, con la quota del piano), i fianchi che
 * lo fermano (colonne, frigo, costadi), lavelli e piani cottura (i fori), i pensili (altezza del pannello
 * dietro), i muri e i piani/tavoli che passano alla sua quota. `extra` = { basi, lavelli } già pronti.
 */
export function ingressiPiano(progetto, spTop, extra = {}) {
  const q = quoteAlte(progetto);
  const cimeP = cimePensili(progetto, q);
  const basiTop = [...(extra.basi || [])], fianchi = [], lavelli = [...(extra.lavelli || [])], pensili = [], tavoli = [];
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo), dim = dimMobile(m);
    if (cat === 'pensile') {
      pensili.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, yBottom: basePensile(progetto, m, q).base });
    } else if (cat === 'colonna') {
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h: (m.altezza_mm || 2200) + zoccoloColonnaDi(progetto, m), cat: 'colonna' });
    } else if (cat === 'frigo') {
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h: m.altezza_mm || 1850, cat: 'colonna' });
    } else if (cat === 'costado') {
      // costado basso accanto ai mobili: arriva fino al davanti delle ANTE (impronta allungata davanti)
      const { h } = quoteCostado(progetto, m, q.topLine, cimeP);
      const avanti = costadoCopreAnte(progetto, m), rC = ((m.rot || 0) * Math.PI) / 180;
      fianchi.push({ x: m.x - Math.sin(rC) * avanti / 2, y: m.y - Math.cos(rC) * avanti / 2, rot: m.rot, w: dim.w, d: dim.d + avanti, h, cat: 'costado' });
    } else if (cat === 'tavolo') {
      tavoli.push(m);
    } else if (!NON_BASSI.includes(cat)) {
      const porta = m.altezza_mm || 700, zocc = piediniCucina(progetto, porta);
      if (m.tipo === 'base-angolo') {
        // BASE ANGOLO a L: piano = due rettangoli, uno per braccio (+rot, L asimmetrica come nel 3D)
        const P = Math.min(m.profBraccio_mm || PROFONDITA_BASE, Math.min(dim.w, dim.d) - 10), hw = dim.w / 2, hd = dim.d / 2;
        const rr = (m.rot || 0) * Math.PI / 180, c = Math.cos(rr), s = Math.sin(rr);
        const vp = (lx, ly) => ({ x: m.x + lx * c - ly * s, y: m.y + lx * s + ly * c });
        const A = vp(0, hd - P / 2), B = vp(-hw + P / 2, -P / 2);
        for (const br of [{ ...A, rot: -(m.rot || 0), w: dim.w, d: P }, { ...B, rot: -(m.rot || 0) - 90, w: dim.d - P, d: P }]) {
          basiTop.push({ x: br.x, y: br.y, rot: br.rot, w: br.w, d: br.d, zocc, topY: zocc + porta });
        }
      } else {
        basiTop.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc, topY: zocc + porta });
      }
      const placca = m.tipo === 'forno' || !!m.placca, lavello = m.tipo === 'lavello' || !!m.lavello;
      if (placca || lavello) {
        lavelli.push({ id: m.id, x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, surfaceY: zocc + porta + spTop, placca, lavello,
          fuochi: m.fuochi || fuochiPerLarghezza(dim.w) });
      }
    }
  }
  return { basiTop, fianchi, lavelli, pensili, muri: muriCucina(progetto), tavoli: tavoliPiano(tavoli, basiTop, spTop), quote: q };
}

/**
 * PIANI / TAVOLI: quota (scritta a mano o «a filo» del piano dei mobili sotto o del più vicino) e
 * rettangolo in pianta. Servono al 3D (dove disegnarli) e al piano di lavoro (dove si apre per lasciarli passare).
 */
export function tavoliPiano(tavoli, basiTop, spTop) {
  // un punto della pianta (x, y) è dentro il mobile basso b? (stessa rotazione dei mobili nel 3D)
  const dentroBase = (x, y, b) => {
    const t = -(b.rot || 0) * Math.PI / 180, X = x - b.x, Z = -(y - b.y);
    const lx = X * Math.cos(t) - Z * Math.sin(t), lz = X * Math.sin(t) + Z * Math.cos(t);
    return Math.abs(lx) <= b.w / 2 + 1 && Math.abs(lz) <= (b.d || PROFONDITA_BASE) / 2 + 1;
  };
  return tavoli.map((m) => {
    const w = Math.max(100, m.larghezza_mm || 1800), d = Math.max(100, m.profondita_mm || 900);
    const strati = Math.max(1, Math.min(3, m.strati || 1)), sp = Math.max(6, m.spessore_mm || 40) * strati;
    // dal sistema del tavolo (x lungo, z verso il davanti; ruotato di −rot come nel 3D) alla pianta
    const r = (m.rot || 0) * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
    const inPianta = (lx, lz) => ({ x: m.x + lx * cr - lz * sr, y: m.y - lx * sr - lz * cr });
    let quota = Math.max(sp + 50, m.altezza_mm || 750);
    if (m.quota === 'filo') {
      let sopra = -Infinity;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2; j++) {
        const p = inPianta(-w / 2 + (w * i) / 6, -d / 2 + (d * j) / 2);
        for (const b of basiTop) if (dentroBase(p.x, p.y, b)) sopra = Math.max(sopra, b.topY);
      }
      if (!Number.isFinite(sopra)) {
        let dMin = Infinity;
        for (const b of basiTop) { const dd = Math.hypot(b.x - m.x, b.y - m.y); if (dd < dMin) { dMin = dd; sopra = b.topY; } }
      }
      quota = (Number.isFinite(sopra) ? sopra : 850) + spTop;
    }
    return { m, w, d, sp, strati, quota, dentroBase,
      angoli: [inPianta(-w / 2, -d / 2), inPianta(w / 2, -d / 2), inPianta(w / 2, d / 2), inPianta(-w / 2, d / 2)], y0: quota - sp, y1: quota };
  });
}

/**
 * PIANO DI LAVORO CONTINUO: una lastra per fila continua di mobili bassi (stesso orientamento, stessa
 * linea, stessa quota), che rispetta costadi e colonne, si allunga negli angoli fino al muro o al piano
 * dell'altra fila, con i FORI di lavelli e piani cottura e i TAGLI dove passa un piano/tavolo; dietro,
 * dove tocca il muro, il PANNELLO DIETRO IL PIANO / ALZATINA (e i suoi fianchi contro i muri).
 * Ogni lastra: { rotN, c, s, k, topY, spessore, len, depth, centerAlong, perpTop, cx, cy, fori, tagli,
 *   pezzi: [{u0, u1}] (parti separate se un tavolo la taglia da parte a parte), retro, fianchiSchienale, schienaleH }.
 * Coordinate locali della lastra: u lungo la fila (da sinistra a destra guardandola davanti), v verso il davanti.
 */
export function lastrePiano(progetto, spTop, extra = {}) {
  const I = ingressiPiano(progetto, spTop, extra);
  const thickness = spTop;
  const SPG = sporgenzaPiano(progetto), SD = SPG.davanti, SL = SPG.lati, SB = SPG.dietro;
  const schienale = progetto.schienale && progetto.schienale.attivo
    ? { altezza: altezzaAlzatina(progetto), pensili: I.pensili, muri: I.muri } : null;
  const lavelli = I.lavelli.filter((a) => a.lavello || a.placca);
  const tagli = I.tavoli.map((t) => ({ angoli: t.angoli, y0: t.y0, y1: t.y1 }));
  const muriPiano = I.muri, fianchi = I.fianchi;
  const gruppi = {};
  for (const b of I.basiTop) {
    const rotN = rotNorm(b.rot);
    const rad = rotN * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const perp = Math.round((b.x * (-s) + b.y * c) / 5) * 5;
    const key = `${rotN}|${perp}|${Math.round(b.topY)}`;
    (gruppi[key] ||= { rotN, c, s, topY: b.topY, d: b.d || PROFONDITA_BASE, items: [] }).items.push(b);
  }
  // 1) TRATTI di piano (uno per fila continua di mobili)
  const tratti1 = [];
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, topY } = G;
    // verso degli assi locali della lastra rispetto a lungo/perp: +1 a 0/180°, −1 a 90/270°
    // (x locale = k·lungo, z locale = −k·perp; il retro dei moduli è a perp + k·d/2)
    const k = rotN % 180 === 0 ? 1 : -1;
    for (const run of tratti(G.items, c, s)) {
      const lo = run.lo, hi = run.hi;
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      let endLo = lo - SL, endHi = hi + SL;   // estremità libere: a filo dell'ultimo mobile (niente sporgenza sui lati)
      let fermoLo = false, fermoHi = false;   // fermati da una colonna / un costado
      for (const f of fianchi) {
        const pf = proiettaFianco(f, c, s);
        if (Math.abs(pf.perp - perp) > 350) continue;   // non sulla stessa linea
        const tall = (f.h || 0) >= 1500;
        if (pf.along >= hi - 1 && pf.near <= hi + 90) {          // estremità destra
          endHi = (f.cat === 'costado' && !tall) ? pf.far : hi; fermoHi = true;
        }
        if (pf.along <= lo + 1 && pf.far >= lo - 90) {           // estremità sinistra
          endLo = (f.cat === 'costado' && !tall) ? pf.near : lo; fermoLo = true;
        }
      }
      // Profondità: normalmente = profondità dei moduli; se sulla fila ci sono COSTADI bassi più profondi
      // (es. isola) il piano si estende ALL'INDIETRO per coprirli (il fronte resta dov'è)
      let pMin = perp - G.d / 2, pMax = perp + G.d / 2;
      let cMin = Infinity, cMax = -Infinity;                    // impronta dei costadi della fila
      for (const f of fianchi) {
        if (f.cat !== 'costado' || (f.h || 0) >= 1500) continue;   // solo costadi bassi
        const pf = proiettaFianco(f, c, s);
        if (pf.far < endLo - 90 || pf.near > endHi + 90) continue;  // non su questa fila
        const fco = Math.cos((f.rot || 0) * Math.PI / 180), fso = Math.sin((f.rot || 0) * Math.PI / 180);
        const hV = (f.w / 2) * Math.abs(fso * c - fco * s) + (f.d / 2) * Math.abs(fco * c + fso * s);
        const fMin = pf.perp - hV, fMax = pf.perp + hV;
        if (fMax < perp - G.d / 2 - 20 || fMin > perp + G.d / 2 + 20) continue; // non condivide il fronte
        pMin = Math.min(pMin, fMin); pMax = Math.max(pMax, fMax);
        cMin = Math.min(cMin, fMin); cMax = Math.max(cMax, fMax);
      }
      // BORDI: davanti la profondità del piano − 600; dietro a filo del retro dei mobili (il muro);
      // dove c'è un COSTADO il piano finisce A FILO del costado
      const mMin = perp - G.d / 2, mMax = perp + G.d / 2;
      const sMin = k === 1 ? SD : SB, sMax = k === 1 ? SB : SD;
      const bMin = cMin <= mMin + 1 ? cMin : mMin - sMin;
      const bMax = cMax >= mMax - 1 ? cMax : mMax + sMax;
      tratti1.push({ G, c, s, rotN, topY, k, lo, hi, perp, pMin, pMax, bMin, bMax, endLo, endHi, fermoLo, fermoHi });
    }
  }
  // 2) ANGOLI E MURI: un'estremità che non arriva al muro si allunga FINO AL MURO (angolo chiuso in un
  //    pezzo unico); se lì c'è il piano dell'altra fila, ci si appoggia esattamente
  const MAX_ALLUNGO = 700;
  const inCoord = (T, x, y) => ({ a: x * T.c + y * T.s, p: -x * T.s + y * T.c });
  const angoliPiano = (T) => {
    const P = (a, p) => ({ x: T.c * a - T.s * p, y: T.s * a + T.c * p });
    return [P(T.endLo, T.bMin), P(T.endHi, T.bMin), P(T.endLo, T.bMax), P(T.endHi, T.bMax)];
  };
  const nuoviFini = tratti1.map((T) => {
    const out = { endLo: T.endLo, endHi: T.endHi };
    for (const [lato, dir] of [['endLo', -1], ['endHi', 1]]) {
      if (lato === 'endLo' ? T.fermoLo : T.fermoHi) continue;
      const e = lato === 'endLo' ? T.lo : T.hi;              // filo dei mobili
      const banda = T.pMax - T.pMin, pC = (T.pMin + T.pMax) / 2;
      let meglio = null;                                     // { dist, fine }
      for (const Q of tratti1) {
        if (Q === T || Math.abs(Q.topY - T.topY) > 5) continue;
        if (Q.rotN % 180 === T.rotN % 180) continue;          // solo l'altra fila dell'ANGOLO
        const pts = angoliPiano(Q).map((q) => inCoord(T, q.x, q.y));
        const qa0 = Math.min(...pts.map((q) => q.a)), qa1 = Math.max(...pts.map((q) => q.a));
        const qp0 = Math.min(...pts.map((q) => q.p)), qp1 = Math.max(...pts.map((q) => q.p));
        const sovP = Math.min(T.pMax, qp1) - Math.max(T.pMin, qp0);
        if (sovP < banda * 0.5) continue;
        const bordo = dir > 0 ? qa0 : qa1, dist = (bordo - e) * dir;
        if (dist < -80 || dist > MAX_ALLUNGO) continue;
        if (!meglio || dist < meglio.dist) meglio = { dist, fine: bordo };
      }
      for (const w of muriPiano) {
        const A = inCoord(T, w.a.x, w.a.y), B = inCoord(T, w.b.x, w.b.y);
        if (Math.abs(A.a - B.a) > 5) continue;                // non perpendicolare alla fila
        if (pC < Math.min(A.p, B.p) - 5 || pC > Math.max(A.p, B.p) + 5) continue;
        const dist = (A.a - e) * dir;
        if (dist < -30 || dist > MAX_ALLUNGO) continue;
        // oltre 15 cm si chiude solo negli ANGOLI: uno spazio voluto (es. frigo libero) in fondo a una fila resta aperto
        if (dist > 150) {
          const a0 = Math.min(e, A.a), a1 = Math.max(e, A.a);
          const angolo = tratti1.some((Q) => {
            if (Q === T || Q.rotN % 180 === T.rotN % 180) return false;
            const pts = angoliPiano(Q).map((q) => inCoord(T, q.x, q.y));
            const qa0 = Math.min(...pts.map((q) => q.a)), qa1 = Math.max(...pts.map((q) => q.a));
            return qa1 > a0 + 10 && qa0 < a1 - 10;
          });
          if (!angolo) continue;
        }
        if (!meglio || dist < meglio.dist) meglio = { dist, fine: A.a };
      }
      if (meglio) out[lato] = meglio.fine;
    }
    return out;
  });
  tratti1.forEach((T, i) => Object.assign(T, nuoviFini[i]));
  // 3) LASTRE: misure, fori, tagli e pannello dietro
  const lastre = [];
  for (const T of tratti1) {
    const { G, c, s, rotN, topY, k, lo, hi, perp, bMin, bMax, endLo, endHi } = T;
    const depth = bMax - bMin;
    const perpTop = (bMin + bMax) / 2;
    const len = endHi - endLo;
    const centerAlong = (endLo + endHi) / 2;
    const cx = c * centerAlong + (-s) * perpTop;
    const cy = s * centerAlong + c * perpTop;
    // FORI dei lavelli e dei piani cottura che cadono su questo tratto (stessa fila/quota)
    const fori = [];
    for (const lv of lavelli) {
      if (rotNorm(lv.rot) !== rotN) continue;
      const alongS = lv.x * c + lv.y * s;
      const perpS = lv.x * (-s) + lv.y * c;
      if (Math.abs(perpS - perpTop) > depth / 2 + 50) continue;
      if (alongS < endLo - 10 || alongS > endHi + 10) continue;
      if (lv.lavello) {
        const { vw, vd, zc } = dimVasca(lv.w, lv.d);
        // v locale della lastra = −(perp − perpTop): la lastra è ruotata come i mobili (−rot)
        fori.push({ tipo: 'lavello', u: k * (alongS - centerAlong), v: k * (perpTop - perpS) + zc, w: vw + 6, d: vd + 6 });
      } else if (lv.placca) {
        // piano cottura INCASSATO: il vetro sta nel foro
        const { pw, pd } = dimPlacca(lv.w, lv.d, lv.fuochi);
        fori.push({ tipo: 'placca', u: k * (alongS - centerAlong), v: k * (perpTop - perpS), w: pw - 12, d: pd - 12 });
      }
    }
    // PIANO / TAVOLO che passa ALLA QUOTA del piano: lì il piano si apre (pezzi, tacca o buco)
    const tagliQui = [];
    for (const t of tagli) {
      if (t.y1 <= topY + 1 || t.y0 >= topY + thickness - 1) continue;          // più basso o più alto: non si toccano
      const loc = t.angoli.map((q) => { const al = q.x * c + q.y * s, pp = -q.x * s + q.y * c; return { u: k * (al - centerAlong), v: k * (perpTop - pp) }; });
      const u0 = Math.min(...loc.map((q) => q.u)), u1 = Math.max(...loc.map((q) => q.u));
      const v0 = Math.min(...loc.map((q) => q.v)), v1 = Math.max(...loc.map((q) => q.v));
      if (u1 <= -len / 2 || u0 >= len / 2 || v1 <= -depth / 2 || v0 >= depth / 2) continue;
      // solo se è dritta rispetto al piano (lati paralleli)
      let area = 0; for (let i = 0; i < 4; i++) { const a = loc[i], b = loc[(i + 1) % 4]; area += a.u * b.v - b.u * a.v; }
      if (Math.abs(area) / 2 < 0.97 * (u1 - u0) * (v1 - v0)) continue;
      tagliQui.push({ u0, u1, v0, v1 });
    }
    // con i tagli: griglia dei bordi dei tagli → cosa resta della lastra (niente = non c'è lastra)
    let pezzi = [{ u0: -len / 2, u1: len / 2 }];
    if (tagliQui.length) {
      const halfU = len / 2, halfV = depth / 2;
      const tg = tagliQui.map((t) => ({ x0: t.u0, x1: t.u1, y0: -t.v1, y1: -t.v0 }));
      const unici = (a) => [...new Set(a.map((x) => Math.round(x * 10) / 10))].sort((p, q) => p - q);
      const xs = unici([-halfU, halfU, ...tg.flatMap((t) => [t.x0, t.x1]).filter((x) => x > -halfU + 1 && x < halfU - 1)]);
      const ys = unici([-halfV, halfV, ...tg.flatMap((t) => [t.y0, t.y1]).filter((y) => y > -halfV + 1 && y < halfV - 1)]);
      const colonnaVuota = [];
      let vuote = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        let tutte = true;
        for (let j = 0; j < ys.length - 1; j++) {
          const qx = (xs[i] + xs[i + 1]) / 2, qy = (ys[j] + ys[j + 1]) / 2;
          const dentro = tg.some((t) => qx > t.x0 && qx < t.x1 && qy > t.y0 && qy < t.y1);
          if (dentro) vuote++; else tutte = false;
        }
        colonnaVuota.push(tutte);
      }
      if (vuote === (xs.length - 1) * (ys.length - 1)) continue;           // tutto coperto dal piano/tavolo
      // parti separate: dove il tavolo taglia la lastra da parte a parte (una colonna tutta vuota)
      pezzi = [];
      let cur = null;
      for (let i = 0; i < xs.length - 1; i++) {
        if (colonnaVuota[i]) { cur = null; continue; }
        if (!cur) { cur = { u0: xs[i], u1: xs[i + 1] }; pezzi.push(cur); } else cur.u1 = xs[i + 1];
      }
    }
    const L = { rotN, c, s, k, topY, spessore: thickness, len, depth, centerAlong, perpTop, cx, cy, fori, tagli: tagliQui, pezzi,
      retro: null, fianchiSchienale: [], schienaleH: null };
    // PANNELLO DIETRO IL PIANO (aplacado / alzatina): ovunque il piano tocca un muro, dietro la fila e sui
    // fianchi del piano che finiscono contro un muro (negli angoli della cucina a L / U)
    if (schienale) {
      const perpMuro = perp + k * G.d / 2;                   // retro dei moduli = muro
      const Pp = (al, pp) => ({ x: c * al - s * pp, y: s * al + c * pp });
      const suMuro = (pts) => schienale.muri.some((w) => pts.filter((q) => distSegmento(q, w.a, w.b) < 90).length >= 2);
      // altezza: fino ai pensili sopra questa fila, altrimenti 60 cm
      let yPens = Infinity;
      for (const pz of schienale.pensili) {
        if (rotNorm(pz.rot) !== rotN) continue;
        const al = pz.x * c + pz.y * s, pp = pz.x * (-s) + pz.y * c;
        if (Math.abs(al - centerAlong) > len / 2 + pz.w / 2 - 20) continue;
        const dd = k * (perpMuro - pp);
        if (dd < -50 || dd > 700) continue;
        yPens = Math.min(yPens, pz.yBottom);
      }
      const yTop = topY + thickness;
      // ALZATINA: alta quanto scelto; se no il pannello va fino ai pensili (o 60 cm se sopra non ci sono)
      const H = schienale.altezza ? schienale.altezza
        : Number.isFinite(yPens) && yPens - yTop > 100 ? yPens - yTop : H_SCHIENALE;
      L.schienaleH = H;
      // coordinate locali della lastra: +z = fronte (stanza), il muro è dietro
      const zMuro = -k * (perpMuro - perpTop);
      const zFronte = -k * ((perp - k * G.d / 2) - perpTop);   // filo delle ante (senza la sporgenza del piano)
      const dz = Math.sign(zFronte - zMuro) || 1;
      if (suMuro([Pp(centerAlong, perpMuro), Pp(lo + 50, perpMuro), Pp(hi - 50, perpMuro)])) {
        L.retro = { len, H, x: 0, y: thickness / 2 + H / 2, z: zMuro + dz * SP_SCHIENALE / 2 };
      }
      for (const e of [endLo, endHi]) {
        const pts = [Pp(e, perpMuro - k * 100), Pp(e, perpMuro - k * (G.d / 2)), Pp(e, perpMuro - k * (G.d - 100))];
        if (!suMuro(pts)) continue;
        const xE = k * (e - centerAlong), dentro = -Math.sign(xE) || 1;
        const prof = Math.abs(zFronte - zMuro) + SD - SP_SCHIENALE;   // fino al bordo davanti del piano
        L.fianchiSchienale.push({ prof, H, x: xE + dentro * SP_SCHIENALE / 2, y: thickness / 2 + H / 2, z: zMuro + dz * (SP_SCHIENALE + prof / 2) });
      }
    }
    lastre.push(L);
  }
  return { lastre, ingressi: I };
}

// --- LED SOTTO I PENSILI --------------------------------------------------------
// Un sistema (x, y, z, giro attorno a y) dentro l'altro, come i gruppi del 3D: punto locale → mondo.
const inMondo = (catena, p) => {
  let { x, y, z } = p;
  for (let i = catena.length - 1; i >= 0; i--) {
    const f = catena[i], cs = Math.cos(f.ry || 0), sn = Math.sin(f.ry || 0);
    const X = x * cs + z * sn, Z = -x * sn + z * cs;
    x = X + (f.px || 0); y = y + (f.py || 0); z = Z + (f.pz || 0);
  }
  return { x, y, z };
};
// sistema di un mobile messo come nel 3D (collocaMobile): centro a metà altezza, girato di −rot
const sistemaMobile = (x, yBottom, yPianta, h, rot) => ({ px: x, py: yBottom + h / 2, pz: -yPianta, ry: -(rot || 0) * Math.PI / 180 });

/**
 * STRISCE LED della cucina (come nel 3D): sotto ogni pensile (anche il secondo braccio del pensile
 * angolo), sotto il ponte o il suo pannello dove non ci sono pensili. I tratti attaccati (stessa
 * altezza, stessa linea, al massimo 3 cm di buco) diventano UNA striscia, 1 cm più corta per capo.
 * Ritorna [{ lunghezza, mid: {x,y,z}, u: {x,z}, vM: {x,z}, y, dove: 'pensili'|'ponte'|'entrambi' }] (coordinate 3D).
 */
export function ledCucina(progetto) {
  if (!(progetto.led && progetto.led.attivo)) return [];
  const mobili = progetto.mobiliLiberi || [];
  const q = quoteAlte(progetto);
  const conPannello = progetto.schienale && progetto.schienale.attivo;
  const tr = [];        // { catena, w, h, d, avanti, dove }
  for (const m of mobili) {
    const cat = categoriaTipo(m.tipo), dim = dimMobile(m);
    if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      const { base, fondoPonte } = basePensile(progetto, m, q);
      if (m.tipo === 'pensile-angolo-45' || !(fondoPonte == null || ledPonte(progetto) !== 'ponte')) continue;
      const sporg = scendeAntaPensile(progetto, h);
      const av = conPannello ? SP_SCHIENALE : 0;
      // pensile angolo a L: +rot (L asimmetrica); gli altri come collocaMobile
      const sis = m.tipo === 'pensile-angolo' ? { px: m.x, py: base + h / 2, pz: -m.y, ry: (m.rot || 0) * Math.PI / 180 } : sistemaMobile(m.x, base, m.y, h, m.rot);
      // pensile APERTO con l'anta da 72 / 92: il fondo scende di 2 cm, il LED va sotto di lui
      const catena = apertoDi(m) && sporg ? [sis, { py: -sporg }] : [sis];
      tr.push({ catena, w: dim.w, h, d: dim.d, avanti: av, dove: 'pensili' });
      if (m.tipo === 'pensile-angolo') {                       // anche sotto il secondo braccio
        tr.push({ catena: [sis, { pz: PROFONDITA_PENSILE / 2, ry: Math.PI / 2 }], w: dim.d - PROFONDITA_PENSILE, h, d: dim.w, avanti: av, dove: 'pensili' });
      }
    } else if (cat === 'altillo' && m.tipo === 'ponte') {
      // LED SOTTO IL PONTE dove sotto non ci sono pensili (senza il pannello sotto il ponte)
      if (ledPonte(progetto) === 'pensili' || spessorePannelloPonte(progetto)) continue;
      if (mobili.some((o) => categoriaTipo(o.tipo) === 'pensile' && siSovrappongono(o, m))) continue;
      const h = m.altezza_mm || 350;
      const base = baseAltillo(progetto, m, q.topLine, q.cimaAlta, q.scelta);
      tr.push({ catena: [sistemaMobile(m.x, base, m.y, h, m.rot)], w: dim.w, h, d: dim.d, avanti: 0, dove: 'ponte' });
    }
  }
  // PANNELLO SOTTO IL PONTE: la luce sta sotto il pannello, sotto ogni modulo del ponte senza pensile sotto
  if (ledPonte(progetto) !== 'pensili') {
    const spP = spessorePannelloPonte(progetto);
    for (const f of pannelliSottoPonte(progetto)) {
      const pz = f.ids.map((id) => mobili.find((o) => o.id === id)).filter(Boolean);
      if (!pz.length) continue;
      const fondo = Math.min(...pz.map((o) => baseAltillo(progetto, o, q.topLine, q.cimaAlta, q.scelta)));
      const sis = sistemaMobile(f.x, fondo - spP, f.y, spP, f.rot);
      const conPensili = mobili.some((o) => categoriaTipo(o.tipo) === 'pensile' && pz.some((p) => siSovrappongono(o, p)));
      if (!conPensili) { tr.push({ catena: [sis], w: f.w, h: spP, d: f.d, avanti: 0, dove: 'ponte' }); continue; }
      const r = (f.rot || 0) * Math.PI / 180;
      for (const o of pz) {
        if (mobili.some((p) => categoriaTipo(p.tipo) === 'pensile' && siSovrappongono(p, o))) continue;
        tr.push({ catena: [sis, { px: (o.x - f.x) * Math.cos(r) - (o.y - f.y) * Math.sin(r) }], w: dimMobile(o).w, h: spP, d: f.d, avanti: 0, dove: 'ponte' });
      }
    }
  }
  // i tratti nel mondo (stessa costruzione del 3D)
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const piatto = (v) => { const n = Math.hypot(v.x, v.z) || 1; return { x: v.x / n, y: 0, z: v.z / n }; };
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const segs = tr.map((t) => {
    const y = -t.h / 2, z = -t.d / 2 + 13 + t.avanti;
    const A = inMondo(t.catena, { x: -t.w / 2, y, z }), B = inMondo(t.catena, { x: t.w / 2, y, z });
    const C = inMondo(t.catena, { x: 0, y, z }), D = inMondo(t.catena, { x: 0, y, z: z - 100 });
    return { A, B, u: piatto(sub(B, A)), vM: piatto(sub(D, C)), y: (A.y + B.y) / 2, dove: t.dove };
  });
  // raggruppo: stessa altezza, stessa linea, uno dopo l'altro (al massimo 3 cm di buco)
  const usati = new Set(), file = [];
  for (let i = 0; i < segs.length; i++) {
    if (usati.has(i)) continue;
    const s0 = segs[i], fila = [s0]; usati.add(i);
    const t = (P) => dot(sub(P, s0.A), s0.u);
    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (let j = 0; j < segs.length; j++) {
        if (usati.has(j)) continue;
        const sg = segs[j];
        if (Math.abs(sg.y - s0.y) > 3 || Math.abs(dot(sg.u, s0.u)) < 0.999) continue;
        const off = sub(sg.A, s0.A); off.y = 0;
        const lungo = dot(off, s0.u);
        const perp = Math.hypot(off.x - s0.u.x * lungo, off.z - s0.u.z * lungo);
        if (perp > 12) continue;
        const a = Math.min(t(sg.A), t(sg.B)), bb = Math.max(t(sg.A), t(sg.B));
        if (fila.some((f) => { const fa = Math.min(t(f.A), t(f.B)), fb = Math.max(t(f.A), t(f.B)); return a <= fb + 30 && bb >= fa - 30; })) {
          fila.push(sg); usati.add(j); cambiato = true;
        }
      }
    }
    file.push(fila);
  }
  return file.map((fila) => {
    const s0 = fila[0], t = (P) => dot(sub(P, s0.A), s0.u);
    let a = Infinity, bb = -Infinity;
    for (const f of fila) { a = Math.min(a, t(f.A), t(f.B)); bb = Math.max(bb, t(f.A), t(f.B)); }
    const lung = Math.max(60, bb - a - 20);                          // 1 cm di margine ai due capi
    const m0 = (a + bb) / 2;
    const dove = fila.every((f) => f.dove === 'pensili') ? 'pensili' : fila.every((f) => f.dove === 'ponte') ? 'ponte' : 'entrambi';
    return { lunghezza: lung, mid: { x: s0.A.x + s0.u.x * m0, y: s0.y, z: s0.A.z + s0.u.z * m0 }, u: { x: s0.u.x, z: s0.u.z }, vM: { x: s0.vM.x, z: s0.vM.z }, y: s0.y, dove };
  });
}
