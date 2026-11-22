// =============================================================================
// CUCINE DI ESEMPIO MODIFICATE DAL FALEGNAME — «Salva come predefinito»
// =============================================================================
// Gli esempi sono file del sito (esempi/cucine/): non si possono cambiare da qui. Quando il
// falegname modifica un esempio e lo salva come predefinito, la SUA versione (progetto + foto
// grande + anteprima) va sul dispositivo, insieme al catalogo: 'esempio:<id>', 'esempiofoto:<id>',
// 'esempiomini:<id>'. La galleria mostra la sua versione al posto di quella del sito; «Torna
// all'originale» la toglie. La «copia completa» le porta anche sugli altri dispositivi.
// =============================================================================
import { leggiFoto, salvaFoto, eliminaFotoTipo, chiaviCatalogo } from './catalogo.js?v=20261124h';

/** La versione del falegname di un esempio: { progetto, aggiornato } oppure null. */
export async function esempioModificato(id) {
  try { const v = await leggiFoto(id, 'esempio'); return v && v.progetto ? v : null; } catch (_) { return null; }
}
/** Foto della versione modificata: 'grande' (galleria a schermo intero) o 'mini' (anteprima). */
export async function fotoEsempioModificato(id, quale = 'mini') {
  try { return await leggiFoto(id, quale === 'grande' ? 'esempiofoto' : 'esempiomini'); } catch (_) { return null; }
}
/** Salva la versione modificata (le foto si tengono quelle di prima se non ce ne sono di nuove). */
export async function salvaEsempioModificato(id, progetto, grande = null, mini = null) {
  const dati = JSON.parse(JSON.stringify(progetto));
  delete dati.esempioInModifica;
  // un PROGETTO PREDEFINITO del falegname tiene nome, descrizione e tipo
  const prima = await esempioModificato(id);
  const meta = prima && prima.mio ? { mio: true, nome: prima.nome, desc: prima.desc, tipo: prima.tipo, creato: prima.creato } : {};
  if (grande) await salvaFoto(id, grande, 'esempiofoto');
  if (mini) await salvaFoto(id, mini, 'esempiomini');
  await salvaFoto(id, { ...meta, progetto: dati, aggiornato: Date.now() }, 'esempio');
}
/** Torna all'esempio del sito (via la versione modificata e le sue foto). */
export async function ripristinaEsempio(id) {
  for (const t of ['esempio', 'esempiofoto', 'esempiomini']) { try { await eliminaFotoTipo(id, t); } catch (_) { /* già tolta */ } }
}

// =============================================================================
// PROGETTI PREDEFINITI DEL FALEGNAME — «⭐ Salva come progetto predefinito» dalla cucina
// =============================================================================
// Una cucina fatta dal falegname diventa un progetto da cui partire, nella galleria delle cucine
// insieme agli esempi: stesso archivio degli esempi modificati ('esempio:mio-…' + le sue foto),
// quindi la «copia completa» li porta anche sugli altri dispositivi.
// =============================================================================
/** I progetti predefiniti del falegname: [{ id, nome, desc, tipo, aggiornato, creato }], i più nuovi prima. */
export async function progettiPredefiniti() {
  let chiavi = [];
  try { chiavi = await chiaviCatalogo('esempio:mio-'); } catch (_) { return []; }
  const out = [];
  for (const k of chiavi) {
    const id = String(k).slice(8), v = await esempioModificato(id);
    if (v && v.mio) out.push({ id, nome: v.nome || '', desc: v.desc || '', tipo: v.tipo === 'cucinaPonte' ? 'cucinaPonte' : 'cucina', aggiornato: v.aggiornato || 0, creato: v.creato || v.aggiornato || 0 });
  }
  return out.sort((a, b) => b.creato - a.creato);
}
/** Aggiunge una cucina ai progetti predefiniti. Ritorna l'id. */
export async function salvaProgettoPredefinito({ nome, desc = '', tipo = 'cucina', progetto, grande = null, mini = null }) {
  const id = 'mio-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dati = JSON.parse(JSON.stringify(progetto));
  delete dati.esempioInModifica;
  if (grande) await salvaFoto(id, grande, 'esempiofoto');
  if (mini) await salvaFoto(id, mini, 'esempiomini');
  const ora = Date.now();
  await salvaFoto(id, { mio: true, nome: String(nome || '').trim(), desc: String(desc || '').trim(), tipo, progetto: dati, creato: ora, aggiornato: ora }, 'esempio');
  return id;
}
/** Toglie un progetto predefinito (progetto e foto). */
export async function eliminaProgettoPredefinito(id) { await ripristinaEsempio(id); }
