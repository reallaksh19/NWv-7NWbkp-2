import glob

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'rb') as fh:
        raw = fh.read()

    # The broken pattern in bytes: certGate.includes(\"['npm' ...
    # After regex sub, it became: certGate.includes(\"['npm'  ... with escaped quotes
    broken_start = b'(certGate.includes(\\"[\'npm\','
    good_start   = b'(certGate.includes("[\'npm\','

    if broken_start not in raw:
        continue

    new_raw = raw.replace(broken_start, good_start)

    # Also fix the end: 'test:xxx']]\\") -> 'test:xxx']]")
    broken_end = b'\\"])'
    good_end   = b'"])'
    new_raw = new_raw.replace(broken_end, good_end)

    if new_raw != raw:
        with open(f, 'wb') as fh:
            fh.write(new_raw)
        fixed.append(f)
        print('Fixed:', f)

print('Total fixed:', len(fixed))
