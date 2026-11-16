# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

Forslag til og med 9, A, 12, 13, 14 og 18 er lavet (10.1.0–10.12.2).

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| 10 | **Afleveringstjek**: et panel, der lister det, der mangler før aflevering: grupper uden kabel eller længde, manglende eller fejlede målinger, brugsgenstande uden gruppe, tavler uden tilgangskabel. Klik på en linje går til stedet | Sonnet | Bruger kun eksisterende data. Fanger fejl, før dokumentationen sendes |
| 11 | **Tavlefortegnelse til tavlelågen**: en A4-side med gruppenummer, sikring, HPFI og hvilke lokaler/brugsgenstande gruppen forsyner. Udskrives med samme print som dokumentationen | Sonnet | Kræves i praksis på hver tavle og skrives i dag i hånden |
| 15 | **Billeder**: foto pr. tavle, lokale eller samledåse (fx placering af en skjult dåse), med i dokumentationen | Opus | Kræver ændring af datamodellen (`SCHEMA`). Billeder fylder: localStorage har ca. 5 MB, og Gist-filer over 1 MB kan ikke hentes direkte. Skal planlægges med komprimering og evt. eget lager |
| 16 | **Import fra regneark**: indsæt brugsgenstande eller lokaler fra udklipsholderen (kolonner fra Excel), med forhåndsvisning før de lægges ind | Sonnet | Hurtigere start på store sager |
| 17 | **Mere robust røgtest**: tidsgrænse på hvert tjek og på hele kørslen, så en test, der hænger (set én gang ved print-testen), fejler med en besked i stedet for at vente | Opus | Teknisk; ingen ændring i appen |
| 19 | **Vis, når Z<sub>e</sub> er beregnet**: en undertavle uden egen Z<sub>e</sub> viser den beregnede værdi som "Ze ved tavlen" i Beregning og dokumentation. Skriv "(beregnet fra forsynende tavle)" ved tallet | Sonnet | Fundet ved gennemgangen 2026-11-16. Kun tekst |

Anbefalet rækkefølge: 17, 10, 11. 15 kræver en beslutning om lagerplads.
