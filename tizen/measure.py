#!/usr/bin/env python3
"""Reads the measuring build's results off the TV and prints them.

    TAHA_PERF=1 npm run build && python3 tizen/package.py --sign <profile> && python3 tizen/install.py <TV IP>
    # wait about 2 minutes: the app moves through Home, Live TV and the Library by itself (src/perf.ts)
    python3 tizen/measure.py <TV IP>
    # then install the normal build again: npm run build && python3 tizen/package.py --sign <profile> && ...

It copies one file over SDB (file sync): the app's IndexedDB log, where src/perf.ts saved its timings. That
database holds only the measurements (the app keeps accounts and settings in localStorage, which isn't read).
Times are milliseconds from a key press: `js` the app's own work, `frame` until the next frame was drawn.
"""
import json
import os
import re
import struct
import sys
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import install  # noqa: E402

LOG = '/opt/usr/home/owner/apps_rw/TahaIPTV01/data/IndexedDB/file__0.indexeddb.leveldb/'


def take(sdb, stream, n, seconds=30):
    local, end = stream[0], time.time() + seconds
    while len(sdb.inbox.get(local, b'')) < n and time.time() < end and local not in sdb.closed:
        sdb.sock.settimeout(max(0.1, end - time.time()))
        sdb.pump()
    buf = sdb.inbox.get(local, b'')
    sdb.inbox[local] = buf[n:]
    return buf[:n]


def sync(sdb, verb, path):
    st = sdb.open('sync:')
    p = path.encode()
    sdb.write(st, verb + struct.pack('<I', len(p)) + p)
    return st


def listing(sdb, path):
    st, names = sync(sdb, b'LIST', path), []
    while take(sdb, st, 4) == b'DENT':
        _, _, _, n = struct.unpack('<4I', take(sdb, st, 16))
        names.append(take(sdb, st, n).decode('utf-8', 'replace'))
    return names


def fetch(sdb, path):
    st, data = sync(sdb, b'RECV', path), b''
    while True:
        head = take(sdb, st, 8)
        kind, n = head[:4], struct.unpack('<I', head[4:])[0]
        if kind == b'DATA':
            data += take(sdb, st, n)
        elif kind == b'DONE':
            return data
        else:
            sys.exit('The TV refused the file: ' + take(sdb, st, n).decode('utf-8', 'replace'))


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sdb = install.Sdb(sys.argv[1])
    logs = [n for n in listing(sdb, LOG) if n.endswith('.log')]
    if not logs:
        sys.exit('No results on the TV yet: is the measuring build installed, and has it run (about 2 minutes)?')
    raw = b''.join(fetch(sdb, LOG + n) for n in sorted(logs))
    found = re.findall(rb'PERF_JSON_BEGIN(.*?)PERF_JSON_END', raw, re.S)
    if not found:
        sys.exit('No results on the TV yet.')
    data = json.loads(found[-1].decode('latin-1'))
    print('%-22s %4s %9s %8s %11s %10s' % ('screen/drawing', 'keys', 'js med', 'js max', 'frame med', 'frame max'))
    for k, v in data['summary'].items():
        print('%-22s %4d %9.1f %8.1f %11.1f %10.1f' % (k, v['n'], v['jsMedian'], v['jsMax'], v['frameMedian'], v['frameMax']))
    tasks = sorted(data['longTasks'], reverse=True)
    print('\nlong tasks (>50 ms): %d; longest: %s' % (len(tasks), ', '.join(str(t) for t in tasks[:8])))
    print('notes: ' + json.dumps(data['notes'], ensure_ascii=False))


if __name__ == '__main__':
    main()
