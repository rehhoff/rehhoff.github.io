# Service workeren rører kun egne adresser

Planlagt og udført af Claude Opus 5.5 2026-11-22. Status: færdig (10.26.1).

## Problem

Elskolen er en separat app i sit eget repo (`rehhoff/elskole`), men GitHub Pages udgiver den under `rehhoff.github.io/elskole/`. Det er samme origin som El-oversigtsappen, og El-oversigtsappens service worker har scope `/`. Første gang Elskolen åbnes (før dens egen service worker er installeret), henter El-oversigtsappens service worker siden net først og gemmer svaret som sin egen `index.html`. Uden net viser El-oversigtsappen derefter Elskolens side.

## Løsning

- `sw.js`: ny konstant `EGNE` med appens egne stier i forhold til scope. Forespørgsler på samme origin, der ikke matcher, får ingen `respondWith` og går direkte til nettet.
- `tests/smoke.py`, afsnit 7: åbn `/elskole/` og `/elskole/index.html`, og kontrollér, at den gemte `index.html` stadig er appens. Tjekket fejler uden rettelsen.

## Filer

`sw.js`, `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, versionen fire steder.

## Fremover

En ny mappe på øverste niveau, som appen selv skal bruge offline, skal også stå i `EGNE`.
