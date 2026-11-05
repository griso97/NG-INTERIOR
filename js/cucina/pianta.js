// =============================================================================
// RENDERING SVG della pianta (vista dall'alto, in scala)
// =============================================================================
// Disegna il perimetro delle pareti con quote, griglia 100 mm e indicazione
// del lato interno. Il SVG usa un viewBox in MM così che tutto sia in scala
// reale (basta che Three.js e co. restino coerenti con le misure in mm).
// =============================================================================

import {
  calcolaVertici, bboxPerimetro,
  moduliDiParete, nomeTipo, PROFONDITA_BASE,
} from './modello.js';

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
    // Prima disegno i MODULI (così stanno sotto le linee della parete)
    const gMod = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pareti.forEach((p, i) => {
      const a = vertici[i], b = vertici[i + 1];
      const mods = moduliDiParete(progetto, p.id);
      mods.forEach((m) => {
        gMod.appendChild(renderModuloInPianta(a, b, p, m));
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

/**
 * Disegna un modulo (base o fascia) come rettangolo sulla parete, verso il
 * lato interno, con etichetta "nome · larghezza mm".
 */
function renderModuloInPianta(a, b, parete, modulo) {
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

  // Etichetta "tipo · larghezza" al centro del rettangolo
  const cx = (p1x + p3x) / 2;
  const cy = -((p1y + p3y) / 2);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', cx);
  txt.setAttribute('y', cy);
  txt.setAttribute('class', 'sv-mod-label');
  const nome = nomeTipo(modulo.tipo);
  txt.textContent = `${nome} · ${modulo.larghezza_mm}`;
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
