# CLAUDE.md: El-oversigtsappen

Webapp til elektrikerarbejde: tavler, grupper, lokaler, kabler, samlepunkter, afbrydere og svagstrøm, med beregninger (ΔU, I<sub>z</sub>, fasebalance), diagrammer og dokumentation. Ejer: Alexander. Brugerfladen er på dansk.

- Live: https://rehhoff.github.io/ (GitHub Pages fra `main`, mappe `/`). Repoet er offentligt: skriv ingen personlige oplysninger i filer eller commits.
- Appen er p.t. én fil, `index.html` (Alpine.js 3.14.1 fra cdnjs, Tailwind fra CDN, intet byggetrin). Opdeling i moduler er foreslået i `docs/forslag.md`.
- Opbygning og datamodel: `docs/ARKITEKTUR.md`. Historik: `CHANGELOG.md`. Forslag og prioritering: `docs/forslag.md`. Planer: `docs/planer/`.

## 1. Data må aldrig gå tabt

Projekterne ligger i browserens localStorage på `rehhoff.github.io` og kan synkroniseres til en hemmelig GitHub Gist.

1. Omdøb eller fjern aldrig disse nøgler: `tavleoversigt.projekter`, `tavleoversigt.p.<id>`, `tavleoversigt.backups`, `tavleoversigt.tema`, `tavleoversigt.sync`, samt de gamle `tavleoversigt.v1` og `.v2`, som stadig migreres.
2. Ændres datamodellen: udvid `norm()` med standardværdier og migrering af gamle felter, og hæv `SCHEMA`. Første start efter en hævning tager automatisk en backup (`lavBackup`).
3. Slet aldrig et felt med brugerdata uden at flytte dataene først.
4. Synkronisering: en app med lavere `SCHEMA` end Gist'ens markørfil (`tavleoversigt.json`) må hverken læse eller skrive. Formatet i Gist'en (markør plus `tavleoversigt-<id>.json` pr. projekt) må kun udvides, aldrig omdøbes.
5. Hæves `SCHEMA`: tilføj et tjek i `tests/smoke.py` med data i det gamle format, som skal være intakte efter opgraderingen.

## 2. Arbejdsgang

1. Lav en branch fra `main`.
2. Ret koden. Hold samme design (farvetokens i `:root`, lyst og mørkt tema) og samme kodestil.
3. Hæv `APP_VERSION` i `index.html` og `version` i `package.json` (ny funktion = minor, rettelse = patch, større omlægning = major).
4. Tilføj et afsnit øverst i `CHANGELOG.md` med dato, version, model og ændringer. Opdater `docs/ARKITEKTUR.md`, hvis nøgler, felter, faner eller funktioner ændres.
5. Kør røgtesten. Den skal slutte med `OK`. På Alexanders Windows-PC (ingen npm, Python hedder `python`):
   ```
   pip install playwright
   python -m playwright install chromium
   mkdir -p node_modules/alpinejs/dist && curl -sfL https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js -o node_modules/alpinejs/dist/cdn.min.js
   python tests/smoke.py
   ```
   Med npm: `npm install` og `python3 tests/smoke.py`. Sæt `PYTHONIOENCODING=utf-8`, hvis æ, ø og å giver fejl i konsollen.
6. Commit med en beskrivelse på dansk, og nævn planen, hvis der er en. Push branchen.
7. Claude merger selv (aftalt med Alexander 2026-11-16), når røgtesten giver `OK`: `git checkout main && git pull && git merge --no-ff <branch>` og `git push origin main`. `gh` er ikke logget ind, så der bruges ingen pull request.
8. Efter merge: slet branchen lokalt og på GitHub (`git push origin --delete <branch>`), så `main` er den eneste branch, og kontrollér at `APP_VERSION` på https://rehhoff.github.io/ er den nye. Pages er 1–10 minutter om at opdatere. Fortæl Alexander, hvad der er udgivet.

## 3. Faglige regler

Faste lister, som ikke må ændres uden aftale:

- Kabeltyper: Brandkabel, XLPE, PVC, PKAJ, PKL. "Tilgangskabel" på tavlen er fritekst og skal blive ved med at være det.
- Samlepunkttyper: Membrandåse, Indmuringsdåse, Forfradåse, Underlag, Europadåse, PL-dåse.
- Datakabler under svagstrøm (Cat6, Cat6A, Cat7, fiber) er undtaget fra kabellisten.

Forudsætninger i beregningerne. Alt er vejledende og står også i appen:

- ρ = 0,0225 Ω·mm²/m, cos φ = 1, 230 V og 3 × 400 V.
- ΔU-grænse 3 % for lys og 5 % for øvrige (DS/HD 60364-5-52, anneks G). ΔU summeres gennem tilgangskabel, samledåser og afgang.
- I<sub>z</sub>: PVC-isoleret kobber, installationsmetode C, 30 °C, uden korrektionsfaktorer. XLPE bruger endnu samme tabel.
- Gruppens last = summen af brugsgenstandenes strøm × gruppens samtidighedsfaktor + rackforbrug.
- Effektforslag er typiske mærkeeffekter, ikke dimensioneringsværdier.

## 4. Roller og planer

- Claude Opus må ændre koden direkte, når kvaliteten holdes: samme design, test før commit og opdateret dokumentation.
- Claude Opus må planlægge alle opgaver og skriver i planen, om Fable, Opus eller Sonnet skal udføre den, med en kort begrundelse.
- Claude Fable må gennemgå og ændre enhver plan, også under implementeringen. Ændringer noteres i planen med dato og begrundelse.
- Claude Sonnet og mindre modeller implementerer kun efter en skriftlig plan.
- Er den valgte model ikke tilgængelig, udfører Opus opgaven og noterer det i planen.
- Planer gemmes i `docs/planer/ÅÅÅÅ-MM-DD-emne.md` før implementeringen (se `docs/planer/README.md`).

## 5. Kommunikation

- Svar kort, direkte og teknisk præcist, på dansk.
- Spørg før du tilføjer funktioner, Alexander ikke har bedt om. Foreslå dem i stedet, og skriv dem i `docs/forslag.md`.
- Er du i tvivl om din rolle eller om en faglig regel, så spørg, før du ændrer kode.
