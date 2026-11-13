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
import {
  calcolaVertici, dimMobile, categoriaTipo, anteDiMobile, portaBassaColonna, frontiCassetti,
  moduliDiParete, PROFONDITA_BASE, PROFONDITA_PENSILE, infoAngoloCieco, SPESSORE_ANTA,
} from './modello.js?v=20261113z';
import { getMaterialeTHREE, MATERIALI, impostaUnitaUV, taraLuceCatalogo, pianoComeFoto, pannelloComeFoto, materialiPer, sfondoSwatch, uvInScala } from '../materiali.js?v=20261113z';
impostaUnitaUV(1000);                // UV in metri per i prodotti del catalogo (vedi uvInScala)
import { maniglia3D } from '../maniglia3d.js?v=20261113z';
import { componiConLogo, salvaImmagineCanvas, latoMaxExport } from '../logo.js?v=20261111x';
import { sfondoDi } from '../sfondi.js?v=20261111x';
export { MATERIALI, materialiPer, sfondoSwatch } from '../materiali.js?v=20261113z';
export { SFONDI_LISTA } from '../sfondi.js?v=20261111x';

export const MONTAGGIO_PENSILE = 1400;   // altezza da terra del basso dei pensili
const SP_TOP = 40;
// Zoccolo (piedini) in base all'altezza della porta:
//  porta 70 → zoccolo 150 mm · porta 80 → zoccolo 100 mm
function zoccoloPerAltezza(h) { return h >= 800 ? 100 : 150; }

// Altezza dominante dei mobili BASSI della cucina (quelli che poggiano a terra
// con piedini + piano: base, lavello, forno, cassettiera...). Serve per far
// adattare i piedini della colonna ai mobili bassi: se i bassi sono da 80
// (piedini 100), anche la colonna deve stare su piedini da 100, non 150.
const CAT_NON_BASSE = new Set(['pensile', 'colonna', 'regletta', 'pannello', 'costado', 'oggetto']);
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

// Quota della cima delle colonne (cassa + zoccolo). null se non ci sono colonne.
function quotaAltaColonne(progetto) {
  const cols = (progetto.mobiliLiberi || []).filter((m) => categoriaTipo(m.tipo) === 'colonna');
  if (cols.length === 0) return null;
  return Math.max(...cols.map((c) => (c.altezza_mm || 2200) + zoccoloColonna(progetto, c)));
}
const ALT_MURO = 2600;
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
function evidenzia(g) {
  g.traverse((o) => {
    if (o.isLineSegments) {
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
function dimPlacca(w, d) { return { pw: Math.min(w - 40, 580), pd: Math.min(d - 80, 480) }; }

/** Lavello / piano cottura / rubinetto posati SOPRA la superficie del top.
 *  fin = { lavello: 'acciaio'|'nero', rubinetto: 'acciaio'|'nero' } */
function aggiungiAccessorioTop(a, fin = {}) {
  const g = new THREE.Group();
  g.position.set(a.x, a.surfaceY, -a.y);
  g.rotation.y = -(a.rot || 0) * Math.PI / 180;
  if (a.id !== undefined) g.userData.mobId = a.id;
  if (a.placca) {
    // Piano a induzione in VETROCERAMICA: vetro nero lucido con le zone e i
    // comandi disegnati sul vetro (come quelli veri), riflessi dell'ambiente
    const { pw, pd } = dimPlacca(a.w, a.d);
    const sopra = new THREE.MeshPhysicalMaterial({ map: texPiano(pw, pd, a.fuochi), color: 0xffffff, roughness: 0.12,
      metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 0.9 });
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
    // Rubinetto a miscelatore: base + colonna + canna orizzontale (collegati)
    const matMet = fin.rubinetto === 'nero'
      ? new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.6 })   // nero opaco
      : new THREE.MeshStandardMaterial({ color: 0xdedee2, roughness: 0.15, metalness: 0.95 });
    const zr = -a.d * 0.34, hTop = 300;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(28, 34, 26, 20), matMet);
    base.position.set(0, 13, zr); g.add(base);
    const colonna = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, hTop, 16), matMet);
    colonna.position.set(0, 13 + hTop / 2, zr); g.add(colonna);
    // Raccordo in cima (sfera) + canna che va in avanti e scende
    const nodo = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 16), matMet);
    nodo.position.set(0, 13 + hTop, zr); g.add(nodo);
    const canna = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 190, 16), matMet);
    canna.rotation.x = Math.PI / 2;
    canna.position.set(0, 13 + hTop, zr + 95); g.add(canna);
    const beccuccio = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 55, 16), matMet);
    beccuccio.position.set(0, 13 + hTop - 27, zr + 185); g.add(beccuccio);
    const leva = new THREE.Mesh(new THREE.CapsuleGeometry(8, 70, 4, 8), matMet);
    leva.rotation.z = Math.PI / 2;
    leva.position.set(44, 52, zr); g.add(leva);
  }
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
const matOro = new THREE.LineBasicMaterial({ color: 0x3b3833, transparent: true, opacity: 0.55 });
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
const matElInox = new THREE.MeshStandardMaterial({ map: texSpazzolato, color: 0xffffff, roughness: 0.36, metalness: 0.78, envMapIntensity: 0.75 });
// Vetro nero lucido: quasi niente colore proprio, solo riflessi (clearcoat)
const matElVetro = new THREE.MeshPhysicalMaterial({ color: 0x060608, roughness: 0.18, metalness: 0.0,
  clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
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
const matElButton = new THREE.MeshStandardMaterial({ map: texSpazzolato, color: 0xd8dade, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.8 });
// Vetro trasparente davanti alla finestra del forno (riflessi sopra la cavità)
const matElVetroTrasp = new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.28,
  roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.0, depthWrite: false });
// Piano cottura in VETROCERAMICA: zone disegnate sul vetro + comandi touch
function texPiano(pw, pd, fuochi) {
  const k = 2;
  return canvasTex(Math.round(pw * k), Math.round(pd * k), (g, w, h) => {
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, w, h);
    const pos = fuochi === 2 ? [[0.5, 0.3], [0.5, 0.66]] : [[0.27, 0.3], [0.73, 0.3], [0.27, 0.68], [0.73, 0.68]];
    const r = Math.min(w, h) * (fuochi === 2 ? 0.2 : 0.17);
    pos.forEach(([x, y], i) => {
      const rr = r * (i % 3 === 0 ? 1.08 : 0.9);
      g.strokeStyle = 'rgba(205,205,210,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.arc(w * x, h * y, rr, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(205,205,210,0.22)'; g.lineWidth = 2;
      g.beginPath(); g.arc(w * x, h * y, rr * 0.62, 0, Math.PI * 2); g.stroke();
    });
    // striscia comandi touch davanti (in basso nella texture = verso la stanza)
    const yc = h * 0.91; g.fillStyle = 'rgba(205,205,210,0.6)';
    g.font = `${Math.round(h * 0.045)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['−', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+'].forEach((t, i, a) => g.fillText(t, w * (0.22 + (0.56 * i) / (a.length - 1)), yc));
    g.beginPath(); g.arc(w * 0.1, yc, h * 0.022, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = 'rgba(205,205,210,0.6)'; g.stroke();
  });
}

// Ambiente IBL: gradiente (soffitto chiaro → pavimento scuro) per riflessi soft.
function creaAmbiente(rnd) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.0, '#eae4d6');
  grd.addColorStop(0.45, '#b7b0a0');
  grd.addColorStop(0.55, '#5a564c');
  grd.addColorStop(1.0, '#1a1a1a');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(rnd);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

// ---------------------------------------------------------------------------
export function montaScena3d(canvas, progetto) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
  camera = new THREE.PerspectiveCamera(50, w / h, 10, 60000);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  // Pixel ratio limitato a 1.5: su schermi ad alta densità (retina/telefoni)
  // 2x significa 4× pixel da disegnare ogni frame → scatti. 1.5 è fluido e
  // resta nitido (l'export immagine usa un percorso separato ad alta qualità).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h, false);
  // Resa più realistica: tone mapping cinematografico + colori sRGB
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Illuminazione d'ambiente (image-based) per riflessi e materiali reali
  scene.environment = creaAmbiente(renderer);

  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x403828, 1.6);
  const amb = new THREE.AmbientLight(0xffffff, 0.65);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
  key.position.set(3000, 6000, 4000);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.9);
  fill.position.set(-4000, 3000, -2000);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(0, 2000, -5000);
  scene.add(hemi); scene.add(amb); scene.add(key); scene.add(fill); scene.add(rim);
  taraLuceCatalogo(renderer, scene);   // prodotti del catalogo: colori identici alla foto
  // Memorizzo le intensita' base per poterle abbassare quando i LED sono
  // accesi, cosi' la differenza "LED off / LED on" si vede davvero.
  luciAmbiente = [
    { l: hemi, base: 1.6 },
    { l: amb,  base: 0.65 },
    { l: key,  base: 2.2 },
    { l: fill, base: 0.9 },
    { l: rim,  base: 0.6 },
  ];

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;

  gruppo = new THREE.Group();
  scene.add(gruppo);
  aggiornaScena3d(progetto, true);

  window.addEventListener('resize', forzaResize3d);
  animazioneAttiva = true;
  animate();
}

function animate() {
  if (!animazioneAttiva) return;
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export function forzaResize3d() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

/** Salva l'immagine del rendering in ALTA QUALITÀ (PNG). */
export function esportaImmagine3d(nomeFile = 'cucina.png', latoMax = latoMaxExport()) {
  if (!renderer || !scene || !camera || !canvasEl) return false;
  const cw = canvasEl.clientWidth || canvasEl.width;
  const ch = canvasEl.clientHeight || canvasEl.height;
  const pr0 = renderer.getPixelRatio();
  const scala = Math.max(1, latoMax / Math.max(cw, ch));
  const tw = Math.round(cw * scala), th = Math.round(ch * scala);
  renderer.setPixelRatio(1);
  renderer.setSize(tw, th, false);
  camera.aspect = tw / th; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  let canvas2d = null;
  try { canvas2d = componiConLogo(canvasEl); } catch (e) { canvas2d = null; }
  renderer.setPixelRatio(pr0);
  renderer.setSize(cw, ch, false);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
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
  for (const hit of hits) {
    let o = hit.object;
    while (o && o.userData.mobId === undefined) o = o.parent;
    if (o && o.userData.mobId !== undefined) return o.userData.mobId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SPOSTARE GLI OGGETTI NEL RENDERING (sgabelli, arredo): si trascinano sul
// pavimento. I moduli restano fissi (puoSpostare decide chi si muove).
let spost = null;            // { g, id, dx, dz, x0, z0 }
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
  // piano orizzontale all'altezza del punto toccato: l'oggetto segue il dito
  const hit = g && rayPick.intersectObject(g, true)[0];
  pianoTerra.constant = hit ? -hit.point.y : 0;
  const p = puntoATerra(clientX, clientY);
  if (!g || !p) return false;
  spost = { g, id, dx: g.position.x - p.x, dz: g.position.z - p.z, x0: g.position.x, z0: g.position.z };
  controls.enabled = false;
  canvasEl.style.cursor = 'grabbing';
  return true;
}
export function muoviSpostamento(clientX, clientY) {
  if (!spost) return;
  const p = puntoATerra(clientX, clientY);
  if (!p) return;
  spost.g.position.x = p.x + spost.dx;
  spost.g.position.z = p.z + spost.dz;
}
/** Fine: ritorna { id, x, y, mosso } in coordinate della pianta (mm). */
export function fineSpostamento() {
  if (!spost) return null;
  const { g, id, x0, z0 } = spost;
  spost = null;
  controls.enabled = true;
  canvasEl.style.cursor = '';
  const mosso = Math.hypot(g.position.x - x0, g.position.z - z0) > 5;
  return { id, x: Math.round(g.position.x), y: Math.round(-g.position.z), mosso };
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
}

// Maniglia scelta per categoria (catalogo): progetto.maniglie = { base, pensile, colonna }
let _maniglia = null;
let _manByCat = {};
let _reRenderMan = null;
function manigliaCat(cat) {
  const g = cat === 'pensile' ? 'pensile' : cat === 'colonna' ? 'colonna' : 'base';
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
function maniglia(g, x, y, z, orizz, lung) {
  const def = _maniglia;
  if (def && def.texture && def.lunghezzaMm && (def.vistaSopra || def.vistaLato)) {
    // MANIGLIA DA PIÙ FOTO: forma 3D vera ricavata dalle viste (davanti/lato/sopra)
    const r = maniglia3D(def, _reRenderMan);
    if (r) {
      const m = new THREE.Mesh(r.geo, r.mat);
      m.castShadow = true; m.receiveShadow = true;
      const grp = new THREE.Group(); grp.add(m);
      grp.position.set(x, y, z + 20);                  // base appoggiata all'anta
      if (!orizz) grp.rotation.z = Math.PI / 2;
      g.add(grp);
      return;
    }
    // finché non è pronta: la barra con i piedini (sotto)
  }
  if (def && def.texture && def.lunghezzaMm) {
    // MANIGLIA DA FOTO: misura reale, costruita in 3D (non più una foto piatta).
    // La barra segue il verso della foto; se sull'anta serve nell'altro verso
    // si gira tutta la maniglia (foto compresa), come nella realtà.
    const L = def.lunghezzaMm, T = Math.max(8, def.altezzaMm || 20);
    let D = Math.max(8, Math.min(T * 0.9, 22)), sporg = SPORGENZA_MAN;
    // Viste in più (facoltative): quanto sporge la maniglia dall'anta.
    // Da sopra si vede lunghezza × sporgenza (il lato lungo è la lunghezza);
    // di lato si vede altezza × sporgenza (foto con la maniglia come montata).
    const v = def.viste || {};
    let P = null;
    if (v.sopra && v.sopra.w && v.sopra.h) P = L * Math.min(v.sopra.w, v.sopra.h) / Math.max(v.sopra.w, v.sopra.h);
    else if (v.lato && v.lato.w && v.lato.h) P = T * Math.max(v.lato.w, v.lato.h) / Math.min(v.lato.w, v.lato.h);
    if (P) {
      P = Math.max(14, Math.min(90, P));             // sporgenza totale (mm)
      D = Math.max(6, Math.min(D, P * 0.45));
      sporg = Math.max(6, P - D);
    }
    const w = def.verticale ? T : L, h = def.verticale ? L : T;
    const ruota = !!def.verticale === !!orizz;       // foto verticale ↔ serve orizzontale (o viceversa)
    barraManiglia(g, x, y, z, w, h, D, getMaterialeTHREE(def.id, _reRenderMan), materialeLatiManiglia(def), ruota, sporg);
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
// Finger-pull per categoria: progetto.fingerPull può essere un oggetto
// { base, pensile, colonna } oppure (vecchio) un booleano = vale per tutto.
function fpCat(fp, cat) {
  const key = cat === 'base' ? 'base' : cat === 'pensile' ? 'pensile' : cat === 'colonna' ? 'colonna' : null;
  if (!key) return false;
  if (fp === true) return true;
  return !!(fp && typeof fp === 'object' && fp[key]);
}
// Canale finger-pull: una scanalatura RIENTRANTE (stesso colore del fronte,
// arretrata → in ombra), con una riga d'ombra nel punto più profondo. Come
// nella realtà: il fronte è accorciato e in cima/di lato c'è il canale.
// La faccia del fronte è a z+20; il fondo del canale è arretrato a z+6.
const matCanaleOmbra = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 1.0, metalness: 0 });
function canaleFingerPull(g, cx, cy, z, length, thick, orizz, matAnta) {
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
  shadow.position.set(orizz ? cx : cx + thick / 2 - 4, orizz ? cy + thick / 2 - 4 : cy, z + 9);
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
const matNeroOpaco = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.35 });
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
    if (!_texDisplay[st]) _texDisplay[st] = new THREE.MeshBasicMaterial({ map: texDisplayForno(st), toneMapped: false });
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
  if (!_matDisplayMicro[st]) _matDisplayMicro[st] = new THREE.MeshBasicMaterial({ map: texDisplayMicro(dc), toneMapped: false });
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
  g.add(grp);
}

// ---------------------------------------------------------------------------
// Fronti per categoria. Corpo centrato nell'origine: x[-w/2,w/2] y[-h/2,h/2] z[-d/2,d/2]
// Fughe reali delle ante: in LARGHEZZA si toglie 3 mm totali (1,5 per lato),
// in ALTEZZA 2 mm (1 sopra, 1 sotto). GAP = fuga fra due ante/cassetti.
const FUGA_W = 3, FUGA_H = 2, GAP_ANTE = 3;
// Maniglia ORIZZONTALE su un'anta (bassi e pensili): vicino al bordo alto
// sui bassi, vicino al bordo basso sui pensili, spostata verso il lato che
// apre (anta singola) o verso il centro (due ante). Le colonne restano verticali.
function lungManiglia(standard) {
  return (_maniglia && _maniglia.texture && _maniglia.lunghezzaMm) ? _maniglia.lunghezzaMm : standard;
}
function manigliaOrizzAnta(g, px, py, pw, ph, z, verso, inAlto) {
  const L = lungManiglia(Math.min(pw * 0.5, 320));
  const off = Math.max(0, pw / 2 - L / 2 - 40);       // verso il lato che apre (0 = centrata)
  const y = inAlto ? py + ph / 2 - 45 : py - ph / 2 + 45;
  maniglia(g, px + verso * off, y, z, true, Math.min(pw * 0.5, 320));
}
let _anteInBasso = false;    // pensili: maniglia vicino al bordo basso
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
  for (let i = 0; i < n; i++) {
    const px = -uw / 2 + pw / 2 + i * (pw + GAP_ANTE);
    // Anta sporgente sotto (gola integrata): si apre da sotto, niente maniglia.
    if (!sporg && _fingerPull) {
      const CH = 30;                                 // altezza del canale in alto
      pannello(g, px, py - CH / 2, z, pw, Math.max(60, ph - CH), matAnta || COL.anta);
      canaleFingerPull(g, px, py + ph / 2 - CH / 2, z, pw, CH, true, matAnta);
    } else {
      pannello(g, px, py, z, pw, ph, matAnta || COL.anta);
      if (!sporg) {
        // verso: +1 = maniglia verso destra, −1 = verso sinistra
        const verso = n === 1 ? (sx ? -1 : 1) : (i === 0 ? 1 : -1);
        manigliaOrizzAnta(g, px, py, pw, ph, z, verso, !_anteInBasso);
      }
    }
  }
}
function cassetti(g, w, h, d, n, matAnta, piccolo = null) {
  const z = d / 2;
  // Fughe da 2 mm, una in più dei cassetti; frontali tutti uguali oppure uno
  // piccolo in alto e gli altri uguali (stessa regola della distinta)
  const uw = w - FUGA_W, FC = 2;
  const alt = frontiCassetti(h, n, piccolo);       // dall'alto in basso
  let yTop = h / 2 - FC;
  for (let i = 0; i < alt.length; i++) {
    const ph = alt[i];
    const py = yTop - ph / 2;
    yTop -= ph + FC;
    if (_fingerPull) {
      const CH = Math.min(26, ph * 0.35);
      pannello(g, 0, py - CH / 2, z, uw, Math.max(40, ph - CH), matAnta || COL.cassetto);
      canaleFingerPull(g, 0, py + ph / 2 - CH / 2, z, uw, CH, true, matAnta);
    } else {
      pannello(g, 0, py, z, uw, ph, matAnta || COL.cassetto);
      maniglia(g, 0, py + ph / 2 - Math.min(28, ph * 0.3), z, true, Math.min(uw * 0.5, 320));
    }
  }
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
function colonnaFronte(g, w, h, d, m, matAnta) {
  const z = d / 2;
  const pw = w - FUGA_W;
  // porta bassa alta come i mobili bassi (70 o 80): tutta la parte bassa allineata
  const ab = _progColonne ? portaBassaColonna(_progColonne, m) : (m.altezzaBassa_mm || 700);
  const bottom = -h / 2;
  const porta = (yB, segH) => {
    const cyc = yB + segH / 2;
    const ph = segH - FUGA_H;
    if (_fingerPull) {
      const CW = 30;                                 // larghezza del canale (a dx)
      pannello(g, -CW / 2, cyc, z, pw - CW, ph, matAnta || COL.anta);
      canaleFingerPull(g, pw / 2 - CW / 2, cyc, z, ph, CW, false, matAnta);
    } else {
      pannello(g, 0, cyc, z, pw, ph, matAnta || COL.anta);
      maniglia(g, pw / 2 - 30, cyc, z, false, Math.min(260, ph * 0.4));
    }
  };
  porta(bottom, ab);                 // porta bassa
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
    const vanoH = Math.max(100, Math.min(m.altezzaVano_mm || 600, rem - 100));
    ripianoColonna(g, w, d, y0);              // ripiano sotto il vano
    ripianoColonna(g, w, d, y0 + vanoH);      // ripiano sopra il vano
    const topH = rem - vanoH;
    if (topH > 60) porta(y0 + vanoH, topH);   // porta alta (il vano resta aperto)
  } else {
    porta(y0, rem);                  // porta unica a tutta altezza
  }
}

/** Ripiano orizzontale della colonna (visibile nel vano aperto). */
function ripianoColonna(g, w, d, y) {
  const sh = new THREE.Mesh(
    new THREE.BoxGeometry(w - FUGA_W, 18, d - 40),
    new THREE.MeshStandardMaterial({ color: COL.colonna, roughness: 0.9, metalness: 0 }));
  sh.position.set(0, y, -5);
  sh.castShadow = true; sh.receiveShadow = true;
  g.add(sh);
}

/** Lavastoviglie a incasso: anta unica + striscia comandi inox in alto. */
/**
 * Fronte LAVASTOVIGLIE a vista: sportello in ACCIAIO INOX con fascia comandi
 * NERA in alto (schermo + spie) e maniglia a barra — stile Bosch/Siemens.
 * Costruito DAVANTI alla faccia del mobile (Z0) per non essere coperto.
 */
function lavastoviglieFronte(g, w, h, d) {
  const z = d / 2, Z0 = z + 2;
  const matInox = new THREE.MeshStandardMaterial({ color: 0xc4c5c9, roughness: 0.32, metalness: 0.88, envMapIntensity: 0.9 });
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
  const nAnte = freeW >= 900 ? 2 : 1;
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

// Colori LED per temperatura (K approssimativi): caldo ~3000K, medio ~4000K,
// freddo ~6500K. Valori scelti per leggibilita' sul 3D, non riflettenti
// perche' le strisce LED viste di sotto appaiono molto luminose.
const LED_COLORI = {
  caldo:  0xffb878,   // bianco caldo (giallo/ambra)
  medio:  0xffe8c8,   // bianco neutro (crema)
  freddo: 0xc8dcff,   // bianco freddo (azzurrino)
};

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
function aggiungiLedPensile(g, w, h, d, colore, avanti = 0) {
  const hex = LED_COLORI[colore] || LED_COLORI.caldo;
  const stripW = Math.max(60, w - 40);
  const stripH = 6;
  const stripD = 18;
  // Striscia LED emissive visibile (barra accesa, sempre al colore pieno).
  const mat = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  const geo = new THREE.BoxGeometry(stripW, stripH, stripD);
  const mesh = new THREE.Mesh(geo, mat);
  const zStrip = -d / 2 + stripD / 2 + 4 + avanti;
  mesh.position.set(0, -h / 2 + stripH / 2, zStrip);
  g.add(mesh);
  // Come un LED vero: illumina VERSO IL BASSO (piano di lavoro) e un po' la
  // parete dietro, non di lato. Coni morbidi e limitati: niente "bruciato"
  // sui costadi e sui fianchi delle colonne vicine.
  const spot = new THREE.SpotLight(hex, 5000, 2600, Math.PI / 3.6, 1.0, 1.0);
  spot.position.set(0, -h / 2 - 6, zStrip + 10);
  spot.target.position.set(0, -h / 2 - 1000, zStrip + 160);
  g.add(spot);
  g.add(spot.target);
  // bagliore sulla parete/pannello dietro: cono stretto rivolto al muro
  const muro = new THREE.SpotLight(hex, 1900, 1500, Math.PI / 4, 1.0, 1.0);
  muro.position.set(0, -h / 2 - 10, zStrip + 40);
  muro.target.position.set(0, -h / 2 - 500, -d / 2 - 200);
  g.add(muro);
  g.add(muro.target);
}

/**
 * Pensile ad angolo a L (pezzo unico): due bracci perpendicolari, ingombro
 * w×d (63×63), ciascun braccio profondo come un pensile normale. Un'anta
 * sul fronte interno di ogni braccio. L'angolo pieno sta verso il retro-
 * sinistra (lato muri); l'utente ruota il modulo per l'angolo giusto.
 */
function pensileAngoloL(g, w, h, d, coloreCorpo, matAnta) {
  const prof = PROFONDITA_PENSILE;                   // profondità di ogni braccio
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
  // Braccio B: lungo Z, addossato al lato sinistro (-x).
  mkBox(prof, d, -w / 2 + prof / 2, 0);
  // Anta A: sul fronte del braccio A (+z), sulla parte non coperta dal braccio B.
  const antaAw = w - prof;
  const antaAcx = (-w / 2 + prof + w / 2) / 2;
  const zA = -d / 2 + prof;
  pannello(g, antaAcx, 0, zA, antaAw - FUGA_W, h - FUGA_H, matAnta || COL.anta);
  manigliaOrizzAnta(g, antaAcx, 0, antaAw - FUGA_W, h - FUGA_H, zA, -1, false);
  // Anta B: sul fronte del braccio B (+x), in un subgruppo ruotato +90°.
  const subB = new THREE.Group();
  const antaBw = d - prof;
  pannello(subB, 0, 0, 0, antaBw - FUGA_W, h - FUGA_H, matAnta || COL.anta);
  manigliaOrizzAnta(subB, 0, 0, antaBw - FUGA_W, h - FUGA_H, 0, 1, false);
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
  man.position.set(w * 0.16 + nx * 16 - 120 * nz, 0, d * 0.16 + nz * 16 + 120 * nx);
  g.add(man);
}

/** Costruisce il mobile completo centrato nell'origine (corpo + fronti). */
function costruisciMobile(cat, tipo, m, w, h, d, matAnta, opt = {}) {
  const g = new THREE.Group();
  _fingerPull = fpCat(_fpByCat, cat);   // finger-pull per categoria del mobile
  _maniglia = manigliaCat(cat);         // maniglia del catalogo per categoria
  // Colonna: il fianco si vede (sopra i pensili, di lato) → stesso materiale
  // delle ante della colonna, non il colore crema del corpo
  const coloreCorpo = cat === 'pensile' ? COL.pensile
    : cat === 'colonna' ? ((matAnta && matAnta.isMaterial) ? matAnta : COL.colonna)
    : cat === 'regletta' ? COL.regletta : cat === 'lavatrice' ? 0x17181d
    : cat === 'lavastoviglie' ? 0xbcbdc2 : COL.corpo;
  // Pensile angolo a L: corpo a L (due bracci), non il box quadrato.
  if (tipo === 'pensile-angolo') { pensileAngoloL(g, w, h, d, coloreCorpo, matAnta); return g; }
  // Colonna con VANO APERTO: carcassa a fronte aperto (si vede dentro);
  // le altre colonne/mobili restano scatola piena.
  const colonnaVano = cat === 'colonna' && m && m.variante === 'vano';
  // Mobile del LAVELLO: aperto sopra (come nella realtà), sennò il blocco
  // pieno arriva sotto il piano e copre la vasca: nel foro si vedrebbe solo
  // il coperchio del mobile, non la profondità.
  const conLavello = cat !== 'colonna' && cat !== 'pensile' && (tipo === 'lavello' || (m && m.lavello));
  g.add(colonnaVano ? carcassaColonna(w, h, d, coloreCorpo)
    : conLavello ? carcassaColonna(w, h, d, coloreCorpo, false)
    : corpo(w, h, d, coloreCorpo));
  if (cat === 'regletta') return g;
  if (opt.cieco && opt.cieco.coperto) { anteCieche(g, w, h, d, matAnta, opt.cieco); return g; }
  if (tipo === 'pensile-angolo-45') { pensileAngoloFronte(g, w, h, d, matAnta); return g; }
  if (cat === 'colonna') { colonnaFronte(g, w, h, d, m, matAnta); return g; }
  if (tipo === 'base-cassetti') { cassetti(g, w, h, d, Math.max(1, m.cassetti || 3), matAnta, m.cassettoPiccolo_mm); return g; }
  if (tipo === 'lavello') { ante(g, w, h, d, w >= 900 ? 2 : 1, matAnta); return g; } // lavello disegnato sopra il top
  if (tipo === 'lavastoviglie') { lavastoviglieFronte(g, w, h, d); return g; }
  if (cat === 'lavatrice') { lavatriceFronte(g, w, h, d); return g; }
  if (tipo === 'forno') { fronteForno(g, w, h, d, matAnta); return g; } // placca sopra il top
  // base con ante / pensile (il pensile può avere l'anta sporgente sotto)
  _anteInBasso = cat === 'pensile';
  ante(g, w, h, d, anteDiMobile(m), matAnta, opt.sporg, m.antaLato);
  _anteInBasso = false;
  return g;
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

export function aggiornaScena3d(progetto, reframe = false, selezionato = null) {
  if (!scene) return;
  selId = selezionato;
  _lastProgetto = progetto;
  _fpByCat = progetto.fingerPull || {};
  _manByCat = progetto.maniglie || {};
  _stileForno = (progetto.finiture || {}).forno || 'inox';
  _progColonne = progetto;
  _reRenderMan = () => { if (_lastProgetto) aggiornaScena3d(_lastProgetto, false, selId); };
  // L'illuminazione della scena resta sempre al valore pieno (giorno) sia
  // con i LED spenti che accesi: non si vuole che i LED spengano l'ambiente.
  for (const { l, base } of luciAmbiente) l.intensity = base;
  while (gruppo.children.length) gruppo.remove(gruppo.children[0]);
  const full = progetto.piano.pareti || [];
  const vertici = calcolaVertici(full);
  const bb = bbox(progetto, vertici);

  // Sfondo/pavimento scelti (solo estetica, non tocca luci/riflessi)
  const sf = sfondoDi(progetto.sfondo);
  scene.background = new THREE.Color(sf.bg);

  // Pavimento + griglia
  const padW = (bb.maxX - bb.minX) + 2000, padD = (bb.maxY - bb.minY) + 2000;
  const cxF = (bb.minX + bb.maxX) / 2, czF = -(bb.minY + bb.maxY) / 2;
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD),
    new THREE.MeshStandardMaterial({ color: sf.pav, roughness: 0.95 }));
  pav.rotation.x = -Math.PI / 2; pav.position.set(cxF, 0, czF); gruppo.add(pav);
  const grid = new THREE.GridHelper(Math.max(padW, padD), Math.round(Math.max(padW, padD) / 500), sf.g1, sf.g2);
  grid.position.set(cxF, 1, czF); gruppo.add(grid);

  // Muri di riferimento
  full.forEach((p, i) => {
    if (p.assente) return;
    const a = vertici[i], b = vertici[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(L, ALT_MURO, 60),
      new THREE.MeshStandardMaterial({ color: COL.muro, roughness: 0.9, transparent: true, opacity: 0.3 }));
    muro.position.set((a.x + b.x) / 2, ALT_MURO / 2, -(a.y + b.y) / 2);
    muro.rotation.y = -Math.atan2(dy, dx);
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
  const matCostado = col.costado ? getMaterialeTHREE(col.costado, reRender) : null;
  // Encimera (piano di lavoro): materiale e spessore dall'eventuale scelta
  // utente. Nessuna scelta -> colore COL.top e spessore SP_TOP come prima.
  const encId = progetto.encimera && progetto.encimera.materiale;
  const encDef = encId ? MATERIALI.find((m) => m.id === encId) : null;
  const matTop = encId ? getMaterialeTHREE(encId, reRender) : null;
  const spTop = (encDef && encDef.spessore != null) ? encDef.spessore : SP_TOP;

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
      gruppo.add(collocaMobile(g, px, zocc, -py, porta, p.angolo_gradi));
      if (mm.tipo === 'forno' || mm.tipo === 'lavello') {
        accessori.push({ id: mm.id, x: px, y: py, rot: p.angolo_gradi, w: mm.larghezza_mm, d: PROFONDITA_BASE,
          surfaceY: zocc + porta + spTop, placca: mm.tipo === 'forno', lavello: mm.tipo === 'lavello',
          fuochi: fuochiPerLarghezza(mm.larghezza_mm) });
      }
    }
  });

  // Quota alta = cima delle colonne (cassa + zoccolo). Pensili e costadi alti
  // si allineano a questa quota; se non ci sono colonne, uso un valore di
  // riferimento (2350).
  const topLine = quotaAltaColonne(progetto);
  const QUOTA_RIF = topLine != null ? topLine : 2350;
  // Cima di ogni pensile (stessa regola del pensile qui sotto): serve ai
  // costadi alti, che vanno SEMPRE a filo sopra col pensile vicino.
  const cimePensili = (progetto.mobiliLiberi || []).filter((x) => categoriaTipo(x.tipo) === 'pensile')
    .map((x) => { const h = x.altezza_mm || 700; return { x: x.x, y: x.y, cima: (topLine != null ? topLine - h : MONTAGGIO_PENSILE) + h,
      hAnta: h + (antaPensileSporge(progetto.antaPensile, h) ? 20 : 0) }; });

  // Mobili liberi
  for (const m of (progetto.mobiliLiberi || [])) {
    const cat = categoriaTipo(m.tipo);
    const dim = dimMobile(m);
    const cx = m.x, cz = -m.y;
    let g3d = null;
    if (cat === 'oggetto') {
      // Oggetto 3D (sgabello, decor): posato a terra, nessuno zoccolo/piano.
      const og = costruisciOggetto(m.tipo);
      if (og) { og.position.set(cx, 0, cz); og.rotation.y = -(m.rot || 0) * Math.PI / 180; g3d = og; }
    } else if (cat === 'pensile') {
      const h = m.altezza_mm || 700;
      // Se ci sono colonne, la CIMA del pensile va alla cima delle colonne;
      // altrimenti resta appeso all'altezza standard (140 cm da terra).
      const base = topLine != null ? (topLine - h) : MONTAGGIO_PENSILE;
      pensiliPlan.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, yBottom: base });
      const sporg = antaPensileSporge(progetto.antaPensile, h);
      const gPens = costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matPensile, { sporg });
      // LED sotto i pensili (opzionale, con scelta temperatura colore).
      // Il pensile-angolo (diagonale) non lo prende: ha una geometria dedicata.
      if (progetto.led && progetto.led.attivo && !String(m.tipo).startsWith('pensile-angolo')) {
        const conPannello = progetto.schienale && progetto.schienale.attivo;
        aggiungiLedPensile(gPens, dim.w, h, dim.d, progetto.led.colore, conPannello ? SP_SCHIENALE : 0);
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
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d, matColonna), cx, zocc, cz, h, m.rot);
    } else if (cat === 'regletta') {
      const h = m.altezza_mm || 700;
      const zocc = zoccoloPerAltezza(h);
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, h, dim.d), cx, zocc, cz, h, m.rot);
    } else if (cat === 'pannello') {
      // Pannello su misura: box 18 mm di spessore, finitura come le ante.
      // Va da terra fino all'altezza scelta, niente zoccolo e niente top.
      const h = m.altezza_mm || 2200;
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matBase || COL.anta), cx, 0, cz, h, m.rot);
    } else if (cat === 'costado') {
      let h = m.altezza_mm || 850;
      // Costado "alto" (profondità da pensile): sta in alto, appeso all'altezza
      // di montaggio dei pensili, non per terra.
      // Il costado ALTO è a filo SOPRA col pensile più vicino (qualunque sia
      // la porta: 70, 72, 90, 92) e ha il colore delle ante dei pensili.
      const alto = (m.profondita_mm || 620) < 500;
      let base = alto ? MONTAGGIO_PENSILE : (h >= 1500 ? Math.max(0, QUOTA_RIF - h) : 0);
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
      const matProprio = progetto.costadiDiversi && m.colore ? getMaterialeTHREE(m.colore, reRender) : null;
      // Senza un colore scelto per i costadi il costado prende le ANTE vicine
      // (mai il crema del corpo): alto → pensili, a tutta altezza → colonne,
      // basso → mobili bassi
      const matC = matProprio || (alto ? (matPensile || matCostado)
        : (matCostado || (h >= 1500 ? (matColonna || matBase) : matBase))) || COL.costado;
      g3d = collocaMobile(corpo(dim.w, h, dim.d, matC), cx, base, cz, h, m.rot);
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
      g3d = collocaMobile(costruisciMobile(cat, m.tipo, m, dim.w, porta, dim.d, matBase, { cieco: ciecoOpt }), cx, zocc, cz, porta, m.rot);
      if (cieco && progetto.autoRegletta !== false) renderRegolettaAngolo(cieco, m, porta, zocc, matBase, progetto.reglettaAngolo);
      basiTop.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc, topY: zocc + porta });
      zoccoli.push({ x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d, zocc });
      // Placca / lavello (tipi forno/lavello oppure aggiunti a mano): sopra il top
      const hasPlacca = m.tipo === 'forno' || m.placca;
      const hasLavello = m.tipo === 'lavello' || m.lavello;
      if (hasPlacca || hasLavello) {
        accessori.push({ id: m.id, x: m.x, y: m.y, rot: m.rot, w: dim.w, d: dim.d,
          surfaceY: zocc + porta + spTop, placca: hasPlacca, lavello: hasLavello,
          fuochi: fuochiPerLarghezza(dim.w) });
      }
    }
    if (g3d) { g3d.userData.mobId = m.id; if (m.id === selId) evidenzia(g3d); gruppo.add(g3d); }
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
  renderTopContinui(basiTop, fianchi, spTop, matTop, accessori.filter((a) => a.lavello || a.placca), schienale);
  // Lavello, piano cottura e rubinetto SOPRA il top
  for (const a of accessori) aggiungiAccessorioTop(a, progetto.finiture || {});

  uvInScala(gruppo);
  if (reframe) inquadra(bb);
  if (renderer) renderer.render(scene, camera);
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
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = mat.map.anisotropy || 4;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.needsUpdate = true;
    _texTopCache.set(mat.map, tex);
  }
  const hit = _matTopCache.get(mat);
  if (hit) { hit.map = tex; hit.needsUpdate = true; return hit; }
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    userData: mat.userData && mat.userData.campioneMm ? { campioneMm: mat.userData.campioneMm } : {},
    // Top completamente opaco: la texture deve apparire sul 3D come nella
    // foto prodotto, senza essere schiarita dalla luce ambiente della scena.
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.0,
  });
  pianoComeFoto(m);          // colori, sfumature e venature identici alla foto
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

/** Distanza di un punto (pianta) dal segmento ab. */
function distSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const SP_SCHIENALE = 12;          // spessore del pannello dietro il piano
const H_SCHIENALE = 600;          // altezza se sopra non ci sono pensili

function renderTopContinui(basi, fianchi = [], thickness = SP_TOP, mat = null, lavelli = [], schienale = null) {
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
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, topY } = G;
    for (const run of tratti(G.items, c, s)) {
      let lo = run.lo, hi = run.hi;
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      let endLo = lo - 20, endHi = hi + 20;   // estremità libere: piccola sporgenza
      for (const f of fianchi) {
        const pf = proiettaFianco(f, c, s);
        if (Math.abs(pf.perp - perp) > 350) continue;   // non sulla stessa linea
        const tall = (f.h || 0) >= 1500;
        if (pf.along >= hi - 1 && pf.near <= hi + 90) {          // estremità destra
          endHi = (f.cat === 'costado' && !tall) ? pf.far : hi;
        }
        if (pf.along <= lo + 1 && pf.far >= lo - 90) {           // estremità sinistra
          endLo = (f.cat === 'costado' && !tall) ? pf.near : lo;
        }
      }
      // Profondità del piano: normalmente = profondità dei moduli; ma se sulla
      // stessa fila ci sono COSTADI bassi più profondi dei moduli (es. isola),
      // il piano si estende ALL'INDIETRO per coprirli — il fronte (lato porte)
      // resta dov'è. Copro l'unione delle impronte moduli + costadi.
      let pMin = perp - G.d / 2, pMax = perp + G.d / 2;
      for (const f of fianchi) {
        if (f.cat !== 'costado' || (f.h || 0) >= 1500) continue;   // solo costadi bassi
        const pf = proiettaFianco(f, c, s);
        if (pf.far < endLo - 90 || pf.near > endHi + 90) continue;  // non su questa fila
        const fco = Math.cos((f.rot || 0) * Math.PI / 180), fso = Math.sin((f.rot || 0) * Math.PI / 180);
        const hV = (f.w / 2) * Math.abs(fso * c - fco * s) + (f.d / 2) * Math.abs(fco * c + fso * s);
        const fMin = pf.perp - hV, fMax = pf.perp + hV;
        if (fMax < perp - G.d / 2 - 20 || fMin > perp + G.d / 2 + 20) continue; // non condivide il fronte
        pMin = Math.min(pMin, fMin); pMax = Math.max(pMax, fMax);
      }
      const depth = (pMax - pMin) + 40;
      const perpTop = (pMin + pMax) / 2;
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
          fori.push({ u: alongS - centerAlong, v: (perpS - perpTop) + zc, w: vw + 6, d: vd + 6 });
        } else if (lv.placca) {
          // piano cottura INCASSATO: il vetro sta nel foro, così si vede da
          // qualsiasi distanza (sopra il piano "spariva" da lontano)
          const { pw, pd } = dimPlacca(lv.w, lv.d);
          fori.push({ u: alongS - centerAlong, v: perpS - perpTop, w: pw - 12, d: pd - 12 });
        }
      }
      const slab = fori.length
        ? slabConFori(len, thickness, depth, matTop || COL.top, fori)
        : corpo(len, thickness, depth, matTop || COL.top);
      // Pannello dietro il piano: solo se dietro questa fila c'è un muro
      if (schienale) {
        const perpMuro = perp + G.d / 2;                       // retro dei moduli = muro
        const P = (al) => ({ x: c * al - s * perpMuro, y: s * al + c * perpMuro });
        const controlli = [P(centerAlong), P(lo + 50), P(hi - 50)];
        const muro = schienale.muri.some((w) => controlli.filter((q) => distSegmento(q, w.a, w.b) < 90).length >= 2);
        if (muro) {
          // altezza: fino ai pensili sopra questa fila, altrimenti 60 cm
          let yPens = Infinity;
          for (const pz of schienale.pensili) {
            if (rotNorm(pz.rot) !== rotN) continue;
            const al = pz.x * c + pz.y * s, pp = pz.x * (-s) + pz.y * c;
            if (Math.abs(al - centerAlong) > len / 2 + pz.w / 2 - 20) continue;
            if (pp > perpMuro + 50 || pp < perpMuro - 700) continue;
            yPens = Math.min(yPens, pz.yBottom);
          }
          const yTop = topY + thickness;
          const H = Number.isFinite(yPens) && yPens - yTop > 100 ? yPens - yTop : H_SCHIENALE;
          // coordinate locali della lastra: +z = fronte (stanza), il muro è dietro (−z)
          const zMuro = -(perpMuro - perpTop);
          const pann = corpo(len, H, SP_SCHIENALE, materialePerSchienale(schienale.mat || matTop) || COL.top);
          pann.position.set(0, thickness / 2 + H / 2, zMuro + SP_SCHIENALE / 2);
          pann.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
          slab.add(pann);
        }
      }
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
  for (const key in gruppi) {
    const G = gruppi[key];
    const { c, s, rotN, zocc } = G;
    for (const run of tratti(G.items, c, s)) {
      let perpSum = 0; for (const b of run.items) perpSum += b.x * (-s) + b.y * c;
      const perp = perpSum / run.items.length;
      const len = run.hi - run.lo;
      const centerAlong = (run.lo + run.hi) / 2;
      const cx = c * centerAlong + (-s) * perp;
      const cy = s * centerAlong + c * perp;
      const geo = new THREE.BoxGeometry(len, zocc, G.d - 100);
      const mesh = new THREE.Mesh(geo, mat ? mat.clone() : new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 0.96, metalness: 0 }));
      mesh.position.z = -50;                 // arretrato rispetto al fronte
      const g = new THREE.Group(); g.add(mesh);
      gruppo.add(collocaMobile(g, cx, 0, -cy, zocc, rotN));
    }
  }
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

function inquadra(bb) {
  const cx = (bb.minX + bb.maxX) / 2, cz = -(bb.minY + bb.maxY) / 2;
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY) + 2000;
  controls.target.set(cx, 800, cz);
  camera.position.set(cx + diag * 0.7, diag * 0.75 + 1500, cz + diag * 0.9);
  camera.updateProjectionMatrix();
  controls.update();
}

export function smontaScena3d() {
  animazioneAttiva = false;
  window.removeEventListener('resize', forzaResize3d);
}
