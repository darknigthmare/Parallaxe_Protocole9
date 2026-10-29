import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

// Actual Game callbacks with controllable browser boundaries; no React or physical device.
const game=await readFile(new URL('../app/game.tsx',import.meta.url),'utf8');
function between(start,end){
  const a=game.indexOf(start),b=game.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Game callback boundaries: ${start}`);
  return game.slice(a,b);
}
const controls=between('  const resetJoystick=useCallback(','  const suspendTalking=useCallback(');
const session=between('  const resetSession=useCallback(','  const cancelOpening=useCallback(');
const modals=between('  const openModal=useCallback(','  const acceptState=useCallback(');
const accepted=between('  const acceptState=useCallback(','  useEffect(()=>()=>{sessionScope.current!.invalidate();},[]);');
const blur=between('    const onBlur=','    const onMouse=');
const pointers=between('  const canUsePointer=','  const patchPref=');
const vote=between('  const vote=','  const switchView=');
const blocked=between('  useEffect(()=>{if(inputBlocked||!playing)resetControls();','\n  useEffect(()=>{\n    let disposed=false;');
const harnessSource=`
function makeHarness(){
  const state={modal:'none',error:'',focused:true,talking:true,stick:{x:0,y:0},online:null,credentials:null,run:{phase:'inspect'},cancelled:0,inputs:[],looks:[],captures:[]};
  const keys={current:new Set()},touchMove={current:{forward:0,strafe:0}},joystickOrigin={current:null},touchLook={current:null};
  const frameState={current:{playing:true,blocked:false,sensitivity:1}},canvasRef={current:{}};
  const engine={current:{setInput:input=>state.inputs.push({...input}),look:(x,y)=>state.looks.push({x,y})}};
  const document={hidden:false,hasFocus:()=>state.focused,pointerLockElement:null,exitPointerLock(){}};
  const setTouchStick=v=>state.stick=v,setError=v=>state.error=v,setConfirmLeave=()=>{};
  const setModal=v=>state.modal=typeof v==='function'?v(state.modal):v;
  const setOnline=v=>state.online=v,setCredentials=v=>state.credentials=v,setBusy=()=>{},setNetworkDown=()=>{},setRun=v=>state.run=v;
  const useCallback=fn=>fn,useEffect=fn=>fn(),cancelOpening=()=>state.cancelled++,suspendTalking=()=>state.talking=false;
  const sessionScope={current:{replace(){},accept:()=>true}},credRef={current:null},postInFlight={current:false};
  const lastPhase={current:''},lastReveal={current:''},audio={current:{tone(){}}};
  const currentDecision=()=>true,submitDecision=async()=>null,notify=()=>{},online=null,phase='inspect',run={phase:'inspect'},evaluateRun=()=>({phase:'reveal'});
  ${controls}
  ${session}
  ${modals}
  ${accepted}
  ${blur}
  ${pointers}
  ${vote}
  function render({playing=true,blocked:inputBlocked=state.modal!=='none'||['reveal','won','lost'].includes(state.online?.phase??state.run?.phase)}={}){
    frameState.current={...frameState.current,playing,blocked:inputBlocked};
    ${blocked}
  }
  const event=(pointerId,x=100,y=100)=>({pointerId,clientX:x,clientY:y,currentTarget:{setPointerCapture:id=>state.captures.push(id)}});
  return {state,keys,touchMove,joystickOrigin,touchLook,frameState,document,canvasRef,event,render,resetSession,openModal,closeModal,togglePause,acceptState,onBlur,onVisibility,beginJoystick,moveJoystick,endJoystick,beginLook,moveLook,endLook,vote};
}
`;
const harness=Function(stripTypeScriptTypes(harnessSource)+'\nreturn makeHarness;')();
function moveBoth(h){
  h.keys.current.add('KeyW');h.keys.current.add('ShiftLeft');
  h.beginJoystick(h.event(7));h.moveJoystick(h.event(7,115,65));
  h.beginLook(h.event(8,300,100));h.moveLook(h.event(8,310,95),1.6);
}
function stopped(h){
  assert.deepEqual(h.touchMove.current,{forward:0,strafe:0});
  assert.equal(h.joystickOrigin.current,null);assert.equal(h.touchLook.current,null);
  assert.deepEqual(h.state.stick,{x:0,y:0});assert.equal(h.keys.current.size,0);
  assert.deepEqual(h.state.inputs.at(-1),{forward:0,strafe:0,sprint:false});
}
function oldMovesStayStopped(h){
  const looks=h.state.looks.length;
  h.moveJoystick(h.event(7,100,40));h.moveLook(h.event(8,400,200),1.6);
  stopped(h);assert.equal(h.state.looks.length,looks);
}

test('joystick and look preserve normal movement, clamp and sensitivity',()=>{
  const h=harness();h.frameState.current.sensitivity=2;
  h.beginJoystick(h.event(7));h.moveJoystick(h.event(7,200,0));
  assert.deepEqual(h.touchMove.current,{strafe:1,forward:1});
  assert.deepEqual(h.state.stick,{x:38,y:-38});
  h.beginLook(h.event(8));h.moveLook(h.event(8,110,95),1.6);
  assert.deepEqual(h.state.looks,[{x:32,y:-16}]);
});
for(const modal of ['pause','journal','vote','radio']){
  test('opening '+modal+' stops live gestures before controls unmount',()=>{
    const h=harness();moveBoth(h);h.openModal(modal);
    stopped(h);assert.equal(h.state.modal,modal);assert.equal(h.state.talking,false);
    assert.equal(h.frameState.current.blocked,true);
    // Events retained from the previous render must not begin a gesture.
    h.beginJoystick(h.event(90));h.beginLook(h.event(91));stopped(h);
    h.closeModal();h.render();oldMovesStayStopped(h);
    h.beginJoystick(h.event(9));h.moveJoystick(h.event(9,100,62));
    assert.equal(h.touchMove.current.forward,1,'a new voluntary gesture remains usable');
  });
}
for(const action of ['closeModal','togglePause']){
  test(action+' immediately resets both gestures and keyboard input',()=>{
    const h=harness();moveBoth(h);h[action]();stopped(h);
    assert.equal(h.frameState.current.blocked,true);
    h.state.modal='none';h.render();oldMovesStayStopped(h);
  });
}
test('ending solo inspection clears input synchronously with the verdict',async()=>{
  const h=harness();moveBoth(h);await h.vote(true);
  stopped(h);assert.equal(h.state.run.phase,'reveal');assert.equal(h.frameState.current.blocked,true);
});
for(const phase of ['reveal','won','lost']){
  test('receiving '+phase+' clears input before changing the online state',()=>{
    const h=harness();moveBoth(h);h.acceptState({phase});
    stopped(h);assert.equal(h.state.online.phase,phase);assert.equal(h.frameState.current.blocked,true);
  });
}
for(const change of [{blocked:true},{playing:false}]){
  test('rendering '+JSON.stringify(change)+' clears gestures even without a DOM release event',()=>{
    const h=harness();moveBoth(h);h.render(change);stopped(h);
    h.render({playing:true,blocked:false});oldMovesStayStopped(h);
  });
}
test('replacing a session clears controls even before the next render',()=>{
  const h=harness();moveBoth(h);h.resetSession({code:'ABCDEF',selfId:'alpha',token:'test-token'});
  stopped(h);assert.equal(h.frameState.current.blocked,true);
  h.render();oldMovesStayStopped(h);
});
test('blur invalidates touch origins so a stale move cannot restart movement',()=>{
  const h=harness();moveBoth(h);h.state.focused=false;h.onBlur();stopped(h);
  h.state.focused=true;oldMovesStayStopped(h);
  h.beginJoystick(h.event(9));h.moveJoystick(h.event(9,100,62));assert.equal(h.touchMove.current.forward,1);
});
test('hidden page resets controls and ignores late moves and new starts',()=>{
  const h=harness();moveBoth(h);h.document.hidden=true;h.onVisibility();stopped(h);
  h.beginJoystick(h.event(9));h.beginLook(h.event(10));stopped(h);
  h.document.hidden=false;oldMovesStayStopped(h);
});
test('visible visibility notification preserves a legitimate ongoing gesture',()=>{
  const h=harness();moveBoth(h);const before={...h.touchMove.current};h.onVisibility();
  assert.deepEqual(h.touchMove.current,before);assert.equal(h.joystickOrigin.current.id,7);
});
for(const which of ['joystick','look']){
  test(which+' cannot be stolen or ended by another pointer',()=>{
    const h=harness();moveBoth(h);
    if(which==='joystick'){
      const before={...h.touchMove.current};h.beginJoystick(h.event(9));h.endJoystick(h.event(9));
      assert.equal(h.joystickOrigin.current.id,7);assert.deepEqual(h.touchMove.current,before);
    }else{
      h.beginLook(h.event(9));h.endLook(h.event(9));assert.equal(h.touchLook.current.id,8);
    }
  });
}
test('joystick release or capture loss stops movement while retaining the other look finger',()=>{
  const h=harness();moveBoth(h);h.endJoystick(h.event(7));
  assert.equal(h.joystickOrigin.current,null);assert.deepEqual(h.touchMove.current,{forward:0,strafe:0});
  assert.deepEqual(h.state.stick,{x:0,y:0});assert.equal(h.touchLook.current.id,8);
  const looks=h.state.looks.length;h.moveLook(h.event(8,320,100),1.6);assert.equal(h.state.looks.length,looks+1);
  h.moveJoystick(h.event(7,100,30));assert.equal(h.touchMove.current.forward,0);
});
test('look release or capture loss preserves joystick movement and ignores old look callbacks',()=>{
  const h=harness();moveBoth(h);const before={...h.touchMove.current};h.endLook(h.event(8));
  assert.equal(h.touchLook.current,null);assert.deepEqual(h.touchMove.current,before);
  const looks=h.state.looks.length;h.moveLook(h.event(8,320,100),1.6);assert.equal(h.state.looks.length,looks);
});
test('releasing an old pointer does not cancel a newer gesture',()=>{
  const h=harness();moveBoth(h);h.onBlur();
  h.beginJoystick(h.event(17));h.moveJoystick(h.event(17,100,62));h.beginLook(h.event(18));
  h.endJoystick(h.event(7));h.endLook(h.event(8));
  assert.equal(h.joystickOrigin.current.id,17);assert.equal(h.touchMove.current.forward,1);assert.equal(h.touchLook.current.id,18);
});
test('pointer-lock acquisition suppresses drag look without changing camera',()=>{
  const h=harness();h.beginLook(h.event(8));h.document.pointerLockElement=h.canvasRef.current;
  h.moveLook(h.event(8,150,150));assert.equal(h.state.looks.length,0);
});
for(const status of ['blocked','not-playing','not-focused','hidden']){
  test('pointer callbacks reject '+status+' state from the current frame',()=>{
    const h=harness();
    if(status==='blocked')h.frameState.current.blocked=true;
    if(status==='not-playing')h.frameState.current.playing=false;
    if(status==='not-focused')h.state.focused=false;
    if(status==='hidden')h.document.hidden=true;
    h.beginJoystick(h.event(7));h.beginLook(h.event(8));
    assert.equal(h.joystickOrigin.current,null);assert.equal(h.touchLook.current,null);assert.equal(h.state.captures.length,0);
  });
}
