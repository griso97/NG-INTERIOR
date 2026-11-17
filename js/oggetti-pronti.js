// =============================================================================
// OGGETTI 3D PRONTI — NG INTERIOR
// Vasi, piante, frutta, stoviglie, luci, decorazioni, sedie… già fatti in 3D da
// professionisti, dalla libreria Poly Haven: licenza CC0 (liberi anche per uso
// commerciale) e collegamento gratuito anche per uso commerciale. Poly Haven chiede
// solo che sia chiaro che gli oggetti vengono da loro: lo scriviamo (CREDITO).
// Gli oggetti sono in scala vera (misure in mm) e con i materiali realistici.
// =============================================================================
import * as THREE from 'three';

const API = 'https://api.polyhaven.com';
export const CREDITO = 'Oggetti 3D da Poly Haven (polyhaven.com) · licenza CC0';
export const miniatura = (id) => `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=256`;

/** Le categorie utili per arredare (le altre — armi, veicoli, rocce, attrezzi… — non si mostrano). */
export const CATEGORIE = [
  { id: 'vasi', nome: 'Vasi', cat: ['Decor & Art/Vases & Vessels'] },
  { id: 'piante', nome: 'Piante e fiori', cat: ['Nature/Plants'] },
  { id: 'cibo', nome: 'Frutta e cibo', cat: ['Food & Kitchen/Produce', 'Food & Kitchen/Prepared Food', 'Food & Kitchen/Drinks', 'Food & Kitchen/Packaged & Pantry'] },
  { id: 'cucina', nome: 'Cucina', cat: ['Food & Kitchen/Tableware', 'Food & Kitchen/Cookware', 'Electronics & Appliances/Home Appliances', 'Containers & Storage/Cans, Tins & Bottles', 'Containers & Storage/Baskets & Buckets'] },
  { id: 'luci', nome: 'Luci', cat: ['Lighting/Portable', 'Lighting/Ceiling', 'Lighting/Wall', 'Lighting/Floor & Desk', 'Lighting/Bulbs & Fittings'] },
  { id: 'decor', nome: 'Decorazioni', cat: ['Decor & Art/Sculptures & Figurines', 'Decor & Art/Ornaments', 'Decor & Art/Wall Decor', 'Electronics & Appliances/Clocks & Timepieces', 'Office & Stationery/Books & Documents'] },
  { id: 'sedie', nome: 'Sedie e sgabelli', cat: ['Furniture/Seating'] },
  { id: 'tavoli', nome: 'Tavoli', cat: ['Furniture/Tables'] },
];
const ESCLUSE = ['Weapons', 'Vehicles & Transport', 'Industrial & Infrastructure', 'Nature/Rocks', 'Nature/Logs', 'Nature/Trees', 'Nature/Ground', 'Architecture', 'Tools & Equipment', 'Apparel & Personal Items/Mobility'];

/** Le parole cercate in italiano o in spagnolo → le parole della libreria (inglese). */
const PAROLE = {
  vaso: 'vase vessel', vasi: 'vase vessel', jarron: 'vase', florero: 'vase',
  pianta: 'plant', piante: 'plant', planta: 'plant', plantas: 'plant', fiore: 'flower', fiori: 'flower', flor: 'flower', flores: 'flower',
  cactus: 'cactus succulent', succulenta: 'succulent', grassa: 'succulent',
  frutta: 'fruit produce', fruta: 'fruit produce', mela: 'apple', mele: 'apple', manzana: 'apple', banana: 'banana', banane: 'banana', platano: 'banana',
  limone: 'lemon', limoni: 'lemon', limon: 'lemon', arancia: 'orange', naranja: 'orange', pane: 'bread bun', pan: 'bread bun', cibo: 'food', comida: 'food',
  verdura: 'vegetable produce', zucca: 'pumpkin', calabaza: 'pumpkin', avocado: 'avocado', aguacate: 'avocado', kiwi: 'kiwi',
  bollitore: 'kettle', hervidor: 'kettle', microonde: 'microwave', microondas: 'microwave', tostapane: 'toaster', tostadora: 'toaster',
  caffe: 'coffee', cafe: 'coffee', caffettiera: 'coffee pot', cafetera: 'coffee pot',
  pentola: 'pot cookware', pentole: 'pot cookware', olla: 'pot cookware', padella: 'pan cookware', sarten: 'pan cookware',
  tagliere: 'cutting board', tabla: 'board', ciotola: 'bowl', cuenco: 'bowl', piatto: 'plate', plato: 'plate', piatti: 'plate',
  tazza: 'cup mug', tazze: 'cup mug', taza: 'cup mug', bicchiere: 'glass', bicchieri: 'glass', copa: 'glass goblet',
  bottiglia: 'bottle', bottiglie: 'bottle', botella: 'bottle', barattolo: 'jar tin can', tarro: 'jar', teiera: 'teapot tea', tetera: 'teapot tea',
  cesto: 'basket', cestino: 'basket', cesta: 'basket', secchio: 'bucket', cubo: 'bucket',
  lampada: 'lamp', lampade: 'lamp', lampara: 'lamp', luce: 'light lamp', luz: 'light lamp', lampadario: 'chandelier ceiling', candela: 'candle', candele: 'candle', vela: 'candle',
  lanterna: 'lantern', farol: 'lantern', orologio: 'clock', reloj: 'clock', libro: 'book', libri: 'book', libros: 'book',
  quadro: 'frame painting picture', cuadro: 'frame painting picture', statua: 'statue sculpture figurine', estatua: 'statue sculpture', statuina: 'figurine',
  specchio: 'mirror', espejo: 'mirror', radio: 'radio', telefono: 'telephone phone', televisore: 'tv television', tv: 'tv television',
  sedia: 'chair', sedie: 'chair', silla: 'chair', sgabello: 'stool', sgabelli: 'stool', taburete: 'stool', poltrona: 'armchair', sillon: 'armchair',
  divano: 'sofa couch', sofa: 'sofa couch', tavolo: 'table', tavolino: 'table', mesa: 'table', panca: 'bench', banco: 'bench',
  legno: 'wood wooden', madera: 'wood wooden', ottone: 'brass', laton: 'brass', ceramica: 'ceramic', vetro: 'glass', vidrio: 'glass', metallo: 'metal', metal: 'metal',
  bianco: 'white', blanco: 'white', nero: 'black', negro: 'black', rosso: 'red', rojo: 'red', verde: 'green', blu: 'blue', azul: 'blue',
  antico: 'antique vintage', antiguo: 'antique vintage', moderno: 'modern',
};
const senzaAccenti = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let _elenco = null;
/** Tutti gli oggetti della libreria (una volta sola, poi in memoria). */
export async function elenco() {
  if (_elenco) return _elenco;
  _elenco = (async () => {
    let dati = null;
    let cache = null;
    try { cache = await caches.open('ng-oggetti-pronti'); } catch (_) { /* niente cache */ }
    const url = `${API}/assets?type=models`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      if (cache) { try { await cache.put(url, r.clone()); } catch (_) { /* pazienza */ } }
      dati = await r.json();
    } catch (e) {
      const vecchia = cache ? await cache.match(url) : null;      // senza rete: l'ultimo elenco scaricato
      if (!vecchia) throw e;
      dati = await vecchia.json();
    }
    return Object.entries(dati).map(([id, v]) => ({
      id, nome: v.name || id, categoria: v.category || '', tag: v.tags || [], gruppi: v.categories || [],
      dim: Array.isArray(v.dimensions) && v.dimensions.length === 3 ? { w: v.dimensions[0], d: v.dimensions[1], h: v.dimensions[2] } : null,
      popolare: v.download_count || 0,
      // nome, etichette e categorie (non la descrizione lunga: troppe parole a caso)
      testo: ` ${senzaAccenti(`${v.name} ${(v.tags || []).join(' ')} ${(v.categories || []).join(' ')} ${v.category || ''}`).replace(/[^a-z0-9]+/g, ' ')} `,
    })).filter((o) => !ESCLUSE.some((e) => o.categoria.startsWith(e)));
  })();
  _elenco.catch(() => { _elenco = null; });
  return _elenco;
}

/** Cerca: testo libero (italiano / spagnolo / inglese) e/o una categoria. I più usati prima. */
export async function cerca(testo = '', categoria = null) {
  const tutti = await elenco();
  const cat = CATEGORIE.find((c) => c.id === categoria);
  let lista = cat ? tutti.filter((o) => cat.cat.some((c) => o.categoria.startsWith(c))) : tutti;
  const parole = senzaAccenti(testo).split(/[^a-z0-9]+/).filter((p) => p.length > 1);
  if (parole.length) {
    const sinonimi = parole.map((p) => [p, ...(PAROLE[p] ? PAROLE[p].split(' ') : [])]);
    // parole INTERE (anche al plurale inglese): «cup» non deve trovare «cupped»
    const c = (o, a) => o.testo.includes(` ${a} `) || o.testo.includes(` ${a}s `) || o.testo.includes(` ${a}es `);
    const punti = (o) => sinonimi.reduce((s, alt) => s + (alt.some((a) => c(o, a)) ? 1 : 0), 0);
    lista = lista.map((o) => ({ o, p: punti(o) })).filter((x) => x.p === parole.length).map((x) => x.o);
  }
  return [...lista].sort((a, b) => b.popolare - a.popolare);
}

// ------------------------------------------------------------------ il 3D ----
const _modelli = new Map();
/** Il modello 3D (in mm, base a terra, centrato), dalla libreria. Si scarica una volta sola. */
export function caricaModello(id, ris = '1k') {
  const chiave = `${id}|${ris}`;
  if (!_modelli.has(chiave)) {
    const p = (async () => {
      const f = await (await fetch(`${API}/files/${encodeURIComponent(id)}`)).json();
      const tutte = f.gltf || {};
      const g = tutte[ris] || tutte['1k'] || tutte['2k'] || Object.values(tutte)[0];
      const voce = g && g.gltf; if (!voce || !voce.url) throw new Error('modello non disponibile');
      const { GLTFLoader } = await import('../vendor/three/addons/loaders/GLTFLoader.js');
      const man = new THREE.LoadingManager();
      const inc = Object.entries(voce.include || {});
      // il file del modello cerca .bin e texture accanto a sé: la libreria li tiene altrove
      man.setURLModifier((u) => { const dec = decodeURI(u); for (const [k, v] of inc) if (dec.endsWith(k)) return v.url; return u; });
      const gltf = await new GLTFLoader(man).loadAsync(voce.url);
      const sc = gltf.scene;
      sc.scale.setScalar(1000);                                 // la libreria è in metri, il sito in mm
      sc.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sc), c = box.getCenter(new THREE.Vector3());
      sc.position.set(-c.x, -box.min.y, -c.z);                  // centrato, appoggiato a terra
      const gruppo = new THREE.Group(); gruppo.add(sc);
      gruppo.userData.dim = { w: box.max.x - box.min.x, h: box.max.y - box.min.y, d: box.max.z - box.min.z };
      gruppo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return gruppo;
    })();
    p.catch(() => _modelli.delete(chiave));
    _modelli.set(chiave, p);
  }
  return _modelli.get(chiave);
}

const _pronti = new Map();
/**
 * In CUCINA: l'oggetto pronto alle misure scelte (mm). Se non è ancora scaricato ritorna
 * null, lo scarica e chiama quandoPronto() (come gli oggetti fatti dalle foto).
 */
export function oggettoPronto(def, misure, quandoPronto) {
  const id = def && def.pronto && def.pronto.id; if (!id) return null;
  const t = _pronti.get(id);
  if (t && t !== 'attesa' && t !== 'errore') {
    const g = t.clone(true), d = t.userData.dim;
    if (misure && d && d.w > 0 && d.h > 0 && d.d > 0) g.scale.set((misure.w || d.w) / d.w, (misure.h || d.h) / d.h, (misure.d || d.d) / d.d);
    return g;
  }
  if (!t) {
    _pronti.set(id, 'attesa');
    caricaModello(id).then((m) => { _pronti.set(id, m); if (quandoPronto) quandoPronto(); }).catch(() => _pronti.set(id, 'errore'));
  }
  return null;
}

/** ANTEPRIMA 3D di un oggetto pronto in un riquadro (gira da solo, si può ruotare). Ritorna la funzione per chiuderla. */
export async function anteprimaPronto(box, id) {
  const { OrbitControls } = await import('../vendor/three/addons/controls/OrbitControls.js');
  const modello = await caricaModello(id);
  box.innerHTML = '';
  const LW = Math.min(box.clientWidth || 320, 520), LH = Math.round(LW * 0.75);
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(LW, LH);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  box.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xeae7e1);
  sc.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.4));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, 2, 3); sc.add(dl);
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color(0x8d8a84);
  for (const [x, y, z, w, h] of [[0, 6, 0, 8, 8], [-7, 2, 3, 2, 5], [7, 3, -2, 3, 4], [0, 2, 8, 6, 2]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    pl.position.set(x, y, z); pl.lookAt(0, 0, 0); env.add(pl);
  }
  sc.environment = pm.fromScene(env, 0.04).texture;
  const m = modello.clone(true); sc.add(m);
  const { w, d, h } = modello.userData.dim;
  const piano = new THREE.Mesh(new THREE.BoxGeometry(w * 1.6 + 200, 20, d * 1.6 + 200), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.7 }));
  piano.position.y = -10; sc.add(piano);
  const cam = new THREE.PerspectiveCamera(30, LW / LH, 1, 50000);
  const R = Math.max(w, d, h) * 2.6;
  cam.position.set(R * 0.45, h * 0.5 + R * 0.25, R * 0.85);
  const ctr = new OrbitControls(cam, r.domElement); ctr.target.set(0, h / 2, 0); ctr.enablePan = false; ctr.autoRotate = true; ctr.autoRotateSpeed = 2;
  let vivo = true;
  const giro = () => { if (!vivo) return; ctr.update(); r.render(sc, cam); requestAnimationFrame(giro); };
  giro();
  return () => { vivo = false; ctr.dispose(); r.dispose(); pm.dispose(); };
}
