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
  TIPI_MODULO_BASE, LARGHEZZE_BASE, nomeTipo,
  spazioLiberoParete, moduliDiParete,
  aggiungiModuloBase, aggiungiFascia,
  rimuoviModuloBase, rimuoviFascia,
  spostaModulo, problemiIngombri,
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
};

// --------- DISPATCH principale: sceglie lo step attivo ---------
function renderPannello() {
  if (progetto.stepCorrente === 2) return renderPannelloStep2();
  return renderPannelloStep1();
}
function renderRiepilogo() {
  if (progetto.stepCorrente === 2) return renderRiepilogoStep2();
  return renderRiepilogoStep1();
}
const NOMI_STEP = {
  1: 'Pianta: perimetro',
  2: 'Moduli base',
  3: '3D + moduli alti',
  4: 'Fronti',
};
function step2Disponibile() {
  return progetto.pianoConfermato && progetto.piano.pareti.length > 0;
}
// Stepper in alto: evidenzia lo step attivo, abilita quelli raggiungibili
function renderStepper() {
  if (progetto.stepCorrente !== 1 && !step2Disponibile()) progetto.stepCorrente = 1;
  document.querySelectorAll('#stepper .step').forEach((btn) => {
    const n = Number(btn.dataset.step);
    const abilitato = n === 1 || (n === 2 && step2Disponibile());
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
      <div id="pareti-list">
        ${progetto.piano.pareti.map((p, i) => `
          <div class="parete-card" data-id="${p.id}">
            <header>
              Parete ${i + 1}
              <button class="btn-mini p-rimuovi" type="button" data-id="${p.id}">rimuovi</button>
            </header>
            <label>Lunghezza (mm)
              <input type="number" class="p-lung" data-id="${p.id}"
                value="${p.lunghezza_mm}" min="100" step="10" />
            </label>
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
  const perimetroTotale = pareti.reduce((s, p) => s + p.lunghezza_mm, 0);
  const tipo = TIPOLOGIE.find((t) => t.id === progetto.piano.tipologia);
  riepilogo.innerHTML = `
    <h3>Riepilogo pianta</h3>
    <div class="riep-riga"><span>Tipologia</span><strong>${tipo ? tipo.nome : '—'}</strong></div>
    <div class="riep-riga"><span>N° pareti</span><strong>${pareti.length}</strong></div>
    <div class="riep-riga"><span>Perimetro interno</span><strong>${perimetroTotale} mm</strong></div>
    <div class="riep-riga"><span>Stato</span><strong>${progetto.pianoConfermato ? 'Confermato' : 'In modifica'}</strong></div>

    <h3 style="margin-top:20px">Prossimi step</h3>
    <div class="riep-riga" style="opacity:${step2Disponibile() ? 1 : .5}"><span>Step 2</span><strong>Moduli base</strong></div>
    <div class="riep-riga" style="opacity:.5"><span>Step 3</span><strong>3D + alti</strong></div>
    <div class="riep-riga" style="opacity:.5"><span>Step 4</span><strong>Fronti</strong></div>
  `;
}

// --------- EVENTI PANNELLO ---------
function attaccaEventiPannello() {
  // Preset tipologia
  pannello.querySelectorAll('.tipo-card').forEach((btn) => {
    btn.addEventListener('click', () => {
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
      p.latoInterno = p.latoInterno === 'interno' ? 'esterno' : 'interno';
      progetto.pianoConfermato = false;
      aggiorna();
    });
  });
  // Rimuovi parete (solo personalizzata)
  pannello.querySelectorAll('.p-rimuovi').forEach((btn) => {
    btn.addEventListener('click', () => {
      rimuoviParete(progetto, Number(btn.dataset.id));
      aggiorna();
    });
  });
  // Aggiungi parete
  const btnAdd = document.getElementById('btn-aggiungi-parete');
  if (btnAdd) btnAdd.addEventListener('click', () => {
    aggiungiParete(progetto, 2000);
    aggiorna();
  });
  // Conferma pianta
  const btnConf = document.getElementById('btn-conferma');
  if (btnConf) btnConf.addEventListener('click', () => {
    progetto.pianoConfermato = !progetto.pianoConfermato;
    // Appena confermata la pianta si passa direttamente ai moduli base
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
  const pareti = progetto.piano.pareti;
  let p = pareti.find((x) => x.id === step2.pareteAttivaId);
  if (!p) { p = pareti[0]; step2.pareteAttivaId = p ? p.id : null; }
  return p;
}

function renderPannelloStep2() {
  const pareti = progetto.piano.pareti;
  const parete = pareteAttiva();
  const idx = pareti.indexOf(parete);
  const s = spazioLiberoParete(progetto, parete.id);
  const perc = Math.min(100, Math.max(0, (s.occupato / (s.totale || 1)) * 100));
  const tipo = TIPI_MODULO_BASE.find((t) => t.id === step2.tipoSelezionato) || TIPI_MODULO_BASE[0];
  if (!tipo.larghezze.includes(step2.larghezzaSelezionata)) {
    step2.larghezzaSelezionata = tipo.larghezze.includes(600) ? 600 : tipo.larghezze[0];
  }
  const mods = moduliDiParete(progetto, parete.id);
  const problemi = problemiIngombri(progetto);

  pannello.innerHTML = `
    <section>
      <h3>Parete attiva</h3>
      <div class="sel-parete-row">
        ${pareti.map((p, i) => {
          const conProblemi = problemi.some((x) => x.pareti.includes(p.id));
          return `<button type="button" class="sel-parete-pill ${p.id === parete.id ? 'sel' : ''}"
            data-id="${p.id}">Parete ${i + 1}${conProblemi ? ' ⚠' : ''}</button>`;
        }).join('')}
      </div>
      <div class="spazio-barra">
        <span class="occupato">Occupato ${s.occupato} / ${s.totale} mm</span>
        <span class="libero ${s.libero > 0 ? 'ok' : 'pieno'}">Libero ${s.libero} mm</span>
      </div>
      <div class="barra-progresso"><div class="riempita" style="width:${perc}%"></div></div>
    </section>

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
    </section>

    ${problemi.length ? `
      <section>
        <h3>Da sistemare</h3>
        ${problemi.map((x) => `<div class="avviso-pannello">${x.messaggio}</div>`).join('')}
      </section>` : ''}

    <section class="actions">
      <button id="s2-indietro" class="btn-ghost" type="button">← Pianta</button>
      <button id="s2-conferma" class="btn-oro" type="button" style="flex:1"
        ${problemi.length || !progetto.moduliBase.length ? 'disabled' : ''}>
        ${progetto.moduliBaseConfermati ? 'Sblocca moduli' : 'Conferma moduli base'}
      </button>
    </section>
    <div class="conferma-stato ${progetto.moduliBaseConfermati ? 'ok' : 'non-conf'}">
      ${progetto.moduliBaseConfermati
        ? '✓ Moduli base confermati — lo Step 3 sarà disponibile presto'
        : problemi.length ? 'Risolvi gli avvisi per confermare'
        : !progetto.moduliBase.length ? 'Aggiungi almeno un modulo' : 'Moduli non ancora confermati'}
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
  document.getElementById('s2-tipo').addEventListener('change', (e) => {
    step2.tipoSelezionato = e.target.value;
    fatto();
  });
  document.getElementById('s2-larg').addEventListener('change', (e) => {
    step2.larghezzaSelezionata = Number(e.target.value);
  });
  document.getElementById('s2-aggiungi').addEventListener('click', () => {
    fatto(aggiungiModuloBase(progetto, pareteId, step2.tipoSelezionato, step2.larghezzaSelezionata));
  });
  const inpFascia = document.getElementById('s2-fascia');
  inpFascia.addEventListener('input', (e) => {
    step2.fasciaLarghezza = Math.max(1, Math.floor(Number(e.target.value) || 0));
  });
  document.getElementById('s2-fascia-add').addEventListener('click', () => {
    fatto(aggiungiFascia(progetto, pareteId, step2.fasciaLarghezza));
  });
  document.getElementById('s2-fascia-riempi').addEventListener('click', () => {
    const libero = spazioLiberoParete(progetto, pareteId).libero;
    if (libero > 0) fatto(aggiungiFascia(progetto, pareteId, libero));
  });
  pannello.querySelectorAll('.s2-sposta').forEach((btn) => {
    btn.addEventListener('click', () => {
      spostaModulo(progetto, btn.dataset.cat, Number(btn.dataset.id), Number(btn.dataset.dir));
      fatto();
    });
  });
  pannello.querySelectorAll('.s2-rimuovi').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.cat === 'fascia') rimuoviFascia(progetto, id);
      else rimuoviModuloBase(progetto, id);
      fatto();
    });
  });
  document.getElementById('s2-indietro').addEventListener('click', () => {
    progetto.stepCorrente = 1;
    fatto();
  });
  document.getElementById('s2-conferma').addEventListener('click', () => {
    progetto.moduliBaseConfermati = !progetto.moduliBaseConfermati;
    fatto();
  });
}

// --------- RENDER RIEPILOGO (destra) — STEP 2 ---------
function renderRiepilogoStep2() {
  const pareti = progetto.piano.pareti;
  const conteggio = {};
  for (const m of progetto.moduliBase) {
    const k = `${nomeTipo(m.tipo)} ${m.larghezza_mm}`;
    conteggio[k] = (conteggio[k] || 0) + 1;
  }
  const totFasce = progetto.fasce.reduce((s, f) => s + f.larghezza_mm, 0);
  const lineari = progetto.moduliBase.reduce((s, m) => s + m.larghezza_mm, 0);
  riepilogo.innerHTML = `
    <h3>Riepilogo moduli base</h3>
    ${pareti.map((p, i) => {
      const s = spazioLiberoParete(progetto, p.id);
      return `<div class="riep-riga"><span>Parete ${i + 1} (${s.totale})</span>
        <strong>${s.libero === 0 ? '✓ piena' : `${s.libero} libero`}</strong></div>`;
    }).join('')}

    <h3 style="margin-top:20px">Moduli</h3>
    ${Object.keys(conteggio).length === 0
      ? '<div class="riep-riga"><span>Nessun modulo</span><strong>—</strong></div>'
      : Object.entries(conteggio).map(([k, n]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${n}</strong></div>`).join('')}
    <div class="riep-riga"><span>Fasce (totale)</span><strong>${progetto.fasce.length} · ${totFasce} mm</strong></div>
    <div class="riep-riga"><span>Metri lineari moduli</span><strong>${(lineari / 1000).toFixed(2)} m</strong></div>
    <div class="riep-riga"><span>Stato</span><strong>${progetto.moduliBaseConfermati ? 'Confermato' : 'In modifica'}</strong></div>
  `;
}

// --------- AGGIORNA (render completo + autosalvataggio) ---------
function aggiorna() {
  renderStepper();
  renderPannello();
  renderRiepilogo();
  renderPianta(svg, progetto,
    progetto.stepCorrente === 2 ? step2.pareteAttivaId : null);
  salvaProgetto(progetto);
}
function aggiornaSoloDisegno() {
  // Durante l'input continuo (es. digitazione) non rirenderizzo il pannello
  // intero per non perdere il focus sull'input.
  renderPianta(svg, progetto);
  renderRiepilogo();
  salvaProgetto(progetto);
}

// Primo caricamento
aggiorna();
