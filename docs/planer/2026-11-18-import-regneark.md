# Plan: Import fra regneark (forslag 16)

Planlagt af Claude Opus 2026-11-18. Udføres af Claude Sonnet, fordi opgaven kun opretter poster med eksisterende felter. Ingen ændring af datamodellen.

## Funktion

- Knap "Importér fra regneark" i fanen Lokaler og i fanen Kabler. Den åbner en dialog med et stort tekstfelt.
- Brugeren indsætter celler fra Excel. Excel kopierer som tabulator-separeret tekst; semikolon og komma accepteres også.
- Valg: importér **brugsgenstande** eller **lokaler**.
- Første linje bruges som overskrifter, hvis den genkendes. Ellers vælger brugeren kolonnerne selv med en dropdown pr. kolonne.
- Kendte overskrifter, uden hensyn til store/små bogstaver og æøå:
  - Brugsgenstande: navn/brugsgenstand, lokale, gruppe (nr. eller navn), effekt/W/kW/A, kabel/kabeltype, ledere, tværsnit/mm², længde/m, placering, højde.
  - Lokaler: navn, etage.
- Tal med komma læses som decimaltal, fx "2,5". kW og A omregnes til W som i formularen (`belFra` og `belSync`).
- **Forhåndsvisning** før noget oprettes: en tabel med det, der vil blive oprettet, og røde markeringer for fejl. Fejl er fx ukendt kabeltype, ukendt gruppe og manglende navn.
  - Ukendte lokaler kan oprettes automatisk (afkrydsning).
  - Ukendt kabeltype afvises. Kabeltyperne er faste (`CLAUDE.md` afsnit 4).
- "Importér N rækker" opretter alt i én `mutate`, så det kan fortrydes. Herefter vises en besked: "N brugsgenstande oprettet".
- Felter, der ikke er udfyldt, får de samme standardværdier som en ny brugsgenstand i `openForm`.

Fjern 16 fra `docs/forslag.md`.

## Test (`tests/smoke.py`)

- Tabulator-tekst med overskrifter giver de rigtige felter, også med kW, komma-decimaler og et nyt lokale.
- En række med ukendt kabeltype markeres og oprettes ikke.
- Import kan fortrydes.
- Import af lokaler virker.

Røgtesten skal give `OK`. Kontrollér visuelt ved 1300 og 390 px.
