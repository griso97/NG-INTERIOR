// =============================================================================
// COLORI DELLE MANIGLIE (senza 3D: lo usano anche la distinta e i pannelli)
// =============================================================================
// Ogni maniglia (quelle del catalogo e quelle aggiunte in Impostazioni) si può fare in
// TUTTI questi colori, come il rubinetto. «extra»: colori in più che non servono a
// riconoscere la finitura dalla foto di una maniglia (vedi finituraVicina).
// =============================================================================
export const FINITURE_MANIGLIA = [
  { id: 'inox', nome: 'Acciaio inox', colore: 0xc5c8cc, metal: 0.9, rough: 0.28, css: 'linear-gradient(135deg,#e3e5e8,#a9adb3 55%,#d4d7db)' },
  { id: 'cromo', nome: 'Cromo lucido', colore: 0xf2f3f6, metal: 0.95, rough: 0.1, css: 'linear-gradient(135deg,#f4f5f7,#a7abb2 55%,#e6e8eb)', extra: true },
  { id: 'alluminio', nome: 'Alluminio', colore: 0xb9bcc0, metal: 0.75, rough: 0.42, css: 'linear-gradient(135deg,#d2d4d7,#a3a6aa)' },
  { id: 'nero', nome: 'Nero opaco', colore: 0x1c1c1c, metal: 0.35, rough: 0.5, css: '#1c1c1e' },
  { id: 'antracite', nome: 'Antracite / titanio', colore: 0x4a4c50, metal: 0.8, rough: 0.35, css: 'linear-gradient(135deg,#6e7075,#3c3e42)' },
  { id: 'canna', nome: 'Canna di fucile', colore: 0x5d6066, metal: 0.7, rough: 0.3, css: 'linear-gradient(135deg,#6a6c71,#34363a)', extra: true },
  { id: 'oro', nome: 'Oro / ottone', colore: 0xc9a65c, metal: 0.92, rough: 0.28, css: 'linear-gradient(135deg,#e6c98a,#b08a45)' },
  { id: 'bronzo', nome: 'Bronzo', colore: 0x6f5238, metal: 0.85, rough: 0.38, css: 'linear-gradient(135deg,#8f6c4c,#56402a)' },
  { id: 'rame', nome: 'Rame', colore: 0xb2704a, metal: 0.9, rough: 0.3, css: 'linear-gradient(135deg,#e2a07d,#9c5a39)' },
  { id: 'bianco', nome: 'Bianco', colore: 0xeeeeec, metal: 0.05, rough: 0.4, css: '#f1f1ef' },
];
/** Nome del colore di una maniglia (per la distinta). */
export function nomeFinituraManiglia(id) {
  const f = FINITURE_MANIGLIA.find((x) => x.id === id);
  return f ? f.nome : '';
}
