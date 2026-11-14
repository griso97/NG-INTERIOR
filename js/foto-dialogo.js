// =============================================================================
// FINESTRA "FOTO REALISTICA" (cucina, armadi, mobili modulari)
// =============================================================================
// Scelta della qualità → calcolo con avanzamento e anteprima → salva con il
// logo. Il calcolo vero è in foto-realistica.js: ogni pagina passa la sua
// funzione `calcola` (quella della sua scena 3D).
// =============================================================================
import { componiConLogo, salvaImmagineCanvas } from './logo.js?v=20261115v';

// campioniIA: con la pulizia IA (WebGPU) bastano molti meno passaggi
export const QUALITA_FOTO = [
  { id: 'rapida', nome: 'Rapida', lato: 1280, campioniIA: 64, campioni: 200, nota: 'per vedere subito come viene' },
  { id: 'alta', nome: 'Alta', lato: 1920, campioniIA: 192, campioni: 500, nota: 'consigliata (Full HD)' },
  { id: 'massima', nome: 'Massima', lato: 2560, campioniIA: 480, campioni: 1000, nota: 'la più bella, più lenta' },
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
  const telefono = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  ov.innerHTML = `
    <div class="foto-reale-box">
      <h2>✨ ${tt('Foto realistica')}</h2>
      <div class="foto-reale-testo">${tt('Il progetto viene calcolato come una foto vera: luce del giorno che entra da una finestra, luce che rimbalza su muri e pavimento, ombre morbide, riflessi, vetri e LED veri. Alla fine un\'intelligenza artificiale toglie la grana. Si usa l\'inquadratura della vista 3D: sistemala prima come vuoi.')}</div>
      <div class="foto-reale-qualita">
        ${QUALITA_FOTO.filter((q) => !(telefono && q.id === 'massima')).map((q) => `
        <label class="foto-reale-q"><input type="radio" name="fq" value="${q.id}" ${q.id === 'alta' ? 'checked' : ''}>
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
    const q = QUALITA_FOTO.find((x) => x.id === (ov.querySelector('input[name="fq"]:checked') || {}).value) || QUALITA_FOTO[1];
    calcolaFoto(ov, q, opz);
  };
}

async function calcolaFoto(ov, q, opz) {
  const tela3d = opz.tela3d;
  const cw = (tela3d && tela3d.clientWidth) || 1600, ch = (tela3d && tela3d.clientHeight) || 1000;
  const k = q.lato / Math.max(cw, ch);
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
  const t0 = performance.now();
  inCorso = true;
  let foto = null;
  try {
    foto = await opz.calcola({
      larghezza: W, altezza: H, campioni: q.campioni, campioniIA: q.campioniIA,
      annullato: () => fermato,
      onProgress: (f, tela, info = {}) => {
        barra.style.width = `${Math.round(f * 100)}%`;
        const sec = Math.round((performance.now() - t0) / 1000);
        const resto = f > 0.03 && f < 0.9 ? Math.max(0, Math.round((sec / f) * 0.95 - sec)) : null;
        if (info.fase === 'pulizia') { stato.textContent = `${tt('Tolgo la grana con l\'intelligenza artificiale…')} · ${sec} s`; bFerma.disabled = true; }
        else if (info.fase === 'sviluppo') stato.textContent = `${tt('Sviluppo la foto…')} · ${sec} s`;
        else if (info.fase !== 'fine') stato.textContent = `${tt('Calcolo la luce…')} ${Math.round(Math.min(1, f / 0.9) * 100)}% · ${sec} s${resto != null ? ` · ${tt('ancora circa')} ${resto} s` : ''}`;
        if (tela) { try { img.src = tela.toDataURL('image/jpeg', 0.85); ov.querySelector('#fr-attesa').hidden = true; } catch (_) { /* niente */ } }
      },
    });
  } catch (e) {
    console.error(e);
    foto = null;
  } finally { inCorso = false; }
  const azioni = ov.querySelector('#fr-azioni');
  if (!foto) {
    if (!fermato) stato.textContent = tt('Questo dispositivo non riesce a calcolare la foto realistica. Prova da un computer.');
    azioni.innerHTML = `<button type="button" class="btn-ghost" data-fr="chiudi">${tt('Chiudi')}</button>`;
    azioni.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
    return;
  }
  img.src = foto.toDataURL('image/jpeg', 0.92); ov.querySelector('#fr-attesa').hidden = true;
  barra.style.width = '100%';
  stato.textContent = `✓ ${tt('Foto pronta')} · ${W}×${H} px · ${Math.round((performance.now() - t0) / 1000)} s`;
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
