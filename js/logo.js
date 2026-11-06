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
