# Plan: Fanen Brandlukning med billeder

Planlagt og implementeret af Claude Opus 2026-11-18 efter aftale med Alexander. Opus udfører selv opgaven, fordi den ændrer datamodellen, lagringen og synkroniseringen, hvor fejl kan koste data (CLAUDE.md afsnit 1).

Branch: `claude/brandlukning`. Denne opgave er den eneste, der ændrer datamodellen og hæver `SCHEMA` (14 → 15). Ingen andre sessioner kører.

## Formål

Registrering af brandtætning af huller og gennemføringer ind i og igennem brandvægge og brandceller, med status og billeder taget på pladsen.

## Datamodel (skema 15)

Ny liste `brandlukninger` i projektet. Felter aftalt med Alexander 2026-11-18:

| Felt | Type | Standard i `norm()` |
|---|---|---|
| `id` | tekst | uændret |
| `nr` | heltal > 0 | løbenummer efter placering i listen, hvis det mangler |
| `lokaleId` | tekst | `''` |
| `placering` | fritekst | `''` |
| `beskrivelse` | fritekst | `''` |
| `brandklasse` | fritekst, fx EI60 | `''` |
| `produkt` | fritekst | `''` |
| `udfoert` | ja/nej | `false` |
| `maerkat` | ja/nej | `false` (brandmærkat sat ved siden af lukningen) |
| `note` | fritekst | `''` |
| `billeder` | liste af billed-id'er | `[]`. Ugyldige id'er og dubletter fjernes |

Ældre projekter får `brandlukninger: []`. Ingen eksisterende felter ændres. Første start på skema 15 tager automatisk en backup (`lavBackup`) som ved tidligere hævninger.

## Billeder

### Komprimering

I browseren med canvas: længste side højst 1600 px, JPEG kvalitet 0,7. Bliver filen over ca. 300 KB, prøves kvalitet 0,55 og derefter 1280 px. Samtidig laves en miniature (længste side 320 px, kvalitet 0,6, ca. 15–25 KB) til listen og dokumentationen. Browseren drejer selv billedet efter EXIF.

### Lagring i IndexedDB

Ny database `tavleoversigt-billeder` (version 1) med to tabeller:

- `billeder`: `{ id, data }`, hvor `data` er JPEG som data-URL (`data:image/jpeg;base64,…`).
- `mini`: `{ id, data, oprettet }` med miniaturen.

Projektet gemmer kun id'erne. Miniaturerne læses ind i hukommelsen ved start, så listen og `docHtml()` kan vise dem uden at vente. localStorage bruges ikke til billeder.

### Sletning

Billeder slettes aldrig automatisk, hverken i IndexedDB eller i Gist'en. Fjernes et billede fra en lukning, eller slettes lukningen, bliver billedet liggende. Det gør, at fortryd, gamle backups og projekter på andre enheder stadig har deres billeder. Oprydning af billeder, som intet projekt bruger, er skrevet som forslag i `docs/forslag.md`.

### Synkronisering: egen Gist til billeder

**Valg:** Billederne lægges i en **separat hemmelig Gist** på samme konto, ikke i projekternes Gist. Begrundelse:

1. GitHub sender indholdet af alle filer med, når en Gist hentes (`GET /gists/<id>`). Projekt-Gist'en hentes 4 sekunder efter hver ændring. Med 20 billeder på ca. 300 KB ville hver synkronisering hente omkring 6 MB, hvilket er for meget på mobilnet på pladsen.
2. API'et viser højst 300 filer pr. Gist. Lå billederne i projekt-Gist'en, kunne et projekt falde uden for listen. Synkroniseringen ville så tro, at projektet var slettet på en anden enhed. Med en egen Gist kan billederne aldrig skubbe projekterne ud.

Projekt-Gist'ens format er uændret, så der er kun tale om en udvidelse (afsnit 1, punkt 4).

| Billed-Gist | Indhold |
|---|---|
| `tavleoversigt-billeder.json` | Markør: `{ format:'tavleoversigt-billeder', app, schema, opdateret }` |
| `tavleoversigt-billede-<id>.txt` | Ét billede som data-URL (JPEG, base64) |

Gangen i `billedSynk()`, der kører efter en vellykket `synkKoer()` i `synkNu()`:

1. Find alle billed-id'er, som de lokale projekter bruger. Sammenlign dem med IndexedDB og med `synk.bSendt`, der er listen over id'er, som vides at ligge i en billed-Gist.
2. Er intet at sende eller hente, sker der ingen kald til GitHub.
3. Ellers hentes listen over brugerens Gists (`GET /gists?per_page=100`). Den giver filnavne og `raw_url` uden indhold. Alle Gists med markørfilen tæller. Har to enheder hver oprettet en billed-Gist, findes billederne derfor i begge.
4. Har en billed-markør et højere skema end appen, røres billederne ikke, og der vises en fejl (skemareglen).
5. **Upload:** kun billeder, der hverken står i `bSendt` eller findes i en billed-Gist. De sendes i én eller flere `PATCH` på højst ca. 4 MB. Findes der ingen billed-Gist, oprettes en (`POST /gists`, hemmelig).
6. **Hent:** manglende billeder hentes via `raw_url` med `fetch`. Det gælder også filer, som API'et har afkortet (`truncated`). Indholdet kontrolleres (skal være `data:image/…;base64,`), og der laves en miniature, før billedet gemmes i IndexedDB. Et billede, der ikke findes i nogen billed-Gist, forsøges kun én gang pr. session.
7. Fejl i billedsynkroniseringen vises som synkroniseringsfejl. Projekterne er på det tidspunkt allerede synkroniseret.

`tavleoversigt.sync` får to nye felter: `bGist` (id på denne enheds billed-Gist) og `bSendt` (id'er). Nøglen omdøbes ikke.

Kendte grænser, som skrives i appen og dokumentationen: Svaret på en `PATCH` indeholder hele billed-Gist'en, så upload bliver langsommere, jo flere billeder der er. Over ca. 300 billeder pr. billed-Gist kan GitHub-listen blive afkortet. Det giver ikke tab af projektdata, men nogle billeder kan så ikke hentes på andre enheder. Begge dele står som forslag i `docs/forslag.md`.

### Backup og eksport

**Valg:** Backupfilen ("Hent backup af alle projekter") **indeholder billederne** som `billeder: { <id>: <data-URL> }` for alle billeder, de eksporterede projekter bruger. Ved indlæsning af en backup gemmes billeder, der mangler i IndexedDB, og eksisterende billeder overskrives ikke.

- "Hent projekt som JSON" og "Kopiér JSON" er uden billeder. Det står ved knapperne. Projekt-JSON'en indeholder kun id'erne, og billedet vises som manglende, hvis det ikke findes på enheden.
- De automatiske backups i localStorage (`tavleoversigt.backups`) indeholder kun id'erne. Billederne ligger urørt i IndexedDB.

## Fanen Brandlukning

Ny fane `brand` med navnet "Brandlukning". Den lægges sidst, så tasterne 1–0 til de eksisterende faner er uændrede.

- Kort pr. lukning (på mobil én kolonne): nummer, placering, lokale, beskrivelse, brandklasse og produkt, note, miniaturer og afkrydsningerne **Udført** og **Mærkat** som store afkrydsningsfelter, der gemmes direkte i listen. Tryk på en miniature viser billedet i fuld størrelse.
- Lokalefilteret (`lokF`) virker. Afkrydsningen "Kun ikke udført / mangler mærkat" viser lukninger, hvor mindst én af de to mangler.
- Optælling, der følger lokalefilteret: "Udført x af y" og "Mærkat x af y".
- Knappen "+ Brandlukning" åbner formularen. Nummeret foreslås som største nummer + 1. Lokalet forvalges fra lokalefilteret.
- Formular (`modal.type === 'brand'`): nummer, lokale (med "+ Opret nyt lokale …"), placering, beskrivelse, brandklasse (forslag EI30/EI60/EI90/EI120 og flere, men fritekst), produkt (forslag fra projektets egne tidligere værdier), udført, mærkat, note og billeder.
  - "Tag billede" bruger `<input type="file" accept="image/*" capture="environment">`.
  - "Vælg billeder" bruger `<input type="file" accept="image/*" multiple>` uden `capture`, så galleriet kan bruges.
  - Et billede kan fjernes fra lukningen med ×.
- Sletning fra formularen kan fortrydes (`mutate` + besked med Fortryd), som andre elementer.
- Sletning af et lokale nulstiller lukningernes `lokaleId`. Søgningen finder også brandlukninger.

## Dokumentation og udskrift

`docHtml()` får afsnittet "Brandlukninger", hvis projektet har nogen. Det er en tabel med nr., lokale, placering, beskrivelse, brandklasse, produkt, udført, mærkat og note. Billederne vises som små miniaturer (højst 22 mm høje), og øverst står optællingen. Billeder, der mangler på enheden, står som "billede mangler på denne enhed".

## Filer

| Fil | Ændring |
|---|---|
| `js/data.js` | `SCHEMA` 15, `tom()`, `norm()`, konstanter for billed-DB og billed-Gist |
| `js/billeder.js` (ny) | `APP_BILLEDER`: IndexedDB, komprimering, miniaturer, billedsynk, backup af billeder |
| `js/brand.js` (ny) | `APP_BRAND`: fanens filtre, optælling, formular, gem, dokumentationsafsnit |
| `js/lagring.js` | `synkNu` kalder `billedSynk`, `synkLaes` får nye felter, backup med billeder, `docHtml` |
| `js/app.js` | fane, `modalNavn`, `saveForm`/`delCurrent`/`soeg`, `bland()`, start af billeder |
| `index.html` | fanen, formularen, billedvisning, tekst ved eksport, scripts |
| `sw.js` | nye filer i `SKAL` |
| `css/app.css` | små klasser til miniaturer og billedvisning |
| `tests/smoke.py` | test (se nedenfor), falsk API med flere Gists og `raw_url` |
| `CLAUDE.md`, `docs/ARKITEKTUR.md`, `CHANGELOG.md`, `docs/forslag.md` | nøgler, database, billed-Gist, historik, forslag |

## Test i `tests/smoke.py`

- Opgradering fra skema 14: projekt uden `brandlukninger` er intakt, backup taget, listen er tom.
- Oprettelse via formularen, foreslået nummer, afkrydsning direkte i listen (DOM), filter og optælling, lokalefilter, sletning og fortryd.
- Billede: genereret testbillede (2400 × 1800 PNG fra canvas) via `set_input_files` på begge inputfelter. Kontroller komprimering (JPEG, længste side 1600, 150–300 KB eller mindre for et enkelt billede), miniature og indhold i IndexedDB. Kontroller også `capture="environment"` på kamerafeltet.
- Synk: enhed 1 sender billedet til billed-Gist'en én gang. En ny synkronisering sender det ikke igen, heller ikke når `bSendt` er tømt, fordi Gist'en allerede har det. Enhed 2 henter projektet og billedet via `raw_url` (den falske API'ets liste har ligesom GitHub intet indhold) og viser miniaturen. Projekt-Gist'en indeholder ingen billeder. En billed-markør med nyere skema afvises.
- Backup: filen indeholder billedet og kan indlæses.
- Dokumentation: afsnittet med status og miniature som `<img src="data:image/jpeg…">`.
- Mobil: ingen vandret rulning på fanen, 16 px i felterne.

## Ikke testet automatisk

En rigtig telefon (kamera, HEIC fra iPhone, EXIF-rotation), den rigtige GitHub-Gist (CORS på `raw_url` for billeder, store svar) og pladsgrænser i IndexedDB på iOS.

## Resultat (2026-11-18)

Implementeret som planlagt i version 10.18.0. Røgtesten giver `OK`. Under implementeringen blev `form.billeder` i formularens markup sikret mod at blive læst, mens formularen skifter type, og miniaturerne genindlæses, når projektet ændres i en anden fane.
