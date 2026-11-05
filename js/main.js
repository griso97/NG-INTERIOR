// =============================================================================
// MAIN — orchestratore
// =============================================================================
// Collega pannello parametri, scena 3D, tabella distinta e pulsanti export.
// Qui dentro non ci sono formule: solo "chi chiama chi".
// =============================================================================

import { calcolaDistintaCompleta, validaConfig } from './calcoli.js';
import {
  inizializzaScena, aggiornaScena, impostaApertura, forzaResize,
} from './scena3d.js';
import { renderPannello, configDefault } from './interfaccia.js';
import { renderDistinta } from './distinta.js';
import { esportaCSV, esportaPDF } from './esportazione.js';
import {
  salvaLocale, caricaLocale, esportaJSON, importaJSONFile,
} from './storage.js';

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
