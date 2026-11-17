# Plan: Føringsvej og trukne kabler

Planlagt og udført af Claude Opus, 2026-11-17. Udfører: Opus, fordi datamodel, beregninger og brugerflade hænger tæt sammen (Fable er ikke længere tilgængelig). Hæver `SCHEMA` til 13; ingen anden opgave må ændre datamodellen samtidig.

## Mål

1. Et overskueligt træ pr. lokale, der viser hvert kabeltræk fra tavlen gennem samlepunkter og sløjfer til brugsgenstande og afbrydere, med kabeltype, ledere, tværsnit og længde.
2. Hurtig indtastning af gentagne træk (fx tre vægge med samme opbygning).
3. Afkrydsning pr. træk: trukket eller ej, og en note (fx "venter på tømrer").

## Afklaret med Alexander 2026-11-17

- Et vægudtag er en brugsgenstand med last.
- Ikke-trukne kabler tæller med i beregninger og materialeliste. Materialelisten viser "heraf ikke trukket".
- Afbryderens træk fra dåse eller udtag kommer i kabelliste, materialeliste og føringsvej, men ikke i ΔU.

## Datamodel (SCHEMA 13)

Hver post har ét indgående træk (sit eget kabel). Nye felter, alle med tomme standardværdier i `norm()`:

| Liste | Nye felter |
|---|---|
| `enheder` | `fraEnhed` (brugsgenstand, den er sløjfet fra), `hoejde` (cm), `placering` (fx "Væg A"), `trukket`, `note` |
| `daaser` | `hoejde`, `placering`, `trukket`, `note` |
| `afbrydere` | `daaseId`, `fraEnhed`, `kabel`, `ledere`, `tv`, `laengde` (afbryderens træk, 0 = intet), `hoejde`, `placering`, `trukket`, `note` |
| `tavler` | `tTrukket`, `tNote` (tilgangskablet) |

En sløjfet brugsgenstand arver gruppe og samlepunkt (`daaseId`) fra den, den er sløjfet fra, så summen af strøm gennem dåser er uændret. Ingen felter fjernes.

## Beregninger

- `enhedI(e)`: strøm i e's eget træk = e + alt sløjfet efter den.
- ΔU: e's eget træk med `enhedI(e)`, plus trækkene i de udtag, den er sløjfet fra, plus dåserne. Uden sløjfer er resultatet det samme som før.
- `lmax`, `enhedR` (I<sub>k,min</sub>) følger samme vej.
- Afbrydertræk: kun kabelliste, materialeliste og føringsvej.

## Brugerflade

- Ny fane **Føringsvej**: træ pr. tavle og gruppe. Hver linje: afkrydsning (trukket), navn, placering og højde, kabel og længde, note. Lokalefilteret viser poster i lokalet og vejen dertil (nedtonet).
- Knapper pr. linje: **+ Sløjfe** (ny brugsgenstand med samme kabel, lokale og placering), **+ Afbryder**, **+ Dåse** (under dåser), **Kopiér gren** (antal og ny placering), **Rediger**.
- Filter **Kun ikke trukket**, og optælling af trukne/ikke trukne meter.
- Formularerne for brugsgenstand, samlepunkt og afbryder får felterne Sløjfet fra, Placering, Højde, Trukket og Note; afbryderen får sit træk.

## Test

Opgradering fra skema 12 er intakt; ΔU uden sløjfer er uændret; ΔU og I<sub>k</sub> med kendte tal for en sløjfe; kopiér gren giver nye id'er og samme kabler; afkrydsning og note gemmes; materialelisten viser ikke trukket; afbrydertræk i kabellisten, ikke i ΔU.
