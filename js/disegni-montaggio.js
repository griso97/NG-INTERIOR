// =============================================================================
// DISEGNI STILIZZATI DEL MONTAGGIO DEGLI ARMADI (⚙ Parametri → Armadi e nel singolo armadio)
// =============================================================================
// Un disegnino che cambia con la scelta, per capire subito com'è fatto l'armadio:
//   svgStruttura(setup)  → visto DAVANTI: chi sta sopra e chi sta dentro (top/fondo o fianchi)
//   svgSchiena(opz)      → visto DA SOPRA (sezione): schiena dietro / a filo / nel canale, l'anta
//                          sopra o interna e il ripiano, con le misure scritte
// Non è in scala: gli spessori sono ingranditi perché si vedano.
// =============================================================================

const C = { top: '#c9a94a', fianco: '#8d939b', schiena: '#b07a4a', anta: '#e8dcc0', rip: '#6f8f6f', testo: '#e6dcc6', muro: '#5a5246', linea: '#14110d' };
const t = (s) => (typeof window !== 'undefined' && window.NGI18N ? window.NGI18N.t(s) : s);
// colore e grandezza di partenza solo se non li passo io (un attributo doppio vale il primo)
const txt = (x, y, s, opz = '') => `<text x="${x}" y="${y}" ${/fill=/.test(opz) ? '' : `fill="${C.testo}"`} ${/font-size=/.test(opz) ? '' : 'font-size="10"'} font-family="sans-serif" ${opz}>${s}</text>`;
const box = (x, y, w, h, col, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" stroke="${C.linea}" stroke-width="0.8" ${extra}/>`;

/** Struttura vista DAVANTI. setup 1 = standard (top e fondo sopra, fianchi dentro) · 2 = fianchi esterni (top e fondo dentro). */
export function svgStruttura(setup = 1) {
  const W = 120, H = 150, s = 12, x0 = 55, y0 = 10;
  let parti;
  if (Number(setup) === 2) {
    parti = box(x0, y0, s, H, C.fianco) + box(x0 + W - s, y0, s, H, C.fianco)
      + box(x0 + s, y0, W - 2 * s, s, C.top) + box(x0 + s, y0 + H - s, W - 2 * s, s, C.top);
  } else {
    parti = box(x0, y0, W, s, C.top) + box(x0, y0 + H - s, W, s, C.top)
      + box(x0, y0 + s, s, H - 2 * s, C.fianco) + box(x0 + W - s, y0 + s, s, H - 2 * s, C.fianco);
  }
  return `<svg viewBox="0 0 230 190" width="230" height="190" role="img" aria-label="${t('Struttura vista davanti')}">
    ${parti}
    ${txt(x0 + W / 2, y0 + 9, t('top'), 'text-anchor="middle" font-size="9" fill="#14110d"')}
    ${txt(x0 + W / 2, y0 + H - 3, t('fondo'), 'text-anchor="middle" font-size="9" fill="#14110d"')}
    ${txt(x0 - 4, y0 + H / 2, t('fianco'), 'text-anchor="end"')}
    ${txt(x0 + W + 4, y0 + H / 2, t('fianco'))}
    ${txt(x0 + W / 2, 182, t('vista davanti'), 'text-anchor="middle" fill="#b8ad97"')}
  </svg>`;
}

/**
 * Sezione vista DA SOPRA (il muro è in alto, l'anta in basso).
 * opz: { tipo: 'dietro'|'filo'|'canale', spessore, canale, dentro, interne, spazioRipiano }
 */
export function svgSchiena(opz = {}) {
  const tipo = opz.tipo || 'dietro', interne = !!opz.interne;
  const W = 140, x0 = 52, yMuro = 22;
  const sF = 12, sSch = 8, sAnta = 9, prof = 120;                 // ingranditi, non in scala
  const dentroPx = tipo === 'canale' ? 14 : tipo === 'filo' ? 0 : 0, canPx = 5;
  let y = yMuro + 4;
  let out = `<rect x="${x0 - 14}" y="${yMuro - 6}" width="${W + 28}" height="6" fill="${C.muro}"/>`
    + txt(x0 + W / 2, yMuro - 9, t('muro'), 'text-anchor="middle" fill="#b8ad97" font-size="9"');
  let yFianchi = y;
  if (tipo === 'dietro') {                                          // schiena dietro, larga come tutto
    out += box(x0, y, W, sSch, C.schiena);
    yFianchi = y + sSch;
  }
  const yFrontStr = yFianchi + prof;                                // davanti della struttura
  out += box(x0, yFianchi, sF, prof, C.fianco) + box(x0 + W - sF, yFianchi, sF, prof, C.fianco);
  let yDavSch;                                                      // faccia davanti della schiena
  if (tipo === 'filo') {
    out += box(x0 + sF, yFianchi, W - 2 * sF, sSch, C.schiena);
    yDavSch = yFianchi + sSch;
  } else if (tipo === 'canale') {
    const yc = yFianchi + dentroPx;
    // i canali nei fianchi (scuri) e la schiena che ci entra
    out += box(x0 + sF - canPx, yc, canPx, sSch, '#2a2520') + box(x0 + W - sF, yc, canPx, sSch, '#2a2520');
    out += box(x0 + sF - canPx, yc, W - 2 * sF + 2 * canPx, sSch, C.schiena);
    yDavSch = yc + sSch;
    // quote: quanto dentro e canale
    out += `<line x1="${x0 - 6}" y1="${yFianchi}" x2="${x0 - 6}" y2="${yc}" stroke="${C.testo}" stroke-width="0.8"/>`
      + txt(x0 - 9, yFianchi + dentroPx / 2 + 3, `${opz.dentro ?? 10}`, 'text-anchor="end" font-size="9"')
      + txt(x0 + W + 4, yc + 6, `${t('canale')} ${opz.canale ?? 8}`, 'font-size="9"');
  } else {
    yDavSch = yFianchi;
  }
  // anta: sopra la struttura (davanti, larga come tutto) o interna (fra i fianchi, a filo)
  let yAntaDietro;
  if (interne) {
    out += box(x0 + sF + 1.5, yFrontStr - sAnta, W - 2 * sF - 3, sAnta, C.anta);
    yAntaDietro = yFrontStr - sAnta;
  } else {
    out += box(x0, yFrontStr + 1.5, W, sAnta, C.anta);
    yAntaDietro = yFrontStr;
  }
  // ripiano (tratteggiato): dalla schiena fino a poco prima dell'anta
  const gapR = interne ? 6 : 2;
  out += `<rect x="${x0 + sF + 3}" y="${yDavSch + 2}" width="${W - 2 * sF - 6}" height="${Math.max(10, yAntaDietro - gapR - yDavSch - 2)}" fill="none" stroke="${C.rip}" stroke-width="1.2" stroke-dasharray="4 3"/>`
    + txt(x0 + W / 2, (yDavSch + yAntaDietro) / 2 + 3, t('ripiano'), `text-anchor="middle" fill="${C.rip}"`);
  // etichette
  const yEtSch = tipo === 'dietro' ? y + sSch / 2 + 3 : tipo === 'filo' ? yFianchi + sSch / 2 + 3 : yFianchi + dentroPx + sSch / 2 + 3;
  out += txt(x0 + W + (tipo === 'canale' ? 4 : 6), tipo === 'canale' ? yEtSch + 12 : yEtSch, `${t('schiena')} ${opz.spessore ?? 10}`, 'font-size="9"');
  out += txt(x0 - 4, yFianchi + prof / 2 + 18, t('fianco'), 'text-anchor="end" font-size="9"');
  out += txt(x0 + W / 2, (interne ? yFrontStr - 1.5 : yFrontStr + sAnta), t('anta'), 'text-anchor="middle" font-size="8" fill="#14110d"');
  const hTot = yFrontStr + sAnta + 22;
  out += txt(x0 + W / 2, hTot - 4, t('vista da sopra'), 'text-anchor="middle" fill="#b8ad97"');
  return `<svg viewBox="0 0 272 ${hTot}" width="272" height="${hTot}" role="img" aria-label="${t('Schiena vista da sopra')}">${out}</svg>`;
}

/**
 * ANTE INTERNE (armadio a battente): a sinistra VISTO DAVANTI (① aria attorno all'anta, ② fra le
 * due ante, dentro il vano della struttura), a destra VISTO DA SOPRA (③ il ripiano sta più indietro
 * dell'anta). Sotto l'esempio con le misure vere: armadio 1000 × 2000, struttura 18, 2 ante.
 */
export function svgAnteInterne(opz = {}) {
  const aria = Number(opz.aria) || 0, sr = Number(opz.spazioRipiano) || 0;
  const f = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const oro = '#e8c25a';
  const badge = (x, y, n) => `<circle cx="${x}" cy="${y}" r="8" fill="${oro}"/>${txt(x, y + 3.5, n, 'text-anchor="middle" fill="#14110d" font-size="10" font-weight="700"')}`;
  const riga = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${oro}" stroke-width="1"/>`;
  const p = [];
  // --- davanti: struttura (fianchi, top, fondo) e due ante DENTRO il vano ---
  const x0 = 34, y0 = 30, W = 128, H = 166, s = 9, g = 4, gm = 5;
  p.push(box(x0, y0, W, H, C.fianco));                                     // struttura
  p.push(`<rect x="${x0 + s}" y="${y0 + s}" width="${W - 2 * s}" height="${H - 2 * s}" fill="#14110d"/>`);   // vano
  const wv = W - 2 * s, hv = H - 2 * s, wa = (wv - 2 * g - gm) / 2;
  p.push(box(x0 + s + g, y0 + s + g, wa, hv - 2 * g, C.anta), box(x0 + s + g + wa + gm, y0 + s + g, wa, hv - 2 * g, C.anta));
  p.push(badge(x0 - 14, y0 + s + g / 2 + 30, '1'), riga(x0 - 6, y0 + s + g / 2 + 30, x0 + s + g / 2, y0 + s + g / 2 + 30));
  p.push(badge(x0 + s + g + wa / 2, y0 - 10, '1'), riga(x0 + s + g + wa / 2, y0 - 2, x0 + s + g + wa / 2, y0 + s + g / 2));
  p.push(badge(x0 + s + g + wa + gm / 2, y0 + H / 2, '2'));
  p.push(txt(x0 + W / 2, y0 + H + 14, t('vista davanti'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  // --- da sopra: fianchi, anta a filo davanti, ripiano più indietro (③) ---
  const xs = 214, ys = 40, Ws = 116, Ds = 120, sf = 9, sa = 8, gap = Math.max(6, Math.min(24, sr * 0.9));
  p.push(`<rect x="${xs - 10}" y="${ys - 8}" width="${Ws + 20}" height="6" fill="${C.muro}"/>`, txt(xs + Ws / 2, ys - 12, t('muro'), 'text-anchor="middle" fill="#b8ad97" font-size="8.5"'));
  p.push(box(xs, ys, sf, Ds, C.fianco), box(xs + Ws - sf, ys, sf, Ds, C.fianco));
  p.push(box(xs + sf + 1.5, ys + Ds - sa, Ws - 2 * sf - 3, sa, C.anta), txt(xs + Ws / 2, ys + Ds - 1.5, t('anta'), 'text-anchor="middle" fill="#14110d" font-size="7.5"'));
  const yR1 = ys + Ds - sa - gap;
  p.push(`<rect x="${xs + sf + 3}" y="${ys + 6}" width="${Ws - 2 * sf - 6}" height="${yR1 - ys - 6}" fill="none" stroke="${C.rip}" stroke-width="1.2" stroke-dasharray="4 3"/>`);
  p.push(txt(xs + Ws / 2, (ys + yR1) / 2 + 3, t('ripiano'), `text-anchor="middle" fill="${C.rip}" font-size="9"`));
  p.push(riga(xs + Ws + 8, yR1, xs + Ws + 8, ys + Ds - sa), riga(xs + Ws + 4, yR1, xs + Ws + 12, yR1), riga(xs + Ws + 4, ys + Ds - sa, xs + Ws + 12, ys + Ds - sa));
  p.push(badge(xs + Ws + 22, yR1 + (ys + Ds - sa - yR1) / 2, '3'));
  p.push(txt(xs + Ws / 2, ys + Ds + 26, t('vista da sopra'), 'text-anchor="middle" fill="#b8ad97" font-size="9"'));
  // --- legenda con i numeri veri ---
  const w = (1000 - 36 - 3 * aria) / 2, h = 2000 - 36 - 2 * aria;
  const leg = (y, n, s2) => badge(18, y - 3.5, n) + txt(32, y, s2, 'font-size="10.5"');
  p.push(leg(232, '1', `${t('aria attorno all\'anta (sopra, sotto, ai lati)')}: ${f(aria)} mm`));
  p.push(leg(250, '2', `${t('aria fra un\'anta e l\'altra')}: ${f(aria)} mm`));
  p.push(leg(268, '3', `${t('il ripiano sta più indietro dell\'anta di')} ${f(sr)} mm`));
  p.push(txt(18, 290, t('Esempio: armadio 1000 × 2000, struttura 18'), `fill="${oro}" font-size="10.5"`));
  p.push(txt(18, 306, `${t('→ vano 964 × 1964 → 2 ante interne da')} ${f(w)} × ${f(h)} mm`, `fill="${oro}" font-size="10.5"`));
  return `<svg viewBox="0 0 370 314" width="370" height="314" role="img" aria-label="${t('Ante interne: aria e ripiani')}">${p.join('')}</svg>`;
}
