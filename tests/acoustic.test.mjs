import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const temp=await mkdtemp(join(tmpdir(),'parallaxe-acoustic-'));
for(const name of ['acoustic-state','acoustic-pcm','acoustic-audio','levels','catalog','rules','session']) {
  const code=stripTypeScriptTypes(await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8'),{mode:'transform'})
    .replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
  await writeFile(join(temp,`${name}.mjs`),code);
}
const {createAcousticState,ACOUSTIC_ANCHORS}=await import(pathToFileURL(join(temp,'acoustic-state.mjs')));
const {acousticPCM}=await import(pathToFileURL(join(temp,'acoustic-pcm.mjs')));
const {AcousticAudio}=await import(pathToFileURL(join(temp,'acoustic-audio.mjs')));
const {createRun,getPersonalView}=await import(pathToFileURL(join(temp,'rules.mjs')));
const {createRoom,makePlayer,joinRoom,projectRoom,actRoom}=await import(pathToFileURL(join(temp,'session.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
const pose={x:0,y:1.67,z:9,yaw:0,pitch:0};
function state(view={}) {const s=createAcousticState();s.setView({phase:'inspect',levelId:'hotel',loop:1,...view});s.update(0,pose,true);return s;}
function advance(s,seconds,p=pose,active=true,fps=60) {for(let i=0;i<Math.round(seconds*fps);i++)s.update(1/fps,p,active);}

test('paired knocks preserves silent reference and sends only the recipient count',()=>{
  let run=createRun({seed:'knocks',mode:'single',players:4});run={...run,phase:'inspect',loop:1,currentAnomalyId:'paired_knocks',observerSlots:[0,2]};
  assert.deepEqual([0,1,2,3].map(slot=>getPersonalView(run,slot).knockCount),[3,4,3,4]);
  for(let slot=0;slot<4;slot++) {const view=getPersonalView(run,slot);assert.deepEqual(view.effects,[]);assert.equal(getPersonalView({...run,phase:'reference'},slot).knockCount,0);}
  const a=state(getPersonalView(run,0)),b=state(getPersonalView(run,1));
  advance(a,4);advance(b,4);assert.match(a.snapshot().caption,/3 coups/);assert.match(b.snapshot().caption,/4 coups/);
  assert.equal(a.snapshot().voices.find(v=>v.id==='door').kind,'knock3');
  const reference=state({...getPersonalView(run,0),phase:'reference'});reference.activate('door');advance(reference,20);
  assert.equal(reference.snapshot().voices.some(v=>v.id==='door'),false);assert.match(reference.snapshot().caption,/aucun coup/);
});
test('room public pings contain no local sound or other count',()=>{
  let room=createRoom('ABCDEF',makePlayer('a','A','hash-a',0,1000),'standard','knock-room',1000,{mode:'single',levelId:'hotel'});
  room=joinRoom(room,makePlayer('b','B','hash-b',1,1000));room.started=true;room.run={...room.run,phase:'inspect',loop:1,currentAnomalyId:'paired_knocks',observerSlots:[0]};
  room=actRoom(room,'a','ping',{target:'music-box',caption:'private',knockCount:99},1100);
  const a=projectRoom(room,'a',1100),b=projectRoom(room,'b',1100);
  assert.equal(a.view.knockCount,3);assert.equal(b.view.knockCount,4);
  assert.deepEqual(Object.keys(b.pings[0]).sort(),['at','id','name','target']);
  assert.ok(!JSON.stringify(b).includes('hash-a'));assert.ok(!JSON.stringify(b.pings).includes('private'));
});
for(const fps of [10,30,60,144])test(`12-second count cycle and deliberate replay at ${fps} fps`,()=>{
  const s=state({knockCount:4});advance(s,4,pose,true,fps);assert.match(s.snapshot().caption,/4 coups/);
  advance(s,8.4,pose,true,fps);assert.match(s.snapshot().caption,/0 coup/);
  advance(s,1,pose,true,fps);assert.match(s.snapshot().caption,/1 coup/);
  assert.ok(s.activate('door'));assert.match(s.snapshot().caption,/0 coup/);
});
test('receiver must be picked up; silence and long breath differ only by local perception',()=>{
  const s=state({effects:['telephone_breath']});advance(s,10);assert.ok(!s.snapshot().voices.some(v=>v.kind==='breath'));
  s.activate('phone');assert.equal(s.snapshot().phoneLifted,true);assert.match(s.snapshot().caption,/inspiration/);
  advance(s,4);assert.match(s.snapshot().caption,/expiration/);
  s.setView({effects:[]});assert.match(s.snapshot().caption,/silence dans le fil/);assert.ok(!s.snapshot().voices.some(v=>v.id==='phone'));
  s.setView({effects:['telephone_breath']});assert.match(s.snapshot().caption,/expiration/);
  s.stop();assert.equal(s.snapshot().phoneLifted,false);
});
test('music repeats in reference while the affected last note remains after the completed cycle',()=>{
  const a=state({effects:['music_one_note']}),b=state();a.activate('music-box');b.activate('music-box');
  advance(a,9);advance(b,9);assert.match(a.snapshot().caption,/maintenu/);assert.match(b.snapshot().caption,/note 2\/8/);
  assert.equal(a.snapshot().voices.find(v=>v.id==='music-box').kind,'held-note');
  a.setView({effects:[]});assert.equal(a.snapshot().voices.find(v=>v.id==='music-box').kind,'melody');
  a.setView({effects:['music_one_note']});assert.equal(a.snapshot().voices.find(v=>v.id==='music-box').kind,'held-note');
  a.activate('music-box');assert.match(a.snapshot().caption,/note 1\/8/);
});
test('indoor rainfall requires approaching salon center; origin and captions agree after moving away',()=>{
  const s=state({effects:['rain_inside']});assert.deepEqual(s.snapshot().voices[0].position,ACOUSTIC_ANCHORS.window);
  advance(s,1,{x:NaN,z:2.65});assert.deepEqual(s.snapshot().voices[0].position,ACOUSTIC_ANCHORS.window);
  advance(s,1,{x:0,z:2.65});assert.deepEqual(s.snapshot().voices[0].position,ACOUSTIC_ANCHORS.ceiling);assert.match(s.snapshot().caption,/plafond/);
  advance(s,2);assert.match(s.snapshot().caption,/plafond/);
  s.setView({effects:[]});assert.match(s.snapshot().caption,/fenêtre/);
});
test('pause produces no voices, freezes timers, rejects activation and resumes without fast-forward',()=>{
  const s=state({effects:['music_one_note'],knockCount:3});s.activate('music-box');advance(s,2);const before=s.snapshot();
  advance(s,90,pose,false);assert.equal(s.snapshot().voices.length,0);assert.equal(s.snapshot().caption,before.caption);assert.equal(s.activate('phone'),false);
  s.update(0,pose,true);assert.equal(s.snapshot().musicAngle,before.musicAngle);
});
test('every new effect resets across rounds, reference and non-hotel places',()=>{
  const s=state({effects:['rain_inside','telephone_breath','music_one_note'],knockCount:4});s.activate('phone');s.activate('music-box');advance(s,12,{x:0,z:2.65});
  s.setView({loop:2,phase:'reference'});s.update(0,pose);const v=s.snapshot();assert.equal(v.phoneLifted,false);assert.equal(v.musicPlaying,false);assert.equal(v.voices.length,1);assert.match(v.caption,/fenêtre/);
  for(const levelId of ['metro','clinic','cabin']) {s.setView({levelId,phase:'inspect',effects:['music_one_note'],knockCount:4});s.update(.1,pose);assert.equal(s.snapshot().voices.length,0);assert.equal(s.snapshot().caption,'');}
});
for(const kind of ['rain','knock3','knock4','breath','melody','melody-held','held-note'])test(`${kind} PCM is finite, deterministic, bounded and nonempty`,()=>{
  const a=acousticPCM(kind,8000),b=acousticPCM(kind,8000);assert.deepEqual(a,b);assert.ok(a.length<=12*8000);
  let energy=0;for(const v of a){assert.ok(Number.isFinite(v)&&Math.abs(v)<=.45);energy+=v*v;}assert.ok(energy>1);
});
test('three/four knock buffers contain exactly their counted impulses and silence elsewhere',()=>{
  for(const count of [3,4]) {const pcm=acousticPCM(`knock${count}`,8000);let groups=0,prior=false;
    for(let i=0;i<pcm.length;i+=160){const present=pcm.subarray(i,i+160).some(v=>Math.abs(v)>.002);if(present&&!prior)groups++;prior=present;}
    assert.equal(groups,count);assert.ok(pcm.slice(4*8000).every(v=>v===0));}
});
test('ordinary melody falls silent at the end; altered loop and held-note do not',()=>{
  const sum=(a)=>a.reduce((s,x)=>s+x*x,0);
  assert.equal(sum(acousticPCM('melody',8000).slice(6*8000)),0);
  assert.ok(sum(acousticPCM('melody-held',8000).slice(6*8000))>5);
  const a=acousticPCM('held-note',8000);assert.ok(Math.abs(a[0]-a.at(-1))<.06);
  assert.throws(()=>acousticPCM('rain',0),RangeError);
});
class Param {value=0;setValueAtTime(v){this.value=v;}}
class Node {connections=[];disconnects=0;connect(n){this.connections.push(n);return n;}disconnect(){this.disconnects++;}}
class Context {
  sampleRate=8000;currentTime=0;state='running';sources=[];panners=[];
  listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,new Param()]));
  createGain(){return Object.assign(new Node(),{gain:new Param()});}
  createPanner(){const n=Object.assign(new Node(),{positionX:new Param(),positionY:new Param(),positionZ:new Param()});this.panners.push(n);return n;}
  createBuffer(channels,length,rate){const a=new Float32Array(length);return {duration:length/rate,getChannelData:()=>a};}
  createBufferSource(){const n=Object.assign(new Node(),{stops:0,start(t,offset){this.started=[t,offset];},stop(){this.stops++;}});this.sources.push(n);return n;}
}
test('audio adapter uses the ambience bus, spatial origin, bounded voices and resume offsets',()=>{
  const c=new Context(),out=new Node(),sound=new AcousticAudio(c,out),s=state({effects:['telephone_breath']});s.activate('phone');
  sound.sync(s.snapshot(),pose,true);assert.equal(c.sources.length,2);assert.ok(c.panners.every(p=>p.connections.includes(out)));
  for(let i=0;i<20;i++){c.currentTime+=.05;s.update(.05,pose);sound.sync(s.snapshot(),pose,true);}assert.equal(c.sources.length,2);
  assert.equal(c.panners[1].positionX.value,ACOUSTIC_ANCHORS.phone[0]);
  const originals=[...c.sources];sound.stop();assert.ok(originals.every(s=>s.stops===1&&s.disconnects===1));
  c.currentTime+=20;sound.sync(s.snapshot(),pose,true);assert.equal(c.sources.length,4);assert.ok(c.sources[3].started[1]>.9);
  sound.dispose();sound.dispose();assert.ok(c.sources.every(s=>s.stops===1&&s.disconnects===1));
});
test('muting, suspension, private view switch and passage reset stop old audio without stale sources',()=>{
  const c=new Context(),sound=new AcousticAudio(c,new Node()),s=state({knockCount:3});sound.sync(s.snapshot(),pose,true);
  sound.sync(s.snapshot(),pose,false);assert.ok(c.sources.every(s=>s.stops===1));
  s.setView({knockCount:4});sound.sync(s.snapshot(),pose,true);assert.equal(c.sources.at(-1).buffer.duration,12);
  c.state='suspended';sound.sync(s.snapshot(),pose,true);assert.ok(c.sources.every(s=>s.stops===1));
  c.state='running';s.setView({phase:'reference',loop:2});sound.sync(s.snapshot(),pose,true);assert.equal(c.sources.filter(s=>s.stops===0).length,1);
  sound.dispose();
});
