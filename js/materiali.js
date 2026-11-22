// =============================================================================
// LIBRERIA MATERIALI — NG INTERIOR
// =============================================================================
// Database di tutti i materiali disponibili per le parti del mobile.
// Ogni materiale ha:
//   id       → identificatore stabile (slug), salvato nella config
//   nome     → nome visualizzato (quello stampato sul campione)
//   thumb    → immagine 96×96 per la palette
//   texture  → immagine 512×512 per il rendering 3D
//   colore   → fallback color (hex) usato finché la texture non è caricata
//
// Per aggiungere un nuovo materiale basta:
//   1) Mettere due jpg in /materials/ (slug.jpg + slug-thumb.jpg)
//   2) Aggiungere una riga qui sotto
// =============================================================================

import * as THREE from 'three';
import { leggiCatalogo, leggiFoto, nascosto, salvaFoto, salvaCatalogo } from './catalogo.js?v=20261124n';
import { LIBRERIA, CREDITI_LIBRERIA, GRUPPI_OGGETTI, creditoVoce } from './libreria3d-dati.js?v=20261124n';
import { aggiungiPavimentoProprio, GRUPPO_PROPRI } from './pavimenti-dati.js?v=20261124n';
export { CREDITI_LIBRERIA, GRUPPI_OGGETTI, creditoVoce };

/** Voce del catalogo per un prodotto della LIBRERIA 3D (js/libreria3d.js).
 *  posa: 'appeso' (lampade e cappe a isola: dal soffitto), 'parete' (quadri e cappe a parete: al muro),
 *  'terra' (sedie, sgabelli, tavoli, piante grandi), 'piano' (vasi, pane, piante piccole).
 *  assoluto: il 3D è già alla sua altezza (la cappa a parete: fondo a 160 cm, canna fino al soffitto). */
function voceLibreria(v) {
  const appesa = ['appeso', 'soffitto', 'cappa-isola', 'cappa-soffitto'].includes(v.tipo);
  const posa = appesa ? 'appeso' : v.tipo === 'parete' || v.tipo === 'cappa' ? 'parete'
    : v.posa || (['decor', 'cucina', 'piante'].includes(v.gruppo) ? 'piano' : 'terra');
  const foto = `oggetti/libreria/miniature/${v.id}.jpg`;
  return { id: `lib-${v.id}`, nome: v.nome, categoria: 'oggetto', sezione: 'oggetti', libreria: v.id, gruppo: v.gruppo, posa,
    ...(appesa ? { appeso: true } : {}), ...(v.tipo === 'cappa' ? { assoluto: true } : {}), ...(v.ritirato ? { ritirato: true } : {}),
    ...(v.tavolo ? { tavolo: true } : {}),                     // un tavolo: ci si appoggiano sopra gli oggetti
    thumb: foto, texture: foto, colore: 0xd8d2c8, misure: { ...v.misure },
    info: { note: creditoVoce(v) || CREDITI_LIBRERIA } };
}

// LEGNI (texture da foto reali, ripetute in base alla dimensione del pezzo)
// SOLIDI (bianco/nero/grigio matte, bianco/nero lucido) usano solo il
//   colore + proprietà di finitura, nessuna texture.
export const MATERIALI = [
  // ---- Legni batch 1 ----
  { id: 'noce-panarea-yoku', nome: 'Noce Panarea Yoku', categoria: 'legno',
    thumb: 'materials/noce-panarea-yoku-thumb.jpg',
    texture: 'materials/noce-panarea-yoku.jpg', colore: 0x8e6a3e },
  { id: 'roble-colorado', nome: 'Roble Colorado', categoria: 'legno',
    thumb: 'materials/roble-colorado-thumb.jpg',
    texture: 'materials/roble-colorado.jpg', colore: 0x9c8c7a },
  { id: 'roble-azabache', nome: 'Roble Azabache', categoria: 'legno',
    thumb: 'materials/roble-azabache-thumb.jpg',
    texture: 'materials/roble-azabache.jpg', colore: 0x2a2a28 },
  { id: 'roble-denver', nome: 'Roble Denver', categoria: 'legno',
    thumb: 'materials/roble-denver-v2-thumb.jpg',
    texture: 'materials/roble-denver-v2.jpg', colore: 0xb89a74 },   // ombra del telefono tolta
  { id: 'roble-hercules-19', nome: 'Roble Hercules 19', categoria: 'legno',
    thumb: 'materials/roble-hercules-19-thumb.jpg',
    texture: 'materials/roble-hercules-19.jpg', colore: 0xc0a07a },
  { id: 'roble-hera', nome: 'Roble Hera', categoria: 'legno',
    thumb: 'materials/roble-hera-thumb.jpg',
    texture: 'materials/roble-hera.jpg', colore: 0xd6c3a6 },
  { id: 'nogal-slow', nome: 'Nogal Slow', categoria: 'legno',
    thumb: 'materials/nogal-slow-thumb.jpg',
    texture: 'materials/nogal-slow.jpg', colore: 0x9c7a56 },
  { id: 'roble-amazona', nome: 'Roble Amazona', categoria: 'legno',
    thumb: 'materials/roble-amazona-thumb.jpg',
    texture: 'materials/roble-amazona.jpg', colore: 0xc2a580 },
  // ---- Legni batch 2 ----
  { id: 'noce-caldo', nome: 'Noce Caldo', categoria: 'legno',
    thumb: 'materials/noce-caldo-thumb.jpg',
    texture: 'materials/noce-caldo.jpg', colore: 0x7a5236,
    nota: 'nome provvisorio' },
  { id: 'roble-palma-19', nome: 'Roble Palma 19', categoria: 'legno',
    thumb: 'materials/roble-palma-19-thumb.jpg',
    texture: 'materials/roble-palma-19.jpg', colore: 0x5c4634 },
  { id: 'roble-aurora', nome: 'Roble Aurora', categoria: 'legno',
    thumb: 'materials/roble-aurora-thumb.jpg',
    texture: 'materials/roble-aurora.jpg', colore: 0xd0c3a9 },
  { id: 'rovere-nodoso', nome: 'Rovere Nodoso', categoria: 'legno',
    thumb: 'materials/rovere-nodoso-thumb.jpg',
    texture: 'materials/rovere-nodoso.jpg', colore: 0xa0804c,
    nota: 'nome provvisorio' },
  // ---- TAVOLE INTERE (foto ufficiali, alta qualità): ogni foto è il PANNELLO intero (lato lungo
  //      2750 mm; l'altro lato dalla proporzione della foto, così niente è stirato né schiacciato).
  //      La foto si usa ESATTAMENTE com'è (nessuna correzione): ogni anta è un pezzo TAGLIATO dalla
  //      tavola, alla misura vera (tavola: true → vedi uvInScala e getMaterialeTHREE) ----
  { id: 'aok-01', nome: 'AOK 01', categoria: 'legno',
    thumb: 'materials/aok-01-v2-thumb.jpg',
    texture: 'materials/aok-01-v2.jpg', colore: 0xcdc2b3,
    campione: { wMm: 1373, hMm: 2750 }, tavola: true, nota: 'Alvic Syncron Anniversary Oak 01 (tavola intera)' },
  { id: 'aok-02', nome: 'AOK 02', categoria: 'legno',
    thumb: 'materials/aok-02-thumb.jpg',
    texture: 'materials/aok-02.jpg', colore: 0xbca389,
    campione: { wMm: 1377, hMm: 2750 }, tavola: true, nota: 'Alvic Syncron Anniversary Oak 02 (tavola intera)' },
  { id: 'aok-03', nome: 'AOK 03', categoria: 'legno',
    thumb: 'materials/aok-03-thumb.jpg',
    texture: 'materials/aok-03.jpg', colore: 0x8b7161,
    campione: { wMm: 1369, hMm: 2750 }, tavola: true, nota: 'Alvic Syncron Anniversary Oak 03 (tavola intera)' },
  { id: 'syncron-noce-01', nome: 'Syncron Noce 01', categoria: 'legno',
    thumb: 'materials/syncron-noce-01-v2-thumb.jpg',
    texture: 'materials/syncron-noce-01-v2.jpg', colore: 0xac907a,
    campione: { wMm: 1269, hMm: 2750 }, tavola: true, nota: 'Alvic Syncron Nocce 01 (tavola intera)' },
  { id: 'syncron-noce-03', nome: 'Syncron Noce 03', categoria: 'legno',
    thumb: 'materials/syncron-noce-03-thumb.jpg',
    texture: 'materials/syncron-noce-03.jpg', colore: 0x755c49,
    campione: { wMm: 1269, hMm: 2750 }, tavola: true, nota: 'Alvic Syncron Nocce 03 (tavola intera)' },
  { id: 'lakeland-oak-03', nome: 'Lakeland Oak 03', categoria: 'legno',
    thumb: 'materials/lakeland-oak-03-thumb.jpg',
    texture: 'materials/lakeland-oak-03.jpg', colore: 0x956e4f,
    campione: { wMm: 1537, hMm: 2750 }, tavola: true, nota: 'Alvic Lakeland Oak 03 (tavola intera)' },
  { id: 'ice-cream-01', nome: 'Ice Cream 01', categoria: 'legno',
    thumb: 'materials/ice-cream-01-thumb.jpg',
    texture: 'materials/ice-cream-01.jpg', colore: 0xdfdad5,
    campione: { wMm: 1342, hMm: 2750 }, tavola: true, nota: 'Alvic Ice Cream 01 (tavola intera)' },
  { id: 'ice-cream-04', nome: 'Ice Cream 04', categoria: 'legno',
    thumb: 'materials/ice-cream-04-thumb.jpg',
    texture: 'materials/ice-cream-04.jpg', colore: 0x615c5a,
    campione: { wMm: 1342, hMm: 2750 }, tavola: true, nota: 'Alvic Ice Cream 04 (tavola intera)' },
  { id: 'rosales-01', nome: 'Rosales 01', categoria: 'legno',
    thumb: 'materials/rosales-01-thumb.jpg',
    texture: 'materials/rosales-01.jpg', colore: 0xa97f5f,
    campione: { wMm: 1323, hMm: 2750 }, tavola: true, nota: 'Alvic Rosales 01 (tavola intera)' },
  { id: 'rosales-chiaro', nome: 'Rosales (chiaro)', categoria: 'legno',
    thumb: 'materials/rosales-chiaro-thumb.jpg',
    texture: 'materials/rosales-chiaro.jpg', colore: 0xe1d0c1,
    campione: { wMm: 1323, hMm: 2750 }, tavola: true, nota: 'Alvic Rosales chiaro: numero da confermare (tavola intera)' },
  { id: 'rosales-03', nome: 'Rosales 03', categoria: 'legno',
    thumb: 'materials/rosales-03-thumb.jpg',
    texture: 'materials/rosales-03.jpg', colore: 0x604c38,
    campione: { wMm: 1375, hMm: 2750 }, tavola: true, nota: 'Alvic Rosales 03 (tavola intera)' },
  { id: 'rosales-04', nome: 'Rosales 04', categoria: 'legno',
    thumb: 'materials/rosales-04-thumb.jpg',
    texture: 'materials/rosales-04.jpg', colore: 0xa78a6d,
    campione: { wMm: 1312, hMm: 2750 }, tavola: true, nota: 'Alvic Rosales 04 (tavola intera)' },
  { id: 'roble-muratti-04', nome: 'Roble Muratti 04', categoria: 'legno',
    thumb: 'materials/roble-muratti-04-thumb.jpg',
    texture: 'materials/roble-muratti-04.jpg', colore: 0xe8e7e3,
    campione: { wMm: 1396, hMm: 2750 }, tavola: true, nota: 'Alvic Roble Muratti 04 (tavola intera)' },
  { id: 'roble-muratti-grigio', nome: 'Roble Muratti (grigio)', categoria: 'legno',
    thumb: 'materials/roble-muratti-grigio-thumb.jpg',
    texture: 'materials/roble-muratti-grigio.jpg', colore: 0x817874,
    campione: { wMm: 1456, hMm: 2750 }, tavola: true, nota: 'Alvic Roble Muratti grigio: numero da confermare (tavola intera)' },
  { id: 'marmol-versilia', nome: 'Mármol Versilia', categoria: 'legno',
    thumb: 'materials/marmol-versilia-thumb.jpg',
    texture: 'materials/marmol-versilia.jpg', colore: 0xf5f5f3,
    campione: { wMm: 1358, hMm: 2750 }, tavola: true, nota: 'Alvic Mármol Versilia (tavola intera)' },
  { id: 'porcelain-01-gold', nome: 'Porcelain 01 Gold', categoria: 'legno',
    thumb: 'materials/porcelain-01-gold-thumb.jpg',
    texture: 'materials/porcelain-01-gold.jpg', colore: 0xc4b9b0,
    campione: { wMm: 2750, hMm: 1702 }, tavola: true, nota: 'Alvic Porcelain 01 Gold (tavola intera, misura dalla proporzione della foto)' },
  { id: 'porcelain-03-silver', nome: 'Porcelain 03 Silver', categoria: 'legno',
    thumb: 'materials/porcelain-03-silver-thumb.jpg',
    texture: 'materials/porcelain-03-silver.jpg', colore: 0x686866,
    campione: { wMm: 2750, hMm: 1702 }, tavola: true, nota: 'Alvic Porcelain 03 Silver (tavola intera, misura dalla proporzione della foto)' },
  // ---- Alvic Zenit marmi (la foto è la tavola intera 1240 × 2750 mm) ----
  { id: 'sm-nuvola-01', nome: 'SM Nuvola 01', categoria: 'legno',
    thumb: 'materials/sm-nuvola-01-thumb.jpg',
    texture: 'materials/sm-nuvola-01.jpg', colore: 0xf0ece2,
    campione: { wMm: 1240, hMm: 2750 }, marmo: true, nota: 'Alvic Zenit Nuvola 01 Supermate' },
  { id: 'sm-nuvola-03', nome: 'SM Nuvola 03', categoria: 'legno',
    thumb: 'materials/sm-nuvola-03-thumb.jpg',
    texture: 'materials/sm-nuvola-03.jpg', colore: 0xe9ebeb,
    campione: { wMm: 1240, hMm: 2750 }, marmo: true, nota: 'Alvic Zenit Nuvola 03 Supermate' },
  // ---- Tinte solide (matte e lucide) ----
  // COLORI ALVIC dalle foto dei campioni (il colore è quello della foto, identico):
  //  - MATTE (Zenit Supermate, «SM»): opaco pieno, niente riflessi, la luce si spande morbida;
  //  - LUXE (lucido): stesso colore + laccato a specchio (riflette la stanza come le foto di riferimento).
  // I colori che c'erano già tengono il loro id (bianco-matte, sm-agua-marina, …): i progetti salvati restano validi.
  { id: 'sm-agave', nome: 'SM Agave', categoria: 'tinta', thumb: 'materials/sm-agave-thumb.jpg', colore: 0xa4b1a0,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Agave Supermate (colore dalla foto del campione)' },
  { id: 'sm-agua-marina', nome: 'SM Agua Marina', categoria: 'tinta', thumb: 'materials/sm-agua-marina-thumb.jpg', colore: 0x86a09f,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Agua Marina Supermate (colore dalla foto del campione)' },
  { id: 'sm-almagra', nome: 'SM Almagra', categoria: 'tinta', thumb: 'materials/sm-almagra-thumb.jpg', colore: 0x73403d,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Almagra Supermate (colore dalla foto del campione)' },
  { id: 'sm-amarillo-albero', nome: 'SM Amarillo Albero', categoria: 'tinta', thumb: 'materials/sm-amarillo-albero-thumb.jpg', colore: 0xf4ba71,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Amarillo Albero Supermate (colore dalla foto del campione)' },
  { id: 'sm-antracita', nome: 'SM Antracita', categoria: 'tinta', thumb: 'materials/sm-antracita-thumb.jpg', colore: 0x3e3e3c,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Antracita Supermate (colore dalla foto del campione)' },
  { id: 'sm-arena', nome: 'SM Arena', categoria: 'tinta', thumb: 'materials/sm-arena-thumb.jpg', colore: 0xefdfd0,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Arena Supermate (colore dalla foto del campione)' },
  { id: 'sm-azul-indaco', nome: 'SM Azul Indaco', categoria: 'tinta', thumb: 'materials/sm-azul-indaco-thumb.jpg', colore: 0x40526a,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Azul Indaco Supermate (colore dalla foto del campione)' },
  { id: 'sm-azul-marino', nome: 'SM Azul Marino', categoria: 'tinta', thumb: 'materials/sm-azul-marino-thumb.jpg', colore: 0x1d2538,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Azul Marino Supermate (colore dalla foto del campione)' },
  { id: 'sm-azul-ultramar', nome: 'SM Azul Ultramar', categoria: 'tinta', thumb: 'materials/sm-azul-ultramar-thumb.jpg', colore: 0x2a4e8c,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Azul Ultramar Supermate (colore dalla foto del campione)' },
  { id: 'sm-basalto', nome: 'SM Basalto', categoria: 'tinta', thumb: 'materials/sm-basalto-thumb.jpg', colore: 0x847b76,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Basalto Supermate (colore dalla foto del campione)' },
  { id: 'bianco-matte', nome: 'SM Blanco', categoria: 'tinta', thumb: 'materials/bianco-matte-thumb.jpg', colore: 0xfdfeff,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Blanco Supermate (colore dalla foto del campione)' },
  { id: 'sm-camel', nome: 'SM Camel', categoria: 'tinta', thumb: 'materials/sm-camel-thumb.jpg', colore: 0xc8a57d,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Camel Supermate (colore dalla foto del campione)' },
  { id: 'sm-cashmere', nome: 'SM Cashmere', categoria: 'tinta', thumb: 'materials/sm-cashmere-thumb.jpg', colore: 0xcdc6bc,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Cashmere Supermate (colore dalla foto del campione)' },
  { id: 'sm-coral', nome: 'SM Coral', categoria: 'tinta', thumb: 'materials/sm-coral-thumb.jpg', colore: 0xd2816c,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Coral Supermate (colore dalla foto del campione)' },
  { id: 'sm-cotto', nome: 'SM Cotto', categoria: 'tinta', thumb: 'materials/sm-cotto-thumb.jpg', colore: 0xa65f4b,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Cotto Supermate (colore dalla foto del campione)' },
  { id: 'sm-gris-nube', nome: 'SM Gris Nube', categoria: 'tinta', thumb: 'materials/sm-gris-nube-thumb.jpg', colore: 0xcbcbcb,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Gris Nube Supermate (colore dalla foto del campione)' },
  { id: 'sm-gris-plomo', nome: 'SM Gris Plomo', categoria: 'tinta', thumb: 'materials/sm-gris-plomo-thumb.jpg', colore: 0x5f5e59,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Gris Plomo Supermate (colore dalla foto del campione)' },
  { id: 'sm-ice-blue', nome: 'SM Ice Blue', categoria: 'tinta', thumb: 'materials/sm-ice-blue-thumb.jpg', colore: 0xbdcbcc,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Ice Blue Supermate (colore dalla foto del campione)' },
  { id: 'sm-lavander', nome: 'SM Lavander', categoria: 'tinta', thumb: 'materials/sm-lavander-thumb.jpg', colore: 0xd9d1e0,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Lavander Supermate (colore dalla foto del campione)' },
  { id: 'sm-naranja-citrus', nome: 'SM Naranja Citrus', categoria: 'tinta', thumb: 'materials/sm-naranja-citrus-thumb.jpg', colore: 0xdc5d34,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Naranja Citrus Supermate (colore dalla foto del campione)' },
  { id: 'sm-rojo-pompei', nome: 'SM Rojo Pompei', categoria: 'tinta', thumb: 'materials/sm-rojo-pompei-thumb.jpg', colore: 0xbd564f,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Rojo Pompei Supermate (colore dalla foto del campione)' },
  { id: 'sm-verde-salvia', nome: 'SM Verde Salvia', categoria: 'tinta', thumb: 'materials/sm-verde-salvia-thumb.jpg', colore: 0x4a4f49,
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Verde Salvia Supermate (colore dalla foto del campione)' },
  // SM Negro (Alvic Zenit Supermate) al posto del vecchio "Nero opaco": stesso id, così i
  // progetti salvati restano uguali
  { id: 'nero-matte',    nome: 'SM Negro',       categoria: 'tinta',
    thumb: 'materials/sm-negro-thumb.jpg',      colore: 0x0e0e0e,      // il colore del campione (foto ufficiale)
    solido: true, roughness: 1.0, metalness: 0.0, nota: 'Alvic Zenit Negro Supermate' },
  { id: 'grigio-matte',  nome: 'Grigio opaco',   categoria: 'tinta',
    thumb: 'materials/grigio-matte-thumb.jpg',  colore: 0x8a8a8a,
    solido: true, roughness: 1.0, metalness: 0.0 },
  // LUXE: laccato lucido con riflessi netti a specchio (roughness bassissima + clearcoat).
  { id: 'lx-agave', nome: 'Luxe Agave', categoria: 'tinta', thumb: 'materials/lx-agave-thumb.jpg', colore: 0xa4b1a0,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Agave lucido (colore dalla foto del campione)' },
  { id: 'lx-agua-marina', nome: 'Luxe Agua Marina', categoria: 'tinta', thumb: 'materials/lx-agua-marina-thumb.jpg', colore: 0x86a09f,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Agua Marina lucido (colore dalla foto del campione)' },
  { id: 'lx-almagra', nome: 'Luxe Almagra', categoria: 'tinta', thumb: 'materials/lx-almagra-thumb.jpg', colore: 0x73403d,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Almagra lucido (colore dalla foto del campione)' },
  { id: 'lx-amarillo-albero', nome: 'Luxe Amarillo Albero', categoria: 'tinta', thumb: 'materials/lx-amarillo-albero-thumb.jpg', colore: 0xf4ba71,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Amarillo Albero lucido (colore dalla foto del campione)' },
  { id: 'lx-antracita', nome: 'Luxe Antracita', categoria: 'tinta', thumb: 'materials/lx-antracita-thumb.jpg', colore: 0x3e3e3c,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Antracita lucido (colore dalla foto del campione)' },
  { id: 'lx-arena', nome: 'Luxe Arena', categoria: 'tinta', thumb: 'materials/lx-arena-thumb.jpg', colore: 0xefdfd0,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Arena lucido (colore dalla foto del campione)' },
  { id: 'lx-azul-indaco', nome: 'Luxe Azul Indaco', categoria: 'tinta', thumb: 'materials/lx-azul-indaco-thumb.jpg', colore: 0x40526a,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Azul Indaco lucido (colore dalla foto del campione)' },
  { id: 'lx-azul-marino', nome: 'Luxe Azul Marino', categoria: 'tinta', thumb: 'materials/lx-azul-marino-thumb.jpg', colore: 0x1d2538,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Azul Marino lucido (colore dalla foto del campione)' },
  { id: 'lx-azul-ultramar', nome: 'Luxe Azul Ultramar', categoria: 'tinta', thumb: 'materials/lx-azul-ultramar-thumb.jpg', colore: 0x2a4e8c,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Azul Ultramar lucido (colore dalla foto del campione)' },
  { id: 'lx-basalto', nome: 'Luxe Basalto', categoria: 'tinta', thumb: 'materials/lx-basalto-thumb.jpg', colore: 0x847b76,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Basalto lucido (colore dalla foto del campione)' },
  { id: 'bianco-lucido', nome: 'Luxe Blanco', categoria: 'tinta', thumb: 'materials/bianco-lucido-thumb.jpg', colore: 0xfdfeff,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Blanco lucido (colore dalla foto del campione)' },
  { id: 'lx-camel', nome: 'Luxe Camel', categoria: 'tinta', thumb: 'materials/lx-camel-thumb.jpg', colore: 0xc8a57d,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Camel lucido (colore dalla foto del campione)' },
  { id: 'lx-cashmere', nome: 'Luxe Cashmere', categoria: 'tinta', thumb: 'materials/lx-cashmere-thumb.jpg', colore: 0xcdc6bc,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Cashmere lucido (colore dalla foto del campione)' },
  { id: 'lx-coral', nome: 'Luxe Coral', categoria: 'tinta', thumb: 'materials/lx-coral-thumb.jpg', colore: 0xd2816c,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Coral lucido (colore dalla foto del campione)' },
  { id: 'lx-cotto', nome: 'Luxe Cotto', categoria: 'tinta', thumb: 'materials/lx-cotto-thumb.jpg', colore: 0xa65f4b,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Cotto lucido (colore dalla foto del campione)' },
  { id: 'lx-gris-nube', nome: 'Luxe Gris Nube', categoria: 'tinta', thumb: 'materials/lx-gris-nube-thumb.jpg', colore: 0xcbcbcb,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Gris Nube lucido (colore dalla foto del campione)' },
  { id: 'lx-gris-plomo', nome: 'Luxe Gris Plomo', categoria: 'tinta', thumb: 'materials/lx-gris-plomo-thumb.jpg', colore: 0x5f5e59,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Gris Plomo lucido (colore dalla foto del campione)' },
  { id: 'lx-ice-blue', nome: 'Luxe Ice Blue', categoria: 'tinta', thumb: 'materials/lx-ice-blue-thumb.jpg', colore: 0xbdcbcc,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Ice Blue lucido (colore dalla foto del campione)' },
  { id: 'lx-lavander', nome: 'Luxe Lavander', categoria: 'tinta', thumb: 'materials/lx-lavander-thumb.jpg', colore: 0xd9d1e0,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Lavander lucido (colore dalla foto del campione)' },
  { id: 'lx-naranja-citrus', nome: 'Luxe Naranja Citrus', categoria: 'tinta', thumb: 'materials/lx-naranja-citrus-thumb.jpg', colore: 0xdc5d34,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Naranja Citrus lucido (colore dalla foto del campione)' },
  { id: 'lx-rojo-pompei', nome: 'Luxe Rojo Pompei', categoria: 'tinta', thumb: 'materials/lx-rojo-pompei-thumb.jpg', colore: 0xbd564f,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Rojo Pompei lucido (colore dalla foto del campione)' },
  { id: 'lx-verde-salvia', nome: 'Luxe Verde Salvia', categoria: 'tinta', thumb: 'materials/lx-verde-salvia-thumb.jpg', colore: 0x4a4f49,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true, nota: 'Alvic Luxe Verde Salvia lucido (colore dalla foto del campione)' },
  { id: 'nero-lucido',   nome: 'Nero lucido',    categoria: 'tinta',
    thumb: 'materials/nero-lucido-thumb.jpg',   colore: 0x060607,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true },
  // ---- Encimere / piani di lavoro ----
  // Ogni encimera porta anche il proprio spessore (mm): viene applicato al
  // top della cucina quando questa encimera e' selezionata.
  // foto della lastra intera: 3000 × 1400 mm (la crepa grande si vede una volta per lastra)
  { id: 'compacto-negro', nome: 'Compacto negro', categoria: 'encimera',
    thumb: 'materials/compacto-negro-thumb.jpg',
    texture: 'materials/compacto-negro.jpg', colore: 0x212121,
    campione: { wMm: 3000, hMm: 1400 }, spessore: 12 },
  // foto della lastra intera: 3400 × 1400 mm
  { id: 'compacto-bernini', nome: 'Compacto Bernini', categoria: 'encimera',
    thumb: 'materials/compacto-bernini-thumb.jpg',
    texture: 'materials/compacto-bernini.jpg', colore: 0xebe7db,
    campione: { wMm: 3400, hMm: 1400 }, spessore: 12 },
  // foto della lastra intera: 3600 × 1400 mm
  { id: 'compacto-siena', nome: 'Compacto Siena', categoria: 'encimera',
    thumb: 'materials/compacto-siena-thumb.jpg',
    texture: 'materials/compacto-siena.jpg', colore: 0xebe1d4,
    campione: { wMm: 3600, hMm: 1400 }, spessore: 12 },
  // COMPACTO NUVOLA (foto della tavola intera girata: lato lungo lungo il piano)
  { id: 'compacto-nuvola-04', nome: 'Compacto Nuvola 04', categoria: 'encimera',
    thumb: 'materials/compacto-nuvola-04-thumb.jpg',
    texture: 'materials/compacto-nuvola-04.jpg', colore: 0xdddcd3,
    campione: { wMm: 2750, hMm: 1240 }, spessore: 12 },
  { id: 'compacto-nuvola-03', nome: 'Compacto Nuvola 03', categoria: 'encimera',
    thumb: 'materials/compacto-nuvola-03-thumb.jpg',
    texture: 'materials/compacto-nuvola-03.jpg', colore: 0xe9ebeb,
    campione: { wMm: 2750, hMm: 1240 }, spessore: 12 },
  { id: 'compacto-nuvola-01', nome: 'Compacto Nuvola 01', categoria: 'encimera',
    thumb: 'materials/compacto-nuvola-01-thumb.jpg',
    texture: 'materials/compacto-nuvola-01.jpg', colore: 0xeee9dd,
    campione: { wMm: 2110, hMm: 1240 }, spessore: 12 },
  // Tinta solida bianca opaca (nessuna texture, solo colore + matte):
  // usa la logica "solido" del getMaterialeTHREE come i colori delle ante.
  { id: 'compacto-blanco-sm', nome: 'Compacto Blanco SM', categoria: 'encimera',
    thumb: 'materials/compacto-blanco-sm-thumb.jpg', colore: 0xeeeae2,
    solido: true, roughness: 1.0, metalness: 0.0,
    spessore: 12 },
  // ---- R3 Supra Alvic (spessore 38 mm, nomi identici alle schede prodotto) ----
  // Tinte solide: blanco, cashmere, agave (colore campionato dalla foto).
  { id: 'r3-supra-blanco', nome: 'R3 Supra 38mm Blanco', categoria: 'encimera',
    thumb: 'materials/r3-supra-blanco-thumb.jpg', colore: 0xfaf9f8,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  { id: 'r3-supra-cashmere', nome: 'R3 Supra Cashmere Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-cashmere-thumb.jpg', colore: 0xcec6bd,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  { id: 'r3-supra-agave', nome: 'R3 Supra Agave Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-agave-thumb.jpg', colore: 0xa6b0a1,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  // Texture reali: cemento, marmi, legni.
  { id: 'r3-supra-cemento-oscuro', nome: 'R3 Supra 38mm Cemento Oscuro', categoria: 'encimera',
    thumb: 'materials/r3-supra-cemento-oscuro-thumb.jpg',
    texture: 'materials/r3-supra-cemento-oscuro.jpg', colore: 0x3a3836, spessore: 38 },
  { id: 'r3-supra-marmol-markina', nome: 'R3 Supra Mármol Markina Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-marmol-markina-thumb.jpg',
    // foto di un pezzo VERO da 570 × 570 mm, in scala vera sul piano (continua, senza specchi)
    texture: 'materials/r3-supra-marmol-markina.jpg', colore: 0x2c2b29,
    campione: { wMm: 570, hMm: 570 }, spessore: 38 },
  // stessa foto del pannello Mármol Versilia (la tavola intera, identica): il lato lungo corre lungo il piano
  { id: 'r3-supra-marmol-versilia', nome: 'R3 Supra Mármol Versilia Alvic', categoria: 'encimera',
    thumb: 'materials/marmol-versilia-thumb.jpg',
    texture: 'materials/marmol-versilia.jpg', colore: 0xf5f5f3,
    campione: { wMm: 1358, hMm: 2750 }, tavola: true, ruota: true, spessore: 38 },
  { id: 'r3-supra-picasso-03', nome: 'R3 Supra Picasso 03 Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-picasso-03-thumb.jpg',
    texture: 'materials/r3-supra-picasso-03.jpg', colore: 0x9c7a56, spessore: 38 },
  { id: 'r3-supra-oak', nome: 'Encimera EP141NAT ANV 02 OAK R3 Supra 620x38mm', categoria: 'encimera',
    thumb: 'materials/r3-supra-oak-thumb.jpg',
    texture: 'materials/r3-supra-oak.jpg', colore: 0xcdb48a, spessore: 38 },
  // ---- Oggetti ed elettrodomestici PRONTI (foto già ritagliate, misure delle schede tecniche) ----
  //      il 3D lo fa lo scanner a pezzi (oggetto3d.js) come per gli oggetti aggiunti da foto
  { id: 'smeg-tsf01-nero', nome: 'Tostapane SMEG TSF01 nero', categoria: 'oggetto', sezione: 'oggetti',
    thumb: 'oggetti/smeg-tsf01-nero-fronte-thumb.png', texture: 'oggetti/smeg-tsf01-nero-fronte.png', colore: 0x15161a,
    misure: { w: 325, d: 195, h: 198 }, pianta: 'auto', tipi: {},
    viste: { fronte: 'oggetti/smeg-tsf01-nero-fronte.png', lato: 'oggetti/smeg-tsf01-nero-lato.png', sopra: null, dietro: null },
    info: { note: 'SMEG TSF01BLEU · 31 × 19,5 × 19,8 cm (32,5 cm con la leva)' } },
  { id: 'smeg-klf03-panna', nome: 'Bollitore SMEG KLF03 panna', categoria: 'oggetto', sezione: 'oggetti',
    thumb: 'oggetti/smeg-klf03-panna-fronte-thumb.png', texture: 'oggetti/smeg-klf03-panna-fronte.png', colore: 0xeee8d6,
    misure: { w: 226, d: 171, h: 248 }, pianta: 'auto', tipi: {},
    viste: { fronte: 'oggetti/smeg-klf03-panna-fronte.png', lato: null, sopra: null, dietro: null },
    info: { note: 'SMEG KLF03CREU · 22,6 × 17,1 × 24,8 cm' } },
  // ---- COLLEZIONE MODERNA e LUXURY (oggetti d'arredo modellati da noi: js/collezione-moderna.js) ----
  { id: 'cm-fruttiera-limoni', nome: 'Fruttiera in marmo con limoni', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fruttiera-limoni', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/fruttiera-limoni.jpg', texture: 'oggetti/moderni/miniature/fruttiera-limoni.jpg', colore: 0xd8d2c8,
    misure: { w: 320, d: 320, h: 200 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-fruttiera-pere', nome: 'Fruttiera nera con pere e lime', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fruttiera-pere', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/fruttiera-pere.jpg', texture: 'oggetti/moderni/miniature/fruttiera-pere.jpg', colore: 0xd8d2c8,
    misure: { w: 320, d: 320, h: 155 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-fruttiera-mista', nome: 'Fruttiera in travertino con frutta mista', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fruttiera-mista', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/fruttiera-mista.jpg', texture: 'oggetti/moderni/miniature/fruttiera-mista.jpg', colore: 0xd8d2c8,
    misure: { w: 320, d: 320, h: 240 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-vaso-scultura', nome: 'Vaso scultura in ceramica sabbia', categoria: 'oggetto', sezione: 'oggetti', moderno: 'vaso-scultura', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/vaso-scultura.jpg', texture: 'oggetti/moderni/miniature/vaso-scultura.jpg', colore: 0xd8d2c8,
    misure: { w: 242, d: 242, h: 424 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-vaso-ulivo', nome: 'Vaso nero con rami d\'ulivo', categoria: 'oggetto', sezione: 'oggetti', moderno: 'vaso-ulivo', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/vaso-ulivo.jpg', texture: 'oggetti/moderni/miniature/vaso-ulivo.jpg', colore: 0xd8d2c8,
    misure: { w: 390, d: 490, h: 960 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-taglieri', nome: 'Taglieri in noce e rovere', categoria: 'oggetto', sezione: 'oggetti', moderno: 'taglieri', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/taglieri.jpg', texture: 'oggetti/moderni/miniature/taglieri.jpg', colore: 0xd8d2c8,
    misure: { w: 505, d: 255, h: 40 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-libri', nome: 'Libri di cucina con ciotola in ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'libri', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/libri.jpg', texture: 'oggetti/moderni/miniature/libri.jpg', colore: 0xd8d2c8,
    misure: { w: 270, d: 210, h: 110 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-olio-aceto', nome: 'Olio e aceto su vassoio di marmo', categoria: 'oggetto', sezione: 'oggetti', moderno: 'olio-aceto', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/olio-aceto.jpg', texture: 'oggetti/moderni/miniature/olio-aceto.jpg', colore: 0xd8d2c8,
    misure: { w: 300, d: 150, h: 340 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-barattoli', nome: 'Barattoli in vetro con coperchio in rovere', categoria: 'oggetto', sezione: 'oggetti', moderno: 'barattoli', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/barattoli.jpg', texture: 'oggetti/moderni/miniature/barattoli.jpg', colore: 0xd8d2c8,
    misure: { w: 336, d: 110, h: 253 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-sgabello', nome: 'Sgabello alto pelle cognac e nero', categoria: 'oggetto', sezione: 'oggetti', moderno: 'sgabello', linea: 'Moderna',
    thumb: 'oggetti/moderni/miniature/sgabello.jpg', texture: 'oggetti/moderni/miniature/sgabello.jpg', colore: 0xd8d2c8,
    misure: { w: 380, d: 380, h: 652 }, info: { note: 'Collezione Moderna NG Interior' } },
  { id: 'cm-lux-alzata', nome: 'Alzata in ottone con frutta mista', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-alzata', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-alzata.jpg', texture: 'oggetti/moderni/miniature/lux-alzata.jpg', colore: 0xd8d2c8,
    misure: { w: 300, d: 300, h: 285 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-vaso-pampas', nome: 'Vaso cannettato bianco con pampas', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-vaso-pampas', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-vaso-pampas.jpg', texture: 'oggetti/moderni/miniature/lux-vaso-pampas.jpg', colore: 0xd8d2c8,
    misure: { w: 530, d: 350, h: 1335 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-vaso-fume', nome: 'Vaso in vetro fumé', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-vaso-fume', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-vaso-fume.jpg', texture: 'oggetti/moderni/miniature/lux-vaso-fume.jpg', colore: 0xd8d2c8,
    misure: { w: 200, d: 200, h: 300 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-candelieri', nome: 'Candelieri in ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-candelieri', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-candelieri.jpg', texture: 'oggetti/moderni/miniature/lux-candelieri.jpg', colore: 0xd8d2c8,
    misure: { w: 274, d: 150, h: 600 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-scultura', nome: 'Scultura travertino, marmo nero e ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-scultura', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-scultura.jpg', texture: 'oggetti/moderni/miniature/lux-scultura.jpg', colore: 0xd8d2c8,
    misure: { w: 270, d: 120, h: 300 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-caraffa', nome: 'Caraffa e bicchieri in cristallo su marmo nero', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-caraffa', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-caraffa.jpg', texture: 'oggetti/moderni/miniature/lux-caraffa.jpg', colore: 0xd8d2c8,
    misure: { w: 324, d: 324, h: 272 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-sgabello', nome: 'Sgabello alto bouclé e ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-sgabello', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-sgabello.jpg', texture: 'oggetti/moderni/miniature/lux-sgabello.jpg', colore: 0xd8d2c8,
    misure: { w: 420, d: 420, h: 650 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-lampada-ottone', nome: 'Lampada a sospensione in ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-lampada-ottone', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-lampada-ottone.jpg', texture: 'oggetti/moderni/miniature/lux-lampada-ottone.jpg', colore: 0xd8d2c8,
    misure: { w: 305, d: 305, h: 2700 }, info: { note: 'Collezione Luxury NG Interior' } },
  { id: 'cm-lux-lampada-globo', nome: 'Lampada a sospensione globo opalino', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'lux-lampada-globo', linea: 'Luxury',
    thumb: 'oggetti/moderni/miniature/lux-lampada-globo.jpg', texture: 'oggetti/moderni/miniature/lux-lampada-globo.jpg', colore: 0xd8d2c8,
    misure: { w: 250, d: 250, h: 2700 }, info: { note: 'Collezione Luxury NG Interior' } },
  // ---- LEGNO E BAMBÙ (modellati da noi) ----
  { id: 'cm-lb-taglieri-muro', nome: 'Taglieri in rovere e bambù al muro', alMuro: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-taglieri-muro', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-taglieri-muro.jpg', texture: 'oggetti/moderni/miniature/lb-taglieri-muro.jpg', colore: 0xd8d2c8,
    misure: { w: 363, d: 171, h: 497 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-vassoio-bambu', nome: 'Vassoio in bambù con olio, sale e pepe', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-vassoio-bambu', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-vassoio-bambu.jpg', texture: 'oggetti/moderni/miniature/lb-vassoio-bambu.jpg', colore: 0xd8d2c8,
    misure: { w: 383, d: 173, h: 302 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-portamestoli', nome: 'Portamestoli con mestoli in ulivo', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-portamestoli', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-portamestoli.jpg', texture: 'oggetti/moderni/miniature/lb-portamestoli.jpg', colore: 0xd8d2c8,
    misure: { w: 167, d: 208, h: 332 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-ciotola-ulivo', nome: 'Ciotola in legno d\'ulivo con limoni', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-ciotola-ulivo', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-ciotola-ulivo.jpg', texture: 'oggetti/moderni/miniature/lb-ciotola-ulivo.jpg', colore: 0xd8d2c8,
    misure: { w: 296, d: 296, h: 172 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-cesto-pane', nome: 'Cesto intrecciato con il pane', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-cesto-pane', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-cesto-pane.jpg', texture: 'oggetti/moderni/miniature/lb-cesto-pane.jpg', colore: 0xd8d2c8,
    misure: { w: 321, d: 308, h: 180 }, info: { note: 'Collezione Legno e bambù NG Interior · pane: «Homemade Bread» — spogna, «Bread» — topfrank2013 · Sketchfab · CC BY 4.0' } },
  { id: 'cm-lb-tagliere-formaggi', nome: 'Tagliere con pane, formaggi e olive', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-tagliere-formaggi', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-tagliere-formaggi.jpg', texture: 'oggetti/moderni/miniature/lb-tagliere-formaggi.jpg', colore: 0xd8d2c8,
    misure: { w: 504, d: 302, h: 119 }, info: { note: 'Collezione Legno e bambù NG Interior · pane: «Homemade Bread» — spogna · Sketchfab · CC BY 4.0' } },
  { id: 'cm-lb-mortaio', nome: 'Mortaio in marmo con basilico', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-mortaio', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-mortaio.jpg', texture: 'oggetti/moderni/miniature/lb-mortaio.jpg', colore: 0xd8d2c8,
    misure: { w: 361, d: 220, h: 233 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-erbe', nome: 'Erbe aromatiche in terracotta su vassoio', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-erbe', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-erbe.jpg', texture: 'oggetti/moderni/miniature/lb-erbe.jpg', colore: 0xd8d2c8,
    misure: { w: 486, d: 205, h: 432 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-ulivo', nome: 'Ulivo in vaso di cemento', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-ulivo', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-ulivo.jpg', texture: 'oggetti/moderni/miniature/lb-ulivo.jpg', colore: 0xd8d2c8,
    misure: { w: 909, d: 1032, h: 1808 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-eucalipto', nome: 'Rami di eucalipto in bottiglia di vetro', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-eucalipto', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-eucalipto.jpg', texture: 'oggetti/moderni/miniature/lb-eucalipto.jpg', colore: 0xd8d2c8,
    misure: { w: 313, d: 333, h: 935 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-lampada-sfera', nome: 'Sospensione in bambù intrecciato, sfera', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-lampada-sfera', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-lampada-sfera.jpg', texture: 'oggetti/moderni/miniature/lb-lampada-sfera.jpg', colore: 0xd8d2c8,
    misure: { w: 437, d: 437, h: 2700 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-lampada-campana', nome: 'Sospensione in bambù intrecciato, campana', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-lampada-campana', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-lampada-campana.jpg', texture: 'oggetti/moderni/miniature/lb-lampada-campana.jpg', colore: 0xd8d2c8,
    misure: { w: 478, d: 478, h: 2700 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-sgabello-corda', nome: 'Sgabello in rovere con seduta in corda', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-sgabello-corda', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-sgabello-corda.jpg', texture: 'oggetti/moderni/miniature/lb-sgabello-corda.jpg', colore: 0xd8d2c8,
    misure: { w: 486, d: 486, h: 663 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-ciotole', nome: 'Pila di ciotole in ceramica', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-ciotole', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-ciotole.jpg', texture: 'oggetti/moderni/miniature/lb-ciotole.jpg', colore: 0xd8d2c8,
    misure: { w: 229, d: 229, h: 104 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-espresso', nome: 'Macchina da espresso in acciaio', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-espresso', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-espresso.jpg', texture: 'oggetti/moderni/miniature/lb-espresso.jpg', colore: 0xd8d2c8,
    misure: { w: 306, d: 561, h: 412 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  { id: 'cm-lb-vini', nome: 'Bottiglie di vino e calici su vassoio', categoria: 'oggetto', sezione: 'oggetti', moderno: 'lb-vini', linea: 'Legno e bambù',
    thumb: 'oggetti/moderni/miniature/lb-vini.jpg', texture: 'oggetti/moderni/miniature/lb-vini.jpg', colore: 0xd8d2c8,
    misure: { w: 444, d: 234, h: 317 }, info: { note: 'Collezione Legno e bambù NG Interior' } },
  // ---- DESIGN (modellati da noi: tavoli scultura, sedie, sgabello, lampade LED, fruttiere) ----
  { id: 'cm-ds-tavolo-farfalla', tavolo: true, nome: 'Tavolo «Farfalla», anelli incrociati e ceramica bianca', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-tavolo-farfalla', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-tavolo-farfalla.jpg', texture: 'oggetti/moderni/miniature/ds-tavolo-farfalla.jpg', colore: 0xd8d2c8,
    misure: { w: 1904, d: 954, h: 750 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-tavolo-infinito', tavolo: true, nome: 'Tavolo «Infinito», nastro in bronzo e piano ovale', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-tavolo-infinito', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-tavolo-infinito.jpg', texture: 'oggetti/moderni/miniature/ds-tavolo-infinito.jpg', colore: 0xd8d2c8,
    misure: { w: 2204, d: 1104, h: 750 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-tavolo-mikado', tavolo: true, nome: 'Tavolo «Mikado», aste dorate e pietra calda', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-tavolo-mikado', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-tavolo-mikado.jpg', texture: 'oggetti/moderni/miniature/ds-tavolo-mikado.jpg', colore: 0xd8d2c8,
    misure: { w: 2004, d: 1004, h: 751 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-tavolo-ics', tavolo: true, nome: 'Tavolo a X nero con piano in rovere', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-tavolo-ics', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-tavolo-ics.jpg', texture: 'oggetti/moderni/miniature/ds-tavolo-ics.jpg', colore: 0xd8d2c8,
    misure: { w: 2206, d: 1006, h: 751 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-tavolo-ricciolo', tavolo: true, nome: 'Tavolo «Ricciolo», lama nera e ceramica nera', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-tavolo-ricciolo', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-tavolo-ricciolo.jpg', texture: 'oggetti/moderni/miniature/ds-tavolo-ricciolo.jpg', colore: 0xd8d2c8,
    misure: { w: 2404, d: 1054, h: 750 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-led-anelli', nome: 'Lampada LED, tre anelli intrecciati', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-led-anelli', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-led-anelli.jpg', texture: 'oggetti/moderni/miniature/ds-led-anelli.jpg', colore: 0xd8d2c8,
    misure: { w: 818, d: 792, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-led-infinito', nome: 'Lampada LED «Infinito»', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-led-infinito', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-led-infinito.jpg', texture: 'oggetti/moderni/miniature/ds-led-infinito.jpg', colore: 0xd8d2c8,
    misure: { w: 1144, d: 420, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-led-linee', nome: 'Lampada LED, linee incrociate', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-led-linee', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-led-linee.jpg', texture: 'oggetti/moderni/miniature/ds-led-linee.jpg', colore: 0xd8d2c8,
    misure: { w: 1084, d: 562, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-led-orbita', nome: 'Lampada LED «Orbita», due anelli', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-led-orbita', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-led-orbita.jpg', texture: 'oggetti/moderni/miniature/ds-led-orbita.jpg', colore: 0xd8d2c8,
    misure: { w: 989, d: 982, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-sgabello-conchiglia', nome: 'Sgabello «Conchiglia» in velluto e ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-sgabello-conchiglia', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-sgabello-conchiglia.jpg', texture: 'oggetti/moderni/miniature/ds-sgabello-conchiglia.jpg', colore: 0xd8d2c8,
    misure: { w: 492, d: 472, h: 852 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-sedia-avvolgente', nome: 'Sedia «Avvolgente» in velluto e ottone', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-sedia-avvolgente', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-sedia-avvolgente.jpg', texture: 'oggetti/moderni/miniature/ds-sedia-avvolgente.jpg', colore: 0xd8d2c8,
    misure: { w: 568, d: 540, h: 794 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-sedia-avvolgente-salvia', nome: 'Sedia «Avvolgente» velluto salvia, gambe nere', categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-sedia-avvolgente-salvia', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-sedia-avvolgente-salvia.jpg', texture: 'oggetti/moderni/miniature/ds-sedia-avvolgente-salvia.jpg', colore: 0xd8d2c8,
    misure: { w: 568, d: 540, h: 794 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-fd-onda', nome: 'Fruttiera a onde in terracotta con frutta mista', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fd-onda', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/fd-onda.jpg', texture: 'oggetti/moderni/miniature/fd-onda.jpg', colore: 0xd8d2c8,
    misure: { w: 348, d: 341, h: 197 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-fd-spirale', nome: 'Fruttiera a spirale crema con agrumi', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fd-spirale', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/fd-spirale.jpg', texture: 'oggetti/moderni/miniature/fd-spirale.jpg', colore: 0xd8d2c8,
    misure: { w: 294, d: 296, h: 175 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-fd-verde', nome: 'Fruttiera bassa nera con frutta verde', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fd-verde', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/fd-verde.jpg', texture: 'oggetti/moderni/miniature/fd-verde.jpg', colore: 0xd8d2c8,
    misure: { w: 384, d: 384, h: 153 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-fd-ottone', nome: 'Cesto in fili d\'ottone con banane e frutta', categoria: 'oggetto', sezione: 'oggetti', moderno: 'fd-ottone', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/fd-ottone.jpg', texture: 'oggetti/moderni/miniature/fd-ottone.jpg', colore: 0xd8d2c8,
    misure: { w: 344, d: 353, h: 198 }, info: { note: 'Collezione Design NG Interior' } },
  // ---- LAMPADE A NASTRO LED (modellate da noi, stile delle foto dell'utente: nastro piatto con il LED su una faccia) ----
  { id: 'cm-ds-lux-nastro-onde-bianco', nome: 'Lampada di lusso «Nastro», onde LED bianche', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-onde-bianco', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-onde-bianco.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-onde-bianco.jpg', colore: 0xd8d2c8,
    misure: { w: 1720, d: 60, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-onde-nero', nome: 'Lampada di lusso «Nastro», onde LED nere', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-onde-nero', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-onde-nero.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-onde-nero.jpg', colore: 0xd8d2c8,
    misure: { w: 1720, d: 60, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-onde-oro', nome: 'Lampada di lusso «Nastro», onde LED champagne', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-onde-oro', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-onde-oro.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-onde-oro.jpg', colore: 0xd8d2c8,
    misure: { w: 1720, d: 60, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-ritorto-nero', nome: 'Lampada di lusso «Nastro ritorto», LED nero', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-ritorto-nero', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-ritorto-nero.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-ritorto-nero.jpg', colore: 0xd8d2c8,
    misure: { w: 1538, d: 187, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-ritorto-oro', nome: 'Lampada di lusso «Nastro ritorto», LED oro', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-ritorto-oro', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-ritorto-oro.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-ritorto-oro.jpg', colore: 0xd8d2c8,
    misure: { w: 1538, d: 187, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-nero', nome: 'Lampada di lusso «Doppia onda» LED, nera, 120 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-nero', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-nero.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-nero.jpg', colore: 0xd8d2c8,
    misure: { w: 1210, d: 140, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-bianco', nome: 'Lampada di lusso «Doppia onda» LED, bianca, 120 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-bianco', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-bianco.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-bianco.jpg', colore: 0xd8d2c8,
    misure: { w: 1210, d: 140, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-oro', nome: 'Lampada di lusso «Doppia onda» LED, oro, 120 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-oro', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-oro.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-oro.jpg', colore: 0xd8d2c8,
    misure: { w: 1210, d: 140, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-160-nero', nome: 'Lampada di lusso «Doppia onda» LED, nera, 160 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-160-nero', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-nero.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-nero.jpg', colore: 0xd8d2c8,
    misure: { w: 1610, d: 180, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-160-bianco', nome: 'Lampada di lusso «Doppia onda» LED, bianca, 160 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-160-bianco', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-bianco.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-bianco.jpg', colore: 0xd8d2c8,
    misure: { w: 1610, d: 180, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-nastro-doppio-160-oro', nome: 'Lampada di lusso «Doppia onda» LED, oro, 160 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-nastro-doppio-160-oro', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-oro.jpg', texture: 'oggetti/moderni/miniature/ds-lux-nastro-doppio-160-oro.jpg', colore: 0xd8d2c8,
    misure: { w: 1610, d: 180, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-sfere-vetro-3', nome: 'Lampada «Sfere di vetro», 3 luci, 67 cm, vetro trasparente', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-sfere-vetro-3', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-3.jpg', texture: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-3.jpg', colore: 0xd8d2c8,
    misure: { w: 670, d: 150, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-sfere-vetro-4', nome: 'Lampada «Sfere di vetro», 4 luci, 86 cm, vetro trasparente e cromato', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-sfere-vetro-4', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-4.jpg', texture: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-4.jpg', colore: 0xd8d2c8,
    misure: { w: 860, d: 150, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-sfere-vetro-5', nome: 'Lampada «Sfere di vetro», 5 luci, 123 cm, vetro trasparente', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-sfere-vetro-5', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-5.jpg', texture: 'oggetti/moderni/miniature/ds-lux-sfere-vetro-5.jpg', colore: 0xd8d2c8,
    misure: { w: 1230, d: 150, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-onda-sfere-oro', nome: 'Lampada di lusso, onda oro con sfere di vetro luminose', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-onda-sfere-oro', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-onda-sfere-oro.jpg', texture: 'oggetti/moderni/miniature/ds-lux-onda-sfere-oro.jpg', colore: 0xd8d2c8,
    misure: { w: 1295, d: 100, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-onda-sfere-nero', nome: 'Lampada di lusso, onda nera con sfere di vetro luminose', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-onda-sfere-nero', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-onda-sfere-nero.jpg', texture: 'oggetti/moderni/miniature/ds-lux-onda-sfere-nero.jpg', colore: 0xd8d2c8,
    misure: { w: 1295, d: 100, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  // ---- LAMPADE DI LUSSO, LUNGHE (modellate da noi: LED incrociati, nero satinato, oro, noce) ----
  { id: 'cm-ds-lux-mikado', nome: 'Lampada di lusso «Mikado», barre LED nere incrociate e oro', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-mikado', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-mikado.jpg', texture: 'oggetti/moderni/miniature/ds-lux-mikado.jpg', colore: 0xd8d2c8,
    misure: { w: 1885, d: 356, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-ovali', nome: 'Lampada di lusso, tre ovali LED dorati intrecciati', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-ovali', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-ovali.jpg', texture: 'oggetti/moderni/miniature/ds-lux-ovali.jpg', colore: 0xd8d2c8,
    misure: { w: 1725, d: 507, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-onda', nome: 'Lampada di lusso «Onda», nastro LED nero e ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-onda', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-onda.jpg', texture: 'oggetti/moderni/miniature/ds-lux-onda.jpg', colore: 0xd8d2c8,
    misure: { w: 1840, d: 212, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-elica', nome: 'Lampada di lusso «Elica», LED oro e nero attorcigliati', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-elica', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-elica.jpg', texture: 'oggetti/moderni/miniature/ds-lux-elica.jpg', colore: 0xd8d2c8,
    misure: { w: 1652, d: 192, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-noce', nome: 'Lampada di lusso, lastra in noce con LED e ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-noce', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-noce.jpg', texture: 'oggetti/moderni/miniature/ds-lux-noce.jpg', colore: 0xd8d2c8,
    misure: { w: 1728, d: 196, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-costellazione', nome: 'Lampada di lusso «Costellazione», gocce di luce e ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-costellazione', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-costellazione.jpg', texture: 'oggetti/moderni/miniature/ds-lux-costellazione.jpg', colore: 0xd8d2c8,
    misure: { w: 1700, d: 169, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-prisma', nome: 'Lampada di lusso «Prisma», linee LED nere e nodi oro', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-prisma', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-prisma.jpg', texture: 'oggetti/moderni/miniature/ds-lux-prisma.jpg', colore: 0xd8d2c8,
    misure: { w: 1636, d: 322, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lux-catena', nome: 'Lampada di lusso «Catena», anelli LED oro e neri', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lux-catena', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lux-catena.jpg', texture: 'oggetti/moderni/miniature/ds-lux-catena.jpg', colore: 0xd8d2c8,
    misure: { w: 1722, d: 442, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  // ---- LAMPADE LUNGHE (modellate da noi: per isole e tavoli lunghi) ----
  { id: 'cm-ds-lin-barra-nera', nome: 'Lampada lunga, barra LED nera 150 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-barra-nera', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-barra-nera.jpg', texture: 'oggetti/moderni/miniature/ds-lin-barra-nera.jpg', colore: 0xd8d2c8,
    misure: { w: 1506, d: 54, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-barra-bianca', nome: 'Lampada lunga, barra LED bianca 180 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-barra-bianca', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-barra-bianca.jpg', texture: 'oggetti/moderni/miniature/ds-lin-barra-bianca.jpg', colore: 0xd8d2c8,
    misure: { w: 1806, d: 54, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-tubo-ottone', nome: 'Lampada lunga, tubo LED in ottone 130 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-tubo-ottone', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-tubo-ottone.jpg', texture: 'oggetti/moderni/miniature/ds-lin-tubo-ottone.jpg', colore: 0xd8d2c8,
    misure: { w: 1340, d: 40, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-coni-neri', nome: 'Lampada lunga, cinque coni neri e ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-coni-neri', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-coni-neri.jpg', texture: 'oggetti/moderni/miniature/ds-lin-coni-neri.jpg', colore: 0xd8d2c8,
    misure: { w: 1604, d: 164, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-globi-ottone', nome: 'Lampada lunga, sei globi opalini su barra in ottone', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-globi-ottone', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-globi-ottone.jpg', texture: 'oggetti/moderni/miniature/ds-lin-globi-ottone.jpg', colore: 0xd8d2c8,
    misure: { w: 1710, d: 150, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-cupole-fume', nome: 'Lampada lunga, quattro cupole in vetro fumé', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-cupole-fume', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-cupole-fume.jpg', texture: 'oggetti/moderni/miniature/ds-lin-cupole-fume.jpg', colore: 0xd8d2c8,
    misure: { w: 1504, d: 264, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-trave-rovere', nome: 'Lampada lunga, trave in rovere con paralumi in vetro', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-trave-rovere', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-trave-rovere.jpg', texture: 'oggetti/moderni/miniature/ds-lin-trave-rovere.jpg', colore: 0xd8d2c8,
    misure: { w: 1600, d: 124, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-ovale-led', nome: 'Lampada lunga, anello LED ovale 150 cm', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-ovale-led', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-ovale-led.jpg', texture: 'oggetti/moderni/miniature/ds-lin-ovale-led.jpg', colore: 0xd8d2c8,
    misure: { w: 1527, d: 536, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-dischi', nome: 'Lampada lunga, tre dischi LED neri', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-dischi', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-dischi.jpg', texture: 'oggetti/moderni/miniature/ds-lin-dischi.jpg', colore: 0xd8d2c8,
    misure: { w: 1680, d: 380, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  { id: 'cm-ds-lin-cascata', nome: 'Lampada lunga, cascata di sfere in vetro', appeso: true, categoria: 'oggetto', sezione: 'oggetti', moderno: 'ds-lin-cascata', linea: 'Design',
    thumb: 'oggetti/moderni/miniature/ds-lin-cascata.jpg', texture: 'oggetti/moderni/miniature/ds-lin-cascata.jpg', colore: 0xd8d2c8,
    misure: { w: 1634, d: 282, h: 2700 }, info: { note: 'Collezione Design NG Interior' } },
  // ---- LIBRERIA 3D: prodotti veri (Amazon Berkeley Objects, CC BY 4.0) ----
  ...LIBRERIA.map(voceLibreria),
  // ---- Zoccoli (cucina) ----
  { id: 'nero-opaco', nome: 'Nero opaco', categoria: 'zoccolo', css: '#17171a', colore: 0x17171a,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'bianco-opaco', nome: 'Bianco opaco', categoria: 'zoccolo', css: '#eceae4', colore: 0xeceae4,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'acciaio', nome: 'Acciaio', categoria: 'zoccolo', css: 'linear-gradient(135deg,#d6dadf,#9aa0a6 55%,#c2c7cc)',
    colore: 0xc6cace, solido: true, roughness: 0.3, metalness: 0.92, envMapIntensity: 1.0 },
  // ---- Maniglie ----
  { id: 'maniglia-standard', nome: 'Maniglia standard (barra)', categoria: 'maniglia', css: 'linear-gradient(135deg,#e2e3e6,#a9acb1)',
    colore: 0xcfcfcf, solido: true, roughness: 0.35, metalness: 0.6 },
  // PROFILO SUL BORDO (nero): si vede solo il labbro arrotondato davanti, la parte a L va dietro
  // la porta; con questa maniglia le ante sono 2 mm più basse (70 → 69,8 → 69,6)
  { id: 'maniglia-bordo-l-nera', nome: 'Maniglia profilo sul bordo, nera (L dietro la porta)', categoria: 'maniglia',
    thumb: 'materials/maniglia-bordo-l-nera.jpg', texture: 'materials/maniglia-bordo-l-nera.jpg',
    forma: 'bordol', formaV: 1, finitura: 'nero', colore: 0x1c1c1e, lunghezzaMm: 200, spessoreJ: 2 },
  // ---- Binari degli armadi scorrevoli (grigio = quello di sempre) ----
  { id: 'binario-grigio', nome: 'Grigio', categoria: 'binario', css: 'linear-gradient(135deg,#7a7a7a,#4f4f4f)',
    colore: 0x5f5f5f, solido: true, roughness: 0.55, metalness: 0.4 },
  { id: 'binario-bianco', nome: 'Bianco', categoria: 'binario', css: 'linear-gradient(135deg,#f4f3ef,#d9d7d1)',
    colore: 0xeceae4, solido: true, roughness: 0.5, metalness: 0.1 },
  { id: 'binario-nero', nome: 'Nero', categoria: 'binario', css: 'linear-gradient(135deg,#2a2a2d,#111113)',
    colore: 0x1b1b1d, solido: true, roughness: 0.5, metalness: 0.3 },
];
export const BINARIO_DEFAULT = 'binario-grigio';

// ---------------------------------------------------------------------------
// CATALOGO della carpinteria (js/catalogo.js): prodotti aggiunti con foto,
// prodotti nascosti per sezione, modifiche ai predefiniti.
// ---------------------------------------------------------------------------
let statoCatalogo = { prodotti: [], nascosti: {}, modifiche: {} };
const CAT_DA_SEZIONE = { legno: 'legno', fingerpull: 'legno', encimera: 'encimera', pannello: 'legno', zoccolo: 'zoccolo', maniglie: 'maniglia', oggetti: 'oggetto', binari: 'binario' };
/** Pavimento del cliente (catalogo) → voce dei pavimenti: la foto copre campioneCm (larghezza × altezza). */
export function defPavimentoProprio(p, url, thumb) {
  const w = Math.max(5, Number(p.campioneCm && p.campioneCm.w) || 60), h = Math.max(5, Number(p.campioneCm && p.campioneCm.h) || w);
  return { id: p.id, nome: p.nome || 'Pavimento del cliente', gruppo: GRUPPO_PROPRI, tipo: 'propria', url, thumb,
    mm: w * 10, mmY: h * 10, rough: 0.5, env: 0.45, proprio: true };
}
async function applicaCatalogo() {
  statoCatalogo = await leggiCatalogo();
  // prodotti salvati con un trattamento della foto più vecchio: la texture si
  // rifà da sola dalla foto originale (una volta sola), con i colori veri
  const daRifare = statoCatalogo.prodotti.filter((p) => (p.sezione === 'legno' || p.sezione === 'fingerpull') && (p.versioneFoto || 1) < 2);
  if (daRifare.length) {
    try {
      const { aggiornaFotoProdotto } = await import('./analisi-foto.js?v=20261124n');
      for (const p of daRifare) { try { await aggiornaFotoProdotto(p, leggiFoto, salvaFoto); } catch (e) { console.warn('Foto del prodotto non aggiornata', p.id, e); p.versioneFoto = 2; } }
      await salvaCatalogo(statoCatalogo);
    } catch (e) { console.warn('Aggiornamento foto catalogo non riuscito', e); }
  }
  // modifiche ai predefiniti (nome, tipo, spessore, colore…)
  for (const m of MATERIALI) {
    const mod = statoCatalogo.modifiche[m.id];
    if (mod) Object.assign(m, { info: { ...(m.info || {}), ...mod.info }, ...(mod.nome ? { nome: mod.nome } : {}) });
  }
  for (const p of statoCatalogo.prodotti) {
    const [foto, thumb, gola] = await Promise.all([leggiFoto(p.id, 'foto'), leggiFoto(p.id, 'thumb'),
      p.sezione === 'fingerpull' ? leggiFoto(p.id, 'gola') : null]);
    if (!foto) continue;
    const url = URL.createObjectURL(foto);
    // PAVIMENTO del cliente: va fra i pavimenti (non fra i colori delle ante)
    if (p.sezione === 'pavimento') {
      aggiungiPavimentoProprio(defPavimentoProprio(p, url, thumb ? URL.createObjectURL(thumb) : url));
      continue;
    }
    const def = {
      id: p.id, nome: p.nome || 'Senza nome', categoria: CAT_DA_SEZIONE[p.sezione] || 'legno', sezione: p.sezione,
      thumb: thumb ? URL.createObjectURL(thumb) : url, texture: url, colore: p.colore ?? 0x999999,
      spessore: p.info?.spessore ? Number(p.info.spessore) : undefined,
      info: p.info || {}, proprio: true,
    };
    if (p.campioneCm && Number(p.campioneCm.w) > 0 && Number(p.campioneCm.h) > 0) {
      def.campione = { wMm: Number(p.campioneCm.w) * 10, hMm: Number(p.campioneCm.h) * 10 };
    }
    // Finger-pull da foto: la gola (maniglia sopra) ha la sua immagine
    if (gola) def.gola = { texture: URL.createObjectURL(gola), colore: p.coloreGola ?? 0x111111 };
    // gola in TINTA UNITA (RAL scelto, o porta tutta uguale in tinta): colore pieno, nessuna foto
    if (def.gola && (p.golaTinta || (p.uguale && p.tinta))) {
      def.gola = { colore: p.golaTinta ? p.golaTinta.colore : p.tinta.colore, solido: true, ral: p.golaTinta ? p.golaTinta.ral : p.tinta.ral };
    }
    // TINTA UNITA (RAL): colore pieno, niente foto ripetuta; lucido o opaco
    if (p.tinta && p.tinta.colore != null) {
      Object.assign(def, { solido: true, colore: p.tinta.colore, ral: p.tinta.ral, lucido: !!p.tinta.lucido,
        roughness: p.tinta.lucido ? 0.08 : 0.9, metalness: 0, envMapIntensity: p.tinta.lucido ? undefined : 0.35 });
      delete def.campione;
    } else if (p.lucido != null) def.lucido = !!p.lucido;
    // Maniglia da foto: misura reale (lato lungo) e proporzioni dalla foto
    if (p.sezione === 'maniglie' && p.maniglia) {
      def.lunghezzaMm = (Number(p.maniglia.lunghezzaCm) || 15) * 10;
      def.altezzaMm = Math.max(6, def.lunghezzaMm * (Number(p.maniglia.rapporto) || 0.08));
      def.verticale = !!p.maniglia.verticale;
      def.forma = p.maniglia.forma || 'foto';
      def.formaV = p.maniglia.formaV || 0;                            // 0 = salvata prima della scelta "La mia forma"
      def.finitura = p.maniglia.finitura || null;                    // null = dal colore della foto
      if (p.maniglia.viste) {                                        // lato / sopra (facoltative)
        def.viste = p.maniglia.viste;
        const [fs, fl] = await Promise.all([leggiFoto(p.id, 'sopra'), leggiFoto(p.id, 'lato')]);
        if (fs) def.vistaSopra = URL.createObjectURL(fs);
        if (fl) def.vistaLato = URL.createObjectURL(fl);
      }
    }
    // OGGETTO 3D PRONTO (libreria Poly Haven, CC0): il modello vero, alle misure scelte
    if (p.sezione === 'oggetti' && p.pronto) {
      const o = p.pronto;
      def.pronto = { fonte: o.fonte || 'polyhaven', id: o.id };
      def.misure = { w: (Number(o.w) || 30) * 10, d: (Number(o.d) || 30) * 10, h: (Number(o.h) || 30) * 10 };
    }
    // OGGETTO / ELETTRODOMESTICO da foto: misure reali e le viste isolate per il 3D
    if (p.sezione === 'oggetti' && p.oggetto) {
      const o = p.oggetto;
      def.misure = { w: (Number(o.w) || 30) * 10, d: (Number(o.d) || 30) * 10, h: (Number(o.h) || 30) * 10 };
      def.pianta = o.pianta || 'auto';
      def.tipi = o.tipi || {};                                       // foto dritte / di tre quarti scelte a mano
      const [fl, fs, fd] = await Promise.all(['lato', 'sopra', 'dietro'].map((t) => (o.viste && o.viste[t] ? leggiFoto(p.id, t) : null)));
      def.viste = { fronte: url, lato: fl ? URL.createObjectURL(fl) : null, sopra: fs ? URL.createObjectURL(fs) : null, dietro: fd ? URL.createObjectURL(fd) : null };
    }
    MATERIALI.push(def);
    // Finger-pull → lo STESSO materiale (stessa foto, stessa misura) senza la
    // gola compare da solo fra i legni: il produttore dà lo stesso colore per
    // ante finger-pull e pannelli. Es. "Noce con maniglia nera" → "Noce".
    if (p.sezione === 'fingerpull') {
      const { gola: _g, ...base } = def;
      // anteprima SENZA la gola: la foto della sola porta (in tinta unita è già il colore pieno)
      MATERIALI.push({ ...base, thumb: def.texture, id: `${p.id}~legno`, nome: nomeSenzaGola(def.nome), categoria: 'legno', sezione: 'legno', derivato: p.id });
    }
  }
}
/** Nome del materiale senza la parte della maniglia/gola. */
export function nomeSenzaGola(nome) {
  const n = String(nome || '').replace(/[\s,·\-–+]*(\b(con|with|y|e|sin|senza)\b\s*)?(la\s+|el\s+)?\b(maniglia|gola|finger[\s-]?pull|fingerpull|tirador|u[ñn]ero|jaladera)\b.*$/i, '').trim();
  return n || String(nome || '').trim();
}
try { await applicaCatalogo(); } catch (e) { console.warn('Catalogo non caricato', e); }
if (typeof window !== 'undefined') { window.NG_MATERIALI = MATERIALI; installaSchedaProdotto(); }

/**
 * SCHEDA PRODOTTO: toccando un quadratino di materiale compare per qualche
 * secondo nome, tipo di materiale, spessore e colore (dati del catalogo).
 */
function installaSchedaProdotto() {
  if (window.__ngSchedaProdotto) return;
  window.__ngSchedaProdotto = true;
  const SEL = '[data-mat],[data-enc],[data-sch-mat],[data-zocc],[data-man]';
  let box = null, timer = null;
  const chiudi = () => { if (box) { box.remove(); box = null; } clearTimeout(timer); };
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(SEL);
    if (!b) { chiudi(); return; }
    const id = b.dataset.mat ?? b.dataset.enc ?? b.dataset.schMat ?? b.dataset.zocc ?? b.dataset.man;
    const m = id ? MATERIALI.find((x) => x.id === id) : null;
    chiudi();
    if (!m) return;
    const r = b.getBoundingClientRect();
    const info = m.info || {};
    const righe = [
      info.tipo ? ['Materiale', info.tipo] : null,
      (info.spessore || m.spessore) ? ['Spessore', `${info.spessore || m.spessore} mm`] : null,
      info.colore ? ['Colore', info.colore] : null,
      m.campione ? ['Campione', `${Math.round(m.campione.wMm / 10)} × ${Math.round(m.campione.hMm / 10)} cm`] : null,
      m.lunghezzaMm ? ['Lunghezza', `${Math.round(m.lunghezzaMm / 10)} cm`] : null,
      info.note ? ['Note', info.note] : null,
    ].filter(Boolean);
    box = document.createElement('div');
    box.className = 'ng-scheda-prodotto';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;z-index:9999;max-width:260px;background:var(--bg-2,#121212);color:var(--testo,#eee);border:1px solid var(--oro,#c9a94a);border-radius:6px;padding:9px 11px;font:13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);pointer-events:none';
    box.innerHTML = `<div style="font-weight:600;color:var(--oro-chiaro,#e8c25a);margin-bottom:${righe.length ? 4 : 0}px">${esc(m.nome)}</div>`
      + righe.map(([k, v]) => `<div><span style="color:var(--testo-dim,#aaa)">${esc(k)}:</span> ${esc(v)}</div>`).join('');
    document.body.appendChild(box);
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let x = Math.min(window.innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2));
    let y = r.top - bh - 8; if (y < 8) y = r.bottom + 8;
    box.style.left = `${x}px`; box.style.top = `${y}px`;
    timer = setTimeout(chiudi, 4000);
  }, true);
}

// TENDINE DEI COLORI (sottocategorie Legni, Mate, Luxe, Finger-pull, Encimere): vedi tendine-colori.js
export { GRUPPI_COLORI, gruppoColore, htmlTendineColori } from './tendine-colori.js?v=20261124n';

// Collezione Moderna / Luxury: in che gruppo della lista «Aggiungi oggetti» e come si posa
const GRUPPO_COLLEZIONE = { sgabello: 'sgabelli', 'lux-sgabello': 'sgabelli', 'lux-lampada-ottone': 'luci', 'lux-lampada-globo': 'luci',
  'lb-lampada-sfera': 'luci', 'lb-lampada-campana': 'luci', 'lb-sgabello-corda': 'sgabelli', 'lb-ulivo': 'piante', 'lb-erbe': 'piante', 'lb-eucalipto': 'piante',
  'vaso-scultura': 'decor', 'vaso-ulivo': 'piante', 'lux-vaso-pampas': 'piante', 'lux-vaso-fume': 'decor', 'lux-candelieri': 'decor', 'lux-scultura': 'decor',
  'ds-tavolo-farfalla': 'pranzo', 'ds-tavolo-infinito': 'pranzo', 'ds-tavolo-mikado': 'pranzo', 'ds-tavolo-ics': 'pranzo', 'ds-tavolo-ricciolo': 'pranzo',
  'ds-sedia-avvolgente': 'pranzo', 'ds-sedia-avvolgente-salvia': 'pranzo', 'ds-sgabello-conchiglia': 'sgabelli',
  'ds-led-anelli': 'luci', 'ds-led-infinito': 'luci', 'ds-led-linee': 'luci', 'ds-led-orbita': 'luci',
  'ds-lin-barra-nera': 'luci', 'ds-lin-barra-bianca': 'luci', 'ds-lin-tubo-ottone': 'luci', 'ds-lin-coni-neri': 'luci', 'ds-lin-globi-ottone': 'luci', 'ds-lin-cupole-fume': 'luci', 'ds-lin-trave-rovere': 'luci', 'ds-lin-ovale-led': 'luci', 'ds-lin-dischi': 'luci', 'ds-lin-cascata': 'luci',
  'ds-lux-mikado': 'luci', 'ds-lux-ovali': 'luci', 'ds-lux-onda': 'luci', 'ds-lux-elica': 'luci', 'ds-lux-noce': 'luci', 'ds-lux-costellazione': 'luci', 'ds-lux-prisma': 'luci', 'ds-lux-catena': 'luci',
  'ds-lux-nastro-onde-bianco': 'luci', 'ds-lux-nastro-onde-nero': 'luci', 'ds-lux-nastro-onde-oro': 'luci', 'ds-lux-nastro-ritorto-nero': 'luci', 'ds-lux-nastro-ritorto-oro': 'luci', 'ds-lux-onda-sfere-oro': 'luci', 'ds-lux-onda-sfere-nero': 'luci',
  'ds-lux-nastro-doppio-nero': 'luci', 'ds-lux-nastro-doppio-bianco': 'luci', 'ds-lux-nastro-doppio-oro': 'luci',
  'ds-lux-nastro-doppio-160-nero': 'luci', 'ds-lux-nastro-doppio-160-bianco': 'luci', 'ds-lux-nastro-doppio-160-oro': 'luci',
  'ds-lux-sfere-vetro-3': 'luci', 'ds-lux-sfere-vetro-4': 'luci', 'ds-lux-sfere-vetro-5': 'luci' };
for (const m of MATERIALI) {
  if (!m.moderno) continue;
  m.gruppo = GRUPPO_COLLEZIONE[m.moderno] || 'cucina';
  // a TERRA: sgabelli, tavoli e sedie, l'ulivo grande; appese le lampade; il resto sul piano
  m.posa = m.appeso ? 'appeso' : m.gruppo === 'sgabelli' || m.gruppo === 'pranzo' || m.moderno === 'lb-ulivo' ? 'terra' : 'piano';
}
/** Gruppo di un oggetto nella lista «Aggiungi oggetti» (quelli aggiunti dall'utente: «I miei oggetti»). */
export function gruppoOggetto(o) { return (o && o.gruppo) || (o && (o.proprio || o.pronto) ? 'miei' : 'cucina'); }
/** Come si posa un oggetto: 'piano' (sul piano di lavoro o a terra), 'terra', 'appeso' (dal soffitto), 'parete'. */
export function posaOggetto(o) { return (o && o.posa) || (o && o.appeso ? 'appeso' : 'piano'); }

/** Prodotti visibili in una sezione del catalogo (con i nascosti tolti). */
export function materialiPer(sezione, { tutti = false } = {}) {
  const vis = (m) => tutti || !nascosto(statoCatalogo, sezione, m.id);
  const legni = MATERIALI.filter((m) => (m.categoria === 'legno' || m.categoria === 'tinta') && (!m.proprio || m.sezione === 'legno'));
  const propri = (sez) => MATERIALI.filter((m) => m.proprio && m.sezione === sez);
  let l;
  switch (sezione) {
    case 'legno': l = legni; break;
    // finger-pull: i legni normali + le porte finger-pull; il materiale creato in automatico
    // (porta senza gola) sta SOLO fra i materiali (Legni e colori)
    case 'fingerpull': l = [...legni.filter((m) => !m.derivato), ...propri('fingerpull')]; break;
    case 'encimera': l = MATERIALI.filter((m) => m.categoria === 'encimera'); break;
    case 'pannello': l = [...legni, ...MATERIALI.filter((m) => m.categoria === 'encimera'), ...propri('pannello')]; break;
    case 'zoccolo': l = MATERIALI.filter((m) => m.categoria === 'zoccolo'); break;
    case 'oggetti': l = [...MATERIALI.filter((m) => m.categoria === 'oggetto' && !m.proprio), ...propri('oggetti')]; break;
    case 'maniglie': l = MATERIALI.filter((m) => m.categoria === 'maniglia'); break;
    case 'binari': l = MATERIALI.filter((m) => m.categoria === 'binario'); break;
    default: l = [];
  }
  // gli oggetti ritirati non si aggiungono più (restano solo nei progetti già fatti)
  return l.filter((m) => !m.ritirato && vis(m));
}
/** Sfondo CSS del quadratino (foto o colore). */
export function sfondoSwatch(m) { return m.thumb ? `url('${m.thumb}') center/cover` : (m.css || `#${(m.colore || 0).toString(16).padStart(6, '0')}`); }

// Unità delle UV del motore 3D della pagina (mm per 1 unità di UV): serve a
// mettere in SCALA VERA la foto dei prodotti propri (misura del campione).
let unitaUV = { u: 300, v: 300 };
export function impostaUnitaUV(u, v = u) { unitaUV = { u, v }; }

// COLORE IDENTICO ALLA FOTO. I prodotti del catalogo hanno un loro modo di
// prendere la luce: la luce cambia solo QUANTO è chiaro il pannello (così si
// vede il 3D: fianchi, ombre), mai la TINTA (le luci della scena sono un po'
// calde da un lato e fredde dall'altro) e niente "tone mapping" che sbiadisce.
// Un pannello illuminato come la media delle facce verticali (anta vista di
// fronte) ha esattamente i colori della foto. La luce di riferimento si misura
// da sola in ogni scena (taraLuceCatalogo): nessuna regolazione a mano.
const LUCE_FOTO = { value: 0.7 };   // luce di riferimento sui pannelli verticali (misurata)
const LUCE_PIANO = { value: 1.0 };  // luce di riferimento sui piani orizzontali (top)
const CONTRASTO_FOTO = 0.6;         // quanto la luce scurisce/schiarisce (0 = piatto)
const PARAM_FOTO = { roughness: 0.85, metalness: 0.0, envMapIntensity: 0.25 };
// TINTA DEI LED (sotto i pensili) sulle foto: neutro = (1,1,1) cioè la foto com'è; caldo e
// freddo la tingono appena, solo dove la luce dei LED si aggiunge a quella della stanza
const TINTA_LED = { value: new THREE.Vector3(1, 1, 1) };
/** Colore dei LED della scena (hex), o null se spenti/neutri: aggiorna la tinta delle foto. */
export function impostaTintaLed(hex, neutro = 0xfff6ec) {
  if (hex == null) { TINTA_LED.value.set(1, 1, 1); return; }
  const c = new THREE.Color(hex), n = new THREE.Color(neutro);
  // diviso per il canale più forte: la tinta toglie un po' degli altri colori, non ne aggiunge
  // (aggiungere "brucia" il chiaro verso il giallo limone sul caldo)
  const r = c.r / n.r, g = c.g / n.g, b = c.b / n.b, k = Math.max(r, g, b);
  TINTA_LED.value.set(r / k, g / k, b / k);
}
function coloreFoto(m, rif = LUCE_FOTO) {
  m.color.set(0xffffff);
  m.toneMapped = false;
  m.userData.ngRif = rif;
  if (!m.userData.ngFoto) {
    m.userData.ngFoto = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.ngLuceRif = m.userData.ngRif;
      sh.uniforms.ngSpec = { value: m.userData.ngSpec || 0 };   // lucido: riflessi sommati
      sh.uniforms.ngTintaLed = TINTA_LED;
      sh.fragmentShader = 'uniform float ngLuceRif;\nuniform float ngSpec;\nuniform vec3 ngTintaLed;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
        vec3 wl = vec3(0.2126, 0.7152, 0.0722);
        float f = dot(totalDiffuse, wl) / max(dot(diffuseColor.rgb, wl), 1e-4) / ngLuceRif;
        // LUCE IN PIÙ (es. LED sotto i pensili): dove arriva, tinge la foto del SUO colore
        // (caldo/neutro/freddo). La luce normale della stanza non cambia la tinta della foto.
        vec3 tinta = mix(vec3(1.0), ngTintaLed, 0.6 * clamp((f - 1.0) * 1.5, 0.0, 1.0));   // 0.6: colore vero ma morbido (caldo ≠ arancione)
        // luce in più (es. LED): schiarisce ma non "brucia" la foto
        if (f > 1.0) f = 1.0 + 0.45 * (1.0 - exp(-(f - 1.0) * 1.6));
        outgoingLight = diffuseColor.rgb * mix(1.0, f, ${CONTRASTO_FOTO.toFixed(2)}) * tinta + totalEmissiveRadiance + totalSpecular * ngSpec;
      }
      #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'ng-foto3' + (m.userData.ngSpec ? '-l' : '');
  }
  m.needsUpdate = true;
}

/**
 * Piano di lavoro (o altra lastra orizzontale) con i colori ESATTI della sua
 * foto: stesse tinte, stesse sfumature, venature visibili (la luce della
 * scena non la "brucia" più). Usa la luce di riferimento dei piani.
 */
export function pianoComeFoto(m) {
  if (!m || !m.map) return m;
  Object.assign(m, PARAM_FOTO);
  coloreFoto(m, LUCE_PIANO);
  return m;
}

/**
 * Pannello VERTICALE (es. pannello dietro il piano) con i colori esatti
 * della sua foto: usa la luce di riferimento delle pareti, non quella dei piani.
 */
export function pannelloComeFoto(m) {
  if (!m || !m.map) return m;
  Object.assign(m, PARAM_FOTO);
  coloreFoto(m, LUCE_FOTO);
  return m;
}

/**
 * Taratura AUTOMATICA della luce di riferimento (per ogni scena): misura la
 * luce che arriva su un pannello bianco opaco (stesse luci, stesso ambiente)
 * rivolto dove guardano le ante (armadi e modulari di fronte, +z; cucina in
 * media sulle 4 pareti) e, per i piani, rivolto in alto. Da chiamare dopo le luci.
 */
export function taraLuceCatalogo(renderer, scene, direzioni = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]]) {
  let rt = null, piano = null;
  const rif = LUCE_FOTO.value, rifP = LUCE_PIANO.value;
  try {
    rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.FloatType });
    // pannello bianco con lo STESSO shader dei prodotti: con riferimento 1
    // restituisce 1 - c + c·L → ricavo la luce L
    const uno = { value: 1 };
    const mb = new THREE.MeshStandardMaterial({ color: 0xffffff, ...PARAM_FOTO });
    coloreFoto(mb, uno);
    piano = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mb);
    scene.add(piano);
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 1000);
    const prima = renderer.getRenderTarget();
    const buf = new Float32Array(4);
    const misura = (dirs) => {
      let somma = 0, n = 0;
      for (const d of dirs) {
        const v = new THREE.Vector3(...d);
        piano.position.set(0, 200000, 0);
        if (Math.abs(v.y) > 0.9) piano.up.set(0, 0, -1); else piano.up.set(0, 1, 0);
        piano.lookAt(piano.position.clone().add(v));
        cam.up.copy(piano.up);
        cam.position.copy(piano.position).addScaledVector(v, 100); cam.lookAt(piano.position);
        renderer.setRenderTarget(rt); renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 1, 1, 1, 1, buf);
        const l = (0.2126 * buf[0] + 0.7152 * buf[1] + 0.0722 * buf[2] - (1 - CONTRASTO_FOTO)) / CONTRASTO_FOTO;
        if (Number.isFinite(l) && l > 0.02 && l < 50) { somma += l; n++; }
      }
      return n ? somma / n : null;
    };
    const lv = misura(direzioni), lp = misura([[0, 1, 0]]);
    renderer.setRenderTarget(prima);
    if (lv) LUCE_FOTO.value = lv;
    if (lp) LUCE_PIANO.value = lp;
    return lv;
  } catch (e) {
    console.warn('Taratura luce non riuscita', e);
    LUCE_FOTO.value = rif; LUCE_PIANO.value = rifP;
    return null;
  } finally {
    if (piano) { scene.remove(piano); piano.geometry.dispose(); piano.material.dispose(); }
    if (rt) rt.dispose();
  }
}

/**
 * Prodotti del catalogo con la misura del campione: le UV dei pezzi diventano
 * in mm/unità (le stesse di impostaUnitaUV) invece di 0..1 per faccia, così la
 * foto è alla sua misura reale e la venatura non viene stirata.
 * La foto è CENTRATA su ogni pannello: il centro della foto (es. la porta
 * intera fotografata) cade al centro dell'anta, quindi un'anta grande come
 * la porta della foto è identica alla foto; solo se l'anta è più grande la
 * foto continua a specchio verso i bordi.
 * Si chiama sul gruppo della scena dopo averla costruita.
 */
export function uvInScala(radice) {
  radice.updateMatrixWorld(true);
  const pw = new THREE.Vector3();
  // PIANI DI LAVORO: una lastra sola per tutta la cucina, in coordinate della stanza. I pezzi
  // accanto (es. le due file dell'isola, schiena contro schiena) sono la STESSA lastra che
  // continua, non la stessa foto ripetuta a specchio. Centro = centro di tutti i piani.
  const bbPiani = new THREE.Box3(), bbTmp = new THREE.Box3();
  radice.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && m.userData && m.userData.fotoTop && m.userData.campioneMm)) bbPiani.union(bbTmp.setFromObject(o));
  });
  const centroPiani = bbPiani.isEmpty() ? new THREE.Vector3() : bbPiani.getCenter(new THREE.Vector3());
  const P = new THREE.Vector3(), N = new THREE.Vector3(), nm = new THREE.Matrix3();
  radice.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mc = mats.find((m) => m && m.userData && m.userData.campioneMm);
    if (!mc) return;
    const geo = o.geometry;
    if (!geo || geo.userData.uvMm || !geo.attributes.uv || !geo.attributes.normal) return;
    const { wMm, hMm } = mc.userData.campioneMm;
    if (mc.userData.fotoTop) {
      // direzione del pezzo (lungo la fila); girato di 180° = stessa direzione → stessa lastra
      const e = o.matrixWorld.elements;
      let a = Math.atan2(e[2], e[0]);
      if (a < -1e-6) a += Math.PI;
      if (a >= Math.PI - 1e-6) a -= Math.PI;
      const ax = Math.cos(a), az = Math.sin(a);          // lungo la fila (piano XZ)
      const gira = !!mc.userData.ruota;
      nm.getNormalMatrix(o.matrixWorld);
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        P.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(centroPiani);
        N.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        const lungo = P.x * ax + P.z * az, trav = -P.x * az + P.z * ax;
        const nL = Math.abs(N.x * ax + N.z * az), nT = Math.abs(-N.x * az + N.z * ax), nY = Math.abs(N.y);
        let u, v;
        if (nY >= nL && nY >= nT) { u = lungo; v = trav; }          // sopra / sotto
        else if (nL >= nT) { u = trav; v = P.y; }                  // testate
        else { u = lungo; v = P.y; }                               // bordo davanti / dietro
        // tavola in piedi (foto verticale): il suo lato LUNGO corre lungo il piano, senza girare la foto
        if (gira) uv.setXY(i, (v + wMm / 2) / unitaUV.u, (u + hMm / 2) / unitaUV.v);
        else uv.setXY(i, (u + wMm / 2) / unitaUV.u, (v + hMm / 2) / unitaUV.v);
      }
      uv.needsUpdate = true;
      geo.userData.uvMm = true;
      return;
    }
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox, c = { x: (bb.min.x + bb.max.x) / 2, y: (bb.min.y + bb.max.y) / 2, z: (bb.min.z + bb.max.z) / 2 };
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    // punto del legno di questo pannello: fisso per la sua posizione (non cambia
    // a ogni ridisegno), diverso da un pannello all'altro
    o.getWorldPosition(pw);
    const caso = (sx, sy) => { const t = Math.sin(Math.round(pw.x / 10) * sx + Math.round(pw.y / 10) * 0.37 + Math.round(pw.z / 10) * sy) * 43758.5453; return t - Math.floor(t); };
    const ox = mc.userData.continuo ? caso(12.9898, 78.233) * 4000 : 0, oy = mc.userData.continuo ? caso(39.346, 11.135) * 4000 : 0;
    // TAVOLA INTERA: il pezzo (anta, fianco, ripiano…) è TAGLIATO dalla tavola come in falegnameria:
    // un punto diverso per ogni pezzo, ma sempre tutto DENTRO la tavola (niente giunte a specchio
    // in mezzo a un'anta); solo un pezzo più grande della tavola continua a specchio ai bordi
    const tav = !!mc.userData.tavola;
    const ex = bb.max.x - bb.min.x, ey = bb.max.y - bb.min.y, ez = bb.max.z - bb.min.z;
    const r1 = tav ? caso(12.9898, 78.233) : 0.5, r2 = tav ? caso(39.346, 11.135) : 0.5;
    const taglio = (eU, eV) => tav ? [(r1 - 0.5) * Math.max(0, wMm - eU), (r2 - 0.5) * Math.max(0, hMm - eV)] : [ox, oy];
    const tX = taglio(ez, ey), tY = taglio(ex, ez), tZ = taglio(ex, ey);   // facce girate verso x, y, z
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      let u, v, t;
      if (ax >= ay && ax >= az) { u = pos.getZ(i) - c.z; v = pos.getY(i) - c.y; t = tX; }
      else if (ay >= az) { u = pos.getX(i) - c.x; v = pos.getZ(i) - c.z; t = tY; }
      else { u = pos.getX(i) - c.x; v = pos.getY(i) - c.y; t = tZ; }
      uv.setXY(i, (u + wMm / 2 + t[0]) / unitaUV.u, (v + hMm / 2 + t[1]) / unitaUV.v);
    }
    uv.needsUpdate = true;
    geo.userData.uvMm = true;
  });
}

/**
 * UV IN SCALA VERA con un'ORIGINE COMUNE a più pezzi (es. piano e fianchi a cascata di un bancone):
 * le coordinate sono quelle dei vertici (già messi al loro posto), così la venatura del fianco
 * continua quella della testa del piano, senza salti né righe. Dopo, uvInScala non le tocca più.
 */
export function uvContinue(geo, mat) {
  const cm = mat && mat.userData && mat.userData.campioneMm;
  if (!geo || !cm || !geo.attributes.uv || !geo.attributes.normal) return false;
  const { wMm, hMm } = cm;
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = pos.getZ(i); v = pos.getY(i); }
    else if (ay >= az) { u = pos.getX(i); v = pos.getZ(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv.setXY(i, (u + wMm / 2) / unitaUV.u, (v + hMm / 2) / unitaUV.v);
  }
  uv.needsUpdate = true;
  geo.userData.uvMm = true;
  return true;
}

// PARTI selezionabili nel pannello materiali.
// `applica` elenca le chiavi che vengono aggiornate insieme quando l'utente
// sceglie un materiale per quella "parte logica". Es. selezionando il legno
// per la Struttura, carcassa e schiena cambiano insieme (sono sempre uguali).
export const PARTI = [
  { id: 'struttura', nome: 'Struttura (carcassa + schiena + ripiani)',
    applica: ['carcassa', 'schiena'] },
  { id: 'ante', nome: 'Ante', applica: ['ante'] },
  { id: 'tamponamenti', nome: 'Tamponamenti', applica: ['tamponamenti'] },
  { id: 'costadi', nome: 'Costadi', applica: ['costadi'] },
  { id: 'cassStruttura', nome: 'Cassettiera · Struttura (scatola + fascette)',
    applica: ['cassStruttura'] },
  { id: 'cassFronti', nome: 'Cassettiera · Fronti cassetto',
    applica: ['cassFronti'] },
];

export function trovaMateriale(id) {
  return MATERIALI.find((m) => m.id === id) || MATERIALI[0];
}

// ---------- Cache + materiali three.js ----------
const loader = new THREE.TextureLoader();
const cacheTex = new Map();     // id → THREE.Texture
const cacheMat = new Map();     // id → THREE.MeshStandardMaterial

/** Materiale della gola finger-pull: tinta unita (RAL) o dalla foto. */
function matGolaDa(def) {
  if (def.gola.solido) return new THREE.MeshStandardMaterial({ color: def.gola.colore, roughness: def.lucido ? 0.15 : 0.75, metalness: 0, envMapIntensity: def.lucido ? 1.2 : 0.3 });
  return new THREE.MeshStandardMaterial({ color: def.gola.colore, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.3 });
}
/**
 * LEGNO CONTINUO dalla foto di un campione/porta: la foto diventa un legno che
 * si ripete senza giunte e senza specchi (che si notano subito: disegni
 * simmetrici, righe chiare), e alto come una colonna:
 * 1) i bordi della foto si sfumano con il lato opposto → si ripete senza giunta;
 * 2) due pezzi della stessa foto uno sopra l'altro, spostati dove le righe
 *    combaciano, con passaggio morbido → la venatura prosegue lunga.
 * Ritorna { canvas, fx, fy }: fx, fy = quante misure del campione copre un giro.
 */
function legnoContinuo(img, { raddrizza = true } = {}) {
  const W0 = img && (img.naturalWidth || img.width), H0 = img && (img.naturalHeight || img.height);
  if (!(W0 > 32) || !(H0 > 32)) return null;
  const k = Math.min(1, 1024 / W0, 1200 / H0);
  const W = Math.round(W0 * k), H = Math.round(H0 * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  let A;
  try { g.drawImage(img, 0, 0, W, H); A = Float32Array.from(g.getImageData(0, 0, W, H).data); } catch (_) { return null; }
  const liscio = (t) => t * t * (3 - 2 * t);
  // 0) via la SFUMATURA DI LUCE della foto (più chiara da un lato): piano che
  //    meglio segue la luminosità, poi ogni punto riportato alla media. Resta
  //    il legno (venature, doghe), sparisce il cambio di tono alle cuciture.
  {
    let n = 0, sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * 4, l = 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2];
      const u = x / W - 0.5, v = y / H - 0.5;
      n++; sx += u; sy += v; sl += l; sxx += u * u; syy += v * v; sxy += u * v; sxl += u * l; syl += v * l;
    }
    const m = sl / n;
    // minimi quadrati (u, v centrati: sx, sy ≈ 0)
    const det = sxx * syy - sxy * sxy;
    const bu = det ? (sxl * syy - syl * sxy) / det : 0, bv = det ? (syl * sxx - sxl * sxy) / det : 0;
    if (m > 1) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = m / Math.max(8, m + bu * (x / W - 0.5) + bv * (y / H - 0.5)), i = (y * W + x) * 4;
      for (let q = 0; q < 3; q++) A[i + q] = Math.min(255, A[i + q] * k);
    }
  }
  // 0b) VENATURA DRITTA: nelle foto le righe sono spesso un filo inclinate, e
  //     sopra/sotto non combacerebbero alla cucitura. Misuro di quanto si
  //     spostano tra la parte alta e la bassa e raddrizzo (ogni riga scorre).
  if (raddrizza) {
    const fascia = (y0, y1) => { const p = new Float32Array(W); for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; p[x] += 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2]; } return p; };
    const su = fascia(0, Math.round(H * 0.25)), giu = fascia(Math.round(H * 0.75), H);
    const max = Math.round(W * 0.06), x0 = Math.round(W * 0.12), x1 = Math.round(W * 0.88);
    let best = 0, eb = Infinity;
    for (let d = -max; d <= max; d++) {
      let e = 0, ms = 0, mg = 0;
      for (let x = x0; x < x1; x++) { ms += su[x]; mg += giu[x + d]; }
      ms /= x1 - x0; mg /= x1 - x0;
      for (let x = x0; x < x1; x++) e += Math.abs((su[x] - ms) - (giu[x + d] - mg));
      if (e < eb) { eb = e; best = d; }
    }
    const k = best / (H * 0.75);
    if (best) {
      const R = new Float32Array(A.length);
      for (let y = 0; y < H; y++) {
        const sh = k * (y - H / 2);
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1, Math.max(0, x + sh)), xa = Math.floor(sx), xb = Math.min(W - 1, xa + 1), f = sx - xa;
          const j = (y * W + x) * 4, ia = (y * W + xa) * 4, ib = (y * W + xb) * 4;
          for (let q = 0; q < 4; q++) R[j + q] = A[ia + q] * (1 - f) + A[ib + q] * f;
        }
      }
      A = R;
    }
  }
  // colore medio: le miscele lo conservano, insieme al CONTRASTO (una media
  // semplice di due venature diverse viene sbiadita e la cucitura si vede)
  const med = [0, 0, 0];
  for (let i = 0; i < W * H; i++) for (let q = 0; q < 3; q++) med[q] += A[i * 4 + q];
  for (let q = 0; q < 3; q++) med[q] /= W * H;
  // ρ = quanto si somigliano le due parti mescolate (righe allineate → molto):
  // il contrasto si corregge solo per la parte davvero diversa
  let rho = 0;
  const mesc = (a, b, w, q) => { const k = 1 / Math.sqrt((1 - w) * (1 - w) + w * w + 2 * rho * w * (1 - w)); return med[q] + ((a - med[q]) * (1 - w) + (b - med[q]) * w) * k; };
  const somiglia = (n, va, vb) => {                         // correlazione di due serie (luminosità)
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < n; i++) { const p = va(i), r = vb(i); sa += p; sb += r; saa += p * p; sbb += r * r; sab += p * r; }
    const cov = sab / n - (sa / n) * (sb / n), da = saa / n - (sa / n) ** 2, db = sbb / n - (sb / n) ** 2;
    return da > 1e-6 && db > 1e-6 ? Math.max(0, Math.min(1, cov / Math.sqrt(da * db))) : 0;
  };
  const lumA = (i) => 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2];
  // 1a) sinistra/destra: periodo Q, le prime a colonne sfumano dalla fine della foto
  const a = Math.round(W * 0.12), Q = W - a;
  const B = new Float32Array(Q * H * 3);
  rho = somiglia(a * Math.floor(H / 3), (n) => { const y = 3 * Math.floor(n / a), x = n % a; return lumA((y * W + x + Q) * 4); }, (n) => { const y = 3 * Math.floor(n / a), x = n % a; return lumA((y * W + x) * 4); });
  for (let y = 0; y < H; y++) for (let x = 0; x < Q; x++) {
    const i = (y * W + x) * 4, j = (y * Q + x) * 3;
    if (x < a) { const w = liscio(x / a), i2 = (y * W + x + Q) * 4; for (let q = 0; q < 3; q++) B[j + q] = mesc(A[i2 + q], A[i + q], w, q); }
    else for (let q = 0; q < 3; q++) B[j + q] = A[i + q];
  }
  // 1b) sopra/sotto: periodo P
  const b = Math.round(H * 0.15), P = H - b;
  const C = new Float32Array(Q * P * 3);
  const lumB = (i) => 0.3 * B[i] + 0.59 * B[i + 1] + 0.11 * B[i + 2];
  rho = somiglia(b * Math.floor(Q / 3), (n) => { const y = Math.floor(n / Math.floor(Q / 3)), x = 3 * (n % Math.floor(Q / 3)); return lumB(((y + P) * Q + x) * 3); }, (n) => { const y = Math.floor(n / Math.floor(Q / 3)), x = 3 * (n % Math.floor(Q / 3)); return lumB((y * Q + x) * 3); });
  for (let y = 0; y < P; y++) for (let x = 0; x < Q; x++) {
    const j = (y * Q + x) * 3, i = (y * Q + x) * 3;
    if (y < b) { const w = liscio(y / b), i2 = ((y + P) * Q + x) * 3; for (let q = 0; q < 3; q++) C[j + q] = mesc(B[i2 + q], B[i + q], w, q); }
    else for (let q = 0; q < 3; q++) C[j + q] = B[i + q];
  }
  // 2) due pezzi uno sopra l'altro, il secondo spostato di lato proprio dove le
  //    sue righe COMBACIANO con quelle del primo (cerco lo spostamento che
  //    somiglia di più nella fascia della cucitura): la venatura prosegue senza
  //    gradini e il legno è alto il doppio prima di ripetersi
  const cuci = Math.round(P * 0.3);
  const s4 = 4, q4 = Math.floor(Q / s4), c4 = Math.max(1, Math.floor(cuci / s4));
  const lum = new Float32Array(q4 * c4);
  for (let y = 0; y < c4; y++) for (let x = 0; x < q4; x++) { const i = (y * s4 * Q + x * s4) * 3; lum[y * q4 + x] = 0.3 * C[i] + 0.59 * C[i + 1] + 0.11 * C[i + 2]; }
  let dxBest = Math.round(Q / 2), costo = Infinity;
  for (let d = Math.round(q4 * 0.2); d <= Math.round(q4 * 0.8); d++) {
    let e = 0;
    for (let y = 0; y < c4; y++) for (let x = 0; x < q4; x++) e += Math.abs(lum[y * q4 + x] - lum[y * q4 + (x + d) % q4]);
    if (e < costo) { costo = e; dxBest = d * s4; }
  }
  // righe molto dritte (noce, nogal…): ripetute non si notano, e una cucitura
  // tra due pezzi sì → un pezzo solo; legni con nodi e fiammature → due pezzi
  const bw = Math.floor(W / 4), bh = Math.floor(H / 4), blk = new Float32Array(bw * bh);
  for (let y = 0; y < bh * 4; y++) for (let x = 0; x < bw * 4; x++) blk[Math.floor(y / 4) * bw + Math.floor(x / 4)] += lumA((y * W + x) * 4) / 16;
  let gx = 0, gy = 0;
  for (let y = 1; y < bh; y++) for (let x = 1; x < bw; x++) { gx += Math.abs(blk[y * bw + x] - blk[y * bw + x - 1]); gy += Math.abs(blk[y * bw + x] - blk[(y - 1) * bw + x]); }
  const pezzi = gx > gy * 2.7 ? [0] : [0, dxBest], n = pezzi.length, HT = n * P;
  rho = somiglia(c4 * q4, (i) => lum[i], (i) => lum[Math.floor(i / q4) * q4 + ((i % q4) + dxBest / s4) % q4]);
  const out = document.createElement('canvas'); out.width = Q; out.height = HT;
  const go = out.getContext('2d'); const im = go.createImageData(Q, HT), o = im.data;
  const px = (dx, x, y) => ((y * Q + (x + dx) % Q) * 3);
  for (let y = 0; y < HT; y++) {
    const kk = Math.floor(y / P), t = y - kk * P, dx = pezzi[kk], prima = pezzi[(kk + n - 1) % n];
    const w = t < cuci ? liscio(t / cuci) : 1;
    for (let x = 0; x < Q; x++) {
      const j = (y * Q + x) * 4, i1 = px(dx, x, t);
      if (w < 1) { const i0 = px(prima, x, t); for (let q = 0; q < 3; q++) o[j + q] = mesc(C[i0 + q], C[i1 + q], w, q); }
      else for (let q = 0; q < 3; q++) o[j + q] = C[i1 + q];
      o[j + 3] = 255;
    }
  }
  // TONO UNIFORME: le zone più chiare o più scure della foto (luce del fotografo, una doga più
  // scura) ripetute una sopra l'altra su una colonna alta facevano i «BLOCCHI». Tolgo le
  // variazioni larghe (più grandi di ~1/5 della foto) e lascio intatte venature, nodi e fiammature:
  // la ripetizione non si nota più. (Il legno è già continuo da tutti i lati: sfocatura «a giro».)
  {
    const L = new Float32Array(Q * HT);
    for (let i = 0; i < Q * HT; i++) L[i] = 0.3 * o[i * 4] + 0.59 * o[i * 4 + 1] + 0.11 * o[i * 4 + 2];
    let media = 0; for (let i = 0; i < L.length; i++) media += L[i]; media /= L.length;
    const sfoca = (src, rx, ry) => {                       // box blur separabile, a giro (3 passate ≈ gaussiana)
      let a = src, b = new Float32Array(src.length);
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < HT; y++) {                      // orizzontale
          let acc = 0; for (let k = -rx; k <= rx; k++) acc += a[y * Q + ((k % Q) + Q) % Q];
          for (let x = 0; x < Q; x++) { b[y * Q + x] = acc / (2 * rx + 1); acc += a[y * Q + (x + rx + 1) % Q] - a[y * Q + ((x - rx) % Q + Q) % Q]; }
        }
        [a, b] = [b, a];
        for (let x = 0; x < Q; x++) {                       // verticale
          let acc = 0; for (let k = -ry; k <= ry; k++) acc += a[(((k % HT) + HT) % HT) * Q + x];
          for (let y = 0; y < HT; y++) { b[y * Q + x] = acc / (2 * ry + 1); acc += a[((y + ry + 1) % HT) * Q + x] - a[(((y - ry) % HT + HT) % HT) * Q + x]; }
        }
        [a, b] = [b, a];
      }
      return a;
    };
    const lento = sfoca(L, Math.max(4, Math.round(Q / 10)), Math.max(4, Math.round(P / 10)));
    for (let i = 0; i < Q * HT; i++) {
      const k = Math.pow(media / Math.max(6, lento[i]), 0.85);
      for (let q = 0; q < 3; q++) o[i * 4 + q] = Math.max(0, Math.min(255, o[i * 4 + q] * k));
    }
  }
  go.putImageData(im, 0, 0);
  return { canvas: out, fx: Q / W, fy: HT / H };
}
/**
 * LASTRA di un piano di lavoro dalla foto: IDENTICA alla foto (niente raddrizzamenti,
 * sfumature o pezzi sovrapposti, che sul marmo impastano le venature). Solo ingrandita
 * in alta qualità — le foto dei produttori sono piccole (≈640 px per 3,6 m) e la scheda
 * grafica da vicino le sfocherebbe — con una nitidezza leggera: venature e riflessi netti.
 */
function lastraNitida(img) {
  const W0 = img && (img.naturalWidth || img.width), H0 = img && (img.naturalHeight || img.height);
  if (!(W0 > 16) || !(H0 > 16)) return null;
  const k = Math.min(3, 2400 / W0, 2400 / H0);
  if (k < 1.3) return null;                                   // già grande: va bene così
  const W = Math.round(W0 * k), H = Math.round(H0 * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  try {
    const d = g.getImageData(0, 0, W, H), a = d.data, n = W * H;
    // maschera di contrasto: dettaglio = foto − foto sfocata (sfocatura a scatola, 2 passate)
    const r = Math.max(1, Math.round(k * 0.9)), forza = 0.55;
    const sf = new Float32Array(n * 3), tmp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sf[i * 3] = a[i * 4]; sf[i * 3 + 1] = a[i * 4 + 1]; sf[i * 3 + 2] = a[i * 4 + 2]; }
    const passata = (src, dst, lungo, corto, passo, salto) => {
      for (let j = 0; j < corto; j++) {
        for (let q = 0; q < 3; q++) {
          let acc = 0, cnt = 0;
          for (let t = -r; t <= r; t++) { const tt = Math.min(lungo - 1, Math.max(0, t)); acc += src[(j * salto + tt * passo) * 3 + q]; cnt++; }
          for (let t = 0; t < lungo; t++) {
            dst[(j * salto + t * passo) * 3 + q] = acc / cnt;
            const fuori = Math.max(0, t - r), dentro = Math.min(lungo - 1, t + r + 1);
            acc += src[(j * salto + dentro * passo) * 3 + q] - src[(j * salto + fuori * passo) * 3 + q];
          }
        }
      }
    };
    passata(sf, tmp, W, H, 1, W);      // orizzontale
    passata(tmp, sf, H, W, W, 1);      // verticale
    for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) {
      const o = a[i * 4 + q];
      a[i * 4 + q] = Math.max(0, Math.min(255, o + (o - sf[i * 3 + q]) * forza));
    }
    g.putImageData(d, 0, 0);
  } catch (_) { /* senza nitidezza va bene lo stesso */ }
  return c;
}
/**
 * LUXE (laccato lucido) con il COLORE ESATTO del campione: sotto, il colore pieno identico alla
 * foto (come gli opachi: la luce della scena non lo schiarisce né lo slava); sopra, lo strato
 * lucido che SPECCHIA la stanza (finestre, luci, mobili di fronte) come un laccato vero.
 * Prima il riflesso della stanza si sommava a tutto il pannello e il colore usciva slavato
 * (Agua marina color menta, Ultramar azzurro chiaro).
 */
// STANZA DEI RIFLESSI dei laccati (armadi, mobili modulari: in cucina c'è quella vera della stanza):
// pareti tenui, due finestre luminose e una luce sul soffitto → sul lucido si vedono riflessi netti
// (come in una foto vera) invece di un velo uniforme che lo faceva sembrare opaco.
let _envLaccato = null;
function envLaccato() {
  if (_envLaccato || typeof document === 'undefined') return _envLaccato;
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#9a9893'); gr.addColorStop(0.45, '#6f6d68'); gr.addColorStop(0.55, '#4a4844'); gr.addColorStop(1, '#262523');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  // (verso +z, cioè di fronte ai mobili = alle spalle di chi guarda, è u ≈ 0,75)
  // finestra grande di fronte (a cavallo dell'orizzonte: si specchia a metà delle ante), a due ante
  g.fillRect(W * 0.64, H * 0.34, W * 0.105, H * 0.30); g.fillRect(W * 0.755, H * 0.34, W * 0.105, H * 0.30);
  g.fillRect(W * 0.53, H * 0.38, W * 0.05, H * 0.22);                                                        // finestra di lato
  g.fillRect(W * 0.62, H * 0.07, W * 0.26, H * 0.02);                                                        // luce sul soffitto
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  _envLaccato = t;
  return t;
}
function laccatoFoto(mat, colore) {
  const env = envLaccato();
  if (env) mat.envMap = env;               // in cucina la sostituisce la stanza vera (riflessi della cucina)
  const c = new THREE.Color(colore), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  mat.userData.ccF0 = { value: 0.06 + 0.02 * Math.min(1, lum / 0.8) };   // 6% scuri … 8% chiari (di fronte); di lato specchia di più
  mat.userData.riflesso = 1.6;            // finestre e luci si specchiano nette; il colore resta il protagonista (vedi sotto)
  mat.userData.ngRif = LUCE_FOTO;
  mat.toneMapped = false;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.ngCcF0 = mat.userData.ccF0;
    sh.uniforms.ngLuceRif = mat.userData.ngRif;
    sh.uniforms.ngTintaLed = TINTA_LED;
    sh.fragmentShader = 'uniform float ngCcF0;\nuniform float ngLuceRif;\nuniform vec3 ngTintaLed;\n' + sh.fragmentShader
      .replace('#include <lights_physical_fragment>',
        THREE.ShaderChunk.lights_physical_fragment.replace('material.clearcoatF0 = vec3( 0.04 );', 'material.clearcoatF0 = vec3( ngCcF0 );'))
      .replace('#include <opaque_fragment>', `{
        vec3 wl = vec3(0.2126, 0.7152, 0.0722);
        float f = dot(totalDiffuse, wl) / max(dot(diffuseColor.rgb, wl), 1e-4) / ngLuceRif;
        vec3 tinta = mix(vec3(1.0), ngTintaLed, 0.6 * clamp((f - 1.0) * 1.5, 0.0, 1.0));
        if (f > 1.0) f = 1.0 + 0.45 * (1.0 - exp(-(f - 1.0) * 1.6));
        vec3 base = diffuseColor.rgb * mix(1.0, f, ${CONTRASTO_FOTO.toFixed(2)}) * tinta;
        #ifdef USE_CLEARCOAT
          float ngNV = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
          // COME UN LACCATO VERO VISTO DAL CLIENTE: il pannello tiene il SUO colore (~95%). Il riflesso
          // della stanza non ci mette sopra del bianco (lo faceva grigio/lilla): lo fa solo un po' più
          // luminoso nello stesso colore dove si specchiano finestre e luci, più un piccolo punto di luce.
          vec3 ngR = clearcoatSpecularDirect + clearcoatSpecularIndirect;
          float ngL = dot( ngR, vec3( 0.2126, 0.7152, 0.0722 ) );
          float ngB = smoothstep( 0.04, 0.18, ngL );                       // solo le cose luminose (finestre, luci)
          float ngBaseL = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );
          // IL RIFLESSO SI VEDE «APPENA APPENA», come il pavimento nelle ante basse (approvato così):
          // finestre e luci NON fanno più strisce grigie sui pensili (un nero resta nero, un blu resta
          // blu). Il riflesso cresce piano e si ferma a un tetto basso, proporzionato al colore, nella
          // tinta del pannello (niente velo grigio); di lato (costado, fianchi visti di sbieco) un po' di più.
          vec3 ngTono = mix( vec3( 1.0 ), clamp( base / max( ngBaseL, 1e-4 ), 0.0, 3.0 ), 0.6 );
          float ngC = ( 0.0035 + 0.03 * ngBaseL ) * ( 1.0 + 6.0 * pow( 1.0 - ngNV, 3.0 ) );
          float ngV = ngL * ngB;
          vec3 ngLuce = ngTono * ( ngC * ( 1.0 - exp( -ngV / ngC ) ) );
          outgoingLight = base * ( 1.0 + 0.03 * ngB ) + ngLuce + totalEmissiveRadiance;
        #else
          outgoingLight = base + totalEmissiveRadiance;
        #endif
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'ng-laccato-foto';
  mat.needsUpdate = true;
}
export function getMaterialeTHREE(id, onPronto) {
  if (cacheMat.has(id)) return cacheMat.get(id);
  const def = trovaMateriale(id);
  // Tinte solide: niente texture, solo colore + finitura matte/lucida.
  if (def.solido) {
    let mat;
    if (def.lucido) {
      // Laccato LUCIDO: clearcoat trasparente sopra il colore → riflessi netti
      // (stacco evidente rispetto all'opaco), serve un environment in scena.
      mat = new THREE.MeshPhysicalMaterial({
        color: def.colore,
        roughness: def.roughness ?? 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 2.6,
      });
      laccatoFoto(mat, def.colore);
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: def.colore,
        roughness: def.roughness ?? 1.0,
        metalness: def.metalness ?? 0.0,
        envMapIntensity: def.envMapIntensity ?? 0.4,
      });
      // MATTE = OPACO PIENO: nessun riflesso, il colore ESATTO del campione (anche il nero: prima
      // veniva schiarito a grigio antracite con un riflesso satinato e non era più il nero del campione)
      { const c = mat.color.clone(); coloreFoto(mat); mat.color.copy(c); }
    }
    // finger-pull in tinta unita: la gola ha il suo materiale (es. nero)
    if (def.gola) {
      const mg = matGolaDa(def);
      mat.userData.matGola = mg;
      if (!def.gola.solido) loader.load(def.gola.texture, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; mg.map = tex; coloreFoto(mg); if (onPronto) onPronto(); });
    }
    cacheMat.set(id, mat);
    return mat;
  }
  // Maniglia da foto: sagoma ritagliata (PNG con trasparenza), senza ripetizioni
  if (def.categoria === 'maniglia' && def.texture) {
    const mm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.4,
      roughness: 0.5, metalness: 0.1, envMapIntensity: 0.3, side: THREE.DoubleSide });
    cacheMat.set(id, mm);
    loader.load(def.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mm.map = tex; mm.needsUpdate = true;
      if (onPronto) onPronto();
    });
    return mm;
  }
  // Legno: carica la texture in background e la applica quando è pronta.
  // Prodotti PROPRI (foto del campione): superficie opaca e poco riflettente,
  // così il colore resta quello della foto.
  // TAVOLE INTERE (foto ufficiali): come i prodotti propri, il colore resta ESATTAMENTE quello della foto
  const mat = new THREE.MeshStandardMaterial(def.proprio || def.tavola
    ? { color: def.colore, ...PARAM_FOTO, ...(def.lucido ? { roughness: 0.2, envMapIntensity: 0.9 } : {}) }
    : { color: def.colore, roughness: 0.6, metalness: 0.05 });
  // misura reale del legno: quella del campione fotografato, o ~60 cm per i legni
  // già nel sito (foto ravvicinate di campioni): mai stirato, mai a piastrelle
  // PIANI DI LAVORO: la foto (un pezzo di lastra di ~60 cm) in scala vera, ripetuta a
  // specchio come le lastre "a libro"; prima veniva stirata su tutta la lunghezza del piano
  // (una foto da 60 cm su 3–4 metri: venature diventate strisce)
  const campione = def.campione || (def.categoria === 'legno' && def.texture ? { wMm: 600, hMm: 600 } : null)
    || (def.categoria === 'encimera' && def.texture ? { wMm: 1500, hMm: 1500 } : null);
  // CONTINUO (senza specchi né giunte, la foto prosegue): legni e piani di lavoro. Ripetere la
  // foto a specchio fa disegni simmetrici (a "farfalla") che si notano subito.
  // (le TAVOLE INTERE no: la foto resta com'è e ogni pezzo ne è un ritaglio)
  const continuo = !!campione && !def.tavola && (def.categoria === 'legno' || def.categoria === 'encimera');
  if (campione) { mat.userData.campioneMm = campione; if (continuo) mat.userData.continuo = true; }
  if (def.campione) mat.userData.campioneVero = true;     // misura VERA data dal prodotto (non quella di ripiego)
  if (def.tavola) { mat.userData.tavola = true; if (def.ruota) mat.userData.ruota = true; }
  if (def.proprio && def.lucido) mat.userData.ngSpec = 1;   // foto lucida: riflessi veri nel 3D
  // Finger-pull da foto: materiale della GOLA (la parte sopra, es. nera)
  if (def.gola) {
    const mg = matGolaDa(def);
    mat.userData.matGola = mg;
    if (!def.gola.solido) loader.load(def.gola.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mg.map = tex; coloreFoto(mg); mg.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  cacheMat.set(id, mat);
  if (!cacheTex.has(id)) {
    loader.load(def.texture, (tex0) => {
      let tex = tex0;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;                     // nitida anche di sbieco (il massimo della scheda)
      // LASTRA INTERA di un piano (es. 3600 × 1400) o di un pannello in marmo (SM Nuvola, 1240 × 2750):
      // la foto è IDENTICA, come un pezzo di marmo vero; oltre la lastra la seconda è "a libro"
      // (a specchio), come la mette il marmista
      const lastra = (def.categoria === 'encimera' || def.marmo) && def.campione && Math.max(def.campione.wMm, def.campione.hMm) >= 2000;
      if (def.tavola && campione) {
        // TAVOLA INTERA: la foto ESATTAMENTE com'è (niente nitidezza, niente legno «continuo», niente
        // ritocchi), alla misura vera; ogni pezzo è ritagliato dentro la tavola (uvInScala)
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.repeat.set(unitaUV.u / campione.wMm, unitaUV.v / campione.hMm);
      } else if (campione && lastra) {
        const ln = lastraNitida(tex.image);
        if (ln) {
          const t2 = new THREE.CanvasTexture(ln);
          t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = 16;
          tex.dispose(); tex = t2;
        }
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.repeat.set(unitaUV.u / campione.wMm, unitaUV.v / campione.hMm);
      } else if (campione) {
        // LEGNO CONTINUO: dalla foto un legno che prosegue senza specchi né
        // giunte, alla misura reale del campione (i marmi non si raddrizzano: venature come nella foto)
        const lc = continuo ? legnoContinuo(tex.image, { raddrizza: def.categoria !== 'encimera' }) : null;
        if (lc) {
          const t2 = new THREE.CanvasTexture(lc.canvas);
          t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = 16;
          t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
          t2.repeat.set(unitaUV.u / (campione.wMm * lc.fx), unitaUV.v / (campione.hMm * lc.fy));
          tex.dispose(); tex = t2;
        } else {
          tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
          tex.repeat.set(unitaUV.u / campione.wMm, unitaUV.v / campione.hMm);
        }
      }
      cacheTex.set(id, tex);
      mat.map = tex;
      if (def.proprio || def.tavola) coloreFoto(mat); else mat.color.set(0xffffff); // la texture esprime il colore
      mat.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  return mat;
}

/**
 * Indica se il materiale è un LEGNO (ha una texture da tilare).
 * Serve a scena3d.js per decidere se applicare il tiling UV.
 */
export function isLegno(id) {
  const def = trovaMateriale(id);
  return def && !def.solido;
}

// Config default: Ante = Roble Denver, Interno/Schiena = Roble Hera, Tamp = Roble Denver
// Cassettiera: struttura come l'interno, fronti come le ante.
export function materialiDefault() {
  return {
    ante: 'roble-denver',
    carcassa: 'roble-hera',
    schiena: 'roble-hera',
    tamponamenti: 'roble-denver',
    costadi: 'roble-denver',
    cassStruttura: 'roble-hera',
    cassFronti: 'roble-denver',
  };
}
