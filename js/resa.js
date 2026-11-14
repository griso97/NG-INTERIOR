// =============================================================================
// RESA REALISTICA IN TEMPO REALE — NG INTERIOR (cucina, armadi, modulari)
// =============================================================================
// Niente immagine che "si sviluppa": la vista che si gira col dito è già
// quella bella. Sopra il disegno normale (colori dei materiali invariati,
// legno identico alla foto) aggiunge:
//  - OMBRE DI CONTATTO (GTAO): angoli, sotto i pensili, tra le ante, dove i
//    mobili toccano muro e pavimento — è quello che fa sembrare vera una foto;
//  - NITIDEZZA ADATTIVA: mentre si gira la vista disegna leggero (fluido sul
//    telefono), appena ci si ferma ridisegna UNA volta a piena nitidezza;
//  - DISEGNO SOLO QUANDO SERVE: vista ferma = nessun lavoro (batteria);
//  - FOTO: la stessa resa a grande risoluzione, in un istante.
// =============================================================================

import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const eTelefono = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));

/**
 * opz: { renderer, scene, camera, controls?, raggio (mm, ombre di contatto),
 *        intensita (0..1), prima?() (prima di ogni disegno) }
 * Ritorna { disegna(), cambiato(), tick(), dimensiona(), foto(lato), dispose() }.
 */
export function creaResa(opz) {
  const { renderer, scene, camera } = opz;
  const tel = eTelefono();
  const DPR = window.devicePixelRatio || 1;
  const DPR_MOTO = Math.min(DPR, tel ? 1.25 : 1.5);          // mentre si gira: fluido
  const DPR_FERMO = Math.min(DPR, tel ? 2 : 2);                // fermo: nitido come una foto
  let ao = null, quad = null, guasto = false;
  try {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    ao = new GTAOPass(scene, camera, Math.max(2, s.x), Math.max(2, s.y));
    ao.output = GTAOPass.OUTPUT.Off;                          // calcola soltanto: la fusione la faccio io
    ao.updateGtaoMaterial({ radius: opz.raggio || 320, distanceExponent: 1.6, thickness: 700, distanceFallOff: 1, scale: 1, samples: tel ? 12 : 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: tel ? 12 : 16 });
    ao.blendIntensity = opz.intensita ?? 0.9;
    quad = new FullScreenQuad(ao.blendMaterial);
  } catch (e) { console.warn('Ombre di contatto non disponibili', e); ao = null; }

  let sporco = true, ultimoMoto = 0, nitido = false;
  const camPrima = new THREE.Matrix4();

  function dimensiona(dpr) {
    const el = renderer.domElement;
    const w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    if (!w || !h) return;
    if (Math.abs(renderer.getPixelRatio() - dpr) > 0.01) renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (ao && (ao.width !== s.x || ao.height !== s.y)) ao.setSize(s.x, s.y);
  }

  /** Disegna adesso: scena + ombre di contatto sopra. */
  function disegna() {
    if (opz.prima) opz.prima();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    if (!ao || guasto || opz.senzaAO?.()) return;
    try {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (ao.width !== s.x || ao.height !== s.y) ao.setSize(s.x, s.y);
      ao.render(renderer, null, null);                         // normali + AO + pulizia
      ao.blendMaterial.uniforms.tDiffuse.value = ao.pdRenderTarget.texture;
      ao.blendMaterial.uniforms.intensity.value = ao.blendIntensity;
      const auto = renderer.autoClear;
      renderer.setRenderTarget(null); renderer.autoClear = false;
      quad.render(renderer);                                   // moltiplica: angoli e contatti più scuri
      renderer.autoClear = auto;
    } catch (e) { guasto = true; console.warn('Ombre di contatto disattivate', e); }
  }

  /** Qualcosa è cambiato (scena, materiali, selezione): ridisegna al prossimo giro. */
  function cambiato() { sporco = true; }

  /**
   * Da chiamare a ogni frame (requestAnimationFrame): disegna solo se serve.
   * moto = la vista si sta muovendo per altro (porte che si aprono, trascinamento).
   */
  function tick(moto = false) {
    const ora = performance.now();
    const camMossa = !camPrima.equals(camera.matrixWorld);
    if (camMossa) camPrima.copy(camera.matrixWorld);
    if (camMossa || moto) {
      ultimoMoto = ora;
      if (nitido) { dimensiona(DPR_MOTO); nitido = false; }
      disegna(); sporco = false;
      return;
    }
    // ferma da un attimo → una volta a piena nitidezza
    if (!nitido && ora - ultimoMoto > 180) {
      dimensiona(DPR_FERMO); nitido = true; disegna(); sporco = false;
      return;
    }
    if (sporco) { disegna(); sporco = false; }
  }

  /**
   * FOTO: la stessa resa a grande risoluzione (lato lungo = lato px).
   * Ritorna un canvas (copia), la vista torna come prima.
   */
  function foto(lato = 2400) {
    const el = renderer.domElement;
    const w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    const kk = lato / Math.max(w, h);
    const lim = renderer.capabilities.maxRenderbufferSize || 4096;
    const pr = Math.min(kk, lim / Math.max(w, h));
    const prima = renderer.getPixelRatio();
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (ao) ao.setSize(s.x, s.y);
    disegna();
    const c = document.createElement('canvas'); c.width = s.x; c.height = s.y;
    c.getContext('2d').drawImage(el, 0, 0);
    renderer.setPixelRatio(prima); renderer.setSize(w, h, false);
    const s2 = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (ao) ao.setSize(s2.x, s2.y);
    disegna();
    return c;
  }

  function dispose() { try { ao && ao.dispose(); quad && quad.dispose(); } catch (_) { /* niente */ } ao = null; }

  dimensiona(DPR_MOTO);
  return { disegna, cambiato, tick, dimensiona: () => dimensiona(nitido ? DPR_FERMO : DPR_MOTO), foto, dispose };
}

// -----------------------------------------------------------------------------
// OMBRE della luce principale: morbide, calcolate solo quando la scena cambia
// -----------------------------------------------------------------------------
export function preparaOmbre(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;             // la luce non si muove: si rifanno solo se cambia la scena
  renderer.shadowMap.needsUpdate = true;
}
/** Inquadra le ombre della luce sulla scena (box) e le fa rifare. */
export function inquadraOmbre(renderer, luce, box, dir = new THREE.Vector3(0.45, 1, 0.6)) {
  if (!box || box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 200;
  luce.position.copy(c).addScaledVector(dir.clone().normalize(), r * 2);
  luce.target.position.copy(c); luce.target.updateMatrixWorld();
  const cam = luce.shadow.camera;
  cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 10; cam.far = r * 4;
  cam.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
}
/** Tutti i pezzi solidi fanno e ricevono ombra (vetri, linee e luci no). */
export function ombreSuTutto(radice, escludi = () => false) {
  radice.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const trasp = mats.some((m) => m && (m.transparent || m.isMeshBasicMaterial));
    if (escludi(o)) { o.castShadow = false; o.receiveShadow = !trasp; return; }
    o.castShadow = !trasp; o.receiveShadow = !trasp;
  });
}

// -----------------------------------------------------------------------------
// PAVIMENTO VERO: parquet di rovere (sfondo chiaro) o gres grande (neutro/scuro)
// -----------------------------------------------------------------------------
const _pav = {};                         // tipo → { tex, mm } (una tela per tipo)
function rnd(seme) { let s = seme; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function telaParquet(legno) {
  const S = 2048, MM = 2400, k = S / MM, aw = 200, al = 1200;      // assi 20 × 120 cm
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#b89a76'; g.fillRect(0, 0, S, S);
  const r = rnd(7);
  // striscia lunga di legno: la foto ripetuta in verticale (venatura lungo l'asse)
  const st = document.createElement('canvas'); st.width = legno.width; st.height = legno.height * 4;
  const gs = st.getContext('2d');
  for (let i = 0; i < 4; i++) {
    gs.save();
    if (i % 2) { gs.translate(0, legno.height * (i + 1)); gs.scale(1, -1); gs.drawImage(legno, 0, 0); } else gs.drawImage(legno, 0, legno.height * i);
    gs.restore();
  }
  const pxMm = legno.width / 600;
  for (let col = 0; col * aw < MM; col++) {
    const sfasa = (col % 3) * al / 3 + (col % 2) * 170;
    for (let rr = -1; rr * al < MM + al; rr++) {
      const x = col * aw * k, y = (rr * al + sfasa) * k, w = aw * k, h = al * k;
      const sc = 0.85 + r() * 0.35;
      const sw = Math.min(st.width, aw * pxMm * sc), sh = Math.min(st.height, al * pxMm * sc);
      const sx = r() * (st.width - sw), sy = r() * (st.height - sh);
      g.save();
      if (r() < 0.5) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(st, sx, sy, sw, sh, 0, 0, w, h); } else g.drawImage(st, sx, sy, sw, sh, x, y, w, h);
      g.restore();
      const t = r();
      g.fillStyle = t < 0.5 ? `rgba(60,40,20,${0.04 + r() * 0.1})` : `rgba(255,240,220,${0.03 + r() * 0.08})`;
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(40,28,18,0.45)'; g.fillRect(x, y, 1.6, h);
      g.fillStyle = 'rgba(40,28,18,0.32)'; g.fillRect(x, y, w, 1.2);
    }
  }
  return { c, mm: MM };
}
function telaGres(base) {
  const S = 1024, MM = 1200, k = S / MM, L = 600;                    // lastre 60 × 60
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const col = new THREE.Color(base), r = rnd(11);
  const hex = (cc) => `rgb(${Math.round(cc.r * 255)},${Math.round(cc.g * 255)},${Math.round(cc.b * 255)})`;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = col.clone().offsetHSL(0, 0, (r() - 0.5) * 0.03);
    g.fillStyle = hex(v); g.fillRect(i * L * k, j * L * k, L * k, L * k);
    // grana fine della pietra
    for (let n = 0; n < 2600; n++) {
      const a = r() * 0.05;
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      g.fillRect(i * L * k + r() * L * k, j * L * k + r() * L * k, 1 + r() * 2.5, 1 + r() * 2.5);
    }
  }
  g.fillStyle = 'rgba(70,64,56,0.55)';                                // fughe 2 mm
  for (let i = 0; i <= 2; i++) { g.fillRect(i * L * k - 1, 0, 2, S); g.fillRect(0, i * L * k - 1, S, 2); }
  return { c, mm: MM };
}
/**
 * Materiale del pavimento (sfondo: 'chiaro' = parquet, altri = gres del colore
 * dello sfondo) per un piano largo w × d mm. quandoPronto() se la foto arriva dopo.
 */
export function pavimentoVero(sfondo, colore, w, d, quandoPronto) {
  const parquet = sfondo === 'chiaro';
  const m = new THREE.MeshStandardMaterial({ color: parquet ? 0xb89a76 : colore, roughness: parquet ? 0.62 : 0.5, metalness: 0, envMapIntensity: 0.45 });
  const applica = (p) => {
    const t = p.tex.clone(); t.needsUpdate = true;
    t.repeat.set(w / p.mm, d / p.mm);
    m.map = t; m.color.set(0xffffff); m.needsUpdate = true;
  };
  const chiave = parquet ? 'parquet' : 'gres-' + colore;
  if (_pav[chiave]) { applica(_pav[chiave]); return m; }
  const fai = (tela) => {
    const tex = new THREE.CanvasTexture(tela.c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 16;
    _pav[chiave] = { tex, mm: tela.mm };
    applica(_pav[chiave]);
  };
  if (!parquet) { fai(telaGres(colore)); return m; }
  const img = new Image();
  img.onload = () => { fai(telaParquet(img)); if (quandoPronto) quandoPronto(); };
  img.src = 'materials/r3-supra-oak.jpg';
  return m;
}
