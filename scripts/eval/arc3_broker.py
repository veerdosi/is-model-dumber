"""One job, one pinned actual ARC-AGI-3 environment; local authenticated action broker."""
import pathlib,json,sys,secrets,time,threading,hashlib,logging
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from arc_agi import Arcade,OperationMode
from arcengine import GameAction
from PIL import Image,ImageColor
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[2];job=pathlib.Path(sys.argv[1]).resolve();token=secrets.token_urlsafe(24);lock=threading.Lock();started=None;trace=[];latest=None
logging.disable(logging.CRITICAL)
colors=['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff']
def renderer(step,raw):
 global latest
 latest=raw
 if raw.frame is not None and len(raw.frame)>0:
  frame=np.asarray(raw.frame[-1]);h,w=frame.shape;image=Image.new('RGB',(w,h));image.putdata([ImageColor.getrgb(colors[int(x)%16]) for x in frame.flatten()]);image.resize((w*8,h*8),Image.Resampling.NEAREST).save(job/'frame.png')
a=Arcade(operation_mode=OperationMode.OFFLINE,environments_dir=str(ROOT/'benchmarks/arc3-environments'));e=a.make('ls20-9607627b',seed=0,renderer=renderer)
if e is None:raise RuntimeError('Pinned environment missing')
latest=e.reset()
def state():
 return {'state':latest.state.name,'levels_completed':latest.levels_completed,'win_levels':latest.win_levels,'actions_used':len(trace),'actions_remaining':160-len(trace),'legal_actions':[1,2,3,4],'frame_path':str(job/'frame.png'),'frame_sha256':hashlib.sha256((job/'frame.png').read_bytes()).hexdigest()}
def save():
 (job/'arc3-result.json').write_text(json.dumps({**state(),'actions':trace}))
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):self.handle_action(False)
 def do_POST(self):self.handle_action(True)
 def handle_action(self,mutate):
  if self.headers.get('Authorization')!='Bearer '+token:self.send_error(403);return
  with lock:
   global started
   if started is None:started=time.monotonic()
   if time.monotonic()-started>480:self.send_error(410,'Task time limit reached');return
   try:
    global latest
    if mutate:
     n=int(self.headers.get('Content-Length','0'))
     if n>100:self.send_error(400);return
     action=json.loads(self.rfile.read(n)).get('action')
     if type(action)!=int or action not in (1,2,3,4):self.send_error(400);return
     if len(trace)>=160 or latest.state.name in ('WIN','GAME_OVER'):self.send_error(409,'Action budget or terminal state');return
     before=state();latest=e.step(GameAction['ACTION'+str(action)]);trace.append({'step':len(trace)+1,'action':action,'before_frame_sha256':before['frame_sha256'],'after_frame_sha256':state()['frame_sha256']})
    save();body=json.dumps(state()).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
   except Exception as exc:
    (job/'broker-error.json').write_text(json.dumps({'infrastructure_error':type(exc).__name__+': '+str(exc)}));self.send_error(500)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);save();(job/'broker.json').write_text(json.dumps({'url':f'http://127.0.0.1:{server.server_port}','token':token,'initial':state()}));print('ARC3 broker ready',flush=True)
threading.Timer(1200,server.shutdown).start();server.serve_forever()
