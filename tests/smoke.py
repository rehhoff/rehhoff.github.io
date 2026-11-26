"""Røgtest af index.html i headless Chrome.

Kør fra repoets rod:  npm install  &&  python3 tests/smoke.py
Filerne (index.html, css/, js/) serveres fra disken under http://app.test/.
Kræver Python-pakken playwright. Chrome findes via miljøvariablen CHROME,
ellers bruges playwrights egen Chromium (python3 -m playwright install chromium).
css/tailwind.css skal være bygget efter seneste ændring (tools/byg_css.py --tjek).
"""
import asyncio, base64, functools, http.server, json, os, re, subprocess, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROD = Path(__file__).resolve().parent.parent
TYPER = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'}
ALPINE = ROD / 'node_modules' / 'alpinejs' / 'dist' / 'cdn.min.js'
URL = 'http://app.test/'
SKEMA = int(re.search(r'SCHEMA = (\d+)', (Path(__file__).resolve().parent.parent / 'js' / 'data.js').read_text(encoding='utf-8')).group(1))  # SCHEMA i js/data.js
fejl, kontrol = [], []
# Tidsgrænser, så en test, der hænger, fejler med en besked i stedet for at vente (forslag 17).
TRIN_MS = int(os.environ.get('SMOKE_TRIN_MS', '15000'))   # pr. Playwright-handling (klik, navigation, popup …)
SAMLET_S = int(os.environ.get('SMOKE_SAMLET_S', '300'))   # hele kørslen


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
BGISTS = {'g2': {}}  # billed-Gists (skema 15). Den første hedder g2, de næste g3, g4 … (forslag 21)
BGIST = BGISTS['g2']
BPATCH = []      # filnavne i hver PATCH til en billed-Gist
PGISTS = {}      # andre projekt-Gists på kontoen, fx fra en anden enhed (oprydning, forslag 20)
RAW_FEJL = set() # raw_url-stier, der svarer med fejl
BFIL = 'tavleoversigt-billeder.json'
VERSIONER = []  # [(sha, tid, kopi af GIST)], ældste først, som GitHub gemmer dem
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, accept',
        'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS'}


def gist_json(filer=None, gid='g1'):
    filer = GIST if filer is None else filer
    return {'id': gid, 'files': {n: {'filename': n, 'content': c, 'truncated': False, 'raw_url': 'https://gist.test/raw/' + gid + '/' + n}
                                 for n, c in filer.items()}}


def gist_liste():
    # som GitHub: listen har filnavne, størrelse og raw_url, men ikke indholdet
    ud = []
    for gid, filer in [('g1', GIST)] + list(BGISTS.items()) + list(PGISTS.items()):
        if filer: ud.append({'id': gid, 'files': {n: {'filename': n, 'size': len(c), 'raw_url': 'https://gist.test/raw/' + gid + '/' + n} for n, c in filer.items()}})
    return ud


async def gist_raw(r):
    gid, navn = r.request.url.split('/raw/', 1)[1].split('/', 1)
    filer = ({'g1': GIST} | BGISTS | PGISTS).get(gid, {})
    if gid + '/' + navn in RAW_FEJL: await r.fulfill(status=500, headers=CORS, body='')
    elif navn in filer: await r.fulfill(status=200, headers=CORS, content_type='text/plain', body=filer[navn])
    else: await r.fulfill(status=404, headers=CORS, body='')


def ny_version():
    VERSIONER.append(('v%03d' % len(VERSIONER), '2026-11-16T%02d:%02d:00Z' % (8 + len(VERSIONER) // 60, len(VERSIONER) % 60), dict(GIST)))


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
        return await svar(gist_liste())
    if sti == '/gists' and req.method == 'POST':
        filer = json.loads(req.post_data)['files']
        if BFIL in filer:
            gid = 'g2' if not BGISTS['g2'] else 'g%d' % (len(BGISTS) + 2)
            BGISTS.setdefault(gid, {}).update({n: f['content'] for n, f in filer.items()})
            return await svar(gist_json(BGISTS[gid], gid), 201)
        GIST.update({n: f['content'] for n, f in filer.items()})
        ny_version()
        return await svar(gist_json(), 201)
    if sti == '/gists/g1' and req.method == 'GET':
        return await svar(gist_json())
    if sti == '/gists/g1' and req.method == 'PATCH':
        for n, f in json.loads(req.post_data)['files'].items():
            if f is None: GIST.pop(n, None)
            else: GIST[n] = f['content']
        ny_version()
        return await svar(gist_json())
    m = re.fullmatch(r'/gists/(g\d+)', sti)
    if m and m[1] in BGISTS and req.method == 'PATCH':
        filer, bg = json.loads(req.post_data)['files'], BGISTS[m[1]]
        BPATCH.append(sorted(filer))
        for n, f in filer.items():
            if f is None: bg.pop(n, None)
            else: bg[n] = f['content']
        return await svar(gist_json(bg, m[1]))
    if m and m[1] in PGISTS and req.method == 'GET':
        return await svar(gist_json(PGISTS[m[1]], m[1]))
    if sti.startswith('/gists/g1/commits'):
        return await svar([{'version': v, 'committed_at': t} for v, t, _ in reversed(VERSIONER)])
    for v, t, filer in VERSIONER:
        if sti == '/gists/g1/' + v:
            return await svar(gist_json(filer))
    await svar({'message': 'Not Found'}, 404)


TESTBILLEDE = """(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1800;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,2400,1800);g.addColorStop(0,'#c33');g.addColorStop(.5,'#3c6');g.addColorStop(1,'#36c');x.fillStyle=g;x.fillRect(0,0,2400,1800);
  let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<600;i++){x.fillStyle='hsl('+Math.floor(r()*360)+',60%,'+Math.floor(30+r()*40)+'%)';x.fillRect(r()*2400,r()*1800,10+r()*160,10+r()*160);}
  x.fillStyle='#000';x.font='140px sans-serif';x.fillText('Brandlukning 1',300,900);return c.toDataURL('image/png').split(',')[1]})()"""


async def ny_enhed(b):
    ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}); ctx.set_default_timeout(TRIN_MS)
    await ctx.route('**/*', route)
    await ctx.route('https://api.github.com/**', github)
    await ctx.route('https://gist.test/**', gist_raw)
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
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}, accept_downloads=True); ctx.set_default_timeout(TRIN_MS)
        await ctx.route('**/*', route)
        pg = await ctx.new_page()
        # Gemningen til localStorage er udskudt (højst 300 ms, se gemNu() i js/lagring.js). Før hvert tjek skrives det ventende, så testen ser det samme som efter en pause
        _eval = pg.evaluate
        async def _eval_gem(*a, **k):
            await _eval("()=>{try{Alpine.$data(document.querySelector('[x-data]')).gemNu()}catch(e){}}")
            return await _eval(*a, **k)
        pg.evaluate = _eval_gem
        pg.on('pageerror', lambda e: fejl.append(str(e)) if 'tailwind' not in str(e) else None)
        pg.on('console', lambda m: fejl.append(m.text[:300]) if m.type == 'error' and 'ERR_' not in m.text and 'tailwind' not in m.text.lower() else None)

        # 1. Første start med eksempeldata
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"(()=>{{const a={A};return {{n:a.projekter.length, v:a.appVersion, w:a.warnings().length}}}})()")
        tjek('starter med eksempelprojekter', r['n'] >= 2, r)
        # Udskudt gemning (ydelse): en ændring ligger straks i MEM, kommer i localStorage senest efter 300 ms, og skrives med det samme ved pagehide
        rg = await _eval(f"""(async()=>{{const a={A}, k='tavleoversigt.p.'+a.pid, T=n=>new Promise(f=>setTimeout(f,n)); const o={{}}, navn0=a.db.projekt.navn;
          const les=()=>JSON.parse(localStorage.getItem(k)).projekt.navn;
          a.mutate(()=>{{a.db.projekt.navn='Gemt-test 1';}}); o.straks=[MEM[a.pid].includes('Gemt-test 1'), les()===navn0]; await T(450); o.efter=les()==='Gemt-test 1';
          a.mutate(()=>{{a.db.projekt.navn='Gemt-test 2';}}); window.dispatchEvent(new Event('pagehide')); o.hide=les()==='Gemt-test 2';
          a.mutate(()=>{{a.db.projekt.navn=navn0;}}); a.gemNu(); o.nu=les()===navn0; return o}})()""")
        tjek('gemning: ændringen er straks i MEM, i localStorage senest efter 300 ms og straks ved pagehide og gemNu()', rg['straks'] == [True, True] and rg['efter'] and rg['hide'] and rg['nu'], rg)
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
            ['daase',a.db.daaser[0]],['afbryder',a.db.afbrydere[0]],['rack',a.db.racks[0]],['udstyr',a.db.udstyr[0]],['link',a.db.links[0]],['brand',a.db.brandlukninger[0]]];
          for (const [t,o] of typer) {{ a.openForm(t,o); await T(60); a.modal=null; await T(40); a.openForm(t); await T(60); a.modal=null; await T(40); }}
          return {{sld:a.sld(true).length, doc:a.docHtml().length, bak:JSON.parse(a.backupJson()).projekter.length, spor:a.spor('e:'+a.db.enheder[0].id).length}}}}""")
        tjek('diagrammer, dokumentation og backup kan bygges', r['sld'] > 1000 and r['doc'] > 1000 and r['bak'] >= 2 and r['spor'] >= 2, r)

        # 2a. Omdøb projekt (aktivt og ikke aktivt) i dialogen Projekter, og flueben for trukket kabel i Lokaler
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          const akt=a.pid, anden=a.projekter.find(p=>p.id!==akt).id, n1=a.db.projekt.navn, n2=a.projekter.find(p=>p.id===anden).navn;
          const knap=(li,t)=>[...li.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
          const rk=id=>[...document.querySelectorAll('[role=dialog] li')][a.projekter.findIndex(p=>p.id===id)];
          a.aabnProjekter(); await T(80);
          knap(rk(anden),'Omdøb').click(); await T(80); let inp=document.getElementById('omd-navn'); o.fokus=document.activeElement===inp;
          inp.value='  Omdøbt anden  '; inp.dispatchEvent(new Event('input')); knap(rk(anden),'Gem').click(); await T(80);
          o.anden=[a.projekter.find(p=>p.id===anden).navn, JSON.parse(localStorage.getItem('tavleoversigt.p.'+anden)).projekt.navn, a.pid===akt];
          knap(rk(akt),'Omdøb').click(); await T(80); inp=document.getElementById('omd-navn'); inp.value=''; inp.dispatchEvent(new Event('input')); knap(rk(akt),'Gem').click(); await T(80);
          o.tomAfvist=a.db.projekt.navn===n1 && a.omd.id===akt;
          inp.value='Omdøbt aktiv'; inp.dispatchEvent(new Event('input')); knap(rk(akt),'Gem').click(); await T(80);
          o.akt=[a.db.projekt.navn, a.projekter.find(p=>p.id===akt).navn, JSON.parse(localStorage.getItem('tavleoversigt.p.'+akt)).projekt.navn, document.getElementById('p-navn').value];
          a.undo(); await T(50); o.fortrudt=a.db.projekt.navn===n1;
          a.modal=null; a.gemNu(); const d=a.laes(anden); d.projekt.navn=n2; a.skriv(anden,d); a.projekter.splice(a.projekter.findIndex(p=>p.id===anden),1,a.meta(anden,d)); a.skrivIdx();
          a.go('lokaler'); await T(120);
          const e=a.db.enheder.find(x=>x.lokaleId&&!x.trukket), cb=document.querySelector('input[aria-label="Kabel trukket: '+e.navn+'"]');
          o.cb=!!cb && !cb.checked; cb.click(); await T(60); o.sat=e.trukket===true && a.fvTrukket({{kind:'enhed',o:e}});
          o.optael=[...document.querySelectorAll('article h2')].some(h=>h.textContent===a.lokaleNavn(e.lokaleId) && /\d+ af \d+ trukket/.test(h.parentElement.textContent));
          cb.click(); await T(60); o.fjernet=!e.trukket; a.undo(); a.undo(); await T(50); o.undo=!e.trukket;
          return o}}""")
        tjek('omdøb projekt i Projekter (aktivt og andet, tomt navn afvises, kan fortrydes) og flueben for trukket kabel i Lokaler',
             r['fokus'] and r['anden'] == ['Omdøbt anden', 'Omdøbt anden', True] and r['tomAfvist'] and r['akt'] == ['Omdøbt aktiv'] * 4
             and r['fortrudt'] and r['cb'] and r['sat'] and r['optael'] and r['fjernet'] and r['undo'], r)

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

        # 2e. Print og PDF: firmaoplysninger, logo, underskriftsfelt og A4-CSS i dokumentationen
        r = await pg.evaluate(f"""(()=>{{const a={A};a.firma={{navn:'',cvr:'',adresse:'',telefon:'',logo:''}};const u=a.docHtml();
          return {{uden:!u.includes('class="fa"')&&!u.includes('<img'), sig:u.includes('class="sig"')&&u.includes('Montør')&&u.includes('KLS'), a4:u.includes('@page{{size:A4;margin:15mm}}'),
            gruppeskema:u.includes('<h1>Gruppeskema'), gemt:localStorage.getItem('tavleoversigt.firma')}}}})()""")
        tjek('dokumentation uden firmaoplysninger som før, med underskriftsfelt og A4-CSS', r['uden'] and r['sig'] and r['a4'] and r['gruppeskema'] and r['gemt'] is None, r)
        png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc00000030101001'
                            '8dd8db00000000049454e44ae426082')
        sidstVisning = await pg.evaluate(f"{A}.view"); await pg.evaluate(f"{A}.view='dokumentation'"); await pg.wait_for_timeout(200)
        await pg.set_input_files('#fa-logo', files=[{'name': 'logo.png', 'mimeType': 'image/png', 'buffer': png}])
        await pg.fill('#fa-navn', 'Test El ApS'); await pg.fill('#fa-cvr', '12345678'); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const u=a.docHtml(), s=JSON.parse(localStorage.getItem('tavleoversigt.firma')), f=a.firmaLaes();
          return {{navn:u.includes('Test El ApS')&&u.includes('CVR 12345678'), logo:u.includes('<img src="data:image/'), gemt:s.navn==='Test El ApS'&&s.logo.startsWith('data:image/'), laes:f.cvr==='12345678'&&f.logo===a.firma.logo,
            smaa:a.firma.logo.length<100000}}}})()""")
        tjek('firmanavn, CVR og logo kommer med i dokumentationen og huskes i browseren', all(r.values()), r)
        async with pg.expect_popup() as pop:
            await pg.evaluate(f"{A}.udskriv()")
        vindue = await pop.value
        await vindue.wait_for_load_state()
        r = await vindue.evaluate("[document.body.innerText.includes('Test El ApS'), document.body.innerText.includes('Underskrift'), document.querySelectorAll('img').length]")
        tjek('udskriv() åbner et vindue med dokumentationen', r == [True, True, 1], r)
        await vindue.close()
        # Afleveringstjek (forslag 10) og tavlefortegnelse (forslag 11)
        r = await pg.evaluate(f"""(()=>{{const a={A};const k=a.aflTjek();return {{kat:k.filter(x=>x.punkter.length).map(x=>x.k),n:a.aflAntal(),doc:a.docHtml().includes('Afleveringstjek: '+a.aflAntal()+' ')}}}})()""")
        tjek('afleveringstjek viser kendte mangler i eksempelprojektet, og dokumentationen har en statuslinje', r['n'] > 0 and len(r['kat']) > 0 and r['doc'], r)
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const gem=a.db, v=a.view;const o={{}};a.view='fejlfinder';await T(150);
          try {{ a.db=norm(JSON.parse(JSON.stringify(gem)));const d=a.db;
            d.enheder=[];d.daaser=[];d.afbrydere=[];d.links=[];d.racks=[];d.udstyr=[];d.brandlukninger=[];d.grupper=[];d.rcds=[];
            d.tavler.forEach(t=>{{t.tTrukket=true;t.ze=0.3;if(t.fra&&!t.tilgang)t.tilgang='5G6'}});
            o.n=a.aflAntal();o.doc=a.docHtml().includes('Afleveringstjek');await T(150);
            const e=document.getElementById('afl-klar');o.klar=!!e&&getComputedStyle(e).display!=='none';
            d.tavler[0].ze=0;o.ze=a.aflTjek().find(x=>x.k==='tavle').punkter.length;
          }} finally {{ a.view=v;await T(100);a.db=gem }} return o}})()""")
        tjek('afleveringstjek: "Klar til aflevering", når intet mangler; mangler Ze tæller med', r['n'] == 0 and r['klar'] and not r['doc'] and r['ze'] >= 1, r)
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};a.view='fejlfinder';await T(150);
          const knap=document.querySelector('.afl-punkt');o.har=!!knap;o.foer=[a.view,!!a.modal];if(knap)knap.click();await T(150);o.efter=[a.view,!!a.modal];
          if(a.modal&&a.closeModal)a.closeModal();else a.modal=null;
          const g=a.sorteredeGrupper()[0];a.view='fejlfinder';a.aflGaa({{nav:{{g:g.id}}}});await T(100);o.g=[a.view,a.sel===g.id];return o}})()""")
        tjek('afleveringstjek: et klik går til stedet (formular eller gruppe)', r['har'] and (r['efter'][0] != 'fejlfinder' or r['efter'][1]) and r['g'] == ['tavle', True], r)
        r = await pg.evaluate(f"""(()=>{{const a={A};const t=a.db.tavler[0];const h=a.tavleFortegnelseHtml(t.id);return {{nr:a.grupperFor(t.id).every(g=>h.includes('<td class="n">'+g.nr+'</td>')),n:a.grupperFor(t.id).length,side:h.includes('@page'),navn:h.includes(t.navn)}}}})()""")
        tjek('tavleFortegnelseHtml indeholder alle gruppenumre og @page', r['n'] > 0 and r['nr'] and r['side'] and r['navn'], r)
        async with pg.expect_popup() as pop:
            await pg.evaluate(f"{A}.udskrivFortegnelse({A}.db.tavler[0].id)")
        vindue = await pop.value
        await vindue.wait_for_load_state()
        r = await vindue.evaluate("[document.body.textContent.includes('Betegnelse'), document.querySelectorAll('tbody tr').length]")
        tjek('udskrivFortegnelse() åbner et vindue med tavlefortegnelsen', r[0] and r[1] > 0, r)
        await vindue.close()
        await pg.evaluate(f"{A}.view={json.dumps(sidstVisning)}")
        await pg.evaluate(f"(()=>{{{A}.firma={{navn:'',cvr:'',adresse:'',telefon:'',logo:''}};localStorage.removeItem('tavleoversigt.firma')}})()")

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
            n0['w'] = [w for w in n0['w'] if not re.match(r'(ik|kb|sf|sg|sr):', w)]  # nye advarsler fra skema 12 (kortslutning og selektivitet)
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
          g.maal.zs='3,1';const over=a.maalVurdering(g);a.dbRev++;const adv=a.warnings().some(w=>w.k==='m'+g.id);
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
             r['navn'] == 'Skema 9-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['std'] == ['C', 30, 20, 1, 'bundt'] and r['g'] and r['t']
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
             r['navn'] == 'Skema 10-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['afb'] == r0['afb'] and r['enheder'] == r0['enheder'] and r['svg']
             and r0['n'] >= 6 and r0['arter'] == ['enpolet', 'kip', 'korr', 'krone', 'sensor', 'trappe'],
             {'navn': r['navn'], 'b': r['b'], 's': r['s'], 'afb ens': r['afb'] == r0['afb'], 'enheder ens': r['enheder'] == r0['enheder'], 'n': r0['n'], 'arter': r0['arter']})

        # 4d. Opgradering fra skema 11: data intakte, backup taget, nye felter (Ze, Ik,maks, brydeevne, type S) med standardværdier
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=11;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.tavler.forEach(t=>{delete t.ze;delete t.ikMaks;});p.grupper.forEach(g=>{delete g.brydeevne;});p.rcds.forEach(r=>{delete r.selektiv;});
          p.projekt.navn='Skema 11-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {enheder:JSON.stringify(p.enheder), daaser:JSON.stringify(p.daaser), g:JSON.stringify(p.grupper.map(g=>[g.id,g.nr,g.navn,g.kar,g.In,g.rcdId,g.maal])),
            t:JSON.stringify(p.tavler.map(t=>[t.id,t.navn,t.forsikring,t.fraGruppe,t.tLaengde])), r:JSON.stringify(p.rcds.map(r=>[r.id,r.navn,r.type,r.In,r.idn]))}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const d=a.db;return {{navn:d.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema,
            enheder:JSON.stringify(d.enheder), daaser:JSON.stringify(d.daaser), g:JSON.stringify(d.grupper.map(g=>[g.id,g.nr,g.navn,g.kar,g.In,g.rcdId,g.maal])),
            t:JSON.stringify(d.tavler.map(t=>[t.id,t.navn,t.forsikring,t.fraGruppe,t.tLaengde])), r:JSON.stringify(d.rcds.map(r=>[r.id,r.navn,r.type,r.In,r.idn])),
            std:d.tavler.length>0&&d.grupper.length>0&&d.rcds.length>0&&d.tavler.every(t=>t.ze===0&&t.ikMaks===0)&&d.grupper.every(g=>g.brydeevne===6)&&d.rcds.every(x=>x.selektiv===false),
            ik:d.grupper.every(g=>a.ikMin(g)===null), kf:a.kortslutFejl().length}}}})()""")
        ens = {k: r[k] == r0[k] for k in ('enheder', 'daaser', 'g', 't', 'r')}
        tjek('opgradering fra skema 11: backup taget, data intakte, nye felter med standardværdier, ingen Ik uden Ze',
             r['navn'] == 'Skema 11-projekt' and r['b'] >= 1 and r['s'] == SKEMA and all(ens.values()) and r['std'] and r['ik'] and r['kf'] == 0,
             {'navn': r['navn'], 'b': r['b'], 's': r['s'], 'std': r['std'], 'ik': r['ik'], 'kf': r['kf']} | ens)

        # 4e. Kortslutningsstrøm og selektivitet med kendte tal (aftalt 2026-11-16). Ændringerne gemmes ikke.
        r = await pg.evaluate(f"""async()=>{{const a={A};const d=a.db, n={{t:d.tavler.length,g:d.grupper.length,r:d.rcds.length,e:d.enheder.length,d:d.daaser.length}}, o={{}}, T=ms=>new Promise(f=>setTimeout(f,ms));
          const w=k=>{{a.dbRev++;return a.warnings().some(x=>x.k===k)}}, rd=x=>Math.round(x*1000)/1000;
          try {{
            d.tavler.push({{id:'tk',navn:'TK',placering:'',forsikring:25,hovedafbryder:0,fra:'',fraGruppe:'',tilgang:'',tKabel:'PVC',tLedere:'5G',tTv:6,tLaengde:0,ze:0,ikMaks:0}});
            d.rcds.push({{id:'rk',tavleId:'tk',navn:'HPFI K',type:'A',In:40,idn:30,selektiv:false}});
            d.grupper.push({{id:'gk',tavleId:'tk',nr:1,navn:'K',type:'stik',kar:'B',In:16,faser:1,fase:'L1',rcdId:'rk',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
            d.enheder.push({{id:'ek',gruppeId:'gk',lokaleId:'',daaseId:'',navn:'Stik K',effekt:0,kabel:'PVC',ledere:'3G',tv:1.5,laengde:20,symbol:'auto'}});
            const t=a.tavle('tk'), g=a.gruppe('gk'), e=d.enheder.find(x=>x.id==='ek'), rk=d.rcds.find(x=>x.id==='rk');
            o.uden=a.ikMin(g)===null&&!w('ik:gk'); t.ze=0.3;
            let k=a.ikMin(g); o.pvc=[rd(k.R),rd(k.ik),k.Ia,k.ok,w('ik:gk')];
            g.kar='C'; g.In=25; k=a.ikMin(g); o.c25=[k.Ia,k.ok,w('ik:gk'),a.gruppeFejl('gk').some(x=>x.startsWith('Ik,min'))]; g.kar='B'; g.In=16;
            t.ze=0.64905; g.In=32; k=a.ikMin(g); o.afrund=[rd(k.ik),k.ok,a.ikVis(k),a.kortslutFejl().some(x=>x.k==='ik:gk'&&x.txt.includes('Ik,min 159 A er under Ia 160 A')),a.docHtml().includes('<td>159</td>')]; t.ze=0.3; g.In=16;
            e.kabel='XLPE'; k=a.ikMin(g); o.xlpe=[rd(k.R),rd(k.ik)]; e.kabel='PVC';
            d.daaser.push({{id:'dk',navn:'K',type:'Membrandåse',gruppeId:'gk',parentId:'',lokaleId:'',kabel:'PVC',ledere:'3G',tv:2.5,laengde:10}}); e.daaseId='dk';
            k=a.ikMin(g); o.daase=[rd(k.R),rd(k.ik)]; e.daaseId='';
            o.bryde0=!w('kb:tk'); t.ikMaks=10; o.bryde1=w('kb:tk')&&a.brydeFejl('tk').length===1; g.brydeevne=10; o.bryde2=!w('kb:tk'); g.brydeevne=6; t.ikMaks=0;
            o.sel1=w('sf:tk'); t.forsikring=35; o.sel2=!w('sf:tk');
            d.tavler.push({{id:'tu',navn:'TU',placering:'',forsikring:16,hovedafbryder:0,fra:'tk',fraGruppe:'gk',tilgang:'',tKabel:'PVC',tLedere:'3G',tTv:6,tLaengde:10,ze:0,ikMaks:0}});
            d.rcds.push({{id:'ru',tavleId:'tu',navn:'HPFI U',type:'A',In:40,idn:30,selektiv:false}});
            d.grupper.push({{id:'gu',tavleId:'tu',nr:1,navn:'U',type:'stik',kar:'B',In:10,faser:1,fase:'L1',rcdId:'ru',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
            const gu=a.gruppe('gu'); t.ikMaks=10;
            o.under=[rd(a.tavleZe('tu')),a.tavleIkMaks('tu'),rd(a.ikMin(g).R)]; t.ikMaks=0;
            o.zeTxt=[a.docHtml().includes('(beregnet fra forsynende tavle)'),a.zeBeregnet(a.tavle('tu')),a.zeBeregnet(a.tavle('tk'))]; const v0=a.view; a.go('beregning'); await T(150); o.zeDom=document.body.innerText.includes('(beregnet fra forsynende tavle)'); a.go(v0);
            o.sg1=!w('sg:gk'); gu.In=13; o.sg2=w('sg:gk'); gu.In=10; const tu=a.tavle('tu'); tu.forsikring=10; o.sfu=!w('sf:tu')&&!w('sf:tk'); tu.forsikring=16;
            o.hpfi1=w('sr:ru'); rk.selektiv=true; o.hpfi2=w('sr:ru'); rk.idn=100; o.hpfi3=!w('sr:ru'); rk.selektiv=false; o.hpfi4=w('sr:ru');
            t.forsikring=25; const doc=a.docHtml(); o.doc=doc.includes('Kortslutning og selektivitet')&&doc.includes('Selektivitet er ikke sikret')&&doc.includes('Ik,min (A)');
          }} finally {{
            d.tavler=d.tavler.filter(x=>!['tk','tu'].includes(x.id)); d.rcds=d.rcds.filter(x=>!['rk','ru'].includes(x.id)); d.grupper=d.grupper.filter(x=>!['gk','gu'].includes(x.id));
            d.enheder=d.enheder.filter(x=>x.id!=='ek'); d.daaser=d.daaser.filter(x=>x.id!=='dk');
          }}
          o.ryddet=d.tavler.length===n.t&&d.grupper.length===n.g&&d.rcds.length===n.r&&d.enheder.length===n.e&&d.daaser.length===n.d;
          const g0={{kar:'B',In:16}}; o.zs=[rd(a.zsMax(g0)),a.ia(g0),a.ia({{kar:'C',In:16}}),a.ia({{kar:'D',In:16}})];
          return o}}""")
        tjek('kortslutning: Ik,min med kendte tal (PVC, XLPE, dåse, undertavle), Ia, brydeevne',
             r['uden'] and r['pvc'] == [0.72, 214.216, 80, True, False] and r['c25'] == [250, False, True, True] and r['xlpe'] == [0.768, 204.588] and r['daase'] == [0.936, 176.78]
             and r['bryde0'] and r['bryde1'] and r['bryde2'] and r['under'] == [0.39, 10, 0.72] and r['zeTxt'] == [True, True, False] and r['zeDom'] and r['zs'] == [1.917, 80, 160, 320] and r['ryddet'], r)
        tjek('kortslutning: Ik,min lige under Ia vises rundet ned (159,6 A står som 159 A, ikke 160 A)', r['afrund'] == [159.6, False, '159', True, True], r)
        tjek('selektivitet: forsikring under 1,6 × største sikring, gruppe foran undertavle, ingen dobbelt advarsel fra undertavlens egen forsikring, HPFI i serie med og uden type S, med i dokumentationen',
             r['sel1'] and r['sel2'] and r['sfu'] and r['sg1'] and r['sg2'] and r['hpfi1'] and r['hpfi2'] and r['hpfi3'] and r['hpfi4'] and r['doc'], r)

        # 4g. Opgradering fra skema 12: data intakte, nye felter til føringsvej med tomme standardværdier
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=12;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));const fj=x=>{['fraEnhed','hoejde','placering','trukket','note'].forEach(k=>delete x[k]);};
          p.enheder.forEach(fj);p.daaser.forEach(fj);p.afbrydere.forEach(a=>{fj(a);['daaseId','kabel','ledere','tv','laengde'].forEach(k=>delete a[k]);});p.tavler.forEach(t=>{delete t.tTrukket;delete t.tNote;});
          p.projekt.navn='Skema 12-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          const k=x=>JSON.stringify(x.map(e=>[e.id,e.navn,e.gruppeId,e.daaseId||e.parentId||'',e.kabel,e.ledere,e.tv,e.laengde]));
          return {e:k(p.enheder), d:k(p.daaser), a:JSON.stringify(p.afbrydere.map(a=>[a.id,a.navn,a.art,a.a,a.b]))}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const d=a.db;const k=x=>JSON.stringify(x.map(e=>[e.id,e.navn,e.gruppeId,e.daaseId||e.parentId||'',e.kabel,e.ledere,e.tv,e.laengde]));
          return {{navn:d.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, e:k(d.enheder), d:k(d.daaser), a:JSON.stringify(d.afbrydere.map(x=>[x.id,x.navn,x.art,x.a,x.b])),
            std:d.enheder.concat(d.daaser).every(x=>x.trukket===false&&x.note===''&&x.placering===''&&x.hoejde==='')&&d.enheder.every(e=>e.fraEnhed==='')&&d.afbrydere.every(x=>x.laengde===0&&x.daaseId===''&&x.fraEnhed==='')&&d.tavler.every(t=>t.tTrukket===false&&t.tNote==='')}}}})()""")
        ens = {k: r[k] == r0[k] for k in ('e', 'd', 'a')}
        tjek('opgradering fra skema 12: backup taget, data intakte, føringsvejens felter tomme',
             r['navn'] == 'Skema 12-projekt' and r['b'] >= 1 and r['s'] == SKEMA and all(ens.values()) and r['std'], {'b': r['b'], 's': r['s'], 'std': r['std']} | ens)

        # 4h. Føringsvej: sløjfer i ΔU og Ik, afbrydertræk, kopiér gren, kæde, trukket og note. Ryddes op bagefter
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, n0=JSON.stringify([d.tavler.length,d.grupper.length,d.enheder.length,d.afbrydere.length]), sel0=a.sel, o={{}}, rd=x=>Math.round(x*100000)/100000;
          const E=(id,navn,fra,L)=>({{id,gruppeId:'gf',lokaleId:'',daaseId:'',fraEnhed:fra,navn,effekt:230,kabel:'PVC',ledere:'3G',tv:2.5,laengde:L,symbol:'stik',hoejde:'',placering:'Væg A',trukket:false,note:''}});
          try {{
            d.tavler.push({{id:'tf',navn:'TF',placering:'',forsikring:35,hovedafbryder:0,fra:'',fraGruppe:'',tilgang:'',tKabel:'PVC',tLedere:'5G',tTv:6,tLaengde:0,ze:0.3,ikMaks:0,tTrukket:false,tNote:''}});
            d.grupper.push({{id:'gf',tavleId:'tf',nr:1,navn:'F',type:'stik',kar:'B',In:10,faser:1,fase:'L1',rcdId:'',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
            d.enheder.push(E('f1','F1','',10)); const e1=a.enhed('f1'); o.du0=rd(a.du(e1));
            d.enheder.push(E('f2','F2','f1',5)); const e2=a.enhed('f2');
            o.du=[rd(a.du(e1)),rd(a.du(e2))]; o.I=[a.enhedI(e1),a.enhedI(e2)];
            o.R=rd(a.enhedR(e2))===rd(a.rSloejfe('PVC',10,2.5)+a.rSloejfe('PVC',5,2.5));
            d.afbrydere.push({{id:'af',navn:'AF',art:'enpolet',gruppeId:'gf',lokaleId:'',steder:1,tid:3,a:[],b:[],daaseId:'',fraEnhed:'f1',kabel:'PVC',ledere:'3G',tv:1.5,laengde:3,hoejde:'',placering:'',trukket:false,note:''}});
            o.afbDu=rd(a.du(e1))===o.du[0]; o.afbRow=a.rows().some(x=>x.e.id==='aaf'&&x.e.laengde===3);
            a.fvAaben=new Set(); a.fvFold=new Set(); const t0=a.foeringTrae(); o.standard=[t0.some(x=>['enhed','daase','afb'].includes(x.kind)), t0.find(x=>x.k==='gruppe:gf')&&t0.find(x=>x.k==='gruppe:gf').luk, t0.filter(x=>x.kind==='gruppe').every(x=>x.luk)];
            a.fvIkke=true; o.autoUd=a.foeringTrae().some(x=>x.k==='enhed:f1'); a.fvIkke=false;
            const gk=t0.find(x=>x.k==='gruppe:gf'); a.fvToggle(gk); o.togUd=a.foeringTrae().some(x=>x.k==='enhed:f1'); a.fvToggle(gk); o.togIgen=!a.foeringTrae().some(x=>x.k==='enhed:f1');
            a.fvFoldAlle(true); o.alleUd=a.foeringTrae().some(x=>x.k==='enhed:f1'); a.fvFoldAlle(false); o.alleIgen=!a.foeringTrae().some(x=>x.k==='enhed:f1'); a.fvFoldAlle(true);
            d.daaser.push({{id:'df',gruppeId:'gf',parentId:'',navn:'DF',kabel:'PVC',ledere:'3G',tv:2.5,laengde:4,lokaleId:'',placering:'',hoejde:'',trukket:false,note:''}});
            const g3=E('f3','F3','',6); g3.daaseId='df'; const g4=E('f4','F4','f3',3); d.enheder.push(g3,g4); d.afbrydere.push({{id:'af2',navn:'AF2',art:'enpolet',gruppeId:'gf',lokaleId:'',steder:1,tid:3,a:[],b:[],daaseId:'',fraEnhed:'f4',kabel:'PVC',ledere:'3G',tv:1.5,laengde:2,hoejde:'',placering:'',trukket:false,note:''}});
            const rk=(kind,ob)=>({{kind,o:ob}}); o.total=[a.fvTotal(rk('enhed',a.enhed('f1'))),a.fvTotal(rk('enhed',a.enhed('f2'))),a.fvTotal(rk('enhed',g3)),a.fvTotal(rk('enhed',g4)),a.fvTotal(rk('afb',d.afbrydere.find(x=>x.id==='af2'))),a.fvTotal(rk('afb',d.afbrydere.find(x=>x.id==='af')))];
            d.afbrydere=d.afbrydere.filter(x=>x.id!=='af2'); d.enheder=d.enheder.filter(x=>!['f3','f4'].includes(x.id)); d.daaser=d.daaser.filter(x=>x.id!=='df');
            const tr=a.foeringTrae(), ix=k=>tr.findIndex(x=>x.k===k), dep=k=>(tr[ix(k)]||{{}}).dep;
            o.trae=[dep('tavle:tf'),dep('gruppe:gf'),dep('enhed:f1'),dep('enhed:f2'),dep('afb:af')]; o.orden=ix('tavle:tf')<ix('gruppe:gf')&&ix('gruppe:gf')<ix('enhed:f1')&&ix('enhed:f1')<ix('enhed:f2');
            const R=k=>tr[ix(k)]; o.linjer=[R('enhed:f1').sidst,R('enhed:f2').sidst,R('afb:af').sidst,JSON.stringify(R('enhed:f2').linjer),JSON.stringify(R('afb:af').linjer),R('enhed:f1').boern];
            o.fraTxt=[R('enhed:f2').fra,R('afb:af').fra,R('enhed:f1').fra];
            a.fvFold=new Set(['enhed:f1']); const tf=a.foeringTrae(); a.fvFold=new Set(); o.fold=[tf.some(x=>x.k==='enhed:f1'&&x.luk),tf.some(x=>x.k==='enhed:f2'),tf.some(x=>x.k==='afb:af'),a.foeringTrae().some(x=>x.k==='enhed:f2')];
            const m0=a.materialer(); o.ikkeFoer=!m0.some(x=>x.gruppe==='Kabler, heraf ikke trukket'&&x.linjer.length);
            a.fvSaet(tr[ix('enhed:f1')],'trukket',true); a.fvSaet(tr[ix('enhed:f2')],'note','venter på tømrer');
            o.status=[e1.trukket,e2.note]; o.ikkeEfter=a.materialer().some(x=>x.gruppe==='Kabler, heraf ikke trukket'&&x.linjer.length);
            a.fvIkke=true; const t2=a.foeringTrae(); a.fvIkke=false; const f1=t2.find(x=>x.k==='enhed:f1');
            o.filter=!!f1&&f1.dim&&t2.some(x=>x.k==='enhed:f2'&&!x.dim);
            o.kopier=a.grenKopier('enhed','f1',2,'Væg B'); const nye=d.enheder.filter(e=>e.gruppeId==='gf'&&!['f1','f2'].includes(e.id));
            const rod=nye.filter(e=>!e.fraEnhed), boern=nye.filter(e=>e.fraEnhed);
            o.gren=[nye.length,rod.length,boern.every(b=>rod.some(r=>r.id===b.fraEnhed)),nye.every(e=>e.placering==='Væg B'&&!e.trukket&&e.note===''),d.afbrydere.filter(x=>x.gruppeId==='gf').length];
            o.grenDu=rd(a.du(boern[0]))===o.du[1];
            a.openForm('enhed',null,{{gruppeId:'gf',navn:'U1',kabel:'PVC',ledere:'3G',tv:1.5,laengde:4}}); a.form.antal=3; a.form.kaede=true; Object.assign(a.form,{{kKabel:'XLPE',kLedere:'3G',kTv:2.5,kLaengde:2}}); a.saveForm();
            const u=n=>d.enheder.find(e=>e.navn===n&&e.gruppeId==='gf'); o.kaede=[u('U1')&&u('U1').fraEnhed,u('U2')&&u('U3')&&u('U2').fraEnhed===u('U1').id&&u('U3').fraEnhed===u('U2').id]; o.kaedeKabel=[u('U1').kabel,u('U1').tv,u('U1').laengde,u('U2').kabel,u('U2').tv,u('U2').laengde,u('U3').kabel,u('U3').laengde];
            a.modal={{type:'enhed',id:'f1'}}; a.delCurrent(); o.slet=[a.enhed('f2').fraEnhed, d.afbrydere.find(x=>x.id==='af').fraEnhed];
            a.go('foering'); await T(200); o.vist=!!document.getElementById('fv-enhed-f2')&&document.querySelector('#fv-enhed-f2 .fv-note').value==='venter på tømrer';
            document.querySelector('#fv-enhed-f2 .fv-kabel').click(); await T(100); o.redAaben=!!document.querySelector('#fv-enhed-f2 .fv-red');
            a.fvTmp.kabel='XLPE'; a.fvTmp.ledere='5G'; a.fvTmp.tv=4; a.fvTmp.laengde='7,5'; [...document.querySelectorAll('#fv-enhed-f2 .fv-red .btn')].find(b=>b.textContent==='Gem').click(); await T(100);
            const f2=a.enhed('f2'); o.red=[f2.kabel,f2.ledere,f2.tv,f2.laengde,!document.querySelector('#fv-enhed-f2 .fv-red')];
            document.querySelector('#fv-enhed-f2 .fv-slet').click(); await T(100); o.slettet=!a.enhed('f2')&&!document.getElementById('fv-enhed-f2');
            a.undo(); await T(100); o.fortrudt=!!a.enhed('f2')&&a.enhed('f2').kabel==='XLPE';
            a.go('tavle');
          }} finally {{
            a.sel=sel0; a.modal=null; a.fvAaben=new Set(); a.fvFold=new Set(); await T(50); const d=a.db; const g=x=>x.gruppeId!=='gf'; d.enheder=d.enheder.filter(g); d.afbrydere=d.afbrydere.filter(g); d.grupper=d.grupper.filter(x=>x.id!=='gf'); d.tavler=d.tavler.filter(x=>x.id!=='tf'); a.save();
          }}
          o.ryddet=JSON.stringify([a.db.tavler.length,a.db.grupper.length,a.db.enheder.length,a.db.afbrydere.length])===n0;
          return o}})()""")
        tjek('føringsvej: sløjfe i ΔU og Ik, afbrydertræk uden ΔU, træ, trukket og note, ikke trukket i materialeliste, kopiér gren, kæde, sletning',
             r['du0'] == 0.07826 and r['du'] == [0.15652, 0.19565] and r['I'] == [2, 1] and r['R'] and r['afbDu'] and r['afbRow']
             and r['trae'] == [0, 1, 2, 3, 3] and r['linjer'] == [True, False, True, '[false,false]', '[false,false]', 2] and r['fraTxt'] == ['sløjfe fra F1', 'fra F1', ''] and r['fold'] == [True, False, False, True] and r['standard'] == [False, True, True] and r['autoUd'] and r['togUd'] and r['togIgen'] and r['alleUd'] and r['alleIgen'] and r['total'] == [10, 15, 10, 13, 15, 13] and r['orden'] and r['ikkeFoer'] and r['status'] == [True, 'venter på tømrer'] and r['ikkeEfter'] and r['filter']
             and r['kopier'] == 2 and r['gren'] == [4, 2, True, True, 3] and r['grenDu'] and r['kaede'] == ['', True] and r['kaedeKabel'] == ['PVC', 1.5, 4, 'XLPE', 2.5, 2, 'XLPE', 2] and r['slet'] == ['', ''] and r['vist'] and r['redAaben'] and r['red'] == ['XLPE', '5G', 4, 7.5, True] and r['slettet'] and r['fortrudt'] and r['ryddet'], r)

        # 4h2. Enstregsdiagram: sløjfekæde (Tilgang i serie → U1 → U2 …, stikkontakt efter sit eget udtag), forgreningsprikker, sporing og lokalefilter. Tilgang uden last
        r = await pg.evaluate(f"""(async()=>{{const a={A};const d=a.db, n0=JSON.stringify([d.tavler.length,d.grupper.length,d.enheder.length]), o={{}}, lok=d.lokaler[0].id;
          const E=(id,navn,fra,sym)=>({{id,gruppeId:'gq',lokaleId:id==='S4'?lok:'',daaseId:'',fraEnhed:fra,navn,effekt:sym==='stik'?230:0,kabel:'PVC',ledere:'3G',tv:2.5,laengde:3,symbol:sym,hoejde:'',placering:'',trukket:false,note:''}});
          try {{
            d.tavler.push({{id:'tq',navn:'TQ',placering:'',forsikring:35,hovedafbryder:0,fra:'',fraGruppe:'',tilgang:'',tKabel:'PVC',tLedere:'5G',tTv:6,tLaengde:0,ze:0,ikMaks:0,tTrukket:false,tNote:''}});
            d.grupper.push({{id:'gq',tavleId:'tq',nr:1,navn:'Q',type:'stik',kar:'B',In:13,faser:1,fase:'L1',rcdId:'',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
            const st0=a.stats().find(x=>x.l==='Brugsgenstande').v, bg=()=>((a.materialer().find(x=>x.gruppe==='Brugsgenstande')||{{linjer:[]}}).linjer);
            const m0=bg().reduce((s,l)=>s+l.antal,0), k0=a.materialer().find(x=>x.gruppe==='Kabler').linjer.reduce((s,l)=>s+l.antal,0);
            d.enheder.push(E('S4','Stik 4','U4','stik'),E('U3','Udtag 3','U2','gen'),E('S1','Stik 1','U1','stik'),E('U1','Udtag 1','TQ1','gen'),E('U4','Udtag 4','U3','gen'),
              E('S2','Stik 2','U2','stik'),E('U2','Udtag 2','U1','gen'),E('S3','Stik 3','U3','stik'),E('TQ1','Tilgang køkken','','auto'));
            o.tilg=[a.symbolFor(a.enhed('TQ1')),a.effektForslag({{navn:'Tilgang',symbol:'auto'}}).W,a.effektForslag({{navn:'Stik',symbol:'tilgang'}}).W,a.symNavn.tilgang?1:0];
            o.tilgNavn=['Køkken tilgang 1','Tilgangskabel bad','tilgang','Stik ved vask','Udtilgang'].map(n=>a.symbolFor({{navn:n,symbol:'auto',gruppeId:''}}));
            o.taelling=[a.stats().find(x=>x.l==='Brugsgenstande').v-st0, bg().reduce((s,l)=>s+l.antal,0)-m0, bg().some(l=>/Tilgang/.test(l.tekst)),
              a.materialer().find(x=>x.gruppe==='Kabler').linjer.reduce((s,l)=>s+l.antal,0)-k0];
            const P=html=>new DOMParser().parseFromString(html,'image/svg+xml'), mine=['TQ1','U1','U2','U3','U4','S1','S2','S3','S4'];
            const svg=P(a.sld(true)), rk=[...svg.querySelectorAll('g[data-k^="e:"]')].filter(g=>mine.includes(g.getAttribute('data-k').slice(2)));
            o.orden=rk.map(g=>g.getAttribute('data-k').slice(2)); o.fra=rk.map(g=>g.getAttribute('data-fra'));
            o.prikker=[...svg.querySelectorAll('circle.sp')].map(c=>c.getAttribute('data-sp')).filter(x=>mine.includes(x)).sort();
            const ln=id=>svg.querySelector('g[data-k="e:'+id+'"] line'), y=id=>Number(ln(id).getAttribute('y1')), x1=id=>Number(ln(id).getAttribute('x1'));
            const prik=id=>svg.querySelector('circle.sp[data-sp="'+id+'"]');
            o.geo=['S1','U2','S2','U3','S3','U4','S4'].every(c=>{{const p=a.enhed(c).fraEnhed, dot=prik(p);return dot&&Number(dot.getAttribute('cx'))===x1(c)&&Number(dot.getAttribute('cy'))===y(p)&&y(c)>y(p)}});
            o.raekker=y('TQ1')===y('U1')&&['U1','S1','U2','S2','U3','S3','U4','S4'].map(y).every((v,i,l)=>!i||v>l[i-1]);
            o.spor=a.spor('e:S4').map(x=>x.key).filter(k=>/^e:/.test(k));
            a.sldSel='e:S4'; a.lokF=lok; const lv=P(a.sld(false)); a.lokF=''; a.sldSel=null;
            const c=id=>lv.querySelector('g[data-k="e:'+id+'"]').getAttribute('class');
            o.live=[/ tr/.test(c('U2')),/ tr/.test(c('S1')),/dim/.test(c('U1')),/dim/.test(c('S1')),/dim/.test(c('S4'))];
          }} finally {{
            const d=a.db; d.enheder=d.enheder.filter(x=>x.gruppeId!=='gq'); d.grupper=d.grupper.filter(x=>x.id!=='gq'); d.tavler=d.tavler.filter(x=>x.id!=='tq'); a.save();
          }}
          o.ryddet=JSON.stringify([a.db.tavler.length,a.db.grupper.length,a.db.enheder.length])===n0;
          return o}})()""")
        tjek('enstreg: sløjfekæde i rækkefølge, forgreningsprikker, sporing gennem kæden, lokalefilter; Tilgang uden last og ikke talt som brugsgenstand',
             r['orden'] == ['TQ1', 'U1', 'S1', 'U2', 'S2', 'U3', 'S3', 'U4', 'S4'] and r['fra'] == ['', 'TQ1', 'U1', 'U1', 'U2', 'U2', 'U3', 'U3', 'U4']
             and r['prikker'] == ['U1', 'U2', 'U3', 'U4'] and r['geo'] and r['raekker'] and r['spor'] == ['e:TQ1', 'e:U1', 'e:U2', 'e:U3', 'e:U4', 'e:S4']
             and r['live'] == [True, False, False, True, False] and r['tilg'] == ['tilgang', 0, 0, 1] and r['tilgNavn'][:3] == ['tilgang'] * 3 and 'tilgang' not in r['tilgNavn'][3:] and r['taelling'] == [8, 8, False, 27] and r['ryddet'], r)

        # 4h3. Enstreg: Tilgang i serie mellem gruppeafbryder og sløjfer; flyt forbindelse (sløjfe, dåse, gruppe), kreds og anden gruppe afvist, fortryd, træk med pointer events
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, n0=JSON.stringify([d.tavler.length,d.grupper.length,d.enheder.length,d.daaser.length]), o={{}};
          const E=(id,navn,fra,sym,g)=>({{id,gruppeId:g||'gt',lokaleId:'',daaseId:'',fraEnhed:fra,navn,effekt:sym==='stik'?230:0,kabel:'PVC',ledere:'3G',tv:2.5,laengde:3,symbol:sym,hoejde:'',placering:'',trukket:false,note:'',fase:''}});
          const G=(id,nr)=>({{id,tavleId:'tt',nr,navn:'T'+nr,type:'stik',kar:'B',In:13,faser:1,fase:'L1',rcdId:'',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
          try {{
            a.mutate(()=>{{d.tavler.push({{id:'tt',navn:'TT',placering:'',forsikring:35,hovedafbryder:0,fra:'',fraGruppe:'',tilgang:'',tKabel:'PVC',tLedere:'5G',tTv:6,tLaengde:0,ze:0,ikMaks:0,tTrukket:false,tNote:''}});
              d.grupper.push(G('gt',1),G('gt2',2));
              d.daaser.push({{id:'DT',gruppeId:'gt',parentId:'',lokaleId:'',type:'PL-dåse',navn:'PL1',kabel:'PVC',ledere:'3G',tv:2.5,laengde:4,trukket:false,note:''}});
              d.enheder.push(E('V1','Vægudtag 1','TT1','gen'),E('A1','Stik A1','V1','stik'),E('V2','Vægudtag 2','V1','gen'),E('A2','Stik A2','V2','stik'),E('V3','Vægudtag 3','V2','gen'),E('A3','Stik A3','V3','stik'),
                E('V4','Vægudtag 4','V3','gen'),E('A4','Stik A4','V4','stik'),E('TT1','Tilgang','','auto'),E('L1','Lampe','','lys'),E('Y1','Anden','','stik','gt2'));
              d.enheder.find(x=>x.id==='L1').daaseId='DT';}});
            const P=h=>new DOMParser().parseFromString(h,'image/svg+xml'), svg=P(a.sld(true)), ln=id=>svg.querySelector('g[data-k="'+id+'"] line'), num=(el,k)=>Number(el.getAttribute(k));
            const gl=ln('g:gt'), tg=svg.querySelector('g[data-k="e:TT1"]'), tx=num(tg,'data-tx'), xMcb=num(gl,'x2')+12;
            const kids=['V1','A1','V2','A2','V3','A3','V4','A4'].map(id=>num(ln('e:'+id),'x1'));
            o.serie=[xMcb<tx, num(ln('e:TT1'),'y1')===num(gl,'y1'), kids.every(x=>x>tx), num(ln('e:V1'),'x1')===Math.max(...[...tg.querySelectorAll('line')].map(l=>num(l,'x2'))), /tilg/.test(tg.getAttribute('class')),
              tg.querySelector('path').getAttribute('d').startsWith('M '+(tx-10)+' ')];
            const f=id=>a.enhed(id);
            o.tilEnhed=[a.flytEnhed('A4','e:TT1'), f('A4').fraEnhed]; o.besked=a.toasts.some(t=>t.txt==='Stik A4 er nu sløjfet fra Tilgang.'&&t.undo);
            o.tilDaase=[a.flytEnhed('A4','d:DT'), f('A4').fraEnhed, f('A4').daaseId];
            o.tilGruppe=[a.flytEnhed('A4','g:gt'), f('A4').fraEnhed, f('A4').daaseId];
            o.kreds=[a.flytEnhed('V1','e:A2'), f('V1').fraEnhed, a.toasts.some(t=>t.fejl&&/sløjfet fra Vægudtag 1/.test(t.txt))];
            o.anden=[a.flytEnhed('A1','e:Y1'), f('A1').fraEnhed, a.flytTjek('A1','g:gt2').ok];
            a.flytEnhed('A3','e:V1'); o.foer=f('A3').fraEnhed; a.undo(); o.fortryd=a.enhed('A3').fraEnhed;
            o.valg=a.flytValg('A2').map(v=>v.key).sort().join(',');
            a.toasts.slice().forEach(t=>a.lukToast(t.id));
            /* træk i den levende visning: langt tryk på Stik A2, flyt hen på Stik A1 og så på Tilgang, slip */
            a.go('enstreg'); await T(200); const box=a.$refs.sldBox; box.scrollIntoView(); await T(50);
            const q=k=>document.querySelector('.sld g[data-k="'+k+'"] .hit'), bb=q('e:A2').getBBox(), bt=q('e:TT1').getBBox();
            a.z={{x:8-bt.x+40,y:box.clientHeight/2-bb.y,k:1}}; await T(80);
            const c=el=>{{const r=el.getBoundingClientRect();return [r.left+Math.min(60,r.width/2),r.top+r.height/2]}}, p0=c(q('e:A2')), p1=c(q('e:TT1')), p2=c(q('e:A1'));
            const PE=(type,x,y,el)=>(el||window).dispatchEvent(new PointerEvent(type,{{pointerId:7,clientX:x,clientY:y,bubbles:true,pointerType:'mouse',button:0,isPrimary:true}}));
            PE('pointerdown',p0[0],p0[1],q('e:A2')); await T(500); o.startet=!!a.traek;
            PE('pointermove',p2[0],p2[1]); await T(80); const cls=k=>document.querySelector('.sld g[data-k="'+k+'"]').getAttribute('class');
            o.fremh=[/dmaal/.test(cls('e:A1')), /dok/.test(cls('e:TT1')), /dok/.test(cls('g:gt')), /dkilde/.test(cls('e:A2')), !/dok/.test(cls('e:Y1')), /dok/.test(cls('e:V4'))];
            PE('pointermove',p1[0],p1[1]); await T(80); o.mrk=document.querySelector('.traekmrk').textContent; o.maal=a.traek&&a.traek.maal;
            PE('pointerup',p1[0],p1[1]); await T(80); o.traek=[a.enhed('A2').fraEnhed, a.traek, SLDP.size];
            a.undo(); await T(50); o.traekFortryd=a.enhed('A2').fraEnhed;
            /* kort tryk og træk panorerer stadig */
            const z0=a.z.x; PE('pointerdown',p0[0],p0[1],q('e:A2')); PE('pointermove',p0[0]+60,p0[1]); await T(450); PE('pointerup',p0[0]+60,p0[1]); await T(50);
            o.pan=[a.z.x-z0, a.traek, a.enhed('A2').fraEnhed];
          }} finally {{
            const d=a.db; d.enheder=d.enheder.filter(x=>!['gt','gt2'].includes(x.gruppeId)); d.daaser=d.daaser.filter(x=>x.id!=='DT'); d.grupper=d.grupper.filter(x=>!['gt','gt2'].includes(x.id)); d.tavler=d.tavler.filter(x=>x.id!=='tt'); a.save();
          }}
          o.ryddet=JSON.stringify([a.db.tavler.length,a.db.grupper.length,a.db.enheder.length,a.db.daaser.length])===n0;
          return o}})()""")
        tjek('enstreg: Tilgang i serie, flyt forbindelse til sløjfe/dåse/gruppe, kreds og anden gruppe afvist, fortryd, træk med langt tryk og fremhævning, kort træk panorerer',
             r['serie'] == [True] * 6 and r['tilEnhed'] == [True, 'TT1'] and r['besked'] and r['tilDaase'] == [True, '', 'DT'] and r['tilGruppe'] == [True, '', '']
             and r['kreds'] == [False, 'TT1', True] and r['anden'] == [False, 'V1', False] and r['foer'] == 'V1' and r['fortryd'] == 'V3'
             and r['valg'] == 'd:DT,e:A1,e:A3,e:A4,e:L1,e:TT1,e:V1,e:V3,e:V4,g:gt'
             and r['startet'] and r['fremh'] == [True] * 6 and r['maal'] == 'e:TT1' and r['mrk'] == 'Stik A2 → Tilgang' and r['traek'] == ['TT1', None, 0]
             and r['traekFortryd'] == 'V2' and r['pan'] == [60, None, 'V2'] and r['ryddet'], r)

        # 4i. Pop-up med typiske samtidighedsfaktorer: åbnes fra Beregning, viser forslag og tabellen, valg sætter gruppens faktor
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const g=a.db.grupper.find(x=>x.type==='stik'), sf0=g.sf, o={{}};
          a.go('beregning'); await T(150); const b=document.querySelector('#sf-'+g.id).nextElementSibling; b.click(); await T(150);
          const opt=[...document.querySelectorAll('[role=listbox] [role=option]')]; o.antal=opt.length; o.forslag=opt.length>0&&opt[0].textContent.trim().startsWith('Forslag');
          o.tabel=opt.some(x=>x.textContent.includes('Kontor, stik')&&x.textContent.includes('0,5'));
          const v=opt.find(x=>x.textContent.includes('omklædning')); v.click(); await T(100); o.valgt=g.sf; o.lukket=!document.querySelector('[role=listbox]');
          a.setSf(g.id, sf0); a.go('tavle'); return o}})()""")
        tjek('samtidighedsfaktor: pop-up med forslag og typiske værdier, valg sætter gruppens faktor', r['antal'] >= 8 and r['forslag'] and r['tabel'] and r['valgt'] == 0.8 and r['lukket'], r)

        # 4j. Klon lokale til en anden gruppe, duplikér brandlukning, produkter med afkrydsning (skema 17), gentag efter fortryd
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, o={{}};
          const n0=[d.lokaler.length,d.enheder.length,d.brandlukninger.length];
          const lok=d.lokaler.find(l=>d.enheder.filter(e=>e.lokaleId===l.id&&e.gruppeId).length>=2); const ne=d.enheder.filter(e=>e.lokaleId===lok.id).length;
          const til=d.grupper.find(g=>!d.enheder.some(e=>e.lokaleId===lok.id&&e.gruppeId===g.id));
          a.klonAabn(lok.id); await T(100); o.dialog=!!document.querySelector('[id^=klon-g-]'); a.klon.navn='Klon-test'; Object.keys(a.klon.map).forEach(k=>{{a.klon.map[k]=til.id;}}); a.klonGem(); await T(50);
          const nl=a.db.lokaler.find(l=>l.navn==='Klon-test'), es=a.db.enheder.filter(e=>e.lokaleId===nl.id), ds=a.db.daaser.filter(x=>x.lokaleId===nl.id);
          o.klon=[es.length===ne, es.every(e=>e.gruppeId===til.id), ds.every(x=>x.gruppeId===til.id), a.db.enheder.filter(e=>e.lokaleId===lok.id).every(e=>e.gruppeId!==til.id)];
          o.gentagFoer=document.getElementById('gentag').disabled;
          a.undo(); await T(50); o.fortrudt=!a.db.lokaler.some(l=>l.navn==='Klon-test'); o.gentagAktiv=!document.getElementById('gentag').disabled;
          a.redo(); await T(50); o.gentaget=a.db.lokaler.some(l=>l.navn==='Klon-test')&&a.db.enheder.filter(e=>e.gruppeId===til.id&&a.db.lokaler.find(l=>l.navn==='Klon-test').id===e.lokaleId).length===ne;
          a.undo(); await T(20); a.mutate(()=>{{}}); o.nulstil=a.fremtid.length===0;
          a.openForm('brand',null,{{lokaleId:lok.id}}); await T(100); o.bokse=document.querySelectorAll('[id^="bp-FR"]').length;
          Object.assign(a.form,{{placering:'Test-lukning',produkter:['FR Akryl','FR Manchet','Ukendt'],produkt:'Egen fugemasse',udfoert:true,maerkat:true,note:'x'}}); a.brandGem(); await T(50);
          const b=a.db.brandlukninger.find(x=>x.placering==='Test-lukning'); o.prod=[b.produkter.join('|'), b.produkt, a.brandProduktTxt(b)];
          const max=a.db.brandlukninger.reduce((m,x)=>Math.max(m,x.nr),0); a.brandDup(b); const c=a.db.brandlukninger[a.db.brandlukninger.length-1];
          o.dup=[c.id!==b.id, c.nr===max+1, c.placering==='Test-lukning', c.produkter.join('|')===b.produkter.join('|'), c.udfoert, c.maerkat, c.billeder.length, c.note];
          o.norm=JSON.stringify(norm({{brandlukninger:[{{nr:1,produkt:'Gammelt'}},{{nr:2,produkter:['FR Grafit','Noget andet','FR Grafit']}}]}}).brandlukninger.map(x=>[x.produkt,x.produkter]));
          o.doc=a.docHtml().includes('FR Manchet, FR Akryl, Egen fugemasse');
          a.db.lokaler=a.db.lokaler.filter(l=>l.navn!=='Klon-test'); const nlid=nl.id; a.db.enheder=a.db.enheder.filter(e=>e.lokaleId!==nlid); a.db.daaser=a.db.daaser.filter(x=>x.lokaleId!==nlid); a.db.links=a.db.links.filter(x=>x.lokaleId!==nlid);
          a.db.brandlukninger=a.db.brandlukninger.filter(x=>x.placering!=='Test-lukning'); a.save();
          o.ryddet=JSON.stringify([a.db.lokaler.length,a.db.enheder.length,a.db.brandlukninger.length])===JSON.stringify(n0);
          return o}})()""")
        tjek('klon lokale til valgfri gruppe, gentag efter fortryd, duplikér brandlukning med næste nummer, produkter med afkrydsning og fritekst',
             r['dialog'] and r['klon'] == [True, True, True, True] and r['gentagFoer'] and r['fortrudt'] and r['gentagAktiv'] and r['gentaget'] and r['nulstil']
             and r['bokse'] == 9 and r['prod'] == ['FR Manchet|FR Akryl', 'Egen fugemasse', 'FR Manchet, FR Akryl, Egen fugemasse']
             and r['dup'] == [True, True, True, True, False, False, 0, ''] and r['norm'] == '[["Gammelt",[]],["",["FR Grafit"]]]' and r['doc'] and r['ryddet'], r)

        # 4f. Forslag til fasefordeling: vises først, ændrer intet før Anvend, og giver bedre balance
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, tid=d.tavler[0].id, gs=a.grupperFor(tid).filter(g=>g.faser!=3), gem=gs.map(g=>g.fase), o={{}};
          gs.forEach(g=>{{g.fase='L1';}}); const skaev=gs.map(g=>g.fase).join(), d0=a.faseInfo(tid).diff;
          a.go('beregning'); a.faseForesla(tid); await T(150);
          o.vist=!!a.faseFs&&a.faseFs.tid===tid&&a.faseFs.rows.length>0&&!!document.getElementById('fase-forslag'); o.uroert=gs.map(g=>g.fase).join()===skaev;
          o.tal=!!a.faseFs&&Math.abs(a.faseFs.diffFoer-d0)<1e-9&&a.faseFs.diff<d0;
          const d1=a.faseFs?a.faseFs.diff:-1; document.getElementById('fase-anvend').click(); await T(150);
          o.anvendt=a.faseFs===null&&Math.abs(a.faseInfo(tid).diff-d1)<1e-6&&!document.getElementById('fase-forslag');
          a.faseForesla(tid); o.ingen=a.faseFs===null;
          gs.forEach((g,i)=>{{g.fase=gem[i];}}); a.save(); return o}})()""")
        tjek('fasefordeling: forslag vises uden at ændre noget, Anvend flytter grupperne, intet forslag når balancen ikke bliver bedre',
             r['vist'] and r['uroert'] and r['tal'] and r['anvendt'] and r['ingen'], r)

        # 4j. Opgradering fra skema 13: brugsgenstande uden fase får fase '' (som gruppen), data intakte
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=13;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.enheder.forEach(e=>{delete e.fase;});p.projekt.navn='Skema 13-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          const k=x=>JSON.stringify(x.map(e=>[e.id,e.navn,e.gruppeId,e.daaseId,e.fraEnhed,e.effekt,e.kabel,e.ledere,e.tv,e.laengde,e.placering,e.trukket,e.note]));
          return {e:k(p.enheder), g:JSON.stringify(p.grupper.map(g=>[g.id,g.type,g.faser,g.fase,g.sf])), n:p.enheder.length}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const d=a.db;const k=x=>JSON.stringify(x.map(e=>[e.id,e.navn,e.gruppeId,e.daaseId,e.fraEnhed,e.effekt,e.kabel,e.ledere,e.tv,e.laengde,e.placering,e.trukket,e.note]));
          a.save();a.gemNu(); return {{navn:d.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, e:k(d.enheder), g:JSON.stringify(d.grupper.map(g=>[g.id,g.type,g.faser,g.fase,g.sf])),
            fase:d.enheder.every(e=>e.fase===''), gemt:JSON.parse(localStorage.getItem('tavleoversigt.p.'+a.pid)||'{{}}').enheder.every(e=>e.fase==='')}}}})()""")
        tjek('opgradering fra skema 13: backup taget, brugsgenstande og grupper intakte, fase sat til som gruppen',
             r['navn'] == 'Skema 13-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['e'] == r0['e'] and r['g'] == r0['g'] and r['fase'] and r['gemt'] and r0['n'] > 0,
             {k: r[k] for k in ('navn', 'b', 's', 'fase', 'gemt')} | {'e': r['e'] == r0['e'], 'g': r['g'] == r0['g']})

        # 4k. 1-faset tilslutning på 3-faset gruppe med kendte tal, samt gruppetypen Lys og stik. Ryddes op bagefter
        r = await pg.evaluate(f"""(async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=a.db, n0=JSON.stringify([d.tavler.length,d.grupper.length,d.enheder.length,d.daaser.length,d.afbrydere.length]), sel0=a.sel, o={{}}, rd=x=>Math.round(x*100000)/100000;
          const E=(id,navn,gid,P,fase,L,x)=>Object.assign({{id,gruppeId:gid,lokaleId:'',daaseId:'',fraEnhed:'',fase,navn,effekt:P,kabel:'PVC',ledere:'5G',tv:2.5,laengde:L,symbol:'auto',hoejde:'',placering:'',trukket:false,note:''}},x||{{}});
          const G=(id,nr,type,faser,fase)=>({{id,tavleId:'tqp',nr,navn:'P'+nr,type,kar:'B',In:16,faser,fase,rcdId:'',sf:1,brydeevne:6,maal:{{riso:'',zs:'',rcd:'',ok:false}},metode:'',temp:'',samlet:'',lag:''}});
          const P3=4000*Math.sqrt(3);
          try {{
            d.tavler.push({{id:'tqp',navn:'TP',placering:'',forsikring:63,hovedafbryder:0,fra:'',fraGruppe:'',tilgang:'',tKabel:'PVC',tLedere:'5G',tTv:6,tLaengde:0,ze:0,ikMaks:0,tTrukket:false,tNote:''}});
            d.grupper.push(G('gqp',1,'kraft',3,'L1'), G('gq1',2,'stik',1,'L1'), G('gql',3,'lysstik',1,'L2'));
            d.enheder.push(E('p1','P1 3F','gqp',P3,'',10), E('p2','P2 L2','gqp',2300,'L2',10));
            const p1=a.enhed('p1'), p2=a.enhed('p2');
            o.p2=[a.fase1(p2),a.tre(p2),rd(a.strom(p2)),rd(a.du(p2)),rd(a.lmax(p2)),a.iz(p2)===a.izTabel('PVC',2.5,false,'C'),a.faseTxt(p2)];
            o.p1=[a.fase1(p1),a.tre(p1),rd(a.strom(p1)),rd(a.du(p1))];
            const gf=a.gruppeFaser(a.gruppe('gqp')); o.faser=[rd(gf.L1),rd(gf.L2),rd(gf.L3),rd(a.gruppeI('gqp'))];
            const fi=a.faseInfo('tqp'); o.tavle=[...fi.vals.map(v=>rd(v.I)),rd(fi.IN)];
            d.enheder.push(E('p3','P3 L1 sløjfe','gqp',2300,'L1',5,{{fraEnhed:'p1'}})); const p3=a.enhed('p3'), ef=a.enhedFaser(p1);
            o.sloejfe=[rd(ef.L1),rd(ef.L2),rd(ef.L3),rd(a.enhedI(p1)),rd(a.du(p1)),rd(a.du(p3))];
            const gf2=a.gruppeFaser(a.gruppe('gqp')); o.faser2=[rd(gf2.L1),rd(gf2.L2),rd(gf2.L3)];
            d.daaser.push({{id:'dp',navn:'DP',type:'Forfradåse',gruppeId:'gqp',parentId:'',lokaleId:'',kabel:'PVC',ledere:'5G',tv:2.5,laengde:10,hoejde:'',placering:'',trukket:false,note:''}});
            d.enheder.push(E('p4','P4 3F','gqp',P3,'',0,{{daaseId:'dp'}}), E('p5','P5 L3','gqp',2300,'L3',0,{{daaseId:'dp'}}));
            o.daase=[rd(a.daaseI('dp')),rd(a.duOp('dp')),rd(a.du(a.enhed('p5')))];
            d.enheder.push(E('q1','Q1','gq1',2300,'L3',10)); const q1=a.enhed('q1'); const g1f=a.gruppeFaser(a.gruppe('gq1'));
            o.en1=[a.fase1(q1),rd(a.strom(q1)),rd(g1f.L1),g1f.L3,q1.fase];
            o.rows=a.rows().some(x=>x.e.id==='p2'&&x.via.includes('L2, 230 V')); o.doc=a.docHtml().includes('P2 L2 (L2, 230 V)');
            a.sel='gqp'; a.go('beregning'); await T(150); o.beregning=document.body.innerText.includes('L1 30 · L2 30 · L3 30 A');
            a.go('tavle'); await T(100);
            a.openForm('enhed',p2); await T(100); const fs=document.getElementById('m-fase');
            o.form=[!!fs&&fs.offsetParent!==null,a.form.fase,a.belTxt().includes('230 V (L2 og nul)')];
            a.form.belEnh='A'; a.belFra(); o.belA=a.form.belVal; a.form.belVal=8; a.belSync(); o.belW=a.form.effekt;
            a.form.fase=''; a.belSync(); o.form3=a.belTxt().includes('3 × 400 V'); a.modal=null; await T(50);
            a.openForm('enhed',q1); await T(100); o.skjult=document.getElementById('m-fase').offsetParent===null; a.modal=null; await T(50);
            d.enheder.push(E('l1','Spot','gql',100,'',10,{{ledere:'3G'}}));
            o.ls=[a.typeLabel.lysstik,a.duGraense(a.enhed('l1')),Object.keys(SF).every(k=>SF[k].lysstik===SF[k].lys),a.sfForslag({{type:'lysstik'}}).v===SF[d.projekt.anlaeg||'bolig'].lys,
              a.sfListe({{type:'lysstik'}}).some(x=>x.txt.includes('lys og stik'))];
            a.sel='gql'; a.openForm('afbryder'); o.afb=a.form.gruppeId; a.modal=null; await T(50);
            a.go('tavle'); await T(150); const chip=document.querySelector('.typed.lysstik'), cs=getComputedStyle(document.documentElement).getPropertyValue('--lysstik').trim();
            o.farve=!!chip&&cs!==''&&getComputedStyle(chip).getPropertyValue('--t').trim()===cs;
            a.go('kabler'); await T(150); o.filter=[...document.querySelectorAll('#f-type option')].some(x=>x.value==='lysstik'&&x.textContent==='Lys og stik');
            o.print=a.sld(true).includes('.lysstik .tc');
          }} finally {{
            a.sel=sel0; a.modal=null; await T(50); const g=x=>!['gqp','gq1','gql'].includes(x.gruppeId); d.enheder=d.enheder.filter(g); d.daaser=d.daaser.filter(g); d.grupper=d.grupper.filter(x=>x.tavleId!=='tqp'); d.tavler=d.tavler.filter(x=>x.id!=='tqp'); a.save();
          }}
          o.ryddet=JSON.stringify([a.db.tavler.length,a.db.grupper.length,a.db.enheder.length,a.db.daaser.length,a.db.afbrydere.length])===n0;
          return o}})()""")
        tjek('1-faset tilslutning på 3-faset gruppe: P/230, ΔU 1-faset (2·L, 230 V), Iz med 2 belastede ledere, fasestrømme, sløjfe, dåse, formular og visning',
             r['p2'] == ['L2', False, 10, 0.78261, 63.88889, True, 'L2, 230 V'] and r['p1'] == ['', True, 10, 0.38971]
             and r['faser'] == [10, 20, 10, 20] and r['tavle'] == [10, 20, 10, 10]
             and r['sloejfe'] == [20, 10, 10, 20, 1.16913, 1.56044] and r['faser2'] == [20, 20, 10]
             and r['daase'] == [20, 1.16913, 1.16913] and r['en1'] == ['', 10, 10, 0, 'L3']
             and r['rows'] and r['doc'] and r['beregning'] and r['form'] == [True, 'L2', True] and r['belA'] == 10 and r['belW'] == 1840 and r['form3'] and r['skjult'] and r['ryddet'], r)
        tjek('gruppetype Lys og stik: label, ΔU-grænse 3 %, samtidighed som lys, afbryder, farvetoken, filter, printfarve',
             r['ls'] == ['Lys og stik', 3, True, True, True] and r['afb'] == 'gql' and r['farve'] and r['filter'] and r['print'], r)

        # 4l. Opgradering fra skema 14: projekt uden brandlukninger er intakt, backup taget, tom liste
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=14;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));delete p.brandlukninger;p.projekt.navn='Skema 14-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          const {projekt, ...rest}=p; return {rest:JSON.stringify(rest), n:p.enheder.length}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const {{projekt, brandlukninger, ...rest}}=JSON.parse(JSON.stringify(a.db));a.save();
          return {{navn:projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, rest:JSON.stringify(rest), bl:brandlukninger,
            gemt:JSON.parse(localStorage.getItem('tavleoversigt.p.'+a.pid)).brandlukninger}}}})()""")
        tjek('opgradering fra skema 14: backup taget, data intakte, brandlukninger tom liste',
             r['navn'] == 'Skema 14-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['rest'] == r0['rest'] and r['bl'] == [] and r['gemt'] == [] and r0['n'] > 0,
             {k: r[k] for k in ('navn', 'b', 's', 'bl', 'gemt')} | {'rest ens': r['rest'] == r0['rest']})
        r = await pg.evaluate("""(()=>{const d=norm({tavler:[],brandlukninger:[{nr:'x',udfoert:1,billeder:['ok1','ok1','../x',5]},null,{id:'b2',nr:7,placering:3}]});
          return d.brandlukninger.map(b=>[b.id,b.nr,b.udfoert,b.maerkat,b.billeder,b.placering,b.note])})()""")
        tjek('norm(): brandlukninger får standardværdier, ugyldige billed-id\'er og dubletter fjernes', r == [['bl1', 1, True, False, ['ok1'], '', ''], ['b2', 7, False, False, [], '3', '']], r)

        # 4m. Brandlukning: formular med billeder fra kamera og galleri, komprimering, IndexedDB, afkrydsning i listen, filtre, sletning og dokumentation
        png = base64.b64decode(await pg.evaluate(TESTBILLEDE))
        await pg.evaluate(f"{A}.go('brand')"); await pg.wait_for_timeout(150)
        await pg.click('#bl-ny'); await pg.wait_for_timeout(150)
        r0 = await pg.evaluate(f"""(()=>{{const a={A};const k=document.getElementById('bl-kamera'), g=document.getElementById('bl-galleri');
          return {{nr:a.form.nr, type:a.modal.type, kamera:[k.accept,k.getAttribute('capture'),k.multiple], galleri:[g.accept,g.getAttribute('capture'),g.multiple]}}}})()""")
        await pg.fill('#m-navn', 'Væg mod trappe, 30 cm under loft'); await pg.fill('#m-bbesk', '3 kabler + 1 rør gennem EI60-væg')
        await pg.check('#bk-EI60'); await pg.check('#bk-EI90'); await pg.fill('#m-bklasse', 'REI60'); await pg.fill('#m-bprod', 'Brandfugemasse')
        await pg.set_input_files('#bl-kamera', files=[{'name': 'kamera.png', 'mimeType': 'image/png', 'buffer': png}])
        await pg.wait_for_function(f"{A}.form.billeder.length===1 && !{A}.billedArbejder", timeout=15000)
        await pg.set_input_files('#bl-galleri', files=[{'name': 'g1.png', 'mimeType': 'image/png', 'buffer': png}, {'name': 'g2.png', 'mimeType': 'image/png', 'buffer': png}])
        await pg.wait_for_function(f"{A}.form.billeder.length===3 && !{A}.billedArbejder", timeout=15000)
        await pg.wait_for_timeout(100)
        minier = await pg.evaluate("document.querySelectorAll('.bl-mini-f img').length")
        await pg.click('.bl-mini-f >> nth=2 >> .bl-fjern')
        await pg.click('footer button[type=submit]'); await pg.wait_for_timeout(200)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};const b=a.db.brandlukninger[0];
          o.n=a.db.brandlukninger.length; o.felter=[b.nr,b.placering,b.beskrivelse,a.brandKlasseTxt(b),b.produkt,b.udfoert,b.maerkat,b.billeder.length,a.modal];
          const lok=a.db.lokaler[0].id; a.brandNy(); o.nr2=a.form.nr; Object.assign(a.form,{{placering:'Loft i teknikrum',lokaleId:lok,beskrivelse:'Kabelbakke gennem EI30-dæk'}}); a.saveForm(); await T(150);
          const rec=await bdbKoer(['billeder'],'readonly',tx=>tx.objectStore('billeder').get(b.billeder[0])), mini=await bdbKoer(['mini'],'readonly',tx=>tx.objectStore('mini').get(b.billeder[0]));
          const im=await a.billedBillede(rec.data), mi=await a.billedBillede(mini.data);
          o.fuld=[rec.data.slice(0,23),Math.max(im.naturalWidth,im.naturalHeight),Math.min(im.naturalWidth,im.naturalHeight),Math.round(bStr(rec.data)/1024)];
          o.mini=[mini.data.slice(0,23),Math.max(mi.naturalWidth,mi.naturalHeight),Math.round(bStr(mini.data)/1024)];
          o.db=(await indexedDB.databases()).some(x=>x.name==='tavleoversigt-billeder');
          const ls=localStorage.getItem('tavleoversigt.p.'+a.pid); o.ls=[ls.includes('data:image'),ls.includes(b.billeder[0])];
          o.liste=document.querySelectorAll('#bl-liste article').length; o.optael=[document.getElementById('bl-udf').textContent,document.getElementById('bl-maerk').textContent];
          o.listeMini=document.querySelectorAll('#bl-liste article .bl-mini img').length;
          return o}}""")
        tjek('brandlukning: kamera med capture="environment", galleri med flere billeder, foreslået nummer',
             r0['nr'] == 1 and r0['type'] == 'brand' and r0['kamera'] == ['image/*', 'environment', False] and r0['galleri'] == ['image/*', None, True] and r['nr2'] == 2, (r0, r['nr2']))
        tjek('brandlukning: oprettet via formularen med felter og to billeder (ét fjernet med ×), vises i listen',
             r['n'] == 1 and r['felter'] == [1, 'Væg mod trappe, 30 cm under loft', '3 kabler + 1 rør gennem EI60-væg', 'EI60, EI90, REI60', 'Brandfugemasse', False, False, 2, None]
             and minier == 3 and r['liste'] == 2 and r['listeMini'] == 2 and r['optael'] == ['Udført 0 af 2', 'Mærkat 0 af 2'], (r, minier))
        tjek('billeder: komprimeret til JPEG højst 1600 px og 300 KB, miniature 320 px, i IndexedDB, kun id i localStorage',
             r['fuld'][0] == 'data:image/jpeg;base64,' and r['fuld'][1:3] == [1600, 1200] and 20 <= r['fuld'][3] <= 300 and r['mini'][0] == 'data:image/jpeg;base64,' and r['mini'][1] == 320
             and r['mini'][2] < 40 and r['db'] and r['ls'] == [False, True], r)
        await pg.click('#bl-liste article >> nth=0 >> .bl-udf'); await pg.wait_for_timeout(150)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};const [b1,b2]=a.db.brandlukninger;
          const tael=()=>[document.getElementById('bl-udf').textContent,document.getElementById('bl-maerk').textContent,document.querySelectorAll('#bl-liste article').length];
          o.klik=[b1.udfoert,JSON.parse(localStorage.getItem('tavleoversigt.p.'+a.pid)).brandlukninger[0].udfoert]; o.efterKlik=tael();
          a.brandIkke=true; await T(60); o.ikke1=tael(); a.brandSaet(a.db.brandlukninger[0],'maerkat',true); await T(60); o.ikke2=tael();
          o.ikkeNr=[...document.querySelectorAll('#bl-liste .bl-nr')].map(x=>x.textContent); a.brandIkke=false;
          a.lokF=a.db.brandlukninger[1].lokaleId; await T(60); o.lok=tael(); a.lokF=''; await T(60);
          o.doc=a.docHtml(); o.docOk=[o.doc.includes('<h1>Brandlukninger</h1>'),o.doc.includes('Udført 1 af 2 · brandmærkat 1 af 2'),(o.doc.match(/<img class="bl" src="data:image[/]jpeg/g)||[]).length,o.doc.includes('Kabelbakke gennem EI30-dæk')];
          delete o.doc; o.soeg=(a.q='teknikrum', a.soeg().filter(x=>x.type==='brand').length); a.q='';
          const id2=a.db.brandlukninger[1].id, ids=a.db.brandlukninger[0].billeder.slice(); a.openForm('brand',a.db.brandlukninger[1]); await T(60); a.delCurrent(); await T(60);
          o.slet=[a.db.brandlukninger.length,a.toasts.some(t=>t.undo&&/Brandlukning 2 er slettet/.test(t.txt))]; a.undo(); await T(60);
          o.fortryd=[a.db.brandlukninger.length,a.db.brandlukninger[1].id===id2,ids.every(i=>BFULD.has(i))];
          a.openForm('brand',a.db.brandlukninger[0]); await T(60); a.form.billeder=[]; a.saveForm(); await T(60); a.undo(); await T(60);
          o.fjernBil=[a.db.brandlukninger[0].billeder.length,ids.every(i=>BFULD.has(i)&&BMINI[i])];
          return o}}""")
        tjek('brandlukning: afkrydsning direkte i listen gemmes, filter "kun ikke udført / mangler mærkat", optælling og lokalefilter',
             r['klik'] == [True, True] and r['efterKlik'] == ['Udført 1 af 2', 'Mærkat 0 af 2', 2] and r['ikke1'][2] == 2 and r['ikke2'] == ['Udført 1 af 2', 'Mærkat 1 af 2', 1]
             and r['ikkeNr'] == ['2'] and r['lok'] == ['Udført 0 af 1', 'Mærkat 0 af 1', 1] and r['soeg'] == 1, r)
        tjek('brandlukning: sletning kan fortrydes, og billederne bliver på enheden', r['slet'] == [1, True] and r['fortryd'] == [2, True, True] and r['fjernBil'] == [2, True], r)
        tjek('dokumentation: brandlukninger med status, optælling og små billeder', r['docOk'] == [True, True, 2, True], r['docOk'])

        # 4b. Import fra regneark (forslag 16)
        await pg.evaluate(f"{A}.go('kabler')")
        await pg.click('text=Importér fra regneark >> visible=true')
        g0 = await pg.evaluate(f"(()=>{{const a={A},g=a.db.grupper[0];return {{id:g.id,txt:a.tavleNavn(g.tavleId)+':'+g.nr}}}})()")
        tekst = ('Navn\tLokale\tGruppe\tEffekt (kW)\tKabel\tLængde (m)\tTværsnit\n'
                 f'Testovn\tImportrum\t{g0["txt"]}\t2,5\txlpe\t7,5\t2,5\n'
                 f'Fejlrække\t\t{g0["txt"]}\t1\tGummi\t3\t\n'
                 'Tomrække\t\t\t\t\t\t\n'
                 'Ugruppe\t\t99:99\t1\t\t\t\n')
        await pg.fill('#imp-tekst', tekst)
        await pg.wait_for_timeout(150)
        r = await pg.evaluate(f"""async()=>{{const a={A},T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          o.hdr=a.imp.hdr; o.map=a.imp.map.join(','); o.ok=a.impAntal(); o.fejl=a.imp.fh.filter(x=>!x.ok).map(x=>x.fejl.join('|'));
          o.knap=document.getElementById('imp-gem').textContent.trim(); o.rader=document.querySelectorAll('[aria-label="Forhåndsvisning af import"] tbody tr').length;
          o.foer=[a.db.enheder.length,a.db.lokaler.length]; document.getElementById('imp-gem').click(); await T(100);
          const e=a.db.enheder.find(x=>x.navn==='Testovn'), t=a.db.enheder.find(x=>x.navn==='Tomrække');
          o.efter=[a.db.enheder.length,a.db.lokaler.length]; o.lukket=!a.imp.aaben;
          o.ovn=e&&[e.effekt,e.kabel,e.tv,e.laengde,a.lokaleNavn(e.lokaleId),e.gruppeId===a.db.grupper[0].id];
          o.tom=t&&[t.effekt,t.kabel,t.ledere,t.tv,t.laengde,t.lokaleId,t.symbol];
          o.ingenFejl=!a.db.enheder.some(x=>x.navn==='Fejlrække'||x.navn==='Ugruppe');
          o.besked=a.toasts.some(x=>x.undo&&/2 brugsgenstande oprettet \(og 1 nye lokaler\)/.test(x.txt));
          a.undo(); await T(60); o.fortrudt=[a.db.enheder.length,a.db.lokaler.length];
          a.impAaben('lokale'); a.imp.tekst='Navn;Etage\\nImpLok;1. sal\\nImpLok2;\\n'+a.db.lokaler[0].navn+';2'; a.impAnalyser();
          o.lok=[a.imp.hdr,a.impAntal(),a.imp.fh[2].fejl.join()]; a.impGem(); await T(60);
          o.lokNy=a.db.lokaler.filter(l=>/^ImpLok/.test(l.navn)).map(l=>l.navn+'/'+l.etage);
          a.undo(); await T(60); o.lokFort=a.db.lokaler.some(l=>/^ImpLok/.test(l.navn));
          a.impAaben('enhed'); a.imp.tekst='Brugsgenstand;kabel;A\\nSpot;PVC;10'; a.impAnalyser(); o.amp=a.imp.fh[0].o.effekt; a.imp.aaben=false;
          return o}}""")
        tjek('import fra regneark: overskrifter, kW og komma-decimaler, nyt lokale, standardværdier; fejlrækker oprettes ikke',
             r['hdr'] is True and r['map'] == 'navn,lokale,gruppe,kw,kabel,laengde,tv' and r['ok'] == 2 and r['knap'] == 'Importér 2 rækker' and r['rader'] == 4
             and r['fejl'] == ['Ukendt kabeltype "Gummi"', 'Ukendt tavle "99"'] and r['efter'] == [r['foer'][0] + 2, r['foer'][1] + 1] and r['lukket']
             and r['ovn'] == [2500, 'XLPE', 2.5, 7.5, 'Importrum', True] and r['tom'][:5] == [0, 'PVC', '3G', 1.5, 10] and r['tom'][6] == 'auto'
             and r['ingenFejl'] and r['amp'] == 2300, r)
        tjek('import fra regneark: kan fortrydes i ét trin, og import af lokaler virker (semikolon, dublet afvises)',
             r['besked'] and r['fortrudt'] == r['foer'] and r['lok'][:2] == [True, 2] and 'findes allerede' in r['lok'][2]
             and r['lokNy'] == ['ImpLok/1. sal', 'ImpLok2/'] and r['lokFort'] is False, r)

        # 4n. Skema 16 (forslag 15): opgradering fra skema 15, billeder på tavle, lokale og samlepunkt, liste, dokumentation og lageradvarsel
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=15;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));for(const k of ['tavler','lokaler','daaser']) p[k].forEach(x=>delete x.billeder);p.projekt.navn='Skema 15-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {p:JSON.stringify(p), n:[p.tavler.length,p.lokaler.length,p.daaser.length], bl:p.brandlukninger.map(b=>b.billeder.length)}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const d=JSON.parse(JSON.stringify(a.db)), p=JSON.parse({json.dumps(r0['p'])});
          const tomme=['tavler','lokaler','daaser'].every(k=>d[k].every(x=>Array.isArray(x.billeder)&&!x.billeder.length));
          a.save();
          return {{navn:d.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, tomme,
            ens:['tavler','lokaler','daaser','grupper','enheder','brandlukninger'].every(k=>p[k].length===d[k].length&&p[k].every((x,n)=>Object.keys(x).every(f=>JSON.stringify(x[f])===JSON.stringify(d[k][n][f])))),
            bl:a.db.brandlukninger.map(b=>b.billeder.length)}}}})()""")
        tjek('opgradering fra skema 15: backup taget, data og brandlukningernes billeder intakte, billeder tom liste på tavler, lokaler og dåser',
             r['navn'] == 'Skema 15-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['tomme'] and r['ens'] and r['bl'] == r0['bl'] and sum(r0['n'][1:]) > 0 and r0['n'][0] > 0, (r, r0['n'], r0['bl']))
        r = await pg.evaluate("""(()=>{const d=norm({tavler:[{id:'t',billeder:['a1','a1','../x',3]}],lokaler:[{id:'l'}],daaser:[{id:'d',billeder:'x'}]});
          return [d.tavler[0].billeder,d.lokaler[0].billeder,d.daaser[0].billeder,[...billedIds({...d,brandlukninger:[{billeder:['b1']}]})].sort()]})()""")
        tjek('norm(): billeder på tavler, lokaler og dåser får standardværdi, ugyldige id\'er fjernes, billedIds samler alle', r == [['a1'], [], [], ['a1', 'b1']], r)
        hvor = {}
        for typ, liste in (('tavle', 'tavler'), ('lokale', 'lokaler'), ('daase', 'daaser')):
            await pg.evaluate(f"(()=>{{const a={A};a.openForm({json.dumps(typ)}, a.db.{liste}[0])}})()"); await pg.wait_for_timeout(120)
            synlig = await pg.evaluate("[!!document.querySelector('#bl-felt'), document.querySelector('#bl-kamera').getAttribute('capture'), document.querySelector('#bl-galleri').multiple]")
            await pg.set_input_files('#bl-kamera', files=[{'name': typ + '.png', 'mimeType': 'image/png', 'buffer': png}])
            await pg.wait_for_function(f"{A}.form.billeder.length===1 && !{A}.billedArbejder", timeout=15000)
            await pg.click('footer button[type=submit]'); await pg.wait_for_timeout(120)
            hvor[typ] = synlig + await pg.evaluate(f"(()=>{{const a={A};const x=a.db.{liste}[0];return [x.billeder.length, BFULD.has(x.billeder[0]), !!BMINI[x.billeder[0]], JSON.parse(localStorage.getItem('tavleoversigt.p.'+a.pid)).{liste}[0].billeder.length, a.modal]}})()")
        tjek('billeder på tavle, lokale og samlepunkt via formularen (kamera og galleri), gemt i IndexedDB og i projektet som id',
             all(v == [True, 'environment', True, 1, True, True, 1, None] for v in hvor.values()), hvor)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          for (const v of ['tavle','lokaler','samlepunkter']) {{ a.go(v); await T(120); o[v]=[...document.querySelectorAll('.bl-mini-s img')].filter(i=>i.offsetParent&&i.src.startsWith('data:image/jpeg')).length; }}
          const dup=a.db.daaser[0]; a.openForm('daase',dup); await T(60); a.dupElem(); await T(60); o.dup=a.db.daaser[a.db.daaser.length-1].billeder.length; a.undo(); await T(60);
          const doc=a.docHtml(), i=doc.indexOf('<h1>Billeder</h1>'), j=doc.indexOf('</section>', i);
          o.doc=[i>0, (doc.slice(i,j).match(/<img class="bl" src="data:image[/]jpeg/g)||[]).length, doc.slice(i,j).includes('<h2>Tavler</h2>')&&doc.slice(i,j).includes('<h2>Lokaler</h2>')&&doc.slice(i,j).includes('<h2>Samlepunkter</h2>'), i<doc.indexOf('<h1>Brandlukninger</h1>')];
          a.db.lokaler[1].billeder=['mangler9']; o.mangler=a.docHtml().includes('billede mangler på denne enhed'); a.db.lokaler[1].billeder=[];
          const lag=v=>Object.defineProperty(navigator,'storage',{{configurable:true,value:{{estimate:async()=>v}}}}); lag({{usage:95e6,quota:100e6}}); await a.billedLager(); a.go('dokumentation'); await T(80);
          const el=document.querySelector('#lager-adv'); o.lager=[!!el&&el.offsetParent!==null&&/ved at være fuldt: 91 MB af 95 MB/.test(el.textContent)];
          lag({{usage:5e6,quota:100e6}}); await a.billedLager(); await T(40); o.lager.push(a.lagerTxt()===''); delete navigator.storage; a.lager=null; a.go('tavle');
          return o}}""")
        tjek('billeder: miniaturer i listerne Tavler, Lokaler og Samlepunkter, duplikering kopierer ikke billeder',
             r['tavle'] == 1 and r['lokaler'] == 1 and r['samlepunkter'] == 1 and r['dup'] == 0, r)
        tjek('dokumentation: afsnit Billeder med små billeder af tavle, lokale og samlepunkt, manglende billede vises som tekst', r['doc'] == [True, 3, True, True] and r['mangler'], r['doc'])
        tjek('lageradvarsel (navigator.storage.estimate) over 80 % vises under Datasikring, ellers ikke', r['lager'] == [True, True], r['lager'])

        # 4o. Skema 18: opgradering fra skema 17, brandklasse som fritekst flyttes til afkrydsning, når alle dele er klasser fra listen; ellers uændret
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=17;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Skema 17-projekt';
          const kl=['EI60','ei30 / EI90','REI60','EI60 og noget',''];
          p.brandlukninger.forEach((b,n)=>{delete b.brandklasser;b.brandklasse=kl[n%kl.length];});
          for(let n=p.brandlukninger.length;n<kl.length;n++)p.brandlukninger.push({id:'s17_'+n,nr:900+n,lokaleId:'',placering:'S17 '+n,beskrivelse:'',brandklasse:kl[n],produkt:'',produkter:[],udfoert:false,maerkat:false,note:'',billeder:[]});
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {p:JSON.stringify(p)}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};const d=JSON.parse(JSON.stringify(a.db)), p=JSON.parse({json.dumps(r0['p'])});
          const ens=['tavler','lokaler','daaser','grupper','enheder','brandlukninger'].every(k=>p[k].length===d[k].length&&p[k].every((x,n)=>Object.keys(x).filter(f=>f!=='brandklasse').every(f=>JSON.stringify(x[f])===JSON.stringify(d[k][n][f]))));
          const kl=d.brandlukninger.slice(0,5).map(b=>[b.brandklasse,b.brandklasser]);
          a.save(); return {{navn:d.projekt.navn, b:a.backups.length, s:JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema, ens, kl,
            txt:a.brandKlasseTxt(d.brandlukninger[1]), doc:a.docHtml().includes('<td>EI30, EI90</td>')}}}})()""")
        tjek('opgradering fra skema 17: backup taget, data intakte, brandklasse flyttet til afkrydsning kun når alle dele kendes',
             r['navn'] == 'Skema 17-projekt' and r['b'] >= 1 and r['s'] == SKEMA and r['ens'] and r['txt'] == 'EI30, EI90' and r['doc']
             and r['kl'] == [['', ['EI60']], ['', ['EI30', 'EI90']], ['REI60', []], ['EI60 og noget', []], ['', []]], r)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          a.db.brandlukninger=a.db.brandlukninger.filter(b=>!/^s17_/.test(b.id)); a.save();
          a.openForm('brand',null,{{}}); await T(100); o.bokse=document.querySelectorAll('[id^="bk-"]').length; a.modal=null; await T(50);
          a.go('svag'); await T(80); a.openForm('rack',null,{{}}); await T(100); const sel=document.getElementById('m-rklok');
          o.ny=[...sel.options].some(x=>x.value==='__ny'); sel.value='__ny'; sel.dispatchEvent(new Event('change')); await T(80);
          o.hurtig=[a.hurtig&&a.hurtig.aaben, a.hurtig&&a.hurtig.type, a.modal&&a.modal.type]; a.hurtig.aaben=false; a.modal=null; a.go('tavle'); await T(50);
          return o}}""")
        tjek('brandklasser som afkrydsningsfelter; rackskabets lokaleliste kan oprette nyt lokale',
             r['bokse'] == 12 and r['ny'] and r['hurtig'] == [True, 'lokale', 'rack'], r)

        # 4p. Skema 19: svagstrømsforbindelser har status trukket. Opgradering fra skema 18, flueben i Svagstrøm og Lokaler, formular og aflevering
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=18;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Skema 18-projekt';p.links.forEach(l=>delete l.trukket);
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {p:JSON.stringify(p), n:p.links.length}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=JSON.parse(JSON.stringify(a.db)), p=JSON.parse({json.dumps(r0['p'])}), o={{}};
          o.ens=['tavler','lokaler','daaser','grupper','enheder','links','racks','udstyr','brandlukninger'].every(k=>p[k].length===d[k].length&&p[k].every((x,n)=>Object.keys(x).every(f=>JSON.stringify(x[f])===JSON.stringify(d[k][n][f]))));
          o.std=d.links.every(l=>l.trukket===false); a.save();
          o.meta=[d.projekt.navn, a.backups.length>=1, JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema];
          a.go('svag'); await T(120); const bokse=[...document.querySelectorAll('input.sv-trukket')].filter(x=>x.offsetParent); o.bokse=bokse.length;
          const l0=a.svLinks()[0]; bokse[0].click(); await T(80); a.gemNu(); o.sat=[l0.trukket, JSON.parse(localStorage.getItem('tavleoversigt.p.'+a.pid)).links.find(x=>x.id===l0.id).trukket];
          a.undo(); await T(60); o.fortrudt=a.db.links.find(x=>x.id===l0.id).trukket===false;
          const afl=()=>((a.aflTjek().find(k=>k.k==='trukket')||{{punkter:[]}}).punkter).filter(x=>x.k==='tx'+l0.id).length; o.afl=[afl()];
          a.openForm('link', a.db.links.find(x=>x.id===l0.id)); await T(100); o.felt=!!document.getElementById('m-ltrukket'); document.getElementById('m-ltrukket').click(); a.saveForm(); await T(80);
          o.form=a.db.links.find(x=>x.id===l0.id).trukket; o.afl.push(afl());
          a.go('lokaler'); await T(120); const lb=[...document.querySelectorAll('input.lok-trukket')].filter(x=>x.offsetParent&&/Kabel trukket: /.test(x.getAttribute('aria-label'))&&a.db.links.some(l=>'Kabel trukket: '+l.navn===x.getAttribute('aria-label')));
          o.lok=lb.length>0;
          a.mutate(()=>{{a.db.links.forEach(l=>l.trukket=false);}}); a.go('tavle'); await T(50);
          return o}}""")
        tjek('opgradering fra skema 18: backup taget, svagstrømsforbindelser intakte og ikke trukket; flueben i Svagstrøm, Lokaler og formularen gemmes og kan fortrydes',
             r['meta'] == ['Skema 18-projekt', True, SKEMA] and r['ens'] and r['std'] and r0['n'] > 0 and r['bokse'] == r0['n'] and r['sat'] == [True, True]
             and r['fortrudt'] and r['felt'] and r['form'] is True and r['lok'] and r['afl'] == [1, 0], r)

        # 4q. Datasikring (gennemgang 2026-11-25): anden fanes ændring læses frisk, Gist med 300 filer afvises, backup-id kontrolleres, ulæseligt projekt overskrives ikke
        r = await pg.evaluate(f"""async()=>{{const a={A};const o={{}};
          const x=a.projekter.find(p=>p.id!==a.pid); o.har=!!x;
          if(x){{ const d=a.laes(x.id), gl=d.projekt.navn; MEM[x.id]=JSON.stringify(Object.assign({{}},d,{{projekt:Object.assign({{}},d.projekt,{{navn:'Forældet'}})}})); const ny=JSON.stringify(Object.assign({{}},d,{{projekt:Object.assign({{}},d.projekt,{{navn:'Fra anden fane'}})}}));
            localStorage.setItem(PK(x.id),ny); window.dispatchEvent(new StorageEvent('storage',{{key:PK(x.id),newValue:ny}})); o.frisk=a.laes(x.id).projekt.navn; a.skriv(x.id,d); o.gl=a.laes(x.id).projekt.navn===gl; }}
          const gh=a.gh, s0=a.synk, n0=a.projekter.length, files={{'tavleoversigt.json':{{content:'{{"schema":1}}'}}}};
          for(let i=0;i<299;i++) files['tavleoversigt-p'+i+'.json']={{content:'x'}};
          a.gh=async()=>({{files}}); a.synk={{token:'t',gistId:'g',base:{{}}}};
          try{{ await a.synkKoer(); o.mange='ingen fejl'; }}catch(e){{ o.mange=/for mange filer/.test(e.message); }}
          a.gh=gh; a.synk=s0; o.n=a.projekter.length===n0;
          a.importBackup({{format:'tavleoversigt-backup',projekter:[{{id:'ugyldigt.id',data:{{tavler:[],grupper:[],enheder:[],projekt:{{navn:'Id-test'}}}}}}]}});
          const im=a.projekter.find(p=>p.navn==='Id-test'); o.id=!!im&&BID.test(im.id)&&im.id!=='ugyldigt.id'; if(im) a.sletProjekt(im.id);
          return o}}""")
        tjek('datasikring: projekt ændret i anden fane læses frisk, Gist med 300 filer afvises uden ændringer, ugyldigt projekt-id fra backup udskiftes',
             r['har'] and r['frisk'] == 'Fra anden fane' and r['gl'] and r['mange'] is True and r['n'] and r['id'], r)
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter')), id=i.aktiv, gl=localStorage.getItem('tavleoversigt.p.'+id);
          localStorage.setItem('tavleoversigt.p.'+id,'{"tavler":[null]}'); return {id, gl}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""(()=>{{const a={A};return {{pid:a.pid, raa:localStorage.getItem('tavleoversigt.p.'+{json.dumps(r0['id'])}), liste:a.projekter.some(p=>p.id==={json.dumps(r0['id'])}), fejl:a.toasts.some(t=>t.fejl&&/kunne ikke læses/.test(t.txt))}}}})()""")
        await pg.evaluate(f"""(()=>{{const a={A};localStorage.setItem('tavleoversigt.p.'+{json.dumps(r0['id'])},{json.dumps(r0['gl'])});const ny=a.pid;a.sletProjekt(ny);a.gemNu();
          const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.aktiv={json.dumps(r0['id'])};localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        tilbage = await pg.evaluate(f"{A}.pid")
        tjek('start: et ulæseligt projekt overskrives ikke, et nyt tomt projekt åbnes, og der vises en fejl',
             r['pid'] != r0['id'] and r['raa'] == '{"tavler":[null]}' and r['liste'] and r['fejl'] and tilbage == r0['id'], (r, tilbage))

        # 4r. Lokaler: listerne har fast højde med rulning, udvid ét lokale eller alle, og + Samledåse åbner formularen med lokalet valgt
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          a.lokF=''; a.go('lokaler'); await T(150); const kort=()=>[...document.querySelectorAll('.lok-lister')], fast=()=>kort().map(x=>x.classList.contains('max-h-80'));
          o.start=fast().every(Boolean)&&kort().length===a.db.lokaler.length;
          document.querySelector('.lok-fold').click(); await T(60); const f1=fast(); o.en=!f1[0]&&f1.slice(1).every(Boolean);
          document.getElementById('lok-alle').click(); await T(60); o.alleUd=fast().every(x=>!x)&&document.getElementById('lok-alle').textContent.trim()==='Fold alle sammen';
          document.getElementById('lok-alle').click(); await T(60); o.alleInd=fast().every(Boolean);
          const l=a.db.lokaler[0]; [...document.querySelectorAll('article button')].find(b=>b.textContent.trim()==='+ Samledåse').click(); await T(100);
          o.daase=[a.modal&&a.modal.type, a.form.lokaleId===l.id]; a.modal=null; a.go('tavle'); await T(50);
          return o}}""")
        tjek('lokaler: fast højde med rulning, udvid ét eller alle lokaler, + Samledåse med lokalet valgt',
             r['start'] and r['en'] and r['alleUd'] and r['alleInd'] and r['daase'] == ['daase', True], r)

        # 4s. Skema 20: højtalerkabel fra en forstærker. Opgradering fra skema 19, formular, ingen 230 V-last, ΔU, Iz eller Ik, egen stil i enstreg, egen linje i materialelisten
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=19;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Skema 19-projekt';
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {p:JSON.stringify(p)}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const d=JSON.parse(JSON.stringify(a.db)), p=JSON.parse({json.dumps(r0['p'])}), o={{}};
          o.ens=['tavler','lokaler','daaser','grupper','enheder','links','brandlukninger'].every(k=>p[k].length===d[k].length&&p[k].every((x,n)=>Object.keys(x).every(f=>JSON.stringify(x[f])===JSON.stringify(d[k][n][f]))));
          a.save(); o.meta=[d.projekt.navn, a.backups.length>=1, JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema];
          const g=a.db.grupper[0], fs=a.db.enheder.find(e=>e.gruppeId===g.id&&!a.erHoejt(e)); const I0=a.gruppeI(g.id), W0=a.tavleW(g.tavleId), ik0=a.ikMin(g);
          a.openForm('enhed',null,{{gruppeId:g.id}}); await T(80); const harFoer=[...document.querySelectorAll('#m-kabel option')].some(x=>x.value==='Højtalerkabel');
          a.form.navn='Højtaler test'; await T(80); o.valg=[harFoer, [...document.querySelectorAll('#m-kabel option')].some(x=>x.value==='Højtalerkabel'), a.symbolFor(a.form)];
          Object.assign(a.form,{{kabel:'Højtalerkabel',ledere:'3G',tv:0.75,laengde:30,belVal:60,belEnh:'W',effekt:60,fraEnhed:fs.id}}); a.sloejfeValg(); await T(60);
          o.tvValg=[...document.querySelectorAll('#m-tv option')].map(x=>Number(x.value)); a.saveForm(); await T(80);
          const h=a.db.enheder.find(e=>e.navn==='Højtaler test'); o.rec=h&&[h.kabel,h.ledere,h.tv,h.fraEnhed===fs.id];
          a.openForm('enhed',null,{{gruppeId:g.id}}); await T(60); Object.assign(a.form,{{navn:'Højtaler kæde',antal:3,kabel:'Højtalerkabel',tv:1.5,fraEnhed:fs.id}}); await T(60); document.getElementById('m-kaede').click(); await T(80);
          const kv=document.getElementById('m-kkabel'); o.kaedeValg=[...kv.options].some(x=>x.value==='Højtalerkabel')&&a.form.kKabel==='Højtalerkabel';
          a.form.kTv=0.75; a.form.kLedere='3G'; a.saveForm(); await T(80); const ks=a.db.enheder.filter(e=>/^Højtaler kæde/.test(e.navn));
          o.kaede=[ks.length, ks.every(e=>e.kabel==='Højtalerkabel'&&e.ledere==='2X'), ks.slice(1).every(e=>e.tv===0.75)]; a.db.enheder=a.db.enheder.filter(e=>!/^Højtaler kæde/.test(e.navn)); a.save();
          o.calc=[a.strom(h), a.gruppeI(g.id)===I0, a.tavleW(g.tavleId)===W0, a.duOver(h), a.iz(h), a.izFejl(h), JSON.stringify(a.ikMin(g))===JSON.stringify(ik0), a.lmax(h), a.forslag(h)];
          o.sld=a.sld(false).includes('class="l hj"')&&a.sld(true).includes('.hj{{');
          o.mat=JSON.stringify(a.materialer()).includes('Højtalerkabel 2X0,75 mm²');
          o.norm=JSON.stringify(norm({{enheder:[{{id:'x',kabel:'Højtalerkabel',ledere:'5G',tv:6}},{{id:'y',kabel:'Ukendt'}}]}}).enheder.map(e=>[e.kabel,e.ledere,e.tv]));
          a.db.enheder=a.db.enheder.filter(e=>e.id!==h.id); a.save(); a.modal=null;
          return o}}""")
        tjek('opgradering fra skema 19: backup taget, data intakte; højtalerkabel kun for højtaler, ingen 230 V-last, ΔU, Iz eller Ik, stiplet i enstreg, egen linje i materialelisten',
             r['meta'] == ['Skema 19-projekt', True, SKEMA] and r['ens'] and r['valg'] == [False, True, 'hoejt'] and r['tvValg'] == [0.75, 1.5, 2.5, 4]
             and r['rec'] == ['Højtalerkabel', '2X', 0.75, True] and r['kaedeValg'] and r['kaede'] == [3, True, True] and r['calc'] == [0, True, True, False, 0, False, True, None, None] and r['sld'] and r['mat']
             and r['norm'] == '[["Højtalerkabel","2X",1.5],["PVC",null,null]]', r)

        # 4t. Enstreg: fuld skærm (Esc lukker) og egen lys/mørk baggrund kun på diagrammet, husket i browseren
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          a.go('enstreg'); await T(200); const box=()=>document.querySelector('.sldbox'), v=(el,k)=>getComputedStyle(el).getPropertyValue(k).trim();
          const sel=document.getElementById('sld-tema'); const rodFoer=v(document.documentElement,'--raised');
          for (const t of ['lys','moerk']) {{ sel.value=t; sel.dispatchEvent(new Event('change')); await T(60); o[t]=[box().classList.contains('sld-'+t), v(box(),'--raised'), localStorage.getItem('tavleoversigt.diagramtema')]; }}
          o.rod=v(document.documentElement,'--raised')===rodFoer;
          document.getElementById('sld-stor').click(); await T(120); const pn=box().parentElement, rc=pn.getBoundingClientRect();
          o.stor=[getComputedStyle(pn).position, Math.round(rc.height)===innerHeight, Math.round(rc.width)===innerWidth, box().getBoundingClientRect().height>innerHeight-120];
          document.dispatchEvent(new KeyboardEvent('keydown',{{key:'Escape',bubbles:true}})); window.dispatchEvent(new KeyboardEvent('keydown',{{key:'Escape'}})); await T(80); o.lukket=!a.sldStor&&getComputedStyle(pn).position!=='fixed';
          a.skiftSldTema(''); a.go('tavle'); await T(50);
          return o}}""")
        tjek('enstreg: fuld skærm fylder vinduet og lukkes med Esc; lys og mørk baggrund kun på diagrammet, husket i browseren',
             r['lys'] == [True, '#ffffff', 'lys'] and r['moerk'] == [True, '#242b30', 'moerk'] and r['rod'] and r['stor'] == ['fixed', True, True, True] and r['lukket'], r)

        # 4u. Skema 21: fanen Plantegning. Opgradering fra skema 20, upload af billede og PDF (falsk pdf.js), prikker, målestok, måling, lokale, dokumentation og billedIds
        r0 = await pg.evaluate("""(()=>{const i=JSON.parse(localStorage.getItem('tavleoversigt.projekter'));i.schema=20;const id=i.aktiv;
          const p=JSON.parse(localStorage.getItem('tavleoversigt.p.'+id));p.projekt.navn='Skema 20-projekt';delete p.tegninger;
          localStorage.setItem('tavleoversigt.p.'+id,JSON.stringify(p));localStorage.setItem('tavleoversigt.projekter',JSON.stringify(i));localStorage.removeItem('tavleoversigt.backups');
          return {p:JSON.stringify(p)}})()""")
        await pg.goto(URL); await pg.wait_for_timeout(500)
        r1 = await pg.evaluate(f"""(()=>{{const a={A};const d=JSON.parse(JSON.stringify(a.db)), p=JSON.parse({json.dumps(r0['p'])});
          const ens=['tavler','lokaler','daaser','grupper','enheder','links','brandlukninger'].every(k=>p[k].length===d[k].length&&p[k].every((x,n)=>Object.keys(x).every(f=>JSON.stringify(x[f])===JSON.stringify(d[k][n][f]))));
          a.save(); return {{ens, tom:Array.isArray(d.tegninger)&&!d.tegninger.length, meta:[d.projekt.navn, a.backups.length>=1, JSON.parse(localStorage.getItem('tavleoversigt.projekter')).schema]}}}})()""")
        tjek('opgradering fra skema 20: backup taget, data intakte, tom liste med plantegninger',
             r1['ens'] and r1['tom'] and r1['meta'] == ['Skema 20-projekt', True, SKEMA], r1)
        await pg.evaluate(f"""(()=>{{const a={A}; a.lokF=''; window.pdfjsLib={{GlobalWorkerOptions:{{}}, getDocument:()=>({{promise:Promise.resolve({{numPages:2, getPage:async n=>({{
          getViewport:({{scale}})=>({{width:600*scale,height:400*scale}}), render:({{canvasContext:x}})=>({{promise:(x.fillStyle='#246',x.fillRect(100,100,800,500),Promise.resolve())}})}})}})}})}}; a.go('plan');}})()""")
        await pg.wait_for_timeout(150)
        await pg.set_input_files('#pl-fil', files=[{'name': 'Stueetage.png', 'mimeType': 'image/png', 'buffer': png}, {'name': 'El 1.sal.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 test'}])
        await pg.wait_for_function(f"{A}.db.tegninger.length===3 && !{A}.billedArbejder", timeout=15000)
        await pg.wait_for_timeout(150)
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}}, L=a.db.tegninger;
          o.navne=L.map(t=>t.navn); o.forhold=Math.round(L[1].forhold*1000)/1000; o.bil=L.every(t=>BFULD.has(t.billede)&&!!BMINI[t.billede]); o.ids=L.every(t=>billedIds(a.db).has(t.billede));
          const t=L[1]; a.planVaelgT(t.id); await T(120); const svg=()=>document.querySelector('#pl-tegning svg');
          o.vist=!!svg()&&svg().innerHTML.includes('data:image/jpeg');
          const klik=(x,y)=>{{const s=svg().getBoundingClientRect(); svg().dispatchEvent(new MouseEvent('click',{{bubbles:true,clientX:s.left+x*s.width,clientY:s.top+y*s.width}}));}};
          const e=a.db.enheder[0], lok=a.db.lokaler[0];
          document.getElementById('pl-placer').click(); await T(60); a.planVaelg='e:'+e.id; klik(0.5,0.25); await T(80);
          o.punkt=t.punkter.length===1&&t.punkter[0].k==='e:'+e.id&&Math.abs(t.punkter[0].x-0.5)<0.01&&Math.abs(t.punkter[0].y-0.25)<0.01;
          o.prik=svg().querySelectorAll('g.pp').length===1;
          a.planVaelg='e:'+e.id; klik(0.2,0.1); await T(60); o.flyttet=t.punkter.length===1&&Math.abs(t.punkter[0].x-0.2)<0.01;
          o.maalLaast=document.getElementById('pl-maal').disabled;
          document.getElementById('pl-skala').click(); await T(60); klik(0.1,0.3); klik(0.6,0.3); a.planSkalaM='10'; a.planSkalaGem(t); await T(60); o.skala=Math.round(t.skala*100)/100;
          document.getElementById('pl-maal').click(); await T(60); klik(0.1,0.1); klik(0.3,0.1); klik(0.3,0.2); await T(60);
          o.laengde=document.getElementById('pl-laengde').textContent.trim(); a.planMaalTil='e:'+e.id; const L0=e.laengde, m=a.planM(t); o.m=Math.abs(m-6)<0.05; o.forv=Math.ceil(Math.round(m*100)/50)/2; a.planBrugLaengde(t); o.brugt=e.laengde===o.forv&&o.forv%0.5===0&&o.forv>=m;
          document.dispatchEvent(new KeyboardEvent('keydown',{{key:'Escape',bubbles:true}})); await T(40); o.esc=a.planMode==='';
          a.planSaet(t,'lokaleId',lok.id); a.go('lokaler'); await T(150); o.lokKnap=[...document.querySelectorAll('.pl-lok')].some(b=>b.textContent.trim()===t.navn);
          a.lokF=lok.id; o.filter=a.planListe().map(x=>x.id).join()===t.id; a.lokF='';
          const doc=a.docHtml(); o.doc=doc.includes('<h1>Plantegninger</h1>')&&doc.includes('<image href="data:image/jpeg')&&doc.includes('✓ Færdig')!==doc.includes('<b>Mangler</b>');
          o.norm=JSON.stringify(norm({{tegninger:[{{id:'t1',billede:'../x',forhold:0.5,punkter:[{{k:'e:a',x:2,y:0.9}},{{k:'e:a',x:0.1,y:0.1}},{{k:'q:z',x:0,y:0}}]}}]}}).tegninger[0]);
          e.laengde=L0; a.lokF=''; a.db.tegninger=[]; a.save(); a.planNulstil(); a.go('tavle'); await T(50);
          return o}}""")
        tjek('plantegning: billede og PDF (én tegning pr. side) gemt i IndexedDB og billedIds, prik placeres og flyttes, målestok og måling sætter kabellængden, lokale, dokumentation',
             r['navne'] == ['Stueetage', 'El 1.sal · side 1', 'El 1.sal · side 2'] and r['forhold'] == 0.667 and r['bil'] and r['ids'] and r['vist'] and r['punkt'] and r['prik']
             and r['flyttet'] and r['maalLaast'] and r['skala'] == 20 and r['laengde'] == '6 m' and r['m'] and r['brugt'] is True and r['esc'] and r['lokKnap'] and r['filter'] and r['doc']
             and r['norm'] == '{"id":"t1","billede":"","forhold":0.5,"punkter":[{"k":"e:a","x":1,"y":0.5}],"navn":"","lokaleId":"","skala":0}', r)

        # 4v. Lokaler: + Dataudtag og + Kamera med lokalet valgt, og brugsgenstande kan flyttes op og ned inden for lokalet
        r = await pg.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const o={{}};
          a.lokF=''; a.lokAlleUd=true; a.go('lokaler'); await T(150);
          const l=a.db.lokaler.find(l=>a.enhederILokale(l.id).length>=2), art=[...document.querySelectorAll('#lok-'+l.id+', article')].find(x=>x.querySelector('h2')&&x.querySelector('h2').textContent===l.navn);
          art.querySelector('.lok-data').click(); await T(80); o.data=[a.modal&&a.modal.type, a.form.art, a.form.lokaleId===l.id]; a.modal=null; await T(40);
          art.querySelector('.lok-kam').click(); await T(80); o.kam=[a.form.art, a.form.lokaleId===l.id]; a.modal=null; await T(40);
          const ids=()=>a.enhederILokale(l.id).map(e=>e.id), f0=ids();
          art.querySelectorAll('.lok-ned')[0].click(); await T(80); const f1=ids(); o.ned=f1[0]===f0[1]&&f1[1]===f0[0];
          art.querySelectorAll('.lok-op')[1].click(); await T(80); o.op=JSON.stringify(ids())===JSON.stringify(f0);
          a.undo(); await T(40); o.fortryd=JSON.stringify(ids())===JSON.stringify(f1); a.redo(); await T(40);
          a.lokAlleUd=false; a.go('tavle'); await T(50);
          return o}}""")
        tjek('lokaler: + Dataudtag og + Kamera med lokalet valgt; brugsgenstande flyttes op og ned inden for lokalet og kan fortrydes',
             r['data'] == ['link', 'data', True] and r['kam'] == ['cctv', True] and r['ned'] and r['op'] and r['fortryd'], r)

        await pg.evaluate(f"{A}.go('tavle')")

        # 5. Backupfil kan hentes og indlæses uden at overskrive. Den indeholder billederne
        async with pg.expect_download() as dl:
            await pg.evaluate(f"{A}.hentBackup()")
        fil = await (await dl.value).path()
        bak = json.loads(Path(fil).read_text(encoding='utf-8'))
        r = await pg.evaluate(f"[...billedIds({A}.db)]")
        tjek('backupfilen indeholder billederne til brandlukninger, tavler, lokaler og samlepunkter', sorted(bak.get('billeder', {})) == sorted(r) and len(r) == 5
             and all(v.startswith('data:image/jpeg;base64,') for v in bak['billeder'].values()), (sorted(bak.get('billeder', {})), r))
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
          a.pf={{navn:'Synkprojekt',sagsnr:'S1',kunde:'',adresse:''}};a.nytProjekt();}}""")
        await pa.evaluate(f"{A}.go('brand')"); await pa.wait_for_timeout(100)
        await pa.click('#bl-ny'); await pa.wait_for_timeout(100); await pa.fill('#m-navn', 'Synk-lukning')
        await pa.set_input_files('#bl-kamera', files=[{'name': 'kamera.png', 'mimeType': 'image/png', 'buffer': png}])
        await pa.wait_for_function(f"{A}.form.billeder.length===1 && !{A}.billedArbejder", timeout=15000)
        await pa.click('footer button[type=submit]'); await pa.wait_for_timeout(100)
        bid = await pa.evaluate(f"(async()=>{{const a={A};await a.synkNu();return a.db.brandlukninger[0].billeder[0]}})()")
        bnavn = 'tavleoversigt-billede-' + bid + '.txt'
        foer_bp = len(BPATCH)
        await pa.evaluate(f"(async()=>{{const a={A};await a.synkNu();a.synk.bSendt=[];a.synkGem();await a.synkNu();}})()")
        tjek('billedsynk: billedet sendes én gang til en separat billed-Gist, projekt-Gist\'en har ingen billeder',
             BFIL in BGIST and bnavn in BGIST and BGIST[bnavn].startswith('data:image/jpeg;base64,') and [p for p in BPATCH if bnavn in p] == [[bnavn, BFIL]]
             and len(BPATCH) == foer_bp and not any('billede' in n for n in GIST) and json.loads(BGIST[BFIL])['schema'] == SKEMA,
             (sorted(BGIST), BPATCH, sorted(GIST)))
        tjek('synk: nyt projekt sendes, eksempler gør ikke', projekter_i_gist() == ['Synkprojekt'], projekter_i_gist())
        await pb.evaluate(f"""async()=>{{const a={A};a.synkTokenInput='test-token';await a.synkForbind();}}""")
        tjek('synk: anden enhed henter projektet', 'Synkprojekt' in await navne(pb), await navne(pb))
        r = await pb.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const id={json.dumps(bid)};
          a.skift(a.projekter.find(p=>p.navn==='Synkprojekt').id); a.go('brand'); await T(150);
          const rec=await bdbKoer(['billeder'],'readonly',tx=>tx.objectStore('billeder').get(id));
          return {{har:BFULD.has(id), mini:!!BMINI[id], data:rec?rec.data:'', vist:document.querySelectorAll('#bl-liste .bl-mini img').length, s:a.synk.bSendt.includes(id), fejl:a.synkFejl}}}}""")
        tjek('billedsynk: enhed 2 henter billedet via raw_url, laver miniature og viser det', r['har'] and r['mini'] and r['data'] == BGIST[bnavn] and r['vist'] == 1 and r['s'] and not r['fejl'],
             {k: v for k, v in r.items() if k != 'data'} | {'data ens': r['data'] == BGIST[bnavn]})
        BGIST[BFIL] = json.dumps({'format': 'tavleoversigt-billeder', 'schema': 999})
        r = await pb.evaluate(f"""async()=>{{const a={A};BFULD.delete({json.dumps(bid)});await a.synkNu();const f=a.synkFejl;BFULD.add({json.dumps(bid)});return f}}""")
        tjek('billedsynk: nyere skema i billed-Gist\'en afvises', 'nyere version' in r, r)
        BGIST[BFIL] = json.dumps({'format': 'tavleoversigt-billeder', 'schema': SKEMA})
        await pb.evaluate(f"(async()=>{{const a={A};a.synkFejl='';await a.synkNu();}})()")
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
        r = await pb.evaluate(f"""async()=>{{const a={A};const pid=a.pid,kunde=a.db.projekt.kunde,n0=a.projekter.length;
          await a.historikAabn();const L=a.historik.liste.map(v=>v.kunde);const nu=a.historik.liste.filter(v=>a.historikNu(v)).length;
          const gl=a.historik.liste.length-1;a.historikGendan(gl);const ny=a.projekter[a.projekter.length-1];const d=a.laes(ny.id);
          const v=a.historik.liste[0];v.schema=999;const n1=a.projekter.length;a.historikGendan(0);
          a.skriv(pid,norm(JSON.parse(JSON.stringify(a.historik.liste[1].d))));const nuEfter=a.historik.liste.map(v=>a.historikNu(v));
          return {{nuEfter,L,nu,ny:ny.id!==pid&&/\(fra /.test(ny.navn),gammelKunde:d.projekt.kunde,aktiv:a.pid===pid&&a.db.projekt.kunde===kunde,
                  antal:[n0,n1,a.projekter.length],fejl:a.toasts.some(t=>t.fejl&&/nyere version/.test(t.txt))}}}}""")
        tjek('historik: ændrede versioner vises én gang, den nuværende markeres, gendan som kopi, aktivt projekt urørt, nyere skema afvises',
             len(r['L']) >= 3 and len(set(r['L'])) == len(r['L']) and r['nu'] == 0 and r['nuEfter'] == [False, True] + [False] * (len(r['L']) - 2) and r['ny'] and r['gammelKunde'] == r['L'][-1]
             and r['aktiv'] and r['antal'][1] == r['antal'][0] + 1 and r['antal'][2] == r['antal'][1] and r['fejl'], r)
        # 6b. Skema 16: billeder på tavle, lokale og samlepunkt synkes via billed-Gist'en (forslag 15)
        LAV = """const lav=async(id,farve,alder)=>{const c=document.createElement('canvas');c.width=60;c.height=40;const x=c.getContext('2d');x.fillStyle=farve;x.fillRect(0,0,60,40);
          const d=c.toDataURL('image/jpeg',0.6);await a.billedGem(id,d,d);if(alder)await bdbKoer(['mini'],'readwrite',tx=>tx.objectStore('mini').put({id,data:d,oprettet:new Date(Date.now()-alder).toISOString()}));return d;};"""
        await pa.evaluate(f"""async()=>{{const a={A};{LAV}
          a.skift(a.projekter.find(p=>p.navn==='Synkprojekt').id);
          await lav('s16t','#a33'); await lav('s16l','#3a3'); await lav('s16d','#33a');
          a.mutate(()=>{{a.db.tavler.push({{id:'st1',navn:'ST',billeder:['s16t']}}); a.db.lokaler.push({{id:'sl1',navn:'Kælder',billeder:['s16l']}});
            a.db.daaser.push({{id:'sd1',navn:'Skjult dåse',type:'Underlag',billeder:['s16d']}});}}); await a.synkNu();}}""")
        g2 = lambda i: 'tavleoversigt-billede-' + i + '.txt'
        r = await pb.evaluate(f"""async()=>{{const a={A};await a.synkNu();const p=a.projekter.map(p=>a.laes(p.id)).find(d=>d&&d.tavler.some(t=>t.id==='st1'));
          return {{har:['s16t','s16l','s16d'].map(i=>BFULD.has(i)&&!!BMINI[i]), felter:[p.tavler.find(t=>t.id==='st1').billeder,p.lokaler.find(l=>l.id==='sl1').billeder,p.daaser.find(d=>d.id==='sd1').billeder], f:a.synkFejl}}}}""")
        tjek('billedsynk: billeder på tavle, lokale og samlepunkt sendes til billed-Gist\'en og hentes på enhed 2',
             all(g2(i) in BGIST for i in ('s16t', 's16l', 's16d')) and r['har'] == [True] * 3 and r['felter'] == [['s16t'], ['s16l'], ['s16d']] and not r['f'] and not any('billede' in n for n in GIST),
             (r, sorted(BGIST)))

        # 6c. Ny billed-Gist ved grænsen (forslag 21). Grænsen sættes til 2 billeder pr. billed-Gist
        foer_g = set(BGISTS)
        r = await pa.evaluate(f"""async()=>{{const a={A};{LAV} BMAKS=2;
          for (const i of ['m1','m2','m3']) await lav(i,'#888');
          a.mutate(()=>{{a.db.tavler.find(t=>t.id==='st1').billeder.push('m1','m2','m3');}}); await a.synkNu(); const o={{f:a.synkFejl,bGist:a.synk.bGist,sendt:['m1','m2','m3'].every(i=>a.synk.bSendt.includes(i))}}; BMAKS=250; return o}}""")
        nye = sorted(set(BGISTS) - foer_g)
        fordelt = [sorted(n for n in BGISTS[g] if n != BFIL) for g in nye]
        tjek('billed-Gist: ved grænsen oprettes nye billed-Gists med markør, højst 2 billeder i hver',
             len(nye) == 2 and fordelt == [[g2('m1'), g2('m2')], [g2('m3')]] and all(BFIL in BGISTS[g] for g in nye) and r['bGist'] == nye[-1] and r['sendt'] and not r['f'],
             (r, nye, fordelt))
        r = await pb.evaluate(f"""async()=>{{const a={A};await a.synkNu();return {{har:['m1','m2','m3'].map(i=>BFULD.has(i)), f:a.synkFejl}}}}""")
        tjek('billed-Gist: enhed 2 henter billeder fra alle billed-Gists', r['har'] == [True] * 3 and not r['f'], r)
        # svaret på upload læses ikke (udenSvar), og et brugt billede, som mangler i alle billed-Gists, sendes igen ved første synk i en ny session
        del BGIST[g2('s16l')]
        r = await pa.evaluate(f"""async()=>{{const a={A};BTJEKKET=false;await a.synkNu();return a.synkFejl}}""")
        tjek('billedsynk: kontrol pr. session sender et brugt billede igen, hvis det mangler på GitHub', any(g2('s16l') in f for f in BGISTS.values()) and not r, (r, sorted(BGIST)))

        # 6d. Oprydning (forslag 20): kun ubrugte billeder slettes. Intet, der bruges i en backup eller på en anden enhed
        DAG = 2 * 24 * 3600 * 1000
        r = await pa.evaluate(f"""async()=>{{const a={A};{LAV}
          const x1=await lav('ox1','#f00',{DAG}); await lav('ox2','#0f0',{DAG}); await lav('ox4','#00f',0);
          const bl=JSON.parse(localStorage.getItem('tavleoversigt.backups')||'[]'); bl.push({{tid:new Date().toISOString(),grund:'test',app:'x',schema:{SKEMA},navne:[],idx:{{}},raw:{{zz:JSON.stringify({{tavler:[{{id:'t',navn:'T',billeder:['ox2']}}]}})}}}});
          localStorage.setItem('tavleoversigt.backups',JSON.stringify(bl)); return x1}}""")
        BGIST[g2('ox1')] = r; BGIST[g2('ox3')] = r; BGISTS[nye[0]][g2('ox5')] = r
        PGISTS['g9'] = {'tavleoversigt.json': json.dumps({'format': 'tavleoversigt-sync', 'schema': SKEMA}), 'tavleoversigt-andet.json': '{'}
        brugte = await pa.evaluate(f"[...{A}.brugteBilleder()]")
        r = await pa.evaluate(f"""async()=>{{const a={A};await a.billedOprydAabn();return {{f:a.opryd.fejl,fund:a.opryd.fund,dlg:!!document.querySelector('#opryd')}}}}""")
        tjek('oprydning: en projekt-Gist, der ikke kan læses (anden enhed), stopper oprydningen, og intet kan slettes',
             'Intet er slettet' in r['f'] and r['fund'] is None and r['dlg'] and g2('ox1') in BGIST, r)
        PGISTS['g9']['tavleoversigt-andet.json'] = json.dumps({'tavler': [{'id': 't9', 'navn': 'Fra anden enhed', 'billeder': ['ox3']}]})
        r = await pa.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));await a.billedOprydAabn();await T(80);const f=a.opryd.fund;
          return {{f:a.opryd.fejl, lokal:f&&f.lokal.map(x=>x.id).sort(), gh:f&&f.gh.map(x=>x.id).sort(), nye:f&&f.nye, synk:f&&f.synk,
            tekst:[document.querySelector('#opryd-lokal').textContent, document.querySelector('#opryd-gh').textContent]}}}}""")
        tjek('oprydning: finder kun ubrugte billeder (ikke i projekter, backups, andre enheder eller nyere end 24 timer) og viser antal og størrelse',
             not r['f'] and r['lokal'] == ['ox1'] and r['gh'] == ['ox1', 'ox5'] and r['nye'] >= 1 and r['synk']
             and re.search(r'På enheden: 1 billeder, \d+ KB', r['tekst'][0]) and re.search(r'På GitHub: 2 billeder, \d+ KB', r['tekst'][1]), r)
        await pa.click('#opryd-slet'); await pa.wait_for_timeout(80)
        mellem = await pa.evaluate(f"[{A}.opryd.slettet, BFULD.has('ox1')]")
        await pa.click('#opryd-slet')
        await pa.wait_for_function(f"{A}.opryd && {A}.opryd.slettet && !{A}.opryd.henter", timeout=15000)
        r = await pa.evaluate(f"""async()=>{{const a={A};const keys=await bdbKoer(['billeder'],'readonly',tx=>tx.objectStore('billeder').getAllKeys()), mk=await bdbKoer(['mini'],'readonly',tx=>tx.objectStore('mini').getAllKeys());
          const brugte={json.dumps(brugte)};
          return {{s:a.opryd.slettet, ox:['ox1','ox2','ox4'].map(i=>keys.includes(i)&&mk.includes(i)), mem:[BFULD.has('ox1'),!!BMINI['ox1']], brugte:brugte.every(i=>keys.includes(i)), f:a.opryd.fejl, sendt:a.synk.bSendt.includes('ox1')}}}}""")
        alle_gh = set().union(*[set(f) for f in BGISTS.values()])
        tjek('oprydning: sletter først efter bekræftelse, kun ubrugte billeder på enheden og i billed-Gists; backup, anden enhed og nye billeder røres ikke',
             mellem == [None, True] and r['s']['lokal'] == 1 and r['s']['gh'] == 2 and r['ox'] == [False, True, True] and r['mem'] == [False, False] and r['brugte'] and not r['f'] and not r['sendt']
             and g2('ox1') not in alle_gh and g2('ox5') not in alle_gh and g2('ox3') in BGIST and all(g2(i) in alle_gh for i in brugte) and all(BFIL in f for f in BGISTS.values() if f),
             (r, mellem, sorted(alle_gh)))
        await pa.evaluate(f"{A}.modal=null"); PGISTS.clear()
        r = await pb.evaluate(f"""async()=>{{const a={A};Object.defineProperty(navigator,'onLine',{{configurable:true,get:()=>false}});
          a.synkFejl='';await a.synkNu();const r={{f:a.synkFejl,t:a.synkTxt()}};delete navigator.onLine;a.online=true;return r}}""")
        tjek('synk: uden net ingen fejl, status viser offline', r['f'] == '' and 'offline' in r['t'], r)
        r = await pb.evaluate(f"""async()=>{{const a={A};a.synkAfbryd();return {{s:localStorage.getItem('tavleoversigt.sync'),n:a.projekter.length}}}}""")
        tjek('synk: slå fra fjerner token men ikke projekter', r['s'] is None and r['n'] >= 3, r)

        # Mobil: 390 px bred telefon
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.set_default_timeout(TRIN_MS)
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
        r = await pm.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const smaa=new Set(), groft=matchMedia('(pointer:coarse)').matches;
          const tjekF=sted=>document.querySelectorAll('input,select,textarea').forEach(el=>{{if(el.offsetParent===null||['checkbox','radio','range','color','file','hidden'].includes(el.type))return;
            const fs=parseFloat(getComputedStyle(el).fontSize); if(fs<16) smaa.add(sted+': '+(el.id||el.className||el.tagName)+' '+fs);}});
          for (const v of a.views.map(v=>v.id)) {{ a.go(v); await T(120); tjekF(v); }}
          a.mutate(()=>{{a.db.brandlukninger.push({{id:'mb1',nr:1,lokaleId:a.db.lokaler[0].id,placering:'Væg mod trappe, 30 cm under loft, ved siden af ventilationskanalen',beskrivelse:'3 kabler + 1 rør gennem EI60-væg mellem lejlighed og trappeopgang',brandklasse:'EI60',produkt:'Brandfugemasse',udfoert:false,maerkat:false,note:'Venter på tømrer',billeder:['mangler1']}});}});
          for (const t of ['tavle','rcd','gruppe','enhed','daase','lokale','afbryder','rack','udstyr','link','brand']) {{ a.openForm(t); await T(120); tjekF('form '+t); a.modal=null; await T(30); }}
          a.go('enstreg'); await T(200); const box=a.$refs.sldBox, rb=box.getBoundingClientRect(), k0=a.z.k;
          const P=(type,id,x,y)=>box.dispatchEvent(new PointerEvent(type,{{pointerId:id,clientX:rb.left+x,clientY:rb.top+y,bubbles:true,pointerType:'touch',isPrimary:id===1}}));
          P('pointerdown',1,100,100); P('pointerdown',2,150,100); P('pointermove',2,200,100); await T(50); const k1=a.z.k;
          P('pointerup',2,200,100); P('pointermove',1,120,100); await T(30); P('pointerup',1,120,100); await T(30);
          const bred=document.documentElement.scrollWidth>innerWidth;
          return {{smaa:[...smaa], groft, zoom:Math.round(k1/k0*100)/100, pan:a.pinch===null&&a.pan===null&&SLDP.size===0, bred}}}}""")
        tjek('mobil (touch): ingen felter under 16 px i faner og formularer, pinch med to fingre zoomer diagrammet',
             r['groft'] and not r['smaa'] and r['zoom'] == 2 and r['pan'] and not r['bred'], r)
        await ctx.close()
        # Tablet med touch: 16 px gælder uanset bredde (pointer:coarse), ikke kun under 640 px
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, is_mobile=True, has_touch=True); ctx.set_default_timeout(TRIN_MS)
        await ctx.route('**/*', route)
        pm = await ctx.new_page()
        await pm.goto(URL); await pm.wait_for_timeout(500)
        r = await pm.evaluate(f"""async()=>{{const a={A};const T=n=>new Promise(f=>setTimeout(f,n));const smaa=new Set();
          const tjekF=sted=>document.querySelectorAll('input,select,textarea').forEach(el=>{{if(el.offsetParent===null||['checkbox','radio','range','color','file','hidden'].includes(el.type))return;
            const fs=parseFloat(getComputedStyle(el).fontSize); if(fs<16) smaa.add(sted+': '+(el.id||el.className||el.tagName)+' '+fs);}});
          for (const v of a.views.map(v=>v.id)) {{ a.go(v); await T(120); tjekF(v); }}
          for (const t of ['tavle','gruppe','enhed','afbryder','link','brand']) {{ a.openForm(t); await T(120); tjekF('form '+t); a.modal=null; await T(30); }}
          return {{smaa:[...smaa], groft:matchMedia('(pointer:coarse)').matches, bred:innerWidth}}}}""")
        tjek('tablet (touch, 1024 px): ingen felter under 16 px', r['groft'] and r['bred'] >= 1000 and not r['smaa'], r)
        await ctx.close()

        # 7. Offline-app: service worker på localhost (kræver https eller localhost)
        class Stille(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        class Server(http.server.ThreadingHTTPServer):
            # Standardkøen er 5 forbindelser. Chrome henter mange filer samtidig, og på Windows blev
            # forbindelser så afvist (ERR_CONNECTION_REFUSED). Et script manglede, appen startede ikke,
            # service workeren blev aldrig registreret, og testen hang på serviceWorker.ready.
            request_queue_size = 128
            daemon_threads = True
        srv = Server(('127.0.0.1', 0), functools.partial(Stille, directory=str(ROD)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        lok = 'http://127.0.0.1:%d/' % srv.server_address[1]
        async def lok_route(r):
            u = r.request.url
            if 'alpinejs' in u: await r.fulfill(body=ALPINE.read_text(encoding='utf-8'), content_type='application/javascript', headers={'access-control-allow-origin': '*'})
            elif u.startswith(lok): await r.continue_()
            else: await r.abort()
        ctx = await b.new_context(viewport={'width': 1300, 'height': 1000}, service_workers='allow'); ctx.set_default_timeout(TRIN_MS)
        await ctx.route('**/*', lok_route)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: fejl.append('offline: ' + str(e)))
        pg.on('requestfailed', lambda r: fejl.append('offline: kunne ikke hente ' + r.url + ' (' + str(r.failure) + ')') if r.url.startswith(lok) else None)
        await pg.goto(lok); await pg.wait_for_timeout(500)
        # ready løses aldrig, hvis service workeren ikke bliver registreret; derfor en tidsgrænse i siden
        klar = await pg.evaluate("Promise.race([navigator.serviceWorker.ready.then(()=>new Promise(f=>setTimeout(()=>f(!!navigator.serviceWorker.controller),300))), new Promise(f=>setTimeout(()=>f(false),10000))])")
        if not klar:
            await pg.reload(); await pg.wait_for_timeout(500)
            klar = await pg.evaluate("!!navigator.serviceWorker.controller")
        foer = await pg.evaluate(f"(()=>{{const a={A};return [a.appVersion, a.projekter.length, a.swOk]}})()")
        # En anden app på samme origin (fx Elskolen under /elskole/) må ikke blive gemt som denne apps index.html
        await pg.goto(lok + 'elskole/'); await pg.goto(lok + 'elskole/index.html'); await pg.wait_for_timeout(300)
        # Fuld adresse, fordi siden nu står under /elskole/, og et relativt opslag ville pege derind
        gemt = await pg.evaluate("caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('el-oversigt-') && k !== 'el-oversigt-fonte').map(k => caches.open(k).then(c => c.match(location.origin + '/index.html')).then(s => s ? s.text() : '')))).then(t => t.join(''))")
        tjek('anden app på samme origin (/elskole/) overskriver ikke den gemte index.html', 'x-data="app()"' in gemt, gemt[:200])
        await pg.goto(lok); await pg.wait_for_function("window.__alpineOk")
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


async def med_tidsgraense():
    try:
        await asyncio.wait_for(main(), timeout=SAMLET_S)
    except (asyncio.TimeoutError, TimeoutError):
        for navn, ok, info in kontrol:
            print(('OK    ' if ok else 'FEJL  ') + navn + ('' if ok else f'  {info}'))
        sidst = kontrol[-1][0] if kontrol else 'intet tjek nået'
        print(f'FEJL  røgtesten blev stoppet efter {SAMLET_S} s. Sidste færdige tjek: {sidst}. Det næste tjek hænger.')
        sys.exit(1)


asyncio.run(med_tidsgraense())
