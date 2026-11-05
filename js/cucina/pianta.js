// =============================================================================
// RENDERING SVG della pianta (vista dall'alto, in scala)
// =============================================================================
// Disegna il perimetro delle pareti con quote, griglia 100 mm e indicazione
// del lato interno. Il SVG usa un viewBox in MM così che tutto sia in scala
// reale (basta che Three.js e co. restino coerenti con le misure in mm).
// =============================================================================

import { calcolaVertici, bboxPerimetro } from './modello.js';

const MARGINE_MM = 800;        // margine attorno al perimetro (mm)
const PASSO_GRIGLIA = 100;     // mm (passo primario)
const PASSO_GRIGLIA_MAGG = 1000; // mm (linea più visibile ogni 1 m)

export function renderPianta(svg, progetto) {
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
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pareti.forEach((p, i) => {
      const a = vertici[i];
      const b = vertici[i + 1];
      const confermato = progetto.pianoConfermato;
      // y SVG invertita
      const ax = a.x, ay = -a.y;
      const bx = b.x, by = -b.y;

      // Linea parete (grosso tratto oro)
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', ax); l.setAttribute('y1', ay);
      l.setAttribute('x2', bx); l.setAttribute('y2', by);
      l.setAttribute('class', 'sv-parete' + (confermato ? ' sv-parete-conf' : ''));
      g.appendChild(l);

      // Indicatore lato interno (lineetta parallela dal lato giusto)
      g.appendChild(renderLatoInterno(a, b, p));

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
