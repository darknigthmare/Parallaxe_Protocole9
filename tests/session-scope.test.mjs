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
for(const name of ['session-scope','radio-input','radio-actions','levels','catalog','rules']){
  const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
  await writeFile(join(temp,`${name}.mjs`),stripTypeScriptTypes(source,{mode:'transform'}).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
const {SessionScope}=await import(pathToFileURL(join(temp,'session-scope.mjs')));
const game=await readFile(new URL('../app/game.tsx',import.meta.url),'utf8');
function between(start,end){
  const a=game.indexOf(start),b=game.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Game callback boundaries: ${start}`);
  return game.slice(a,b);
}
const transport=between('  const stopCalibration=useCallback(','\n  useEffect(()=>{\n    const p=safeRead');
const calibration=between('  const probeRadio=','  const sendChat=');
const decisions=between('  const beginSolo=','  const switchView=');
const leaveAndResume=between('  const returnMenu=','  const fullscreen=');
const open=between('  const startNetwork=','  const runRadioAction=');
const polling=between('  useEffect(()=>{\n    if(!credentials)return;','\n  const capture=');
const radioLifecycle=between('  useEffect(()=>{\n    let disposed=false;','\n  useEffect(()=>{if(online)radio.current?.sync(online);');
const controllerSample=between('        const focused=','        if(s.playing&&!s.blocked&&focused){');
const harnessSource=`
import {SessionScope} from './session-scope.mjs';
import {HoldToTalkGate} from './radio-input.mjs';
import {RadioActionGate} from './radio-actions.mjs';
import {createRun,advanceRun,evaluateRun} from './rules.mjs';
export function harness(fetch){
  const state={busy:false,networkDown:false,error:'',online:null,credentials:null,run:null,modal:'none',savedSession:null,talking:false,radioStatus:null,radioCaption:'',probePending:false,probeStops:0};
  const sessionScope={current:new SessionScope()},credRef={current:null},postInFlight={current:false};
  const lastPhase={current:''},lastReveal={current:''},audio={current:null},engine={current:null},frameState={current:{playing:false}};
  const padTalk={current:new HoldToTalkGate()},radio={current:{setTalking:v=>state.talking=v,disablePlayback(){},disableMicrophone(){},stopProbe(){state.probeStops++;}}};
  const radioActions={current:{cancel(){},invalidate(){},begin(){return {finish(){}};}}};
  const probeActions={current:new RadioActionGate(v=>state.probePending=v)},setRadioCaption=v=>state.radioCaption=v;
  const radioSetup={current:{volume:0.75,profile:'normal',frame:null}},refreshRadioConfig={current:async()=>{}};
  const cleanups=[],storage=new Map(),intervals=new Map(),timeouts=new Map(),notices=[],clients=[];let timer=0;
  // The lifecycle's callbacks are real; the RTC/audio boundary is controllable here.
  class RadioClient {
    constructor(options){this.options=options;clients.push(this);}
    setVolume(){} setProfile(){} setEvidence(){} setMonoOutput(){} sync(){} setIceServers(servers){this.servers=servers;}
    setTalking(v){state.talking=v;} stopProbe(){state.probeStops++;} disablePlayback(){} disableMicrophone(){} dispose(){this.disposed=true;}
  }
  const setRadioStatus=v=>state.radioStatus=v;
  let online=null,credentials=null,savedSession=null;
  const setOnline=v=>{online=v;state.online=v;},setCredentials=v=>{credentials=v;state.credentials=v;};
  const setSavedSession=v=>{savedSession=v;state.savedSession=v;};
  const setBusy=v=>state.busy=v,setNetworkDown=v=>state.networkDown=v,setError=v=>state.error=v;
  const setRun=v=>state.run=v,setModal=v=>state.modal=typeof v==='function'?v(state.modal):v;
  const setSlot=()=>{},setNotes=()=>{},setConfirmLeave=()=>{},notify=v=>notices.push(v),safeWrite=()=>{};
  const touchMove={current:{forward:0,strafe:0}},joystickOrigin={current:null},touchLook={current:null};
  const setTouchStick=()=>{};
  const keys={current:new Set()},document={exitPointerLock(){}},sessionStorage={setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const useCallback=fn=>fn,useEffect=fn=>{cleanups.push(fn());};
  const setInterval=fn=>{const id=++timer;intervals.set(id,fn);return id;},clearInterval=id=>intervals.delete(id);
  const setTimeout=fn=>{const id=++timer;timeouts.set(id,fn);return id;},clearTimeout=id=>timeouts.delete(id);
  const seed='',difficulty='standard',mission={mode:'campaign',levelId:'hotel'},savedRun=null,name='Inspecteur',joinCode='ABCDEF';
  ${transport}
  function render(snapshot=state.online){
    // Each call models one render: its callbacks retain that render's values.
    const online=snapshot,run=state.run,phase=online?.phase??run?.phase??'menu',networkDown=state.networkDown;
    const renderedSessionTicket=sessionScope.current.ticket();
    ${decisions}
    ${calibration}
    return {beginSolo,nextRound,vote,startProtocol,probeRadio};
  }
  const beginSolo=(...args)=>render().beginSolo(...args);
  ${leaveAndResume}
  ${open}
  function mountPoll(){${polling}\nreturn cleanups.at(-1);}
  function mountRadio(){
    const credentials=state.credentials,renderedSessionTicket=sessionScope.current.ticket();
    ${radioLifecycle}\nreturn cleanups.at(-1);
  }
  function capturePadFrame(){
    const s={playing:true,blocked:false,radioInput:true,sessionTicket:sessionScope.current.ticket()};
    return pressed=>{
      const document={hidden:false,hasFocus:()=>true},navigator={getGamepads:()=>[{buttons:Array.from({length:5},(_,i)=>({pressed:i===4&&pressed}))}]};
      ${controllerSample}
      return talkEdge;
    };
  }
  return {state,storage,intervals,timeouts,notices,clients,radio,resetSession,acceptState,request,beginSolo,returnMenu,resumeSession,startNetwork,mountPoll,mountRadio,capturePadFrame,render,openModal,closeModal,togglePause,
    padFrame:(down,allowed=true)=>{const edge=padTalk.current.update(down,allowed);if(edge!==null)radio.current.setTalking(edge);return edge;},
    unmount:()=>{for(const cleanup of cleanups)cleanup?.();},tick:()=>{for(const fn of intervals.values())fn();}};
}
`;
await writeFile(join(temp,'harness.mjs'),stripTypeScriptTypes(harnessSource));
const {harness}=await import(pathToFileURL(join(temp,'harness.mjs')));
const a={code:'ABCDEF',selfId:'alpha',token:'token-alpha'};
const b={code:'UVWXYZ',selfId:'bravo',token:'token-bravo'};
const frame=(identity=a,revision=1,serverTime=1000)=>({code:identity.code,selfId:identity.selfId,players:[],revision,serverTime,phase:'inspect',decisionEpoch:7,paused:false});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(){const calls=[];const h=harness((url,options)=>{const pending=deferred();calls.push({url,options,...pending});return pending.promise;});return {h,calls};}
const reply=(state,status=200)=>({ok:status>=200&&status<300,status,json:async()=>({state,error:status===401?'Expired':undefined})});
const opened=(identity=a)=>({ok:true,status:201,json:async()=>({...identity,state:frame(identity)})});
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};

for(const outcome of ['success','failure']){
  test('session replacement cancels a pending calibration before effect cleanup: '+outcome,async()=>{
    const {h}=setup();h.resetSession(a);const pending=deferred();
    h.radio.current.probe=()=>pending.promise;
    const work=h.render().probeRadio();assert.equal(h.state.probePending,true);
    h.state.radioCaption='Former reading';h.resetSession(a);
    assert.equal(h.state.probePending,false);assert.equal(h.state.radioCaption,'');
    assert.equal(h.state.probeStops,2,'the real stopCalibration callback stops the client synchronously');
    if(outcome==='success')pending.resolve({caption:'Retired reading'});else pending.reject(new Error('Retired failure'));
    await work;assert.equal(h.state.radioCaption,'');assert.equal(h.state.probePending,false);
  });
}
test('a calibration callback from a retired render cannot start another probe',async()=>{
  const {h}=setup();h.resetSession(a);let calls=0;
  h.radio.current.probe=async()=>{calls++;return {caption:'Stale'};};
  const oldProbe=h.render().probeRadio;h.resetSession(b);await oldProbe();
  assert.equal(calls,0);assert.equal(h.state.probePending,false);assert.equal(h.state.radioCaption,'');
});
test('a retired calibration completion cannot release or overwrite the new calibration',async()=>{
  const {h}=setup();h.resetSession(a);const old=deferred(),fresh=deferred();
  h.radio.current.probe=()=>old.promise;const oldWork=h.render().probeRadio();
  h.resetSession(b);h.radio.current.probe=()=>fresh.promise;const freshWork=h.render().probeRadio();
  old.resolve({caption:'Former room'});await oldWork;
  assert.equal(h.state.probePending,true);assert.equal(h.state.radioCaption,'');
  fresh.resolve({caption:'Current room'});await freshWork;
  assert.equal(h.state.probePending,false);assert.equal(h.state.radioCaption,'Current room');
});

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
for(const join of [false,true]){
  const action=join?'join':'create';
  test(`closing a pending ${action} ignores its credentials and private state`,async()=>{
    const {h,calls}=setup();h.openModal('coop');h.startNetwork(join);
    assert.equal(JSON.parse(calls[0].options.body).action,action);
    h.closeModal();assert.equal(h.state.busy,false);
    calls[0].resolve(opened(a));await settle();
    assert.equal(h.state.online,null);assert.equal(h.state.credentials,null);
    assert.equal(h.state.savedSession,null);assert.equal(h.storage.size,0);assert.equal(h.state.modal,'none');
  });
  test(`a cancelled ${action} cannot release or fail a newer opening attempt`,async()=>{
    const {h,calls}=setup();h.openModal('coop');h.startNetwork(join);h.closeModal();
    h.openModal('coop');h.startNetwork(!join);assert.equal(calls.length,2);
    calls[0].reject(new Error('Retired opening'));await settle();
    assert.equal(h.state.busy,true);assert.equal(h.state.error,'');assert.equal(h.state.credentials,null);
    calls[1].resolve(opened(b));await settle();
    assert.equal(h.state.credentials.code,b.code);assert.equal(h.state.busy,false);
    assert.equal(JSON.parse(h.storage.get('parallaxe-session')).token,b.token);
  });
}
test('switching away from cooperation retires its pending join before another mode starts',async()=>{
  const {h,calls}=setup();h.openModal('coop');h.startNetwork(true);h.openModal('start');
  calls[0].resolve(opened(a));await settle();
  assert.equal(h.state.modal,'start');assert.equal(h.state.credentials,null);assert.equal(h.storage.size,0);
});
for(const action of ['startProtocol','nextRound','vote']){
  test(`an old rendered ${action} cannot use another room with the same decision epoch`,async()=>{
    const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));const old=h.render();
    h.resetSession(b);h.acceptState(frame(b));h.openModal('radio');
    await old[action](true);
    assert.equal(calls.length,0);assert.equal(h.state.online.code,b.code);assert.equal(h.state.modal,'radio');
  });
}
test('resuming the same identity also retires its old rendered decision',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));const old=h.render();
  h.resetSession({...a});h.acceptState(frame(a));await old.vote(true);
  assert.equal(calls.length,0);
});
test('a render with an old identity cannot send even if it sees the current scope ticket',async()=>{
  const {h,calls}=setup();h.resetSession(b);h.acceptState(frame(b));
  await h.render(frame(a)).vote(true);assert.equal(calls.length,0);
});
test('a decision sends its rendered epoch and a 409 refreshes the view without retrying it',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));h.openModal('vote');const old=h.render();
  h.acceptState({...frame(a,2),decisionEpoch:8});
  const voting=old.vote(true);assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(calls[0].options.body),{action:'vote',code:a.code,vote:true,decisionEpoch:7});
  calls[0].resolve(reply({...frame(a,3),decisionEpoch:9},409));await voting;
  assert.equal(h.state.online.decisionEpoch,9);assert.equal(h.state.modal,'vote');
  assert.notEqual(h.state.error,'');assert.equal(calls.length,1);assert.equal(h.notices.length,0);
});
test('a completed request cannot close the replacement modal from its old caller continuation',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));h.openModal('vote');
  const voting=h.render().vote(true);calls[0].resolve(reply(frame(a,2)));
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.state.online.revision,2,'the request has accepted its result before the caller resumes');
  h.resetSession(b);h.acceptState(frame(b));h.openModal('radio');await voting;
  assert.equal(h.state.modal,'radio');assert.equal(h.notices.length,0);
});
test('pause and resume between controller frames require a fresh LB release',()=>{
  for(const initiallyTalking of [false,true]){
    const {h}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);
    if(initiallyTalking)h.padFrame(true);
    h.togglePause();assert.equal(h.state.modal,'pause');assert.equal(h.state.talking,false);
    h.togglePause();assert.equal(h.state.modal,'none');
    assert.equal(h.padFrame(true),null);assert.equal(h.state.talking,false);
    h.padFrame(false);assert.equal(h.padFrame(true),true);
  }
});
test('opening and closing a modal between controller frames also disarms LB',()=>{
  const {h}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);
  h.openModal('journal');h.closeModal();assert.equal(h.padFrame(true),null);
  h.padFrame(false);assert.equal(h.padFrame(true),true);
});
for(const [label,replacement] of [['another room',b],['the same room again',a],['the menu',null]]){
  test(`replacing the session with ${label} immediately suspends a held controller talk button`,()=>{
    const {h}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);h.padFrame(true);
    assert.equal(h.state.talking,true);h.resetSession(replacement);assert.equal(h.state.talking,false);
    if(replacement)h.acceptState(frame(replacement));
    assert.equal(h.padFrame(true,!!replacement),null);assert.equal(h.state.talking,false);
  });
}
test('network loss and recovery before the next controller frame cannot reopen the mic',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);h.padFrame(true);
  const heartbeat=h.request('pose',{},true);calls[0].reject(new Error('Offline'));await heartbeat;
  assert.equal(h.state.networkDown,true);assert.equal(h.state.talking,false);
  h.acceptState(frame(a,2));assert.equal(h.state.networkDown,false);
  assert.equal(h.padFrame(true),null);h.padFrame(false);assert.equal(h.padFrame(true),true);
});
test('a missing teammate pauses decisions while present inspectors retain their radio',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);h.padFrame(true);
  h.acceptState({...frame(a,2),paused:true});assert.equal(h.state.talking,true);
  await h.render().vote(true);assert.equal(calls.length,0);assert.notEqual(h.state.error,'');
  h.padFrame(false);assert.equal(h.padFrame(true),true);
});
for(const interruption of [{phase:'reveal'},{phase:'won'},{phase:'lost'}]){
  test(`an accepted ${JSON.stringify(interruption)} immediately suspends controller PTT`,()=>{
    const {h}=setup();h.resetSession(a);h.acceptState(frame(a));h.padFrame(false);h.padFrame(true);
    h.acceptState({...frame(a,2),...interruption});assert.equal(h.state.talking,false);
    h.acceptState(frame(a,3));assert.equal(h.padFrame(true),null);
  });
}
test('repeated resume replaces credentials and ignores an older radio configuration before cleanup',async()=>{
  const {h,calls}=setup();h.resetSession(a);const firstCredentials=h.state.credentials;const cleanup=h.mountRadio();
  h.resetSession(a);assert.notEqual(h.state.credentials,firstCredentials,'React must observe a replacement for the same saved identity');
  calls[0].resolve({ok:true,json:async()=>({iceServers:[]})});await settle();
  assert.equal(h.clients.length,0,'the retired initialization must not create a client before effect cleanup');
  cleanup();h.mountRadio();calls[1].resolve({ok:true,json:async()=>({iceServers:[]})});await settle();
  assert.equal(h.clients.length,1);h.unmount();
});
test('radio send and onState from a previous visit cannot change the same identity on resume',async()=>{
  const {h,calls}=setup();h.resetSession(a);h.mountRadio();
  calls[0].resolve({ok:true,json:async()=>({iceServers:[]})});await settle();
  const old=h.clients[0];old.options.onState({marker:'current'});
  const pending=old.options.send('radio-status',{enabled:true});assert.equal(calls.length,2);
  h.resetSession(a);h.acceptState(frame(a));old.options.onState({marker:'retired'});
  calls[1].resolve(reply(frame(a,999)));await pending;
  assert.equal(h.state.online.revision,1);assert.equal(h.state.radioStatus.marker,'current');
  await old.options.send('radio-status',{enabled:true});assert.equal(calls.length,2,'retired radio callbacks cannot dispatch again');h.unmount();
});
test('an old animation frame cannot rearm LB while a replacement session is waiting to render',()=>{
  const {h}=setup();h.resetSession(a);h.acceptState(frame(a));const oldFrame=h.capturePadFrame();
  oldFrame(false);h.resetSession(b);h.acceptState(frame(b));
  oldFrame(false);assert.equal(h.capturePadFrame()(true),null);assert.equal(h.state.talking,false);
});
test('a retired talkie can send its final off status with captured credentials without restoring its room',async()=>{
  const {h,calls}=setup();h.resetSession(a);const cleanup=h.mountRadio();
  calls[0].resolve({ok:true,json:async()=>({iceServers:[]})});await settle();
  const old=h.clients[0];h.resetSession(b);h.acceptState(frame(b));cleanup();
  const off={enabled:false,talking:false,epoch:'retired-radio-epoch'};
  const stopping=old.options.send('radio-status',off);
  assert.equal(calls.length,2,'the final off packet must reach the old room after cleanup');
  assert.equal(calls[1].options.headers.Authorization,`Bearer ${a.token}`);
  assert.deepEqual(JSON.parse(calls[1].options.body),{action:'radio-status',code:a.code,...off});
  calls[1].resolve(reply(frame(a,999)));await stopping;
  assert.equal(h.state.online.code,b.code);assert.equal(h.state.online.revision,1);
  assert.equal(h.state.credentials.selfId,b.selfId);h.unmount();
});
