#!/usr/bin/env python3
"""Proves the ported assets are the originals: re-reads every DATA statement of
BOL02.bas and compares it, value for value, with js/assets.js."""
import re, json, sys, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(root, 'BOL02.bas'), encoding='utf-8', errors='replace').read()

toks, labels, pending = [], [], None
for ln in text.splitlines():
    m = re.match(r'^(L[0-9A-F]{4}):\s*$', ln.strip())
    if m: pending = m.group(1); continue
    m = re.match(r'\s*DATA\s+(.*)$', ln)
    if not m: continue
    if pending: labels.append((pending, len(toks))); pending = None
    toks += [t.strip() for t in m.group(1).split(',')]

SPR_HDR, NAMES, NSPR = 146, 30, 23
base = SPR_HDR*2 + NAMES + SPR_HDR*NSPR

A = json.loads(open(os.path.join(root, 'js', 'assets.js')).read()
               .split('const ASSETS = ', 1)[1].rsplit(';', 1)[0])

fails = []

# 1. the 18 RESTORE labels must fall exactly on 204-value level boundaries
lvl_labels = [(n, i) for n, i in labels if i >= base]
print('%-8s %-14s %-14s %s' % ('label', 'DATA index', 'expected', ''))
for k, (name, idx) in enumerate(lvl_labels):
    exp = base + k*204
    ok = idx == exp
    if not ok: fails.append('label %s at %d, expected %d' % (name, idx, exp))
    print('%-8s %-14d %-14d %s' % (name, idx, exp, 'OK' if ok else 'MISMATCH'))
if len(lvl_labels) != 18: fails.append('found %d level labels, expected 18' % len(lvl_labels))

# 2. every grid value and spawn tail identical
for i in range(18):
    raw = [int(x) for x in toks[base + i*204 : base + i*204 + 204]]
    if A['levels'][i]['grid'] + A['levels'][i]['tail'] != raw:
        fails.append('level %d grid/tail differs' % (i+1))

# 3. the 30 level codes identical
if A['names'] != toks[SPR_HDR*2 : SPR_HDR*2 + NAMES]:
    fails.append('level codes differ')

# 4. every sprite decodes back to the same 16-bit DATA integers
def encode(rows):
    b = bytearray()
    for y in range(24):
        for p in range(4):
            for byte in range(3):
                v = 0
                for bit in range(8):
                    x = byte*8 + bit
                    if int(rows[y][x], 16) >> p & 1: v |= 1 << (7-bit)
                b.append(v)
    out = [24, 24]
    for i in range(0, len(b), 2):
        w = b[i] | (b[i+1] << 8)
        out.append(w - 65536 if w > 32767 else w)
    return out

order = ['arr1', 'arr2'] + ['arr%d' % n for n in range(4, 27)]
for k, name in enumerate(order):
    off = k*SPR_HDR if k < 2 else SPR_HDR*2 + NAMES + (k-2)*SPR_HDR
    raw = [int(x) for x in toks[off:off+SPR_HDR]]
    if encode(A['sprites'][name]) != raw:
        fails.append('sprite %s differs' % name)

print()
print('DATA values parsed        :', len(toks))
print('18 level maps + spawns    :', 'IDENTICAL' if not any('level' in f for f in fails) else 'DIFFER')
print('30 level codes            :', 'IDENTICAL' if not any('codes' in f for f in fails) else 'DIFFER')
print('25 sprites (re-encoded)   :', 'IDENTICAL' if not any('sprite' in f for f in fails) else 'DIFFER')
print('level block boundaries    :', 'ON ORIGINAL LABELS' if not any('label' in f for f in fails) else 'SHIFTED')
print()
if fails:
    print('FAILURES:'); [print(' -', f) for f in fails]; sys.exit(1)
print('PASS - every asset in the port is the original DATA, unmodified.')
