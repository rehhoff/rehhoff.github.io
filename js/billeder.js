/* Billeder til brandlukninger (skema 15) og tavler, lokaler og samledåser (skema 16): komprimering i browseren, lagring i IndexedDB (BDB) og synkronisering til separate hemmelige Gists.
   Projekterne gemmer kun billedernes id'er (billedIds() i js/data.js). Billeder slettes aldrig automatisk, kun af oprydningen efter brugerens bekræftelse.
   Se docs/planer/2026-11-18-brandlukning.md og docs/planer/2026-11-18-billeder.md. Metoderne samles i app() i js/app.js. */
let BDB_P = null;
const BSOEGT = new Set();  /* id'er, der ikke fandtes i nogen billed-Gist i denne session; forsøges ikke igen */
let BMAKS = 250;           /* billeder pr. billed-Gist (forslag 21). GitHubs liste viser højst 300 filer pr. Gist */
let BTJEKKET = false;      /* første billedsynk i en session henter altid listen over billed-Gists */
const BALDER = 24 * 3600e3; /* oprydningen rører ikke billeder på enheden, der er nyere end 24 timer */
const bdbAaben = () => {
  if (!BDB_P) BDB_P = new Promise((ok, fejl) => {
    let r; try { r = indexedDB.open(BDB, 1); } catch (e) { fejl(e); return; }
    r.onupgradeneeded = () => { const db = r.result; for (const s of ['billeder', 'mini']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath:'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => fejl(r.error || new Error('IndexedDB kunne ikke åbnes.')); r.onblocked = () => fejl(new Error('IndexedDB er blokeret af en anden fane.'));
  });
  return BDB_P.catch(e => { BDB_P = null; throw e; });
};
/* én transaktion; fn får transaktionen og kan returnere en forespørgsel, hvis resultat bliver løftets værdi */
const bdbKoer = (lagre, mode, fn) => bdbAaben().then(db => new Promise((ok, fejl) => {
  const tx = db.transaction(lagre, mode); let res;
  tx.oncomplete = () => ok(res); tx.onerror = () => fejl(tx.error); tx.onabort = () => fejl(tx.error || new Error('Gemning i IndexedDB blev afbrudt.'));
  const req = fn(tx); if (req) req.onsuccess = () => { res = req.result; };
}));
const bStr = d => Math.round((d.length - d.indexOf(',') - 1) * 3 / 4);
const bOk = d => typeof d === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]/.test(d);

const APP_BILLEDER = () => ({
    /* ved start: miniaturer i hukommelsen og en liste over de fulde billeder, der findes på enheden */
    async billedStart() {
      try {
        const [minier, noegler] = await Promise.all([bdbKoer(['mini'], 'readonly', tx => tx.objectStore('mini').getAll()), bdbKoer(['billeder'], 'readonly', tx => tx.objectStore('billeder').getAllKeys())]);
        (minier || []).forEach(m => { if (m && bOk(m.data)) BMINI[m.id] = m.data; }); (noegler || []).forEach(k => BFULD.add(k));
        this.billedOk = true;
      } catch (e) { this.billedOk = false; }
      this.billedTick++; this.billedLager(); this.planHentAlle();
    },
    billedSrc(id) { this.billedTick; return BMINI[id] || ''; },
    billedHar(id) { this.billedTick; return BFULD.has(id); },
    billedBillede(src) { return new Promise((ok, fejl) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fejl(new Error('Billedet kunne ikke læses.')); im.src = src; }); },
    billedTegn(im, maks, q) {
      const w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height, k = Math.min(1, maks / Math.max(w0, h0)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      return { data:c.toDataURL('image/jpeg', q), w:c.width, h:c.height };
    },
    /* JPEG med længste side højst 1600 px og kvalitet 0,7. Over ca. 300 KB prøves lavere kvalitet og derefter 1280 px */
    async billedKomprimer(fil) {
      const url = URL.createObjectURL(fil);
      try {
        const im = await this.billedBillede(url); let r = null;
        for (const [maks, q] of [[1600, 0.7], [1600, 0.55], [1280, 0.55]]) { r = this.billedTegn(im, maks, q); if (bStr(r.data) <= 300 * 1024) break; }
        return Object.assign(r, { mini:this.billedTegn(im, 320, 0.6).data, bytes:bStr(r.data) });
      } finally { URL.revokeObjectURL(url); }
    },
    async billedGem(id, data, mini) {
      await bdbKoer(['billeder', 'mini'], 'readwrite', tx => { tx.objectStore('billeder').put({ id, data }); tx.objectStore('mini').put({ id, data:mini, oprettet:new Date().toISOString() }); });
      BMINI[id] = mini; BFULD.add(id); this.billedTick++;
    },
    async billedData(id) { const r = await bdbKoer(['billeder'], 'readonly', tx => tx.objectStore('billeder').get(id)); return r && bOk(r.data) ? r.data : ''; },
    /* fra kamera eller galleri i brandlukningens formular */
    async billedFraFil(ev) {
      const filer = [...((ev.target && ev.target.files) || [])]; if (ev.target) ev.target.value = ''; if (!filer.length) return;
      const form = this.form; let n = 0;
      this.billedArbejder++;
      try {
        for (const fil of filer) {
          if (!/^image\//.test(fil.type || 'image/')) { this.say(fil.name + ' er ikke et billede.'); continue; }
          let r; try { r = await this.billedKomprimer(fil); } catch (e) { this.say((fil.name || 'Billedet') + ' kunne ikke læses. Prøv at tage billedet som JPEG.', false, true); continue; }
          const id = uid();
          try { await this.billedGem(id, r.data, r.mini); } catch (e) { this.say('Billedet kunne ikke gemmes i browseren (IndexedDB). Der er måske ikke plads.', false, true); continue; }
          if (Array.isArray(form.billeder)) form.billeder.push(id); n++;
        }
      } finally { this.billedArbejder--; }
      if (n && this.form !== form) this.say('Formularen blev lukket, før billederne var færdige. De er gemt på enheden, men ikke tilknyttet.');
      this.billedLager();
    },
    harBilleder() { return billedIds(this.db).size > 0; },
    billedFjern(i) { if (Array.isArray(this.form.billeder)) this.form.billeder.splice(i, 1); },
    billedFelt(type) { return ['brand', 'tavle', 'lokale', 'daase'].includes(type); },
    /* forslag 21: advarsel, når browserens lager er ved at være fuldt */
    async billedLager() {
      try {
        if (!navigator.storage || !navigator.storage.estimate) return;
        const e = await navigator.storage.estimate(), q = Number(e.quota) || 0, u = Number(e.usage) || 0;
        this.lager = q ? { u, q, fuld:u / q > 0.8 || q - u < 50 * 1048576 } : null;
      } catch (e) {}
    },
    lagerTxt() { const l = this.lager; return l && l.fuld ? 'Browserens lager er ved at være fuldt: ' + this.fmt(l.u / 1048576, 0) + ' MB af ' + this.fmt(l.q / 1048576, 0) + ' MB er brugt. Hent en backupfil, og ryd op i ubrugte billeder under Datasikring.' : ''; },
    async billedVis(id) {
      this.lysbillede = { id, src:BMINI[id] || '' };
      try { const d = await this.billedData(id); if (d && this.lysbillede && this.lysbillede.id === id) this.lysbillede.src = d; } catch (e) {}
      if (this.lysbillede && !this.lysbillede.src) { this.lysbillede = null; this.say('Billedet findes ikke på denne enhed endnu. Det hentes ved næste synkronisering, hvis det ligger på GitHub.'); }
    },
    /* alle billed-id'er, som projekterne i browseren bruger */
    brugteBilleder() {
      const ud = new Set();
      for (const p of this.projekter) { const d = p.id === this.pid ? this.db : this.laes(p.id); billedIds(d).forEach(i => ud.add(i)); }
      return ud;
    },
    /* backupfil: billederne kommer med som data-URL */
    async billederTilBackup(ids) {
      const ud = {}; let mangler = 0;
      for (const id of ids) { let d = ''; try { d = await this.billedData(id); } catch (e) {} if (d) ud[id] = d; else mangler++; }
      return { billeder:ud, mangler };
    },
    async billedImport(obj) {
      let n = 0;
      for (const [id, data] of Object.entries(obj || {})) {
        if (!BID.test(id) || !bOk(data) || BFULD.has(id)) continue;
        try { const im = await this.billedBillede(data); await this.billedGem(id, data, this.billedTegn(im, 320, 0.6).data); n++; } catch (e) {}
      }
      return n;
    },
    billedMarkoer() { return JSON.stringify({ format:'tavleoversigt-billeder', app:APP_VERSION, schema:SCHEMA, opdateret:new Date().toISOString() }); },
    async billedHentTxt(url, hvad) { let r = null; try { r = await fetch(url, { cache:'no-store' }); } catch (e) {} if (!r || !r.ok) throw new Error('Projekterne er synkroniseret, men ' + hvad + ' kunne ikke hentes fra GitHub.'); return r.text(); },
    /* alle Gists på kontoen (listen har filnavne, størrelse og raw_url, men ikke indholdet). Er listen længere end 1000, kastes en fejl */
    async ghAlleGists() {
      const ud = [];
      for (let side = 1; ; side++) {
        const gs = await this.gh('/gists?per_page=100&page=' + side); ud.push(...gs);
        if (gs.length < 100) return ud;
        if (side >= 10) throw new Error('Der er over 1000 Gists på kontoen. Billederne kan ikke gennemgås sikkert.');
      }
    },
    /* billed-Gists og deres billeder. Kaster en fejl ved nyere skema i en markørfil (skemareglen) */
    async billedGists() {
      const gists = (await this.ghAlleGists()).filter(g => g.files && g.files[BFIL]), kilder = {}, antal = {};
      for (const g of gists) {
        antal[g.id] = 0;
        for (const [navn, f] of Object.entries(g.files)) { const m = BPRE.exec(navn); if (!m) continue; antal[g.id]++; if (!kilder[m[1]]) kilder[m[1]] = f.raw_url; }
        let sch = 0; try { sch = Number(JSON.parse(await this.billedHentTxt(g.files[BFIL].raw_url, 'billedernes markørfil')).schema) || 0; } catch (e) { if (/synkroniseret/.test(e.message)) throw e; }
        if (sch > SCHEMA) throw new Error('Billederne på GitHub er gemt af en nyere version af appen (skema ' + sch + ', denne har ' + SCHEMA + '). Genindlæs siden med Ctrl+F5. Indtil da synkroniseres billeder ikke fra denne enhed.');
      }
      return { gists, kilder, antal };
    },
    /* synkronisering af billeder. Kører efter projekterne i synkNu(). Kalder kun GitHub, når der er noget at sende eller hente, og én gang pr. session som kontrol */
    async billedSynk() {
      const s = this.synk; if (!s || !s.gistId) return;
      const brugt = this.brugteBilleder(), sendt = new Set(Array.isArray(s.bSendt) ? s.bSendt : []);
      const op = [...brugt].filter(id => BFULD.has(id) && !sendt.has(id)), ned = [...brugt].filter(id => !BFULD.has(id) && !BSOEGT.has(id));
      if (!op.length && !ned.length && (BTJEKKET || !brugt.size)) return;
      const { gists, kilder, antal } = await this.billedGists(); BTJEKKET = true;
      /* listen er sandheden: et brugt billede, som ingen billed-Gist har, sendes (igen) */
      const nySendt = new Set(Object.keys(kilder)), gem = () => { s.bSendt = [...nySendt]; this.synkGem(); };
      const send = [...brugt].filter(id => BFULD.has(id) && !kilder[id]);
      if (send.length) {
        /* forslag 21: højst BMAKS billeder pr. billed-Gist. Denne enheds Gist foretrækkes, ellers en med plads, ellers en ny */
        const plads = (g, n) => (antal[g.id] || 0) + n < BMAKS;
        const vaelg = async () => {
          let g = gists.find(x => x.id === s.bGist && plads(x, 0)) || gists.find(x => plads(x, 0));
          if (!g) { g = await this.gh('/gists', { method:'POST', body:JSON.stringify({ description:'ElPlanner: billeder', public:false, files:{ [BFIL]:{ content:this.billedMarkoer() } } }) }); antal[g.id] = 0; gists.push(g); }
          s.bGist = g.id; gem(); return g;
        };
        let egen = null, portion = {}, str = 0, ids = [];
        /* svaret på PATCH er hele Gist'en med alle billeder; det læses ikke (udenSvar) */
        const afsted = async () => {
          if (!ids.length) return; portion[BFIL] = { content:this.billedMarkoer() };
          await this.gh('/gists/' + egen.id, { method:'PATCH', body:JSON.stringify({ files:portion }), udenSvar:true });
          antal[egen.id] = (antal[egen.id] || 0) + ids.length; ids.forEach(id => nySendt.add(id)); gem(); portion = {}; str = 0; ids = [];
        };
        for (const id of send) {
          const d = await this.billedData(id).catch(() => ''); if (!d) continue;
          if (ids.length && (str + d.length > 4e6 || !plads(egen, ids.length))) await afsted();
          if (!ids.length) egen = await vaelg();
          portion[BP(id)] = { content:d }; str += d.length; ids.push(id);
        }
        await afsted();
      }
      /* hent manglende billeder via raw_url (virker også, når API'et har afkortet filen) */
      for (const id of ned) {
        if (!kilder[id]) { BSOEGT.add(id); continue; }
        const d = (await this.billedHentTxt(kilder[id], 'et billede')).trim();
        if (!bOk(d)) { BSOEGT.add(id); continue; }
        const im = await this.billedBillede(d);
        await this.billedGem(id, d, this.billedTegn(im, 320, 0.6).data);
      }
      gem(); this.billedLager();
    },

    /* forslag 20: oprydning af billeder, som intet projekt, ingen automatisk backup og ingen anden enhed bruger.
       Ved den mindste tvivl kastes en fejl, og intet slettes. Se docs/planer/2026-11-18-billeder.md */
    async billedOprydFind() {
      if (this.billedArbejder) throw new Error('Et billede er ved at blive gjort klar. Prøv igen om lidt. Intet er slettet.');
      const brugt = new Set(), tjek = [], tilfoej = (raw, hvad) => {
        let d; try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { d = null; }
        if (!d || typeof d !== 'object') throw new Error(hvad + ' kunne ikke læses. Intet er slettet.');
        billedIds(d).forEach(i => brugt.add(i));
      };
      /* 1. alle projekter i browseren, også nøgler uden for listen (fx fra en anden fane) */
      this.save(); this.gemNu();
      let idx = null; try { idx = JSON.parse(localStorage.getItem(IDX)); } catch (e) { throw new Error('Projektlisten i browseren kunne ikke læses. Intet er slettet.'); }
      if (idx && (Number(idx.schema) || 0) > SCHEMA) throw new Error('Projekterne i browseren er gemt af en nyere version af appen. Genindlæs siden. Intet er slettet.');
      const pids = new Set([...this.projekter.map(p => p.id), ...((idx && Array.isArray(idx.liste)) ? idx.liste.map(p => p.id) : [])]), pre = PK('');
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) pids.add(k.slice(pre.length)); }
      for (const id of pids) { const raw = MEM[id] || localStorage.getItem(PK(id)); if (raw == null) throw new Error('Et projekt kunne ikke læses fra browserens lager. Intet er slettet.'); tilfoej(raw, 'Et projekt i browseren'); }
      tilfoej(this.db, 'Det åbne projekt'); this.hist.concat(this.fremtid || []).forEach(h => tilfoej(h, 'Fortryd-listen'));
      tjek.push(pids.size + ' projekter i browseren');
      /* 2. automatiske backups */
      const braw = localStorage.getItem(BKEY);
      if (braw != null) {
        let bl; try { bl = JSON.parse(braw); } catch (e) { bl = null; }
        if (!Array.isArray(bl)) throw new Error('De automatiske backups kunne ikke læses. Intet er slettet.');
        for (const b of bl) {
          if (!b || typeof b !== 'object' || (Number(b.schema) || 0) > SCHEMA) throw new Error('En automatisk backup kunne ikke læses. Intet er slettet.');
          Object.values(b.raw || {}).forEach(r => tilfoej(r, 'En automatisk backup'));
        }
        tjek.push(bl.length + ' automatiske backups');
      }
      /* 3. andre enheder: alle projekt-Gists på kontoen, efter en vellykket synkronisering */
      let bg = null;
      if (this.synk && this.synk.gistId) {
        if (navigator.onLine === false) throw new Error('Oprydningen kræver net, når synkronisering er slået til. Intet er slettet.');
        if (this.synkKoerer) throw new Error('Synkroniseringen kører. Prøv igen om lidt. Intet er slettet.');
        await this.synkNu();
        if (this.synkFejl || !this.synk) throw new Error('Synkroniseringen lykkedes ikke. ' + (this.synkFejl || '') + ' Intet er slettet.');
        const alle = await this.ghAlleGists(), pg = alle.filter(g => g.files && g.files[GFIL]);
        if (!pg.some(g => g.id === this.synk.gistId)) throw new Error('Projekternes Gist blev ikke fundet i listen. Intet er slettet.');
        let n = 0;
        for (const x of pg) {
          const g = await this.gh('/gists/' + x.id), filer = Object.entries(g.files || {});
          if (filer.length >= 300) throw new Error('En projekt-Gist har for mange filer til at blive gennemgået sikkert. Intet er slettet.');
          let sch = 0; try { const f = g.files[GFIL]; sch = Number(JSON.parse(f.truncated || f.content == null ? await this.billedHentTxt(f.raw_url, 'markørfilen') : f.content).schema) || 0; } catch (e) { throw new Error('Markørfilen i en projekt-Gist kunne ikke læses. Intet er slettet.'); }
          if (sch > SCHEMA) throw new Error('Projekterne på GitHub er gemt af en nyere version af appen. Genindlæs siden. Intet er slettet.');
          for (const [navn, f] of filer) {
            if (!GPRE.test(navn)) continue;
            let txt = f.content; if (f.truncated || txt == null) txt = await this.billedHentTxt(f.raw_url, navn);
            tilfoej(txt, 'Projektet ' + navn + ' på GitHub'); n++;
          }
        }
        tjek.push(n + ' projekter på GitHub (alle enheder)');
        bg = await this.billedGists();
      }
      /* kandidater på enheden: ubrugte, med en miniature, der er mindst 24 timer gammel */
      const [minier, noegler] = await Promise.all([bdbKoer(['mini'], 'readonly', tx => tx.objectStore('mini').getAll()), bdbKoer(['billeder'], 'readonly', tx => tx.objectStore('billeder').getAllKeys())]);
      const M = new Map((minier || []).map(m => [m.id, m])), lokal = []; let nye = 0;
      for (const id of new Set([...(noegler || []), ...M.keys()])) {
        if (brugt.has(id)) continue;
        const m = M.get(id), t = m && Date.parse(m.oprettet);
        if (!t || Date.now() - t < BALDER) { nye++; continue; }
        let d = ''; try { d = await this.billedData(id); } catch (e) {}
        lokal.push({ id, bytes:(d ? bStr(d) : 0) + (m && typeof m.data === 'string' ? bStr(m.data) : 0) });
      }
      /* kandidater på GitHub: ubrugte billedfiler i alle billed-Gists */
      const gh = [];
      if (bg) for (const g of bg.gists) for (const [navn, f] of Object.entries(g.files)) { const m = BPRE.exec(navn); if (m && !brugt.has(m[1])) gh.push({ gid:g.id, navn, id:m[1], bytes:Number(f.size) || 0 }); }
      return { lokal, gh, nye, tjek, synk:!!bg, brugt:brugt.size };
    },
    async billedOprydAabn() {
      this.confirm = null; this.opryd = { henter:true, fejl:'', fund:null, slettet:null }; this.modal = { type:'opryd' };
      try { this.opryd.fund = await this.billedOprydFind(); } catch (e) { this.opryd.fejl = e.message || 'Oprydningen mislykkedes. Intet er slettet.'; }
      this.opryd.henter = false;
    },
    oprydSum(L) { return (L || []).reduce((s, x) => s + x.bytes, 0); },
    oprydMB(b) { return b < 1048576 ? this.fmt(b / 1024, 0) + ' KB' : this.fmt(b / 1048576, 1) + ' MB'; },
    async billedOprydSlet() {
      const o = this.opryd; if (!o || !o.fund || o.henter) return;
      const foer = o.fund; o.henter = true; o.fejl = '';
      try {
        /* hele søgningen igen: kun det, der er ubrugt i begge søgninger, slettes */
        const ny = await this.billedOprydFind(), fl = new Set(foer.lokal.map(x => x.id)), fg = new Set(foer.gh.map(x => x.gid + '/' + x.navn));
        const lokal = ny.lokal.filter(x => fl.has(x.id)), gh = ny.gh.filter(x => fg.has(x.gid + '/' + x.navn));
        if (lokal.length) {
          await bdbKoer(['billeder', 'mini'], 'readwrite', tx => { lokal.forEach(x => { tx.objectStore('billeder').delete(x.id); tx.objectStore('mini').delete(x.id); }); });
          lokal.forEach(x => { delete BMINI[x.id]; BFULD.delete(x.id); }); this.billedTick++;
        }
        const pr = {}; gh.forEach(x => (pr[x.gid] = pr[x.gid] || []).push(x));
        let n = 0;
        for (const [gid, L] of Object.entries(pr)) for (let i = 0; i < L.length; i += 100) {
          const files = {}; L.slice(i, i + 100).forEach(x => { files[x.navn] = null; });
          await this.gh('/gists/' + gid, { method:'PATCH', body:JSON.stringify({ files }), udenSvar:true }); n += Object.keys(files).length;
        }
        if (n && this.synk) { const sl = new Set(gh.map(x => x.id)); this.synk.bSendt = (this.synk.bSendt || []).filter(i => !sl.has(i)); this.synkGem(); }
        o.slettet = { lokal:lokal.length, gh:n, bytes:this.oprydSum(lokal) + this.oprydSum(gh) }; o.fund = null;
        this.say('Oprydning: ' + lokal.length + ' billeder slettet på enheden og ' + n + ' på GitHub.');
      } catch (e) { o.fejl = (e.message || 'Oprydningen mislykkedes.') + (/Intet er slettet/.test(e.message || '') ? '' : ' Søg igen for at se, hvad der er tilbage.'); }
      o.henter = false; this.confirm = null; this.billedLager();
    },

    /* forslag 15: afsnit i dokumentationen med små billeder af tavler, lokaler og samlepunkter */
    billedDocHtml() {
      const img = id => /^data:image\//.test(BMINI[id] || '') ? '<img class="bl" src="' + esc(BMINI[id]) + '" alt="Billede">' : '<span class="m">billede mangler på denne enhed</span>';
      const rk = [['Tavler', this.db.tavler, t => t.navn + (t.placering ? ' · ' + t.placering : '')], ['Lokaler', this.db.lokaler, l => l.navn + (l.etage ? ' · ' + l.etage : '')],
        ['Samlepunkter', this.db.daaser, d => d.navn + ' · ' + d.type + (d.lokaleId ? ' · ' + this.lokaleNavn(d.lokaleId) : '') + (d.placering ? ' · ' + d.placering : '')]];
      let h = '';
      for (const [navn, L, txt] of rk) {
        const m = L.filter(x => x.billeder && x.billeder.length); if (!m.length) continue;
        h += '<h2>' + navn + '</h2>' + m.map(x => '<div class="bd"><p class="m">' + esc(txt(x)) + '</p>' + x.billeder.map(img).join(' ') + '</div>').join('');
      }
      return h ? '<section><h1>Billeder</h1>' + h + '</section>' : '';
    }
});
