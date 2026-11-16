# Forslag og prioritering

Forslag, Alexander ikke har besluttet endnu, eller som venter på at blive lavet. "Udfører" er Opus' vurdering og kan ændres i planen. Når et forslag er lavet, fjernes det herfra og står i `CHANGELOG.md`.

| # | Forslag | Udfører | Begrundelse |
|---|---|---|---|
| A | Beskeder i bunden: almindelig synkronisering viser ingen besked, beskeder bliver stående længere efter tekstens længde, de kan lukkes med et kryds, fejl bliver stående, og flere beskeder vises i rækkefølge | Opus | Lille UI-ændring |
| 1 | Korrektionsfaktorer og installationsmetoder (A1–F, temperatur, samlet fremføring) og egen I<sub>z</sub>-tabel for XLPE | Fable | Beregningsmotoren. Tabellerne fra DS/HD 60364-5-52 skal være helt rigtige |
| 4 | Afbrydere i enstregsdiagrammet, krydsafbryder og tændingsdiagrammer i eksporten | Fable | Enstregsdiagrammet er den sværeste del af koden |
| 2 | Automatisk vurdering af målinger: Z<sub>s</sub> ≤ U<sub>0</sub>/I<sub>a</sub> efter B/C og I<sub>n</sub>, HPFI-udløsetid ≤ grænsen | Opus | Få formler, men skal passe med 1. Fable gennemgår planen |
| 8 | Gendan fra Gist-historik: vis og gendan et projekt fra en tidligere dato som kopi | Opus | Bygger på synkroniseringen |
| 9 | Bygget Tailwind-CSS i stedet for CDN | Opus | Fjerner advarslen i konsollen og CDN-afhængigheden. Kræves for 6 |
| 6 | Offline-app (PWA) med `sw.js` og `manifest.json` | Opus | Efter 9 |
| 7 | Mobiltilstand til brugsgenstande og målinger på pladsen. Hovedet bliver presset sammen under ca. 750 px bredde, så projektnavnet næsten forsvinder | Opus | Hører sammen med 6 |
| 3 | Materialeliste: kabelmeter pr. type og tværsnit, dåser og materiel | Sonnet | Lægger kun eksisterende data sammen |
| 5 | Dokumentation klar til print som PDF med logo og underskriftsfelt | Sonnet | Ændrer kun eksporten |

Foreslået rækkefølge: Fable tager 1 og derefter 4, mens prøveperioden kører. Opus laver imens A og 2. Bagefter 9 → 6 → 7, og 3, 5 og 8 efter behov.
