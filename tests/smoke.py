"""Røgtest af index.html i headless Chrome.

Kør fra repoets rod:  npm install  &&  python3 tests/smoke.py
Filerne (index.html, css/, js/) serveres fra disken under http://app.test/.
Kræver Python-pakken playwright. Chrome findes via miljøvariablen CHROME,
ellers bruges playwrights egen Chromium (python3 -m playwright install chromium).
css/tailwind.css skal være bygget efter seneste ændring (tools/byg_css.py --tjek).
"""
import asyncio, functools, http.server, json, os, re, subprocess, sys, threading
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
    r = subprocess.run([sys.executable, str(ROD / 'tools' / 'byg_css.py'), '--tjek'], capture_output=True, text=True)
    tjek('css/tailwind.css er bygget efter seneste ændring', r.returncode == 0, (r.stdout + r.stderr).strip())
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
        sw = (ROD / 'sw.js').read_text(encoding='utf-8')
        sw_v = re.search(r"const VERSION = '([0-9.]+)'", sw).group(1)
        filer = sorted(set(re.findall(r'(?:href|src)="((?:css|js)/[^"?]+)\?v=', html)))
        mangler = [f for f in filer if "'" + f + "' + V" not in sw]
        tjek('sw.js: VERSION = APP_VERSION, og alle app-filer gemmes til brug offline', sw_v == r['v'] and filer and not mangler, (sw_v, mangler))

        # 2. Alle faner og formularer
        for k in '1234567890':
            await pg.keyboard.press(k); await pg.wait_for_timeout(60)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));
          const typer=[['tavle',a.db.tavler[0]],['rcd',a.db.rcds[0]],['lokale',a.db.lokaler[0]],['gruppe',a.db.grupper[0]],['enhed',a.db.enheder[0]],
            ['daase',a.db.daaser[0]],['afbryder',a.db.afbrydere[0]],['rack',a.db.racks[0]],['udstyr',a.db.udstyr[0]],['link',a.db.links[0]]];
          for (const [t,o] of typer) {{ a.openForm(t,o); await T(60); a.modal=null; await T(40); a.openForm(t); await T(60); a.modal=null; await T(40); }}
          return {{sld:a.sld(true).length, doc:a.docHtml().length, bak:JSON.parse(a.backupJson()).projekter.length, spor:a.spor('e:'+a.db.enheder[0].id).length}}}}""")
        tjek('diagrammer, dokumentation og backup kan bygges', r['sld'] > 1000 and r['doc'] > 1000 and r['bak'] >= 2 and r['spor'] >= 2, r)

        # 2b. Regression: eksempelprojekternes tændingsdiagrammer er uændrede (optaget i version 10.3.0, før krydsafbryderen)
        base = json.loads((ROD / 'tests' / 'regression-taending.json').read_text(encoding='utf-8'))
        ny = await pg.evaluate(f"""(()=>{{const a={A};const out={{}};a.sim={{}};
          for (const p of a.projekter.slice()) {{ a.skift(p.id); out[a.db.projekt.navn]=Object.fromEntries(a.db.afbrydere.map(x=>[x.id,a.taendSvg(x)])); }}
          if (a.projekter[0]) a.skift(a.projekter[0].id); return out}})()""")
        afvig = [(n, i) for n, b0 in base.items() for i, svg in b0.items() if ny.get(n, {}).get(i) != svg]
        tjek('regression: eksempelprojekternes tændingsdiagrammer er uændrede', not afvig and sum(len(v) for v in base.values()) >= 6 and all(n in ny for n in base), afvig)

        # 2c. Krydsafbryder med 3 og 4 steder: oprettes i formularen, og hvert klik på et betjeningssted skifter lyset
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const ud={{}};a.go('taending');
          const g=a.db.grupper.find(x=>x.type==='lys'&&a.enhederFor(x.id).length), lampe=a.enhederFor(g.id)[0].id;
          for (const n of [3,4]) {{
            a.openForm('afbryder',null,{{art:'kryds'}});await T(60);Object.assign(a.form,{{navn:'Kryds '+n,gruppeId:g.id,steder:n,a:[lampe]}});a.saveForm();await T(60);
            const af=a.db.afbrydere.find(x=>x.navn==='Kryds '+n), svg=a.taendSvg(af), lys=[a.lit(af).a];
            const klik=i=>a.taendKlik({{target:{{closest:()=>({{getAttribute:()=>af.id+':'+i}})}}}});
            for (let omgang=0;omgang<2;omgang++) for (let i=0;i<n;i++) {{ klik(i); lys.push(a.lit(af).a); }}
            for (const i of [n-1,0,1,1,n-2,0]) {{ klik(i); lys.push(a.lit(af).a); }}
            ud[n]={{art:af.art,steder:af.steder,felter:(svg.match(/data-t="/g)||[]).length,lys,taendt:a.taendSvg(af).includes('lamp on')===a.lit(af).a,
              statisk:!a.taendSvg(af,true).includes('data-t')&&!a.taendSvg(af,true).includes('lamp on')}};
          }}
          a.openForm('afbryder',null,{{art:'kryds'}});await T(60);Object.assign(a.form,{{navn:'Kryds lav',gruppeId:g.id,steder:1,a:[]}});a.saveForm();await T(60);
          ud.lav=a.db.afbrydere.find(x=>x.navn==='Kryds lav').steder;
          ud.norm=[norm({{afbrydere:[{{id:'x',art:'kryds',steder:1}}]}}).afbrydere[0].steder,norm({{afbrydere:[{{id:'x',art:'kryds',steder:9}}]}}).afbrydere[0].steder,
            norm({{afbrydere:[{{id:'x',art:'kip',steder:4}}]}}).afbrydere[0].steder,norm({{afbrydere:[{{id:'x',art:'korr',steder:2}}]}}).afbrydere[0].steder];
          ud.tekst=!!a.afbArt.kryds&&!!a.afbPrincip.kryds&&a.afbLedere.kryds.length===2&&a.afbIkon('kryds').includes('<path');
          ud.dom=document.querySelectorAll('.tsv svg').length>=a.db.afbrydere.length;return ud}}""")
        skifter = lambda l: l[0] is False and all(x != y for x, y in zip(l, l[1:]))
        tjek('krydsafbryder: 3 og 4 steder, hvert klik skifter lyset, steder holdes på 3–6',
             all(r[n]['art'] == 'kryds' and r[n]['steder'] == int(n) and r[n]['felter'] == int(n) and skifter(r[n]['lys']) and len(r[n]['lys']) == 2 * int(n) + 7
                 and r[n]['taendt'] and r[n]['statisk'] for n in ('3', '4')) and r['lav'] == 3 and r['norm'] == [3, 6, 4, 2] and r['tekst'] and r['dom'], r)

        # 2d. Afbrydere i enstregsdiagrammet (også i SVG-eksporten), sporing og et tændingsdiagram pr. afbryder i dokumentationen
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, sld=a.sld(true), doc=a.docHtml();
          const medGruppe=d.afbrydere.filter(x=>a.gruppe(x.gruppeId)), af=d.afbrydere.find(x=>x.a.length&&a.gruppe(x.gruppeId)), los=d.afbrydere.find(x=>x.navn==='Kryds lav');
          a.sporTil('a:'+af.id);await T(250);const el=document.querySelector('.sld [data-k="a:'+af.id+'"]'), info=a.sldInfo();
          const lampeRk=document.querySelector('.sld [data-k="e:'+af.a[0]+'"]');
          return {{n:d.afbrydere.length, iSld:medGruppe.filter(x=>sld.includes('data-k="a:'+x.id+'"')).length, medGruppe:medGruppe.length, losRk:sld.includes('ingen lamper valgt'),
            diagrammer:(doc.match(/<svg[^>]*class="ts"/g)||[]).length, afsnit:doc.includes('<h1>Tændingsdiagrammer</h1>'), docKlik:doc.includes('data-t='),
            navne:d.afbrydere.every(x=>doc.split('<h1>Tændingsdiagrammer</h1>')[1].includes('<h2>'+x.navn.replace(/&/g,'&amp;')+'</h2>')),
            sporA:a.spor('a:'+af.id).map(x=>x.key), sporE:a.spor('e:'+af.a[0]).map(x=>x.key), valgt:!!el&&el.classList.contains('on'), lampeTr:!!lampeRk&&lampeRk.classList.contains('tr'),
            info:info&&[info.art,info.type,info.obj.id===af.id], id:af.id, lampe:af.a[0], gid:af.gruppeId, losId:los.id, losSld:sld.includes('data-k="a:'+los.id+'"')}}}}""")
        tjek('enstregsdiagram viser afbryderne, og sporing virker for afbrydere',
             r['iSld'] == r['medGruppe'] >= 8 and r['losRk'] and r['losSld'] and r['sporA'][-1] == 'a:' + r['id'] and 'g:' + r['gid'] in r['sporA']
             and r['sporE'][-2:] == ['a:' + r['id'], 'e:' + r['lampe']] and r['valgt'] and r['lampeTr'] and r['info'] == ['Afbryder', 'afbryder', True], r)
        tjek('dokumentationen har et tændingsdiagram pr. afbryder', r['afsnit'] and r['diagrammer'] == r['n'] >= 9 and r['navne'] and not r['docKlik'], r)

        # Materialeliste
        r = await pg.evaluate(f"""(()=>{{const a={A};const m=a.materialer();const g=n=>m.find(x=>x.gruppe===n)||{{linjer:[]}};const sum=n=>g(n).linjer.reduce((s,l)=>s+l.antal,0);
          const tot=a.sumLen(a.db.enheder.concat(a.db.daaser).map(e=>({{e}})))+a.db.tavler.reduce((s,t)=>s+(Number(t.tLaengde)||0),0);
          const tsv=a.materialeTsv().split('\\n');const n=m.reduce((s,x)=>s+x.linjer.length,0);
          return {{kabel:sum('Kabler'),tot,linjer:g('Kabler').linjer.length,sik:sum('Automatsikringer'),gr:a.db.grupper.length,rcd:sum('HPFI'),rc:a.db.rcds.length,
          datakabel:g('Kabler').linjer.some(l=>/Cat|Fiber/.test(l.tekst)),data:g('Datakabler').linjer.length,tsv:tsv.length,n,hoved:tsv[0],tom:m.some(x=>!x.linjer.length)}}}})()""")
        tjek('materialeliste: kabellængder, sikringer og HPFI stemmer med projektet, datakabler for sig, TSV har overskrift og én linje pr. materiale',
             r['kabel'] >= r['tot'] > 0 and r['kabel'] < r['tot'] + r['linjer'] and r['sik'] == r['gr'] and r['rcd'] == r['rc'] and not r['datakabel']
             and r['data'] >= 1 and r['tsv'] == r['n'] + 1 and r['hoved'] == 'Gruppe\tMateriale\tAntal\tEnhed' and not r['tom'], r)

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

        # Vurdering af målinger
        r = await pg.evaluate(f"""(()=>{{const a={A};const g=a.db.grupper.find(x=>a.rcd(x));const gem=JSON.stringify(g);
          Object.assign(g,{{kar:'B',In:10}});g.maal={{riso:'>999',zs:'3,0',rcd:'25',ok:true}};const ok=a.maalVurdering(g);
          g.maal.zs='3,1';const over=a.maalVurdering(g);const adv=a.warnings().some(w=>w.k==='m'+g.id);
          g.maal={{riso:'0,5',zs:'',rcd:'350',ok:false}};const flere=a.maalVurdering(g);
          const rcdId=g.rcdId;g.rcdId='';g.maal={{riso:'2',zs:'1',rcd:'999',ok:true}};const udenRcd=a.maalVurdering(g);g.rcdId=rcdId;
          const c16=a.zsMax({{kar:'C',In:16}});Object.assign(g,JSON.parse(gem));
          return {{b10:Math.round(a.zsMax({{kar:'B',In:10}})*100)/100,c16:Math.round(c16*100)/100,ok:ok.status,over:over.status,adv,
                   flere:[flere.riso,flere.rcd,flere.status],uden:[udenRcd.rcd,udenRcd.status]}}}})()""")
        tjek('målinger: Zs-grænse 2/3·U0/Ia, HPFI 300 ms, Riso 1 MΩ, advarsel ved fejl',
             r['b10'] == 3.07 and r['c16'] == 0.96 and r['ok'] == 'ok' and r['over'] == 'fejl' and r['adv']
             and r['flere'] == [False, False, 'fejl'] and r['uden'] == [None, 'ok'], r)

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
             r['navn'] == 'Skema 9-projekt' and r['b'] >= 1 and r['s'] == 11 and r['std'] == ['C', 30, 20, 1, 'bundt'] and r['g'] and r['t']
             and r['ng'] == r0['ng'] and r['nt'] == r0['nt'] and r['enheder'] == r0['enheder'] and r['daaser'] == r0['daaser'],
             {k: v for k, v in r.items() if k not in ('enheder', 'daaser')} | {'enheder ens': r['enheder'] == r0['enheder'], 'daaser ens': r['daaser'] == r0['daaser']})

        # 4c. Opgradering fra skema 10: afbrydere i det gamle format (uden krydsafbryder) er intakte, og der tages backup
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=10;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.afbrydere=p.afbrydere.filter(a=>a.art!=='kryds');p.projekt.navn='Skema 10-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {afb:JSON.stringify(p.afbrydere), n:p.afbrydere.length, enheder:JSON.stringify(p.enheder), arter:[...new Set(p.afbrydere.map(a=>a.art))].sort()}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};return {{navn:a.db.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema,
            afb:JSON.stringify(a.db.afbrydere), enheder:JSON.stringify(a.db.enheder), svg:a.db.afbrydere.every(x=>a.taendSvg(x).length>500&&a.taendSvg(x,true).length>500)}}}})()""")
        tjek('opgradering fra skema 10: backup taget, afbrydere og brugsgenstande intakte',
             r['navn'] == 'Skema 10-projekt' and r['b'] >= 1 and r['s'] == 11 and r['afb'] == r0['afb'] and r['enheder'] == r0['enheder'] and r['svg']
             and r0['n'] >= 6 and r0['arter'] == ['enpolet', 'kip', 'korr', 'krone', 'sensor', 'trappe'],
             {'navn': r['navn'], 'b': r['b'], 's': r['s'], 'afb ens': r['afb'] == r0['afb'], 'enheder ens': r['enheder'] == r0['enheder'], 'n': r0['n'], 'arter': r0['arter']})

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
        r = await pb.evaluate(f"""async()=>{{const a={A};Object.defineProperty(navigator,'onLine',{{configurable:true,get:()=>false}});
          a.synkFejl='';await a.synkNu();const r={{f:a.synkFejl,t:a.synkTxt()}};delete navigator.onLine;a.online=true;return r}}""")
        tjek('synk: uden net ingen fejl, status viser offline', r['f'] == '' and 'offline' in r['t'], r)
        r = await pb.evaluate(f"""async()=>{{const a={A};a.synkAfbryd();return {{s:localStorage.getItem('tavleoversigt.sync'),n:a.projekter.length}}}}""")
        tjek('synk: slå fra fjerner token men ikke projekter', r['s'] is None and r['n'] >= 3, r)

        # Mobil: 390 px bred telefon
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        await ctx.route('**/*', route)
        pm = await ctx.new_page()
        pm.on('pageerror', lambda e: fejl.append('mobil: ' + str(e)))
        await pm.goto(URL); await pm.wait_for_timeout(500)
        r = await pm.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const ud={{}};
          for (const v of a.views.map(v=>v.id)) {{ a.go(v); await T(120); if (document.documentElement.scrollWidth > innerWidth) ud.bred = (ud.bred||[]).concat(v); }}
          a.go('dokumentation'); await T(150);
          const tops = new Set([...document.querySelectorAll('.tab')].map(t=>Math.round(t.getBoundingClientRect().top)));
          const g = a.db.grupper[0], inp = document.getElementById('kmz-'+g.id);
          inp.value = '0,5'; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change')); await T(80);
          return {{bred:ud.bred||[], navn:Math.round(document.getElementById('p-navn').getBoundingClientRect().width), faneRaekker:tops.size,
                  kortSynligt:inp.offsetParent!==null, tabelSkjult:document.getElementById('mz-'+g.id).offsetParent===null, gemt:g.maal.zs,
                  skrift:parseFloat(getComputedStyle(document.getElementById('gs')).fontSize)}}}}""")
        tjek('mobil: ingen vandret rulning, fuld bredde til navnet, faner på én række, måleskema som kort, 16 px i felter',
             not r['bred'] and r['navn'] >= 330 and r['faneRaekker'] == 1 and r['kortSynligt'] and r['tabelSkjult'] and r['gemt'] == '0,5' and r['skrift'] >= 16, r)
        await ctx.close()

        # 7. Offline-app: service worker på localhost (kræver https eller localhost)
        class Stille(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Stille, directory=str(ROD)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        lok = 'http://127.0.0.1:%d/' % srv.server_address[1]
        async def lok_route(r):
            u = r.request.url
            if 'alpinejs' in u: await r.fulfill(body=ALPINE.read_text(encoding='utf-8'), content_type='application/javascript', headers={'access-control-allow-origin': '*'})
            elif u.startswith(lok): await r.continue_()
            else: await r.abort()
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}, service_workers='allow')
        await ctx.route('**/*', lok_route)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: fejl.append('offline: ' + str(e)))
        await pg.goto(lok); await pg.wait_for_timeout(500)
        klar = await pg.evaluate("navigator.serviceWorker.ready.then(()=>new Promise(f=>setTimeout(()=>f(!!navigator.serviceWorker.controller),300)))")
        if not klar:
            await pg.reload(); await pg.wait_for_timeout(500)
            klar = await pg.evaluate("!!navigator.serviceWorker.controller")
        foer = await pg.evaluate(f"(()=>{{const a={A};return [a.appVersion, a.projekter.length, a.swOk]}})()")
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(800)
        efter = await pg.evaluate(f"(()=>{{const a={A};return [a.appVersion, a.projekter.length, a.online, a.db.grupper.length > 0, getComputedStyle(document.querySelector('header')).display]}})()")
        tjek('offline: appen starter uden net med samme version, projekter og styling', klar and foer[2] and efter[:2] == foer[:2] and efter[2] is False and efter[3] and efter[4] == 'flex', (klar, foer, efter))
        await ctx.set_offline(False); await ctx.close(); srv.shutdown()

        await b.close()

    for navn, ok, info in kontrol:
        print(('OK    ' if ok else 'FEJL  ') + navn + ('' if ok else f'  {info}'))
    for f in fejl:
        print('JS-FEJL ' + f)
    if fejl or not all(ok for _, ok, _ in kontrol):
        sys.exit(1)
    print('OK')


asyncio.run(main())
