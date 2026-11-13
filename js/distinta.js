// =============================================================================
// RENDERING DELLA DISTINTA (tabella HTML)
// =============================================================================
// Prende l'output di calcolaDistintaCompleta e lo mostra in tabella con il
// riepilogo in fondo. Niente logica di calcolo qui dentro.
// =============================================================================

import { trovaMateriale } from './materiali.js?v=20261114i';

/**
 * Risale dalla categoria + posizione del pezzo al materiale scelto
 * dall'utente nel pannello Materiali, e restituisce il NOME visibile.
 * Esempi: "carcassa" → "Roble Hera", "ante" → "Roble Denver".
 */
function nomeMaterialeDelPezzo(pezzo, config) {
  if (pezzo.materiale === 'melaminico') return 'Melaminico bianco';
  const mat = config?.materiali || {};
  let id;
  if (pezzo.parteMateriale) {
    // Cassettiera: cassStruttura o cassFronti
    id = mat[pezzo.parteMateriale];
  } else if (pezzo.modulo === 'Tamponamenti') {
    // Tamponamento: la faccia (materiale 'ante') usa la tinta dei
    // tamponamenti; la fascia (materiale 'carcassa') usa la carcassa.
    id = pezzo.materiale === 'ante' ? mat.tamponamenti : mat.carcassa;
  } else {
    id = mat[pezzo.materiale];
  }
  const m = trovaMateriale(id);
  return m ? m.nome : (pezzo.materiale || '—');
}

export function renderDistinta(contenitore, distinta, config) {
  const { pezzi, riepilogo } = distinta;
  const righe = pezzi.map((p) => `
    <tr>
      <td>${escape(p.nome)}</td>
      <td class="num">${fmt(p.larghezza)}</td>
      <td class="num">${fmt(p.altezza)}</td>
      <td class="num">${fmt(p.spessore)}</td>
      <td class="tag tag-${p.materiale}" title="${escape(p.materiale)}">${escape(nomeMaterialeDelPezzo(p, config))}</td>
      <td class="num qta">${p.quantita}</td>
    </tr>
  `).join('');

  contenitore.innerHTML = `
    <div class="distinta-head">
      <h2>Distinta di taglio</h2>
      <div class="distinta-azioni">
        <button id="btn-xlsx" class="btn-oro">Esporta Excel</button>
        <button id="btn-modello" class="btn-oro">⚙ Modello Excel</button>
        <button id="btn-csv" class="btn-oro">Esporta CSV</button>
        <button id="btn-pdf" class="btn-oro">Esporta PDF</button>
        <button id="btn-img" class="btn-oro">📷 Salva immagine HD</button>
      </div>
    </div>
    <div class="tabella-wrap">
      <table class="distinta">
        <thead>
          <tr>
            <th>Pezzo</th>
            <th class="num">Largh. (mm)</th>
            <th class="num">Alt./Lung. (mm)</th>
            <th class="num">Spess. (mm)</th>
            <th>Materiale</th>
            <th class="num">Qtà</th>
          </tr>
        </thead>
        <tbody>${righe}</tbody>
      </table>
    </div>
    <div class="riepilogo">
      <div><span>Pezzi totali</span><strong>${riepilogo.totalePezzi}</strong></div>
      <div><span>m² carcassa</span><strong>${riepilogo.mqCarcassa.toFixed(2)}</strong></div>
      <div><span>m² ante</span><strong>${riepilogo.mqAnte.toFixed(2)}</strong></div>
      <div><span>m² schiena</span><strong>${riepilogo.mqSchiena.toFixed(2)}</strong></div>
      ${riepilogo.mqMelaminico ? `<div><span>m² melaminico</span><strong>${riepilogo.mqMelaminico.toFixed(2)}</strong></div>` : ''}
    </div>
  `;
}

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '–';
  return Number(n).toFixed(1).replace(/\.0$/, '');
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
