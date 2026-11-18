#!/usr/bin/env python3
"""Installs TahaIPTV.wgt on a Samsung TV in Developer Mode, over the home network, without Samsung's sdb.

    python3 tizen/install.py 192.168.1.50              # install or update, then open it
    python3 tizen/install.py 192.168.1.50 --uninstall  # remove it
    python3 tizen/install.py 192.168.1.50 --info       # what the TV reports (Tizen version...), changes nothing

First: npm run build, then python3 tizen/package.py --sign <profile>. On the TV, once: Apps, type 1 2 3 4 5 on the
remote, Developer mode on with this computer's IP as Host PC IP, restart the TV.

It speaks SDB (Samsung's ADB, port 26101) itself: pushes the package to the folder the TV names, installs it with
`0 vd_appinstall` and opens it with `0 was_execute`. The SDB client below comes from Free My TV's tizen/install.py
(MIT License, Copyright (c) 2026 Free My TV contributors), used unchanged in what it does.
"""
import os
import re
import socket
import struct
import sys
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WGT = os.path.join(ROOT, 'TahaIPTV.wgt')
PORT = 26101
MAX_DATA = 4096


class Sdb:
    """ADB's framing (24-byte header, byte-sum checksum), streams opened with OPEN, every WRTE answered with OKAY."""

    def __init__(self, ip):
        self.sock = socket.create_connection((ip, PORT), timeout=15)
        self.buf = b''
        self.next_id = 1
        self.okay, self.inbox, self.closed = {}, {}, set()
        self.send(b'CNXN', 0x01000000, MAX_DATA, b'host::\0')
        cmd, _, max_data, data = self.read()
        if cmd != b'CNXN':
            raise ConnectionError('the TV answered %r instead of connecting' % cmd)
        self.max = min(max_data, MAX_DATA)
        self.banner = data.rstrip(b'\0').decode('utf-8', 'replace')

    def send(self, cmd, arg0, arg1, data=b''):
        c = struct.unpack('<I', cmd)[0]
        self.sock.sendall(struct.pack('<6I', c, arg0, arg1, len(data), sum(data) & 0xFFFFFFFF, c ^ 0xFFFFFFFF) + data)

    def _recv(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError('the TV closed the connection')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def read(self):
        cmd, arg0, arg1, n, _, _ = struct.unpack('<6I', self._recv(24))
        return struct.pack('<I', cmd), arg0, arg1, self._recv(n) if n else b''

    def pump(self):
        cmd, remote, local, data = self.read()
        if cmd == b'OKAY':
            self.okay[local] = remote
        elif cmd == b'WRTE':
            self.inbox[local] = self.inbox.get(local, b'') + data
            self.send(b'OKAY', local, remote)
        elif cmd == b'CLSE':
            self.closed.add(local)

    def open(self, service):
        local, self.next_id = self.next_id, self.next_id + 1
        self.send(b'OPEN', local, 0, service.encode() + b'\0')
        while local not in self.okay:
            if local in self.closed:
                raise ConnectionError('the TV refused ' + service)
            self.pump()
        return local, self.okay.pop(local)

    def write(self, stream, data):
        local, remote = stream
        self.send(b'WRTE', local, remote, data)
        while local not in self.okay:
            if local in self.closed:
                raise ConnectionError('the TV closed the stream')
            self.pump()
        del self.okay[local]

    def read_until(self, stream, done, seconds):
        local = stream[0]
        end = time.time() + seconds
        while time.time() < end and local not in self.closed and not done(self.inbox.get(local, b'')):
            self.sock.settimeout(max(0.1, end - time.time()))
            try:
                self.pump()
            except socket.timeout:
                break
        self.sock.settimeout(15)
        return self.inbox.pop(local, b'')

    def shell(self, command, until=None, seconds=20):
        stream = self.open('shell:' + command)
        out = self.read_until(stream, lambda t: bool(until and re.search(until, t.decode('utf-8', 'replace'))), seconds)
        return out.decode('utf-8', 'replace')

    def capabilities(self):
        text = self.read_until(self.open('capability:'), lambda t: False, 5).decode('utf-8', 'replace')
        return dict(line.split(':', 1) for line in text.splitlines() if ':' in line)

    def push(self, path, data):
        stream = self.open('sync:')
        spec = ('%s,%d' % (path, 0o100644)).encode()
        self.write(stream, b'SEND' + struct.pack('<I', len(spec)) + spec)
        step = self.max - 8
        for i in range(0, len(data), step):
            part = data[i:i + step]
            self.write(stream, b'DATA' + struct.pack('<I', len(part)) + part)
        self.write(stream, b'DONE' + struct.pack('<I', int(time.time())))
        answer = self.read_until(stream, lambda t: len(t) >= 8, 60)
        if answer[:4] != b'OKAY':
            raise ConnectionError('the TV didn\'t take the file: ' + answer[8:].decode('utf-8', 'replace'))
        self.send(b'WRTE', stream[0], stream[1], b'QUIT' + struct.pack('<I', 0))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        sys.exit(__doc__)
    ip, uninstall = args[0], '--uninstall' in sys.argv
    if '--info' in sys.argv:
        try:
            sdb = Sdb(ip)
        except (OSError, ConnectionError) as e:
            sys.exit('Couldn\'t reach the TV on port %d (%s).' % (PORT, e))
        caps = sdb.capabilities()
        print('Connection: ' + sdb.banner)
        for k in sorted(caps):
            print('  %s: %s' % (k, caps[k]))
        return
    if uninstall:
        with open(os.path.join(ROOT, 'tizen', 'config.xml'), encoding='utf-8') as f:
            manifest = f.read()
    else:
        if not os.path.exists(WGT):
            sys.exit('Package it first: python3 tizen/package.py --sign <profile>')
        with zipfile.ZipFile(WGT) as z:
            if 'author-signature.xml' not in z.namelist():
                sys.exit('TahaIPTV.wgt isn\'t signed, and the TV only installs signed apps.')
            manifest = z.read('config.xml').decode('utf-8')
    tag = re.search(r'<tizen:application[^>]*>', manifest).group(0)
    app_id = re.search(r'\bid="([^"]+)"', tag).group(1)
    package = re.search(r'\bpackage="([^"]+)"', tag).group(1)

    try:
        sdb = Sdb(ip)
    except (OSError, ConnectionError) as e:
        sys.exit('Couldn\'t reach the TV on port %d (%s). On the TV: Apps, 1 2 3 4 5, Developer mode on with this '
                 'computer\'s IP as Host PC IP, then restart the TV.' % (PORT, e))
    caps = sdb.capabilities()
    print('Connected: Tizen %s.' % caps.get('platform_version', '?'))

    if uninstall:
        out = sdb.shell('0 vd_appuninstall ' + package, r'spend time', 120).strip()
        if not re.search(r'uninstall completed', out):
            sys.exit(('The TV said:\n' + out if out else 'The TV didn\'t answer.') +
                     '\nRemove it on the TV instead: Apps, Settings, Taha IPTV, Delete.')
        print('Removed.')
        return

    default_path = '/opt/usr/apps/tmp' if caps.get('platform_version', '').startswith('2.') else '/home/owner/share/tmp/sdk_tools'
    remote = caps.get('sdk_toolpath', default_path).rstrip('/') + '/TahaIPTV.wgt'
    with open(WGT, 'rb') as f:
        data = f.read()
    print('Copying the app to the TV (%d KB) ...' % (len(data) // 1024))
    sdb.push(remote, data)
    print('Installing ...')
    out = sdb.shell('0 vd_appinstall %s %s' % (package, remote), r'spend time', 120)
    if not re.search(r'install completed', out):
        hint = ''
        if 'different certificate' in out:
            hint = '\nThe Taha IPTV on the TV was signed with another certificate: remove it on the TV, then run this again.'
        elif 'failed[116]' in out:
            hint = '\nThe TV may have too little free storage for apps: delete some, restart the TV, and try again.'
        sys.exit('The TV didn\'t finish installing. It said:\n' + out.strip() + hint)
    sdb.shell('0 was_execute ' + app_id, r'launched|spend time', 20)
    print('Installed and open on the TV.')


if __name__ == '__main__':
    main()
