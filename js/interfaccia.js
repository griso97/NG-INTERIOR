// =============================================================================
// PANNELLO PARAMETRI (sidebar sinistra)
// =============================================================================
// Costruisce i controlli di input e chiama onChange(config) a ogni modifica.
// La config è l'unica fonte di verità, qui si leggono i valori e si notifica
// l'esterno (main.js).
// =============================================================================

import { MATERIALI, PARTI, materialiDefault, materialiPer } from './materiali.js?v=20261113s';

export function configDefault() {
  return {
    meta: { cliente: '' },
    tipoArmadio: 'battente', // 'battente' | 'scorrevole'
    sfondo: 'chiaro',        // sfondo vista 3D: chiaro | neutro | scuro
    larghezzaTotale: 2000,
    altezzaEsterna: 2400,
    profonditaEsterna: 600,
    spessoreCarcassa: 18,
    spessoreSchiena: 10,
    spessoreAnte: 18,
    setupCarcassa: 1,
    moduliPersonalizzati: false, // false = tutti uguali (L/N); true = l'utente sceglie ogni larghezza
    materiali: materialiDefault(),
    moduli: [
      { larghezza: 1000, numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] },
      { larghezza: 1000, numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] },
    ],
    scorrevole: {
      anteModulo: 2, // ante per modulo (default: 2, scorrono una davanti all'altra)
      binario: 75,   // 75 default, oppure 85
    },
    cassettiere: [], // lista GLOBALE di cassettiere; ciascuna ha `moduli: [i,...]`
    tamponamenti: {
      sx: { attivo: false, larghezza: 50 },
      dx: { attivo: false, larghezza: 50 },
      sopra: { attivo: false, larghezza: 50 },
      sotto: { attivo: false, larghezza: 50 },
    },
  };
}

export function renderPannello(contenitore, config, onChange) {
  // Normalizza all'avvio: la larghezza di ogni modulo è sempre
  // totale/n (parti uguali), l'utente sceglie solo "quanti moduli".
  ripartisciModuli(config);
  contenitore.innerHTML = `
    <section>
      <h3>Lavoro</h3>
      <label>Cliente / Riferimento
        <input type="text" id="meta-cliente" value="${attr(config.meta?.cliente)}" placeholder="Es. Sig.ra Rossi — camera matrim." />
      </label>
    </section>

    <section>
      <h3>Tipo armadio</h3>
      <div class="radio-row">
        <label class="radio">
          <input type="radio" name="tipo" value="battente" ${config.tipoArmadio !== 'scorrevole' ? 'checked' : ''} />
          <span>A battente</span>
        </label>
        <label class="radio">
          <input type="radio" name="tipo" value="scorrevole" ${config.tipoArmadio === 'scorrevole' ? 'checked' : ''} />
          <span>Scorrevole</span>
        </label>
      </div>
    </section>

    <section>
      <h3>Dimensioni esterne</h3>
      <div class="grid-3">
        <label>Larghezza (mm)
          <input type="number" id="dim-W" value="${config.larghezzaTotale}" min="200" step="1" />
        </label>
        <label>Altezza (mm)
          <input type="number" id="dim-H" value="${config.altezzaEsterna}" min="200" step="1" />
        </label>
        <label>Profondità (mm)
          <input type="number" id="dim-D" value="${config.profonditaEsterna}" min="100" step="1" />
        </label>
      </div>
    </section>

    <section>
      <h3>Spessori (mm)</h3>
      <div class="grid-3">
        <label>Carcassa
          <input type="number" id="sp-carc" value="${config.spessoreCarcassa}" min="5" step="1" />
        </label>
        <label>Schiena
          <input type="number" id="sp-schiena" value="${config.spessoreSchiena}" min="3" step="1" />
        </label>
        <label>Ante
          <input type="number" id="sp-ante" value="${config.spessoreAnte}" min="5" step="1" />
        </label>
      </div>
    </section>

    <section id="sez-setup" ${config.tipoArmadio === 'scorrevole' ? 'style="display:none"' : ''}>
      <h3>Setup carcassa</h3>
      <div class="radio-row">
        <label class="radio">
          <input type="radio" name="setup" value="1" ${config.setupCarcassa === 1 ? 'checked' : ''} />
          <span>Setup 1 — top/fondo passanti (default)</span>
        </label>
        <label class="radio">
          <input type="radio" name="setup" value="2" ${config.setupCarcassa === 2 ? 'checked' : ''} />
          <span>Setup 2 — fianchi passanti</span>
        </label>
      </div>
      <p class="hint">(Solo battente. Lo scorrevole ha un unico setup.)</p>
    </section>

    <section id="sez-scorrevole" ${config.tipoArmadio === 'scorrevole' ? '' : 'style="display:none"'}>
      <h3>Scorrevole</h3>
      <div class="grid-2">
        <label>Nº ante per modulo
          <input type="number" id="sc-n" value="${config.scorrevole?.anteModulo ?? 2}" min="1" max="4" step="1" />
        </label>
        <label>Binario (mm)
          <select id="sc-bin">
            <option value="75" ${(config.scorrevole?.binario ?? 75) === 75 ? 'selected' : ''}>75 (default)</option>
            <option value="85" ${(config.scorrevole?.binario ?? 75) === 85 ? 'selected' : ''}>85</option>
          </select>
        </label>
      </div>
      <p class="hint">Default: 2 ante per modulo, scorrono una davanti all'altra. Il binario non entra nella distinta (è a parte).</p>
      <p class="hint">Formula ante: larghezza = <code>Lm − 25</code>, altezza = <code>H − 47</code>.</p>
    </section>

    <section>
      <h3>Moduli (carcassa)</h3>
      <label>In quanti moduli dividere la larghezza
        <input type="number" id="n-moduli" value="${config.moduli.length}" min="1" max="10" step="1" />
      </label>
      <div class="radio-row" style="margin-top:10px">
        <label class="radio">
          <input type="radio" name="mod-tipo" value="uguali" ${!config.moduliPersonalizzati ? 'checked' : ''} />
          <span>Tutti uguali (divisione automatica)</span>
        </label>
        <label class="radio">
          <input type="radio" name="mod-tipo" value="personalizzati" ${config.moduliPersonalizzati ? 'checked' : ''} />
          <span>Moduli diversi (misura e ante per modulo)</span>
        </label>
      </div>
      <div id="moduli-larghezze"></div>
      <p class="hint" id="moduli-check"></p>
      <div id="moduli-list"></div>
    </section>

    <section>
      <h3>Cassettiere</h3>
      <div id="cass-list"></div>
      <button id="btn-cass-add" class="btn-oro" type="button" style="margin-top:8px">+ Aggiungi cassettiera</button>
      <p class="hint">Scegli in quali moduli metterla con i pulsanti "Modulo N". Battente: sez. 5BIS · Scorrevole: sez. 5 (con opzione maniglia).</p>
    </section>

    <section>
      <h3>Tamponamenti</h3>
      <div id="tamp-list"></div>
    </section>

    <section>
      <h3>Materiali</h3>
      <div id="mat-list"></div>
    </section>

    <section class="actions">
      <button id="btn-salva" class="btn-oro">Salva (locale)</button>
      <button id="btn-export-json" class="btn-oro">Esporta JSON</button>
      <label class="btn-oro file-label">Importa JSON
        <input type="file" id="file-import" accept="application/json" hidden />
      </label>
      <button id="btn-reset" class="btn-ghost">Reset</button>
    </section>
  `;

  // Assicura che la config abbia tutti i materiali definiti
  config.materiali = { ...materialiDefault(), ...(config.materiali || {}) };
  // Migrazione: vecchie cassettiere per-modulo → globali
  if (!config.cassettiere) config.cassettiere = [];
  const vecchie = (config.moduli[0]?.cassettiere) || [];
  if (config.cassettiere.length === 0 && vecchie.length > 0) {
    config.cassettiere = vecchie.map((c) => ({
      ...c, moduli: config.moduli.map((_, i) => i),
    }));
  }
  config.moduli.forEach((m) => { delete m.cassettiere; });
  renderModuli(config);
  renderLarghezzeModuli(config);
  renderCassettiere(config);
  renderTamponamenti(config);
  renderMateriali(config);

  // ======== Collegamento eventi ========
  const bind = (id, handler, evento = 'input') => {
    const el = contenitore.querySelector(id);
    if (el) el.addEventListener(evento, handler);
  };

  bind('#meta-cliente', (e) => { config.meta.cliente = e.target.value; onChange(config, { leggero: true }); });
  bind('#dim-W', (e) => {
    config.larghezzaTotale = toNum(e.target.value, 200);
    // In modalità "tutti uguali" ridistribuisce; in "personalizzati"
    // aggiorna solo l'indicatore di somma (l'utente riaggiusta a mano).
    ripartisciModuli(config);
    renderModuli(config);
    attaccaEventiModuli(contenitore, config, onChange);
    renderLarghezzeModuli(config);
    attaccaEventiLarghezzeModuli(contenitore, config, onChange);
    onChange(config);
  });
  bind('#dim-H', (e) => { config.altezzaEsterna = toNum(e.target.value, 200); onChange(config); });
  bind('#dim-D', (e) => { config.profonditaEsterna = toNum(e.target.value, 100); onChange(config); });
  bind('#sp-carc', (e) => { config.spessoreCarcassa = toNum(e.target.value, 5); onChange(config); });
  bind('#sp-schiena', (e) => { config.spessoreSchiena = toNum(e.target.value, 3); onChange(config); });
  bind('#sp-ante', (e) => { config.spessoreAnte = toNum(e.target.value, 5); onChange(config); });

  contenitore.querySelectorAll('input[name="setup"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      config.setupCarcassa = Number(e.target.value);
      onChange(config);
    });
  });

  // Selettore tipo armadio (battente / scorrevole)
  contenitore.querySelectorAll('input[name="tipo"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      config.tipoArmadio = e.target.value;
      const scorrevole = e.target.value === 'scorrevole';
      const sezSc = document.getElementById('sez-scorrevole');
      const sezSetup = document.getElementById('sez-setup');
      if (sezSc) sezSc.style.display = scorrevole ? '' : 'none';
      if (sezSetup) sezSetup.style.display = scorrevole ? 'none' : '';
      renderModuli(config);
      attaccaEventiModuli(contenitore, config, onChange);
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      onChange(config);
    });
  });

  // Parametri scorrevole
  bind('#sc-n', (e) => {
    config.scorrevole.anteModulo = Math.max(1, Math.round(Number(e.target.value) || 2));
    onChange(config);
  });
  bind('#sc-bin', (e) => {
    const v = Number(e.target.value);
    config.scorrevole.binario = (v === 85) ? 85 : 75;
    onChange(config);
  }, 'change');

  bind('#n-moduli', (e) => {
    const n = Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1)));
    ripartisciModuli(config, n);
    // Sanifica gli indici moduli nelle cassettiere: elimina quelli fuori range
    (config.cassettiere || []).forEach((cas) => {
      if (Array.isArray(cas.moduli)) cas.moduli = cas.moduli.filter((i) => i < n);
    });
    renderModuli(config);
    attaccaEventiModuli(contenitore, config, onChange);
    renderLarghezzeModuli(config);
    attaccaEventiLarghezzeModuli(contenitore, config, onChange);
    renderCassettiere(config);
    attaccaEventiCassettiere(contenitore, config, onChange);
    onChange(config);
  });

  attaccaEventiModuli(contenitore, config, onChange);
  attaccaEventiLarghezzeModuli(contenitore, config, onChange);
  attaccaEventiCassettiere(contenitore, config, onChange);
  attaccaEventiTamponamenti(contenitore, config, onChange);
  attaccaEventiMateriali(contenitore, config, onChange);

  // Radio "tutti uguali" vs "personalizzati"
  contenitore.querySelectorAll('input[name="mod-tipo"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      const personalizzati = e.target.value === 'personalizzati';
      config.moduliPersonalizzati = personalizzati;
      if (!personalizzati) {
        // Riporta le larghezze a L/n uguali per tutti
        ripartisciModuli(config);
      }
      renderLarghezzeModuli(config);
      attaccaEventiLarghezzeModuli(contenitore, config, onChange);
      renderModuli(config);
      attaccaEventiModuli(contenitore, config, onChange);
      onChange(config);
    });
  });

  // Pulsanti globali
  bind('#btn-reset', () => {
    if (confirm('Reset configurazione?')) onChange(configDefault(), { reset: true });
  }, 'click');

  // I pulsanti salva/export/import vengono gestiti in main.js
  // (sono qui per il layout, main.js li aggancia dopo il render)
}

/**
 * Mostra UNA sola card con le impostazioni che valgono per tutti i moduli
 * (ante, ripiani, riduzione, cassettiere). I moduli sono tutti identici
 * tra loro: cambiando qui si aggiornano tutti insieme.
 */
function renderModuli(config) {
  const wrap = document.getElementById('moduli-list');
  if (!wrap) return;
  const scorrevole = config.tipoArmadio === 'scorrevole';

  // --- MODALITÀ "DIMENSIONI PERSONALIZZATE": una card per OGNI modulo ---
  // Ogni modulo è indipendente: larghezza, nº ante, nº ripiani e riduzione
  // propri. La larghezza ha un tetto massimo = spazio ancora libero, così
  // la somma dei moduli non può mai superare la larghezza totale.
  if (config.moduliPersonalizzati) {
    wrap.innerHTML = config.moduli.map((m, i) => `
      <div class="modulo-card" data-i="${i}">
        <header>Modulo ${i + 1}</header>
        <div class="grid-2">
          <label>Larghezza (mm)
            <input type="number" class="m-lar" data-i="${i}" value="${m.larghezza}"
              min="100" max="${maxLarghezzaModulo(config, i)}" step="1" />
          </label>
          ${scorrevole ? '' : `
          <label>Nº ante
            <input type="number" class="m-ante" data-i="${i}" value="${m.numeroAnte}" min="1" max="6" step="1" />
          </label>
          ${campoLatoApertura(m)}`}
          <label>Nº ripiani
            <input type="number" class="m-ripiani" data-i="${i}" value="${m.ripiani}" min="0" max="20" step="1" />
          </label>
          <label>Riduzione ripiano (mm)
            <input type="number" class="m-rid" data-i="${i}" value="${m.riduzioneRipiano || 0}" min="0" step="1" />
          </label>
        </div>
      </div>
    `).join('');
    aggiornaControlloSommaModuli(config);
    return;
  }

  // --- MODALITÀ "TUTTI UGUALI": UNA sola card condivisa (vale per tutti) ---
  const m = config.moduli[0] || { numeroAnte: 2, ripiani: 3, riduzioneRipiano: 0, cassettiere: [] };
  const larModulo = m.larghezza || Math.round(config.larghezzaTotale / config.moduli.length);
  wrap.innerHTML = `
    <div class="modulo-card">
      <header>Impostazioni di ogni modulo · ${larModulo} mm</header>
      <div class="grid-2">
        ${scorrevole ? '' : `
        <label>Nº ante per modulo
          <input type="number" class="m-ante" value="${m.numeroAnte}" min="1" max="6" step="1" />
        </label>
        ${campoLatoApertura(m)}`}
        <label>Nº ripiani
          <input type="number" class="m-ripiani" value="${m.ripiani}" min="0" max="20" step="1" />
        </label>
        <label>Riduzione ripiano (mm)
          <input type="number" class="m-rid" value="${m.riduzioneRipiano || 0}" min="0" step="1" />
        </label>
      </div>
    </div>
  `;
}

/**
 * Controllo "lato di apertura" per l'anta SINGOLA (solo battente).
 * `antaLato`: 'dx' (maniglia a destra, cardine a sinistra — default) oppure
 * 'sx' (maniglia a sinistra, cardine a destra). È visibile solo quando il
 * modulo ha 1 anta; con 2+ ante viene nascosto (le ante si aprono a coppia).
 */
function campoLatoApertura(modulo) {
  const visibile = (modulo.numeroAnte || 1) === 1;
  const lato = modulo.antaLato === 'sx' ? 'sx' : 'dx';
  return `
    <label class="m-lato-wrap"${visibile ? '' : ' style="display:none"'}>Apertura (1 anta)
      <select class="m-lato">
        <option value="dx"${lato === 'dx' ? ' selected' : ''}>Destra (maniglia dx)</option>
        <option value="sx"${lato === 'sx' ? ' selected' : ''}>Sinistra (maniglia sx)</option>
      </select>
    </label>`;
}

/**
 * Massima larghezza assegnabile al modulo `i` senza superare la larghezza
 * totale dell'armadio: totale − somma di TUTTI gli altri moduli.
 * (Il "resto" disponibile per questo modulo.)
 */
function maxLarghezzaModulo(config, i) {
  const altri = config.moduli.reduce(
    (s, m, k) => s + (k === i ? 0 : (m.larghezza || 0)), 0);
  return Math.max(0, config.larghezzaTotale - altri);
}

/**
 * Collega gli eventi delle card dei moduli.
 * - "Moduli diversi": ogni card scrive solo sul proprio modulo (indipendenti),
 *   con tetto sulla larghezza per non superare il totale.
 * - "Tutti uguali": una sola card, scrive su TUTTI i moduli insieme.
 */
function attaccaEventiModuli(contenitore, config, onChange) {
  // --- MODALITÀ "DIMENSIONI PERSONALIZZATE": eventi PER-MODULO ---
  if (config.moduliPersonalizzati) {
    contenitore.querySelectorAll('#moduli-list .modulo-card').forEach((card) => {
      const i = Number(card.dataset.i);
      const mod = config.moduli[i];
      if (!mod) return;
      const lar = card.querySelector('.m-lar');
      const ante = card.querySelector('.m-ante');
      const rip = card.querySelector('.m-ripiani');
      const rid = card.querySelector('.m-rid');
      const lato = card.querySelector('.m-lato');
      const latoWrap = card.querySelector('.m-lato-wrap');

      if (lar) lar.addEventListener('input', (e) => {
        // Tetto: non superare mai la larghezza totale (= resto disponibile).
        const maxW = maxLarghezzaModulo(config, i);
        const minW = Math.min(100, maxW);
        let v = Math.max(minW, Math.floor(Number(e.target.value) || 0));
        if (v > maxW) { v = maxW; e.target.value = v; }   // blocca lo sforamento
        mod.larghezza = v;
        // Aggiorna il tetto massimo degli altri input in base alla nuova somma.
        contenitore.querySelectorAll('#moduli-list .m-lar').forEach((inp) => {
          inp.max = maxLarghezzaModulo(config, Number(inp.dataset.i));
        });
        aggiornaControlloSommaModuli(config);
        onChange(config);
      });
      if (ante) ante.addEventListener('input', (e) => {
        mod.numeroAnte = Math.max(1, Math.round(Number(e.target.value) || 1));
        // Il lato apertura ha senso solo con 1 anta: mostra/nascondi al volo.
        if (latoWrap) latoWrap.style.display = mod.numeroAnte === 1 ? '' : 'none';
        onChange(config);
      });
      if (lato) lato.addEventListener('change', (e) => {
        mod.antaLato = e.target.value === 'sx' ? 'sx' : 'dx';
        onChange(config);
      });
      if (rip) rip.addEventListener('input', (e) => {
        mod.ripiani = Math.max(0, Math.round(Number(e.target.value) || 0));
        onChange(config);
      });
      if (rid) rid.addEventListener('input', (e) => {
        mod.riduzioneRipiano = Math.max(0, Math.round(Number(e.target.value) || 0));
        onChange(config);
      });
    });
    return;
  }

  // --- MODALITÀ "TUTTI UGUALI": una card, scrive su TUTTI i moduli ---
  const card = contenitore.querySelector('#moduli-list .modulo-card');
  if (!card) return;

  const anteInput = card.querySelector('.m-ante');
  const latoWrap = card.querySelector('.m-lato-wrap');
  const latoSel = card.querySelector('.m-lato');
  if (anteInput) {
    anteInput.addEventListener('input', (e) => {
      const n = Math.max(1, Math.round(Number(e.target.value) || 1));
      config.moduli.forEach((m) => { m.numeroAnte = n; });
      if (latoWrap) latoWrap.style.display = n === 1 ? '' : 'none';
      onChange(config);
    });
  }
  if (latoSel) {
    latoSel.addEventListener('change', (e) => {
      const l = e.target.value === 'sx' ? 'sx' : 'dx';
      config.moduli.forEach((m) => { m.antaLato = l; });
      onChange(config);
    });
  }
  card.querySelector('.m-ripiani').addEventListener('input', (e) => {
    const n = Math.max(0, Math.round(Number(e.target.value) || 0));
    config.moduli.forEach((m) => { m.ripiani = n; });
    onChange(config);
  });
  card.querySelector('.m-rid').addEventListener('input', (e) => {
    const n = Math.max(0, Math.round(Number(e.target.value) || 0));
    config.moduli.forEach((m) => { m.riduzioneRipiano = n; });
    onChange(config);
  });
}

/**
 * Sezione CASSETTIERE (globale). Ogni cassettiera può essere messa in uno
 * o più moduli specifici tramite checkbox "Moduli".
 */
function renderCassettiere(config) {
  const wrap = document.getElementById('cass-list');
  if (!wrap) return;
  const scorrevole = config.tipoArmadio === 'scorrevole';
  const casse = config.cassettiere || [];
  const nModuli = config.moduli.length;
  if (casse.length === 0) {
    wrap.innerHTML = '<p class="hint">Nessuna cassettiera. Usa il bottone qui sotto per aggiungerne una.</p>';
    return;
  }
  wrap.innerHTML = casse.map((c, j) => {
    const man = c.maniglia || { attiva: true, M: 50 };
    const moduliAttivi = Array.isArray(c.moduli) ? c.moduli : [];
    return `
      <div class="cass-row" data-j="${j}">
        <header>Cassettiera ${j + 1}
          <button class="btn-mini m-cass-del" type="button" data-j="${j}">rimuovi</button>
        </header>
        <div class="grid-2">
          <label>Nº cassetti
            <input type="number" class="c-num" value="${c.numCassetti ?? 4}" min="1" max="10" step="1" />
          </label>
          <label>Altezza max (mm)
            <input type="number" class="c-alt" value="${c.altMax ?? 800}" min="100" step="1" />
          </label>
        </div>
        <label>Guida scorrevole (mm)
          <select class="c-guida">
            <option value="500" ${(c.guida ?? 500) === 500 ? 'selected' : ''}>500 — fondo 480</option>
            <option value="400" ${(c.guida ?? 500) === 400 ? 'selected' : ''}>400 — fondo 380</option>
            <option value="350" ${(c.guida ?? 500) === 350 ? 'selected' : ''}>350 — fondo 330</option>
          </select>
        </label>
        ${scorrevole ? `
        <label class="chk">
          <input type="checkbox" class="c-man-on" ${man.attiva ? 'checked' : ''} />
          <span>Maniglia (spazio in profondità)</span>
        </label>
        <label>Spazio maniglia M (mm)
          <input type="number" class="c-man-m" value="${man.M ?? 50}" min="0" step="1" ${man.attiva ? '' : 'disabled'} />
        </label>` : ''}
        <div class="cass-mod-sel">
          <span>Metti nei moduli:</span>
          <div class="mod-pills">
            ${Array.from({ length: nModuli }, (_, i) => `
              <button type="button" class="mod-pill ${moduliAttivi.includes(i) ? 'on' : ''}"
                data-mod="${i}">Modulo ${i + 1}</button>
            `).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

function attaccaEventiCassettiere(contenitore, config, onChange) {
  const scorrevole = config.tipoArmadio === 'scorrevole';
  config.cassettiere = config.cassettiere || [];
  const btnAdd = contenitore.querySelector('#btn-cass-add');
  if (btnAdd) {
    btnAdd.onclick = () => {
      const base = { numCassetti: 4, altMax: 800, guida: 500,
        moduli: config.moduli.map((_, i) => i) }; // di default in tutti
      const nuova = scorrevole
        ? { ...base, maniglia: { attiva: true, M: 50 } }
        : base;
      config.cassettiere.push(nuova);
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      onChange(config);
    };
  }
  contenitore.querySelectorAll('#cass-list .m-cass-del').forEach((btn) => {
    btn.onclick = () => {
      const j = Number(btn.dataset.j);
      config.cassettiere.splice(j, 1);
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      onChange(config);
    };
  });
  contenitore.querySelectorAll('#cass-list .cass-row').forEach((row) => {
    const j = Number(row.dataset.j);
    const cas = config.cassettiere[j];
    if (!cas) return;
    const num = row.querySelector('.c-num');
    const alt = row.querySelector('.c-alt');
    const guida = row.querySelector('.c-guida');
    const manOn = row.querySelector('.c-man-on');
    const manM = row.querySelector('.c-man-m');
    if (num) num.oninput = (e) => {
      cas.numCassetti = Math.max(1, Math.round(Number(e.target.value) || 1));
      onChange(config);
    };
    if (guida) guida.onchange = (e) => {
      cas.guida = Number(e.target.value) || 500;
      onChange(config);
    };
    if (alt) alt.oninput = (e) => {
      cas.altMax = Math.max(100, Math.round(Number(e.target.value) || 800));
      onChange(config);
    };
    if (manOn) manOn.onchange = (e) => {
      if (!cas.maniglia) cas.maniglia = { M: 50 };
      cas.maniglia.attiva = e.target.checked;
      if (manM) manM.disabled = !cas.maniglia.attiva;
      onChange(config);
    };
    if (manM) manM.oninput = (e) => {
      if (!cas.maniglia) cas.maniglia = { attiva: true };
      cas.maniglia.M = Math.max(0, Math.round(Number(e.target.value) || 0));
      onChange(config);
    };
    // Pills "Modulo N": toggle inclusione del modulo in cas.moduli
    row.querySelectorAll('.mod-pill').forEach((pill) => {
      pill.onclick = () => {
        const i = Number(pill.dataset.mod);
        cas.moduli = Array.isArray(cas.moduli) ? cas.moduli : [];
        const pos = cas.moduli.indexOf(i);
        if (pos >= 0) cas.moduli.splice(pos, 1);
        else { cas.moduli.push(i); cas.moduli.sort((a, b) => a - b); }
        pill.classList.toggle('on');
        onChange(config);
      };
    });
  });
}

function renderTamponamenti(config) {
  const wrap = document.getElementById('tamp-list');
  if (!wrap) return;
  const labels = { sx: 'Sinistro', dx: 'Destro', sopra: 'Sopra', sotto: 'Sotto' };
  wrap.innerHTML = Object.keys(labels).map((k) => {
    const t = config.tamponamenti[k];
    return `
      <div class="tamp-row" data-k="${k}">
        <label class="chk">
          <input type="checkbox" class="t-on" ${t.attivo ? 'checked' : ''} />
          <span>${labels[k]}</span>
        </label>
        <label>Larghezza fronte (mm)
          <input type="number" class="t-lar" value="${t.larghezza}" min="20" step="1" ${t.attivo ? '' : 'disabled'} />
        </label>
      </div>
    `;
  }).join('');
}

function attaccaEventiTamponamenti(contenitore, config, onChange) {
  contenitore.querySelectorAll('.tamp-row').forEach((row) => {
    const k = row.dataset.k;
    row.querySelector('.t-on').addEventListener('change', (e) => {
      config.tamponamenti[k].attivo = e.target.checked;
      row.querySelector('.t-lar').disabled = !e.target.checked;
      onChange(config);
    });
    row.querySelector('.t-lar').addEventListener('input', (e) => {
      config.tamponamenti[k].larghezza = Math.max(20,
        Math.round(Number(e.target.value) || 20));
      onChange(config);
    });
  });
}

/**
 * Ripartisce automaticamente la larghezza totale tra N moduli in parti uguali.
 * L'ultimo modulo assorbe il resto in modo che la somma sia esatta
 * (es. 2000 mm / 3 moduli → 666, 666, 668).
 * Mantiene ripiani, ante, cassettiere dei moduli preesistenti.
 */
function ripartisciModuli(config, n = config.moduli.length) {
  // Template = primo modulo (le impostazioni valgono per tutti)
  const t = config.moduli[0] || {
    numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [],
  };
  const vecchi = config.moduli;
  const nuovi = [];

  if (config.moduliPersonalizzati) {
    // Mantiene larghezza E impostazioni (ante/ripiani/riduzione) di OGNI
    // modulo esistente — ognuno è indipendente.
    // I moduli NUOVI prendono lo SPAZIO LIBERO rimasto (diviso tra loro), così
    // la somma non supera il totale e le larghezze già scelte non si toccano.
    // Se però lo spazio libero non basta (i moduli esistenti riempiono già
    // tutto) o il totale è stato ridotto sotto la somma attuale, si ri-divide
    // tutto in parti uguali così NESSUN modulo nasce a 0.
    const MIN = 100;
    const total = config.larghezzaTotale;
    const esistenti = Math.min(vecchi.length, n);
    const sommaTenuti = vecchi.slice(0, esistenti)
      .reduce((s, m) => s + (m.larghezza || 0), 0);
    const nuoviCount = n - esistenti;
    const restante = total - sommaTenuti;
    const riparti = (nuoviCount > 0 && restante < nuoviCount * MIN) || sommaTenuti > total;
    const larEqua = Math.floor(total / n);
    const defNuovo = nuoviCount > 0 ? Math.max(MIN, Math.floor(restante / nuoviCount)) : larEqua;
    for (let i = 0; i < n; i++) {
      const v = vecchi[i];
      nuovi.push({
        larghezza: riparti ? larEqua : (v?.larghezza ?? defNuovo),
        numeroAnte: v?.numeroAnte ?? t.numeroAnte,
        antaLato: v?.antaLato ?? t.antaLato ?? 'dx',
        ripiani: v?.ripiani ?? t.ripiani,
        riduzioneRipiano: v?.riduzioneRipiano ?? t.riduzioneRipiano,
        cassettiere: (t.cassettiere || []).map((c) => ({ ...c })),
        ...(v?.ripianiY ? { ripianiY: v.ripianiY } : {}),   // ripiani spostati a mano nel 3D
      });
    }
  } else {
    // Tutti uguali: larghezza = floor(L/n). La somma può essere inferiore
    // a L di qualche mm (max n-1 mm) — è lo scarto naturale.
    const larModulo = Math.floor(config.larghezzaTotale / n);
    for (let i = 0; i < n; i++) {
      nuovi.push({
        larghezza: larModulo,
        numeroAnte: t.numeroAnte, antaLato: t.antaLato ?? 'dx', ripiani: t.ripiani,
        riduzioneRipiano: t.riduzioneRipiano,
        cassettiere: (t.cassettiere || []).map((c) => ({ ...c })),
        ...(vecchi[i]?.ripianiY ? { ripianiY: vecchi[i].ripianiY } : {}),   // ripiani spostati a mano nel 3D
      });
    }
  }
  config.moduli = nuovi;
}

/**
 * Selettore materiali: per ogni parte configurabile mostra una card
 * espandibile con il materiale corrente e una griglia di tutti quelli
 * disponibili. Cliccando una tessera, la parte cambia materiale.
 */
function renderMateriali(config) {
  const wrap = document.getElementById('mat-list');
  if (!wrap) return;
  wrap.innerHTML = PARTI.map((p) => {
    // Il materiale "corrente" è quello della prima chiave applicata
    const chiaveLettura = p.applica[0];
    const corrente = MATERIALI.find((m) => m.id === config.materiali[chiaveLettura])
      || MATERIALI[0];
    return `
      <details class="mat-card" data-parte="${p.id}">
        <summary>
          <span class="mat-parte">${p.nome}</span>
          <span class="mat-corrente">
            <img src="${corrente.thumb}" alt="" />
            <span>${corrente.nome}</span>
          </span>
        </summary>
        <div class="mat-grid">
          ${materialiPer('legno').map((m) => `
            <button type="button"
              class="mat-swatch ${m.id === corrente.id ? 'sel' : ''}"
              data-mat="${m.id}" title="${m.nome}">
              <img src="${m.thumb}" alt="" />
              <span>${m.nome}</span>
            </button>
          `).join('')}
        </div>
      </details>
    `;
  }).join('');
}

function attaccaEventiMateriali(contenitore, config, onChange) {
  contenitore.querySelectorAll('.mat-card').forEach((card) => {
    const parteId = card.dataset.parte;
    const parte = PARTI.find((p) => p.id === parteId);
    card.querySelectorAll('.mat-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Applica a tutte le chiavi associate (es. Struttura → carcassa+schiena)
        parte.applica.forEach((k) => {
          config.materiali[k] = btn.dataset.mat;
        });
        card.open = false;
        renderMateriali(config);
        attaccaEventiMateriali(contenitore, config, onChange);
        onChange(config);
      });
    });
  });
}

/**
 * Il controllo "somma larghezze vs totale".
 * Gli input delle larghezze ora stanno dentro le card dei moduli
 * (vedi renderModuli), quindi qui svuotiamo il vecchio contenitore e ci
 * limitiamo ad aggiornare il riepilogo della somma.
 */
function renderLarghezzeModuli(config) {
  const wrap = document.getElementById('moduli-larghezze');
  if (wrap) wrap.innerHTML = '';
  const check = document.getElementById('moduli-check');
  if (!config.moduliPersonalizzati) {
    if (check) { check.textContent = ''; check.className = 'hint'; }
    return;
  }
  aggiornaControlloSommaModuli(config);
}

// Gli eventi delle larghezze sono gestiti direttamente in attaccaEventiModuli
// (gli input vivono nelle card dei moduli). Funzione mantenuta per i call site.
function attaccaEventiLarghezzeModuli() { /* no-op */ }

function aggiornaControlloSommaModuli(config) {
  const check = document.getElementById('moduli-check');
  if (!check) return;
  const somma = config.moduli.reduce((s, m) => s + m.larghezza, 0);
  const diff = config.larghezzaTotale - somma;
  if (diff === 0) {
    check.textContent = `Somma: ${somma} mm — corrisponde esattamente a L (${config.larghezzaTotale})`;
    check.className = 'hint ok';
  } else if (diff > 0) {
    check.textContent = `Somma: ${somma} mm — mancano ${diff} mm per arrivare a L (${config.larghezzaTotale})`;
    check.className = 'hint';
  } else {
    check.textContent = `⚠ Somma: ${somma} mm — superi L (${config.larghezzaTotale}) di ${-diff} mm`;
    check.className = 'hint err';
  }
}

function toNum(v, min) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.floor(n));
}
function attr(s) { return (s || '').replace(/"/g, '&quot;'); }
