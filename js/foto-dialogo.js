// =============================================================================
// FINESTRA "FOTO REALISTICA" (cucina, armadi, mobili modulari)
// =============================================================================
// La foto è la vista 3D com'è (stessa luce, stesse ombre, stessi materiali:
// il legno identico alla foto del campione) in ALTA RISOLUZIONE, subito:
// anteprima → salva con il logo. Ogni pagina passa la sua funzione `calcola`
// (quella della sua scena 3D).
// =============================================================================
import { componiConLogo, salvaImmagineCanvas } from './logo.js?v=20261117a';

const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
function dataFile() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
let inCorso = false;

/**
 * Apre la finestra e scatta la foto. opz: {
 *   calcola({ larghezza, altezza }) → Promise<canvas|null>,
 *   tela3d: il canvas della vista 3D (per le proporzioni della foto),
 *   nome: prefisso del file ('cucina', 'armadio', 'mobile')
 * }
 */
export async function apriFotoRealistica(opz) {
  if (inCorso || !opz || typeof opz.calcola !== 'function') return;
  let ov = document.getElementById('foto-reale');
  if (!ov) { ov = document.createElement('div'); ov.id = 'foto-reale'; ov.className = 'foto-reale'; document.body.appendChild(ov); }
  ov.innerHTML = `
    <div class="foto-reale-box">
      <h2>✨ ${tt('Foto realistica')}</h2>
      <div class="foto-reale-anteprima"><img id="fr-img" alt=""><div class="foto-reale-attesa" id="fr-attesa">${tt('Preparo la foto…')}</div></div>
      <div class="foto-reale-testo" id="fr-stato">${tt('La vista 3D com\'è, in alta risoluzione: stessa luce, stesse ombre, stessi materiali. Sistema prima l\'inquadratura come vuoi.')}</div>
      <div class="foto-reale-azioni" id="fr-azioni"></div>
    </div>`;
  ov.hidden = false;
  const tela3d = opz.tela3d;
  const cw = (tela3d && tela3d.clientWidth) || 1600, ch = (tela3d && tela3d.clientHeight) || 1000;
  const telefono = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const k = (telefono ? 2400 : 3200) / Math.max(cw, ch);
  inCorso = true;
  let foto = null;
  try {
    await new Promise((r) => requestAnimationFrame(() => r()));          // la finestra si vede prima dello scatto
    foto = await opz.calcola({ larghezza: Math.round(cw * k), altezza: Math.round(ch * k) });
  } catch (e) { console.error(e); foto = null; } finally { inCorso = false; }
  const azioni = ov.querySelector('#fr-azioni'), stato = ov.querySelector('#fr-stato');
  if (!foto) {
    stato.textContent = tt('Impossibile salvare l\'immagine su questo dispositivo.');
    azioni.innerHTML = `<button type="button" class="btn-ghost" data-fr="chiudi">${tt('Chiudi')}</button>`;
    azioni.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
    return;
  }
  ov.querySelector('#fr-img').src = foto.toDataURL('image/jpeg', 0.9);
  ov.querySelector('#fr-attesa').hidden = true;
  stato.textContent = `✓ ${tt('Foto pronta')} · ${foto.width}×${foto.height} px`;
  azioni.innerHTML = `
    <button type="button" class="btn-ghost" data-fr="chiudi">${tt('Chiudi')}</button>
    <button type="button" class="btn-oro" data-fr="salva">💾 ${tt('Salva la foto')}</button>`;
  azioni.querySelector('[data-fr="chiudi"]').onclick = () => { ov.hidden = true; };
  azioni.querySelector('[data-fr="salva"]').onclick = () => {
    let c = foto;
    try { c = componiConLogo(foto) || foto; } catch (_) { c = foto; }
    const ok = salvaImmagineCanvas(c, `${opz.nome || 'progetto'}-foto-${dataFile()}.jpg`, 'image/jpeg', 0.93);
    if (!ok) alert(tt('Impossibile salvare l\'immagine su questo dispositivo.'));
  };
}
