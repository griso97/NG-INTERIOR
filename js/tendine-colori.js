// =============================================================================
// TENDINE DEI COLORI — NG INTERIOR: in ogni tavolozza del sito i colori sono divisi per
// sottocategoria (Legni, Mate, Luxe, Finger-pull, Encimere), ognuna una tendina
// che si apre con un tocco. Vale anche per i colori aggiunti in Impostazioni.
// =============================================================================
export const GRUPPI_COLORI = [
  { id: 'legni', nome: 'Legni' },
  { id: 'mate', nome: 'Mate (opachi)' },
  { id: 'luxe', nome: 'Luxe (lucidi)' },
  { id: 'fingerpull', nome: 'Finger-pull' },
  { id: 'encimera', nome: 'Encimere' },
  { id: 'altri', nome: 'Altri' },
];
/** Sottocategoria di un colore: encimera, finger-pull, luxe (lucido), mate (opaco / Supermate), legni. */
export function gruppoColore(m) {
  if (!m) return 'altri';
  if (m.categoria === 'encimera') return 'encimera';
  if (m.gola || (m.proprio && m.sezione === 'fingerpull')) return 'fingerpull';
  const n = String(m.nome || '').toLowerCase();
  if (m.lucido || /\b(lucido|lucida|luxe|brillo|gloss|lacado brillo)\b/.test(n)) return 'luxe';
  if (/^sm\s/.test(n) || /\b(opaco|opaca|mate|matte|supermate|supermatt)\b/.test(n) || m.categoria === 'tinta') return 'mate';
  if (m.categoria === 'legno') return m.solido ? 'mate' : 'legni';
  return 'altri';
}
// tendine aperte / chiuse a mano (restano così finché si lavora, anche quando il pannello si ridisegna)
const _tendine = new Map();
if (typeof document !== 'undefined' && !window.__ngTendineColori) {
  window.__ngTendineColori = true;
  document.addEventListener('click', (e) => {
    const sm = e.target.closest && e.target.closest('.tendina-colori > summary');
    if (!sm) return;
    const d = sm.parentElement, box = d.closest('[data-tendine]');
    if (box) _tendine.set(`${box.dataset.tendine}|${d.dataset.gruppo}`, !d.open);   // dopo il clic sarà così
  }, true);
}
/**
 * HTML delle tendine per una lista di colori.
 *  - swatch(m): l'HTML del quadratino (ogni pagina ha il suo)
 *  - sel: id del colore scelto → la sua tendina si apre da sola
 *  - chiave: nome della tavolozza (ricorda le tendine aperte a mano)
 *  - classeGriglia: classe della griglia dei quadratini ('palette-colori', 'mat-grid'…)
 *  - prima: quadratini fuori dalle tendine (es. "uguale al piano", "nessuno")
 */
export function htmlTendineColori(lista, swatch, { sel = null, chiave = 'colori', classeGriglia = 'palette-colori', prima = '' } = {}) {
  const gruppi = GRUPPI_COLORI.map((g) => ({ ...g, voci: (lista || []).filter((m) => gruppoColore(m) === g.id) })).filter((g) => g.voci.length);
  const unico = gruppi.length === 1;
  return `<div class="tendine-colori" data-tendine="${chiave}">${prima ? `<div class="${classeGriglia} tendine-prima">${prima}</div>` : ''}${gruppi.map((g) => {
    const mano = _tendine.get(`${chiave}|${g.id}`);
    const conSel = g.voci.some((m) => m.id === sel);
    const aperta = mano != null ? mano : (unico || conSel);
    return `<details class="tendina-colori${conSel ? ' con-sel' : ''}" data-gruppo="${g.id}"${aperta ? ' open' : ''}>
      <summary><span class="tendina-nome">${g.nome}</span><span class="tendina-conta">${g.voci.length}</span></summary>
      <div class="${classeGriglia}">${g.voci.map(swatch).join('')}</div>
    </details>`;
  }).join('')}</div>`;
}
