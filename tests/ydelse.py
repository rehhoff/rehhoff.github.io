"""Måling af svartider på et stort projekt (plan docs/planer/2026-11-19-ydelse.md, trin 0).

Kør fra repoets rod:  python tests/ydelse.py
Måleværktøj, ikke en del af røgtesten. Projektet oprettes i en ny browserkontekst og forsvinder, når scriptet slutter.
Hver måling gentages 5 gange; tabellen viser medianen i ms (funktionskald + Alpines opdatering + layout).
"""
import asyncio, os, statistics, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROD = Path(__file__).resolve().parent.parent
TYPER = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'}
ALPINE = ROD / 'node_modules' / 'alpinejs' / 'dist' / 'cdn.min.js'


class smoke:  # samme opsætning som tests/smoke.py
    URL = 'http://app.test/'
    A = "Alpine.$data(document.querySelector('[x-data]'))"

    @staticmethod
    async def route(r):
        u = r.request.url
        if 'alpinejs' in u:
            await r.fulfill(body=ALPINE.read_text(encoding='utf-8'), content_type='application/javascript')
        elif u.startswith(smoke.URL):
            sti = u[len(smoke.URL):].split('?')[0].split('#')[0] or 'index.html'
            fil = (ROD / sti).resolve()
            if ROD in fil.parents and fil.is_file():
                await r.fulfill(body=fil.read_bytes(), content_type=TYPER.get(fil.suffix, 'application/octet-stream'))
            else:
                await r.fulfill(status=404, body='')
        else:
            await r.abort()

GENT = int(os.environ.get('YDELSE_GENT', '5'))
BYG = """(f) => {
  const a = %s, T = [], G = [], D = [], E = [], A = [], L = [];
  for (let l = 0; l < 20; l++) L.push({ id:'L' + l, navn:'Lokale ' + l, etage:'' });
  for (let t = 0; t < 3; t++) T.push({ id:'T' + t, navn:'T' + t, forsikring:100, hovedafbryder:125, fra:t ? 'T0' : '', tLaengde:10 });
  for (let g = 0; g < 60 * f; g++) G.push({ id:'G' + g, tavleId:'T' + (g %% 3), nr:Math.floor(g / 3) + 1, navn:'Gruppe ' + g, type:['lys', 'stik', 'kraft', 'lysstik', 'data'][g %% 5], kar:'B', In:[10, 13, 16][g %% 3], faser:g %% 7 === 0 ? 3 : 1, fase:['L1', 'L2', 'L3'][g %% 3], rcdId:'', sf:0.8 });
  for (let d = 0; d < 120 * f; d++) D.push({ id:'D' + d, navn:'Dåse ' + d, type:'Membrandåse', gruppeId:'G' + (d %% (60 * f)), parentId: d >= 60 * f ? 'D' + (d - 60 * f) : '', lokaleId:'L' + (d %% 20), kabel:'PVC', ledere:'3G', tv:1.5, laengde:4 });
  for (let e = 0; e < 600 * f; e++) E.push({ id:'E' + e, navn:'Enhed ' + e, gruppeId:'G' + (e %% (60 * f)), lokaleId:'L' + (e %% 20), daaseId: e %% 2 ? 'D' + (e %% (120 * f)) : '', fraEnhed: e >= 60 && e %% 3 === 0 ? 'E' + (e - 60) : '', effekt:100 + e, kabel:'PVC', ledere:'3G', tv:1.5, laengde:5 + (e %% 7) });
  for (let i = 0; i < 60 * f; i++) A.push({ id:'A' + i, navn:'Afbryder ' + i, art:'enpolet', gruppeId:'G' + (i %% (60 * f)), lokaleId:'L' + (i %% 20), a:['E' + i], b:[], laengde:3 });
  a.aktiver(a.pid, norm({ projekt:{ navn:'Ydelse' }, tavler:T, grupper:G, daaser:D, enheder:E, afbrydere:A, lokaler:L }));
  a.fvFoldAlle(true);
  return [a.db.tavler.length, a.db.grupper.length, a.db.daaser.length, a.db.enheder.length, a.db.afbrydere.length];
}""" % smoke.A

TID = """async ([navn, arg]) => {
  const a = %s, t0 = performance.now();
  await window.__maal[navn](a, arg);
  await Alpine.nextTick(); document.body.offsetHeight;
  return performance.now() - t0;
}""" % smoke.A

OPSAET = """() => {
  window.__maal = {
    flueben: (a, i) => { const r = a.foeringTrae().find(x => x.kind === 'enhed' && Number(x.o.laengde) > 0); a.fvSaet(r, 'trukket', !r.o.trukket); },
    gem: (a, i) => { const r = a.foeringTrae().find(x => x.kind === 'enhed' && Number(x.o.laengde) > 0); a.fvRedAabn(r); a.fvTmp.laengde = 6 + ((window.__n = (window.__n || 0) + 1) % 50) / 10; a.fvRedGem(r); },
    ret: (a, i) => { const e = a.db.enheder[10]; a.openForm('enhed', e); a.form.effekt = 500 + i; a.saveForm(); },
    undo: (a, i) => { a.undo(); },
    fane: (a, v) => { a.go(v); }
  };
}"""


async def main():
    chrome = os.environ.get('CHROME')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox']) if chrome else await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}); ctx.set_default_timeout(60000)
        await ctx.route('**/*', smoke.route)
        pg = await ctx.new_page()
        fejl = []
        pg.on('pageerror', lambda e: fejl.append(str(e)))
        await pg.goto(smoke.URL)
        await pg.wait_for_function('window.__alpineOk === true')
        print(flush=True, *['Projekt (tavler, grupper, dåser, enheder, afbrydere):', await pg.evaluate(BYG, float(os.environ.get('YDELSE_F', '1')))])
        await pg.evaluate(OPSAET)

        async def maal(navn, arg_fn, foer=None):
            ts = []
            for i in range(GENT):
                if foer: await foer(i)
                ts.append(await pg.evaluate(TID, [navn, arg_fn(i)]))
            return statistics.median(ts)

        ud = {}
        await pg.evaluate(A_GO('foering'))
        await pg.evaluate("() => Alpine.nextTick()")
        ud['Flueben i føringsvej'] = await maal('flueben', lambda i: i)
        ud['Gem kabel'] = await maal('gem', lambda i: i)
        ud['Ret brugsgenstand'] = await maal('ret', lambda i: i)
        # Fortryd: lav en ændring før hver måling, så der er noget at fortryde
        async def lav(i): await pg.evaluate("() => { const a = %s; a.mutate(() => { a.db.enheder[3].effekt += 1; }); }" % smoke.A)
        ud['Fortryd'] = await maal('undo', lambda i: i, lav)
        # Skift fane: Tavle, Beregning og Dokumentation, hver fra Føringsvej
        fane = []
        for v in ['tavle', 'beregning', 'dokumentation']:
            ts = []
            for i in range(GENT):
                await pg.evaluate(A_GO('foering')); await pg.evaluate("() => Alpine.nextTick()")
                ts.append(await pg.evaluate(TID, ['fane', v]))
            ud['Fane ' + v] = statistics.median(ts); fane.append(ud['Fane ' + v])
        ud['Skift fane'] = statistics.median(fane)
        print('\n| Måling (median, ms) | Tid |\n|---|---|')
        for k, v in ud.items(): print('| %s | %.0f |' % (k, v))
        if fejl: print('\nJS-fejl:', fejl[:3])
        await b.close()


def A_GO(v): return "() => %s.go('%s')" % (smoke.A, v)


asyncio.run(main())
