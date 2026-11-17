/* Lagring: projekter i localStorage, eksport, import, backup og synkronisering via GitHub Gist. Metoderne samles i app() i js/app.js, så this er hele app-tilstanden. */
const FKEY = 'tavleoversigt.firma';
const APP_LAGRING = () => ({
    /* projekter: hvert projekt gemmes under sin egen nøgle */
    skriv(id, d) { const s = JSON.stringify(d); MEM[id] = s; try { localStorage.setItem(PK(id), s); } catch (e) { this.storageOk = false; } },
    laes(id) {
      let s = MEM[id]; try { s = s || localStorage.getItem(PK(id)); } catch (e) {}
      try { const d = JSON.parse(s); return d && Array.isArray(d.tavler) ? norm(d) : null; } catch (e) { return null; }
    },
    meta(id, d) { const p = d.projekt; return { id, navn:p.navn || 'Uden navn', sagsnr:p.sagsnr, kunde:p.kunde, adresse:p.adresse, grupper:d.grupper.length, enheder:d.enheder.length, opdateret:new Date().toISOString() }; },
    skrivIdx() { try { localStorage.setItem(IDX, JSON.stringify({ aktiv:this.pid, liste:this.projekter, schema:SCHEMA, app:APP_VERSION, sidstBackup:this.sidstBackup || '' })); } catch (e) { this.storageOk = false; } this.synkSenere(); },
    save() {
      this.storageOk = true; this.skriv(this.pid, this.db);
      const m = this.meta(this.pid, this.db), i = this.projekter.findIndex(p => p.id === this.pid);
      if (i > -1) this.projekter.splice(i, 1, m); else this.projekter.push(m);
      this.skrivIdx();
    },
    aktiver(id, d) { this.pid = id; this.db = d; this.hist = []; this.lokF = ''; this.q = ''; this.sldSel = null; this.sel = (this.sorteredeGrupper()[0] || {}).id || null; this.save(); },
    skift(id) {
      if (id === this.pid) return; this.save();
      const d = this.laes(id); if (!d) { this.say('Projektet kunne ikke læses fra browserens lager.', false, true); return; }
      this.aktiver(id, d); this.say('Skiftet til ' + (d.projekt.navn || 'projekt') + '.');
    },
    aabnProjekter() { this.confirm = null; this.pf = { navn:'', sagsnr:'', kunde:'', adresse:'' }; this.modal = { type:'projekter' }; },
    nytProjekt() {
      const navn = this.pf.navn.trim(); if (!navn) return; this.save();
      const d = tom(); Object.assign(d.projekt, this.pf, { navn, dato:new Date().toISOString().slice(0, 10) });
      this.aktiver(uid(), d); this.modal = null; this.go('tavle'); this.say('Projekt ' + navn + ' oprettet.');
    },
    dupliker(id) {
      this.save(); const d = this.laes(id); if (!d) { this.say('Projektet kunne ikke læses.', false, true); return; }
      d.projekt.navn = (d.projekt.navn || 'Projekt') + ' (kopi)'; d.projekt.sagsnr = '';
      d.grupper.forEach(g => { g.maal = { riso:'', zs:'', rcd:'', ok:false }; });
      this.aktiver(uid(), d); this.say('Kopi oprettet og åbnet. Sagsnummer og måleværdier er nulstillet.');
    },
    sletProjekt(id) {
      const p = this.projekter.find(p => p.id === id); delete MEM[id]; try { localStorage.removeItem(PK(id)); } catch (e) {}
      this.projekter = this.projekter.filter(p => p.id !== id);
      if (id === this.pid) {
        const n = this.projekter[0], d = n && this.laes(n.id);
        if (d) this.aktiver(n.id, d); else { const t = tom(); t.projekt.navn = 'Nyt projekt'; this.projekter = []; this.aktiver(uid(), t); }
      } else this.skrivIdx();
      this.say('Projekt ' + (p ? p.navn : '') + ' slettet.');
    },
    /* eksport og import */
    exportJson() { return JSON.stringify(this.db, null, 2); },

    /* datasikring: backup af alle projekter */
    backupJson() {
      const ps = this.projekter.map(p => { const d = this.laes(p.id); return d ? { id:p.id, data:d } : null; }).filter(Boolean);
      return JSON.stringify({ format:'tavleoversigt-backup', app:APP_VERSION, schema:SCHEMA, eksporteret:new Date().toISOString(), aktiv:this.pid, projekter:ps }, null, 2);
    },
    hentBackup() {
      this.save(); this.hent('tavleoversigt-backup-' + new Date().toISOString().slice(0, 10) + '.json', this.backupJson());
      this.sidstBackup = new Date().toISOString(); this.skrivIdx();
    },
    hentBackups() { try { const b = JSON.parse(localStorage.getItem(BKEY)); return Array.isArray(b) ? b : []; } catch (e) { return []; } },
    lavBackup(grund) {
      let raw = {}, idx = null;
      try { idx = JSON.parse(localStorage.getItem(IDX)); (idx && Array.isArray(idx.liste) ? idx.liste : []).forEach(p => { const v = localStorage.getItem(PK(p.id)); if (v) raw[p.id] = v; }); } catch (e) { return; }
      if (!Object.keys(raw).length) return;
      const ny = { tid:new Date().toISOString(), grund, app:(idx && idx.app) || 'ukendt', schema:(idx && idx.schema) || 0, navne:(idx.liste || []).map(p => p.navn), idx, raw };
      let liste = [ny].concat(this.hentBackups()).slice(0, BMAX);
      while (liste.length) { try { localStorage.setItem(BKEY, JSON.stringify(liste)); break; } catch (e) { liste = liste.slice(0, -1); } }
      this.backups = liste;
    },
    gendanBackup(i) {
      const b = this.backups[i]; if (!b) return; let n = 0; this.save();
      for (const [id, txt] of Object.entries(b.raw || {})) {
        let d; try { d = norm(JSON.parse(txt)); } catch (e) { continue; }
        const nyId = this.projekter.some(p => p.id === id) ? uid() : id;
        d.projekt.navn = (d.projekt.navn || 'Projekt') + ' (gendannet ' + this.datoTxt(b.tid) + ')';
        this.skriv(nyId, d); this.projekter.push(this.meta(nyId, d)); n++;
      }
      this.skrivIdx(); this.say(n + ' projekter gendannet som kopier. Dine nuværende projekter er urørte.');
    },
    importBackup(d) {
      const ps = Array.isArray(d.projekter) ? d.projekter : []; let n = 0, spring = 0; this.save();
      for (const p of ps) {
        const raw = p && (p.data || p); if (!raw || !Array.isArray(raw.tavler)) { spring++; continue; }
        const dd = norm(raw), id = p.id && !this.projekter.some(x => x.id === p.id) ? p.id : uid();
        if (p.id && this.projekter.some(x => x.id === p.id)) { const cur = this.laes(p.id); if (cur && JSON.stringify(cur) === JSON.stringify(dd)) { spring++; continue; } dd.projekt.navn = (dd.projekt.navn || 'Projekt') + ' (importeret)'; }
        this.skriv(id, dd); this.projekter.push(this.meta(id, dd)); n++;
      }
      this.skrivIdx(); this.io = '';
      this.say(n + ' projekter indlæst fra backup' + (spring ? ', ' + spring + ' sprunget over, fordi de allerede findes uændret.' : '.'));
    },
    /* synkronisering mellem enheder via en hemmelig GitHub Gist (tre-vejs fletning pr. projekt) */
    synkLaes() { try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s && s.token) return Object.assign({ gistId:'', login:'', base:{}, sidst:'' }, s); } catch (e) {} return null; },
    synkGem() { try { if (this.synk) localStorage.setItem(SKEY, JSON.stringify(this.synk)); else localStorage.removeItem(SKEY); } catch (e) {} },
    synkMarkoer() { return JSON.stringify({ format:'tavleoversigt-sync', app:APP_VERSION, schema:SCHEMA, opdateret:new Date().toISOString() }); },
    async gh(sti, opt) {
      const o = opt || {}, h = { Accept:'application/vnd.github+json', Authorization:'Bearer ' + this.synk.token };
      if (o.body) h['Content-Type'] = 'application/json';
      let r; try { r = await fetch(GH + sti, { method:o.method || 'GET', body:o.body, headers:h, cache:'no-store' }); } catch (e) { throw new Error('Ingen forbindelse til GitHub. Ændringerne er gemt i browseren og sendes, når der er net igen.'); }
      if (!r.ok) {
        const e = new Error(r.status === 401 ? 'GitHub afviste tokenet. Slå synkronisering fra, og forbind med et nyt token.' : r.status === 404 ? 'Gist\'en blev ikke fundet, eller tokenet mangler adgangen gist.'
          : r.status === 403 || r.status === 429 ? 'GitHub afviste forespørgslen (manglende adgang eller for mange kald). Prøv igen om lidt.' : 'GitHub svarede med fejl ' + r.status + '.');
        e.status = r.status; throw e;
      }
      return r.status === 204 ? null : r.json();
    },
    async synkForbind() {
      const token = this.synkTokenInput.trim(); if (!token || this.synkKoerer) return;
      this.synk = { token, gistId:'', login:'', base:{}, sidst:'' }; this.synkFejl = ''; this.synkKoerer = true;
      try {
        try { this.synk.login = (await this.gh('/user')).login || ''; } catch (e) { if (e.status === 401) throw e; }
        let gid = '';
        for (let side = 1; side <= 10 && !gid; side++) {
          const gs = await this.gh('/gists?per_page=100&page=' + side);
          const g = gs.find(g => g.files && g.files[GFIL]); if (g) gid = g.id;
          if (gs.length < 100) break;
        }
        if (!gid) gid = (await this.gh('/gists', { method:'POST', body:JSON.stringify({ description:'El-oversigtsappen: synkroniserede projekter', public:false, files:{ [GFIL]:{ content:this.synkMarkoer() } } }) })).id;
        this.synk.gistId = gid; this.synkGem(); this.synkTokenInput = '';
      } catch (e) { this.synk = null; this.synkGem(); this.synkFejl = e.message; this.synkKoerer = false; return; }
      this.synkKoerer = false; await this.synkNu();
      if (!this.synkFejl) this.say('Synkronisering slået til. Projekterne gemmes nu også i din Gist på GitHub.');
    },
    synkAfbryd() {
      clearTimeout(SYNK_T); this.synk = null; this.synkGem(); this.synkFejl = '';
      this.say('Synkronisering slået fra på denne enhed. Projekterne her og Gist\'en på GitHub er urørte.');
    },
    synkTxt() {
      if (!this.synk) return '';
      if (!this.online) return ' · offline, synkroniserer når der er net';
      if (this.synkFejl) return ' · synkronisering fejlede, se Dokumentation';
      if (this.synkKoerer) return ' · synkroniserer …';
      return this.synk.sidst ? ' · synkroniseret kl. ' + new Date(this.synk.sidst).toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit' }) : ' · synkroniseres via GitHub';
    },
    synkSenere() { if (!this.synk || this.iSynk) return; clearTimeout(SYNK_T); SYNK_T = setTimeout(() => this.synkNu(), 4000); },
    async synkNu() {
      if (this.synkKoerer) { this.synkIgen = true; return; }
      const s = this.synkLaes(); this.synk = s; if (!s || !s.gistId) return;
      if (navigator.onLine === false) { this.online = false; return; }  /* uden net: vent på online-hændelsen */
      clearTimeout(SYNK_T); this.synkKoerer = true; this.synkFejl = '';
      try { await this.synkKoer(); this.synk.sidst = new Date().toISOString(); this.synkGem(); }
      catch (e) { this.synkFejl = e.message || 'Synkroniseringen mislykkedes.'; }
      finally { this.synkKoerer = false; if (this.synkIgen && this.synk) { this.synkIgen = false; this.synkNu(); } }
    },
    async synkKoer() {
      const g = await this.gh('/gists/' + this.synk.gistId), fjern = {}, ugyldig = new Set();
      /* En ældre version må aldrig læse eller skrive data gemt med et nyere skema: dens norm() kender ikke de nye felter og ville fjerne dem ved næste afsendelse. */
      let mSchema = 0; try { mSchema = Number(JSON.parse(g.files[GFIL].content).schema) || 0; } catch (e) {}
      if (mSchema > SCHEMA) { const e = new Error('Projekterne på GitHub er gemt af en nyere version af appen (skema ' + mSchema + ', denne har ' + SCHEMA + '). Genindlæs siden med Ctrl+F5 for at hente den nyeste version. Indtil da synkroniseres der ikke fra denne enhed.'); e.status = 'skema'; throw e; }
      for (const [navn, f] of Object.entries(g.files || {})) {
        const m = GPRE.exec(navn); if (!m) continue;
        let txt = f.content;
        if (f.truncated || txt == null) { let r = null; try { r = await fetch(f.raw_url, { cache:'no-store' }); } catch (e) {} if (!r || !r.ok) throw new Error('Kunne ikke hente ' + navn + ' fra GitHub.'); txt = await r.text(); }
        let d = null; try { d = JSON.parse(txt); } catch (e) {}
        if (!d || !Array.isArray(d.tavler)) { ugyldig.add(m[1]); continue; }
        d = norm(d); fjern[m[1]] = { d, h:hashD(d) };
      }
      /* Herfra og til PATCH er alt synkront, så brugeren kan ikke ændre noget midt i fletningen. */
      this.iSynk = true;
      const base = this.synk.base || {}, nyBase = {}, filer = {}, n = { hentet:0, sendt:0, slettet:0, konflikt:0 };
      const fjernSlet = [];
      try {
        if (this.storageOk) this.skriv(this.pid, this.db);
        const eks = new Set([seed(), seed2()].map(d => { d.projekt.dato = ''; return hashD(d); }));
        const erEks = d => { const c = JSON.parse(JSON.stringify(d)); c.projekt.dato = ''; return eks.has(hashD(c)); };
        const lokale = new Set(this.projekter.map(p => p.id));
        for (const id of new Set([...lokale, ...Object.keys(fjern), ...Object.keys(base)])) {
          const L = lokale.has(id) ? this.laes(id) : null, R = fjern[id], B = base[id];
          if (ugyldig.has(id) || (lokale.has(id) && !L)) { if (B) nyBase[id] = B; continue; }
          const Lh = L && hashD(L), send = () => { filer[GP(id)] = { content:JSON.stringify(L) }; nyBase[id] = Lh; n.sendt++; };
          if (L && R) {
            if (Lh === R.h) nyBase[id] = Lh;
            else if (R.h === B) send();
            else if (Lh === B) { this.synkHent(id, R.d); nyBase[id] = R.h; n.hentet++; }
            else {
              const kid = uid(), k = R.d; k.projekt.navn = (k.projekt.navn || 'Projekt') + ' (fra anden enhed ' + this.datoTxt(new Date().toISOString()) + ')';
              this.synkHent(kid, k); filer[GP(kid)] = { content:JSON.stringify(k) }; nyBase[kid] = hashD(k);
              send(); n.sendt--; n.konflikt++;
            }
          } else if (L) {
            if (!B) { if (!erEks(L)) send(); }
            else if (Lh === B) { this.synkSletLokalt(id); n.slettet++; }
            else send();
          } else if (R) {
            if (B && R.h === B) { filer[GP(id)] = null; fjernSlet.push(id); n.slettet++; }
            else { this.synkHent(id, R.d); nyBase[id] = R.h; n.hentet++; }
          }
        }
        if (n.hentet || n.slettet || n.konflikt) this.skrivIdx();
      } finally { this.iSynk = false; }
      if (Object.keys(filer).length) {
        filer[GFIL] = { content:this.synkMarkoer() };
        await this.gh('/gists/' + this.synk.gistId, { method:'PATCH', body:JSON.stringify({ files:filer }) });
      }
      this.synk.base = nyBase;
      if (n.konflikt) this.say(n.konflikt + ' projekt' + (n.konflikt > 1 ? 'er' : '') + ' var ændret på to enheder. Begge udgaver er beholdt, og den anden hedder "fra anden enhed".');
    },
    synkHent(id, d) {
      this.skriv(id, d); const m = this.meta(id, d), i = this.projekter.findIndex(p => p.id === id);
      if (i > -1) this.projekter.splice(i, 1, m); else this.projekter.push(m);
      if (id === this.pid) { this.db = this.laes(id) || d; this.hist = []; }
    },
    synkSletLokalt(id) {
      delete MEM[id]; try { localStorage.removeItem(PK(id)); } catch (e) {}
      this.projekter = this.projekter.filter(p => p.id !== id);
      if (id === this.pid) {
        const nx = this.projekter[0], d = nx && this.laes(nx.id);
        if (d) { this.pid = nx.id; this.db = d; } else { const t = tom(); t.projekt.navn = 'Nyt projekt'; this.pid = uid(); this.db = t; this.skriv(this.pid, t); this.projekter = [this.meta(this.pid, t)]; }
        this.hist = []; this.sldSel = null; this.sel = (this.sorteredeGrupper()[0] || {}).id || null;
      }
    },
    importJson(txt, somNyt) {
      let d; try { d = JSON.parse(txt); } catch (e) { this.say('Kunne ikke læse JSON. Kontrollér at hele teksten er med.', false, true); return; }
      if (d && d.format === 'tavleoversigt-backup') { this.importBackup(d); return; }
      if (!d || !Array.isArray(d.tavler) || !Array.isArray(d.grupper) || !Array.isArray(d.enheder)) { this.say('Filen mangler tavler, grupper eller enheder og blev ikke indlæst.', false, true); return; }
      if (somNyt) { this.save(); this.aktiver(uid(), norm(d)); } else { this.mutate(() => { this.db = norm(d); }); this.sel = (this.sorteredeGrupper()[0] || {}).id || null; }
      this.io = '';
      this.say((somNyt ? 'Indlæst som nyt projekt: ' : 'Aktivt projekt erstattet: ') + this.db.grupper.length + ' grupper, ' + this.db.enheder.length + ' brugsgenstande.', !somNyt);
    },
    importFil(ev) {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => this.importJson(String(r.result), true); r.onerror = () => this.say('Filen kunne ikke læses.', false, true); r.readAsText(f); ev.target.value = '';
    },
    async hent(filename, data) {
      try {
        const d = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
        if (!d) {
          const type = /\.json$/.test(filename) ? 'application/json' : /\.svg$/.test(filename) ? 'image/svg+xml' : 'text/html';
          const url = URL.createObjectURL(new Blob([data], { type:type + ';charset=utf-8' })), a = document.createElement('a');
          a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
          this.say(filename + ' hentet.'); return;
        }
        await d.save({ filename, data }); this.say(filename + ' sendt til download.');
      } catch (e) {
        if (e && e.code === 'declined') { this.say('Download annulleret.'); return; }
        this.io = data; this.say('Download er ikke tilgængelig her. Indholdet står i feltet under Import, så det kan kopieres.');
      }
    },
    async kopier(txt) {
      try { await navigator.clipboard.writeText(txt); this.say('Kopieret til udklipsholder.'); }
      catch (e) { this.io = txt; this.say('Kopiering blev afvist. Teksten står i feltet under Import.'); }
    },
    gruppeTsv() {
      const rows = [['Tavle', 'Gr.', 'Betegnelse', 'Type', 'Sikring', 'Fase', 'HPFI', 'Kabel', 'Lokaler', 'Last (A)']];
      for (const g of this.sorteredeGrupper()) rows.push([this.tavleNavn(g.tavleId), g.nr, g.navn, this.typeLabel[g.type], g.kar + g.In, g.faser == 3 ? 'L1 L2 L3' : g.fase, this.rcdTxt(g),
        this.gruppeKabler(g.id), this.lokalerIGruppe(g.id).map(l => l.navn).join(', '), this.fmt(this.gruppeI(g.id))]);
      return rows.map(r => r.join('\t')).join('\n');
    },
    /* firmaoplysninger til dokumentationen: gælder alle projekter, gemmes kun i denne browser og synkroniseres ikke */
    firmaLaes() {
      const f = { navn:'', cvr:'', adresse:'', telefon:'', logo:'' };
      try { const s = JSON.parse(localStorage.getItem(FKEY)); if (s && typeof s === 'object') for (const k in f) if (typeof s[k] === 'string') f[k] = s[k]; } catch (e) {}
      return f;
    },
    firmaGem() { try { localStorage.setItem(FKEY, JSON.stringify(this.firma)); } catch (e) { this.say('Firmaoplysningerne kunne ikke gemmes i browseren.'); } },
    /* logo: læses som data-URL og skaleres ned til højst 400 px i bredden */
    firmaLogo(ev) {
      const fil = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!fil) return;
      if (!/^image\/(png|jpeg|gif|webp)$/.test(fil.type)) { this.say('Logoet skal være en PNG-, JPEG-, GIF- eller WebP-fil.'); return; }
      const r = new FileReader();
      r.onerror = () => this.say('Logoet kunne ikke læses.');
      r.onload = () => {
        const im = new Image();
        im.onerror = () => this.say('Logoet kunne ikke læses.');
        im.onload = () => {
          const k = Math.min(1, 400 / im.naturalWidth), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          this.firma.logo = c.toDataURL(fil.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85); this.firmaGem(); this.say('Logo gemt.');
        };
        im.src = r.result;
      };
      r.readAsDataURL(fil);
    },
    firmaFjernLogo() { this.firma.logo = ''; this.firmaGem(); },
    /* åbner dokumentationen i et nyt vindue og starter udskrivning (eller gem som PDF) */
    udskriv() {
      const w = window.open('', '_blank');
      if (!w) { this.say('Browseren blokerede det nye vindue. Tillad pop-up for denne side, eller hent dokumentationen som HTML-fil.'); return null; }
      w.document.open(); w.document.write(this.docHtml()); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
      return w;
    },
    docHtml() {
      const p = this.db.projekt, td = v => '<td>' + esc(v) + '</td>', f = this.firma || {};
      let h = '<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><title>Tavleskema ' + esc(p.navn) + '</title><style>' +
        '@page{size:A4;margin:15mm}body{font:12px/1.4 Arial,sans-serif;color:#111;margin:20mm 15mm}h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 4px;break-after:avoid}' +
        'table{border-collapse:collapse;width:100%}tr{break-inside:avoid}th,td{border:1px solid #666;padding:3px 5px;text-align:left;vertical-align:top}th{background:#e8eaeb;font-size:10px;text-transform:uppercase}' +
        '.st th{width:14%}svg{max-width:100%;height:auto;border:1px solid #999;break-inside:avoid}.af{page-break-inside:avoid;break-inside:avoid;margin:0 0 14px}.af h2{margin:10px 0 0}.af p{margin:2px 0 4px}' +
        '.k{border:1px solid #b3204f;color:#b3204f;padding:4px 6px;margin:4px 0;font-weight:bold}.s{page-break-after:always;break-after:page}.m{color:#555}' +
        '.fa{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}.fa img{max-height:60px;max-width:200px}.fa b{font-size:15px}' +
        '.sig{break-inside:avoid;margin-top:28px}.sig .sb{display:flex;gap:30px}.sig .sb div{flex:1}.sig .l{border-bottom:1px solid #111;height:34px}.sig .t{font-size:10px;color:#555;margin:2px 0 8px}' +
        '@media print{body{margin:0}}</style></head><body>';
      const fl = [f.cvr && 'CVR ' + f.cvr, f.adresse, f.telefon && 'Tlf. ' + f.telefon].filter(Boolean);
      if (f.navn || fl.length || f.logo) h += '<div class="fa">' + (/^data:image\//.test(f.logo || '') ? '<img src="' + esc(f.logo) + '" alt="Logo">' : '') + '<div>' + (f.navn ? '<b>' + esc(f.navn) + '</b><br>' : '') + esc(fl.join(' · ')) + '</div></div>';
      h += '<section class="s"><h1>' + esc(p.navn || 'Projekt') + '</h1><table class="st"><tr><th>Sagsnr.</th>' + td(p.sagsnr) + '<th>Kunde</th>' + td(p.kunde) + '</tr><tr><th>Adresse</th>' + td(p.adresse) + '<th>Installatør</th>' + td(p.installatoer) + '</tr><tr><th>Dato</th>' + td(p.dato) +
        '<th>Omfang</th>' + td(this.db.tavler.length + ' tavler, ' + this.db.grupper.length + ' grupper, ' + this.db.enheder.length + ' brugsgenstande') + '</tr></table><h2>Enstregsdiagram</h2>' + this.sld(true) + '</section>';
      this.db.tavler.forEach((t, i) => {
        h += '<section' + (i < this.db.tavler.length - 1 ? ' class="s"' : '') + '><h1>Gruppeskema · ' + esc(t.navn) + '</h1><p class="m">' + esc([p.navn, p.sagsnr && 'Sag ' + p.sagsnr, t.placering, 'Forsikring ' + t.forsikring + ' A', p.installatoer, p.dato].filter(Boolean).join(' · ')) + '</p>';
        h += '<table><tr><th>Gr.</th><th>Betegnelse</th><th>Type</th><th>Sikring</th><th>Fase</th><th>HPFI</th><th>Kabel</th><th>Lokaler</th><th>Last</th></tr>';
        for (const g of this.grupperFor(t.id)) h += '<tr>' + [g.nr, g.navn, this.typeLabel[g.type], g.kar + g.In, g.faser == 3 ? 'L1 L2 L3' : g.fase, this.rcdTxt(g), this.gruppeKabler(g.id),
          this.lokalerIGruppe(g.id).map(l => l.navn).join(', '), this.fmt(this.gruppeI(g.id)) + ' A'].map(td).join('') + '</tr>';
        h += '</table><h2>Brugsgenstande og kabler</h2><table><tr><th>Gr.</th><th>Brugsgenstand</th><th>Lokale</th><th>Kabel</th><th>Længde</th><th>Effekt</th><th>ΔU</th></tr>';
        for (const g of this.grupperFor(t.id)) for (const d of this.daaserFor(g.id)) h += '<tr>' + [g.nr, 'Samlepunkt ' + this.daaseTxt(d.id) + (d.parentId ? ' (fra ' + this.daaseTxt(d.parentId) + ')' : ''), this.lokaleNavn(d.lokaleId), d.kabel + ' ' + this.kabelDim(d), this.fmt(d.laengde) + ' m', '–', '–'].map(td).join('') + '</tr>';
        for (const g of this.grupperFor(t.id)) for (const e of this.enhederFor(g.id)) h += '<tr>' + [g.nr, e.navn + (this.enhed(e.fraEnhed) ? ' (sløjfe fra ' + this.enhed(e.fraEnhed).navn + ')' : e.daaseId ? ' (via ' + this.daaseTxt(e.daaseId) + ')' : ''), this.lokaleNavn(e.lokaleId), e.kabel + ' ' + this.kabelDim(e), this.fmt(e.laengde) + ' m',
          e.effekt ? e.effekt + ' W' : '–', e.effekt ? this.fmt(this.du(e), 2) + ' %' : '–'].map(td).join('') + '</tr>';
        h += '</table><h2>Verifikation · måleskema</h2><p class="k">Kladde til egenkontrol. Ikke en gyldig installationsattest eller sikkerhedsdokumentation.</p>' +
          '<table><tr><th>Gr.</th><th>Betegnelse</th><th>Isolationsmodstand (MΩ)</th><th>Zs (Ω)</th><th>Maks. Zs (Ω)</th><th>HPFI udløsetid (ms)</th><th>Visuel kontrol</th><th>Vurdering</th></tr>';
        for (const g of this.grupperFor(t.id)) h += '<tr>' + [g.nr, g.navn, g.maal.riso, g.maal.zs, this.zsMax(g) ? this.fmt(this.zsMax(g), 2) : '–', g.maal.rcd, g.maal.ok ? 'OK' : '', this.maalVurdering(g).txt].map(td).join('') + '</tr>';
        h += '</table><h2>Kortslutning og selektivitet</h2><p class="m">' + esc('Ze ved tavlen: ' + (this.tavleZe(t.id) == null ? 'ikke angivet' : this.fmt(this.tavleZe(t.id), 3) + ' Ω') + ' · Ik,maks: ' + (this.tavleIkMaks(t.id) ? this.fmt(this.tavleIkMaks(t.id)) + ' kA' : 'ikke angivet')) + '</p>' +
          '<table><tr><th>Gr.</th><th>Betegnelse</th><th>Sikring</th><th>Ia (A)</th><th>Ik,min (A)</th><th>Udkobling</th><th>Brydeevne (kA)</th></tr>';
        for (const g of this.grupperFor(t.id)) { const k = this.ikMin(g); h += '<tr>' + [g.nr, g.navn, g.kar + g.In, this.ia(g) ? this.fmt(this.ia(g), 0) : '–', k ? this.ikVis(k) : '–', !k || k.ok == null ? '–' : k.ok ? 'OK' : 'Ik,min under Ia',
          this.fmt(Number(g.brydeevne) || 6) + (this.brydeFejl(t.id).includes(g) ? ' (under Ik,maks)' : '')].map(td).join('') + '</tr>'; }
        h += '</table>';
        for (const w of this.kortslutFejl().concat(this.selektivitet()).filter(w => w.t === t.id)) h += '<p>⚠ ' + esc(w.txt) + '</p>';
        h += '<p class="m">Kortslutning og selektivitet er vejledende: Ik,min = 0,95 · 230 V / (Ze + R fase + R PE) i gruppens yderste punkt, ledermodstand × 1,2 (PVC) eller 1,28 (XLPE og brandkabel), PE som faseleder. Udkobling er OK, når Ik,min ≥ Ia. Selektivitet: forsikring ≥ 1,6 × største efterfølgende sikring; HPFI i serie kræver type S forrest og IΔn ≥ 3 × den bageste.</p>';
        h += '<p class="m">Beregninger er vejledende: ρ = 0,0225 Ω·mm²/m, cos φ = 1, med gruppens samtidighedsfaktor. Grænser for målinger: Zs ≤ 2/3 · U0/Ia (Ia = 5/10/20 × In for B/C/D), HPFI ≤ 300 ms ved 1 × IΔn, isolationsmodstand ≥ 1 MΩ.</p></section>';
      });
      if (this.db.racks.length || this.db.links.length) {
        h += '<section><h1>Svagstrøm · PDS og CCTV</h1>';
        for (const rk of this.db.racks) {
          h += '<h2>Rack ' + esc(rk.navn) + ' · ' + esc(rk.type) + ' · ' + esc(this.lokaleNavn(rk.lokaleId)) + '</h2><table><tr><th>HE</th><th>Udstyr</th><th>Art</th><th>Porte</th><th>PoE</th><th>Egenforbrug</th></tr>';
          for (const u of this.udstyrFor(rk.id)) h += '<tr>' + [u.pos, u.navn, this.udstArt[u.art], u.porte, u.poe ? this.fmt(this.poeBrug(u.id)) + ' / ' + u.poeBudget + ' W' : '–', u.effekt + ' W'].map(td).join('') + '</tr>';
          h += '</table>';
        }
        h += '<h2>Forbindelser og portoversigt</h2><table><tr><th>Art</th><th>Betegnelse</th><th>Lokale</th><th>Kabel</th><th>Længde</th><th>Patchpanel</th><th>Switch</th><th>PoE</th><th>Kamera / NVR</th></tr>';
        for (const l of this.db.links) h += '<tr>' + [l.art === 'cctv' ? 'CCTV' : 'PDS', l.navn, this.lokaleNavn(l.lokaleId), l.kabel, this.fmt(l.laengde) + ' m', this.portTxt(l, 'panel'), this.portTxt(l, 'switch'),
          Number(l.poeW) ? this.fmt(l.poeW, 2) + ' W' : '–', l.art === 'cctv' ? l.kamType + ' ' + l.oploesning + ' · ' + (this.udstTxt(l.nvrId) || '–') : '–'].map(td).join('') + '</tr>';
        h += '</table></section>';
      }
      if (this.db.afbrydere.length) {
        h += '<section class="s"><h1>Afbrydere og tændinger</h1><table><tr><th>Betegnelse</th><th>Type</th><th>Gruppe</th><th>Lokale</th><th>Betjeningssteder</th><th>Tænding 1</th><th>Tænding 2</th></tr>';
        for (const a of this.db.afbrydere) h += '<tr>' + [a.navn, this.afbArt[a.art], this.gruppe(a.gruppeId) ? this.gruppeTxt(a.gruppeId) : '–', this.lokaleNavn(a.lokaleId), this.afbSteder(a) + (a.art === 'trappe' || a.art === 'sensor' ? ' · ' + this.fmt(a.tid) + ' min' : ''),
          this.afbLamper(a, 'a') || '–', a.art === 'krone' ? (this.afbLamper(a, 'b') || '–') : '–'].map(td).join('') + '</tr>';
        h += '</table></section><section><h1>Tændingsdiagrammer</h1><p class="m">Vist i udgangsstilling med slukket lys. Orange ledere er spændingsførende, blå er nul, grå er spændingsløse. Lampenumrene svarer til listen under hvert diagram.</p>';
        for (const a of this.db.afbrydere) h += '<div class="af"><h2>' + esc(a.navn) + '</h2><p class="m">' + esc([this.afbArt[a.art], this.gruppe(a.gruppeId) ? this.gruppeTxt(a.gruppeId) : 'Ingen gruppe', this.lokaleNavn(a.lokaleId)].join(' · ')) + '</p>' + this.taendSvg(a, true) +
          '<p>' + esc((a.art === 'krone' ? 'Tænding 1: ' : 'Lamper: ') + (this.afbLamper(a, 'a') || 'ingen valgt') + (a.art === 'krone' ? ' · Tænding 2: ' + (this.afbLamper(a, 'b') || 'ingen valgt') : '')) + '</p></div>';
        h += '</section>';
      }
      const blok = t => '<div><b>' + t + '</b><div class="l"></div><div class="t">Navn</div><div class="l"></div><div class="t">Dato</div><div class="l"></div><div class="t">Underskrift</div></div>';
      h += '<section class="sig"><h2>Underskrift</h2><div class="sb">' + blok('Montør') + blok('Ansvarlig for kvalitetsledelsessystem (KLS)') + '</div></section>';
      return h + '</body></html>';
    }
});
