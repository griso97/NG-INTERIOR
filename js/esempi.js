// =============================================================================
// CUCINE DI ESEMPIO — galleria da far vedere al cliente
// =============================================================================
// Pagina leggera: carica solo l'elenco (esempi/cucine/indice.json) e le anteprime
// piccole. La foto grande si scarica quando la apri; il progetto 3D solo quando
// scegli «Usala per un cliente»: allora una COPIA dell'esempio diventa un
// preventivo nuovo con il nome del cliente e si apre nella cucina (l'esempio, che
// è un file del sito, resta sempre com'è).
// =============================================================================

import { nuovoDaEsempio, modificaEsempio } from './preventivi.js?v=20261126v';
import { esempioModificato, fotoEsempioModificato, ripristinaEsempio, progettiPredefiniti, eliminaProgettoPredefinito } from './esempi-dati.js?v=20261126v';

const VER = '20261126v';
const CARTELLA = 'esempi/cucine/';
const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
const lingua = () => (window.NGI18N && window.NGI18N.lingua === 'es' ? 'es' : 'it');
const testo = (v) => (v && typeof v === 'object' ? (v[lingua()] || v.it || '') : (v || ''));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (id) => document.getElementById(id);

let cucine = [], indice = 0;
const idDi = (c) => c.id || String(c.file || '').replace(/\.json$/, '');
const miniDi = (c) => c._mini || (c._mio ? '' : `${CARTELLA}${c.mini}?v=${VER}`);
const grandeDi = (c) => c._grande || c._mini || (c._mio ? '' : `${CARTELLA}${c.grande}?v=${VER}`);   // i miei progetti senza foto: niente

async function carica() {
  try {
    const r = await fetch(`${CARTELLA}indice.json?v=${VER}`);
    const j = await r.json();
    cucine = Array.isArray(j.cucine) ? j.cucine : [];
  } catch (_) { cucine = []; }
  // i PROGETTI PREDEFINITI del falegname («⭐ Predefinito» nella cucina): prima di tutti
  try {
    const miei = await progettiPredefiniti();
    cucine = [...miei.map((m) => ({ id: m.id, nome: m.nome, desc: m.desc, breve: m.desc, tipo: m.tipo, _mio: true })), ...cucine];
  } catch (_) { /* niente */ }
  // le cucine che il falegname ha modificato e salvato come predefinite: la SUA versione e le sue foto
  await Promise.all(cucine.map(async (c) => {
    const mod = await esempioModificato(idDi(c));
    if (!mod) return;
    c._mod = mod;
    const [mini, grande] = await Promise.all([fotoEsempioModificato(idDi(c), 'mini'), fotoEsempioModificato(idDi(c), 'grande')]);
    if (mini) c._mini = URL.createObjectURL(mini);
    if (grande) c._grande = URL.createObjectURL(grande);
  }));
  const g = $('griglia');
  g.innerHTML = cucine.map((c, i) => `
    <button type="button" class="voce" data-i="${i}">
      <div class="foto">${c._mio && !c._mini ? '<div class="senza-foto">⭐</div>' : `<img src="${miniDi(c)}" alt="${esc(testo(c.nome))}" loading="lazy" decoding="async">`}${c._mio ? `<span class="tua">${esc(t('⭐ Tuo progetto'))}</span>` : c._mod ? `<span class="tua">${esc(t('✎ La tua versione'))}</span>` : ''}</div>
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
  img.src = grandeDi(c);
  $('lb-ripristina').hidden = !c._mod || !!c._mio;
  $('lb-elimina').hidden = !c._mio;
  $('lb-modifica').textContent = t(c._mio ? '✏️ Modifica il progetto' : '✏️ Modifica l\'esempio');
  img.alt = testo(c.nome);
  $('lb-conta').textContent = `${indice + 1} / ${cucine.length}`;
  $('lb-nome').textContent = testo(c.nome);
  $('lb-desc').textContent = testo(c.desc);
  // le vicine si preparano già (scorrere è subito pronto)
  for (const d of [-1, 1]) { const v = cucine[(indice + d + cucine.length) % cucine.length]; if (v) new Image().src = grandeDi(v); }
}
// INDIETRO (tasto del telefono o del browser) con una cucina aperta: torna a TUTTE LE CUCINE, non alla
// pagina di prima. La foto aperta è un passo nella cronologia; indietro lo toglie e chiude la foto.
let lbInStoria = false;
function apri(i) {
  ultimoFuoco = document.activeElement;
  lb.hidden = false; document.body.style.overflow = 'hidden';
  mostra(i);
  if (!lbInStoria) { try { history.pushState({ ngEsempio: true }, ''); lbInStoria = true; } catch (_) { /* senza cronologia */ } }
  $('lb-chiudi').focus();
}
function nascondiLb() {
  lb.hidden = true; document.body.style.overflow = '';
  if (ultimoFuoco && ultimoFuoco.focus) ultimoFuoco.focus();
}
function chiudiLb() {
  if (lbInStoria) { history.back(); return; }             // il popstate qui sotto chiude la foto
  nascondiLb();
}
window.addEventListener('popstate', () => { lbInStoria = false; if (!lb.hidden) nascondiLb(); });
// tornando qui dalla cucina (pagina tenuta in memoria dal browser) si vedono tutte le cucine
window.addEventListener('pageshow', (e) => { if (e.persisted && !lb.hidden) { lbInStoria = false; nascondiLb(); } });
/** Va alla cucina: la foto aperta lascia il posto alla cucina, così indietro dalla cucina torna alla galleria. */
function vaiA(pagina) {
  if (lbInStoria) { lbInStoria = false; location.replace(pagina); } else location.href = pagina;
}
$('lb-chiudi').addEventListener('click', chiudiLb);
$('lb-prec').addEventListener('click', () => mostra(indice - 1));
$('lb-succ').addEventListener('click', () => mostra(indice + 1));
$('lb-usa').addEventListener('click', () => chiediNome());
$('lb-modifica').addEventListener('click', () => modifica());
$('lb-ripristina').addEventListener('click', () => ripristina());
$('lb-elimina').addEventListener('click', () => elimina());
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
    const dati = await datiDi(c);
    const esito = await nuovoDaEsempio(c.tipo === 'cucinaPonte' ? 'cucinaPonte' : 'cucina', nome, dati);
    if (!esito.sicurezza) { vaiA(esito.pagina); return; }
    // il progetto aperto prima non era salvato: è nei Preventivi (lo dico, poi si apre la cucina)
    msg.hidden = false; msg.style.color = '#9fd49f';
    msg.innerHTML = `${esc(t('Il progetto che avevi aperto non era salvato: l\'ho messo nei Preventivi come'))} «<span data-no-i18n>${esc(esito.sicurezza)}</span>».`;
    const ok = $('dlg-ok'); ok.disabled = false; ok.textContent = t('Apri la cucina →');
    ok.replaceWith(ok.cloneNode(true)); $('dlg-ok').addEventListener('click', () => { vaiA(esito.pagina); });
    $('dlg-annulla').hidden = true;
  } catch (e) {
    msg.hidden = false; msg.textContent = e.message || t('Non sono riuscito a creare il progetto.');
    inCorso = false; $('dlg-ok').disabled = false;
  }
}

/** Il progetto dell'esempio: la versione salvata dal falegname, se c'è, se no il file del sito. */
async function datiDi(c) {
  if (c._mod && c._mod.progetto) return c._mod.progetto;
  const r = await fetch(`${CARTELLA}${c.file}?v=${VER}`);
  if (!r.ok) throw new Error(t('Non riesco a scaricare questa cucina. Controlla la connessione e riprova.'));
  return r.json();
}

// ---------------------------------------------------------------- modificare l'esempio stesso
// Si apre nella cucina con la barra «Salva come predefinito»: le modifiche restano l'esempio
// (per tutti i clienti dopo), non un progetto di un cliente.
async function modifica() {
  const c = cucine[indice]; if (!c) return;
  const b = $('lb-modifica'); b.disabled = true;
  try {
    const esito = await modificaEsempio(c.tipo === 'cucinaPonte' ? 'cucinaPonte' : 'cucina', { id: idDi(c), nome: testo(c.nome) }, await datiDi(c));
    if (esito.sicurezza) alert(`${t('Il progetto che avevi aperto non era salvato: l\'ho messo nei Preventivi come')} «${esito.sicurezza}».`);
    vaiA(esito.pagina);
  } catch (e) { alert(e.message || t('Non sono riuscito ad aprire la cucina.')); b.disabled = false; }
}
async function ripristina() {
  const c = cucine[indice]; if (!c || !c._mod) return;
  if (!confirm(t('Tornare alla cucina di esempio originale? Le tue modifiche a questo esempio si perdono.'))) return;
  await ripristinaEsempio(idDi(c));
  delete c._mod; delete c._mini; delete c._grande;
  await carica(); mostra(indice);
}

/** Toglie un progetto predefinito del falegname (gli esempi del sito non si possono togliere). */
async function elimina() {
  const c = cucine[indice]; if (!c || !c._mio) return;
  if (!confirm(`${t('Eliminare il progetto predefinito')} «${testo(c.nome)}»? ${t('I preventivi già fatti partendo da qui restano.')}`)) return;
  await eliminaProgettoPredefinito(c.id);
  await carica();
  if (!cucine.length) { chiudiLb(); return; }
  mostra(Math.min(indice, cucine.length - 1));
}

carica();
