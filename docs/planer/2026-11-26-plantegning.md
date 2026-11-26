# Fanen Plantegning

Planlagt og udført af Claude Opus 5.5 2026-11-26 (Opus må ændre koden direkte; opgaven ændrer datamodellen og er den eneste, der gør det nu). Status: færdig (10.33.0). Skema 20 → 21.

## Ønske og aftaler (2026-11-26)

Alexander vil have en fane "Plantegning", hvor plantegninger, eltegninger og lignende kan uploades. Aftalt:

- Billeder (JPEG/PNG) og PDF. PDF'en laves om til ét billede pr. side ved upload (pdf.js 3.11.174 fra cdnjs, hentes først, når en PDF vælges). Resten af appen arbejder kun med billeder.
- Høj opløsning: længste side ca. 3000 px, JPEG, mål højst ca. 1,5 MB pr. tegning.
- Placér komponenter (tavler, samlepunkter, brugsgenstande, dataudtag/kameraer, brandlukninger) som nummererede prikker på tegningen, farvet efter status (trukket / udført og mærkat). Klik åbner posten.
- Mål kabellængde: kalibrér målestokken med to punkter og en kendt afstand, tegn en kabelvej, og brug længden på en brugsgenstand, et samlepunkt eller et dataudtag.
- Knyt en tegning til et lokale. Lokalefilteret gælder også fanen, og fanen Lokaler viser lokalets tegninger.
- Tegningerne kommer med i dokumentationen med prikker og en liste.

## Datamodel (skema 21)

`tegninger[]`: `{ id, navn, lokaleId, billede (billed-id), forhold (højde/bredde), skala (meter pr. billedbredde, 0 = ikke kalibreret), punkter: [{ k, x, y }] }`.

- `k` er komponentens nøgle som i enstreg: `t:` tavle, `d:` samlepunkt, `e:` brugsgenstand, `x:` dataudtag/kamera, `b:` brandlukning (ny). Én prik pr. komponent pr. tegning.
- `x` og `y` er brøkdele af billedets bredde (`y` går fra 0 til `forhold`), så afstande er ens i begge retninger.
- `norm()`: standardværdier, kun gyldige punkter, ingen dubletter. Prikker til komponenter, der er slettet, beholdes i data, men vises ikke.
- `billedIds()` i `js/data.js` får `tegninger[].billede`, så oprydningen aldrig sletter en tegning, der bruges, og så tegningerne kommer med i backupfil og billedsynk.
- Billedet ligger i IndexedDB (`billeder` og `mini`) og i billed-Gist'en som alle andre billeder.

## Filer

- Ny `js/plan.js` (`APP_PLAN`): upload, PDF, visning (SVG), prikker, målestok, måling, dokumentation. Tilføjes i `index.html`, `bland()` i `js/app.js` og `SKAL` i `sw.js`.
- `js/data.js`: `tegninger` i `tom()` og `norm()`, `billedIds()`, `SCHEMA` 21.
- `js/app.js`: fanen `plan` sidst i `views` (tastegenvejene 1–0 er uændrede), tilstand, sletning af lokale nulstiller `lokaleId`.
- `index.html`: fanen, knap i Lokaler.
- `js/lagring.js`: afsnittet i `docHtml()`.
- `css/app.css`: prikker og visning.
- `tests/smoke.py`: opgradering fra skema 20, upload af billede og PDF (falsk pdf.js), prikker, målestok og måling, lokale, dokumentation, `billedIds()`.

## Ikke med nu

- PDF-import uden net første gang (pdf.js hentes fra cdnjs).
- Gemte kabelveje: målingen bruges til længden og gemmes ikke som streg.
