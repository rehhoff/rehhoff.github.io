# Plan: Gendan fra Gist-historik (forslag 8)

Planlagt og udført af Claude Opus, 2026-11-16. Udfører: Opus, fordi den bygger direkte på synkroniseringen, som Opus har lavet.

## Mål

GitHub gemmer hver version af Gist'en. Brugeren skal kunne se et projekt, som det så ud på en tidligere dato, og gendanne det som en kopi. Intet overskrives.

## Sådan virker det

- `GET /gists/{id}/commits` giver listen over versioner (`version`, `committed_at`, `change_status`). Højst 100 pr. side.
- `GET /gists/{id}/{sha}` giver Gist'en, som den så ud i den version.
- For det aktive projekt vises de versioner, hvor projektets fil (`tavleoversigt-<id>.json`) er ændret, med dato og nøgletal (grupper, brugsgenstande). Versioner, hvor projektets indhold er det samme som den foregående, springes over.
- "Gendan som kopi" opretter et nyt projekt med navnet "<navn> (fra <dato>)". Det synkroniseres som et nyt projekt.
- Versioner gemt med et nyere `SCHEMA` end appens kan ikke gendannes (samme regel som synkroniseringen).

## Ændringer

| Fil | Ændring |
|---|---|
| `js/historik.js` (ny) | `APP_HISTORIK`: `historikHent()`, `historikVis(sha)`, `historikGendan(sha)`. Samles i `app()` med `bland()` |
| `js/app.js` | Kun tilføjelsen af `APP_HISTORIK()` i `bland()` og tilstanden `historik` |
| `index.html` | Script-tag for `js/historik.js?v=` og en knap "Tidligere versioner" i synkroniseringspanelet, der åbner en dialog med listen |
| `sw.js` | `js/historik.js` i `SKAL` |

Rør ikke `js/lagring.js` (`docHtml` laves samtidig af en anden session) eller `js/beregning.js`.

## Test

Den falske GitHub-API i `tests/smoke.py` udvides med `/gists/g1/commits` og `/gists/g1/<sha>`, så hver PATCH gemmer en version. Tjek: listen viser kun versioner, hvor projektet er ændret, en gendannet kopi har det gamle indhold og et nyt id, det aktive projekt er urørt, og en version med nyere skema afvises.
