# Forslag til fasefordeling (forslag 13)

## Mål

En knap, der foreslår L1, L2 eller L3 for de 1-fasede grupper i en tavle, så fasebalancen bliver bedst. Brugeren ser forslaget og godkender det, før noget ændres.

## Udføres af

Claude Fable, i samme session som kortslutning og selektivitet (aftalt med Alexander 2026-11-16). Forslaget var sat til Opus.

## Løsning

- `fasePlan(tid)` i `js/beregning.js` er den fordeling, `autoBalance` allerede brugte: største gruppe først, på den fase med mindst last. 3-fasede grupper og undertavler uden gruppe ligger fast.
- `faseForesla(tid)` lægger forslaget i `faseFs` (tilstand i `js/app.js`) uden at ændre data. Er forskellen mellem faserne ikke mindre end nu, vises en besked i stedet.
- `faseAnvend()` flytter grupperne med `mutate`, så det kan fortrydes.
- `index.html`: knappen "Foreslå fasefordeling" og panelet med forslaget i tavlens kort under Beregning. Linket i advarslerne åbner forslaget.

## Datamodel

Ingen ændring.

## Test

Røgtesten sætter alle 1-fasede grupper på L1, åbner forslaget, kontrollerer at intet er ændret, vælger Anvend og kontrollerer balancen. Et nyt forslag bagefter giver ingen ændringer.
