# Omdøb projekt og flueben for trukket kabel i Lokaler

Planlagt og udført af Claude Opus 5.5 2026-11-22. Status: færdig.

## Ønske (Alexander)

1. Man skal kunne omdøbe et projekt.
2. Under fanen Lokaler skal der være et flueben, så man kan se, hvilke brugsgenstande der er trukket kabel til.

## Løsning

- Dialogen Projekter: knappen **Omdøb** på hvert projekt, også dem, der ikke er åbne. Navnet rettes i en linje med Gem og Annullér (Enter gemmer, Esc annullerer). Det aktive projekt rettes gennem `mutate()` (kan fortrydes), andre projekter læses, rettes og skrives med `skriv()`, og projektlisten opdateres med `meta()`. Et tomt navn afvises. Metoderne `omdoebStart`, `omdoebGem` ligger i `js/lagring.js` ved de andre projektmetoder.
- Navnefeltet øverst i appen kan stadig rettes direkte; det får en tydeligere stiplet kant og en titel, så man kan se, at det kan rettes.
- Fanen Lokaler: et afkrydsningsfelt foran hver brugsgenstand, bundet til det eksisterende felt `trukket` (skema 13, samme felt som i Føringsvej). Lokalets overskrift viser "x af y trukket".
- Ingen ændring i datamodellen, `SCHEMA` forbliver 17.

## Filer

`index.html`, `js/lagring.js`, `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, versionen fire steder (minor: 10.27.0).

## Test

Røgtesten: omdøb et projekt, der ikke er åbent, og det aktive, og kontrollér navnet i projektlisten og i localStorage. Sæt flueben i Lokaler og kontrollér `trukket` på brugsgenstanden og i Føringsvej.
