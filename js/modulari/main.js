// =============================================================================
// MOBILI MODULARI — Passo 1 (forma del vano) + navigazione tra i passi
// =============================================================================
import { FORME, VALORI_ESEMPIO, infoForma, calcolaForma } from './forma.js?v=20261112g';
import { renderPasso2, apriDistinta, stiliTema } from './passo2.js?v=20261112g';
import { agganciaTema } from '../tema.js?v=20261112g';

const KEY = 'ng-modulari-v1';
const pannello = document.getElementById('mod-pannello');
const riepilogo = document.getElementById('mod-riepilogo');
const svg = document.getElementById('mod-svg');

// ---------------------------------------------------------------------------
// Stato (salvato nel browser)
// ---------------------------------------------------------------------------
function statoIniziale() {
  return {
    step: 1,
    formaId: 'triangolo', valori: JSON.parse(JSON.stringify(VALORI_ESEMPIO)), specchia: false, profondita: 600,
    modalita: 'moduli',                       // 'moduli' (come armadi) | 'cubi' (liberi)
    spessori: { carcassa: 18, schiena: 10, ante: 18 },
    moduli: { uguali: true, numero: 3, larghezzaUsata: null, comune: { ante: 1, lato: 'dx', ripiani: 1 }, lista: [], chiusura: 'anta' },
    cubi: [], cuboSel: null,
    nuovoCubo: { w: 400, h: 400, fronte: 'aperto', ripiani: 0 },
  };
}
function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.formaId) {
      const base = statoIniziale();
      return {
        ...base, ...s,
        valori: { ...base.valori, ...(s.valori || {}) },
        spessori: { ...base.spessori, ...(s.spessori || {}) },
        moduli: { ...base.moduli, ...(s.moduli || {}), comune: { ...base.moduli.comune, ...((s.moduli || {}).comune || {}) } },
        nuovoCubo: { ...base.nuovoCubo, ...(s.nuovoCubo || {}) },
        cubi: Array.isArray(s.cubi) ? s.cubi : [],
      };
    }
  } catch { /* stato rovinato: riparto */ }
  return statoIniziale();
}
let stato = carica();
function salva() { try { localStorage.setItem(KEY, JSON.stringify(stato)); } catch { /* niente */ } }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 1 }));

// Icone delle forme (stessa logica dei punti, in piccolo)
const ICONE = {
  triangolo: 'M6 40 H58 L6 6 Z',
  rettangolo: 'M10 40 H54 V6 H10 Z',
  trapezio: 'M6 40 H58 V30 L6 6 Z',
  mansarda: 'M6 40 H58 V26 L24 6 H6 Z',
  capanna: 'M6 40 H58 V26 L32 6 L6 26 Z',
  sei: 'M4 40 H60 V28 L42 8 H22 L4 28 Z',
};

// ---------------------------------------------------------------------------
// Calcolo corrente
// ---------------------------------------------------------------------------
function risultato() {
  return calcolaForma(stato.formaId, stato.valori[stato.formaId] || {}, stato.specchia);
}
/** Lettere delle pareti per ogni campo (anche se le misure ora sono sbagliate). */
function lettereCampi(r) {
  let ris = r;
  if (!r.ok) ris = calcolaForma(stato.formaId, VALORI_ESEMPIO[stato.formaId], stato.specchia);
  const mappa = {};
  for (const p of ris.pareti || []) if (p.campo) (mappa[p.campo] ||= []).push(p.lettera);
  return mappa;
}

// ---------------------------------------------------------------------------
// Pannello sinistro
// ---------------------------------------------------------------------------
function renderPannello(r) {
  const f = infoForma(stato.formaId);
  const valori = stato.valori[f.id] || {};
  const lettere = lettereCampi(r);
  pannello.innerHTML = `
    <section>
      <h3>1 · Forma del vano</h3>
      <div class="forme-grid">
        ${FORME.map((x) => `
          <button type="button" class="forma-card ${x.id === f.id ? 'attiva' : ''}" data-forma="${x.id}">
            <svg viewBox="0 0 64 46" aria-hidden="true"><path d="${ICONE[x.id]}"/></svg>
            <span class="fc-nome">${esc(x.nome)}</span>
            <span class="fc-lati">${x.pareti} pareti</span>
          </button>`).join('')}
      </div>
      <p class="forma-descr">${esc(f.descr)}</p>
      ${f.specchiabile ? `<label class="chk chk-specchia"><input type="checkbox" id="mod-specchia" ${stato.specchia ? 'checked' : ''}> Specchia (il lato alto va a destra)</label>` : ''}
    </section>
    <section>
      <h3>2 · Misure delle pareti (mm)</h3>
      ${f.campi.map((c) => {
        const calc = r.calcolati && r.calcolati[c.id] != null && (valori[c.id] === '' || valori[c.id] == null) ? r.calcolati[c.id] : null;
        return `
        <div class="campo-misura" data-box="${c.id}">
          <label class="cm-et" for="campo-${c.id}">
            <span class="lettera">${esc((lettere[c.id] || ['?']).join('/'))}</span>
            ${esc(c.nome)} ${c.opz ? '<span class="cm-opz">· facoltativa</span>' : ''}
          </label>
          <input type="number" inputmode="decimal" min="1" step="1" id="campo-${c.id}" data-campo="${c.id}"
            value="${esc(valori[c.id] ?? '')}" placeholder="${c.opz ? 'si calcola dalle altre' : 'mm'}">
          <div class="cm-calc" ${calc != null ? '' : 'hidden'}>${calc != null ? `= ${fmt(calc)} mm (calcolata)` : ''}</div>
        </div>`;
      }).join('')}
      <div class="mod-azioni">
        <button type="button" class="btn-ghost" id="mod-esempio">Misure d'esempio</button>
        <button type="button" class="btn-ghost" id="mod-svuota">Svuota</button>
      </div>
    </section>
    <section>
      <h3>3 · Profondità del vano</h3>
      <label>Profondità (mm) — servirà per i moduli
        <input type="number" inputmode="decimal" min="100" step="10" id="mod-prof" value="${esc(stato.profondita)}">
      </label>
      <button type="button" class="btn-oro" id="vai-moduli-2" style="width:100%;margin-top:6px">Avanti: moduli →</button>
      <div class="mod-msg err" id="vai-moduli-err" hidden></div>
    </section>`;

  pannello.querySelectorAll('.forma-card').forEach((b) => b.addEventListener('click', () => {
    stato.formaId = b.dataset.forma; salva(); aggiorna();
  }));
  const sp = document.getElementById('mod-specchia');
  if (sp) sp.addEventListener('change', () => { stato.specchia = sp.checked; salva(); aggiorna(); });
  pannello.querySelectorAll('input[data-campo]').forEach((inp) => {
    // Aggiorno disegno e riepilogo mentre si scrive; il pannello si ridisegna
    // solo all'uscita dal campo, così il cursore non salta.
    inp.addEventListener('input', () => {
      (stato.valori[f.id] ||= {})[inp.dataset.campo] = inp.value; salva();
      const r2 = risultato(); renderDisegno(r2); renderRiepilogo(r2); aggiornaCalcolate(r2);
    });
  });
  document.getElementById('mod-esempio').addEventListener('click', () => {
    stato.valori[f.id] = { ...VALORI_ESEMPIO[f.id] }; salva(); aggiorna();
  });
  document.getElementById('mod-svuota').addEventListener('click', () => {
    stato.valori[f.id] = Object.fromEntries(f.campi.map((c) => [c.id, ''])); salva(); aggiorna();
  });
  const prof = document.getElementById('mod-prof');
  prof.addEventListener('change', () => { const n = Number(prof.value); stato.profondita = n > 0 ? n : 600; salva(); aggiorna(); });
  // Secondo pulsante "Avanti" qui sotto: da telefono il riepilogo è in fondo alla pagina.
  document.getElementById('vai-moduli-2').addEventListener('click', () => {
    const r2 = risultato();
    const box = document.getElementById('vai-moduli-err');
    if (!r2.ok) { box.textContent = r2.errori.join(' '); box.hidden = false; return; }
    vaiA(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/** Aggiorna solo le scritte "= … calcolata" sotto i campi (senza ridisegnare il pannello). */
function aggiornaCalcolate(r) {
  const valori = stato.valori[stato.formaId] || {};
  pannello.querySelectorAll('.campo-misura[data-box]').forEach((box) => {
    const id = box.dataset.box;
    const el = box.querySelector('.cm-calc');
    const vuoto = valori[id] === '' || valori[id] == null;
    const calc = r.calcolati && r.calcolati[id] != null && vuoto ? r.calcolati[id] : null;
    el.hidden = calc == null;
    el.textContent = calc == null ? '' : `= ${fmt(calc)} mm (calcolata)`;
  });
}

// ---------------------------------------------------------------------------
// Disegno frontale quotato (SVG)
// ---------------------------------------------------------------------------
function renderDisegno(r) {
  if (!r.ok) {
    svg.setAttribute('viewBox', '0 0 1000 600');
    svg.innerHTML = `<text x="500" y="300" text-anchor="middle" fill="currentColor" style="fill:var(--testo-dim)" font-size="34">Completa le misure per vedere il disegno</text>`;
    return;
  }
  const pts = r.punti, n = pts.length;
  const W = r.larghezza, H = r.altezzaMax;
  const S = Math.max(W, H);
  const m = S * 0.16;                       // margine per quote
  const fs = S / 34;                        // dimensione testo
  const sw = S / 380;                       // spessore linee
  const Y = (y) => H - y;                   // y in su → y SVG in giù
  const mB = Math.max(m, fs * 8);           // sotto c'è anche la quota d'ingombro
  svg.setAttribute('viewBox', `${-m} ${-m} ${W + 2 * m} ${H + m + mB}`);

  // Griglia 100 mm (500 mm più marcata)
  let griglia = '';
  const passo = S > 6000 ? 500 : 100;
  for (let x = 0; x <= W + 0.1; x += passo) {
    const forte = Math.round(x) % 500 === 0;
    griglia += `<line x1="${x}" y1="${Y(0)}" x2="${x}" y2="${Y(H)}" stroke="var(--oro)" stroke-opacity="${forte ? 0.16 : 0.07}" stroke-width="${sw * 0.5}"/>`;
  }
  for (let y = 0; y <= H + 0.1; y += passo) {
    const forte = Math.round(y) % 500 === 0;
    griglia += `<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}" stroke="var(--oro)" stroke-opacity="${forte ? 0.16 : 0.07}" stroke-width="${sw * 0.5}"/>`;
  }

  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${Y(p.y)}`).join(' ') + ' Z';
  // Tratteggio pavimento
  let pav = `<line x1="${-m * 0.4}" y1="${Y(0)}" x2="${W + m * 0.4}" y2="${Y(0)}" stroke="var(--testo-dim)" stroke-width="${sw}"/>`;
  for (let x = -m * 0.4; x < W + m * 0.4; x += fs * 1.2) {
    pav += `<line x1="${x}" y1="${Y(0) + fs * 0.9}" x2="${x + fs * 0.9}" y2="${Y(0)}" stroke="var(--testo-dim)" stroke-opacity=".45" stroke-width="${sw * 0.6}"/>`;
  }

  // Pareti: linea, lettera e misura sul lato esterno
  let pareti = '';
  r.pareti.forEach((p, i) => {
    const a = pts[i], b = pts[(i + 1) % n];
    const inc = p.tipo === 'inclinata';
    pareti += `<line x1="${a.x}" y1="${Y(a.y)}" x2="${b.x}" y2="${Y(b.y)}" stroke="${inc ? 'var(--mod-acc)' : 'var(--oro)'}" stroke-width="${sw * (inc ? 3.2 : 2.4)}" ${inc ? `stroke-dasharray="${sw * 10} ${sw * 5}"` : ''} stroke-linecap="round"/>`;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (b.y - a.y) / L, ny = -(b.x - a.x) / L;       // normale esterna (antiorario)
    const mx = (a.x + b.x) / 2 + nx * fs * 1.6, my = (a.y + b.y) / 2 + ny * fs * 1.6;
    const testo = `${fmt(p.lunghezza)}${inc ? ` · ${fmt(p.inclinazione)}°` : ''}`;
    pareti += `<g>
      <circle cx="${mx}" cy="${Y(my)}" r="${fs * 0.75}" fill="var(--oro)"/>
      <text x="${mx}" y="${Y(my)}" font-size="${fs * 0.85}" text-anchor="middle" dominant-baseline="central" font-weight="700" fill="#111">${p.lettera}</text>
      <text x="${mx + nx * fs * 1.9}" y="${Y(my + ny * fs * 1.9)}" font-size="${fs}" text-anchor="middle" dominant-baseline="central"
        fill="${p.inserita ? 'var(--testo)' : 'var(--mod-acc)'}" font-style="${p.inserita ? 'normal' : 'italic'}">${testo}</text>
    </g>`;
  });

  // Angoli interni: valore dentro il vano, lungo la bisettrice; quadratino se 90°
  let angoli = '';
  pts.forEach((p, i) => {
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    const u1x = prev.x - p.x, u1y = prev.y - p.y, l1 = Math.hypot(u1x, u1y) || 1;
    const u2x = next.x - p.x, u2y = next.y - p.y, l2 = Math.hypot(u2x, u2y) || 1;
    let bx = u1x / l1 + u2x / l2, by = u1y / l1 + u2y / l2;
    const bl = Math.hypot(bx, by);
    const ang = r.angoli[i];
    if (bl < 1e-6) return;
    bx /= bl; by /= bl;
    if (ang > 180) { bx = -bx; by = -by; }
    if (Math.abs(ang - 90) < 0.05) {
      const q = fs * 0.9;
      const ax = p.x + (u1x / l1) * q, ay = p.y + (u1y / l1) * q;
      const cx = p.x + (u2x / l2) * q, cy = p.y + (u2y / l2) * q;
      angoli += `<path d="M${ax} ${Y(ay)} L${ax + (u2x / l2) * q} ${Y(ay + (u2y / l2) * q)} L${cx} ${Y(cy)}" fill="none" stroke="var(--testo-dim)" stroke-width="${sw * 0.9}"/>`;
      return;
    }
    const dist = fs * (ang < 45 ? 4.2 : 2.6);
    angoli += `<text x="${p.x + bx * dist}" y="${Y(p.y + by * dist)}" font-size="${fs * 0.95}" text-anchor="middle" dominant-baseline="central" fill="var(--mod-acc)">${fmt(ang)}°</text>`;
  });

  // Quote d'ingombro: larghezza sotto, altezza massima a sinistra
  const qy = Y(0) + fs * 5.4;
  const quote = `
    <line x1="0" y1="${qy}" x2="${W}" y2="${qy}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
    <line x1="0" y1="${qy - fs * 0.6}" x2="0" y2="${qy + fs * 0.6}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
    <line x1="${W}" y1="${qy - fs * 0.6}" x2="${W}" y2="${qy + fs * 0.6}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
    <text x="${W / 2}" y="${qy + fs * 1.3}" font-size="${fs * 0.9}" text-anchor="middle" fill="var(--testo-dim)">ingombro ${fmt(W)} × h ${fmt(H)} mm</text>`;

  const html = `${griglia}${pav}
    <path d="${d}" fill="var(--oro)" fill-opacity=".08" stroke="none"/>
    ${pareti}${angoli}${quote}
    ${pts.map((p) => `<circle cx="${p.x}" cy="${Y(p.y)}" r="${sw * 2.6}" fill="var(--mod-acc)"/>`).join('')}`;
  // I colori del tema (var(--…)) vanno come stile: negli attributi SVG non tutti i browser li leggono.
  svg.innerHTML = stiliTema(html);
}

// ---------------------------------------------------------------------------
// Riepilogo (destra)
// ---------------------------------------------------------------------------
function renderRiepilogo(r) {
  const f = infoForma(stato.formaId);
  if (!r.ok) {
    riepilogo.innerHTML = `<h3>Riepilogo</h3>${r.errori.map((e) => `<div class="mod-msg err">${esc(e)}</div>`).join('')}`;
    return;
  }
  const colmo = r.calcolati.colmoAltezza != null
    ? `<div class="riep-riga"><span>Colmo: altezza</span><strong>${fmt(r.calcolati.colmoAltezza)} mm</strong></div>
       <div class="riep-riga"><span>Colmo: da sinistra</span><strong>${fmt(r.calcolati.colmoDaSinistra)} mm</strong></div>` : '';
  riepilogo.innerHTML = `
    <h3>Riepilogo · ${esc(f.nome)}</h3>
    ${r.avvisi.map((a) => `<div class="mod-msg avv">${esc(a)}</div>`).join('')}
    <table class="tab-pareti">
      <tr><th></th><th>Parete</th><th style="text-align:right">mm</th></tr>
      ${r.pareti.map((p) => `<tr>
        <td><span class="lettera">${p.lettera}</span></td>
        <td>${esc(p.nome)}${p.inserita ? '' : '<span class="calc">calcolata</span>'}</td>
        <td class="num">${fmt(p.lunghezza)}${p.inclinazione != null ? `<span class="calc">${fmt(p.inclinazione)}° dal pavimento</span>` : ''}</td>
      </tr>`).join('')}
    </table>
    <h3>Angoli</h3>
    <table class="tab-pareti">
      ${r.angoli.map((a, i) => {
        const n = r.pareti.length;
        const prima = r.pareti[(i - 1 + n) % n].lettera, dopo = r.pareti[i].lettera;
        return `<tr><td>tra ${prima} e ${dopo}</td><td class="num">${fmt(a)}°</td></tr>`;
      }).join('')}
    </table>
    <div class="riep-riga"><span>Ingombro larghezza</span><strong>${fmt(r.larghezza)} mm</strong></div>
    <div class="riep-riga"><span>Altezza massima</span><strong>${fmt(r.altezzaMax)} mm</strong></div>
    ${colmo}
    <div class="riep-riga"><span>Profondità</span><strong>${fmt(stato.profondita)} mm</strong></div>
    <div class="riep-riga"><span>Superficie frontale</span><strong>${fmt(r.area_m2)} m²</strong></div>
    <button type="button" class="btn-oro" id="vai-moduli" style="width:100%;margin-top:14px">Avanti: moduli →</button>`;
  document.getElementById('vai-moduli').addEventListener('click', () => vaiA(2));
}

// ---------------------------------------------------------------------------
// Navigazione tra i passi
// ---------------------------------------------------------------------------
const NOMI_PASSI = { 1: 'Passo 1 — Forma del vano (vista frontale)', 2: 'Passo 2 — Moduli dentro il vano', 3: 'Passo 3 — Rendering 3D' };
function vaiA(n) {
  const r = risultato();
  if (n >= 2 && !r.ok) { stato.step = 1; salva(); aggiorna(); return; }
  if (n === 4) { if (stato.step !== 2) { stato.step = 2; salva(); aggiorna(); } apriDistinta(); return; }
  stato.step = n; salva(); aggiorna();
}
function aggiornaStepper(r) {
  document.querySelectorAll('#stepper .step').forEach((b) => {
    const n = Number(b.dataset.step);
    b.classList.toggle('attivo', n === stato.step);
    if (n === stato.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    if (n >= 2) { b.disabled = !r.ok; b.classList.toggle('disabilitato', !r.ok); }
  });
  const info = document.getElementById('step-info');
  if (info) info.textContent = NOMI_PASSI[stato.step] || '';
}
document.querySelectorAll('#stepper .step').forEach((b) => b.addEventListener('click', () => {
  const n = Number(b.dataset.step);
  vaiA(n);
}));

// Il 3D (three.js) si carica solo quando si apre il passo 3.
const canvas3d = document.getElementById('mod-3d');
let passo3 = null;
const legenda = document.querySelector('.vista-strumenti .legenda');
function mostra3d(si) {
  canvas3d.hidden = !si;
  svg.style.display = si ? 'none' : '';
  if (legenda) legenda.textContent = si ? 'Vista 3D · trascina per girare' : 'Vista frontale · griglia 100 mm · misure in mm';
  if (!si && passo3) passo3.esci3d();
}

function aggiorna() {
  const r = risultato();
  if (stato.step >= 2 && !r.ok) stato.step = 1;
  aggiornaStepper(r);
  const c = { stato, salva, aggiorna, forma: r, svg, pannello, riepilogo, esc, fmt, canvas: canvas3d };
  if (stato.step === 3) {
    mostra3d(true);
    import('./passo3.js?v=20261112g').then((m) => { passo3 = m; if (stato.step === 3) m.renderPasso3(c); })
      .catch(() => { riepilogo.innerHTML = '<div class="mod-msg err">Non riesco a caricare il 3D. Ricarica la pagina.</div>'; });
    return;
  }
  mostra3d(false);
  if (stato.step === 2) { renderPasso2(c); return; }
  renderPannello(r); renderDisegno(r); renderRiepilogo(r);
}

agganciaTema();
aggiorna();
