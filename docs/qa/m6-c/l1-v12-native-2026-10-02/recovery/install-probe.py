"""Install/restore this observer in ignored preview output, leaving the bundle intact."""
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
DIST = HERE.parents[4] / 'dist'
index = DIST / 'index.html'
backup = DIST / 'index.html.recovery-original'
marker = '<script type="module" crossorigin'
tag = '<script src="/viewport-recorder.js"></script>\n    '
if len(sys.argv) != 2 or sys.argv[1] not in ['install', 'restore']:
    raise SystemExit('usage: python3 install-probe.py install|restore')
if sys.argv[1] == 'install':
    source = index.read_text()
    if backup.exists() or tag in source or marker not in source:
        raise SystemExit('Refusing existing probe or unexpected build output')
    shutil.copyfile(index, backup)
    shutil.copyfile(HERE / 'viewport-recorder.js', DIST / 'viewport-recorder.js')
    shutil.copyfile(HERE / 'export-helper.html', DIST / 'recovery-export.html')
    index.write_text(source.replace(marker, tag + marker, 1))
else:
    if not backup.exists():
        raise SystemExit('No original preview index backup')
    shutil.copyfile(backup, index)
    for name in ['index.html.recovery-original', 'viewport-recorder.js', 'recovery-export.html']:
        (DIST / name).unlink()
