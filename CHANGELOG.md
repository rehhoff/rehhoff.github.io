# Ændringshistorik

Nyeste øverst. Versionsnummeret står også i appen som `APP_VERSION`. Hver version siger, hvilken model der lavede den.

## 10.13.0 · 2026-11-17 · Claude Opus

Føringsvej og trukne kabler. Plan: `docs/planer/2026-11-17-foeringsvej.md`.

- Ny fane **Føringsvej**: et træ pr. tavle og gruppe, der viser hvert kabeltræk fra tavlen gennem samlepunkter og sløjfer til brugsgenstande og afbrydere, med kabeltype, ledere, tværsnit, længde, placering og højde. Lokalefilteret viser lokalets træk og vejen dertil.
- Hvert træk har et flueben (trukket) og en note, fx "venter på tømrer". Filteret "Kun ikke trukket" og optællingen af trukne og manglende meter.
- En brugsgenstand kan sløjfes fra en anden (fx vægudtag → vægudtag → stikkontakt). ΔU, l<sub>max</sub> og I<sub>k,min</sub> følger sløjfen. Uden sløjfer er alle tal som før.
- En afbryder kan have sit eget træk fra en dåse eller en brugsgenstand. Det kommer i kabelliste, materialeliste og føringsvej, men ikke i ΔU.
- Hurtig indtastning: **+ Sløjfe** kopierer kabel, lokale, placering og højde fra forrige træk. **Kopiér** kopierer en hel gren (fx en væg) med ny placering. Ved flere stk. kan de sløjfes efter hinanden.
- Materialelisten viser "Kabler, heraf ikke trukket", når mindst ét træk er markeret som trukket.
- Datamodel: `SCHEMA` 13 med nye felter (se `docs/ARKITEKTUR.md`). Ingen felter er fjernet. Første start tager en backup.

## 10.12.2 · 2026-11-16 · Claude Opus

Selektivitet for undertavler (forslag 18, godkendt af Alexander).

- En undertavle, der forsynes fra en gruppe, tjekkes kun på den gruppe i 1,6-reglen, ikke også på sit eget felt Forsikring. Før kom samme problem som to advarsler (fx gruppe 10 og UT1 i eksemplet Parcelhus).
- Røgtesten: tjek af, at undertavlens egen forsikring ikke giver en advarsel.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 12.

## 10.12.1 · 2026-11-16 · Claude Fable

Gennemgang af 10.11.0 og 10.12.0 (håndregning og browser).

- I<sub>k,min</sub> vises nu rundet ned. Før kunne fx 159,6 A stå som "I<sub>k,min</sub> 160 A er under I<sub>a</sub> 160 A". Selve beregningen og advarslen er uændret.
- Røgtesten: tjek af afrundingen.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 12.

## 10.12.0 · 2026-11-16 · Claude Fable

Forslag til fasefordeling (forslag 13). Plan: `docs/planer/2026-11-16-fasefordeling.md`.

- Knappen "Foreslå fasefordeling" på hver tavle i Beregning viser et forslag: lasten pr. fase nu og med forslaget, og hvilke grupper der flyttes. Intet ændres, før man vælger "Anvend forslag". Bagefter kan det fortrydes.
- Knappen erstatter "Balancér faser automatisk", som ændrede faserne med det samme. Linket i advarslerne åbner også forslaget.
- Giver forslaget ikke en bedre balance end den nuværende, siger appen det og foreslår ingenting.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 12.

## 10.11.0 · 2026-11-16 · Claude Fable

Kortslutningsstrøm og selektivitet (forslag 12 og 14). Plan: `docs/planer/2026-11-16-kortslutning-selektivitet.md`.

- Tavlen har to nye felter: Z<sub>e</sub> (Ω) og prospektiv I<sub>k,maks</sub> (kA). En undertavle uden egen Z<sub>e</sub> regnes fra den forsynende tavle gennem tilgangskablet.
- Beregning viser I<sub>k,min</sub> i hver gruppes yderste punkt: 0,95 · 230 V / (Z<sub>e</sub> + R<sub>fase</sub> + R<sub>PE</sub>), med ledermodstanden ganget med 1,2 (PVC, PKAJ, PKL) eller 1,28 (XLPE, Brandkabel) og PE som faseleder. Er I<sub>k,min</sub> under I<sub>a</sub> (5/10/20 × I<sub>n</sub> for B/C/D), kommer der en advarsel. Uden Z<sub>e</sub> vises I<sub>k</sub> ikke.
- Gruppen har feltet Brydeevne (standard 6 kA). Er I<sub>k,maks</sub> ved tavlen større, kommer der én advarsel pr. tavle.
- Selektivitet: advarsel, når tavlens forsikring er under 1,6 × den største efterfølgende sikring, og når en gruppe, der forsyner en undertavle, er under 1,6 × undertavlens største gruppe.
- HPFI har afkrydsningen "Selektiv (type S)". To HPFI'er i serie (undertavle forsynet fra en gruppe med HPFI) giver en advarsel, medmindre den forreste er type S med mindst 3 × I<sub>Δn</sub>.
- Resultaterne står i Beregning, i advarslerne og i dokumentationen under "Kortslutning og selektivitet". Alt er vejledende.
- Datamodel: `SCHEMA` 12 med `tavler.ze`, `tavler.ikMaks`, `grupper.brydeevne` og `rcds.selektiv`. Ingen felter er fjernet. Første start tager en backup.
- Røgtesten: opgradering fra skema 11 og kendte tal for I<sub>k,min</sub>, brydeevne og selektivitet.

## 10.10.0 · 2026-11-16 · Claude Sonnet

Print og PDF. Plan: `docs/planer/2026-11-16-print-pdf.md`.

- Knappen "Udskriv / gem som PDF" under Dokumentation → Eksport åbner dokumentationen i et nyt vindue og starter udskrivning. HTML-filen kan stadig hentes.
- Firmanavn, CVR, adresse, telefon og logo står øverst på dokumentationen. Oplysningerne gemmes én gang i browseren (ny nøgle `tavleoversigt.firma`), gælder alle projekter og synkroniseres ikke. Logoet skaleres til højst 400 px i bredden.
- Underskriftsfelt sidst i dokumentationen: montør og KLS-ansvarlig, hver med navn, dato og underskrift (aftalt med Alexander).
- Layout til A4 (`@page`, 15 mm margen), rækker og diagrammer deles ikke på tværs af sider, og overskrifter står ikke alene nederst på en side.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 11.

## 10.9.0 · 2026-11-16 · Claude Opus

Gendan fra Gist-historik. Plan: `docs/planer/2026-11-16-gist-historik.md`.

- Knappen "Tidligere versioner af dette projekt" i synkroniseringspanelet viser de versioner af det aktive projekt, som GitHub har gemt i Gist'en, med dato, kunde og antal grupper og brugsgenstande. Samme indhold i flere versioner i træk vises én gang, og den version, der svarer til projektet nu, er markeret.
- En version gendannes som et nyt projekt med "(fra <dato>)" i navnet. Det aktive projekt overskrives aldrig. Versioner gemt af en nyere version af appen kan ikke gendannes.
- Versionerne hentes 15 ad gangen med "Hent ældre versioner". Kræver net.
- Ny fil `js/historik.js`. Røgtesten har en falsk versionshistorik i GitHub-API'et.

## 10.8.0 · 2026-11-16 · Claude Sonnet

Materialeliste. Plan: `docs/planer/2026-11-16-materialeliste.md`.

- Nyt panel øverst i fanen Kabler, som samler hele projektet til en bestillingsliste: kabler (meter pr. type, ledere og tværsnit, rundet op), datakabler for sig, samlepunkter, afbrydere (med betjeningssteder for korrespondance og kryds), automatsikringer, HPFI og brugsgenstande. Tomme grupper vises ikke, og lokalefilteret gælder ikke.
- Knappen "Kopiér materialeliste til regneark" kopierer listen som tabulatorsepareret tekst (Gruppe, Materiale, Antal, Enhed). Panelet kan foldes sammen og ud.

## 10.7.0 · 2026-11-16 · Claude Opus

Mobiltilstand. Plan: `docs/planer/2026-11-16-mobil.md`.

- Måleskemaet vises på telefonen som ét kort pr. gruppe med store felter, taltastatur, grænse under hvert felt, vurdering og stor afkrydsning for visuel kontrol. Tabellen bruges som før på større skærme og i dokumentationen.
- Hovedet presses ikke længere sammen på tablets og smalle vinduer. Titel og værktøjer står under hinanden under 1024 px.
- Fanerne er én række, der kan rulles sidelæns på telefon og tablet, i stedet for op til 5 rækker. Den valgte fane rulles frem. Farveforklaringen skjules på telefonen.
- Nøgletallene står tre pr. række på telefonen.
- Felter har 16 px skrift på telefonen, så iPhone ikke zoomer ind, og knapper er mindst 40 px høje på touchskærme.
- Måleskemaet er altid lyst som papir, også i mørkt tema (afkrydsningsfelterne var mørke).
- Kontrolleret: desktop (1300 px) er uændret, 105.440 elementer i lyst og mørkt tema uden stilforskelle. Røgtesten kører appen i 390 px bredde.

## 10.6.0 · 2026-11-16 · Claude Opus

Offline-app. Plan: `docs/planer/2026-11-16-offline.md`.

- Appen kan installeres på hjemmeskærmen (Android, iPhone, Chrome og Edge på computeren) og åbner som en app uden adresselinje. Nyt panel "App på telefon og computer" under Dokumentation med installér-knap og vejledning til iPhone.
- Appen virker uden net, når den har været åbnet én gang med net. En service worker (`sw.js`) gemmer app-filerne. Online hentes altid nyeste version.
- Synkronisering venter uden fejl, når der ikke er net, og kører, så snart der er net igen. Hovedet viser "offline, synkroniserer når der er net".
- Ikon med appens lyn på accentfarven.
- Røgtesten starter appen på localhost, går offline og genindlæser, og kontrollerer at `VERSION` i `sw.js` passer, og at alle app-filer gemmes.

## 10.5.0 · 2026-11-16 · Claude Opus

Tailwind bygges nu som en almindelig CSS-fil i stedet for at køre fra CDN. Ingen ændring af udseende eller data.

- `css/tailwind.css` (12 KB) erstatter Tailwind-CDN'et (ca. 300 KB JavaScript, der genererede CSS ved hver indlæsning). Appen indlæses hurtigere, især på telefonen, og advarslen i konsollen er væk.
- Bygges med `python tools/byg_css.py`, som bruger Tailwinds officielle program v3.4.17. Opsætningen er flyttet fra `js/tailwind.config.js` til `tailwind.config.js`.
- Kontrolleret mod CDN-versionen: 112.082 elementer på alle faner og formularer, lyst og mørkt tema, 29 stilegenskaber, ingen forskelle.
- Røgtesten fejler, hvis `css/tailwind.css` ikke er bygget efter seneste ændring.
- `CLAUDE.md`: regel om at bygge CSS'en og skrive klassenavne helt ud.

## 10.4.0 · 2026-11-16 · Claude Fable

Afbrydere i enstregsdiagrammet, krydsafbryder og tændingsdiagrammer i dokumentationen. Plan: `docs/planer/2026-11-16-afbrydere-diagrammer.md`.

- Ny afbrydertype **Krydsafbryder** (`kryds`) til lys, der betjenes fra 3 til 6 steder: en korrespondanceafbryder i hver ende og en krydsafbryder for hvert sted imellem. Tændingsdiagrammet kan simuleres som de andre typer: hvert klik på et betjeningssted skifter lyset.
- Enstregsdiagrammet viser altid afbryderne med installationssymboler efter DS/EN 60617 på lederen foran de lamper, de styrer. En afbryder uden lamper står på sin egen række under gruppen. Klik viser detaljer, dobbeltklik åbner redigering, og sporingen går gennem afbryderen. Vælges en afbryder, fremhæves dens lamper. Afbryderne er også med i SVG-eksporten.
- Dokumentationen har et nyt afsnit "Tændingsdiagrammer" med ét diagram pr. afbryder i udgangsstilling (lyset slukket) med navn, type, gruppe, lokale og lamper.
- "Spor" på hver afbryder under Tændingsdiagram og i søgningen.
- `SCHEMA` er hævet til 11, fordi ældre versioner ikke kan vise en krydsafbryder. Ingen felter er ændret, og eksisterende afbrydere er uændrede. Første start tager en automatisk backup.
- Røgtest: krydsafbryder med 3 og 4 steder, afbrydere i `sld(true)`, et tændingsdiagram pr. afbryder i `docHtml()`, opgradering fra skema 10 og regression på eksempelprojekternes tændingsdiagrammer (`tests/regression-taending.json`).

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
