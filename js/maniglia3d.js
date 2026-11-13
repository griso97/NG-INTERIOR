// =============================================================================
// MANIGLIE 3D: modelli VERI per tipo (barra, piatta, profilo, pomolo, incasso,
// a bordo), con la misura e la finitura (inox, nero, oro…) della maniglia.
// =============================================================================
// La foto serve per riconoscere la finitura (colore) e per l'anteprima nel
// catalogo; la forma 3D è un modello pulito, così il risultato è sempre
// realistico qualunque foto carichi il cliente (anche storta o con sfondo).
// Assi (mm): x = lunghezza (−L/2..L/2) · y = altezza · z = sporgenza (0 = anta)
// =============================================================================
import * as THREE from 'three';

export const FORME_MANIGLIA = [
  { id: 'barra', nome: 'Barra tonda', svg: '<svg viewBox="0 0 48 24"><line x1="6" y1="9" x2="42" y2="9" stroke-width="5" stroke-linecap="round"/><line x1="12" y1="9" x2="12" y2="19"/><line x1="36" y1="9" x2="36" y2="19"/></svg>' },
  { id: 'piatta', nome: 'Barra piatta', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="6" rx="1"/><line x1="12" y1="12" x2="12" y2="19"/><line x1="36" y1="12" x2="36" y2="19"/></svg>' },
  { id: 'profilo', nome: 'Profilo (a J)', svg: '<svg viewBox="0 0 48 24"><polyline points="6,20 6,6 42,6 42,20" fill="none"/><line x1="6" y1="6" x2="6" y2="2"/><line x1="42" y1="6" x2="42" y2="2"/></svg>' },
  { id: 'bordo', nome: 'A bordo anta', svg: '<svg viewBox="0 0 48 24"><rect x="12" y="4" width="24" height="5"/><rect x="12" y="9" width="24" height="9" fill="none"/></svg>' },
  { id: 'pomolo', nome: 'Pomolo', svg: '<svg viewBox="0 0 48 24"><circle cx="24" cy="12" r="8"/></svg>' },
  { id: 'incasso', nome: 'Incasso (conchiglia)', svg: '<svg viewBox="0 0 48 24"><rect x="10" y="6" width="28" height="12" rx="5" fill="none"/><rect x="14" y="9" width="20" height="6" rx="3"/></svg>' },
];

export const FINITURE_MANIGLIA = [
  { id: 'inox', nome: 'Acciaio inox', colore: 0xc5c8cc, metal: 0.9, rough: 0.28 },
  { id: 'alluminio', nome: 'Alluminio', colore: 0xb9bcc0, metal: 0.75, rough: 0.42 },
  { id: 'nero', nome: 'Nero opaco', colore: 0x1c1c1c, metal: 0.35, rough: 0.5 },
  { id: 'antracite', nome: 'Antracite / titanio', colore: 0x4a4c50, metal: 0.8, rough: 0.35 },
  { id: 'oro', nome: 'Oro / ottone', colore: 0xc9a65c, metal: 0.92, rough: 0.28 },
  { id: 'bronzo', nome: 'Bronzo', colore: 0x6f5238, metal: 0.85, rough: 0.38 },
  { id: 'rame', nome: 'Rame', colore: 0xb2704a, metal: 0.9, rough: 0.3 },
  { id: 'bianco', nome: 'Bianco', colore: 0xeeeeec, metal: 0.05, rough: 0.4 },
];

/** Finitura più vicina a un colore (dalla foto). */
export function finituraVicina(col) {
  if (col == null) return 'inox';
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
  // grigi: dalla luminosità (la foto di un metallo lucido è spesso più scura o più chiara)
  if (sat < 28) return l < 55 ? 'nero' : l < 115 ? 'antracite' : l > 225 ? 'bianco' : l > 175 ? 'inox' : 'alluminio';
  let best = 'inox', bd = Infinity;
  for (const f of FINITURE_MANIGLIA) {
    const fr = (f.colore >> 16) & 255, fg = (f.colore >> 8) & 255, fb = f.colore & 255;
    const d = (r - fr) ** 2 * 0.3 + (g - fg) ** 2 * 0.59 + (b - fb) ** 2 * 0.11;
    if (d < bd) { bd = d; best = f.id; }
  }
  return best;
}

/** Forma proposta dalla sagoma della foto (rapporto lato corto / lato lungo). */
export function formaDaRapporto(rapporto) {
  if (rapporto > 0.6) return 'pomolo';
  return 'barra';
}

const _mat = new Map();
export function materialeFinitura(id) {
  if (_mat.has(id)) return _mat.get(id);
  const f = FINITURE_MANIGLIA.find((x) => x.id === id) || FINITURE_MANIGLIA[0];
  const m = new THREE.MeshStandardMaterial({ color: f.colore, metalness: f.metal, roughness: f.rough, envMapIntensity: f.metal > 0.5 ? 1.0 : 0.4 });
  _mat.set(id, m);
  return m;
}
const matOmbra = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9, metalness: 0 });

/** Cilindro lungo l'asse x. */
function barraX(L, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 24), mat);
  m.rotation.z = Math.PI / 2; return m;
}
/** Piedino (cilindro lungo z) da z=0 a z=h. */
function piedino(x, r, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, 0, h / 2); return m;
}
function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}

/**
 * Maniglia 3D pronta, centrata in (0,0) sulla faccia dell'anta (z = 0).
 * forma: id di FORME_MANIGLIA · finitura: id di FINITURE_MANIGLIA · L: lunghezza mm.
 * Per profilo / a bordo il lato "bordo anta" è in alto (+y).
 */
export function costruisciManiglia(forma, finitura, L) {
  const mat = materialeFinitura(finitura);
  const g = new THREE.Group();
  L = Math.max(20, L || 160);
  const inter = Math.max(L * 0.5, L - Math.max(24, L * 0.18));     // interasse dei piedini
  switch (forma) {
    case 'piatta': {
      const T = 6, H = Math.max(10, Math.min(16, L * 0.08)), sp = 26;
      g.add(box(L, H, T, 0, 0, sp + T / 2, mat));
      for (const s of [-inter / 2, inter / 2]) g.add(box(Math.min(10, H), Math.min(8, H * 0.7), sp, s, 0, sp / 2, mat));
      break;
    }
    case 'profilo': {
      // profilo in alluminio a J sul bordo dell'anta: piastra + labbro che sporge e scende
      const t = 2;
      g.add(box(L, 38, t, 0, -2, t / 2, mat));                // piastra sull'anta
      g.add(box(L, t, 22, 0, 17, 11, mat));                    // labbro sopra (sporge)
      g.add(box(L, 14, t, 0, 11, 22 - t / 2, mat));            // davanti che scende
      g.add(box(L, 12, 18, 0, 10, 11.5, matOmbra));            // ombra dentro la presa
      break;
    }
    case 'bordo': {
      // maniglia a bordo: aletta sul davanti dell'anta che gira sopra il bordo
      const t = 2.5;
      g.add(box(L, 30, t, 0, -4, t / 2, mat));
      g.add(box(L, t, 26, 0, 11, 13, mat));
      g.add(box(L, 12, t, 0, 5, 26, mat));
      break;
    }
    case 'pomolo': {
      const D = Math.max(18, Math.min(L, 45));
      g.add(piedino(0, Math.max(5, D * 0.22), 20, mat));
      const testa = new THREE.Mesh(new THREE.SphereGeometry(D / 2, 28, 18), mat);
      testa.scale.set(1, 1, 0.55); testa.position.set(0, 0, 20 + D * 0.25); g.add(testa);
      break;
    }
    case 'incasso': {
      // conchiglia a filo anta: cornice metallica + fondo scuro
      const H = Math.max(28, Math.min(48, L * 0.3)), c = 4, sp = 2;
      g.add(box(L, c, sp, 0, H / 2 - c / 2, sp / 2, mat));
      g.add(box(L, c, sp, 0, -H / 2 + c / 2, sp / 2, mat));
      g.add(box(c, H, sp, -L / 2 + c / 2, 0, sp / 2, mat));
      g.add(box(c, H, sp, L / 2 - c / 2, 0, sp / 2, mat));
      g.add(box(L - 2 * c, H - 2 * c, 1, 0, 0, 0.6, matOmbra));
      g.add(box(L - 2 * c, (H - 2 * c) * 0.45, 1.2, 0, (H - 2 * c) * 0.27, 0.9, mat));   // labbro di presa
      break;
    }
    default: {   // barra tonda a ponte
      const r = Math.max(5, Math.min(7, L * 0.04)), sp = 30;
      g.add((() => { const b = barraX(L, r, mat); b.position.z = sp + r; return b; })());
      for (const s of [-inter / 2, inter / 2]) g.add(piedino(s, r * 0.8, sp + r, mat));
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
