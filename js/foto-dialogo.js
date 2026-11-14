// =============================================================================
// FINESTRA "FOTO REALISTICA" (cucina, armadi, mobili modulari)
// =============================================================================
// Scelta della qualità → calcolo con avanzamento e anteprima → salva con il
// logo. Il calcolo vero è in foto-realistica.js: ogni pagina passa la sua
// funzione `calcola` (quella della sua scena 3D).
// =============================================================================
import { componiConLogo, salvaImmagineCanvas } from './logo.js?v=20261115y';

// La foto ha un TEMPO MASSIMO (non un numero fisso di passaggi): su ogni dispositivo
// finisce quando promesso; la risoluzione del calcolo si adatta alla sua velocità.
// campioniIA / campioni: dove fermarsi prima se il dispositivo è veloce (con la
// pulizia IA ne bastano molti meno).
export const QUALITA_FOTO = [
  { id: 'foto', nome: 'Foto', lato: 1920, latoTel: 1600, tempo: 25, campioniIA: 96, campioni: 320, nota: 'pronta in circa 30 secondi' },
  { id: 'bella', nome: 'Più bella', lato: 2560, latoTel: 2048, tempo: 75, campioniIA: 256, campioni: 1024, nota: 'più nitida, circa 1 minuto e mezzo' },
];

const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
function dataFile() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
let inCorso = false;

/**
 * Apre la finestra. opz: {
 *   calcola(parametri) → Promise<canvas|null>  (parametri: larghezza, altezza,
 *     campioni, campioniIA, annullato, onProgress),
 *   tela3d: il canvas della vista 3D (per le proporzioni della foto),
 *   nome: prefisso del file ('cucina', 'armadio', 'mobile')
 * }
 */
export function apriFotoRealistica(opz) {
  if (inCorso || !opz || typeof opz.calcola !== 'function') return;
  let ov = document.getElementById('foto-reale');
  if (!ov) { ov = document.createElement('div'); ov.id = 'foto-reale'; ov.className = 'foto-reale'; document.body.appendChild(ov); }
  // SUBITO: la vista realistica che si vede adesso, se è già finita (nessuna attesa)
  let pronta = null;
  try { pronta = typeof opz.subito === 'function' ? opz.subito() : null; } catch (_) { pronta = null; }
  ov.innerHTML = `
    <div class="foto-reale-box">
      <h2>✨ ${tt('Foto realistica')}</h2>
      <div class="foto-reale-testo">${tt('Il progetto viene calcolato come una foto vera: luce del giorno che entra da una finestra, luce che rimbalza su muri e pavimento, ombre morbide, riflessi, vetri e LED veri. Alla fine un\'intelligenza artificiale toglie la grana. Si usa l\'inquadratura della vista 3D: sistemala prima come vuoi.')}</div>
      <div class="foto-reale-qualita">
        <label class="foto-reale-q${pronta ? '' : ' spenta'}"><input type="radio" name="fq" value="subito" ${pronta ? 'checked' : 'disabled'}>
          <span><strong>${tt('Subito')}</strong><br><small>${pronta ? tt('la vista realistica così com\'è, senza attesa') : tt('appena la vista 3D diventa realistica (fermati un attimo) si salva senza attesa')}</small></span></label>
        ${QUALITA_FOTO.map((q) => `
        <label class="foto-reale-q"><input type="radio" name="fq" value="${q.id}" ${!pronta && q.id === 'foto' ? 'checked' : ''}>
          <span><strong>${tt(q.nome)}</strong><br><small>${tt(q.nota)}</small></span></label>`).join('')}
      </div>
      <div class="foto-reale-azioni">
        <button type="button" class="btn-ghost" data-fr="chiudi">${tt('Annulla')}</button>
        <button type="button" class="btn-oro" data-fr="via">${tt('Inizia la foto')}</button>
      </div>
    </div>`;
  ov.hidden = false;
  ov.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
  ov.querySelector('[data-fr="via"]').onclick = () => {
    const scelta = (ov.querySelector('input[name="fq"]:checked') || {}).value;
    if (scelta === 'subito' && pronta) { mostraPronta(ov, pronta, opz, 0, true); return; }
    const q = QUALITA_FOTO.find((x) => x.id === scelta) || QUALITA_FOTO[0];
    calcolaFoto(ov, q, opz);
  };
}

/** La foto finita: anteprima + Salva (con il logo, JPEG). */
function mostraPronta(ov, foto, opz, secondi, nuovaFinestra = false) {
  if (nuovaFinestra) {
    ov.innerHTML = `
      <div class="foto-reale-box">
        <h2>✨ ${tt('Foto realistica')}</h2>
        <div class="foto-reale-anteprima"><img id="fr-img" alt=""></div>
        <div class="foto-reale-barra"><div id="fr-barra"></div></div>
        <div class="foto-reale-testo" id="fr-stato"></div>
        <div class="foto-reale-azioni" id="fr-azioni"></div>
      </div>`;
  }
  const img = ov.querySelector('#fr-img'), att = ov.querySelector('#fr-attesa');
  img.src = foto.toDataURL('image/jpeg', 0.92);
  if (att) att.hidden = true;
  ov.querySelector('#fr-barra').style.width = '100%';
  ov.querySelector('#fr-stato').textContent = `✓ ${tt('Foto pronta')} · ${foto.width}×${foto.height} px` + (secondi ? ` · ${secondi} s` : '');
  const azioni = ov.querySelector('#fr-azioni');
  azioni.innerHTML = `
    <button type="button" class="btn-ghost" data-fr="chiudi">${tt('Chiudi')}</button>
    <button type="button" class="btn-oro" data-fr="salva">💾 ${tt('Salva la foto')}</button>`;
  azioni.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
  azioni.querySelector('[data-fr="salva"]').onclick = () => {
    let c = foto;
    try { c = componiConLogo(foto) || foto; } catch (_) { c = foto; }
    // JPEG di alta qualità: una foto "vera" in PNG peserebbe 5-8 MB
    const ok = salvaImmagineCanvas(c, `${opz.nome || 'progetto'}-foto-${dataFile()}.jpg`, 'image/jpeg', 0.93);
    if (!ok) alert(tt('Impossibile salvare l\'immagine su questo dispositivo.'));
  };
}

async function calcolaFoto(ov, q, opz) {
  const tela3d = opz.tela3d;
  const cw = (tela3d && tela3d.clientWidth) || 1600, ch = (tela3d && tela3d.clientHeight) || 1000;
  const telefono = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const k = (telefono ? q.latoTel : q.lato) / Math.max(cw, ch);
  const W = Math.max(64, Math.round(cw * k)), H = Math.max(64, Math.round(ch * k));
  ov.innerHTML = `
    <div class="foto-reale-box">
      <h2>✨ ${tt('Foto realistica')}</h2>
      <div class="foto-reale-anteprima"><img id="fr-img" alt=""><div class="foto-reale-attesa" id="fr-attesa">${tt('Preparo la scena…')}</div></div>
      <div class="foto-reale-barra"><div id="fr-barra"></div></div>
      <div class="foto-reale-testo" id="fr-stato">${tt('Calcolo la luce…')}</div>
      <div class="foto-reale-azioni" id="fr-azioni">
        <button type="button" class="btn-ghost" data-fr="ferma">${tt('Ferma e usa così')}</button>
      </div>
    </div>`;
  let fermato = false;
  const bFerma = ov.querySelector('[data-fr="ferma"]');
  bFerma.onclick = () => { fermato = true; bFerma.disabled = true; };
  const img = ov.querySelector('#fr-img'), barra = ov.querySelector('#fr-barra'), stato = ov.querySelector('#fr-stato');
  // anteprima mentre calcola: quello che si vede ora nella vista 3D (stessa inquadratura)
  try { if (tela3d) { img.src = tela3d.toDataURL('image/jpeg', 0.8); ov.querySelector('#fr-attesa').hidden = true; } } catch (_) { /* niente */ }
  const t0 = performance.now();
  inCorso = true;
  let foto = null;
  try {
    foto = await opz.calcola({
      larghezza: W, altezza: H, campioni: q.campioni, campioniIA: q.campioniIA, tempoMax: q.tempo,
      annullato: () => fermato,
      onProgress: (f, tela, info = {}) => {
        barra.style.width = `${Math.round(f * 100)}%`;
        const sec = Math.round((performance.now() - t0) / 1000);
        const resto = f > 0.03 && f < 0.9 ? Math.max(0, Math.round((sec / f) * 0.95 - sec)) : null;
        if (info.fase === 'preparo') stato.textContent = `${tt('Preparo la scena…')} · ${sec} s`;
        else if (info.fase === 'pulizia') { stato.textContent = `${tt('Tolgo la grana…')} · ${sec} s`; bFerma.disabled = true; }
        else if (info.fase === 'sviluppo') stato.textContent = `${tt('Sviluppo la foto…')} · ${sec} s`;
        else if (info.fase !== 'fine') stato.textContent = `${tt('Calcolo la luce…')} ${Math.round(Math.min(1, f / 0.9) * 100)}% · ${sec} s${resto != null ? ` · ${tt('ancora circa')} ${resto} s` : ''}`;
        if (tela) { try { img.src = tela.toDataURL('image/jpeg', 0.85); ov.querySelector('#fr-attesa').hidden = true; } catch (_) { /* niente */ } }
      },
    });
  } catch (e) {
    console.error(e);
    foto = null;
  } finally { inCorso = false; }
  if (!foto) {
    const azioni = ov.querySelector('#fr-azioni');
    if (!fermato) stato.textContent = tt('Questo dispositivo non riesce a calcolare la foto realistica. Prova da un computer.');
    azioni.innerHTML = `<button type="button" class="btn-ghost" data-fr="chiudi">${tt('Chiudi')}</button>`;
    azioni.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
    return;
  }
  mostraPronta(ov, foto, opz, Math.round((performance.now() - t0) / 1000));
}
