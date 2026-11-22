// =============================================================================
// SCHEMI DELLA CUCINA per la configurazione guidata e i ⚙ Parametri (non in scala: gli spessori sono
// ingranditi perché si vedano)
//   svgGola(spazio)                → visto DI LATO: piano, profilo L, cassetti, profilo C, spazio per le dita
//   svgRegletta(vista, spessore)   → visto DA SOPRA: l'angolo di una cucina a L con i due pezzi della regletta
// =============================================================================
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
