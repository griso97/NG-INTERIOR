// =============================================================================
// CUCINE DI ESEMPIO MODIFICATE DAL FALEGNAME — «Salva come predefinito»
// =============================================================================
// Gli esempi sono file del sito (esempi/cucine/): non si possono cambiare da qui. Quando il
// falegname modifica un esempio e lo salva come predefinito, la SUA versione (progetto + foto
// grande + anteprima) va sul dispositivo, insieme al catalogo: 'esempio:<id>', 'esempiofoto:<id>',
// 'esempiomini:<id>'. La galleria mostra la sua versione al posto di quella del sito; «Torna
// all'originale» la toglie. La «copia completa» le porta anche sugli altri dispositivi.
// =============================================================================
import { leggiFoto, salvaFoto, eliminaFotoTipo } from './catalogo.js?v=20261124c';

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
  if (grande) await salvaFoto(id, grande, 'esempiofoto');
  if (mini) await salvaFoto(id, mini, 'esempiomini');
  await salvaFoto(id, { progetto: dati, aggiornato: Date.now() }, 'esempio');
}
/** Torna all'esempio del sito (via la versione modificata e le sue foto). */
export async function ripristinaEsempio(id) {
  for (const t of ['esempio', 'esempiofoto', 'esempiomini']) { try { await eliminaFotoTipo(id, t); } catch (_) { /* già tolta */ } }
}
