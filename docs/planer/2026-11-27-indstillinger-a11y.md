# Indstillinger, dialoger og touch

Fra gennemgangen af hele appen 2026-11-27 (bundt 5). Valgt af Alexander 2026-11-27.

## Mål
- C1: Indstillinger (Datasikring, App, Synkronisering, Firma, Import) flyttes fra Dokumentation til en ny fane `indstillinger` med en knap i hovedet. Afvigelse fra første plan (en dialog): en fane genbruger layoutet, undgår dialoger i dialoger (Historik og Oprydning åbnes herfra som dialoger) og kræver ingen ny fokushåndtering. Noteret 2026-11-27 af Opus.
- Erstat aktivt projekt kræver bekræftelse; eksempeldata og ryd får tekster, der siger, at de gælder det aktive projekt.
- C5: fokus ind i og ud af dialoger (`$watch('modal')`), Tab-fælde (`fokuserbare`), `aria-labelledby` på alle dialoger, "Annuller".
- C6: tokens `--ok` og `--gul`. Hårdkodede farver på arkene (`.sheet`, papir) og på tavlens kontakter (fysiske farver) er bevidste og beholdes. Den dublerede blok for mørkt tema beholdes, da `@media` og `[data-theme]` ikke kan samles i én regel uden CSS-nesting.
- C7: afsnit i brugsgenstandens formular som overskrifter, ikke sammenfoldet, så alle felter stadig er synlige.
- Større trykflader under `pointer:coarse`.
- Rettelse til 10.46.0: `iz()` bruger trækkets fasestrømme kun for gemte brugsgenstande; en formular regnes på sin egen tilslutning.

## Udfører
Opus (oprindeligt Fable til planen og Sonnet til udførelsen; udført af Opus i samme session).

## Datamodel
Ingen ændring.

## Test
`tests/smoke.py`: Indstillinger-fanen og knappen; Dokumentation uden indstillinger; erstat kræver bekræftelse; fokus ind, Tab rundt, Shift+Tab, fokus tilbage; titler på alle dialoger; afsnit i formularen. Firma- og lagertestene bruger nu fanen Indstillinger.
