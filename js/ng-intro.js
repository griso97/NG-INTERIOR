/* =============================================================================
   NG STUDIO — ANIMAZIONE D'APERTURA (3D vero + suoni)          file: js/ng-intro.js
   =============================================================================
   COSA FA
   Quando si apre la pagina iniziale copre lo schermo (nero) e in ~8,6 secondi:
     0,0 s  NG compare come disegno 3D a linee (girato di 3/4)
     1,2 s  una lama di luce passa da sinistra a destra e lo trasforma nel logo
            d'oro vero (la faccia è il logo originale, dietro uno spessore d'oro)
     2,8 s  il pavimento 3D si allarga da sotto NG
     3,3 s  dietro NG si disegna il cubo, appoggiato su uno spigolo
     4,4 s  compaiono STUDIO, la riga d'oro, "3D DESIGN · CUSTOM FURNITURE"
     6,3 s  e la frase "Dove la creatività prende vita" (in spagnolo:
            "Donde la creatividad cobra vida")
   poi sfuma e lascia il sito. Un tocco (o Esc/Invio) la salta in ogni momento.

   SUONI: generati qui dentro (niente file audio, niente diritti d'autore).
   Parte MUTA. In alto a destra c'è l'altoparlante: toccandolo si accende il
   suono e l'animazione riparte da capo col sonoro; la scelta resta salvata
   (localStorage 'ng-intro-audio'). Nota: i browser (soprattutto iPhone) non
   lasciano partire un suono senza un tocco, quindi anche se la scelta salvata
   è "acceso", l'audio parte solo dopo un tocco sull'altoparlante (che pulsa
   per invitarlo). Sull'iPhone in modalità silenziosa non si sente.
   Il suono c'è solo fino a quando il cubo è finito, poi sfuma piano.

   COME AGGIUNGERLO ALLA PAGINA INIZIALE (index.html)
   1. Mettere questo file in  js/ng-intro.js
   2. In index.html, subito dopo <body>, aggiungere:
        <script type="module" src="js/ng-intro.js"></script>
      (non serve nient'altro: crea da solo lo schermo, i testi e il bottone)
   3. Serve three.js del sito: vendor/three/three.module.js (r161, già nel
      repository). Il percorso è qui sotto in IMPORT. Nessun altro add-on.
   4. Usa il logo del sito: img/logo.png (ritaglia da solo la parte "NG").
   5. Lingua: legge localStorage 'ng-lingua' ('it' / 'es'), come il resto del
      sito. I testi hanno data-no-i18n: il traduttore automatico non li tocca.
   Opzioni in CONFIG qui sotto (quando mostrarla, riga in inglese sì/no, ecc.).
   Se il dispositivo non ha WebGL o l'utente ha "riduci movimento", non parte.
   ========================================================================== */
// three.js r161 del sito, versione compressa (la stessa delle altre pagine: si scarica una volta sola)
import * as THREE from '../vendor/three/three.module.min.js';

const CONFIG = {
  mostra: 'sempre',            // 'sempre' = a ogni apertura · 'giorno' = una volta al giorno
  motto: true,                 // true = mostra anche "3D DESIGN · CUSTOM FURNITURE"
  logo: 'img/logo.png',        // logo del sito (relativo alla pagina)
  ritaglioNG: [84, 16, 461, 318],   // x, y, larghezza, altezza della parte "NG" dentro logo.png
  durata: 8.6,                 // secondi dell'animazione
  pausaFinale: 1.0,            // secondi fermi sul finale prima di sparire
  sfumaUscita: 0.8,            // secondi della dissolvenza d'uscita
};
const TESTI = {
  it: { frase: 'Dove la creatività prende vita', salta: 'Tocca per entrare', audioOn: 'Disattiva audio', audioOff: 'Attiva audio' },
  es: { frase: 'Donde la creatividad cobra vida', salta: 'Toca para entrar', audioOn: 'Desactivar audio', audioOff: 'Activar audio' },
};

// Contorno della parte NG di logo.png (coordinate in pixel del ritaglio 461×318):
// una forma con il suo buco. Serve per dare lo spessore 3D al logo.
const FORME_NG = [{"f":[[310.6,314.7],[304.9,314.4],[298.8,313.7],[292.5,312.9],[286.6,311.9],[281.5,310.9],[277.8,309.9],[276.6,309.5],[275.8,309.3],[275.2,309.3],[274.8,309.5],[274.3,309.9],[273.8,310.5],[273.0,311.4],[271.9,312.0],[270.0,312.4],[266.5,312.6],[260.6,312.6],[251.8,312.6],[245.2,312.6],[240.3,312.6],[236.7,312.6],[234.3,312.5],[232.9,312.4],[232.2,312.3],[231.6,312.0],[231.0,311.5],[230.3,310.8],[229.5,309.9],[228.5,308.6],[227.4,307.0],[226.9,306.2],[226.3,305.4],[225.7,304.5],[225.1,303.6],[224.5,302.8],[224.0,302.1],[223.6,301.5],[223.1,300.9],[222.7,300.4],[222.4,299.9],[222.1,299.5],[221.8,299.0],[221.4,298.4],[221.1,298.1],[220.8,297.7],[220.6,297.3],[219.2,295.5],[217.2,292.7],[214.9,289.4],[212.5,286.0],[210.4,283.2],[209.0,281.2],[208.0,279.7],[206.7,277.9],[205.0,275.5],[203.0,272.7],[200.6,269.3],[197.7,265.4],[196.0,263.0],[194.3,260.6],[192.7,258.3],[191.1,256.0],[189.5,253.8],[187.9,251.5],[185.9,248.7],[184.2,246.3],[182.6,244.0],[180.9,241.6],[179.1,239.2],[177.1,236.4],[175.9,234.7],[174.5,232.7],[172.9,230.5],[171.3,228.2],[169.7,226.0],[168.3,224.0],[165.1,219.4],[162.4,215.6],[160.3,212.6],[158.6,210.2],[157.3,208.4],[156.4,207.1],[155.9,206.4],[155.3,205.6],[154.7,204.7],[154.0,203.8],[153.4,202.9],[152.8,202.0],[151.8,200.6],[150.8,199.1],[149.5,197.4],[147.9,195.1],[145.7,192.1],[142.9,188.1],[142.3,187.2],[141.5,186.1],[140.6,184.9],[139.7,183.6],[138.8,182.3],[137.9,181.1],[137.0,179.8],[136.1,178.5],[135.2,177.2],[134.3,175.9],[133.5,174.8],[132.9,173.9],[132.3,173.1],[131.7,172.2],[131.1,171.3],[130.4,170.4],[129.9,169.6],[129.4,168.9],[129.0,168.2],[128.4,167.4],[127.9,166.6],[127.3,165.8],[126.8,165.1],[126.3,164.4],[125.7,163.7],[125.1,162.9],[124.5,162.0],[123.8,161.1],[123.2,160.2],[122.6,159.4],[120.2,155.9],[118.1,153.1],[116.4,150.7],[115.2,149.0],[114.4,147.8],[114.0,147.2],[113.6,146.8],[113.0,145.9],[112.1,144.6],[110.9,143.0],[109.6,141.1],[108.1,139.1],[105.7,135.7],[103.0,132.0],[100.1,127.9],[97.1,123.6],[93.9,119.0],[90.6,114.2],[89.6,112.8],[88.6,111.3],[87.4,109.7],[86.0,107.7],[84.4,105.5],[82.5,102.8],[80.7,100.3],[78.2,96.8],[75.3,92.5],[72.2,88.1],[69.3,83.9],[66.9,80.5],[65.6,78.6],[64.2,76.6],[62.9,74.7],[61.6,73.0],[60.6,71.5],[59.8,70.4],[59.5,70.0],[59.1,69.5],[58.8,69.1],[58.6,68.6],[58.2,68.0],[57.9,67.6],[57.4,67.3],[56.6,67.4],[56.7,147.4],[56.8,188.8],[56.9,217.9],[57.1,237.1],[57.5,249.1],[58.1,256.2],[58.9,261.0],[59.1,261.8],[59.3,262.8],[59.5,263.7],[59.7,264.7],[59.9,265.5],[60.0,266.2],[60.6,268.7],[61.3,271.2],[62.2,273.8],[63.3,276.4],[64.6,279.3],[66.1,282.5],[68.8,287.2],[72.0,291.2],[75.6,294.6],[79.6,297.3],[84.1,299.3],[89.1,300.7],[92.4,301.4],[94.6,302.0],[95.9,302.6],[96.6,303.5],[96.8,304.6],[96.9,306.3],[96.8,308.7],[96.3,310.4],[95.3,311.4],[93.5,312.1],[90.6,312.4],[86.4,312.6],[76.8,312.7],[61.4,312.7],[43.5,312.6],[26.4,312.4],[13.4,312.2],[7.8,311.9],[6.8,311.6],[6.0,311.0],[5.4,310.3],[5.0,309.2],[4.8,307.9],[4.7,306.2],[4.7,304.9],[5.0,304.0],[5.7,303.2],[7.0,302.6],[9.1,301.9],[12.1,301.0],[14.9,300.2],[17.2,299.5],[19.2,298.9],[20.8,298.2],[22.2,297.5],[23.5,296.7],[29.0,292.4],[33.4,287.2],[36.8,280.8],[39.3,273.1],[41.0,263.6],[42.0,252.2],[42.2,238.0],[42.3,207.5],[42.4,168.2],[42.3,127.8],[42.2,94.0],[42.0,74.4],[41.6,62.9],[40.9,53.9],[39.8,46.9],[38.0,41.2],[35.5,36.3],[32.2,31.6],[29.1,28.0],[25.6,24.8],[21.8,21.9],[17.7,19.4],[13.1,17.1],[8.1,15.1],[6.0,14.4],[4.6,13.7],[3.7,13.1],[3.2,12.3],[2.9,11.2],[2.9,9.9],[2.9,8.8],[3.0,8.0],[3.2,7.4],[3.4,6.9],[3.7,6.5],[4.2,6.3],[5.3,6.2],[8.4,6.1],[13.8,6.1],[21.6,6.0],[32.0,6.0],[45.4,6.0],[62.1,6.0],[73.5,6.0],[80.6,6.1],[84.6,6.2],[86.4,6.3],[87.1,6.5],[87.9,7.0],[88.9,7.9],[90.1,9.3],[91.4,11.0],[93.0,13.2],[94.7,15.8],[95.4,16.9],[96.2,18.1],[97.0,19.3],[97.8,20.4],[98.5,21.4],[99.1,22.2],[101.0,25.1],[102.6,27.3],[103.9,29.2],[105.0,30.8],[105.9,32.2],[106.8,33.5],[107.4,34.4],[108.2,35.6],[109.2,37.0],[110.2,38.5],[111.2,40.0],[112.2,41.4],[113.2,42.8],[114.2,44.4],[115.3,46.0],[116.4,47.5],[117.3,48.9],[118.1,50.0],[118.8,51.1],[119.6,52.2],[120.3,53.3],[121.1,54.4],[121.8,55.4],[122.3,56.2],[122.9,57.0],[123.5,57.8],[124.1,58.8],[124.8,59.8],[125.4,60.7],[126.0,61.5],[126.6,62.3],[127.3,63.3],[128.0,64.4],[128.8,65.5],[129.5,66.6],[130.2,67.6],[130.9,68.5],[131.6,69.5],[132.3,70.5],[132.9,71.4],[133.5,72.2],[133.9,72.9],[134.3,73.5],[134.8,74.2],[135.3,74.9],[135.8,75.6],[136.2,76.3],[136.7,76.9],[137.1,77.5],[137.6,78.2],[138.2,79.1],[138.8,79.9],[139.3,80.7],[139.9,81.5],[141.9,84.4],[144.1,87.6],[146.3,90.8],[148.4,93.9],[150.3,96.5],[151.8,98.6],[152.2,99.3],[152.8,100.1],[153.4,101.0],[154.0,101.9],[154.7,102.8],[155.3,103.8],[155.9,104.7],[156.6,105.7],[157.3,106.7],[157.9,107.6],[158.6,108.5],[159.1,109.3],[160.2,110.7],[161.2,112.3],[162.4,113.9],[163.6,115.6],[165.0,117.6],[166.5,119.9],[167.2,120.9],[167.9,121.9],[168.6,123.0],[169.3,123.9],[169.9,124.8],[170.4,125.5],[171.1,126.6],[172.0,127.9],[173.0,129.4],[174.2,131.1],[175.6,133.0],[177.1,135.1],[178.2,136.7],[179.8,139.0],[181.8,141.9],[184.0,145.2],[186.4,148.8],[188.9,152.4],[190.0,154.1],[191.0,155.5],[191.7,156.5],[192.3,157.1],[192.6,157.5],[193.2,157.3],[193.4,156.6],[193.5,155.4],[193.6,153.4],[193.8,150.6],[193.9,148.7],[194.0,146.8],[194.2,145.0],[194.3,143.5],[194.4,142.2],[194.5,141.4],[195.0,137.3],[195.4,133.7],[195.8,130.6],[196.1,128.1],[196.4,126.3],[196.6,125.3],[196.8,124.3],[197.0,123.6],[197.1,122.8],[197.3,122.1],[197.4,121.4],[197.7,119.7],[198.2,117.5],[198.8,114.9],[199.4,112.4],[199.9,110.2],[200.4,108.6],[200.6,107.7],[200.8,107.2],[200.9,106.6],[201.1,106.0],[201.2,105.5],[201.9,103.1],[202.8,100.2],[203.7,97.2],[204.7,94.3],[205.6,91.7],[206.4,89.8],[206.6,89.3],[206.8,88.7],[207.1,88.0],[207.5,87.2],[207.8,86.4],[208.1,85.6],[209.3,83.0],[210.2,80.9],[210.9,79.1],[211.6,77.6],[212.4,76.0],[213.2,74.4],[215.8,69.4],[218.6,64.4],[221.6,59.5],[224.6,54.8],[227.6,50.5],[230.3,46.9],[232.5,44.3],[234.3,42.0],[236.0,40.1],[237.5,38.4],[238.9,36.9],[240.1,35.6],[241.5,34.3],[242.4,33.3],[242.9,32.6],[243.1,32.1],[242.9,31.1],[241.5,29.0],[239.0,26.7],[235.6,24.3],[231.6,22.0],[227.3,19.8],[222.8,18.0],[220.5,17.1],[218.9,16.3],[217.9,15.3],[217.5,14.1],[217.5,12.4],[217.8,10.2],[218.1,9.3],[218.3,8.5],[218.6,7.9],[219.0,7.4],[219.5,7.0],[220.1,6.6],[220.8,6.4],[222.6,6.3],[226.8,6.2],[234.6,6.1],[247.1,6.1],[265.8,6.0],[280.7,6.0],[292.5,6.0],[301.5,6.0],[307.9,6.1],[312.1,6.2],[314.5,6.3],[318.6,6.6],[323.2,5.5],[330.5,4.1],[337.3,3.3],[344.1,3.1],[351.3,3.4],[359.4,4.3],[368.6,5.9],[371.1,6.4],[374.2,7.1],[377.6,8.0],[381.2,9.0],[384.8,10.1],[388.2,11.1],[392.2,12.4],[395.3,13.5],[398.1,14.6],[401.1,15.9],[405.0,17.7],[410.4,20.2],[414.8,22.4],[417.9,23.7],[419.8,24.5],[420.9,24.7],[421.6,24.6],[422.3,24.1],[423.0,23.4],[423.9,22.4],[424.9,21.1],[426.0,19.7],[427.1,18.1],[428.2,16.5],[430.6,13.1],[432.8,10.6],[434.7,8.9],[436.6,8.0],[438.4,7.9],[440.1,8.6],[441.0,9.1],[441.6,9.9],[441.9,11.8],[442.1,15.4],[442.2,21.5],[442.3,30.9],[442.3,46.2],[442.4,62.6],[442.3,78.5],[442.2,92.1],[442.1,101.8],[442.0,105.7],[441.7,106.3],[441.3,106.8],[440.5,107.1],[439.4,107.3],[437.8,107.4],[435.6,107.4],[433.0,107.5],[431.1,107.3],[429.8,106.7],[428.8,105.6],[427.9,103.8],[426.9,101.0],[425.7,97.8],[424.6,95.1],[423.6,92.6],[422.5,90.1],[421.2,87.5],[419.7,84.4],[417.4,79.7],[415.1,75.2],[412.8,71.2],[410.7,67.5],[408.8,64.3],[407.0,61.6],[402.0,54.6],[397.6,48.8],[393.4,43.9],[389.2,39.7],[384.8,35.9],[379.9,32.2],[376.0,29.7],[371.9,27.3],[367.6,25.2],[363.4,23.4],[359.3,22.0],[355.6,21.0],[354.5,20.8],[353.7,20.6],[352.9,20.4],[351.9,20.2],[351.0,20.0],[347.6,19.4],[343.7,18.9],[339.5,18.6],[335.1,18.6],[330.6,18.7],[326.1,19.0],[323.6,19.3],[320.0,20.0],[315.9,20.8],[311.5,21.8],[307.2,22.8],[303.4,23.8],[297.6,25.9],[292.6,28.9],[288.1,32.9],[284.4,37.7],[281.3,43.4],[278.9,49.9],[278.2,52.1],[277.7,54.2],[277.3,56.4],[276.8,58.9],[276.4,62.0],[275.8,66.1],[275.2,71.1],[275.1,108.5],[275.1,119.3],[275.1,130.8],[275.1,142.3],[275.1,153.3],[275.2,163.1],[275.2,171.1],[275.3,179.3],[275.4,189.6],[275.5,201.4],[275.6,213.9],[275.7,226.5],[275.8,238.6],[275.9,258.4],[276.0,271.0],[276.2,278.2],[276.5,281.5],[277.2,282.6],[278.1,283.1],[278.5,283.4],[279.0,283.7],[279.5,284.1],[280.1,284.5],[280.7,285.0],[281.2,285.4],[289.9,291.3],[299.1,295.8],[309.0,298.8],[319.5,300.3],[330.7,300.4],[342.8,299.1],[351.0,297.3],[358.5,294.6],[365.0,291.1],[370.5,286.9],[374.9,282.1],[377.9,276.7],[378.8,274.2],[379.5,271.1],[379.9,266.8],[380.1,260.4],[380.2,251.1],[380.2,238.2],[380.2,223.3],[380.1,212.4],[379.9,204.9],[379.5,199.9],[379.0,196.4],[378.2,193.6],[376.1,188.7],[373.2,184.7],[369.4,181.5],[364.5,179.1],[358.3,177.2],[350.5,175.7],[348.2,175.3],[346.5,174.9],[345.5,174.2],[344.8,173.3],[344.5,172.0],[344.5,170.3],[344.5,168.8],[344.6,167.6],[344.8,166.8],[345.2,166.1],[345.7,165.6],[346.4,165.2],[348.0,164.8],[352.1,164.6],[359.4,164.4],[371.0,164.3],[387.8,164.3],[410.8,164.3],[428.8,164.3],[441.3,164.4],[449.3,164.4],[453.8,164.5],[455.9,164.6],[456.7,164.8],[457.1,165.1],[457.5,165.6],[457.7,166.2],[457.9,166.9],[458.0,167.7],[457.9,168.7],[457.8,169.6],[457.6,170.4],[457.2,171.1],[456.4,171.8],[455.2,172.6],[453.6,173.6],[449.2,176.5],[445.9,179.2],[443.5,182.0],[441.8,185.2],[440.6,188.9],[439.7,193.5],[439.5,195.2],[439.3,197.6],[439.2,201.6],[439.1,208.2],[439.1,218.5],[439.0,233.4],[438.9,249.5],[438.9,260.1],[438.7,266.5],[438.5,269.9],[438.2,271.4],[437.6,272.2],[435.7,274.3],[432.6,277.2],[428.5,280.6],[423.8,284.2],[418.9,287.8],[414.1,291.1],[412.5,292.1],[410.3,293.3],[407.8,294.7],[405.4,296.0],[403.2,297.1],[401.6,297.9],[401.1,298.1],[400.4,298.4],[399.6,298.8],[398.8,299.2],[397.9,299.6],[397.0,300.1],[393.9,301.4],[390.4,302.9],[386.5,304.4],[382.6,305.8],[378.8,307.0],[375.5,308.0],[365.2,310.5],[354.8,312.5],[344.3,313.9],[333.5,314.7],[322.3,315.0]],"b":[[[259.1,248.1],[259.1,247.0],[259.1,243.3],[259.1,235.6],[259.0,222.8],[258.8,203.6],[258.5,176.8],[258.4,169.1],[258.3,160.1],[258.2,150.4],[258.1,140.5],[258.1,130.9],[258.0,122.1],[257.9,114.0],[257.8,106.1],[257.8,98.9],[257.7,92.8],[257.6,88.0],[257.5,84.9],[257.5,82.9],[257.4,81.0],[257.4,79.3],[257.4,77.8],[257.4,76.7],[257.4,76.1],[257.5,75.2],[257.4,74.6],[257.2,74.1],[256.8,73.8],[256.1,74.7],[255.5,76.3],[254.7,79.0],[253.6,83.0],[252.4,87.7],[251.2,92.5],[250.2,97.6],[249.2,102.9],[248.3,108.5],[247.5,114.5],[247.3,115.7],[247.2,116.9],[247.0,118.2],[246.9,119.4],[246.7,120.4],[246.6,121.3],[246.5,122.1],[246.4,123.2],[246.3,124.4],[246.2,125.7],[246.1,127.0],[246.0,128.3],[245.9,129.5],[245.8,130.9],[245.8,132.2],[245.7,133.5],[245.6,134.7],[245.5,135.6],[245.2,142.2],[245.0,151.0],[244.9,161.0],[245.0,171.3],[245.2,180.9],[245.5,188.8],[245.6,190.0],[245.7,191.4],[245.8,193.1],[245.8,194.8],[245.9,196.4],[246.0,198.0],[246.1,199.6],[246.2,201.3],[246.3,203.0],[246.4,204.7],[246.5,206.2],[246.6,207.5],[247.5,216.2],[248.2,223.1],[248.9,228.4],[249.5,232.4],[250.2,235.1],[250.8,236.8],[251.3,237.7],[252.0,239.0],[252.9,240.4],[253.7,241.8],[254.5,243.1],[255.2,244.0],[255.4,244.4],[255.7,244.8],[256.1,245.3],[256.4,245.8],[256.8,246.3],[257.1,246.8],[257.7,247.5],[258.1,248.1],[258.4,248.4]]]}];

(function avvia() {
  // ---- quando NON partire ----
  const salva = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* niente */ } };
  const leggi = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const oggi = new Date().toISOString().slice(0, 10);
  if (CONFIG.mostra === 'giorno' && leggi('ng-intro-giorno') === oggi) return;
  const prova = document.createElement('canvas');
  if (!(prova.getContext('webgl2') || prova.getContext('webgl'))) return;
  salva('ng-intro-giorno', oggi);

  const lingua = leggi('ng-lingua') === 'es' ? 'es' : 'it';
  const L = TESTI[lingua];

  // ---- schermo, testi, bottone audio ----
  if (!document.querySelector('link[data-ng-intro-font]')) {
    const f = document.createElement('link'); f.rel = 'stylesheet'; f.dataset.ngIntroFont = '1';
    f.href = 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400&family=Cormorant+Garamond:ital,wght@1,500&display=swap';
    document.head.appendChild(f);
  }
  const st = document.createElement('style');
  st.textContent = `
  #ng-intro { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden; cursor: pointer; -webkit-tap-highlight-color: transparent;
    background: radial-gradient(120% 80% at 50% 40%, #1d1913 0%, #0b0a08 55%, #040404 100%); font-family: 'Jost', system-ui, sans-serif;
    transition: opacity ${CONFIG.sfumaUscita}s ease; user-select: none; }
  #ng-intro.via { opacity: 0; pointer-events: none; }
  #ng-intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #ng-intro .ngi-audio { position: absolute; top: max(14px, env(safe-area-inset-top)); right: 14px; width: 44px; height: 44px; border-radius: 50%;
    border: 1px solid rgba(217,182,90,.55); background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center;
    padding: 0; cursor: pointer; z-index: 2; }
  #ng-intro .ngi-audio.invito { animation: ngiPulsa 1.6s ease-in-out infinite; }
  @keyframes ngiPulsa { 0%,100% { box-shadow: 0 0 0 0 rgba(226,189,92,.0); } 50% { box-shadow: 0 0 0 7px rgba(226,189,92,.18); } }
  #ng-intro .ngi-testi { position: absolute; left: 0; right: 0; top: 60%; display: flex; flex-direction: column; align-items: center; pointer-events: none; }
  #ng-intro .ngi-oro { background: linear-gradient(180deg, #f6e3a8, #c9a24a); -webkit-background-clip: text; background-clip: text; color: transparent; }
  #ng-intro .ngi-studio { font-weight: 300; font-size: min(46px, 10.5vw); letter-spacing: .95em; padding-left: .95em; opacity: 0; }
  #ng-intro .ngi-riga { height: 1px; width: 0; margin-top: 22px; background: linear-gradient(90deg, transparent, #d9b65a, transparent); }
  #ng-intro .ngi-motto { margin-top: 16px; color: #a8946a; font-weight: 300; font-size: min(11.5px, 2.9vw); letter-spacing: .42em; padding-left: .42em; white-space: nowrap; opacity: 0; }
  #ng-intro .ngi-frase { margin-top: 26px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 500; font-size: min(25px, 6.4vw);
    letter-spacing: .02em; white-space: nowrap; opacity: 0; }
  #ng-intro .ngi-salta { position: absolute; left: 0; right: 0; bottom: max(22px, env(safe-area-inset-bottom)); text-align: center; color: rgba(168,148,106,.55);
    font-size: 11px; letter-spacing: .3em; text-transform: uppercase; opacity: 0; transition: opacity 1s ease; pointer-events: none; }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'ng-intro'; box.setAttribute('role', 'presentation'); box.setAttribute('data-no-i18n', '');
  const ICONA_ON = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="rgba(226,189,92,.18)"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.8 7.8 0 0 1 0 11"/>';
  const ICONA_OFF = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="rgba(226,189,92,.18)"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>';
  box.innerHTML = `<canvas></canvas>
    <button type="button" class="ngi-audio" aria-label="${L.audioOff}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e2bd5c"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONA_OFF}</svg></button>
    <div class="ngi-testi" data-no-i18n>
      <div class="ngi-studio ngi-oro">STUDIO</div><div class="ngi-riga"></div>
      ${CONFIG.motto ? '<div class="ngi-motto">3D DESIGN · CUSTOM FURNITURE</div>' : ''}
      <div class="ngi-frase ngi-oro">${L.frase}</div></div>
    <div class="ngi-salta" data-no-i18n>${L.salta}</div>`;
  (document.body || document.documentElement).appendChild(box);
  const q = (s) => box.querySelector(s);
  const el = { studio: q('.ngi-studio'), riga: q('.ngi-riga'), motto: q('.ngi-motto'), frase: q('.ngi-frase'), salta: q('.ngi-salta'), audio: q('.ngi-audio') };
  const canvas = q('canvas');

  // ---- 3D ----
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { box.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // luce da studio fotografico: grandi pannelli luminosi su fondo scuro → riflessi netti sull'oro
  {
    const s = new THREE.Scene(); s.background = new THREE.Color(0x040404);
    const pannello = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.96, k * 0.9), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
    pannello(7, 2.2, 0, 6, 3, 7); pannello(1.6, 7, -6, 1.5, 3.5, 5); pannello(1.6, 7, 6.5, 0.5, 2, 3.2);
    pannello(12, 2.5, 0, -3, 6, 0.9); pannello(14, 6, 0, 1, -8, 0.25); pannello(9, 2.6, 0, 4.2, 7.5, 2.4);
    scene.environment = pmrem.fromScene(s, 0.015).texture;
  }
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 5000);
  // MISURE DELLO SCHERMO: su iPhone (Safari) all'avvio possono non essere ancora quelle vere e non sempre arriva
  // un «resize» dopo → il 3D restava schiacciato di lato. Si ricontrollano a ogni fotogramma (fotogramma()).
  let misW = 0, misH = 0;
  const dimensiona = () => {
    const w = box.clientWidth || innerWidth, h = box.clientHeight || innerHeight;
    if (!w || !h) return;
    misW = w; misH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  dimensiona(); addEventListener('resize', dimensiona);
  if (window.visualViewport) visualViewport.addEventListener('resize', dimensiona);

  // NG: il logo vero sulla faccia davanti, spessore d'oro dietro
  const shapes = FORME_NG.map(({ f, b }) => {
    const s = new THREE.Shape(f.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of b) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return s;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 20, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 0.9, bevelSegments: 3, curveSegments: 12 });
  geo.center();
  const pianoOro = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -9999), pianoLinee = new THREE.Plane(new THREE.Vector3(1, 0, 0), 9999);
  const oro = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1.0, 0.74, 0.32, THREE.LinearSRGBColorSpace), metalness: 1, roughness: 0.16,
    clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.6, clippingPlanes: [pianoOro] });
  const tela = document.createElement('canvas');
  const [rx, ry, rw, rh] = CONFIG.ritaglioNG;
  tela.width = rw * 2; tela.height = rh * 2;
  const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.repeat.set(1 / rw, -1 / rh); tex.offset.set(0, 1);
  const uLuce = { value: -2 };
  const faccia = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.35, toneMapped: false, clippingPlanes: [pianoOro] });
  faccia.onBeforeCompile = (sh) => {
    sh.uniforms.luce = uLuce;
    sh.fragmentShader = 'uniform float luce;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float bnd = 1.0 - smoothstep(0.0, 0.10, abs(vMapUv.x * 461.0 / 600.0 + (1.0 - vMapUv.y) * 0.35 - luce));
      gl_FragColor.rgb += vec3(1.0, 0.94, 0.78) * bnd * 0.55;`);
  };
  const pezzo = new THREE.Mesh(geo, [faccia, oro]);
  const linee = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), new THREE.LineBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, clippingPlanes: [pianoLinee] }));
  const ng = new THREE.Group(); ng.add(pezzo); ng.add(linee); ng.rotation.x = Math.PI;   // y del disegno verso il basso
  const perno = new THREE.Group(); perno.add(ng); scene.add(perno);

  // PAVIMENTO 3D: righe calcolate pixel per pixel (dritte e pulite a ogni angolo), si allarga e sfuma
  const PAV_Y = -160;
  const uPav = { raggio: { value: 0 }, forza: { value: 0 } };
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(2800, 2300), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: uPav,
    extensions: { derivatives: true },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vP; uniform float raggio; uniform float forza;
      float riga(float c, float passo, float spess){
        float fw = fwidth(c);
        float d = abs(fract(c / passo - 0.5) - 0.5) * passo;
        float l = 1.0 - smoothstep(fw * spess * 0.5, fw * spess * 1.5, d);
        return l * (1.0 - smoothstep(0.12, 0.45, fw / passo));
      }
      void main(){
        float g = max(riga(vP.x, 80.0, 1.0), riga(vP.z, 80.0, 1.0));
        float d = length(vP.xz - vec2(0.0, -120.0));
        float a = g * (1.0 - smoothstep(raggio - 140.0, raggio, d)) * (1.0 - smoothstep(300.0, 1150.0, d)) * forza;
        gl_FragColor = vec4(0.87, 0.71, 0.36, a * 0.62); }` }));
  pav.rotation.x = -Math.PI / 2; pav.position.set(0, PAV_Y, -450); scene.add(pav);

  // CUBO dietro NG, appoggiato su uno spigolo: spigoli come barrette sottili, si disegnano uno dopo l'altro
  const LATO = 235;
  const vtx = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vtx.push(new THREE.Vector3(x, y, z).multiplyScalar(LATO / 2));
  const cuboMat = new THREE.MeshBasicMaterial({ color: 0xf2cd7a, transparent: true, opacity: 0, toneMapped: false });
  const cubo = new THREE.Group();
  const barre = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]].map(([a, b], i) => {
    const p = vtx[a], qv = vtx[b], lung = p.distanceTo(qv);
    const g = new THREE.Group(); g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), qv.clone().sub(p).normalize());
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, lung, 8, 1), cuboMat); m.position.y = lung / 2; g.add(m);
    cubo.add(g); return { g, t0: i / 12 };
  });
  const giraCubo = new THREE.Group(); giraCubo.add(cubo);
  cubo.rotation.set(0, Math.PI / 4, Math.atan(Math.SQRT2), 'ZYX');      // diagonale in verticale
  giraCubo.position.set(0, PAV_Y + LATO * Math.sqrt(3) / 2, -230);
  scene.add(giraCubo);

  const key = new THREE.DirectionalLight(0xfff1d6, 3.2); key.position.set(-300, 400, 600); scene.add(key);
  const fiamma = new THREE.PointLight(0xffe9b0, 0, 900, 1.5); scene.add(fiamma);
  // la lama di luce che "costruisce" l'oro
  const scanMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { forza: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float forza; void main(){ float x = abs(vUv.x - 0.5) * 2.0; float y = abs(vUv.y - 0.5) * 2.0; float a = pow(1.0 - x, 6.0) * (1.0 - pow(y, 4.0)) * forza; gl_FragColor = vec4(1.0, 0.86, 0.55, a); }' });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(70, 430), scanMat); scene.add(scan);

  const ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
  const tra = (t, a, b) => ease((t - a) / (b - a));
  function fotogramma(t) {
    if ((box.clientWidth || innerWidth) !== misW || (box.clientHeight || innerHeight) !== misH) dimensiona();
    camera.position.set(0, 60 - 40 * tra(t, 0, 3), 2650 - 250 * tra(t, 0, 3.2)); camera.lookAt(0, -175, 0);
    perno.rotation.y = THREE.MathUtils.degToRad(-58 + 44 * tra(t, 0.2, 3.4) + 2.5 * Math.sin(t * 0.9) * tra(t, 3.4, 4.5));
    perno.rotation.x = THREE.MathUtils.degToRad(8 - 4 * tra(t, 0.2, 3.4));
    perno.scale.setScalar(0.88 + 0.12 * tra(t, 0, 3));
    linee.material.opacity = tra(t, 0.05, 0.9);
    const x0 = -430 + 860 * tra(t, 1.25, 2.75);
    pianoOro.constant = x0; pianoLinee.constant = -x0;
    scan.position.set(x0, 0, 60); scanMat.uniforms.forza.value = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 1.15) / 1.7)));
    const s = tra(t, 2.2, 3.6);
    fiamma.intensity = 260000 * Math.sin(Math.PI * s); fiamma.position.set(-380 + 760 * s, 260, 260);
    uLuce.value = -0.4 + 1.9 * tra(t, 2.6, 4.2);
    uPav.forza.value = tra(t, 2.75, 3.3); uPav.raggio.value = 60 + 1300 * tra(t, 2.75, 4.0);
    const forzaCubo = tra(t, 3.3, 3.6), avanz = 1.4 * tra(t, 3.3, 4.6);
    cuboMat.opacity = 0.9 * forzaCubo;
    for (const b of barre) { const k = Math.min(1, Math.max(0, (avanz - b.t0) / 0.35)); b.g.scale.set(1, Math.max(1e-4, k), 1); b.g.visible = k > 0; }
    giraCubo.rotation.y = Math.PI / 6 + 0.45 * (1 - tra(t, 3.3, 5.0));
    el.studio.style.opacity = tra(t, 4.4, 5.4);
    el.studio.style.letterSpacing = el.studio.style.paddingLeft = (0.95 - 0.40 * tra(t, 4.4, 5.6)) + 'em';
    el.studio.style.filter = `blur(${4 * (1 - tra(t, 4.4, 5.3))}px)`;
    el.riga.style.width = (260 * tra(t, 5.2, 6.1)) + 'px';
    if (el.motto) el.motto.style.opacity = tra(t, 5.7, 6.4);
    el.frase.style.opacity = tra(t, 6.3, 7.4);
    el.frase.style.transform = `translateY(${10 * (1 - tra(t, 6.3, 7.4))}px)`;
    el.frase.style.filter = `blur(${3 * (1 - tra(t, 6.3, 7.2))}px)`;
    renderer.render(scene, camera);
  }

  // ---- SUONO (parte muto) ----
  let ctxAudio = null, uscitaAudio = null;
  const voleAudio = () => leggi('ng-intro-audio') === '1';
  const iconaAudio = (on) => {
    el.audio.querySelector('svg').innerHTML = on ? ICONA_ON : ICONA_OFF;
    el.audio.setAttribute('aria-label', on ? L.audioOn : L.audioOff);
  };
  function fermaAudio(dolce = 0.3) {
    if (!ctxAudio) return;
    const c = ctxAudio, u = uscitaAudio; ctxAudio = null; uscitaAudio = null;
    try { u.gain.cancelScheduledValues(c.currentTime); u.gain.setValueAtTime(u.gain.value, c.currentTime); u.gain.linearRampToValueAtTime(0, c.currentTime + dolce); } catch (_) { /* niente */ }
    setTimeout(() => { try { c.close(); } catch (_) { /* niente */ } }, dolce * 1000 + 100);
  }
  function suonaDaCapo() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    fermaAudio(0.05);
    const c = new AC();
    if (c.state !== 'running') { try { c.resume(); } catch (_) { /* niente */ } }
    const u = c.createGain(); u.gain.value = 1; u.connect(c.destination);
    programmaSuoni(c, u, c.currentTime + 0.05, CONFIG.durata);
    ctxAudio = c; uscitaAudio = u;
    return true;
  }

  // ---- tempo, salto, fine ----
  let inizio = 0, fine = false, idRaf = 0;
  const ora = () => performance.now() / 1000;
  function chiudi() {
    if (fine) return; fine = true;
    fermaAudio(0.4);
    box.classList.add('via');
    setTimeout(() => {
      cancelAnimationFrame(idRaf); removeEventListener('resize', dimensiona);
      if (window.visualViewport) visualViewport.removeEventListener('resize', dimensiona);
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) { /* niente */ }
      box.remove(); st.remove();
    }, CONFIG.sfumaUscita * 1000 + 50);
  }
  function giro() {
    if (fine) return;
    const t = ora() - inizio;
    fotogramma(Math.min(t, CONFIG.durata));
    if (t > 1.5) el.salta.style.opacity = '1';
    if (t >= CONFIG.durata + CONFIG.pausaFinale) { chiudi(); return; }
    idRaf = requestAnimationFrame(giro);
  }
  el.audio.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ctxAudio) { salva('ng-intro-audio', '0'); fermaAudio(); iconaAudio(false); return; }
    salva('ng-intro-audio', '1'); el.audio.classList.remove('invito'); iconaAudio(true);
    if (suonaDaCapo()) inizio = ora() + 0.05;            // riparte da capo, a tempo col suono
  });
  box.addEventListener('click', chiudi);
  addEventListener('keydown', function tasto(e) { if (e.key === 'Escape' || e.key === 'Enter') { removeEventListener('keydown', tasto); chiudi(); } });

  // ---- parte quando il logo (e i caratteri) sono pronti ----
  const img = new Image();
  const pronti = new Promise((ok) => { img.onload = ok; img.onerror = ok; });
  img.src = CONFIG.logo;
  const caratteri = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([Promise.all([pronti, caratteri]), new Promise((ok) => setTimeout(ok, 2500))]).then(() => {
    if (!img.naturalWidth) { chiudi(); return; }            // logo non trovato: niente animazione
    const g = tela.getContext('2d');
    g.drawImage(img, rx, ry, rw, rh, 0, 0, tela.width, tela.height);
    tex.needsUpdate = true;
    // audio: se l'utente l'aveva acceso, si prova (alcuni browser lo permettono solo dopo un tocco)
    if (voleAudio()) {
      iconaAudio(true);
      suonaDaCapo();
      if (!ctxAudio || ctxAudio.state !== 'running') { fermaAudio(0.01); iconaAudio(false); el.audio.classList.add('invito'); }
    }
    inizio = ora();
    idRaf = requestAnimationFrame(giro);
  });
})();

// =============================================================================
// SUONI — stile "trailer di lusso", generati al momento (Web Audio)
//   0.0  atmosfera scura e bassa (il disegno a linee)
//   1.2  soffio che cresce, senza note (la lama di luce)
//   2.75 un attimo di silenzio, poi colpo profondo + coda metallica (nasce l'oro)
//   2.9  soffio basso (il pavimento)
//   3.35 clic appena accennati, senza melodia (gli spigoli del cubo)
//   4.6  finito il cubo, il suono sfuma piano (~2,5 s); STUDIO e la frase in silenzio
// =============================================================================
function programmaSuoni(ctx, uscita, t0 = ctx.currentTime, durata = 8.6) {
  const T = (s) => t0 + s;
  // ---- uscita: compressore morbido + riverbero da sala grande ----
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.4;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.85, T(0)); master.gain.setValueAtTime(0.85, T(4.6));
  master.gain.exponentialRampToValueAtTime(0.38, T(5.8)); master.gain.exponentialRampToValueAtTime(0.0008, T(7.4));   // sfuma piano
  comp.connect(master); master.connect(uscita);
  const sala = ctx.createConvolver(); sala.buffer = impulso(ctx, 4.2, 3.2);
  const umido = ctx.createGain(); umido.gain.value = 0.6; sala.connect(umido); umido.connect(comp);
  const bus = (secco = 1, eco = 0.5, pan = 0) => {
    const g = ctx.createGain();
    const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p);
    const s = ctx.createGain(); s.gain.value = secco; p.connect(s); s.connect(comp);
    const e = ctx.createGain(); e.gain.value = eco; p.connect(e); e.connect(sala);
    return g;
  };
  const rosa = rumoreRosa(ctx, durata + 1.5);
  const curva = (par, punti) => { par.setValueAtTime(punti[0][1], T(punti[0][0])); for (const [t, v] of punti.slice(1)) par.exponentialRampToValueAtTime(Math.max(v, 0.0001), T(t)); };
  const rumore = (inizio, fine, filtro, gainPunti, dest, off = 0) => {
    const s = ctx.createBufferSource(); s.buffer = rosa; const g = ctx.createGain(); curva(g.gain, gainPunti);
    s.connect(filtro); filtro.connect(g); g.connect(dest); s.start(T(inizio), off); s.stop(T(fine));
  };

  // ---- 0.0 atmosfera scura: nota bassa + soffio lontano ----
  {
    const b = bus(0.9, 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.5; lp.connect(b);
    const g = ctx.createGain(); g.connect(lp);
    curva(g.gain, [[0, 0.0001], [1.4, 0.16], [2.6, 0.12], [2.72, 0.0001]]);
    for (const [f, det, tipo] of [[36.71, 0, 'sine'], [73.42, -7, 'sawtooth'], [73.42, 7, 'sawtooth'], [110, 0, 'sine']]) {
      const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = tipo === 'sine' ? 0.7 : 0.25; o.connect(og); og.connect(g); o.start(T(0)); o.stop(T(2.8));
    }
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    rumore(0, 2.8, bp, [[0, 0.0001], [1.0, 0.05], [2.72, 0.0001]], bus(0.6, 0.9));
  }
  // ---- 1.2 soffio che cresce (riser senza note) ----
  {
    const b = bus(0.8, 0.8);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1; curva(bp.frequency, [[1.2, 300], [2.72, 5200]]);
    rumore(1.2, 2.74, bp, [[1.2, 0.0001], [2.68, 0.32], [2.72, 0.0001]], b, 1.0);
    // tensione: due seghe scordate con il filtro che si apre (si sente il "salire", non una melodia)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.5; curva(lp.frequency, [[1.2, 180], [2.72, 2600]]);
    const g = ctx.createGain(); curva(g.gain, [[1.2, 0.0001], [2.68, 0.11], [2.72, 0.0001]]);
    lp.connect(g); g.connect(b);
    for (const det of [-11, 0, 13]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 73.42; o.detune.value = det; o.connect(lp); o.start(T(1.2)); o.stop(T(2.75)); }
  }
  // ---- 2.75 colpo profondo + coda metallica ----
  {
    const b = bus(1, 0.55);
    const sub = ctx.createOscillator(); sub.type = 'sine'; curva(sub.frequency, [[2.76, 62], [4.2, 34]]);
    const sg = ctx.createGain(); curva(sg.gain, [[2.76, 0.0001], [2.775, 0.75], [4.6, 0.0001]]);
    sub.connect(sg); sg.connect(b); sub.start(T(2.76)); sub.stop(T(4.7));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    rumore(2.76, 3.4, lp, [[2.76, 0.0001], [2.768, 0.55], [3.3, 0.0001]], b, 2.2);
    // coda metallica, larga e lontana
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 6500; hp.Q.value = 3;
    rumore(2.76, 7.4, hp, [[2.76, 0.0001], [2.79, 0.09], [7.2, 0.0001]], bus(0.35, 1.2), 3.1);
    for (const [f, pan] of [[1180, -0.5], [1745, 0.5], [2410, 0]]) {      // risonanze di metallo (non melodiche, smorzate)
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); curva(g.gain, [[2.76, 0.0001], [2.78, 0.025], [6.6, 0.0001]]);
      o.connect(g); g.connect(bus(0.4, 1.1, pan)); o.start(T(2.76)); o.stop(T(6.7));
    }
  }
  // ---- 2.9 soffio basso: il pavimento si allarga ----
  {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; curva(lp.frequency, [[2.9, 160], [4.0, 1100]]);
    rumore(2.9, 6.6, lp, [[2.9, 0.0001], [3.5, 0.09], [6.4, 0.0001]], bus(0.7, 0.8), 4.0);
  }
  // ---- 3.35 clic appena accennati: gli spigoli ----
  for (let i = 0; i < 12; i++) {
    const t = 3.36 + i * 0.078 + ((i * 37) % 5) * 0.006;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3800 + ((i * 53) % 7) * 220; hp.Q.value = 6;
    rumore(t, t + 0.12, hp, [[t, 0.0001], [t + 0.002, 0.09], [t + 0.09, 0.0001]], bus(0.5, 0.5, ((i * 29) % 9) / 4.5 - 1), 5 + i * 0.13);
  }
}

/** Nota di pianoforte morbido (feltro): poche armoniche che si spengono piano. */
function pianoforte(ctx, dest, t, f, vol) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(dest);
  [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.04]].forEach(([k, a]) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * k * (1 + 0.0007 * (k - 1));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * a, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / Math.sqrt(k));
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + 2.7);
  });
}
/** Rumore rosa (più morbido del bianco: soffi e fruscii naturali). */
function rumoreRosa(ctx, sec) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, s = 98765;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff; const w = (s / 0x7fffffff) * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}
/** Riverbero da sala grande (coda che si spegne piano, stereo). */
function impulso(ctx, sec, decad) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let s = 4242 + c * 977;
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const pre = Math.min(1, i / (ctx.sampleRate * 0.02));
      d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / n, decad) * pre; } }
  return b;
}

