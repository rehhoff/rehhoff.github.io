/* Afleveringstjek (forslag 10) og tavlefortegnelse til tavlelågen (forslag 11). Bruger kun eksisterende data.
   Metoderne samles i app() i js/app.js. Se docs/planer/2026-11-18-aflevering-fortegnelse.md. */
const APP_AFLEVERING = () => ({
  /* afleveringstjek: kategorier med punkter. Et punkt har { k, txt, nav } og åbnes med aflGaa(punkt) */
  aflTjek() {
    const d = this.db, kat = [], K = (k, l, punkter) => kat.push({ k, l, punkter });
    const g = this.sorteredeGrupper(), gt = x => this.tavleNavn(x.tavleId) + ' · gruppe ' + x.nr + ' ' + x.navn;
    K('tom', 'Grupper uden brugsgenstande', g.filter(x => !this.enhederFor(x.id).length && !this.daaserFor(x.id).length && !this.underTavler(x.id).length)
      .map(x => ({ k:'tom' + x.id, txt:gt(x) + ': ingen brugsgenstande.', nav:{ g:x.id } })));
    const enh = d.enheder.filter(e => !this.gruppe(e.gruppeId) || !e.kabel || !(Number(e.laengde) > 0));
    K('enh', 'Brugsgenstande uden gruppe, kabel eller længde', enh.map(e => ({ k:'enh' + e.id,
      txt:e.navn + ': ' + [!this.gruppe(e.gruppeId) && 'ingen gruppe', !e.kabel && 'ingen kabel', !(Number(e.laengde) > 0) && 'ingen længde'].filter(Boolean).join(', ') + '.', nav:{ type:'enhed', obj:e } })));
    K('kob', 'Manglende koblinger', this.mangler().filter(m => m.kat !== 'gruppe').map(m => ({ k:'kob' + m.k, txt:m.navn + ': ' + m.txt, nav:{ type:m.type, obj:m.obj } })));
    const maal = [];
    for (const x of g) {
      const v = this.maalVurdering(x), m = x.maal || {};
      if (v.status === 'fejl') maal.push({ k:'mf' + x.id, txt:gt(x) + ': måling fejlet (' + v.fejl.join(', ') + ').', nav:{ g:x.id } });
      else if (v.riso === null || (v.zmax && v.zs === null) || (v.harRcd && v.rcd === null)) maal.push({ k:'mm' + x.id, txt:gt(x) + ': mangler måling.', nav:{ g:x.id } });
      if (!m.ok) maal.push({ k:'mv' + x.id, txt:gt(x) + ': visuel kontrol er ikke afkrydset.', nav:{ g:x.id } });
    }
    K('maal', 'Målinger og visuel kontrol', maal);
    const tav = [];
    for (const t of d.tavler) {
      if (t.fra && !t.tilgang && !(Number(t.tLaengde) > 0)) tav.push({ k:'ta' + t.id, txt:t.navn + ': mangler tilgangskabel.', nav:{ type:'tavle', obj:t } });
      if (this.tavleZe(t.id) == null) tav.push({ k:'tz' + t.id, txt:t.navn + ': mangler Ze.', nav:{ type:'tavle', obj:t } });
    }
    K('tavle', 'Tavler uden tilgangskabel eller Ze', tav);
    const tr = d.enheder.concat(d.daaser, d.afbrydere).filter(x => Number(x.laengde) > 0 && !x.trukket).map(x => ({ k:'tr' + x.id,
      txt:(x.type ? x.type + ' ' : '') + x.navn + ': kablet er ikke trukket.', nav:{ type:d.afbrydere.includes(x) ? 'afbryder' : d.daaser.includes(x) ? 'daase' : 'enhed', obj:x } }));
    d.tavler.filter(t => Number(t.tLaengde) > 0 && !t.tTrukket).forEach(t => tr.push({ k:'tt' + t.id, txt:t.navn + ': tilgangskablet er ikke trukket.', nav:{ type:'tavle', obj:t } }));
    K('trukket', 'Kabler, der ikke er trukket', tr);
    K('brand', 'Brandlukninger, der ikke er udført eller mangler mærkat', d.brandlukninger.slice().sort((a, b) => a.nr - b.nr).filter(b => !b.udfoert || !b.maerkat)
      .map(b => ({ k:'bl' + b.id, txt:'Brandlukning ' + b.nr + (b.placering ? ' (' + b.placering + ')' : '') + ': ' + [!b.udfoert && 'ikke udført', !b.maerkat && 'mangler mærkat'].filter(Boolean).join(', ') + '.', nav:{ type:'brand', obj:b } })));
    K('adv', 'Advarsler', this.warnings().map(w => ({ k:'w' + w.k, txt:w.txt, nav:w.g ? { g:w.g } : w.t || w.bal ? { view:'tavle' } : { view:'beregning' } })));
    return kat;
  },
  aflAntal() { return this.aflTjek().reduce((n, k) => n + k.punkter.length, 0); },
  aflGaa(p) {
    const n = p.nav || {};
    if (n.g) this.goGruppe(n.g); else if (n.type) this.openForm(n.type, n.obj); else if (n.view) this.go(n.view);
  },
  aflDocLinje() {
    const n = this.aflAntal(); if (!n) return '';
    return '<p class="k">Afleveringstjek: ' + n + (n === 1 ? ' punkt mangler' : ' punkter mangler') + '.</p>';
  },

  /* tavlefortegnelse: én A4-side til tavlelågen */
  tavleFortegnelseHtml(tid) {
    const t = this.tavle(tid); if (!t) return '';
    const f = this.firma || {}, gs = this.grupperFor(tid), p = this.db.projekt;
    const dato = new Date().toLocaleDateString('da-DK', { day:'numeric', month:'long', year:'numeric' });
    const kort = gid => {
      const l = this.enhederFor(gid).map(e => (Number(e.antal) > 1 ? e.antal + '× ' : '') + e.navn);
      return l.length > 8 ? l.slice(0, 8).join(', ') + ' + ' + (l.length - 8) + ' flere' : l.join(', ');
    };
    const hpfi = g => { const r = this.rcd(g); return r ? r.idn + ' mA ' + r.type + (r.selektiv ? ' S' : '') : '–'; };
    let h = '<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><title>Tavlefortegnelse ' + esc(t.navn) + '</title><style>' +
      '@page{size:A4;margin:10mm}body{font:14px/1.3 Arial,sans-serif;color:#000;margin:0}h1{font-size:26px;margin:0}.m{color:#333;font-size:14px;margin:2px 0 8px}' +
      'table{border-collapse:collapse;width:100%}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #000;padding:3px 6px;text-align:left;vertical-align:top}' +
      'th{background:#ddd;font-size:11px;text-transform:uppercase}td.n{font-size:20px;font-weight:bold;text-align:center;width:11mm}td.k{font-weight:bold;white-space:nowrap;font-size:16px}.s{font-size:12px;color:#222}' +
      '.fa{display:flex;align-items:center;gap:10px;font-size:12px;margin-top:8px;border-top:1px solid #000;padding-top:4px}.fa img{max-height:30px;max-width:120px}</style></head><body>' +
      '<h1>' + esc(t.navn) + '</h1><p class="m">' + esc([t.placering, 'Forsikring ' + t.forsikring + ' A', p.navn].filter(Boolean).join(' · ')) + '</p>';
    h += '<table><thead><tr><th>Gr.</th><th>Betegnelse</th><th>Sikring</th><th>Faser</th><th>HPFI</th><th>Lokaler og brugsgenstande</th></tr></thead><tbody>';
    for (const g of gs) h += '<tr><td class="n">' + esc(g.nr) + '</td><td><b>' + esc(g.navn) + '</b></td><td class="k">' + esc(g.kar + g.In) + ' A</td><td>' + (g.faser == 3 ? 'L1 L2 L3' : esc(g.fase)) + '</td><td>' + esc(hpfi(g)) + '</td><td>' +
      esc(this.lokalerIGruppe(g.id).map(l => l.navn).join(', ')) + '<div class="s">' + esc(kort(g.id)) + '</div></td></tr>';
    if (!gs.length) h += '<tr><td colspan="6">Ingen grupper.</td></tr>';
    h += '</tbody></table><div class="fa">' + (/^data:image\//.test(f.logo || '') ? '<img src="' + esc(f.logo) + '" alt="Logo">' : '') + '<span>' + esc([f.navn, dato].filter(Boolean).join(' · ')) + '</span></div></body></html>';
    return h;
  },
  udskrivFortegnelse(tid) {
    const w = window.open('', '_blank');
    if (!w) { this.say('Browseren blokerede det nye vindue. Tillad pop-up for denne side.'); return null; }
    w.document.open(); w.document.write(this.tavleFortegnelseHtml(tid)); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
    return w;
  },
});
