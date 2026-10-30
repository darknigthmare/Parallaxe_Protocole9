import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const source=await readFile(new URL('../src/game/radio-input.ts',import.meta.url),'utf8');
const {HoldToTalkGate}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const game=await readFile(new URL('../app/game.tsx',import.meta.url),'utf8');
function between(start,end){
  const a=game.indexOf(start),b=game.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Game input callback boundaries: ${start}`);
  return game.slice(a,b);
}
const controlReset=between('  const resetJoystick=','  const blockControls=');
const suspension=between('  const suspendTalking=','  const stopRadio=');
const focusCallbacks=between('    const onBlur=','    const onMouse=');
const listeners=between('    window.addEventListener("keydown"','    return()=>{destroyed=true;');
const inputHarnessSource=`
export function bindInputs(HoldToTalkGate){
  const target=()=>({handlers:new Map(),addEventListener(type,callback){this.handlers.set(type,callback);}});
  const window=target(),document={...target(),hidden:false};
  const padTalk={current:new HoldToTalkGate()},state={talking:false};
  const radio={current:{setTalking:value=>state.talking=value}},keys={current:new Set()},touchMove={current:{forward:0,strafe:0}};
  const joystickOrigin={current:null},touchLook={current:null};
  const engine={current:{setInput:value=>state.input=value}},setTouchStick=value=>state.touchStick=value;
  const useCallback=callback=>callback;
  ${controlReset}
  ${suspension}
  ${focusCallbacks}
  const onKey=()=>{},onLock=()=>{},onMouse=()=>{};
  ${listeners}
  return {state,emit:(type,hidden=false)=>{document.hidden=hidden;(window.handlers.get(type)??document.handlers.get(type))?.();},
    frame:down=>{const edge=padTalk.current.update(down,true);if(edge!==null)radio.current.setTalking(edge);return edge;}};
}
`;
const {bindInputs}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(inputHarnessSource)).toString('base64'));

test('a deliberate press starts once and release stops once',()=>{
  const gate=new HoldToTalkGate();
  assert.equal(gate.update(false,true),null);
  assert.equal(gate.update(true,true),true);
  assert.equal(gate.update(true,true),null);
  assert.equal(gate.update(false,true),false);
  assert.equal(gate.update(false,true),null);
});
test('a button already held when a controller connects does not open the microphone',()=>{
  const gate=new HoldToTalkGate();
  assert.equal(gate.update(true,true),null);
  assert.equal(gate.update(false,true),null);
  assert.equal(gate.update(true,true),true);
});
test('blur stops PTT and background frames cannot restart it',()=>{
  const gate=new HoldToTalkGate();
  gate.update(false,true);gate.update(true,true);
  assert.equal(gate.update(true,false),false);
  for(let frame=0;frame<120;frame++)assert.equal(gate.update(true,false),null);
  assert.equal(gate.update(true,true),null);
  gate.update(false,true);
  assert.equal(gate.update(true,true),true);
});
test('a blur and focus between two frames still requires releasing LB',()=>{
  const gate=new HoldToTalkGate();
  gate.update(false,true);gate.update(true,true);
  gate.suspend();
  assert.equal(gate.update(true,true),null);
  gate.update(false,true);
  assert.equal(gate.update(true,true),true);
});
test('release while hidden does not authorize a press made before returning to the game',()=>{
  const gate=new HoldToTalkGate();
  gate.update(false,true);gate.update(true,true);
  assert.equal(gate.update(false,false),false);
  assert.equal(gate.update(true,false),null);
  assert.equal(gate.update(true,true),null);
});
test('pause, network loss and controller disconnection require a fresh release and press',()=>{
  for(const reason of ['pause','network loss','controller disconnection']){
    const gate=new HoldToTalkGate();
    gate.update(false,true);gate.update(true,true);
    assert.equal(gate.update(false,false),false,reason);
    assert.equal(gate.update(true,true),null,reason);
    gate.update(false,true);
    assert.equal(gate.update(true,true),true,reason);
  }
});
test('an uninterrupted held button cannot reopen a transmission after its time limit',()=>{
  const gate=new HoldToTalkGate();
  const transitions=[];
  const sample=(down,allowed)=>{const edge=gate.update(down,allowed);if(edge!==null)transitions.push(edge);};
  sample(false,true);sample(true,true);
  // The radio independently closes its track at 30 seconds; no new rising edge is emitted.
  for(let frame=0;frame<4000;frame++)sample(true,true);
  assert.deepEqual(transitions,[true]);
  sample(false,true);sample(true,true);
  assert.deepEqual(transitions,[true,false,true]);
});
for(const event of ['blur','gamepadconnected','gamepaddisconnected']){
  test(`the real ${event} listener disarms LB even when no animation frame observes the interruption`,()=>{
    const h=bindInputs(HoldToTalkGate);h.frame(false);h.frame(true);assert.equal(h.state.talking,true);
    h.emit(event);assert.equal(h.state.talking,false);
    assert.equal(h.frame(true),null);h.frame(false);assert.equal(h.frame(true),true);
  });
}
test('the real visibility listener suspends a hidden-and-visible transition between two frames',()=>{
  const h=bindInputs(HoldToTalkGate);h.frame(false);h.frame(true);
  h.emit('visibilitychange',true);assert.equal(h.state.talking,false);h.emit('visibilitychange',false);
  assert.equal(h.frame(true),null);h.frame(false);assert.equal(h.frame(true),true);
});
