#!/usr/bin/env python3
"""Packs the production build (dist/, from `npm run build`) into TahaIPTV.wgt, the app package a Samsung TV installs.

    python3 tizen/package.py                  # unsigned (to look inside)
    python3 tizen/package.py --sign PROFILE   # signed with a certificate profile of Samsung's Tizen tools

The TV installs only signed packages. Signing uses Samsung's `tizen package` (Tizen Studio's CLI); set TIZEN_STUDIO
to where it is when it isn't in a usual place. A 2021 AU7000 (Tizen 6.0) takes a Tizen certificate; 2023 and newer
TVs need a Samsung one made for that TV.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
WGT = os.path.join(ROOT, 'TahaIPTV.wgt')
HERE = os.path.join(ROOT, 'tizen')


def tizen_cli():
    name = 'tizen.bat' if os.name == 'nt' else 'tizen'
    home = os.path.expanduser('~')
    for base in (os.environ.get('TIZEN_STUDIO', ''), os.path.join(home, 'tizen-studio'), 'C:\\tizen-studio'):
        path = os.path.join(base, 'tools', 'ide', 'bin', name)
        if base and os.path.exists(path):
            return path
    return shutil.which('tizen')


def pack():
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        sys.exit('Build it first: npm run build')
    with zipfile.ZipFile(WGT, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(HERE, 'config.xml'), 'config.xml')
        z.write(os.path.join(HERE, 'icon.png'), 'icon.png')
        for folder, _, files in os.walk(DIST):
            for f in files:
                path = os.path.join(folder, f)
                z.write(path, os.path.relpath(path, DIST).replace(os.sep, '/'))


def sign(profile):
    cli = tizen_cli()
    if not cli:
        sys.exit('Signing needs Samsung\'s Tizen tools: set TIZEN_STUDIO to where they are installed.')
    out = tempfile.mkdtemp()
    try:
        run = subprocess.run([cli, 'package', '-t', 'wgt', '-s', profile, '-o', out, '--', WGT],
                             capture_output=True, text=True, shell=os.name == 'nt')
        made = [n for n in os.listdir(out) if n.endswith('.wgt')]
        if run.returncode != 0 or not made:
            sys.exit('`tizen package` didn\'t sign it:\n' + (run.stdout + run.stderr).strip())
        shutil.move(os.path.join(out, made[0]), WGT)
    finally:
        shutil.rmtree(out, ignore_errors=True)
    with zipfile.ZipFile(WGT) as z:
        names = z.namelist()
    if 'author-signature.xml' not in names or 'signature1.xml' not in names:
        sys.exit('The package came back without its signatures.')


def main():
    args = sys.argv[1:]
    profile = args[args.index('--sign') + 1] if '--sign' in args and args.index('--sign') + 1 < len(args) else None
    pack()
    if profile:
        sign(profile)
    with zipfile.ZipFile(WGT) as z:
        count = len(z.namelist())
    print('Built TahaIPTV.wgt (%d files, %d KB, %s)' % (count, os.path.getsize(WGT) // 1024,
                                                      'signed with "%s"' % profile if profile else 'not signed'))


if __name__ == '__main__':
    main()
