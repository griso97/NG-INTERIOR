// =============================================================================
// VISTA 3D — Progettazione cucina (Step 3)
// =============================================================================
// Disegna in 3D i mobili posati in pianta, CON I FRONTI REALI: ante, cassetti
// (nel numero scelto), colonne (porta bassa + forno/microonde/porta), piani di
// lavoro, lavello e piano cottura. Forno e microonde usano un'immagine
// "standard" generata al volo (nessun file esterno).
// Unità in MILLIMETRI. Assi: X = pianta x · Y = altezza · Z = −(pianta y).
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js?v=20261111x';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  calcolaVertici, dimMobile, categoriaTipo, frigoSottoAltillo, pannelliSottoPonte, spessorePannelloPonte, anteDiMobile, portaBassaColonna, frontiCassetti, gruppoPorte, sceltePorte, spFiancoColonna, altezzaVanoColonna, apertoDi, ripianiAperto, latoApertoDi, SP_PEZZI_APERTO, coloreParteAperto, ledAperto,
  moduliDiParete, PROFONDITA_BASE, PROFONDITA_PENSILE, infoAngoloCieco, SPESSORE_ANTA, fasceCierreTecho, rettangoloSoffitto,
} from './modello.js?v=20261122e';
import { getMaterialeTHREE, MATERIALI, impostaUnitaUV, taraLuceCatalogo, pianoComeFoto, pannelloComeFoto, materialiPer, sfondoSwatch, uvInScala, impostaTintaLed } from '../materiali.js?v=20261122e';
import { oggettoDaFoto } from '../oggetto3d.js?v=20261122e';
import { oggettoPronto } from '../oggetti-pronti.js?v=20261122e';
// la COLLEZIONE (il codice degli oggetti disegnati da noi: lampade, fruttiere, tavoli…) si scarica
// solo quando nella cucina c'è almeno uno di quegli oggetti: averne tanti nel catalogo non pesa
let _collezione = null, _collezioneP = null;
function oggettoModerno(id, misure, quandoPronto, soffitto, colore) {
  if (_collezione) return _collezione.oggettoModerno(id, misure, quandoPronto, soffitto, colore);
  if (!_collezioneP) _collezioneP = import('../collezione-moderna.js?v=20261122e').then((m) => (_collezione = m)).catch((e) => { _collezioneP = null; throw e; });
  _collezioneP.then((m) => { if (m.oggettoModerno(id, misure, quandoPronto, soffitto, colore) && quandoPronto) quandoPronto(); }).catch(() => {});
  return null;
}
import { oggettoLibreria, Y_QUADRO } from '../libreria3d.js?v=20261122e';
import { costruisciManiglia, manigliaDaFoto } from '../maniglia3d.js?v=20261122e';
import { parametri } from '../parametri.js?v=20261122e';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js?v=20261122e';
import { creaResa, nearSegueLaVista, preparaOmbre, inquadraOmbre, ombreSuTutto, pavimentoVero } from '../resa.js?v=20261122e';
import { sfondoDi } from '../sfondi.js?v=20261111x';
export { MATERIALI, materialiPer, sfondoSwatch } from '../materiali.js?v=20261122e';
export { SFONDI_LISTA } from '../sfondi.js?v=20261111x';
export { telaPavimento } from '../resa.js?v=20261122e';

export const MONTAGGIO_PENSILE = 1400;   // altezza da terra del basso dei pensili
const SP_TOP = 40;
// Zoccolo (piedini) in base all'altezza della porta:
//  porta 70 → zoccolo 150 mm · porta 80 → zoccolo 100 mm
function zoccoloPerAltezza(h) { return h >= 800 ? 100 : 150; }
/** Spessore del piano di lavoro: scelto a mano per questa cucina, se no quello del materiale (nero standard 40). */
function spessorePianoDi(progetto, encDef) {
  const enc = (progetto && progetto.encimera) || {};
  const mano = Number(enc.spessore);
  const uno = mano > 0 ? mano : (encDef && encDef.spessore != null) ? encDef.spessore : SP_TOP;
  return uno * Math.max(1, Math.min(3, Number(enc.strati) || 1));          // pannelli uno sopra l'altro
}

// Altezza dominante dei mobili BASSI della cucina (quelli che poggiano a terra
// con piedini + piano: base, lavello, forno, cassettiera...). Serve per far
// adattare i piedini della colonna ai mobili bassi: se i bassi sono da 80
// (piedini 100), anche la colonna deve stare su piedini da 100, non 150.
const CAT_NON_BASSE = new Set(['pensile', 'colonna', 'regletta', 'pannello', 'costado', 'oggetto', 'frigo', 'altillo', 'tavolo']);
function altezzaBaseDominante(progetto) {
  const conteggio = new Map();
  for (const m of (progetto.mobiliLiberi || [])) {
    if (CAT_NON_BASSE.has(categoriaTipo(m.tipo))) continue;
    const h = m.altezza_mm || 700;
    conteggio.set(h, (conteggio.get(h) || 0) + 1);
  }
  if (!conteggio.size) return null;
  let best = null, bestN = -1;
  for (const [h, n] of conteggio) if (n > bestN) { bestN = n; best = h; }
  return best;
}
// Piedini della colonna: adattati ai mobili bassi della cucina; se non ce ne
// sono, si usa la porta bassa della colonna stessa come riferimento.
function zoccoloColonna(progetto, m) {
  const baseH = altezzaBaseDominante(progetto);
  return zoccoloPerAltezza(baseH != null ? baseH : (m.altezzaBassa_mm || 700));
}

/**
 * Cima (mm da terra) di un costado A TERRA. Quello alto (≥ 150 cm) va a filo
 * sopra con le colonne, se ci sono; senza colonne (es. solo frigo tra due
 * costadi) sta appoggiato a terra, alto quanto l'hai fatto.
 */
function cimaCostadoAlto(m, topLine) {
  const h = m.altezza_mm || 850;
  // costado legato al mobile sopra frigo: sempre a terra, alto fino alla sua cima
  if (m.seguiFrigo != null) return h;
  return (h >= 1500 && topLine != null ? Math.max(0, topLine - h) : 0) + h;
}
/**
 * MOBILE SOPRA FRIGO: la sua cima va a filo con la cosa alta che ha accanto
 * (costado alto, colonna, pannello alto); se non tocca niente di alto, con la
 * cima delle colonne, se no 235 cm. Non scende mai dentro il frigo sotto.
 * Ritorna la quota del suo fondo (mm da terra).
 */
function baseAltillo(progetto, m, topLine, cimaAlta = topLine, cimaScelta = null) {
  const h = m.altezza_mm || 350, dm = dimMobile(m);
  // DISTANZA DAL FRIGO scelta a mano: il mobile sta a quella distanza dal frigo;
  // gli altri mobili sopra frigo seguono la stessa cima (come i pensili)
  const fr = frigoSottoAltillo(progetto, m);
  if (fr && m.distanzaFrigo_mm != null) return (fr.altezza_mm || 1850) + Math.max(0, m.distanzaFrigo_mm);
  if (cimaScelta != null) return Math.max(cimaScelta - h, fr ? (fr.altezza_mm || 1850) + 10 : 0);
  const box = (o, d) => { const rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
    const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2; return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy }; };
  const A = box(m, dm);
  let cima = null, frigoSotto = 0;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id) continue;
    const cat = categoriaTipo(o.tipo);
    const B = box(o, dimMobile(o));
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
    if (cat === 'frigo' && gx < -20 && gy < -20) { frigoSotto = Math.max(frigoSotto, o.altezza_mm || 1850); continue; }
    if (gx > 60 || gy > 60) continue;                      // non lo tocca
    let c = null;
    if (cat === 'colonna') c = (o.altezza_mm || 2200) + zoccoloColonna(progetto, o);
    else if (cat === 'costado' && (o.profondita_mm || 620) >= 500 && (o.altezza_mm || 0) >= 1500) c = cimaCostadoAlto(o, topLine);
    else if (cat === 'pannello' && (o.altezza_mm || 0) >= 1500) c = o.altezza_mm;
    if (c != null) cima = Math.max(cima ?? 0, c);
  }
  if (cima == null) cima = cimaAlta != null ? cimaAlta : 2350;
  return Math.max(cima - h, frigoSotto ? frigoSotto + 10 : 0);
}

/** Rettangolo in pianta (rotazioni a 90°). */
function boxPianta(o) {
  const d = dimMobile(o), rr = ((Math.round((o.rot || 0) / 90) * 90) % 180 + 180) % 180;
  const hx = (rr === 0 ? d.w : d.d) / 2, hy = (rr === 0 ? d.d : d.w) / 2;
  return { x0: o.x - hx, x1: o.x + hx, y0: o.y - hy, y1: o.y + hy };
}
function siSovrappongono(a, b) {
  const A = boxPianta(a), B = boxPianta(b);
  return Math.max(B.x0 - A.x1, A.x0 - B.x1) < -20 && Math.max(B.y0 - A.y1, A.y0 - B.y1) < -20;
}
/**
 * PENSILE SOTTO IL PONTE (o sotto un mobile sopra frigo): la sua cima tocca il
 * fondo del ponte. Ritorna la quota del fondo del ponte sopra m, o null.
 */
function fondoPonteSopra(progetto, m, q) {
  let fondo = null;
  for (const o of (progetto.mobiliLiberi || [])) {
    if (o.id === m.id || categoriaTipo(o.tipo) !== 'altillo' || !siSovrappongono(m, o)) continue;
    // sotto il ponte c'è il PANNELLO che ne copre il fondo: il pensile va sotto di lui
    const b = baseAltillo(progetto, o, q.topLine, q.cimaAlta, q.scelta) - (o.tipo === 'ponte' ? spessorePannelloPonte(progetto) : 0);
    fondo = fondo == null ? b : Math.min(fondo, b);
  }
  return fondo;
}

/**
 * CIMA DEI MODULI ALTI scelta con la "distanza dal frigo" di un mobile sopra
 * frigo (frigo + distanza + altezza del mobile), oppure null.
 */
function cimaDaDistanzaFrigo(progetto) {
  for (const m of (progetto.mobiliLiberi || [])) {
    if (categoriaTipo(m.tipo) !== 'altillo' || m.distanzaFrigo_mm == null) continue;
    const fr = frigoSottoAltillo(progetto, m);
    if (fr) return (fr.altezza_mm || 1850) + Math.max(0, m.distanzaFrigo_mm) + (m.altezza_mm || 350);
  }
  return null;
}
/** Quote del sistema alto: { topLine (colonne), cimaAlta (pensili), scelta (dalla distanza dal frigo) }. */
function quoteAlte(progetto) {
  const topLine = quotaAltaColonne(progetto);
  const scelta = cimaDaDistanzaFrigo(progetto);
  const cimaAlta = scelta != null ? scelta : (topLine != null ? topLine : quotaAltaPannelli(progetto));
  return { topLine, cimaAlta, scelta };
}
/**
 * CUCINA A PONTE: spazio libero (mm) tra il piano di lavoro e il fondo dei
 * pensili sotto il ponte (il più piccolo), o null se non ci sono.
 */
/**
 * PONTE AUTOMATICO: dato lo spazio sul piano di lavoro e l'altezza dei
 * pensili, l'altezza del ponte che riempie fino alla cima delle colonne
 * (cima − pannello − piano − spazio − pensili). { cima, piano, pannello, hPonte }
 */
export function calcoloPonte(progetto, spazio, hPens) {
  const q = quoteAlte(progetto);
  const cima = q.cimaAlta != null ? q.cimaAlta : 2350;
  const encId = progetto.encimera && progetto.encimera.materiale;
  const encDef = encId ? MATERIALI.find((m) => m.id === encId) : null;
  const spTop = spessorePianoDi(progetto, encDef);
  let piano = 0;
  for (const b of (progetto.mobiliLiberi || [])) {
    if (!['base', 'lavastoviglie', 'lavatrice'].includes(categoriaTipo(b.tipo))) continue;
    const h = b.altezza_mm || 700;
    piano = Math.max(piano, zoccoloPerAltezza(h) + h + spTop);
  }
  if (!piano) piano = 150 + 700 + spTop;
  const pann = spessorePannelloPonte(progetto);
  const hPonte = Math.round(cima - pann - (piano + spazio + (hPens || 0)));
  return { cima: Math.round(cima), piano: Math.round(piano), pannello: pann, hPonte };
}
export function spazioSottoPonte(progetto) {
  const q = quoteAlte(progetto);
  let min = null;
  for (const p of (progetto.mobiliLiberi || [])) {
    if (categoriaTipo(p.tipo) !== 'pensile') continue;
    const fondo = fondoPonteSopra(progetto, p, q);
    if (fondo == null) continue;
    const base = (progetto.mobiliLiberi || []).find((o) => ['base', 'lavastoviglie', 'lavatrice'].includes(categoriaTipo(o.tipo)) && siSovrappongono(o, p));
    if (!base) continue;
    const hb = base.altezza_mm || 700;
    const spazio = Math.round(fondo - (p.altezza_mm || 700) - (zoccoloPerAltezza(hb) + hb + _spTop));
    min = min == null ? spazio : Math.min(min, spazio);
  }
  return min;
}
/** Spazio (mm) tra il frigo e il mobile sopra frigo, come nel 3D; null se sotto non c'è un frigo. */
export function distanzaAltilloFrigo(progetto, m) {
  const fr = frigoSottoAltillo(progetto, m);
  if (!fr) return null;
  const q = quoteAlte(progetto);
  return Math.round(baseAltillo(progetto, m, q.topLine, q.cimaAlta, q.scelta) - (fr.altezza_mm || 1850));
}
/** Cima più alta dei costadi (profondi, a terra) e dei pannelli alti (≥ 150 cm); null se non ce ne sono. */
function quotaAltaPannelli(progetto) {
  let q = null;
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo), h = m.altezza_mm || 0;
    if (h < 1500) continue;
    if ((cat === 'costado' && (m.profondita_mm || 620) >= 500) || cat === 'pannello') q = Math.max(q ?? 0, h);
  }
  return q;
}
// Quota della cima delle colonne (cassa + zoccolo). null se non ci sono colonne.
function quotaAltaColonne(progetto) {
  const cols = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) === 'colonna');
  if (cols.length === 0) return null;
  return Math.max(...cols.map((c) => (c.altezza_mm || 2200) + zoccoloColonna(progetto, c)));
}
/** Altezza del SOFFITTO (mm): muri, soffitto e lampade appese. Si sceglie al passo 4. */
export function altezzaSoffitto(progetto) { return Math.max(2200, Math.min(4500, Number(progetto && progetto.altezzaSoffitto) || 2700)); }
const MAT_MURO = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
// soffitto: la luce principale viene dall'alto e non lo tocca; in una stanza vera è illuminato
// dalla luce che rimbalza dal pavimento e dai muri → un filo di luce propria (bianco caldo, opaco)
const MAT_SOFFITTO = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.97, metalness: 0, envMapIntensity: 0.4, emissive: 0xd9d4cb, emissiveIntensity: 0.62 });
// la lastra del soffitto vista DA SOPRA: semitrasparente (si vede che c'è e si vede la cucina sotto),
// con i fianchi pieni (lo spessore) e i bordi netti
const MAT_SOFFITTO_SOPRA = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 1, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false });
const MAT_SOFFITTO_FIANCO = new THREE.MeshStandardMaterial({ color: 0xe2ded6, roughness: 0.95, metalness: 0, emissive: 0x6b6862, emissiveIntensity: 0.25 });
const MAT_SOFFITTO_BORDO = new THREE.LineBasicMaterial({ color: 0x5c5850, transparent: true, opacity: 0.75 });
const SP_SOFFITTO = 200;   // mm: spessore della lastra
const H_FORNO = 600;
const H_MICRO = 380;

let scene, camera, renderer, controls, gruppo, canvasEl;
let animazioneAttiva = false;
let selId = null;             // mobile evidenziato (selezionato nel 3D)
let ultimoProgetto = null;    // ultimo progetto reso (per ricostruire al caricamento texture)
let luciAmbiente = [];        // luci di scena con la loro intensita' base
                              // (per abbassarle quando i LED pensili sono accesi)
const texCache = {};

/** Evidenzia un gruppo: bordi bianchi + leggero bagliore sul corpo. */
/**
 * MENO DISEGNI = 3D PIÙ FLUIDO. Un cassettone erano ~28 pezzi (fianchi, frontali, maniglie, cassetti…):
 * ognuno un «disegno» separato per la scheda grafica, e una cucina intera arrivava a 1.700 disegni per
 * immagine (×3: scena, vetro, ombre di contatto). Qui i pezzi di un mobile con lo STESSO materiale
 * diventano un pezzo solo: a vista identico, 3–5 disegni per mobile. I pezzi speciali (LED, luci,
 * trasparenti, superfici d'appoggio, segnaposti) restano come sono.
 */
function unisciPerMateriale(root) {
  if (!root) return;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buono = (m) => m && !m.transparent && !(m.transmission > 0) && m.visible !== false;
  const gruppi = new Map(), via = new Set();
  const metti = (o, geo, mat, r) => {
    const attr = Object.keys(geo.attributes).sort().map((k) => `${k}${geo.attributes[k].itemSize}${geo.attributes[k].array.constructor.name}`).join(',');
    const key = `${mat.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${geo.index ? 1 : 0}|${attr}`;
    (gruppi.get(key) || gruppi.set(key, []).get(key)).push({ geo, mat, o, r });
  };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o.children.length || o.renderOrder) return;
    if (Object.keys(o.userData).length) return;                       // pezzi con un compito: restano soli
    const g = o.geometry;
    if (!g || !g.attributes.position || (g.morphAttributes && Object.keys(g.morphAttributes).length)) return;
    if (Object.values(g.attributes).some((a) => a.isInterleavedBufferAttribute)) return;
    for (let x = o.parent; x && x !== root; x = x.parent) if (!x.visible) return;
    const r = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (r.determinant() < 0) return;                                  // specchiato: girerebbe le facce
    if (!Array.isArray(o.material)) {
      if (!buono(o.material)) return;
      metti(o, g, o.material, r); via.add(o); return;
    }
    // più materiali sullo stesso pezzo (es. una faccia di un altro colore): un pezzo per materiale
    if (!g.groups.length || !g.groups.every((gr) => buono(o.material[gr.materialIndex]))) return;
    for (const gr of g.groups) {
      let sub;
      if (g.index) { sub = g.clone(); sub.setIndex(Array.from(g.index.array.slice(gr.start, gr.start + gr.count))); }
      else {
        sub = new THREE.BufferGeometry();
        for (const k in g.attributes) { const at = g.attributes[k]; sub.setAttribute(k, new THREE.BufferAttribute(at.array.slice(gr.start * at.itemSize, (gr.start + gr.count) * at.itemSize), at.itemSize, at.normalized)); }
      }
      sub.clearGroups(); sub.userData._tmp = true;
      metti(o, sub, o.material[gr.materialIndex], r);
    }
    via.add(o);
  });
  // un pezzo solo che non viene da più materiali: inutile rifarlo
  for (const [k, lista] of gruppi) if (lista.length === 1 && !Array.isArray(lista[0].o.material)) { via.delete(lista[0].o); gruppi.delete(k); }
  const nuovi = [];
  for (const lista of gruppi.values()) {
    const geos = lista.map((x) => (x.geo.userData._tmp ? x.geo : x.geo.clone()).applyMatrix4(x.r));
    let unita = null;
    try { unita = geos.length === 1 ? geos[0] : mergeGeometries(geos, false); } catch (_) { unita = null; }
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    if (!unita) { for (const x of lista) via.delete(x.o); continue; }
    const mesh = new THREE.Mesh(unita, lista[0].mat);
    mesh.castShadow = lista[0].o.castShadow; mesh.receiveShadow = lista[0].o.receiveShadow;
    nuovi.push(mesh);
  }
  for (const o of via) o.parent && o.parent.remove(o);
  for (const m of nuovi) root.add(m);
}

function evidenzia(g) {
  g.traverse((o) => {
    if (o.isLineSegments && !o.userData.fuga) {
      o.material = new THREE.LineBasicMaterial({ color: 0xffffff });
    } else if (o.isMesh && o.material && o.material.emissive !== undefined) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(0x9a7a28);
      o.material.emissiveIntensity = 1.0;
    }
  });
}

/** Dimensioni e posizione della vasca del lavello (condivise fra il 3D del
 *  lavello e il FORO che va ritagliato nel piano di lavoro). */
function dimVasca(w, d) {
  const vw = Math.min(w * 0.56, 500);
  const vd = Math.min(d * 0.52, 400);
  const zc = -d * 0.03;                 // leggermente arretrata rispetto al centro
  return { vw, vd, zc };
}

/** Misura del vetro del piano cottura (e del suo foro nel piano di lavoro). */
// PLACCA a 2 fuochi = «domino» stretto (29 × 51 cm, zone una dietro l'altra); a 4 fuochi = 58 × 48
function dimPlacca(w, d, fuochi = 4) {
  return fuochi === 2 ? { pw: Math.min(w - 40, 290), pd: Math.min(d - 80, 510) } : { pw: Math.min(w - 40, 580), pd: Math.min(d - 80, 480) };
}

/** Lavello / piano cottura / rubinetto posati SOPRA la superficie del top.
 *  fin = { lavello: 'acciaio'|'nero', rubinetto: 'acciaio'|'nero' } */
// --- RUBINETTI ---------------------------------------------------------------
export const FINITURE_RUBINETTO = [
  { id: 'cromo', nome: 'Cromo', css: 'linear-gradient(135deg,#f4f5f7,#a7abb2 55%,#e6e8eb)', colore: 0xf2f3f6, metal: 0.78, rough: 0.12 },
  { id: 'spazzolato', nome: 'Acciaio spazzolato', css: 'linear-gradient(135deg,#d9dbde,#a3a6ab)', colore: 0xd6d8dc, metal: 0.7, rough: 0.36 },
  { id: 'nero', nome: 'Nero opaco', css: '#1c1c1e', colore: 0x1e1e20, metal: 0.35, rough: 0.5 },
  { id: 'canna', nome: 'Canna di fucile', css: 'linear-gradient(135deg,#6a6c71,#34363a)', colore: 0x5d6066, metal: 0.7, rough: 0.3 },
  { id: 'oro', nome: 'Oro spazzolato', css: 'linear-gradient(135deg,#e6c98a,#b08a45)', colore: 0xe2bf72, metal: 0.75, rough: 0.3 },
  { id: 'rame', nome: 'Rame', css: 'linear-gradient(135deg,#e2a07d,#9c5a39)', colore: 0xd08860, metal: 0.75, rough: 0.3 },
  { id: 'bianco', nome: 'Bianco opaco', css: '#f1f1ef', colore: 0xf2f2f0, metal: 0.05, rough: 0.35 },
];
export const MODELLI_RUBINETTO = [
  { id: 'cigno', nome: 'Collo di cigno' },
  { id: 'molla', nome: 'Professionale con molla' },
  { id: 'squadrato', nome: 'Squadrato moderno' },
];
const _matRub = {};
function materialeRubinetto(id) {
  if (id === 'acciaio') id = 'cromo';                      // progetti salvati prima
  if (!_matRub[id]) {
    const f = FINITURE_RUBINETTO.find((x) => x.id === id) || FINITURE_RUBINETTO[0];
    _matRub[id] = new THREE.MeshStandardMaterial({ color: f.colore, metalness: f.metal, roughness: f.rough, envMapIntensity: f.metal > 0.5 ? 1.6 : 0.5 });
  }
  return _matRub[id];
}
/**
 * Rubinetto miscelatore. g: gruppo del lavello (y = sopra il piano, +z = davanti);
 * zr: dove esce dal piano; sbalzo: quanto avanza la bocca (sopra il centro della vasca).
 */
function rubinetto(g, modello, finitura, zr, sbalzo) {
  const m = materialeRubinetto(finitura);
  const r = new THREE.Group(); r.position.set(0, 0, zr); g.add(r);
  const mesh = (geo, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; r.add(o); return o; };
  const tubo = (punti, raggio, seg = 80) => {
    const c = new THREE.CatmullRomCurve3(punti.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const o = new THREE.Mesh(new THREE.TubeGeometry(c, seg, raggio, 20, false), m); o.castShadow = true; r.add(o); return o;
  };
  if (modello === 'squadrato') {
    // squadrato moderno: corpo a parallelepipedo, canna a L con spigoli netti
    mesh(new THREE.BoxGeometry(56, 6, 56), 0, 3, 0);
    mesh(new THREE.BoxGeometry(38, 120, 38), 0, 66, 0);
    mesh(new THREE.BoxGeometry(26, 200, 26), 0, 226, -2);
    mesh(new THREE.BoxGeometry(26, 26, sbalzo + 13), 0, 326 - 13, sbalzo / 2 - 2);
    mesh(new THREE.BoxGeometry(26, 40, 26), 0, 313 - 30, sbalzo - 2);
    mesh(new THREE.BoxGeometry(18, 4, 18), 0, 261, sbalzo - 2);
    const leva = mesh(new THREE.BoxGeometry(70, 12, 14), 38 + 20, 112, 0); leva.rotation.z = 0.18;
    return;
  }
  // base tonda e corpo del miscelatore
  mesh(new THREE.CylinderGeometry(32, 34, 8, 40), 0, 4, 0);
  mesh(new THREE.CylinderGeometry(24, 25, 120, 40), 0, 68, 0);
  mesh(new THREE.SphereGeometry(24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0, 128, 0).scale.y = 0.35;
  // leva laterale (a destra), inclinata in su
  const lv = new THREE.Group(); lv.position.set(24, 92, 0); lv.rotation.z = 0.35; r.add(lv);
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 78, 20), m); asta.rotation.z = -Math.PI / 2; asta.position.x = 39; lv.add(asta);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 12), m); pomo.position.x = 78; lv.add(pomo);
  const anello = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 14, 24), m); anello.rotation.z = -Math.PI / 2; anello.position.x = 4; lv.add(anello);
  if (modello === 'molla') {
    // professionale: colonna, MOLLA, braccio con doccetta estraibile
    mesh(new THREE.CylinderGeometry(13, 13, 330, 28), 0, 128 + 165, 0);
    const giri = 15, y0 = 150, y1 = 400, pts = [];
    for (let i = 0; i <= giri * 24; i++) { const t = i / (giri * 24), th = t * giri * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * 27, y0 + (y1 - y0) * t, Math.sin(th) * 27)); }
    const molla = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), giri * 24, 3, 8, false), m); molla.castShadow = true; r.add(molla);
    tubo([[0, 455, 0], [0, 490, 25], [0, 495, 80], [0, 470, sbalzo * 0.85], [0, 420, sbalzo]], 10);
    const doccia = mesh(new THREE.CylinderGeometry(20, 17, 80, 28), 0, 380, sbalzo);
    mesh(new THREE.CylinderGeometry(16, 16, 3, 28), 0, 339, sbalzo);
    doccia.castShadow = true;
    // gancio che tiene la doccetta
    mesh(new THREE.BoxGeometry(10, 26, 40), 0, 400, sbalzo - 32);
    return;
  }
  // COLLO DI CIGNO: canna curva continua che sale e scende sopra la vasca
  tubo([[0, 128, 0], [0, 230, 0], [0, 320, 8], [0, 362, sbalzo * 0.35], [0, 352, sbalzo * 0.78], [0, 300, sbalzo], [0, 250, sbalzo]], 12);
  mesh(new THREE.CylinderGeometry(13, 12.5, 22, 28), 0, 246, sbalzo);          // rompigetto
  mesh(new THREE.CylinderGeometry(9.5, 9.5, 2, 24), 0, 234.5, sbalzo).material = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6 });
}

function aggiungiAccessorioTop(a, fin = {}) {
  const g = new THREE.Group();
  g.position.set(a.x, a.surfaceY, -a.y);
  g.rotation.y = -(a.rot || 0) * Math.PI / 180;
  if (a.id !== undefined) g.userData.mobId = a.id;
  if (a.placca) {
    // Piano a induzione in VETROCERAMICA: vetro nero lucido con le zone e i
    // comandi disegnati sul vetro (come quelli veri), riflessi dell'ambiente
    const { pw, pd } = dimPlacca(a.w, a.d, a.fuochi);
    const sopra = new THREE.MeshPhysicalMaterial({ map: texPiano(pw, pd, a.fuochi), color: 0xffffff, roughness: 0.12,
      metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.05, envMapIntensity: 0.28 });
    // vetro da 6 mm sopra il piano fino a 20 mm dentro il foro; sopra la texture
    const vetro = new THREE.Mesh(new THREE.BoxGeometry(pw, 26, pd),
      [matElVetro, matElVetro, sopra, matElVetro, matElVetro, matElVetro]);
    vetro.position.set(0, -7, 0); g.add(vetro);
    // bordo a filo in acciaio sottile ai lati (profilo del vetro)
    for (const sz of [-1, 1]) {
      const prof = new THREE.Mesh(new THREE.BoxGeometry(pw + 4, 7, 3), matElInox);
      prof.position.set(0, 2.5, sz * (pd / 2 + 1.5)); g.add(prof);
    }
  }
  if (a.lavello) {
    // Inox del bordo: chiaro e lucido. Interno della vasca: acciaio più scuro
    // e MENO riflettente, così non diventa un blocco bianco e il rettangolo che
    // scende si legge bene.
    // ACCIAIO INOX VERO: metalness alta + riflessione ambientale, non un grigio
    // piatto. Pareti lucide (riflettono il gradiente → danno profondità); fondo
    // un filo più opaco così non "sbianca" del tutto.
    // Interno SATINATO e non a specchio: se riflette l'ambiente chiaro (e i
    // LED dei pensili) diventa un rettangolo bianco piatto. In più le pareti
    // scuriscono verso il fondo (ombra dentro la vasca): così si legge che scende.
    // Lavello NERO: composito/granito opaco (non metallico)
    const nero = fin.lavello === 'nero';
    const matInox = nero
      ? new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.4 })
      : new THREE.MeshStandardMaterial({ color: 0xcbccd0, roughness: 0.25, metalness: 0.9, envMapIntensity: 0.8 });
    const matPar = nero
      ? new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.3, vertexColors: true })
      : new THREE.MeshStandardMaterial({ color: 0xb9bbc0, roughness: 0.45, metalness: 0.55, envMapIntensity: 0.4, vertexColors: true });
    const matFondo = nero
      ? new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.65, metalness: 0.05, envMapIntensity: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0x7d8086, roughness: 0.55, metalness: 0.5, envMapIntensity: 0.25 });
    const sfuma = (geo, h) => {                   // chiaro in alto → scuro in basso
      const p = geo.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const k = 0.32 + 0.68 * ((p.getY(i) + h / 2) / h); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    };
    const { vw, vd, zc } = dimVasca(a.w, a.d);
    const prof = 220, t = 12;                        // vasca profonda ~22 cm
    // Pareti della vasca: facce ESTERNE a filo del foro (vw×vd), scendono dal
    // piano fino a −prof. Scatola aperta sopra → si vede il pozzetto.
    for (const [px, pz, sw, sd] of [
      [0, zc - vd / 2 + t / 2, vw, t],              // parete davanti
      [0, zc + vd / 2 - t / 2, vw, t],              // parete dietro
      [-vw / 2 + t / 2, zc, t, vd - 2 * t],         // parete sinistra
      [vw / 2 - t / 2, zc, t, vd - 2 * t],          // parete destra
    ]) {
      const par = new THREE.Mesh(sfuma(new THREE.BoxGeometry(sw, prof, sd), prof), matPar);
      par.position.set(px, -prof / 2 - 1, pz);
      par.castShadow = true; par.receiveShadow = true; g.add(par);
    }
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(vw - 2 * t, t, vd - 2 * t), matFondo);
    fondo.position.set(0, -prof, zc); fondo.receiveShadow = true; g.add(fondo);
    // Bordo inox a filo attorno all'apertura (copre il taglio del top).
    const br = 14;
    for (const [px, pz, sw, sd] of [
      [0, zc - vd / 2 - br / 2, vw + 2 * br, br],
      [0, zc + vd / 2 + br / 2, vw + 2 * br, br],
      [-vw / 2 - br / 2, zc, br, vd],
      [vw / 2 + br / 2, zc, br, vd],
    ]) {
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(sw, 10, sd), matInox);
      c2.position.set(px, 3, pz); g.add(c2);
    }
    const scarico = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x2e2e32, roughness: 0.5, metalness: 0.6 }));
    scarico.position.set(0, -prof + 8, zc); g.add(scarico);
    // RUBINETTO (modello e finitura scelti): dietro la vasca, la bocca sopra il centro della vasca
    const zr = -a.d * 0.34;
    const n0 = g.children.length;
    rubinetto(g, fin.rubinettoModello || 'cigno', fin.rubinetto || 'cromo', zr, Math.max(150, Math.min(260, zc - zr)));
    // i pezzi del rubinetto: toccandoli si aprono per prime le sue opzioni (colore, modello)
    g.children.slice(n0).forEach((o) => o.traverse((x) => { x.userData.parte = 'rubinetto'; }));
  }
  // cosa si tocca: il rubinetto (sopra), se no il lavello o il piano cottura
  g.traverse((x) => { if (!x.userData.parte) x.userData.parte = a.lavello ? 'lavello' : 'placca'; });
  gruppo.add(g);
}

const COL = {
  // Carcassa e fronti di default in tono NEUTRO (niente oro/olivastro):
  // quando si sceglie un colore/legno le ante lo prendono, la cassa resta neutra.
  corpo:   0xb7b1a4,
  anta:    0xcac4b8,
  cassetto:0xc7c1b5,
  pensile: 0xb9b3a6,
  colonna: 0xb3ada0,
  regletta:0xbdb7aa,
  costado: 0xc0b9ac,
  top:     0x232323,
  muro:    0x3a362c,
  pav:     0xd7d0c4,
  oro:     0xc9a94a,
};
// Linee di contorno discrete (niente oro): un filo scuro che fa da fuga/ombra.
// contorni da disegno tecnico: in una foto vera non ci sono (le fughe tra le ante
// e le ombre di contatto bastano); restano solo sul mobile selezionato (bianchi)
const matOro = new THREE.LineBasicMaterial({ color: 0x3b3833, transparent: true, opacity: 0.55, visible: false });
const matManiglia = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.35, metalness: 0.6 });

// Materiali per gli elettrodomestici (forno / microonde / piano cottura):
// come quelli VERI. Acciaio SPAZZOLATO (righe sottili orizzontali, riflette
// l'ambiente), vetro NERO lucido (riflessi dell'ambiente e delle luci, come
// un vetro vero, non un nero piatto), display acceso, interno del forno che si
// intravede dietro il vetro. Le texture si disegnano qui (niente file).
function canvasTex(w, h, disegna, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  disegna(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texSpazzolato = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {                 // righe della spazzolatura
    const y = Math.random() * h, l = 40 + Math.random() * 260, x = Math.random() * w;
    const v = 170 + Math.floor(Math.random() * 70);
    g.strokeStyle = `rgba(${v},${v + 2},${v + 6},${0.18 + Math.random() * 0.25})`;
    g.lineWidth = Math.random() < 0.8 ? 1 : 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5)); g.stroke();
  }
});
texSpazzolato.wrapS = texSpazzolato.wrapT = THREE.RepeatWrapping;
// Spazzolatura FINE per le superfici grandi (sportello lavastoviglie): righe sottili e leggere
const texSpazzolatoFine = canvasTex(1024, 512, (g, w, h) => {
  g.fillStyle = '#d6d8dc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const y = Math.random() * h, l = 80 + Math.random() * 500, x = Math.random() * w;
    const v = 196 + Math.floor(Math.random() * 46);
    g.strokeStyle = `rgba(${v},${v + 1},${v + 4},${0.06 + Math.random() * 0.1})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5) * 0.6); g.stroke();
  }
});
texSpazzolatoFine.wrapS = texSpazzolatoFine.wrapT = THREE.RepeatWrapping;
const matElInox = new THREE.MeshStandardMaterial({ map: texSpazzolato, color: 0xffffff, roughness: 0.36, metalness: 0.78, envMapIntensity: 0.75 });
// Vetro nero lucido: quasi niente colore proprio, solo riflessi (clearcoat)
const matElVetro = new THREE.MeshPhysicalMaterial({ color: 0x060608, roughness: 0.18, metalness: 0.0,
  clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 0.4 });
const matElCorpo = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0f, roughness: 0.3, metalness: 0.1,
  clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.7 });
// Interno del forno visto attraverso il vetro scuro: cavità, griglie, ventola
const texCavita = canvasTex(512, 384, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h / 2, w * 0.62);
  gr.addColorStop(0, '#3a3430'); gr.addColorStop(0.55, '#1d1a19'); gr.addColorStop(1, '#070707');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(160,150,140,0.35)'; g.lineWidth = 2;   // guide laterali + griglia
  for (const y of [0.33, 0.55, 0.77]) { g.beginPath(); g.moveTo(w * 0.08, h * y); g.lineTo(w * 0.92, h * y); g.stroke(); }
  g.lineWidth = 1; g.strokeStyle = 'rgba(160,150,140,0.18)';
  for (let x = 0.12; x < 0.9; x += 0.04) { g.beginPath(); g.moveTo(w * x, h * 0.53); g.lineTo(w * x, h * 0.57); g.stroke(); }
  g.strokeStyle = 'rgba(120,112,105,0.35)'; g.lineWidth = 3;   // ventola sul fondo
  g.beginPath(); g.arc(w / 2, h * 0.45, h * 0.13, 0, Math.PI * 2); g.stroke();
});
const matElCavita = new THREE.MeshBasicMaterial({ map: texCavita, toneMapped: false });
// Display acceso (ora + simboli), non un rettangolo azzurro
const texDisplay = canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#050608'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8f6ff'; g.shadowColor = '#7fd4ff'; g.shadowBlur = 8;
  g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('12:00', w / 2, h / 2 + 2);
  g.font = '18px Arial, sans-serif'; g.fillStyle = '#ff9a3c'; g.shadowColor = '#ff9a3c';
  g.fillText('▲', 26, h / 2); g.fillText('▼', w - 26, h / 2);
});
const matElDisplay = new THREE.MeshBasicMaterial({ map: texDisplay, toneMapped: false });
matElDisplay.userData.fotoLuce = true;                    // foto realistica: display acceso
const matElButton = new THREE.MeshStandardMaterial({ map: texSpazzolato, color: 0xd8dade, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.8 });
// Vetro trasparente davanti alla finestra del forno (riflessi sopra la cavità)
const matElVetroTrasp = new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.28,
  roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.0, depthWrite: false });
matElVetroTrasp.userData.vetro = 'fume';                 // foto realistica: vetro fumé vero
// Piano cottura in VETROCERAMICA: zone disegnate sul vetro + comandi touch
function texPiano(pw, pd, fuochi) {
  const k = 2;
  return canvasTex(Math.round(pw * k), Math.round(pd * k), (g, w, h) => {
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, w, h);
    const pos = fuochi === 2 ? [[0.5, 0.3], [0.5, 0.66]] : [[0.27, 0.3], [0.73, 0.3], [0.27, 0.68], [0.73, 0.68]];
    const r = Math.min(w, h) * (fuochi === 2 ? 0.2 : 0.17);
    pos.forEach(([x, y], i) => {
      const rr = r * (i % 3 === 0 ? 1.08 : 0.9);
      g.strokeStyle = 'rgba(190,190,196,0.30)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(w * x, h * y, rr, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(190,190,196,0.12)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(w * x, h * y, rr * 0.62, 0, Math.PI * 2); g.stroke();
    });
    // striscia comandi touch davanti (in basso nella texture = verso la stanza)
    const yc = h * 0.91; g.fillStyle = 'rgba(190,190,196,0.38)';
    g.font = `${Math.round(h * 0.045)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    (fuochi === 2 ? ['−', '1', '3', '5', '7', '9', '+'] : ['−', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+']).forEach((t, i, a) => g.fillText(t, w * (0.22 + (0.56 * i) / (a.length - 1)), yc));
    g.beginPath(); g.arc(w * 0.1, yc, h * 0.022, 0, Math.PI * 2); g.lineWidth = 1.4; g.strokeStyle = 'rgba(190,190,196,0.38)'; g.stroke();
  });
}

// STANZA DEI RIFLESSI per i materiali LUCIDI (acciaio, vetro, cromo, lucidi, piani satinati):
// una stanza con finestre e pannelli di luce, come negli studi fotografici. Riflettendo una
// sfumatura sola il metallo sembrava plastica grigia e il vetro una lastra nera; così sembrano
// veri. Pareti, ante opache e legni restano con la luce di prima (scene.environment).
let _envLucidi = null;
function ambienteLucidi(rnd) {
  if (_envLucidi) return _envLucidi;
  const sc = new THREE.Scene();
  const base = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide });
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 14), base(0xbab5ad));
  stanza.position.y = 3.5; sc.add(stanza);
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0x55504a }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = 0.02; sc.add(pav);
  pav.material.color.set(0x77716a);
  const luce = (w, h, x, y, z, rx, ry, forza) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.985, 0.96).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); sc.add(m);
  };
  luce(5, 2.6, -1, 3.4, 6.98, 0, 0, 1.7);                // finestra grande alle spalle di chi guarda
  luce(3.2, 2.6, -6.98, 3.4, 1, 0, Math.PI / 2, 1.4);     // finestra sul lato
  luce(3, 1.1, -2.5, 6.98, 0, Math.PI / 2, 0, 2.4);       // pannelli di luce a soffitto
  luce(3, 1.1, 2.5, 6.98, 0, Math.PI / 2, 0, 2.4);
  luce(1.2, 5, 6.98, 3, -2, 0, -Math.PI / 2, 1.2);        // striscia chiara sull'altro lato
  const pm = new THREE.PMREMGenerator(rnd);
  _envLucidi = pm.fromScene(sc, 0.025).texture;
  pm.dispose();
  return _envLucidi;
}
/** I materiali lucidi della cucina riflettono la stanza dei riflessi (vedi ambienteLucidi). */
function riflettiStanza(radice, rnd) {
  const env = ambienteLucidi(rnd);
  radice.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.isMeshStandardMaterial || m.envMap === env) continue;
      const lucido = (m.metalness || 0) >= 0.45 || (m.clearcoat || 0) > 0 || (m.userData && (m.userData.fotoTop || m.userData.ngSpec || m.userData.vetro || m.userData.neroOpaco));
      if (!lucido) continue;
      m.envMap = env; m.needsUpdate = true;
    }
  });
}

// Ambiente IBL: gradiente (soffitto chiaro → pavimento scuro) per riflessi soft.
let _envGiorno = null, _envSera = null, _sfondoBase = null;
// ---------------------------------------------------------------------------
// LUCE ESTERNA (0 = notte, 1 = pieno giorno): quanta luce arriva da fuori. Di notte restano solo
// le lampade accese e i LED; le lampade si fanno più forti e l'alone più visibile (come all'occhio
// al buio). Si regola dal vivo con lo slider, senza rifare la scena.
// ---------------------------------------------------------------------------
const LUCE_NOTTE = [0.05, 0.05, 0, 0.03, 0.03];          // (un minimo: la luce che rimbalza in casa)          // emisfero, ambiente, sole, riempimento, controluce
const _envLuce = new Map();
export function luceEsternaDi(progetto) {
  const v = Number(progetto && progetto.luceEsterna);
  if (progetto && progetto.luceEsterna != null && Number.isFinite(v)) return Math.min(1, Math.max(0, v));
  return progetto && progetto.atmosfera === 'sera' ? 0.3 : 1;
}
function applicaLuceEsterna(v) {
  if (!scene || !renderer) return;
  luciAmbiente.forEach(({ l, base }, i) => { const m = LUCE_NOTTE[i] ?? 0.02; l.intensity = base * (m + (1 - m) * v); });
  if (!_envGiorno) _envGiorno = scene.environment;
  const q = Math.round(v * 20) / 20;
  if (q >= 1) scene.environment = _envGiorno;
  else {
    if (!_envLuce.has(q)) {
      // al massimo 3 ambienti in memoria oltre a quello del giorno
      if (_envLuce.size >= 3) { const [k, t] = _envLuce.entries().next().value; if (t !== scene.environment) { t.dispose(); _envLuce.delete(k); } }
      _envLuce.set(q, creaAmbiente(renderer, Math.max(0.04, q)));
    }
    scene.environment = _envLuce.get(q);
  }
  if (_sfondoBase) scene.background = _sfondoBase.clone().multiplyScalar(0.1 + 0.9 * v);
  const notte = 1 - v;
  if (gruppo) gruppo.traverse((o) => {
    if (o.userData.luceLampada) o.intensity = (6500 + 5500 * notte) * (+o.userData.luceLampada || 1);
    else if (o.userData.riverbero) o.intensity = 500 + 1100 * notte;
    else if (o.userData.alone && o.material) o.material.opacity = (o.userData.alone === 'lungo' ? 0.18 : 0.3) + 0.35 * notte;
  });
  if (renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
}
/** Slider «Luce esterna»: cambia la luce SUBITO (senza rifare la scena). v = 0 notte … 1 giorno. */
/** Colore delle luci SUBITO (mentre si trascina la barra), senza rifare la scena: { led, lampade } in Kelvin. */
export function impostaColoreLuci({ led = null, lampade = null } = {}) {
  if (!gruppo) return;
  const hL = led != null ? coloreKelvin(led) : null;
  if (lampade != null) impostaColoreLampade(lampade);
  gruppo.traverse((o) => {
    if (hL != null) {
      if (o.isMesh && o.userData.ledStriscia) { o.material.color.setHex(hL); o.userData.ledStriscia.colore = hL; }
      if (o.isLight && o.userData.ledLuce) o.color.setHex(hL);
    }
    if (lampade != null) {
      if (o.isLight && (o.userData.luceLampada || o.userData.riverbero)) o.color.setHex(_luceLampade);
      if (o.isSprite && o.userData.alone) o.material.color.setHex(_luceLampade);
      if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.userData && m.userData.acceso) m.emissive.setHex(_luceLampade);
    }
  });
  if (hL != null) impostaTintaLed(hL);
  if (resa) resa.cambiato();
}
export function impostaLuceEsterna(v) { applicaLuceEsterna(Math.min(1, Math.max(0, Number(v) || 0))); if (resa) resa.cambiato(); }
function creaAmbiente(rnd, forza = 1) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.0, '#eae4d6');
  grd.addColorStop(0.45, '#b7b0a0');
  grd.addColorStop(0.55, '#5a564c');
  grd.addColorStop(1.0, '#1a1a1a');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 64);
  // sera: lo stesso ambiente, più scuro (meno luce riflessa dappertutto)
  if (forza < 1) { x.fillStyle = `rgba(0,0,0,${1 - forza})`; x.fillRect(0, 0, 16, 64); }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(rnd);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

// ---------------------------------------------------------------------------
export function montaScena3d(canvas, progetto) {
  impostaUnitaUV(1000);                // UV in metri per i prodotti del catalogo (vedi uvInScala)
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(50, w / h, 10, 60000);
  // niente preserveDrawingBuffer: obbligava la scheda grafica a tenere una copia di ogni immagine
  // (pesante su Mac e iPhone). Le foto si leggono subito dopo il disegno, quindi non serve.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Pixel ratio limitato a 1.5: su schermi ad alta densità (retina/telefoni)
  // 2x significa 4× pixel da disegnare ogni frame → scatti. 1.5 è fluido e
  // resta nitido (l'export immagine usa un percorso separato ad alta qualità).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h, false);
  // se il telefono ferma la grafica (memoria), la pagina lo dice e propone "Riprova"
  canvas.addEventListener('webglcontextlost', () => window.dispatchEvent(new CustomEvent('ng-3d-perso')));
  canvas.addEventListener('webglcontextrestored', () => {
    // la grafica è tornata: rifaccio la luce d'ambiente (era nella memoria persa)
    try { _envLuce.clear(); scene.environment = _envGiorno = creaAmbiente(renderer); } catch (_) { /* niente */ }
    window.dispatchEvent(new CustomEvent('ng-3d-ripreso'));
  });
  // Resa più realistica: tone mapping cinematografico + colori sRGB
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Illuminazione d'ambiente (image-based) per riflessi e materiali reali
  scene.environment = creaAmbiente(renderer);

  // LUCE come in una stanza vera: una luce principale (finestra/soffitto) con
  // ombre morbide, il cielo/soffitto che illumina dall'alto e un filo di luce
  // riflessa dal lato opposto. Meno luce "piatta" uguale da tutte le parti:
  // ogni faccia ha la sua luce, come in una foto.
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x5a5040, 1.45);
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
  key.position.set(3000, 6000, 4000);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 3;
  luceOmbre = key;
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.8);
  fill.position.set(-4000, 3000, -2000);
  luceRiempi = fill;
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, 2000, -5000);
  scene.add(hemi); scene.add(amb); scene.add(key); scene.add(key.target); scene.add(fill); scene.add(rim);
  preparaOmbre(renderer);
  taraLuceCatalogo(renderer, scene);   // prodotti del catalogo: colori identici alla foto
  // Memorizzo le intensita' base per poterle abbassare quando i LED sono
  // accesi, cosi' la differenza "LED off / LED on" si vede davvero.
  luciAmbiente = [
    { l: hemi, base: 1.45 },
    { l: amb,  base: 0.35 },
    { l: key,  base: 2.6 },
    { l: fill, base: 0.8 },
    { l: rim,  base: 0.35 },
  ];

  controls = new OrbitControls(camera, renderer.domElement);
  nearSegueLaVista(camera, controls);              // profondità precisa: niente triangoli sui fondi
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;

  gruppo = new THREE.Group();
  scene.add(gruppo);
  aggiornaScena3d(progetto, true);

  resa = creaResa({ renderer, scene, camera, raggio: 280, intensita: 0.9, prima: muriVisibili, fuoriAO: () => _aloni.concat(vetriInScena()) });
  window.addEventListener('resize', forzaResize3d);
  animazioneAttiva = true;
  animate();
}

function animate() {
  if (!animazioneAttiva) return;
  requestAnimationFrame(animate);
  controls.update();
  // disegna solo quando serve; mentre si sposta un oggetto disegna leggero
  if (resa) resa.tick(!!spost); else renderer.render(scene, camera);
}
let resa = null, luceOmbre = null, luceRiempi = null;
/** Muri: si vedono quelli dietro i mobili, spariscono quelli tra te e la cucina. */
function muriVisibili() {
  if (!gruppo || !camera) return;
  for (const o of gruppo.children) {
    const n = o.userData.muroNormale;
    if (!n) continue;
    o.visible = (camera.position.x - o.position.x) * n.x + (camera.position.z - o.position.z) * n.z > -40;
  }
}
/** Quanto lavoro fa il disegno (per le prove): disegni, triangoli, luci accese, pixel. */
export function scenaPerProve() { return { scene, renderer, camera }; }
export function info3d(conta = false) {
  if (!renderer || !scene) return null;
  if (conta) { const ar = renderer.info.autoReset; renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera); renderer.info.autoReset = ar; }
  let luci = 0, spot = 0, punti = 0; scene.traverse((o) => { if (o.isLight && o.visible && !o.isAmbientLight && !o.isHemisphereLight) { luci++; if (o.isSpotLight) spot++; if (o.isPointLight) punti++; } });
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  return { calls: renderer.info.render.calls, tri: renderer.info.render.triangles, luci, spot, punti, prog: (renderer.info.programs || []).length, px: s.x * s.y };
}
/** Memoria della scheda grafica (per le prove): geometrie, texture, programmi. */
export function memoria3d() { return renderer ? { geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, prog: (renderer.info.programs || []).length } : null; }
/** Dove sta la vista (per le prove): distanza dal punto guardato e angolo attorno. */
export function vista3d() { return camera && controls ? { dist: Math.round(camera.position.distanceTo(controls.target)), az: +controls.getAzimuthalAngle().toFixed(3), on: controls.enabled } : null; }
export function guardaDa(px, py, pz, tx, ty, tz) {
  if (!camera || !controls) return;
  camera.position.set(px, py, -pz); controls.target.set(tx, ty, -tz); controls.update();
}

export function forzaResize3d() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (resa) { resa.dimensiona(); resa.cambiato(); } else renderer.setSize(w, h, false);
}

/**
 * FOTO: la vista 3D com'è (stessa resa realistica: luce, ombre, ombre di
 * contatto, legno identico alla foto) a grande risoluzione, in un istante.
 * opz: { larghezza, altezza } (lato lungo). Ritorna il canvas della foto.
 */
export async function fotoRealistica3d(opz = {}) {
  if (!renderer || !resa) return null;
  const lato = Math.max(opz.larghezza || 0, opz.altezza || 0) || latoMaxExport();
  return resa.foto(lato);
}

/** Salva l'immagine del rendering in ALTA QUALITÀ (PNG). */
export function esportaImmagine3d(nomeFile = 'cucina.png', latoMax = latoMaxExport()) {
  if (!renderer || !scene || !camera || !canvasEl) return false;
  const cw = canvasEl.clientWidth || canvasEl.width;
  const ch = canvasEl.clientHeight || canvasEl.height;
  const pr0 = renderer.getPixelRatio();
  const scala = Math.max(1, latoMax / Math.max(cw, ch));
  const tw = Math.round(cw * scala), th = Math.round(ch * scala);
  let canvas2d = null;
  if (resa) {
    try { canvas2d = componiConLogo(resa.foto(Math.max(tw, th))); } catch (e) { canvas2d = null; }
  } else {
    renderer.setPixelRatio(1);
    renderer.setSize(tw, th, false);
    camera.aspect = tw / th; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    try { canvas2d = componiConLogo(canvasEl); } catch (e) { canvas2d = null; }
    renderer.setPixelRatio(pr0);
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  if (!canvas2d) return false;
  return salvaImmagineCanvas(canvas2d, nomeFile);
}

const rayPick = new THREE.Raycaster();
/** Dato un punto schermo, ritorna l'id del mobile cliccato (o null). */
export function pickMobile(clientX, clientY) {
  if (!renderer || !camera || !gruppo) return null;
  const rect = canvasEl.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  rayPick.setFromCamera(mouse, camera);
  const hits = rayPick.intersectObjects(gruppo.children, true);
  _ultimaParte = null;
  for (const hit of hits) {
    if (hit.object.userData.portaleVano) continue;       // l'apertura del vano non copre gli oggetti dentro
    let o = hit.object;
    for (let x = o; x; x = x.parent) if (x.userData.parte) { _ultimaParte = x.userData.parte; break; }
    while (o && o.userData.mobId === undefined) o = o.parent;
    if (o && o.userData.mobId !== undefined) return o.userData.mobId;
  }
  return null;
}
/** Che parte del mobile si è toccata con l'ultimo pickMobile: 'lavello', 'rubinetto', 'placca', 'forno' o null. */
let _ultimaParte = null;
export function parteToccata() { return _ultimaParte; }

// ---------------------------------------------------------------------------
// SPOSTARE GLI OGGETTI NEL RENDERING (sgabelli, arredo): si trascinano sul
// pavimento. I moduli restano fissi (puoSpostare decide chi si muove).
let spost = null;            // { g, id, dx, dz, x0, z0 }
const spost0Y = new Map();   // altezza dell'oggetto quando lo si prende (spostato solo in su/giù = mosso)
const pianoTerra = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function puntoATerra(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  rayPick.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  const p = new THREE.Vector3();
  return rayPick.ray.intersectPlane(pianoTerra, p) ? p : null;
}
export function iniziaSpostamento(clientX, clientY, puoSpostare) {
  if (!renderer || !camera || !gruppo) return false;
  const id = pickMobile(clientX, clientY);
  if (id == null || !puoSpostare(id)) return false;
  const g = gruppo.children.find((o) => o.userData.mobId === id);
  if (!g) return false;
  const appoggio = !!g.userData.appoggiabile;
  // OGGETTI DEL CATALOGO (friggitrice…): si trascinano SULLE SUPERFICI. Il dito
  // indica il punto: se è sul piano l'oggetto ci sale, se è sul pavimento scende.
  // Gli sgabelli: piano orizzontale all'altezza del punto toccato (segue il dito).
  const hit = rayPick.intersectObject(g, true)[0];
  pianoTerra.constant = appoggio ? -g.position.y : (hit ? -hit.point.y : 0);
  const p = puntoATerra(clientX, clientY);
  if (!p) return false;
  // oggetti da appoggiare: lo scarto è tra il punto preso SULL'OGGETTO e il suo
  // centro (al massimo mezzo oggetto). Col piano all'altezza della base, da una
  // vista bassa il punto finiva lontano dietro e l'oggetto, portato su un altro
  // piano, cadeva davanti al mobile.
  if (appoggio && hit) { p.x = hit.point.x; p.z = hit.point.z; }
  spost0Y.set(id, g.position.y);
  spost = { g, id, dx: g.position.x - p.x, dz: g.position.z - p.z, x0: g.position.x, z0: g.position.z, appoggio,
    sup: appoggio ? superficiAppoggio() : null, portali: appoggio ? portaliVano() : [] };
  controls.enabled = false;
  canvasEl.style.cursor = 'grabbing';
  return true;
}
/** Aperture dei vani delle colonne (invisibili): puntando dentro il vano l'oggetto ci va. */
function portaliVano() {
  const out = [];
  if (gruppo) gruppo.traverse((o) => { if (o.isMesh && o.userData.portaleVano) out.push(o); });
  return out;
}
/** Punto indicato dal dito sulle superfici d'appoggio o, se non ce ne sono, sul pavimento. */
function puntoSuSuperfici(clientX, clientY, sup, portali = []) {
  const rect = canvasEl.getBoundingClientRect();
  rayPick.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  // Conta la PRIMA cosa che si vede sotto il dito: un piano d'appoggio, il vano
  // di una colonna o il pavimento. Se è un muro o un'anta l'oggetto resta dov'è
  // (prima finiva sul pavimento DIETRO il muro).
  const visibile = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const dentroOggetto = (o) => { for (let q = o; q; q = q.parent) if (spost && q === spost.g) return true; return false; };
  for (const hit of rayPick.intersectObjects(gruppo ? gruppo.children : [], true)) {
    const o = hit.object;
    if (!o.isMesh || dentroOggetto(o)) continue;
    if (o.userData.portaleVano) {
      // dentro il vano della colonna: a metà profondità (poi si appoggia sul ripiano)
      const n = new THREE.Vector3(0, 0, -1).transformDirection(o.matrixWorld);
      const q = hit.point.clone().addScaledVector(n, o.userData.portaleVano.profondita / 2);
      q.vano = true; q.daY = hit.point.y + 5;               // il ripiano sotto il dito (mobili aperti con più ripiani)
      return q;
    }
    if (o.userData.ripianoAperto) { const q = hit.point.clone(); q.daSup = true; return q; }   // ripiano (anche invisibile)
    if (!visibile(o)) continue;                              // muri nascosti, aperture: non contano
    if (o.userData.appoggio || sup.includes(o)) { const q = hit.point.clone(); q.daSup = true; return q; }
    if (hit.point.y < 5) return hit.point;                   // pavimento
    return null;                                             // muro, anta, fianco: resta dov'è
  }
  const pav = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p = new THREE.Vector3();
  return rayPick.ray.intersectPlane(pav, p) ? p : null;
}
export function muoviSpostamento(clientX, clientY) {
  if (!spost) return;
  const p = spost.appoggio ? puntoSuSuperfici(clientX, clientY, spost.sup, spost.portali) : puntoATerra(clientX, clientY);
  if (!p) return;
  // vista radente (verso l'orizzonte): pochi pixel = metri → ignoro i punti troppo lontani
  const dCam = camera.position.distanceTo(controls.target);
  if (p.distanceTo(camera.position) > dCam * 2.5) return;
  if (p.vano) {
    // puntato dentro il vano di una colonna: l'oggetto va lì subito, sul ripiano
    // (centrato e girato bene quando lo lasci)
    const g = spost.g;
    g.position.x = p.x; g.position.z = p.z;
    g.position.y = quotaPiani(p.x, p.z, spost.sup, p.daY);
    return;
  }
  // movimento morbido: al massimo 15 cm per volta, così l'oggetto non "salta"
  let nx = p.x + spost.dx - spost.g.position.x, nz = p.z + spost.dz - spost.g.position.z;
  const L = Math.hypot(nx, nz), MAX = spost.appoggio ? 400 : 150;
  if (L > MAX) { nx *= MAX / L; nz *= MAX / L; }
  spost.g.position.x += nx;
  spost.g.position.z += nz;
  if (spost.appoggio) {
    // sale sul piano se ci sta sopra, se no a terra (come quando lo lasci)
    const g = spost.g, m = { x: g.position.x, y: -g.position.z };
    // puntando una superficie (piano, tavolo, ripiano): quella, non la più alta che c'è sopra
    // (sotto un pensile aperto l'oggetto resta sul piano di lavoro); sul pavimento: come prima
    g.position.y = p.daSup ? quotaPiani(g.position.x, g.position.z, spost.sup, p.y + 40)
      : Math.max(quotaPiani(g.position.x, g.position.z, spost.sup.filter((o) => !o.userData.ripianoAperto)), _lastProgetto ? quotaAppoggio(_lastProgetto, m, _spTop) : 0);
  }
}
/** Fine: ritorna { id, x, y, mosso } in coordinate della pianta (mm). */
export function fineSpostamento() {
  if (!spost) return null;
  const { g, id, x0, z0, sup } = spost;
  spost = null;
  controls.enabled = true;
  canvasEl.style.cursor = '';
  const mosso = Math.hypot(g.position.x - x0, g.position.z - z0) > 5 || Math.abs(g.position.y - (spost0Y.get(id) ?? g.position.y)) > 5;
  // lasciato su un RIPIANO di un mobile aperto: se ne ricorda l'altezza (sennò andrebbe sul più alto)
  let quota = null;
  if (sup && sup.length) {
    rayGiu.set(new THREE.Vector3(g.position.x, g.position.y + 40, g.position.z), new THREE.Vector3(0, -1, 0));
    const hit = rayGiu.intersectObjects(sup, false)[0];
    if (hit && hit.object.userData.ripianoAperto && Math.abs(hit.point.y - g.position.y) < 30) quota = Math.round(hit.point.y);
  }
  return { id, x: Math.round(g.position.x), y: Math.round(-g.position.z), mosso, quota };
}

// ---------------------------------------------------------------------------
// Primitive
function corpo(w, h, d, coloreOMat) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = (coloreOMat && coloreOMat.isMaterial)
    ? coloreOMat
    : new THREE.MeshStandardMaterial({ color: coloreOMat, roughness: 0.7, metalness: 0.05 });
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro));
  return g;
}

/** Pannello (anta/cassetto) sporgente sul fronte locale (+Z). */
// Carcassa della colonna a FRONTE APERTO (schiena + fianchi + top + fondo,
// SENZA faccia frontale): serve per il "vano aperto", dove si deve vedere
// dentro. Le porte (dove ci sono) coprono comunque il fronte.
function carcassaColonna(w, h, d, coloreOMat, conTop = true) {
  const g = new THREE.Group();
  const t = 18;
  const mat = (coloreOMat && coloreOMat.isMaterial) ? coloreOMat
    : new THREE.MeshStandardMaterial({ color: coloreOMat, roughness: 0.7, metalness: 0.05 });
  const panel = (pw, ph, pd, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  };
  panel(w, h, t, 0, 0, -d / 2 + t / 2);           // schiena
  panel(t, h, d, -w / 2 + t / 2, 0, 0);           // fianco sx
  panel(t, h, d,  w / 2 - t / 2, 0, 0);           // fianco dx
  if (conTop) panel(w - 2 * t, t, d, 0,  h / 2 - t / 2, 0);   // top
  panel(w - 2 * t, t, d, 0, -h / 2 + t / 2, 0);   // fondo
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), matOro));
  return g;
}

// --- VETRINA ---------------------------------------------------------------
const MAT_VETRO = {
  trasparente: new THREE.MeshStandardMaterial({ color: 0xe4f0ef, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, depthWrite: false }),
  satinato: new THREE.MeshStandardMaterial({ color: 0xf3f5f4, transparent: true, opacity: 0.92, roughness: 0.92, metalness: 0, depthWrite: false }),
  fume: new THREE.MeshStandardMaterial({ color: 0x2b2d30, transparent: true, opacity: 0.62, roughness: 0.12, metalness: 0.1, depthWrite: false }),
};
for (const k of Object.keys(MAT_VETRO)) MAT_VETRO[k].userData.vetro = k;   // foto realistica: vetro vero
const MAT_TELAIO = {
  alluminio: new THREE.MeshStandardMaterial({ color: 0xc2c5c9, roughness: 0.38, metalness: 0.85 }),
  nero: new THREE.MeshStandardMaterial({ color: 0x1c1c1d, roughness: 0.45, metalness: 0.4 }),
};
/** Telaio legno 50 mm (come le ante) o profilo alluminio/nero 22 mm, con il vetro dentro. */
function antaVetro(g, px, py, z, pw, ph, matAnta, v) {
  const legno = (v.telaio || 'legno') === 'legno';
  const F = Math.min(legno ? 50 : 22, pw / 3, ph / 3), sp = 20;
  const matT = legno ? ((matAnta && matAnta.isMaterial) ? matAnta : new THREE.MeshStandardMaterial({ color: (matAnta || COL.anta), roughness: 0.6, metalness: 0.08 }))
    : (MAT_TELAIO[v.telaio] || MAT_TELAIO.alluminio);
  const pezzo = (bw, bh, x, y) => {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, sp), matT);
    ms.position.set(x, y, z + sp / 2); ms.castShadow = true; g.add(ms);
  };
  pezzo(pw, F, px, py + ph / 2 - F / 2);
  pezzo(pw, F, px, py - ph / 2 + F / 2);
  pezzo(F, ph - 2 * F, px - pw / 2 + F / 2, py);
  pezzo(F, ph - 2 * F, px + pw / 2 - F / 2, py);
  const vetro = new THREE.Mesh(new THREE.BoxGeometry(pw - 2 * F + 4, ph - 2 * F + 4, 4), MAT_VETRO[v.vetro] || MAT_VETRO.trasparente);
  vetro.position.set(px, py, z + sp / 2); vetro.renderOrder = 2; g.add(vetro);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, ph, sp)), matOro);
  e.position.set(px, py, z + sp / 2); g.add(e);
  fughe(g, px, py, z, pw, ph, sp);
}
/** Cassa aperta davanti (si vede dal vetro) con i suoi ripiani. */
function carcassaVetrina(w, h, d, coloreCorpo, nRip) {
  const g = carcassaColonna(w, h, d, coloreCorpo);
  const t = 18, mat = new THREE.MeshStandardMaterial({ color: coloreCorpo, roughness: 0.7, metalness: 0.05 });
  for (let k = 1; k <= nRip; k++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * t, t, d - t - 25), mat);
    r.position.set(0, -h / 2 + t + (h - 2 * t) * k / (nRip + 1), (t + 25) / 2 - 25 + 12);
    r.castShadow = true; r.receiveShadow = true; g.add(r);
  }
  return g;
}

// FUGHE tra le ante (sono vere, 2–3 mm): da lontano sono più sottili di un pixel e il 3D le
// disegnerebbe "a pezzi". Allora: una RIGA scura netta sul bordo di ogni fronte (una linea è
// sempre larga almeno un pixel, quindi resta continua a qualunque distanza) e un FONDO scuro
// dietro l'anta, che si vede solo dentro la fuga (da vicino si vede l'ombra, non la cassa chiara).
// (un pelo meno marcate: si capisce che c'è la fuga, senza la riga nera evidente)
const matFugaLinea = new THREE.LineBasicMaterial({ color: 0x2c2925, transparent: true, opacity: 0.4 });
const matFugaFondo = new THREE.MeshBasicMaterial({ color: 0x24211d });
function fughe(g, px, py, z, pw, ph, sp = 20) {
  const x0 = px - pw / 2, x1 = px + pw / 2, y0 = py - ph / 2, y1 = py + ph / 2, zf = z + sp + 0.4;
  const v = [[x0, y0], [x1, y0], [x1, y0], [x1, y1], [x1, y1], [x0, y1], [x0, y1], [x0, y0]].map(([x, y]) => new THREE.Vector3(x, y, zf));
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(v), matFugaLinea); l.userData.fuga = true; g.add(l);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(pw + FUGA_W, ph + FUGA_H), matFugaFondo); f.position.set(px, py, z + 0.6); f.userData.fondoFuga = true; g.add(f);
}
function pannello(g, px, py, z, pw, ph, mat) {
  // Anta: uso direttamente il materiale (legno con texture o tinta piena),
  // così la venatura compare su tutte le facce dell'anta.
  const materiale = (mat && mat.isMaterial)
    ? mat
    : new THREE.MeshStandardMaterial({ color: (mat || COL.anta), roughness: 0.6, metalness: 0.08 });
  const box = new THREE.BoxGeometry(pw, ph, 20);
  const mesh = new THREE.Mesh(box, materiale);
  mesh.position.set(px, py, z + 10);
  g.add(mesh);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), matOro);
  e.position.copy(mesh.position);
  g.add(e);
  fughe(g, px, py, z, pw, ph);
}

// Maniglia scelta per categoria (catalogo): progetto.maniglie = { base, pensile, colonna }
let _maniglia = null;
let _manByCat = {};
let _reRenderMan = null;
function manigliaCat(cat) {
  const g = cat === 'pensile' ? 'pensile' : (cat === 'colonna' || cat === 'altillo') ? 'colonna' : 'base';
  const id = _manByCat[g];
  return id ? MATERIALI.find((m) => m.id === id && m.categoria === 'maniglia') || null : null;
}
// MANIGLIA IN 3D VERA (anche quella da foto): barra con il suo spessore,
// staccata dall'anta da due piedini → di lato ha volume, luce sotto e ombra,
// non è un adesivo piatto. Davanti la foto vera (sagoma e colori), lati e
// piedini nel colore della maniglia (metallo se è grigia/nera/acciaio).
const _matLatiMan = new Map();
function materialeLatiManiglia(def) {
  if (_matLatiMan.has(def.id)) return _matLatiMan.get(def.id);
  const c = new THREE.Color(def.colore ?? 0x9a9a9a);
  const hsl = {}; c.getHSL(hsl);
  const metallo = hsl.s < 0.18;                      // grigio, nero, acciaio, oro scuro…
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: metallo ? 0.32 : 0.5,
    metalness: metallo ? 0.75 : 0.15, envMapIntensity: metallo ? 0.9 : 0.4 });
  _matLatiMan.set(def.id, m);
  return m;
}
const SPORGENZA_MAN = 28;                            // distanza barra–anta (mm)
function barraManiglia(g, x, y, z, w, h, D, matFronte, matLati, ruota, sporg = SPORGENZA_MAN) {
  // w×h = barra vista di fronte (come la foto); i piedini sul lato lungo;
  // sporg = distanza barra–anta (dalle viste di lato/sopra se ci sono)
  const SPORGENZA_MAN = sporg;
  const grp = new THREE.Group();
  const barra = new THREE.Mesh(new THREE.BoxGeometry(w, h, D),
    [matLati, matLati, matLati, matLati, matFronte || matLati, matLati]);
  barra.position.set(0, 0, SPORGENZA_MAN + D / 2);
  barra.castShadow = true; barra.receiveShadow = true; grp.add(barra);
  const lungo = Math.max(w, h), corto = Math.min(w, h);
  const r = Math.max(3, Math.min(corto * 0.32, 6));
  const d = Math.max(lungo / 2 - Math.max(corto * 0.9, 10), lungo * 0.25);
  for (const s of [-d, d]) {
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(r, r, SPORGENZA_MAN, 16), matLati);
    pied.rotation.x = Math.PI / 2;
    pied.position.set(w >= h ? s : 0, w >= h ? 0 : s, SPORGENZA_MAN / 2);
    pied.castShadow = true; grp.add(pied);
  }
  grp.position.set(x, y, z + 20);                    // 20 = faccia davanti dell'anta
  if (ruota) grp.rotation.z = Math.PI / 2;
  g.add(grp);
}
/** Forma della maniglia del catalogo (barra, piatta, profilo, bordo, pomolo, incasso). */
function formaManiglia() { return (_maniglia && _maniglia.texture && _maniglia.lunghezzaMm) ? (_maniglia.forma || 'barra') : 'barra'; }
/** giu = il bordo dell'anta è SOTTO (pensili aperti dal basso): profilo/bordo girati. */
function maniglia(g, x, y, z, orizz, lung, giu = false, max = Infinity) {
  if (_push) return;                      // PUSH: la porta si apre premendo, niente maniglia
  const def = _maniglia;
  // TIRATORE GRANDE: mai più lungo della porta (es. colonna con il forno: prima la barra lunga
  // passava sopra il forno). Più lungo dell'anta → lungo come l'anta, 4 cm dentro ai bordi.
  const Lcat = def && def.lunghezzaMm ? Math.max(20, Math.min(def.lunghezzaMm, max - 80)) : 0;
  // "La mia forma" (o maniglie salvate prima della scelta della forma): 3D dalle foto
  if (def && def.texture && def.lunghezzaMm && (def.forma === 'foto' || !def.formaV)) {
    // MANIGLIA DALLE FOTO (davanti, + sopra/lato se ci sono): 3D reale ricostruito dalle viste
    const r = manigliaDaFoto(def, _reRenderMan);
    if (r) {
      const mesh = new THREE.Mesh(r.geo, r.mat); mesh.castShadow = true; mesh.receiveShadow = true;
      const grp = new THREE.Group(); grp.add(mesh);
      grp.position.set(x, y, z + 20);
      if (!orizz) grp.rotation.z = Math.PI / 2;
      else if (giu) grp.rotation.z = Math.PI;
      g.add(grp);
      return;
    }
  }
  if (def && def.texture && def.lunghezzaMm) {
    // MANIGLIA DEL CATALOGO: modello 3D vero del suo tipo, misura e finitura reali
    const grp = costruisciManiglia(!def.forma || def.forma === 'foto' ? 'barra' : def.forma, def.finitura, Lcat, def.colore);
    grp.position.set(x, y, z + 20);                    // 20 = faccia davanti dell'anta
    if (!orizz) grp.rotation.z = Math.PI / 2;
    else if (giu) grp.rotation.z = Math.PI;
    g.add(grp);
    return;
  }
  // maniglia standard: barra in acciaio con i suoi piedini
  barraManiglia(g, x, y, z, orizz ? lung : 12, orizz ? 12 : lung, 12, null, matManiglia, false);
}

// Finger-pull: quando attivo, invece della maniglia si disegna una GOLA scura
// a filo del bordo (in alto su ante/cassetti, a tutta altezza sulle colonne).
// Il flag è impostato a ogni render da progetto.fingerPull.
let _fingerPull = false;
let _fpByCat = {};
// PUSH (si preme e si apre): niente maniglia né gola, per categoria { base, pensile, colonna }
let _push = false;
let _pushByCat = {};
function pushCat(cat) {
  const key = cat === 'base' ? 'base' : cat === 'pensile' ? 'pensile' : (cat === 'colonna' || cat === 'altillo') ? 'colonna' : null;
  return !!(key && _pushByCat && _pushByCat[key]);
}
// Finger-pull per categoria: progetto.fingerPull può essere un oggetto
// { base, pensile, colonna } oppure (vecchio) un booleano = vale per tutto.
function fpCat(fp, cat) {
  const key = cat === 'base' ? 'base' : cat === 'pensile' ? 'pensile' : (cat === 'colonna' || cat === 'altillo') ? 'colonna' : null;
  if (!key) return false;
  if (fp === true) return true;
  return !!(fp && typeof fp === 'object' && fp[key]);
}
// Canale finger-pull: una scanalatura RIENTRANTE (stesso colore del fronte,
// arretrata → in ombra), con una riga d'ombra nel punto più profondo. Come
// nella realtà: il fronte è accorciato e in cima/di lato c'è il canale.
// La faccia del fronte è a z+20; il fondo del canale è arretrato a z+6.
const matCanaleOmbra = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 1.0, metalness: 0 });
function canaleFingerPull(g, cx, cy, z, length, thick, orizz, matAnta, giu = false) {
  const L = Math.max(40, length);
  // Finger-pull da foto: la gola ha il suo materiale (es. nero), la porta il suo
  const mat = (matAnta && matAnta.userData && matAnta.userData.matGola) ? matAnta.userData.matGola
    : (matAnta && matAnta.isMaterial) ? matAnta
    : new THREE.MeshStandardMaterial({ color: matAnta || COL.anta, roughness: 0.6, metalness: 0.08 });
  // Fondo del canale, arretrato rispetto alla faccia (recessed).
  const backGeo = orizz ? new THREE.BoxGeometry(L, thick, 10) : new THREE.BoxGeometry(thick, L, 10);
  const back = new THREE.Mesh(backGeo, mat);
  back.position.set(cx, cy, z + 6);
  back.castShadow = true; back.receiveShadow = true;
  g.add(back);
  // Riga d'ombra sottile nel punto più profondo del canale (dove entra il dito).
  const sLen = orizz ? L : 8;
  const sTh = orizz ? 8 : L;
  const shadow = new THREE.Mesh(new THREE.BoxGeometry(sLen, sTh, 6), matCanaleOmbra);
  // gola in basso (pensili): la parte profonda è sotto, dove entra il dito
  shadow.position.set(orizz ? cx : cx + thick / 2 - 4, orizz ? (giu ? cy - thick / 2 + 4 : cy + thick / 2 - 4) : cy, z + 9);
  g.add(shadow);
}

// Telaio inox (4 lati) con la faccia frontale al piano frontZ.
function telaioInox(grp, pw, ph, frontZ, fb, frameD) {
  for (const [fx, fy, fw, fh] of [
    [0, ph / 2 - fb / 2, pw, fb],
    [0, -ph / 2 + fb / 2, pw, fb],
    [-pw / 2 + fb / 2, 0, fb, ph - 2 * fb],
    [pw / 2 - fb / 2, 0, fb, ph - 2 * fb],
  ]) {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, frameD), matElInox);
    fr.position.set(fx, fy, frontZ - frameD / 2);
    fr.castShadow = true; grp.add(fr);
  }
}

/**
 * Fronte del mobile FORNO (come in una cucina vera): in alto la GRIGLIA di
 * aerazione sotto il piano, poi il forno (alto 595 mm), sotto un PANNELLO del
 * colore delle ante che chiude lo spazio rimasto (più alto nei moduli da 80
 * che in quelli da 70). Niente parti del corpo a vista sopra e sotto.
 */
const GRIGLIA_FORNO = 45, H_FORNO_INCASSO = 595;
function fronteForno(g, w, h, d, matAnta) {
  const z = d / 2, uw = w - FUGA_W;
  const yTop = h / 2 - FUGA_H / 2, yBot = -h / 2 + FUGA_H / 2;
  const hF = Math.min(H_FORNO_INCASSO, h - GRIGLIA_FORNO - 40);
  griglia(g, z, uw, GRIGLIA_FORNO, yTop - GRIGLIA_FORNO / 2);
  const yFornoTop = yTop - GRIGLIA_FORNO - GAP_ANTE;
  pannelloElettro(g, yFornoTop - hF / 2, z, Math.min(w - 24, 595), hF, 'forno');
  const yPan = yFornoTop - hF - GAP_ANTE;
  if (yPan - yBot > 15) pannello(g, 0, (yPan + yBot) / 2, z, uw, yPan - yBot, matAnta || COL.cassetto);
}
/** Griglia di aerazione: cornice scura, fessure nere profonde e lamelle
 *  chiare in rilievo (si legge come una griglia vera anche da lontano). */
const matGrigliaFondo = new THREE.MeshBasicMaterial({ color: 0x050506, toneMapped: false });
const matGrigliaCornice = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.5, metalness: 0.4 });
const matGrigliaLamella = new THREE.MeshStandardMaterial({ color: 0xa9abb1, roughness: 0.35, metalness: 0.6, envMapIntensity: 0.6 });
function griglia(g, z, gw, gh, yc) {
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 4), matGrigliaFondo);
  fondo.position.set(0, yc, z + 2); g.add(fondo);
  const cb = 7;
  for (const [bx, by, bw, bh] of [[0, yc + gh / 2 - cb / 2, gw, cb], [0, yc - gh / 2 + cb / 2, gw, cb], [-gw / 2 + cb / 2, yc, cb, gh], [gw / 2 - cb / 2, yc, cb, gh]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 18), matGrigliaCornice);
    c.position.set(bx, by, z + 9); g.add(c);
  }
  // lamelle verticali: 6 mm piene, 8 mm di fessura
  const passo = 14, n = Math.floor((gw - 2 * cb - 8) / passo);
  const lam = new THREE.InstancedMesh(new THREE.BoxGeometry(6, gh - 2 * cb, 14), matGrigliaLamella, n);
  const M = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { M.makeTranslation(-((n - 1) * passo) / 2 + i * passo, yc, z + 7); lam.setMatrixAt(i, M); }
  lam.instanceMatrix.needsUpdate = true;
  g.add(lam);
}

// ---------------------------------------------------------------------------
// FORNO in 3 versioni (come i forni veri): INOX (pannello comandi in acciaio
// spazzolato, 3 manopole, porta in vetro nero, maniglia a barra in acciaio),
// NERO (tutto vetro nero, 2 manopole con anello cromato, display, maniglia
// nera), BIANCO (vetro bianco, 2 manopole bianche, display nero, finestra
// grande con l'interno chiaro, maniglia in acciaio). Niente riflessi
// "stampati": i riflessi li fanno le luci della scena sul vetro.
// ---------------------------------------------------------------------------
let _stileForno = 'inox';
const matVetroBianco = new THREE.MeshPhysicalMaterial({ color: 0xf1f1ef, roughness: 0.15, metalness: 0,
  clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 0.6 });
const matNeroOpaco = new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.9 });
matNeroOpaco.userData.neroOpaco = true;
const matCromo = new THREE.MeshStandardMaterial({ color: 0xe6e8ec, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.1 });
const matManopolaBianca = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.35, metalness: 0.0 });
// Interno chiaro del forno bianco: smalto grigio chiaro, guide e griglia
const texCavitaChiara = canvasTex(512, 384, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#d9dadb'); gr.addColorStop(1, '#b9babc');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(w * 0.12, h * 0.1, w * 0.76, h * 0.8);   // fondo della cavità
  g.strokeStyle = 'rgba(120,122,126,0.9)'; g.lineWidth = 3;
  for (const x of [0.06, 0.94]) for (const y of [0.25, 0.4, 0.55, 0.7]) { g.beginPath(); g.moveTo(w * x - 14, h * y); g.lineTo(w * x + 14, h * y); g.stroke(); }
  g.lineWidth = 3; g.strokeStyle = 'rgba(150,152,156,0.95)';                  // griglia
  g.beginPath(); g.moveTo(w * 0.08, h * 0.42); g.lineTo(w * 0.92, h * 0.42); g.stroke();
  g.lineWidth = 1.5; for (let x = 0.1; x < 0.92; x += 0.035) { g.beginPath(); g.moveTo(w * x, h * 0.4); g.lineTo(w * x, h * 0.44); g.stroke(); }
  g.fillStyle = 'rgba(140,142,146,0.7)'; g.fillRect(w * 0.1, h * 0.74, w * 0.8, h * 0.05);   // teglia
});
const matCavitaChiara = new THREE.MeshBasicMaterial({ map: texCavitaChiara, toneMapped: false });
// Display (ora/temperatura) e simboli attorno alle manopole: texture disegnate
function texDisplayForno(stile) {
  return canvasTex(256, 72, (g, w, h) => {
    g.fillStyle = '#040405'; g.fillRect(0, 0, w, h);
    const col = stile === 'bianco' ? '#ff4a3a' : '#f2f2f2';
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 6; g.textBaseline = 'middle';
    if (stile === 'nero') {
      g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'left';
      g.fillText('01:00', 62, h / 2); g.fillText('200°', 168, h / 2);
      g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(14, 16, 34, 40);       // icona ventola
      g.beginPath(); g.arc(31, 36, 9, 0, Math.PI * 2); g.stroke();
    } else {
      g.font = 'bold 34px Arial, sans-serif'; g.textAlign = 'center';
      g.fillText('02:00', w / 2, h / 2 - 6);
      g.font = '12px Arial, sans-serif'; g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText('⏲      −      +      △', w / 2, h - 12);
    }
  });
}
const _texDisplay = {};
function simboliManopola(stile) {
  const col = stile === 'bianco' ? 'rgba(60,60,64,0.85)' : 'rgba(235,235,240,0.85)';
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {                       // tacche attorno alla manopola
      const an = -Math.PI * 0.85 + (i / 8) * Math.PI * 1.7 - Math.PI / 2;
      const r1 = 50, r2 = i % 2 ? 55 : 59;
      g.beginPath(); g.moveTo(w / 2 + Math.cos(an) * r1, h / 2 + Math.sin(an) * r1);
      g.lineTo(w / 2 + Math.cos(an) * r2, h / 2 + Math.sin(an) * r2); g.stroke();
    }
  });
}
const _texSimboli = {};

function fornoVero(grp, pw, ph, Z0, stile) {
  const st = ['inox', 'nero', 'bianco'].includes(stile) ? stile : 'inox';
  const box = (w, h, d, x, y, zFront, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, w), Math.max(2, h), d), mat);
    m.position.set(x, y, zFront - d / 2); m.castShadow = true; grp.add(m); return m;
  };
  const piano = (w, h, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); grp.add(m); return m;
  };
  const panH = Math.min(ph * 0.19, 112);                 // pannello comandi
  const baseH = Math.min(ph * 0.035, 22);                // fascia sotto la porta
  const doorH = ph - panH - baseH;
  const yPan = ph / 2 - panH / 2, yDoor = -ph / 2 + baseH + doorH / 2;
  const matPan = st === 'inox' ? matElInox : st === 'nero' ? matElVetro : matVetroBianco;
  const matPorta = st === 'bianco' ? matVetroBianco : matElVetro;
  // corpo/telaio dietro (bordo sottile tutto intorno)
  box(pw, ph, 8, 0, 0, Z0 - 2, st === 'bianco' ? matVetroBianco : matNeroOpaco);
  // PANNELLO COMANDI
  box(pw - 4, panH - 4, 10, 0, yPan, Z0 + 8, matPan);
  // display (nero e bianco)
  if (st !== 'inox') {
    if (!_texDisplay[st]) { _texDisplay[st] = new THREE.MeshBasicMaterial({ map: texDisplayForno(st), toneMapped: false }); _texDisplay[st].userData.fotoLuce = true; }
    const dw = pw * (st === 'nero' ? 0.26 : 0.3), dh = panH * (st === 'nero' ? 0.36 : 0.62);
    piano(dw, dh, 0, yPan + (st === 'nero' ? panH * 0.08 : panH * 0.04), Z0 + 8.6, _texDisplay[st]);
  }
  // MANOPOLE
  if (!_texSimboli[st]) _texSimboli[st] = new THREE.MeshBasicMaterial({ map: simboliManopola(st), transparent: true, toneMapped: false, depthWrite: false });
  const rK = Math.min(panH * 0.27, 25);
  const xs = st === 'inox' ? [-pw * 0.33, 0, pw * 0.33] : [-pw * 0.36, pw * 0.36];
  for (const kx of xs) {
    piano(rK * 2.7, rK * 2.7, kx, yPan, Z0 + 8.4, _texSimboli[st]);
    const corpoK = new THREE.Mesh(new THREE.CylinderGeometry(rK, rK * 1.02, 20, 40),
      st === 'bianco' ? matManopolaBianca : matNeroOpaco);
    corpoK.rotation.x = Math.PI / 2; corpoK.position.set(kx, yPan, Z0 + 18); corpoK.castShadow = true; grp.add(corpoK);
    // anello cromato (inox e nero) e cappello
    if (st !== 'bianco') {
      const anello = new THREE.Mesh(new THREE.TorusGeometry(rK * 0.92, 2.2, 10, 48), st === 'inox' ? matElInox : matCromo);
      anello.position.set(kx, yPan, Z0 + 28.5); grp.add(anello);
    }
    const capp = new THREE.Mesh(new THREE.CylinderGeometry(rK * 0.82, rK * 0.82, 2, 40),
      st === 'inox' ? matElInox : st === 'nero' ? matNeroOpaco : matManopolaBianca);
    capp.rotation.x = Math.PI / 2; capp.position.set(kx, yPan, Z0 + 28.5); grp.add(capp);
    const tacca = new THREE.Mesh(new THREE.BoxGeometry(3, rK * 0.8, 3), st === 'bianco' ? matNeroOpaco : matCromo);
    tacca.position.set(kx, yPan + rK * 0.4, Z0 + 30); grp.add(tacca);
  }
  if (st === 'inox') {                                   // spia rossa
    const spia = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    spia.material.userData.fotoLuce = true;
    spia.position.set(pw * 0.33 - rK * 1.9, yPan + rK * 0.55, Z0 + 8.6); grp.add(spia);
  }
  // PORTA: vetro (nero o bianco) a tutta larghezza
  box(pw - 4, doorH - 4, 16, 0, yDoor, Z0 + 14, matPorta);
  // FINESTRA: interno del forno visto attraverso il vetro
  const winW = pw * (st === 'bianco' ? 0.8 : 0.74), winH = doorH * (st === 'bianco' ? 0.68 : 0.6);
  const yWin = yDoor - doorH * 0.07;
  if (st === 'bianco') {
    box(winW + 16, winH + 16, 1, 0, yWin, Z0 + 14.4, matNeroOpaco);           // bordo scuro della finestra
    piano(winW, winH, 0, yWin, Z0 + 14.6, matCavitaChiara);
  } else {
    piano(winW, winH, 0, yWin, Z0 + 14.3, matElCavita);
  }
  piano(winW, winH, 0, yWin, Z0 + 14.9, matElVetroTrasp);                     // vetro sopra: riflessi
  // MANIGLIA a barra in alto sulla porta
  const yBar = yDoor + doorH / 2 - Math.min(doorH * 0.1, 46), barL = pw * 0.84;
  if (st === 'nero') {
    box(barL, 16, 22, 0, yBar, Z0 + 46, matNeroOpaco);                       // barra nera piatta
    for (const sx of [-barL / 2 + 24, barL / 2 - 24]) box(14, 12, 24, sx, yBar, Z0 + 26, matNeroOpaco);
  } else {
    const barra = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, barL, 28), matElInox);
    barra.rotation.z = Math.PI / 2; barra.position.set(0, yBar, Z0 + 46); barra.castShadow = true; grp.add(barra);
    for (const sx of [-barL / 2 + 12, barL / 2 - 12]) {
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 34, 16), matElInox);
      sup.rotation.x = Math.PI / 2; sup.position.set(sx, yBar, Z0 + 30); grp.add(sup);
    }
  }
  // fascia in basso (sotto la porta)
  box(pw - 4, baseH - 2, 10, 0, -ph / 2 + baseH / 2, Z0 + 6, st === 'bianco' ? matVetroBianco : matNeroOpaco);
}

// MICROONDE in 3 versioni, abbinato al forno: INOX (cornice d'incasso e
// sportello in acciaio spazzolato, finestra scura, colonna comandi con
// display, tasti e manopola), NERO (tutto vetro nero uniforme, finestra con
// profilo argento, display, icone touch, manopola con anello cromato),
// BIANCO (cornice e sportello bianchi, finestra scura, display rosso).
const texIconeTouch = canvasTex(128, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(235,235,240,0.85)'; g.fillStyle = 'rgba(235,235,240,0.85)'; g.lineWidth = 3;
  const c = [[0.3, 0.17], [0.7, 0.17], [0.3, 0.5], [0.7, 0.5], [0.3, 0.83], [0.7, 0.83]];
  g.beginPath(); g.arc(w * c[0][0], h * c[0][1], 11, 0, Math.PI * 2); g.stroke();
  g.beginPath(); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; g.moveTo(w * c[1][0], h * c[1][1]); g.lineTo(w * c[1][0] + Math.cos(an) * 12, h * c[1][1] + Math.sin(an) * 12); } g.stroke();
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(w * c[2][0] - 12, h * c[2][1] + i * 7); g.lineTo(w * c[2][0] + 12, h * c[2][1] + i * 7); g.stroke(); }
  g.beginPath(); for (let x = -12; x <= 12; x += 2) g.lineTo(w * c[3][0] + x, h * c[3][1] + Math.sin(x / 2.5) * 4); g.stroke();
  g.beginPath(); g.moveTo(w * c[4][0], h * c[4][1] - 11); g.lineTo(w * c[4][0] + 11, h * c[4][1]); g.lineTo(w * c[4][0], h * c[4][1] + 11); g.lineTo(w * c[4][0] - 11, h * c[4][1]); g.closePath(); g.stroke();
  g.beginPath(); g.arc(w * c[5][0], h * c[5][1], 10, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(w * c[5][0], h * c[5][1], 4, 0, Math.PI * 2); g.fill();
});
const matIconeTouch = new THREE.MeshBasicMaterial({ map: texIconeTouch, transparent: true, toneMapped: false, depthWrite: false });
function texDisplayMicro(col) {
  return canvasTex(160, 64, (g, w, h) => {
    g.fillStyle = '#040405'; g.fillRect(0, 0, w, h);
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 6;
    g.font = 'bold 34px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(col === '#ff4a3a' ? '00:00' : '00:35', w / 2, h / 2 + 2);
  });
}
const _matDisplayMicro = {};

function microondeVero(grp, pw, ph, Z0, stile) {
  const st = ['inox', 'nero', 'bianco'].includes(stile) ? stile : 'inox';
  const box = (w, h, d, x, y, zFront, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, w), Math.max(2, h), d), mat);
    m.position.set(x, y, zFront - d / 2); m.castShadow = true; grp.add(m); return m;
  };
  const piano = (w, h, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); grp.add(m); return m;
  };
  const matF = st === 'inox' ? matElInox : st === 'nero' ? matElVetro : matVetroBianco;
  // CORNICE d'incasso (tutto il vano) + fessura scura attorno allo sportello
  const cb = st === 'nero' ? 0 : Math.min(ph * 0.1, 40);
  box(pw, ph, 8, 0, 0, Z0 + 2, matF);
  if (cb) box(pw - 2 * cb, ph - 2 * cb, 1, 0, 0, Z0 + 2.4, matNeroOpaco);
  // SPORTELLO (finestra a sinistra) + COLONNA COMANDI (a destra)
  const iw = pw - 2 * cb - 8, ih = ph - 2 * cb - 8;
  const colW = Math.min(iw * 0.24, 120);
  const porW = iw - colW - 4;
  const xPor = -iw / 2 + porW / 2, xCol = iw / 2 - colW / 2;
  box(porW, ih, 12, xPor, 0, Z0 + 12, matF);
  box(colW, ih, 12, xCol, 0, Z0 + 12, matF);
  // finestra scura (con profilo argento nel nero)
  const ww = porW * 0.8, wh = ih * 0.76;
  piano(ww, wh, xPor, 0, Z0 + 12.4, matElCavita);
  if (st === 'nero') {
    for (const [x, y, w, h] of [[0, wh / 2 + 3, ww + 8, 2.5], [0, -wh / 2 - 3, ww + 8, 2.5], [-ww / 2 - 3, 0, 2.5, wh + 8], [ww / 2 + 3, 0, 2.5, wh + 8]]) {
      box(w, h, 2, xPor + x, y, Z0 + 13.4, matCromo);
    }
  }
  piano(ww, wh, xPor, 0, Z0 + 12.9, matElVetroTrasp);
  // display
  const dc = st === 'bianco' ? '#ff4a3a' : st === 'nero' ? '#6fd7ff' : '#9fe0ff';
  if (!_matDisplayMicro[st]) { _matDisplayMicro[st] = new THREE.MeshBasicMaterial({ map: texDisplayMicro(dc), toneMapped: false }); _matDisplayMicro[st].userData.fotoLuce = true; }
  const dW = colW * 0.7, dH = dW * 0.4;
  piano(dW, dH, xCol, ih / 2 - ih * 0.15, Z0 + 12.6, _matDisplayMicro[st]);
  // tasti (inox, bianco) o icone touch (nero)
  if (st === 'nero') {
    piano(colW * 0.7, colW * 1.05, xCol, ih * 0.07, Z0 + 12.6, matIconeTouch);
  } else {
    const matT = st === 'bianco' ? matManopolaBianca : matElButton;
    for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(colW * 0.2, ih * 0.035, 4), matT);
      t.position.set(xCol + c * colW * 0.26, ih * 0.16 - r * ih * 0.085, Z0 + 14); grp.add(t);
    }
  }
  // manopola
  const rK = Math.min(colW * 0.22, 22), yK = -ih * 0.24;
  const k = new THREE.Mesh(new THREE.CylinderGeometry(rK, rK, 16, 36), st === 'bianco' ? matManopolaBianca : st === 'nero' ? matNeroOpaco : matElButton);
  k.rotation.x = Math.PI / 2; k.position.set(xCol, yK, Z0 + 20); grp.add(k);
  if (st !== 'bianco') {
    const an = new THREE.Mesh(new THREE.TorusGeometry(rK * 0.95, 2, 10, 40), matCromo);
    an.position.set(xCol, yK, Z0 + 28); grp.add(an);
  }
  // tasto apertura in basso
  box(colW * 0.62, ih * 0.09, 4, xCol, -ih / 2 + ih * 0.09, Z0 + 14, st === 'nero' ? matElInox : st === 'bianco' ? matManopolaBianca : matElButton);
}

/**
 * Elettrodomestico da incasso REALE (forno / microonde).
 * IMPORTANTE: il mobile che lo contiene è una scatola PIENA con la faccia a
 * z = Zf; quindi TUTTO l'elettrodomestico va costruito DAVANTI a Zf (sporgente),
 * altrimenti il corpo chiaro del mobile lo copre. Il vetro scuro è la parte
 * dominante; telaio inox, comandi e maniglia sporgono ancora di più.
 */
function pannelloElettro(g, py, z, pw, ph, tipo) {
  const grp = new THREE.Group();
  grp.position.set(0, py, 0);
  const Z0 = z + 3;   // fronte del vetro: 3 mm DAVANTI alla faccia del mobile
  // box con la FACCIA FRONTALE al piano zFront.
  const box = (w, h, d, x, y, zFront, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, w), Math.max(2, h), d), mat);
    m.position.set(x, y, zFront - d / 2);
    m.castShadow = true; grp.add(m); return m;
  };

  if (tipo === 'forno') {
    fornoVero(grp, pw, ph, Z0, _stileForno);
  } else {
    microondeVero(grp, pw, ph, Z0, _stileForno);
  }
  // toccando il forno / il microonde si aprono per prime le loro opzioni (colore)
  grp.traverse((o) => { o.userData.parte = 'forno'; });
  g.add(grp);
}

// ---------------------------------------------------------------------------
// Fronti per categoria. Corpo centrato nell'origine: x[-w/2,w/2] y[-h/2,h/2] z[-d/2,d/2]
// Fughe reali delle ante: in LARGHEZZA si toglie 3 mm totali (1,5 per lato),
// in ALTEZZA 2 mm (1 sopra, 1 sotto). GAP = fuga fra due ante/cassetti.
// (valori dai ⚙ Parametri della falegnameria: si rileggono a ogni aggiornamento della scena)
let FUGA_W = 3, FUGA_H = 2, GAP_ANTE = 3, FUGA_CASS = 2, SP_J = 2;
function leggiParametriAnte() {
  const P = parametri();
  FUGA_W = P.ante.ariaLarghezza; FUGA_H = P.ante.ariaAltezza; GAP_ANTE = P.ante.ariaTraAnte; FUGA_CASS = P.ante.ariaCassetti; SP_J = P.manigliaJ.spessore;
}
/** Maniglia a J (profilo sopra l'anta) su questo fronte? → di quanto si accorcia (mm). */
function riduzioneJ() {
  if (_fingerPull || _push || !['profilo', 'bordol'].includes(formaManiglia())) return 0;
  return Number(_maniglia && _maniglia.spessoreJ) > 0 ? Number(_maniglia.spessoreJ) : SP_J;
}
// Maniglia ORIZZONTALE su un'anta (bassi e pensili): vicino al bordo alto
// sui bassi, vicino al bordo basso sui pensili, spostata verso il lato che
// apre (anta singola) o verso il centro (due ante). Le colonne restano verticali.
function lungManiglia(standard) {
  return (_maniglia && _maniglia.texture && _maniglia.lunghezzaMm) ? _maniglia.lunghezzaMm : standard;
}
function manigliaOrizzAnta(g, px, py, pw, ph, z, verso, inAlto) {
  const L = lungManiglia(Math.min(pw * 0.5, 320));
  const off = verso ? Math.max(0, pw / 2 - L / 2 - 40) : 0;   // verso il lato che apre (0 = centrata)
  // profilo / a bordo: attaccati al bordo dell'anta; le altre a 45 mm dal bordo
  const aBordo = ['profilo', 'bordo', 'bordol'].includes(formaManiglia());
  const dB = formaManiglia() === 'bordol' ? 0 : aBordo ? 17 : 45;     // profilo sul bordo: proprio sul bordo
  const y = inAlto ? py + ph / 2 - dB : py - ph / 2 + dB;
  maniglia(g, px + verso * off, y, z, true, Math.min(pw * 0.5, 320), !inAlto, pw);
}
let _anteInBasso = false;    // pensili: maniglia vicino al bordo basso
let _coloreCorpoCol = null;  // colore dell'interno della colonna che si sta costruendo (ripiani dietro il vetro)
let _vetrina = null;         // ante a vetro del mobile che si sta costruendo ({ telaio, vetro })
function ante(g, w, h, d, n, matAnta, sporg, lato) {
  const z = d / 2;
  const uw = w - FUGA_W;
  const pw = (uw - (n - 1) * GAP_ANTE) / n;
  // sporgente: anta = h + 20 che avanza 2 cm SOTTO (bordo alto a filo).
  const ph = sporg ? (h + 20) : (h - FUGA_H);
  const py = sporg ? -10 : 0;
  // Anta singola: la maniglia (= lato di apertura) va a destra di default,
  // a sinistra se l'utente lo sceglie (antaLato = 'sx').
  const sx = lato === 'sx';
  const suAlto = lato === 'alto' && n === 1;     // apertura VERSO L'ALTO: maniglia orizzontale al centro, sul bordo basso
  for (let i = 0; i < n; i++) {
    const px = -uw / 2 + pw / 2 + i * (pw + GAP_ANTE);
    // Anta sporgente sotto (gola integrata): si apre da sotto, niente maniglia.
    if (_vetrina) {
      // ANTA VETRINA: telaio (legno come le ante, alluminio o nero) + vetro
      antaVetro(g, px, py, z, pw, ph, matAnta, _vetrina);
      if (!sporg && !_fingerPull) {
        const verso = n === 1 ? (sx ? -1 : 1) : (i === 0 ? 1 : -1);
        manigliaOrizzAnta(g, px, py, pw, ph, z, verso, !_anteInBasso);
      }
    } else if (!sporg && _fingerPull) {
      // canale in alto nei mobili bassi; nei PENSILI in basso, rivolto verso il basso
      const CH = 30, giu = _anteInBasso;
      pannello(g, px, py + (giu ? CH / 2 : -CH / 2), z, pw, Math.max(60, ph - CH), matAnta || COL.anta);
      canaleFingerPull(g, px, giu ? py - ph / 2 + CH / 2 : py + ph / 2 - CH / 2, z, pw, CH, true, matAnta, giu);
    } else {
      // MANIGLIA A J: il profilo sta sul bordo dell'anta (in alto sui bassi, in basso sui pensili)
      // e l'anta si accorcia del suo spessore (⚙ Parametri), proprio come in distinta
      const rJ = sporg ? 0 : riduzioneJ(), inAlto = suAlto ? false : !_anteInBasso;
      const phJ = ph - rJ, pyJ = py + (inAlto ? -rJ / 2 : rJ / 2);
      pannello(g, px, pyJ, z, pw, phJ, matAnta || COL.anta);
      if (!sporg) {
        // verso: +1 = maniglia verso destra, −1 = verso sinistra
        const verso = suAlto ? 0 : n === 1 ? (sx ? -1 : 1) : (i === 0 ? 1 : -1);
        manigliaOrizzAnta(g, px, pyJ, pw, phJ, z, verso, inAlto);
      }
    }
  }
}
function cassetti(g, w, h, d, n, matAnta, piccolo = null) {
  const z = d / 2;
  const pushPrima = _push; _push = false;        // i CASSETTI non hanno mai il push: maniglia (o finger-pull)
  // Fughe da 2 mm, una in più dei cassetti; frontali tutti uguali oppure uno
  // piccolo in alto e gli altri uguali (stessa regola della distinta)
  const uw = w - FUGA_W, FC = FUGA_CASS;
  const alt = frontiCassetti(h, n, piccolo);       // dall'alto in basso
  const rJ = riduzioneJ();                        // maniglia a J: ogni frontale si accorcia in alto
  let yTop = h / 2 - FC;
  for (let i = 0; i < alt.length; i++) {
    const ph = alt[i] - rJ;
    const py = yTop - rJ - ph / 2;
    yTop -= alt[i] + FC;
    if (_fingerPull) {
      const CH = Math.min(26, ph * 0.35);
      pannello(g, 0, py - CH / 2, z, uw, Math.max(40, ph - CH), matAnta || COL.cassetto);
      canaleFingerPull(g, 0, py + ph / 2 - CH / 2, z, uw, CH, true, matAnta);
    } else {
      pannello(g, 0, py, z, uw, ph, matAnta || COL.cassetto);
      // profilo sul bordo: proprio sul bordo alto del frontale; le altre un po' sotto
      const dBc = formaManiglia() === 'bordol' ? 0 : Math.min(28, ph * 0.3);
      maniglia(g, 0, py + ph / 2 - dBc, z, true, Math.min(uw * 0.5, 320), false, uw);
    }
  }
  _push = pushPrima;
}
// Numero di fuochi in base alla larghezza del mobile: piccolo → 2, grande → 4.
function fuochiPerLarghezza(w) { return w < 600 ? 2 : 4; }

/** L'anta del pensile sporge 2 cm sotto? Dipende dall'opzione e dall'altezza. */
function antaPensileSporge(opt, h) {
  if (opt === 'sporg70') return Math.abs(h - 700) < 40;
  if (opt === 'sporg90') return Math.abs(h - 900) < 40;
  return false;
}

function pianoCottura(g, w, h, d, fuochi = 4) {
  const yTop = h / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 20, 20, d - 20),
    new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.4, metalness: 0.2 }));
  slab.position.set(0, yTop + 10, 0); g.add(slab);
  const pos = fuochi === 2
    ? [[-1, 0], [1, 0]]
    : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const r = Math.min(w, d) * (fuochi === 2 ? 0.16 : 0.14);
  for (const [sx, sz] of pos) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 8, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x33333a, metalness: 0.4, roughness: 0.5 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(sx * w * 0.22, yTop + 22, sz * d * 0.18); g.add(ring);
  }
}
function lavelloTop(g, w, h, d) {
  const z = d / 2, yTop = h / 2;
  const vasca = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 60, d * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.3, metalness: 0.5 }));
  vasca.position.set(0, yTop - 20, 0); g.add(vasca);
  const rub = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 180, 10),
    new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.3, metalness: 0.6 }));
  rub.position.set(0, yTop + 90, -d * 0.28); g.add(rub);
}
let _progColonne = null;     // progetto corrente (porta bassa delle colonne = bassi)
// INTERNO DEGLI ARMADI (struttura): bianco o antracite, scelto nel pannello del 3D
const COLORI_INTERNO = { bianco: 0xecebe6, antracite: 0x3a3b3e };
let _coloreInterno = COLORI_INTERNO.bianco;
const _matInterno = new THREE.MeshStandardMaterial({ color: COLORI_INTERNO.bianco, roughness: 0.75, metalness: 0 });
function colonnaFronte(g, w, h, d, m, matAnta) {
  const z = d / 2;
  const pw = w - FUGA_W;
  // porta bassa alta come i mobili bassi (70 o 80): tutta la parte bassa allineata
  const ab = _progColonne ? portaBassaColonna(_progColonne, m) : (m.altezzaBassa_mm || 700);
  const bottom = -h / 2;
  // OGNI PORTA della colonna: porta normale o finger-pull, maniglia o push, verso
  // sinistra / destra / alto. Di partenza come il gruppo colonne e il lato della colonna.
  const scelte = (chiave) => {
    const o = (m && m.porte && m.porte[chiave]) || {};
    return { fp: o.fp != null ? !!o.fp : _fingerPull, push: o.push != null ? !!o.push : _push,
      lato: o.lato || (m && m.antaLato === 'sx' ? 'sx' : 'dx'), vetro: o.vetro || null };
  };
  const porta = (yB, segH, chiave = 'alta') => {
    const cyc = yB + segH / 2;
    const ph = segH - FUGA_H;
    const c = scelte(chiave), s = c.lato === 'sx' ? -1 : 1, alto = c.lato === 'alto';
    const pushPrima = _push; _push = c.push;
    if (c.vetro) {
      // PORTA IN VETRO (vetrina): telaio + vetro, e dietro i RIPIANI della colonna (la cassa è aperta)
      antaVetro(g, 0, cyc, z, pw, ph, matAnta, c.vetro);
      if (alto) manigliaOrizzAnta(g, 0, cyc, pw, ph, z, 0, false);
      else maniglia(g, s * (pw / 2 - 30), cyc, z, false, Math.min(260, ph * 0.4), false, ph);
      const t = 18, nR = Math.max(1, Math.round(segH / 380) - 1);
      const matR = new THREE.MeshStandardMaterial({ color: _coloreCorpoCol != null && !(_coloreCorpoCol && _coloreCorpoCol.isMaterial) ? _coloreCorpoCol : COL.corpo || 0xe8e4dc, roughness: 0.7, metalness: 0.05 });
      for (let k = 1; k <= nR; k++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * t, t, d - t - 25), matR);
        r.position.set(0, yB + (segH * k) / (nR + 1), (t + 25) / 2 - 25 + 12);
        r.castShadow = true; r.receiveShadow = true; g.add(r);
      }
    } else if (c.fp && alto) {
      const CH = 30;                                 // canale orizzontale sul bordo basso (si apre verso l'alto)
      pannello(g, 0, cyc + CH / 2, z, pw, ph - CH, matAnta || COL.anta);
      canaleFingerPull(g, 0, cyc - ph / 2 + CH / 2, z, pw, CH, true, matAnta, true);
    } else if (c.fp) {
      const CW = 30;                                 // larghezza del canale (dal lato della maniglia)
      pannello(g, -s * CW / 2, cyc, z, pw - CW, ph, matAnta || COL.anta);
      canaleFingerPull(g, s * (pw / 2 - CW / 2), cyc, z, ph, CW, false, matAnta);
    } else {
      pannello(g, 0, cyc, z, pw, ph, matAnta || COL.anta);
      if (alto) manigliaOrizzAnta(g, 0, cyc, pw, ph, z, 0, false);
      else maniglia(g, s * (pw / 2 - 30), cyc, z, false, Math.min(260, ph * 0.4), false, ph);
    }
    _push = pushPrima;
  };
  porta(bottom, ab, 'bassa');        // porta bassa
  let y0 = bottom + ab;
  const rem = h - ab;
  if (m.variante === 'forno') {
    const ho = Math.min(H_FORNO, rem - 300);
    pannelloElettro(g, y0 + ho / 2, z, pw, ho - 10, 'forno');
    porta(y0 + ho, rem - ho);
  } else if (m.variante === 'microonde') {
    const ho = Math.min(H_MICRO, rem - 300);
    pannelloElettro(g, y0 + ho / 2, z, pw, ho - 10, 'microonde');
    porta(y0 + ho, rem - ho);
  } else if (m.variante === 'forno-micro') {
    // Porta bassa → forno → microonde → porta nello spazio che avanza.
    const hf = Math.max(200, Math.min(H_FORNO, rem - H_MICRO - 250));
    pannelloElettro(g, y0 + hf / 2, z, pw, hf - 10, 'forno');
    const hm = Math.max(150, Math.min(H_MICRO, rem - hf - 200));
    pannelloElettro(g, y0 + hf + hm / 2, z, pw, hm - 10, 'microonde');
    const top = rem - hf - hm;
    if (top > 60) porta(y0 + hf + hm, top);
  } else if (m.variante === 'vano') {
    // Porta bassa → ripiano → vano aperto (a vista) → ripiano → porta alta.
    // CORNICE nel colore delle ANTE (come in falegnameria): ripiano sotto e sopra, due fianchetti
    // dentro e due listelli sul bordo dei fianchi; dietro la schiena del colore interno. La struttura
    // bianca non si vede. Misure come in distinta (pezziCorniceVano).
    const vanoH = altezzaVanoColonna(m, rem);
    const sp = spFiancoColonna(m), Li = w - 2 * sp, mA = matAnta || COL.anta, T = 18;
    const pezzo = (bw, bh, bd, x, y, zc, mat) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      me.position.set(x, y, zc); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
    };
    const pd = d - T - 2, pz = -d / 2 + T + pd / 2 + 1;                     // dalla schiena al filo davanti
    pezzo(Li - 2 * T, vanoH - 2 * T, 3, 0, y0 + vanoH / 2, -d / 2 + T + 2.5, _matInterno);   // schiena (interno)
    const fondoVano = pezzo(Li, T, pd, 0, y0 + T / 2, pz, mA);            // ripiano sotto il vano
    fondoVano.userData.appoggio = true;       // ci si appoggiano gli oggetti (microonde, macchina del caffè…)
    pezzo(Li, T, pd, 0, y0 + vanoH - T / 2, pz, mA);                      // ripiano sopra il vano
    for (const sx of [-1, 1]) {
      pezzo(T, vanoH - 2 * T, pd, sx * (Li / 2 - T / 2), y0 + vanoH / 2, pz, mA);   // fianchetti
      pezzo(sp, vanoH, T, sx * (w / 2 - sp / 2), y0 + vanoH / 2, d / 2 + T / 2, mA); // listelli sul bordo dei fianchi
    }
    // apertura del vano (invisibile): trascinando un oggetto e puntando nel vano, ci va dentro
    const portale = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(10, Li - 2 * T), Math.max(10, vanoH - 2 * T)),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    portale.position.set(0, y0 + vanoH / 2, d / 2);
    portale.visible = false;
    portale.userData.portaleVano = { profondita: d - 60 };
    g.add(portale);
    const topH = rem - vanoH;
    if (topH > 60) porta(y0 + vanoH, topH);   // porta alta (il vano resta aperto)
  } else {
    porta(y0, rem);                  // porta unica a tutta altezza
  }
}

/** Lavastoviglie a incasso: anta unica + striscia comandi inox in alto. */
/**
 * Fronte LAVASTOVIGLIE a vista: sportello in ACCIAIO INOX con fascia comandi
 * NERA in alto (schermo + spie) e maniglia a barra — stile Bosch/Siemens.
 * Costruito DAVANTI alla faccia del mobile (Z0) per non essere coperto.
 */
let _matLavastBianco = null;
function lavastoviglieFronte(g, w, h, d, colore = 'acciaio') {
  const z = d / 2, Z0 = z + 2;
  // nera = stesso nero satinato del frigo; bianca; se no acciaio satinato
  const matInox = colore === 'nero' ? COLORI_FRIGO.nero.porta
    : colore === 'bianco' ? (_matLavastBianco || (_matLavastBianco = new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.3, metalness: 0.04, envMapIntensity: 0.9 })))
      : new THREE.MeshStandardMaterial({ map: texSpazzolatoFine, color: 0xffffff, roughness: 0.34, metalness: 0.88, envMapIntensity: 1.6 });
  const box = (bw, bh, bd, x, y, zFront, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, bw), Math.max(2, bh), bd), mat);
    m.position.set(x, y, zFront - bd / 2); m.castShadow = true; g.add(m); return m;
  };
  // Sportello inox (tutto il fronte)
  box(w - 6, h - 6, 6, 0, 0, Z0, matInox);
  // Fascia comandi NERA in alto (schermo nero) — unlit, sempre nera
  const hStrip = Math.min(h * 0.11, 64);
  const topY = h / 2 - 6 - hStrip / 2;
  box(w - 12, hStrip, 4, 0, topY, Z0 + 2, matElCorpo);
  // Display + spie
  box((w - 12) * 0.2, hStrip * 0.42, 3, -(w - 12) * 0.18, topY, Z0 + 4, matElDisplay);
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 10), matElButton);
    led.rotation.x = Math.PI / 2;
    led.position.set((w - 12) * 0.05 + i * 16, topY, Z0 + 4); g.add(led);
  }
  if (colore === 'nero' || colore === 'bianco') {
    // NERA / BIANCA: niente barra, maniglia INCASSATA nella fascia comandi (come le libere moderne)
    box((w - 12) * 0.28, hStrip * 0.5, 3, (w - 12) * 0.08, topY - hStrip * 0.05, Z0 + 1, matFrigoFuga);
    return;
  }
  // Maniglia a barra inox sotto la fascia
  const barL = Math.min(w * 0.55, 420), barY = topY - hStrip / 2 - 16;
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, barL, 14), matInox);
  barra.rotation.z = Math.PI / 2; barra.position.set(0, barY, Z0 + 12); g.add(barra);
  for (const sx of [-barL / 2 + 8, barL / 2 - 8]) {
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 28, 12), matInox);
    sup.rotation.x = Math.PI / 2; sup.position.set(sx, barY, Z0 + 2); g.add(sup);
  }
}

/**
 * FRIGO LIBERO (combinato): corpo bianco laccato, porta frigo in alto e porta
 * congelatore in basso, con la fuga in mezzo e le maniglie incassate sul lato.
 */
// COLORI DEL FRIGO: bianco, nero (cristallo/acciaio nero) e acciaio inox spazzolato
const COLORI_FRIGO = {
  bianco:  { porta: new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.28, metalness: 0.04, envMapIntensity: 0.8 }),
             fianco: new THREE.MeshStandardMaterial({ color: 0xeaeae6, roughness: 0.4, metalness: 0.04 }),
             maniglia: new THREE.MeshStandardMaterial({ color: 0xc9cbcf, roughness: 0.3, metalness: 0.8 }) },
  // nero OPACO come i frigo neri veri: antracite molto scuro, riflesso morbido (non nero pianoforte)
  nero:    { porta: new THREE.MeshPhysicalMaterial({ color: 0x28292c, roughness: 0.55, metalness: 0.1, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 1.0 }),
             fianco: new THREE.MeshStandardMaterial({ color: 0x252629, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 }),
             maniglia: new THREE.MeshStandardMaterial({ color: 0x6d6f74, roughness: 0.3, metalness: 0.85 }),
             fuga: new THREE.MeshBasicMaterial({ color: 0x050505 }) },
  acciaio: { porta: matElInox,
             fianco: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.35, metalness: 0.6 }),
             maniglia: new THREE.MeshStandardMaterial({ color: 0xd9dbde, roughness: 0.25, metalness: 0.9 }) },
};
const matFrigoFuga = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.7, metalness: 0.1 });
/**
 * FRIGO LIBERO MODERNO (combinato): porte piatte, frigo in alto e congelatore
 * in basso con la fuga in mezzo, maniglie verticali sottili sul bordo.
 * colore: 'bianco' | 'nero' | 'acciaio'.
 */
function frigoLibero(g, w, h, d, colore, maniglia = 'incassata') {
  const C = COLORI_FRIGO[colore] || COLORI_FRIGO.bianco;
  const box = (bw, bh, bd, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, bw), Math.max(2, bh), Math.max(2, bd)), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const sp = 45;                                          // spessore delle porte
  box(w - 4, h - 4, d - sp, 0, 0, -sp / 2, C.fianco);      // corpo (dietro le porte)
  const hCong = Math.round(Math.min(800, h * 0.36));      // congelatore in basso
  const fuga = colore === 'nero' ? 10 : 6, y0 = -h / 2;
  const zP = d / 2 - sp / 2;
  box(w - 4, hCong - fuga, sp, 0, y0 + (hCong - fuga) / 2 + 2, zP, C.porta);   // porta congelatore
  const hFr = h - hCong - 4;
  box(w - 4, hFr, sp, 0, y0 + hCong + hFr / 2, zP, C.porta);                   // porta frigo
  box(w - 8, fuga, 4, 0, y0 + hCong - fuga / 2, d / 2 - sp - 1, C.fuga || matFrigoFuga);  // fuga tra le porte
  if (maniglia !== 'barra') {
    // MANIGLIA INCASSATA (come i frigo moderni): sotto la porta del frigo un incavo largo dove
    // entrano le dita, con il labbro piegato; niente barre fuori
    const lI = Math.round((w - 4) * 0.66), hI = 26, matI = C.fuga || matFrigoFuga;
    box(lI, hI, 22, 0, y0 + hCong + hI / 2, d / 2 - 11, matI);                    // incavo (scuro, rientrato)
    const labbro = box(lI, 5, 24, 0, y0 + hCong + 2.5, d / 2 - 12 + 6, C.porta);  // labbro inclinato sotto l'incavo
    labbro.rotation.x = -0.35;
    return;
  }
  // maniglie: barra verticale sottile sul bordo destro, staccata dalla porta
  const xM = w / 2 - 30, lF = Math.min(420, hFr * 0.32), lC = Math.min(300, (hCong - fuga) * 0.45);
  box(14, lF, 16, xM, y0 + hCong + 40 + lF / 2, d / 2 + 14, C.maniglia);
  box(14, lC, 16, xM, y0 + hCong - fuga - 40 - lC / 2, d / 2 + 14, C.maniglia);
  for (const [yc, l] of [[y0 + hCong + 40 + lF / 2, lF], [y0 + hCong - fuga - 40 - lC / 2, lC]]) {
    for (const k of [-1, 1]) box(10, 10, 14, xM, yc + k * (l / 2 - 12), d / 2 + 4, C.maniglia);   // piedini
  }
}

/**
 * Fronte LAVATRICE realistico: corpo bianco, fascia comandi in alto (cassetto
 * detersivo + display + manopola), e OBLÒ tondo con anello cromato e vetro
 * scuro. Costruito DAVANTI alla faccia del mobile (Z0) per non essere coperto.
 */
function lavatriceFronte(g, w, h, d) {
  const z = d / 2, Z0 = z + 2;
  const matBody = matElCorpo;     // NERO come il microonde (unlit, affidabile)
  const box = (bw, bh, bd, x, y, zFront, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2, bw), Math.max(2, bh), bd), mat);
    m.position.set(x, y, zFront - bd / 2); m.castShadow = true; g.add(m); return m;
  };
  // Fronte bianco (copre la faccia del corpo)
  box(w - 6, h - 6, 6, 0, 0, Z0, matBody);
  // Fascia comandi in alto (inox)
  const hStrip = Math.min(h * 0.17, 100);
  const topY = h / 2 - 8 - hStrip / 2;
  box(w - 16, hStrip, 4, 0, topY, Z0 + 2, matElInox);
  // Cassetto detersivo (sx) con maniglietta
  box((w - 16) * 0.34, hStrip * 0.6, 4, -(w - 16) * 0.28, topY, Z0 + 3, matElCavita);
  box((w - 16) * 0.22, 6, 4, -(w - 16) * 0.28, topY - hStrip * 0.22, Z0 + 4, matElInox);
  // Display (centro) + bottoni
  box((w - 16) * 0.22, hStrip * 0.3, 3, -2, topY + hStrip * 0.1, Z0 + 4, matElDisplay);
  for (let i = 0; i < 3; i++) {
    const bt = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 12), matElButton);
    bt.rotation.x = Math.PI / 2; bt.position.set(-30 + i * 22, topY - hStrip * 0.18, Z0 + 4); g.add(bt);
  }
  // Manopola programmi (dx)
  const manR = Math.min(hStrip * 0.3, 20);
  const man = new THREE.Mesh(new THREE.CylinderGeometry(manR, manR * 0.88, 14, 20), matElInox);
  man.rotation.x = Math.PI / 2; man.position.set((w - 16) * 0.38, topY, Z0 + 9); g.add(man);
  // OBLÒ tondo (porta): anello cromato + vetro scuro + cestello più chiaro
  const oblY = -hStrip / 2 - 6;
  const oblR = Math.min(w * 0.33, (h - hStrip) * 0.33);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(oblR, 13, 18, 48), matElInox);
  ring.position.set(0, oblY, Z0 + 5); ring.castShadow = true; g.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(oblR - 4, 48), matElVetro);
  glass.position.set(0, oblY, Z0 + 3); g.add(glass);
  const drum = new THREE.Mesh(new THREE.CircleGeometry(oblR - 30, 44), matElCavita);
  drum.position.set(0, oblY, Z0 + 3.4); g.add(drum);
}

/**
 * Fronte di un mobile ad ANGOLO CIECO: anta apribile sulla parte libera +
 * pannello cieco (fisso, senza maniglia) sulla parte coperta dall'altro mobile.
 */
function anteCieche(g, w, h, d, matAnta, cieco) {
  const z = d / 2;
  // Il pannello cieco si estende di `blindExtra` verso il centro del mobile:
  // è la striscia sotto cui passa il braccio lungo della regletta a L.
  // Così l'anta apribile parte DOPO la regletta e la regletta resta visibile.
  const extra = Math.max(0, cieco.blindExtra || 0);
  const coveredW = Math.max(40, Math.min(w - 80, cieco.coveredW + extra));
  const freeW = w - coveredW;
  const latoDx = cieco.latoDx;                      // copertura sul lato +x?
  const doorCx = latoDx ? (-w / 2 + freeW / 2) : (w / 2 - freeW / 2);
  const blindCx = latoDx ? (w / 2 - coveredW / 2) : (-w / 2 + coveredW / 2);
  // Anta/e apribili sulla parte libera
  const nAnte = freeW >= 600 ? 2 : 1;                // da 60 cm in su: due ante
  const uw = freeW - FUGA_W;
  const pw = (uw - (nAnte - 1) * GAP_ANTE) / nAnte;
  for (let i = 0; i < nAnte; i++) {
    const px = doorCx - uw / 2 + pw / 2 + i * (pw + GAP_ANTE);
    pannello(g, px, 0, z, pw, h - FUGA_H, matAnta || COL.anta);
    manigliaOrizzAnta(g, px, 0, pw, h - FUGA_H, z, latoDx ? 1 : -1, true);
  }
  // Pannello cieco (fisso): stessa finitura, nessuna maniglia
  pannello(g, blindCx, 0, z, coveredW - FUGA_W, h - FUGA_H, matAnta || COL.anta);
}

/**
 * Regletta a L nell'angolo interno tra due mobili (uno cieco): due pezzi a 90°,
 * uno da 30 mm e uno da 30+spessore anta (48 con ante da 18), così uno sormonta
 * l'altro. Sta sul fronte, a filo dei due mobili.
 */
function aabbPlan(q) {
  const d = dimMobile(q);
  const rotN = ((Math.round((q.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const horiz = rotN % 180 === 0;
  const hx = (horiz ? d.w : d.d) / 2, hy = (horiz ? d.d : d.w) / 2;
  return { x0: q.x - hx, x1: q.x + hx, y0: q.y - hy, y1: q.y + hy, cx: q.x, cy: q.y };
}
function frontDirPlan(q) {
  const r = (q.rot || 0) * Math.PI / 180;
  return [-Math.sin(r), -Math.cos(r)];               // fronte 3D in pianta
}

function renderRegolettaAngolo(cieco, m, h, zocc, matAnta, dims) {
  const baseCfg = (dims && dims.base) || 30;
  const spess = (dims && dims.spessore != null) ? dims.spessore : SPESSORE_ANTA;
  // Parte visibile = luce reale tra gli armadi (così spostando i mobili la
  // regletta cambia). Di default (auto) la luce = baseCfg = 3 cm. Mai sotto lo
  // spessore anta (sotto non si può fare; l'avviso lo segnala a parte).
  const base = (!cieco.coperto && cieco.gap != null && cieco.gap > 0)
    ? Math.max(spess, cieco.gap) : baseCfg;
  const o = cieco.o;
  const THK = 20;                                        // spessore pannello (come le ante)
  const AVANZ = 20;                                      // a filo esatto con le ante (stesso livello)
  const hP = h;                                          // ALTEZZA PIENA del modulo (NO -2mm come le ante)

  const A = aabbPlan(m), B = aabbPlan(o);
  const fm = frontDirPlan(m), fo = frontDirPlan(o);

  // Quale mobile ha il fronte ORIZZONTALE (lungo ±y) e quale VERTICALE (lungo ±x).
  // Bracci UGUALI: entrambi lunghi `base` (3 cm) così la L è identica da
  // qualsiasi angolo. Vicino allo spigolo i due bracci si sovrappongono, quindi
  // l'angolo interno resta chiuso senza buchi.
  let H, Hf, V, Vf;
  if (Math.abs(fm[1]) > 0.5) { H = A; Hf = fm; V = B; Vf = fo; }
  else { H = B; Hf = fo; V = A; Vf = fm; }
  const legH = base, legV = base;

  const frontY = (Hf[1] > 0) ? H.y1 : H.y0;            // linea del fronte orizzontale
  const frontX = (Vf[0] > 0) ? V.x1 : V.x0;            // linea del fronte verticale
  const cornerX = frontX, cornerY = frontY;            // angolo interno (incrocio fronti)

  const dirHx = (V.cx >= cornerX) ? -1 : 1;            // braccio orizz. si allontana da V
  const dirVy = (H.cy >= cornerY) ? -1 : 1;            // braccio vert. si allontana da H

  const planeY = frontY + Hf[1] * (AVANZ - THK / 2);   // piano anta (faccia a filo+2)
  const planeX = frontX + Vf[0] * (AVANZ - THK / 2);

  // Stesso materiale delle ante: la regletta si confonde con la finitura
  // della cucina (il blu di debug era solo per verificare il posizionamento).
  const mat = matAnta || new THREE.MeshStandardMaterial({ color: COL.anta, roughness: 0.45, metalness: 0.05 });
  const yC = zocc + hP / 2;
  const addBox = (sx, sz, cx, cy) => {
    const geo = new THREE.BoxGeometry(sx, hP, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, yC, -cy);
    gruppo.add(mesh);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
    e.position.copy(mesh.position); gruppo.add(e);
  };
  // Lateralmente (dove ci sono le ante) 3 mm d'aria per lato: i bracci partono
  // a FUGA_W dall'angolo, così c'è un reveal da 3 mm tra regletta e ante.
  // Braccio ORIZZONTALE: lungo legH in x, spesso THK in y; dall'angolo verso il lato esposto.
  addBox(legH, THK, cornerX + dirHx * (FUGA_W + legH / 2), planeY);
  // Braccio VERTICALE: spesso THK in x, lungo legV in y.
  addBox(THK, legV, planeX, cornerY + dirVy * (FUGA_W + legV / 2));
}

// Colori LED per temperatura, come li vede l'occhio in una cucina vera (bianchi, non colori):
// caldo 3000K = bianco caldo dorato (non arancione), neutro 4000K = bianco pulito,
// freddo 6500K = bianco luce del giorno (appena azzurrato, non blu).
const LED_COLORI = {
  caldo:  0xffd8b6,   // 3000K (un filo verso il pesca: il chiaro forte tende al giallo)
  medio:  0xfff6ec,   // 4000K (quello di prima sul pannello dietro)
  freddo: 0xe6eeff,   // 6500K
};
/** COLORE DELLA LUCE dalla temperatura (2700–6500 K), come le lampadine e i LED veri: tra i punti
 *  fissi (gli stessi di sempre per 3000, 4000 e 6500 K) il colore passa piano piano. */
const PUNTI_KELVIN = [[2700, 0xffcfa3], [3000, 0xffd8b6], [3500, 0xffe8d2], [4000, 0xfff6ec], [5000, 0xf7f6ff], [6500, 0xe6eeff]];
export function coloreKelvin(k) {
  const K = Math.min(6500, Math.max(2700, Number(k) || 3000));
  for (let i = 1; i < PUNTI_KELVIN.length; i++) {
    const [k0, c0] = PUNTI_KELVIN[i - 1], [k1, c1] = PUNTI_KELVIN[i];
    if (K <= k1) return new THREE.Color(c0).lerp(new THREE.Color(c1), (K - k0) / (k1 - k0)).getHex();
  }
  return PUNTI_KELVIN[PUNTI_KELVIN.length - 1][1];
}
const KELVIN_NOMI = { caldo: 3000, medio: 4000, freddo: 6500 };
/** Temperatura dei LED del progetto (le scelte di prima «caldo / neutro / freddo» restano). */
export function kelvinLed(progetto) { const l = progetto.led || {}; return Number(l.kelvin) || KELVIN_NOMI[l.colore] || 3000; }
const ledHex = (progetto) => coloreKelvin(kelvinLed(progetto));

// ---------------------------------------------------------------------------
// LAMPADE ACCESE: ogni lampada del catalogo (sospensioni, plafoniere, LED) si vede accesa.
//  1) le parti che fanno luce (vetro, opalino, paralume, lampadina, LED, quelle già luminose nel
//     modello) brillano di luce neutra un filo calda (~3700 K); se non se ne riconosce nessuna, c'è
//     una lampadina
//  2) come i LED sotto i pensili: un CONO di luce vera verso il basso, dalla lampadina, morbido ai
//     bordi: la pozza di luce sul tavolo, sull'isola, sul pavimento
//  3) un alone leggero attorno (come lo vede l'occhio)
// I materiali «accesi» sono copie fatte una volta sola (il modello in memoria non cambia).
// ---------------------------------------------------------------------------
const LUCE_CALDA = 0xffeede;                          // ~3700 K: neutra con un filo di caldo (tra i LED «neutro» e «caldo»)
const TELEFONO_3D = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
// coni di luce vera in tutto (oltre: brillano soltanto). Sul TELEFONO meno luci: ogni luce in più
// pesa su ogni punto dello schermo
const MAX_LUCI_LAMPADE = TELEFONO_3D ? 4 : 8, MAX_RIVERBERI = TELEFONO_3D ? 1 : 3;
let _luciLampade = 0, _riverberi = 0, _aloni = [];                 // aloni delle lampade: fuori dalle ombre di contatto
// COLORE DELLE LAMPADE: scelto (progetto.lampadeK, in Kelvin) oppure quello di sempre (~3700 K)
let _luceLampade = LUCE_CALDA, _tintaScelta = false;
function impostaColoreLampade(k) { _tintaScelta = !!Number(k); _luceLampade = _tintaScelta ? coloreKelvin(k) : LUCE_CALDA; }
// VETRO trasparente (sfere delle lampade, bicchieri, vasi): fuori dalle ombre di contatto. Le ombre di
// contatto si calcolano dalla forma delle superfici: l'interno di una sfera di vetro risultava un
// angolo chiuso e si riempiva di puntini scuri, come vetro sporco. Il vetro è trasparente: le ombre
// devono essere quelle delle cose che stanno dietro. (Ricerca ogni ~0,7 s: gli oggetti arrivano anche dopo.)
let _vetri = [], _vetriT = -1e9;
function vetriInScena() {
  const t = performance.now();
  if (t - _vetriT > 700 && scene) {
    _vetriT = t; _vetri = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const vetro = (x) => x && (x.transmission > 0 || (x.userData && x.userData.vetro));
      if (m && (Array.isArray(m) ? m.some(vetro) : vetro(m))) _vetri.push(o);
    });
  }
  return _vetri;
}
const _matAcceso = new WeakMap();
const PAROLE_LUCE = /glass|vetro|bulb|globe|opal|diffus|emiss|lampadin|paralum|neon|\bled\b|flame|candle|frost/;   // NON «lamp»/«light»: spesso è tutta la lampada
function materialeAcceso(m, nomeMesh) {
  if (!m || !m.isMaterial) return null;
  if (_matAcceso.has(m)) {
    const a = _matAcceso.get(m);
    if (a) a.emissive.setHex(a.userData.emissivoProprio != null && !_tintaScelta ? a.userData.emissivoProprio : _luceLampade);
    return a;
  }
  // vetro che resta trasparente a lampada accesa (la luce è dentro: lucine, filamento)
  if (m.userData && m.userData.restaChiaro) { _matAcceso.set(m, null); return null; }
  const nome = `${m.name || ''} ${nomeMesh || ''}`.toLowerCase();
  const giaLuce = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b > 0.05 || m.emissiveMap);
  const trasp = (m.transparent && m.opacity < 0.97) || m.transmission > 0;
  let acceso = null;
  if (m.emissive && (giaLuce || trasp || PAROLE_LUCE.test(nome))) {
    acceso = m.clone();
    if (giaLuce) {
      // già luminoso nel modello (LED, opalino, intreccio di bambù): stesso colore, molto più forte
      acceso.emissiveIntensity = Math.min(5, Math.max(1.2, (m.emissiveIntensity || 1) * 4));
      // il suo colore, finché non si sceglie il colore delle lampade (allora prende quello)
      acceso.userData.emissivoProprio = m.emissive.getHex();
      if (_tintaScelta) acceso.emissive.setHex(_luceLampade);
    } else {
      // vetro, opalino, lampadina: si illumina di luce calda (il vetro diventa «smerigliato acceso»)
      acceso.emissive = new THREE.Color(_luceLampade);
      acceso.emissiveIntensity = trasp ? 1.4 : 2.2;
      if (trasp) acceso.opacity = Math.max(m.opacity, 0.75);
    }
    acceso.userData.acceso = true;
  }
  _matAcceso.set(m, acceso);
  return acceso;
}
let _texAlone = null;
function texAlone() {
  if (_texAlone) return _texAlone;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _texAlone = new THREE.CanvasTexture(c); _texAlone.colorSpace = THREE.SRGBColorSpace;
  return _texAlone;
}
/** Accende una lampada (gruppo og già alle sue misure; plafoniera = attaccata al soffitto). */
function accendiLampada(og) {
  og.updateMatrixWorld(true);
  const tmp = new THREE.Box3(), sz = new THREE.Vector3(), pezzi = [];
  let parti = 0;
  og.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    tmp.setFromObject(o); tmp.getSize(sz);
    if (Math.max(sz.x, sz.z) >= 25) pezzi.push(tmp.clone());      // i cavi (sottili) non contano
    const mats = [].concat(o.material), nuovi = mats.map((m) => materialeAcceso(m, o.name) || m);
    if (nuovi.some((m, i) => m !== mats[i])) { o.material = Array.isArray(o.material) ? nuovi : nuovi[0]; parti++; }
  });
  if (!pezzi.length) return;
  // il CORPO della lampada: i pezzi della metà bassa (l'attacco al soffitto e il rosone, in alto, no:
  // con loro la lampadina finiva 30 cm sopra la lampada)
  const tutto = new THREE.Box3(); for (const b of pezzi) tutto.union(b);
  const meta = tutto.min.y + (tutto.max.y - tutto.min.y) * 0.5, corpo = new THREE.Box3();
  for (const b of pezzi) if (b.min.y <= meta) corpo.union(b);
  if (corpo.isEmpty()) corpo.copy(tutto);
  const c = corpo.getCenter(new THREE.Vector3()), dim = corpo.getSize(new THREE.Vector3());
  // le lampadine: in basso nel corpo (dentro il paralume); per le plafoniere basse, al centro.
  // LAMPADE LUNGHE (barre, file di paralumi): 2–4 punti di luce lungo la lunghezza, così la luce
  // copre tutta l'isola o il tavolo (non un solo cono al centro)
  const largo = Math.max(dim.x, dim.z), lungoX = dim.x >= dim.z;
  // LAMPADINE DICHIARATE: una lampada può segnare dove sono le sue lampadine (un segnaposto con
  // userData.puntoLuce, es. una per ogni sfera di un lampadario a più pendenti): la luce parte da lì
  const segnati = [];
  og.traverse((o) => { if (o.userData && o.userData.puntoLuce) segnati.push(o.getWorldPosition(new THREE.Vector3())); });
  const n = segnati.length || (largo > 900 ? Math.min(4, Math.max(2, Math.round(largo / 520))) : 1);
  // lampade LUNGHE: la luce parte da sotto il corpo (non dal centro: nelle forme aperte, come le
  // eliche di nastri LED, illuminava l'interno scuro della lampada e lo faceva sembrare lucido)
  const yL = n > 1 ? corpo.min.y - 5 : dim.y > 260 ? corpo.min.y + Math.min(dim.y * 0.3, 160) : c.y;
  const punti = segnati.length ? segnati.map((p) => og.worldToLocal(p)) : Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : -largo / 2 + (largo * (i + 0.5)) / n;
    return og.worldToLocal(new THREE.Vector3(c.x + (lungoX ? t : 0), yL, c.z + (lungoX ? 0 : t)));
  });
  const passo = largo / n;
  if (!parti) {
    for (const p of punti) {
      const bulbo = new THREE.Mesh(new THREE.SphereGeometry(Math.min(28, Math.max(14, passo * 0.06)), 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff1d8 }));
      bulbo.position.copy(p); bulbo.userData.senzaOmbra = true; og.add(bulbo);
    }
  }
  const r = segnati.length > 1 ? 170 : n === 1 ? Math.min(420, Math.max(140, passo * 0.7)) : Math.min(300, Math.max(120, passo * 0.45));
  // lampade lunghe: niente aloni (facevano 3–4 macchie tonde, come lampadine); brilla la linea LED.
  // Le lampadine DICHIARATE invece sono lampadine vere: ognuna ha il suo alone
  for (const p of (n === 1 || segnati.length ? punti : [])) {
    const alone = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAlone(), color: _luceLampade, transparent: true, opacity: n === 1 ? 0.3 : 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    alone.scale.set(r, r, 1); alone.position.copy(p); alone.userData.alone = n === 1 ? true : 'lungo'; alone.userData.senzaOmbra = true; alone.renderOrder = 6;
    og.add(alone); _aloni.push(alone);
  }
  // coni verso il basso, larghi e morbidi (come il LED sotto il pensile, ma da più in alto);
  // una lampada lunga ha più coni, ognuno un po' meno forte
  const fattore = n === 1 ? 1 : 0.75;
  let messe = 0;
  for (const p of punti) {
    if (_luciLampade >= MAX_LUCI_LAMPADE) break;
    _luciLampade++; messe++;
    const luce = new THREE.SpotLight(_luceLampade, 6500 * fattore, 4500, Math.PI / 2.6, 1, 1.0);
    luce.position.copy(p); luce.target.position.set(p.x, p.y - 1000, p.z);
    luce.castShadow = false; luce.userData.luceLampada = fattore; og.add(luce); og.add(luce.target);
  }
  // riverbero: un filo di luce tutt'attorno (muri, soffitto), come la luce che rimbalza in una
  // stanza vera; solo per le prime lampade (il telefono non calcola troppe luci)
  if (messe && _riverberi < MAX_RIVERBERI) {
    _riverberi++;
    const centro = og.worldToLocal(new THREE.Vector3(c.x, yL, c.z));
    const spill = new THREE.PointLight(_luceLampade, 500, 5000, 1.0);
    spill.position.copy(centro); spill.castShadow = false; spill.userData.riverbero = true; og.add(spill);
  }
}

/**
 * Strip LED sotto un pensile: una barra sottile emissiva appesa al bordo
 * inferiore RETRO della cassa (lato muro), così non intralcia l'anta
 * sporgente che a volte si prende sotto per aprire. Sotto la barra ci sono
 * vere luci (SpotLight + PointLight) che illuminano il piano di lavoro e
 * la parete di fondo con il colore della temperatura scelta.
 * Niente pannelli/texture colorati sovrapposti: facevano "rettangoli" e
 * distorcevano ciò che c'era dietro. Solo luce reale sulle superfici.
 */
/** LED sotto il pensile. avanti = mm di cui spostarlo verso il fronte
 *  (con il pannello dietro il piano: il suo spessore, così resta visibile). */
/**
 * LED sotto un pensile (o sotto il ponte / il pannello del ponte): qui solo si SEGNA il tratto di
 * striscia; alla fine della scena i tratti attaccati diventano UNA STRISCIA UNICA per ogni fila di
 * pensili, con una luce vera a striscia (uniforme per tutta la lunghezza, niente «faretti»).
 */
let _ledTratti = [];
function aggiungiLedPensile(g, w, h, d, colore, avanti = 0) {
  const hex = typeof colore === 'number' ? colore : (LED_COLORI[colore] || LED_COLORI.caldo);
  _ledTratti.push({ g, w, h, d, hex, z: -d / 2 + 13 + avanti });
}
/** Luce vera a STRISCIA (RectAreaLight): serve un file di three.js, caricato solo se ci sono LED. */
let _rectLib = null, _rectLibCaricando = false;
function lucieStrisciaPronte() {
  if (_rectLib) return true;
  if (!_rectLibCaricando) {
    _rectLibCaricando = true;
    import('three/addons/lights/RectAreaLightUniformsLib.js?v=20261122e')
      .then((mod) => { mod.RectAreaLightUniformsLib.init(); _rectLib = mod; if (_reRenderMan) _reRenderMan(); })
      .catch((e) => { _rectLibCaricando = false; console.warn('Luce a striscia non disponibile', e); });
  }
  return false;
}
// LUCE A STRISCIA tarata sulla luce di prima: stessa luce sul piano di lavoro (e muro illuminato
// uguale per tutta la lunghezza, senza i coni): larga 12 cm, 10 cm più avanti della striscia, appena
// inclinata verso la stanza
const LED_INTENSITA = 10, LED_LARG = 120, LED_AVANTI = 100, LED_INCLINA = -0.15;
/**
 * Luce a striscia sotto un pannello: centro p (mondo), asse della striscia u, verso il muro dietro vM.
 * Illumina in basso: il muro (o il pannello dietro) e il piano di lavoro, uniformi per tutta la striscia.
 */
function luceStriscia(lung, larg, intensita, hex, p, u, vM, inclina = LED_INCLINA) {
  const L = new THREE.RectAreaLight(hex, intensita, Math.max(20, lung), larg);
  L.position.copy(p);
  // il lato che fa luce guarda giù, verso il muro: la x della luce lungo la striscia
  const giu = new THREE.Vector3(vM.x * inclina, -1, vM.z * inclina).normalize();
  const zL = giu.clone().negate();                                   // la luce fa luce verso −z
  const xL = new THREE.Vector3(u.x, 0, u.z).normalize();
  const yL = new THREE.Vector3().crossVectors(zL, xL).normalize();
  xL.crossVectors(yL, zL).normalize();
  L.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xL, yL, zL));
  L.userData.ledLuce = true;
  return L;
}
/** Fine scena: i tratti di LED attaccati (stessa altezza, stessa linea) diventano una striscia unica. */
function costruisciLedContinui() {
  const tratti = _ledTratti; _ledTratti = [];
  if (!tratti.length || !gruppo) return;
  gruppo.updateMatrixWorld(true);
  const segs = tratti.map((t) => {
    const y = -t.h / 2;
    const A = t.g.localToWorld(new THREE.Vector3(-t.w / 2, y, t.z)), B = t.g.localToWorld(new THREE.Vector3(t.w / 2, y, t.z));
    const C = t.g.localToWorld(new THREE.Vector3(0, y, t.z)), D = t.g.localToWorld(new THREE.Vector3(0, y, t.z - 100));
    const u = B.clone().sub(A); u.y = 0; u.normalize();
    const vM = D.sub(C); vM.y = 0; vM.normalize();                  // verso il muro (dietro)
    return { A, B, u, vM, y: (A.y + B.y) / 2, hex: t.hex };
  });
  // raggruppo: stessa altezza, stesso colore, stessa linea, uno dopo l'altro (al massimo 3 cm di buco)
  const usati = new Set(), file = [];
  for (let i = 0; i < segs.length; i++) {
    if (usati.has(i)) continue;
    const s0 = segs[i], fila = [s0]; usati.add(i);
    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (let j = 0; j < segs.length; j++) {
        if (usati.has(j)) continue;
        const s = segs[j];
        if (s.hex !== s0.hex || Math.abs(s.y - s0.y) > 3 || Math.abs(s.u.dot(s0.u)) < 0.999) continue;
        // stessa linea: distanza dalla retta della fila
        const off = s.A.clone().sub(s0.A); off.y = 0;
        const perp = off.clone().sub(s0.u.clone().multiplyScalar(off.dot(s0.u))).length();
        if (perp > 12) continue;
        // attaccato a un tratto della fila
        const t = (P) => P.clone().sub(s0.A).dot(s0.u);
        const a = Math.min(t(s.A), t(s.B)), bb = Math.max(t(s.A), t(s.B));
        if (fila.some((f) => { const fa = Math.min(t(f.A), t(f.B)), fb = Math.max(t(f.A), t(f.B)); return a <= fb + 30 && bb >= fa - 30; })) {
          fila.push(s); usati.add(j); cambiato = true;
        }
      }
    }
    file.push(fila);
  }
  const pronte = lucieStrisciaPronte();
  for (const fila of file) {
    const s0 = fila[0], t = (P) => P.clone().sub(s0.A).dot(s0.u);
    let a = Infinity, bb = -Infinity;
    for (const f of fila) { a = Math.min(a, t(f.A), t(f.B)); bb = Math.max(bb, t(f.A), t(f.B)); }
    const lung = Math.max(60, bb - a - 20);                          // 1 cm di margine ai due capi
    const mid = s0.A.clone().add(s0.u.clone().multiplyScalar((a + bb) / 2)); mid.y = s0.y;
    // la striscia accesa (sempre al colore pieno), sotto il fondo dei pensili
    const strip = new THREE.Mesh(new THREE.BoxGeometry(lung, 6, 18), new THREE.MeshBasicMaterial({ color: s0.hex, toneMapped: false }));
    strip.position.set(mid.x, s0.y + 3, mid.z);
    strip.rotation.y = -Math.atan2(s0.u.z, s0.u.x);
    strip.userData.ledStriscia = { colore: s0.hex, lunghezza: lung };
    strip.userData.senzaOmbra = true;
    gruppo.add(strip);
    // la luce vera, uniforme per tutta la striscia
    if (pronte) gruppo.add(luceStriscia(lung, LED_LARG, LED_INTENSITA, s0.hex, new THREE.Vector3(mid.x, s0.y - 4, mid.z).addScaledVector(s0.vM, -LED_AVANTI), s0.u, s0.vM));
  }
}

/** Dove vanno i LED nella cucina a ponte, SEMPRE sotto: 'pensili' (sotto ogni pensile, anche quelli sotto
 *  il ponte), 'ponte' (sotto il ponte dove non ci sono pensili: il suo fondo si vede) o 'entrambi'.
 *  (Le scelte di prima: sotto → entrambi, come faceva; sopra → ponte.) */
const ledPonte = (progetto) => { const v = (progetto.led && progetto.led.ponte) || 'entrambi'; return v === 'sotto' ? 'entrambi' : v === 'sopra' ? 'ponte' : v; };

/**
 * Pensile ad angolo a L (pezzo unico): due bracci perpendicolari, ingombro
 * w×d (63×63), ciascun braccio profondo come un pensile normale. Un'anta
 * sul fronte interno di ogni braccio. L'angolo pieno sta verso il retro-
 * sinistra (lato muri); l'utente ruota il modulo per l'angolo giusto.
 */
function pensileAngoloL(g, w, h, d, coloreCorpo, matAnta, prof = PROFONDITA_PENSILE, basso = false, sporg = false) {
  // prof = profondità di ogni braccio (pensile 330, base 600); basso = base angolo
  const matCorpo = (coloreCorpo && coloreCorpo.isMaterial) ? coloreCorpo
    : new THREE.MeshStandardMaterial({ color: coloreCorpo, roughness: 0.7, metalness: 0.05 });
  const mkBox = (bw, bd, cx, cz) => {
    const geo = new THREE.BoxGeometry(bw, h, bd);
    const mesh = new THREE.Mesh(geo, matCorpo);
    mesh.position.set(cx, 0, cz);
    g.add(mesh);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
    e.position.copy(mesh.position); g.add(e);
  };
  // Braccio A: lungo X, addossato al retro (-z).
  mkBox(w, prof, 0, -d / 2 + prof / 2);
  // Braccio B: lungo Z, addossato al lato sinistro (-x), DAVANTI al braccio A
  // (niente scatole sovrapposte nell'angolo: facce doppie che "sfarfallano")
  mkBox(prof, d - prof, -w / 2 + prof / 2, prof / 2);
  // Anta A: sul fronte del braccio A (+z), sulla parte non coperta dal braccio B.
  const antaAw = w - prof;
  const antaAcx = (-w / 2 + prof + w / 2) / 2;
  const zA = -d / 2 + prof;
  const anta = (gg, cx, z, aw, verso) => {
    if (!basso && sporg) {                           // pensile con anta sporgente sotto (come gli altri pensili)
      pannello(gg, cx, -10, z, aw, h + 20, matAnta || COL.anta);
    } else if (_fingerPull) {                        // gola: in alto nella base, in basso nel pensile
      const CH = 30, hA = h - FUGA_H;
      pannello(gg, cx, basso ? -CH / 2 : CH / 2, z, aw, Math.max(60, hA - CH), matAnta || COL.anta);
      canaleFingerPull(gg, cx, basso ? hA / 2 - CH / 2 : -hA / 2 + CH / 2, z, aw, CH, true, matAnta, !basso);
    } else {
      pannello(gg, cx, 0, z, aw, h - FUGA_H, matAnta || COL.anta);
      manigliaOrizzAnta(gg, cx, 0, aw, h - FUGA_H, z, verso, basso);
    }
  };
  anta(g, antaAcx, zA, antaAw - FUGA_W, 1);                // maniglie verso l'esterno, non nell'angolo
  // Anta B: sul fronte del braccio B (+x), in un subgruppo ruotato +90°.
  const subB = new THREE.Group();
  const antaBw = d - prof;
  anta(subB, 0, 0, antaBw - FUGA_W, -1);
  subB.rotation.y = Math.PI / 2;                     // fronte +z locale → +x mondo
  subB.position.set(-w / 2 + prof, 0, (-d / 2 + prof + d / 2) / 2);
  g.add(subB);
}

/** Pensile ad angolo (63×63): cassa quadrata + anta diagonale a 45°. */
function pensileAngoloFronte(g, w, h, d, matAnta) {
  const mat = (matAnta && matAnta.isMaterial)
    ? matAnta
    : new THREE.MeshStandardMaterial({ color: COL.anta, roughness: 0.6, metalness: 0.08 });
  const diag = Math.min(w, d) * 1.18;              // larghezza anta diagonale
  const geo = new THREE.BoxGeometry(diag, h - FUGA_H, 18);
  const porta = new THREE.Mesh(geo, mat);
  porta.rotation.y = -Math.PI / 4;                 // fronte verso l'angolo stanza
  porta.position.set(w * 0.16, 0, d * 0.16);
  g.add(porta);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro);
  e.position.copy(porta.position); e.rotation.copy(porta.rotation); g.add(e);
  // Maniglia verticale sul fronte diagonale
  const nx = Math.sin(Math.PI / 4), nz = Math.cos(Math.PI / 4);  // normale anta
  const man = new THREE.Mesh(new THREE.BoxGeometry(16, Math.min(300, (h - FUGA_H) * 0.45), 16), matManiglia);
  man.visible = !_push;
  man.position.set(w * 0.16 + nx * 16 - 120 * nz, 0, d * 0.16 + nz * 16 + 120 * nx);
  g.add(man);
}

/**
 * MOBILE APERTO (senza ante), fatto a pezzi come in distinta (pezziMobileAperto), tutti dello spessore
 * delle ante: FIANCO profondo come il mobile più l'anta (a filo con le ante vicine), SCHIENA fra i
 * fianchi (larga come il mobile meno i fianchi), CIELO, FONDO e RIPIANI dentro, davanti alla schiena.
 * Con le ante dei pensili da 72 / 92 (sporg) il mobile è alto come l'anta: scende di 2 cm.
 * lato = 'sx' | 'dx': ultimo modulo della fila, da quella parte niente fianco.
 * Gli oggetti si appoggiano sul fondo e sui ripiani.
 */
function mobileAperto(g, w, h, d, m, matAnta, coloreCorpo, lato = null, sporg = false) {
  const S = SP_PEZZI_APERTO;
  const mA = (matAnta && matAnta.isMaterial) ? matAnta : new THREE.MeshStandardMaterial({ color: matAnta || COL.anta, roughness: 0.6, metalness: 0.08 });
  const mStr = (coloreCorpo && coloreCorpo.isMaterial) ? coloreCorpo : new THREE.MeshStandardMaterial({ color: coloreCorpo, roughness: 0.7, metalness: 0.05 });
  // COLORE DI OGNI PEZZO: come le ante, come la struttura o un materiale a scelta
  const matDi = (parte) => {
    const c = coloreParteAperto(m, parte);
    return c === 'ante' ? mA : c === 'struttura' ? mStr : (getMaterialeTHREE(c, () => _reRenderMan && _reRenderMan()) || mA);
  };
  const mFi = matDi('fianchi'), mCi = matDi('cielo'), mFo = matDi('fondo'), mSc = matDi('schiena'), mRi = matDi('ripiani');
  const pezzo = (bw, bh, bd, x, y, z, mat) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, bw), Math.max(1, bh), Math.max(1, bd)), mat);
    me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
  };
  const ripiano = (me) => { me.userData.appoggio = true; me.userData.ripianoAperto = true; return me; };
  const sg = lato === 'dx' ? 1 : lato === 'sx' ? -1 : 0;
  const hb = h + (sporg ? 20 : 0), yc = sporg ? -10 : 0, yTop = yc + hb / 2, yBot = yc - hb / 2;
  const zB = -d / 2, zF = d / 2 + S;                         // dal muro al filo delle ante
  // FIANCHI: profondi come il mobile più l'anta, alti come il mobile (o come l'anta da 72 / 92)
  for (const sx of [-1, 1]) if (sx !== sg) pezzo(S, hb, d + S, sx * (w / 2 - S / 2), yc, (zB + zF) / 2, mFi);
  // fra i fianchi (o fra il fianco e il bordo libero)
  const x0 = sg === -1 ? -w / 2 : -w / 2 + S, x1 = sg === 1 ? w / 2 : w / 2 - S, xc = (x0 + x1) / 2, wi = x1 - x0;
  pezzo(wi, hb, S, xc, yc, zB + S / 2, mSc);                 // SCHIENA (il secondo fianco), alta come i fianchi
  const pz = zB + S + d / 2;                                  // cielo, fondo e ripiani: davanti alla schiena, profondi d
  ripiano(pezzo(wi, S, d, xc, yBot + S / 2, pz, mFo));        // fondo
  pezzo(wi, S, d, xc, yTop - S / 2, pz, mCi);                 // cielo
  const n = ripianiAperto(m), y0 = yBot + S, y1 = yTop - S;
  const r0 = x0 + (sg === -1 ? 0 : 1), r1 = x1 - (sg === 1 ? 0 : 1);
  const yRip = [];
  for (let i = 1; i <= n; i++) {
    const yr = y0 + (y1 - y0) * i / (n + 1); yRip.push(yr);
    ripiano(pezzo(r1 - r0, S, d - 2, (r0 + r1) / 2, yr, zB + S + (d - 2) / 2, mRi));
  }
  // LED sotto il top (cielo) e sotto i ripiani: la striscia accesa e una LUCE VERA a striscia,
  // uniforme, che illumina il ripiano sotto e la schiena (come i LED sotto i pensili)
  const led = ledAperto(m);
  if (led.top || (led.ripiani && n)) {
    const hex = ledHex(_lastProgetto || {}), pronte = lucieStrisciaPronte();
    const soffitti = [...yRip.map((y) => y - S / 2), yTop - S];
    for (let k = soffitti.length - 1; k >= 0; k--) {
      const sotto = k === soffitti.length - 1 ? led.top : led.ripiani;   // l'ultimo scomparto ha sopra il cielo
      if (!sotto) continue;
      const ys = soffitti[k], lung = Math.max(40, wi - 20);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(lung, 6, 12), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));
      strip.position.set(xc, ys - 3, zF - 30);
      strip.userData.ledStriscia = { colore: hex, lunghezza: lung };
      g.add(strip);
      // più debole di quella sotto i pensili: lo scomparto è piccolo (e la luce non deve uscire sotto il mobile)
      if (pronte) g.add(luceStriscia(lung, 60, LED_INTENSITA * 0.35, hex, new THREE.Vector3(xc, ys - 7, zF - 70), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), 0.35));
    }
  }
  // aperture (invisibili): trascinando un oggetto e puntando dentro, va sul ripiano indicato
  const portale = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(10, wi), Math.max(10, hb - 2 * S)),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  portale.position.set(xc, yc, zF); portale.visible = false;
  portale.userData.portaleVano = { profondita: d - 40 };
  g.add(portale);
  if (sg) {                                                  // anche dal fianco aperto
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(10, d), Math.max(10, hb - 2 * S)),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    pl.rotation.y = sg * Math.PI / 2; pl.position.set(sg * w / 2, yc, pz); pl.visible = false;
    pl.userData.portaleVano = { profondita: Math.max(60, wi - 60) };
    g.add(pl);
  }
}

/** Costruisce il mobile completo centrato nell'origine (corpo + fronti). */
function costruisciMobile(cat, tipo, m, w, h, d, matAnta, opt = {}) {
  const g = new THREE.Group();
  if (cat === 'frigo') { frigoLibero(g, w, h, d, m && m.colore, m && m.maniglia); return g; }
  _push = pushCat(cat);                  // push: niente maniglia (anche con il finger-pull)
  _fingerPull = fpCat(_fpByCat, cat);   // finger-pull per categoria del mobile
  _maniglia = manigliaCat(cat);         // maniglia del catalogo per categoria
  // PONTE e pensili sotto il ponte: le loro scelte (se fatte), se no come colonne / pensili
  if (opt.porte) {
    _push = opt.porte.push; _fingerPull = opt.porte.fp;
    _maniglia = (opt.porte.maniglia && MATERIALI.find((x) => x.id === opt.porte.maniglia && x.categoria === 'maniglia')) || null;
  }
  // Colonna: il fianco si vede (sopra i pensili, di lato) → stesso materiale
  // delle ante della colonna, non il colore crema del corpo
  const coloreCorpo = cat === 'pensile' ? _coloreInterno
    : cat === 'colonna' ? (m && m.struttura === 'bianco' ? _coloreInterno : (matAnta && matAnta.isMaterial) ? matAnta : COL.colonna)
    : cat === 'regletta' ? COL.regletta : cat === 'lavatrice' ? 0x17181d
    : cat === 'lavastoviglie' ? 0xbcbdc2 : (cat === 'base' || cat === 'altillo') ? _coloreInterno : COL.corpo;
  // Pensile angolo a L: corpo a L (due bracci), non il box quadrato.
  if (tipo === 'pensile-angolo') { pensileAngoloL(g, w, h, d, coloreCorpo, matAnta, PROFONDITA_PENSILE, false, !!opt.sporg); return g; }
  if (tipo === 'base-angolo') { pensileAngoloL(g, w, h, d, coloreCorpo, matAnta, Math.min((m && m.profBraccio_mm) || PROFONDITA_BASE, Math.min(w, d) - 10), true); return g; }
  // Colonna con VANO APERTO: carcassa a fronte aperto (si vede dentro);
  // le altre colonne/mobili restano scatola piena.
  const colonnaVano = cat === 'colonna' && m && (m.variante === 'vano'
    || Object.values(m.porte || {}).some((o) => o && o.vetro));          // porta in vetro: si vede dentro
  // Mobile del LAVELLO: aperto sopra (come nella realtà), sennò il blocco
  // pieno arriva sotto il piano e copre la vasca: nel foro si vedrebbe solo
  // il coperchio del mobile, non la profondità.
  const conLavello = cat !== 'colonna' && cat !== 'pensile' && (tipo === 'lavello' || (m && m.lavello));
  // VETRINA (ante con vetro): cassa aperta davanti, con i ripiani che si vedono dal vetro
  const vetrina = m && m.vetrina && (tipo === 'pensile' || tipo === 'base-ante') ? m.vetrina : null;
  // MOBILE APERTO (senza ante): cassa aperta davanti, si vede dentro
  const aperto = apertoDi(m);
  const latoAp = aperto && _lastProgetto ? latoApertoDi(_lastProgetto, m) : null;   // ultimo della fila: senza quel fianco
  g.add(colonnaVano ? carcassaColonna(w, h, d, coloreCorpo)
    : aperto ? new THREE.Group()                                       // mobile aperto: tutto a pezzi (sotto)
    : conLavello ? carcassaColonna(w, h, d, coloreCorpo, false)
    : vetrina ? carcassaVetrina(w, h, d, coloreCorpo, cat === 'pensile' ? (h >= 850 ? 2 : 1) : 1)
    : corpo(w, h, d, coloreCorpo));
  if (cat === 'regletta') return g;
  if (opt.cieco && opt.cieco.coperto) { anteCieche(g, w, h, d, matAnta, opt.cieco); return g; }
  if (aperto) { mobileAperto(g, w, h, d, m, matAnta, coloreCorpo, latoAp, cat === 'pensile' && !!opt.sporg); return g; }
  if (tipo === 'pensile-angolo-45') { pensileAngoloFronte(g, w, h, d, matAnta); return g; }
  if (cat === 'colonna') { _coloreCorpoCol = coloreCorpo; colonnaFronte(g, w, h, d, m, matAnta); return g; }
  if (tipo === 'base-cassetti') { cassetti(g, w, h, d, Math.max(1, m.cassetti || 3), matAnta, m.cassettoPiccolo_mm); return g; }
  if (tipo === 'lavello') { ante(g, w, h, d, w >= 600 ? 2 : 1, matAnta); return g; } // lavello disegnato sopra il top
  if (tipo === 'lavastoviglie') {
    // INTEGRATA: dietro un'anta come quelle dei mobili (con la sua maniglia); se no a vista
    if (m && m.colore === 'integrata') { ante(g, w, h, d, 1, matAnta, false, m.antaLato); return g; }
    lavastoviglieFronte(g, w, h, d, m && m.colore); return g;
  }
  if (cat === 'lavatrice') { lavatriceFronte(g, w, h, d); return g; }
  if (tipo === 'forno') { fronteForno(g, w, h, d, matAnta); return g; } // placca sopra il top
  // base con ante / pensile (il pensile può avere l'anta sporgente sotto)
  _anteInBasso = cat === 'pensile' || cat === 'altillo';   // in alto: maniglia sotto
  _vetrina = vetrina;
  ante(g, w, h, d, anteDiMobile(m), matAnta, opt.sporg, m.antaLato);
  _anteInBasso = false; _vetrina = null;
  return g;
}

let _spTop = SP_TOP;
const rayGiu = new THREE.Raycaster();
/** Superfici d'appoggio (piani di lavoro) della scena. */
function superficiAppoggio() {
  const out = [];
  if (gruppo) gruppo.traverse((o) => { if (o.isMesh && o.userData.appoggio) out.push(o); });
  return out;
}
/** Quota (mm) del piano più alto sotto il punto (x, z) della scena 3D; 0 se non c'è (pavimento). */
function quotaPiani(x, z, sup = superficiAppoggio(), daY = 4000) {
  if (!sup.length) return 0;
  rayGiu.set(new THREE.Vector3(x, daY, z), new THREE.Vector3(0, -1, 0));
  const hit = rayGiu.intersectObjects(sup, false)[0];
  return hit ? hit.point.y : 0;
}
/** Altezza d'appoggio di un oggetto: sopra il piano se il suo centro sta su un mobile basso, se no 0 (a terra). */
function quotaAppoggio(progetto, o, spTop) {
  for (const b of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(b.tipo);
    if (!['base', 'lavastoviglie', 'lavatrice'].includes(cat)) continue;
    const d = dimMobile(b), r = ((Math.round((b.rot || 0) / 90) * 90) % 180 + 180) % 180;
    const hx = (r === 0 ? d.w : d.d) / 2, hy = (r === 0 ? d.d : d.w) / 2;
    if (Math.abs(o.x - b.x) <= hx && Math.abs(o.y - b.y) <= hy) {
      const h = b.altezza_mm || 700;
      return zoccoloPerAltezza(h) + h + spTop;
    }
  }
  return 0;
}

function collocaMobile(g, cx, yBottom, cz, h, rotGradi) {
  g.position.set(cx, yBottom + h / 2, cz);
  g.rotation.y = -(rotGradi || 0) * Math.PI / 180;
  return g;
}

// ---------------------------------------------------------------------------
// --- Oggetti 3D (sgabelli / decor): modelli "bakeati" in JSON compatto,
//     caricati on-demand e messi in cache. Non sono moduli: niente zoccolo,
//     niente piano, non entrano in distinta. ---
const OGGETTI_FILE = { sgabello: 'sgabello.json' };
const _oggModelli = {};      // id -> { parts:[{geo,mat}], dim }
const _oggPending = {};
let _lastProgetto = null;
function costruisciOggetto(id) {
  const m = _oggModelli[id];
  if (!m) { caricaModelloOgg(id); return null; }     // non pronto → re-render al load
  const g = new THREE.Group();
  for (const part of m.parts) {
    const mesh = new THREE.Mesh(part.geo, part.mat);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  }
  return g;
}
async function caricaModelloOgg(id) {
  if (_oggPending[id] || _oggModelli[id]) return;
  const file = OGGETTI_FILE[id]; if (!file) return;
  _oggPending[id] = true;
  try {
    const url = new URL(`./models/${file}`, import.meta.url);
    const data = await (await fetch(url)).json();
    const parts = data.parts.map((pt) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
      geo.setIndex(pt.indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: pt.colore,
        metalness: Math.min(pt.metalness, 0.4),
        roughness: pt.roughness,
        envMapIntensity: 0.3,
      });
      return { geo, mat };
    });
    _oggModelli[id] = { parts, dim: data.dim_mm };
  } catch (e) { /* modello non disponibile: si ignora */ }
  finally { _oggPending[id] = false; if (_lastProgetto && scene) aggiornaScena3d(_lastProgetto, false, selId); }
}

/**
 * Ricostruisce la scena. Le geometrie dei pezzi VECCHI che la scena nuova non usa più si liberano
 * dalla memoria della scheda grafica: prima restavano tutte (ogni tocco, spostamento o scelta
 * rifà la scena) e sul telefono, dopo un po' di tocchi, la memoria si riempiva e il 3D si bloccava.
 */
export function aggiornaScena3d(progetto, reframe = false, selezionato = null) {
  const vecchi = gruppo ? gruppo.children.slice() : [];
  costruisciScena3d(progetto, reframe, selezionato);
  if (!vecchi.length || !gruppo) return;
  const usate = new Set();
  gruppo.traverse((o) => { if (o.geometry) usate.add(o.geometry); });
  const libera = new Set();
  for (const v of vecchi) {
    if (v.parent === gruppo) continue;                       // ancora in scena (riusato)
    v.traverse((o) => { if (o.geometry && !usate.has(o.geometry)) libera.add(o.geometry); });
  }
  for (const g of libera) g.dispose();
}
function costruisciScena3d(progetto, reframe = false, selezionato = null) {
  _luciLampade = 0; _riverberi = 0; _aloni = []; _ledTratti = [];
  impostaColoreLampade(progetto.lampadeK);
  if (!scene) return;
  selId = selezionato;
  _lastProgetto = progetto;
  _fpByCat = progetto.fingerPull || {};
  _pushByCat = progetto.push || {};
  _manByCat = progetto.maniglie || {};
  _stileForno = (progetto.finiture || {}).forno || 'inox';
  _progColonne = progetto;
  _coloreInterno = COLORI_INTERNO[progetto.coloreInterno] || COLORI_INTERNO.bianco;
  _matInterno.color.setHex(_coloreInterno);
  _reRenderMan = () => { if (_lastProgetto) aggiornaScena3d(_lastProgetto, false, selId); };
  // L'illuminazione della scena resta sempre al valore pieno (giorno) sia
  // con i LED spenti che accesi: non si vuole che i LED spengano l'ambiente.
  leggiParametriAnte();
  while (gruppo.children.length) gruppo.remove(gruppo.children[0]);
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const bb = bbox(progetto, vertici);

  // Sfondo/pavimento scelti (solo estetica, non tocca luci/riflessi)
  const sf = sfondoDi(progetto.sfondo);
  _sfondoBase = new THREE.Color(sf.bg); scene.background = _sfondoBase.clone();

  // Pavimento + griglia
  // pavimento ampio: il bordo non si vede (come in una foto, il pavimento continua)
  const padW = (bb.maxX - bb.minX) + 24000, padD = (bb.maxY - bb.minY) + 24000;
  const cxF = (bb.minX + bb.maxX) / 2, czF = -(bb.minY + bb.maxY) / 2;
  // PAVIMENTO VERO (parquet o gres, secondo lo sfondo), niente griglia da disegno tecnico
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD),
    pavimentoVero(progetto.sfondo || 'chiaro', sf.pav, padW, padD, () => { if (resa) resa.cambiato(); }, progetto.pavimento));
  pav.rotation.x = -Math.PI / 2; pav.position.set(cxF, 0, czF); pav.userData.pavimento = true; gruppo.add(pav);

  // SOFFITTO (solo con «Tetto sì», alla Pianta o nel Rendering): una LASTRA vera, spessa 20 cm,
  // grande come la stanza (fino alla faccia esterna dei muri; dove non c'è muro 2 m davanti ai
  // mobili e 1,2 m ai lati; profondità e larghezza le può scrivere l'utente: rettangoloSoffitto).
  // Da DENTRO si vede pieno, chiaro (le lampade ci sono appese); da SOPRA si vede
  // semitrasparente con lo spessore e i bordi netti: si capisce che c'è e la cucina resta visibile.
  // Non fa ombra.
  const ALT_MURO = altezzaSoffitto(progetto);
  if (progetto.tetto) {
    const r = rettangoloSoffitto(progetto), W = r.x1 - r.x0, D = r.y1 - r.y0;
    const cx = (r.x0 + r.x1) / 2, cz = -(r.y0 + r.y1) / 2, sp = SP_SOFFITTO;
    const soff = new THREE.Group(); soff.userData.soffitto = true;
    const sotto = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT_SOFFITTO); sotto.rotation.x = Math.PI / 2; sotto.position.set(cx, ALT_MURO, cz); soff.add(sotto);
    const sopra = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT_SOFFITTO_SOPRA); sopra.rotation.x = -Math.PI / 2; sopra.position.set(cx, ALT_MURO + sp, cz); sopra.renderOrder = 5; soff.add(sopra);
    const nessuno = new THREE.MeshBasicMaterial({ visible: false });
    const fianchi = new THREE.Mesh(new THREE.BoxGeometry(W, sp, D), [MAT_SOFFITTO_FIANCO, MAT_SOFFITTO_FIANCO, nessuno, nessuno, MAT_SOFFITTO_FIANCO, MAT_SOFFITTO_FIANCO]);
    fianchi.position.set(cx, ALT_MURO + sp / 2, cz); soff.add(fianchi);
    const bordi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, sp, D)), MAT_SOFFITTO_BORDO); bordi.position.copy(fianchi.position); bordi.userData.fuga = true; soff.add(bordi);
    soff.traverse((o) => { o.userData.senzaOmbra = true; o.userData.soffitto = true; if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    gruppo.add(soff);
  }

  // Muri di riferimento
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    // MURO VERO (intonaco opaco): si vede dietro i mobili e sparisce quando sta
    // tra te e la cucina (vedi muriVisibili)
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(L, ALT_MURO, 60), MAT_MURO);
    muro.position.set((a.x + b.x) / 2 - nx * 30, ALT_MURO / 2, -((a.y + b.y) / 2 - ny * 30));
    // il muro va da a a b: in 3D la z è −y della pianta, quindi l'angolo è +atan2(dy, dx)
    // (col segno meno i muri INCLINATI venivano specchiati; quelli dritti non si notava)
    muro.rotation.y = Math.atan2(dy, dx);
    muro.userData.muroRiferimento = true;
    muro.userData.muroNormale = { x: nx, z: -ny };
    gruppo.add(muro);
  });

  // Raccolgo le basi per il piano continuo e gli accessori (placca/lavello)
  const basiTop = [];
  const accessori = [];
  const fianchi = [];   // costadi e colonne: delimitano il top (lo taglia/estende)
  const pensiliPlan = []; // pensili (per l'altezza del pannello dietro il piano)
  const zoccoli = [];   // TUTTO ciò che poggia a terra (basi, colonne, reglette):
                        // lo zoccolo è un unico pezzo continuo che li copre tutti

  // Materiale delle ante per gruppo (bassi / pensili / colonne). null = colore di default.
  const col = progetto.coloriFronti || {};
  ultimoProgetto = progetto;
  const reRender = () => { if (ultimoProgetto) aggiornaScena3d(ultimoProgetto, false, selId); };
  const matBase = col.base ? getMaterialeTHREE(col.base, reRender) : null;
  const matPensile = col.pensile ? getMaterialeTHREE(col.pensile, reRender) : null;
  const matColonna = col.colonna ? getMaterialeTHREE(col.colonna, reRender) : null;
  // Encimera (piano di lavoro): materiale e spessore dall'eventuale scelta
  // utente. Nessuna scelta -> colore COL.top e spessore SP_TOP come prima.
  const encId = progetto.encimera && progetto.encimera.materiale;
  // Costado "come il piano di lavoro" ('@piano'): stesso materiale dell'encimera
  const matDa = (id) => (id === '@piano'
    ? (encId ? getMaterialeTHREE(encId, reRender) : new THREE.MeshStandardMaterial({ color: COL.top, roughness: 0.55, metalness: 0.1 }))
    : getMaterialeTHREE(id, reRender));
  const matCostado = col.costado ? matDa(col.costado) : null;
  const encDef = encId ? MATERIALI.find((m) => m.id === encId) : null;
  const matTop = encId ? getMaterialeTHREE(encId, reRender) : null;
  const spTop = spessorePianoDi(progetto, encDef);

  // Moduli agganciati ai muri + fasce
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    const nx = -dy / L * sgn, ny = dx / L * sgn;
    for (const mm of moduliDiParete(progetto, p.id)) {
      const centro = mm.posizione_mm + mm.larghezza_mm / 2;
      const px = a.x + ux * centro + nx * (PROFONDITA_BASE / 2);
      const py = a.y + uy * centro + ny * (PROFONDITA_BASE / 2);
      const porta = 700;               // porta/anta
      const zocc = zoccoloPerAltezza(porta);
      basiTop.push({ x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE, zocc, topY: zocc + porta });
      zoccoli.push({ x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE, zocc });
      if (mm.categoria === 'fascia') {
        const box = corpo(mm.larghezza_mm, porta, PROFONDITA_BASE, COL.regletta);
        gruppo.add(collocaMobile(box, px, zocc, -py, porta, p.angolo_gradi));
        continue;
      }
      const g = costruisciMobile('base', mm.tipo, { ...mm, altezza_mm: porta }, mm.larghezza_mm, porta, PROFONDITA_BASE, matBase);
      unisciPerMateriale(g);
      gruppo.add(collocaMobile(g, px, zocc, -py, porta, p.angolo_gradi));
      if (mm.tipo === 'forno' || mm.tipo === 'lavello') {
        accessori.push({ id: mm.id, x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE,
          surfaceY: zocc + porta + spTop, placca: mm.tipo === 'forno', lavello: mm.tipo === 'lavello',
          fuochi: mm.fuochi || fuochiPerLarghezza(mm.larghezza_mm) });
      }
    }
  });

  // Quota alta = cima delle colonne (cassa + zoccolo). Pensili e costadi alti
  // si allineano a questa quota; se non ci sono colonne, uso un valore di
  // riferimento (2350).
  // Cima dei PENSILI: a filo con le colonne; senza colonne, con il costado o il
  // pannello alto a terra (es. frigo tra due costadi: il pensile accanto arriva
  // alla loro cima); se no appesi all'altezza standard. Con la DISTANZA DAL
  // FRIGO scelta a mano, tutti i moduli alti vanno a quella cima.
  const { topLine, cimaAlta, scelta: cimaScelta } = quoteAlte(progetto);
  const QUOTA_RIF = topLine != null ? topLine : 2350;
  // Cima di ogni pensile (stessa regola del pensile qui sotto): serve ai
  // costadi alti, che vanno SEMPRE a filo sopra col pensile vicino.
  const cimePensili = (progetto.mobiliLiberi || []).filter((x) => categoriaTipo(x.tipo) === 'pensile')
    .map((x) => { const h = x.altezza_mm || 700; return { x: x.x, y: x.y, cima: (cimaAlta != null ? cimaAlta - h : MONTAGGIO_PENSILE) + h,
      hAnta: h + (antaPensileSporge(progetto.antaPensile, h) ? 20 : 0) }; });

  // CIERRE A TECHO: pannello sopra pensili e colonne fino al soffitto (altezza scelta)
  const cierre = progetto.cierreTecho && progetto.cierreTecho.attivo ? Math.max(20, Number(progetto.cierreTecho.altezza) || 300) : 0;
  const cimeAlte = new Map();      // cima (mm da terra) di pensili e colonne, per la fascia del cierre
  const daPosare = [];             // oggetti del catalogo: quota dal piano vero (dopo i piani)
  const tavoli = [];               // PIANO / TAVOLO: dopo i mobili (la quota «a filo» viene dal piano dell'isola)
  _spTop = spTop;
  // Mobili liberi
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    const dim = dimMobile(m);
    const cx = m.x, cz = -m.y;
    // colore proprio di QUESTO modulo (es. un armadio di stacco), altrimenti quello del gruppo
    const matMio = m.coloreFronte && cat !== 'costado' ? getMaterialeTHREE(m.coloreFronte, reRender) : null;
    let g3d = null;
    if (cat === 'oggetto' && String(m.tipo).startsWith('ogg:')) {
      // OGGETTO DEL CATALOGO (dalle foto): sul piano se sta sopra un mobile basso, se no a terra
      const def = MATERIALI.find((x) => x.id === m.tipo.slice(4));
      const misOgg = def && def.misure ? { w: m.larghezza_mm || def.misure.w, d: m.profondita_mm || def.misure.d, h: m.altezza_mm || def.misure.h } : null;
      // OGGETTO 3D PRONTO (Poly Haven): il modello vero, alle misure scelte
      // COLLEZIONE MODERNA / LUXURY: modellati da noi, con la frutta vera
      // LIBRERIA 3D: prodotti veri (luci, sgabelli, tavoli e sedie, vasi, quadri)
      const pr = def && def.pronto ? oggettoPronto(def, misOgg, reRender) : def && def.moderno ? oggettoModerno(def.moderno, misOgg, reRender, ALT_MURO, m.colore || null)
        : def && def.libreria ? oggettoLibreria(def.libreria, misOgg, reRender, ALT_MURO) : null;
      const r = def && !def.pronto && !def.moderno && !def.libreria && oggettoDaFoto({ ...def, misure: misOgg }, reRender);
      if (pr) {
        // TAVOLI: il loro piano è una superficie d'appoggio (fruttiere, vasi, lampade da tavolo…),
        // con la forma vera (tondo, ovale): gli oggetti si posano sopra come sul piano di lavoro
        if (def.tavolo) pr.traverse((x) => { if (x.isMesh) x.userData.appoggio = true; });
        const og = new THREE.Group(); og.add(pr);
        // come si posa: le LAMPADE e le CAPPE a isola pendono dal soffitto, i QUADRI stanno al muro (centro a 155 cm),
        // sedie, sgabelli e tavoli a TERRA (anche sotto lo sbalzo dell'isola), il resto sul piano
        const posa = def.posa || (def.appeso ? 'appeso' : 'piano');
        // (le CAPPE a parete sono già alla loro altezza: fondo a 160 cm, canna fino al soffitto)
        const y = posa === 'piano' ? quotaAppoggio(progetto, m, spTop) : posa === 'parete' && !def.assoluto ? Math.max(0, Y_QUADRO - (misOgg ? misOgg.h : 0) / 2) : 0;
        og.position.set(cx, y, cz); og.rotation.y = -(m.rot || 0) * Math.PI / 180; g3d = og;
        if (posa === 'piano') { og.userData.appoggiabile = true; if (m.quota_mm != null) og.userData.quotaScelta = m.quota_mm; daPosare.push(og); }
        // LAMPADE ACCESE (si possono spegnere: progetto.lampadeAccese = false)
        if (posa === 'appeso' && def.gruppo === 'luci' && progetto.lampadeAccese !== false) accendiLampada(og);
      } else if (r) {
        const og = new THREE.Group();
        const mesh = new THREE.Mesh(r.geo, r.mat); mesh.castShadow = true; mesh.receiveShadow = true; og.add(mesh);
        og.position.set(cx, quotaAppoggio(progetto, m, spTop), cz); og.rotation.y = -(m.rot || 0) * Math.PI / 180; g3d = og;
        og.userData.appoggiabile = true; if (m.quota_mm != null) og.userData.quotaScelta = m.quota_mm; daPosare.push(og);
      }
    } else if (cat === 'oggetto') {
      // Oggetto 3D (sgabello, decor): posato a terra, nessuno zoccolo/piano.
      const og = costruisciOggetto(m.tipo);
      if (og) { og.position.set(cx, 0, cz); og.rotation.y = -(m.rot || 0) * Math.PI / 180; g3d = og; }
    } else if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      // Se ci sono colonne, la CIMA del pensile va alla cima delle colonne;
      // altrimenti resta appeso all'altezza standard (140 cm da terra).
      let base = cimaAlta != null ? (cimaAlta - h) : MONTAGGIO_PENSILE;
      // sotto il PONTE: la cima del pensile tocca il fondo del ponte
      const fondoPonte = fondoPonteSopra(progetto, m, { topLine, cimaAlta, scelta: cimaScelta });
      if (fondoPonte != null) base = fondoPonte - h;
      pensiliPlan.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, yBottom: base });
      const sporg = antaPensileSporge(progetto.antaPensile, h);
      // PENSILE SOTTO IL PONTE: può avere il suo colore (Colori del ponte → pensili)
      const cp = progetto.coloriPonte || {};
      const matPensPonte = fondoPonte != null && cp.pensili ? getMaterialeTHREE(cp.pensili, reRender) : null;
      const gPens = costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matMio || matPensPonte || matPensile,
        { sporg, porte: gruppoPorte(progetto, m).proprio ? sceltePorte(progetto, m) : null });
      cimeAlte.set(m.id, base + h);
      // LED sotto i pensili (opzionale, con scelta temperatura colore).
      // Il pensile-angolo (diagonale) non lo prende: ha una geometria dedicata.
      if (progetto.led && progetto.led.attivo && m.tipo !== 'pensile-angolo-45' && (fondoPonte == null || ledPonte(progetto) !== 'ponte')) {
        const conPannello = progetto.schienale && progetto.schienale.attivo;
        // pensile APERTO con l'anta da 72 / 92: il fondo scende di 2 cm, il LED va sotto di lui
        const gLed = apertoDi(m) && sporg ? (() => { const x = new THREE.Group(); x.position.y = -20; gPens.add(x); return x; })() : gPens;
        aggiungiLedPensile(gLed, dim.w, h, dim.d, ledHex(progetto), conPannello ? SP_SCHIENALE : 0);
        if (m.tipo === 'pensile-angolo') {                       // anche sotto il secondo braccio
          const gB = new THREE.Group();
          gB.rotation.y = Math.PI / 2; gB.position.z = PROFONDITA_PENSILE / 2;
          aggiungiLedPensile(gB, dim.d - PROFONDITA_PENSILE, h, dim.w, ledHex(progetto), conPannello ? SP_SCHIENALE : 0);
          gPens.add(gB);
        }
      }
      if (m.tipo === 'pensile-angolo') {
        // La L è asimmetrica: il 3D usa -rot e la pianta +rot, quindi con
        // collocaMobile apparirebbe specchiata/girata agli angoli ruotati
        // (90/270). Uso +rot così la L 3D combacia con la pianta.
        gPens.position.set(cx, base + h / 2, cz);
        gPens.rotation.y = (m.rot || 0) * Math.PI / 180;
        g3d = gPens;
      } else {
        g3d = collocaMobile(gPens, cx, base, cz, h, m.rot);
      }
    } else if (cat === 'colonna') {
      // L'altezza della colonna (es. 2200) è la CASSA; il totale è cassa +
      // zoccolo. Così un costado da 2350 (= 2200 + 15 di piedini) combacia.
      const h = m.altezza_mm || 2200;
      const zocc = zoccoloColonna(progetto, m);
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h: h + zocc, cat: 'colonna' });
      const gCol = costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matMio || matColonna);
      cimeAlte.set(m.id, zocc + h);
      g3d = collocaMobile(gCol, cx, zocc, cz, h, m.rot);
    } else if (cat === 'frigo') {
      // FRIGO libero: a terra, niente zoccolo; il piano di lavoro si ferma contro
      const h = m.altezza_mm || 1850;
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h, cat: 'colonna' });
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, null), cx, 0, cz, h, m.rot);
    } else if (cat === 'altillo') {
      // MOBILE SOPRA FRIGO: cima a filo con il costado / la colonna accanto
      const h = m.altezza_mm || 350;
      const base = baseAltillo(progetto, m, topLine, cimaAlta, cimaScelta);
      const cpA = progetto.coloriPonte || {};
      const matPonte = m.tipo === 'ponte' && cpA.ponte ? getMaterialeTHREE(cpA.ponte, reRender) : null;
      const gA = costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matMio || matPonte || matColonna || matPensile,
        { porte: m.tipo === 'ponte' ? sceltePorte(progetto, m) : null });
      cimeAlte.set(m.id, base + h);
      // LED SOTTO IL PONTE dove sotto non ci sono pensili (il fondo del ponte si vede: luce sul piano);
      // con il pannello sotto il ponte li porta lui, più in basso. Scelta «Sotto il ponte» o «Sotto entrambi»
      if (m.tipo === 'ponte' && progetto.led && progetto.led.attivo && ledPonte(progetto) !== 'pensili' && !spessorePannelloPonte(progetto)
        && !(progetto.mobiliLiberi || []).some((o) => categoriaTipo(o.tipo) === 'pensile' && siSovrappongono(o, m))) {
        aggiungiLedPensile(gA, dim.w, h, dim.d, ledHex(progetto), 0);
      }
      g3d = collocaMobile(gA, cx, base, cz, h, m.rot);
    } else if (cat === 'regletta') {
      const h = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(h);
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d), cx, zocc, cz, h, m.rot);
    } else if (cat === 'pannello') {
      // Pannello su misura: box 18 mm di spessore, finitura come le ante.
      // Va da terra fino all'altezza scelta, niente zoccolo e niente top.
      const h = m.altezza_mm || 2200;
      // colore suo (scelto toccando il pannello) o come le ante dei mobili bassi
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matMio || matBase || COL.anta), cx, 0, cz, h, m.rot);
    } else if (cat === 'costado') {
      let h = m.altezza_mm || 850;
      // Costado "alto" (profondità da pensile): sta in alto, appeso all'altezza
      // di montaggio dei pensili, non per terra.
      // Il costado ALTO è a filo SOPRA col pensile più vicino (qualunque sia
      // la porta: 70, 72, 90, 92) e ha il colore delle ante dei pensili.
      const alto = (m.profondita_mm || 620) < 500;
      let base = alto ? MONTAGGIO_PENSILE : cimaCostadoAlto(m, topLine) - h;
      if (alto) {
        let vicino = null, dMin = Infinity;
        for (const pz of cimePensili) { const dd = Math.hypot(pz.x - m.x, pz.y - m.y); if (dd < dMin) { dMin = dd; vicino = pz; } }
        // altezza = quella delle ante del pensile vicino (70, 72, 90, 92):
        // cambia da sola quando si sceglie l'anta sporgente
        if (vicino && dMin < 2500) { h = vicino.hAnta; base = vicino.cima - h; }
        else if (topLine != null) base = topLine - h;
      }
      fianchi.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, h, cat: 'costado' });
      // Colore: costadi DIVERSI → quello scelto per questo costado; UGUALI (o
      // non ancora scelto) → come sempre: alto = ante dei pensili, basso = colore costadi
      const matProprio = progetto.costadiDiversi && m.colore ? matDa(m.colore) : null;
      // Senza un colore scelto per i costadi il costado prende le ANTE vicine
      // (mai il crema del corpo): alto → pensili, a tutta altezza → colonne,
      // basso → mobili bassi
      const matC = matProprio || (alto ? (matPensile || matCostado)
        : (matCostado || (h >= 1500 ? (matColonna || matBase) : matBase))) || COL.costado;
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matC), cx, base, cz, h, m.rot);
    } else if (cat === 'tavolo') {
      tavoli.push(m);
    } else {
      // base / lavello / forno: porta = altezza scelta, zoccolo 150/100.
      // Il piano di lavoro NON si disegna qui: è un pezzo unico continuo (dopo).
      const porta = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(porta);
      const cieco = infoAngoloCieco(progetto, m);
      let ciecoOpt = cieco;
      if (cieco && cieco.coperto) {
        const rd = progetto.reglettaAngolo || { base: 30, spessore: SPESSORE_ANTA };
        const spess = (rd.spessore != null) ? rd.spessore : SPESSORE_ANTA;
        // Sul mobile a fronte orizzontale va il braccio lungo (base+spessore),
        // sul mobile a fronte verticale va il braccio corto (base).
        const legOnMe = cieco.horizMe ? (rd.base + spess) : rd.base;
        ciecoOpt = { ...cieco, blindExtra: legOnMe + FUGA_W };
      }
      if (m.tipo === 'base-angolo') {
        // BASE ANGOLO a L: come il pensile angolo usa +rot (L asimmetrica);
        // piano e zoccolo = due rettangoli, uno per braccio
        const gL = costruisciMobile(cat, m.tipo, m, dim.w, porta, dim.d, matMio || matBase);
        gL.position.set(cx, zocc + porta / 2, cz);
        gL.rotation.y = (m.rot || 0) * Math.PI / 180;
        g3d = gL;
        const P = Math.min(m.profBraccio_mm || PROFONDITA_BASE, Math.min(dim.w, dim.d) - 10), hw = dim.w / 2, hd = dim.d / 2;
        const rr = (m.rot || 0) * Math.PI / 180, c = Math.cos(rr), s = Math.sin(rr);
        const vp = (lx, ly) => ({ x: m.x + lx * c - ly * s, y: m.y + lx * s + ly * c });
        const A = vp(0, hd - P / 2), B = vp(-hw + P / 2, -P / 2);
        const bracci = [{ ...A, rot: -(m.rot || 0), w: dim.w, d: P }, { ...B, rot: -(m.rot || 0) - 90, w: dim.d - P, d: P }];
        for (const br of bracci) {
          basiTop.push({ x: br.x, y: br.y, rot: br.rot, w: br.w, d: br.d, zocc, topY: zocc + porta });
          zoccoli.push({ x: br.x, y: br.y, rot: br.rot, w: br.w, d: br.d, zocc });
        }
      } else {
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, porta, dim.d, matMio || matBase, { cieco: ciecoOpt }), cx, zocc, cz, porta, m.rot);
      if (cieco && progetto.autoRegletta !== false) renderRegolettaAngolo(cieco, m, porta, zocc, matBase, progetto.reglettaAngolo);
      basiTop.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc, topY: zocc + porta });
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      }
      // Placca / lavello (tipi forno/lavello oppure aggiunti a mano): sopra il top
      const hasPlacca = m.tipo === 'forno' || m.placca;
      const hasLavello = m.tipo === 'lavello' || m.lavello;
      if (hasPlacca || hasLavello) {
        accessori.push({ id: m.id, x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d,
          surfaceY: zocc + porta + spTop, placca: hasPlacca, lavello: hasLavello,
          fuochi: m.fuochi || fuochiPerLarghezza(dim.w) });
      }
    }
    if (g3d) { unisciPerMateriale(g3d); g3d.userData.mobId = m.id; if (m.id === selId) evidenzia(g3d); gruppo.add(g3d); }
  }

  // PANNELLO SOTTO IL PONTE: copre il fondo dei moduli del ponte, per tutta la
  // fila, sopra i pensili piccoli; colore del ponte. Con i LED accesi e senza
  // pensili sotto, la luce sta sotto il pannello.
  {
    const spP = spessorePannelloPonte(progetto);
    const q = { topLine, cimaAlta, scelta: cimaScelta };
    for (const f of pannelliSottoPonte(progetto)) {
      const pz = f.ids.map((id) => (progetto.mobiliLiberi || []).find((o) => o.id === id)).filter(Boolean);
      if (!pz.length) continue;
      const fondo = Math.min(...pz.map((o) => baseAltillo(progetto, o, q.topLine, q.cimaAlta, q.scelta)));
      const primo = pz[0];
      const cpP = progetto.coloriPonte || {};
      const idPann = cpP.pannello || primo.coloreFronte || cpP.ponte || null;   // pannello: il suo colore, se no come il ponte
      const mat = (idPann ? getMaterialeTHREE(idPann, reRender) : null) || matColonna || matPensile || COL.anta;
      const gP = new THREE.Group();
      gP.add(corpo(f.w, spP, f.d, mat));
      const conPensili = (progetto.mobiliLiberi || []).some((o) => categoriaTipo(o.tipo) === 'pensile' && pz.some((p) => siSovrappongono(o, p)));
      // LED sotto il pannello: sotto ogni modulo del ponte che NON ha un pensile sotto (lì il fondo si vede)
      if (progetto.led && progetto.led.attivo && ledPonte(progetto) !== 'pensili') {
        if (!conPensili) aggiungiLedPensile(gP, f.w, spP, f.d, ledHex(progetto), 0);
        else {
          const r = (f.rot || 0) * Math.PI / 180;
          for (const o of pz) {
            if ((progetto.mobiliLiberi || []).some((q) => categoriaTipo(q.tipo) === 'pensile' && siSovrappongono(q, o))) continue;
            const gL = new THREE.Group();
            gL.position.x = (o.x - f.x) * Math.cos(r) - (o.y - f.y) * Math.sin(r);
            aggiungiLedPensile(gL, dimMobile(o).w, spP, f.d, ledHex(progetto), 0);
            gP.add(gL);
          }
        }
      }
      gruppo.add(collocaMobile(gP, f.x, fondo - spP, -f.y, spP, f.rot));
    }
  }

  // CIERRE A TECHO: segue il fronte dei mobili (colonne a filo colonne, pensili a
  // filo pensili) con i pezzi che rientrano dove cambia la profondità
  if (cierre) {
    for (const b of fasceCierreTecho(progetto, 20)) {
      const yb = Math.max(...b.ids.map((id) => cimeAlte.get(id) || 0));
      const mat = (b.gruppo === 'pensile' ? matPensile : matColonna) || COL.anta;
      const am = (b.a0 + b.a1) / 2;
      const gF = new THREE.Group();
      gF.rotation.y = -b.rot * Math.PI / 180;
      if (b.tipo === 'rientro' || b.tipo === 'testata') {
        const fm = (b.f0 + b.f1) / 2;
        gF.position.set(am * b.ux + fm * b.fx, yb + cierre / 2, -(am * b.uy + fm * b.fy));
        const geo = new THREE.BoxGeometry(b.a1 - b.a0, cierre, b.f1 - b.f0);
        const ms = new THREE.Mesh(geo, (mat && mat.isMaterial) ? mat : new THREE.MeshStandardMaterial({ color: mat, roughness: 0.6, metalness: 0.08 }));
        ms.castShadow = true; gF.add(ms);
        gF.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), matOro));
      } else {
        gF.position.set(am * b.ux + b.front * b.fx, yb + cierre / 2, -(am * b.uy + b.front * b.fy));   // centro sulla faccia davanti
        pannello(gF, 0, 0, -20, b.a1 - b.a0, cierre, mat);
      }
      gruppo.add(gF);
    }
  }

  // Zoccolo continuo (un unico pezzo per fila: basi + colonne insieme) +
  // piano di lavoro continuo che non entra nei costadi/colonne
  renderZoccoliContinui(zoccoli, materialeZoccolo(progetto.zoccoloColore, reRender));
  // Pannello dietro il piano (schienale): stesso materiale del piano o un altro
  const sch = progetto.schienale && progetto.schienale.attivo ? progetto.schienale : null;
  let schienale = null;
  if (sch) {
    const matSch = sch.materiale ? getMaterialeTHREE(sch.materiale, reRender) : null;
    const defSch = sch.materiale ? MATERIALI.find((x) => x.id === sch.materiale) : null;
    schienale = {
      mat: matSch ? (defSch && defSch.categoria === 'encimera' ? materialePerTop(matSch) : matSch) : null,   // null = come il piano
      pensili: pensiliPlan,
      muri: full.map((p, i) => (p.assente ? null : { a: vertici[i], b: vertici[i + 1] })).filter(Boolean),
    };
  }
  const muriPiano = full.map((p, i) => (p.assente ? null : { a: vertici[i], b: vertici[i + 1] })).filter(Boolean);
  // PIANO / TAVOLO: la lastra, gli appoggi e dove il piano dell'isola si deve aprire
  const tagliPiano = renderTavoli(tavoli, basiTop, spTop, matTop, muriPiano, selId, reRender);
  renderTopContinui(basiTop, fianchi, spTop, matTop, accessori.filter((a) => a.lavello || a.placca), schienale, muriPiano, tagliPiano);
  // Oggetti: sul piano che c'è DAVVERO sotto (anche la parte di piano che sporge
  // oltre i mobili, es. l'isola dal lato sgabelli, o il piano allungato nell'angolo)
  if (daPosare.length) {
    gruppo.updateMatrixWorld(true);
    const supT = superficiAppoggio(), supNoRip = supT.filter((o) => !o.userData.ripianoAperto);
    for (const og of daPosare) {
      const q = og.userData.quotaScelta;
      og.position.y = q != null ? quotaPiani(og.position.x, og.position.z, supT, q + 40)
        : Math.max(og.position.y, quotaPiani(og.position.x, og.position.z, supNoRip));
    }
  }
  // Lavello, piano cottura e rubinetto SOPRA il top
  for (const a of accessori) aggiungiAccessorioTop(a, progetto.finiture || {});

  costruisciLedContinui();          // LED: una striscia unica per ogni fila di pensili, luce uniforme
  applicaLuceEsterna(luceEsternaDi(progetto));
  uvInScala(gruppo);
  try { riflettiStanza(gruppo, renderer); } catch (_) { /* senza riflessi va bene lo stesso */ }
  // LED sotto i pensili: la loro luce tinge anche le foto (piano, pannello dietro, ante)
  impostaTintaLed(progetto.led && progetto.led.attivo ? ledHex(progetto) : null);
  if (reframe) inquadra(bb, direzioneStanza(full, vertici));
  // OMBRE: tutto fa ombra (muri e pavimento la ricevono soltanto), inquadrate sulla cucina
  // le LAMPADE non fanno ombra (sono loro la luce): userData.senzaOmbra
  ombreSuTutto(gruppo, (o) => !!(o.userData.muroNormale || o.userData.pavimento || o.userData.senzaOmbra));
  if (luceOmbre && renderer) {
    const box = new THREE.Box3();
    for (const o of gruppo.children) if (!o.userData.muroNormale && !o.userData.pavimento && !o.userData.soffitto && !o.isGridHelper) box.expandByObject(o);
    // la luce entra dal lato aperto della stanza (come da una finestra), alta e un
    // po' di lato: i frontali sono illuminati, le ombre cadono corte verso i muri
    const d = direzioneStanza(full, vertici) || { x: 0.6, z: 0.8 };
    const ca = Math.cos(0.45), sa = Math.sin(0.45);
    const dx = d.x * ca - d.z * sa, dz = d.x * sa + d.z * ca;
    inquadraOmbre(renderer, luceOmbre, box, new THREE.Vector3(dx, 1.7, dz));
    if (luceRiempi) luceRiempi.position.set(-dx * 4000 + d.x * 1500, 2500, -dz * 4000 + d.z * 1500);
  }
  if (resa) resa.cambiato(); else if (renderer) renderer.render(scene, camera);
}


/**
 * Disegna un piano di lavoro CONTINUO: raggruppa le basi che stanno sulla
 * stessa fila (stesso orientamento, stessa linea e stessa quota) e ne copre
 * l'intera lunghezza con un unico pezzo, invece di un pezzo per modulo.
 */
/** Normalizza una rotazione a 0/90/180/270. */
function rotNorm(r) { return ((Math.round((r || 0) / 90) * 90) % 360 + 360) % 360; }

/**
 * Divide gli elementi di una fila (stessa linea/quota) in tratti CONTIGUI:
 * dove c'è un vuoto (es. una colonna in mezzo) si spezza, così top e zoccolo
 * non attraversano i buchi. Ritorna [{lo, hi, items}] in coordinate "along".
 */
function tratti(items, c, s) {
  const arr = items.map((b) => {
    const along = b.x * c + b.y * s;
    return { b, lo: along - b.w / 2, hi: along + b.w / 2 };
  }).sort((p, q) => p.lo - q.lo);
  const runs = [];
  let cur = null;
  for (const it of arr) {
    if (!cur || it.lo > cur.hi + 60) { cur = { lo: it.lo, hi: it.hi, items: [it.b] }; runs.push(cur); }
    else { cur.hi = Math.max(cur.hi, it.hi); cur.items.push(it.b); }
  }
  return runs;
}

/** Proiezione di un fianco (costado/colonna) sull'asse della fila: [near, far]. */
function proiettaFianco(f, c, s) {
  const along = f.x * c + f.y * s;
  const perp = f.x * (-s) + f.y * c;
  const fc = Math.cos((f.rot || 0) * Math.PI / 180), fs = Math.sin((f.rot || 0) * Math.PI / 180);
  const hU = (f.w / 2) * Math.abs(c * fc + s * fs) + (f.d / 2) * Math.abs(-c * fs + s * fc);
  return { along, perp, near: along - hU, far: along + hU };
}

/**
 * Piano di lavoro CONTINUO che rispetta i costadi e le colonne:
 * - alle estremità libere ha una piccola sporgenza;
 * - se c'è una COLONNA (o un costado a tutta altezza) il top si ferma lì
 *   (parte dalla colonna, non le entra sopra);
 * - se c'è un COSTADO basso il top arriva fino alla sua faccia ESTERNA
 *   (il modulo si appoggia al costado, il top lo copre).
 */
// Cache: dato il materiale "nudo" dell'encimera, ritorna un nuovo materiale
// con la texture ruotata di 90 gradi. Serve per il TOP della cucina, dove
// la venatura del legno (o la direzione della lastra) deve andare lungo la
// LUNGHEZZA del top, non lungo la profondita'. Le immagini-texture sono
// generate con la fibra verticale: senza rotazione risulterebbero
// trasversali al top.
// Nota: NON cloniamo il materiale originale (mat.clone() di Three.js puo'
// perdere setting specifici). Ricostruiamo un materiale standard da zero
// copiando solo map / color / roughness / metalness. E' sufficiente qui.
const _matTopCache = new WeakMap();
const _texTopCache = new WeakMap();
function materialePerTop(mat) {
  if (!mat || !mat.map) return mat;
  let tex = _texTopCache.get(mat.map);
  if (!tex) {
    tex = mat.map.clone();
    tex.colorSpace = mat.map.colorSpace || THREE.SRGBColorSpace;
    // stessa ripetizione della foto originale (a specchio per le lastre in scala vera)
    tex.wrapS = mat.map.wrapS || THREE.RepeatWrapping;
    tex.wrapT = mat.map.wrapT || THREE.RepeatWrapping;
    tex.anisotropy = mat.map.anisotropy || 4;
    tex.center.set(0.5, 0.5);
    // MISURA VERA (lastra 3400 × 1400, pezzo da 57 × 57…): la foto NON si gira, la venatura
    // corre lungo il piano come nella realtà (girata di 90° le misure andavano sul lato sbagliato:
    // foto stirata e venature di traverso). Le foto senza misura restano girate come sempre.
    tex.rotation = mat.userData && mat.userData.campioneVero ? 0 : Math.PI / 2;
    tex.needsUpdate = true;
    _texTopCache.set(mat.map, tex);
  }
  const hit = _matTopCache.get(mat);
  if (hit) { hit.map = tex; hit.needsUpdate = true; return hit; }
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    userData: mat.userData && mat.userData.campioneMm ? { campioneMm: mat.userData.campioneMm } : {},
  });
  pianoComeFoto(m);          // colori, sfumature e venature identici alla foto
  m.userData.fotoTop = true; // foto realistica: piano satinato (riflessi morbidi)
  // PIETRA SATINATA: la foto resta identica, sopra un riflesso morbido della stanza e delle luci
  // (come un compact / marmo vero), non più carta stampata opaca
  Object.assign(m, { roughness: 0.38, metalness: 0.0, envMapIntensity: 0.9 });
  m.userData.ngSpec = 0.32;
  _matTopCache.set(mat, m);
  return m;
}

/** Il pannello dietro il piano è VERTICALE: stessa foto del piano ma con la
 *  luce di riferimento delle pareti (sennò viene più scuro della foto). */
const _matSchCache = new WeakMap();
function materialePerSchienale(mat) {
  if (!mat || !mat.isMaterial || !mat.map || !mat.userData || !mat.userData.ngFoto) return mat;
  let m = _matSchCache.get(mat);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: mat.map, color: 0xffffff,
      userData: mat.userData.campioneMm ? { campioneMm: mat.userData.campioneMm } : {} });
    pannelloComeFoto(m);
    _matSchCache.set(mat, m);
  }
  m.map = mat.map;
  return m;
}

/** Piano di lavoro con uno o più FORI rettangolari (lavelli): UNA SOLA
 *  lastra con i fori ritagliati (niente pezzi accostati: nessuna giunta né
 *  riga sul piano, venatura continua). Coordinate locali centrate:
 *  u = lungo la fila, v = profondità; foro = { u, v, w, d }. */
function slabConFori(len, thickness, depth, mat, fori) {
  const halfU = len / 2, halfV = depth / 2;
  const hs = fori.map((f) => ({
    u0: Math.max(-halfU + 2, f.u - f.w / 2), u1: Math.min(halfU - 2, f.u + f.w / 2),
    v0: Math.max(-halfV + 2, f.v - f.d / 2), v1: Math.min(halfV - 2, f.v + f.d / 2),
  })).filter((h) => h.u1 - h.u0 > 5 && h.v1 - h.v0 > 5);
  if (!hs.length) return corpo(len, thickness, depth, mat);
  // Profilo in pianta (x = u, y = −v), poi estruso per lo spessore
  const forma = new THREE.Shape();
  forma.moveTo(-halfU, -halfV); forma.lineTo(halfU, -halfV); forma.lineTo(halfU, halfV); forma.lineTo(-halfU, halfV); forma.closePath();
  for (const h of hs) {
    const foro = new THREE.Path();
    foro.moveTo(h.u0, -h.v1); foro.lineTo(h.u0, -h.v0); foro.lineTo(h.u1, -h.v0); foro.lineTo(h.u1, -h.v1); foro.closePath();
    forma.holes.push(foro);
  }
  const geo = new THREE.ExtrudeGeometry(forma, { depth: thickness, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);                 // estrusione verso l'alto, y forma → z = v
  geo.translate(0, -thickness / 2, 0);       // centrata come un BoxGeometry
  // UV come la faccia sopra di una lastra intera (la texture non riparte ai fori)
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + halfU) / len, 1 - (pos.getZ(i) + halfV) / depth);
  uv.needsUpdate = true;
  const materiale = (mat && mat.isMaterial) ? mat : new THREE.MeshStandardMaterial({ color: mat, roughness: 0.7, metalness: 0.05 });
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, materiale);
  mesh.receiveShadow = true;
  g.add(mesh);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), matOro));
  return g;
}

/**
 * Lastra del piano con i TAGLI dei piani/tavoli che la attraversano (rettangoli in coordinate
 * locali u, v che possono uscire dai bordi) e i fori dei lavelli. Il resto della lastra si trova
 * su una griglia (i bordi dei tagli) e se ne ricava il contorno: un pezzo con una tacca, due pezzi
 * separati se il tavolo la attraversa tutta, o un buco in mezzo. null = non resta niente.
 */
function slabRitagliata(len, thickness, depth, mat, fori, tagli) {
  const halfU = len / 2, halfV = depth / 2;
  // in coordinate della forma: x = u, y = −v
  const tg = tagli.map((t) => ({ x0: t.u0, x1: t.u1, y0: -t.v1, y1: -t.v0 }));
  const unici = (a) => [...new Set(a.map((x) => Math.round(x * 10) / 10))].sort((p, q) => p - q);
  const xs = unici([-halfU, halfU, ...tg.flatMap((t) => [t.x0, t.x1]).filter((x) => x > -halfU + 1 && x < halfU - 1)]);
  const ys = unici([-halfV, halfV, ...tg.flatMap((t) => [t.y0, t.y1]).filter((y) => y > -halfV + 1 && y < halfV - 1)]);
  const NX = xs.length - 1, NY = ys.length - 1;
  const pieno = [];
  let vuote = 0;
  for (let i = 0; i < NX; i++) {
    pieno.push([]);
    for (let j = 0; j < NY; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      const dentro = tg.some((t) => cx > t.x0 && cx < t.x1 && cy > t.y0 && cy < t.y1);
      pieno[i].push(!dentro); if (dentro) vuote++;
    }
  }
  if (!vuote) return fori.length ? slabConFori(len, thickness, depth, mat, fori) : corpo(len, thickness, depth, mat);
  if (vuote === NX * NY) return null;
  const P = (i, j) => i >= 0 && j >= 0 && i < NX && j < NY && pieno[i][j];
  // lati di bordo, orientati con il pieno a SINISTRA (contorni esterni antiorari, buchi orari)
  const lati = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    if (!pieno[i][j]) continue;
    if (!P(i, j - 1)) lati.push([i, j, i + 1, j]);
    if (!P(i + 1, j)) lati.push([i + 1, j, i + 1, j + 1]);
    if (!P(i, j + 1)) lati.push([i + 1, j + 1, i, j + 1]);
    if (!P(i - 1, j)) lati.push([i, j + 1, i, j]);
  }
  const daPunto = new Map();
  lati.forEach((l, n) => { const key = `${l[0]},${l[1]}`; (daPunto.get(key) || daPunto.set(key, []).get(key)).push(n); });
  const usato = new Array(lati.length).fill(false), anelli = [];
  for (let n0 = 0; n0 < lati.length; n0++) {
    if (usato[n0]) continue;
    const anello = []; let n = n0;
    while (n != null && !usato[n]) {
      usato[n] = true; const l = lati[n]; anello.push([xs[l[0]], ys[l[1]]]);
      n = (daPunto.get(`${l[2]},${l[3]}`) || []).find((q) => !usato[q]);
    }
    // via i punti in mezzo a un lato dritto
    const pulito = anello.filter((p, q) => {
      const a = anello[(q - 1 + anello.length) % anello.length], b = anello[(q + 1) % anello.length];
      return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
    });
    if (pulito.length >= 3) anelli.push(pulito);
  }
  const area = (a) => { let s2 = 0; for (let q = 0; q < a.length; q++) { const p = a[q], r = a[(q + 1) % a.length]; s2 += p[0] * r[1] - r[0] * p[1]; } return s2 / 2; };
  const dentroPoli = (x, y, a) => { let ok = false; for (let q = 0, r = a.length - 1; q < a.length; r = q++) { const [xi, yi] = a[q], [xj, yj] = a[r]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok; } return ok; };
  const esterni = anelli.filter((a) => area(a) > 0), buchi = anelli.filter((a) => area(a) < 0);
  const hs = fori.map((f) => ({
    u0: Math.max(-halfU + 2, f.u - f.w / 2), u1: Math.min(halfU - 2, f.u + f.w / 2),
    v0: Math.max(-halfV + 2, f.v - f.d / 2), v1: Math.min(halfV - 2, f.v + f.d / 2),
  })).filter((h) => h.u1 - h.u0 > 5 && h.v1 - h.v0 > 5);
  const materiale = (mat && mat.isMaterial) ? mat : new THREE.MeshStandardMaterial({ color: mat, roughness: 0.7, metalness: 0.05 });
  const g = new THREE.Group();
  for (const est of esterni) {
    const forma = new THREE.Shape(est.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const b of buchi) if (dentroPoli(b[0][0] + 0.01, b[0][1] + 0.01, est) || dentroPoli((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, est)) forma.holes.push(new THREE.Path(b.map(([x, y]) => new THREE.Vector2(x, y))));
    for (const h of hs) {
      if (!dentroPoli((h.u0 + h.u1) / 2, -(h.v0 + h.v1) / 2, est)) continue;
      const foro = new THREE.Path();
      foro.moveTo(h.u0, -h.v1); foro.lineTo(h.u0, -h.v0); foro.lineTo(h.u1, -h.v0); foro.lineTo(h.u1, -h.v1); foro.closePath();
      forma.holes.push(foro);
    }
    const geo = new THREE.ExtrudeGeometry(forma, { depth: thickness, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -thickness / 2, 0);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let q = 0; q < pos.count; q++) uv.setXY(q, (pos.getX(q) + halfU) / len, 1 - (pos.getZ(q) + halfV) / depth);
    uv.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, materiale);
    mesh.receiveShadow = true; mesh.castShadow = true;
    g.add(mesh);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), matOro));
  }
  return g.children.length ? g : null;
}

/**
 * PIANO / TAVOLO libero (isole di design): una lastra del materiale scelto (la pietra del piano,
 * un legno…), lunga × larga × spessa come vuoi, all'altezza scelta o A FILO del piano dell'isola.
 * Dove il piano è libero (non entra nei mobili e non tocca un muro) sta in piedi con il suo
 * appoggio: fianco a cascata nello stesso materiale, gamba in vetro o due gambe.
 * Ritorna i TAGLI per il piano dell'isola: dove la lastra passa alla sua quota, il piano si apre.
 */
const _matVetroTavolo = new THREE.MeshStandardMaterial({ color: 0xdbe8e3, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
_matVetroTavolo.userData.vetro = true;
const _matBordoVetro = new THREE.LineBasicMaterial({ color: 0x8fb3a6, transparent: true, opacity: 0.75 });
const _matGiunta = new THREE.LineBasicMaterial({ color: 0x2a2520, transparent: true, opacity: 0.45 });
const _matGambe = {
  'gambe-nere': new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.55, metalness: 0.35 }),
  'gambe-oro': new THREE.MeshStandardMaterial({ color: 0xe2bf72, roughness: 0.3, metalness: 0.75 }),      // come le maniglie «Oro spazzolato»
};
_matGambe['una-nera'] = _matGambe['gambe-nere']; _matGambe['una-oro'] = _matGambe['gambe-oro'];
function renderTavoli(tavoli, basiTop, spTop, matTop, muri, selId, reRender) {
  const tagli = [];
  if (!tavoli.length) return tagli;
  // un punto della pianta (x, y) è dentro il mobile basso b? (stessa rotazione dei mobili nel 3D)
  const dentroBase = (x, y, b) => {
    const t = -(b.rot || 0) * Math.PI / 180, X = x - b.x, Z = -(y - b.y);
    const lx = X * Math.cos(t) - Z * Math.sin(t), lz = X * Math.sin(t) + Z * Math.cos(t);
    return Math.abs(lx) <= b.w / 2 + 1 && Math.abs(lz) <= (b.d || PROFONDITA_BASE) / 2 + 1;
  };
  for (const m of tavoli) {
    const w = Math.max(100, m.larghezza_mm || 1800), d = Math.max(100, m.profondita_mm || 900);
    const strati = Math.max(1, Math.min(3, m.strati || 1)), sp = Math.max(6, m.spessore_mm || 40) * strati;
    const g = new THREE.Group();
    g.position.set(m.x, 0, -m.y); g.rotation.y = -(m.rot || 0) * Math.PI / 180; g.updateMatrixWorld(true);
    const inPianta = (lx, lz) => { const v = g.localToWorld(new THREE.Vector3(lx, 0, lz)); return { x: v.x, y: -v.z }; };
    // QUOTA: scritta a mano, o a filo del piano dei mobili sotto (o del più vicino)
    let quota = Math.max(sp + 50, m.altezza_mm || 750);
    if (m.quota === 'filo') {
      let sopra = -Infinity;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2; j++) {
        const p = inPianta(-w / 2 + (w * i) / 6, -d / 2 + (d * j) / 2);
        for (const b of basiTop) if (dentroBase(p.x, p.y, b)) sopra = Math.max(sopra, b.topY);
      }
      if (!Number.isFinite(sopra)) {
        let dMin = Infinity;
        for (const b of basiTop) { const dd = Math.hypot(b.x - m.x, b.y - m.y); if (dd < dMin) { dMin = dd; sopra = b.topY; } }
      }
      quota = (Number.isFinite(sopra) ? sopra : 850) + spTop;
    }
    // MATERIALE: quello scelto, o come il piano della cucina
    const def = m.materiale ? MATERIALI.find((x) => x.id === m.materiale) : null;
    const base = m.materiale ? getMaterialeTHREE(m.materiale, reRender) : matTop;
    const pietra = !m.materiale || (def && def.categoria === 'encimera');
    const matLastra = base ? (pietra ? materialePerTop(base) : base) : new THREE.MeshStandardMaterial({ color: COL.top, roughness: 0.55, metalness: 0.1 });
    const matFianco = base ? (pietra ? (materialePerSchienale(base) || base) : base) : matLastra;
    const lastra = corpo(w, sp, d, matLastra);
    lastra.position.y = quota - sp / 2;
    lastra.traverse((o) => { if (o.isMesh) { o.userData.appoggio = true; o.castShadow = true; o.receiveShadow = true; } if (o.isLineSegments) o.visible = false; });
    g.add(lastra);
    // PANNELLI INCOLLATI uno sopra l'altro: la riga di giunta si vede sul bordo, tutto intorno
    for (let k = 1; k < strati; k++) {
      const y = quota - (sp * k) / strati, e = 0.6;
      const pts = [[-w / 2 - e, -d / 2 - e], [w / 2 + e, -d / 2 - e], [w / 2 + e, d / 2 + e], [-w / 2 - e, d / 2 + e]];
      const geo = new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => { const q = pts[(i + 1) % 4]; return [new THREE.Vector3(p[0], y, p[1]), new THREE.Vector3(q[0], y, q[1])]; }));
      g.add(new THREE.LineSegments(geo, _matGiunta));
    }
    // APPOGGI: alle estremità libere (non dentro i mobili, non contro un muro)
    const app = m.appoggio || 'cascata';
    const hGamba = quota - sp;
    for (const e of [-1, 1]) {
      if (app === 'nessuno' || hGamba < 30) break;
      const prove = [-d / 2 + 60, 0, d / 2 - 60].map((lz) => inPianta(e * (w / 2 - 40), lz));
      const nelMobile = prove.some((p) => basiTop.some((b) => dentroBase(p.x, p.y, b)));
      const alMuro = prove.filter((p) => muri.some((mu) => distSegmento(p, mu.a, mu.b) < 90)).length >= 2;
      if (app !== 'cascata-due' && (nelMobile || alMuro)) continue;
      const xE = e * (w / 2);
      if (app === 'cascata' || app === 'cascata-due') {
        // fianco a cascata: stesso materiale e spessore, a filo della testa della lastra, fino a terra
        const f = corpo(sp, hGamba, d, matFianco);
        f.position.set(xE - e * sp / 2, hGamba / 2, 0);
        f.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } if (o.isLineSegments) o.visible = false; });
        g.add(f);
      } else if (app === 'vetro') {
        const geo = new THREE.BoxGeometry(12, hGamba, Math.max(100, d - 160));
        const v = new THREE.Mesh(geo, _matVetroTavolo); v.renderOrder = 2; v.userData.senzaOmbra = true;
        v.position.set(xE - e * 90, hGamba / 2, 0);
        v.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), _matBordoVetro));
        g.add(v);
      } else if (app === 'una-nera' || app === 'una-oro') {
        // UNA gamba sola, al centro dell'estremità libera
        const gm = new THREE.Mesh(new THREE.BoxGeometry(80, hGamba, 80), _matGambe[app]);
        gm.position.set(xE - e * 140, hGamba / 2, 0); gm.castShadow = true;
        g.add(gm);
      } else if (_matGambe[app]) {
        for (const lz of [-d / 2 + 90, d / 2 - 90]) {
          const gm = new THREE.Mesh(new THREE.BoxGeometry(50, hGamba, 50), _matGambe[app]);
          gm.position.set(xE - e * 90, hGamba / 2, lz); gm.castShadow = true;
          g.add(gm);
        }
      }
    }
    g.userData.mobId = m.id; if (m.id === selId) evidenzia(g);
    gruppo.add(g);
    tagli.push({ angoli: [inPianta(-w / 2, -d / 2), inPianta(w / 2, -d / 2), inPianta(w / 2, d / 2), inPianta(-w / 2, d / 2)], y0: quota - sp, y1: quota });
  }
  return tagli;
}

/** Distanza di un punto (pianta) dal segmento ab. */
function distSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const SP_SCHIENALE = 12;          // spessore del pannello dietro il piano
const H_SCHIENALE = 600;          // altezza se sopra non ci sono pensili

function renderTopContinui(basi, fianchi = [], thickness = SP_TOP, mat = null, lavelli = [], schienale = null, muriPiano = [], tagli = []) {
  let matTop = materialePerTop(mat);
  // Il piano deve SEMPRE vincere lo z-fighting contro costadi/colonne che gli
  // arrivano a filo (stessa quota): con polygonOffset la lastra viene disegnata
  // leggermente davanti, così il top resta ben visibile da ogni prospettiva e
  // non "lampeggia".
  if (!matTop || !matTop.isMaterial) {
    matTop = new THREE.MeshStandardMaterial({ color: COL.top, roughness: 0.55, metalness: 0.1 });
  }
  matTop.polygonOffset = true;
  matTop.polygonOffsetFactor = -3;
  matTop.polygonOffsetUnits = -3;
  matTop.needsUpdate = true;
  const gruppi = {};
  for (const b of basi) {
    const rotN = rotNorm(b.rot);
    const rad = rotN * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const perp = Math.round((b.x * (-s) + b.y * c) / 5) * 5;
    const key = `${rotN}|${perp}|${Math.round(b.topY)}`;
    (gruppi[key] ||= { rotN, c, s, topY: b.topY, d: b.d || PROFONDITA_BASE, items: [] }).items.push(b);
  }
  // 1) TRATTI di piano (uno per fila continua di mobili)
  const tratti1 = [];
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, topY } = G;
    // verso degli assi locali della lastra rispetto a lungo/perp: +1 a 0/180°, −1 a 90/270°
    // (x locale = k·lungo, z locale = −k·perp; il retro dei moduli è a perp + k·d/2)
    const k = rotN % 180 === 0 ? 1 : -1;
    for (const run of tratti(G.items, c, s)) {
      const lo = run.lo, hi = run.hi;
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      let endLo = lo - 20, endHi = hi + 20;   // estremità libere: piccola sporgenza
      let fermoLo = false, fermoHi = false;   // fermati da una colonna / un costado
      for (const f of fianchi) {
        const pf = proiettaFianco(f, c, s);
        if (Math.abs(pf.perp - perp) > 350) continue;   // non sulla stessa linea
        const tall = (f.h || 0) >= 1500;
        if (pf.along >= hi - 1 && pf.near <= hi + 90) {          // estremità destra
          endHi = (f.cat === 'costado' && !tall) ? pf.far : hi; fermoHi = true;
        }
        if (pf.along <= lo + 1 && pf.far >= lo - 90) {           // estremità sinistra
          endLo = (f.cat === 'costado' && !tall) ? pf.near : lo; fermoLo = true;
        }
      }
      // Profondità del piano: normalmente = profondità dei moduli; ma se sulla
      // stessa fila ci sono COSTADI bassi più profondi dei moduli (es. isola),
      // il piano si estende ALL'INDIETRO per coprirli — il fronte (lato porte)
      // resta dov'è. Copro l'unione delle impronte moduli + costadi.
      let pMin = perp - G.d / 2, pMax = perp + G.d / 2;
      let cMin = Infinity, cMax = -Infinity;                    // impronta dei costadi della fila
      for (const f of fianchi) {
        if (f.cat !== 'costado' || (f.h || 0) >= 1500) continue;   // solo costadi bassi
        const pf = proiettaFianco(f, c, s);
        if (pf.far < endLo - 90 || pf.near > endHi + 90) continue;  // non su questa fila
        const fco = Math.cos((f.rot || 0) * Math.PI / 180), fso = Math.sin((f.rot || 0) * Math.PI / 180);
        const hV = (f.w / 2) * Math.abs(fso * c - fco * s) + (f.d / 2) * Math.abs(fco * c + fso * s);
        const fMin = pf.perp - hV, fMax = pf.perp + hV;
        if (fMax < perp - G.d / 2 - 20 || fMin > perp + G.d / 2 + 20) continue; // non condivide il fronte
        pMin = Math.min(pMin, fMin); pMax = Math.max(pMax, fMax);
        cMin = Math.min(cMin, fMin); cMax = Math.max(cMax, fMax);
      }
      // BORDI DEL PIANO: 2 cm oltre i mobili; ma dove c'è un COSTADO il piano finisce A FILO del
      // costado (costado da 1000 → piano da 1000), non 2 cm oltre
      const mMin = perp - G.d / 2, mMax = perp + G.d / 2;
      const bMin = cMin <= mMin + 1 ? cMin : mMin - 20;
      const bMax = cMax >= mMax - 1 ? cMax : mMax + 20;
      tratti1.push({ G, c, s, rotN, topY, k, lo, hi, perp, pMin, pMax, bMin, bMax, endLo, endHi, fermoLo, fermoHi });
    }
  }
  // 2) ANGOLI E MURI: un'estremità che non arriva al muro (es. il mobile d'angolo
  //    da 1000 lontano dal muro) si allunga FINO AL MURO, così il piano chiude
  //    l'angolo in un pezzo unico; se invece lì c'è il piano dell'altra fila, ci
  //    si appoggia esattamente (niente buchi, niente lastre sovrapposte).
  const MAX_ALLUNGO = 700;
  const inCoord = (T, x, y) => ({ a: x * T.c + y * T.s, p: -x * T.s + y * T.c });
  const angoliPiano = (T) => {                           // i 4 angoli della lastra (pianta)
    const P = (a, p) => ({ x: T.c * a - T.s * p, y: T.s * a + T.c * p });
    return [P(T.endLo, T.bMin), P(T.endHi, T.bMin), P(T.endLo, T.bMax), P(T.endHi, T.bMax)];
  };
  const nuoviFini = tratti1.map((T) => {
    const out = { endLo: T.endLo, endHi: T.endHi };
    for (const [lato, dir] of [['endLo', -1], ['endHi', 1]]) {
      if (lato === 'endLo' ? T.fermoLo : T.fermoHi) continue;
      const e = lato === 'endLo' ? T.lo : T.hi;              // filo dei mobili
      const banda = T.pMax - T.pMin, pC = (T.pMin + T.pMax) / 2;
      let meglio = null;                                     // { dist, fine }
      // lastre delle altre file (perpendicolari o in linea) che stanno davanti a questa estremità
      for (const Q of tratti1) {
        if (Q === T || Math.abs(Q.topY - T.topY) > 5) continue;
        if (Q.rotN % 180 === T.rotN % 180) continue;          // solo l'altra fila dell'ANGOLO (in linea: lo spazio resta)
        const pts = angoliPiano(Q).map((q) => inCoord(T, q.x, q.y));
        const qa0 = Math.min(...pts.map((q) => q.a)), qa1 = Math.max(...pts.map((q) => q.a));
        const qp0 = Math.min(...pts.map((q) => q.p)), qp1 = Math.max(...pts.map((q) => q.p));
        const sovP = Math.min(T.pMax, qp1) - Math.max(T.pMin, qp0);
        if (sovP < banda * 0.5) continue;
        const bordo = dir > 0 ? qa0 : qa1, dist = (bordo - e) * dir;
        if (dist < -80 || dist > MAX_ALLUNGO) continue;
        if (!meglio || dist < meglio.dist) meglio = { dist, fine: bordo };
      }
      // muri perpendicolari che chiudono questa estremità
      for (const w of muriPiano) {
        const A = inCoord(T, w.a.x, w.a.y), B = inCoord(T, w.b.x, w.b.y);
        if (Math.abs(A.a - B.a) > 5) continue;                // non perpendicolare alla fila
        if (pC < Math.min(A.p, B.p) - 5 || pC > Math.max(A.p, B.p) + 5) continue;
        const dist = (A.a - e) * dir;
        if (dist < -30 || dist > MAX_ALLUNGO) continue;
        // oltre 15 cm si chiude solo negli ANGOLI (lì c'è l'altra fila contro questo muro):
        // uno spazio voluto (es. frigo libero) in fondo a una fila resta aperto
        if (dist > 150) {
          const a0 = Math.min(e, A.a), a1 = Math.max(e, A.a);
          const angolo = tratti1.some((Q) => {
            if (Q === T || Q.rotN % 180 === T.rotN % 180) return false;
            const pts = angoliPiano(Q).map((q) => inCoord(T, q.x, q.y));
            const qa0 = Math.min(...pts.map((q) => q.a)), qa1 = Math.max(...pts.map((q) => q.a));
            return qa1 > a0 + 10 && qa0 < a1 - 10;
          });
          if (!angolo) continue;
        }
        if (!meglio || dist < meglio.dist) meglio = { dist, fine: A.a };
      }
      if (meglio) out[lato] = meglio.fine;
    }
    return out;
  });
  tratti1.forEach((T, i) => Object.assign(T, nuoviFini[i]));
  // 3) LASTRE (con i fori di lavello / piano cottura) e pannello dietro
  for (const T of tratti1) {
    const { G, c, s, rotN, topY, k, lo, hi, perp, pMin, pMax, bMin, bMax, endLo, endHi } = T;
    {
      const depth = bMax - bMin;
      const perpTop = (bMin + bMax) / 2;
      const len = endHi - endLo;
      const centerAlong = (endLo + endHi) / 2;
      const cx = c * centerAlong + (-s) * perpTop;
      const cy = s * centerAlong + c * perpTop;
      // Fori dei lavelli che cadono su questo tratto (stessa fila/quota).
      const fori = [];
      for (const lv of lavelli) {
        if (rotNorm(lv.rot) !== rotN) continue;
        const alongS = lv.x * c + lv.y * s;
        const perpS = lv.x * (-s) + lv.y * c;
        if (Math.abs(perpS - perpTop) > depth / 2 + 50) continue;
        if (alongS < endLo - 10 || alongS > endHi + 10) continue;
        if (lv.lavello) {
          const { vw, vd, zc } = dimVasca(lv.w, lv.d);
          // v locale della lastra = −(perp − perpTop): la lastra è ruotata come i mobili (−rot)
          fori.push({ u: k * (alongS - centerAlong), v: k * (perpTop - perpS) + zc, w: vw + 6, d: vd + 6 });
        } else if (lv.placca) {
          // piano cottura INCASSATO: il vetro sta nel foro, così si vede da
          // qualsiasi distanza (sopra il piano "spariva" da lontano)
          const { pw, pd } = dimPlacca(lv.w, lv.d, lv.fuochi);
          fori.push({ u: k * (alongS - centerAlong), v: k * (perpTop - perpS), w: pw - 12, d: pd - 12 });
        }
      }
      // PIANO / TAVOLO che passa ALLA QUOTA del piano: lì il piano si apre (pezzi, tacca o buco)
      const tagliQui = [];
      for (const t of tagli) {
        if (t.y1 <= topY + 1 || t.y0 >= topY + thickness - 1) continue;          // più basso o più alto: non si toccano
        const loc = t.angoli.map((q) => { const al = q.x * c + q.y * s, pp = -q.x * s + q.y * c; return { u: k * (al - centerAlong), v: k * (perpTop - pp) }; });
        const u0 = Math.min(...loc.map((q) => q.u)), u1 = Math.max(...loc.map((q) => q.u));
        const v0 = Math.min(...loc.map((q) => q.v)), v1 = Math.max(...loc.map((q) => q.v));
        if (u1 <= -len / 2 || u0 >= len / 2 || v1 <= -depth / 2 || v0 >= depth / 2) continue;
        // solo se è dritta rispetto al piano (lati paralleli): girata di traverso il taglio a rettangolo sarebbe sbagliato
        let area = 0; for (let i = 0; i < 4; i++) { const a = loc[i], b = loc[(i + 1) % 4]; area += a.u * b.v - b.u * a.v; }
        if (Math.abs(area) / 2 < 0.97 * (u1 - u0) * (v1 - v0)) continue;
        tagliQui.push({ u0, u1, v0, v1 });
      }
      const slab = tagliQui.length
        ? slabRitagliata(len, thickness, depth, matTop || COL.top, fori, tagliQui)
        : fori.length
          ? slabConFori(len, thickness, depth, matTop || COL.top, fori)
          : corpo(len, thickness, depth, matTop || COL.top);
      if (!slab) continue;                                 // tutto coperto dal piano/tavolo
      slab.traverse((o) => { if (o.isMesh) o.userData.appoggio = true; });   // ci si appoggiano gli oggetti (friggitrice…)
      // PANNELLO DIETRO IL PIANO (aplacado): ovunque il piano tocca un muro —
      // dietro la fila e anche sui fianchi del piano che finiscono contro un muro
      // (es. negli angoli della cucina a L / U)
      if (schienale) {
        const perpMuro = perp + k * G.d / 2;                   // retro dei moduli = muro
        const Pp = (al, pp) => ({ x: c * al - s * pp, y: s * al + c * pp });
        const suMuro = (pts) => schienale.muri.some((w) => pts.filter((q) => distSegmento(q, w.a, w.b) < 90).length >= 2);
        // altezza: fino ai pensili sopra questa fila, altrimenti 60 cm
        let yPens = Infinity;
        for (const pz of schienale.pensili) {
          if (rotNorm(pz.rot) !== rotN) continue;
          const al = pz.x * c + pz.y * s, pp = pz.x * (-s) + pz.y * c;
          if (Math.abs(al - centerAlong) > len / 2 + pz.w / 2 - 20) continue;
          const dd = k * (perpMuro - pp);
          if (dd < -50 || dd > 700) continue;
          yPens = Math.min(yPens, pz.yBottom);
        }
        const yTop = topY + thickness;
        const H = Number.isFinite(yPens) && yPens - yTop > 100 ? yPens - yTop : H_SCHIENALE;
        const matP = materialePerSchienale(schienale.mat || matTop) || COL.top;
        // coordinate locali della lastra: +z = fronte (stanza), il muro è dietro
        const zMuro = -k * (perpMuro - perpTop);
        const zFronte = -k * ((perp - k * G.d / 2) - perpTop);   // filo delle ante (senza la sporgenza del piano)
        const dz = Math.sign(zFronte - zMuro) || 1;
        if (suMuro([Pp(centerAlong, perpMuro), Pp(lo + 50, perpMuro), Pp(hi - 50, perpMuro)])) {
          const pann = corpo(len, H, SP_SCHIENALE, matP);
          pann.position.set(0, thickness / 2 + H / 2, zMuro + dz * SP_SCHIENALE / 2);
          pann.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
          slab.add(pann);
        }
        // fianchi del piano contro un muro
        for (const e of [endLo, endHi]) {
          const pts = [Pp(e, perpMuro - k * 100), Pp(e, perpMuro - k * (G.d / 2)), Pp(e, perpMuro - k * (G.d - 100))];
          if (!suMuro(pts)) continue;
          const xE = k * (e - centerAlong), dentro = -Math.sign(xE) || 1;
          const prof = Math.abs(zFronte - zMuro) + 20 - SP_SCHIENALE;   // fino al bordo davanti del piano: combacia col pannello dell'altro lato
          const fianco = corpo(SP_SCHIENALE, H, prof, matP);
          fianco.position.set(xE + dentro * SP_SCHIENALE / 2, thickness / 2 + H / 2, zMuro + dz * (SP_SCHIENALE + prof / 2));
          fianco.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
          slab.add(fianco);
        }
      }
      // pietra vera: niente contorni da disegno tecnico sul piano e sull'aplacado (sull'isola il bordo
      // di una metà si vedeva come una riga sopra l'altra metà)
      slab.traverse((o) => { if (o.isLineSegments) o.visible = false; });
      gruppo.add(collocaMobile(slab, cx, topY, -cy, thickness, rotN));
    }
  }
}

/**
 * Zoccolo (piedini) CONTINUO: un unico pezzo per fila di basi, da un bordo
 * all'altro (quindi da costado a costado, coprendo tutti i moduli).
 */
function renderZoccoliContinui(basi, mat) {
  const gruppi = {};
  for (const b of basi) {
    const rotN = rotNorm(b.rot);
    const rad = rotN * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const perp = Math.round((b.x * (-s) + b.y * c) / 5) * 5;
    const key = `${rotN}|${perp}|${Math.round(b.zocc || 150)}`;
    (gruppi[key] ||= { rotN, c, s, zocc: b.zocc || 150, d: b.d || PROFONDITA_BASE, items: [] }).items.push(b);
  }
  // 1) i tratti di zoccolo di ogni fila, con la linea del loro FRONTE (arretrato di 100 dalle ante)
  const runs = [];
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, zocc } = G;
    const k = s * s - c * c;                                   // fronte del mobile lungo l'asse perpendicolare (±1)
    for (const run of tratti(G.items, c, s)) {
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      runs.push({ c, s, rotN, zocc, d: G.d, perp, fronte: perp + k * (G.d / 2 - 100), lo: run.lo, hi: run.hi });
    }
  }
  // 2) ANGOLI (cucine a L / U): dove due file si incontrano a 90° lo zoccolo GIRA senza buchi.
  //    Ogni tratto che finisce prima dello spigolo si allunga fino al fronte dello zoccolo
  //    dell'altra fila (prima restava un vuoto sotto il mobile d'angolo / la regletta).
  const nuovi = runs.map((T) => ({ lo: T.lo, hi: T.hi }));
  runs.forEach((T, i) => {
    for (const Q of runs) {
      if (Q === T || Math.abs(Q.zocc - T.zocc) > 5 || Math.abs(T.c * Q.c + T.s * Q.s) > 0.05) continue;   // solo file a 90°, stessa altezza
      // incrocio dei due fronti: (-sT, cT)·X = fT ; (-sQ, cQ)·X = fQ
      const a1 = -T.s, b1 = T.c, a2 = -Q.s, b2 = Q.c, det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-6) continue;
      const X = (T.fronte * b2 - Q.fronte * b1) / det, Y = (a1 * Q.fronte - a2 * T.fronte) / det;
      const aT = X * T.c + Y * T.s, aQ = X * Q.c + Y * Q.s;
      if (aQ < Q.lo - 700 || aQ > Q.hi + 700) continue;                  // l'altra fila non arriva lì
      if (aT > T.hi && aT - T.hi <= 700) nuovi[i].hi = Math.max(nuovi[i].hi, aT);
      if (aT < T.lo && T.lo - aT <= 700) nuovi[i].lo = Math.min(nuovi[i].lo, aT);
    }
  });
  // 3) i pezzi di zoccolo
  runs.forEach((T, i) => {
    const { lo, hi } = nuovi[i];
    const len = hi - lo, centerAlong = (lo + hi) / 2;
    const cx = T.c * centerAlong + (-T.s) * T.perp;
    const cy = T.s * centerAlong + T.c * T.perp;
    const geo = new THREE.BoxGeometry(len, T.zocc, T.d - 100);
    const mesh = new THREE.Mesh(geo, mat ? mat.clone() : new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 0.96, metalness: 0 }));
    mesh.position.z = -50;                 // arretrato rispetto al fronte
    const g = new THREE.Group(); g.add(mesh);
    gruppo.add(collocaMobile(g, cx, 0, -cy, T.zocc, T.rotN));
  });
}

/** Materiale dello zoccolo in base al colore scelto (default: nero opaco). */
function materialeZoccolo(id, onPronto) {
  // Zoccoli dal catalogo (predefiniti: nero/bianco opaco, acciaio; più quelli aggiunti)
  return getMaterialeTHREE(MATERIALI.some((m) => m.id === id) ? id : 'nero-opaco', onPronto);
}
/** Zoccoli visibili nel catalogo, per la palette (id, nome, sfondo CSS). */
export function coloriZoccolo() {
  return materialiPer('zoccolo').map((m) => ({ id: m.id, nome: m.nome, css: sfondoSwatch(m) }));
}

function bbox(progetto, vertici) {
  const xs = [], ys = [];
  (progetto.piano.pareti || []).forEach((p, i) => {
    if (p.assente) return;
    xs.push(vertici[i].x, vertici[i + 1].x);
    ys.push(vertici[i].y, vertici[i + 1].y);
  });
  for (const m of (progetto.mobiliLiberi || [])) { xs.push(m.x); ys.push(m.y); }
  if (xs.length === 0) return { minX: 0, maxX: 3000, minY: 0, maxY: 2000 };
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Da che parte dei muri sta la stanza (dove guardano i mobili), in 3D (x, z):
 * la media dei lati interni dei muri, pesata sulla lunghezza. null = nessun muro.
 */
function direzioneStanza(full, vertici) {
  let sx = 0, sz = 0;
  (full || []).forEach((p, i) => {
    const a = vertici[i], b = vertici[i + 1];
    if (p.assente || !a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const sgn = p.latoInterno === 'interno' ? 1 : -1;
    sx += -dy * sgn; sz += -dx * sgn;            // normale interna × lunghezza (z 3D = −y pianta)
  });
  const n = Math.hypot(sx, sz);
  return n > 1e-6 ? { x: sx / n, z: sz / n } : null;
}

function inquadra(bb, dir = null) {
  const cx = (bb.minX + bb.maxX) / 2, cz = -(bb.minY + bb.maxY) / 2;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) + 2000;
  controls.target.set(cx, 800, cz);
  // di tre quarti DENTRO la stanza, davanti ai mobili (non dietro i muri)
  let ox = diag * 0.7, oz = diag * 0.9;
  if (dir) { ox = dir.x * diag * 0.9 - dir.z * diag * 0.7; oz = dir.z * diag * 0.9 + dir.x * diag * 0.7; }
  camera.position.set(cx + ox, diag * 0.75 + 1500, cz + oz);
  camera.updateProjectionMatrix();
  controls.update();
}

export function smontaScena3d() {
  animazioneAttiva = false;
  if (resa) { resa.dispose(); resa = null; }
  window.removeEventListener('resize', forzaResize3d);
}
