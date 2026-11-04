// =============================================================================
// RENDERING DELLA DISTINTA (tabella HTML)
// =============================================================================
// Prende l'output di calcolaDistintaCompleta e lo mostra in tabella con il
// riepilogo in fondo. Niente logica di calcolo qui dentro.
// =============================================================================

export function renderDistinta(contenitore, distinta) {
  const { pezzi, riepilogo } = distinta;
  const righe = pezzi.map((p) => `
    <tr>
      <td>${escape(p.nome)}</td>
      <td class="num">${fmt(p.larghezza)}</td>
      <td class="num">${fmt(p.altezza)}</td>
      <td class="num">${fmt(p.spessore)}</td>
      <td class="tag tag-${p.materiale}">${p.materiale}</td>
      <td class="num qta">${p.quantita}</td>
    </tr>
  `).join('');

  contenitore.innerHTML = `
    <div class="distinta-head">
      <h2>Distinta di taglio</h2>
      <div class="distinta-azioni">
        <button id="btn-csv" class="btn-oro">Esporta CSV</button>
        <button id="btn-pdf" class="btn-oro">Esporta PDF</button>
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
