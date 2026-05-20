import glob

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'rb') as fh:
        raw = fh.read()

    # Fix: certGate.includes(\"['npm'  => certGate.includes("['npm'
    # In bytes: includes( \x5c\x22 [   => includes( \x22 [
    b1 = bytes([0x28, 0x5c, 0x22, 0x5b, 0x27, 0x6e, 0x70, 0x6d])  # (\\"['npm
    b2 = bytes([0x28, 0x22, 0x5b, 0x27, 0x6e, 0x70, 0x6d])         # ("['npm

    new_raw = raw.replace(b1, b2)

    # Fix: ']]\\")  => ']]")
    b3 = bytes([0x27, 0x5d, 0x5d, 0x5c, 0x22, 0x29])  # ']]\\")
    b4 = bytes([0x27, 0x5d, 0x5d, 0x22, 0x29])         # ']]")

    new_raw = new_raw.replace(b3, b4)

    if new_raw != raw:
        with open(f, 'wb') as fh:
            fh.write(new_raw)
        fixed.append(f)
        print('Fixed: ' + f)

print('Total fixed: ' + str(len(fixed)))
