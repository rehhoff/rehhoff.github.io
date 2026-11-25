# Rettelser efter gennemgang af datasikringen

Planlagt og udført af Claude Opus 5.5 2026-11-25 efter en gennemgang af hele repoet, som Alexander bad om at få rettet. Status: færdig (10.29.2).

## Rettelser

1. `js/app.js`, storage-hændelsen: kopien i `MEM` slettes for alle projektnøgler, som en anden fane skriver, ikke kun for det aktive projekt. Ellers læser `laes()` en forældet kopi, som `aktiver()`, backup og synkronisering kan skrive tilbage.
2. `js/lagring.js`, `synkKoer`: stop, når Gist'en er afkortet (`truncated`) eller har 300 filer eller flere. Samme grænse som oprydningen bruger.
3. `js/app.js`, `init()`: kan det aktive projekt ikke læses, åbnes et tomt projekt under et nyt id, og den gamle nøgle røres ikke.
4. `js/lagring.js`, `importBackup`: projekt-id bruges kun, hvis det passer til `BID`; ellers et nyt `uid()`.
5. `sw.js`: kun svar med `ok` gemmes som `index.html`.
6. `js/data.js`: den ubrugte tabel `IZ` er fjernet (også i `CLAUDE.md` og `docs/ARKITEKTUR.md`).

## Test

`tests/smoke.py`, afsnit 4q: anden fane, Gist med 300 filer, ugyldigt backup-id og ulæseligt projekt ved start. Service workerens ændring er ikke testet særskilt.
