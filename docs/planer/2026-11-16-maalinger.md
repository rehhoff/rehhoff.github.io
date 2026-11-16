# Plan: Automatisk vurdering af målinger (forslag 2)

Planlagt og udført af Claude Opus, 2026-11-16. Udfører: Opus, fordi det er få og velkendte formler uden ændring af datamodellen. Fable må gennemgå grænserne.

## Grænser (aftalt med Alexander 2026-11-16)

| Måling | Grænse | Kilde |
|---|---|---|
| Sløjfeimpedans Z<sub>s</sub> | Z<sub>s</sub> ≤ 2/3 · U<sub>0</sub>/I<sub>a</sub>, U<sub>0</sub> = 230 V, I<sub>a</sub> = 5 × I<sub>n</sub> (B), 10 × I<sub>n</sub> (C), 20 × I<sub>n</sub> (D). Fx B10: 3,07 Ω | DS/HD 60364-4-41 (udkobling ≤ 0,4 s, TN) og DS/HD 60364-6 anneks C (2/3 for opvarmning af lederne) |
| HPFI-udløsetid | ≤ 300 ms ved 1 × IΔn. Kun når gruppen har en HPFI | DS/HD 60364-6 |
| Isolationsmodstand | ≥ 1 MΩ ved 500 V DC | DS/HD 60364-6, tabel 6.1 |

Værdier som "> 999" eller "≥ 500" læses som tallet efter tegnet. Komma og punktum accepteres.

## Ændringer

| Fil | Ændring |
|---|---|
| `js/beregning.js` | `maalTal(s)`, `zsMax(g)`, `maalVurdering(g)` med `{ riso, zs, rcd }` (true, false eller null, når der ikke er målt) og `status` (`ok`, `fejl`, `mangler`). Målinger over grænsen kommer med i `warnings()` |
| `index.html` | Måleskemaet: felter over grænsen markeres med rødt, Z<sub>s</sub>-grænsen vises pr. gruppe, og en ny kolonne Vurdering |
| `js/lagring.js` | Dokumentationen får kolonnen Vurdering og Z<sub>s</sub>-grænsen |
| `CLAUDE.md` afsnit 4 | Grænserne under forudsætninger |

Ingen ændring af data eller `SCHEMA`.

## Test

Tjek i `tests/smoke.py`: B10 giver 3,07 Ω, C16 giver 0,96 Ω, en værdi lige under og lige over grænsen, "> 999" for isolationsmodstand, HPFI-tid uden HPFI ignoreres, og en fejlmåling giver en advarsel.
