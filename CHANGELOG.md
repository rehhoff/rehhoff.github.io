# Ændringshistorik

Nyeste øverst. Versionsnummeret står også i appen som `APP_VERSION`. Hver version siger, hvilken model der lavede den.

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
