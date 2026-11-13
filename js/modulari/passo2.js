// =============================================================================
// MOBILI MODULARI — Passo 2: moduli (come gli armadi) o cubi liberi
// =============================================================================
import {
  layoutModuli, layoutCubi, abbondanzaDi, gradi, larghezzaUtileAuto, distintaModulari, posizioneValida,
  primoPostoLibero, agganciaCubo, SPESSORI_DEFAULT,
} from './calcoli.js?v=20261114s';
import { esportaExcel, apriModelloExcel } from '../modello-export.js?v=20261114s';
import { schemaTagliPNG } from './schema-tagli.js?v=20261114s';

const FRONTI = [
  { v: 0, l: 'Aperto (a giorno)' },
  { v: 1, l: '1 anta' },
  { v: 2, l: '2 ante' },
];
const MISURE_RAPIDE = [300, 400, 500, 600, 800];
const NOMI_MAT = { carcassa: 'Carcassa', schiena: 'Schiena', ante: 'Ante' };

let ctx = null;          // { stato, salva, aggiorna, forma, svg, pannello, riepilogo, esc, fmt }
let geo = null;          // geometria dell'ultimo disegno (per il trascinamento)

const sp = () => ({ ...SPESSORI_DEFAULT, ...(ctx.stato.spessori || {}) });
const numero = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const nuovoId = () => 'c' + Math.random().toString(36).slice(2, 9);
/** fill/stroke con colori del tema → un UNICO attributo style per elemento
 *  (negli attributi SVG var() non è letto da tutti i browser, e due "style"
 *  sullo stesso elemento fanno perdere il secondo). */
export function stiliTema(html) {
  return html.replace(/<[a-z]+\b[^>]*>/gi, (tag) => {
    const st = [];
    const t = tag.replace(/\s(fill|stroke)="(var\(--[a-z-]+\))"/g, (_, k, v) => { st.push(`${k}:${v}`); return ''; });
    if (!st.length) return tag;
    return t.replace(/(\/?>)$/, ` style="${st.join(';')}"$1`);
  });
}

export function renderPasso2(c) {
  ctx = c;
  renderPannello();
  renderDisegno();
  renderRiepilogo();
}
function ridisegna() { renderDisegno(); renderRiepilogo(); }
function tutto() { ctx.salva(); renderPannello(); ridisegna(); }

// ---------------------------------------------------------------------------
// Pannello sinistro
// ---------------------------------------------------------------------------
function opzFronte(sel) {
  return FRONTI.map((f) => `<option value="${f.v}" ${Number(sel) === f.v ? 'selected' : ''}>${f.l}</option>`).join('');
}
function renderPannello() {
  const { stato, esc, fmt } = ctx;
  const s = sp();
  const modo = stato.modalita;
  let corpo = '';
  if (modo === 'moduli') {
    const m = stato.moduli;
    const auto = larghezzaUtileAuto(ctx.forma);
    const lay = layoutModuli(ctx.forma, m, s);
    if (m.uguali) {
      corpo = `
        <label>Numero moduli
          <input type="number" min="1" max="20" step="1" data-k="numero" value="${esc(m.numero)}"></label>
        <label>Larghezza occupata (mm) · vuoto = automatica (${fmt(auto.utile)})
          <input type="number" min="100" step="10" data-k="larghezzaUsata" value="${esc(m.larghezzaUsata ?? '')}" placeholder="${auto.utile}"></label>
        <label>Fronte di ogni modulo
          <select data-k="ante">${opzFronte(m.comune.ante)}</select></label>
        ${Number(m.comune.ante) === 1 ? `<label>Apertura anta
          <select data-k="lato"><option value="dx" ${m.comune.lato !== 'sx' ? 'selected' : ''}>a destra</option><option value="sx" ${m.comune.lato === 'sx' ? 'selected' : ''}>a sinistra</option></select></label>` : ''}
        <label>Ripiani per modulo
          <input type="number" min="0" max="10" step="1" data-k="ripiani" value="${esc(m.comune.ripiani)}"></label>
        <div class="mod-prossimo">Ogni modulo: ${fmt(lay.moduli[0]?.larghezza ?? 0)} mm.</div>`;
    } else {
      const somma = m.lista.reduce((t, x) => t + (Number(x.larghezza) || 0), 0);
      corpo = `
        ${m.lista.map((x, i) => `
          <div class="mod-card">
            <div class="mod-card-head"><strong>Modulo ${i + 1}</strong>
              <button type="button" class="btn-mini mod-del" data-i="${i}" title="Togli modulo">×</button></div>
            <div class="grid-2">
              <label>Larghezza<input type="number" min="60" step="10" data-i="${i}" data-c="larghezza" value="${esc(x.larghezza)}"></label>
              <label>Ripiani<input type="number" min="0" max="10" step="1" data-i="${i}" data-c="ripiani" value="${esc(x.ripiani ?? 0)}"></label>
            </div>
            <label>Fronte<select data-i="${i}" data-c="ante">${opzFronte(x.ante)}</select></label>
            ${Number(x.ante) === 1 ? `<label>Apertura<select data-i="${i}" data-c="lato"><option value="dx" ${x.lato !== 'sx' ? 'selected' : ''}>a destra</option><option value="sx" ${x.lato === 'sx' ? 'selected' : ''}>a sinistra</option></select></label>` : ''}
          </div>`).join('')}
        <button type="button" class="btn-ghost" id="mod-add" style="width:100%">+ Aggiungi modulo</button>
        <div class="mod-prossimo">Somma moduli ${fmt(somma)} mm su ${fmt(ctx.forma.larghezza)} mm del vano · liberi ${fmt(ctx.forma.larghezza - somma)} mm.</div>`;
    }
    corpo = `
      <section>
        <h3>Moduli</h3>
        <label class="radio"><input type="radio" name="mod-tipo" value="uguali" ${m.uguali ? 'checked' : ''}> Tutti uguali (divisione automatica)</label>
        <label class="radio"><input type="radio" name="mod-tipo" value="diversi" ${!m.uguali ? 'checked' : ''}> Moduli diversi (misura, fronte e ripiani per modulo)</label>
        <div style="margin-top:10px">${corpo}</div>
        ${lay.resto > 2 * s.carcassa + 20 ? `<label style="margin-top:12px">Punta bassa in fondo (${fmt(Math.round(lay.resto))} mm)
          <select id="mod-chiusura">
            <option value="fisso" ${(m.chiusura || 'fisso') === 'fisso' ? 'selected' : ''}>Pannello fisso (tamponamento)</option>
            <option value="anta" ${m.chiusura === 'anta' ? 'selected' : ''}>Modulo di chiusura con anta</option>
            <option value="aperto" ${m.chiusura === 'aperto' ? 'selected' : ''}>Modulo di chiusura aperto (a giorno)</option>
            <option value="no" ${m.chiusura === 'no' ? 'selected' : ''}>Lascia vuoto</option>
          </select></label>
        <p class="mod-prossimo" style="margin-top:-4px">${(m.chiusura || 'fisso') === 'fisso' ? 'Un pannello fisso a filo delle ante, nella stessa finitura: chiude la punta e non si apre.'
          : lay.chiusura?.triangolare ? 'Triangolare: fondo, top inclinato appoggiato sul fondo, un fianco, schiena e anta a triangolo.' : 'Chiude lo spazio rimasto verso il lato basso.'}</p>` : ''}
      </section>`;
  } else {
    const n = stato.nuovoCubo;
    const sel = stato.cubi.find((x) => x.id === stato.cuboSel);
    corpo = `
      <section>
        <h3>Nuovo cubo</h3>
        <div class="grid-2">
          <label>Larghezza<input type="number" min="100" step="10" data-n="w" value="${esc(n.w)}"></label>
          <label>Altezza<input type="number" min="100" step="10" data-n="h" value="${esc(n.h)}"></label>
        </div>
        <div class="chips-misura">${MISURE_RAPIDE.map((v) => `<button type="button" class="btn-mini chip-q" data-q="${v}">${v / 10}×${v / 10}</button>`).join('')}</div>
        <label>Fronte<select data-n="fronte"><option value="aperto" ${n.fronte !== 'anta' ? 'selected' : ''}>Aperto (a giorno)</option><option value="anta" ${n.fronte === 'anta' ? 'selected' : ''}>Con anta</option></select></label>
        <label>Ripiani<input type="number" min="0" max="10" step="1" data-n="ripiani" value="${esc(n.ripiani)}"></label>
        <button type="button" class="btn-oro" id="cubo-add" style="width:100%">+ Aggiungi cubo</button>
        <p class="mod-prossimo">Trascina i cubi nel disegno: si agganciano al pavimento, alle pareti e agli altri cubi. Se diventano rossi sono fuori dal vano o sopra un altro cubo.</p>
      </section>
      ${ctx.forma.pareti.some((p) => p.tipo === 'inclinata') ? `
      <section>
        <h3>Sotto l'inclinata</h3>
        <label class="chk"><input type="checkbox" id="cubi-adatta" ${stato.cubiAdatta !== false ? 'checked' : ''}> Adatta i cubi all'inclinata</label>
        <p class="mod-prossimo" style="margin-top:4px">I cubi che non hanno niente sopra salgono fino all'inclinata: il top diventa inclinato e copre tutto.</p>
        ${stato.cubiAdatta !== false ? `<label style="margin-top:8px">Punta bassa in fondo
          <select id="cubi-chiusura">
            <option value="fisso" ${(stato.cubiChiusura || 'fisso') === 'fisso' ? 'selected' : ''}>Pannello fisso (tamponamento)</option>
            <option value="anta" ${stato.cubiChiusura === 'anta' ? 'selected' : ''}>Modulo di chiusura con anta</option>
            <option value="aperto" ${stato.cubiChiusura === 'aperto' ? 'selected' : ''}>Modulo di chiusura aperto</option>
            <option value="no" ${stato.cubiChiusura === 'no' ? 'selected' : ''}>Lascia vuoto</option>
          </select></label>` : ''}
      </section>` : ''}
      ${stato.cubi.length ? `
      <section>
        <h3>Ante di tutti i cubi</h3>
        <div class="mod-azioni">
          <button type="button" class="btn-ghost" data-tutti-fronte="anta">🚪 Tutti con anta</button>
          <button type="button" class="btn-ghost" data-tutti-fronte="aperto">Tutti aperti</button>
        </div>
      </section>` : ''}
      ${sel ? `
      <section>
        <h3>Cubo selezionato</h3>
        <div class="grid-2">
          <label>Larghezza<input type="number" min="100" step="10" data-s="w" value="${esc(sel.w)}"></label>
          <label>Altezza<input type="number" min="100" step="10" data-s="h" value="${esc(sel.h)}"></label>
          <label>Da sinistra (x)<input type="number" step="1" data-s="x" value="${esc(Math.round(sel.x))}"></label>
          <label>Da terra (y)<input type="number" step="1" data-s="y" value="${esc(Math.round(sel.y))}"></label>
        </div>
        <label>Fronte<select data-s="fronte"><option value="aperto" ${sel.fronte !== 'anta' ? 'selected' : ''}>Aperto (a giorno)</option><option value="anta" ${sel.fronte === 'anta' ? 'selected' : ''}>Con anta</option></select></label>
        ${sel.fronte === 'anta' ? `<label>Apertura<select data-s="lato"><option value="dx" ${sel.lato !== 'sx' ? 'selected' : ''}>a destra</option><option value="sx" ${sel.lato === 'sx' ? 'selected' : ''}>a sinistra</option></select></label>` : ''}
        <label>Ripiani<input type="number" min="0" max="10" step="1" data-s="ripiani" value="${esc(sel.ripiani || 0)}"></label>
        ${stato.cubiAdatta !== false && ctx.forma.pareti.some((p) => p.tipo === 'inclinata') ? `<label class="chk"><input type="checkbox" id="cubo-adatta" ${sel.adatta !== false ? 'checked' : ''}> Questo cubo sale fino all'inclinata</label>` : ''}
        <div class="mod-azioni">
          <button type="button" class="btn-ghost" id="cubo-dup">Duplica</button>
          <button type="button" class="btn-ghost" id="cubo-del">Elimina</button>
        </div>
        <div class="mod-msg err" id="cubo-err" hidden></div>
      </section>` : `<section><p class="mod-prossimo">Tocca un cubo nel disegno per modificarlo.</p></section>`}`;
  }

  ctx.pannello.innerHTML = `
    <section>
      <h3>Modalità</h3>
      <div class="mod-switch">
        <button type="button" class="btn-ghost ${modo === 'moduli' ? 'attivo' : ''}" data-modo="moduli">A moduli<br><small>come gli armadi</small></button>
        <button type="button" class="btn-ghost ${modo === 'cubi' ? 'attivo' : ''}" data-modo="cubi">Cubi liberi<br><small>li metti tu</small></button>
      </div>
    </section>
    ${corpo}
    <section>
      <h3>Spessori e profondità (mm)</h3>
      <div class="grid-3">
        <label>Carcassa<input type="number" min="5" step="1" data-sp="carcassa" value="${esc(s.carcassa)}"></label>
        <label>Schiena<input type="number" min="2" step="1" data-sp="schiena" value="${esc(s.schiena)}"></label>
        <label>Ante<input type="number" min="5" step="1" data-sp="ante" value="${esc(s.ante)}"></label>
      </div>
      <label>Profondità esterna<input type="number" min="100" step="10" id="p2-prof" value="${esc(stato.profondita)}"></label>
      <p class="mod-prossimo">Assemblaggio come gli armadi: top e fondo passanti, fianchi in mezzo, schiena dietro.</p>
    </section>
    <section>
      <h3>Abbondanza tagli inclinati (mm)</h3>
      <div class="grid-3">
        <label>Fianchi<input type="number" min="0" max="200" step="1" data-abb="fianchi" value="${esc(abbondanzaDi(stato).fianchi)}"></label>
        <label>Top<input type="number" min="0" max="200" step="1" data-abb="top" value="${esc(abbondanzaDi(stato).top)}"></label>
        <label>Ante/pann.<input type="number" min="0" max="200" step="1" data-abb="ante" value="${esc(abbondanzaDi(stato).ante)}"></label>
      </div>
      <p class="mod-prossimo">Solo per i pezzi con il lato inclinato: fianchi e top più lunghi; ante e pannelli fissi più grandi sul lato inclinato, da rifilare a filo in opera (muri e scale non sono mai dritti). Fondo, ripiani e schiena restano a misura.</p>
    </section>`;
  agganciaPannello();
}

function agganciaPannello() {
  const { stato } = ctx;
  const P = ctx.pannello;
  P.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { stato.modalita = b.dataset.modo; tutto(); }));
  P.querySelectorAll('input[data-sp]').forEach((i) => i.addEventListener('input', () => {
    const n = numero(i.value); if (n > 0) { (stato.spessori ||= {})[i.dataset.sp] = n; ctx.salva(); ridisegna(); }
  }));
  P.querySelectorAll('input[data-abb]').forEach((i) => i.addEventListener('input', () => {
    const n = numero(i.value); if (!(n >= 0 && n <= 200)) return;
    (stato.abbondanza ||= {})[i.dataset.abb] = Math.round(n); ctx.salva(); ridisegna();
  }));
  const prof = P.querySelector('#p2-prof');
  if (prof) prof.addEventListener('input', () => { const n = numero(prof.value); if (n >= 100) { stato.profondita = n; ctx.salva(); ridisegna(); } });

  if (stato.modalita === 'moduli') {
    const m = stato.moduli;
    P.querySelectorAll('input[name="mod-tipo"]').forEach((r) => r.addEventListener('change', () => {
      const diversi = r.value === 'diversi';
      if (diversi && !m.lista.length) {
        // Parte dalla divisione attuale, così non si riscrive tutto a mano
        const lay = layoutModuli(ctx.forma, { ...m, uguali: true }, sp());
        m.lista = lay.moduli.map((x) => ({ larghezza: x.larghezza, ante: m.comune.ante, lato: m.comune.lato, ripiani: m.comune.ripiani }));
      }
      m.uguali = !diversi; tutto();
    }));
    P.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('input', () => {
      const k = i.dataset.k;
      if (k === 'larghezzaUsata') { const n = numero(i.value); m.larghezzaUsata = i.value === '' || !(n > 0) ? null : n; }
      else if (k === 'numero') { const n = Math.round(numero(i.value)); if (n >= 1 && n <= 20) m.numero = n; else return; }
      else if (k === 'ripiani') { const n = Math.round(numero(i.value)); if (n >= 0 && n <= 10) m.comune.ripiani = n; else return; }
      ctx.salva(); ridisegna();
    }));
    P.querySelectorAll('select[data-k]').forEach((s) => s.addEventListener('change', () => {
      if (s.dataset.k === 'ante') m.comune.ante = Number(s.value); else m.comune.lato = s.value;
      tutto();
    }));
    P.querySelectorAll('input[data-c]').forEach((i) => i.addEventListener('input', () => {
      const x = m.lista[+i.dataset.i]; const n = numero(i.value);
      if (i.dataset.c === 'larghezza') { if (n > 0) x.larghezza = n; else return; }
      else { const r = Math.round(n); if (r >= 0 && r <= 10) x.ripiani = r; else return; }
      ctx.salva(); ridisegna();
    }));
    P.querySelectorAll('select[data-c]').forEach((s) => s.addEventListener('change', () => {
      const x = m.lista[+s.dataset.i];
      if (s.dataset.c === 'ante') x.ante = Number(s.value); else x.lato = s.value;
      tutto();
    }));
    const ch = P.querySelector('#mod-chiusura');
    if (ch) ch.addEventListener('change', () => { m.chiusura = ch.value; tutto(); });
    P.querySelectorAll('.mod-del').forEach((b) => b.addEventListener('click', () => { m.lista.splice(+b.dataset.i, 1); tutto(); }));
    const add = P.querySelector('#mod-add');
    if (add) add.addEventListener('click', () => {
      const somma = m.lista.reduce((t, x) => t + (Number(x.larghezza) || 0), 0);
      const libero = Math.max(0, Math.floor((ctx.forma.larghezza - somma) / 10) * 10);
      m.lista.push({ larghezza: Math.min(600, libero) || 600, ante: m.comune.ante, lato: m.comune.lato, ripiani: m.comune.ripiani });
      tutto();
    });
    return;
  }

  // --- Cubi ---
  const n = stato.nuovoCubo;
  P.querySelectorAll('input[data-n]').forEach((i) => i.addEventListener('input', () => {
    const v = numero(i.value); if (v >= 0) { n[i.dataset.n] = i.dataset.n === 'ripiani' ? Math.round(v) : v; ctx.salva(); }
  }));
  P.querySelectorAll('select[data-n]').forEach((s) => s.addEventListener('change', () => { n[s.dataset.n] = s.value; ctx.salva(); }));
  P.querySelectorAll('.chip-q').forEach((b) => b.addEventListener('click', () => {
    n.w = n.h = Number(b.dataset.q); tutto();
  }));
  P.querySelectorAll('[data-tutti-fronte]').forEach((b) => b.addEventListener('click', () => {
    stato.cubi.forEach((c) => { c.fronte = b.dataset.tuttiFronte; });
    n.fronte = b.dataset.tuttiFronte;            // anche i prossimi cubi
    tutto();
  }));
  const ad = P.querySelector('#cubi-adatta');
  if (ad) ad.addEventListener('change', () => { stato.cubiAdatta = ad.checked; tutto(); });
  const cc = P.querySelector('#cubi-chiusura');
  if (cc) cc.addEventListener('change', () => { stato.cubiChiusura = cc.value; tutto(); });
  P.querySelector('#cubo-add').addEventListener('click', () => {
    const w = Number(n.w), h = Number(n.h);
    if (!(w >= 100 && h >= 100)) { alert('Misura del cubo non valida (minimo 100 mm).'); return; }
    const pos = primoPostoLibero(ctx.forma, stato.cubi, w, h);
    if (!pos) { alert('Nel vano non c\'è più posto libero per un cubo di questa misura.'); return; }
    const c = { id: nuovoId(), x: pos.x, y: pos.y, w, h, fronte: n.fronte, lato: 'dx', ripiani: Number(n.ripiani) || 0 };
    stato.cubi.push(c); stato.cuboSel = c.id; tutto();
  });
  const sel = stato.cubi.find((x) => x.id === stato.cuboSel);
  if (!sel) return;
  const errBox = P.querySelector('#cubo-err');
  const ca = P.querySelector('#cubo-adatta');
  if (ca) ca.addEventListener('change', () => { sel.adatta = ca.checked; ctx.salva(); ridisegna(); });
  P.querySelectorAll('input[data-s]').forEach((i) => i.addEventListener('change', () => {
    const k = i.dataset.s, v = numero(i.value);
    if (k === 'ripiani') { const r = Math.round(v); if (r >= 0 && r <= 10) sel.ripiani = r; ctx.salva(); ridisegna(); return; }
    if (!Number.isFinite(v)) return;
    const prova = { ...sel, [k]: v };
    if (posizioneValida(ctx.forma, stato.cubi, prova)) {
      Object.assign(sel, prova); errBox.hidden = true; ctx.salva(); ridisegna();
    } else {
      errBox.textContent = 'Così il cubo esce dal vano o va sopra un altro cubo: misura non applicata.';
      errBox.hidden = false; i.value = Math.round(sel[k]);
    }
  }));
  P.querySelectorAll('select[data-s]').forEach((s) => s.addEventListener('change', () => { sel[s.dataset.s] = s.value; tutto(); }));
  P.querySelector('#cubo-del').addEventListener('click', () => {
    stato.cubi = stato.cubi.filter((x) => x.id !== sel.id); stato.cuboSel = null; tutto();
  });
  P.querySelector('#cubo-dup').addEventListener('click', () => {
    const pos = primoPostoLibero(ctx.forma, stato.cubi, sel.w, sel.h);
    if (!pos) { alert('Non c\'è posto libero per un altro cubo uguale.'); return; }
    const c = { ...sel, id: nuovoId(), ...pos }; stato.cubi.push(c); stato.cuboSel = c.id; tutto();
  });
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------
function renderDisegno() {
  const { forma: r, stato, fmt, svg } = ctx;
  const pts = r.punti;
  const W = r.larghezza, H = r.altezzaMax, S = Math.max(W, H);
  const m = S * 0.12, fs = S / 38, sw = S / 420;
  const Y = (y) => H - y;
  const mB = fs * 5.5;
  svg.setAttribute('viewBox', `${-m} ${-m} ${W + 2 * m} ${H + m + mB}`);
  geo = { H, fs, sw };
  const s = sp();

  let html = '';
  const passo = S > 6000 ? 500 : 100;
  for (let x = 0; x <= W + 0.1; x += passo) html += `<line x1="${x}" y1="${Y(0)}" x2="${x}" y2="${Y(H)}" stroke="var(--oro)" stroke-opacity="${Math.round(x) % 500 === 0 ? 0.12 : 0.05}" stroke-width="${sw * 0.5}"/>`;
  for (let y = 0; y <= H + 0.1; y += passo) html += `<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}" stroke="var(--oro)" stroke-opacity="${Math.round(y) % 500 === 0 ? 0.12 : 0.05}" stroke-width="${sw * 0.5}"/>`;
  html += `<line x1="${-m * 0.4}" y1="${Y(0)}" x2="${W + m * 0.4}" y2="${Y(0)}" stroke="var(--testo-dim)" stroke-width="${sw}"/>`;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${Y(p.y)}`).join(' ') + ' Z';
  html += `<path d="${d}" fill="var(--oro)" fill-opacity=".05" stroke="var(--oro)" stroke-width="${sw * 2}" stroke-dasharray="${sw * 6} ${sw * 4}"/>`;

  // Un "mobile" generico: contorno (anche inclinato), fronte, ripiani
  const disegnaMobile = (x0, x1, hL, hR, ante, lato, ripiani, extra = '') => {
    const L = x1 - x0;
    const top = (x) => hL + ((hR - hL) * (x - x0)) / L;
    let g = `<path d="M${x0} ${Y(0)} L${x1} ${Y(0)} L${x1} ${Y(hR)} L${x0} ${Y(hL)} Z" fill="${ante > 0 ? 'var(--oro)' : 'var(--bg)'}" fill-opacity="${ante > 0 ? 0.16 : 0.55}" stroke="var(--testo)" stroke-width="${sw * 1.6}" ${extra}/>`;
    // ripiani (sotto il lato basso, così sono interi)
    const hBasso = Math.min(hL, hR);
    for (let k = 1; k <= ripiani; k++) {
      const yk = s.carcassa + (k * (hBasso - 2 * s.carcassa)) / (ripiani + 1);
      g += `<line x1="${x0 + s.carcassa}" y1="${Y(yk)}" x2="${x1 - s.carcassa}" y2="${Y(yk)}" stroke="var(--testo-dim)" stroke-width="${sw * (ante > 0 ? 0.8 : 1.4)}" ${ante > 0 ? `stroke-dasharray="${sw * 4} ${sw * 3}"` : ''}/>`;
    }
    if (ante > 0) {
      const la = (L - (ante + 1) * 2) / ante;
      for (let i = 0; i < ante; i++) {
        const xa = x0 + 2 + i * (la + 2), xb = xa + la;
        g += `<path d="M${xa} ${Y(2)} L${xb} ${Y(2)} L${xb} ${Y(top(xb) - 2)} L${xa} ${Y(top(xa) - 2)} Z" fill="none" stroke="var(--mod-acc)" stroke-width="${sw}"/>`;
        // maniglia sul lato di apertura
        const xm = ante === 1 ? (lato === 'sx' ? xa + la * 0.12 : xb - la * 0.12) : (i === 0 ? xb - la * 0.12 : xa + la * 0.12);
        const ym = Math.min(top(xm), hBasso) * 0.5 + 40;
        g += `<line x1="${xm}" y1="${Y(ym - fs * 1.2)}" x2="${xm}" y2="${Y(ym + fs * 1.2)}" stroke="var(--mod-acc)" stroke-width="${sw * 2.4}" stroke-linecap="round"/>`;
      }
    }
    return g;
  };

  // Modulo/pannello di chiusura della punta bassa (moduli e cubi)
  const disegnaChiusura = (ch, qy) => {
    let html = '';
    if (ch.fronte === 'fisso') {
      const pth = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${Y(y)}`).join(' ') + ' Z';
      html += `<path d="${pth(ch.pannello.profilo)}" fill="var(--oro)" fill-opacity=".3" stroke="var(--testo)" stroke-width="${sw * 1.6}"/>`;
    } else if (ch.triangolare) {
      const pth = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${Y(y)}`).join(' ') + ' Z';
      const conAnta = ch.fronte === 'anta';
      html += `<path d="${pth(ch.profili.contorno)}" fill="${conAnta ? 'var(--oro)' : 'var(--bg)'}" fill-opacity="${conAnta ? 0.16 : 0.55}" stroke="var(--testo)" stroke-width="${sw * 1.6}"/>`;
      if (conAnta) html += `<path d="${pth(ch.profili.anta)}" fill="none" stroke="var(--mod-acc)" stroke-width="${sw}"/>`;
      else html += `<path d="${pth(ch.profili.top)}" fill="var(--testo-dim)" fill-opacity=".35" stroke="none"/>`;
    } else {
      html += disegnaMobile(ch.x0, ch.x1, ch.hL, ch.hR, ch.fronte === 'anta' ? 1 : 0, ch.daSinistra ? 'dx' : 'sx', 0);
    }
    const cx = ch.triangolare ? ch.xT + ch.dir * ch.larghezza * 0.3 : (ch.x0 + ch.x1) / 2;
    html += `<text x="${cx}" y="${Y(ch.hAlto * 0.3)}" font-size="${fs * 0.9}" text-anchor="middle" dominant-baseline="central" fill="var(--testo)" font-weight="600">C</text>`;
    html += `<line x1="${ch.x0}" y1="${qy - fs * 0.5}" x2="${ch.x0}" y2="${qy + fs * 0.5}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
      <line x1="${ch.x1}" y1="${qy - fs * 0.5}" x2="${ch.x1}" y2="${qy + fs * 0.5}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
      <line x1="${ch.x0}" y1="${qy}" x2="${ch.x1}" y2="${qy}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
      <text x="${(ch.x0 + ch.x1) / 2}" y="${qy + fs * 1.3}" font-size="${fs * 0.9}" text-anchor="middle" fill="var(--testo)">${fmt(Math.round(ch.larghezza))}</text>`;
    return html;
  };

  if (stato.modalita === 'moduli') {
    const lay = layoutModuli(r, stato.moduli, s);
    let catena = '';
    const qy = Y(0) + fs * 2.4;
    lay.moduli.forEach((md) => {
      html += disegnaMobile(md.x0, md.x1, md.hL, md.hR, Number(md.ante), md.lato, md.ripiani);
      const cx = (md.x0 + md.x1) / 2;
      html += `<text x="${cx}" y="${Y(Math.min(md.hL, md.hR) / 2)}" font-size="${fs * 1.05}" text-anchor="middle" dominant-baseline="central" fill="var(--testo)" font-weight="600">M${md.indice + 1}</text>`;
      catena += `<line x1="${md.x0}" y1="${qy - fs * 0.5}" x2="${md.x0}" y2="${qy + fs * 0.5}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
        <line x1="${md.x1}" y1="${qy - fs * 0.5}" x2="${md.x1}" y2="${qy + fs * 0.5}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
        <line x1="${md.x0}" y1="${qy}" x2="${md.x1}" y2="${qy}" stroke="var(--testo-dim)" stroke-width="${sw}"/>
        <text x="${cx}" y="${qy + fs * 1.3}" font-size="${fs * 0.9}" text-anchor="middle" fill="var(--testo)">${fmt(md.larghezza)}</text>`;
    });
    if (lay.chiusura) html += disegnaChiusura(lay.chiusura, qy);
    html += catena;
  } else {
    const lc = layoutCubi(r, stato, s);
    if (lc.chiusura) html += disegnaChiusura(lc.chiusura, Y(0) + fs * 2.4);
    stato.cubi.forEach((c, i) => {
      const ok = posizioneValida(r, stato.cubi, c);
      const sel = c.id === stato.cuboSel;
      html += `<g data-cubo="${c.id}" class="cubo ${ok ? '' : 'cubo-errato'} ${sel ? 'cubo-sel' : ''}" style="cursor:grab">
        ${cuboHtml(c, lc.elementi[i], ok, sel, s, fmt)}
      </g>`;
    });
    if (!stato.cubi.length) {
      html += `<text x="${W / 2}" y="${Y(H / 2)}" font-size="${fs * 1.1}" text-anchor="middle" fill="var(--testo-dim)">Aggiungi un cubo dal pannello</text>`;
    }
  }
  svg.innerHTML = stiliTema(html);
  if (stato.modalita === 'cubi') agganciaTrascinamento();
}

/** Disegno di un cubo (base a c.y); se adattato il top segue l'inclinata. */
function cuboHtml(c, e, ok, sel, s, fmt) {
  const { H, fs, sw } = geo;
  const Y = (y) => H - y;
  const x0 = c.x, x1 = c.x + c.w, y0 = c.y;
  const yL = y0 + e.hL, yR = y0 + e.hR;
  const top = (x) => yL + ((yR - yL) * (x - x0)) / c.w;
  const anta = c.fronte === 'anta';
  const pth = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${Y(y)}`).join(' ') + ' Z';
  let g = `<path class="cubo-forma" d="${pth([[x0, y0], [x1, y0], [x1, yR], [x0, yL]])}" fill="${anta ? 'var(--oro)' : 'var(--bg)'}" fill-opacity="${anta ? 0.16 : 0.55}"
    stroke="${ok ? (sel ? 'var(--oro)' : 'var(--testo)') : 'var(--err)'}" stroke-width="${sw * (sel ? 3.4 : 1.6)}"/>`;
  if (e.adattato) {
    // la parte aggiunta sopra il cubo, tratteggiata sul bordo del cubo di partenza
    g += `<line x1="${x0}" y1="${Y(y0 + c.h)}" x2="${x1}" y2="${Y(y0 + c.h)}" stroke="var(--testo-dim)" stroke-width="${sw * 0.8}" stroke-dasharray="${sw * 4} ${sw * 3}"/>`;
  }
  for (let k = 1; k <= (c.ripiani || 0); k++) {
    const yk = y0 + s.carcassa + (k * (c.h - 2 * s.carcassa)) / ((c.ripiani || 0) + 1);
    g += `<line x1="${x0 + s.carcassa}" y1="${Y(yk)}" x2="${x1 - s.carcassa}" y2="${Y(yk)}" stroke="var(--testo-dim)" stroke-width="${sw * (anta ? 0.8 : 1.4)}" ${anta ? `stroke-dasharray="${sw * 4} ${sw * 3}"` : ''}/>`;
  }
  if (anta) {
    g += `<path d="${pth([[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x1 - 2, top(x1 - 2) - 2], [x0 + 2, top(x0 + 2) - 2]])}" fill="none" stroke="var(--mod-acc)" stroke-width="${sw}"/>`;
    const xm = c.lato === 'sx' ? x0 + c.w * 0.12 : x1 - c.w * 0.12;
    const ym = y0 + c.h / 2;
    g += `<line x1="${xm}" y1="${Y(ym - fs)}" x2="${xm}" y2="${Y(ym + fs)}" stroke="var(--mod-acc)" stroke-width="${sw * 2.4}" stroke-linecap="round"/>`;
  }
  const fsT = Math.min(fs, c.w / 6);
  g += `<text x="${(x0 + x1) / 2}" y="${Y(y0 + c.h / 2)}" font-size="${fsT}" text-anchor="middle" dominant-baseline="central" fill="var(--testo)" pointer-events="none">${fmt(c.w)}×${fmt(c.h)}</text>`;
  if (e.adattato) g += `<text x="${(x0 + x1) / 2}" y="${Y(y0 + c.h / 2) + fsT * 1.25}" font-size="${fsT * 0.75}" text-anchor="middle" dominant-baseline="central" fill="var(--mod-acc)" pointer-events="none">↗ ${fmt(Math.round(e.hL))} / ${fmt(Math.round(e.hR))}</text>`;
  return g;
}

// ---------------------------------------------------------------------------
// Trascinamento dei cubi
// ---------------------------------------------------------------------------
function puntoMm(evt) {
  const pt = ctx.svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const p = pt.matrixTransform(ctx.svg.getScreenCTM().inverse());
  return { x: p.x, y: geo.H - p.y };
}
function agganciaTrascinamento() {
  const { stato, svg } = ctx;
  svg.querySelectorAll('[data-cubo]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      const c = stato.cubi.find((x) => x.id === el.dataset.cubo);
      if (!c) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const p0 = puntoMm(e);
      const off = { x: p0.x - c.x, y: p0.y - c.y };
      const inizio = { x: c.x, y: c.y };
      let ultima = { ...inizio }, valida = true, mosso = false;
      stato.cuboSel = c.id;
      el.style.cursor = 'grabbing';
      const muovi = (ev) => {
        const p = puntoMm(ev);
        const grezzo = { ...c, x: p.x - off.x, y: p.y - off.y };
        if (Math.hypot(grezzo.x - inizio.x, grezzo.y - inizio.y) > 5) mosso = true;
        const ag = agganciaCubo(ctx.forma, stato.cubi, grezzo);
        ultima = ag;
        valida = posizioneValida(ctx.forma, stato.cubi, { ...c, ...ag });
        el.setAttribute('transform', `translate(${ag.x - inizio.x} ${-(ag.y - inizio.y)})`);
        const rett = el.querySelector('.cubo-forma');
        if (rett) rett.style.stroke = valida ? 'var(--oro)' : 'var(--err)';
      };
      const fine = () => {
        el.removeEventListener('pointermove', muovi);
        el.removeEventListener('pointerup', fine);
        el.removeEventListener('pointercancel', fine);
        if (mosso && valida) { c.x = ultima.x; c.y = ultima.y; }
        ctx.salva(); renderPannello(); ridisegna();
      };
      el.addEventListener('pointermove', muovi);
      el.addEventListener('pointerup', fine);
      el.addEventListener('pointercancel', fine);
    });
  });
}

// ---------------------------------------------------------------------------
// Riepilogo e distinta
// ---------------------------------------------------------------------------
function renderRiepilogo() {
  const { stato, esc, fmt } = ctx;
  const dist = distintaModulari(ctx.forma, stato);
  let lista = '';
  if (stato.modalita === 'moduli') {
    const lay = layoutModuli(ctx.forma, stato.moduli, sp());
    lista = `<table class="tab-pareti">
      <tr><th>Mod.</th><th style="text-align:right">Largh.</th><th style="text-align:right">H sx / dx</th></tr>
      ${lay.moduli.map((m) => `<tr><td>M${m.indice + 1} · ${Number(m.ante) ? `${m.ante} ${Number(m.ante) === 1 ? 'anta' : 'ante'}` : 'aperto'}</td>
        <td class="num">${fmt(m.larghezza)}</td><td class="num">${fmt(Math.round(m.hL))} / ${fmt(Math.round(m.hR))}</td></tr>`).join('')}
      ${lay.chiusura ? `<tr><td>C · ${lay.chiusura.fronte === 'fisso' ? 'pannello fisso' : `${lay.chiusura.triangolare ? 'triangolo' : 'chiusura'}, ${lay.chiusura.fronte === 'anta' ? 'anta' : 'aperto'}`}</td>
        <td class="num">${fmt(Math.round(lay.chiusura.larghezza))}</td><td class="num">${fmt(Math.round(lay.chiusura.hL))} / ${fmt(Math.round(lay.chiusura.hR))}</td></tr>` : ''}
    </table>`;
  } else {
    const lcR = layoutCubi(ctx.forma, stato, sp());
    lista = stato.cubi.length ? `<table class="tab-pareti">
      <tr><th>Cubo</th><th style="text-align:right">Misura</th><th style="text-align:right">Posizione</th></tr>
      ${stato.cubi.map((c, i) => `<tr><td>${i + 1} · ${c.fronte === 'anta' ? 'anta' : 'aperto'}</td>
        <td class="num">${fmt(c.w)}×${lcR.elementi[i].adattato ? `${fmt(Math.round(lcR.elementi[i].hL))}/${fmt(Math.round(lcR.elementi[i].hR))}` : fmt(c.h)}</td><td class="num">${fmt(Math.round(c.x))}, ${fmt(Math.round(c.y))}</td></tr>`).join('')}
    </table>` : '<p class="mod-prossimo">Nessun cubo ancora.</p>';
  }
  ctx.riepilogo.innerHTML = `
    <h3>Riepilogo · ${stato.modalita === 'moduli' ? 'moduli' : 'cubi'}</h3>
    ${dist.errori.map((e) => `<div class="mod-msg err">${esc(e)}</div>`).join('')}
    ${dist.avvisi.map((a) => `<div class="mod-msg avv">${esc(a)}</div>`).join('')}
    ${avvisoInclinati(dist, esc)}
    ${lista}
    <div class="riep-riga"><span>Pezzi da tagliare</span><strong>${fmt(dist.totalePezzi)}</strong></div>
    <div class="riep-riga"><span>m² carcassa</span><strong>${fmt(Math.round(dist.mq.carcassa * 100) / 100)}</strong></div>
    <div class="riep-riga"><span>m² schiena</span><strong>${fmt(Math.round(dist.mq.schiena * 100) / 100)}</strong></div>
    <div class="riep-riga"><span>m² ante</span><strong>${fmt(Math.round(dist.mq.ante * 100) / 100)}</strong></div>
    <button type="button" class="btn-oro" id="p2-3d" style="width:100%;margin-top:14px">Avanti: rendering 3D →</button>
    <button type="button" class="btn-ghost" id="p2-distinta" style="width:100%;margin-top:8px">📋 Distinta di taglio</button>
    <button type="button" class="btn-ghost" id="p2-indietro" style="width:100%;margin-top:8px">← Forma del vano</button>`;
  ctx.riepilogo.querySelector('#p2-distinta').addEventListener('click', () => apriDistinta());
  ctx.riepilogo.querySelector('#p2-3d').addEventListener('click', () => { stato.step = 3; ctx.salva(); ctx.aggiorna(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  ctx.riepilogo.querySelector('#p2-indietro').addEventListener('click', () => { stato.step = 1; ctx.salva(); ctx.aggiorna(); });
}

/** Avviso dei tagli inclinati: per modulo quali pezzi sono più lunghi. */
const cm = (mm) => `${String(Math.round(mm) / 10).replace('.', ',')} cm`;
function avvisoInclinati(dist, esc) {
  const t = dist.tagliInclinati || [];
  if (!t.length) return '';
  return `<div class="mod-msg avv mod-incl"><strong>⚠ Attenzione: tagli inclinati.</strong> Questi pezzi sono tagliati più lunghi, da rifilare in opera all'inclinazione indicata:
    <ul>${t.map((r) => `<li><strong>${esc(r.modulo)}</strong>: ${[
      r.fianchi ? `${r.fianchi === 1 ? 'fianco' : `${r.fianchi} fianchi`} +${cm(r.abbFianchi)}` : '',
      r.top ? `top +${cm(r.abbTop)}` : '',
      r.ante ? `${r.ante === 1 ? 'anta' : `${r.ante} ante`} +${cm(r.abbAnte)} sul lato inclinato` : '',
      r.pannelli ? `pannello fisso +${cm(r.abbAnte)} sul lato inclinato` : '',
    ].filter(Boolean).join(', ')} · inclinazione ${gradi(r.angolo)}</li>`).join('')}</ul>
    <span class="mod-incl-nota">Fianchi a piombo, top parallelo alla scala: bordo alto dei fianchi e testate del top con la lama inclinata dell'angolo indicato (vedi colonna “Taglio”). Ante e pannelli fissi più grandi sul lato inclinato, da rifilare a filo. Fondo, ripiani e schiena sono già a misura.</span></div>`;
}
const tr = (s) => (typeof s === 'string' && window.NGI18N ? window.NGI18N.t(s) : s);   // lingua (i18n.js)
let schemiPrecedenti = [];
async function creaSchemi(dist) {
  schemiPrecedenti.forEach((x) => URL.revokeObjectURL(x.url));
  schemiPrecedenti = [];
  const gruppi = new Map();
  for (const r of dist.tagliInclinati || []) {
    const g = gradi(r.angolo);
    if (!gruppi.has(g)) gruppi.set(g, { angolo: r.angolo, moduli: [], abbFianchi: r.abbFianchi, abbTop: r.abbTop });
    gruppi.get(g).moduli.push(r.modulo);
  }
  const abb = abbondanzaDi(ctx.stato);
  const lista = [];
  for (const [g, x] of gruppi) {
    try {
      const png = await schemaTagliPNG({ angolo: x.angolo, spessore: sp().carcassa, abbFianchi: abb.fianchi, abbTop: abb.top, abbAnte: abb.ante,
        moduli: x.moduli, triangolo: x.moduli.some((m) => /triangolare/i.test(m)), titolo: 'Schema tagli inclinati' });
      lista.push({ ...png, gradi: g, foglio: gruppi.size > 1 ? `Schema tagli ${g.replace('°', '')}` : 'Schema tagli' });
    } catch { /* senza schema la distinta resta valida */ }
  }
  schemiPrecedenti = lista;
  return lista;
}
let nomiFiniture = null;     // id → nome (caricati quando si apre la distinta)
const nomeMat = (p) => `${NOMI_MAT[p.materiale] || p.materiale}${p.finitura ? ` · ${(nomiFiniture && nomiFiniture.get(p.finitura)) || p.finitura}` : ''}`;
function pezziPerExcel(dist) {
  return dist.pezzi.map((p) => ({ nome: p.nome, larghezza: p.larghezza, altezza: p.altezza, spessore: p.spessore,
    quantita: p.quantita, materiale: nomeMat(p), modulo: p.modulo, gruppo: '', note: p.note || '' }));
}
export async function apriDistinta(c) {
  if (c) ctx = c;
  if (!ctx) return;
  if (!nomiFiniture) {
    try { const { MATERIALI } = await import('../materiali.js?v=20261114s'); nomiFiniture = new Map(MATERIALI.map((m) => [m.id, m.nome])); }
    catch { nomiFiniture = new Map(); }
  }
  const { stato, esc, fmt } = ctx;
  const dist = distintaModulari(ctx.forma, stato);
  // Schemi dei tagli inclinati (uno per inclinazione): in distinta e nell'Excel
  const schemi = await creaSchemi(dist);
  const perModulo = new Map();
  for (const p of dist.pezzi) { if (!perModulo.has(p.modulo)) perModulo.set(p.modulo, []); perModulo.get(p.modulo).push(p); }
  const corpo = document.getElementById('distinta-corpo');
  corpo.innerHTML = `
    ${dist.errori.map((e) => `<div class="mod-msg err">${esc(e)}</div>`).join('')}
    ${avvisoInclinati(dist, esc)}
    ${schemi.map((x, i) => `<figure class="schema-tagli"><img src="${x.url}" alt="Schema tagli inclinati a ${esc(x.gradi)}">
      <figcaption><span>Schema tagli · scala a ${esc(x.gradi)} — è anche nell'Excel (foglio “${esc(x.foglio)}”)</span>
      <button type="button" class="btn-ghost btn-mini" data-schema="${i}">⬇ Scarica immagine</button></figcaption></figure>`).join('')}
    ${[...perModulo.entries()].map(([mod, pz]) => `
      <div class="distinta-modulo"><h4>${esc(mod)}</h4>
        <table class="distinta-tab">
          <tr><th>Pezzo</th><th class="n">Largh.</th><th class="n">Alt./Lungh.</th><th class="n">Sp.</th><th>Materiale</th><th class="n">Q.tà</th>${pz.some((p) => p.note) ? '<th>Taglio</th>' : ''}</tr>
          ${pz.map((p) => `<tr class="${p.abbondanza ? 'pz-incl' : ''}"><td>${esc(p.nome)}${p.abbondanza ? ` <span class="pz-piu">+${cm(p.abbondanza)}</span>` : ''}</td><td class="n">${fmt(p.larghezza)}</td><td class="n">${fmt(p.altezza)}</td>
            <td class="n">${fmt(p.spessore)}</td><td>${esc(nomeMat(p))}</td><td class="n">${fmt(p.quantita)}</td>${pz.some((x) => x.note) ? `<td class="pz-taglio">${esc(p.note || '')}</td>` : ''}</tr>`).join('')}
        </table></div>`).join('') || '<p class="mod-prossimo">Nessun pezzo.</p>'}
    <div class="distinta-riepilogo">
      <div><span>Pezzi totali</span> <strong>${fmt(dist.totalePezzi)}</strong></div>
      <div><span>m² carcassa</span> <strong>${fmt(Math.round(dist.mq.carcassa * 100) / 100)}</strong></div>
      <div><span>m² schiena</span> <strong>${fmt(Math.round(dist.mq.schiena * 100) / 100)}</strong></div>
      <div><span>m² ante</span> <strong>${fmt(Math.round(dist.mq.ante * 100) / 100)}</strong></div>
    </div>`;
  const ov = document.getElementById('distinta-overlay');
  ov.hidden = false;
  const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
  const nomeFile = `modulari-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  document.getElementById('distinta-xlsx').onclick = () => esportaExcel(pezziPerExcel(dist),
    { nomeFile, progetto: 'Mobili modulari',
      immagini: schemi.map((x) => ({ foglio: tr(x.foglio), titolo: tr(`Schema tagli inclinati · scala a ${x.gradi}`), png: x.bytes, larghezza: 720, altezza: Math.round((720 * x.altezza) / x.larghezza) })) });
  corpo.querySelectorAll('[data-schema]').forEach((b) => b.addEventListener('click', () => {
    const x = schemi[+b.dataset.schema];
    const a = document.createElement('a');
    a.href = x.url; a.download = `${nomeFile}-schema-tagli-${x.gradi.replace(/[^0-9]+/g, '-').replace(/-$/, '')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }));
  document.getElementById('distinta-modello').onclick = () => apriModelloExcel({ pezzi: pezziPerExcel(dist), progetto: 'Mobili modulari' });
  document.getElementById('distinta-chiudi').onclick = () => { ov.hidden = true; };
}

// ---------------------------------------------------------------------------
// Tastiera (cubi): ritorna true se il tasto è stato usato
// ---------------------------------------------------------------------------
let appunti = null;      // cubo copiato
export function tastoCubi(e) {
  if (!ctx) return false;
  const { stato } = ctx;
  const ctrl = e.ctrlKey || e.metaKey;
  const k = (e.key || '').toLowerCase();
  const sel = stato.cubi.find((x) => x.id === stato.cuboSel);
  const incolla = (modello) => {
    const pos = primoPostoLibero(ctx.forma, stato.cubi, modello.w, modello.h);
    if (!pos) { alert('Non c\'è posto libero per un altro cubo uguale.'); return; }
    const c = { ...modello, id: nuovoId(), ...pos }; stato.cubi.push(c); stato.cuboSel = c.id; tutto();
  };
  if (ctrl && k === 'c') { if (sel) appunti = { ...sel }; return !!sel; }
  if (ctrl && k === 'v') { if (appunti) incolla(appunti); return !!appunti; }
  if (ctrl && k === 'd') { if (sel) incolla(sel); return !!sel; }
  if (!sel) return false;
  if (k === 'delete' || k === 'backspace') {
    stato.cubi = stato.cubi.filter((x) => x.id !== sel.id); stato.cuboSel = null; tutto(); return true;
  }
  if (k === 'escape') { stato.cuboSel = null; renderPannello(); ridisegna(); return true; }
  const d = { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
  if (d) {
    const passo = e.shiftKey ? 100 : 10;                     // 1 cm (Maiusc: 10 cm)
    const prova = { ...sel, x: sel.x + d[0] * passo, y: Math.max(0, sel.y + d[1] * passo) };
    if (posizioneValida(ctx.forma, stato.cubi, prova)) { sel.x = prova.x; sel.y = prova.y; ctx.salva(); renderPannello(); ridisegna(); }
    return true;
  }
  return false;
}
