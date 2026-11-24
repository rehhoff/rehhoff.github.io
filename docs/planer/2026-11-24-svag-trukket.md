# Trukket på svagstrømskabler

Planlagt og udført af Claude Opus 5.5 2026-11-24 (lille opgave, Opus må ændre koden direkte). Status: færdig (10.29.0).

## Ønske

Alexander vil kunne markere et svagstrømskabel som trukket på samme måde som installationskablerne, med flueben ved hvert kamera og dataudtag.

## Løsning

- `js/data.js`: `SCHEMA` 18 → 19. `norm()` giver hver forbindelse i `links` feltet `trukket` (boolsk, standard `false`).
- `js/app.js`: standardværdi i formularen, `trukket` gemmes som boolsk, klon af lokale nulstiller `trukket`. Duplikering nulstiller allerede felter, der hedder `trukket`.
- `index.html`: afkrydsning "Kablet er trukket" i formularen, kolonne med flueben og optælling i fanen Svagstrøm, flueben i fanen Lokaler. Fluebenene gemmer direkte via `fvSaet` (kan fortrydes).
- `js/aflevering.js`: ikke trukne svagstrømskabler med længde står under "Kabler, der ikke er trukket".
- `tests/smoke.py`: opgradering fra skema 18 med intakte data, flueben, formular, fortryd og aflevering.

## Filer

`js/data.js`, `js/app.js`, `js/aflevering.js`, `index.html`, `css/tailwind.css` (bygget), `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, versionen fire steder.
