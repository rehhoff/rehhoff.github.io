/* Brandlukning (skema 15): registrering af brandtætning af huller og gennemføringer ind i og igennem brandvægge og brandceller.
   Billederne håndteres i js/billeder.js. Metoderne samles i app() i js/app.js. Se docs/planer/2026-11-18-brandlukning.md. */
const APP_BRAND = () => ({
    brandI() { return this.db.brandlukninger.filter(b => !this.lokF || b.lokaleId === this.lokF); },
    brandListe() { return this.brandI().filter(b => !this.brandIkke || !b.udfoert || !b.maerkat).sort((a, b) => a.nr - b.nr); },
    brandOptael() { const L = this.brandI(); return { n:L.length, udfoert:L.filter(b => b.udfoert).length, maerkat:L.filter(b => b.maerkat).length }; },
    brandNaesteNr() { return this.db.brandlukninger.reduce((m, b) => Math.max(m, Number(b.nr) || 0), 0) + 1; },
    brandProdukter() { return [...new Set(this.db.brandlukninger.map(b => b.produkt.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'da')); },
    brandKlasser() { return BRANDKLASSER; },
    brandProduktListe() { return BRANDPRODUKTER; },
    brandProduktTxt(b) { return (b.produkter || []).concat(b.produkt ? [b.produkt] : []).join(', '); },
    brandKlasseTxt(b) { return (b.brandklasser || []).concat(b.brandklasse ? [b.brandklasse] : []).join(', '); },
    /* duplikér: samme oplysninger, næste ledige nummer, ikke udført, uden mærkat, billeder og note */
    brandDup(b) {
      if (!b) return; const c = Object.assign(JSON.parse(JSON.stringify(b)), { id:uid(), nr:this.brandNaesteNr(), udfoert:false, maerkat:false, billeder:[], note:'' });
      this.mutate(() => { this.db.brandlukninger.push(c); }); this.modal = null;
      this.say('Brandlukning ' + c.nr + ' er oprettet som kopi af ' + b.nr + '. Status, note og billeder er ikke kopieret.', true);
    },
    brandNy() { this.openForm('brand', null, { lokaleId:this.lokF || '' }); },
    brandSaet(b, felt, v) { if (b[felt] === v) return; this.mutate(() => { b[felt] = v; }); },
    brandGem() {
      if (this.billedArbejder) { this.say('Vent, til billederne er gjort klar.'); return; }
      const f = this.form, id = this.modal.id, t = k => String(f[k] == null ? '' : f[k]).trim();
      const rec = { id:id || uid(), nr:Math.round(Number(f.nr)) > 0 ? Math.round(Number(f.nr)) : this.brandNaesteNr(), lokaleId:this.db.lokaler.some(l => l.id === f.lokaleId) ? f.lokaleId : '',
        placering:t('placering'), beskrivelse:t('beskrivelse'), brandklasse:t('brandklasse'), brandklasser:BRANDKLASSER.filter(k => (f.brandklasser || []).includes(k)), produkt:t('produkt'), produkter:BRANDPRODUKTER.filter(p => (f.produkter || []).includes(p)), udfoert:!!f.udfoert, maerkat:!!f.maerkat, note:t('note'),
        billeder:[...new Set((f.billeder || []).filter(x => BID.test(x)))] };
      const dub = this.db.brandlukninger.some(b => b.nr === rec.nr && b.id !== rec.id);
      this.mutate(() => { const L = this.db.brandlukninger, i = id ? L.findIndex(b => b.id === id) : -1; if (i > -1) L.splice(i, 1, rec); else L.push(rec); });
      this.modal = null;
      this.say('Brandlukning ' + rec.nr + (id ? ' er gemt.' : ' er oprettet.') + (dub ? ' Bemærk: nummeret bruges også af en anden lukning.' : ''), true);
    },
    /* afsnit til dokumentationen og udskriften: status og små billeder */
    brandDocHtml() {
      const L = this.db.brandlukninger.slice().sort((a, b) => a.nr - b.nr); if (!L.length) return '';
      const td = v => '<td>' + esc(v) + '</td>', ok = v => '<td class="bl-st">' + (v ? '✓ Ja' : '<b>Nej</b>') + '</td>';
      let h = '<section style="break-before:page"><h1>Brandlukninger</h1><p class="m">' + esc('Udført ' + L.filter(b => b.udfoert).length + ' af ' + L.length + ' · brandmærkat ' + L.filter(b => b.maerkat).length + ' af ' + L.length) + '</p>' +
        '<table><tr><th>Nr.</th><th>Lokale</th><th>Placering</th><th>Beskrivelse</th><th>Brandklasse</th><th>Produkt</th><th>Udført</th><th>Mærkat</th><th>Note</th><th>Billeder</th></tr>';
      for (const b of L) {
        const bil = b.billeder.map(id => /^data:image\//.test(BMINI[id] || '') ? '<img class="bl" src="' + esc(BMINI[id]) + '" alt="Billede">' : '<span class="m">billede mangler på denne enhed</span>').join(' ');
        h += '<tr>' + [b.nr, b.lokaleId ? this.lokaleNavn(b.lokaleId) : '', b.placering, b.beskrivelse, this.brandKlasseTxt(b), this.brandProduktTxt(b)].map(td).join('') + ok(b.udfoert) + ok(b.maerkat) + td(b.note) + '<td>' + (bil || '–') + '</td></tr>';
      }
      return h + '</table></section>';
    }
});
