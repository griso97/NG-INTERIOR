// =============================================================================
// SALVATAGGIO E CARICAMENTO CONFIGURAZIONE
// =============================================================================
// Persistenza in localStorage + export/import JSON (file) per portare un
// armadio su un'altra postazione o archiviarlo.
// =============================================================================

const CHIAVE = 'ng-interior-configuratore-v1';

export function salvaLocale(config) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Salvataggio locale fallito', e);
    return false;
  }
}

export function caricaLocale() {
  try {
    const raw = localStorage.getItem(CHIAVE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Caricamento locale fallito', e);
    return null;
  }
}

export function esportaJSON(config, meta = {}) {
  const payload = {
    ngInterior: true,
    versione: 1,
    salvato: new Date().toISOString(),
    meta,
    config,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nome = (meta.cliente || 'armadio').replace(/[^\w\-]+/g, '_');
  a.href = url;
  a.download = `NG_${nome}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importaJSONFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result);
        if (!p || !p.config) return rej(new Error('File non valido'));
        res(p.config);
      } catch (e) { rej(e); }
    };
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}
