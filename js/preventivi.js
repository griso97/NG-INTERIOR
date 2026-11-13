// =============================================================================
// I MIEI PREVENTIVI — salva il progetto con un nome ("Cucina Mario") e ritrovalo
// =============================================================================
// Vale per cucina, armadi e mobili modulari. Ogni configuratore tiene già il
// progetto in corso in localStorage (si salva da solo a ogni modifica): qui lo
// si copia in un archivio con nome (IndexedDB, nel browser di questo
// dispositivo) e lo si riapre quando serve. Pronto per passare al cloud: basta
// cambiare le funzioni db*() qui sotto.
// Pulsanti nell'intestazione: 💾 Salva · 📂 Preventivi.
// =============================================================================

const TIPI = {
  cucina: { chiave: 'ng-cucina-progetto-v1', pagina: 'cucina.html', nome: 'Cucina', ico: '🍳' },
  armadio: { chiave: 'ng-interior-configuratore-v1', pagina: 'configuratore.html', nome: 'Armadio', ico: '🚪' },
  modulari: { chiave: 'ng-modulari-v1', pagina: 'modulari.html', nome: 'Mobili modulari', ico: '🧩' },
};
const tipoPagina = /cucina\.html/.test(location.pathname) ? 'cucina'
  : /configuratore\.html/.test(location.pathname) ? 'armadio'
  : /modulari\.html/.test(location.pathname) ? 'modulari' : null;
const CHIAVE_CORRENTE = (tipo) => `ng-prev-corrente-${tipo}`;
const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);

// --------------------------------------------------------------- archivio (IndexedDB)
let _db = null;
function apriDb() {
  if (_db) return _db;
  _db = new Promise((ok, ko) => {
    const r = indexedDB.open('ng-preventivi', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('preventivi', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return _db;
}
async function dbTx(modo, fn) {
  const db = await apriDb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('preventivi', modo), st = tx.objectStore('preventivi');
    let res; const r = fn(st);
    if (r) r.onsuccess = () => { res = r.result; };
    tx.oncomplete = () => ok(res);
    tx.onerror = () => ko(tx.error);
  });
}
export const elencoPreventivi = async () => ((await dbTx('readonly', (st) => st.getAll())) || [])
  .sort((a, b) => (b.aggiornato || 0) - (a.aggiornato || 0));
export const leggiPreventivo = (id) => dbTx('readonly', (st) => st.get(id));
const scriviPreventivo = (p) => dbTx('readwrite', (st) => st.put(p));
const togliPreventivo = (id) => dbTx('readwrite', (st) => st.delete(id));
const nuovoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Chiede al browser di non cancellare da solo i dati salvati (se lo permette). */
function chiediPersistenza() { try { navigator.storage?.persist?.(); } catch (_) { /* niente */ } }

// --------------------------------------------------------------- progetto in corso
function datiCorrenti(tipo) {
  try { return JSON.parse(localStorage.getItem(TIPI[tipo].chiave) || 'null'); } catch (_) { return null; }
}
function correnteId(tipo) { try { return localStorage.getItem(CHIAVE_CORRENTE(tipo)) || null; } catch (_) { return null; } }
function impostaCorrente(tipo, id) {
  try { if (id) localStorage.setItem(CHIAVE_CORRENTE(tipo), id); else localStorage.removeItem(CHIAVE_CORRENTE(tipo)); } catch (_) { /* niente */ }
}

/** Salva il progetto aperto: aggiorna quello corrente oppure ne crea uno nuovo. */
async function salva(tipo, nome, comeNuovo) {
  const dati = datiCorrenti(tipo);
  if (!dati) throw new Error(t('Non c\'è niente da salvare: il progetto è vuoto.'));
  const ora = Date.now(), idC = correnteId(tipo);
  const vecchio = !comeNuovo && idC ? await leggiPreventivo(idC) : null;
  const p = vecchio ? { ...vecchio, nome, dati, aggiornato: ora }
    : { id: nuovoId(), tipo, nome, dati, creato: ora, aggiornato: ora };
  await scriviPreventivo(p);
  impostaCorrente(tipo, p.id);
  chiediPersistenza();
  return p;
}

/** Apre un preventivo: lo rimette come progetto in corso e apre la sua pagina. */
async function apri(id) {
  const p = await leggiPreventivo(id);
  if (!p || !TIPI[p.tipo]) return;
  localStorage.setItem(TIPI[p.tipo].chiave, JSON.stringify(p.dati));
  impostaCorrente(p.tipo, p.id);
  if (p.tipo === tipoPagina) location.reload();
  else location.href = TIPI[p.tipo].pagina;
}

// --------------------------------------------------------------- copia su file
async function scaricaCopia() {
  const lista = await elencoPreventivi();
  const blob = new Blob([JSON.stringify({ ngPreventivi: true, versione: 1, salvato: new Date().toISOString(), preventivi: lista }, null, 1)], { type: 'application/json' });
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `NG-preventivi-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return lista.length;
}
/** Importa da file: aggiunge i preventivi nuovi e aggiorna quelli più recenti. */
async function importaFile(file) {
  const j = JSON.parse(await file.text());
  const lista = Array.isArray(j?.preventivi) ? j.preventivi : null;
  if (!lista) throw new Error(t('Questo file non contiene preventivi.'));
  let n = 0;
  for (const p of lista) {
    if (!p || !p.id || !TIPI[p.tipo] || !p.dati) continue;
    const c = await leggiPreventivo(p.id);
    if (!c || (p.aggiornato || 0) > (c.aggiornato || 0)) { await scriviPreventivo(p); n++; }
  }
  chiediPersistenza();
  return n;
}

// --------------------------------------------------------------- interfaccia
const CSS = `
.ngp-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--oro-scuro,#8a6a14);border-radius:999px;padding:6px 12px;background:transparent;color:var(--oro-chiaro,#e8c25a);font:500 12px/1 inherit;letter-spacing:1px;white-space:nowrap;cursor:pointer;margin-left:8px}
.ngp-btn:hover{border-color:var(--oro,#c9a94a);color:#fff}
@media (max-width:700px){.ngp-btn .ngp-txt{display:none}.ngp-btn{padding:6px 9px;margin-left:6px}}
.ngp-fondo{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px 12px;overflow:auto}
.ngp-fondo[hidden]{display:none}
.ngp-box{width:min(620px,100%);background:#14110d;color:#f3efe6;border:1px solid #8a6a14;border-radius:12px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);font:14px/1.4 system-ui,-apple-system,sans-serif}
.ngp-box h2{margin:0 0 12px;font:600 18px/1.2 inherit;color:#e8c25a;letter-spacing:.5px}
.ngp-box input[type=text],.ngp-box input[type=search]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #4a4030;background:#0d0a06;color:#fff;font:15px inherit}
.ngp-riga{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ngp-riga button,.ngp-azioni button,.ngp-file{cursor:pointer;padding:9px 12px;border-radius:8px;border:1px solid #4a4030;background:#1d1912;color:#f3efe6;font:13px inherit}
.ngp-riga button.ngp-oro{background:linear-gradient(180deg,#c9a94a,#8a6a14);border-color:#c9a94a;color:#14110d;font-weight:600}
.ngp-nota{font-size:12px;color:#b8ad97;margin-top:8px}
.ngp-lista{margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto}
.ngp-item{border:1px solid #3a3226;border-radius:10px;padding:10px 12px;background:#1a1611}
.ngp-item.ngp-aperto{border-color:#c9a94a}
.ngp-nome{font-weight:600;font-size:15px;color:#fff;word-break:break-word}
.ngp-info{font-size:12px;color:#b8ad97;margin-top:2px}
.ngp-azioni{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ngp-azioni button{padding:7px 10px;font-size:12px}
.ngp-azioni button.ngp-apri{border-color:#c9a94a;color:#e8c25a}
.ngp-azioni button.ngp-del{color:#e69b9b;border-color:#5a3434}
.ngp-vuoto{padding:18px;text-align:center;color:#b8ad97}
.ngp-piede{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #3a3226}
.ngp-file input{display:none}
.ngp-msg{margin-top:10px;font-size:13px;color:#9fd49f}
.ngp-msg.ngp-err{color:#e69b9b}
`;
let fondo = null;
function apriFinestra(html) {
  if (!fondo) {
    fondo = document.createElement('div'); fondo.className = 'ngp-fondo'; fondo.hidden = true;
    fondo.addEventListener('click', (e) => { if (e.target === fondo) chiudi(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fondo && !fondo.hidden) chiudi(); });
    document.body.appendChild(fondo);
  }
  fondo.innerHTML = `<div class="ngp-box">${html}</div>`;
  fondo.hidden = false;
  return fondo.firstElementChild;
}
function chiudi() { if (fondo) fondo.hidden = true; }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const data = (ms) => { try { return new Date(ms).toLocaleString(window.NGI18N?.lingua === 'es' ? 'es-ES' : 'it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

/** Finestra "Salva preventivo": nome + Aggiorna / Salva come nuovo. */
async function finestraSalva() {
  const tipo = tipoPagina;
  const idC = correnteId(tipo);
  const cor = idC ? await leggiPreventivo(idC) : null;
  if (idC && !cor) impostaCorrente(tipo, null);
  const nomeDef = cor ? cor.nome : `${t(TIPI[tipo].nome)} `;
  const box = apriFinestra(`
    <h2>💾 ${t('Salva preventivo')}</h2>
    <label>${t('Nome del preventivo (es. Cucina Mario)')}<br><input type="text" id="ngp-nome" value="${esc(nomeDef)}" maxlength="120" autocomplete="off"></label>
    ${cor ? `<div class="ngp-nota">${t('Hai aperto il preventivo')} «<span data-no-i18n>${esc(cor.nome)}</span>»: ${t('puoi aggiornarlo oppure salvarne una copia nuova.')}</div>` : ''}
    <div class="ngp-riga">
      ${cor ? `<button type="button" class="ngp-oro" data-s="aggiorna">${t('Aggiorna questo preventivo')}</button>
      <button type="button" data-s="nuovo">${t('Salva come nuovo')}</button>`
        : `<button type="button" class="ngp-oro" data-s="nuovo">${t('Salva')}</button>`}
      <button type="button" data-s="annulla">${t('Annulla')}</button>
    </div>
    <div class="ngp-msg" id="ngp-msg" hidden></div>`);
  const inp = box.querySelector('#ngp-nome');
  setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 50);
  const msg = box.querySelector('#ngp-msg');
  const fai = async (comeNuovo) => {
    const nome = inp.value.trim();
    if (!nome) { msg.hidden = false; msg.className = 'ngp-msg ngp-err'; msg.textContent = t('Scrivi il nome del preventivo.'); return; }
    try {
      await salva(tipo, nome, comeNuovo);
      msg.hidden = false; msg.className = 'ngp-msg'; msg.innerHTML = `✓ ${esc(t('Preventivo salvato'))}: <span data-no-i18n>${esc(nome)}</span>`;
      setTimeout(chiudi, 900);
    } catch (e) { msg.hidden = false; msg.className = 'ngp-msg ngp-err'; msg.textContent = e.message || t('Salvataggio non riuscito.'); }
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fai(!cor); });
  box.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.s;
    if (s === 'annulla') return chiudi();
    fai(s === 'nuovo');
  }));
}

/** Finestra "I miei preventivi": cerca, apri, duplica, rinomina, elimina, copia su file. */
async function finestraElenco(filtro = '') {
  const lista = await elencoPreventivi();
  const aperto = tipoPagina ? correnteId(tipoPagina) : null;
  const box = apriFinestra(`
    <h2>📂 ${t('I miei preventivi')}</h2>
    <input type="search" id="ngp-cerca" placeholder="${t('Cerca per nome…')}" value="${esc(filtro)}">
    <div class="ngp-lista" id="ngp-lista"></div>
    <div class="ngp-piede">
      <button type="button" class="ngp-file" id="ngp-scarica">⬇ ${t('Scarica copia di tutti')}</button>
      <label class="ngp-file">⬆ ${t('Importa da file')}<input type="file" id="ngp-importa" accept=".json,application/json"></label>
      <button type="button" class="ngp-file" id="ngp-chiudi" style="margin-left:auto">${t('Chiudi')}</button>
    </div>
    <div class="ngp-nota">${t('I preventivi sono salvati in questo dispositivo, in questo browser. Scarica ogni tanto una copia: con Importa li rimetti o li passi su un altro dispositivo.')}</div>
    <div class="ngp-msg" id="ngp-msg" hidden></div>`);
  const cont = box.querySelector('#ngp-lista'), cerca = box.querySelector('#ngp-cerca'), msg = box.querySelector('#ngp-msg');
  const avviso = (testo, err = false, nome = null) => { msg.hidden = false; msg.className = err ? 'ngp-msg ngp-err' : 'ngp-msg'; msg.innerHTML = esc(testo) + (nome != null ? `: <span data-no-i18n>${esc(nome)}</span>` : ''); };
  const disegna = () => {
    const q = cerca.value.trim().toLowerCase();
    const vis = lista.filter((p) => !q || String(p.nome).toLowerCase().includes(q));
    cont.innerHTML = vis.length ? vis.map((p) => `
      <div class="ngp-item ${p.id === aperto ? 'ngp-aperto' : ''}" data-id="${esc(p.id)}">
        <div class="ngp-nome">${TIPI[p.tipo]?.ico || ''} <span data-no-i18n>${esc(p.nome)}</span></div>
        <div class="ngp-info">${t(TIPI[p.tipo]?.nome || p.tipo)} · ${t('salvato')} ${data(p.aggiornato)}${p.id === aperto ? ` · <strong>${t('aperto ora')}</strong>` : ''}</div>
        <div class="ngp-azioni">
          <button type="button" class="ngp-apri" data-a="apri">${t('Apri')}</button>
          <button type="button" data-a="duplica">${t('Duplica')}</button>
          <button type="button" data-a="rinomina">${t('Rinomina')}</button>
          <button type="button" class="ngp-del" data-a="elimina">${t('Elimina')}</button>
        </div>
      </div>`).join('')
      : `<div class="ngp-vuoto">${lista.length ? t('Nessun preventivo con questo nome.') : t('Nessun preventivo salvato. Usa «💾 Salva» per salvare il progetto aperto con un nome.')}</div>`;
  };
  disegna();
  cerca.addEventListener('input', disegna);
  cont.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id, p = lista.find((x) => x.id === id); if (!p) return;
    const a = b.dataset.a;
    if (a === 'apri') {
      if (tipoPagina && p.tipo === tipoPagina && aperto !== p.id && !confirm(t('Aprire questo preventivo? Il progetto aperto ora verrà sostituito (se non l\'hai salvato, salvalo prima).'))) return;
      return apri(p.id);
    }
    if (a === 'duplica') {
      const c = { ...p, id: nuovoId(), nome: `${p.nome} (${t('copia')})`, creato: Date.now(), aggiornato: Date.now() };
      await scriviPreventivo(c); lista.unshift(c); disegna(); avviso(`✓ ${t('Duplicato')}`, false, c.nome); return;
    }
    if (a === 'rinomina') {
      const n = prompt(t('Nuovo nome del preventivo:'), p.nome);
      if (n == null || !n.trim()) return;
      p.nome = n.trim(); p.aggiornato = Date.now(); await scriviPreventivo(p); disegna(); return;
    }
    if (a === 'elimina') {
      if (!confirm(`${t('Eliminare il preventivo')} «${p.nome}»? ${t('Non si può annullare.')}`)) return;
      await togliPreventivo(p.id);
      if (p.id === aperto) impostaCorrente(p.tipo, null);
      lista.splice(lista.indexOf(p), 1); disegna(); avviso(`✓ ${t('Eliminato')}`, false, p.nome);
    }
  });
  box.querySelector('#ngp-chiudi').addEventListener('click', chiudi);
  box.querySelector('#ngp-scarica').addEventListener('click', async () => {
    const n = await scaricaCopia();
    avviso(n ? `✓ ${t('Copia scaricata')} (${n})` : t('Non ci sono preventivi da scaricare.'), !n);
  });
  box.querySelector('#ngp-importa').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const n = await importaFile(f); finestraElenco(cerca.value).then(() => {}); setTimeout(() => { const m = fondo.querySelector('#ngp-msg'); if (m) { m.hidden = false; m.className = 'ngp-msg'; m.textContent = `✓ ${t('Preventivi importati')}: ${n}`; } }, 50); }
    catch (err) { avviso(err.message || t('Importazione non riuscita.'), true); }
  });
}

// --------------------------------------------------------------- pulsanti nell'intestazione
function monta() {
  if (!tipoPagina) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const posto = document.querySelector('.header-strumenti');
  if (!posto) return;
  const bSalva = document.createElement('button');
  bSalva.type = 'button'; bSalva.className = 'ngp-btn'; bSalva.id = 'ngp-salva'; bSalva.title = 'Salva preventivo';
  bSalva.innerHTML = '<span aria-hidden="true">💾</span><span class="ngp-txt">Salva</span>';
  const bElenco = document.createElement('button');
  bElenco.type = 'button'; bElenco.className = 'ngp-btn'; bElenco.id = 'ngp-elenco'; bElenco.title = 'I miei preventivi';
  bElenco.innerHTML = '<span aria-hidden="true">📂</span><span class="ngp-txt">Preventivi</span>';
  posto.insertBefore(bElenco, posto.firstChild);
  posto.insertBefore(bSalva, posto.firstChild);
  bSalva.addEventListener('click', finestraSalva);
  bElenco.addEventListener('click', () => finestraElenco());
  // "Reset" del configuratore: il progetto nuovo non è più quello del preventivo aperto
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#btn-reset')) return;
    const prima = localStorage.getItem(TIPI[tipoPagina].chiave);
    setTimeout(() => { if (localStorage.getItem(TIPI[tipoPagina].chiave) !== prima) impostaCorrente(tipoPagina, null); }, 400);
  }, true);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
else monta();
