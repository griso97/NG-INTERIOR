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
  dimMobile, liberoPareti, livelloDiMobile, spaziTraMobili,
} from './modello.js?v=20261109z';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  return e;
};

const MARGINE_MM = 800;        // margine attorno al perimetro (mm)
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

  // Calcolo viewBox in mm (asse Y invertito per SVG: y positivo va in basso)
  const bb = bboxPerimetro(pareti);
  if (pareti.length === 0) {
    bb.minX = 0; bb.maxX = 2000; bb.minY = 0; bb.maxY = 1500;
  }
  const w = (bb.maxX - bb.minX) + 2 * MARGINE_MM;
  const h = (bb.maxY - bb.minY) + 2 * MARGINE_MM;
  const vbX = bb.minX - MARGINE_MM;
  const vbY = -(bb.maxY + MARGINE_MM); // y SVG parte dall'alto → invertito
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
    vertici.forEach((v) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', v.x);
      c.setAttribute('cy', -v.y);
      c.setAttribute('r', 40);
      c.setAttribute('class', 'sv-angolo');
      svg.appendChild(c);
    });

    // Mobili liberi: sopra a muri e quote, così restano sempre toccabili
    const gMob = el('g', { class: 'sv-mobili-liberi' });
    (progetto.mobiliLiberi || []).forEach((m) => {
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
  // Area di tocco invisibile e ingrandita: i mobili piccoli (regletta) o
  // sottili restano facili da selezionare e trascinare col dito.
  const [hcx, hcy] = versoSvg(0, 0);
  g.appendChild(el('circle', {
    cx: hcx, cy: hcy, r: Math.max(hw, hd, 90) + 70,
    class: 'sv-mob-hit', 'data-mob-id': m.id,
  }));
  // Pensile angolo a L: contorno a 6 vertici (incavo fronte-destra), coerente
  // con la geometria 3D a L. Gli altri mobili: rettangolo a 4 vertici.
  let cornersLocali;
  if (m.tipo === 'pensile-angolo') {
    const prof = PROFONDITA_PENSILE;
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
    transform: m.rot ? `rotate(${-m.rot} ${cx} ${cy})` : null,
  });
  txt.style.fontSize = `${fs}px`;
  const r1 = el('tspan', { x: cx, dy: -fs * 0.6 });
  r1.textContent = nome;
  const r2 = el('tspan', { x: cx, dy: fs * 1.2, class: 'sv-mod-label-mis' });
  r2.textContent = descrizioneMobile(m);
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
