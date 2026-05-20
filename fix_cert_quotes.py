import glob

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        text = fh.read()

    # The broken pattern: certGate.includes(\"['npm', ...]\")
    # The correct pattern:  certGate.includes("['npm', ...]")
    # The regex substitution introduced \" escapes — unwanted.
    # Replace escaped double quotes \" inside the string with plain "
    new_text = text.replace(
        "(certGate.includes(\\\"['npm', ['run', '",
        "(certGate.includes(\"['npm', ['run', '"
    ).replace(
        "']]\\\") || certGate.includes('certification_manifest.json'))",
        "']]\" ) || certGate.includes('certification_manifest.json'))"
    )

    # Also fix the reverse pattern if "']]\") is present (without spaces)
    new_text = new_text.replace(
        "']]\\\") || certGate.includes('certification_manifest.json'))",
        "']]\") || certGate.includes('certification_manifest.json'))"
    )

    if new_text != text:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(new_text)
        fixed.append(f)
        print('Fixed:', f)

print(f'Total fixed: {len(fixed)}')
