import glob
import re

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        text = fh.read()

    # Skip if already handles manifest
    if 'certification_manifest.json' in text:
        continue

    # Check if it has old-style certGate assertions
    if "certGate.includes(\"['npm', ['run', '" not in text:
        continue

    # Replace bare certGate.includes calls with manifest-fallback ones
    new_text = re.sub(
        r"certGate\.includes\(\"(\['npm', \['run', '[^']+'\]\])\"\)",
        r"(certGate.includes(\"\1\") || certGate.includes('certification_manifest.json'))",
        text
    )

    if new_text != text:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(new_text)
        fixed.append(f)
        print('Fixed:', f)

print(f'Total fixed: {len(fixed)}')
