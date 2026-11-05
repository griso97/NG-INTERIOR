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
  infoTipo, altezzeTipo, campiMobile, descrizioneMobile, categoriaTipo,
  spazioLiberoParete, moduliDiParete,
  aggiungiModuloBase, aggiungiFascia,
  rimuoviModuloBase, rimuoviFascia,
  spostaModulo, problemiIngombri,
  ruotaPianta, specchiaPianta, inverteAngolo,
  toggleParete, muroTolto, snap, liberoPareti,
  aggiungiMobileLibero, trovaMobileLibero, ruotaMobileLibero, rimuoviMobileLibero,
  vincolaAiMuri, posizionaVincolata,
} from './modello.js';
import { renderPianta } from './pianta.js';
import { salvaProgetto, caricaProgetto, resetProgetto } from './storage.js';

// --- Stato iniziale: ultimo progetto salvato, oppure default ---
let progetto = caricaProgetto() || progettoDefault();
if (!progetto.stepCorrente) progetto.stepCorrente = 1;
// Progetti salvati con versioni precedenti: completo i campi mancanti
progetto = { ...progettoDefault(), ...progetto };

const pannello = document.getElementById('cucina-pannello');
const riepilogo = document.getElementById('cucina-riepilogo');
const svg = document.getElementById('pianta-svg');
const stepInfo = document.getElementById('step-info');

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

    <section class="actions">
      <button id="btn-conferma" class="btn-oro" type="button" style="flex:1">
        ${progetto.pianoConfermato ? 'Sblocca pianta' : 'Conferma pianta →'}
      </button>
      <button id="btn-reset" class="btn-ghost" type="button">Reset</button>
    </section>
    <div class="conferma-stato ${progetto.pianoConfermato ? 'ok' : 'non-conf'}">
      ${!progetto.pianoConfermato
        ? 'Pianta non ancora confermata'
        : progetto.piano.pareti.length === 0
          ? '✓ Pianta confermata — i moduli per l\'isola arriveranno in un passo successivo'
          : '✓ Pianta confermata'}
    </div>
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
  const problemi = problemiIngombri(progetto);
  const haContenuto = (progetto.mobiliLiberi || []).length > 0;
  const livello = livelloStep();
  const nMobiliLivello = (progetto.mobiliLiberi || [])
    .filter((m) => livelloMobile(categoriaTipo(m.tipo)) === livello).length;

  pannello.innerHTML = `
    <section>
      <h3>Parete attiva</h3>
      <div class="sel-parete-row">
        ${pareti.map((p, i) => {
          const conProblemi = problemi.some((x) => x.pareti.includes(p.id));
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

    ${livello === 'alto' ? `
    <section>
      <div class="riga-3d">Posiziona i <strong>pensili</strong> dalla barra qui sotto.
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
  const mobSel = trovaMobileLibero(progetto, step2.mobSelId);
  if (mobSel) {
    document.getElementById('mob-ruota').addEventListener('click', () => {
      registraStoria();
      ruotaMobileLibero(progetto, mobSel.id);
      riblocca(mobSel.id);
      fatto();
    });
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

function renderPannelloStep3d() {
  const n = (progetto.mobiliLiberi || []).length;
  pannello.innerHTML = `
    <section class="step3-pannello">
      <h3>Vista 3D</h3>
      <div class="riga-3d">
        Trascina per <strong>ruotare</strong>, due dita o rotella per lo
        <strong>zoom</strong>, due dita/tasto destro per <strong>spostare</strong>.
      </div>
    </section>
    <section class="step3-pannello">
      <h3>Legenda altezze</h3>
      <div class="riga-3d">
        • Basi: altezza scelta (zoccolo 100 + piano 40)<br>
        • Pensili: appesi a 140 cm da terra<br>
        • Colonne: a tutta altezza<br>
        • Reglette: a terra come filler d'angolo
      </div>
    </section>
    <section class="actions">
      <button id="s3-indietro" class="btn-ghost" type="button" style="flex:1">← Moduli alti</button>
    </section>`;
  const b = document.getElementById('s3-indietro');
  if (b) b.addEventListener('click', () => { progetto.stepCorrente = 3; aggiorna(); });
}

function renderRiepilogoStep3d() {
  const conta = {};
  for (const m of (progetto.mobiliLiberi || [])) {
    const k = nomeTipo(m.tipo);
    conta[k] = (conta[k] || 0) + 1;
  }
  riepilogo.innerHTML = `
    <h3>Mobili in scena</h3>
    ${Object.keys(conta).length === 0
      ? '<div class="riep-riga"><span>Nessun mobile</span><strong>—</strong></div>'
      : Object.entries(conta).map(([k, v]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${v}</strong></div>`).join('')}
    <div class="riep-riga"><span>Totale pezzi</span><strong>${(progetto.mobiliLiberi || []).length}</strong></div>
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
    if (!scena3dMod) scena3dMod = await import('./scena3d.js');
    if (!scena3dMontata) { scena3dMod.montaScena3d(canvas3d, progetto); scena3dMontata = true; }
    else { scena3dMod.aggiornaScena3d(progetto, true); }
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
    forno: '<rect x="8" y="6" width="48" height="52"/><rect x="16" y="22" width="32" height="24" rx="2"/><line x1="16" y1="14" x2="48" y2="14"/><circle cx="20" cy="10" r="1.5"/><circle cx="28" cy="10" r="1.5"/><circle cx="36" cy="10" r="1.5"/>',
    pensile: '<rect x="8" y="14" width="48" height="36"/><line x1="32" y1="14" x2="32" y2="50"/><line x1="26" y1="28" x2="26" y2="36"/><line x1="38" y1="28" x2="38" y2="36"/>',
    colonna: '<rect x="18" y="4" width="28" height="56"/><line x1="18" y1="40" x2="46" y2="40"/><line x1="40" y1="20" x2="40" y2="26"/><line x1="40" y1="48" x2="40" y2="54"/>',
    regletta: '<polyline points="16,8 16,48 56,48" fill="none" stroke-width="7"/><polyline points="16,8 26,8 26,38 56,38 56,48" fill="none"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${ic[id] || ic['base-ante']}</svg>`;
}

function renderPalette() {
  palette.hidden = !(progetto.stepCorrente === 2 || progetto.stepCorrente === 3);
  if (palette.hidden) return;
  const livello = livelloStep();
  const voci = CATALOGO_MOBILI.filter((t) => livelloMobile(t.categoria) === livello);
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
  return `
    <section>
      <h3>Mobile selezionato</h3>
      <div class="mod-row ${m.tipo}"><span>${nomeTipo(m.tipo)} · <strong>${descrizioneMobile(m)}</strong></span></div>
      <div class="mob-azioni-grid">
        <button id="mob-ruota" class="btn-ghost" type="button">⟳ Ruota 90°</button>
        <button id="mob-misura" class="btn-ghost" type="button">Cambia misura</button>
        <button id="mob-elimina" class="btn-ghost" type="button">Elimina</button>
      </div>
      <div class="mod-vuoto">Trascina il mobile sulla pianta per spostarlo (scatta ogni 50 mm).</div>
    </section>`;
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
  box.querySelectorAll('.modale-num').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      sceltaModale.valori[e.target.dataset.campo] = Math.max(1, Math.floor(Number(e.target.value) || 0));
    });
  });
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
    if (livelloMobile(categoriaTipo(m.tipo)) !== livelloStep()) return;
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
  // Posizione richiesta dal dito, poi bloccata dentro i muri, poi agganciata
  const v = posizionaVincolata(progetto, m, p.x + trascinamento.dx, p.y + trascinamento.dy);
  const nx = snap(v.x), ny = snap(v.y);
  if (nx !== m.x || ny !== m.y) {
    m.x = nx; m.y = ny;
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

// Primo caricamento
aggiorna();
