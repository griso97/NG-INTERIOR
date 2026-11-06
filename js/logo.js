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

/** Vero se siamo su un telefono/tablet (euristica user-agent). */
export function isMobile() {
  const ua = navigator.userAgent || '';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)); // iPad in modalità desktop
}

/**
 * Lato massimo (px) dell'immagine esportata: Full HD su telefono (buona
 * qualità, leggero, compatibile con tutti i dispositivi), un filo più alto
 * su computer. Niente risoluzioni estreme (evita crash/pesantezza).
 */
export function latoMaxExport() { return isMobile() ? 1920 : 2560; }

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

  // 1) Condivisione nativa con file (ideale su mobile → "Salva su Foto").
  if (blob && navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], nomeFile, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'NG Interior' })
          .catch((err) => { if (!err || err.name !== 'AbortError') mostraOverlay(dataURL, nomeFile, blob); });
        return true;
      }
    } catch (e) { /* fallback sotto */ }
  }

  // 2) Desktop: download diretto del file.
  if (!isMobile()) {
    try {
      const url = blob ? URL.createObjectURL(blob) : dataURL;
      const a = document.createElement('a');
      a.href = url; a.download = nomeFile; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      if (blob) setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) { /* overlay sotto */ }
  }

  // 3) Fallback universale (mobile senza condivisione, o errori): mostro
  //    l'immagine a schermo intero da tenere premuta per salvarla.
  mostraOverlay(dataURL, nomeFile, blob);
  return true;
}

/**
 * Overlay a schermo intero con l'immagine generata: su telefono si tiene
 * premuto per "Salva su Foto", su desktop c'è il pulsante Scarica.
 */
function mostraOverlay(dataURL, nomeFile, blob) {
  const back = document.createElement('div');
  back.setAttribute('role', 'dialog');
  back.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.9);'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'gap:14px;padding:18px;box-sizing:border-box;';
  const hint = document.createElement('div');
  hint.textContent = 'Tieni premuto l’immagine e scegli “Salva su Foto” (oppure usa Scarica).';
  hint.style.cssText = 'color:#fff;font:500 15px/1.45 system-ui,-apple-system,sans-serif;'
    + 'text-align:center;max-width:540px;';
  const img = document.createElement('img');
  img.src = dataURL;
  img.alt = nomeFile;
  img.style.cssText = 'max-width:92vw;max-height:64vh;object-fit:contain;border-radius:8px;'
    + 'box-shadow:0 10px 40px rgba(0,0,0,.55);-webkit-touch-callout:default;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
  const dl = document.createElement('a');
  dl.textContent = '⬇ Scarica';
  dl.href = blob ? URL.createObjectURL(blob) : dataURL;
  dl.download = nomeFile;
  dl.style.cssText = 'background:#c9a94a;color:#1a1a1a;font:600 15px system-ui;'
    + 'padding:12px 22px;border-radius:9px;text-decoration:none;';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Chiudi';
  close.style.cssText = 'background:#333;color:#fff;font:600 15px system-ui;'
    + 'padding:12px 22px;border-radius:9px;border:none;cursor:pointer;';
  const chiudi = () => {
    back.remove();
    if (dl.href && dl.href.indexOf('blob:') === 0) setTimeout(() => URL.revokeObjectURL(dl.href), 3000);
  };
  close.addEventListener('click', chiudi);
  back.addEventListener('click', (e) => { if (e.target === back) chiudi(); });
  row.appendChild(dl); row.appendChild(close);
  back.appendChild(hint); back.appendChild(img); back.appendChild(row);
  document.body.appendChild(back);
}
