# Opbygning og datamodel

## Filer

| Fil | Indhold |
|---|---|
| `index.html` | Hele appen: CSS, markup og script |
| `CLAUDE.md` | Regler og hukommelse for Claude |
| `CHANGELOG.md` | Versionshistorik |
| `tests/smoke.py` | Røgtest i headless Chrome |
| `docs/planer/` | Planer før implementering |
| `docs/forslag.md` | Forslag, prioritering og hvem der udfører dem |
| `.nojekyll` | GitHub Pages serverer filerne uændret |

## Opbygning af `index.html`

1. `<style>` med farvetokens i `:root` og mørkt tema under `prefers-color-scheme` og `[data-theme="dark"]`.
2. Markup med Alpine-direktiver. Hver fane er en `<section x-show="view==='…'">`, markeret med en `<!-- ===== NAVN ===== -->`-kommentar.
3. `<script>` med konstanter, `norm()`, eksempeldata (`seed`, `seedEl`, `seed2`) og `app()`, som returnerer hele tilstanden og alle funktioner. Funktionerne er grupperet under kommentarer som `/* beregning */` og `/* enstregsdiagram */`.

Faner i `views`: Tavle, Enstregsdiagram, Tændingsdiagram, Samlepunkter & dåser, Svagstrøm, Beregning, Lokaler, Kabler, Dokumentation, Fejlfinder. Tasterne 1 til 9 og 0 skifter fane.

## Lagring

| Nøgle | Indhold |
|---|---|
| `tavleoversigt.projekter` | `{ aktiv, liste:[meta], schema, app, sidstBackup }` |
| `tavleoversigt.p.<id>` | Ét projekt som JSON |
| `tavleoversigt.backups` | Op til tre automatiske backups `{ tid, grund, app, schema, idx, raw:{id:json} }` |
| `tavleoversigt.tema` | `auto`, `light` eller `dark` |
| `tavleoversigt.sync` | Synkronisering: `{ token, gistId, login, base:{ id: hash }, sidst }`. Findes kun, når synkronisering er slået til |
| `tavleoversigt.v1`, `.v2` | Gamle formater, migreres ved første start |

`norm()` lægger standardværdier på og migrerer gamle felter, hver gang et projekt læses. Synkroniseringens Gist indeholder markøren `tavleoversigt.json` og én fil `tavleoversigt-<id>.json` pr. projekt. Markørens `schema` er det højeste skema, der har skrevet til Gist'en. En app med lavere `SCHEMA` afbryder synkroniseringen uden at læse eller skrive. `base` er hver projekts hash ved seneste synkronisering og bruges til tre-vejs fletning (se `docs/planer/2026-11-15-gist-synk.md`). Backupfilen har formatet `{ format:'tavleoversigt-backup', app, schema, eksporteret, aktiv, projekter:[{ id, data }] }`.

## Datamodel for et projekt

| Liste | Felter |
|---|---|
| `projekt` | `navn, sagsnr, kunde, adresse, installatoer, dato, anlaeg, sidst{kabel, ledere, tv}` |
| `tavler` | `id, navn, placering, forsikring, hovedafbryder, fra, fraGruppe, tilgang, tKabel, tLedere, tTv, tLaengde` |
| `rcds` | `id, tavleId, navn, type, In, idn` |
| `lokaler` | `id, navn, etage` |
| `grupper` | `id, tavleId, nr, navn, type (lys, kraft, stik, data), kar, In, faser, fase, rcdId, sf, maal{riso, zs, rcd, ok}` |
| `enheder` | `id, gruppeId, lokaleId, daaseId, navn, effekt (W), kabel, ledere, tv, laengde, symbol` |
| `daaser` | `id, navn, type, gruppeId, parentId, lokaleId, kabel, ledere, tv, laengde` |
| `afbrydere` | `id, navn, art (enpolet, krone, korr, kip, trappe, sensor), gruppeId, lokaleId, steder, tid, a[], b[]` |
| `racks` | `id, navn, type, he, lokaleId, gruppeId` |
| `udstyr` | `id, rackId, navn, art, he, pos, porte, poe, poeBudget, effekt` |
| `links` | `id, art (data, cctv), navn, lokaleId, kabel, laengde, panelId, panelPort, switchId, switchPort, patch, poeW, kamType, oploesning, nvrId` |

Relationer: gruppe → tavle, gruppe → HPFI, brugsgenstand → gruppe, lokale og evt. samledåse, samledåse → gruppe og evt. overordnet dåse, undertavle → tavle og evt. gruppe (`fraGruppe`), link → patchpanel, switch og NVR.

## Centrale funktioner

| Område | Funktioner |
|---|---|
| Lagring | `save`, `skriv`, `laes`, `skrivIdx`, `lavBackup`, `gendanBackup`, `backupJson`, `importBackup` |
| Synkronisering | `synkForbind`, `synkNu`, `synkKoer` (fletning), `synkHent`, `synkSletLokalt`, `synkSenere`, `synkAfbryd`, `gh`, `hashD` |
| Strøm og last | `strom`, `instI`, `egenI`, `gruppeI`, `gruppeFaser`, `subFaser`, `faseInfo`, `autoBalance` |
| Kabler | `du`, `duLokal`, `duOp`, `tavleDu`, `tilgDu`, `iz`, `izFejl`, `forslag`, `lmax` |
| Kontrol | `gruppeFejl`, `warnings`, `mangler`, `linkFejl` |
| Forslag | `effektForslag`, `sfForslag`, `daaseParse`, `symbolFor` |
| Diagrammer | `sld` (enstreg), `taendSvg` (tænding), `spor`, `sporTil` |
| Dokumentation | `docHtml`, `gruppeTsv`, `exportJson`, `hent` |

## Test

`tests/smoke.py` åbner appen i headless Chrome med Alpine fra `node_modules`, skifter alle faner, åbner alle formularer, kører beregninger og eksport tjekker en opgradering med bevarede data og synkroniserer mellem to browserkontekster mod en falsk GitHub-API. Tailwind-CDN'et blokeres i testen, så layoutet ikke testes. Kør `npm install` og derefter `python3 tests/smoke.py`.
