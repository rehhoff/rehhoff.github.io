# Plan: Afleveringstjek (forslag 10) og tavlefortegnelse (forslag 11)

Planlagt af Claude Opus 2026-11-18. Udføres af Claude Sonnet, fordi opgaven kun bruger eksisterende data. Ingen ændring af datamodellen.

## Forslag 10: Afleveringstjek

- Nyt panel øverst i fanen Fejlfinder: "Klar til aflevering?". Genbrug `mangler()`, `warnings()` og `maalVurdering()`.
- Kategorier, hver med antal og en liste:
  - Grupper uden brugsgenstande.
  - Brugsgenstande uden gruppe, kabel eller længde.
  - Målinger, der mangler eller er fejlet (`maalVurdering`), og visuel kontrol, der ikke er afkrydset (`maal.ok`).
  - Tavler uden tilgangskabel (undtagen hovedtavlen) og uden Z<sub>e</sub>.
  - Kabler, der ikke er trukket (`trukket`, `tTrukket`).
  - Brandlukninger, der ikke er udført eller mangler mærkat (`brandlukninger`).
  - Advarsler (ΔU, I<sub>z</sub>, I<sub>k</sub>, selektivitet).
- Klik på en linje går til stedet. Brug de eksisterende `goGruppe`, `go` og `openForm`.
- Grøn status "Klar til aflevering", når alt er OK.
- Med i dokumentationen som en kort status, fx "Afleveringstjek: 3 punkter mangler", kun hvis noget mangler.

## Forslag 11: Tavlefortegnelse

- Knap "Udskriv tavlefortegnelse" pr. tavle (i fanen Tavle og under Dokumentation → Eksport).
- Giver en A4-side til tavlelågen med:
  - tavlens navn og placering
  - pr. gruppe: nr., navn, karakteristik og I<sub>n</sub>, faser, HPFI, lokaler, og brugsgenstande i kort form
  - dato og firmanavn fra `tavleoversigt.firma`
- Brug samme print-mekanisme som `udskriv()` i `js/lagring.js` (nyt vindue + `print()`). Byg en ny funktion `tavleFortegnelseHtml(tid)`. Rør ikke `docHtml` ud over en linje til afleveringsstatus.
- Stor, letlæselig skrift. Højst én side for op til ca. 24 grupper, ellers sideskift mellem rækker.

Fjern 10 og 11 fra `docs/forslag.md`.

## Test (`tests/smoke.py`)

- Afleveringstjekket viser kendte mangler i eksempelprojektet.
- Status er "klar", når manglerne er rettet i en kopi af data.
- Et klik går til stedet.
- `tavleFortegnelseHtml` indeholder alle gruppenumre og `@page`.
- Udskriv åbner et vindue (Playwright `popup`).

Røgtesten skal give `OK`. Kontrollér visuelt i den indbyggede browser ved 1300 og 390 px.
