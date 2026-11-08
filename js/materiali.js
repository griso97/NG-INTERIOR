// =============================================================================
// LIBRERIA MATERIALI — NG INTERIOR
// =============================================================================
// Database di tutti i materiali disponibili per le parti del mobile.
// Ogni materiale ha:
//   id       → identificatore stabile (slug), salvato nella config
//   nome     → nome visualizzato (quello stampato sul campione)
//   thumb    → immagine 96×96 per la palette
//   texture  → immagine 512×512 per il rendering 3D
//   colore   → fallback color (hex) usato finché la texture non è caricata
//
// Per aggiungere un nuovo materiale basta:
//   1) Mettere due jpg in /materials/ (slug.jpg + slug-thumb.jpg)
//   2) Aggiungere una riga qui sotto
// =============================================================================

import * as THREE from 'three';

// LEGNI (texture da foto reali, ripetute in base alla dimensione del pezzo)
// SOLIDI (bianco/nero/grigio matte, bianco/nero lucido) usano solo il
//   colore + proprietà di finitura, nessuna texture.
export const MATERIALI = [
  // ---- Legni batch 1 ----
  { id: 'noce-panarea-yoku', nome: 'Noce Panarea Yoku', categoria: 'legno',
    thumb: 'materials/noce-panarea-yoku-thumb.jpg',
    texture: 'materials/noce-panarea-yoku.jpg', colore: 0x8e6a3e },
  { id: 'roble-colorado', nome: 'Roble Colorado', categoria: 'legno',
    thumb: 'materials/roble-colorado-thumb.jpg',
    texture: 'materials/roble-colorado.jpg', colore: 0x9c8c7a },
  { id: 'roble-azabache', nome: 'Roble Azabache', categoria: 'legno',
    thumb: 'materials/roble-azabache-thumb.jpg',
    texture: 'materials/roble-azabache.jpg', colore: 0x2a2a28 },
  { id: 'roble-denver', nome: 'Roble Denver', categoria: 'legno',
    thumb: 'materials/roble-denver-thumb.jpg',
    texture: 'materials/roble-denver.jpg', colore: 0xb89a74 },
  { id: 'roble-hercules-19', nome: 'Roble Hercules 19', categoria: 'legno',
    thumb: 'materials/roble-hercules-19-thumb.jpg',
    texture: 'materials/roble-hercules-19.jpg', colore: 0xc0a07a },
  { id: 'roble-hera', nome: 'Roble Hera', categoria: 'legno',
    thumb: 'materials/roble-hera-thumb.jpg',
    texture: 'materials/roble-hera.jpg', colore: 0xd6c3a6 },
  { id: 'nogal-slow', nome: 'Nogal Slow', categoria: 'legno',
    thumb: 'materials/nogal-slow-thumb.jpg',
    texture: 'materials/nogal-slow.jpg', colore: 0x9c7a56 },
  { id: 'roble-amazona', nome: 'Roble Amazona', categoria: 'legno',
    thumb: 'materials/roble-amazona-thumb.jpg',
    texture: 'materials/roble-amazona.jpg', colore: 0xc2a580 },
  // ---- Legni batch 2 ----
  { id: 'noce-caldo', nome: 'Noce Caldo', categoria: 'legno',
    thumb: 'materials/noce-caldo-thumb.jpg',
    texture: 'materials/noce-caldo.jpg', colore: 0x7a5236,
    nota: 'nome provvisorio' },
  { id: 'roble-palma-19', nome: 'Roble Palma 19', categoria: 'legno',
    thumb: 'materials/roble-palma-19-thumb.jpg',
    texture: 'materials/roble-palma-19.jpg', colore: 0x5c4634 },
  { id: 'roble-aurora', nome: 'Roble Aurora', categoria: 'legno',
    thumb: 'materials/roble-aurora-thumb.jpg',
    texture: 'materials/roble-aurora.jpg', colore: 0xd0c3a9 },
  { id: 'rovere-nodoso', nome: 'Rovere Nodoso', categoria: 'legno',
    thumb: 'materials/rovere-nodoso-thumb.jpg',
    texture: 'materials/rovere-nodoso.jpg', colore: 0xa0804c,
    nota: 'nome provvisorio' },
  // ---- Tinte solide (matte e lucide) ----
  // OPACHI: superficie totalmente matte, tono un filo "schiarito/polveroso"
  // così lo stacco con il lucido è netto anche senza riflessi.
  { id: 'bianco-matte',  nome: 'Bianco opaco',   categoria: 'tinta',
    thumb: 'materials/bianco-matte-thumb.jpg',  colore: 0xe7e5de,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'nero-matte',    nome: 'Nero opaco',     categoria: 'tinta',
    thumb: 'materials/nero-matte-thumb.jpg',    colore: 0x1f1f23,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'grigio-matte',  nome: 'Grigio opaco',   categoria: 'tinta',
    thumb: 'materials/grigio-matte-thumb.jpg',  colore: 0x8a8a8a,
    solido: true, roughness: 1.0, metalness: 0.0 },
  // LUCIDI: laccato lucido con riflessi netti (roughness bassissima + clearcoat).
  { id: 'bianco-lucido', nome: 'Bianco lucido',  categoria: 'tinta',
    thumb: 'materials/bianco-lucido-thumb.jpg', colore: 0xfafafa,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true },
  { id: 'nero-lucido',   nome: 'Nero lucido',    categoria: 'tinta',
    thumb: 'materials/nero-lucido-thumb.jpg',   colore: 0x060607,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true },
  // ---- Encimere / piani di lavoro ----
  // Ogni encimera porta anche il proprio spessore (mm): viene applicato al
  // top della cucina quando questa encimera e' selezionata.
  { id: 'compacto-negro', nome: 'Compacto negro', categoria: 'encimera',
    thumb: 'materials/compacto-negro-thumb.jpg',
    texture: 'materials/compacto-negro.jpg', colore: 0x1a1a1a,
    spessore: 12 },
  { id: 'compacto-bernini', nome: 'Compacto Bernini', categoria: 'encimera',
    thumb: 'materials/compacto-bernini-thumb.jpg',
    texture: 'materials/compacto-bernini.jpg', colore: 0xece7dd,
    spessore: 12 },
];

// PARTI selezionabili nel pannello materiali.
// `applica` elenca le chiavi che vengono aggiornate insieme quando l'utente
// sceglie un materiale per quella "parte logica". Es. selezionando il legno
// per la Struttura, carcassa e schiena cambiano insieme (sono sempre uguali).
export const PARTI = [
  { id: 'struttura', nome: 'Struttura (carcassa + schiena + ripiani)',
    applica: ['carcassa', 'schiena'] },
  { id: 'ante', nome: 'Ante', applica: ['ante'] },
  { id: 'tamponamenti', nome: 'Tamponamenti', applica: ['tamponamenti'] },
  { id: 'cassStruttura', nome: 'Cassettiera · Struttura (scatola + fascette)',
    applica: ['cassStruttura'] },
  { id: 'cassFronti', nome: 'Cassettiera · Fronti cassetto',
    applica: ['cassFronti'] },
];

export function trovaMateriale(id) {
  return MATERIALI.find((m) => m.id === id) || MATERIALI[0];
}

// ---------- Cache + materiali three.js ----------
const loader = new THREE.TextureLoader();
const cacheTex = new Map();     // id → THREE.Texture
const cacheMat = new Map();     // id → THREE.MeshStandardMaterial

export function getMaterialeTHREE(id, onPronto) {
  if (cacheMat.has(id)) return cacheMat.get(id);
  const def = trovaMateriale(id);
  // Tinte solide: niente texture, solo colore + finitura matte/lucida.
  if (def.solido) {
    let mat;
    if (def.lucido) {
      // Laccato LUCIDO: clearcoat trasparente sopra il colore → riflessi netti
      // (stacco evidente rispetto all'opaco), serve un environment in scena.
      mat = new THREE.MeshPhysicalMaterial({
        color: def.colore,
        roughness: def.roughness ?? 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 2.6,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: def.colore,
        roughness: def.roughness ?? 1.0,
        metalness: def.metalness ?? 0.0,
        envMapIntensity: 0.4,
      });
    }
    cacheMat.set(id, mat);
    return mat;
  }
  // Legno: carica la texture in background e la applica quando è pronta.
  const mat = new THREE.MeshStandardMaterial({
    color: def.colore, roughness: 0.6, metalness: 0.05,
  });
  cacheMat.set(id, mat);
  if (!cacheTex.has(id)) {
    loader.load(def.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      cacheTex.set(id, tex);
      mat.map = tex;
      mat.color.set(0xffffff); // lascia che la texture esprima il colore
      mat.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  return mat;
}

/**
 * Indica se il materiale è un LEGNO (ha una texture da tilare).
 * Serve a scena3d.js per decidere se applicare il tiling UV.
 */
export function isLegno(id) {
  const def = trovaMateriale(id);
  return def && !def.solido;
}

// Config default: Ante = Roble Denver, Interno/Schiena = Roble Hera, Tamp = Roble Denver
// Cassettiera: struttura come l'interno, fronti come le ante.
export function materialiDefault() {
  return {
    ante: 'roble-denver',
    carcassa: 'roble-hera',
    schiena: 'roble-hera',
    tamponamenti: 'roble-denver',
    cassStruttura: 'roble-hera',
    cassFronti: 'roble-denver',
  };
}
