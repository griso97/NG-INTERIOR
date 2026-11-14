// =============================================================================
// LIBRERIA MATERIALI — NG INTERIOR
// =============================================================================
// Database di tutti i materiali disponibili per le parti del mobile.
// Ogni materiale ha:
//   id       → identificatore stabile (slug), salvato nella config
//   nome     → nome visualizzato (quello stampato sul campione)
//   thumb    → immagine 96×96 per la palette
//   texture  → immagine 512×512 per il rendering 3D
//   colore   → fallback color (hex) usato finché la texture non è caricata
//
// Per aggiungere un nuovo materiale basta:
//   1) Mettere due jpg in /materials/ (slug.jpg + slug-thumb.jpg)
//   2) Aggiungere una riga qui sotto
// =============================================================================

import * as THREE from 'three';
import { leggiCatalogo, leggiFoto, nascosto, salvaFoto, salvaCatalogo } from './catalogo.js?v=20261116e';

// LEGNI (texture da foto reali, ripetute in base alla dimensione del pezzo)
// SOLIDI (bianco/nero/grigio matte, bianco/nero lucido) usano solo il
//   colore + proprietà di finitura, nessuna texture.
export const MATERIALI = [
  // ---- Legni batch 1 ----
  { id: 'noce-panarea-yoku', nome: 'Noce Panarea Yoku', categoria: 'legno',
    thumb: 'materials/noce-panarea-yoku-thumb.jpg',
    texture: 'materials/noce-panarea-yoku.jpg', colore: 0x8e6a3e },
  { id: 'roble-colorado', nome: 'Roble Colorado', categoria: 'legno',
    thumb: 'materials/roble-colorado-thumb.jpg',
    texture: 'materials/roble-colorado.jpg', colore: 0x9c8c7a },
  { id: 'roble-azabache', nome: 'Roble Azabache', categoria: 'legno',
    thumb: 'materials/roble-azabache-thumb.jpg',
    texture: 'materials/roble-azabache.jpg', colore: 0x2a2a28 },
  { id: 'roble-denver', nome: 'Roble Denver', categoria: 'legno',
    thumb: 'materials/roble-denver-v2-thumb.jpg',
    texture: 'materials/roble-denver-v2.jpg', colore: 0xb89a74 },   // ombra del telefono tolta
  { id: 'roble-hercules-19', nome: 'Roble Hercules 19', categoria: 'legno',
    thumb: 'materials/roble-hercules-19-thumb.jpg',
    texture: 'materials/roble-hercules-19.jpg', colore: 0xc0a07a },
  { id: 'roble-hera', nome: 'Roble Hera', categoria: 'legno',
    thumb: 'materials/roble-hera-thumb.jpg',
    texture: 'materials/roble-hera.jpg', colore: 0xd6c3a6 },
  { id: 'nogal-slow', nome: 'Nogal Slow', categoria: 'legno',
    thumb: 'materials/nogal-slow-thumb.jpg',
    texture: 'materials/nogal-slow.jpg', colore: 0x9c7a56 },
  { id: 'roble-amazona', nome: 'Roble Amazona', categoria: 'legno',
    thumb: 'materials/roble-amazona-thumb.jpg',
    texture: 'materials/roble-amazona.jpg', colore: 0xc2a580 },
  // ---- Legni batch 2 ----
  { id: 'noce-caldo', nome: 'Noce Caldo', categoria: 'legno',
    thumb: 'materials/noce-caldo-thumb.jpg',
    texture: 'materials/noce-caldo.jpg', colore: 0x7a5236,
    nota: 'nome provvisorio' },
  { id: 'roble-palma-19', nome: 'Roble Palma 19', categoria: 'legno',
    thumb: 'materials/roble-palma-19-thumb.jpg',
    texture: 'materials/roble-palma-19.jpg', colore: 0x5c4634 },
  { id: 'roble-aurora', nome: 'Roble Aurora', categoria: 'legno',
    thumb: 'materials/roble-aurora-thumb.jpg',
    texture: 'materials/roble-aurora.jpg', colore: 0xd0c3a9 },
  { id: 'rovere-nodoso', nome: 'Rovere Nodoso', categoria: 'legno',
    thumb: 'materials/rovere-nodoso-thumb.jpg',
    texture: 'materials/rovere-nodoso.jpg', colore: 0xa0804c,
    nota: 'nome provvisorio' },
  // ---- Tinte solide (matte e lucide) ----
  // OPACHI: superficie totalmente matte, tono un filo "schiarito/polveroso"
  // così lo stacco con il lucido è netto anche senza riflessi.
  { id: 'bianco-matte',  nome: 'Bianco opaco',   categoria: 'tinta',
    thumb: 'materials/bianco-matte-thumb.jpg',  colore: 0xe7e5de,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'nero-matte',    nome: 'Nero opaco',     categoria: 'tinta',
    thumb: 'materials/nero-matte-thumb.jpg',    colore: 0x1f1f23,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'grigio-matte',  nome: 'Grigio opaco',   categoria: 'tinta',
    thumb: 'materials/grigio-matte-thumb.jpg',  colore: 0x8a8a8a,
    solido: true, roughness: 1.0, metalness: 0.0 },
  // LUCIDI: laccato lucido con riflessi netti (roughness bassissima + clearcoat).
  { id: 'bianco-lucido', nome: 'Bianco lucido',  categoria: 'tinta',
    thumb: 'materials/bianco-lucido-thumb.jpg', colore: 0xfafafa,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true },
  { id: 'nero-lucido',   nome: 'Nero lucido',    categoria: 'tinta',
    thumb: 'materials/nero-lucido-thumb.jpg',   colore: 0x060607,
    solido: true, roughness: 0.04, metalness: 0.0, lucido: true },
  // ---- Encimere / piani di lavoro ----
  // Ogni encimera porta anche il proprio spessore (mm): viene applicato al
  // top della cucina quando questa encimera e' selezionata.
  { id: 'compacto-negro', nome: 'Compacto negro', categoria: 'encimera',
    thumb: 'materials/compacto-negro-thumb.jpg',
    texture: 'materials/compacto-negro.jpg', colore: 0x1a1a1a,
    spessore: 12 },
  { id: 'compacto-bernini', nome: 'Compacto Bernini', categoria: 'encimera',
    thumb: 'materials/compacto-bernini-thumb.jpg',
    texture: 'materials/compacto-bernini.jpg', colore: 0xece7dd,
    spessore: 12 },
  // Tinta solida bianca opaca (nessuna texture, solo colore + matte):
  // usa la logica "solido" del getMaterialeTHREE come i colori delle ante.
  { id: 'compacto-blanco-sm', nome: 'Compacto Blanco SM', categoria: 'encimera',
    thumb: 'materials/compacto-blanco-sm-thumb.jpg', colore: 0xeeeae2,
    solido: true, roughness: 1.0, metalness: 0.0,
    spessore: 12 },
  // ---- R3 Supra Alvic (spessore 38 mm, nomi identici alle schede prodotto) ----
  // Tinte solide: blanco, cashmere, agave (colore campionato dalla foto).
  { id: 'r3-supra-blanco', nome: 'R3 Supra 38mm Blanco', categoria: 'encimera',
    thumb: 'materials/r3-supra-blanco-thumb.jpg', colore: 0xfaf9f8,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  { id: 'r3-supra-cashmere', nome: 'R3 Supra Cashmere Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-cashmere-thumb.jpg', colore: 0xcec6bd,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  { id: 'r3-supra-agave', nome: 'R3 Supra Agave Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-agave-thumb.jpg', colore: 0xa6b0a1,
    solido: true, roughness: 1.0, metalness: 0.0, spessore: 38 },
  // Texture reali: cemento, marmi, legni.
  { id: 'r3-supra-cemento-oscuro', nome: 'R3 Supra 38mm Cemento Oscuro', categoria: 'encimera',
    thumb: 'materials/r3-supra-cemento-oscuro-thumb.jpg',
    texture: 'materials/r3-supra-cemento-oscuro.jpg', colore: 0x3a3836, spessore: 38 },
  { id: 'r3-supra-marmol-markina', nome: 'R3 Supra Mármol Markina Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-marmol-markina-thumb.jpg',
    texture: 'materials/r3-supra-marmol-markina.jpg', colore: 0x1a1a1a, spessore: 38 },
  { id: 'r3-supra-marmol-versilia', nome: 'R3 Supra Mármol Versilia Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-marmol-versilia-thumb.jpg',
    texture: 'materials/r3-supra-marmol-versilia.jpg', colore: 0xeeeeee, spessore: 38 },
  { id: 'r3-supra-picasso-03', nome: 'R3 Supra Picasso 03 Alvic', categoria: 'encimera',
    thumb: 'materials/r3-supra-picasso-03-thumb.jpg',
    texture: 'materials/r3-supra-picasso-03.jpg', colore: 0x9c7a56, spessore: 38 },
  { id: 'r3-supra-oak', nome: 'Encimera EP141NAT ANV 02 OAK R3 Supra 620x38mm', categoria: 'encimera',
    thumb: 'materials/r3-supra-oak-thumb.jpg',
    texture: 'materials/r3-supra-oak.jpg', colore: 0xcdb48a, spessore: 38 },
  // ---- Zoccoli (cucina) ----
  { id: 'nero-opaco', nome: 'Nero opaco', categoria: 'zoccolo', css: '#17171a', colore: 0x17171a,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'bianco-opaco', nome: 'Bianco opaco', categoria: 'zoccolo', css: '#eceae4', colore: 0xeceae4,
    solido: true, roughness: 1.0, metalness: 0.0 },
  { id: 'acciaio', nome: 'Acciaio', categoria: 'zoccolo', css: 'linear-gradient(135deg,#d6dadf,#9aa0a6 55%,#c2c7cc)',
    colore: 0xc6cace, solido: true, roughness: 0.3, metalness: 0.92, envMapIntensity: 1.0 },
  // ---- Maniglie ----
  { id: 'maniglia-standard', nome: 'Maniglia standard (barra)', categoria: 'maniglia', css: 'linear-gradient(135deg,#e2e3e6,#a9acb1)',
    colore: 0xcfcfcf, solido: true, roughness: 0.35, metalness: 0.6 },
];

// ---------------------------------------------------------------------------
// CATALOGO della carpinteria (js/catalogo.js): prodotti aggiunti con foto,
// prodotti nascosti per sezione, modifiche ai predefiniti.
// ---------------------------------------------------------------------------
let statoCatalogo = { prodotti: [], nascosti: {}, modifiche: {} };
const CAT_DA_SEZIONE = { legno: 'legno', fingerpull: 'legno', encimera: 'encimera', pannello: 'legno', zoccolo: 'zoccolo', maniglie: 'maniglia', oggetti: 'oggetto' };
async function applicaCatalogo() {
  statoCatalogo = await leggiCatalogo();
  // prodotti salvati con un trattamento della foto più vecchio: la texture si
  // rifà da sola dalla foto originale (una volta sola), con i colori veri
  const daRifare = statoCatalogo.prodotti.filter((p) => (p.sezione === 'legno' || p.sezione === 'fingerpull') && (p.versioneFoto || 1) < 2);
  if (daRifare.length) {
    try {
      const { aggiornaFotoProdotto } = await import('./analisi-foto.js?v=20261116e');
      for (const p of daRifare) { try { await aggiornaFotoProdotto(p, leggiFoto, salvaFoto); } catch (e) { console.warn('Foto del prodotto non aggiornata', p.id, e); p.versioneFoto = 2; } }
      await salvaCatalogo(statoCatalogo);
    } catch (e) { console.warn('Aggiornamento foto catalogo non riuscito', e); }
  }
  // modifiche ai predefiniti (nome, tipo, spessore, colore…)
  for (const m of MATERIALI) {
    const mod = statoCatalogo.modifiche[m.id];
    if (mod) Object.assign(m, { info: { ...(m.info || {}), ...mod.info }, ...(mod.nome ? { nome: mod.nome } : {}) });
  }
  for (const p of statoCatalogo.prodotti) {
    const [foto, thumb, gola] = await Promise.all([leggiFoto(p.id, 'foto'), leggiFoto(p.id, 'thumb'),
      p.sezione === 'fingerpull' ? leggiFoto(p.id, 'gola') : null]);
    if (!foto) continue;
    const url = URL.createObjectURL(foto);
    const def = {
      id: p.id, nome: p.nome || 'Senza nome', categoria: CAT_DA_SEZIONE[p.sezione] || 'legno', sezione: p.sezione,
      thumb: thumb ? URL.createObjectURL(thumb) : url, texture: url, colore: p.colore ?? 0x999999,
      spessore: p.info?.spessore ? Number(p.info.spessore) : undefined,
      info: p.info || {}, proprio: true,
    };
    if (p.campioneCm && Number(p.campioneCm.w) > 0 && Number(p.campioneCm.h) > 0) {
      def.campione = { wMm: Number(p.campioneCm.w) * 10, hMm: Number(p.campioneCm.h) * 10 };
    }
    // Finger-pull da foto: la gola (maniglia sopra) ha la sua immagine
    if (gola) def.gola = { texture: URL.createObjectURL(gola), colore: p.coloreGola ?? 0x111111 };
    // gola in TINTA UNITA (RAL scelto, o porta tutta uguale in tinta): colore pieno, nessuna foto
    if (def.gola && (p.golaTinta || (p.uguale && p.tinta))) {
      def.gola = { colore: p.golaTinta ? p.golaTinta.colore : p.tinta.colore, solido: true, ral: p.golaTinta ? p.golaTinta.ral : p.tinta.ral };
    }
    // TINTA UNITA (RAL): colore pieno, niente foto ripetuta; lucido o opaco
    if (p.tinta && p.tinta.colore != null) {
      Object.assign(def, { solido: true, colore: p.tinta.colore, ral: p.tinta.ral, lucido: !!p.tinta.lucido,
        roughness: p.tinta.lucido ? 0.08 : 0.9, metalness: 0, envMapIntensity: p.tinta.lucido ? undefined : 0.35 });
      delete def.campione;
    } else if (p.lucido != null) def.lucido = !!p.lucido;
    // Maniglia da foto: misura reale (lato lungo) e proporzioni dalla foto
    if (p.sezione === 'maniglie' && p.maniglia) {
      def.lunghezzaMm = (Number(p.maniglia.lunghezzaCm) || 15) * 10;
      def.altezzaMm = Math.max(6, def.lunghezzaMm * (Number(p.maniglia.rapporto) || 0.08));
      def.verticale = !!p.maniglia.verticale;
      def.forma = p.maniglia.forma || 'foto';
      def.formaV = p.maniglia.formaV || 0;                            // 0 = salvata prima della scelta "La mia forma"
      def.finitura = p.maniglia.finitura || null;                    // null = dal colore della foto
      if (p.maniglia.viste) {                                        // lato / sopra (facoltative)
        def.viste = p.maniglia.viste;
        const [fs, fl] = await Promise.all([leggiFoto(p.id, 'sopra'), leggiFoto(p.id, 'lato')]);
        if (fs) def.vistaSopra = URL.createObjectURL(fs);
        if (fl) def.vistaLato = URL.createObjectURL(fl);
      }
    }
    // OGGETTO / ELETTRODOMESTICO da foto: misure reali e le viste isolate per il 3D
    if (p.sezione === 'oggetti' && p.oggetto) {
      const o = p.oggetto;
      def.misure = { w: (Number(o.w) || 30) * 10, d: (Number(o.d) || 30) * 10, h: (Number(o.h) || 30) * 10 };
      def.pianta = o.pianta || 'squadrata';
      const [fl, fs, fd] = await Promise.all(['lato', 'sopra', 'dietro'].map((t) => (o.viste && o.viste[t] ? leggiFoto(p.id, t) : null)));
      def.viste = { fronte: url, lato: fl ? URL.createObjectURL(fl) : null, sopra: fs ? URL.createObjectURL(fs) : null, dietro: fd ? URL.createObjectURL(fd) : null };
    }
    MATERIALI.push(def);
    // Finger-pull → lo STESSO materiale (stessa foto, stessa misura) senza la
    // gola compare da solo fra i legni: il produttore dà lo stesso colore per
    // ante finger-pull e pannelli. Es. "Noce con maniglia nera" → "Noce".
    if (p.sezione === 'fingerpull') {
      const { gola: _g, ...base } = def;
      // anteprima SENZA la gola: la foto della sola porta (in tinta unita è già il colore pieno)
      MATERIALI.push({ ...base, thumb: def.texture, id: `${p.id}~legno`, nome: nomeSenzaGola(def.nome), categoria: 'legno', sezione: 'legno', derivato: p.id });
    }
  }
}
/** Nome del materiale senza la parte della maniglia/gola. */
export function nomeSenzaGola(nome) {
  const n = String(nome || '').replace(/[\s,·\-–+]*(\b(con|with|y|e|sin|senza)\b\s*)?(la\s+|el\s+)?\b(maniglia|gola|finger[\s-]?pull|fingerpull|tirador|u[ñn]ero|jaladera)\b.*$/i, '').trim();
  return n || String(nome || '').trim();
}
try { await applicaCatalogo(); } catch (e) { console.warn('Catalogo non caricato', e); }
if (typeof window !== 'undefined') { window.NG_MATERIALI = MATERIALI; installaSchedaProdotto(); }

/**
 * SCHEDA PRODOTTO: toccando un quadratino di materiale compare per qualche
 * secondo nome, tipo di materiale, spessore e colore (dati del catalogo).
 */
function installaSchedaProdotto() {
  if (window.__ngSchedaProdotto) return;
  window.__ngSchedaProdotto = true;
  const SEL = '[data-mat],[data-enc],[data-sch-mat],[data-zocc],[data-man]';
  let box = null, timer = null;
  const chiudi = () => { if (box) { box.remove(); box = null; } clearTimeout(timer); };
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(SEL);
    if (!b) { chiudi(); return; }
    const id = b.dataset.mat ?? b.dataset.enc ?? b.dataset.schMat ?? b.dataset.zocc ?? b.dataset.man;
    const m = id ? MATERIALI.find((x) => x.id === id) : null;
    chiudi();
    if (!m) return;
    const r = b.getBoundingClientRect();
    const info = m.info || {};
    const righe = [
      info.tipo ? ['Materiale', info.tipo] : null,
      (info.spessore || m.spessore) ? ['Spessore', `${info.spessore || m.spessore} mm`] : null,
      info.colore ? ['Colore', info.colore] : null,
      m.campione ? ['Campione', `${Math.round(m.campione.wMm / 10)} × ${Math.round(m.campione.hMm / 10)} cm`] : null,
      m.lunghezzaMm ? ['Lunghezza', `${Math.round(m.lunghezzaMm / 10)} cm`] : null,
      info.note ? ['Note', info.note] : null,
    ].filter(Boolean);
    box = document.createElement('div');
    box.className = 'ng-scheda-prodotto';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;z-index:9999;max-width:260px;background:var(--bg-2,#121212);color:var(--testo,#eee);border:1px solid var(--oro,#c9a94a);border-radius:6px;padding:9px 11px;font:13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);pointer-events:none';
    box.innerHTML = `<div style="font-weight:600;color:var(--oro-chiaro,#e8c25a);margin-bottom:${righe.length ? 4 : 0}px">${esc(m.nome)}</div>`
      + righe.map(([k, v]) => `<div><span style="color:var(--testo-dim,#aaa)">${esc(k)}:</span> ${esc(v)}</div>`).join('');
    document.body.appendChild(box);
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let x = Math.min(window.innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2));
    let y = r.top - bh - 8; if (y < 8) y = r.bottom + 8;
    box.style.left = `${x}px`; box.style.top = `${y}px`;
    timer = setTimeout(chiudi, 4000);
  }, true);
}

/** Prodotti visibili in una sezione del catalogo (con i nascosti tolti). */
export function materialiPer(sezione, { tutti = false } = {}) {
  const vis = (m) => tutti || !nascosto(statoCatalogo, sezione, m.id);
  const legni = MATERIALI.filter((m) => (m.categoria === 'legno' || m.categoria === 'tinta') && (!m.proprio || m.sezione === 'legno'));
  const propri = (sez) => MATERIALI.filter((m) => m.proprio && m.sezione === sez);
  let l;
  switch (sezione) {
    case 'legno': l = legni; break;
    // finger-pull: i legni normali + le porte finger-pull; il materiale creato in automatico
    // (porta senza gola) sta SOLO fra i materiali (Legni e colori)
    case 'fingerpull': l = [...legni.filter((m) => !m.derivato), ...propri('fingerpull')]; break;
    case 'encimera': l = MATERIALI.filter((m) => m.categoria === 'encimera'); break;
    case 'pannello': l = [...legni, ...MATERIALI.filter((m) => m.categoria === 'encimera'), ...propri('pannello')]; break;
    case 'zoccolo': l = MATERIALI.filter((m) => m.categoria === 'zoccolo'); break;
    case 'oggetti': l = propri('oggetti'); break;
    case 'maniglie': l = MATERIALI.filter((m) => m.categoria === 'maniglia'); break;
    default: l = [];
  }
  return l.filter(vis);
}
/** Sfondo CSS del quadratino (foto o colore). */
export function sfondoSwatch(m) { return m.thumb ? `url('${m.thumb}') center/cover` : (m.css || `#${(m.colore || 0).toString(16).padStart(6, '0')}`); }

// Unità delle UV del motore 3D della pagina (mm per 1 unità di UV): serve a
// mettere in SCALA VERA la foto dei prodotti propri (misura del campione).
let unitaUV = { u: 300, v: 300 };
export function impostaUnitaUV(u, v = u) { unitaUV = { u, v }; }

// COLORE IDENTICO ALLA FOTO. I prodotti del catalogo hanno un loro modo di
// prendere la luce: la luce cambia solo QUANTO è chiaro il pannello (così si
// vede il 3D: fianchi, ombre), mai la TINTA (le luci della scena sono un po'
// calde da un lato e fredde dall'altro) e niente "tone mapping" che sbiadisce.
// Un pannello illuminato come la media delle facce verticali (anta vista di
// fronte) ha esattamente i colori della foto. La luce di riferimento si misura
// da sola in ogni scena (taraLuceCatalogo): nessuna regolazione a mano.
const LUCE_FOTO = { value: 0.7 };   // luce di riferimento sui pannelli verticali (misurata)
const LUCE_PIANO = { value: 1.0 };  // luce di riferimento sui piani orizzontali (top)
const CONTRASTO_FOTO = 0.6;         // quanto la luce scurisce/schiarisce (0 = piatto)
const PARAM_FOTO = { roughness: 0.85, metalness: 0.0, envMapIntensity: 0.25 };
function coloreFoto(m, rif = LUCE_FOTO) {
  m.color.set(0xffffff);
  m.toneMapped = false;
  m.userData.ngRif = rif;
  if (!m.userData.ngFoto) {
    m.userData.ngFoto = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.ngLuceRif = m.userData.ngRif;
      sh.uniforms.ngSpec = { value: m.userData.ngSpec || 0 };   // lucido: riflessi sommati
      sh.fragmentShader = 'uniform float ngLuceRif;\nuniform float ngSpec;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
        vec3 wl = vec3(0.2126, 0.7152, 0.0722);
        float f = dot(totalDiffuse, wl) / max(dot(diffuseColor.rgb, wl), 1e-4) / ngLuceRif;
        // luce in più (es. LED): schiarisce ma non "brucia" la foto
        if (f > 1.0) f = 1.0 + 0.45 * (1.0 - exp(-(f - 1.0) * 1.6));
        outgoingLight = diffuseColor.rgb * mix(1.0, f, ${CONTRASTO_FOTO.toFixed(2)}) + totalEmissiveRadiance + totalSpecular * ngSpec;
      }
      #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'ng-foto' + (m.userData.ngSpec ? '-l' : '');
  }
  m.needsUpdate = true;
}

/**
 * Piano di lavoro (o altra lastra orizzontale) con i colori ESATTI della sua
 * foto: stesse tinte, stesse sfumature, venature visibili (la luce della
 * scena non la "brucia" più). Usa la luce di riferimento dei piani.
 */
export function pianoComeFoto(m) {
  if (!m || !m.map) return m;
  Object.assign(m, PARAM_FOTO);
  coloreFoto(m, LUCE_PIANO);
  return m;
}

/**
 * Pannello VERTICALE (es. pannello dietro il piano) con i colori esatti
 * della sua foto: usa la luce di riferimento delle pareti, non quella dei piani.
 */
export function pannelloComeFoto(m) {
  if (!m || !m.map) return m;
  Object.assign(m, PARAM_FOTO);
  coloreFoto(m, LUCE_FOTO);
  return m;
}

/**
 * Taratura AUTOMATICA della luce di riferimento (per ogni scena): misura la
 * luce che arriva su un pannello bianco opaco (stesse luci, stesso ambiente)
 * rivolto dove guardano le ante (armadi e modulari di fronte, +z; cucina in
 * media sulle 4 pareti) e, per i piani, rivolto in alto. Da chiamare dopo le luci.
 */
export function taraLuceCatalogo(renderer, scene, direzioni = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]]) {
  let rt = null, piano = null;
  const rif = LUCE_FOTO.value, rifP = LUCE_PIANO.value;
  try {
    rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.FloatType });
    // pannello bianco con lo STESSO shader dei prodotti: con riferimento 1
    // restituisce 1 - c + c·L → ricavo la luce L
    const uno = { value: 1 };
    const mb = new THREE.MeshStandardMaterial({ color: 0xffffff, ...PARAM_FOTO });
    coloreFoto(mb, uno);
    piano = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mb);
    scene.add(piano);
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 1000);
    const prima = renderer.getRenderTarget();
    const buf = new Float32Array(4);
    const misura = (dirs) => {
      let somma = 0, n = 0;
      for (const d of dirs) {
        const v = new THREE.Vector3(...d);
        piano.position.set(0, 200000, 0);
        if (Math.abs(v.y) > 0.9) piano.up.set(0, 0, -1); else piano.up.set(0, 1, 0);
        piano.lookAt(piano.position.clone().add(v));
        cam.up.copy(piano.up);
        cam.position.copy(piano.position).addScaledVector(v, 100); cam.lookAt(piano.position);
        renderer.setRenderTarget(rt); renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 1, 1, 1, 1, buf);
        const l = (0.2126 * buf[0] + 0.7152 * buf[1] + 0.0722 * buf[2] - (1 - CONTRASTO_FOTO)) / CONTRASTO_FOTO;
        if (Number.isFinite(l) && l > 0.02 && l < 50) { somma += l; n++; }
      }
      return n ? somma / n : null;
    };
    const lv = misura(direzioni), lp = misura([[0, 1, 0]]);
    renderer.setRenderTarget(prima);
    if (lv) LUCE_FOTO.value = lv;
    if (lp) LUCE_PIANO.value = lp;
    return lv;
  } catch (e) {
    console.warn('Taratura luce non riuscita', e);
    LUCE_FOTO.value = rif; LUCE_PIANO.value = rifP;
    return null;
  } finally {
    if (piano) { scene.remove(piano); piano.geometry.dispose(); piano.material.dispose(); }
    if (rt) rt.dispose();
  }
}

/**
 * Prodotti del catalogo con la misura del campione: le UV dei pezzi diventano
 * in mm/unità (le stesse di impostaUnitaUV) invece di 0..1 per faccia, così la
 * foto è alla sua misura reale e la venatura non viene stirata.
 * La foto è CENTRATA su ogni pannello: il centro della foto (es. la porta
 * intera fotografata) cade al centro dell'anta, quindi un'anta grande come
 * la porta della foto è identica alla foto; solo se l'anta è più grande la
 * foto continua a specchio verso i bordi.
 * Si chiama sul gruppo della scena dopo averla costruita.
 */
export function uvInScala(radice) {
  radice.updateMatrixWorld(true);
  const pw = new THREE.Vector3();
  radice.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mc = mats.find((m) => m && m.userData && m.userData.campioneMm);
    if (!mc) return;
    const geo = o.geometry;
    if (!geo || geo.userData.uvMm || !geo.attributes.uv || !geo.attributes.normal) return;
    const { wMm, hMm } = mc.userData.campioneMm;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox, c = { x: (bb.min.x + bb.max.x) / 2, y: (bb.min.y + bb.max.y) / 2, z: (bb.min.z + bb.max.z) / 2 };
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    // punto del legno di questo pannello: fisso per la sua posizione (non cambia
    // a ogni ridisegno), diverso da un pannello all'altro
    o.getWorldPosition(pw);
    const caso = (sx, sy) => { const t = Math.sin(Math.round(pw.x / 10) * sx + Math.round(pw.y / 10) * 0.37 + Math.round(pw.z / 10) * sy) * 43758.5453; return t - Math.floor(t); };
    const ox = mc.userData.continuo ? caso(12.9898, 78.233) * 4000 : 0, oy = mc.userData.continuo ? caso(39.346, 11.135) * 4000 : 0;
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      let u, v;
      if (ax >= ay && ax >= az) { u = pos.getZ(i) - c.z; v = pos.getY(i) - c.y; }
      else if (ay >= az) { u = pos.getX(i) - c.x; v = pos.getZ(i) - c.z; }
      else { u = pos.getX(i) - c.x; v = pos.getY(i) - c.y; }
      uv.setXY(i, (u + wMm / 2 + ox) / unitaUV.u, (v + hMm / 2 + oy) / unitaUV.v);
    }
    uv.needsUpdate = true;
    geo.userData.uvMm = true;
  });
}

// PARTI selezionabili nel pannello materiali.
// `applica` elenca le chiavi che vengono aggiornate insieme quando l'utente
// sceglie un materiale per quella "parte logica". Es. selezionando il legno
// per la Struttura, carcassa e schiena cambiano insieme (sono sempre uguali).
export const PARTI = [
  { id: 'struttura', nome: 'Struttura (carcassa + schiena + ripiani)',
    applica: ['carcassa', 'schiena'] },
  { id: 'ante', nome: 'Ante', applica: ['ante'] },
  { id: 'tamponamenti', nome: 'Tamponamenti', applica: ['tamponamenti'] },
  { id: 'cassStruttura', nome: 'Cassettiera · Struttura (scatola + fascette)',
    applica: ['cassStruttura'] },
  { id: 'cassFronti', nome: 'Cassettiera · Fronti cassetto',
    applica: ['cassFronti'] },
];

export function trovaMateriale(id) {
  return MATERIALI.find((m) => m.id === id) || MATERIALI[0];
}

// ---------- Cache + materiali three.js ----------
const loader = new THREE.TextureLoader();
const cacheTex = new Map();     // id → THREE.Texture
const cacheMat = new Map();     // id → THREE.MeshStandardMaterial

/** Materiale della gola finger-pull: tinta unita (RAL) o dalla foto. */
function matGolaDa(def) {
  if (def.gola.solido) return new THREE.MeshStandardMaterial({ color: def.gola.colore, roughness: def.lucido ? 0.15 : 0.75, metalness: 0, envMapIntensity: def.lucido ? 1.2 : 0.3 });
  return new THREE.MeshStandardMaterial({ color: def.gola.colore, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.3 });
}
/**
 * LEGNO CONTINUO dalla foto di un campione/porta: la foto diventa un legno che
 * si ripete senza giunte e senza specchi (che si notano subito: disegni
 * simmetrici, righe chiare), e alto come una colonna:
 * 1) i bordi della foto si sfumano con il lato opposto → si ripete senza giunta;
 * 2) due pezzi della stessa foto uno sopra l'altro, spostati dove le righe
 *    combaciano, con passaggio morbido → la venatura prosegue lunga.
 * Ritorna { canvas, fx, fy }: fx, fy = quante misure del campione copre un giro.
 */
function legnoContinuo(img) {
  const W0 = img && (img.naturalWidth || img.width), H0 = img && (img.naturalHeight || img.height);
  if (!(W0 > 32) || !(H0 > 32)) return null;
  const k = Math.min(1, 1024 / W0, 1200 / H0);
  const W = Math.round(W0 * k), H = Math.round(H0 * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  let A;
  try { g.drawImage(img, 0, 0, W, H); A = Float32Array.from(g.getImageData(0, 0, W, H).data); } catch (_) { return null; }
  const liscio = (t) => t * t * (3 - 2 * t);
  // 0) via la SFUMATURA DI LUCE della foto (più chiara da un lato): piano che
  //    meglio segue la luminosità, poi ogni punto riportato alla media. Resta
  //    il legno (venature, doghe), sparisce il cambio di tono alle cuciture.
  {
    let n = 0, sx = 0, sy = 0, sl = 0, sxx = 0, syy = 0, sxy = 0, sxl = 0, syl = 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * 4, l = 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2];
      const u = x / W - 0.5, v = y / H - 0.5;
      n++; sx += u; sy += v; sl += l; sxx += u * u; syy += v * v; sxy += u * v; sxl += u * l; syl += v * l;
    }
    const m = sl / n;
    // minimi quadrati (u, v centrati: sx, sy ≈ 0)
    const det = sxx * syy - sxy * sxy;
    const bu = det ? (sxl * syy - syl * sxy) / det : 0, bv = det ? (syl * sxx - sxl * sxy) / det : 0;
    if (m > 1) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = m / Math.max(8, m + bu * (x / W - 0.5) + bv * (y / H - 0.5)), i = (y * W + x) * 4;
      for (let q = 0; q < 3; q++) A[i + q] = Math.min(255, A[i + q] * k);
    }
  }
  // 0b) VENATURA DRITTA: nelle foto le righe sono spesso un filo inclinate, e
  //     sopra/sotto non combacerebbero alla cucitura. Misuro di quanto si
  //     spostano tra la parte alta e la bassa e raddrizzo (ogni riga scorre).
  {
    const fascia = (y0, y1) => { const p = new Float32Array(W); for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; p[x] += 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2]; } return p; };
    const su = fascia(0, Math.round(H * 0.25)), giu = fascia(Math.round(H * 0.75), H);
    const max = Math.round(W * 0.06), x0 = Math.round(W * 0.12), x1 = Math.round(W * 0.88);
    let best = 0, eb = Infinity;
    for (let d = -max; d <= max; d++) {
      let e = 0, ms = 0, mg = 0;
      for (let x = x0; x < x1; x++) { ms += su[x]; mg += giu[x + d]; }
      ms /= x1 - x0; mg /= x1 - x0;
      for (let x = x0; x < x1; x++) e += Math.abs((su[x] - ms) - (giu[x + d] - mg));
      if (e < eb) { eb = e; best = d; }
    }
    const k = best / (H * 0.75);
    if (best) {
      const R = new Float32Array(A.length);
      for (let y = 0; y < H; y++) {
        const sh = k * (y - H / 2);
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1, Math.max(0, x + sh)), xa = Math.floor(sx), xb = Math.min(W - 1, xa + 1), f = sx - xa;
          const j = (y * W + x) * 4, ia = (y * W + xa) * 4, ib = (y * W + xb) * 4;
          for (let q = 0; q < 4; q++) R[j + q] = A[ia + q] * (1 - f) + A[ib + q] * f;
        }
      }
      A = R;
    }
  }
  // colore medio: le miscele lo conservano, insieme al CONTRASTO (una media
  // semplice di due venature diverse viene sbiadita e la cucitura si vede)
  const med = [0, 0, 0];
  for (let i = 0; i < W * H; i++) for (let q = 0; q < 3; q++) med[q] += A[i * 4 + q];
  for (let q = 0; q < 3; q++) med[q] /= W * H;
  // ρ = quanto si somigliano le due parti mescolate (righe allineate → molto):
  // il contrasto si corregge solo per la parte davvero diversa
  let rho = 0;
  const mesc = (a, b, w, q) => { const k = 1 / Math.sqrt((1 - w) * (1 - w) + w * w + 2 * rho * w * (1 - w)); return med[q] + ((a - med[q]) * (1 - w) + (b - med[q]) * w) * k; };
  const somiglia = (n, va, vb) => {                         // correlazione di due serie (luminosità)
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < n; i++) { const p = va(i), r = vb(i); sa += p; sb += r; saa += p * p; sbb += r * r; sab += p * r; }
    const cov = sab / n - (sa / n) * (sb / n), da = saa / n - (sa / n) ** 2, db = sbb / n - (sb / n) ** 2;
    return da > 1e-6 && db > 1e-6 ? Math.max(0, Math.min(1, cov / Math.sqrt(da * db))) : 0;
  };
  const lumA = (i) => 0.3 * A[i] + 0.59 * A[i + 1] + 0.11 * A[i + 2];
  // 1a) sinistra/destra: periodo Q, le prime a colonne sfumano dalla fine della foto
  const a = Math.round(W * 0.12), Q = W - a;
  const B = new Float32Array(Q * H * 3);
  rho = somiglia(a * Math.floor(H / 3), (n) => { const y = 3 * Math.floor(n / a), x = n % a; return lumA((y * W + x + Q) * 4); }, (n) => { const y = 3 * Math.floor(n / a), x = n % a; return lumA((y * W + x) * 4); });
  for (let y = 0; y < H; y++) for (let x = 0; x < Q; x++) {
    const i = (y * W + x) * 4, j = (y * Q + x) * 3;
    if (x < a) { const w = liscio(x / a), i2 = (y * W + x + Q) * 4; for (let q = 0; q < 3; q++) B[j + q] = mesc(A[i2 + q], A[i + q], w, q); }
    else for (let q = 0; q < 3; q++) B[j + q] = A[i + q];
  }
  // 1b) sopra/sotto: periodo P
  const b = Math.round(H * 0.15), P = H - b;
  const C = new Float32Array(Q * P * 3);
  const lumB = (i) => 0.3 * B[i] + 0.59 * B[i + 1] + 0.11 * B[i + 2];
  rho = somiglia(b * Math.floor(Q / 3), (n) => { const y = Math.floor(n / Math.floor(Q / 3)), x = 3 * (n % Math.floor(Q / 3)); return lumB(((y + P) * Q + x) * 3); }, (n) => { const y = Math.floor(n / Math.floor(Q / 3)), x = 3 * (n % Math.floor(Q / 3)); return lumB((y * Q + x) * 3); });
  for (let y = 0; y < P; y++) for (let x = 0; x < Q; x++) {
    const j = (y * Q + x) * 3, i = (y * Q + x) * 3;
    if (y < b) { const w = liscio(y / b), i2 = ((y + P) * Q + x) * 3; for (let q = 0; q < 3; q++) C[j + q] = mesc(B[i2 + q], B[i + q], w, q); }
    else for (let q = 0; q < 3; q++) C[j + q] = B[i + q];
  }
  // 2) due pezzi uno sopra l'altro, il secondo spostato di lato proprio dove le
  //    sue righe COMBACIANO con quelle del primo (cerco lo spostamento che
  //    somiglia di più nella fascia della cucitura): la venatura prosegue senza
  //    gradini e il legno è alto il doppio prima di ripetersi
  const cuci = Math.round(P * 0.3);
  const s4 = 4, q4 = Math.floor(Q / s4), c4 = Math.max(1, Math.floor(cuci / s4));
  const lum = new Float32Array(q4 * c4);
  for (let y = 0; y < c4; y++) for (let x = 0; x < q4; x++) { const i = (y * s4 * Q + x * s4) * 3; lum[y * q4 + x] = 0.3 * C[i] + 0.59 * C[i + 1] + 0.11 * C[i + 2]; }
  let dxBest = Math.round(Q / 2), costo = Infinity;
  for (let d = Math.round(q4 * 0.2); d <= Math.round(q4 * 0.8); d++) {
    let e = 0;
    for (let y = 0; y < c4; y++) for (let x = 0; x < q4; x++) e += Math.abs(lum[y * q4 + x] - lum[y * q4 + (x + d) % q4]);
    if (e < costo) { costo = e; dxBest = d * s4; }
  }
  // righe molto dritte (noce, nogal…): ripetute non si notano, e una cucitura
  // tra due pezzi sì → un pezzo solo; legni con nodi e fiammature → due pezzi
  const bw = Math.floor(W / 4), bh = Math.floor(H / 4), blk = new Float32Array(bw * bh);
  for (let y = 0; y < bh * 4; y++) for (let x = 0; x < bw * 4; x++) blk[Math.floor(y / 4) * bw + Math.floor(x / 4)] += lumA((y * W + x) * 4) / 16;
  let gx = 0, gy = 0;
  for (let y = 1; y < bh; y++) for (let x = 1; x < bw; x++) { gx += Math.abs(blk[y * bw + x] - blk[y * bw + x - 1]); gy += Math.abs(blk[y * bw + x] - blk[(y - 1) * bw + x]); }
  const pezzi = gx > gy * 2.7 ? [0] : [0, dxBest], n = pezzi.length, HT = n * P;
  rho = somiglia(c4 * q4, (i) => lum[i], (i) => lum[Math.floor(i / q4) * q4 + ((i % q4) + dxBest / s4) % q4]);
  const out = document.createElement('canvas'); out.width = Q; out.height = HT;
  const go = out.getContext('2d'); const im = go.createImageData(Q, HT), o = im.data;
  const px = (dx, x, y) => ((y * Q + (x + dx) % Q) * 3);
  for (let y = 0; y < HT; y++) {
    const kk = Math.floor(y / P), t = y - kk * P, dx = pezzi[kk], prima = pezzi[(kk + n - 1) % n];
    const w = t < cuci ? liscio(t / cuci) : 1;
    for (let x = 0; x < Q; x++) {
      const j = (y * Q + x) * 4, i1 = px(dx, x, t);
      if (w < 1) { const i0 = px(prima, x, t); for (let q = 0; q < 3; q++) o[j + q] = mesc(C[i0 + q], C[i1 + q], w, q); }
      else for (let q = 0; q < 3; q++) o[j + q] = C[i1 + q];
      o[j + 3] = 255;
    }
  }
  go.putImageData(im, 0, 0);
  return { canvas: out, fx: Q / W, fy: HT / H };
}
export function getMaterialeTHREE(id, onPronto) {
  if (cacheMat.has(id)) return cacheMat.get(id);
  const def = trovaMateriale(id);
  // Tinte solide: niente texture, solo colore + finitura matte/lucida.
  if (def.solido) {
    let mat;
    if (def.lucido) {
      // Laccato LUCIDO: clearcoat trasparente sopra il colore → riflessi netti
      // (stacco evidente rispetto all'opaco), serve un environment in scena.
      mat = new THREE.MeshPhysicalMaterial({
        color: def.colore,
        roughness: def.roughness ?? 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 2.6,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: def.colore,
        roughness: def.roughness ?? 1.0,
        metalness: def.metalness ?? 0.0,
        envMapIntensity: def.envMapIntensity ?? 0.4,
      });
    }
    // finger-pull in tinta unita: la gola ha il suo materiale (es. nero)
    if (def.gola) {
      const mg = matGolaDa(def);
      mat.userData.matGola = mg;
      if (!def.gola.solido) loader.load(def.gola.texture, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; mg.map = tex; coloreFoto(mg); if (onPronto) onPronto(); });
    }
    cacheMat.set(id, mat);
    return mat;
  }
  // Maniglia da foto: sagoma ritagliata (PNG con trasparenza), senza ripetizioni
  if (def.categoria === 'maniglia' && def.texture) {
    const mm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.4,
      roughness: 0.5, metalness: 0.1, envMapIntensity: 0.3, side: THREE.DoubleSide });
    cacheMat.set(id, mm);
    loader.load(def.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mm.map = tex; mm.needsUpdate = true;
      if (onPronto) onPronto();
    });
    return mm;
  }
  // Legno: carica la texture in background e la applica quando è pronta.
  // Prodotti PROPRI (foto del campione): superficie opaca e poco riflettente,
  // così il colore resta quello della foto.
  const mat = new THREE.MeshStandardMaterial(def.proprio
    ? { color: def.colore, ...PARAM_FOTO, ...(def.lucido ? { roughness: 0.2, envMapIntensity: 0.9 } : {}) }
    : { color: def.colore, roughness: 0.6, metalness: 0.05 });
  // misura reale del legno: quella del campione fotografato, o ~60 cm per i legni
  // già nel sito (foto ravvicinate di campioni): mai stirato, mai a piastrelle
  const campione = def.campione || (def.categoria === 'legno' && def.texture ? { wMm: 600, hMm: 600 } : null);
  // legno continuo solo per i LEGNI (ante, pannelli); i piani di lavoro hanno la loro lastra
  const continuo = !!campione && def.categoria === 'legno';
  if (campione) { mat.userData.campioneMm = campione; if (continuo) mat.userData.continuo = true; }
  if (def.proprio && def.lucido) mat.userData.ngSpec = 1;   // foto lucida: riflessi veri nel 3D
  // Finger-pull da foto: materiale della GOLA (la parte sopra, es. nera)
  if (def.gola) {
    const mg = matGolaDa(def);
    mat.userData.matGola = mg;
    if (!def.gola.solido) loader.load(def.gola.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mg.map = tex; coloreFoto(mg); mg.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  cacheMat.set(id, mat);
  if (!cacheTex.has(id)) {
    loader.load(def.texture, (tex0) => {
      let tex = tex0;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 16;                     // nitida anche di sbieco (il massimo della scheda)
      if (campione) {
        // LEGNO CONTINUO: dalla foto un legno che prosegue senza specchi né
        // giunte, alla misura reale del campione
        const lc = continuo ? legnoContinuo(tex.image) : null;
        if (lc) {
          const t2 = new THREE.CanvasTexture(lc.canvas);
          t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = 16;
          t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
          t2.repeat.set(unitaUV.u / (campione.wMm * lc.fx), unitaUV.v / (campione.hMm * lc.fy));
          tex.dispose(); tex = t2;
        } else {
          tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
          tex.repeat.set(unitaUV.u / campione.wMm, unitaUV.v / campione.hMm);
        }
      }
      cacheTex.set(id, tex);
      mat.map = tex;
      if (def.proprio) coloreFoto(mat); else mat.color.set(0xffffff); // la texture esprime il colore
      mat.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  return mat;
}

/**
 * Indica se il materiale è un LEGNO (ha una texture da tilare).
 * Serve a scena3d.js per decidere se applicare il tiling UV.
 */
export function isLegno(id) {
  const def = trovaMateriale(id);
  return def && !def.solido;
}

// Config default: Ante = Roble Denver, Interno/Schiena = Roble Hera, Tamp = Roble Denver
// Cassettiera: struttura come l'interno, fronti come le ante.
export function materialiDefault() {
  return {
    ante: 'roble-denver',
    carcassa: 'roble-hera',
    schiena: 'roble-hera',
    tamponamenti: 'roble-denver',
    cassStruttura: 'roble-hera',
    cassFronti: 'roble-denver',
  };
}
