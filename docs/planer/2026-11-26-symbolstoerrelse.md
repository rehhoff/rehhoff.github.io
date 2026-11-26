# Symbolstørrelse på plantegninger

Planlagt og udført af Claude Sonnet 5.5 2026-11-26. Ændrer datamodellen (skema 23 → 24). Status: færdig (10.43.0). Ingen anden session må ændre datamodellen samtidig.

## Ønske

"Symboler der repræsenterer komponenter er alt for store. De skal skaleres efter målestok." Valgt løsning: 30 cm i virkeligheden, med −/+ pr. tegning.

## Løsning

- Datamodel: `tegninger[].symbol` (faktor, 1 = standard, 0,2–10). `norm()` giver gamle tegninger 1; intet andet ændres. `SCHEMA` 23 → 24.
- Med målestok: prikkens diameter er 30 cm × faktoren. Uden målestok: halvdelen af den hidtidige størrelse × faktoren. Nummer, kant og markering skaleres med.
- Sidepanelet: −/+ (trin 1,25) med visning i cm, uden målestok i procent.
- Trykflade: rammes ingen prik, vælges den nærmeste inden for 22 skærmpixel.
- Røgtest: opgradering fra skema 22 og 23.

Filer: `js/data.js`, `js/plan.js`, `index.html`, `tests/smoke.py`, dokumentation.
