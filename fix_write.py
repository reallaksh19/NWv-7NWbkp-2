import glob

for f in glob.glob('scripts/apply_slice*.mjs'):
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    
    if 'fs.mkdirSync(path.split(' in text:
        text = text.replace(
            "fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });",
            "const dir = path.split('/').slice(0, -1).join('/'); if (dir) fs.mkdirSync(dir, { recursive: true });"
        )
        with open(f, 'w', encoding='utf-8') as file:
            file.write(text)
        print('Fixed write() in', f)
