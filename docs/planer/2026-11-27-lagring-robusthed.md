# Lagring: fuldt lager, synk, null i lister, gem ved lukning

Fra gennemgangen af hele appen 2026-11-27 (bundt 2). Data må aldrig gå tabt (CLAUDE.md afsnit 1).

## Mål
- A5: fuldt lager giver rigtig tekst og én fejlbesked (`lagerFejl`). Ingen automatisk sletning af backups; knappen "Slet automatiske backups" vises under Datasikring, når lageret er fuldt, og kræver bekræftelse (`backupsSlet`).
- A6: `skriv` returnerer `true/false`. Mislykkes en skrivning under synkronisering (aktivt projekt eller hentet projekt), kastes fejlen `lager` før afsendelsen, og `base` ændres ikke.
- A7: `norm()` fjerner `null` og andet end objekter i listerne. `synkKoer` springer et projekt over, som `norm()` ikke kan læse.
- A9: `gemAlt()` ved skjul og lukning gemmer felter bundet direkte til `db`, der kun gemmes ved `change` (sat af `input`-hændelsen via `UGEMT`).
- A13: `storage`-hændelsen fletter projektlisten efter id i stedet for at erstatte den.

## Udfører
Opus (datasikring).

## Datamodel
Ingen ændring (skema 25). `norm()` fjerner kun poster uden data.

## Test
`tests/smoke.py`: fuldt lager med stubbet `setItem`; `backupsSlet`; `norm` med `null`; `pagehide` efter `input` og uden; synk med fuldt lager ved hentning sender intet, ændrer ikke base og henter igen bagefter. Testen for et ulæseligt projekt bruger nu ugyldig JSON, da `{"tavler":[null]}` kan læses.
