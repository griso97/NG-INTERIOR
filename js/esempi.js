// =============================================================================
// CUCINE DI ESEMPIO — galleria da far vedere al cliente
// =============================================================================
// Pagina leggera: carica solo l'elenco (esempi/cucine/indice.json) e le anteprime
// piccole. La foto grande si scarica quando la apri; il progetto 3D solo quando
// scegli «Usala per un cliente»: allora una COPIA dell'esempio diventa un
// preventivo nuovo con il nome del cliente e si apre nella cucina (l'esempio, che
// è un file del sito, resta sempre com'è).
// =============================================================================

import { nuovoDaEsempio } from './preventivi.js?v=20261122t';

const VER = '20261122t';
const CARTELLA = 'esempi/cucine/';
const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
const lingua = () => (window.NGI18N && window.NGI18N.lingua === 'es' ? 'es' : 'it');
const testo = (v) => (v && typeof v === 'object' ? (v[lingua()] || v.it || '') : (v || ''));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);

let cucine = [], indice = 0;

async function carica() {
  try {
    const r = await fetch(`${CARTELLA}indice.json?v=${VER}`);
    const j = await r.json();
    cucine = Array.isArray(j.cucine) ? j.cucine : [];
  } catch (_) { cucine = []; }
  const g = $('griglia');
  g.innerHTML = cucine.map((c, i) => `
    <button type="button" class="voce" data-i="${i}">
      <div class="foto"><img src="${CARTELLA}${esc(c.mini)}?v=${VER}" alt="${esc(testo(c.nome))}" loading="lazy" decoding="async"></div>
      <div class="testo"><div class="nome">${esc(testo(c.nome))}</div><div class="desc">${esc(testo(c.breve || c.desc))}</div></div>
    </button>`).join('');
  $('vuoto').hidden = cucine.length > 0;
  g.querySelectorAll('.voce').forEach((b) => b.addEventListener('click', () => apri(Number(b.dataset.i))));
}

// ---------------------------------------------------------------- foto a schermo intero
const lb = $('lb'), img = $('lb-img');
let ultimoFuoco = null;
function mostra(i) {
  if (!cucine.length) return;
  indice = (i + cucine.length) % cucine.length;
  const c = cucine[indice];
  img.style.opacity = '0.35';
  img.onload = () => { img.style.opacity = '1'; };
  img.src = `${CARTELLA}${c.grande}?v=${VER}`;
  img.alt = testo(c.nome);
  $('lb-conta').textContent = `${indice + 1} / ${cucine.length}`;
  $('lb-nome').textContent = testo(c.nome);
  $('lb-desc').textContent = testo(c.desc);
  // le vicine si preparano già (scorrere è subito pronto)
  for (const d of [-1, 1]) { const v = cucine[(indice + d + cucine.length) % cucine.length]; if (v) new Image().src = `${CARTELLA}${v.grande}?v=${VER}`; }
}
function apri(i) {
  ultimoFuoco = document.activeElement;
  lb.hidden = false; document.body.style.overflow = 'hidden';
  mostra(i);
  $('lb-chiudi').focus();
}
function chiudiLb() {
  lb.hidden = true; document.body.style.overflow = '';
  if (ultimoFuoco && ultimoFuoco.focus) ultimoFuoco.focus();
}
$('lb-chiudi').addEventListener('click', chiudiLb);
$('lb-prec').addEventListener('click', () => mostra(indice - 1));
$('lb-succ').addEventListener('click', () => mostra(indice + 1));
$('lb-usa').addEventListener('click', () => chiediNome());
document.addEventListener('keydown', (e) => {
  if (!$('dlg').hidden) { if (e.key === 'Escape') chiudiDlg(); return; }
  if (lb.hidden) return;
  if (e.key === 'Escape') chiudiLb();
  else if (e.key === 'ArrowLeft') mostra(indice - 1);
  else if (e.key === 'ArrowRight') mostra(indice + 1);
});
// scorrere col dito: a destra/sinistra cambia cucina; un tocco fermo sulla foto = parti da questa
{
  let x0 = null, y0 = null, t0 = 0;
  const zona = $('lb-foto');
  zona.addEventListener('pointerdown', (e) => { if (e.target.closest('.lb-freccia')) return; x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
  zona.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { mostra(indice + (dx < 0 ? 1 : -1)); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - t0 < 600 && e.target === img) chiediNome();
  });
  zona.addEventListener('pointercancel', () => { x0 = null; });
}

// ---------------------------------------------------------------- nome del cliente → copia
const dlg = $('dlg'), inp = $('dlg-nome'), msg = $('dlg-msg');
function chiediNome() {
  const c = cucine[indice]; if (!c) return;
  $('dlg-da').textContent = testo(c.nome);
  inp.value = ''; msg.hidden = true; msg.style.color = '';
  dlg.hidden = false;
  setTimeout(() => inp.focus(), 50);
}
function chiudiDlg() { dlg.hidden = true; }
dlg.addEventListener('click', (e) => { if (e.target === dlg) chiudiDlg(); });
$('dlg-annulla').addEventListener('click', chiudiDlg);
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') crea(); });
$('dlg-ok').addEventListener('click', crea);
let inCorso = false;
async function crea() {
  if (inCorso) return;
  const c = cucine[indice], nome = inp.value.trim();
  if (!nome) { msg.hidden = false; msg.textContent = t('Scrivi il nome del cliente.'); inp.focus(); return; }
  inCorso = true; $('dlg-ok').disabled = true;
  try {
    const r = await fetch(`${CARTELLA}${c.file}?v=${VER}`);
    if (!r.ok) throw new Error(t('Non riesco a scaricare questa cucina. Controlla la connessione e riprova.'));
    const dati = await r.json();
    const esito = await nuovoDaEsempio(c.tipo === 'cucinaPonte' ? 'cucinaPonte' : 'cucina', nome, dati);
    if (!esito.sicurezza) { location.href = esito.pagina; return; }
    // il progetto aperto prima non era salvato: è nei Preventivi (lo dico, poi si apre la cucina)
    msg.hidden = false; msg.style.color = '#9fd49f';
    msg.innerHTML = `${esc(t('Il progetto che avevi aperto non era salvato: l\'ho messo nei Preventivi come'))} «<span data-no-i18n>${esc(esito.sicurezza)}</span>».`;
    const ok = $('dlg-ok'); ok.disabled = false; ok.textContent = t('Apri la cucina →');
    ok.replaceWith(ok.cloneNode(true)); $('dlg-ok').addEventListener('click', () => { location.href = esito.pagina; });
    $('dlg-annulla').hidden = true;
  } catch (e) {
    msg.hidden = false; msg.textContent = e.message || t('Non sono riuscito a creare il progetto.');
    inCorso = false; $('dlg-ok').disabled = false;
  }
}

carica();
