// =============================================================================
// RENDERING SVG della pianta (vista dall'alto, in scala)
// =============================================================================
// Disegna il perimetro delle pareti con quote, griglia 100 mm e indicazione
// del lato interno. Il SVG usa un viewBox in MM così che tutto sia in scala
// reale (basta che Three.js e co. restino coerenti con le misure in mm).
// =============================================================================

import {
  calcolaVertici, bboxPerimetro,
  moduliDiParete, nomeTipo, PROFONDITA_BASE, PROFONDITA_PENSILE, angoloInterno,
  profonditaTipo, categoriaTipo, descrizioneMobile,
  dimMobile, liberoPareti, livelloDiMobile, spaziTraMobili, angoloInternoVertice,
} from './modello.js?v=20261115n';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  return e;
};

const PASSO_GRIGLIA = 100;     // mm (passo primario)
const PASSO_GRIGLIA_MAGG = 1000; // mm (linea più visibile ogni 1 m)

/**
 * opts: { pareteAttivaId, pareteSelId, mobSelId, interattivo }
 *  - pareteAttivaId: muro su cui si lavora nello Step 2 (evidenziato)
 *  - pareteSelId: muro toccato nello Step 1 (per toglierlo/rimetterlo)
 *  - mobSelId: mobile libero selezionato
 *  - interattivo: se true i mobili liberi si possono trascinare (Step 2)
 */
export function renderPianta(svg, progetto, opts = {}) {
  const { pareteAttivaId = null, pareteSelId = null, mobSelId = null, interattivo = false, livelloAttivo = null } = opts;
  const pareti = progetto.piano.pareti || [];
  const vertici = calcolaVertici(pareti);

  // --- viewBox in mm (asse Y invertito per SVG: y positivo va in basso) ---
  // La pianta si adatta allo schermo e tiene la fila a muro verso il bordo
  // (dietro al muro non si mette nulla), lasciando tutto lo spazio verso
  // l'INTERNO per posizionare l'isola.
  const bb = bboxPerimetro(pareti);
  if (pareti.length === 0) {
    bb.minX = 0; bb.maxX = 2000; bb.minY = 0; bb.maxY = 1500;
  }

  // Direzione "interno" (dove stanno i moduli e dove va l'isola):
  // somma delle normali interne delle pareti, pesata per lunghezza.
  let inX = 0, inY = 0;
  for (let i = 0; i < pareti.length; i++) {
    const a = vertici[i], b = vertici[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const sgn = pareti[i].latoInterno === 'interno' ? 1 : -1;
    inX += (-dy / L) * sgn * L;   // normale interna × lunghezza
    inY += (dx / L) * sgn * L;
  }
  const inLen = Math.hypot(inX, inY);
  const ivx = inLen ? inX / inLen : 0;   // versore interno (0,0 se incerto)
  const ivy = inLen ? inY / inLen : 0;

  // Contenuto = pareti + profondità moduli base sul lato interno + isole.
  const cb = { minX: bb.minX, maxX: bb.maxX, minY: bb.minY, maxY: bb.maxY };
  const PROF = PROFONDITA_BASE;
  if (ivx > 0) cb.maxX += PROF * ivx; else if (ivx < 0) cb.minX += PROF * ivx;
  if (ivy > 0) cb.maxY += PROF * ivy; else if (ivy < 0) cb.minY += PROF * ivy;
  for (const m of (progetto.mobiliLiberi || [])) {
    const d = dimMobile(m);
    const r = Math.hypot(d.w || 600, d.d || 600) / 2;  // raggio (robusto alla rotazione)
    cb.minX = Math.min(cb.minX, m.x - r); cb.maxX = Math.max(cb.maxX, m.x + r);
    cb.minY = Math.min(cb.minY, m.y - r); cb.maxY = Math.max(cb.maxY, m.y + r);
  }

  // Margine piccolo attorno al contenuto (quote, badge "libero").
  const MARG = 350;
  let X0 = cb.minX - MARG, X1 = cb.maxX + MARG;
  let Y0 = cb.minY - MARG, Y1 = cb.maxY + MARG;

  // Adatta all'aspect ratio dello schermo: lo spazio extra va verso l'interno,
  // così la fila a muro resta sul bordo e davanti c'è spazio per l'isola.
  const MAX_INTERNO = 3500;   // mm max di spazio libero riservato all'isola
  const cw = svg.clientWidth, ch = svg.clientHeight;
  const AR = (cw > 0 && ch > 0) ? cw / ch : 1.4;
  const Wc = X1 - X0, Hc = Y1 - Y0;
  if (Wc / Hc < AR) {
    // Box troppo "alto" per lo schermo → aggiungo LARGHEZZA verso l'interno.
    const extra = Math.min(AR * Hc - Wc, MAX_INTERNO);
    if (ivx > 0.2) X1 += extra;
    else if (ivx < -0.2) X0 -= extra;
    else { X0 -= extra / 2; X1 += extra / 2; }
  } else {
    // Box troppo "largo" → aggiungo ALTEZZA verso l'interno.
    const extra = Math.min(Wc / AR - Hc, MAX_INTERNO);
    if (ivy > 0.2) Y1 += extra;          // interno in alto (world +y) → muro in basso
    else if (ivy < -0.2) Y0 -= extra;    // interno in basso → muro in alto
    else { Y0 -= extra / 2; Y1 += extra / 2; }
  }

  // Durante un trascinamento (mano libera) la vista resta ferma
  const [vbX, vbY, w, h] = opts.viewBoxFisso
    ? opts.viewBoxFisso.split(/[\s,]+/).map(Number)
    : [X0, -Y1, X1 - X0, Y1 - Y0];        // y SVG parte dall'alto → invertito
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${w} ${h}`);
  svg.innerHTML = '';

  // --- Griglia 100 mm (chiara) + linee maggiori ogni 1000 mm ---
  svg.appendChild(renderGriglia(vbX, vbY, w, h));

  // --- Perimetro ---
  if (pareti.length > 0) {
    // Prima disegno i MODULI (così stanno sotto le linee della parete)
    const gMod = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pareti.forEach((p, i) => {
      const a = vertici[i], b = vertici[i + 1];
      const mods = moduliDiParete(progetto, p.id);
      // Zone d'angolo interno (inizio/fine parete) condivise con la parete
      // adiacente: una fascia lì sta "sotto" il modulo dell'altra parete,
      // quindi non ne scrivo l'etichetta per non sovrapporre i testi.
      const angInizio = i > 0 && angoloInterno(pareti[i - 1], p);
      const angFine = i < pareti.length - 1 && angoloInterno(p, pareti[i + 1]);
      mods.forEach((m) => {
        const inAngolo = m.categoria === 'fascia' && (
          (angInizio && m.posizione_mm + m.larghezza_mm <= PROFONDITA_BASE) ||
          (angFine && m.posizione_mm >= p.lunghezza_mm - PROFONDITA_BASE));
        gMod.appendChild(renderModuloInPianta(a, b, p, m, !inAngolo));
      });
    });
    svg.appendChild(gMod);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pareti.forEach((p, i) => {
      const a = vertici[i];
      const b = vertici[i + 1];
      const confermato = progetto.pianoConfermato;
      // y SVG invertita
      const ax = a.x, ay = -a.y;
      const bx = b.x, by = -b.y;

      // Area di tocco invisibile e più larga del muro (per selezionarlo)
      g.appendChild(el('line', {
        x1: ax, y1: ay, x2: bx, y2: by,
        class: 'sv-hit', 'data-parete-id': p.id,
      }));

      // Linea parete (grosso tratto oro); se tolto, tratteggio grigio
      let cls = 'sv-parete';
      if (p.assente) cls += ' sv-parete-assente';
      else if (confermato) cls += ' sv-parete-conf';
      if (p.id === pareteAttivaId) cls += ' sv-parete-attiva';
      if (p.id === pareteSelId) cls += ' sv-parete-sel';
      g.appendChild(el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: cls }));

      // Indicatore lato interno (lineetta parallela dal lato giusto)
      if (!p.assente) g.appendChild(renderLatoInterno(a, b, p));

      // Quota (etichetta misura in mm al centro della parete)
      g.appendChild(renderQuota(a, b, p));
    });
    svg.appendChild(g);

    // Indicatore vertice/angolo (pallini sui nodi)
    vertici.forEach((v, k) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', v.x);
      c.setAttribute('cy', -v.y);
      c.setAttribute('r', 40);
      c.setAttribute('class', 'sv-angolo');
      svg.appendChild(c);
    });
    // MANO LIBERA: vertici da prendere (estremità per aggiungere pareti) e
    // angolo interno scritto vicino a ogni vertice
    if (opts.manoLibera) {
      const sc = Math.max(w, h) / 900;                 // misure leggibili a ogni zoom
      vertici.forEach((v, k) => {
        const estremo = k === 0 || k === vertici.length - 1;
        const cls = 'sv-vertice' + (estremo ? ' estremo' : '') + (opts.verticeSel === k ? ' sel' : '')
          + (opts.aggiunta && estremo ? ' aggiungi' : '');
        svg.appendChild(el('circle', { cx: v.x, cy: -v.y, r: Math.max(70, 16 * sc), class: cls, 'data-vertice': k }));
        if (opts.aggiunta && estremo) {
          const t = el('text', { x: v.x, y: -v.y + 9 * sc, class: 'sv-vertice-piu', 'font-size': 26 * sc, 'text-anchor': 'middle' });
          t.textContent = '+'; svg.appendChild(t);
        }
        const ang = angoloInternoVertice(pareti, k);
        if (ang != null) {
          // scritta verso l'interno, sulla bisettrice dell'angolo
          const a = vertici[k - 1], b = vertici[k + 1];
          const u1 = { x: a.x - v.x, y: a.y - v.y }, u2 = { x: b.x - v.x, y: b.y - v.y };
          const l1 = Math.hypot(u1.x, u1.y) || 1, l2 = Math.hypot(u2.x, u2.y) || 1;
          let bx = u1.x / l1 + u2.x / l2, by = u1.y / l1 + u2.y / l2;
          let bl = Math.hypot(bx, by);
          if (bl < 1e-3) { bx = -u1.y / l1; by = u1.x / l1; bl = 1; }
          if (ang > 180) { bx = -bx; by = -by; }
          const d = 48 * sc;
          const t = el('text', { x: v.x + (bx / bl) * d, y: -(v.y + (by / bl) * d), class: 'sv-angolo-testo' + (opts.verticeSel === k ? ' sel' : ''),
            'font-size': 24 * sc, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
          t.textContent = `${String(ang).replace('.', ',')}°`;
          svg.appendChild(t);
        }
      });
      if (opts.anteprima) {
        const { a, b, testo } = opts.anteprima;
        svg.appendChild(el('line', { x1: a.x, y1: -a.y, x2: b.x, y2: -b.y, class: 'sv-anteprima' }));
        const t = el('text', { x: (a.x + b.x) / 2, y: -(a.y + b.y) / 2 - 22 * sc, class: 'sv-anteprima-testo', 'font-size': 16 * sc, 'text-anchor': 'middle' });
        t.textContent = testo; svg.appendChild(t);
      }
    }

    // Mobili liberi: sopra a muri e quote, così restano sempre toccabili
    const gMob = el('g', { class: 'sv-mobili-liberi' });
    (progetto.mobiliLiberi || []).forEach((m) => {
      // stampa: solo i livelli scelti (es. solo bassi), gli altri non si disegnano
      if (opts.livelliVisibili && !opts.livelliVisibili.includes(livelloDiMobile(m))) return;
      const bloccato = livelloAttivo !== null && livelloDiMobile(m) !== livelloAttivo;
      gMob.appendChild(renderMobileLibero(m, m.id === mobSelId, interattivo && !bloccato, bloccato));
    });
    svg.appendChild(gMob);

    // Badge "libero" su ogni muro (quanto manca alla fine), in cm
    const gLib = el('g', { class: 'sv-libero-badges' });
    liberoPareti(progetto).forEach((info) => {
      gLib.appendChild(renderBadgeLibero(vertici[info.idx], vertici[info.idx + 1],
        pareti[info.idx], info));
    });
    svg.appendChild(gLib);

    // Etichette sugli SPAZI VUOTI tra i mobili (es. 3 cm all'angolo)
    const gGap = el('g', { class: 'sv-gap-badges' });
    spaziTraMobili(progetto).forEach((sp) => {
      const rad = (sp.rot || 0) * Math.PI / 180;
      const fx = Math.sin(rad), fy = -Math.cos(rad);   // direzione fronte (verso stanza)
      const off = 400;
      const t = el('text', {
        x: sp.x + fx * off, y: -(sp.y + fy * off), class: 'sv-gap-badge',
      });
      t.textContent = `${(sp.gap / 10).toFixed(sp.gap % 10 ? 1 : 0)} cm`;
      gGap.appendChild(t);
    });
    svg.appendChild(gGap);
  } else {
    // Nessuna parete (isola): disegno solo una nota al centro
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', (bb.minX + bb.maxX) / 2);
    t.setAttribute('y', -(bb.minY + bb.maxY) / 2);
    t.setAttribute('class', 'sv-quota');
    t.setAttribute('fill', 'var(--testo-dim)');
    t.textContent = 'Isola — nessuna parete';
    svg.appendChild(t);
  }
}

function renderGriglia(vbX, vbY, w, h) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  // Linee verticali
  const startX = Math.floor(vbX / PASSO_GRIGLIA) * PASSO_GRIGLIA;
  for (let x = startX; x <= vbX + w; x += PASSO_GRIGLIA) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x); l.setAttribute('x2', x);
    l.setAttribute('y1', vbY); l.setAttribute('y2', vbY + h);
    l.setAttribute('class',
      x % PASSO_GRIGLIA_MAGG === 0 ? 'sv-griglia-linea-maggiore' : 'sv-griglia-linea');
    g.appendChild(l);
  }
  // Linee orizzontali
  const startY = Math.floor(vbY / PASSO_GRIGLIA) * PASSO_GRIGLIA;
  for (let y = startY; y <= vbY + h; y += PASSO_GRIGLIA) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', vbX); l.setAttribute('x2', vbX + w);
    l.setAttribute('y1', y); l.setAttribute('y2', y);
    l.setAttribute('class',
      y % PASSO_GRIGLIA_MAGG === 0 ? 'sv-griglia-linea-maggiore' : 'sv-griglia-linea');
    g.appendChild(l);
  }
  return g;
}

function renderLatoInterno(a, b, parete) {
  // Vettore parete
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  // Perpendicolare (sinistra = interno di default; destra = esterno)
  const sgn = parete.latoInterno === 'interno' ? 1 : -1;
  const offset = 120 * sgn;
  // Normale (sinistra rispetto alla direzione di percorrenza)
  const nx = -dy / L;
  const ny = dx / L;
  // Linea tratteggiata parallela, spostata di `offset`
  const x1 = a.x + nx * offset;
  const y1 = -(a.y + ny * offset);
  const x2 = b.x + nx * offset;
  const y2 = -(b.y + ny * offset);
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  l.setAttribute('class', 'sv-interno');
  return l;
}

/**
 * Disegna un modulo (base o fascia) come rettangolo sulla parete, verso il
 * lato interno, con etichetta "nome · larghezza mm".
 */
function renderModuloInPianta(a, b, parete, modulo, conEtichetta = true) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;              // versore parete
  const sgn = parete.latoInterno === 'interno' ? 1 : -1;
  const nx = -dy / L * sgn, ny = dx / L * sgn;  // normale verso l'interno
  const PROF = PROFONDITA_BASE;                 // 600 mm

  // Punti A→B del modulo lungo la parete
  const p1x = a.x + ux * modulo.posizione_mm;
  const p1y = a.y + uy * modulo.posizione_mm;
  const p2x = p1x + ux * modulo.larghezza_mm;
  const p2y = p1y + uy * modulo.larghezza_mm;
  // Punti arretrati (profondità 600) verso l'interno
  const p3x = p2x + nx * PROF;
  const p3y = p2y + ny * PROF;
  const p4x = p1x + nx * PROF;
  const p4y = p1y + ny * PROF;

  // Costruisco il gruppo (polygon + etichetta)
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const points = [
    [p1x, -p1y], [p2x, -p2y], [p3x, -p3y], [p4x, -p4y],
  ].map((pt) => pt.join(',')).join(' ');
  poly.setAttribute('points', points);
  const cls = modulo.categoria === 'fascia' ? 'sv-mod sv-mod-fascia' :
    (modulo.tipo === 'lavello' ? 'sv-mod sv-mod-lavello' :
     modulo.tipo === 'forno'   ? 'sv-mod sv-mod-forno'   : 'sv-mod sv-mod-base');
  poly.setAttribute('class', cls);
  g.appendChild(poly);

  if (!conEtichetta) return g;

  // Etichetta "tipo · larghezza" al centro del rettangolo
  const cx = (p1x + p3x) / 2;
  const cy = -((p1y + p3y) / 2);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', cx);
  txt.setAttribute('y', cy);
  txt.setAttribute('class', 'sv-mod-label');
  // Due righe (nome / larghezza), font ridotto sui moduli stretti
  // così l'etichetta resta dentro il rettangolo.
  const nome = nomeTipo(modulo.tipo);
  const fs = Math.max(30, Math.min(70, modulo.larghezza_mm / (nome.length * 0.6)));
  txt.style.fontSize = `${fs}px`; // style (non attributo): il CSS vincerebbe sull'attributo
  const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  r1.setAttribute('x', cx); r1.setAttribute('dy', -fs * 0.6);
  r1.textContent = nome;
  const r2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  r2.setAttribute('x', cx); r2.setAttribute('dy', fs * 1.2);
  r2.setAttribute('class', 'sv-mod-label-mis');
  r2.textContent = `${modulo.larghezza_mm}`;
  txt.append(r1, r2);
  g.appendChild(txt);

  return g;
}

/**
 * Mobile libero: rettangolo 600 mm di profondità, ruotato di m.rot gradi,
 * con linea centrale per le ante (base con ante) e etichetta nome/misura.
 */
function renderMobileLibero(m, selezionato, interattivo, bloccato = false) {
  const categoria = categoriaTipo(m.tipo);
  const dim = dimMobile(m);
  const hw = dim.w / 2, hd = dim.d / 2;
  const rad = ((m.rot || 0) * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  // coordinate locali → piano (y in su) → SVG (y in giù)
  const versoPlan = (lx, ly) => [m.x + lx * c - ly * s, m.y + lx * s + ly * c];
  const versoSvg = (lx, ly) => { const [x, y] = versoPlan(lx, ly); return [x, -y]; };

  const g = el('g', {
    class: 'sv-mob-g' + (interattivo ? ' interattivo' : '') + (bloccato ? ' bloccato' : ''),
    'data-mob-id': m.id,
  });
  // Area di tocco invisibile: TUTTO il mobile (anche la parte dietro) più un
  // margine; i mobili piccoli (regletta) o sottili restano facili da prendere.
  const mh = Math.max(40, 120 - Math.min(hw, hd));
  const hitL = [[-hw - mh, -hd - mh], [hw + mh, -hd - mh], [hw + mh, hd + mh], [-hw - mh, hd + mh]].map(([x, y]) => versoSvg(x, y));
  g.appendChild(el('polygon', {
    points: hitL.map((p) => p.join(',')).join(' '),
    class: 'sv-mob-hit', 'data-mob-id': m.id,
  }));
  // Pensile angolo a L: contorno a 6 vertici (incavo fronte-destra), coerente
  // con la geometria 3D a L. Gli altri mobili: rettangolo a 4 vertici.
  let cornersLocali;
  const profL = m.tipo === 'pensile-angolo' ? PROFONDITA_PENSILE : m.tipo === 'base-angolo' ? Math.min(m.profBraccio_mm || PROFONDITA_BASE, Math.min(hw, hd) * 2 - 10) : 0;
  if (profL) {
    const prof = profL;
    const xi = -hw + prof, yi = hd - prof;
    cornersLocali = [[-hw, -hd], [xi, -hd], [xi, yi], [hw, yi], [hw, hd], [-hw, hd]];
  } else {
    cornersLocali = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  }
  const corners = cornersLocali.map(([x, y]) => versoSvg(x, y));
  const tipoCls = categoria === 'pensile' ? ' sv-mob-pensile' :
    categoria === 'colonna' ? ' sv-mob-colonna' :
    categoria === 'regletta' ? ' sv-mob-regletta' :
    categoria === 'pannello' ? ' sv-mob-pannello' :
    m.tipo === 'lavello' ? ' sv-mod-lavello' :
    m.tipo === 'forno' ? ' sv-mod-forno' : '';
  g.appendChild(el('polygon', {
    points: corners.map((p) => p.join(',')).join(' '),
    class: 'sv-mod sv-mob' + tipoCls + (selezionato ? ' sel' : ''),
  }));
  // LATO DELLE ANTE (davanti) in un altro colore: si vede subito da che
  // parte aprono, senza andare nel rendering
  if (profL) {
    // mobile a L: fascia delle ante sulle due facce interne (verso l'incavo)
    const F = Math.min(90, Math.max(40, profL * 0.22));
    const xi = -hw + profL, yi = hd - profL;
    for (const q of [[[xi, yi], [hw, yi], [hw, yi + F], [xi, yi + F]], [[xi - F, -hd], [xi, -hd], [xi, yi], [xi - F, yi]]]) {
      g.appendChild(el('polygon', { points: q.map(([x, y]) => versoSvg(x, y).join(',')).join(' '), class: 'sv-mob-fronte' }));
    }
  } else if (!['costado', 'regletta', 'pannello', 'oggetto'].includes(categoria)) {
    const F = Math.min(90, Math.max(40, hd * 0.22));
    // fronte come nel 3D: direzione (−sin r, −cos r) in pianta
    const fx = -s, fy = -c, px = -fy, py = fx;          // fronte e sua perpendicolare
    const P = (a, b) => [m.x + fx * a + px * b, -(m.y + fy * a + py * b)];
    const fr = [P(hd, -hw), P(hd, hw), P(hd - F, hw), P(hd - F, -hw)];
    g.appendChild(el('polygon', { points: fr.map((p) => p.join(',')).join(' '), class: 'sv-mob-fronte' }));
  }
  if (m.tipo === 'base-ante' || m.tipo === 'pensile') {
    const [x1, y1] = versoSvg(0, -hd + 20);
    const [x2, y2] = versoSvg(0, hd - 20);
    g.appendChild(el('line', { x1, y1, x2, y2, class: 'sv-mob-anta' }));
  }
  // La regletta è troppo piccola per un'etichetta: la mostro solo nel pannello
  if (categoria === 'regletta') return g;

  const [cx, cy] = versoSvg(0, 0);
  const nome = nomeTipo(m.tipo);
  const fs = Math.max(34, Math.min(80, m.larghezza_mm / (nome.length * 0.55)));
  const txt = el('text', {
    x: cx, y: cy, class: 'sv-mod-label',
    // scritta sempre leggibile (mai capovolta): giro di 180° in più se serve
    transform: (() => { const r = ((m.rot || 0) % 360 + 360) % 360; const a = r > 90 && r <= 270 ? -r + 180 : -r; return a ? `rotate(${a} ${cx} ${cy})` : null; })(),
  });
  txt.style.fontSize = `${fs}px`;
  const r1 = el('tspan', { x: cx, dy: -fs * 0.6 });
  r1.textContent = nome;
  // seconda riga (misure): rimpicciolita per stare dentro la larghezza del mobile
  const desc = descrizioneMobile(m);
  const fs2 = Math.max(18, Math.min(fs * 0.85, (m.larghezza_mm || 600) * 0.92 / (desc.length * 0.56)));
  const r2 = el('tspan', { x: cx, dy: fs * 0.6 + fs2 * 0.9, class: 'sv-mod-label-mis' });
  r2.style.fontSize = `${fs2}px`;
  r2.textContent = desc;
  txt.append(r1, r2);
  g.appendChild(txt);
  return g;
}

/**
 * Badge "libero: X cm" posizionato al centro del muro, sul lato interno,
 * appena oltre la profondità dei mobili. Verde se c'è spazio, rosso se pieno.
 */
function renderBadgeLibero(a, b, parete, info) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const sgn = parete.latoInterno === 'interno' ? 1 : -1;
  const nx = -dy / L * sgn, ny = dx / L * sgn;      // verso interno
  const off = 720;                                  // oltre i mobili (600)
  const tx = mx + nx * off, ty = -(my + ny * off);
  const pieno = info.libero <= 0;
  const g = el('g', { class: 'sv-badge-libero' });
  const txt = el('text', {
    x: tx, y: ty, class: 'sv-badge-txt ' + (pieno ? 'pieno' : 'ok'),
  });
  txt.textContent = pieno ? 'muro pieno' : `libero ${Math.round(info.libero / 10)} cm`;
  g.appendChild(txt);
  return g;
}

function renderQuota(a, b, parete) {
  const mx = (a.x + b.x) / 2;
  const my = -(a.y + b.y) / 2;
  // Vettore parete per spostare la quota perpendicolarmente (lato opposto all'interno)
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const sgn = parete.latoInterno === 'interno' ? -1 : 1; // etichetta fuori dal perimetro
  const offset = 220 * sgn;
  const nx = -dy / L;
  const ny = dx / L;
  const tx = mx + nx * offset;
  const ty = my - ny * offset;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  // Background (rettangolo scuro) per leggibilità
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', tx);
  txt.setAttribute('y', ty);
  txt.setAttribute('class', 'sv-quota');
  txt.textContent = `${Math.round(parete.lunghezza_mm)} mm`;
  g.appendChild(txt);
  return g;
}
