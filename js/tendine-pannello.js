// =============================================================================
// PANNELLI ORDINATI — ogni sezione con un titolo (<section><h3>Titolo</h3>…</section>)
// diventa una TENDINA: chiusa all'inizio (tranne quelle indicate), si apre toccando
// il titolo. Quello che apri o chiudi resta così mentre lavori, anche quando il pannello si
// ridisegna; a ogni nuova visita si riparte chiuse. Vale per cucina, armadi e modulari.
// =============================================================================
// Quello che apri o chiudi resta così mentre lavori (anche quando il pannello si ridisegna), ma
// OGNI VOLTA CHE ENTRI NEL SITO si riparte con le tendine chiuse: niente memoria fra una visita e l'altra.
const _mem = {};
try { Object.keys(localStorage).filter((k) => k.startsWith('ng-tendine-')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* niente */ }
function stato(chiave) { return (_mem[chiave] ||= {}); }
function salva() { /* solo in memoria */ }
/**
 * @param {Element} root   il pannello
 * @param {string} chiave  nome della memoria (es. 'armadio', 'cucina-5')
 * @param {{aperte?: string[]}} opz  titoli (o inizio del titolo) aperti la prima volta
 */
export function tendinePannello(root, chiave, { aperte = [] } = {}) {
  if (!root) return;
  const st = stato(chiave);
  root.querySelectorAll(':scope > section').forEach((sec) => {
    const h = sec.querySelector(':scope > h3, :scope > h2');
    if (!h || sec.classList.contains('actions') || sec.hasAttribute('data-fissa') || h.hasAttribute('data-tendina-ok')) return;
    h.setAttribute('data-tendina-ok', '');
    const id = sec.getAttribute('data-tendina') || h.textContent.replace(/\s+/g, ' ').trim();
    const aperta = Object.prototype.hasOwnProperty.call(st, id) ? !!st[id]
      : sec.hasAttribute('data-aperta') || aperte.some((a) => id.startsWith(a));
    sec.classList.add('tendina-sez');
    sec.classList.toggle('chiusa', !aperta);
    h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.setAttribute('aria-expanded', String(aperta));
    const cambia = (e) => {
      if (e && e.target && e.target.closest && e.target.closest('button, input, select, a') && e.target !== h) return;
      const ap = !sec.classList.toggle('chiusa');
      st[id] = ap; h.setAttribute('aria-expanded', String(ap)); salva(chiave);
    };
    h.addEventListener('click', cambia);
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cambia(); } });
  });
}

/** Come tendinePannello, ma da sola: ogni volta che il pannello si ridisegna (pagine con più passi). */
export function tendineAutomatiche(root, chiave, opz = {}) {
  if (!root) return;
  tendinePannello(root, chiave, opz);
  new MutationObserver(() => tendinePannello(root, chiave, opz)).observe(root, { childList: true });
}
