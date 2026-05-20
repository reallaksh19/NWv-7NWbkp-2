import os
import re

with open(r'Updates\UI- Data trust.txt', 'r', encoding='utf-8') as f:
    content = f.read()

bash_blocks = list(re.finditer(r'```(?:bash|sh)\n(.*?)```', content, re.DOTALL))
js_blocks = list(re.finditer(r'```(?:js|javascript)\n(.*?)```\n', content, re.DOTALL))

for i in range(len(js_blocks)):
    filename = bash_blocks[i*2].group(1).strip()
    code = js_blocks[i].group(1)
    
    if filename.startswith('scripts/'):
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as out:
            out.write(code)
        print('Wrote', filename)
