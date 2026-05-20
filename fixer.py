import glob

for filepath in glob.glob('scripts/apply_slice61*.mjs'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace literal '\\n' enclosed in quotes with '\n'
    content = content.replace("'\\\\n'", "'\\n'")
    content = content.replace('"\\\\n"', '"\\n"')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix package.json
with open('package.json', 'r', encoding='utf-8') as f:
    pkg = f.read()
pkg = pkg.replace('\\n', '\n')
with open('package.json', 'w', encoding='utf-8') as f:
    f.write(pkg)

# Fix manifest if it was broken
import os
if os.path.exists('scripts/certification_manifest.json'):
    with open('scripts/certification_manifest.json', 'r', encoding='utf-8') as f:
        man = f.read()
    man = man.replace('\\n', '\n')
    with open('scripts/certification_manifest.json', 'w', encoding='utf-8') as f:
        f.write(man)
