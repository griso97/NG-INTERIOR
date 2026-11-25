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

import { parametri, spessoreTirador, nomeTirador, lunghezzaSulBordo, eTirador } from '../parametri.js?v=20261126w';
import { nomeFinituraManiglia } from '../finiture-maniglia.js?v=20261126w';

export const SPESSORI_DEFAULT = { carcassa: 18, schiena: 10, ante: 18 };
export const H_MINIMA_MODULO = 250;
// Pezzi da tagliare INCLINATI: si tagliano più lunghi e si rifilano in opera.
// Fianchi col bordo alto inclinato +20 mm, top inclinato +40 mm (può andare
// rifilato da tutte e due le parti). Fondo, ripiani, schiena e ante: giusti.
export const ABBONDANZA_DEFAULT = { fianchi: 20, top: 40, ante: 20 };
// Ante e pannelli fissi con il lato inclinato: +ante mm SUL LATO INCLINATO
// (muri e scale non sono mai dritti: si rifilano a filo in opera).
const fmtMm = (x) => String(Math.round(x));
export const MATERIALI_DEFAULT = { struttura: 'roble-hera', ante: 'roble-denver' };
/**
 * Finiture di un modulo/cubo: tutte uguali oppure (materiali.diversi) quelle
 * scelte per quel modulo. chiave: 'm0', 'm1'… (moduli), 'chiusura', 'c:<id>' (cubi).
 */
export function finitureDi(materiali, chiave) {
  const m = { ...MATERIALI_DEFAULT, ...(materiali || {}) };
  const per = (m.diversi && m.per && m.per[chiave]) || {};
  return { struttura: per.struttura || m.struttura, ante: per.ante || m.ante };
}        // sotto questa altezza non si mette un modulo
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
      ante: d.ante ?? 1, lato: d.lato || 'dx', apertura: aperturaDi(d.apertura), ripiani: Math.max(0, Math.round(d.ripiani ?? 1)), spigolo });
  });
  // Spazio rimasto verso il lato basso: lo chiude un modulo finale
  // (triangolare se il soffitto scende quasi a terra).
  const resto = W - pos;
  const fronte = ['fisso', 'anta', 'aperto', 'no'].includes(cfg.chiusura) ? cfg.chiusura : 'fisso';
  let chiusura = null;
  if (resto > 2 * sC + 20 && fronte !== 'no') {
    const xa = auto.daSinistra ? pos : 0, xb = auto.daSinistra ? W : resto;
    chiusura = geometriaChiusura({ x0: xa, x1: xb, hL: altezzaSoffitto(forma.punti, xa), hR: altezzaSoffitto(forma.punti, xb),
      daSinistra: auto.daSinistra, fronte, apertura: aperturaDi(cfg.chiusuraApertura) }, spessori);
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
  // Tamponamento FISSO: un pannello sul fronte, a filo delle ante, che non si apre
  const pann = sotto(2, L, 2, 2);
  const base = { ...c, larghezza: L, hAlto: hS, hBasso: hE, angolo: r1(alfa * DEG), dir, xT,
    pannello: { profilo: map(pann.pts), larghezza: pann.larghezza, altezza: pann.altezza, triangolo: pann.pts.length === 3 } };
  if (fiancoBasso >= 30 || hS - hE < 1) return { ...base, triangolare: false };

  const uf = uDove(sC);                           // il sopra del top tocca il fondo
  const uu = uDove(sC + tv);                      // il sotto del top tocca il fondo
  const top = [[0, yt(0) - tv], [uu, sC], [uf, sC]];
  if (uf >= L - 0.01 && yt(L) > sC + 0.5) top.push([L, yt(L)]);
  top.push([0, yt(0)]);
  const schiena = sotto(1, L - 1, 1, 1);
  const anta = sotto(2, L - 2, 2, 2);
  return {
    ...base, triangolare: true,
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
      // il top arriva al muro basso (testata verticale contro il muro) o si appoggia sul fondo
      topAlMuro: uf >= L - 0.01 && yt(L) > sC + 0.5, testataMuro: Math.max(0, yt(L) - sC),
      // triangolo (3 punti) o trapezio (4 punti: il muro basso taglia la punta) + lato basso
      schiena: { larghezza: schiena.larghezza, altezza: schiena.altezza, triangolo: schiena.pts.length === 3, bassa: schiena.pts.length === 3 ? 0 : schiena.pts[2][1] - 1 },
      anta: { larghezza: anta.larghezza, altezza: anta.altezza, triangolo: anta.pts.length === 3, bassa: anta.pts.length === 3 ? 0 : anta.pts[2][1] - 2 },
    },
  };
}

// ---------------------------------------------------------------------------
// Angoli di taglio (α = inclinazione della scala rispetto al pavimento)
// ---------------------------------------------------------------------------
// I fianchi stanno a piombo (90° col pavimento) e il top segue la scala:
// • BISELLO (lama inclinata, il taglio attraversa lo spessore): bordo alto dei
//   fianchi e testate del top → lama a α dal taglio dritto; tra la faccia del
//   pannello e il taglio restano 90°−α da un lato e 90°+α dall'altro.
// • SUL PIANO (pannello piatto, lama dritta): lato alto inclinato di schiena e
//   ante a trapezio → il lato alto forma α con l'orizzontale; angoli del
//   pannello 90°−α e 90°+α.
export const gradi = (x) => `${(Math.round(x * 10) / 10).toFixed(1).replace('.', ',')}°`;
const noteBisello = (a) => `lama inclinata ${gradi(a)} dal taglio dritto (tra faccia e taglio ${gradi(90 - a)} / ${gradi(90 + a)})`;
const notePiano = (a) => `lato alto inclinato ${gradi(a)} sul piano: angoli ${gradi(90 - a)} e ${gradi(90 + a)}`;

/**
 * Fronte (anta o pannello fisso) col lato inclinato, più grande di e mm sul
 * lato inclinato (spostato in su di e mm). Triangolo: cresce anche la base.
 */
function fronteInclinato(larghezza, altezza, a, e, triangolo, bassa = 0) {
  const ta = Math.tan((a * Math.PI) / 180);
  const L = triangolo && e > 0 && ta > 1e-6 ? larghezza + e / ta : larghezza;
  const H = altezza + e;
  const finito = triangolo ? `finito ${fmtMm(larghezza)} × ${fmtMm(altezza)} mm` : `finito ${fmtMm(larghezza)} × ${fmtMm(altezza)} mm (lato basso ${fmtMm(bassa)})`;
  const taglio = e > 0 ? ` · tagliato +${e} mm sul lato inclinato${triangolo ? '' : ` (lato basso ${fmtMm(bassa + e)})`}, rifilare a filo in opera` : '';
  const ang = triangolo ? `triangolo rettangolo: angolo di punta ${gradi(a)}, in alto ${gradi(90 - a)}` : notePiano(a);
  return { larghezza: L, altezza: H, note: `${finito}${taglio} · ${ang}` };
}

/** Cerniere per anta dall'altezza (stessa regola degli armadi: 2 fino a 90 cm, 3 fino a 160, 4 fino a 200, 5 fino a 240, poi 6). */
const cerniereAnta = (h) => (h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : h <= 2400 ? 5 : 6);

// ---------------------------------------------------------------------------
// MANIGLIE: le stesse di cucina e armadi (catalogo, anche quelle aggiunte in
// Impostazioni), una per tutto il mobile: stato.maniglia = { id, colore }.
// Ogni modulo / cubo con le ante sceglie «maniglia» o «push» (si preme e si apre).
// Tutte alla STESSA ALTEZZA da terra (⚙ Parametri → Mobili modulari, centro della
// maniglia); se l'anta non ci arriva (o parte più in alto), il più vicino possibile,
// sempre 4 cm dentro l'anta. Stessa regola per 3D, disegno e distinta.
// ---------------------------------------------------------------------------
const MANIGLIA_STANDARD = { id: 'maniglia-standard', nome: 'Maniglia standard (barra)', categoria: 'maniglia' };
/**
 * MANIGLIA di un modulo / cubo: dove sta (la posizione automatica si può spostare) o push:
 *  'auto'  (di partenza) di lato, sul bordo che apre, all'altezza standard; l'anta che non ci arriva
 *          (o parte più in alto) → push, così le maniglie sono tutte allineate
 *  'lato'  di lato anche sulle ante basse (il più vicino possibile all'altezza standard)
 *  'sopra' orizzontale sul bordo alto (sotto la scala segue l'inclinata), verso il lato che apre
 *  'sotto' orizzontale sul bordo basso, verso il lato che apre
 *  'push'  niente maniglia
 * Il tirador che toglie spessore (scheda della maniglia) lo toglie dal bordo dove sta.
 * (salvati prima: 'maniglia' = automatica, 'sempre' = di lato)
 */
export const aperturaDi = (v) => (['push', 'lato', 'sopra', 'sotto'].includes(v) ? v : v === 'sempre' ? 'lato' : 'auto');
/** Maniglia scelta per il mobile: { def (catalogo), colore (id finitura o null = il suo), hStd (mm da terra) }. */
export function manigliaModulari(stato) {
  const sc = (stato && stato.maniglia) || {};
  const cat = typeof window !== 'undefined' ? (window.NG_MATERIALI || []) : [];
  const trova = (id) => cat.find((m) => m.id === id && m.categoria === 'maniglia');
  const def = trova(sc.id || MANIGLIA_STANDARD.id) || trova(MANIGLIA_STANDARD.id) || MANIGLIA_STANDARD;
  return { def, colore: sc.colore || null, hStd: parametri().modulari.altezzaManiglia };
}
/** Spessore del tirador da togliere all'anta (scheda della maniglia: sottrai sì / no), dal bordo dove sta. */
export const riduzioneManigliaModulari = (def) => spessoreTirador(def);
const nomeRiduzione = (def) => nomeTirador(def);
/** Distanza della maniglia dal bordo che apre (come negli armadi). */
const bordoManiglia = (def) => (def.forma === 'bordol' ? 0 : ['profilo', 'bordo'].includes(def.forma) ? 17 : 40);
/**
 * Lunghezza su un bordo lungo h: quella del catalogo (la standard 30 cm), mai più lunga del bordo − 8 cm;
 * il TIRADOR (profilo sul bordo) più lungo del bordo è lungo come il bordo.
 */
export function lunghezzaManigliaModulare(def, h) {
  const Lc = def.texture && def.lunghezzaMm ? def.lunghezzaMm : 300;
  return Math.round(Math.max(40, lunghezzaSulBordo(def, Lc, h)));
}
/** Nome in distinta: «Maniglia standard (barra) · Nero opaco · 300 mm». */
export function nomeManigliaModulari(man, L) {
  const col = man.colore ? nomeFinituraManiglia(man.colore) : '';
  return `${/^(maniglia|pomolo|tirador)/i.test(man.def.nome || '') ? '' : 'Maniglia '}${man.def.nome}${col ? ` · ${col}` : ''} · ${L} mm`;
}
/**
 * ANTE di un modulo largo L (x da 0): N ante con 2 mm di fuga; maniglia a sinistra (manSx) o a
 * destra: 1 anta → dal lato scelto, 2 ante → verso il centro. rid = anta più stretta dal lato della maniglia.
 */
export function anteDelModulo(L, N, lato, rid = 0) {
  const la = (L - (N + 1) * 2) / N, out = [];
  for (let i = 0; i < N; i++) {
    const manSx = N === 1 ? lato === 'sx' : i === 1;
    let xa = 2 + i * (la + 2), xb = xa + la;
    if (manSx) xa += rid; else xb -= rid;
    out.push({ xa, xb, manSx });
  }
  return out;
}
/**
 * Dove sta la maniglia su un'anta: d = { xa, xb, manSx } (x vere), yBasso = sotto dell'anta,
 * yAlto(x) = sopra dell'anta in x (inclinato sotto la scala). Ritorna { x, y (centro), L }.
 */
export function manigliaSuAnta(man, d, yBasso, yAlto) {
  const dB = bordoManiglia(man.def);
  const x = d.manSx ? d.xa + dB : d.xb - dB;
  const top = yAlto(x);
  const L = lunghezzaManigliaModulare(man.def, top - yBasso);
  const m = Math.min(40, Math.max(0, (top - yBasso - L) / 2));     // 4 cm dai bordi; il tirador lungo come l'anta arriva ai bordi
  const lo = yBasso + m + L / 2, hi = top - m - L / 2;
  const y = hi < lo ? (yBasso + top) / 2 : Math.max(lo, Math.min(hi, man.hStd));
  // allineata: al centro dell'altezza standard; il tirador lungo basta che la copra
  const allineata = hi >= lo && (Math.abs(y - man.hStd) < 0.5 || (eTirador(man.def) && Math.abs(y - man.hStd) <= L / 2));
  return { x, y, L, allineata };
}
/**
 * ANTE di un modulo CON LA LORO MANIGLIA (o push), uguale per 3D, disegno e distinta.
 * x da 0 (fianco sinistro del modulo), y da terra: y0 = base del modulo, hL/hR = altezze ai due lati.
 * → [{ xa, xb, manSx, dSopra, dSotto, rid, maniglia: { x, y, L, verso: 'lato'|'sopra'|'sotto', angolo } | null }]
 *   xa..xb = larghezza dell'anta (già tolto lo spessore del tirador se è di lato), dSopra / dSotto = di quanto
 *   scendono il bordo alto / sale il bordo basso per il tirador sopra / sotto (sull'inclinata: spessore ÷ cos α)
 */
export function anteConManiglie(L, hL, hR, y0, N, lato, apertura, man) {
  const ap = aperturaDi(apertura);
  const k = (hR - hL) / L, cosA = 1 / Math.sqrt(1 + k * k);
  const top = (x) => y0 + hL + k * x - 2;                          // sopra dell'anta (2 mm d'aria)
  const yB = y0 + 2;
  const r = riduzioneManigliaModulari(man.def);
  return anteDelModulo(L, N, lato, 0).map((d) => {
    const vuota = { ...d, dSopra: 0, dSotto: 0, rid: 0, maniglia: null };
    if (ap === 'push') return vuota;
    if (ap === 'auto' || ap === 'lato') {
      const p = manigliaSuAnta(man, d, yB, top);
      if (ap === 'auto' && !p.allineata) return vuota;               // l'anta non arriva all'altezza standard
      if (!r) return { ...vuota, maniglia: { ...p, verso: 'lato', angolo: 0 } };
      const dd = { ...d, xa: d.manSx ? d.xa + r : d.xa, xb: d.manSx ? d.xb : d.xb - r };
      return { ...vuota, ...dd, rid: r, maniglia: { ...manigliaSuAnta(man, dd, yB, top), verso: 'lato', angolo: 0 } };
    }
    // SOPRA / SOTTO: orizzontale lungo il bordo, verso il lato che apre (2 ante: verso il centro)
    const dSopra = ap === 'sopra' ? r / cosA : 0, dSotto = ap === 'sotto' ? r : 0;
    const w = d.xb - d.xa, Lm = lunghezzaManigliaModulare(man.def, w);
    const mm = Math.min(40, Math.max(0, (w - Lm) / 2));             // il tirador largo come l'anta arriva ai bordi
    const x = d.manSx ? d.xa + mm + Lm / 2 : d.xb - mm - Lm / 2;
    const dB = bordoManiglia(man.def);
    const y = ap === 'sopra'
      ? Math.max(yB + dSotto + 20, top(x) - dSopra - dB / cosA)
      : Math.min(top(x) - dSopra - 20, yB + dSotto + dB);
    return { ...vuota, dSopra, dSotto, rid: r, maniglia: { x, y, L: Lm, verso: ap, angolo: ap === 'sopra' ? Math.atan(k) : 0 } };
  });
}
const accessorio = (modulo, nome, quantita, extra = {}) => ({ modulo, nome, larghezza: null, altezza: null, spessore: null, materiale: 'accessorio', quantita, ...extra });

/** Pezzi del modulo di chiusura. */
export function pezziChiusura(ch, P, sp = SPESSORI_DEFAULT, abb = ABBONDANZA_DEFAULT, man = manigliaModulari(null)) {
  const a = ch.angolo;
  if (ch.fronte === 'fisso') {
    const pn = ch.pannello;
    const bassa = pn.triangolo ? 0 : pn.profilo[2][1] - 2;
    const f = fronteInclinato(pn.larghezza, pn.altezza, a, abb.ante, pn.triangolo, bassa);
    return [{ modulo: 'Chiusura in fondo', nome: `Tamponamento fisso ${pn.triangolo ? 'triangolare' : 'a trapezio'}`,
      note: `${f.note} · fissato al fianco del modulo vicino e al muro`, parte: 'pannello', abbondanza: abb.ante, angolo: a,
      larghezza: r0(f.larghezza), altezza: r0(f.altezza), spessore: sp.ante, materiale: 'ante', quantita: 1 }];
  }
  const ante = ch.fronte === 'anta' ? 1 : 0;
  const lato = ch.daSinistra ? 'dx' : 'sx';      // cerniere dal lato alto
  if (!ch.triangolare) {
    return pezziModulo({ nome: 'Chiusura in fondo', larghezza: ch.larghezza, hL: ch.hL, hR: ch.hR, ante, lato, apertura: ch.apertura, ripiani: 0 }, P, sp, abb, man);
  }
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS;
  const m = ch.misure;
  const pz = [];
  const add = (nome, larghezza, altezza, spessore, materiale, extra = {}) =>
    pz.push({ modulo: 'Chiusura triangolare', nome, larghezza: r0(larghezza), altezza: r0(altezza), spessore, materiale, quantita: 1, ...extra });
  add('Fondo', m.fondo, Pc, sC, 'carcassa');
  add('Top inclinato', m.top + abb.top, Pc, sC, 'carcassa', { parte: 'top', abbondanza: abb.top, angolo: a,
    note: `finito ${fmtMm(m.top)} mm, tagliato +${abb.top} da rifilare · testata alta: ${noteBisello(a)} · ${m.topAlMuro
      ? `testata bassa verticale contro il muro (alta ${fmtMm(m.testataMuro)} mm)`
      : `testata bassa orizzontale, in appoggio sul fondo: lama ${gradi(90 - a)} (punta a ${gradi(a)})`}` });
  add('Fianco lato alto', Pc, m.fianco + abb.fianchi, sC, 'carcassa', { parte: 'fianco', abbondanza: abb.fianchi, angolo: a,
    note: `finito ${fmtMm(m.fianco)} mm, tagliato +${abb.fianchi} da rifilare · bordo alto: ${noteBisello(a)}` });
  if (m.schiena.triangolo) add('Schiena triangolare', m.schiena.larghezza, m.schiena.altezza, sS, 'schiena', { note: `triangolo rettangolo: angolo di punta ${gradi(a)}, in alto ${gradi(90 - a)}` });
  else add('Schiena a trapezio', m.schiena.larghezza, m.schiena.altezza, sS, 'schiena', { note: `lato basso ${r0(m.schiena.bassa)} mm · ${notePiano(a)}` });
  if (ante) {
    const tri = m.anta.triangolo;
    const f = fronteInclinato(m.anta.larghezza, m.anta.altezza, a, abb.ante, tri, m.anta.bassa);
    const lato = ch.daSinistra ? 'sinistra' : 'destra';
    add(`Anta ${tri ? 'triangolare' : 'a trapezio'} (apertura a pressione) · cerniere sul lato alto (${lato})`, f.larghezza, f.altezza, sA, 'ante', { note: f.note, parte: 'anta', abbondanza: abb.ante, angolo: a });
    pz.push(accessorio('Chiusura triangolare', 'Cerniere per anta', cerniereAnta(m.anta.altezza)));
    pz.push(accessorio('Chiusura triangolare', 'Push pull', 1));
    pz.push(accessorio('Chiusura triangolare', 'Push pull · base', 1));
  }
  return pz;
}
export function pezziModulo(mod, P, sp = SPESSORI_DEFAULT, abb = ABBONDANZA_DEFAULT, man = manigliaModulari(null)) {
  const sC = sp.carcassa, sS = sp.schiena, sA = sp.ante;
  const Pc = P - sA - sS;
  const L = mod.larghezza, hL = mod.hL, hR = mod.hR;
  const dh = hL - hR;
  const inclinato = Math.abs(dh) >= 0.5;
  const alfa = Math.atan2(Math.abs(dh), L);
  const ang = r1(alfa * DEG);
  const tv = sC / Math.cos(alfa);                       // spessore verticale del top inclinato
  const pz = [];
  const add = (nome, larghezza, altezza, spessore, materiale, quantita = 1, extra = {}) => {
    if (quantita > 0) pz.push({ modulo: mod.nome, nome, larghezza: r0(larghezza), altezza: r0(altezza), spessore, materiale, quantita, ...extra });
  };

  if (!inclinato) {
    add('Top / Fondo', L, Pc, sC, 'carcassa', 2);
    add('Fianco', Pc, hL - 2 * sC, sC, 'carcassa', 2);
    add('Schiena', L - 2, hL - 2, sS, 'schiena');
  } else {
    const altoSx = hL > hR;
    add('Fondo', L, Pc, sC, 'carcassa');
    const lTop = Math.hypot(L, dh);
    add('Top inclinato', lTop + abb.top, Pc, sC, 'carcassa', 1, { parte: 'top', abbondanza: abb.top, angolo: ang,
      note: `finito ${fmtMm(lTop)} mm, tagliato +${abb.top} da rifilare · testate parallele, ${noteBisello(ang)}: vanno a filo esterno dei fianchi` });
    // Fianco del lato alto: spigolo più alto sulla faccia esterna.
    // Fianco del lato basso: spigolo più alto sulla faccia interna.
    const hAlto = Math.max(hL, hR), hBasso = Math.min(hL, hR);
    const fiancoAlto = hAlto - tv - sC;
    const fiancoBasso = hBasso + sC * Math.tan(alfa) - tv - sC;
    add(`Fianco ${altoSx ? 'sinistro' : 'destro'} (lato alto)`, Pc, fiancoAlto + abb.fianchi, sC, 'carcassa', 1, { parte: 'fianco', abbondanza: abb.fianchi, angolo: ang,
      note: `finito ${fmtMm(fiancoAlto)} mm (spigolo più alto, faccia esterna), tagliato +${abb.fianchi} da rifilare · bordo alto: ${noteBisello(ang)}` });
    add(`Fianco ${altoSx ? 'destro' : 'sinistro'} (lato basso)`, Pc, fiancoBasso + abb.fianchi, sC, 'carcassa', 1, { parte: 'fianco', abbondanza: abb.fianchi, angolo: ang,
      note: `finito ${fmtMm(fiancoBasso)} mm (spigolo più alto, faccia interna), tagliato +${abb.fianchi} da rifilare · bordo alto: ${noteBisello(ang)}` });
    add('Schiena trapezio', L - 2, hAlto - 2, sS, 'schiena', 1, { note: `lato basso ${r0(hBasso - 2)} mm · ${notePiano(ang)}` });
  }
  if (mod.ripiani > 0) add('Ripiano', L - 2 * sC, Pc, sC, 'carcassa', mod.ripiani);

  const N = Math.max(0, Math.round(mod.ante || 0));
  if (N > 0) {
    // ogni anta con la sua maniglia o push (come nel 3D); con il profilo sul bordo l'anta è più stretta
    // dal lato della maniglia
    const hA = (x) => (hL + ((hR - hL) * x) / L) - 4;     // altezza dell'anta = modulo − 4 (come negli armadi)
    const conta = new Map(), maniglie = new Map();
    let cerniere = 0, push = 0;
    for (const d of anteConManiglie(L, hL, hR, mod.y0 || 0, N, mod.lato, mod.apertura, man)) {
      const { xa, xb } = d, la = xb - xa;
      const a = hA(xa) - d.dSopra - d.dSotto, b = hA(xb) - d.dSopra - d.dSotto;
      const alta = Math.max(a, b), bassa = Math.min(a, b);
      // cerniere come nel 3D: dal lato opposto alla maniglia (1 anta → lato scelto; 2 ante → maniglie al centro)
      const cerDx = d.manSx;
      const latoCer = cerDx ? 'destra' : 'sinistra';
      const dove = d.maniglia ? ({ lato: 'di lato', sopra: 'sopra', sotto: 'sotto' })[d.maniglia.verso] : '';
      const suff = d.rid ? ` · ${nomeRiduzione(man.def)} (−${d.rid} mm ${dove})` : '';
      const nome = (!inclinato
        ? (N === 1 ? `Anta (apertura ${mod.lato === 'sx' ? 'sx' : 'dx'})` : `Anta · cerniere a ${latoCer}`)
        : `Anta trapezio · cerniere a ${latoCer} (lato ${cerDx === (hR > hL) ? 'alto' : 'basso'})`) + suff;
      cerniere += cerniereAnta(alta);
      if (d.maniglia) maniglie.set(d.maniglia.L, (maniglie.get(d.maniglia.L) || 0) + 1);
      else push++;
      const f = inclinato ? fronteInclinato(la, alta, ang, abb.ante, false, bassa) : null;
      const k = `${nome}|${r0(la)}|${r0(alta)}|${f ? f.note : ''}`;
      if (!conta.has(k)) conta.set(k, { nome, la, alta, f, q: 0 });
      conta.get(k).q++;
    }
    for (const { nome, la, alta, f, q } of conta.values()) {
      if (f) add(nome, f.larghezza, f.altezza, sA, 'ante', q, { note: f.note, parte: 'anta', abbondanza: abb.ante, angolo: ang });
      else add(nome, la, alta, sA, 'ante', q);
    }
    // ferramenta che si vede nel 3D: cerniere e maniglie (o il push: un push pull e la sua base per anta)
    pz.push(accessorio(mod.nome, 'Cerniere per anta', cerniere));
    if (push) {
      pz.push(accessorio(mod.nome, 'Push pull', push));
      pz.push(accessorio(mod.nome, 'Push pull · base', push));
    }
    for (const [lm, q] of maniglie) pz.push(accessorio(mod.nome, nomeManigliaModulari(man, lm), q));
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

/**
 * Cubi pronti per disegno/distinta. Con `adatta` attivo, un cubo che sta sotto
 * un soffitto INCLINATO e non ha niente sopra sale fino al soffitto: diventa un
 * mobile con il top inclinato (hL ≠ hR), così copre tutto sotto la scala.
 * Se resta la punta bassa in fondo, la chiude il modulo di chiusura.
 */
export function layoutCubi(forma, stato, sp = SPESSORI_DEFAULT) {
  const cubi = stato.cubi || [];
  const adatta = stato.cubiAdatta !== false;
  const elementi = cubi.map((c) => {
    const e = { id: c.id, x0: c.x, y0: c.y, L: c.w, hL: c.h, hR: c.h, adattato: false };
    if (!adatta || c.adatta === false) return e;
    const x1 = c.x + c.w, top = c.y + c.h;
    const sL = altezzaSoffitto(forma.punti, c.x), sR = altezzaSoffitto(forma.punti, x1);
    if (Math.abs(sL - sR) < 1) return e;                          // soffitto piano: resta com'è
    const sopra = cubi.some((o) => o.id !== c.id && o.x < x1 - 0.5 && c.x < o.x + o.w - 0.5 && o.y >= top - 0.5);
    if (sopra) return e;
    const hL = sL - c.y, hR = sR - c.y;
    if (Math.min(hL, hR) < c.h - 0.5 || Math.max(hL, hR) - c.h < 1) return e;   // fuori o già a filo
    return { ...e, hL, hR, adattato: true };
  });
  // Punta bassa in fondo (solo se lì il soffitto scende sotto l'altezza minima)
  let chiusura = null;
  const fronte = ['fisso', 'anta', 'aperto', 'no'].includes(stato.cubiChiusura) ? stato.cubiChiusura : 'fisso';
  if (adatta && fronte !== 'no' && cubi.length) {
    const W = forma.larghezza;
    const { daSinistra } = larghezzaUtileAuto(forma);
    const aTerra = cubi.filter((c) => c.y < 0.5);
    if (aTerra.length) {
      const xa = daSinistra ? Math.max(...aTerra.map((c) => c.x + c.w)) : 0;
      const xb = daSinistra ? W : Math.min(...aTerra.map((c) => c.x));
      const libero = !cubi.some((c) => c.x < xb - 0.5 && xa < c.x + c.w - 0.5);
      const hA = altezzaSoffitto(forma.punti, xa), hB = altezzaSoffitto(forma.punti, xb);
      const hFine = daSinistra ? hB : hA;
      if (libero && xb - xa > 2 * sp.carcassa + 20 && hFine < H_MINIMA_MODULO && Math.abs(hA - hB) >= 1) {
        chiusura = geometriaChiusura({ x0: xa, x1: xb, hL: hA, hR: hB, daSinistra, fronte, apertura: aperturaDi(stato.cubiChiusuraApertura) }, sp);
      }
    }
  }
  return { elementi, chiusura };
}

/** Abbondanza dei tagli inclinati scelta dall'utente (mm, ≥ 0). */
export function abbondanzaDi(stato) {
  const a = { ...ABBONDANZA_DEFAULT, ...((stato && stato.abbondanza) || {}) };
  const ok = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : d);
  return { fianchi: ok(a.fianchi, ABBONDANZA_DEFAULT.fianchi), top: ok(a.top, ABBONDANZA_DEFAULT.top), ante: ok(a.ante, ABBONDANZA_DEFAULT.ante) };
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
    const lc = layoutCubi(forma, stato, sp);
    cubi.forEach((c, i) => {
      if (!posizioneValida(forma, cubi, c)) errori.push(`Cubo ${i + 1}: è fuori dal vano o sopra un altro cubo.`);
      const e = lc.elementi[i];
      elementi.push({ chiave: `c:${c.id}`, nome: `Cubo ${i + 1}${e.adattato ? ' (inclinato)' : ''}`, larghezza: c.w, hL: e.hL, hR: e.hR, ante: c.fronte === 'anta' ? 1 : 0, lato: c.lato || 'dx', apertura: aperturaDi(c.apertura), y0: c.y, ripiani: c.ripiani || 0 });
    });
    chiusura = lc.chiusura;
  } else {
    const lay = layoutModuli(forma, stato.moduli || {}, sp);
    errori.push(...lay.errori); avvisi.push(...lay.avvisi);
    elementi = lay.moduli.map((m) => ({ ...m, chiave: `m${m.indice}`, nome: `Modulo ${m.indice + 1}` }));
    if (lay.chiusura) chiusura = lay.chiusura;
  }
  // ogni pezzo con la sua finitura (id): ante → finitura ante, il resto → struttura
  const conFinitura = (pz, chiave) => pz.map((p) => (p.materiale === 'accessorio' ? p : { ...p, finitura: finitureDi(stato.materiali, chiave)[p.materiale === 'ante' ? 'ante' : 'struttura'] }));
  const abb = abbondanzaDi(stato);
  const man = manigliaModulari(stato);
  for (const e of elementi) pezzi.push(...conFinitura(pezziModulo(e, P, sp, abb, man), e.chiave));
  if (chiusura) pezzi.push(...conFinitura(pezziChiusura(chiusura, P, sp, abb, man), 'chiusura'));
  let mq = { carcassa: 0, schiena: 0, ante: 0 };
  let totale = 0;
  for (const p of pezzi) { if (!(p.materiale in mq)) continue; mq[p.materiale] += (p.larghezza * p.altezza * p.quantita) / 1e6; totale += p.quantita; }
  // Avviso: per ogni modulo inclinato quali pezzi sono più lunghi e di quanto
  const perMod = new Map();
  for (const p of pezzi) {
    if (!p.abbondanza) continue;
    if (!perMod.has(p.modulo)) perMod.set(p.modulo, { modulo: p.modulo, fianchi: 0, abbFianchi: 0, top: 0, abbTop: 0, ante: 0, pannelli: 0, abbAnte: 0, angolo: p.angolo });
    const r = perMod.get(p.modulo);
    if (p.parte === 'fianco') { r.fianchi += p.quantita; r.abbFianchi = p.abbondanza; }
    else if (p.parte === 'top') { r.top += p.quantita; r.abbTop = p.abbondanza; }
    else if (p.parte === 'anta') { r.ante += p.quantita; r.abbAnte = p.abbondanza; }
    else if (p.parte === 'pannello') { r.pannelli += p.quantita; r.abbAnte = p.abbondanza; }
  }
  return { pezzi, errori, avvisi, elementi: elementi.length + (chiusura ? 1 : 0), totalePezzi: totale, mq, tagliInclinati: [...perMod.values()] };
}
