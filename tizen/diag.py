#!/usr/bin/env python3
"""Reads the diagnostics build's video-display log off the TV and prints it.

    TAHA_DIAG=1 npm run build && python3 tizen/package.py --sign <profile> && python3 tizen/install.py <TV IP>
    # on the TV: Live TV, pick a channel (preview), OK (full screen), Back (preview), another channel
    python3 tizen/diag.py <TV IP>
    # then install the normal build again: npm run build && python3 tizen/package.py --sign <profile> && ...

The log (src/diag.ts) is in the app's IndexedDB, copied over SDB like the measuring build's (tizen/measure.py). It
holds states, rectangles, AVPlay's answers and error names; never a stream address, server or account.
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import install  # noqa: E402
import measure  # noqa: E402


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sdb = install.Sdb(sys.argv[1])
    # The newest copy is in the .log files; .ldb (older, compacted) is read too in case it was stored uncompressed.
    logs = [n for n in measure.listing(sdb, measure.LOG) if n.endswith('.log') or n.endswith('.ldb')]
    raw = b''.join(measure.fetch(sdb, measure.LOG + n) for n in sorted(logs, key=lambda n: n.endswith('.log')))
    found = re.findall(rb'DIAG_JSON_BEGIN(.*?)DIAG_JSON_END', raw, re.S)
    if not found:
        sys.exit('No log on the TV yet: is the diagnostics build installed, and was a channel played?')
    data = json.loads(found[-1].decode('utf-8', 'replace'))
    for e in data['log']:
        t, ev = e.pop('t'), e.pop('ev')
        print('%8.1f s  %-22s %s' % (t / 1000.0, ev, json.dumps(e, ensure_ascii=False)))


if __name__ == '__main__':
    main()
