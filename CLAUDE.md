# CLAUDE.md: El-oversigtsappen

Webapp til elektrikerarbejde: tavler, grupper, lokaler, kabler, samlepunkter, afbrydere og svagstrøm, med beregninger (ΔU, I<sub>z</sub>, fasebalance), diagrammer og dokumentation. Ejer: Alexander. Brugerfladen er på dansk.

- Live: https://rehhoff.github.io/ (GitHub Pages fra `main`, mappe `/`). Repoet er offentligt: skriv ingen personlige oplysninger i filer eller commits.
- Ét lille byggetrin: Tailwind-CSS'en bygges med `python tools/byg_css.py` (Tailwinds officielle program v3.4.17, hentes automatisk til `~/.cache/el-oversigt/`). Alpine.js 3.14.1 fra cdnjs. Almindelige scripts, der deler globalt scope, indlæst i denne rækkefølge:
  - `index.html`: markup med Alpine-direktiver.
  - `css/app.css`: farvetokens, lyst og mørkt tema, egne klasser. `css/tailwind.css`: bygget fra `tailwind.config.js` og `css/tailwind.input.css`. Ret den aldrig i hånden.
  - `js/data.js`: konstanter, `APP_VERSION`, `SCHEMA`, lagernøgler, tabeller (`IZ`, `EFFEKT`, `SF` …), `norm()` og eksempeldata.
  - `js/beregning.js` (`APP_BEREGNING`), `js/diagram.js` (`APP_DIAGRAM`), `js/lagring.js` (`APP_LAGRING`): metoder, der samles i `app()`.
  - `js/app.js`: `app()` med tilstand, `init()` og resten af brugerfladen. `bland()` lægger metoderne fra de andre filer på.
  - `sw.js`, `manifest.webmanifest`, `ikoner/`: offline-app. `sw.js` gemmer app-filerne til brug uden net. En ny fil i `css/` eller `js/` skal også stå i listen `SKAL` i `sw.js`.
- Ny metode lægges i den fil, hvis emne den hører til. Navne skal være unikke på tværs af filerne, fordi de samles i ét objekt.
- Opbygning og datamodel: `docs/ARKITEKTUR.md`. Historik: `CHANGELOG.md`. Forslag og prioritering: `docs/forslag.md`. Planer: `docs/planer/`.

## 1. Data må aldrig gå tabt

Projekterne ligger i browserens localStorage på `rehhoff.github.io` og kan synkroniseres til en hemmelig GitHub Gist.

1. Omdøb eller fjern aldrig disse nøgler: `tavleoversigt.projekter`, `tavleoversigt.p.<id>`, `tavleoversigt.backups`, `tavleoversigt.tema`, `tavleoversigt.firma`, `tavleoversigt.sync`, samt de gamle `tavleoversigt.v1` og `.v2`, som stadig migreres. Det samme gælder IndexedDB-databasen `tavleoversigt-billeder` (tabellerne `billeder` og `mini`), hvor billederne til brandlukninger (skema 15) og til tavler, lokaler og samledåser (skema 16) ligger.
2. Ændres datamodellen: udvid `norm()` med standardværdier og migrering af gamle felter, og hæv `SCHEMA`. Første start efter en hævning tager automatisk en backup (`lavBackup`).
3. Slet aldrig et felt med brugerdata uden at flytte dataene først.
4. Synkronisering: en app med lavere `SCHEMA` end Gist'ens markørfil (`tavleoversigt.json`) må hverken læse eller skrive. Formatet i Gist'en (markør plus `tavleoversigt-<id>.json` pr. projekt) må kun udvides, aldrig omdøbes. Billederne ligger i separate hemmelige Gists (markør `tavleoversigt-billeder.json` plus `tavleoversigt-billede-<id>.txt` pr. billede, højst 250 billeder i hver) med samme skemaregel. Billeder slettes aldrig automatisk, hverken i IndexedDB eller i Gist'en. Den eneste sletning er oprydningen under Datasikring, som kun sletter efter brugerens bekræftelse, og kun billeder, som intet projekt, ingen automatisk backup og ingen projekt-Gist bruger; ved den mindste tvivl slettes intet. En ny billedliste i datamodellen skal tilføjes i `billedIds()` i `js/data.js`, ellers kan oprydningen slette dens billeder.
5. Hæves `SCHEMA`: tilføj et tjek i `tests/smoke.py` med data i det gamle format, som skal være intakte efter opgraderingen.

## 2. Arbejdsgang

1. Lav en branch fra `main`.
2. Ret koden. Hold samme design (farvetokens i `:root`, lyst og mørkt tema) og samme kodestil. Bruger du en Tailwind-klasse, der ikke findes i forvejen, så kør `python tools/byg_css.py`. Klassenavne skal stå hele i koden (ikke `'text-' + farve`), ellers kommer de ikke med i CSS'en.
3. Hæv versionen fire steder ved merge (se afsnit 3): `APP_VERSION` i `js/data.js`, alle `?v=` i `index.html`, `VERSION` i `sw.js` og `version` i `package.json` (ny funktion = minor, rettelse = patch, større omlægning = major). `?v=` sikrer, at browseren ikke blander en ny `index.html` med gamle filer fra cachen. Uden ny `VERSION` i `sw.js` får installerede apps ikke den nye version. Røgtesten fejler, hvis de ikke passer sammen.
4. Tilføj et afsnit øverst i `CHANGELOG.md` med dato, version, model og ændringer. Opdater `docs/ARKITEKTUR.md`, hvis nøgler, felter, faner eller funktioner ændres.
5. Kør røgtesten. Den skal slutte med `OK`. På Alexanders Windows-PC (ingen npm, Python hedder `python`):
   ```
   pip install playwright
   python -m playwright install chromium
   mkdir -p node_modules/alpinejs/dist && curl -sfL https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js -o node_modules/alpinejs/dist/cdn.min.js
   python tools/byg_css.py
   python tests/smoke.py
   ```
   Røgtesten stopper selv efter 300 s (`SMOKE_SAMLET_S`) og hver Playwright-handling efter 15 s (`SMOKE_TRIN_MS`) og siger, hvilket tjek der hang.
   Med npm: `npm install` og `python3 tests/smoke.py`. Sæt `PYTHONIOENCODING=utf-8`, hvis æ, ø og å giver fejl i konsollen.
6. Commit med en beskrivelse på dansk, og nævn planen, hvis der er en. Push branchen.
7. Claude merger selv (aftalt med Alexander 2026-11-16), når røgtesten giver `OK`. Hent først den nyeste `main` ind i branchen (`git fetch && git merge origin/main`), løs konflikter, sæt versionen ud fra den aktuelle `main`, og kør røgtesten igen. Derefter `git checkout main && git pull && git merge --no-ff <branch>` og `git push origin main`. `gh` er ikke logget ind, så der bruges ingen pull request.
8. Efter merge: slet branchen lokalt og på GitHub (`git push origin --delete <branch>`), så `main` er den eneste branch, og kontrollér at `APP_VERSION` på https://rehhoff.github.io/ er den nye. Pages er 1–10 minutter om at opdatere. Tag merge-commit'en med versionen (`git tag -a v<version> -m "Udgivet version <version>"` og `git push origin v<version>`), så alle udgivne versioner kan findes og rulles tilbage til. Slet aldrig et versionstag. Fortæl Alexander, hvad der er udgivet.
9. Tilbagerulning, hvis en ny version ødelægger noget (kun når Alexander beder om det): lav en branch fra `main`, gendan filerne fra det ønskede tag med `git checkout v<gammel> -- .` (`git rm` filer, der er kommet til siden), sæt en ny patch-version de fire steder, kør røgtesten og merge som normalt. Historikken bevares, og fejlen kan rettes bagefter.
   - Er `SCHEMA` hævet siden den gamle version, så rul ikke tilbage over hævningen uden at spørge. Den gamle app kan ikke synkronisere med en Gist, der har det nyere skema (afsnit 1, punkt 4). Data i browseren er sikret af den automatiske backup (`lavBackup`), men ret hellere fremad.

## 3. Flere modeller samtidig

- Én opgave = én plan = én session = én branch, i sin egen worktree. Arbejd aldrig direkte på `main`.
- Planen siger, hvilke filer opgaven ændrer. To sessioner, der kører samtidig, må ikke have samme fil som hovedfil. Små tilføjelser i fælles filer (`index.html`, `js/app.js`) er tilladt, men hold dem samlet ét sted.
- Kun én opgave ad gangen må ændre datamodellen eller hæve `SCHEMA`. Det står i planen.
- Versionen og `CHANGELOG.md` sættes først ved merge, ud fra den aktuelle `main`. Ved konflikt i `CHANGELOG.md` beholdes begge afsnit, nyeste øverst.
- Én merge ad gangen: den, der merger, henter `main` først og kører røgtesten igen (afsnit 2, punkt 7).
- Er en anden session i gang med en fil, du skal ændre, så skriv det i planen og aftal rækkefølgen med Alexander.

## 4. Faglige regler

Faste lister, som ikke må ændres uden aftale:

- Kabeltyper: Brandkabel, XLPE, PVC, PKAJ, PKL. "Tilgangskabel" på tavlen er fritekst og skal blive ved med at være det.
- Samlepunkttyper: Membrandåse, Indmuringsdåse, Forfradåse, Underlag, Europadåse, PL-dåse.
- Brandtætningsprodukter til afkrydsning (`BRANDPRODUKTER`, aftalt 2026-11-19): FR Brandkit, FR Brandplade, FR Gipsmørtel, FR Manchet, FR Pakning, FR Akryl, FR Grafit, FR Brandspjæld, FR Trækrør. Andre produkter skrives i fritekstfeltet.
- Datakabler under svagstrøm (Cat6, Cat6A, Cat7, fiber) er undtaget fra kabellisten.

Forudsætninger i beregningerne. Alt er vejledende og står også i appen:

- ρ = 0,0225 Ω·mm²/m, cos φ = 1, 230 V og 3 × 400 V.
- ΔU-grænse 3 % for lys og for "Lys og stik" og 5 % for øvrige (DS/HD 60364-5-52, anneks G). ΔU summeres gennem tilgangskabel, samledåser og afgang.
- I<sub>z</sub> for kobber efter DS/HD 60364-5-52 anneks B: tabelværdi (B.52.2–B.52.5, metode E fra B.52.10/B.52.12) × k<sub>temp</sub> (B.52.14 luft, basis 30 °C; B.52.15 jord, basis 20 °C) × k<sub>samlet</sub> (B.52.17 i luft; B.52.18/B.52.19 i jord, højst 6 kredse). Metoder A1, A2, B1, B2, C, D1, D2 og E; F er udeladt, da den kun gælder enlederkabler. Jord 2,5 K·m/W.
- Isolationstabel: PVC, PKAJ og PKL → PVC 70 °C. XLPE og Brandkabel → XLPE 90 °C.
- Projektets standard er metode C, 30 °C (jord 20 °C), 1 kreds, bundtet. Grupper og tilgangskabler kan overskrive den. Dåser følger gruppen.
- Gruppens last = summen af brugsgenstandenes strøm × gruppens samtidighedsfaktor + rackforbrug.
- Gruppetypen "Lys og stik" (aftalt 2026-11-18) er en installation med både lys og stikkontakter: ΔU-grænse 3 % som lys, samtidighedsfaktor som lys-værdien for installationstypen, og den kan vælges til afbrydere som lys.
- 1-faset tilslutning på 3-faset gruppe (aftalt 2026-11-18): en brugsgenstand med `fase` L1, L2 eller L3 er tilsluttet den fase og nul, fx på et 5G-kabel. Strømmen er P/230 og lægges kun på den fase i gruppens og tavlens fasestrømme. Dens eget træk regnes 1-faset (2·L, 230 V), og I<sub>z</sub> med 2 belastede ledere. Et træk, der fører strøm for flere brugsgenstande (sløjfe eller dåse), regnes pr. fase: er kun én fase belastet, 1-faset; ellers den største af ΔU<sub>p</sub> = ρ·L/A · (2·I<sub>p</sub> − ½·(I<sub>q</sub> + I<sub>r</sub>)) / (400/√3), dvs. fasens eget fald plus nulstrømmens bidrag med cos φ = 1 og nul i samme tværsnit som faselederen. Ved symmetrisk last er det den almindelige 3-fasede formel. Tilgangskablet regnes som før med den største fasestrøm.
- Effektforslag er typiske mærkeeffekter, ikke dimensioneringsværdier.
- Målinger (aftalt 2026-11-16): Z<sub>s</sub> ≤ 2/3 · U<sub>0</sub>/I<sub>a</sub> med I<sub>a</sub> = 5/10/20 × I<sub>n</sub> for B/C/D, HPFI-udløsetid ≤ 300 ms ved 1 × IΔn, isolationsmodstand ≥ 1 MΩ.
- Kortslutningsstrøm (aftalt 2026-11-16): I<sub>k,min</sub> i gruppens yderste punkt = c<sub>min</sub> · U<sub>0</sub> / (Z<sub>e</sub> + R<sub>fase</sub> + R<sub>PE</sub>) med c<sub>min</sub> = 0,95 og U<sub>0</sub> = 230 V. Z<sub>e</sub> er tavlens felt (målt Z<sub>s</sub> ved tavlen eller netselskabets værdi); uden Z<sub>e</sub> vises I<sub>k</sub> ikke. En undertavle uden egen Z<sub>e</sub> regnes fra den forsynende tavle gennem tilgangskablet. R fra ρ og længden gennem dåser og afgang, samme vej som ΔU, til den brugsgenstand, der giver størst modstand. Ledermodstanden ganges med 1,2 for PVC, PKAJ og PKL og 1,28 for XLPE og Brandkabel. PE har samme tværsnit som faselederen.
- Udkobling er OK, når I<sub>k,min</sub> ≥ I<sub>a</sub> (5/10/20 × I<sub>n</sub> for B/C/D). Automatsikringens brydeevne er 6 kA som standard og kan rettes pr. gruppe; er tavlens I<sub>k,maks</sub> større, advares der.
- Selektivitet (aftalt 2026-11-16): advarsel, når en forsikring (tavlens forsikring eller en gruppe, der forsyner en undertavle) er under 1,6 × den største efterfølgende sikring. En undertavle forsynet fra en gruppe tjekkes kun på den gruppe, ikke på sit eget felt Forsikring (aftalt 2026-11-16, forslag 18). Advarsel ved to HPFI'er i serie, medmindre den forreste er type S, og dens IΔn er mindst 3 × den bageste.

## 5. Roller og planer

- Claude Opus må ændre koden direkte, når kvaliteten holdes: samme design, test før commit og opdateret dokumentation.
- Claude Opus må planlægge alle opgaver og skriver i planen, om Fable, Opus eller Sonnet skal udføre den, med en kort begrundelse.
- Claude Fable må gennemgå og ændre enhver plan, også under implementeringen. Ændringer noteres i planen med dato og begrundelse.
- Claude Sonnet og mindre modeller implementerer kun efter en skriftlig plan.
- Er den valgte model ikke tilgængelig, udfører Opus opgaven og noterer det i planen.
- Planer gemmes i `docs/planer/ÅÅÅÅ-MM-DD-emne.md` før implementeringen (se `docs/planer/README.md`).

## 6. Kommunikation

- Svar kort, direkte og teknisk præcist, på dansk.
- Spørg før du tilføjer funktioner, Alexander ikke har bedt om. Foreslå dem i stedet, og skriv dem i `docs/forslag.md`.
- Er du i tvivl om din rolle eller om en faglig regel, så spørg, før du ændrer kode.
