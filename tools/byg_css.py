"""Bygger css/tailwind.css med Tailwinds officielle program (v3.4.17).

    python tools/byg_css.py          byg css/tailwind.css
    python tools/byg_css.py --tjek   fejl, hvis css/tailwind.css ikke svarer til koden

Programmet hentes første gang fra github.com/tailwindlabs til
~/.cache/el-oversigt/ (eller stien i miljøvariablen TAILWIND_CLI).
"""
import os, platform, subprocess, sys, tempfile, urllib.request
from pathlib import Path

VERSION = '3.4.17'
ROD = Path(__file__).resolve().parent.parent
UD = ROD / 'css' / 'tailwind.css'


def cli():
    sti = os.environ.get('TAILWIND_CLI')
    if sti:
        return Path(sti)
    navn = {'Windows': 'windows-x64.exe', 'Darwin': 'macos-arm64' if platform.machine() == 'arm64' else 'macos-x64'}.get(platform.system(), 'linux-x64')
    fil = Path.home() / '.cache' / 'el-oversigt' / ('tailwindcss-%s%s' % (VERSION, '.exe' if navn.endswith('.exe') else ''))
    if not fil.exists():
        fil.parent.mkdir(parents=True, exist_ok=True)
        url = 'https://github.com/tailwindlabs/tailwindcss/releases/download/v%s/tailwindcss-%s' % (VERSION, navn)
        print('Henter', url, file=sys.stderr)
        urllib.request.urlretrieve(url, fil)
        fil.chmod(0o755)
    return fil


def byg(ud):
    subprocess.run([str(cli()), '-c', str(ROD / 'tailwind.config.js'), '-i', str(ROD / 'css' / 'tailwind.input.css'),
                    '-o', str(ud), '--minify'], cwd=ROD, check=True, capture_output=True)
    return Path(ud).read_bytes().replace(b'\r\n', b'\n')


if __name__ == '__main__':
    if '--tjek' in sys.argv:
        with tempfile.TemporaryDirectory() as d:
            ny = byg(Path(d) / 'tailwind.css')
        gammel = UD.read_bytes().replace(b'\r\n', b'\n') if UD.exists() else b''
        if ny != gammel:
            sys.exit('css/tailwind.css er ikke bygget efter seneste ændring. Kør: python tools/byg_css.py')
        print('css/tailwind.css er opdateret.')
    else:
        UD.write_bytes(byg(UD))
        print('Bygget', UD.relative_to(ROD), len(UD.read_bytes()), 'bytes')
