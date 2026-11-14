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
const _mappe = new Map();
function mappeDaFoto(tex, forzaRilievo = 1) {
  const img = tex && tex.image;
  if (!img || !(img.width > 16) || !(img.height > 16)) return null;
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
  const crea = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.offset.copy(tex.offset);
    t.rotation = tex.rotation; t.center.copy(tex.center); t.anisotropy = 4;
    return t;
  };
  const out = { normale: crea(nC), ruvido: crea(rC) };
  _mappe.set(chiave, out);
  return out;
}
const ripetuta = (t) => t && (t.wrapS === THREE.RepeatWrapping || t.wrapS === THREE.MirroredRepeatWrapping);
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
  // LEGNI e pietre (texture ripetute): rilievo + lucentezza dalla foto
  if (ripetuta(m.map) && m.metalness <= 0.5 && !m.transparent) {
    const mp = mappeDaFoto(m.map);
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
function stanzaChiusa(muri, box, camPos, fH) {
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
  const cu = U(camPos), cv = V(camPos);
  if (isola) v0 = Math.min(v0, cv - 0.6);
  u0 = Math.min(u0, cu - 0.6); u1 = Math.max(u1, cu + 0.6); v1 = Math.max(v1, cv + 0.6);
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
    if (l.inn.x * fH.x + l.inn.z * fH.z > 0.5) continue;
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
function filtroGuidato(renderer, texColore, aux, W, H) {
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
        float l0 = log(lum(c0) + 1e-3);
        vec3 somma = vec3(0.0); float pesi = 0.0;
        for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * passo * px;
          vec3 c = texture2D(tIrr, uv).rgb; vec3 n = texture2D(tNor, uv).rgb * 2.0 - 1.0;
          float kx = x == 0 ? 0.375 : (abs(x) == 1 ? 0.25 : 0.0625), ky = y == 0 ? 0.375 : (abs(y) == 1 ? 0.25 : 0.0625);
          float d = log(lum(c) + 1e-3) - l0;
          // sfondo (normale nulla) solo con sfondo; superfici solo con superfici simili
          float wn = dot(n0, n0) < 0.25 ? (dot(n, n) < 0.25 ? 1.0 : 0.0) : pow(max(0.0, dot(n, n0)), 32.0);
          float w = kx * ky * exp(-d * d / (2.0 * sigma * sigma)) * wn;
          somma += c * w; pesi += w;
        }
        gl_FragColor = vec4(somma / max(pesi, 1e-6), 1.0);
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
    atrous.uniforms.tIrr.value = da.texture; atrous.uniforms.passo.value = 1 << i; atrous.uniforms.sigma.value = 1.3 * Math.pow(0.62, i);
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
  const { radice, camera, larghezza: W, altezza: H } = opz;
  let hStanza = (opz.hStanza || 2700) * MM;
  const avvisa = (f, tela, info) => { if (opz.onProgress) { try { opz.onProgress(f, tela, info || {}); } catch (_) { /* UI */ } } };
  // con la pulizia IA (WebGPU) bastano meno passaggi; si prepara (scarica i
  // pesi) mentre si calcola la luce
  const conIA = opz.pulizia !== false && !opz.soloControllo && await puliziaIADisponibile();
  const unetP = conIA ? caricaUNet() : Promise.resolve(null);
  const campioni = Math.max(1, conIA ? (opz.campioniIA || opz.campioni || 160) : (opz.campioni || 400));
  // --- scena della foto -----------------------------------------------------
  const scena = new THREE.Scene();
  const involucro = new THREE.Group(); involucro.scale.setScalar(MM);
  const padre = radice.parent, indice = padre ? padre.children.indexOf(radice) : -1;
  scena.add(involucro); involucro.add(radice);
  scena.updateMatrixWorld(true);
  const ripristina = [];                         // cosa rimettere com'era
  const nascondi = (o) => { if (o.visible) { o.visible = false; ripristina.push(() => { o.visible = true; }); } };
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
  const daLiberare = [];
  const perFoto = (m) => {
    if (!m) return m;
    if (!nuoviMat.has(m.uuid)) { const n = materialeFoto(m); nuoviMat.set(m.uuid, n); if (n) daLiberare.push(n); }
    return nuoviMat.get(m.uuid) || m;
  };
  let seme = 12345; const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  radice.traverse((o) => {
    if (!o.isMesh || !o.visible || (o.userData || {}).ledStriscia) return;
    const vecchio = o.material;
    const nuovo = Array.isArray(vecchio) ? vecchio.map(perFoto) : perFoto(vecchio);
    const cambiato = Array.isArray(vecchio) ? nuovo.some((x, i) => x !== vecchio[i]) : nuovo !== vecchio;
    // venatura: ogni pezzo tagliato da un punto diverso del pannello (non per i
    // prodotti del catalogo con la misura del campione: lì la foto è centrata
    // sull'anta apposta, un'anta grande come la foto deve essere uguale alla foto)
    const mats = Array.isArray(nuovo) ? nuovo : [nuovo];
    const legno = mats.some((m) => m && m.normalMap && ripetuta(m.map))
      && !mats.some((m) => m && m.userData && m.userData.campioneMm);
    let geoPrima = null;
    if (legno && o.geometry.attributes.uv) {
      geoPrima = o.geometry;
      const geo = geoPrima.clone(); const uv = geo.attributes.uv;
      // spostata e a volte specchiata: due ante vicine non hanno mai lo stesso disegno
      const du = rnd(), dv = rnd(), su = rnd() < 0.5 ? -1 : 1, sv = rnd() < 0.5 ? -1 : 1;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + du, uv.getY(i) * sv + dv);
      uv.needsUpdate = true;
      o.geometry = geo;
    }
    if (cambiato) o.material = nuovo;
    if (cambiato || geoPrima) ripristina.push(() => { if (geoPrima) { o.geometry.dispose(); o.geometry = geoPrima; } o.material = vecchio; });
  });
  ripristina.push(() => { for (const m of daLiberare) m.dispose(); });
  // Il path tracer (0.0.23) sbaglia i materiali delle mesh con PIÙ MATERIALI
  // (es. il vetro del piano cottura) e poi sfasa anche tutti gli altri: per la
  // foto ogni mesh così diventa una mesh per materiale (stessa forma, stessi dati).
  const multiple = [];
  radice.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) multiple.push(o); });
  for (const o of multiple) dividiPerMateriale(o, ripristina);
  // --- la camera in metri, con le VERTICALI DRITTE ---------------------------
  const cam = camera.clone();
  cam.position.multiplyScalar(MM);
  cam.near = 0.03; cam.far = 300; cam.aspect = W / H; cam.clearViewOffset();
  cam.updateMatrixWorld();
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const beccheggio = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  if (opz.raddrizza !== false && Math.abs(beccheggio) < THREE.MathUtils.degToRad(22) && Math.hypot(dir.x, dir.z) > 0.2) {
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
  const muri = [];
  const fH = new THREE.Vector3(dir.x, 0, dir.z);              // avanti della camera, in orizzontale
  if (fH.lengthSq() < 1e-6) fH.set(0, 0, -1);
  fH.normalize();
  const aggiungiMuro = (m, virtuale) => {
    const n = normaleInterna(m);
    // la camera deve stare dalla parte interna del muro, se no il muro la coprirebbe
    const presente = (cam.position.x - n.mx) * n.nx + (cam.position.z - n.mz) * n.nz > 0.05;
    muri.push({ ...m, n, presente, virtuale });
    if (!presente) return;
    const muro = new THREE.Mesh(new THREE.BoxGeometry(n.L + 0.2, hStanza, 0.1), matMuro);
    muro.position.set(n.mx - n.nx * 0.05, hStanza / 2, n.mz - n.nz * 0.05);
    muro.rotation.y = -n.ang;
    stanza.add(muro);
    // battiscopa bianco (dietro i mobili non si vede)
    const bat = new THREE.Mesh(new THREE.BoxGeometry(n.L, 0.08, 0.012), matBattiscopa);
    bat.position.set(n.mx + n.nx * 0.006, 0.04, n.mz + n.nz * 0.006);
    bat.rotation.y = -n.ang;
    stanza.add(bat);
  };
  for (const m0 of (opz.muri || [])) {
    aggiungiMuro({ a: { x: m0.a.x * MM, z: m0.a.z * MM }, b: { x: m0.b.x * MM, z: m0.b.z * MM }, interno: { x: m0.interno.x * MM, z: m0.interno.z * MM } }, false);
  }
  // La pianta ha solo i muri della cucina: dove la stanza è "aperta" la foto
  // mostrerebbe il pavimento che finisce nel vuoto. Chiudo la stanza con muri
  // veri (rettangolo che contiene muri, mobili e fotografo), tranne quello alle
  // spalle del fotografo, da cui entra la luce del resto della casa.
  for (const v of stanzaChiusa(muri, box, cam.position, fH)) aggiungiMuro(v, true);
  const dentro = cam.position.y < hStanza - 0.05;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const lato = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 2 * Math.hypot(cam.position.x - cx, cam.position.z - cz) + 6;
  if (dentro) {
    const soffitto = new THREE.Mesh(new THREE.PlaneGeometry(lato, lato), matSoffitto);
    soffitto.rotation.x = Math.PI / 2; soffitto.position.set(cx, hStanza, cz); stanza.add(soffitto);
  }
  // pavimento in parquet (rovere, assi sfalsate) con il rilievo delle fughe
  const parquet = await texParquet();
  const ripPav = lato / (parquet.mmTile * MM);
  const tPav = parquet.tex.clone(); tPav.needsUpdate = true; tPav.repeat.set(ripPav, ripPav);
  const mpPav = mappeDaFoto(parquet.tex, 1.4);
  const matPav = new THREE.MeshPhysicalMaterial({ map: tPav, roughness: 0.62, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.35 });
  if (mpPav) {
    matPav.normalMap = mpPav.normale.clone(); matPav.normalMap.repeat.set(ripPav, ripPav); matPav.normalMap.needsUpdate = true;
    matPav.normalScale = new THREE.Vector2(0.5, 0.5);
    matPav.roughnessMap = mpPav.ruvido.clone(); matPav.roughnessMap.repeat.set(ripPav, ripPav); matPav.roughnessMap.needsUpdate = true;
    matPav.roughness = 1.0;
  }
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(lato, lato), matPav);
  pav.rotation.x = -Math.PI / 2; pav.position.set(cx, 0, cz); stanza.add(pav);
  // --- LUCE -------------------------------------------------------------------
  // cielo / ambiente: la luce morbida che arriva dal resto della casa
  const cielo = new GradientEquirectTexture();
  cielo.topColor.set(0xfbfbff).multiplyScalar(opz.ambiente ?? 0.3);
  cielo.bottomColor.set(0x8d877e).multiplyScalar((opz.ambiente ?? 0.3) * 0.45);
  cielo.exponent = 1.4;
  cielo.update();
  scena.environment = cielo;
  const sfondo = new THREE.Color(0xf2f1ee);
  scena.background = sfondo;
  // FINESTRA: in un muro laterale libero (con telaio e davanzale), altrimenti
  // di lato fuori dall'inquadratura. La luce del giorno entra radente.
  const dx = new THREE.Vector3(-fH.z, 0, fH.x);
  const C = new THREE.Vector3(cx, 0, cz);
  const finH = Math.min(1.45, hStanza - 1.2), finY = Math.min(0.95 + finH / 2, hStanza - 0.3 - finH / 2);
  const inQuadro = (p) => { const v = p.clone().project(cam); return v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02; };
  const mobiliVicino = (m) => scatoleMobili.some((b) => {
    // distanza della scatola dal muro e sovrapposizione lungo il muro
    const ang = [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]];
    const dist = Math.min(...ang.map(([x, z]) => Math.abs((x - m.a.x) * m.n.nx + (z - m.a.z) * m.n.nz)));
    const lungo = ang.map(([x, z]) => (x - m.a.x) * m.n.ux + (z - m.a.z) * m.n.uz);
    return dist < 0.75 && Math.max(...lungo) > 0.2 && Math.min(...lungo) < m.n.L - 0.2;
  });
  let finestra = null;
  const laterale = (m) => Math.abs(m.n.nx * fH.x + m.n.nz * fH.z);
  const candidati = muri.filter((m) => m.presente && m.n.L >= 1.4 && laterale(m) < 0.75 && !mobiliVicino(m)).sort((a, b) => laterale(a) - laterale(b));
  for (const m of candidati) {
    // a metà tra il fotografo e la cucina, dentro il muro
    const M = C.clone().add(cam.position.clone().setY(0)).multiplyScalar(0.5);
    const w = Math.min(1.5, m.n.L - 0.6);
    let t = (M.x - m.a.x) * m.n.ux + (M.z - m.a.z) * m.n.uz;
    t = Math.max(0.3 + w / 2, Math.min(m.n.L - 0.3 - w / 2, t));
    finestra = {
      pos: new THREE.Vector3(m.a.x + m.n.ux * t + m.n.nx * 0.004, finY, m.a.z + m.n.uz * t + m.n.nz * 0.004),
      n: new THREE.Vector3(m.n.nx, 0, m.n.nz), w, nelMuro: true,
    };
    break;
  }
  if (!finestra) {
    const est = Math.abs(dx.x) * (box.max.x - box.min.x) / 2 + Math.abs(dx.z) * (box.max.z - box.min.z) / 2;
    for (const s of [-1, 1]) {
      const p = C.clone().addScaledVector(dx, s * (est + 1.4)).addScaledVector(fH, -0.9); p.y = finY;
      for (let i = 0; i < 8 && inQuadro(p); i++) p.addScaledVector(dx, s * 0.5);
      const bloccata = muri.some((m) => m.presente && siIncrociano({ x: C.x, z: C.z }, { x: p.x, z: p.z }, m.a, m.b));
      if (bloccata || inQuadro(p)) continue;
      finestra = { pos: p, n: C.clone().setY(finY).sub(p).setY(0).normalize(), w: 1.5, nelMuro: false };
      break;
    }
  }
  if (!finestra) {                               // tutto chiuso: luce alle spalle del fotografo, dall'alto
    const p = cam.position.clone().addScaledVector(fH, -0.6); p.y = Math.min(hStanza - 0.2, cam.position.y + 0.6);
    finestra = { pos: p, n: C.clone().setY(1).sub(p).normalize(), w: 1.5, nelMuro: false };
  }
  const luceFin = new THREE.RectAreaLight(0xfffdf9, opz.finestra ?? 26, finestra.w, finH);
  luceFin.position.copy(finestra.pos);
  luceFin.lookAt(finestra.pos.clone().add(finestra.n));
  scena.add(luceFin);
  if (finestra.nelMuro) {
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
    const vecchio = s.material;
    s.material = new THREE.MeshStandardMaterial({ color: 0x202020, emissive: col, emissiveIntensity: 2.2, roughness: 0.6 });
    ripristina.push(() => { s.material.dispose(); s.material = vecchio; });
  }
  scena.updateMatrixWorld(true);
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
      while (pt.samples < campioni) {
        if (opz.annullato && opz.annullato()) break;
        pt.renderSample();
        if (performance.now() - ultimoDisegno > 700 && pt.samples >= 1) {
          anteprima(); ultimoDisegno = performance.now();
          avvisa(Math.min(1, pt.samples / campioni) * 0.9, tela, { fase: 'luce', campioni: Math.floor(pt.samples), totale: campioni });
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (pt.samples >= 1) {
        anteprima();
        avvisa(0.9, tela, { fase: 'pulizia' });
        // la luce calcolata (lineare, senza curva)
        const colore = new Float32Array(W * H * 4);
        renderer.readRenderTargetPixels(pt.target, 0, 0, W, H, colore);
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
          try { pulita = filtroGuidato(renderer, texColore, aux, W, H); } catch (e) { console.warn('Filtro guidato non riuscito:', e); pulita = null; }
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
    cielo.dispose();
    stanza.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of [matMuro, matSoffitto, matTelaio, matDavanzale, matBattiscopa, matPav]) m.dispose();
    tPav.dispose();
    if (matPav.normalMap) matPav.normalMap.dispose();
    if (matPav.roughnessMap) matPav.roughnessMap.dispose();
    for (const f of ripristina.reverse()) { try { f(); } catch (_) { /* avanti */ } }
    // la scena torna nella vista 3D
    if (padre) { padre.add(radice); if (indice >= 0) { padre.children.splice(padre.children.indexOf(radice), 1); padre.children.splice(indice, 0, radice); } }
    else involucro.remove(radice);
    radice.updateMatrixWorld(true);
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* niente */ }
    avvisa(1, null, { fase: 'fine' });
  }
  return risultato;
}
