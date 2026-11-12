/* =============================================================================
   LINGUA — Italiano / Español
   =============================================================================
   Il sito è scritto in italiano. In spagnolo la pagina viene tradotta al volo:
   - testi e attributi visibili (title, placeholder, aria-label, alt) di tutto
     il DOM, anche quelli creati dopo (MutationObserver);
   - testi con parti variabili tramite modelli con segnaposto {0}, {1}…
     (es. "Ogni modulo: {0} mm." → "Cada módulo: {0} mm.");
   - alert / confirm / prompt;
   - file esportati: chi esporta usa window.NGI18N.t(testo).
   La scelta resta in localStorage ('ng-lingua'); cambiandola la pagina si ricarica.
   Va incluso come script CLASSICO nel <head> (prima del resto), così in
   spagnolo il dizionario è pronto prima che si veda la pagina.
   ========================================================================== */
(function () {
  'use strict';
  var CHIAVE = 'ng-lingua';
  var LINGUE = ['it', 'es'];
  var lingua = 'it';
  try { lingua = localStorage.getItem(CHIAVE) || 'it'; } catch (e) { /* niente */ }
  if (LINGUE.indexOf(lingua) < 0) lingua = 'it';
  var doc = document.documentElement;
  doc.setAttribute('lang', lingua);

  // Percorso di questo script → stessa cartella per il dizionario
  var me = document.currentScript && document.currentScript.src;
  var base = me ? me.replace(/i18n\.js(\?.*)?$/, '') : 'js/';
  var ver = me && /\?v=([^&]+)/.test(me) ? me.match(/\?v=([^&]+)/)[1] : '';

  if (lingua === 'es') {
    // Nascondo la pagina finché non è tradotta (massimo 2,5 s)
    var st = document.createElement('style');
    st.id = 'i18n-attesa';
    st.textContent = 'html.i18n-attesa body{visibility:hidden}';
    document.head.appendChild(st);
    doc.classList.add('i18n-attesa');
    setTimeout(function () { doc.classList.remove('i18n-attesa'); }, 2500);
    // Dizionario sincrono: è pronto prima del <body>
    document.write('<script src="' + base + 'i18n-es.js' + (ver ? '?v=' + ver : '') + '"><\/script>');
  }

  // ---------------------------------------------------------------------------
  // Motore di traduzione
  // ---------------------------------------------------------------------------
  var esatti = null, modelli = null, parziali = null, cache = new Map();
  var mancanti = /[?&]i18n-debug\b/.test(location.search) ? new Set() : null;   // testi senza traduzione (per i controlli)
  var LETTERE = /[A-Za-zÀ-ÿ]{2}/;

  function prepara() {
    if (esatti) return true;
    var d = window.NG_I18N_ES;
    if (!d) return false;
    esatti = new Map(); modelli = []; parziali = [];
    var L = 'A-Za-zÀ-ÿ';
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (!v || v === k) return;
      var idx = [];
      var corpo = k.split(/(\{\d+\})/).map(function (p) {
        var m = p.match(/^\{(\d+)\}$/);
        if (m) { idx.push(+m[1]); return '([\\s\\S]+?)'; }
        return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      var letterale = k.replace(/\{\d+\}/g, '').length;
      if (idx.length) {
        if (letterale < 2) return;                    // solo segnaposti: troppo generico
        modelli.push({ re: new RegExp('^' + corpo + '$'), idx: idx, es: v, peso: letterale });
      } else esatti.set(k, v);
      // Frase nota DENTRO un testo più lungo (con parti variabili prima/dopo)
      if (letterale >= 5 && /[A-Za-zÀ-ÿ]{3}/.test(k)) {
        try {
          parziali.push({ re: new RegExp('^([\\s\\S]*?)(?<![' + L + '])' + corpo + '(?![' + L + '])([\\s\\S]*)$'), idx: idx, es: v, peso: letterale });
        } catch (e) { /* browser senza lookbehind: niente traduzione parziale */ }
      }
    });
    modelli.sort(function (a, b) { return b.peso - a.peso; });
    parziali.sort(function (a, b) { return b.peso - a.peso; });
    return true;
  }

  function nucleo(s) {
    var c = s.replace(/\s+/g, ' ').trim();
    if (esatti.has(c)) return esatti.get(c);
    // modelli con parti variabili
    for (var i = 0; i < modelli.length; i++) {
      var m = modelli[i], r = m.re.exec(c);
      if (!r) continue;
      var val = {};
      m.idx.forEach(function (n, j) { val[n] = r[j + 1]; });
      return m.es.replace(/\{(\d+)\}/g, function (_, n) {
        var x = val[n];
        return x == null ? '' : (LETTERE.test(x) ? traduci(x) : x);
      });
    }
    // frase nota con parti variabili prima e/o dopo
    for (var q = 0; q < parziali.length; q++) {
      var pz = parziali[q], rr = pz.re.exec(c);
      if (!rr || (!rr[1] && !rr[rr.length - 1])) continue;
      var vv = {};
      pz.idx.forEach(function (n, j) { vv[n] = rr[j + 2]; });
      var mezzo = pz.es.replace(/\{(\d+)\}/g, function (_, n) {
        var x = vv[n];
        return x == null ? '' : (LETTERE.test(x) ? traduci(x) : x);
      });
      var prima = rr[1], dopo = rr[rr.length - 1];
      return (LETTERE.test(prima) ? traduci(prima) : prima) + mezzo + (LETTERE.test(dopo) ? traduci(dopo) : dopo);
    }
    // frasi composte: "A · B", "A — B", "A: B", "A / B"
    var sep = c.match(/ · | — | – |: | \/ /);
    if (sep) {
      var pezzi = c.split(sep[0]);
      var tradotti = pezzi.map(function (p) { return LETTERE.test(p) ? traduci(p) : p; });
      if (tradotti.some(function (t, j) { return t !== pezzi[j]; })) return tradotti.join(sep[0]);
    }
    // Iniziale maiuscola / minuscola diversa dal dizionario
    var alt = c.charAt(0) === c.charAt(0).toUpperCase() ? c.charAt(0).toLowerCase() + c.slice(1) : c.charAt(0).toUpperCase() + c.slice(1);
    if (esatti.has(alt)) {
      var t = esatti.get(alt);
      return c.charAt(0) === c.charAt(0).toUpperCase() ? t.charAt(0).toUpperCase() + t.slice(1) : t.charAt(0).toLowerCase() + t.slice(1);
    }
    return null;
  }

  /** Traduce un testo (lascia gli spazi ai bordi). Se non lo conosce lo lascia com'è. */
  function traduci(s) {
    if (lingua === 'it' || s == null) return s;
    s = String(s);
    if (!LETTERE.test(s) || !prepara()) return s;
    if (cache.has(s)) return cache.get(s);
    var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var t = nucleo(m[2]);
    if (t == null && mancanti) mancanti.add(m[2].replace(/\s+/g, ' '));
    var out = t == null ? s : m[1] + t + m[3];
    cache.set(s, out);
    return out;
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  var SALTA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
  var ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
  var fatti = new WeakMap();                         // nodo testo → testo già tradotto

  function testo(n) {
    var p = n.parentNode;
    if (!p || SALTA[p.nodeName] || (p.closest && p.closest('[data-no-i18n]'))) return;
    var v = n.nodeValue;
    if (fatti.get(n) === v) return;
    var t = traduci(v);
    if (t !== v) n.nodeValue = t;
    fatti.set(n, t);
  }
  function attributi(el) {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    for (var i = 0; i < ATTR.length; i++) {
      var v = el.getAttribute(ATTR[i]);
      if (v) { var t = traduci(v); if (t !== v) el.setAttribute(ATTR[i], t); }
    }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) {
      var tv = traduci(el.value); if (tv !== el.value) el.value = tv;
    }
  }
  function albero(root) {
    if (!root) return;
    if (root.nodeType === 3) { testo(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SALTA[root.nodeName]) return; attributi(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) testo(n);
      else attributi(n);
    }
  }

  function avvia() {
    if (lingua === 'it') return;
    if (!prepara()) { doc.classList.remove('i18n-attesa'); return; }
    document.title = traduci(document.title);
    albero(document.body);
    doc.classList.remove('i18n-attesa');
    new MutationObserver(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var r = lista[i];
        if (r.type === 'characterData') testo(r.target);
        else if (r.type === 'attributes') attributi(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) albero(r.addedNodes[j]);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  // Messaggi del browser
  if (lingua !== 'it') {
    ['alert', 'confirm', 'prompt'].forEach(function (f) {
      var orig = window[f];
      if (typeof orig !== 'function') return;
      window[f] = function (msg) {
        var a = Array.prototype.slice.call(arguments);
        a[0] = traduci(msg);
        return orig.apply(window, a);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Selettore IT | ES
  // ---------------------------------------------------------------------------
  function imposta(l) {
    if (LINGUE.indexOf(l) < 0 || l === lingua) return;
    try { localStorage.setItem(CHIAVE, l); } catch (e) { /* niente */ }
    location.reload();
  }
  var CSS = '.ng-lingua{display:inline-flex;border:1px solid var(--oro-scuro,#8a6a14);border-radius:999px;overflow:hidden;font:600 12px/1 inherit;letter-spacing:1px;vertical-align:middle}'
    + '.ng-lingua button{all:unset;cursor:pointer;padding:7px 11px;color:var(--testo-dim,#b8ae95);font:inherit;letter-spacing:inherit}'
    + '.ng-lingua button[aria-pressed="true"]{background:var(--oro,#c9a94a);color:#111}'
    + '.ng-lingua button:focus-visible{outline:2px solid var(--oro,#c9a94a);outline-offset:-2px}'
    + '.ng-lingua.grande{font-size:15px}.ng-lingua.grande button{padding:10px 18px}'
    + '.ng-lingua.fisso{position:fixed;top:12px;left:12px;z-index:50;background:rgba(10,10,11,.6)}';
  function selettore(classe) {
    var d = document.createElement('div');
    d.className = 'ng-lingua ' + (classe || '');
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', lingua === 'es' ? 'Idioma' : 'Lingua');
    d.setAttribute('data-no-i18n', '');
    [['it', 'IT', 'Italiano'], ['es', 'ES', 'Español']].forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = x[1]; b.title = x[2];
      b.setAttribute('aria-pressed', x[0] === lingua ? 'true' : 'false');
      b.addEventListener('click', function () { imposta(x[0]); });
      d.appendChild(b);
    });
    return d;
  }
  function montaSelettore() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var posto = document.querySelector('[data-lingua]');
    if (posto) { posto.appendChild(selettore(posto.getAttribute('data-lingua'))); return; }
    var strumenti = document.querySelector('.header-strumenti');
    if (strumenti) { strumenti.insertBefore(selettore(''), strumenti.firstChild); return; }
    document.body.appendChild(selettore('fisso'));
  }

  window.NGI18N = { lingua: lingua, t: traduci, imposta: imposta, mancanti: mancanti };

  function pronto() { montaSelettore(); avvia(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pronto);
  else pronto();
})();
