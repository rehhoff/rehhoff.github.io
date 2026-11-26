# Samlepunkt sløjfet fra en brugsgenstand

Planlagt og udført af Claude Opus 5.5 2026-11-26 (Opus må ændre koden direkte; opgaven rører datamodellen og flere beregninger, så den holdes i én session). Ændrer datamodellen (skema 21 → 22). Status: færdig (10.38.0). Ingen anden session må ændre datamodellen samtidig.

## Ønske

Alexander har to membrandåser i et lokale og to "Køkken tilgang". Tilgangskablerne er trukket ind i dåserne, og i enstregsdiagrammet skal "Køkken tilgang" stå før dåsen. En Tilgang er et kabel, ikke en brugsgenstand. Derfor skal et samlepunkt kunne sløjfes fra en brugsgenstand, på samme måde som en brugsgenstand kan.

## Løsning

Datamodel (`js/data.js`):

- `daaser[].fraEnhed` (skema 22): id på den brugsgenstand, dåsens tilgangskabel er trukket fra. `''` = som før (fra `parentId` eller tavlen). Er `fraEnhed` sat, er `parentId` `''`.
- `norm()`: standard `''`, ukendt id fjernes. Ny fælles funktion `forsyning(o)` fjerner ukendte henvisninger og bryder kredse i hele forsyningstræet (dåse → dåse/brugsgenstand, brugsgenstand → brugsgenstand/dåse). Den erstatter den gamle kredsbrydning for sløjfer og bruges også af `syncDaaser()`.
- `SCHEMA` 21 → 22. Gammelt format (uden feltet) giver `fraEnhed: ''`, så alt regnes og tegnes som før.

Forsyningsvej (`js/app.js`):

- `op(x)`: posten lige før x (brugsgenstand eller dåse). `opVej(x)`: alle poster før x op til gruppen. `vejDaase(did)`: dåsen og dens vej. `kanForsyne(p, id)`: p må forsyne posten id (ingen kreds).
- `syncDaaser()`: gruppen arves fra toppen af vejen; en sløjfet brugsgenstand arver stadig `daaseId` fra roden af sin sløjfe.
- `nedstroem(did)` og `enhedFaser(e)` tæller også dåser, der er sløjfet fra brugsgenstanden, og alt efter dem.
- `erUnder` og `erSloejfetUnder` erstattes af `kanForsyne`.

Beregninger (`js/beregning.js`):

- `duOp`, `enhedR` (I<sub>k</sub>) og føringsvejens længder går gennem `vejDaase`, så ΔU og R summeres gennem dåsens tilgangskabel, brugsgenstandens træk og videre op. Strømmen i brugsgenstandens træk omfatter dåsens last pr. fase (fasestrømme uændrede, da hver brugsgenstand stadig tælles én gang i gruppen).

Brugerflade:

- `index.html`, samlepunktets formular: "Forsynes fra" viser tavlen, samlepunkter og brugsgenstande (ikke højtalere). Gruppe låses, når dåsen forsynes fra noget. Brugsgenstandens formular og "Flyt" i enstreg afviser kredse via `kanForsyne`.
- `js/diagram.js`: en dåse sløjfet fra en brugsgenstand tegnes efter den. Efter en Tilgang udgår den fra skinnen efter Tilgang-symbolet, efter en almindelig brugsgenstand fra en sløjfeprik. Sporing og dybde går gennem `vejDaase`.
- Føringsvej: dåsen vises under brugsgenstanden ("fra Køkken tilgang"). "+ Dåse" findes ikke på en brugsgenstand i dag og tilføjes ikke.
- Tekster "Forsynes fra" (Samlepunkter, enstreg-info, kabeltabel, dokumentation) via `daaseFraTxt(d)`.

Kopiér gren, klon lokale og sletning:

- Kopiér gren tager dåser sløjfet fra grenens brugsgenstande med (og alt efter dem) og omskriver `fraEnhed`.
- Klon lokale omskriver dåsens `fraEnhed` som brugsgenstandens.
- Slettes en brugsgenstand, forsynes dåser fra den fra det, den selv var forsynet fra (brugsgenstand eller dåse).

## Test

`tests/smoke.py`, nyt afsnit: opgradering fra skema 21 (backup, data intakte, `fraEnhed: ''` på dåser), dåse sløjfet fra en Tilgang (gruppe arvet, ΔU = dåsens træk + Tilgangens træk med dåsens strøm, I<sub>k</sub>-R, strøm i Tilgangen), enstreg (dåsen til højre for Tilgangen og ikke direkte fra gruppen), føringsvej, kreds afvist i `kanForsyne`, `flytTjek` og `norm()`, kopiér gren, klon lokale og sletning.

Dokumentation: `docs/ARKITEKTUR.md` (felt og skema), `CHANGELOG.md`.
