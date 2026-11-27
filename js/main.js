// =============================================================================
// MAIN — orchestratore
// =============================================================================
// Collega pannello parametri, scena 3D, tabella distinta e pulsanti export.
// Qui dentro non ci sono formule: solo "chi chiama chi".
// =============================================================================

import { calcolaDistintaCompleta, validaConfig, cassettiereSenzaSporgenza } from './calcoli.js?v=20261127o';
import {
  inizializzaScena, aggiornaScena, impostaApertura, forzaResize, esportaImmagine, impostaSfondo, fotoRealisticaArmadio,
  iniziaSpostamentoRipiano, muoviSpostamentoRipiano, fineSpostamentoRipiano,
  toccoArmadio, ripianiCorrenti, posizioneNuovoRipiano, evidenziaRipiano,
} from './scena3d.js?v=20261127o';
import { SFONDI_LISTA } from './sfondi.js?v=20261127o';
import { htmlAvvisoMancanti, confermaEsportazione, htmlAvvisoSporgenza, confermaSporgenzaManiglia } from './avviso-parametri.js?v=20261127o';
import { daImpostare } from './parametri.js?v=20261127o';
import { PAVIMENTI, GRUPPI_PAVIMENTI } from './pavimenti-dati.js?v=20261127o';
import { agganciaTema } from './tema.js?v=20261127o';
import { renderPannello as disegnaPannelloArmadio, configDefault, adattaModuli, applicaMontaggioTipo } from './interfaccia.js?v=20261127o';
import { tendinePannello } from './tendine-pannello.js?v=20261127o';
import { renderDistinta } from './distinta.js?v=20261127o';
import { esportaCSV, esportaPDF, nomeMaterialeCsv } from './esportazione.js?v=20261127o';
// export Excel (con lo zip, ~115 KB): si scarica dopo l'apertura, quando la pagina è ferma
const _excel = () => import('./modello-export.js?v=20261127o');
const esportaExcel = (...a) => _excel().then((m) => m.esportaExcel(...a));
const apriModelloExcel = (...a) => _excel().then((m) => m.apriModelloExcel(...a));
(window.requestIdleCallback || ((f) => setTimeout(f, 4000)))(() => _excel().catch(() => {}), { timeout: 8000 });
import {
  salvaLocale, caricaLocale, esportaJSON, importaJSONFile,
} from './storage.js?v=20261127o';

// PANNELLO ORDINATO: ogni sezione è una tendina (chiusa, si apre toccando il titolo);
// la prima volta aperte solo Tipo armadio e Dimensioni. Poi resta come la lasci.
function renderPannello(cont, cfg, cb) {
  disegnaPannelloArmadio(cont, cfg, cb);
  tendinePannello(cont, 'armadio', { aperte: [] });          // all'apertura tutte chiuse
}

// TIPO DELLA PAGINA: ?tipo=scorrevole = armadio scorrevole, altrimenti a battente. Ognuno ha il suo
// lavoro salvato a parte (colori, misure… di uno non cambiano l'altro).
const TIPO_PAGINA = (() => { try { return new URLSearchParams(location.search).get('tipo') === 'scorrevole' ? 'scorrevole' : 'battente'; } catch (_) { return 'battente'; } })();
// Config iniziale: l'ultima salvata di questo tipo, oppure quella di partenza
let config = adattaModuli(caricaLocale(TIPO_PAGINA) || configDefault());   // moduli sempre larghi quanto il totale
if (config.tipoArmadio !== TIPO_PAGINA) {
  config.tipoArmadio = TIPO_PAGINA;
  applicaMontaggioTipo(config);        // struttura e schiena di quel tipo (⚙ Parametri → Armadi)
}

const canvas = document.getElementById('canvas3d');
const pannello = document.getElementById('pannello');
const distintaEl = document.getElementById('distinta');
const avvisiEl = document.getElementById('avvisi');
const btnToggleAnte = document.getElementById('toggle-ante');

agganciaTendinaDistinta();          // prima del 3D: la tela ha già la sua misura giusta
inizializzaScena(canvas);
agganciaSfondo();

// DISTINTA PEZZI a TENDINA: chiusa all'inizio (più spazio al 3D), si apre col bottone
// «📋 Distinta pezzi». La scelta resta su questo dispositivo.
function agganciaTendinaDistinta() {
  const app = document.querySelector('.app');
  if (!app || document.getElementById('distinta-tab')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'distinta-tab'; b.className = 'distinta-tab';
  app.insertBefore(b, distintaEl);
  const CH = 'ng-distinta-aperta';
  let aperta = false;
  try { aperta = localStorage.getItem(CH) === '1'; } catch (_) { /* chiusa */ }
  const imposta = (ap) => {
    aperta = ap;
    app.classList.toggle('distinta-chiusa', !ap);
    b.innerHTML = ap ? '✕ <span>Chiudi distinta</span>' : '📋 <span>Distinta pezzi</span>';
    b.setAttribute('aria-expanded', String(ap));
    try { localStorage.setItem(CH, ap ? '1' : '0'); } catch (_) { /* va bene */ }
    requestAnimationFrame(() => { try { forzaResize(canvas); } catch (_) { /* il 3D non è ancora partito */ } });
  };
  b.addEventListener('click', () => { imposta(!aperta); if (aperta) distintaEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  imposta(aperta);
}
agganciaTema();

// Selettore sfondo 3D (chiaro / neutro / scuro) e, sotto, il PAVIMENTO: un tasto «Pavimento» che apre
// la tendina con tutti i pavimenti (miniature: legni, marmi e pietre, gres, quelli del cliente).
function escP(x) { return String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function agganciaSfondo() {
  const cont = document.getElementById('sfondo-3d');
  if (!cont) return;
  const attuale = config.sfondo || 'chiaro';
  cont.innerHTML = SFONDI_LISTA.map((s) => `<button type="button" class="sfondo-btn ${s.id === attuale ? 'on' : ''}"
    data-sfondo="${s.id}" title="Sfondo ${s.nome}" style="background:${s.css}"></button>`).join('');
  cont.querySelectorAll('.sfondo-btn').forEach((b) => b.addEventListener('click', () => {
    config.sfondo = b.dataset.sfondo;
    impostaSfondo(config.sfondo, config.pavimento || null);
    cont.querySelectorAll('.sfondo-btn').forEach((x) => x.classList.toggle('on', x === b));
    try { salvaLocale(config); } catch (_) { /* no-op */ }
  }));
  disegnaPavimento(false);
  impostaSfondo(attuale, config.pavimento || null);
}
function miniPav(p) { return p.thumb || `materials/pavimenti/miniature/${p.id}.jpg`; }
function disegnaPavimento(aperta) {
  const box = document.getElementById('pav-3d');
  if (!box) return;
  const sel = config.pavimento || '', voce = PAVIMENTI.find((p) => p.id === sel);
  box.innerHTML = `<button type="button" class="pav-btn" aria-expanded="${aperta}">
      <span class="pav-mini" ${voce ? `style="background-image:url('${miniPav(voce)}')"` : ''}></span>
      <span class="pav-testi"><b>Pavimento</b><small ${voce && voce.proprio ? 'data-no-i18n' : ''}>${escP(voce ? voce.nome.split(' · ')[0] : 'Automatico')}</small></span>
      <span class="pav-freccia">${aperta ? '▴' : '▾'}</span></button>
    ${aperta ? `<div class="pav-lista" role="listbox">
      <button type="button" class="pav-voce ${sel ? '' : 'on'}" data-pav=""><span class="pav-mini pav-auto">A</span><span>Pavimento automatico</span></button>
      ${GRUPPI_PAVIMENTI.map((g) => `<div class="pav-gruppo">${escP(g)}</div><div class="pav-griglia">${PAVIMENTI.filter((p) => p.gruppo === g).map((p) => `
        <button type="button" class="pav-voce ${p.id === sel ? 'on' : ''}" data-pav="${p.id}" title="${escP(p.nome)}">
          <span class="pav-mini" style="background-image:url('${miniPav(p)}')"></span><span ${p.proprio ? 'data-no-i18n' : ''}>${escP(p.nome.split(' · ')[0])}</span></button>`).join('')}</div>`).join('')}
    </div>` : ''}`;
  box.querySelector('.pav-btn').addEventListener('click', (e) => { e.stopPropagation(); disegnaPavimento(!aperta); });
  box.querySelectorAll('[data-pav]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    config.pavimento = b.dataset.pav || null;
    impostaSfondo(config.sfondo || 'chiaro', config.pavimento);
    try { salvaLocale(config); } catch (_) { /* no-op */ }
    disegnaPavimento(false);
  }));
}
// tocco fuori dalla tendina: si chiude
document.addEventListener('click', (e) => {
  const box = document.getElementById('pav-3d');
  if (box && box.querySelector('.pav-lista') && !box.contains(e.target)) disegnaPavimento(false);
});

function onChange(nuovaConfig, opzioni = {}) {
  config = nuovaConfig;
  // Se è un cambio "pesante" (es. reset) ri-renderizza l'intero pannello
  if (opzioni.reset) {
    renderPannello(pannello, config, onChange);
    agganciaAzioniGlobali();
  }
  aggiorna();
}

function aggiorna() {
  adattaModuli(config);                    // niente spazio vuoto dentro i tamponamenti
  const distinta = calcolaDistintaCompleta(config);
  aggiornaScena(config);
  renderDistinta(distintaEl, distinta, config);
  // impostazioni saltate che servono a questo armadio: avviso sopra la distinta
  const av = htmlAvvisoMancanti(mancantiArmadio()) + htmlAvvisoSporgenza(cassettiereSenzaSporgenza(config));
  if (av) distintaEl.querySelector('.distinta-head')?.insertAdjacentHTML('afterend', av);
  agganciaExport(distinta);
  mostraAvvisi();
  aggiornaHeader();
  salvaLocale(config); // autosalvataggio in locale
  if (typeof segnaStoria === 'function') segnaStoria();   // Ctrl+Z
  if (typeof aggiornaHintRipiani === 'function') aggiornaHintRipiani();
}

function aggiornaHeader() {
  const el = document.getElementById('header-info');
  if (!el) return;
  const tipo = config.tipoArmadio === 'scorrevole'
    ? 'Armadio scorrevole' : 'Armadio a battente';
  el.textContent = `${tipo} — v1.1`;
}

function mostraAvvisi() {
  const err = validaConfig(config);
  avvisiEl.innerHTML = err.length
    ? `<div class="avviso err">⚠︎ ${err.join(' · ')}</div>`
    : '';
}

/** Impostazioni saltate («lo imposto dopo») che servono a QUESTO armadio: lo scorrevole usa struttura e binario. */
function mancantiArmadio() {
  return config.tipoArmadio === 'scorrevole' ? daImpostare().filter((g) => g === 'scorrevoli' || g === 'binario') : [];
}
/** Esporta solo dopo il «sì» se mancano delle impostazioni. */
const seCompleta = (fn) => async () => {
  if (!(await confermaEsportazione(mancantiArmadio()))) return;
  if (!(await confermaSporgenzaManiglia(cassettiereSenzaSporgenza(config)))) return;   // maniglia senza sporgenza
  fn();
};
function agganciaExport(distinta) {
  const btnCsv = document.getElementById('btn-csv');
  const btnPdf = document.getElementById('btn-pdf');
  if (btnCsv) btnCsv.onclick = seCompleta(() => esportaCSV(distinta, config.meta, config));
  if (btnPdf) btnPdf.onclick = seCompleta(() => esportaPDF(distinta, config, config.meta));
  // Excel con il modello del programma di taglio (vedi modello-export.js)
  const pezziModello = () => distinta.pezzi.map((p) => ({
    nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore, quantita: p.quantita,
    materiale: nomeMaterialeCsv(p, config), modulo: p.modulo || '', gruppo: '' }));
  const progettoNome = (config.meta && config.meta.cliente) || 'Armadio';
  const btnXlsx = document.getElementById('btn-xlsx');
  if (btnXlsx) btnXlsx.onclick = seCompleta(() => {
    const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
    esportaExcel(pezziModello(), { nomeFile: `NG_${progettoNome}_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`, progetto: progettoNome });
  });
  const btnMod = document.getElementById('btn-modello');
  if (btnMod) btnMod.onclick = seCompleta(() => apriModelloExcel({ pezzi: pezziModello(), progetto: progettoNome }));
  const btnFoto = document.getElementById('btn-foto-reale');
  if (btnFoto) btnFoto.onclick = async () => {
    const { apriFotoRealistica } = await import('./foto-dialogo.js?v=20261127o');
    apriFotoRealistica({ calcola: (p) => fotoRealisticaArmadio(p), tela3d: document.getElementById('canvas3d'), nome: 'armadio' });
  };
  const btnImg = document.getElementById('btn-img');
  if (btnImg) btnImg.onclick = () => {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    const nome = `armadio-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`;
    if (!esportaImmagine(nome)) flash('Impossibile salvare l\'immagine.', true);
  };
}

function agganciaAzioniGlobali() {
  document.getElementById('btn-salva').onclick = () => {
    if (salvaLocale(config)) flash('Configurazione salvata in locale.');
    else flash('Salvataggio fallito.', true);
  };
  document.getElementById('btn-export-json').onclick = () =>
    esportaJSON(config, config.meta);
  document.getElementById('file-import').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const nuova = await importaJSONFile(f);
      config = { ...configDefault(), ...nuova };
      // un armadio dell'altro tipo va nella sua pagina (battente / scorrevole sono lavori separati)
      if ((config.tipoArmadio === 'scorrevole' ? 'scorrevole' : 'battente') !== TIPO_PAGINA) {
        salvaLocale(config);
        location.href = `configuratore.html?tipo=${config.tipoArmadio === 'scorrevole' ? 'scorrevole' : 'battente'}`;
        return;
      }
      renderPannello(pannello, config, onChange);
      agganciaAzioniGlobali();
      aggiorna();
      flash('Configurazione importata.');
    } catch (err) {
      flash('Importazione fallita: ' + err.message, true);
    }
  };
}

function flash(msg, errore = false) {
  avvisiEl.innerHTML = `<div class="avviso ${errore ? 'err' : 'ok'}">${msg}</div>`;
  setTimeout(() => mostraAvvisi(), 2500);
}

// Apri / chiudi porte: il tasto nella vista 3D (sotto sfondo e pavimento); lo stato resta nella
// casella nascosta #toggle-ante che usano anche i ripiani spostabili.
const btnFabApri = document.getElementById('toggle-ante-mobile');
function aggiornaFab(aperte) {
  if (!btnFabApri) return;
  btnFabApri.classList.toggle('on', aperte);
  btnFabApri.textContent = aperte ? 'Chiudi porte' : 'Apri porte';
}
btnToggleAnte.addEventListener('change', (e) => {
  impostaApertura(e.target.checked);
  aggiornaFab(e.target.checked);
});
if (btnFabApri) {
  btnFabApri.addEventListener('click', () => {
    delete document.body.dataset.portePerCassettiera;   // porte aperte a mano: l'aiuto dei ripiani torna
    const nuovo = !btnToggleAnte.checked;
    btnToggleAnte.checked = nuovo;
    impostaApertura(nuovo);
    aggiornaFab(nuovo);
  });
}

// RIPIANI SPOSTABILI: a porte aperte si trascina un ripiano su e giù; la
// posizione resta salvata nel modulo (ripianiY). "Ripiani automatici" le toglie.
const hintRip = document.getElementById('ripiani-hint');
const misuraRip = document.getElementById('ripiano-misura');
function aggiornaHintRipiani() {
  if (!hintRip) return;
  const conRipiani = (config.moduli || []).some((m) => m.ripiani > 0 || m.barra);
  // porte aperte da sole per far vedere la cassettiera: l'aiuto dei ripiani la coprirebbe
  hintRip.hidden = !(btnToggleAnte.checked && conRipiani) || document.body.dataset.portePerCassettiera === '1';
}
btnToggleAnte.addEventListener('change', aggiornaHintRipiani);
btnToggleAnte.addEventListener('change', () => { if (!btnToggleAnte.checked) chiudiAzioniRipiano(); });
if (btnFabApri) btnFabApri.addEventListener('click', aggiornaHintRipiani);
document.getElementById('ripiani-auto')?.addEventListener('click', () => {
  (config.moduli || []).forEach((m) => { delete m.ripianiY; delete m.barraY; });
  aggiorna();
  flash('Ripiani rimessi alla stessa distanza.');
});
let trascinoRipiano = false;
const cm = (mm) => `${String(Math.round(mm / 10 * 10) / 10).replace('.', ',')} cm`;
function mostraMisura(e, mis) {
  if (!misuraRip || !mis) return;
  const r = canvas.getBoundingClientRect();
  const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  misuraRip.innerHTML = `${t('Da terra')}: <b>${cm(mis.daTerra)}</b><br>↑ ${t('spazio sopra')}: ${cm(mis.sopra)}<br>↓ ${t('spazio sotto')}: ${cm(mis.sotto)}`;
  misuraRip.style.left = `${e.clientX - r.left}px`; misuraRip.style.top = `${e.clientY - r.top}px`;
  misuraRip.hidden = false;
}
let inizioTocco = null;                // per capire se è un tocco (non un trascinamento)
canvas.addEventListener('pointerdown', (e) => {
  inizioTocco = { x: e.clientX, y: e.clientY };
  if (e.button > 0 || !iniziaSpostamentoRipiano(e.clientX, e.clientY)) return;
  trascinoRipiano = true;
  e.stopImmediatePropagation(); e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
  mostraMisura(e, muoviSpostamentoRipiano(e.clientX, e.clientY));
}, true);
canvas.addEventListener('pointermove', (e) => {
  if (!trascinoRipiano) return;
  e.stopImmediatePropagation();
  mostraMisura(e, muoviSpostamentoRipiano(e.clientX, e.clientY));
}, true);
const fineRipiano = (e) => {
  if (!trascinoRipiano) return;
  trascinoRipiano = false;
  if (e) e.stopImmediatePropagation();
  if (misuraRip) misuraRip.hidden = true;
  const r = fineSpostamentoRipiano();
  if (!r || !config.moduli[r.modulo]) return;
  // solo un TOCCO (senza muovere): seleziono il ripiano, niente da salvare
  if (e && inizioTocco && Math.hypot(e.clientX - inizioTocco.x, e.clientY - inizioTocco.y) < 6) {
    toccoRipiano(e);             // ripiano o perchero: lo seleziono
    return;
  }
  chiudiAzioniRipiano();
  if (r.barraY != null) config.moduli[r.modulo].barraY = r.barraY;   // perchero spostato
  else config.moduli[r.modulo].ripianiY = r.ripianiY;
  salvaLocale(config);           // niente ricostruzione: la vista resta dov'è
  segnaStoria();                 // si può annullare (Ctrl+Z)
};
canvas.addEventListener('pointerup', fineRipiano, true);
// tocco su un altro punto dell'armadio (non un ripiano): incolla lì, o chiudi la selezione
canvas.addEventListener('pointerup', (e) => {
  if (trascinoRipiano || !inizioTocco || Math.hypot(e.clientX - inizioTocco.x, e.clientY - inizioTocco.y) >= 6) return;
  const t = toccoArmadio(e.clientX, e.clientY);
  if (t && t.tipo === 'modulo') puntoToccato = t;          // dove incollare con Ctrl+V
  // perchero copiato: si incolla in qualsiasi modulo
  if (t && t.tipo === 'modulo' && copiato === 'perchero' && percheroCopiato) { mostraAzioniRipiano(e, { incollaIn: t }); return; }
  // si incolla solo nello STESSO modulo da cui l'hai copiato (stessa misura di ripiano)
  if (t && t.tipo === 'modulo' && copiato === 'ripiano' && ripianoCopiato && ripianoCopiato.modulo === t.modulo) mostraAzioniRipiano(e, { incollaIn: t });
  else {
    chiudiAzioniRipiano();
    if (t && t.tipo === 'modulo' && copiato === 'ripiano' && ripianoCopiato) flash(tt('Il ripiano copiato si incolla nello stesso modulo: tocca un punto del Modulo {0}.').replace('{0}', ripianoCopiato.modulo + 1));
  }
});

// ---------------------------------------------------------------------------
// RIPIANI: tocca un ripiano (a porte aperte) → Elimina / Copia / Incolla.
// Tutto finisce subito anche nella distinta (nº ripiani del modulo).
// ---------------------------------------------------------------------------
let ripianoSel = null;          // { modulo, indice } · indice 'perchero' = il perchero del modulo
let ripianoCopiato = null;      // { modulo } (il ripiano copiato)
let percheroCopiato = null;     // { barra } (finitura del perchero copiato)
let copiato = null;             // l'ultima cosa copiata: 'ripiano' | 'perchero'
let puntoToccato = null;        // l'ultimo punto toccato in un modulo (per Ctrl+V)
const azioniRip = document.createElement('div');
azioniRip.className = 'ripiano-azioni'; azioniRip.hidden = true;
(misuraRip?.parentNode || canvas.parentNode).appendChild(azioniRip);
const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
function toccoRipiano(e) {
  const t = toccoArmadio(e.clientX, e.clientY);
  if (!t || (t.tipo !== 'ripiano' && t.tipo !== 'perchero')) { chiudiAzioniRipiano(); return; }
  ripianoSel = { modulo: t.modulo, indice: t.tipo === 'perchero' ? 'perchero' : t.indice };
  evidenziaRipiano(t.modulo, ripianoSel.indice);
  mostraAzioniRipiano(e, {});
}
function mostraAzioniRipiano(e, { incollaIn = null }) {
  const r = canvas.getBoundingClientRect();
  const perch = !incollaIn && ripianoSel && ripianoSel.indice === 'perchero';
  if (incollaIn) {
    ripianoSel = null; evidenziaRipiano(null);
    azioniRip.innerHTML = `<button type="button" data-az="incolla-qui">📋 ${tt('Incolla qui')} · ${tt(copiato === 'perchero' ? 'Perchero' : 'Ripiano')} · ${tt('Modulo')} ${incollaIn.modulo + 1}</button><button type="button" data-az="chiudi" title="${tt('Chiudi')}">✕</button>`;
  } else if (perch) {
    azioniRip.innerHTML = `<span>${tt('Perchero')} · ${tt('Modulo')} ${ripianoSel.modulo + 1}</span>
      <button type="button" data-az="elimina">🗑 ${tt('Elimina')}</button>
      <button type="button" data-az="copia">⧉ ${tt('Copia')}</button>
      <button type="button" data-az="chiudi" title="${tt('Chiudi')}">✕</button>`;
  } else {
    azioniRip.innerHTML = `<span>${tt('Ripiano')} · ${tt('Modulo')} ${ripianoSel.modulo + 1}</span>
      <button type="button" data-az="elimina">🗑 ${tt('Elimina')}</button>
      <button type="button" data-az="copia">⧉ ${tt('Copia')}</button>
      ${copiato === 'ripiano' && ripianoCopiato && ripianoCopiato.modulo === ripianoSel.modulo ? `<button type="button" data-az="incolla">📋 ${tt('Incolla')}</button>` : ''}
      <button type="button" data-az="chiudi" title="${tt('Chiudi')}">✕</button>`;
  }
  azioniRip.style.left = `${Math.min(r.width - 20, Math.max(10, e.clientX - r.left))}px`;
  azioniRip.style.top = `${Math.max(10, e.clientY - r.top - 12)}px`;
  azioniRip.hidden = false;
  azioniRip.onclick = (ev) => {
    const az = ev.target.closest('[data-az]')?.dataset.az; if (!az) return;
    ev.stopPropagation();
    if (az === 'chiudi') return chiudiAzioniRipiano();
    if (az === 'elimina') return perch ? eliminaPerchero() : eliminaRipiano();
    if (az === 'copia') return copiaSelezione();
    if (az === 'incolla') return incollaRipiano(ripianoSel.modulo, null);
    if (az === 'incolla-qui') return copiato === 'perchero' ? incollaPerchero(incollaIn.modulo) : incollaRipiano(incollaIn.modulo, incollaIn.y);
  };
}
/** COPIA il ripiano o il perchero selezionato (bottone Copia o Ctrl+C). false = niente di selezionato. */
function copiaSelezione() {
  const s = ripianoSel; if (!s) return false;
  if (s.indice === 'perchero') {
    const mod = config.moduli[s.modulo]; if (!mod || !mod.barra) return false;
    percheroCopiato = { barra: mod.barra }; copiato = 'perchero';
    chiudiAzioniRipiano();
    flash(tt('Perchero copiato: tocca il modulo dove metterlo, oppure Ctrl+V.'));
    return true;
  }
  ripianoCopiato = { modulo: s.modulo }; copiato = 'ripiano';
  chiudiAzioniRipiano();
  flash(tt('Ripiano copiato: tocca nello stesso modulo il punto dove incollarlo, oppure premi Incolla su un suo ripiano.'));
  return true;
}
/** INCOLLA con Ctrl+V: nel modulo selezionato o toccato per ultimo (il ripiano solo nel suo modulo). */
function incollaDaTastiera() {
  if (copiato === 'perchero' && percheroCopiato) {
    const k = ripianoSel ? ripianoSel.modulo : puntoToccato ? puntoToccato.modulo : null;
    if (k == null || !config.moduli[k]) { flash(tt('Tocca il modulo dove mettere il perchero, poi Ctrl+V.'), true); return true; }
    incollaPerchero(k); return true;
  }
  if (copiato === 'ripiano' && ripianoCopiato) {
    const k = ripianoCopiato.modulo;
    const y = puntoToccato && puntoToccato.modulo === k ? puntoToccato.y : null;
    incollaRipiano(k, y); return true;
  }
  return false;
}
function incollaPerchero(k) {
  const mod = config.moduli[k]; if (!mod || !percheroCopiato) return;
  if (mod.barra) { chiudiAzioniRipiano(); flash(tt('Il Modulo {0} ha già il perchero.').replace('{0}', k + 1), true); return; }
  mod.barra = percheroCopiato.barra; delete mod.barraY;              // al suo posto: 6 cm sotto il ripiano più alto
  chiudiAzioniRipiano();
  aggiornaTutto();
  flash(tt('Perchero incollato (aggiunto anche alla distinta).'));
}
function eliminaPerchero() {
  const s = ripianoSel; if (!s) return;
  const mod = config.moduli[s.modulo]; if (!mod) return;
  delete mod.barra; delete mod.barraY;
  chiudiAzioniRipiano();
  aggiornaTutto();
  flash(tt('Perchero eliminato (anche dalla distinta).'));
}
function chiudiAzioniRipiano() {
  azioniRip.hidden = true; ripianoSel = null; evidenziaRipiano(null);
}
/** Dopo un cambio dei ripiani: scena, distinta e pannello (nº ripiani del modulo). */
function aggiornaTutto() {
  renderPannello(pannello, config, onChange);
  agganciaAzioniGlobali();
  aggiorna();
}
function eliminaRipiano() {
  const s = ripianoSel; if (!s) return;
  const mod = config.moduli[s.modulo]; if (!mod) return;
  const ys = ripianiCorrenti(s.modulo);
  ys.splice(s.indice, 1);
  mod.ripiani = Math.max(0, (mod.ripiani || 0) - 1);
  if (mod.ripiani > 0) mod.ripianiY = ys; else delete mod.ripianiY;   // gli altri restano dove sono
  chiudiAzioniRipiano();
  aggiornaTutto();
  flash(tt('Ripiano eliminato (anche dalla distinta).'));
}
function incollaRipiano(k, yVoluto) {
  const mod = config.moduli[k]; if (!mod) return;
  const y = posizioneNuovoRipiano(k, yVoluto);
  if (y == null) { flash(tt('In questo modulo non c\'è spazio per un altro ripiano.'), true); return; }
  mod.ripianiY = [...ripianiCorrenti(k), y].sort((a, b) => a - b);
  mod.ripiani = mod.ripianiY.length;
  chiudiAzioniRipiano();
  aggiornaTutto();
  flash(tt('Ripiano incollato (aggiunto anche alla distinta).'));
}
canvas.addEventListener('pointercancel', fineRipiano, true);

// ---------------------------------------------------------------------------
// ANNULLA / RIFAI (Ctrl+Z · Ctrl+Y o Ctrl+Shift+Z) e COPIA / INCOLLA (Ctrl+C · Ctrl+V)
// Una foto dell'armadio a ogni modifica; mentre si scrive un numero le modifiche di seguito sono un passo solo.
// ---------------------------------------------------------------------------
const passato = [], futuro = [];
let ultimaFoto = null, tFoto = 0;
function segnaStoria() {
  const ora = JSON.stringify(config);
  if (ultimaFoto === null) { ultimaFoto = ora; return; }
  if (ora === ultimaFoto) return;
  const t = Date.now(), ae = document.activeElement;
  const scrivendo = ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(ae.type)));
  if (!scrivendo || t - tFoto > 800 || !passato.length) { passato.push(ultimaFoto); if (passato.length > 80) passato.shift(); }
  futuro.length = 0;
  ultimaFoto = ora; tFoto = t;
}
function applicaFoto(foto) {
  const s = JSON.parse(foto);
  for (const k of Object.keys(config)) delete config[k];
  Object.assign(config, s);                 // stesso oggetto: chi lo tiene vede subito l'armadio di prima
  ultimaFoto = foto; tFoto = 0;
  chiudiAzioniRipiano();
  renderPannello(pannello, config, onChange);
  agganciaAzioniGlobali();
  aggiorna();                               // la vista 3D resta dov'è
}
function annullaArmadio() {
  if (!passato.length) { flash(tt('Niente da annullare.')); return; }
  futuro.push(ultimaFoto); applicaFoto(passato.pop());
  flash(tt('Annullato (Ctrl+Y per rifare).'));
}
function rifaiArmadio() {
  if (!futuro.length) { flash(tt('Niente da rifare.')); return; }
  passato.push(ultimaFoto); applicaFoto(futuro.pop());
  flash(tt('Rifatto.'));
}
document.addEventListener('keydown', (e) => {
  const t = e.target, tag = (t && t.tagName || '').toLowerCase();
  // nei campi dove si scrive valgono annulla / copia / incolla del campo stesso
  if (tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)
    || (tag === 'input' && !['checkbox', 'radio', 'button'].includes(t.type))) return;
  if (document.querySelector('dialog[open], .modale:not([hidden]), .modal:not([hidden])')) return;
  const ctrl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
  if (!ctrl) { if (k === 'escape' && !azioniRip.hidden) chiudiAzioniRipiano(); return; }
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); annullaArmadio(); return; }
  if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); rifaiArmadio(); return; }
  // copia / incolla solo quando c'è qualcosa selezionato o copiato nel 3D (sennò resta il copia del testo)
  if (k === 'c' && ripianoSel && !(window.getSelection && String(window.getSelection()))) { if (copiaSelezione()) e.preventDefault(); return; }
  if (k === 'v' && copiato) { if (incollaDaTastiera()) e.preventDefault(); }
});

// Montaggio iniziale
renderPannello(pannello, config, onChange);
agganciaAzioniGlobali();
aggiorna();

// Resize canvas quando cambia la finestra
window.addEventListener('resize', () => forzaResize(canvas));

// Resize manuale del pannello Distinta (trascinando la maniglia).
// Salva la larghezza scelta in localStorage.
(() => {
  const resizer = document.getElementById('distinta-resizer');
  const app = document.querySelector('.app');
  if (!resizer || !app) return;
  const CHIAVE = 'ng-distinta-width';
  const salvata = Number(localStorage.getItem(CHIAVE) || 0);
  if (salvata >= 300 && salvata <= 900) {
    app.style.setProperty('--distinta-w', salvata + 'px');
  }
  let trascino = false;
  resizer.addEventListener('mousedown', (e) => {
    trascino = true;
    resizer.classList.add('on');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!trascino) return;
    // La distinta sta sul lato destro; larghezza = distanza da bordo destro
    const w = Math.max(300, Math.min(900, window.innerWidth - e.clientX));
    app.style.setProperty('--distinta-w', w + 'px');
    forzaResize(canvas);
  });
  document.addEventListener('mouseup', () => {
    if (!trascino) return;
    trascino = false;
    resizer.classList.remove('on');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Salva la larghezza scelta
    const w = app.style.getPropertyValue('--distinta-w') || '500px';
    localStorage.setItem(CHIAVE, parseInt(w, 10));
  });
})();
