# Etage på plantegninger

Planlagt og udført af Claude Sonnet 5.5 2026-11-26. Ændrer datamodellen (skema 22 → 23). Status: færdig (10.41.0). Ingen anden session må ændre datamodellen samtidig.

## Ønske

Man skal kunne vælge etage ved indsætning af plantegning.

## Løsning

- Datamodel: `tegninger[].etage` (fritekst, `''` = ingen). `norm()` giver gamle tegninger `''`; intet andet ændres. `SCHEMA` 22 → 23.
- Fanen Plantegning: feltet "Etage for ny tegning" ved upload-knappen. Det gælder alle filer og PDF-sider i samme upload. Feltet foreslår de etager, lokalerne og tegningerne allerede bruger; en ny kan skrives. Lokalevalget er uændret.
- Etagen vises på tegningens knap, i overskriften og i dokumentationen, og kan rettes i sidepanelet.
- Røgtest: opgradering fra skema 22 med en tegning uden etage.

Filer: `js/data.js`, `js/plan.js`, `js/app.js` (tilstand), `index.html`, `tests/smoke.py`, dokumentation.
