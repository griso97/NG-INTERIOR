# NG Interior — Configuratore armadi su misura

Web app per configurare armadi su misura (a **battente** o **scorrevoli**):
inserisci le misure esterne e i parametri, ottieni il **modello 3D** e la
**distinta di taglio** pronta da esportare in CSV o PDF.

## Caratteristiche

- Due tipi di armadio: **a battente** e **scorrevole** (selettore in alto)
- Vista 3D in tempo reale (Three.js)
- Distinta di taglio automatica con le tue formule
- Setup carcassa a scelta: top/fondo passanti **oppure** fianchi passanti
- Moduli multipli con larghezze indipendenti
- Ante a battente, ante scorrevoli con sovrapposizione, ripiani (anche
  "meno profondi"), cassettiere
- 4 tamponamenti attivabili (sx, dx, sopra, sotto) con fascia di fissaggio a L
- Parametri scorrevole modificabili: sovrapposizione, altezza binari,
  spazio binari
- Esportazione **CSV** e **PDF** (impaginato con intestazione lavoro + data)
- Salva/carica configurazione (localStorage e file JSON)
- Interfaccia in italiano, stile NG INTERIOR (nero/oro)
- Usabile anche da tablet in cantiere

## Struttura dei file

```
ng-interior-configuratore/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── main.js            ← orchestratore
    ├── calcoli.js         ← MOTORE DISTINTA (formule) — modificabile da solo
    ├── scena3d.js         ← vista 3D Three.js
    ├── interfaccia.js     ← pannello parametri (sidebar sx)
    ├── distinta.js        ← tabella distinta (sidebar dx)
    ├── esportazione.js    ← CSV + PDF
    └── storage.js         ← salvataggio/caricamento JSON e localStorage
```

> Il file **`js/calcoli.js`** è il cuore: ogni funzione è una formula del
> prompt, commentata. Se un giorno vuoi cambiare una regola, modifichi
> solo lì senza toccare né la grafica né l'interfaccia.

## Avviare in locale

Il progetto è vanilla JS con ES modules — serve solo un web server
statico (i browser non caricano moduli da `file://`).

**Opzione 1 — Python (preinstallato quasi ovunque):**
```bash
cd ng-interior-configuratore
python3 -m http.server 8000
```
Poi apri `http://localhost:8000` nel browser.

**Opzione 2 — Node:**
```bash
cd ng-interior-configuratore
npx --yes serve .
```

**Opzione 3 — estensione VS Code "Live Server":** apri la cartella in VS
Code, click destro su `index.html` → *Open with Live Server*.

## Pubblicare online (gratis)

Il sito è completamente statico: va bene qualsiasi host statico.

**Netlify Drop** (più veloce): vai su https://app.netlify.com/drop e
trascina la cartella `ng-interior-configuratore` nella pagina. Hai subito
un URL pubblico tipo `https://nome-casuale.netlify.app`.

**GitHub Pages:**
1. Crea una repo GitHub e caricaci la cartella.
2. Settings → Pages → Source: `main` branch, cartella `/ (root)`.
3. L'URL sarà `https://<utente>.github.io/<repo>`.

**Vercel** (anche gratis): `npx vercel` dalla cartella.

Per un dominio personalizzato (es. `configuratore.nginterior.it`),
aggiungilo nelle impostazioni del provider scelto e punta il DNS.

## Formule della distinta (riferimento rapido)

Tutte in mm.

### Comuni a entrambi i tipi

- **Setup 1** (default, top/fondo passanti):
  - Top/Fondo = larghezza_modulo × prof_carcassa
  - Fianchi (×2) = (altezza_esterna − 2·spessore_carcassa) × prof_carcassa
- **Setup 2** (fianchi passanti):
  - Fianchi (×2) = altezza_esterna × prof_carcassa
  - Top/Fondo = (larghezza_modulo − 2·spessore_carcassa) × prof_carcassa
- **Schiena** = (larghezza_modulo − 2) × (altezza_esterna − 2)
- **Ripiani** = (larghezza_modulo − 2·spessore_carcassa) × (prof_carcassa − riduzione)
- **Tamponamenti**:
  - laterali: faccia = larghezza_utente × altezza_esterna
  - sopra/sotto: faccia = larghezza_utente × (larghezza_totale + larSx + larDx)
  - fascia fissaggio: 30 mm × (lunghezza_faccia − 2)

### Battente

- **Profondità carcassa** = profondità_esterna − spessore_ante − spessore_schiena
- **Ante** per modulo (N ante): larghezza = (larghezza_modulo − (N+1)·2) ÷ N ;
  altezza = altezza_esterna − 4

### Scorrevole

Le ante scorrevoli NON sono per modulo: coprono tutta la larghezza
dell'armadio e si sovrappongono tra loro.

- **Profondità carcassa** = profondità_esterna − spazio_binari − spessore_schiena
- **Ante** (N ante, intero armadio):
  - larghezza = (larghezza_totale + (N − 1) × sovrapposizione) ÷ N
  - altezza = altezza_esterna − altezza_binari
- Parametri default (modificabili dall'utente):
  - spazio_binari = 65 mm (ingombro frontale del sistema)
  - altezza_binari = 65 mm (binario sup + inf + aria)
  - sovrapposizione = 40 mm (overlap tra ante adiacenti)

> Verifica questi 3 default rispetto al tuo binario standard al primo
> utilizzo — poi li salvi con il resto della configurazione.

## Prossimi passi previsti

- Formule interne cassetti (fianchi/fondo/retro).
- Preventivo con prezzi al m² per materiale.
- Libreria di armadi "modello" salvati come template.
