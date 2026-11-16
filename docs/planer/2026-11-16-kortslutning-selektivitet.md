# Kortslutningsstrøm og selektivitet (forslag 12 og 14)

## Mål

- Beregn I<sub>k,min</sub> i hver gruppes yderste punkt, og kontrollér udkobling mod I<sub>a</sub>.
- Advar, når I<sub>k,maks</sub> ved tavlen er større end automatsikringens brydeevne.
- Advar om manglende selektivitet mellem sikringer og mellem HPFI'er i serie.
- Alt er vejledende og vises i Beregning, i advarslerne og i dokumentationen.

## Udføres af

Claude Fable. Opgaven ændrer datamodellen og lægger nye faglige regler ind, og Alexander har bedt om, at Fable laver den i én session.

## Forudsætninger (godkendt af Alexander 2026-11-16)

- I<sub>k,min</sub> = c<sub>min</sub> · U<sub>0</sub> / (Z<sub>e</sub> + R<sub>fase</sub> + R<sub>PE</sub>), c<sub>min</sub> = 0,95, U<sub>0</sub> = 230 V.
- R = ρ · L / A med ρ = 0,0225, ganget med 1,2 for PVC, PKAJ og PKL og 1,28 for XLPE og Brandkabel. PE har samme tværsnit som faselederen.
- Vejen er den samme som for ΔU: tilgangskabel, dåser og afgang. Den brugsgenstand, der giver størst modstand, bestemmer.
- Udkobling er OK, når I<sub>k,min</sub> ≥ I<sub>a</sub> = 5/10/20 × I<sub>n</sub> for B/C/D.
- Brydeevne 6 kA som standard, kan rettes pr. gruppe.
- Selektivitet: forsikring ≥ 1,6 × største efterfølgende sikring. HPFI i serie kræver type S forrest og IΔn ≥ 3 × den bageste.

## Valg i udførelsen

- Z<sub>e</sub> for en undertavle uden egen værdi = den forsynende tavles Z<sub>e</sub> + tilgangskablets sløjfemodstand. Er tilgangskablets længde 0, er Z<sub>e</sub> ukendt, og I<sub>k</sub> vises ikke.
- En gruppe, der forsyner en undertavle, regnes til enden af tilgangskablet.
- I<sub>k,maks</sub> for en undertavle uden egen værdi = den forsynende tavles værdi (på den sikre side).
- Selektivitet for sikringer: tavlens forsikring sammenlignes med tavlens grupper og forsikringen i undertavler, der forsynes direkte fra tavlen. En gruppe, der forsyner en undertavle, sammenlignes med undertavlens grupper. Gruppen sammenlignes ikke med undertavlens felt Forsikring, fordi feltet ofte beskriver den samme sikring.
- HPFI i serie findes allerede i datamodellen: en undertavle forsynet fra en gruppe med HPFI. Der tilføjes kun feltet `selektiv` (type S) på HPFI'en.
- Brydeevne-advarslen samles til én pr. tavle.

## Datamodel (`SCHEMA` 12)

- `tavler`: `ze` (Ω, 0 = ukendt), `ikMaks` (kA, 0 = ukendt).
- `grupper`: `brydeevne` (kA, standard 6).
- `rcds`: `selektiv` (boolesk, standard `false`).

Ingen felter fjernes eller omdøbes.

## Filer

- `js/data.js`: `SCHEMA`, `norm()`.
- `js/beregning.js` (hovedfil): `ia`, `kLeder`, `rSloejfe`, `tavleZe`, `tavleIkMaks`, `enhedR`, `ikMin`, `ikTxt`, `kortslutFejl`, `selektivitet`, `rcdForan`. `zsMax` bruger `ia`. `warnings` og `gruppeFejl` udvides.
- `index.html`: felter i formularerne for tavle, gruppe og HPFI, kolonne og nøgletal i Beregning.
- `js/app.js`: standardværdier i formularerne. `js/lagring.js`: afsnit i `docHtml`.
- `tests/smoke.py`, `CLAUDE.md`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, `docs/forslag.md`.

## Test

- Opgradering fra skema 11: data intakte, backup taget, nye felter med standardværdier.
- Kendte tal: Z<sub>e</sub> 0,3 Ω, 20 m 1,5 mm² PVC giver R = 0,72 Ω og I<sub>k,min</sub> = 214,2 A. B16 er OK (80 A), C25 er ikke (250 A).
- Brydeevne, sikringsselektivitet og HPFI i serie med og uden type S.
- Regressionstesten for eksempelprojekterne ser bort fra de nye advarsler.
