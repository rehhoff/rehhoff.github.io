# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

Forslag til og med 21 og A er lavet. 23–31 kommer fra gennemgangen af hele appen 2026-11-27 (`docs/planer/2026-11-27-ui-smaa.md`). 17 (tidsgrænser i røgtesten, `SMOKE_TRIN_MS` og `SMOKE_SAMLET_S`) ændrer ikke appen.

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| 22 | Virtuel liste i føringsvejen og kabeltabellen (kun synlige rækker i DOM'en) | Opus | Efter ydelsesarbejdet (10.26.0) tager en ændring i et projekt med 600 brugsgenstande stadig ca. 0,5 s, mest Alpines bindinger pr. række. Gennemgangen 2026-11-27: mål først; billigere gevinst er mellemlagring af `ikMin`, `gruppeFejl`, `faseInfo` og `aflTjek` i Beregning-tabellen |
| 23 | Verifikationsskema efter DS/HD 60364-6: PE-kontinuitet og udligning, polaritet, fasefølge, HPFI ved 5 × IΔn, målt I<sub>k</sub>, funktionsprøve, visuel tjekliste; dato, instrument, kalibrering og hvem der målte. Eget afsnit i dokumentationen | Opus | Måleskemaet har i dag kun R<sub>iso</sub>, Z<sub>s</sub>, HPFI-tid og OK. Ændrer datamodellen (skema) |
| 24 | Tavledokumentation efter EN 61439 (mærkestrøm, I<sub>cc</sub>/I<sub>cw</sub>, IP, form, fabrikant) og en overensstemmelseserklæring som side i dokumentationen | Opus | Mangler til aflevering af tavler. Ændrer datamodellen |
| 25 | Materialelisten i dokumentationen og som CSV-fil | Sonnet | Står som "senere" i `docs/planer/2026-11-16-materialeliste.md`; i dag kun kopi til udklipsholderen |
| 26 | Egne lokaleskabeloner (gem et lokale som skabelon) | Sonnet | De 7 skabeloner er faste i `js/data.js` |
| 27 | Projektstatus (projektering, installation, afprøvning, afleveret) med datoer | Sonnet | I dag kun ét datofelt. Ændrer datamodellen |
| 28 | Firmaoplysninger med i synkroniseringen | Opus | Brevhovedet mangler på en anden enhed. Udvider Gist-formatet |
| 29 | Faglige tjek, ikke godkendt 2026-11-27: tilgangskabel med gG-sikring In ≤ 0,9 · I<sub>z</sub> (433.1); IΔn ≤ 30 mA på stikgrupper ≤ 32 A (411.3.3); selektivitet for en undertavle forsynet direkte fra en gruppeforsynet undertavle; type S HPFI godkendt ved 130–500 ms | Opus | Ændrer faglige regler i CLAUDE.md afsnit 4 og kræver aftale |
| 30 | Søgning: piletaster i resultatlisten og tegninger med i søgningen | Sonnet | Resultaterne kan i dag kun vælges med mus eller Tab |
| 31 | Kortvisning af Kabler og Beregning under 640 px, som måleskemaet | Sonnet | Tabellerne med 11–13 kolonner kan i dag kun rulles sidelæns på mobil |
