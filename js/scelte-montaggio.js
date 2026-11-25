// =============================================================================
// COME MONTI GLI ARMADI — le scelte con i disegni (prima configurazione, ⚙ Parametri, singolo armadio)
// =============================================================================
// Struttura (standard / fianchi esterni), schiena (avvitata dietro / incassata a filo / nel canale,
// con spessore, profondità del canale e quanto dentro), ante a battente (sopra la struttura / interne,
// con aria e spazio fino al ripiano). Ogni modo è una scheda col suo disegno; sotto, l'esempio con le
// misure vere calcolate con le formule della distinta (armadio 1000 × 2000 × 600).
//
//   htmlMontaggio(v, opz)            → HTML (v = valori, vedi valoriDaParametri / valoriDaArmadio)
//   agganciaMontaggio(root, leggi, scrivi, opz)  → collega tocchi e numeri: scrivi(patch) salva
// =============================================================================
import { svgStruttura, svgSchiena, svgAnteInterne } from './disegni-montaggio.js?v=20261126x';
import { calcolaDistintaCompleta } from './calcoli.js?v=20261126x';
import { parametri, salvaParametri } from './parametri.js?v=20261126x';
import { binariScorrevoli } from './parametri.js?v=20261126x';

const t = (s) => (typeof window !== 'undefined' && window.NGI18N ? window.NGI18N.t(s) : s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let _stile = false;
function stile() {
  if (_stile || typeof document === 'undefined') return; _stile = true;
  const st = document.createElement('style');
  st.textContent = `
  .mont-gruppo{margin:0 0 18px}
  .mont-gruppo h4{margin:0 0 4px;font-size:15px;color:var(--oro-chiaro,#e8c25a);letter-spacing:.3px}
  .mont-gruppo>p{margin:0 0 8px;color:var(--testo-dim,#b8ad97);font-size:13px;line-height:1.35}
  .mont-schede{display:flex;flex-wrap:wrap;gap:10px}
  .mont-scheda{all:unset;cursor:pointer;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;border:1px solid #4a4030;border-radius:10px;background:#14110d;flex:1 1 230px;max-width:100%;color:#e6dcc6;font:13px/1.3 var(--font-ui,sans-serif);text-align:center}
  .mont-scheda svg{max-width:100%;height:auto}
  .mont-scheda.sel{border-color:#e8c25a;box-shadow:0 0 0 2px rgba(232,194,90,.35);background:#1d1812}
  .mont-scheda b{color:#e8c25a;font-weight:600}
  .mont-scheda small{color:#b8ad97}
  .mont-numeri{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 0}
  .mont-numeri label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#b8ad97;min-width:150px}
  .mont-numeri input{width:110px;padding:8px 10px;border-radius:8px;border:1px solid #4a4030;background:#0d0a06;color:#fff;font:16px var(--font-ui,sans-serif)}
  .mont-fig{display:flex;justify-content:center;margin-top:12px;padding:10px;border-radius:10px;background:#110e0a;border:1px solid #2a2416}
  .mont-fig svg{max-width:100%;height:auto}
  .mont-esempio{margin-top:10px;padding:10px 12px;border:1px dashed #6a5a36;border-radius:8px;color:#e6dcc6;font-size:13px;line-height:1.45;background:rgba(232,194,90,.05)}
  .mont-esempio b{color:#e8c25a}`;
  document.head.appendChild(st);
}

/** Valori dai ⚙ Parametri (prima configurazione e pagina Parametri). */
export function valoriDaParametri(P = parametri()) {
  const a = P.armadi, i = P.anteInterne;
  return { setup: a.setup, ante: a.ante, schiena: a.schiena, spessoreSchiena: a.spessoreSchiena, canale: a.canale, dentro: a.dentro, aria: i.aria, spazioRipiano: i.spazioRipiano };
}
/** Scrive nei ⚙ Parametri le scelte cambiate (patch con le stesse chiavi di valoriDaParametri). */
export function scriviParametri(patch) {
  const n = JSON.parse(JSON.stringify(parametri()));
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'aria' || k === 'spazioRipiano') n.anteInterne[k] = v; else n.armadi[k] = v;
  }
  return salvaParametri(n);
}

/** ARMADI SCORREVOLI: valori dai ⚙ Parametri (uguale = 'si' | 'no': struttura come il battente?). */
export function valoriScorrevoli(P = parametri()) {
  const a = P.scorrevoli.uguale ? P.armadi : P.scorrevoli;
  return { uguale: P.scorrevoli.uguale ? 'si' : 'no', setup: a.setup, schiena: a.schiena, spessoreSchiena: a.spessoreSchiena, canale: a.canale, dentro: a.dentro, tipo: 'scorrevole' };
}
/** Scrive le scelte degli scorrevoli. Passando a «no» si parte dalle scelte del battente. */
export function scriviScorrevoli(patch) {
  const n = JSON.parse(JSON.stringify(parametri()));
  if ('uguale' in patch) {
    const no = patch.uguale === 'no';
    if (no && n.scorrevoli.uguale) { const a = n.armadi; Object.assign(n.scorrevoli, { setup: a.setup, schiena: a.schiena, spessoreSchiena: a.spessoreSchiena, canale: a.canale, dentro: a.dentro }); }
    n.scorrevoli.uguale = !no;
  }
  for (const [k, v] of Object.entries(patch)) if (k !== 'uguale' && k !== 'tipo') n.scorrevoli[k] = v;
  return salvaParametri(n);
}
/** La domanda: la struttura dello scorrevole la fai come il battente? */
export function htmlUguale(v) {
  stile();
  const B = parametri().armadi;
  const sch = B.schiena === 'dietro' ? 'avvitata dietro' : B.schiena === 'filo' ? 'incassata a filo' : 'nel canale';
  const come = `${t(B.setup === 2 ? 'Fianchi esterni' : 'Standard (come ora)')} · ${t('schiena')} ${t(sch)}`;
  return `<div class="mont-gruppo"><h4>${esc(t('La struttura degli armadi scorrevoli la fai come quella dei battenti?'))}</h4>
    <p>${esc(t('Struttura e schiena dei battenti:'))} <b>${esc(come)}</b></p><div class="mont-schede">
    ${scheda('uguale', 'si', v.uguale !== 'no', svgStruttura(B.setup), 'Sì, uguale', 'Tengo struttura e schiena dei battenti')}
    ${scheda('uguale', 'no', v.uguale === 'no', '<svg viewBox="0 0 230 190" width="230" height="190" aria-hidden="true"><text x="115" y="112" text-anchor="middle" font-size="64" fill="#e8c25a" font-family="sans-serif">?</text></svg>', 'No, la faccio diversa', 'Rispondo alle domande per gli scorrevoli')}
  </div></div>`;
}

/** Configurazione di prova (1000 × 2000 × 600, 2 ante, 3 ripiani) con le scelte v. */
function armadioDiProva(v) {
  if (v.tipo === 'scorrevole') {
    const b = binariScorrevoli()[0];
    return {
      tipoArmadio: 'scorrevole', larghezzaTotale: 1000, altezzaEsterna: 2000, profonditaEsterna: 600,
      spessoreCarcassa: 18, spessoreAnte: 18, spessoreSchiena: Number(v.spessoreSchiena) || 10,
      setupCarcassa: Number(v.setup) === 2 ? 2 : 1, schiena: { tipo: v.schiena, canale: v.canale, dentro: v.dentro },
      scorrevole: { anteModulo: 1, binario: (b && b.profondita && b.profondita[0]) || 75, tipoBinario: b && b.id },
      moduli: [{ larghezza: 1000, numeroAnte: 1, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] }],
      cassettiere: [], tamponamenti: {}, costadi: { lati: 'nessuno' }, materiali: {},
    };
  }
  return {
    tipoArmadio: 'battente', larghezzaTotale: 1000, altezzaEsterna: 2000, profonditaEsterna: 600,
    spessoreCarcassa: 18, spessoreAnte: 18, spessoreSchiena: Number(v.spessoreSchiena) || 10,
    setupCarcassa: Number(v.setup) === 2 ? 2 : 1, anteInterne: v.ante === 'interne',
    schiena: { tipo: v.schiena, canale: v.canale, dentro: v.dentro },
    moduli: [{ larghezza: 1000, numeroAnte: 2, antaLato: 'dx', ripiani: 3, riduzioneRipiano: 0, cassettiere: [] }],
    cassettiere: [], tamponamenti: {}, costadi: { lati: 'nessuno' }, materiali: {},
  };
}
/** L'esempio con le misure vere (le stesse formule della distinta). */
export function htmlEsempio(v) {
  let pezzi = [];
  try { pezzi = calcolaDistintaCompleta(armadioDiProva(v)).pezzi; } catch (_) { return ''; }
  const riga = (re) => pezzi.filter((p) => re.test(p.nome) && p.larghezza != null).map((p) => `${esc(t(p.nome))} <b>${p.larghezza} × ${p.altezza}</b>${p.quantita > 1 ? ` ×${p.quantita}` : ''}`);
  const cern = pezzi.find((p) => /Cerniere/.test(p.nome));
  const righe = [...riga(/^Top|^Fondo|^Top \/ Fondo/), ...riga(/^Fianco/), ...riga(/^Schiena/), ...riga(/^Ripiano/), ...riga(/^Anta/)];
  const tit = v.tipo === 'scorrevole' ? 'Esempio: armadio scorrevole 1000 × 2000 × 600, struttura 18, 1 modulo, 3 ripiani' : 'Esempio: armadio 1000 × 2000 × 600, struttura 18, ante 18, 2 ante, 3 ripiani';
  return `<div class="mont-esempio">${esc(t(tit))}<br>${righe.join(' · ')}${cern ? ` · ${esc(t(cern.nome))} <b>${cern.quantita}</b>` : ''}</div>`;
}

const scheda = (gruppo, val, sel, svg, titolo, sotto) => `<button type="button" class="mont-scheda ${sel ? 'sel' : ''}" data-mont="${gruppo}" data-val="${val}" aria-pressed="${sel}">
  ${svg}<b>${esc(t(titolo))}</b>${sotto ? `<small>${esc(t(sotto))}</small>` : ''}</button>`;
const numero = (k, et, v, min = 0) => `<label>${esc(t(et))}<input type="number" inputmode="decimal" min="${min}" step="0.5" data-montnum="${k}" value="${esc(v)}"></label>`;

/**
 * Le scelte. opz: { struttura: true, schiena: true, ante: true, numeriAnte: true (aria e spazio), esempio: true }
 */
export function htmlMontaggio(v, opz = {}) {
  stile();
  const o = { struttura: true, schiena: true, ante: true, numeriAnte: true, esempio: true, ...opz };
  if (v.tipo === 'scorrevole') o.ante = false;
  const sv = { spessore: v.spessoreSchiena, canale: v.canale, dentro: v.dentro, interne: v.ante === 'interne' };
  let h = '';
  if (o.struttura) h += `<div class="mont-gruppo"><h4>${esc(t('Struttura'))}</h4><p>${esc(t('Come stanno top, fondo e fianchi.'))}</p><div class="mont-schede">
    ${scheda('setup', 1, Number(v.setup) !== 2, svgStruttura(1), 'Standard (come ora)', 'Top e fondo sopra, fianchi dentro')}
    ${scheda('setup', 2, Number(v.setup) === 2, svgStruttura(2), 'Fianchi esterni', 'Fianchi interi, top e fondo dentro')}
  </div></div>`;
  if (o.schiena) h += `<div class="mont-gruppo"><h4>${esc(t('Schiena'))}</h4><p>${esc(t('Come monti la schiena: da qui si calcolano la profondità della struttura, dei ripiani e delle cassettiere.'))}</p><div class="mont-schede">
    ${scheda('schiena', 'dietro', v.schiena === 'dietro', svgSchiena({ ...sv, tipo: 'dietro' }), 'Avvitata dietro', 'Copre tutto il retro')}
    ${scheda('schiena', 'filo', v.schiena === 'filo', svgSchiena({ ...sv, tipo: 'filo' }), 'Incassata a filo', 'Dentro, a filo del retro dei fianchi')}
    ${scheda('schiena', 'canale', v.schiena === 'canale', svgSchiena({ ...sv, tipo: 'canale' }), 'Nel canale', 'Nel canale di fianchi, top e fondo: più grande')}
  </div><div class="mont-numeri">
    ${numero('spessoreSchiena', 'Spessore schiena (mm)', v.spessoreSchiena, 1)}
    ${v.schiena === 'canale' ? numero('canale', 'Profondità del canale (mm)', v.canale) + numero('dentro', 'Quanto dentro dal retro (mm)', v.dentro) : ''}
  </div></div>`;
  if (o.ante) h += `<div class="mont-gruppo"><h4>${esc(t('Ante a battente'))}</h4><p>${esc(t('Sopra la struttura o dentro il vano, a filo.'))}</p><div class="mont-schede">
    ${scheda('ante', 'sopra', v.ante !== 'interne', svgSchiena({ ...sv, tipo: v.schiena, interne: false }), 'Sopra la struttura (normali)', "L'anta copre il davanti")}
    ${scheda('ante', 'interne', v.ante === 'interne', svgSchiena({ ...sv, tipo: v.schiena, interne: true }), 'Interne (dentro il vano)', 'A filo della struttura')}
  </div>${o.numeriAnte && v.ante === 'interne' ? `<div class="mont-numeri">
    ${numero('aria', "Aria attorno all'anta (mm)", v.aria)}
    ${numero('spazioRipiano', 'Spazio fra anta e ripiano (mm)', v.spazioRipiano)}
  </div><div class="mont-fig">${svgAnteInterne({ aria: v.aria, spazioRipiano: v.spazioRipiano })}</div>` : ''}</div>`;
  if (o.esempio) h += `<div data-mont-esempio>${htmlEsempio(v)}</div>`;
  return h;
}

/**
 * Collega le scelte. leggi() → valori attuali · scrivi(patch) salva · ridisegna() rifà l'HTML.
 */
export function agganciaMontaggio(root, leggi, scrivi, ridisegna) {
  root.querySelectorAll('[data-mont]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.mont, val = k === 'setup' ? Number(b.dataset.val) : b.dataset.val;
    const uguale = leggi()[k] === val;
    scrivi({ [k]: val });                 // anche se è già quella: vale come risposta
    if (!uguale) ridisegna();
  }));
  root.querySelectorAll('[data-montnum]').forEach((inp) => inp.addEventListener('change', () => {
    const n = Number(String(inp.value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return;
    // ridisegno dopo: il campo può essere ancora attivo (tastiera dell'iPhone, «Invio»)
    scrivi({ [inp.dataset.montnum]: n }); setTimeout(ridisegna, 0);
  }));
}
