# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| 4 | Afbrydere i enstregsdiagrammet, krydsafbryder og tændingsdiagrammer i eksporten | Fable | Enstregsdiagrammet er den sværeste del af koden |
| 8 | Gendan fra Gist-historik: vis og gendan et projekt fra en tidligere dato som kopi | Opus | Bygger på synkroniseringen |
| 9 | Bygget Tailwind-CSS i stedet for CDN | Opus | Fjerner advarslen i konsollen og CDN-afhængigheden. Kræves for 6 |
| 6 | Offline-app (PWA) med `sw.js` og `manifest.json` | Opus | Efter 9 |
| 7 | Mobiltilstand til brugsgenstande og målinger på pladsen. Hovedet bliver presset sammen under ca. 750 px bredde, så projektnavnet næsten forsvinder | Opus | Hører sammen med 6 |
| 3 | Materialeliste: kabelmeter pr. type og tværsnit, dåser og materiel | Sonnet | Lægger kun eksisterende data sammen |
| 5 | Dokumentation klar til print som PDF med logo og underskriftsfelt | Sonnet | Ændrer kun eksporten |

Foreslået rækkefølge: Fable tager 4 (1 er lavet i 10.1.0), mens prøveperioden kører. A og 2 er lavet i 10.2.0 og 10.3.0. Bagefter 9 → 6 → 7, og 3, 5 og 8 efter behov.
