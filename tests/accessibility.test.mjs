import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../src/game/accessibility.ts',import.meta.url),'utf8');
const {DEFAULT_BINDINGS:B,DEFAULT_PREFERENCES:D,normalizePreferences,assignBinding,bindingLabel,movementFromKeys,handleGameKey,sanitizeBindings}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
function harness(bindings={...B}){
 const held=new Set(),calls=[],state={playing:true,blocked:false,focused:true,radioInput:true};
 const actions=Object.fromEntries(['pause','interact','stopListening','vote','journal','torch','switchView'].map(id=>[id,()=>calls.push(id)]));actions.talk=value=>calls.push(value?'talk:on':'talk:off');
 return {held,calls,state,bindings,send:(code,extra={})=>handleGameKey({type:'keydown',code,...extra},held,state,bindings,actions)};
}
test('old preferences migrate without changing stored sound or comfort choices',()=>{
 const p=normalizePreferences({volume:.2,muted:true,reduceMotion:false},true);
 assert.equal(p.volume,.2);assert.equal(p.muted,true);assert.equal(p.reduceMotion,false);assert.equal(p.fov,65);assert.deepEqual(p.bindings,B);
 assert.equal(normalizePreferences(null,true).reduceMotion,true);
});
test('malformed persistence cannot poison controls, FOV, quality or volume',()=>{
 for(const value of [null,[],false,12,'bad'])assert.deepEqual(normalizePreferences(value),normalizePreferences(D));
 const p=normalizePreferences({volume:'1',radioVolume:Infinity,fov:NaN,invertY:'false',quality:'ultra',reduceMotion:'yes',captionScale:-2,sensitivity:50,namedVoiceConsent:true,token:'private'});
 assert.equal(p.volume,.38);assert.equal(p.radioVolume,.75);assert.equal(p.fov,65);assert.equal(p.invertY,false);assert.equal(p.quality,'medium');assert.equal(p.captionScale,1);assert.equal(p.sensitivity,2.5);
 assert.equal('token'in p,false);assert.equal('namedVoiceConsent'in p,false);
});
test('FOV and text scaling are finite and bounded',()=>{
 for(const value of [-100,0,50,65,95,500]){const p=normalizePreferences({fov:value,captionScale:value});assert.ok(p.fov>=50&&p.fov<=95);assert.ok(p.captionScale>=1&&p.captionScale<=1.5);}
});
test('defaults and copies never share mutable custom mappings',()=>{
 const a=normalizePreferences({}),b=normalizePreferences({});a.bindings.talk='KeyP';assert.equal(b.bindings.talk,'KeyT');assert.equal(B.talk,'KeyT');assert.equal(D.bindings.talk,'KeyT');
});
test('reserved controls and duplicate saved bindings fall back to a complete safe map',()=>{
 for(const map of [{talk:'Escape'},{talk:'KeyE'},{talk:'ArrowUp'},{interact:'F5'},{forward:null}])assert.deepEqual(sanitizeBindings(map),B);
});
test('assigning a conflicting key reports it without deleting either action',()=>{
 const result=assignBinding({...B},'talk','KeyE');assert.ok(result.error.includes('Inspecter'));assert.deepEqual(result.bindings,B);
});
test('a valid mapping survives storage, and legacy arrows remain available',()=>{
 const result=assignBinding({...B},'forward','KeyI');assert.equal(result.error,'');
 const p=normalizePreferences(JSON.parse(JSON.stringify({...D,bindings:result.bindings})));
 assert.equal(movementFromKeys(new Set(['KeyI']),p.bindings).forward,1);
 assert.equal(movementFromKeys(new Set(['KeyW']),p.bindings).forward,0);
 assert.equal(movementFromKeys(new Set(['ArrowUp']),p.bindings).forward,1);
});
test('AZERTY and QWERTY labels refer to the same physical movement positions',()=>{
 assert.equal(bindingLabel(B.forward,'azerty'),'Z');assert.equal(bindingLabel(B.left,'azerty'),'Q');
 assert.equal(bindingLabel(B.forward,'qwerty'),'W');assert.equal(bindingLabel(B.left,'qwerty'),'A');
});
test('movement cancels opposite keys and never doubles aliases',()=>{
 assert.deepEqual(movementFromKeys(new Set(['KeyW','ArrowUp','KeyS','KeyA','ArrowRight']),B),{forward:0,strafe:0,sprint:false});
});
test('custom interaction key dispatches once and no longer accepts its old key',()=>{
 const h=harness({...B,interact:'KeyG'});assert.equal(h.send('KeyE'),false);h.send('KeyG');h.send('KeyG');h.send('KeyG',{repeat:true});assert.deepEqual(h.calls,['interact']);
 h.send('KeyG',{type:'keyup'});h.send('KeyG');assert.deepEqual(h.calls,['interact','interact']);
});
test('keyboard talk remains edge-driven through repeat and the independent transmission timeout',()=>{
 const h=harness({...B,talk:'KeyP'});h.send('KeyP');for(let i=0;i<40;i++)h.send('KeyP',{repeat:true});assert.deepEqual(h.calls,['talk:on']);
 h.send('KeyP',{type:'keyup',typing:true});assert.deepEqual(h.calls,['talk:on','talk:off']);
});
test('a repeat after controls are cleared by focus loss does not restart movement or radio',()=>{
 for(const code of ['KeyW','KeyT']){const h=harness();h.send(code);h.held.clear();h.calls.length=0;h.send(code,{repeat:true});assert.equal(h.held.size,0);assert.equal(h.calls.length,0);h.send(code,{type:'keyup'});h.send(code);assert.equal(h.held.has(code),true);}
});
test('keys pressed behind a modal cannot start walking after closing it',()=>{
 const h=harness();h.state.blocked=true;h.send('KeyW');assert.equal(h.held.size,0);h.state.blocked=false;h.send('KeyW',{repeat:true});assert.equal(h.held.size,0);
});
for(const extra of [{typing:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true}]){
 test(`typing/shortcut/composition is not a game command: ${JSON.stringify(extra)}`,()=>{const h=harness();h.send('KeyT');h.send('KeyJ',extra);assert.deepEqual(h.calls,['talk:on','talk:off']);assert.equal(h.held.size,0);});
}
test('unfocused or unavailable-session radio cannot transmit',()=>{
 const h=harness();h.state.focused=false;h.send('KeyT');h.state.focused=true;h.state.radioInput=false;h.send('KeyT');assert.deepEqual(h.calls,[]);
});
test('Escape remains a fixed exit even after remapping and while blocked',()=>{
 const h=harness();h.state.blocked=true;h.send('Escape');h.send('Escape',{repeat:true});assert.deepEqual(h.calls,['pause']);
});
test('the actual Game key callback uses preferences and checks the session ticket',()=>{
 const game=fs.readFileSync(new URL('../app/game.tsx',import.meta.url),'utf8');
 const a=game.indexOf('    const onKey=(e:KeyboardEvent)=>{'),b=game.indexOf('    window.addEventListener("keydown"',a);assert.ok(a>=0&&b>a);
 const fn=Function('handleGameKey',stripTypeScriptTypes(`
 function makeHarness(){
 const calls=[],keys={current:new Set()},frameState={current:{playing:true,blocked:false,radioInput:true,sessionTicket:1}};
 const preferencesRef={current:{bindings:${JSON.stringify({...B,interact:'KeyG',talk:'KeyP'})}}};
 const document={hidden:false,hasFocus:()=>true},sessionScope={current:{isCurrent:t=>t===1}};
 const actions={current:Object.fromEntries(['pause','interact','vote','journal','torch','switchView'].map(a=>[a,()=>calls.push(a)]))};
 const radio={current:{setTalking:v=>calls.push('talk:'+v)}},audio={current:{stopObservations:()=>calls.push('audio-stop')}},engine={current:{stopListening:()=>calls.push('listen-stop')}};
 ${game.slice(a,b)}
 return {calls,keys,frameState,send:(code,extra={})=>onKey({type:'keydown',code,target:{closest:()=>null},preventDefault:()=>calls.push('prevent'),...extra})};
 }`)+ '\nreturn makeHarness();');
 const h=fn(handleGameKey);h.send('KeyG');assert.ok(h.calls.includes('interact'));h.calls.length=0;
 h.frameState.current.sessionTicket=2;h.send('KeyP');assert.deepEqual(h.calls,[]);
 h.frameState.current.sessionTicket=1;h.send('KeyP');assert.ok(h.calls.includes('talk:true'));h.send('KeyP',{type:'keyup'});assert.ok(h.calls.includes('talk:false'));
});

test('Escape closes a modal even when a form control is focused, except during composition',()=>{
 const h=harness();h.state.blocked=true;h.send('Escape',{typing:true});assert.deepEqual(h.calls,['pause']);h.send('Escape',{typing:true,isComposing:true});assert.deepEqual(h.calls,['pause']);
});
test('actual preference effects do not reallocate reflections on sound, FOV or bindings changes',()=>{
 const game=fs.readFileSync(new URL('../app/game.tsx',import.meta.url),'utf8');
 const start=game.indexOf('  // A volume/key/FOV change'),end=game.indexOf('  useEffect(',game.indexOf('[preferences.volume,preferences.muted,ready]);',start)+45);
 const lines=game.slice(start).split('\n').slice(0,4).join('\n');
 const compile=Function('preferences','ready','useEffect','engine','audio',stripTypeScriptTypes(lines));
 const calls=[],engine={current:{setQuality:v=>calls.push('quality:'+v),setCameraPreferences:v=>calls.push('camera:'+v.fov)}},audio={current:{setVolume:v=>calls.push('volume:'+v),setEnabled:v=>calls.push('sound:'+v)}};
 let previous=[];
 function render(p){const next=[];let i=0;compile(p,true,(fn,deps)=>{const old=previous[i++];if(!old||deps.some((v,j)=>v!==old[j]))fn();next.push(deps);},engine,audio);previous=next;}
 render(normalizePreferences({}));render(normalizePreferences({volume:.1}));render(normalizePreferences({volume:.1,fov:80,bindings:{...B,talk:'KeyP'}}));
 assert.equal(calls.filter(x=>x.startsWith('quality:')).length,1);assert.ok(calls.includes('camera:80'));assert.ok(calls.includes('volume:0.1'));
});

test('AZERTY M, comma and semicolon positions keep distinct captions',()=>{assert.equal(bindingLabel('Semicolon','azerty'),'M');assert.equal(bindingLabel('KeyM','azerty'),',');assert.equal(bindingLabel('Comma','azerty'),';');});
