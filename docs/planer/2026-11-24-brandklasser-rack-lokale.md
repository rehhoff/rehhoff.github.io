# Brandklasser som afkrydsning og nyt lokale fra rackskab

Planlagt og udført af Claude Opus 5.5 2026-11-24 (lille opgave, Opus må ændre koden direkte). Status: færdig.

## 1. Brandklasser som afkrydsning (skema 18)

Alexander ønsker brandklasserne som afkrydsningsfelter på samme måde som produkterne.

- `js/data.js`: `BRANDKLASSER` flyttes hertil fra `js/brand.js` (samme liste: EI15, EI30, EI45, EI60, EI90, EI120, EI240, E30, E60, E90, EI30-S, EI60-S). `SCHEMA` 17 → 18.
- Nyt felt `brandklasser[]` (afkrydsede fra `BRANDKLASSER`, i listens rækkefølge). Fritekstfeltet `brandklasse` bevares som "Anden brandklasse".
- Migrering i `norm()`, kun når `brandklasser` mangler: den gamle tekst deles ved mellemrum, komma, semikolon, skråstreg, plus og &. Svarer alle dele til en klasse i listen (store og små bogstaver er ligegyldige), flyttes de til `brandklasser`, og teksten tømmes. Ellers bliver teksten stående uændret, så intet går tabt.
- Formularen: fieldset med afkrydsning som Produkter, og fritekstfeltet "Anden brandklasse".
- Visning (kort, søgning, dokumentation): `brandKlasseTxt(b)` = afkrydsede plus fritekst.
- `tests/smoke.py`: tjek af afkrydsning, gem, dokumentation og migrering fra skema 17-data.

## 2. Nyt lokale fra rackskabets formular

Lokale-listen i rackskabets formular mangler "+ Opret nyt lokale …". Den tilføjes med `nyValg($event, 'lokale', 'lokaleId')` som i de andre formularer.

## Filer

`js/data.js`, `js/brand.js`, `js/app.js` (standardværdi og søgning), `index.html`, `tests/smoke.py`, `CHANGELOG.md`, `docs/ARKITEKTUR.md`, versionen fire steder.
