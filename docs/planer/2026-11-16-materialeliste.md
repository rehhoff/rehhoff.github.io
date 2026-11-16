# Plan: Materialeliste (forslag 3)

Planlagt af Claude Opus, 2026-11-16. **Udfører: Claude Sonnet**, fordi opgaven kun lægger eksisterende data sammen og ikke ændrer beregninger eller datamodel. Fable må ændre planen.

## Mål

Et nyt panel "Materialeliste" øverst i fanen Kabler, som samler projektet til en bestillingsliste, der kan kopieres til et regneark.

## Indhold

| Gruppe | Linjer | Kilde |
|---|---|---|
| Kabler | Pr. kabeltype + ledere + tværsnit (fx "PVC 3G1,5 mm²"): samlet længde i meter, afrundet op til hel meter | `db.enheder` og `db.daaser` (`kabel`, `ledere`, `tv`, `laengde`) og tavlernes tilgangskabel (`tKabel`, `tLedere`, `tTv`, `tLaengde`) |
| Datakabler | Pr. type (Cat6, Cat6A, fiber …): samlet længde | `db.links` (`kabel`, `laengde`, `patch`). Står i en særskilt gruppe, fordi datakabler er undtaget fra kabellisten (`CLAUDE.md` afsnit 4) |
| Samlepunkter | Pr. dåsetype: antal | `db.daaser` (`type`) |
| Afbrydere | Pr. art (enpolet, krone, korrespondance, kryds …): antal, og for kryds/korr antal betjeningssteder | `db.afbrydere` (`art`, `steder`) med navnene fra `afbArt` |
| Automatsikringer | Pr. karakteristik og størrelse (fx "B10, 1-polet", "C16, 3-polet"): antal | `db.grupper` (`kar`, `In`, `faser`) |
| HPFI | Pr. type, mærkestrøm og IΔn (fx "Type A 40 A 30 mA"): antal | `db.rcds` |
| Brugsgenstande | Pr. symbol (stikkontakt, lampeudtag …): antal | `db.enheder` og `symbolFor(e)` / `symNavn` |

Tom gruppe vises ikke. Lokalefilteret (`lokF`) gælder ikke her: listen er altid for hele projektet.

## Ændringer

| Fil | Ændring |
|---|---|
| `js/beregning.js` | Ny `materialer()`, som returnerer `[{ gruppe, linjer:[{ tekst, antal, enhed }] }]`, og `materialeTsv()` til udklipsholderen (kolonner: Gruppe, Materiale, Antal, Enhed) |
| `index.html` | Panelet i Kabler-fanen (`<section x-show="view==='kabler'">`), før filterpanelet: tabel pr. gruppe og knappen "Kopiér materialeliste til regneark" (`kopier(materialeTsv())`). Fold sammen/ud med en knap, så kabeltabellen stadig er let at nå |

Ret ikke `js/lagring.js`, `js/historik.js` eller eksporten: to andre sessioner arbejder der samtidig. Materialelisten kan komme med i dokumentationen senere.

## Test

Tilføj tjek i `tests/smoke.py` på eksempelprojektet: summen af kabellængder i `materialer()` er lig nøgletallet "Elkabel i alt" (afrundet), antallet af automatsikringer er lig antal grupper, antallet af HPFI er lig `db.rcds.length`, datakabler står ikke under Kabler, og `materialeTsv()` har én linje pr. materiale plus overskrift. Kør `python tools/byg_css.py`, hvis der bruges nye Tailwind-klasser, og røgtesten skal give `OK`.

## Udgivelse

Minor-version, sat ved merge ud fra den aktuelle `main` (fire steder, se `CLAUDE.md` afsnit 2).
