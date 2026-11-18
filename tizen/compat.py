#!/usr/bin/env python3
"""Checks the production build (dist/) for what the Samsung AU7000's browser engine can't run.

    python3 tizen/compat.py

The AU7000 (2021, Tizen 6.0) runs Chromium 76. Vite compiles the syntax down (build.target chrome76), but it can't
add missing functions or CSS: those are looked for here, in the bundle (the CSS is inside it). package.py runs this
first and stops on a finding. A finding with a reason in ALLOWED is known to be safe and only listed.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'dist', 'assets')

# (pattern, what it is, Chromium version that brought it)
JS = [
    (r'\?\?|\?\.[a-zA-Z_$\[(]', 'optional chaining / nullish coalescing (syntax)', 80),
    (r'\|\|=|&&=|\?\?=', 'logical assignment (syntax)', 85),
    (r'\.replaceAll\(', 'String.replaceAll', 85),
    (r'\.at\(-?\d', 'Array/String .at()', 92),
    (r'\bstructuredClone\(', 'structuredClone', 98),
    (r'\bObject\.hasOwn\(', 'Object.hasOwn', 93),
    (r'\bPromise\.any\(', 'Promise.any', 85),
    (r'\bWeakRef\b', 'WeakRef', 84),
    (r'\.findLast(Index)?\(', 'findLast', 97),
    (r'\bIntl\.DisplayNames\b', 'Intl.DisplayNames', 81),
    (r'\.replaceChildren\(', 'replaceChildren', 86),
    (r'\bAbortSignal\.timeout\(', 'AbortSignal.timeout', 103),
    (r'\bAbortSignal\.any\(', 'AbortSignal.any', 116),
    (r'\buserAgentData\b', 'navigator.userAgentData', 90),
    (r'\.toSorted\(|\.toReversed\(|\.with\(', 'change-array-by-copy', 110),
]
CSS = [
    (r'(?<![-\w])gap\s*:', 'gap (in flexbox: Chromium 84; in grid it is fine)', 84),
    (r'(?<![-\w])inset\s*:', 'inset', 87),
    (r'aspect-ratio\s*:', 'aspect-ratio', 88),
    (r':is\(|:where\(', ':is() / :where()', 88),
    (r':focus-visible', ':focus-visible', 86),
    (r'\bclamp\(', 'clamp()', 79),
    (r'(?<![-\w])(min|max)\((?=[^)]*(px|%|em|vw|vh))', 'min() / max() in CSS', 79),
    (r'overflow\s*:\s*clip', 'overflow: clip', 90),
    (r'content-visibility', 'content-visibility', 85),
    (r'accent-color', 'accent-color', 93),
    (r'@container', 'container queries', 105),
    (r':has\(', ':has()', 105),
]
# Findings checked by hand: pattern → why it's safe here.
ALLOWED = {
    'gap (in flexbox: Chromium 84; in grid it is fine)': 'only in display:grid rules (checked below)',
}


def grid_only_gaps(text):
    """Every rule with gap: also says display:grid (flex gap would be ignored on Chromium 76)."""
    bad = []
    for m in re.finditer(r'\{([^{}]*?(?<![-\w])gap\s*:[^{}]*)\}', text):
        if 'display:grid' not in m.group(1).replace(' ', ''):
            bad.append(m.group(0)[:120])
    return bad


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # a Windows console's code page
    except AttributeError:
        pass
    if not os.path.isdir(ASSETS):
        sys.exit('Build it first: npm run build')
    files = [os.path.join(ASSETS, f) for f in os.listdir(ASSETS) if f.endswith(('.js', '.css'))]
    problems, notes = [], []
    for path in files:
        text = open(path, encoding='utf-8').read()
        # Fonts' unicode-range wildcards (U+6??) look like `??`: not code.
        text = re.sub(r'unicode-range:[^;}]*', 'unicode-range:…', text)
        name = os.path.basename(path)
        for pattern, what, version in JS + CSS:
            hits = [m for m in re.finditer(pattern, text)]
            if not hits:
                continue
            sample = text[max(0, hits[0].start() - 40):hits[0].end() + 40].replace('\n', ' ')
            line = '%s: %s (Chromium %d), %d× — …%s…' % (name, what, version, len(hits), sample)
            if what in ALLOWED:
                notes.append(line + '\n    allowed: ' + ALLOWED[what])
            else:
                problems.append(line)
        for rule in grid_only_gaps(text):
            problems.append('%s: gap outside a grid rule: %s' % (name, rule))
    for n in notes:
        print('note  ' + n)
    for p in problems:
        print('FOUND ' + p)
    if problems:
        sys.exit('%d feature(s) newer than the AU7000 (Chromium 76) in the build.' % len(problems))
    print('Compatible with Chromium 76 (Samsung AU7000, Tizen 6.0): %d file(s) checked.' % len(files))


if __name__ == '__main__':
    main()
