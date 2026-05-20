import os
import re

with open(r'Updates\INSIGHT UPDATE_ WORKFLOW.txt', 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.finditer(r'## Create `([^`]+)`\s*```(?:js|javascript)\n(.*?)```', content, re.DOTALL)

for match in matches:
    filename = match.group(1).strip()
    code = match.group(2)
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    code = code.replace("'\\\\n'", "'\\n'")
    code = code.replace('"\\\\n"', '"\\n"')
    
    with open(filename, 'w', encoding='utf-8') as out:
        out.write(code)
    print('Wrote', filename)
