/* Diagrammer: enstregsdiagram, sporing gennem installationen, afbrydere og tændingsdiagram. Metoderne samles i app() i js/app.js, så this er hele app-tilstanden. */
const SLDP = new Map();
const APP_DIAGRAM = () => ({
    /* enstregsdiagram: SVG bygges ud fra projektets data */
    symbolFor(e) {
      if (e.symbol && e.symbol !== 'auto' && this.symNavn[e.symbol]) return e.symbol;
      const n = String(e.navn || '').toLowerCase(), t = this.typeOf(e);
      if (/^\s*tilgang/.test(n)) return 'tilgang';
      if (/stik/.test(n)) return 'stik';
      if (/lade/.test(n)) return 'ev';
      if (/frys/.test(n)) return 'frys';
      if (/køl/.test(n)) return 'koel';
      if (/mikro/.test(n)) return 'mikro';
      if (/kogeplade|kogesektion|induktion|komfur/.test(n)) return 'koge';
      if (/ovn/.test(n)) return 'ovn';
      if (/opvask/.test(n)) return 'opvask';
      if (/vaskemaskine/.test(n)) return 'vask';
      if (/tumbler|tørre/.test(n)) return 'toerre';
      if (/emhætte/.test(n)) return 'emhaette';
      if (/vandvarmer|vvb/.test(n)) return 'vvb';
      if (/varmepumpe/.test(n)) return 'vp';
      if (/maskine|pumpe|motor|ventilat|kompressor/.test(n)) return 'motor';
      if (/varme|radiator/.test(n)) return 'varme';
      if (t === 'lys' || /lys|lampe|spot|led|armatur/.test(n)) return 'lys';
      return t === 'data' ? 'it' : 'gen';
    },
    sym(kind, x, y) {
      const ln = (x1, y1, x2, y2) => `<line class="l" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      const tx = (px, t) => `<text class="t s" x="${px}" y="${y + 3.5}" text-anchor="middle">${t}</text>`;
      const cx = x + 4, R = `<rect class="l f" x="${x - 9}" y="${y - 9}" width="26" height="18"/>`;
      const stj = (px, r) => [0, 60, 120].map(a => { const dx = +(Math.cos(a * Math.PI / 180) * r).toFixed(1), dy = +(Math.sin(a * Math.PI / 180) * r).toFixed(1); return ln(px - dx, y - dy, px + dx, y + dy); }).join('');
      const ring = (px, py, r, c) => `<circle class="${c || 'l'}" cx="${px}" cy="${py}" r="${r}"/>`;
      switch (kind) {
        case 'lys': return ring(x, y, 9, 'l f') + ln(x - 6.4, y - 6.4, x + 6.4, y + 6.4) + ln(x - 6.4, y + 6.4, x + 6.4, y - 6.4);
        case 'motor': return ring(x, y, 9, 'l f') + tx(x, 'M');
        case 'stik': return ln(x - 9, y, x - 2, y) + `<path class="l f" d="M ${x - 2} ${y - 9} A 9 9 0 0 1 ${x - 2} ${y + 9} Z"/>`;
        case 'varme': return `<rect class="l f" x="${x - 9}" y="${y - 7}" width="26" height="14"/>` + [-3, 4, 11].map(d => ln(x + d, y - 7, x + d, y + 7)).join('');
        case 'kam': return `<rect class="l f" x="${x - 9}" y="${y - 6}" width="16" height="12"/><path class="l f" d="M ${x + 7} ${y - 2} L ${x + 17} ${y - 6} L ${x + 17} ${y + 6} L ${x + 7} ${y + 2}"/>`;
        case 'koel': return R + stj(cx, 6);
        case 'frys': return R + stj(cx - 8, 3) + stj(cx, 3) + stj(cx + 8, 3);
        case 'ovn': return R + `<rect class="l" x="${cx - 8}" y="${y - 3}" width="16" height="9"/>` + ln(cx - 8, y - 6, cx + 8, y - 6);
        case 'koge': return R + [[-6, -4], [6, -4], [-6, 4], [6, 4]].map(p => ring(cx + p[0], y + p[1], 2.6)).join('');
        case 'mikro': return R + `<path class="l" d="M ${cx - 9} ${y} q 3 -7 6 0 t 6 0 t 6 0"/>`;
        case 'opvask': return R + ln(x - 9, y + 9, x + 17, y - 9) + ring(cx - 7, y - 4, 2) + ring(cx + 7, y + 4, 2);
        case 'vask': return R + ring(cx, y, 6);
        case 'toerre': return R + ring(cx, y, 6) + ring(cx, y, 1.8, 'dot');
        case 'tilgang': return `<path class="l f" d="M ${x - 10} ${y} L ${x} ${y - 10} L ${x + 10} ${y} L ${x} ${y + 10} Z"/>` + ring(x, y, 3.6, 'dot');
        case 'emhaette': return `<path class="l f" d="M ${x - 9} ${y + 8} L ${x + 17} ${y + 8} L ${x + 10} ${y - 8} L ${x - 2} ${y - 8} Z"/>` + ln(x - 5, y + 3, x + 13, y + 3);
        default: return `<rect class="l f" x="${x - 9}" y="${y - 8}" width="26" height="16"/>` + tx(cx, ({ ev:'EV', it:'IT', rk:'RK', rj:'RJ', sw:'SW', nvr:'NVR', rt:'RT', vvb:'VVB', vp:'VP', ut:'UT' })[kind] || '');
      }
    },
    symIkon(kind) { return '<svg viewBox="-12 -12 32 24" width="32" height="24" aria-hidden="true">' + this.sym(kind, 0, 0) + '</svg>'; },

    /* sporing: hele kæden fra forsyning til komponent */
    spor(sel) {
      const [a, id] = String(sel || '').split(':'), d = this.db; let o;
      const opTavle = (tid, n) => {
        const t = this.tavle(tid); n = n || 0; if (!t || n > 8) return [];
        const fg = this.gruppe(t.fraGruppe), op = fg ? opGruppe(fg.id, n + 1) : (t.fra && t.fra !== t.id ? opTavle(t.fra, n + 1) : []);
        return op.concat([{ key:'t:' + t.id, txt:t.navn }]);
      };
      const opGruppe = (gid, n) => { const g = this.gruppe(gid); if (!g) return []; const r = this.rcd(g); return opTavle(g.tavleId, n).concat(r ? [{ key:'r:' + r.id, txt:r.navn }] : [], [{ key:'g:' + g.id, txt:'G' + g.nr + ' ' + g.navn }]); };
      const opDaase = did => { const ks = []; let x = this.daase(did), n = 0; while (x && n++ < 20) { ks.unshift({ key:'d:' + x.id, txt:x.type + ' ' + x.navn }); x = this.daase(x.parentId); } return ks; };
      const opRack = rid => { const r = this.rack(rid); return r ? opGruppe(r.gruppeId).concat([{ key:'k:' + r.id, txt:'Rack ' + r.navn }]) : []; };
      if (a === 'e' && (o = d.enheder.find(e => e.id === id))) { const af = this.afbFor(id); return opGruppe(o.gruppeId).concat(opDaase(this.enhedDaase(o)), this.sloejfeVej(o).reverse().map(p => ({ key:'e:' + p.id, txt:p.navn })), af ? [{ key:'a:' + af.id, txt:af.navn }] : [], [{ key:sel, txt:o.navn }]); }
      if (a === 'a' && (o = d.afbrydere.find(x => x.id === id))) return opGruppe(o.gruppeId).concat([{ key:sel, txt:o.navn }]);
      if (a === 'd' && (o = this.daase(id))) return opGruppe(o.gruppeId).concat(opDaase(id));
      if (a === 'g') return opGruppe(id);
      if (a === 'r' && (o = d.rcds.find(r => r.id === id))) return opTavle(o.tavleId).concat([{ key:sel, txt:o.navn }]);
      if (a === 't') return opTavle(id);
      if (a === 'k') return opRack(id);
      if (a === 'u' && (o = this.udst(id))) return opRack(o.rackId).concat([{ key:sel, txt:o.navn }]);
      if (a === 'x' && (o = d.links.find(l => l.id === id))) {
        const sw = this.udst(o.switchId), pp = this.udst(o.panelId);
        return opRack((sw || pp || {}).rackId).concat(sw ? [{ key:'u:' + sw.id, txt:sw.navn + ':' + o.switchPort }] : [], pp ? [{ key:'', txt:pp.navn + ':' + o.panelPort }] : [], [{ key:sel, txt:o.navn }]);
      }
      return [];
    },
    sporTil(key) {
      this.sldSel = key; this.go('enstreg');
      setTimeout(() => {
        const box = this.$refs.sldBox, el = box && box.querySelector('[data-k="' + key + '"]'); if (!el || !el.getBBox) return;
        const bb = el.getBBox(); this.z = { x:this.z.x, y:box.clientHeight / 2 - (bb.y + bb.height / 2) * this.z.k, k:this.z.k };
      }, 90);
    },

    /* afbrydere og tændingsdiagram */
    afbSteder(af) { return af.art === 'kryds' ? Math.min(6, Math.max(3, Math.round(af.steder) || 3)) : af.art === 'korr' ? 2 : Math.min(6, Math.max(1, af.steder || 1)); },
    /* Udgangsstilling: lyset slukket. Kryds: s[0] og s[n-1] er korrespondanceafbryderne i enderne, s[1..n-2] er krydsafbryderne (true = krydset). */
    simStd(af) {
      if (af.art === 'kryds') { const n = this.afbSteder(af); return { s:Array.from({ length:n }, (_, i) => i === n - 1), on:false, p:-1 }; }
      return { s:[false, af.art === 'korr'], on:false, p:-1 };
    },
    simFor(af) { return this.sim[af.id] || this.simStd(af); },
    /* Kryds: hvilken korrespondanceleder (true = øverste) der er spændingsførende efter hvert led. Sidste værdi er lederen frem til K2. */
    krydsLeder(af, s) { const n = this.afbSteder(af), ud = [!!s.s[0]]; for (let i = 1; i < n - 1; i++) ud.push(ud[i - 1] !== !!s.s[i]); return ud; },
    lit(af, st) {
      const s = st || this.simFor(af);
      if (af.art === 'krone') return { a:s.s[0], b:s.s[1] };
      if (af.art === 'korr') return { a:s.s[0] === s.s[1], b:false };
      if (af.art === 'kryds') { const n = this.afbSteder(af); return { a:this.krydsLeder(af, s)[n - 2] === !!s.s[n - 1], b:false }; }
      if (af.art === 'kip' || af.art === 'trappe' || af.art === 'sensor') return { a:s.on, b:false };
      return { a:s.s[0], b:false };
    },
    taendKlik(ev) {
      const el = ev.target.closest && ev.target.closest('[data-t]'); if (!el) return;
      const [id, key] = el.getAttribute('data-t').split(':'), af = this.db.afbrydere.find(a => a.id === id); if (!af) return;
      const cur = this.simFor(af), st = { s:cur.s.slice(), on:cur.on, p:-1 };
      if (key[0] === 'p') {
        st.p = Number(key.slice(1));
        if (af.art === 'kip') st.on = !st.on;
        else { st.on = true; clearTimeout(TIMERS[id]); TIMERS[id] = setTimeout(() => { this.sim[id] = Object.assign({}, this.simFor(af), { on:false }); }, 5000); }
        setTimeout(() => { this.sim[id] = Object.assign({}, this.simFor(af), { p:-1 }); }, 350);
      } else st.s[Number(key)] = !st.s[Number(key)];
      this.sim[id] = st;
    },
    /* Afbryderen, der styrer en brugsgenstand (den første, hvis flere har valgt den). */
    afbFor(eid) { return this.db.afbrydere.find(a => a.a.includes(eid) || (a.art === 'krone' && a.b.includes(eid))) || null; },
    afbLamper(af, felt) {
      const off = felt === 'b' ? af.a.length : 0;
      return af[felt].map((id, i) => { const e = this.db.enheder.find(x => x.id === id); return e ? (off + i + 1) + ' ' + e.navn : ''; }).filter(Boolean).join(' · ');
    },
    /* Installationssymboler efter DS/EN 60617-11 i et 20 × 20-felt. Bruges både som ikon og i enstregsdiagrammet. */
    afbSti(art) {
      return { enpolet:'<circle cx="5" cy="15" r="2.6"/><path d="M7 13 15 4l3 2.6"/>', krone:'<circle cx="5" cy="15" r="2.6"/><path d="M7 13 15 4l3 2.6M12 7.4l3 2.6"/>',
        korr:'<circle cx="10" cy="10" r="2.6"/><path d="M12 8 17 3l2.4 2.4M8 12l-5 5-2.4-2.4"/>',
        kryds:'<circle cx="10" cy="10" r="2.6"/><path d="M12 8 17 3l2.4 2.4M8 12l-5 5-2.4-2.4M8 8 3 3l2.4-2.4M12 12l5 5-2.4 2.4"/>', kip:'<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="1.6"/>',
        trappe:'<circle cx="10" cy="10" r="6.5"/><path d="M10 6v4l3 2"/>', sensor:'<path d="M3 10 14 4.5M3 10l11 5.5M3 10h12"/><path d="M14.5 4q4.5 6 0 12"/>' }[art] || '';
    },
    afbIkon(art) {
      const p = this.afbSti(art);
      return '<svg class="ik" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    },
    /* print = statisk udgave til dokumentationen: udgangsstilling (lyset slukket), egne farver og ingen klikfelter. */
    taendSvg(af, print) {
      const s = print ? this.simStd(af) : this.simFor(af), lit = this.lit(af, s), g = this.gruppe(af.gruppeId), o = [], yL = 40, NY = 176, H = 200;
      const find = ids => ids.map(id => this.db.enheder.find(e => e.id === id)).filter(Boolean);
      const A = find(af.a), B = af.art === 'krone' ? find(af.b) : [];
      const ln = (x1, y1, x2, y2, c) => `<line class="w ${c || ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      const tx = (x, y, t, c, a) => `<text class="${c || 'm'}" x="${x}" y="${y}"${a ? ' text-anchor="' + a + '"' : ''}>${esc(t)}</text>`;
      const dot = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="2.4"/>`;
      const kn = (key, inner, x, y, w, h) => print ? inner : `<g class="tk" data-t="${af.id}:${key}"><rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${inner}</g>`;
      const swH = (x, y, on) => dot(x - 12, y) + dot(x + 12, y) + ln(x - 12, y, on ? x + 12 : x + 9, on ? y : y - 11, 'bl');
      let nr = 0, xMax = 0;
      const lampe = (x, yT, on) => { nr++; xMax = Math.max(xMax, x);
        return dot(x, yT) + ln(x, yT, x, 104, on ? 'lv' : '') + `<circle class="lamp${on ? ' on' : ''}" cx="${x}" cy="116" r="12"/>` + ln(x - 8.5, 107.5, x + 8.5, 124.5, 'x') + ln(x - 8.5, 124.5, x + 8.5, 107.5, 'x') +
          ln(x, 128, x, NY, 'n') + dot(x, NY) + tx(x + 16, 120, nr, 't'); };
      const raekke = (liste, x0, yT, on, xFra) => {
        if (!liste.length) { o.push(ln(xFra, yT, x0 - 20, yT, on ? 'lv' : '') + tx(x0 - 12, yT + 4, 'ingen lamper valgt')); xMax = Math.max(xMax, x0 + 90); return x0 + 110; }
        o.push(ln(xFra, yT, x0 + (liste.length - 1) * 56, yT, on ? 'lv' : ''));
        liste.forEach((e, i) => o.push(lampe(x0 + i * 56, yT, on)));
        return x0 + liste.length * 56;
      };
      o.push(tx(14, 18, 'L · ' + (g ? 'G' + g.nr + ' ' + g.kar + g.In + ' ' + (g.faser == 3 ? 'L1' : g.fase) : 'ingen gruppe valgt')));
      if (af.art === 'enpolet') {
        o.push(ln(14, yL, 98, yL, 'lv') + kn(0, swH(110, yL, s.s[0]), 90, yL - 20, 40, 30) + tx(110, yL + 24, 'S1', 'm', 'middle') + tx(134, yL - 8, 'tændt leder'));
        raekke(A, 220, yL, lit.a, 122);
      } else if (af.art === 'krone') {
        const y2 = yL + 38;
        o.push(ln(14, yL, 98, yL, 'lv') + dot(66, yL) + ln(66, yL, 66, y2, 'lv') + ln(66, y2, 98, y2, 'lv') +
          kn(0, swH(110, yL, s.s[0]), 90, yL - 20, 40, 30) + kn(1, swH(110, y2, s.s[1]), 90, y2 - 20, 40, 30) + tx(134, yL - 8, 'tænding 1') + tx(134, y2 - 8, 'tænding 2'));
        nr = A.length; const x1 = raekke(B, 220, y2, lit.b, 122); nr = 0;
        raekke(A, x1 + 20, yL, lit.a, 122);
      } else if (af.art === 'korr') {
        const up = yL - 11, ned = yL + 11, p0 = s.s[0], p1 = s.s[1];
        o.push(ln(14, yL, 58, yL, 'lv') + kn(0, dot(58, yL) + dot(88, up) + dot(88, ned) + ln(58, yL, 88, p0 ? up : ned, 'bl'), 48, yL - 22, 50, 44) +
          ln(88, up, 212, up, p0 ? 'lv' : '') + ln(88, ned, 212, ned, p0 ? '' : 'lv') + tx(150, ned + 15, 'korrespondanceledere', 'm', 'middle') +
          kn(1, dot(212, up) + dot(212, ned) + dot(242, yL) + ln(242, yL, 212, p1 ? up : ned, 'bl'), 202, yL - 22, 50, 44) + tx(73, yL + 36, 'K1', 'm', 'middle') + tx(227, yL + 36, 'K2', 'm', 'middle'));
        raekke(A, 320, yL, lit.a, 242);
      } else if (af.art === 'kryds') {
        const n = this.afbSteder(af), up = yL - 11, ned = yL + 11, led = this.krydsLeder(af, s), xK2 = 150 + (n - 2) * 92, p1 = s.s[n - 1];
        const par = (x1, x2, oppe) => ln(x1, up, x2, up, oppe ? 'lv' : '') + ln(x1, ned, x2, ned, oppe ? '' : 'lv');
        o.push(ln(14, yL, 58, yL, 'lv') + kn(0, dot(58, yL) + dot(88, up) + dot(88, ned) + ln(58, yL, 88, s.s[0] ? up : ned, 'bl'), 48, yL - 22, 50, 44) + tx(73, yL + 36, 'K1', 'm', 'middle'));
        for (let i = 1; i < n - 1; i++) {
          const x = 150 + (i - 1) * 92, kr = !!s.s[i];
          o.push(par(x - 62, x, led[i - 1]) + kn(i, dot(x, up) + dot(x, ned) + dot(x + 30, up) + dot(x + 30, ned) + ln(x, up, x + 30, kr ? ned : up, 'bl') + ln(x, ned, x + 30, kr ? up : ned, 'bl'), x - 10, yL - 22, 50, 44) +
            tx(x + 15, yL + 36, 'X' + i, 'm', 'middle'));
        }
        o.push(par(xK2 - 62, xK2, led[n - 2]) + kn(n - 1, dot(xK2, up) + dot(xK2, ned) + dot(xK2 + 30, yL) + ln(xK2 + 30, yL, xK2, p1 ? up : ned, 'bl'), xK2 - 10, yL - 22, 50, 44) +
          tx(xK2 + 15, yL + 36, 'K2', 'm', 'middle') + tx((73 + xK2 + 15) / 2, yL + 52, 'korrespondanceledere · X = krydsafbryder', 'm', 'middle'));
        raekke(A, xK2 + 108, yL, lit.a, xK2 + 30);
      } else if (af.art === 'sensor') {
        o.push(ln(14, yL, 92, yL, 'lv') + kn('p0', `<rect class="box" x="92" y="${yL - 16}" width="44" height="32" rx="2"/><path class="ak" fill="none" d="M 100 ${yL} L 124 ${yL - 10} M 100 ${yL} L 124 ${yL + 10} M 100 ${yL} L 127 ${yL} M 124 ${yL - 10} Q 131 ${yL} 124 ${yL + 10}"/>`, 88, yL - 20, 52, 40) +
          ln(114, yL + 16, 114, NY, 'n') + dot(114, NY) + tx(124, yL + 32, 'PIR · efterløb ' + this.fmt(af.tid) + ' min') + tx(150, yL - 8, 'tændt leder'));
        raekke(A, 250, yL, lit.a, 136);
      } else {
        const n = Math.min(6, Math.max(1, af.steder || 1)), xr = 70 + n * 50 + 30, tr = s.p >= 0;
        o.push(ln(14, yL, xr - 12, yL, 'lv'));
        for (let i = 0; i < n; i++) {
          const x = 56 + i * 50, ned = s.p === i;
          o.push(dot(x, yL) + ln(x, yL, x, 64, 'lv') + kn('p' + i, dot(x, 64) + dot(x, 88) + ln(x, 64, ned ? x : x + 10, ned ? 88 : 85, 'bl') + ln(x - 15, 76, x - 3, 76, 'ak') + ln(x - 15, 70, x - 15, 82, 'ak'), x - 22, 58, 40, 36) +
            ln(x, 88, x, 140, ned ? 'lv' : '') + dot(x, 140) + tx(x + 12, 70, 'S' + (i + 1)));
        }
        o.push(ln(56, 140, xr - 15, 140, tr ? 'lv' : '') + `<rect class="box" x="${xr - 15}" y="129" width="30" height="22"/>` + tx(xr, 144, af.art === 'trappe' ? 't' : 'K', 't', 'middle') +
          ln(xr, 151, xr, NY, 'n') + dot(xr, NY) + ln(xr, 129, xr, yL + 6, 'ak dash') + swH(xr, yL, s.on) +
          tx(xr + 20, 144, af.art === 'trappe' ? 'trappeautomat · ' + this.fmt(af.tid) + ' min' : 'kiprelæ'));
        raekke(A, xr + 150, yL, lit.a, xr + 12);
      }
      const W = Math.max(520, xMax + 70);
      o.push(ln(14, NY, W - 14, NY, 'n') + tx(14, NY + 16, 'N'));
      const css = print ? '<style>.ts .w{stroke:#888;stroke-width:2;fill:none;stroke-linecap:round}.ts .lv{stroke:#d4500a}.ts .n{stroke:#1c6bb0}.ts .bl{stroke:#111;stroke-width:2.6}.ts .x,.ts .ak{stroke:#111;stroke-width:1.3}.ts .dash{stroke-dasharray:3 3}' +
        '.ts .t{fill:#111;font:bold 11px monospace;stroke:none}.ts .m{fill:#555;font:10px monospace;stroke:none}.ts .dot{fill:#111}.ts .lamp,.ts .box{fill:#fff;stroke:#111;stroke-width:1.4}</style><rect width="' + W + '" height="' + H + '" fill="#fff"/>' : '';
      return `<svg xmlns="http://www.w3.org/2000/svg"${print ? ' class="ts"' : ''} viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${css}${o.join('')}</svg>`;
    },
    sld(print) {
      const dyb = Math.min(4, Math.max(0, ...this.db.daaser.map(d => { let n = 0, x = d; while (x && n < 6) { n++; x = this.daase(x.parentId); } return n; })));
      const ROW = 36, DX = 170, XB = 150, XR = 212, XS = 280, XG = 342, XL = 500, XE = 810 + DX * dyb, XA = XE - 40, W = 1280 + DX * dyb, sel = print ? null : this.sldSel, o = [];
      SLDW = W;
      const ln = (x1, y1, x2, y2, c) => `<line class="l${c ? ' ' + c : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      const tx = (x, y, s, c, a) => `<text class="${c || 't'}" x="${x}" y="${y}"${a ? ' text-anchor="' + a + '"' : ''}>${esc(s)}</text>`;
      const kort = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
      const sporSet = new Set(print ? [] : this.spor(this.sldSel).map(x => x.key));
      /* afbrydere: tegnes i serie med hver lampe, de styrer. En afbryder uden tegnede lamper får sin egen række under gruppen. */
      const afbAf = new Map(), afbVist = new Set();
      for (const af of this.db.afbrydere) af.a.concat(af.art === 'krone' ? af.b : []).forEach(id => { if (!afbAf.has(id)) afbAf.set(id, af); });
      this.db.enheder.forEach(e => { const af = afbAf.get(e.id); if (af && this.gruppe(e.gruppeId)) afbVist.add(af.id); });
      const valgtAf = !print && String(this.sldSel || '').startsWith('a:') ? this.db.afbrydere.find(x => 'a:' + x.id === this.sldSel) : null;
      if (valgtAf) valgtAf.a.concat(valgtAf.art === 'krone' ? valgtAf.b : []).forEach(id => this.spor('e:' + id).forEach(x => sporSet.add(x.key)));
      let lokSet = null;
      if (!print && this.lokF) {
        lokSet = new Set(); const med = key => this.spor(key).forEach(x => lokSet.add(x.key)), i = x => x.lokaleId === this.lokF;
        this.db.enheder.filter(i).forEach(e => med('e:' + e.id)); this.db.daaser.filter(i).forEach(d => med('d:' + d.id)); this.db.links.filter(i).forEach(l => med('x:' + l.id)); this.db.racks.filter(i).forEach(r => med('k:' + r.id)); this.db.afbrydere.filter(i).forEach(x => med('a:' + x.id));
      }
      const k = (key, cls, inner, x, y, w, ekstra) => `<g class="k ${cls}${sel === key ? ' on' : ''}${sporSet.has(key) ? ' tr' : ''}${lokSet && !lokSet.has(key) ? ' dim' : ''}" data-k="${key}"${ekstra || ''}><rect class="hit" x="${x}" y="${y - ROW / 2}" width="${w}" height="${ROW}"/>${inner}</g>`;
      const sw = (x, y) => `<circle class="l" cx="${x - 12}" cy="${y}" r="1.5"/>` + ln(x - 12, y, x + 9, y - 10);
      const mcb = (x, y) => sw(x, y) + ln(x + 8.5, y - 3.5, x + 15.5, y + 3.5) + ln(x + 8.5, y + 3.5, x + 15.5, y - 3.5);
      const rcdS = (x, y) => sw(x, y) + `<ellipse class="l" cx="${x + 26}" cy="${y}" rx="4" ry="9"/>`;
      const fuse = (x, y) => `<rect class="l f" x="${x - 12}" y="${y - 5}" width="24" height="10"/>` + ln(x - 12, y, x + 12, y);
      const ticks = (x, y, n) => Array.from({ length:n }, (_, i) => ln(x + i * 5 - 2, y + 5, x + i * 5 + 2, y - 5)).join('');
      const load = (kind, x, y) => this.sym(kind, x, y);
      /* afbrydersymbol på lederen. afGab: hvor lederen slutter før og fortsætter efter symbolet. Enpolet og krone har kontaktpunktet på lederen. */
      const afLav = art => art === 'enpolet' || art === 'krone';
      const afGab = art => afLav(art) ? [7, -2] : art === 'korr' || art === 'kryds' ? [2.5, 2.5] : [6.5, 6.5];
      const afSym = (art, x, y) => `<g class="l" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x - 9} ${y - (afLav(art) ? 13.5 : 9)}) scale(.9)">${this.afbSti(art)}</g>`;
      const afTxt = af => this.afbArt[af.art] + (af.art === 'kryds' || af.art === 'kip' || af.art === 'trappe' ? ' · ' + this.afbSteder(af) + ' steder' : '');
      const drawKids = (gr, did, bx, yy, seen) => {
        /* Kun rødder tegnes fra tavlen/dåsen. Sløjfer (fraEnhed) tegnes lige under den, de er sløjfet fra, og starter i en forgreningsprik på dens streg.
           Børn uden egne sløjfer først, så fire udtag med hver sin stikkontakt giver U1, S1, U2, S2 … */
        const es = this.db.enheder.filter(e => e.gruppeId === gr.id && (did ? e.daaseId === did : !this.daase(e.daaseId)) && !this.enhed(e.fraEnhed));
        const ds = this.db.daaser.filter(d => d.gruppeId === gr.id && (did ? d.parentId === did : !this.daase(d.parentId)) && !seen.has(d.id));
        let r = yy, last = yy;
        const cl = key => (sporSet.has(key) ? ' tr' : '') + (lokSet && !lokSet.has(key) ? ' dim' : '');
        const tegnE = (e, sx, fra, eSet) => {
          eSet.add(e.id); const ry = r, eb = (this.duOver(e) || this.izFejl(e)) ? 'bad' : '', af = afbAf.get(e.id), gab = af ? afGab(af.art) : null;
          const kids = this.sloejfer(e.id).filter(x => !eSet.has(x.id)), px = Math.min(sx + 24, XA - 60);
          kids.sort((a, b) => (this.sloejfer(a.id).length ? 1 : 0) - (this.sloejfer(b.id).length ? 1 : 0));
          o.push(k('e:' + e.id, eb, (af ? ln(sx, r, XA - gab[0], r) + ln(XA + gab[1], r, XE - 9, r) : ln(sx, r, XE - 9, r)) + load(this.symbolFor(e), XE, r) +
            (kids.length ? `<circle class="dot sp" data-sp="${e.id}" cx="${px}" cy="${r}" r="3"/>` : '') +
            tx(sx + 10, r - 6, (fra ? '' : 'G' + gr.nr + ' | ' + gr.In + 'A | ') + e.ledere + this.fmt(e.tv) + ' ' + kort(e.kabel, 9) + ' | ' + this.fmt(e.laengde) + 'm') +
            tx(XE + 26, r - 1, kort(e.navn, 38)) + tx(XE + 26, r + 12, this.lokaleNavn(e.lokaleId) + ' · ' + (e.effekt ? e.effekt + ' W · ΔU ' + this.fmt(this.du(e), 2) + ' %' : 'ingen fast last') + (fra ? ' · sløjfe fra ' + kort(fra.navn, 18) : ''), 'm'), sx + 3, r, W - sx - 10, ' data-fra="' + (fra ? fra.id : '') + '"'));
          if (af) o.push(`<g class="k af${sel === 'a:' + af.id ? ' on' : ''}${cl('a:' + af.id)}" data-k="a:${af.id}"><title>${esc(af.navn + ' · ' + afTxt(af))}</title>` +
            `<rect class="hit" x="${XA - 15}" y="${r - ROW / 2 + 2}" width="30" height="${ROW - 4}" rx="3"/>${afSym(af.art, XA, r)}${af.art === 'krone' ? tx(XA, r + 15, af.a.includes(e.id) ? '1' : '2', 'm', 'middle') : ''}</g>`);
          r += ROW;
          const stik = [];
          for (const c of kids) { if (eSet.has(c.id)) continue; stik.push([c.id, r]); tegnE(c, px, e, eSet); }
          /* lodrette sløjfestreger: længste først, så en fremhævet kort streg ikke dækkes af en længere */
          stik.reverse().forEach(([cid, cy]) => o.push(`<g class="k sl${cl('e:' + cid)}">${ln(px, ry, px, cy)}</g>`));
        };
        for (const e of es) { last = r; tegnE(e, bx, null, new Set()); }
        for (const af of (did ? [] : this.db.afbrydere.filter(x => x.gruppeId === gr.id && !afbVist.has(x.id)))) {
          last = r; const gab = afGab(af.art);
          o.push(k('a:' + af.id, '', ln(bx, r, XA - gab[0], r) + afSym(af.art, XA, r) + tx(bx + 10, r - 6, 'G' + gr.nr + ' | ' + gr.In + 'A | afbryder') +
            tx(XE + 26, r - 1, kort(af.navn, 38)) + tx(XE + 26, r + 12, this.lokaleNavn(af.lokaleId) + ' · ' + afTxt(af) + ' · ingen lamper valgt', 'm'), bx + 3, r, W - bx - 10));
          r += ROW;
        }
        for (const rk of (did ? [] : this.racksFor(gr.id))) {
          last = r;
          o.push(k('k:' + rk.id, '', ln(bx, r, XE - 9, r) + load('rk', XE, r) + tx(bx + 10, r - 6, 'G' + gr.nr + ' | ' + gr.In + 'A | rackforsyning') +
            tx(XE + 26, r - 1, 'Rack ' + rk.navn + ' · ' + rk.type) + tx(XE + 26, r + 12, this.lokaleNavn(rk.lokaleId) + ' · ' + this.fmt(this.rackW(rk.id), 0) + ' W inkl. PoE', 'm'), bx + 3, r, W - bx - 10));
          r += ROW;
        }
        for (const ut of (did ? [] : this.underTavler(gr.id))) {
          last = r;
          o.push(k('t:' + ut.id, '', ln(bx, r, XE - 9, r) + load('ut', XE, r) + tx(bx + 10, r - 6, 'G' + gr.nr + ' | ' + gr.In + 'A | ' + (this.tilgTxt(ut) ? kort(this.tilgTxt(ut), 24) : 'tilgang til undertavle')) +
            tx(XE + 26, r - 1, 'Undertavle ' + ut.navn) + tx(XE + 26, r + 12, (ut.placering ? kort(ut.placering, 26) + ' · ' : '') + 'fortsætter i eget diagram', 'm'), bx + 3, r, W - bx - 10));
          r += ROW;
        }
        for (const d of ds) {
          last = r; seen.add(d.id); const xj = bx + DX - 22;
          o.push(k('d:' + d.id, this.daaseIzFejl(d) ? 'bad' : '', ln(bx, r, xj - 7, r) + `<rect class="l f" x="${xj - 7}" y="${r - 7}" width="14" height="14"/><circle class="dot" cx="${xj}" cy="${r}" r="3"/>` + ln(xj + 7, r, bx + DX, r) +
            tx(bx + 10, r - 6, d.ledere + this.fmt(d.tv) + ' | ' + this.fmt(d.laengde) + 'm') + tx(bx + 10, r + 14, kort(d.type + ' ' + d.navn, 20), 'm'), bx + 3, r, DX - 6));
          const n = drawKids(gr, d.id, bx + DX, r, seen);
          if (!n) o.push(tx(bx + DX + 10, r + 4, 'ingen afgange', 'm'));
          r += Math.max(1, n) * ROW;
        }
        if (r === yy) return 0;
        o.push(ln(bx, yy, bx, last, 'b2'));
        return (r - yy) / ROW;
      };
      const drawG = (gr, x0, yy) => {
        const bad = this.gruppeFejl(gr.id).length ? ' bad' : '';
        o.push(k('g:' + gr.id, 'typed ' + gr.type + bad,
          ln(x0, yy, XG - 12, yy) + ticks(XG - 34, yy, gr.faser == 3 ? 3 : 1) + mcb(XG, yy) + ln(XG + 12, yy, XL, yy) + `<rect class="tc" x="${XG - 6}" y="${yy + 6}" width="12" height="5"/>` +
          tx(XG + 22, yy - 7, 'G' + gr.nr + ' · ' + gr.kar + gr.In + ' · ' + (gr.faser == 3 ? 'L1L2L3' : gr.fase)) + tx(XG + 22, yy + 14, kort(gr.navn, 21), 'm'), x0 + 3, yy, XL - x0 - 6));
        const n = drawKids(gr, '', XL, yy, new Set());
        if (!n) { o.push(tx(XL + 10, yy + 4, 'Ingen brugsgenstande', 'm')); return 1; }
        return n;
      };
      const order = [], walk = t => { if (order.includes(t)) return; order.push(t); this.db.tavler.filter(c => c.fra === t.id).forEach(walk); };
      this.db.tavler.filter(t => !this.tavle(t.fra) || t.fra === t.id).forEach(walk); this.db.tavler.forEach(walk);
      let y = 0;
      for (const t of order) {
        y += 56; const y0 = y, par = (t.fra !== t.id && this.tavle(t.fra)) || null, fg = this.gruppe(t.fraGruppe), f = this.faseInfo(t.id);
        o.push(tx(16, y0 - 28, t.navn + (t.placering ? ' · ' + t.placering : ''), 'h'));
        o.push(k('t:' + t.id, f.max > t.forsikring ? 'bad' : '',
          ln(16, y0, 44, y0) + fuse(56, y0) + (t.hovedafbryder ? ln(68, y0, 112, y0) + sw(124, y0) + ln(136, y0, XB, y0) : ln(68, y0, XB, y0)) + ticks(80, y0, 3) + tx(16, y0 - 9, par ? 'Fra ' + par.navn + (fg ? ' · G' + fg.nr : '') : 'Net 3×400 V', 'm') +
          tx(16, y0 + 17, t.forsikring + 'A' + (t.hovedafbryder ? ' · Q0 ' + t.hovedafbryder + 'A' : this.tilgTxt(t) ? ' ' + kort(this.tilgTxt(t), 15) : '')), 10, y0, XB - 14));
        let r = y0 + ROW, last = y0;
        const gs = this.grupperFor(t.id), brugt = new Set();
        for (const rc of this.rcdsFor(t.id)) {
          const under = gs.filter(g => g.rcdId === rc.id), r0 = r; last = r;
          o.push(k('r:' + rc.id, '', ln(XB, r, XR - 12, r) + rcdS(XR, r) + ln(XR + 12, r, XS, r) + tx(XB + 8, r - 8, kort(rc.navn, 8)) + tx(XB + 8, r + 15, rc.In + 'A ' + rc.idn + 'mA ' + rc.type, 'm'), XB + 3, r, XS - XB - 6));
          if (!under.length) { r += ROW; continue; }
          let gl = r;
          for (const g of under) { brugt.add(g.id); gl = r; r += drawG(g, XS, r) * ROW; }
          o.push(ln(XS, r0, XS, gl, 'b2'));
        }
        for (const g of gs.filter(g => !brugt.has(g.id))) { last = r; r += drawG(g, XB, r) * ROW; }
        for (const c of this.db.tavler.filter(c => c.fra === t.id && c.id !== t.id && !this.gruppe(c.fraGruppe))) {
          last = r;
          o.push(k('t:' + c.id, '', ln(XB, r, XG + 60, r) + `<path class="l" d="M ${XG + 52} ${r - 5} L ${XG + 60} ${r} L ${XG + 52} ${r + 5}"/>` +
            tx(XB + 10, r - 7, 'Til ' + c.navn + ' | ' + c.forsikring + 'A' + (this.tilgTxt(c) ? ' | ' + kort(this.tilgTxt(c), 18) : '')), XB + 3, r, XG + 70 - XB));
          r += ROW;
        }
        o.push(ln(XB, y0, XB, last, 'b'));
        y = r - ROW / 2;
      }
      if (!order.length) { y += 40; o.push(tx(16, y, 'Ingen tavler i projektet endnu.', 'm')); }
      for (const rk of this.db.racks) {
        y += 56; const y0 = y; let r = y0 + ROW, last = y0;
        o.push(tx(16, y0 - 28, 'Svagstrøm · rack ' + rk.navn + ' · ' + rk.type, 'h'));
        o.push(k('k:' + rk.id, this.rackHe(rk.id) > rk.he ? 'bad' : '', ln(16, y0, 53, y0) + load('rk', 62, y0) + ln(79, y0, XB, y0) + tx(16, y0 - 12, kort(this.lokaleNavn(rk.lokaleId), 20), 'm') +
          tx(16, y0 + 21, this.fmt(this.rackW(rk.id), 0) + 'W · ' + this.rackHe(rk.id) + '/' + rk.he + ' HE'), 10, y0, XB - 14));
        const tegnLinks = (ls, yy) => {
          ls.forEach((l, i) => {
            const ey = yy + i * ROW, sw1 = this.udst(l.switchId), pp = this.udst(l.panelId), cctv = l.art === 'cctv';
            o.push(k('x:' + l.id, 'typed ' + (cctv ? 'cctv' : 'data') + (this.linkFejl(l).length ? ' bad' : ''), ln(XS, ey, XE - 9, ey) + load(cctv ? 'kam' : 'rj', XE, ey) + `<rect class="tc" x="${XS + 5}" y="${ey + 4}" width="12" height="5"/>` +
              tx(XS + 22, ey - 6, [sw1 ? 'P' + l.switchPort : null, l.kabel, this.fmt(l.laengde) + 'm', pp ? pp.navn + ':' + l.panelPort : null, Number(l.poeW) ? 'PoE ' + this.fmt(l.poeW, 2) + 'W' : null].filter(Boolean).join(' | ')) +
              tx(XE + 26, ey - 1, kort(l.navn, 38)) + tx(XE + 26, ey + 12, this.lokaleNavn(l.lokaleId) + (cctv ? ' · ' + l.kamType + ' ' + l.oploesning + ' · ' + (this.udstTxt(l.nvrId) || 'ingen NVR') : ' · dataudtag RJ45'), 'm'), XS + 3, ey, W - XS - 10));
          });
          if (ls.length > 1) o.push(ln(XS, yy, XS, yy + (ls.length - 1) * ROW, 'b2'));
          return Math.max(1, ls.length);
        };
        for (const u of this.udstyrFor(rk.id).filter(u => u.art !== 'patchpanel')) {
          last = r; const ls = u.art === 'switch' ? this.db.links.filter(l => l.switchId === u.id).sort((a, b) => a.switchPort - b.switchPort) : [];
          const over = u.art === 'switch' && u.poe && this.poeBrug(u.id) > u.poeBudget;
          o.push(k('u:' + u.id, over ? 'bad' : '', ln(XB, r, XR - 9, r) + load(({ switch:'sw', nvr:'nvr', router:'rt' })[u.art] || 'it', XR, r) + (ls.length ? ln(XR + 17, r, XS, r) : '') + tx(XB + 6, r - 9, kort(u.navn, 7)) +
            tx(XB + 6, r + 21, u.art === 'switch' ? (u.poe ? 'PoE ' + this.fmt(this.poeBrug(u.id), 0) + '/' + u.poeBudget + 'W' : u.porte + ' porte') : u.art === 'nvr' ? this.kameraerPaa(u.id) + '/' + u.porte + ' kanaler' : '', 'm'), XB + 3, r, XS - XB - 6));
          r += (ls.length ? tegnLinks(ls, r) : 1) * ROW;
        }
        const upat = this.db.links.filter(l => !this.udst(l.switchId) && (this.udst(l.panelId) || {}).rackId === rk.id);
        if (upat.length) { r += 14; last = r; o.push(ln(XB, r, XS, r) + tx(XB + 6, r - 8, 'Ikke patchet', 'm')); r += tegnLinks(upat, r) * ROW; }
        o.push(ln(XB, y0, XB, last, 'b')); y = r - ROW / 2;
      }
      const u = this.enhederFor('').length; if (u) { y += 30; o.push(tx(16, y, u + ' brugsgenstande uden gruppe er ikke vist.', 'm')); }
      const au = this.db.afbrydere.filter(x => !afbVist.has(x.id) && !this.gruppe(x.gruppeId)).length; if (au) { y += 18; o.push(tx(16, y, au + ' afbrydere uden gruppe og lamper er ikke vist.', 'm')); }
      const lu = this.db.links.filter(l => !this.udst(l.switchId) && !this.udst(l.panelId)).length; if (lu) { y += 18; o.push(tx(16, y, lu + ' svagstrømsforbindelser uden rack er ikke vist.', 'm')); }
      const H = y + 30;
      const css = print ? '<style>.l{stroke:#111;stroke-width:1.3;fill:none}.f{fill:#fff}.b{stroke-width:3}.b2{stroke-width:2}.t{fill:#111;font:11px monospace;stroke:none}.m{fill:#555;font:10px monospace}' +
        '.h{fill:#111;font:bold 15px Arial,sans-serif}.s{font-size:9px}.hit{fill:none}.dot{fill:#111;stroke:none}.tc{fill:#666}.cctv .tc{fill:#0f7d58}.lys .tc{fill:#c99700}.kraft .tc{fill:#d4500a}.stik .tc{fill:#1c6bb0}.data .tc{fill:#7446b8}' +
        '.bad .l{stroke:#b3204f}.bad .t{fill:#b3204f}</style><rect width="' + W + '" height="' + H + '" fill="#fff"/>' : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${print ? '' : 'width="' + W + '" height="' + H + '"'}>${css}${o.join('')}</svg>`;
    },
    sldInfo() {
      const [a, id] = (this.sldSel || '').split(':'); let o;
      if (a === 'e' && (o = this.db.enheder.find(e => e.id === id))) {
        const g = this.gruppe(o.gruppeId);
        return { art:'Brugsgenstand', titel:o.navn, type:'enhed', obj:o, gid:o.gruppeId,
          fejl: [this.duOver(o) && 'ΔU over grænsen på ' + this.duGraense(o) + ' %.', this.izFejl(o) && 'Iz under sikringens mærkestrøm.'].filter(Boolean),
          rows: [['Gruppe', this.gruppeTxt(o.gruppeId)], ['Lokale', this.lokaleNavn(o.lokaleId)], ['Kabel', o.kabel + ' ' + this.kabelDim(o)], ['Længde', this.fmt(o.laengde) + ' m'], ['Effekt', o.effekt + ' W'],
            ['Strøm', this.fmt(this.strom(o)) + ' A'], ['ΔU', this.fmt(this.du(o), 2) + ' %'], ['Iz', this.fmt(this.iz(o)) + ' A'], ['Sikring', g ? g.kar + g.In : '–']] };
      }
      if (a === 'a' && (o = this.db.afbrydere.find(x => x.id === id))) {
        const andre = o.a.concat(o.b).map(i => this.db.enheder.find(e => e.id === i)).filter(e => e && e.gruppeId !== o.gruppeId);
        return { art:'Afbryder', titel:o.navn, type:'afbryder', obj:o, gid:o.gruppeId, fejl: andre.length ? [andre.map(e => e.navn).join(', ') + ' ligger på en anden gruppe end afbryderen.'] : [],
          rows: [['Type', this.afbArt[o.art]], ['Gruppe', this.gruppe(o.gruppeId) ? this.gruppeTxt(o.gruppeId) : '–'], ['Lokale', this.lokaleNavn(o.lokaleId)], ['Betjeningssteder', this.afbSteder(o)]]
            .concat(o.art === 'trappe' || o.art === 'sensor' ? [['Tid', this.fmt(o.tid) + ' min']] : [], [[o.art === 'krone' ? 'Tænding 1' : 'Lamper', this.afbLamper(o, 'a') || 'Ingen valgt']], o.art === 'krone' ? [['Tænding 2', this.afbLamper(o, 'b') || 'Ingen valgt']] : []) };
      }
      if (a === 'g' && (o = this.gruppe(id))) return { art:'Gruppe', titel:'G' + o.nr + ' ' + o.navn, type:'gruppe', obj:o, gid:o.id, fejl:this.gruppeFejl(id),
        rows: [['Tavle', this.tavleNavn(o.tavleId)], ['Type', this.typeLabel[o.type]], ['Sikring', o.kar + o.In], ['Fase', o.faser == 3 ? 'L1 L2 L3' : o.fase], ['HPFI', this.rcdTxt(o)],
          ['Last', this.fmt(this.gruppeI(id)) + ' A'], ['Brugsgenstande', this.enhederFor(id).length], ['Kabel', this.gruppeKabler(id) || '–']] };
      if (a === 'r' && (o = this.db.rcds.find(r => r.id === id))) return { art:'Fejlstrømsafbryder', titel:o.navn, type:'rcd', obj:o, gid:'', fejl:[],
        rows: [['Tavle', this.tavleNavn(o.tavleId)], ['Type', o.type], ['Mærkestrøm', o.In + ' A'], ['Udløsestrøm', o.idn + ' mA'], ['Grupper', this.db.grupper.filter(g => g.rcdId === id).length]] };
      if (a === 't' && (o = this.tavle(id))) {
        const f = this.faseInfo(id);
        return { art:'Tavle', titel:o.navn, type:'tavle', obj:o, gid:'', fejl: f.vals.filter(p => p.I > o.forsikring).map(p => p.p + ' over forsikringen: ' + this.fmt(p.I) + ' A.'),
          rows: [['Placering', o.placering || '–'], ['Forsynes fra', this.tavle(o.fra) ? this.tavleNavn(o.fra) : 'Net'], ['Tilgangskabel', this.tilgTxt(o) || '–'], ['ΔU i tilgang', this.fmt(this.tilgDu(o), 2) + ' %'], ['Forsikring', o.forsikring + ' A']]
            .concat(f.vals.map(p => [p.p, this.fmt(p.I) + ' A'])).concat([['Grupper', this.grupperFor(id).length]]) };
      }
      if (a === 'd' && (o = this.daase(id))) return { art:'Samlepunkt', titel:o.type + ' ' + o.navn, type:'daase', obj:o, gid:o.gruppeId, fejl: this.daaseIzFejl(o) ? ['Iz under sikringens mærkestrøm.'] : [],
        rows: [['Gruppe', this.gruppeTxt(o.gruppeId)], ['Forsynes fra', o.parentId ? this.daaseTxt(o.parentId) : 'Tavle'], ['Lokale', this.lokaleNavn(o.lokaleId)], ['Tilgangskabel', o.kabel + ' ' + this.kabelDim(o)], ['Længde', this.fmt(o.laengde) + ' m'],
          ['Afgange', this.db.enheder.filter(e => e.daaseId === id).length + this.db.daaser.filter(d => d.parentId === id).length], ['Strøm', this.fmt(this.daaseI(id)) + ' A'], ['ΔU frem til dåsen', this.fmt(this.duOp(id), 2) + ' %']] };
      if (a === 'k' && (o = this.rack(id))) return { art:'Rackskab', titel:o.navn, type:'rack', obj:o, gid:o.gruppeId, fejl: this.rackHe(id) > o.he ? ['Udstyret fylder mere end skabets højde.'] : [],
        rows: [['Type', o.type], ['Lokale', this.lokaleNavn(o.lokaleId)], ['Højde', this.rackHe(id) + ' af ' + o.he + ' HE'], ['Effekt inkl. PoE', this.fmt(this.rackW(id), 0) + ' W'], ['Forsynes fra', o.gruppeId ? this.gruppeTxt(o.gruppeId) : 'Ikke angivet'], ['Udstyr', this.udstyrFor(id).length]] };
      if (a === 'u' && (o = this.udst(id))) return { art:'Rackudstyr', titel:o.navn, type:'udstyr', obj:o, gid:'', fejl: o.art === 'switch' && o.poe && this.poeBrug(id) > o.poeBudget ? ['PoE-budgettet er overskredet.'] : [],
        rows: [['Rack', this.rackNavn(o.rackId)], ['Art', this.udstArt[o.art]], [o.art === 'nvr' ? 'Kanaler' : 'Porte', o.porte], ['PoE', o.poe ? this.fmt(this.poeBrug(id)) + ' af ' + o.poeBudget + ' W' : 'Nej'], ['Egenforbrug', o.effekt + ' W'],
          ['Forbindelser', this.db.links.filter(l => l.switchId === id || l.panelId === id || l.nvrId === id).length]] };
      if (a === 'x' && (o = this.db.links.find(l => l.id === id))) return { art: o.art === 'cctv' ? 'Kamera (CCTV)' : 'Dataudtag (PDS)', titel:o.navn, type:'link', obj:o, gid:'', fejl:this.linkFejl(o),
        rows: [['Lokale', this.lokaleNavn(o.lokaleId)], ['Kabel', o.kabel], ['Længde', this.fmt(o.laengde) + ' m'], ['Patchpanel', this.portTxt(o, 'panel')], ['Switch', this.portTxt(o, 'switch')], ['PoE', Number(o.poeW) ? this.fmt(o.poeW, 2) + ' W' : 'Nej']]
          .concat(o.art === 'cctv' ? [['Kamera', o.kamType + ' ' + o.oploesning], ['NVR', this.udstTxt(o.nvrId) || '–']] : []) };
      return null;
    },
    sldEdit() { const i = this.sldInfo(); if (i) this.openForm(i.type, i.obj); },
    sldClick(ev) { if (this.panMoved) return; const el = ev.target.closest && ev.target.closest('[data-k]'); this.sldSel = el ? el.getAttribute('data-k') : null; },
    sldDbl(ev) { const el = ev.target.closest && ev.target.closest('[data-k]'); if (el) { this.sldSel = el.getAttribute('data-k'); this.sldEdit(); } },
    /* Én pointer panorerer. To pointere (to fingre på touch) zoomer om midtpunktet og panorerer samtidig. SLDP holder de aktive pointere. */
    panStart(ev) {
      if (ev.button) return; SLDP.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
      if (SLDP.size === 2) { this.pinchStart(); return; }
      if (SLDP.size > 2) return;
      this.pinch = null; this.pan = { x:ev.clientX, y:ev.clientY, ox:this.z.x, oy:this.z.y }; this.panMoved = false;
    },
    pinchMaal() { const [a, b] = [...SLDP.values()], r = this.$refs.sldBox.getBoundingClientRect(); return { d:Math.hypot(a.x - b.x, a.y - b.y) || 1, cx:(a.x + b.x) / 2 - r.left, cy:(a.y + b.y) / 2 - r.top }; },
    pinchStart() { const m = this.pinchMaal(); this.pinch = Object.assign(m, { z:Object.assign({}, this.z) }); this.pan = null; this.panMoved = true; },
    panEnd(ev) {
      if (!SLDP.delete(ev.pointerId)) return;
      if (SLDP.size === 2) { this.pinchStart(); return; }
      if (SLDP.size === 1 && this.pinch) { const p = [...SLDP.values()][0]; this.pinch = null; this.pan = { x:p.x, y:p.y, ox:this.z.x, oy:this.z.y }; return; }
      if (!SLDP.size) { this.pan = null; this.pinch = null; }
    },
    panMove(ev) {
      if (SLDP.has(ev.pointerId)) SLDP.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
      if (this.pinch && SLDP.size >= 2) {
        const p = this.pinch, m = this.pinchMaal(), k = Math.min(4, Math.max(0.25, p.z.k * m.d / p.d));
        this.z = { x:m.cx - (p.cx - p.z.x) * k / p.z.k, y:m.cy - (p.cy - p.z.y) * k / p.z.k, k }; return;
      }
      const p = this.pan; if (!p) return; const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.panMoved = true;
      if (this.panMoved) this.z = { x:p.ox + dx, y:p.oy + dy, k:this.z.k };
    },
    zoomAt(f, cx, cy) { const z = this.z, k = Math.min(4, Math.max(0.25, z.k * f)); this.z = { x: cx - (cx - z.x) * k / z.k, y: cy - (cy - z.y) * k / z.k, k }; },
    zoom(f) { const b = this.$refs.sldBox; this.zoomAt(f, b.clientWidth / 2, b.clientHeight / 2); },
    hjul(ev) { if (!(ev.ctrlKey || ev.metaKey)) return; ev.preventDefault(); const r = this.$refs.sldBox.getBoundingClientRect(); this.zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top); },
    tilpas() { const w = this.$refs.sldBox.clientWidth; this.z = { x:8, y:8, k: w ? Math.min(1.5, Math.max(0.25, (w - 16) / SLDW)) : 1 }; },

});
