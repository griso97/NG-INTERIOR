// =============================================================================
// SALVATAGGIO E CARICAMENTO CONFIGURAZIONE
// =============================================================================
// Persistenza in localStorage + export/import JSON (file) per portare un
// armadio su un'altra postazione o archiviarlo.
// =============================================================================

// ARMADIO A BATTENTE e ARMADIO SCORREVOLE sono due lavori separati, ognuno salvato a parte
// (prima stavano nello stesso posto: cambiando il colore di uno cambiava anche l'altro).
const CHIAVE = 'ng-interior-configuratore-v1';                       // armadio a battente (la chiave di sempre)
const CHIAVE_SCORREVOLE = 'ng-interior-configuratore-scorrevole-v1';  // armadio scorrevole
export const chiaveArmadio = (tipo) => (tipo === 'scorrevole' ? CHIAVE_SCORREVOLE : CHIAVE);
const leggi = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } };

export function salvaLocale(config) {
  try {
    localStorage.setItem(chiaveArmadio(config && config.tipoArmadio), JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Salvataggio locale fallito', e);
    return false;
  }
}

/** L'armadio in lavorazione di QUESTO tipo ('battente' | 'scorrevole'), o null. */
export function caricaLocale(tipo = 'battente') {
  try {
    const comune = leggi(CHIAVE);
    if (tipo === 'scorrevole') {
      const s = leggi(CHIAVE_SCORREVOLE);
      if (s) return s;
      // prima stavano insieme: se l'ultimo lavoro era uno scorrevole, è il suo (si sposta nel suo posto)
      if (comune && comune.tipoArmadio === 'scorrevole') { localStorage.setItem(CHIAVE_SCORREVOLE, JSON.stringify(comune)); return comune; }
      return null;
    }
    // battente: se nel posto comune c'era uno scorrevole, va nel suo posto e il battente riparte da capo
    if (comune && comune.tipoArmadio === 'scorrevole') {
      if (!leggi(CHIAVE_SCORREVOLE)) localStorage.setItem(CHIAVE_SCORREVOLE, JSON.stringify(comune));
      return null;
    }
    return comune;
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
