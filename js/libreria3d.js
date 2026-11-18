// =============================================================================
// LIBRERIA 3D — prodotti veri in 3D per arredare la cucina: luci, sgabelli,
// tavoli e sedie, vasi, quadri. Modelli: Amazon Berkeley Objects © Amazon.com,
// licenza CC BY 4.0 (texture ridotte per il web) — dati e crediti in libreria3d-dati.js.
//
// Ogni modello si carica UNA volta (oggetti/libreria/<id>.glb), si porta in mm con
// le trasformazioni "cotte" nella geometria, centrato in x/z e appoggiato a y = 0.
// LAMPADE: il corpo (paralumi, globi) col fondo a 165 cm da terra e il rosone al
// SOFFITTO (270 cm): i cavi / steli in mezzo si allungano o si accorciano (solo in
// altezza: lo spessore resta quello vero). Plafoniere: attaccate al soffitto.
// TAVOLI: il piano è una superficie d'appoggio (un vaso ci si posa sopra).
// =============================================================================
import * as THREE from 'three';
import { LIBRERIA } from './libreria3d-dati.js?v=20261119p';

export { LIBRERIA, GRUPPI_OGGETTI, CREDITI_LIBRERIA } from './libreria3d-dati.js?v=20261119p';
export const SOFFITTO = 2700, Y_LAMPADA = 1650, Y_QUADRO = 1550;

const qui = (p) => new URL(p, import.meta.url).href;
let _caricatore = null;
function caricatore() {
  if (!_caricatore) _caricatore = import('../vendor/three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader());
  return _caricatore;
}

/** Il modello in mm (k = correzione di scala), un pezzo per mesh, centrato e appoggiato a y = 0. */
function inMillimetri(scena, k = 1) {
  scena.updateMatrixWorld(true);
  const S = new THREE.Matrix4().makeScale(1000 * k, 1000 * k, 1000 * k), g = new THREE.Group();
  scena.traverse((o) => {
    if (!o.isMesh) return;
    const M = new THREE.Matrix4().multiplyMatrices(S, o.matrixWorld);
    const geo = o.geometry.clone().applyMatrix4(M);
    // una trasformazione "specchiata" rovescia le facce: si rigirano
    if (M.determinant() < 0 && geo.index) { const a = geo.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) for (const t of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) if (m[t]) m[t].anisotropy = 8;
    g.add(new THREE.Mesh(geo, o.material));
  });
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3());
  for (const m of g.children) m.geometry.translate(-c.x, -b.min.y, -c.z);
  return g;
}

/** LAMPADA a sospensione: corpo a 165 cm, rosone al soffitto (altezza scelta), cavi della lunghezza giusta. */
function appendi(g, voce, SOFFITTO) {
  const H = new THREE.Box3().setFromObject(g).max.y;
  if (voce.tipo === 'soffitto') { for (const m of g.children) m.geometry.translate(0, SOFFITTO - H, 0); return; }
  const [yS, yC] = voce.cavo || [H, H];
  const rosone = H - yC;
  // un lampadario molto alto sale (almeno 10 cm di cavo sotto il rosone)
  const y0 = Math.min(Y_LAMPADA, SOFFITTO - rosone - 100 - yS);
  const k = yC > yS ? (SOFFITTO - rosone - (y0 + yS)) / (yC - yS) : 1;
  for (const m of g.children) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setY(i, y <= yS ? y0 + y : y >= yC ? SOFFITTO - (H - y) : y0 + yS + (y - yS) * k);
    }
    p.needsUpdate = true; m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
  }
  if (!voce.cavo) {
    // nessun cavo nel modello: uno nero, dal centro del corpo al soffitto
    const l = SOFFITTO - (y0 + H);
    if (l > 5) {
      const filo = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, l, 10), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
      filo.position.y = y0 + H + l / 2; g.add(filo);
    }
  }
}

const _pronti = new Map();
const eLuce = (voce) => !!voce && (voce.tipo === 'appeso' || voce.tipo === 'soffitto');
/** Il modello pronto (una volta sola; le lampade una volta per altezza del soffitto), con le misure vere in userData.dim. */
export function creaLibreria(id, soffitto = SOFFITTO) {
  const voce = LIBRERIA.find((v) => v.id === id), chiave = eLuce(voce) ? `${id}|${soffitto}` : id;
  if (!_pronti.has(chiave)) {
    const p = !voce ? Promise.reject(new Error('oggetto sconosciuto')) : caricatore()
      .then((gl) => gl.loadAsync(qui(`../oggetti/libreria/${id}.glb`)))
      .then((gltf) => {
        const g = inMillimetri(gltf.scene, voce.scala || 1);
        const luce = voce.tipo === 'appeso' || voce.tipo === 'soffitto';
        if (luce) appendi(g, voce, soffitto);
        g.traverse((x) => { if (x.isMesh) { x.castShadow = !luce; x.receiveShadow = !luce; if (luce) x.userData.senzaOmbra = true; } });
        const b = new THREE.Box3().setFromObject(g);
        if (voce.tavolo) {
          // il piano del tavolo: superficie d'appoggio invisibile (per vasi e fruttiere)
          const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
          const piano = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 2, d * 0.94), new THREE.MeshBasicMaterial({ visible: false }));
          piano.position.y = b.max.y - 1; piano.userData.appoggio = true; g.add(piano);
        }
        g.userData.dim = { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z };
        return g;
      });
    p.catch(() => _pronti.delete(chiave));
    _pronti.set(chiave, p);
  }
  return _pronti.get(chiave);
}

const _fatti = new Map();
/** In CUCINA: l'oggetto alle misure scelte; null finché non è pronto (poi quandoPronto()). */
export function oggettoLibreria(id, misure, quandoPronto, soffitto = SOFFITTO) {
  const voce = LIBRERIA.find((v) => v.id === id), luce = eLuce(voce), chiave = luce ? `${id}|${soffitto}` : id;
  const t = _fatti.get(chiave);
  if (t && t !== 'attesa' && t !== 'errore') {
    const g = t.clone(true), m0 = voce ? voce.misure : null;
    // le lampade non si "schiacciano" in altezza: la fa il soffitto
    if (misure && m0) g.scale.set((misure.w || m0.w) / m0.w, luce ? 1 : (misure.h || m0.h) / m0.h, (misure.d || m0.d) / m0.d);
    return g;
  }
  if (!t) {
    _fatti.set(chiave, 'attesa');
    creaLibreria(id, soffitto).then((g) => { _fatti.set(chiave, g); if (quandoPronto) quandoPronto(); }).catch(() => _fatti.set(chiave, 'errore'));
  }
  return null;
}
