# Ændringshistorik

Nyeste øverst. Versionsnummeret står også i appen som `APP_VERSION`. Hver version siger, hvilken model der lavede den.

## 10.3.0 · 2026-11-16 · Claude Opus

Automatisk vurdering af målinger. Plan: `docs/planer/2026-11-16-maalinger.md`.

- Måleskemaet vurderer hver gruppe: Z<sub>s</sub> ≤ 2/3 · U<sub>0</sub>/I<sub>a</sub> (I<sub>a</sub> = 5/10/20 × I<sub>n</sub> for B/C/D), HPFI-udløsetid ≤ 300 ms ved 1 × IΔn og isolationsmodstand ≥ 1 MΩ. Grænserne er aftalt med Alexander.
- Værdier over grænsen markeres med rødt. Z<sub>s</sub>-grænsen vises under hvert felt, og en ny kolonne viser OK, fejl eller manglende måling.
- Målinger over grænsen kommer med under "Kræver kontrol".
- "> 999" og komma som decimaltegn accepteres.
- Dokumentationen viser maks. Z<sub>s</sub> og vurderingen pr. gruppe.

## 10.2.0 · 2026-11-16 · Claude Opus

Beskeder i bunden. Plan: `docs/planer/2026-11-16-beskeder.md`.

- Almindelig synkronisering viser ikke længere en besked. Hovedet viser i stedet "synkroniseret kl. HH:MM". Konflikter vises stadig.
- Beskeder står i 3,5–10 sekunder efter tekstens længde (mindst 6 sekunder med Fortryd) og kan lukkes med ×.
- Fejl bliver stående med rød kant, indtil de lukkes.
- Op til tre beskeder vises over hinanden, og samme tekst vises kun én gang. Fortryd lukker beskeden, den hører til.

## 10.1.0 · 2026-11-16 · Claude Fable

Installationsmetoder, korrektionsfaktorer og egen I<sub>z</sub>-tabel for XLPE. Plan: `docs/planer/2026-11-16-korrektionsfaktorer.md`. `SCHEMA` 9 → 10, så første start tager en backup.

- I<sub>z</sub> = tabelværdi × k<sub>temp</sub> × k<sub>samlet</sub> efter DS/HD 60364-5-52 anneks B. Metoder A1, A2, B1, B2, C, D1, D2 og E. Temperatur 10–60 °C i luft eller jord. 1–20 samlet fremførte kredse og fremføringsform (bundtet, ét lag på væg, under loft, perforeret bakke, kabelstige).
- XLPE og Brandkabel bruger XLPE-tabellen (90 °C). PVC, PKAJ og PKL bruger PVC-tabellen. Eksisterende XLPE-kabler får derfor højere I<sub>z</sub> end før, fx 3G1,5 fra 19,5 til 24 A.
- Projektets standard sættes under Beregning. Gruppen og tavlens tilgangskabel kan overskrive den. Samledåser følger gruppen.
- Faktorerne vises ved brugsgenstanden, som værktøjstip i kabellisten og i en ny kolonne Fremføring under Beregning.
- Standardværdierne (C, 30 °C, 1 kreds) giver samme I<sub>z</sub> for PVC-kabler, samme ΔU, kabelforslag og advarsler som før.
- Røgtesten tjekker normværdier, regression på eksempelprojekterne (`tests/regression-skema9.json`) og opgradering fra skema 9.

## 10.0.0 · 2026-11-16 · Claude Opus

Appen er delt op i filer, så flere modeller kan arbejde samtidig. Ingen ændring for brugeren og ingen ændring af data. Plan: `docs/planer/2026-11-16-moduler.md`.

- `index.html` indeholder kun markup. CSS ligger i `css/app.css`, og scriptet er delt i `js/data.js`, `js/beregning.js`, `js/diagram.js`, `js/lagring.js` og `js/app.js`. Intet byggetrin.
- Filerne hentes med `?v=<version>`, så browseren aldrig blander ny og gammel kode.
- Røgtesten serverer filerne fra disken og kontrollerer, at `?v=` passer med `APP_VERSION`.
- `CLAUDE.md`: regler for flere modeller samtidig (én branch pr. opgave, versionen sættes ved merge, kun én opgave ad gangen ændrer `SCHEMA`).

## 9.1.1 · 2026-11-16 · Claude Opus

- Synkronisering: en app med et ældre skema end Gist'en hverken henter eller sender. Ellers kunne en gammel version fra browserens cache fjerne felter, som en nyere version havde gemt. Fejlen vises under Dokumentation med besked om at genindlæse siden.
- `CLAUDE.md` er skrevet om: datasikkerhed først, præcise testkommandoer til Windows, arbejdsgang med PR-link og kontrol efter merge, og uden personlige oplysninger.
- Nyt dokument `docs/forslag.md` med forslag, prioritering og hvem der bør udføre dem.

## 9.1.0 · 2026-11-15 · Claude Opus

Synkronisering mellem enheder via GitHub Gist. Plan: `docs/planer/2026-11-15-gist-synk.md`.

- Nyt panel under Dokumentation: forbind med et GitHub-token, der kun har adgangen `gist`. Appen finder eller opretter en hemmelig Gist på kontoen.
- Hvert projekt ligger som sin egen fil i Gist'en. Ændringer sendes automatisk 4 sekunder efter seneste ændring, og nye ændringer hentes ved start, når fanen vises igen, og med "Synkronisér nu".
- Tre-vejs fletning pr. projekt. Er et projekt rettet på to enheder, før de nåede at synkronisere, beholdes begge udgaver ("fra anden enhed"). Sletning slår igennem på de andre enheder.
- Uændrede eksempelprojekter synkroniseres ikke. Lokal lagring og backups er uændrede, og `SCHEMA` er ikke hævet.
- Status i hovedet viser, om projekterne synkroniseres.
- Rettet: konsolfejl i gruppepanelet efter oprettelse af et nyt projekt efterfulgt af en ændring.
- Røgtesten dækker synkronisering mellem to enheder med en falsk GitHub-API.

## 9.0.0 · 2026-11-15 · Claude Opus

Flyttet fra Claude-artefakt til GitHub Pages med sikring af data.

- Appen ligger nu som `index.html` i repoet og hostes på https://rehhoff.github.io/.
- Versionsnummer og skemaversion. Skemaet gemmes sammen med projektlisten.
- Automatisk backup i browseren, før data opgraderes til et nyt skema. De tre seneste gemmes og kan gendannes som kopier.
- Fuld backup af alle projekter som én JSON-fil, og indlæsning af den uden at overskrive noget.
- Appen beder browseren om varig lagring, så data ikke ryddes ved pladsmangel.
- Almindelig filhentning i browseren (backup, projekt, dokumentation, SVG).
- To åbne faner holder hinanden opdateret, så den ene ikke overskriver den andens ændringer.
- Projekthukommelse til Claude: `CLAUDE.md`, denne historik, `docs/ARKITEKTUR.md` og en røgtest.

## 8.0.0 · 2026-11-15 · Claude Fable

- 76 effektforslag, blandt andet lysstofrør, glødepære, halogen, varmelampe, elkedel, sauna og værktøj. Effekt i navnet aflæses direkte, fx "2x58W".
- Samtidighedsfaktor pr. gruppe med forslag efter installationstype (bolig, kontor, butik, institution, fitness, storkøkken, industri) og gruppetype.
- Filter på lokale, der virker på tværs af alle faner.
- Global søgning i hele projektet.
- Tilgangskabel til undertavle som rigtigt kabel med ΔU og I<sub>z</sub>-kontrol.
- Lokaleskabeloner: køkken, bad, stue, værelse, bryggers, kontor, omklædning.

## 7.0.0 · 2026-11-15 · Claude Fable

- Effektforslag ud fra navn og symbol. Belastning kan tastes i W, kW eller A.
- Rækkefølge kan ændres for lokaler, tavler, grupper, brugsgenstande og samlepunkter.
- Undertavle kan forsynes direkte fra en gruppe i en anden tavle.
- Opret lokale, gruppe eller samlepunkt direkte fra en dropdown.
- Nye advarsler for logiske konflikter i installationen.

## 6.0.0 · 2026-11-15 · Claude Fable

- Sensor (PIR) som afbrydertype i tændingsdiagrammet.
- Samlepunktets type og lokale genkendes fra betegnelsen.
- Sidst brugte kabeltype, tværsnit og ledere huskes pr. projekt.
- Batch-oprettelse op til 20 stk. med nummerering, duplikér og klon lokale.
- Fanen Fejlfinder for manglende koblinger.
- Sporing af hele kæden fra forsyning til komponent.

## 5.0.0 · 2026-11-15 · Claude Fable

- Fanen Samlepunkter & dåser. Typer strammet til seks.
- Kabeltyper strammet til Brandkabel, XLPE, PVC, PKAJ og PKL.
- Symboler for hårde hvidevarer i enstregsdiagrammet.
- Afbrydere og fanen Tændingsdiagram: enpolet, krone, korrespondance, kiprelæ, trappeautomat.

## 4.0.0 · 2026-11-15 · Claude Fable

- Svagstrøm: rackskabe, udstyr, PDS-udtag og CCTV med porte, PoE-budget og NVR-kanaler.
- Samlepunkter med forgrening og ΔU gennem alle led.
- Fri forsikringsstørrelse, hovedafbryder og tværsnit op til 120 mm².

## 3.0.0 · 2026-11-15 · Claude Fable

- Flere projekter med skift, oprettelse, duplikering og sletning.
- Dynamisk enstregsdiagram i SVG med zoom, panorering og klik.

## 2.0.0 · 2026-11-15 · Claude Fable

- Tavleskema med DIN-skinne, HPFI og automatsikringer.
- Beregning af spændingsfald, I<sub>z</sub>, fasebalance og automatisk balancering.
- Gruppeskema og måleskema til dokumentation, JSON eksport og import.
- Hurtig tilføj, tastaturgenveje, fortryd og lyst og mørkt tema.

## 1.0.0 · 2026-11-15 · Claude Fable

- Første prototype: lokaler, tavler, grupper, brugsgenstande og kabeltabel med lokal lagring.
