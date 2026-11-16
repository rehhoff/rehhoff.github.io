# Projekthukommelse for Claude: El-oversigtsappen

Denne fil er den faste hukommelse for projektet. Læs den før du ændrer noget. Den gælder i Claude Code og i Claude chat, uanset session.

## Hvad projektet er

En webapp til elektrikerarbejde: overblik over tavler, grupper, lokaler, brugsgenstande, kabler, samlepunkter, afbrydere og svagstrøm (PDS og CCTV) i et elprojekt. Appen regner spændingsfald, fasebalance, overlast og kabelkontrol, tegner enstregs- og tændingsdiagrammer og laver dokumentation til udskrift.

- Ejer: Alexander (elektrikerlærling i Odense, også bioanalytikerstuderende). Brugerfladen er på dansk.
- Live: https://rehhoff.github.io/ (GitHub Pages fra `main`, mappe `/`).
- Hele appen er én fil: `index.html` (Tailwind fra CDN, Alpine.js 3.14.1 fra cdnjs, ingen build).
- Historik: `CHANGELOG.md`. Opbygning og datamodel: `docs/ARKITEKTUR.md`.

## Regler for hvem der ændrer hvad

- Appen er bygget af Claude Fable (version 1 til 8).
- Claude Opus må lave ændringer direkte, når resultatet holder samme kvalitet: samme design, test før commit og opdateret dokumentation.
- Claude Opus må planlægge alle opgaver, også store og svære (beregningsmotoren, datamodellen, enstregsdiagrammet, nye faner, migreringer).
  - I planen tager Opus selv stilling til, om opgaven bedst udføres af Fable, Opus eller Sonnet, og skriver det i planen med en kort begrundelse.
- Claude Fable må gennemgå og ændre enhver plan, hvis den ønsker det, også før eller under implementeringen. Ændringer noteres i planen med dato og begrundelse.
- Claude Sonnet (og mindre modeller) må kun implementere efter en skriftlig plan fra Opus eller Fable.
- Planen gemmes i `docs/planer/ÅÅÅÅ-MM-DD-emne.md` før implementeringen og nævnes i commit-beskeden.
- Er du i tvivl om din rolle, så spørg Alexander, før du ændrer kode.

## Ønsker fra Alexander, der altid gælder

- Svar kort, direkte og teknisk præcist.
- Spørg før du tilføjer funktioner, han ikke har bedt om. Foreslå dem i stedet.
- Kabeltyper i appen er kun: Brandkabel, XLPE, PVC, PKAJ, PKL. Feltet "Tilgangskabel" på tavlen er fritekst og skal blive ved med at være det.
- Samlepunkttyper er kun: Membrandåse, Indmuringsdåse, Forfradåse, Underlag, Europadåse, PL-dåse.
- Datakabler under svagstrøm (Cat6, Cat6A, Cat7, fiber) er undtaget fra kabellisten.

## Data må aldrig gå tabt

Brugerens projekter ligger i browserens localStorage på `rehhoff.github.io`. En ny version af `index.html` læser de samme nøgler, så data overlever opdateringer, så længe disse regler holdes:

1. Omdøb eller fjern aldrig disse nøgler: `tavleoversigt.projekter`, `tavleoversigt.p.<id>`, `tavleoversigt.backups`, `tavleoversigt.tema`, `tavleoversigt.sync` (samt de gamle `tavleoversigt.v1` og `tavleoversigt.v2`, som stadig migreres).
2. Ændrer du datamodellen, så udvid `norm()` med standardværdier og migrering af gamle felter, og hæv `SCHEMA`. Første indlæsning efter en hævning tager automatisk en backup i browseren (`lavBackup`), før noget skrives.
3. Slet aldrig et felt, som brugeren har data i, uden at flytte dataene først.
4. Test altid en opgradering: opret data i den gamle version, åbn den nye på samme origin, og kontrollér at projekterne er intakte (se `tests/smoke.py`).

## Sådan laves en ændring

1. Lav en branch fra `main`.
2. Ret `index.html`. Hold koden i én fil, medmindre Alexander beder om andet.
3. Hæv `APP_VERSION` i `index.html` (semver: ny funktion = minor, rettelse = patch, større omlægning = major). Hæv `SCHEMA` kun ved ændret datamodel.
4. Tilføj et afsnit øverst i `CHANGELOG.md` med dato, version, model og hvad der er ændret.
5. Opdater `docs/ARKITEKTUR.md`, hvis felter, nøgler, faner eller sektioner ændres.
6. Kør `npm install` og `python3 tests/smoke.py`. Den skal slutte med `OK`.
7. Commit, push og åbn en pull request mod `main`. Pages opdateres, når den er merget.

## Faglige forudsætninger i beregningerne

Alt er vejledende og står også i appen:

- ρ = 0,0225 Ω·mm²/m, cos φ = 1, 230 V og 3 × 400 V.
- ΔU-grænse 3 % for lys og 5 % for øvrige (DS/HD 60364-5-52, anneks G). ΔU summeres gennem tilgangskabel, samledåser og afgang.
- I<sub>z</sub>: PVC-isoleret kobber, installationsmetode C, 30 °C, uden korrektionsfaktorer. XLPE bruger endnu samme tabel.
- Gruppens last = summen af brugsgenstandenes strøm × gruppens samtidighedsfaktor + rackforbrug. Forslag til faktorer følger installationstype og gruppetype.
- Effektforslag er typiske mærkeeffekter, ikke dimensioneringsværdier.

## Kendte begrænsninger og åbne forslag

- Data ligger i browseren. Synkronisering mellem enheder kræver, at brugeren forbinder en GitHub Gist med et token (Dokumentation → Synkronisering). Ellers er en backupfil eneste kopi på tværs af enheder.
- Tailwind kører fra CDN og giver en advarsel i konsollen. En bygget CSS-fil vil fjerne afhængigheden.
- Forslag Alexander ikke har taget stilling til endnu: egen I<sub>z</sub>-tabel for XLPE, krydsafbryder, afbrydere i enstregsdiagram, tændingsdiagrammer i eksporten.
