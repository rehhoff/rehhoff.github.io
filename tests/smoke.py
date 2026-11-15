"""Røgtest af index.html i headless Chrome.

Kør fra repoets rod:  npm install  &&  python3 tests/smoke.py
Kræver Python-pakken playwright. Chrome findes via miljøvariablen CHROME,
ellers bruges playwrights egen Chromium (python3 -m playwright install chromium).
Tailwind-CDN'et blokeres, så testen dækker logik og Alpine, ikke layout.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROD = Path(__file__).resolve().parent.parent
APP = (ROD / 'index.html').read_text(encoding='utf-8')
ALPINE = ROD / 'node_modules' / 'alpinejs' / 'dist' / 'cdn.min.js'
URL = 'http://app.test/'
fejl, kontrol = [], []


def tjek(navn, ok, info=''):
    kontrol.append((navn, bool(ok), info))


async def route(r):
    u = r.request.url
    if 'alpinejs' in u:
        await r.fulfill(body=ALPINE.read_text(encoding='utf-8'), content_type='application/javascript')
    elif u.startswith(URL):
        await r.fulfill(body=APP, content_type='text/html')
    else:
        await r.abort()


A = "Alpine.$data(document.querySelector('[x-data]'))"


async def main():
    if not ALPINE.exists():
        sys.exit('Mangler node_modules/alpinejs. Kør npm install først.')
    async with async_playwright() as p:
        chrome = os.environ.get('CHROME')
        b = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox']) if chrome else await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}, accept_downloads=True)
        await ctx.route('**/*', route)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: fejl.append(str(e)) if 'tailwind' not in str(e) else None)
        pg.on('console', lambda m: fejl.append(m.text[:300]) if m.type == 'error' and 'ERR_' not in m.text and 'tailwind' not in m.text.lower() else None)

        # 1. Første start med eksempeldata
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"(()=>{{const a={A};return {{n:a.projekter.length, v:a.appVersion, w:a.warnings().length}}}})()")
        tjek('starter med eksempelprojekter', r['n'] >= 2, r)

        # 2. Alle faner og formularer
        for k in '1234567890':
            await pg.keyboard.press(k); await pg.wait_for_timeout(60)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));
          const typer=[['tavle',a.db.tavler[0]],['rcd',a.db.rcds[0]],['lokale',a.db.lokaler[0]],['gruppe',a.db.grupper[0]],['enhed',a.db.enheder[0]],
            ['daase',a.db.daaser[0]],['afbryder',a.db.afbrydere[0]],['rack',a.db.racks[0]],['udstyr',a.db.udstyr[0]],['link',a.db.links[0]]];
          for (const [t,o] of typer) {{ a.openForm(t,o); await T(60); a.modal=null; await T(40); a.openForm(t); await T(60); a.modal=null; await T(40); }}
          return {{sld:a.sld(true).length, doc:a.docHtml().length, bak:JSON.parse(a.backupJson()).projekter.length, spor:a.spor('e:'+a.db.enheder[0].id).length}}}}""")
        tjek('diagrammer, dokumentation og backup kan bygges', r['sld'] > 1000 and r['doc'] > 1000 and r['bak'] >= 2 and r['spor'] >= 2, r)

        # 3. Beregning: ændring af tværsnit sænker spændingsfaldet
        r = await pg.evaluate(f"(()=>{{const a={A};const e=a.db.enheder.find(x=>Number(x.effekt)>1000);const f=a.du(e);const g=a.du(e,(e.tv||1.5)*4);return [f,g]}})()")
        tjek('spændingsfald falder med større tværsnit', r[0] > r[1] > 0, r)

        # 4. Opgradering: data uden skema bevares, og der tages backup
        await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));delete i.schema;
          const id=i.aktiv;const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Testprojekt før opgradering';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"(()=>{{const a={A};return {{navn:a.db.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema}}}})()")
        tjek('opgradering bevarer projekt og laver backup', r['navn'] == 'Testprojekt før opgradering' and r['b'] == 1 and r['s'], r)

        # 5. Backupfil kan hentes og indlæses uden at overskrive
        async with pg.expect_download() as dl:
            await pg.evaluate(f"{A}.hentBackup()")
        fil = await (await dl.value).path()
        n0 = await pg.evaluate(f"{A}.projekter.length")
        await pg.evaluate(f"{A}.importJson({json.dumps(Path(fil).read_text(encoding='utf-8'))}, true)")
        n1 = await pg.evaluate(f"{A}.projekter.length")
        tjek('backup kan hentes og genindlæses uden dubletter', n1 == n0, (n0, n1))

        await b.close()

    for navn, ok, info in kontrol:
        print(('OK    ' if ok else 'FEJL  ') + navn + ('' if ok else f'  {info}'))
    for f in fejl:
        print('JS-FEJL ' + f)
    if fejl or not all(ok for _, ok, _ in kontrol):
        sys.exit(1)
    print('OK')


asyncio.run(main())
