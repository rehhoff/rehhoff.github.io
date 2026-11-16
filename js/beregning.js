/* Beregning: strøm, spændingsfald, Iz, fasebalance, kabeltabel, samtidighed, tilgangskabel og effektforslag. Metoderne samles i app() i js/app.js, så this er hele app-tilstanden. */
const APP_BEREGNING = () => ({
    /* beregning */
    tre(e) { const g = this.gruppe(e.gruppeId); return !!g && g.faser == 3; },
    strom(e) { const P = Number(e.effekt) || 0; return this.tre(e) ? P / (Math.sqrt(3) * 400) : P / 230; },
    du(e, tv) { const g = this.gruppe(e.gruppeId); return this.duLokal(e, tv) + (g ? this.tavleDu(g.tavleId, 0) : 0); },
    duLokal(e, tv) {
      const I = this.strom(e), L = Number(e.laengde) || 0, A = Number(tv || e.tv) || 1;
      return this.duSeg(I, L, A, this.tre(e)) + (e.daaseId ? this.duOp(e.daaseId) : 0);
    },
    duGraense(e) { return this.typeOf(e) === 'lys' ? 3 : 5; },
    duOver(e) { return !!Number(e.effekt) && this.du(e) > this.duGraense(e); },
    lmax(e) {
      const I = this.strom(e), A = Number(e.tv) || 1, g = Math.max(0, this.duGraense(e) - (e.daaseId ? this.duOp(e.daaseId) : 0) - this.tavleDu((this.gruppe(e.gruppeId) || {}).tavleId, 0)) / 100; if (!I) return null;
      return this.tre(e) ? g * 400 * A / (Math.sqrt(3) * I * RHO) : g * 230 * A / (2 * I * RHO);
    },
    iz(e, tv) { return (IZ[this.tre(e) ? 3 : 2][Number(tv || e.tv)]) || 0; },
    izFejl(e) { const g = this.gruppe(e.gruppeId); return !!g && !!this.iz(e) && g.In > this.iz(e); },
    forslag(e) {
      const g = this.gruppe(e.gruppeId); if (!g) return null;
      return TV.find(s => this.iz(e, s) >= g.In && this.du(e, s) <= this.duGraense(e)) || null;
    },
    underTavler(gid) { return gid ? this.db.tavler.filter(t => t.fraGruppe === gid) : []; },
    gruppeFaser(g, seen) {
      const egen = this.egenI(g.id), f = { L1:0, L2:0, L3:0 }; (g.faser == 3 ? PH : [g.fase]).forEach(p => { f[p] += egen; });
      for (const u of this.underTavler(g.id)) { const s = this.subFaser(u.id, seen || new Set([g.tavleId])); if (g.faser == 3) PH.forEach(p => { f[p] += s[p]; }); else f[g.fase] += s.L1 + s.L2 + s.L3; }
      return f;
    },
    gruppeI(gid) { const g = this.gruppe(gid); if (!g) return this.egenI(gid); const f = this.gruppeFaser(g); return Math.max(f.L1, f.L2, f.L3); },
    egenI(gid) {
      const g = this.gruppe(gid), rw = this.racksFor(gid).reduce((s, r) => s + this.rackW(r.id), 0);
      return (g ? this.sfVal(g) : 1) * this.instI(gid) + (g && g.faser == 3 ? rw / (Math.sqrt(3) * 400) : rw / 230);
    },
    maxDu(gid) {
      const es = this.enhederFor(gid).filter(e => Number(e.effekt)); if (!es.length) return { v:null, over:false };
      return { v: Math.max(...es.map(e => this.du(e))), over: es.some(e => this.duOver(e)) };
    },
    minIz(gid) { const v = this.enhederFor(gid).map(e => this.iz(e)).filter(Boolean); return v.length ? Math.min(...v) : 0; },
    tavleW(tid) { const ids = new Set(this.grupperFor(tid).map(g => g.id)); return this.db.enheder.filter(e => ids.has(e.gruppeId)).reduce((s, e) => s + (Number(e.effekt) || 0), 0) + this.db.racks.filter(r => ids.has(r.gruppeId)).reduce((s, r) => s + this.rackW(r.id), 0); },
    subFaser(tid, seen) {
      const tot = { L1:0, L2:0, L3:0 }; if (seen.has(tid)) return tot; seen.add(tid);
      for (const g of this.grupperFor(tid)) { const f = this.gruppeFaser(g, seen); for (const p of PH) tot[p] += f[p]; }
      for (const u of this.db.tavler.filter(u => u.fra === tid && !this.gruppe(u.fraGruppe))) { const s = this.subFaser(u.id, seen); for (const p of PH) tot[p] += s[p]; }
      return tot;
    },
    faseInfo(tid) {
      const t = this.tavle(tid) || { forsikring:35 }, tot = { L1:0, L2:0, L3:0 }, segs = { L1:[], L2:[], L3:[] };
      for (const g of this.grupperFor(tid)) {
        const f = this.gruppeFaser(g, new Set([tid]));
        for (const p of PH) if (f[p]) { tot[p] += f[p]; segs[p].push({ id:g.id, type:g.type, I:f[p], txt:'Gr. ' + g.nr + ' ' + g.navn + ': ' + this.fmt(f[p]) + ' A' }); }
      }
      for (const u of this.db.tavler.filter(u => u.fra === tid && u.id !== tid && !this.gruppe(u.fraGruppe))) {
        const sub = this.subFaser(u.id, new Set([tid]));
        for (const p of PH) if (sub[p]) { tot[p] += sub[p]; segs[p].push({ id:'t' + u.id, type:'', I:sub[p], txt:'Undertavle ' + u.navn + ': ' + this.fmt(sub[p]) + ' A' }); }
      }
      const a = tot.L1, b = tot.L2, c = tot.L3, max = Math.max(a, b, c), min = Math.min(a, b, c), scale = Math.max(max, t.forsikring) * 1.08 || 1;
      return {
        vals: PH.map(p => ({ p, I:tot[p], segs: segs[p].map(s => Object.assign({ w: s.I / scale * 100 }, s)) })),
        max, diff: max - min, skaev: max ? (max - min) / max * 100 : 0, lim: t.forsikring / scale * 100,
        IN: Math.sqrt(Math.max(0, a*a + b*b + c*c - a*b - b*c - c*a))
      };
    },
    gruppeFejl(gid) {
      const g = this.gruppe(gid); if (!g) return [];
      const out = [], I = this.gruppeI(gid);
      if (I > g.In) out.push('Overbelastet: ' + this.fmt(I) + ' A på ' + g.kar + g.In + '.');
      if (!this.rcd(g) && !this.underTavler(g.id).length) out.push('Ingen HPFI tilknyttet.');
      for (const d of this.daaserFor(gid)) if (this.daaseIzFejl(d)) out.push(this.daaseTxt(d.id) + ': tilgang ' + this.fmt(d.tv) + ' mm² har Iz ' + this.fmt(this.daaseIz(d)) + ' A, under sikringen på ' + g.In + ' A.');
      for (const e of this.enhederFor(gid)) {
        if (this.duOver(e)) out.push(e.navn + ': ΔU ' + this.fmt(this.du(e), 2) + ' % over ' + this.duGraense(e) + ' %.');
        if (this.izFejl(e)) out.push(e.navn + ': ' + this.fmt(e.tv) + ' mm² har Iz ' + this.fmt(this.iz(e)) + ' A, under sikringen på ' + g.In + ' A.');
      }
      return out;
    },
    warnings() {
      const out = [];
      for (const t of this.db.tavler) {
        const f = this.faseInfo(t.id);
        f.vals.filter(p => p.I > t.forsikring).forEach(p => out.push({ k:'f' + t.id + p.p, bal:t.id, txt:`${t.navn}: ${p.p} belastet med ${this.fmt(p.I)} A, forsikring ${t.forsikring} A.` }));
        if (t.hovedafbryder && t.hovedafbryder < t.forsikring) out.push({ k:'h' + t.id, txt:`${t.navn}: hovedafbryder ${t.hovedafbryder} A er mindre end forsikringen på ${t.forsikring} A.` });
        if (f.skaev > 50 && f.diff > 10) out.push({ k:'s' + t.id, bal:t.id, txt:`${t.navn}: skævlast ${this.fmt(f.skaev, 0)} % (${this.fmt(f.diff)} A mellem faserne).` });
      }
      for (const g of this.sorteredeGrupper()) {
        const I = this.gruppeI(g.id), n = this.tavleNavn(g.tavleId) + ' · gruppe ' + g.nr + ' ' + g.navn;
        if (I > g.In) out.push({ k:'o' + g.id, g:g.id, txt:`${n}: ${this.fmt(I)} A summeret last på ${g.kar}${g.In}.` });
        if (!this.rcd(g) && !this.underTavler(g.id).length) out.push({ k:'r' + g.id, g:g.id, txt:`${n}: ingen HPFI tilknyttet.` });
        for (const e of this.enhederFor(g.id)) {
          const fix = this.forslag(e);
          if (this.duOver(e)) out.push({ k:'d' + e.id, g:g.id, e:e.id, fix: fix && fix != e.tv ? fix : null, txt:`${e.navn}: spændingsfald ${this.fmt(this.du(e), 2)} % over ${this.duGraense(e)} % (${this.kabelDim(e)}, ${this.fmt(e.laengde)} m).` });
          else if (this.izFejl(e)) out.push({ k:'i' + e.id, g:g.id, e:e.id, fix: fix && fix != e.tv ? fix : null, txt:`${e.navn}: ${this.kabelDim(e)} har Iz ${this.fmt(this.iz(e))} A, under ${g.kar}${g.In}.` });
        }
      }
      for (const d of this.db.daaser) if (this.daaseIzFejl(d)) out.push({ k:'z' + d.id, g:d.gruppeId, txt:`${this.daaseTxt(d.id)}: tilgangskabel ${this.kabelDim(d)} har Iz ${this.fmt(this.daaseIz(d))} A, under gruppens sikring.` });
      for (const r of this.db.racks) if (this.rackHe(r.id) > r.he) out.push({ k:'kh' + r.id, sv:true, txt:`Rack ${r.navn}: udstyr fylder ${this.rackHe(r.id)} HE i et skab på ${r.he} HE.` });
      for (const u of this.db.udstyr) {
        if (u.art === 'switch' && u.poe && this.poeBrug(u.id) > u.poeBudget) out.push({ k:'up' + u.id, sv:true, txt:`${u.navn}: PoE-forbrug ${this.fmt(this.poeBrug(u.id))} W overstiger budgettet på ${u.poeBudget} W.` });
        if (u.art === 'nvr' && this.kameraerPaa(u.id) > u.porte) out.push({ k:'un' + u.id, sv:true, txt:`${u.navn}: ${this.kameraerPaa(u.id)} kameraer på ${u.porte} kanaler.` });
      }
      for (const l of this.db.links) this.linkFejl(l).forEach((f, i) => out.push({ k:'x' + l.id + i, sv:true, txt:`${l.navn}: ${f}` }));
      for (const t of this.db.tavler) {
        const g = this.gruppe(t.fraGruppe);
        if (this.tilgIzFejl(t)) out.push({ k:'tz' + t.id, g:g ? g.id : '', txt:`${t.navn}: tilgangskabel ${t.tLedere}${this.fmt(t.tTv)} mm² har Iz ${this.fmt(this.tilgIz(t))} A, under den beskyttende sikring på ${this.tilgBeskyt(t)} A.` });
        if (g && g.faser != 3 && this.grupperFor(t.id).some(x => x.faser == 3)) out.push({ k:'uf' + t.id, g:g.id, txt:`${t.navn}: har 3-fasede grupper, men forsynes fra den 1-fasede gruppe ${g.nr} ${g.navn}.` });
      }
      for (const e of this.db.enheder) {
        const g = this.gruppe(e.gruppeId);
        if (g && g.faser != 3 && Number(String(e.ledere)[0]) > 3) out.push({ k:'ll' + e.id, g:g.id, txt:`${e.navn}: ${e.ledere}-kabel på den 1-fasede gruppe ${g.nr}. Tjek lederantal eller gruppe.` });
      }
      for (const a of this.db.afbrydere) {
        const andre = a.a.concat(a.b).map(id => this.db.enheder.find(e => e.id === id)).filter(e => e && e.gruppeId !== a.gruppeId);
        if (andre.length) out.push({ k:'af' + a.id, txt:`Afbryder ${a.navn}: ${andre.map(e => e.navn).join(', ')} ligger på en anden gruppe end afbryderen.` });
      }
      return out;
    },
    brugForslag(eid, tv) { const e = this.db.enheder.find(x => x.id === eid); if (!e) return; this.mutate(() => { e.tv = tv; }); this.say(e.navn + ': tværsnit ændret til ' + this.fmt(tv) + ' mm².', true); },
    autoBalance(tid) {
      const gs = this.grupperFor(tid), tot = { L1:0, L2:0, L3:0 }, cnt = { L1:0, L2:0, L3:0 };
      const last = {}; gs.forEach(g => { last[g.id] = this.gruppeI(g.id); });
      gs.filter(g => g.faser == 3).forEach(g => { const f = this.gruppeFaser(g, new Set([tid])); PH.forEach(p => { tot[p] += f[p]; }); });
      this.db.tavler.filter(u => u.fra === tid && u.id !== tid && !this.gruppe(u.fraGruppe)).forEach(u => { const s = this.subFaser(u.id, new Set([tid])); PH.forEach(p => { tot[p] += s[p]; }); });
      const plan = gs.filter(g => g.faser != 3).sort((a, b) => last[b.id] - last[a.id]).map(g => {
        const p = PH.slice().sort((x, y) => (tot[x] - tot[y]) || (cnt[x] - cnt[y]))[0];
        tot[p] += last[g.id]; cnt[p]++; return [g, p];
      });
      this.mutate(() => plan.forEach(([g, p]) => { g.fase = p; }));
      this.say(this.tavleNavn(tid) + ': faser omfordelt. L1 ' + this.fmt(tot.L1) + ' A, L2 ' + this.fmt(tot.L2) + ' A, L3 ' + this.fmt(tot.L3) + ' A.', true);
    },
    setFase(gid, p) { const g = this.gruppe(gid); if (g && g.fase !== p) this.mutate(() => { g.fase = p; }); },
    setRcd(gid, rid) { const g = this.gruppe(gid); if (g) this.mutate(() => { g.rcdId = rid; }); },
    sumLen(rows) { return rows.reduce((s, r) => s + (Number(r.e.laengde) || 0), 0); },
    fmt(n, d) { return Number(n || 0).toLocaleString('da-DK', { maximumFractionDigits: d == null ? 1 : d }); },
    stats() {
      const w = this.warnings().length, u = this.enhederFor('').length;
      return [
        { l:'Grupper', v:this.db.grupper.length }, { l:'Brugsgenstande', v:this.db.enheder.length }, { l:'Samlepunkter', v:this.db.daaser.length },
        { l:'PDS / CCTV', v:this.db.links.filter(l => l.art !== 'cctv').length + ' / ' + this.db.links.filter(l => l.art === 'cctv').length },
        { l:'Elkabel i alt', v:this.fmt((this.sumLen(this.db.enheder.concat(this.db.daaser).map(e => ({ e }))) + this.db.tavler.reduce((s, t) => s + (Number(t.tLaengde) || 0), 0))) + ' m' },
        { l:'Mangler kobling', v:this.mangler().length, w:this.mangler().length > 0 }, { l:'Kræver kontrol', v:w, w:w > 0 }
      ];
    },

    /* kabeltabel */
    rows() {
      const f = this.filter, q = f.q.trim().toLowerCase();
      const rs = this.db.enheder.map(e => {
        const g = this.gruppe(e.gruppeId);
        return { e, g, tn: g ? this.tavleNavn(g.tavleId) : '', lok:this.lokaleNavn(e.lokaleId), I:this.strom(e), du:this.du(e), over:this.duOver(e), lmax:this.lmax(e), iz:this.iz(e), izFejl:this.izFejl(e), via: e.daaseId ? 'via ' + this.daaseTxt(e.daaseId) : '' };
      }).concat(this.db.daaser.map(d => {
        const g = this.gruppe(d.gruppeId), P = this.nedstroem(d.id).reduce((s, e) => s + (Number(e.effekt) || 0), 0);
        return { d, e: Object.assign({}, d, { id:'d' + d.id, navn:d.type + ' ' + d.navn, effekt:P }), g, tn: g ? this.tavleNavn(g.tavleId) : '', lok:this.lokaleNavn(d.lokaleId), I:this.daaseI(d.id), du:this.duOp(d.id), over:false, lmax:null,
          iz:this.daaseIz(d), izFejl:this.daaseIzFejl(d), via: 'tilgang fra ' + (d.parentId ? this.daaseTxt(d.parentId) : 'tavle') };
      })).concat(this.db.tavler.filter(t => Number(t.tLaengde) > 0).map(t => {
        const g = this.gruppe(t.fraGruppe), I = this.tilgI(t);
        return { t, e:{ id:'t' + t.id, navn:'Tilgang til ' + t.navn, kabel:t.tKabel, ledere:t.tLedere, tv:t.tTv, laengde:t.tLaengde, lokaleId:'', effekt:Math.round(I * (this.tilg3(t) ? Math.sqrt(3) * 400 : 230)) }, g, tn: g ? this.tavleNavn(g.tavleId) : '',
          lok:t.placering || '–', I, du:this.tilgDu(t), over:false, lmax:null, iz:this.tilgIz(t), izFejl:this.tilgIzFejl(t), via:'tilgangskabel' };
      })).filter(r =>
        (!f.tavle || (r.g && r.g.tavleId === f.tavle)) && (!f.type || (r.g && r.g.type === f.type)) && (!(f.lokale || this.lokF) || r.e.lokaleId === (f.lokale || this.lokF)) &&
        (!q || (r.e.navn + ' ' + r.e.kabel + ' ' + r.lok).toLowerCase().includes(q)));
      const val = r => ({ gruppe: (r.g ? r.tn : '~') + String(r.g ? r.g.nr : 0).padStart(4, '0'), navn:r.e.navn.toLowerCase(), lokale:r.lok.toLowerCase(), tv:Number(r.e.tv), laengde:Number(r.e.laengde), du:r.du })[this.sort.key];
      return rs.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * this.sort.dir; });
    },
    sortBy(k) { this.sort = { key:k, dir: this.sort.key === k ? -this.sort.dir : 1 }; },
    arrow(k) { return this.sort.key === k ? (this.sort.dir > 0 ? '▲' : '▼') : ''; },
    optaelling() {
      const m = {}; for (const r of this.rows()) { const k = r.e.kabel + ' ' + this.kabelDim(r.e); m[k] = (m[k] || 0) + (Number(r.e.laengde) || 0); }
      return Object.keys(m).sort().map(k => ({ k, m:m[k] }));
    },
    goGruppe(gid) { this.sel = gid; this.go('tavle'); },
    filterLokale(lid) { this.filter = { q:'', tavle:'', type:'', lokale:lid }; this.go('kabler'); },

    /* samtidighedsfaktor */
    sfVal(g) { const v = Number(g && g.sf); return v > 0 && v <= 1 ? v : 1; },
    instI(gid) { return this.enhederFor(gid).reduce((s, e) => s + this.strom(e), 0); },
    sfForslag(g) {
      const an = SF[this.db.projekt.anlaeg] ? this.db.projekt.anlaeg : 'bolig', es = g.id ? this.enhederFor(g.id).filter(e => Number(e.effekt) > 0) : null;
      if (es && es.length <= 1) return { v:1, txt:'højst én belastning på gruppen' };
      if (es && es.every(e => ['varme', 'vvb', 'vp', 'ev'].includes(this.symbolFor(e)))) return { v:1, txt:'varme og ladning regnes fuldt' };
      let v = SF[an][g.type] == null ? 1 : SF[an][g.type], txt = (this.typeLabel[g.type] || 'gruppe').toLowerCase() + ' i ' + ANLAEG[an].toLowerCase();
      if (es && g.type === 'stik' && v < 0.8 && es.some(e => /omklæd|fitness|bruse/i.test(this.lokaleNavn(e.lokaleId)) || /hårtørrer/i.test(e.navn))) { v = 0.8; txt += ', omklædning med høj samtidighed'; }
      return { v, txt };
    },
    setSf(gid, v) { const g = this.gruppe(gid), n = Number(String(v).replace(',', '.')); if (g && n > 0 && n <= 1) this.mutate(() => { g.sf = n; }); },
    sfAlle() { this.mutate(() => this.db.grupper.forEach(g => { g.sf = this.sfForslag(g).v; })); this.say('Samtidighedsfaktorer sat efter forslag for ' + ANLAEG[this.db.projekt.anlaeg || 'bolig'].toLowerCase() + '.', true); },

    /* tilgangskabel til tavle */
    tilgTxt(t) { return Number(t.tLaengde) > 0 ? t.tLedere + this.fmt(t.tTv) + ' ' + t.tKabel + ', ' + this.fmt(t.tLaengde) + ' m' : (t.tilgang || ''); },
    tilg3(t) { const g = this.gruppe(t.fraGruppe); return g ? g.faser == 3 : true; },
    tilgI(t) { const s = this.subFaser(t.id, new Set()); return this.tilg3(t) ? Math.max(s.L1, s.L2, s.L3) : s.L1 + s.L2 + s.L3; },
    tilgDu(t) { return Number(t.tLaengde) > 0 ? this.duSeg(this.tilgI(t), Number(t.tLaengde), Number(t.tTv) || 1, this.tilg3(t)) : 0; },
    tilgIz(t) { return Number(t.tLaengde) > 0 ? (IZ[this.tilg3(t) ? 3 : 2][Number(t.tTv)] || 0) : 0; },
    tilgBeskyt(t) { const g = this.gruppe(t.fraGruppe); return g ? g.In : t.forsikring; },
    tilgIzFejl(t) { const z = this.tilgIz(t); return z > 0 && this.tilgBeskyt(t) > z; },
    tavleDu(tid, n) {
      const t = this.tavle(tid); if (!t || n > 8) return 0; const g = this.gruppe(t.fraGruppe);
      return this.tilgDu(t) + (g ? this.tavleDu(g.tavleId, n + 1) : t.fra && t.fra !== t.id ? this.tavleDu(t.fra, n + 1) : 0);
    },

    /* belastning i W, kW eller A samt effektforslag */
    effektForslag(e) {
      const n = String(e.navn || '').toLowerCase(), stk = n.match(/(\d+)\s*stk/), w = n.match(/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kw|w)\b/);
      if (w) { const pr = tal(w[2]) * (w[3] === 'kw' ? 1000 : 1), ant = Number(w[1]) || (stk ? Number(stk[1]) : 1), W = Math.round(pr * ant); return { W, txt:this.fmt(W, 0) + ' W (aflæst fra navnet' + (ant > 1 ? ', ' + ant + ' × ' + this.fmt(pr, 0) + ' W' : '') + ')' }; }
      let r = EFFEKT.find(x => x[0].test(n));
      if (!r && e.symbol && e.symbol !== 'auto' && EFFEKT_SYM[e.symbol]) r = [null, EFFEKT_SYM[e.symbol][0], EFFEKT_SYM[e.symbol][1], false];
      if (!r) return null;
      const m = r[3] && n.match(/(\d+)\s*(?:stk|x\b)/), antal = m ? Math.max(1, Number(m[1])) : 1, W = r[1] * antal;
      return { W, txt: this.fmt(W, 0) + ' W' + (antal > 1 ? ' (' + antal + ' × ' + r[1] + ' W ' + r[2] + ')' : ' (' + r[2] + ')') };
    },
    belFra() {
      const f = this.form, W = Number(f.effekt) || 0; f.belEnh = f.belEnh || 'W';
      f.belVal = f.belEnh === 'kW' ? +(W / 1000).toFixed(3) : f.belEnh === 'A' ? +this.strom(f).toFixed(2) : W;
    },
    belSync() {
      const f = this.form; if (!('belVal' in f)) return; const v = Number(f.belVal) || 0;
      f.effekt = Math.round(f.belEnh === 'kW' ? v * 1000 : f.belEnh === 'A' ? v * (this.tre(f) ? Math.sqrt(3) * 400 : 230) : v);
    },
    belTxt() {
      const f = this.form, u = this.tre(f) ? '3 × 400 V' : '230 V' + (this.gruppe(f.gruppeId) ? '' : ' (ingen gruppe valgt)');
      return f.belEnh === 'A' ? '= ' + this.fmt(f.effekt, 0) + ' W ved ' + u : '= ' + this.fmt(this.strom(f), 2) + ' A ved ' + u;
    },
    brugEffekt() { const x = this.effektForslag(this.form); if (!x) return; this.form.effekt = x.W; this.belFra(); this.eAuto = false; },
    effektAuto() { if (!this.modal || this.modal.id || !this.eAuto) return; const x = this.effektForslag(this.form); if (x) { this.form.effekt = x.W; this.belFra(); } },

});
