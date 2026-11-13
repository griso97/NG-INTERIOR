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
import { leggiCatalogo, leggiFoto, nascosto } from './catalogo.js?v=20261114i';

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
const CAT_DA_SEZIONE = { legno: 'legno', fingerpull: 'legno', encimera: 'encimera', pannello: 'legno', zoccolo: 'zoccolo', maniglie: 'maniglia' };
async function applicaCatalogo() {
  statoCatalogo = await leggiCatalogo();
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
    // Maniglia da foto: misura reale (lato lungo) e proporzioni dalla foto
    if (p.sezione === 'maniglie' && p.maniglia) {
      def.lunghezzaMm = (Number(p.maniglia.lunghezzaCm) || 15) * 10;
      def.altezzaMm = Math.max(6, def.lunghezzaMm * (Number(p.maniglia.rapporto) || 0.08));
      def.verticale = !!p.maniglia.verticale;
      if (p.maniglia.viste) {                                        // lato / sopra (facoltative)
        def.viste = p.maniglia.viste;
        const [fs, fl] = await Promise.all([leggiFoto(p.id, 'sopra'), leggiFoto(p.id, 'lato')]);
        if (fs) def.vistaSopra = URL.createObjectURL(fs);
        if (fl) def.vistaLato = URL.createObjectURL(fl);
      }
    }
    MATERIALI.push(def);
    // Finger-pull → lo STESSO materiale (stessa foto, stessa misura) senza la
    // gola compare da solo fra i legni: il produttore dà lo stesso colore per
    // ante finger-pull e pannelli. Es. "Noce con maniglia nera" → "Noce".
    if (p.sezione === 'fingerpull') {
      const { gola: _g, ...base } = def;
      MATERIALI.push({ ...base, id: `${p.id}~legno`, nome: nomeSenzaGola(def.nome), categoria: 'legno', sezione: 'legno', derivato: p.id });
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
    case 'fingerpull': l = [...legni, ...propri('fingerpull')]; break;
    case 'encimera': l = MATERIALI.filter((m) => m.categoria === 'encimera'); break;
    case 'pannello': l = [...legni, ...MATERIALI.filter((m) => m.categoria === 'encimera'), ...propri('pannello')]; break;
    case 'zoccolo': l = MATERIALI.filter((m) => m.categoria === 'zoccolo'); break;
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
      sh.fragmentShader = 'uniform float ngLuceRif;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
        vec3 wl = vec3(0.2126, 0.7152, 0.0722);
        float f = dot(totalDiffuse, wl) / max(dot(diffuseColor.rgb, wl), 1e-4) / ngLuceRif;
        // luce in più (es. LED): schiarisce ma non "brucia" la foto
        if (f > 1.0) f = 1.0 + 0.45 * (1.0 - exp(-(f - 1.0) * 1.6));
        outgoingLight = diffuseColor.rgb * mix(1.0, f, ${CONTRASTO_FOTO.toFixed(2)}) + totalEmissiveRadiance;
      }
      #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'ng-foto';
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
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      let u, v;
      if (ax >= ay && ax >= az) { u = pos.getZ(i) - c.z; v = pos.getY(i) - c.y; }
      else if (ay >= az) { u = pos.getX(i) - c.x; v = pos.getZ(i) - c.z; }
      else { u = pos.getX(i) - c.x; v = pos.getY(i) - c.y; }
      uv.setXY(i, (u + wMm / 2) / unitaUV.u, (v + hMm / 2) / unitaUV.v);
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
    ? { color: def.colore, ...PARAM_FOTO }
    : { color: def.colore, roughness: 0.6, metalness: 0.05 });
  if (def.campione) mat.userData.campioneMm = def.campione;
  // Finger-pull da foto: materiale della GOLA (la parte sopra, es. nera)
  if (def.gola) {
    const mg = new THREE.MeshStandardMaterial({ color: def.gola.colore, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.3 });
    mat.userData.matGola = mg;
    loader.load(def.gola.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mg.map = tex; coloreFoto(mg); mg.needsUpdate = true;
      if (onPronto) onPronto();
    });
  }
  cacheMat.set(id, mat);
  if (!cacheTex.has(id)) {
    loader.load(def.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      if (def.campione) {
        // una ripetizione della foto = la misura reale del campione
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.repeat.set(unitaUV.u / def.campione.wMm, unitaUV.v / def.campione.hMm);
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
