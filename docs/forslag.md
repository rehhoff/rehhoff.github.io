# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

Forslag til og med 9 og A er lavet (10.1.0–10.10.0).

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| 10 | **Afleveringstjek**: et panel, der lister det, der mangler før aflevering: grupper uden kabel eller længde, manglende eller fejlede målinger, brugsgenstande uden gruppe, tavler uden tilgangskabel. Klik på en linje går til stedet | Sonnet | Bruger kun eksisterende data. Fanger fejl, før dokumentationen sendes |
| 11 | **Tavlefortegnelse til tavlelågen**: en A4-side med gruppenummer, sikring, HPFI og hvilke lokaler/brugsgenstande gruppen forsyner. Udskrives med samme print som dokumentationen | Sonnet | Kræves i praksis på hver tavle og skrives i dag i hånden |
| 12 | **Kortslutningsstrøm**: beregnet I<sub>k,min</sub> i gruppens yderste punkt ud fra netimpedans (Z<sub>e</sub> eller målt Z<sub>s</sub> ved tavlen) plus kablernes modstand. Tjek af udkoblingstid og sikringens brydeevne | Fable | Faglig beregning. Kræver aftale om forudsætninger (Z<sub>e</sub>, temperatur på lederne, c-faktor), før der kodes |
| 13 | **Forslag til fasefordeling**: knap, der foreslår L1/L2/L3 for 1-fasede grupper, så fasebalancen bliver bedst. Brugeren godkender før noget ændres | Opus | Fasebalancen findes allerede; dette sparer manuel omflytning |
| 14 | **Selektivitet mellem HPFI'er og sikringer**: advarsel, når en forsikring ikke er større end de efterfølgende, eller to HPFI'er af samme type og IΔn sidder i serie | Fable | Faglige regler skal aftales først |
| 15 | **Billeder**: foto pr. tavle, lokale eller samledåse (fx placering af en skjult dåse), med i dokumentationen | Opus | Kræver ændring af datamodellen (`SCHEMA`). Billeder fylder: localStorage har ca. 5 MB, og Gist-filer over 1 MB kan ikke hentes direkte. Skal planlægges med komprimering og evt. eget lager |
| 16 | **Import fra regneark**: indsæt brugsgenstande eller lokaler fra udklipsholderen (kolonner fra Excel), med forhåndsvisning før de lægges ind | Sonnet | Hurtigere start på store sager |
| 17 | **Mere robust røgtest**: tidsgrænse på hvert tjek og på hele kørslen, så en test, der hænger (set én gang ved print-testen), fejler med en besked i stedet for at vente | Opus | Teknisk; ingen ændring i appen |

Anbefalet rækkefølge: 17, 10, 11, 13. 12 og 14 kræver først aftale om de faglige regler. 15 kræver en beslutning om lagerplads.
