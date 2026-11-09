// =============================================================================
// Progettazione cucina — orchestratore
// =============================================================================
// STEP 1 — Pianta: perimetro.  STEP 2 — Moduli base lungo le pareti.
// Step 3 e 4 restano disabilitati nello stepper (saranno abilitati man mano).
// Il modello dati è lo STESSO condiviso tra tutti i 4 step.
// =============================================================================

import {
  progettoDefault, TIPOLOGIE,
  applicaPreset, aggiungiParete, rimuoviParete,
  TIPI_MODULO_BASE, CATALOGO_MOBILI, LARGHEZZE_BASE, nomeTipo,
  infoTipo, altezzeTipo, campiMobile, descrizioneMobile, categoriaTipo, livelloDiMobile,
  spazioLiberoParete, moduliDiParete,
  aggiungiModuloBase, aggiungiFascia,
  rimuoviModuloBase, rimuoviFascia,
  spostaModulo, problemiIngombri, problemiMobiliLiberi,
  ruotaPianta, specchiaPianta, inverteAngolo,
  toggleParete, muroTolto, snap, liberoPareti, generaPensiliAuto, riorientaMobili,
  spaziTraMobili, riempiSpaziReglette, infoAngoloCieco, applicaRegletteAngolo,
  aggiungiMobileLibero, trovaMobileLibero, ruotaMobileLibero, rimuoviMobileLibero, muoviMobileLibero,
  vincolaAiMuri, posizionaVincolata, orientaVersoMuro,
} from './modello.js?v=20261109k';
import { renderPianta } from './pianta.js?v=20261109k';
import { salvaProgetto, caricaProgetto, resetProgetto } from './storage.js?v=20261109k';
import { agganciaTema } from '../tema.js?v=20261109k';

// --- Stato iniziale: ultimo progetto salvato, oppure default ---
let progetto = caricaProgetto() || progettoDefault();
if (!progetto.stepCorrente) progetto.stepCorrente = 1;
// Progetti salvati con versioni precedenti: completo i campi mancanti
progetto = { ...progettoDefault(), ...progetto };

const pannello = document.getElementById('cucina-pannello');
const riepilogo = document.getElementById('cucina-riepilogo');
const svg = document.getElementById('pianta-svg');
const stepInfo = document.getElementById('step-info');

// Desktop: la rotellina sopra la pianta (area centrale) non scrollava nulla,
// mentre i comandi stanno nel pannello laterale. Inoltro lo scroll della
// rotella al pannello che deborda (sinistro o destro), così si può scorrere
// ovunque. Sulla vista 3D la rotella serve allo zoom → lasciata stare.
(function inoltraRotella() {
  const vista = document.querySelector('.cucina-vista');
  if (!vista) return;
  vista.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('#cucina-3d')) return;  // 3D: zoom
    const target = (pannello && pannello.scrollHeight > pannello.clientHeight + 2)
      ? pannello
      : (riepilogo && riepilogo.scrollHeight > riepilogo.clientHeight + 2 ? riepilogo : null);
    if (!target) return;
    target.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });
})();

// Stato locale UI per Step 2
let step2 = {
  pareteAttivaId: null,  // parete selezionata per inserire moduli
  tipoSelezionato: 'base-ante',
  larghezzaSelezionata: 600,
  fasciaLarghezza: 100,
  errore: null,
  mobSelId: null,        // mobile libero selezionato sulla pianta
};
let pareteSelId = null;  // muro toccato nello Step 1
let trascinamento = null; // { id, dx, dy, mosso } mentre si sposta un mobile
const palette = document.getElementById('palette');
const modale = document.getElementById('modale');

// --------- STORIA (Annulla / Rifai) ---------
let storiaPast = [], storiaFuture = [];
function registraStoria() {
  storiaPast.push(JSON.stringify(progetto));
  if (storiaPast.length > 60) storiaPast.shift();
  storiaFuture = [];
}
function annullaStoria() {
  if (!storiaPast.length) return;
  storiaFuture.push(JSON.stringify(progetto));
  progetto = JSON.parse(storiaPast.pop());
  step2.mobSelId = null; pareteSelId = null;
  aggiorna();
}
function rifaiStoria() {
  if (!storiaFuture.length) return;
  storiaPast.push(JSON.stringify(progetto));
  progetto = JSON.parse(storiaFuture.pop());
  step2.mobSelId = null; pareteSelId = null;
  aggiorna();
}
function aggiornaBottoniStoria() {
  const u = document.getElementById('btn-annulla'), r = document.getElementById('btn-rifai');
  if (u) u.disabled = storiaPast.length === 0;
  if (r) r.disabled = storiaFuture.length === 0;
}
document.getElementById('btn-annulla')?.addEventListener('click', annullaStoria);
document.getElementById('btn-rifai')?.addEventListener('click', rifaiStoria);

// --------- DISPATCH principale: sceglie lo step attivo ---------
// Step 1 Pianta · 2 Moduli bassi · 3 Moduli alti · 4 Rendering 3D
function renderPannello() {
  if (progetto.stepCorrente === 4) return renderPannelloStep3d();
  if (progetto.stepCorrente === 2 || progetto.stepCorrente === 3) return renderPannelloModuli();
  return renderPannelloStep1();
}
function renderRiepilogo() {
  if (progetto.stepCorrente === 4) return renderRiepilogoStep3d();
  if (progetto.stepCorrente === 2 || progetto.stepCorrente === 3) return renderRiepilogoModuli();
  return renderRiepilogoStep1();
}
const NOMI_STEP = {
  1: 'Pianta: perimetro',
  2: 'Moduli bassi',
  3: 'Moduli alti',
  4: 'Rendering 3D',
};
// Livello di mobili attivo nello step corrente ('basso' = a terra, 'alto' = pensili)
function livelloStep() { return progetto.stepCorrente === 3 ? 'alto' : 'basso'; }
function livelloMobile(cat) { return cat === 'pensile' ? 'alto' : 'basso'; }
function step2Disponibile() {
  return progetto.pianoConfermato && progetto.piano.pareti.some((p) => !p.assente);
}
function step4Disponibile() {
  return step2Disponibile() && (progetto.mobiliLiberi || []).length > 0;
}
// Stepper in alto: evidenzia lo step attivo, abilita quelli raggiungibili
function renderStepper() {
  if ((progetto.stepCorrente === 2 || progetto.stepCorrente === 3) && !step2Disponibile()) progetto.stepCorrente = 1;
  if (progetto.stepCorrente === 4 && !step4Disponibile()) progetto.stepCorrente = step2Disponibile() ? 2 : 1;
  document.querySelectorAll('#stepper .step').forEach((btn) => {
    const n = Number(btn.dataset.step);
    const abilitato = n === 1 || ((n === 2 || n === 3) && step2Disponibile()) || (n === 4 && step4Disponibile());
    btn.disabled = !abilitato;
    btn.classList.toggle('disabilitato', !abilitato);
    btn.classList.toggle('attivo', n === progetto.stepCorrente);
    if (n === progetto.stepCorrente) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
  stepInfo.textContent =
    `Passo ${progetto.stepCorrente} di 4 — ${NOMI_STEP[progetto.stepCorrente]}`;
}
document.querySelectorAll('#stepper .step').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    progetto.stepCorrente = Number(btn.dataset.step);
    step2.errore = null;
    aggiorna();
  });
});

// --------- RENDER PANNELLO SINISTRO — STEP 1 ---------
function renderPannelloStep1() {
  pannello.innerHTML = `
    <section>
      <h3>Tipologia</h3>
      <div class="tipo-grid">
        ${TIPOLOGIE.map((t) => `
          <button type="button" class="tipo-card ${progetto.piano.tipologia === t.id ? 'sel' : ''}"
            data-tipo="${t.id}" title="${t.descrizione}">
            ${iconaTipologia(t.id)}
            <span>${t.nome}</span>
          </button>
        `).join('')}
      </div>
    </section>

    <section>
      <h3>Pareti · tutte le misure in mm</h3>
      ${progetto.piano.pareti.length > 0 ? `
        <div class="orienta-row">
          <button id="btn-ruota-sx" class="btn-ghost" type="button" title="Ruota tutta la pianta a sinistra">⟲ Ruota</button>
          <button id="btn-ruota-dx" class="btn-ghost" type="button" title="Ruota tutta la pianta a destra">Ruota ⟳</button>
          <button id="btn-specchia" class="btn-ghost" type="button" title="Specchia la pianta">⇄ Specchia</button>
        </div>` : ''}
      <div id="pareti-list">
        ${progetto.piano.pareti.map((p, i) => `
          <div class="parete-card ${p.id === pareteSelId ? 'sel' : ''} ${p.assente ? 'assente' : ''}" data-id="${p.id}">
            <header class="p-header" data-id="${p.id}">
              Parete ${i + 1}${p.assente ? ' · tolto' : ''}
              <span class="p-azioni">
                <button class="btn-mini p-togli" type="button" data-id="${p.id}">${p.assente ? 'rimetti' : 'togli muro'}</button>
                <button class="btn-mini p-rimuovi" type="button" data-id="${p.id}">elimina</button>
              </span>
            </header>
            <label>Lunghezza (mm)
              <input type="number" class="p-lung" data-id="${p.id}"
                value="${p.lunghezza_mm}" min="100" step="10" />
            </label>
            ${i > 0 ? `
              <button type="button" class="btn-mini p-gira" data-id="${p.id}" style="margin-top:8px">
                ↱ Gira angolo al contrario
              </button>` : ''}
            <div class="grid-lato" style="margin-top:8px">
              <div style="font-size:11px;color:var(--testo-dim);letter-spacing:1px;text-transform:uppercase;">
                Lato interno (mobili)
              </div>
              <button type="button" class="lato-btn ${p.latoInterno === 'interno' ? 'interno' : ''}"
                data-id="${p.id}">
                ${p.latoInterno === 'interno' ? '← Interno' : 'Esterno →'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      <button id="btn-aggiungi-parete" class="btn-oro" type="button" style="margin-top:10px;width:100%">
        + Aggiungi parete
      </button>
    </section>

    <div class="conferma-stato ${progetto.pianoConfermato ? 'ok' : 'non-conf'}">
      ${!progetto.pianoConfermato
        ? 'Pianta non ancora confermata'
        : progetto.piano.pareti.length === 0
          ? '✓ Pianta confermata — i moduli per l\'isola arriveranno in un passo successivo'
          : '✓ Pianta confermata'}
    </div>
    <section class="actions actions-sticky">
      <button id="btn-conferma" class="btn-oro" type="button" style="flex:1">
        ${progetto.pianoConfermato ? 'Sblocca pianta' : 'Conferma pianta →'}
      </button>
      <button id="btn-reset" class="btn-ghost" type="button">Reset</button>
    </section>
  `;
  attaccaEventiPannello();
}

function iconaTipologia(id) {
  const icons = {
    lineare: '<svg viewBox="0 0 48 48"><line x1="6" y1="24" x2="42" y2="24"/></svg>',
    L:       '<svg viewBox="0 0 48 48"><polyline points="6,8 6,36 42,36" fill="none"/></svg>',
    U:       '<svg viewBox="0 0 48 48"><polyline points="8,8 8,40 40,40 40,8" fill="none"/></svg>',
    penisola:'<svg viewBox="0 0 48 48"><polyline points="6,30 42,30" fill="none"/><line x1="24" y1="30" x2="24" y2="46"/></svg>',
    isola:   '<svg viewBox="0 0 48 48"><rect x="14" y="14" width="20" height="20" fill="none"/></svg>',
    personalizzata: '<svg viewBox="0 0 48 48"><polyline points="4,36 14,36 14,20 30,20 30,36 42,36" fill="none"/></svg>',
  };
  return icons[id] || '';
}

// --------- RENDER RIEPILOGO (destra) — STEP 1 ---------
function renderRiepilogoStep1() {
  const pareti = progetto.piano.pareti;
  const attive = pareti.filter((p) => !p.assente);
  const perimetroTotale = attive.reduce((s, p) => s + p.lunghezza_mm, 0);
  const tipo = TIPOLOGIE.find((t) => t.id === progetto.piano.tipologia);
  riepilogo.innerHTML = `
    <h3>Riepilogo pianta</h3>
    <div class="riep-riga"><span>Tipologia</span><strong>${tipo ? tipo.nome : '—'}</strong></div>
    <div class="riep-riga"><span>N° pareti</span><strong>${attive.length}${attive.length < pareti.length ? ` (${pareti.length - attive.length} tolte)` : ''}</strong></div>
    <div class="riep-riga"><span>Perimetro interno</span><strong>${perimetroTotale} mm</strong></div>
    <div class="riep-riga"><span>Stato</span><strong>${progetto.pianoConfermato ? 'Confermato' : 'In modifica'}</strong></div>

    <h3 style="margin-top:20px">Prossimi step</h3>
    <div class="riep-riga" style="opacity:${step2Disponibile() ? 1 : .5}"><span>Step 2</span><strong>Moduli bassi</strong></div>
    <div class="riep-riga" style="opacity:.5"><span>Step 3</span><strong>Moduli alti</strong></div>
    <div class="riep-riga" style="opacity:.5"><span>Step 4</span><strong>Rendering 3D</strong></div>
  `;
}

// --------- EVENTI PANNELLO ---------
function attaccaEventiPannello() {
  // Preset tipologia
  pannello.querySelectorAll('.tipo-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      registraStoria();
      applicaPreset(progetto, btn.dataset.tipo);
      aggiorna();
    });
  });
  // Lunghezza parete
  pannello.querySelectorAll('.p-lung').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const id = Number(e.target.dataset.id);
      const p = progetto.piano.pareti.find((x) => x.id === id);
      if (!p) return;
      p.lunghezza_mm = Math.max(100, Math.round(Number(e.target.value) || 100));
      progetto.pianoConfermato = false;
      aggiornaSoloDisegno();
    });
  });
  // Toggle lato interno
  pannello.querySelectorAll('.lato-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const p = progetto.piano.pareti.find((x) => x.id === id);
      if (!p) return;
      registraStoria();
      p.latoInterno = p.latoInterno === 'interno' ? 'esterno' : 'interno';
      progetto.pianoConfermato = false;
      aggiorna();
    });
  });
  // Rimuovi parete (solo personalizzata)
  pannello.querySelectorAll('.p-togli').forEach((btn) => {
    btn.addEventListener('click', () => {
      registraStoria();
      const r = toggleParete(progetto, Number(btn.dataset.id));
      if (!r.ok) { storiaPast.pop(); alert(r.errore); }
      aggiorna();
    });
  });
  pannello.querySelectorAll('.p-rimuovi').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Eliminare questo muro? Le pareti successive si spostano di conseguenza. Per lasciare un buco usa "togli muro".')) return;
      registraStoria();
      rimuoviParete(progetto, Number(btn.dataset.id));
      pareteSelId = null;
      aggiorna();
    });
  });
  pannello.querySelectorAll('.p-header').forEach((h) => {
    h.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = Number(h.dataset.id);
      pareteSelId = pareteSelId === id ? null : id;
      aggiorna();
    });
  });
  // Orientamento globale: ruota / specchia
  const btnRsx = document.getElementById('btn-ruota-sx');
  if (btnRsx) btnRsx.addEventListener('click', () => { registraStoria(); ruotaPianta(progetto, 90); aggiorna(); });
  const btnRdx = document.getElementById('btn-ruota-dx');
  if (btnRdx) btnRdx.addEventListener('click', () => { registraStoria(); ruotaPianta(progetto, -90); aggiorna(); });
  const btnSpec = document.getElementById('btn-specchia');
  if (btnSpec) btnSpec.addEventListener('click', () => { registraStoria(); specchiaPianta(progetto); aggiorna(); });
  // Gira il singolo angolo al contrario
  pannello.querySelectorAll('.p-gira').forEach((btn) => {
    btn.addEventListener('click', () => {
      registraStoria();
      inverteAngolo(progetto, Number(btn.dataset.id));
      aggiorna();
    });
  });
  // Aggiungi parete
  const btnAdd = document.getElementById('btn-aggiungi-parete');
  if (btnAdd) btnAdd.addEventListener('click', () => {
    registraStoria();
    aggiungiParete(progetto, 2000);
    aggiorna();
  });
  // Conferma pianta
  const btnConf = document.getElementById('btn-conferma');
  if (btnConf) btnConf.addEventListener('click', () => {
    progetto.pianoConfermato = !progetto.pianoConfermato;
    // Appena confermata la pianta si passa direttamente ai moduli bassi
    if (step2Disponibile()) progetto.stepCorrente = 2;
    aggiorna();
  });
  // Reset
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', () => {
    if (confirm('Reset progetto cucina? La pianta attuale andrà persa.')) {
      resetProgetto();
      progetto = progettoDefault();
      step2.pareteAttivaId = null;
      aggiorna();
    }
  });
}

// --------- RENDER PANNELLO SINISTRO — STEP 2 (moduli base) ---------
function pareteAttiva() {
  const pareti = progetto.piano.pareti.filter((p) => !p.assente);
  let p = pareti.find((x) => x.id === step2.pareteAttivaId);
  if (!p) { p = pareti[0]; step2.pareteAttivaId = p ? p.id : null; }
  return p;
}

function renderPannelloModuli() {
  const pareti = progetto.piano.pareti;
  const parete = pareteAttiva();
  if (!parete) {
    pannello.innerHTML = `<section><div class="mod-vuoto">Nessun muro attivo: rimetti almeno un muro dallo Step 1.</div></section>`;
    return;
  }
  const idx = pareti.findIndex((p) => p.id === parete.id);
  const s = spazioLiberoParete(progetto, parete.id);
  // Spazio che tiene conto ANCHE dei mobili liberi appoggiati al muro
  const libInfo = liberoPareti(progetto).find((x) => x.id === parete.id);
  const occTot = Math.min(s.totale, s.occupato + (libInfo ? libInfo.coperto : 0));
  const liberoTot = Math.max(0, s.totale - occTot);
  const perc = Math.min(100, Math.max(0, (occTot / (s.totale || 1)) * 100));
  const tipo = TIPI_MODULO_BASE.find((t) => t.id === step2.tipoSelezionato) || TIPI_MODULO_BASE[0];
  if (!tipo.larghezze.includes(step2.larghezzaSelezionata)) {
    step2.larghezzaSelezionata = tipo.larghezze.includes(600) ? 600 : tipo.larghezze[0];
  }
  const mods = moduliDiParete(progetto, parete.id);
  const problemi = [...problemiIngombri(progetto), ...problemiMobiliLiberi(progetto)];
  const haContenuto = (progetto.mobiliLiberi || []).length > 0;
  const livello = livelloStep();
  const spaziGaps = spaziTraMobili(progetto);
  const nMobiliLivello = (progetto.mobiliLiberi || [])
    .filter((m) => livelloDiMobile(m) === livello).length;

  pannello.innerHTML = `
    <section>
      <h3>Parete attiva</h3>
      <div class="sel-parete-row">
        ${pareti.map((p, i) => {
          const conProblemi = problemi.some((x) => x.pareti && x.pareti.includes(p.id));
          if (p.assente) return `<button type="button" class="sel-parete-pill assente" disabled>Parete ${i + 1} · tolto</button>`;
          return `<button type="button" class="sel-parete-pill ${p.id === parete.id ? 'sel' : ''}"
            data-id="${p.id}">Parete ${i + 1}${conProblemi ? ' ⚠' : ''}</button>`;
        }).join('')}
      </div>
      <div class="spazio-barra">
        <span class="occupato">Muro ${Math.round(s.totale / 10)} cm</span>
        <span class="libero ${liberoTot > 0 ? 'ok' : 'pieno'}">Libero ${Math.round(liberoTot / 10)} cm</span>
      </div>
      <div class="barra-progresso"><div class="riempita" style="width:${perc}%"></div></div>
    </section>

    ${blocMobileSelezionato()}

    ${spaziGaps.length ? `
    <section>
      <h3>Spazi tra i mobili</h3>
      <div class="riga-3d">${spaziGaps.length} spazio/i vuoto/i tra i mobili (${
        spaziGaps.map((g) => `${(g.gap / 10).toFixed(g.gap % 10 ? 1 : 0)} cm`).join(', ')
      }). Riempili con una regletta dello spessore esatto.</div>
      <button id="riempi-reglette" class="btn-oro" type="button" style="margin-top:8px;width:100%">↔ Riempi spazi con reglette</button>
    </section>` : ''}

    ${livello === 'alto' ? `
    <section>
      <h3>Pensili automatici</h3>
      <div class="riga-3d">Crea i pensili <strong>allineati sopra le basi</strong> (e in angolo nelle cucine a L/U). Scegli l'altezza:</div>
      <div class="orienta-row" style="margin-top:8px">
        <button id="auto-70" class="btn-oro" type="button">Auto 70</button>
        <button id="auto-90" class="btn-oro" type="button">Auto 90</button>
      </div>
      <div class="riga-3d" style="margin-top:8px">Oppure aggiungili a mano dalla barra qui sotto.
      I mobili bassi sono <strong>bloccati</strong>: non si spostano per errore.</div>
    </section>` : ''}

    ${livello === 'basso' ? `
    <section>
      <h3>Aggiungi modulo · profondità 600 mm</h3>
      <label>Tipo
        <select id="s2-tipo">
          ${TIPI_MODULO_BASE.map((t) => `
            <option value="${t.id}" ${t.id === tipo.id ? 'selected' : ''}>${t.nome}</option>`).join('')}
        </select>
      </label>
      <label style="margin-top:8px;display:block">Larghezza (mm)
        <select id="s2-larg">
          ${tipo.larghezze.map((l) => `
            <option value="${l}" ${l === step2.larghezzaSelezionata ? 'selected' : ''}
              ${l > s.libero ? 'disabled' : ''}>${l}${l > s.libero ? ' — non entra' : ''}</option>`).join('')}
        </select>
      </label>
      <button id="s2-aggiungi" class="btn-oro" type="button" style="margin-top:10px;width:100%"
        ${tipo.larghezze.some((l) => l <= s.libero) ? '' : 'disabled'}>
        + Aggiungi a parete ${idx + 1}
      </button>
    </section>

    <section>
      <h3>Fascia di chiusura</h3>
      <div style="display:flex;gap:6px;align-items:flex-end">
        <label style="flex:1">Larghezza (mm)
          <input type="number" id="s2-fascia" min="10" step="1" value="${step2.fasciaLarghezza}" />
        </label>
        <button id="s2-fascia-add" class="btn-ghost" type="button">+ Fascia</button>
      </div>
      <button id="s2-fascia-riempi" class="btn-ghost" type="button" style="margin-top:6px;width:100%"
        ${s.libero > 0 ? '' : 'disabled'}>Chiudi lo spazio libero (${Math.max(0, s.libero)} mm)</button>
      ${step2.errore ? `<div class="avviso-pannello">${step2.errore}</div>` : ''}
    </section>

    <section>
      <h3>Moduli su parete ${idx + 1} · da inizio a fine</h3>
      <div class="mod-elenco">
        ${mods.length === 0 ? '<div class="mod-vuoto">Nessun modulo su questa parete</div>' : ''}
        ${mods.map((m, i) => `
          <div class="mod-row ${m.categoria === 'fascia' ? 'fascia' : m.tipo}">
            <span>${nomeTipo(m.tipo)} · <strong>${m.larghezza_mm}</strong></span>
            <span class="mod-azioni">
              <button class="btn-mini s2-sposta" type="button" title="Sposta verso l'inizio"
                data-cat="${m.categoria}" data-id="${m.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn-mini s2-sposta" type="button" title="Sposta verso la fine"
                data-cat="${m.categoria}" data-id="${m.id}" data-dir="1" ${i === mods.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn-mini s2-rimuovi" type="button" title="Rimuovi"
                data-cat="${m.categoria}" data-id="${m.id}">✕</button>
            </span>
          </div>`).join('')}
      </div>
    </section>` : ''}

    ${problemi.length ? `
      <section>
        <h3>Da sistemare</h3>
        ${problemi.map((x) => `<div class="avviso-pannello">${x.messaggio}</div>`).join('')}
      </section>` : ''}

    <section class="actions">
      <button id="s2-indietro" class="btn-ghost" type="button">← ${livello === 'alto' ? 'Moduli bassi' : 'Pianta'}</button>
      <button id="s2-avanti" class="btn-oro" type="button" style="flex:1"
        ${livello === 'alto' && !haContenuto ? 'disabled' : ''}>
        ${livello === 'basso' ? 'Moduli alti →' : 'Rendering 3D →'}
      </button>
    </section>
    <div class="conferma-stato ${nMobiliLivello > 0 ? 'ok' : 'non-conf'}">
      ${problemi.length ? 'Risolvi gli avvisi evidenziati'
        : livello === 'basso'
          ? (nMobiliLivello > 0 ? '✓ Mobili bassi posati — vai ai moduli alti' : 'Posiziona i mobili bassi dalla barra sotto')
          : (nMobiliLivello > 0 ? '✓ Pensili posati — vai al rendering' : 'Posiziona i pensili dalla barra sotto')}
    </div>
  `;
  attaccaEventiStep2();
}

function attaccaEventiStep2() {
  const pareteId = pareteAttiva().id;
  const fatto = (res) => {
    step2.errore = res && res.ok === false ? res.errore : null;
    aggiorna();
  };
  pannello.querySelectorAll('.sel-parete-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      step2.pareteAttivaId = Number(btn.dataset.id);
      fatto();
    });
  });
  const elTipo = document.getElementById('s2-tipo');
  if (elTipo) elTipo.addEventListener('change', (e) => {
    step2.tipoSelezionato = e.target.value;
    fatto();
  });
  const elLarg = document.getElementById('s2-larg');
  if (elLarg) elLarg.addEventListener('change', (e) => {
    step2.larghezzaSelezionata = Number(e.target.value);
  });
  const elAgg = document.getElementById('s2-aggiungi');
  if (elAgg) elAgg.addEventListener('click', () => {
    registraStoria();
    fatto(aggiungiModuloBase(progetto, pareteId, step2.tipoSelezionato, step2.larghezzaSelezionata));
  });
  const inpFascia = document.getElementById('s2-fascia');
  if (inpFascia) inpFascia.addEventListener('input', (e) => {
    step2.fasciaLarghezza = Math.max(1, Math.floor(Number(e.target.value) || 0));
  });
  const elFasciaAdd = document.getElementById('s2-fascia-add');
  if (elFasciaAdd) elFasciaAdd.addEventListener('click', () => {
    registraStoria();
    fatto(aggiungiFascia(progetto, pareteId, step2.fasciaLarghezza));
  });
  const elFasciaRiempi = document.getElementById('s2-fascia-riempi');
  if (elFasciaRiempi) elFasciaRiempi.addEventListener('click', () => {
    const libero = spazioLiberoParete(progetto, pareteId).libero;
    if (libero > 0) { registraStoria(); fatto(aggiungiFascia(progetto, pareteId, libero)); }
  });
  pannello.querySelectorAll('.s2-sposta').forEach((btn) => {
    btn.addEventListener('click', () => {
      registraStoria();
      spostaModulo(progetto, btn.dataset.cat, Number(btn.dataset.id), Number(btn.dataset.dir));
      fatto();
    });
  });
  pannello.querySelectorAll('.s2-rimuovi').forEach((btn) => {
    btn.addEventListener('click', () => {
      registraStoria();
      const id = Number(btn.dataset.id);
      if (btn.dataset.cat === 'fascia') rimuoviFascia(progetto, id);
      else rimuoviModuloBase(progetto, id);
      fatto();
    });
  });
  const autoPensili = (h) => {
    registraStoria();
    const n = generaPensiliAuto(progetto, h);
    step2.mobSelId = null;
    aggiorna();
    if (n === 0) alert('Aggiungi prima i mobili bassi: i pensili vengono creati sopra le basi.');
  };
  document.getElementById('auto-70')?.addEventListener('click', () => autoPensili(700));
  document.getElementById('auto-90')?.addEventListener('click', () => autoPensili(900));
  document.getElementById('riempi-reglette')?.addEventListener('click', () => {
    registraStoria();
    const n = riempiSpaziReglette(progetto);
    step2.mobSelId = null;
    aggiorna();
    if (n === 0) alert('Nessuno spazio da riempire.');
  });

  const mobSel = trovaMobileLibero(progetto, step2.mobSelId);
  if (mobSel) {
    document.getElementById('mob-ruota').addEventListener('click', () => {
      registraStoria();
      ruotaMobileLibero(progetto, mobSel.id);
      riblocca(mobSel.id);
      fatto();
    });
    document.getElementById('mob-isola').addEventListener('click', () => {
      registraStoria();
      mobSel.isola = !mobSel.isola;
      riblocca(mobSel.id);
      fatto();
    });
    document.getElementById('mob-cieco')?.addEventListener('click', () => {
      registraStoria();
      // Se ora è cieco → forzalo normale; altrimenti forzalo cieco.
      mobSel.angoloCieco = infoAngoloCieco(progetto, mobSel) ? false : true;
      fatto();
    });
    const nudge = (dx, dy) => {
      const cm = parseFloat(document.getElementById('nudge-cm')?.value) || 0;
      const mm = Math.round(cm * 10);
      if (!mm) return;
      registraStoria();
      muoviMobileLibero(progetto, mobSel.id, dx * mm, dy * mm);
      aggiornaSoloDisegno();
    };
    // y della pianta è verso l'alto → "su" = +y, "giù" = -y
    document.getElementById('nudge-su').addEventListener('click', () => nudge(0, 1));
    document.getElementById('nudge-giu').addEventListener('click', () => nudge(0, -1));
    document.getElementById('nudge-sx').addEventListener('click', () => nudge(-1, 0));
    document.getElementById('nudge-dx').addEventListener('click', () => nudge(1, 0));
    const raBase = document.getElementById('ra-base');
    const raSpess = document.getElementById('ra-spess');
    const aggiornaRa = () => {
      if (!progetto.reglettaAngolo) progetto.reglettaAngolo = { base: 30, spessore: 18 };
      if (raBase) progetto.reglettaAngolo.base = Math.max(5, parseInt(raBase.value, 10) || 30);
      if (raSpess) progetto.reglettaAngolo.spessore = Math.max(0, parseInt(raSpess.value, 10) || 0);
      fatto();
    };
    raBase?.addEventListener('change', aggiornaRa);
    raSpess?.addEventListener('change', aggiornaRa);
    document.getElementById('mob-misura').addEventListener('click', () => {
      apriScelta(mobSel.tipo, mobSel.id);
    });
    document.getElementById('mob-elimina').addEventListener('click', () => {
      registraStoria();
      rimuoviMobileLibero(progetto, mobSel.id);
      step2.mobSelId = null; fatto();
    });
  }
  document.getElementById('s2-indietro').addEventListener('click', () => {
    progetto.stepCorrente = livelloStep() === 'alto' ? 2 : 1;
    step2.mobSelId = null;
    fatto();
  });
  const btnAv = document.getElementById('s2-avanti');
  if (btnAv) btnAv.addEventListener('click', () => {
    if (livelloStep() === 'basso') {
      progetto.moduliBaseConfermati = true;
      progetto.stepCorrente = 3;
    } else if (step4Disponibile()) {
      progetto.stepCorrente = 4;
    }
    step2.mobSelId = null;
    fatto();
  });
}

// --------- RENDER RIEPILOGO (destra) — STEP 2 ---------
function renderRiepilogoModuli() {
  const pareti = progetto.piano.pareti;
  const conteggio = {};
  for (const m of progetto.moduliBase) {
    const k = `${nomeTipo(m.tipo)} ${m.larghezza_mm}`;
    conteggio[k] = (conteggio[k] || 0) + 1;
  }
  const totFasce = progetto.fasce.reduce((s, f) => s + f.larghezza_mm, 0);
  const lineari = progetto.moduliBase.reduce((s, m) => s + m.larghezza_mm, 0);
  const lib = liberoPareti(progetto);
  riepilogo.innerHTML = `
    <h3>Spazio sui muri · cm</h3>
    ${pareti.map((p, i) => {
      if (p.assente) return `<div class="riep-riga"><span>Parete ${i + 1}</span><strong>tolto</strong></div>`;
      const info = lib.find((x) => x.id === p.id);
      const liberoCm = info ? Math.round(info.libero / 10) : Math.round(p.lunghezza_mm / 10);
      return `<div class="riep-riga"><span>Parete ${i + 1} (${Math.round(p.lunghezza_mm / 10)} cm)</span>
        <strong class="${liberoCm === 0 ? 'ok' : ''}">${liberoCm === 0 ? '✓ pieno' : `${liberoCm} liberi`}</strong></div>`;
    }).join('')}

    <h3 style="margin-top:20px">Moduli</h3>
    ${Object.keys(conteggio).length === 0
      ? '<div class="riep-riga"><span>Nessun modulo</span><strong>—</strong></div>'
      : Object.entries(conteggio).map(([k, n]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${n}</strong></div>`).join('')}
    <div class="riep-riga"><span>Fasce (totale)</span><strong>${progetto.fasce.length} · ${totFasce} mm</strong></div>
    <div class="riep-riga"><span>Mobili liberi sulla pianta</span><strong>${progetto.mobiliLiberi.length}</strong></div>
    <div class="riep-riga"><span>Metri lineari moduli</span><strong>${(lineari / 1000).toFixed(2)} m</strong></div>
    <div class="riep-riga"><span>Stato</span><strong>${progetto.moduliBaseConfermati ? 'Confermato' : 'In modifica'}</strong></div>
  `;
}

// --------- STEP 3 — VISTA 3D ---------
const canvas3d = document.getElementById('cucina-3d');
const legenda3d = document.querySelector('.vista-strumenti .legenda');
let scena3dMod = null;      // modulo importato dinamicamente
let scena3dMontata = false;

// Click nel 3D: seleziona il mobile toccato (per vederlo/modificarlo)
canvas3d.addEventListener('click', (e) => {
  if (progetto.stepCorrente !== 4 || !scena3dMod || !scena3dMod.pickMobile) return;
  const id = scena3dMod.pickMobile(e.clientX, e.clientY);
  if (id === step2.mobSelId) return;
  step2.mobSelId = id;
  renderPannello();
  renderRiepilogo();
  scena3dMod.aggiornaScena3d(progetto, false, id); // evidenzia il modulo toccato
});

function renderPannelloStep3d() {
  const sel = trovaMobileLibero(progetto, step2.mobSelId);
  if (sel) return renderPannelloModificaMobile(sel);
  const coloriZocc = (scena3dMod && scena3dMod.COLORI_ZOCCOLO) || [];
  const zoccSel = progetto.zoccoloColore || 'nero-opaco';
  const materialiEnc = ((scena3dMod && scena3dMod.MATERIALI) || []).filter((mt) => mt.categoria === 'encimera');
  const encAttuale = (progetto.encimera || {}).materiale || null;
  const avvisi = problemiMobiliLiberi(progetto);
  pannello.innerHTML = `
    ${avvisi.length ? `
    <section class="step3-pannello">
      <h3>Da sistemare</h3>
      ${avvisi.map((x) => `<div class="avviso-pannello">${x.messaggio}</div>`).join('')}
    </section>` : ''}
    <section class="step3-pannello">
      <h3>Vista 3D</h3>
      <div class="riga-3d">
        <strong>Tocca un mobile</strong> per vedere cos'è e modificarlo
        (aggiungere lavello o piano cottura).<br><br>
        Trascina per <strong>ruotare</strong>, due dita o rotella per lo
        <strong>zoom</strong>, due dita/tasto destro per <strong>spostare</strong>.
      </div>
    </section>
    ${materialiEnc.length ? `
    <section class="step3-pannello">
      <h3>Piano di lavoro (encimera)</h3>
      <div class="riga-3d" style="margin-bottom:6px">Il piano cambia su tutta la cucina. Ogni encimera porta il suo spessore.</div>
      <div class="palette-colori">
        <button type="button" class="swatch swatch-none ${!encAttuale ? 'sel' : ''}" data-enc="" title="Nero standard (4 cm)">—</button>
        ${materialiEnc.map((mt) => `<button type="button" class="swatch ${mt.id === encAttuale ? 'sel' : ''}"
          data-enc="${mt.id}" title="${mt.nome} (${mt.spessore || 40} mm)" style="background-image:url('${mt.thumb}')"></button>`).join('')}
      </div>
    </section>` : ''}
    <section class="step3-pannello">
      <h3>Colore zoccolo</h3>
      <div class="palette-zoccolo">
        ${coloriZocc.map((z) => `<button type="button" class="swatch-zocc ${z.id === zoccSel ? 'sel' : ''}"
          data-zocc="${z.id}" title="${z.nome}" style="background:${z.css}"></button>
          <span class="et-zocc">${z.nome}</span>`).join('')}
      </div>
    </section>
    <section class="step3-pannello">
      <h3>Sfondo</h3>
      <div class="palette-zoccolo">
        ${((scena3dMod && scena3dMod.SFONDI_LISTA) || []).map((s) => `<button type="button" class="swatch-zocc ${s.id === (progetto.sfondo || 'chiaro') ? 'sel' : ''}"
          data-sfondo="${s.id}" title="${s.nome}" style="background:${s.css}"></button>
          <span class="et-zocc">${s.nome}</span>`).join('')}
      </div>
    </section>
    <section class="step3-pannello">
      <h3>LED sotto i pensili</h3>
      <div class="riga-3d" style="margin-bottom:6px">Striscia di luce sotto ogni pensile. Scegli la temperatura della luce.</div>
      <div class="opzioni-anta">
        ${(() => {
          const led = progetto.led || { attivo: false, colore: 'caldo' };
          const opts = [
            { id: 'off',    et: 'Nessun LED' },
            { id: 'caldo',  et: '💡 Luce calda (3000K)' },
            { id: 'medio',  et: '💡 Luce neutra (4000K)' },
            { id: 'freddo', et: '💡 Luce fredda (6500K)' },
          ];
          const current = led.attivo ? led.colore : 'off';
          return opts.map((o) => `<button type="button" class="btn-ghost opt-led ${current === o.id ? 'attivo' : ''}"
            data-led="${o.id}">${current === o.id ? '✓ ' : ''}${o.et}</button>`).join('');
        })()}
      </div>
    </section>
    <section class="step3-pannello">
      <h3>Immagine</h3>
      <div class="riga-3d" style="margin-bottom:6px">Salva una foto del rendering in alta qualità (PNG).</div>
      <button id="s3-salva-img" class="btn-ghost" type="button" style="width:100%">📷 Salva immagine HD</button>
    </section>
    <section class="actions">
      <button id="s3-indietro" class="btn-ghost" type="button" style="flex:1">← Moduli alti</button>
    </section>`;
  pannello.querySelectorAll('.swatch-zocc[data-zocc]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.zoccoloColore = b.dataset.zocc;
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch-zocc[data-sfondo]').forEach((b) => b.addEventListener('click', () => {
    progetto.sfondo = b.dataset.sfondo;
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch[data-enc]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (!progetto.encimera) progetto.encimera = {};
    progetto.encimera.materiale = b.dataset.enc || null;
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-led').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    const v = b.dataset.led;
    if (v === 'off') progetto.led = { attivo: false, colore: (progetto.led && progetto.led.colore) || 'caldo' };
    else progetto.led = { attivo: true, colore: v };
    aggiorna();
  }));
  document.getElementById('s3-salva-img')?.addEventListener('click', () => {
    const ok = scena3dMod && scena3dMod.esportaImmagine3d
      && scena3dMod.esportaImmagine3d(`cucina-${nomeFileData()}.png`);
    if (!ok) alert('Impossibile salvare l\'immagine su questo dispositivo.');
  });
  document.getElementById('s3-indietro')?.addEventListener('click', () => { progetto.stepCorrente = 3; aggiorna(); });
}

/** Stringa data per il nome file, es. 2026-11-06. */
function nomeFileData() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function renderPannelloModificaMobile(m) {
  const cat = categoriaTipo(m.tipo);
  const isBase = cat === 'base';
  const puoAgg = m.tipo === 'base-ante' || m.tipo === 'base-cassetti';
  const fuochi = (m.larghezza_mm || 600) < 600 ? 2 : 4;
  const sinkCm = Math.max(30, Math.round(((m.larghezza_mm || 600) - 100) / 10));
  const gruppoColore = cat === 'pensile' ? 'pensile' : cat === 'colonna' ? 'colonna'
    : cat === 'costado' ? 'costado' : isBase ? 'base' : null;
  const nomeGruppo = { base: 'mobili bassi', pensile: 'pensili', colonna: 'colonne', costado: 'costadi' }[gruppoColore];
  const materialiTutti = (scena3dMod && scena3dMod.MATERIALI) || [];
  // Palette "colore ante" filtrata: niente encimere (hanno la loro sezione).
  const materiali = materialiTutti.filter((mt) => mt.categoria !== 'encimera');
  const materialiEncimera = materialiTutti.filter((mt) => mt.categoria === 'encimera');
  const colAttuale = (progetto.coloriFronti || {})[gruppoColore];
  const encAttuale = (progetto.encimera || {}).materiale || null;
  pannello.innerHTML = `
    <section class="step3-pannello">
      <h3>Modulo selezionato</h3>
      <div class="mod-row ${m.tipo}"><span>${nomeTipo(m.tipo)} · <strong>${descrizioneMobile(m)}</strong></span></div>
    </section>
    ${puoAgg ? `
    <section class="step3-pannello">
      <h3>Aggiungi al modulo</h3>
      <div class="mob-azioni-grid">
        <button id="tog-placca" class="btn-ghost ${m.placca ? 'attivo' : ''}" type="button">
          ${m.placca ? '✓ ' : ''}Piano cottura (${fuochi} fuochi)
        </button>
        <button id="tog-lavello" class="btn-ghost ${m.lavello ? 'attivo' : ''}" type="button">
          ${m.lavello ? '✓ ' : ''}Lavello (${sinkCm} cm)
        </button>
      </div>
      <div class="riga-3d" style="margin-top:6px">La dimensione di piano cottura e lavello si adatta alla larghezza del modulo.</div>
    </section>` : `
    <section class="step3-pannello"><div class="riga-3d">${
      m.tipo === 'forno' ? 'Modulo con forno e piano cottura.' :
      m.tipo === 'lavello' ? 'Modulo con lavello.' :
      'Per aggiungere lavello o piano cottura seleziona una base con ante o cassetti.'}</div></section>`}
    ${gruppoColore ? `
    <section class="step3-pannello">
      <h3>Colore ${gruppoColore === 'costado' ? '' : 'ante '}· ${nomeGruppo}</h3>
      <div class="riga-3d" style="margin-bottom:6px">Si applica a tutti i ${nomeGruppo}.</div>
      <div class="palette-colori">
        ${materiali.map((mt) => `<button type="button" class="swatch ${mt.id === colAttuale ? 'sel' : ''}"
          data-mat="${mt.id}" title="${mt.nome}" style="background-image:url('${mt.thumb}')"></button>`).join('')}
      </div>
    </section>` : ''}
    ${isBase && materialiEncimera.length ? `
    <section class="step3-pannello">
      <h3>Piano di lavoro (encimera)</h3>
      <div class="riga-3d" style="margin-bottom:6px">Il piano cambia su tutta la cucina. Ogni encimera porta il suo spessore.</div>
      <div class="palette-colori">
        <button type="button" class="swatch swatch-none ${!encAttuale ? 'sel' : ''}" data-enc="" title="Nero standard (4 cm)">—</button>
        ${materialiEncimera.map((mt) => `<button type="button" class="swatch ${mt.id === encAttuale ? 'sel' : ''}"
          data-enc="${mt.id}" title="${mt.nome} (${mt.spessore || 40} mm)" style="background-image:url('${mt.thumb}')"></button>`).join('')}
      </div>
    </section>` : ''}
    ${cat === 'pensile' ? `
    <section class="step3-pannello">
      <h3>Ante pensili</h3>
      <div class="riga-3d" style="margin-bottom:6px">Vale per tutti i pensili.</div>
      <div class="opzioni-anta">
        ${[
          { id: 'standard', et: 'Standard (−2 mm h · −3 mm largh.)' },
          { id: 'sporg70', et: 'Sporgente sotto · 70 → 72' },
          { id: 'sporg90', et: 'Sporgente sotto · 90 → 92' },
        ].map((o) => `<button type="button" class="btn-ghost opt-anta ${(progetto.antaPensile || 'standard') === o.id ? 'attivo' : ''}"
          data-anta="${o.id}">${(progetto.antaPensile || 'standard') === o.id ? '✓ ' : ''}${o.et}</button>`).join('')}
      </div>
    </section>` : ''}
    <section class="actions">
      <button id="mob-misura" class="btn-ghost" type="button" style="flex:1">Cambia misura</button>
      <button id="mob-deseleziona" class="btn-ghost" type="button">Chiudi</button>
    </section>
    <section class="actions">
      <button id="s3-indietro" class="btn-ghost" type="button" style="flex:1">← Moduli alti</button>
    </section>`;
  pannello.querySelectorAll('.swatch[data-mat]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (!progetto.coloriFronti) progetto.coloriFronti = {};
    progetto.coloriFronti[gruppoColore] = b.dataset.mat;
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch[data-enc]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (!progetto.encimera) progetto.encimera = {};
    progetto.encimera.materiale = b.dataset.enc || null;
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-anta').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.antaPensile = b.dataset.anta;
    aggiorna();
  }));
  document.getElementById('tog-placca')?.addEventListener('click', () => {
    registraStoria(); m.placca = !m.placca; if (m.placca) m.lavello = false; aggiorna();
  });
  document.getElementById('tog-lavello')?.addEventListener('click', () => {
    registraStoria(); m.lavello = !m.lavello; if (m.lavello) m.placca = false; aggiorna();
  });
  document.getElementById('mob-misura')?.addEventListener('click', () => apriScelta(m.tipo, m.id));
  document.getElementById('mob-deseleziona')?.addEventListener('click', () => { step2.mobSelId = null; aggiorna(); });
  document.getElementById('s3-indietro')?.addEventListener('click', () => { step2.mobSelId = null; progetto.stepCorrente = 3; aggiorna(); });
}

function renderRiepilogoStep3d() {
  const conta = {};
  for (const m of (progetto.mobiliLiberi || [])) {
    const k = nomeTipo(m.tipo);
    conta[k] = (conta[k] || 0) + 1;
  }
  // Moduli fuori misura (da tagliare): larghezza non standard.
  const daTagliare = (progetto.mobiliLiberi || []).filter((m) => m.fuoriMisura);
  riepilogo.innerHTML = `
    <h3>Mobili in scena</h3>
    ${Object.keys(conta).length === 0
      ? '<div class="riep-riga"><span>Nessun mobile</span><strong>—</strong></div>'
      : Object.entries(conta).map(([k, v]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${v}</strong></div>`).join('')}
    <div class="riep-riga"><span>Totale pezzi</span><strong>${(progetto.mobiliLiberi || []).length}</strong></div>
    ${daTagliare.length ? `
    <h3 style="margin-top:18px">⚠ Da tagliare su misura</h3>
    <div class="riga-3d" style="margin-bottom:6px">Misura non standard: questi moduli vanno tagliati.</div>
    ${daTagliare.map((m) => `<div class="riep-riga avviso-taglio"><span>⚠ ${nomeTipo(m.tipo)}</span><strong>${m.larghezza_mm} mm</strong></div>`).join('')}
    ` : ''}
  `;
}

// Mostra/nasconde pianta 2D vs vista 3D e tiene aggiornata la scena
async function aggiornaVista() {
  const in3d = progetto.stepCorrente === 4;
  svg.style.display = in3d ? 'none' : '';
  canvas3d.hidden = !in3d;
  if (legenda3d) legenda3d.textContent = in3d
    ? 'Vista 3D · trascina per ruotare'
    : 'Griglia 100 mm · tutte le misure in mm';
  if (!in3d) return;
  try {
    const eraCaricato = !!scena3dMod;
    if (!scena3dMod) scena3dMod = await import('./scena3d.js?v=20261109k');
    if (!scena3dMontata) { scena3dMod.montaScena3d(canvas3d, progetto); scena3dMontata = true; }
    else { scena3dMod.aggiornaScena3d(progetto, false, step2.mobSelId); } // niente reframe: tiene la vista dove sei
    // Al primo caricamento del modulo 3D ri-render del pannello, così le liste
    // che vengono dal modulo (colori ante/zoccolo) compaiono subito.
    if (!eraCaricato) renderPannello();
    // Dopo lo "unhide" il canvas ha la dimensione giusta solo al frame dopo
    requestAnimationFrame(() => scena3dMod.forzaResize3d());
  } catch (e) {
    console.error('Errore vista 3D:', e);
    pannello.insertAdjacentHTML('afterbegin',
      '<section><div class="avviso-pannello">Impossibile avviare la vista 3D su questo dispositivo.</div></section>');
  }
}

// --------- AGGIORNA (render completo + autosalvataggio) ---------
function disegna() {
  const st = progetto.stepCorrente;
  if (st !== 4) {
    renderPianta(svg, progetto, {
      pareteAttivaId: st === 2 ? step2.pareteAttivaId : null,
      pareteSelId: st === 1 ? pareteSelId : null,
      mobSelId: step2.mobSelId,
      interattivo: st === 2 || st === 3,
      livelloAttivo: (st === 2 || st === 3) ? livelloStep() : null,
    });
  }
}
function aggiorna() {
  riorientaMobili(progetto);          // ante sempre verso l'interno (a parete)
  applicaRegletteAngolo(progetto);    // angolo cieco: apre il gap della regletta
  renderStepper();
  renderPannello();
  renderRiepilogo();
  renderPalette();
  disegna();
  aggiornaVista();
  aggiornaBottoniStoria();
  salvaProgetto(progetto);
}
function aggiornaSoloDisegno() {
  // Durante l'input continuo (es. digitazione) non rirenderizzo il pannello
  // intero per non perdere il focus sull'input.
  disegna();
  renderRiepilogo();
  salvaProgetto(progetto);
}

// --------- MOBILI LIBERI: palette, scelta misura, spostamento ---------
function iconaMobile(id) {
  const ic = {
    'base-ante': '<rect x="8" y="6" width="48" height="52"/><line x1="32" y1="6" x2="32" y2="58"/><line x1="26" y1="22" x2="26" y2="30"/><line x1="38" y1="22" x2="38" y2="30"/>',
    'base-cassetti': '<rect x="8" y="6" width="48" height="52"/><line x1="8" y1="22" x2="56" y2="22"/><line x1="8" y1="38" x2="56" y2="38"/><line x1="28" y1="14" x2="36" y2="14"/><line x1="28" y1="30" x2="36" y2="30"/><line x1="28" y1="46" x2="36" y2="46"/>',
    lavello: '<rect x="8" y="6" width="48" height="52"/><rect x="16" y="16" width="32" height="22" rx="3"/><line x1="32" y1="8" x2="32" y2="14"/>',
    lavastoviglie: '<rect x="8" y="6" width="48" height="52"/><line x1="8" y1="18" x2="56" y2="18"/><circle cx="18" cy="12" r="1.8"/><circle cx="26" cy="12" r="1.8"/><rect x="18" y="26" width="28" height="24" rx="2"/><line x1="26" y1="38" x2="38" y2="38"/>',
    forno: '<rect x="8" y="6" width="48" height="52"/><rect x="16" y="22" width="32" height="24" rx="2"/><line x1="16" y1="14" x2="48" y2="14"/><circle cx="20" cy="10" r="1.5"/><circle cx="28" cy="10" r="1.5"/><circle cx="36" cy="10" r="1.5"/>',
    pensile: '<rect x="8" y="14" width="48" height="36"/><line x1="32" y1="14" x2="32" y2="50"/><line x1="26" y1="28" x2="26" y2="36"/><line x1="38" y1="28" x2="38" y2="36"/>',
    'pensile-angolo': '<path d="M8 8 H30 V30 H56 V56 H8 Z" fill="none"/><line x1="18" y1="16" x2="18" y2="24"/><line x1="44" y1="40" x2="44" y2="48"/>',
    'pensile-angolo-45': '<path d="M10 10 H54 V54 H10 Z" fill="none"/><line x1="10" y1="34" x2="34" y2="54"/><line x1="20" y1="40" x2="28" y2="48"/>',
    colonna: '<rect x="18" y="4" width="28" height="56"/><line x1="18" y1="40" x2="46" y2="40"/><line x1="40" y1="20" x2="40" y2="26"/><line x1="40" y1="48" x2="40" y2="54"/>',
    regletta: '<polyline points="16,8 16,48 56,48" fill="none" stroke-width="7"/><polyline points="16,8 26,8 26,38 56,38 56,48" fill="none"/>',
    'regletta-grande': '<rect x="28" y="4" width="8" height="56"/><line x1="22" y1="4" x2="28" y2="8"/><line x1="22" y1="60" x2="28" y2="56"/>',
    'pannello-copertura': '<rect x="6" y="14" width="52" height="36"/><line x1="12" y1="20" x2="52" y2="20" stroke-dasharray="3 3"/><line x1="12" y1="44" x2="52" y2="44" stroke-dasharray="3 3"/>',
    costado: '<rect x="26" y="6" width="12" height="52"/><line x1="20" y1="6" x2="26" y2="10"/><line x1="20" y1="54" x2="26" y2="58"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${ic[id] || ic['base-ante']}</svg>`;
}

function renderPalette() {
  palette.hidden = !(progetto.stepCorrente === 2 || progetto.stepCorrente === 3);
  if (palette.hidden) return;
  const livello = livelloStep();
  // Il costado si può aggiungere sia nei bassi che negli alti
  const voci = CATALOGO_MOBILI.filter((t) => t.categoria === 'costado' || livelloMobile(t.categoria) === livello);
  palette.innerHTML = voci.map((t) => `
    <button type="button" class="palette-btn" data-tipo="${t.id}">
      ${iconaMobile(t.id)}<span>${t.nome}</span>
    </button>`).join('');
  palette.querySelectorAll('.palette-btn').forEach((b) => {
    b.addEventListener('click', () => apriScelta(b.dataset.tipo));
  });
}

function blocMobileSelezionato() {
  const m = trovaMobileLibero(progetto, step2.mobSelId);
  if (!m) return '';
  const cieco = categoriaTipo(m.tipo) === 'base' ? infoAngoloCieco(progetto, m) : null;
  const ra = progetto.reglettaAngolo || { base: 30, spessore: 18 };
  return `
    <section>
      <h3>Mobile selezionato</h3>
      <div class="mod-row ${m.tipo}"><span>${nomeTipo(m.tipo)} · <strong>${descrizioneMobile(m)}</strong></span></div>
      <div class="mob-azioni-grid">
        <button id="mob-ruota" class="btn-ghost" type="button">⟳ Ruota 90°</button>
        <button id="mob-isola" class="btn-ghost ${m.isola ? 'attivo' : ''}" type="button">${m.isola ? '✓ ' : ''}🏝 Isola (libero)</button>
        ${categoriaTipo(m.tipo) === 'base' && cieco ? `<button id="mob-cieco" class="btn-ghost attivo" type="button">✓ ⌐ Angolo cieco (auto) — togli</button>` : (categoriaTipo(m.tipo) === 'base' ? `<button id="mob-cieco" class="btn-ghost" type="button">⌐ Forza angolo cieco qui</button>` : '')}
        <button id="mob-misura" class="btn-ghost" type="button">Cambia misura</button>
        <button id="mob-elimina" class="btn-ghost" type="button">Elimina</button>
      </div>
      <div class="nudge">
        <label class="nudge-cm">Sposta di <input id="nudge-cm" type="number" value="1" min="0.1" step="0.5" inputmode="decimal"> cm</label>
        <div class="nudge-grid">
          <button id="nudge-su" class="btn-ghost" type="button" title="Su">↑</button>
          <button id="nudge-sx" class="btn-ghost" type="button" title="Sinistra">←</button>
          <button id="nudge-dx" class="btn-ghost" type="button" title="Destra">→</button>
          <button id="nudge-giu" class="btn-ghost" type="button" title="Giù">↓</button>
        </div>
      </div>
      <div class="mod-vuoto">${m.isola
        ? 'Isola/penisola: posizionalo dove vuoi e ruotalo a mano. Si attacca comunque agli altri mobili.'
        : 'Vicino al muro si orienta da solo (ante verso l’interno). Per una penisola attiva “Isola (libero)” e poi ruotalo.'}</div>
    </section>
    ${cieco ? `
    <section>
      <h3>Regletta a L d'angolo</h3>
      <div class="riga-3d" style="margin-bottom:6px">Misura a vista e spessore anta (un pezzo è base+spessore).</div>
      <div class="ra-campi">
        <label>Base (mm)<input id="ra-base" type="number" value="${ra.base}" min="5" step="1" inputmode="numeric"></label>
        <label>Spessore anta (mm)<input id="ra-spess" type="number" value="${ra.spessore}" min="0" step="1" inputmode="numeric"></label>
      </div>
      <div class="riga-3d" style="margin-top:4px">Pezzi: ${ra.base} mm e ${ra.base + ra.spessore} mm.</div>
    </section>` : ''}`;
}

/**
 * Finestra con le misure: si sceglie larghezza e (se il tipo ne ha più di una)
 * altezza, poi Conferma. Se mobId è dato, cambia la misura di quel mobile.
 */
let sceltaModale = null; // { tipoId, mobId, campi:[...], valori:{campo:v} }
function apriScelta(tipoId, mobId = null) {
  const tipo = infoTipo(tipoId);
  if (!tipo) return;
  const campi = campiMobile(tipoId);
  const esistente = mobId ? trovaMobileLibero(progetto, mobId) : null;
  const valori = {};
  for (const c of campi) {
    valori[c.campo] = esistente && esistente[c.campo] != null ? esistente[c.campo] : c.default;
  }
  // Costado nuovo negli "alti": profondità di default 350 (pensili); nei bassi 600
  if (tipoId === 'costado' && !esistente && livelloStep() === 'alto') {
    valori.profondita_mm = 350;
  }
  sceltaModale = { tipoId, mobId, campi, valori };
  document.getElementById('modale-titolo').textContent = `${tipo.nome}: che misura?`;
  const box = document.getElementById('modale-opzioni');
  const opz = (o) => (typeof o === 'object' ? o : { v: o, l: o });
  box.innerHTML = campi.map((c) => {
    if (c.tipo === 'numero') {
      return `
        <div class="modale-gruppo">
          <div class="modale-et">${c.et}</div>
          <input type="number" class="modale-num" data-campo="${c.campo}"
            value="${sceltaModale.valori[c.campo]}" min="${c.min || 1}" step="${c.step || 1}" />
          ${c.opzioni ? `<div class="modale-chips" data-campo="${c.campo}">
            ${c.opzioni.map((o) => `<button type="button" data-v="${o}">${o}</button>`).join('')}
          </div>` : ''}
        </div>`;
    }
    return `
      <div class="modale-gruppo">
        <div class="modale-et">${c.et}</div>
        <div class="modale-scelte" data-campo="${c.campo}">
          ${c.opzioni.map((o) => { const { v, l } = opz(o);
            return `<button type="button" data-v="${v}" data-num="${typeof o !== 'object'}">${l}</button>`; }).join('')}
        </div>
      </div>`;
  }).join('') + `
    <button id="modale-conferma" class="btn-oro" type="button" style="width:100%;margin-top:4px">
      ${mobId ? 'Aggiorna misura' : 'Aggiungi mobile'}
    </button>`;
  const segna = () => {
    box.querySelectorAll('.modale-scelte button').forEach((b) => {
      const campo = b.parentElement.dataset.campo;
      b.classList.toggle('sel', String(sceltaModale.valori[campo]) === b.dataset.v);
    });
  };
  box.querySelectorAll('.modale-scelte button').forEach((b) => {
    b.addEventListener('click', () => {
      const campo = b.parentElement.dataset.campo;
      sceltaModale.valori[campo] = b.dataset.num === 'true' ? Number(b.dataset.v) : b.dataset.v;
      segna();
    });
  });
  const segnaChips = () => {
    box.querySelectorAll('.modale-chips button').forEach((b) => {
      const campo = b.parentElement.dataset.campo;
      b.classList.toggle('sel', Number(b.dataset.v) === sceltaModale.valori[campo]);
    });
  };
  box.querySelectorAll('.modale-num').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      sceltaModale.valori[e.target.dataset.campo] = Math.max(1, Math.floor(Number(e.target.value) || 0));
      segnaChips();
    });
  });
  box.querySelectorAll('.modale-chips button').forEach((b) => {
    b.addEventListener('click', () => {
      const campo = b.parentElement.dataset.campo;
      const v = Number(b.dataset.v);
      sceltaModale.valori[campo] = v;
      const inp = box.querySelector(`.modale-num[data-campo="${campo}"]`);
      if (inp) inp.value = v;
      segnaChips();
    });
  });
  segnaChips();
  document.getElementById('modale-conferma').addEventListener('click', confermaScelta);
  segna();
  modale.hidden = false;
}
function confermaScelta() {
  const { tipoId, mobId, valori } = sceltaModale;
  registraStoria();
  if (mobId) {
    const m = trovaMobileLibero(progetto, mobId);
    if (m) Object.assign(m, valori);
    step2.mobSelId = mobId;
  } else {
    step2.mobSelId = aggiungiMobileLibero(progetto, tipoId, valori);
    // Nuovo mobile: se nasce vicino a un muro, orienta le ante verso l'interno
    const nuovo = trovaMobileLibero(progetto, step2.mobSelId);
    const rot = nuovo && orientaVersoMuro(progetto, nuovo, nuovo.x, nuovo.y);
    if (nuovo && rot !== null && rot !== undefined) nuovo.rot = rot;
  }
  riblocca(step2.mobSelId);
  chiudiModale();
  aggiorna();
}

/** Riporta un mobile dentro i muri dopo rotazione/cambio misura. */
function riblocca(id) {
  const m = trovaMobileLibero(progetto, id);
  if (!m) return;
  const v = posizionaVincolata(progetto, m, m.x, m.y);
  m.x = snap(v.x); m.y = snap(v.y);
}
function chiudiModale() { modale.hidden = true; }
document.getElementById('modale-annulla').addEventListener('click', chiudiModale);
modale.addEventListener('click', (e) => { if (e.target === modale) chiudiModale(); });

/** Coordinate di un evento puntatore in mm di pianta (y in su). */
function puntoMm(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: q.x, y: -q.y };
}

svg.addEventListener('pointerdown', (e) => {
  const mobEl = e.target.closest && e.target.closest('[data-mob-id]');
  const inModuli = progetto.stepCorrente === 2 || progetto.stepCorrente === 3;
  if (mobEl && inModuli) {
    const m = trovaMobileLibero(progetto, Number(mobEl.dataset.mobId));
    if (!m) return;
    // Solo i mobili del livello attivo sono spostabili: gli altri sono bloccati
    if (livelloDiMobile(m) !== livelloStep()) return;
    const p = puntoMm(e);
    registraStoria();
    trascinamento = { id: m.id, dx: m.x - p.x, dy: m.y - p.y, mosso: false };
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* puntatore non attivo */ }
    e.preventDefault();
    step2.mobSelId = m.id;
    return;
  }
  const hit = e.target.closest && e.target.closest('[data-parete-id]');
  if (hit && progetto.stepCorrente === 1) {
    const id = Number(hit.dataset.pareteId);
    pareteSelId = pareteSelId === id ? null : id;
    aggiorna();
    return;
  }
  // tocco sul vuoto: deseleziona
  if (step2.mobSelId !== null || pareteSelId !== null) {
    step2.mobSelId = null; pareteSelId = null; aggiorna();
  }
});
svg.addEventListener('pointermove', (e) => {
  if (!trascinamento) return;
  const m = trovaMobileLibero(progetto, trascinamento.id);
  if (!m) return;
  const p = puntoMm(e);
  // Aggancio alla griglia fine SOLO sulla posizione del dito; dopo i vincoli
  // (muri e collisioni) non ri-aggancio, così il mobile tocca il vicino esatto.
  const rx = snap(p.x + trascinamento.dx), ry = snap(p.y + trascinamento.dy);
  // Orienta le ante verso l'interno (solo i mobili con un fronte, non costadi/reglette)
  const haFronte = !['costado', 'regletta'].includes(categoriaTipo(m.tipo));
  const rot = haFronte ? orientaVersoMuro(progetto, m, rx, ry) : null;
  const rotCambiata = rot !== null && rot !== m.rot;
  if (rotCambiata) m.rot = rot;
  const v = posizionaVincolata(progetto, m, rx, ry);
  if (v.x !== m.x || v.y !== m.y || rotCambiata) {
    m.x = v.x; m.y = v.y;
    trascinamento.mosso = true;
    disegna();
  }
});
const fineTrascinamento = () => {
  if (!trascinamento) return;
  const mosso = trascinamento.mosso;
  trascinamento = null;
  // Tap senza spostamento: annullo lo snapshot registrato al pointerdown
  if (!mosso && storiaPast.length) storiaPast.pop();
  aggiorna();
};
svg.addEventListener('pointerup', fineTrascinamento);
svg.addEventListener('pointercancel', fineTrascinamento);

// Tema chiaro/scuro
agganciaTema();

// Primo caricamento
aggiorna();
