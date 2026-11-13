// =============================================================================
// MAIN — orchestratore
// =============================================================================
// Collega pannello parametri, scena 3D, tabella distinta e pulsanti export.
// Qui dentro non ci sono formule: solo "chi chiama chi".
// =============================================================================

import { calcolaDistintaCompleta, validaConfig } from './calcoli.js?v=20261113y';
import {
  inizializzaScena, aggiornaScena, impostaApertura, forzaResize, esportaImmagine, impostaSfondo,
  iniziaSpostamentoRipiano, muoviSpostamentoRipiano, fineSpostamentoRipiano,
} from './scena3d.js?v=20261113y';
import { SFONDI_LISTA } from './sfondi.js?v=20261113y';
import { agganciaTema } from './tema.js?v=20261113y';
import { renderPannello, configDefault } from './interfaccia.js?v=20261113y';
import { renderDistinta } from './distinta.js?v=20261113y';
import { esportaCSV, esportaPDF, nomeMaterialeCsv } from './esportazione.js?v=20261113y';
import { esportaExcel, apriModelloExcel } from './modello-export.js?v=20261113y';
import {
  salvaLocale, caricaLocale, esportaJSON, importaJSONFile,
} from './storage.js?v=20261113y';

// Config iniziale: ultima salvata, oppure default
let config = caricaLocale() || configDefault();

// Se nella URL c'è ?tipo=battente o ?tipo=scorrevole, lo applica subito.
// Serve per entrare dal menu "scegli.html" già sul tipo giusto.
try {
  const tipo = new URLSearchParams(location.search).get('tipo');
  if (tipo === 'battente' || tipo === 'scorrevole') {
    config.tipoArmadio = tipo;
  }
} catch (_) { /* no-op */ }

const canvas = document.getElementById('canvas3d');
const pannello = document.getElementById('pannello');
const distintaEl = document.getElementById('distinta');
const avvisiEl = document.getElementById('avvisi');
const btnToggleAnte = document.getElementById('toggle-ante');

inizializzaScena(canvas);
agganciaSfondo();
agganciaTema();

// Selettore sfondo 3D (chiaro / neutro / scuro)
function agganciaSfondo() {
  const cont = document.getElementById('sfondo-3d');
  if (!cont) return;
  const attuale = config.sfondo || 'chiaro';
  cont.innerHTML = SFONDI_LISTA.map((s) => `<button type="button" class="sfondo-btn ${s.id === attuale ? 'on' : ''}"
    data-sfondo="${s.id}" title="Sfondo ${s.nome}" style="background:${s.css}"></button>`).join('');
  cont.querySelectorAll('.sfondo-btn').forEach((b) => b.addEventListener('click', () => {
    config.sfondo = b.dataset.sfondo;
    impostaSfondo(config.sfondo);
    cont.querySelectorAll('.sfondo-btn').forEach((x) => x.classList.toggle('on', x === b));
    try { salvaLocale(config); } catch (_) { /* no-op */ }
  }));
  impostaSfondo(attuale);
}

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
  const distinta = calcolaDistintaCompleta(config);
  aggiornaScena(config);
  renderDistinta(distintaEl, distinta, config);
  agganciaExport(distinta);
  mostraAvvisi();
  aggiornaHeader();
  salvaLocale(config); // autosalvataggio in locale
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

function agganciaExport(distinta) {
  const btnCsv = document.getElementById('btn-csv');
  const btnPdf = document.getElementById('btn-pdf');
  if (btnCsv) btnCsv.onclick = () => esportaCSV(distinta, config.meta, config);
  if (btnPdf) btnPdf.onclick = () => esportaPDF(distinta, config, config.meta);
  // Excel con il modello del programma di taglio (vedi modello-export.js)
  const pezziModello = () => distinta.pezzi.map((p) => ({
    nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore, quantita: p.quantita,
    materiale: nomeMaterialeCsv(p, config), modulo: p.modulo || '', gruppo: '' }));
  const progettoNome = (config.meta && config.meta.cliente) || 'Armadio';
  const btnXlsx = document.getElementById('btn-xlsx');
  if (btnXlsx) btnXlsx.onclick = () => {
    const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
    esportaExcel(pezziModello(), { nomeFile: `NG_${progettoNome}_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`, progetto: progettoNome });
  };
  const btnMod = document.getElementById('btn-modello');
  if (btnMod) btnMod.onclick = () => apriModelloExcel({ pezzi: pezziModello(), progetto: progettoNome });
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

// Toggle apri porte — switch in header + bottone fisso in basso (mobile).
// I due controlli sono sincronizzati tra loro.
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
  const conRipiani = (config.moduli || []).some((m) => m.ripiani > 0);
  hintRip.hidden = !(btnToggleAnte.checked && conRipiani);
}
btnToggleAnte.addEventListener('change', aggiornaHintRipiani);
if (btnFabApri) btnFabApri.addEventListener('click', aggiornaHintRipiani);
document.getElementById('ripiani-auto')?.addEventListener('click', () => {
  (config.moduli || []).forEach((m) => { delete m.ripianiY; });
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
canvas.addEventListener('pointerdown', (e) => {
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
  config.moduli[r.modulo].ripianiY = r.ripianiY;
  salvaLocale(config);           // niente ricostruzione: la vista resta dov'è
};
canvas.addEventListener('pointerup', fineRipiano, true);
canvas.addEventListener('pointercancel', fineRipiano, true);

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
