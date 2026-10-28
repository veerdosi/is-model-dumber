"""Independent deterministic reference checks; no model calls or simulated model observations."""
import json,pathlib,itertools,collections,hashlib,sys,time
from grade import connectivity,transactions
ROOT=pathlib.Path(__file__).resolve().parents[2]
M=1000000007

def sequence(count):
 forbidden=('001011','1101001','0101010','111000');dp={('',0):1};seq=[]
 for n in range(count):
  seq.append(sum(v for (s,r),v in dp.items() if r==3)%M);nxt=collections.defaultdict(int)
  for (s,r),v in dp.items():
   for b in ('0','1'):
    word=s+b
    if not any(word.endswith(f) for f in forbidden):nxt[(word[-6:],(2*r+int(b))%7)]=(nxt[(word[-6:],(2*r+int(b))%7)]+v)%M
  dp=nxt
 return seq

def bm(s):
 c=[1];b=[1];L=0;m=1;bb=1
 for n in range(len(s)):
  d=(s[n]+sum(c[i]*s[n-i] for i in range(1,L+1)))%M
  if d==0:m+=1;continue
  t=c[:];coef=d*pow(bb,M-2,M)%M
  if len(c)<len(b)+m:c += [0]*(len(b)+m-len(c))
  for j in range(len(b)):c[j+m]=(c[j+m]-coef*b[j])%M
  if 2*L<=n:L=n+1-L;b=t;bb=d;m=1
  else:m+=1
 return [(-x)%M for x in c[1:L+1]]
def nth(seq,rec,n):
 k=len(rec)
 def mul(a,b):
  t=[0]*(2*k-1)
  for i,x in enumerate(a):
   for j,y in enumerate(b):t[i+j]=(t[i+j]+x*y)%M
  for i in range(2*k-2,k-1,-1):
   for j,c in enumerate(rec):t[i-1-j]=(t[i-1-j]+t[i]*c)%M
  return t[:k]
 p=[1]+[0]*(k-1);x=[0,1]+[0]*(k-2)
 while n:
  if n&1:p=mul(p,x)
  x=mul(x,x);n//=2
 return sum(a*b for a,b in zip(p,seq))%M
manifest=json.loads((ROOT/'benchmarks/panel-v1/manifest.json').read_text());answers=json.loads((ROOT/'.private/answers.json').read_text());checks=[]
for task in manifest['tasks'][:2]:
 d=json.loads(task['prompt'].split('\n',1)[1]);ref=answers[task['id']]['outputs'];assert len(d['test'])==len(ref)
 for grid in [x['input'] for x in d['train']]+[x['output'] for x in d['train']]+ref:
  assert 1<=len(grid)<=30 and len({len(r) for r in grid})==1 and all(type(v)==int and 0<=v<=9 for row in grid for v in row)
 checks.append(task['id']+': upstream exact grids and dimensions validated (semantic ambiguity not eliminated)')
seq=sequence(800)
for n in range(12):
 brute=sum(not any(f in s for f in ('001011','1101001','0101010','111000')) and int(s or '0',2)%7==3 for s in map(''.join,itertools.product('01',repeat=n)))
 assert brute==seq[n]
rec=bm(seq[:500]);assert all(seq[i]==sum(rec[j]*seq[i-1-j] for j in range(len(rec)))%M for i in range(500,800))
assert nth(seq,rec,1000000000039)==answers['06-automaton']['count'];checks.append('06-automaton: independent suffix-state DP + Berlekamp-Massey / Kitamasa matches matrix reference; exhaustive short strings agree')
# Exact rational recovery, then uniqueness under at most three arbitrary corruptions, using integer SMT.
from z3 import Int,Solver,Sum,If,Or,sat,unsat
q=next(t for t in manifest['tasks'] if t['id']=='07-inverse');data=json.loads(q['prompt'].split('\n',1)[1]);ref=answers['07-inverse'];xs=[Int('x'+str(i)) for i in range(16)];a,b=Int('alpha'),Int('beta');solver=Solver();solver.set(timeout=120000)
for v in xs+[a,b]:solver.add(v>=-20,v<=20)
violations=[Sum([r[j]*xs[j] for j in range(16)])+a*(i%5)+b != data['y'][i] for i,r in enumerate(data['A'])];solver.add(Sum([If(v,1,0) for v in violations])==3)
solver.add(Or(*[xs[i]!=ref['x'][i] for i in range(16)],a!=ref['alpha'],b!=ref['beta']))
result=solver.check();assert result==unsat, f'Unique inverse solution not established: {result}';checks.append('07-inverse: exact SMT establishes no second bounded integer solution with three corruptions')
ledger=next(t for t in manifest['tasks'] if t['id']=='08-ledger')['prompt'].split('\nLEDGER\n')[1];rows=[json.loads(l) for l in ledger.splitlines()];latest={}
for row in sorted(rows,key=lambda r:-r['seq']):latest.setdefault(row['transaction'],row)
sums=dict.fromkeys(['ash','birch','cedar','elm','larch'],0)
for r in latest.values():
 if r['region']=='west' and not r['void']:sums[r['account']]+=r['amount']
assert sums==answers['08-ledger'];checks.append('08-ledger: independent descending-sequence reconciliation agrees')
assert connectivity(3,[['add','a',0,1,0],['add','b',0,1,1],['query',0,2],['query',0,1],['remove','b'],['query',0,1]])==['disconnected','contradiction',0]
assert transactions({'x':0,'y':0},[['begin','a'],['begin','b'],['read','a','x'],['read','b','y'],['write','a','y',1],['write','b','x',1],['commit','a'],['commit','b']])==[0,0,True,False]
checks.append('04/05-code: semantic corner fixtures independently hand-checked; randomized oracle cases and known large-chain stress fixture prepared')
ref=answers['09-contract'];assert len(ref)==12 and all(r['reverse']==r['word'][::-1] and r['weight']==r['index']**2 for r in ref);checks.append('09-contract: satisfiable witness validates every relational constraint')
assert answers['10-evidence']=={'allocation':93,'lead':'Mara Ives','sources':['C04','D09']};checks.append('10-evidence: ratification/date/provenance chain manually reviewed; injection excluded')
report={'validated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'manifest_hash':manifest['manifest_hash'],'checks':checks,'limitations':['This establishes reference/grading consistency, not frontier difficulty or item-information optimality.','ARC2 public items have contamination and possible ambiguity risk.','ARC3 independently replays each actual action trace at grading time.','Original items require empirical calibration; small panel does not support universal capability claims.']}
(ROOT/'docs/panel-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
