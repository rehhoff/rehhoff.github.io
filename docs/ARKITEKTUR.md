# Opbygning og datamodel

## Filer

| Fil | Indhold |
|---|---|
| `index.html` | Markup med Alpine-direktiver. Hver fane er en `<template x-if="view==='…'"><section>…</section></template>`, så kun den aktive fane er i DOM'en, markeret med en `<!-- ===== NAVN ===== -->`-kommentar |
| `css/app.css` | Farvetokens i `:root`, mørkt tema under `prefers-color-scheme` og `[data-theme="dark"]`, egne klasser |
| `css/tailwind.css` | Bygget Tailwind-CSS (ret ikke i hånden). Kilde: `tailwind.config.js` og `css/tailwind.input.css` |
| `tools/byg_css.py` | Bygger `css/tailwind.css`. `--tjek` fejler, hvis den ikke er bygget efter seneste ændring |
| `sw.js` | Service worker: gemmer app-skallen (`SKAL`) til brug uden net. Sider hentes net først, filer med `?v=` cache først, GitHub aldrig gemt. Kun appens egne adresser (`EGNE`) håndteres; andre apps på samme origin, fx Elskolen under `/elskole/`, røres ikke |
| `manifest.webmanifest`, `ikoner/` | Installérbar app (navn, farver, ikoner) |
| `js/data.js` | Konstanter, `APP_VERSION`, `SCHEMA`, lagernøgler, tabeller, `norm()`, eksempeldata (`seed`, `seed2`), `hashD` |
| `js/beregning.js` | `APP_BEREGNING()`: strøm, ΔU, I<sub>z</sub>, fasebalance, kabeltabel, samtidighed, tilgangskabel, effektforslag |
| `js/diagram.js` | `APP_DIAGRAM()`: enstregsdiagram, sporing, afbrydere og tændingsdiagram |
| `js/lagring.js` | `APP_LAGRING()`: projekter, eksport, import, backup, synkronisering |
| `js/billeder.js` | `APP_BILLEDER()`: billeder til brandlukninger, tavler, lokaler og samledåser. Fælles billedfelt i formularerne, komprimering med canvas, IndexedDB (`tavleoversigt-billeder`), miniaturer, billedsynk til separate Gists (højst 250 billeder i hver), billeder i backupfilen, lageradvarsel, oprydning af ubrugte billeder, afsnittet Billeder i dokumentationen |
| `js/brand.js` | `APP_BRAND()`: fanen Brandlukning (liste, filtre, optælling, formular) og afsnittet i dokumentationen |
| `js/aflevering.js` | `APP_AFLEVERING()`: afleveringstjek i Fejlfinder (`aflTjek`, `aflAntal`, `aflGaa`, statuslinje i dokumentationen) og tavlefortegnelsen (`tavleFortegnelseHtml`, `udskrivFortegnelse`). Ingen egne data |
| `js/import.js` | `APP_IMPORT()`: import af brugsgenstande og lokaler fra indsatte regnearksceller (overskrifter, forhåndsvisning, ét fortrydeligt trin) |
| `js/historik.js` | `APP_HISTORIK()`: tidligere versioner af det aktive projekt fra Gist'ens versionshistorik (`/gists/{id}/commits`), gendannes som kopi |
| `js/app.js` | `app()`: tilstand, `init()` og resten af brugerfladen. `bland()` samler metoderne fra de tre filer ovenfor |
| `CLAUDE.md` | Regler og hukommelse for Claude |
| `CHANGELOG.md` | Versionshistorik |
| `tests/smoke.py` | Røgtest i headless Chrome |
| `tests/ydelse.py` | Måling af svartider på et stort projekt (`YDELSE_F` = størrelse, 1 = 3 tavler, 60 grupper, 120 dåser, 600 brugsgenstande, 60 afbrydere). Ikke en del af røgtesten |
| `docs/planer/`, `docs/forslag.md` | Planer og forslag |
| `.nojekyll` | GitHub Pages serverer filerne uændret |

## Indlæsning

Scriptsene er almindelige scripts (ikke ES-moduler) og deler globalt scope. Rækkefølgen er `data.js`, `beregning.js`, `diagram.js`, `lagring.js`, `app.js` og til sidst Alpine (`defer`). `css/app.css` indlæses før `css/tailwind.css`, så Tailwinds klasser vinder som før med CDN'et. `css/` og `js/` hentes med `?v=<APP_VERSION>`, så en ny version aldrig blandes med gamle filer fra cachen. Metodenavne skal være unikke på tværs af filerne.

Under 1024 px står hovedets titel og værktøjer under hinanden, og fanerne er én række, der kan rulles sidelæns (`.faner`, `lg:contents` fra 1024 px). Under 640 px vises måleskemaet som kort (`.mk`) i stedet for tabellen. Desktop-layoutet er uændret.

Faner i `views`: Tavle, Enstregsdiagram, Tændingsdiagram, Samlepunkter & dåser, Svagstrøm, Beregning, Lokaler, Kabler, Dokumentation, Fejlfinder. Tasterne 1 til 9 og 0 skifter fane.

## Ydelse

- **`dbRev`** (tilstand i `app()`) øges i `mutate`, `save`, `undo`, `redo`, `aktiver` og når `db` udskiftes. Alt mellemlagret nulstilles, når `db`, `dbRev` eller længden af tavler, grupper, dåser eller brugsgenstande ændrer sig.
- **`idx()`** giver `Map` fra id til objekt (`tavle`, `gruppe`, `daase`, `enhed`). **`kid()`** giver børneindeks (`grupper`, `enhFra`, `enhDaase`, `enhGruppe`, `daaseParent`, `daaseGruppe`, `afbFra`, `afbDaase`). Begge ligger i modul-variablen `IDXC` i `data.js`, uden for Alpines tilstand. `tavle()`, `gruppe()`, `daase()`, `enhed()`, `sloejfer()`, `grupperFor()`, `enhederFor()`, `daaserFor()` og `nedstroem()` bruger dem.
- **`memo(navn, deps, fn)`** mellemlagrer én værdi (`foeringTrae`, `fvOptael`, `sorteredeGrupper`, `warnings`, `stats`, `rows`, `mangler`). **`mk(navn, key, fn)`** mellemlagrer pr. nøgle (`faseV`, `egenFaser`, `gruppeFaser`, `enhedFaser`, `daaseFaser`, `tilgI`). Lageret er `MEMO` i `data.js`. Intet må ændre en returneret værdi. Ændres `db` uden om `mutate` og `save()` (fx direkte i en test), skal `dbRev` øges, ellers ses ændringen ikke.
- **Faner** er `x-if`. Alpine 3.14.1 stopper kun den sidste binding på et fjernet element, så `init()` har en `MutationObserver`, der stopper resten, når elementet stadig er væk.
- **Gemning**: `save()` lægger strengen i `MEM` straks og udskyder `localStorage.setItem`, `meta()` og `skrivIdx()` højst 300 ms (`SAVEP`, `TIMERS.gem`). `gemNu()` skriver straks og kaldes før projektskift, backup, synkronisering og oprydning af billeder, og ved `visibilitychange` (skjult), `pagehide` og `beforeunload`. `skriv()` skriver altid straks.

## Lagring

| Nøgle | Indhold |
|---|---|
| `tavleoversigt.projekter` | `{ aktiv, liste:[meta], schema, app, sidstBackup }` |
| `tavleoversigt.p.<id>` | Ét projekt som JSON |
| `tavleoversigt.backups` | Op til tre automatiske backups `{ tid, grund, app, schema, idx, raw:{id:json} }` |
| `tavleoversigt.firma` | Firmaoplysninger til dokumentationen: `{ navn, cvr, adresse, telefon, logo }` (logo som data-URL, højst 400 px bred). Gælder alle projekter og synkroniseres ikke |
| `tavleoversigt.tema` | `auto`, `light` eller `dark` |
| `tavleoversigt.sync` | Synkronisering: `{ token, gistId, login, base:{ id: hash }, sidst, bGist, bSendt:[id] }`. `bGist` er denne enheds billed-Gist, og `bSendt` er de billed-id'er, der vides at ligge i en billed-Gist (skema 15). Findes kun, når synkronisering er slået til |
| IndexedDB `tavleoversigt-billeder` | Version 1. Tabellen `billeder`: `{ id, data }` (JPEG som data-URL, længste side højst 1600 px, ca. 100–300 KB). Tabellen `mini`: `{ id, data, oprettet }` (miniature, 320 px). Billeder slettes aldrig automatisk, kun af oprydningen efter brugerens bekræftelse (skema 16) |
| `tavleoversigt.v1`, `.v2` | Gamle formater, migreres ved første start |

`norm()` lægger standardværdier på og migrerer gamle felter, hver gang et projekt læses. Synkroniseringens Gist indeholder markøren `tavleoversigt.json` og én fil `tavleoversigt-<id>.json` pr. projekt. Markørens `schema` er det højeste skema, der har skrevet til Gist'en. En app med lavere `SCHEMA` afbryder synkroniseringen uden at læse eller skrive. `base` er hver projekts hash ved seneste synkronisering og bruges til tre-vejs fletning (se `docs/planer/2026-11-15-gist-synk.md`). Backupfilen har formatet `{ format:'tavleoversigt-backup', app, schema, eksporteret, aktiv, projekter:[{ id, data }], billeder:{ id: data-URL } }`. `billeder` (skema 15) har de billeder, projekterne bruger, og indlæses kun, hvis de mangler på enheden. Projekt-JSON og de automatiske backups i localStorage har kun billedernes id'er.

Billeder synkroniseres til en separat hemmelig Gist, så projekt-Gist'en forbliver lille og aldrig når API'ets grænse på 300 filer. Den har markøren `tavleoversigt-billeder.json` (`{ format:'tavleoversigt-billeder', app, schema, opdateret }`, samme skemaregel) og én fil `tavleoversigt-billede-<id>.txt` med data-URL'en pr. billede. `billedSynk()` kører efter projekterne og kalder kun GitHub, når et billede mangler at blive sendt eller hentet. Listen over Gists (uden indhold) giver filnavne og `raw_url`, og billeder hentes altid via `raw_url`. Alle Gists med markøren læses, så billeder fra to enheder, der hver har oprettet en billed-Gist, findes begge steder (se `docs/planer/2026-11-18-brandlukning.md`).

Skema 16 (`docs/planer/2026-11-18-billeder.md`): højst `BMAKS` = 250 billeder pr. billed-Gist; er der ikke plads, oprettes en ny med markøren. Svaret på `PATCH` læses ikke (`gh(…, { udenSvar:true })`). Første billedsynk i en session henter altid listen, så et brugt billede, der mangler i alle billed-Gists, sendes igen. `billedIds(d)` i `js/data.js` samler alle billed-id'er i et projekt. **Oprydning** (Datasikring → Find ubrugte billeder): et billede er brugt, hvis det findes i et projekt i browseren (alle nøgler `tavleoversigt.p.*`), i fortryd-listen, i en automatisk backup eller, når synkronisering er slået til, i et projekt i en af kontoens projekt-Gists (efter en vellykket synkronisering). Kan noget ikke læses, eller har noget et nyere skema, slettes intet. På enheden slettes kun ubrugte billeder, der er mindst 24 timer gamle. Søgningen gentages før sletning, og kun billeder, der er ubrugte i begge søgninger, slettes. Gist'ens historik tjekkes ikke.

## Datamodel for et projekt

| Liste | Felter |
|---|---|
| `projekt` | `navn, sagsnr, kunde, adresse, installatoer, dato, anlaeg, sidst{kabel, ledere, tv}, metode, temp, jtemp, samlet, lag` (skema 10, standard `C, 30, 20, 1, bundt`) |
| `tavler` | `id, navn, placering, forsikring, hovedafbryder, fra, fraGruppe, tilgang, tKabel, tLedere, tTv, tLaengde, tMetode, tTemp, tSamlet, tLag` (tom = projektets standard), `ze` (Ω), `ikMaks` (kA) (skema 12, 0 = ukendt), `tTrukket`, `tNote` (skema 13, tilgangskablets status), `billeder[]` (skema 16, billed-id'er) |
| `rcds` | `id, tavleId, navn, type, In, idn, selektiv` (skema 12: type S) |
| `lokaler` | `id, navn, etage`, `billeder[]` (skema 16) |
| `grupper` | `id, tavleId, nr, navn, type (lys, lysstik = Lys og stik, kraft, stik, data), kar, In, faser, fase, rcdId, sf, maal{riso, zs, rcd, ok}, metode, temp, samlet, lag` (tom = projektets standard), `brydeevne` (kA, skema 12, standard 6) |
| `enheder` | `id, gruppeId, lokaleId, daaseId, navn, effekt (W), kabel, ledere, tv, laengde, symbol`, `fraEnhed` (sløjfet fra en anden brugsgenstand, arver gruppe og `daaseId`), `hoejde` (cm), `placering`, `trukket`, `note` (skema 13), `fase` (skema 14: `''` = som gruppen, `L1`/`L2`/`L3` = 1-faset tilslutning mellem fasen og nul; bruges kun på en 3-faset gruppe) |
| `daaser` | `id, navn, type, gruppeId, parentId, lokaleId, kabel, ledere, tv, laengde`, `hoejde`, `placering`, `trukket`, `note` (skema 13), `billeder[]` (skema 16, fx placeringen af en skjult dåse) |
| `afbrydere` | `id, navn, art (enpolet, krone, korr, kryds, kip, trappe, sensor), gruppeId, lokaleId, steder, tid, a[], b[]`. `kryds` (skema 11): `steder` er antal betjeningssteder, 3 til 6. Skema 13: eget træk `daaseId` eller `fraEnhed`, `kabel, ledere, tv, laengde` (0 = intet træk, indgår ikke i ΔU), `hoejde`, `placering`, `trukket`, `note` |
| `racks` | `id, navn, type, he, lokaleId, gruppeId` |
| `udstyr` | `id, rackId, navn, art, he, pos, porte, poe, poeBudget, effekt` |
| `links` | `id, art (data, cctv), navn, lokaleId, kabel, laengde, panelId, panelPort, switchId, switchPort, patch, poeW, kamType, oploesning, nvrId` |
| `brandlukninger` | Skema 15: `id, nr, lokaleId, placering, beskrivelse, brandklasse, produkt` (fritekst), `produkter[]` (skema 17, afkrydsede fra `BRANDPRODUKTER`), `udfoert, maerkat` (brandmærkat sat), `note`, `billeder[]` (billed-id'er; selve billederne ligger i IndexedDB) |

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
| Føringsvej | `enhed`, `sloejfer`, `enhedNed`, `enhedFaser`, `enhedI` (største fasestrøm i trækket inkl. sløjfer), `enhedRod`, `enhedDaase`, `duSloejfe`, `sloejfeVej`, `foeringTrae`, `fvSaet`, `fvNy`, `fvOptael`, `grenKopier` (kopiér gren), `sloejfeValg`, `afbFraSaet`, `fvSlet`, `fvRedAabn`, `fvRedGem` (ret kabel i oversigten, tilstand i `fvRed`, `fvTmp`), `fvToggle`, `fvLukket`, `fvFoldAlle`, `fvHover`, `fvGaa` (fold sammen, fremhævning og rul til forælder; grupper er foldet sammen som standard, og tilstanden er `fvAaben` for udfoldede grupper og `fvFold` for øvrige sammenfoldede rækker, plus `fvHi`, `fvAnc`, `fvBlink`, kun i appen), `fvTotal` (samlet længde fra tavlen uden tilgangskablet, vist som "I alt"), `fvDaaseLaengde`. `foeringTrae` giver hver række `par`, `anc`, `sidst`, `linjer`, `fra`, `boern`, `luk` til trælinjerne. `zeBeregnet` i beregning.js. Samtidighedsfaktor-pop-up: `sfListe`, `sfAabn`, `sfVaelg` (tilstand i `sfPop`) |
| Brandlukning | `brandI`, `brandListe` (lokalefilter og "kun ikke udført / mangler mærkat"), `brandOptael`, `brandNaesteNr`, `brandNy`, `brandSaet`, `brandGem`, `brandDocHtml` |
| Billeder | `billedStart`, `billedSrc`, `billedKomprimer`, `billedTegn`, `billedGem`, `billedData`, `billedFraFil`, `billedVis`, `brugteBilleder`, `billederTilBackup`, `billedImport`, `billedSynk`, `billedGists`, `ghAlleGists`, `billedLager`, `lagerTxt`, `billedFjern`, `billedFelt`, `billedOprydFind`, `billedOprydAabn`, `billedOprydSlet`, `billedDocHtml`. Hjælpere `bdbAaben`, `bdbKoer`, globale `bIdListe`, `billedIds`, `BMAKS`; globale `BMINI` (miniaturer i hukommelsen) og `BFULD` (id'er på enheden) |
| Kontrol | `gruppeFejl`, `warnings`, `mangler`, `linkFejl`, `maalVurdering`, `zsMax`, `maalTal` |
| Kortslutning og selektivitet | `ia` (I<sub>a</sub>), `kLeder`, `rSloejfe`, `tavleOp`, `tavleZe`, `tavleIkMaks`, `enhedR`, `ikMin`, `ikVis`, `ikTxt`, `brydeFejl`, `kortslutFejl`, `rcdForan`, `selektivitet`. Advarslernes nøgler begynder med `ik:`, `kb:`, `sf:`, `sg:` og `sr:` |
| Forslag | `effektForslag`, `sfForslag`, `daaseParse`, `symbolFor` |
| Diagrammer | `sld` (enstreg, viser også afbrydere med nøglen `a:<id>`; sløjfer tegnes under den brugsgenstand, de er sløjfet fra: rækken har `data-fra=<id>`, forgreningsprikken `circle.sp[data-sp=<id>]`), symbolet `tilgang` (Tilgang, ingen last, tælles ikke som brugsgenstand; tegnes i serie som et mellemled på linjen med `data-tx` = symbolets x, og det, der er sløjfet fra den, udgår fra skinnen efter den), træk for at flytte en forbindelse: langt tryk (`SLDT`) starter `traekStart`, `traekFlyt`, slip kalder `flytEnhed(eid, key)` (`e:` sløjfe, `d:` dåse, `g:` direkte fra gruppen; `flytTjek` afviser kredse og andre grupper; `flytValg` giver listen "Flyt til …"), tilstanden `traek`, pinch-zoom `panStart`, `panMove`, `panEnd`, `pinchStart`, `pinchMaal` (aktive pointere i `SLDP`), `taendSvg(af, print)` (tænding; `print` giver den statiske udgave til dokumentationen), `simStd`, `simFor`, `lit`, `krydsLeder`, `afbSti` (symboler efter DS/EN 60617), `afbFor`, `spor`, `sporTil` |
| Dokumentation | `docHtml` (inkl. Tændingsdiagrammer, firmahoved og underskriftsfelt), `udskriv`, `firmaLaes`, `firmaGem`, `firmaLogo`, `gruppeTsv`, `exportJson`, `hent` |

## Test

`tests/smoke.py` kontrollerer, at `css/tailwind.css` er bygget, serverer filerne fra disken, åbner appen i headless Chrome med Alpine fra `node_modules`, skifter alle faner, åbner alle formularer, kører beregninger og eksport tjekker en opgradering med bevarede data og synkroniserer mellem to browserkontekster mod en falsk GitHub-API. Tailwind-CDN'et blokeres i testen, så layoutet ikke testes. Kør `npm install` og derefter `python3 tests/smoke.py`.
