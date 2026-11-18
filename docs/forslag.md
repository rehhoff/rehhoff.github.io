# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

Forslag til og med 11, 19, A, 12, 13, 14, 17 og 18 er lavet. 17 (tidsgrænser i røgtesten, `SMOKE_TRIN_MS` og `SMOKE_SAMLET_S`) ændrer ikke appen.

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| 15 | **Billeder**: foto pr. tavle, lokale eller samledåse (fx placering af en skjult dåse), med i dokumentationen | Opus | Lageret findes nu (IndexedDB og billed-Gist fra brandlukning, 10.18.0). Kræver felter `billeder[]` på tavler, lokaler og dåser (`SCHEMA`) og visning i formularer og dokumentation |
| 16 | **Import fra regneark**: indsæt brugsgenstande eller lokaler fra udklipsholderen (kolonner fra Excel), med forhåndsvisning før de lægges ind | Sonnet | Hurtigere start på store sager |
| 20 | **Oprydning af billeder**: en knap, der viser billeder på enheden og i billed-Gist'en, som intet projekt eller nogen backup bruger mere, og sletter dem efter bekræftelse. Billeder slettes i dag aldrig automatisk, så lageret vokser | Opus | Data må ikke gå tabt: skal tjekke alle projekter, automatiske backups og andre enheder (via projekt-Gist'en), før noget slettes |
| 21 | **Store mængder billeder**: billed-Gist'en vises kun med 300 filer i API'et, og svaret på hver upload indeholder alle billeder. Ved mange billeder: ny billed-Gist pr. 250 billeder (markøren findes allerede i alle) og advarsel i appen | Opus | Først relevant ved et par hundrede billeder. Ingen risiko for projektdata, da billederne ligger i deres egen Gist |

15 kræver en beslutning om lagerplads.
