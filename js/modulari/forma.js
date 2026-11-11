// =============================================================================
// MOBILI MODULARI — forma del vano in VISTA FRONTALE (prospetto)
// =============================================================================
// Il vano (sottoscala, nicchia, mansarda…) si descrive con le lunghezze dei
// tratti di parete. Pavimento e soffitto piano sono ORIZZONTALI, i muri sono
// VERTICALI: con questa informazione le pareti INCLINATE (scala, falde del
// tetto) e tutti gli angoli si calcolano da soli.
// Coordinate: mm, x verso destra, y verso l'alto, origine = angolo in basso a
// sinistra del pavimento. Punti in senso antiorario.
// =============================================================================

export const TOLLERANZA_MM = 3;   // oltre questa differenza l'inclinata misurata "non torna"

// Campi: { id, nome, opz } — opz = facoltativo (si può ricavare dagli altri).
export const FORME = [
  {
    id: 'triangolo', pareti: 3, nome: 'Sottoscala a triangolo', specchiabile: true,
    descr: 'Base a terra, muro verticale e inclinata della scala.',
    campi: [
      { id: 'B', nome: 'Base (pavimento)' },
      { id: 'H', nome: 'Altezza (muro verticale)', opz: true },
      { id: 'I', nome: 'Inclinata (ipotenusa)', opz: true },
    ],
  },
  {
    id: 'rettangolo', pareti: 4, nome: 'Nicchia rettangolare', specchiabile: false,
    descr: 'Vano rettangolare: larghezza e altezza.',
    campi: [
      { id: 'L', nome: 'Larghezza' },
      { id: 'H', nome: 'Altezza' },
    ],
  },
  {
    id: 'trapezio', pareti: 4, nome: 'Sottoscala con muretto', specchiabile: true,
    descr: 'Come il triangolo, ma dal lato basso c\'è un muretto verticale.',
    campi: [
      { id: 'B', nome: 'Base (pavimento)' },
      { id: 'H1', nome: 'Muro alto' },
      { id: 'H2', nome: 'Muro basso', opz: true },
      { id: 'I', nome: 'Inclinata', opz: true },
    ],
  },
  {
    id: 'mansarda', pareti: 5, nome: 'Sottoscala / mansarda con soffitto piano', specchiabile: true,
    descr: 'Muro alto, tratto di soffitto piano, poi l\'inclinata scende al muro basso.',
    campi: [
      { id: 'B', nome: 'Base (pavimento)' },
      { id: 'H1', nome: 'Muro alto' },
      { id: 'P', nome: 'Soffitto piano' },
      { id: 'H2', nome: 'Muro basso', opz: true },
      { id: 'I', nome: 'Inclinata', opz: true },
    ],
  },
  {
    id: 'capanna', pareti: 5, nome: 'Sottotetto a due falde', specchiabile: false,
    descr: 'Due muretti e due falde inclinate che si incontrano al colmo.',
    campi: [
      { id: 'B', nome: 'Base (pavimento)' },
      { id: 'Hs', nome: 'Muro sinistro' },
      { id: 'Is', nome: 'Falda sinistra' },
      { id: 'Id', nome: 'Falda destra' },
      { id: 'Hd', nome: 'Muro destro' },
    ],
  },
  {
    id: 'sei', pareti: 6, nome: 'Due falde con soffitto piano', specchiabile: false,
    descr: 'Due muretti, due falde e un tratto di soffitto piano in mezzo.',
    campi: [
      { id: 'B', nome: 'Base (pavimento)' },
      { id: 'Hs', nome: 'Muro sinistro' },
      { id: 'Is', nome: 'Falda sinistra' },
      { id: 'P', nome: 'Soffitto piano' },
      { id: 'Id', nome: 'Falda destra' },
      { id: 'Hd', nome: 'Muro destro' },
    ],
  },
];

export const VALORI_ESEMPIO = {
  triangolo: { B: 2400, H: 1800, I: '' },
  rettangolo: { L: 1800, H: 2400 },
  trapezio: { B: 2400, H1: 2100, H2: 400, I: '' },
  mansarda: { B: 3000, H1: 2400, P: 800, H2: 900, I: '' },
  capanna: { B: 4000, Hs: 900, Is: 2300, Id: 2300, Hd: 900 },
  sei: { B: 4500, Hs: 900, Is: 1900, P: 1000, Id: 1900, Hd: 900 },
};

export function infoForma(id) { return FORME.find((f) => f.id === id) || FORME[0]; }

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const r1 = (x) => Math.round(x * 10) / 10;

/** Intersezione "alta" di due cerchi (centro c1 raggio a, centro c2 raggio b). */
function puntoColmo(c1, a, c2, b) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || a + b < d - 1e-6 || Math.abs(a - b) > d + 1e-6) return null;
  const l = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - l * l));
  const mx = c1.x + (dx * l) / d, my = c1.y + (dy * l) / d;
  const p1 = { x: mx - (dy * h) / d, y: my + (dx * h) / d };
  const p2 = { x: mx + (dy * h) / d, y: my - (dx * h) / d };
  return p1.y >= p2.y ? p1 : p2;
}

/**
 * Calcola la forma.
 * @returns { ok, punti:[{x,y}], pareti:[{lettera,nome,tipo,lunghezza,inserita,inclinazione?}],
 *            angoli:[gradi interni per vertice], area_m2, larghezza, altezzaMax,
 *            calcolati:{campo:valore}, errori:[], avvisi:[] }
 */
export function calcolaForma(formaId, valori = {}, specchia = false) {
  const f = infoForma(formaId);
  const v = {}; const errori = []; const avvisi = []; const calcolati = {};
  for (const c of f.campi) {
    const n = num(valori[c.id]);
    if (n === null) { v[c.id] = null; continue; }
    if (Number.isNaN(n) || n <= 0) { errori.push(`${c.nome}: inserisci una misura valida in mm.`); v[c.id] = null; continue; }
    v[c.id] = n;
  }
  const manca = (id) => v[id] == null;
  const nomeCampo = (id) => f.campi.find((c) => c.id === id)?.nome || id;
  for (const c of f.campi) if (!c.opz && manca(c.id)) errori.push(`Manca: ${c.nome}.`);
  if (errori.length) return { ok: false, errori, avvisi, pareti: [], punti: [], angoli: [] };

  // Inclinata facoltativa: se c'è anche l'altezza → controllo; se manca l'altezza → la ricavo.
  // run = tratto orizzontale coperto dall'inclinata; alto = muro noto; idBasso = muro da ricavare.
  function risolviInclinata(run, alto, idH, sottraiDa) {
    // sottraiDa: null → l'altezza È il dislivello (triangolo); numero → H2 = sottraiDa − dislivello
    const dislivelloDa = (h) => (sottraiDa == null ? h : sottraiDa - h);
    if (!manca(idH)) {
      const dz = dislivelloDa(v[idH]);
      if (dz <= 0) { errori.push(sottraiDa == null ? 'L\'altezza deve essere maggiore di zero.' : `${nomeCampo(idH)} deve essere più basso del muro alto.`); return; }
      const ic = Math.hypot(run, dz);
      calcolati.I = r1(ic);
      if (!manca('I') && Math.abs(v.I - ic) > TOLLERANZA_MM) {
        avvisi.push(`Le misure non tornano: con queste misure l'inclinata dovrebbe essere ${r1(ic)} mm, tu hai messo ${v.I} mm (differenza ${r1(v.I - ic)} mm). Uso le altre misure: ricontrolla.`);
      }
    } else if (!manca('I')) {
      if (v.I <= run) { errori.push(`L'inclinata (${v.I}) deve essere più lunga del tratto orizzontale che copre (${r1(run)} mm).`); return; }
      const dz = Math.sqrt(v.I * v.I - run * run);
      const h = sottraiDa == null ? dz : sottraiDa - dz;
      if (h < 0) { errori.push('Con questa inclinata il muro basso verrebbe negativo: ricontrolla le misure.'); return; }
      v[idH] = h; calcolati[idH] = r1(h);
    } else {
      errori.push(`Serve ${nomeCampo(idH).toLowerCase()} oppure l'inclinata.`);
    }
  }

  let punti = [];   // antiorario da (0,0)
  let pareti = [];  // pareti[i] va da punti[i] a punti[i+1]
  const P = (x, y) => ({ x, y });

  switch (f.id) {
    case 'triangolo': {
      risolviInclinata(v.B, null, 'H', null);
      if (errori.length) break;
      punti = [P(0, 0), P(v.B, 0), P(0, v.H)];
      pareti = [
        { nome: 'Pavimento', tipo: 'pavimento', campo: 'B' },
        { nome: 'Inclinata', tipo: 'inclinata', campo: 'I' },
        { nome: 'Muro', tipo: 'muro', campo: 'H' },
      ];
      break;
    }
    case 'rettangolo': {
      punti = [P(0, 0), P(v.L, 0), P(v.L, v.H), P(0, v.H)];
      pareti = [
        { nome: 'Pavimento', tipo: 'pavimento', campo: 'L' },
        { nome: 'Muro destro', tipo: 'muro', campo: 'H' },
        { nome: 'Soffitto', tipo: 'soffitto', campo: 'L' },
        { nome: 'Muro sinistro', tipo: 'muro', campo: 'H' },
      ];
      break;
    }
    case 'trapezio': {
      risolviInclinata(v.B, v.H1, 'H2', v.H1);
      if (errori.length) break;
      punti = [P(0, 0), P(v.B, 0), P(v.B, v.H2), P(0, v.H1)];
      pareti = [
        { nome: 'Pavimento', tipo: 'pavimento', campo: 'B' },
        { nome: 'Muro basso', tipo: 'muro', campo: 'H2' },
        { nome: 'Inclinata', tipo: 'inclinata', campo: 'I' },
        { nome: 'Muro alto', tipo: 'muro', campo: 'H1' },
      ];
      break;
    }
    case 'mansarda': {
      if (v.P >= v.B) { errori.push('Il soffitto piano deve essere più corto della base.'); break; }
      risolviInclinata(v.B - v.P, v.H1, 'H2', v.H1);
      if (errori.length) break;
      punti = [P(0, 0), P(v.B, 0), P(v.B, v.H2), P(v.P, v.H1), P(0, v.H1)];
      pareti = [
        { nome: 'Pavimento', tipo: 'pavimento', campo: 'B' },
        { nome: 'Muro basso', tipo: 'muro', campo: 'H2' },
        { nome: 'Inclinata', tipo: 'inclinata', campo: 'I' },
        { nome: 'Soffitto piano', tipo: 'soffitto', campo: 'P' },
        { nome: 'Muro alto', tipo: 'muro', campo: 'H1' },
      ];
      break;
    }
    case 'capanna':
    case 'sei': {
      const piano = f.id === 'sei' ? v.P : 0;
      if (piano >= v.B) { errori.push('Il soffitto piano deve essere più corto della base.'); break; }
      // Colmo sinistro R1: a distanza Is dalla cima del muro sx, e a distanza Id
      // dalla cima del muro dx spostata indietro del tratto piano.
      const R1 = puntoColmo(P(0, v.Hs), v.Is, P(v.B - piano, v.Hd), v.Id);
      if (!R1) { errori.push('Con queste falde il tetto non si chiude: controlla le lunghezze delle falde e la base.'); break; }
      if (R1.y <= Math.max(v.Hs, v.Hd) + 1 || R1.x <= 0 || R1.x + piano >= v.B) {
        errori.push('Le falde sono troppo corte o troppo lunghe per questa base: il colmo non sta sopra i muri.'); break;
      }
      calcolati.colmoAltezza = r1(R1.y);
      calcolati.colmoDaSinistra = r1(R1.x);
      if (f.id === 'sei') {
        punti = [P(0, 0), P(v.B, 0), P(v.B, v.Hd), P(R1.x + piano, R1.y), P(R1.x, R1.y), P(0, v.Hs)];
        pareti = [
          { nome: 'Pavimento', tipo: 'pavimento', campo: 'B' },
          { nome: 'Muro destro', tipo: 'muro', campo: 'Hd' },
          { nome: 'Falda destra', tipo: 'inclinata', campo: 'Id' },
          { nome: 'Soffitto piano', tipo: 'soffitto', campo: 'P' },
          { nome: 'Falda sinistra', tipo: 'inclinata', campo: 'Is' },
          { nome: 'Muro sinistro', tipo: 'muro', campo: 'Hs' },
        ];
      } else {
        punti = [P(0, 0), P(v.B, 0), P(v.B, v.Hd), P(R1.x, R1.y), P(0, v.Hs)];
        pareti = [
          { nome: 'Pavimento', tipo: 'pavimento', campo: 'B' },
          { nome: 'Muro destro', tipo: 'muro', campo: 'Hd' },
          { nome: 'Falda destra', tipo: 'inclinata', campo: 'Id' },
          { nome: 'Falda sinistra', tipo: 'inclinata', campo: 'Is' },
          { nome: 'Muro sinistro', tipo: 'muro', campo: 'Hs' },
        ];
      }
      break;
    }
    default: errori.push('Forma sconosciuta.');
  }
  if (errori.length) return { ok: false, errori, avvisi, pareti: [], punti: [], angoli: [], calcolati };

  // Specchia: x → larghezza − x, poi ribalto l'ordine per restare antiorari.
  const W = Math.max(...punti.map((p) => p.x));
  if (specchia && f.specchiabile) {
    const n = punti.length;
    const sp = punti.map((p) => P(W - p.x, p.y));
    // nuovo ordine: (0,0) resta il primo; parete i (da p_i a p_i+1) → percorsa al contrario
    const nuoviPunti = [sp[1], sp[0]];
    for (let i = n - 1; i >= 2; i--) nuoviPunti.push(sp[i]);
    const nuovePareti = [pareti[0]];
    for (let i = n - 1; i >= 1; i--) nuovePareti.push(pareti[i]);
    punti = nuoviPunti; pareti = nuovePareti;
    for (const p of pareti) p.nome = p.nome.replace('sinistro', '§').replace('destro', 'sinistro').replace('§', 'destro');
  }

  // Lunghezze, inclinazioni, lettere
  const n = punti.length;
  pareti = pareti.map((p, i) => {
    const a = punti[i], b = punti[(i + 1) % n];
    const lunghezza = Math.hypot(b.x - a.x, b.y - a.y);
    const out = { ...p, lettera: String.fromCharCode(65 + i), lunghezza: r1(lunghezza),
      inserita: p.campo != null && num(valori[p.campo]) != null && !calcolati[p.campo] };
    if (p.tipo === 'inclinata') {
      out.inclinazione = r1((Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI);
    }
    return out;
  });
  // Angoli interni (poligono antiorario)
  // Angolo interno = 180° − svolta (sinistra positiva, percorso antiorario).
  const angoli = punti.map((p, i) => {
    const prev = punti[(i - 1 + n) % n], next = punti[(i + 1) % n];
    const e1x = p.x - prev.x, e1y = p.y - prev.y, e2x = next.x - p.x, e2y = next.y - p.y;
    const svolta = Math.atan2(e1x * e2y - e1y * e2x, e1x * e2x + e1y * e2y) * 180 / Math.PI;
    return r1(180 - svolta);
  });
  let area = 0;
  for (let i = 0; i < n; i++) { const a = punti[i], b = punti[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  return {
    ok: true, forma: f.id, punti, pareti, angoli, calcolati, errori, avvisi,
    area_m2: Math.round(Math.abs(area) / 2 / 1e4) / 100,
    larghezza: r1(W), altezzaMax: r1(Math.max(...punti.map((p) => p.y))),
  };
}
