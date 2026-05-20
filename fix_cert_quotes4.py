import glob

files = sorted(glob.glob('scripts/test_*_static.mjs'))
fixed = []

for f in files:
    with open(f, 'rb') as fh:
        raw = fh.read()

    # The current broken pattern:  includes("['npm', ['run', 'xxx'"]) ||
    # The ]] and ' outside the string boundary is wrong.
    # Correct:                     includes("['npm', ['run', 'xxx']]") ||

    # Detection: look for patterns like b"'\"]) ||"  (quote-end-bracket-end-paren)
    # That means the string ended too early before ]]
    broken = b"'\"]) ||"
    good   = b"']]\" ) ||"  # placeholder

    if broken not in raw:
        continue

    # We need to fix: "['npm', ['run', 'xxx'"]) -> "['npm', ['run', 'xxx']]")
    # by inserting ']]' before the closing quote
    import re
    new_raw = re.sub(
        rb"includes\(\"(\['npm', \['run', '[^']+)'\"]\)",
        rb"includes(\"\1']]\")",
        raw
    )

    if new_raw != raw:
        with open(f, 'wb') as fh:
            fh.write(new_raw)
        fixed.append(f)
        print('Fixed:', f)

print('Total fixed:', str(len(fixed)))
