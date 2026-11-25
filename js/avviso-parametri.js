// =============================================================================
// AVVISO «MANCANO DELLE IMPOSTAZIONI» nelle distinte (armadi e cucina)
// =============================================================================
// Le impostazioni saltate nella configurazione guidata restano a 0: la distinta che le usa non è
// completa. Sopra la distinta compare l'avviso con cosa manca; esportando si chiede
// «Vuoi esportarla comunque?». Quando il falegname le imposta in ⚙ Parametri l'avviso sparisce.
// =============================================================================
import { GRUPPI_DA_IMPOSTARE } from './parametri.js?v=20261127c';

const t = (s) => (typeof window !== 'undefined' && window.NGI18N ? window.NGI18N.t(s) : s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let _stile = false;
function stile() {
  if (_stile || typeof document === 'undefined') return; _stile = true;
  const st = document.createElement('style');
  st.textContent = `
  .avviso-mancanti{margin:0 0 12px;padding:12px 14px;border-radius:10px;border:1px solid #c0392b;background:rgba(192,57,43,.12);color:#f3d9d4;font-size:13px;line-height:1.45}
  .avviso-mancanti b{color:#ff9b8c}
  .avviso-mancanti ul{margin:6px 0 8px 18px;padding:0}
  .avviso-mancanti a{color:#e8c25a;font-weight:600}
  .conferma-esporta{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}
  .conferma-esporta .box{max-width:440px;width:100%;background:#14110d;border:1px solid #c0392b;border-radius:14px;padding:18px;color:#f3efe6;font:14px/1.5 var(--font-ui,sans-serif)}
  .conferma-esporta h3{margin:0 0 8px;color:#ff9b8c;font-size:17px}
  .conferma-esporta ul{margin:6px 0 10px 18px;padding:0}
  .conferma-esporta .riga{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
  .conferma-esporta button{all:unset;cursor:pointer;padding:11px 18px;border-radius:999px;font-weight:600;font-size:14px}
  .conferma-esporta .no{border:1px solid #6a5a36;color:#e6dcc6}
  .conferma-esporta .si{background:linear-gradient(180deg,#e8c25a,#a77c16);color:#14110d}
  .conferma-esporta .si[aria-disabled="true"]{opacity:.4;cursor:not-allowed}
  .conferma-esporta label.spunta{display:flex;gap:10px;align-items:flex-start;margin-top:12px;cursor:pointer}
  .conferma-esporta label.spunta input{margin-top:3px;width:18px;height:18px;flex:none}`;
  document.head.appendChild(st);
}

const elenco = (lista) => `<ul>${lista.map((g) => `<li>${esc(t(GRUPPI_DA_IMPOSTARE[g] || g))}</li>`).join('')}</ul>`;

/** L'avviso sopra la distinta ('' se non manca niente). */
export function htmlAvvisoMancanti(lista) {
  if (!lista || !lista.length) return '';
  stile();
  return `<div class="avviso-mancanti" role="alert">⚠ <b>${esc(t('Distinta non completa: manca l\'impostazione di'))}</b>${elenco(lista)}
    ${esc(t('Questi valori sono a 0. Impostali in'))} <a href="./impostazioni.html#parametri">⚙ ${esc(t('Impostazioni → Parametri'))}</a>.</div>`;
}

/**
 * Prima di esportare: se manca qualcosa chiede «Vuoi esportarla comunque?».
 * Ritorna una Promise: true = esporta, false = no.
 */
export function confermaEsportazione(lista) {
  if (!lista || !lista.length || typeof document === 'undefined') return Promise.resolve(true);
  stile();
  return new Promise((ok) => {
    const ov = document.createElement('div');
    ov.className = 'conferma-esporta';
    ov.innerHTML = `<div class="box" role="dialog" aria-modal="true">
      <h3>⚠ ${esc(t('La distinta non è completa'))}</h3>
      <div>${esc(t('Manca l\'impostazione di:'))}</div>${elenco(lista)}
      <div>${esc(t('Questi valori sono a 0, quindi alcune misure non sono giuste. Vuoi esportarla comunque?'))}</div>
      <div class="riga"><button type="button" class="no">${esc(t('No'))}</button><button type="button" class="si">${esc(t('Sì, esporta'))}</button></div>
    </div>`;
    const fine = (v) => { ov.remove(); ok(v); };
    ov.querySelector('.no').addEventListener('click', () => fine(false));
    ov.querySelector('.si').addEventListener('click', () => fine(true));
    ov.addEventListener('click', (e) => { if (e.target === ov) fine(false); });
    document.body.appendChild(ov);
  });
}

/**
 * Prima di esportare la cucina: le misure del PIANO DI LAVORO da controllare. Ogni materiale (encimera) ha le sue
 * lastre: un piano più lungo della lastra va giuntato. `piani` = [{ nome, larghezza, altezza, spessore, quantita,
 * materialeNome }]. Ritorna una Promise: true = esporta.
 */
export function confermaPianoLavoro(piani) {
  if (!piani || !piani.length || typeof document === 'undefined') return Promise.resolve(true);
  stile();
  const mis = (p) => `${p.larghezza} × ${p.altezza} × ${p.spessore} mm${p.quantita > 1 ? ` × ${p.quantita}` : ''}${p.materialeNome ? ` · ${p.materialeNome}` : ''}`;
  return new Promise((ok) => {
    const ov = document.createElement('div');
    ov.className = 'conferma-esporta';
    // data-no-i18n: i testi sono già tradotti qui (il traduttore della pagina rifarebbe «largo» → «ancho»)
    ov.innerHTML = `<div class="box" role="dialog" aria-modal="true" data-no-i18n>
      <h3>⚠ ${esc(t('Controlla il piano di lavoro'))}</h3>
      <div>${esc(t('Nella distinta ci sono questi piani di lavoro (lunghezza × profondità × spessore):'))}</div>
      <ul>${piani.map((p) => `<li>${esc(t('Piano di lavoro'))} ${esc(mis(p))}</li>`).join('')}</ul>
      <div>${esc(t('Ogni materiale ha le sue misure di lastra: controlla che il piano scelto esista in queste misure e che non sia più lungo della lastra vera. Se è più lungo, va giuntato: decidi tu dove.'))}</div>
      <div class="riga"><button type="button" class="no">${esc(t('Annulla'))}</button><button type="button" class="si">${esc(t('Ho controllato, esporta'))}</button></div>
    </div>`;
    const fine = (v) => { ov.remove(); ok(v); };
    ov.querySelector('.no').addEventListener('click', () => fine(false));
    ov.querySelector('.si').addEventListener('click', () => fine(true));
    ov.addEventListener('click', (e) => { if (e.target === ov) fine(false); });
    document.body.appendChild(ov);
  });
}

/** L'avviso sopra la distinta: cassettiere con la maniglia esterna senza la sporgenza ('' se non manca). */
export function htmlAvvisoSporgenza(cassettiere) {
  if (!cassettiere || !cassettiere.length) return '';
  stile();
  return `<div class="avviso-mancanti" role="alert">⚠ <b>${esc(t('Manca quanto sporge la maniglia dal cassetto'))}</b>
    <ul>${cassettiere.map((n) => `<li>${esc(t('Cassettiera'))} ${n}</li>`).join('')}</ul>
    ${esc(t('Scrivila nella cassettiera («Quanto sporge la maniglia dal frontale»): senza questa misura la profondità della cassettiera e dei cassetti non si può calcolare.'))}</div>`;
}

/**
 * Prima di esportare: se una cassettiera ha la maniglia esterna senza la sporgenza scritta, avvisa.
 * Si esporta solo spuntando «Esporta comunque…». Ritorna una Promise: true = esporta.
 */
export function confermaSporgenzaManiglia(cassettiere) {
  if (!cassettiere || !cassettiere.length || typeof document === 'undefined') return Promise.resolve(true);
  stile();
  return new Promise((ok) => {
    const ov = document.createElement('div');
    ov.className = 'conferma-esporta';
    ov.innerHTML = `<div class="box" role="dialog" aria-modal="true">
      <h3>⚠ ${esc(t('Attenzione: non hai scelto quanto la maniglia sporge rispetto al cassetto'))}</h3>
      <div>${esc(t('Cassettiere senza la misura:'))}</div>
      <ul>${cassettiere.map((n) => `<li>${esc(t('Cassettiera'))} ${n}</li>`).join('')}</ul>
      <div>${esc(t('Per esportare il file seleziona la misura nella cassettiera. Senza questa misura la profondità della cassettiera e dei cassetti non è giusta.'))}</div>
      <label class="spunta"><input type="checkbox" class="comunque"><span>${esc(t('Esporta comunque, anche se la dimensione della maniglia non è stata inserita'))}</span></label>
      <div class="riga"><button type="button" class="no">${esc(t('Annulla'))}</button><button type="button" class="si" aria-disabled="true">${esc(t('Esporta'))}</button></div>
    </div>`;
    const si = ov.querySelector('.si'), spunta = ov.querySelector('.comunque');
    spunta.addEventListener('change', () => si.setAttribute('aria-disabled', spunta.checked ? 'false' : 'true'));
    const fine = (v) => { ov.remove(); ok(v); };
    ov.querySelector('.no').addEventListener('click', () => fine(false));
    si.addEventListener('click', () => { if (spunta.checked) fine(true); });
    ov.addEventListener('click', (e) => { if (e.target === ov) fine(false); });
    document.body.appendChild(ov);
  });
}
