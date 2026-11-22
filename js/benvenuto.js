// =============================================================================
// PRIMA CONFIGURAZIONE — il falegname nuovo dice come lavora (si apre la prima volta)
// =============================================================================
// A passi: armadi (struttura, schiena, ante a battente, binario degli scorrevoli), cucina (piedini,
// aria delle ante, gola, regletta), cassetti. Ogni scelta si salva subito nei ⚙ Parametri, gli stessi
// che usano distinta e 3D; dopo si cambiano quando si vuole in ⚙ Impostazioni → Parametri.
// Alla fine: 'ng-configurato' = 1 e si va al programma.
// =============================================================================
import { parametri, salvaParametri } from './parametri.js?v=20261123y';
import { htmlMontaggio, agganciaMontaggio, valoriDaParametri, scriviParametri } from './scelte-montaggio.js?v=20261123y';

const $ = (id) => document.getElementById(id);
const t = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f = (n) => String(Math.round(n * 10) / 10);

/** Un numero dei Parametri (percorso 'gruppo.campo'). */
function campo(path, et, aiuto = '') {
  const [a, b] = path.split('.'), v = parametri()[a][b];
  return `<label>${esc(t(et))}<input type="number" inputmode="decimal" step="0.5" min="0" data-par="${path}" value="${esc(v ?? '')}">${aiuto ? `<small>${esc(t(aiuto))}</small>` : ''}</label>`;
}
function salvaCampo(path, valore) {
  const n = JSON.parse(JSON.stringify(parametri())), [a, b] = path.split('.');
  n[a][b] = valore; salvaParametri(n);
}

const PASSI = [
  { id: 'inizio', titolo: 'Benvenuto', html: () => `
    <p class="intro">${esc(t('Prima di cominciare, dicci come lavori: come monti gli armadi, le ante, la schiena, i piedini della cucina, i cassetti. Il programma userà questi numeri in tutte le distinte di taglio e nel 3D.'))}</p>
    <div class="box"><p class="intro" style="margin:0">${esc(t('Ci vogliono pochi minuti. Ogni scelta ha il suo disegno e un esempio con le misure. Quello che scegli adesso lo potrai cambiare quando vuoi in ⚙ Impostazioni → Parametri.'))}</p></div>` },
  { id: 'struttura', titolo: 'Armadi · struttura', montaggio: { struttura: true, schiena: false, ante: false } },
  { id: 'schiena', titolo: 'Armadi · schiena', montaggio: { struttura: false, schiena: true, ante: false } },
  { id: 'ante', titolo: 'Armadi · ante a battente', montaggio: { struttura: false, schiena: false, ante: true } },
  { id: 'binari', titolo: 'Armadi scorrevoli · binario', html: () => {
    const b = parametri().binari[0];
    return `<p class="intro">${esc(t('Il binario che usi di più per gli armadi scorrevoli: i numeri per calcolare le ante. Altri binari li aggiungi dopo in ⚙ Parametri.'))}</p>
    <div class="box campi">
      <label>${esc(t('Nome del binario'))}<input type="text" data-bin="nome" value="${esc(b.nome)}"></label>
      <label>${esc(t('Larghezza anta: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="larghezzaMeno" value="${esc(b.larghezzaMeno)}"><small>${esc(t('larghezza esterna ÷ n° ante − questo numero (0 = anta larga come il modulo)'))}</small></label>
      <label>${esc(t('Altezza anta: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="altezzaMeno" value="${esc(b.altezzaMeno)}"><small>${esc(t('altezza esterna totale − questo numero'))}</small></label>
      <label>${esc(t('Profili delle ante: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="maniglia" value="${esc(b.maniglia)}"><small>${esc(t('in più, alla larghezza di ogni anta, per i profili verticali sui due lati'))}</small></label>
    </div>
    <div class="box" id="es-bin"></div>`;
  } },
  { id: 'cucina', titolo: 'Cucina', html: () => {
    const pd = parametri().cucina.piedini;
    const sc = (v, tit, sotto) => `<button type="button" class="scelta ${pd === v ? 'sel' : ''}" data-piedini="${v}"><b>${esc(t(tit))}</b>${esc(t(sotto))}</button>`;
    return `<div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Piedini (altezza dello zoccolo)'))}</h3><div class="scelte">
      ${sc(100, 'Piedini da 10 cm', 'Zoccolo alto 10 cm')}${sc(150, 'Piedini da 15 cm', 'Zoccolo alto 15 cm')}${sc(0, 'Automatico', 'Bassi da 70 → 15 cm, bassi da 80 → 10 cm')}
    </div></div>
    <div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Aria delle ante'))}</h3><div class="campi">
      ${campo('ante.ariaAltezza', "Altezza dell'anta: togli", 'sopra + sotto: anta da 700 → 698')}
      ${campo('ante.ariaLarghezza', 'Larghezza: togli', 'sui due lati: modulo 600, 1 anta → 597')}
      ${campo('ante.ariaTraAnte', 'Fra due ante', 'stesso modulo')}
      ${campo('ante.ariaCassetti', 'Fra i cassetti', 'fra un frontale e l\'altro')}
    </div></div>
    <div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Gola e regletta'))}</h3><div class="campi">
      ${campo('gola.spazio', 'Gola: spazio per le dita', 'dal piano all\'anta e fra i cassetti')}
      ${campo('regletta.vista', "Regletta d'angolo: quanto si vede", 'di partenza 3 × 3 cm')}
      ${campo('regletta.spessoreAnta', 'Spessore dell\'anta', 'un pezzo della regletta è largo quanto si vede, l\'altro + questo spessore')}
      ${campo('manigliaJ.spessore', 'Maniglia a J: spessore', "l'anta si accorcia di tanto")}
    </div></div>`;
  } },
  { id: 'cassetti', titolo: 'Cassetti', html: () => `
    <p class="intro">${esc(t('Il sistema di cassetti che usi: fondo e trasera hanno misure diverse da marca a marca.'))}</p>
    <div class="box campi">
      <label>${esc(t('Marca'))}<input type="text" data-partesto="cassetti.marca" value="${esc(parametri().cassetti.marca)}"></label>
      ${campo('cassetti.profondita', 'Profondità cassetto / guide')}
      ${campo('cassetti.spessore', 'Spessore fondo e trasera')}
      ${campo('cassetti.fondoMeno', 'Fondo: larghezza = modulo −')}
      ${campo('cassetti.fondoProfondita', 'Fondo: profondità')}
      ${campo('cassetti.traseraMeno', 'Trasera: larghezza = modulo −')}
      ${campo('cassetti.piccoloFinoA', 'Cassetto piccolo: frontale fino a')}
      ${campo('cassetti.piccoloTrasera', 'Trasera del cassetto piccolo')}
      ${campo('cassetti.medioTrasera', 'Trasera del cassetto medio')}
    </div>` },
  { id: 'fine', titolo: 'Fatto', html: () => {
    const P = parametri(), a = P.armadi;
    const schiena = a.schiena === 'dietro' ? t('avvitata dietro') : a.schiena === 'filo' ? t('incassata a filo') : `${t('nel canale')} (${t('canale')} ${f(a.canale)} mm, ${t('dentro')} ${f(a.dentro)} mm)`;
    return `<p class="intro">${esc(t('Ecco come lavori. Da adesso il programma calcola tutto così; lo cambi quando vuoi in ⚙ Impostazioni → Parametri.'))}</p>
    <div class="box"><ul class="riep">
      <li>${esc(t('Struttura'))}: <b>${esc(a.setup === 2 ? t('fianchi esterni, top e fondo dentro') : t('standard: top e fondo sopra, fianchi dentro'))}</b></li>
      <li>${esc(t('Schiena'))}: <b>${esc(schiena)}</b>, ${esc(t('spessore'))} <b>${f(a.spessoreSchiena)} mm</b></li>
      <li>${esc(t('Ante a battente'))}: <b>${esc(a.ante === 'interne' ? `${t('interne')} (${t('aria')} ${f(P.anteInterne.aria)} mm, ${t('ripiani')} ${f(P.anteInterne.spazioRipiano)} mm ${t('più indietro')})` : t('sopra la struttura'))}</b></li>
      <li>${esc(t('Binario scorrevole'))}: <b>${esc(P.binari[0].nome || '—')}</b></li>
      <li>${esc(t('Piedini della cucina'))}: <b>${esc(P.cucina.piedini ? `${P.cucina.piedini / 10} cm` : t('automatici'))}</b></li>
      <li>${esc(t('Cassetti'))}: <b>${esc(P.cassetti.marca || '—')}</b></li>
    </ul></div>`;
  } },
];

// il passo resta anche se si cambia lingua (la pagina si ricarica)
let i = 0;
try { i = Math.min(PASSI.length - 1, Math.max(0, Number(sessionStorage.getItem('ng-benvenuto-passo')) || 0)); } catch (_) { i = 0; }
function mostra() {
  try { sessionStorage.setItem('ng-benvenuto-passo', String(i)); } catch (_) { /* va bene */ }
  const P = PASSI[i];
  $('passo').textContent = `${t('Prima configurazione')} · ${t('passo')} ${i + 1} ${t('di')} ${PASSI.length}`;
  $('titolo').textContent = t(P.titolo);
  $('punti').innerHTML = PASSI.map((_, k) => `<span class="${k < i ? 'fatto' : k === i ? 'ora' : ''}"></span>`).join('');
  const corpo = $('corpo');
  if (P.montaggio) {
    const ridisegna = () => { corpo.innerHTML = `<div class="box">${htmlMontaggio(valoriDaParametri(), P.montaggio)}</div>`; agganciaMontaggio(corpo, valoriDaParametri, scriviParametri, ridisegna); };
    ridisegna();
  } else {
    corpo.innerHTML = P.html();
    agganciaCampi(corpo);
  }
  $('indietro').disabled = i === 0;
  $('avanti').textContent = i === PASSI.length - 1 ? t('Inizia a lavorare →') : t('Avanti →');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function esempioBinario() {
  const el = $('es-bin'); if (!el) return;
  const b = parametri().binari[0];
  el.textContent = t(`Esempio: armadio 1000 × 2500 a 2 moduli (1 anta per modulo) → anta ${Math.floor(500 - b.larghezzaMeno - b.maniglia)} × ${Math.floor(2500 - b.altezzaMeno)} mm`);
}
function agganciaCampi(root) {
  root.querySelectorAll('[data-par]').forEach((inp) => inp.addEventListener('change', () => {
    const n = Number(String(inp.value).replace(',', '.')); if (!Number.isFinite(n)) return;
    salvaCampo(inp.dataset.par, n);
  }));
  root.querySelectorAll('[data-partesto]').forEach((inp) => inp.addEventListener('change', () => salvaCampo(inp.dataset.partesto, inp.value)));
  root.querySelectorAll('[data-bin]').forEach((inp) => inp.addEventListener('change', () => {
    const n = JSON.parse(JSON.stringify(parametri())), k = inp.dataset.bin;
    n.binari[0][k] = k === 'nome' ? inp.value : Math.max(0, Number(String(inp.value).replace(',', '.')) || 0);
    salvaParametri(n); esempioBinario();
  }));
  root.querySelectorAll('[data-piedini]').forEach((b) => b.addEventListener('click', () => {
    salvaCampo('cucina.piedini', Number(b.dataset.piedini)); mostra();
  }));
  esempioBinario();
}

$('indietro').addEventListener('click', () => { if (i > 0) { i--; mostra(); } });
$('avanti').addEventListener('click', () => {
  if (i < PASSI.length - 1) { i++; mostra(); return; }
  try { localStorage.setItem('ng-configurato', '1'); sessionStorage.removeItem('ng-benvenuto-passo'); } catch (_) { /* va bene anche senza */ }
  location.href = './scegli.html';
});
mostra();
