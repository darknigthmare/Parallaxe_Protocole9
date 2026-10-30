import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHmac} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';

const temp=await mkdtemp(join(tmpdir(),'parallaxe-radio-'));
for(const name of ['levels','catalog','rules','session','radio-evidence','radio','radio-config']){
  const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
  const output=stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
  await writeFile(join(temp,`${name}.mjs`),output);
}
const {RadioClient,profileForEffects,getProbePattern,isPolitePeer}=await import(pathToFileURL(join(temp,'radio.mjs')));
const {renderProbePcm,createRoomImpulse,reverberateRadio,getRadioReferenceCaption}=await import(pathToFileURL(join(temp,'radio-evidence.mjs')));
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
  const ids=['radio_echo','radio_chop','radio_static','radio_detune','radio_wrong_channel','radio_aftertone','radio_no_squelch','radio_countercode','radio_left_only','radio_wrong_room','radio_order_swap','radio_pulse_inside'];
  const normal=getProbePattern('normal');const captions=new Set([normal.caption]);
  for(const id of ids){const profile=profileForEffects([id]);assert.notEqual(profile,'normal');const a=getProbePattern(profile),b=getProbePattern(profile);assert.deepEqual(a,b);assert.notEqual(a.caption,normal.caption);captions.add(a.caption);}
  assert.equal(captions.size,13);assert.equal(getProbePattern('chop').tones[1].gain,0);assert.ok(getProbePattern('aftertone').tones.some(t=>t.at>2));
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
  const nodes=[],contexts=[];
  const param=()=>({value:0,setValueAtTime(value){this.value=value;},setTargetAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;}});
  const node=(kind='node')=>{const result={kind,connections:[],disconnected:false,started:false,stopped:false,stopTimes:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;this.connections=[];},start(){this.started=true;},stop(at){this.stopTimes.push(at);if(at===undefined)this.stopped=true;},gain:param(),frequency:param()};nodes.push(result);return result;};
  const track={enabled:true,stopped:false,onended:null,stop(){this.stopped=true;}};const stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
  class FakeAudioContext{
    state='running';currentTime=0;sampleRate=8000;destination=node('destination');constructor(){contexts.push(this);}
    createGain(){return node('gain');}
    createBuffer(ch,length,rate=this.sampleRate){const data=Array.from({length:ch},()=>new Float32Array(length));return {numberOfChannels:ch,length,sampleRate:rate,duration:length/rate,getChannelData:index=>data[index]};}
    createMediaStreamSource(){return node('media-source');}
    createAnalyser(){return Object.assign(node('analyser'),{fftSize:256,frequencyBinCount:128,getByteTimeDomainData(array){array.fill(128);}});}
    createOscillator(){return node('oscillator');}createBufferSource(){return node('buffer-source');}
    createBiquadFilter(){return node('filter');}createDynamicsCompressor(){return Object.assign(node('compressor'),{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});}
    createWaveShaper(){return node('shaper');}createDelay(){return Object.assign(node('delay'),{delayTime:param()});}
    createStereoPanner(){return Object.assign(node('panner'),{pan:param()});}createConvolver(){return node('convolver');}
    async resume(){}async close(){this.state='closed';}
  }
  const doc={hidden:false,addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)};
  const values={window:{isSecureContext:secure,addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)},document:doc,navigator:{mediaDevices:{getUserMedia:async()=>{calls++;return acquire?acquire():stream;}}},AudioContext:FakeAudioContext,RTCPeerConnection:class{}};
  for(const key of keys)Object.defineProperty(globalThis,key,{value:values[key],configurable:true,writable:true});
  return {track,events,doc,nodes,contexts,Context:FakeAudioContext,calls:()=>calls,restore(){for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
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

function signalingHarness({failSignal=false}={}){
  const env=browserHarness(),sent=[],connections=[],operations=[],blocked=new Map();
  const signalStarted=deferred();let epoch='';
  const step=async(pc,kind)=>{
    operations.push({pc,kind});
    const key=pc.index+':'+kind,block=blocked.get(key);
    if(block){blocked.delete(key);block.started.resolve();await block.finished.promise;}
  };
  class FakePeerConnection{
    connectionState='new';signalingState='stable';iceGatheringState='new';iceConnectionState='new';localDescription=null;remoteDescription=null;
    constructor(){this.index=connections.length;connections.push(this);}
    addTransceiver(){return {sender:{replaceTrack:async()=>{}}};}
    createDataChannel(label){return {label,readyState:'connecting',close(){},send(){}};}
    async setRemoteDescription(description){
      await step(this,'remote');this.remoteDescription=description;
      if(this.signalingState!=='closed')this.signalingState=description.type==='offer'?'have-remote-offer':'stable';
    }
    async setLocalDescription(){
      await step(this,'local');
      if(this.signalingState==='closed')throw new Error('Retired peer is closed');
      this.localDescription={type:this.remoteDescription?.type==='offer'?'answer':'offer',sdp:'v=0\r\n'};
      this.signalingState=this.localDescription.type==='answer'?'stable':'have-local-offer';
    }
    async addIceCandidate(){await step(this,'candidate');}
    restartIce(){operations.push({pc:this,kind:'restart'});}
    close(){this.connectionState='closed';this.signalingState='closed';}
  }
  globalThis.RTCPeerConnection=FakePeerConnection;
  const radio=new RadioClient({selfId:'z',onState(){},send:async(action,payload)=>{
    sent.push({action,payload});
    if(action==='radio-status'&&payload.activate)epoch=payload.epoch;
    if(action==='signal'&&failSignal){signalStarted.resolve();throw new Error('Transient signaling failure');}
    return {};
  }});
  return {radio,sent,connections,operations,signalStarted,env,
    get epoch(){return epoch;},
    block(kind,index=0){const value={started:deferred(),finished:deferred()};blocked.set(index+':'+kind,value);return value;},
    frame(inbox=[]){return {players:[{id:'z',connected:true,radioEnabled:true,radioEpoch:epoch},{id:'a',connected:true,radioEnabled:true,radioEpoch:'radio_epoch_alpha_01'}],radioInbox:inbox};},
    offer(id){return {id,from:'a',to:'z',fromEpoch:'radio_epoch_alpha_01',toEpoch:epoch,createdAt:Date.now(),description:{type:'offer',sdp:'v=0\r\n'}};},
    close(){radio.disablePlayback();radio.dispose();env.restore();}
  };
}
const flushSignaling=()=>new Promise(resolve=>setImmediate(resolve));
const acknowledgements=sent=>sent.filter(message=>message.action==='signal-ack').flatMap(message=>message.payload.ids);

for(const action of ['disablePlayback','dispose']){
  test(`radio teardown: a queued inbox cannot recreate peers after ${action}`,async()=>{
    const h=signalingHarness();
    try{
      await h.radio.enablePlayback();await flushSignaling();
      h.radio.sync(h.frame([h.offer('queued-before-stop')]));
      assert.equal(h.connections.length,1);
      h.radio[action]();await flushSignaling();
      assert.equal(h.radio.status.enabled,false);
      assert.equal(h.radio.status.peers.length,0,'An extinguished talkie must keep its peer map empty');
      assert.equal(h.connections.length,1,'No replacement connection may be created by the retired inbox');
      assert.ok(h.connections.every(pc=>pc.connectionState==='closed'));
      assert.deepEqual(acknowledgements(h.sent),[]);
      assert.equal(h.sent.filter(message=>message.action==='signal').length,0);
    }finally{h.close();}
  });
}

for(const replacement of ['reconnect','reactivate']){
  test(`radio teardown: ${replacement} handles its own inbox while a retired offer is pending`,async()=>{
    const h=signalingHarness();let stalled;
    try{
      await h.radio.enablePlayback();await flushSignaling();
      const oldEpoch=h.epoch,oldOffer=h.offer('old-offer');
      stalled=h.block('remote');h.radio.sync(h.frame([oldOffer]));await stalled.started.promise;
      if(replacement==='reconnect')await h.radio.reconnect();
      else{h.radio.disablePlayback();await h.radio.enablePlayback();}
      assert.notEqual(h.epoch,oldEpoch);await flushSignaling();
      h.radio.sync(h.frame([h.offer('current-offer')]));await flushSignaling();
      assert.ok(acknowledgements(h.sent).includes('current-offer'),'A retired operation must not block the new radio session');
      const current=h.connections.at(-1);
      assert.equal(current.localDescription?.type,'answer');
      stalled.finished.resolve();await flushSignaling();
      assert.equal(h.connections[0].connectionState,'closed');
      assert.equal(h.operations.filter(operation=>operation.pc===h.connections[0]&&operation.kind==='local').length,0,'No answer may be built after the peer was retired');
      assert.ok(!acknowledgements(h.sent).includes('old-offer'));
      assert.equal(h.sent.filter(message=>message.action==='signal').length,1,'Only the current answer is signaled');
      assert.equal(h.radio.status.enabled,true);assert.equal(h.radio.status.peers.length,1);
      assert.equal(h.radio.status.error,null);
    }finally{stalled?.finished.resolve();await flushSignaling();h.close();}
  });
}

test('radio teardown: a retired remote-description rejection cannot fault the new session',async()=>{
  const h=signalingHarness();let stalled;
  try{
    await h.radio.enablePlayback();await flushSignaling();
    stalled=h.block('remote');h.radio.sync(h.frame([h.offer('rejected-old-offer')]));await stalled.started.promise;
    await h.radio.reconnect();await flushSignaling();
    h.radio.sync(h.frame([h.offer('current-after-rejection')]));await flushSignaling();
    stalled.finished.reject(new Error('Old negotiation completed after cancellation'));await flushSignaling();
    assert.equal(h.radio.status.error,null);assert.equal(h.radio.status.enabled,true);
    assert.deepEqual(acknowledgements(h.sent),['current-after-rejection']);
  }finally{stalled?.finished.resolve();await flushSignaling();h.close();}
});

for(const operation of ['remote','local'])for(const retirement of ['departure','remote-epoch']){
  test(`radio teardown: a retired ${operation} rejection after ${retirement} cannot fault its replacement peer`,async()=>{
    const h=signalingHarness();let stalled;
    try{
      await h.radio.enablePlayback();await flushSignaling();
      const localEpoch=h.epoch;
      stalled=h.block(operation);
      h.radio.sync(h.frame([h.offer('old-peer-offer')]));await stalled.started.promise;
      if(retirement==='departure'){
        const absent=h.frame();absent.players=absent.players.filter(player=>player.id==='z');
        h.radio.sync(absent);
      }
      const remoteEpoch='radio_epoch_alpha_02';
      const replacement=h.frame([{...h.offer('replacement-peer-offer'),fromEpoch:remoteEpoch}]);
      replacement.players.find(player=>player.id==='a').radioEpoch=remoteEpoch;
      h.radio.sync(replacement);
      assert.equal(h.epoch,localEpoch,'Replacing a remote peer must not reactivate the local radio');
      assert.equal(h.connections[0].connectionState,'closed');assert.equal(h.connections.length,2);
      stalled.finished.reject(new Error('Retired individual peer rejected its description'));
      await flushSignaling();
      // The next ordinary poll processes the replacement inbox once the old operation settles.
      h.radio.sync(replacement);await flushSignaling();
      assert.equal(h.connections[1].localDescription?.type,'answer');
      assert.ok(acknowledgements(h.sent).includes('replacement-peer-offer'));
      const answers=h.sent.filter(message=>message.action==='signal'&&message.payload.signal.description);
      assert.equal(answers.length,1);assert.equal(answers[0].payload.signal.toEpoch,remoteEpoch);
      assert.equal(h.radio.status.enabled,true);assert.equal(h.radio.status.peers.length,1);
      assert.equal(h.radio.status.error,null);
    }finally{stalled?.finished.resolve();await flushSignaling();h.close();}
  });
}

test('radio teardown: signaling retries stop when their peer is retired',async()=>{
  const h=signalingHarness({failSignal:true});
  try{
    await h.radio.enablePlayback();await flushSignaling();
    h.radio.sync(h.frame([h.offer('offer-before-retry')]));await h.signalStarted.promise;
    h.radio.disablePlayback();
    await new Promise(resolve=>setTimeout(resolve,220));
    assert.equal(h.sent.filter(message=>message.action==='signal').length,1,'An obsolete answer must not be retried after extinction');
    assert.deepEqual(acknowledgements(h.sent),[]);
    assert.equal(h.radio.status.error,null);assert.equal(h.radio.status.peers.length,0);
  }finally{h.close();}
});


const newProfiles=['no_squelch','countercode','left_only','wrong_room','order_swap','pulse_inside'];
function energy(samples,rate,start=0,end=samples.length/rate){let sum=0;const from=Math.max(0,Math.floor(start*rate)),to=Math.min(samples.length,Math.ceil(end*rate));for(let i=from;i<to;i++)sum+=samples[i]**2;return sum/Math.max(1,to-from);}
function spectralAmplitude(samples,rate,frequency,start,duration=.12){
  const first=Math.round(start*rate),count=Math.round(duration*rate);let real=0,imaginary=0;
  for(let i=0;i<count;i++){const value=(samples[first+i]??0)*(0.5-0.5*Math.cos(2*Math.PI*i/(count-1)));const angle=2*Math.PI*frequency*i/rate;real+=value*Math.cos(angle);imaginary-=value*Math.sin(angle);}
  return Math.hypot(real,imaginary)/count;
}
function calibrationSources(env){return env.nodes.filter(node=>node.kind==='buffer-source'&&node.buffer?.numberOfChannels===2);}

test('radio v0.3: all twelve anomalies produce distinct deterministic bounded PCM waveforms',()=>{
  const profiles=['normal','echo','chop','static','detune','wrong_channel','aftertone',...newProfiles];const fingerprints=new Set();
  for(const profile of profiles){
    const a=renderProbePcm(profile,{relayCode:'3142'},8000),b=renderProbePcm(profile,{relayCode:'3142'},8000);
    assert.deepEqual(a.channels,b.channels,profile);assert.equal(a.channels[0].length,a.channels[1].length);
    assert.ok(energy(a.channels[0],8000)>0,profile);assert.ok(a.duration<6);
    for(const channel of a.channels)assert.ok(channel.every(value=>Number.isFinite(value)&&Math.abs(value)<=0.180001),profile);
    const hash=createHmac('sha256','test-waveform').update(Buffer.from(a.channels[0].buffer)).update(Buffer.from(a.channels[1].buffer)).digest('hex');fingerprints.add(hash);
  }
  assert.equal(fingerprints.size,profiles.length);
  for(const rate of [44100,48000]){const pcm=renderProbePcm('countercode',{relayCode:'8679'},rate);assert.equal(pcm.sampleRate,rate);assert.equal(pcm.evidence.receivedCode,'8670');}
});

test('radio v0.3: no-squelch removes the actual closing click and preserves the opening and sequence',()=>{
  const normal=renderProbePcm('normal',{},8000),missing=renderProbePcm('no_squelch',{},8000);
  assert.deepEqual(normal.channels[0].slice(0,Math.round(3.64*8000)),missing.channels[0].slice(0,Math.round(3.64*8000)));
  assert.ok(energy(normal.channels[0],8000,3.64,3.69)>1e-6);
  assert.ok(energy(missing.channels[0],8000,3.64,3.69)<1e-15);
  assert.equal(missing.evidence.closingClick,false);assert.match(missing.caption,/ne maintient pas la transmission/);
});

test('radio v0.3: countercode changes the decoded DTMF digit while retaining the common panel reference',()=>{
  for(const reference of ['0000','1111','3142','9999']){
    const normal=getProbePattern('normal',{relayCode:reference}),changed=getProbePattern('countercode',{relayCode:reference});
    assert.equal(normal.evidence.receivedCode,reference);assert.equal(changed.evidence.referenceCode,reference);assert.notEqual(changed.evidence.receivedCode,reference);
    assert.match(getRadioReferenceCaption({relayCode:reference}),new RegExp(reference.split('').join(' · ')));
  }
  const normal=renderProbePcm('normal',{relayCode:'3142'},8000),changed=renderProbePcm('countercode',{relayCode:'3142'},8000);
  assert.equal(changed.evidence.receivedCode,'3143');assert.deepEqual(normal.channels[0].slice(0,10320),changed.channels[0].slice(0,10320));
  const normalDigit=spectralAmplitude(normal.channels[0],8000,1336,1.32),normalOther=spectralAmplitude(normal.channels[0],8000,1477,1.32);
  const changedDigit=spectralAmplitude(changed.channels[0],8000,1477,1.32),changedOther=spectralAmplitude(changed.channels[0],8000,1336,1.32);
  assert.ok(normalDigit>normalOther*20);assert.ok(changedDigit>changedOther*20);assert.match(changed.caption,/sans voix parlée/);
});

test('radio v0.3: the left-only signal has zero right samples and conserves total stereo power',()=>{
  const normal=renderProbePcm('normal',{},8000),left=renderProbePcm('left_only',{},8000);
  assert.deepEqual(normal.channels[0],normal.channels[1]);assert.ok(left.channels[1].every(value=>value===0));
  assert.ok(Math.abs(energy(left.channels[0],8000)/(energy(normal.channels[0],8000)*2)-1)<1e-6);
  assert.deepEqual(left.evidence.channels,{left:1,right:0});assert.match(left.caption,/ne mesure pas votre casque/);
});

test('radio v0.3: long-room PCM contains a real reverberant tail and uses the original finite impulse response',()=>{
  const normal=renderProbePcm('normal',{},8000),room=renderProbePcm('wrong_room',{},8000);
  assert.equal(normal.evidence.reverbSeconds,.12);assert.equal(room.evidence.reverbSeconds,2.4);
  assert.equal(energy(normal.channels[0],8000,4,5.5),0);assert.ok(energy(room.channels[0],8000,4,5.5)>1e-10);
  const impulse=createRoomImpulse(8000,2.4),input=new Float32Array(impulse.length+400);input[0]=1;input[400]=.5;
  const response=reverberateRadio(input,8000,2.4);
  for(let i=0;i<response.length;i++)assert.ok(Math.abs(response[i]-((impulse[i]??0)+.5*(impulse[i-400]??0)))<1e-7);
  assert.ok(Math.abs(impulse.length/8000-2.4)<.001);assert.ok(impulse.every(Number.isFinite));
});

test('radio v0.3: order-swap changes the actual second and third frequencies, not their count or clarity',()=>{
  const normal=renderProbePcm('normal',{},8000),swapped=renderProbePcm('order_swap',{},8000);
  assert.deepEqual(swapped.evidence.sequence,[1,3,2]);assert.equal(swapped.evidence.pulseCount,3);
  assert.ok(spectralAmplitude(normal.channels[0],8000,880,2.58)>spectralAmplitude(normal.channels[0],8000,1100,2.58)*20);
  assert.ok(spectralAmplitude(swapped.channels[0],8000,1100,2.58)>spectralAmplitude(swapped.channels[0],8000,880,2.58)*20);
  assert.ok(spectralAmplitude(swapped.channels[0],8000,880,3.13)>spectralAmplitude(swapped.channels[0],8000,1100,3.13)*20);
});

test('radio v0.3: the fourth pulse adds a bounded synthetic breath after the closing click',()=>{
  const normal=renderProbePcm('normal',{},8000),breath=renderProbePcm('pulse_inside',{},8000);
  assert.deepEqual(breath.evidence.sequence,[1,2,3,4]);assert.equal(breath.evidence.pulseCount,4);
  assert.equal(energy(normal.channels[0],8000,4.1,4.9),0);assert.ok(energy(breath.channels[0],8000,4.1,4.9)>1e-6);
  assert.deepEqual(breath.channels[0].slice(0,normal.channels[0].length),normal.channels[0]);assert.match(breath.caption,/souffle synthétique/);
});

test('radio v0.3: RadioClient plays the production stereo buffer and keeps mono accessibility separate from evidence',async()=>{
  const env=browserHarness();let radio;
  try{
    radio=new RadioClient({selfId:'training',send:async()=>{throw new Error('No network expected');},onState(){}});radio.setEvidence({relayCode:'8279'});radio.setProfile('countercode');
    const result=await radio.probe();const source=calibrationSources(env).at(-1),expected=renderProbePcm('countercode',{relayCode:'8279'},8000);
    assert.equal(result.audible,true);assert.equal(result.evidence.referenceCode,'8279');assert.equal(result.evidence.receivedCode,'8270');
    assert.deepEqual(source.buffer.getChannelData(0),expected.channels[0]);assert.deepEqual(source.buffer.getChannelData(1),expected.channels[1]);assert.equal(radio.status.probeActive,true);assert.equal(env.calls(),0);
    radio.setProfile('left_only');radio.setMonoOutput(true);const mono=await radio.probe();
    const output=env.nodes.find(node=>node.kind==='gain'&&node.channelCountMode==='explicit');assert.equal(output.channelCount,1);assert.equal(output.channelInterpretation,'speakers');
    assert.deepEqual(mono.evidence.channels,{left:1,right:0});assert.match(mono.caption,/avant mixage/);radio.setMonoOutput(false);assert.equal(output.channelCount,2);
  }finally{radio?.dispose();env.restore();}
});

test('radio v0.3: stop, replacement, profile changes, reference changes and disposal cancel every calibration source',async()=>{
  const env=browserHarness();let radio;
  try{
    radio=new RadioClient({selfId:'training',send:async()=>({}),onState(){}});radio.setProfile('pulse_inside');await radio.probe();
    const first=calibrationSources(env).at(-1),oldEnded=first.onended;await radio.probe();const second=calibrationSources(env).at(-1);
    assert.equal(first.stopped,true);assert.equal(first.disconnected,true);oldEnded();assert.equal(radio.status.probeActive,true);
    radio.stopProbe();assert.equal(second.stopped,true);assert.equal(second.disconnected,true);assert.equal(radio.status.probeActive,false);
    await radio.probe();const third=calibrationSources(env).at(-1);radio.setProfile('normal');assert.equal(third.stopped,true);
    await radio.probe();const fourth=calibrationSources(env).at(-1);radio.setEvidence({relayCode:'4583'});assert.equal(fourth.stopped,true);
    await radio.probe();const fifth=calibrationSources(env).at(-1);fifth.onended();assert.equal(radio.status.probeActive,false);assert.equal(fifth.disconnected,true);
    await radio.probe();const last=calibrationSources(env).at(-1);radio.dispose();assert.equal(last.stopped,true);assert.equal(last.disconnected,true);assert.equal(radio.status.probeActive,false);
  }finally{radio?.dispose();env.restore();}
});

test('radio v0.3: stopping while AudioContext resumes cannot start a retired calibration',async()=>{
  const env=browserHarness(),resume=deferred(),entered=deferred();let radio;
  class SuspendedContext extends env.Context{state='suspended';async resume(){entered.resolve();await resume.promise;this.state='running';}}
  globalThis.AudioContext=SuspendedContext;
  try{
    radio=new RadioClient({selfId:'training',send:async()=>({}),onState(){}});const pending=radio.probe();await entered.promise;radio.stopProbe();resume.resolve();
    assert.equal((await pending).audible,false);assert.equal(calibrationSources(env).length,0);assert.equal(radio.status.probeActive,false);
    assert.equal((await radio.probe()).audible,true);assert.equal(calibrationSources(env).length,1);assert.equal(env.calls(),0);
  }finally{radio?.dispose();env.restore();}
});

test('radio v0.3: all new evidence remains available without WebAudio, microphone permission or a network',async()=>{
  const env=browserHarness(false);delete globalThis.AudioContext;let radio;
  try{
    radio=new RadioClient({selfId:'training',send:async()=>{throw new Error('No network expected');},onState(){}});radio.setEvidence({relayCode:'9064'});
    for(const profile of newProfiles){radio.setProfile(profile);const result=await radio.probe();assert.equal(result.audible,false);assert.deepEqual(result.evidence,getProbePattern(profile,{relayCode:'9064'}).evidence);assert.equal(result.caption,getProbePattern(profile,{relayCode:'9064'}).caption);assert.equal(radio.status.probeActive,false);assert.match(radio.status.error,/Audio indisponible/);}
    assert.equal(env.calls(),0);
  }finally{radio?.dispose();env.restore();}
});

async function receiverHarness(){
  const env=browserHarness();const peers=[],sent=[];
  class FakePeerConnection{
    connectionState='new';signalingState='stable';iceGatheringState='new';iceConnectionState='new';localDescription=null;remoteDescription=null;
    constructor(){peers.push(this);}addTransceiver(){return {sender:{replaceTrack:async()=>{}}};}close(){this.connectionState='closed';this.signalingState='closed';}
  }
  globalThis.RTCPeerConnection=FakePeerConnection;
  const radio=new RadioClient({selfId:'z',send:async(action,payload)=>{sent.push({action,payload});return {};},onState(){}});await radio.enablePlayback();
  const epoch=sent.find(item=>item.action==='radio-status').payload.epoch;
  const frame=talking=>({players:[{id:'z',connected:true,radioEnabled:true,radioEpoch:epoch},{id:'a',connected:true,radioEnabled:true,radioEpoch:'a'.repeat(20),talking}],radioInbox:[]});
  radio.sync(frame(false));
  return {env,radio,peer:peers[0],frame};
}

test('radio v0.3: received voice is routed through a panner and original convolver buffers, both reset by a normal view',async()=>{
  const {env,radio,peer}=await receiverHarness();
  try{
    const media=simulatedStream();peer.ontrack({streams:[media.stream],track:media.track});
    const pan=env.nodes.find(node=>node.kind==='panner'),convolver=env.nodes.find(node=>node.kind==='convolver');
    assert.equal(pan.pan.value,0);assert.equal(convolver.normalize,false);assert.ok(Math.abs(convolver.buffer.duration-.12)<.001);
    radio.setProfile('left_only');assert.equal(pan.pan.value,-1);radio.setProfile('wrong_room');assert.equal(pan.pan.value,0);assert.ok(Math.abs(convolver.buffer.duration-2.4)<.001);
    assert.deepEqual(convolver.buffer.getChannelData(0),createRoomImpulse(8000,2.4));
    radio.setProfile('normal');assert.ok(Math.abs(convolver.buffer.duration-.12)<.001);assert.equal(pan.pan.value,0);assert.equal(env.calls(),0);
    radio.dispose();assert.equal(pan.disconnected,true);assert.equal(convolver.disconnected,true);
  }finally{radio.dispose();env.restore();}
});

test('radio v0.3: received no-squelch preserves the real PTT state and the fourth breath is cancelled on shutdown',async()=>{
  const {env,radio,frame}=await receiverHarness();const sources=()=>env.nodes.filter(node=>node.kind==='buffer-source');
  try{
    radio.setProfile('no_squelch');const before=sources().length;radio.sync(frame(true));assert.equal(sources().length,before+1);radio.sync(frame(false));assert.equal(sources().length,before+1);assert.equal(radio.status.peers[0].talking,false);
    radio.setProfile('normal');const regular=sources().length;radio.sync(frame(true));radio.sync(frame(false));assert.equal(sources().length,regular+2);
    radio.setProfile('pulse_inside');radio.sync(frame(true));radio.sync(frame(false));const breath=sources().at(-1);
    assert.ok(Math.abs(breath.buffer.duration-1.05)<.001);assert.ok(energy(breath.buffer.getChannelData(0),8000)>0);
    radio.disablePlayback();assert.equal(breath.stopped,true);assert.equal(breath.disconnected,true);assert.equal(radio.status.enabled,false);assert.equal(env.calls(),0);
  }finally{radio.dispose();env.restore();}
});
