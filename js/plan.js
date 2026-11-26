/* Plantegning (skema 21): plantegninger og eltegninger som billeder med placerede komponenter, målestok og måling af kabellængde.
   En PDF laves om til ét billede pr. side ved upload (pdf.js fra cdnjs, hentes først, når en PDF vælges). Billederne gemmes som de andre billeder (js/billeder.js).
   Metoderne samles i app() i js/app.js. Plan: docs/planer/2026-11-26-plantegning.md */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PLAN_PX = 3000, PLAN_MAKS = 1.5 * 1048576;  /* længste side og mål for størrelsen af én tegning */
const TEGN = {}, TEGN_HENTER = new Set();         /* fulde tegninger i hukommelsen (data-URL), hentes fra IndexedDB ved brug */
let PDF_P = null;
const planPdfLib = () => PDF_P || (PDF_P = new Promise((ok, fejl) => {
  if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
  const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
  s.onload = () => { if (!window.pdfjsLib) { PDF_P = null; fejl(new Error('PDF-læseren kunne ikke indlæses.')); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
  s.onerror = () => { PDF_P = null; fejl(new Error('PDF-læseren kunne ikke hentes. Der skal være net, når en PDF indlæses.')); };
  document.head.appendChild(s);
}));

const APP_PLAN = () => ({
    planListe() { return this.db.tegninger.filter(t => !this.lokF || t.lokaleId === this.lokF); },
    planAkt() { const L = this.planListe(); return L.find(t => t.id === this.planId) || L[0] || null; },
    /* etageforslag: dem, lokalerne og tegningerne allerede bruger */
    planEtager() { return [...new Set([...this.db.lokaler, ...this.db.tegninger].map(x => String(x.etage || '').trim()).filter(Boolean))]; },
    planTitel(t) { return (t.navn || 'Tegning') + (t.etage ? ' · ' + t.etage : ''); },
    planVaelgT(id) { this.planId = id; this.planNulstil(); },
    planNulstil() { this.planMode = ''; this.planPts = []; this.planVaelg = ''; this.planSoeg = ''; },
    planTilstand(m) { const ny = this.planMode === m ? '' : m; this.planNulstil(); this.planMode = ny; },
    /* den fulde tegning hentes fra IndexedDB første gang, den bruges; indtil da vises miniaturen */
    planSrc(t) {
      this.planTick; this.billedTick; if (!t || !t.billede) return '';
      if (!TEGN[t.billede] && BFULD.has(t.billede)) this.planHentEn(t.billede);
      return TEGN[t.billede] || BMINI[t.billede] || '';
    },
    async planHentEn(id) {
      if (TEGN[id] || TEGN_HENTER.has(id)) return; TEGN_HENTER.add(id);
      try { const d = await this.billedData(id); if (d) { TEGN[id] = d; this.planTick++; } } catch (e) {} finally { TEGN_HENTER.delete(id); }
    },
    planHentAlle() { return Promise.all(this.db.tegninger.filter(t => t.billede && BFULD.has(t.billede)).map(t => this.planHentEn(t.billede))); },
    /* upload: billeder og PDF (én tegning pr. side) */
    async planFraFil(ev) {
      const filer = [...((ev.target && ev.target.files) || [])]; if (ev.target) ev.target.value = ''; if (!filer.length) return;
      const nye = [], etage = this.planEtage.trim(); this.billedArbejder++;
      try {
        for (const fil of filer) {
          const navn = String(fil.name || 'Tegning').replace(/\.[a-z0-9]+$/i, '') || 'Tegning';
          try {
            if (fil.type === 'application/pdf' || /\.pdf$/i.test(fil.name || '')) {
              const lib = await planPdfLib(), pdf = await lib.getDocument({ data:await fil.arrayBuffer() }).promise;
              for (let n = 1; n <= pdf.numPages; n++) {
                const side = await pdf.getPage(n), v0 = side.getViewport({ scale:1 }), v = side.getViewport({ scale:PLAN_PX / Math.max(v0.width, v0.height) });
                const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
                const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
                await side.render({ canvasContext:x, viewport:v }).promise;
                nye.push(await this.planGemBillede(c, pdf.numPages > 1 ? navn + ' · side ' + n : navn, etage));
              }
            } else if (/^image\//.test(fil.type || '')) {
              const url = URL.createObjectURL(fil);
              try { nye.push(await this.planGemBillede(await this.billedBillede(url), navn, etage)); } finally { URL.revokeObjectURL(url); }
            } else this.say(fil.name + ' er hverken et billede eller en PDF.');
          } catch (e) { this.say((fil.name || 'Filen') + ' kunne ikke indlæses: ' + (e.message || 'ukendt fejl') + '.', false, true); }
        }
      } finally { this.billedArbejder--; }
      if (nye.length) { this.mutate(() => { this.db.tegninger.push(...nye); }); this.planVaelgT(nye[0].id); this.say(nye.length + (nye.length > 1 ? ' tegninger er tilføjet.' : ' tegning er tilføjet.'), true); }
      this.billedLager();
    },
    async planGemBillede(im, navn, etage) {
      let r = null; for (const [maks, q] of [[PLAN_PX, 0.8], [PLAN_PX, 0.65], [2400, 0.65]]) { r = this.billedTegn(im, maks, q); if (bStr(r.data) <= PLAN_MAKS) break; }
      const bid = uid(); await this.billedGem(bid, r.data, this.billedTegn(im, 320, 0.6).data); TEGN[bid] = r.data;
      return { id:uid(), navn, lokaleId:this.lokF || '', etage, billede:bid, forhold:r.h / r.w, skala:0, punkter:[] };
    },
    planSaet(t, felt, v) { if (!t || t[felt] === v) return; this.mutate(() => { t[felt] = v; }); },
    /* billedet bliver liggende på enheden og i billed-Gist'en, til der ryddes op under Datasikring */
    planSlet(t) { this.mutate(() => { this.db.tegninger = this.db.tegninger.filter(x => x.id !== t.id); }); this.planId = ''; this.planNulstil(); this.say('Tegningen ' + (t.navn || '') + ' er slettet.', true); },
    /* komponent bag en prik: navn, formular og status. null, hvis komponenten er slettet */
    planKomp(k) {
      const [a, id] = String(k).split(':'), d = this.db;
      if (a === 't') { const o = this.tavle(id); return o && { navn:o.navn, type:'tavle', obj:o, art:'Tavle', ok:!(Number(o.tLaengde) > 0) || o.tTrukket }; }
      if (a === 'd') { const o = this.daase(id); return o && { navn:this.daaseTxt(id), type:'daase', obj:o, art:'Samlepunkt', ok:o.trukket }; }
      if (a === 'e') { const o = this.enhed(id); return o && { navn:o.navn, type:'enhed', obj:o, art:'Brugsgenstand', ok:o.trukket }; }
      if (a === 'x') { const o = d.links.find(l => l.id === id); return o && { navn:o.navn, type:'link', obj:o, art:o.art === 'cctv' ? 'Kamera' : 'Dataudtag', ok:o.trukket }; }
      if (a === 'b') { const o = d.brandlukninger.find(b => b.id === id); return o && { navn:'Brandlukning ' + o.nr + (o.placering ? ' · ' + o.placering : ''), type:'brand', obj:o, art:'Brandlukning', ok:o.udfoert && o.maerkat }; }
      return null;
    },
    planPunkter(t) { return (t ? t.punkter : []).map(p => ({ p, c:this.planKomp(p.k) })).filter(x => x.c).map((x, i) => Object.assign(x, { nr:i + 1 })); },
    /* komponenter, der kan placeres. Er tegningen knyttet til et lokale, vises kun lokalets (tavler altid) */
    planValg(t) {
      const lok = t && t.lokaleId, i = x => !lok || x.lokaleId === lok, brugt = new Set((t ? t.punkter : []).map(p => p.k)), d = this.db;
      const g = (navn, L) => ({ navn, L:L.map(o => Object.assign(o, { txt:o.txt + (brugt.has(o.k) ? ' (placeret)' : '') })) });
      return [g('Tavler', d.tavler.map(o => ({ k:'t:' + o.id, txt:o.navn }))), g('Samlepunkter', d.daaser.filter(i).map(o => ({ k:'d:' + o.id, txt:this.daaseTxt(o.id) }))),
        g('Brugsgenstande', d.enheder.filter(i).map(o => ({ k:'e:' + o.id, txt:o.navn }))), g('Dataudtag og kameraer', d.links.filter(i).map(o => ({ k:'x:' + o.id, txt:o.navn }))),
        g('Brandlukninger', d.brandlukninger.filter(i).map(o => ({ k:'b:' + o.id, txt:'Nr. ' + o.nr + (o.placering ? ' ' + o.placering : '') })))].filter(x => x.L.length);
    },
    /* listen ved placering: samme komponenter som planValg, grupperet efter etage og lokale (tavler først, uden lokale sidst). Placerede er skjult, indtil planVisPlac slås til */
    planPlacer(t) {
      const brugt = new Set((t ? t.punkter : []).map(p => p.k)), ord = this.planSoeg.toLowerCase().split(/\s+/).filter(Boolean), G = new Map();
      const et = r => String(r.etage || '').trim(), etager = [...new Set(this.db.lokaler.map(et))].sort((a, b) => !a - !b), rum = [...this.db.lokaler].sort((a, b) => etager.indexOf(et(a)) - etager.indexOf(et(b)));
      for (const o of this.planValg(t).flatMap(g => g.L)) {
        if (brugt.has(o.k) && !this.planVisPlac) continue;
        const c = this.planKomp(o.k), i = c.type === 'tavle' ? -1 : rum.findIndex(r => r.id === c.obj.lokaleId), r = rum[i];
        const navn = c.type === 'tavle' ? 'Tavler' : r ? (et(r) || 'Uden etage') + ' · ' + r.navn : 'Uden lokale', s = (o.txt + ' ' + c.art + ' ' + navn).toLowerCase();
        if (!ord.every(w => s.includes(w))) continue;
        const n = c.type === 'tavle' || r ? i : rum.length;
        if (!G.has(n)) G.set(n, { n, navn, L:[] }); G.get(n).L.push({ k:o.k, txt:o.txt, art:c.art });
      }
      return [...G.values()].sort((a, b) => a.n - b.n);
    },
    planMaalValg(t) { return this.planValg(t).filter(g => /^[dex]:/.test(g.L[0].k)); },
    planFjern(t, k) { this.mutate(() => { t.punkter = t.punkter.filter(p => p.k !== k); }); },
    /* klik på tegningen: åbn en komponent, placér, sæt målestok eller tegn kabelvej. Koordinater som brøkdel af bredden */
    planKlik(ev, t) {
      const svg = ev.currentTarget && ev.currentTarget.querySelector('svg'); if (!t || !svg) return;
      const s = svg.getBoundingClientRect(), x = Math.min(1, Math.max(0, (ev.clientX - s.left) / s.width)), y = Math.min(t.forhold, Math.max(0, (ev.clientY - s.top) / s.width));
      const hit = ev.target && ev.target.closest ? ev.target.closest('[data-k]') : null, m = this.planMode;
      if (!m) { const c = hit && this.planKomp(hit.getAttribute('data-k')); if (c) this.openForm(c.type, c.obj); return; }
      if (m === 'placer') {
        if (!this.planVaelg) { if (hit) this.planVaelg = hit.getAttribute('data-k'); else this.say('Vælg først en komponent i listen, eller klik på en prik for at flytte den.'); return; }
        const k = this.planVaelg; this.mutate(() => { t.punkter = t.punkter.filter(p => p.k !== k).concat([{ k, x, y }]); }); this.planVaelg = ''; return;
      }
      this.planPts = (m === 'skala' ? this.planPts.slice(-1) : this.planPts).concat([{ x, y }]);
    },
    planAfst(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; },
    planM(t) { return t && t.skala ? this.planAfst(this.planPts) * t.skala : 0; },
    planSkalaGem(t) {
      const m = tal(this.planSkalaM), a = this.planAfst(this.planPts);
      if (!(m > 0) || this.planPts.length !== 2 || !(a > 0)) { this.say('Klik på to punkter med en kendt afstand, og skriv afstanden i meter.'); return; }
      this.planSaet(t, 'skala', m / a); this.planNulstil(); this.say('Målestokken er gemt. Tegningen er ' + this.fmt(m / a, 1) + ' m bred.', true);
    },
    /* længden rundes op til nærmeste 0,5 m, som længdefelterne */
    planBrugLaengde(t) {
      const [a, id] = String(this.planMaalTil).split(':'), o = a === 'e' ? this.enhed(id) : a === 'd' ? this.daase(id) : a === 'x' ? this.db.links.find(l => l.id === id) : null, m = Math.ceil(Math.round(this.planM(t) * 100) / 50) / 2;  /* først til hele cm, så kommatal-støj ikke runder 6,0000001 op til 6,5 */
      if (!o || !(m > 0)) { this.say('Tegn kabelvejen, og vælg hvor længden skal bruges.'); return; }
      this.mutate(() => { o.laengde = m; }); this.planPts = []; this.say((o.navn || 'Kablet') + ': længden er sat til ' + this.fmt(m) + ' m.', true);
    },
    planSvg(t, print) {
      if (!t) return ''; const H = 1000 * t.forhold, src = print ? (TEGN[t.billede] || BMINI[t.billede] || '') : this.planSrc(t), o = [];
      if (/^data:image\//.test(src)) o.push(`<image href="${esc(src)}" x="0" y="0" width="1000" height="${H}" preserveAspectRatio="none"/>`);
      else o.push(`<rect width="1000" height="${H}" fill="#eee"/><text x="500" y="${H / 2}" text-anchor="middle" font-size="26" fill="#555">Tegningen findes ikke på denne enhed endnu</text>`);
      for (const { p, c, nr } of this.planPunkter(t)) o.push(`<g class="pp ${c.ok ? 'ok' : 'ikke'}${!print && this.planVaelg === p.k ? ' valgt' : ''}" data-k="${esc(p.k)}"><title>${esc(nr + '. ' + c.art + ': ' + c.navn + (c.ok ? '' : ' · mangler'))}</title>` +
        `<circle cx="${p.x * 1000}" cy="${p.y * 1000}" r="18"/><text x="${p.x * 1000}" y="${p.y * 1000 + 7}" text-anchor="middle">${nr}</text></g>`);
      if (!print && this.planPts.length) o.push(`<polyline class="pm" points="${this.planPts.map(q => q.x * 1000 + ',' + q.y * 1000).join(' ')}"/>` + this.planPts.map(q => `<circle class="pmp" cx="${q.x * 1000}" cy="${q.y * 1000}" r="5"/>`).join(''));
      const css = print ? '<style>.pp circle{stroke:#fff;stroke-width:3}.pp.ok circle{fill:#0f7d58}.pp.ikke circle{fill:#d4500a}.pp text{fill:#fff;font:bold 20px Arial,sans-serif}</style>' : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${H}" class="plan-svg"${print ? ' width="100%"' : ''}>${css}${o.join('')}</svg>`;
    },
    /* afsnit til dokumentationen: hver tegning med prikker og en liste. Mangler den fulde tegning, bruges miniaturen */
    planDocHtml() {
      const L = this.db.tegninger; if (!L.length) return '';
      let h = '<section style="break-before:page"><h1>Plantegninger</h1>';
      for (const t of L) {
        const pp = this.planPunkter(t);
        h += '<div class="bd"><h2>' + esc(this.planTitel(t) + (t.lokaleId ? ' · ' + this.lokaleNavn(t.lokaleId) : '')) + '</h2>' + this.planSvg(t, true);
        if (pp.length) h += '<table><tr><th>Nr.</th><th>Komponent</th><th>Art</th><th>Status</th></tr>' + pp.map(x => '<tr><td>' + x.nr + '</td><td>' + esc(x.c.navn) + '</td><td>' + esc(x.c.art) + '</td><td>' + (x.c.ok ? '✓ Færdig' : '<b>Mangler</b>') + '</td></tr>').join('') + '</table>';
        h += '</div>';
      }
      return h + '</section>';
    }
});
