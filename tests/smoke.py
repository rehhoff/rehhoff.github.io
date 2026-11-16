"""Røgtest af index.html i headless Chrome.

Kør fra repoets rod:  npm install  &&  python3 tests/smoke.py
Filerne (index.html, css/, js/) serveres fra disken under http://app.test/.
Kræver Python-pakken playwright. Chrome findes via miljøvariablen CHROME,
ellers bruges playwrights egen Chromium (python3 -m playwright install chromium).
Tailwind-CDN'et blokeres, så testen dækker logik og Alpine, ikke layout.
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROD = Path(__file__).resolve().parent.parent
TYPER = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'}
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
        sti = u[len(URL):].split('?')[0].split('#')[0] or 'index.html'
        fil = (ROD / sti).resolve()
        if ROD in fil.parents and fil.is_file():
            await r.fulfill(body=fil.read_bytes(), content_type=TYPER.get(fil.suffix, 'application/octet-stream'))
        else:
            await r.fulfill(status=404, body='')
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
        html = (ROD / 'index.html').read_text(encoding='utf-8')
        forkerte = sorted(set(re.findall(r'\?v=([0-9.]+)', html)) - {r['v']})
        tjek('alle ?v= i index.html svarer til APP_VERSION', not forkerte and '?v=' + r['v'] in html, (r['v'], forkerte))

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

        # 3b. Iz efter DS/HD 60364-5-52 anneks B: tabelværdier og korrektionsfaktorer
        r = await pg.evaluate(f"""(()=>{{const a={A};const F=(m,t,n,l)=>({{metode:m,jord:m[0]==='D',temp:t,samlet:n,lag:l||'bundt'}});
          const z=(k,tv,tre,f)=>a.izBeregn(k,tv,tre,f||F('C',30,1));
          return [z('PVC',2.5,false),z('PVC',2.5,true),z('XLPE',2.5,false),z('Brandkabel',2.5,true),z('PKAJ',1.5,false,F('A1',30,1)),z('PVC',10,true,F('E',30,1)),
            z('XLPE',16,false,F('D1',20,1)),z('XLPE',4,true,F('B2',30,1)),z('PVC',2.5,false,F('C',40,1)),z('XLPE',2.5,false,F('C',40,1)),z('PVC',2.5,false,F('C',30,3)),
            z('PVC',2.5,false,F('C',40,3)),z('PVC',2.5,false,F('C',30,4,'bakke')),z('PVC',2.5,false,F('D1',30,2)),z('PVC',2.5,false,F('C',30,25)),a.izBeregn('PVC',2.5,false),
            a.forhold(null).metode+a.forhold(null).temp+a.forhold(null).samlet+a.forhold(null).lag]}})()""")
        forventet = [27, 24, 33, 30, 14.5, 60, 91, 35, 23.5, 30, 18.9, 16.4, 20.8, 21.9, 10.3, 27, 'C301bundt']
        tjek('Iz: normværdier og korrektionsfaktorer (B.52.2–B.52.5, B.52.10/12, B.52.14/15, B.52.17/19)', r == forventet, list(zip(forventet, r)))

        # 3c. Regression: eksempelprojekterne med standardforhold (C, 30 °C, 1 kreds) som før skema 10.
        #     PVC, PKAJ og PKL uændret; XLPE og brandkabel bruger nu XLPE-tabellen (B.52.3/B.52.5). ΔU, forslag og advarsler uændrede.
        base = json.loads((ROD / 'tests' / 'regression-skema9.json').read_text(encoding='utf-8'))
        ny = await pg.evaluate(f"""(()=>{{const a={A};const aktiv=a.aktivId||null, out={{}};const før=a.projekter.find(p=>p.id===a.aktiv)||null;
          for (const p of a.projekter.slice()) {{ a.skift(p.id); const d=a.db;
            out[d.projekt.navn]={{e:Object.fromEntries(d.enheder.map(e=>[e.id,[a.iz(e),+a.du(e).toFixed(9),e.kabel,a.forslag(e),a.izTabel(e.kabel,e.tv,a.tre(e),'C')]])),
              d:Object.fromEntries(d.daaser.map(x=>[x.id,[a.daaseIz(x),x.kabel,a.izTabel(x.kabel,x.tv,(a.gruppe(x.gruppeId)||{{}}).faser==3,'C')]])),
              t:Object.fromEntries(d.tavler.map(t=>[t.id,[a.tilgIz(t),t.tKabel,Number(t.tLaengde)>0?a.izTabel(t.tKabel,t.tTv,a.tilg3(t),'C'):0]])),
              w:a.warnings().map(w=>w.k+'|'+w.txt)}}; }}
          if (a.projekter[0]) a.skift(a.projekter[0].id); return out}})()""")
        afvig = []
        for navn, b0 in base.items():
            n0 = ny.get(navn)
            if not n0: afvig.append(('mangler', navn)); continue
            for i, (iz, du, kab, fs) in b0['e'].items():
                iz1, du1, kab1, fs1, tab = n0['e'][i]
                if du1 != du or fs1 != fs or iz1 != (tab if kab in ('XLPE', 'Brandkabel') else iz): afvig.append((navn, i, b0['e'][i], n0['e'][i]))
            for k in 'dt':
                for i, (iz, kab) in b0[k].items():
                    iz1, kab1, tab = n0[k][i]
                    if iz1 != (tab if kab in ('XLPE', 'Brandkabel') else iz): afvig.append((navn, k, i, b0[k][i], n0[k][i]))
            if n0['w'] != b0['w']: afvig.append((navn, 'advarsler', b0['w'], n0['w']))
        tjek('regression: eksempelprojekter giver samme Iz (PVC), ΔU, forslag og advarsler', not afvig and len(base) >= 2, afvig[:5])

        # 3d. Forhold på gruppen slår igennem på Iz og kabelforslag
        r = await pg.evaluate(f"""(()=>{{const a={A};const e=a.db.enheder.find(x=>x.kabel==='PVC'&&Number(x.effekt)>0&&a.gruppe(x.gruppeId));const g=a.gruppe(e.gruppeId);
          const z0=a.iz(e), gem=[g.metode,g.temp,g.samlet,g.lag]; g.metode='A2'; g.temp=45; g.samlet=6; const z1=a.iz(e), forv=a.izTabel(e.kabel,e.tv,a.tre(e),'A2');
          const s=a.forslag(e); [g.metode,g.temp,g.samlet,g.lag]=gem; return {{z0, z1, k:Math.round(forv*0.79*0.57*10)/10, s, tv:e.tv, z2:a.iz(e)}}}})()""")
        tjek('Iz: gruppens metode, temperatur og samlet fremføring bruges', r['z1'] == r['k'] and r['z2'] == r['z0'] and r['z1'] < r['z0'], r)

        # Beskeder i bunden
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));a.toasts.slice().forEach(t=>a.lukToast(t.id));
          ['en','to','tre','fire','fire'].forEach(t=>a.say(t));const tre=a.toasts.map(t=>t.txt);
          a.toasts.slice().forEach(t=>a.lukToast(t.id));a.say('Kort');a.say('Fejl',false,true);const foer=a.toasts.length;
          await T(3800);const efter=a.toasts.map(t=>t.txt);a.lukToast(a.toasts[0].id);
          return {{tre,foer,efter,tom:a.toasts.length,dom:document.querySelectorAll('[role=alert],[role=status]').length}}}}""")
        tjek('beskeder: højst tre, ingen dubletter, fejl bliver stående, × lukker',
             r['tre'] == ['to', 'tre', 'fire'] and r['foer'] == 2 and r['efter'] == ['Fejl'] and r['tom'] == 0, r)

        # 4. Opgradering: data uden skema bevares, og der tages backup
        await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));delete i.schema;
          const id=i.aktiv;const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Testprojekt før opgradering';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"(()=>{{const a={A};return {{navn:a.db.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema}}}})()")
        tjek('opgradering bevarer projekt og laver backup', r['navn'] == 'Testprojekt før opgradering' and r['b'] == 1 and r['s'], r)

        # 4b. Opgradering fra skema 9: projekter intakte, backup taget, nye felter med standardværdier
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=9;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));
          for (const k of ['metode','temp','jtemp','samlet','lag']) delete p.projekt[k];
          p.grupper.forEach(g=>{for (const k of ['metode','temp','samlet','lag']) delete g[k];}); p.tavler.forEach(t=>{for (const k of ['tMetode','tTemp','tSamlet','tLag']) delete t[k];});
          if (p.grupper[0]) { p.grupper[0].metode='X9'; p.grupper[0].temp=33; p.grupper[0].samlet='to'; }
          p.projekt.navn='Skema 9-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {id, enheder:JSON.stringify(p.enheder), daaser:JSON.stringify(p.daaser), ng:p.grupper.length, nt:p.tavler.length}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const p=a.db.projekt, g=a.db.grupper, t=a.db.tavler;
          return {{navn:p.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, std:[p.metode,p.temp,p.jtemp,p.samlet,p.lag],
            g:g.every(x=>x.metode===''&&x.temp===''&&x.samlet===''&&x.lag===''), t:t.every(x=>x.tMetode===''&&x.tTemp===''&&x.tSamlet===''&&x.tLag===''),
            enheder:JSON.stringify(a.db.enheder), daaser:JSON.stringify(a.db.daaser), ng:g.length, nt:t.length,
            bak:(JSON.parse(localStorage.getItem('tavleoversigt.backups'))||[]).length}}}})()""")
        tjek('opgradering fra skema 9: backup, standardforhold og data intakte',
             r['navn'] == 'Skema 9-projekt' and r['b'] >= 1 and r['s'] == 10 and r['std'] == ['C', 30, 20, 1, 'bundt'] and r['g'] and r['t']
             and r['ng'] == r0['ng'] and r['nt'] == r0['nt'] and r['enheder'] == r0['enheder'] and r['daaser'] == r0['daaser'],
             {k: v for k, v in r.items() if k not in ('enheder', 'daaser')} | {'enheder ens': r['enheder'] == r0['enheder'], 'daaser ens': r['daaser'] == r0['daaser']})

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
        r = await pb.evaluate(f"(()=>{{const a={A};return {{t:a.toasts.map(t=>t.txt),h:a.synkTxt()}}}})()")
        tjek('synk: ingen rutinebesked, tid vises i hovedet', not any('Synkroniseret:' in t for t in r['t']) and 'synkroniseret kl.' in r['h'], r)
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
