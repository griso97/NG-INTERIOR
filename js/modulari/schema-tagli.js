// =============================================================================
// MOBILI MODULARI — Schema dei tagli inclinati (immagine con i gradi)
// =============================================================================
// Disegno del giunto lato alto (vista frontale): fianco a piombo, top
// parallelo alla scala, con angoli e abbondanze del progetto. Serve come
// "allegato" alla distinta: va nell'Excel (foglio "Schema tagli") e si può
// scaricare come PNG.
// =============================================================================
import { gradi } from './calcoli.js?v=20261113j';

const W = 1100, H = 830;
const FONT = 'Arial, Helvetica, sans-serif';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cm = (mm) => `${String(Math.round(mm) / 10).replace('.', ',')} cm`;
const piu = (mm, resto) => (mm > 0 ? `tagliato +${cm(mm)} più lungo, ${resto}` : 'tagliato a misura (nessuna abbondanza)');

/**
 * opz = { angolo (°), spessore (mm carcassa), abbFianchi, abbTop (mm),
 *         moduli: ['Modulo 1', …], triangolo: bool, titolo }
 */
export function schemaTagliSVG(opz) {
  const a = opz.angolo, r = (a * Math.PI) / 180, t = Math.tan(r);
  const sC = opz.spessore || 18;
  const yTop = 165, yF = 680;
  // mm → px: grande per leggere, ma deve stare tutto anche con scale ripide
  const k = Math.min(6, (yF - yTop - 70) / (sC * (1 / Math.cos(r) + t)));
  const F = sC * k, TV = (sC / Math.cos(r)) * k;
  const X0 = 380, Y0 = yTop + TV;
  const yl = (x) => Y0 + (x - X0) * t;                        // sotto del top = bordo alto fianco
  const xEnd = Math.min(W - 160, X0 + (yF - 12 - Y0) / Math.max(t, 1e-6));
  const arco = (cx, cy, rr, a1, a2) => {
    const p = (g) => [cx + rr * Math.cos((g * Math.PI) / 180), cy + rr * Math.sin((g * Math.PI) / 180)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${rr} ${rr} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const g90 = gradi(90 - a), g90p = gradi(90 + a), ga = gradi(a);
  const xm = Math.min(X0 + 0.5 * (xEnd - X0), W - 450), ym = yl(xm) - TV;     // punto a metà del top (faccia sopra)
  const moduli = (opz.moduli || []).join(', ');
  const piede = [
    'Fondo, ripiani e schiena sono già a misura: il fondo è dritto, non va tagliato inclinato.',
    `Ante e pannelli fissi a trapezio/triangolo: lato alto a ${ga} sul piano (angoli ${g90} e ${g90p}), ${opz.abbAnte > 0 ? `+${cm(opz.abbAnte)} sul lato inclinato, da rifilare a filo in opera` : 'a misura'}.`,
    ...(opz.triangolo ? [`Chiusura triangolare: punta bassa del top orizzontale in appoggio sul fondo → lama ${g90} (punta a ${ga}).`] : []),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="24" y="40" font-size="25" font-weight="700" fill="#222">${esc(opz.titolo || 'Schema tagli inclinati')} · scala a ${ga}</text>
<text x="24" y="68" font-size="15" fill="#555">Giunto lato alto, vista frontale. Fianco a piombo (90° col pavimento), top parallelo alla scala.</text>
${moduli ? `<text x="24" y="92" font-size="15" fill="#555">Vale per: ${esc(moduli)}</text>` : ''}
<!-- inclinazione della scala -->
<line x1="${X0}" y1="${yTop}" x2="${X0 + 230}" y2="${yTop}" stroke="#999" stroke-width="1.5" stroke-dasharray="6 5"/>
<path d="${arco(X0, yTop, 110, 0, a)}" fill="none" stroke="#b07a00" stroke-width="2.5"/>
<text x="${X0 + 120}" y="${yTop - 12}" font-size="19" font-weight="700" fill="#b07a00">α = ${ga} (scala)</text>
<!-- fianco -->
<polygon points="${X0},${yF} ${X0 + F},${yF} ${X0 + F},${yl(X0 + F)} ${X0},${Y0}" fill="#e6d3b3" stroke="#333" stroke-width="2"/>
<text x="${X0 + F / 2 + 6}" y="${yF - 20}" font-size="15" fill="#333" transform="rotate(-90 ${X0 + F / 2 + 6} ${yF - 20})">FIANCO ${sC} mm a piombo</text>
<path d="${arco(X0, Y0, Math.min(60, F * 0.6), a, 90)}" fill="none" stroke="#c0392b" stroke-width="3"/>
<text x="${X0 - 10}" y="${Y0 + 40}" font-size="17" font-weight="700" fill="#c0392b" text-anchor="end">${g90}</text>
<!-- top -->
<polygon points="${X0},${Y0} ${xEnd},${yl(xEnd)} ${xEnd},${yl(xEnd) - TV} ${X0},${Y0 - TV}" fill="#d9c09a" stroke="#333" stroke-width="2"/>
<path d="${arco(X0, Y0 - TV, Math.min(45, TV * 0.4), a, 90)}" fill="none" stroke="#1f6fb2" stroke-width="3"/>
<text x="${X0 - 10}" y="${Y0 - TV + 36}" font-size="16" font-weight="700" fill="#1f6fb2" text-anchor="end">${g90}</text>
<line x1="${xEnd}" y1="${yl(xEnd) - TV}" x2="${xEnd + 90}" y2="${yl(xEnd) - TV + 90 * t}" stroke="#999" stroke-width="2" stroke-dasharray="8 6"/>
<!-- callout top -->
${(() => {
  // sopra il top se c'è spazio, altrimenti (scale poco inclinate) sotto
  const sotto = ym - 100 < yTop + 20;
  const xt = Math.min(Math.max(xm + 34, X0 + 170), W - 420);     // inizio testo
  const yb = sotto ? yl(Math.min(xEnd, xt + 420)) + 32 : Math.min(ym - 92, yl(xt) - TV - 92);
  const yA = sotto ? yl(xm) : ym, yB = sotto ? yb - 18 : yb + 70;
  return `<line x1="${xm}" y1="${yA}" x2="${xt - 4}" y2="${yB}" stroke="#1f6fb2" stroke-width="1.5"/>
<text x="${xt}" y="${yb}" font-size="17" fill="#1f6fb2" font-weight="700">TOP · testate verticali, a filo dei fianchi</text>
<text x="${xt}" y="${yb + 22}" font-size="15" fill="#333">lama inclinata ${ga} dal taglio dritto</text>
<text x="${xt}" y="${yb + 42}" font-size="15" fill="#333">(tra faccia e taglio ${g90} / ${g90p}), tagli paralleli</text>
<text x="${xt}" y="${yb + 62}" font-size="15" fill="#c0392b" font-weight="700">${piu(opz.abbTop, 'rifilare ai due lati')}</text>`;
})()}
<!-- callout fianco -->
<line x1="${X0}" y1="${Y0 + 40}" x2="${X0 - 40}" y2="${Y0 + 110}" stroke="#c0392b" stroke-width="1.5"/>
<text x="24" y="${Y0 + 128}" font-size="17" fill="#c0392b" font-weight="700">FIANCO · bordo alto</text>
<text x="24" y="${Y0 + 150}" font-size="15" fill="#333">lama inclinata ${ga} dal taglio dritto</text>
<text x="24" y="${Y0 + 170}" font-size="15" fill="#333">(tra faccia e taglio ${g90} / ${g90p})</text>
<text x="24" y="${Y0 + 190}" font-size="15" fill="#c0392b" font-weight="700">${piu(opz.abbFianchi, 'rifilare in opera')}</text>
<text x="24" y="${Y0 + 210}" font-size="14" fill="#555">vale per tutti e due i fianchi del modulo</text>
<!-- pavimento e note -->
<line x1="20" y1="${yF}" x2="${W - 20}" y2="${yF}" stroke="#333" stroke-width="2"/>
<text x="24" y="${yF + 22}" font-size="14" fill="#555">pavimento</text>
${piede.map((s, i) => `<text x="24" y="${yF + 58 + i * 24}" font-size="15" fill="#333">• ${esc(s)}</text>`).join('\n')}
</svg>`;
}

/** Testi dell'SVG nella lingua scelta (i18n.js). */
function svgTradotto(svg) {
  const t = window.NGI18N && window.NGI18N.lingua !== 'it' ? window.NGI18N.t : null;
  if (!t) return svg;
  const de = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return svg.replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (_, a, b, c) => a + esc(t(de(b))) + c);
}

/** Rende lo schema in PNG (2×). Ritorna { blob, bytes:Uint8Array, url, larghezza, altezza }. */
export function schemaTagliPNG(opz, scala = 2) {
  const svg = svgTradotto(schemaTagliSVG(opz));
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * scala; c.height = H * scala;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(async (blob) => {
        if (!blob) { ko(new Error('PNG non creato')); return; }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        ok({ blob, bytes, url: URL.createObjectURL(blob), larghezza: W, altezza: H });
      }, 'image/png');
    };
    img.onerror = () => ko(new Error('Schema non disegnato'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
