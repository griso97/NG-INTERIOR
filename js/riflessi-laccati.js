// =============================================================================
// RIFLESSI DEI LACCATI LUCIDI — la stessa ripresa in cucina, negli armadi e nei mobili modulari
// =============================================================================
// Nel lucido si deve VEDERE il riflesso, sennò sembra un opaco. Le ante lucide riflettono la
// STANZA VERA (pavimento, muri, mobili) ripresa a 360° davanti ai mobili, più una grande finestra
// luminosa alle spalle di chi guarda e due plafoniere: come nelle foto dei mobili laccati (righe
// di luce nette, il pavimento nelle ante basse). Il fondo della ripresa è più scuro (niente
// riflesso grigio uniforme che fa sembrare il nero un grigio).
// Si rifà solo quando la scena cambia e solo se ci sono ante laccate lucide.
// =============================================================================

import * as THREE from 'three';

const _riprese = new WeakMap();   // renderer → { rt, cam } (una ripresa per pagina)

/** Materiali laccati lucidi (clearcoat) dentro «radice», vetri esclusi. */
function lucidiDi(radice) {
  const lucidi = new Set();
  radice.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) if (m && m.isMeshPhysicalMaterial && m.clearcoat > 0 && !(m.userData && m.userData.vetro)) lucidi.add(m);
  });
  return lucidi;
}

/**
 * Riprende la stanza per i riflessi delle ante lucide dentro «radice».
 * centro: {x, z} centro dei mobili (mondo 3D, mm) · dir: {x, z} verso dove guardano le ante
 * largo: larghezza della composizione (mm) · altLuci: quota delle plafoniere (mm)
 */
export function riprendiRiflessiLaccati({ renderer, scene, radice, centro, dir, largo = 2000, altLuci = 2690 }) {
  if (!renderer || !scene || !radice) return false;
  const lucidi = lucidiDi(radice);
  if (!lucidi.size) return false;
  let rip = _riprese.get(renderer);
  if (!rip) {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rip = { rt, cam: new THREE.CubeCamera(10, 40000, rt) };
    _riprese.set(renderer, rip);
  }
  const d = dir || { x: 0, z: 1 };
  const cx = centro.x, cz = centro.z;
  const L = Math.max(2000, largo);
  rip.cam.position.set(cx + d.x * 1200, 1000, cz + d.z * 1200);
  // luci della ripresa: finestra di fronte ai mobili (alle spalle di chi guarda) e due plafoniere
  const extra = new THREE.Group();
  const pannello = (w, h, forza, x, y, z, guarda) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.95).multiplyScalar(forza), side: THREE.DoubleSide, toneMapped: false }));
    me.position.set(x, y, z); me.lookAt(guarda); extra.add(me);
  };
  const davanti = new THREE.Vector3(cx + d.x * 4200, 1500, cz + d.z * 4200);
  // finestra a due ante con i MONTANTI: nel lucido si specchia come strisce di luce alte e strette
  // (come nelle foto dei laccati veri), non come un blocco chiaro che sembra un altro colore
  for (const lato of [-1, 1]) for (const j of [-1, 0, 1]) {
    const o = lato * 900 + j * 420;
    pannello(320, 1700, 2.2, davanti.x - d.z * o, davanti.y, davanti.z + d.x * o, new THREE.Vector3(cx, 1500, cz));
  }
  for (const k of [-0.25, 0.25]) pannello(900, 300, 3, cx + d.x * 1600 - d.z * L * k, altLuci, cz + d.z * 1600 + d.x * L * k, new THREE.Vector3(cx + d.x * 1600 - d.z * L * k, 0, cz + d.z * 1600 + d.x * L * k));
  scene.add(extra);
  // le ante lucide non entrano nella loro stessa ripresa (si leggerebbe e scriverebbe la stessa immagine)
  const nascosti = [];
  radice.traverse((o) => {
    if (o.isMesh && o.visible && [].concat(o.material).some((m) => lucidi.has(m))) { o.visible = false; nascosti.push(o); }
  });
  const bg = scene.background, bgC = bg && bg.isColor ? bg.clone() : null;
  if (bgC) scene.background = bgC.clone().multiplyScalar(0.18);
  const autoClear = renderer.autoClear; renderer.autoClear = true;
  try { scene.add(rip.cam); rip.cam.update(renderer, scene); } finally {
    scene.remove(rip.cam); scene.remove(extra); renderer.autoClear = autoClear;
    if (bgC) scene.background = bg;
    for (const o of nascosti) o.visible = true;
    extra.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  rip.rt.texture.needsPMREMUpdate = true;
  // forza del riflesso: 1, oppure quella del materiale (userData.riflesso, es. il vetro nero dei forni)
  for (const m of lucidi) {
    const forza = m.userData && m.userData.riflesso != null ? m.userData.riflesso : 1;
    if (m.envMap !== rip.rt.texture || m.envMapIntensity !== forza) { m.envMap = rip.rt.texture; m.envMapIntensity = forza; m.needsUpdate = true; }
  }
  return true;
}
