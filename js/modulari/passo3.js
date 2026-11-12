// =============================================================================
// MOBILI MODULARI — Passo 3: Rendering 3D (finiture, viste, salva immagine)
// =============================================================================
import { MATERIALI } from '../materiali.js?v=20261111b';
import { layoutModuli, SPESSORI_DEFAULT } from './calcoli.js?v=20261112f';
import { monta, aggiorna, attivaRendering, inquadra, salvaImmagine, impostaAnte, anteSonoAperte } from './scena3d.js?v=20261112f';
import { apriDistinta } from './passo2.js?v=20261112f';

const FINITURE = MATERIALI.filter((m) => m.categoria === 'legno' || m.categoria === 'tinta');
export const MATERIALI_DEFAULT = { struttura: 'roble-hera', ante: 'roble-denver' };
// Forme dove l'inclinata può essere una scala; di default la scala si vede
// sul sottoscala vero (triangolo, con muretto), non sulla mansarda.
const CON_INCLINATA = ['triangolo', 'trapezio', 'mansarda'];
const SCALA_DEFAULT = ['triangolo', 'trapezio'];
function conScala() {
  const f = ctx.forma.forma;
  if (!CON_INCLINATA.includes(f)) return false;
  const v = (ctx.stato.gradini || {})[f];
  return v == null ? SCALA_DEFAULT.includes(f) : !!v;
}

let ctx = null;

/** Elementi da disegnare (moduli o cubi) nel formato del motore 3D. */
function elementi() {
  const { stato, forma } = ctx;
  if (stato.modalita === 'cubi') {
    return (stato.cubi || []).map((c) => ({ x0: c.x, y0: c.y, L: c.w, hL: c.h, hR: c.h,
      ante: c.fronte === 'anta' ? 1 : 0, lato: c.lato, ripiani: c.ripiani || 0 }));
  }
  const sp = { ...SPESSORI_DEFAULT, ...(stato.spessori || {}) };
  return layoutModuli(forma, stato.moduli, sp).moduli.map((m) => ({ x0: m.x0, y0: 0, L: m.larghezza,
    hL: m.hL, hR: m.hR, ante: Number(m.ante) || 0, lato: m.lato, ripiani: m.ripiani || 0 }));
}

export function esci3d() { attivaRendering(false); }

export function renderPasso3(c) {
  ctx = c;
  const { stato } = ctx;
  stato.materiali = { ...MATERIALI_DEFAULT, ...(stato.materiali || {}) };
  monta(ctx.canvas);
  attivaRendering(true);
  disegna(true);       // all'ingresso nel 3D inquadro sempre (lo schermo può essere cambiato)
  renderPannello();
  renderRiepilogo();
}

function disegna(reinquadra) {
  const { stato, forma } = ctx;
  aggiorna(forma, elementi(), {
    P: stato.profondita || 600,
    spessori: { ...SPESSORI_DEFAULT, ...(stato.spessori || {}) },
    materiali: stato.materiali,
    conGradini: conScala(),
    reinquadra,
  });
}

// Stessa grafica della cucina: quadratini del campione (nome nel tooltip e nel titolo).
function palette(parte) {
  const { esc } = ctx;
  const sel = ctx.stato.materiali[parte];
  return `<div class="palette-colori">${FINITURE.map((m) => `<button type="button" class="swatch ${m.id === sel ? 'sel' : ''}"
    data-parte="${parte}" data-mat="${m.id}" title="${esc(m.nome)}" aria-label="${esc(m.nome)}" style="background-image:url('${m.thumb}')"></button>`).join('')}</div>`;
}

function renderPannello() {
  const { stato, esc } = ctx;
  const nome = (id) => esc((FINITURE.find((m) => m.id === id) || {}).nome || id);
  ctx.pannello.innerHTML = `
    <section>
      <h3>Vista</h3>
      <div class="mod-azioni">
        <button type="button" class="btn-ghost" data-vista="tre4">3/4</button>
        <button type="button" class="btn-ghost" data-vista="frontale">Frontale</button>
      </div>
      <button type="button" class="btn-ghost ${anteSonoAperte() ? 'attivo' : ''}" id="p3-ante" style="width:100%;margin-top:8px">${anteSonoAperte() ? '🚪 Chiudi ante' : '🚪 Apri ante'}</button>
      <button type="button" class="btn-oro" id="p3-foto" style="width:100%;margin-top:8px">📷 Salva immagine</button>
      <p class="mod-prossimo">Trascina per girare, due dita o rotella per lo zoom.</p>
      ${CON_INCLINATA.includes(ctx.forma.forma) ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="p3-scala" ${conScala() ? 'checked' : ''}> Scala sopra l'inclinata</label>` : ''}
    </section>
    <section>
      <h3>Struttura · ${nome(stato.materiali.struttura)}</h3>
      <p class="mod-prossimo" style="margin-top:0">Carcassa, schiena e ripiani.</p>
      ${palette('struttura')}
    </section>
    <section>
      <h3>Ante · ${nome(stato.materiali.ante)}</h3>
      ${palette('ante')}
    </section>`;
  const P = ctx.pannello;
  P.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => inquadra(b.dataset.vista)));
  P.querySelector('#p3-ante').addEventListener('click', (ev) => {
    impostaAnte(!anteSonoAperte());
    ev.currentTarget.textContent = anteSonoAperte() ? '🚪 Chiudi ante' : '🚪 Apri ante';
    ev.currentTarget.classList.toggle('attivo', anteSonoAperte());
  });
  P.querySelector('#p3-foto').addEventListener('click', () => {
    if (!salvaImmagine('mobili-modulari.png')) alert('Non sono riuscito a salvare l\'immagine.');
  });
  const sc = P.querySelector('#p3-scala');
  if (sc) sc.addEventListener('change', () => {
    (stato.gradini ||= {})[ctx.forma.forma] = sc.checked; ctx.salva(); disegna(false);
  });
  P.querySelectorAll('.swatch[data-mat]').forEach((b) => b.addEventListener('click', () => {
    stato.materiali[b.dataset.parte] = b.dataset.mat;
    ctx.salva(); disegna(false); renderPannello();
  }));
}

function renderRiepilogo() {
  const { stato, forma, fmt } = ctx;
  const n = elementi().length;
  ctx.riepilogo.innerHTML = `
    <h3>Rendering 3D</h3>
    <div class="riep-riga"><span>${stato.modalita === 'cubi' ? 'Cubi' : 'Moduli'}</span><strong>${fmt(n)}</strong></div>
    <div class="riep-riga"><span>Vano</span><strong>${fmt(forma.larghezza)} × ${fmt(forma.altezzaMax)}</strong></div>
    <div class="riep-riga"><span>Profondità</span><strong>${fmt(stato.profondita)} mm</strong></div>
    ${n ? '' : '<div class="mod-msg avv">Non ci sono ancora moduli o cubi: aggiungili al passo 2.</div>'}
    <button type="button" class="btn-oro" id="p3-distinta" style="width:100%;margin-top:14px">📋 Distinta di taglio</button>
    <button type="button" class="btn-ghost" id="p3-indietro" style="width:100%;margin-top:8px">← Moduli</button>`;
  ctx.riepilogo.querySelector('#p3-distinta').addEventListener('click', () => apriDistinta(ctx));
  ctx.riepilogo.querySelector('#p3-indietro').addEventListener('click', () => { stato.step = 2; ctx.salva(); ctx.aggiorna(); });
}
