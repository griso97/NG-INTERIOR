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
} from './catalogo.js?v=20261112u';
import { materialiPer, sfondoSwatch } from './materiali.js?v=20261112u';
import { agganciaTema } from './tema.js?v=20261112u';

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
    base: 'Foto dritta, con luce diffusa, senza flash e senza riflessi. Poi trascina il riquadro sulla parte da usare: quella parte diventa il materiale, con i suoi colori esatti.',
    fp: 'Foto della porta finger-pull, dritta e con luce diffusa. Poi segna due riquadri: PORTA (la parte sotto) e GOLA (la maniglia finger-pull sopra). Il 3D usa proprio quei pezzi della foto, con gli stessi colori.',
    man: 'Foto frontale della maniglia su sfondo uniforme (es. un foglio bianco). Trascina il riquadro attorno alla maniglia: lo sfondo viene tolto in automatico.',
  }[tipo];
  corpo.innerHTML = `
    <div class="imp-form">
      ${proprio ? `
      <label>${nuovo ? 'Foto <span class="imp-obbl">*</span>' : 'Foto (lascia vuoto per tenere quella attuale)'}
        <input type="file" accept="image/*" id="f-foto"></label>
      <div class="imp-aiuto">${aiutoFoto}</div>
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
        <label>${tipo === 'fp' ? 'Larghezza della zona porta (cm)' : 'Larghezza del campione (cm)'} <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-w" value="${esc(camp.w)}"></label>
        <label>${tipo === 'fp' ? 'Altezza della zona porta (cm)' : 'Altezza del campione (cm)'} <span class="imp-obbl">*</span><input type="number" min="1" step="0.1" id="f-h" value="${esc(camp.h)}"></label>
      </div>
      <div class="imp-aiuto">Misura reale della parte nel riquadro: serve per avere la venatura in scala vera sui mobili, non stirata.</div>` : ''}
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
      const zone = tipo === 'fp'
        ? [{ id: 'porta', nome: 'Porta (sotto)', colore: '#c9a94a', r: { x: 0.05, y: 0.3, w: 0.9, h: 0.65 } },
           { id: 'gola', nome: 'Gola (sopra)', colore: '#4aa3df', r: { x: 0.05, y: 0.04, w: 0.9, h: 0.16 } }]
        : [{ id: 'main', nome: '', colore: '#c9a94a', r: { x: 0, y: 0, w: 1, h: 1 } }];
      rit = ritaglio(img, corpo, zone, tipo === 'man');
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
    let w = 0, h = 0, manN = null;
    if (tipo === 'man') {
      const pers = corpo.querySelector('input[name="f-mis"]:checked').value === 'pers';
      const lung = Number(v('#f-lung').replace(',', '.'));
      if (pers && !(lung > 0)) { errore(tr('Scrivi la lunghezza della maniglia in cm, oppure scegli la misura standard (15 cm).')); return; }
      manN = { standard: !pers, lunghezzaCm: pers ? lung : MANIGLIA_STANDARD_CM, rapporto: p && p.maniglia ? p.maniglia.rapporto : null, verticale: p && p.maniglia ? p.maniglia.verticale : false };
    } else {
      w = Number(v('#f-w').replace(',', '.')); h = Number(v('#f-h').replace(',', '.'));
      if (!(w > 0 && h > 0)) { errore(tr('Inserisci la misura del campione in cm (larghezza e altezza).')); return; }
    }
    if (nuovo && !img) { errore(tr('Carica la foto del campione.')); return; }
    const b = corpo.querySelector('#f-salva'); b.disabled = true; b.textContent = tr('Salvo…');
    try {
      const id = nuovo ? nuovoId() : m.id;
      let colore = p ? p.colore : undefined, coloreGola = p ? p.coloreGola : undefined;
      if (img) {
        const z = rit();
        if (tipo === 'fp') {
          const porta = await ritaglioBlob(img, z.porta);
          const gola = await ritaglioBlob(img, z.gola, { max: 1024 });
          await salvaFoto(id, porta.blob, 'foto');
          await salvaFoto(id, gola.blob, 'gola');
          await salvaFoto(id, await thumbFingerPull(img, z.porta, z.gola), 'thumb');
          colore = porta.colore; coloreGola = gola.colore;
        } else if (tipo === 'man') {
          const scont = corpo.querySelector('#f-scont').checked ? Number(corpo.querySelector('#f-tol').value) : 0;
          const r = await ritaglioBlob(img, z.main, { png: true, scontorna: scont, thumbIntera: true, max: 1024 });
          await salvaFoto(id, r.blob, 'foto');
          await salvaFoto(id, r.thumb, 'thumb');
          colore = r.colore;
          manN.verticale = r.h > r.w;
          manN.rapporto = Math.min(r.w, r.h) / Math.max(r.w, r.h);
        } else {
          const f = await preparaFoto(img, z.main);
          await salvaFoto(id, f.foto, 'foto');
          await salvaFoto(id, f.thumb, 'thumb');
          colore = f.colore;
        }
      }
      const dati = { id, sezione: sez, nome, info: infoN, colore, aggiornato: Date.now(),
        ...(tipo === 'man' ? { maniglia: manN } : { campioneCm: { w, h } }),
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
async function thumbFingerPull(img, porta, gola) {
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d');
  g.drawImage(img, porta.x, porta.y, porta.w, porta.h, 0, 0, 192, 192);
  g.drawImage(img, gola.x, gola.y, gola.w, gola.h, 0, 0, 192, 34);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
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
