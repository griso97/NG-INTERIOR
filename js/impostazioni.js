// =============================================================================
// IMPOSTAZIONI → Catalogo prodotti
// =============================================================================
// Per ogni sezione (Legni e colori, Finger-pull, Encimere, Pannello dietro il
// piano, Zoccoli, Maniglie) si possono nascondere i prodotti, modificarne i
// dati e aggiungerne di nuovi da una FOTO del campione con la sua misura reale.
// =============================================================================
import {
  SEZIONI, leggiCatalogo, salvaCatalogo, salvaFoto, eliminaFoto, impostaNascosto, nascosto,
  nuovoId, preparaFoto, ritaglioBlob,
} from './catalogo.js?v=20261113a';
import { analizzaFoto, analizzaPorta, raddrizza, coloreMedio } from './analisi-foto.js?v=20261113a';
import { materialiPer, sfondoSwatch } from './materiali.js?v=20261113a';
import { agganciaTema } from './tema.js?v=20261113a';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
// Sezioni dove si possono già aggiungere prodotti da foto
const CON_AGGIUNTA = ['legno', 'fingerpull', 'encimera', 'pannello', 'zoccolo', 'maniglie'];

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
  if (info.tipo) r.push(esc(info.tipo));
  const sp = info.spessore || m.spessore;
  if (sp) r.push(`${esc(sp)} mm`);
  if (info.colore) r.push(esc(info.colore));
  if (m.campione) r.push(`campione ${Math.round(m.campione.wMm / 10)}×${Math.round(m.campione.hMm / 10)} cm`);
  if (m.lunghezzaMm) r.push(`lunghezza ${Math.round(m.lunghezzaMm / 10)} cm`);
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
            <span class="imp-badge ${m.proprio ? 'tuo' : ''}">${m.proprio ? 'Aggiunto da te' : 'Predefinito'}</span>
            <span class="imp-nome">${esc(m.nome)}</span>
            <span class="imp-dett">${dettagli(m)}</span>
            <label class="imp-vis"><input type="checkbox" data-vis="${esc(m.id)}" ${vis ? 'checked' : ''}> Visibile in questa sezione</label>
          </div>
          <div class="imp-azioni">
            <button type="button" class="btn-ghost btn-mini" data-mod="${esc(m.id)}">Modifica</button>
            ${m.proprio ? `<button type="button" class="btn-ghost btn-mini" data-del="${esc(m.id)}">Elimina</button>` : ''}
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
  el.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => apriScheda(lista.find((m) => m.id === b.dataset.mod))));
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
      <div class="imp-aiuto">${aiutoFoto}</div>
      <div id="f-auto" class="imp-auto" hidden>
        <canvas id="f-vista" class="imp-vista"></canvas>
        <div class="imp-auto-tiles" id="f-tiles"></div>
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
      </div>` : ''}
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
    corpo.querySelector('#f-foto').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      img = await caricaImmagine(file).catch(() => null);
      if (!img) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return; }
      rit = await analisiAutomatica(img, corpo, tipo);
    });
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
        if (tipo === 'fp') {
          // PORTA raddrizzata (vista di fronte), pixel della foto
          const cp = cartellaRaddrizzata(img, z.porta, w, h, z.portaFrazione);
          campioneZona = cp.cm;
          const portaBlob = await canvasBlob(cp.canvas, 'image/jpeg');
          // GOLA: la sua foto raddrizzata se pulita, altrimenti il suo colore
          const golaCanvas = z.gola ? raddrizza(img, z.gola, 800, 60, 0) : null;
          const golaBlob = golaCanvas ? await canvasBlob(golaCanvas, 'image/jpeg') : await bloccoColore(z.coloreGola ?? 0x1a1a1a);
          await salvaFoto(id, portaBlob, 'foto');
          await salvaFoto(id, golaBlob, 'gola');
          await salvaFoto(id, await thumbDaCanvas(cp.canvas, golaCanvas, z.coloreGola), 'thumb');
          colore = coloreMedio(cp.canvas); coloreGola = golaCanvas ? coloreMedio(golaCanvas) : (z.coloreGola ?? 0x1a1a1a);
        } else if (tipo === 'man') {
          const scont = corpo.querySelector('#f-scont').checked ? Number(corpo.querySelector('#f-tol').value) : 0;
          const r = await ritaglioBlob(img, z.main, { png: true, scontorna: scont, thumbIntera: true, max: 1024 });
          await salvaFoto(id, r.blob, 'foto');
          await salvaFoto(id, r.thumb, 'thumb');
          colore = r.colore;
          manN.verticale = r.h > r.w;
          manN.rapporto = Math.min(r.w, r.h) / Math.max(r.w, r.h);
        } else {
          const cp = cartellaRaddrizzata(img, z.main, w, h, z.portaFrazione);
          campioneZona = cp.cm;
          await salvaFoto(id, await canvasBlob(cp.canvas, 'image/jpeg'), 'foto');
          await salvaFoto(id, await thumbDaCanvas(cp.canvas, null, null), 'thumb');
          colore = coloreMedio(cp.canvas);
        }
      }
      const dati = { id, sezione: sez, nome, info: infoN, colore, aggiornato: Date.now(),
        ...(tipo === 'man' ? { maniglia: manN } : { campioneCm: campioneZona, oggettoCm: { w, h } }),
        ...(tipo === 'fp' ? { coloreGola } : {}) };
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
 * Porta/campione RADDRIZZATO alla sua forma vera: proporzioni dalla misura
 * reale (cm) della parte usata, lato lungo max 1600 px.
 */
function cartellaRaddrizzata(img, quad, wCm, hCm, frazione) {
  const fr = frazione || { w: 1, h: 1 };
  const cm = { w: Math.round(wCm * fr.w * 10) / 10, h: Math.round(hCm * fr.h * 10) / 10 };
  const asp = cm.w / cm.h;
  const OW = asp >= 1 ? 1600 : Math.max(64, Math.round(1600 * asp));
  const OH = asp >= 1 ? Math.max(64, Math.round(1600 / asp)) : 1600;
  return { canvas: raddrizza(img, quad, OW, OH, 0), cm };
}

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
async function analisiAutomatica(img, corpo, tipo) {
  if (tipo === 'man') return analisiManiglia(img, corpo, tipo);
  const a = analizzaPorta(img, tipo);
  const chiave = tipo === 'fp' ? 'porta' : 'main';
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
    poly(a.oggetto, '#9aa0a6', true); poly(a[chiave], '#e0a000'); poly(a.golaZona, '#1e90ff');
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
    tile(tipo === 'fp' ? 'Porta' : 'Campione', raddrizza(img, q, 280, Math.max(40, Math.round(280 / Math.max(0.2, asp))), 0));
    if (tipo === 'fp') tile('Gola', a.gola ? raddrizza(img, a.gola, 280, 40, 0) : null, a.coloreGola);
  };
  disegna();
  corpo.querySelector('#f-msg').textContent = tr(a.messaggio || '');
  // --- correzione a mano: angoli trascinabili sulla foto
  corpo.querySelector('#f-mano').onclick = () => {
    const wrap = v.parentElement; wrap.style.position = 'relative';
    wrap.querySelectorAll('.imp-angolo').forEach((x) => x.remove());
    const gruppi = [[chiave, '#e0a000']];
    if (tipo === 'fp') { if (!a.golaZona) { const o = a.oggetto; a.golaZona = [o[0], o[1], [o[1][0], o[1][1] + (o[2][1] - o[1][1]) * 0.06], [o[0][0], o[0][1] + (o[3][1] - o[0][1]) * 0.06]]; } gruppi.push(['golaZona', '#1e90ff']); }
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
    corpo.querySelector('#f-msg').textContent = tr('Trascina i pallini sugli angoli: oro = porta, blu = gola.');
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
async function analisiManiglia(img, corpo, tipo) {
  const a = analizzaFoto(img, tipo);
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
  else if (tipo === 'man') await tile('Maniglia (sfondo tolto)', a.main, { png: true });
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
