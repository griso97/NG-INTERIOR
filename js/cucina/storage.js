// =============================================================================
// Persistenza progetto cucina in localStorage
// =============================================================================
// Due cucine SEPARATE, ognuna con il suo progetto in corso:
//   cucina.html?tipo=normale → cucina normale  (chiave di sempre)
//   cucina.html?tipo=ponte   → cucina a ponte
//   cucina.html              → schermata di scelta (nessun progetto)
const tipoUrl = new URLSearchParams(location.search).get('tipo');
export const MODO_CUCINA = tipoUrl === 'ponte' ? 'ponte' : tipoUrl === 'normale' ? 'normale' : null;
export const CHIAVE_NORMALE = 'ng-cucina-progetto-v1';
export const CHIAVE_PONTE = 'ng-cucina-ponte-v1';
const CHIAVE = MODO_CUCINA === 'ponte' ? CHIAVE_PONTE : CHIAVE_NORMALE;

export function salvaProgetto(progetto) {
  if (!MODO_CUCINA) return false;              // schermata di scelta: niente da salvare
  try { localStorage.setItem(CHIAVE, JSON.stringify(progetto)); return true; }
  catch (e) { console.error(e); return false; }
}

export function caricaProgetto() {
  try {
    const raw = localStorage.getItem(CHIAVE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.error(e); return null; }
}

export function resetProgetto() {
  try { localStorage.removeItem(CHIAVE); } catch (_) { /* no-op */ }
}
