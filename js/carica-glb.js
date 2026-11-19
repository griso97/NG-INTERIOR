// =============================================================================
// CARICA I MODELLI 3D (.glb) — anche quelli LEGGERI (compressi): geometria compressa con
// meshopt e numeri «stretti» (quantizzati), texture WebP. Il decodificatore (vendor/meshopt,
// ~25 KB) si scarica solo la prima volta che serve un modello.
// =============================================================================
import * as THREE from 'three';

let _caricatore = null;
/** Il caricatore glTF, pronto per i modelli compressi (uno solo per tutto il programma). */
export function caricatoreGLB() {
  if (!_caricatore) {
    _caricatore = Promise.all([
      import('../vendor/three/addons/loaders/GLTFLoader.js'),
      import('../vendor/meshopt/meshopt_decoder.module.js'),
    ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => {
      const l = new GLTFLoader();
      l.setMeshoptDecoder(MeshoptDecoder);
      return l;
    });
    _caricatore.catch(() => { _caricatore = null; });
  }
  return _caricatore;
}

/**
 * I numeri «stretti» (interi compressi) della geometria tornano numeri normali: il programma
 * sposta e misura i punti (mm, altezza dal soffitto, cavi) e con gli interi andrebbero fuori scala.
 * La memoria resta come prima della compressione; il guadagno è nello scaricare.
 */
export function numeriNormali(scena) {
  scena.traverse((o) => {
    const g = o.isMesh && o.geometry;
    if (!g) return;
    for (const nome of Object.keys(g.attributes)) {
      const a = g.attributes[nome];
      if (!a.isInterleavedBufferAttribute && a.array instanceof Float32Array) continue;
      const n = a.count, s = a.itemSize, f = new Float32Array(n * s);
      for (let i = 0; i < n; i++) {
        f[i * s] = a.getX(i);
        if (s > 1) f[i * s + 1] = a.getY(i);
        if (s > 2) f[i * s + 2] = a.getZ(i);
        if (s > 3) f[i * s + 3] = a.getW(i);
      }
      g.setAttribute(nome, new THREE.BufferAttribute(f, s));
    }
  });
  return scena;
}

/** Carica un .glb e lo restituisce con i numeri normali. */
export async function caricaGLB(url) {
  const gl = await (await caricatoreGLB()).loadAsync(url);
  numeriNormali(gl.scene);
  return gl;
}
