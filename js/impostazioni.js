// =============================================================================
// IMPOSTAZIONI → Catalogo prodotti
// =============================================================================
// Per ogni sezione (Legni e colori, Finger-pull, Encimere, Pannello dietro il
// piano, Zoccoli, Maniglie) si possono nascondere i prodotti, modificarne i
// dati e aggiungerne di nuovi da una FOTO del campione con la sua misura reale.
// =============================================================================
import {
  SEZIONI, leggiCatalogo, salvaCatalogo, salvaFoto, leggiFoto, eliminaFoto, eliminaFotoTipo, impostaNascosto, nascosto,
  nuovoId, preparaFoto, ritaglioBlob,
} from './catalogo.js?v=20261126w';
import { FORME_MANIGLIA, FINITURE_MANIGLIA, FINITURA_FOTO, anteprimaManiglia } from './maniglia3d.js?v=20261126w';
import { sporgenzaDef } from './finiture-maniglia.js?v=20261126w';
import { anteprimaOggetto, riconosciViste, orientaSopra, ruotaCanvas, controllaMisure, assegnaViste } from './oggetto3d.js?v=20261126w';
import { segmentaManiglia, canvasPng } from './segmenta-maniglia.js?v=20261126w';
import { scontornaIA, scontornoIaPossibile, chiusaDuranteIA } from './scontorno-ia.js?v=20261126w';
import { salvaBozza, leggiBozza, cancellaBozza } from './bozza-oggetto.js?v=20261126w';
import { analizzaFoto, analizzaPorta, raddrizza, coloreMedio, pulisciRiflessi, analizzaSuperficie, ralVicini, VERSIONE_FOTO } from './analisi-foto.js?v=20261126w';
import { materialiPer, sfondoSwatch } from './materiali.js?v=20261126w';
import { agganciaTema } from './tema.js?v=20261126w';
import { scaricaCopiaCompleta, caricaCopiaCompleta } from './copia-completa.js?v=20261126w';
import { parametri, salvaParametri, ripristinaParametri, daImpostare, segnaImpostato, GRUPPI_DA_IMPOSTARE, pezziCassettoNostro, spessoreTirador, nomeAntaScende } from './parametri.js?v=20261126w';
import { htmlFotoParametro, agganciaFotoParametri } from './parametri-foto.js?v=20261126w';
import { htmlMontaggio, agganciaMontaggio, valoriDaParametri, scriviParametri, htmlUguale, valoriScorrevoli, scriviScorrevoli } from './scelte-montaggio.js?v=20261126w';
import { svgParametro, svgBinario } from './disegni-cucina.js?v=20261126w';
import { geometriaCassettiera } from './calcoli.js?v=20261126w';
import { CATEGORIE as CAT_PRONTI, CREDITO as CREDITO_PRONTI, cerca as cercaPronti, miniatura as miniPronto, caricaModello as modelloPronto, anteprimaPronto } from './oggetti-pronti.js?v=20261126w';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
// Sezioni dove si possono già aggiungere prodotti da foto
const CON_AGGIUNTA = ['legno', 'fingerpull', 'encimera', 'pannello', 'zoccolo', 'maniglie', 'binari', 'oggetti'];

let stato = await leggiCatalogo();
// scheda in più (non è una sezione del catalogo): i PARAMETRI della falegnameria
const SEZ_PARAMETRI = { id: 'parametri', nome: 'Parametri', desc: 'I numeri del tuo modo di lavorare: aria delle ante, maniglia a J, gola, binari degli armadi scorrevoli, sistema di cassetti. Li usano la distinta di taglio e il 3D.' };
const TUTTE = [...SEZIONI, SEZ_PARAMETRI];
let sezione = (location.hash || '').slice(1);
if (!TUTTE.some((s) => s.id === sezione)) sezione = 'legno';

agganciaTema();
// Indietro: torna alla pagina da cui si è arrivati (se è del sito)
document.getElementById('imp-indietro').addEventListener('click', (e) => {
  try {
    const r = document.referrer && new URL(document.referrer);
    if (r && r.origin === location.origin && !/impostazioni\.html$/.test(r.pathname)) { e.preventDefault(); history.back(); }
  } catch { /* link normale */ }
});

function vaiSezione(id) { sezione = id; history.replaceState(null, '', `#${id}`); render(); }
async function salvaERicarica() {
  await salvaCatalogo(stato);
  location.reload();            // i materiali si rileggono dal catalogo aggiornato
}

// ---------------------------------------------------------------------------
// Elenco
// ---------------------------------------------------------------------------
function dettagli(m) {
  const info = m.info || {};
  const r = [];
  if (m.misure) r.push(`${Math.round(m.misure.w / 10)}×${Math.round(m.misure.d / 10)}×${Math.round(m.misure.h / 10)} cm`);
  if (info.tipo) r.push(esc(info.tipo));
  const sp = info.spessore || m.spessore;
  if (sp) r.push(`${esc(sp)} mm`);
  if (info.colore) r.push(esc(info.colore));
  if (m.campione) r.push(`campione ${Math.round(m.campione.wMm / 10)}×${Math.round(m.campione.hMm / 10)} cm`);
  if (m.lunghezzaMm) r.push(`lunghezza ${Math.round(m.lunghezzaMm / 10)} cm`);
  if (m.categoria === 'maniglia' && spessoreTirador(m)) r.push(`toglie ${spessoreTirador(m)} mm all'anta`);
  if (m.viste && m.categoria === 'maniglia') r.push(`viste: ${['davanti', ...Object.keys(m.viste)].join(', ')}`);
  if (m.viste && m.categoria === 'oggetto') r.push(`foto: ${['davanti', ...['lato', 'sopra', 'dietro'].filter((v) => m.viste[v])].join(', ')}`);
  if (m.pronto) r.push('oggetto 3D pronto · Poly Haven (CC0)');
  if (m.libreria) r.push(esc((m.info && m.info.note && m.info.note.includes('Sketchfab')) ? m.info.note : 'Amazon Berkeley Objects © Amazon.com · CC BY 4.0'));
  if (m.ral) r.push(`RAL ${esc(m.ral)}`);
  if (m.proprio && m.lucido != null && m.categoria !== 'maniglia') r.push(m.lucido ? 'lucido' : 'opaco');
  if (m.gola) r.push('con gola');
  return r.join(' · ');
}

function render() {
  const S = TUTTE.find((s) => s.id === sezione);
  document.getElementById('imp-schede').innerHTML = TUTTE.map((s) =>
    `<button type="button" class="btn-ghost ${s.id === sezione ? 'attivo' : ''} ${s.id === 'parametri' ? 'scheda-parametri' : ''}" data-sez="${s.id}">${s.id === 'parametri' ? '⚙ ' : ''}${esc(s.nome)}</button>`).join('');
  document.querySelectorAll('[data-sez]').forEach((b) => b.addEventListener('click', () => vaiSezione(b.dataset.sez)));
  if (sezione === 'parametri') { renderParametri(S); return; }

  const lista = materialiPer(sezione, { tutti: true });
  const visibili = lista.filter((m) => !nascosto(stato, sezione, m.id)).length;
  const puoAggiungere = CON_AGGIUNTA.includes(sezione);
  const el = document.getElementById('imp-sezione');
  const campoBin = (i, k, et, aiuto) => `<label class="par-campo"><span class="par-et">${esc(et)}</span>
      <span class="par-input"><input type="number" inputmode="decimal" step="0.1" min="0" data-bin="${i}.${k}" value="${esc(P.binari[i][k])}"><em>mm</em></span>
      <small>${esc(aiuto)}</small></label>`;
  const cardBinario = (b, i, n) => `
      <div class="par-binario">
        <div class="par-bin-testa">
          <label class="par-campo"><span class="par-et">Nome del binario</span>
            <span class="par-input"><input type="text" data-bin="${i}.nome" value="${esc(b.nome)}" placeholder="es. Syscore"></span></label>
          ${n > 1 ? `<button type="button" class="btn-ghost btn-mini" data-bin-togli="${i}">✕ Togli</button>` : ''}
        </div>
        <div class="par-griglia">
          ${campoBin(i, 'larghezzaMeno', 'Larghezza anta: togli', '(larghezza esterna − 2 fianchi) ÷ n° ante − questo numero')}
          ${campoBin(i, 'altezzaMeno', 'Altezza anta: togli', 'altezza esterna totale (fianchi + top + fondo) − questo numero')}
          ${campoBin(i, 'maniglia', "Maniglia alta come l'anta: togli", "in più, alla larghezza di ogni anta, quando la maniglia va da terra a soffitto")}
        </div>
        <div class="par-esempio" data-bin-es="${i}" data-no-i18n></div>
      </div>`;
  el.innerHTML = `
    <p class="imp-desc">${esc(S.desc)}</p>
    <div class="imp-barra">
      <span class="imp-conta">${visibili} di ${lista.length} visibili</span>
      ${puoAggiungere ? `<button type="button" class="btn-oro" id="imp-aggiungi">+ Aggiungi prodotto</button>` : ''}
    </div>
    <div class="imp-griglia">
      ${lista.map((m) => {
        const vis = !nascosto(stato, sezione, m.id);
        return `
        <div class="imp-card ${vis ? '' : 'spento'}" data-id="${esc(m.id)}">
          <div class="imp-foto" style="background:${sfondoSwatch(m)}"></div>
          <div class="imp-info">
            <span class="imp-badge ${m.proprio ? 'tuo' : ''}">${m.derivato ? 'Dal finger-pull (senza gola)' : m.pronto ? 'Oggetto 3D pronto' : m.proprio ? 'Aggiunto da te' : 'Predefinito'}</span>
            <span class="imp-nome">${esc(m.nome)}</span>
            <span class="imp-dett">${dettagli(m)}</span>
            <label class="imp-vis"><input type="checkbox" data-vis="${esc(m.id)}" ${vis ? 'checked' : ''}> Visibile in questa sezione</label>
          </div>
          <div class="imp-azioni">
            ${m.categoria === 'oggetto' && !m.proprio ? '' : `<button type="button" class="btn-ghost btn-mini" data-mod="${esc(m.id)}">Modifica</button>`}
            ${m.proprio && !m.derivato ? `<button type="button" class="btn-ghost btn-mini" data-del="${esc(m.id)}">Elimina</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  el.querySelectorAll('[data-vis]').forEach((c) => c.addEventListener('change', async () => {
    impostaNascosto(stato, sezione, c.dataset.vis, !c.checked);
    await salvaCatalogo(stato);
    c.closest('.imp-card').classList.toggle('spento', !c.checked);
    const n = lista.filter((m) => !nascosto(stato, sezione, m.id)).length;
    el.querySelector('.imp-conta').textContent = tr(`${n} di ${lista.length} visibili`);
  }));
  // il legno "senza gola" si modifica dal suo finger-pull (stessa foto)
  el.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
    const m = lista.find((x) => x.id === b.dataset.mod);
    apriScheda(m && m.derivato ? (materialiPer('fingerpull', { tutti: true }).find((x) => x.id === m.derivato) || m) : m);
  }));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const m = lista.find((x) => x.id === b.dataset.del);
    if (!confirm(tr(`Eliminare "${m.nome}" dal catalogo? Sparisce da tutte le sezioni.`))) return;
    stato.prodotti = stato.prodotti.filter((p) => p.id !== m.id);
    for (const k of Object.keys(stato.nascosti || {})) stato.nascosti[k] = (stato.nascosti[k] || []).filter((x) => x !== m.id);
    await eliminaFoto(m.id);
    await salvaERicarica();
  }));
  const add = el.querySelector('#imp-aggiungi');
  if (add) add.addEventListener('click', () => apriScheda(null));
  const pr = el.querySelector('#imp-pronti');
  if (pr) pr.addEventListener('click', () => apriPronti());
}

// ---------------------------------------------------------------------------
// Scheda prodotto: foto + ritaglio + misure + dati
// ---------------------------------------------------------------------------
const modale = document.getElementById('imp-modale');
function chiudi() { fermaPronto(); modale.hidden = true; document.getElementById('imp-modale-corpo').innerHTML = ''; }
modale.addEventListener('click', (e) => { if (e.target === modale) chiudi(); });
const MANIGLIA_STANDARD_CM = 15;

function apriScheda(m) {
  const nuovo = !m;
  const proprio = nuovo || m.proprio;
  const p = proprio && !nuovo ? stato.prodotti.find((x) => x.id === m.id) : null;
  const sez = nuovo ? sezione : (p ? p.sezione : sezione);
  if (sez === 'oggetti') return p && p.pronto ? apriSchedaPronto(p) : apriSchedaOggetto(p);
  const tipo = sez === 'fingerpull' ? 'fp' : sez === 'maniglie' ? 'man' : 'base';
  const info = (p ? p.info : (m && m.info)) || {};
  const camp = p && p.campioneCm ? p.campioneCm : { w: '', h: '' };
  // maniglia del programma: la sua lunghezza vera (si può cambiare e va nel 3D)
  const man = (p && p.maniglia) || (m && !p && m.lunghezzaMm ? { standard: m.lunghezzaMm === MANIGLIA_STANDARD_CM * 10, lunghezzaCm: m.lunghezzaMm / 10 } : { standard: true, lunghezzaCm: '' });
  // spessore del tirador da togliere all'anta: quello salvato (o, per le maniglie di prima, a J / sul bordo sì)
  const togliSp = tipo === 'man' && m ? spessoreTirador(m) : 0;
  // QUANTO SPORGE: quella scritta (scheda) e quella della forma 3D (se non si scrive niente)
  const sporgScritta = tipo === 'man' ? (p ? Number(p.maniglia && p.maniglia.sporgenza) || '' : Number((stato.modifiche || {})[m && m.id]?.sporgenza) || '') : '';
  const sporgForma = tipo === 'man' && m ? sporgenzaDef({ ...m, sporgenzaMm: null }) : '';
  document.getElementById('imp-modale-titolo').textContent = tr(nuovo ? 'Nuovo prodotto' : 'Modifica prodotto');
  const corpo = document.getElementById('imp-modale-corpo');
  const aiutoFoto = {
    base: 'Foto con luce diffusa, senza flash e senza riflessi. Il programma trova da solo il campione e usa solo la superficie pulita, senza bordi e senza sfondo.',
    fp: 'Foto della porta finger-pull (anche di tre quarti). Il programma riconosce da solo la porta e la gola e ne prende i colori esatti.',
    man: 'Foto frontale della maniglia su sfondo uniforme (es. un foglio bianco). Lo sfondo viene tolto in automatico.',
  }[tipo];
  corpo.innerHTML = `
    <div class="imp-form">
      ${proprio ? `
      <label>${nuovo ? 'Foto <span class="imp-obbl">*</span>' : 'Foto (lascia vuoto per tenere quella attuale)'}
        <input type="file" accept="image/*" id="f-foto"></label>
      ${tipo === 'man' ? '<button type="button" class="btn-ghost btn-mini imp-togli" id="f-togli-foto" hidden>✕ Togli questa foto</button>' : ''}
      <div class="imp-aiuto">${aiutoFoto}</div>
      <div id="f-auto" class="imp-auto" hidden>
        <canvas id="f-vista" class="imp-vista"></canvas>
        <div class="imp-auto-tiles" id="f-tiles"></div>
        <div id="f-superficie" class="imp-superficie"></div>
        <div class="imp-auto-msg" id="f-msg"></div>
        <button type="button" class="btn-ghost btn-mini" id="f-mano">Correggi a mano</button>
      </div>
      <div id="f-ritaglio-box" hidden>
        <div class="imp-zone" id="f-zone"></div>
        <div class="imp-ritaglio" id="f-ritaglio"><canvas id="f-canvas"></canvas></div>
        <div class="imp-anteprima" style="margin-top:8px"><canvas class="imp-tile" id="f-tile" width="192" height="192"></canvas>
          <div class="imp-aiuto">Anteprima della parte scelta.<br><button type="button" class="btn-ghost btn-mini" id="f-tutta">Usa tutta la foto</button></div></div>
        ${tipo === 'man' ? `
        <label class="imp-vis" style="margin-top:8px"><input type="checkbox" id="f-scont" checked> Togli lo sfondo</label>
        <label>Quanto sfondo togliere<input type="range" min="10" max="120" value="45" id="f-tol"></label>` : ''}
      </div>
      ${tipo === 'man' ? `
      <fieldset class="imp-misura">
        <legend>Altre foto per il 3D vero</legend>
        <div class="imp-aiuto">Con la foto <strong>da sopra</strong> (la più importante) e quella <strong>di lato</strong> il sito costruisce la maniglia in 3D reale: la isola da ogni foto e ne ricava la forma e i colori. Foto dritte, maniglia intera, sfondo uniforme (es. un foglio).</div>
        <div class="imp-viste3">
          <div class="imp-vista3"><label>Foto da sopra<input type="file" accept="image/*" id="f-sopra"></label><div class="imp-vista3-img" id="f-sopra-img"></div><button type="button" class="btn-ghost btn-mini imp-togli" data-togli="sopra" hidden>✕ Togli questa foto</button></div>
          <div class="imp-vista3"><label>Foto di lato<input type="file" accept="image/*" id="f-lato"></label><div class="imp-vista3-img" id="f-lato-img"></div><button type="button" class="btn-ghost btn-mini imp-togli" data-togli="lato" hidden>✕ Togli questa foto</button></div>
        </div>
        <div class="imp-sup-titolo">Anteprima 3D</div>
        <div id="f-man3d-vista" class="imp-man3d-vista"><div class="imp-aiuto">Carica la foto della maniglia.</div></div>
      </fieldset>
      <fieldset class="imp-misura">
        <legend>Forma e finitura</legend>
        <div id="f-man3d"></div>
        <div class="imp-aiuto"><strong>La mia forma</strong>: il 3D si costruisce dalle tue foto, anche da una sola (davanti, oppure da sopra / di tre quarti con i piedini). Le altre sono forme pronte. Il colore lo puoi cambiare: <strong>Colore della foto</strong> tiene quello vero.</div>
      </fieldset>` : ''}` : ''}
      ${proprio && tipo !== 'man' ? `
      <div class="grid-2">
        <label>${tipo === 'fp' ? 'Larghezza della porta (cm)' : 'Larghezza del campione (cm)'} <span class="imp-obbl">*</span><input type="text" inputmode="decimal" autocomplete="off" id="f-w" placeholder="es. 59,8" value="${esc(p && p.oggettoCm ? p.oggettoCm.w : camp.w)}"></label>
        <label>${tipo === 'fp' ? 'Altezza della porta (cm)' : 'Altezza del campione (cm)'} <span class="imp-obbl">*</span><input type="text" inputmode="decimal" autocomplete="off" id="f-h" placeholder="es. 69,7" value="${esc(p && p.oggettoCm ? p.oggettoCm.h : camp.h)}"></label>
      </div>
      <div class="imp-aiuto">${tipo === 'fp' ? 'Misura reale di tutta la porta della foto' : 'Misura reale di tutto il campione della foto'}: serve per avere la venatura in scala vera sui mobili, non stirata.</div>` : ''}
      ${tipo === 'man' ? `
      <fieldset class="imp-misura">
        <legend>Misura della maniglia</legend>
        <label class="imp-vis"><input type="radio" name="f-mis" value="std" ${man.standard !== false ? 'checked' : ''}> Standard (${MANIGLIA_STANDARD_CM} cm)</label>
        <label class="imp-vis"><input type="radio" name="f-mis" value="pers" ${man.standard === false ? 'checked' : ''}> Personalizzata</label>
        <label id="f-lung-box" ${man.standard === false ? '' : 'hidden'}>Lunghezza della maniglia (cm) <span class="imp-obbl">*</span><input type="text" inputmode="decimal" autocomplete="off" id="f-lung" value="${esc(man.standard === false ? man.lunghezzaCm : '')}"></label>
        <div class="imp-aiuto">La lunghezza è il lato lungo della maniglia. L'altezza si calcola dalla foto.</div>
      </fieldset>
      <fieldset class="imp-misura">
        <legend>Spessore del tirador</legend>
        <label class="imp-vis"><input type="radio" name="f-sottrai" value="no" ${!togliSp ? 'checked' : ''}> Non togliere niente all'anta</label>
        <label class="imp-vis"><input type="radio" name="f-sottrai" value="si" ${togliSp ? 'checked' : ''}> Sottrai lo spessore del tirador dall'anta</label>
        <label id="f-sottrai-box" ${togliSp ? '' : 'hidden'}>Spessore da togliere (mm) <span class="imp-obbl">*</span><input type="text" inputmode="decimal" autocomplete="off" id="f-sottrai-mm" value="${esc(togliSp || '')}"></label>
        <div class="imp-aiuto">Per i tiradores che stanno sul bordo dell'anta (a J, con la L dietro la porta, il tirador lungo): l'anta si accorcia di questo spessore dal lato dove sta la maniglia (sopra, sotto o di lato), nel 3D e in distinta.</div>
      </fieldset>
      <fieldset class="imp-misura">
        <legend>Quanto sporge</legend>
        <label>Quanto sporge dall'anta (mm)<input type="text" inputmode="decimal" autocomplete="off" id="f-sporg" value="${esc(sporgScritta)}" placeholder="${esc(sporgForma ? String(sporgForma) : 'es. 30')}"></label>
        <div class="imp-aiuto">Dal davanti dell'anta alla parte più sporgente della maniglia.${sporgForma ? ` Vuoto = quella della forma 3D (${sporgForma} mm).` : ''} Nel 3D la maniglia sporge di questa misura; negli armadi la cassettiera va indietro di tanto; in cucina serve per la regletta d'angolo.</div>
      </fieldset>` : ''}
      <label>Nome <span class="imp-obbl">*</span><input type="text" id="f-nome" value="${esc(m ? m.nome : '')}" placeholder="${tipo === 'man' ? 'Es. Maniglia nera 160' : tipo === 'fp' ? 'Es. Rovere con gola nera' : 'Es. Rovere naturale, Giallo canarino…'}"></label>
      <div class="grid-2">
        <label>Tipo di materiale<input type="text" id="f-tipo" value="${esc(info.tipo || '')}" placeholder="${tipo === 'man' ? 'Es. Alluminio, Acciaio…' : 'Es. Melaminico, Laminato, Compacto…'}"></label>
        <label>Spessore (mm)<input type="text" inputmode="decimal" autocomplete="off" id="f-sp" value="${esc(info.spessore || (m && m.spessore) || '')}"></label>
      </div>
      <label>Colore<input type="text" id="f-col" value="${esc(info.colore || '')}" placeholder="Es. Rovere chiaro, Nero opaco…"></label>
      <label>Note<input type="text" id="f-note" value="${esc(info.note || '')}" placeholder="Fornitore, codice…"></label>
      <div class="imp-errore" id="f-err" hidden></div>
      <div class="imp-piede">
        <button type="button" class="btn-ghost" id="f-annulla">Annulla</button>
        <button type="button" class="btn-oro" id="f-salva">Salva</button>
      </div>
    </div>`;
  modale.hidden = false;
  corpo.querySelector('#f-annulla').addEventListener('click', chiudi);
  corpo.querySelectorAll('input[name="f-mis"]').forEach((r) => r.addEventListener('change', () => {
    corpo.querySelector('#f-lung-box').hidden = corpo.querySelector('input[name="f-mis"]:checked').value !== 'pers';
  }));
  corpo.querySelectorAll('input[name="f-sottrai"]').forEach((r) => r.addEventListener('change', () => {
    corpo.querySelector('#f-sottrai-box').hidden = corpo.querySelector('input[name="f-sottrai"]:checked').value !== 'si';
  }));
  let img = null, rit = null;
  if (proprio) {
    // maniglia: forma e finitura per il 3D (proposte dalla foto, correggibili)
    if (tipo === 'man') {
      // "La mia forma" e "Colore della foto" di base; le maniglie salvate prima (senza formaV) ripartono da lì
      corpo._man3d = man.formaV ? { forma: man.forma || 'foto', finitura: man.finitura || 'foto' }
        : { forma: 'foto', finitura: man.finitura || 'foto' };
      corpo._man3d.sceltaUtente = !!man.formaV;          // scelta già salvata: non la cambio
      corpo._coloreSalvato = p ? p.colore : null;
      mostraMan3d(corpo);
      corpo._vistePng = {};                  // viste nuove già isolate: { sopra: seg, lato: seg }
      corpo._visteImg = {};                  // immagini (isolate) per l'anteprima
      corpo._visteTolte = {};
      const mostraVista = (v) => {
        const im = corpo._visteImg[v], box = corpo.querySelector(`#f-${v}-img`);
        box.innerHTML = '';
        if (im) { const c = document.createElement('canvas'); disegnaScacchi(c, im, 150, 70); box.appendChild(c); }
        corpo.querySelector(`[data-togli="${v}"]`).hidden = !im;
      };
      for (const v of ['sopra', 'lato']) {
        corpo.querySelector(`#f-${v}`).addEventListener('change', async (e) => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          const im = await caricaImmagine(f).catch(() => null);
          if (!im) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return; }
          const seg = segmentaManiglia(im);
          if (!seg) { errore(tr('Non riesco a isolare la maniglia in questa foto: usa uno sfondo uniforme e chiaro.')); return; }
          corpo._vistePng[v] = seg; corpo._visteImg[v] = seg.canvas; delete corpo._visteTolte[v];
          mostraVista(v); aggiornaAnteprima3d(corpo);
        });
        corpo.querySelector(`[data-togli="${v}"]`).addEventListener('click', (e) => {
          e.preventDefault(); delete corpo._vistePng[v]; delete corpo._visteImg[v]; corpo._visteTolte[v] = true;
          corpo.querySelector(`#f-${v}`).value = ''; mostraVista(v); aggiornaAnteprima3d(corpo);
        });
      }
      corpo.querySelectorAll('input[name="f-mis"], #f-lung').forEach((x) => x.addEventListener('change', () => aggiornaAnteprima3d(corpo)));
      // MODIFICA: viste e foto già salvate
      if (p) {
        Promise.all(['foto', 'sopra', 'lato'].map((t) => leggiFoto(p.id, t))).then(async ([fo, so, la]) => {
          if (fo && !corpo._fronte && !corpo._fronteTolta) corpo._fronte = await caricaImmagine(fo).catch(() => null);
          if (corpo._fronte && !corpo._fronteTolta) corpo.querySelector('#f-togli-foto').hidden = false;
          if (so) { corpo._visteImg.sopra = await caricaImmagine(so).catch(() => null); mostraVista('sopra'); }
          if (la) { corpo._visteImg.lato = await caricaImmagine(la).catch(() => null); mostraVista('lato'); }
          aggiornaAnteprima3d(corpo);
        });
      }
    }
    const togliF = corpo.querySelector('#f-togli-foto');
    if (togliF) togliF.addEventListener('click', () => {
      img = null; rit = null; corpo._file = null; corpo._fronte = null; corpo._segFronte = null; corpo._fronteTolta = true;
      corpo.querySelector('#f-foto').value = '';
      corpo.querySelector('#f-auto').hidden = true; corpo.querySelector('#f-ritaglio-box').hidden = true;
      togliF.hidden = true;
      if (_chiudiAnteprima) { _chiudiAnteprima(); _chiudiAnteprima = null; }
      corpo.querySelector('#f-man3d-vista').innerHTML = `<div class="imp-aiuto">${tr('Carica la foto della maniglia.')}</div>`;
    });
    corpo.querySelector('#f-foto').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      img = await caricaImmagine(file).catch(() => null);
      if (!img) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return; }
      corpo._fronteTolta = false; if (togliF) togliF.hidden = false;
      corpo._fotoId = Date.now();                 // foto nuova: si riparte dalla proposta del sito
      corpo._file = file;                         // la foto ORIGINALE si salva: si potrà sempre ricorreggere
      rit = await analisiAutomatica(img, corpo, tipo);
    });
    // MODIFICA: la foto originale salvata torna con la sua selezione, si può correggere
    if (p && p.analisi) {
      leggiFoto(p.id, 'orig').then(async (blob) => {
        if (!blob || img) return;
        img = await caricaImmagine(blob).catch(() => null);
        if (!img) return;
        corpo._fotoId = 'salvata';
        corpo._scelta = sceltaDaProdotto(p);
        rit = await analisiAutomatica(img, corpo, tipo, p.analisi);
      });
    }
  }
  corpo.querySelector('#f-salva').addEventListener('click', async () => {
    corpo.querySelector('#f-err').hidden = true;
    const v = (id) => corpo.querySelector(id) ? corpo.querySelector(id).value.trim() : '';
    const nome = v('#f-nome');
    const infoN = { tipo: v('#f-tipo'), spessore: v('#f-sp'), colore: v('#f-col'), note: v('#f-note') };
    if (!nome) { errore(tr('Scrivi il nome del prodotto.')); return; }
    // TIRADOR: sottrai lo spessore dall'anta sì / no e quanti mm
    let tirN = null;
    if (tipo === 'man' && corpo.querySelector('input[name="f-sottrai"]:checked')) {
      const si = corpo.querySelector('input[name="f-sottrai"]:checked').value === 'si';
      const mm = Number(v('#f-sottrai-mm').replace(',', '.'));
      if (si && !(mm > 0)) { errore(tr('Scrivi lo spessore del tirador da togliere all\'anta, in mm.')); return; }
      if (si && mm > 60) { errore(tr('Lo spessore va in millimetri: controlla il numero (es. 2 mm).')); return; }
      tirN = { sottrai: si, spessore: si ? mm : 0 };
    }
    // QUANTO SPORGE (vuoto = come la forma 3D)
    let sporgN = null;
    if (tipo === 'man' && corpo.querySelector('#f-sporg')) {
      const t = v('#f-sporg');
      if (t) {
        sporgN = Number(t.replace(',', '.'));
        if (!(sporgN > 0) || sporgN > 200) { errore(tr('Quanto sporge va in millimetri (es. 30): controlla il numero.')); return; }
      }
    }
    if (!proprio) {
      // maniglia del programma: anche lunghezza e sporgenza scritte qui vanno nel 3D e nei calcoli
      let lungN = null;
      if (tipo === 'man' && m && m.texture && m.lunghezzaMm && corpo.querySelector('input[name="f-mis"]:checked')) {
        const pers = corpo.querySelector('input[name="f-mis"]:checked').value === 'pers';
        const lung = Number(v('#f-lung').replace(',', '.'));
        if (pers && !(lung > 0)) { errore(tr('Scrivi la lunghezza della maniglia in cm, oppure scegli la misura standard (15 cm).')); return; }
        if (pers && lung > 300) { errore(tr('La lunghezza va in centimetri: forse l\'hai scritta in millimetri? Es. 160 mm = 16 cm.')); return; }
        lungN = Math.round((pers ? lung : MANIGLIA_STANDARD_CM) * 10);
      }
      stato.modifiche = { ...(stato.modifiche || {}), [m.id]: { nome, info: infoN, ...(tirN ? { tirador: tirN } : {}),
        ...(lungN ? { lunghezzaMm: lungN } : {}), ...(sporgN ? { sporgenza: sporgN } : {}) } };
      await salvaERicarica(); return;
    }
    let w = 0, h = 0, manN = null;
    if (tipo === 'man') {
      const pers = corpo.querySelector('input[name="f-mis"]:checked').value === 'pers';
      const lung = Number(v('#f-lung').replace(',', '.'));
      if (pers && !(lung > 0)) { errore(tr('Scrivi la lunghezza della maniglia in cm, oppure scegli la misura standard (15 cm).')); return; }
      if (pers && lung > 150) { errore(tr('La lunghezza va in centimetri: forse l\'hai scritta in millimetri? Es. 160 mm = 16 cm.')); return; }
      manN = { standard: !pers, lunghezzaCm: pers ? lung : MANIGLIA_STANDARD_CM, rapporto: p && p.maniglia ? p.maniglia.rapporto : null, verticale: p && p.maniglia ? p.maniglia.verticale : false,
        ...(tirN ? { sottrai: tirN.sottrai, spessoreTogli: tirN.spessore } : {}), ...(sporgN ? { sporgenza: sporgN } : {}) };
    } else {
      w = Number(v('#f-w').replace(',', '.')); h = Number(v('#f-h').replace(',', '.'));
      if (!(w > 0 && h > 0)) { errore(tr('Inserisci la misura del campione in cm (larghezza e altezza).')); return; }
      // misure in mm scritte nei campi in cm (es. 598 invece di 59,8)
      if (w > 300 || h > 300) {
        const f = (x) => String(Math.round(x) / 10).replace('.', ',');
        errore(tr(`Le misure vanno in centimetri: ${f(w * 10)} × ${f(h * 10)} cm è troppo grande. Forse le hai scritte in millimetri? Es. 598 mm = 59,8 cm.`));
        return;
      }
    }
    if (tipo === 'man' && corpo._fronteTolta && !img) { errore(tr('Carica la foto davanti della maniglia.')); return; }
    if (nuovo && !img) { errore(tr('Carica la foto del campione.')); return; }
    const b = corpo.querySelector('#f-salva'); b.disabled = true; b.textContent = tr('Salvo…');
    try {
      const id = nuovo ? nuovoId() : m.id;
      let colore = p ? p.colore : undefined, coloreGola = p ? p.coloreGola : undefined;
      // misura reale del pezzo di foto usato (dal campione/porta intero)
      let campioneZona = p && p.campioneCm && p.oggettoCm
        ? { w: p.campioneCm.w * (w / p.oggettoCm.w), h: p.campioneCm.h * (h / p.oggettoCm.h) } : { w, h };
      if (img) {
        const z = rit();
        const sc = corpo._scelta;
        const tinta = sc && sc.tinta && tipo !== 'man' ? sc.ral : null;
        if (tipo === 'fp') {
          // PORTA raddrizzata (vista di fronte), pixel della foto
          const cp = cartellaRaddrizzata(img, z.porta, w, h, z.portaFrazione);
          if (tinta) riempi(cp.canvas, tinta.hex);
          campioneZona = cp.cm;
          const portaBlob = await canvasBlob(cp.canvas, 'image/jpeg');
          // GOLA: sempre TINTA UNITA (RAL scelto). Porta tutta uguale: stessa tinta / stessa foto della porta.
          let golaCanvas = null;
          if (sc && sc.uguale) {
            if (tinta) coloreGola = tinta.hex;
            else {
              golaCanvas = document.createElement('canvas'); golaCanvas.width = cp.canvas.width; golaCanvas.height = Math.max(8, Math.round(cp.canvas.height * 0.06));
              golaCanvas.getContext('2d').drawImage(cp.canvas, 0, 0, cp.canvas.width, golaCanvas.height, 0, 0, golaCanvas.width, golaCanvas.height);
              coloreGola = coloreMedio(golaCanvas);
            }
          } else coloreGola = sc && sc.golaRal ? sc.golaRal.hex : (z.coloreGola ?? 0x1a1a1a);
          const golaBlob = golaCanvas ? await canvasBlob(golaCanvas, 'image/jpeg') : await bloccoColore(coloreGola);
          await salvaFoto(id, portaBlob, 'foto');
          await salvaFoto(id, golaBlob, 'gola');
          await salvaFoto(id, await thumbDaCanvas(cp.canvas, golaCanvas, coloreGola), 'thumb');
          colore = coloreMedio(cp.canvas);
        } else if (tipo === 'man') {
          const scont = corpo.querySelector('#f-scont').checked ? Number(corpo.querySelector('#f-tol').value) : 0;
          // maniglia ISOLATA dalla zona scelta (riconoscimento), raddrizzata e trasparente
          const seg = scont ? segmentaManiglia(img, z.main, Math.max(0.6, Math.min(1.8, scont / 45))) : null;
          if (seg) {
            await salvaFoto(id, await canvasPng(seg.canvas), 'foto');
            const r = await ritaglioBlob(img, z.main, { png: true, scontorna: scont, thumbIntera: true, max: 600 });
            await salvaFoto(id, r.thumb, 'thumb');
            colore = seg.colore; manN.verticale = seg.h > seg.w; manN.rapporto = seg.rapporto;
          } else {
            const r = await ritaglioBlob(img, z.main, { png: true, scontorna: scont, thumbIntera: true, max: 1024 });
            await salvaFoto(id, r.blob, 'foto');
            await salvaFoto(id, r.thumb, 'thumb');
            colore = r.colore;
            manN.verticale = r.h > r.w;
            manN.rapporto = Math.min(r.w, r.h) / Math.max(r.w, r.h);
          }
        } else {
          const cp = cartellaRaddrizzata(img, z.main, w, h, z.portaFrazione);
          if (tinta) riempi(cp.canvas, tinta.hex);
          campioneZona = cp.cm;
          await salvaFoto(id, await canvasBlob(cp.canvas, 'image/jpeg'), 'foto');
          await salvaFoto(id, await thumbDaCanvas(cp.canvas, null, null), 'thumb');
          colore = coloreMedio(cp.canvas);
        }
        // FOTO ORIGINALE + SELEZIONE: la scheda si potrà sempre riaprire e correggere
        if (corpo._file) await salvaFoto(id, corpo._file, 'orig');
        const k = ['oggetto', 'main', 'porta', 'gola', 'golaZona', 'portaFrazione', 'coloreGola'];
        var analisi = JSON.parse(JSON.stringify(Object.fromEntries(k.filter((x) => z[x] != null).map((x) => [x, z[x]]))));
      }
      // MANIGLIA: forma e finitura + le altre viste (sopra / lato) isolate per il 3D vero
      if (tipo === 'man') {
        const m3 = corpo._man3d || {};
        manN.forma = m3.forma || 'foto';
        manN.finitura = m3.finitura || 'foto';
        manN.formaV = 2;
        manN.viste = { ...((p && p.maniglia && p.maniglia.viste) || {}) };
        for (const v of ['sopra', 'lato']) {
          const sg = (corpo._vistePng || {})[v];
          if (sg) { await salvaFoto(id, await canvasPng(sg.canvas), v); manN.viste[v] = { w: sg.w, h: sg.h }; }
          else if ((corpo._visteTolte || {})[v]) { await eliminaFotoTipo(id, v); delete manN.viste[v]; }
        }
        if (!Object.keys(manN.viste).length) delete manN.viste;
      }
      // superficie scelta: tinta unita (RAL) / legno, lucido / opaco
      const scS = corpo._scelta;
      const sup = tipo !== 'man' && scS && scS.foto === corpo._fotoId
        ? (scS.tinta ? { tinta: { ral: scS.ral.codice, colore: scS.ral.hex, lucido: !!scS.lucido } } : { tinta: null, lucido: !!scS.lucido })
        : {};
      if (sup.tinta) colore = sup.tinta.colore;
      const dati = { id, sezione: sez, nome, info: infoN, colore, aggiornato: Date.now(), versioneFoto: VERSIONE_FOTO, ...sup,
        ...(tipo === 'man' ? { maniglia: manN } : { campioneCm: campioneZona, oggettoCm: { w, h } }),
        ...(tipo === 'fp' ? { coloreGola, uguale: !!(scS && scS.uguale),
          golaTinta: scS && !scS.uguale && scS.golaRal ? { ral: scS.golaRal.codice, colore: scS.golaRal.hex } : null } : {}),
        ...(analisi && (corpo._file || corpo._fotoId === 'salvata') ? { analisi } : {}) };
      if (nuovo) stato.prodotti.push({ ...dati, creato: Date.now() });
      else stato.prodotti = stato.prodotti.map((x) => (x.id === id ? { ...x, ...dati } : x));
      await salvaERicarica();
    } catch (err) {
      console.error(err);
      errore(tr('Salvataggio non riuscito: forse lo spazio del browser è pieno.'));
      b.disabled = false; b.textContent = tr('Salva');
    }
  });
  function errore(t) { const e = corpo.querySelector('#f-err'); e.textContent = t; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); }
}

/** Miniatura del finger-pull: in alto la gola, sotto la porta (come è fatta). */
async function thumbFingerPull(img, porta, gola, coloreGola) {
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d');
  g.drawImage(img, porta.x, porta.y, porta.w, porta.h, 0, 0, 192, 192);
  if (gola && gola.w >= 4 && gola.h >= 4) g.drawImage(img, gola.x, gola.y, gola.w, gola.h, 0, 0, 192, 34);
  else { g.fillStyle = `#${(coloreGola ?? 0x1a1a1a).toString(16).padStart(6, '0')}`; g.fillRect(0, 0, 192, 34); }
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
}

/** Canvas → Blob. */
function canvasBlob(c, tipo = 'image/jpeg') { return new Promise((ok) => c.toBlob(ok, tipo, 0.95)); }

/**
 * SUPERFICIE della porta/campione: legno-disegno (si usa la foto pulita) o
 * TINTA UNITA (colore pieno = RAL più vicino, finitura lucida o opaca). Il
 * sito propone dalla foto; l'utente può cambiare tutto.
 */
/** Disegna un'immagine trasparente su scacchiera (si vede cosa è stato tolto). */
function disegnaScacchi(c, im, W, H) {
  c.width = W; c.height = H; const g = c.getContext('2d');
  for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x += 10) { g.fillStyle = ((x + y) / 10) % 2 ? '#d9d6cf' : '#f3f1ec'; g.fillRect(x, y, 10, 10); }
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = Math.min((W - 8) / iw, (H - 8) / ih);
  g.drawImage(im, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
}
/** Anteprima 3D della maniglia nella scheda (dalle viste isolate o dalla forma). */
let _chiudiAnteprima = null, _tAnteprima = 0;
function aggiornaAnteprima3d(corpo) {
  clearTimeout(_tAnteprima);
  _tAnteprima = setTimeout(async () => {
    const box = corpo.querySelector('#f-man3d-vista'); if (!box || !corpo._fronte) return;
    const pers = corpo.querySelector('input[name="f-mis"]:checked')?.value === 'pers';
    const L = (pers ? Number(String(corpo.querySelector('#f-lung')?.value || '').replace(',', '.')) : MANIGLIA_STANDARD_CM) * 10 || 160;
    const vi = corpo._visteImg || {}, m3 = corpo._man3d || {};
    if (_chiudiAnteprima) _chiudiAnteprima();
    _chiudiAnteprima = await anteprimaManiglia(box, corpo._fronte, vi.sopra || null, vi.lato || null, L, m3.finitura, m3.forma, coloreFoto(corpo));
  }, 120);
}
/** Colore vero della maniglia (dalla foto davanti isolata). */
function coloreFoto(corpo) {
  return corpo._segFronte ? corpo._segFronte.colore : (corpo._coloreSalvato ?? null);
}
/** Scheda maniglia: forma (con disegno) e finitura del modello 3D. */
function mostraMan3d(corpo) {
  const box = corpo.querySelector('#f-man3d'); if (!box) return;
  const m3 = corpo._man3d;
  const hx = (h) => `#${(h ?? 0x999999).toString(16).padStart(6, '0')}`;
  box.innerHTML = `
    <div class="imp-sup-titolo">${tr('Forma')}</div>
    <div class="imp-forme">${FORME_MANIGLIA.map((f) => `<button type="button" class="imp-forma ${m3.forma === f.id ? 'sel' : ''}" data-forma="${f.id}">${f.svg}<span>${tr(f.nome)}</span></button>`).join('')}</div>
    <div class="imp-sup-titolo">${tr('Finitura')}</div>
    <div class="imp-ral">${[{ ...FINITURA_FOTO, colore: coloreFoto(corpo) }, ...FINITURE_MANIGLIA].map((f) => `<button type="button" class="imp-ral-c ${m3.finitura === f.id ? 'sel' : ''}" data-fin3="${f.id}"><span style="background:${hx(f.colore)}"></span>${tr(f.nome)}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-forma]').forEach((b) => b.addEventListener('click', () => { m3.forma = b.dataset.forma; m3.sceltaUtente = true; mostraMan3d(corpo); aggiornaAnteprima3d(corpo); }));
  box.querySelectorAll('[data-fin3]').forEach((b) => b.addEventListener('click', () => { m3.finitura = b.dataset.fin3; m3.sceltaUtente = true; mostraMan3d(corpo); aggiornaAnteprima3d(corpo); }));
}
/** Colore della maniglia nella zona scelta: i pixel diversi dallo sfondo (mediana). */
function coloreManiglia(img, r) {
  const k = Math.min(1, 220 / Math.max(r.w, r.h)), w = Math.max(4, Math.round(r.w * k)), h = Math.max(4, Math.round(r.h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
  const bordo = []; for (let x = 0; x < w; x++) bordo.push(px(x), px((h - 1) * w + x)); for (let y = 0; y < h; y++) bordo.push(px(y * w), px(y * w + w - 1));
  const bg = [0, 1, 2].map((q) => med(bordo.map((v) => v[q])));
  let sel = []; for (let i = 0; i < w * h; i++) { const v = px(i); if (Math.hypot(v[0] - bg[0], v[1] - bg[1], v[2] - bg[2]) > 45) sel.push(v); }
  if (sel.length < w * h * 0.04) sel = Array.from({ length: w * h }, (_, i) => px(i));
  const [rr, gg, bb] = [0, 1, 2].map((q) => Math.round(med(sel.map((v) => v[q]))));
  return (rr << 16) | (gg << 8) | bb;
}
/** Gola quasi nera: i bordi della porta la "sporcano" di colore → la porto verso il grigio/nero. */
function neutroScuro(c) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, l = 0.299 * r + 0.587 * g + 0.114 * b;
  if (l > 70) return c;
  const k = l < 45 ? 0.15 : 0.5, m = (x) => Math.round(l + (x - l) * k);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}
function sceltaDaProdotto(p) {
  const t = p.tinta || null;
  return { foto: 'salvata', uguale: !!p.uguale, tinta: !!t, ral: t ? { codice: t.ral, hex: t.colore } : null, lucido: !!(t ? t.lucido : p.lucido),
    golaRal: p.golaTinta ? { codice: p.golaTinta.ral, hex: p.golaTinta.colore } : null };
}
function mostraSuperficie(corpo, sup, tipo) {
  const box = corpo.querySelector('#f-superficie'); if (!box) return;
  // prima analisi di questa foto: proposta del sito (tinta/legno), opaco
  if (!corpo._scelta || corpo._scelta.foto !== corpo._fotoId) {
    corpo._scelta = { foto: corpo._fotoId, uguale: false, tinta: sup.tintaUnita, ral: null, lucido: false, golaRal: null };
  }
  const sc = corpo._scelta, hx = (h) => `#${h.toString(16).padStart(6, '0')}`;
  sc.ralLista = sup.ral;
  if (!sc.ral || !sc.ralLista.some((r) => r.codice === sc.ral.codice)) sc.ralLista = sc.ral ? [sc.ral, ...sup.ral.slice(0, 5)] : sup.ral;
  if (!sc.ral) sc.ral = sc.ralLista[0];
  if (tipo === 'fp') {
    sc.golaLista = ralVicini(sup.colGola ?? 0x151515, 6);
    if (sc.golaRal && !sc.golaLista.some((r) => r.codice === sc.golaRal.codice)) sc.golaLista = [sc.golaRal, ...sc.golaLista.slice(0, 5)];
    if (!sc.golaRal) sc.golaRal = sc.golaLista[0];
  }
  const chips = (lista, sel, attr) => `<div class="imp-ral">${lista.map((r) => `<button type="button" class="imp-ral-c ${r.codice === sel.codice ? 'sel' : ''}" data-${attr}="${r.codice}" title="RAL ${r.codice}"><span style="background:${hx(r.hex)}"></span>RAL ${r.codice}</button>`).join('')}</div>`;
  const btn = (attr, val, on, testo) => `<button type="button" class="btn-ghost btn-mini ${on ? 'attivo' : ''}" data-${attr}="${val}">${on ? '✓ ' : ''}${tr(testo)}</button>`;
  box.innerHTML = `
    ${tipo === 'fp' ? `
    <div class="imp-sup-titolo">${tr('Tipo di porta')}</div>
    <div class="imp-sup-scelte">${btn('ugu', 'no', !sc.uguale, 'Porta e gola di colori diversi')}${btn('ugu', 'si', sc.uguale, 'Porta tutta uguale (gola dello stesso colore)')}</div>` : ''}
    <div class="imp-sup-titolo">${tr(tipo === 'fp' ? 'Porta' : 'Superficie')}</div>
    <div class="imp-sup-scelte">${btn('sup', 'tinta', sc.tinta, 'Tinta unita')}${btn('sup', 'legno', !sc.tinta, 'Tinta legno (usa la foto)')}</div>
    ${sc.tinta ? `${chips(sc.ralLista, sc.ral, 'ral')}
    <div class="imp-aiuto">${tr('Colore della foto senza riflessi')}: <span class="imp-ral-foto" style="background:${hx(sup.colore)}"></span> → ${tr('il RAL più vicino è il primo')}.</div>` : ''}
    <div class="imp-sup-scelte">${btn('fin', 'opaco', !sc.lucido, 'Opaco')}${btn('fin', 'lucido', sc.lucido, 'Lucido')}</div>
    ${tipo === 'fp' && !sc.uguale ? `
    <div class="imp-sup-titolo">${tr('Gola (sempre tinta unita)')}</div>
    ${chips(sc.golaLista, sc.golaRal, 'gral')}
    <div class="imp-aiuto">${tr('Colore della gola nella foto')}: <span class="imp-ral-foto" style="background:${hx(sup.colGola ?? 0x151515)}"></span></div>` : ''}`;
  const ridisegna = () => corpo._ridisegnaAnalisi && corpo._ridisegnaAnalisi();
  box.querySelectorAll('[data-ugu]').forEach((b) => b.addEventListener('click', () => { sc.uguale = b.dataset.ugu === 'si'; corpo._applicaUguale && corpo._applicaUguale(sc.uguale); ridisegna(); }));
  box.querySelectorAll('[data-sup]').forEach((b) => b.addEventListener('click', () => { sc.tinta = b.dataset.sup === 'tinta'; ridisegna(); }));
  box.querySelectorAll('[data-ral]').forEach((b) => b.addEventListener('click', () => { sc.ral = sc.ralLista.find((r) => r.codice === b.dataset.ral); ridisegna(); }));
  box.querySelectorAll('[data-gral]').forEach((b) => b.addEventListener('click', () => { sc.golaRal = sc.golaLista.find((r) => r.codice === b.dataset.gral); ridisegna(); }));
  box.querySelectorAll('[data-fin]').forEach((b) => b.addEventListener('click', () => { sc.lucido = b.dataset.fin === 'lucido'; ridisegna(); }));
}

/**
 * Porta/campione RADDRIZZATO alla sua forma vera: proporzioni dalla misura
 * reale (cm) della parte usata, lato lungo max 1600 px.
 */
function cartellaRaddrizzata(img, quad, wCm, hCm, frazione) {
  const fr = frazione || { w: 1, h: 1 };
  const cm = { w: Math.round(wCm * fr.w * 10) / 10, h: Math.round(hCm * fr.h * 10) / 10 };
  const asp = cm.w / cm.h;
  const OW = asp >= 1 ? 1600 : Math.max(64, Math.round(1600 * asp));
  const OH = asp >= 1 ? Math.max(64, Math.round(1600 / asp)) : 1600;
  // riflessi e luce non uniforme tolti in automatico (tinta unita → colore pieno)
  const pul = pulisciRiflessi(raddrizza(img, quad, OW, OH, 0));
  return { canvas: pul.canvas, cm, uniforme: pul.uniforme };
}

/** Riempie un canvas con un colore pieno (tinta unita). */
function riempi(c, hex) { const g = c.getContext('2d'); g.fillStyle = `#${hex.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, c.width, c.height); }

/** Miniatura dalla porta raddrizzata (+ gola in alto, foto o colore). */
function thumbDaCanvas(porta, gola, coloreGola) {
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d');
  const lato = Math.min(porta.width, porta.height);
  g.drawImage(porta, (porta.width - lato) / 2, (porta.height - lato) / 2, lato, lato, 0, 0, 192, 192);
  if (gola) g.drawImage(gola, 0, 0, gola.width, gola.height, 0, 0, 192, 28);
  else if (coloreGola != null) { g.fillStyle = `#${coloreGola.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, 192, 28); }
  return canvasBlob(c, 'image/jpeg');
}

/**
 * ANALISI AUTOMATICA (porta finger-pull / campione): sfondo tolto, angoli
 * trovati, porta raddrizzata, gola cercata sulla porta dritta. Si vede subito
 * cosa ha riconosciuto; "Correggi a mano" fa spostare i 4 ANGOLI (la
 * selezione segue la porta anche se è inclinata).
 */
async function analisiAutomatica(img, corpo, tipo, salvata = null) {
  if (tipo === 'man') return analisiManiglia(img, corpo, tipo, salvata);
  const a = salvata ? JSON.parse(JSON.stringify(salvata)) : analizzaPorta(img, tipo);
  const chiave = tipo === 'fp' ? 'porta' : 'main';
  // finger-pull "porta tutta uguale": un solo riquadro (porta + gola insieme)
  const trovata = { porta: a.porta, golaZona: a.golaZona, gola: a.gola, portaFrazione: a.portaFrazione };
  corpo._applicaUguale = (uguale) => {
    if (tipo !== 'fp') return;
    if (uguale) { a.porta = a.oggetto.map((p) => [...p]); a.golaZona = null; a.gola = null; a.portaFrazione = { w: 1, h: 1 }; }
    else if (!a.golaZona) Object.assign(a, JSON.parse(JSON.stringify(trovata)));
  };
  if (tipo === 'fp' && corpo._scelta && corpo._scelta.uguale) corpo._applicaUguale(true);
  const box = corpo.querySelector('#f-auto');
  box.hidden = false;
  corpo.querySelector('#f-ritaglio-box').hidden = true;
  const W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, 900 / Math.max(W, H));
  const v = corpo.querySelector('#f-vista'); v.width = Math.round(W * k); v.height = Math.round(H * k);
  // misura a schermo con le proporzioni della foto (niente bande: gli angoli combaciano)
  const dimensiona = () => {
    const maxW = v.parentElement.clientWidth - 20, maxH = 380;
    const s = Math.min(maxW / W, maxH / H);
    v.style.width = `${Math.round(W * s)}px`; v.style.height = `${Math.round(H * s)}px`;
  };
  dimensiona();
  const tiles = corpo.querySelector('#f-tiles');
  const L = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const disegna = () => {
    const g = v.getContext('2d'); g.drawImage(img, 0, 0, v.width, v.height);
    const poly = (q, col, tratt) => {
      if (!q) return;
      g.save(); g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath();
      g.strokeStyle = col; g.lineWidth = Math.max(2, v.width / 250); if (tratt) g.setLineDash([8, 6]); g.stroke(); g.restore();
    };
    poly(a.oggetto, '#9aa0a6', true); poly(a[chiave], '#e0a000'); if (!(corpo._scelta && corpo._scelta.uguale)) poly(a.golaZona, '#1e90ff');
    // anteprime: porta raddrizzata e gola
    tiles.innerHTML = '';
    const tile = (titolo, sorgente, colore) => {
      const f = document.createElement('figure'); f.className = 'imp-tilebox';
      const c = document.createElement('canvas'); c.width = c.height = 140;
      const cg = c.getContext('2d');
      if (sorgente) { const s = Math.max(140 / sorgente.width, 140 / sorgente.height); cg.drawImage(sorgente, (140 - sorgente.width * s) / 2, (140 - sorgente.height * s) / 2, sorgente.width * s, sorgente.height * s); }
      else { cg.fillStyle = `#${(colore ?? 0x1a1a1a).toString(16).padStart(6, '0')}`; cg.fillRect(0, 0, 140, 140); }
      f.appendChild(c); const fc = document.createElement('figcaption'); fc.textContent = tr(titolo); f.appendChild(fc); tiles.appendChild(f);
    };
    const q = a[chiave];
    const asp = (L(q[0], q[1]) + L(q[3], q[2])) / Math.max(1, L(q[0], q[3]) + L(q[1], q[2]));
    const sup = analizzaSuperficie(raddrizza(img, q, 280, Math.max(40, Math.round(280 / Math.max(0.2, asp))), 0));
    if (tipo === 'fp') {
      sup.colGola = neutroScuro(a.coloreGola ?? 0x151515);  // colore della gola dalla foto vera (senza schiarire)
    }
    mostraSuperficie(corpo, sup, tipo);
    const scelta = corpo._scelta;
    if (scelta && scelta.tinta) {
      const t = document.createElement('canvas'); t.width = 280; t.height = Math.max(40, Math.round(280 / Math.max(0.2, asp)));
      const tg = t.getContext('2d'); tg.fillStyle = `#${scelta.ral.hex.toString(16).padStart(6, '0')}`; tg.fillRect(0, 0, t.width, t.height);
      tile(tipo === 'fp' ? 'Porta' : 'Campione', t);
    } else tile(tipo === 'fp' ? 'Porta' : 'Campione', sup.pulita);
    if (tipo === 'fp' && !(scelta && scelta.uguale)) tile('Gola', null, scelta && scelta.golaRal ? scelta.golaRal.hex : a.coloreGola);
  };
  corpo._ridisegnaAnalisi = disegna;
  disegna();
  corpo.querySelector('#f-msg').textContent = tr(salvata ? 'Foto salvata: puoi correggere la selezione con "Correggi a mano".' : (a.messaggio || ''));
  // --- correzione a mano: angoli trascinabili sulla foto
  corpo.querySelector('#f-mano').onclick = () => {
    const wrap = v.parentElement; wrap.style.position = 'relative';
    wrap.querySelectorAll('.imp-angolo').forEach((x) => x.remove());
    const gruppi = [[chiave, '#e0a000']];
    if (tipo === 'fp' && !(corpo._scelta && corpo._scelta.uguale)) { if (!a.golaZona) { const o = a.oggetto; a.golaZona = [o[0], o[1], [o[1][0], o[1][1] + (o[2][1] - o[1][1]) * 0.06], [o[0][0], o[0][1] + (o[3][1] - o[0][1]) * 0.06]]; } gruppi.push(['golaZona', '#1e90ff']); }
    for (const [nome, col] of gruppi) {
      a[nome].forEach((pt, i) => {
        const h = document.createElement('div'); h.className = 'imp-angolo'; h.style.borderColor = col;
        const pos = () => { const r = v.getBoundingClientRect(), b = wrap.getBoundingClientRect(); h.style.left = `${r.left - b.left + (a[nome][i][0] / W) * r.width}px`; h.style.top = `${r.top - b.top + (a[nome][i][1] / H) * r.height}px`; };
        pos(); wrap.appendChild(h);
        h.addEventListener('pointerdown', (e) => {
          h.setPointerCapture(e.pointerId); e.preventDefault();
          const muovi = (ev) => {
            const r = v.getBoundingClientRect();
            a[nome][i] = [Math.max(0, Math.min(W, ((ev.clientX - r.left) / r.width) * W)), Math.max(0, Math.min(H, ((ev.clientY - r.top) / r.height) * H))];
            pos(); disegnaVeloce();
          };
          const fine = () => { h.removeEventListener('pointermove', muovi); h.removeEventListener('pointerup', fine); aggiornaDaMano(); };
          h.addEventListener('pointermove', muovi); h.addEventListener('pointerup', fine);
        });
      });
    }
    corpo.querySelector('#f-msg').textContent = tr(corpo._scelta && corpo._scelta.uguale ? 'Trascina i pallini sugli angoli della porta.' : 'Trascina i pallini sugli angoli: oro = porta, blu = gola.');
  };
  let rq = 0;
  const disegnaVeloce = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(disegna); };
  const aggiornaDaMano = () => {
    // a mano: la gola usa la zona scelta; scala dalla proporzione porta/oggetto
    if (tipo === 'fp' && a.golaZona) { a.gola = a.golaZona; a.coloreGola = coloreMedio(raddrizza(img, a.golaZona, 120, 20, 0)); }
    const o = a.oggetto, q = a[chiave];
    a.portaFrazione = { w: Math.min(1, (L(q[0], q[1]) + L(q[3], q[2])) / Math.max(1, L(o[0], o[1]) + L(o[3], o[2]))),
      h: Math.min(1, (L(q[0], q[3]) + L(q[1], q[2])) / Math.max(1, L(o[0], o[3]) + L(o[1], o[2]))) };
    disegna();
  };
  return () => ({ ...a });
}

/** Un quadratino di colore pieno (gola troppo sottile in foto). */
function bloccoColore(col) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = `#${col.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, 64, 64);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

/**
 * ANALISI AUTOMATICA: trova campione / porta + gola / maniglia e mostra cosa
 * ha riconosciuto. "Correggi a mano" apre i riquadri già posizionati.
 * Ritorna una funzione che dà le zone (in pixel) da usare al salvataggio.
 */
async function analisiManiglia(img, corpo, tipo, salvata = null) {
  const a = analizzaFoto(img, tipo);
  if (salvata && salvata.main) Object.assign(a, { main: salvata.main, oggetto: salvata.oggetto || a.oggetto, messaggio: 'Foto salvata: puoi correggere la selezione con "Correggi a mano".' });
  // RICONOSCIMENTO: la maniglia isolata dallo sfondo (e raddrizzata)
  const seg = segmentaManiglia(img, salvata && salvata.main ? salvata.main : null);
  if (seg) {
    if (!(salvata && salvata.main)) a.main = { x: Math.round(seg.zona.x), y: Math.round(seg.zona.y), w: Math.round(seg.zona.w), h: Math.round(seg.zona.h) };
    a.messaggio = a.messaggio || 'Maniglia riconosciuta e isolata dallo sfondo.';
  } else a.messaggio = 'Non riesco a isolare bene la maniglia: usa "Correggi a mano" o una foto su sfondo uniforme.';
  corpo._segFronte = seg; corpo._fronte = seg ? seg.canvas : img;
  aggiornaAnteprima3d(corpo);
  let manuale = null;
  const box = corpo.querySelector('#f-auto');
  box.hidden = false;
  corpo.querySelector('#f-ritaglio-box').hidden = true;
  // la foto con i riquadri trovati
  const W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, 900 / Math.max(W, H));
  const v = corpo.querySelector('#f-vista'); v.width = Math.round(W * k); v.height = Math.round(H * k);
  const g = v.getContext('2d'); g.drawImage(img, 0, 0, v.width, v.height);
  const rett = (q, col, tratt) => {
    if (!q) return;
    g.save(); g.strokeStyle = col; g.lineWidth = Math.max(2, v.width / 220); if (tratt) g.setLineDash([8, 6]);
    g.strokeRect(q.x * k, q.y * k, q.w * k, q.h * k); g.restore();
  };
  rett(a.oggetto, '#9aa0a6', true);
  rett(a.porta || a.main, '#e0a000'); rett(a.gola, '#1e90ff');
  // anteprime dei pezzi usati
  const tiles = corpo.querySelector('#f-tiles');
  const tile = async (titolo, q, opz = {}) => {
    const f = document.createElement('figure'); f.className = 'imp-tilebox';
    const c = document.createElement('canvas'); c.width = c.height = 140; c.className = 'imp-tile';
    const cg = c.getContext('2d');
    if (opz.colore != null && (!q || q.w < 4 || q.h < 4)) { cg.fillStyle = `#${opz.colore.toString(16).padStart(6, '0')}`; cg.fillRect(0, 0, 140, 140); }
    else if (opz.png) {
      const r = await ritaglioBlob(img, q, { png: true, scontorna: 45, max: 600 });
      const im = await createImageBitmap(r.blob);
      cg.fillStyle = '#e9e6df'; cg.fillRect(0, 0, 140, 140);
      const s = Math.min(130 / im.width, 130 / im.height);
      cg.drawImage(im, (140 - im.width * s) / 2, (140 - im.height * s) / 2, im.width * s, im.height * s);
    } else {
      const s = Math.max(140 / q.w, 140 / q.h);
      cg.drawImage(img, q.x, q.y, q.w, q.h, (140 - q.w * s) / 2, (140 - q.h * s) / 2, q.w * s, q.h * s);
    }
    f.appendChild(c);
    const fc = document.createElement('figcaption'); fc.textContent = tr(titolo); f.appendChild(fc);
    tiles.appendChild(f);
  };
  tiles.innerHTML = '';
  if (tipo === 'fp') { await tile('Porta', a.porta); await tile('Gola', a.gola, { colore: a.coloreGola }); }
  else if (tipo === 'man') {
    if (corpo._segFronte) {
      const f = document.createElement('figure'); f.className = 'imp-tilebox';
      const c = document.createElement('canvas'); c.className = 'imp-tile'; disegnaScacchi(c, corpo._segFronte.canvas, 140, 140);
      f.appendChild(c); const fc = document.createElement('figcaption'); fc.textContent = tr('Maniglia isolata'); f.appendChild(fc); tiles.appendChild(f);
    } else await tile('Maniglia (sfondo tolto)', a.main, { png: true });
    // proposta di forma e finitura dalla foto (se l'utente non ha già scelto)
    const m3 = corpo._man3d;
    if (m3 && !m3.sceltaUtente) {
      m3.finitura = 'foto'; m3.forma = 'foto';
    }
    if (m3) {
      if (!corpo._segFronte) corpo._coloreSalvato = coloreManiglia(img, a.main);
      mostraMan3d(corpo);
    }
  }
  else await tile('Campione', a.main);
  corpo.querySelector('#f-msg').textContent = tr(a.messaggio || (tipo === 'man' ? 'Maniglia trovata.' : 'Campione trovato.'));
  corpo.querySelector('#f-mano').onclick = () => {
    const fr = (q) => ({ x: q.x / W, y: q.y / H, w: q.w / W, h: q.h / H });
    const zone = tipo === 'fp'
      ? [{ id: 'oggetto', nome: 'Porta intera', colore: '#9aa0a6', r: fr(a.oggetto) },
         { id: 'porta', nome: 'Porta', colore: '#c9a94a', r: fr(a.porta) },
         { id: 'gola', nome: 'Gola', colore: '#4aa3df', r: fr(a.gola || { x: a.oggetto.x, y: a.oggetto.y, w: a.oggetto.w, h: a.oggetto.h * 0.08 }) }]
      : tipo === 'man' ? [{ id: 'main', nome: '', colore: '#c9a94a', r: fr(a.main) }]
      : [{ id: 'oggetto', nome: 'Campione intero', colore: '#9aa0a6', r: fr(a.oggetto) },
         { id: 'main', nome: 'Parte usata', colore: '#c9a94a', r: fr(a.main) }];
    box.hidden = true;
    const f = ritaglio(img, corpo, zone, tipo === 'man');
    manuale = () => ({ oggetto: a.oggetto, coloreGola: a.coloreGola, ...f() });
  };
  return () => (manuale ? manuale() : { oggetto: a.oggetto, main: a.main, porta: a.porta, gola: a.gola, coloreGola: a.coloreGola });
}

function caricaImmagine(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => { URL.revokeObjectURL(url); ko(new Error('immagine')); };
    i.src = url;
  });
}

/**
 * Riquadri trascinabili sulla foto (uno, o due per il finger-pull: porta e
 * gola). Ritorna una funzione che dà i ritagli in pixel { id: {x,y,w,h} }.
 */
function ritaglio(img, corpo, zone, sfondoChiaro = false) {
  corpo.querySelector('#f-ritaglio-box').hidden = false;
  const box = corpo.querySelector('#f-ritaglio'), cv = corpo.querySelector('#f-canvas');
  const tile = corpo.querySelector('#f-tile'), barra = corpo.querySelector('#f-zone');
  box.querySelectorAll('.imp-rett').forEach((x) => x.remove());
  const W = img.naturalWidth, H = img.naturalHeight;
  const k = Math.min(1, 1400 / Math.max(W, H));
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const R = {}, el = {};
  let attiva = zone[0].id;
  for (const z of zone) {
    R[z.id] = { ...z.r };
    const d = document.createElement('div');
    d.className = 'imp-rett'; d.dataset.z = z.id; d.style.borderColor = z.colore;
    d.innerHTML = `${z.nome ? `<span class="imp-rett-et" style="background:${z.colore}">${esc(z.nome)}</span>` : ''}<div class="imp-maniglia" style="background:${z.colore}"></div>`;
    box.appendChild(d); el[z.id] = d;
  }
  barra.innerHTML = zone.length > 1 ? zone.map((z) => `<button type="button" class="btn-ghost btn-mini" data-zona="${z.id}" style="border-color:${z.colore}">${esc(z.nome)}</button>`).join('') : '';
  const disegna = () => {
    for (const z of zone) {
      const r = R[z.id], d = el[z.id];
      d.style.left = `${r.x * 100}%`; d.style.top = `${r.y * 100}%`; d.style.width = `${r.w * 100}%`; d.style.height = `${r.h * 100}%`;
      d.classList.toggle('attiva', z.id === attiva);
    }
    barra.querySelectorAll('[data-zona]').forEach((b) => b.classList.toggle('attivo', b.dataset.zona === attiva));
    const r = R[attiva], g = tile.getContext('2d');
    g.clearRect(0, 0, 192, 192);
    if (sfondoChiaro) { g.fillStyle = '#e9e6df'; g.fillRect(0, 0, 192, 192); }
    const sx = r.x * W, sy = r.y * H, sw = r.w * W, sh = r.h * H, s = Math.min(192 / sw, 192 / sh);
    g.drawImage(img, sx, sy, sw, sh, (192 - sw * s) / 2, (192 - sh * s) / 2, sw * s, sh * s);
  };
  disegna();
  barra.querySelectorAll('[data-zona]').forEach((b) => b.addEventListener('click', () => { attiva = b.dataset.zona; disegna(); }));
  corpo.querySelector('#f-tutta').onclick = () => { R[attiva] = { x: 0, y: 0, w: 1, h: 1 }; disegna(); };
  let drag = null;
  const pt = (e) => { const b = box.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  box.addEventListener('pointerdown', (e) => {
    const p = pt(e);
    const rett = e.target.closest('.imp-rett');
    if (rett) attiva = rett.dataset.z;
    const r = R[attiva];
    if (e.target.classList.contains('imp-maniglia')) drag = { tipo: 'man', p0: p, r0: { ...r } };
    else if (rett) drag = { tipo: 'sposta', p0: p, r0: { ...r } };
    else { drag = { tipo: 'nuovo', p0: p }; R[attiva] = { x: p.x, y: p.y, w: 0.01, h: 0.01 }; }
    box.setPointerCapture(e.pointerId); e.preventDefault(); disegna();
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pt(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, r = R[attiva];
    if (drag.tipo === 'sposta') { r.x = lim(drag.r0.x + dx, 0, 1 - r.w); r.y = lim(drag.r0.y + dy, 0, 1 - r.h); }
    else if (drag.tipo === 'man') { r.w = lim(drag.r0.w + dx, 0.02, 1 - r.x); r.h = lim(drag.r0.h + dy, 0.02, 1 - r.y); }
    else {
      const x0 = lim(Math.min(drag.p0.x, p.x), 0, 1), y0 = lim(Math.min(drag.p0.y, p.y), 0, 1);
      R[attiva] = { x: x0, y: y0, w: lim(Math.abs(dx), 0.02, 1 - x0), h: lim(Math.abs(dy), 0.02, 1 - y0) };
    }
    disegna();
  });
  const fine = () => { drag = null; };
  box.addEventListener('pointerup', fine); box.addEventListener('pointercancel', fine);
  return () => Object.fromEntries(zone.map((z) => {
    const r = R[z.id];
    return [z.id, { x: Math.round(r.x * W), y: Math.round(r.y * H), w: Math.max(1, Math.round(r.w * W)), h: Math.max(1, Math.round(r.h * H)) }];
  }));
}

// ---------------------------------------------------------------------------
// OGGETTI 3D PRONTI (Poly Haven, CC0): cerca, guarda in 3D, aggiungi al catalogo
// ---------------------------------------------------------------------------
let _chiudiPronto = null;
function fermaPronto() { if (_chiudiPronto) { _chiudiPronto(); _chiudiPronto = null; } }
const cmPronto = (mm) => (Math.round(mm / 5) / 2).toLocaleString('it-IT');
function apriPronti(statoRicerca = { testo: '', cat: CAT_PRONTI[0].id }) {
  fermaPronto();
  const corpo = document.getElementById('imp-modale-corpo');
  document.getElementById('imp-modale-titolo').textContent = tr('Oggetti 3D pronti');
  corpo.innerHTML = `
    <div class="imp-form">
      <div class="imp-aiuto">Oggetti già fatti in 3D da professionisti, con i materiali veri e le <strong>misure reali</strong>. Scrivi cosa cerchi (es. vaso, pianta, frutta, lampada) o scegli una categoria, tocca un oggetto per vederlo e aggiungilo al catalogo: in cucina lo trovi in «Aggiungi oggetti».</div>
      <div class="pronti-cerca"><input type="text" id="pr-testo" placeholder="Cosa cerchi? es. vaso, pianta, frutta…" value="${esc(statoRicerca.testo)}" autocomplete="off"><button type="button" class="btn-oro" id="pr-vai">Cerca</button></div>
      <div class="pronti-chip">${CAT_PRONTI.map((c) => `<button type="button" class="btn-ghost btn-mini ${!statoRicerca.testo && c.id === statoRicerca.cat ? 'attivo' : ''}" data-prcat="${c.id}">${esc(c.nome)}</button>`).join('')}</div>
      <div class="imp-auto-msg" id="pr-msg" hidden></div>
      <div class="pronti-griglia" id="pr-griglia"></div>
      <div class="pronti-credito">${esc(CREDITO_PRONTI)}</div>
      <div class="imp-piede"><button type="button" class="btn-ghost" id="pr-chiudi">Chiudi</button></div>
    </div>`;
  modale.hidden = false;
  const msg = (t) => { const m = corpo.querySelector('#pr-msg'); m.textContent = t; m.hidden = !t; };
  const mostra = async () => {
    const g = corpo.querySelector('#pr-griglia'); g.innerHTML = ''; msg(tr('Cerco…'));
    let lista = [];
    try { lista = await cercaPronti(statoRicerca.testo, statoRicerca.testo ? null : statoRicerca.cat); }
    catch (e) { msg(tr('Non riesco a collegarmi alla libreria degli oggetti: controlla la connessione e riprova.')); return; }
    if (!corpo.querySelector('#pr-griglia')) return;
    msg(lista.length ? '' : tr('Nessun oggetto trovato: prova con un\'altra parola o scegli una categoria.'));
    g.innerHTML = lista.slice(0, 80).map((o) => `
      <button type="button" class="pronti-voce" data-prid="${esc(o.id)}" title="${esc(o.nome)}">
        <img src="${miniPronto(o.id)}" alt="" loading="lazy">
        <span data-no-i18n>${esc(o.nome)}</span>
        ${o.dim ? `<small>${cmPronto(o.dim.w)} × ${cmPronto(o.dim.d)} × ${cmPronto(o.dim.h)} cm</small>` : ''}
      </button>`).join('');
    g.querySelectorAll('[data-prid]').forEach((b) => b.addEventListener('click', () => {
      const o = lista.find((x) => x.id === b.dataset.prid); if (o) apriSchedaPronto(null, o, statoRicerca);
    }));
  };
  const cercaOra = () => { statoRicerca.testo = corpo.querySelector('#pr-testo').value.trim(); corpo.querySelectorAll('[data-prcat]').forEach((x) => x.classList.toggle('attivo', !statoRicerca.testo && x.dataset.prcat === statoRicerca.cat)); mostra(); };
  corpo.querySelector('#pr-vai').addEventListener('click', cercaOra);
  corpo.querySelector('#pr-testo').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cercaOra(); } });
  corpo.querySelectorAll('[data-prcat]').forEach((b) => b.addEventListener('click', () => {
    statoRicerca.cat = b.dataset.prcat; statoRicerca.testo = ''; corpo.querySelector('#pr-testo').value = '';
    corpo.querySelectorAll('[data-prcat]').forEach((x) => x.classList.toggle('attivo', x === b)); mostra();
  }));
  corpo.querySelector('#pr-chiudi').addEventListener('click', () => { fermaPronto(); chiudi(); });
  mostra();
}
/** Un oggetto pronto: anteprima 3D, nome, misure; «Aggiungi al catalogo» (nuovo) o «Salva» (già nel catalogo). */
function apriSchedaPronto(p, o = null, statoRicerca = null) {
  fermaPronto();
  const nuovo = !p;
  const idPh = nuovo ? o.id : p.pronto.id;
  const corpo = document.getElementById('imp-modale-corpo');
  document.getElementById('imp-modale-titolo').textContent = tr(nuovo ? 'Oggetto 3D pronto' : 'Modifica prodotto');
  const mis = nuovo ? (o.dim ? { w: o.dim.w / 10, d: o.dim.d / 10, h: o.dim.h / 10 } : null) : { w: p.pronto.w, d: p.pronto.d, h: p.pronto.h };
  const v = (x) => (x != null ? String(Math.round(x * 10) / 10) : '');
  corpo.innerHTML = `
    <div class="imp-form">
      <div id="pr-vista" class="imp-man3d-vista"><div class="imp-aiuto">${tr('Scarico il 3D…')}</div></div>
      <label>Nome <span class="imp-obbl">*</span><input type="text" id="pr-nome" value="${esc(nuovo ? o.nome : p.nome)}"></label>
      <fieldset class="imp-misura">
        <legend>Misure reali (cm)</legend>
        <div class="imp-misure3">
          <label>Larghezza<input type="text" inputmode="decimal" autocomplete="off" id="pr-w" value="${v(mis && mis.w)}"></label>
          <label>Profondità<input type="text" inputmode="decimal" autocomplete="off" id="pr-d" value="${v(mis && mis.d)}"></label>
          <label>Altezza<input type="text" inputmode="decimal" autocomplete="off" id="pr-h" value="${v(mis && mis.h)}"></label>
        </div>
        <div class="imp-aiuto">Sono le misure vere dell'oggetto. Se le cambi, il 3D si allunga o si stringe.</div>
      </fieldset>
      <div class="pronti-credito">${esc(CREDITO_PRONTI)}</div>
      <div class="imp-errore" id="f-err" hidden></div>
      <div class="imp-piede">
        <button type="button" class="btn-ghost" id="pr-indietro">${nuovo ? '← Indietro' : 'Annulla'}</button>
        <button type="button" class="btn-oro" id="pr-salva">${nuovo ? 'Aggiungi al catalogo' : 'Salva'}</button>
      </div>
    </div>`;
  modale.hidden = false;
  const box = corpo.querySelector('#pr-vista');
  anteprimaPronto(box, idPh).then((f) => { if (corpo.contains(box)) _chiudiPronto = f; else f(); })
    .catch(() => { box.innerHTML = `<div class="imp-aiuto">${tr('Non riesco a scaricare il 3D: controlla la connessione e riprova.')}</div>`; });
  // senza misure nella libreria: quelle del modello scaricato
  if (!mis) modelloPronto(idPh).then((m) => { const d = m.userData.dim; for (const [k, x] of [['w', d.w], ['d', d.d], ['h', d.h]]) corpo.querySelector(`#pr-${k}`).value = v(x / 10); }).catch(() => {});
  corpo.querySelector('#pr-indietro').addEventListener('click', () => { fermaPronto(); if (nuovo) apriPronti(statoRicerca || undefined); else chiudi(); });
  corpo.querySelector('#pr-salva').addEventListener('click', async () => {
    const err = corpo.querySelector('#f-err'); err.hidden = true;
    const nome = corpo.querySelector('#pr-nome').value.trim();
    const n = (id) => Number(String(corpo.querySelector(id).value).replace(',', '.'));
    const w = n('#pr-w'), d = n('#pr-d'), h = n('#pr-h');
    if (!nome) { err.textContent = tr('Scrivi il nome del prodotto.'); err.hidden = false; return; }
    if (!(w > 0 && d > 0 && h > 0)) { err.textContent = tr('Scrivi le misure reali in cm (larghezza, profondità e altezza).'); err.hidden = false; return; }
    const b = corpo.querySelector('#pr-salva'); b.disabled = true; b.textContent = tr('Salvo…');
    try {
      if (nuovo) {
        const id = nuovoId();
        const foto = await (await fetch(miniPronto(idPh))).blob();          // anteprima nel catalogo
        await salvaFoto(id, foto, 'foto'); await salvaFoto(id, foto, 'thumb');
        stato.prodotti.push({ id, sezione: 'oggetti', nome, info: { note: 'Poly Haven · CC0' }, pronto: { fonte: 'polyhaven', id: idPh, w, d, h },
          creato: Date.now(), aggiornato: Date.now() });
      } else {
        stato.prodotti = stato.prodotti.map((x) => (x.id === p.id ? { ...x, nome, pronto: { ...x.pronto, w, d, h }, aggiornato: Date.now() } : x));
      }
      fermaPronto();
      await salvaERicarica();
    } catch (e) {
      console.error(e); err.textContent = tr('Salvataggio non riuscito: forse lo spazio del browser è pieno.'); err.hidden = false;
      b.disabled = false; b.textContent = tr(nuovo ? 'Aggiungi al catalogo' : 'Salva');
    }
  });
}

// ---------------------------------------------------------------------------
// PARAMETRI della falegnameria (aria delle ante, maniglia a J, sistema di cassetti)
// ---------------------------------------------------------------------------
// FERRAMENTA PER MARCA: quale voce della lista si sta modificando (0 = quella di partenza)
let _selGola = 0, _selCass = 0;
// SCHEDE dei Parametri: ogni tipo di lavoro con le sue impostazioni
const SCHEDE_PAR = [
  ['cucina', 'Cucina', 'Tutto quello che usa la cucina: ante, piedini, piano di lavoro, maniglia a J, gola, regletta d\'angolo e cassetti.'],
  ['battente', 'Armadio a battente', 'Armadi a battente: come monti struttura e schiena, ante interne.'],
  ['scorrevole', 'Armadio scorrevole', 'Armadi scorrevoli: struttura e schiena (uguali al battente o no), binari e tiradores.'],
  ['modulari', 'Mobili modulari', 'Mobili modulari (sottoscala, nicchie, mansarde): spessori, abbondanza di partenza e altezza delle maniglie.'],
];
let _schedaPar = (() => { try { const v = localStorage.getItem('ng-par-scheda'); return SCHEDE_PAR.some((x) => x[0] === v) ? v : 'cucina'; } catch (_) { return 'cucina'; } })();
function renderParametri(S) {
  const el = document.getElementById('imp-sezione'), P = parametri();
  const leggi = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), P);
  // ogni parametro con le SUE FOTO (una o più): un promemoria visivo di cosa vuol dire quel numero
  const campo = (path, et, aiuto = '', opz = {}) => {
    const v = leggi(path);
    return `<div class="par-campo-box"><label class="par-campo ${opz.largo ? 'largo' : ''}"><span class="par-et">${esc(et)}</span>
      <span class="par-input"><input type="${opz.testo ? 'text' : 'number'}" ${opz.numeri ? 'class="par-elenco"' : ''} ${opz.testo ? (opz.numeri ? 'inputmode="decimal"' : '') : 'inputmode="decimal" step="0.1" min="0"'} data-par="${path}" value="${v == null ? '' : esc(Array.isArray(v) ? v.join(', ') : v)}" placeholder="${esc(opz.ph || '')}">${opz.testo && !opz.mm ? '' : '<em>mm</em>'}</span>
      ${aiuto ? `<small>${esc(aiuto)}</small>` : ''}</label>${htmlFotoParametro(path)}</div>`;
  };
  const campoBin = (i, k, et, aiuto) => `<div class="par-campo-box"><label class="par-campo"><span class="par-et">${esc(et)}</span>
      <span class="par-input"><input type="number" inputmode="decimal" step="0.1" min="0" data-bin="${i}.${k}" value="${esc(P.binari[i][k])}"><em>mm</em></span>
      <small>${esc(aiuto)}</small></label>${htmlFotoParametro(`binario:${P.binari[i].id}.${k}`)}</div>`;
  // SCHEMI dei parametri (gli stessi della configurazione guidata): si ridisegnano con i numeri
  const fig = (nome, didascalia, foto = []) => `<div class="par-figure"><figure><div data-fig="${nome}">${svgParametro(nome, P)}</div><figcaption>${esc(didascalia)}</figcaption></figure>${foto.map(([src, d]) => `<figure><img src="${src}" alt="" loading="lazy"><figcaption>${esc(d)}</figcaption></figure>`).join('')}</div>`;
  const cardBinario = (b, i, n) => `
      <div class="par-binario">
        <div class="par-bin-testa">
          <label class="par-campo"><span class="par-et">Nome del binario</span>
            <span class="par-input"><input type="text" data-bin="${i}.nome" value="${esc(b.nome)}" placeholder="es. Syscore"></span></label>
          ${n > 1 ? `<button type="button" class="btn-ghost btn-mini" data-bin-togli="${i}">✕ Togli</button>` : ''}
        </div>
        <div class="par-griglia">
          ${campoBin(i, 'larghezzaMeno', 'Larghezza anta: togli', 'larghezza esterna ÷ n° ante − questo numero (0 = anta larga come il modulo)')}
          ${campoBin(i, 'altezzaMeno', 'Altezza anta: togli', 'altezza esterna totale (fianchi + top + fondo) − questo numero')}
        </div>
        <div class="par-esempio" data-bin-es="${i}" data-no-i18n></div>
        <div class="par-figure"><figure><div data-fig-bin="${i}">${svgBinario(b, P.tiradori[0])}</div><figcaption>${esc('Schema: armadio scorrevole visto davanti')}</figcaption></figure></div>
      </div>`;
  // barra delle voci di una ferramenta (gola / cassetti): si tocca quella da modificare
  const barraSistemi = (tipo, nomi, sel) => `<div class="par-sistemi" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px">
      ${nomi.map((n, i) => `<button type="button" class="btn-ghost ${i === sel ? 'attivo' : ''}" data-sis="${tipo}" data-i="${i}">${i === sel ? '✓ ' : ''}${esc(n || '—')}${i === 0 ? ` <small style="opacity:.75;text-transform:none;letter-spacing:0">· ${esc(tr('predefinito'))}</small>` : ''}</button>`).join('')}
      <button type="button" class="btn-ghost" data-sis-agg="${tipo}">+ Aggiungi</button></div>`;
  const azioniSistema = (tipo, sel) => sel > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
      <button type="button" class="btn-ghost" data-sis-pref="${tipo}">Usa come predefinito</button>
      <button type="button" class="btn-ghost" data-sis-togli="${tipo}">✕ Togli</button></div>` : '';
  const listaGole = [P.gola, ...P.goleAltre], listaCass = [P.cassetti, ...P.cassettiAltri];
  if (_selGola >= listaGole.length) _selGola = 0;
  if (_selCass >= listaCass.length) _selCass = 0;
  const pg = _selGola === 0 ? 'gola' : `goleAltre.${_selGola - 1}`, pc = _selCass === 0 ? 'cassetti' : `cassettiAltri.${_selCass - 1}`;
  const FORME_TIR = [['avvolgente', "Avvolgente (abbraccia il bordo dell'anta)"], ['piatto', 'Piatto (lama sul fronte)'], ['tondo', 'Tondo (mezzo tubo sul fronte)']];
  const cardTirador = (x, i, n) => `
      <div class="par-binario">
        <div class="par-bin-testa">
          <label class="par-campo"><span class="par-et">Nome del tirador</span>
            <span class="par-input"><input type="text" data-tir="${i}.nome" value="${esc(x.nome)}" placeholder="es. Syskor"></span></label>
          ${n > 1 ? `<button type="button" class="btn-ghost btn-mini" data-tir-togli="${i}">✕ Togli</button>` : ''}
        </div>
        <div class="par-griglia">
          ${[['togli', 'Larghezza anta: togli', 'in più, alla larghezza di ogni anta, per i profili sui due lati'],
             ['larghezza', 'Faccia che si vede', 'larghezza del profilo vista davanti (nel 3D)'],
             ['sporgenza', 'Sporgenza', "quanto esce davanti all'anta (nel 3D)"]].map(([k, et, aiuto]) => `<div class="par-campo-box"><label class="par-campo"><span class="par-et">${esc(et)}</span>
            <span class="par-input"><input type="number" inputmode="decimal" step="0.1" min="0" data-tir="${i}.${k}" value="${esc(x[k])}"><em>mm</em></span>
            <small>${esc(aiuto)}</small></label></div>`).join('')}
          <div class="par-campo-box"><label class="par-campo"><span class="par-et">Forma</span>
            <span class="par-input"><select data-tir="${i}.forma">${FORME_TIR.map(([v, t2]) => `<option value="${v}" ${x.forma === v ? 'selected' : ''}>${esc(t2)}</option>`).join('')}</select></span></label></div>
        </div>
      </div>`;
  // SISTEMI DI CASSETTI: comprati (scatola già fatta) o fatti da noi; lo stesso gruppo in Cucina e negli Armadi
  const scelta2 = (attr, val, on, tit, sotto) => `<button type="button" class="par-scelta ${on ? 'sel' : ''}" data-${attr}="${val}"><b>${esc(tit)}</b><small>${esc(sotto)}</small></button>`;
  // CASSETTIERA DENTRO GLI ARMADI: scatola, cornice di fascette, frontali, ripiano sopra (top)
  const gruppoCassettiera = (tipo) => {
    const pc = `cassettieraArmadio.${tipo}`;
    return `
    <div class="par-gruppo">
      <h3>Cassettiera</h3>
      <p class="imp-desc">La cassettiera dentro l'armadio: la scatola appoggiata alla schiena, i frontali davanti, le fascette che fanno la cornice dei frontali (laterali e sotto) e il ripiano sopra che fa da top. Di partenza la maniglia è incassata (fresata nel frontale, non sporge niente). In ogni cassettiera si può scegliere la maniglia esterna (scrivendo quanto sporge) o i frontali ribassati, e le misure dei cassetti una per una.</p>
      <div class="par-griglia">
        ${tipo === 'battente'
          ? campo(`${pc}.fascia`, 'Fascette laterali: larghezza', 'di piatto, una per lato, a filo dei frontali')
          : campo(`${pc}.fascia`, 'Fascette laterali: profondità', 'di costa, larghe come la struttura, a filo dei frontali')}
        ${campo(`${pc}.fasciaSotto`, 'Fascette sotto: profondità', 'due: una davanti a filo dei frontali, una dietro')}
        ${tipo === 'battente'
          ? campo(`${pc}.ariaDavanti`, 'Aria fra frontali e anta chiusa', 'con la maniglia esterna si aggiunge quanto sporge')
          : campo(`${pc}.ariaBinario`, 'Aria fra frontali e binario', 'con la maniglia esterna si aggiunge quanto sporge')}
        ${campo(`${pc}.fuga`, 'Fuga dei frontali', 'fra un frontale e l\'altro e ai lati')}
        ${campo(`${pc}.ribasso`, 'Frontali ribassati: di quanto', 'senza maniglia: il vuoto resta sopra il frontale per la mano')}
        ${campo(`${pc}.fondoMeno`, 'Fondo del cassetto: guida meno', 'es. guida 500 − 20 = fondo 480')}
      </div>
      <div class="par-esempio" data-es-cassettiera="${tipo}" data-no-i18n style="white-space:pre-line"></div>
    </div>`;
  };
  const gruppoCassetti = (dove = 'cucina') => {
    const C = listaCass[_selCass] || P.cassetti, nostro = C.tipo === 'nostro';
    return `
    <div class="par-gruppo">
      <h3>Sistemi di cassetti</h3>
      <p class="imp-desc">Una voce per ogni sistema di cassetti: a sistema (Syskor, Blum, Novatec…) oppure su misura, costruiti in laboratorio, ciascuno con le proprie misure. In cucina si sceglie per tutta la cucina o per la singola cassettiera; negli armadi in ogni cassettiera. Di partenza si usa il cassetto a sistema.</p>
      ${barraSistemi('cass', listaCass.map((c) => c.marca), _selCass)}
      <div class="par-scelte" style="margin-bottom:12px">
        ${scelta2('cass-tipo', 'comprato', !nostro, 'Cassetto a sistema', 'guide e fianchi del produttore; in distinta fondo e trasera')}
        ${scelta2('cass-tipo', 'nostro', nostro, 'Cassetto su misura', 'scatola costruita in laboratorio; in distinta fianchi, trasera, davanti interno e fondo')}
      </div>
      <div class="par-griglia">
        ${campo(`${pc}.marca`, nostro ? 'Nome' : 'Marca', '', { testo: true, ph: nostro ? 'es. Cassetto legno 16' : 'es. Syscore' })}
        ${campo(`${pc}.profondita`, nostro ? 'Lunghezza guide in cucina' : 'Profondità del cassetto in cucina (guide)', 'i mobili della cucina hanno tutti la stessa profondità')}
        ${campo(`${pc}.guide`, 'Guide che si possono usare', 'separate da virgola, es. 500, 400, 350, 300. Negli armadi ogni cassettiera usa la più lunga che entra nella sua profondità', { testo: true, numeri: true, mm: true, ph: '500, 400, 350, 300' })}
      </div>
      ${nostro ? `
      <h4 style="margin:14px 0 6px">Montaggio</h4>
      <div class="par-scelte">
        ${scelta2('cass-mont', '4lati', C.montaggio !== '3lati', 'Scatola a 4 lati + frontale', 'fianchi, davanti interno e trasera; il frontale si fissa sul davanti')}
        ${scelta2('cass-mont', '3lati', C.montaggio === '3lati', 'Scatola a 3 lati', 'fianchi e trasera; il frontale fa da davanti')}
      </div>
      <div class="par-griglia" style="margin-top:10px">
        ${campo(`${pc}.spazioGuide`, 'Gioco per le guide (per lato)', 'da togliere alla larghezza su ciascun lato')}
        ${campo(`${pc}.spessoreScatola`, 'Spessore fianchi, trasera e davanti')}
        ${campo(`${pc}.dietroMeno`, 'Trasera più bassa dei fianchi', '0 = stessa altezza dei fianchi')}
        ${campo(`${pc}.fondoSpessore`, 'Spessore del fondo')}
        ${campo(`${pc}.fondoCanale`, 'Fondo in canale: profondità per lato', '0 = fondo avvitato sotto')}
        ${campo(`${pc}.fianchiMobile`, 'Cucina: spessore fianchi del mobile', 'spazio interno = larghezza modulo − 2 × spessore (negli armadi lo calcola la cassettiera)')}
      </div>
      <h4 style="margin:14px 0 6px">Altezza dei fianchi</h4>
      <div class="par-scelte">
        ${scelta2('cass-alt', 'frontale', C.altezzaModo !== 'tipo', 'In base al frontale', 'fianchi = altezza del frontale − valore indicato')}
        ${scelta2('cass-alt', 'tipo', C.altezzaModo === 'tipo', 'Fissa per tipo di cassetto', 'piccolo, medio e grande, indipendente dal frontale')}
      </div>
      ${C.altezzaModo === 'tipo' ? `
      <table class="par-tab" style="margin-top:10px">
        <thead><tr><th></th><th>Frontale fino a</th><th>Altezza fianchi</th></tr></thead>
        <tbody>
          <tr><th>Cassetto piccolo</th><td>${campo(`${pc}.piccoloFinoA`, '')}</td><td>${campo(`${pc}.altezzaPiccolo`, '')}</td></tr>
          <tr><th>Cassetto medio</th><td>${campo(`${pc}.medioFinoA`, '', '', { ph: '—' })}</td><td>${campo(`${pc}.altezzaMedio`, '')}</td></tr>
          <tr><th>Cassetto grande</th><td class="par-piu">più alti del medio</td><td>${campo(`${pc}.altezzaGrande`, '')}</td></tr>
        </tbody>
      </table>` : `
      <div class="par-griglia" style="margin-top:10px">${campo(`${pc}.altezzaMeno`, 'Differenza tra frontale e fianchi', 'es. frontale 230 − 40 = fianchi 190')}</div>`}
      <div class="par-griglia" style="margin-top:10px">
        ${campo(`${pc}.materialeScatola`, 'Materiale scatola', 'riportato in distinta', { testo: true })}
        ${campo(`${pc}.materialeFondo`, 'Materiale fondo', 'riportato in distinta', { testo: true })}
      </div>` : `
      <div class="par-griglia">
        ${campo(`${pc}.spessore`, 'Spessore di fondo e trasera')}
        ${campo(`${pc}.fondoMeno`, 'Fondo: larghezza = modulo meno')}
        ${campo(`${pc}.fondoProfondita`, 'Fondo: profondità', 'uguale per tutti i cassetti')}
        ${campo(`${pc}.traseraMeno`, 'Trasera: larghezza = modulo meno')}
      </div>
      <table class="par-tab">
        <thead><tr><th></th><th>Frontale fino a</th><th>Altezza trasera</th></tr></thead>
        <tbody>
          <tr><th>Cassetto piccolo</th><td>${campo(`${pc}.piccoloFinoA`, '')}</td><td>${campo(`${pc}.piccoloTrasera`, '')}</td></tr>
          <tr><th>Cassetto medio</th><td>${campo(`${pc}.medioFinoA`, '', '', { ph: '—' })}</td><td>${campo(`${pc}.medioTrasera`, '', '', { ph: '—' })}</td></tr>
          <tr><th>Cassetto grande</th><td class="par-piu">più alti del medio</td><td>${campo(`${pc}.grandeTrasera`, '', '', { ph: '—' })}</td></tr>
        </tbody>
      </table>
      <p class="imp-desc">Il cassetto grande: lascialo vuoto finché non ti serve. Quando lo usi, scrivi anche fino a che altezza di frontale arriva il medio: i frontali più alti diventano grandi.</p>`}
      ${azioniSistema('cass', _selCass)}
      <div class="par-esempio" data-es-cass="${dove}" data-no-i18n style="white-space:pre-line"></div>
      ${nostro ? '' : fig('cassetti', 'Schema: cassetto visto da sopra')}
    </div>`;
  };
  el.innerHTML = `
    <p class="imp-desc">${esc(S.desc)}</p>
    <div id="par-mancanti"></div>
    <p class="imp-desc">Valgono su questo dispositivo; con la «copia completa» li porti anche sugli altri. Si salvano da soli mentre scrivi.</p>
    <p class="imp-desc">📷 Ogni parametro può avere una o più foto (es. dove si misura): tocca «+ Foto» sotto il numero; tocca una foto per vederla grande o toglierla.</p>
    <div class="par-schede" role="tablist" style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 4px">
      ${SCHEDE_PAR.map(([id, nome]) => `<button type="button" role="tab" class="btn-ghost ${_schedaPar === id ? 'attivo' : ''}" data-scheda-btn="${id}" aria-selected="${_schedaPar === id}">${esc(nome)}</button>`).join('')}
    </div>
    <div class="par-scheda" data-scheda="cucina" ${_schedaPar === 'cucina' ? '' : 'hidden'}>
      <p class="imp-desc par-scheda-desc">${esc((SCHEDE_PAR.find((x) => x[0] === 'cucina') || [])[2] || '')}</p>
    <div class="par-gruppo">
      <h3>Aria delle ante e dei frontali</h3>
      <div class="par-griglia">
        ${campo('ante.ariaAltezza', 'Aria in altezza', "tolta all'altezza di ogni anta (sopra e sotto insieme)")}
        ${campo('ante.ariaLarghezza', 'Aria in larghezza', 'tolta alla larghezza (sui due lati insieme)')}
        ${campo('ante.ariaTraAnte', 'Aria tra due ante', 'tra le ante dello stesso modulo')}
        ${campo('ante.ariaCassetti', 'Aria tra i frontali dei cassetti', 'tra un frontale e l\'altro, e sopra e sotto')}
      </div>
      <div class="par-esempio" id="par-es-ante" data-no-i18n></div>
      ${fig('aria', 'Schema: mobile con 2 ante e mobile con 3 cassetti, visti davanti')}
    </div>
    <div class="par-gruppo">
      <h3>Piedini della cucina (altezza dello zoccolo)</h3>
      <div class="par-scelte" id="par-piedini">${[[100, 'Piedini da 10 cm', 'Zoccolo alto 10 cm'], [150, 'Piedini da 15 cm', 'Zoccolo alto 15 cm'], [0, 'Automatico', 'Bassi da 70 → 15 cm, bassi da 80 → 10 cm']].map(([v, tit, sotto]) => `<button type="button" class="par-scelta ${P.cucina.piedini === v ? 'sel' : ''}" data-piedini="${v}"><b>${esc(tit)}</b><small>${esc(sotto)}</small></button>`).join('')}</div>
      ${fig('piedini', 'Schema: mobile basso visto di lato')}
      <p class="imp-desc">Vale per le cucine nuove; in una cucina già fatta lo cambi nella cucina stessa.</p>
      <div class="par-griglia" style="margin-top:10px">
        ${campo('cucina.margineZoccolo', 'Margine sullo zoccolo', 'in distinta ogni pezzo di zoccolo è più lungo di questo (di partenza 100 = 10 cm), per tagliarlo sul posto; nel 3D resta com\'è')}
        ${campo('cucina.zoccoloMax', 'Zoccolo: pezzo più lungo', 'di partenza 4000 (barre da 4 m): un tratto più lungo va in più pezzi da giuntare')}
      </div>
    </div>
    <div class="par-gruppo">
      <h3>Piano di lavoro</h3>
      <div class="par-griglia">
        ${campo('cucina.profonditaPiano', 'Profondità del piano', 'dal muro, come i mobili (di serie 625: con i mobili da 600 esce 25 mm davanti alle ante); sui lati a filo')}
      </div>
      <div class="par-scelte" style="margin-top:10px">${[[false, 'Senza alzatina', 'Il piano finisce al muro'], [true, 'Con alzatina', 'Una striscia bassa sul muro, dietro il piano']].map(([v, tit, sotto]) => `<button type="button" class="par-scelta ${P.cucina.alzatina === v ? 'sel' : ''}" data-alzpar="${v ? 'si' : 'no'}"><b>${esc(tit)}</b><small>${esc(sotto)}</small></button>`).join('')}</div>
      <div class="par-griglia" style="margin-top:10px" ${P.cucina.alzatina ? '' : 'hidden'} id="par-alz-h">
        ${campo('cucina.altezzaAlzatina', 'Altezza dell\'alzatina', 'di serie 100 mm; stesso materiale del piano (o quello che scegli in cucina)')}
      </div>
      ${fig('piano', 'Schema: il piano visto di lato')}
      <p class="imp-desc">Vale per le cucine nuove; in una cucina già fatta la cambi nel Rendering → Piano di lavoro e pannello dietro. Dove c'è un costado il piano finisce a filo del costado.</p>
    </div>
    <div class="par-gruppo">
      <h3>Cerniere dei pensili</h3>
      <p class="imp-desc">Misura standard: 95 mm da sopra e 95 mm da sotto. Se lavori con altre misure, cambiale qui: valgono per tutte le ante dei pensili.</p>
      <div class="par-griglia">
        ${campo('cucina.cernieraSopra', 'Cerniera sopra', "distanza dal bordo sopra dell'anta (standard 95)")}
        ${campo('cucina.cernieraSotto', 'Cerniera sotto', "distanza dal bordo sotto dell'anta (standard 95)")}
      </div>
      <div class="par-esempio" id="par-es-cern" data-no-i18n></div>
      <p class="imp-desc">Nella distinta e nell'esportazione ogni anta dei pensili ha scritto: 2 cerniere standard e a quanti mm da sopra e da sotto. Quando le due misure sono diverse (anta che scende di più: 72, 92…) c'è scritto anche se le cerniere sono a destra o a sinistra.</p>
    </div>
    <div class="par-gruppo">
      <h3>Ante dei pensili che scendono</h3>
      <p class="imp-desc">Per aprire i pensili da sotto, senza maniglia: l'anta scende sotto il mobile. Ogni voce compare come scelta in «Ante pensili» di ogni cucina; nel 3D, nel disegno e in distinta l'anta è più lunga di quanto scritto e le cerniere sotto si spostano da sole.</p>
      ${P.cucina.anteScendono.map((v, i) => `
      <div class="par-griglia">
        <div class="par-campo-box"><label class="par-campo"><span class="par-et">Pensili alti</span>
          <span class="par-input"><input type="number" inputmode="numeric" min="0" step="1" data-asc="${i}.altezza" value="${v.altezza || ''}" placeholder="—"><em>mm</em></span>
          <small>vuoto = tutti i pensili</small></label></div>
        <div class="par-campo-box"><label class="par-campo"><span class="par-et">L'anta scende di</span>
          <span class="par-input"><input type="number" inputmode="numeric" min="0" step="1" data-asc="${i}.scende" value="${v.scende}"><em>mm</em></span>
          <small data-asc-nome="${i}">${esc(nomeAntaScende(v))}</small></label></div>
        <div class="par-campo-box" style="align-self:center"><button type="button" class="btn-ghost btn-mini" data-asc-togli="${i}">✕ Togli</button></div>
      </div>`).join('')}
      <button type="button" class="btn-ghost" id="par-asc-agg" style="margin-top:8px">+ Aggiungi</button>
    </div>
    <div class="par-gruppo">
      <h3>Finger-pull</h3>
      <p class="imp-desc">La presa per le dita al posto della maniglia (in cucina si sceglie per bassi, pensili e colonne). Fresata: l'anta resta intera e la presa si scava nel bordo. Con il profilo: l'anta si accorcia della misura del profilo e sul bordo si monta il profilo in alluminio, nel 3D e in distinta.</p>
      <div class="par-scelte" style="margin-bottom:12px">
        ${scelta2('fp-tipo', 'fresato', P.fingerPull.tipo !== 'profilo', 'Presa fresata nell\'anta', 'anta intera; in distinta la nota «presa da fresare»')}
        ${scelta2('fp-tipo', 'profilo', P.fingerPull.tipo === 'profilo', 'Profilo in alluminio sopra l\'anta', 'l\'anta si accorcia della misura del profilo')}
      </div>
      ${P.fingerPull.tipo === 'profilo' ? `<div class="par-griglia">${campo('fingerPull.profilo', 'Altezza del profilo', "si toglie dall'altezza dell'anta (es. 698 − 25 = 673)")}</div>` : ''}
      <div class="par-esempio" id="par-es-fp" data-no-i18n></div>
    </div>
    <div class="par-gruppo">
      <h3>Maniglia a J (profilo sopra l'anta)</h3>
      <div class="par-griglia">
        ${campo('manigliaJ.spessore', 'Spessore del profilo a J', "l'anta si accorcia di questo spessore")}
      </div>
      <div class="par-esempio" id="par-es-j" data-no-i18n></div>
      ${fig('manigliaJ', 'Schema: il profilo a J sul bordo alto dell\'anta, visto di lato')}
      <p class="imp-desc">Vale per le maniglie con la forma «Profilo (a J)»: le aggiungi in ⚙ Impostazioni → Maniglie e le scegli in cucina.</p>
    </div>
    <div class="par-gruppo">
      <h3>Gola in alluminio</h3>
      <p class="imp-desc">Una voce per ogni marca o modello di gola che usi, con le sue misure. In cucina scegli quale usare (di partenza quella predefinita).</p>
      ${barraSistemi('gola', listaGole.map((g) => g.nome), _selGola)}
      <div class="par-griglia">
        ${campo(`${pg}.nome`, 'Nome (marca / modello)', '', { testo: true, ph: 'es. Syskor' })}
        ${campo(`${pg}.spazio`, 'Spazio per le dita', "tolti in alto all'anta, sopra il primo cassetto e fra un cassetto e l'altro")}
        ${campo(`${pg}.spazioV`, 'Colonne: spazio per la gola verticale', 'fra colonna e colonna, e fra colonna e costado dal lato della maniglia')}
        ${campo(`${pg}.accorcia`, 'Colonne: il fianco si accorcia di', 'il fianco della colonna dal lato della gola (es. 580 → 568)')}
        ${campo(`${pg}.centrale16`, 'Profilo verticale centrale (fianchi da 16)', 'larghezza del profilo')}
        ${campo(`${pg}.centrale18`, 'Profilo verticale centrale (fianchi da 18)', 'larghezza del profilo')}
        ${campo(`${pg}.laterale16`, 'Profilo verticale laterale (fianchi da 16)', 'larghezza del profilo')}
        ${campo(`${pg}.laterale18`, 'Profilo verticale laterale (fianchi da 18)', 'larghezza del profilo')}
        ${campo(`${pg}.barra`, 'Barre dei profili L e C', 'lunghezza delle barre da ordinare (di serie 4000)')}
        ${campo(`${pg}.barraV`, 'Barre dei profili verticali', 'lunghezza delle barre da ordinare (di serie 2600)')}
      </div>
      ${azioniSistema('gola', _selGola)}
      <div class="par-esempio" id="par-es-gola" data-no-i18n></div>
      ${fig('gola', 'Schema: mobile con 3 cassetti, visto di lato', [['img/guida/gola-vicino.jpg', 'Come si vede nel 3D del programma'], ['img/guida/gola-profilo.jpg', 'Il profilo a L sotto il piano']])}
      <p class="imp-desc">Vale quando nei mobili bassi scegli «Gola alluminio» (Porte · mobili bassi).</p>
    </div>
    <div class="par-gruppo">
      <h3>Regletta d'angolo</h3>
      <div class="par-griglia">
        ${campo('regletta.vista', 'Quanto si vede (per lato)', 'di partenza 3 × 3 cm: la parte della regletta che si vede nell\'angolo')}
        ${campo('regletta.spessoreAnta', 'Spessore dell\'anta', 'un pezzo è largo quanto si vede, l\'altro + questo spessore: sormonta il primo')}
      </div>
      <div class="par-esempio" id="par-es-reg" data-no-i18n></div>
      ${fig('regletta', 'Schema: l\'angolo visto da sopra', [['img/guida/regletta-angolo.jpg', 'Come si vede nel 3D del programma']])}
      <p class="imp-desc">Vale per le cucine nuove; in una cucina già fatta la cambi toccando il mobile dell'angolo.</p>
    </div>
    <div class="par-gruppo">
      <h3>Moduli speciali: pensile angolo a L e Ciaflan</h3>
      <p class="imp-desc">Da una marca all'altra questi moduli possono cambiare: controlla che le misure di partenza siano quelle del tuo fornitore. In cucina le puoi cambiare anche per un mobile solo.</p>
      <p class="imp-desc">Pensile angolo a L (63 × 63): le due ante si incontrano nell'angolo. L'anta grande arriva fino all'angolo: lato − profondità del pensile − l'aria sul lato libero. L'anta piccola si ferma contro la grande: la stessa misura − lo spessore dell'anta (quello della regletta d'angolo) − il giunto.</p>
      <div class="par-griglia">
        ${campo('cucina.angoloAria', 'Aria sul lato libero', 'si toglie a tutte e due le ante (di partenza 5)')}
        ${campo('cucina.angoloGiunto', 'Giunto fra le due ante', 'in più dello spessore dell\'anta, solo sull\'anta piccola (di partenza 1)')}
      </div>
      <div class="par-esempio" id="par-es-angolo" data-no-i18n></div>
      <div class="par-griglia" style="margin-top:10px">
        ${campo('cucina.ciaflanAnta', 'Anta del Ciaflan 63 × 63', 'un\'anta sola in diagonale; di partenza 421 (diagonale fra due pensili da 33 = 424, − 3 di aria)')}
      </div>
    </div>
    ${gruppoCassetti('cucina')}
    </div>
    <div class="par-scheda" data-scheda="battente" ${_schedaPar === 'battente' ? '' : 'hidden'}>
      <p class="imp-desc par-scheda-desc">${esc((SCHEDE_PAR.find((x) => x[0] === 'battente') || [])[2] || '')}</p>
    <div class="par-gruppo">
      <h3>Struttura e schiena</h3>
      <p class="imp-desc">I valori di partenza di ogni armadio nuovo: tocca il modo in cui lavori. Nel singolo armadio li puoi sempre cambiare (Setup carcassa e Schiena).</p>
      <div id="par-montaggio"></div>
    </div>
    <div class="par-gruppo">
      <h3>Ante interne</h3>
      <div class="par-griglia">
        ${campo('anteInterne.aria', 'Aria attorno all\'anta', 'attorno a ogni anta e fra un\'anta e l\'altra, dentro il vano')}
        ${campo('anteInterne.spazioRipiano', 'Spazio fra anta e ripiano', 'i ripiani stanno indietro di tanto rispetto all\'anta chiusa')}
      </div>
      <div class="par-esempio" id="par-es-int" data-no-i18n></div>
      ${fig('anteInterne', 'Schema: ante interne viste davanti e da sopra')}
      <p class="imp-desc">Vale quando nell'armadio a battente scegli «Ante interne»: l'anta sta dentro il vano, a filo della struttura.</p>
    </div>
    ${gruppoCassettiera('battente')}
    ${gruppoCassetti('battente')}
    </div>
    <div class="par-scheda" data-scheda="scorrevole" ${_schedaPar === 'scorrevole' ? '' : 'hidden'}>
      <p class="imp-desc par-scheda-desc">${esc((SCHEDE_PAR.find((x) => x[0] === 'scorrevole') || [])[2] || '')}</p>
    <div class="par-gruppo">
      <h3>Struttura e schiena</h3>
      <div id="par-montaggio-sc"></div>
    </div>
    <div class="par-gruppo">
      <h3>Binari</h3>
      <p class="imp-desc">Ogni binario ha i suoi numeri per calcolare le ante. Nell'armadio scorrevole scegli quale binario usi.</p>
      <div id="par-binari">${P.binari.map((b, i) => cardBinario(b, i, P.binari.length)).join('')}</div>
      <button type="button" class="btn-ghost" id="par-bin-agg">+ Aggiungi binario</button>
    </div>
    <div class="par-gruppo">
      <h3>Tiradores</h3>
      <p class="imp-desc">Il profilo a tutta altezza sui due lati di ogni anta scorrevole (le maniglie che sporgono non si possono mettere: le ante scorrono una dietro l'altra). Uno per ogni modello che usi; nell'armadio scorrevole scegli quale.</p>
      <div id="par-tiradori">${P.tiradori.map((x, i) => cardTirador(x, i, P.tiradori.length)).join('')}</div>
      <button type="button" class="btn-ghost" id="par-tir-agg">+ Aggiungi tirador</button>
    </div>
    ${gruppoCassettiera('scorrevole')}
    ${gruppoCassetti('scorrevole')}
    </div>
    <div class="par-scheda" data-scheda="modulari" ${_schedaPar === 'modulari' ? '' : 'hidden'}>
      <p class="imp-desc par-scheda-desc">${esc((SCHEDE_PAR.find((x) => x[0] === 'modulari') || [])[2] || '')}</p>
    <div class="par-gruppo">
      <h3>Spessori di partenza</h3>
      <div class="par-griglia">
        ${campo('modulari.carcassa', 'Struttura (fianchi, top, fondo)', 'vale per i mobili modulari nuovi; nel progetto si cambiano')}
        ${campo('modulari.schiena', 'Schiena')}
        ${campo('modulari.ante', 'Ante e pannelli fissi')}
      </div>
    </div>
    <div class="par-gruppo">
      <h3>Abbondanza sul lato inclinato</h3>
      <p class="imp-desc">Muri e scale non sono mai dritti: i pezzi con il lato inclinato si tagliano più lunghi e si rifilano a filo in opera.</p>
      <div class="par-griglia">
        ${campo('modulari.abbFianchi', 'Fianchi')}
        ${campo('modulari.abbTop', 'Top')}
        ${campo('modulari.abbAnte', 'Ante e pannelli fissi')}
      </div>
    </div>
    <div class="par-gruppo">
      <h3>Maniglie</h3>
      <p class="imp-desc">Tutte le maniglie dei mobili modulari stanno alla stessa altezza da terra. Le ante che non arrivano a questa altezza (o partono più in alto) sono push; nel progetto si può mettere la maniglia lo stesso, modulo per modulo.</p>
      <div class="par-griglia">
        ${campo('modulari.altezzaManiglia', 'Altezza della maniglia da terra (centro)', 'di partenza 1050 mm, come negli armadi')}
      </div>
    </div>
    </div>
    <div class="par-azioni">
      <a class="btn-ghost" href="./benvenuto.html" style="display:inline-block;text-decoration:none;padding:9px 14px">▶ Rifai la configurazione guidata</a>
      <button type="button" class="btn-ghost" id="par-ripristina">↺ Rimetti i valori di partenza</button>
      <span class="imp-auto-msg" id="par-msg" hidden>✓ Salvato</span>
    </div>`;
  const esempi = () => {
    const Q0 = parametri();
    // esempi e schemi con la gola e i cassetti che si stanno modificando
    const Q = { ...Q0, gola: [Q0.gola, ...Q0.goleAltre][_selGola] || Q0.gola, cassetti: [Q0.cassetti, ...Q0.cassettiAltri][_selCass] || Q0.cassetti };
    const A = Q.ante, c = Q.cassetti, f = (n) => String(Math.round(n * 10) / 10);
    el.querySelector('#par-es-ante').textContent = tr(`Esempio: modulo 600 × 700 → 1 anta ${f(600 - A.ariaLarghezza)} × ${f(700 - A.ariaAltezza)} mm, 2 ante ${f((600 - A.ariaLarghezza - A.ariaTraAnte) / 2)} × ${f(700 - A.ariaAltezza)} mm`);
    el.querySelector('#par-es-j').textContent = tr(`Esempio: anta da 700 con maniglia a J → 700 − ${f(A.ariaAltezza)} − ${f(Q.manigliaJ.spessore)} = ${f(700 - A.ariaAltezza - Q.manigliaJ.spessore)} mm`);
    { const G = Q.gola.spazio, es = (H) => tr(`mobile basso da ${H} con la gola → anta ${H} − ${f(G)} = ${f(H - G)} mm · 3 cassetti da ${f(Math.floor((H - 3 * G) / 3))} mm`);
      el.querySelector('#par-es-gola').textContent = tr('Esempio:') + ' ' + es(700) + ' · ' + es(800); }
    { const I = Q.anteInterne, w = (1000 - 36 - 3 * I.aria) / 2, h = 2000 - 36 - 2 * I.aria;
      el.querySelector('#par-es-int').textContent = tr(`Esempio: armadio 1000 × 2000, struttura 18, 2 ante → vano 964 × 1964 → ante interne ${f(w)} × ${f(h)} mm · ripiani ${f(I.spazioRipiano)} mm più indietro dell'anta`); }
    { const F = Q.fingerPull, eFp = el.querySelector('#par-es-fp');
      if (eFp) eFp.textContent = F.tipo === 'profilo' && F.profilo > 0
        ? tr(`Esempio: anta da 700 → 700 − ${f(A.ariaAltezza)} − ${f(F.profilo)} = ${f(700 - A.ariaAltezza - F.profilo)} mm + profilo da ${f(F.profilo)} lungo come l'anta`)
        : tr(`Esempio: anta da 700 → ${f(700 - A.ariaAltezza)} mm intera, con la presa da fresare nel bordo`); }
    { const K = Q.cucina; el.querySelector('#par-es-cern').textContent = tr(`Esempio: anta da 70 → cerniere a ${f(K.cernieraSopra)} mm da sopra e ${f(K.cernieraSotto)} mm da sotto · anta da 72 (scende 20 mm in più) → ${f(K.cernieraSopra)} da sopra e ${f(K.cernieraSotto + 20)} da sotto`); }
    { const K = Q.cucina, sp = Q.regletta.spessoreAnta, g = 630 - 330 - K.angoloAria;
      el.querySelector('#par-es-angolo').textContent = tr(`Esempio: pensile angolo 63 × 63 con pensili da 33 → anta grande ${f(630 - 330)} − ${f(K.angoloAria)} = ${f(g)} mm, anta piccola ${f(g)} − ${f(sp)} − ${f(K.angoloGiunto)} = ${f(g - sp - K.angoloGiunto)} mm`); }
    { const R = Q.regletta; el.querySelector('#par-es-reg').textContent = tr(`Esempio: regletta ${f(R.vista / 10)} × ${f(R.vista / 10)} cm con ante da ${f(R.spessoreAnta)} → pezzi da ${f(R.vista)} e ${f(R.vista + R.spessoreAnta)} mm`); }
    const tL = f(600 - c.traseraMeno), tipi = [[c.piccoloTrasera, 'piccolo'], [c.medioTrasera, 'medio'], [c.grandeTrasera, 'grande']].filter(([h]) => h);
    Q.binari.forEach((b, i) => {
      const box = el.querySelector(`[data-bin-es="${i}"]`); if (!box) return;
      const w = Math.floor(1000 / 2 - b.larghezzaMeno - Q.tiradori[0].togli), h = Math.floor(2500 - b.altezzaMeno);
      box.textContent = tr(`Esempio: armadio 1000 × 2500 a 2 moduli (1 anta per modulo) → anta ${w} × ${h} mm`);
    });
    el.querySelectorAll('[data-fig]').forEach((d) => { d.innerHTML = svgParametro(d.dataset.fig, Q); });
    el.querySelectorAll('[data-fig-bin]').forEach((d) => { const b = Q.binari[Number(d.dataset.figBin)]; if (b) d.innerHTML = svgBinario(b, Q.tiradori[0]); });
    const esCass = c.tipo === 'nostro'
      ? (() => { const P2 = pezziCassettoNostro(c, 600 - 2 * c.fianchiMobile, 230, c.profondita, 3); return tr('Esempio (cucina, cassettiera da 60 con 3 frontali da 230):') + '\n' + P2.map((x) => { const n = tr(x.nome).split(' · ').pop(); return `${n.charAt(0).toUpperCase()}${n.slice(1)}: ${f(x.larghezza)} × ${f(x.altezza)} × ${f(x.spessore)} mm, ${x.quantita} ${tr('pz')}`; }).join('\n'); })()
      : tr(`Esempio: modulo da 60 → fondo ${f(600 - c.fondoMeno)} × ${f(c.fondoProfondita)} mm · trasera ${tipi.map(([h, n]) => `${tL} × ${f(h)} ${n}`).join(', ')}`);
    // negli armadi (cassetto a sistema): modulo esterno − valori segnati qui − quello che occupa la cassettiera
    const esArm = (dove) => {
      const fa = Q.cassettieraArmadio.battente.fascia;
      const fm2 = 2 * (c.fianchiMobile ?? 18), extra = dove === 'battente' ? 4 * 18 + 2 * fa - fm2 : 6 * 18 - fm2;
      const mF = c.fondoMeno + extra, mT = c.traseraMeno + extra;
      return (dove === 'battente' ? tr(`Armadio a battente: la cassettiera occupa in più fascette 2 × ${f(fa)} e fianchi 2 × 18 (struttura da 18).`) : tr('Armadio scorrevole: la cassettiera occupa in più fascette 2 × 18 e fianchi 2 × 18 (struttura da 18).')) + '\n'
        + tr(`Fondo = modulo − ${f(c.fondoMeno)} − ${f(extra)} = modulo − ${f(mF)} · trasera = modulo − ${f(c.traseraMeno)} − ${f(extra)} = modulo − ${f(mT)}`) + '\n'
        + [400, 500, 600, 800].map((L) => tr(`modulo ${L} → fondo ${f(L - mF)}, trasera ${f(L - mT)}`)).join(' · ');
    };
    el.querySelectorAll('[data-es-cassettiera]').forEach((d) => {
      const tipo = d.dataset.esCassettiera;
      const conf = { tipoArmadio: tipo, spessoreCarcassa: 18, spessoreSchiena: 10, spessoreAnte: 18, profonditaEsterna: 600, scorrevole: { binario: 75 } };
      const G = geometriaCassettiera(conf, { numCassetti: 3, altMax: 600, guida: 500, apertura: 'incassata' }, 500);
      const R = geometriaCassettiera(conf, { numCassetti: 3, altMax: 600, guida: 500, apertura: 'ribassati' }, 500);
      const Mn = geometriaCassettiera(conf, { numCassetti: 3, altMax: 600, guida: 500, apertura: 'maniglia', sporgenza: 30 }, 500);
      d.textContent = [
        tr('Esempio: modulo 500, struttura 18, profondo 600, cassettiera alta 600 con 3 cassetti'),
        tr(`Scatola: top e fondo ${f(G.larTF)} × ${f(G.profScatola)}, fianchi ${f(G.profScatola)} × ${f(G.AltMax - 4 * 18)}`),
        tr(`Fascette laterali ${f(G.fascia)} × ${f(G.AltMax - 18)} · fascette sotto ${f(G.larTF)} × ${f(G.fasciaSotto)}`),
        tr(`Frontali ${f(G.larFronte)} × ${f(G.altFrontale)} (maniglia incassata), ${f(R.larFronte)} × ${f(R.altFrontale)} ribassati`),
        tr(`Con una maniglia esterna che sporge 30 mm: scatola profonda ${f(Mn.profScatola)} invece di ${f(G.profScatola)}`),
        tipo === 'battente'
          ? tr(`Ripiano sopra ${f(G.larRipiano)} × ${f(G.profRipiano)} (a filo dei frontali), ${f(Mn.larRipiano)} × ${f(Mn.profRipiano)} con la maniglia esterna (fino alla maniglia)`)
          : tr(`Ripiano sopra ${f(G.larRipiano)} × ${f(G.profRipiano)}, come gli altri ripiani`),
      ].join('\n');
    });
    el.querySelectorAll('[data-es-cass]').forEach((d) => { d.textContent = c.tipo !== 'nostro' && (d.dataset.esCass === 'battente' || d.dataset.esCass === 'scorrevole') ? esArm(d.dataset.esCass) : esCass; });
  };
  esempi();
  agganciaFotoParametri(el);
  // alzatina sì / no
  el.querySelectorAll('[data-alzpar]').forEach((b) => b.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())); nuovo.cucina.alzatina = b.dataset.alzpar === 'si';
    salvaParametri(nuovo);
    el.querySelectorAll('[data-alzpar]').forEach((x) => x.classList.toggle('sel', x === b));
    const h = el.querySelector('#par-alz-h'); if (h) h.hidden = !nuovo.cucina.alzatina;
    esempi();
  }));
  // piedini della cucina: tre scelte
  el.querySelectorAll('[data-piedini]').forEach((b) => b.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())); nuovo.cucina.piedini = Number(b.dataset.piedini);
    salvaParametri(nuovo);
    el.querySelectorAll('[data-piedini]').forEach((x) => x.classList.toggle('sel', x === b));
    esempi();
  }));
  // COME MONTI GLI ARMADI: schede col disegno (le stesse della configurazione guidata)
  const disegnaMontaggio = () => {
    const box = el.querySelector('#par-montaggio'); if (!box) return;
    box.innerHTML = htmlMontaggio(valoriDaParametri(), { numeriAnte: false });
    agganciaMontaggio(box, valoriDaParametri, scriviParametri, disegnaMontaggio);
    disegnaMontaggioSc();
  };
  // ARMADI SCORREVOLI: struttura come i battenti? Se no, le stesse domande (struttura e schiena)
  const disegnaMontaggioSc = () => {
    const box = el.querySelector('#par-montaggio-sc'); if (!box) return;
    const v = valoriScorrevoli();
    box.innerHTML = htmlUguale(v) + (v.uguale === 'no' ? htmlMontaggio(v, { ante: false }) : '');
    agganciaMontaggio(box, valoriScorrevoli, (p) => { scriviScorrevoli(p); segnaImpostato('scorrevoli'); mostraMancanti(); }, disegnaMontaggioSc);
  };
  disegnaMontaggio();
  let timer = null;
  const msg = el.querySelector('#par-msg');
  // IMPOSTAZIONI SALTATE nella configurazione guidata: restano a 0 finché non le scrivi qui
  const mostraMancanti = () => {
    const box = el.querySelector('#par-mancanti'); if (!box) return;
    const manca = daImpostare();
    box.innerHTML = manca.length ? `<div class="par-mancanti" role="alert" style="margin:10px 0 14px;padding:12px 14px;border-radius:10px;border:1px solid #c0392b;background:rgba(192,57,43,.12);color:#f3d9d4;line-height:1.5">
      ⚠ <b style="color:#ff9b8c">${esc(tr('Da impostare (saltati nella configurazione guidata):'))}</b>
      <ul style="margin:6px 0 6px 18px;padding:0">${manca.map((g) => `<li>${esc(tr(GRUPPI_DA_IMPOSTARE[g]))}</li>`).join('')}</ul>
      ${esc(tr('Finché mancano sono a 0 e la distinta non è completa. Scrivi i valori qui sotto: l\'avviso sparisce da solo.'))}</div>` : '';
  };
  mostraMancanti();
  const impostato = (g) => { if (daImpostare().includes(g)) { segnaImpostato(g); mostraMancanti(); } };
  el.querySelectorAll('[data-par]').forEach((inp) => inp.addEventListener('input', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    const parti = inp.dataset.par.split('.'), a = parti[0], ult = parti[parti.length - 1];
    let o = nuovo; for (let i = 0; i < parti.length - 1; i++) { if (o == null) return; o = o[parti[i]]; }
    if (o == null) return;
    o[ult] = inp.type === 'number' ? (inp.value === '' ? '' : Number(String(inp.value).replace(',', '.'))) : inp.value;
    salvaParametri(nuovo);
    if (parti.length === 2 && (a === 'gola' || a === 'regletta' || a === 'cassetti') && Number(o[ult]) > 0) impostato(a);
    if (inp.type !== 'number' && ['nome', 'marca'].includes(ult) && ['gola', 'goleAltre', 'cassetti', 'cassettiAltri'].includes(a)) {
      // il nome nella barra delle voci segue quello che si scrive
      const tipo = a === 'gola' || a === 'goleAltre' ? 'gola' : 'cass', idx = parti.length === 2 ? 0 : Number(parti[1]) + 1;
      el.querySelectorAll(`[data-sis="${tipo}"][data-i="${idx}"]`).forEach((bt) => { bt.firstChild.textContent = `✓ ${inp.value || '—'}`; });
    }
    esempi();
    msg.hidden = false; clearTimeout(timer); timer = setTimeout(() => { msg.hidden = true; }, 1400);
  }));
  // binari degli scorrevoli: nome e numeri di ognuno, aggiungi / togli
  el.querySelectorAll('[data-bin]').forEach((inp) => inp.addEventListener('input', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    const [i, k] = inp.dataset.bin.split('.');
    if (!nuovo.binari[i]) return;
    nuovo.binari[i][k] = inp.type === 'number' ? (inp.value === '' ? 0 : Number(String(inp.value).replace(',', '.'))) : inp.value;
    salvaParametri(nuovo); esempi();
    if (Number(i) === 0) impostato('binario');
    msg.hidden = false; clearTimeout(timer); timer = setTimeout(() => { msg.hidden = true; }, 1400);
  }));
  el.querySelector('#par-bin-agg').addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    nuovo.binari.push({ id: 'b' + Date.now().toString(36), nome: '', larghezzaMeno: 0, altezzaMeno: 0, maniglia: 0 });
    salvaParametri(nuovo); renderParametri(S);
    const ins = el.querySelectorAll('[data-bin$=".nome"]'); if (ins.length) ins[ins.length - 1].focus();
  });
  el.querySelectorAll('[data-bin-togli]').forEach((btn) => btn.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())), i = Number(btn.dataset.binTogli), b = nuovo.binari[i];
    if (!b || nuovo.binari.length < 2) return;
    if (!confirm(tr(`Togliere il binario «${b.nome || '—'}»?`))) return;
    nuovo.binari.splice(i, 1); salvaParametri(nuovo); renderParametri(S);
  }));
  // ANTE DEI PENSILI CHE SCENDONO: altezza dei pensili (vuoto = tutti) e di quanto scende; aggiungi / togli
  el.querySelectorAll('[data-asc]').forEach((inp) => inp.addEventListener('input', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())), [i, k] = inp.dataset.asc.split('.');
    const v = nuovo.cucina.anteScendono[i]; if (!v) return;
    v[k] = inp.value === '' ? 0 : Math.round(Number(String(inp.value).replace(',', '.')) || 0);
    const P2 = salvaParametri(nuovo), n = el.querySelector(`[data-asc-nome="${i}"]`);
    if (n && P2.cucina.anteScendono[i]) n.textContent = tr(nomeAntaScende(P2.cucina.anteScendono[i]));
    msg.hidden = false; clearTimeout(timer); timer = setTimeout(() => { msg.hidden = true; }, 1400);
  }));
  el.querySelector('#par-asc-agg')?.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    nuovo.cucina.anteScendono.push({ id: 'as' + Date.now().toString(36), altezza: 800, scende: 20 });
    salvaParametri(nuovo); renderParametri(S);
  });
  el.querySelectorAll('[data-asc-togli]').forEach((btn) => btn.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())), i = Number(btn.dataset.ascTogli), v = nuovo.cucina.anteScendono[i];
    if (!v || !confirm(tr(`Togliere «${nomeAntaScende(v)}»?`))) return;
    nuovo.cucina.anteScendono.splice(i, 1); salvaParametri(nuovo); renderParametri(S);
  }));
  // SCHEDE: Cucina / Armadio a battente / Armadio scorrevole / Mobili modulari
  el.querySelectorAll('[data-scheda-btn]').forEach((b) => b.addEventListener('click', () => {
    _schedaPar = b.dataset.schedaBtn;
    try { localStorage.setItem('ng-par-scheda', _schedaPar); } catch (_) { /* niente */ }
    renderParametri(S);                       // il gruppo dei cassetti è in più schede: sempre aggiornato
  }));
  // GOLA / CASSETTI: scegli la voce, aggiungi (copia di quella scelta), metti come predefinita, togli
  const LISTE = { gola: ['gola', 'goleAltre', 'g', 'nome'], cass: ['cassetti', 'cassettiAltri', 'c', 'marca'] };
  const selDi = (tipo) => (tipo === 'gola' ? _selGola : _selCass), setSel = (tipo, v) => { if (tipo === 'gola') _selGola = v; else _selCass = v; };
  el.querySelectorAll('[data-sis]').forEach((b) => b.addEventListener('click', () => { setSel(b.dataset.sis, Number(b.dataset.i)); renderParametri(S); }));
  el.querySelectorAll('[data-sis-agg]').forEach((b) => b.addEventListener('click', () => {
    const tipo = b.dataset.sisAgg, [prima, altre, pre, kNome] = LISTE[tipo], nuovo = JSON.parse(JSON.stringify(parametri()));
    const lista = [nuovo[prima], ...nuovo[altre]], base = lista[selDi(tipo)] || nuovo[prima];
    nuovo[altre].push({ ...JSON.parse(JSON.stringify(base)), id: pre + Date.now().toString(36), [kNome]: '' });
    salvaParametri(nuovo); setSel(tipo, nuovo[altre].length); renderParametri(S);
    const inp = el.querySelector(`[data-par="${altre}.${nuovo[altre].length - 1}.${kNome}"]`); if (inp) inp.focus();
  }));
  el.querySelectorAll('[data-sis-pref]').forEach((b) => b.addEventListener('click', () => {
    const tipo = b.dataset.sisPref, [prima, altre] = LISTE[tipo], i = selDi(tipo) - 1, nuovo = JSON.parse(JSON.stringify(parametri()));
    if (!nuovo[altre][i]) return;
    const tmp = nuovo[prima]; nuovo[prima] = nuovo[altre][i]; nuovo[altre][i] = tmp;     // la scelta diventa quella di partenza
    salvaParametri(nuovo); setSel(tipo, 0); renderParametri(S);
  }));
  el.querySelectorAll('[data-sis-togli]').forEach((b) => b.addEventListener('click', () => {
    const tipo = b.dataset.sisTogli, [, altre, , kNome] = LISTE[tipo], i = selDi(tipo) - 1, nuovo = JSON.parse(JSON.stringify(parametri()));
    const x = nuovo[altre][i]; if (!x) return;
    if (!confirm(tr(`Togliere «${x[kNome] || '—'}»?`))) return;
    nuovo[altre].splice(i, 1); salvaParametri(nuovo); setSel(tipo, 0); renderParametri(S);
  }));
  // CASSETTI: tipo (comprati / fatti da noi), montaggio, modo dell'altezza dei fianchi
  const pathCass = () => (_selCass === 0 ? ['cassetti'] : ['cassettiAltri', _selCass - 1]);
  const scriviCass = (k, v) => {
    const nuovo = JSON.parse(JSON.stringify(parametri())), pp = pathCass();
    const o = pp.length === 1 ? nuovo[pp[0]] : nuovo[pp[0]][pp[1]]; if (!o) return;
    o[k] = v; salvaParametri(nuovo); renderParametri(S);
  };
  el.querySelectorAll('[data-cass-tipo]').forEach((b) => b.addEventListener('click', () => scriviCass('tipo', b.dataset.cassTipo)));
  el.querySelectorAll('[data-fp-tipo]').forEach((b) => b.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    nuovo.fingerPull.tipo = b.dataset.fpTipo === 'profilo' ? 'profilo' : 'fresato';
    salvaParametri(nuovo); renderParametri(S);
  }));
  el.querySelectorAll('[data-cass-mont]').forEach((b) => b.addEventListener('click', () => scriviCass('montaggio', b.dataset.cassMont)));
  el.querySelectorAll('[data-cass-alt]').forEach((b) => b.addEventListener('click', () => scriviCass('altezzaModo', b.dataset.cassAlt)));
  // TIRADORES: nome, misure e forma di ognuno, aggiungi / togli
  el.querySelectorAll('[data-tir]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    const [i, k] = inp.dataset.tir.split('.');
    if (!nuovo.tiradori[i]) return;
    nuovo.tiradori[i][k] = inp.type === 'number' ? (inp.value === '' ? 0 : Number(String(inp.value).replace(',', '.'))) : inp.value;
    salvaParametri(nuovo); esempi();
    if (Number(i) === 0 && k === 'togli') impostato('binario');
    msg.hidden = false; clearTimeout(timer); timer = setTimeout(() => { msg.hidden = true; }, 1400);
  }));
  el.querySelector('#par-tir-agg').addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri()));
    nuovo.tiradori.push({ ...nuovo.tiradori[0], id: 't' + Date.now().toString(36), nome: '' });
    salvaParametri(nuovo); renderParametri(S);
    const ins = el.querySelectorAll('[data-tir$=".nome"]'); if (ins.length) ins[ins.length - 1].focus();
  });
  el.querySelectorAll('[data-tir-togli]').forEach((btn) => btn.addEventListener('click', () => {
    const nuovo = JSON.parse(JSON.stringify(parametri())), i = Number(btn.dataset.tirTogli), x = nuovo.tiradori[i];
    if (!x || nuovo.tiradori.length < 2) return;
    if (!confirm(tr(`Togliere il tirador «${x.nome || '—'}»?`))) return;
    nuovo.tiradori.splice(i, 1); salvaParametri(nuovo); renderParametri(S);
  }));
  el.querySelector('#par-ripristina').addEventListener('click', () => {
    if (!confirm(tr('Rimettere tutti i parametri ai valori di partenza?'))) return;
    ripristinaParametri(); renderParametri(S);
  });
}

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').slice(1);
  if (h !== sezione && TUTTE.some((x) => x.id === h)) { sezione = h; render(); }
});
render();

// SCHEDA OGGETTO RIMASTA A METÀ (il telefono ha ricaricato la pagina): la riapro con le foto
leggiBozza().then((b) => {
  if (!b || !modale.hidden) return;
  if (!chiusaDuranteIA && Date.now() - (b.quando || 0) > 30 * 60e3) return;   // vecchia: si riprende quando riapri la scheda
  const p = b.id ? stato.prodotti.find((x) => x.id === b.id) : null;
  if (b.id && !p) return;
  if (sezione !== 'oggetti') vaiSezione('oggetti');
  apriSchedaOggetto(p, b);
});

// PORTARE TUTTO SU UN ALTRO DISPOSITIVO (copia completa in un file)
{
  const msg = (t) => { const m = document.getElementById('imp-copia-msg'); if (m) { m.textContent = t; m.hidden = !t; } };
  document.getElementById('imp-copia-scarica')?.addEventListener('click', async () => {
    msg(tr('Preparo la copia…'));
    try {
      const r = await scaricaCopiaCompleta();
      msg(`✓ ${tr('Copia scaricata')}: ${r.progetti} ${tr('progetti')}, ${r.prodotti} ${tr('prodotti')}, ${r.preventivi} ${tr('preventivi')} (${r.mb < 0.1 ? '< 0,1' : String(r.mb).replace('.', ',')} MB). ${tr('Ora mandala all\'altro dispositivo e caricala lì.')}`);
    } catch (e) { msg(`${tr('Non sono riuscito a preparare la copia')}: ${e.message || e}`); }
  });
  document.getElementById('imp-copia-file')?.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (!confirm(tr('I progetti aperti su questo dispositivo diventano quelli della copia; prodotti e preventivi si uniscono. Continuo?'))) { e.target.value = ''; return; }
    msg(tr('Carico la copia…'));
    try {
      const r = await caricaCopiaCompleta(f);
      msg(`✓ ${tr('Copia caricata')}: ${r.progetti} ${tr('progetti')}, ${r.prodotti} ${tr('prodotti')}, ${r.preventivi} ${tr('preventivi')}. ${tr('Ricarico la pagina…')}`);
      setTimeout(() => location.reload(), 1800);
    } catch (err) { msg(`${tr('Non sono riuscito a caricare la copia')}: ${tr(err.message || String(err))}`); }
    e.target.value = '';
  });
}

// ---------------------------------------------------------------------------
// SCHEDA OGGETTO / ELETTRODOMESTICO: foto davanti (+ lato, sopra, dietro),
// ognuna isolata dallo sfondo in automatico; misure reali; anteprima 3D.
// ---------------------------------------------------------------------------
const VISTE_OGG = [
  { id: 'fronte', nome: 'Davanti', aiuto: 'dove ci sono comandi, display, maniglia', obbl: true,
    svg: '<svg viewBox="0 0 40 30"><rect x="12" y="6" width="16" height="18" rx="2"/><rect x="16" y="9" width="8" height="3" fill="currentColor"/><circle cx="20" cy="28" r="1.6" fill="currentColor"/><path d="M20 26.5v-1.5"/></svg>' },
  { id: 'lato', nome: 'Di lato', aiuto: 'di fianco; l\'altro lato è uguale, specchiato',
    svg: '<svg viewBox="0 0 40 30"><rect x="10" y="6" width="20" height="18" rx="2"/><rect x="5" y="14" width="5" height="6"/><circle cx="37" cy="15" r="1.6" fill="currentColor"/></svg>' },
  { id: 'sopra', nome: 'Da sopra', aiuto: 'guardando giù, dritto dall\'alto (facoltativa)',
    svg: '<svg viewBox="0 0 40 30"><rect x="11" y="10" width="18" height="16" rx="3"/><rect x="17" y="26" width="6" height="3"/><circle cx="20" cy="3" r="1.6" fill="currentColor"/><path d="M20 5v3"/></svg>' },
  { id: 'dietro', nome: 'Dietro', aiuto: 'il retro (facoltativa)',
    svg: '<svg viewBox="0 0 40 30"><rect x="12" y="6" width="16" height="18" rx="2"/><path d="M15 10h10M15 13h10M15 16h10"/><circle cx="20" cy="2.5" r="1.6" fill="currentColor"/></svg>' },
];
const NOMI_VISTA = Object.fromEntries(VISTE_OGG.map((v) => [v.id, v.nome]));
let _chiudiAntOgg = null, _tAntOgg = 0;
function aCanvas(im) {
  if (im instanceof HTMLCanvasElement) return im;
  const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
  c.getContext('2d').drawImage(im, 0, 0); return c;
}
function apriSchedaOggetto(p, bozza) {
  const nuovo = !p;
  const o = (p && p.oggetto) || { w: '', d: '', h: '', pianta: 'auto' };
  const info = (p && p.info) || {};
  const corpo = document.getElementById('imp-modale-corpo');
  corpo.innerHTML = `
    <div class="imp-form">
      <div class="imp-aiuto">Carica le foto dell'oggetto: vanno bene sia quelle del produttore (su bianco) sia quelle ambientate (in una stanza, con altri oggetti attorno): lo sfondo lo toglie il sito, da solo. Il sito <strong>riconosce da solo quale foto è davanti, di lato, dietro o da sopra</strong>, isola l'oggetto e costruisce il <strong>3D con le misure vere e le tue foto sopra</strong>. Se sbaglia una vista, correggila con «Questa foto è».</div>
      <div class="imp-aiuto">Vanno bene foto <strong>dritte</strong> (davanti, di lato) e foto <strong>di tre quarti</strong> (si vedono il davanti e un fianco insieme): dalla foto di tre quarti il sito <strong>raddrizza il fianco</strong> e lo usa per tutti e due i lati (l'altro lato è uguale, specchiato). La foto nella casella «Davanti» è il davanti. Sotto ogni foto il sito scrive cosa ne prende; se sbaglia, tocca la scritta per cambiarla.</div>
      <label class="imp-tutte">📷 Carica tutte le foto insieme<input type="file" accept="image/*" multiple id="o-tutte"></label>
      <div class="imp-viste3">
        ${VISTE_OGG.map((v) => `
        <div class="imp-vista3">
          <div class="imp-vista-tit"><span class="imp-vista-ico" aria-hidden="true">${v.svg}</span><span><strong>${v.nome}</strong>${v.obbl ? ' <span class="imp-obbl">*</span>' : ''}<br><small>${v.aiuto}</small></span></div>
          <label class="imp-vista-file">Scegli foto<input type="file" accept="image/*" data-vista="${v.id}"></label>
          <div class="imp-vista3-img" data-img="${v.id}"></div>
          <button type="button" class="imp-tipo-foto" data-tipo="${v.id}" hidden></button>
          <div class="imp-vista-azioni" data-azioni="${v.id}" hidden>
            <label class="imp-vista-ruolo">Questa foto è:
              <select data-ruolo="${v.id}">${VISTE_OGG.map((q) => `<option value="${q.id}"${q.id === v.id ? ' selected' : ''}>${q.nome}</option>`).join('')}</select></label>
            <button type="button" class="btn-ghost btn-mini" data-ruota="${v.id}">↻ Ruota</button>
            <button type="button" class="btn-ghost btn-mini imp-togli" data-togli="${v.id}">✕ Togli questa foto</button>
          </div>
        </div>`).join('')}
      </div>
      <div class="imp-auto-msg" id="o-msg" hidden></div>
      <fieldset class="imp-misura">
        <legend>Misure reali (cm) <span class="imp-obbl">*</span></legend>
        <div class="imp-misure3">
          <label>Larghezza<input type="text" inputmode="decimal" autocomplete="off" id="o-w" value="${esc(o.w)}" placeholder="es. 28"></label>
          <label>Profondità<input type="text" inputmode="decimal" autocomplete="off" id="o-d" value="${esc(o.d)}" placeholder="es. 36"></label>
          <label>Altezza<input type="text" inputmode="decimal" autocomplete="off" id="o-h" value="${esc(o.h)}" placeholder="es. 31"></label>
        </div>
        <div class="imp-aiuto">Le trovi nella scheda del prodotto (la profondità con la maniglia). Se non le sai tutte, scrivi quella che sai (es. l'altezza): le altre le ricavo dalle foto. Il 3D esce in scala vera.</div>
        <div id="o-misure-msg" class="imp-auto-msg" hidden></div>
      </fieldset>
      <fieldset class="imp-misura" id="o-pianta-box">
        <legend>Forma vista da sopra</legend>
        <div class="opzioni-anta imp-pianta">
          ${[['auto', 'Automatica'], ['squadrata', 'Squadrata'], ['tonda', 'Tonda'], ['ovale', 'Ovale']].map(([id, n]) => `<button type="button" class="btn-ghost btn-mini ${(o.pianta || 'auto') === id ? 'attivo' : ''}" data-pianta="${id}">${n}</button>`).join('')}
        </div>
        <div class="imp-aiuto"><strong>Automatica</strong>: il sito la ricava dalle foto (spigoli arrotondati come si vedono), con le misure esatte. Le altre servono solo per casi particolari, senza la foto da sopra (es. friggitrice tonda).</div>
      </fieldset>
      <div class="imp-sup-titolo">Anteprima 3D</div>
      <div id="o-vista" class="imp-man3d-vista"><div class="imp-aiuto">Carica la foto davanti e scrivi le misure.</div></div>
      <label>Nome <span class="imp-obbl">*</span><input type="text" id="f-nome" value="${esc(p ? p.nome : '')}" placeholder="Es. Friggitrice ad aria nera"></label>
      <label>Note<input type="text" id="f-note" value="${esc(info.note || '')}" placeholder="Marca, modello, codice…"></label>
      <div class="imp-errore" id="f-err" hidden></div>
      <div class="imp-piede">
        <button type="button" class="btn-ghost" id="f-annulla">Annulla</button>
        <button type="button" class="btn-oro" id="f-salva">Salva</button>
      </div>
    </div>`;
  modale.hidden = false;
  const imgs = {}, colori = {}, cambiate = new Set();
  let pianta = o.pianta || 'auto';
  // BOZZA: tutto quello che hai fatto nella scheda resta salvato sul telefono finché non premi
  // Salva o Annulla. Se il telefono ricarica la pagina (iPhone lo fa quando la memoria
  // finisce) la scheda si riapre con le foto, anche quelle scelte e non ancora scontornate.
  const idBozza = p ? p.id : null;
  const pngDi = new WeakMap();
  let inAttesa = [], schedaChiusa = false, _tBozza = 0;
  const salvaOra = async () => {
    if (schedaChiusa || !corpo.querySelector('#o-w')) return;
    const foto = {};
    try {
      for (const v of Object.keys(imgs)) {
        if (!imgs[v]) continue;
        if (!pngDi.has(imgs[v])) pngDi.set(imgs[v], await canvasPng(aCanvas(imgs[v])));
        foto[v] = pngDi.get(imgs[v]);
      }
    } catch (_) { /* foto non salvabile: pazienza, resta il resto */ }
    if (schedaChiusa || !corpo.querySelector('#o-w')) return;
    const val = (id) => corpo.querySelector(id).value;
    await salvaBozza({ id: idBozza, w: val('#o-w'), d: val('#o-d'), h: val('#o-h'), nome: val('#f-nome'), note: val('#f-note'),
      pianta, tipi: { ...tipi }, colori: { ...colori }, cambiate: [...cambiate], foto,
      inAttesa: inAttesa.map((x) => ({ vista: x.vista, foto: x.foto })) });
  };
  const bozzaPiu = () => { clearTimeout(_tBozza); _tBozza = setTimeout(salvaOra, 400); };
  // foto DRITTA o DI TRE QUARTI: la scelta fatta a mano per casella (se no decide il sito)
  const tipi = { ...((o && o.tipi) || {}) };
  let tipiAuto = {}, usoAuto = {};
  const errore = (t) => { const e = corpo.querySelector('#f-err'); e.textContent = t; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); };
  const avviso = (t) => { const m = corpo.querySelector('#o-msg'); m.textContent = t; m.hidden = !t; };
  const num = (id) => Number(String(corpo.querySelector(id).value).replace(',', '.'));
  const mostra = (v) => {
    const box = corpo.querySelector(`[data-img="${v}"]`); box.innerHTML = '';
    if (imgs[v]) { const c = document.createElement('canvas'); disegnaScacchi(c, imgs[v], 300, 220); box.appendChild(c); }
    corpo.querySelector(`[data-azioni="${v}"]`).hidden = !imgs[v];
    corpo.querySelector(`[data-ruolo="${v}"]`).value = v;
    // DRITTA / DI TRE QUARTI (tocca per cambiare)
    const bt = corpo.querySelector(`[data-tipo="${v}"]`), t = tipi[v] || tipiAuto[v];
    bt.hidden = !imgs[v] || !t;
    if (t) {
      bt.classList.toggle('dritta', t === 'dritta'); bt.classList.toggle('storta', t !== 'dritta');
      // di tre quarti: cosa ne prendo (il fianco va su tutti e due i lati, specchiato)
      const u = tipi[v] ? null : usoAuto[v];
      const da34 = u === 'fianco' ? tr("ne prendo il fianco (e lo specchio dall'altra parte)") : u === 'davanti' ? tr('ne prendo il davanti')
        : u === 'davanti+fianco' ? tr('ne prendo il davanti e il fianco') : tr('non la uso per la forma');
      bt.innerHTML = (t === 'dritta' ? `✓ ${tr('Dritta')} · ${tr('la uso per la forma')}` : `↗ ${tr('Di tre quarti')} · ${da34}`)
        + `<small>${tipi[v] ? tr('scelta tua · tocca per cambiare') : tr('automatico · tocca per cambiare')}</small>`;
    }
    corpo.querySelector('#o-pianta-box').hidden = !!imgs.sopra;
  };
  const mostraTutte = () => { VISTE_OGG.forEach((x) => mostra(x.id)); bozzaPiu(); };
  const anteprima = () => {
    clearTimeout(_tAntOgg);
    _tAntOgg = setTimeout(async () => {
      const box = corpo.querySelector('#o-vista'); if (!box) return;
      // MISURE CHE NON SAI: scrivi quella che sai, le altre le ricavo dalle PROPORZIONI delle foto
      // (anche dal fianco raddrizzato di una foto di tre quarti). Le ricavate sono in oro.
      let notaMisure = '';
      {
        const campi = { w: corpo.querySelector('#o-w'), d: corpo.querySelector('#o-d'), h: corpo.querySelector('#o-h') };
        const val = (k) => (campi[k].dataset.auto ? NaN : num(`#o-${k}`) * 10);
        let w = val('w'), d = val('d'), h = val('h');
        const scritte = [w, d, h].filter((x) => x > 0).length;
        if (imgs.fronte && scritte >= 1 && scritte < 3) {
          const av0 = assegnaViste({ ...imgs, tipi }, w > 0 ? w : 1000, d > 0 ? d : 1000, h > 0 ? h : 1000);
          const pr = av0 && av0.misure;                              // wh = larghezza/altezza, dh = profondità/altezza
          const ricavate = [];
          if (pr && pr.wh > 0) {
            if (!(h > 0)) { h = w > 0 ? w / pr.wh : (d > 0 && pr.dh > 0 ? d / pr.dh : NaN); if (h > 0) ricavate.push('h'); }
            if (!(w > 0) && h > 0) { w = h * pr.wh; ricavate.push('w'); }
            if (!(d > 0) && h > 0 && pr.dh > 0) { d = h * pr.dh; ricavate.push('d'); }
          }
          const mm = { w, d, h };
          for (const k of ['w', 'd', 'h']) {
            if (ricavate.includes(k)) { campi[k].value = String(Math.round(mm[k] / 5) / 2); campi[k].dataset.auto = '1'; campi[k].classList.add('misura-auto'); }
            else if (campi[k].dataset.auto) { campi[k].value = ''; delete campi[k].dataset.auto; campi[k].classList.remove('misura-auto'); }
          }
          if (ricavate.length) notaMisure = `📐 ${tr('Le misure in oro le ho ricavate dalle foto, partendo da quella che hai scritto. Se le conosci, scrivile tu.')}`;
          if (!(d > 0)) notaMisure = `📐 ${tr('La profondità non si vede dalle foto: scrivila tu, oppure aggiungi una foto di lato o di tre quarti.')}`;
        }
      }
      const W = num('#o-w') * 10, D = num('#o-d') * 10, H = num('#o-h') * 10;
      if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; }
      if (!imgs.fronte || !(W > 0 && D > 0 && H > 0)) {
        const mmsg = corpo.querySelector('#o-misure-msg');
        if (mmsg) { mmsg.textContent = notaMisure; mmsg.hidden = !notaMisure; }
        box.innerHTML = `<div class="imp-aiuto">${tr(imgs.fronte ? "Scrivi almeno una misura (es. l'altezza): le altre le ricavo dalle foto." : 'Carica la foto davanti e scrivi le misure.')}</div>`;
        return;
      }
      box.innerHTML = `<div class="imp-aiuto">${tr('Costruisco il 3D…')}</div>`;
      await new Promise((r) => setTimeout(r, 30));
      // FOTO DA SOPRA di traverso (si capisce dalle misure): la giro, con il davanti in basso, e lo dico
      if (imgs.sopra) {
        const r = orientaSopra(imgs.sopra, W, D);
        if (r) { imgs.sopra = r; cambiate.add('sopra'); mostraTutte(); avviso(tr('Ho girato la foto da sopra: il davanti va in basso. Se è al contrario premi «↻ Ruota» due volte.')); }
      }
      // QUALI FOTO SONO DRITTE (davanti, lato) E QUALI DI TRE QUARTI; davanti e lato al contrario: li scambio
      let av = assegnaViste({ ...imgs, tipi }, W, D, H);
      if (av && av.scambiate && imgs.lato && !tipi.fronte && !tipi.lato) {
        scambia('lato', 'fronte');
        avviso(tr('Ho scambiato davanti e lato: dalle misure, il davanti è la foto larga come la larghezza e il lato quella larga come la profondità.'));
        av = assegnaViste({ ...imgs, tipi }, W, D, H);
      }
      tipiAuto = (av && av.tipi) || {}; usoAuto = (av && av.uso) || {};
      mostraTutte();
      // LE MISURE TORNANO CON LE FOTO? (anche con le facce raddrizzate delle foto di tre quarti)
      // se una non torna, dico quanto dovrebbe essere
      const mm = corpo.querySelector('#o-misure-msg');
      const c = imgs.fronte ? controllaMisure({ ...imgs, tipi }, W, D, H) : null;
      if (c && mm) {
        const nomi = { w: 'la larghezza', d: 'la profondità', h: "l'altezza" }, ids = { w: '#o-w', d: '#o-d', h: '#o-h' };
        const cm = (v) => (Math.round(v / 5) / 2).toLocaleString('it-IT');
        const scritto = { w: W, d: D, h: H }[c.campo];
        mm.innerHTML = `📏 ${tr('Dalle foto')} ${tr(nomi[c.campo])} ${tr('dovrebbe essere circa')} <strong>${cm(c.mm)} cm</strong> (${tr('hai scritto')} ${cm(scritto)}): ${tr(c.scarto > 1 ? "con la tua misura l'oggetto viene schiacciato." : "con la tua misura l'oggetto viene allungato.")} ${tr('Controlla la scheda del prodotto.')}
          <button type="button" class="btn-oro btn-mini" id="o-usa-misura" style="margin-top:6px">${tr('Usa')} ${cm(c.mm)} cm</button>`;
        mm.hidden = false;
        mm.querySelector('#o-usa-misura').addEventListener('click', () => { corpo.querySelector(ids[c.campo]).value = cm(c.mm).replace(',', '.'); anteprima(); });
      } else if (mm) { mm.textContent = notaMisure; mm.hidden = !notaMisure; }
      _chiudiAntOgg = await anteprimaOggetto(box, { ...imgs, tipi }, W, D, H, pianta);
    }, 250);
  };
  /** Sposta/scambia la foto della casella da → a. */
  const scambia = (da, a) => {
    if (da === a) return;
    [imgs[da], imgs[a]] = [imgs[a], imgs[da]]; [colori[da], colori[a]] = [colori[a], colori[da]];
    [tipi[da], tipi[a]] = [tipi[a], tipi[da]]; [tipiAuto[da], tipiAuto[a]] = [tipiAuto[a], tipiAuto[da]];
    for (const k of [da, a]) { if (!imgs[k]) delete imgs[k]; if (!tipi[k]) delete tipi[k]; cambiate.add(k); }
  };
  /** Riconosce le viste e rimette ogni foto nella casella giusta (lo dice). */
  // RICONOSCIMENTO (solo con "Carica tutte le foto insieme"): sposta SOLO le foto
  // appena aggiunte (nuove) e solo in caselle libere o tenute da altre foto nuove;
  // le foto che c'erano già restano dove sono. Nessuna foto si perde.
  const riconosci = (nuove = new Set()) => {
    const r = riconosciViste(imgs);
    if (!r || !nuove.size) { avviso(''); return; }
    const fisse = VISTE_OGG.map((x) => x.id).filter((k) => imgs[k] && !nuove.has(k));
    const mosse = [];
    const vecchie = { ...imgs }, vecchiCol = { ...colori };
    const nuovoImgs = {}, nuovoCol = {};
    for (const k of fisse) { nuovoImgs[k] = vecchie[k]; nuovoCol[k] = vecchiCol[k]; }
    for (const [dest, orig] of Object.entries(r.mappa)) {
      if (!nuove.has(orig) || nuovoImgs[dest]) continue;        // si muovono solo le nuove, in caselle libere
      nuovoImgs[dest] = vecchie[orig]; nuovoCol[dest] = vecchiCol[orig];
      if (dest !== orig) mosse.push([dest, orig]);
    }
    for (const k of nuove) {                                     // nuove non sistemate: dove sono o nella prima libera
      if (Object.values(nuovoImgs).includes(vecchie[k])) continue;
      const libera = !nuovoImgs[k] ? k : VISTE_OGG.map((x) => x.id).find((q) => !nuovoImgs[q]);
      if (libera) { nuovoImgs[libera] = vecchie[k]; nuovoCol[libera] = vecchiCol[k]; }
    }
    for (const k of VISTE_OGG.map((x) => x.id)) { delete imgs[k]; delete colori[k]; if (nuovoImgs[k]) { imgs[k] = nuovoImgs[k]; colori[k] = nuovoCol[k]; } }
    for (const k of VISTE_OGG.map((x) => x.id)) if (vecchie[k] !== imgs[k]) cambiate.add(k);
    if (!mosse.length) { avviso(''); return; }
    const frasi = mosse.map(([dest, orig]) => `${tr('la foto messa in')} «${tr(NOMI_VISTA[orig])}» ${tr('è')} «${tr(NOMI_VISTA[dest])}»`);
    avviso(`✓ ${tr('Ho riconosciuto le viste')}: ${frasi.join('; ')}. ${tr('Se è sbagliato, correggi con «Questa foto è».')}`);
  };

  const carica = async (f, v, senzaIA = false) => {
    const im = await caricaImmagine(f).catch(() => null);
    if (!im) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return false; }
    // SCONTORNO AUTOMATICO CON L'IA (come i siti professionali: anche foto ambientate, con
    // stanza, mensole e altri oggetti attorno). Se il dispositivo non ce la fa: quello di prima.
    let seg = null;
    if (!senzaIA && scontornoIaPossibile()) {
      const testo = (a) => (a.fase === 'scarico'
        ? `${tr('Preparo lo scontorno automatico (solo la prima volta)')}: ${Math.round(a.frazione * 100)}%`
        : a.fase === 'preparo' ? tr('Preparo lo scontorno automatico…') : tr('Tolgo lo sfondo dalla foto…'));
      try { seg = await scontornaIA(im, { avanza: (a) => avviso(testo(a)) }); } catch (e) { console.warn('scontorno IA non riuscito', e); seg = null; }
      avviso('');
    }
    if (!seg) seg = segmentaManiglia(im, null, 1, { raddrizza: false, oggetto: true });
    if (!seg) { errore(tr('Non riesco a isolare l\'oggetto in questa foto: usa una foto con lo sfondo uniforme (es. bianco).')); return false; }
    imgs[v] = seg.canvas; colori[v] = seg.colore; cambiate.add(v); delete tipi[v]; delete tipiAuto[v];
    return true;
  };
  for (const v of VISTE_OGG.map((x) => x.id)) {
    corpo.querySelector(`[data-vista="${v}"]`).addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      corpo.querySelector('#f-err').hidden = true;
      // la foto resta nella casella dove l'hai messa (prima il riconoscimento poteva spostarla e far sparire un'altra foto)
      // prima la metto al sicuro nella bozza (se il telefono chiude la pagina, non si perde)
      const x = { vista: v, foto: f.slice(0, f.size, f.type) };
      inAttesa.push(x); await salvaOra();
      const ok = await carica(f, v);
      inAttesa = inAttesa.filter((y) => y !== x);
      if (ok) { mostraTutte(); anteprima(); } else bozzaPiu();
      e.target.value = '';
    });
    corpo.querySelector(`[data-togli="${v}"]`).addEventListener('click', () => {
      delete imgs[v]; delete colori[v]; delete tipi[v]; delete tipiAuto[v]; cambiate.add(v); avviso('');
      mostraTutte(); anteprima();
    });
    // RUOTA di 90° (es. foto da sopra con l'oggetto di traverso)
    corpo.querySelector(`[data-ruota="${v}"]`).addEventListener('click', () => {
      if (!imgs[v]) return;
      imgs[v] = ruotaCanvas(imgs[v], 1); cambiate.add(v); avviso('');
      mostraTutte(); anteprima();
    });
    // DRITTA ↔ DI TRE QUARTI: la scelta a mano vince su quella automatica
    corpo.querySelector(`[data-tipo="${v}"]`).addEventListener('click', () => {
      const ora = tipi[v] || tipiAuto[v];
      tipi[v] = ora === 'dritta' ? '45' : 'dritta';
      mostraTutte(); anteprima();
    });
    corpo.querySelector(`[data-ruolo="${v}"]`).addEventListener('change', (e) => {
      scambia(v, e.target.value); avviso(''); mostraTutte(); anteprima();
    });
  }
  // tutte insieme: le metto nelle caselle libere e poi le riconosco
  corpo.querySelector('#o-tutte').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])].slice(0, 4); if (!files.length) return;
    corpo.querySelector('#f-err').hidden = true;
    const libere = VISTE_OGG.map((x) => x.id).filter((k) => !imgs[k]);
    const lista = [];
    for (const f of files) { const v = libere.shift(); if (!v) break; lista.push({ vista: v, foto: f.slice(0, f.size, f.type) }); }
    inAttesa.push(...lista); await salvaOra();               // tutte al sicuro nella bozza, prima di lavorarle
    const nuove = new Set();
    for (const x of lista) { if (await carica(x.foto, x.vista)) nuove.add(x.vista); inAttesa = inAttesa.filter((y) => y !== x); }
    riconosci(nuove); mostraTutte(); anteprima();
    e.target.value = '';
  });
  corpo.querySelectorAll('[data-pianta]').forEach((b) => b.addEventListener('click', () => {
    pianta = b.dataset.pianta;
    corpo.querySelectorAll('[data-pianta]').forEach((x) => x.classList.toggle('attivo', x === b));
    anteprima();
  }));
  corpo.querySelectorAll('#o-w, #o-d, #o-h').forEach((x) => x.addEventListener('change', anteprima));
  corpo.querySelectorAll('#o-w, #o-d, #o-h, #f-nome, #f-note').forEach((x) => x.addEventListener('input', bozzaPiu));
  corpo.querySelectorAll('#o-w, #o-d, #o-h').forEach((x) => x.addEventListener('input', () => { delete x.dataset.auto; x.classList.remove('misura-auto'); }));
  /** Riprende la bozza: misure, nome, foto già isolate e quelle rimaste a metà. */
  const riprendi = async (b) => {
    for (const [id, v] of [['#o-w', b.w], ['#o-d', b.d], ['#o-h', b.h], ['#f-nome', b.nome], ['#f-note', b.note]]) {
      if (v != null && v !== '') corpo.querySelector(id).value = v;
    }
    if (b.pianta) { pianta = b.pianta; corpo.querySelectorAll('[data-pianta]').forEach((x) => x.classList.toggle('attivo', x.dataset.pianta === pianta)); }
    Object.assign(tipi, b.tipi || {});
    for (const v of b.cambiate || []) cambiate.add(v);
    inAttesa = [...(b.inAttesa || [])];
    for (const [v, bl] of Object.entries(b.foto || {})) {
      const im = await caricaImmagine(bl).catch(() => null);
      if (!im) continue;
      imgs[v] = im; pngDi.set(im, bl); cambiate.add(v);
      if (b.colori && b.colori[v] !== undefined) colori[v] = b.colori[v];
    }
    mostraTutte(); anteprima();
    if (!inAttesa.length) { avviso(`✓ ${tr('Ho ripreso le foto che avevi già caricato. Per ricominciare da capo premi «Annulla».')}`); return; }
    // foto scelte ma non ancora scontornate: le finisco, con l'IA. Se il telefono chiude la
    // pagina due volte di fila, l'IA si spegne da sola e qui si usa lo scontorno semplice.
    const lista = [...inAttesa], nuove = new Set();
    for (const x of lista) {
      if (await carica(x.foto, x.vista)) nuove.add(x.vista);
      inAttesa = inAttesa.filter((y) => y !== x);
    }
    if (nuove.size > 1) riconosci(nuove);
    mostraTutte(); anteprima();
    avviso(`✓ ${tr(!chiusaDuranteIA ? 'Ho ripreso le foto che avevi già caricato. Per ricominciare da capo premi «Annulla».'
      : scontornoIaPossibile() ? 'Il telefono aveva ricaricato la pagina mentre toglievo lo sfondo: ho ripreso le tue foto e le ho finite.'
        : 'Il telefono ha chiuso la pagina due volte mentre toglievo lo sfondo: ho ripreso le tue foto e le ho finite con lo scontorno semplice (su questo telefono uso quello).')}`);
  };
  const ripresa = (bozza !== undefined ? Promise.resolve(bozza) : leggiBozza())
    .then((b) => (b && (b.id || null) === idBozza ? riprendi(b) : null))
    .catch((e) => console.warn('bozza non ripresa', e));
  // MODIFICA: le foto isolate già salvate (quelle cambiate nella bozza restano quelle della bozza)
  if (p) {
    ripresa.then(() => Promise.all(VISTE_OGG.map((v) => leggiFoto(p.id, v.id)))).then(async (bl) => {
      for (let i = 0; i < bl.length; i++) {
        const v = VISTE_OGG[i].id;
        if (bl[i] && !imgs[v] && !cambiate.has(v)) { imgs[v] = await caricaImmagine(bl[i]).catch(() => null); if (!imgs[v]) delete imgs[v]; }
      }
      mostraTutte(); anteprima();
    });
  }
  corpo.querySelector('#f-annulla').addEventListener('click', () => {
    schedaChiusa = true; clearTimeout(_tBozza); cancellaBozza();
    if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; } chiudi();
  });
  corpo.querySelector('#f-salva').addEventListener('click', async () => {
    corpo.querySelector('#f-err').hidden = true;
    const nome = corpo.querySelector('#f-nome').value.trim();
    const w = num('#o-w'), d = num('#o-d'), h = num('#o-h');
    if (!imgs.fronte) { errore(tr('Carica la foto davanti dell\'oggetto.')); return; }
    if (!(w > 0 && d > 0 && h > 0)) { errore(tr('Scrivi le misure reali in cm (larghezza, profondità e altezza).')); return; }
    if (w > 400 || d > 400 || h > 400) { errore(tr('Le misure vanno in centimetri: forse le hai scritte in millimetri?')); return; }
    if (!nome) { errore(tr('Scrivi il nome del prodotto.')); return; }
    const b = corpo.querySelector('#f-salva'); b.disabled = true; b.textContent = tr('Salvo…');
    try {
      const id = nuovo ? nuovoId() : p.id;
      for (const v of VISTE_OGG.map((x) => x.id)) {
        if (!cambiate.has(v)) continue;
        if (imgs[v]) await salvaFoto(id, await canvasPng(aCanvas(imgs[v])), v);
        else await eliminaFotoTipo(id, v);
      }
      if (cambiate.has('fronte')) {                            // la foto "principale" e la miniatura = la vista davanti
        const png = await canvasPng(aCanvas(imgs.fronte));
        await salvaFoto(id, png, 'foto'); await salvaFoto(id, png, 'thumb');
      }
      const viste = Object.fromEntries(['lato', 'sopra', 'dietro'].map((v) => [v, !!imgs[v]]));
      const dati = { id, sezione: 'oggetti', nome, info: { note: corpo.querySelector('#f-note').value.trim() },
        colore: colori.fronte ?? (p && p.colore), aggiornato: Date.now(),
        oggetto: { w, d, h, pianta, viste, tipi: Object.fromEntries(Object.entries(tipi).filter(([k, t]) => imgs[k] && t)) } };
      if (nuovo) stato.prodotti.push({ ...dati, creato: Date.now() });
      else stato.prodotti = stato.prodotti.map((x) => (x.id === id ? { ...x, ...dati } : x));
      if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; }
      schedaChiusa = true; clearTimeout(_tBozza); await cancellaBozza();
      await salvaERicarica();
    } catch (err) {
      console.error(err);
      errore(tr('Salvataggio non riuscito: forse lo spazio del browser è pieno.'));
      b.disabled = false; b.textContent = tr('Salva');
    }
  });
}
