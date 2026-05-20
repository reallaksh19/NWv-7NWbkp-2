import glob

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'rb') as fh:
        raw = fh.read()

    # The broken pattern ends with: ']]\\")  which is backslash + double-quote + )
    # We want to replace it with:   ']]")   which is just double-quote + )
    broken = b']]\\\")'
    good = b'"])'

    if broken not in raw:
        continue

    new_raw = raw.replace(broken, good)

    if new_raw != raw:
        with open(f, 'wb') as fh:
            fh.write(new_raw)
        fixed.append(f)
        print('Fixed:', f)

print('Total fixed:', str(len(fixed)))
