// =============================================================================
// AVVISO «MANCANO DELLE IMPOSTAZIONI» nelle distinte (armadi e cucina)
// =============================================================================
// Le impostazioni saltate nella configurazione guidata restano a 0: la distinta che le usa non è
// completa. Sopra la distinta compare l'avviso con cosa manca; esportando si chiede
// «Vuoi esportarla comunque?». Quando il falegname le imposta in ⚙ Parametri l'avviso sparisce.
// =============================================================================
import { GRUPPI_DA_IMPOSTARE } from './parametri.js?v=20261124a';

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
  .conferma-esporta .si{background:linear-gradient(180deg,#e8c25a,#a77c16);color:#14110d}`;
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
