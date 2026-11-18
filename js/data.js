/* Konstanter, lagernøgler, tabeller, norm() og eksempeldata. Indlæses først; alt her er globalt og bruges af de andre filer og markup. */
const KEY = 'tavleoversigt.v2', OLD = 'tavleoversigt.v1', TKEY = 'tavleoversigt.tema', IDX = 'tavleoversigt.projekter';
/* Versioner: APP_VERSION følger CHANGELOG.md. SCHEMA hæves kun, når datamodellen ændres, og udløser en automatisk backup før migrering. */
const APP_VERSION = '10.18.0', SCHEMA = 16, BKEY = 'tavleoversigt.backups', BMAX = 3;
const PK = id => 'tavleoversigt.p.' + id, MEM = {};
/* Synkronisering: en hemmelig GitHub Gist med en markørfil og én fil pr. projekt. Se docs/planer/2026-11-15-gist-synk.md. */
const SKEY = 'tavleoversigt.sync', GFIL = 'tavleoversigt.json', GP = id => 'tavleoversigt-' + id + '.json', GPRE = /^tavleoversigt-([A-Za-z0-9_-]+)\.json$/, GH = 'https://api.github.com';
let SYNK_T = null;
/* Billeder (skema 15): IndexedDB-databasen tavleoversigt-billeder og en separat hemmelig Gist med en markørfil og én fil pr. billede. Se docs/planer/2026-11-18-brandlukning.md. */
const BDB = 'tavleoversigt-billeder', BFIL = 'tavleoversigt-billeder.json', BP = id => 'tavleoversigt-billede-' + id + '.txt', BPRE = /^tavleoversigt-billede-([A-Za-z0-9_-]+)\.txt$/, BID = /^[A-Za-z0-9_-]{1,40}$/;
const BMINI = {}, BFULD = new Set();
const bIdListe = v => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === 'string' && BID.test(x)))];
/* alle billed-id'er, et projekt bruger (brandlukninger og skema 16: tavler, lokaler, samledåser). Ny billedliste tilføjes kun her */
const billedIds = d => { const ud = new Set(); if (d) for (const k of ['brandlukninger', 'tavler', 'lokaler', 'daaser']) (Array.isArray(d[k]) ? d[k] : []).forEach(x => { if (x && Array.isArray(x.billeder)) x.billeder.forEach(i => { if (typeof i === 'string' && BID.test(i)) ud.add(i); }); }); return ud; };
const hashTxt = s => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
const hashD = d => hashTxt(JSON.stringify(norm(JSON.parse(JSON.stringify(d)))));
let SLDW = 1240;
const IK = {
  el:'<svg viewBox="0 0 16 16" class="ik" aria-hidden="true"><path d="M9.5 1 3 9h4l-1 6 6.5-8H8.5z" fill="currentColor"/></svg>',
  pds:'<svg viewBox="0 0 16 16" class="ik" aria-hidden="true"><path d="M2 4h12v7h-3v2H5v-2H2z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 4v3M7 4v3M9 4v3M11 4v3" stroke="currentColor" stroke-width="1.2"/></svg>',
  cctv:'<svg viewBox="0 0 16 16" class="ik" aria-hidden="true"><path d="M1 4h10v5H1zM11 5.5 15 4v5l-4-1.5M4 9v4h4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  rack:'<svg viewBox="0 0 16 16" class="ik" aria-hidden="true"><path d="M3 1h10v14H3zM3 5.5h10M3 10h10" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 3.3h2M5 7.8h2M5 12.4h2" stroke="currentColor" stroke-width="1.4"/></svg>',
  daase:'<svg viewBox="0 0 16 16" class="ik" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M0 8h3M13 8h3M8 13v3" stroke="currentColor" stroke-width="1.4"/></svg>'
};
const RHO = 0.0225;
const TV = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
/* Iz i A for kobber, DS/HD 60364-5-52 (IEC 60364-5-52:2009) anneks B. Luft 30 °C, jord 20 °C og 2,5 K·m/W.
   IZT[isolation][belastede ledere][metode] = værdier i rækkefølge efter TV (1,5–120 mm²).
   PVC 70 °C: B.52.2 (2 belastede) og B.52.4 (3). XLPE/EPR 90 °C: B.52.3 og B.52.5. Metode E: B.52.10 (PVC) og B.52.12 (XLPE), flerlederkabel. */
const IZT = {
  PVC: {
    2: { A1:[14.5, 19.5, 26, 34, 46, 61, 80, 99, 119, 151, 182, 210], A2:[14, 18.5, 25, 32, 43, 57, 75, 92, 110, 139, 167, 192],
         B1:[17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 232, 269], B2:[16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168, 201, 232],
         C:[19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258, 299], D1:[22, 29, 37, 46, 60, 78, 99, 119, 140, 173, 204, 231],
         D2:[22, 28, 38, 48, 64, 83, 110, 132, 156, 192, 230, 261], E:[22, 30, 40, 51, 70, 94, 119, 148, 180, 232, 282, 328] },
    3: { A1:[13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188], A2:[13, 17.5, 23, 29, 39, 52, 68, 83, 99, 125, 150, 172],
         B1:[15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239], B2:[15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206],
         C:[17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259], D1:[18, 24, 30, 38, 50, 64, 82, 98, 116, 143, 169, 192],
         D2:[19, 24, 33, 41, 54, 70, 92, 110, 130, 162, 193, 220], E:[18.5, 25, 34, 43, 60, 80, 101, 126, 153, 196, 238, 276] }
  },
  XLPE: {
    2: { A1:[19, 26, 35, 45, 61, 81, 106, 131, 158, 200, 241, 278], A2:[18.5, 25, 33, 42, 57, 76, 99, 121, 145, 183, 220, 253],
         B1:[23, 31, 42, 54, 75, 100, 133, 164, 198, 253, 306, 354], B2:[22, 30, 40, 51, 69, 91, 119, 146, 175, 221, 265, 305],
         C:[24, 33, 45, 58, 80, 107, 138, 171, 209, 269, 328, 382], D1:[25, 33, 43, 53, 71, 91, 116, 139, 164, 203, 239, 271],
         D2:[27, 35, 46, 58, 77, 100, 129, 155, 183, 225, 270, 306], E:[26, 36, 49, 63, 86, 115, 149, 185, 225, 289, 352, 410] },
    3: { A1:[17, 23, 31, 40, 54, 73, 95, 117, 141, 179, 216, 249], A2:[16.5, 22, 30, 38, 51, 68, 89, 109, 130, 164, 197, 227],
         B1:[20, 28, 37, 48, 66, 88, 117, 144, 175, 222, 269, 312], B2:[19.5, 26, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268],
         C:[22, 30, 40, 52, 71, 96, 119, 147, 179, 229, 278, 322], D1:[21, 28, 36, 44, 58, 75, 96, 115, 135, 167, 197, 223],
         D2:[23, 30, 39, 49, 65, 84, 107, 129, 153, 188, 226, 257], E:[23, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346] }
  }
};
/* Gammel tabel (PVC, metode C, 30 °C) som opslag pr. tværsnit. Beholdes til kode, der ikke kender metoder. */
const IZ = { 2:Object.fromEntries(TV.map((a, i) => [a, IZT.PVC[2].C[i]])), 3:Object.fromEntries(TV.map((a, i) => [a, IZT.PVC[3].C[i]])) };
/* Installationsmetoder (DS/HD 60364-5-52, tabel B.52.1). Metode F er udeladt: den gælder kun enlederkabler. */
const METODER = { A1:'A1 · isolerede ledere i rør i isoleret væg', A2:'A2 · flerlederkabel i rør i isoleret væg', B1:'B1 · isolerede ledere i rør på væg', B2:'B2 · flerlederkabel i rør på væg',
  C:'C · flerlederkabel direkte på eller i væg', D1:'D1 · kabel i rør i jord', D2:'D2 · kabel direkte i jord', E:'E · flerlederkabel i fri luft' };
const JORD = m => m === 'D1' || m === 'D2';
/* Isolationstabel pr. kabeltype (aftalt med Alexander 2026-11-16) */
const ISO = k => k === 'XLPE' || k === 'Brandkabel' ? 'XLPE' : 'PVC';
/* Temperaturfaktorer: B.52.14 (luft, basis 30 °C) og B.52.15 (jord, basis 20 °C). */
const TEMPS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const K_TEMP = {
  luft: { PVC:{ 10:1.22, 15:1.17, 20:1.12, 25:1.06, 30:1, 35:0.94, 40:0.87, 45:0.79, 50:0.71, 55:0.61, 60:0.50 },
          XLPE:{ 10:1.15, 15:1.12, 20:1.08, 25:1.04, 30:1, 35:0.96, 40:0.91, 45:0.87, 50:0.82, 55:0.76, 60:0.71 } },
  jord: { PVC:{ 10:1.10, 15:1.05, 20:1, 25:0.95, 30:0.89, 35:0.84, 40:0.77, 45:0.71, 50:0.63, 55:0.55, 60:0.45 },
          XLPE:{ 10:1.07, 15:1.04, 20:1, 25:0.96, 30:0.93, 35:0.89, 40:0.85, 45:0.80, 50:0.76, 55:0.71, 60:0.65 } }
};
/* Samlet fremføring: B.52.17 (luft, pr. antal kredse i KREDSE) og for jord B.52.18 (direkte, kabler der rører hinanden) og B.52.19 (flerlederkabler i hvert sit rør, rørene rører hinanden). */
const KREDSE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 20];
const LAG = {
  bundt: { navn:'Bundtet, på overflade, indstøbt eller i rør', k:[1, 0.80, 0.70, 0.65, 0.60, 0.57, 0.54, 0.52, 0.50, 0.45, 0.41, 0.38] },
  vaeg:  { navn:'Ét lag på væg, gulv eller uperforeret bakke', k:[1, 0.85, 0.79, 0.75, 0.73, 0.72, 0.72, 0.71, 0.70] },
  loft:  { navn:'Ét lag direkte under loft', k:[0.95, 0.81, 0.72, 0.68, 0.66, 0.64, 0.63, 0.62, 0.61] },
  bakke: { navn:'Ét lag på perforeret bakke', k:[1, 0.88, 0.82, 0.77, 0.75, 0.73, 0.73, 0.72, 0.72] },
  stige: { navn:'Ét lag på kabelstige eller bøjler', k:[1, 0.87, 0.82, 0.80, 0.80, 0.79, 0.79, 0.78, 0.78] }
};
const K_JORD_SAMLET = { D1:[1, 0.85, 0.75, 0.70, 0.65, 0.60], D2:[1, 0.75, 0.65, 0.60, 0.55, 0.50] };
const PH = ['L1', 'L2', 'L3'];
/* Gruppetyper med lys: ΔU-grænse 3 % og forvalgt til afbrydere. "Lys og stik" (lysstik) aftalt med Alexander 2026-11-18. */
const LYS_TYPER = ['lys', 'lysstik'];
const KABLER = ['Brandkabel', 'XLPE', 'PVC', 'PKAJ', 'PKL'];
const DAASER = ['Membrandåse', 'Indmuringsdåse', 'Forfradåse', 'Underlag', 'Europadåse', 'PL-dåse'];
const kabMap = k => KABLER.includes(k) ? k : /noik|halogen|xlpe/i.test(k || '') ? 'XLPE' : 'PVC';
const daaMap = t => DAASER.includes(t) ? t : /underlag|fuga/i.test(t || '') ? 'Underlag' : /membran|ip44|brønd/i.test(t || '') ? 'Membrandåse' : 'PL-dåse';
const TIMERS = {};
/* Typiske mærkeeffekter som forslag: [mønster i navnet, W, betegnelse, ganges med antal] */
const EFFEKT = [
  [/halogen/, 50, 'Halogenspot 50 W', 1], [/skinne/, 60, 'Skinnespots'], [/downlight|indbygningsspot|spot/, 10, 'Downlight', 1], [/lysstof|\bt8\b|\bt5\b/, 36, 'Lysstofrør 36 W', 1], [/gløde/, 60, 'Glødepære 60 W', 1],
  [/sparepære/, 11, 'Sparepære 11 W', 1], [/pære/, 7, 'LED-pære 7 W', 1], [/varmelampe|infrarød|ir-lampe/, 250, 'Varmelampe 250 W', 1], [/håndklædetørrer/, 100, 'Håndklædetørrer'],
  [/radiator|elvarme|panelovn|elpanel/, 1000, 'Elradiator'], [/60\s?x\s?60|led-?panel/, 36, 'LED-panel 60x60', 1], [/led-?bånd|ledstrip|lysbånd/, 30, 'LED-bånd'], [/nødbelys|nødlys/, 8, 'Nødbelysning', 1],
  [/exit|flugtvej/, 5, 'Flugtvejsskilt', 1], [/highbay|højbay|industriarmatur/, 150, 'Highbay-armatur', 1], [/projektør/, 50, 'LED-projektør', 1], [/parklampe|gadelampe|mastelampe/, 30, 'Parklampe', 1], [/lyskæde/, 20, 'Lyskæde'],
  [/armatur/, 36, 'Armatur', 1], [/udelampe|udelys|væglampe/, 15, 'Udelampe', 1], [/lampeudtag|loftudtag|lampe|pendel/, 60, 'Lampeudtag', 1],
  [/vinkøl/, 100, 'Vinkøleskab'], [/kummefryser/, 120, 'Kummefryser'], [/kølerum|frostrum/, 1500, 'Kølerum'], [/køle.?frys/, 200, 'Køle-/fryseskab'], [/frys/, 150, 'Fryser'], [/køl/, 150, 'Køleskab'], [/mikro/, 1200, 'Mikroovn'],
  [/kogeplade|kogesektion|induktion/, 7200, 'Kogeplade'], [/komfur/, 9000, 'Komfur'], [/sauna/, 6000, 'Saunaovn'], [/ovn/, 3000, 'Ovn'], [/opvask/, 2000, 'Opvaskemaskine'], [/elkedel/, 2000, 'Elkedel'], [/kaffe|espresso/, 1500, 'Kaffemaskine'],
  [/brødrister|toaster/, 1000, 'Brødrister'], [/airfryer|friture/, 1800, 'Airfryer'], [/køkkenmaskine|røremaskine|blender/, 800, 'Køkkenmaskine'], [/emhætte/, 250, 'Emhætte'],
  [/vaskemaskine/, 2200, 'Vaskemaskine'], [/hårtørrer|føntørrer/, 2000, 'Hårtørrer'], [/håndtørrer/, 1800, 'Håndtørrer'], [/tumbler|tørreskab/, 2500, 'Tørretumbler'], [/strygejern|strygerulle/, 2400, 'Strygejern'], [/støvsuger/, 900, 'Støvsuger'],
  [/gennemstrøm/, 11000, 'Gennemstrømningsvandvarmer'], [/vandvarmer|vvb|varmtvandsbeholder/, 3000, 'Vandvarmer'], [/elpatron/, 3000, 'Elpatron'], [/varmepumpe/, 2500, 'Varmepumpe'], [/gulvvarme/, 600, 'Elgulvvarme'],
  [/varmekabel|frostsikring/, 300, 'Varmekabel'], [/terrassevarmer/, 2000, 'Terrassevarmer'], [/elpejs/, 2000, 'Elpejs'], [/\bspa\b|boblebad/, 3000, 'Spabad'], [/aircondition|klimaanlæg|aircon/, 1500, 'Aircondition'], [/affugter/, 300, 'Affugter'],
  [/elcykel/, 200, 'Elcykeloplader'], [/lade|elbil/, 11000, 'Ladeboks 11 kW'], [/server/, 500, 'Server'], [/printer|kopimaskine/, 600, 'Printer'], [/projektor/, 300, 'Projektor'], [/\btv\b|fjernsyn|medie/, 150, 'TV og medie'],
  [/\bpc\b|computer|arbejdsplads/, 300, 'PC-arbejdsplads'], [/router|switch|accesspoint|rack/, 30, 'Router og switch'], [/alarm|porttelefon|dørtelefon|ringeklokke/, 15, 'Alarmcentral'], [/garageport|portåbner|portmotor/, 300, 'Garageport'],
  [/kompressor/, 2200, 'Kompressor'], [/svejse/, 3500, 'Svejseværk'], [/\bsav\b|rundsav|bordsav|høvl|fræser/, 2000, 'Bordsav'], [/aggregat|genvex/, 150, 'Ventilationsaggregat'], [/ventilat/, 30, 'Ventilator'],
  [/cirkulationspumpe/, 60, 'Cirkulationspumpe'], [/pumpe/, 800, 'Dykpumpe'], [/hæve.?sænke/, 150, 'Hæve-sænkebord'], [/akvarie|akvarium/, 100, 'Akvarium'], [/stik/, 1000, 'Stikkontakt']
];
/* Samtidighedsfaktorer som vejledende forslag pr. installationstype og gruppetype */
const ANLAEG = { bolig:'Bolig', kontor:'Kontor', butik:'Butik', institution:'Skole og institution', fitness:'Fitness og omklædning', storkoekken:'Storkøkken og restaurant', industri:'Værksted og industri' };
const SF = { bolig:{ lys:0.7, lysstik:0.7, stik:0.3, kraft:0.8, data:1 }, kontor:{ lys:0.9, lysstik:0.9, stik:0.5, kraft:0.8, data:1 }, butik:{ lys:1, lysstik:1, stik:0.5, kraft:0.8, data:1 }, institution:{ lys:0.9, lysstik:0.9, stik:0.4, kraft:0.8, data:1 },
  fitness:{ lys:1, lysstik:1, stik:0.8, kraft:0.9, data:1 }, storkoekken:{ lys:1, lysstik:1, stik:0.7, kraft:0.8, data:1 }, industri:{ lys:1, lysstik:1, stik:0.6, kraft:0.7, data:1 } };
/* Lokaleskabeloner: grupper med [navn, W] */
const SKABELONER = {
  koekken: { navn:'Køkken', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Downlight 6 stk.', 60], ['LED-bånd under overskabe', 30]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakter over bord 4 stk.', 1000], ['Køleskab', 150], ['Fryser', 150], ['Emhætte', 250], ['Mikroovn', 1200]] },
    { navn:'Kogeplade', type:'kraft', In:16, faser:3, items:[['Kogeplade', 7200]] }, { navn:'Ovn', type:'kraft', In:16, items:[['Ovn', 3000]] }, { navn:'Opvaskemaskine', type:'kraft', In:13, items:[['Opvaskemaskine', 2000]] } ] },
  bad: { navn:'Badeværelse', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Downlight IP44 4 stk.', 40], ['Spejllys', 18], ['Ventilator', 30]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakt ved vask', 1000], ['Håndklædetørrer', 100]] },
    { navn:'Gulvvarme', type:'kraft', In:10, items:[['Elgulvvarme', 600]] } ] },
  stue: { navn:'Stue', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Lampeudtag 2 stk.', 120], ['Downlight 4 stk.', 40]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakter 8 stk.', 1000], ['TV og medie', 150]] } ] },
  vaerelse: { navn:'Værelse', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Lampeudtag', 60]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakter 4 stk.', 1000]] } ] },
  bryggers: { navn:'Bryggers', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Armatur', 36]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakter 2 stk.', 1000]] }, { navn:'Vaskemaskine', type:'kraft', In:16, items:[['Vaskemaskine', 2200]] },
    { navn:'Tørretumbler', type:'kraft', In:16, items:[['Tørretumbler', 2500]] }, { navn:'Vandvarmer', type:'kraft', In:16, items:[['Vandvarmer', 3000]] } ] },
  kontor: { navn:'Kontor', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['LED-panel 60x60 4 stk.', 144]] }, { navn:'Stik', type:'stik', In:13, items:[['Stikkontakter arbejdsplads 6 stk.', 1000], ['PC-arbejdsplads 2 stk.', 600]] } ] },
  omklaedning: { navn:'Omklædning', grupper:[ { navn:'Lys', type:'lys', In:10, items:[['Armatur IP44 6 stk.', 216], ['Ventilationsaggregat', 150]] }, { navn:'Stik hårtørrer', type:'stik', In:16, items:[['Hårtørrer 1', 2000], ['Hårtørrer 2', 2000], ['Hårtørrer 3', 2000]] },
    { navn:'Håndtørrer', type:'kraft', In:16, items:[['Håndtørrer 1', 1800], ['Håndtørrer 2', 1800]] } ] }
};
const EFFEKT_SYM = { lys:[60, 'lampe'], stik:[1000, 'stikkontakt'], koel:[150, 'køleskab'], frys:[150, 'fryser'], ovn:[3000, 'ovn'], koge:[7200, 'kogeplade'], mikro:[1200, 'mikroovn'], opvask:[2000, 'opvaskemaskine'], vask:[2200, 'vaskemaskine'],
  toerre:[2500, 'tørretumbler'], emhaette:[250, 'emhætte'], vvb:[3000, 'vandvarmer'], varme:[1000, 'elvarme'], vp:[2500, 'varmepumpe'], motor:[1500, 'motor'], ev:[11000, 'ladeboks'], it:[30, 'IT-udstyr'] };
const uid = () => Math.random().toString(36).slice(2, 10);
const tal = s => Number(String(s).replace(',', '.')) || 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const hostTema = document.documentElement.getAttribute('data-theme');

const tom = () => ({ projekt:{ anlaeg:'bolig', navn:'', sagsnr:'', kunde:'', adresse:'', installatoer:'', dato:'', metode:'C', temp:30, jtemp:20, samlet:1, lag:'bundt' }, tavler:[], rcds:[], lokaler:[], grupper:[], enheder:[], daaser:[], afbrydere:[], racks:[], udstyr:[], links:[], brandlukninger:[] });
/* Gruppens eller tilgangskablets egne forhold: gyldig værdi eller '' (= projektets standard). Præfiks 't' giver tMetode, tTemp, tSamlet, tLag. */
function forholdNorm(o, p) {
  const n = k => p ? p + k[0].toUpperCase() + k.slice(1) : k, s = Math.round(Number(o[n('samlet')]));
  o[n('metode')] = METODER[o[n('metode')]] ? o[n('metode')] : '';
  o[n('temp')] = o[n('temp')] !== '' && o[n('temp')] != null && TEMPS.includes(Number(o[n('temp')])) ? Number(o[n('temp')]) : '';
  o[n('samlet')] = s >= 1 && s <= 20 ? s : '';
  o[n('lag')] = LAG[o[n('lag')]] ? o[n('lag')] : '';
}
function norm(d) {
  const o = Object.assign(tom(), d || {});
  o.projekt = Object.assign(tom().projekt, o.projekt || {});
  { const sd = o.projekt.sidst; o.projekt.sidst = sd && KABLER.includes(sd.kabel) && sd.ledere && Number(sd.tv) ? { kabel:sd.kabel, ledere:sd.ledere, tv:Number(sd.tv) } : null; }
  /* Skema 10: forhold for Iz. Projektets standard, som grupper og tilgangskabler kan overskrive (tom = standard). */
  { const p = o.projekt; p.metode = METODER[p.metode] ? p.metode : 'C'; p.temp = TEMPS.includes(Number(p.temp)) ? Number(p.temp) : 30; p.jtemp = TEMPS.includes(Number(p.jtemp)) ? Number(p.jtemp) : 20;
    p.samlet = Math.round(Number(p.samlet)) >= 1 && Math.round(Number(p.samlet)) <= 20 ? Math.round(Number(p.samlet)) : 1; p.lag = LAG[p.lag] ? p.lag : 'bundt'; }
  for (const k of ['tavler', 'rcds', 'lokaler', 'grupper', 'enheder', 'daaser', 'afbrydere', 'racks', 'udstyr', 'links', 'brandlukninger']) if (!Array.isArray(o[k])) o[k] = [];
  o.tavler.forEach(t => { t.forsikring = Number(t.forsikring) || 35; t.fra = t.fra || ''; t.tilgang = t.tilgang || ''; t.hovedafbryder = Number(t.hovedafbryder) || 0; t.tKabel = KABLER.includes(t.tKabel) ? t.tKabel : 'PVC'; t.tLedere = t.tLedere || '5G'; t.tTv = Number(t.tTv) || 6; t.tLaengde = Number(t.tLaengde) || 0; forholdNorm(t, 't');
    /* skema 12: netimpedans Ze (Ω) og prospektiv Ik,maks (kA) ved tavlen. 0 = ukendt */ t.ze = Number(t.ze) > 0 ? Number(t.ze) : 0; t.ikMaks = Number(t.ikMaks) > 0 ? Number(t.ikMaks) : 0;
    /* skema 13: status for tilgangskablet */ t.tTrukket = !!t.tTrukket; t.tNote = String(t.tNote || ''); });
  o.rcds.forEach(r => { r.selektiv = !!r.selektiv; /* skema 12: type S */ });
  o.grupper.forEach((g, i) => {
    g.fase = PH.includes(g.fase) ? g.fase : PH[i % 3]; g.rcdId = g.rcdId || ''; g.sf = Number(g.sf) > 0 && Number(g.sf) <= 1 ? Number(g.sf) : 1;
    g.maal = Object.assign({ riso:'', zs:'', rcd:'', ok:false }, g.maal || {}); forholdNorm(g, ''); g.brydeevne = Number(g.brydeevne) > 0 ? Number(g.brydeevne) : 6; /* skema 12: brydeevne i kA */
  });
  /* skema 13: føringsvej. Hver post har ét indgående træk med status (trukket, note) og placering (fx "Væg A") og højde (cm) */
  const traek = x => { x.hoejde = Number(x.hoejde) > 0 ? Number(x.hoejde) : ''; x.placering = String(x.placering || ''); x.trukket = !!x.trukket; x.note = String(x.note || ''); };
  o.enheder.forEach(e => { e.gruppeId = e.gruppeId || ''; e.lokaleId = e.lokaleId || ''; e.daaseId = e.daaseId || ''; e.kabel = kabMap(e.kabel); e.symbol = e.symbol || 'auto'; e.fraEnhed = e.fraEnhed || ''; /* skema 14: 1-faset tilslutning på 3-faset gruppe ('' = som gruppen) */ e.fase = PH.includes(e.fase) ? e.fase : ''; traek(e); });
  o.daaser.forEach(d => { d.gruppeId = d.gruppeId || ''; d.parentId = d.parentId || ''; d.lokaleId = d.lokaleId || ''; d.kabel = kabMap(d.kabel); d.type = daaMap(d.type); traek(d); });
  const eid = new Set(o.enheder.map(e => e.id));
  /* skema 13: sløjfe fra en anden brugsgenstand. Ukendt eller sig selv = ingen sløjfe; kredse brydes */
  o.enheder.forEach(e => { if (!eid.has(e.fraEnhed) || e.fraEnhed === e.id) e.fraEnhed = ''; });
  { const E = new Map(o.enheder.map(e => [e.id, e])); o.enheder.forEach(e => { let x = E.get(e.fraEnhed), n = 0; while (x && n++ < 50) { if (x.id === e.id) { e.fraEnhed = ''; break; } x = E.get(x.fraEnhed); } }); }
  o.afbrydere.forEach(a => { a.art = a.art || 'enpolet'; a.gruppeId = a.gruppeId || ''; a.lokaleId = a.lokaleId || ''; a.steder = Number(a.steder) || 1; if (a.art === 'kryds') a.steder = Math.min(6, Math.max(3, Math.round(a.steder))); /* skema 11: krydsafbryder med 3 til 6 betjeningssteder */ a.tid = Number(a.tid) || 3;
    /* skema 13: afbryderens eget træk fra en dåse eller en brugsgenstand (0 m = intet træk). Indgår ikke i ΔU */
    a.daaseId = a.daaseId || ''; a.fraEnhed = eid.has(a.fraEnhed) ? a.fraEnhed : ''; a.kabel = a.kabel ? kabMap(a.kabel) : 'PVC'; a.ledere = a.ledere || '3G'; a.tv = Number(a.tv) || 1.5; a.laengde = Number(a.laengde) || 0; traek(a);
    a.a = (Array.isArray(a.a) ? a.a : []).filter(x => eid.has(x)); a.b = (Array.isArray(a.b) ? a.b : []).filter(x => eid.has(x)); });
  /* skema 15: brandlukninger. Billederne ligger i IndexedDB; projektet gemmer kun id'erne */
  o.brandlukninger = o.brandlukninger.filter(b => b && typeof b === 'object');
  o.brandlukninger.forEach((b, i) => { b.id = typeof b.id === 'string' && b.id ? b.id : 'bl' + (i + 1); b.nr = Math.round(Number(b.nr)) > 0 ? Math.round(Number(b.nr)) : i + 1; b.lokaleId = String(b.lokaleId || '');
    for (const k of ['placering', 'beskrivelse', 'brandklasse', 'produkt', 'note']) b[k] = String(b[k] == null ? '' : b[k]);
    b.udfoert = !!b.udfoert; b.maerkat = !!b.maerkat; b.billeder = bIdListe(b.billeder); });
  /* skema 16: billeder på tavler, lokaler og samledåser (forslag 15). Kun id'erne; billederne ligger i IndexedDB */
  for (const k of ['tavler', 'lokaler', 'daaser']) o[k].forEach(x => { x.billeder = bIdListe(x.billeder); });
  o.tavler.forEach(t => { const g = o.grupper.find(x => x.id === t.fraGruppe); if (g && g.tavleId !== t.id) t.fra = g.tavleId; else t.fraGruppe = ''; });
  return o;
}
function seed() {
  const G = (id, tavleId, nr, navn, type, In, faser, fase, rcdId) => ({ id, tavleId, nr, navn, type, kar:'B', In, faser, fase, rcdId });
  const E = (id, gruppeId, lokaleId, navn, effekt, kabel, ledere, tv, laengde, daaseId) => ({ id, gruppeId, lokaleId, navn, effekt, kabel, ledere, tv, laengde, daaseId: daaseId || '' });
  const X = (id, art, navn, lokaleId, laengde, port, poeW, kamType, oploesning) => ({ id, art, navn, lokaleId, kabel:'Cat6A', laengde, panelId:'u1', panelPort:port, switchId:'u2', switchPort:port, patch:0.5, poeW, kamType: kamType || 'Dome', oploesning: oploesning || '4 MP', nvrId: art === 'cctv' ? 'u4' : '' });
  return norm({
    projekt: { navn:'Parcelhus, renovering', sagsnr:'2026-104', kunde:'Familien Eksempel', adresse:'Eksempelvej 12, 5000 Odense C', installatoer:'', dato:new Date().toISOString().slice(0, 10) },
    tavler: [ { id:'t1', navn:'HT', placering:'Hovedtavle, bryggers', forsikring:50, hovedafbryder:63 }, { id:'t2', navn:'UT1', placering:'Undertavle, garage', forsikring:25, fra:'t1', fraGruppe:'g13', tilgang:'5G6 PVIKJ, 14 m', tKabel:'PVC', tLedere:'5G', tTv:6, tLaengde:14 } ],
    rcds: [ { id:'r1', tavleId:'t1', navn:'HPFI 1', type:'A', In:40, idn:30 }, { id:'r2', tavleId:'t1', navn:'HPFI 2', type:'A', In:40, idn:30 },
            { id:'r3', tavleId:'t2', navn:'HPFI 1', type:'A', In:40, idn:30 } ],
    lokaler: [ { id:'l1', navn:'Køkken', etage:'Stue' }, { id:'l2', navn:'Stue', etage:'Stue' }, { id:'l3', navn:'Bryggers', etage:'Stue' },
      { id:'l4', navn:'Badeværelse', etage:'Stue' }, { id:'l5', navn:'Soveværelse', etage:'1. sal' }, { id:'l6', navn:'Garage', etage:'Stue' }, { id:'l7', navn:'Terrasse', etage:'Ude' } ],
    grupper: [
      G('g1', 't1', 1, 'Lys køkken og stue', 'lys', 10, 1, 'L1', 'r1'), G('g2', 't1', 2, 'Lys bad og soveværelse', 'lys', 10, 1, 'L1', 'r1'),
      G('g3', 't1', 3, 'Stik stue og soveværelse', 'stik', 13, 1, 'L1', 'r1'), G('g4', 't1', 4, 'Stik køkkenbord', 'stik', 13, 1, 'L2', 'r1'),
      G('g5', 't1', 5, 'Komfur', 'kraft', 16, 3, 'L1', 'r2'), G('g6', 't1', 6, 'Opvaskemaskine', 'kraft', 13, 1, 'L1', 'r1'),
      G('g7', 't1', 7, 'Vask og tørretumbler', 'kraft', 16, 1, 'L1', 'r2'), G('g12', 't1', 8, 'Terrassevarmer', 'kraft', 13, 1, 'L2', 'r2'),
      G('g11', 't1', 9, 'Netværk og teknik', 'data', 10, 1, 'L3', 'r2'), G('g13', 't1', 10, 'Undertavle garage', 'kraft', 25, 3, 'L1', ''),
      G('g8', 't2', 1, 'Lys garage', 'lys', 10, 1, 'L1', 'r3'), G('g9', 't2', 2, 'Stik garage', 'stik', 13, 1, 'L2', 'r3'),
      G('g10', 't2', 3, 'Ladeboks', 'kraft', 16, 3, 'L1', '')
    ],
    enheder: [
      E('e1', 'g1', 'l1', 'Spots i loft, 8 stk.', 56, 'XLPE', '3G', 1.5, 4, 'd1'), E('e2', 'g1', 'l1', 'LED-bånd under overskabe', 30, 'XLPE', '3G', 1.5, 5, 'd1'),
      E('e3', 'g1', 'l2', 'Lampeudtag over spisebord', 60, 'XLPE', '3G', 1.5, 3.5, 'd2'), E('e4', 'g1', 'l2', 'Lampeudtag ved sofa', 40, 'XLPE', '3G', 1.5, 8, 'd2'),
      E('e5', 'g2', 'l4', 'Loftarmatur IP44', 24, 'XLPE', '3G', 1.5, 8), E('e6', 'g2', 'l4', 'Spejllys', 18, 'XLPE', '3G', 1.5, 9.5),
      E('e7', 'g2', 'l5', 'Lampeudtag i loft', 40, 'XLPE', '3G', 1.5, 19), E('e8', 'g3', 'l2', 'Stikkontakter, 6 stk.', 0, 'PVC', '3G', 1.5, 32),
      E('e9', 'g3', 'l5', 'Stikkontakter, 4 stk.', 0, 'PVC', '3G', 1.5, 24), E('e10', 'g4', 'l1', 'Stikkontakter over bord, 4 stk.', 0, 'PVC', '3G', 2.5, 12),
      E('e11', 'g4', 'l1', 'Emhætte', 250, 'PVC', '3G', 1.5, 11), E('e12', 'g5', 'l1', 'Induktionskogeplade', 7200, 'PVC', '5G', 2.5, 13), E('e24', 'g5', 'l1', 'Indbygningsovn', 3500, 'PVC', '5G', 2.5, 12),
      E('e25', 'g4', 'l1', 'Køleskab', 120, 'PVC', '3G', 1.5, 9), E('e26', 'g4', 'l1', 'Fryser', 150, 'PVC', '3G', 1.5, 10),
      E('e13', 'g6', 'l1', 'Opvaskemaskine', 2000, 'PVC', '3G', 1.5, 10.5), E('e14', 'g7', 'l3', 'Vaskemaskine', 2200, 'PVC', '3G', 2.5, 4),
      E('e15', 'g7', 'l3', 'Tørretumbler', 2500, 'PVC', '3G', 2.5, 4.5), E('e19', 'g12', 'l7', 'Terrassevarmer', 2000, 'PVC', '3G', 1.5, 48),
      E('e16', 'g8', 'l6', 'LED-armaturer, 4 stk.', 144, 'PVC', '3G', 1.5, 16), E('e27', 'g8', 'l6', 'Udelampe ved garageport', 12, 'PVC', '3G', 1.5, 11), E('e17', 'g9', 'l6', 'Stikkontakter ved arbejdsbord, 3 stk.', 0, 'PVC', '3G', 1.5, 9),
      E('e18', 'g10', 'l6', 'Ladeboks 11 kW', 11000, 'PVC', '5G', 2.5, 7),
      E('e21', '', 'l4', 'Gulvvarme, el', 600, 'PVC', '3G', 1.5, 12), E('e22', '', 'l7', 'Udendørs stikkontakt IP44', 0, 'PVC', '3G', 2.5, 18)
    ],
    afbrydere: [
      { id:'a1', navn:'Køkken, loft og bordlys', art:'krone', gruppeId:'g1', lokaleId:'l1', steder:1, tid:3, a:['e1'], b:['e2'] },
      { id:'a2', navn:'Stue, to døre', art:'korr', gruppeId:'g1', lokaleId:'l2', steder:2, tid:3, a:['e3', 'e4'], b:[] },
      { id:'a3', navn:'Badeværelse', art:'enpolet', gruppeId:'g2', lokaleId:'l4', steder:1, tid:3, a:['e5', 'e6'], b:[] },
      { id:'a4', navn:'Soveværelse, dør og seng', art:'kip', gruppeId:'g2', lokaleId:'l5', steder:3, tid:3, a:['e7'], b:[] },
      { id:'a5', navn:'Garage', art:'trappe', gruppeId:'g8', lokaleId:'l6', steder:2, tid:3, a:['e16'], b:[] },
      { id:'a6', navn:'Udelys ved garageport', art:'sensor', gruppeId:'g8', lokaleId:'l6', steder:1, tid:5, a:['e27'], b:[] }
    ],
    daaser: [
      { id:'d1', navn:'Loft køkken', type:'PL-dåse', gruppeId:'g1', parentId:'', lokaleId:'l1', kabel:'XLPE', ledere:'3G', tv:1.5, laengde:11 },
      { id:'d2', navn:'Loft stue', type:'Membrandåse', gruppeId:'g1', parentId:'d1', lokaleId:'l2', kabel:'XLPE', ledere:'3G', tv:1.5, laengde:7 }
    ],
    racks: [ { id:'k1', navn:'R1', type:'19" vægskab', he:9, lokaleId:'l3', gruppeId:'g11' } ],
    udstyr: [
      { id:'u1', rackId:'k1', navn:'PP1', art:'patchpanel', he:1, pos:1, porte:24, poe:false, poeBudget:0, effekt:0 },
      { id:'u2', rackId:'k1', navn:'SW1', art:'switch', he:1, pos:2, porte:24, poe:true, poeBudget:65, effekt:30 },
      { id:'u3', rackId:'k1', navn:'Router', art:'router', he:1, pos:3, porte:4, poe:false, poeBudget:0, effekt:15 },
      { id:'u4', rackId:'k1', navn:'NVR1', art:'nvr', he:2, pos:4, porte:8, poe:false, poeBudget:0, effekt:25 }
    ],
    links: [
      X('x1', 'data', '1.01', 'l2', 22, 1, 0), X('x2', 'data', '1.02', 'l2', 24, 2, 0), X('x3', 'data', '1.03', 'l1', 18, 3, 0), X('x4', 'data', '1.04', 'l5', 31, 4, 0),
      X('x5', 'data', 'AP loft stue', 'l2', 20, 5, 15.4), X('x6', 'data', '1.06', 'l6', 38, 6, 0),
      Object.assign(X('x7', 'data', '1.07', 'l5', 33, 7, 0), { switchId:'', switchPort:0 }),
      X('c1', 'cctv', 'Kam 1 Indkørsel', 'l6', 41, 9, 12.95, 'Dome', '4 MP'), X('c2', 'cctv', 'Kam 2 Terrasse', 'l7', 28, 10, 12.95, 'Bullet', '8 MP (4K)'),
      X('c3', 'cctv', 'Kam 3 Hoveddør', 'l3', 12, 11, 12.95, 'Dome', '4 MP'), X('c4', 'cctv', 'Kam 4 Have', 'l7', 35, 12, 12.95, 'Bullet', '4 MP')
    ]
  });
}

function seed2() {
  const E = (id, gruppeId, lokaleId, navn, effekt, tv, laengde) => ({ id, gruppeId, lokaleId, navn, effekt, kabel:'PVC', ledere:'3G', tv, laengde });
  return norm({
    projekt: { navn:'Sommerhus, ny tavle', sagsnr:'2026-097', kunde:'Eksempel Udlejning ApS', adresse:'Strandvejen 3, 5300 Kerteminde', installatoer:'', dato:new Date().toISOString().slice(0, 10) },
    tavler: [ { id:'t1', navn:'GT', placering:'Gruppetavle, entré', forsikring:25 } ],
    rcds: [ { id:'r1', tavleId:'t1', navn:'HPFI 1', type:'A', In:40, idn:30 } ],
    lokaler: [ { id:'l1', navn:'Køkkenalrum', etage:'Stue' }, { id:'l2', navn:'Værelse', etage:'Stue' }, { id:'l3', navn:'Bad', etage:'Stue' } ],
    grupper: [
      { id:'g1', tavleId:'t1', nr:1, navn:'Lys', type:'lys', kar:'B', In:10, faser:1, fase:'L1', rcdId:'r1' },
      { id:'g2', tavleId:'t1', nr:2, navn:'Stik', type:'stik', kar:'B', In:13, faser:1, fase:'L2', rcdId:'r1' },
      { id:'g3', tavleId:'t1', nr:3, navn:'Vandvarmer', type:'kraft', kar:'B', In:13, faser:1, fase:'L3', rcdId:'r1' }
    ],
    enheder: [
      E('e1', 'g1', 'l1', 'Lampeudtag, 4 stk.', 80, 1.5, 22), E('e2', 'g1', 'l2', 'Lampeudtag', 20, 1.5, 12),
      E('e3', 'g2', 'l1', 'Stikkontakter, 6 stk.', 0, 1.5, 26), E('e4', 'g2', 'l2', 'Stikkontakter, 3 stk.', 0, 1.5, 14),
      E('e5', 'g3', 'l3', 'Vandvarmer 60 l', 2000, 1.5, 9)
    ]
  });
}
