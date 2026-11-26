# Højtalerkabel fra forstærker

Planlagt og udført af Claude Opus 5.5 2026-11-26 (Opus må ændre koden direkte). Status: færdig (10.31.0). Ændrer datamodellen (skema 20).

## Ønske

Alexander vil kunne vælge højtalerkabel, når en højtaler oprettes som brugsgenstand. Kablet forsynes fra en forstærker og må ikke ligne 230 V eller PDS, heller ikke i enstregsdiagrammet.

## Aftalt 2026-11-26

- Forstærkeren er en almindelig 230 V-brugsgenstand på en gruppe. Højtalerne sløjfes fra den (`fraEnhed`).
- Højtalerkablet tælles i materialelisten som egen linje. Ingen ΔU, Iz, Ik eller last.
- Tværsnit 2 × 0,75, 1,5, 2,5 og 4 mm².

## Løsning

- `js/data.js`: `HOEJT = 'Højtalerkabel'` og `HTV`. Ikke i `KABLER`, så 230 V-valgene (tavle, dåse, afbryder, import) er uændrede. `norm()` beholder `HOEJT` på brugsgenstande med `ledere` `2X` og `tv` fra `HTV`. `SCHEMA` 19 → 20, fordi ældre `kabMap` ville gøre kablet til PVC.
- `js/beregning.js`: `erHoejt(e)`. `strom` 0 og `iz` 0, og `duOver`, `lmax`, `forslag`, `maxDu`, `ikMin` og `tavleW` springer højtalere over.
- `js/app.js`: symbol `hoejt`, `hoejtKabel` og `htvs` i tilstanden, gem retter `ledere`/`tv`. `kabelDim` med to decimaler.
- `js/diagram.js`: højtalersymbol, navnet "højtaler" giver symbolet, og træk og sløjfestreg får klassen `hj` (stiplet, CCTV-grøn), også i udskriftens CSS.
- `index.html`: Højtalerkabel kan kun vælges, når symbolet er Højtaler. Ledere skjules, tværsnit fra `HTV`, og ΔU/Iz-boksen skjules. Strøm og ΔU skjules i Tavle-listen og Kabeltabellen. ⊞/⊟ i Lokaler kun ved mere end 10 linjer.
- `css/app.css`: `.sld .l.hj` og `.sld .t.hjt`.
- `tests/smoke.py`, afsnit 4s: opgradering fra skema 19, formular, beregninger, enstreg, materialeliste og `norm()`.
