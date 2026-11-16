# Plan: Afbrydere i enstregsdiagrammet, krydsafbryder og tændingsdiagrammer i eksporten

Planlagt af Claude Opus, 2026-11-16. Forslag 4 i `docs/forslag.md`.

**Udfører: Claude Fable.** Enstregsdiagrammet (`sld` i `js/diagram.js`) er den sværeste del af koden: layout, sporing, klik og zoom hænger sammen, og Fable har bygget det. Fable må ændre planen (noter det nederst).

## Mål

1. **Krydsafbryder.** Ny afbrydertype `kryds`: lyset betjenes fra tre eller flere steder (to korrespondanceafbrydere i enderne og en eller flere krydsafbrydere imellem). Antal steder 3–6. Tændingsdiagrammet skal kunne simuleres som de andre typer (klik på en afbryder skifter lyset), med princip og ledere i `afbPrincip` og `afbLedere`.
2. **Afbrydere i enstregsdiagrammet.** Afbrydere vises under den gruppe, de hører til, mellem gruppen og de lamper, de styrer. Brug normens symboler (DS/EN 60617) i samme stil som de eksisterende symboler. Klik og sporing skal virke for afbrydere som for brugsgenstande.
3. **Tændingsdiagrammer i eksporten.** `docHtml` (dokumentationen) får et afsnit "Tændingsdiagrammer" med ét diagram pr. afbryder, tegnet med `taendSvg` i statisk form (ingen simulering, lyset slukket), med navn, type, gruppe og lokale. SVG-eksporten af enstregsdiagrammet (`sld(true)`) skal også vise afbryderne.

## Afklaring med Alexander før implementeringen

1. Krydsafbryder: skal den være en ny type `kryds`, eller en udvidelse af `korr` med flere steder? Forslag: ny type, så eksisterende korrespondanceafbrydere ikke ændres.
2. Enstregsdiagrammet: skal alle afbrydere vises, eller kun når man slår det til (fx en knap "Vis afbrydere")? Forslag: altid vist, fordi diagrammet ellers ikke viser, hvordan lyset styres.

## Datamodel

Ingen ny struktur. `art` får værdien `kryds`, og `steder` bruges som antal betjeningssteder. `norm()` skal acceptere `kryds` og sætte `steder` til mindst 3. `SCHEMA` hæves kun, hvis Fable ændrer felter. Gamle data skal virke uændret.

## Berørte filer

| Fil | Ændring |
|---|---|
| `js/diagram.js` | `sld` (afbrydere under gruppen), `taendSvg`, `lit`, `simFor`, `taendKlik`, `afbIkon` (krydsafbryder), `spor`/`sporTil` for afbrydere |
| `js/app.js` | Kun `afbArt`, `afbPrincip`, `afbLedere` og evt. formularens validering for `kryds`. Rør ikke beskeder |
| `js/lagring.js` | Kun `docHtml`: afsnittet med tændingsdiagrammer |
| `js/data.js` | `norm()` for `kryds` |
| `index.html` | Afbryderformularen (type og antal steder) og evt. knap i enstregsdiagrammet |

## Samtidigt arbejde

Ingen anden session kører lige nu. Hvis Opus starter en opgave imens, holder den sig fra `js/diagram.js`.

## Test

- `tests/smoke.py`: opret en krydsafbryder med 3 og 4 steder. Simulér klik på hvert sted, og kontrollér at lyset skifter hver gang.
- `sld(true)` indeholder afbryderne. `docHtml()` indeholder et tændingsdiagram pr. afbryder.
- Eksisterende afbrydere og eksempelprojekterne giver samme tændingsdiagrammer som før (regression).
- Røgtesten skal give `OK`.

## Udgivelse

Minor-version. Versionen sættes ved merge ud fra den aktuelle `main`, efter `CLAUDE.md` afsnit 2 og 3.
