// =============================================================================
// MOBILI MODULARI — Passo 3: Rendering 3D (finiture, viste, salva immagine)
// =============================================================================
import { materialiPer } from '../materiali.js?v=20261115d';
import { layoutModuli, layoutCubi, finitureDi, MATERIALI_DEFAULT, SPESSORI_DEFAULT } from './calcoli.js?v=20261115d';
import { monta, aggiorna, attivaRendering, inquadra, salvaImmagine, impostaAnte, anteSonoAperte } from './scena3d.js?v=20261115d';
import { apriDistinta } from './passo2.js?v=20261115d';

let FINITURE = materialiPer('legno');          // dal catalogo (si rilegge a ogni pannello)
export { MATERIALI_DEFAULT };
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

const spessori = () => ({ ...SPESSORI_DEFAULT, ...(ctx.stato.spessori || {}) });
let selMod = null;        // modulo/cubo scelto per le finiture (modalità "diversi")

/** Modulo di chiusura in fondo (moduli o cubi), con le sue finiture. */
function chiusura() {
  const { stato, forma } = ctx;
  const ch = stato.modalita === 'cubi' ? layoutCubi(forma, stato, spessori()).chiusura
    : layoutModuli(forma, stato.moduli, spessori()).chiusura;
  return ch ? { ...ch, chiave: 'chiusura', nome: 'C', mat: finitureDi(stato.materiali, 'chiusura') } : null;
}

/** Elementi da disegnare (moduli o cubi) nel formato del motore 3D. */
function elementi() {
  const { stato, forma } = ctx;
  if (stato.modalita === 'cubi') {
    const lc = layoutCubi(forma, stato, spessori());
    return (stato.cubi || []).map((c, i) => ({ chiave: `c:${c.id}`, nome: `Cubo ${i + 1}`, x0: c.x, y0: c.y, L: c.w,
      hL: lc.elementi[i].hL, hR: lc.elementi[i].hR, ante: c.fronte === 'anta' ? 1 : 0, lato: c.lato, ripiani: c.ripiani || 0,
      mat: finitureDi(stato.materiali, `c:${c.id}`) }));
  }
  return layoutModuli(forma, stato.moduli, spessori()).moduli.map((m) => ({ chiave: `m${m.indice}`, nome: `M${m.indice + 1}`,
    x0: m.x0, y0: 0, L: m.larghezza, hL: m.hL, hR: m.hR, ante: Number(m.ante) || 0, lato: m.lato, ripiani: m.ripiani || 0,
    mat: finitureDi(stato.materiali, `m${m.indice}`) }));
}
/** Tutti i pezzi a cui si può dare una finitura (per la scelta "diversi"). */
function scegliibili() {
  const ch = chiusura();
  return [...elementi(), ...(ch && ch.fronte !== 'no' ? [ch] : [])];
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
    chiusura: chiusura(),
    reinquadra,
  });
}

// Stessa grafica della cucina: quadratini del campione (nome nel tooltip e nel titolo).
function palette(parte, sel) {
  const { esc } = ctx;
  return `<div class="palette-colori">${FINITURE.map((m) => `<button type="button" class="swatch ${m.id === sel ? 'sel' : ''}"
    data-parte="${parte}" data-mat="${m.id}" title="${esc(m.nome)}" aria-label="${esc(m.nome)}" style="background-image:url('${m.thumb}')"></button>`).join('')}</div>`;
}

function renderPannello() {
  FINITURE = materialiPer('legno');
  const { stato, esc } = ctx;
  const M = stato.materiali;
  const nome = (id) => esc((FINITURE.find((m) => m.id === id) || {}).nome || id);
  const lista = scegliibili();
  if (!lista.some((e) => e.chiave === selMod)) selMod = lista[0]?.chiave ?? null;
  const diversi = !!M.diversi && lista.length > 0;
  const cur = diversi ? finitureDi(M, selMod) : { struttura: M.struttura, ante: M.ante };
  const dove = diversi ? ` · ${esc((lista.find((e) => e.chiave === selMod) || {}).nome || '')}` : '';
  const personalizzato = (k) => !!(M.per && M.per[k] && (M.per[k].struttura || M.per[k].ante));
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
      <h3>Colori dei moduli</h3>
      <div class="mod-switch">
        <button type="button" class="btn-ghost ${!diversi ? 'attivo' : ''}" data-colori="uguali">Tutti uguali</button>
        <button type="button" class="btn-ghost ${diversi ? 'attivo' : ''}" data-colori="diversi">Diversi per modulo</button>
      </div>
      ${diversi ? `
      <p class="mod-prossimo">Scegli il modulo, poi struttura e ante qui sotto.</p>
      <div class="chips-misura" style="margin-top:6px">${lista.map((e) => `<button type="button" class="btn-mini mod-chip ${e.chiave === selMod ? 'attivo' : ''}" data-mod="${esc(e.chiave)}"
        title="${esc(e.nome)}">${esc(e.nome)}${personalizzato(e.chiave) ? ' •' : ''}</button>`).join('')}</div>
      <button type="button" class="btn-ghost" id="p3-tutti" style="width:100%">Usa questi colori per tutti</button>` : ''}
    </section>
    <section>
      <h3>Struttura${dove} · ${nome(cur.struttura)}</h3>
      <p class="mod-prossimo" style="margin-top:0">Carcassa, schiena e ripiani.</p>
      ${palette('struttura', cur.struttura)}
    </section>
    <section>
      <h3>Ante${dove} · ${nome(cur.ante)}</h3>
      ${stato.modalita === 'cubi' && (stato.cubi || []).length ? `<div class="mod-azioni" style="margin:0 0 10px">
        <button type="button" class="btn-ghost ${stato.cubi.every((c) => c.fronte === 'anta') ? 'attivo' : ''}" data-tutti-fronte="anta">🚪 Tutti con anta</button>
        <button type="button" class="btn-ghost ${stato.cubi.every((c) => c.fronte !== 'anta') ? 'attivo' : ''}" data-tutti-fronte="aperto">Tutti aperti</button>
      </div>` : ''}
      ${palette('ante', cur.ante)}
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
  P.querySelectorAll('[data-colori]').forEach((b) => b.addEventListener('click', () => {
    M.diversi = b.dataset.colori === 'diversi'; M.per ||= {};
    ctx.salva(); disegna(false); renderPannello();
  }));
  P.querySelectorAll('[data-tutti-fronte]').forEach((b) => b.addEventListener('click', () => {
    stato.cubi.forEach((c) => { c.fronte = b.dataset.tuttiFronte; });
    stato.nuovoCubo = { ...(stato.nuovoCubo || {}), fronte: b.dataset.tuttiFronte };
    ctx.salva(); disegna(false); renderPannello();
  }));
  P.querySelectorAll('.mod-chip').forEach((b) => b.addEventListener('click', () => { selMod = b.dataset.mod; renderPannello(); }));
  const tutti = P.querySelector('#p3-tutti');
  if (tutti) tutti.addEventListener('click', () => {
    M.struttura = cur.struttura; M.ante = cur.ante; M.per = {};
    ctx.salva(); disegna(false); renderPannello();
  });
  P.querySelectorAll('.swatch[data-mat]').forEach((b) => b.addEventListener('click', () => {
    const parte = b.dataset.parte, id = b.dataset.mat;
    if (diversi) { M.per ||= {}; M.per[selMod] = { ...(M.per[selMod] || {}), [parte]: id }; }
    else M[parte] = id;
    ctx.salva(); disegna(false); renderPannello();
  }));
}

function renderRiepilogo() {
  const { stato, forma, fmt } = ctx;
  const n = elementi().length + (chiusura() ? 1 : 0);
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
