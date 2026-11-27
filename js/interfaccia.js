// =============================================================================
// PANNELLO PARAMETRI (sidebar sinistra)
// =============================================================================
// Costruisce i controlli di input e chiama onChange(config) a ogni modifica.
// La config è l'unica fonte di verità, qui si leggono i valori e si notifica
// l'esterno (main.js).
// =============================================================================

import { MATERIALI, PARTI, materialiDefault, materialiPer, sfondoSwatch, BINARIO_DEFAULT } from './materiali.js?v=20261127n';
import { htmlTendineColori } from './tendine-colori.js?v=20261127n';
import { misureCostado, piediniArmadio, zoccoloArmadio, binarioArmadio, profonditaBinario, spessoreMateriale, tiradorArmadio, larghezzaAntaScorrevole, larghezzaPortaScorrevole, numeroAnteScorrevoli, coloreProfiloScorrevole, misureSchiena, calcolaDistintaCompleta, geometriaCassettiera, spaziCassettiDiPartenza, manigliaCassettiera, sporgenzaDiManiglia } from './calcoli.js?v=20261127n';
import { htmlMontaggio, agganciaMontaggio } from './scelte-montaggio.js?v=20261127n';
import { htmlMiniaturaVoce, riempiMiniature } from './parametri-foto.js?v=20261127n';
import { binariScorrevoli, tiradoriScorrevoli, parametri, montaggioArmadio, sistemiCassetti, nomeSistemaCassetti, cassettieraArmadio } from './parametri.js?v=20261127n';

/**
 * Cambia tipo (battente ↔ scorrevole): se in ⚙ Parametri lo scorrevole si monta in un altro modo,
 * struttura e schiena di questo armadio passano a quelle del tipo nuovo.
 */
export function applicaMontaggioTipo(config) {
  if (parametri().scorrevoli.uguale) return config;
  const m = montaggioArmadio(config.tipoArmadio);
  config.setupCarcassa = m.setup;
  config.spessoreSchiena = m.spessoreSchiena;
  config.schiena = { tipo: m.schiena, canale: m.canale, dentro: m.dentro };
  return config;
}

export function configDefault() {
  const PA = parametri().armadi;        // come monti gli armadi (⚙ Parametri → Armadi): valori di partenza
  return {
    meta: { cliente: '' },
    tipoArmadio: 'battente', // 'battente' | 'scorrevole'
    sfondo: 'chiaro',        // sfondo vista 3D: chiaro | neutro | scuro
    larghezzaTotale: 2000,
    altezzaEsterna: 2400,
    profonditaEsterna: 600,
    spessoreCarcassa: 18,
    spessoreSchiena: PA.spessoreSchiena,
    spessoreAnte: 18,
    setupCarcassa: PA.setup,
    anteInterne: PA.ante === 'interne',   // battente: ante DENTRO il vano (a filo della struttura) invece che sopra
    schiena: { tipo: PA.schiena, canale: PA.canale, dentro: PA.dentro },   // avvitata dietro / a filo / in canale
    moduliPersonalizzati: false, // false = tutti uguali (L/N); true = l'utente sceglie ogni larghezza
    materiali: materialiDefault(),
    moduli: [
      { larghezza: 1000, numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] },
      { larghezza: 1000, numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] },
    ],
    scorrevole: {
      anteModulo: 1, // ante per modulo (default: 1 = anta larga come il modulo, alternate avanti/dietro)
      binario: 75,   // 75 default, oppure 85
      coloreBinario: 'binario-grigio', // colore del binario (catalogo: Impostazioni → Binari)
      coloreProfilo: 'binario-bianco', // profili verticali sui due lati di ogni anta (stessi colori del binario)
    },
    cassettiere: [], // lista GLOBALE di cassettiere; ciascuna ha `moduli: [i,...]`
    tamponamenti: {
      sx: { attivo: false, larghezza: 50 },
      dx: { attivo: false, larghezza: 50 },
      sopra: { attivo: false, larghezza: 50 },
      sotto: { attivo: false, larghezza: 50 },
    },
    // COSTADI a vista (armadio non incassato): nessuno | sx | dx | entrambi.
    // spessore null = come le ante; sporgenza = quanto sporge davanti alle ante (mm)
    costadi: { lati: 'nessuno', spessore: null, sporgenza: 2 },
  };
}

const escAttr = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Formula delle ante scorrevoli con i numeri del binario scelto (anta di partenza = larga come il modulo). */
function formulaScorrevole(config) {
  const b = binarioArmadio(config);
  const n = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);    // il <code> non passa dalla traduzione automatica
  const tl = tiradorArmadio(config).lato || 0, N = numeroAnteScorrevoli(config);
  const meno = b.larghezzaMeno > 0 ? ` − ${n(b.larghezzaMeno)}` : '';
  return `${t('Porta finita')}: <code>${t(`L ÷ ${N} ante${meno}`)}</code> = <strong>${n(Math.floor(larghezzaPortaScorrevole(config)))} mm</strong> · ${t('anta da tagliare')}: <code>${t(`porta − 2 × ${n(tl)} (tirador per lato)`)}</code> = <strong>${n(Math.floor(larghezzaAntaScorrevole(config)))} mm</strong> · ${t('altezza')} <code>H − ${n(b.altezzaMeno)}</code> (H = ${t('altezza esterna totale')}).`;
}
function aggiornaFormulaScorrevole(config) {
  const el = document.getElementById('sc-formula');
  if (el) el.innerHTML = formulaScorrevole(config);
}

export function renderPannello(contenitore, config, onChange) {
  // Normalizza all'avvio: la larghezza di ogni modulo è sempre
  // totale/n (parti uguali), l'utente sceglie solo "quanti moduli".
  ripartisciModuli(config);
  // progetti di prima: niente costadi; il loro materiale parte da quello delle ante
  if (!config.costadi) config.costadi = { lati: 'nessuno', spessore: null, sporgenza: 2 };
  if (config.materiali && !config.materiali.costadi) config.materiali.costadi = config.materiali.ante;
  // ogni modifica aggiorna anche le misure del costado scritte nel pannello
  const onChangeBase = onChange;
  onChange = (c, o) => { infoCostadi(config); aggiornaFormulaScorrevole(config); onChangeBase(c, o); };
  const cs = config.costadi, lati = cs.lati || 'nessuno';
  contenitore.innerHTML = `
    <section>
      <h3>Lavoro</h3>
      <label>Cliente / Riferimento
        <input type="text" id="meta-cliente" value="${attr(config.meta?.cliente)}" placeholder="Es. Sig.ra Rossi — camera matrim." />
      </label>
    </section>

    <!-- Niente «Tipo armadio»: il tipo si sceglie all'entrata (Armadio a battente / Armadio scorrevole) -->
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

    <section id="sez-setup">
      <h3>Setup carcassa</h3>
      <p class="hint">I valori di partenza li scegli in ⚙ Parametri → Armadi.</p>
      <div id="mont-setup"></div>
    </section>

    <section id="sez-schiena">
      <h3>Schiena</h3>
      <div id="mont-schiena"></div>
      <p class="hint" id="mont-hint" data-no-i18n></p>
    </section>

    <section id="sez-scorrevole" ${config.tipoArmadio === 'scorrevole' ? '' : 'style="display:none"'}>
      <h3>Scorrevole</h3>
      <label>Tipo di binario
        <span class="sel-con-foto"><select id="sc-tipo">
          ${binariScorrevoli().map((b) => `<option value="${escAttr(b.id)}" ${b.id === binarioArmadio(config).id ? 'selected' : ''}>${escAttr(b.nome || '—')}</option>`).join('')}
        </select>${htmlMiniaturaVoce('binario', binarioArmadio(config).id)}</span>
      </label>
      <label>Tirador (profilo sui lati delle ante)
        <span class="sel-con-foto"><select id="sc-tirador">
          ${tiradoriScorrevoli().map((x) => `<option value="${escAttr(x.id)}" ${x.id === tiradorArmadio(config).id ? 'selected' : ''}>${escAttr(x.nome || '—')}</option>`).join('')}
        </select>${htmlMiniaturaVoce('tirador', tiradorArmadio(config).id)}</span>
      </label>
      <p class="hint" style="margin-bottom:10px">I dati di ogni binario e di ogni tirador (quanto togliere alle ante) si cambiano in <a href="impostazioni.html#parametri">⚙ Impostazioni → Parametri</a>.</p>
      <div class="grid-2">
        <label>Nº ante (in tutto)
          <input type="number" id="sc-n" value="${numeroAnteScorrevoli(config)}" min="1" max="12" step="1" />
        </label>
        <label>Binario (mm)
          <select id="sc-bin">
            ${(binarioArmadio(config).profondita || [75]).map((v, i) => `<option value="${v}" ${profonditaBinario(config) === v ? 'selected' : ''}>${v}${i === 0 ? ' (default)' : ''}</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="sc-colore-bin">${coloriBinario(config)}</div>
      <div id="sc-colore-prof">${coloriProfilo(config)}</div>
      <p class="hint">La porta è larga quanto l'armadio diviso il n° di ante (es. armadio 2000 con 2 ante → porte da 1000). L'anta da tagliare è la porta meno il tirador da tutti e due i lati (es. tirador da 21 → 1000 − 42 = 958). La larghezza del tirador per lato si scrive in ⚙ Parametri → Tiradores. Il binario non entra nella distinta (è a parte).</p>
      <p class="hint" id="sc-formula">${formulaScorrevole(config)}</p>
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
      <div id="barre-list"></div>
    </section>

    <section>
      <h3>Cassettiere</h3>
      <div id="cass-list"></div>
      <!-- tutto quello che si sceglie per le cassettiere sta qui: misure e maniglia (nella scheda), poi i materiali -->
      <div id="cass-mat"></div>
      <button id="btn-cass-add" class="btn-oro" type="button" style="margin-top:12px">+ Aggiungi cassettiera</button>
    </section>

    <section>
      <h3>Tamponamenti</h3>
      <div id="tamp-list"></div>
    </section>

    <section>
      <h3>Costadi</h3>
      <p class="hint">Per gli armadi non incassati: il fianco a vista, alto quanto tutto l'armadio, dal retro della schiena fino a poco davanti alle ante.</p>
      <div class="radio-row" style="flex-wrap:wrap">
        ${[['nessuno', 'Nessuno'], ['sx', 'Solo sinistro'], ['dx', 'Solo destro'], ['entrambi', 'Tutti e due']].map(([v, n]) => `
        <label class="radio">
          <input type="radio" name="costadi" value="${v}" ${lati === v ? 'checked' : ''} />
          <span>${n}</span>
        </label>`).join('')}
      </div>
      <div class="grid-2" id="cost-campi" ${lati === 'nessuno' ? 'style="display:none"' : ''}>
        <label>Spessore (mm)
          <input type="number" id="cost-sp" value="${cs.spessore > 0 ? cs.spessore : config.spessoreAnte}" min="5" step="1" />
        </label>
        <label>Sporge davanti alle ante (mm)
          <input type="number" id="cost-sporg" value="${Number.isFinite(cs.sporgenza) ? cs.sporgenza : 2}" min="0" step="1" />
        </label>
      </div>
      <div id="cost-info" class="hint" style="line-height:1.6"></div>
    </section>

    <section>
      <h3>Piedini e zoccolo</h3>
      <div id="piedini-box">${htmlPiedini(config)}</div>
    </section>

    <section>
      <h3>Materiali armadio</h3>
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
  infoCostadi(config);

  // ======== Collegamento eventi ========
  const bind = (id, handler, evento = 'input') => {
    const el = contenitore.querySelector(id);
    // dopo ogni misura cambiata si aggiorna anche l'esempio delle ante interne
    if (el) el.addEventListener(evento, (e) => { handler(e); if (typeof hintInterne === 'function') hintInterne(); });
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
  bind('#sp-ante', (e) => {
    config.spessoreAnte = toNum(e.target.value, 5);
    const cSp = contenitore.querySelector('#cost-sp');
    if (cSp && !(config.costadi && config.costadi.spessore > 0)) cSp.value = config.spessoreAnte;
    onChange(config);
  });

  // COME È MONTATO QUESTO ARMADIO (struttura, ante a battente, schiena): le schede col disegno.
  // I valori di partenza vengono dai ⚙ Parametri → Armadi; qui si cambiano per questo armadio.
  const leggiMont = () => {
    const ms = misureSchiena(config), A = parametri().anteInterne;
    return { tipo: config.tipoArmadio, setup: config.setupCarcassa === 2 ? 2 : 1, ante: config.anteInterne ? 'interne' : 'sopra', schiena: ms.tipo,
      spessoreSchiena: config.spessoreSchiena, canale: ms.canale, dentro: ms.dentro, aria: A.aria, spazioRipiano: A.spazioRipiano };
  };
  const scriviMont = (p) => {
    if ('setup' in p) config.setupCarcassa = p.setup;
    if ('ante' in p) config.anteInterne = p.ante === 'interne';
    if ('schiena' in p || 'canale' in p || 'dentro' in p) {
      const ms = misureSchiena(config);
      config.schiena = { tipo: p.schiena ?? ms.tipo, canale: p.canale ?? ms.canale, dentro: p.dentro ?? ms.dentro };
    }
    if ('spessoreSchiena' in p) { config.spessoreSchiena = p.spessoreSchiena; const fs = contenitore.querySelector('#sp-schiena'); if (fs) fs.value = p.spessoreSchiena; }
    onChange(config);
  };
  // le misure vere di QUESTO armadio (modulo 1), come in distinta
  const hintInterne = () => {
    const el = document.getElementById('mont-hint'); if (!el) return;
    const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
    let pz = [];
    try { pz = calcolaDistintaCompleta(config).pezzi.filter((x) => x.modulo === 'Modulo 1' && x.larghezza != null); } catch (_) { el.textContent = ''; return; }
    const r = (re) => pz.filter((x) => re.test(x.nome)).map((x) => `${t(x.nome)} ${x.larghezza} × ${x.altezza}`);
    el.textContent = `${t('Questo armadio, modulo 1:')} ${[...r(/^Top/), ...r(/^Fianco/), ...r(/^Schiena/), ...r(/^Ripiano/), ...r(/^Anta/)].join(' · ')}`;
  };
  const disegnaMont = () => {
    const a = document.getElementById('mont-setup'), b = document.getElementById('mont-schiena');
    if (a) { a.innerHTML = htmlMontaggio(leggiMont(), { struttura: true, schiena: false, ante: true, numeriAnte: false, esempio: false }); agganciaMontaggio(a, leggiMont, scriviMont, disegnaMont); }
    if (b) { b.innerHTML = htmlMontaggio(leggiMont(), { struttura: false, schiena: true, ante: false, esempio: false }); agganciaMontaggio(b, leggiMont, scriviMont, disegnaMont); }
    hintInterne();
  };
  disegnaMont();

  // Selettore tipo armadio (battente / scorrevole)
  contenitore.querySelectorAll('input[name="tipo"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      config.tipoArmadio = e.target.value;
      applicaMontaggioTipo(config);
      const scorrevole = e.target.value === 'scorrevole';
      const sezSc = document.getElementById('sez-scorrevole');
      if (sezSc) sezSc.style.display = scorrevole ? '' : 'none';
      const fs = contenitore.querySelector('#sp-schiena'); if (fs) fs.value = config.spessoreSchiena;
      disegnaMont();                     // lo scorrevole non ha le schede delle ante a battente
      renderMateriali(config);
      attaccaEventiMateriali(contenitore, config, onChange);
      renderModuli(config);
      attaccaEventiModuli(contenitore, config, onChange);
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      onChange(config);
    });
  });

  // Parametri scorrevole
  bind('#sc-n', (e) => {
    // n° di ante di TUTTO l'armadio (la porta è larga l'armadio ÷ n° ante)
    config.scorrevole.nAnte = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1)));
    onChange(config);
    aggiornaFormulaScorrevole(config);
  });
  bind('#sc-tipo', (e) => {
    config.scorrevole.tipoBinario = e.target.value;
    // gli spazi del binario nuovo (⚙ Parametri → Binari): se quello di prima non c'è, il primo
    config.scorrevole.binario = profonditaBinario(config);
    const sel = document.getElementById('sc-bin');
    if (sel) sel.innerHTML = (binarioArmadio(config).profondita || [75]).map((v, i) => `<option value="${v}" ${config.scorrevole.binario === v ? 'selected' : ''}>${v}${i === 0 ? ' (default)' : ''}</option>`).join('');
    fotoScelta(e.target, 'binario', binarioArmadio(config).id);
    onChange(config);
  }, 'change');
  bind('#sc-tirador', (e) => {
    config.scorrevole.tirador = e.target.value;
    fotoScelta(e.target, 'tirador', tiradorArmadio(config).id);
    onChange(config);
  }, 'change');
  bind('#sc-bin', (e) => {
    const v = Number(e.target.value);
    config.scorrevole.binario = v > 0 ? v : (binarioArmadio(config).profondita || [75])[0];   // uno degli spazi del binario
    onChange(config);
  }, 'change');
  // Colore del binario (catalogo: Impostazioni → Binari)
  const attaccaColoreBinario = () => {
    contenitore.querySelectorAll('[data-bin]').forEach((btn) => btn.addEventListener('click', () => {
      config.scorrevole.coloreBinario = btn.dataset.bin;
      const box = contenitore.querySelector('#sc-colore-bin');
      if (box) { box.innerHTML = coloriBinario(config); attaccaColoreBinario(); }
      onChange(config);
    }));
  };
  attaccaColoreBinario();
  // Colore dei profili delle ante scorrevoli (gli stessi colori del binario)
  const attaccaColoreProfilo = () => {
    contenitore.querySelectorAll('[data-profilo]').forEach((btn) => btn.addEventListener('click', () => {
      config.scorrevole.coloreProfilo = btn.dataset.profilo;
      const box = contenitore.querySelector('#sc-colore-prof');
      if (box) { box.innerHTML = coloriProfilo(config); attaccaColoreProfilo(); }
      onChange(config);
    }));
  };
  attaccaColoreProfilo();

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

  // COSTADI: lati, spessore, sporgenza. Sul lato con il costado il tamponamento laterale non serve
  // (l'armadio non è incassato da quella parte): si spegne
  attaccaEventiPiedini(contenitore, config, onChange);
  riempiMiniature(contenitore);          // foto del binario e del tirador scelti (⚙ Parametri)
  contenitore.querySelectorAll('input[name="costadi"]').forEach((r) => r.addEventListener('change', (e) => {
    config.costadi.lati = e.target.value;
    const m = misureCostado(config);
    if (m.sx && config.tamponamenti.sx) config.tamponamenti.sx.attivo = false;
    if (m.dx && config.tamponamenti.dx) config.tamponamenti.dx.attivo = false;
    const campi = contenitore.querySelector('#cost-campi');
    if (campi) campi.style.display = e.target.value === 'nessuno' ? 'none' : '';
    renderTamponamenti(config);
    attaccaEventiTamponamenti(contenitore, config, onChange);
    // piedini e zoccolo: con il costado il fianco non ha zoccolo e lo zoccolo davanti va incassato
    const pb = contenitore.querySelector('#piedini-box');
    if (pb) { pb.innerHTML = htmlPiedini(config); attaccaEventiPiedini(contenitore, config, onChange); }
    onChange(config);
  }));
  bind('#cost-sp', (e) => { const v = Math.round(Number(e.target.value)); config.costadi.spessore = v > 0 ? v : null; onChange(config); });
  bind('#cost-sporg', (e) => { const v = Math.round(Number(e.target.value)); config.costadi.sporgenza = Number.isFinite(v) && v >= 0 ? v : 2; onChange(config); });

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
    if (!confirm('Reset configurazione?')) return;
    const nuova = configDefault();                       // resta lo stesso tipo di armadio della pagina
    nuova.tipoArmadio = config.tipoArmadio === 'scorrevole' ? 'scorrevole' : 'battente';
    onChange(applicaMontaggioTipo(nuova), { reset: true });
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
  renderBarre(config);
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
              min="100" max="${maxLarghezzaModulo(config, i)}" step="1" ${i === config.moduli.length - 1 && config.moduli.length > 1 ? 'readonly' : ''} />
            ${i === config.moduli.length - 1 && config.moduli.length > 1 ? '<span class="hint">Si adatta da solo allo spazio che resta</span>' : ''}
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
  // ripiani tolti/aggiunti nel 3D: i moduli possono averne un numero diverso
  const ripUguali = config.moduli.every((x) => (x.ripiani || 0) === (m.ripiani || 0));
  const ripTesto = ripUguali ? '' : config.moduli.map((x, i) => `M${i + 1}: ${x.ripiani || 0}`).join(' · ');
  wrap.innerHTML = `
    <div class="modulo-card">
      <header>Impostazioni di ogni modulo · ${larModulo} mm</header>
      <div class="grid-2">
        ${scorrevole ? '' : `
        <label>Nº ante per modulo
          <input type="number" class="m-ante" value="${m.numeroAnte}" min="1" max="6" step="1" />
        </label>
        ${campoLatoApertura(m)}`}
        <label>Nº ripiani${ripUguali ? '' : ` <small class="hint">(${ripTesto})</small>`}
          <input type="number" class="m-ripiani" value="${ripUguali ? m.ripiani : ''}" ${ripUguali ? '' : 'placeholder="diversi per modulo"'} min="0" max="20" step="1" />
        </label>
        <label>Riduzione ripiano (mm)
          <input type="number" class="m-rid" value="${m.riduzioneRipiano || 0}" min="0" step="1" />
        </label>
      </div>
    </div>
  `;
}

/** Finiture della barra appendiabiti. */
const FINITURE_BARRA = [
  { id: 'alluminio', nome: 'Alluminio satinato' },
  { id: 'nero', nome: 'Nero' },
];
/**
 * BARRA APPENDIABITI: ogni modulo può avere la sua (alluminio satinato o
 * nera) oppure nessuna. Vale in tutte e due le modalità (uguali / diversi).
 */
function renderBarre(config) {
  const wrap = document.getElementById('barre-list');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="modulo-card">
      <header>Perchero (barra appendiabiti)</header>
      <div class="grid-2">
        ${config.moduli.map((m, i) => `
        <label>Modulo ${i + 1}
          <select class="m-barra" data-i="${i}">
            <option value="">Nessuna</option>
            ${FINITURE_BARRA.map((f) => `<option value="${f.id}"${m.barra === f.id ? ' selected' : ''}>${f.nome}</option>`).join('')}
          </select>
        </label>`).join('')}
      </div>
      <p class="hint">Ogni modulo può avere il suo perchero oppure no. Va 6 cm sotto il ripiano più alto (o sotto il cielo se non ci sono ripiani); a porte aperte lo puoi trascinare su e giù. In distinta: il perchero con la sua misura e 2 ganci.</p>
    </div>`;
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
  // l'ULTIMO modulo si adatta da solo: gli altri possono arrivare fin dove all'ultimo restano 10 cm
  const n = config.moduli.length;
  if (config.moduliPersonalizzati && n > 1 && i < n - 1) {
    const altri = config.moduli.reduce((s, m, k) => s + (k === i || k === n - 1 ? 0 : (m.larghezza || 0)), 0);
    return Math.max(100, config.larghezzaTotale - altri - 100);
  }
  const altri = config.moduli.reduce(
    (s, m, k) => s + (k === i ? 0 : (m.larghezza || 0)), 0);
  return Math.max(0, config.larghezzaTotale - altri);
}

/**
 * I MODULI RIEMPIONO SEMPRE LA LARGHEZZA TOTALE (niente spazio vuoto dentro i tamponamenti):
 *  - "tutti uguali": larghezza L/n (ricalcolata se non torna, es. progetto vecchio);
 *  - "dimensioni personalizzate": l'ULTIMO modulo prende lo spazio che resta. Prima togliendo un
 *    modulo o allargando il totale restava un buco largo come un modulo dentro la cornice.
 */
export function adattaModuli(config) {
  const n = (config.moduli || []).length, L = config.larghezzaTotale;
  if (!n || !(L > 0)) return config;
  if (!config.moduliPersonalizzati) {
    const giusta = Math.floor(L / n);
    if (config.moduli.some((m) => m.larghezza !== giusta)) config.moduli.forEach((m) => { m.larghezza = giusta; });
    return config;
  }
  const altri = config.moduli.slice(0, n - 1).reduce((s, m) => s + (m.larghezza || 0), 0);
  if (L - altri >= 100) { config.moduli[n - 1].larghezza = L - altri; return config; }
  // gli altri occupano già tutto: si ridivide in parti uguali (nessun modulo a zero)
  const eq = Math.floor(L / n);
  config.moduli.forEach((m, k) => { m.larghezza = k === n - 1 ? L - eq * (n - 1) : eq; });
  return config;
}

/**
 * Collega gli eventi delle card dei moduli.
 * - "Moduli diversi": ogni card scrive solo sul proprio modulo (indipendenti),
 *   con tetto sulla larghezza per non superare il totale.
 * - "Tutti uguali": una sola card, scrive su TUTTI i moduli insieme.
 */
function attaccaEventiModuli(contenitore, config, onChange) {
  // Barra appendiabiti, modulo per modulo
  contenitore.querySelectorAll('#barre-list .m-barra').forEach((sel) => sel.addEventListener('change', (e) => {
    const mod = config.moduli[Number(sel.dataset.i)];
    if (!mod) return;
    if (e.target.value) mod.barra = e.target.value; else delete mod.barra;
    onChange(config);
  }));
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
        adattaModuli(config);                               // l'ultimo modulo prende il resto
        // Aggiorna il tetto massimo degli altri input in base alla nuova somma (e l'ultimo).
        contenitore.querySelectorAll('#moduli-list .m-lar').forEach((inp) => {
          const k = Number(inp.dataset.i);
          inp.max = maxLarghezzaModulo(config, k);
          if (k !== i) inp.value = config.moduli[k].larghezza;
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
  // scelte a PULSANTI (chiare anche sul telefono, niente tendine)
  const scelte = (k, att, opz) => `<div class="cass-scelte" data-k="${k}">${opz.map(([v, t, sub]) => `
          <button type="button" class="btn-ghost ${String(att) === String(v) ? 'attivo' : ''}" data-v="${escAttr(v)}">${t}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
  const sistemi = sistemiCassetti();               // tutti i sistemi di cassetti dei ⚙ Parametri (a sistema e su misura)
  const maniglie = materialiPer('maniglie');
  const tessera = (m) => (m ? `<span class="man-tessera" style="background:${sfondoSwatch(m)}"></span>` : '<span class="man-tessera man-nessuna">—</span>');
  wrap.innerHTML = casse.map((c, j) => {
    const G = geometriaCassettiera(config, c, (config.moduli[0] && config.moduli[0].larghezza) || 1000);
    const moduliAttivi = Array.isArray(c.moduli) ? c.moduli : [];
    const def = manigliaCassettiera(config, c);
    return `
      <div class="cass-row" data-j="${j}">
        <header>Cassettiera ${j + 1}
          <button class="btn-mini m-cass-del" type="button" data-j="${j}">Rimuovi</button>
        </header>
        <div class="cass-blocco">
          <div class="cass-tit">Misure</div>
          <div class="grid-2">
            <label>Numero di cassetti
              <input type="number" class="c-num" value="${c.numCassetti ?? 4}" min="1" max="10" step="1" />
            </label>
            <label>Altezza della cassettiera (mm)
              <input type="number" class="c-alt" value="${c.altMax ?? 800}" min="100" step="1" />
            </label>
          </div>
          <div class="cass-et">Misure dei cassetti</div>
          ${scelte('divisione', G.personalizzata ? 'personalizzata' : 'uguali', [['uguali', 'Tutti uguali'], ['personalizzata', 'Ogni cassetto la sua misura']])}
          ${G.personalizzata ? `
          <div class="c-altezze">
            ${G.fronti.map((f, i) => `<label>Cassetto ${i + 1}${i === 0 ? ' (in alto)' : i === G.N - 1 ? ' (in basso)' : ''} (mm)
              <input type="number" class="c-alt-i" data-i="${i}" value="${f.slot}" min="40" step="1" />
              <small>frontale ${f.h} mm</small></label>`).join('')}
          </div>
          <p class="hint ${G.differenza ? 'err' : ''}">Spazio per i cassetti: ${G.spazioCassetti} mm (cassettiera ${G.AltMax} − fascetta sotto ${G.sC} − ripiano ${G.sC} − aria ${G.fuga}) · scritto: ${G.spazioCassetti - G.differenza} mm${
            G.differenza === 0 ? ' ✓' : G.differenza > 0 ? ` · mancano ${G.differenza} mm` : ` · ${-G.differenza} mm in più`}</p>
          <p class="hint">Ogni frontale è la misura scritta meno l'aria dei Parametri (${G.fuga} mm): es. 150 → ${150 - G.fuga}.</p>` : `
          <p class="hint">Frontali da ${G.fronti[0].h} mm.</p>`}
          <div class="cass-et">Cassetti</div>
          ${sistemi.length > 1 ? scelte('sistema', G.sistema.id, sistemi.map((x) => [x.id, escAttr(x.marca || '—'), x.tipo === 'nostro' ? 'su misura' : 'a sistema']))
            : `<p class="hint" style="margin-top:0">${escAttr(nomeSistemaCassetti(sistemi[0]))}</p>`}
          <p class="hint">Altri sistemi di cassetti (a sistema o su misura) e le loro guide si aggiungono in <a href="impostazioni.html#parametri">Impostazioni → Parametri</a> → Sistemi di cassetti.</p>
          <div class="cass-et">Guida dei cassetti</div>
          <p class="hint ${G.guidaNonEntra ? 'err' : ''}" style="margin-top:0">${G.guidaNonEntra
            ? `La cassettiera è profonda solo ${G.profScatola} mm, non entra neanche la guida da ${G.guidaMinima}.`
            : `Guida ${G.guida} mm, scelta da sola dalla profondità della cassettiera (${G.profScatola} mm).`}</p>
          <p class="hint">Guide di ${escAttr(G.sistema.marca || '—')} (mm): ${G.guide.join(', ')}. Si usa la più lunga che entra.</p>
        </div>
        <div class="cass-blocco">
          <div class="cass-tit">Maniglia dei cassetti</div>
          ${scelte('apertura', G.apertura, [['incassata', 'Incassata', 'fresata nel frontale'], ['maniglia', 'Maniglia esterna'], ['ribassati', 'Senza maniglia', 'frontali ribassati']])}
          ${G.incassata ? '<p class="hint">Non sporge niente: nel frontale va fatta la fresata per incassare la maniglia.</p>' : ''}
          ${G.maniglia ? `
          <div class="cass-et">Quale maniglia · ${escAttr(def ? def.nome : 'Barretta semplice')}</div>
          <div class="mat-grid">
            <button type="button" class="mat-swatch ${!def ? 'sel' : ''}" data-cman="" title="Barretta semplice">${tessera(null)}<span>Barretta semplice</span></button>
            ${maniglie.map((m) => `
            <button type="button" class="mat-swatch ${def && m.id === def.id ? 'sel' : ''}" data-cman="${escAttr(m.id)}" title="${escAttr(m.nome)}">${tessera(m)}<span>${escAttr(m.nome)}</span></button>`).join('')}
          </div>
          <label style="margin-top:10px">Quanto sporge la maniglia dal frontale (mm)
            <input type="number" class="c-sporg" value="${G.sporgenza}" min="1" step="1" inputmode="numeric" />
          </label>
          <p class="hint"><span>${G.sporgenzaScritta
            ? `Scritta per questa cassettiera (la scheda della maniglia dice ${sporgenzaDiManiglia(def)} mm).`
            : 'Dalla scheda della maniglia (Impostazioni → Maniglie). Se la cambi qui vale solo per questa cassettiera.'}</span>
            <span>La cassettiera è più corta di questa misura, così la maniglia sta davanti ai frontali.</span></p>` : ''}
          ${G.ribassati ? `
          <label style="margin-top:10px">Frontali più bassi di (mm)
            <input type="number" class="c-ribasso" value="${c.ribasso ?? cassettieraArmadio(scorrevole ? 'scorrevole' : 'battente').ribasso}" min="0" step="1" />
          </label>
          <p class="hint">Il vuoto sopra ogni frontale per prendere il cassetto con la mano. Di partenza la misura dei Parametri.</p>` : ''}
        </div>
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

/**
 * Apre o chiude le porte nel 3D, come il tasto «Apri porte». La cassettiera sta DENTRO l'armadio:
 * a porte chiuse non si vede, quindi quando si cambia qualcosa della cassettiera le porte si aprono
 * da sole (e si vede il cambio); quando si cambiano le ante o le loro maniglie si chiudono.
 */
function mostraPorte(aperte) {
  const t = document.getElementById('toggle-ante');
  if (aperte) document.body.dataset.portePerCassettiera = '1';   // l'aiuto dei ripiani coprirebbe la cassettiera
  else delete document.body.dataset.portePerCassettiera;
  if (!t || t.checked === aperte) return;
  t.checked = aperte;
  t.dispatchEvent(new Event('change'));
}

function attaccaEventiCassettiere(contenitore, config, onChange) {
  // qualsiasi cosa si cambi in una cassettiera: porte aperte, così la si vede (una volta sola per pagina)
  const lista = contenitore.querySelector('#cass-list');
  if (lista && !lista.dataset.portePronte) {
    lista.dataset.portePronte = '1';
    for (const ev of ['input', 'change']) lista.addEventListener(ev, () => mostraPorte(true));
  }
  const scorrevole = config.tipoArmadio === 'scorrevole';
  config.cassettiere = config.cassettiere || [];
  const btnAdd = contenitore.querySelector('#btn-cass-add');
  if (btnAdd) {
    btnAdd.onclick = () => {
      const base = { numCassetti: 4, altMax: 800,
        moduli: config.moduli.map((_, i) => i) }; // di default in tutti
      const nuova = { ...base, apertura: 'incassata' };            // di partenza la maniglia incassata
      config.cassettiere.push(nuova);
      mostraPorte(true);                               // la cassettiera nuova si vede subito
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      renderMateriali(config);                         // compaiono colori e maniglie della cassettiera
      attaccaEventiMateriali(contenitore, config, onChange);
      onChange(config);
    };
  }
  contenitore.querySelectorAll('#cass-list .m-cass-del').forEach((btn) => {
    btn.onclick = () => {
      const j = Number(btn.dataset.j);
      config.cassettiere.splice(j, 1);
      renderCassettiere(config);
      attaccaEventiCassettiere(contenitore, config, onChange);
      renderMateriali(config);
      attaccaEventiMateriali(contenitore, config, onChange);
      onChange(config);
    };
  });
  contenitore.querySelectorAll('#cass-list .cass-row').forEach((row) => {
    const j = Number(row.dataset.j);
    const cas = config.cassettiere[j];
    if (!cas) return;
    const num = row.querySelector('.c-num');
    const alt = row.querySelector('.c-alt');
    const ridisegna = () => { renderCassettiere(config); attaccaEventiCassettiere(contenitore, config, onChange); onChange(config); };
    if (num) num.oninput = (e) => {
      cas.numCassetti = Math.max(1, Math.round(Number(e.target.value) || 1));
      if (cas.divisione === 'personalizzata') cas.altezze = spaziCassettiDiPartenza(config, cas, (config.moduli[0] && config.moduli[0].larghezza) || 1000);
      onChange(config);
    };
    if (num) num.onchange = ridisegna;                // frontali e altezze aggiornati
    if (alt) alt.oninput = (e) => {
      cas.altMax = Math.max(100, Math.round(Number(e.target.value) || 800));
      onChange(config);
    };
    if (alt) alt.onchange = ridisegna;
    // SCELTE A PULSANTI: misure dei cassetti, sistema di cassetti, maniglia (apertura); la guida è automatica
    row.querySelectorAll('.cass-scelte[data-k] button').forEach((b) => {
      b.onclick = () => {
        const k = b.closest('.cass-scelte').dataset.k, v = b.dataset.v;
        mostraPorte(true);
        if (k === 'divisione') {
          if (v === 'personalizzata') { cas.divisione = 'personalizzata'; cas.altezze = spaziCassettiDiPartenza(config, cas, (config.moduli[0] && config.moduli[0].larghezza) || 1000); }
          else { delete cas.divisione; delete cas.altezze; }
        } else if (k === 'sistema') { if (v && v !== sistemiCassetti()[0].id) cas.sistemaCassetti = v; else delete cas.sistemaCassetti; }   // il primo = quello di partenza
        else if (k === 'apertura') {
          cas.apertura = v;                              // incassata / maniglia / ribassati
          delete cas.maniglia;
          // la sporgenza segue la scheda della maniglia (si scrive qui solo per cambiarla in questa cassettiera)
        }
        ridisegna();
      };
    });
    // QUALE MANIGLIA (solo questa cassettiera): la sporgenza è quella della maniglia, poi si può cambiare
    row.querySelectorAll('.mat-swatch[data-cman]').forEach((b) => {
      b.onclick = () => {
        mostraPorte(true);
        if (b.dataset.cman) cas.manigliaId = b.dataset.cman; else { delete cas.manigliaId; delete config.manigliaCassetti; }
        delete cas.sporgenza;                            // quella della nuova maniglia (sua scheda)
        ridisegna();
      };
    });
    const sporg = row.querySelector('.c-sporg');
    if (sporg) {
      // uguale a quella della scheda (o vuota) = segue la maniglia; diversa = solo questa cassettiera
      sporg.oninput = (e) => { const v = Math.round(Number(e.target.value) || 0); if (v > 0 && v !== sporgenzaDiManiglia(manigliaCassettiera(config, cas))) cas.sporgenza = v; else delete cas.sporgenza; onChange(config); };
      sporg.onchange = ridisegna;                      // l'avviso «obbligatorio» sparisce
    }
    row.querySelectorAll('.c-alt-i').forEach((inp) => {
      inp.oninput = (e) => {
        const i = Number(inp.dataset.i), v = Math.round(Number(e.target.value) || 0);
        if (!Array.isArray(cas.altezze)) return;
        if (v > 0) { cas.altezze[i] = v; onChange(config); }
      };
      inp.onchange = ridisegna;                        // totale e frontali aggiornati
    });
    const rib = row.querySelector('.c-ribasso');
    if (rib) rib.oninput = (e) => {
      if (e.target.value === '') delete cas.ribasso; else cas.ribasso = Math.max(0, Math.round(Number(e.target.value) || 0));
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
  const cos = misureCostado(config);
  wrap.innerHTML = Object.keys(labels).map((k) => {
    const t = config.tamponamenti[k];
    const conCostado = (k === 'sx' && cos.sx) || (k === 'dx' && cos.dx);
    return `
      <div class="tamp-row" data-k="${k}">
        <label class="chk">
          <input type="checkbox" class="t-on" ${t.attivo && !conCostado ? 'checked' : ''} ${conCostado ? 'disabled' : ''} />
          <span>${labels[k]}</span>${conCostado ? ` <span class="hint">(c'è il costado)</span>` : ''}
        </label>
        <label>Larghezza fronte (mm)
          <input type="number" class="t-lar" value="${t.larghezza}" min="20" step="1" ${t.attivo && !conCostado ? '' : 'disabled'} />
        </label>
      </div>
    `;
  }).join('');
}

/** Le misure del costado, con il conto fatto (come lo fa il falegname). */
function infoCostadi(config) {
  const el = document.getElementById('cost-info');
  if (!el) return;
  const c = misureCostado(config);
  if (!c.sx && !c.dx) { el.innerHTML = '<span>Nessun costado: armadio incassato o chiuso dai muri.</span>'; return; }
  const H = config.altezzaEsterna, W = config.larghezzaTotale;
  const conto = c.battente ? `${c.top} + ${config.spessoreSchiena} + ${config.spessoreAnte} + ${c.sporgenza}` : `${c.top} + ${config.spessoreSchiena} + ${c.sporgenza}`;
  const tot = W + (c.sx ? c.spessore : 0) + (c.dx ? c.spessore : 0);
  el.innerHTML = `
    <div><span>Costado</span> (${c.sx && c.dx ? '×2' : c.sx ? 'SX' : 'DX'}): <strong>${c.altezza} × ${c.profondita} × ${c.spessore} mm</strong></div>
    <div><span>Altezza</span>: <code>${c.sopra || c.sotto ? `${H}${c.sopra ? ` + ${c.sopra}` : ''}${c.sotto ? ` + ${c.sotto}` : ''} = ${c.altezza}` : c.altezza}</code>
      <span>${c.sopra || c.sotto ? '(armadio + tamponamenti sopra e sotto)' : "(tutta l'altezza dell'armadio)"}</span></div>
    <div><span>Profondità</span>: <code>${conto} = ${c.profondita}</code>
      <span>${c.battente ? '(top + schiena + ante + sporgenza)' : '(top + schiena + sporgenza: le ante scorrono dentro)'}</span></div>
    <div><span>Larghezza totale con i costadi</span>: <code>${W}${c.sx ? ` + ${c.spessore}` : ''}${c.dx ? ` + ${c.spessore}` : ''} = ${tot} mm</code></div>`;
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
        ...(v?.barra ? { barra: v.barra } : {}),              // barra appendiabiti del modulo
        ...(Number.isFinite(v?.barraY) ? { barraY: v.barraY } : {}),
      });
    }
  } else {
    // Tutti uguali: larghezza = floor(L/n). La somma può essere inferiore
    // a L di qualche mm (max n-1 mm) — è lo scarto naturale.
    const larModulo = Math.floor(config.larghezzaTotale / n);
    for (let i = 0; i < n; i++) {
      nuovi.push({
        larghezza: larModulo,
        numeroAnte: t.numeroAnte, antaLato: t.antaLato ?? 'dx',
        // ogni modulo tiene i SUOI ripiani (si possono eliminare/incollare nel 3D)
        ripiani: vecchi[i]?.ripiani ?? t.ripiani,
        riduzioneRipiano: t.riduzioneRipiano,
        cassettiere: (t.cassettiere || []).map((c) => ({ ...c })),
        ...(vecchi[i]?.ripianiY ? { ripianiY: vecchi[i].ripianiY } : {}),   // ripiani spostati a mano nel 3D
        ...(vecchi[i]?.barra ? { barra: vecchi[i].barra } : {}),           // barra appendiabiti del modulo
        ...(Number.isFinite(vecchi[i]?.barraY) ? { barraY: vecchi[i].barraY } : {}),
      });
    }
  }
  config.moduli = nuovi;
  adattaModuli(config);
}

/**
 * Selettore materiali: per ogni parte configurabile mostra una card
 * espandibile con il materiale corrente e una griglia di tutti quelli
 * disponibili. Cliccando una tessera, la parte cambia materiale.
 */
function renderMateriali(config) {
  const wrap = document.getElementById('mat-list');
  if (!wrap) return;
  const carte = PARTI.map((p) => {
    // Il materiale "corrente" è quello della prima chiave applicata
    const chiaveLettura = p.applica[0];
    const corrente = MATERIALI.find((m) => m.id === config.materiali[chiaveLettura])
      || MATERIALI[0];
    return `
      <details class="mat-card" data-parte="${p.id}">
        <summary>
          <span class="mat-parte">${p.nome}</span>
          <span class="mat-corrente">
            ${anteprimaMat(corrente)}
            <span>${corrente.nome}</span>
          </span>
        </summary>
        <div class="mat-tendine">
          ${htmlTendineColori(materialiPer('legno'), (m) => `
            <button type="button"
              class="mat-swatch ${m.id === corrente.id ? 'sel' : ''}"
              data-mat="${m.id}" title="${m.nome}">
              ${anteprimaMat(m)}
              <span>${m.nome}</span>
            </button>`, { sel: corrente.id, chiave: `armadio-${p.id}`, classeGriglia: 'mat-grid' })}
        </div>
      </details>
    `;
  });
  // DIVISI: in «Materiali» solo l'armadio (struttura, ante, tamponamenti, costadi, maniglie delle ante);
  // i colori e le maniglie della CASSETTIERA stanno nella sezione «Cassettiere», solo se ce n'è almeno una
  const cass = (p) => p.id.startsWith('cass');
  wrap.innerHTML = carte.filter((_, i) => !cass(PARTI[i])).join('') + cardManiglie(config);
  const wc = document.getElementById('cass-mat');
  if (wc) wc.innerHTML = (config.cassettiere || []).length ? `
      <h4 class="cass-mat-tit">Materiali della cassettiera</h4>
      ${carte.filter((_, i) => cass(PARTI[i])).join('')}` : '';
}


/** Colore del binario degli scorrevoli: i colori del catalogo (sezione Binari). */
function coloriBinario(config) {
  const lista = materialiPer('binari');
  if (!lista.length) return '';
  const sel = lista.some((m) => m.id === config.scorrevole?.coloreBinario)
    ? config.scorrevole.coloreBinario : (lista.find((m) => m.id === BINARIO_DEFAULT) || lista[0]).id;
  return `
      <span class="mat-parte">Colore del binario</span>
      <div class="mat-grid bin-grid">
        ${lista.map((m) => `
          <button type="button" class="mat-swatch ${m.id === sel ? 'sel' : ''}" data-bin="${m.id}" title="${m.nome}">
            <span class="man-tessera" style="background:${sfondoSwatch(m)}"></span><span>${m.nome}</span></button>`).join('')}
      </div>`;
}

/** Colore dei PROFILI verticali delle ante scorrevoli: gli stessi colori del binario (di partenza bianco). */
function coloriProfilo(config) {
  const lista = materialiPer('binari');
  if (!lista.length) return '';
  const sel = coloreProfiloScorrevole(config);
  return `
      <span class="mat-parte">Colore dei profili delle ante (sui due lati, a tutta altezza)</span>
      <div class="mat-grid bin-grid">
        ${lista.map((m) => `
          <button type="button" class="mat-swatch ${m.id === sel ? 'sel' : ''}" data-profilo="${m.id}" title="${m.nome}">
            <span class="man-tessera" style="background:${sfondoSwatch(m)}"></span><span>${m.nome}</span></button>`).join('')}
      </div>`;
}

/** Maniglie delle ante (catalogo, come in cucina): nessuna = ante lisce. Scorrevoli: niente maniglie (ci sono i profili). */
function cardManiglie(config) {
  if (config.tipoArmadio === 'scorrevole') return '';
  const lista = materialiPer('maniglie');
  const sel = config.maniglia || 'nessuna';
  const corr = lista.find((m) => m.id === sel);
  const tessera = (m) => m
    ? `<span class="man-tessera" style="background:${sfondoSwatch(m)}"></span>`
    : '<span class="man-tessera man-nessuna">—</span>';
  return `
      <details class="mat-card" data-parte="maniglia">
        <summary>
          <span class="mat-parte">Maniglie delle ante</span>
          <span class="mat-corrente">${tessera(corr)}<span>${corr ? corr.nome : 'Senza maniglia (ante lisce)'}</span></span>
        </summary>
        <div class="mat-grid">
          <button type="button" class="mat-swatch ${sel === 'nessuna' ? 'sel' : ''}" data-man="nessuna" title="Senza maniglia">
            ${tessera(null)}<span>Senza maniglia</span></button>
          ${lista.map((m) => `
            <button type="button" class="mat-swatch ${m.id === sel ? 'sel' : ''}" data-man="${m.id}" title="${m.nome}">
              ${tessera(m)}<span>${m.nome}</span></button>`).join('')}
        </div>
      </details>
      ${corr ? (() => {
        // LUNGHEZZA DELLA MANIGLIA: quella del catalogo, una misura, o alta come l'anta (mai più lunga dell'anta)
        const std = corr.texture && corr.lunghezzaMm ? corr.lunghezzaMm : 300, sc = config.manigliaLunghezza;
        const scelte = [['', `Standard (${Math.round(std / 10)} cm)`], ['300', '30 cm'], ['600', '60 cm'], ['1000', '100 cm'], ['1600', '160 cm'], ['anta', 'Alta come l\'anta']];
        const att = sc == null ? '' : String(sc);
        return `
      <div class="man-pos">
        <span class="mat-parte">Lunghezza della maniglia</span>
        <div class="man-pos-scelte" style="flex-wrap:wrap">
          ${scelte.map(([v, n]) => `<button type="button" class="btn-ghost btn-mini ${att === v ? 'attivo' : ''}" data-manlung="${v}">${n}</button>`).join('')}
        </div>
        <label class="hint" style="display:block;margin-top:6px">Altra misura (cm)
          <input type="number" id="man-lung-cm" min="5" max="300" step="1" value="${Number(sc) > 0 ? Math.round(Number(sc) / 10) : ''}" placeholder="${Math.round(std / 10)}" inputmode="numeric" style="width:90px;margin-left:6px"></label>
      </div>`;
      })() : ''}
      ${corr && ((config.manigliaLunghezza === 'anta' ? 1001 : Number(config.manigliaLunghezza) || (corr.texture && corr.lunghezzaMm ? corr.lunghezzaMm : 300))) > 1000 ? `
      <div class="man-pos">
        <span class="mat-parte">Posizione della maniglia</span>
        <div class="man-pos-scelte">
          ${[['centro', 'Dal centro'], ['fondo', 'Dal fondo']].map(([v, n]) => `<button type="button" class="btn-ghost btn-mini ${(config.manigliaPosizione || 'fondo') === v ? 'attivo' : ''}" data-manpos="${v}">${n}</button>`).join('')}
        </div>
      </div>` : ''}`;
}

function attaccaEventiMateriali(contenitore, config, onChange) {
  const rifai = () => { renderMateriali(config); attaccaEventiMateriali(contenitore, config, onChange); onChange(config); };
  contenitore.querySelectorAll('[data-manlung]').forEach((btn) => btn.addEventListener('click', () => {
    const v = btn.dataset.manlung;
    if (!v) delete config.manigliaLunghezza; else config.manigliaLunghezza = v === 'anta' ? 'anta' : Number(v);
    rifai();
  }));
  contenitore.querySelector('#man-lung-cm')?.addEventListener('change', (e) => {
    const cm = Number(e.target.value);
    if (cm >= 5) config.manigliaLunghezza = Math.round(cm * 10); else delete config.manigliaLunghezza;
    rifai();
  });
  contenitore.querySelectorAll('[data-manpos]').forEach((btn) => {
    btn.addEventListener('click', () => {
      config.manigliaPosizione = btn.dataset.manpos;
      renderMateriali(config);
      attaccaEventiMateriali(contenitore, config, onChange);
      onChange(config);
    });
  });
  contenitore.querySelectorAll('.mat-swatch[data-man]').forEach((btn) => {
    btn.addEventListener('click', () => {
      config.maniglia = btn.dataset.man === 'nessuna' ? null : btn.dataset.man;
      mostraPorte(false);                              // maniglie delle ANTE: porte chiuse per vederle
      renderMateriali(config);
      attaccaEventiMateriali(contenitore, config, onChange);
      onChange(config);
    });
  });
  contenitore.querySelectorAll('.mat-card').forEach((card) => {
    const parteId = card.dataset.parte;
    const parte = PARTI.find((p) => p.id === parteId);
    if (!parte) return;                              // card delle maniglie: eventi sopra
    card.querySelectorAll('.mat-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Applica a tutte le chiavi associate (es. Struttura → carcassa+schiena)
        parte.applica.forEach((k) => {
          config.materiali[k] = btn.dataset.mat;
        });
        // SPESSORE DAL MATERIALE (MDF / melaminico 16 o 19, prodotti con lo spessore scritto): i pezzi fatti con
        // quel materiale prendono il suo spessore (misure, distinta e 3D); si può sempre cambiare a mano
        const spM = spessoreMateriale(btn.dataset.mat);
        if (spM) {
          if (parte.id === 'struttura') config.spessoreCarcassa = spM;
          else if (parte.id === 'ante') config.spessoreAnte = spM;
          else if (parte.id === 'costadi') config.costadi = { ...(config.costadi || {}), spessore: spM };
          const campi = { '#sp-carc': config.spessoreCarcassa, '#sp-ante': config.spessoreAnte, '#cost-sp': (config.costadi && config.costadi.spessore) || config.spessoreAnte };
          for (const [sel, v] of Object.entries(campi)) { const inp = document.querySelector(sel); if (inp) inp.value = v; }
        }
        if (parte.id.startsWith('cass')) mostraPorte(true);   // colori della cassettiera: porte aperte
        else if (parte.id === 'ante') mostraPorte(false);     // colore delle ante: porte chiuse
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


// ---------------------------------------------------------------------------
// PIEDINI E ZOCCOLO dell'armadio (battente e scorrevole): piedini sì / no con l'altezza; con i piedini lo
// zoccolo sì / no, automatico (largo quanto l'armadio fuori, alto quanto i piedini) o con le misure scelte.
// Di partenza quelli dei ⚙ Parametri; l'armadio si alza dei piedini (distinta e 3D con le stesse misure).
// ---------------------------------------------------------------------------
const ALTEZZE_PIEDINI = [30, 40, 50, 100, 150, 200];
function htmlPiedini(config) {
  const pd = piediniArmadio(config), z = zoccoloArmadio(config);
  // le misure automatiche (anche quando sono scelte quelle personalizzate)
  const zA = pd.zoccolo ? zoccoloArmadio({ ...config, piedini: { ...(config.piedini || {}), si: true, altezza: pd.h, zoccolo: { ...((config.piedini || {}).zoccolo || {}), si: true, auto: true } } }) : null;
  const radio = (name, v, on, testo) => `<label class="radio"><input type="radio" name="${name}" value="${v}" ${on ? 'checked' : ''} /><span>${testo}</span></label>`;
  return `
    <div class="radio-row">${radio('pd-si', 'no', !pd.si, 'Senza piedini')}${radio('pd-si', 'si', pd.si, 'Con i piedini')}</div>
    ${pd.si ? `
    <label>Altezza dei piedini (mm)<input type="number" id="pd-h" value="${pd.h}" min="1" step="1" /></label>
    <div class="radio-row" style="flex-wrap:wrap;gap:6px;margin-top:4px">${ALTEZZE_PIEDINI.map((h) => `<button type="button" class="btn-mini ${pd.h === h ? 'attivo' : ''}" data-pdh="${h}">${h / 10} cm</button>`).join('')}</div>
    <div class="radio-row" style="margin-top:10px">${radio('pd-zoc', 'no', !pd.zoccolo, 'Senza zoccolo')}${radio('pd-zoc', 'si', !!pd.zoccolo, 'Con lo zoccolo')}</div>
    ${pd.zoccolo ? `
    <div class="radio-row" style="flex-wrap:wrap">${radio('pd-zauto', 'auto', pd.zoccolo.auto, `Misure automatiche (${Math.round(zA.larghezza)} × ${Math.round(zA.altezza)})`)}${radio('pd-zauto', 'pers', !pd.zoccolo.auto, 'Misure personalizzate')}</div>
    ${!pd.zoccolo.auto ? `<div class="grid-2">
      <label>Larghezza zoccolo (mm)<input type="number" id="zoc-L" value="${Math.round(z.larghezza)}" min="50" step="1" /></label>
      <label>Altezza zoccolo (mm)<input type="number" id="zoc-H" value="${Math.round(z.altezza)}" min="10" step="1" /></label>
    </div>` : ''}
    ${(() => { const cos = misureCostado(config); return `
    <div class="radio-row" style="flex-wrap:wrap;margin-top:6px">
      <label class="radio"><input type="checkbox" id="zoc-lat-sx" ${pd.zoccolo.latSx && !cos.sx ? 'checked' : ''} ${cos.sx ? 'disabled' : ''} /><span>Zoccolo anche sul fianco sinistro${cos.sx ? ' (c\'è il costado)' : ''}</span></label>
      <label class="radio"><input type="checkbox" id="zoc-lat-dx" ${pd.zoccolo.latDx && !cos.dx ? 'checked' : ''} ${cos.dx ? 'disabled' : ''} /><span>Zoccolo anche sul fianco destro${cos.dx ? ' (c\'è il costado)' : ''}</span></label>
    </div>
    ${z.incassato ? `<p class="hint">Con i costadi fino a terra lo zoccolo va incassato fra i costadi, rientrato di ${z.rientro} mm come in cucina (⚙ Parametri).</p>` : ''}`; })()}` : ''}
    <p class="hint">L'armadio si alza di ${pd.h} mm: altezza totale ${Math.round(config.altezzaEsterna + pd.h)} mm. Automatico = largo quanto l'armadio fuori (con i tamponamenti laterali; i costadi arrivano fino a terra) e alto quanto i piedini.</p>` : ''}`;
}
function attaccaEventiPiedini(contenitore, config, onChange) {
  const box = contenitore.querySelector('#piedini-box');
  if (!box) return;
  // la scelta diventa di questo armadio (prima valevano i ⚙ Parametri)
  const scrivi = (f) => {
    const P = parametri().piedini[config.tipoArmadio === 'scorrevole' ? 'scorrevole' : 'battente'];
    const c = config.piedini || {}, zc = c.zoccolo || {};
    const o = { si: c.si != null ? !!c.si : !!P.si, altezza: c.altezza ?? P.altezza,
      zoccolo: { si: zc.si != null ? !!zc.si : !!P.zoccolo, auto: zc.auto !== false, larghezza: zc.larghezza ?? null, altezza: zc.altezza ?? null,
        latSx: zc.latSx != null ? !!zc.latSx : !!P.lateraleSx, latDx: zc.latDx != null ? !!zc.latDx : !!P.lateraleDx } };
    f(o);
    config.piedini = o;
    box.innerHTML = htmlPiedini(config);
    attaccaEventiPiedini(contenitore, config, onChange);
    onChange(config);
  };
  box.querySelectorAll('input[name="pd-si"]').forEach((r) => r.addEventListener('change', (e) => scrivi((o) => { o.si = e.target.value === 'si'; })));
  box.querySelectorAll('input[name="pd-zoc"]').forEach((r) => r.addEventListener('change', (e) => scrivi((o) => { o.zoccolo.si = e.target.value === 'si'; })));
  box.querySelectorAll('input[name="pd-zauto"]').forEach((r) => r.addEventListener('change', (e) => scrivi((o) => {
    o.zoccolo.auto = e.target.value === 'auto';
    if (!o.zoccolo.auto) { const z = zoccoloArmadio(config); o.zoccolo.larghezza = o.zoccolo.larghezza || Math.round(z.larghezza); o.zoccolo.altezza = o.zoccolo.altezza || Math.round(z.altezza); }
  })));
  box.querySelectorAll('[data-pdh]').forEach((b) => b.addEventListener('click', () => scrivi((o) => { o.altezza = Number(b.dataset.pdh); })));
  box.querySelector('#pd-h')?.addEventListener('change', (e) => { const v = Math.round(Number(e.target.value)); if (v > 0) scrivi((o) => { o.altezza = v; }); });
  box.querySelector('#zoc-lat-sx')?.addEventListener('change', (e) => scrivi((o) => { o.zoccolo.latSx = e.target.checked; }));
  box.querySelector('#zoc-lat-dx')?.addEventListener('change', (e) => scrivi((o) => { o.zoccolo.latDx = e.target.checked; }));
  box.querySelector('#zoc-L')?.addEventListener('change', (e) => { const v = Math.round(Number(e.target.value)); if (v >= 50) scrivi((o) => { o.zoccolo.larghezza = v; }); });
  box.querySelector('#zoc-H')?.addEventListener('change', (e) => { const v = Math.round(Number(e.target.value)); if (v >= 10) scrivi((o) => { o.zoccolo.altezza = v; }); });
}

/** Accanto a una tendina dei Parametri: la foto della voce scelta (se ne ha una). */
function fotoScelta(select, tipo, id) {
  const box = select.parentElement && select.parentElement.querySelector('.par-mini');
  if (!box) return;
  box.dataset.mini = `voce:${tipo}:${id}`;
  riempiMiniature(box.parentElement);
}

/** Anteprima di un materiale: la sua foto, o il suo colore (es. MDF bianco: non ha una foto). */
function anteprimaMat(m) {
  return m && m.thumb ? `<img src="${m.thumb}" alt="" />` : `<span class="man-tessera" style="background:${sfondoSwatch(m || {})}"></span>`;
}
