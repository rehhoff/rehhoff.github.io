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
    iz(e, tv) { return this.izBeregn(e.kabel, tv || e.tv, this.tre(e), this.forhold(this.gruppe(e.gruppeId))); },
    izFejl(e) { const g = this.gruppe(e.gruppeId); return !!g && !!this.iz(e) && g.In > this.iz(e); },
    forslag(e) {
      const g = this.gruppe(e.gruppeId); if (!g) return null;
      return TV.find(s => this.iz(e, s) >= g.In && this.du(e, s) <= this.duGraense(e)) || null;
    },
    /* Iz med installationsmetode og korrektionsfaktorer (DS/HD 60364-5-52 anneks B). Iz = tabelværdi × k_temp × k_samlet. */
    forhold(o, pre) {
      const p = this.db.projekt, v = k => o ? o[pre ? pre + k[0].toUpperCase() + k.slice(1) : k] : '';
      const metode = METODER[v('metode')] ? v('metode') : METODER[p.metode] ? p.metode : 'C', jord = JORD(metode), t = v('temp'), n = Math.round(Number(v('samlet')));
      return { metode, jord, temp: t !== '' && t != null && TEMPS.includes(Number(t)) ? Number(t) : jord ? (TEMPS.includes(Number(p.jtemp)) ? Number(p.jtemp) : 20) : (TEMPS.includes(Number(p.temp)) ? Number(p.temp) : 30),
        samlet: n >= 1 ? Math.min(20, n) : Math.min(20, Math.max(1, Math.round(Number(p.samlet)) || 1)), lag: LAG[v('lag')] ? v('lag') : LAG[p.lag] ? p.lag : 'bundt' };
    },
    kTemp(iso, f) { return K_TEMP[f.jord ? 'jord' : 'luft'][iso][f.temp] || 1; },
    kSamlet(f) {
      if (f.samlet <= 1 && f.lag !== 'loft') return 1;
      if (f.jord) { const k = K_JORD_SAMLET[f.metode]; return k[Math.min(f.samlet, k.length) - 1]; }
      const k = LAG[f.lag].k, i = KREDSE.findIndex(n => n >= f.samlet);
      return k[Math.min(i < 0 ? KREDSE.length - 1 : i, k.length - 1)];
    },
    izTabel(kabel, tv, tre, metode) { const i = TV.indexOf(Number(tv)); return i < 0 ? 0 : IZT[ISO(kabel)][tre ? 3 : 2][metode || 'C'][i]; },
    izBeregn(kabel, tv, tre, f) {
      f = f || this.forhold(null); const z = this.izTabel(kabel, tv, tre, f.metode); if (!z) return 0;
      const k = this.kTemp(ISO(kabel), f) * this.kSamlet(f);
      return k === 1 ? z : Math.round(z * k * 10) / 10;
    },
    /* Forklaring til brugerfladen: faktorer og tabeller for et kabel under gruppens eller tilgangskablets forhold */
    korrektion(o, pre, kabel) {
      const f = this.forhold(o, pre), iso = ISO(kabel || 'PVC'), kt = this.kTemp(iso, f), ks = this.kSamlet(f);
      const lag = f.jord ? (f.metode === 'D1' ? 'rør i jord, rørene rører hinanden' : 'direkte i jord, kablerne rører hinanden') : LAG[f.lag].navn.toLowerCase();
      return { f, iso, kt, ks, k: kt * ks,
        txt: 'Metode ' + f.metode + ', ' + (iso === 'XLPE' ? 'XLPE 90 °C' : 'PVC 70 °C') + ', ' + (f.jord ? 'jord ' : 'luft ') + f.temp + ' °C (k_temp ' + this.fmt(kt, 2) + '), ' +
          f.samlet + (f.samlet === 1 ? ' kreds' : ' kredse') + (f.samlet > 1 || (!f.jord && f.lag === 'loft') ? ' ' + lag : '') + ' (k_samlet ' + this.fmt(ks, 2) + ')' +
          (f.jord && f.samlet > 6 ? '. Tabellen for jord går til 6 kredse; regnet med 6' : '') };
    },
    setSamlet(v) { const n = Math.round(tal(v)); if (n >= 1 && n <= 20) this.mutate(() => { this.db.projekt.samlet = n; }); },
    forholdTxt(o, pre) {
      const f = this.forhold(o, pre), egen = o && ['metode', 'temp', 'samlet', 'lag'].some(k => (o[pre ? pre + k[0].toUpperCase() + k.slice(1) : k] || '') !== '');
      return f.metode + ' · ' + f.temp + ' °C · ' + f.samlet + (f.samlet === 1 ? ' kreds' : ' kredse') + (egen ? '' : ' (projekt)');
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
      { const k = this.ikMin(g); if (k && k.ok === false) out.push('Ik,min ' + this.ikVis(k) + ' A under Ia ' + this.fmt(k.Ia, 0) + ' A.'); if (this.brydeFejl(g.tavleId).includes(g)) out.push('Ik,maks ' + this.fmt(this.tavleIkMaks(g.tavleId)) + ' kA over brydeevnen på ' + this.fmt(Number(g.brydeevne) || 6) + ' kA.'); }
      for (const d of this.daaserFor(gid)) if (this.daaseIzFejl(d)) out.push(this.daaseTxt(d.id) + ': tilgang ' + this.fmt(d.tv) + ' mm² har Iz ' + this.fmt(this.daaseIz(d)) + ' A, under sikringen på ' + g.In + ' A.');
      for (const e of this.enhederFor(gid)) {
        if (this.duOver(e)) out.push(e.navn + ': ΔU ' + this.fmt(this.du(e), 2) + ' % over ' + this.duGraense(e) + ' %.');
        if (this.izFejl(e)) out.push(e.navn + ': ' + this.fmt(e.tv) + ' mm² har Iz ' + this.fmt(this.iz(e)) + ' A, under sikringen på ' + g.In + ' A.');
      }
      return out;
    },
    /* vurdering af målinger (aftalt 2026-11-16): Zs ≤ 2/3 · U0/Ia med Ia = 5/10/20 × In for B/C/D, HPFI ≤ 300 ms ved 1 × IΔn, Riso ≥ 1 MΩ */
    maalTal(s) { const t = String(s == null ? '' : s).trim(); if (!t) return null; const n = parseFloat(t.replace(',', '.').replace(/^[^\d.]+/, '')); return isNaN(n) ? NaN : n; },
    ia(g) { return ({ B:5, C:10, D:20 }[g.kar] || 0) * (Number(g.In) || 0); },
    zsMax(g) { const Ia = this.ia(g); return Ia ? 2 / 3 * 230 / Ia : 0; },
    /* kortslutningsstrøm (aftalt 2026-11-16): Ik,min = 0,95 · 230 / (Ze + Rfase + RPE). Ledermodstand × 1,2 (PVC 70 °C) eller 1,28 (XLPE 90 °C), PE som faseleder. Vejledende. */
    kLeder(kabel) { return ISO(kabel) === 'XLPE' ? 1.28 : 1.2; },
    rSloejfe(kabel, L, A) { return 2 * RHO * this.kLeder(kabel) * (Number(L) || 0) / (Number(A) || 1); },
    tavleOp(t) { const g = this.gruppe(t.fraGruppe); return g ? g.tavleId : t.fra && t.fra !== t.id ? t.fra : ''; },
    tavleZe(tid, n) {
      const t = this.tavle(tid); if (!t || n > 8) return null; if (Number(t.ze) > 0) return Number(t.ze);
      const op = this.tavleOp(t); if (!op || !(Number(t.tLaengde) > 0)) return null;
      const z = this.tavleZe(op, (n || 0) + 1); return z == null ? null : z + this.rSloejfe(t.tKabel, t.tLaengde, t.tTv);
    },
    tavleIkMaks(tid, n) { const t = this.tavle(tid); if (!t || n > 8) return 0; if (Number(t.ikMaks) > 0) return Number(t.ikMaks); const op = this.tavleOp(t); return op ? this.tavleIkMaks(op, (n || 0) + 1) : 0; },
    enhedR(e) { let r = this.rSloejfe(e.kabel, e.laengde, e.tv), d = this.daase(e.daaseId), n = 0; while (d && n++ < 20) { r += this.rSloejfe(d.kabel, d.laengde, d.tv); d = this.daase(d.parentId); } return r; },
    ikMin(g) {
      const ze = this.tavleZe(g.tavleId); if (ze == null) return null;
      const rs = this.enhederFor(g.id).map(e => this.enhedR(e)).concat(this.underTavler(g.id).filter(u => Number(u.tLaengde) > 0).map(u => this.rSloejfe(u.tKabel, u.tLaengde, u.tTv)));
      if (!rs.length) return null;
      const R = Math.max(...rs), Ia = this.ia(g), ik = 0.95 * 230 / (ze + R);
      return { ze, R, ik, Ia, ok: Ia ? ik >= Ia : null };
    },
    /* Ik,min vises rundet ned, så en værdi lige under Ia ikke står som lig med Ia */
    ikVis(k) { return this.fmt(Math.floor(k.ik), 0); },
    ikTxt(g) { const k = this.ikMin(g); return k ? 'Ze ' + this.fmt(k.ze, 3) + ' Ω + R ' + this.fmt(k.R, 3) + ' Ω (fase og PE). Ia = ' + this.fmt(k.Ia, 0) + ' A. Brydeevne ' + this.fmt(Number(g.brydeevne) || 6) + ' kA.' : 'Angiv Ze på tavlen for at få Ik,min. En undertavle uden egen Ze regnes fra den forsynende tavle gennem tilgangskablet.'; },
    brydeFejl(tid) { const ik = this.tavleIkMaks(tid); return ik ? this.grupperFor(tid).filter(g => ik > (Number(g.brydeevne) || 6)) : []; },
    kortslutFejl() {
      const out = [];
      for (const t of this.db.tavler) {
        const gs = this.brydeFejl(t.id);
        if (gs.length) out.push({ k:'kb:' + t.id, t:t.id, g:gs[0].id, txt:`${t.navn}: Ik,maks ${this.fmt(this.tavleIkMaks(t.id))} kA er større end brydeevnen for gruppe ${gs.map(g => g.nr + ' (' + this.fmt(Number(g.brydeevne) || 6) + ' kA)').join(', ')}.` });
        for (const g of this.grupperFor(t.id)) { const k = this.ikMin(g); if (k && k.ok === false) out.push({ k:'ik:' + g.id, t:t.id, g:g.id, txt:`${t.navn} · gruppe ${g.nr} ${g.navn}: Ik,min ${this.ikVis(k)} A er under Ia ${this.fmt(k.Ia, 0)} A for ${g.kar}${g.In}.` + (this.rcd(g) ? ' Udkobling ved jordfejl afhænger af HPFI.' : '') }); }
      }
      return out;
    },
    /* selektivitet (aftalt 2026-11-16): forsikring ≥ 1,6 × største efterfølgende sikring. En tavle forsynet fra en gruppe tjekkes på gruppen, ikke på sin egen forsikring. HPFI i serie: den forreste type S og IΔn ≥ 3 × den bageste. Vejledende. */
    rcdForan(tid, n) { const t = this.tavle(tid), g = t && this.gruppe(t.fraGruppe); if (!g || n > 8) return null; return this.rcd(g) || this.rcdForan(g.tavleId, (n || 0) + 1); },
    selektivitet() {
      const out = [], stoerst = l => l.reduce((m, x) => !m || x.In > m.In ? x : m, null), gr = tid => this.grupperFor(tid).map(g => ({ In:Number(g.In) || 0, txt:'gruppe ' + g.nr + ' (' + g.kar + g.In + ')' }));
      for (const t of this.db.tavler) {
        const m = stoerst(gr(t.id).concat(this.db.tavler.filter(u => u.fra === t.id && u.id !== t.id && !this.gruppe(u.fraGruppe)).map(u => ({ In:Number(u.forsikring) || 0, txt:'forsikringen i ' + u.navn + ' (' + u.forsikring + ' A)' }))));
        if (m && !this.gruppe(t.fraGruppe) && t.forsikring < 1.6 * m.In) out.push({ k:'sf:' + t.id, t:t.id, txt:`${t.navn}: forsikring ${t.forsikring} A er under 1,6 × ${m.txt}. Selektivitet er ikke sikret.` });
        for (const g of this.grupperFor(t.id)) {
          const mu = stoerst(this.underTavler(g.id).flatMap(u => gr(u.id).map(x => Object.assign(x, { txt:u.navn + ' ' + x.txt }))));
          if (mu && g.In < 1.6 * mu.In) out.push({ k:'sg:' + g.id, t:t.id, g:g.id, txt:`${t.navn} · gruppe ${g.nr} ${g.navn}: ${g.kar}${g.In} er under 1,6 × ${mu.txt}. Selektivitet er ikke sikret.` });
        }
        const f = this.rcdForan(t.id);
        if (f) for (const r of this.rcdsFor(t.id)) if (this.db.grupper.some(g => g.rcdId === r.id && g.tavleId === t.id) && !(f.selektiv && f.idn >= 3 * r.idn))
          out.push({ k:'sr:' + r.id, t:t.id, txt:`${t.navn}: ${r.navn} (${r.idn} mA) sidder efter ${f.navn} (${f.idn} mA${f.selektiv ? ', type S' : ''}) i ${this.tavleNavn(f.tavleId)}. ` + (f.selektiv ? 'Den forreste skal have mindst 3 × IΔn.' : 'Den forreste skal være type S med mindst 3 × IΔn.') });
      }
      return out;
    },
    maalVurdering(g) {
      const m = g.maal || {}, riso = this.maalTal(m.riso), zs = this.maalTal(m.zs), t = this.maalTal(m.rcd), zmax = this.zsMax(g), harRcd = !!this.rcd(g);
      const vurd = (x, ok) => x == null ? null : isNaN(x) ? false : ok(x);
      const r = { riso:vurd(riso, x => x >= 1), zs:zmax ? vurd(zs, x => x <= zmax) : null, rcd:harRcd ? vurd(t, x => x <= 300) : null, zmax, harRcd, fejl:[] };
      if (r.riso === false) r.fejl.push(isNaN(riso) ? 'isolationsmodstand kan ikke læses' : 'isolationsmodstand ' + this.fmt(riso, 2) + ' MΩ under 1 MΩ');
      if (r.zs === false) r.fejl.push(isNaN(zs) ? 'Zs kan ikke læses' : 'Zs ' + this.fmt(zs, 2) + ' Ω over ' + this.fmt(zmax, 2) + ' Ω');
      if (r.rcd === false) r.fejl.push(isNaN(t) ? 'udløsetid kan ikke læses' : 'HPFI-udløsetid ' + this.fmt(t, 0) + ' ms over 300 ms');
      const mangler = r.riso === null || (zmax && r.zs === null) || (harRcd && r.rcd === null) || !m.ok;
      r.status = r.fejl.length ? 'fejl' : mangler ? 'mangler' : 'ok';
      r.txt = r.status === 'fejl' ? 'Fejl: ' + r.fejl.join(', ') : r.status === 'ok' ? 'OK' : 'Mangler måling';
      return r;
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
      for (const g of this.sorteredeGrupper()) { const v = this.maalVurdering(g); if (v.status === 'fejl') out.push({ k:'m' + g.id, g:g.id, txt:`${this.tavleNavn(g.tavleId)} · gruppe ${g.nr} ${g.navn}: måling over grænsen (${v.fejl.join(', ')}).` }); }
      out.push(...this.kortslutFejl(), ...this.selektivitet());
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
    /* Fasefordeling: største 1-fasede gruppe først, på den fase der har mindst last. Bruges af forslaget (faseForesla) og af autoBalance. */
    fasePlan(tid) {
      const gs = this.grupperFor(tid), tot = { L1:0, L2:0, L3:0 }, cnt = { L1:0, L2:0, L3:0 };
      const last = {}; gs.forEach(g => { last[g.id] = this.gruppeI(g.id); });
      gs.filter(g => g.faser == 3).forEach(g => { const f = this.gruppeFaser(g, new Set([tid])); PH.forEach(p => { tot[p] += f[p]; }); });
      this.db.tavler.filter(u => u.fra === tid && u.id !== tid && !this.gruppe(u.fraGruppe)).forEach(u => { const s = this.subFaser(u.id, new Set([tid])); PH.forEach(p => { tot[p] += s[p]; }); });
      const plan = gs.filter(g => g.faser != 3).sort((a, b) => last[b.id] - last[a.id]).map(g => {
        const p = PH.slice().sort((x, y) => (tot[x] - tot[y]) || (cnt[x] - cnt[y]))[0];
        tot[p] += last[g.id]; cnt[p]++; return [g, p];
      });
      return { plan, tot, last };
    },
    autoBalance(tid) {
      const { plan, tot } = this.fasePlan(tid);
      this.mutate(() => plan.forEach(([g, p]) => { g.fase = p; }));
      this.say(this.tavleNavn(tid) + ': faser omfordelt. L1 ' + this.fmt(tot.L1) + ' A, L2 ' + this.fmt(tot.L2) + ' A, L3 ' + this.fmt(tot.L3) + ' A.', true);
    },
    /* Forslag til fasefordeling: vises først, og intet ændres, før brugeren vælger Anvend (faseAnvend). */
    faseForesla(tid) {
      const { plan, tot, last } = this.fasePlan(tid), fi = this.faseInfo(tid), foer = {}; fi.vals.forEach(v => { foer[v.p] = v.I; });
      const diff = Math.max(tot.L1, tot.L2, tot.L3) - Math.min(tot.L1, tot.L2, tot.L3);
      const rows = plan.filter(([g, p]) => g.fase !== p).map(([g, p]) => ({ id:g.id, nr:g.nr, navn:g.navn, fra:g.fase, til:p, I:last[g.id] })).sort((x, y) => x.nr - y.nr);
      if (!rows.length || diff >= fi.diff - 0.05) { this.faseFs = null; this.say(this.tavleNavn(tid) + ': forslaget giver ikke en bedre fasebalance end den nuværende (' + this.fmt(fi.diff) + ' A mellem faserne).'); return; }
      this.faseFs = { tid, rows, foer, efter:{ L1:tot.L1, L2:tot.L2, L3:tot.L3 }, diffFoer:fi.diff, diff };
    },
    faseAnvend() {
      const f = this.faseFs; if (!f) return; this.faseFs = null;
      this.mutate(() => f.rows.forEach(r => { const g = this.gruppe(r.id); if (g && g.faser != 3) g.fase = r.til; }));
      this.say(this.tavleNavn(f.tid) + ': ' + f.rows.length + (f.rows.length === 1 ? ' gruppe' : ' grupper') + ' flyttet. L1 ' + this.fmt(f.efter.L1) + ' A, L2 ' + this.fmt(f.efter.L2) + ' A, L3 ' + this.fmt(f.efter.L3) + ' A.', true);
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
    /* materialeliste: hele projektet, uafhængigt af filtre */
    materialer() {
      const d = this.db, num = v => Number(v) || 0, tael = (liste, nøgle) => { const m = new Map(); for (const x of liste) { const k = nøgle(x); m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => a[0].localeCompare(b[0], 'da')).map(([tekst, antal]) => ({ tekst, antal, enhed:'stk' })); };
      const meter = new Map(), data = new Map();
      for (const e of d.enheder.concat(d.daaser)) { const k = e.kabel + ' ' + this.kabelDim(e); meter.set(k, (meter.get(k) || 0) + num(e.laengde)); }
      for (const t of d.tavler) if (num(t.tLaengde) > 0) { const k = t.tKabel + ' ' + t.tLedere + this.fmt(t.tTv) + ' mm²'; meter.set(k, (meter.get(k) || 0) + num(t.tLaengde)); }
      for (const l of d.links) data.set(l.kabel, (data.get(l.kabel) || 0) + num(l.laengde));
      const lang = m => [...m].sort((a, b) => a[0].localeCompare(b[0], 'da')).map(([tekst, v]) => ({ tekst, antal:Math.ceil(Math.round(v * 100) / 100), enhed:'m' })).filter(x => x.antal > 0);
      const afb = new Map(); for (const a of d.afbrydere) { const k = this.afbArt[a.art] || a.art; const o = afb.get(k) || { antal:0, steder:0 }; o.antal++; o.steder += this.afbSteder(a); afb.set(k, o); }
      const afbL = [...afb].sort((a, b) => a[0].localeCompare(b[0], 'da')).map(([tekst, o]) => ({ tekst:tekst + (['Kroneafbryder', 'Korrespondanceafbryder', 'Krydsafbryder'].includes(tekst) ? ' (' + o.steder + ' betjeningssteder)' : ''), antal:o.antal, enhed:'stk' }));
      const ud = [
        { gruppe:'Kabler', linjer:lang(meter) },
        { gruppe:'Datakabler', linjer:lang(data) },
        { gruppe:'Samlepunkter', linjer:tael(d.daaser, x => x.type) },
        { gruppe:'Afbrydere', linjer:afbL },
        { gruppe:'Automatsikringer', linjer:tael(d.grupper, g => g.kar + g.In + ', ' + (g.faser == 3 ? '3' : '1') + '-polet') },
        { gruppe:'HPFI', linjer:tael(d.rcds, r => 'Type ' + r.type + ' ' + this.fmt(r.In, 0) + ' A ' + this.fmt(r.idn, 0) + ' mA') },
        { gruppe:'Brugsgenstande', linjer:tael(d.enheder, e => this.symNavn[this.symbolFor(e)] || this.symbolFor(e)) }
      ];
      return ud.filter(g => g.linjer.length);
    },
    materialeTsv() {
      const r = [['Gruppe', 'Materiale', 'Antal', 'Enhed']];
      for (const g of this.materialer()) for (const l of g.linjer) r.push([g.gruppe, l.tekst, l.antal, l.enhed]);
      return r.map(x => x.join('\t')).join('\n');
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
    tilgIz(t) { return Number(t.tLaengde) > 0 ? this.izBeregn(t.tKabel, t.tTv, this.tilg3(t), this.forhold(t, 't')) : 0; },
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
