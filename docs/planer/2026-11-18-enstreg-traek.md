# Enstreg: træk for at flytte forbindelser, Tilgang i serie (2026-11-18)

Udføres af Opus (opgaven kom fra Opus-sessionen og hænger tæt sammen med 10.16.0-sløjferne). Skema uændret (15), ingen nye felter: kun `enheder.fraEnhed` og `enheder.daaseId` ændres.

## Filer
- Hovedfil: `js/diagram.js` (`sld`, pointerhåndtering, nye metoder `flytTjek`, `flytEnhed`, `flytValg`, `traek*`).
- Små tilføjelser: `js/app.js` (tilstand `traek`), `index.html` (spøgelsesmærke under træk, "Flyt til …" i infopanelet, hjælpetekst), `css/app.css` (fremhævning af slipmål), `tests/smoke.py` (nyt tjek 4h3, tjek 4h2 tilpasset Tilgang i serie).
- Andre sessioner (føringsvej, dokumentation/fejlfinder, import, billeder skema 16) kan røre `index.html`, `js/app.js`, `tests/smoke.py` og `CHANGELOG.md`. Konflikter løses ved merge.

## 1. Træk for at ændre tilhørsforhold
- Langt tryk (ca. 0,4 s uden at flytte) på en brugsgenstands række starter et træk. Det gælder både mus og touch, så almindeligt træk stadig panorerer, og to fingre stadig zoomer (et finger nummer to afbryder trækket).
- Mens man trækker, fremhæves alle gyldige mål i samme gruppe, målet under fingeren fremhæves kraftigt (rødt, hvis det er ugyldigt), og et mærke ved fingeren viser "X → Y" eller årsagen til afvisningen.
- Slip på en brugsgenstand: `fraEnhed = mål`. På en dåse: `daaseId = dåse`, `fraEnhed = ''`. På gruppen: begge tomme. Kredse (`erSloejfetUnder`) og andre grupper afvises med en besked.
- Ændringen går gennem `mutate` (kan fortrydes), og beskeden har Fortryd, fx "Stik A1 er nu sløjfet fra Tilgang."
- Alternativ uden træk: "Flyt til …"-valgliste i infopanelet for en valgt brugsgenstand. Den bruger samme `flytEnhed`.

## 2. Tilgang i serie
- En Tilgang (symbolet `tilgang`, ikke selv sløjfet) tegnes som et mellemled på linjen ligesom en dåse: gruppens linje → Tilgang-symbol → lodret skinne, som brugsgenstande sløjfet fra Tilgangen udgår fra. Tilgange tegnes først i gruppen, så den sidder direkte på gruppens linje.
- Diagrammets dybde (bredde) tæller Tilgangen med som et niveau.
- Data-attribut `data-tx` på Tilgangen giver symbolets x til testen.

## Test
- `flytEnhed` til brugsgenstand, dåse og gruppe, kreds og anden gruppe afvist, fortryd.
- Træk simuleret med pointer events (langt tryk, flyt, slip) med fremhævning af mål.
- Tilgangens x ligger mellem gruppeafbryderen og de sløjfede brugsgenstandes start, og den ligger på gruppens række.
- Kontrol i den indbyggede browser ved 1300 og 390 px.
