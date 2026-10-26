import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHmac} from 'node:crypto';
import ts from 'typescript';

const temp=await mkdtemp(join(tmpdir(),'parallaxe-radio-'));
for(const name of ['levels','catalog','rules','session','radio','radio-config']){
  const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
  await writeFile(join(temp,`${name}.mjs`),output);
}
const {RadioClient,profileForEffects,getProbePattern,isPolitePeer}=await import(pathToFileURL(join(temp,'radio.mjs')));
const {createRoom,makePlayer,joinRoom,actRoom,projectRoom,SIGNAL_TTL}=await import(pathToFileURL(join(temp,'session.mjs')));
const {makeRadioConfig}=await import(pathToFileURL(join(temp,'radio-config.mjs')));
test.after(async()=>rm(temp,{recursive:true,force:true}));

function team(){let room=createRoom('ABCDEF',makePlayer('a','Alpha','token-a',0,1000),'standard','radio-test',1000);for(const [index,id] of ['b','c'].entries())room=joinRoom(room,makePlayer(id,id.toUpperCase(),`token-${id}`,index+1,1000));for(const id of ['a','b','c'])room=actRoom(room,id,'radio-status',{enabled:true,epoch:id.repeat(20),talking:false,activate:true},1100);return room;}
function offer(to='b'){return {signal:{to,epoch:'a'.repeat(20),toEpoch:to.repeat(20),description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}}};}

test('signaling is authenticated to its sender, private to one recipient and acknowledges only that inbox',()=>{
  let room=actRoom(team(),'a','signal',offer(),1200);const inbox=projectRoom(room,'b',1200).radioInbox;
  assert.equal(inbox.length,1);assert.equal(inbox[0].from,'a');assert.equal(projectRoom(room,'a',1200).radioInbox.length,0);assert.equal(projectRoom(room,'c',1200).radioInbox.length,0);
  room=actRoom(room,'c','signal-ack',{ids:[inbox[0].id]},1300);assert.equal(projectRoom(room,'b',1300).radioInbox.length,1);
  room=actRoom(room,'b','signal-ack',{ids:[inbox[0].id]},1400);assert.equal(projectRoom(room,'b',1400).radioInbox.length,0);
});
test('stale epochs, unknown recipients, oversized SDP and stale signals are rejected or removed',()=>{
  let room=team();assert.throws(()=>actRoom(room,'a','signal',offer('outsider'),1200),/Destinataire/);
  const stale=offer();stale.signal.epoch='expired';assert.throws(()=>actRoom(room,'a','signal',stale,1200),/renouvelée/);
  const huge=offer();huge.signal.description.sdp='x'.repeat(16001);assert.throws(()=>actRoom(room,'a','signal',huge,1200),/Description/);
  room=actRoom(room,'a','signal',offer(),1200);assert.equal(projectRoom(room,'b',1200+SIGNAL_TTL).radioInbox.length,0);
  room=actRoom(room,'b','radio-status',{enabled:true,epoch:'new-radio-session-0001',talking:false,activate:true},1300);assert.equal(room.signals.length,0);
});
test('bounded signaling queue cannot grow without limit, and departure clears negotiations',()=>{
  let room=team();const payload=offer();payload.signal.description.sdp='x'.repeat(15000);let rejected=false;
  for(let i=0;i<30;i++)try{room=actRoom(room,'a','signal',payload,1200+i);}catch(error){assert.equal(error.status,429);rejected=true;break;}
  assert.equal(rejected,true);assert.ok(JSON.stringify(room.signals).length<=128000);
  room=actRoom(room,'a','leave',{},1500);assert.equal(room.signals.length,0);assert.equal(room.players.find(p=>p.id==='a').radioEnabled,false);
});
test('talk indicator expires if release packet is lost',()=>{
  let room=team();room=actRoom(room,'a','radio-status',{enabled:true,epoch:'a'.repeat(20),talking:true},1200);
  assert.equal(projectRoom(room,'b',1300).players.find(p=>p.id==='a').talking,true);
  assert.equal(projectRoom(room,'b',11201).players.find(p=>p.id==='a').talking,false);
});
test('retiring instances cannot disable or reclaim a newly activated radio epoch',()=>{
  let room=team();const current='new-radio-session-0002';
  room=actRoom(room,'a','radio-status',{enabled:true,epoch:current,talking:false,activate:true},1200);
  room=actRoom(room,'a','radio-status',{enabled:false,epoch:'a'.repeat(20),talking:false},1300);
  assert.equal(room.players[0].radioEnabled,true);assert.equal(room.players[0].radioEpoch,current);
  room=actRoom(room,'a','radio-status',{enabled:true,epoch:'a'.repeat(20),talking:true},1400);
  assert.equal(room.players[0].radioEpoch,current);assert.equal(room.players[0].talking,false);
  room=actRoom(room,'a','radio-status',{enabled:false,epoch:current,talking:false},1500);
  assert.equal(room.players[0].radioEnabled,false);
});
test('each radio anomaly has independent deterministic local evidence without mic or network',()=>{
  const ids=['radio_echo','radio_chop','radio_static','radio_detune','radio_wrong_channel','radio_aftertone'];
  const normal=getProbePattern('normal');const captions=new Set([normal.caption]);
  for(const id of ids){const profile=profileForEffects([id]);assert.notEqual(profile,'normal');const a=getProbePattern(profile),b=getProbePattern(profile);assert.deepEqual(a,b);assert.notEqual(a.caption,normal.caption);captions.add(a.caption);}
  assert.equal(captions.size,7);assert.equal(getProbePattern('chop').tones[1].gain,0);assert.ok(getProbePattern('aftertone').tones.some(t=>t.at>2));
});
test('perfect-negotiation roles are complementary for every pair',()=>{
  for(const a of ['a','b','c','d'])for(const b of ['a','b','c','d'])if(a!==b)assert.notEqual(isPolitePeer(a,b),isPolitePeer(b,a));
});
test('TURN config uses expiring credentials and never exposes the signing secret',async()=>{
  const secret='test-only-not-a-deployed-secret';const cfg=await makeRadioConfig({PARALLAXE_STUN_URLS:'stun:example.invalid:3478',PARALLAXE_TURN_URLS:'turn:relay.invalid:3478',PARALLAXE_TURN_SECRET:secret},'player',1000);
  assert.equal(cfg.turnConfigured,true);assert.equal(cfg.expiresAt,3601000);const turn=cfg.iceServers.at(-1);assert.equal(turn.username,'3601:player');assert.equal(turn.credential,createHmac('sha1',secret).update(turn.username).digest('base64'));assert.ok(!JSON.stringify(cfg).includes(secret));
  const absent=await makeRadioConfig({PARALLAXE_STUN_URLS:'',PARALLAXE_TURN_URLS:'turn:relay.invalid'},'player',1000);assert.equal(absent.turnConfigured,false);assert.equal(absent.iceServers.length,0);
});

function browserHarness(secure=true,acquire){
  const keys=['window','document','navigator','AudioContext','RTCPeerConnection'];const saved=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);const events=new Map();let calls=0;
  const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param(),frequency:param()});
  const track={enabled:true,stopped:false,onended:null,stop(){this.stopped=true;}};const stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
  class FakeAudioContext{state='running';currentTime=0;sampleRate=8000;destination=node();createGain(){return node();}createBuffer(ch,length){return {getChannelData:()=>new Float32Array(length)};}createMediaStreamSource(){return node();}createAnalyser(){return {...node(),fftSize:256,frequencyBinCount:128,getByteTimeDomainData(array){array.fill(128);}};}createOscillator(){return node();}createBufferSource(){return node();}async resume(){}async close(){this.state='closed';}}
  const doc={hidden:false,addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)};
  const values={window:{isSecureContext:secure,addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)},document:doc,navigator:{mediaDevices:{getUserMedia:async()=>{calls++;return acquire?acquire():stream;}}},AudioContext:FakeAudioContext,RTCPeerConnection:class{}};
  for(const key of keys)Object.defineProperty(globalThis,key,{value:values[key],configurable:true,writable:true});
  return {track,events,doc,calls:()=>calls,restore(){for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}
test('construction, synchronization, PTT without consent and calibration never request microphone access',async()=>{
  const env=browserHarness();let radio;
  try{radio=new RadioClient({selfId:'a',send:async()=>({}),onState(){}});radio.sync({players:[]});radio.setTalking(true);await radio.probe();assert.equal(env.calls(),0);assert.equal(radio.status.microphone,false);assert.equal(radio.status.talking,false);}finally{radio?.dispose();env.restore();}
});
test('explicit microphone activation starts muted; PTT, blur, hidden state and disposal close transmission',async()=>{
  const env=browserHarness();const sends=[];let radio;
  try{radio=new RadioClient({selfId:'a',send:async(action,payload)=>{sends.push({action,payload});return {};},onState(){}});
    await radio.enableMicrophone();assert.equal(env.calls(),1);assert.equal(env.track.enabled,false);
    radio.setTalking(true);assert.equal(env.track.enabled,true);env.events.get('blur')();assert.equal(env.track.enabled,false);
    radio.setTalking(true);env.doc.hidden=true;env.events.get('visibilitychange')();assert.equal(env.track.enabled,false);
    radio.setTalking(true);radio.dispose();assert.equal(env.track.enabled,false);assert.equal(env.track.stopped,true);
    await new Promise(resolve=>setTimeout(resolve,0));assert.equal(sends.filter(s=>s.action==='radio-status').at(-1).payload.enabled,false);
  }finally{radio?.dispose();env.restore();}
});
test('insecure LAN origin reports technical unavailability without asking for microphone or altering probe evidence',async()=>{
  const env=browserHarness(false);let radio;
  try{radio=new RadioClient({selfId:'a',send:async()=>({}),onState(){}});await assert.rejects(()=>radio.enableMicrophone(),/HTTPS/);assert.equal(env.calls(),0);radio.setProfile('echo');const result=await radio.probe();assert.equal(result.caption,getProbePattern('echo').caption);assert.match(radio.status.error,/HTTPS/);}finally{radio?.dispose();env.restore();}
});
test('one deterministic initial offer is sent even when negotiationneeded does not fire and no microphone is authorized',async()=>{
  const env=browserHarness();const sent=[];const radios=[];
  class FakePeerConnection{
    connectionState='new';signalingState='stable';iceGatheringState='new';iceConnectionState='new';localDescription=null;remoteDescription=null;
    addTransceiver(){return {sender:{replaceTrack:async()=>{}}};}
    createDataChannel(label){return {label,readyState:'connecting',close(){},send(){}};}
    async setLocalDescription(){this.localDescription={type:'offer',sdp:'v=0\r\n'};this.signalingState='have-local-offer';}
    close(){this.connectionState='closed';this.signalingState='closed';}
  }
  globalThis.RTCPeerConnection=FakePeerConnection;
  try{
    for(const id of ['a','b']){const radio=new RadioClient({selfId:id,send:async(action,payload)=>{sent.push({id,action,payload});return {};},onState(){}});radios.push(radio);await radio.enablePlayback();}
    const players=['a','b'].map(id=>({id,connected:true,radioEnabled:true,radioEpoch:sent.find(s=>s.id===id&&s.action==='radio-status').payload.epoch}));
    radios.forEach(r=>r.sync({players,radioInbox:[]}));await new Promise(resolve=>setTimeout(resolve,0));
    const descriptions=sent.filter(s=>s.action==='signal'&&s.payload.signal.description);assert.equal(descriptions.length,1);assert.equal(descriptions[0].id,'a');assert.equal(env.calls(),0);
    assert.equal(radios[0].status.peers[0].localDescription,true);assert.equal(radios[1].status.peers[0].localDescription,false);
  }finally{radios.forEach(r=>r.dispose());env.restore();}
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function simulatedStream(){const track={enabled:true,stopped:false,onended:null,stop(){this.stopped=true;}};return {track,stream:{getAudioTracks:()=>[track],getTracks:()=>[track]}};}
function pendingMicrophoneHarness(){
  const requests=[];const waiting=new Map();
  const env=browserHarness(true,()=>{const request=deferred();const index=requests.push(request)-1;waiting.get(index)?.resolve(request);return request.promise;});
  return {...env,async request(index){
    if(requests[index])return requests[index];
    const ready=deferred();waiting.set(index,ready);let timeout;
    try{return await Promise.race([ready.promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error(`Microphone request ${index} was not started`)),1500);})]);}
    finally{clearTimeout(timeout);waiting.delete(index);}
  }};
}
function cancellationRadio(){return new RadioClient({selfId:'a',send:async()=>({}),onState(){}});}

test('radio cancellation: disabling playback retires a pending microphone permission',async()=>{
  const env=pendingMicrophoneHarness();const granted=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const activation=radio.enableMicrophone();const request=await env.request(0);
    radio.disablePlayback();request.resolve(granted.stream);await activation;
    assert.equal(radio.status.enabled,false);assert.equal(radio.status.microphone,false);assert.equal(radio.status.talking,false);
    assert.equal(granted.track.stopped,true);assert.equal(granted.track.enabled,false);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: stopping only the microphone preserves listening and rejects its late stream',async()=>{
  const env=pendingMicrophoneHarness();const granted=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const activation=radio.enableMicrophone();const request=await env.request(0);
    radio.disableMicrophone();request.resolve(granted.stream);await activation;
    assert.equal(radio.status.enabled,true);assert.equal(radio.status.microphone,false);assert.equal(granted.track.stopped,true);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: a granted old permission cannot replace a newly active microphone',async()=>{
  const env=pendingMicrophoneHarness();const oldStream=simulatedStream();const freshStream=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const oldActivation=radio.enableMicrophone();const oldRequest=await env.request(0);radio.disablePlayback();
    const freshActivation=radio.enableMicrophone();assert.notEqual(freshActivation,oldActivation,'Cancellation must permit a fresh explicit request');
    const freshRequest=await env.request(1);freshRequest.resolve(freshStream.stream);await freshActivation;radio.setTalking(true);
    oldRequest.resolve(oldStream.stream);await oldActivation;
    assert.equal(oldStream.track.stopped,true);assert.equal(oldStream.track.enabled,false);
    assert.equal(freshStream.track.stopped,false);assert.equal(freshStream.track.enabled,true);
    assert.equal(radio.status.enabled,true);assert.equal(radio.status.microphone,true);assert.equal(radio.status.talking,true);assert.equal(radio.status.error,null);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: rejection of an old permission cannot stop or fault a new microphone',async()=>{
  const env=pendingMicrophoneHarness();const freshStream=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const oldActivation=radio.enableMicrophone();const oldRequest=await env.request(0);radio.disablePlayback();
    const freshActivation=radio.enableMicrophone();assert.notEqual(freshActivation,oldActivation);
    const freshRequest=await env.request(1);freshRequest.resolve(freshStream.stream);await freshActivation;radio.setTalking(true);
    oldRequest.reject(Object.assign(new Error('Late denial of retired request'),{name:'NotAllowedError'}));await oldActivation;
    assert.equal(freshStream.track.stopped,false);assert.equal(freshStream.track.enabled,true);
    assert.equal(radio.status.enabled,true);assert.equal(radio.status.microphone,true);assert.equal(radio.status.talking,true);assert.equal(radio.status.error,null);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: finalizing an old request keeps the newer pending permission deduplicated',async()=>{
  const env=pendingMicrophoneHarness();const oldStream=simulatedStream();const freshStream=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const oldActivation=radio.enableMicrophone();const oldRequest=await env.request(0);radio.disablePlayback();
    const freshActivation=radio.enableMicrophone();assert.notEqual(freshActivation,oldActivation);
    const freshRequest=await env.request(1);oldRequest.resolve(oldStream.stream);await oldActivation;
    assert.equal(radio.enableMicrophone(),freshActivation,'An old finally must not clear a newer pending request');assert.equal(env.calls(),2);
    freshRequest.resolve(freshStream.stream);await freshActivation;
    assert.equal(oldStream.track.stopped,true);assert.equal(freshStream.track.stopped,false);assert.equal(freshStream.track.enabled,false);assert.equal(radio.status.microphone,true);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: an old playback activation failure cannot disable a newer activation',async()=>{
  const env=browserHarness();const started=deferred();const oldStatus=deferred();let first=true;let radio;
  try{
    radio=new RadioClient({selfId:'a',send:async(action,payload)=>{if(action==='radio-status'&&payload.activate&&first){first=false;started.resolve();return oldStatus.promise;}return {};},onState(){}});
    const oldActivation=radio.enablePlayback();const oldOutcome=oldActivation.then(()=>null,error=>error);await started.promise;radio.disablePlayback();
    const freshActivation=radio.enablePlayback();await Promise.resolve();await Promise.resolve();
    oldStatus.reject(new Error('Retired activation failed'));await oldOutcome;await freshActivation;
    assert.equal(radio.status.enabled,true);assert.equal(radio.status.microphone,false);assert.equal(radio.status.error,null);assert.equal(env.calls(),0);
  }finally{radio?.dispose();env.restore();}
});

test('radio cancellation: leaving the room stops a microphone granted after disposal',async()=>{
  const env=pendingMicrophoneHarness();const granted=simulatedStream();let radio;
  try{
    radio=cancellationRadio();const activation=radio.enableMicrophone();const request=await env.request(0);radio.dispose();
    request.resolve(granted.stream);await activation;
    assert.equal(radio.status.enabled,false);assert.equal(radio.status.microphone,false);assert.equal(granted.track.stopped,true);
  }finally{radio?.dispose();env.restore();}
});
