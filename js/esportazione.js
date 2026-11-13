// =============================================================================
// ESPORTAZIONE DISTINTA — CSV e PDF
// =============================================================================
// CSV: generato in-browser, nessuna libreria.
// PDF: usa jsPDF caricato come globale (vedi index.html). Il PDF è impaginato
// in A4 con intestazione (dati lavoro + misure armadio) e tabella pezzi.
// =============================================================================

export function esportaCSV(distinta, meta = {}, config = null) {
  const righe = [
    ['Pezzo', 'Larghezza (mm)', 'Altezza/Lunghezza (mm)',
      'Spessore (mm)', 'Materiale', 'Quantità'],
  ];
  distinta.pezzi.forEach((p) => {
    righe.push([
      p.nome, p.larghezza, p.altezza, p.spessore,
      nomeMaterialeCsv(p, config),
      p.quantita,
    ]);
  });
  righe.push([]);
  righe.push(['Riepilogo']);
  righe.push(['Pezzi totali', distinta.riepilogo.totalePezzi]);
  righe.push(['m² carcassa', distinta.riepilogo.mqCarcassa.toFixed(2)]);
  righe.push(['m² ante', distinta.riepilogo.mqAnte.toFixed(2)]);
  righe.push(['m² schiena', distinta.riepilogo.mqSchiena.toFixed(2)]);

  const csv = righe.map((r) => r.map((v) => csvEscape(T(v))).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  scaricaBlob(blob, nomeFile(meta, 'csv'));
}

function csvEscape(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

import { trovaMateriale } from './materiali.js?v=20261114s';
const T = (s) => (typeof s === 'string' && window.NGI18N ? window.NGI18N.t(s) : s);   // lingua (i18n.js)

export function nomeMaterialeCsv(pezzo, config) {
  if (pezzo.materiale === 'melaminico') return 'Melaminico bianco';
  if (!config) return pezzo.materiale || '—';
  const mat = config.materiali || {};
  let id;
  if (pezzo.parteMateriale) id = mat[pezzo.parteMateriale];
  else if (pezzo.modulo === 'Tamponamenti')
    id = pezzo.materiale === 'ante' ? mat.tamponamenti : mat.carcassa;
  else id = mat[pezzo.materiale];
  const m = trovaMateriale(id);
  return m ? m.nome : (pezzo.materiale || '—');
}

export function esportaPDF(distinta, config, meta = {}) {
  // jsPDF: UMD globale
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert('jsPDF non caricato. Verifica la connessione al CDN.');
    return;
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const testoPdf = doc.text.bind(doc);
  doc.text = (t, ...resto) => testoPdf(typeof t === 'string' ? T(t) : t, ...resto);
  const marginX = 12;
  let y = 14;

  // Intestazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('NG INTERIOR — Distinta di taglio', marginX, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Cliente / Lavoro: ${meta.cliente || '—'}`, marginX, y); y += 5;
  doc.text(`Data: ${new Date().toLocaleDateString(window.NGI18N && window.NGI18N.lingua === 'es' ? 'es-ES' : 'it-IT')}`, marginX, y); y += 5;
  doc.text(
    `Armadio: ${config.larghezzaTotale} × ${config.altezzaEsterna} × ${config.profonditaEsterna} mm · `
    + `Moduli: ${config.moduli.length} · Setup: ${config.setupCarcassa === 1
      ? 'top/fondo passanti' : 'fianchi passanti'}`,
    marginX, y,
  ); y += 7;

  // Intestazione tabella (senza colonna "Modulo", pezzi raggruppati)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const colX = [marginX, marginX + 75, marginX + 103,
    marginX + 131, marginX + 155, marginX + 180];
  const headers = ['Pezzo', 'Largh.', 'Alt/Lung',
    'Spess.', 'Materiale', 'Qtà'];
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 2;
  doc.setDrawColor(180, 150, 60);
  doc.line(marginX, y, 200, y);
  y += 4;

  // Righe
  doc.setFont('helvetica', 'normal');
  distinta.pezzi.forEach((p) => {
    if (y > 275) {
      doc.addPage();
      y = 15;
    }
    doc.text(T(String(p.nome)).slice(0, 42), colX[0], y);
    doc.text(String(Math.round(p.larghezza)), colX[1], y);
    doc.text(String(Math.round(p.altezza)), colX[2], y);
    doc.text(String(p.spessore), colX[3], y);
    doc.text(T(nomeMaterialeCsv(p, config)).slice(0, 18), colX[4], y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(p.quantita), colX[5], y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  });

  // Riepilogo
  y += 4;
  if (y > 270) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo', marginX, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Pezzi totali: ${distinta.riepilogo.totalePezzi}`, marginX, y); y += 5;
  doc.text(`m² carcassa: ${distinta.riepilogo.mqCarcassa.toFixed(2)}`,
    marginX, y); y += 5;
  doc.text(`m² ante: ${distinta.riepilogo.mqAnte.toFixed(2)}`, marginX, y);
  y += 5;
  doc.text(`m² schiena: ${distinta.riepilogo.mqSchiena.toFixed(2)}`,
    marginX, y);

  doc.save(nomeFile(meta, 'pdf'));
}

function nomeFile(meta, ext) {
  const base = (meta.cliente || 'distinta').replace(/[^\w\-]+/g, '_');
  const d = new Date();
  const data = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    + `${String(d.getDate()).padStart(2, '0')}`;
  return `NG_${base}_${data}.${ext}`;
}

function scaricaBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
