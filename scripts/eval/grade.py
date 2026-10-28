"""Trusted host grading. Candidate code only runs in a networkless, read-only Docker container."""
import json,sys,pathlib,subprocess,tempfile,random,collections,uuid,os,hashlib,itertools
ROOT=pathlib.Path(__file__).resolve().parents[2]
def connectivity(n,ops):
 active={};out=[]
 for op in ops:
  if op[0]=='add':active[op[1]]=op[2:]
  elif op[0]=='remove':del active[op[1]]
  else:
   adj=[[] for _ in range(n)]
   for u,v,p in active.values():adj[u].append((v,p));adj[v].append((u,p))
   u,v=op[1:];colors={u:0};queue=[u];bad=False
   for a in queue:
    for b,p in adj[a]:
     want=colors[a]^p
     if b not in colors:colors[b]=want;queue.append(b)
     elif colors[b]!=want:bad=True
   out.append('disconnected' if v not in colors else 'contradiction' if bad else colors[u]^colors[v])
 return out
def transactions(initial,events):
 db=dict(initial);versions=collections.defaultdict(int);txs={};out=[];deleted=object()
 for op in events:
  typ,tx,*args=op
  if typ=='begin':txs[tx]=[dict(db),dict(versions),set(),{}];continue
  snapshot,start,tracked,writes=txs[tx]
  if typ=='read':
   k=args[0];tracked.add(k);v=writes.get(k,snapshot.get(k));out.append(None if v is deleted else v)
  elif typ in ('write','delete'):
   k=args[0];tracked.add(k);writes[k]=args[1] if typ=='write' else deleted
  elif typ=='abort':del txs[tx]
  else:
   ok=all(versions[k]==start.get(k,0) for k in tracked);out.append(ok)
   if ok:
    for k,v in writes.items():
     versions[k]+=1
     if v is deleted:db.pop(k,None)
     else:db[k]=v
   del txs[tx]
 return out
def code_cases(kind):
 rng=random.Random(902104);cases=[]
 if kind=='code-connectivity':
  # Corner cases: self contradiction, disconnected contradictions, removal, and reused IDs.
  ops=[['query',0,0],['add','x',1,1,1],['query',0,1],['query',1,1],['add','y',0,1,0],['query',0,0],['remove','x'],['query',0,1],['remove','y'],['add','x',0,1,1],['query',0,1]]
  cases.append(([3,ops],connectivity(3,ops)))
  for _ in range(22):
   n=rng.randint(2,30);ops=[];active=[];counter=0
   for j in range(400):
    t=rng.random()
    if t<.42:
     key=str(counter);counter+=1;ops.append(['add',key,rng.randrange(n),rng.randrange(n),rng.randrange(2)]);active.append(key)
    elif t<.65 and active:
     key=rng.choice(active);active.remove(key);ops.append(['remove',key])
    else:ops.append(['query',rng.randrange(n),rng.randrange(n)])
   cases.append(([n,ops],connectivity(n,ops)))
  # Large known-consistent chain with paired deletion/reinsertion. No expensive host oracle.
  n=18000;ops=[['add',str(i),i,i+1,i%2] for i in range(n-1)];expected=[]
  parity=0
  for i in range(n-1):parity^=i%2
  for i in range(10000):
   k=i%(n-1);ops.extend([['query',0,n-1],['remove',str(k)],['query',0,n-1],['add',str(k),k,k+1,k%2]]);expected.extend([parity,'disconnected'])
  cases.append(([n,ops],expected))
 else:
  events=[['begin','a'],['begin','b'],['read','a','x'],['read','b','y'],['write','a','y',1],['write','b','x',1],['commit','a'],['commit','b']]
  cases.append(([{'x':0,'y':0},events],transactions({'x':0,'y':0},events)))
  for _ in range(35):
   initial={'a':1,'b':2};events=[];active=[];counter=0
   for j in range(350):
    if not active or rng.random()<.17:
     tx=str(counter);counter+=1;active.append(tx);events.append(['begin',tx]);continue
    tx=rng.choice(active);typ=rng.choices(['read','write','delete','commit','abort'],[4,3,1,2,1])[0]
    if typ in ('commit','abort'):active.remove(tx);op=[typ,tx]
    else:op=[typ,tx,rng.choice(['a','b','c','d','e'])]+([rng.randint(-5,9)] if typ=='write' else [])
    events.append(op)
   cases.append(([initial,events],transactions(initial,events)))
 return cases
RUNNER='''import json,sys,resource,importlib.util
resource.setrlimit(resource.RLIMIT_FSIZE,(1048576,1048576))
spec=importlib.util.spec_from_file_location("candidate","/submission.py");mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
for line in sys.stdin:
 try: print(json.dumps({"ok":True,"result":mod.solve(*json.loads(line))}),flush=True)
 except Exception as e: print(json.dumps({"ok":False,"error":type(e).__name__}),flush=True)
'''
def grade_code(kind,code):
 if not isinstance(code,str) or len(code)>100000:return {'score':0,'reason':'Missing or oversized code'}
 cases=code_cases(kind);name='ismd-grade-'+uuid.uuid4().hex[:12]
 with tempfile.TemporaryDirectory(prefix='ismd-submission-',dir=ROOT/'.private') as d:
  p=pathlib.Path(d)/'submission.py';p.write_text(code);p.chmod(0o644)
  with tempfile.TemporaryFile() as stdout,tempfile.TemporaryFile() as stderr:
   image=(ROOT/'benchmarks/python-image.txt').read_text().strip()
   cmd=['docker','run','--rm','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=256m','--cpus=1','--user=65534:65534','--ulimit','fsize=1048576:1048576','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','-e','PYTHONDONTWRITEBYTECODE=1','--mount','type=bind,src='+str(p)+',dst=/submission.py,readonly','-i',image,'python','-I','-u','-c',RUNNER]
   try:r=subprocess.run(cmd,input='\n'.join(json.dumps(args) for args,_ in cases)+'\n',text=True,stdout=stdout,stderr=stderr,timeout=30)
   except subprocess.TimeoutExpired:
    subprocess.run(['docker','rm','-f',name],capture_output=True);return {'score':0,'reason':'Candidate exceeded 30-second grading execution budget','passed':0,'total':len(cases)}
   stdout.seek(0);raw=stdout.read(1048577)
   if len(raw)>1048576:return {'score':0,'reason':'Output limit exceeded'}
   if r.returncode!=0:
    stderr.seek(0);err=stderr.read(2000).decode(errors='replace')
    if any(x in err for x in ['Cannot connect','failed to connect','Unable to find image','IsADirectoryError','not allowed to raise maximum limit','invalid mount config']):raise RuntimeError('Docker infrastructure unavailable')
    return {'score':0,'reason':'Candidate execution failed','exit_code':r.returncode,'stderr':err}
   try:results=[json.loads(line) for line in raw.decode().splitlines()]
   except Exception:return {'score':0,'reason':'Malformed candidate output'}
   passed=sum(i<len(results) and results[i].get('ok') and results[i].get('result')==expected for i,(_,expected) in enumerate(cases))
   return {'score':int(passed==len(cases) and len(results)==len(cases)),'passed':passed,'total':len(cases),'oracle':'independent host BFS / event-state interpreter','image':image}
def grade(task,response,job_dir=None):
 kind=task['metadata']['kind']
 if kind=='arc3':
  p=pathlib.Path(job_dir)/'arc3-result.json'
  if not p.exists():raise RuntimeError('Missing ARC3 trusted action trace')
  trace=json.loads(p.read_text())
  if (pathlib.Path(job_dir)/'broker-error.json').exists():raise RuntimeError(json.loads((pathlib.Path(job_dir)/'broker-error.json').read_text())['infrastructure_error'])
  # Recreate game in a fresh official engine, then replay recorded actions independently.
  from arc_agi import Arcade,OperationMode
  from arcengine import GameAction
  a=Arcade(operation_mode=OperationMode.OFFLINE,environments_dir=str(ROOT/'benchmarks/arc3-environments'))
  e=a.make('ls20-9607627b',seed=0)
  if e is None:raise RuntimeError('ARC3 official environment unavailable')
  obs=e.reset()
  if len(trace['actions'])>160:raise RuntimeError('ARC3 action budget violation')
  for action in trace['actions']:obs=e.step(GameAction['ACTION'+str(action['action'])])
  if obs.state.name!=trace['state'] or obs.levels_completed!=trace['levels_completed']:raise RuntimeError('ARC3 independent replay mismatch')
  card=a.get_scorecard()
  return {'score':int(obs.state.name=='WIN'),'levels_completed':obs.levels_completed,'win_levels':obs.win_levels,'actions':len(trace['actions']),'official_efficiency_score':card.score if card else None,'protocol':'bounded single public environment; not an official ARC-AGI-3 aggregate score','replay_verified':True}
 try:answer=json.loads(response.strip())
 except Exception:return {'score':0,'reason':'Response is not strict JSON'}
 if kind.startswith('code-'):return grade_code(kind,answer.get('code') if isinstance(answer,dict) else None)
 expected=json.loads((ROOT/'.private/answers.json').read_text())[task['id']]
 return {'score':int(type(answer)==type(expected) and answer==expected),'reason':'Exact structured equality','reference_sha256':hashlib.sha256(json.dumps(expected,sort_keys=True).encode()).hexdigest()}
if __name__=='__main__':
 try:
  task_id,response_path,job_dir=sys.argv[1:];manifest=json.loads((ROOT/'benchmarks/panel-v1/manifest.json').read_text());task=next(t for t in manifest['tasks'] if t['id']==task_id);print(json.dumps(grade(task,pathlib.Path(response_path).read_text(),job_dir)))
 except Exception as exc:print(json.dumps({'infrastructure_error':str(exc)}));sys.exit(2)
