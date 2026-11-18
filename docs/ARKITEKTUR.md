# Opbygning og datamodel

## Filer

| Fil | Indhold |
|---|---|
| `index.html` | Markup med Alpine-direktiver. Hver fane er en `<section x-show="view==='…'">`, markeret med en `<!-- ===== NAVN ===== -->`-kommentar |
| `css/app.css` | Farvetokens i `:root`, mørkt tema under `prefers-color-scheme` og `[data-theme="dark"]`, egne klasser |
| `css/tailwind.css` | Bygget Tailwind-CSS (ret ikke i hånden). Kilde: `tailwind.config.js` og `css/tailwind.input.css` |
| `tools/byg_css.py` | Bygger `css/tailwind.css`. `--tjek` fejler, hvis den ikke er bygget efter seneste ændring |
| `sw.js` | Service worker: gemmer app-skallen (`SKAL`) til brug uden net. Sider hentes net først, filer med `?v=` cache først, GitHub aldrig gemt |
| `manifest.webmanifest`, `ikoner/` | Installérbar app (navn, farver, ikoner) |
| `js/data.js` | Konstanter, `APP_VERSION`, `SCHEMA`, lagernøgler, tabeller, `norm()`, eksempeldata (`seed`, `seed2`), `hashD` |
| `js/beregning.js` | `APP_BEREGNING()`: strøm, ΔU, I<sub>z</sub>, fasebalance, kabeltabel, samtidighed, tilgangskabel, effektforslag |
| `js/diagram.js` | `APP_DIAGRAM()`: enstregsdiagram, sporing, afbrydere og tændingsdiagram |
| `js/lagring.js` | `APP_LAGRING()`: projekter, eksport, import, backup, synkronisering |
| `js/historik.js` | `APP_HISTORIK()`: tidligere versioner af det aktive projekt fra Gist'ens versionshistorik (`/gists/{id}/commits`), gendannes som kopi |
| `js/app.js` | `app()`: tilstand, `init()` og resten af brugerfladen. `bland()` samler metoderne fra de tre filer ovenfor |
| `CLAUDE.md` | Regler og hukommelse for Claude |
| `CHANGELOG.md` | Versionshistorik |
| `tests/smoke.py` | Røgtest i headless Chrome |
| `docs/planer/`, `docs/forslag.md` | Planer og forslag |
| `.nojekyll` | GitHub Pages serverer filerne uændret |

## Indlæsning

Scriptsene er almindelige scripts (ikke ES-moduler) og deler globalt scope. Rækkefølgen er `data.js`, `beregning.js`, `diagram.js`, `lagring.js`, `app.js` og til sidst Alpine (`defer`). `css/app.css` indlæses før `css/tailwind.css`, så Tailwinds klasser vinder som før med CDN'et. `css/` og `js/` hentes med `?v=<APP_VERSION>`, så en ny version aldrig blandes med gamle filer fra cachen. Metodenavne skal være unikke på tværs af filerne.

Under 1024 px står hovedets titel og værktøjer under hinanden, og fanerne er én række, der kan rulles sidelæns (`.faner`, `lg:contents` fra 1024 px). Under 640 px vises måleskemaet som kort (`.mk`) i stedet for tabellen. Desktop-layoutet er uændret.

Faner i `views`: Tavle, Enstregsdiagram, Tændingsdiagram, Samlepunkter & dåser, Svagstrøm, Beregning, Lokaler, Kabler, Dokumentation, Fejlfinder. Tasterne 1 til 9 og 0 skifter fane.

## Lagring

| Nøgle | Indhold |
|---|---|
| `tavleoversigt.projekter` | `{ aktiv, liste:[meta], schema, app, sidstBackup }` |
| `tavleoversigt.p.<id>` | Ét projekt som JSON |
| `tavleoversigt.backups` | Op til tre automatiske backups `{ tid, grund, app, schema, idx, raw:{id:json} }` |
| `tavleoversigt.firma` | Firmaoplysninger til dokumentationen: `{ navn, cvr, adresse, telefon, logo }` (logo som data-URL, højst 400 px bred). Gælder alle projekter og synkroniseres ikke |
| `tavleoversigt.tema` | `auto`, `light` eller `dark` |
| `tavleoversigt.sync` | Synkronisering: `{ token, gistId, login, base:{ id: hash }, sidst }`. Findes kun, når synkronisering er slået til |
| `tavleoversigt.v1`, `.v2` | Gamle formater, migreres ved første start |

`norm()` lægger standardværdier på og migrerer gamle felter, hver gang et projekt læses. Synkroniseringens Gist indeholder markøren `tavleoversigt.json` og én fil `tavleoversigt-<id>.json` pr. projekt. Markørens `schema` er det højeste skema, der har skrevet til Gist'en. En app med lavere `SCHEMA` afbryder synkroniseringen uden at læse eller skrive. `base` er hver projekts hash ved seneste synkronisering og bruges til tre-vejs fletning (se `docs/planer/2026-11-15-gist-synk.md`). Backupfilen har formatet `{ format:'tavleoversigt-backup', app, schema, eksporteret, aktiv, projekter:[{ id, data }] }`.

## Datamodel for et projekt

| Liste | Felter |
|---|---|
| `projekt` | `navn, sagsnr, kunde, adresse, installatoer, dato, anlaeg, sidst{kabel, ledere, tv}, metode, temp, jtemp, samlet, lag` (skema 10, standard `C, 30, 20, 1, bundt`) |
| `tavler` | `id, navn, placering, forsikring, hovedafbryder, fra, fraGruppe, tilgang, tKabel, tLedere, tTv, tLaengde, tMetode, tTemp, tSamlet, tLag` (tom = projektets standard), `ze` (Ω), `ikMaks` (kA) (skema 12, 0 = ukendt), `tTrukket`, `tNote` (skema 13, tilgangskablets status) |
| `rcds` | `id, tavleId, navn, type, In, idn, selektiv` (skema 12: type S) |
| `lokaler` | `id, navn, etage` |
| `grupper` | `id, tavleId, nr, navn, type (lys, lysstik = Lys og stik, kraft, stik, data), kar, In, faser, fase, rcdId, sf, maal{riso, zs, rcd, ok}, metode, temp, samlet, lag` (tom = projektets standard), `brydeevne` (kA, skema 12, standard 6) |
| `enheder` | `id, gruppeId, lokaleId, daaseId, navn, effekt (W), kabel, ledere, tv, laengde, symbol`, `fraEnhed` (sløjfet fra en anden brugsgenstand, arver gruppe og `daaseId`), `hoejde` (cm), `placering`, `trukket`, `note` (skema 13), `fase` (skema 14: `''` = som gruppen, `L1`/`L2`/`L3` = 1-faset tilslutning mellem fasen og nul; bruges kun på en 3-faset gruppe) |
| `daaser` | `id, navn, type, gruppeId, parentId, lokaleId, kabel, ledere, tv, laengde`, `hoejde`, `placering`, `trukket`, `note` (skema 13) |
| `afbrydere` | `id, navn, art (enpolet, krone, korr, kryds, kip, trappe, sensor), gruppeId, lokaleId, steder, tid, a[], b[]`. `kryds` (skema 11): `steder` er antal betjeningssteder, 3 til 6. Skema 13: eget træk `daaseId` eller `fraEnhed`, `kabel, ledere, tv, laengde` (0 = intet træk, indgår ikke i ΔU), `hoejde`, `placering`, `trukket`, `note` |
| `racks` | `id, navn, type, he, lokaleId, gruppeId` |
| `udstyr` | `id, rackId, navn, art, he, pos, porte, poe, poeBudget, effekt` |
| `links` | `id, art (data, cctv), navn, lokaleId, kabel, laengde, panelId, panelPort, switchId, switchPort, patch, poeW, kamType, oploesning, nvrId` |

Relationer: gruppe → tavle, gruppe → HPFI, brugsgenstand → gruppe, lokale og evt. samledåse eller en anden brugsgenstand (sløjfe), afbryder → evt. dåse eller brugsgenstand (træk), samledåse → gruppe og evt. overordnet dåse, undertavle → tavle og evt. gruppe (`fraGruppe`), link → patchpanel, switch og NVR.

## Centrale funktioner

| Område | Funktioner |
|---|---|
| Lagring | `save`, `skriv`, `laes`, `skrivIdx`, `lavBackup`, `gendanBackup`, `backupJson`, `importBackup` |
| Beskeder | `say(txt, undo, fejl)`, `lukToast` (i `js/app.js`) |
| Synkronisering | `synkForbind`, `synkNu`, `synkKoer` (fletning), `synkTxt`, `synkHent`, `synkSletLokalt`, `synkSenere`, `synkAfbryd`, `gh`, `hashD` |
| Strøm og last | `strom`, `fase1`, `faseTxt`, `tre`, `faseV` (strøm pr. fase for én brugsgenstand), `faseSum`, `instI`, `egenI`, `egenFaser`, `harFase1`, `gruppeI`, `gruppeFaser`, `subFaser`, `faseInfo`, `fasePlan`, `faseForesla`, `faseAnvend` (forslag til fasefordeling, tilstand i `faseFs`), `autoBalance` |
| Kabler | `materialer`, `materialeTsv` (materialeliste), `du`, `duLokal`, `duEget`, `duV` (ΔU i et træk ud fra strøm pr. fase), `duOp`, `daaseFaser`, `tavleDu`, `tilgDu`, `iz`, `izFejl`, `forslag`, `lmax`, `daaseIz`, `tilgIz` |
| I<sub>z</sub> | `forhold` (gruppens eller tilgangskablets forhold med projektets standard), `izTabel`, `izBeregn`, `kTemp`, `kSamlet`, `korrektion`, `forholdTxt`. Tabeller i `js/data.js`: `IZT`, `METODER`, `ISO`, `TEMPS`, `K_TEMP`, `KREDSE`, `LAG`, `K_JORD_SAMLET`. `IZ` er et alias for PVC, metode C |
| Føringsvej | `enhed`, `sloejfer`, `enhedNed`, `enhedFaser`, `enhedI` (største fasestrøm i trækket inkl. sløjfer), `enhedRod`, `enhedDaase`, `duSloejfe`, `sloejfeVej`, `foeringTrae`, `fvSaet`, `fvNy`, `fvOptael`, `grenKopier` (kopiér gren), `sloejfeValg`, `afbFraSaet`, `fvSlet`, `fvRedAabn`, `fvRedGem` (ret kabel i oversigten, tilstand i `fvRed`, `fvTmp`). Samtidighedsfaktor-pop-up: `sfListe`, `sfAabn`, `sfVaelg` (tilstand i `sfPop`) |
| Kontrol | `gruppeFejl`, `warnings`, `mangler`, `linkFejl`, `maalVurdering`, `zsMax`, `maalTal` |
| Kortslutning og selektivitet | `ia` (I<sub>a</sub>), `kLeder`, `rSloejfe`, `tavleOp`, `tavleZe`, `tavleIkMaks`, `enhedR`, `ikMin`, `ikVis`, `ikTxt`, `brydeFejl`, `kortslutFejl`, `rcdForan`, `selektivitet`. Advarslernes nøgler begynder med `ik:`, `kb:`, `sf:`, `sg:` og `sr:` |
| Forslag | `effektForslag`, `sfForslag`, `daaseParse`, `symbolFor` |
| Diagrammer | `sld` (enstreg, viser også afbrydere med nøglen `a:<id>`), `taendSvg(af, print)` (tænding; `print` giver den statiske udgave til dokumentationen), `simStd`, `simFor`, `lit`, `krydsLeder`, `afbSti` (symboler efter DS/EN 60617), `afbFor`, `spor`, `sporTil` |
| Dokumentation | `docHtml` (inkl. Tændingsdiagrammer, firmahoved og underskriftsfelt), `udskriv`, `firmaLaes`, `firmaGem`, `firmaLogo`, `gruppeTsv`, `exportJson`, `hent` |

## Test

`tests/smoke.py` kontrollerer, at `css/tailwind.css` er bygget, serverer filerne fra disken, åbner appen i headless Chrome med Alpine fra `node_modules`, skifter alle faner, åbner alle formularer, kører beregninger og eksport tjekker en opgradering med bevarede data og synkroniserer mellem to browserkontekster mod en falsk GitHub-API. Tailwind-CDN'et blokeres i testen, så layoutet ikke testes. Kør `npm install` og derefter `python3 tests/smoke.py`.
