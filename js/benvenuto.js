// =============================================================================
// PRIMA CONFIGURAZIONE — il falegname nuovo dice come lavora (si apre la prima volta)
// =============================================================================
// A passi: armadi (struttura, schiena, ante a battente), armadi scorrevoli (struttura come i battenti?
// se no le stesse domande; binario), cucina (piedini, aria delle ante), gola, regletta, cassetti.
// (La maniglia a J non è qui: il suo spessore si imposta con le maniglie.)
// Ogni scelta si salva subito nei ⚙ Parametri, gli stessi che usano distinta e 3D; dopo si cambiano
// quando si vuole in ⚙ Impostazioni → Parametri. Scorrevoli, gola e regletta si possono SALTARE
// («lo imposto dopo»): restano a 0, la distinta avvisa che mancano e alla fine c'è il promemoria.
// Alla fine: 'ng-configurato' = 1 e si va al programma.
// =============================================================================
import { parametri, salvaParametri, PARAMETRI_DEFAULT, GRUPPI_DA_IMPOSTARE, daImpostare, saltaImpostazione, segnaImpostato } from './parametri.js?v=20261124g';
import { htmlMontaggio, agganciaMontaggio, valoriDaParametri, scriviParametri, htmlUguale, valoriScorrevoli, scriviScorrevoli } from './scelte-montaggio.js?v=20261124g';
import { svgGola, svgRegletta } from './disegni-cucina.js?v=20261124g';

const $ = (id) => document.getElementById(id);
const t = (s) => (window.NGI18N ? window.NGI18N.t(s) : s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f = (n) => String(Math.round(n * 10) / 10);

/** Un numero dei Parametri (percorso 'gruppo.campo'). */
function campo(path, et, aiuto = '') {
  const [a, b] = path.split('.'), v = parametri()[a][b];
  return `<label>${esc(t(et))}<input type="number" inputmode="decimal" step="0.5" min="0" data-par="${path}" value="${esc(v ?? '')}">${aiuto ? `<small>${esc(t(aiuto))}</small>` : ''}</label>`;
}
function salvaCampo(path, valore) {
  const n = JSON.parse(JSON.stringify(parametri())), [a, b] = path.split('.');
  n[a][b] = valore; salvaParametri(n);
}

const PASSI = [
  { id: 'inizio', titolo: 'Benvenuto', html: () => `
    <p class="intro">${esc(t('Prima di cominciare, dicci come lavori: come monti gli armadi, le ante, la schiena, i piedini della cucina, i cassetti. Il programma userà questi numeri in tutte le distinte di taglio e nel 3D.'))}</p>
    <div class="box"><p class="intro" style="margin:0">${esc(t('Ci vogliono pochi minuti. Ogni scelta ha il suo disegno e un esempio con le misure. Quello che scegli adesso lo potrai cambiare quando vuoi in ⚙ Impostazioni → Parametri.'))}</p></div>` },
  { id: 'struttura', titolo: 'Armadi · struttura', montaggio: { struttura: true, schiena: false, ante: false } },
  { id: 'schiena', titolo: 'Armadi · schiena', montaggio: { struttura: false, schiena: true, ante: false } },
  { id: 'ante', titolo: 'Armadi · ante a battente', montaggio: { struttura: false, schiena: false, ante: true } },
  { id: 'sc-uguale', titolo: 'Armadi scorrevoli · struttura', gruppo: 'scorrevoli', fatto: ['scorrevoli'],
    scorrevoli: () => htmlUguale(valoriScorrevoli()) },
  { id: 'sc-struttura', titolo: 'Armadi scorrevoli · struttura', gruppo: 'scorrevoli', se: () => valoriScorrevoli().uguale === 'no',
    scorrevoli: () => htmlMontaggio(valoriScorrevoli(), { struttura: true, schiena: false }) },
  { id: 'sc-schiena', titolo: 'Armadi scorrevoli · schiena', gruppo: 'scorrevoli', se: () => valoriScorrevoli().uguale === 'no',
    scorrevoli: () => htmlMontaggio(valoriScorrevoli(), { struttura: false, schiena: true }) },
  { id: 'binari', titolo: 'Armadi scorrevoli · binario', gruppo: 'scorrevoli', fatto: ['binario'], html: () => {
    const b = parametri().binari[0];
    return `<p class="intro">${esc(t('Il binario che usi di più per gli armadi scorrevoli: i numeri per calcolare le ante. Altri binari li aggiungi dopo in ⚙ Parametri.'))}</p>
    <div class="box campi">
      <label>${esc(t('Nome del binario'))}<input type="text" data-bin="nome" value="${esc(b.nome)}"></label>
      <label>${esc(t('Larghezza anta: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="larghezzaMeno" value="${esc(b.larghezzaMeno)}"><small>${esc(t('larghezza esterna ÷ n° ante − questo numero (0 = anta larga come il modulo)'))}</small></label>
      <label>${esc(t('Altezza anta: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="altezzaMeno" value="${esc(b.altezzaMeno)}"><small>${esc(t('altezza esterna totale − questo numero'))}</small></label>
      <label>${esc(t('Profili delle ante: togli (mm)'))}<input type="number" inputmode="decimal" step="0.5" min="0" data-bin="maniglia" value="${esc(b.maniglia)}"><small>${esc(t('in più, alla larghezza di ogni anta, per i profili verticali sui due lati'))}</small></label>
    </div>
    <div class="box" id="es-bin"></div>`;
  } },
  { id: 'cucina', titolo: 'Cucina', html: () => {
    const pd = parametri().cucina.piedini;
    const sc = (v, tit, sotto) => `<button type="button" class="scelta ${pd === v ? 'sel' : ''}" data-piedini="${v}"><b>${esc(t(tit))}</b>${esc(t(sotto))}</button>`;
    return `<div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Piedini (altezza dello zoccolo)'))}</h3><div class="scelte">
      ${sc(100, 'Piedini da 10 cm', 'Zoccolo alto 10 cm')}${sc(150, 'Piedini da 15 cm', 'Zoccolo alto 15 cm')}${sc(0, 'Automatico', 'Bassi da 70 → 15 cm, bassi da 80 → 10 cm')}
    </div></div>
    <div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Aria delle ante'))}</h3><div class="campi">
      ${campo('ante.ariaAltezza', "Altezza dell'anta: togli", 'sopra + sotto: anta da 700 → 698')}
      ${campo('ante.ariaLarghezza', 'Larghezza: togli', 'sui due lati: modulo 600, 1 anta → 597')}
      ${campo('ante.ariaTraAnte', 'Fra due ante', 'stesso modulo')}
      ${campo('ante.ariaCassetti', 'Fra i cassetti', 'fra un frontale e l\'altro')}
    </div></div>`;
    // la maniglia a J NON si chiede qui: lo spessore va con la maniglia (si imposterà con le maniglie)
  } },
  { id: 'gola', titolo: 'Cucina · gola', gruppo: 'gola', fatto: ['gola'], html: () => {
    const G = parametri().gola.spazio;
    return `<p class="intro">${esc(t('La gola è il profilo in alluminio che nei mobili bassi prende il posto delle maniglie. Fra il piano e l\'anta resta uno spazio per infilare le dita e aprire: lì c\'è il profilo a L, sotto il piano. Nei cassettoni lo stesso spazio c\'è fra un cassetto e l\'altro: lì c\'è il profilo a C. I profili entrano nei fianchi fresati.'))}</p>
    <div class="box"><div class="figure">
      <figure>${svgGola(G)}<figcaption>${esc(t('Schema: mobile con 3 cassetti, visto di lato'))}</figcaption></figure>
      <figure><img src="img/guida/gola-vicino.jpg" alt="" loading="lazy"><figcaption>${esc(t('Come si vede nel 3D del programma'))}</figcaption></figure>
      <figure><img src="img/guida/gola-profilo.jpg" alt="" loading="lazy"><figcaption>${esc(t('Il profilo a L sotto il piano'))}</figcaption></figure>
    </div></div>
    <div class="box"><p class="intro" style="margin:0 0 10px">${esc(t('Quanto spazio lasci per le dita? L\'anta (o il primo cassetto) si accorcia di tanto, e fra un cassetto e l\'altro c\'è lo stesso spazio.'))}</p>
      <div class="campi">${campo('gola.spazio', 'Gola: spazio per le dita (mm)', 'dal piano all\'anta e fra i cassetti')}</div>
      <p class="nota" id="es-gola" data-no-i18n></p>
      <p class="nota">${esc(t('Vale solo nelle cucine dove scegli la gola al posto delle maniglie.'))}</p></div>`;
  } },
  { id: 'regletta', titolo: "Cucina · regletta d'angolo", gruppo: 'regletta', fatto: ['regletta'], html: () => {
    const R = parametri().regletta;
    return `<p class="intro">${esc(t('Nelle cucine ad angolo (a L o a U) una fila di mobili passa nell\'angolo (il mobile cieco) e l\'altra fila ci sta davanti. Fra le due file serve uno spazio, se no ante e cassetti sbattono contro le maniglie dell\'altra fila. La regletta chiude quello spazio: due listelli a L, dello stesso materiale delle ante. Il programma la mette da solo in ogni angolo.'))}</p>
    <div class="box"><h3 style="margin:0 0 8px;color:var(--gold-2);font-size:16px">${esc(t('Come calcoliamo le due misure'))}</h3>
      <ul class="riep" id="calc-reg" data-no-i18n></ul>
      <div class="spiega" id="perche-reg"></div></div>
    <div class="box"><div class="figure">
      <figure>${svgRegletta(R.vista, R.spessoreAnta)}<figcaption>${esc(t('Schema: l\'angolo visto da sopra'))}</figcaption></figure>
      <figure><img src="img/guida/regletta-angolo.jpg" alt="" loading="lazy"><figcaption>${esc(t('Come si vede nel 3D del programma'))}</figcaption></figure>
    </div></div>
    <div class="box campi">
      ${campo('regletta.vista', "Regletta d'angolo: quanto si vede (mm)", 'di partenza 30 = 3 × 3 cm')}
      ${campo('regletta.spessoreAnta', 'Spessore dell\'anta (mm)', 'Spessore del pannello delle ante (di serie 18 mm). Il pezzo lungo è più lungo esattamente di questa misura.')}
    </div>`;
  } },
  { id: 'cassetti', titolo: 'Cassetti', gruppo: 'cassetti', fatto: ['cassetti'], html: () => `
    <p class="intro">${esc(t('Il sistema di cassetti che usi: fondo e trasera hanno misure diverse da marca a marca.'))}</p>
    <div class="box campi">
      <label>${esc(t('Marca'))}<input type="text" data-partesto="cassetti.marca" value="${esc(parametri().cassetti.marca)}"></label>
      ${campo('cassetti.profondita', 'Profondità cassetto / guide')}
      ${campo('cassetti.spessore', 'Spessore fondo e trasera')}
      ${campo('cassetti.fondoMeno', 'Fondo: larghezza = modulo −')}
      ${campo('cassetti.fondoProfondita', 'Fondo: profondità')}
      ${campo('cassetti.traseraMeno', 'Trasera: larghezza = modulo −')}
      ${campo('cassetti.piccoloFinoA', 'Cassetto piccolo: frontale fino a')}
      ${campo('cassetti.piccoloTrasera', 'Trasera del cassetto piccolo')}
      ${campo('cassetti.medioTrasera', 'Trasera del cassetto medio', 'vuoto = una sola misura per tutti i cassetti')}
    </div>
    <div class="box avviso-fine" id="att-cass" hidden></div>
    <p class="nota">${esc(t('Se usi una terza altezza (cassetto grande), la aggiungi in ⚙ Impostazioni → Parametri → Cassetti.'))}</p>` },
  { id: 'fine', titolo: 'Fatto', html: () => {
    const P = parametri(), a = P.armadi, manca = daImpostare(P);
    const dopo = `<span style="color:#ff9b8c">${esc(t('da impostare'))}</span>`;
    const sc = valoriScorrevoli(P);
    const promemoria = manca.length ? `<div class="box avviso-fine" role="alert"><h3>⚠ ${esc(t('Impostazioni da completare'))}</h3>
      <p>${esc(t('Le seguenti impostazioni non sono ancora state configurate:'))}</p><ul>${manca.map((g) => `<li><b>${esc(t(GRUPPI_DA_IMPOSTARE[g]))}</b></li>`).join('')}</ul>
      <p>${esc(t('Per ottenere distinte di taglio corrette, completale in ⚙ Impostazioni → Parametri prima di progettare ed esportare. Fino ad allora i valori mancanti restano a 0: la distinta segnalerà le impostazioni mancanti e, al momento dell\'esportazione, ti chiederà conferma.'))}</p>
      <a class="btn btn-ghost" href="./impostazioni.html#parametri">⚙ ${esc(t('Completa le impostazioni'))}</a></div>` : '';
    const schiena = a.schiena === 'dietro' ? t('avvitata dietro') : a.schiena === 'filo' ? t('incassata a filo') : `${t('nel canale')} (${t('canale')} ${f(a.canale)} mm, ${t('dentro')} ${f(a.dentro)} mm)`;
    return `<p class="intro">${esc(t('Ecco come lavori. Da adesso il programma calcola tutto così; lo cambi quando vuoi in ⚙ Impostazioni → Parametri.'))}</p>
    ${promemoria}<div class="box"><ul class="riep">
      <li>${esc(t('Struttura'))}: <b>${esc(a.setup === 2 ? t('fianchi esterni, top e fondo dentro') : t('standard: top e fondo sopra, fianchi dentro'))}</b></li>
      <li>${esc(t('Schiena'))}: <b>${esc(schiena)}</b>, ${esc(t('spessore'))} <b>${f(a.spessoreSchiena)} mm</b></li>
      <li>${esc(t('Ante a battente'))}: <b>${esc(a.ante === 'interne' ? `${t('interne')} (${t('aria')} ${f(P.anteInterne.aria)} mm, ${t('ripiani')} ${f(P.anteInterne.spazioRipiano)} mm ${t('più indietro')})` : t('sopra la struttura'))}</b></li>
      <li>${esc(t('Struttura degli scorrevoli'))}: ${manca.includes('scorrevoli') ? dopo : `<b>${esc(sc.uguale === 'si' ? t('come i battenti') : `${t(sc.setup === 2 ? 'fianchi esterni, top e fondo dentro' : 'standard: top e fondo sopra, fianchi dentro')} · ${t('schiena')} ${t(sc.schiena === 'dietro' ? 'avvitata dietro' : sc.schiena === 'filo' ? 'incassata a filo' : 'nel canale')}`)}</b>`}</li>
      <li>${esc(t('Binario scorrevole'))}: ${manca.includes('binario') ? dopo : `<b>${esc(P.binari[0].nome || '—')}</b>`}</li>
      <li>${esc(t('Piedini della cucina'))}: <b>${esc(P.cucina.piedini ? `${P.cucina.piedini / 10} cm` : t('automatici'))}</b></li>
      <li>${esc(t('Gola: spazio per le dita'))}: ${manca.includes('gola') ? dopo : `<b>${f(P.gola.spazio)} mm</b>`}</li>
      <li>${esc(t("Regletta d'angolo"))}: ${manca.includes('regletta') ? dopo : `<b>${f(P.regletta.vista)} + ${f(P.regletta.vista + P.regletta.spessoreAnta)} mm</b>`}</li>
      <li>${esc(t('Cassetti'))}: ${manca.includes('cassetti') ? dopo : `<b>${esc(P.cassetti.marca || '—')}</b>`}</li>
    </ul></div>`;
  } },
];

// i passi che si vedono (gli scorrevoli «diversi» solo se rispondi di no)
const visibili = () => PASSI.filter((p) => !p.se || p.se());
// il passo resta anche se si cambia lingua (la pagina si ricarica): si ricorda per nome
let idPasso = 'inizio';
try { idPasso = sessionStorage.getItem('ng-benvenuto-id') || 'inizio'; } catch (_) { /* va bene */ }
const indice = () => Math.max(0, visibili().findIndex((p) => p.id === idPasso));

/** Un gruppo saltato prima: rientrandoci si riparte dai valori di partenza (non da 0). */
function ripristinaSeSaltato(P) {
  const manca = daImpostare(), D = PARAMETRI_DEFAULT, n = JSON.parse(JSON.stringify(parametri()));
  let cambia = false;
  if (P.id === 'gola' && manca.includes('gola') && !n.gola.spazio) { n.gola.spazio = D.gola.spazio; cambia = true; }
  if (P.id === 'regletta' && manca.includes('regletta') && !n.regletta.vista) { n.regletta = { ...D.regletta }; cambia = true; }
  if (P.id === 'binari' && manca.includes('binario') && n.binari[0] && !n.binari[0].altezzaMeno && D.binari[0]) {
    Object.assign(n.binari[0], { larghezzaMeno: D.binari[0].larghezzaMeno, altezzaMeno: D.binari[0].altezzaMeno, maniglia: D.binari[0].maniglia }); cambia = true;
  }
  if (P.id === 'cassetti' && manca.includes('cassetti') && !n.cassetti.fondoProfondita) {
    const C = D.cassetti; Object.assign(n.cassetti, { fondoMeno: C.fondoMeno, fondoProfondita: C.fondoProfondita, traseraMeno: C.traseraMeno, piccoloTrasera: C.piccoloTrasera, medioTrasera: C.medioTrasera, grandeTrasera: C.grandeTrasera }); cambia = true;
  }
  if (cambia) salvaParametri(n);
}

function mostra() {
  const V = visibili(), i = indice(), P = V[i];
  idPasso = P.id;
  try { sessionStorage.setItem('ng-benvenuto-id', P.id); } catch (_) { /* va bene */ }
  ripristinaSeSaltato(P);
  $('passo').textContent = `${t('Prima configurazione')} · ${t('passo')} ${i + 1} ${t('di')} ${V.length}`;
  $('titolo').textContent = t(P.titolo);
  $('punti').innerHTML = V.map((_, k) => `<span class="${k < i ? 'fatto' : k === i ? 'ora' : ''}"></span>`).join('');
  const corpo = $('corpo');
  const salta = P.gruppo ? `<div class="salta"><span>${esc(t('Non hai le misure adesso?'))}</span>
    <button type="button" class="btn btn-ghost" id="salta">${esc(t(P.gruppo === 'scorrevoli' ? 'Salta gli scorrevoli, li imposto dopo →' : 'Salta, lo imposto dopo →'))}</button></div>` : '';
  if (P.montaggio || P.scorrevoli) {
    const leggi = P.scorrevoli ? valoriScorrevoli : valoriDaParametri, scrivi = P.scorrevoli ? scriviScorrevoli : scriviParametri;
    const ridisegna = () => {
      corpo.innerHTML = salta + `<div class="box">${P.scorrevoli ? P.scorrevoli() : htmlMontaggio(valoriDaParametri(), P.montaggio)}</div>`;
      agganciaMontaggio(corpo, leggi, scrivi, () => { ridisegna(); aggiornaContatore(); });
      agganciaSalta();
    };
    ridisegna();
  } else {
    corpo.innerHTML = salta + P.html();
    agganciaCampi(corpo);
    agganciaSalta();
  }
  $('indietro').disabled = i === 0;
  $('avanti').textContent = i === V.length - 1 ? t('Inizia a lavorare →') : t('Avanti →');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(controllaSotto, 350);
  corpo.querySelectorAll('img').forEach((im) => im.addEventListener('load', controllaSotto, { once: true }));
}
/** «↓ Continua a leggere sotto»: si vede finché sotto c'è ancora qualcosa da leggere. */
function controllaSotto() {
  const b = $('sotto'); if (!b) return;
  const resta = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
  b.hidden = resta < 40;
}
window.addEventListener('scroll', controllaSotto, { passive: true });
window.addEventListener('resize', controllaSotto);
$('sotto').addEventListener('click', () => window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: 'smooth' }));
/** Dopo «sì / no» degli scorrevoli cambiano i passi: rifà solo numeri e puntini. */
function aggiornaContatore() {
  const V = visibili(), i = indice();
  $('passo').textContent = `${t('Prima configurazione')} · ${t('passo')} ${i + 1} ${t('di')} ${V.length}`;
  $('punti').innerHTML = V.map((_, k) => `<span class="${k < i ? 'fatto' : k === i ? 'ora' : ''}"></span>`).join('');
}
/** «Salta, lo imposto dopo»: il gruppo resta a 0 e si va al primo passo dopo il gruppo. */
function agganciaSalta() {
  const b = $('salta'); if (!b) return;
  b.addEventListener('click', () => {
    const V = visibili(), P = V[indice()], g = P.gruppo;
    (g === 'scorrevoli' ? ['scorrevoli', 'binario'] : [g]).forEach((x) => saltaImpostazione(x));
    let k = indice();
    while (k < V.length - 1 && V[k].gruppo === g) k++;
    idPasso = V[k].id; mostra();
  });
}
function esempioBinario() {
  const el = $('es-bin'); if (!el) return;
  const b = parametri().binari[0];
  el.textContent = t(`Esempio: armadio 1000 × 2500 a 2 moduli (1 anta per modulo) → anta ${Math.floor(500 - b.larghezzaMeno - b.maniglia)} × ${Math.floor(2500 - b.altezzaMeno)} mm`);
}
function agganciaCampi(root) {
  root.querySelectorAll('[data-par]').forEach((inp) => inp.addEventListener('change', () => {
    const n = Number(String(inp.value).replace(',', '.')); if (!Number.isFinite(n)) return;
    salvaCampo(inp.dataset.par, n);
    esempioGola(); calcoloRegletta(); attenzioneCassetti();
    // lo schema segue i numeri
    const sv = document.querySelector('.figure figure svg');
    if (sv && inp.dataset.par.startsWith('gola')) sv.outerHTML = svgGola(parametri().gola.spazio);
    if (sv && inp.dataset.par.startsWith('regletta')) { const R = parametri().regletta; sv.outerHTML = svgRegletta(R.vista, R.spessoreAnta); }
  }));
  root.querySelectorAll('[data-partesto]').forEach((inp) => inp.addEventListener('change', () => salvaCampo(inp.dataset.partesto, inp.value)));
  root.querySelectorAll('[data-bin]').forEach((inp) => inp.addEventListener('change', () => {
    const n = JSON.parse(JSON.stringify(parametri())), k = inp.dataset.bin;
    n.binari[0][k] = k === 'nome' ? inp.value : Math.max(0, Number(String(inp.value).replace(',', '.')) || 0);
    salvaParametri(n); esempioBinario();
  }));
  root.querySelectorAll('[data-piedini]').forEach((b) => b.addEventListener('click', () => {
    salvaCampo('cucina.piedini', Number(b.dataset.piedini)); mostra();
  }));
  esempioBinario(); esempioGola(); calcoloRegletta(); attenzioneCassetti();
}
/** Una sola misura di trasera: attenzione, le altre altezze si aggiungono in ⚙ Parametri. */
function attenzioneCassetti() {
  const el = $('att-cass'); if (!el) return;
  const c = parametri().cassetti;
  const una = !c.grandeTrasera && (!c.medioTrasera || c.medioTrasera === c.piccoloTrasera);
  el.hidden = !una;
  if (una) el.innerHTML = `<h3>⚠ ${esc(t('Attenzione'))}</h3><p>${esc(t(`Hai inserito una sola misura di trasera: tutti i cassetti avranno la trasera da ${f(c.piccoloTrasera)} mm.`))}</p>
    <p>${esc(t('Se usi cassetti di altezze diverse, aggiungi le altre misure in ⚙ Impostazioni → Parametri → Cassetti.'))}</p>`;
}
function esempioGola() {
  const el = $('es-gola'); if (!el) return;
  const G = parametri().gola.spazio;
  el.textContent = t(`Esempio: mobile basso da 700 con la gola → anta 700 − ${f(G)} = ${f(700 - G)} mm · 3 cassetti da ${f(Math.floor((700 - 3 * G) / 3))} mm`);
}
function calcoloRegletta() {
  const el = $('calc-reg'); if (!el) return;
  const P = parametri(), R = P.regletta, v = R.vista, s = R.spessoreAnta, h = 700 - P.ante.ariaAltezza;
  el.innerHTML = [
    t(`Pezzo corto = quanto si vede: ${f(v)} mm. Sta girato, a filo delle ante della fila davanti (fila B).`),
    t(`Pezzo lungo = quanto si vede + spessore dell'anta: ${f(v)} + ${f(s)} = ${f(v + s)} mm. Sta sul fronte del mobile cieco e passa dietro al pezzo corto: i primi ${f(s)} mm restano coperti, se ne vedono ${f(v)}.`),
    t(`Così nell'angolo si vede una L di ${f(v / 10)} × ${f(v / 10)} cm.`),
    t(`Se le maniglie sporgono di più (la maniglia standard sporge 40 mm), la regletta si allarga da sola: 40 → pezzi da 40 e ${f(40 + s)} mm, così ante e cassetti non sbattono.`),
    P.gola.spazio > 0 ? t(`Altezza: come le ante accanto (mobile da 700 → ${f(h)} mm; con la gola ${f(700 - P.gola.spazio)} mm).`) : t(`Altezza: come le ante accanto (mobile da 700 → ${f(h)} mm).`),
    t('Il resto del fronte del mobile cieco, quello coperto dalla fila davanti, è un pannello cieco fisso.'),
  ].map((x) => `<li>${esc(x)}</li>`).join('');
  // perché il pezzo lungo ha + lo spessore dell'anta
  const pr = $('perche-reg');
  if (pr) pr.innerHTML = `<h4>${esc(t(`Perché il pezzo lungo ha ${f(s)} mm in più`))}</h4>
    <p>${esc(t(`${f(s)} mm è lo spessore delle ante. La regletta viene ricavata dallo stesso pannello delle ante, quindi ha il loro stesso spessore.`))}</p>
    <p>${esc(t(`Nella giunzione ad angolo il pezzo lungo passa dietro al pezzo corto. Per chiudere l'angolo senza lasciare fessure deve essere più lungo esattamente dello spessore del pezzo corto, cioè di ${f(s)} mm.`))}</p>
    <p>${esc(t('Il valore di serie è 18 mm. Se utilizzi ante da 19 o 22 mm, imposta 19 o 22: la misura del pezzo lungo si aggiorna automaticamente.'))}</p>`;
}

$('indietro').addEventListener('click', () => { const V = visibili(), i = indice(); if (i > 0) { idPasso = V[i - 1].id; mostra(); } });
$('avanti').addEventListener('click', () => {
  const V = visibili(), i = indice(), P = V[i];
  if (P.fatto) segnaImpostato(...P.fatto);          // passato con «Avanti»: impostato (l'avviso sparisce)
  if (i < V.length - 1) { idPasso = V[i + 1].id; mostra(); return; }
  try { localStorage.setItem('ng-configurato', '1'); sessionStorage.removeItem('ng-benvenuto-id'); } catch (_) { /* va bene anche senza */ }
  location.href = './scegli.html';
});
mostra();
