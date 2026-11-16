/* app(): tilstand, init() og brugerfladen. Metoder fra beregning.js, diagram.js og lagring.js lægges på med bland(). */
function bland(...dele) { const r = {}; for (const d of dele) Object.defineProperties(r, Object.getOwnPropertyDescriptors(d)); return r; }

function app() {
  return bland({
    view: 'tavle',
    views: [ { id:'tavle', l:'Tavle' }, { id:'enstreg', l:'Enstregsdiagram' }, { id:'taending', l:'Tændingsdiagram' }, { id:'samlepunkter', l:'Samlepunkter & dåser' }, { id:'svag', l:'Svagstrøm' }, { id:'beregning', l:'Beregning' }, { id:'lokaler', l:'Lokaler' }, { id:'kabler', l:'Kabler' }, { id:'dokumentation', l:'Dokumentation' }, { id:'fejlfinder', l:'Fejlfinder' } ],
    db: tom(), hist: [], sel: null, drag: null, over: null,
    projekter: [], pid: '', pf: { navn:'', sagsnr:'', kunde:'', adresse:'' }, sldSel: null, z: { x:8, y:8, k:1 }, pan: null, panMoved: false,
    filter: { q:'', tavle:'', type:'', lokale:'' }, sort: { key:'gruppe', dir:1 },
    modal: null, form: {}, confirm: null, toast: null, storageOk: true, tema: 'auto', qa: '', io: '',
    typeLabel: { lys:'Lys', kraft:'Kraft', stik:'Stik', data:'Data og teknik' },
    modalNavn: { afbryder:'afbryder', tavle:'tavle', rcd:'HPFI', lokale:'lokale', gruppe:'gruppe', enhed:'brugsgenstand', daase:'samlepunkt', rack:'rackskab', udstyr:'rackudstyr', link:'forbindelse' },
    udstArt: { patchpanel:'Patchpanel', switch:'Switch', router:'Router', nvr:'NVR (optager)', andet:'Andet udstyr' },
    daaseTyper: DAASER,
    rackTyper: ['19" vægskab', '19" gulvskab', '10" vægskab'],
    datakabler: ['Cat6', 'Cat6A', 'Cat7', 'Fiber OM4', 'Fiber OS2'],
    ampTrin: [25, 35, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 630], svFilter: '',
    kabeltyper: KABLER,
    synk: null, synkTokenInput: '', synkKoerer: false, synkIgen: false, synkFejl: '', iSynk: false,
    tvs: TV, appVersion: APP_VERSION, backups: [], sidstBackup: '', persistent: false, lokF: '', q: '', soegAaben: false, sk: { key:'koekken', navn:'Køkken', tavleId:'' }, skabeloner: SKABELONER, anlaegNavn: ANLAEG,
    enhNavne: [...new Set(EFFEKT.map(x => x[2]))].sort((a, b) => a.localeCompare(b, 'da')), sim: {}, hurtig: { aaben:false, type:'lokale', felt:'', f:{} }, eAuto: true, belEnhSidst: 'W', dragL: null, overL: null, mFilter: '', dAuto: { type:true, lok:true },
    manglerKat: { gruppe:'Uden gruppe', tilgang:'Dåse uden tilgang', afgang:'Dåse uden afgang', port:'Mangler port i rack' },
    afbArt: { enpolet:'Enpolet afbryder', krone:'Kroneafbryder', korr:'Korrespondanceafbryder', kip:'Kiprelæ med tryk', trappe:'Trappeautomat med tryk', sensor:'Sensor (PIR)' },
    afbPrincip: {
      enpolet: 'Afbryderen bryder fasen. Den tændte leder føres til lampestedet, mens nul og jord føres uden om afbryderen.',
      krone: 'To kontakter i samme afbryder deler én fase. Hver kontakt har sin egen tændte leder, så to tændinger kan betjenes hver for sig fra samme sted.',
      korr: 'To skiftekontakter er forbundet med to korrespondanceledere. Fasen går ind på den ene og den tændte leder ud fra den anden, så lyset kan betjenes fra begge steder.',
      kip: 'Trykkene er sluttekontakter med fjederretur og sidder parallelt. Hver impuls på spolen skifter relæets kontakt, så lyset tændes og slukkes fra alle tryk.',
      sensor: 'Sensoren har fase og nul fast tilsluttet og slutter selv den tændte leder, når den registrerer bevægelse. Lyset slukker, når efterløbstiden er gået. I diagrammet er tiden forkortet til 5 sekunder.',
      trappe: 'Trykkene sidder parallelt og starter tidsrelæet. Kontakten slutter straks og bryder igen, når den indstillede tid er gået. I diagrammet er tiden forkortet til 5 sekunder.'
    },
    afbLedere: {
      enpolet: ['Fase og tændt leder', 'Tændt leder, nul og jord'], krone: ['Fase og to tændte ledere', 'To tændte ledere, nul og jord'],
      korr: ['Fase eller tændt leder samt to korrespondanceledere', 'Tændt leder, nul og jord'],
      sensor: ['Fase og nul til sensoren, tændt leder ud', 'Tændt leder, nul og jord'],
      kip: ['Fase og impulsleder til hvert tryk', 'Tændt leder fra relæet, nul og jord'], trappe: ['Fase og impulsleder til hvert tryk', 'Tændt leder fra relæet, nul og jord']
    },
    symNavn: { auto:'Automatisk ud fra navnet', lys:'Lampe', stik:'Stikkontakt', koel:'Køleskab', frys:'Fryser', ovn:'Ovn', koge:'Kogeplade', mikro:'Mikroovn', opvask:'Opvaskemaskine',
      vask:'Vaskemaskine', toerre:'Tørretumbler', emhaette:'Emhætte', vvb:'Vandvarmer', varme:'Elvarme', vp:'Varmepumpe', motor:'Motor', ev:'Ladeboks', it:'IT-udstyr', gen:'Andet' },

    init() {
      window.__alpineOk = true;
      let idx = null;
      try { idx = JSON.parse(localStorage.getItem(IDX)); this.tema = localStorage.getItem(TKEY) || 'auto'; } catch (e) { this.storageOk = false; }
      if (idx && Array.isArray(idx.liste) && idx.liste.length && (Number(idx.schema) || 0) < SCHEMA) this.lavBackup('Automatisk før opdatering fra skema ' + (Number(idx.schema) || 'uden nummer') + ' til ' + SCHEMA);
      if (idx && idx.sidstBackup) this.sidstBackup = idx.sidstBackup;
      if (idx && Array.isArray(idx.liste) && idx.liste.length) {
        this.projekter = idx.liste; this.pid = idx.liste.some(p => p.id === idx.aktiv) ? idx.aktiv : idx.liste[0].id;
        this.db = this.laes(this.pid) || tom();
      } else {
        let old = null; try { old = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD)); } catch (e) {}
        const harOld = !!(old && Array.isArray(old.tavler));
        this.pid = uid(); this.db = harOld ? norm(old) : seed(); this.projekter = [{ id:this.pid }];
        if (!this.db.projekt.navn) this.db.projekt.navn = 'Mit projekt';
        if (!harOld) { const id2 = uid(), d2 = seed2(); this.skriv(id2, d2); this.projekter.push(this.meta(id2, d2)); }
      }
      this.save();
      this.sel = (this.gruppe('g7') || this.sorteredeGrupper()[0] || {}).id || null;
      this.brugTema();
      const route = () => { const h = location.hash.slice(1); if (this.views.some(v => v.id === h)) { this.view = h; if (h === 'enstreg') this.$nextTick(() => this.tilpas()); } };
      route(); window.addEventListener('hashchange', route);
      this.backups = this.hentBackups();
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).then(p => { this.persistent = !!p; }).catch(() => {}); } catch (e) {}
      window.addEventListener('storage', ev => {
        if (ev.key === PK(this.pid) && ev.newValue) {
          delete MEM[this.pid]; const d = this.laes(this.pid);
          if (d) { this.db = d; this.hist = []; this.say('Projektet blev ændret i en anden fane og er indlæst igen.'); }
        } else if (ev.key === IDX && ev.newValue) {
          try { const x = JSON.parse(ev.newValue); if (Array.isArray(x.liste)) { this.projekter = x.liste; if (x.sidstBackup) this.sidstBackup = x.sidstBackup; } } catch (e) {}
        } else if (ev.key === SKEY) this.synk = this.synkLaes();
      });
      this.synk = this.synkLaes();
      if (this.synk) this.synkNu();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.synk) this.synkNu(); });
    },
    datoTxt(iso) { const d = new Date(iso); return isNaN(d) ? '–' : d.toLocaleString('da-DK', { dateStyle:'short', timeStyle:'short' }); },
    stamTxt() { const p = this.db.projekt; return [p.sagsnr && 'Sag ' + p.sagsnr, p.kunde, p.adresse].filter(Boolean).join(' · '); },
    filnavn(base, ext) {
      const p = this.db.projekt, slug = String(p.sagsnr || p.navn || 'projekt').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return base + '-' + (slug || 'projekt') + '.' + ext;
    },
    mutate(fn) { this.hist.push(JSON.stringify(this.db)); if (this.hist.length > 40) this.hist.shift(); fn(); this.syncDaaser(); this.save(); },
    undo() { if (!this.hist.length) return; this.db = norm(JSON.parse(this.hist.pop())); this.save(); this.say('Fortrudt.'); },
    say(txt, undo) { const t = { txt, undo: !!undo }; this.toast = t; setTimeout(() => { if (this.toast === t) this.toast = null; }, 4500); },
    go(v) { this.view = v; try { location.hash = v; } catch (e) {} if (v === 'enstreg') this.$nextTick(() => this.tilpas()); },
    skiftTema() { this.tema = { auto:'light', light:'dark', dark:'auto' }[this.tema]; try { localStorage.setItem(TKEY, this.tema); } catch (e) {} this.brugTema(); },
    brugTema() {
      const r = document.documentElement, v = this.tema === 'auto' ? hostTema : this.tema;
      if (v) r.setAttribute('data-theme', v); else r.removeAttribute('data-theme');
    },

    /* opslag */
    tavle(id) { return this.db.tavler.find(t => t.id === id); },
    gruppe(id) { return this.db.grupper.find(g => g.id === id); },
    sg() { return this.gruppe(this.sel); },
    mid() { return this.modal ? this.modal.id : null; },
    tavleNavn(id) { const t = this.tavle(id); return t ? t.navn : '?'; },
    gruppeTxt(id) { const g = this.gruppe(id); return g ? this.tavleNavn(g.tavleId) + ' · ' + g.nr + ' ' + g.navn : 'Ikke tildelt'; },
    lokaleNavn(id) { const l = this.db.lokaler.find(l => l.id === id); return l ? l.navn : 'Lokale ikke angivet'; },
    typeOf(e) { const g = this.gruppe(e.gruppeId); return g ? g.type : ''; },
    grupperFor(tid) { return this.db.grupper.filter(g => g.tavleId === tid).sort((a, b) => a.nr - b.nr); },
    rcdsFor(tid) { return this.db.rcds.filter(r => r.tavleId === tid); },
    rcd(g) { return this.db.rcds.find(r => r.id === g.rcdId && r.tavleId === g.tavleId); },
    rcdNavn(g) { const r = this.rcd(g); return r ? r.navn : ''; },
    rcdTxt(g) { const r = this.rcd(g); return r ? r.navn + ', ' + r.idn + ' mA type ' + r.type : 'Ingen'; },
    sorteredeGrupper() { return this.db.tavler.flatMap(t => this.grupperFor(t.id)); },
    enhederFor(gid) { return this.db.enheder.filter(e => e.gruppeId === gid); },
    enhederILokale(lid) { return this.db.enheder.filter(e => e.lokaleId === lid); },
    lokalerIGruppe(gid) { const ids = new Set(this.enhederFor(gid).map(e => e.lokaleId)); return this.db.lokaler.filter(l => ids.has(l.id)); },
    grupperILokale(lid) { const ids = new Set(this.enhederILokale(lid).map(e => e.gruppeId)); return this.sorteredeGrupper().filter(g => ids.has(g.id)); },
    lokaleMeter(lid) { return this.sumLen(this.enhederILokale(lid).map(e => ({ e }))); },
    kabelDim(e) { return e.ledere + this.fmt(e.tv) + ' mm²'; },
    gruppeKabler(gid) { return [...new Set(this.daaserFor(gid).concat(this.enhederFor(gid)).map(e => e.ledere + this.fmt(e.tv)))].join(', '); },
    skinne(tid) {
      const out = [{ k:'main' + tid, kind:'main' }], gs = this.grupperFor(tid), brugt = new Set();
      for (const r of this.rcdsFor(tid)) {
        const under = gs.filter(g => g.rcdId === r.id);
        out.push({ k:r.id, kind:'rcd', r, n:under.length, mod: under.some(g => g.faser == 3) ? 4 : 2 });
        under.forEach(g => { brugt.add(g.id); out.push({ k:g.id, kind:'grp', g, bus:true, mod: g.faser == 3 ? 3 : 1 }); });
      }
      gs.filter(g => !brugt.has(g.id)).forEach(g => out.push({ k:g.id, kind:'grp', g, bus:false, mod: g.faser == 3 ? 3 : 1 }));
      return out;
    },

    ikon(n) { return IK[n] || ''; },
    /* samlepunkter */
    daase(id) { return this.db.daaser.find(d => d.id === id); },
    daaserFor(gid) { return this.db.daaser.filter(d => d.gruppeId === gid); },
    daaserILokale(lid) { return this.db.daaser.filter(d => d.lokaleId === lid); },
    daaseTxt(id) { const d = this.daase(id); return d ? d.type + ' ' + d.navn : ''; },
    erUnder(id, anc) { let d = this.daase(id), n = 0; while (d && n++ < 20) { if (d.parentId === anc) return true; d = this.daase(d.parentId); } return false; },
    nedstroem(did, seen) {
      seen = seen || new Set(); if (seen.has(did)) return []; seen.add(did);
      let out = this.db.enheder.filter(e => e.daaseId === did);
      for (const d of this.db.daaser.filter(d => d.parentId === did)) out = out.concat(this.nedstroem(d.id, seen));
      return out;
    },
    daaseI(did) { return this.nedstroem(did).reduce((s, e) => s + this.strom(e), 0); },
    daaseIz(d) { const g = this.gruppe(d.gruppeId); return (IZ[g && g.faser == 3 ? 3 : 2][Number(d.tv)]) || 0; },
    daaseIzFejl(d) { const g = this.gruppe(d.gruppeId); return !!g && !!this.daaseIz(d) && g.In > this.daaseIz(d); },
    duSeg(I, L, A, tre) { return tre ? Math.sqrt(3) * L * I * RHO / A / 400 * 100 : 2 * L * I * RHO / A / 230 * 100; },
    duOp(did) {
      let s = 0, d = this.daase(did), n = 0;
      while (d && n++ < 20) { const g = this.gruppe(d.gruppeId); s += this.duSeg(this.daaseI(d.id), Number(d.laengde) || 0, Number(d.tv) || 1, !!g && g.faser == 3); d = this.daase(d.parentId); }
      return s;
    },
    syncDaaser() {
      const D = this.db.daaser;
      for (let i = 0; i < D.length + 1; i++) D.forEach(d => { const p = d.parentId && d.parentId !== d.id ? this.daase(d.parentId) : null; if (p) d.gruppeId = p.gruppeId; else d.parentId = ''; });
      this.db.enheder.forEach(e => { if (!e.daaseId) return; const d = this.daase(e.daaseId); if (d) e.gruppeId = d.gruppeId; else e.daaseId = ''; });
    },
    /* svagstrøm */
    rack(id) { return this.db.racks.find(r => r.id === id); },
    rackNavn(id) { const r = this.rack(id); return r ? r.navn : '?'; },
    racksFor(gid) { return this.db.racks.filter(r => r.gruppeId === gid); },
    racksILokale(lid) { return this.db.racks.filter(r => r.lokaleId === lid); },
    udst(id) { return this.db.udstyr.find(u => u.id === id); },
    udstTxt(id) { const u = this.udst(id); return u ? u.navn : ''; },
    udstyrFor(rid) { return this.db.udstyr.filter(u => u.rackId === rid).sort((a, b) => (a.pos || 0) - (b.pos || 0)); },
    rackHe(rid) { return this.udstyrFor(rid).reduce((s, u) => s + (Number(u.he) || 1), 0); },
    poeBrug(sid) { return this.db.links.filter(l => l.switchId === sid).reduce((s, l) => s + (Number(l.poeW) || 0), 0); },
    rackW(rid) { return this.udstyrFor(rid).reduce((s, u) => s + (Number(u.effekt) || 0) + (u.art === 'switch' ? this.poeBrug(u.id) : 0), 0); },
    kameraerPaa(nid) { return this.db.links.filter(l => l.art === 'cctv' && l.nvrId === nid).length; },
    linksILokale(lid, art) { return this.db.links.filter(l => l.lokaleId === lid && (!art || l.art === art)); },
    svLinks() { return this.db.links.filter(l => (!this.svFilter || l.art === this.svFilter) && (!this.lokF || l.lokaleId === this.lokF)); },
    felt(u) { return u.art === 'patchpanel' ? 'panel' : u.art === 'switch' ? 'switch' : ''; },
    porte(u) { return this.felt(u) ? Array.from({ length: Math.min(96, Number(u.porte) || 0) }, (_, i) => i + 1) : []; },
    portLinks(uid, n, f) { return this.db.links.filter(l => l[f + 'Id'] === uid && Number(l[f + 'Port']) === n); },
    portCls(u, n) { const ls = this.portLinks(u.id, n, this.felt(u)); return !ls.length ? '' : ls.length > 1 ? 'konf' : ls[0].art + (Number(ls[0].poeW) ? ' poe' : ''); },
    portTitle(u, n) {
      const ls = this.portLinks(u.id, n, this.felt(u)); if (!ls.length) return u.navn + ' port ' + n + ': ledig. Klik for at oprette forbindelse.';
      return u.navn + ' port ' + n + ': ' + ls.map(l => l.navn + ' (' + this.lokaleNavn(l.lokaleId) + ', ' + l.kabel + ', ' + this.fmt(l.laengde) + ' m' + (Number(l.poeW) ? ', PoE ' + this.fmt(l.poeW, 2) + ' W' : '') + ')').join(' + ');
    },
    portKlik(u, n) {
      const f = this.felt(u), ls = this.portLinks(u.id, n, f); if (ls.length) { this.openForm('link', ls[0]); return; }
      this.openForm('link', null, f === 'switch' ? { switchId:u.id, switchPort:n } : { panelId:u.id, panelPort:n });
    },
    portTxt(l, f) { const u = this.udst(l[f + 'Id']); return u ? u.navn + ':' + l[f + 'Port'] : '–'; },
    friPort(uid, f) { const u = this.udst(uid); if (!u) return 0; for (let n = 1; n <= (Number(u.porte) || 0); n++) if (!this.portLinks(uid, n, f).length) return n; return 0; },
    linkFejl(l) {
      const out = [], sw = this.udst(l.switchId), pp = this.udst(l.panelId);
      if (!/fiber/i.test(l.kabel) && Number(l.laengde) > 90) out.push('Fast link på ' + this.fmt(l.laengde) + ' m overstiger 90 m for kobber.');
      if (sw) {
        if (Number(l.switchPort) < 1 || Number(l.switchPort) > sw.porte) out.push('Port ' + l.switchPort + ' findes ikke på ' + sw.navn + '.');
        else if (this.portLinks(sw.id, Number(l.switchPort), 'switch').length > 1) out.push('Portkonflikt på ' + sw.navn + ' port ' + l.switchPort + '.');
        if (Number(l.poeW) > 0 && !sw.poe) out.push('Kræver PoE, men ' + sw.navn + ' leverer ikke PoE.');
      }
      if (pp) {
        if (Number(l.panelPort) < 1 || Number(l.panelPort) > pp.porte) out.push('Port ' + l.panelPort + ' findes ikke på ' + pp.navn + '.');
        else if (this.portLinks(pp.id, Number(l.panelPort), 'panel').length > 1) out.push('Portkonflikt på ' + pp.navn + ' port ' + l.panelPort + '.');
      }
      if (l.art === 'cctv' && !this.udst(l.nvrId)) out.push('Ingen NVR valgt.');
      if (l.art === 'cctv' && !sw) out.push('Kameraet er ikke patchet til en switch.');
      return out;
    },
    svagKabler() {
      const m = {}; for (const l of this.db.links) { const o = m[l.kabel] || (m[l.kabel] = { k:l.kabel, m:0, n:0 }); o.m += Number(l.laengde) || 0; o.n++; }
      return Object.values(m).sort((a, b) => a.k.localeCompare(b.k));
    },

    /* flyt og træk */
    startDrag(eid, ev) { this.drag = eid; try { ev.dataTransfer.setData('text/plain', eid); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {} },
    dropOn(gid) { const id = this.drag; this.drag = null; this.over = null; if (id) this.flyt(id, gid); },
    flytFra(ev, eid) { const v = ev.target.value; ev.target.value = '-'; if (v !== '-') this.flyt(eid, v); },
    flyt(eid, gid) {
      const e = this.db.enheder.find(x => x.id === eid); if (!e || e.gruppeId === gid) return;
      this.mutate(() => { const d = this.daase(e.daaseId); if (!d || d.gruppeId !== gid) e.daaseId = ''; e.gruppeId = gid; if (this.tre(e) && e.ledere === '3G') e.ledere = '5G'; });
      if (gid) this.sel = gid;
      this.say(e.navn + ' flyttet til ' + this.gruppeTxt(gid) + '.', true);
    },

    /* hurtig tilføj */
    qaParsed() {
      let s = ' ' + this.qa + ' ', m;
      const sd = this.db.projekt.sidst || { kabel:'PVC', ledere:'3G', tv:1.5 };
      const o = { navn:'', effekt:0, kabel:sd.kabel, ledere:'', tv:sd.tv, laengde:0, lokaleId:'', gruppeId:'' };
      const cut = x => { s = s.replace(x, ' '); };
      if ((m = s.match(/\s(\d+(?:[.,]\d+)?)\s*kw(?=\s)/i))) { o.effekt = Math.round(tal(m[1]) * 1000); cut(m[0]); }
      else if ((m = s.match(/\s(\d+)\s*w(?=\s)/i))) { o.effekt = Number(m[1]); cut(m[0]); }
      const harP = !!m; let amp = 0;
      if (!harP && (m = s.match(/\s(\d+(?:[.,]\d+)?)\s*a(?=\s)/i))) { amp = tal(m[1]); cut(m[0]); }
      if ((m = s.match(/\s([2-5])\s*([gx])\s*(\d+(?:[.,]\d+)?)(?:\s*mm2|\s*mm²)?(?=\s)/i))) { o.ledere = m[1] + m[2].toUpperCase(); o.tv = tal(m[3]); cut(m[0]); }
      if ((m = s.match(/\s(\d+(?:[.,]\d+)?)\s*m(?=\s)/i))) { o.laengde = tal(m[1]); cut(m[0]); }
      if ((m = s.match(/\s(?:([^\s:]+):|gr\.?\s*)(\d+)(?=\s)/i))) {
        const cur = this.sg();
        const t = m[1] ? this.db.tavler.find(t => t.navn.toLowerCase() === m[1].toLowerCase()) : (cur ? this.tavle(cur.tavleId) : this.db.tavler[0]);
        const g = t && this.grupperFor(t.id).find(g => g.nr === Number(m[2]));
        if (g) { o.gruppeId = g.id; cut(m[0]); }
      }
      for (const l of this.db.lokaler.slice().sort((a, b) => b.navn.length - a.navn.length)) {
        const i = s.toLowerCase().indexOf(' ' + l.navn.toLowerCase() + ' ');
        if (i > -1) { o.lokaleId = l.id; s = s.slice(0, i) + ' ' + s.slice(i + l.navn.length + 1); break; }
      }
      for (const k of this.kabeltyper) { const i = s.toLowerCase().indexOf(' ' + k.toLowerCase() + ' '); if (i > -1) { o.kabel = k; s = s.slice(0, i) + ' ' + s.slice(i + k.length + 1); break; } }
      if (!o.ledere) o.ledere = this.tre(o) ? '5G' : (sd.ledere === '4G' || sd.ledere === '5G' ? '3G' : sd.ledere);
      o.navn = s.trim().replace(/\s+/g, ' ');
      if (amp) o.effekt = Math.round(amp * (this.tre(o) ? Math.sqrt(3) * 400 : 230));
      else if (!harP) { const f = this.effektForslag(o); if (f) o.effekt = f.W; }
      return o;
    },
    quickAdd() {
      const o = this.qaParsed(); if (!o.navn) return;
      o.id = uid(); this.mutate(() => { this.db.enheder.push(o); this.db.projekt.sidst = { kabel:o.kabel, ledere:o.ledere, tv:o.tv }; });
      if (o.gruppeId) this.sel = o.gruppeId;
      this.qa = ''; this.say(o.navn + ' tilføjet' + (o.gruppeId ? ' på ' + this.gruppeTxt(o.gruppeId) : ' uden gruppe') + '.', true);
    },

    /* formularer */
    openForm(type, item, pre) {
      const cur = this.sg(), t0 = (cur && cur.tavleId) || (this.db.tavler[0] || {}).id || '';
      const std = {
        tavle: { navn:'', placering:'', forsikring:35, hovedafbryder:0, fra:'', fraGruppe:'', tilgang:'', tKabel:(this.db.projekt.sidst || {}).kabel || 'PVC', tLedere:'5G', tTv:6, tLaengde:0 },
        rcd: { navn:'HPFI ' + (this.rcdsFor((pre && pre.tavleId) || t0).length + 1), tavleId:t0, type:'A', In:40, idn:30 },
        lokale: { navn:'', etage:'' },
        afbryder: { navn:'', art:'enpolet', gruppeId:(cur && cur.type === 'lys' ? cur.id : (this.sorteredeGrupper().find(g => g.type === 'lys') || {}).id) || '', lokaleId:'', steder:2, tid:3, a:[], b:[] },
        gruppe: { tavleId:t0, nr:1, navn:'', type:'stik', kar:'B', In:13, faser:1, fase:'L1', rcdId:'', sf:this.sfForslag({ type:'stik' }).v },
        enhed: { antal:1, navn:'', gruppeId:this.sel || '', lokaleId:'', daaseId:'', symbol:'auto', effekt:0, kabel:'PVC', ledere:'3G', tv:1.5, laengde:10 },
        daase: { antal:1, navn:'', type:'Membrandåse', gruppeId:this.sel || '', parentId:'', lokaleId:'', kabel:'PVC', ledere:'3G', tv:1.5, laengde:5 },
        rack: { navn:'R' + (this.db.racks.length + 1), type:'19" vægskab', he:9, lokaleId:'', gruppeId:'' },
        udstyr: { rackId:(this.db.racks[0] || {}).id || '', navn:'', art:'switch', he:1, pos:1, porte:24, poe:false, poeBudget:0, effekt:20 },
        link: { antal:1, art:'data', navn:'', lokaleId:'', kabel:'Cat6A', laengde:20, panelId:'', panelPort:0, switchId:'', switchPort:0, patch:0.5, poeW:0, kamType:'Dome', oploesning:'4 MP', nvrId:'' }
      }[type];
      this.form = item ? JSON.parse(JSON.stringify(item)) : Object.assign(std, pre || {});
      this.dAuto = { type:true, lok:true }; this.eAuto = !item;
      if (type === 'tavle') this.form.forsyn = this.gruppe(this.form.fraGruppe) ? 'g:' + this.form.fraGruppe : this.form.fra ? 't:' + this.form.fra : '';
      if (type === 'enhed') { this.form.belEnh = this.belEnhSidst; this.belFra(); }
      if (!item && (type === 'enhed' || type === 'daase') && this.db.projekt.sidst) Object.assign(this.form, this.db.projekt.sidst);
      if (type === 'gruppe' && !item) {
        const gs = this.grupperFor(this.form.tavleId), f = this.faseInfo(this.form.tavleId);
        this.form.nr = gs.length ? Math.max(...gs.map(g => g.nr)) + 1 : 1;
        this.form.fase = f.vals.slice().sort((a, b) => a.I - b.I)[0].p;
        this.form.rcdId = (this.rcdsFor(this.form.tavleId)[0] || {}).id || '';
      }
      if (type === 'udstyr' && !item) this.form.pos = this.udstyrFor(this.form.rackId).reduce((m, u) => Math.max(m, (Number(u.pos) || 0) + (Number(u.he) || 1) - 1), 0) + 1;
      if (type === 'link' && !item) {
        const f = this.form, cctv = f.art === 'cctv', U = this.db.udstyr;
        if (!f.panelId) { const pp = U.find(u => u.art === 'patchpanel'); if (pp) { f.panelId = pp.id; f.panelPort = this.friPort(pp.id, 'panel'); } }
        if (!f.switchId) { const sw = U.find(u => u.art === 'switch' && (!cctv || u.poe)); if (sw) { f.switchId = sw.id; f.switchPort = this.friPort(sw.id, 'switch'); } }
        if (cctv) { f.poeW = 12.95; f.nvrId = (U.find(u => u.art === 'nvr') || {}).id || ''; }
      }
      this.confirm = null; this.modal = { type, id: item ? item.id : null };
      this.$nextTick(() => { const el = document.getElementById('m-navn'); if (el) el.focus(); });
    },
    liste(type) { return { afbryder:'afbrydere', tavle:'tavler', rcd:'rcds', lokale:'lokaler', gruppe:'grupper', enhed:'enheder', daase:'daaser', rack:'racks', udstyr:'udstyr', link:'links' }[type]; },
    saveForm() {
      if (this.modal.type === 'enhed') { this.belSync(); this.belEnhSidst = this.form.belEnh || 'W'; }
      const type = this.modal.type, liste = this.liste(type), rec = Object.assign({}, this.form);
      delete rec.belVal; delete rec.belEnh;
      rec.navn = String(rec.navn || '').trim(); if (!rec.navn) return;
      for (const k of ['nr', 'In', 'idn', 'faser', 'forsikring', 'hovedafbryder', 'effekt', 'tv', 'laengde', 'he', 'pos', 'porte', 'poeBudget', 'poeW', 'panelPort', 'switchPort', 'patch', 'steder', 'tid', 'sf', 'tTv', 'tLaengde']) if (k in rec) rec[k] = Number(rec[k]) || 0;
      if (type === 'gruppe') { rec.sf = rec.sf > 0 && rec.sf <= 1 ? rec.sf : 1; if (!this.rcdsFor(rec.tavleId).some(r => r.id === rec.rcdId)) rec.rcdId = ''; rec.maal = rec.maal || { riso:'', zs:'', rcd:'', ok:false }; }
      const id = this.modal.id;
      const antal = !id && this.kanDup(type) && type !== 'afbryder' ? Math.min(20, Math.max(1, Math.round(Number(rec.antal)) || 1)) : 1; delete rec.antal;
      let serie = [];
      if (type === 'tavle') { const v = String(rec.forsyn || ''); delete rec.forsyn; const g = v.startsWith('g:') ? this.gruppe(v.slice(2)) : null; rec.fraGruppe = g ? g.id : ''; rec.fra = g ? g.tavleId : v.startsWith('t:') ? v.slice(2) : ''; }
      if (type === 'tavle' && rec.fra === id) { rec.fra = ''; rec.fraGruppe = ''; }
      if (type === 'tavle' && !rec.forsikring) rec.forsikring = 35;
      if (type === 'daase' && (rec.parentId === id || (id && this.erUnder(rec.parentId, id)))) rec.parentId = '';
      if (type === 'link' && rec.art !== 'cctv') rec.nvrId = '';
      if (type === 'udstyr') rec.poe = rec.art === 'switch' && !!rec.poe;
      if (type === 'afbryder') {
        const ok = new Set(rec.gruppeId ? this.enhederFor(rec.gruppeId).map(e => e.id) : []);
        rec.a = (rec.a || []).filter(x => ok.has(x)); rec.b = rec.art === 'krone' ? (rec.b || []).filter(x => ok.has(x) && !rec.a.includes(x)) : [];
        rec.steder = rec.art === 'korr' ? 2 : (rec.art === 'kip' || rec.art === 'trappe') ? Math.min(6, Math.max(1, Math.round(rec.steder) || 1)) : 1; rec.tid = rec.tid || 3;
      }
      this.mutate(() => {
        if (id) { const i = this.db[liste].findIndex(x => x.id === id); if (i > -1) this.db[liste].splice(i, 1, rec); }
        else if (antal > 1) {
          serie = this.serie(rec.navn, this.db[liste], antal);
          serie.forEach(nv => { const c = JSON.parse(JSON.stringify(rec)); c.id = uid(); c.navn = nv; if (type === 'link') this.givPorte(c); this.db[liste].push(c); });
        }
        else { rec.id = uid(); this.db[liste].push(rec); }
        if (type === 'enhed' || type === 'daase') this.db.projekt.sidst = { kabel:rec.kabel, ledere:rec.ledere, tv:rec.tv };
        if (type === 'rcd') this.db.grupper.forEach(g => { if (g.rcdId === rec.id && g.tavleId !== rec.tavleId) g.rcdId = ''; });
        if (type === 'gruppe') this.db.tavler.forEach(t => { if (t.fraGruppe === rec.id) { if (t.id === rec.tavleId) t.fraGruppe = ''; else t.fra = rec.tavleId; } });
      });
      if (type === 'gruppe') this.sel = rec.id;
      if (type === 'enhed' && rec.gruppeId) this.sel = rec.gruppeId;
      this.modal = null;
      if (serie.length) this.say(serie.length + ' stk. oprettet: ' + serie[0] + ' til ' + serie[serie.length - 1] + '.', true);
    },
    delCurrent() {
      const type = this.modal.type, id = this.modal.id, d = this.db;
      this.mutate(() => {
        if (type === 'enhed') { d.enheder = d.enheder.filter(e => e.id !== id); d.afbrydere.forEach(x => { x.a = x.a.filter(i => i !== id); x.b = x.b.filter(i => i !== id); }); }
        if (type === 'afbryder') d.afbrydere = d.afbrydere.filter(x => x.id !== id);
        if (type === 'daase') { d.enheder.forEach(e => { if (e.daaseId === id) e.daaseId = ''; }); d.daaser.forEach(x => { if (x.parentId === id) x.parentId = ''; }); d.daaser = d.daaser.filter(x => x.id !== id); }
        if (type === 'link') d.links = d.links.filter(l => l.id !== id);
        const ryd = ids => d.links.forEach(l => { if (ids.has(l.panelId)) { l.panelId = ''; l.panelPort = 0; } if (ids.has(l.switchId)) { l.switchId = ''; l.switchPort = 0; } if (ids.has(l.nvrId)) l.nvrId = ''; });
        if (type === 'udstyr') { ryd(new Set([id])); d.udstyr = d.udstyr.filter(u => u.id !== id); }
        if (type === 'rack') { ryd(new Set(d.udstyr.filter(u => u.rackId === id).map(u => u.id))); d.udstyr = d.udstyr.filter(u => u.rackId !== id); d.racks = d.racks.filter(r => r.id !== id); }
        if (type === 'lokale') [d.daaser, d.racks, d.links, d.afbrydere].forEach(a => a.forEach(x => { if (x.lokaleId === id) x.lokaleId = ''; }));
        if (type === 'gruppe') d.tavler.forEach(t => { if (t.fraGruppe === id) t.fraGruppe = ''; });
        if (type === 'gruppe') [d.daaser, d.racks, d.afbrydere].forEach(a => a.forEach(x => { if (x.gruppeId === id) x.gruppeId = ''; }));
        if (type === 'lokale') { d.enheder.forEach(e => { if (e.lokaleId === id) e.lokaleId = ''; }); d.lokaler = d.lokaler.filter(l => l.id !== id); }
        if (type === 'rcd') { d.grupper.forEach(g => { if (g.rcdId === id) g.rcdId = ''; }); d.rcds = d.rcds.filter(r => r.id !== id); }
        if (type === 'gruppe') { d.enheder.forEach(e => { if (e.gruppeId === id) e.gruppeId = ''; }); d.grupper = d.grupper.filter(g => g.id !== id); }
        if (type === 'tavle') {
          const gs = new Set(d.grupper.filter(g => g.tavleId === id).map(g => g.id));
          d.enheder.forEach(e => { if (gs.has(e.gruppeId)) e.gruppeId = ''; });
          [d.daaser, d.racks, d.afbrydere].forEach(a => a.forEach(x => { if (gs.has(x.gruppeId)) x.gruppeId = ''; }));
          d.grupper = d.grupper.filter(g => g.tavleId !== id); d.rcds = d.rcds.filter(r => r.tavleId !== id); d.tavler = d.tavler.filter(t => t.id !== id); d.tavler.forEach(t => { if (t.fra === id) t.fra = ''; });
        }
      });
      if (!this.sg()) this.sel = (this.sorteredeGrupper()[0] || {}).id || null;
      if (this.filter.lokale === id) this.filter.lokale = '';
      if (this.lokF === id) this.lokF = '';
      this.modal = null; this.say('Slettet. Brugsgenstande fra slettede grupper ligger under Ikke tildelt.', true);
    },
    ask(key, fn) {
      if (this.confirm === key) { this.confirm = null; fn(); return; }
      this.confirm = key; setTimeout(() => { if (this.confirm === key) this.confirm = null; }, 3500);
    },
    reset(medEksempel) { this.mutate(() => { const p = this.db.projekt; this.db = medEksempel ? seed() : Object.assign(tom(), { projekt:p }); }); this.sel = (this.sorteredeGrupper()[0] || {}).id || null; this.say(medEksempel ? 'Eksempeldata indlæst.' : 'Alle data ryddet.', true); },

    /* tastatur */
    key(ev) {
      if (ev.key === 'Escape') { this.soegAaben = false; if (this.hurtig.aaben) { this.hurtig.aaben = false; return; } this.modal = null; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
      const tag = (ev.target.tagName || '').toLowerCase();
      if (this.modal || tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); this.undo(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (/^[0-9]$/.test(k)) { const v = this.views[k === '0' ? 9 : Number(k) - 1]; if (v) this.go(v.id); }
      else if (k === 'n') { ev.preventDefault(); this.$refs.qa.focus(); }
      else if (k === 'b') { ev.preventDefault(); this.openForm('enhed'); }
      else if (k === 'g' && this.db.tavler.length) { ev.preventDefault(); this.openForm('gruppe'); }
      else if (k === 'p') { ev.preventDefault(); this.aabnProjekter(); }
      else if (k === 'l') { ev.preventDefault(); this.openForm('lokale'); }
      else if (k === 'e' && this.sg()) { ev.preventDefault(); this.openForm('gruppe', this.sg()); }
      else if (k === '?' || (k === '+' && ev.shiftKey)) { this.modal = { type:'help' }; }
      else if (k === '/') { ev.preventDefault(); this.$refs.gs.focus(); }
      else if ((k === 'arrowright' || k === 'arrowleft') && this.view === 'tavle') {
        const gs = this.db.tavler.flatMap(t => this.skinne(t.id).filter(i => i.kind === 'grp').map(i => i.g.id));
        if (!gs.length) return; ev.preventDefault();
        const i = gs.indexOf(this.sel), n = gs.length;
        this.sel = gs[((i < 0 ? 0 : i + (k === 'arrowright' ? 1 : -1)) + n) % n];
      }
    },

    /* samlepunkter: oversigt */
    daaseTrae() {
      const out = [], seen = new Set(), D = this.db.daaser;
      const walk = (d, dep) => { if (seen.has(d.id)) return; seen.add(d.id); out.push({ d, dep }); D.filter(x => x.parentId === d.id).forEach(x => walk(x, dep + 1)); };
      D.filter(d => !this.daase(d.parentId)).forEach(d => walk(d, 0));
      D.forEach(d => walk(d, 0));
      return out;
    },
    daaseAfgange(id) {
      const n = this.db.enheder.filter(e => e.daaseId === id).map(e => e.navn).concat(this.db.daaser.filter(d => d.parentId === id).map(d => 'dåse ' + d.navn));
      return n.length ? 'Afgange: ' + n.join(', ') : 'Ingen afgange';
    },

    /* lokalefilter og søgning */
    gruppeILok(gid) { const i = x => x.gruppeId === gid && x.lokaleId === this.lokF; return this.db.enheder.some(i) || this.db.daaser.some(i) || this.db.afbrydere.some(i) || this.db.racks.some(i); },
    soeg() {
      const q = this.q.trim().toLowerCase(); if (q.length < 2) return []; const d = this.db, out = [];
      const add = (type, art, obj, navn, sub, spor) => { if ((navn + ' ' + sub).toLowerCase().includes(q)) out.push({ k:type + obj.id, type, art, obj, navn, sub, spor }); };
      d.tavler.forEach(t => add('tavle', 'Tavle', t, t.navn, t.placering || '', 't:' + t.id));
      d.grupper.forEach(g => add('gruppe', 'Gruppe', g, 'G' + g.nr + ' ' + g.navn, this.tavleNavn(g.tavleId) + ' · ' + g.kar + g.In, 'g:' + g.id));
      d.lokaler.forEach(l => add('lokale', 'Lokale', l, l.navn, l.etage || 'klik for at filtrere alle faner', ''));
      d.enheder.forEach(e => add('enhed', 'Brugsgenstand', e, e.navn, this.lokaleNavn(e.lokaleId) + ' · ' + (this.gruppe(e.gruppeId) ? this.gruppeTxt(e.gruppeId) : 'uden gruppe') + ' · ' + e.kabel + ' ' + this.kabelDim(e), this.gruppe(e.gruppeId) ? 'e:' + e.id : ''));
      d.daaser.forEach(x => add('daase', 'Samlepunkt', x, x.type + ' ' + x.navn, this.lokaleNavn(x.lokaleId) + ' · ' + (this.gruppe(x.gruppeId) ? this.gruppeTxt(x.gruppeId) : 'uden gruppe'), this.gruppe(x.gruppeId) ? 'd:' + x.id : ''));
      d.afbrydere.forEach(a => add('afbryder', 'Afbryder', a, a.navn, this.afbArt[a.art] + ' · ' + this.lokaleNavn(a.lokaleId), ''));
      d.racks.forEach(r => add('rack', 'Rackskab', r, r.navn, r.type + ' · ' + this.lokaleNavn(r.lokaleId), 'k:' + r.id));
      d.udstyr.forEach(u => add('udstyr', 'Rackudstyr', u, u.navn, this.udstArt[u.art] + ' · ' + this.rackNavn(u.rackId), 'u:' + u.id));
      d.links.forEach(l => add('link', l.art === 'cctv' ? 'Kamera' : 'PDS-udtag', l, l.navn, this.lokaleNavn(l.lokaleId) + ' · ' + l.kabel, this.udst(l.switchId) || this.udst(l.panelId) ? 'x:' + l.id : ''));
      return out.slice(0, 40);
    },
    soegVaelg(r) {
      this.soegAaben = false;
      if (r.type === 'gruppe') this.goGruppe(r.obj.id);
      else if (r.type === 'lokale') { this.lokF = r.obj.id; this.go('lokaler'); }
      else this.openForm(r.type, r.obj);
    },

    /* lokaleskabeloner */
    aabnSkabelon() { this.sk = { key:'koekken', navn:SKABELONER.koekken.navn, tavleId:(this.sg() || {}).tavleId || (this.db.tavler[0] || {}).id || '' }; this.confirm = null; this.modal = { type:'skabelon' }; },
    indsaetSkabelon() {
      const S = SKABELONER[this.sk.key], d = this.db, onsket = String(this.sk.navn || '').trim(); if (!S || !onsket) return;
      const navn = d.lokaler.some(l => l.navn === onsket) ? this.naeste(onsket, d.lokaler) : onsket, lok = { id:uid(), navn, etage:'' }, kabel = (d.projekt.sidst || {}).kabel || 'PVC', tid = this.tavle(this.sk.tavleId) ? this.sk.tavleId : '';
      let nE = 0, nG = 0;
      this.mutate(() => {
        d.lokaler.push(lok);
        for (const G of S.grupper) {
          let g = null;
          if (tid) {
            const gs = this.grupperFor(tid), fi = this.faseInfo(tid);
            g = { id:uid(), tavleId:tid, nr: gs.length ? Math.max(...gs.map(x => x.nr)) + 1 : 1, navn:G.navn + ' ' + navn.toLowerCase(), type:G.type, kar:'B', In:G.In, faser:G.faser || 1, fase:fi.vals.slice().sort((a, b) => a.I - b.I)[0].p,
              rcdId:(this.rcdsFor(tid)[0] || {}).id || '', sf:1, maal:{ riso:'', zs:'', rcd:'', ok:false } };
            d.grupper.push(g); nG++;
          }
          for (const it of G.items) { d.enheder.push({ id:uid(), gruppeId:g ? g.id : '', lokaleId:lok.id, daaseId:'', symbol:'auto', navn:it[0], effekt:it[1], kabel, ledere:G.faser == 3 ? '5G' : '3G', tv:G.In >= 16 ? 2.5 : 1.5, laengde:10 }); nE++; }
          if (g) { const gg = this.gruppe(g.id); gg.sf = this.sfForslag(gg).v; }
        }
      });
      this.modal = null; this.lokF = ''; this.go('lokaler');
      this.say(navn + ' oprettet fra skabelon: ' + nE + ' brugsgenstande' + (nG ? ' på ' + nG + ' nye grupper.' : ' uden gruppe.'), true);
    },

    /* rækkefølge */
    ryk(liste, id, dir, samme) {
      const L = this.db[liste], i = L.findIndex(x => x.id === id); if (i < 0) return;
      let j = i + dir; while (j >= 0 && j < L.length && samme && !samme(L[j], L[i])) j += dir;
      if (j < 0 || j >= L.length) return;
      this.mutate(() => { const a = L[i], b = L[j]; L.splice(i, 1, b); L.splice(j, 1, a); });
    },
    rykGruppe(gid, dir) {
      const g = this.gruppe(gid); if (!g) return; const gs = this.grupperFor(g.tavleId), n = gs[gs.findIndex(x => x.id === gid) + dir]; if (!n) return;
      this.mutate(() => { const nr = g.nr; g.nr = n.nr; n.nr = nr; });
    },
    slipLokale(til, ev) {
      const fra = this.dragL; this.dragL = null; this.overL = null; if (!fra) return; ev.preventDefault(); if (fra === til) return;
      const L = this.db.lokaler, i = L.findIndex(l => l.id === fra), j = L.findIndex(l => l.id === til); if (i < 0 || j < 0) return;
      this.mutate(() => { const x = L[i]; L.splice(i, 1); L.splice(j, 0, x); });
    },

    /* undertavlens forsyning */
    tavleEfter(tid) { const ud = new Set(); let nye = [tid]; while (nye.length) { const n = nye.pop(); this.db.tavler.filter(t => t.fra === n && !ud.has(t.id) && t.id !== tid).forEach(t => { ud.add(t.id); nye.push(t.id); }); } return ud; },
    forsynValg(selv) {
      const spaer = selv ? this.tavleEfter(selv) : new Set(), ud = [];
      for (const t of this.db.tavler) {
        if (t.id === selv || spaer.has(t.id)) continue;
        ud.push({ v:'t:' + t.id, l:t.navn + ' · egen afgang uden gruppe' });
        for (const g of this.grupperFor(t.id)) ud.push({ v:'g:' + g.id, l:t.navn + ' · gruppe ' + g.nr + ' ' + g.navn + ' (' + g.kar + g.In + ', ' + (g.faser == 3 ? '3F' : '1F') + ')' });
      }
      return ud;
    },

    /* opret manglende grunddata direkte fra en dropdown */
    nyValg(ev, type, felt) {
      if (ev.target.value !== '__ny') return;
      const f = this.form, ren = v => v && v !== '__ny' ? v : ''; f[felt] = ''; ev.target.value = '';
      if (type === 'gruppe' && !this.db.tavler.length) { this.say('Opret en tavle først.'); return; }
      const t0 = (this.sg() || {}).tavleId || (this.db.tavler[0] || {}).id || '';
      const init = { lokale:{ navn:'', etage:'' }, gruppe:{ navn:'', tavleId:t0, type:'stik', In:13, faser:1 }, daase:{ navn:'', type:'Membrandåse', gruppeId:ren(f.gruppeId), lokaleId:ren(f.lokaleId) } }[type];
      this.hurtig = { aaben:true, type, felt, f:init };
      this.$nextTick(() => { const el = document.getElementById('h-navn'); if (el) el.focus(); });
    },
    hurtigAuto() {
      const h = this.hurtig; if (h.type !== 'daase') return; const p = this.daaseParse(h.f.navn);
      if (p.type) h.f.type = p.type; if (p.lokaleId) h.f.lokaleId = p.lokaleId;
    },
    hurtigGem() {
      const h = this.hurtig, f = h.f, navn = String(f.navn || '').trim(); if (!navn) return; let ny = null;
      this.mutate(() => {
        if (h.type === 'lokale') { ny = { id:uid(), navn, etage:f.etage || '' }; this.db.lokaler.push(ny); }
        if (h.type === 'gruppe') {
          const gs = this.grupperFor(f.tavleId), fi = this.faseInfo(f.tavleId);
          ny = { id:uid(), tavleId:f.tavleId, nr: gs.length ? Math.max(...gs.map(g => g.nr)) + 1 : 1, navn, type:f.type, kar:'B', In:Number(f.In) || 13, faser:Number(f.faser) || 1, sf:this.sfForslag({ type:f.type }).v,
            fase:fi.vals.slice().sort((a, b) => a.I - b.I)[0].p, rcdId:(this.rcdsFor(f.tavleId)[0] || {}).id || '', maal:{ riso:'', zs:'', rcd:'', ok:false } };
          this.db.grupper.push(ny);
        }
        if (h.type === 'daase') { ny = Object.assign({ id:uid(), navn, type:f.type, gruppeId:f.gruppeId, parentId:'', lokaleId:f.lokaleId || '', laengde:5 }, this.db.projekt.sidst || { kabel:'PVC', ledere:'3G', tv:1.5 }); this.db.daaser.push(ny); }
      });
      if (this.modal && ny) {
        this.form[h.felt] = ny.id;
        if (this.modal.type === 'enhed') { if (h.type === 'daase') this.form.gruppeId = ny.gruppeId; if (h.type === 'gruppe') this.form.daaseId = ''; this.belSync(); }
      }
      this.hurtig = { aaben:false, type:h.type, felt:'', f:{} }; this.say(navn + ' oprettet og valgt.', true);
    },

    /* hurtigere oprettelse: serier, kopier, kloning, dåsegenkendelse */
    kanDup(type) { return ['enhed', 'daase', 'link', 'afbryder'].includes(type); },
    serie(navn, liste, n) {
      const m = String(navn).match(/^(.*?)(\d+)$/); let base, start, bredde = 1;
      if (m) { base = m[1]; start = Number(m[2]); bredde = m[2].length; }
      else { base = navn + ' '; const brugt = liste.map(x => String(x.navn)).filter(v => v.startsWith(base) && /^\d+$/.test(v.slice(base.length))).map(v => Number(v.slice(base.length))); start = brugt.length ? Math.max(...brugt) + 1 : 1; }
      return Array.from({ length:n }, (_, i) => base + String(start + i).padStart(bredde, '0'));
    },
    naeste(navn, liste) {
      const brugt = new Set(liste.map(x => x.navn)), m = String(navn).match(/^(.*?)(\d+)$/);
      const base = m ? m[1] : navn + ' ', bredde = m ? m[2].length : 1; let i = m ? Number(m[2]) + 1 : 2;
      while (brugt.has(base + String(i).padStart(bredde, '0')) && i < 9999) i++;
      return base + String(i).padStart(bredde, '0');
    },
    givPorte(c) {
      c.panelPort = this.udst(c.panelId) ? this.friPort(c.panelId, 'panel') : 0; if (!c.panelPort) c.panelId = '';
      c.switchPort = this.udst(c.switchId) ? this.friPort(c.switchId, 'switch') : 0; if (!c.switchPort) c.switchId = '';
    },
    dupElem() {
      const type = this.modal.type, liste = this.liste(type), src = this.db[liste].find(x => x.id === this.modal.id); if (!src) return;
      const c = JSON.parse(JSON.stringify(src)); c.id = uid(); c.navn = this.naeste(src.navn, this.db[liste]);
      this.mutate(() => { if (type === 'link') this.givPorte(c); this.db[liste].push(c); });
      this.modal = null; this.say(c.navn + ' oprettet som kopi af ' + src.navn + '.', true);
    },
    klonLokale(lid) {
      const d = this.db, src = d.lokaler.find(l => l.id === lid); if (!src) return;
      const ny = { id:uid(), navn:this.naeste(src.navn, d.lokaler), etage:src.etage }, dm = {}, kopi = x => JSON.parse(JSON.stringify(x));
      const ds = d.daaser.filter(x => x.lokaleId === lid), es = d.enheder.filter(e => e.lokaleId === lid), ls = d.links.filter(l => l.lokaleId === lid);
      ds.forEach(x => { dm[x.id] = uid(); });
      this.mutate(() => {
        d.lokaler.push(ny);
        ds.forEach(x => d.daaser.push(Object.assign(kopi(x), { id:dm[x.id], lokaleId:ny.id, parentId:dm[x.parentId] || x.parentId, navn:this.naeste(x.navn, d.daaser) })));
        es.forEach(e => d.enheder.push(Object.assign(kopi(e), { id:uid(), lokaleId:ny.id, daaseId:dm[e.daaseId] || e.daaseId })));
        ls.forEach(l => { const c = Object.assign(kopi(l), { id:uid(), lokaleId:ny.id, navn:this.naeste(l.navn, d.links) }); this.givPorte(c); d.links.push(c); });
      });
      this.say(ny.navn + ' oprettet med ' + es.length + ' brugsgenstande, ' + ds.length + ' samledåser og ' + ls.length + ' udtag/kameraer.', true);
    },
    daaseParse(txt) {
      const t = ' ' + String(txt || '').toLowerCase() + ' ', ord = r => new RegExp('(^|[^a-zæøå])' + r + '($|[^a-zæøå])').test(t);
      const type = /forfra/.test(t) ? 'Forfradåse' : /indmur/.test(t) ? 'Indmuringsdåse' : /underlag/.test(t) ? 'Underlag' : /europa/.test(t) ? 'Europadåse' : /membran/.test(t) ? 'Membrandåse' : ord('pl') ? 'PL-dåse' : ord('ap\\s?\\d*') ? 'Membrandåse' : '';
      const lok = this.db.lokaler.slice().sort((a, b) => b.navn.length - a.navn.length).find(l => l.navn && t.includes(l.navn.toLowerCase()));
      return { type, lokaleId: lok ? lok.id : '' };
    },
    daaseAuto() {
      if (!this.modal || this.modal.id) return; const p = this.daaseParse(this.form.navn);
      if (p.type && this.dAuto.type) this.form.type = p.type;
      if (p.lokaleId && this.dAuto.lok) this.form.lokaleId = p.lokaleId;
    },
    daaseHint() {
      const p = this.daaseParse(this.form.navn), d = [p.type && this.dAuto.type && 'type ' + p.type, p.lokaleId && this.dAuto.lok && 'lokale ' + this.lokaleNavn(p.lokaleId)].filter(Boolean);
      return d.length ? 'Genkendt fra betegnelsen: ' + d.join(' · ') : '';
    },

    /* fejlfinder: manglende koblinger */
    mangler() {
      const out = [], d = this.db;
      d.enheder.filter(e => !this.gruppe(e.gruppeId)).forEach(e => out.push({ k:'g' + e.id, kat:'gruppe', navn:e.navn, txt:'Ikke tildelt en gruppe.', type:'enhed', obj:e, spor:'' }));
      for (const x of d.daaser) {
        const g = this.gruppe(x.gruppeId), navn = x.type + ' ' + x.navn;
        if (!g) out.push({ k:'t' + x.id, kat:'tilgang', navn, txt:'Ingen tilgang: dåsen er ikke koblet til en gruppe.', type:'daase', obj:x, spor:'' });
        if (!d.enheder.some(e => e.daaseId === x.id) && !d.daaser.some(y => y.parentId === x.id)) out.push({ k:'a' + x.id, kat:'afgang', navn, txt:'Ingen afgange: hverken brugsgenstande eller underdåser er koblet på.', type:'daase', obj:x, spor: g ? 'd:' + x.id : '' });
      }
      for (const l of d.links) {
        const sw = this.udst(l.switchId), pp = this.udst(l.panelId), ms = !sw || !Number(l.switchPort), mp = !pp || !Number(l.panelPort);
        if (ms) out.push({ k:'p' + l.id, kat:'port', navn:l.navn, txt:(l.art === 'cctv' ? 'Kamera' : 'PDS-udtag') + (mp ? ' mangler både patchpanel- og switchport.' : ' mangler switchport.'), type:'link', obj:l, spor: sw || pp ? 'x:' + l.id : '' });
      }
      return out;
    },

  }, APP_BEREGNING(), APP_DIAGRAM(), APP_LAGRING());
}
