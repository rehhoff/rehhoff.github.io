/* Import fra regneark (forslag 16): indsæt celler fra Excel og opret brugsgenstande eller lokaler efter en forhåndsvisning.
   Bruger kun eksisterende felter. Metoderne samles i app() i js/app.js. Se docs/planer/2026-11-18-import-regneark.md. */
const IMP_FELTER = {
  enhed: [['navn', 'Navn'], ['lokale', 'Lokale'], ['gruppe', 'Gruppe'], ['effekt', 'Effekt (W)'], ['kw', 'Effekt (kW)'], ['a', 'Strøm (A)'], ['kabel', 'Kabeltype'], ['ledere', 'Ledere'], ['tv', 'Tværsnit (mm²)'], ['laengde', 'Længde (m)'], ['placering', 'Placering'], ['hoejde', 'Højde (cm)']],
  lokale: [['navn', 'Navn'], ['etage', 'Etage']]
};
/* Overskrifter uden hensyn til store/små bogstaver, æøå og tegnsætning. Enheden i parentes (kW, A, W) kan stå efter feltet. */
const IMP_NAVNE = {
  navn:['navn', 'brugsgenstand', 'enhed', 'betegnelse'], lokale:['lokale', 'rum'], gruppe:['gruppe', 'gr', 'gruppenr', 'gruppenummer', 'gruppenavn'],
  effekt:['effekt', 'w', 'watt'], kw:['kw', 'kilowatt'], a:['a', 'amp', 'ampere', 'strom', 'stroem'], kabel:['kabel', 'kabeltype'], ledere:['ledere', 'leder'],
  tv:['tvaersnit', 'mm2', 'mm'], laengde:['laengde', 'm', 'meter'], placering:['placering'], hoejde:['hoejde'], etage:['etage']
};
const impNorm = s => String(s == null ? '' : s).toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/²/g, '2').replace(/[^a-z0-9]/g, '');
const APP_IMPORT = () => ({
    impAaben(type) { this.imp = { aaben:true, type, tekst:'', hdr:true, hdrRoert:false, map:[], raekker:[], fh:[], opretLok:true }; this.$nextTick(() => { const el = document.getElementById('imp-tekst'); if (el) el.focus(); }); },
    impFelter() { return IMP_FELTER[this.imp.type]; },
    impSkift(type) { this.imp.type = type; this.impAnalyser(); },
    /* Celler: tabulator hvis der er nogen, ellers semikolon, ellers komma. Tomme linjer springes over. */
    impCeller(tekst) {
      const t = String(tekst || '').replace(/\r/g, ''), skil = t.includes('\t') ? '\t' : t.includes(';') ? ';' : ',';
      return t.split('\n').map(l => l.split(skil).map(c => c.trim().replace(/^"(.*)"$/, '$1').trim())).filter(r => r.some(c => c !== ''));
    },
    impNoegle(h) {
      const m = String(h).match(/\(([^)]*)\)/), base = impNorm(String(h).replace(/\([^)]*\)/g, '')), enh = m ? impNorm(m[1]) : '', felter = this.impFelter().map(f => f[0]);
      const find = n => Object.keys(IMP_NAVNE).find(k => felter.includes(k) && IMP_NAVNE[k].includes(n)) || '';
      if (base === 'effekt' && (enh === 'kw' || enh === 'a')) return felter.includes(enh) ? enh : '';
      return find(base);
    },
    impAnalyser() {
      const i = this.imp, R = this.impCeller(i.tekst), n = R.reduce((m, r) => Math.max(m, r.length), 0);
      const hm = R.length ? Array.from({ length:n }, (_, c) => this.impNoegle(R[0][c] || '')) : [];
      const kendte = hm.filter(Boolean).length;
      if (R.length && !i.hdrRoert) i.hdr = kendte > 0 && kendte >= Math.min(2, n);
      i.raekker = R;
      const brugt = new Set(); i.map = Array.from({ length:n }, (_, c) => { const k = i.hdr ? hm[c] : (c === 0 ? 'navn' : ''); if (!k || brugt.has(k)) return ''; brugt.add(k); return k; });
      this.impByg();
    },
    impHdrSkift() { this.imp.hdrRoert = true; this.impAnalyser(); },
    impTal(v) { const s = String(v).trim().replace(/\s/g, '').replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; },
    impGruppe(v) {
      const s = String(v).trim(); if (!s) return { id:this.sel || '' };
      const m = s.match(/^(?:(.+?)\s*[:\/·]\s*)?(?:gr\.?\s*)?(\d+)$/i);
      if (m) {
        const cur = this.sg(), ts = this.db.tavler, t = m[1] ? ts.find(t => t.navn.toLowerCase() === m[1].trim().toLowerCase()) : (cur ? this.tavle(cur.tavleId) : ts[0]);
        const g = t && this.grupperFor(t.id).find(g => g.nr === Number(m[2]));
        if (g) return { id:g.id };
        if (m[1] && !t) return { fejl:'Ukendt tavle "' + m[1] + '"' };
        return { fejl:'Ukendt gruppe "' + s + '"' };
      }
      const hit = this.db.grupper.filter(g => g.navn.toLowerCase() === s.toLowerCase());
      return hit.length === 1 ? { id:hit[0].id } : { fejl:(hit.length ? 'Flere grupper hedder "' : 'Ukendt gruppe "') + s + '"' };
    },
    /* Bygger forhåndsvisningen: en post pr. række med fejl, så kun gyldige rækker kan importeres. */
    impByg() {
      const i = this.imp, felter = i.map, data = i.raekker.slice(i.hdr ? 1 : 0), type = i.type, ud = [];
      const sd = this.db.projekt.sidst || { kabel:'PVC', ledere:'3G', tv:1.5 };
      const navne = new Set(this.db.lokaler.map(l => l.navn.toLowerCase()));
      data.forEach((r, ri) => {
        const v = {}; felter.forEach((k, c) => { if (k && r[c] != null && r[c] !== '') v[k] = r[c]; });
        const fejl = [], navn = String(v.navn || '').trim(); let o = null, ny = '';
        if (!navn) fejl.push('Navn mangler');
        if (type === 'lokale') {
          if (navn && navne.has(navn.toLowerCase())) fejl.push('Lokalet findes allerede');
          o = { navn, etage:String(v.etage || '').trim() }; if (navn) navne.add(navn.toLowerCase());
        } else {
          o = { navn, gruppeId:this.sel || '', lokaleId:'', daaseId:'', fraEnhed:'', fase:'', hoejde:'', placering:String(v.placering || '').trim(), trukket:false, note:'', symbol:'auto', effekt:0, kabel:sd.kabel, ledere:sd.ledere, tv:sd.tv, laengde:10 };
          if (v.gruppe) { const g = this.impGruppe(v.gruppe); if (g.fejl) fejl.push(g.fejl); else o.gruppeId = g.id; }
          if (v.lokale) {
            const l = this.db.lokaler.find(l => l.navn.toLowerCase() === String(v.lokale).trim().toLowerCase());
            if (l) o.lokaleId = l.id; else if (i.opretLok) ny = String(v.lokale).trim(); else fejl.push('Ukendt lokale "' + v.lokale + '"');
          }
          if (v.kabel) { const k = KABLER.find(k => k.toLowerCase() === String(v.kabel).trim().toLowerCase()); if (k) o.kabel = k; else fejl.push('Ukendt kabeltype "' + v.kabel + '"'); }
          let ledOk = false;
          if (v.ledere) {
            const m = String(v.ledere).trim().match(/^([2-5])\s*([gx])\s*(\d+(?:[.,]\d+)?)?$/i), led = m ? m[1] + m[2].toUpperCase() : '';
            if (['2X', '3G', '4G', '5G'].includes(led)) { o.ledere = led; ledOk = true; if (m[3] && !v.tv) o.tv = tal(m[3]); } else fejl.push('Ukendte ledere "' + v.ledere + '"');
          }
          if (v.tv) { const t = this.impTal(v.tv); if (TV.includes(t)) o.tv = t; else fejl.push('Ugyldigt tværsnit "' + v.tv + '"'); }
          if (!TV.includes(o.tv)) fejl.push('Ugyldigt tværsnit "' + o.tv + '"');
          if (v.laengde != null) { const t = this.impTal(v.laengde); if (isNaN(t)) fejl.push('Ugyldig længde "' + v.laengde + '"'); else o.laengde = t; }
          if (v.hoejde != null) { const t = this.impTal(v.hoejde); if (isNaN(t)) fejl.push('Ugyldig højde "' + v.hoejde + '"'); else o.hoejde = t > 0 ? t : ''; }
          if (!ledOk && this.tre(o)) o.ledere = '5G';
          else if (!ledOk && ['4G', '5G'].includes(o.ledere)) o.ledere = '3G';
          for (const [k, f] of [['effekt', 1], ['kw', 1000], ['a', 0]]) {
            if (v[k] == null) continue; const t = this.impTal(v[k]);
            if (isNaN(t)) { fejl.push('Ugyldig effekt "' + v[k] + '"'); continue; }
            o.effekt = Math.round(k === 'a' ? t * (this.tre(o) ? Math.sqrt(3) * 400 : 230) : t * f);
          }
        }
        const lok = o.lokaleId ? this.db.lokaler.find(l => l.id === o.lokaleId) : null;
        ud.push({ nr:ri + 1 + (i.hdr ? 1 : 0), o, fejl, nyLokale:ny, ok:!fejl.length, lokTxt:ny ? ny + ' (nyt)' : lok ? lok.navn : '' });
      });
      i.fh = ud;
    },
    impAntal() { return (this.imp.fh || []).filter(r => r.ok).length; },
    impFejlAntal() { return (this.imp.fh || []).filter(r => !r.ok).length; },
    /* Alt oprettes i én mutate, så det kan fortrydes med Fortryd. */
    impGem() {
      const i = this.imp, ok = (i.fh || []).filter(r => r.ok); if (!ok.length) return;
      const type = i.type, nyL = new Map(); let nLok = 0;
      this.mutate(() => {
        for (const r of ok) {
          const o = Object.assign({}, r.o); o.id = uid();
          if (type === 'enhed' && r.nyLokale) {
            const key = r.nyLokale.toLowerCase();
            if (!nyL.has(key)) { const l = { id:uid(), navn:r.nyLokale, etage:'' }; this.db.lokaler.push(l); nyL.set(key, l.id); nLok++; }
            o.lokaleId = nyL.get(key);
          }
          this.db[type === 'lokale' ? 'lokaler' : 'enheder'].push(o);
        }
      });
      i.aaben = false;
      this.say(ok.length + (type === 'lokale' ? ' lokaler' : ' brugsgenstande') + ' oprettet' + (nLok ? ' (og ' + nLok + ' nye lokaler)' : '') + '.', true);
    }
});
