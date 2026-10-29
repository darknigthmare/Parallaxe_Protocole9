import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

// Compile real modules and real Game callbacks. No copied transport implementation.
const temp=await mkdtemp(join(tmpdir(),'parallaxe-session-client-'));
test.after(()=>rm(temp,{recursive:true,force:true}));
for(const name of ['session-scope','levels','catalog','rules']){
  const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
  await writeFile(join(temp,`${name}.mjs`),stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
const {SessionScope}=await import(pathToFileURL(join(temp,'session-scope.mjs')));
const game=await readFile(new URL('../app/game.tsx',import.meta.url),'utf8');
function between(start,end){
  const a=game.indexOf(start),b=game.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Game callback boundaries: ${start}`);
  return game.slice(a,b);
}
const transport=between('  const resetSession=useCallback(','\n  useEffect(()=>{\n    const p=safeRead');
const solo=between('  const beginSolo=','  const nextRound=');
const leaveAndResume=between('  const returnMenu=','  const fullscreen=');
const open=between('  const startNetwork=','  const runRadioAction=');
const polling=between('  useEffect(()=>{\n    if(!credentials)return;','\n  const capture=');
const harnessSource=`
import {SessionScope} from './session-scope.mjs';
import {createRun} from './rules.mjs';
export function harness(fetch){
  const state={busy:false,networkDown:false,error:'',online:null,credentials:null,run:null,modal:'none',savedSession:null};
  const sessionScope={current:new SessionScope()},credRef={current:null},postInFlight={current:false};
  const lastPhase={current:''},lastReveal={current:''},audio={current:null},engine={current:null},frameState={current:{playing:false}};
  const cleanups=[],storage=new Map(),intervals=new Map(),timeouts=new Map();let timer=0;
  let online=null,credentials=null,savedSession=null;
  const setOnline=v=>{online=v;state.online=v;},setCredentials=v=>{credentials=v;state.credentials=v;};
  const setSavedSession=v=>{savedSession=v;state.savedSession=v;};
  const setBusy=v=>state.busy=v,setNetworkDown=v=>state.networkDown=v,setError=v=>state.error=v;
  const setRun=v=>state.run=v,setModal=v=>state.modal=v;
  const setSlot=()=>{},setNotes=()=>{},setConfirmLeave=()=>{},stopRadio=()=>{},notify=()=>{},safeWrite=()=>{};
  const keys={current:new Set()},document={exitPointerLock(){}},sessionStorage={setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const useCallback=fn=>fn,useEffect=fn=>{cleanups.push(fn());};
  const setInterval=fn=>{const id=++timer;intervals.set(id,fn);return id;},clearInterval=id=>intervals.delete(id);
  const setTimeout=fn=>{const id=++timer;timeouts.set(id,fn);return id;},clearTimeout=id=>timeouts.delete(id);
  const seed='',difficulty='standard',mission={mode:'campaign',levelId:'hotel'},savedRun=null,name='Inspecteur',joinCode='ABCDEF';
  ${transport}
  ${solo}
  ${leaveAndResume}
  ${open}
  function mountPoll(){${polling}\nreturn cleanups.at(-1);}
  return {state,storage,intervals,timeouts,resetSession,acceptState,request,beginSolo,returnMenu,resumeSession,startNetwork,mountPoll,
    unmount:()=>{for(const cleanup of cleanups)cleanup?.();},tick:()=>{for(const fn of intervals.values())fn();}};
}
`;
await writeFile(join(temp,'harness.mjs'),stripTypeScriptTypes(harnessSource));
const {harness}=await import(pathToFileURL(join(temp,'harness.mjs')));
const a={code:'ABCDEF',selfId:'alpha',token:'token-alpha'};
const b={code:'UVWXYZ',selfId:'bravo',token:'token-bravo'};
const frame=(identity=a,revision=1,serverTime=1000)=>({code:identity.code,selfId:identity.selfId,players:[],revision,serverTime,phase:'inspect'});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(){const calls=[];const h=harness((url,options)=>{const pending=deferred();calls.push({url,options,...pending});return pending.promise;});return {h,calls};}
const reply=(state,status=200)=>({ok:status>=200&&status<300,status,json:async()=>({state,error:status===401?'Expired':undefined})});
const opened=(identity=a)=>({ok:true,status:201,json:async()=>({...identity,state:frame(identity)})});
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};

test('scope rejects states before a room is established',()=>{
  const scope=new SessionScope();assert.equal(scope.accept(frame()),false);
});
test('scope accepts the current identity and orders revision then server time',()=>{
  const scope=new SessionScope();scope.replace(a);
  assert.equal(scope.accept(frame(a,2,2000)),true);
  assert.equal(scope.accept(frame(a,1,9000)),false);
  assert.equal(scope.accept(frame(a,2,1999)),false);
  assert.equal(scope.accept(frame(a,2,2000)),true);
  assert.equal(scope.accept(frame(a,3,1800)),true,'Revision remains authoritative after a clock adjustment');
});
test('another room or inspector cannot poison the current ordering',()=>{
  const scope=new SessionScope();scope.replace(a);
  assert.equal(scope.accept(frame(b,999,9999)),false);
  assert.equal(scope.accept({...frame(a,999,9999),selfId:'intruder'}),false);
  assert.equal(scope.accept(frame(a,1,1000)),true);
});
for(const field of ['revision','serverTime'])for(const value of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1,'2',null]){
  test(`scope rejects invalid ${field}: ${String(value)}`,()=>{
    const scope=new SessionScope();scope.replace(a);
    assert.equal(scope.accept({...frame(),[field]:value}),false);
    assert.equal(scope.accept(frame()),true);
  });
}
test('scope rejects missing player arrays without consuming a revision',()=>{
  const scope=new SessionScope();scope.replace(a);
  for(const value of [null,[],{},'bad',{...frame(a,99),players:null}])assert.equal(scope.accept(value),false);
  assert.equal(scope.accept(frame()),true);
});
test('returning to the same room starts a fresh lifetime and order',()=>{
  const scope=new SessionScope();scope.replace(a);const old=scope.ticket();scope.accept(frame(a,99));
  scope.replace(a);assert.equal(scope.isCurrent(old),false);assert.equal(scope.accept(frame(a,0)),true);
});
test('identity is copied and invalidation removes acceptance',()=>{
  const scope=new SessionScope(),identity={...a};scope.replace(identity);identity.code=b.code;
  assert.equal(scope.accept(frame(a)),true);const old=scope.ticket();scope.invalidate();
  assert.equal(scope.isCurrent(old),false);assert.equal(scope.accept(frame(a)),false);
});
test('real POST callback cannot revive a room after entering solo',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));
  const work=h.request('vote',{vote:true});h.beginSolo();
  calls[0].resolve(reply(frame(a,999)));assert.equal(await work,null);
  assert.equal(h.state.online,null);assert.equal(h.state.credentials,null);assert.equal(h.state.run.phase,'reference');
});
test('real callback ignores a retired quiet error rather than marking solo offline',async()=>{
  const {h,calls}=setup();h.resetSession(a);const work=h.request('pose',{},true);h.beginSolo();
  calls[0].reject(new Error('Old network'));await work;
  assert.equal(h.state.networkDown,false);assert.equal(h.state.error,'');
});
test('real callback does not clear a newer busy operation in an old finally',async()=>{
  const {h,calls}=setup();h.resetSession(a);const old=h.request('vote',{vote:true});
  h.resetSession(b);const fresh=h.request('chat',{message:'Bonjour'});
  calls[0].resolve(reply(frame(a,500)));await old;
  assert.equal(h.state.busy,true);assert.equal(await h.request('next'),null);assert.equal(calls.length,2);
  calls[1].resolve(reply(frame(b,2)));await fresh;assert.equal(h.state.busy,false);assert.equal(h.state.online.code,b.code);
});
test('late create success cannot overwrite solo or save obsolete credentials',async()=>{
  const {h,calls}=setup();const work=h.request('create',{name:'Alpha'});h.beginSolo();
  calls[0].resolve(opened(a));assert.equal(await work,null);
  assert.equal(h.storage.size,0);assert.equal(h.state.credentials,null);assert.equal(h.state.run.phase,'reference');
});
test('late create failure cannot alter the next room',async()=>{
  const {h,calls}=setup();const work=h.request('create');h.resetSession(b);
  calls[0].reject(new Error('Old create'));await work;
  assert.equal(h.state.error,'');assert.equal(h.state.credentials.selfId,b.selfId);
});
test('real leave retires the old room immediately and never clears its replacement',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));
  const leaving=h.returnMenu();assert.equal(h.state.online,null);assert.equal(h.state.busy,false);
  assert.equal(calls[0].options.headers.Authorization,`Bearer ${a.token}`);
  h.resetSession(b);h.acceptState(frame(b));calls[0].resolve(reply(null));await leaving;
  assert.equal(h.state.online.code,b.code);assert.equal(h.state.credentials.selfId,b.selfId);
});
test('requests without a room do not emit authenticated gameplay actions',async()=>{
  const {h,calls}=setup();assert.equal(await h.request('pose',{},true),null);assert.equal(calls.length,0);
});
test('new room creation retires prior state and does not forward its bearer',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));h.startNetwork(false);
  assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(h.state.online,null);h.startNetwork(false);assert.equal(calls.length,1,'double activation is ignored');
  calls[0].resolve(opened(b));await settle();assert.equal(h.state.online.code,b.code);assert.equal(h.state.busy,false);
});
test('new room identity and private projection must agree',async()=>{
  const {h,calls}=setup();const work=h.request('create');
  calls[0].resolve({ok:true,json:async()=>({...a,state:frame(b)})});assert.equal(await work,null);
  assert.match(h.state.error,/incomplète/);assert.equal(h.state.busy,false);assert.equal(h.state.credentials,null);
});
test('unmount silences a pending POST success and its finally',async()=>{
  const {h,calls}=setup();h.resetSession(a);const work=h.request('vote',{vote:true});h.unmount();
  const before=structuredClone(h.state);calls[0].resolve(reply(frame(a)));await work;assert.deepEqual(h.state,before);
});
test('poll cleanup aborts the old GET and a new room polls without its lock',async()=>{
  const {h,calls}=setup();h.resetSession(a);const cleanup=h.mountPoll();assert.equal(calls.length,1);
  cleanup();assert.equal(calls[0].options.signal.aborted,true);
  h.resetSession(b);h.mountPoll();assert.equal(calls.length,2);
  calls[0].resolve(reply(frame(a,999)));await settle();h.tick();assert.equal(calls.length,2,'old finally cannot unlock the new GET');
  calls[1].resolve(reply(frame(b)));await settle();assert.equal(h.state.online.code,b.code);h.unmount();assert.equal(h.timeouts.size,0);
});
test('old poll expiration cannot remove new credentials before effect cleanup',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.mountPoll();h.resetSession(b);
  calls[0].resolve(reply(null,401));await settle();
  assert.equal(h.state.credentials.selfId,b.selfId);assert.equal(h.state.modal,'none');assert.equal(h.state.networkDown,false);h.unmount();
});
test('current poll expiration clears access without setting a false network outage',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.mountPoll();calls[0].resolve(reply(null,401));await settle();
  assert.equal(h.state.credentials,null);assert.equal(h.state.modal,'coop');assert.equal(h.state.networkDown,false);assert.equal(h.state.error,'Expired');h.unmount();
});
test('valid polling remains ordered and transient failure keeps the room recoverable',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a,10));h.mountPoll();
  calls[0].resolve(reply(frame(a,9)));await settle();assert.equal(h.state.online.revision,10);
  h.tick();calls[1].reject(new Error('Transient'));await settle();assert.equal(h.state.networkDown,true);assert.equal(h.state.credentials.selfId,a.selfId);
  h.tick();calls[2].resolve(reply(frame(a,11)));await settle();assert.equal(h.state.networkDown,false);assert.equal(h.state.online.revision,11);h.unmount();
});
