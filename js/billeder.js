/* Billeder til brandlukninger (skema 15): komprimering i browseren, lagring i IndexedDB (BDB) og synkronisering til en separat hemmelig Gist.
   Projekterne gemmer kun billedernes id'er. Billeder slettes aldrig automatisk. Se docs/planer/2026-11-18-brandlukning.md. Metoderne samles i app() i js/app.js. */
let BDB_P = null;
const BSOEGT = new Set();  /* id'er, der ikke fandtes i nogen billed-Gist i denne session; forsøges ikke igen */
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
      this.billedTick++;
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
    },
    async billedVis(id) {
      this.lysbillede = { id, src:BMINI[id] || '' };
      try { const d = await this.billedData(id); if (d && this.lysbillede && this.lysbillede.id === id) this.lysbillede.src = d; } catch (e) {}
      if (this.lysbillede && !this.lysbillede.src) { this.lysbillede = null; this.say('Billedet findes ikke på denne enhed endnu. Det hentes ved næste synkronisering, hvis det ligger på GitHub.'); }
    },
    /* alle billed-id'er, som projekterne i browseren bruger */
    brugteBilleder() {
      const ud = new Set();
      for (const p of this.projekter) { const d = p.id === this.pid ? this.db : this.laes(p.id); if (d) d.brandlukninger.forEach(b => b.billeder.forEach(i => ud.add(i))); }
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
    /* synkronisering af billeder. Kører efter projekterne i synkNu() og kalder kun GitHub, når der er noget at sende eller hente */
    async billedSynk() {
      const s = this.synk; if (!s || !s.gistId) return;
      const brugt = this.brugteBilleder(), sendt = new Set(Array.isArray(s.bSendt) ? s.bSendt : []);
      const op = [...brugt].filter(id => BFULD.has(id) && !sendt.has(id)), ned = [...brugt].filter(id => !BFULD.has(id) && !BSOEGT.has(id));
      if (!op.length && !ned.length) return;
      /* listen over Gists har filnavne og raw_url, men ikke indholdet. Alle Gists med billedmarkøren tæller */
      const kilder = {}, gists = [];
      for (let side = 1; side <= 10; side++) {
        const gs = await this.gh('/gists?per_page=100&page=' + side);
        for (const g of gs) {
          if (!g.files || !g.files[BFIL]) continue; gists.push(g);
          for (const [navn, f] of Object.entries(g.files)) { const m = BPRE.exec(navn); if (m && !kilder[m[1]]) kilder[m[1]] = f.raw_url; }
        }
        if (gs.length < 100) break;
      }
      const hent = async (url, hvad) => { let r = null; try { r = await fetch(url, { cache:'no-store' }); } catch (e) {} if (!r || !r.ok) throw new Error('Projekterne er synkroniseret, men ' + hvad + ' kunne ikke hentes fra GitHub.'); return r.text(); };
      for (const g of gists) {
        let sch = 0; try { sch = Number(JSON.parse(await hent(g.files[BFIL].raw_url, 'billedernes markørfil')).schema) || 0; } catch (e) { if (/synkroniseret/.test(e.message)) throw e; }
        if (sch > SCHEMA) throw new Error('Billederne på GitHub er gemt af en nyere version af appen (skema ' + sch + ', denne har ' + SCHEMA + '). Genindlæs siden med Ctrl+F5. Indtil da synkroniseres billeder ikke fra denne enhed.');
      }
      Object.keys(kilder).forEach(id => sendt.add(id));
      const gem = () => { s.bSendt = [...sendt]; this.synkGem(); };
      /* upload: kun billeder, som ingen billed-Gist har, i portioner på højst ca. 4 MB */
      const send = op.filter(id => !kilder[id]);
      if (send.length) {
        let egen = gists.find(g => g.id === s.bGist) || gists[0];
        if (!egen) egen = await this.gh('/gists', { method:'POST', body:JSON.stringify({ description:'El-oversigtsappen: billeder til brandlukninger', public:false, files:{ [BFIL]:{ content:this.billedMarkoer() } } }) });
        s.bGist = egen.id; gem();
        let portion = {}, str = 0, ids = [];
        const afsted = async () => {
          if (!ids.length) return; portion[BFIL] = { content:this.billedMarkoer() };
          await this.gh('/gists/' + egen.id, { method:'PATCH', body:JSON.stringify({ files:portion }) });
          ids.forEach(id => sendt.add(id)); gem(); portion = {}; str = 0; ids = [];
        };
        for (const id of send) {
          const d = await this.billedData(id).catch(() => ''); if (!d) continue;
          if (ids.length && str + d.length > 4e6) await afsted();
          portion[BP(id)] = { content:d }; str += d.length; ids.push(id);
        }
        await afsted();
      }
      /* hent manglende billeder via raw_url (virker også, når API'et har afkortet filen) */
      for (const id of ned) {
        if (!kilder[id]) { BSOEGT.add(id); continue; }
        const d = (await hent(kilder[id], 'et billede')).trim();
        if (!bOk(d)) { BSOEGT.add(id); continue; }
        const im = await this.billedBillede(d);
        await this.billedGem(id, d, this.billedTegn(im, 320, 0.6).data); sendt.add(id);
      }
      gem();
    }
});
