// =============================================================================
// SFONDI della vista 3D (cucina + armadi) — NG INTERIOR
// =============================================================================
// Solo estetica del fondale/pavimento: NON cambia luci né riflessi, quindi la
// resa realistica resta identica con qualsiasi sfondo.
// =============================================================================

export const SFONDI = {
  chiaro: { nome: 'Chiaro', bg: 0xe9e6df, pav: 0xd7d0c4, g1: 0xbdb5a6, g2: 0xc7c0b2, css: '#e9e6df' },
  neutro: { nome: 'Neutro', bg: 0x8f8b82, pav: 0x7c786f, g1: 0x6c685f, g2: 0x767269, css: '#8f8b82' },
  scuro:  { nome: 'Scuro',  bg: 0x1b1b1f, pav: 0x262529, g1: 0x3a3a40, g2: 0x2c2c31, css: '#1b1b1f' },
};

export const SFONDI_LISTA = Object.keys(SFONDI).map((id) => ({ id, nome: SFONDI[id].nome, css: SFONDI[id].css }));

export function sfondoDi(id) { return SFONDI[id] || SFONDI.chiaro; }
