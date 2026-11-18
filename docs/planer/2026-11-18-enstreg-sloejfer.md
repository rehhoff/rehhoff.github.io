# Enstregsdiagram med sløjfer, Tilgang, pinch-zoom og 16 px på touch

Dato: 2026-11-18 · Planlagt og udført af Claude Opus (opgaven kom fra Opus-hovedsessionen; ingen Sonnet-plan, fordi diagramkoden kræver overblik).

`SCHEMA` hæves ikke (en anden session laver skema 14 samtidig). Ingen ændring af datamodellen.

## Filer

- `js/diagram.js` (hovedfil): `sld` tegner sløjfer, `spor` tager sløjfekæden med, symbol `tilgang`, pinch-zoom (`panStart`, `panMove`, `panEnd`).
- `js/app.js`: kun `symNavn.tilgang`.
- `js/beregning.js`: nøgletal og materialeliste tæller ikke Tilgang som brugsgenstand (to linjer).
- `index.html`: `@pointerup/@pointercancel` på diagrammet, hjælpetekst, `?v=`.
- `css/app.css`: sløjfestreger og 16 px på `pointer:coarse`.
- `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, versionsfilerne.

## 1. Sløjfer i enstregsdiagrammet

- `drawKids` tegner kun rødder (brugsgenstande uden gyldig `fraEnhed`) fra tavlen/dåsen. Efter hver rod tegnes dens sløjfer rekursivt i rækkerne lige under.
- Børn sorteres, så dem uden egne sløjfer kommer først. Fire udtag med hver sin stikkontakt giver U1, S1, U2, S2, U3, S3, U4, S4.
- Et barns streg starter i et forgreningspunkt på forælderens streg, 24 px længere inde for hvert niveau (højst til lige før afbryderen). Forgreningspunktet er en prik `circle.dot.sp[data-sp=<forælder>]`, og en lodret streg går fra forælderens række ned til barnets.
- Rækken får `data-fra=<forælder>` og teksten "sløjfe fra …".
- `spor('e:…')` får sløjfekæden med, så sporing og nedtoning efter lokale også fremhæver udtagene foran.
- Den statiske udgave (`sld(true)`) bruger samme kode.

## 2. Tilgang

- Nyt symbol `tilgang` (udfyldt rombe med ring) i `symNavn`. Navn, der begynder med "tilgang", giver symbolet automatisk.
- Ingen effektforslag, så standard er 0 W. Tælles ikke i nøgletal og i materialelistens Brugsgenstande; kablet tælles stadig.

## 3. Pinch-zoom

- Pointer events: to fingre zoomer om midtpunktet og panorerer samtidig; én finger panorerer som før. `touch-action:none` på `.sldbox` findes i forvejen, så siden ikke zoomer samtidig. Knapperne − og + beholdes.

## 4. Ingen auto-zoom på mobil

- `@media (pointer:coarse)`: alle `input` (undtagen afkrydsning, radio, skyder), `select` og `textarea` får `font-size:16px !important`, så også inline-styles og pop-ups er dækket.
- Valg: **ingen** `maximum-scale=1`. 16 px er nok til at stoppe auto-zoom på iOS, og `maximum-scale` ville forhindre pinch-zoom af siden på Android.

## Test

- Røgtest: kædens rækkefølge, `data-fra`, forgreningsprikker, sporing gennem kæden, sløjfer i `sld(true)`.
- Tilgang: symbol, 0 W, ikke i nøgletal og materialeliste.
- Mobil med `has_touch`: ingen synlige felter under 16 px i nogen fane eller formular; pinch med to pointere ændrer zoom.
- Manuelt i den indbyggede browser ved 375 px: ingen vandret rulning. Rigtig iPhone-test mangler.
