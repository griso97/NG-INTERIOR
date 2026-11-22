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
  infoTipo, altezzeTipo, campiMobile, descrizioneMobile, categoriaTipo, livelloDiMobile, frigoSottoAltillo,
  costadiDelFrigo, sincronizzaFrigo, cimaMobileSopraFrigo, togliAltiDentroColonne, spazioMancante, baseAMuro, sceltePorteGruppo, COLORI_FRIGO, spaziPensili, allargaPensile, sistemaSpaziPensili, moduloDaOrdinare, segnaFuoriMisura, modoIsola, centroPianta, APPOGGI_TAVOLO, nomeAppoggioTavolo, pontiSopra, cambiaPensileSottoPonte,
  spazioLiberoParete, moduliDiParete,
  aggiungiModuloBase, aggiungiFascia,
  rimuoviModuloBase, rimuoviFascia,
  spostaModulo, problemiIngombri, problemiMobiliLiberi,
  ruotaPianta, specchiaPianta, inverteAngolo,
  toggleParete, muroTolto, snap, liberoPareti, generaPensiliAuto, generaPonteAuto, spessorePannelloPonte, spessoreAntePonte, pannelliSottoPonte, riorientaMobili,
  spaziTraMobili, riempiSpaziReglette, infoAngoloCieco, applicaRegletteAngolo, inserisciInAngolo, mettiNelVano,
  aggiungiMobileLibero, trovaMobileLibero, ruotaMobileLibero, rimuoviMobileLibero, muoviMobileLibero,
  vincolaAiMuri, posizionaVincolata, orientaVersoMuro, rotazioneAutomatica, migraRotazioni,
  anteDiMobile, sincronizzaAntePensile, VARIANTI_COLONNA, frontiCassetti,
  angoloInternoVertice, impostaAngoloVertice, muoviVertice, agganciaSquadra, aggiungiPareteLibera, calcolaVertici,
  correggiLatoInterno, latoInternoAutomatico, agganciaAngoloL, anteBaseAngolo, dimMobile, rettangoloSoffitto, apertoDi, ripianiAperto, latoApertoDi, latiLiberi, migraProfonditaPensili, PARTI_APERTO, coloreParteAperto, ledAperto,
  COLORI_GOLA, golaProgetto, golaSuMobile, spazioGola, piediniCucina, altezzaBassiCucina, sporgenzaPiano, altezzaAlzatina } from './modello.js?v=20261124n';
import { renderPianta } from './pianta.js?v=20261124n';
import { PAVIMENTI, GRUPPI_PAVIMENTI, aggiungiPavimentoProprio, rimuoviPavimentoProprio } from '../pavimenti-dati.js?v=20261124n';
import { htmlTendineColori } from '../tendine-colori.js?v=20261124n';
import { FINITURE_MANIGLIA } from '../finiture-maniglia.js?v=20261124n';
import { coloriLampada, lampadaDaTipo } from '../colori-lampade.js?v=20261124n';
import { calcolaDistintaCucina } from './distinta.js?v=20261124n';
import { salvaProgetto, caricaProgetto, resetProgetto, MODO_CUCINA } from './storage.js?v=20261124n';
import { salvaEsempioModificato, salvaProgettoPredefinito } from '../esempi-dati.js?v=20261124n';
import { parametri, daImpostare } from '../parametri.js?v=20261124n';
import { htmlAvvisoMancanti, confermaEsportazione } from '../avviso-parametri.js?v=20261124n';
import { agganciaTema } from '../tema.js?v=20261124n';
import { tendinePannello } from '../tendine-pannello.js?v=20261124n';
// export Excel (con lo zip, ~115 KB): si scarica dopo l'apertura, quando la pagina è ferma
const _excel = () => import('../modello-export.js?v=20261124n');
const esportaExcel = (...a) => _excel().then((m) => m.esportaExcel(...a));
const apriModelloExcel = (...a) => _excel().then((m) => m.apriModelloExcel(...a));
(window.requestIdleCallback || ((f) => setTimeout(f, 4000)))(() => _excel().catch(() => {}), { timeout: 8000 });

// --- Stato iniziale: ultimo progetto salvato, oppure default ---
const progettoSalvato = caricaProgetto();
let progetto = progettoSalvato || progettoDefault();
// Nascondi l'altro livello (alti mentre fai i bassi, bassi mentre fai gli alti): scelta di questo dispositivo
const nascondiAltro = { basso: false, alto: false };
try { Object.assign(nascondiAltro, JSON.parse(localStorage.getItem('ng-cucina-nascondi') || '{}')); } catch (_) { /* niente memoria: si parte tutto visibile */ }
if (!progetto.stepCorrente) progetto.stepCorrente = 1;
// PASSI: 1 Pianta · 2 Moduli bassi · 3 Moduli alti · 4 Accessori · 5 Rendering 3D.
// I progetti salvati prima avevano il rendering al passo 4: lì vanno al 5.
const P_ACC = 4, P_3D = 5;
if (!progetto.passi5) { if (progetto.stepCorrente === 4) progetto.stepCorrente = P_3D; progetto.passi5 = true; }
// Progetti di prima: i mobili girati a mano al centro tengono la rotazione
if (progettoSalvato && progettoSalvato.piano) migraRotazioni(progettoSalvato);
// Pensili da 33 (prima 35): nei progetti di prima la schiena resta contro il muro
if (progettoSalvato && progettoSalvato.piano) migraProfonditaPensili(progettoSalvato);
// Progetti salvati con versioni precedenti: completo i campi mancanti
progetto = { ...progettoDefault(), ...progetto };
// Due cucine separate: il tipo lo dice la pagina (cucina.html?tipo=normale / ?tipo=ponte)
progetto.tipoCucina = MODO_CUCINA || 'normale';
const cucinaPonte = () => progetto.tipoCucina === 'ponte';

/**
 * SCHERMATA DI SCELTA (cucina.html senza tipo): Cucina normale o Cucina a
 * ponte. Ognuna ha il SUO progetto in corso; la cucina a ponte può caricare un
 * progetto di cucina normale e trasformarlo, senza rifarlo da zero.
 */
function mostraSceltaTipoCucina() {
  if (MODO_CUCINA || document.getElementById('scelta-tipo-cucina')) return;
  const t = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  const ov = document.createElement('div');
  ov.id = 'scelta-tipo-cucina';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg,#0d0d0d);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
  const card = (id, titolo, testo, svg) => `
    <a href="./cucina.html?tipo=${id}" data-tipocucina="${id}" style="flex:1 1 240px;max-width:320px;background:var(--bg-2,#151515);color:var(--testo,#eee);border:1px solid var(--oro,#c9a94a);border-radius:12px;padding:20px;text-decoration:none;display:block">
      <svg viewBox="0 0 120 70" width="100%" height="100" fill="none" stroke="#c9a94a" stroke-width="2.5">${svg}</svg>
      <div style="font-weight:700;font-size:20px;margin:12px 0 6px;color:var(--oro-chiaro,#e8c25a)">${t(titolo)}</div>
      <div style="font-size:14px;line-height:1.45;opacity:.85">${t(testo)}</div>
      <div style="margin-top:12px;color:var(--oro,#c9a94a);font-weight:600">${t('Progetta →')}</div>
    </a>`;
  ov.innerHTML = `
    <div style="max-width:720px;width:100%">
      <a href="./scegli.html" style="display:inline-flex;align-items:center;gap:8px;color:var(--oro-chiaro,#e8c25a);text-decoration:none;font-size:15px;font-weight:600;border:1px solid var(--oro,#c9a94a);border-radius:999px;padding:9px 18px;background:rgba(201,169,74,.08)">← ${t('Indietro')}</a>
      <div style="letter-spacing:.2em;font-size:13px;color:var(--oro,#c9a94a);margin:14px 0 6px">${t('CUCINA')}</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:16px;color:var(--testo,#eee)">${t('Che cucina vuoi progettare?')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center">
        ${card('normale', 'Cucina normale', 'Basi, pensili, colonne, isola e penisola.',
          '<rect x="8" y="40" width="104" height="24"/><rect x="8" y="8" width="104" height="18"/><line x1="34" y1="40" x2="34" y2="64"/><line x1="60" y1="40" x2="60" y2="64"/><line x1="86" y1="40" x2="86" y2="64"/>')}
        ${card('ponte', 'Cucina a ponte', 'Colonne ai lati e il PONTE sopra le basi. Puoi caricare una cucina normale già fatta e trasformarla.',
          '<rect x="6" y="6" width="22" height="58"/><rect x="92" y="6" width="22" height="58"/><rect x="28" y="6" width="64" height="14" fill="rgba(201,169,74,.25)"/><rect x="28" y="44" width="64" height="20"/><line x1="49" y1="44" x2="49" y2="64"/><line x1="70" y1="44" x2="70" y2="64"/><line x1="49" y1="6" x2="49" y2="20"/><line x1="70" y1="6" x2="70" y2="20"/>')}
      </div>
      <div style="font-size:13px;opacity:.7;margin-top:14px;text-align:center;color:var(--testo,#eee)">${t('Ognuna ha il suo progetto: lavorare su una non cambia l\'altra.')}</div>
      <a href="./esempi.html" id="scelta-esempi" style="display:none;align-items:center;gap:14px;margin:18px auto 0;max-width:654px;background:var(--bg-2,#151515);color:var(--testo,#eee);border:1px solid var(--oro,#c9a94a);border-radius:12px;padding:16px 20px;text-decoration:none">
        <svg viewBox="0 0 48 36" width="56" height="42" fill="none" stroke="#c9a94a" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="14" rx="1"/><rect x="26" y="2" width="20" height="14" rx="1"/><rect x="2" y="20" width="20" height="14" rx="1"/><rect x="26" y="20" width="20" height="14" rx="1"/></svg>
        <span style="flex:1"><span style="display:block;font-weight:700;font-size:18px;color:var(--oro-chiaro,#e8c25a)">${t('Cucine di esempio')}</span>
          <span style="display:block;font-size:14px;line-height:1.45;opacity:.85;margin-top:2px">${t('Idee già pronte da far vedere al cliente: ne scegli una, le dai il nome del cliente e la modifichi.')}</span></span>
        <span style="color:var(--oro,#c9a94a);font-weight:600;white-space:nowrap">${t('Guarda →')}</span>
      </a>
    </div>`;
  document.body.appendChild(ov);
  // CUCINE DI ESEMPIO: la scheda c'è solo se ce ne sono (l'elenco è piccolo: solo nomi e foto)
  fetch('esempi/cucine/indice.json?v=20261124n').then((r) => (r.ok ? r.json() : null)).then((j) => {
    const a = ov.querySelector('#scelta-esempi');
    if (a && j && Array.isArray(j.cucine) && j.cucine.length) a.style.display = 'flex';
  }).catch(() => { /* niente esempi */ });
}
mostraSceltaTipoCucina();
// intestazione: che cucina è + freccia indietro alla scelta
(() => {
  if (!MODO_CUCINA) return;
  const sub = document.querySelector('.app-header .sottotitolo');
  if (sub && MODO_CUCINA === 'ponte') sub.textContent = 'Progettazione cucina a ponte';
  const back = document.querySelector('.app-header .back-link');
  if (back) { back.href = './cucina.html'; back.title = 'Torna alla scelta della cucina'; }
})();
// CUCINA APERTA DAGLI ESEMPI (copia per un cliente o esempio da modificare): la freccia indietro
// torna alla galleria con tutte le cucine, non alla schermata principale
(() => {
  const back = document.querySelector('.app-header .back-link');
  if (!back) return;
  let daEsempi = false;
  try { daEsempi = /\/esempi\.html/.test(new URL(document.referrer).pathname); } catch (_) { /* nessuna pagina prima */ }
  if (!daEsempi && !(progetto && progetto.esempioInModifica)) return;
  back.href = './esempi.html'; back.title = 'Torna alle cucine di esempio';
})();

const pannello = document.getElementById('cucina-pannello');
// NOME SOTTO OGNI MATERIALE (come negli armadi): ogni quadratino delle
// palette prende sotto il suo nome, così si sa sempre cosa si sta usando.
function nomiSottoSwatch(root) {
  root.querySelectorAll('.palette-colori > .swatch').forEach((b) => {
    if (b.parentElement.classList.contains('swatch-voce')) return;
    const voce = document.createElement('div');
    voce.className = 'swatch-voce' + (b.classList.contains('sel') ? ' sel' : '');
    b.replaceWith(voce);
    voce.appendChild(b);
    const n = document.createElement('span');
    n.className = 'swatch-nome';
    n.textContent = String(b.getAttribute('title') || '').replace(/\s*\(\d+\s*mm\)\s*$/, '');
    voce.appendChild(n);
  });
}
new MutationObserver(() => nomiSottoSwatch(pannello)).observe(pannello, { childList: true, subtree: true });
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
  ponteH: 'auto', pontePens: 700, ponteSpazio: 550, parteColorePonte: 'ponte',   // cucina a ponte: ponte (auto = riempie fino in cima), pensili sotto, spazio sul piano
  pareteAttivaId: null,  // parete selezionata per inserire moduli
  tipoSelezionato: 'base-ante',
  larghezzaSelezionata: 600,
  fasciaLarghezza: 100,
  errore: null,
  mobSelId: null,        // mobile libero selezionato sulla pianta
  movePending: null,     // { id, prima:{x,y,rot,posManuale} } spostamento da confermare
  nudgeCm: 1,            // ultimo passo (cm) usato dalle frecce di spostamento
  multiSel: [],          // SELEZIONE MULTIPLA: id dei mobili selezionati insieme (Ctrl/Cmd + clic)
  multiModo: false,      // telefono: «Seleziona più mobili» (ogni tocco aggiunge o toglie)
};
let pareteSelId = null;  // muro toccato nello Step 1
// --- PIANTA A MANO LIBERA (Step 1) ---
let manoLibera = false;       // modalità attiva
let aggiuntaParete = false;   // "Aggiungi parete": si tira da un'estremità
let verticeSel = null;        // vertice toccato (per scrivere l'angolo)
let tracciaML = null;         // trascinamento in corso: { tipo:'vertice'|'nuova', ... }
let vbFisso = null;           // vista ferma mentre si trascina
let anteprimaML = null;       // parete nuova in anteprima
let tastiML = '';             // numeri scritti con la tastiera
let seguiML = null;           // parete appena aggiunta: { k } = vertice libero che segue il mouse
let trascinamento = null; // { id, dx, dy, mosso } mentre si sposta un mobile
const palette = document.getElementById('palette');
const modale = document.getElementById('modale');

// --------- STORIA (Annulla / Rifai) ---------
let storiaPast = [], storiaFuture = [];
let clipboardMobile = null;              // mobile copiato (Ctrl+C / Ctrl+V)
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

// Incolla il mobile dalla clipboard (sfalsato così non si sovrappone).
function incollaMobileClip() {
  if (!clipboardMobile) return;
  registraStoria();
  const ids = (progetto.mobiliLiberi || []).map((x) => x.id);
  const nuovo = JSON.parse(JSON.stringify(clipboardMobile));
  nuovo.id = (ids.length ? Math.max(...ids) : 0) + 1;
  nuovo.x = (nuovo.x || 0) + 200;
  nuovo.y = (nuovo.y || 0) - 200;
  nuovo.posManuale = true;
  progetto.mobiliLiberi = progetto.mobiliLiberi || [];
  progetto.mobiliLiberi.push(nuovo);
  step2.mobSelId = nuovo.id;
  aggiorna();
}

// --------- SCORCIATOIE DA TASTIERA ---------
// Ctrl+Z annulla · Ctrl+Y / Ctrl+Shift+Z rifai · Ctrl+C copia · Ctrl+V incolla
// · Ctrl+D duplica · Canc/Backspace elimina · R ruota · frecce sposta 1 cm · Esc deseleziona.
document.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
  if (!document.getElementById('modale')?.hidden) return;   // modale aperta: non intercettare

  const ctrl = e.ctrlKey || e.metaKey;
  const k = (e.key || '').toLowerCase();

  // Annulla / Rifai (ovunque)
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); annullaStoria(); return; }
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); rifaiStoria(); return; }

  // SELEZIONE MULTIPLA: Ctrl/Cmd + A seleziona tutto il passo; frecce, Canc, R ed Esc valgono per il gruppo
  const stMob = progetto.stepCorrente === 2 || progetto.stepCorrente === 3 || progetto.stepCorrente === P_ACC;
  if (ctrl && k === 'a' && stMob) {
    e.preventDefault();
    step2.multiSel = (progetto.mobiliLiberi || []).filter(spostabileQui).map((x) => x.id);
    step2.mobSelId = step2.multiSel[step2.multiSel.length - 1] ?? null;
    if (step2.multiSel.length < 2) step2.multiSel = [];
    step2.movePending = null; aggiorna(); return;
  }
  if (stMob && gruppoAttivo()) {
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); eliminaGruppo(); return; }
    if (k === 'r' && !ctrl) { e.preventDefault(); ruotaGruppo(); return; }
    if (k === 'escape') { svuotaMulti(); step2.mobSelId = null; step2.movePending = null; aggiorna(); return; }
    const d = { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
    if (d) { e.preventDefault(); nudgeGruppo(d[0] * 10, d[1] * 10); return; }   // 1 cm
  }
  const m = trovaMobileLibero(progetto, step2.mobSelId);

  if (ctrl && k === 'c') { if (m) clipboardMobile = JSON.parse(JSON.stringify(m)); e.preventDefault(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); incollaMobileClip(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); if (m) { clipboardMobile = JSON.parse(JSON.stringify(m)); incollaMobileClip(); } return; }

  if ((k === 'delete' || k === 'backspace') && m) {
    e.preventDefault(); registraStoria(); rimuoviMobileLibero(progetto, m.id); step2.mobSelId = null; aggiorna(); return;
  }
  if (k === 'r' && !ctrl && m) {
    e.preventDefault(); registraStoria(); ruotaMobileLibero(progetto, m.id); riblocca(m.id); aggiorna(); return;
  }
  if (k === 'escape') { if (step2.mobSelId != null) { step2.mobSelId = null; aggiorna(); } return; }
  if (m && (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright')) {
    e.preventDefault();
    const d = { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
    registraStoria();
    muoviMobileLibero(progetto, m.id, d[0] * 10, d[1] * 10);   // 1 cm
    m.posManuale = true;
    aggiorna();
  }
});

// --------- PANNELLO DIETRO IL PIANO (schienale / paraschizzi) ---------
function htmlSchienale(dentro = false) {
  const tutti = (scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer('pannello') : [];
  const sc = progetto.schienale || {};
  const att = !!sc.attivo, mat = sc.materiale || null;
  const def = mat ? tutti.find((x) => x.id === mat) : null;
  // dentro = nella sezione del piano di lavoro (titolo piccolo, niente sezione a parte)
  return `
    ${dentro ? '<div class="riga-3d" style="margin:16px 0 6px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--oro,#c9a961)">Pannello dietro il piano</div>' : `<section class="step3-pannello">
      <h3>Pannello dietro il piano</h3>`}
      <div class="riga-3d" style="margin-bottom:6px">Il pannello sul muro tra il piano di lavoro e i pensili (solo dove dietro c'è un muro).</div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn-ghost opt-sch ${!att ? 'attivo' : ''}" data-sch="no" style="flex:1">${!att ? '✓ ' : ''}No</button>
        <button type="button" class="btn-ghost opt-sch ${att ? 'attivo' : ''}" data-sch="si" style="flex:1">${att ? '✓ ' : ''}Sì</button>
      </div>
      ${att ? `
      <div class="riga-3d" style="margin:10px 0 6px">Altezza</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-alz ${altezzaAlzatina(progetto) ? '' : 'attivo'}" data-alz="">${altezzaAlzatina(progetto) ? '' : '✓ '}Fino ai pensili</button>
        <button type="button" class="btn-ghost opt-alz ${altezzaAlzatina(progetto) ? 'attivo' : ''}" data-alz="si">${altezzaAlzatina(progetto) ? '✓ ' : ''}Alzatina (bassa)</button>
      </div>
      ${altezzaAlzatina(progetto) ? `<label class="riga-3d" style="display:block;margin-top:8px">Altezza dell'alzatina (mm)
        <input type="number" id="alz-num" class="modale-num" min="20" max="600" step="5" value="${altezzaAlzatina(progetto)}" inputmode="numeric" style="width:100%;margin-top:4px" /></label>` : ''}
      <div class="riga-3d" style="margin:10px 0 6px">Materiale: <strong>${def ? def.nome : 'uguale al piano di lavoro'}</strong></div>
      ${htmlTendineColori(tutti, (mt) => `<button type="button" class="swatch ${mt.id === mat ? 'sel' : ''}"
          data-sch-mat="${mt.id}" title="${mt.nome}" style="background-image:url('${mt.thumb}')"></button>`, {
        sel: mat, chiave: 'cucina-aplacado',
        prima: `<button type="button" class="swatch swatch-none ${!mat ? 'sel' : ''}" data-sch-mat="" title="Uguale al piano di lavoro">=</button>` })}` : ''}
    ${dentro ? '' : '</section>'}`;
}
/** Profondità del piano di lavoro (questa cucina): dal muro, come i mobili; sui lati a filo. */
function htmlSporgenzePiano() {
  const sp = sporgenzaPiano(progetto);
  return `
      <div class="riga-3d" style="margin:14px 0 6px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--oro,#c9a961)">Profondità del piano</div>
      <label class="riga-3d" style="display:block">Profondità dal muro (mm)
        <input type="number" class="modale-num" id="piano-prof" min="500" max="1200" step="5" value="${sp.profondita}" inputmode="numeric" style="width:100%;margin-top:4px" /></label>
      <div class="riga-3d" style="margin-top:4px;opacity:.8">Il piano si appoggia al muro come i mobili: con ${sp.profondita} mm esce ${sp.davanti} mm davanti alle ante (mobili da 600). Sui lati finisce a filo; dove c'è un costado, a filo del costado.</div>`;
}
function agganciaSchienale(root) {
  // profondità del piano (dal muro)
  root.querySelector('#piano-prof')?.addEventListener('change', (e) => {
    const v = Math.max(500, Math.min(1200, Math.round(Number(String(e.target.value).replace(',', '.')))));
    if (!Number.isFinite(v)) return;
    registraStoria();
    progetto.pianoLavoro = { profondita: v };
    aggiorna();
  });
  // pannello dietro: fino ai pensili o alzatina bassa
  root.querySelectorAll('.opt-alz').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    const h = b.dataset.alz ? (altezzaAlzatina(progetto) || parametri().cucina.altezzaAlzatina || 100) : null;
    progetto.schienale = { ...(progetto.schienale || {}), attivo: true, altezza: h };
    aggiorna();
  }));
  root.querySelector('#alz-num')?.addEventListener('change', (e) => {
    const v = Math.max(20, Math.min(600, Math.round(Number(String(e.target.value).replace(',', '.')))));
    if (!Number.isFinite(v)) return;
    registraStoria();
    progetto.schienale = { ...(progetto.schienale || {}), attivo: true, altezza: v };
    aggiorna();
  });
  root.querySelectorAll('.opt-sch').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.schienale = { ...(progetto.schienale || {}), attivo: b.dataset.sch === 'si' };
    aggiorna();
  }));
  root.querySelectorAll('.swatch[data-sch-mat]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.schienale = { ...(progetto.schienale || {}), attivo: true, materiale: b.dataset.schMat || null };
    aggiorna();
  }));
}

// --------- DISPATCH principale: sceglie lo step attivo ---------
// Step 1 Pianta · 2 Moduli bassi · 3 Moduli alti · 4 Rendering 3D
function renderPannelloPasso() {
  if (progetto.stepCorrente === P_3D) return renderPannelloStep3d();
  if (progetto.stepCorrente === P_ACC) return renderPannelloAccessori();
  if (progetto.stepCorrente === 2 || progetto.stepCorrente === 3) return renderPannelloModuli();
  return renderPannelloStep1();
}
// PANNELLO ORDINATO: ogni sezione è una tendina (chiusa, si apre toccando il titolo).
// Aperte la prima volta solo quelle che servono di più a ogni passo; poi resta come la lasci.
// All'apertura del sito sono TUTTE CHIUSE; si apre da sola solo la parte di ciò che tocchi
// (il mobile o l'oggetto selezionato, con il suo colore) e ciò che va sistemato.
const TENDINE_APERTE = {
  1: [],
  2: ['Mobile selezionato', 'Mobili selezionati', 'Da sistemare'],
  3: ['Mobile selezionato', 'Mobili selezionati', 'Da sistemare'],
  4: ['Oggetto selezionato', 'Oggetti selezionati'],
  5: ['Da sistemare', 'Modulo selezionato', 'Mobile a giorno', 'Oggetto selezionato', 'Colore ante', 'Colore ·'],
};
/** SFONDO del 3D: tre pallini in alto a destra sopra la vista (chiaro, neutro, scuro). */
function renderPalliniSfondo() {
  const box = document.getElementById('sfondo-pallini');
  if (!box) return;
  const lista = (scena3dMod && scena3dMod.SFONDI_LISTA) || [];
  box.hidden = progetto.stepCorrente !== P_3D || !lista.length;
  if (box.hidden) return;
  const sel = progetto.sfondo || 'chiaro';
  box.innerHTML = lista.map((x) => `<button type="button" class="pallino-sfondo ${x.id === sel ? 'sel' : ''}" data-sfondo-p="${x.id}" title="${escHtml(x.nome)}" aria-label="${escHtml(x.nome)}" style="background:${x.css}"></button>`).join('');
  box.querySelectorAll('[data-sfondo-p]').forEach((b) => b.addEventListener('click', () => {
    if ((progetto.sfondo || 'chiaro') === b.dataset.sfondoP) return;
    progetto.sfondo = b.dataset.sfondoP; aggiorna();
  }));
}
function renderPannello() {
  renderPannelloPasso();
  renderPalliniSfondo();
  tendinePannello(pannello, `cucina-${progetto.stepCorrente}`, { aperte: TENDINE_APERTE[progetto.stepCorrente] || [] });
}
function renderRiepilogo() {
  if (progetto.stepCorrente === P_3D) return renderRiepilogoStep3d();
  if (progetto.stepCorrente === P_ACC) return renderRiepilogoAccessori();
  if (progetto.stepCorrente === 2 || progetto.stepCorrente === 3) return renderRiepilogoModuli();
  return renderRiepilogoStep1();
}
const NOMI_STEP = {
  1: 'Pianta: perimetro',
  2: 'Moduli bassi',
  3: 'Moduli alti',
  4: 'Accessori',
  5: 'Rendering 3D',
};
// Livello di mobili attivo nello step corrente ('basso' = a terra, 'alto' = pensili)
function livelloStep() { return progetto.stepCorrente === 3 ? 'alto' : 'basso'; }
function livelloMobile(cat) { return (cat === 'pensile' || cat === 'altillo') ? 'alto' : 'basso'; }
function step2Disponibile() {
  return progetto.pianoConfermato && progetto.piano.pareti.some((p) => !p.assente);
}
function step4Disponibile() {
  return step2Disponibile() && (progetto.mobiliLiberi || []).length > 0;
}
// Stepper in alto: evidenzia lo step attivo, abilita quelli raggiungibili
function renderStepper() {
  if ((progetto.stepCorrente === 2 || progetto.stepCorrente === 3) && !step2Disponibile()) progetto.stepCorrente = 1;
  if ((progetto.stepCorrente === P_ACC || progetto.stepCorrente === P_3D) && !step4Disponibile()) progetto.stepCorrente = step2Disponibile() ? 2 : 1;
  document.querySelectorAll('#stepper .step').forEach((btn) => {
    const n = Number(btn.dataset.step);
    const abilitato = n === 1 || ((n === 2 || n === 3) && step2Disponibile()) || ((n === P_ACC || n === P_3D) && step4Disponibile());
    btn.disabled = !abilitato;
    btn.classList.toggle('disabilitato', !abilitato);
    btn.classList.toggle('attivo', n === progetto.stepCorrente);
    if (n === progetto.stepCorrente) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  });
  stepInfo.textContent =
    `Passo ${progetto.stepCorrente} di 5 — ${NOMI_STEP[progetto.stepCorrente]}`;
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
    ${cucinaPonte() ? `
    <section>
      <h3>Carica progetto</h3>
      <div class="riga-3d" style="margin-bottom:8px">Parti da una cucina già fatta: pareti, mobili, colori e misure restano tutti, poi aggiungi il <strong>ponte</strong> nei Moduli alti.</div>
      <button type="button" id="ponte-carica-salvato" class="btn-oro" style="width:100%">📂 Carica un progetto salvato</button>
      <button type="button" id="ponte-carica-normale" class="btn-ghost" style="width:100%;margin-top:6px">⇢ Prendi la cucina normale aperta ora</button>
    </section>` : ''}

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
      <h3>Mano libera</h3>
      <button type="button" id="ml-toggle" class="btn-ghost ${manoLibera ? 'attivo' : ''}" style="width:100%">${manoLibera ? '✓ ' : ''}✏ Disegna a mano libera</button>
      ${manoLibera ? `
      <div class="riga-3d" style="margin:8px 0">
        <strong>Sposta un vertice</strong>: prendilo e trascinalo (la squadra a 90° tiene). Vicino a ogni vertice c'è l'angolo interno.<br>
        <strong>Scrivi l'angolo</strong>: tocca un vertice, scrivi i gradi (es. 95, 120, 180) e premi Invio.<br>
        <strong>Nuova parete</strong>: tocca il vertice di un'estremità, premi "Aggiungi parete" e muovi il mouse: vedi l'angolo interno e la misura; clicca per fissarla, oppure scrivi la misura in mm e premi Invio.
      </div>
      <button type="button" id="ml-aggiungi" class="btn-oro" style="width:100%">+ Aggiungi parete${progetto.piano.pareti.length ? (verticeSel === 0 ? ' (dal vertice iniziale)' : ' (dal vertice selezionato)') : ''}</button>
      ${verticeSel != null && angoloInternoVertice(progetto.piano.pareti, verticeSel) != null ? `
      <div class="riga-3d" style="margin:10px 0 4px">Angolo interno al vertice selezionato (°):</div>
      <div style="display:flex;gap:8px">
        <input type="number" id="ml-angolo" class="modale-num" value="${angoloInternoVertice(progetto.piano.pareti, verticeSel)}" min="1" max="359" step="1" style="flex:1" />
        <button type="button" id="ml-angolo-ok" class="btn-oro">Applica</button>
      </div>` : ''}` : ''}
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
              ${latoInternoAutomatico(progetto) ? `
              <div class="riga-3d">✓ Automatico: i mobili vanno sempre verso l'interno della forma</div>` : `
              <button type="button" class="lato-btn ${p.latoInterno === 'interno' ? 'interno' : ''}"
                data-id="${p.id}">
                ${p.latoInterno === 'interno' ? '← Interno' : 'Esterno →'}
              </button>`}
            </div>
          </div>
        `).join('')}
      </div>
      <button id="btn-aggiungi-parete" class="btn-oro" type="button" style="margin-top:10px;width:100%">
        + Aggiungi parete
      </button>
    </section>

    ${htmlTetto()}

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
  agganciaTetto(pannello);
  document.getElementById('ml-toggle')?.addEventListener('click', () => {
    manoLibera = !manoLibera; aggiuntaParete = false; verticeSel = null; tastiML = ''; aggiorna();
  });
  document.getElementById('ml-aggiungi')?.addEventListener('click', aggiungiPareteML);
  const appAng = () => {
    const v = Number(String(document.getElementById('ml-angolo').value).replace(',', '.'));
    if (!(v > 0 && v < 360) || verticeSel == null) return;
    registraStoria(); impostaAngoloVertice(progetto, verticeSel, v); aggiorna();
  };
  document.getElementById('ml-angolo-ok')?.addEventListener('click', appAng);
  document.getElementById('ml-angolo')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') appAng(); });
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
  document.getElementById('ponte-carica-salvato')?.addEventListener('click', () => window.NGPreventivi?.elenco('', { soloCucine: true }));
  document.getElementById('ponte-carica-normale')?.addEventListener('click', () => window.NGPreventivi?.prendiCucinaNormale());
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

    ${gruppoAttivo() ? blocMultiSel() : blocMobileSelezionato()}

    ${spaziGaps.length ? `
    <section>
      <h3>Spazi tra i mobili</h3>
      <div class="riga-3d">${spaziGaps.length} spazio/i vuoto/i tra i mobili (${
        spaziGaps.map((g) => `${(g.gap / 10).toFixed(g.gap % 10 ? 1 : 0)} cm`).join(', ')
      }). Riempili con una regletta dello spessore esatto.</div>
      <button id="riempi-reglette" class="btn-oro" type="button" style="margin-top:8px;width:100%">↔ Riempi spazi con reglette</button>
    </section>` : ''}

    ${livello === 'alto' && cucinaPonte() ? `
    <section>
      <h3>Ponte</h3>
      <div class="riga-3d">Sopra ogni base fra le colonne: il <strong>ponte</strong> (profondo 60, a filo con le colonne) e sotto i <strong>pensili</strong> (profondi 33). Stessa larghezza delle basi, tutto allineato.</div>
      <div class="riga-3d" style="margin:10px 0 4px">Spazio tra il piano di lavoro e i pensili (cm) · minimo 50</div>
      <div class="orienta-row">
        ${[500, 550, 600, 650].map((h) => `<button class="btn-ghost ponte-s ${step2.ponteSpazio === h ? 'attivo' : ''}" type="button" data-s="${h}">${step2.ponteSpazio === h ? '✓ ' : ''}${h / 10}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin:10px 0 4px">Pensili sotto il ponte (cm)</div>
      <div class="orienta-row">
        ${[0, 600, 700, 720].map((h) => `<button class="btn-ghost ponte-p ${step2.pontePens === h ? 'attivo' : ''}" type="button" data-p="${h}">${step2.pontePens === h ? '✓ ' : ''}${h ? h / 10 : 'Nessuno'}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin:10px 0 4px">Altezza del ponte (cm)</div>
      <div class="orienta-row">
        <button class="btn-ghost ponte-h ${step2.ponteH === 'auto' ? 'attivo' : ''}" type="button" data-h="auto">${step2.ponteH === 'auto' ? '✓ ' : ''}Automatica</button>
        ${[240, 360, 480, 600].map((h) => `<button class="btn-ghost ponte-h ${step2.ponteH === h ? 'attivo' : ''}" type="button" data-h="${h}">${step2.ponteH === h ? '✓ ' : ''}${h / 10}</button>`).join('')}
      </div>
      <div class="riga-3d" id="ponte-calcolo" style="margin-top:8px"></div>
      <button id="ponte-crea" class="btn-oro" type="button" style="width:100%;margin-top:10px">🌉 Crea il ponte</button>
      <div class="riga-3d" id="ponte-spazio" style="margin-top:8px"></div>
      <div class="riga-3d" style="margin:12px 0 6px"><strong>Pannello sotto il ponte</strong>: copre il fondo dei moduli profondi, per tutta la fila, sopra i pensili piccoli. Va nella lista dei pezzi.</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-pponte ${(progetto.pannelloPonte || {}).attivo !== false ? 'attivo' : ''}" data-pponte="si">${(progetto.pannelloPonte || {}).attivo !== false ? '✓ ' : ''}Sì</button>
        <button type="button" class="btn-ghost opt-pponte ${(progetto.pannelloPonte || {}).attivo === false ? 'attivo' : ''}" data-pponte="no">${(progetto.pannelloPonte || {}).attivo === false ? '✓ ' : ''}No</button>
      </div>
      ${(progetto.pannelloPonte || {}).attivo !== false ? `
      <div class="ra-campi" style="margin-top:8px">
        <label>Spessore pannello (mm)<input id="pponte-sp" type="number" value="${spessorePannelloPonte(progetto)}" min="5" step="1" inputmode="numeric"></label>
      </div>
      <div class="opzioni-anta" style="margin-top:6px">
        <button type="button" class="btn-ghost ${Number((progetto.pannelloPonte || {}).spessore) > 0 ? '' : 'attivo'}" id="pponte-sp-auto">${Number((progetto.pannelloPonte || {}).spessore) > 0 ? '' : '✓ '}Come le ante (${spessoreAntePonte(progetto)} mm)</button>
      </div>
      <div class="riga-3d" style="margin-top:6px">${(() => {
        const pz = pannelliSottoPonte(progetto);
        if (!pz.length) return 'Profondità come la colonna o il costado ai lati. Massimo 275 cm per pezzo: se la fila è più lunga si divide a metà (fra due moduli o a metà di un modulo, fra le ante).';
        const rif = { colonna: 'come le colonne', costado: 'come i costadi', pannello: 'come il pannello' }[pz[0].riferimento] || 'come il ponte';
        return pz.filter((x) => x.pezzo === 1).map((f) => {
          const pezzi = pz.filter((x) => x.ids === f.ids);
          return `Fila da <strong>${f.lunghezzaFila / 10} cm</strong> · profondità <strong>${f.d / 10} cm</strong> (${rif})`
            + (pezzi.length > 1 ? ` · divisa in <strong>${pezzi.length} pezzi</strong>: ${pezzi.map((x) => `${(x.w / 10).toLocaleString('it-IT')}`).join(' + ')} cm` : '');
        }).join('<br>');
      })()}</div>` : ''}
    </section>` : ''}

    ${livello === 'alto' ? htmlColoriPonte() : ''}
    ${livello === 'alto' && cucinaPonte() ? htmlPortePonte() : ''}

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
      <h3>Regletta d'angolo</h3>
      <div class="riga-3d" style="margin-bottom:8px">Negli angoli ciechi crea in automatico una regletta <strong>3×3 cm</strong> (modificabile spostando gli armadi). Disattivala se in un angolo non la vuoi.</div>
      <button id="auto-regletta" class="btn-ghost ${progetto.autoRegletta !== false ? 'attivo' : ''}" type="button" style="width:100%">
        ${progetto.autoRegletta !== false ? '✓ Auto regletta: ATTIVA' : 'Auto regletta: DISATTIVATA'}
      </button>
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
  // Barra di conferma spostamento (compare dopo aver trascinato/mosso un mobile)
  document.getElementById('sposta-ok')?.addEventListener('click', confermaSpostamento);
  document.getElementById('sposta-annulla')?.addEventListener('click', annullaSpostamento);
  // Auto regletta d'angolo on/off
  document.getElementById('auto-regletta')?.addEventListener('click', () => {
    registraStoria();
    progetto.autoRegletta = (progetto.autoRegletta === false);  // toggle (undefined→true→false)
    aggiorna();
  });
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
    if (n) sistemaSpaziPensili(progetto);             // sopra e sotto allineati (pensili allargati, da tagliare)
    step2.mobSelId = null;
    aggiorna();
    if (n === 0) alert('Aggiungi prima i mobili bassi: i pensili vengono creati sopra le basi.');
  };
  document.getElementById('auto-70')?.addEventListener('click', () => autoPensili(700));
  agganciaColoriPonte(pannello);
  agganciaPortePonte(pannello);
  pannello.querySelectorAll('.opt-pponte').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.pannelloPonte = { ...(progetto.pannelloPonte || {}), attivo: b.dataset.pponte === 'si' };
    aggiorna();
  }));
  document.getElementById('pponte-sp-auto')?.addEventListener('click', () => {
    if (!(Number((progetto.pannelloPonte || {}).spessore) > 0)) return;
    registraStoria();
    const pp = { ...(progetto.pannelloPonte || {}), attivo: true }; delete pp.spessore;
    progetto.pannelloPonte = pp;
    aggiorna();
  });
  document.getElementById('pponte-sp')?.addEventListener('change', (e) => {
    const v = Math.round(Number(e.target.value));
    if (!(v >= 5)) return;
    registraStoria();
    progetto.pannelloPonte = { ...(progetto.pannelloPonte || {}), attivo: true, spessore: v };
    aggiorna();
  });
  pannello.querySelectorAll('.ponte-h').forEach((b) => b.addEventListener('click', () => { step2.ponteH = b.dataset.h === 'auto' ? 'auto' : Number(b.dataset.h); renderPannello(); }));
  pannello.querySelectorAll('.ponte-s').forEach((b) => b.addEventListener('click', () => { step2.ponteSpazio = Number(b.dataset.s); renderPannello(); }));
  // CALCOLO DEL PONTE: cima delle colonne − pannello − piano − spazio − pensili
  const elCalc = document.getElementById('ponte-calcolo');
  let calcolo = null;
  if (elCalc) caricaScena3d().then((mod) => {
    if (!mod || !mod.calcoloPonte || !elCalc.isConnected) return;
    calcolo = mod.calcoloPonte(progetto, step2.ponteSpazio, step2.pontePens);
    const c = calcolo, cm = (v) => (v / 10).toLocaleString('it-IT', { maximumFractionDigits: 1 });
    const hP = step2.ponteH === 'auto' ? c.hPonte : step2.ponteH;
    const spazioVero = c.cima - c.pannello - hP - step2.pontePens - c.piano;
    elCalc.innerHTML = `Cima colonne <strong>${cm(c.cima)}</strong> · piano di lavoro <strong>${cm(c.piano)}</strong> · pensili <strong>${cm(step2.pontePens)}</strong> · pannello <strong>${cm(c.pannello)}</strong><br>`
      + (hP < 150 ? `⚠ Il ponte verrebbe solo <strong>${cm(hP)} cm</strong>: scegli pensili più bassi o meno spazio sul piano.`
        : step2.ponteH === 'auto' ? `→ Ponte da <strong>${cm(hP)} cm</strong> (su misura), spazio sul piano <strong>${cm(spazioVero)} cm</strong>.`
          : `→ Con il ponte da ${cm(hP)} lo spazio sul piano è <strong>${cm(spazioVero)} cm</strong>${spazioVero < 500 ? ' ⚠ meno di 50' : ''}.`);
  }).catch(() => {});
  pannello.querySelectorAll('.ponte-p').forEach((b) => b.addEventListener('click', () => { step2.pontePens = Number(b.dataset.p); renderPannello(); }));
  // spazio tra il piano di lavoro e i pensili sotto il ponte (calcolato dal 3D)
  const elSp = document.getElementById('ponte-spazio');
  if (elSp) caricaScena3d().then((mod) => {
    const v = mod && mod.spazioSottoPonte ? mod.spazioSottoPonte(progetto) : null;
    if (v == null || !elSp.isConnected) return;
    elSp.innerHTML = v < 450
      ? `⚠ Tra il piano di lavoro e i pensili restano solo <strong>${Math.round(v / 10)} cm</strong> (di solito 50–60): scegli pensili più bassi o un ponte più basso.`
      : `Tra il piano di lavoro e i pensili restano <strong>${Math.round(v / 10)} cm</strong>.`;
  }).catch(() => {});
  document.getElementById('ponte-crea')?.addEventListener('click', () => {
    registraStoria();
    const hP = step2.ponteH === 'auto' ? (calcolo ? calcolo.hPonte : null) : step2.ponteH;
    if (hP == null) return;
    if (hP < 150) { alert((window.NGI18N ? window.NGI18N.t : (x) => x)('Il ponte verrebbe troppo basso: scegli pensili più bassi o meno spazio sul piano.')); return; }
    const n = generaPonteAuto(progetto, hP, step2.pontePens);
    step2.mobSelId = null;
    aggiorna();
    if (n === 0) alert((window.NGI18N ? window.NGI18N.t : (x) => x)('Metti prima le basi e, ai due lati, le colonne (o i costadi alti): il ponte va sopra le basi che stanno fra loro.'));
  });
  document.getElementById('auto-90')?.addEventListener('click', () => autoPensili(900));
  document.getElementById('riempi-reglette')?.addEventListener('click', () => {
    registraStoria();
    const n = riempiSpaziReglette(progetto);
    step2.mobSelId = null;
    aggiorna();
    if (n === 0) alert('Nessuno spazio da riempire.');
  });

  if (gruppoAttivo()) agganciaMultiSel();
  const mobSel = gruppoAttivo() ? null : trovaMobileLibero(progetto, step2.mobSelId);
  if (mobSel) {
    agganciaModoMulti();
    agganciaBaseAngolo(pannello, mobSel);
    agganciaDistanzaFrigo(pannello, mobSel);
    agganciaColoreFrigo(pannello, mobSel);
    agganciaAperturaColonna(pannello, mobSel);
    agganciaPensileSottoPonte(pannello, mobSel);
    // piano cottura / lavello anche sulla cassettiera (non solo sulla base con ante)
    document.getElementById('mob-placca')?.addEventListener('click', () => {
      registraStoria(); mobSel.placca = !mobSel.placca; if (mobSel.placca) mobSel.lavello = false; aggiorna();
    });
    document.getElementById('mob-lavello')?.addEventListener('click', () => {
      registraStoria(); mobSel.lavello = !mobSel.lavello; if (mobSel.lavello) mobSel.placca = false; aggiorna();
    });
    document.getElementById('mob-ruota').addEventListener('click', () => {
      registraStoria();
      ruotaMobileLibero(progetto, mobSel.id);
      riblocca(mobSel.id);
      fatto();
    });
    document.getElementById('mob-isola')?.addEventListener('click', () => {
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
      step2.nudgeCm = cm || step2.nudgeCm;          // ricorda il passo scelto
      const mm = Math.round(cm * 10);
      if (!mm) return;
      registraStoria();
      avviaSpostamento(mobSel);                     // fotografa partenza + blocca auto-layout
      muoviMobileLibero(progetto, mobSel.id, dx * mm, dy * mm);
      aggiorna();                                   // mostra la barra Conferma/Annulla
    };
    // y della pianta è verso l'alto → "su" = +y, "giù" = -y
    document.getElementById('nudge-su').addEventListener('click', () => nudge(0, 1));
    document.getElementById('nudge-giu').addEventListener('click', () => nudge(0, -1));
    document.getElementById('nudge-sx').addEventListener('click', () => nudge(-1, 0));
    document.getElementById('nudge-dx').addEventListener('click', () => nudge(1, 0));
    const raBase = document.getElementById('ra-base');
    const raSpess = document.getElementById('ra-spess');
    const aggiornaRa = () => {
      if (!progetto.reglettaAngolo) progetto.reglettaAngolo = { base: parametri().regletta.vista, spessore: parametri().regletta.spessoreAnta };
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
      progetto.stepCorrente = P_ACC;
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
        <strong class="${liberoCm === 0 ? 'ok' : ''}">${liberoCm === 0 ? '✓ pieno' : `${liberoCm} liberi`}${info && info.regletta ? ` <small style="opacity:.75">(+${(info.regletta / 10).toLocaleString('it-IT')} regletta)</small>` : ''}</strong></div>`;
    }).join('')}

    ${htmlSpaziPensili()}
    <section data-tendina="moduli" style="margin-top:20px">
    <h3>Moduli</h3>
    ${Object.keys(conteggio).length === 0
      ? '<div class="riep-riga"><span>Nessun modulo</span><strong>—</strong></div>'
      : Object.entries(conteggio).map(([k, n]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${n}</strong></div>`).join('')}
    <div class="riep-riga"><span>Fasce (totale)</span><strong>${progetto.fasce.length} · ${totFasce} mm</strong></div>
    <div class="riep-riga"><span>Mobili liberi sulla pianta</span><strong>${progetto.mobiliLiberi.length}</strong></div>
    <div class="riep-riga"><span>Metri lineari moduli</span><strong>${(lineari / 1000).toFixed(2)} m</strong></div>
    <div class="riep-riga"><span>Stato</span><strong>${progetto.moduliBaseConfermati ? 'Confermato' : 'In modifica'}</strong></div>
    </section>
  `;
  agganciaSpaziPensili(riepilogo);
  tendinePannello(riepilogo, 'cucina-riepilogo', { aperte: [] });
}
/**
 * SPAZI FRA I PENSILI: dove sotto il mobile basso è più largo (es. 63) e il pensile sopra è da 60,
 * resta un buco. Si allarga il pensile (modulo da 70 da tagliare a 63): sopra e sotto allineati.
 */
function htmlSpaziPensili() {
  const sp = spaziPensili(progetto);
  if (!sp.length) return '';
  return `
    <h3 style="margin-top:20px">⚠ Spazi fra i pensili</h3>
    <div class="riga-3d" style="margin-bottom:6px">Sotto, il mobile basso continua (o c'è una regletta): i pensili non hanno reglette, quindi allarga il pensile così sopra e sotto sono allineati. Se la misura non è standard, in distinta c'è il modulo da ordinare e a quanto tagliarlo.</div>
    ${sp.map((x) => { const m = trovaMobileLibero(progetto, x.id), od = moduloDaOrdinare({ ...m, larghezza_mm: x.w });
      return `<div class="riep-riga avviso-taglio"><span>Pensile da ${m.larghezza_mm} → ${x.w} mm (spazio di ${x.gap} mm${x.regletta ? ' sopra la regletta' : x.angolo ? " nell'angolo" : ''})${od ? ` · modulo da ${od.ordina} da tagliare a ${od.taglio}` : ''}</span>
      <button type="button" class="btn-ghost" data-allarga="${x.id}|${x.lato}|${x.gap}" style="padding:4px 10px">Allarga</button></div>`; }).join('')}
    ${sp.length > 1 ? '<button type="button" id="allarga-tutti" class="btn-oro" style="width:100%;margin-top:8px">Allarga tutti</button>' : ''}`;
}
function agganciaSpaziPensili(root) {
  root.querySelectorAll('[data-allarga]').forEach((b) => b.addEventListener('click', () => {
    const [id, lato, gap] = b.dataset.allarga.split('|').map(Number);
    registraStoria(); allargaPensile(progetto, id, lato, gap); aggiorna();
  }));
  root.querySelector('#allarga-tutti')?.addEventListener('click', () => { registraStoria(); sistemaSpaziPensili(progetto); aggiorna(); });
}

// --------- STEP 3 — VISTA 3D ---------
const canvas3d = document.getElementById('cucina-3d');
const legenda3d = document.querySelector('.vista-strumenti .legenda');
let scena3dMod = null;      // modulo importato dinamicamente
let scena3dMontata = false;

// Click nel 3D: seleziona il mobile toccato (per vederlo/modificarlo)
// (girando la vista col mouse, al rilascio arriva un «click»: se il puntatore si è mosso non è
// un tocco per scegliere, e il pannello non deve cambiare)
let _giuXY = null;
canvas3d.addEventListener('pointerdown', (e) => { _giuXY = [e.clientX, e.clientY]; }, true);
canvas3d.addEventListener('click', (e) => {
  if (ignoraClick) return;
  if (_giuXY && Math.hypot(e.clientX - _giuXY[0], e.clientY - _giuXY[1]) > 6) return;
  if (progetto.stepCorrente !== P_3D || !scena3dMod || !scena3dMod.pickMobile) return;
  const id = scena3dMod.pickMobile(e.clientX, e.clientY);
  const parte = scena3dMod.parteToccata ? scena3dMod.parteToccata() : null;
  if (id === step2.mobSelId && parte === (step2.parteSel && step2.parteSel.parte)) return;
  step2.mobSelId = id; step2.parteSel = id != null && parte ? { id, parte } : null;
  renderPannello();
  renderRiepilogo();
  scena3dMod.aggiornaScena3d(progetto, false, id); // evidenzia il modulo toccato
});

// Spostare gli OGGETTI (sgabelli, arredo) trascinandoli nel rendering.
// I moduli restano fissi.
// OGNI DITO PER CONTO SUO (telefono): lo spostamento segue SOLO il dito che ha preso l'oggetto.
// Prima un secondo dito (es. per lo zoom) finiva anche lui allo spostamento e la vista non vedeva
// mai il suo «dito alzato»: restava con un dito «fantasma» premuto, la vista si bloccava, un dito
// solo faceva zoom invece di girare. Ora:
//  - dita date alla vista (girare, zoom): la vista le segue dall'inizio alla fine; mentre la vista
//    ha già un dito giù, un altro dito non prende oggetti (è uno zoom a due dita);
//  - mentre si sposta un oggetto, un secondo dito si ignora del tutto (né oggetto né vista).
let spostamentoAttivo = false, ignoraClick = false, ditoOggetto = null;
const ditiVista = new Set(), ditiIgnorati = new Set();
const fermaEvento = (e) => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };
canvas3d.addEventListener('pointerdown', (e) => {
  if (spostamentoAttivo) { ditiIgnorati.add(e.pointerId); fermaEvento(e); return; }
  if (ditiVista.size || progetto.stepCorrente !== P_3D || !scena3dMod || !scena3dMod.iniziaSpostamento || e.button > 0) { ditiVista.add(e.pointerId); return; }
  const ok = scena3dMod.iniziaSpostamento(e.clientX, e.clientY, (id) => {
    const m = trovaMobileLibero(progetto, id);
    return !!m && categoriaTipo(m.tipo) === 'oggetto';
  });
  if (!ok) { ditiVista.add(e.pointerId); return; }
  spostamentoAttivo = true; ditoOggetto = e.pointerId;
  fermaEvento(e);
  try { canvas3d.setPointerCapture(e.pointerId); } catch { /* niente */ }
}, true);
canvas3d.addEventListener('pointermove', (e) => {
  if (ditiIgnorati.has(e.pointerId)) { fermaEvento(e); return; }
  if (!spostamentoAttivo || e.pointerId !== ditoOggetto) return;
  e.stopImmediatePropagation();
  scena3dMod.muoviSpostamento(e.clientX, e.clientY);
}, true);
const fineSpost = (e) => {
  if (e && ditiIgnorati.delete(e.pointerId)) { fermaEvento(e); return; }
  if (e) ditiVista.delete(e.pointerId);
  if (!spostamentoAttivo || (e && e.pointerId !== ditoOggetto)) return;
  spostamentoAttivo = false; ditoOggetto = null;
  if (e) e.stopImmediatePropagation();
  try { if (e) canvas3d.releasePointerCapture(e.pointerId); } catch { /* niente */ }
  const r = scena3dMod.fineSpostamento();
  const m = r && trovaMobileLibero(progetto, r.id);
  if (!m || !r.mosso) return;
  ignoraClick = true; setTimeout(() => { ignoraClick = false; }, 300);
  registraStoria();
  m.x = r.x; m.y = r.y; m.posManuale = true;
  if (String(m.tipo).startsWith('ogg:')) {
    // sul ripiano di un mobile aperto: se ne ricorda l'altezza (sennò va sul piano / ripiano più alto)
    if (r.quota != null) m.quota_mm = r.quota; else delete m.quota_mm;
    // mai dentro il muro (puntando in fondo al piano col dito un po' più avanti)
    const v = vincolaAiMuri(progetto, m, m.x, m.y); m.x = Math.round(v.x); m.y = Math.round(v.y);
  }
  mettiNelVano(progetto, m);                  // lasciato nel vano di una colonna: dentro, dritto e centrato
  step2.mobSelId = m.id;
  aggiorna();
};
canvas3d.addEventListener('pointerup', fineSpost, true);
canvas3d.addEventListener('pointercancel', fineSpost, true);
// dito alzato fuori dalla vista o pagina lasciata a metà gesto: niente dita rimaste «giù»
window.addEventListener('pointerup', (e) => { ditiVista.delete(e.pointerId); ditiIgnorati.delete(e.pointerId); });
window.addEventListener('pointercancel', (e) => { ditiVista.delete(e.pointerId); ditiIgnorati.delete(e.pointerId); });
window.addEventListener('blur', () => { ditiVista.clear(); ditiIgnorati.clear(); if (spostamentoAttivo) fineSpost(null); });

// BASE ANGOLO: lati e profondità modificabili (misure del fornitore)
function htmlBaseAngolo(m) {
  if (m.tipo !== 'base-angolo') return '';
  const lA = m.larghezza_mm || 880, lB = m.latoB_mm || lA, P = m.profBraccio_mm || 600;
  const { a, b } = anteBaseAngolo(m), H = m.altezza_mm || 700;
  return `
    <section class="step3-pannello">
      <h3>Base angolo · misure</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <label class="riga-3d">Lato A (mm)<input type="number" class="modale-num ba-mis" data-campo="larghezza_mm" value="${lA}" min="300" step="10" style="width:100%"></label>
        <label class="riga-3d">Lato B (mm)<input type="number" class="modale-num ba-mis" data-campo="latoB_mm" value="${lB}" min="300" step="10" style="width:100%"></label>
        <label class="riga-3d">Profondità (mm)<input type="number" class="modale-num ba-mis" data-campo="profBraccio_mm" value="${P}" min="200" step="10" style="width:100%"></label>
      </div>
      <div class="riga-3d" style="margin-top:6px">Ante: <strong>${a} × ${H - 2}</strong> e <strong>${b} × ${H - 2}</strong> mm (lato − profondità).</div>
      <button type="button" class="btn-ghost btn-mini" id="ba-come-sopra" style="margin-top:6px;width:100%">↺ Come il pensile angolo (ante uguali, lati 88)</button>
      ${Math.min(a, b) < 150 ? `<div class="avviso-pannello">⚠ Ante molto strette (${Math.min(a, b)} mm): controlla lati e profondità del tuo fornitore.</div>` : ''}
    </section>`;
}
function agganciaBaseAngolo(root, m) {
  root.querySelector('#ba-come-sopra')?.addEventListener('click', () => {
    registraStoria();
    m.larghezza_mm = 880; delete m.latoB_mm; delete m.profBraccio_mm;
    aggiorna();
  });
  root.querySelectorAll('.ba-mis').forEach((inp) => inp.addEventListener('change', () => {
    const v = Math.round(Number(String(inp.value).replace(',', '.')));
    if (!(v > 0)) return;
    registraStoria();
    m[inp.dataset.campo] = v;
    aggiorna();
  }));
}

// Lavello e rubinetto: acciaio o nero
function htmlFiniture(solo = null) {
  const f = progetto.finiture || {};
  const riga = (chiave, titolo) => `
      <div class="riga-3d" style="margin:8px 0 6px">${titolo}</div>
      <div style="display:flex;gap:8px">
        ${[['acciaio', 'Acciaio'], ['nero', 'Nero']].map(([v, et]) => {
          const on = (f[chiave] || 'acciaio') === v;
          return `<button type="button" class="btn-ghost opt-fin ${on ? 'attivo' : ''}" data-fin="${chiave}" data-val="${v}" style="flex:1">${on ? '✓ ' : ''}${et}</button>`;
        }).join('')}
      </div>`;
  const forno = f.forno || 'inox';
  const finRub = (scena3dMod && scena3dMod.FINITURE_RUBINETTO) || [];
  const modRub = (scena3dMod && scena3dMod.MODELLI_RUBINETTO) || [];
  const rubSel = f.rubinetto === 'acciaio' || !f.rubinetto ? 'cromo' : f.rubinetto;
  const modSel = f.rubinettoModello || 'cigno';
  const rubColore = `
      <div class="riga-3d" style="margin:10px 0 6px">Rubinetto · colore</div>
      <div class="palette-zoccolo">
        ${finRub.map((x) => `<button type="button" class="swatch-zocc opt-fin ${rubSel === x.id ? 'sel' : ''}" data-fin="rubinetto" data-val="${x.id}" title="${x.nome}" style="background:${x.css}"></button>
          <span class="et-zocc">${x.nome}</span>`).join('')}
      </div>`;
  const forn = `
    <section class="step3-pannello"${solo ? ' data-aperta' : ''}>
      <h3>Forno e microonde</h3>
      <div style="display:flex;gap:8px">
        ${[['inox', 'Inox'], ['nero', 'Nero'], ['bianco', 'Bianco']].map(([v, et]) =>
          `<button type="button" class="btn-ghost opt-fin ${forno === v ? 'attivo' : ''}" data-fin="forno" data-val="${v}" style="flex:1">${forno === v ? '✓ ' : ''}${et}</button>`).join('')}
      </div>
    </section>`;
  if (solo === 'forno') return forn;
  // toccato il RUBINETTO: per primo il suo colore, poi il modello, poi il lavello
  if (solo === 'rubinetto') return `
    <section class="step3-pannello" data-aperta>
      <h3>Rubinetto e lavello</h3>
      ${rubColore}
      <div class="riga-3d" style="margin:10px 0 6px">Rubinetto · modello</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${modRub.map((x) => `<button type="button" class="btn-ghost opt-fin ${modSel === x.id ? 'attivo' : ''}" data-fin="rubinettoModello" data-val="${x.id}" style="flex:1;min-width:110px">${modSel === x.id ? '✓ ' : ''}${x.nome}</button>`).join('')}
      </div>
      ${riga('lavello', 'Lavello')}
    </section>`;
  return `
    <section class="step3-pannello"${solo ? ' data-aperta' : ''}>
      <h3>Lavello e rubinetto</h3>
      ${riga('lavello', 'Lavello')}
      <div class="riga-3d" style="margin:10px 0 6px">Rubinetto · modello</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${modRub.map((x) => `<button type="button" class="btn-ghost opt-fin ${modSel === x.id ? 'attivo' : ''}" data-fin="rubinettoModello" data-val="${x.id}" style="flex:1;min-width:110px">${modSel === x.id ? '✓ ' : ''}${x.nome}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin:10px 0 6px">Rubinetto · colore</div>
      <div class="palette-zoccolo">
        ${finRub.map((x) => `<button type="button" class="swatch-zocc opt-fin ${rubSel === x.id ? 'sel' : ''}" data-fin="rubinetto" data-val="${x.id}" title="${x.nome}" style="background:${x.css}"></button>
          <span class="et-zocc">${x.nome}</span>`).join('')}
      </div>
    </section>
    <section class="step3-pannello">
      <h3>Forno e microonde</h3>
      <div style="display:flex;gap:8px">
        ${[['inox', 'Inox'], ['nero', 'Nero'], ['bianco', 'Bianco']].map(([v, et]) =>
          `<button type="button" class="btn-ghost opt-fin ${forno === v ? 'attivo' : ''}" data-fin="forno" data-val="${v}" style="flex:1">${forno === v ? '✓ ' : ''}${et}</button>`).join('')}
      </div>
    </section>
    ${htmlLavastoviglieTutte()}`;
}
/** LAVASTOVIGLIE: il colore di tutte quelle della cucina insieme (acciaio, nera, bianca, integrata). */
function htmlLavastoviglieTutte() {
  const lav = (progetto.mobiliLiberi || []).filter((x) => x.tipo === 'lavastoviglie');
  if (!lav.length) return '';
  const c0 = lav[0].colore || 'acciaio', sel = lav.every((x) => (x.colore || 'acciaio') === c0) ? c0 : null;
  return `
    <section class="step3-pannello">
      <h3>Lavastoviglie</h3>
      <div class="opzioni-anta">
        ${COLORI_LAVAST.map((c) => `<button type="button" class="btn-ghost opt-lavtutte ${c.id === sel ? 'attivo' : ''}" data-lavtutte="${c.id}" style="display:flex;align-items:center;gap:8px;justify-content:center">
          <span style="width:18px;height:18px;border-radius:3px;border:1px solid #777;background:${c.css}"></span>${c.id === sel ? '✓ ' : ''}${c.nome}</button>`).join('')}
      </div>
      ${lav.length > 1 ? '<div class="riga-3d" style="margin-top:6px">Vale per tutte le lavastoviglie della cucina (una sola: toccala nel 3D).</div>' : ''}
    </section>`;
}
function agganciaFiniture(root) {
  root.querySelectorAll('.opt-fin').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.finiture = { ...(progetto.finiture || {}), [b.dataset.fin]: b.dataset.val };
    aggiorna();
  }));
  root.querySelectorAll('.opt-lavtutte[data-lavtutte]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    for (const x of progetto.mobiliLiberi || []) if (x.tipo === 'lavastoviglie') x.colore = b.dataset.lavtutte;
    aggiorna();
  }));
}

/**
 * Dove mettere un oggetto appena aggiunto nel 3D: gli elettrodomestici sul piano
 * di un mobile basso libero (centro del mobile, girati come lui), gli sgabelli
 * davanti al primo mobile basso; se non ci sono mobili, al centro della stanza.
 */
/** Come si posa un oggetto della cucina: 'piano', 'terra', 'appeso' (lampade), 'parete' (quadri). */
function posaDi(tipo) {
  if (!String(tipo).startsWith('ogg:')) return 'terra';          // sgabello del catalogo mobili
  const def = matMod && matMod.MATERIALI.find((x) => x.id === String(tipo).slice(4));
  return matMod && matMod.posaOggetto ? matMod.posaOggetto(def) : 'piano';
}
function postoPerOggetto(m) {
  if (posaDi(m.tipo) === 'appeso') return postoPerLampada(m);
  const basi = (progetto.mobiliLiberi || []).filter((b) => ['base'].includes(categoriaTipo(b.tipo)) && b.tipo !== 'base-angolo' && !b.lavello && b.tipo !== 'lavello');
  const posa = posaDi(m.tipo);
  // occupato solo da oggetti che si posano allo stesso modo (una lampada sopra un vaso va bene)
  const oggetti = (progetto.mobiliLiberi || []).filter((o) => o.id !== m.id && categoriaTipo(o.tipo) === 'oggetto' && posaDi(o.tipo) === posa);
  const dm0 = dimMobile(m), passo = Math.max(250, Math.max(dm0.w || 0, dm0.d || 0) * 0.9);
  const occupato = (x, y) => oggetti.some((o) => Math.hypot(o.x - x, o.y - y) < passo);
  const pensili = (progetto.mobiliLiberi || []).filter((p) => categoriaTipo(p.tipo) === 'pensile');
  const conPensile = (x, y) => pensili.some((p) => Math.hypot(p.x - x, p.y - y) < Math.max(dimMobile(p).w, 300) / 2 + 150);
  for (const b of basi) {
    const r = ((b.rot || 0) * Math.PI) / 180, fx = -Math.sin(r), fy = -Math.cos(r);
    const d = dimMobile(b).d;
    // piano / lampada: sopra il mobile; a terra: davanti (un tavolo più lontano);
    // quadro: al muro dietro il mobile, dove non ci sono pensili
    // (i taglieri «al muro»: sul piano, in fondo contro il muro)
    const alMuro = String(m.tipo).startsWith('ogg:') && matMod && (matMod.MATERIALI.find((x) => x.id === m.tipo.slice(4)) || {}).alMuro;
    const dist = posa === 'terra' ? d / 2 + (m.tipo.startsWith('ogg:') && dm0.d > 700 ? 900 + dm0.d / 2 : 350)
      : posa === 'parete' ? -(d / 2 - (dm0.d || 40) / 2) : alMuro ? -(d / 2 - (dm0.d || 100) / 2 - 15) : 0;
    // posti lungo il mobile: al centro, poi a destra e a sinistra, distanziati della misura dell'oggetto
    const w = dimMobile(b).w || 600, ds = Math.max(250, (dm0.w || 300) + 80);
    for (const s of [0, 1, -1, 2, -2, 3, -3].map((k) => k * ds).filter((s) => Math.abs(s) <= w / 2 + 100)) {
      const x = b.x + fx * dist + fy * s, y = b.y + fy * dist - fx * s;
      if (posa === 'parete' && conPensile(b.x + fy * s, b.y - fx * s)) continue;
      // sedie e sgabelli davanti al mobile lo GUARDANO (girati di 180°)
      if (!occupato(x, y)) return { x: Math.round(x), y: Math.round(y), rot: posa === 'terra' ? ((b.rot || 0) + 180) % 360 : b.rot || 0 };
    }
  }
  return {};
}

/**
 * LAMPADE (e cappe a isola): sopra l'ISOLA, se c'è (lungo l'isola, una accanto all'altra), se no al
 * CENTRO DELLA STANZA. Mai sopra i pensili: lì si sovrapponevano ai mobili alti ed era difficile prenderle.
 */
function postoPerLampada(m) {
  const mob = progetto.mobiliLiberi || [];
  const dm0 = dimMobile(m), ds = Math.max(450, (dm0.w || 300) + 150);
  const altri = mob.filter((o) => o.id !== m.id && categoriaTipo(o.tipo) === 'oggetto' && posaDi(o.tipo) === 'appeso');
  const pensili = mob.filter((p) => ['pensile', 'colonna', 'altillo'].includes(categoriaTipo(p.tipo)));
  const libero = (x, y) => !altri.some((o) => Math.hypot(o.x - x, o.y - y) < ds * 0.8)
    && !pensili.some((p) => { const d = dimMobile(p); return Math.abs(p.x - x) < Math.max(d.w, d.d) / 2 + 150 && Math.abs(p.y - y) < Math.max(d.w, d.d) / 2 + 150; });
  // l'isola: i mobili a terra lontani dai muri
  const isola = mob.filter((b) => ['base', 'lavastoviglie', 'lavatrice', 'tavolo'].includes(categoriaTipo(b.tipo)) && (categoriaTipo(b.tipo) === 'tavolo' || modoIsola(progetto, b, b.x, b.y)));
  let cx, cy, lungoX = true;
  if (isola.length) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const b of isola) {
      const d = dimMobile(b), r = ((Math.round((b.rot || 0) / 90) * 90) % 180 + 180) % 180;
      const hx = (r === 0 ? d.w : d.d) / 2, hy = (r === 0 ? d.d : d.w) / 2;
      x0 = Math.min(x0, b.x - hx); x1 = Math.max(x1, b.x + hx); y0 = Math.min(y0, b.y - hy); y1 = Math.max(y1, b.y + hy);
    }
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; lungoX = x1 - x0 >= y1 - y0;
  } else {
    // centro della stanza; con un muro solo il «centro» sarebbe sul muro: 1,5 m dentro la stanza
    const c = centroPianta(progetto); cx = c.x; cy = c.y;
    const pareti = (progetto.piano.pareti || []).filter((p) => !p.assente), V = calcolaVertici(progetto.piano.pareti || []);
    if (pareti.length === 1 && V.length >= 2) {
      const a = V[0], b = V[1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, sgn = pareti[0].latoInterno === 'interno' ? 1 : -1;
      cx += (-(b.y - a.y) / L) * sgn * 1500; cy += ((b.x - a.x) / L) * sgn * 1500;
      lungoX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    }
  }
  // le lampade lunghe girate come l'isola (lungo il suo lato lungo)
  const rot = (dm0.w || 0) > (dm0.d || 0) * 1.5 && !lungoX ? 90 : 0;
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const x = cx + (lungoX ? k * ds : 0), y = cy + (lungoX ? 0 : k * ds);
    if (libero(x, y)) return { x: Math.round(x), y: Math.round(y), rot };
  }
  return { x: Math.round(cx), y: Math.round(cy), rot };
}

// --------- LUCE ESTERNA: dal pieno giorno (100%) alla notte (0%: solo lampade accese e LED) ---------
function luceEsternaPct() {
  const v = Number(progetto.luceEsterna);
  return Math.round(100 * (progetto.luceEsterna != null && Number.isFinite(v) ? v : progetto.atmosfera === 'sera' ? 0.3 : 1));
}
function testoLuceEsterna(pct) {
  return pct >= 95 ? 'giorno pieno' : pct >= 55 ? 'giorno' : pct >= 20 ? 'sera' : pct > 0 ? 'quasi notte' : 'notte: solo la luce delle lampade e dei LED';
}
/** COLORE DELLA LUCE in Kelvin (2700 calda → 6500 fredda): barra come la luce esterna + tre scelte rapide. */
const kelvinLedP = () => Number((progetto.led || {}).kelvin) || ({ caldo: 3000, medio: 4000, freddo: 6500 })[(progetto.led || {}).colore] || 3000;
const testoKelvin = (k) => (k <= 3300 ? 'calda' : k <= 4500 ? 'neutra' : 'fredda');
function htmlColoreLuce(chiave, k, titolo) {
  const pre = chiave === 'lamp'
    ? [[3000, 'Calda (3000 K)'], [3700, 'Come sempre (3700 K)'], [4000, 'Neutra (4000 K)'], [6500, 'Fredda (6500 K)'], ['led', 'Come i LED']]
    : [[3000, 'Calda (3000 K)'], [4000, 'Neutra (4000 K)'], [6500, 'Fredda (6500 K)']];
  return `
      <div class="riga-3d" style="margin:10px 0 4px">${titolo}: <strong id="k-${chiave}-val">${k} K</strong> · <span id="k-${chiave}-testo">${testoKelvin(k)}</span></div>
      <div aria-hidden="true" style="height:6px;border-radius:3px;margin:2px 0 2px;background:linear-gradient(90deg,#ffc58d,#ffdcb8,#fff6ec,#f4f6ff,#dfe9ff)"></div>
      <input type="range" id="k-${chiave}" min="2700" max="6500" step="100" value="${k}" style="width:100%;accent-color:#c9a961" aria-label="${titolo}" />
      <div class="opzioni-anta" style="margin-top:6px">
        ${pre.map(([v, t]) => `<button type="button" class="btn-ghost opt-k ${v === k ? 'attivo' : ''}" data-k-${chiave}="${v}">${v === k ? '✓ ' : ''}${t}</button>`).join('')}
      </div>`;
}
function agganciaColoreLuce(root) {
  const T = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  const salva = { led: (k) => { progetto.led = { ...(progetto.led || {}), attivo: true, kelvin: k }; }, lamp: (k) => { progetto.lampadeK = k; } };
  for (const chiave of ['led', 'lamp']) {
    const r = root.querySelector(`#k-${chiave}`);
    const mostra = (k) => {
      const a = root.querySelector(`#k-${chiave}-val`), b = root.querySelector(`#k-${chiave}-testo`);
      if (a) a.textContent = `${k} K`; if (b) b.textContent = T(testoKelvin(k));
    };
    if (r) {
      // mentre si trascina: il colore cambia subito nel 3D; al rilascio si salva
      r.addEventListener('input', () => { const k = Number(r.value); mostra(k); scena3dMod?.impostaColoreLuci?.(chiave === 'led' ? { led: k } : { lampade: k }); });
      r.addEventListener('change', () => { registraStoria(); salva[chiave](Number(r.value)); aggiorna(); });
    }
    root.querySelectorAll(`[data-k-${chiave}]`).forEach((b) => b.addEventListener('click', () => {
      const v = b.getAttribute(`data-k-${chiave}`), k = v === 'led' ? kelvinLedP() : Number(v);
      registraStoria(); salva[chiave](k); aggiorna();
    }));
  }
}
function htmlLuceEsterna() {
  const pct = luceEsternaPct();
  return `
      <div class="riga-3d" style="margin:10px 0 4px">Luce esterna: <strong id="luce-est-val">${pct}%</strong> · <span id="luce-est-testo">${testoLuceEsterna(pct)}</span></div>
      <input type="range" id="luce-est" min="0" max="100" step="5" value="${pct}" style="width:100%;accent-color:#c9a961" aria-label="Luce esterna" />
      <div class="opzioni-anta" style="margin-top:6px">
        ${[[100, '☀ Giorno'], [35, '🌆 Sera'], [0, '🌙 Notte']].map(([v, t]) => `<button type="button" class="btn-ghost ${pct === v ? 'attivo' : ''}" data-luce-est="${v}">${pct === v ? '✓ ' : ''}${t}</button>`).join('')}
      </div>`;
}
function agganciaLuceEsterna(root) {
  const r = root.querySelector('#luce-est');
  const T = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  const mostra = (pct) => {
    const a = root.querySelector('#luce-est-val'), b = root.querySelector('#luce-est-testo');
    if (a) a.textContent = `${pct}%`; if (b) b.textContent = T(testoLuceEsterna(pct));
  };
  const salva = (pct) => { registraStoria(); progetto.luceEsterna = pct / 100; delete progetto.atmosfera; aggiorna(); };
  if (r) {
    // mentre si trascina: la luce cambia subito (senza rifare la scena); al rilascio si salva
    r.addEventListener('input', () => { const pct = Number(r.value); mostra(pct); scena3dMod?.impostaLuceEsterna?.(pct / 100); });
    r.addEventListener('change', () => salva(Number(r.value)));
  }
  root.querySelectorAll('[data-luce-est]').forEach((b) => b.addEventListener('click', () => salva(Number(b.dataset.luceEst))));
}

// --------- PAVIMENTO: legni, marmi e pietre, gres (foto vere alla misura vera, lastre con le fughe) ---------
function htmlPavimento() {
  const L = PAVIMENTI, G = GRUPPI_PAVIMENTI;
  const sel = progetto.pavimento || '', voce = L.find((p) => p.id === sel);
  return `
    <section class="step3-pannello">
      <h3>Pavimento</h3>
      <div class="riga-3d" style="margin-bottom:6px">${voce ? `<strong data-no-i18n>${escHtml(voce.nome)}</strong>` : 'Automatico: parquet con lo sfondo chiaro, gres con gli altri.'}</div>
      <button type="button" class="btn-oro" id="pav-aggiungi" style="width:100%;margin:4px 0 6px">📷 Aggiungi il pavimento del cliente (foto)</button>
      ${G.map((g) => `
      <div class="riga-3d" style="margin:8px 0 4px;opacity:.75">${g}</div>
      <div class="palette-colori">
        ${L.filter((p) => p.gruppo === g).map((p) => `<div class="swatch-voce ${p.id === sel ? 'sel' : ''}">
          <button type="button" class="swatch ${p.id === sel ? 'sel' : ''}" data-pav="${p.id}" title="${escHtml(p.nome)}" style="background-image:url('${p.thumb || `materials/pavimenti/miniature/${p.id}.jpg`}')"></button>
          <span class="swatch-nome" ${p.proprio ? 'data-no-i18n' : ''}>${escHtml(p.nome.split(' · ')[0])}</span></div>`).join('')}
      </div>`).join('')}
      ${voce && voce.proprio ? `<div class="riga-3d" style="margin-top:6px">La foto copre <strong>${Math.round(voce.mm / 10)} × ${Math.round(voce.mmY / 10)} cm</strong>.</div>
      <button type="button" class="btn-ghost btn-mini" id="pav-elimina" style="margin-top:6px;width:100%">🗑 Elimina questo pavimento</button>` : ''}
      ${sel ? '<button type="button" class="btn-ghost btn-mini" data-pav="" style="margin-top:8px;width:100%">↺ Pavimento automatico</button>' : ''}
    </section>`;
}
/**
 * PAVIMENTO DEL CLIENTE: una foto fatta dall'alto (o mandata dal cliente) + la misura della zona
 * fotografata. Nel 3D si ripete alla misura vera con i colori della foto. Resta nel catalogo (tutti i
 * progetti, anche sul telefono con «Copia completa»).
 */
function apriPavimentoDaFoto() {
  const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  document.getElementById('pav-modale')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pav-modale'; ov.className = 'modale-fondo';
  ov.innerHTML = `
    <div class="modale" role="dialog" aria-modal="true" style="max-width:440px">
      <h3>Pavimento del cliente</h3>
      <div class="riga-3d" style="margin-bottom:8px">Fai la foto <strong>da sopra, dritta</strong>, con una luce uniforme e senza ombre (o usa la foto che ti manda il cliente). Meglio se si vedono una o più piastrelle intere, tagliate sulle fughe: si ripete senza giunte.</div>
      <label class="btn-ghost" style="display:block;text-align:center;cursor:pointer;padding:10px">📷 Scegli o scatta la foto
        <input type="file" id="pav-file" accept="image/*" style="display:none"></label>
      <div id="pav-anteprima" style="margin:8px 0;display:none;height:180px;border-radius:8px;background:#222 center/contain no-repeat"></div>
      <div class="ra-campi" style="margin-top:6px">
        <label style="min-width:0">Larghezza della zona fotografata (cm)<input id="pav-w" type="number" min="5" step="0.5" value="60" inputmode="decimal" style="width:100%;box-sizing:border-box"></label>
        <label style="min-width:0">Altezza (cm)<input id="pav-h" type="number" min="5" step="0.5" value="60" inputmode="decimal" style="width:100%;box-sizing:border-box"></label>
      </div>
      <div class="riga-3d" style="margin-top:4px">Esempio: una piastrella 60×60 fotografata intera → 60 e 60. L'altezza si calcola da sola dalla foto (la puoi cambiare).</div>
      <label style="display:block;margin-top:8px">Nome<input id="pav-nome" type="text" value="${escHtml(tt('Pavimento del cliente'))}" style="width:100%;box-sizing:border-box"></label>
      <div class="orienta-row" style="margin-top:12px">
        <button type="button" class="btn-ghost" id="pav-annulla" style="flex:1">Annulla</button>
        <button type="button" class="btn-oro" id="pav-salva" style="flex:1" disabled>✓ Salva e usa</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  if (window.NGI18N && window.NGI18N.traduci) try { window.NGI18N.traduci(ov); } catch (_) { /* niente */ }
  let foto = null, rapporto = 1, hToccata = false;
  const $ = (id) => ov.querySelector('#' + id);
  const aggiornaH = () => { if (!hToccata) $('pav-h').value = Math.round((Number($('pav-w').value) || 60) * rapporto * 10) / 10; };
  $('pav-annulla').onclick = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  $('pav-w').addEventListener('input', aggiornaH);
  $('pav-h').addEventListener('input', () => { hToccata = true; });
  $('pav-file').addEventListener('change', async () => {
    const f = $('pav-file').files && $('pav-file').files[0];
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      // foto grande al massimo 2048 px (leggera ma nitida), miniatura 160 px
      const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const kt = 160 / Math.max(c.width, c.height), t = document.createElement('canvas');
      t.width = Math.max(1, Math.round(c.width * kt)); t.height = Math.max(1, Math.round(c.height * kt));
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
      const thumb = await new Promise((ok) => t.toBlob(ok, 'image/jpeg', 0.85));
      foto = { blob, thumb }; rapporto = c.height / c.width;
      const prev = $('pav-anteprima'); prev.style.display = 'block'; prev.style.backgroundImage = `url('${URL.createObjectURL(blob)}')`;
      aggiornaH(); $('pav-salva').disabled = false;
    } catch (e) { console.error(e); alert(tt('Non riesco a leggere questa foto.')); }
  });
  $('pav-salva').onclick = async () => {
    if (!foto) return;
    const w = Number(String($('pav-w').value).replace(',', '.')), h = Number(String($('pav-h').value).replace(',', '.'));
    if (!(w >= 5) || !(h >= 5)) { alert(tt('Scrivi la misura della zona fotografata (almeno 5 cm).')); return; }
    $('pav-salva').disabled = true;
    try {
      const C = await import('../catalogo.js?v=20261124n');
      const M = await import('../materiali.js?v=20261124n');
      const stato = await C.leggiCatalogo();
      const id = 'pav-' + Date.now().toString(36);
      const prod = { id, sezione: 'pavimento', nome: ($('pav-nome').value || '').trim() || tt('Pavimento del cliente'), campioneCm: { w, h } };
      await C.salvaFoto(id, foto.blob, 'foto'); await C.salvaFoto(id, foto.thumb, 'thumb');
      stato.prodotti = [...(stato.prodotti || []), prod];
      await C.salvaCatalogo(stato);
      aggiungiPavimentoProprio(M.defPavimentoProprio(prod, URL.createObjectURL(foto.blob), URL.createObjectURL(foto.thumb)));
      ov.remove();
      registraStoria(); progetto.pavimento = id; aggiorna();
    } catch (e) { console.error(e); alert(tt('Non sono riuscito a salvare il pavimento.')); $('pav-salva').disabled = false; }
  };
}
async function eliminaPavimentoProprio(id) {
  const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  if (!confirm(tt('Eliminare questo pavimento? Sparisce da tutti i progetti.'))) return;
  try {
    const C = await import('../catalogo.js?v=20261124n');
    const stato = await C.leggiCatalogo();
    stato.prodotti = (stato.prodotti || []).filter((p) => p.id !== id);
    await C.salvaCatalogo(stato); await C.eliminaFoto(id);
  } catch (e) { console.error(e); }
  rimuoviPavimentoProprio(id);
  registraStoria(); if (progetto.pavimento === id) progetto.pavimento = null; aggiorna();
}

// --------- TETTO: sì / no e altezza dei muri (alla Pianta e nel Rendering, è la stessa scelta) ---------
// Senza tetto la cucina si vede aperta; col tetto le lampade e la cappa sopra l'isola sono appese
// al soffitto vero. L'altezza dei muri serve in ogni caso (muri del 3D, cavi delle lampade).
function htmlTetto(cls = '') {
  const si = !!progetto.tetto, hS = Math.round((Number(progetto.altezzaSoffitto) || 2700) / 10);
  return `
    <section class="${cls}">
      <h3>Tetto</h3>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-tetto ${!si ? 'attivo' : ''}" data-tetto="no">${!si ? '✓ ' : ''}Tetto no</button>
        <button type="button" class="btn-ghost opt-tetto ${si ? 'attivo' : ''}" data-tetto="si">${si ? '✓ ' : ''}Tetto sì</button>
      </div>
      <div class="riga-3d" style="margin:8px 0 4px">${si ? 'Altezza dei muri (cm): il soffitto è lì e le lampade ci sono appese. Da dentro il soffitto è pieno, dall\'alto è trasparente e la cucina si vede.' : 'Altezza dei muri (cm): i muri del 3D arrivano fin lì e le lampade sono appese a quell\'altezza.'}</div>
      <input type="text" inputmode="decimal" autocomplete="off" id="soffitto-h" class="modale-num" value="${hS}" style="width:100%" />
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${[240, 250, 260, 270, 280, 300].map((v) => `<button type="button" class="btn-ghost opt-soffitto ${hS === v ? 'attivo' : ''}" data-soffitto="${v}" style="flex:1;min-width:58px">${v}</button>`).join('')}
      </div>
      ${si ? htmlMisureSoffitto() : ''}
    </section>`;
}
// Misure del SOFFITTO (con «Tetto sì»): profondità dal muro verso la stanza e larghezza lungo il
// muro, in cm. Vuoto = automatico (arriva ai muri; dove non c'è muro 2 m davanti ai mobili, isola
// compresa, e 1,2 m ai lati): il numero automatico si vede scritto nel campo vuoto.
function htmlMisureSoffitto() {
  const r = rettangoloSoffitto(progetto);
  const cm = (mm) => Math.round(mm / 10);
  const P = Number(progetto.soffittoProfondita) > 0, L = Number(progetto.soffittoLarghezza) > 0;
  const campo = (id, etichetta, su, auto) => `
        <label style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span class="riga-3d" style="margin:0">${etichetta}</span>
          <input type="text" inputmode="decimal" autocomplete="off" id="${id}" class="modale-num" value="${su ? cm(su) : ''}" placeholder="${cm(auto)}" style="width:100%" />
        </label>`;
  return `
      <div class="riga-3d" style="margin:12px 0 4px"><strong>Misure del soffitto (cm)</strong> — profondità dal muro verso la stanza, larghezza lungo il muro.</div>
      <div style="display:flex;gap:8px">
        ${campo('soffitto-prof', 'Profondità', P ? progetto.soffittoProfondita : 0, r.autoProfondita)}
        ${campo('soffitto-lar', 'Larghezza', L ? progetto.soffittoLarghezza : 0, r.autoLarghezza)}
      </div>
      <div class="riga-3d" style="margin:4px 0 0;opacity:.8">Vuoto = automatico: arriva ai muri e, dove non c'è muro, 2 m davanti ai mobili (isola compresa) e 1,2 m ai lati.</div>
      ${P || L ? '<button type="button" class="btn-ghost" id="soffitto-auto" style="width:100%;margin-top:6px">↺ Misure automatiche</button>' : ''}`;
}
function agganciaTetto(root) {
  const mettiSoffitto = (cm) => {
    const v = Math.round(Number(String(cm).replace(',', '.')));
    if (!Number.isFinite(v) || v < 220 || v > 450) { renderPannello(); return; }
    registraStoria(); progetto.altezzaSoffitto = v * 10; aggiorna();
  };
  root.querySelector('#soffitto-h')?.addEventListener('change', (e) => mettiSoffitto(e.target.value));
  // misure del soffitto: vuoto = automatico; da 50 cm a 50 m
  const mettiMisura = (chiave, v) => {
    const t = String(v).trim().replace(',', '.');
    const n = t === '' ? null : Math.round(Number(t));
    if (n !== null && (!Number.isFinite(n) || n < 50 || n > 5000)) { renderPannello(); return; }
    registraStoria(); progetto[chiave] = n === null ? null : n * 10; aggiorna();
  };
  root.querySelector('#soffitto-prof')?.addEventListener('change', (e) => mettiMisura('soffittoProfondita', e.target.value));
  root.querySelector('#soffitto-lar')?.addEventListener('change', (e) => mettiMisura('soffittoLarghezza', e.target.value));
  root.querySelector('#soffitto-auto')?.addEventListener('click', () => {
    registraStoria(); progetto.soffittoProfondita = null; progetto.soffittoLarghezza = null; aggiorna();
  });
  root.querySelectorAll('[data-soffitto]').forEach((b) => b.addEventListener('click', () => mettiSoffitto(b.dataset.soffitto)));
  root.querySelectorAll('[data-tetto]').forEach((b) => b.addEventListener('click', () => {
    registraStoria(); progetto.tetto = b.dataset.tetto === 'si'; aggiorna();
  }));
}

// --------- ACCESSORI: catalogo a TENDINE per categoria (passo Accessori e rendering) ---------
const ICONE_GRUPPI = { luci: '💡', sgabelli: '🪑', pranzo: '🍽', piante: '🪴', cucina: '🍋', decor: '🏺', cappe: '💨', miei: '📷' };
/** Le categorie del catalogo con i loro oggetti (libreria 3D, collezione, quelli fatti dalle foto). */
function gruppiAccessori() {
  if (!matMod) return [];
  const tutti = matMod.materialiPer('oggetti');
  const gruppoDi = (o) => (matMod.gruppoOggetto ? matMod.gruppoOggetto(o) : 'miei');
  return (matMod.GRUPPI_OGGETTI || []).map((g) => ({ ...g, voci: tutti.filter((o) => gruppoDi(o) === g.id),
    pronti: g.id === 'sgabelli' ? CATALOGO_MOBILI.filter((x) => x.categoria === 'oggetto') : [] }));
}
/** Elenco delle categorie: tutte chiuse; se ne tocchi una si apre (e le altre si chiudono). */
function htmlCatalogoAccessori() {
  const gr = gruppiAccessori();
  if (!gr.length) return '<div class="riga-3d">Caricamento del catalogo…</div>';
  const T = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
  return `<div class="acc-catalogo">${gr.map((g) => {
    const aperta = step2.accGruppo === g.id, n = g.voci.length + g.pronti.length;
    // crediti dei modelli 3D della categoria aperta: Amazon (uno per tutti) e ogni autore di Sketchfab
    const crediti = !aperta ? [] : [...new Set(g.voci.filter((o) => o.libreria).map((o) => (o.info && o.info.note) || matMod.CREDITI_LIBRERIA))];
    return `
    <button type="button" class="acc-cat ${aperta ? 'aperta' : ''}" data-accgruppo="${g.id}" aria-expanded="${aperta}">
      <span class="acc-ico" aria-hidden="true">${ICONE_GRUPPI[g.id] || '•'}</span><span class="acc-nome">${g.nome}</span>
      <small class="acc-n">${n}</small><span class="acc-freccia" aria-hidden="true">${aperta ? '▾' : '▸'}</span>
    </button>
    ${aperta ? `<div class="acc-voci">
      ${n ? `<div class="griglia-ogg">
        ${g.voci.map((o) => `<button type="button" class="ogg-voce" data-aggogg="${o.id}" title="${escHtml(o.proprio ? o.nome : T(o.nome))}">
          <span class="palette-ogg-img" style="background-image:url('${o.thumb}')"></span><span data-no-i18n>${escHtml(o.proprio ? o.nome : T(o.nome))}</span></button>`).join('')}
        ${g.pronti.map((x) => `<button type="button" class="ogg-voce" data-aggtipo="${x.id}">${iconaMobile(x.id)}<span>${x.nome}</span></button>`).join('')}
      </div>` : ''}
      ${g.id === 'miei' && !n ? '<div class="riga-3d">I tuoi oggetti (friggitrici, tostapane…) si creano dalle foto in ⚙ Impostazioni → Oggetti ed elettrodomestici.</div>' : ''}
      ${crediti.length ? `<div class="crediti-ogg"><span data-no-i18n>${crediti.map(escHtml).join('<br>')}</span><br><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></div>` : ''}
    </div>` : ''}`;
  }).join('')}</div>`;
}
function agganciaCatalogoAccessori(root) {
  root.querySelectorAll('[data-accgruppo]').forEach((b) => b.addEventListener('click', () => {
    step2.accGruppo = step2.accGruppo === b.dataset.accgruppo ? null : b.dataset.accgruppo;
    renderPannello();
    root.querySelector(`[data-accgruppo="${step2.accGruppo}"]`)?.scrollIntoView({ block: 'nearest' });
  }));
  root.querySelectorAll('[data-aggogg], [data-aggtipo]').forEach((b) => b.addEventListener('click', () => {
    let id;
    if (b.dataset.aggogg) {
      const o = matMod && matMod.materialiPer('oggetti').find((x) => x.id === b.dataset.aggogg); if (!o) return;
      registraStoria();
      id = aggiungiMobileLibero(progetto, `ogg:${o.id}`, { larghezza_mm: o.misure.w, profondita_mm: o.misure.d, altezza_mm: o.misure.h });
    } else { registraStoria(); id = aggiungiMobileLibero(progetto, b.dataset.aggtipo, {}); }
    const m = trovaMobileLibero(progetto, id);
    if (m) Object.assign(m, postoPerOggetto(m));
    aggiorna();
    avvisoBreve(`${(window.NGI18N ? window.NGI18N.t('Aggiunto') : 'Aggiunto')}: ${b.title || b.textContent.trim()}`, true);
  }));
}
/** PASSO 4 — ACCESSORI: catalogo a tendine; nella pianta si vedono e si spostano solo gli oggetti. */
function renderPannelloAccessori() {
  if (gruppoAttivo()) {
    pannello.innerHTML = blocMultiSel();
    document.getElementById('sposta-ok')?.addEventListener('click', confermaSpostamento);
    document.getElementById('sposta-annulla')?.addEventListener('click', annullaSpostamento);
    agganciaMultiSel();
    return;
  }
  const sel = trovaMobileLibero(progetto, step2.mobSelId);
  if (sel && categoriaTipo(sel.tipo) === 'oggetto') return renderPannelloOggetto(sel);
  pannello.innerHTML = `
    <section>
      <h3>Accessori</h3>
      <div class="riga-3d">Luci, sgabelli, tavoli e sedie, piante e oggetti per la cucina. Apri una categoria e tocca un oggetto: compare nella pianta (lampade sopra il piano, sedie e sgabelli davanti ai mobili, il resto sul piano). Poi trascinalo dove vuoi: nel rendering lo ritrovi lì.</div>
    </section>
    <section>${htmlCatalogoAccessori()}</section>
    <section class="actions">
      <button id="acc-indietro" class="btn-ghost" type="button">← Moduli alti</button>
      <button id="acc-avanti" class="btn-oro" type="button" style="flex:1">Rendering 3D →</button>
    </section>`;
  agganciaCatalogoAccessori(pannello);
  document.getElementById('acc-indietro')?.addEventListener('click', () => { step2.mobSelId = null; progetto.stepCorrente = 3; aggiorna(); });
  document.getElementById('acc-avanti')?.addEventListener('click', () => { step2.mobSelId = null; progetto.stepCorrente = P_3D; aggiorna(); });
}
/** Riepilogo del passo Accessori: gli oggetti messi in cucina (tocca per selezionarlo, ✕ per toglierlo). */
function renderRiepilogoAccessori() {
  const ogg = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) === 'oggetto');
  const T = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
  riepilogo.innerHTML = `
    <section data-tendina="accessori">
    <h3>Accessori in cucina · ${ogg.length}</h3>
    ${ogg.length ? ogg.map((m) => `<div class="riep-riga riep-acc ${m.id === step2.mobSelId ? 'sel' : ''}">
      <button type="button" class="riep-acc-nome" data-accsel="${m.id}" data-no-i18n>${escHtml(T(nomeTipo(m.tipo)))}</button>
      <button type="button" class="riep-acc-x" data-acctogli="${m.id}" title="Togli">✕</button></div>`).join('')
    : '<div class="riga-3d">Ancora nessun accessorio: aprine una categoria a sinistra.</div>'}
    </section>
  `;
  tendinePannello(riepilogo, 'cucina-riepilogo', { aperte: [] });
  riepilogo.querySelectorAll('[data-accsel]').forEach((b) => b.addEventListener('click', () => { step2.mobSelId = Number(b.dataset.accsel); aggiorna(); }));
  riepilogo.querySelectorAll('[data-acctogli]').forEach((b) => b.addEventListener('click', () => {
    registraStoria(); rimuoviMobileLibero(progetto, Number(b.dataset.acctogli));
    if (step2.mobSelId === Number(b.dataset.acctogli)) step2.mobSelId = null;
    aggiorna();
  }));
}

/**
 * PIEDINI da 10 o 15 cm per tutta la cucina: lo zoccolo, il piano, le colonne e i costadi a terra seguono da soli.
 * I costadi bassi e i pannelli di copertura (isola, penisola) hanno un'altezza scritta: quelli alti
 * «bassi + piedini» (es. 700 + 150 = 850) passano alla misura nuova (700 + 100 = 800).
 */
function cambiaPiedini(nuovi) {
  const vecchi = piediniCucina(progetto);
  if (nuovi === vecchi && progetto.piedini === nuovi) return;
  registraStoria();
  const hb = altezzaBassiCucina(progetto) ?? 700;
  for (const m of (progetto.mobiliLiberi || [])) {
    const c = categoriaTipo(m.tipo);
    const basso = (c === 'costado' && (m.profondita_mm || 620) >= 500) || m.tipo === 'pannello-copertura';
    if (basso && Math.round(m.altezza_mm || 0) === hb + vecchi) m.altezza_mm = hb + nuovi;
  }
  progetto.piedini = nuovi;
  aggiorna();
}

function renderPannelloStep3d() {
  const sel = trovaMobileLibero(progetto, step2.mobSelId);
  if (sel) return renderPannelloModificaMobile(sel);
  const coloriZocc = (scena3dMod && scena3dMod.coloriZoccolo) ? scena3dMod.coloriZoccolo() : [];
  const zoccSel = progetto.zoccoloColore || 'nero-opaco';
  const materialiEnc = (scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer('encimera') : [];
  const encAttuale = (progetto.encimera || {}).materiale || null;
  const avvisi = problemiMobiliLiberi(progetto);
  pannello.innerHTML = `
    <section class="step3-pannello">
      <h3>Accessori</h3>
      <div class="riga-3d" style="margin-bottom:8px">Scegli una categoria e tocca un oggetto: compare in cucina. Poi trascinalo dove vuoi.</div>
      ${htmlCatalogoAccessori()}
    </section>
    ${avvisi.length ? `
    <section class="step3-pannello">
      <h3>Da sistemare</h3>
      ${avvisi.map((x) => `<div class="avviso-pannello">${x.messaggio}</div>`).join('')}
    </section>` : ''}
    ${htmlTetto('step3-pannello')}
    <section class="step3-pannello">
      <h3>Piano di lavoro e pannello dietro</h3>
      ${materialiEnc.length ? `
      <div class="riga-3d" style="margin-bottom:6px">Il piano cambia su tutta la cucina. Lo spessore lo scegli qui sotto.</div>
      ${htmlTendineColori(materialiEnc, (mt) => `<button type="button" class="swatch ${mt.id === encAttuale ? 'sel' : ''}"
          data-enc="${mt.id}" title="${mt.nome} (${mt.spessore || 40} mm)" style="background-image:url('${mt.thumb}')"></button>`, {
        sel: encAttuale, chiave: 'cucina-encimera',
        prima: `<button type="button" class="swatch swatch-none ${!encAttuale ? 'sel' : ''}" data-enc="" title="Nero standard (4 cm)">—</button>` })}
      ${htmlSpessorePiano()}` : ''}
      ${htmlSporgenzePiano()}
      ${htmlSchienale(true)}
    </section>
    ${htmlFiniture()}
    <section class="step3-pannello">
      <h3>Interno degli armadi</h3>
      <div class="riga-3d" style="margin-bottom:6px">Il colore della struttura dei mobili: si vede dentro (vetrine, vano aperto, cassetti) e sui fianchi senza costado. Va anche nella distinta.</div>
      <div class="palette-zoccolo">
        ${[['bianco', 'Bianco', '#ecebe6'], ['antracite', 'Antracite', '#3a3b3e']].map(([id, nome, css]) => `<button type="button" class="swatch-zocc ${(progetto.coloreInterno || 'bianco') === id ? 'sel' : ''}"
          data-interno="${id}" title="${nome}" style="background:${css}"></button>
          <span class="et-zocc">${nome}</span>`).join('')}
      </div>
    </section>
    <section class="step3-pannello">
      <h3>Colore zoccolo</h3>
      <div class="palette-zoccolo">
        ${coloriZocc.map((z) => `<button type="button" class="swatch-zocc ${z.id === zoccSel ? 'sel' : ''}"
          data-zocc="${z.id}" title="${z.nome}" style="background:${z.css}"></button>
          <span class="et-zocc">${z.nome}</span>`).join('')}
      </div>
      ${(() => { const pd = piediniCucina(progetto); return `
      <div class="riga-3d" style="margin:10px 0 6px">Piedini: lo zoccolo è alto come i piedini. Cambiano anche l'altezza del piano, delle colonne e dei costadi.</div>
      <div class="opzioni-anta">
        ${[100, 150].map((v) => `<button type="button" class="btn-ghost ${pd === v ? 'attivo' : ''}" data-piedini="${v}">${pd === v ? '✓ ' : ''}Piedini da ${v / 10} cm</button>`).join('')}
      </div>`; })()}
    </section>
    ${htmlPavimento()}
    <section class="step3-pannello">
      <h3>Lampade e luce</h3>
      <div class="riga-3d" style="margin-bottom:6px">Le lampade del catalogo si vedono accese: il vetro e i paralumi brillano e illuminano il tavolo e l'isola. Abbassando la luce esterna si vede ancora meglio.</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost ${progetto.lampadeAccese !== false ? 'attivo' : ''}" data-lampade="si">${progetto.lampadeAccese !== false ? '✓ ' : ''}💡 Lampade accese</button>
        <button type="button" class="btn-ghost ${progetto.lampadeAccese === false ? 'attivo' : ''}" data-lampade="no">${progetto.lampadeAccese === false ? '✓ ' : ''}Lampade spente</button>
      </div>
      ${progetto.lampadeAccese !== false ? htmlColoreLuce('lamp', Number(progetto.lampadeK) || 3700, 'Colore delle lampade') : ''}
      ${htmlLuceEsterna()}
    </section>
    <section class="step3-pannello">
      <h3>LED sotto i pensili</h3>
      <div class="riga-3d" style="margin-bottom:6px">Striscia di luce sotto ogni pensile. Scegli il colore della luce con la barra.</div>
      <div class="opzioni-anta">
        ${(() => {
          const on = !!(progetto.led && progetto.led.attivo);
          return [['off', 'Nessun LED', !on], ['on', '💡 LED accesi', on]].map(([id, et, sel]) => `<button type="button" class="btn-ghost opt-led ${sel ? 'attivo' : ''}"
            data-led="${id}">${sel ? '✓ ' : ''}${et}</button>`).join('');
        })()}
      </div>
      ${(progetto.led || {}).attivo ? htmlColoreLuce('led', kelvinLedP(), 'Colore della luce') : ''}
      ${cucinaPonte() && (progetto.led || {}).attivo ? (() => {
        const d0 = (progetto.led || {}).ponte || 'entrambi', dove = d0 === 'sotto' ? 'entrambi' : d0 === 'sopra' ? 'ponte' : d0;
        const v = (id, et) => `<button type="button" class="btn-ghost opt-ledponte ${dove === id ? 'attivo' : ''}" data-ledponte="${id}">${dove === id ? '✓ ' : ''}${et}</button>`;
        return `
      <div class="riga-3d" style="margin:10px 0 6px">Dove, nella cucina a ponte (sempre sotto)</div>
      <div class="opzioni-anta">${v('pensili', 'Sotto i pensili')}${v('ponte', 'Sotto il ponte')}${v('entrambi', 'Sotto entrambi')}</div>
      <div class="riga-3d" style="margin-top:6px">Sotto i pensili: la striscia sotto ogni pensile, anche quelli sotto il ponte. Sotto il ponte: dove sotto il ponte non ci sono pensili, la striscia va sotto il ponte. Sotto entrambi: tutte e due. La luce scende sempre sul piano.</div>`;
      })() : ''}
    </section>
    ${(() => {
      const ct = progetto.cierreTecho || { attivo: false, altezza: 300 };
      const hC = Math.max(20, Number(ct.altezza) || 300);
      return `
    <section class="step3-pannello">
      <h3>Cierre a techo</h3>
      <div class="riga-3d" style="margin-bottom:6px">Fascia continua sopra pensili e colonne che segue il fronte dei mobili: a filo delle colonne (colore colonne) e a filo dei pensili (colore pensili), con il pezzo che rientra dove cambia la profondità. Chiude lo spazio fino al soffitto. Negli angoli una fascia passa (+ lo spessore) e l'altra ci si appoggia; dove finisce nel vuoto un fianco la chiude fino al muro.</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-cierre ${!ct.attivo ? 'attivo' : ''}" data-cierre="no">${!ct.attivo ? '✓ ' : ''}No</button>
        <button type="button" class="btn-ghost opt-cierre ${ct.attivo ? 'attivo' : ''}" data-cierre="si">${ct.attivo ? '✓ ' : ''}Sì</button>
      </div>
      ${ct.attivo ? `
      <div class="riga-3d" style="margin:8px 0 4px">Altezza del cierre (mm) — scrivila o scegli una misura:</div>
      <input type="number" id="cierre-h" class="modale-num" value="${hC}" min="20" max="1500" step="1" style="width:100%" />
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${[100, 150, 200, 250, 300, 400].map((v) => `<button type="button" class="btn-ghost opt-cierreh ${hC === v ? 'attivo' : ''}" data-cierreh="${v}" style="flex:1;min-width:64px">${v / 10} cm</button>`).join('')}
      </div>` : ''}
    </section>`;
    })()}
    <section class="step3-pannello">
      <h3>Immagine</h3>
      <div class="riga-3d" style="margin-bottom:6px">Salva una foto del rendering in alta qualità (PNG).</div>
      <button id="s3-foto-reale" class="btn-oro" type="button" style="width:100%;margin-bottom:8px">✨ Foto realistica</button>
      <div class="riga-3d" style="margin-bottom:8px">Salva la vista 3D com'è in alta risoluzione, con la stessa luce, le stesse ombre e gli stessi materiali. Subito.</div>
      <button id="s3-salva-img" class="btn-ghost" type="button" style="width:100%">📷 Salva immagine HD (veloce)</button>
    </section>
    <section class="actions">
      <button id="s3-indietro" class="btn-ghost" type="button" style="flex:1">← Moduli alti</button>
    </section>`;
  pannello.querySelectorAll('.opt-cierre').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.cierreTecho = { altezza: 300, ...(progetto.cierreTecho || {}), attivo: b.dataset.cierre === 'si' };
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-cierreh').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.cierreTecho = { ...(progetto.cierreTecho || {}), attivo: true, altezza: Number(b.dataset.cierreh) };
    aggiorna();
  }));
  pannello.querySelector('#cierre-h')?.addEventListener('change', (e) => {
    registraStoria();
    progetto.cierreTecho = { ...(progetto.cierreTecho || {}), attivo: true, altezza: Math.max(20, Math.min(1500, Math.round(Number(e.target.value) || 300))) };
    aggiorna();
  });
  agganciaTetto(pannello);
  agganciaCatalogoAccessori(pannello);
  pannello.querySelectorAll('.swatch-zocc[data-interno]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.coloreInterno = b.dataset.interno;
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch-zocc[data-zocc]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.zoccoloColore = b.dataset.zocc;
    aggiorna();
  }));
  pannello.querySelectorAll('[data-piedini]').forEach((b) => b.addEventListener('click', () => cambiaPiedini(Number(b.dataset.piedini))));
  pannello.querySelectorAll('[data-lampade]').forEach((b) => b.addEventListener('click', () => {
    registraStoria(); progetto.lampadeAccese = b.dataset.lampade === 'si'; aggiorna();
  }));
  agganciaLuceEsterna(pannello);
  pannello.querySelectorAll('[data-pav]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.pavimento = b.dataset.pav || null;
    aggiorna();
  }));
  document.getElementById('pav-aggiungi')?.addEventListener('click', apriPavimentoDaFoto);
  document.getElementById('pav-elimina')?.addEventListener('click', () => eliminaPavimentoProprio(progetto.pavimento));
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
  agganciaSpessorePiano(pannello);
  agganciaSchienale(pannello);
  agganciaFiniture(pannello);
  pannello.querySelectorAll('.opt-led').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    const v = b.dataset.led;
    if (v === 'off') progetto.led = { ...(progetto.led || {}), attivo: false };
    else progetto.led = { ...(progetto.led || {}), attivo: true };
    aggiorna();
  }));
  agganciaColoreLuce(pannello);
  pannello.querySelectorAll('.opt-ledponte').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.led = { ...(progetto.led || {}), ponte: b.dataset.ledponte };
    aggiorna();
  }));
  document.getElementById('s3-foto-reale')?.addEventListener('click', async () => {
    if (!scena3dMod || !scena3dMod.fotoRealistica3d) return;
    const { apriFotoRealistica } = await import('../foto-dialogo.js?v=20261124n');
    apriFotoRealistica({ calcola: (p) => scena3dMod.fotoRealistica3d(p), tela3d: document.getElementById('cucina-3d'), nome: 'cucina' });
  });
  document.getElementById('s3-salva-img')?.addEventListener('click', () => {
    const ok = scena3dMod && scena3dMod.esportaImmagine3d
      && scena3dMod.esportaImmagine3d(`cucina-${nomeFileData()}.png`);
    if (!ok) alert('Impossibile salvare l\'immagine su questo dispositivo.');
  });
  document.getElementById('s3-indietro')?.addEventListener('click', () => { progetto.stepCorrente = P_ACC; aggiorna(); });
}

/** Stringa data per il nome file, es. 2026-11-06. */
function nomeFileData() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Oggetto selezionato nel 3D (sgabello, friggitrice…): ruota, elimina. */
/** Scelta del COLORE per le lampade che ce l'hanno (lampade a nastro LED): tinta unita e, per quelle a
 * due nastri, due colori (un nastro e l'altro). */
function htmlColoreLampada(m) {
  const cl = coloriLampada(lampadaDaTipo(m.tipo));
  if (!cl) return '';
  const sel = m.colore || cl.base;
  const bottone = (c) => `<button type="button" class="btn-ghost opt-collamp ${c.id === sel ? 'attivo' : ''}" data-collamp="${c.id}"
      style="display:inline-flex;align-items:center;gap:6px;padding:6px 9px;flex:0 0 auto">
      <span style="width:20px;height:20px;border-radius:50%;flex:none;border:1px solid rgba(127,127,127,.45);background:${c.hex2 ? `linear-gradient(135deg, ${c.hex} 50%, ${c.hex2} 50%)` : c.hex}"></span>
      ${c.id === sel ? '<span>✓</span>' : ''}<span>${c.nome}</span></button>`;
  return `
    <section class="step3-pannello" data-aperta>
      <h3>Colore della lampada</h3>
      <div class="opzioni-anta" style="flex-wrap:wrap">${cl.tinte.map(bottone).join('')}</div>
      ${cl.dueToni.length ? `
      <div class="riga-3d" style="margin:10px 0 6px">Due colori: un nastro di un colore e l'altro dell'altro</div>
      <div class="opzioni-anta" style="flex-wrap:wrap">${cl.dueToni.map(bottone).join('')}</div>` : ''}
    </section>`;
}

function renderPannelloOggetto(m) {
  const sulPiano = String(m.tipo).startsWith('ogg:');
  pannello.innerHTML = `
    ${htmlColoreLampada(m)}
    <section class="step3-pannello">
      <h3>Oggetto selezionato</h3>
      <div class="mod-row"><span><span data-no-i18n>${escHtml(nomeTipo(m.tipo))}</span> · <strong>${Math.round(dimMobile(m).w / 10)}×${Math.round(dimMobile(m).d / 10)}${m.altezza_mm ? `×${Math.round(m.altezza_mm / 10)}` : ''} cm</strong></span></div>
      <div class="riga-3d" style="margin:8px 0">Trascinalo dove vuoi.${sulPiano ? ' Se lo lasci sopra un mobile basso o un tavolo si appoggia sopra, altrimenti va a terra.' : ''}</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost" id="ogg-ruota">⟳ Ruota 90°</button>
        <button type="button" class="btn-ghost" id="ogg-elimina">Elimina</button>
        ${htmlModoMulti()}
      </div>
    </section>
    <section class="actions">
      <button id="mob-deseleziona" class="btn-ghost" type="button" style="flex:1">Chiudi</button>
    </section>`;
  pannello.querySelectorAll('[data-collamp]').forEach((b) => b.addEventListener('click', () => {
    if ((m.colore || '') === b.dataset.collamp) return;
    registraStoria(); m.colore = b.dataset.collamp; aggiorna();
  }));
  document.getElementById('ogg-ruota').addEventListener('click', () => { registraStoria(); ruotaMobileLibero(progetto, m.id); aggiorna(); });
  document.getElementById('ogg-elimina').addEventListener('click', () => { registraStoria(); rimuoviMobileLibero(progetto, m.id); step2.mobSelId = null; aggiorna(); });
  document.getElementById('mob-deseleziona').addEventListener('click', () => { step2.mobSelId = null; svuotaMulti(); aggiorna(); });
  agganciaModoMulti();
}

function renderPannelloModificaMobile(m) {
  const cat = categoriaTipo(m.tipo);
  if (cat === 'oggetto') return renderPannelloOggetto(m);
  const isBase = cat === 'base';
  const puoAgg = m.tipo === 'base-ante' || m.tipo === 'base-cassetti';
  // Configurazione ante (numero + lato apertura): vale per base con ante e pensili
  const puoAnte = m.tipo === 'base-ante' || m.tipo === 'pensile' || m.tipo === 'sopra-frigo' || m.tipo === 'ponte';
  // MOBILE APERTO (senza ante): pensili e basi con ante (non sotto lavello o piano cottura)
  const puoAperto = m.tipo === 'pensile' || (m.tipo === 'base-ante' && !m.lavello && !m.placca);
  const nAnte = anteDiMobile(m);
  const latoAnta = m.antaLato === 'sx' ? 'sx' : m.antaLato === 'alto' ? 'alto' : 'dx';
  const fuochi = m.fuochi || ((m.larghezza_mm || 600) < 600 ? 2 : 4);
  const sinkCm = Math.max(30, Math.round(((m.larghezza_mm || 600) - 100) / 10));
  const gruppoColore = cat === 'pensile' ? 'pensile' : (cat === 'colonna' || cat === 'altillo') ? 'colonna'
    : cat === 'costado' ? 'costado' : isBase ? 'base' : null;
  // CUCINA A PONTE: il modulo del ponte e i pensili sotto hanno i LORO colori (Colori del ponte)
  const parteP = m.tipo === 'ponte' ? 'ponte' : (cat === 'pensile' && pontiSopra(progetto, m).length ? 'pensili' : null);
  if (parteP && step2._selPonte !== m.id) { step2._selPonte = m.id; step2.parteColorePonte = parteP; }
  const nomeGruppo = parteP === 'ponte' ? 'moduli del ponte' : parteP === 'pensili' ? 'pensili sotto il ponte'
    : { base: 'mobili bassi', pensile: 'pensili', colonna: 'colonne', costado: 'costadi' }[gruppoColore];
  const materialiTutti = (scena3dMod && scena3dMod.MATERIALI) || [];
  // Palette "colore ante" filtrata: niente encimere (hanno la loro sezione).
  // Palette dal CATALOGO: con il finger-pull attivo per questo gruppo si vede
  // la sezione Finger-pull, altrimenti Legni e colori.
  const fpGruppo = progetto.fingerPull === true || !!(progetto.fingerPull && typeof progetto.fingerPull === 'object' && progetto.fingerPull[gruppoColore]);
  const perSez = (sz) => ((scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer(sz) : materialiTutti.filter((mt) => mt.categoria !== 'encimera'));
  const materiali = perSez(fpGruppo && gruppoColore !== 'costado' ? 'fingerpull' : 'legno');
  const materialiEncimera = (scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer('encimera') : materialiTutti.filter((mt) => mt.categoria === 'encimera');
  // Costadi: tutti uguali (un colore per tutti) oppure diversi (ognuno il suo)
  const costadoSingolo = gruppoColore === 'costado' && !!progetto.costadiDiversi;
  // Ante: colore di tutto il gruppo, oppure SOLO di questo modulo (es. un armadio di stacco)
  const soloQuesto = gruppoColore && gruppoColore !== 'costado' && (step2.coloreSolo === m.id || !!m.coloreFronte);
  const colAttuale = costadoSingolo ? (m.colore || null)
    : soloQuesto ? (m.coloreFronte || null)
      : parteP ? ((progetto.coloriPonte || {})[parteP] || null) : (progetto.coloriFronti || {})[gruppoColore];
  const encAttuale = (progetto.encimera || {}).materiale || null;
  // TOCCATO nel 3D il lavello, il rubinetto, il piano cottura o il forno: le SUE opzioni per prime
  // (il colore in cima), aperte; poi il resto del modulo
  const parteT = step2.parteSel && step2.parteSel.id === m.id ? step2.parteSel.parte : null;
  const primaDiTutto = m.tipo === 'lavastoviglie' ? htmlColoreLavastoviglie(m, true)
    : parteT === 'lavello' || parteT === 'rubinetto' || parteT === 'forno' ? htmlFiniture(parteT)
    : parteT === 'placca' && (m.placca || m.tipo === 'forno') ? `
    <section class="step3-pannello" data-aperta>
      <h3>Piano cottura</h3>${htmlFuochi(m)}
    </section>` : '';
  pannello.innerHTML = `
    ${primaDiTutto}
    <section class="step3-pannello">
      <h3>Modulo selezionato</h3>
      <div class="mod-row ${m.tipo}"><span>${nomeTipo(m.tipo)} · <strong>${descrizioneMobile(m)}</strong></span></div>
    </section>
    ${apertoDi(m) ? htmlMobileAperto(m) : ''}
    ${htmlBaseAngolo(m)}
    ${htmlPianoTavolo(m)}
    ${cat === 'colonna' ? `
    <section class="step3-pannello">
      <h3>Colonna · parte alta</h3>
      <div class="opzioni-anta">
        ${(VARIANTI_COLONNA || []).map((v) => `<button type="button" class="btn-ghost opt-colvar ${(m.variante || 'porta') === v.id ? 'attivo' : ''}" data-colvar="${v.id}">${(m.variante || 'porta') === v.id ? '✓ ' : ''}${v.nome}</button>`).join('')}
      </div>
      ${(m.variante || 'porta') === 'vano' ? `
      <div class="riga-3d" style="margin:8px 0 4px">Altezza del vano aperto (mm) — modifica a mano o scegli una misura:</div>
      <input type="number" id="vano-h" class="modale-num" value="${m.altezzaVano_mm || 600}" min="100" step="10" style="width:100%" />
      <div class="opzioni-anta" style="margin-top:6px">
        ${[300, 400, 450, 600, 700].map((v) => `<button type="button" class="btn-ghost opt-vanoh ${(m.altezzaVano_mm || 600) === v ? 'attivo' : ''}" data-vanoh="${v}">${v / 10} cm</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin-top:8px">Nel vano puoi mettere i tuoi oggetti (microonde, macchina del caffè…): aggiungili da “Aggiungi oggetti” e trascinali dentro il vano. Si appoggiano sul ripiano, dritti e centrati.</div>` : ''}
    </section>` : ''}
    ${m.tipo === 'base-cassetti' ? (() => {
      const nc = Math.max(1, m.cassetti || 3), H = m.altezza_mm || 700;
      const piccolo = !!m.cassettoPiccolo_mm && nc > 1;
      const golaC = golaSuMobile(progetto, m);
      const alt = frontiCassetti(H, nc, piccolo ? m.cassettoPiccolo_mm : null, golaC);
      return `
    <section class="step3-pannello">
      <h3>Cassetti</h3>
      <div class="riga-3d" style="margin-bottom:6px">Quanti cassetti:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="btn-ghost opt-ncass ${n === nc ? 'attivo' : ''}" data-ncass="${n}" style="flex:1;min-width:38px">${n === nc ? '✓' : ''}${n}</button>`).join('')}
      </div>
      ${nc > 1 ? `
      <div class="opzioni-anta" style="margin-top:10px">
        <button type="button" class="btn-ghost opt-cassdiv ${!piccolo ? 'attivo' : ''}" data-cassdiv="uguali">${!piccolo ? '✓ ' : ''}Tutti uguali</button>
        <button type="button" class="btn-ghost opt-cassdiv ${piccolo ? 'attivo' : ''}" data-cassdiv="piccolo">${piccolo ? '✓ ' : ''}Uno piccolo in alto, gli altri uguali</button>
      </div>
      ${piccolo ? `
      <div class="riga-3d" style="margin:8px 0 4px">Altezza del frontale piccolo (mm):</div>
      <input type="number" id="cass-piccolo" class="modale-num" value="${alt[0]}" min="60" step="1" style="width:100%" />` : ''}` : ''}
      <div class="riga-3d" style="margin-top:8px">Frontali (dall'alto): <strong>${alt.join(' · ')} mm</strong></div>
      ${golaC ? `<div class="riga-3d" style="margin-top:4px">Con la gola: ${spazioGola()} mm sopra il primo cassetto (profilo L) e fra un cassetto e l'altro (profilo C).</div>` : ''}
    </section>`;
    })() : ''}
    ${htmlColoreFrigo(m)}
    ${htmlAperturaColonna(m)}
    ${htmlPensileSottoPonte(m)}
    ${m.tipo === 'ponte' || (categoriaTipo(m.tipo) === 'pensile' && pontiSopra(progetto, m).length) ? htmlColoriPonte() : ''}
    ${htmlDistanzaFrigo(m)}
    ${puoAnte ? `
    <section class="step3-pannello">
      <h3>Ante del modulo</h3>
      ${apertoDi(m) ? '' : `
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-nante ${nAnte === 1 ? 'attivo' : ''}" data-nante="1">${nAnte === 1 ? '✓ ' : ''}1 anta</button>
        <button type="button" class="btn-ghost opt-nante ${nAnte === 2 ? 'attivo' : ''}" data-nante="2">${nAnte === 2 ? '✓ ' : ''}2 ante</button>
      </div>
      ${nAnte === 1 ? `
      <div class="riga-3d" style="margin:8px 0 6px">Lato di apertura (maniglia):</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-lato ${latoAnta === 'sx' ? 'attivo' : ''}" data-lato="sx">${latoAnta === 'sx' ? '✓ ' : ''}← Sinistra</button>
        <button type="button" class="btn-ghost opt-lato ${latoAnta === 'dx' ? 'attivo' : ''}" data-lato="dx">${latoAnta === 'dx' ? '✓ ' : ''}Destra →</button>
        <button type="button" class="btn-ghost opt-lato ${latoAnta === 'alto' ? 'attivo' : ''}" data-lato="alto">${latoAnta === 'alto' ? '✓ ' : ''}↑ Verso l'alto</button>
      </div>` : ''}
      <div class="riga-3d" style="margin-top:6px">${isBase
        ? 'Il pensile sopra questa base prende la stessa configurazione.'
        : 'Ereditato dalla base sotto; puoi comunque modificarlo qui.'}</div>`}
      ${(() => {
        const v = apertoDi(m) ? null : m.vetrina;
        const op = (cl, attr, val, et, on) => `<button type="button" class="btn-ghost ${cl} ${on ? 'attivo' : ''}" ${attr}="${val}" style="flex:1;min-width:90px">${on ? '✓ ' : ''}${et}</button>`;
        return `
      <div class="riga-3d" style="margin:12px 0 6px"><strong>Anta piena, vetrina o a giorno</strong> (solo questo modulo):</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-vetr', 'data-vetr', 'no', 'Piena', !v && !apertoDi(m))}
        ${op('opt-vetr', 'data-vetr', 'si', 'Vetrina (con vetro)', !!v)}
        ${puoAperto ? op('opt-vetr', 'data-vetr', 'aperto', 'A giorno (senza ante)', !!apertoDi(m)) : ''}
      </div>

      ${v ? `
      <div class="riga-3d" style="margin:8px 0 6px">Telaio:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-vtel', 'data-vtel', 'legno', 'Come le ante (5 cm)', (v.telaio || 'legno') === 'legno')}
        ${op('opt-vtel', 'data-vtel', 'alluminio', 'Alluminio', v.telaio === 'alluminio')}
        ${op('opt-vtel', 'data-vtel', 'nero', 'Nero', v.telaio === 'nero')}
      </div>
      <div class="riga-3d" style="margin:8px 0 6px">Vetro:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-vvet', 'data-vvet', 'trasparente', 'Trasparente', (v.vetro || 'trasparente') === 'trasparente')}
        ${op('opt-vvet', 'data-vvet', 'satinato', 'Satinato', v.vetro === 'satinato')}
        ${op('opt-vvet', 'data-vvet', 'fume', 'Fumé', v.vetro === 'fume')}
      </div>
      <div class="riga-3d" style="margin-top:6px">${(v.telaio || 'legno') === 'legno'
        ? 'In distinta: l\'anta (vano del vetro da fresare) e il vetro su misura negli accessori.'
        : 'In distinta: l\'anta con telaio e vetro da ordinare, con le sue misure.'}</div>` : ''}`;
      })()}
    </section>` : ''}
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
      ${htmlFuochi(m)}
      <div class="riga-3d" style="margin-top:6px">La dimensione di piano cottura e lavello si adatta alla larghezza del modulo.</div>
    </section>` : `
    <section class="step3-pannello"><div class="riga-3d">${
      m.tipo === 'forno' ? 'Modulo con forno e piano cottura.' :
      m.tipo === 'lavello' ? 'Modulo con lavello.' :
      'Per aggiungere lavello o piano cottura seleziona una base con ante o cassetti.'}</div></section>`}
    ${cat === 'pannello' ? (() => {
      // PANNELLONE (pannello copertura dell'isola, regletta grande): colore suo, a scelta
      const lista = perSez('pannello');
      const sel = m.coloreFronte || null;
      const def = sel ? [...lista, ...materialiEncimera].find((x) => x.id === sel) : null;
      return `
    <section class="step3-pannello">
      <h3>Colore del pannello</h3>
      <div class="riga-3d" style="margin-bottom:6px">Colore: <strong>${def ? def.nome : 'come le ante dei mobili bassi'}</strong></div>
      ${htmlTendineColori(lista, (mt) => `<button type="button" class="swatch ${mt.id === sel ? 'sel' : ''}" data-colpann="${mt.id}" title="${mt.nome}" style="background-image:url('${mt.thumb}')"></button>`, {
        sel, chiave: 'cucina-pannello',
        prima: `<button type="button" class="swatch swatch-none ${!sel ? 'sel' : ''}" data-colpann="" title="Come le ante dei mobili bassi">=</button>` })}
    </section>`;
    })() : ''}
    ${gruppoColore ? `
    <section class="step3-pannello">
      <h3>Colore ${gruppoColore === 'costado' ? '' : 'ante '}· ${gruppoColore === 'costado' && costadoSingolo ? 'questo costado' : soloQuesto ? 'solo questo modulo' : nomeGruppo}</h3>
      ${gruppoColore === 'costado' ? `
      <div class="opzioni-anta" style="margin-bottom:8px">
        <button type="button" class="btn-ghost opt-costadi ${!costadoSingolo ? 'attivo' : ''}" data-costadi="uguali">${!costadoSingolo ? '✓ ' : ''}Costadi uguali</button>
        <button type="button" class="btn-ghost opt-costadi ${costadoSingolo ? 'attivo' : ''}" data-costadi="diversi">${costadoSingolo ? '✓ ' : ''}Costadi diversi</button>
      </div>
      <div class="riga-3d" style="margin-bottom:6px">${costadoSingolo
        ? 'Il colore vale solo per il costado selezionato: tocca gli altri costadi per scegliere il loro.'
        : 'Il colore vale per tutti i costadi (quelli dei pensili prendono il colore delle ante dei pensili).'}</div>` : `
      <div class="opzioni-anta" style="margin-bottom:8px">
        <button type="button" class="btn-ghost opt-colsolo ${!soloQuesto ? 'attivo' : ''}" data-colsolo="tutti">${!soloQuesto ? '✓ ' : ''}Tutti i ${nomeGruppo}</button>
        <button type="button" class="btn-ghost opt-colsolo ${soloQuesto ? 'attivo' : ''}" data-colsolo="solo">${soloQuesto ? '✓ ' : ''}Solo questo modulo</button>
      </div>
      <div class="riga-3d" style="margin-bottom:6px">${soloQuesto
        ? (m.coloreFronte ? 'Questo modulo ha un colore suo, diverso dagli altri. Per farlo tornare come gli altri tocca «Tutti».' : 'Scegli il colore: vale solo per questo modulo (es. un armadio per staccare).')
        : `Si applica a tutti i ${nomeGruppo}.`}</div>`}
      ${gruppoColore === 'costado' ? (() => {
        const enc = materialiEncimera.find((mt) => mt.id === encAttuale);
        return `
      <button type="button" class="btn-ghost opt-piano ${colAttuale === '@piano' ? 'attivo' : ''}" data-mat="@piano" style="width:100%;margin-bottom:8px;display:flex;align-items:center;gap:8px;justify-content:center">
        <span class="swatch" style="pointer-events:none;width:22px;height:22px;${enc ? `background-image:url('${enc.thumb}')` : 'background:#2a2a2a'}"></span>
        ${colAttuale === '@piano' ? '✓ ' : ''}Uguale al piano di lavoro${enc ? ` (${enc.nome})` : ''}</button>`;
      })() : ''}
      ${htmlTendineColori(gruppoColore === 'costado' ? [...materiali, ...materialiEncimera] : materiali,
        (mt) => `<button type="button" class="swatch ${mt.id === colAttuale ? 'sel' : ''}"
          data-mat="${mt.id}" title="${mt.nome}" style="background-image:url('${mt.thumb}')"></button>`,
        { sel: colAttuale, chiave: `cucina-colore-${gruppoColore}${fpGruppo && gruppoColore !== 'costado' ? '-fp' : ''}` })}
    </section>` : ''}
    ${(() => {
      if (m.tipo === 'ponte' || (cat === 'pensile' && pontiSopra(progetto, m).length)) return htmlPortePonte(m.tipo === 'ponte' ? 'ponte' : 'pensiliPonte');
      if (!(gruppoColore === 'base' || gruppoColore === 'pensile' || gruppoColore === 'colonna')) return '';
      const fp = progetto.fingerPull;
      const push = !!(progetto.push && progetto.push[gruppoColore]);
      // GOLA in alluminio: solo per i mobili bassi (le colonne dopo)
      const gc = golaProgetto(progetto), golaOn = gruppoColore === 'base' && gc.base;
      const on = !golaOn && (fp === true || !!(fp && typeof fp === 'object' && fp[gruppoColore]));
      const man = !on && !push;
      if (golaOn) return `
    <section class="step3-pannello">
      <h3>Porte · ${nomeGruppo}</h3>
      <div class="riga-3d" style="margin-bottom:6px">Vale per tutti i ${nomeGruppo}.</div>
      <div class="riga-3d" style="margin:4px 0">Porta</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-fp" data-fp="0">Normale</button>
        <button type="button" class="btn-ghost opt-fp" data-fp="1">Finger-pull</button>
        <button type="button" class="btn-ghost opt-gola attivo" data-gola="1">✓ Gola alluminio</button>
      </div>
      <div class="riga-3d" style="margin:10px 0 4px">Colore del profilo</div>
      <div class="opzioni-anta">
        ${COLORI_GOLA.map((c) => `<button type="button" class="btn-ghost opt-golacol ${gc.colore === c.id ? 'attivo' : ''}" data-golacol="${c.id}"><span aria-hidden="true" style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:6px;border:1px solid rgba(0,0,0,.25);background:${c.hex}"></span>${gc.colore === c.id ? '✓ ' : ''}${c.nome}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin-top:8px">Niente maniglie: profilo L sotto il piano e profilo C fra i cassetti. L'anta perde ${spazioGola()} mm in alto; il primo cassetto sta ${spazioGola()} mm sotto il piano e fra un cassetto e l'altro restano ${spazioGola()} mm (si cambia in ⚙ Impostazioni → Parametri). In distinta: profili in barre da 4 m, tappi, angoli e supporti.</div>
    </section>`;
      return `
    <section class="step3-pannello">
      <h3>Porte · ${nomeGruppo}</h3>
      <div class="riga-3d" style="margin-bottom:6px">Vale per tutti i ${nomeGruppo}. Le due scelte sono indipendenti: anche una porta finger-pull può avere il push.</div>
      <div class="riga-3d" style="margin:4px 0">Porta</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-fp ${!on ? 'attivo' : ''}" data-fp="0">${!on ? '✓ ' : ''}Normale</button>
        <button type="button" class="btn-ghost opt-fp ${on ? 'attivo' : ''}" data-fp="1">${on ? '✓ ' : ''}Finger-pull</button>
        ${gruppoColore === 'base' ? `<button type="button" class="btn-ghost opt-gola" data-gola="1">Gola alluminio</button>` : ''}
      </div>
      <div class="riga-3d" style="margin:8px 0 4px">Apertura</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-push ${!push ? 'attivo' : ''}" data-push="0">${!push ? '✓ ' : ''}Maniglia</button>
        <button type="button" class="btn-ghost opt-push ${push ? 'attivo' : ''}" data-push="1">${push ? '✓ ' : ''}Push</button>
      </div>
      ${push ? '<div class="riga-3d" style="margin-top:6px">Push: si preme e si apre. In distinta un push pull e una base per ogni porta.</div>' : ''}
      ${man ? (() => {
        const lista = (scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer('maniglie') : [];
        const sel = (progetto.maniglie || {})[gruppoColore] || 'maniglia-standard';
        return (lista.length > 1 ? `
      <div class="riga-3d" style="margin:10px 0 6px">Maniglia</div>
      <div class="palette-colori">
        ${lista.map((mt) => `<button type="button" class="swatch ${mt.id === sel ? 'sel' : ''}" data-man="${mt.id}" title="${mt.nome}"
          style="background:${scena3dMod.sfondoSwatch(mt)}"></button>`).join('')}
      </div>` : '') + htmlColoreManiglia((progetto.coloriManiglie || {})[gruppoColore], 'mancol');
      })() : ''}
    </section>`;
    })()}
    ${isBase ? `
    <section class="step3-pannello">
      <h3>Piano di lavoro e pannello dietro</h3>
      ${materialiEncimera.length ? `
      <div class="riga-3d" style="margin-bottom:6px">Il piano cambia su tutta la cucina. Lo spessore lo scegli qui sotto.</div>
      ${htmlTendineColori(materialiEncimera, (mt) => `<button type="button" class="swatch ${mt.id === encAttuale ? 'sel' : ''}"
          data-enc="${mt.id}" title="${mt.nome} (${mt.spessore || 40} mm)" style="background-image:url('${mt.thumb}')"></button>`, {
        sel: encAttuale, chiave: 'cucina-encimera',
        prima: `<button type="button" class="swatch swatch-none ${!encAttuale ? 'sel' : ''}" data-enc="" title="Nero standard (4 cm)">—</button>` })}
      ${htmlSpessorePiano()}` : ''}
      ${htmlSporgenzePiano()}
      ${htmlSchienale(true)}
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
          { id: 'pers', et: 'Personalizzata' },
        ].map((o) => `<button type="button" class="btn-ghost opt-anta ${(progetto.antaPensile || 'standard') === o.id ? 'attivo' : ''}"
          data-anta="${o.id}">${(progetto.antaPensile || 'standard') === o.id ? '✓ ' : ''}${o.et}</button>`).join('')}
      </div>
      ${progetto.antaPensile === 'pers' ? (() => { const mm = Math.round(Number(progetto.antaPensileMm)) || 0; return `
      <label class="riga-3d" style="display:block;margin-top:10px">Quanto scende l'anta sotto il pensile (mm)
        <input type="number" id="anta-pens-mm" class="modale-num" min="0" max="300" step="1" value="${mm}" inputmode="numeric" style="width:100%;margin-top:4px" /></label>
      <div class="riga-3d" style="margin-top:6px">Vale per tutti i pensili: pensile 70 → anta ${70 + mm / 10} cm, pensile 90 → anta ${90 + mm / 10} cm. L'anta si apre da sotto (niente maniglia).</div>`; })() : ''}
    </section>` : ''}
    <section class="actions">
      <button id="mob-misura" class="btn-ghost" type="button" style="flex:1">Cambia misura</button>
      <button id="mob-deseleziona" class="btn-ghost" type="button">Chiudi</button>
    </section>
    <section class="actions">
      <button id="s3-indietro" class="btn-ghost" type="button" style="flex:1">← Moduli alti</button>
    </section>`;
  agganciaDistanzaFrigo(pannello, m);
  agganciaColoreFrigo(pannello, m);
  if (primaDiTutto && parteT !== 'placca') agganciaFiniture(pannello);
  agganciaAperturaColonna(pannello, m);
  agganciaColoriPonte(pannello);
  agganciaPortePonte(pannello);
  agganciaPensileSottoPonte(pannello, m);
  pannello.querySelectorAll('.swatch[data-colpann]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (b.dataset.colpann) m.coloreFronte = b.dataset.colpann; else delete m.coloreFronte;
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch[data-mat], .opt-piano[data-mat]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (costadoSingolo) { m.colore = b.dataset.mat; aggiorna(); return; }
    if (soloQuesto) { m.coloreFronte = b.dataset.mat; aggiorna(); return; }
    if (parteP) { progetto.coloriPonte = { ...(progetto.coloriPonte || {}), [parteP]: b.dataset.mat }; aggiorna(); return; }
    if (!progetto.coloriFronti) progetto.coloriFronti = {};
    progetto.coloriFronti[gruppoColore] = b.dataset.mat;
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-vetr').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (b.dataset.vetr === 'si') { m.vetrina = { telaio: 'legno', vetro: 'trasparente', ...(m.vetrina || {}) }; delete m.aperto; }
    else if (b.dataset.vetr === 'aperto') { m.aperto = { interno: 'ante', ...(m.aperto || {}) }; delete m.vetrina; }
    else { delete m.vetrina; delete m.aperto; }
    aggiorna();
  }));
  agganciaMobileAperto(pannello, m);
  pannello.querySelectorAll('.opt-vtel').forEach((b) => b.addEventListener('click', () => {
    registraStoria(); m.vetrina = { ...(m.vetrina || {}), telaio: b.dataset.vtel }; aggiorna();
  }));
  pannello.querySelectorAll('.opt-vvet').forEach((b) => b.addEventListener('click', () => {
    registraStoria(); m.vetrina = { ...(m.vetrina || {}), vetro: b.dataset.vvet }; aggiorna();
  }));
  pannello.querySelectorAll('.opt-colsolo').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.colsolo === 'solo') { step2.coloreSolo = m.id; renderPannello(); return; }
    // «Tutti»: il modulo torna al colore del suo gruppo
    step2.coloreSolo = null;
    if (m.coloreFronte) { registraStoria(); delete m.coloreFronte; aggiorna(); } else renderPannello();
  }));
  pannello.querySelectorAll('.opt-costadi').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.costadiDiversi = b.dataset.costadi === 'diversi';
    aggiorna();
  }));
  pannello.querySelectorAll('.swatch[data-enc]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (!progetto.encimera) progetto.encimera = {};
    progetto.encimera.materiale = b.dataset.enc || null;
    aggiorna();
  }));
  agganciaSpessorePiano(pannello);
  agganciaSchienale(pannello);
  pannello.querySelectorAll('.swatch[data-man]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.maniglie = { ...(progetto.maniglie || {}), [gruppoColore]: b.dataset.man };
    aggiorna();
  }));
  pannello.querySelectorAll('[data-mancol]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    const o = { ...(progetto.coloriManiglie || {}) };
    if (b.dataset.mancol) o[gruppoColore] = b.dataset.mancol; else delete o[gruppoColore];
    progetto.coloriManiglie = o;
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-anta').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.antaPensile = b.dataset.anta;
    if (b.dataset.anta === 'pers' && !(Number(progetto.antaPensileMm) > 0)) progetto.antaPensileMm = 20;   // si parte da 2 cm
    aggiorna();
  }));
  pannello.querySelector('#anta-pens-mm')?.addEventListener('change', (e) => {
    const v = Math.max(0, Math.min(300, Math.round(Number(String(e.target.value).replace(',', '.')))));
    if (!Number.isFinite(v)) return;
    registraStoria();
    progetto.antaPensileMm = v;
    aggiorna();
  });
  agganciaBaseAngolo(pannello, m);
  pannello.querySelectorAll('.opt-ncass').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    m.cassetti = Number(b.dataset.ncass);
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-cassdiv').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (b.dataset.cassdiv === 'uguali') delete m.cassettoPiccolo_mm;
    else m.cassettoPiccolo_mm = m.cassettoPiccolo_mm || 140;
    aggiorna();
  }));
  pannello.querySelector('#cass-piccolo')?.addEventListener('change', (e) => {
    const v = Math.round(Number(e.target.value));
    if (!(v > 0)) return;
    registraStoria();
    m.cassettoPiccolo_mm = v;
    aggiorna();
  });
  pannello.querySelectorAll('.opt-nante').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    m.ante = Number(b.dataset.nante);              // 1 o 2 ante su QUESTO modulo
    if (isBase) sincronizzaAntePensile(progetto, m); // il pensile sopra segue
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-lato').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    m.antaLato = b.dataset.lato;                    // lato apertura anta singola
    if (isBase) sincronizzaAntePensile(progetto, m);
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-fp[data-fp]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    // Maniglia/finger-pull per CATEGORIA (bassi/colonne/alti), indipendenti.
    if (typeof progetto.fingerPull !== 'object' || progetto.fingerPull === null) {
      const old = progetto.fingerPull === true;
      progetto.fingerPull = { base: old, pensile: old, colonna: old };
    }
    progetto.fingerPull[gruppoColore] = b.dataset.fp === '1';
    if (gruppoColore === 'base' && progetto.gola) progetto.gola = { ...golaProgetto(progetto), base: false };   // via la gola
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-push[data-push]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.push = { ...(progetto.push || {}), [gruppoColore]: b.dataset.push === '1' };
    aggiorna();
  }));
  // GOLA in alluminio (mobili bassi): niente finger-pull né push; colore del profilo
  pannello.querySelectorAll('.opt-gola[data-gola]').forEach((b) => b.addEventListener('click', () => {
    if (golaProgetto(progetto).base) return;
    registraStoria();
    if (typeof progetto.fingerPull !== 'object' || progetto.fingerPull === null) {
      const old = progetto.fingerPull === true;
      progetto.fingerPull = { base: old, pensile: old, colonna: old };
    }
    progetto.fingerPull.base = false;
    progetto.push = { ...(progetto.push || {}), base: false };
    progetto.gola = { ...golaProgetto(progetto), base: true };
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-golacol[data-golacol]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.gola = { ...golaProgetto(progetto), colore: b.dataset.golacol };
    aggiorna();
  }));

  // Colonna: variante "parte alta" e altezza del vano aperto.
  pannello.querySelectorAll('.opt-colvar[data-colvar]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    m.variante = b.dataset.colvar;
    aggiorna();
  }));
  pannello.querySelectorAll('.opt-vanoh[data-vanoh]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    m.altezzaVano_mm = Number(b.dataset.vanoh);
    aggiorna();
  }));
  const vanoInp = document.getElementById('vano-h');
  if (vanoInp) vanoInp.addEventListener('change', () => {
    registraStoria();
    m.altezzaVano_mm = Math.max(100, Math.round(Number(vanoInp.value) || 600));
    aggiorna();
  });
  document.getElementById('tog-placca')?.addEventListener('click', () => {
    registraStoria(); m.placca = !m.placca; if (m.placca) m.lavello = false; aggiorna();
  });
  document.getElementById('tog-lavello')?.addEventListener('click', () => {
    registraStoria(); m.lavello = !m.lavello; if (m.lavello) m.placca = false; aggiorna();
  });
  document.getElementById('mob-misura')?.addEventListener('click', () => apriScelta(m.tipo, m.id));
  document.getElementById('mob-deseleziona')?.addEventListener('click', () => { step2.mobSelId = null; aggiorna(); });
  document.getElementById('s3-indietro')?.addEventListener('click', () => { step2.mobSelId = null; progetto.stepCorrente = P_ACC; aggiorna(); });
}

function renderRiepilogoStep3d() {
  const conta = {};
  for (const m of (progetto.mobiliLiberi || [])) {
    const k = nomeTipo(m.tipo);
    conta[k] = (conta[k] || 0) + 1;
  }
  // Moduli fuori misura (da tagliare): larghezza non standard.
  const daTagliare = (progetto.mobiliLiberi || []).filter((m) => m.fuoriMisura && !apertoDi(m));   // l'aperto è fatto a pezzi
  riepilogo.innerHTML = `
    <section data-tendina="mobili">
    <h3>Mobili in scena · ${(progetto.mobiliLiberi || []).length}</h3>
    ${Object.keys(conta).length === 0
      ? '<div class="riep-riga"><span>Nessun mobile</span><strong>—</strong></div>'
      : Object.entries(conta).map(([k, v]) =>
        `<div class="riep-riga"><span>${k}</span><strong>×${v}</strong></div>`).join('')}
    <div class="riep-riga"><span>Totale pezzi</span><strong>${(progetto.mobiliLiberi || []).length}</strong></div>
    </section>
    ${(progetto.mobiliLiberi || []).length ? `
    <button id="apri-distinta" class="btn-oro" type="button" style="width:100%;margin-top:14px">📋 Distinta di taglio</button>
    <div class="riga-3d" style="margin-top:6px">Moduli da ordinare, ante e pezzi da fare con le misure, accessori (piedini…).</div>` : ''}
    ${daTagliare.length ? `
    <h3 style="margin-top:18px">⚠ Da tagliare su misura</h3>
    <div class="riga-3d" style="margin-bottom:6px">Misura non standard: questi moduli vanno tagliati.</div>
    ${daTagliare.map((m) => { const od = moduloDaOrdinare(m); return `<div class="riep-riga avviso-taglio"><span>⚠ ${nomeTipo(m.tipo)}${od ? ` · modulo da ${od.ordina}` : ''}</span><strong>${od ? `tagliare a ${od.taglio} mm` : `${m.larghezza_mm} mm`}</strong></div>`; }).join('')}
    ` : ''}
  `;
  document.getElementById('apri-distinta')?.addEventListener('click', mostraDistinta);
  tendinePannello(riepilogo, 'cucina-riepilogo', { aperte: [] });       // la lista dei mobili: tendina chiusa
}

// --------- IMPOSTAZIONI SALTATE che servono a questa cucina (gola usata, regletta d'angolo presente) ---------
function mancantiCucina() {
  const manca = daImpostare(); if (!manca.length) return [];
  const mob = progetto.mobiliLiberi || [];
  const out = [];
  if (manca.includes('gola') && golaProgetto(progetto).base && mob.some((m) => golaSuMobile(progetto, m))) out.push('gola');
  if (manca.includes('regletta') && progetto.autoRegletta !== false && mob.some((m) => { try { return !!infoAngoloCieco(progetto, m); } catch (_) { return false; } })) out.push('regletta');
  if (manca.includes('cassetti')) { try { if (calcolaDistintaCucina(progetto).pezzi.some((p) => /^Fronte cassetto/i.test(p.nome))) out.push('cassetti'); } catch (_) { /* niente */ } }
  return out;
}
/** Esporta solo dopo il «sì» se mancano delle impostazioni. */
const seCompletaCucina = (fn) => async () => { if (await confermaEsportazione(mancantiCucina())) fn(); };

// --------- DISTINTA DI TAGLIO (lista moduli + lista pezzi per tipo) ---------
const NOME_MATERIALE = { carcassa: 'Carcassa', anta: 'Anta/Fronte', schiena: 'Schiena', zoccolo: 'Zoccolo', melaminico: 'Melaminico bianco' };
function mostraDistinta() {
  const { moduli, pezzi, accessori, gruppiOrdine, gruppiModuli, riepilogo } = calcolaDistintaCucina(progetto);
  const corpo = document.getElementById('distinta-corpo');
  if (!moduli.length) {
    corpo.innerHTML = '<div class="riga-3d">Nessun modulo in scena.</div>';
    const ov0 = document.getElementById('distinta-overlay'); if (ov0) ov0.hidden = false;
    return;
  }

  // SEZIONE 1 — moduli da ordinare, per gruppo (colonne, alti, bassi…)
  const gruppiMod = (gruppiModuli || []).map((g) => ({ g, righe: moduli.filter((m) => m.gruppo === g) })).filter((x) => x.righe.length);
  const sezModuli = `
    <h4 class="distinta-sez">Moduli da ordinare</h4>
    <div class="riga-3d" style="margin-bottom:6px">Arrivano già completi (fianchi, fondo, top, schiena e ripiani già tagliati): non sono nella lista dei pezzi.</div>
    ${gruppiMod.map(({ g, righe }) => `
    <div class="distinta-modulo">
      <h5 class="distinta-gruppo">${escHtml(g)}</h5>
      <table class="distinta-tab">
        <thead><tr><th>Modulo</th><th class="n">Misura</th><th class="n">Qtà</th></tr></thead>
        <tbody>${righe.map((m) => `<tr>
          <td>${escHtml(m.nome)}${m.taglio ? ` <span class="dist-warn">⚠ va tagliato a ${m.taglio} mm</span>` : m.fuoriMisura ? ' <span class="dist-warn">⚠ da tagliare</span>' : ''}</td>
          <td class="n">${escHtml(m.misura)}</td>
          <td class="n">${m.quantita}</td></tr>`).join('')}</tbody>
      </table>
    </div>`).join('')}`;

  // SEZIONE 2 — lista pezzi, raggruppata per tipo (ante, reglette, costadi, ...)
  const perGruppo = (gruppiOrdine || []).map((g) => ({ g, righe: pezzi.filter((p) => p.gruppo === g) }))
    .filter((x) => x.righe.length);
  const sezPezzi = `
    <h4 class="distinta-sez">Pezzi da fare</h4>
    <div class="riga-3d" style="margin-bottom:6px">Porte, frontali e parti dei cassetti, più i pezzi in legno aggiunti da noi (costadi, reglette, pannelli, zoccolo), ognuno nel suo gruppo.</div>
    ${perGruppo.map(({ g, righe }) => `
    <div class="distinta-modulo">
      <h5 class="distinta-gruppo">${escHtml(g)}</h5>
      <table class="distinta-tab">
        <thead><tr><th>Pezzo</th><th class="n">Largh.</th><th class="n">Alt./Lung.</th><th class="n">Sp.</th><th>Materiale</th><th class="n">Qtà</th></tr></thead>
        <tbody>${righe.map((p) => `<tr>
          <td>${escHtml(p.nome)}</td>
          <td class="n">${p.larghezza}</td>
          <td class="n">${p.altezza}</td>
          <td class="n">${p.spessore}</td>
          <td>${escHtml(p.materialeNome || NOME_MATERIALE[p.materiale] || p.materiale)}</td>
          <td class="n">${p.quantita}</td></tr>`).join('')}</tbody>
      </table>
    </div>`).join('')}`;

  // SEZIONE 3 — accessori da ordinare (piedini, griglie forno)
  const sezAcc = accessori.length ? `
    <div class="distinta-modulo">
      <h4 class="distinta-sez">Accessori da ordinare</h4>
      <table class="distinta-tab">
        <thead><tr><th>Accessorio</th><th class="n">Qtà</th></tr></thead>
        <tbody>${accessori.map((a) => `<tr><td>${escHtml(a.nome)}</td><td class="n">${a.quantita}</td></tr>`).join('')}</tbody>
      </table>
      <div class="riga-3d" style="margin-top:6px">Cerniere: 2 per porta (110°, anche la porta bassa delle colonne), 165° sulle porte del pensile angolo 63×63 e del Ciaflan, porta del frigo 4 se più alta di 1,10 m (se no 3). Maniglie: una per porta e frontale dove non c'è il finger-pull né il push. Push: un push pull e una base per ogni porta. Piedini: 4 per modulo a terra (6 oltre 90 cm), una grappa zoccolo per modulo, un angolo per ogni giro a 90° dello zoccolo. Un kit per appendere ogni pensile.</div>
    </div>` : '';

  corpo.innerHTML = htmlAvvisoMancanti(mancantiCucina()) + sezModuli + sezPezzi + sezAcc + `
    <div class="distinta-riepilogo">
      <div><span>Moduli</span><strong>${riepilogo.moduli}</strong></div>
      <div><span>Pezzi da fare</span><strong>${riepilogo.totalePezzi}</strong></div>
      <div><span>m² ante e frontali</span><strong>${riepilogo.mqAnte.toFixed(2)}</strong></div>
      <div><span>m² zoccolo</span><strong>${riepilogo.mqZoccolo.toFixed(2)}</strong></div>
      ${riepilogo.mqMelaminico ? `<div><span>m² melaminico</span><strong>${riepilogo.mqMelaminico.toFixed(2)}</strong></div>` : ''}
      <div><span>Piedini</span><strong>${riepilogo.piedini}</strong></div>
      <div><span>Cerniere</span><strong>${riepilogo.cerniere}</strong></div>
    </div>`;
  const ov = document.getElementById('distinta-overlay');
  if (ov) ov.hidden = false;
}
function chiudiDistinta() { const ov = document.getElementById('distinta-overlay'); if (ov) ov.hidden = true; }
function esportaDistintaCSV() {
  const { moduli, pezzi, accessori } = calcolaDistintaCucina(progetto);
  const tr = (s) => (typeof s === 'string' && window.NGI18N ? window.NGI18N.t(s) : s);
  const qc = (s) => `"${String(tr(s)).replace(/"/g, '""')}"`;
  const righe = [['MODULI DA ORDINARE']];
  righe.push(['Gruppo', 'Modulo', 'Misura', 'Quantita']);
  for (const m of moduli) righe.push([m.gruppo, m.nome + (m.taglio ? ` (va tagliato a ${m.taglio} mm)` : m.fuoriMisura ? ' (da tagliare)' : ''), m.misura, m.quantita]);
  righe.push([]);
  righe.push(['PEZZI DA FARE']);
  righe.push(['Gruppo', 'Pezzo', 'Larghezza_mm', 'Altezza_mm', 'Spessore_mm', 'Materiale', 'Quantita']);
  for (const p of pezzi) righe.push([p.gruppo, p.nome, p.larghezza, p.altezza, p.spessore, p.materialeNome || p.materiale, p.quantita]);
  if (accessori.length) {
    righe.push([]);
    righe.push(['ACCESSORI DA ORDINARE']);
    righe.push(['Accessorio', 'Quantita']);
    for (const a of accessori) righe.push([a.nome, a.quantita]);
  }
  const csv = righe.map((r) => r.map(qc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `distinta-cucina-${nomeFileData()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Pezzi della distinta nel formato comune del "Modello Excel".
const NOMI_MAT_CUCINA = { carcassa: 'Carcassa', anta: 'Ante / frontali', schiena: 'Schiena',
  zoccolo: 'Zoccolo', melaminico: 'Melaminico bianco' };
function pezziPerModello() {
  const { pezzi } = calcolaDistintaCucina(progetto);
  return pezzi.map((p) => ({ nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore,
    quantita: p.quantita, materiale: p.materialeNome || NOMI_MAT_CUCINA[p.materiale] || p.materiale, modulo: '', gruppo: p.gruppo }));
}
function esportaDistintaExcel() {
  esportaExcel(pezziPerModello(), { nomeFile: `distinta-cucina-${nomeFileData()}`, progetto: progetto.nome || 'Cucina' });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Mostra/nasconde pianta 2D vs vista 3D e tiene aggiornata la scena
async function aggiornaVista() {
  const in3d = progetto.stepCorrente === P_3D;
  svg.style.display = in3d ? 'none' : '';
  canvas3d.hidden = !in3d;
  if (legenda3d) legenda3d.textContent = in3d
    ? 'Vista 3D · trascina per ruotare'
    : 'Griglia 100 mm · tutte le misure in mm';
  if (!in3d) return;
  try {
    const eraCaricato = !!scena3dMod;
    // prima i materiali (già in caricamento per la tavolozza), poi il 3D: due
    // caricamenti in parallelo dello stesso file fanno partire il 3D prima dei
    // materiali su Safari (iPhone) → "Impossibile avviare la vista 3D"
    if (!scena3dMod) scena3dMod = await caricaScena3d();
    if (!scena3dMontata) {
      scena3dMod.montaScena3d(canvas3d, progetto); scena3dMontata = true;
      // CUCINA DI ESEMPIO: si apre con la stessa inquadratura della sua foto nella galleria
      // (anche la copia per un cliente, la prima volta; poi la vista è libera)
      const vf = progetto.vistaFoto;
      if (Array.isArray(vf) && vf.length === 6) {
        setTimeout(() => { try { scena3dMod.guardaDa(...vf); } catch (_) { /* niente */ } }, 400);
        if (!progetto.esempioInModifica) { delete progetto.vistaFoto; salvaProgetto(progetto); }
      }
    }
    else { scena3dMod.aggiornaScena3d(progetto, false, step2.mobSelId); } // niente reframe: tiene la vista dove sei
    // Al primo caricamento del modulo 3D ri-render del pannello, così le liste
    // che vengono dal modulo (colori ante/zoccolo) compaiono subito.
    if (!eraCaricato) renderPannello();
    // Dopo lo "unhide" il canvas ha la dimensione giusta solo al frame dopo
    requestAnimationFrame(() => scena3dMod.forzaResize3d());
  } catch (e) {
    console.error('Errore vista 3D:', e);
    avvisoVista3d(e);
  }
}
/** La vista 3D non parte (o si è fermata): il motivo tecnico e "Riprova". */
function avvisoVista3d(e) {
  const motivo = String((e && (e.message || e)) || '').slice(0, 180);
  document.getElementById('avviso-3d')?.remove();
  pannello.insertAdjacentHTML('afterbegin', `<section id="avviso-3d"><div class="avviso-pannello">Impossibile avviare la vista 3D su questo dispositivo.
    ${motivo ? `<div class="avviso-dettaglio" data-no-i18n>${escHtml(motivo)}</div>` : ''}
    <button type="button" class="btn-ghost" id="riprova-3d" style="margin-top:8px;width:100%">↻ Riprova</button></div></section>`);
  document.getElementById('riprova-3d')?.addEventListener('click', () => location.reload());
}
// la scheda grafica ha fermato la vista 3D (memoria del telefono): avviso + Riprova
window.addEventListener('ng-3d-perso', () => avvisoVista3d({ message: 'WebGL context lost' }));
window.addEventListener('ng-3d-ripreso', () => document.getElementById('avviso-3d')?.remove());

// --------- AGGIORNA (render completo + autosalvataggio) ---------
function disegna() {
  const st = progetto.stepCorrente;
  if (st !== P_3D) {
    renderPianta(svg, progetto, {
      pareteAttivaId: st === 2 ? step2.pareteAttivaId : null,
      pareteSelId: st === 1 ? pareteSelId : null,
      mobSelId: step2.mobSelId,
      multiSel: (st === 2 || st === 3 || st === P_ACC) ? step2.multiSel : [],
      manoLibera: st === 1 && manoLibera,
      aggiunta: aggiuntaParete,
      verticeSel,
      viewBoxFisso: vbFisso,
      anteprima: anteprimaML,
      interattivo: st === 2 || st === 3 || st === P_ACC,
      livelloAttivo: (st === 2 || st === 3) ? livelloStep() : null,
      // ACCESSORI: si vedono e si spostano solo al passo Accessori (gli altri mobili restano fermi)
      oggetti: st === P_ACC ? 'attivi' : 'nascosti',
      // TETTO SÌ: alla Pianta e agli Accessori (dove si mettono le lampade) si vede tutto il soffitto
      conSoffitto: st === 1 || st === P_ACC,
      nascondiLivello: (st === 2 || st === 3) && nascondiAltro[livelloStep()] ? (livelloStep() === 'basso' ? 'alto' : 'basso') : null,
    });
  }
  aggiornaBottoneLivello();
}
// NASCONDI L'ALTRO LIVELLO: nei mobili bassi si possono nascondere gli alti, nei mobili alti i bassi
// (per vedere bene cosa si sta facendo). La scelta resta su questo dispositivo.
function aggiornaBottoneLivello() {
  const b = document.getElementById('btn-altro-livello');
  if (!b) return;
  const st = progetto.stepCorrente;
  b.hidden = !(st === 2 || st === 3);
  if (b.hidden) return;
  const liv = livelloStep(), nasc = !!nascondiAltro[liv];
  const stato = liv + nasc;
  if (b.dataset.stato === stato) return;          // testo già giusto (e già tradotto)
  b.dataset.stato = stato;
  b.textContent = liv === 'basso' ? (nasc ? '👁 Mostra alti' : '👁 Nascondi alti') : (nasc ? '👁 Mostra bassi' : '👁 Nascondi bassi');
  b.classList.toggle('attivo', nasc);
}
document.getElementById('btn-altro-livello')?.addEventListener('click', () => {
  const liv = livelloStep();
  nascondiAltro[liv] = !nascondiAltro[liv];
  try { localStorage.setItem('ng-cucina-nascondi', JSON.stringify(nascondiAltro)); } catch (_) { /* va bene anche senza */ }
  disegna();
});
// ---------------------------------------------------------------------------
// CUCINA DI ESEMPIO IN MODIFICA (dalla galleria, «Modifica l'esempio»): barra in alto con
// «Salva come predefinito». Si salva la cucina com'è e la FOTO della galleria = la vista 3D
// in quel momento (prima si gira la vista come piace). Gli esempi del sito restano com'erano:
// la galleria mostra la versione salvata qui (esempi-dati.js).
// ---------------------------------------------------------------------------
let _ultimoEsempioSalvato = null;
function barraEsempio() {
  const es = progetto.esempioInModifica;
  let el = document.getElementById('barra-esempio');
  if (!es) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'barra-esempio'; el.className = 'barra-esempio';
    document.querySelector('.app-header')?.after(el);
    _ultimoEsempioSalvato = JSON.stringify(progetto);
  }
  el.innerHTML = `<span class="barra-esempio-testo">✏️ Stai modificando la cucina di esempio «<b data-no-i18n>${escHtml(es.nome || '')}</b>». La foto della galleria sarà la vista 3D di quando salvi.</span>
    <span class="barra-esempio-bottoni"><button type="button" id="es-salva" class="btn-oro">💾 Salva come predefinito</button>
    <button type="button" id="es-esci" class="btn-ghost">Esci</button></span>
    <span class="barra-esempio-msg" id="es-msg" hidden></span>`;
  el.querySelector('#es-salva').addEventListener('click', salvaComeEsempio);
  el.querySelector('#es-esci').addEventListener('click', () => {
    if (JSON.stringify(progetto) !== _ultimoEsempioSalvato
      && !confirm('Uscire senza salvare le modifiche a questa cucina di esempio?')) return;
    _uscitaEsempio = true;
    resetProgetto();
    location.href = 'esempi.html';
  });
}
let _uscitaEsempio = false;
/**
 * La FOTO per la galleria delle cucine: la vista 3D com'è adesso (se non era aperta, la apro e aspetto
 * che sia pronta). 16:10 al centro, grande 1600 e anteprima 480. Ricorda anche la vista (vistaFoto).
 */
async function fotoPerGalleria() {
  let attesa = 0;
  if (progetto.stepCorrente !== P_3D) { progetto.stepCorrente = P_3D; aggiorna(); attesa = 4500; }
  const S = await caricaScena3d();
  if (attesa) await new Promise((r) => setTimeout(r, attesa));
  let cv = null;
  for (let k = 0; k < 20 && !cv; k++) {
    try { cv = S && S.fotoRealistica3d ? await S.fotoRealistica3d({ larghezza: 1600 }) : null; } catch (_) { cv = null; }
    if (!cv) await new Promise((r) => setTimeout(r, 500));
  }
  let grande = null, mini = null;
  if (cv) {
    const W = cv.width, H0 = cv.height, Hc = Math.min(H0, Math.round(W / 1.6)), Wc = Math.min(W, Math.round(Hc * 1.6));
    const c1 = document.createElement('canvas'); c1.width = Wc; c1.height = Hc;
    c1.getContext('2d').drawImage(cv, (W - Wc) / 2, (H0 - Hc) / 2, Wc, Hc, 0, 0, Wc, Hc);
    const c2 = document.createElement('canvas'); c2.width = 480; c2.height = Math.round(Hc * 480 / Wc);
    c2.getContext('2d').drawImage(c1, 0, 0, c2.width, c2.height);
    grande = await new Promise((r) => c1.toBlob(r, 'image/jpeg', 0.86));
    mini = await new Promise((r) => c2.toBlob(r, 'image/jpeg', 0.8));
  }
  try { const v = S && S.vistaAttuale ? S.vistaAttuale() : null; if (v) progetto.vistaFoto = v; } catch (_) { /* niente */ }
  return { cv, grande, mini };
}

// ---------------------------------------------------------------------------
// ⭐ SALVA COME PROGETTO PREDEFINITO: la cucina aperta diventa un progetto da cui partire, nella
// galleria «Cucine di esempio» (i miei progetti, prima degli esempi del sito). Quante volte si vuole.
// ---------------------------------------------------------------------------
function montaBtnPredefinito() {
  const posto = document.querySelector('.header-strumenti');
  if (!posto || document.getElementById('btn-predefinito')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-predefinito'; b.className = 'ngp-btn'; b.title = 'Salva come progetto predefinito';
  b.innerHTML = '<span aria-hidden="true">⭐</span><span class="ngp-txt">Predefinito</span>';
  posto.insertBefore(b, document.getElementById('tema-toggle'));
  b.addEventListener('click', finestraPredefinito);
}
function finestraPredefinito() {
  const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  document.getElementById('pred-modale')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pred-modale'; ov.className = 'modale-fondo';
  ov.innerHTML = `<div class="modale" role="dialog" aria-modal="true" style="max-width:460px">
    <h3>⭐ Salva come progetto predefinito</h3>
    <div class="riga-3d" style="margin-bottom:10px">La cucina aperta diventa un progetto da cui partire: la trovi nei progetti delle cucine (<b>Cucine di esempio</b>), prima degli esempi. Da lì la usi per un cliente quando vuoi; la cucina di adesso resta com'è. La foto è la vista 3D di quando salvi: prima gira la vista come preferisci.</div>
    <label class="riga-3d" style="display:block;margin-bottom:8px">Nome del progetto<br>
      <input type="text" id="pred-nome" maxlength="80" autocomplete="off" placeholder="${escHtml(tt('es. Cucina a L rovere e nero'))}" style="width:100%;padding:10px;border-radius:8px;border:1px solid #4a4030;background:#0d0a06;color:#fff;font:16px inherit"></label>
    <label class="riga-3d" style="display:block;margin-bottom:12px">Descrizione (facoltativa)<br>
      <textarea id="pred-desc" rows="2" maxlength="240" style="width:100%;padding:10px;border-radius:8px;border:1px solid #4a4030;background:#0d0a06;color:#fff;font:15px inherit;resize:vertical"></textarea></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn-oro" id="pred-salva" style="flex:1">⭐ Salva</button>
      <button type="button" class="btn-ghost" id="pred-annulla">Annulla</button>
    </div>
    <div class="riga-3d" id="pred-msg" hidden style="margin-top:10px"></div>
  </div>`;
  document.body.appendChild(ov);
  const chiudi = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) chiudi(); });
  ov.querySelector('#pred-annulla').addEventListener('click', chiudi);
  const nome = ov.querySelector('#pred-nome'), msg = ov.querySelector('#pred-msg'), bS = ov.querySelector('#pred-salva');
  setTimeout(() => nome.focus(), 50);
  bS.addEventListener('click', async () => {
    const n = nome.value.trim();
    if (!n) { msg.hidden = false; msg.style.color = '#ff9b8c'; msg.textContent = tt('Scrivi il nome del progetto.'); nome.focus(); return; }
    bS.disabled = true; bS.textContent = tt('Preparo la foto…'); msg.hidden = true;
    try {
      const { cv, grande, mini } = await fotoPerGalleria();
      await salvaProgettoPredefinito({ nome: n, desc: ov.querySelector('#pred-desc').value, tipo: MODO_CUCINA === 'ponte' ? 'cucinaPonte' : 'cucina', progetto, grande, mini });
      salvaProgetto(progetto);
      msg.hidden = false; msg.style.color = '#9fd49f';
      msg.innerHTML = `✓ ${escHtml(tt('Aggiunta ai progetti delle cucine:'))} «<span data-no-i18n>${escHtml(n)}</span>».${cv ? '' : ' ' + escHtml(tt('(Senza foto: il 3D non era pronto.)'))}
        <br><a href="esempi.html" style="color:var(--oro-chiaro,#e8c25a);font-weight:600">${escHtml(tt('Vai alle cucine di esempio →'))}</a>`;
      bS.textContent = tt('✓ Salvata'); 
    } catch (e) {
      msg.hidden = false; msg.style.color = '#ff9b8c'; msg.textContent = tt('Non sono riuscito a salvare:') + ' ' + (e.message || e);
      bS.disabled = false; bS.textContent = tt('⭐ Salva');
    }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montaBtnPredefinito); else montaBtnPredefinito();

async function salvaComeEsempio() {
  const es = progetto.esempioInModifica;
  if (!es) return;
  const b = document.getElementById('es-salva'), msg = document.getElementById('es-msg');
  b.disabled = true; const et = b.textContent; b.textContent = '…';
  try {
    const { cv, grande, mini } = await fotoPerGalleria();
    await salvaEsempioModificato(es.id, progetto, grande, mini);
    _ultimoEsempioSalvato = JSON.stringify(progetto);
    msg.hidden = false;
    msg.textContent = cv ? '✓ Salvata come predefinita: nella galleria c\'è la tua versione.'
      : '✓ Salvata come predefinita (la foto della galleria resta quella di prima).';
  } catch (e) {
    msg.hidden = false; msg.textContent = 'Non sono riuscito a salvare: ' + (e.message || e);
  } finally { b.disabled = false; b.textContent = et; }
}

function aggiorna() {
  correggiLatoInterno(progetto);      // lato interno delle pareti sempre verso l'interno della forma
  riorientaMobili(progetto);          // ante sempre verso l'interno (a parete)
  sincronizzaFrigo(progetto);         // costadi del frigo alti fino al mobile sopra (anche nella distinta)
  togliAltiDentroColonne(progetto);   // pensili / ponte rimasti dentro una colonna: la colonna prende il loro posto
  if (progetto.autoRegletta !== false) applicaRegletteAngolo(progetto);  // angolo cieco: apre il gap della regletta (solo se auto attiva)
  renderStepper();
  renderPannello();
  renderRiepilogo();
  renderPalette();
  disegna();
  aggiornaVista();
  aggiornaBottoniStoria();
  if (typeof aggiornaBtnStampa === 'function') aggiornaBtnStampa();
  if (!_uscitaEsempio) salvaProgetto(progetto);
  barraEsempio();
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
    lavatrice: '<rect x="8" y="6" width="48" height="52"/><line x1="8" y1="18" x2="56" y2="18"/><circle cx="32" cy="38" r="13"/><circle cx="32" cy="38" r="7"/><rect x="38" y="9" width="12" height="5" rx="1"/><circle cx="16" cy="12" r="1.8"/>',
    pensile: '<rect x="8" y="14" width="48" height="36"/><line x1="32" y1="14" x2="32" y2="50"/><line x1="26" y1="28" x2="26" y2="36"/><line x1="38" y1="28" x2="38" y2="36"/>',
    'pensile-angolo': '<path d="M8 8 H30 V30 H56 V56 H8 Z" fill="none"/><line x1="18" y1="16" x2="18" y2="24"/><line x1="44" y1="40" x2="44" y2="48"/>',
    'base-angolo': '<path d="M8 8 H30 V30 H56 V56 H8 Z" fill="none"/><line x1="12" y1="44" x2="26" y2="44"/><line x1="36" y1="34" x2="50" y2="34"/>',
    'pensile-angolo-45': '<path d="M10 10 H54 V54 H10 Z" fill="none"/><line x1="10" y1="34" x2="34" y2="54"/><line x1="20" y1="40" x2="28" y2="48"/>',
    colonna: '<rect x="18" y="4" width="28" height="56"/><line x1="18" y1="40" x2="46" y2="40"/><line x1="40" y1="20" x2="40" y2="26"/><line x1="40" y1="48" x2="40" y2="54"/>',
    'colonna-misura': '<rect x="22" y="4" width="24" height="56"/><line x1="22" y1="40" x2="46" y2="40"/><line x1="40" y1="20" x2="40" y2="26"/><line x1="40" y1="48" x2="40" y2="54"/><line x1="10" y1="4" x2="10" y2="60"/><line x1="7" y1="8" x2="10" y2="4"/><line x1="13" y1="8" x2="10" y2="4"/><line x1="7" y1="56" x2="10" y2="60"/><line x1="13" y1="56" x2="10" y2="60"/>',
    regletta: '<polyline points="16,8 16,48 56,48" fill="none" stroke-width="7"/><polyline points="16,8 26,8 26,38 56,38 56,48" fill="none"/>',
    'regletta-grande': '<rect x="28" y="4" width="8" height="56"/><line x1="22" y1="4" x2="28" y2="8"/><line x1="22" y1="60" x2="28" y2="56"/>',
    'pannello-copertura': '<rect x="6" y="14" width="52" height="36"/><line x1="12" y1="20" x2="52" y2="20" stroke-dasharray="3 3"/><line x1="12" y1="44" x2="52" y2="44" stroke-dasharray="3 3"/>',
    'piano-tavolo': '<rect x="4" y="18" width="56" height="7"/><rect x="51" y="25" width="7" height="33"/><rect x="8" y="25" width="22" height="33" stroke-dasharray="3 3"/>',
    costado: '<rect x="26" y="6" width="12" height="52"/><line x1="20" y1="6" x2="26" y2="10"/><line x1="20" y1="54" x2="26" y2="58"/>',
    frigo: '<rect x="14" y="4" width="36" height="56" rx="3"/><line x1="14" y1="38" x2="50" y2="38"/><line x1="43" y1="12" x2="43" y2="24"/><line x1="43" y1="44" x2="43" y2="52"/>',
    ponte: '<rect x="4" y="8" width="12" height="50"/><rect x="48" y="8" width="12" height="50"/><rect x="16" y="8" width="32" height="12"/><line x1="32" y1="8" x2="32" y2="20"/><line x1="16" y1="58" x2="48" y2="58" stroke-dasharray="3 3"/>',
    'sopra-frigo': '<rect x="10" y="6" width="44" height="14"/><line x1="32" y1="6" x2="32" y2="20"/><rect x="14" y="24" width="36" height="34" rx="3" stroke-dasharray="4 3"/>',
    sgabello: '<ellipse cx="32" cy="16" rx="13" ry="6"/><path d="M22 14 a10 8 0 0 1 20 0" fill="none"/><line x1="32" y1="22" x2="32" y2="48"/><ellipse cx="32" cy="52" rx="16" ry="5"/><ellipse cx="32" cy="40" rx="10" ry="3" fill="none"/>',
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${ic[id] || ic['base-ante']}</svg>`;
}

function renderPalette() {
  palette.hidden = !(progetto.stepCorrente === 2 || progetto.stepCorrente === 3);
  if (palette.hidden) return;
  const livello = livelloStep();
  // Il costado si può aggiungere sia nei bassi che negli alti
  const voci = CATALOGO_MOBILI.filter((t) => (t.categoria === 'costado' || livelloMobile(t.categoria) === livello)
    && (t.id !== 'ponte' || cucinaPonte()));          // il Ponte solo nella cucina a ponte
  // OGGETTI del catalogo (creati dalle foto): si posano sul piano o a terra
  const oggetti = [];        // gli OGGETTI si aggiungono al passo Accessori (e nel rendering)
  palette.innerHTML = voci.map((t) => `
    <button type="button" class="palette-btn" data-tipo="${t.id}">
      ${iconaMobile(t.id)}<span>${t.nome}</span>
    </button>`).join('') + oggetti.map((o) => `
    <button type="button" class="palette-btn palette-ogg" data-ogg="${o.id}" title="${escHtml(o.nome)}">
      <span class="palette-ogg-img" style="background-image:url('${o.thumb}')"></span><span data-no-i18n>${escHtml(o.nome)}</span>
    </button>`).join('');
  palette.querySelectorAll('.palette-btn[data-tipo]').forEach((b) => {
    b.addEventListener('click', () => apriScelta(b.dataset.tipo));
  });
  palette.querySelectorAll('.palette-btn[data-ogg]').forEach((b) => b.addEventListener('click', () => {
    const o = oggetti.find((x) => x.id === b.dataset.ogg); if (!o) return;
    registraStoria();
    step2.mobSelId = aggiungiMobileLibero(progetto, `ogg:${o.id}`, { larghezza_mm: o.misure.w, profondita_mm: o.misure.d, altezza_mm: o.misure.h });
    aggiorna();
  }));
}
// catalogo (oggetti creati dalle foto) per la tavolozza
var matMod = null;      // (var: usabile anche prima di questa riga, mentre si carica)
var _materialiPromessa = null, _scena3dPromessa = null;
/** Il modulo dei materiali, caricato UNA volta sola (lo usa anche la vista 3D). */
function caricaMateriali() {
  if (!_materialiPromessa) _materialiPromessa = import('../materiali.js?v=20261124n');
  return _materialiPromessa;
}
/** Il modulo della vista 3D, caricato UNA volta sola e DOPO i materiali (se fallisce si può riprovare). */
function caricaScena3d() {
  if (!_scena3dPromessa) {
    _scena3dPromessa = caricaMateriali().catch(() => null).then(() => import('./scena3d.js?v=20261124n'));
    _scena3dPromessa.catch(() => { _scena3dPromessa = null; });
  }
  return _scena3dPromessa;
}
caricaMateriali().then((m) => {
  matMod = m;
  if (progetto.stepCorrente === 2) renderPalette();
  if (progetto.stepCorrente === P_ACC || progetto.stepCorrente === P_3D) renderPannello();
}).catch(() => {});

/**
 * MOBILE SOPRA FRIGO: "Distanza dal frigo". Cambiandola il mobile sale o
 * scende, e TUTTI i moduli alti (pensili, altri mobili sopra frigo) vanno alla
 * sua stessa cima. "Automatica" = a filo con i costadi / le colonne accanto.
 */
/**
 * COLORI DEL PONTE: i moduli profondi (ponte), i pensili sotto (meno profondi)
 * e il pannello che li divide possono avere ognuno il suo colore.
 */
const PARTI_PONTE = [
  { k: 'ponte', nome: 'Ponte (profondo)', come: 'Come le colonne' },
  { k: 'pensili', nome: 'Pensili sotto', come: 'Come i pensili' },
  { k: 'pannello', nome: 'Pannello', come: 'Come il ponte' },
];
function htmlColoriPonte() {
  if (!cucinaPonte() || !(progetto.mobiliLiberi || []).some((o) => o.tipo === 'ponte')) return '';
  const mod = matMod || scena3dMod;
  const lista = mod && mod.materialiPer ? mod.materialiPer('legno') : [];
  const cp = progetto.coloriPonte || {};
  const parte = PARTI_PONTE.find((x) => x.k === step2.parteColorePonte) || PARTI_PONTE[0];
  const nomeDi = (id) => (lista.find((x) => x.id === id) || {}).nome;
  return `
    <section class="step3-pannello">
      <h3>Colori del ponte</h3>
      <div class="riga-3d" style="margin-bottom:6px">${PARTI_PONTE.map((x) => `${x.nome}: <strong>${cp[x.k] ? (nomeDi(cp[x.k]) || '—') : x.come.toLowerCase()}</strong>`).join(' · ')}</div>
      <div class="opzioni-anta">
        ${PARTI_PONTE.map((x) => `<button type="button" class="btn-ghost opt-parteponte ${x.k === parte.k ? 'attivo' : ''}" data-parteponte="${x.k}">${x.k === parte.k ? '✓ ' : ''}${x.nome}</button>`).join('')}
      </div>
      <div style="margin-top:8px">${htmlTendineColori(lista,
        (mt) => `<button type="button" class="swatch ${mt.id === cp[parte.k] ? 'sel' : ''}" data-colponte="${mt.id}" title="${mt.nome}" style="background-image:url('${mt.thumb}')"></button>`,
        { sel: cp[parte.k] || null, chiave: `cucina-ponte-${parte.k}`,
          prima: `<button type="button" class="swatch swatch-none ${!cp[parte.k] ? 'sel' : ''}" data-colponte="" title="${parte.come}">—</button>` })}</div>
      <div class="riga-3d" style="margin-top:4px">«—» = ${parte.come.toLowerCase()}.</div>
    </section>`;
}
// COLORE DELLE MANIGLIE (come il rubinetto): ogni maniglia, anche quelle aggiunte in Impostazioni,
// si può fare in tutti i colori. «Il suo colore» = quello di sempre della maniglia scelta.
function htmlColoreManiglia(sel, attr) {
  const v = sel || '';
  return `
      <div class="riga-3d" style="margin:10px 0 6px">Maniglia · colore</div>
      <div class="palette-zoccolo">
        <button type="button" class="swatch-zocc ${!v ? 'sel' : ''}" data-${attr}="" title="Il suo colore" style="background:repeating-linear-gradient(135deg,#d9d9d9 0 6px,#8a8a8a 6px 12px)"></button>
          <span class="et-zocc">Il suo colore</span>
        ${FINITURE_MANIGLIA.map((f) => `<button type="button" class="swatch-zocc ${v === f.id ? 'sel' : ''}" data-${attr}="${f.id}" title="${f.nome}" style="background:${f.css}"></button>
          <span class="et-zocc">${f.nome}</span>`).join('')}
      </div>`;
}
// PORTE DEL PONTE: porta normale o finger-pull, maniglia o push (e quale maniglia), per il
// ponte e per i pensili sotto, indipendenti dal resto. Finché non si sceglie: come colonne / pensili.
const PARTI_PORTE_PONTE = [
  { k: 'ponte', nome: 'Ponte (profondo)', segue: 'colonna', come: 'come le colonne' },
  { k: 'pensiliPonte', nome: 'Pensili sotto', segue: 'pensile', come: 'come i pensili' },
];
function htmlPortePonte(parteFissa = null) {
  if (!parteFissa && step2.partePortePonte == null) step2.partePortePonte = 'ponte';
  const parte = PARTI_PORTE_PONTE.find((x) => x.k === (parteFissa || step2.partePortePonte)) || PARTI_PORTE_PONTE[0];
  const sc = sceltePorteGruppo(progetto, parte.k, parte.segue);
  const man = !sc.fp && !sc.push;
  const mod = matMod || scena3dMod;
  const lista = mod && mod.materialiPer ? mod.materialiPer('maniglie') : [];
  const sel = sc.maniglia || 'maniglia-standard';
  const v = (on, testo) => `${on ? '✓ ' : ''}${testo}`;
  return `
    <section class="step3-pannello" data-porte-ponte="${parte.k}">
      <h3>Porte del ponte${parteFissa ? ` · ${parte.nome}` : ''}</h3>
      <div class="riga-3d" style="margin-bottom:6px">Il ponte e i pensili sotto hanno le loro scelte, indipendenti dal resto della cucina.</div>
      ${parteFissa ? '' : `
      <div class="opzioni-anta">
        ${PARTI_PORTE_PONTE.map((x) => `<button type="button" class="btn-ghost opt-parteporte ${x.k === parte.k ? 'attivo' : ''}" data-parteporte="${x.k}">${v(x.k === parte.k, x.nome)}</button>`).join('')}
      </div>`}
      <div class="riga-3d" style="margin:8px 0 4px">Porta</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-fpponte ${!sc.fp ? 'attivo' : ''}" data-fpponte="0">${v(!sc.fp, 'Normale')}</button>
        <button type="button" class="btn-ghost opt-fpponte ${sc.fp ? 'attivo' : ''}" data-fpponte="1">${v(sc.fp, 'Finger-pull')}</button>
      </div>
      <div class="riga-3d" style="margin:8px 0 4px">Apertura</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-pushponte ${!sc.push ? 'attivo' : ''}" data-pushponte="0">${v(!sc.push, 'Maniglia')}</button>
        <button type="button" class="btn-ghost opt-pushponte ${sc.push ? 'attivo' : ''}" data-pushponte="1">${v(sc.push, 'Push')}</button>
      </div>
      ${sc.push ? '<div class="riga-3d" style="margin-top:6px">Push: si preme e si apre. In distinta un push pull e una base per ogni porta.</div>' : ''}
      ${man && lista.length > 1 ? `
      <div class="riga-3d" style="margin:10px 0 6px">Maniglia</div>
      <div class="palette-colori">
        ${lista.map((mt) => `<button type="button" class="swatch ${mt.id === sel ? 'sel' : ''}" data-manponte="${mt.id}" title="${mt.nome}"
          style="background:${mod.sfondoSwatch(mt)}"></button>`).join('')}
      </div>` : ''}
      ${man ? htmlColoreManiglia(sc.coloreManiglia, 'mancolponte') : ''}
      ${sc.proprie
        ? `<button type="button" class="btn-ghost porte-ponte-reset" style="margin-top:8px;width:100%">↺ Torna ${parte.come}</button>`
        : `<div class="riga-3d" style="margin-top:6px">Per ora ${parte.come}: tocca una scelta per cambiarla solo qui.</div>`}
    </section>`;
}
function agganciaPortePonte(root) {
  const sezione = root.querySelector('[data-porte-ponte]');
  if (!sezione) return;
  const k = sezione.dataset.portePonte;
  sezione.querySelectorAll('.opt-parteporte').forEach((b) => b.addEventListener('click', () => { step2.partePortePonte = b.dataset.parteporte; renderPannello(); }));
  sezione.querySelectorAll('.opt-fpponte').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (typeof progetto.fingerPull !== 'object' || progetto.fingerPull === null) {   // vecchio sì/no per tutto → per gruppo
      const old = progetto.fingerPull === true;
      progetto.fingerPull = { base: old, pensile: old, colonna: old };
    }
    progetto.fingerPull[k] = b.dataset.fpponte === '1';
    aggiorna();
  }));
  sezione.querySelectorAll('.opt-pushponte').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.push = { ...(progetto.push || {}), [k]: b.dataset.pushponte === '1' };
    aggiorna();
  }));
  sezione.querySelectorAll('[data-manponte]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    progetto.maniglie = { ...(progetto.maniglie || {}), [k]: b.dataset.manponte };
    aggiorna();
  }));
  sezione.querySelectorAll('[data-mancolponte]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    const o = { ...(progetto.coloriManiglie || {}) };
    // «il suo colore» sul ponte: scelto apposta (non segue più il colore delle colonne)
    o[k] = b.dataset.mancolponte || 'originale';
    progetto.coloriManiglie = o;
    aggiorna();
  }));
  sezione.querySelector('.porte-ponte-reset')?.addEventListener('click', () => {
    registraStoria();
    for (const chiave of ['fingerPull', 'push', 'maniglie', 'coloriManiglie']) {
      if (progetto[chiave] && typeof progetto[chiave] === 'object') { const o = { ...progetto[chiave] }; delete o[k]; progetto[chiave] = o; }
    }
    aggiorna();
  });
}
function agganciaColoriPonte(root) {
  root.querySelectorAll('.opt-parteponte').forEach((b) => b.addEventListener('click', () => { step2.parteColorePonte = b.dataset.parteponte; renderPannello(); }));
  root.querySelectorAll('[data-colponte]').forEach((b) => b.addEventListener('click', () => {
    const parte = (PARTI_PONTE.find((x) => x.k === step2.parteColorePonte) || PARTI_PONTE[0]).k;
    registraStoria();
    const cp = { ...(progetto.coloriPonte || {}) };
    if (b.dataset.colponte) cp[parte] = b.dataset.colponte; else delete cp[parte];
    progetto.coloriPonte = cp;
    aggiorna();
  }));
}

/**
 * PENSILE SOTTO IL PONTE: altezza a scelta (30…90 o a mano); il ponte sopra si
 * adatta, così la cima e lo spazio sul piano restano uguali. Vale per la fila.
 */
function htmlPensileSottoPonte(m) {
  if (categoriaTipo(m.tipo) !== 'pensile') return '';
  const sopra = pontiSopra(progetto, m);
  if (!sopra.length) return '';
  const h = m.altezza_mm || 700, hp = sopra[0].altezza_mm || 360;
  return `
    <section class="step3-pannello">
      <h3>Pensile sotto il ponte</h3>
      <div class="riga-3d" style="margin-bottom:6px">Pensile <strong>${h / 10} cm</strong> · ponte sopra <strong>${(hp / 10).toLocaleString('it-IT')} cm</strong>. Cambiando il pensile, il <strong>ponte si adatta</strong> (stessa altezza totale, stesso spazio sul piano). Vale per tutta la fila del ponte.</div>
      <div class="orienta-row" style="flex-wrap:wrap">
        ${[300, 400, 500, 600, 700, 800, 900].map((v) => `<button type="button" class="btn-ghost pens-ponte ${v === h ? 'attivo' : ''}" data-ph="${v}">${v === h ? '✓ ' : ''}${v / 10}</button>`).join('')}
      </div>
      <div class="ra-campi" style="margin-top:8px">
        <label>Altezza pensile (mm)<input id="pens-ponte-h" type="number" value="${h}" min="100" step="1" inputmode="numeric"></label>
      </div>
      <button type="button" id="pens-ponte-ok" class="btn-oro" style="width:100%;margin-top:6px">Cambia altezza</button>
    </section>`;
}
function agganciaPensileSottoPonte(root, m) {
  const applica = (v) => {
    v = Math.round(Number(v));
    if (!(v >= 100) || v === (m.altezza_mm || 700)) return;
    registraStoria();
    const r = cambiaPensileSottoPonte(progetto, m, v);
    if (!r.ok) { storiaPast.pop(); alert((window.NGI18N ? window.NGI18N.t : (x) => x)(r.errore)); return; }
    aggiorna();
  };
  root.querySelectorAll('.pens-ponte[data-ph]').forEach((b) => b.addEventListener('click', () => applica(b.dataset.ph)));
  root.querySelector('#pens-ponte-ok')?.addEventListener('click', () => applica(root.querySelector('#pens-ponte-h').value));
  root.querySelector('#pens-ponte-h')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applica(e.target.value); });
}

/**
 * COLONNA: lato di apertura di partenza (sinistra / destra) e, PORTA PER PORTA,
 * le scelte proprie: porta normale o finger-pull, maniglia o push, verso
 * sinistra / destra / alto. "Come le colonne" = la scelta del gruppo.
 */
function porteDellaColonna(m) {
  if (m.variante === 'intera') return [{ k: 'intera', nome: 'Porta intera' }];
  const porte = [{ k: 'bassa', nome: 'Porta bassa' }];
  // porta alta: c'è sempre, tranne forno + microonde senza spazio sopra (come nel 3D: lo decide l'altezza)
  porte.push({ k: 'alta', nome: m.variante === 'forno' ? 'Porta sopra il forno' : m.variante === 'microonde' ? 'Porta sopra il microonde'
    : m.variante === 'forno-micro' ? 'Porticina sopra forno e microonde' : m.variante === 'vano' ? 'Porta sopra il vano' : 'Porta alta' });
  return porte;
}
/**
 * VETRO NELLA COLONNA, scelte rapide: tutta chiusa, porta intera in vetro (da terra in cima),
 * sotto chiusa e sopra in vetro, sotto in vetro e sopra chiusa, tutte e due in vetro.
 * Poi telaio e vetro per tutte le porte in vetro (ogni porta si può ancora cambiare sotto).
 */
function sceltaVetroColonna(m) {
  const pv = (k) => !!(m.porte && m.porte[k] && m.porte[k].vetro);
  if (m.variante === 'intera') return pv('intera') ? 'intera' : 'chiusa';
  const b = pv('bassa'), a = pv('alta');
  return b && a ? 'tutte' : a ? 'sopra' : b ? 'sotto' : 'chiusa';
}
function vetroDiColonna(m) {
  const o = porteDellaColonna(m).map((p) => (m.porte || {})[p.k]).find((p) => p && p.vetro);   // solo le porte che ci sono
  return o ? o.vetro : null;
}
function htmlVetroColonna(m) {
  const s = sceltaVetroColonna(m), v = vetroDiColonna(m);
  const op = (cl, attr, val, et, on) => `<button type="button" class="btn-ghost ${cl} ${on ? 'attivo' : ''}" ${attr}="${val}" style="flex:1;min-width:120px">${on ? '✓ ' : ''}${et}</button>`;
  return `
      <div class="riga-3d" style="margin:12px 0 6px"><strong>Vetrina</strong> (porte in vetro):</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-colvetro', 'data-colvetro', 'chiusa', 'Tutta chiusa', s === 'chiusa')}
        ${op('opt-colvetro', 'data-colvetro', 'intera', 'Porta intera in vetro', s === 'intera')}
        ${op('opt-colvetro', 'data-colvetro', 'sopra', 'Sotto chiusa, sopra in vetro', s === 'sopra')}
        ${op('opt-colvetro', 'data-colvetro', 'sotto', 'Sotto in vetro, sopra chiusa', s === 'sotto')}
        ${op('opt-colvetro', 'data-colvetro', 'tutte', 'Sotto e sopra in vetro', s === 'tutte')}
      </div>
      ${v ? `
      <div class="riga-3d" style="margin:8px 0 6px">Telaio:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-coltel', 'data-coltel', 'legno', 'Come le ante (5 cm)', (v.telaio || 'legno') === 'legno')}
        ${op('opt-coltel', 'data-coltel', 'alluminio', 'Alluminio', v.telaio === 'alluminio')}
        ${op('opt-coltel', 'data-coltel', 'nero', 'Nero', v.telaio === 'nero')}
      </div>
      <div class="riga-3d" style="margin:8px 0 6px">Vetro:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('opt-colvv', 'data-colvv', 'trasparente', 'Trasparente', (v.vetro || 'trasparente') === 'trasparente')}
        ${op('opt-colvv', 'data-colvv', 'satinato', 'Satinato', v.vetro === 'satinato')}
        ${op('opt-colvv', 'data-colvv', 'fume', 'Fumé', v.vetro === 'fume')}
      </div>` : ''}
      ${m.variante === 'intera' ? '<div class="riga-3d" style="margin-top:6px">Porta intera: una sola porta da terra in cima, senza porta bassa.</div>' : ''}`;
}
function htmlAperturaColonna(m) {
  if (categoriaTipo(m.tipo) !== 'colonna') return '';
  const lato = m.antaLato === 'sx' ? 'sx' : 'dx';
  const sel = (k, campo, opzioni) => {
    const v = ((m.porte || {})[k] || {})[campo];
    const val = v == null ? '' : String(v);
    return `<select class="porta-col" data-porta="${k}" data-campo="${campo}" style="width:100%">${opzioni.map(([o, t]) => `<option value="${o}" ${o === val ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  };
  return `
    <section class="step3-pannello">
      <h3>Porte della colonna</h3>
      <div class="riga-3d" style="margin-bottom:6px">Lato di apertura di tutte le porte (dove sta la maniglia):</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-latocol ${lato === 'sx' ? 'attivo' : ''}" data-latocol="sx">${lato === 'sx' ? '✓ ' : ''}← Sinistra</button>
        <button type="button" class="btn-ghost opt-latocol ${lato === 'dx' ? 'attivo' : ''}" data-latocol="dx">${lato === 'dx' ? '✓ ' : ''}Destra →</button>
      </div>
      ${htmlVetroColonna(m)}
      <div class="riga-3d" style="margin:10px 0 4px">Ogni porta può avere le sue scelte (es. la porticina in alto normale con push):</div>
      ${porteDellaColonna(m).map((p) => `
      <div style="border:1px solid var(--bordo,#333);border-radius:8px;padding:8px;margin-top:6px">
        <div style="font-weight:600;margin-bottom:6px">${p.nome}</div>
        <div class="ra-campi">
          <label>Porta${sel(p.k, 'fp', [['', 'Come le colonne'], ['false', 'Normale'], ['true', 'Finger-pull']])}</label>
          <label>Apertura${sel(p.k, 'push', [['', 'Come le colonne'], ['false', 'Maniglia'], ['true', 'Push']])}</label>
          <label>Verso${sel(p.k, 'lato', [['', 'Come la colonna'], ['sx', '← Sinistra'], ['dx', 'Destra →'], ['alto', "↑ Verso l'alto"]])}</label>
        </div>
        ${(() => {
          // PORTA IN VETRO (vetrina), come nei pensili: telaio in legno (vano fresato) o telaio da ordinare
          const v = ((m.porte || {})[p.k] || {}).vetro || null;
          const s2 = (campo, opz, val) => `<select class="porta-vetro" data-porta="${p.k}" data-campo="${campo}" style="width:100%">${opz.map(([o, t]) => `<option value="${o}" ${o === val ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
          return `
        <div class="ra-campi" style="margin-top:6px">
          <label>Anta${s2('telaio', [['', 'Piena'], ['legno', 'Vetrina · telaio come l\'anta'], ['alluminio', 'Vetrina · telaio alluminio'], ['nero', 'Vetrina · telaio nero']], v ? (v.telaio || 'legno') : '')}</label>
          ${v ? `<label>Vetro${s2('tipo', [['trasparente', 'Trasparente'], ['satinato', 'Satinato'], ['fume', 'Fumé']], v.vetro || 'trasparente')}</label>` : ''}
        </div>`;
        })()}
      </div>`).join('')}
    </section>`;
}
function agganciaAperturaColonna(root, m) {
  root.querySelectorAll('.opt-latocol[data-latocol]').forEach((b) => b.addEventListener('click', () => {
    if ((m.antaLato === 'sx' ? 'sx' : 'dx') === b.dataset.latocol) return;
    registraStoria(); m.antaLato = b.dataset.latocol; aggiorna();
  }));
  // VETRINA: scelte rapide (porta intera / sopra / sotto / tutte e due) e telaio + vetro per tutte
  const conVetro = (porte, k, v) => { const o = { ...(porte[k] || {}) }; if (v) o.vetro = { ...v }; else delete o.vetro; if (Object.keys(o).length) porte[k] = o; else delete porte[k]; };
  root.querySelectorAll('.opt-colvetro[data-colvetro]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.colvetro;
    if (s === sceltaVetroColonna(m)) return;
    registraStoria();
    const v = vetroDiColonna(m) || { telaio: 'legno', vetro: 'trasparente' }, porte = { ...(m.porte || {}) };
    if (s === 'intera') m.variante = 'intera';
    else if (s !== 'chiusa' && m.variante === 'intera') m.variante = 'porta';
    conVetro(porte, 'intera', s === 'intera' ? v : null);
    conVetro(porte, 'bassa', s === 'sotto' || s === 'tutte' ? v : null);
    conVetro(porte, 'alta', s === 'sopra' || s === 'tutte' ? v : null);
    if (Object.keys(porte).length) m.porte = porte; else delete m.porte;
    aggiorna();
  }));
  const tuttiIVetri = (campo, val) => {
    registraStoria();
    const porte = { ...(m.porte || {}) };
    for (const k of Object.keys(porte)) if (porte[k] && porte[k].vetro) porte[k] = { ...porte[k], vetro: { ...porte[k].vetro, [campo]: val } };
    m.porte = porte; aggiorna();
  };
  root.querySelectorAll('.opt-coltel[data-coltel]').forEach((b) => b.addEventListener('click', () => tuttiIVetri('telaio', b.dataset.coltel)));
  root.querySelectorAll('.opt-colvv[data-colvv]').forEach((b) => b.addEventListener('click', () => tuttiIVetri('vetro', b.dataset.colvv)));
  root.querySelectorAll('select.porta-col').forEach((el) => el.addEventListener('change', () => {
    registraStoria();
    const k = el.dataset.porta, campo = el.dataset.campo, v = el.value;
    const porte = { ...(m.porte || {}) }, o = { ...(porte[k] || {}) };
    if (v === '') delete o[campo];
    else o[campo] = campo === 'lato' ? v : v === 'true';
    if (Object.keys(o).length) porte[k] = o; else delete porte[k];
    if (Object.keys(porte).length) m.porte = porte; else delete m.porte;
    aggiorna();
  }));
  root.querySelectorAll('select.porta-vetro').forEach((el) => el.addEventListener('change', () => {
    registraStoria();
    const k = el.dataset.porta, campo = el.dataset.campo, v = el.value;
    const porte = { ...(m.porte || {}) }, o = { ...(porte[k] || {}) };
    if (campo === 'telaio') { if (!v) delete o.vetro; else o.vetro = { vetro: 'trasparente', ...(o.vetro || {}), telaio: v }; }
    else if (o.vetro) o.vetro = { ...o.vetro, vetro: v };
    if (Object.keys(o).length) porte[k] = o; else delete porte[k];
    if (Object.keys(porte).length) m.porte = porte; else delete m.porte;
    aggiorna();
  }));
}

/**
 * PIANO / TAVOLO libero: materiale (pietra del piano, legni, colori), appoggio e misure.
 * Entra nell'isola come vuoi: più basso dei moduli (incassato) o a filo del piano (lo attraversa).
 */
function htmlPianoTavolo(m) {
  if (categoriaTipo(m.tipo) !== 'tavolo') return '';
  const mod = matMod || scena3dMod;
  const lista = mod && mod.materialiPer ? mod.materialiPer('pannello') : [];
  const sel = m.materiale || null;
  const nomeSel = sel ? ((lista.find((x) => x.id === sel) || {}).nome || sel) : 'Come il piano della cucina';
  const app = m.appoggio || 'cascata';
  return `
    <section class="step3-pannello" data-aperta>
      <h3>Piano / tavolo</h3>
      <div class="riga-3d">Misure: <strong>${m.larghezza_mm || 1800} × ${m.profondita_mm || 900} mm</strong></div>
      <div class="riga-3d">Spessore: <strong>${(m.strati || 1) > 1 ? `${m.strati} pannelli da ${m.spessore_mm || 40} mm = ${(m.strati) * (m.spessore_mm || 40)} mm` : `${m.spessore_mm || 40} mm`}</strong></div>
      <div class="riga-3d">${m.quota === 'filo' ? 'Altezza: <strong>a filo del piano della cucina</strong>' : `Altezza da terra: <strong>${m.altezza_mm || 750} mm</strong>`}</div>
      <div class="riga-3d" style="margin-bottom:6px">Le misure si cambiano con «Cambia misura».</div>
      <div class="riga-3d" style="margin-bottom:8px">Mettilo DENTRO l'isola: se è più basso dei moduli ci entra (i moduli restano più alti); se è a filo del piano lo attraversa e il piano dell'isola si apre dove passa.</div>
      <div class="riga-3d" style="margin:6px 0">Appoggio dove il piano è libero</div>
      <div class="opzioni-anta">
        ${APPOGGI_TAVOLO.map((a) => `<button type="button" class="btn-ghost opt-tavapp ${a.id === app ? 'attivo' : ''}" data-tavapp="${a.id}">${a.id === app ? '✓ ' : ''}${a.nome}</button>`).join('')}
      </div>
    </section>
    <section class="step3-pannello" data-aperta>
      <h3>Colore del piano / tavolo</h3>
      <div class="riga-3d" style="margin-bottom:6px">Può essere diverso dal piano della cucina: apri un gruppo (Encimere, Legni, Opachi, Lucidi…) e tocca il colore. Vale anche per i fianchi a cascata.</div>
      <div class="riga-3d" style="margin:4px 0 6px">Scelto: <strong>${escHtml(nomeSel)}</strong></div>
      <div class="opzioni-anta" style="margin-bottom:6px">
        <button type="button" class="btn-ghost opt-tavmat0 ${sel ? '' : 'attivo'}" data-tavmat0="1">${sel ? '' : '✓ '}Come il piano della cucina</button>
      </div>
      ${htmlTendineColori(lista, (mt) => `<button type="button" class="swatch ${mt.id === sel ? 'sel' : ''}" data-tavmat="${mt.id}" title="${escHtml(mt.nome)}" style="background-image:url('${mt.thumb}')"></button>`,
        { sel, chiave: 'cucina-piano-tavolo' })}
    </section>`;
}

/**
 * SPESSORE DEL PIANO DI LAVORO: quello del materiale (Compacto 12, R3 Supra 38, nero standard 40…)
 * oppure scelto a mano per questa cucina (12, 20, 30, 40, 60, 80 mm o qualsiasi misura).
 */
function htmlSpessorePiano() {
  const enc = progetto.encimera || {};
  const mod = matMod || scena3dMod;
  const def = enc.materiale && mod && mod.MATERIALI ? mod.MATERIALI.find((x) => x.id === enc.materiale) : null;
  const delMat = def && def.spessore != null ? def.spessore : 40;
  const mano = Number(enc.spessore) > 0 ? Number(enc.spessore) : null;
  const uno = mano || delMat, strati = Math.max(1, Math.min(3, Number(enc.strati) || 1));
  return `
      <div class="riga-3d" style="margin:12px 0 6px">Spessore del piano: <strong>${strati > 1 ? `${strati} pannelli da ${uno} mm = ${strati * uno} mm` : `${uno} mm`}</strong></div>
      <div class="riga-3d" style="margin:4px 0">Pannelli uno sopra l'altro</div>
      <div class="opzioni-anta">
        ${[1, 2, 3].map((v) => `<button type="button" class="btn-ghost opt-strati ${strati === v ? 'attivo' : ''}" data-strati="${v}">${strati === v ? '✓ ' : ''}${v}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin:8px 0 4px">Spessore di un pannello</div>
      <div class="opzioni-anta">
        <button type="button" class="btn-ghost opt-sptop ${mano ? '' : 'attivo'}" data-sptop="">${mano ? '' : '✓ '}Quello del materiale (${delMat} mm)</button>
        ${[12, 16, 19, 20, 30, 40, 60, 80].map((v) => `<button type="button" class="btn-ghost opt-sptop ${mano === v ? 'attivo' : ''}" data-sptop="${v}">${mano === v ? '✓ ' : ''}${v} mm</button>`).join('')}
      </div>
      <label class="riga-3d" style="display:block;margin-top:8px">Altra misura (mm)
        <input type="number" id="sptop-num" class="modale-num" min="6" max="200" step="1" value="${uno}" inputmode="numeric" style="width:100%;margin-top:4px" /></label>`;
}
function agganciaSpessorePiano(root) {
  const imposta = (v) => {
    registraStoria();
    if (!progetto.encimera) progetto.encimera = {};
    if (v > 0) progetto.encimera.spessore = Math.max(6, Math.min(200, Math.round(v))); else delete progetto.encimera.spessore;
    aggiorna();
  };
  root.querySelectorAll('.opt-sptop[data-sptop]').forEach((b) => b.addEventListener('click', () => imposta(Number(b.dataset.sptop) || 0)));
  root.querySelectorAll('.opt-strati[data-strati]').forEach((b) => b.addEventListener('click', () => {
    registraStoria();
    if (!progetto.encimera) progetto.encimera = {};
    const v = Number(b.dataset.strati) || 1;
    if (v > 1) progetto.encimera.strati = v; else delete progetto.encimera.strati;
    aggiorna();
  }));
  const inp = root.querySelector('#sptop-num');
  if (inp) inp.addEventListener('change', () => { const v = Number(inp.value); if (v >= 6) imposta(v); });
}

/** PIANO COTTURA: 2 fuochi (placca stretta, «domino») o 4 fuochi. Solo dove c'è la placca. */
function htmlFuochi(m) {
  if (!(m.placca || m.tipo === 'forno')) return '';
  const f = m.fuochi || ((m.larghezza_mm || 600) < 600 ? 2 : 4);
  return `
      <div class="riga-3d" style="margin:10px 0 6px">Piano cottura</div>
      <div class="opzioni-anta">
        ${[[2, '2 fuochi (stretto, 29 cm)'], [4, '4 fuochi (58 cm)']].map(([v, l]) => `<button type="button" class="btn-ghost opt-fuochi ${f === v ? 'attivo' : ''}" data-fuochi="${v}">${f === v ? '✓ ' : ''}${l}</button>`).join('')}
      </div>`;
}

/** FRIGO: colore (bianco, nero, acciaio) e misure, a portata di tocco. */
function htmlColoreFrigo(m) {
  if (categoriaTipo(m.tipo) !== 'frigo') return '';
  const sel = m.colore || 'bianco';
  return `
    <section class="step3-pannello">
      <h3>Frigo</h3>
      <div class="riga-3d" style="margin-bottom:6px"><strong>${m.larghezza_mm || 600} × ${m.altezza_mm || 1860} × ${m.profondita_mm || 660} mm</strong> (larghezza × altezza × profondità). L'altezza cambia da frigo a frigo: con «Cambia misura» scrivi quella del tuo.</div>
      <div class="opzioni-anta">
        ${COLORI_FRIGO.map((c) => `<button type="button" class="btn-ghost opt-frigo ${c.id === sel ? 'attivo' : ''}" data-frigo="${c.id}" style="display:flex;align-items:center;gap:8px;justify-content:center">
          <span style="width:18px;height:18px;border-radius:3px;border:1px solid #777;background:${c.css}"></span>${c.id === sel ? '✓ ' : ''}${c.nome}</button>`).join('')}
      </div>
      <div class="riga-3d" style="margin:10px 0 6px">Maniglia</div>
      <div class="opzioni-anta">
        ${[['incassata', 'Incassata (fra le porte)'], ['barra', 'A barra']].map(([id, nome]) => `<button type="button" class="btn-ghost opt-frigoman ${(m.maniglia || 'incassata') === id ? 'attivo' : ''}" data-frigoman="${id}">${(m.maniglia || 'incassata') === id ? '✓ ' : ''}${nome}</button>`).join('')}
      </div>
    </section>`;
}
/** LAVASTOVIGLIE: a vista in acciaio, nera o bianca, oppure INTEGRATA dietro un'anta come i mobili. */
const COLORI_LAVAST = [
  { id: 'acciaio', nome: 'Acciaio inox', css: 'linear-gradient(135deg,#e1e3e6,#a4a8ad 55%,#cfd2d5)' },
  { id: 'nero', nome: 'Nera', css: '#1b1c1f' },
  { id: 'bianco', nome: 'Bianca', css: '#f1f1ee' },
  { id: 'integrata', nome: 'Integrata (anta come i mobili)', css: 'repeating-linear-gradient(90deg,#cfc8b8 0 8px,#bdb5a3 8px 9px)' },
];
function htmlColoreLavastoviglie(m, aperta = false) {
  if (m.tipo !== 'lavastoviglie') return '';
  const sel = m.colore || 'acciaio';
  return `
    <section class="step3-pannello"${aperta ? ' data-aperta' : ''}>
      <h3>Lavastoviglie</h3>
      <div class="opzioni-anta">
        ${COLORI_LAVAST.map((c) => `<button type="button" class="btn-ghost opt-lavast ${c.id === sel ? 'attivo' : ''}" data-lavast="${c.id}" style="display:flex;align-items:center;gap:8px;justify-content:center">
          <span style="width:18px;height:18px;border-radius:3px;border:1px solid #777;background:${c.css}"></span>${c.id === sel ? '✓ ' : ''}${c.nome}</button>`).join('')}
      </div>
      ${sel === 'integrata' ? '<div class="riga-3d" style="margin-top:6px">L\'anta ha il colore dei mobili bassi e va nella distinta.</div>' : ''}
    </section>`;
}
function agganciaColoreFrigo(root, m) {
  root.querySelectorAll('.opt-fuochi[data-fuochi]').forEach((b) => b.addEventListener('click', () => {
    const v = Number(b.dataset.fuochi);
    if ((m.fuochi || ((m.larghezza_mm || 600) < 600 ? 2 : 4)) === v) return;
    registraStoria(); m.fuochi = v; aggiorna();
  }));
  // PIANO / TAVOLO: materiale e appoggio
  root.querySelectorAll('.swatch[data-tavmat]').forEach((b) => b.addEventListener('click', () => {
    if (m.materiale === b.dataset.tavmat) return;
    registraStoria(); m.materiale = b.dataset.tavmat; aggiorna();
  }));
  root.querySelectorAll('[data-tavmat0]').forEach((b) => b.addEventListener('click', () => {
    if (!m.materiale) return;
    registraStoria(); delete m.materiale; aggiorna();
  }));
  root.querySelectorAll('.opt-tavapp[data-tavapp]').forEach((b) => b.addEventListener('click', () => {
    if ((m.appoggio || 'cascata') === b.dataset.tavapp) return;
    registraStoria(); m.appoggio = b.dataset.tavapp; aggiorna();
  }));
  root.querySelectorAll('.opt-frigo[data-frigo]').forEach((b) => b.addEventListener('click', () => {
    if ((m.colore || 'bianco') === b.dataset.frigo) return;
    registraStoria(); m.colore = b.dataset.frigo; aggiorna();
  }));
  root.querySelectorAll('.opt-frigoman[data-frigoman]').forEach((b) => b.addEventListener('click', () => {
    if ((m.maniglia || 'incassata') === b.dataset.frigoman) return;
    registraStoria(); m.maniglia = b.dataset.frigoman; aggiorna();
  }));
  root.querySelectorAll('.opt-lavast[data-lavast]').forEach((b) => b.addEventListener('click', () => {
    if ((m.colore || 'acciaio') === b.dataset.lavast) return;
    registraStoria(); m.colore = b.dataset.lavast; aggiorna();
  }));
}

function htmlDistanzaFrigo(m) {
  if (m.tipo !== 'sopra-frigo') return '';
  const fr = frigoSottoAltillo(progetto, m);
  if (!fr) return `
    <section class="step3-pannello">
      <h3>Distanza dal frigo</h3>
      <div class="riga-3d">Mettilo sopra un frigo per scegliere lo spazio tra il frigo e il mobile.</div>
    </section>`;
  const attuale = scena3dMod && scena3dMod.distanzaAltilloFrigo ? scena3dMod.distanzaAltilloFrigo(progetto, m) : null;
  const val = m.distanzaFrigo_mm != null ? m.distanzaFrigo_mm : attuale;
  const cost = costadiDelFrigo(progetto, m);
  const hCost = cost.length ? Math.max(...cost.map((c) => c.altezza_mm || 0)) : null;
  const cima = cimaMobileSopraFrigo(progetto, m);
  return `
    <section class="step3-pannello">
      <h3>Mobile sopra frigo · altezze</h3>
      <div class="riga-3d" style="margin-bottom:6px">Frigo <strong>${fr.larghezza_mm || 600} × ${fr.altezza_mm || 1850} × ${fr.profondita_mm || 660} mm</strong>. Se alzi o abbassi il mobile, <strong>costadi accanto e tutti i moduli alti</strong> vanno alla stessa altezza (anche nella lista dei pezzi).</div>
      <div class="ra-campi">
        <label>Distanza dal frigo (mm)<input id="dist-frigo" type="number" placeholder="es. 20" value="${val != null ? val : ''}" min="0" step="1" inputmode="numeric"></label>
        ${cost.length ? `<label>Altezza costadi (mm)<input id="alt-costadi" type="number" value="${hCost}" min="500" step="1" inputmode="numeric"></label>` : ''}
      </div>
      <div class="opzioni-anta" style="margin-top:8px">
        <button type="button" class="btn-oro" id="dist-frigo-ok">Muovi mobile sopra frigo</button>
        <button type="button" class="btn-ghost ${m.distanzaFrigo_mm == null ? 'attivo' : ''}" id="dist-frigo-auto">${m.distanzaFrigo_mm == null ? '✓ ' : ''}Automatica</button>
      </div>
      <div class="riga-3d" style="margin-top:6px">${m.distanzaFrigo_mm == null
        ? 'Automatica: la cima del mobile è a filo con i costadi o le colonne accanto.'
        : `Dal frigo al mobile: <strong>${m.distanzaFrigo_mm} mm</strong> · cima a <strong>${cima} mm</strong> da terra${cost.length ? ` · ${cost.length === 1 ? 'costado' : `${cost.length} costadi`} da <strong>${hCost} mm</strong>` : ''}.`}</div>
    </section>`;
}
function agganciaDistanzaFrigo(root, m) {
  const inp = root.querySelector('#dist-frigo');
  const inpC = root.querySelector('#alt-costadi');
  // distanza automatica attuale (la calcola la vista 3D, caricata se serve)
  if (inp && !inp.value) caricaScena3d().then((mod) => {
    const v = mod && mod.distanzaAltilloFrigo ? mod.distanzaAltilloFrigo(progetto, m) : null;
    if (v != null && inp.isConnected && !inp.value) inp.value = v;
  }).catch(() => {});
  const fr = frigoSottoAltillo(progetto, m);
  const hFr = fr ? (fr.altezza_mm || 1850) : 0, hA = m.altezza_mm || 350;
  // scrivendo una misura, l'altra si aggiorna (costado = frigo + distanza + mobile)
  inp?.addEventListener('input', () => { const d = Number(inp.value); if (inpC && Number.isFinite(d)) inpC.value = Math.round(hFr + d + hA); });
  inpC?.addEventListener('input', () => { const h = Number(inpC.value); if (Number.isFinite(h)) inp.value = Math.round(h - hFr - hA); });
  const applica = () => {
    const v = Math.round(Number(String(inp.value).replace(',', '.')));
    if (!Number.isFinite(v) || v < 0) { alert((window.NGI18N ? window.NGI18N.t : (x) => x)('Il mobile non può entrare nel frigo: la distanza deve essere 0 o più (costadi almeno {0} mm).').replace('{0}', hFr + hA)); inp.focus(); return; }
    registraStoria(); m.distanzaFrigo_mm = v; aggiorna();
  };
  root.querySelector('#dist-frigo-ok')?.addEventListener('click', applica);
  inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applica(); });
  inpC?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applica(); });
  root.querySelector('#dist-frigo-auto')?.addEventListener('click', () => {
    if (m.distanzaFrigo_mm == null) return;
    registraStoria(); delete m.distanzaFrigo_mm; aggiorna();
  });
}

/** MOBILE APERTO: ripiani e colore del dentro (la cornice davanti è del colore delle ante). */
/**
 * MOBILE A GIORNO (senza ante): sezione sua, in cima, con i ripiani, il fianco aperto, il COLORE DI
 * OGNI PEZZO (fianchi, cielo, fondo, schiena, ripiani) e i LED sotto il top e sotto i ripiani.
 */
const NOMI_PARTI_AP = { fianchi: 'Fianchi', cielo: 'Cielo (top)', fondo: 'Fondo', schiena: 'Schiena', ripiani: 'Ripiani' };
function nomeColoreAp(c) {
  if (c === 'ante') return 'Come le ante';
  if (c === 'struttura') return progetto.coloreInterno === 'antracite' ? 'Come la struttura (antracite)' : 'Come la struttura (bianco)';
  const mt = ((scena3dMod && scena3dMod.MATERIALI) || []).find((x) => x.id === c);
  return mt ? mt.nome : c;
}
function htmlMobileAperto(m) {
  const n = ripianiAperto(m), led = ledAperto(m);
  const lista = (scena3dMod && scena3dMod.materialiPer) ? scena3dMod.materialiPer('legno') : [];
  const op = (attr, val, et, on, min = '60px') => `<button type="button" class="btn-ghost opt-ap ${on ? 'attivo' : ''}" ${attr}="${val}" style="flex:1 1 ${min};min-width:${min}">${on ? '✓ ' : ''}${et}</button>`;
  // fianco aperto: automatico = il lato libero se è l'ultimo modulo della fila (si dice quale)
  const scLato = ['sx', 'dx', 'no'].includes(m.aperto && m.aperto.lato) ? m.aperto.lato : 'auto';
  const libAuto = latoApertoDi(progetto, { ...m, aperto: { ...(m.aperto || {}), lato: 'auto' } });
  const autoEt = libAuto === 'dx' ? 'Automatico (destro)' : libAuto === 'sx' ? 'Automatico (sinistro)' : 'Automatico (nessuno)';
  // pezzo di cui si sceglie il colore (o tutti insieme)
  const pezzo = step2.apPezzo && (step2.apPezzo === 'tutti' || PARTI_APERTO.includes(step2.apPezzo)) ? step2.apPezzo : 'fianchi';
  const cSel = pezzo === 'tutti' ? null : coloreParteAperto(m, pezzo);
  return `
    <section class="step3-pannello">
      <h3>Mobile a giorno</h3>
      <div class="riga-3d" style="margin:0 0 6px">Quanti ripiani:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${[0, 1, 2, 3, 4, 5].map((k) => op('data-aprip', k, String(k), n === k, '40px')).join('')}</div>
      <div class="riga-3d" style="margin:12px 0 6px">LED (colore della luce come i LED della cucina):</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('data-apled', 'top', '💡 LED sotto il top', led.top, '40%')}
        ${op('data-apled', 'ripiani', '💡 LED sotto i ripiani', led.ripiani, '40%')}
      </div>
      <div class="riga-3d" style="margin:12px 0 6px">Colore dei pezzi — scegli il pezzo, poi il colore:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${PARTI_APERTO.map((pt) => `<button type="button" class="btn-ghost opt-ap ${pezzo === pt ? 'attivo' : ''}" data-appezzo="${pt}" style="flex:1 1 30%;min-width:30%;line-height:1.25">${pezzo === pt ? '✓ ' : ''}${NOMI_PARTI_AP[pt]}<br><small style="opacity:.75;text-transform:none;letter-spacing:0">${escHtml(nomeColoreAp(coloreParteAperto(m, pt)))}</small></button>`).join('')}
        <button type="button" class="btn-ghost opt-ap ${pezzo === 'tutti' ? 'attivo' : ''}" data-appezzo="tutti" style="flex:1 1 30%;min-width:30%">${pezzo === 'tutti' ? '✓ ' : ''}Tutti i pezzi</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${op('data-apcol', 'ante', 'Come le ante', cSel === 'ante', '40%')}
        ${op('data-apcol', 'struttura', progetto.coloreInterno === 'antracite' ? 'Come la struttura (antracite)' : 'Come la struttura (bianco)', cSel === 'struttura', '40%')}
      </div>
      <div style="margin-top:8px">${htmlTendineColori(lista, (mt) => `<button type="button" class="swatch ${mt.id === cSel ? 'sel' : ''}" data-apcol="${mt.id}" title="${escHtml(mt.nome)}" style="background-image:url('${mt.thumb}')"></button>`,
        { sel: cSel, chiave: 'cucina-agiorno-colori' })}</div>
      <div class="riga-3d" style="margin:12px 0 6px">Fianco aperto (ultimo modulo della fila):</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${op('data-aplato', 'auto', autoEt, scLato === 'auto', '40%')}
        ${op('data-aplato', 'sx', 'Sinistro', scLato === 'sx', '40%')}
        ${op('data-aplato', 'dx', 'Destro', scLato === 'dx', '40%')}
        ${op('data-aplato', 'no', 'Nessuno', scLato === 'no', '40%')}
      </div>
      <div class="riga-3d" style="margin-top:8px">Fatto a pezzi, tutti dello spessore delle ante. Il fianco è profondo come il mobile più l'anta (a filo con le ante vicine); la schiena è larga come il mobile meno il fianco; con le ante da 72 / 92 è alto come l'anta. Se è l'ultimo modulo della fila, dal lato libero non ha il fianco. Dentro ci puoi mettere gli oggetti: trascinali nel mobile e lasciali sul ripiano che vuoi.</div>
    </section>`;
}
function agganciaMobileAperto(root, m) {
  const cambia = (fn) => { registraStoria(); m.aperto = { ...(m.aperto || {}) }; fn(m.aperto); aggiorna(); };
  root.querySelectorAll('[data-aprip]').forEach((b) => b.addEventListener('click', () => cambia((a) => { a.ripiani = Number(b.dataset.aprip); })));
  root.querySelectorAll('[data-aplato]').forEach((b) => b.addEventListener('click', () => cambia((a) => { a.lato = b.dataset.aplato; })));
  root.querySelectorAll('[data-apled]').forEach((b) => b.addEventListener('click', () => cambia((a) => {
    a.led = { ...(a.led || {}) }; a.led[b.dataset.apled] = !a.led[b.dataset.apled];
  })));
  root.querySelectorAll('[data-appezzo]').forEach((b) => b.addEventListener('click', () => { step2.apPezzo = b.dataset.appezzo; renderPannello(); }));
  root.querySelectorAll('[data-apcol]').forEach((b) => b.addEventListener('click', () => cambia((a) => {
    const pezzo = step2.apPezzo && (step2.apPezzo === 'tutti' || PARTI_APERTO.includes(step2.apPezzo)) ? step2.apPezzo : 'fianchi';
    a.colori = { ...(a.colori || {}) };
    for (const pt of (pezzo === 'tutti' ? PARTI_APERTO : [pezzo])) a.colori[pt] = b.dataset.apcol;
  })));
}

function blocMobileSelezionato() {
  const m = trovaMobileLibero(progetto, step2.mobSelId);
  if (!m) return '';
  const cieco = categoriaTipo(m.tipo) === 'base' ? infoAngoloCieco(progetto, m) : null;
  const ra = progetto.reglettaAngolo || { base: parametri().regletta.vista, spessore: parametri().regletta.spessoreAnta };
  const pend = step2.movePending && step2.movePending.id === m.id;
  return `
    ${pend ? `
    <section class="sposta-conferma">
      <div class="sposta-conferma-txt">✋ Hai spostato <strong>${nomeTipo(m.tipo)}</strong>. Confermi la nuova posizione?</div>
      <div class="orienta-row" style="margin-top:8px">
        <button id="sposta-ok" class="btn-oro" type="button" style="flex:1">✓ Conferma spostamento</button>
        <button id="sposta-annulla" class="btn-ghost" type="button" style="flex:1">↩ Annulla</button>
      </div>
    </section>` : ''}
    <section>
      <h3>Mobile selezionato</h3>
      <div class="mod-row ${m.tipo}"><span>${nomeTipo(m.tipo)} · <strong>${descrizioneMobile(m)}</strong></span></div>
      <div class="mob-azioni-grid">
        <button id="mob-ruota" class="btn-ghost" type="button">⟳ Ruota 90°</button>
        ${categoriaTipo(m.tipo) === 'tavolo' ? '' : `<button id="mob-isola" class="btn-ghost ${m.isola ? 'attivo' : ''}" type="button">${m.isola ? '✓ ' : ''}🏝 Isola (libero)</button>`}
        ${categoriaTipo(m.tipo) === 'base' && cieco ? `<button id="mob-cieco" class="btn-ghost attivo" type="button">✓ ⌐ Angolo cieco (auto) — togli</button>` : (categoriaTipo(m.tipo) === 'base' ? `<button id="mob-cieco" class="btn-ghost" type="button">⌐ Forza angolo cieco qui</button>` : '')}
        <button id="mob-misura" class="btn-ghost" type="button">Cambia misura</button>
        <button id="mob-elimina" class="btn-ghost" type="button">Elimina</button>
        ${htmlModoMulti()}
      </div>
      ${htmlBaseAngolo(m)}
      ${htmlPianoTavolo(m)}
      ${htmlColoreFrigo(m)}
      ${htmlColoreLavastoviglie(m)}
      ${htmlAperturaColonna(m)}
      ${htmlPensileSottoPonte(m)}
      ${htmlDistanzaFrigo(m)}
      ${(m.tipo === 'base-ante' || m.tipo === 'base-cassetti') ? `
      <div class="mob-azioni-grid" style="margin-top:8px">
        <button id="mob-placca" class="btn-ghost ${m.placca ? 'attivo' : ''}" type="button">${m.placca ? '✓ ' : ''}🔥 Piano cottura</button>
        <button id="mob-lavello" class="btn-ghost ${m.lavello ? 'attivo' : ''}" type="button">${m.lavello ? '✓ ' : ''}🚰 Lavello</button>
      </div>` : ''}
      ${htmlFuochi(m)}
      <div class="nudge">
        <label class="nudge-cm">Sposta di <input id="nudge-cm" type="number" value="${step2.nudgeCm ?? 1}" min="0.1" step="0.5" inputmode="decimal"> cm</label>
        <div class="nudge-grid">
          <button id="nudge-su" class="btn-ghost" type="button" title="Su">↑</button>
          <button id="nudge-sx" class="btn-ghost" type="button" title="Sinistra">←</button>
          <button id="nudge-dx" class="btn-ghost" type="button" title="Destra">→</button>
          <button id="nudge-giu" class="btn-ghost" type="button" title="Giù">↓</button>
        </div>
      </div>
      <div class="mod-vuoto">${m.isola
        ? 'Isola/penisola: posizionalo dove vuoi e ruotalo a mano. Si attacca e si allinea agli altri mobili.'
        : (m.rotManuale
          ? 'Girato a mano: resta girato così anche quando lo sposti (penisola). Accostalo al muro e agli altri mobili: si attacca da solo. I mobili che metti accanto prendono lo stesso verso.'
          : 'Vicino al muro si orienta da solo (ante verso l’interno). Per una penisola premi “Ruota 90°”: resta girato come vuoi e lo puoi attaccare al muro.')}<br><strong>Tieni premuto Ctrl</strong> mentre trascini per spostarlo libero (senza calamita).</div>
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
  const esistente = mobId ? trovaMobileLibero(progetto, mobId) : null;
  // MOBILE APERTO: lo facciamo a pezzi → anche l'altezza si scrive a mano (qualsiasi misura)
  const campi = campiMobile(tipoId).map((c) => (esistente && apertoDi(esistente) && c.campo === 'altezza_mm')
    ? { ...c, tipo: 'numero', min: 150, step: 10, et: 'Altezza (mm) — mobile aperto: qualsiasi misura' } : c);
  const valori = {};
  for (const c of campi) {
    valori[c.campo] = esistente && esistente[c.campo] != null ? esistente[c.campo] : c.default;
  }
  // Costado nuovo negli "alti": profondità 350 (pensili) e altezza 700 come un
  // pensile, così nasce ALTO (appeso) e non per terra. Nei bassi resta 620.
  if (tipoId === 'costado' && !esistente && livelloStep() === 'alto') {
    valori.profondita_mm = 350;
    valori.altezza_mm = 700;
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
    if (m) {
      // mobile sopra frigo con la distanza scelta: cambiando la sua altezza la
      // CIMA resta dov'è (costadi e pensili fermi), cambia lo spazio sul frigo
      const cimaPrima = categoriaTipo(m.tipo) === 'altillo' ? cimaMobileSopraFrigo(progetto, m) : null;
      Object.assign(m, valori);
      segnaFuoriMisura(m);                          // misura non standard: modulo da tagliare
      const fr = cimaPrima != null ? frigoSottoAltillo(progetto, m) : null;
      if (fr) m.distanzaFrigo_mm = Math.max(0, cimaPrima - (fr.altezza_mm || 1850) - (m.altezza_mm || 350));
      sincronizzaFrigo(progetto, m);
    }
    step2.mobSelId = mobId;
  } else {
    step2.mobSelId = aggiungiMobileLibero(progetto, tipoId, valori);
    { const nm = trovaMobileLibero(progetto, step2.mobSelId); if (nm) segnaFuoriMisura(nm); }
    // Nuovo mobile: se nasce vicino a un muro, orienta le ante verso l'interno
    const nuovo = trovaMobileLibero(progetto, step2.mobSelId);
    const rot = nuovo && rotazioneAutomatica(progetto, nuovo, nuovo.x, nuovo.y);
    if (nuovo && rot !== null && rot !== undefined) nuovo.rot = rot;
  }
  riblocca(step2.mobSelId);
  // misura cambiata (o mobile nuovo) e non ci sta contro il muro: avviso con i cm che mancano
  const mm = trovaMobileLibero(progetto, step2.mobSelId);
  if (mobId && mm && categoriaTipo(mm.tipo) !== 'oggetto' && !mm.isola) {          // solo cambiando la misura di un mobile già messo
    const manca = spazioMancante(progetto, mm, mm.x, mm.y);
    if (manca > 2) avvisoNonEntra(manca);
  }
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
document.getElementById('distinta-csv')?.addEventListener('click', seCompletaCucina(esportaDistintaCSV));
document.getElementById('distinta-xlsx')?.addEventListener('click', seCompletaCucina(esportaDistintaExcel));
document.getElementById('distinta-modello')?.addEventListener('click', seCompletaCucina(() =>
  apriModelloExcel({ pezzi: pezziPerModello(), progetto: progetto.nome || 'Cucina' })));
document.getElementById('distinta-chiudi')?.addEventListener('click', chiudiDistinta);
document.getElementById('distinta-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'distinta-overlay') chiudiDistinta(); });

/** Coordinate di un evento puntatore in mm di pianta (y in su). */
function puntoMm(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: q.x, y: -q.y };
}

// --------- SPOSTAMENTO MOBILE CON CONFERMA ---------
// Un mobile spostato a mano viene "bloccato" (posManuale) così l'auto-layout
// (orientamento verso il muro, regletta d'angolo) NON lo rimette al suo posto
// quando si cambia schermata: resta dove l'utente l'ha messo. Prima di salvare
// in modo definitivo compare una barra Conferma/Annulla.
function avviaSpostamento(m) {
  // Fotografa la posizione di PARTENZA una sola volta (per poter annullare).
  if (!step2.movePending || step2.movePending.id !== m.id) {
    step2.movePending = { id: m.id, prima: { x: m.x, y: m.y, rot: m.rot, posManuale: !!m.posManuale } };
  }
  m.posManuale = true;                 // blocca l'auto-layout su questo mobile
}
function confermaSpostamento() {
  step2.movePending = null;            // la posizione (posManuale=true) resta salvata
  aggiorna();
}
function annullaSpostamento() {
  const mp = step2.movePending;
  if (mp) {
    for (const { id, prima } of (mp.gruppo || [{ id: mp.id, prima: mp.prima }])) {
      const m = trovaMobileLibero(progetto, id);
      if (!m) continue;
      m.x = prima.x; m.y = prima.y; m.rot = prima.rot;
      if (prima.posManuale) m.posManuale = true; else delete m.posManuale;
      if (mp.gruppo) { if (prima.rotManuale) m.rotManuale = true; else delete m.rotManuale; }
    }
  }
  step2.movePending = null;
  aggiorna();
}

// --------- SELEZIONE MULTIPLA (Ctrl / Cmd + clic, o «Seleziona più mobili» sul telefono) ---------
// Si scelgono più mobili e si spostano tutti insieme: trascinandone uno, con le frecce
// «Sposta di X cm», con i tasti freccia, o si girano / eliminano insieme.
/** Il mobile si può spostare a questo passo? (bassi / alti / accessori, come il trascinamento) */
function spostabileQui(m) {
  if (!m) return false;
  const st = progetto.stepCorrente;
  if (!(st === 2 || st === 3 || st === P_ACC)) return false;
  const eOgg = categoriaTipo(m.tipo) === 'oggetto';
  return st === P_ACC ? eOgg : (!eOgg && livelloDiMobile(m) === livelloStep());
}
/** Mobili della selezione multipla (solo quelli che esistono ancora e si spostano a questo passo). */
function mobiliMulti() {
  step2.multiSel = (step2.multiSel || []).filter((id) => spostabileQui(trovaMobileLibero(progetto, id)));
  if (!step2.multiSel.length && !spostabileQui(trovaMobileLibero(progetto, step2.mobSelId))) step2.multiModo = false;
  return step2.multiSel.map((id) => trovaMobileLibero(progetto, id));
}
/** Più di un mobile selezionato: il pannello mostra il gruppo. */
function gruppoAttivo() { return mobiliMulti().length > 1; }
/** Aggiunge o toglie un mobile dalla selezione multipla. */
function cambiaMulti(m) {
  const s = step2.multiSel;
  // il mobile già selezionato da solo entra nel gruppo
  if (!s.length && step2.mobSelId != null && step2.mobSelId !== m.id && spostabileQui(trovaMobileLibero(progetto, step2.mobSelId))) s.push(step2.mobSelId);
  const i = s.indexOf(m.id);
  if (i >= 0) s.splice(i, 1); else s.push(m.id);
  step2.mobSelId = s.length ? s[s.length - 1] : null;
  if (s.length < 2 && !step2.multiModo) step2.multiSel = [];
  step2.movePending = null;
}
function svuotaMulti() { step2.multiSel = []; step2.multiModo = false; }
const fotoPos = (m) => ({ x: m.x, y: m.y, rot: m.rot, posManuale: !!m.posManuale, rotManuale: !!m.rotManuale });
/**
 * Sposta il gruppo di (ddx, ddy) mm rispetto alla partenza: resta RIGIDO (le distanze fra i
 * mobili non cambiano) e nessuno esce dalla stanza — se uno tocca il muro, si ferma tutto il gruppo.
 * gruppo: [{ id, prima:{x,y} }]. Ritorna true se qualcosa si è mosso.
 */
function spostaGruppo(gruppo, ddx, ddy) {
  const membri = gruppo.map((g) => ({ g, m: trovaMobileLibero(progetto, g.id) })).filter((x) => x.m);
  if (!membri.length) return false;
  // Si parte da dove il gruppo è ORA (già dentro la stanza) e si va verso il dito a piccoli passi
  // (8 cm): così un muro ferma sempre il gruppo, anche col dito veloce o molto oltre il muro.
  let ox = membri[0].m.x - membri[0].g.prima.x, oy = membri[0].m.y - membri[0].g.prima.y;
  const n = Math.max(1, Math.ceil(Math.hypot(ddx - ox, ddy - oy) / 80));
  const sx = (ddx - ox) / n, sy = (ddy - oy) / n;    // passo fisso: se il muro blocca, il resto non salta oltre
  for (let i = 0; i < n; i++) {
    let wx = ox + sx, wy = oy + sy;
    // correzione comune: il gruppo resta RIGIDO, nessuno entra nel muro
    for (let pass = 0; pass < 4; pass++) {
      let ex = 0, ey = 0;
      for (const { g, m } of membri) {
        const px = g.prima.x + wx, py = g.prima.y + wy;
        const v = posizionaVincolata(progetto, { ...m, x: px, y: py }, px, py, true);
        if (Math.abs(v.x - px) > Math.abs(ex)) ex = v.x - px;
        if (Math.abs(v.y - py) > Math.abs(ey)) ey = v.y - py;
      }
      if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break;
      wx += ex; wy += ey;
    }
    ox = wx; oy = wy;
  }
  let cambiato = false;
  for (const { g, m } of membri) {
    const nx = Math.round(g.prima.x + ox), ny = Math.round(g.prima.y + oy);
    if (nx !== m.x || ny !== m.y) { m.x = nx; m.y = ny; cambiato = true; }
  }
  return cambiato;
}
/** Spostamento del gruppo da confermare (barra Conferma / Annulla, come per un mobile solo). */
function avviaSpostamentoGruppo(membri) {
  if (!step2.movePending || !step2.movePending.gruppo) {
    step2.movePending = { id: membri[0].id, prima: fotoPos(membri[0]), gruppo: membri.map((m) => ({ id: m.id, prima: fotoPos(m) })) };
  }
  membri.forEach((m) => { m.posManuale = true; });
}
function nudgeGruppo(dx, dy) {
  const membri = mobiliMulti();
  if (membri.length < 2 || (!dx && !dy)) return;
  registraStoria();
  avviaSpostamentoGruppo(membri);
  spostaGruppo(membri.map((m) => ({ id: m.id, prima: { x: m.x, y: m.y } })), dx, dy);
  aggiorna();
}
/** Gira tutto il gruppo di 90° attorno al suo centro (come un pezzo unico: isola + tavolo + sgabelli). */
function ruotaGruppo() {
  const membri = mobiliMulti();
  if (membri.length < 2) return;
  registraStoria();
  avviaSpostamentoGruppo(membri);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const m of membri) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (const m of membri) {
    const rx = m.x - cx, ry = m.y - cy;           // +90° (antiorario, y della pianta in su)
    m.x = Math.round(cx - ry); m.y = Math.round(cy + rx);
    m.rot = ((m.rot || 0) + 90) % 360;
    if (categoriaTipo(m.tipo) !== 'oggetto') m.rotManuale = true;
  }
  spostaGruppo(membri.map((m) => ({ id: m.id, prima: { x: m.x, y: m.y } })), 0, 0);   // dentro la stanza
  aggiorna();
}
function eliminaGruppo() {
  const membri = mobiliMulti();
  if (!membri.length) return;
  registraStoria();
  membri.forEach((m) => rimuoviMobileLibero(progetto, m.id));
  svuotaMulti(); step2.mobSelId = null; step2.movePending = null;
  aggiorna();
}
/** Pannello del gruppo selezionato. */
function blocMultiSel() {
  const membri = mobiliMulti();
  const acc = progetto.stepCorrente === P_ACC;
  const pend = step2.movePending && step2.movePending.gruppo;
  const tasto = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? 'Cmd' : 'Ctrl';
  return `
    ${pend ? `
    <section class="sposta-conferma">
      <div class="sposta-conferma-txt">✋ Hai spostato <strong>${membri.length} ${acc ? 'oggetti' : 'mobili'}</strong>. Confermi la nuova posizione?</div>
      <div class="orienta-row" style="margin-top:8px">
        <button id="sposta-ok" class="btn-oro" type="button" style="flex:1">✓ Conferma spostamento</button>
        <button id="sposta-annulla" class="btn-ghost" type="button" style="flex:1">↩ Annulla</button>
      </div>
    </section>` : ''}
    <section>
      <h3>${acc ? 'Oggetti selezionati' : 'Mobili selezionati'}</h3>
      <div class="riga-3d"><strong>${membri.length}</strong> ${acc ? 'oggetti selezionati' : 'mobili selezionati'}: trascinane uno e si spostano tutti insieme.</div>
      <div class="multi-lista">${membri.map((m) => `<span class="multi-pill">${escHtml(nomeTipo(m.tipo))}${dimMobile(m).w ? `<span data-no-i18n> ${Math.round(dimMobile(m).w / 10)}</span>` : ''}</span>`).join('')}</div>
      <div class="mob-azioni-grid" style="margin-top:8px">
        <button id="multi-ruota" class="btn-ghost" type="button">⟳ Ruota insieme 90°</button>
        <button id="multi-elimina" class="btn-ghost" type="button">Elimina tutti</button>
        <button id="multi-fine" class="btn-ghost" type="button">Deseleziona</button>
        ${htmlModoMulti()}
      </div>
      <div class="nudge">
        <label class="nudge-cm">Sposta di <input id="nudge-cm" type="number" value="${step2.nudgeCm ?? 1}" min="0.1" step="0.5" inputmode="decimal"> cm</label>
        <div class="nudge-grid">
          <button id="nudge-su" class="btn-ghost" type="button" title="Su">↑</button>
          <button id="nudge-sx" class="btn-ghost" type="button" title="Sinistra">←</button>
          <button id="nudge-dx" class="btn-ghost" type="button" title="Destra">→</button>
          <button id="nudge-giu" class="btn-ghost" type="button" title="Giù">↓</button>
        </div>
      </div>
      <div class="mod-vuoto"><span data-no-i18n>${tasto}</span> ${acc
        ? '+ clic su un oggetto: lo aggiungi o lo togli dal gruppo. Sul telefono: «Seleziona più oggetti» e tocca gli oggetti. Tocca un punto vuoto per deselezionare.'
        : '+ clic su un mobile: lo aggiungi o lo togli dal gruppo. Sul telefono: «Seleziona più mobili» e tocca i mobili. Tocca un punto vuoto per deselezionare.'}</div>
    </section>`;
}
/** Pulsante «Seleziona più mobili» (sul telefono non c'è Ctrl: ogni tocco aggiunge o toglie). */
function htmlModoMulti() {
  const parola = progetto.stepCorrente === P_ACC ? 'oggetti' : 'mobili';
  return `<button id="multi-modo" class="btn-ghost ${step2.multiModo ? 'attivo' : ''}" type="button">${step2.multiModo ? '✓ ' : ''}☐ Seleziona più ${parola}</button>`;
}
function agganciaModoMulti(root = pannello) {
  root.querySelector('#multi-modo')?.addEventListener('click', () => {
    step2.multiModo = !step2.multiModo;
    if (step2.multiModo && !step2.multiSel.length && spostabileQui(trovaMobileLibero(progetto, step2.mobSelId))) step2.multiSel = [step2.mobSelId];
    if (!step2.multiModo && step2.multiSel.length < 2) step2.multiSel = [];
    aggiorna();
  });
}
function agganciaMultiSel(root = pannello) {
  root.querySelector('#multi-ruota')?.addEventListener('click', ruotaGruppo);
  root.querySelector('#multi-elimina')?.addEventListener('click', eliminaGruppo);
  agganciaModoMulti(root);
  root.querySelector('#multi-fine')?.addEventListener('click', () => { svuotaMulti(); step2.mobSelId = null; step2.movePending = null; aggiorna(); });
  const nudge = (dx, dy) => {
    const cm = parseFloat(root.querySelector('#nudge-cm')?.value) || 0;
    step2.nudgeCm = cm || step2.nudgeCm;
    const mm = Math.round(cm * 10);
    if (mm) nudgeGruppo(dx * mm, dy * mm);
  };
  root.querySelector('#nudge-su')?.addEventListener('click', () => nudge(0, 1));
  root.querySelector('#nudge-giu')?.addEventListener('click', () => nudge(0, -1));
  root.querySelector('#nudge-sx')?.addEventListener('click', () => nudge(-1, 0));
  root.querySelector('#nudge-dx')?.addEventListener('click', () => nudge(1, 0));
}

// --------- PIANTA A MANO LIBERA (Step 1) ---------
// Trascinare un vertice lo sposta (le altre pareti restano ferme); con
// "Aggiungi parete" si tira una parete nuova da un'estremità. La squadra a
// 90° "tiene" (calamita di qualche grado). Numeri da tastiera: lunghezza della
// parete selezionata / angolo del vertice selezionato, poi Invio.
const infoML = (() => {
  const d = document.createElement('div'); d.className = 'ml-info'; d.hidden = true;
  svg.parentElement.style.position = svg.parentElement.style.position || 'relative';
  svg.parentElement.appendChild(d); return d;
})();
const trML = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
function mostraInfoML(e, testo) {
  const r = svg.parentElement.getBoundingClientRect();
  infoML.textContent = testo; infoML.hidden = false;
  // resta dentro la pianta: se non c'è posto a destra va a sinistra del puntatore
  const w = infoML.offsetWidth || 200, h = infoML.offsetHeight || 30;
  let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
  if (x + w > r.width - 6) x = e.clientX - r.left - w - 16;
  if (y + h > r.height - 6) y = e.clientY - r.top - h - 16;
  infoML.style.left = `${Math.max(6, x)}px`; infoML.style.top = `${Math.max(6, y)}px`;
}
const fmtG = (a) => `${String(Math.round(a * 10) / 10).replace('.', ',')}°`;
const normG = (a) => { let x = a % 360; if (x <= -180) x += 360; if (x > 180) x -= 360; return x; };
/**
 * Muove il vertice di un'ESTREMITÀ (k = 0 o ultimo): la parete attaccata ruota
 * attorno al vertice d'unione e si allunga/accorcia. Squadra: si aggancia a
 * 90°/180°/270° rispetto alla parete vicina (o agli assi se è la sola).
 * Ritorna il testo informativo (angolo interno + misura).
 */
function muoviEstremoML(k, P0) {
  const pareti = progetto.piano.pareti, V = calcolaVertici(pareti);
  const ultimo = k === pareti.length;
  const giunto = ultimo ? k - 1 : 1;                       // vertice d'unione (fisso)
  const anc = V[giunto];
  const vicina = ultimo ? pareti[k - 2] : pareti[1];       // parete accanto (per la squadra)
  let base = vicina ? vicina.angolo_gradi : 0;
  if (!ultimo && vicina) base += 180;                      // all'inizio la direzione è al contrario
  let ang = (Math.atan2(P0.y - anc.y, P0.x - anc.x) * 180) / Math.PI;
  const q = Math.round((ang - base) / 90) * 90;
  let squadra = false;
  if (Math.abs(normG(ang - base - q)) <= 6) { ang = base + q; squadra = true; }
  let L = Math.max(50, Math.round(Math.hypot(P0.x - anc.x, P0.y - anc.y) / 10) * 10);
  if (tastiML && Number(tastiML) >= 50) L = Math.round(Number(tastiML));
  const r = (ang * Math.PI) / 180;
  muoviVertice(progetto, k, anc.x + Math.cos(r) * L, anc.y + Math.sin(r) * L);
  const angI = angoloInternoVertice(progetto.piano.pareti, giunto);
  return `${angI != null ? `${trML('Angolo')} ${fmtG(angI)}${squadra ? ' ⟂' : ''} · ` : ''}${L} mm`;
}
/** "Aggiungi parete": parte dal vertice d'estremità selezionato e segue il mouse. */
function aggiungiPareteML() {
  registraStoria();
  const pareti = progetto.piano.pareti;
  if (!pareti.length) {
    aggiungiPareteLibera(progetto, 'fine', 3000, 0);
    seguiML = { k: 1 };
  } else if (verticeSel === 0) {
    const a = pareti[0].angolo_gradi;
    aggiungiPareteLibera(progetto, 'inizio', 1000, a - 90 + 180);
    seguiML = { k: 0 };
  } else {
    const a = pareti[pareti.length - 1].angolo_gradi;
    aggiungiPareteLibera(progetto, 'fine', 1000, a + 90);
    seguiML = { k: progetto.piano.pareti.length };
  }
  verticeSel = seguiML.k; tastiML = '';
  vbFisso = null;
  aggiorna();
  vbFisso = svg.getAttribute('viewBox');                   // la vista resta ferma mentre la muovi
}
// la parete appena aggiunta segue il mouse finché non clicchi
svg.addEventListener('pointermove', (e) => {
  if (!seguiML || tracciaML || progetto.stepCorrente !== 1) return;
  mostraInfoML(e, muoviEstremoML(seguiML.k, puntoMm(e)) + (tastiML ? '' : ` · ${trML('clicca per fissare')}`));
  disegna();
});
function fineSeguiML() { seguiML = null; vbFisso = null; infoML.hidden = true; tastiML = ''; aggiorna(); }
svg.addEventListener('pointerdown', (e) => {
  if (progetto.stepCorrente !== 1 || !manoLibera) return;
  if (seguiML) {                                       // clic = fissa la parete nuova
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.pointerType !== 'mouse') muoviEstremoML(seguiML.k, puntoMm(e));   // col dito: va dove tocchi
    fineSeguiML(); return;
  }
  const vEl = e.target.closest && e.target.closest('[data-vertice]');
  if (!vEl) { if (verticeSel != null) { verticeSel = null; aggiorna(); } return; }
  const k = Number(vEl.dataset.vertice);
  const pareti = progetto.piano.pareti, V = calcolaVertici(pareti);
  const estremo = k === 0 || k === V.length - 1;
  e.stopImmediatePropagation(); e.preventDefault();
  try { svg.setPointerCapture(e.pointerId); } catch (_) { /* niente */ }
  vbFisso = svg.getAttribute('viewBox');
  if (aggiuntaParete && estremo) {
    tracciaML = { tipo: 'nuova', estremo: k === 0 ? 'inizio' : 'fine', da: V[k], mosso: false };
  } else {
    registraStoria();
    tracciaML = { tipo: 'vertice', k, mosso: false };
  }
  tastiML = '';
}, true);
svg.addEventListener('pointermove', (e) => {
  if (!tracciaML) return;
  e.stopImmediatePropagation();
  const P0 = puntoMm(e);
  const V = calcolaVertici(progetto.piano.pareti);
  if (tracciaML.tipo === 'nuova') {
    const P = agganciaSquadra(P0, [tracciaML.da], 7);
    const dx = P.x - tracciaML.da.x, dy = P.y - tracciaML.da.y;
    let L = Math.round(Math.hypot(dx, dy) / 10) * 10;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (tastiML) L = Number(tastiML);
    const rad = (ang * Math.PI) / 180;
    const B = { x: tracciaML.da.x + Math.cos(rad) * L, y: tracciaML.da.y + Math.sin(rad) * L };
    tracciaML.L = L; tracciaML.ang = ang; tracciaML.mosso = L >= 50;
    anteprimaML = { a: tracciaML.da, b: B, testo: `${L} mm` };
    mostraInfoML(e, `${L} mm${P.agganciato ? ' · ⟂' : ` · ${fmtG(((ang % 360) + 360) % 360)}`}${tastiML ? '' : ` · ${trML('scrivi la misura e Invio')}`}`);
  } else {
    const k = tracciaML.k;
    tracciaML.mosso = true;
    if (k === 0 || k === progetto.piano.pareti.length) {
      mostraInfoML(e, muoviEstremoML(k, P0));            // estremità: angolo al giunto + misura
    } else {
      const P = agganciaSquadra({ x: Math.round(P0.x / 5) * 5, y: Math.round(P0.y / 5) * 5 }, [V[k - 1], V[k + 1]], 5);
      muoviVertice(progetto, k, P.x, P.y);
      const pareti = progetto.piano.pareti;
      const ang = angoloInternoVertice(pareti, k);
      const lung = [pareti[k - 1], pareti[k]].filter(Boolean).map((p) => `${p.lunghezza_mm}`).join(' / ');
      mostraInfoML(e, `${ang != null ? `${trML('Angolo')} ${fmtG(ang)} · ` : ''}${lung} mm`);
    }
  }
  disegna();
}, true);
const fineML = (e) => {
  if (!tracciaML) return;
  if (e) e.stopImmediatePropagation();
  const tr = tracciaML; tracciaML = null; anteprimaML = null; vbFisso = null; infoML.hidden = true;
  if (tr.tipo === 'nuova') {
    if (tr.mosso || tastiML) {
      registraStoria();
      const id = aggiungiPareteLibera(progetto, tr.estremo, Number(tastiML) || tr.L, tr.ang);
      pareteSelId = id; verticeSel = null;
    }
  } else {
    verticeSel = tr.k;                     // vertice selezionato: si può scrivere l'angolo
    if (!tr.mosso && storiaPast.length) storiaPast.pop();
  }
  tastiML = '';
  aggiorna();
};
svg.addEventListener('pointerup', fineML, true);
svg.addEventListener('pointercancel', fineML, true);
document.addEventListener('keydown', (e) => {
  if (progetto.stepCorrente !== 1 || !manoLibera) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (/^[0-9]$/.test(e.key) || ((e.key === ',' || e.key === '.') && !tastiML.includes('.'))) {
    tastiML += e.key === ',' ? '.' : e.key;
  } else if (e.key === 'Backspace') {
    tastiML = tastiML.slice(0, -1);
  } else if (e.key === 'Escape') {
    if (seguiML) { fineSeguiML(); return; }
    tastiML = ''; aggiuntaParete = false; verticeSel = null; infoML.hidden = true; aggiorna(); return;
  } else if (e.key === 'Enter') {
    const v = Number(tastiML);
    if (tracciaML) return;                  // durante il trascinamento vale al rilascio
    if (seguiML) { if (v >= 50) { const V = calcolaVertici(progetto.piano.pareti); muoviEstremoML(seguiML.k, V[seguiML.k]); } fineSeguiML(); return; }
    const nP = progetto.piano.pareti.length;
    if (v >= 50 && (verticeSel === 0 || (verticeSel === nP && nP > 0))) {
      // estremità selezionata: misura della parete attaccata (stessa direzione)
      registraStoria();
      const V = calcolaVertici(progetto.piano.pareti);
      muoviEstremoML(verticeSel, V[verticeSel]);
      tastiML = ''; infoML.hidden = true; aggiorna(); return;
    }
    if (v > 0) {
      registraStoria();
      if (verticeSel != null && angoloInternoVertice(progetto.piano.pareti, verticeSel) != null) {
        if (v < 360) impostaAngoloVertice(progetto, verticeSel, v);
      } else if (pareteSelId != null) {
        const p = progetto.piano.pareti.find((x) => x.id === pareteSelId);
        if (p && v >= 50) { p.lunghezza_mm = Math.round(v); progetto.pianoConfermato = false; }
      }
    }
    tastiML = ''; infoML.hidden = true; aggiorna(); return;
  } else return;
  e.preventDefault();
  // mostra cosa si sta scrivendo
  const r = svg.getBoundingClientRect();
  const nP2 = progetto.piano.pareti.length;
  const estSel = seguiML || verticeSel === 0 || (verticeSel === nP2 && nP2 > 0);
  const cosa = (tracciaML && tracciaML.tipo === 'nuova') || estSel ? trML('Lunghezza') + ': ' + (tastiML || '…') + ' mm'
    : verticeSel != null ? trML('Angolo') + ': ' + (tastiML || '…') + '°'
      : pareteSelId != null ? trML('Lunghezza') + ': ' + (tastiML || '…') + ' mm' : trML('Tocca un vertice o una parete');
  infoML.textContent = `⌨ ${cosa}${tastiML ? ' — ' + trML('Invio') : ''}`; infoML.hidden = false;
  infoML.style.left = `${r.width / 2 - 80}px`; infoML.style.top = '12px';
  if (tracciaML && tracciaML.tipo === 'nuova' && tastiML) {
    const rad = (tracciaML.ang * Math.PI) / 180, L = Number(tastiML);
    anteprimaML = { a: tracciaML.da, b: { x: tracciaML.da.x + Math.cos(rad) * L, y: tracciaML.da.y + Math.sin(rad) * L }, testo: `${L} mm` };
    tracciaML.L = L; disegna();
  }
});

svg.addEventListener('pointerdown', (e) => {
  const mobEl = e.target.closest && e.target.closest('[data-mob-id]');
  const inModuli = progetto.stepCorrente === 2 || progetto.stepCorrente === 3 || progetto.stepCorrente === P_ACC;
  if (mobEl && inModuli) {
    const m = trovaMobileLibero(progetto, Number(mobEl.dataset.mobId));
    if (!m) return;
    // Solo i mobili del livello attivo sono spostabili: gli altri sono bloccati.
    // Al passo Accessori si spostano SOLO gli oggetti; ai passi dei moduli gli oggetti non ci sono.
    if (!spostabileQui(m)) return;
    // SELEZIONE MULTIPLA: Ctrl / Cmd (o «Seleziona più mobili» sul telefono). Un clic senza
    // trascinare aggiunge o toglie il mobile dal gruppo (si decide al rilascio).
    const aggiungi = !!(e.ctrlKey || e.metaKey) || step2.multiModo;
    const membri = mobiliMulti();
    const inGruppo = membri.length > 1 && step2.multiSel.includes(m.id);
    // Spostamento in sospeso su un ALTRO mobile (o gruppo): resta confermato (posManuale).
    if (step2.movePending && (inGruppo ? !step2.movePending.gruppo : (step2.movePending.gruppo || step2.movePending.id !== m.id))) step2.movePending = null;
    const p = puntoMm(e);
    registraStoria();
    vbFisso = svg.getAttribute('viewBox');          // la vista resta FERMA mentre lo sposti (niente zoom che scappa)
    trascinamento = { id: m.id, dx: m.x - p.x, dy: m.y - p.y, mosso: false, aggiungi,
      prima: { x: m.x, y: m.y, rot: m.rot, posManuale: !!m.posManuale },
      // trascinando un mobile del gruppo si spostano tutti insieme
      gruppo: inGruppo ? membri.map((x) => ({ id: x.id, prima: fotoPos(x) })) : null };
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* puntatore non attivo */ }
    e.preventDefault();
    if (!aggiungi && !inGruppo) { step2.mobSelId = m.id; step2.multiSel = []; }
    return;
  }
  const hit = e.target.closest && e.target.closest('[data-parete-id]');
  if (hit && progetto.stepCorrente === 1) {
    const id = Number(hit.dataset.pareteId);
    pareteSelId = pareteSelId === id ? null : id;
    aggiorna();
    return;
  }
  // tocco sul vuoto: deseleziona (anche il gruppo)
  if (step2.mobSelId !== null || pareteSelId !== null || step2.movePending || step2.multiSel.length || step2.multiModo) {
    step2.mobSelId = null; pareteSelId = null; step2.movePending = null; svuotaMulti(); aggiorna();
  }
});
svg.addEventListener('pointermove', (e) => {
  if (!trascinamento) return;
  const m = trovaMobileLibero(progetto, trascinamento.id);
  if (!m) return;
  const p = puntoMm(e);
  // GRUPPO: tutti i mobili selezionati seguono il dito, insieme e alla stessa distanza
  if (trascinamento.gruppo) {
    const ddx = snap(p.x + trascinamento.dx) - trascinamento.prima.x;
    const ddy = snap(p.y + trascinamento.dy) - trascinamento.prima.y;
    if (spostaGruppo(trascinamento.gruppo, ddx, ddy)) { trascinamento.mosso = true; disegna(); }
    return;
  }
  // Ctrl + trascina un mobile fuori dal gruppo: si sposta lui solo (libero), e diventa il selezionato
  if (trascinamento.aggiungi && !trascinamento.mosso && !step2.multiModo) { step2.mobSelId = m.id; step2.multiSel = []; }
  // Aggancio alla griglia fine SOLO sulla posizione del dito; dopo i vincoli
  // (muri e collisioni) non ri-aggancio, così il mobile tocca il vicino esatto.
  const rx = snap(p.x + trascinamento.dx), ry = snap(p.y + trascinamento.dy);
  // Ctrl (o Cmd) tenuto premuto: spostamento LIBERO, senza calamita né
  // riorientamento automatico (micro-aggiustamenti precisi).
  const libera = !!(e.ctrlKey || e.metaKey);
  // Orienta le ante verso l'interno (solo i mobili con un fronte, non costadi/reglette)
  // Mobili a L (base/pensile angolo): si agganciano all'angolo più vicino
  const aL = !libera && /^(base|pensile)-angolo$/.test(m.tipo) ? agganciaAngoloL(progetto, m, rx, ry) : null;
  if (aL) {
    if (aL.x !== m.x || aL.y !== m.y || aL.rot !== m.rot) { m.x = aL.x; m.y = aL.y; m.rot = aL.rot; trascinamento.mosso = true; disegna(); }
    return;
  }
  const haFronte = !['costado', 'regletta'].includes(categoriaTipo(m.tipo)) && !/^(base|pensile)-angolo$/.test(m.tipo);
  // (vicino al muro: ante verso la stanza; accanto a un pezzo di penisola/isola: la sua rotazione;
  //  girato a mano: resta com'è)
  const rot = (!libera && haFronte) ? rotazioneAutomatica(progetto, m, rx, ry) : null;
  const rotCambiata = rot !== null && rot !== m.rot;
  if (rotCambiata) m.rot = rot;
  const info = {};
  const v = posizionaVincolata(progetto, m, rx, ry, libera, info);
  trascinamento.ultimo = { x: rx, y: ry, libera, bloccato: info.bloccato };   // dove l'ha voluto il dito (per l'angolo)
  if (v.x !== m.x || v.y !== m.y || rotCambiata) {
    m.x = v.x; m.y = v.y;
    trascinamento.mosso = true;
    disegna();
  }
});
const fineTrascinamento = () => {
  if (!trascinamento) return;
  vbFisso = null;
  const mosso = trascinamento.mosso;
  const prima = trascinamento.prima;
  const id = trascinamento.id;
  const trascinamento_ultimo = trascinamento.ultimo;
  const aggiungi = trascinamento.aggiungi, gruppo = trascinamento.gruppo;
  trascinamento = null;
  if (!mosso) {
    // Tap senza spostamento: annullo lo snapshot registrato al pointerdown
    if (storiaPast.length) storiaPast.pop();
    // Ctrl / Cmd + clic (o «Seleziona più mobili»): aggiunge o toglie il mobile dal gruppo
    const mt = trovaMobileLibero(progetto, id);
    if (aggiungi && mt) cambiaMulti(mt);
    // clic semplice (senza trascinare) su un mobile del gruppo: resta selezionato solo lui
    else if (gruppo && mt) { step2.multiSel = []; step2.mobSelId = mt.id; step2.movePending = null; }
    aggiorna();
    return;
  }
  if (gruppo) {
    // GRUPPO spostato: posizioni bloccate (posManuale) e barra Conferma / Annulla
    const membri = gruppo.map((g) => trovaMobileLibero(progetto, g.id)).filter(Boolean);
    membri.forEach((x) => { if (categoriaTipo(x.tipo) === 'oggetto') mettiNelVano(progetto, x); x.posManuale = true; });
    if (!step2.movePending || !step2.movePending.gruppo) step2.movePending = { id, prima, gruppo };
    aggiorna();
    return;
  }
  // Mosso: blocca la posizione e chiedi conferma (barra Conferma/Annulla).
  const m = trovaMobileLibero(progetto, id);
  // mobile d'angolo lasciato in un angolo già occupato: va nell'angolo e la fila dell'altro muro scorre
  const ult = trascinamento_ultimo;
  if (m && ult && !ult.libera) inserisciInAngolo(progetto, m, ult.x, ult.y);
  if (m) mettiNelVano(progetto, m);           // oggetto sopra una colonna con vano: dentro il vano
  if (m) { m.posManuale = true; if (categoriaTipo(m.tipo) !== 'oggetto') step2.movePending = { id, prima }; }
  // NON ENTRA: lasciato contro il muro ma non c'è posto → lo dico, con i cm che mancano.
  // Conta se il mobile ha trovato posto, non dove si è alzato il dito: lasciato un filo dentro
  // l'angolo, un costado o il mobile vicino, si mette da solo accanto e va benissimo (niente avviso).
  // Avviso solo se davvero non ci sta: nessun posto libero (resta dov'era), rimasto dentro un
  // altro mobile, o spinto via dal muro dentro la stanza.
  if (m && ult && !ult.libera && !m.isola && categoriaTipo(m.tipo) !== 'oggetto') {
    const mancaFine = spazioMancante(progetto, m, m.x, m.y);
    const aMuroDito = baseAMuro(progetto, { ...m, x: ult.x, y: ult.y }), aMuroFine = baseAMuro(progetto, m);
    if (mancaFine > 2) avvisoNonEntra(mancaFine);
    else if (ult.bloccato || (aMuroDito && !aMuroFine)) { const manca = spazioMancante(progetto, m, ult.x, ult.y); if (manca > 2) avvisoNonEntra(manca); }
  }
  aggiorna();
};
/** Il mobile supera la misura della parete: avviso con i cm che mancano. */
function avvisoNonEntra(manca) {
  const es = window.NGI18N && window.NGI18N.lingua === 'es';
  const cm = (manca / 10).toLocaleString(es ? 'es-ES' : 'it-IT', { maximumFractionDigits: 1 });
  avvisoBreve(es
    ? `Imposible colocar el mueble: supera la medida total de la pared (faltan ${cm} cm).`
    : `Impossibile posizionare l'armadio: supera la misura totale della parete (mancano ${cm} cm).`);
}
/** Messaggio breve in basso (sparisce da solo dopo qualche secondo). */
function avvisoBreve(testo, ok = false) {
  let el = document.getElementById('avviso-breve');
  if (!el) {
    el = document.createElement('div'); el.id = 'avviso-breve'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9500;max-width:min(560px,calc(100vw - 32px));background:#2a1f0e;color:#f3efe6;border:1px solid #c9a94a;border-radius:10px;padding:12px 16px;font:15px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    el.addEventListener('click', () => { el.hidden = true; });
    document.body.appendChild(el);
  }
  el.textContent = (ok ? '✓ ' : '⚠ ') + testo; el.hidden = false;
  clearTimeout(avvisoBreve._t); avvisoBreve._t = setTimeout(() => { el.hidden = true; }, 9000);
}
svg.addEventListener('pointerup', fineTrascinamento);
svg.addEventListener('pointercancel', fineTrascinamento);

// --------- STAMPA DI OGNI PASSO (pianta / mobili bassi / mobili alti) ---------
// Stampa SOLO la pianta (con misure), su fondo bianco, con intestazione. Ai
// passi dei mobili si sceglie cosa stampare: bassi, alti o tutti e due (così
// le misure non si sovrappongono).
const btnStampa = document.getElementById('btn-stampa');
function aggiornaBtnStampa() { if (btnStampa) btnStampa.hidden = progetto.stepCorrente === P_3D || progetto.stepCorrente === P_ACC; }
btnStampa?.addEventListener('click', () => {
  const st = progetto.stepCorrente;
  if (st === 1) { stampaPianta([], 'Pianta'); return; }
  const tr2 = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  const ciSono = (liv) => (progetto.mobiliLiberi || []).some((m) => livelloDiMobile(m) === liv);
  const box = document.createElement('div');
  box.className = 'modale-fondo'; box.id = 'stampa-modale';
  box.innerHTML = `
    <div class="modale" role="dialog" aria-modal="true" style="max-width:380px">
      <h3>${tr2('Cosa stampare')}</h3>
      <label class="imp-vis"><input type="checkbox" id="st-bassi" ${st === 2 ? 'checked' : ''} ${ciSono('basso') ? '' : 'disabled'}> ${tr2('Mobili bassi')}</label>
      <label class="imp-vis"><input type="checkbox" id="st-alti" ${st === 3 ? 'checked' : ''} ${ciSono('alto') ? '' : 'disabled'}> ${tr2('Mobili alti')}</label>
      <div class="riga-3d" style="margin:8px 0">${tr2('Consiglio: stampa bassi e alti separati, così le misure non si sovrappongono.')}</div>
      <div class="orienta-row">
        <button type="button" id="st-ok" class="btn-oro" style="flex:1">🖨 ${tr2('Stampa')}</button>
        <button type="button" id="st-no" class="btn-ghost">${tr2('Annulla')}</button>
      </div>
    </div>`;
  document.body.appendChild(box);
  const chiudi = () => box.remove();
  box.addEventListener('click', (e) => { if (e.target === box) chiudi(); });
  box.querySelector('#st-no').addEventListener('click', chiudi);
  box.querySelector('#st-ok').addEventListener('click', () => {
    const liv = [];
    if (box.querySelector('#st-bassi').checked) liv.push('basso');
    if (box.querySelector('#st-alti').checked) liv.push('alto');
    chiudi();
    stampaPianta(liv, liv.length === 2 ? 'Mobili bassi e alti' : liv[0] === 'alto' ? 'Mobili alti' : liv[0] === 'basso' ? 'Mobili bassi' : 'Pianta');
  });
});
async function stampaPianta(livelli, titolo) {
  const tr2 = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  const fin = window.open('', '_blank');               // aperta subito (i telefoni bloccano le finestre aperte dopo)
  if (!fin) { alert(tr2('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.')); return; }
  // pianta disegnata a parte, in formato A4 orizzontale, solo con i livelli scelti
  const off = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  off.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  off.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  off.style.cssText = 'position:fixed;left:-20000px;top:0;width:1400px;height:900px';
  document.body.appendChild(off);
  renderPianta(off, progetto, { interattivo: false, livelloAttivo: null, livelliVisibili: livelli });
  await new Promise((r) => setTimeout(r, 120));        // tempo per tradurre le scritte (ES)
  off.removeAttribute('style');                        // nella pagina di stampa deve stare in vista
  const svgTxt = new XMLSerializer().serializeToString(off);
  off.remove();
  const base = location.href.replace(/[^/]*$/, '');
  const ver = (document.querySelector('script[src*="cucina/main.js"]')?.src.match(/v=([\w]+)/) || [])[1] || '';
  const d = new Date(), data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const nomeProg = progetto.nome || progetto.cliente || '';
  fin.document.write(`<!doctype html><html lang="${document.documentElement.lang || 'it'}" data-theme="chiaro"><head><meta charset="utf-8">
<title>${tr2(titolo)}</title><base href="${base}">
<link rel="stylesheet" href="css/style.css?v=${ver}"><link rel="stylesheet" href="css/cucina.css?v=${ver}">
<style>
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #fff !important; color: #111; margin: 0; }
  .st-testa { display: flex; justify-content: space-between; align-items: baseline; font-family: Inter, Arial, sans-serif; padding: 6px 4px 8px; border-bottom: 2px solid #b8963a; }
  .st-testa h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  .st-testa div { font-size: 12px; color: #555; }
  svg { width: 100%; height: calc(100vh - 60px); display: block; background: #fff !important; }
  .sv-griglia, .sv-grid { opacity: .35; }
  /* su carta bianca: scritte scure e bordi marcati */
  .sv-mod-label, .sv-mod-label tspan, .sv-mod-label-mis { fill: #1a1a1a !important; }
  .sv-quota, text.sv-quota { fill: #1a1a1a !important; }
  .sv-mob, .sv-mod { stroke: #8a6a14 !important; fill: rgba(201,169,74,.12) !important; }
  .sv-mob-pensile { stroke: #2b6f9e !important; fill: rgba(80,150,200,.10) !important; }
  .sv-parete, .sv-parete-conf { stroke: #222 !important; }
  .sv-mob-anta { stroke: #8a6a14 !important; }
  @media print { svg { height: 175mm; } }
</style></head><body>
<div class="st-testa"><h1>NG INTERIOR · ${tr2(titolo)}</h1><div>${nomeProg ? nomeProg + ' · ' : ''}${data} · ${tr2('misure in mm')}</div></div>
${svgTxt}
<script>window.onload = () => setTimeout(() => { window.focus(); window.print(); }, 300);<\/script>
</body></html>`);
  fin.document.close();
}

// Tema chiaro/scuro
agganciaTema();

// Primo caricamento
aggiorna();
