// =============================================================================
// FOTO DEI PARAMETRI — per ogni parametro (⚙ Impostazioni → Parametri) una o più foto:
// un promemoria visivo di cosa vuol dire quel numero (es. dove si misura l'aria, il binario…).
// =============================================================================
// Le foto stanno sul dispositivo (insieme a quelle del catalogo: 'parfoto:<id>'), l'elenco per
// parametro in localStorage 'ng-parametri-foto' → la «copia completa» le porta anche sugli altri.
// Il pulsante «Rimetti i valori di partenza» cambia solo i numeri: le foto restano.
// =============================================================================
import { leggiFoto, salvaFoto, eliminaFotoTipo } from './catalogo.js?v=20261126w';

const CHIAVE = 'ng-parametri-foto';
const TIPO = 'parfoto';
const LATO_MAX = 2000;            // foto del telefono rimpicciolite (nitide, ma la copia resta leggera)
const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function elenco() {
  try { const j = JSON.parse(localStorage.getItem(CHIAVE) || '{}'); return j && typeof j === 'object' ? j : {}; } catch (_) { return {}; }
}
function salvaElenco(e) { try { localStorage.setItem(CHIAVE, JSON.stringify(e)); } catch (_) { /* spazio pieno */ } }
export function fotoDi(chiave) { return (elenco()[chiave] || []).slice(); }

/** Foto del telefono → JPEG (lato lungo al massimo LATO_MAX), girata giusta. */
async function preparaFotoParametro(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error(t('Questa foto non si apre.'))); i.src = url; });
    const W0 = img.naturalWidth, H0 = img.naturalHeight, k = Math.min(1, LATO_MAX / Math.max(W0, H0));
    const c = document.createElement('canvas'); c.width = Math.round(W0 * k); c.height = Math.round(H0 * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b || file), 'image/jpeg', 0.88));
  } finally { URL.revokeObjectURL(url); }
}
async function aggiungi(chiave, files) {
  const e = elenco(), lista = e[chiave] || [];
  for (const f of files) {
    if (!f || !/^image\//.test(f.type || 'image/')) continue;
    const id = 'pf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await salvaFoto(id, await preparaFotoParametro(f), TIPO);
    lista.push(id);
  }
  e[chiave] = lista; salvaElenco(e);
}
async function togli(chiave, id) {
  const e = elenco();
  e[chiave] = (e[chiave] || []).filter((x) => x !== id);
  if (!e[chiave].length) delete e[chiave];
  salvaElenco(e);
  try { await eliminaFotoTipo(id, TIPO); } catch (_) { /* già tolta */ }
}

/** Il riquadro delle foto di un parametro (miniature + «+ Foto»). */
export function htmlFotoParametro(chiave) {
  return `<div class="par-foto" data-foto-par="${esc(chiave)}">
    <span class="par-foto-lista"></span>
    <label class="par-foto-agg">📷 <span>+ Foto</span><input type="file" accept="image/*" multiple hidden></label>
  </div>`;
}

const _url = new Map();          // id → objectURL (una volta sola per pagina)
async function urlDi(id) {
  if (_url.has(id)) return _url.get(id);
  const b = await leggiFoto(id, TIPO);
  const u = b ? URL.createObjectURL(b) : null;
  if (u) _url.set(id, u);
  return u;
}
async function riempi(box) {
  const chiave = box.dataset.fotoPar, lista = box.querySelector('.par-foto-lista');
  const ids = fotoDi(chiave);
  const urls = await Promise.all(ids.map(urlDi));
  lista.innerHTML = ids.map((id, i) => urls[i]
    ? `<button type="button" class="par-foto-min" data-foto-id="${esc(id)}" title="${esc(t('Apri la foto'))}"><img src="${urls[i]}" alt=""></button>` : '').join('');
  lista.querySelectorAll('.par-foto-min').forEach((b, i) => b.addEventListener('click', () => apriVisore(chiave, i, () => riempi(box))));
}

/** Aggancia tutti i riquadri foto dentro root. */
export function agganciaFotoParametri(root) {
  root.querySelectorAll('.par-foto[data-foto-par]').forEach((box) => {
    riempi(box);
    const inp = box.querySelector('input[type=file]');
    inp.addEventListener('change', async () => {
      const files = [...(inp.files || [])]; inp.value = '';
      if (!files.length) return;
      const et = box.querySelector('.par-foto-agg span'), prima = et.textContent;
      et.textContent = '…';
      try { await aggiungi(box.dataset.fotoPar, files); } catch (e) { alert(e.message || t('Foto non salvata.')); }
      et.textContent = prima;
      riempi(box);
    });
  });
}

// ---------------------------------------------------------------- foto a schermo intero
function apriVisore(chiave, i0, dopo) {
  const ids = fotoDi(chiave);
  if (!ids.length) return;
  let i = Math.max(0, Math.min(ids.length - 1, i0));
  const v = document.createElement('div');
  v.className = 'par-visore';
  v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = `<div class="par-visore-su"><span class="par-visore-conta" data-no-i18n></span>
      <button type="button" class="par-visore-btn" data-azione="togli">🗑 ${esc(t('Togli'))}</button>
      <button type="button" class="par-visore-btn" data-azione="chiudi" aria-label="${esc(t('Chiudi'))}">✕</button></div>
    <div class="par-visore-foto"><img alt="">
      <button type="button" class="par-visore-freccia sx" data-azione="prec" aria-label="‹">‹</button>
      <button type="button" class="par-visore-freccia dx" data-azione="succ" aria-label="›">›</button></div>`;
  document.body.appendChild(v);
  const img = v.querySelector('img');
  const mostra = async () => {
    const l = fotoDi(chiave);
    if (!l.length) { chiudi(); return; }
    i = (i + l.length) % l.length;
    v.querySelector('.par-visore-conta').textContent = `${i + 1} / ${l.length}`;
    v.querySelectorAll('.par-visore-freccia').forEach((b) => { b.hidden = l.length < 2; });
    img.src = (await urlDi(l[i])) || '';
  };
  const chiudi = () => { v.remove(); document.removeEventListener('keydown', tasti); if (dopo) dopo(); };
  const tasti = (e) => { if (e.key === 'Escape') chiudi(); else if (e.key === 'ArrowLeft') { i--; mostra(); } else if (e.key === 'ArrowRight') { i++; mostra(); } };
  document.addEventListener('keydown', tasti);
  v.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-azione]');
    if (!a) { if (e.target === v) chiudi(); return; }
    if (a.dataset.azione === 'chiudi') chiudi();
    else if (a.dataset.azione === 'prec') { i--; mostra(); }
    else if (a.dataset.azione === 'succ') { i++; mostra(); }
    else if (a.dataset.azione === 'togli') {
      if (!confirm(t('Togliere questa foto?'))) return;
      const l = fotoDi(chiave); await togli(chiave, l[i]); mostra();
    }
  });
  // scorrere col dito: a destra / sinistra la foto dopo / prima
  let x0 = null;
  v.querySelector('.par-visore-foto').addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-azione]')) x0 = e.clientX; });
  v.querySelector('.par-visore-foto').addEventListener('pointerup', (e) => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 45) { i += dx < 0 ? 1 : -1; mostra(); }
  });
  mostra();
}
