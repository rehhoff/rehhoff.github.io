# El-oversigtsappen

Webapp til elektrikere: tavler, grupper, lokaler, brugsgenstande, kabler, samlepunkter, afbrydere og svagstrøm i ét overblik, med beregninger, diagrammer og dokumentation.

**Åbn appen:** https://rehhoff.github.io/

## Funktioner

- Tavleskema med DIN-skinne, HPFI og automatsikringer. Undertavler fra tavle eller gruppe.
- Beregning af spændingsfald, kabelbelastning (I<sub>z</sub>), fasebalance, overlast og samtidighed.
- Enstregsdiagram og tændingsdiagram, der tegnes ud fra dataene.
- Samlepunkter med forgreninger, svagstrøm med rackskabe, PDS og CCTV.
- Effektforslag, skabeloner, batch-oprettelse, kloning, søgning og fejlfinder.
- Flere projekter, gruppeskema, måleskema og eksport.

Beregningerne er vejledende og erstatter ikke dimensionering efter DS/HD 60364.

## Dine data

Projekterne gemmes automatisk i din browser. De bliver liggende, når appen opdateres, og appen tager selv en backup i browseren, før data opgraderes.

Data følger browseren og enheden. Hent derfor jævnligt en backupfil under **Dokumentation → Datasikring**. Filen kan indlæses på en anden enhed eller i en anden browser uden at overskrive noget.

Har du projekter i den gamle Claude-artefaktversion, så hent dem som JSON der, og indlæs dem her under **Dokumentation → Import**.

## Udvikling

Hele appen er `index.html`. Der er ingen build.

```sh
npm install
python3 tests/smoke.py
```

Regler for ændringer, også for Claude, står i [CLAUDE.md](CLAUDE.md). Historikken står i [CHANGELOG.md](CHANGELOG.md), og opbygningen i [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md).
