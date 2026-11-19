# Føringsvej: grupper foldet sammen og samlet længde

Planlagt af Claude Opus 2026-11-19. Udføres af **Claude Sonnet**: to afgrænsede ændringer i én fane med kendt kode, og det kræver ingen faglig fortolkning ud over det, der står her.

## Mål

1. Når fanen Føringsvej åbnes, er alle grupper foldet sammen. Man ser tavler og grupper og folder selv de grupper ud, man vil arbejde med.
2. Ved hver brugsgenstand (og afbryder) står den samlede kabellængde fra tavlen til genstanden.

## Berørte filer

- `js/app.js`: `foeringTrae()`, `fvToggle()`, tilstanden `fvFold`, og en ny metode `fvTotal(r)`.
- `index.html`: føringsvej-sektionen (omkring linje 432–490).
- `css/app.css`: kun hvis der mangler en klasse.
- `tests/smoke.py`: tjek 4h (omkring linje 479–512).
- `CHANGELOG.md` og `docs/ARKITEKTUR.md` ved merge.

Ingen ændring i datamodellen og intet nyt `SCHEMA`. Foldningen gemmes ikke i projektet.

## 1. Grupper foldet sammen som standard

I dag er `fvFold` et `Set` med de nøgler (`r.k`), der er foldet sammen, og alt andet er udfoldet.

- Tilføj tilstanden `fvAaben: new Set()` med de **grupper**, brugeren har foldet ud. En række med `kind === 'gruppe'` er foldet sammen, medmindre `r.k` står i `fvAaben`. Rækker af andre typer følger stadig `fvFold` som i dag (de er udfoldet som standard).
- Lav en hjælper `fvLukket(k)`: for en nøgle, der starter med `gruppe:`, er den `!this.fvAaben.has(k)`, ellers `this.fvFold.has(k)`. Brug den i `foeringTrae()` både til `r.luk` og til filtret til sidst (`!r.anc.some(a => this.fvLukket(a))`).
- `fvToggle(r)`: for en gruppe skiftes `fvAaben`, ellers `fvFold`. Lav som nu et nyt `Set`, så Alpine opdager ændringen.
- `fvGaa(k)` (knappen "fra …"): forælderen kan ligge i en sammenfoldet gruppe. Fold gruppen ud først. Gruppen er den forfader i rækkens `anc`, der starter med `gruppe:`. Kald derefter `scrollIntoView` i `$nextTick`.
- Når filtret "Kun ikke trukket" eller lokalefiltret er slået til, foldes grupper med træf automatisk ud. Ellers ser man kun grupperne og ingen træf. Det gøres i `foeringTrae()`: er `filt` sand, regnes en gruppe som åben.
- Tilføj to knapper i værktøjslinjen over listen: **Fold alle ud** (læg alle gruppenøgler i `fvAaben` og tøm `fvFold`) og **Fold alle sammen** (tøm `fvAaben`). Brug `btn btn-ghost` som de andre knapper.
- Ret hjælpeteksten (linje 438), så den nævner, at grupperne er foldet sammen, og at man trykker ▸ for at se dem.

## 2. Samlet længde fra tavlen

Ny metode `fvTotal(r)` i `js/app.js` lige efter `fvKabelTxt`. Den returnerer meter eller `null`.

- **enhed**: egen `laengde` + længden af alle brugsgenstande, den er sløjfet fra (`sloejfeVej(e)`) + længden af samledåserne fra roden (`enhedDaase(e)` og op gennem `parentId`). Det er samme vej som ΔU (`duOp`, `duSloejfe`) og I<sub>k</sub>.
- **afb** (afbryder): egen `laengde` + vejen til det sted, den sidder på: `fraEnhed` → den brugsgenstands `fvTotal`, ellers `daaseId` → dåsekæden.
- **daase**: egen `laengde` + forældredåserne. Det er nyttigt, men vis det kun for enhed og afbryder, som der er bedt om. Metoden må gerne kunne regne det.
- Tilgangskablet til tavlen (`tLaengde`) tælles **ikke** med. "Fra tavlen" betyder fra gruppens afgang i tavlen. Skriv det i hjælpeteksten: "Samlet længde fra tavlen, uden tilgangskablet".
- Hold øje med løkker: brug samme grænser som de eksisterende hjælpere (`n++ < 20` for dåser og `< 50` for sløjfer).
- Vis den i rækken for `kind === 'enhed'` og `kind === 'afb'` som et lille mærke lige efter kabelknappen: `<span class="tag num fv-total" title="Samlet længde fra tavlen (uden tilgangskablet)">I alt 23,5 m</span>`. Vis kun mærket, når der er mindst ét led før genstanden, dvs. når summen er større end genstandens egen længde. Ellers er det det samme tal to gange. Brug `fmt()`.

## Test

Udvid tjek 4h i `tests/smoke.py`:

- Den eksisterende test går til `foering` og forventer, at `#fv-enhed-f2` er synlig. Fold dens gruppe ud først (læg gruppens nøgle i `a.fvAaben`), eller brug **Fold alle ud**.
- Nyt tjek: efter `a.go('foering')` med tom `fvAaben` er der ingen rækker med `kind` `enhed`, `daase` eller `afb` i `foeringTrae()`, men alle grupper er med og har `luk === true`.
- Nyt tjek: `fvToggle` på en gruppe viser dens børn, og gentaget skjuler den dem igen.
- Nyt tjek: med `fvIkke = true` er grupper med ikke-trukne træk foldet ud.
- Nyt tjek af `fvTotal`: en brugsgenstand bag en dåse og en sløjfe giver dåse + sløjfe + egen længde, og en afbryder på en sløjfe giver sløjfens total + sin egen længde. Brug testens egne data (f1, f2, af).
- Testen fortsætter med at slette sine data bagefter.

Kør hele røgtesten, til den giver `OK`.

## Version

Minor (ny funktion). Sættes ved merge ud fra den aktuelle `main`, de fire steder, se CLAUDE.md afsnit 2.3.
