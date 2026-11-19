# Ændringshistorik

Nyeste øverst. Versionsnummeret står også i appen som `APP_VERSION`. Hver version siger, hvilken model der lavede den.

## 10.25.0 · 2026-11-19 · Claude Sonnet

Føringsvej: grupper foldet sammen og samlet længde. Plan: `docs/planer/2026-11-19-foering-fold-laengde.md`.

- **Grupper er foldet sammen som standard** i fanen Føringsvej. Tryk ▸ for at folde en gruppe ud. Knapperne **Fold alle ud** og **Fold alle sammen** over listen. Ved filteret "Kun ikke trukket" eller lokalefilter foldes grupper med træf automatisk ud, og "fra …" folder gruppen ud, før der rulles.
- **I alt** ved brugsgenstande og afbrydere: samlet kabellængde fra tavlen (uden tilgangskablet) gennem dåser og sløjfer. Vises kun, når der er led foran.
- Foldningen gemmes ikke i projektet. Ingen ændring i datamodellen.

## 10.24.0 · 2026-11-19 · Claude Opus

- **Klon lokale** åbner nu en dialog: vælg navnet på det nye lokale, og vælg for hver gruppe i lokalet, hvilken gruppe kopierne skal på (eller Ikke tildelt). Forbindelser til dåser og sløjfer uden for lokalet beholdes kun, hvis de ligger i den nye gruppe.
- **Duplikér brandlukning**: kopien får næste ledige nummer og samme lokale, placering, beskrivelse, brandklasse og produkter. Udført, mærkat, note og billeder kopieres ikke.
- **Produkter ved brandlukning**: afkrydsning af FR Brandkit, FR Brandplade, FR Gipsmørtel, FR Manchet, FR Pakning, FR Akryl, FR Grafit, FR Brandspjæld og FR Trækrør (flere kan vælges). Fritekstfeltet "Andet produkt" findes stadig. Begge vises i listen og dokumentationen.
- **Gentag** (↷) til højre for Fortryd, også med Ctrl+Y eller Ctrl+Shift+Z. Gentag-listen tømmes ved en ny ændring.
- Røgtesten læser `SCHEMA` fra `js/data.js` i stedet for et fast tal.
- Datamodel: `SCHEMA` 17 med `brandlukninger.produkter[]`. Ingen felter er fjernet. Første start tager en backup.

## 10.23.0 · 2026-11-18 · Claude Opus

Billeder på tavler, lokaler og samledåser, oprydning af billeder og mange billeder (forslag 15, 20 og 21). Plan: `docs/planer/2026-11-18-billeder.md`. **Skema 16.**

- **Billeder på tavler, lokaler og samlepunkter** (fx placeringen af en skjult dåse): "Tag billede" og "Vælg billeder" i formularerne, som ved brandlukning. Formularerne bruger nu ét fælles billedfelt. Miniaturer i tavlens hoved, på lokalets kort og i listen over samlepunkter. Tryk viser billedet i fuld størrelse. Duplikering og serier kopierer ikke billeder.
- Dokumentationen får afsnittet **Billeder** med små billeder pr. tavle, lokale og samlepunkt.
- Billederne synkroniseres og kommer med i backupfilen som brandlukningernes billeder.
- **Mange billeder:** højst 250 billeder pr. billed-Gist. Derefter oprettes en ny. Svaret på en upload læses ikke længere, så billederne ikke hentes ned igen. Første synkronisering i en session kontrollerer listen og sender et brugt billede igen, hvis det mangler på GitHub.
- **Lageradvarsel**, når browserens lager er over 80 % fuldt eller har under 50 MB tilbage (`navigator.storage.estimate`). Vises ved billedfeltet, på fanen Brandlukning og under Datasikring.
- **Find ubrugte billeder …** under Datasikring: finder billeder på enheden og i billed-Gists, som intet projekt i browseren, ingen automatisk backup, fortryd-listen og intet projekt i kontoens projekt-Gists (andre enheder) bruger. Viser antal og størrelse og sletter først efter bekræftelse. Kan noget ikke læses, slettes intet. Billeder på enheden, der er nyere end 24 timer, røres ikke. Gist'ens historik tjekkes ikke, og det står i dialogen.
- Datamodel: `billeder[]` på `tavler`, `lokaler` og `daaser`. Første start tager automatisk en backup. Ingen eksisterende felter er ændret.
- Røgtesten har nye tjek for opgradering fra skema 15, billeder i formularer, lister og dokumentation, synk, nye billed-Gists ved grænsen, lageradvarsel og oprydning.

## 10.22.0 · 2026-11-18 · Claude Opus

Enstregsdiagram: træk for at flytte en forbindelse, og Tilgang i serie. Plan: `docs/planer/2026-11-18-enstreg-traek.md`.

- **Træk for at flytte en forbindelse:** hold en brugsgenstand nede et øjeblik (mus eller finger), og træk den hen på en anden brugsgenstand (så bliver den sløjfet derfra), en dåse eller gruppen (direkte fra gruppen). Mens man trækker, er de mulige mål stiplet, målet under pointeren er fremhævet, og et mærke viser fx "Stik A1 → Tilgang". Kredse og andre grupper afvises med en forklaring. Ændringen kan fortrydes, fx "Stik A1 er nu sløjfet fra Tilgang."
- Et almindeligt træk panorerer stadig, og to fingre zoomer stadig. En finger nummer to afbryder et træk.
- **Flyt til …** i infopanelet for en valgt brugsgenstand gør det samme uden træk, til små skærme.
- **Tilgang i serie:** Tilgangens symbol sidder nu på linjen mellem gruppeafbryderen og brugsgenstandene, som et mellemled ligesom en dåse. Det, der er sløjfet fra Tilgangen, udgår fra skinnen efter symbolet.
- Ingen ændring af datamodellen (skema 15).

## 10.21.0 · 2026-11-18 · Claude Sonnet

Afleveringstjek og tavlefortegnelse (forslag 10 og 11). Plan: `docs/planer/2026-11-18-aflevering-fortegnelse.md`. Ingen ændring af datamodellen (`SCHEMA` uændret).

- **Klar til aflevering?** øverst i fanen Fejlfinder: antal og lister for grupper uden brugsgenstande, brugsgenstande uden gruppe, kabel eller længde, manglende eller fejlede målinger og visuel kontrol, tavler uden tilgangskabel eller Z<sub>e</sub>, kabler der ikke er trukket, brandlukninger der ikke er udført eller mangler mærkat, samt beregningsadvarsler. Klik på en linje går til gruppen eller åbner formularen. Grøn status, når intet mangler.
- Dokumentationen får en linje "Afleveringstjek: n punkter mangler" på forsiden, kun hvis noget mangler.
- **Tavlefortegnelse**: knap pr. tavle i fanen Tavle og under Dokumentation → Eksport. A4-side med gruppenummer, betegnelse, sikring, faser, HPFI, lokaler og brugsgenstande i stor skrift, samt firmanavn og dato. Åbnes i nyt vindue og udskrives som dokumentationen.
- Ny fil `js/aflevering.js`. Røgtesten har fem nye tjek.

## 10.20.0 · 2026-11-18 · Claude Sonnet

Import fra regneark (forslag 16). Plan: `docs/planer/2026-11-18-import-regneark.md`.

- Knappen **Importér fra regneark** i fanen Lokaler og i fanen Kabler åbner en dialog, hvor celler indsættes fra Excel (tabulator; semikolon og komma accepteres). Vælg Brugsgenstande eller Lokaler.
- Første linje bruges som overskrifter, hvis den genkendes (navn, lokale, gruppe, effekt, kW, A, kabel, ledere, tværsnit, længde, placering, højde; etage for lokaler), uden hensyn til store/små bogstaver og æøå. Ellers vælges kolonnerne med en dropdown pr. kolonne.
- Komma-decimaler læses som tal. kW og A omregnes til W som i formularen. Uudfyldte felter får samme standardværdier som en ny brugsgenstand.
- Forhåndsvisning før noget oprettes, med røde fejl (ukendt kabeltype, gruppe, tavle, lokale, ledere eller tværsnit, manglende navn). Rækker med fejl oprettes ikke. Ukendte lokaler kan oprettes automatisk.
- "Importér N rækker" opretter alt i én handling, som kan fortrydes med Fortryd.
- Ny fil `js/import.js` (`APP_IMPORT`). Ingen ændring af datamodellen (`SCHEMA` 15).

## 10.19.0 · 2026-11-18 · Claude Sonnet

Tydeligere tilhørsforhold i Føringsvej og beregnet Z<sub>e</sub> vist (forslag 19). Plan: `docs/planer/2026-11-18-foering-tydelig.md`. Ingen ændring af data, beregninger eller `SCHEMA`.

- Føringsvej: trælinjer (├ └ og lodrette linjer pr. niveau) i stedet for indrykning alene.
- "fra …" / "sløjfe fra …" ved posterne; tryk på teksten ruller til forælderen og blinker den.
- Hold musen over eller tryk på en post: forældrene op til tavlen fremhæves.
- Fold sammen/ud (▸/▾) pr. tavle, gruppe og post med børn. Huskes kun i appen, ikke i projektet.
- Beregning og dokumentation: en undertavle uden egen Z<sub>e</sub> viser den beregnede værdi med "(beregnet fra forsynende tavle)".

## 10.18.0 · 2026-11-18 · Claude Opus

Ny fane Brandlukning med billeder. Plan: `docs/planer/2026-11-18-brandlukning.md`.

- Ny fane **Brandlukning** (sidst i fanerækken) til registrering af brandtætning af huller og gennemføringer i brandvægge og brandceller. Hver lukning har nummer (næste ledige foreslås), lokale, placering, beskrivelse, brandklasse, produkt, note, afkrydsningerne **Udført** og **Mærkat** og billeder.
- Afkrydsningerne sættes direkte i listen. Filteret "Kun ikke udført / mangler mærkat", lokalefilteret og optællingen "Udført x af y" og "Mærkat x af y" virker sammen. Sletning kan fortrydes, og søgningen finder lukningerne.
- Billeder: "Tag billede" åbner kameraet direkte på telefonen, og "Vælg billeder" henter flere fra galleriet. Billederne gøres mindre i browseren (JPEG, højst 1600 px, typisk 100–300 KB) og gemmes i IndexedDB-databasen `tavleoversigt-billeder`, ikke i localStorage. Projektet gemmer kun id'erne. Tryk på en miniature viser billedet i fuld størrelse.
- Synkronisering: billederne sendes til en separat hemmelig Gist, så projekt-Gist'en stadig er lille og hurtig. Kun billeder, som Gist'en ikke har, sendes, og manglende billeder hentes via `raw_url`. Billeder slettes aldrig automatisk, hverken på enheden eller på GitHub.
- Backupfilen indeholder nu billederne. Projekt-JSON og de automatiske backups i browseren har kun billedernes id'er, og det står ved knapperne.
- Dokumentation og udskrift: nyt afsnit **Brandlukninger** med status, optælling og små billeder.
- Datamodel: `SCHEMA` 15 med listen `brandlukninger`. Ingen felter er fjernet. Første start tager en backup.

## 10.17.0 · 2026-11-18 · Claude Opus

Gruppetypen "Lys og stik" og 1-faset tilslutning på 3-faset gruppe. Plan: `docs/planer/2026-11-18-lysstik-fase.md`.

- Ny gruppetype **Lys og stik** til installationer med både lys og stikkontakter. ΔU-grænsen er 3 % som for lys, og samtidighedsfaktoren foreslås som lys-værdien for installationstypen. Typen har sin egen farve (oliven) i lyst og mørkt tema, kan vælges i filtre, formularer og skabeloner, og en Lys og stik-gruppe forvælges til afbrydere ligesom lys.
- Brugsgenstand på en 3-faset gruppe: nyt felt **Tilslutning** (Som gruppen, L1, L2 eller L3 og nul, 230 V), fx et 5G-kabel med kun én fase og nul tilsluttet. Strømmen er P/230, ΔU for eget træk regnes 1-faset (2·L, 230 V), I<sub>z</sub> med 2 belastede ledere, og strømmen lægges kun på den valgte fase i fasebalance, fasefordeling og tavlens fasestrømme.
- Sløjfer og dåser med blandede 1- og 3-fasede brugsgenstande regnes pr. fase (værst belastede fase med nulstrømmens bidrag). Ved symmetrisk last er tallene uændrede.
- Fasen vises som "L2, 230 V" i gruppens liste, kabeltabellen og dokumentationen. Beregning viser fasestrømmene for 3-fasede grupper med 1-fasede tilslutninger.
- Datamodel: `SCHEMA` 14 med `enheder.fase` (standard `''` = som gruppen). Ingen felter er fjernet. Første start tager en backup.

## 10.16.0 · 2026-11-18 · Claude Opus

Plan: `docs/planer/2026-11-18-enstreg-sloejfer.md`.

- Enstregsdiagram: sløjfer vises, som de er trukket. En brugsgenstand sløjfet fra en anden tegnes lige under den, med en prik på stregen, hvor sløjfen går fra. Fire udtag, der hver er sløjfet videre og ned til sin egen stikkontakt, vises som udtag 1, stik 1, udtag 2, stik 2 … Sporing og lokalefilter følger sløjfekæden. Gælder også diagrammet i dokumentationen.
- Ny brugsgenstand **Tilgang** (symbol: rombe med prik). Navnet "Tilgang …" giver symbolet automatisk, og effektforslaget er 0 W. Andre brugsgenstande sløjfes fra den. Den tælles ikke som brugsgenstand i nøgletal og materialeliste, men kablet tælles med.
- Enstregsdiagram på mobil: zoom og panorér med to fingre. Knapperne − og + er uændrede.
- Touchskærme: alle felter har mindst 16 px skrift uanset bredde, så iPhone ikke zoomer ind ved indtastning. `maximum-scale` er ikke brugt, så siden stadig kan zoomes.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 13.

## 10.15.0 · 2026-11-17 · Claude Opus

- Føringsvej: knappen **Slet** på brugsgenstande og afbrydere. Sløjfer efter en slettet brugsgenstand forsynes derefter fra den, den selv var sløjfet fra. Sletningen kan fortrydes.
- Føringsvej: tryk på kablet (fx "PVC 3G2,5 mm² · 4 m") for at rette kabeltype, ledere, tværsnit og længde direkte i oversigten. Enter gemmer, og Esc annullerer. Ændringen kan fortrydes.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 13.

## 10.14.0 · 2026-11-17 · Claude Opus

- Samtidighedsfaktor: forslaget i gruppeformularen og knappen ▾ ved faktoren i Beregning åbner en liste med typiske faktorer. Listen viser forslaget, samme gruppetype for hver installationstype og særtilfældene (én belastning, varme og ladning, omklædning). Et klik sætter faktoren. Værdierne er de samme vejledende værdier som før; ingen nye.
- Sløjf efter hinanden: ved flere brugsgenstande med "Sløjf efter hinanden" vælges sløjfekablet mellem dem (kabeltype, ledere, tværsnit og længde pr. sløjfe). Kablet i formularen går til den første.
- Ingen ændring af datamodellen. `SCHEMA` er uændret 13.

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
