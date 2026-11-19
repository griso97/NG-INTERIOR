// =============================================================================
// PAVIMENTI A SCELTA della vista 3D (solo i dati: li usano il pannello e la resa 3D)
// tipo 'foto': la foto si ripete (copre mm × mm); 'lastre' / 'scacchi': lastre composte dal
// programma (misura `lastra` in mm, fuga del colore `fuga`); 'parquet' e 'gres': quelli di prima.
// tono: un filo più scuro (le pietre chiare con la luce piena si «bruciavano»).
// Foto: ambientCG, CC0 — vedi materials/pavimenti/LEGGIMI.txt
// =============================================================================
export const PAVIMENTI = [
  { id: 'rovere-chiaro', nome: 'Rovere chiaro a plance', gruppo: 'Legno', tipo: 'parquet', rough: 0.62, env: 0.45 },
  { id: 'rovere-listoni', nome: 'Rovere naturale a listoni', gruppo: 'Legno', tipo: 'foto', img: 'legno-listoni', mm: 1800, rough: 0.55, env: 0.5 },
  { id: 'spina-italiana', nome: 'Rovere a spina italiana', gruppo: 'Legno', tipo: 'foto', img: 'legno-spina-italiana', mm: 3200, rough: 0.55, env: 0.5 },
  { id: 'spina-ungherese', nome: 'Rovere a spina ungherese', gruppo: 'Legno', tipo: 'foto', img: 'legno-spina-ungherese', mm: 1800, rough: 0.55, env: 0.5 },
  { id: 'rovere-scuro', nome: 'Rovere scuro fumé', gruppo: 'Legno', tipo: 'foto', img: 'legno-scuro', mm: 1300, rough: 0.5, env: 0.55 },
  { id: 'carrara', nome: 'Marmo bianco di Carrara · lastre 120×120', gruppo: 'Marmo e pietra', tipo: 'lastre', img: 'marmo-carrara', mm: 1500, lastra: [1200, 1200], fuga: '#b4b1ab', rough: 0.16, env: 1, tono: 0.8 },
  { id: 'marquina', nome: 'Nero Marquina · lastre 60×120', gruppo: 'Marmo e pietra', tipo: 'lastre', img: 'marmo-nero', mm: 1500, lastra: [600, 1200], fuga: '#151515', rough: 0.14, env: 1 },
  { id: 'marmo-grigio', nome: 'Marmo grigio · lastre 60×120', gruppo: 'Marmo e pietra', tipo: 'lastre', img: 'marmo-grigio', mm: 1500, lastra: [600, 1200], fuga: '#8c8e94', rough: 0.18, env: 0.95 },
  { id: 'travertino', nome: 'Travertino chiaro · lastre 120×60', gruppo: 'Marmo e pietra', tipo: 'lastre', img: 'travertino', mm: 1200, lastra: [1200, 600], fuga: '#c9bda6', rough: 0.42, env: 0.6, tono: 0.84 },
  { id: 'terrazzo', nome: 'Terrazzo bianco · 60×60', gruppo: 'Marmo e pietra', tipo: 'lastre', img: 'terrazzo', mm: 1000, lastra: [600, 600], fuga: '#d5cfc5', rough: 0.3, env: 0.75, tono: 0.88 },
  { id: 'scacchiera', nome: 'Scacchiera marmo bianco e nero · 40×40', gruppo: 'Marmo e pietra', tipo: 'scacchi', img: ['marmo-carrara', 'marmo-nero'], mm: 1500, lastra: [400, 400], fuga: '#8f8b84', rough: 0.17, env: 1 },
  { id: 'cemento', nome: 'Gres effetto cemento · 120×120', gruppo: 'Gres e cemento', tipo: 'lastre', img: 'cemento', mm: 1100, lastra: [1200, 1200], fuga: '#8f8d88', rough: 0.68, env: 0.45, tono: 0.9 },
  { id: 'gres-grigio', nome: 'Gres grigio · 60×60', gruppo: 'Gres e cemento', tipo: 'gres', colore: 0x7c786f, rough: 0.5, env: 0.45 },
  { id: 'gres-antracite', nome: 'Gres antracite · 60×60', gruppo: 'Gres e cemento', tipo: 'gres', colore: 0x34333a, rough: 0.5, env: 0.45 },
];
export const GRUPPI_PAVIMENTI = ['Legno', 'Marmo e pietra', 'Gres e cemento'];
