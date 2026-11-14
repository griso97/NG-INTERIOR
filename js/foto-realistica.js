// =============================================================================
// FOTO REALISTICA — la scena calcolata come una FOTOGRAFIA vera
// =============================================================================
// La vista 3D normale è veloce ma "da computer". Qui la stessa scena viene
// calcolata come fa una macchina fotografica: la luce entra da una finestra,
// rimbalza su muri, pavimento e mobili (luce indiretta), le ombre sono
// morbide, i riflessi veri, il legno ha il suo rilievo. Si usa
// three-gpu-pathtracer (MIT), che gira nella scheda grafica del dispositivo:
// niente server, niente costi, nessun dato del cliente esce dal dispositivo.
//
// Il "rumore" tipico di questi calcoli lo toglie una rete neurale
// (Intel Open Image Denoise, tramite oidn-web) che gira anch'essa nel
// dispositivo (WebGPU). Senza WebGPU si usano più passaggi e un filtro classico.
//
// Solo per la foto (alla fine tutto torna com'era):
//  - una STANZA vera: muri pieni (quelli che la camera guarda dall'interno),
//    soffitto, pavimento in PARQUET;
//  - una FINESTRA con il suo telaio: la luce del giorno entra di lato;
//  - i LED sotto i pensili diventano luci vere;
//  - vetri veri (trasparenti, satinati, fumé), display accesi;
//  - legno con rilievo della venatura e lucentezza variabile, ogni pezzo
//    tagliato da un punto diverso del pannello;
//  - verticali dritte (come le foto d'architettura) ed esposizione automatica;
//  - spariscono linee di contorno, evidenziazioni e muri trasparenti.
// =============================================================================
import * as THREE from 'three';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const MM = 0.001;                              // la scena è in mm: la foto si calcola in metri
const URL_OIDN = new URL('../vendor/oidn-web/oidn.js', import.meta.url).href;
const URL_PESI = new URL('../vendor/oidn-web/rt_hdr_alb_nrm.tza', import.meta.url).href;

// ---------------------------------------------------------------------------
// PULIZIA IA (OIDN su WebGPU): caricata una volta sola, solo quando serve.
// ---------------------------------------------------------------------------
let _gpuOk = null;
/** true se il dispositivo può usare la pulizia IA (WebGPU disponibile). */
export async function puliziaIADisponibile() {
  if (_gpuOk !== null) return _gpuOk;
  try {
    const a = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
    _gpuOk = !!a;
  } catch (_) { _gpuOk = false; }
  return _gpuOk;
}
let _unet = null;
function caricaUNet() {
  if (!_unet) {
    _unet = (async () => {
      if (!(await puliziaIADisponibile())) return null;
      const { initUNetFromURL } = await import(URL_OIDN);
      return await initUNetFromURL(URL_PESI, undefined, { aux: true, hdr: true, maxTileSize: 512 });
    })().catch((e) => { console.warn('Pulizia IA non disponibile:', e); _unet = null; return null; });
  }
  return _unet;
}
function pulisciIA(unet, colore, albedo, normale, W, H, onFase) {
  return new Promise((ok, ko) => {
    try {
      unet.tileExecute({
        color: { data: colore, width: W, height: H },
        albedo: { data: albedo, width: W, height: H },
        normal: { data: normale, width: W, height: H },
        done: (out) => ok(out.data),
        error: (e) => ko(e),
        progress: (_o, _t, _tile, i, n) => { if (onFase) onFase((i + 1) / Math.max(1, n)); },
      });
    } catch (e) { ko(e); }
  });
}

// ---------------------------------------------------------------------------
// PARQUET: assi di rovere sfalsate, ognuna presa da un punto diverso della
// foto del legno, con piccole differenze di tono e la fuga scura tra le assi.
// ---------------------------------------------------------------------------
let _parquet = null;
function caricaImg(url) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; }); }
async function texParquet() {
  if (_parquet) return _parquet;
  const legno = await caricaImg('materials/r3-supra-oak.jpg').catch(() => null);
  const S = 2048, MMTILE = 2400;               // la tessera = 2,4 × 2,4 m
  const k = S / MMTILE, aw = 200, al = 1200;   // asse 20 × 120 cm (12 file esatte nella tessera)
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#b89a76'; g.fillRect(0, 0, S, S);
  let seme = 7; const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  // striscia lunga di legno (la foto ripetuta in verticale, a specchio): la
  // venatura corre LUNGO l'asse, come nel parquet vero
  let striscia = null;
  if (legno) {
    striscia = document.createElement('canvas'); striscia.width = legno.width; striscia.height = legno.height * 4;
    const gs = striscia.getContext('2d');
    for (let i = 0; i < 4; i++) {
      gs.save();
      if (i % 2) { gs.translate(0, legno.height * (i + 1)); gs.scale(1, -1); gs.drawImage(legno, 0, 0); }
      else gs.drawImage(legno, 0, legno.height * i);
      gs.restore();
    }
  }
  const pxMm = legno ? legno.width / 600 : 1;     // la foto del rovere ≈ 60 cm di pannello
  for (let col = 0; col * aw < MMTILE; col++) {
    const sfasa = (col % 3) * al / 3 + (col % 2) * 170;
    for (let r = -1; r * al < MMTILE + al; r++) {
      const x = col * aw * k, y = (r * al + sfasa) * k, w = aw * k, h = al * k;
      if (striscia) {
        // ogni asse presa da un punto diverso della striscia (e a volte girata)
        const sc = 0.85 + rnd() * 0.35;
        const sw = Math.min(striscia.width, aw * pxMm * sc), sh = Math.min(striscia.height, al * pxMm * sc);
        const sx = rnd() * (striscia.width - sw), sy = rnd() * (striscia.height - sh);
        g.save();
        if (rnd() < 0.5) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(striscia, sx, sy, sw, sh, 0, 0, w, h); }
        else g.drawImage(striscia, sx, sy, sw, sh, x, y, w, h);
        g.restore();
      }
      // tono diverso per ogni asse
      const t = rnd();
      g.fillStyle = t < 0.5 ? `rgba(60,40,20,${0.04 + rnd() * 0.1})` : `rgba(255,240,220,${0.03 + rnd() * 0.08})`;
      g.fillRect(x, y, w, h);
      // fughe tra le assi (lati lunghi più marcati, teste più sottili)
      g.fillStyle = 'rgba(40,28,18,0.5)';
      g.fillRect(x, y, 1.6, h);
      g.fillStyle = 'rgba(40,28,18,0.38)';
      g.fillRect(x, y, w, 1.2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  _parquet = { tex, mmTile: MMTILE };
  return _parquet;
}

// ---------------------------------------------------------------------------
// LEGNO VERO: dalla foto del legno ricavo il RILIEVO della venatura (normal map)
// e la LUCENTEZZA che cambia tra fibra e poro (roughness map): con la luce
// radente il pannello si legge come legno, non come una foto stampata.
// ---------------------------------------------------------------------------
const _mappe = new Map(), _mappeTex = new Map();
function mappeDaFoto(tex, forzaRilievo = 1) {
  const img = tex && tex.image;
  if (!img || !(img.width > 16) || !(img.height > 16)) return null;
  const chiaveTex = tex.uuid + ':' + forzaRilievo;
  if (_mappeTex.has(chiaveTex)) return _mappeTex.get(chiaveTex);
  const tele = teleMappe(tex, forzaRilievo);
  let out = null;
  if (tele) {
    const crea = (base) => {
      const t = base.clone();                    // stessa tela (una sola copia in memoria)
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.offset.copy(tex.offset);
      t.rotation = tex.rotation; t.center.copy(tex.center); t.anisotropy = 4;
      if (!tex.matrixAutoUpdate) { t.matrixAutoUpdate = false; t.matrix.copy(tex.matrix); } else t.matrixAutoUpdate = true;
      return t;
    };
    out = { normale: crea(tele.normale), ruvido: crea(tele.ruvido) };
  }
  _mappeTex.set(chiaveTex, out);
  return out;
}
function teleMappe(tex, forzaRilievo) {
  const img = tex.image;
  const chiave = tex.source.uuid + ':' + forzaRilievo;
  if (_mappe.has(chiave)) return _mappe.get(chiave);
  const k = Math.min(1, 1024 / Math.max(img.width, img.height));
  const w = Math.max(16, Math.round(img.width * k)), h = Math.max(16, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  let d;
  try { g.drawImage(img, 0, 0, w, h); d = g.getImageData(0, 0, w, h).data; } catch (_) { _mappe.set(chiave, null); return null; }
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  // tolgo le variazioni larghe di tono (resta solo la grana)
  const sfoc = new Float32Array(w * h), R = 6;
  for (let y = 0; y < h; y++) { let acc = 0; for (let x = -R; x <= R; x++) acc += L[y * w + ((x + w) % w)]; for (let x = 0; x < w; x++) { sfoc[y * w + x] = acc / (2 * R + 1); acc += L[y * w + ((x + R + 1) % w)] - L[y * w + ((x - R + w) % w)]; } }
  const sfoc2 = new Float32Array(w * h);
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -R; y <= R; y++) acc += sfoc[((y + h) % h) * w + x]; for (let y = 0; y < h; y++) { sfoc2[y * w + x] = acc / (2 * R + 1); acc += sfoc[((y + R + 1) % h) * w + x] - sfoc[((y - R + h) % h) * w + x]; } }
  const grana = new Float32Array(w * h);
  let media = 0; for (let i = 0; i < w * h; i++) { grana[i] = L[i] - sfoc2[i]; media += Math.abs(grana[i]); }
  media = media / (w * h) || 0.01;
  const nC = document.createElement('canvas'); nC.width = w; nC.height = h;
  const rC = document.createElement('canvas'); rC.width = w; rC.height = h;
  const nI = nC.getContext('2d').createImageData(w, h), rI = rC.getContext('2d').createImageData(w, h);
  const forza = 0.9 * forzaRilievo / Math.max(0.02, media * 6);
  const at = (x, y) => grana[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const dx = (at(x + 1, y) - at(x - 1, y)) * forza, dy = (at(x, y + 1) - at(x, y - 1)) * forza;
    const inv = 1 / Math.hypot(dx, dy, 1);
    nI.data[i * 4] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
    nI.data[i * 4 + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
    nI.data[i * 4 + 2] = Math.round((inv * 0.5 + 0.5) * 255);
    nI.data[i * 4 + 3] = 255;
    // pori (più scuri) un po' più opachi, fibra un po' più lucida
    const r = Math.max(0.25, Math.min(0.95, 0.56 - grana[i] / media * 0.06));
    rI.data[i * 4] = rI.data[i * 4 + 1] = rI.data[i * 4 + 2] = Math.round(r * 255); rI.data[i * 4 + 3] = 255;
  }
  nC.getContext('2d').putImageData(nI, 0, 0); rC.getContext('2d').putImageData(rI, 0, 0);
  const out = { normale: new THREE.CanvasTexture(nC), ruvido: new THREE.CanvasTexture(rC) };
  _mappe.set(chiave, out);
  return out;
}
const ripetuta = (t) => t && (t.wrapS === THREE.RepeatWrapping || t.wrapS === THREE.MirroredRepeatWrapping);

// ---------------------------------------------------------------------------
// VENATURA SENZA RIPETIZIONI: le foto dei legni sono piccole (512 px) e il
// disegno si ripete identico sull'anta e su quelle vicine. Per la foto il
// legno viene RICOMPOSTO in un pannello 2×2 volte più grande fatto di "fogli"
// di venatura presi da punti diversi della foto e uniti con giunte morbide,
// come i pannelli veri. Solo per i legni (venatura con una direzione): pietre,
// cementi e tinte restano come sono. Stessa scala, stessa risoluzione.
// ---------------------------------------------------------------------------
const _sintetiche = new Map();
const LATO_SINTESI = 1024;
function direzioneVenatura(img) {
  const w = 128, h = 128;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(img, 0, 0, w, h); } catch (_) { return null; }
  const d = g.getImageData(0, 0, w, h).data;
  const L = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
  let gx = 0, gy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { gx += Math.abs(L(x + 1, y) - L(x - 1, y)); gy += Math.abs(L(x, y + 1) - L(x, y - 1)); }
  if (gx > gy * 1.45) return 'verticale';        // le righe della venatura vanno su e giù
  if (gy > gx * 1.45) return 'orizzontale';
  return null;                                   // pietra, cemento, tinta: niente fogli
}
const _sintTex = new Map();
function texturaSintetica(tex) {
  const img = tex && tex.image;
  if (!img || !(img.width >= 64) || !(img.height >= 64)) return null;
  if (_sintTex.has(tex.uuid)) return _sintTex.get(tex.uuid);
  const base = telaSintetica(tex);
  let t = null;
  if (base) {
    // la stessa tela per tutte le texture di quella foto; la scala/rotazione è di ognuna
    t = base.tex.clone();
    t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    if (tex.matrixAutoUpdate) tex.updateMatrix();
    t.matrixAutoUpdate = false;
    t.matrix.copy(tex.matrix).premultiply(new THREE.Matrix3().makeScale(1 / base.kx, 1 / base.ky));
  }
  _sintTex.set(tex.uuid, t);
  return t;
}
function telaSintetica(tex) {
  const img = tex.image;
  const chiave = tex.source.uuid;
  if (_sintetiche.has(chiave)) return _sintetiche.get(chiave);
  let fatto = null;
  // il pannello deve contenere un numero intero di foto (così si ripete senza giunte)
  const kx = LATO_SINTESI / img.width, ky = LATO_SINTESI / img.height;
  const intero = Number.isInteger(kx) && Number.isInteger(ky) && kx >= 2 && ky >= 2;
  const dir = intero ? direzioneVenatura(img) : null;
  if (dir) {
    const S = LATO_SINTESI, ver = dir === 'verticale';
    // lavoro sempre "a colonne": per la venatura orizzontale ruoto la foto
    const src = document.createElement('canvas');
    src.width = ver ? img.width : img.height; src.height = ver ? img.height : img.width;
    const gs = src.getContext('2d');
    if (ver) gs.drawImage(img, 0, 0); else { gs.translate(src.width, 0); gs.rotate(Math.PI / 2); gs.drawImage(img, 0, 0); }
    const sw = src.width, sh0 = src.height, sov = Math.max(10, Math.round(sw * 0.035));   // giunta morbida
    // 1) foto resa continua in verticale: le ultime righe sfumano nelle prime
    //    (niente "gradino" di tono dove la foto ricomincia, niente specchi)
    const ovS = Math.max(16, Math.round(sh0 * 0.12)), sh = sh0 - ovS;
    const srcV = document.createElement('canvas'); srcV.width = sw; srcV.height = sh;
    const gv = srcV.getContext('2d');
    gv.drawImage(src, 0, 0, sw, sh, 0, 0, sw, sh);
    const banda = document.createElement('canvas'); banda.width = sw; banda.height = ovS;
    const gb = banda.getContext('2d');
    gb.drawImage(src, 0, sh, sw, ovS, 0, 0, sw, ovS);
    gb.globalCompositeOperation = 'destination-in';
    const grb = gb.createLinearGradient(0, 0, 0, ovS);
    grb.addColorStop(0, 'rgba(0,0,0,1)'); grb.addColorStop(1, 'rgba(0,0,0,0)');
    gb.fillStyle = grb; gb.fillRect(0, 0, sw, ovS);
    gv.drawImage(banda, 0, 0);
    let seme = (chiave.charCodeAt(0) * 7919 + chiave.charCodeAt(5) * 104729) % 2147483647 || 1;
    const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    // 2) fogli verticali presi da punti diversi, su una tela un po' più grande
    //    (a destra e in basso avanza un pezzo che poi sfuma sull'inizio)
    const ovV = Math.max(16, Math.round(S * 0.04)), HT = S + ovV;
    const comp = document.createElement('canvas'); comp.width = S + sov; comp.height = HT;
    const gc = comp.getContext('2d');
    const col = document.createElement('canvas'); col.height = HT;
    let x = 0;
    while (x < S) {
      const cw = Math.round(sw * (0.18 + rnd() * 0.24));          // foglio largo 18–42% della foto
      const w = Math.min(cw + sov, S + sov - x);
      col.width = w;
      const g = col.getContext('2d');
      const sx = Math.floor(rnd() * sw), sy = Math.floor(rnd() * sh);
      for (let yy = -sy; yy < HT; yy += sh) {
        g.drawImage(srcV, sx, 0, Math.min(w, sw - sx), sh, 0, yy, Math.min(w, sw - sx), sh);
        if (sw - sx < w) g.drawImage(srcV, 0, 0, w - (sw - sx), sh, sw - sx, yy, w - (sw - sx), sh);
      }
      // ogni foglio con un tono appena diverso (come i fogli veri)
      const t = (rnd() - 0.5) * 0.06;
      g.fillStyle = t < 0 ? `rgba(0,0,0,${-t})` : `rgba(255,255,255,${t})`;
      g.fillRect(0, 0, w, HT);
      // giunta morbida a sinistra (tranne il primo foglio): UNA sola maschera
      // (destination-in cancella tutto ciò che sta fuori dal disegno)
      if (x > 0) {
        g.globalCompositeOperation = 'destination-in';
        const gr = g.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(Math.min(1, sov / w), 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(0, 0, w, HT);
      }
      gc.drawImage(col, x === 0 ? 0 : x - sov, 0);
      x += cw;
    }
    // 3) ripetibile: il pezzo in più a destra sfuma sull'inizio, poi quello in basso
    const piega = (sorg, larg, alt, oriz) => {
      const out = document.createElement('canvas');
      out.width = oriz ? larg : sorg.width; out.height = oriz ? sorg.height : alt;
      const go = out.getContext('2d');
      go.drawImage(sorg, 0, 0);
      const n = oriz ? sorg.width - larg : sorg.height - alt;
      const coda = document.createElement('canvas'); coda.width = oriz ? n : out.width; coda.height = oriz ? out.height : n;
      const gq = coda.getContext('2d');
      if (oriz) gq.drawImage(sorg, larg, 0, n, out.height, 0, 0, n, out.height);
      else gq.drawImage(sorg, 0, alt, out.width, n, 0, 0, out.width, n);
      gq.globalCompositeOperation = 'destination-in';
      const gr = oriz ? gq.createLinearGradient(0, 0, n, 0) : gq.createLinearGradient(0, 0, 0, n);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      gq.fillStyle = gr; gq.fillRect(0, 0, coda.width, coda.height);
      go.drawImage(coda, 0, 0);
      return out;
    };
    const fin = piega(piega(comp, S, HT, true), S, S, false);
    // venatura orizzontale: rimetto il pannello nel verso giusto
    let out = fin;
    if (!ver) {
      out = document.createElement('canvas'); out.width = S; out.height = S;
      const go = out.getContext('2d'); go.translate(0, S); go.rotate(-Math.PI / 2); go.drawImage(fin, 0, 0);
    }
    const t = new THREE.CanvasTexture(out);
    t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 8;
    fatto = { tex: t, kx, ky };                    // il pannello nuovo copre kx × ky foto
  }
  _sintetiche.set(chiave, fatto);
  return fatto;
}
const luminanza = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Il materiale da usare nella foto al posto di m (null = va bene com'è). */
function materialeFoto(m) {
  const ud = m.userData || {};
  // Display, spie: accesi davvero
  if (ud.fotoLuce) {
    return new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: m.map ? 0xffffff : m.color, emissiveMap: m.map || null,
      emissiveIntensity: 1.6, roughness: 0.25, metalness: 0,
      transparent: m.transparent, opacity: m.opacity, alphaMap: m.alphaMap || null, side: m.side,
    });
  }
  // Materiali "piatti" (senza luce): diventano superfici normali
  if (m.isMeshBasicMaterial) {
    return new THREE.MeshStandardMaterial({
      color: m.color, map: m.map || null, transparent: m.transparent, opacity: m.opacity,
      alphaMap: m.alphaMap || null, alphaTest: m.alphaTest, side: m.side, roughness: 0.55, metalness: 0,
    });
  }
  if (!m.isMeshStandardMaterial) return null;
  // VETRI: trasparenza vera (con riflessi), satinato = vetro acidato, fumé = scuro
  const vetro = ud.vetro || (m.transparent && m.opacity < 0.97 && !m.map && m.roughness <= 0.3 && m.metalness < 0.5 ? 'trasparente' : null);
  if (vetro) {
    const tipo = vetro === 'satinato' ? 'satinato' : (vetro === 'fume' || luminanza(m.color) < 0.03) ? 'fume' : 'trasparente';
    const v = new THREE.MeshPhysicalMaterial({
      color: tipo === 'fume' ? new THREE.Color(0.1, 0.1, 0.105) : tipo === 'satinato' ? new THREE.Color(0.92, 0.94, 0.93) : new THREE.Color(0.93, 0.97, 0.95),
      transmission: 1, roughness: tipo === 'satinato' ? 0.4 : 0.02, metalness: 0, ior: 1.5,
      thickness: 0, side: THREE.DoubleSide,
    });
    v.userData.vetroFoto = true;
    return v;
  }
  let nuovo = null;
  const copia = () => { if (!nuovo) { nuovo = m.clone(); nuovo.userData = { ...m.userData }; } return nuovo; };
  // niente bagliori (evidenziazione del mobile selezionato)
  if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001 && m.emissiveIntensity > 0) copia().emissive = new THREE.Color(0, 0, 0);
  // METALLI (maniglie, acciaio, cromo, inox spazzolato): nella foto metallo pieno
  if (m.metalness >= 0.55 && m.metalness < 1) copia().metalness = 1;
  // TINTE OPACHE: anche l'opaco vero ha un velo di riflesso radente (non è gesso)
  if (!m.map && !m.transparent && m.metalness < 0.3 && m.roughness >= 0.85) copia().roughness = 0.62;
  // LEGNI e pietre (texture ripetute): rilievo + lucentezza dalla foto
  if (ripetuta(m.map) && m.metalness <= 0.5 && !m.transparent) {
    // legni senza misura del campione: venatura ricomposta senza ripetizioni
    const sint = !ud.campioneMm ? texturaSintetica(m.map) : null;
    if (sint) copia().map = sint;
    const mp = mappeDaFoto(sint || m.map);
    if (mp) {
      const n = copia();
      const rilievo = ud.fotoTop ? 0.08 : 0.35;                     // la pietra levigata quasi non ha rilievo
      n.normalMap = mp.normale; n.normalScale = new THREE.Vector2(rilievo, rilievo);
      n.roughnessMap = mp.ruvido;
      // roughness × mappa (media ~0,56): lucido resta lucido, opaco resta satinato;
      // il piano di lavoro è satinato (riflessi morbidi come le pietre e i compact veri)
      n.roughness = ud.fotoTop ? 0.34 / 0.56 : Math.min(1, Math.max(0.35, m.roughness) / 0.56 * (ud.ngSpec ? 0.6 : 1));
    }
  }
  return nuovo;
}

// ---------------------------------------------------------------------------
// SPIGOLI VERI: nella realtà nessun pannello ha lo spigolo "a coltello": il
// bordo è raggiato (≈1,5 mm) e prende la luce, una linea chiara sottile che
// fa capire subito che è un oggetto vero. Ogni scatola (BoxGeometry) della
// scena diventa per la foto una scatola con gli spigoli arrotondati, con le
// STESSE coordinate di texture su ogni faccia (venatura e foto al loro posto).
// ---------------------------------------------------------------------------
/** Per ogni faccia della scatola: come si passa dalla posizione alle UV (affine). */
function mappeUVFacce(geo) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, nor = geo.attributes.normal, idx = geo.index;
  if (!uv || !nor) return null;
  const mappe = [];
  for (const gr of geo.groups) {
    const vs = new Set();
    for (let k = gr.start; k < gr.start + gr.count; k++) vs.add(idx ? idx.getX(k) : k);
    const lista = [...vs];
    if (lista.length < 3) return null;
    const v0 = lista[0];
    const n = [Math.abs(nor.getX(v0)), Math.abs(nor.getY(v0)), Math.abs(nor.getZ(v0))];
    const asse = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    const i1 = asse === 0 ? 2 : 0, i2 = asse === 1 ? 2 : 1;
    // minimi quadrati: [c1 c2 1] · coeff = u (e v)
    let s11 = 0, s12 = 0, s1 = 0, s22 = 0, s2 = 0, sn = 0, su1 = 0, su2 = 0, su = 0, sv1 = 0, sv2 = 0, sv = 0;
    for (const i of lista) {
      const c = [pos.getX(i), pos.getY(i), pos.getZ(i)], a = c[i1], b = c[i2], U = uv.getX(i), V = uv.getY(i);
      s11 += a * a; s12 += a * b; s1 += a; s22 += b * b; s2 += b; sn += 1;
      su1 += a * U; su2 += b * U; su += U; sv1 += a * V; sv2 += b * V; sv += V;
    }
    const M = new THREE.Matrix3().set(s11, s12, s1, s12, s22, s2, s1, s2, sn);
    if (Math.abs(M.determinant()) < 1e-9) return null;
    M.invert();
    const cu = new THREE.Vector3(su1, su2, su).applyMatrix3(M), cv = new THREE.Vector3(sv1, sv2, sv).applyMatrix3(M);
    mappe[gr.materialIndex] = { i1, i2, cu, cv };
  }
  return mappe.length === 6 ? mappe : null;
}
/** Scatola w×h×d con spigoli di raggio r, gruppi (facce) e UV come l'originale. */
function scatolaArrotondata(geo, r, segmenti = 5) {
  const { width: w, height: h, depth: d } = geo.parameters;
  const mappe = mappeUVFacce(geo);
  if (!mappe) return null;
  const s = segmenti;                            // 5 = 2 segmenti per curva + la parte piana
  const g = new THREE.BoxGeometry(1, 1, 1, s, s, s).toNonIndexed();
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, hs = 0.5 / s;
  const n = new THREE.Vector3();
  for (const gr of g.groups) {
    const m = mappe[gr.materialIndex];
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      n.set(px - Math.sign(px) * hs, py - Math.sign(py) * hs, pz - Math.sign(pz) * hs).normalize();
      const c = [hx * Math.sign(px) + n.x * r, hy * Math.sign(py) + n.y * r, hz * Math.sign(pz) + n.z * r];
      pos.setXYZ(i, c[0], c[1], c[2]);
      nor.setXYZ(i, n.x, n.y, n.z);
      const a = c[m.i1], b = c[m.i2];
      uv.setXY(i, m.cu.x * a + m.cu.y * b + m.cu.z, m.cv.x * a + m.cv.y * b + m.cv.z);
    }
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
/** Trasformazione affine (4×4) che porta i punti A nei punti B (minimi quadrati). */
function affineDaPunti(A, B) {
  const N = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const e = N.elements;                            // colonna per colonna (simmetrica)
  const bx = [0, 0, 0, 0], by = [0, 0, 0, 0], bz = [0, 0, 0, 0];
  const passo = Math.max(1, Math.floor(A.count / 400));
  for (let i = 0; i < A.count; i += passo) {
    const a = [A.getX(i), A.getY(i), A.getZ(i), 1];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) e[c * 4 + r] += a[r] * a[c];
      bx[r] += a[r] * B.getX(i); by[r] += a[r] * B.getY(i); bz[r] += a[r] * B.getZ(i);
    }
  }
  if (Math.abs(N.determinant()) < 1e-6) return null;
  const inv = N.clone().invert(), ie = inv.elements;
  const sol = (b) => [0, 1, 2, 3].map((r) => ie[0 * 4 + r] * b[0] + ie[1 * 4 + r] * b[1] + ie[2 * 4 + r] * b[2] + ie[3 * 4 + r] * b[3]);
  const X = sol(bx), Y = sol(by), Z = sol(bz);
  return new THREE.Matrix4().set(X[0], X[1], X[2], X[3], Y[0], Y[1], Y[2], Y[3], Z[0], Z[1], Z[2], Z[3], 0, 0, 0, 1);
}
/** UV della nuova geometria presi dalla faccia della vecchia più vicina e con la stessa direzione. */
function trasferisciUV(vecchia, nuova) {
  const P = vecchia.attributes.position, U = vecchia.attributes.uv, I = vecchia.index;
  const nT = I ? I.count / 3 : P.count / 3;
  const tris = [];
  const v = (k) => (I ? I.getX(k) : k);
  for (let t = 0; t < nT; t++) {
    const i0 = v(t * 3), i1 = v(t * 3 + 1), i2 = v(t * 3 + 2);
    const tri = new THREE.Triangle(new THREE.Vector3().fromBufferAttribute(P, i0), new THREE.Vector3().fromBufferAttribute(P, i1), new THREE.Vector3().fromBufferAttribute(P, i2));
    if (tri.getArea() < 1e-6) continue;
    tris.push({ tri, n: tri.getNormal(new THREE.Vector3()), uv: [new THREE.Vector2().fromBufferAttribute(U, i0), new THREE.Vector2().fromBufferAttribute(U, i1), new THREE.Vector2().fromBufferAttribute(U, i2)] });
  }
  const NP = nuova.attributes.position, NN = nuova.attributes.normal, NU = nuova.attributes.uv;
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3(), best = new THREE.Vector3(), out = new THREE.Vector2();
  for (let i = 0; i < NP.count; i++) {
    p.fromBufferAttribute(NP, i); n.fromBufferAttribute(NN, i);
    let migliore = null, dMin = Infinity;
    for (const t of tris) {
      if (t.n.dot(n) < 0.3) continue;
      t.tri.closestPointToPoint(p, c);
      const d = c.distanceToSquared(p) - t.n.dot(n) * 1e-6;
      if (d < dMin) { dMin = d; migliore = t; best.copy(c); }
    }
    if (!migliore) continue;
    THREE.Triangle.getInterpolation(best, migliore.tri.a, migliore.tri.b, migliore.tri.c, migliore.uv[0], migliore.uv[1], migliore.uv[2], out);
    NU.setXY(i, out.x, out.y);
  }
  NU.needsUpdate = true;
}
/** Lastra estrusa (piano con i fori del lavello, pezzi sagomati) con il bordo raggiato. */
function estrusioneArrotondata(geo, r) {
  const prm = geo.parameters || {}, opt = prm.options || {};
  if (opt.bevelEnabled || !prm.shapes || !geo.attributes.uv) return null;
  const depth = opt.depth !== undefined ? opt.depth : 1;
  if (!(depth >= 3 * r)) return null;
  // la stessa estrusione senza bordo, per capire come era stata girata e spostata
  const pulita = new THREE.ExtrudeGeometry(prm.shapes, { ...opt, bevelEnabled: false });
  const ok = pulita.attributes.position.count === geo.attributes.position.count;
  const M = ok ? affineDaPunti(pulita.attributes.position, geo.attributes.position) : null;
  pulita.dispose();
  if (!M) return null;
  const nuova = new THREE.ExtrudeGeometry(prm.shapes, { ...opt, depth: depth - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: 2 });
  nuova.translate(0, 0, r);                        // stessa altezza di prima: da 0 a depth
  nuova.applyMatrix4(M);
  trasferisciUV(geo, nuova);
  nuova.computeBoundingBox(); nuova.computeBoundingSphere();
  return nuova;
}
function arrotondaSpigoli(radice, ripristina, segmenti = 5) {
  const fatte = new Map();                       // la stessa geometria condivisa si arrotonda una volta
  const nuove = [];
  radice.updateMatrixWorld(true);
  const scalaRadice = radice.getWorldScale(new THREE.Vector3());
  radice.traverse((o) => {
    if (!o.isMesh || !o.visible || (o.userData || {}).ledStriscia) return;
    const geo = o.geometry;
    const box = geo && geo.type === 'BoxGeometry' && geo.parameters;
    const estr = geo && geo.type === 'ExtrudeGeometry' && geo.parameters;
    if (!box && !estr) return;
    // solo pezzi non deformati (scala 1 rispetto alla scena): il raggio è in mm veri
    const sc = o.getWorldScale(new THREE.Vector3()).divide(scalaRadice);
    if (Math.abs(Math.abs(sc.x) - 1) > 0.01 || Math.abs(Math.abs(sc.y) - 1) > 0.01 || Math.abs(Math.abs(sc.z) - 1) > 0.01) return;
    const minimo = box ? Math.min(geo.parameters.width, geo.parameters.height, geo.parameters.depth)
      : ((geo.parameters.options || {}).depth ?? 1);
    if (!(minimo >= 3)) return;                  // pezzi troppo sottili (< 3 mm)
    const r = Math.min(box ? 1.6 : 2, minimo * 0.3);
    let g2 = fatte.get(geo);
    if (g2 === undefined) {
      try { g2 = box ? scatolaArrotondata(geo, r, segmenti) : estrusioneArrotondata(geo, r); } catch (e) { g2 = null; }
      fatte.set(geo, g2); if (g2) nuove.push(g2);
    }
    if (!g2) return;
    o.geometry = g2;
    ripristina.push(() => { o.geometry = geo; });
  });
  ripristina.push(() => { for (const g of nuove) g.dispose(); });
}

/**
 * Mesh con più materiali → una mesh per gruppo (la prima resta lei, le altre
 * accanto con la stessa posizione). Tutto torna com'era con `ripristina`.
 */
function dividiPerMateriale(o, ripristina) {
  const geo = o.geometry, mats = o.material;
  const tot = geo.index ? geo.index.count : geo.attributes.position.count;
  const gruppi = geo.groups.length ? geo.groups : [{ start: 0, count: tot, materialIndex: 0 }];
  const pezzi = [];
  for (const gr of gruppi) {
    const mat = mats[gr.materialIndex];
    if (!mat) continue;
    const n = Math.min(gr.count, tot - gr.start);
    if (!(n > 0)) continue;
    const g2 = new THREE.BufferGeometry();
    for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = geo.index ? geo.index.getX(gr.start + i) : gr.start + i;
    g2.setIndex(new THREE.BufferAttribute(idx, 1));
    pezzi.push({ g2, mat });
  }
  if (!pezzi.length) return;
  const fratelli = [];
  for (let i = 1; i < pezzi.length; i++) {
    const m2 = new THREE.Mesh(pezzi[i].g2, pezzi[i].mat);
    m2.position.copy(o.position); m2.quaternion.copy(o.quaternion); m2.scale.copy(o.scale);
    m2.visible = o.visible;
    if (o.parent) o.parent.add(m2);
    m2.updateMatrixWorld(true);
    fratelli.push(m2);
  }
  o.geometry = pezzi[0].g2; o.material = pezzi[0].mat;
  ripristina.push(() => {
    for (const m2 of fratelli) { if (m2.parent) m2.parent.remove(m2); m2.geometry.dispose(); }
    o.geometry.dispose(); o.geometry = geo; o.material = mats;
  });
}

/** Normale "verso l'interno" di un muro (dalla linea a→b verso il punto interno). */
function normaleInterna(m) {
  const dx = m.b.x - m.a.x, dz = m.b.z - m.a.z, L = Math.hypot(dx, dz) || 1;
  let nx = -dz / L, nz = dx / L;
  const mx = (m.a.x + m.b.x) / 2, mz = (m.a.z + m.b.z) / 2;
  if ((m.interno.x - mx) * nx + (m.interno.z - mz) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, L, mx, mz, ux: dx / L, uz: dz / L, ang: Math.atan2(dz, dx) };
}
/**
 * Muri che chiudono la stanza attorno alla cucina (solo per la foto): il
 * rettangolo allineato al muro più lungo che contiene muri, mobili e
 * fotografo. Niente se la pianta ha muri storti o non ne ha.
 */
function stanzaChiusa(muri, box, camPos, fH, chiudiDietro = false) {
  let u, n, o;
  const isola = !muri.length;                        // nessun muro (isola): stanza attorno, 1,5 m di passaggio
  if (!isola) {
    const princ = muri.reduce((a, b) => (b.n.L > a.n.L ? b : a));
    u = { x: princ.n.ux, z: princ.n.uz }; n = { x: princ.n.nx, z: princ.n.nz }; o = princ.a;
    // tutti i muri paralleli o perpendicolari al principale (se no: niente)
    if (muri.some((m) => { const c = Math.abs(m.n.ux * u.x + m.n.uz * u.z); return c > 0.035 && c < 0.9994; })) return [];
  } else { u = { x: 1, z: 0 }; n = { x: 0, z: 1 }; o = { x: box.min.x, z: box.min.z }; }
  const U = (p) => (p.x - o.x) * u.x + (p.z - o.z) * u.z, V = (p) => (p.x - o.x) * n.x + (p.z - o.z) * n.z;
  const punti = [];
  for (const m of muri) punti.push(m.a, m.b);
  const pMobili = [{ x: box.min.x, z: box.min.z }, { x: box.max.x, z: box.min.z }, { x: box.min.x, z: box.max.z }, { x: box.max.x, z: box.max.z }];
  const marg = isola ? 1.5 : 0;
  let u0 = Math.min(...punti.map(U), ...pMobili.map((p) => U(p) - marg)), u1 = Math.max(...punti.map(U), ...pMobili.map((p) => U(p) + marg));
  let v1 = Math.max(...punti.map(V), ...pMobili.map((p) => V(p) + (isola ? marg : 0.9)));
  let v0 = Math.min(isola ? Infinity : 0, ...punti.map(V), ...(isola ? pMobili.map((p) => V(p) - marg) : []));
  if (camPos) {                                    // foto: la stanza contiene anche il fotografo
    const cu = U(camPos), cv = V(camPos);
    if (isola) v0 = Math.min(v0, cv - 0.6);
    u0 = Math.min(u0, cu - 0.6); u1 = Math.max(u1, cu + 0.6); v1 = Math.max(v1, cv + 0.6);
  } else {
    v1 = Math.max(v1, ...pMobili.map((p) => V(p) + 2.4));   // vivo: un po' di stanza davanti alla cucina
  }
  const P = (uu, vv) => ({ x: o.x + u.x * uu + n.x * vv, z: o.z + u.z * uu + n.z * vv });
  const centro = P((u0 + u1) / 2, (v0 + v1) / 2);
  const lati = [
    { a: P(u0, v0), b: P(u0, v1), inn: { x: u.x, z: u.z } },             // sinistra
    { a: P(u1, v0), b: P(u1, v1), inn: { x: -u.x, z: -u.z } },           // destra
    { a: P(u0, v1), b: P(u1, v1), inn: { x: -n.x, z: -n.z } },           // fondo (di fronte al muro principale)
    { a: P(u0, v0), b: P(u1, v0), inn: { x: n.x, z: n.z } },             // lato del muro principale
  ];
  const out = [];
  for (const l of lati) {
    // alle spalle del fotografo: resta aperto (luce del resto della casa)
    if (!chiudiDietro && l.inn.x * fH.x + l.inn.z * fH.z > 0.5) continue;
    // già coperto da un muro della pianta (stessa linea, quasi tutta la lunghezza)?
    const lu = { x: l.b.x - l.a.x, z: l.b.z - l.a.z }, LL = Math.hypot(lu.x, lu.z) || 1;
    let coperto = 0;
    for (const m of muri) {
      const dA = Math.abs((m.a.x - l.a.x) * l.inn.x + (m.a.z - l.a.z) * l.inn.z), dB = Math.abs((m.b.x - l.a.x) * l.inn.x + (m.b.z - l.a.z) * l.inn.z);
      if (dA > 0.06 || dB > 0.06) continue;
      const ta = ((m.a.x - l.a.x) * lu.x + (m.a.z - l.a.z) * lu.z) / LL, tb = ((m.b.x - l.a.x) * lu.x + (m.b.z - l.a.z) * lu.z) / LL;
      coperto += Math.max(0, Math.min(LL, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb)));
    }
    if (coperto > LL - 0.3) continue;
    out.push({ a: l.a, b: l.b, interno: centro });
  }
  return out;
}

/** I segmenti 2D (x,z) a-b e c-d si incrociano? */
function siIncrociano(a, b, c, d) {
  const lato = (p, q, s) => (q.x - p.x) * (s.z - p.z) - (q.z - p.z) * (s.x - p.x);
  const d1 = lato(c, d, a), d2 = lato(c, d, b), d3 = lato(a, b, c), d4 = lato(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// ---------------------------------------------------------------------------
// SVILUPPO della foto (come in laboratorio): esposizione automatica, alone
// delle luci forti, curva NEUTRA (i colori dei materiali restano quelli dei
// campioni), vignettatura leggera, sRGB.
// ---------------------------------------------------------------------------
function neutro(rgb) {                           // Khronos PBR Neutral
  const inizio = 0.8 - 0.04, desat = 0.15;
  let r = rgb[0], g = rgb[1], b = rgb[2];
  const x = Math.min(r, g, b);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= off; g -= off; b -= off;
  const picco = Math.max(r, g, b);
  if (picco >= inizio) {
    const d = 1 - inizio;
    const np = 1 - d * d / (picco + d - inizio);
    const s = np / picco; r *= s; g *= s; b *= s;
    const t = 1 - 1 / (desat * (picco - np) + 1);
    r += (np - r) * t; g += (np - g) * t; b += (np - b) * t;
  }
  rgb[0] = r; rgb[1] = g; rgb[2] = b;
}
// lineare → sRGB, con una curva a S leggera (come la stampa di una foto:
// neri un filo più profondi, luci più brillanti)
const CONTRASTO = 0.22;
const _srgb = (() => {
  const n = 4096, t = new Uint8ClampedArray(n + 1);
  for (let i = 0; i <= n; i++) {
    const c = i / n;
    let v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    v += CONTRASTO * v * (1 - v) * (2 * v - 1);
    t[i] = Math.round(255 * Math.max(0, Math.min(1, v)));
  }
  return t;
})();
/** Percentili della luminanza (istogramma logaritmico, veloce). */
function percentili(lum, ps) {
  const NB = 2048, lo = -20, hi = 12, h = new Uint32Array(NB);
  let n = 0;
  for (let i = 0; i < lum.length; i++) {
    const l = lum[i]; if (!(l > 1e-6)) continue;
    let b = Math.floor((Math.log2(l) - lo) / (hi - lo) * NB); b = b < 0 ? 0 : b >= NB ? NB - 1 : b;
    h[b]++; n++;
  }
  return ps.map((p) => {
    if (!n) return 0;
    const obiettivo = p * n; let acc = 0;
    for (let b = 0; b < NB; b++) { acc += h[b]; if (acc >= obiettivo) return Math.pow(2, lo + (b + 0.5) / NB * (hi - lo)); }
    return Math.pow(2, hi);
  });
}
/** Esposizione: le superfici chiare (90° percentile) vicino al bianco, senza bruciare. */
function esposizioneAuto(lum) {
  const [p50, p90, p99] = percentili(lum, [0.5, 0.9, 0.99]);
  if (!(p90 > 0)) return 1;
  let k = 0.82 / p90;
  // un'immagine molto contrastata non diventa tutta scura per colpa di poche luci forti
  if (p50 > 0) k = Math.min(k, 0.42 / p50 * 1.6);
  if (p99 > 0) k = Math.max(k, 0.55 / p99);
  return k;
}
/**
 * Dalla luce calcolata (Float32 RGBA lineare, righe dal basso) alla foto.
 * Ritorna { canvas, esposizione }.
 */
function sviluppa(rgba, W, H, opz = {}) {
  const N = W * H;
  const lum = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) lum[i] = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2];
  const k = (opz.esposizione || 1) * esposizioneAuto(lum);
  // BILANCIAMENTO DEL BIANCO (come la macchina fotografica): stimo il colore
  // della LUCE che arriva sulle superfici (colore ÷ colore del materiale) e lo
  // riporto a un bianco appena caldo. Il legno resta legno, i muri bianchi.
  const [pA, pB] = percentili(lum, [0.3, 0.985]);
  let sr = 0, sg = 0, sb = 0, nn = 0;
  const alb = opz.albedo;
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    const l = lum[i]; if (l < pA || l > pB) continue;
    let r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
    if (alb) {
      const ar = alb[j] / 255, ag = alb[j + 1] / 255, ab = alb[j + 2] / 255;
      if (Math.min(ar, ag, ab) < 0.12) continue;                  // materiali scuri: poco affidabili
      r /= ar; g /= ag; b /= ab;
    } else {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mn <= 0 || mx / mn > 1.8) continue;
    }
    sr += r; sg += g; sb += b; nn++;
  }
  const wb = [1, 1, 1];
  if (nn > N * 0.01 && sr > 0 && sg > 0 && sb > 0) {
    const obiettivo = [1, 0.975, 0.93];                            // un filo di calore, come una foto vera
    const so = (obiettivo[0] + obiettivo[1] + obiettivo[2]) / 3, m = (sr + sg + sb) / 3;
    const lim = (x) => Math.max(0.8, Math.min(1.25, x));
    wb[0] = lim(obiettivo[0] / so * m / sr); wb[1] = lim(obiettivo[1] / so * m / sg); wb[2] = lim(obiettivo[2] / so * m / sb);
    const lw = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2];  // stessa luminosità
    wb[0] /= lw; wb[1] /= lw; wb[2] /= lw;
  }
  // ALONE delle luci forti (finestra, LED): soglia, sfocatura a 1/4, somma leggera
  const s = 4, w4 = Math.max(1, Math.floor(W / s)), h4 = Math.max(1, Math.floor(H / s));
  const alone = new Float32Array(w4 * h4 * 3);
  for (let y = 0; y < h4; y++) for (let x = 0; x < w4; x++) {
    let r = 0, g = 0, b = 0;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
      const j = ((y * s + yy) * W + (x * s + xx)) * 4;
      r += rgba[j]; g += rgba[j + 1]; b += rgba[j + 2];
    }
    const q = k / (s * s), sog = 1.4;
    const o = (y * w4 + x) * 3;
    alone[o] = Math.max(0, r * q - sog); alone[o + 1] = Math.max(0, g * q - sog); alone[o + 2] = Math.max(0, b * q - sog);
  }
  const rr = Math.max(2, Math.round(w4 * 0.012));
  const tmp = new Float32Array(alone.length);
  for (let pass = 0; pass < 3; pass++) {               // 3 passate di media = quasi gaussiana
    for (let y = 0; y < h4; y++) for (let c = 0; c < 3; c++) {
      let acc = 0; const n = 2 * rr + 1;
      for (let x = -rr; x <= rr; x++) acc += alone[(y * w4 + Math.min(w4 - 1, Math.max(0, x))) * 3 + c];
      for (let x = 0; x < w4; x++) {
        tmp[(y * w4 + x) * 3 + c] = acc / n;
        acc += alone[(y * w4 + Math.min(w4 - 1, x + rr + 1)) * 3 + c] - alone[(y * w4 + Math.max(0, x - rr)) * 3 + c];
      }
    }
    for (let x = 0; x < w4; x++) for (let c = 0; c < 3; c++) {
      let acc = 0; const n = 2 * rr + 1;
      for (let y = -rr; y <= rr; y++) acc += tmp[(Math.min(h4 - 1, Math.max(0, y)) * w4 + x) * 3 + c];
      for (let y = 0; y < h4; y++) {
        alone[(y * w4 + x) * 3 + c] = acc / n;
        acc += tmp[(Math.min(h4 - 1, y + rr + 1) * w4 + x) * 3 + c] - tmp[(Math.max(0, y - rr) * w4 + x) * 3 + c];
      }
    }
  }
  const forzaAlone = 0.22;
  // composizione finale
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(W, H), px = img.data;
  const rgb = [0, 0, 0];
  const vign = opz.vignetta ?? 0.13;
  let seme = 99991;
  for (let y = 0; y < H; y++) {
    const yDal = H - 1 - y;                                   // righe WebGL dal basso
    const ny = (y / H) * 2 - 1;
    const ya = Math.min(h4 - 1, Math.floor(yDal / s));
    for (let x = 0; x < W; x++) {
      const j = (yDal * W + x) * 4;
      const xa = Math.min(w4 - 1, Math.floor(x / s));
      const a = (ya * w4 + xa) * 3;
      rgb[0] = (Math.max(0, rgba[j]) * k + alone[a] * forzaAlone) * wb[0];
      rgb[1] = (Math.max(0, rgba[j + 1]) * k + alone[a + 1] * forzaAlone) * wb[1];
      rgb[2] = (Math.max(0, rgba[j + 2]) * k + alone[a + 2] * forzaAlone) * wb[2];
      neutro(rgb);
      const nx = (x / W) * 2 - 1;
      const v = 1 - vign * Math.pow((nx * nx + ny * ny) * 0.5, 1.4);
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        seme = (seme * 1103515245 + 12345) & 0x7fffffff;      // un filo di grana: niente scalini nei grigi
        const val = Math.max(0, Math.min(1, rgb[c] * v + ((seme / 0x7fffffff) - 0.5) / 600));
        px[o + c] = _srgb[Math.round(val * 4096)];
      }
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: out, esposizione: k };
}

// ---------------------------------------------------------------------------
// Anteprima durante il calcolo (nella scheda grafica): filtro leggero +
// stessa curva neutra della foto finale.
// ---------------------------------------------------------------------------
const VERTICE_QUAD = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function materialeAnteprima(lineare = false) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, esposizione: { value: 1 }, soglia: { value: 0.12 } },
    defines: { LINEARE: lineare ? 1 : 0 },
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    vertexShader: VERTICE_QUAD,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float esposizione; uniform float soglia;
      varying vec2 vUv;
      vec3 neutro(vec3 c) {
        float x = min(c.r, min(c.g, c.b));
        float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
        c -= off;
        float picco = max(c.r, max(c.g, c.b));
        if (picco < 0.76) return c;
        float d = 0.24;
        float np = 1.0 - d * d / (picco + d - 0.76);
        c *= np / picco;
        float t = 1.0 - 1.0 / (0.15 * (picco - np) + 1.0);
        return mix(c, vec3(np), t);
      }
      float srgb(float c) {
        float v = c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
        return clamp(v + ${CONTRASTO.toFixed(3)} * v * (1.0 - v) * (2.0 * v - 1.0), 0.0, 1.0);
      }
      void main() {
        vec2 px = 1.0 / vec2(textureSize(map, 0));
        vec3 c0 = texture2D(map, vUv).rgb * esposizione;
        vec3 somma = vec3(0.0); float pesi = 0.0;
        for (int y = -3; y <= 3; y++) for (int x = -3; x <= 3; x++) {
          vec3 c = texture2D(map, vUv + vec2(float(x), float(y)) * px).rgb * esposizione;
          vec3 dc = neutro(c) - neutro(c0);
          float w = exp(-float(x * x + y * y) / 8.0) * exp(-dot(dc, dc) / (2.0 * soglia * soglia));
          somma += c * w; pesi += w;
        }
        vec3 m = somma / max(pesi, 1e-5);
        #if LINEARE
          gl_FragColor = vec4(m / esposizione, 1.0);
        #else
          vec3 c = neutro(m);
          vec2 q = vUv * 2.0 - 1.0;
          c *= 1.0 - 0.13 * pow(dot(q, q) * 0.5, 1.4);
          gl_FragColor = vec4(srgb(clamp(c.r, 0.0, 1.0)), srgb(clamp(c.g, 0.0, 1.0)), srgb(clamp(c.b, 0.0, 1.0)), 1.0);
        #endif
      }`,
  });
}
const materialeCopia = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, peso: { value: 1 } },
  depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  vertexShader: VERTICE_QUAD,
  fragmentShader: 'uniform sampler2D map; uniform float peso; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv) * peso; }',
});
/** Luce dell'immagine (per l'esposizione dell'anteprima): lettura piccola. */
function misuraEsposizione(renderer, tex, quadCopia) {
  const rt = new THREE.WebGLRenderTarget(64, 40, { type: THREE.FloatType, depthBuffer: false });
  quadCopia.material.uniforms.map.value = tex; quadCopia.material.uniforms.peso.value = 1;
  renderer.setRenderTarget(rt); quadCopia.render(renderer); renderer.setRenderTarget(null);
  const buf = new Float32Array(64 * 40 * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, 64, 40, buf);
  rt.dispose();
  const lum = new Float32Array(64 * 40);
  for (let i = 0; i < lum.length; i++) lum[i] = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
  return esposizioneAuto(lum);
}

// ---------------------------------------------------------------------------
// ALBEDO e NORMALI (servono alla pulizia IA per non impastare i dettagli):
// la scena disegnata "piatta", spostando il pixel di poco ogni volta (come i
// campioni della foto) e facendo la media.
// ---------------------------------------------------------------------------
function renderAusiliari(renderer, scena, cam, W, H, sfondo) {
  const base = cam.view && cam.view.enabled ? { x: cam.view.offsetX, y: cam.view.offsetY } : { x: 0, y: 0 };
  // somma in mezza precisione (la somma su float32 non è garantita su tutti i
  // telefoni), poi copia in float32 per leggerla
  const frame = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
  const accF = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
  const quad = new FullScreenQuad(materialeCopia());
  // somma pura (1·nuovo + 1·già sommato): ogni passata pesa 1/N
  Object.assign(quad.material, {
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, transparent: true,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
  });
  const quadCopia = new FullScreenQuad(materialeCopia());
  const autoClearPrima = renderer.autoClear;
  const clearPrima = renderer.getClearColor(new THREE.Color()), alphaPrima = renderer.getClearAlpha();
  renderer.autoClear = false;                      // la somma non va cancellata a ogni passata
  const originali = new Map();
  const creati = [];
  const tipoMat = (m, tipo) => {
    let x;
    if (m.userData && m.userData.vetroFoto) { x = new THREE.MeshBasicMaterial(); x.visible = false; }   // si vede attraverso
    else if (tipo === 'albedo') {
      const em = m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01;
      x = new THREE.MeshBasicMaterial({
        color: em ? m.emissive : m.color, map: em ? (m.emissiveMap || null) : (m.map || null),
        transparent: m.transparent, opacity: m.opacity, alphaMap: m.alphaMap || null, alphaTest: m.alphaTest, side: m.side,
      });
    } else {
      x = new THREE.MeshNormalMaterial({ side: m.side, normalMap: m.normalMap || null, normalScale: m.normalScale || new THREE.Vector2(1, 1) });
    }
    x.toneMapped = false;
    creati.push(x);
    return x;
  };
  scena.traverse((o) => { if (o.isMesh && o.visible) originali.set(o, o.material); });
  const prima = { bg: scena.background, env: scena.environment };
  scena.environment = null;
  const risultati = {};
  const coloreFondo = new THREE.Color();
  for (const tipo of ['albedo', 'normale']) {
    const cache = new Map();
    const conv = (m) => { if (!cache.has(m)) cache.set(m, tipoMat(m, tipo)); return cache.get(m); };
    for (const [o, orig] of originali) o.material = Array.isArray(orig) ? orig.map(conv) : conv(orig);
    coloreFondo.copy(tipo === 'albedo' ? sfondo : new THREE.Color(0.5, 0.5, 0.5));
    scena.background = null;
    renderer.setRenderTarget(acc); renderer.setClearColor(0x000000, 0); renderer.clear();
    const N = 16;
    const tenda = (u) => (u < 0.5 ? Math.sqrt(2 * u) - 1 : 1 - Math.sqrt(2 - 2 * u));
    for (let i = 0; i < N; i++) {
      // spostamento del pixel come i campioni del path tracer (filtro a tenda, ±1 pixel), 4×4
      const jx = tenda(((i % 4) + Math.random()) / 4), jy = tenda((Math.floor(i / 4) + Math.random()) / 4);
      cam.setViewOffset(W, H, base.x + jx, base.y + jy, W, H);
      renderer.setRenderTarget(frame); renderer.setClearColor(coloreFondo, 1); renderer.clear();
      renderer.render(scena, cam);
      quad.material.uniforms.map.value = frame.texture; quad.material.uniforms.peso.value = 1 / N;
      renderer.setRenderTarget(acc); quad.render(renderer);
    }
    quadCopia.material.uniforms.map.value = acc.texture;
    renderer.setRenderTarget(accF); renderer.clear(); quadCopia.render(renderer);
    const buf = new Float32Array(W * H * 4);
    renderer.readRenderTargetPixels(accF, 0, 0, W, H, buf);
    const u8 = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < buf.length; i++) u8[i] = Math.round(Math.max(0, Math.min(1, buf[i])) * 255);
    for (let i = 3; i < u8.length; i += 4) u8[i] = 255;
    risultati[tipo] = u8;
  }
  for (const [o, m] of originali) o.material = m;
  for (const m of creati) m.dispose();
  scena.background = prima.bg; scena.environment = prima.env;
  if (base.x || base.y) cam.setViewOffset(W, H, base.x, base.y, W, H); else cam.clearViewOffset();
  renderer.autoClear = autoClearPrima;
  renderer.setClearColor(clearPrima, alphaPrima);
  renderer.setRenderTarget(null);
  frame.dispose(); acc.dispose(); accF.dispose();
  quad.dispose(); quad.material.dispose(); quadCopia.dispose(); quadCopia.material.dispose();
  return risultati;
}

// ---------------------------------------------------------------------------
// FILTRO DI RISERVA (senza WebGPU): la luce viene separata dal colore dei
// materiali (così venature e disegni restano nitidi), filtrata a più scale
// rispettando spigoli e superfici (filtro "à-trous"), poi rimoltiplicata.
// ---------------------------------------------------------------------------
/**
 * Pixel isolati senza luce (o con troppa luce) rispetto a TUTTI i vicini: con pochi
 * campioni il calcolo ne lascia qualcuno (puntini neri o bianchi), che i filtri
 * rispettano come se fossero dettagli. Si prende la media degli 8 vicini.
 * I dettagli veri (fughe, bordi, righe sottili) hanno vicini simili e restano.
 */
function togliPunti(c, W, H) {
  const N = W * H, L = new Float32Array(N);
  const vic = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  let tolti = 0;
  for (let giro = 0; giro < 2; giro++) {           // due giri: anche le coppie di puntini vicini
    for (let j = 0, i = 0; j < N; j++, i += 4) L[j] = 0.2126 * c[i] + 0.7152 * c[i + 1] + 0.0722 * c[i + 2];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1, j = y * W + 1; x < W - 1; x++, j++) {
        const v = L[j];
        // quanti vicini sono MOLTO più chiari / più scuri di lui: un puntino isolato li ha
        // (quasi) tutti; una riga sottile vera (fuga, bordo) ne ha al massimo 6
        let piuChiari = 0, piuScuri = 0;
        for (let k = 0; k < 8; k++) { const w = L[j + vic[k]]; if (w > v * 4 + 1e-6) piuChiari++; else if (w * 4 < v) piuScuri++; }
        const buco = v <= 0 && piuChiari >= 1;     // nessuna luce arrivata: dato mancante
        if (!buco && piuChiari < 7 && piuScuri < 7) continue;
        // media dei vicini "normali" (non a loro volta puntini)
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = 0; k < 8; k++) {
          const q = j + vic[k], w = L[q];
          if (piuChiari >= piuScuri ? w > v * 4 + 1e-6 : w * 4 < v) { const i = q * 4; r += c[i]; g += c[i + 1]; b += c[i + 2]; n++; }
        }
        if (!n) continue;
        const i = j * 4; c[i] = r / n; c[i + 1] = g / n; c[i + 2] = b / n;
        tolti++;
      }
    }
  }
  // i bordi dell'immagine (lì mancano metà dei vicini): un pixel spento o fuori misura
  // rispetto a quello appena dentro prende il suo valore
  if (W > 2 && H > 2) {
    const lum = (j) => 0.2126 * c[j * 4] + 0.7152 * c[j * 4 + 1] + 0.0722 * c[j * 4 + 2];
    const ripara = (j, q) => {
      const v = lum(j), w = lum(q);
      if ((v <= 0 && w > 0) || v > w * 4 + 1e-6 || v * 4 < w) { const a = j * 4, b2 = q * 4; c[a] = c[b2]; c[a + 1] = c[b2 + 1]; c[a + 2] = c[b2 + 2]; tolti++; }
    };
    for (let x = 0; x < W; x++) { ripara(x, W + x); ripara((H - 1) * W + x, (H - 2) * W + x); }
    for (let y = 0; y < H; y++) { ripara(y * W, y * W + 1); ripara(y * W + W - 1, y * W + W - 2); }
  }
  return tolti;
}
function filtroGuidato(renderer, texColore, aux, W, H, campioni = 64) {
  // con pochi campioni il rumore è forte: il filtro deve fidarsi meno delle differenze di luce
  const sigma0 = 1.3 * Math.max(1, Math.sqrt(32 / Math.max(1, campioni)));
  const dt = (u8) => { const t = new THREE.DataTexture(u8, W, H, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  const tAlb = dt(aux.albedo), tNor = dt(aux.normale);
  const rt = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const A = rt(), B = rt(), F = rt();
  const base = { depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false, vertexShader: VERTICE_QUAD };
  const demod = new THREE.ShaderMaterial({ ...base, uniforms: { tCol: { value: texColore }, tAlb: { value: tAlb } },
    fragmentShader: `uniform sampler2D tCol, tAlb; varying vec2 vUv;
      void main() { vec3 c = texture2D(tCol, vUv).rgb; vec3 a = max(texture2D(tAlb, vUv).rgb, vec3(0.03));
        gl_FragColor = vec4(c / a, 1.0); }` });
  const atrous = new THREE.ShaderMaterial({ ...base, uniforms: { tIrr: { value: null }, tNor: { value: tNor }, passo: { value: 1 }, sigma: { value: 1 }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
    fragmentShader: `uniform sampler2D tIrr, tNor; uniform float passo, sigma; uniform vec2 px; varying vec2 vUv;
      float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec3 c0 = texture2D(tIrr, vUv).rgb; vec3 n0 = texture2D(tNor, vUv).rgb * 2.0 - 1.0;
        float ln0 = length(n0); n0 = ln0 > 0.01 ? n0 / ln0 : vec3(0.0);   // sugli spigoli la normale media è più corta
        float l0 = log(lum(c0) + 1e-3);
        vec3 somma = vec3(0.0); float pesi = 0.0;
        for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * passo * px;
          vec3 c = texture2D(tIrr, uv).rgb; vec3 n = texture2D(tNor, uv).rgb * 2.0 - 1.0;
          float ln = length(n); n = ln > 0.01 ? n / ln : vec3(0.0);
          float kx = x == 0 ? 0.375 : (abs(x) == 1 ? 0.25 : 0.0625), ky = y == 0 ? 0.375 : (abs(y) == 1 ? 0.25 : 0.0625);
          float d = log(lum(c) + 1e-3) - l0;
          // sfondo (normale nulla) solo con sfondo; superfici solo con superfici simili
          float wn = ln0 < 0.5 ? (ln < 0.5 ? 1.0 : 0.0) : (ln < 0.5 ? 0.0 : pow(max(0.0, dot(n, n0)), 32.0));
          float w = kx * ky * exp(-d * d / (2.0 * sigma * sigma)) * wn;
          somma += c * w; pesi += w;
        }
        gl_FragColor = vec4(pesi > 1e-5 ? somma / pesi : c0, 1.0);
      }` });
  const remod = new THREE.ShaderMaterial({ ...base, uniforms: { tIrr: { value: null }, tAlb: { value: tAlb } },
    fragmentShader: `uniform sampler2D tIrr, tAlb; varying vec2 vUv;
      void main() { vec3 a = max(texture2D(tAlb, vUv).rgb, vec3(0.03)); gl_FragColor = vec4(texture2D(tIrr, vUv).rgb * a, 1.0); }` });
  const q = new FullScreenQuad(demod);
  const autoPrima = renderer.autoClear; renderer.autoClear = true;
  renderer.setRenderTarget(A); q.render(renderer);
  let da = A, a = B;
  for (let i = 0; i < 5; i++) {
    q.material = atrous;
    atrous.uniforms.tIrr.value = da.texture; atrous.uniforms.passo.value = 1 << i; atrous.uniforms.sigma.value = sigma0 * Math.pow(0.62, i);
    renderer.setRenderTarget(a); q.render(renderer);
    const t = da; da = a; a = t;
  }
  q.material = remod; remod.uniforms.tIrr.value = da.texture;
  renderer.setRenderTarget(F); q.render(renderer);
  const out = new Float32Array(W * H * 4);
  renderer.readRenderTargetPixels(F, 0, 0, W, H, out);
  renderer.setRenderTarget(null); renderer.autoClear = autoPrima;
  for (const x of [A, B, F, tAlb, tNor, demod, atrous, remod]) x.dispose();
  q.dispose();
  return out;
}

/**
 * Prepara la SCENA FOTOGRAFICA da una copia della scena 3D (la vista 3D non
 * viene toccata): materiali veri, spigoli raggiati, stanza, finestra, LED.
 * opz: {
 *   radice: Object3D con la scena (in mm), camera: PerspectiveCamera (in mm),
 *   larghezza, altezza (pixel: servono le proporzioni),
 *   muri: [{ a:{x,z}, b:{x,z}, interno:{x,z} }] in mm (coordinate 3D), hStanza (mm),
 *   soffittoAFilo, raddrizza (verticali dritte, default sì), vivo (vista dal
 *   vivo: stanza e finestra che non dipendono da dove guarda la camera)
 * }
 * Ritorna { scena, cam, sfondo, firma, firmaPer(camera), libera() }.
 */
export async function preparaScenaFoto(opz) {
  const { camera, larghezza: W, altezza: H } = opz;
  let hStanza = (opz.hStanza || 2700) * MM;
  // copia della scena (stesse forme e materiali, che qui vengono sostituiti
  // solo sulla copia): la vista 3D resta com'è
  let radice;
  try { radice = opz.radice.clone(true); } catch (e) { console.warn('Copia della scena non riuscita:', e); throw e; }
  const scena = new THREE.Scene();
  const involucro = new THREE.Group(); involucro.scale.setScalar(MM);
  scena.add(involucro); involucro.add(radice);
  scena.updateMatrixWorld(true);
  const daLiberareFn = [];                       // cosa liberare alla fine
  const nascondi = (o) => { o.visible = false; };
  const box = new THREE.Box3();
  const scatoleMobili = [];
  const ledLuci = [];
  const pavimenti = [];
  radice.traverse((o) => {
    if (o.isLine || o.isLineSegments || o.isPoints || o.isSprite || o.isLight) { nascondi(o); return; }
    if (!o.isMesh) return;
    const u = o.userData || {};
    if (u.muroRiferimento) { nascondi(o); return; }
    if (u.pavimento) { pavimenti.push(o); return; }
    if (u.ledStriscia) ledLuci.push(o);
  });
  for (const o of pavimenti) nascondi(o);
  radice.traverse((o) => { if (o.isMesh && o.visible) box.expandByObject(o); });
  for (const g of radice.children) {
    if (g.visible && g.userData && g.userData.mobId !== undefined) { const b = new THREE.Box3().expandByObject(g); if (!b.isEmpty()) scatoleMobili.push(b); }
  }
  if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
  // soffitto: mai più basso dei mobili; a filo se c'è la chiusura fino al soffitto
  hStanza = opz.soffittoAFilo ? box.max.y + 0.001 : Math.max(hStanza, box.max.y + 0.002);
  // MATERIALI della foto (vetri, legni, display…)
  const nuoviMat = new Map();                    // uuid originale → materiale foto (o null)
  const perFoto = (m) => {
    if (!m) return m;
    if (!nuoviMat.has(m.uuid)) { const n = materialeFoto(m); nuoviMat.set(m.uuid, n); if (n) daLiberareFn.push(() => n.dispose()); }
    return nuoviMat.get(m.uuid) || m;
  };
  let seme = 12345; const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  radice.traverse((o) => {
    if (!o.isMesh || !o.visible || (o.userData || {}).ledStriscia) return;
    const vecchio = o.material;
    const nuovo = Array.isArray(vecchio) ? vecchio.map(perFoto) : perFoto(vecchio);
    // venatura: ogni pezzo tagliato da un punto diverso del pannello (non per i
    // prodotti del catalogo con la misura del campione: lì la foto è centrata
    // sull'anta apposta, un'anta grande come la foto deve essere uguale alla foto)
    const mats = Array.isArray(nuovo) ? nuovo : [nuovo];
    const legno = mats.some((m) => m && m.normalMap && ripetuta(m.map))
      && !mats.some((m) => m && m.userData && m.userData.campioneMm);
    if (legno && o.geometry.attributes.uv) {
      const geo = o.geometry.clone(); const uv = geo.attributes.uv;
      // spostata e a volte specchiata: due ante vicine non hanno mai lo stesso disegno
      const du = rnd(), dv = rnd(), su = rnd() < 0.5 ? -1 : 1, sv = rnd() < 0.5 ? -1 : 1;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + du, uv.getY(i) * sv + dv);
      uv.needsUpdate = true;
      o.geometry = geo;
      daLiberareFn.push(() => geo.dispose());
    }
    o.material = nuovo;
  });
  arrotondaSpigoli(radice, daLiberareFn, opz.segmentiSpigoli || 5);
  // Il path tracer (0.0.23) sbaglia i materiali delle mesh con PIÙ MATERIALI
  // (es. il vetro del piano cottura) e poi sfasa anche tutti gli altri: per la
  // foto ogni mesh così diventa una mesh per materiale (stessa forma, stessi dati).
  const multiple = [];
  radice.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) multiple.push(o); });
  for (const o of multiple) dividiPerMateriale(o, daLiberareFn);
  // --- la camera in metri (foto: con le VERTICALI DRITTE) --------------------
  const cam = camera.clone();
  cam.position.multiplyScalar(MM);
  cam.near = 0.03; cam.far = 300; cam.aspect = W / H; cam.clearViewOffset();
  cam.updateMatrixWorld();
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const beccheggio = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  if (!opz.vivo && opz.raddrizza !== false && Math.abs(beccheggio) < THREE.MathUtils.degToRad(22) && Math.hypot(dir.x, dir.z) > 0.2) {
    // come un obiettivo decentrabile: camera orizzontale, inquadratura spostata
    cam.up.set(0, 1, 0);
    cam.lookAt(cam.position.clone().add(new THREE.Vector3(dir.x, 0, dir.z)));
    const sposta = -Math.tan(beccheggio) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (H / 2);
    cam.setViewOffset(W, H, 0, sposta, W, H);
  }
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  // --- la STANZA: muri pieni (visti da dentro), soffitto, pavimento -----------
  const stanza = new THREE.Group(); scena.add(stanza);
  const matMuro = new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.93, metalness: 0 });
  const matSoffitto = new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.96 });
  const matTelaio = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.15 });
  const matDavanzale = new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: 0.3 });
  const matBattiscopa = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.42 });
  const muriPianta = (opz.muri || []).map((m0) => ({ a: { x: m0.a.x * MM, z: m0.a.z * MM }, b: { x: m0.b.x * MM, z: m0.b.z * MM }, interno: { x: m0.interno.x * MM, z: m0.interno.z * MM } }));
  // da che parte "guarda" la stanza: foto → la camera; vivo → verso il muro
  // principale (così stanza e finestra non cambiano girando la vista)
  const fH = new THREE.Vector3(dir.x, 0, dir.z);
  if (opz.vivo && muriPianta.length) {
    const princ = muriPianta.map((m) => ({ m, n: normaleInterna(m) })).reduce((a, b) => (b.n.L > a.n.L ? b : a));
    fH.set(-princ.n.nx, 0, -princ.n.nz);
  }
  if (fH.lengthSq() < 1e-6) fH.set(0, 0, -1);
  fH.normalize();
  const camInterno = (n, p) => (p.x - n.mx) * n.nx + (p.z - n.mz) * n.nz > 0.05;
  // tutti i muri (della pianta + quelli che chiudono la stanza), poi quelli da costruire
  const tutti = muriPianta.map((m) => ({ ...m, virtuale: false }));
  {
    const provvisori = tutti.map((m) => ({ ...m, n: normaleInterna(m) }));
    for (const v of stanzaChiusa(provvisori, box, opz.vivo ? null : cam.position, fH, !!opz.chiudiDietro)) tutti.push({ ...v, virtuale: true });
  }
  const muri = tutti.map((m) => { const n = normaleInterna(m); return { ...m, n, presente: camInterno(n, cam.position) }; });
  for (const m of muri) {
    if (!m.presente) continue;
    const n = m.n;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(n.L + 0.2, hStanza, 0.1), matMuro);
    muro.position.set(n.mx - n.nx * 0.05, hStanza / 2, n.mz - n.nz * 0.05);
    muro.rotation.y = -n.ang;
    stanza.add(muro);
    // battiscopa bianco (dietro i mobili non si vede)
    const bat = new THREE.Mesh(new THREE.BoxGeometry(n.L, 0.08, 0.012), matBattiscopa);
    bat.position.set(n.mx + n.nx * 0.006, 0.04, n.mz + n.nz * 0.006);
    bat.rotation.y = -n.ang;
    stanza.add(bat);
  }
  const dentro = cam.position.y < hStanza - 0.05;
  // vista DA FUORI (dall'alto, o da lontano oltre un muro): la stanza si mostra
  // "in sezione" come un plastico: senza soffitto, pavimento solo dentro, intorno
  // un fondo neutro e luce morbida di studio (non la finestra, che lì non ha senso)
  const fuoriDi = (p) => muri.reduce((mx, m) => Math.max(mx, -((p.x - m.n.mx) * m.n.nx + (p.z - m.n.mz) * m.n.nz)), 0);
  const daFuori = !dentro || fuoriDi(cam.position) > 1.5;
  // "firma" della stanza vista da una camera: quali muri, se il soffitto c'è e se è da fuori
  const firmaPer = (camMm) => {
    const p = { x: camMm.position.x * MM, z: camMm.position.z * MM }, y = camMm.position.y * MM;
    return muri.map((m) => (camInterno(m.n, p) ? '1' : '0')).join('') + (y < hStanza - 0.05 ? 'S' : '-') + (y >= hStanza - 0.05 || fuoriDi(p) > 1.5 ? 'F' : '');
  };
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const lato = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 2 * Math.hypot(cam.position.x - cx, cam.position.z - cz) + 6;
  if (dentro && !daFuori) {
    const soffitto = new THREE.Mesh(new THREE.PlaneGeometry(lato + 20, lato + 20), matSoffitto);
    soffitto.rotation.x = Math.PI / 2; soffitto.position.set(cx, hStanza, cz); stanza.add(soffitto);
  }
  // pavimento in parquet (rovere, assi sfalsate) con il rilievo delle fughe
  // la stanza in pianta (da fuori il parquet sta solo qui dentro)
  const sx = [], sz = [];
  for (const m of tutti) { sx.push(m.a.x, m.b.x); sz.push(m.a.z, m.b.z); }
  if (!sx.length) { sx.push(box.min.x - 1.5, box.max.x + 1.5); sz.push(box.min.z - 1.5, box.max.z + 1.5); }
  const st = { x0: Math.min(...sx), x1: Math.max(...sx), z0: Math.min(...sz), z1: Math.max(...sz) };
  const latoPav = lato + 20;
  const pavL = daFuori ? st.x1 - st.x0 : latoPav, pavP = daFuori ? st.z1 - st.z0 : latoPav;
  const parquet = await texParquet();
  const ripX = pavL / (parquet.mmTile * MM), ripZ = pavP / (parquet.mmTile * MM);
  const tPav = parquet.tex.clone(); tPav.needsUpdate = true; tPav.repeat.set(ripX, ripZ);
  const mpPav = mappeDaFoto(parquet.tex, 1.4);
  const matPav = new THREE.MeshPhysicalMaterial({ map: tPav, roughness: 0.62, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.35 });
  if (mpPav) {
    matPav.normalMap = mpPav.normale.clone(); matPav.normalMap.repeat.set(ripX, ripZ); matPav.normalMap.needsUpdate = true;
    matPav.normalScale = new THREE.Vector2(0.5, 0.5);
    matPav.roughnessMap = mpPav.ruvido.clone(); matPav.roughnessMap.repeat.set(ripX, ripZ); matPav.roughnessMap.needsUpdate = true;
    matPav.roughness = 1.0;
  }
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(pavL, pavP), matPav);
  pav.rotation.x = -Math.PI / 2;
  if (daFuori) pav.position.set((st.x0 + st.x1) / 2, 0, (st.z0 + st.z1) / 2); else pav.position.set(cx, 0, cz);
  stanza.add(pav);
  const matFondo = new THREE.MeshStandardMaterial({ color: 0xe6e3dd, roughness: 0.97, metalness: 0 });
  if (daFuori) {                                 // il fondo neutro intorno, appena sotto
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(latoPav, latoPav), matFondo);
    fondo.rotation.x = -Math.PI / 2; fondo.position.set(cx, -0.004, cz); stanza.add(fondo);
  }
  // --- LUCE -------------------------------------------------------------------
  // cielo / ambiente: la luce morbida che arriva dal resto della casa
  // (da fuori il cielo è aperto sopra la stanza: più luce, e il fondo intorno non resta buio)
  const ambiente = opz.ambiente ?? (daFuori ? 0.8 : 0.22);
  const cielo = new GradientEquirectTexture();
  cielo.topColor.set(0xfbfbff).multiplyScalar(ambiente);
  cielo.bottomColor.set(0x8d877e).multiplyScalar(ambiente * 0.45);
  cielo.exponent = 1.4;
  cielo.update();
  scena.environment = cielo;
  const sfondo = new THREE.Color(0xf2f1ee);
  scena.background = sfondo;
  if (daFuori) {
    // DA FUORI: luce di studio. Un grande pannello morbido davanti-sopra la cucina
    // (fa vedere bene i frontali e lascia ombre morbide) + il cielo dall'alto
    const davantiF = new THREE.Vector3(cx, 0, cz).addScaledVector(fH, -2.6);
    const studio = new THREE.RectAreaLight(0xfffdf9, opz.studio ?? 9, 2.8, 2.2);
    studio.position.set(davantiF.x, hStanza + 0.6, davantiF.z);
    studio.lookAt(cx, 0.9, cz);
    scena.add(studio);
  } else {
    // FINESTRA: in un muro laterale libero (con telaio e davanzale), altrimenti
    // di lato fuori dall'inquadratura. La luce del giorno entra radente.
    const dx = new THREE.Vector3(-fH.z, 0, fH.x);
    const C = new THREE.Vector3(cx, 0, cz);
    // punto "del fotografo": foto → la camera; vivo → davanti alla cucina
    const davanti = opz.vivo ? C.clone().addScaledVector(fH, -2.5) : cam.position.clone().setY(0);
    const finH = Math.min(1.45, hStanza - 1.2), finY = Math.min(0.95 + finH / 2, hStanza - 0.3 - finH / 2);
    const inQuadro = (p) => { if (opz.vivo) return false; const v = p.clone().project(cam); return v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02; };
    const mobiliVicino = (m) => scatoleMobili.some((b) => {
      // distanza della scatola dal muro e sovrapposizione lungo il muro
      const ang = [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]];
      const dist = Math.min(...ang.map(([x, z]) => Math.abs((x - m.a.x) * m.n.nx + (z - m.a.z) * m.n.nz)));
      const lungo = ang.map(([x, z]) => (x - m.a.x) * m.n.ux + (z - m.a.z) * m.n.uz);
      return dist < 0.75 && Math.max(...lungo) > 0.2 && Math.min(...lungo) < m.n.L - 0.2;
    });
    let finestra = null;
    const laterale = (m) => Math.abs(m.n.nx * fH.x + m.n.nz * fH.z);
    const candidati = muri.filter((m) => (opz.vivo || m.presente) && m.n.L >= 1.4 && laterale(m) < 0.75 && !mobiliVicino(m)).sort((a, b) => laterale(a) - laterale(b));
    for (const m of candidati) {
      // a metà tra il fotografo e la cucina, dentro il muro
      const M = C.clone().add(davanti).multiplyScalar(0.5);
      const w = Math.min(1.5, m.n.L - 0.6);
      let t = (M.x - m.a.x) * m.n.ux + (M.z - m.a.z) * m.n.uz;
      t = Math.max(0.3 + w / 2, Math.min(m.n.L - 0.3 - w / 2, t));
      finestra = {
        pos: new THREE.Vector3(m.a.x + m.n.ux * t + m.n.nx * 0.004, finY, m.a.z + m.n.uz * t + m.n.nz * 0.004),
        n: new THREE.Vector3(m.n.nx, 0, m.n.nz), w, nelMuro: true, muro: m,
      };
      break;
    }
    if (!finestra) {
      const est = Math.abs(dx.x) * (box.max.x - box.min.x) / 2 + Math.abs(dx.z) * (box.max.z - box.min.z) / 2;
      for (const s of [-1, 1]) {
        const p = C.clone().addScaledVector(dx, s * (est + 1.4)).addScaledVector(fH, -0.9); p.y = finY;
        for (let i = 0; i < 8 && inQuadro(p); i++) p.addScaledVector(dx, s * 0.5);
        const bloccata = muri.some((m) => (opz.vivo || m.presente) && siIncrociano({ x: C.x, z: C.z }, { x: p.x, z: p.z }, m.a, m.b));
        if (bloccata || inQuadro(p)) continue;
        finestra = { pos: p, n: C.clone().setY(finY).sub(p).setY(0).normalize(), w: 1.5, nelMuro: false };
        break;
      }
    }
    if (!finestra) {                               // tutto chiuso: luce dal lato aperto della stanza, dall'alto
      const p = davanti.clone().addScaledVector(fH, -0.6); p.y = Math.min(hStanza - 0.2, (opz.vivo ? 1.6 : cam.position.y) + 0.6);
      finestra = { pos: p, n: C.clone().setY(1).sub(p).normalize(), w: 1.5, nelMuro: false };
    }
    const luceFin = new THREE.RectAreaLight(0xfffdf9, opz.finestra ?? 30, finestra.w, finH);
    luceFin.position.copy(finestra.pos);
    luceFin.lookAt(finestra.pos.clone().add(finestra.n));
    scena.add(luceFin);
    // telaio e davanzale solo se il muro della finestra c'è (vivo: la camera può essere fuori)
    if (finestra.nelMuro && finestra.muro.presente) {
      // telaio (due ante con montante centrale) e davanzale: fanno l'ombra a
      // croce sul pavimento e il riflesso "da finestra" sulle superfici lucide
      const tel = new THREE.Group();
      const prof = 0.07, sp = 0.065;
      const pezzo = (w, h, d, x, y, z, mat = matTelaio) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); tel.add(b); };
      const W2 = finestra.w / 2, H2 = finH / 2;
      pezzo(finestra.w + 2 * sp, sp, prof, 0, H2 + sp / 2, prof / 2);
      pezzo(finestra.w + 2 * sp, sp, prof, 0, -H2 - sp / 2, prof / 2);
      pezzo(sp, finH, prof, -W2 - sp / 2, 0, prof / 2);
      pezzo(sp, finH, prof, W2 + sp / 2, 0, prof / 2);
      pezzo(sp * 1.4, finH, prof, 0, 0, prof / 2);                                  // montante centrale
      pezzo(finestra.w + 0.24, 0.03, 0.2, 0, -H2 - sp - 0.015, 0.1, matDavanzale);  // davanzale
      tel.position.copy(finestra.pos);
      tel.lookAt(finestra.pos.clone().add(finestra.n));                            // +Z verso la stanza
      stanza.add(tel);
    }
  }
  // LED sotto i pensili: strisce che fanno luce davvero
  for (const s of ledLuci) {
    if (!s.visible) continue;
    const L = s.userData.ledStriscia;
    const col = new THREE.Color(L.colore).lerp(new THREE.Color(0xffffff), 0.25);
    const p = new THREE.Vector3(); s.getWorldPosition(p);
    const q = new THREE.Quaternion(); s.getWorldQuaternion(q);
    const luce = new THREE.RectAreaLight(col, opz.led ?? 26, (L.lunghezza || 600) * MM, 0.016);
    luce.position.copy(p).add(new THREE.Vector3(0, -0.0035, 0));
    luce.quaternion.copy(q);
    luce.rotateX(-Math.PI / 2);                    // rivolta verso il basso
    scena.add(luce);
    const m = new THREE.MeshStandardMaterial({ color: 0x202020, emissive: col, emissiveIntensity: 2.2, roughness: 0.6 });
    s.material = m;
    daLiberareFn.push(() => m.dispose());
  }
  scena.updateMatrixWorld(true);
  const libera = () => {
    cielo.dispose();
    stanza.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of [matMuro, matSoffitto, matTelaio, matDavanzale, matBattiscopa, matPav, matFondo]) m.dispose();
    tPav.dispose();
    if (matPav.normalMap) matPav.normalMap.dispose();
    if (matPav.roughnessMap) matPav.roughnessMap.dispose();
    for (const f of daLiberareFn) { try { f(); } catch (_) { /* avanti */ } }
    involucro.remove(radice);
  };
  return { scena, cam, sfondo, firma: firmaPer({ position: camera.position }), firmaPer, libera };
}

/**
 * Calcola la FOTO REALISTICA della scena.
 * opz: {
 *   radice: Object3D con la scena (in mm), camera: PerspectiveCamera (in mm),
 *   larghezza, altezza (pixel), campioni (senza pulizia IA), campioniIA (con),
 *   muri: [{ a:{x,z}, b:{x,z}, interno:{x,z} }] in mm (coordinate 3D), hStanza (mm),
 *   onProgress(frazione, canvasAnteprima, info), annullato(): bool,
 *   pulizia: true (default) = pulizia IA se il dispositivo la supporta
 * }
 * Ritorna il canvas con la foto (o null se annullata prima del primo campione).
 */
export async function fotoRealistica(opz) {
  const { larghezza: W, altezza: H } = opz;
  const avvisa = (f, tela, info) => { if (opz.onProgress) { try { opz.onProgress(f, tela, info || {}); } catch (_) { /* UI */ } } };
  // con la pulizia IA (WebGPU) bastano meno passaggi; si prepara (scarica i
  // pesi) mentre si calcola la luce
  const conIA = opz.pulizia !== false && !opz.soloControllo && await puliziaIADisponibile();
  const unetP = conIA ? caricaUNet() : Promise.resolve(null);
  const campioni = Math.max(1, conIA ? (opz.campioniIA || opz.campioni || 160) : (opz.campioni || 400));
  const { scena, cam, sfondo, libera } = await preparaScenaFoto(opz);
  // --- renderer e path tracer -------------------------------------------------
  const tela = document.createElement('canvas'); tela.width = W; tela.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const pt = new WebGLPathTracer(renderer);
  pt.tiles.set(opz.tessere || 2, opz.tessere || 2);
  pt.bounces = 7; pt.transmissiveBounces = 6;
  pt.filterGlossyFactor = 0.35;
  pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 1;
  pt.rasterizeScene = false; pt.renderToCanvas = false;      // la dimensione segue la tela (W×H)
  pt.textureSize.set(1024, 1024);
  const quad = new FullScreenQuad(materialeAnteprima());
  const quadCopia = new FullScreenQuad(materialeCopia());
  let espAnteprima = 1, ultimaMisura = 0;
  const anteprima = () => {
    if (performance.now() - ultimaMisura > 2500) { espAnteprima = misuraEsposizione(renderer, pt.target.texture, quadCopia) * (opz.esposizione || 1); ultimaMisura = performance.now(); }
    quad.material.uniforms.map.value = pt.target.texture;
    quad.material.uniforms.esposizione.value = espAnteprima;
    renderer.setRenderTarget(null);
    quad.render(renderer);
  };
  let risultato = null, ptLiberato = false;
  try {
    if (opz.soloControllo) {                       // controllo: la scena della foto disegnata in modo normale
      scena.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.5));
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.render(scena, cam);
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      out.getContext('2d').drawImage(tela, 0, 0);
      risultato = out;
    } else {
      pt.setScene(scena, cam);
      let ultimoDisegno = 0;
      const t0 = performance.now(), tempo = opz.tempoMax || Infinity;   // tempo massimo (s): la foto non può durare ore
      while (pt.samples < campioni) {
        if (opz.annullato && opz.annullato()) break;
        const el = (performance.now() - t0) / 1000;
        if (pt.samples >= 1 && el >= tempo) break;
        pt.renderSample();
        if (performance.now() - ultimoDisegno > 700 && pt.samples >= 1) {
          anteprima(); ultimoDisegno = performance.now();
          avvisa(Math.min(1, Math.max(pt.samples / campioni, el / tempo)) * 0.9, tela, { fase: 'luce', campioni: Math.floor(pt.samples), totale: campioni });
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (pt.samples >= 1) {
        anteprima();
        avvisa(0.9, tela, { fase: 'pulizia' });
        // la luce calcolata (lineare, senza curva)
        const colore = new Float32Array(W * H * 4);
        renderer.readRenderTargetPixels(pt.target, 0, 0, W, H, colore);
        togliPunti(colore, W, H);
        const campioniFatti = pt.samples;
        // il path tracer non serve più: libero subito la sua memoria (telefoni)
        try { pt.dispose(); } catch (_) { /* già liberato */ }
        ptLiberato = true;
        const texColore = new THREE.DataTexture(colore, W, H, THREE.RGBAFormat, THREE.FloatType);
        texColore.needsUpdate = true;
        let pulita = null, aux = null;
        try { aux = renderAusiliari(renderer, scena, cam, W, H, sfondo); } catch (e) { console.warn('Albedo/normali non riusciti:', e); }
        if (aux && opz.controlloAusiliari) opz.controlloAusiliari({ colore, albedo: aux.albedo, normale: aux.normale, W, H });
        const unet = await unetP;
        if (unet && aux) {
          try {
            pulita = await pulisciIA(unet, colore, aux.albedo, aux.normale, W, H, (f) => avvisa(0.9 + f * 0.08, null, { fase: 'pulizia' }));
          } catch (e) { console.warn('Pulizia IA non riuscita, uso il filtro di riserva:', e); pulita = null; }
        }
        if (!pulita && aux) {
          try { pulita = filtroGuidato(renderer, texColore, aux, W, H, campioniFatti); } catch (e) { console.warn('Filtro guidato non riuscito:', e); pulita = null; }
        }
        if (!pulita) {
          // ultima riserva: filtro bilaterale semplice sulla luce lineare
          const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
          const filtro = materialeAnteprima(true);
          filtro.uniforms.map.value = texColore; filtro.uniforms.esposizione.value = espAnteprima; filtro.uniforms.soglia.value = 0.06;
          const qf = new FullScreenQuad(filtro);
          renderer.setRenderTarget(rt); qf.render(renderer); renderer.setRenderTarget(null);
          pulita = new Float32Array(W * H * 4);
          renderer.readRenderTargetPixels(rt, 0, 0, W, H, pulita);
          rt.dispose(); qf.dispose(); filtro.dispose();
        }
        const albedo = aux ? aux.albedo : null;
        texColore.dispose();
        avvisa(0.98, null, { fase: 'sviluppo' });
        risultato = sviluppa(pulita, W, H, { esposizione: opz.esposizione || 1, albedo }).canvas;
      }
    }
  } catch (e) {
    console.error('Foto realistica:', e);
    throw e;
  } finally {
    if (!ptLiberato) { try { pt.dispose(); } catch (_) { /* già liberato */ } }
    quad.dispose(); quad.material.dispose(); quadCopia.dispose(); quadCopia.material.dispose();
    libera();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* niente */ }
    avvisa(1, null, { fase: 'fine' });
  }
  return risultato;
}

// =============================================================================
// VISTA 3D REALISTICA DAL VIVO
// =============================================================================
// Quando la vista 3D resta ferma (~1 s), la STESSA inquadratura si "sviluppa"
// sullo stesso canvas in qualità foto: path tracing progressivo + pulizia IA.
// Al primo tocco/movimento torna subito la vista veloce. A immagine finita la
// scheda grafica si ferma (il canvas tiene l'immagine): niente consumo mentre
// il cliente guarda. Lavora su una COPIA della scena (la vista non si tocca).
// =============================================================================
const CHIAVE_VIVO = 'ng-vista-realistica';
/** La vista realistica è accesa? (scelta del dispositivo, di base sì) */
export function vistaRealisticaAccesa() {
  try { return localStorage.getItem(CHIAVE_VIVO) !== '0'; } catch (_) { return true; }
}
/** Le immagini delle texture sono già arrivate? (sul telefono, al primo caricamento, possono tardare) */
function texturePronte(radice) {
  let pronte = true;
  radice.traverse((o) => {
    if (!pronte || !o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap', 'emissiveMap', 'aoMap']) {
        const t = m[k];
        if (!t || t.isRenderTargetTexture) continue;
        const img = t.image;
        if (!img || (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && !(img.complete && img.naturalWidth > 0))) { pronte = false; return; }
      }
    }
  });
  return pronte;
}
const materialeFinale = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: null } },
  depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  vertexShader: VERTICE_QUAD,
  fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0); }',
});
/** Telefono o tablet (scheda grafica più lenta: meno pixel e meno rimbalzi della luce). */
export function eTelefono() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
// --- VELOCITÀ del calcolo su QUESTO dispositivo (pixel × campioni al secondo) ----
// Si misura mentre lavora (vista realistica o foto) e si ricorda: serve a scegliere
// risoluzione e passaggi della foto in modo che finisca nel tempo promesso.
const CHIAVE_VEL = 'ng-velocita-luce';
let _vel = 0;
export function velocitaCalcolo() {
  if (_vel > 0) return _vel;
  try { const v = Number(localStorage.getItem(CHIAVE_VEL)); if (v > 0) { _vel = v; return v; } } catch (_) { /* niente */ }
  return eTelefono() ? 6e5 : 4e6;                 // stima prudente finché non si misura
}
function misuraVelocita(v) {
  if (!(v > 0) || !Number.isFinite(v)) return;
  _vel = _vel > 0 ? _vel * 0.5 + v * 0.5 : v;
  try { localStorage.setItem(CHIAVE_VEL, String(Math.round(_vel))); } catch (_) { /* niente */ }
}
/** Tasselli per lato: ogni pezzo ~25 ms di lavoro, così la pagina risponde subito ai tocchi. */
function tasselli(px) {
  const perPezzo = Math.max(25000, velocitaCalcolo() * 0.025);
  return Math.max(1, Math.min(8, Math.ceil(Math.sqrt(px / perPezzo))));
}
/**
 * Il calcolo a LOTTI: un lotto di pezzi alla volta, e il successivo solo quando la
 * scheda grafica ha FINITO il precedente (un "recinto" WebGL2 lo dice). Senza, il
 * lavoro mandato si accumula: il conto dei passaggi corre avanti ma la scheda resta
 * indietro, e alla lettura dell'immagine tutto si blocca finché non ha smaltito
 * l'arretrato. Il lotto cresce finché la scheda finisce entro ~1–2 fotogrammi: lavora
 * al pieno e la pagina resta fluida. Misura anche la velocità vera del dispositivo.
 *   pronto() → true se si può mandare altro (e aggiorna i campioni finiti davvero)
 *   manda()  → manda il prossimo lotto
 */
function creaPasso(pt, px, renderer) {
  const gl = renderer.getContext();
  const recinti = typeof gl.fenceSync === 'function';
  let k = 1, recinto = null, tLotto = 0, s0 = -1, t0 = 0, sFatti = 0, tFatti = 0;
  const segna = (ora) => { sFatti = pt.samples; tFatti = ora; if (s0 < 0 && sFatti >= 1) { s0 = sFatti; t0 = ora; } };
  return {
    pronto() {
      if (!recinto) return true;
      if (gl.getSyncParameter(recinto, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
      gl.deleteSync(recinto); recinto = null;
      const ora = performance.now(), durata = ora - tLotto;
      if (pt.isCompiling || pt.samples < 1) k = 1;                 // il programma si sta ancora preparando
      else if (durata < 24) k = Math.min(k * 2, 64);
      else if (durata > 48) k = Math.max(1, Math.floor(k * 0.6));
      segna(ora);
      return true;
    },
    manda() {
      for (let i = 0; i < k; i++) pt.renderSample();
      if (recinti) { recinto = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } else segna(performance.now());
      tLotto = performance.now();
    },
    /** campioni finiti davvero sulla scheda grafica */
    fatti() { return sFatti; },
    /** pixel × campioni al secondo (0 finché non è misurabile) */
    velocita() { const dt = (tFatti - t0) / 1000; return s0 >= 0 && dt > 1 && sFatti > s0 ? (px * (sFatti - s0)) / dt : 0; },
    libera() { if (recinto) { try { gl.deleteSync(recinto); } catch (_) { /* niente */ } recinto = null; } },
  };
}
/** Ridimensiona una tela con il filtro migliore del browser. */
function scalaTela(tela, W, H) {
  if (tela.width === W && tela.height === H) return tela;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(tela, 0, 0, W, H);
  return out;
}
/** Un filo di nitidezza (dopo un ingrandimento): maschera di contrasto leggera. */
function nitidezza(tela, quanto = 0.3) {
  const W = tela.width, H = tela.height, g = tela.getContext('2d');
  const im = g.getImageData(0, 0, W, H), d = im.data, o = new Uint8ClampedArray(d), r = W * 4;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1, i = (y * W + 1) * 4; x < W - 1; x++, i += 4) {
      for (let c = 0; c < 3; c++) {
        const m = (o[i - 4 + c] + o[i + 4 + c] + o[i - r + c] + o[i + r + c]) * 0.25;
        d[i + c] = o[i + c] + (o[i + c] - m) * quanto;
      }
    }
  }
  g.putImageData(im, 0, 0);
}
/** Pixel non validi del calcolo azzerati; ritorna { somma, nonValidi } per il controllo. */
function pulisciValori(colore) {
  let somma = 0, nonValidi = 0;
  for (let i = 0; i < colore.length; i += 4) {
    const v = colore[i] + colore[i + 1] + colore[i + 2];
    if (v < 1e30) somma += v;
    else { nonValidi++; colore[i] = colore[i + 1] = colore[i + 2] = 0; }
  }
  return { somma, nonValidi };
}

/**
 * opz: {
 *   renderer, camera, controls (quelli della vista 3D), contenitore (dove mettere il bollino),
 *   dati(): { radice, camera, muri, hStanza, soffittoAFilo } come per la foto
 * }
 * Ritorna { tick(altroMoto, bloccata) → true se il canvas lo tiene lei (non ridisegnare),
 *           scatta(parametri) → la FOTO (stesso motore, già pronto), invalida(), ridisegna(),
 *           libera(), dispose() }.
 * La telecamera la sorveglia da sola: si sviluppa solo quando l'inquadratura è ferma davvero.
 */
export function creaVistaRealistica(opz) {
  const renderer = opz.renderer, canvas = renderer.domElement;
  const telefono = eTelefono();
  const ATTESA_PRIMA = 900;                        // ms di vista ferma prima di preparare la scena
  const ATTESA = 450;                              // … se è già pronta (cambia solo il punto di vista)
  const PIXEL_MAX = telefono ? 300000 : 900000;    // risoluzione del calcolo (poi ingrandita)
  const FERMA_PX = 0.03;                           // movimento per fotogramma sotto cui la vista è ferma
  const DERIVA_PX = 0.6;                           // deriva massima dall'inquadratura che si sta sviluppando
  // tappe dello sviluppo: a ogni tappa l'immagine si pulisce e si mostra. Si passa alla
  // tappa quando ci sono abbastanza campioni O quando è passato il suo tempo (con un
  // minimo di campioni): su un dispositivo lento l'immagine arriva lo stesso presto
  const TAPPE_IA = [{ s: 16, t: 4, min: 4 }, { s: 64, t: 20, min: 8 }];
  const TAPPE_FILTRO = [{ s: 32, t: 5, min: 8 }, { s: 128, t: 24, min: 16 }];
  let accesa = vistaRealisticaAccesa();
  let stato = 'fermo', tMosso = performance.now(), gen = 0, inCorso = null, inCorsoDa = 0;
  let prep = null, scenaValida = false, pt = null, tappe = TAPPE_FILTRO, passo = null, tInizio = 0;
  let dimensione = '', abortIA = null, tappa = 0, conIA = null, aux = null;
  let texFinale = null, bloccata = false, guasto = false, premuto = false, fotografa = false;
  let ultimaTela = null;                           // l'ultima immagine finita (per salvarla subito)
  const quadFinale = new FullScreenQuad(materialeFinale());
  const v2 = new THREE.Vector2();
  // --- la telecamera: di quanti pixel si è spostata l'immagine sullo schermo ----
  // (conta anche quando si muove da sola: pulsanti di vista, coda dello smorzamento…)
  const camUlt = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 0, zoom: 0, aspect: 0, ok: false };
  const camSvil = { p: new THREE.Vector3(), q: new THREE.Quaternion() };   // la posa che si sta sviluppando
  function pixelTra(p, q, c) {
    const ang = 2 * Math.acos(Math.min(1, Math.abs(q.dot(c.quaternion))));
    const t = opz.controls && opz.controls.target;
    const dist = t ? Math.max(100, c.position.distanceTo(t)) : 3000;
    const pxRad = v2.y / Math.max(1e-3, THREE.MathUtils.degToRad(c.fov || 50) / (c.zoom || 1));
    return (ang + p.distanceTo(c.position) / dist) * pxRad;
  }
  // --- bollino nell'angolo della vista 3D: stato + acceso/spento ---------------
  const tt = (x) => (window.NGI18N ? window.NGI18N.t(x) : x);
  let bollino = null;
  if (opz.contenitore) {
    bollino = document.createElement('button');
    bollino.type = 'button'; bollino.className = 'bollino-realistica';
    bollino.title = 'Tocca per accendere o spegnere la vista realistica';
    opz.contenitore.appendChild(bollino);
    bollino.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fotografa) return;
      // dopo un guasto, toccarla la riprova (accesa); altrimenti accende/spegne
      if (guasto) { guasto = false; accesa = true; } else accesa = !accesa;
      try { localStorage.setItem(CHIAVE_VIVO, accesa ? '1' : '0'); } catch (_) { /* niente */ }
      if (!accesa) { interrompi(); liberaTutto(); } else tMosso = performance.now();
      aggiornaBollino();
    });
  }
  let testoBollino = '';
  function aggiornaBollino(frazione) {
    if (!bollino) return;
    const chiave = `${accesa}|${guasto}|${stato}|${frazione != null ? Math.round(frazione * 20) : ''}`;
    if (chiave === testoBollino) return;
    testoBollino = chiave;
    bollino.classList.toggle('spenta', !accesa);
    bollino.classList.toggle('lavora', accesa && !guasto && (stato === 'preparo' || stato === 'campiono' || stato === 'pulisco'));
    if (!accesa) bollino.textContent = '✨ ' + tt('Vista realistica: spenta');
    else if (guasto) bollino.textContent = '✨ ' + tt('Vista realistica non disponibile');
    else if (stato === 'finito') bollino.textContent = '✨ ' + tt('Vista realistica');
    else if (stato === 'fermo') bollino.textContent = '✨ ' + tt('Vista realistica: fermati un attimo');
    else bollino.textContent = '✨ ' + tt('Sviluppo la vista…') + (frazione != null ? ` ${Math.round(frazione * 100)}%` : '');
  }
  aggiornaBollino();
  // --- dita sullo schermo: finché sono giù non si comincia ----------------------
  const giu = () => { premuto = true; };
  const su = () => { if (premuto) { premuto = false; tMosso = performance.now(); } };
  const rotella = () => { tMosso = performance.now(); };
  // contesto grafico perso (il telefono ha liberato memoria): si libera tutto e la vista
  // realistica si ferma (non deve rischiare di far perdere di nuovo la vista 3D);
  // un tocco sul bollino la riprova
  const perso = () => { const usata = !!(pt || prep); interrompi(); liberaTutto(); if (usata) { guasto = true; aggiornaBollino(); } };
  canvas.addEventListener('pointerdown', giu, { passive: true });
  canvas.addEventListener('wheel', rotella, { passive: true });
  window.addEventListener('pointerup', su, { passive: true });
  window.addEventListener('pointercancel', su, { passive: true });
  canvas.addEventListener('webglcontextlost', perso);

  function interrompi() {
    gen++;
    if (passo) { passo.libera(); passo = null; }
    if (abortIA) { try { abortIA(); } catch (_) { /* niente */ } abortIA = null; }
    if (texFinale) { texFinale.dispose(); texFinale = null; }
    stato = 'fermo'; tappa = 0; aux = null; ultimaTela = null;
    aggiornaBollino();
  }
  function liberaTutto() {
    if (pt) { try { pt.dispose(); } catch (_) { /* niente */ } pt = null; }
    if (prep) { try { prep.libera(); } catch (_) { /* niente */ } prep = null; }
    scenaValida = false;
  }
  function camDaVista(cam, camera, w, h) {
    cam.position.copy(camera.position).multiplyScalar(MM);
    cam.quaternion.copy(camera.quaternion);
    cam.fov = camera.fov; cam.zoom = camera.zoom; cam.aspect = w / h;
    cam.near = 0.03; cam.far = 300; cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    camSvil.p.copy(camera.position); camSvil.q.copy(camera.quaternion);
  }
  /** Scena e path tracer pronti per i dati di adesso (si ricostruisce solo se serve). g: generazione (null = non interrompibile). */
  async function preparaMotore(d, w, h, g) {
    const firma = prep && scenaValida ? prep.firmaPer(d.camera) : null;
    if (!prep || !scenaValida || firma !== prep.firma) {
      // texture ancora in arrivo: si aspetta un poco (al massimo ~5 s)
      for (let i = 0; i < 12 && !texturePronte(d.radice); i++) {
        await new Promise((r) => setTimeout(r, 400));
        if (g != null && g !== gen) return false;
      }
      if (prep) { prep.libera(); prep = null; }
      scenaValida = false;
      const p = await preparaScenaFoto({ ...d, larghezza: w, altezza: h, vivo: true, segmentiSpigoli: telefono ? 3 : 5 });
      if (g != null && g !== gen) { p.libera(); return false; }   // nel frattempo si è mosso qualcosa
      prep = p; scenaValida = true;
      if (!pt) {
        pt = new WebGLPathTracer(renderer);
        pt.bounces = telefono ? 4 : 6; pt.transmissiveBounces = 4;
        pt.filterGlossyFactor = 0.35;
        pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 1;
        pt.rasterizeScene = false; pt.renderToCanvas = false; pt.dynamicLowRes = false;
        pt.textureSize.set(1024, 1024);
      }
      camDaVista(prep.cam, d.camera, w, h);
      pt.setScene(prep.scena, prep.cam);
    } else {
      camDaVista(prep.cam, d.camera, w, h);
      pt.setCamera(prep.cam);
    }
    return true;
  }
  /** Dimensione del calcolo (scala rispetto al canvas) subito, senza aspettare il prossimo passo. */
  function dimensionaPT(scala) {
    renderer.getDrawingBufferSize(v2);
    pt.renderScale = scala;
    const W = Math.max(1, Math.floor(v2.x * scala)), H = Math.max(1, Math.floor(v2.y * scala));
    pt._pathTracer.setSize(W, H);
    pt._lowResPathTracer.setSize(Math.max(1, Math.floor(W * pt.lowResScale)), Math.max(1, Math.floor(H * pt.lowResScale)));
    return { W, H };
  }
  async function avvia() {
    stato = 'preparo'; aggiornaBollino(0);
    const g = gen;
    try {
      const d = opz.dati && opz.dati();
      if (!d || !d.radice || !d.camera) { stato = 'fermo'; tMosso = performance.now(); aggiornaBollino(); return; }
      if (conIA === null) conIA = await puliziaIADisponibile();
      tappe = conIA ? TAPPE_IA : TAPPE_FILTRO;
      if (conIA) caricaUNet();                     // i pesi si scaricano intanto
      if (g !== gen) return;
      renderer.getDrawingBufferSize(v2);
      const w = Math.max(1, v2.x), h = Math.max(1, v2.y);
      if (!(await preparaMotore(d, w, h, g)) || g !== gen) return;
      // risoluzione del calcolo; a tasselli: ogni pezzo è breve e la vista risponde
      // subito appena la si tocca
      const { W, H } = dimensionaPT(Math.min(1, Math.sqrt(PIXEL_MAX / (w * h))));
      const n = tasselli(W * H); pt.tiles.set(n, n);
      pt.reset();
      passo = creaPasso(pt, W * H, renderer); tInizio = performance.now();
      tappa = 0; aux = null;
      stato = 'campiono'; aggiornaBollino(0);
    } catch (e) {
      console.warn('Vista realistica non disponibile:', e);
      guasto = true; stato = 'fermo'; liberaTutto(); aggiornaBollino();
    }
  }
  function disegnaFinale() {
    if (!texFinale) return;
    quadFinale.material.uniforms.map.value = texFinale;
    renderer.setRenderTarget(null);
    quadFinale.render(renderer);
  }
  function mostra(tela) {
    if (texFinale) texFinale.dispose();
    texFinale = new THREE.CanvasTexture(tela);
    texFinale.minFilter = THREE.LinearFilter; texFinale.magFilter = THREE.LinearFilter; texFinale.generateMipmaps = false;
    disegnaFinale();
  }
  /** Luce calcolata → controllo → albedo/normali → pulizia (IA o filtro). Ritorna { pulita, a, W, H }. */
  async function pulisci(g, avanzamento) {
    const sz = new THREE.Vector2(); pt._pathTracer.getSize(sz);
    const W = sz.x, H = sz.y;
    const colore = new Float32Array(W * H * 4);
    renderer.readRenderTargetPixels(pt.target, 0, 0, W, H, colore);
    // un'immagine tutta nera o piena di valori non validi vuol dire che il calcolo
    // non funziona su questo dispositivo; i rari pixel non validi o isolati si sistemano
    const { somma, nonValidi } = pulisciValori(colore);
    if (!(somma > 0) || nonValidi > (W * H) * 0.05) throw new Error('immagine vuota dal calcolo');
    togliPunti(colore, W, H);
    // albedo e normali: una volta per inquadratura e misura (servono alla pulizia e al bianco)
    if (!aux || aux.W !== W || aux.H !== H) aux = { W, H, ...renderAusiliari(renderer, prep.scena, prep.cam, W, H, prep.sfondo) };
    const a = aux;
    let pulita = null;
    const unet = conIA ? await caricaUNet() : null;
    if (g != null && g !== gen) return null;
    if (unet) {
      pulita = await new Promise((ok, ko) => {
        try {
          const ferma = unet.tileExecute({
            color: { data: colore, width: W, height: H },
            albedo: { data: a.albedo, width: W, height: H },
            normal: { data: a.normale, width: W, height: H },
            done: (out) => ok(out.data), error: (e) => ko(e),
            progress: (_o, _t, _tile, i, n) => { if (avanzamento) avanzamento((i + 1) / Math.max(1, n)); },
          });
          // interrotta (la vista si è mossa): la pulizia non chiama più né done né error,
          // quindi si chiude qui l'attesa (se no resterebbe appesa con la sua memoria)
          abortIA = () => { try { ferma(); } catch (_) { /* niente */ } ok(null); };
        } catch (e) { ko(e); }
      }).catch((e) => { console.warn('Pulizia IA:', e); return null; });
      abortIA = null;
    }
    if (g != null && g !== gen) return null;
    if (!pulita) {
      const tex = new THREE.DataTexture(colore, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
      try { pulita = filtroGuidato(renderer, tex, a, W, H, pt.samples); } finally { tex.dispose(); }
    }
    if (!pulita) throw new Error('immagine non sviluppata');
    return { pulita, a, W, H };
  }
  async function sviluppaOra(ultima) {
    stato = 'pulisco';
    const g = gen;
    try {
      const r = await pulisci(g);
      if (!r || g !== gen) return;
      const tela = sviluppa(r.pulita, r.W, r.H, { albedo: r.a.albedo, vignetta: 0.06 }).canvas;
      if (g !== gen) return;
      mostra(tela);
      if (ultima) ultimaTela = tela;
      stato = ultima ? 'finito' : 'campiono';
      aggiornaBollino(ultima ? 1 : pt.samples / tappe[tappe.length - 1].s);
    } catch (e) {
      // un errore qui si ripeterebbe a ogni pausa: meglio spegnerla (e dirlo) che consumare batteria
      console.warn('Vista realistica (sviluppo):', e);
      if (g === gen) { guasto = true; interrompi(); liberaTutto(); aggiornaBollino(); }
    }
  }
  /** Un fotogramma di calcolo. Il canvas tiene la vista veloce finché non c'è la prima immagine sviluppata. */
  function campiona() {
    if (!passo || !passo.pronto()) return;         // la scheda grafica sta ancora lavorando
    const s = passo.fatti(), el = (performance.now() - tInizio) / 1000;
    const ult = tappe[tappe.length - 1];
    if (tappa < tappe.length) {
      const T = tappe[tappa];
      if (s >= T.s || (el >= T.t && s >= T.min)) {
        const ultima = tappa === tappe.length - 1;
        tappa++;
        misuraVelocita(passo.velocita());
        sviluppaOra(ultima);                       // niente in sospeso: la lettura è immediata
        return;
      }
    }
    passo.manda();
    aggiornaBollino(Math.min(0.99, Math.max(s / ult.s, el / ult.t)));
  }
  /**
   * LA FOTO, dallo stesso motore della vista realistica (scena già pronta, stessa
   * inquadratura e stessa luce di quello che si vede): in un tempo massimo, con la
   * risoluzione che questo dispositivo riesce a fare in quel tempo (poi ingrandita).
   * f: { larghezza, altezza, tempoMax (s), campioniIA, campioni, annullato(), onProgress(f, tela, info) }
   */
  async function scatta(f = {}) {
    const avvisa = (x, tela, info) => { if (f.onProgress) { try { f.onProgress(x, tela, info || {}); } catch (_) { /* UI */ } } };
    fotografa = true;
    interrompi();
    let tela = null;
    try {
      const d = opz.dati && opz.dati();
      if (!d || !d.radice || !d.camera) return null;
      avvisa(0.01, null, { fase: 'preparo' });
      if (conIA === null) conIA = await puliziaIADisponibile();
      if (conIA) caricaUNet();
      renderer.getDrawingBufferSize(v2);
      const w = Math.max(1, v2.x), h = Math.max(1, v2.y);
      await preparaMotore(d, w, h, null);
      // quanti pixel si possono calcolare bene nel tempo dato su questo dispositivo
      const W0 = Math.max(16, Math.round(f.larghezza || w)), H0 = Math.max(16, Math.round(f.altezza || h));
      const tempo = Math.max(4, f.tempoMax || 30);
      const voluti = Math.max(1, conIA ? (f.campioniIA || 96) : (f.campioni || 320));
      // sotto questi campioni per pixel resta grana: meglio meno pixel (poi ingranditi);
      // senza la pulizia IA ne servono di più
      const minimi = conIA ? 16 : 64;
      let px = Math.min(W0 * H0, (velocitaCalcolo() * tempo * 0.85) / minimi);
      px = Math.max(px, Math.min(W0 * H0, conIA ? 600000 : 250000));
      const { W, H } = dimensionaPT((W0 * Math.sqrt(px / (W0 * H0))) / w);
      const n = tasselli(W * H); pt.tiles.set(n, n);
      pt.reset();
      const ps = creaPasso(pt, W * H, renderer);
      const t0 = performance.now();
      let ultimo = 0, tLuce = 0;                   // il tempo della luce parte dal primo campione
      try {                                        // (prima, la prima volta, si prepara il programma)
        for (;;) {
          if (ps.pronto()) {
            const ora = performance.now(), s = ps.fatti();
            if (s >= 1 && !tLuce) tLuce = ora;
            const el = tLuce ? (ora - tLuce) / 1000 : 0;
            // a tempo scaduto ci si ferma, ma non sotto un minimo di passaggi (se no resta
            // grana che nessuna pulizia toglie): al massimo si arriva al doppio del tempo
            const abbastanza = s >= (conIA ? 8 : 24) || el >= tempo * 2;
            if (s >= voluti || (s >= 1 && ((el >= tempo && abbastanza) || (f.annullato && f.annullato())))) break;
            if (s < 1 && (ora - t0) / 1000 > tempo + 90) throw new Error('il calcolo non parte');
            ps.manda();
            if (ora - ultimo > 250) {
              ultimo = ora;
              if (s < 1) avvisa(0.02, null, { fase: 'preparo' });
              else avvisa(0.02 + 0.86 * Math.min(1, Math.max(el / tempo, s / voluti)), null, { fase: 'luce' });
            }
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
      } finally { ps.libera(); }
      misuraVelocita(ps.velocita());
      avvisa(0.9, null, { fase: 'pulizia' });
      aux = null;
      const r = await pulisci(null, (x) => avvisa(0.9 + x * 0.07, null, { fase: 'pulizia' }));
      avvisa(0.98, null, { fase: 'sviluppo' });
      tela = sviluppa(r.pulita, r.W, r.H, { albedo: r.a.albedo, vignetta: 0.09 }).canvas;
      aux = null;
      if (r.W < W0 - 1 || r.H < H0 - 1) {
        const k = W0 / r.W;
        tela = scalaTela(tela, W0, H0);
        if (k > 1.15) nitidezza(tela, Math.min(0.45, 0.2 + (k - 1) * 0.25));
      }
      // la vista realistica mostra subito la foto appena fatta (stessa inquadratura)
      if (accesa && !guasto) {
        mostra(scalaTela(tela, w, h));
        stato = 'finito'; camSvil.p.copy(d.camera.position); camSvil.q.copy(d.camera.quaternion);
        ultimaTela = tela;
      }
      return tela;
    } finally {
      fotografa = false;
      // memoria: il calcolo torna alla misura della vista (la foto ne usava di più)
      try { if (pt) dimensionaPT(Math.min(1, Math.sqrt(PIXEL_MAX / (Math.max(1, v2.x) * Math.max(1, v2.y))))); } catch (_) { /* niente */ }
      if (!accesa) liberaTutto();
      if (stato !== 'finito') { stato = 'fermo'; tMosso = performance.now(); }
      aggiornaBollino(stato === 'finito' ? 1 : undefined);
      avvisa(1, null, { fase: 'fine' });
    }
  }
  return {
    scatta,
    /**
     * L'immagine realistica che si vede adesso, se è finita (per salvarla SUBITO):
     * almeno grande quanto la si vede sullo schermo. null se non è pronta.
     */
    immagine() {
      if (!accesa || guasto || stato !== 'finito' || !ultimaTela) return null;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      const k = Math.max(1, Math.min(2.5, (Math.max(r.width, r.height) * dpr) / Math.max(ultimaTela.width, ultimaTela.height)));
      if (k <= 1.05) return ultimaTela;
      const t = scalaTela(ultimaTela, Math.round(ultimaTela.width * k), Math.round(ultimaTela.height * k));
      nitidezza(t, Math.min(0.4, 0.15 + (k - 1) * 0.2));
      return t;
    },
    tick(altroMoto = false, bloccataOra = false) {
      if (fotografa) return true;                  // la foto usa il motore: il canvas resta com'è
      if (!accesa || guasto) return false;
      const ora = performance.now();
      renderer.getDrawingBufferSize(v2);
      let mossa = !!altroMoto;
      const dim = v2.x + 'x' + v2.y;
      if (dim !== dimensione) { dimensione = dim; mossa = true; }
      if (bloccataOra !== bloccata) { bloccata = bloccataOra; mossa = true; }
      const c = opz.camera;
      if (c) {
        if (!camUlt.ok || camUlt.fov !== c.fov || camUlt.zoom !== c.zoom || camUlt.aspect !== c.aspect || pixelTra(camUlt.p, camUlt.q, c) > FERMA_PX) mossa = true;
        else if ((stato === 'campiono' || stato === 'pulisco' || stato === 'finito') && pixelTra(camSvil.p, camSvil.q, c) > DERIVA_PX) mossa = true;
        camUlt.p.copy(c.position); camUlt.q.copy(c.quaternion);
        camUlt.fov = c.fov; camUlt.zoom = c.zoom; camUlt.aspect = c.aspect; camUlt.ok = true;
      }
      if (mossa || bloccata) {
        if (stato !== 'fermo') interrompi();
        tMosso = ora;
        return false;
      }
      if (stato === 'fermo') {
        if (premuto) { tMosso = ora; return false; }
        if (inCorso && ora - inCorsoDa > 20000) inCorso = null;     // una preparazione rimasta appesa
        if (!inCorso && ora - tMosso >= (prep && scenaValida ? ATTESA : ATTESA_PRIMA)) {
          inCorsoDa = ora;
          const p = inCorso = avvia().finally(() => { if (inCorso === p) inCorso = null; });
        }
        return false;
      }
      if (stato === 'preparo') return false;
      if (stato === 'campiono') campiona();
      return true;                                 // il canvas tiene l'ultima immagine: niente da ridisegnare
    },
    /** La scena è cambiata (mobili, colori…): si ricostruisce alla prossima pausa. */
    invalida() {
      scenaValida = false; tMosso = performance.now();
      if (!fotografa && stato !== 'fermo') interrompi();
    },
    /** Ridisegna l'immagine realistica, se c'è (es. dopo un salvataggio che ha usato il canvas). */
    ridisegna() {
      if (!accesa || guasto || !texFinale) return false;
      disegnaFinale();
      return true;
    },
    /** Libera la memoria. */
    libera() { if (fotografa) return; interrompi(); liberaTutto(); tMosso = performance.now(); },
    dispose() {
      interrompi(); liberaTutto();
      canvas.removeEventListener('pointerdown', giu);
      canvas.removeEventListener('wheel', rotella);
      window.removeEventListener('pointerup', su);
      window.removeEventListener('pointercancel', su);
      canvas.removeEventListener('webglcontextlost', perso);
      quadFinale.dispose(); quadFinale.material.dispose();
      if (bollino) bollino.remove();
    },
  };
}
