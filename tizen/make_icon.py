#!/usr/bin/env python3
"""Draws tizen/icon.png (512 x 512): the app's play mark on its purple-to-blue gradient, in plain Python (no
imaging library). Run again only to change the icon; the PNG is committed."""
import math
import os
import struct
import zlib

N = 512
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.png')


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def inside_rounded(x, y, r):
    """Inside the rounded square (corner radius r), with a 1 px soft edge: 0..1."""
    cx = min(max(x, r), N - 1 - r)
    cy = min(max(y, r), N - 1 - r)
    d = math.hypot(x - cx, y - cy)
    return max(0.0, min(1.0, r - d + 0.5))


def inside_triangle(x, y):
    """The play triangle, a little right of centre (it looks centred that way), soft edge: 0..1."""
    ax, ay, bx, by, cx, cy = 196, 150, 196, 362, 372, 256
    def edge(px, py, qx, qy):
        length = math.hypot(qx - px, qy - py)
        return ((qx - px) * (y - py) - (qy - py) * (x - px)) / length
    e = min(-edge(ax, ay, bx, by), -edge(bx, by, cx, cy), -edge(cx, cy, ax, ay))
    return max(0.0, min(1.0, e + 0.5))


def main():
    top, bottom = (130, 71, 229), (0, 168, 255)    # the app's primary purple and electric blue
    rows = []
    for y in range(N):
        row = bytearray([0])
        for x in range(N):
            t = (x + y) / (2.0 * (N - 1))
            r, g, b = lerp(top, bottom, t)
            a = inside_rounded(x, y, 96)
            p = inside_triangle(x, y)
            r, g, b = (int(r + (255 - r) * p), int(g + (255 - g) * p), int(b + (255 - b) * p))
            row += bytes((r, g, b, int(a * 255)))
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(OUT, 'wb') as f:
        f.write(png)
    print('Wrote', OUT)


if __name__ == '__main__':
    main()
