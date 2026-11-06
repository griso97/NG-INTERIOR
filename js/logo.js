// =============================================================================
// LOGO per le immagini esportate — NG INTERIOR
// =============================================================================
// Carica il logo una volta e lo sovrappone in basso a destra all'immagine
// del rendering prima del salvataggio.
// =============================================================================

const logoImg = new Image();
let logoPronto = false;
logoImg.onload = () => { logoPronto = true; };
logoImg.onerror = () => { logoPronto = false; };
// Percorso relativo alla PAGINA (cucina.html / configuratore.html sono in root)
logoImg.src = 'img/logo.png';

/** Il logo è stato caricato? */
export function logoCaricato() { return logoPronto; }

/**
 * Restituisce un canvas 2D con l'immagine `sorgente` (il canvas del rendering)
 * e il logo sovrapposto in basso a destra. Se il logo non è ancora pronto,
 * ritorna comunque l'immagine senza logo.
 */
export function componiConLogo(sorgente) {
  const W = sorgente.width, H = sorgente.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(sorgente, 0, 0);
  if (logoPronto && logoImg.width > 0) {
    const lw = Math.round(W * 0.16);                 // larghezza logo ~16%
    const lh = Math.round(lw * logoImg.height / logoImg.width);
    const margin = Math.round(W * 0.025);
    ctx.globalAlpha = 0.96;
    ctx.drawImage(logoImg, W - lw - margin, H - lh - margin, lw, lh);
    ctx.globalAlpha = 1;
  }
  return c;
}

/** data:URL → Blob (sincrono, così resta dentro il gesto dell'utente). */
function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(',');
  const mime = (head.match(/:(.*?);/) || [, 'image/png'])[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Salva/condivide l'immagine di un canvas 2D.
 * - Su TELEFONO usa la condivisione nativa (menù "Salva immagine/foto"),
 *   perché il download via link spesso non salva nulla (specie su iPhone).
 * - Su desktop scarica il file PNG.
 * Tutto resta sincrono fino alla chiamata di share/click, così non si perde
 * il "gesto utente" richiesto dai browser.
 */
export function salvaImmagineCanvas(canvas, nomeFile) {
  let dataURL;
  try { dataURL = canvas.toDataURL('image/png'); } catch (e) { return false; }
  let blob;
  try { blob = dataURLtoBlob(dataURL); } catch (e) { blob = null; }

  // 1) Condivisione nativa con file (ideale su mobile)
  if (blob && navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], nomeFile, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'NG Interior' }).catch(() => {});
        return true;
      }
    } catch (e) { /* fallback sotto */ }
  }

  // 2) Download classico (desktop e Android con download manager)
  try {
    const url = blob ? URL.createObjectURL(blob) : dataURL;
    const a = document.createElement('a');
    a.href = url; a.download = nomeFile; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    if (blob) setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (e) { /* ultimo fallback */ }

  // 3) Apri in una nuova scheda: l'utente tiene premuto per salvare
  try { window.open(blob ? URL.createObjectURL(blob) : dataURL, '_blank'); return true; }
  catch (e) { return false; }
}
