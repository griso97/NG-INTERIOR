/**
 * COLORI DELLE LAMPADE costruite nel programma (lampade a nastro LED): si scelgono sulla lampada
 * selezionata (pannello «Oggetto selezionato» → Colore). Solo dati: lo usano il pannello (senza 3D
 * caricato) e la collezione (che costruisce la lampada con i materiali scelti).
 *   a = materiale del (primo) nastro e della piastra al soffitto, b = materiale del secondo nastro
 *   (solo le lampade a due nastri, es. «Doppia onda»: così un nastro oro e uno nero).
 */
export const COLORI_TINTA_UNITA = [
  { id: 'nero', nome: 'Nero', a: 'alluminio-nero', hex: '#1d1c1b' },
  { id: 'bianco', nome: 'Bianco', a: 'metallo-bianco', hex: '#f1efea' },
  { id: 'oro', nome: 'Oro', a: 'oro-satinato', hex: '#c9a85e' },
  { id: 'champagne', nome: 'Champagne', a: 'champagne', hex: '#c4b393' },
  { id: 'bronzo', nome: 'Bronzo', a: 'bronzo', hex: '#6a503a' },
  { id: 'rame', nome: 'Rame', a: 'rame', hex: '#b87348' },
  { id: 'argento', nome: 'Argento', a: 'acciaio-satinato', hex: '#c9cbce' },
  { id: 'antracite', nome: 'Antracite', a: 'antracite', hex: '#3b3c3e' },
];
export const COLORI_DUE_TONI = [
  { id: 'oro-nero', nome: 'Oro e nero', a: 'oro-satinato', b: 'alluminio-nero', hex: '#c9a85e', hex2: '#1d1c1b' },
  { id: 'oro-bianco', nome: 'Oro e bianco', a: 'oro-satinato', b: 'metallo-bianco', hex: '#c9a85e', hex2: '#f1efea' },
  { id: 'nero-bianco', nome: 'Nero e bianco', a: 'alluminio-nero', b: 'metallo-bianco', hex: '#1d1c1b', hex2: '#f1efea' },
  { id: 'rame-nero', nome: 'Rame e nero', a: 'rame', b: 'alluminio-nero', hex: '#b87348', hex2: '#1d1c1b' },
  { id: 'champagne-antracite', nome: 'Champagne e antracite', a: 'champagne', b: 'antracite', hex: '#c4b393', hex2: '#3b3c3e' },
];
// lampade con la scelta del colore: id della collezione → colore di partenza e se ha due nastri
const LAMPADE = {
  'ds-lux-nastro-doppio-nero': { base: 'nero', due: true },
  'ds-lux-nastro-doppio-bianco': { base: 'bianco', due: true },
  'ds-lux-nastro-doppio-oro': { base: 'oro', due: true },
  'ds-lux-nastro-doppio-160-nero': { base: 'nero', due: true },
  'ds-lux-nastro-doppio-160-bianco': { base: 'bianco', due: true },
  'ds-lux-nastro-doppio-160-oro': { base: 'oro', due: true },
  'ds-lux-nastro-onde-bianco': { base: 'bianco' },
  'ds-lux-nastro-onde-nero': { base: 'nero' },
  'ds-lux-nastro-onde-oro': { base: 'champagne' },
  'ds-lux-nastro-ritorto-nero': { base: 'nero' },
  'ds-lux-nastro-ritorto-oro': { base: 'oro' },
  'ds-lux-onda-sfere-oro': { base: 'oro' },
  'ds-lux-onda-sfere-nero': { base: 'nero' },
};
/** Id della collezione da un tipo del progetto («ogg:cm-ds-…» → «ds-…»). */
export function lampadaDaTipo(tipo) { return String(tipo || '').replace(/^ogg:/, '').replace(/^cm-/, ''); }
/** I colori che una lampada può avere (null = nessuna scelta). */
export function coloriLampada(id) {
  const l = LAMPADE[id]; if (!l) return null;
  return { base: l.base, tinte: COLORI_TINTA_UNITA, dueToni: l.due ? COLORI_DUE_TONI : [] };
}
/** Il colore scelto (o quello di partenza) come { id, a, b }. */
export function coloreLampada(id, scelto) {
  const l = LAMPADE[id]; if (!l) return null;
  const tutti = COLORI_TINTA_UNITA.concat(l.due ? COLORI_DUE_TONI : []);
  return tutti.find((c) => c.id === scelto) || tutti.find((c) => c.id === l.base);
}
