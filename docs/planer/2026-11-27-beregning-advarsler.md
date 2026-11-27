# Beregning: Iz med belastede faser, HPFI foran, skjulte advarsler

Fra gennemgangen af hele appen 2026-11-27 (bundt 1). Godkendt af Alexander 2026-11-27: Iz med belastede faser, og at HPFI foran også gælder måleskemaet.

## Mål
- A2: Iz regnes med 3 belastede ledere, når trækket eller dåsen fører strøm i to eller tre faser, ellers 2 (`tre3` i `js/beregning.js`, brugt i `iz` og `daaseIz`).
- A3: en gruppe uden egen HPFI i en undertavle forsynet fra en gruppe med HPFI regnes som beskyttet (`rcdBeskyt`). Bruges i `warningsRaw`, `gruppeFejl`, `maalVurdering` og `kortslutFejl`.
- A4: Iz-advarslen vises også, når ΔU er over.
- A11: korrektionsforklaringen i Beregning bruger gruppens kabeltype.

## Udfører
Opus. Ændrer beregningsresultater og en faglig regel (CLAUDE.md afsnit 4), så det kræver omhu.

## Datamodel
Ingen ændring (skema 25).

## Test
`tests/smoke.py`: Iz 24/27 A for træk, sløjfe og dåser med kendte tal; HPFI foran uden og med HPFI på den forsynende gruppe; ΔU- og Iz-advarsel samtidig.
