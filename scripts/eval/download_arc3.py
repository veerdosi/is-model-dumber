import logging,pathlib,hashlib,json
from arc_agi import Arcade,OperationMode
logging.disable(logging.CRITICAL)
root=pathlib.Path(__file__).resolve().parents[2]
a=Arcade(environments_dir=str(root/'benchmarks/arc3-environments'))
e=a.make('ls20-9607627b',seed=0)
if e is None:raise SystemExit('Pinned official ARC3 environment is unavailable; no substitution.')
p=root/'benchmarks/arc3-environments/ls20/9607627b/ls20.py'
actual=hashlib.sha256(p.read_bytes()).hexdigest()
lock=root/'benchmarks/arc3-source.sha256'
if lock.exists() and lock.read_text().strip()!=actual:raise SystemExit('Official game source hash changed; refuse to run.')
lock.write_text(actual+'\n');print('Pinned LS20 source verified:',actual)
