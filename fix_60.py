import glob
for file in glob.glob('scripts/apply_slice60*.mjs'):
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()
    text = text.replace("'\\\\n'", "'\\n'")
    text = text.replace('"\\\\n"', '"\\n"')
    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)
