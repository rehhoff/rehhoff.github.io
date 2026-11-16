# Plan: Installationsmetoder, korrektionsfaktorer og egen I<sub>z</sub>-tabel for XLPE

Planlagt af Claude Opus, 2026-11-16. Forslag 1 i `docs/forslag.md`.

**Udfører: Claude Fable.** Opgaven ændrer beregningsmotoren og datamodellen. Tabelværdierne fra DS/HD 60364-5-52 skal være helt rigtige, og ΔU-, I<sub>z</sub>- og kabelforslag afhænger af dem. Fable må ændre planen (noter det nederst).

## Mål

I dag regner appen I<sub>z</sub> for PVC-isoleret kobber, installationsmetode C, 30 °C, uden korrektionsfaktorer, og XLPE bruger samme tabel. Efter ændringen:

- Installationsmetode (mindst A1, A2, B1, B2, C, D1, E og F, efter normens tabeller), omgivelsestemperatur og antal samlet fremførte kredse kan vælges.
- I<sub>z</sub> = I<sub>z,tabel</sub>(isolation, metode, antal belastede ledere, tværsnit) × k<sub>temp</sub> × k<sub>samlet</sub>.
- Egen tabel for XLPE/EPR (90 °C) ved siden af PVC (70 °C).
- Standardværdierne (C, 30 °C, 1 kreds) giver nøjagtigt samme resultat som i dag, så eksisterende projekter ikke ændrer sig, før brugeren vælger noget andet.

## Kilder

DS/HD 60364-5-52 (IEC 60364-5-52), anneks B: tabellerne B.52.2–B.52.5 (strømværdier for kobber, PVC og XLPE, 2 og 3 belastede ledere), B.52.14 (temperatur i luft) og B.52.17 (samlet fremføring). Den nuværende `IZ`-tabel svarer til PVC, metode C, i B.52.2 og B.52.4. Alle værdier skal tjekkes mod normen. Er en værdi usikker, så skriv det i planen og spørg Alexander i stedet for at gætte.

## Afklaring med Alexander før implementeringen

1. Hvilken isolationstabel bruger hver kabeltype? Forslag: PVC, PKAJ og PKL → PVC (70 °C). XLPE og Brandkabel → XLPE (90 °C). De faste kabeltyper i `CLAUDE.md` ændres ikke.
2. Hvor sættes metode, temperatur og samlet fremføring? Forslag: på gruppen (gælder alle brugsgenstande og dåser i gruppen) og på tavlens tilgangskabel, med projektets standard i Beregning-fanen.

## Datamodel (SCHEMA 9 → 10)

| Liste | Nye felter | Standard |
|---|---|---|
| `projekt` | `metode`, `temp`, `samlet` | `'C'`, `30`, `1` |
| `grupper` | `metode`, `temp`, `samlet` (tom = projektets standard) | `''` |
| `tavler` | `tMetode`, `tTemp`, `tSamlet` for tilgangskablet (tom = projektets standard) | `''` |

`norm()` lægger standardværdierne på. Hæv `SCHEMA` til 10, så der tages en automatisk backup før migreringen. Kun denne opgave må ændre datamodellen, mens den kører.

## Berørte filer og funktioner

| Fil | Ændring |
|---|---|
| `js/data.js` | Tabeller: `IZ_PVC` og `IZ_XLPE` pr. metode og antal belastede ledere, `K_TEMP`, `K_SAMLET`, `METODER` med korte beskrivelser. `norm()` og `SCHEMA = 10`. Behold `IZ` som alias, eller fjern alle brug af det |
| `js/beregning.js` | Ny `izBeregn(kabel, tv, tre, metode, temp, samlet)`, som `iz`, `izFejl`, `forslag`, `tilgIz` bruger. Ny `korrektion(g)`, der returnerer faktorerne og en forklarende tekst til brugerfladen |
| `js/app.js` | `daaseIz` bruger `IZ` direkte og skal kalde den nye funktion. Rør ellers ikke filen, da Opus arbejder i den samtidig |
| `index.html` | Felter i gruppeformularen, tilgangskabel og Beregning-fanen. Vis faktorerne og den samlede I<sub>z</sub> ved kabelkontrollen |
| `docs/ARKITEKTUR.md`, `CLAUDE.md` (afsnit 4, forudsætningerne), `CHANGELOG.md` | Opdateres |

## Samtidigt arbejde

Opus laver imens forslag A (beskeder i bunden) i `js/app.js`, `js/lagring.js` og toast-markup i `index.html`. Denne opgave må ikke ændre de dele. Hold ændringerne i `index.html` til formularerne og Beregning-fanen.

## Test

- Tilføj tjek i `tests/smoke.py` med kendte værdier fra normen, fx PVC, metode C, 2 belastede, 2,5 mm² = 27 A, og nogle værdier for XLPE og andre metoder.
- Temperatur og samlet fremføring: kendt faktor gange tabelværdi, fx 40 °C for PVC og 3 kredse samlet.
- Regression: eksempelprojekterne giver samme I<sub>z</sub>, ΔU og samme advarsler før og efter, når standardværdierne bruges.
- Opgradering: data med skema 9 åbnes i den nye version. Projekterne er intakte, der er taget en backup, og felterne har standardværdier.
- Røgtesten skal give `OK`.

## Udgivelse

Minor-version (ny funktion). Versionen sættes ved merge ud fra den aktuelle `main`, efter reglerne i `CLAUDE.md` afsnit 2 og 3.
