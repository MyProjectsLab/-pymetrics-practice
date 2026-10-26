"""Install/remove the L1 event recorder in ignored production-preview output only."""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DIST = HERE.parents[2] / 'dist'
INDEX = DIST / 'index.html'
BACKUP = DIST / 'index.html.l1-original'
MARKER = '<script type="module" crossorigin'
TAG = '<script src="/l1-event-recorder.js"></script>\n    '

if len(sys.argv) != 2 or sys.argv[1] not in ('install', 'restore'):
    raise SystemExit('usage: python3 l1-install-probe.py install|restore')

if sys.argv[1] == 'install':
    source = INDEX.read_text()
    if BACKUP.exists() or TAG in source or MARKER not in source:
        raise SystemExit('Refusing to overwrite an existing probe or unexpected build output')
    BACKUP.write_text(source)
    shutil.copyfile(HERE / 'l1-event-recorder.js', DIST / 'l1-event-recorder.js')
    shutil.copyfile(HERE / 'l1-native-export.html', DIST / 'l1-native-export.html')
    INDEX.write_text(source.replace(MARKER, TAG + MARKER, 1))
else:
    if not BACKUP.exists():
        raise SystemExit('No saved original dist/index.html')
    INDEX.write_bytes(BACKUP.read_bytes())
    BACKUP.unlink()
    for name in ('l1-event-recorder.js', 'l1-native-export.html'):
        (DIST / name).unlink(missing_ok=True)
