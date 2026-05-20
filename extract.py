import os
import re

with open(r'C:\Code3\NWv-7-Latest\Updates\weather update.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# find all js blocks
js_blocks = re.findall(r'```js\n(.*?)```\n', content, re.DOTALL)

filenames = [
    'scripts/apply_slice61A_weather_ux_closeout.mjs',
    'scripts/apply_slice61B_weather_settings_onthisday.mjs',
    'scripts/apply_slice61C_weather_signal_precision.mjs',
    'scripts/apply_slice61D_weather_integration_hardening.mjs',
    'scripts/apply_slice61E_weather_final_closure_gate.mjs',
    'scripts/apply_slice61F_weather_manager_clarity.mjs',
    'scripts/apply_slice61G_weather_professional_theme.mjs',
    'scripts/apply_slice61H_weather_browser_smoke.mjs'
]

for i, filename in enumerate(filenames):
    if i < len(js_blocks):
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'w', encoding='utf-8') as out:
            out.write(js_blocks[i])
        print('Wrote', filename)
