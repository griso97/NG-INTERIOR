// =============================================================================
// SCHEMI DELLA CUCINA per la configurazione guidata e i ⚙ Parametri (non in scala: gli spessori sono
// ingranditi perché si vedano)
//   svgGola(spazio)                → visto DI LATO: piano, profilo L, cassetti, profilo C, spazio per le dita
//   svgRegletta(vista, spessore)   → visto DA SOPRA: l'angolo di una cucina a L con i due pezzi della regletta
// =============================================================================
import { svgAnteInterne } from './disegni-montaggio.js?v=20261124u';
const t = (s) => (typeof window !== 'undefined' && window.NGI18N ? window.NGI18N.t(s) : s);
const C = { piano: '#2a2a2c', fianco: '#8d939b', anta: '#e8dcc0', profilo: '#4b4f55', testo: '#e6dcc6', dim: '#e8c25a', muro: '#5a5246', reg: '#e8c25a', cieco: '#cdbf9f' };
const txt = (x, y, s, opz = '') => `<text x="${x}" y="${y}" ${/fill=/.test(opz) ? '' : `fill="${C.testo}"`} ${/font-size=/.test(opz) ? '' : 'font-size="10"'} font-family="sans-serif" ${opz}>${s}</text>`;
const rect = (x, y, w, h, col, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" stroke="#14110d" stroke-width="0.8" ${extra}/>`;
const f = (n) => String(Math.round(Number(n) * 10) / 10);

/** Mobile basso con la gola, visto di lato (sezione): 3 cassetti, profilo L sotto il piano e C fra i cassetti. */
export function svgGola(spazio = 25) {
  const x0 = 70, top = 24, G = 15, fr = 40, xF = x0 + 120;     // xF = fronte (frontali)
  const pezzi = [];
  // piano e fianco del mobile
  pezzi.push(rect(x0 - 6, top - 12, 150, 12, C.piano), txt(x0 + 60, top - 3, t('piano'), 'text-anchor="middle" fill="#cfc6b3" font-size="9"'));
  pezzi.push(rect(x0, top, xF - x0, 190, C.fianco), txt(x0 + 56, top + 100, t('fianco'), 'text-anchor="middle" fill="#14110d" font-size="9"'));
  pezzi.push(rect(x0, top + 190, 104, 22, '#3a3632'), txt(x0 + 52, top + 205, t('zoccolo'), 'text-anchor="middle" fill="#cfc6b3" font-size="8"'));
  // profilo L sotto il piano (entra nel fianco fresato)
  const L = (y) => `<path d="M${xF - 14} ${y} V${y + G + 6} H${xF - 2}" fill="none" stroke="${C.profilo}" stroke-width="4"/>`;
  const Cp = (y) => `<path d="M${xF - 2} ${y - 2} H${xF - 14} V${y + G + 2} H${xF - 2}" fill="none" stroke="${C.profilo}" stroke-width="4"/>`;
  pezzi.push(rect(xF - 16, top, 16, G + 8, '#14110d', 'stroke="none" opacity=".55"'), L(top));
  // tre cassetti con lo spazio G fra l'uno e l'altro (profilo C)
  let y = top + G;
  for (let k = 0; k < 3; k++) {
    pezzi.push(rect(xF, y, 9, fr + (k === 2 ? 10 : 0), C.anta));
    y += fr + (k === 2 ? 10 : 0);
    if (k < 2) { pezzi.push(rect(xF - 16, y, 16, G, '#14110d', 'stroke="none" opacity=".55"'), Cp(y)); y += G; }
  }
  // quote: spazio per le dita
  const q = (y1, y2, et) => `<line x1="${xF + 16}" y1="${y1}" x2="${xF + 16}" y2="${y2}" stroke="${C.dim}" stroke-width="1"/>`
    + `<line x1="${xF + 12}" y1="${y1}" x2="${xF + 20}" y2="${y1}" stroke="${C.dim}"/><line x1="${xF + 12}" y1="${y2}" x2="${xF + 20}" y2="${y2}" stroke="${C.dim}"/>`
    + txt(xF + 24, (y1 + y2) / 2 + 3, et, `fill="${C.dim}" font-size="9"`);
  pezzi.push(q(top, top + G, `${f(spazio)} mm`));
  pezzi.push(q(top + G + fr, top + 2 * G + fr, `${f(spazio)} mm`));
  pezzi.push(txt(x0 - 8, top + 12, t('profilo L'), 'text-anchor="end" font-size="9"'), `<line x1="${x0 - 6}" y1="${top + 9}" x2="${xF - 14}" y2="${top + 9}" stroke="#b8ad97" stroke-width=".6" stroke-dasharray="2 2"/>`);
  pezzi.push(txt(x0 - 8, top + G + fr + 12, t('profilo C'), 'text-anchor="end" font-size="9"'), `<line x1="${x0 - 6}" y1="${top + G + fr + 9}" x2="${xF - 14}" y2="${top + G + fr + 9}" stroke="#b8ad97" stroke-width=".6" stroke-dasharray="2 2"/>`);
  pezzi.push(txt(xF + 24, top + G + fr / 2 + 3, t('cassetto'), 'font-size="9"'));
  pezzi.push(txt(150, 252, t('vista di lato'), 'text-anchor="middle" fill="#b8ad97"'));
  return `<svg viewBox="0 0 300 262" width="300" height="262" role="img" aria-label="${t('Gola vista di lato')}">${pezzi.join('')}</svg>`;
}

/**
 * Angolo di una cucina a L visto DA SOPRA. Fila A lungo il muro in alto (il mobile cieco passa
 * nell'angolo), fila B lungo il muro a sinistra, davanti alla parte cieca. La regletta a L chiude lo
 * spazio fra le due file: pezzo LUNGO sul fronte del mobile cieco (vista + spessore anta: i primi mm
 * stanno dietro al pezzo corto), pezzo CORTO girato, a filo delle ante della fila B (quanto si vede).
 */
export function svgRegletta(vista = 30, spessore = 18) {
  const M = 14, D = 74, A = 9, R = 26;               // muro, profondità mobile, spessore anta, regletta (px, non in scala)
  const xM = 30, yM = 22;                             // spigolo interno dei muri
  const yFA = yM + D, xFB = xM + D;                   // fronte struttura fila A (y) e fila B (x)
  const p = [];
  // muri
  p.push(`<rect x="${xM - M}" y="${yM - M}" width="${280 - xM + M}" height="${M}" fill="${C.muro}"/>`, `<rect x="${xM - M}" y="${yM - M}" width="${M}" height="${250 - yM + M}" fill="${C.muro}"/>`);
  p.push(txt(170, yM - 4, t('muro'), 'text-anchor="middle" fill="#cfc6b3" font-size="8"'));
  // FILA A: mobile cieco (struttura) + pannello cieco + ante che si aprono
  p.push(rect(xM, yM, 250 - xM, D, C.fianco), txt(xM + 150, yM + 40, t('mobile cieco (fila A)'), 'text-anchor="middle" fill="#14110d" font-size="9"'));
  p.push(rect(xM, yFA, xFB + A - xM, A, C.cieco), txt(xM + 4, yFA + 20, t('pannello cieco'), 'fill="#cfc6b3" font-size="8"'));
  p.push(rect(xFB + A + R, yFA, 250 - (xFB + A + R), A, C.anta), txt(xFB + A + R + 40, yFA + 20, t('anta che si apre'), 'fill="#cfc6b3" font-size="8"'));
  // FILA B: mobile davanti alla parte cieca, staccato di R (la regletta)
  const yB = yFA + A + R;
  p.push(rect(xM, yB, D, 250 - yB, C.fianco), txt(xM + D / 2, yB + 60, t('fila B'), 'text-anchor="middle" fill="#14110d" font-size="9"'));
  p.push(rect(xFB, yB, A, 250 - yB, C.anta));
  // REGLETTA: pezzo lungo (sul fronte del cieco, da dietro l'anta di B) e pezzo corto (a filo delle ante di B)
  p.push(rect(xFB, yFA, A + R, A, C.reg));
  p.push(rect(xFB, yFA + A, A, R, '#f6e2a0'));
  // quote
  const qx = (x1, x2, y, et) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${C.dim}"/><line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}" stroke="${C.dim}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}" stroke="${C.dim}"/>` + txt((x1 + x2) / 2, y - 5, et, `text-anchor="middle" fill="${C.dim}" font-size="9"`);
  const qy = (y1, y2, x, et) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${C.dim}"/><line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}" stroke="${C.dim}"/><line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}" stroke="${C.dim}"/>` + txt(x + 6, (y1 + y2) / 2 + 3, et, `fill="${C.dim}" font-size="9"`);
  p.push(qx(xFB, xFB + A + R, yFA - 6, `${t('lungo')} ${f(vista)} + ${f(spessore)} = ${f(vista + spessore)}`));
  p.push(qy(yFA + A, yFA + A + R, xFB + A + 6, `${t('corto')} ${f(vista)}`));
  p.push(txt(150, 268, t('vista da sopra'), 'text-anchor="middle" fill="#b8ad97"'));
  return `<svg viewBox="0 0 290 276" width="290" height="276" role="img" aria-label="${t("Regletta d'angolo vista da sopra")}">${p.join('')}</svg>`;
}

// =============================================================================
// ALTRI SCHEMI DEI ⚙ PARAMETRI (guida iniziale e Impostazioni → Parametri)
// =============================================================================
const badge = (x, y, n) => `<circle cx="${x}" cy="${y}" r="8" fill="${C.dim}"/>` + txt(x, y + 3.5, n, 'text-anchor="middle" fill="#14110d" font-size="10" font-weight="700"');
const riga = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.dim}" stroke-width="1"/>`;
const leg = (y, n, s) => badge(18, y - 3.5, n) + txt(32, y, s, 'font-size="10.5"');

/** ARIA DELLE ANTE E DEI FRONTALI (vista davanti): ① sopra+sotto ② ai lati ③ fra le ante ④ fra i cassetti. */
export function svgAriaAnte(A = {}) {
  const aH = Number(A.ariaAltezza) || 0, aL = Number(A.ariaLarghezza) || 0, aT = Number(A.ariaTraAnte) || 0, aC = Number(A.ariaCassetti) || 0;
  const p = [];
  // mobile con 2 ante (aria ingrandita perché si veda)
  const x1 = 34, y1 = 26, W = 128, H = 168, g = 4, gm = 6;
  p.push(rect(x1, y1, W, H, '#2a2620', `stroke="${C.fianco}"`));
  const wa = (W - 2 * g - gm) / 2;
  p.push(rect(x1 + g, y1 + g, wa, H - 2 * g, C.anta), rect(x1 + g + wa + gm, y1 + g, wa, H - 2 * g, C.anta));
  // ① sopra ogni anta (a sinistra e a destra), non in mezzo: lì c'è l'aria fra le due ante (③)
  for (const cx of [x1 + g + wa / 2, x1 + g + wa + gm + wa / 2]) p.push(badge(cx, y1 - 9, '1'), riga(cx, y1 - 1, cx, y1 + g));
  p.push(badge(x1 - 14, y1 + H / 2, '2'), riga(x1 - 6, y1 + H / 2, x1 + g / 2, y1 + H / 2));
  p.push(badge(x1 + W / 2, y1 + H / 2, '3'));
  // mobile con 3 cassetti
  const x2 = 190, fr = (H - 4 * gm) / 3;
  p.push(rect(x2, y1, W, H, '#2a2620', `stroke="${C.fianco}"`));
  for (let k = 0; k < 3; k++) p.push(rect(x2 + g, y1 + gm + k * (fr + gm), W - 2 * g, fr, C.anta));
  p.push(badge(x2 + W + 14, y1 + gm + fr + gm / 2, '4'), riga(x2 + W - g, y1 + gm + fr + gm / 2, x2 + W + 6, y1 + gm + fr + gm / 2));
  // legenda con i numeri veri
  const f1 = (n) => f(n).replace('.', ',');
  p.push(leg(222, '1', `${t('sopra + sotto')}: ${f1(aH)} mm → ${t('anta da 700')} = ${f1(700 - aH)} mm`));
  p.push(leg(240, '2', `${t('ai lati (insieme)')}: ${f1(aL)} mm → ${t('modulo 600, 1 anta')} = ${f1(600 - aL)} mm`));
  p.push(leg(258, '3', `${t('fra le due ante')}: ${f1(aT)} mm → ${t('2 ante da')} ${f1((600 - aL - aT) / 2)} mm`));
  p.push(leg(276, '4', `${t('fra un frontale e l\'altro (e sopra e sotto)')}: ${f1(aC)} mm`));
  return `<svg viewBox="0 0 352 288" width="352" height="288" role="img" aria-label="${t('Aria delle ante vista davanti')}">${p.join('')}</svg>`;
}

/** PIEDINI DELLA CUCINA (vista di lato): l'altezza dello zoccolo = l'altezza dei piedini. */
export function svgPiedini(piedini = 0) {
  const hz = piedini === 150 ? 44 : 30, yP = 196, yM = yP - hz, p = [];
  p.push(`<rect x="10" y="${yP}" width="230" height="4" fill="${C.muro}"/>`, txt(40, yP + 15, t('pavimento'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  p.push(rect(40, 30, 150, 12, C.piano), txt(115, 39, t('piano'), 'text-anchor="middle" fill="#cfc6b3" font-size="9"'));
  p.push(rect(44, 42, 136, yM - 42, C.fianco), txt(112, (42 + yM) / 2 + 3, t('mobile basso'), 'text-anchor="middle" fill="#14110d" font-size="10"'));
  p.push(rect(180, 44, 8, yM - 46, C.anta));
  // piedini e zoccolo (arretrato)
  for (const x of [56, 150]) p.push(`<rect x="${x}" y="${yM}" width="12" height="${hz}" fill="#3a3632" stroke="#14110d"/>`);
  p.push(rect(168, yM + 2, 6, hz - 2, '#55504a'), txt(171, yP + 15, t('zoccolo'), 'text-anchor="middle" fill="#cfc6b3" font-size="9"'), riga(171, yP + 5, 171, yP - 4));
  p.push(riga(205, yM, 205, yP), riga(200, yM, 210, yM), riga(200, yP, 210, yP));
  p.push(txt(214, (yM + yP) / 2 + 3, piedini ? `${piedini / 10} cm` : t('10 o 15 cm'), `fill="${C.dim}" font-size="10"`));
  p.push(txt(125, yP + 30, piedini ? t('lo zoccolo è alto quanto i piedini') : t('automatico: bassi da 70 → 15 cm, da 80 → 10 cm'), 'text-anchor="middle" fill="#b8ad97" font-size="9.5"'));
  return `<svg viewBox="0 0 250 236" width="250" height="236" role="img" aria-label="${t('Piedini e zoccolo vista di lato')}">${p.join('')}</svg>`;
}

/** MANIGLIA A J (sezione di lato del bordo alto dell'anta): il profilo sta sopra l'anta, che si accorcia del suo spessore. */
export function svgManigliaJ(sp = 2, aH = 2) {
  const p = [], xA = 120, wA = 18, yTop = 70, s = 8;          // anta e spessore del profilo (ingranditi)
  p.push(rect(xA, yTop + s, wA, 150, C.anta), txt(xA + wA + 8, yTop + 110, t('anta'), 'font-size="10"'));
  // profilo a J: appoggiato SUL bordo alto dell'anta (spessore s), con il labbro che SCENDE dietro l'anta
  // e si piega verso di lei: fra il labbro e l'anta c'è lo spazio per le dita
  p.push(`<rect x="${xA}" y="${yTop}" width="${wA}" height="${s}" fill="#c3c5c8" stroke="#14110d" stroke-width=".8"/>`);
  p.push(`<path d="M${xA + 2} ${yTop + s / 2} H${xA - 24} V${yTop + 34} Q${xA - 24} ${yTop + 42} ${xA - 16} ${yTop + 42}" fill="none" stroke="#c3c5c8" stroke-width="4" stroke-linejoin="round"/>`);
  p.push(txt(xA - 32, yTop + 2, t('profilo a J'), 'text-anchor="end" font-size="10"'));
  p.push(txt(xA - 12, yTop + 26, t('dita'), 'text-anchor="middle" fill="#b8ad97" font-size="8.5"'));
  p.push(riga(xA + wA + 14, yTop, xA + wA + 14, yTop + s), riga(xA + wA + 10, yTop, xA + wA + 18, yTop), riga(xA + wA + 10, yTop + s, xA + wA + 18, yTop + s));
  p.push(txt(xA + wA + 22, yTop + s / 2 + 4, `${f(sp)} mm`, `fill="${C.dim}" font-size="10"`));
  p.push(txt(130, 250, `${t('anta da 700')}: 700 − ${f(aH)} − ${f(sp)} = ${f(700 - aH - sp)} mm`, `text-anchor="middle" fill="${C.dim}" font-size="10.5"`));
  p.push(txt(130, 266, t('vista di lato (sezione)'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  return `<svg viewBox="0 0 260 276" width="260" height="276" role="img" aria-label="${t('Maniglia a J vista di lato')}">${p.join('')}</svg>`;
}

/** CASSETTO visto DA SOPRA: frontale, guide, fondo e trasera con le loro misure. */
export function svgCassetto(c = {}) {
  const p = [], x0 = 40, y0 = 20, W = 200, D = 150;
  const fM = Number(c.fondoMeno) || 0, fP = Number(c.fondoProfondita) || 0, tM = Number(c.traseraMeno) || 0;
  p.push(rect(x0, y0 + D, W, 12, C.anta), txt(x0 + W / 2, y0 + D + 9, t('frontale'), 'text-anchor="middle" fill="#14110d" font-size="9"'));
  p.push(rect(x0 + 8, y0, 10, D, '#9aa0a6'), rect(x0 + W - 18, y0, 10, D, '#9aa0a6'));          // guide / sponde metalliche
  p.push(rect(x0 + 18, y0 + 14, W - 36, D - 14, '#d9d4c8'), txt(x0 + W / 2, y0 + D / 2 + 10, t('fondo'), 'text-anchor="middle" fill="#14110d" font-size="11"'));
  p.push(rect(x0 + 18, y0 + 2, W - 36, 10, '#f2efe8'), txt(x0 + W / 2, y0 + 10, t('trasera'), 'text-anchor="middle" fill="#14110d" font-size="8.5"'));
  p.push(txt(x0 + 4, y0 + D / 2, t('guida'), 'text-anchor="end" font-size="9" fill="#b8ad97"'));
  const tr = [[c.piccoloTrasera, 'piccolo'], [c.medioTrasera, 'medio'], [c.grandeTrasera, 'grande']].filter(([h]) => Number(h) > 0);
  p.push(txt(18, 206, `${t('fondo')}: ${t('modulo')} − ${f(fM)} × ${f(fP)} mm`, 'font-size="10.5"'));
  p.push(txt(18, 224, `${t('trasera')}: ${t('modulo')} − ${f(tM)} × ${tr.length ? tr.map(([h, n]) => `${f(h)} (${t(n)})`).join(' / ') : '—'} mm`, 'font-size="10.5"'));
  p.push(txt(18, 242, `${t('es. modulo 600')}: ${t('fondo')} ${f(600 - fM)} × ${f(fP)} · ${t('trasera')} ${f(600 - tM)} mm`, `fill="${C.dim}" font-size="10.5"`));
  p.push(txt(140, 258, t('vista da sopra'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  return `<svg viewBox="0 0 290 266" width="290" height="266" role="img" aria-label="${t('Cassetto visto da sopra')}">${p.join('')}</svg>`;
}

/** BINARIO DEGLI SCORREVOLI (vista davanti): armadio a 2 moduli, ante che scorrono, le misure dell'anta. */
export function svgBinario(b = {}) {
  const lM = Number(b.larghezzaMeno) || 0, hM = Number(b.altezzaMeno) || 0, pr = Number(b.maniglia) || 0;
  const p = [], x0 = 40, y0 = 24, W = 200, H = 150;
  p.push(rect(x0, y0, W, H, '#2a2620', `stroke="${C.fianco}"`));
  p.push(`<rect x="${x0}" y="${y0 + 2}" width="${W}" height="5" fill="#6d7075"/>`, `<rect x="${x0}" y="${y0 + H - 7}" width="${W}" height="5" fill="#6d7075"/>`);
  p.push(txt(x0 + W + 4, y0 + 8, t('binario'), 'font-size="9" fill="#b8ad97"'));
  // due ante: una davanti e una dietro, si sovrappongono un poco
  p.push(rect(x0 + 4, y0 + 9, W / 2 + 4, H - 18, '#cfc3a6'), rect(x0 + W / 2 - 8, y0 + 9, W / 2 + 4, H - 18, C.anta));
  p.push(`<rect x="${x0 + W / 2 - 8}" y="${y0 + 9}" width="4" height="${H - 18}" fill="#bfbfbf"/>`, `<rect x="${x0 + W - 8}" y="${y0 + 9}" width="4" height="${H - 18}" fill="#bfbfbf"/>`);
  p.push(txt(x0 + W / 2 + 40, y0 + H / 2, t('anta'), 'text-anchor="middle" fill="#14110d" font-size="10"'));
  p.push(txt(18, 200, `${t('larghezza anta')} = 1000 ÷ 2 − ${f(lM)} − ${f(pr)} = ${f(Math.floor(500 - lM - pr))} mm`, 'font-size="10.5"'));
  p.push(txt(18, 218, `${t('altezza anta')} = 2500 − ${f(hM)} = ${f(Math.floor(2500 - hM))} mm`, 'font-size="10.5"'));
  p.push(txt(18, 236, t('esempio: armadio 1000 × 2500, 2 moduli, 1 anta per modulo'), 'fill="#b8ad97" font-size="9.5"'));
  return `<svg viewBox="0 0 290 246" width="290" height="246" role="img" aria-label="${t('Ante scorrevoli viste davanti')}">${p.join('')}</svg>`;
}

/**
 * PIANO DI LAVORO visto di lato: profondità dal muro, quanto esce davanti alle ante, alzatina; sui lati a
 * filo dell'ultimo mobile (scritto sotto). k = { profonditaPiano, alzatina, altezzaAlzatina }.
 */
export function svgPianoLavoro(k = {}) {
  const prof = Number(k.profonditaPiano) || 625, dav = prof - 600, alz = !!k.alzatina, hA = Number(k.altezzaAlzatina) || 0;
  const p = [];
  // --- di lato: muro a sinistra, mobile da 600 (anta compresa), piano dal muro fino a «prof» ---
  const xM = 34, sc = 0.19, xA = xM + (600 - 18) * sc, wA = 18 * sc + 1, yP = 92, sp = 12;
  const xP = xM + Math.max(prof * sc, 600 * sc + 4);              // bordo davanti del piano (un filo esagerato se esce poco)
  p.push(`<rect x="${xM - 12}" y="16" width="12" height="190" fill="${C.muro}"/>`, txt(xM - 6, 216, t('muro'), 'text-anchor="middle" fill="#b8ad97" font-size="8.5"'));
  p.push(rect(xM, yP + sp, xA - xM, 84, C.fianco), txt((xM + xA) / 2, yP + sp + 46, t('mobile'), 'text-anchor="middle" fill="#14110d" font-size="10"'));
  p.push(rect(xA, yP + sp + 2, wA, 80, C.anta), txt(xA + 2, yP + sp + 96, t('anta'), 'text-anchor="middle" fill="#cfc6b3" font-size="8.5"'));
  p.push(rect(xM, yP, xP - xM, sp, C.piano), txt((xM + xA) / 2, yP + 9, t('piano'), 'text-anchor="middle" fill="#cfc6b3" font-size="9"'));
  if (alz) {
    const hPx = Math.min(70, 12 + hA * 0.12);
    p.push(rect(xM, yP - hPx, 6, hPx, '#6a6560'), txt(xM + 10, yP - hPx / 2 + 3, `${t('alzatina')} ${f(hA)} mm`, `fill="${C.dim}" font-size="9.5"`));
  } else p.push(txt(xM + 10, yP - 30, t('senza alzatina'), 'fill="#b8ad97" font-size="9"'));
  // quota: profondità del piano dal muro (in alto, con le linee che scendono fino al piano)
  const yQ = 30;
  const tratt = (x) => `<line x1="${x}" y1="${yQ}" x2="${x}" y2="${yP}" stroke="${C.dim}" stroke-width=".7" stroke-dasharray="2 2"/>`;
  p.push(tratt(xM), tratt(xP), riga(xM, yQ, xP, yQ), riga(xM, yQ - 4, xM, yQ + 4), riga(xP, yQ - 4, xP, yQ + 4));
  p.push(txt((xM + xP) / 2, yQ - 4, `${t('profondità')} ${f(prof)} mm`, `text-anchor="middle" fill="${C.dim}" font-size="9.5"`));
  // quanto esce davanti all'anta
  const xF = xA + wA;
  p.push(riga(xF, yP + sp + 6, xP, yP + sp + 6));
  p.push(txt(xP + 4, yP + sp + 9, `${f(dav)} mm ${t('davanti alle ante')}`, `fill="${C.dim}" font-size="9"`));
  p.push(txt(130, 232, t('vista di lato'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  p.push(txt(130, 250, t("Sui lati il piano finisce a filo dell'ultimo mobile."), `text-anchor="middle" fill="${C.dim}" font-size="9.5"`));
  return `<svg viewBox="0 0 290 258" width="290" height="258" role="img" aria-label="${t('Piano di lavoro: profondità e alzatina')}">${p.join('')}</svg>`;
}

/** Lo schema giusto per un gruppo dei ⚙ Parametri, con i numeri di adesso (P = parametri()). */
export function svgParametro(nome, P) {
  if (nome === 'aria') return svgAriaAnte(P.ante);
  if (nome === 'piedini') return svgPiedini(P.cucina.piedini);
  if (nome === 'piano') return svgPianoLavoro(P.cucina);
  if (nome === 'manigliaJ') return svgManigliaJ(P.manigliaJ.spessore, P.ante.ariaAltezza);
  if (nome === 'cassetti') return svgCassetto(P.cassetti);
  if (nome === 'binario') return svgBinario(P.binari[0] || {});
  if (nome === 'gola') return svgGola(P.gola.spazio);
  if (nome === 'regletta') return svgRegletta(P.regletta.vista, P.regletta.spessoreAnta);
  if (nome === 'anteInterne') return svgAnteInterne(P.anteInterne);
  return '';
}
