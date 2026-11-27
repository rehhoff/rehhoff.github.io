# Plantegning: mørkere tegning og infokasse

Planlagt af Claude Opus 5.5 2026-11-27. Udføres af Claude Sonnet 5.5 (Alexander bad om Sonnet; opgaven er afgrænset til fanen Plantegning og følger mønstret fra symbolstørrelsen). Ændrer datamodellen (skema 24 → 25). Ingen anden session må ændre datamodellen samtidig.

## Ønske

"Det skal være muligt at formørke plantegningen, så det er nemmere at se symbolerne via kontrast. Man skal også kunne se en lille kasse med informationer om et komponent ved at holde musen over det (på mobil: ved at trykke)."

## Løsning

### Mørkere tegning
- Datamodel: `tegninger[].moerk` (0–0,8, standard 0). `norm()` giver gamle tegninger 0 og klemmer værdien til 0–0,8; intet andet ændres. `SCHEMA` 24 → 25.
- `planSvg(t, false)`: lige efter `<image>` tegnes `<rect class="pl-moerk" width="1000" height="H" fill="#000" fill-opacity="moerk" pointer-events="none"/>`, kun når moerk > 0. Ikke i print (`planSvg(t, true)`), så dokumentationen er uændret.
- Sidepanelet ved Symbolstørrelse: en skyder `id="pl-moerk"` (type range, 0–80 %, trin 10) med label "Mørkere tegning" og visning i procent. Gemmes med `planSaet(t, 'moerk', v)`.

### Infokasse
- Ny metode `planInfo(k)` i `js/plan.js`: linjer til kassen ud fra `planKomp(k)` og eksisterende hjælpere: art og navn, lokale (med etage), for brugsgenstand og samlepunkt også gruppe/tavle, kabel og længde, når de findes, og status (Trukket/Udført eller Mangler). Brug eksisterende hjælpere (fx `lokaleNavn`) frem for at skrive nye.
- Tilstand i `app()`: `planInfoK` (nøglen på den viste prik, '' = ingen). Nulstilles i `planNulstil()` og ved skift af tegning.
- Mus: `pointerover`/`pointerout` på `#pl-tegning` med `pointerType === 'mouse'` og `closest('[data-k]')` sætter og rydder `planInfoK`. Klik åbner formularen som i dag.
- Berøring/pen: uden aktiv tilstand (`planMode === ''`) viser et tryk på en prik (eller den nærmeste inden for 22 px, `planNaer`) kassen i stedet for at åbne formularen. Kassen har knappen "Åbn", som kalder `openForm`. Tryk ved siden af lukker kassen. Pointertypen huskes fra `pointerdown`.
- I tilstandene Placér, Målestok og Mål kabel vises ingen kasse ved tryk.
- Kassen er en lille absolut placeret `div` (`id="pl-info"`, `role="tooltip"`, `aria-live="polite"`) i en `position:relative`-wrapper om `#pl-tegning`, placeret ved prikken i procent af tegningens bredde/højde, så den følger zoom. Den holdes inden for tegningen (vend til venstre/op nær kanten). Farver fra tokens i `:root` (lyst og mørkt tema), som `.panel`.
- `<title>` i prikken på skærmen fjernes (kassen erstatter den); i print beholdes den.
- Esc lukker kassen.

## Filer
`js/data.js` (norm, SCHEMA), `js/plan.js`, `js/app.js` (tilstanden `planInfoK`, ét sted), `index.html` (skyder, wrapper, kasse), `css/app.css`, `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`.

## Test (tests/smoke.py)
- Opgradering fra skema 24: en tegning uden `moerk` får 0, `symbol` og `punkter` er intakte.
- Skyderen sat til 50 %: `.pl-moerk` findes med fill-opacity 0.5, og værdien er gemt efter genindlæsning.
- Mus over en prik viser `#pl-info` med komponentens navn; musen væk skjuler den.
- Tryk (touch) på en prik uden tilstand viser kassen og åbner ikke formularen; "Åbn" åbner formularen.

## Status
færdig (10.44.0)
