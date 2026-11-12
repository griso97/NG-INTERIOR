// =============================================================================
// MOBILI MODULARI — moduli e cubi dentro il vano + distinta di taglio
// =============================================================================
// Stesso assemblaggio degli ARMADI a battente (setup 1, top/fondo passanti):
//   Pc        = P − sA − sS                      (profondità carcassa)
//   Top/Fondo = L × Pc                           (passanti)
//   Fianchi   = Pc × (H − 2·sC)                  (stanno in mezzo)
//   Schiena   = (L − 2) × (H − 2)
//   Ripiani   = (L − 2·sC) × Pc
//   Ante      = (L − (N+1)·2) / N  ×  (H − 4)
// Sotto un soffitto INCLINATO (sottoscala) il modulo ha due altezze diverse:
// il top diventa inclinato, i fianchi hanno il bordo alto inclinato, schiena e
// ante diventano trapezi. Con inclinazione 0 le formule tornano quelle sopra.
// Misure in mm. Coordinate: x a destra, y in alto, origine angolo basso-sx.
// =============================================================================

export const SPESSORI_DEFAULT = { carcassa: 18, schiena: 10, ante: 18 };
export const H_MINIMA_MODULO = 250;        // sotto questa altezza non si mette un modulo
const DEG = 180 / Math.PI;
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------------------
// Profilo del vano
// ---------------------------------------------------------------------------
/** Altezza del soffitto alla coordinata x (bordo alto del vano). */
export function altezzaSoffitto(punti, x) {
  let best = -Infinity;
  const n = punti.length;
  for (let i = 0; i < n; i++) {
    const a = punti[i], b = punti[(i + 1) % n];
    const lo = Math.min(a.x, b.x) - 1e-6, hi = Math.max(a.x, b.x) + 1e-6;
    if (x < lo || x > hi) continue;
    if (Math.abs(b.x - a.x) < 1e-6) { best = Math.max(best, a.y, b.y); continue; }
    best = Math.max(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best === -Infinity ? 0 : best;
}
/** x degli spigoli del soffitto (cambi di pendenza) strettamente dentro il vano. */
export function spigoliSoffitto(punti, larghezza) {
  return punti.filter((p) => p.y > 0 && p.x > 1 && p.x < larghezza - 1).map((p) => p.x);
}
function dentroPoligono(punti, x, y, tol = 0.5) {
  // poligono convesso antiorario: il punto deve stare a sinistra di ogni lato
  const n = punti.length;
  for (let i = 0; i < n; i++) {
    const a = punti[i], b = punti[(i + 1) % n];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const cross = ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / L;
    if (cross < -tol) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Modalità "A MODULI": divisione della larghezza
// ---------------------------------------------------------------------------
/** Lato da cui partono i moduli (quello più alto) e larghezza utile automatica. */
export function larghezzaUtileAuto(forma) {
  const W = forma.larghezza;
  const hSx = altezzaSoffitto(forma.punti, 0), hDx = altezzaSoffitto(forma.punti, W);
  const daSinistra = hSx >= hDx;
  let utile = 0;
  for (let d = 0; d <= W + 0.1; d += 10) {
    const x = daSinistra ? d : W - d;
    if (altezzaSoffitto(forma.punti, x) >= H_MINIMA_MODULO) utile = d; else break;
  }
  return { daSinistra, utile: Math.floor(Math.min(utile, W) / 10) * 10 };
}

/**
 * Posiziona i moduli. cfg = { uguali, numero, larghezzaUsata|null, comune:{...}, lista:[{larghezza,ante,lato,ripiani}] }
 * Ritorna { moduli:[{indice,x0,x1,larghezza,hL,hR,ante,lato,ripiani,spigolo}], usata, daSinistra, errori, avvisi }
 */
export function layoutModuli(forma, cfg, spessori = SPESSORI_DEFAULT) {
  const errori = [], avvisi = [];
  const W = forma.larghezza;
  const auto = larghezzaUtileAuto(forma);
  const usata = cfg.larghezzaUsata > 0 ? Math.min(cfg.larghezzaUsata, W) : auto.utile;
  let defs;
  if (cfg.uguali) {
    const n = Math.max(1, Math.min(20, Math.round(cfg.numero || 1)));
    const l = Math.floor(usata / n);
    defs = Array.from({ length: n }, () => ({ ...cfg.comune, larghezza: l }));
  } else {
    defs = (cfg.lista || []).map((m) => ({ ...m }));
    const somma = defs.reduce((s, m) => s + (Number(m.larghezza) || 0), 0);
    if (somma > W + 0.5) errori.push(`La somma dei moduli (${r0(somma)} mm) supera la larghezza del vano (${r0(W)} mm).`);
  }
  const sC = spessori.carcassa;
  const spigoli = spigoliSoffitto(forma.punti, W);
  const moduli = [];
  let pos = 0;
  defs.forEach((d, i) => {
    const L = Number(d.larghezza) || 0;
    if (L < 2 * sC + 60) { errori.push(`Modulo ${i + 1}: larghezza troppo piccola (${r0(L)} mm).`); return; }
    const x0 = auto.daSinistra ? pos : W - pos - L;
    const x1 = x0 + L;
    pos += L;
    const hL = altezzaSoffitto(forma.punti, x0), hR = altezzaSoffitto(forma.punti, x1);
    const hMin = Math.min(hL, hR);
    if (hMin < 2 * sC + 60) errori.push(`Modulo ${i + 1}: dal lato basso è alto solo ${r0(hMin)} mm, troppo poco. Riduci la larghezza occupata o il numero di moduli.`);
    else if (hMin < H_MINIMA_MODULO) avvisi.push(`Modulo ${i + 1}: dal lato basso è alto solo ${r0(hMin)} mm. Si può fare, ma è molto basso: valuta di stringerlo o di chiudere quella zona.`);
    const spigolo = spigoli.find((s) => s > x0 + 1 && s < x1 - 1);
    if (spigolo != null) {
      avvisi.push(`Modulo ${i + 1} passa sotto un cambio di pendenza del soffitto (a ${r0(spigolo)} mm da sinistra): il top segue la linea retta tra i due lati. Per sfruttare tutto lo spazio metti una divisione lì.`);
    }
    moduli.push({ indice: i, x0, x1, larghezza: L, hL, hR,
      ante: d.ante ?? 1, lato: d.lato || 'dx', ripiani: Math.max(0, Math.round(d.ripiani ?? 1)), spigolo });
  });
  // Spazio rimasto verso il lato basso: lo chiude un modulo finale
  // (triangolare se il soffitto scende quasi a terra).
  const resto = W - pos;
  const fronte = ['anta', 'aperto', 'no'].includes(cfg.chiusura) ? cfg.chiusura : 'anta';
  let chiusura = null;
  if (resto > 2 * sC + 20 && fronte !== 'no') {
    const xa = auto.daSinistra ? pos : 0, xb = auto.daSinistra ? W : resto;
    chiusura = geometriaChiusura({ x0: xa, x1: xb, hL: altezzaSoffitto(forma.punti, xa), hR: altezzaSoffitto(forma.punti, xb),
      daSinistra: auto.daSinistra, fronte }, spessori);
  } else if (resto > 1 && fronte === 'no') {
    avvisi.push(`Restano ${r0(resto)} mm liberi dal lato basso: puoi chiuderli con il modulo finale (triangolare).`);
  }
  return { moduli, usata, resto, daSinistra: auto.daSinistra, chiusura, errori, avvisi };
}

// ---------------------------------------------------------------------------
// Modulo finale di CHIUSURA (la punta bassa del sottoscala)
// ---------------------------------------------------------------------------
/**
 * Se dal lato basso c'è ancora spazio per un fianco → modulo inclinato normale.
 * Altrimenti modulo TRIANGOLARE: fondo, top inclinato che si appoggia sul
 * fondo, un solo fianco (lato alto), schiena e anta triangolari.
 * Ritorna anche i profili (x,y in mm) per il disegno 2D/3D.
 */
export function geometriaChiusura(c, sp = SPESSORI_DEFAULT) {
  const sC = sp.carcassa;
  const L = c.x1 - c.x0;
  const hS = c.daSinistra ? c.hL : c.hR;          // lato alto (attaccato ai moduli)
  const hE = c.daSinistra ? c.hR : c.hL;          // lato basso (verso il muro/pavimento)
  const k = Math.max(1e-6, (hS - hE) / L);
  const alfa = Math.atan(k);
  const tv = sC / Math.cos(alfa);
  const fiancoBasso = hE + sC * Math.tan(alfa) - tv - sC;
  const base = { ...c, larghezza: L, hAlto: hS, hBasso: hE, angolo: r1(alfa * DEG) };
  if (fiancoBasso >= 30 || hS - hE < 1) return { ...base, triangolare: false };

  const dir = c.daSinistra ? 1 : -1;
  const xT = c.daSinistra ? c.x0 : c.x1;          // x del lato alto
  const X = (u) => xT + dir * u;
  const yt = (u) => hS - k * u;                   // soffitto (sopra del top)
  const uDove = (y) => Math.min(L, Math.max(0, (hS - y) / k));   // dove il soffitto vale y
  const map = (pts) => pts.map(([u, y]) => [X(u), y]);
  // Zona sotto il soffitto (abbassato di off) tra u0 e u1, sopra yBase
  const sotto = (u0, u1, yBase, off) => {
    const uE = Math.min(u1, uDove(yBase + off));
    const p = [[u0, yBase], [uE, yBase]];
    if (uE >= u1 - 0.01 && yt(u1) - off > yBase + 0.5) p.push([u1, yt(u1) - off]);
    p.push([u0, yt(u0) - off]);
    return { pts: p, larghezza: uE - u0, altezza: yt(u0) - off - yBase };
  };
  const uf = uDove(sC);                           // il sopra del top tocca il fondo
  const uu = uDove(sC + tv);                      // il sotto del top tocca il fondo
  const top = [[0, yt(0) - tv], [uu, sC], [uf, sC]];
  if (uf >= L - 0.01 && yt(L) > sC + 0.5) top.push([L, yt(L)]);
  top.push([0, yt(0)]);
  const schiena = sotto(1, L - 1, 1, 1);
  const anta = sotto(2, L - 2, 2, 2);
  return {
    ...base, triangolare: true, dir, xT,
    profili: {
      fondo: map([[0, 0], [uf, 0], [uf, sC], [0, sC]]),
      top: map(top),
      fianco: map([[0, sC], [sC, sC], [sC, yt(sC) - tv], [0, yt(0) - tv]]),
      schiena: map(schiena.pts),
      anta: map(anta.pts),
      contorno: map([[0, 0], [uf, 0], ...(uf >= L - 0.01 && yt(L) > 0.5 ? [[L, yt(L)]] : [[uf, sC]]), [0, hS]]),
    },
    misure: {
      fondo: uf, top: uf / Math.cos(alfa), fianco: hS - tv - sC,
      schiena: { larghezza: schiena.larghezza, altezza: schiena.altezza },
      anta: { larghezza: anta.larghezza, altezza: anta.altezza },
    },
  };
}

/** Pezzi del modulo di chiusura. */
export function pezziChiusura(ch, P, sp = SPESSORI_DEFAULT) {
  const ante = ch.fronte === 'anta' ? 1 : 0;
  const lato = ch.daSinistra ? 'dx' : 'sx';      // cerniere dal lato alto
  if (!ch.triangolare) {
    return pezziModulo({ nome: 'Chiusura in fondo', larghezza: ch.larghezza, hL: ch.hL, hR: ch.hR, ante, lato, ripiani: 0 }, P, sp);
  }
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS;
  const m = ch.misure, a = ch.angolo;
  const pz = [];
  const add = (nome, larghezza, altezza, spessore, materiale) =>
    pz.push({ modulo: 'Chiusura triangolare', nome, larghezza: r0(larghezza), altezza: r0(altezza), spessore, materiale, quantita: 1 });
  add('Fondo', m.fondo, Pc, sC, 'carcassa');
  add(`Top inclinato (testata alta a ${a}°, testata bassa orizzontale in appoggio sul fondo)`, m.top, Pc, sC, 'carcassa');
  add(`Fianco lato alto (bordo alto inclinato ${a}°)`, Pc, m.fianco, sC, 'carcassa');
  add(`Schiena triangolare (angolo ${a}°)`, m.schiena.larghezza, m.schiena.altezza, sS, 'schiena');
  if (ante) add(`Anta triangolare (angolo ${a}°, apertura a pressione)`, m.anta.larghezza, m.anta.altezza, sA, 'ante');
  return pz;
}

// ---------------------------------------------------------------------------
// Pezzi di UN modulo (rettangolare o inclinato)
// ---------------------------------------------------------------------------
/**
 * mod = { nome, larghezza L, hL, hR, ante N (0 = aperto), lato, ripiani }
 * Altezze = esterne del modulo ai due lati.
 */
export function pezziModulo(mod, P, sp = SPESSORI_DEFAULT) {
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS;
  const L = mod.larghezza, hL = mod.hL, hR = mod.hR;
  const dh = hL - hR;
  const inclinato = Math.abs(dh) >= 0.5;
  const alfa = Math.atan2(Math.abs(dh), L);
  const ang = r1(alfa * DEG);
  const tv = sC / Math.cos(alfa);                       // spessore verticale del top inclinato
  const pz = [];
  const add = (nome, larghezza, altezza, spessore, materiale, quantita = 1) => {
    if (quantita > 0) pz.push({ modulo: mod.nome, nome, larghezza: r0(larghezza), altezza: r0(altezza), spessore, materiale, quantita });
  };

  if (!inclinato) {
    add('Top / Fondo', L, Pc, sC, 'carcassa', 2);
    add('Fianco', Pc, hL - 2 * sC, sC, 'carcassa', 2);
    add('Schiena', L - 2, hL - 2, sS, 'schiena');
  } else {
    const altoSx = hL > hR;
    add('Fondo', L, Pc, sC, 'carcassa');
    add(`Top inclinato (testate tagliate a ${ang}°)`, Math.hypot(L, dh), Pc, sC, 'carcassa');
    // Fianco del lato alto: spigolo più alto sulla faccia esterna.
    // Fianco del lato basso: spigolo più alto sulla faccia interna.
    const hAlto = Math.max(hL, hR), hBasso = Math.min(hL, hR);
    const fiancoAlto = hAlto - tv - sC;
    const fiancoBasso = hBasso + sC * Math.tan(alfa) - tv - sC;
    add(`Fianco ${altoSx ? 'sinistro' : 'destro'} (lato alto, bordo alto inclinato ${ang}°)`, Pc, fiancoAlto, sC, 'carcassa');
    add(`Fianco ${altoSx ? 'destro' : 'sinistro'} (lato basso, bordo alto inclinato ${ang}°)`, Pc, fiancoBasso, sC, 'carcassa');
    add(`Schiena trapezio (lato basso ${r0(hBasso - 2)})`, L - 2, hAlto - 2, sS, 'schiena');
  }
  if (mod.ripiani > 0) add('Ripiano', L - 2 * sC, Pc, sC, 'carcassa', mod.ripiani);

  const N = Math.max(0, Math.round(mod.ante || 0));
  if (N > 0) {
    const la = (L - (N + 1) * 2) / N;
    // Altezza dell'anta = altezza del modulo in quel punto − 4 (come negli armadi)
    const hA = (x) => (hL + ((hR - hL) * x) / L) - 4;
    const conta = new Map();
    for (let i = 0; i < N; i++) {
      const xa = 2 + i * (la + 2), xb = xa + la;
      const a = hA(xa), b = hA(xb);
      const alta = Math.max(a, b), bassa = Math.min(a, b);
      const nome = !inclinato
        ? (N === 1 ? `Anta (apertura ${mod.lato === 'sx' ? 'sx' : 'dx'})` : 'Anta')
        : `Anta trapezio (lato basso ${r0(bassa)})`;
      const k = `${nome}|${r0(alta)}`;
      if (!conta.has(k)) conta.set(k, { nome, alta, q: 0 });
      conta.get(k).q++;
    }
    for (const { nome, alta, q } of conta.values()) add(nome, la, alta, sA, 'ante', q);
  }
  return pz;
}

// ---------------------------------------------------------------------------
// Modalità "CUBI LIBERI"
// ---------------------------------------------------------------------------
export function cubiSovrapposti(a, b) {
  return a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
}
export function cuboNelVano(forma, c) {
  return [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]]
    .every(([x, y]) => dentroPoligono(forma.punti, x, y));
}
/** Posizione valida? (dentro il vano e senza sovrapporsi agli altri) */
export function posizioneValida(forma, cubi, c) {
  if (c.w <= 0 || c.h <= 0) return false;
  if (!cuboNelVano(forma, c)) return false;
  return !cubi.some((o) => o.id !== c.id && cubiSovrapposti(o, c));
}
/** Primo posto libero per un cubo nuovo: dal basso, da sinistra. */
export function primoPostoLibero(forma, cubi, w, h) {
  const xs = [...new Set([0, ...cubi.map((c) => c.x + c.w), ...cubi.map((c) => c.x - w), forma.larghezza - w])].filter((x) => x >= -0.5).sort((a, b) => a - b);
  const ys = [...new Set([0, ...cubi.map((c) => c.y + c.h)])].sort((a, b) => a - b);
  for (const y of ys) for (const x of xs) {
    const c = { id: '__nuovo', x, y, w, h };
    if (posizioneValida(forma, cubi, c)) return { x, y };
  }
  return null;
}
/**
 * Aggancio magnetico mentre si trascina: allinea i bordi a pavimento, pareti
 * e altri cubi entro `soglia` mm, poi arrotonda a 10 mm.
 */
export function agganciaCubo(forma, cubi, c, soglia = 40) {
  const W = forma.larghezza;
  let { x, y } = c;
  const bx = [0, W], by = [0];
  for (const o of cubi) if (o.id !== c.id) { bx.push(o.x, o.x + o.w); by.push(o.y, o.y + o.h); }
  let best = soglia + 1;
  for (const e of bx) {
    for (const cand of [e, e - c.w]) if (Math.abs(cand - x) < best) { best = Math.abs(cand - x); x = cand; }
  }
  if (best > soglia) x = Math.round(c.x / 10) * 10;
  best = soglia + 1; let yy = y;
  for (const e of by) {
    for (const cand of [e, e - c.h]) if (Math.abs(cand - y) < best) { best = Math.abs(cand - y); yy = cand; }
  }
  y = best > soglia ? Math.round(c.y / 10) * 10 : yy;
  return { x, y: Math.max(0, y) };
}

// ---------------------------------------------------------------------------
// DISTINTA completa
// ---------------------------------------------------------------------------
export function distintaModulari(forma, stato) {
  const sp = { ...SPESSORI_DEFAULT, ...(stato.spessori || {}) };
  const P = stato.profondita || 600;
  const pezzi = [], errori = [], avvisi = [];
  let elementi = [], chiusura = null;
  if (stato.modalita === 'cubi') {
    const cubi = stato.cubi || [];
    cubi.forEach((c, i) => {
      if (!posizioneValida(forma, cubi, c)) errori.push(`Cubo ${i + 1}: è fuori dal vano o sopra un altro cubo.`);
      elementi.push({ nome: `Cubo ${i + 1}`, larghezza: c.w, hL: c.h, hR: c.h, ante: c.fronte === 'anta' ? 1 : 0, lato: c.lato || 'dx', ripiani: c.ripiani || 0 });
    });
  } else {
    const lay = layoutModuli(forma, stato.moduli || {}, sp);
    errori.push(...lay.errori); avvisi.push(...lay.avvisi);
    elementi = lay.moduli.map((m) => ({ ...m, nome: `Modulo ${m.indice + 1}` }));
    if (lay.chiusura) chiusura = lay.chiusura;
  }
  for (const e of elementi) pezzi.push(...pezziModulo(e, P, sp));
  if (chiusura) pezzi.push(...pezziChiusura(chiusura, P, sp));
  let mq = { carcassa: 0, schiena: 0, ante: 0 };
  let totale = 0;
  for (const p of pezzi) { mq[p.materiale] += (p.larghezza * p.altezza * p.quantita) / 1e6; totale += p.quantita; }
  return { pezzi, errori, avvisi, elementi: elementi.length + (chiusura ? 1 : 0), totalePezzi: totale, mq };
}
