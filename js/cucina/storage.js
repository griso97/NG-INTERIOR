// =============================================================================
// Persistenza progetto cucina in localStorage
// =============================================================================
const CHIAVE = 'ng-cucina-progetto-v1';

export function salvaProgetto(progetto) {
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
