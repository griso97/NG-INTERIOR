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
} from './catalogo.js?v=20261115p';
import { FORME_MANIGLIA, FINITURE_MANIGLIA, FINITURA_FOTO, anteprimaManiglia } from './maniglia3d.js?v=20261115p';
import { anteprimaOggetto, riconosciViste } from './oggetto3d.js?v=20261115p';
import { segmentaManiglia, canvasPng } from './segmenta-maniglia.js?v=20261115p';
import { analizzaFoto, analizzaPorta, raddrizza, coloreMedio, pulisciRiflessi, analizzaSuperficie, ralVicini } from './analisi-foto.js?v=20261115p';
import { materialiPer, sfondoSwatch } from './materiali.js?v=20261115p';
import { agganciaTema } from './tema.js?v=20261115p';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
// Sezioni dove si possono già aggiungere prodotti da foto
const CON_AGGIUNTA = ['legno', 'fingerpull', 'encimera', 'pannello', 'zoccolo', 'maniglie', 'oggetti'];

let stato = await leggiCatalogo();
let sezione = (location.hash || '').slice(1);
if (!SEZIONI.some((s) => s.id === sezione)) sezione = 'legno';

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
  if (m.viste && m.categoria === 'maniglia') r.push(`viste: ${['davanti', ...Object.keys(m.viste)].join(', ')}`);
  if (m.viste && m.categoria === 'oggetto') r.push(`foto: ${['davanti', ...['lato', 'sopra', 'dietro'].filter((v) => m.viste[v])].join(', ')}`);
  if (m.ral) r.push(`RAL ${esc(m.ral)}`);
  if (m.proprio && m.lucido != null && m.categoria !== 'maniglia') r.push(m.lucido ? 'lucido' : 'opaco');
  if (m.gola) r.push('con gola');
  return r.join(' · ');
}

function render() {
  const S = SEZIONI.find((s) => s.id === sezione);
  document.getElementById('imp-schede').innerHTML = SEZIONI.map((s) =>
    `<button type="button" class="btn-ghost ${s.id === sezione ? 'attivo' : ''}" data-sez="${s.id}">${esc(s.nome)}</button>`).join('');
  document.querySelectorAll('[data-sez]').forEach((b) => b.addEventListener('click', () => vaiSezione(b.dataset.sez)));

  const lista = materialiPer(sezione, { tutti: true });
  const visibili = lista.filter((m) => !nascosto(stato, sezione, m.id)).length;
  const puoAggiungere = CON_AGGIUNTA.includes(sezione);
  const el = document.getElementById('imp-sezione');
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
            <span class="imp-badge ${m.proprio ? 'tuo' : ''}">${m.derivato ? 'Dal finger-pull (senza gola)' : m.proprio ? 'Aggiunto da te' : 'Predefinito'}</span>
            <span class="imp-nome">${esc(m.nome)}</span>
            <span class="imp-dett">${dettagli(m)}</span>
            <label class="imp-vis"><input type="checkbox" data-vis="${esc(m.id)}" ${vis ? 'checked' : ''}> Visibile in questa sezione</label>
          </div>
          <div class="imp-azioni">
            <button type="button" class="btn-ghost btn-mini" data-mod="${esc(m.id)}">Modifica</button>
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
}

// ---------------------------------------------------------------------------
// Scheda prodotto: foto + ritaglio + misure + dati
// ---------------------------------------------------------------------------
const modale = document.getElementById('imp-modale');
function chiudi() { modale.hidden = true; document.getElementById('imp-modale-corpo').innerHTML = ''; }
modale.addEventListener('click', (e) => { if (e.target === modale) chiudi(); });
const MANIGLIA_STANDARD_CM = 15;

function apriScheda(m) {
  const nuovo = !m;
  const proprio = nuovo || m.proprio;
  const p = proprio && !nuovo ? stato.prodotti.find((x) => x.id === m.id) : null;
  const sez = nuovo ? sezione : (p ? p.sezione : sezione);
  if (sez === 'oggetti') return apriSchedaOggetto(p);
  const tipo = sez === 'fingerpull' ? 'fp' : sez === 'maniglie' ? 'man' : 'base';
  const info = (p ? p.info : (m && m.info)) || {};
  const camp = p && p.campioneCm ? p.campioneCm : { w: '', h: '' };
  const man = (p && p.maniglia) || { standard: true, lunghezzaCm: '' };
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
        <label>${tipo === 'fp' ? 'Larghezza della porta (cm)' : 'Larghezza del campione (cm)'} <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-w" placeholder="es. 59,8" value="${esc(p && p.oggettoCm ? p.oggettoCm.w : camp.w)}"></label>
        <label>${tipo === 'fp' ? 'Altezza della porta (cm)' : 'Altezza del campione (cm)'} <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-h" placeholder="es. 69,7" value="${esc(p && p.oggettoCm ? p.oggettoCm.h : camp.h)}"></label>
      </div>
      <div class="imp-aiuto">${tipo === 'fp' ? 'Misura reale di tutta la porta della foto' : 'Misura reale di tutto il campione della foto'}: serve per avere la venatura in scala vera sui mobili, non stirata.</div>` : ''}
      ${tipo === 'man' ? `
      <fieldset class="imp-misura">
        <legend>Misura della maniglia</legend>
        <label class="imp-vis"><input type="radio" name="f-mis" value="std" ${man.standard !== false ? 'checked' : ''}> Standard (${MANIGLIA_STANDARD_CM} cm)</label>
        <label class="imp-vis"><input type="radio" name="f-mis" value="pers" ${man.standard === false ? 'checked' : ''}> Personalizzata</label>
        <label id="f-lung-box" ${man.standard === false ? '' : 'hidden'}>Lunghezza della maniglia (cm) <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-lung" value="${esc(man.standard === false ? man.lunghezzaCm : '')}"></label>
        <div class="imp-aiuto">La lunghezza è il lato lungo della maniglia. L'altezza si calcola dalla foto.</div>
      </fieldset>` : ''}
      <label>Nome <span class="imp-obbl">*</span><input type="text" id="f-nome" value="${esc(m ? m.nome : '')}" placeholder="${tipo === 'man' ? 'Es. Maniglia nera 160' : tipo === 'fp' ? 'Es. Rovere con gola nera' : 'Es. Rovere naturale, Giallo canarino…'}"></label>
      <div class="grid-2">
        <label>Tipo di materiale<input type="text" id="f-tipo" value="${esc(info.tipo || '')}" placeholder="${tipo === 'man' ? 'Es. Alluminio, Acciaio…' : 'Es. Melaminico, Laminato, Compacto…'}"></label>
        <label>Spessore (mm)<input type="number" min="0" step="0.1" id="f-sp" value="${esc(info.spessore || (m && m.spessore) || '')}"></label>
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
    if (!proprio) {
      stato.modifiche = { ...(stato.modifiche || {}), [m.id]: { nome, info: infoN } };
      await salvaERicarica(); return;
    }
    let w = 0, h = 0, manN = null;
    if (tipo === 'man') {
      const pers = corpo.querySelector('input[name="f-mis"]:checked').value === 'pers';
      const lung = Number(v('#f-lung').replace(',', '.'));
      if (pers && !(lung > 0)) { errore(tr('Scrivi la lunghezza della maniglia in cm, oppure scegli la misura standard (15 cm).')); return; }
      if (pers && lung > 150) { errore(tr('La lunghezza va in centimetri: forse l\'hai scritta in millimetri? Es. 160 mm = 16 cm.')); return; }
      manN = { standard: !pers, lunghezzaCm: pers ? lung : MANIGLIA_STANDARD_CM, rapporto: p && p.maniglia ? p.maniglia.rapporto : null, verticale: p && p.maniglia ? p.maniglia.verticale : false };
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
      const dati = { id, sezione: sez, nome, info: infoN, colore, aggiornato: Date.now(), ...sup,
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

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').slice(1);
  if (h !== sezione && SEZIONI.some((x) => x.id === h)) { sezione = h; render(); }
});
render();

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
function apriSchedaOggetto(p) {
  const nuovo = !p;
  const o = (p && p.oggetto) || { w: '', d: '', h: '', pianta: 'squadrata' };
  const info = (p && p.info) || {};
  const corpo = document.getElementById('imp-modale-corpo');
  corpo.innerHTML = `
    <div class="imp-form">
      <div class="imp-aiuto">Carica le foto dell'oggetto su sfondo uniforme: vanno benissimo quelle del sito del produttore (su bianco). Il sito <strong>riconosce da solo quale foto è davanti, di lato, dietro o da sopra</strong>, isola l'oggetto e costruisce il <strong>3D con le misure vere e le tue foto sopra</strong>. Se sbaglia una vista, correggila con «Questa foto è».</div>
      <label class="imp-tutte">📷 Carica tutte le foto insieme<input type="file" accept="image/*" multiple id="o-tutte"></label>
      <div class="imp-viste3">
        ${VISTE_OGG.map((v) => `
        <div class="imp-vista3">
          <div class="imp-vista-tit"><span class="imp-vista-ico" aria-hidden="true">${v.svg}</span><span><strong>${v.nome}</strong>${v.obbl ? ' <span class="imp-obbl">*</span>' : ''}<br><small>${v.aiuto}</small></span></div>
          <label class="imp-vista-file">Scegli foto<input type="file" accept="image/*" data-vista="${v.id}"></label>
          <div class="imp-vista3-img" data-img="${v.id}"></div>
          <div class="imp-vista-azioni" data-azioni="${v.id}" hidden>
            <label class="imp-vista-ruolo">Questa foto è:
              <select data-ruolo="${v.id}">${VISTE_OGG.map((q) => `<option value="${q.id}"${q.id === v.id ? ' selected' : ''}>${q.nome}</option>`).join('')}</select></label>
            <button type="button" class="btn-ghost btn-mini imp-togli" data-togli="${v.id}">✕ Togli questa foto</button>
          </div>
        </div>`).join('')}
      </div>
      <div class="imp-auto-msg" id="o-msg" hidden></div>
      <fieldset class="imp-misura">
        <legend>Misure reali (cm) <span class="imp-obbl">*</span></legend>
        <div class="imp-misure3">
          <label>Larghezza<input type="number" min="1" step="0.1" id="o-w" value="${esc(o.w)}" placeholder="es. 28"></label>
          <label>Profondità<input type="number" min="1" step="0.1" id="o-d" value="${esc(o.d)}" placeholder="es. 36"></label>
          <label>Altezza<input type="number" min="1" step="0.1" id="o-h" value="${esc(o.h)}" placeholder="es. 31"></label>
        </div>
        <div class="imp-aiuto">Le trovi nella scheda del prodotto (la profondità con la maniglia). Il 3D esce in scala vera.</div>
      </fieldset>
      <fieldset class="imp-misura" id="o-pianta-box">
        <legend>Forma vista da sopra</legend>
        <div class="opzioni-anta imp-pianta">
          ${[['squadrata', 'Squadrata'], ['tonda', 'Tonda'], ['ovale', 'Ovale']].map(([id, n]) => `<button type="button" class="btn-ghost btn-mini ${o.pianta === id ? 'attivo' : ''}" data-pianta="${id}">${n}</button>`).join('')}
        </div>
        <div class="imp-aiuto">Serve solo senza la foto da sopra: per esempio una friggitrice tonda.</div>
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
  let pianta = o.pianta || 'squadrata';
  const errore = (t) => { const e = corpo.querySelector('#f-err'); e.textContent = t; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); };
  const avviso = (t) => { const m = corpo.querySelector('#o-msg'); m.textContent = t; m.hidden = !t; };
  const num = (id) => Number(String(corpo.querySelector(id).value).replace(',', '.'));
  const mostra = (v) => {
    const box = corpo.querySelector(`[data-img="${v}"]`); box.innerHTML = '';
    if (imgs[v]) { const c = document.createElement('canvas'); disegnaScacchi(c, imgs[v], 300, 220); box.appendChild(c); }
    corpo.querySelector(`[data-azioni="${v}"]`).hidden = !imgs[v];
    corpo.querySelector(`[data-ruolo="${v}"]`).value = v;
    corpo.querySelector('#o-pianta-box').hidden = !!imgs.sopra;
  };
  const mostraTutte = () => VISTE_OGG.forEach((x) => mostra(x.id));
  const anteprima = () => {
    clearTimeout(_tAntOgg);
    _tAntOgg = setTimeout(async () => {
      const box = corpo.querySelector('#o-vista'); if (!box) return;
      const W = num('#o-w') * 10, D = num('#o-d') * 10, H = num('#o-h') * 10;
      if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; }
      if (!imgs.fronte || !(W > 0 && D > 0 && H > 0)) { box.innerHTML = `<div class="imp-aiuto">${tr('Carica la foto davanti e scrivi le misure.')}</div>`; return; }
      box.innerHTML = `<div class="imp-aiuto">${tr('Costruisco il 3D…')}</div>`;
      await new Promise((r) => setTimeout(r, 30));
      _chiudiAntOgg = await anteprimaOggetto(box, imgs, W, D, H, pianta);
    }, 250);
  };
  /** Sposta/scambia la foto della casella da → a. */
  const scambia = (da, a) => {
    if (da === a) return;
    [imgs[da], imgs[a]] = [imgs[a], imgs[da]]; [colori[da], colori[a]] = [colori[a], colori[da]];
    for (const k of [da, a]) { if (!imgs[k]) delete imgs[k]; cambiate.add(k); }
  };
  /** Riconosce le viste e rimette ogni foto nella casella giusta (lo dice). */
  const riconosci = () => {
    const r = riconosciViste(imgs);
    if (!r) { avviso(''); return; }
    const vecchie = { ...imgs }, vecchiCol = { ...colori };
    for (const k of VISTE_OGG.map((x) => x.id)) { delete imgs[k]; delete colori[k]; }
    for (const [dest, orig] of Object.entries(r.mappa)) { imgs[dest] = vecchie[orig]; colori[dest] = vecchiCol[orig]; }
    for (const k of Object.keys(vecchie)) if (!Object.values(r.mappa).includes(k) && !imgs[k]) { imgs[k] = vecchie[k]; colori[k] = vecchiCol[k]; }
    for (const k of VISTE_OGG.map((x) => x.id)) if (vecchie[k] !== imgs[k]) cambiate.add(k);
    const frasi = Object.entries(r.cambi).map(([dest, orig]) => `${tr('la foto messa in')} «${tr(NOMI_VISTA[orig])}» ${tr('è')} «${tr(NOMI_VISTA[dest])}»`);
    avviso(`✓ ${tr('Ho riconosciuto le viste')}: ${frasi.join('; ')}. ${tr('Se è sbagliato, correggi con «Questa foto è».')}`);
  };
  const carica = async (f, v) => {
    const im = await caricaImmagine(f).catch(() => null);
    if (!im) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return false; }
    const seg = segmentaManiglia(im, null, 1, { raddrizza: false });
    if (!seg) { errore(tr('Non riesco a isolare l\'oggetto in questa foto: usa una foto con lo sfondo uniforme (es. bianco).')); return false; }
    imgs[v] = seg.canvas; colori[v] = seg.colore; cambiate.add(v);
    return true;
  };
  for (const v of VISTE_OGG.map((x) => x.id)) {
    corpo.querySelector(`[data-vista="${v}"]`).addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      corpo.querySelector('#f-err').hidden = true;
      if (await carica(f, v)) { riconosci(); mostraTutte(); anteprima(); }
      e.target.value = '';
    });
    corpo.querySelector(`[data-togli="${v}"]`).addEventListener('click', () => {
      delete imgs[v]; delete colori[v]; cambiate.add(v); avviso('');
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
    for (const f of files) { const v = libere.shift() || 'dietro'; await carica(f, v); }
    riconosci(); mostraTutte(); anteprima();
    e.target.value = '';
  });
  corpo.querySelectorAll('[data-pianta]').forEach((b) => b.addEventListener('click', () => {
    pianta = b.dataset.pianta;
    corpo.querySelectorAll('[data-pianta]').forEach((x) => x.classList.toggle('attivo', x === b));
    anteprima();
  }));
  corpo.querySelectorAll('#o-w, #o-d, #o-h').forEach((x) => x.addEventListener('change', anteprima));
  // MODIFICA: le foto isolate già salvate
  if (p) {
    Promise.all(VISTE_OGG.map((v) => leggiFoto(p.id, v.id))).then(async (bl) => {
      for (let i = 0; i < bl.length; i++) {
        const v = VISTE_OGG[i].id;
        if (bl[i] && !imgs[v] && !cambiate.has(v)) { imgs[v] = await caricaImmagine(bl[i]).catch(() => null); if (!imgs[v]) delete imgs[v]; }
      }
      mostraTutte(); anteprima();
    });
  }
  corpo.querySelector('#f-annulla').addEventListener('click', () => { if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; } chiudi(); });
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
        oggetto: { w, d, h, pianta, viste } };
      if (nuovo) stato.prodotti.push({ ...dati, creato: Date.now() });
      else stato.prodotti = stato.prodotti.map((x) => (x.id === id ? { ...x, ...dati } : x));
      if (_chiudiAntOgg) { _chiudiAntOgg(); _chiudiAntOgg = null; }
      await salvaERicarica();
    } catch (err) {
      console.error(err);
      errore(tr('Salvataggio non riuscito: forse lo spazio del browser è pieno.'));
      b.disabled = false; b.textContent = tr('Salva');
    }
  });
}
