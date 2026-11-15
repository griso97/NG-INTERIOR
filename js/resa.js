// =============================================================================
// RESA REALISTICA IN TEMPO REALE — NG INTERIOR (cucina, armadi, modulari)
// =============================================================================
// Niente immagine che "si sviluppa": la vista che si gira col dito è già
// quella bella. Sopra il disegno normale (colori dei materiali invariati,
// legno identico alla foto) aggiunge:
//  - OMBRE DI CONTATTO (GTAO): angoli, sotto i pensili, tra le ante, dove i
//    mobili toccano muro e pavimento — è quello che fa sembrare vera una foto;
//  - NITIDEZZA ADATTIVA: mentre si gira la vista disegna leggero (fluido sul
//    telefono e sul computer, che si adatta da solo alla sua scheda grafica),
//    appena ci si ferma ridisegna UNA volta a piena nitidezza;
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
  const DPR_FERMO_MAX = Math.min(DPR, tel ? 3 : 2);            // fermo: nitido come una foto (tutti i pixel del telefono)
  // COMPUTER: lo schermo è grande, quindi ogni fotogramma ha molti più pixel che
  // sul telefono e spesso la scheda grafica è più debole. Mentre si gira la vista:
  //  - un tetto di pixel (come sul telefono: fluido),
  //  - la risoluzione si adatta da sola se la scheda grafica non sta al passo
  //    (e se lo ricorda per la volta dopo),
  //  - una pausa breve col tasto ancora giù non fa partire il disegno nitido,
  //  - le ombre di contatto del movimento e quelle da fermo hanno memorie
  //    separate: niente memoria grafica rifatta a ogni inizio/fine giro.
  // Da fermo torna tutto a piena nitidezza. Il telefono resta com'è.
  const PIX_MOTO = 1.2e6, PIX_FERMO = 6e6, FATT_MIN = 0.55;
  let fattore = 1;
  if (!tel) { try { const f = parseFloat(localStorage.getItem('ng-3d-fluidita')); if (f >= FATT_MIN && f <= 1) fattore = f; } catch (_) { /* niente */ } }
  const areaCss = () => { const el = renderer.domElement; return Math.max(1, (el.clientWidth || el.width) * (el.clientHeight || el.height)); };
  const dprMoto = () => tel ? Math.min(DPR, 1.25)
    : Math.max(0.5, Math.min(DPR, 1.5, Math.sqrt(PIX_MOTO / areaCss())) * fattore);
  const dprFermo = () => tel ? DPR_FERMO_MAX : Math.min(DPR_FERMO_MAX, Math.max(1, Math.sqrt(PIX_FERMO / areaCss())));

  let ao = null, aoMoto = null, quad = null, guasto = false;
  const nuovoAO = (w, h) => {
    const a = new GTAOPass(scene, camera, Math.max(2, w), Math.max(2, h));
    a.output = GTAOPass.OUTPUT.Off;                           // calcola soltanto: la fusione la faccio io
    // ombre SOLO dove le cose si toccano davvero (angoli, sotto i pensili, tra le
    // ante): spessore piccolo → un oggetto davanti (sgabello) non sporca più
    // quello che sta dietro con un alone; pulizia più ampia → niente puntini
    a.updateGtaoMaterial({ radius: opz.raggio || 260, distanceExponent: 1.5, thickness: 140, distanceFallOff: 1, scale: 1, samples: 16 });
    a.updatePdMaterial({ lumaPhi: 10, depthPhi: 3, normalPhi: 4, radius: 9, rings: 3, samples: 16 });
    a.blendIntensity = opz.intensita ?? 0.9;
    return a;
  };
  try {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    ao = nuovoAO(s.x, s.y);
    if (!tel) aoMoto = nuovoAO(s.x, s.y);                      // computer: le sue (misura del movimento), niente memoria rifatta a ogni giro
    quad = new FullScreenQuad(ao.blendMaterial);
  } catch (e) { console.warn('Ombre di contatto non disponibili', e); ao = null; aoMoto = null; }

  let sporco = true, ultimoMoto = 0, nitido = false;
  const camPrima = new THREE.Matrix4();
  const _s = new THREE.Vector2();

  // dito / tasto del mouse ancora giù sulla vista: una pausa breve mentre si gira
  // non deve far scattare il disegno nitido (pesante) a metà del movimento
  const giu = new Set();
  const suGiu = (e) => giu.add(e.pointerId);
  const suSu = (e) => giu.delete(e.pointerId);
  const svuota = () => giu.clear();
  renderer.domElement.addEventListener('pointerdown', suGiu, true);
  window.addEventListener('pointerup', suSu, true);
  window.addEventListener('pointercancel', suSu, true);
  window.addEventListener('blur', svuota);

  function dimensiona(dpr) {
    const el = renderer.domElement;
    const w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    if (!w || !h) return;
    if (Math.abs(renderer.getPixelRatio() - dpr) > 0.01) renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    // le ombre di contatto si adattano da sole al primo disegno (disegna): quelle
    // da fermo restano grandi mentre si gira, così niente memoria rifatta a ogni giro
  }

  /** Disegna adesso: scena + ombre di contatto sopra (leggero = mentre si gira). */
  function disegna(leggero = false) {
    if (opz.prima) opz.prima();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    if (!ao || guasto || opz.senzaAO?.()) return;
    try {
      const s = renderer.getDrawingBufferSize(_s);
      const a = (leggero && aoMoto) ? aoMoto : ao;
      if (a.width !== s.x || a.height !== s.y) a.setSize(s.x, s.y);
      a.render(renderer, null, null);                          // normali + AO + pulizia
      a.blendMaterial.uniforms.tDiffuse.value = a.pdRenderTarget.texture;
      a.blendMaterial.uniforms.intensity.value = a.blendIntensity;
      quad.material = a.blendMaterial;
      const auto = renderer.autoClear;
      renderer.setRenderTarget(null); renderer.autoClear = false;
      quad.render(renderer);                                   // moltiplica: angoli e contatti più scuri
      renderer.autoClear = auto;
    } catch (e) { guasto = true; console.warn('Ombre di contatto disattivate', e); }
  }

  /** Qualcosa è cambiato (scena, materiali, selezione): ridisegna al prossimo giro. */
  function cambiato() { sporco = true; }

  // Computer: misura quanto dura ogni fotogramma mentre si gira la vista
  // (tra due fotogrammi disegnati uno dopo l'altro) e adatta la risoluzione.
  let tPrec = 0, salta = 0;
  const campioni = [];
  function misura(ora, consecutivo) {
    const dt = ora - tPrec; tPrec = ora;
    if (tel || !consecutivo) return;
    if (salta > 0) { salta--; return; }                       // subito dopo un cambio di misura: non conta
    campioni.push(dt);
    if (campioni.length < 12) return;
    campioni.sort((x, y) => x - y);
    const med = campioni[6]; campioni.length = 0;
    let f = fattore;
    if (med > 26 && fattore > FATT_MIN) f = Math.max(FATT_MIN, fattore * 0.8);     // sotto i ~38 fotogrammi al secondo
    else if (med < 18 && fattore < 1) f = Math.min(1, fattore * 1.12);             // fluido: riprovo più nitido
    if (f === fattore) return;
    fattore = f;
    try { localStorage.setItem('ng-3d-fluidita', f.toFixed(3)); } catch (_) { /* niente */ }
    dimensiona(dprMoto()); salta = 2;
  }

  /**
   * Da chiamare a ogni frame (requestAnimationFrame): disegna solo se serve.
   * moto = la vista si sta muovendo per altro (porte che si aprono, trascinamento).
   */
  let motoPrec = false;
  function tick(moto = false) {
    const ora = performance.now();
    const camMossa = !camPrima.equals(camera.matrixWorld);
    if (camMossa) camPrima.copy(camera.matrixWorld);
    if (camMossa || moto) {
      ultimoMoto = ora;
      if (nitido) { dimensiona(dprMoto()); nitido = false; salta = 2; }
      misura(ora, motoPrec);
      disegna(true); sporco = false; motoPrec = true;
      return;
    }
    motoPrec = false;
    // ferma da un attimo → una volta a piena nitidezza (col dito ancora giù aspetta di più)
    if (!nitido && ora - ultimoMoto > (giu.size ? 700 : 180)) {
      dimensiona(dprFermo()); nitido = true; disegna(false); sporco = false;
      return;
    }
    if (sporco) { disegna(!nitido); sporco = false; }
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
    disegna(!nitido);
    return c;
  }

  function dispose() {
    try { ao && ao.dispose(); aoMoto && aoMoto.dispose(); quad && quad.dispose(); } catch (_) { /* niente */ }
    ao = null; aoMoto = null;
    renderer.domElement.removeEventListener('pointerdown', suGiu, true);
    window.removeEventListener('pointerup', suSu, true);
    window.removeEventListener('pointercancel', suSu, true);
    window.removeEventListener('blur', svuota);
  }

  dimensiona(dprMoto());
  return { disegna, cambiato, tick, dimensiona: () => dimensiona(nitido ? dprFermo() : dprMoto()), foto, dispose };
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
