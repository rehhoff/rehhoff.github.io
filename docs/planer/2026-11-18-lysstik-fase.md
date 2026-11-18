# Plan: Gruppetype "Lys og stik" og 1-faset tilslutning på 3-faset gruppe

Planlagt og udført af Claude Opus, 2026-11-18. Udfører: Opus, fordi ændringen rører datamodel og fasebalance i flere filer på én gang. Hæver `SCHEMA` til 14; ingen anden opgave må ændre datamodellen samtidig (Brandlukning, skema 15, starter efter denne).

Samtidig opgave: enstregsdiagram og mobil-zoom (`js/diagram.js`). Denne opgave ændrer kun printfarven pr. type i `js/diagram.js`.

## 1. Gruppetype "Lys og stik" (aftalt med Alexander 2026-11-18)

- Ny nøgle `lysstik` i `typeLabel` (`js/app.js`), label "Lys og stik".
- ΔU-grænse 3 % som lys (`duGraense`).
- `SF`: `lysstik` = lys-værdien for hver installationstype (`js/data.js`). `sfForslag` og `sfListe` følger automatisk.
- Farvetoken `--lysstik` i `:root`, mørkt tema (begge blokke) og `.typed.lysstik` i `css/app.css`. Printfarve i enstregsdiagrammet (`js/diagram.js`, kun CSS-strengen).
- Afbrydere: forvalgt gruppe er lys eller lys og stik.
- Filtre, vælgere, chips, skabeloner, dokumentation og materialeliste bruger `typeLabel` og `g.type` og virker uden særlig kode.

## 2. Fase på brugsgenstand (`enheder.fase`)

Datamodel (SCHEMA 14): `enheder.fase` = `''` (som gruppen) eller `'L1'`/`'L2'`/`'L3'` (230 V mellem fasen og nul). `norm()` sætter `''`, når feltet mangler eller er ugyldigt. Feltet gemmes også på en 1-faset gruppe, men bruges kun på en 3-faset (så intet går tabt ved flytning).

Beregning (`js/beregning.js`, `js/app.js`):

- `fase1(e)`: fasen, hvis gruppen er 3-faset og fasen er valgt, ellers `''`. `tre(e)` er falsk for en 1-faset tilslutning, så `strom` = P/230, I<sub>z</sub> regnes med 2 belastede ledere, og `lmax`/belastning i A følger 230 V.
- `faseV(x)`: brugsgenstandens strøm pr. fase. 3-faset: samme strøm på L1–L3. 1-faset tilslutning: kun på den valgte fase. 1-faset gruppe: på gruppens fase.
- Et træk (eget kabel, sløjfe, dåse) får strømvektoren for alt nedstrøms: `enhedFaser`, `daaseFaser`. `enhedI`/`daaseI` = største fasestrøm.
- ΔU i et træk (`duV`): kun én fase belastet → 1-faset, 2·L·I·ρ/A/230. Ellers største af ΔU<sub>p</sub> = ρ·L/A · (2·I<sub>p</sub> − ½·(I<sub>q</sub> + I<sub>r</sub>)) / (400/√3). Ved symmetrisk last giver det præcis den gamle 3-fasede formel, så eksisterende tal er uændrede. Antagelse: cos φ = 1, nul med samme tværsnit som faselederen.
- Gruppens fasestrømme (`gruppeFaser` via `egenFaser`) = samtidighedsfaktor × summen af `faseV` + rack. Dermed følger `subFaser`, `faseInfo`, `fasePlan`, tilgangskabel og advarsler.
- Tilgangskablets ΔU (`tilgDu`) er uændret (største fasestrøm, symmetrisk formel).

Brugerflade:

- Formular for brugsgenstand: vælger "Tilslutning" (Som gruppen / L1 / L2 / L3, 230 V), kun når gruppen er 3-faset. Belastning vises i A ved 230 V.
- "L2, 230 V" i gruppens liste, kabeltabellen, Beregning (fasestrømme for 3-fasede grupper med 1-fasede tilslutninger) og dokumentationen.

## Test (`tests/smoke.py`)

- Opgradering fra skema 13: data uden `fase` → `fase:''`, alle andre felter intakte.
- Kendte tal: 3-faset gruppe, 2300 W på L2 (10 A), 10 m 2,5 mm²: ΔU = 2·10·10·0,0225/2,5/230·100 = 0,7826 %. Fasestrømme med en 3-faset last på 6928 W (10 A) og sf 1: L1 10, L2 20, L3 10 A.
- Lys og stik: ΔU-grænse 3 %, SF = lys-værdien.

## Dokumentation

`CLAUDE.md` afsnit 4 (begge regler), `docs/ARKITEKTUR.md`, `CHANGELOG.md`, version (minor).
