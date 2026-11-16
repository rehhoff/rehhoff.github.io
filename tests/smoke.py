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

# Falsk GitHub-API til synkroniseringstesten: én hemmelig Gist delt mellem to "enheder".
GIST = {}
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, accept',
        'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS'}


def gist_json():
    return {'id': 'g1', 'files': {n: {'filename': n, 'content': c, 'truncated': False, 'raw_url': 'https://gist.test/raw/' + n}
                                  for n, c in GIST.items()}}


async def github(r):
    req, u = r.request, r.request.url
    svar = lambda data, status=200: r.fulfill(status=status, headers=CORS, content_type='application/json', body=json.dumps(data))
    if req.method == 'OPTIONS':
        return await r.fulfill(status=204, headers=CORS)
    if req.headers.get('authorization') != 'Bearer test-token':
        return await svar({'message': 'Bad credentials'}, 401)
    sti = u.split('api.github.com', 1)[1]
    if sti == '/user':
        return await svar({'login': 'testbruger'})
    if sti.startswith('/gists?'):
        return await svar([gist_json()] if GIST else [])
    if sti == '/gists' and req.method == 'POST':
        GIST.update({n: f['content'] for n, f in json.loads(req.post_data)['files'].items()})
        return await svar(gist_json(), 201)
    if sti == '/gists/g1' and req.method == 'GET':
        return await svar(gist_json())
    if sti == '/gists/g1' and req.method == 'PATCH':
        for n, f in json.loads(req.post_data)['files'].items():
            if f is None: GIST.pop(n, None)
            else: GIST[n] = f['content']
        return await svar(gist_json())
    await svar({'message': 'Not Found'}, 404)


async def ny_enhed(b):
    ctx = await b.new_context(viewport={'width': 1300, 'height': 1000})
    await ctx.route('**/*', route)
    await ctx.route('https://api.github.com/**', github)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: fejl.append(str(e)) if 'tailwind' not in str(e) else None)
    await pg.goto(URL); await pg.wait_for_timeout(400)
    return pg


def projekter_i_gist():
    return sorted(json.loads(c)['projekt']['navn'] for n, c in GIST.items() if n != 'tavleoversigt.json')


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

        # 6. Synkronisering via Gist mellem to enheder
        pa, pb = await ny_enhed(b), await ny_enhed(b)
        navne = lambda pg: pg.evaluate(f"{A}.projekter.map(p=>p.navn)")
        r = await pa.evaluate(f"""async()=>{{const a={A};a.synkTokenInput='forkert';await a.synkForbind();return {{s:!!a.synk,f:a.synkFejl}}}}""")
        tjek('synk: forkert token afvises', not r['s'] and 'token' in r['f'], r)
        await pa.evaluate(f"""async()=>{{const a={A};a.synkTokenInput='test-token';await a.synkForbind();
          a.pf={{navn:'Synkprojekt',sagsnr:'S1',kunde:'',adresse:''}};a.nytProjekt();await a.synkNu();}}""")
        tjek('synk: nyt projekt sendes, eksempler gør ikke', projekter_i_gist() == ['Synkprojekt'], projekter_i_gist())
        await pb.evaluate(f"""async()=>{{const a={A};a.synkTokenInput='test-token';await a.synkForbind();}}""")
        tjek('synk: anden enhed henter projektet', 'Synkprojekt' in await navne(pb), await navne(pb))
        await pb.evaluate(f"""async()=>{{const a={A};a.skift(a.projekter.find(p=>p.navn==='Synkprojekt').id);a.mutate(()=>{{a.db.projekt.kunde='Rettet på B'}});await a.synkNu();}}""")
        r = await pa.evaluate(f"""async()=>{{const a={A};await a.synkNu();return a.db.projekt.kunde}}""")
        tjek('synk: ændring på B når frem til A (aktivt projekt genindlæst)', r == 'Rettet på B', r)
        await pa.evaluate(f"""async()=>{{const a={A};a.mutate(()=>{{a.db.projekt.kunde='A samtidig'}});}}""")
        await pb.evaluate(f"""async()=>{{const a={A};a.mutate(()=>{{a.db.projekt.kunde='B samtidig'}});await a.synkNu();}}""")
        await pa.evaluate(f"""async()=>{{await {A}.synkNu();}}""")
        r = await pa.evaluate(f"""(()=>{{const a={A};return a.projekter.filter(p=>/Synkprojekt/.test(p.navn)).map(p=>a.laes(p.id).projekt.kunde).sort()}})()""")
        tjek('synk: samtidige ændringer beholder begge udgaver', r == ['A samtidig', 'B samtidig'], r)
        await pb.evaluate(f"""async()=>{{await {A}.synkNu();}}""")
        tjek('synk: konfliktkopien når også B', len([n for n in await navne(pb) if 'Synkprojekt' in n]) == 2, await navne(pb))
        await pa.evaluate(f"""async()=>{{const a={A};a.sletProjekt(a.projekter.find(p=>/fra anden enhed/.test(p.navn)).id);await a.synkNu();}}""")
        await pb.evaluate(f"""async()=>{{await {A}.synkNu();}}""")
        tjek('synk: sletning på A slår igennem på B', [n for n in await navne(pb) if 'Synkprojekt' in n] == ['Synkprojekt'] and len(projekter_i_gist()) == 1, (await navne(pb), projekter_i_gist()))
        foer = dict(GIST)
        GIST['tavleoversigt.json'] = json.dumps({'format': 'tavleoversigt-sync', 'schema': 999})
        r = await pb.evaluate(f"""async()=>{{const a={A};const n=a.projekter.length;a.mutate(()=>{{a.db.projekt.kunde='Må ikke sendes'}});await a.synkNu();return {{f:a.synkFejl,n0:n,n1:a.projekter.length}}}}""")
        uroert = {k: v for k, v in GIST.items() if k != 'tavleoversigt.json'} == {k: v for k, v in foer.items() if k != 'tavleoversigt.json'}
        tjek('synk: ældre version rører ikke Gist med nyere skema', 'nyere version' in r['f'] and uroert and r['n0'] == r['n1'], (r, uroert))
        GIST['tavleoversigt.json'] = foer['tavleoversigt.json']
        r = await pb.evaluate(f"""async()=>{{const a={A};a.synkAfbryd();return {{s:localStorage.getItem('tavleoversigt.sync'),n:a.projekter.length}}}}""")
        tjek('synk: slå fra fjerner token men ikke projekter', r['s'] is None and r['n'] >= 3, r)

        await b.close()

    for navn, ok, info in kontrol:
        print(('OK    ' if ok else 'FEJL  ') + navn + ('' if ok else f'  {info}'))
    for f in fejl:
        print('JS-FEJL ' + f)
    if fejl or not all(ok for _, ok, _ in kontrol):
        sys.exit(1)
    print('OK')


asyncio.run(main())
