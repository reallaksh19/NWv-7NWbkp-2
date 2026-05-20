import glob
import subprocess

files = sorted(glob.glob('scripts/apply_slice*.mjs'))
insight_files = [f for f in files if int(re.search(r'slice(\d+)', f).group(1)) >= 42 and int(re.search(r'slice(\d+)', f).group(1)) <= 58]

for f in insight_files:
    print('Running', f)
    result = subprocess.run(['node', f], capture_output=True, text=True)
    if result.returncode != 0:
        print('FAILED:', f)
        print(result.stdout)
        print(result.stderr)
        break
    else:
        print('SUCCESS:', f)

