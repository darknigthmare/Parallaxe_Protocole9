/** Actual Game callbacks, not a substitute for GPU or hardware acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
const stripBody=code=>{const out=stripTypeScriptTypes('function fixture(){\n'+code+'\n}');return out.slice(out.indexOf('{')+1,out.lastIndexOf('}'));};
const source=await readFile(new URL('../app/game.tsx',import.meta.url),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const callback=part('  const handleGraphicsState=','  const resetSession=');
function harness(playing=true){
 const calls=[],state={ready:true,error:'',modal:'none',dismissed:true,interrupted:false};
 const frameState={current:{playing,blocked:false,radioInput:true}};
 const invoke=Function('calls','state','frameState',stripBody(`
 const useCallback=fn=>fn;
 const blockControls=()=>{calls.push('controls');frameState.current.blocked=true;};
 const stopRadio=()=>calls.push('radio-off'),stopMicrophone=()=>calls.push('microphone-off');
 const engine={current:{setObservationActive:v=>calls.push('observation:'+v)}};
 const document={exitPointerLock:()=>calls.push('unlock')};
 const setTarget=v=>state.target=v,setObservation=v=>state.reading=v,setAcousticCaption=v=>state.caption=v;
 const setReady=v=>state.ready=v,setGraphicsInterrupted=v=>state.interrupted=v,setGraphicsError=v=>state.error=v;
 const setModal=v=>state.modal=v,setGraphicsDismissed=v=>state.dismissed=v,notify=v=>state.notice=v;
 ${callback}
 return handleGraphicsState;`))(calls,state,frameState);
 return {calls,state,frameState,invoke};
}
for(const status of ['lost','failed'])test(status+' immediately stops controls, playback, capture and private evidence',()=>{
 const h=harness();h.invoke(status);
 assert.deepEqual(h.calls,['controls','radio-off','microphone-off','observation:false','unlock']);
 assert.equal(h.frameState.current.radioInput,false);assert.equal(h.frameState.current.blocked,true);
 assert.equal(h.state.ready,false);assert.equal(h.state.interrupted,true);assert.equal(h.state.target,null);assert.equal(h.state.reading,null);assert.equal(h.state.caption,'');
 assert.equal(h.state.modal,'pause');assert.equal(h.state.dismissed,false);assert.ok(h.state.error);
});
test('restoring WebGL requires a voluntary resume and never enables audio or capture',()=>{
 const h=harness();h.invoke('lost');h.calls.length=0;h.invoke('restored');
 assert.equal(h.state.ready,true);assert.equal(h.state.error,'');assert.equal(h.state.modal,'pause');
 assert.equal(h.frameState.current.blocked,true);assert.equal(h.frameState.current.radioInput,false);
 assert.deepEqual(h.calls,['controls','radio-off','microphone-off','observation:false','unlock']);
});
test('a menu-only failure never invents a saved or ongoing inspection',()=>{
 const h=harness(false);h.invoke('lost');assert.equal(h.state.modal,'none');h.invoke('restored');assert.equal(h.state.modal,'none');
});
test('retained decisions are rejected immediately during loss before a React render',()=>{
 const code=part('  const currentDecision=','  const submitDecision=');
 const engine={current:{isGraphicsAvailable:()=>false}};
 const decision=Function('engine',stripBody(`const sessionScope={current:{isCurrent:()=>true}},decisionTicket=1,online=null,credRef={current:null};${code};return currentDecision;`))(engine);
 assert.equal(decision(),false);engine.current.isGraphicsAvailable=()=>true;assert.equal(decision(),true);
});
test('graphics overlay takes controller priority over an underlying pause panel',async()=>{
 const code=await readFile(new URL('../app/controller-navigation.tsx',import.meta.url),'utf8');
 const expression=code.match(/const root=(.+);\n/)?.[1];assert.ok(expression);
 const graphics={},modal={},document={querySelector:s=>s==='.graphics-error'?graphics:s==='.modal-panel'?modal:null};
 const value=Function('document',stripBody('return '+expression))(document);assert.equal(value,graphics);
});
test('lost frame exits before looking up gamepads, moving, drawing, sounding or sampling',()=>{
 const frame=part('      const animate=(now:number)=>{','      };raf=requestAnimationFrame(animate);')+'      };';
 const queued=[],world={isGraphicsAvailable:()=>false},performance={now:()=>100};
 const state=Function('world','queued','performance',stripBody(`let destroyed=false,raf=0,last=0;const requestAnimationFrame=fn=>{queued.push(fn);return queued.length;};${frame};animate(5000);return {last,raf};`))(world,queued,performance);
 assert.deepEqual(state,{last:5000,raf:1});assert.equal(queued.length,1);
});
