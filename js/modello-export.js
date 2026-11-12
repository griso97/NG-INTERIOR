// =============================================================================
// MODELLO EXCEL DEL PROGRAMMA DI TAGLIO — condiviso da Cucina e Armadi
// =============================================================================
// L'utente carica UNA VOLTA il file Excel (vuoto, solo intestazioni) del suo
// programma di taglio. Il sito legge le colonne, le abbina ai dati dei pezzi
// (in automatico, correggibile a mano) e da lì in poi esporta la distinta in
// .xlsx con ESATTAMENTE quelle colonne, in quell'ordine.
// Lettura/scrittura .xlsx fatte qui (un .xlsx è uno zip di file XML), con la
// sola libreria fflate (zip, MIT) in vendor/. Il modello resta nel browser
// (localStorage), uguale per Cucina e Armadi.
// =============================================================================
import { zipSync, unzipSync, strToU8, strFromU8 } from '../vendor/fflate/fflate.module.js';
const T = (s) => (typeof s === 'string' && window.NGI18N ? window.NGI18N.t(s) : s);   // lingua (i18n.js)

const KEY = 'ng-modello-export-v1';
const MAX_FILE = 5 * 1024 * 1024;          // 5 MB: un modello vuoto è pochi KB

// Dati che si possono mettere in una colonna.
export const CAMPI = [
  { id: '',          nome: '— lascia vuota —' },
  { id: 'nome',      nome: 'Nome pezzo' },
  { id: 'altezza',   nome: 'Lunghezza / Altezza (mm)' },
  { id: 'larghezza', nome: 'Larghezza (mm)' },
  { id: 'latoLungo', nome: 'Lato più lungo (mm)' },
  { id: 'latoCorto', nome: 'Lato più corto (mm)' },
  { id: 'spessore',  nome: 'Spessore (mm)' },
  { id: 'quantita',  nome: 'Quantità' },
  { id: 'materiale', nome: 'Materiale / pannello (board)' },
  { id: 'modulo',    nome: 'Modulo / mobile' },
  { id: 'gruppo',    nome: 'Gruppo (ante, fianchi…)' },
  { id: 'progetto',  nome: 'Nome progetto / cliente' },
  { id: 'note',      nome: 'Note / angolo di taglio' },
  { id: 'fisso',     nome: 'Valore fisso…' },
];

// Riconoscimento automatico delle intestazioni (it / en / es / de / fr).
const REGOLE = [
  ['quantita',  /(quant|qta|qty|q\.ta|cant|pezzi|^pz|^n$|^nr|numero|count|amount|anzahl|stk|stuck|nombre|qte)/],
  ['spessore',  /(spess|thick|espes|grosor|starke|dicke|epaiss|^sp$|^th$|^t$)/],
  ['larghezza', /(larghezz|width|ancho|breite|largeur|^w$|^b$|^larg$)/],
  ['altezza',   /(lunghez|length|largo|lange|laenge|longueur|altezz|height|alto|hohe|hauteur|^l$|^h$|^lung$)/],
  ['materiale', /(mater|board|pannell|tabler|panel|platte|decor|colore|color|finitur|^mat$)/],
  ['modulo',    /(modul|mobile|cabinet|mueble|schrank|meuble)/],
  ['gruppo',    /(grupp|group|categor|tipo pezzo)/],
  ['progetto',  /(progett|project|cliente|customer|client|commessa|ordine|order|auftrag)/],
  ['note',      /(^note?$|^nota|annotaz|comment|osserv|bemerk|remark|angol|inclinaz|taglio)/],
  ['nome',      /(nome|name|descr|denom|etichet|label|pezzo|part|piez|bezeich|designation|^id$|codice|code|ref)/],
];
function normalizza(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function indovinaCampo(intestazione) {
  const n = normalizza(intestazione);
  if (!n) return '';
  for (const [campo, re] of REGOLE) if (re.test(n)) return campo;
  return '';
}

// ---------------------------------------------------------------------------
// Salvataggio modello
// ---------------------------------------------------------------------------
export function leggiModello() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function salvaModello(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); return true; } catch { return false; }
}
function cancellaModello() { try { localStorage.removeItem(KEY); } catch { /* niente */ } }

// Modello standard usato quando l'utente non ne ha caricato uno.
function modelloStandard(conNote = false) {
  const intestazioni = ['Pezzo', 'Lunghezza (mm)', 'Larghezza (mm)', 'Spessore (mm)', 'Quantità', 'Materiale', 'Modulo', ...(conNote ? ['Note / taglio'] : [])].map(T);
  return {
    nomeFile: null, foglio: T('Distinta'), preHeader: [], intestazioni,
    mappa: ['nome', 'altezza', 'larghezza', 'spessore', 'quantita', 'materiale', 'modulo', ...(conNote ? ['note'] : [])].map((campo) => ({ campo, fisso: '' })),
    materiali: {},
  };
}

// ---------------------------------------------------------------------------
// LETTURA del modello (.xlsx o .csv)
// ---------------------------------------------------------------------------
export async function leggiFileModello(file) {
  if (!file) throw new Error('Nessun file');
  if (file.size > MAX_FILE) throw new Error('File troppo grande: carica il modello vuoto (solo intestazioni).');
  const nome = file.name || 'modello';
  const ext = nome.toLowerCase().split('.').pop();
  let foglio = 'Distinta', righe;
  if (ext === 'csv' || ext === 'txt') {
    righe = leggiCSV(await file.text());
  } else if (ext === 'xlsx' || ext === 'xlsm') {
    ({ foglio, righe } = leggiXLSX(new Uint8Array(await file.arrayBuffer())));
  } else if (ext === 'xls') {
    throw new Error('Il formato .xls (Excel 97-2003) non è supportato: aprilo in Excel e salvalo come .xlsx.');
  } else {
    throw new Error('Formato non riconosciuto: usa un file .xlsx o .csv.');
  }
  // Riga d'intestazione = la prima (entro 30) con almeno 2 celle piene.
  let hi = righe.findIndex((r, i) => i < 30 && r.filter((c) => String(c ?? '').trim() !== '').length >= 2);
  if (hi < 0) hi = righe.findIndex((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (hi < 0) throw new Error('Nel file non ho trovato nessuna intestazione di colonna.');
  const header = righe[hi];
  let ultima = header.length - 1;
  while (ultima > 0 && String(header[ultima] ?? '').trim() === '') ultima--;
  const intestazioni = header.slice(0, ultima + 1).map((c) => String(c ?? '').trim());
  return {
    nomeFile: nome,
    foglio,
    preHeader: righe.slice(0, hi).map((r) => r.map((c) => (c == null ? '' : c))),
    intestazioni,
    mappa: intestazioni.map((h) => ({ campo: indovinaCampo(h), fisso: '' })),
    materiali: {},
  };
}

function leggiCSV(testo) {
  testo = testo.replace(/^﻿/, '');
  const prima = testo.split(/\r?\n/).find((l) => l.trim()) || '';
  const conta = (ch) => prima.split(ch).length - 1;
  const sep = [';', ',', '\t'].sort((a, b) => conta(b) - conta(a))[0];
  const righe = []; let riga = []; let cella = ''; let q = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (q) {
      if (ch === '"') { if (testo[i + 1] === '"') { cella += '"'; i++; } else q = false; }
      else cella += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { riga.push(cella); cella = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && testo[i + 1] === '\n') i++;
      riga.push(cella); righe.push(riga); riga = []; cella = '';
    } else cella += ch;
  }
  if (cella !== '' || riga.length) { riga.push(cella); righe.push(riga); }
  return righe;
}

function xmlDoc(testo) {
  const d = new DOMParser().parseFromString(testo, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('Il file Excel sembra danneggiato.');
  return d;
}
const tutti = (nodo, nome) => Array.from(nodo.getElementsByTagNameNS('*', nome));
function colIndice(ref) {
  const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1;
  let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function leggiXLSX(u8) {
  let files;
  try {
    files = unzipSync(u8, {
      filter: (f) => f.originalSize < 20 * 1024 * 1024
        && /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/i.test(f.name),
    });
  } catch { throw new Error('Non riesco ad aprire il file: è davvero un .xlsx?'); }
  const leggi = (n) => { const k = Object.keys(files).find((f) => f.toLowerCase() === n.toLowerCase()); return k ? strFromU8(files[k]) : null; };
  const wbTxt = leggi('xl/workbook.xml');
  if (!wbTxt) throw new Error('Il file non contiene un foglio Excel valido.');
  const wb = xmlDoc(wbTxt);
  const sheet = tutti(wb, 'sheet')[0];
  const foglio = (sheet && sheet.getAttribute('name')) || 'Distinta';
  const rid = sheet && (sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
  let percorso = 'xl/worksheets/sheet1.xml';
  const relTxt = leggi('xl/_rels/workbook.xml.rels');
  if (relTxt && rid) {
    const rel = tutti(xmlDoc(relTxt), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) {
      const t = rel.getAttribute('Target').replace(/^\//, '');
      percorso = t.startsWith('xl/') ? t : `xl/${t}`;
    }
  }
  const shTxt = leggi(percorso) || leggi('xl/worksheets/sheet1.xml');
  if (!shTxt) throw new Error('Non trovo il primo foglio nel file Excel.');
  // Stringhe condivise
  const condivise = [];
  const ssTxt = leggi('xl/sharedStrings.xml');
  if (ssTxt) for (const si of tutti(xmlDoc(ssTxt), 'si')) condivise.push(tutti(si, 't').map((t) => t.textContent).join(''));
  // Celle (bastano le prime righe: serve solo l'intestazione)
  const righe = [];
  for (const row of tutti(xmlDoc(shTxt), 'row').slice(0, 40)) {
    const r = (parseInt(row.getAttribute('r'), 10) || righe.length + 1) - 1;
    const riga = [];
    let auto = 0;
    for (const c of tutti(row, 'c')) {
      const ci = c.getAttribute('r') ? colIndice(c.getAttribute('r')) : auto;
      auto = ci + 1;
      if (ci < 0 || ci > 200) continue;
      const t = c.getAttribute('t');
      const v = tutti(c, 'v')[0];
      let val = '';
      if (t === 's') val = condivise[parseInt(v?.textContent, 10)] ?? '';
      else if (t === 'inlineStr') val = tutti(c, 't').map((x) => x.textContent).join('');
      else if (v) { const n = Number(v.textContent); val = t === 'str' || Number.isNaN(n) ? v.textContent : n; }
      riga[ci] = val;
    }
    righe[r] = Array.from(riga, (x) => (x === undefined ? '' : x));
  }
  return { foglio, righe: Array.from(righe, (x) => x || []) };
}

// ---------------------------------------------------------------------------
// SCRITTURA .xlsx
// ---------------------------------------------------------------------------
const xesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // caratteri di controllo non ammessi in XML
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colLettere(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function nomeFoglio(n) { return (String(n || 'Distinta').replace(/[\[\]:*?/\\]/g, ' ').trim() || 'Distinta').slice(0, 31); }

/**
 * immagini (facoltative): [{ foglio, titolo, png: Uint8Array, larghezza, altezza }]
 * → un foglio in più per ciascuna, con il titolo in A1 e l'immagine sotto.
 */
export function creaXLSX(righe, { foglio = 'Distinta', rigaGrassetto = -1, immagini = [] } = {}) {
  const ncol = Math.max(1, ...righe.map((r) => r.length));
  const larg = Array.from({ length: ncol }, (_, c) => Math.min(60, Math.max(8,
    ...righe.map((r) => String(r[c] ?? '').length + 2))));
  const cols = larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const data = righe.map((r, ri) => {
    const celle = r.map((v, ci) => {
      if (v === '' || v == null) return '';
      const ref = `${colLettere(ci)}${ri + 1}`;
      const s = ri === rigaGrassetto ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${celle}</row>`;
  }).join('');
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const ANS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const imm = (immagini || []).filter((x) => x && x.png && x.png.length);
  const nomi = [nomeFoglio(foglio)];
  imm.forEach((x, i) => {
    let n = nomeFoglio(x.foglio || `Schema ${i + 1}`), k = 2;
    while (nomi.includes(n)) n = nomeFoglio(`${x.foglio || 'Schema'} ${k++}`);
    nomi.push(n);
  });
  const files = {
    '[Content_Types].xml': head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + (imm.length ? '<Default Extension="png" ContentType="image/png"/>' : '')
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + imm.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 2}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        + `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>',
    '_rels/.rels': head + `<Relationships xmlns="${PNS}"><Relationship Id="rId1" Type="${RNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': head + `<workbook xmlns="${NS}" xmlns:r="${RNS}"><sheets><sheet name="${xesc(nomi[0])}" sheetId="1" r:id="rId1"/>`
      + imm.map((_, i) => `<sheet name="${xesc(nomi[i + 1])}" sheetId="${i + 2}" r:id="rId${i + 10}"/>`).join('')
      + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': head + `<Relationships xmlns="${PNS}">`
      + `<Relationship Id="rId1" Type="${RNS}/worksheet" Target="worksheets/sheet1.xml"/>`
      + imm.map((_, i) => `<Relationship Id="rId${i + 10}" Type="${RNS}/worksheet" Target="worksheets/sheet${i + 2}.xml"/>`).join('')
      + `<Relationship Id="rId2" Type="${RNS}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': head + `<styleSheet xmlns="${NS}">`
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': head + `<worksheet xmlns="${NS}"><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`,
  };
  imm.forEach((x, i) => {
    const n = i + 1, EMU = 9525;
    const cx = Math.round((x.larghezza || 1000) * EMU), cy = Math.round((x.altezza || 750) * EMU);
    const titolo = x.titolo ? `<row r="1"><c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">${xesc(x.titolo)}</t></is></c></row>` : '';
    files[`xl/worksheets/sheet${n + 1}.xml`] = head + `<worksheet xmlns="${NS}" xmlns:r="${RNS}"><sheetData>${titolo}</sheetData><drawing r:id="rId1"/></worksheet>`;
    files[`xl/worksheets/_rels/sheet${n + 1}.xml.rels`] = head + `<Relationships xmlns="${PNS}"><Relationship Id="rId1" Type="${RNS}/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`;
    files[`xl/drawings/drawing${n}.xml`] = head + `<xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${ANS}" xmlns:r="${RNS}"><xdr:oneCellAnchor>`
      + '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
      + `<xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${n + 1}" name="Schema ${n}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
      + '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
    files[`xl/drawings/_rels/drawing${n}.xml.rels`] = head + `<Relationships xmlns="${PNS}"><Relationship Id="rId1" Type="${RNS}/image" Target="../media/image${n}.png"/></Relationships>`;
  });
  const zip = {};
  for (const [k, v] of Object.entries(files)) zip[k] = strToU8(v);
  imm.forEach((x, i) => { zip[`xl/media/image${i + 1}.png`] = [x.png, { level: 0 }]; });
  return new Blob([zipSync(zip, { level: 6 })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------------------------------------------------------------------------
// Pezzi → righe secondo il modello
// pezzi normalizzati: { nome, larghezza, altezza, spessore, quantita, materiale, modulo, gruppo }
// ---------------------------------------------------------------------------
function valoreCampo(p, m, mod, progetto) {
  const num = (x) => (x === '' || x == null || Number.isNaN(Number(x)) ? x : Number(x));
  switch (m.campo) {
    case 'nome': return T(p.nome ?? '');
    case 'altezza': return num(p.altezza);
    case 'larghezza': return num(p.larghezza);
    case 'latoLungo': return Math.max(Number(p.altezza) || 0, Number(p.larghezza) || 0);
    case 'latoCorto': return Math.min(Number(p.altezza) || 0, Number(p.larghezza) || 0);
    case 'spessore': return num(p.spessore);
    case 'quantita': return num(p.quantita);
    case 'materiale': { const n = p.materiale ?? ''; const b = (mod.materiali || {})[n]; return b && b.trim() ? b.trim() : T(n); }
    case 'modulo': return T(p.modulo ?? '');
    case 'gruppo': return T(p.gruppo ?? '');
    case 'progetto': return progetto || '';
    case 'note': return T(p.note ?? '');
    case 'fisso': return num(m.fisso ?? '');
    default: return '';
  }
}
export function righeDaModello(mod, pezzi, progetto = '') {
  const righe = (mod.preHeader || []).map((r) => r.slice());
  righe.push(mod.intestazioni.slice());
  // Modello senza colonna note: le note (es. angoli di taglio) vanno nel nome, così non si perdono
  const haNote = mod.mappa.some((m) => m.campo === 'note');
  for (const p0 of pezzi) {
    const p = !haNote && p0.note ? { ...p0, nome: `${T(p0.nome)} — ${T(p0.note)}` } : p0;
    righe.push(mod.mappa.map((m) => valoreCampo(p, m, mod, progetto)));
  }
  return righe;
}

/** Esporta i pezzi con il modello salvato (o con quello standard). */
export function esportaExcel(pezzi, { nomeFile = 'distinta', progetto = '', immagini = [] } = {}) {
  const mod = leggiModello() || modelloStandard(pezzi.some((p) => p.note));
  const righe = righeDaModello(mod, pezzi, progetto);
  const blob = creaXLSX(righe, { foglio: mod.foglio, rigaGrassetto: (mod.preHeader || []).length, immagini });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${String(nomeFile).replace(/[^\w\-]+/g, '_')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------------------------------------------------------------------------
// FINESTRA "Modello Excel" (autonoma: crea da sé HTML e stile)
// ---------------------------------------------------------------------------
const STILE = `
.mx-fondo{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}
.mx-box{background:#121212;color:#e9e4d8;border:1px solid #3a3326;border-radius:10px;max-width:760px;width:100%;padding:18px 16px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
.mx-box h3{margin:0 0 6px;color:#c9a94a;letter-spacing:.06em;font-size:15px;text-transform:uppercase}
.mx-box h4{margin:16px 0 6px;color:#c9a94a;font-size:13px;letter-spacing:.05em;text-transform:uppercase}
.mx-nota{color:#a9a295;font-size:13px;margin:4px 0 10px}
.mx-file{display:block;width:100%;margin:6px 0 4px;color:#e9e4d8}
.mx-err{color:#ff8a7a;margin:6px 0}
.mx-ok{color:#9fd39b;margin:6px 0}
.mx-tab{width:100%;border-collapse:collapse;margin-top:4px}
.mx-tab td,.mx-tab th{border-bottom:1px solid #2a2620;padding:6px 4px;text-align:left;vertical-align:middle}
.mx-tab th{color:#a9a295;font-weight:500;font-size:12px}
.mx-tab select,.mx-tab input{width:100%;box-sizing:border-box;background:#1c1b18;color:#e9e4d8;border:1px solid #3a3326;border-radius:6px;padding:6px;font-size:14px}
.mx-col{font-weight:600;word-break:break-word}
.mx-prev{overflow:auto;max-width:100%;margin-top:6px}
.mx-prev table{border-collapse:collapse;font-size:12px;white-space:nowrap}
.mx-prev td,.mx-prev th{border:1px solid #2a2620;padding:3px 6px}
.mx-prev th{background:#1c1b18;color:#c9a94a}
.mx-azioni{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.mx-btn{border:1px solid #c9a94a;background:transparent;color:#c9a94a;border-radius:6px;padding:9px 14px;font-size:14px;cursor:pointer}
.mx-btn.pieno{background:#c9a94a;color:#121212;font-weight:600}
.mx-btn.rosso{border-color:#7a3a33;color:#ff8a7a}
`;
function iniettaStile() {
  if (document.getElementById('mx-stile')) return;
  const s = document.createElement('style'); s.id = 'mx-stile'; s.textContent = STILE;
  document.head.appendChild(s);
}
const hesc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Apre la finestra per caricare/abbinare il modello.
 * opts.pezzi: pezzi attuali (per anteprima e lista materiali)
 * opts.progetto: nome progetto (per anteprima)
 */
export function apriModelloExcel({ pezzi = [], progetto = '' } = {}) {
  iniettaStile();
  let mod = leggiModello();
  let bozza = mod ? JSON.parse(JSON.stringify(mod)) : null;
  let messaggio = '', errore = '';
  const fondo = document.createElement('div');
  fondo.className = 'mx-fondo';
  document.body.appendChild(fondo);
  const chiudi = () => fondo.remove();
  fondo.addEventListener('click', (e) => { if (e.target === fondo) chiudi(); });

  const materialiPresenti = [...new Set(pezzi.map((p) => p.materiale).filter(Boolean))];

  function render() {
    const opzioni = (sel) => CAMPI.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${hesc(c.nome)}</option>`).join('');
    let corpo = '';
    if (bozza) {
      const anteprima = righeDaModello(bozza, pezzi.slice(0, 4), progetto).slice((bozza.preHeader || []).length);
      corpo = `
        <div class="mx-ok">Modello: <b>${hesc(bozza.nomeFile || 'standard')}</b> · foglio “${hesc(bozza.foglio)}” · ${bozza.intestazioni.length} colonne</div>
        <h4>Cosa va in ogni colonna</h4>
        <table class="mx-tab">
          <tr><th style="width:38%">Colonna del tuo programma</th><th>Dato del sito</th></tr>
          ${bozza.intestazioni.map((h, i) => `
            <tr><td class="mx-col">${hesc(h) || '<i>(senza nome)</i>'}</td>
              <td><select data-i="${i}" class="mx-campo">${opzioni(bozza.mappa[i].campo)}</select>
              ${bozza.mappa[i].campo === 'fisso' ? `<input data-i="${i}" class="mx-fisso" placeholder="valore da scrivere in ogni riga" value="${hesc(bozza.mappa[i].fisso)}" style="margin-top:4px">` : ''}
              </td></tr>`).join('')}
        </table>
        ${materialiPresenti.length ? `
        <h4>Nomi pannello (board)</h4>
        <div class="mx-nota">Se il programma di taglio vuole il codice esatto del pannello, scrivilo qui. Vuoto = usa il nome del sito.</div>
        <table class="mx-tab">
          ${materialiPresenti.map((m) => `<tr><td class="mx-col" style="width:38%">${hesc(m)}</td>
            <td><input class="mx-board" data-m="${hesc(m)}" placeholder="es. BIANCO_18" value="${hesc((bozza.materiali || {})[m] || '')}"></td></tr>`).join('')}
        </table>` : ''}
        ${pezzi.length ? `
        <h4>Anteprima (prime righe)</h4>
        <div class="mx-prev"><table>
          <tr>${anteprima[0].map((h) => `<th>${hesc(h)}</th>`).join('')}</tr>
          ${anteprima.slice(1).map((r) => `<tr>${r.map((v) => `<td>${hesc(v)}</td>`).join('')}</tr>`).join('')}
        </table></div>` : ''}`;
    }
    fondo.innerHTML = `
      <div class="mx-box" role="dialog" aria-modal="true">
        <h3>Modello Excel del programma di taglio</h3>
        <div class="mx-nota">Carica il file Excel <b>vuoto</b> del tuo programma di taglio (solo la riga delle intestazioni,
          es. Lunghezza, Larghezza, Spessore, Quantità, Board). Da quel momento “Esporta Excel” crea la distinta con le stesse colonne.
          Il modello resta salvato su questo dispositivo e vale per Cucina e Armadi.</div>
        <input type="file" class="mx-file" accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv">
        ${errore ? `<div class="mx-err">${hesc(errore)}</div>` : ''}
        ${messaggio ? `<div class="mx-ok">${hesc(messaggio)}</div>` : ''}
        ${bozza ? corpo : '<div class="mx-nota" style="margin-top:10px">Nessun modello caricato: per ora si esporta con le colonne standard (Pezzo, Lunghezza, Larghezza, Spessore, Quantità, Materiale, Modulo).</div>'}
        <div class="mx-azioni">
          ${bozza ? '<button type="button" class="mx-btn pieno mx-salva">Salva modello</button>' : ''}
          ${mod ? '<button type="button" class="mx-btn rosso mx-togli">Togli modello</button>' : ''}
          <button type="button" class="mx-btn mx-chiudi">Chiudi</button>
        </div>
      </div>`;
    fondo.querySelector('.mx-chiudi').onclick = chiudi;
    fondo.querySelector('.mx-file').onchange = async (e) => {
      errore = ''; messaggio = '';
      try {
        bozza = await leggiFileModello(e.target.files[0]);
        const riconosciute = bozza.mappa.filter((m) => m.campo).length;
        messaggio = `Lette ${bozza.intestazioni.length} colonne, ${riconosciute} riconosciute in automatico. Controlla e premi “Salva modello”.`;
      } catch (err) { errore = err.message || String(err); }
      render();
    };
    fondo.querySelectorAll('.mx-campo').forEach((s) => { s.onchange = () => { bozza.mappa[+s.dataset.i].campo = s.value; render(); }; });
    fondo.querySelectorAll('.mx-fisso').forEach((inp) => { inp.oninput = () => { bozza.mappa[+inp.dataset.i].fisso = inp.value; }; });
    fondo.querySelectorAll('.mx-board').forEach((inp) => { inp.oninput = () => { (bozza.materiali ||= {})[inp.dataset.m] = inp.value; }; });
    const salva = fondo.querySelector('.mx-salva');
    if (salva) salva.onclick = () => {
      bozza.salvato = new Date().toISOString();
      if (salvaModello(bozza)) { mod = JSON.parse(JSON.stringify(bozza)); messaggio = 'Modello salvato. Ora “Esporta Excel” usa queste colonne.'; errore = ''; }
      else errore = 'Non riesco a salvare (memoria del browser piena o disattivata).';
      render();
    };
    const togli = fondo.querySelector('.mx-togli');
    if (togli) togli.onclick = () => {
      if (!confirm('Togliere il modello Excel? Si tornerà alle colonne standard.')) return;
      cancellaModello(); mod = null; bozza = null; messaggio = 'Modello tolto.'; render();
    };
  }
  render();
}
