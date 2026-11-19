// =============================================================================
// RESA REALISTICA IN TEMPO REALE — NG INTERIOR (cucina, armadi, modulari)
// =============================================================================
// Niente immagine che "si sviluppa": la vista che si gira col dito è già
// quella bella. Sopra il disegno normale (colori dei materiali invariati,
// legno identico alla foto) aggiunge:
//  - OMBRE DI CONTATTO (GTAO): angoli, sotto i pensili, tra le ante, dove i
//    mobili toccano muro e pavimento — è quello che fa sembrare vera una foto;
//  - LEGGERO MENTRE SI GIRA: sul telefono meno pixel; sul computer stessa
//    nitidezza, e se la scheda grafica è lenta ombre di contatto più leggere;
//    appena ci si ferma ridisegna UNA volta a piena qualità;
//  - DISEGNO SOLO QUANDO SERVE: vista ferma = nessun lavoro (batteria);
//  - FOTO: la stessa resa a grande risoluzione, in un istante.
// =============================================================================

import * as THREE from 'three';
import { PAVIMENTI, GRUPPI_PAVIMENTI } from './pavimenti-dati.js?v=20261121h';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const eTelefono = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));

/**
 * opz: { renderer, scene, camera, controls?, raggio (mm, ombre di contatto),
 *        intensita (0..1), prima?() (prima di ogni disegno) }
 * Ritorna { disegna(), cambiato(), tick(), dimensiona(), foto(lato), dispose() }.
 */
/**
 * PROFONDITÀ PRECISA: il punto dove la telecamera comincia a vedere (near) segue la distanza da
 * quello che si guarda (3%, fra 1 e 15 cm). Fisso a 1 cm, con la vista a 3–5 m la scheda grafica
 * (soprattutto sul telefono) confondeva i due triangoli di ogni pannello e le ombre di contatto
 * disegnavano triangoli chiari e scuri sui fondi degli armadi. Avvicinandosi molto scende a 1 cm.
 */
export function nearSegueLaVista(camera, controls) {
  const regola = () => {
    const d = camera.position.distanceTo(controls.target);
    const n = Math.min(150, Math.max(10, d * 0.03));
    if (Math.abs(camera.near - n) > 0.5) { camera.near = n; camera.updateProjectionMatrix(); }
  };
  controls.addEventListener('change', regola);
  regola();
  return regola;
}
/**
 * Vetro trasparente davanti allo SFONDO: three.js (r161), per sapere cosa c'è dietro al vetro,
 * ridisegna la scena in un'immagine a parte e prima la pulisce con il colore di pulizia, ma nei
 * valori dello schermo invece che in quelli «di calcolo»: lo sfondo grigio visto attraverso una
 * sfera di vetro usciva quasi bianco. Qui, solo durante il disegno della scena, quella pulizia
 * usa il colore dello sfondo nei valori giusti.
 */
function vetroSulloSfondo(renderer) {
  if (renderer._ngPulisci) return;
  const pulisci = renderer.clear;
  renderer._ngPulisci = pulisci;
  renderer._ngSfondo = null;
  renderer.clear = function (...a) {
    const sf = this._ngSfondo, rt = sf ? this.getRenderTarget() : null;
    // solo l'immagine «dietro il vetro» (con le mipmap); NON le mappe delle ombre (vanno pulite in bianco)
    if (rt && rt.texture && rt.texture.generateMipmaps && rt.texture.minFilter === THREE.LinearMipmapLinearFilter &&
        !/shadowMap$/.test(rt.texture.name || '')) this.setClearColor(sf, 1);   // ora converte nei valori di calcolo
    return pulisci.apply(this, a);
  };
}

export function creaResa(opz) {
  const { renderer, scene, camera } = opz;
  vetroSulloSfondo(renderer);
  const tel = eTelefono();
  const DPR = window.devicePixelRatio || 1;
  // Nitidezza: sempre quella piena di prima mentre si gira.
  const DPR_MOTO = Math.min(DPR, tel ? 1.25 : 1.5);          // mentre si gira
  // Da fermo: telefono a tutti i suoi pixel; COMPUTER al doppio dei pixel dello
  // schermo, poi rimpicciolito come una foto: bordi e ombre negli angoli puliti,
  // niente linee zigrinate (le ombre di contatto da sole non sono levigate).
  // QUALITÀ DA FERMO SU MISURA DEL COMPUTER: il disegno nitido (da fermo) si misura da solo.
  // Se su questo computer è lento (portatile, scheda grafica integrata) scende di un gradino
  // (meno pixel, ombre di contatto più leggere) e se lo ricorda; se è velocissimo risale.
  // Scheda grafica potente = qualità piena come prima.
  const LIVELLI = [{ pix: 8e6, ao: 32 }, { pix: 4.5e6, ao: 24 }, { pix: 2.6e6, ao: 16 }, { pix: 0, ao: 12 }];
  let livello = 0;
  if (!tel) { try { livello = Math.min(LIVELLI.length - 1, Math.max(0, Number(localStorage.getItem('ng-3d-livello-fermo')) || 0)); } catch (_) { /* niente */ } }
  const areaCss = () => { const el = renderer.domElement; return Math.max(1, (el.clientWidth || el.width) * (el.clientHeight || el.height)); };
  // telefono da fermo: al massimo 2× (a 3× erano 9 volte i pixel di prima, con le ombre di contatto:
  // su iPhone il disegno nitido bloccava il dito per un attimo a ogni pausa)
  const dprFermo = () => tel ? Math.min(DPR, 2)
    : Math.max(Math.min(DPR, 1.5), Math.min(2, Math.sqrt(LIVELLI[livello].pix / areaCss())));
  try { localStorage.removeItem('ng-3d-fluidita'); } catch (_) { /* niente */ }
  // COMPUTER, mentre si gira la vista: l'immagine resta SEMPRE nitida come
  // prima. Se la scheda grafica non sta al passo (lo misura da sola, e se lo
  // ricorda), alleggerisce solo le ombre di contatto, la parte più pesante:
  // metà dei campioni per pixel (a occhio, mentre si muove, non cambia niente).
  // Da fermo: tutto a piena qualità. Il telefono resta com'è.
  let aoLeggera = false;
  if (!tel) { try { aoLeggera = localStorage.getItem('ng-3d-ao-leggera') === '1'; } catch (_) { /* niente */ } }
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
    // computer, disegno da fermo (una volta sola): più campioni, ombre di contatto più lisce
    if (!tel) campioniFermo();
    quad = new FullScreenQuad(ao.blendMaterial);
    // ombre di contatto del MOVIMENTO con le loro memorie (anche sul telefono): prima, sul telefono,
    // a ogni pausa/ripresa si rifacevano le memorie grandi delle ombre (a scatti, pesante)
    aoMoto = nuovoAO(s.x, s.y);
    campioniMoto();
  } catch (e) { console.warn('Ombre di contatto non disponibili', e); ao = null; aoMoto = null; }

  let sporco = true, ultimoMoto = 0, nitido = false;
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
    // le ombre di contatto si adattano da sole al primo disegno (disegna)
  }

  function campioniFermo() {
    if (!ao || tel) return;
    const n = LIVELLI[livello].ao;
    ao.updateGtaoMaterial({ samples: n }); ao.updatePdMaterial({ samples: n, rings: n >= 24 ? 4 : 3 });
  }
  /** Ombre di contatto del movimento: 16 campioni per pixel, o 8 se la scheda grafica è lenta. */
  function campioniMoto() {
    if (!aoMoto) return;
    const n = aoLeggera || tel ? 8 : 16;                       // telefono: leggero mentre si gira
    aoMoto.updateGtaoMaterial({ samples: n });
    aoMoto.updatePdMaterial({ samples: n });
  }

  /** Disegna adesso: scena + ombre di contatto sopra (leggero = mentre si gira). */
  function disegna(leggero = false) {
    if (opz.prima) opz.prima();
    // il vetro trasparente (sfere, bicchieri) «vede» dietro di sé solo un'immagine della scena fatta
    // senza lo sfondo: dove dietro c'è lo sfondo, la riempie col colore di pulizia (bianco se non
    // detto). Con il colore dello sfondo, il vetro davanti allo sfondo resta trasparente.
    const sfondo = scene.background && scene.background.isColor ? scene.background : null;
    if (sfondo) renderer.setClearColor(sfondo, 1);
    renderer.setRenderTarget(null);
    renderer._ngSfondo = sfondo;
    try { renderer.render(scene, camera); } finally { renderer._ngSfondo = null; }
    if (!ao || guasto || opz.senzaAO?.()) return;
    try {
      const s = renderer.getDrawingBufferSize(_s);
      const a = (leggero && aoMoto) ? aoMoto : ao;
      if (a.width !== s.x || a.height !== s.y) a.setSize(s.x, s.y);
      // le cose «di luce» (aloni delle lampade: un quadrato piatto con la luce al centro) NON entrano
      // nelle ombre di contatto: le leggevano come un pannello solido e disegnavano un quadrato
      const fuori = (opz.fuoriAO && opz.fuoriAO()) || [], erano = fuori.map((o) => o.visible);
      for (const o of fuori) o.visible = false;
      try { a.render(renderer, null, null); }                  // normali + AO + pulizia
      finally { fuori.forEach((o, i) => { o.visible = erano[i]; }); }
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

  // Quanto si è mossa la vista, in pixel dello schermo. La vista "scivola" ancora
  // per qualche secondo di frazioni di pixel dopo che la lasci: quello non conta
  // come movimento, così torna nitida subito.
  const posPrec = new THREE.Vector3(), quatPrec = new THREE.Quaternion();
  const posDis = new THREE.Vector3(), quatDis = new THREE.Quaternion();
  let primo = true, motoPrec = false;
  function scarto(p, q) {
    const el = renderer.domElement;
    const pxAng = THREE.MathUtils.degToRad(camera.fov || 50) / Math.max(1, el.clientHeight || el.height);
    const dist = Math.max(500, camera.position.length());
    const ang = 2 * Math.acos(Math.min(1, Math.abs(q.dot(camera.quaternion))));
    return (ang + p.distanceTo(camera.position) / dist) / pxAng;
  }
  // misura del disegno nitido (da fermo, computer): quanto ci mette davvero la scheda grafica
  const _px = new Uint8Array(4);
  let veloci = 0;
  function misuraFermo(dt) {
    let nuovo = livello;
    if (dt > 170 && livello < LIVELLI.length - 1) { nuovo = livello + 1; veloci = 0; }
    else if (dt < 45 && livello > 0) { if (++veloci >= 3) { nuovo = livello - 1; veloci = 0; } }
    else veloci = 0;
    if (nuovo === livello) return;
    livello = nuovo; campioniFermo();
    try { localStorage.setItem('ng-3d-livello-fermo', String(livello)); } catch (_) { /* niente */ }
    if (nitido) { dimensiona(dprFermo()); sporco = true; }                 // il prossimo disegno nitido è più leggero
  }
  function disegnaOra(leggero) {
    if (!leggero && !tel) {
      const t0 = performance.now();
      disegna(false);
      try { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px); } catch (_) { /* niente */ }
      misuraFermo(performance.now() - t0);
    } else disegna(leggero);
    sporco = false;
    posDis.copy(camera.position); quatDis.copy(camera.quaternion);
  }

  // Computer: quanto dura un fotogramma mentre si gira (tra due fotogrammi
  // disegnati di seguito). Lento due volte di fila → ombre di contatto leggere
  // mentre si gira; molto veloce → di nuovo piene. La nitidezza non cambia mai.
  let tPrec = 0, nMoto = 0, lenti = 0;
  const campioni = [];
  function misura(ora, consecutivo) {
    const dt = ora - tPrec; tPrec = ora;
    if (!aoMoto || !consecutivo || tel) return;
    if (++nMoto < 20) return;                                  // i primi fotogrammi (preparazione) non contano
    campioni.push(dt);
    if (campioni.length < 12) return;
    campioni.sort((x, y) => x - y);
    const med = campioni[6]; campioni.length = 0;
    let nuova = aoLeggera;
    if (!aoLeggera) { lenti = med > 26 ? lenti + 1 : 0; if (lenti >= 2) nuova = true; }   // sotto i ~38 fotogrammi al secondo
    else if (med < 10) nuova = false;                                                    // scheda grafica molto veloce
    if (nuova === aoLeggera) return;
    aoLeggera = nuova; lenti = 0; campioniMoto();
    try { localStorage.setItem('ng-3d-ao-leggera', nuova ? '1' : '0'); } catch (_) { /* niente */ }
  }

  /**
   * Da chiamare a ogni frame (requestAnimationFrame): disegna solo se serve.
   * moto = la vista si sta muovendo per altro (porte che si aprono, trascinamento).
   */
  function tick(moto = false) {
    const ora = performance.now();
    if (primo) { primo = false; posPrec.copy(camera.position); quatPrec.copy(camera.quaternion); }
    const passo = scarto(posPrec, quatPrec);
    posPrec.copy(camera.position); quatPrec.copy(camera.quaternion);
    if (moto || passo > 0.25) {
      ultimoMoto = ora;
      if (nitido) { dimensiona(DPR_MOTO); nitido = false; misura(ora, false); }
      else misura(ora, motoPrec);
      disegnaOra(true); motoPrec = true;
      return;
    }
    motoPrec = false;
    // ferma da un attimo → una volta a piena qualità (col dito ancora giù aspetta di più)
    if (!nitido && ora - ultimoMoto > (giu.size ? 700 : 160)) {
      dimensiona(dprFermo()); nitido = true; disegnaOra(false);
      return;
    }
    // da ferma: ridisegno se è cambiato qualcosa o se lo scivolamento si vede
    if (sporco || scarto(posDis, quatDis) > 0.75) disegnaOra(!nitido);
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
    disegna(false);
    const c = document.createElement('canvas'); c.width = s.x; c.height = s.y;
    c.getContext('2d').drawImage(el, 0, 0);
    renderer.setPixelRatio(prima); renderer.setSize(w, h, false);
    disegnaOra(!nitido);
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

  dimensiona(DPR_MOTO);
  return { disegna, cambiato, tick, dimensiona: () => dimensiona(nitido ? dprFermo() : DPR_MOTO), foto, dispose };
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
  // il colore va scritto come si vede (sRGB): r/g/b di THREE.Color sono lineari e davano un gres quasi nero
  const hex = (cc) => '#' + cc.getHexString();
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
// -----------------------------------------------------------------------------
// PAVIMENTI A SCELTA (progetto.pavimento): legni, marmi, pietre, gres. Foto di materiali veri
// (ambientCG, CC0 — vedi materials/pavimenti/LEGGIMI.txt) alla MISURA VERA: i listoni e le spine
// sono la foto ripetuta; le LASTRE (marmo, travertino, terrazzo, cemento, scacchiera) le compone il
// programma: ogni lastra un pezzo diverso della pietra, girato a caso, con le fughe.
// Senza scelta resta il pavimento di prima (parquet con lo sfondo chiaro, gres con gli altri).
// -----------------------------------------------------------------------------
export { PAVIMENTI, GRUPPI_PAVIMENTI };
const _immaginiPav = {};
function immaginePav(nome) {
  if (!_immaginiPav[nome]) _immaginiPav[nome] = new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = `materials/pavimenti/${nome}.jpg`; });
  return _immaginiPav[nome];
}
/** LASTRE (o scacchiera): ogni lastra un pezzo diverso della foto (che si ripete senza giunte), girato
 *  a caso, un filo più chiara o più scura, con la fuga. La tela copre almeno 2 × 2 lastre (~2,4 m). */
function telaLastre(p, imgs) {
  const [lw, lh] = p.lastra;
  const nx = Math.max(2, Math.round(2400 / lw)), ny = Math.max(2, Math.round(2400 / lh));
  const MMx = nx * lw, MMy = ny * lh, S = 2048, k = S / Math.max(MMx, MMy);
  const c = document.createElement('canvas'); c.width = Math.round(MMx * k); c.height = Math.round(MMy * k);
  const g = c.getContext('2d'), r = rnd(23 + p.id.length);
  const motivi = imgs.map((im) => g.createPattern(im, 'repeat'));
  const scala = imgs.map((im) => (p.mm * k) / im.width);          // la foto copre p.mm millimetri
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = p.tipo === 'scacchi' ? (i + j) % 2 : 0, im = imgs[q];
    const x = i * lw * k, y = j * lh * k, w = lw * k, h = lh * k;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.translate(x + w / 2, y + h / 2); if (r() < 0.5) g.rotate(Math.PI);
    g.translate(-w / 2 - r() * im.width * scala[q], -h / 2 - r() * im.height * scala[q]);
    g.scale(scala[q], scala[q]); g.fillStyle = motivi[q];
    g.fillRect(0, 0, (w + im.width * scala[q] * 2) / scala[q], (h + im.height * scala[q] * 2) / scala[q]);
    g.restore();
    const t = r();
    g.fillStyle = t < 0.5 ? `rgba(0,0,0,${0.015 + r() * 0.04})` : `rgba(255,255,255,${0.015 + r() * 0.04})`;
    g.fillRect(x, y, w, h);
  }
  // fughe (2 mm, almeno 1 px), sui bordi della tela metà per lato: ripetuta torna intera
  const f = Math.max(1, 2 * k);
  g.fillStyle = p.fuga;
  for (let i = 0; i <= nx; i++) g.fillRect(i * lw * k - f / 2, 0, f, c.height);
  for (let j = 0; j <= ny; j++) g.fillRect(0, j * lh * k - f / 2, c.width, f);
  return { c, mmX: MMx, mmY: MMy };
}
const _pavScelti = {};
/** La TELA (canvas o immagine) di un pavimento e i millimetri che copre: { c, mmX, mmY } (promessa). */
export async function telaPavimento(id) {
  const p = PAVIMENTI.find((x) => x.id === id);
  if (!p) return null;
  if (!_pavScelti[id]) {
    _pavScelti[id] = (async () => {
      if (p.tipo === 'foto') { const im = await immaginePav(p.img); return { c: im, mmX: p.mm, mmY: p.mm * im.height / im.width }; }
      if (p.tipo === 'lastre' || p.tipo === 'scacchi') { const imgs = await Promise.all([].concat(p.img).map(immaginePav)); return telaLastre(p, imgs); }
      if (p.tipo === 'parquet') { const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = 'materials/r3-supra-oak.jpg'; }); const t = telaParquet(im); return { c: t.c, mmX: t.mm, mmY: t.mm }; }
      const t = telaGres(p.colore); return { c: t.c, mmX: t.mm, mmY: t.mm };
    })();
  }
  return _pavScelti[id];
}
const _texPav = {};
/** Materiale di un pavimento scelto, per un piano w × d mm. quandoPronto() quando la foto arriva. */
export function materialePavimento(id, w, d, quandoPronto) {
  const p = PAVIMENTI.find((x) => x.id === id) || PAVIMENTI[0];
  const m = new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: p.rough, metalness: 0, envMapIntensity: p.env });
  telaPavimento(p.id).then((t) => {
    if (!_texPav[p.id]) {
      const tex = t.c instanceof HTMLImageElement ? new THREE.Texture(t.c) : new THREE.CanvasTexture(t.c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 16; tex.needsUpdate = true;
      _texPav[p.id] = tex;
    }
    // la STESSA texture (un pavimento per scena): una copia con needsUpdate la rimandava tutta
    // alla scheda grafica a ogni ricostruzione della scena (2048 × 2048: pesante sul telefono)
    const tx = _texPav[p.id];
    tx.repeat.set(w / t.mmX, d / t.mmY);
    m.map = tx; m.color.setScalar(p.tono || 1); m.needsUpdate = true;
    if (quandoPronto) quandoPronto();
  }).catch(() => { /* foto non arrivata: resta il colore */ });
  return m;
}

export function pavimentoVero(sfondo, colore, w, d, quandoPronto, scelto = null) {
  if (scelto && PAVIMENTI.some((x) => x.id === scelto)) return materialePavimento(scelto, w, d, quandoPronto);
  const parquet = sfondo === 'chiaro';
  const m = new THREE.MeshStandardMaterial({ color: parquet ? 0xb89a76 : colore, roughness: parquet ? 0.62 : 0.5, metalness: 0, envMapIntensity: 0.45 });
  const applica = (p) => {
    const t = p.tex;                                   // la stessa texture: niente nuovo invio alla scheda grafica
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
