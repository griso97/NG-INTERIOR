// =============================================================================
// TEMA chiaro / scuro — NG INTERIOR
// =============================================================================
// Default: scuro (identità del brand: nero + oro). La modalità chiara schiarisce
// le superfici dei contenuti mantenendo header e accenti oro.
// =============================================================================

const CHIAVE = 'ng-tema';

export function temaCorrente() {
  try { return localStorage.getItem(CHIAVE) || 'scuro'; } catch (e) { return 'scuro'; }
}

export function applicaTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(CHIAVE, t); } catch (e) { /* no-op */ }
  aggiornaBottone(t);
}

function aggiornaBottone(t) {
  const b = document.getElementById('tema-toggle');
  if (!b) return;
  const chiaro = t === 'chiaro';
  b.textContent = chiaro ? '☾ Scuro' : '☀ Chiaro';  // ☾ / ☀
  b.setAttribute('aria-label', chiaro ? 'Passa alla modalità scura' : 'Passa alla modalità chiara');
}

/** Collega il pulsante #tema-toggle (lo stato iniziale lo imposta lo script inline). */
export function agganciaTema() {
  const t = temaCorrente();
  document.documentElement.setAttribute('data-theme', t);
  aggiornaBottone(t);
  const b = document.getElementById('tema-toggle');
  if (b) b.addEventListener('click', () => applicaTema(temaCorrente() === 'chiaro' ? 'scuro' : 'chiaro'));
}
