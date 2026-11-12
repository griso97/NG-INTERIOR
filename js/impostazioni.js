// =============================================================================
// IMPOSTAZIONI → Catalogo prodotti
// =============================================================================
// Per ogni sezione (Legni e colori, Finger-pull, Encimere, Pannello dietro il
// piano, Zoccoli, Maniglie) si possono nascondere i prodotti, modificarne i
// dati e aggiungerne di nuovi da una FOTO del campione con la sua misura reale.
// =============================================================================
import {
  SEZIONI, leggiCatalogo, salvaCatalogo, salvaFoto, eliminaFoto, impostaNascosto, nascosto,
  nuovoId, preparaFoto,
} from './catalogo.js?v=20261112s';
import { materialiPer, sfondoSwatch } from './materiali.js?v=20261112s';
import { agganciaTema } from './tema.js?v=20261112s';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
// Sezioni dove si possono già aggiungere prodotti da foto
const CON_AGGIUNTA = ['legno', 'encimera', 'pannello', 'zoccolo'];

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
    ${sezione === 'fingerpull' ? `<div class="imp-nota">Qui puoi già togliere un colore solo dal finger-pull. Il finger-pull da foto (porta di un colore e gola di un altro) arriva nel prossimo aggiornamento.</div>` : ''}
    ${sezione === 'maniglie' ? `<div class="imp-nota">Le maniglie da foto (con le loro misure) arrivano nel prossimo aggiornamento.</div>` : ''}
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

function apriScheda(m) {
  const nuovo = !m;
  const proprio = nuovo || m.proprio;
  const p = proprio && !nuovo ? stato.prodotti.find((x) => x.id === m.id) : null;
  const info = (p ? p.info : (m && m.info)) || {};
  const camp = p ? p.campioneCm : { w: '', h: '' };
  document.getElementById('imp-modale-titolo').textContent = tr(nuovo ? 'Nuovo prodotto' : 'Modifica prodotto');
  const corpo = document.getElementById('imp-modale-corpo');
  corpo.innerHTML = `
    <div class="imp-form">
      ${proprio ? `
      <label>Foto del campione${nuovo ? ' <span class="imp-obbl">*</span>' : ' (lascia vuoto per tenere quella attuale)'}
        <input type="file" accept="image/*" id="f-foto"></label>
      <div class="imp-aiuto">Foto dritta, con luce diffusa, senza flash e senza riflessi. Poi trascina il riquadro sulla parte da usare: quella parte diventa il materiale, con i suoi colori esatti.</div>
      <div id="f-ritaglio-box" hidden>
        <div class="imp-ritaglio" id="f-ritaglio"><canvas id="f-canvas"></canvas><div class="imp-rett" id="f-rett"><div class="imp-maniglia" id="f-man"></div></div></div>
        <div class="imp-anteprima" style="margin-top:8px"><canvas class="imp-tile" id="f-tile" width="192" height="192"></canvas>
          <div class="imp-aiuto">Anteprima della parte scelta.<br><button type="button" class="btn-ghost btn-mini" id="f-tutta">Usa tutta la foto</button></div></div>
      </div>
      <div class="grid-2">
        <label>Larghezza del campione (cm) <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-w" value="${esc(camp.w)}"></label>
        <label>Altezza del campione (cm) <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-h" value="${esc(camp.h)}"></label>
      </div>
      <div class="imp-aiuto">Misura reale della parte di campione nella foto (nel riquadro): serve per avere la venatura in scala vera sui mobili, non stirata.</div>` : ''}
      <label>Nome <span class="imp-obbl">*</span><input type="text" id="f-nome" value="${esc(m ? m.nome : '')}" placeholder="Es. Rovere naturale, Giallo canarino…"></label>
      <div class="grid-2">
        <label>Tipo di materiale<input type="text" id="f-tipo" value="${esc(info.tipo || '')}" placeholder="Es. Melaminico, Laminato, Compacto…"></label>
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
  let img = null, rit = null;
  if (proprio) {
    corpo.querySelector('#f-foto').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      img = await caricaImmagine(file).catch(() => null);
      if (!img) { errore(tr('Non riesco ad aprire questa foto. Prova con un JPG o PNG.')); return; }
      rit = ritaglio(img, corpo);
    });
  }
  corpo.querySelector('#f-salva').addEventListener('click', async () => {
    const v = (id) => corpo.querySelector(id) ? corpo.querySelector(id).value.trim() : '';
    const nome = v('#f-nome');
    const infoN = { tipo: v('#f-tipo'), spessore: v('#f-sp'), colore: v('#f-col'), note: v('#f-note') };
    if (!nome) { errore(tr('Scrivi il nome del prodotto.')); return; }
    if (!proprio) {
      stato.modifiche = { ...(stato.modifiche || {}), [m.id]: { nome, info: infoN } };
      await salvaERicarica(); return;
    }
    const w = Number(v('#f-w').replace(',', '.')), h = Number(v('#f-h').replace(',', '.'));
    if (!(w > 0 && h > 0)) { errore(tr('Inserisci la misura del campione in cm (larghezza e altezza).')); return; }
    if (nuovo && !img) { errore(tr('Carica la foto del campione.')); return; }
    const b = corpo.querySelector('#f-salva'); b.disabled = true; b.textContent = tr('Salvo…');
    try {
      const id = nuovo ? nuovoId() : m.id;
      let colore = p ? p.colore : undefined;
      if (img) {
        const f = await preparaFoto(img, rit ? rit() : null);
        await salvaFoto(id, f.foto, 'foto');
        await salvaFoto(id, f.thumb, 'thumb');
        colore = f.colore;
      }
      const dati = { id, sezione: nuovo ? sezione : p.sezione, nome, campioneCm: { w, h }, info: infoN, colore, aggiornato: Date.now() };
      if (nuovo) stato.prodotti.push({ ...dati, creato: Date.now() });
      else stato.prodotti = stato.prodotti.map((x) => (x.id === id ? { ...x, ...dati } : x));
      await salvaERicarica();
    } catch (err) {
      console.error(err);
      errore(tr('Salvataggio non riuscito: forse lo spazio del browser è pieno.'));
      b.disabled = false; b.textContent = tr('Salva');
    }
  });
  function errore(t) { const e = corpo.querySelector('#f-err'); e.textContent = t; e.hidden = false; }
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

/** Riquadro trascinabile sulla foto. Ritorna una funzione che dà il ritaglio in pixel. */
function ritaglio(img, corpo) {
  corpo.querySelector('#f-ritaglio-box').hidden = false;
  const box = corpo.querySelector('#f-ritaglio'), cv = corpo.querySelector('#f-canvas');
  const rett = corpo.querySelector('#f-rett'), man = corpo.querySelector('#f-man'), tile = corpo.querySelector('#f-tile');
  const W = img.naturalWidth, H = img.naturalHeight;
  const k = Math.min(1, 1400 / Math.max(W, H));
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  let r = { x: 0, y: 0, w: 1, h: 1 };                     // frazioni dell'immagine
  const disegna = () => {
    rett.style.left = `${r.x * 100}%`; rett.style.top = `${r.y * 100}%`;
    rett.style.width = `${r.w * 100}%`; rett.style.height = `${r.h * 100}%`;
    const g = tile.getContext('2d');
    g.clearRect(0, 0, 192, 192);
    const sx = r.x * W, sy = r.y * H, sw = r.w * W, sh = r.h * H, s = Math.min(192 / sw, 192 / sh);
    g.drawImage(img, sx, sy, sw, sh, (192 - sw * s) / 2, (192 - sh * s) / 2, sw * s, sh * s);
  };
  disegna();
  corpo.querySelector('#f-tutta').onclick = () => { r = { x: 0, y: 0, w: 1, h: 1 }; disegna(); };
  let drag = null;
  const pt = (e) => { const b = box.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  box.addEventListener('pointerdown', (e) => {
    const p = pt(e);
    if (e.target === man) drag = { tipo: 'man', p0: p, r0: { ...r } };
    else if (e.target === rett) drag = { tipo: 'sposta', p0: p, r0: { ...r } };
    else { drag = { tipo: 'nuovo', p0: p }; r = { x: p.x, y: p.y, w: 0.01, h: 0.01 }; }
    box.setPointerCapture(e.pointerId); e.preventDefault();
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pt(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (drag.tipo === 'sposta') { r.x = lim(drag.r0.x + dx, 0, 1 - r.w); r.y = lim(drag.r0.y + dy, 0, 1 - r.h); }
    else if (drag.tipo === 'man') { r.w = lim(drag.r0.w + dx, 0.03, 1 - r.x); r.h = lim(drag.r0.h + dy, 0.03, 1 - r.y); }
    else {
      const x0 = lim(Math.min(drag.p0.x, p.x), 0, 1), y0 = lim(Math.min(drag.p0.y, p.y), 0, 1);
      r = { x: x0, y: y0, w: lim(Math.abs(dx), 0.03, 1 - x0), h: lim(Math.abs(dy), 0.03, 1 - y0) };
    }
    disegna();
  });
  const fine = () => { drag = null; };
  box.addEventListener('pointerup', fine); box.addEventListener('pointercancel', fine);
  return () => ({ x: Math.round(r.x * W), y: Math.round(r.y * H), w: Math.max(1, Math.round(r.w * W)), h: Math.max(1, Math.round(r.h * H)) });
}

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').slice(1);
  if (h !== sezione && SEZIONI.some((x) => x.id === h)) { sezione = h; render(); }
});
render();
