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
import { FINITURE_MANIGLIA } from './finiture-maniglia.js?v=20261127j';

export const FORME_MANIGLIA = [
  { id: 'foto', nome: 'La mia forma (dalla foto)', svg: '<svg viewBox="0 0 48 24"><rect x="9" y="5" width="30" height="16" rx="3" fill="none"/><circle cx="24" cy="13" r="4.5" fill="none"/><rect x="17" y="2" width="9" height="4" rx="1"/></svg>' },
  { id: 'barra', nome: 'Barra tonda', svg: '<svg viewBox="0 0 48 24"><line x1="6" y1="9" x2="42" y2="9" stroke-width="5" stroke-linecap="round"/><line x1="12" y1="9" x2="12" y2="19"/><line x1="36" y1="9" x2="36" y2="19"/></svg>' },
  { id: 'piatta', nome: 'Barra piatta', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="6" rx="1"/><line x1="12" y1="12" x2="12" y2="19"/><line x1="36" y1="12" x2="36" y2="19"/></svg>' },
  { id: 'profilo', nome: 'Profilo (a J)', svg: '<svg viewBox="0 0 48 24"><polyline points="6,20 6,6 42,6 42,20" fill="none"/><line x1="6" y1="6" x2="6" y2="2"/><line x1="42" y1="6" x2="42" y2="2"/></svg>' },
  { id: 'bordol', nome: 'Profilo sul bordo (L dietro la porta)', svg: '<svg viewBox="0 0 48 24"><path d="M6 8 H38 Q42 8 42 11 V14" fill="none" stroke-width="3"/><line x1="6" y1="8" x2="6" y2="20" stroke-dasharray="2 2"/></svg>' },
  { id: 'bordo', nome: 'A bordo anta', svg: '<svg viewBox="0 0 48 24"><rect x="12" y="4" width="24" height="5"/><rect x="12" y="9" width="24" height="9" fill="none"/></svg>' },
  { id: 'pomolo', nome: 'Pomolo', svg: '<svg viewBox="0 0 48 24"><circle cx="24" cy="12" r="8"/></svg>' },
  { id: 'incasso', nome: 'Incasso (conchiglia)', svg: '<svg viewBox="0 0 48 24"><rect x="10" y="6" width="28" height="12" rx="5" fill="none"/><rect x="14" y="9" width="20" height="6" rx="3"/></svg>' },
  { id: 'ponteC', nome: 'Ponte squadrato «a C»', svg: '<svg viewBox="0 0 48 24"><path d="M7 20 V8 Q7 5 10 5 H38 Q41 5 41 8 V20" fill="none" stroke-width="4"/></svg>' },
  { id: 'ponteCpiatto', nome: 'Ponte piatto largo', svg: '<svg viewBox="0 0 48 24"><rect x="6" y="5" width="36" height="9" rx="1.5"/><rect x="6" y="14" width="3" height="6"/><rect x="39" y="14" width="3" height="6"/></svg>' },
  { id: 'trapezio', nome: 'Ponte a trapezio', svg: '<svg viewBox="0 0 48 24"><path d="M6 20 L13 6 H35 L42 20" fill="none" stroke-width="3.5"/></svg>' },
  { id: 'arco', nome: 'Ponte ad arco', svg: '<svg viewBox="0 0 48 24"><path d="M8 20 C9 2 39 2 40 20" fill="none" stroke-width="3.5"/></svg>' },
  { id: 'ovale', nome: 'Barra ovale', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="7" rx="3.5"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="36" y1="13" x2="36" y2="19"/></svg>' },
  { id: 'zigrinata', nome: 'Barra zigrinata', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="7" rx="3.5" fill="none"/><path d="M14 6 l4 7 M18 6 l4 7 M22 6 l4 7 M26 6 l4 7 M30 6 l4 7 M18 13 l4 -7 M22 13 l4 -7 M26 13 l4 -7 M30 13 l4 -7" fill="none" stroke-width="1"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="36" y1="13" x2="36" y2="19"/></svg>' },
  { id: 'quadra', nome: 'Barra quadra', svg: '<svg viewBox="0 0 48 24"><rect x="5" y="6" width="38" height="6"/><rect x="11" y="12" width="3" height="7"/><rect x="34" y="12" width="3" height="7"/></svg>' },
  { id: 'filo', nome: 'Filo piegato sottile', svg: '<svg viewBox="0 0 48 24"><path d="M8 20 V10 Q8 6 12 6 H36 Q40 6 40 10 V20" fill="none" stroke-width="2"/></svg>' },
  { id: 'pomoloq', nome: 'Pomolo quadrato', svg: '<svg viewBox="0 0 48 24"><rect x="15" y="3" width="18" height="18" rx="4"/></svg>' },
  { id: 'conchiglia', nome: 'Conchiglia applicata', svg: '<svg viewBox="0 0 48 24"><rect x="8" y="4" width="32" height="16" rx="3" fill="none"/><path d="M11 12 Q24 2 37 12 Z"/></svg>' },
  { id: 'pelle', nome: 'Maniglia in pelle', svg: '<svg viewBox="0 0 48 24"><path d="M6 18 H12 Q16 6 24 6 Q32 6 36 18 H42" fill="none" stroke-width="4"/><circle cx="9" cy="18" r="1.6"/><circle cx="39" cy="18" r="1.6"/></svg>' },
];

// i COLORI stanno in finiture-maniglia.js (li usano anche la distinta e i pannelli, senza 3D)
export { FINITURE_MANIGLIA };

/** "Colore della foto": la maniglia tiene i colori veri delle foto. */
export const FINITURA_FOTO = { id: 'foto', nome: 'Colore della foto' };
/** Finitura reale (per la lucentezza): 'foto' / vuota → la più vicina al colore della foto. */
export function finituraReale(finitura, colore) {
  return !finitura || finitura === 'foto' || !FINITURE_MANIGLIA.some((f) => f.id === finitura) ? finituraVicina(colore) : finitura;
}

/** Finitura più vicina a un colore (dalla foto). */
export function finituraVicina(col) {
  if (col == null) return 'inox';
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
  // grigi: dalla luminosità (la foto di un metallo lucido è spesso più scura o più chiara)
  if (sat < 28) return l < 55 ? 'nero' : l < 115 ? 'antracite' : l > 225 ? 'bianco' : l > 175 ? 'inox' : 'alluminio';
  let best = 'inox', bd = Infinity;
  for (const f of FINITURE_MANIGLIA) {
    if (f.extra) continue;                       // i colori in più non cambiano il riconoscimento dalla foto
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

// ---- aiuti per le forme fatte a nastro, tondino, pelle… ----
const matCuoio = new THREE.MeshStandardMaterial({ color: 0x7b4a2b, roughness: 0.72, metalness: 0, envMapIntensity: 0.35 });
/** Profilo piano (u, v = sporgenza) estruso in altezza H (asse y), centrato in y, appoggiato a z = 0. */
function estrusoInPianta(shape, H, bev, curve = 14) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, H - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: 3, curveSegments: curve });
  geo.rotateX(Math.PI / 2);                     // v → z (fuori dall'anta), estrusione → −y
  geo.translate(0, (H - 2 * bev) / 2, bev * 0.85);
  return geo;
}
/** Rettangolo con gli angoli arrotondati (centrato). */
function rettArr(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** Prisma con gli spigoli arrotondati, lungo l'asse 'x' o 'z' (sezione w × h). */
function prismaArr(w, h, len, r, asse, mat) {
  const geo = new THREE.ExtrudeGeometry(rettArr(w, h, r), { depth: len, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -len / 2);
  if (asse === 'x') geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}
/** Un quarto di cerchio nel piano xz (centro c, raggio r, da a0 ad a1). */
function quarto(c, r, a0, a1) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = a0 + ((a1 - a0) * i) / 8; pts.push(new THREE.Vector3(c.x + r * Math.cos(a), 0, c.z + r * Math.sin(a))); }
  return new THREE.CatmullRomCurve3(pts);
}
let _texZig = null;
const _matZig = new Map(), _matDoppio = new Map();
/** Lo stesso metallo con la ZIGRINATURA a rombi (rilievo). */
function matZigrinato(mat) {
  if (_matZig.has(mat)) return _matZig.get(mat);
  if (!_texZig && typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#000'; x.lineWidth = 7;
    for (let k = -64; k <= 128; k += 16) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke();
      x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke();
    }
    _texZig = new THREE.CanvasTexture(c); _texZig.wrapS = _texZig.wrapT = THREE.RepeatWrapping; _texZig.repeat.set(10, 28);
  }
  const m = mat.clone(); if (_texZig) { m.bumpMap = _texZig; m.bumpScale = 3; } m.roughness = Math.min(1, mat.roughness + 0.12);
  _matZig.set(mat, m); return m;
}
/** Lo stesso metallo visto dalle due facce (il guscio della conchiglia). */
function matDoppio(mat) {
  if (!_matDoppio.has(mat)) { const m = mat.clone(); m.side = THREE.DoubleSide; _matDoppio.set(mat, m); }
  return _matDoppio.get(mat);
}

/**
 * Maniglia 3D pronta, centrata in (0,0) sulla faccia dell'anta (z = 0).
 * forma: id di FORME_MANIGLIA · finitura: id di FINITURE_MANIGLIA · L: lunghezza mm.
 * Per profilo / a bordo il lato "bordo anta" è in alto (+y).
 */
export function costruisciManiglia(forma, finitura, L, colore = null, sporgenza = null) {
  const mat = materialeFinitura(finituraReale(finitura, colore));
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
    case 'bordol': {
      // PROFILO SUL BORDO: aletta sopra il bordo dell'anta (y 0…2: i 2 mm tolti all'anta), labbro
      // ARROTONDATO che sporge davanti e scende (la presa), e la L dietro la porta (non si vede da fuori).
      // Origine: bordo dell'anta (y = 0), faccia davanti dell'anta (z = 0).
      // Profilo SOTTILE (di lato una riga pulita, non un uncino): aletta piatta da 2 mm che sporge
      // 13 mm davanti all'anta con il bordo arrotondato e un labbro corto (6 mm) per le dita.
      const f = new THREE.Shape();
      f.moveTo(-20, 0); f.lineTo(-20, 2); f.lineTo(10, 2);
      f.quadraticCurveTo(13, 2, 13, -1); f.lineTo(13, -6);
      f.quadraticCurveTo(13, -6.8, 12.2, -6.8); f.lineTo(11.8, -6.8);
      f.quadraticCurveTo(11, -6.8, 11, -6); f.lineTo(11, -1);
      f.quadraticCurveTo(11, 0, 10, 0); f.lineTo(-20, 0);
      const geo = new THREE.ExtrudeGeometry(f, { depth: L, bevelEnabled: false, curveSegments: 10 });
      geo.rotateY(-Math.PI / 2); geo.translate(L / 2, 0, 0);
      g.add(new THREE.Mesh(geo, mat));
      g.add(box(L, 26, 2, 0, -12, -21, mat));                   // la L dietro la porta
      g.add(box(L - 2, 1, 10, 0, -0.5, 5.5, matOmbra));         // ombra sotto l'aletta (la presa)
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
    case 'ponteC': case 'ponteCpiatto': {
      // NASTRO PIEGATO A C: gambe alle due estremità, angoli arrotondati (piatto largo: fascia alta e sottile)
      const piatto = forma === 'ponteCpiatto', a = L / 2;
      const t = piatto ? 4 : 6, H = piatto ? 28 : 14, sp = piatto ? 26 : 30, R = piatto ? 5 : 7, r = Math.max(0.8, R - t);
      const s = new THREE.Shape();
      s.moveTo(-a, 0); s.lineTo(-a, sp - R); s.quadraticCurveTo(-a, sp, -a + R, sp); s.lineTo(a - R, sp);
      s.quadraticCurveTo(a, sp, a, sp - R); s.lineTo(a, 0); s.lineTo(a - t, 0); s.lineTo(a - t, sp - t - r);
      s.quadraticCurveTo(a - t, sp - t, a - t - r, sp - t); s.lineTo(-a + t + r, sp - t);
      s.quadraticCurveTo(-a + t, sp - t, -a + t, sp - t - r); s.lineTo(-a + t, 0); s.closePath();
      g.add(new THREE.Mesh(estrusoInPianta(s, H, 0.9), mat));
      break;
    }
    case 'trapezio': {
      // nastro con le gambe inclinate verso l'interno (la presa è più corta della base)
      const a = L / 2, t = 5, H = 12, sp = 28, d = Math.min(22, L * 0.15), R = 4, r = 1, k = d / sp;
      const s = new THREE.Shape();
      s.moveTo(-a, 0); s.lineTo(-a + d - R * k, sp - R); s.quadraticCurveTo(-a + d, sp, -a + d + R, sp);
      s.lineTo(a - d - R, sp); s.quadraticCurveTo(a - d, sp, a - d + R * k, sp - R); s.lineTo(a, 0);
      s.lineTo(a - t * 1.25, 0); s.lineTo(a - d - t * 0.4 + r * k, sp - t - r); s.quadraticCurveTo(a - d - t * 0.4, sp - t, a - d - t * 0.4 - r, sp - t);
      s.lineTo(-a + d + t * 0.4 + r, sp - t); s.quadraticCurveTo(-a + d + t * 0.4, sp - t, -a + d + t * 0.4 - r * k, sp - t - r);
      s.lineTo(-a + t * 1.25, 0); s.closePath();
      g.add(new THREE.Mesh(estrusoInPianta(s, H, 0.8), mat));
      break;
    }
    case 'arco': {
      // tondo Ø 10 ad arco morbido, con le rosette sull'anta
      const sp = 30, r = 5, b = L / 2 - 6;
      const curva = new THREE.CubicBezierCurve3(new THREE.Vector3(-b, 0, 0), new THREE.Vector3(-b * 0.95, 0, sp * 1.32), new THREE.Vector3(b * 0.95, 0, sp * 1.32), new THREE.Vector3(b, 0, 0));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 80, r, 20, false), mat));
      for (const x of [-b, b]) { const ro = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8, 2.5, 28), mat); ro.rotation.x = Math.PI / 2; ro.position.set(x, 0, 1.25); g.add(ro); }
      break;
    }
    case 'ovale': {
      // barra a sezione ovale (16 × 9) su due piedini
      const sp = 26, it = Math.max(L * 0.5, L - 44);
      const barra = new THREE.Mesh(new THREE.CapsuleGeometry(8, Math.max(4, L - 16), 10, 28), mat);
      barra.rotation.z = Math.PI / 2; barra.scale.set(1, 1, 0.56); barra.position.z = sp + 4.5; g.add(barra);
      for (const x of [-it / 2, it / 2]) { const pd = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, sp, 20), mat); pd.rotation.x = Math.PI / 2; pd.position.set(x, 0, sp / 2); g.add(pd); }
      break;
    }
    case 'zigrinata': {
      // tondo Ø 13: presa centrale zigrinata, capi lisci e arrotondati
      const sp = 30, rr = 6.5, a = L / 2, it = Math.max(L * 0.5, L - 30), Lz = L * 0.62, Ls = Math.max(1, (L - 2 * rr - Lz) / 2), ac = a - rr;
      const liscia = (len, x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len, 32), mat); m.rotation.z = Math.PI / 2; m.position.set(x, 0, sp + rr); return m; };
      g.add(liscia(Ls, -ac + Ls / 2)); g.add(liscia(Ls, ac - Ls / 2));      // capi lisci: lunga in tutto L
      const z = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, Lz, 48, 1), matZigrinato(mat)); z.rotation.z = Math.PI / 2; z.position.set(0, 0, sp + rr); g.add(z);
      for (const x of [-ac, ac]) { const c = new THREE.Mesh(new THREE.SphereGeometry(rr, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); c.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2; c.position.set(x, 0, sp + rr); g.add(c); }
      for (const x of [-it / 2, it / 2]) { const pd = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.5, sp, 20), mat); pd.rotation.x = Math.PI / 2; pd.position.set(x, 0, sp / 2); g.add(pd); }
      break;
    }
    case 'quadra': {
      // barra a sezione quadra 12 × 12 su piedini quadri
      const sp = 26, sz = 12, it = Math.max(L * 0.5, L - 40);
      const b = prismaArr(sz, sz, L, 1.6, 'x', mat); b.position.z = sp + sz / 2; g.add(b);
      for (const x of [-it / 2, it / 2]) { const pd = prismaArr(10, 10, sp, 1.4, 'z', mat); pd.position.set(x, 0, sp / 2); g.add(pd); }
      break;
    }
    case 'filo': {
      // tondino Ø 6 piegato con curve morbide, rosette piccole sull'anta
      const a = L / 2, sp = 28, R = 9, r = 3;
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(new THREE.Vector3(-a, 0, 0), new THREE.Vector3(-a, 0, sp - R)));
      path.add(quarto({ x: -a + R, z: sp - R }, R, Math.PI, Math.PI / 2));
      path.add(new THREE.LineCurve3(new THREE.Vector3(-a + R, 0, sp), new THREE.Vector3(a - R, 0, sp)));
      path.add(quarto({ x: a - R, z: sp - R }, R, Math.PI / 2, 0));
      path.add(new THREE.LineCurve3(new THREE.Vector3(a, 0, sp - R), new THREE.Vector3(a, 0, 0)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 160, r, 14, false), mat));
      for (const x of [-a, a]) { const ro = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1.6, 24), mat); ro.rotation.x = Math.PI / 2; ro.position.set(x, 0, 0.8); g.add(ro); }
      break;
    }
    case 'pomoloq': {
      // pomolo quadrato con gli spigoli arrotondati, su un gambo quadro
      const D = Math.max(22, Math.min(L, 40));
      const testa = new THREE.Mesh(new THREE.ExtrudeGeometry(rettArr(D, D, 5), { depth: 12, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.5, bevelSegments: 5, curveSegments: 10 }), mat);
      testa.position.z = 14; g.add(testa);
      const gambo = prismaArr(12, 12, 14, 2, 'z', mat); gambo.position.z = 7; g.add(gambo);
      break;
    }
    case 'conchiglia': {
      // CONCHIGLIA APPLICATA: piastra sull'anta + guscio a mezzaluna aperto sotto (si prende da sotto)
      const H = 42, pl = 2.5;
      g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(rettArr(L, H, 6), { depth: pl, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2 }), mat));
      const guscio = new THREE.Mesh(new THREE.SphereGeometry(10, 40, 20, 0, Math.PI, 0, Math.PI / 2), matDoppio(mat));
      guscio.scale.set((L / 2 - 6) / 10, (H * 0.62) / 10, 1.9); guscio.position.set(0, -H * 0.18, pl); g.add(guscio);
      break;
    }
    case 'pelle': {
      // fascia di CUOIO piegata ad asola, fissata ai due capi con due viti (le viti nel colore scelto)
      const W = 25, T = 3, sp = 26, b = L / 2;
      const curva = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-b, 0, T / 2), new THREE.Vector3(-b + 16, 0, T / 2), new THREE.Vector3(-b + 26, 0, sp * 0.55),
        new THREE.Vector3(-b * 0.35, 0, sp), new THREE.Vector3(b * 0.35, 0, sp), new THREE.Vector3(b - 26, 0, sp * 0.55),
        new THREE.Vector3(b - 16, 0, T / 2), new THREE.Vector3(b, 0, T / 2)], false, 'centripetal');
      const sez = new THREE.Shape(); sez.moveTo(-W / 2, -T / 2); sez.lineTo(W / 2, -T / 2); sez.lineTo(W / 2, T / 2); sez.lineTo(-W / 2, T / 2); sez.closePath();
      g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sez, { steps: 120, bevelEnabled: false, extrudePath: curva }), matCuoio));
      for (const x of [-b + 9, b - 9]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2, 24), mat); v.rotation.x = Math.PI / 2; v.position.set(x, 0, T + 1); g.add(v); }
      break;
    }
    default: {   // barra tonda a ponte
      const r = Math.max(5, Math.min(7, L * 0.04)), sp = 30;
      g.add((() => { const b = barraX(L, r, mat); b.position.z = sp + r; return b; })());
      for (const s of [-inter / 2, inter / 2]) g.add(piedino(s, r * 0.8, sp + r, mat));
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return adattaSporgenza(g, sporgenza);
}

/**
 * SPORGENZA SCRITTA NELLA SCHEDA DELLA MANIGLIA (mm): la parte davanti all'anta (z > 0) si allunga o si
 * accorcia fino a quella misura; quello che sta dietro (la L dei profili sul bordo) resta com'è.
 * Si chiama sul gruppo della maniglia appena fatto (prima di metterlo sull'anta). Senza misura: niente.
 */
export function adattaSporgenza(grp, mm) {
  const S = Number(mm);
  if (!grp || !(S > 0)) return grp;
  grp.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
  const mesh = []; grp.traverse((o) => { if (o.isMesh) mesh.push(o); });
  let maxZ = 0;
  const geo = mesh.map((o) => {
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    g.computeBoundingBox(); maxZ = Math.max(maxZ, g.boundingBox.max.z); return g;
  });
  if (!(maxZ > 0.5) || Math.abs(S / maxZ - 1) < 0.01) { geo.forEach((g) => g.dispose()); return grp; }
  const k = S / maxZ;
  mesh.forEach((o, i) => {
    const g = geo[i], pos = g.attributes.position, nor = g.attributes.normal;
    for (let j = 0; j < pos.count; j++) {
      if (pos.getZ(j) <= 0) continue;
      pos.setZ(j, pos.getZ(j) * k);
      if (nor) { const x = nor.getX(j), y = nor.getY(j), z = nor.getZ(j) / k, l = Math.hypot(x, y, z) || 1; nor.setXYZ(j, x / l, y / l, z / l); }
    }
    pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    o.geometry = g;
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  });
  // le misure sono già dentro le geometrie: i pezzi vanno direttamente nel gruppo, senza spostamenti
  while (grp.children.length) grp.remove(grp.children[0]);
  mesh.forEach((o) => grp.add(o));
  return grp;
}

// =============================================================================
// 3D REALE DALLE FOTO (davanti + sopra + lato): volume dalle sagome, superficie
// liscia (marching cubes) e colori veri delle foto proiettati sulle facce.
// =============================================================================
import { edgeTable, triTable } from '../vendor/three/addons/objects/mc-tabelle.js';

/** Vista: alfa + colori di una foto scontornata (PNG trasparente), assi scambiabili. */
function vista(src, scambia = false) {
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const k = Math.min(1, 360 / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  // senza trasparenza (foto vecchie): sfondo = colore degli angoli
  let haAlfa = false; for (let i = 3; i < d.length; i += 4 * 5) if (d[i] < 128) { haAlfa = true; break; }
  const bg = [0, 1, 2].map((q) => (d[q] + d[(w - 1) * 4 + q] + d[(h - 1) * w * 4 + q] + d[((h - 1) * w + w - 1) * 4 + q]) / 4);
  const A = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) A[i] = haAlfa ? d[i * 4 + 3] / 255 : (Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > 40 ? 1 : 0);
  // bordo della sagoma ammorbidito (2 passate di media 3×3): niente scalini né dentini del ritaglio
  for (let pass = 0; pass < 2; pass++) {
    const B = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += A[yy * w + xx]; n++; } }
      B[y * w + x] = s / n;
    }
    A.set(B);
  }
  // lungo il lato lungo una media più ampia: i gradini di 1 px dei bordi diritti diventano rampe lisce
  {
    const lungoX = w >= h, R = Math.max(2, Math.round(Math.max(w, h) / 90)), B = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let t = 0, n = 0;
      for (let q = -R; q <= R; q++) { const xx = lungoX ? x + q : x, yy = lungoX ? y : y + q; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { t += A[yy * w + xx]; n++; } }
      B[y * w + x] = t / n;
    }
    A.set(B);
  }
  // contorno della sagoma (u = primo asse, v = secondo)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const V = { w, h, A, d, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, scambia, flipU: false, flipV: false };
  V.eu = scambia ? V.bh : V.bw; V.ev = scambia ? V.bw : V.bh;      // estensioni sui due assi
  V.idx = (u, v) => {                                                // u,v in 0..1 sul contorno
    if (V.flipU) u = 1 - u; if (V.flipV) v = 1 - v;
    let x, y;
    if (scambia) { x = V.x0 + v * (V.bw - 1); y = V.y0 + u * (V.bh - 1); }
    else { x = V.x0 + u * (V.bw - 1); y = V.y0 + v * (V.bh - 1); }
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    return y * w + x;
  };
  V.alfa = (u, v) => { if (u < 0 || u > 1 || v < 0 || v > 1) return 0; const i = V.idx(u, v); return i < 0 ? 0 : A[i]; };
  // alfa MORBIDA (bilineare): bordi senza gradini anche se la sagoma è un filo storta
  V.alfaM = (u, v) => {
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    if (V.flipU) u = 1 - u; if (V.flipV) v = 1 - v;
    let x, y;
    if (scambia) { x = V.x0 + v * (V.bw - 1); y = V.y0 + u * (V.bh - 1); }
    else { x = V.x0 + u * (V.bw - 1); y = V.y0 + v * (V.bh - 1); }
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : A[yy * w + xx]);
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
  V.col = (u, v) => { const i = V.idx(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))); return i < 0 || A[i] < 0.5 ? null : [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; };
  // pienezza media delle righe lungo v (per capire da che parte c'è l'anta)
  V.pieno = (v0, v1) => { let s = 0, n = 0; for (let v = v0; v <= v1; v += 0.02) for (let u = 0.02; u < 1; u += 0.04) { s += V.alfa(u, v) > 0.5 ? 1 : 0; n++; } return s / Math.max(1, n); };
  let sr = 0, sg = 0, sb = 0, nn = 0; for (let i = 0; i < w * h; i += 2) if (A[i] > 0.5) { sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; nn++; }
  V.media = [sr / nn, sg / nn, sb / nn];
  return V;
}

/** Lato dell'anta (z = 0) sul secondo asse: dove la sagoma è più "vuota" (piedini). */
function orientaVersoAnta(V) {
  const a = V.pieno(0, 0.22), b = V.pieno(0.78, 1);
  V.flipV = a < b - 0.04;           // v = 0 deve essere il lato LONTANO, v = 1 l'anta
}

/** Tela con un bordo trasparente (così la sagoma si legge dall'alfa). */
function tela(Lmm, Hmm, colore, disegna) {
  const k = 700 / Math.max(Lmm, Hmm), M = 4;
  const c = document.createElement('canvas'); c.width = Math.round(Lmm * k) + M * 2; c.height = Math.max(3, Math.round(Hmm * k)) + M * 2;
  const g = c.getContext('2d'); g.translate(M, M); g.scale(k, k);
  g.fillStyle = `rgb(${colore.map(Math.round).join(',')})`;
  disegna(g);
  return c;
}
/**
 * UNA SOLA FOTO: capisco da sola che vista è e invento solo quello che manca.
 * - Sagoma a "C/U" (barra + piedini verso l'anta): è la vista da sopra / di
 *   profilo → la forma vera è quella; davanti è una barra alta come la barra.
 * - Sagoma piena (vista davanti): il contorno davanti è quello vero; la
 *   sporgenza è quella tipica (barra + due piedini, o pomolo col gambo).
 */
function vistaUnica(fronte, L) {
  let V = vista(fronte, false); if (!V) return null;
  if (V.eu < V.ev) V = vista(fronte, true);
  // riempimento delle colonne lungo la lunghezza
  const col = (u) => { let n = 0, m = 0, sv = 0; for (let v = 0.01; v < 1; v += 0.02) { m++; if (V.alfa(u, v) > 0.5) { n++; sv += v; } } return { f: n / m, c: n ? sv / n : 0.5 }; };
  const centro = [], estremi = [];
  for (let u = 0.2; u <= 0.8; u += 0.02) centro.push(col(u));
  for (let u = 0.005; u <= 0.15; u += 0.01) { estremi.push(col(u).f, col(1 - u).f); }
  const med = (a) => { const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; };
  const fMid = med(centro.map((x) => x.f)), cMid = med(centro.map((x) => x.c));
  const fEnd = Math.max(...estremi);
  const rapp = V.ev / V.eu;
  if (rapp < 0.7 && fEnd - fMid > 0.25 && fMid < 0.75 && (cMid < 0.38 || cMid > 0.62)) {
    // PROFILO (vista da sopra / di tre quarti con i piedini)
    const T = Math.max(5, Math.min(40, L * fMid * V.ev / V.eu));
    // foto di tre quarti: i piedini sembrano più corti → almeno lo spazio per le dita (~18 mm)
    return { fronte: tela(L, T, V.media, (g) => g.fillRect(0, 0, L, T)), sopra: fronte, minD: T + 18 };
  }
  // VISTA DAVANTI: sporgenza tipica
  const T = L * rapp;
  if (rapp > 0.6) {                                                  // pomolo: testa + gambo
    const D = Math.max(18, Math.min(35, L * 0.85)), h = D * 0.5;
    return { fronte, sopra: tela(L, D, V.media, (g) => { g.beginPath(); g.roundRect(0, 0, L, h, h * 0.45); g.fill(); g.fillRect(L * 0.3, h * 0.6, L * 0.4, D - h * 0.6); }) };
  }
  const D = Math.max(22, Math.min(38, T * 2.6)), tb = Math.min(T, D * 0.45);
  const lw = Math.max(7, Math.min(T * 0.9, 14)), cx = Math.max(lw * 0.9, L * 0.08);
  return { fronte, sopra: tela(L, D, V.media, (g) => { g.fillRect(0, 0, L, tb); g.fillRect(cx - lw / 2, tb * 0.5, lw, D - tb * 0.5); g.fillRect(L - cx - lw / 2, tb * 0.5, lw, D - tb * 0.5); }) };
}

/**
 * Geometria 3D dalla foto davanti (obbligatoria) e da sopra / di lato (facoltative).
 * Con una foto sola la forma si ricava da quella (vistaUnica).
 * L = lunghezza reale (mm). Ritorna { geo, L, T, D } con colori per vertice.
 */
export function geometriaDaViste(fronte, sopra, lato, L) {
  let coloreVero = null, minD = 0;
  if (!sopra && !lato) {
    const u = vistaUnica(fronte, L);
    if (u) { minD = u.minD || 0; if (u.fronte !== fronte) { const Vf = vista(fronte); if (Vf) coloreVero = Vf.media; } fronte = u.fronte; sopra = u.sopra; }
  }
  const F = vista(fronte, false);
  if (!F) return null;
  if (F.eu < F.ev) { F.scambia = true; F.eu = F.bh; F.ev = F.bw; }  // foto verticale → lunghezza sul primo asse
  const T = L * F.ev / F.eu;
  let S = sopra ? vista(sopra) : null, Lt = lato ? vista(lato) : null;
  let D = null;
  if (S) { if (S.bw < S.bh) { S = vista(sopra, true); } D = L * S.ev / S.eu; orientaVersoAnta(S); }
  if (Lt) {
    // di lato: un asse è l'altezza T, l'altro la sporgenza; scelgo l'abbinamento più coerente
    const prova = (sc) => { const V = vista(lato, sc); return { V, Dl: T * V.eu / V.ev }; };     // u = sporgenza, v = altezza
    const a = prova(false), b = prova(true);
    let sc;
    if (D) sc = Math.abs(a.Dl - D) <= Math.abs(b.Dl - D) ? a : b;
    else sc = a.Dl >= b.Dl ? a : b;                                // senza vista da sopra: la sporgenza è il lato lungo
    Lt = sc.V; if (!D) D = sc.Dl;
    // anta sul primo asse (u): scambio u/v per riusare la stessa misura
    const pu = (u0, u1) => { let s = 0, n = 0; for (let u = u0; u <= u1; u += 0.02) for (let v = 0.02; v < 1; v += 0.04) { s += Lt.alfa(u, v) > 0.5 ? 1 : 0; n++; } return s / Math.max(1, n); };
    Lt.flipU = pu(0, 0.22) < pu(0.78, 1) - 0.04;                  // u = 0 lontano, u = 1 anta
  }
  if (!D) D = Math.max(20, Math.min(60, T * 2.5));
  if (minD) D = Math.max(D, minD);
  D = Math.max(6, Math.min(120, D));
  // griglia (anisotropa) con un bordo vuoto
  const NX = 170, NY = Math.max(20, Math.min(56, Math.round(170 * T / L * 1.6))), NZ = Math.max(20, Math.min(56, Math.round(170 * D / L * 1.6)));
  const GX = NX + 2, GY = NY + 2, GZ = NZ + 2;
  const occ = new Float32Array(GX * GY * GZ);
  const id = (i, j, k) => (k * GY + j) * GX + i;
  for (let k = 1; k <= NZ; k++) for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
    const u = (i - 0.5) / NX, vy = 1 - (j - 0.5) / NY, wz = (k - 0.5) / NZ;      // vy: 0 = sopra
    // occupazione morbida (minimo delle tre sagome) → superficie precisa, senza gradini
    let o = F.alfaM(u, vy);
    if (o > 0 && S) o = Math.min(o, S.alfaM(u, 1 - wz));          // sopra: v = 1 anta (z = 0)
    if (o > 0 && Lt) o = Math.min(o, Lt.alfaM(1 - wz, vy));       // lato: u = 1 anta
    occ[id(i, j, k)] = o;
  }
  // ammorbidisco (3×3×3) → bordi arrotondati come un pezzo vero
  const f = new Float32Array(occ.length);
  for (let k = 1; k < GZ - 1; k++) for (let j = 1; j < GY - 1; j++) for (let i = 1; i < GX - 1; i++) {
    let s = 0; for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += occ[id(i + a, j + b, k + c)];
    f[id(i, j, k)] = s / 27;
  }
  // posizione del nodo (mm): x −L/2..L/2, y −T/2..T/2, z 0..D
  const pos = (i, j, k) => [(i - 0.5) / NX * L - L / 2, (j - 0.5) / NY * T - T / 2, (k - 0.5) / NZ * D];
  // MARCHING CUBES con vertici condivisi sugli spigoli
  const vert = [], ind = [], cache = new Map();
  const ang = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const spig = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const ISO = 0.5;
  for (let k = 0; k < GZ - 1; k++) for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
    let cubo = 0; const val = [];
    for (let c = 0; c < 8; c++) { const v = f[id(i + ang[c][0], j + ang[c][1], k + ang[c][2])]; val.push(v); if (v > ISO) cubo |= 1 << c; }
    // tabelle three.js: bit = vertice SOTTO soglia → inverto
    const ci = (~cubo) & 255;
    if (!edgeTable[ci]) continue;
    const vSp = new Array(12);
    for (let e = 0; e < 12; e++) {
      if (!(edgeTable[ci] & (1 << e))) continue;
      const [a, b] = spig[e];
      const A = [i + ang[a][0], j + ang[a][1], k + ang[a][2]], B = [i + ang[b][0], j + ang[b][1], k + ang[b][2]];
      const ka = id(...A), kb = id(...B), chiave = ka < kb ? ka * 1e7 + kb : kb * 1e7 + ka;
      let vi = cache.get(chiave);
      if (vi === undefined) {
        const t = (ISO - val[a]) / ((val[b] - val[a]) || 1e-6);
        const pa = pos(...A), pb = pos(...B);
        vi = vert.length / 3; vert.push(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
        cache.set(chiave, vi);
      }
      vSp[e] = vi;
    }
    for (let q = 0; triTable[ci * 16 + q] !== -1; q += 3) ind.push(vSp[triTable[ci * 16 + q]], vSp[triTable[ci * 16 + q + 1]], vSp[triTable[ci * 16 + q + 2]]);
  }
  if (!ind.length) return null;
  // LEVIGATURA (Taubin: liscia senza restringere) → niente gradini dei voxel
  {
    const nV = vert.length / 3, vic = Array.from({ length: nV }, () => new Set());
    for (let q = 0; q < ind.length; q += 3) { const [a, b, c] = [ind[q], ind[q + 1], ind[q + 2]]; vic[a].add(b).add(c); vic[b].add(a).add(c); vic[c].add(a).add(b); }
    const passo = (fatt) => {
      const nuovo = new Float32Array(vert.length);
      for (let v = 0; v < nV; v++) {
        let sx = 0, sy = 0, sz = 0, n = 0; for (const u of vic[v]) { sx += vert[u * 3]; sy += vert[u * 3 + 1]; sz += vert[u * 3 + 2]; n++; }
        for (let a = 0; a < 3; a++) { const m = n ? [sx, sy, sz][a] / n : vert[v * 3 + a]; nuovo[v * 3 + a] = vert[v * 3 + a] + fatt * (m - vert[v * 3 + a]); }
      }
      for (let i = 0; i < vert.length; i++) vert[i] = nuovo[i];
    };
    for (let it = 0; it < 10; it++) { passo(0.5); passo(-0.53); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  // le facce devono guardare fuori: se la normale media punta dentro, giro i triangoli
  const nrm = geo.attributes.normal, P = geo.attributes.position;
  let segno = 0; for (let v = 0; v < P.count; v += 7) segno += nrm.getX(v) * P.getX(v) + nrm.getY(v) * P.getY(v) + nrm.getZ(v) * (P.getZ(v) - D / 2);
  if (segno < 0) { for (let q = 0; q < ind.length; q += 3) { const t = ind[q + 1]; ind[q + 1] = ind[q + 2]; ind[q + 2] = t; } geo.setIndex(ind); geo.computeVertexNormals(); }
  // COLORI VERI dalle foto: ogni faccia prende la foto che la guarda
  const lin = (c) => Math.pow(c / 255, 2.2);
  const cols = new Float32Array(P.count * 3);
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const nx = Math.abs(nrm.getX(v)), ny = Math.abs(nrm.getY(v)), nz = Math.abs(nrm.getZ(v));
    const u = (x + L / 2) / L, vy = 0.5 - y / T, wz = z / D;
    const cand = [];
    const cF = F.col(u, vy); if (cF) cand.push([cF, nz + 0.15]);
    if (S) { const c = S.col(u, 1 - wz); if (c) cand.push([c, ny + 0.05]); }
    if (Lt) { const c = Lt.col(1 - wz, vy); if (c) cand.push([c, nx + 0.05]); }
    let r = 0, g = 0, b = 0, sw = 0;
    for (const [c, wgt] of cand) { r += c[0] * wgt; g += c[1] * wgt; b += c[2] * wgt; sw += wgt; }
    const m = sw ? [r / sw, g / sw, b / sw] : F.media;
    cols[v * 3] = lin(m[0]); cols[v * 3 + 1] = lin(m[1]); cols[v * 3 + 2] = lin(m[2]);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const med = coloreVero || F.media;
  return { geo, L, T, D, colore: (Math.round(med[0]) << 16) | (Math.round(med[1]) << 8) | Math.round(med[2]) };
}

/**
 * Materiale per la maniglia dalle foto: "Colore della foto" = colori veri +
 * lucentezza del metallo più simile; altra finitura = quel colore (inox, bronzo…).
 */
function materialeDaFoto(finitura, colore) {
  if (finitura && finitura !== 'foto' && FINITURE_MANIGLIA.some((x) => x.id === finitura)) return materialeFinitura(finitura);
  const f = FINITURE_MANIGLIA.find((x) => x.id === finituraVicina(colore)) || FINITURE_MANIGLIA[0];
  return new THREE.MeshStandardMaterial({ vertexColors: true, metalness: Math.min(0.75, f.metal), roughness: Math.max(0.3, f.rough), envMapIntensity: 0.8 });
}

const _cacheFoto = new Map();     // id → { mesh dati } | 'attesa' | 'errore'
function caricaImg(url) { return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; }); }

/**
 * Maniglia dalle foto del catalogo (def.texture davanti, def.vistaSopra, def.vistaLato).
 * Ritorna { geo, mat } se pronta; altrimenti la prepara e richiama quandoPronta.
 */
export function manigliaDaFoto(def, quandoPronta) {
  const chiave = def.id + '|' + (def.finitura || '') + '|' + (def.lunghezzaMm || 160);
  const c = _cacheFoto.get(chiave);
  if (c && c !== 'attesa' && c !== 'errore') return c;
  if (c) return null;
  _cacheFoto.set(chiave, 'attesa');
  Promise.all([caricaImg(def.texture), def.vistaSopra ? caricaImg(def.vistaSopra) : null, def.vistaLato ? caricaImg(def.vistaLato) : null])
    .then(([f, s, l]) => {
      const r = geometriaDaViste(f, s, l, def.lunghezzaMm || 160);
      if (!r) { _cacheFoto.set(chiave, 'errore'); return; }
      _cacheFoto.set(chiave, { geo: r.geo, mat: materialeDaFoto(def.finitura, def.colore ?? r.colore) });
      if (quandoPronta) quandoPronta();
    })
    .catch(() => _cacheFoto.set(chiave, 'errore'));
  return null;
}

/**
 * ANTEPRIMA 3D nella scheda: la maniglia costruita dalle viste, che gira e si
 * può ruotare col dito. Ritorna una funzione per chiuderla.
 */
export async function anteprimaManiglia(box, fronte, sopra, lato, L, finitura, forma = 'foto', colore = null) {
  const { OrbitControls } = await import('../vendor/three/addons/controls/OrbitControls.js');
  box.innerHTML = '';
  const W = Math.min(box.clientWidth || 320, 420), H = 220;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(W, H);
  r.outputColorSpace = THREE.SRGBColorSpace;
  box.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xeae7e1);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, 2, 3); sc.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.6); dl2.position.set(-2, -1, 1); sc.add(dl2);
  // ambiente semplice per i riflessi del metallo
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene(); env.background = new THREE.Color(0xd8d4cc);
  const lampada = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })); lampada.position.set(0, 2, 0); lampada.rotation.x = Math.PI / 2; env.add(lampada);
  sc.environment = pm.fromScene(env, 0.04).texture;
  // "La mia forma": 3D ricostruito dalle foto (anche da una sola); altrimenti il modello della forma scelta
  const res = (!forma || forma === 'foto') ? geometriaDaViste(fronte, sopra, lato, L) : null;
  const grp = new THREE.Group();
  let misure;
  if (res) {
    grp.add(new THREE.Mesh(res.geo, materialeDaFoto(finitura, colore ?? res.colore)));
    misure = { T: res.T, D: res.D };
  } else {
    const gp = costruisciManiglia(forma === 'foto' ? 'barra' : forma, finitura, L, colore); grp.add(gp);
    const bb = new THREE.Box3().setFromObject(gp); misure = { T: bb.max.y - bb.min.y, D: bb.max.z };
  }
  const res2 = misure;
  // pezzo di anta dietro (per capire come sporge)
  const anta = new THREE.Mesh(new THREE.BoxGeometry(L * 1.3, Math.max(res2.T * 3, 60), 4), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.8 }));
  anta.position.z = -2; grp.add(anta);
  sc.add(grp);
  const cam = new THREE.PerspectiveCamera(30, W / H, 1, 5000);
  const R = Math.max(L, res2.D * 3) * 1.25;
  cam.position.set(R * 0.45, R * 0.35, R * 0.85); cam.lookAt(0, 0, res2.D / 2);
  const ctr = new OrbitControls(cam, r.domElement); ctr.target.set(0, 0, res2.D / 2); ctr.enablePan = false; ctr.autoRotate = true; ctr.autoRotateSpeed = 2.5;
  let vivo = true;
  const giro = () => { if (!vivo) return; ctr.update(); r.render(sc, cam); requestAnimationFrame(giro); };
  giro();
  box._misure = res2;
  return () => { vivo = false; ctr.dispose(); r.dispose(); };
}
