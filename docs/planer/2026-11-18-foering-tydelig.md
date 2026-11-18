# Plan: Tydelige tilhørsforhold i Føringsvej og beregnet Z<sub>e</sub> (forslag 19)

Planlagt af Claude Opus 2026-11-18. Udføres af Claude Sonnet, fordi det kun er visning og tekst. Der er ingen ændring af data eller beregninger.

## 1. Føringsvej

Problem (Alexander): ud fra indrykningen alene er det svært at se, hvor en sløjfet brugsgenstand kommer fra.

Ændringer i fanen Føringsvej (`foeringTrae` og `fv*` i `js/app.js`, sektionen `view==='foering'` i `index.html`, `.fv*` i `css/app.css`):

1. **Trælinjer** som i en filoversigt: lodrette hjælpelinjer for hvert niveau og ├ / └ ved hver post.
   - Beregn for hver række, om den er sidste barn, og hvilke forfædre der har flere søskende efter sig. Gør det i `foeringTrae`, fx felterne `sidst` og `linjer: [true, false, …]`.
   - Tegn linjerne med CSS: `border-left` i spalter pr. niveau, eller et lille inline-SVG.
   - Behold den mindre indrykning under 640 px.
2. **"fra …"-tekst** ved alle poster, der ikke kommer direkte fra deres forælder i træet, og altid ved sløjfer.
   - Tekst som "sløjfe fra Udtag A1" eller "fra PL-dåse PL2" i lille, dæmpet skrift ved navnet.
3. **Fremhævning**: når man holder musen over eller trykker på en post, fremhæves dens forælder og hele vejen op til gruppen med farven `--accent`.
   - Et tryk på "fra …"-teksten ruller til forælderen og blinker den kort.
4. **Fold sammen/ud** pr. tavle, gruppe og post med børn (▸/▾).
   - Tilstanden huskes pr. visning i et `Set` i app-tilstanden. Den gemmes ikke i projektet.
5. Lokalefilteret og "Kun ikke trukket" virker som før. Nedtonede forfædre vises stadig med trælinjer.

Tjek i den indbyggede browser ved 1300 og 390 px med et eksempel som Alexanders:
- 6 PL-dåser sløjfet i kæde
- vægudtag i kæde med hver sin stikkontakt
- afbrydere fra PL-dåser

Der må ikke være vandret rulning.

## 2. Forslag 19

En undertavle uden egen Z<sub>e</sub> viser den beregnede værdi (`tavleZe`) som "Ze ved tavlen" i Beregning og dokumentation (`docHtml` i `js/lagring.js`, kun den linje) med teksten "(beregnet fra forsynende tavle)". Fjern forslag 19 fra `docs/forslag.md`.

## Test (`tests/smoke.py`)

- Træet har korrekte `sidst`/`linjer` for en kæde og en forgrening.
- Sløjfer viser "sløjfe fra …".
- Fold sammen skjuler børnene.
- Teksten for beregnet Z<sub>e</sub> står i Beregning og i dokumentationen.

Røgtesten skal give `OK`.
