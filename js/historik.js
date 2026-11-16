/* Historik: tidligere versioner af det aktive projekt fra Gist'ens versionshistorik. GitHub gemmer hver ændring af Gist'en.
   En version gendannes altid som en ny kopi; intet overskrives. Plan: docs/planer/2026-11-16-gist-historik.md */
const HIST_TRIN = 15;  /* versioner, der hentes ad gangen (ét kald pr. version) */
const APP_HISTORIK = () => ({
  async historikAabn() {
    this.historik = { liste:[], commits:null, i:0, henter:false, fejl:'', pid:this.pid };
    this.modal = { type:'historik' };
    await this.historikHent();
  },
  historikFlere() { const h = this.historik; return !!h.commits && h.i < h.commits.length; },
  async historikHent() {
    const h = this.historik;
    if (!this.synk || !this.synk.gistId || h.henter) return;
    if (navigator.onLine === false) { h.fejl = 'Historikken kræver net.'; return; }
    h.henter = true; h.fejl = '';
    try {
      if (!h.commits) h.commits = await this.gh('/gists/' + this.synk.gistId + '/commits?per_page=100');
      const fil = GP(h.pid);
      for (let n = 0; n < HIST_TRIN && h.i < h.commits.length; n++) {
        const c = h.commits[h.i++], g = await this.gh('/gists/' + this.synk.gistId + '/' + c.version), f = g.files && g.files[fil];
        if (!f) continue;  /* projektet fandtes ikke i denne version */
        let txt = f.content;
        if (f.truncated || txt == null) { const r = await fetch(f.raw_url, { cache:'no-store' }); if (!r.ok) continue; txt = await r.text(); }
        let d = null; try { d = JSON.parse(txt); } catch (e) {}
        if (!d || !Array.isArray(d.tavler)) continue;
        let schema = 0; try { schema = Number(JSON.parse(g.files[GFIL].content).schema) || 0; } catch (e) {}
        const hh = schema > SCHEMA ? 'nyere:' + hashTxt(txt) : hashD(d), sidst = h.liste[h.liste.length - 1];
        /* Listen går fra nyeste mod ældste. Samme indhold i flere versioner i træk vises én gang med datoen, hvor det blev gemt første gang. */
        if (sidst && sidst.h === hh) { sidst.tid = c.committed_at; continue; }
        const p = d.projekt || {};
        h.liste.push({ sha:c.version, tid:c.committed_at, h:hh, schema, d, navn:p.navn || 'Uden navn', kunde:p.kunde || '',
          grupper:(d.grupper || []).length, enheder:(d.enheder || []).length });
      }
    } catch (e) { h.fejl = e.message || 'Historikken kunne ikke hentes.'; }
    finally { h.henter = false; }
  },
  historikNu(v) { const d = this.laes(this.historik.pid); return !!d && v.h === hashD(d); },
  historikGendan(i) {
    const v = this.historik.liste[i]; if (!v) return;
    if (v.schema > SCHEMA) { this.say('Versionen er gemt af en nyere version af appen. Genindlæs siden med Ctrl+F5, og prøv igen.', false, true); return; }
    const d = norm(JSON.parse(JSON.stringify(v.d))), id = uid();
    d.projekt.navn = (d.projekt.navn || 'Projekt') + ' (fra ' + this.datoTxt(v.tid) + ')';
    this.skriv(id, d); this.projekter.push(this.meta(id, d)); this.skrivIdx();
    this.modal = null; this.say('Gendannet som nyt projekt: ' + d.projekt.navn + '. Det aktive projekt er urørt.');
  }
});
