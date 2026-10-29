import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

// Exercise the real domain sources without a renderer, network or extra dependency.
const temp=await mkdtemp(join(tmpdir(),'parallaxe-resilience-'));
try {
  for(const name of ['levels','catalog','rules','session']){
    const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
    const output=stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
    await writeFile(join(temp,`${name}.mjs`),output);
  }
}catch(error){await rm(temp,{recursive:true,force:true});throw error;}
test.after(()=>rm(temp,{recursive:true,force:true}));
const {createRoom,joinRoom,actRoom,projectRoom,makePlayer,PRESENCE_TIMEOUT,SIGNAL_TTL}=await import(pathToFileURL(join(temp,'session.mjs')));
const now=1_000;
const later=now+PRESENCE_TIMEOUT;
const epochA='radio_epoch_alpha_01',epochB='radio_epoch_bravo_01';
function roomWith(count=2){
  let room=createRoom('ABCDEF',makePlayer('a','Alpha','secret-a',0,now),'standard','private-seed',now);
  for(let slot=1;slot<count;slot++){
    const id=String.fromCharCode(97+slot);
    room=joinRoom(room,makePlayer(id,`Inspecteur ${id}`,`secret-${id}`,slot,now));
  }
  room=actRoom(room,'a','start',{},now);
  room=actRoom(room,'a','next',{},now);
  room.run.currentAnomalyId='shadow_figure';room.run.observerSlots=[count-1];
  return room;
}
function withRadio(){
  let room=roomWith();
  room=actRoom(room,'a','radio-status',{enabled:true,activate:true,epoch:epochA},now);
  room=actRoom(room,'b','radio-status',{enabled:true,activate:true,epoch:epochB},now);
  return actRoom(room,'a','signal',{signal:{to:'b',epoch:epochA,toEpoch:epochB,description:{type:'offer',sdp:'v=0'}}},now);
}
function votes(room){return room.players.filter(p=>!p.left).map(p=>p.vote);}
function messageCount(room){return room.messages.filter(m=>m.senderId==='control').length;}
function keep(room,id,at){return actRoom(room,id,'ping',{},at);}

test('a returning witness cannot complete a verdict using a pre-disconnection vote',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room.players[1].lastSeen=later-1;
  room=keep(room,'a',later);
  assert.deepEqual(votes(room),[null,null]);
  room=actRoom(room,'b','vote',{vote:true},later+1);
  assert.equal(room.run.phase,'inspect');assert.equal(room.run.strikes,0);
  room=actRoom(room,'a','vote',{vote:true},later+2);
  assert.equal(room.run.phase,'reveal');assert.equal(room.run.streak,1);
});
test('timeout boundary is inclusive; one millisecond earlier preserves the ballot',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  const before=keep(room,'b',later-1);
  assert.equal(before.players[0].vote,true);
  const at=keep(before,'b',later);
  assert.deepEqual(votes(at),[null,null]);
});
test('votes are not banked while another inspector remains disconnected',()=>{
  const room=actRoom(roomWith(),'a','vote',{vote:true},later);
  assert.deepEqual(votes(room),[null,null]);
  assert.equal(projectRoom(room,'a',later).paused,true);
  assert.equal(room.run.phase,'inspect');
});
test('a returning vote invalidates all older votes before recording the new one',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room.players[1].lastSeen=later-1;
  room=actRoom(room,'a','vote',{vote:false},later);
  assert.deepEqual(votes(room),[false,null]);assert.equal(messageCount(room),1);
});
test('ordinary presence packets clear stale votes without repeating control messages',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:false},now);
  room=keep(room,'b',later);
  assert.equal(messageCount(room),1);
  room=keep(room,'b',later+1);room=keep(room,'b',later+2);
  assert.equal(messageCount(room),1);assert.deepEqual(votes(room),[null,null]);
});
test('control notification remains bounded and contains neither answer nor seed',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:false},now);
  room.messages=Array.from({length:40},(_,i)=>({id:String(i),senderId:'a',name:'Alpha',text:'Message',at:now}));
  room=keep(room,'b',later);
  assert.equal(room.messages.length,40);
  assert.equal(room.messages.at(-1).senderId,'control');
  assert.ok(!JSON.stringify(room.messages).includes('shadow_figure'));
  assert.ok(!JSON.stringify(room.messages).includes('private-seed'));
});
test('three inspectors must all reconfirm after losing the only anomaly witness',()=>{
  let room=roomWith(3);
  room=actRoom(room,'a','vote',{vote:false},now);room=actRoom(room,'b','vote',{vote:false},now);
  room.players[0].lastSeen=later-1;room.players[1].lastSeen=later-1;
  room=keep(room,'a',later);
  assert.deepEqual(votes(room),[null,null,null]);
  room=keep(room,'c',later+1);
  assert.equal(room.run.phase,'inspect');assert.equal(room.run.strikes,0);
  assert.deepEqual(room.run.observerSlots,[2]);
  for(const id of ['a','b','c'])room=actRoom(room,id,'vote',{vote:true},later+2);
  assert.equal(room.run.streak,1);
});
test('temporary absence preserves perceptions, level, loop and progress',()=>{
  let room=actRoom(roomWith(4),'a','vote',{vote:false},now);
  const snapshot=structuredClone(room.run);
  room=keep(room,'b',later);
  assert.deepEqual(room.run,snapshot);
});
test('host migration does not reuse an absent host vote or renumber live slots',()=>{
  let room=actRoom(roomWith(3),'a','vote',{vote:true},now);
  room.players[1].lastSeen=later-1;room.players[2].lastSeen=later-1;
  room=keep(room,'b',later);
  assert.equal(room.hostId,'b');assert.deepEqual(votes(room),[null,null,null]);
  assert.deepEqual(room.players.map(p=>p.slot),[0,1,2]);
});
test('active heartbeats preserve unfinished votes and do not score twice',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room=keep(room,'b',now+1);assert.deepEqual(votes(room),[true,null]);
  room=actRoom(room,'b','vote',{vote:true},now+2);assert.equal(room.run.streak,1);
  room=keep(room,'a',now+3);assert.equal(room.run.streak,1);
});
test('reconnection after reveal preserves the completed result',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room=actRoom(room,'b','vote',{vote:true},now);
  const result=structuredClone(room.run.lastResult);
  room=keep(room,'a',later);
  assert.equal(room.run.streak,1);assert.deepEqual(room.run.lastResult,result);
});
test('presence processing does not mutate the previous persisted room',()=>{
  const room=actRoom(roomWith(),'a','vote',{vote:true},now);
  const original=structuredClone(room);
  keep(room,'b',later);projectRoom(room,'b',later);
  assert.deepEqual(room,original);
});
test('read-only projection hides obsolete votes before a heartbeat persists cleanup',()=>{
  const room=actRoom(roomWith(),'a','vote',{vote:true},now);
  const projected=projectRoom(room,'b',later);
  assert.equal(projected.paused,true);
  assert.deepEqual(projected.players.map(p=>p.vote),[null,null]);
  assert.equal(room.players[0].vote,true);
});
test('a departed inspector cannot read the private projection',()=>{
  const room=actRoom(roomWith(),'b','leave',{},now);
  assert.throws(()=>projectRoom(room,'b',now),error=>error.status===401);
});
test('a stale stored reveal is hidden during inspection, reference and lobby',()=>{
  const room=roomWith();
  room.run.lastResult={correct:true,hasAnomaly:true,title:'secret',description:'secret',observerSlots:[1],anomalyId:'shadow_figure'};
  assert.equal(projectRoom(room,'a',now).reveal,null);
  room.run.phase='reference';assert.equal(projectRoom(room,'a',now).reveal,null);
  room.started=false;assert.equal(projectRoom(room,'a',now).reveal,null);
});
test('a legitimate result is still revealed after consensus',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room=actRoom(room,'b','vote',{vote:true},now);
  assert.equal(projectRoom(room,'a',now).reveal.anomalyId,'shadow_figure');
});
test('reconnection does not reveal another inspector effect or credentials',()=>{
  let room=actRoom(roomWith(),'a','vote',{vote:true},now);
  room=keep(room,'a',later);
  const serialized=JSON.stringify(projectRoom(room,'a',later));
  for(const secret of ['private-seed','secret-a','secret-b','tokenHash','currentAnomalyId','observerSlots','shadow_figure'])assert.ok(!serialized.includes(secret),secret);
});
test('valid queued radio offer is delivered only to its intended recipient',()=>{
  const room=withRadio();
  assert.equal(projectRoom(room,'a',now).radioInbox.length,0);
  assert.equal(projectRoom(room,'b',now).radioInbox.length,1);
});
test('obsolete sender and receiver epochs are never delivered',()=>{
  const a=withRadio();a.players[0].radioEpoch='radio_epoch_alpha_02';
  assert.deepEqual(projectRoom(a,'b',now).radioInbox,[]);
  const b=withRadio();b.players[1].radioEpoch='radio_epoch_bravo_02';
  assert.deepEqual(projectRoom(b,'b',now).radioInbox,[]);
});
test('disabled, departed or removed senders cannot retain queued radio messages',()=>{
  for(const mutation of [p=>p.radioEnabled=false,p=>p.left=true]){
    const room=withRadio();mutation(room.players[0]);
    assert.deepEqual(projectRoom(room,'b',now).radioInbox,[]);
  }
  const room=withRadio();room.players.shift();
  assert.deepEqual(projectRoom(room,'b',now).radioInbox,[]);
});
test('disabled receivers and empty epochs cannot receive an offer',()=>{
  const room=withRadio();room.players[1].radioEnabled=false;
  assert.deepEqual(projectRoom(room,'b',now).radioInbox,[]);
  room.players[1].radioEnabled=true;room.players[0].radioEpoch='';room.signals[0].fromEpoch='';
  assert.deepEqual(projectRoom(room,'b',now).radioInbox,[]);
});
test('radio queue rejects presence timeout even before its longer signal TTL expires',()=>{
  const room=withRadio();room.players[1].lastSeen=later;
  assert.ok(PRESENCE_TIMEOUT<SIGNAL_TTL);
  assert.equal(projectRoom(room,'b',later-1).radioInbox.length,1);
  assert.deepEqual(projectRoom(room,'b',later).radioInbox,[]);
});
test('future, expired and non-finite timestamps are excluded from the radio inbox',()=>{
  for(const at of [now+1,now-SIGNAL_TTL,NaN]){
    const room=withRadio();room.signals[0].at=at;
    assert.deepEqual(projectRoom(room,'b',now).radioInbox,[]);
  }
});
test('a heartbeat cannot revive an offer from a previous connection gap',()=>{
  let room=withRadio();room.players[1].lastSeen=later-1;
  room=keep(room,'a',later);
  assert.equal(room.signals.length,0);assert.deepEqual(projectRoom(room,'b',later).radioInbox,[]);
});
test('ordinary actions remove invalid queued signals from persistent storage',()=>{
  let room=withRadio();room.players[0].radioEpoch='radio_epoch_alpha_02';
  room=keep(room,'b',now+1);assert.equal(room.signals.length,0);
});
test('acknowledgements cannot delete another inspector inbox',()=>{
  let room=withRadio();const ids=room.signals.map(s=>s.id);
  room=actRoom(room,'a','signal-ack',{ids},now+1);assert.equal(room.signals.length,1);
  room=actRoom(room,'b','signal-ack',{ids},now+2);assert.equal(room.signals.length,0);
});
test('talking indicator requires an enabled live radio and a recent non-future transmission',()=>{
  const room=withRadio();const p=room.players[0];p.talking=true;p.radioTalkAt=now;
  assert.equal(projectRoom(room,'b',now).players[0].talking,true);
  p.radioEnabled=false;assert.equal(projectRoom(room,'b',now).players[0].talking,false);
  p.radioEnabled=true;p.radioTalkAt=now+1;assert.equal(projectRoom(room,'b',now).players[0].talking,false);
  p.radioTalkAt=now-10_000;assert.equal(projectRoom(room,'b',now).players[0].talking,false);
});
test('expired and future pings are removed even without a new object ping',()=>{
  let room=roomWith();
  room.pings=[{id:'old',name:'Alpha',target:'mirror',at:now-15_000},{id:'future',name:'Alpha',target:'mirror',at:now+1},{id:'valid',name:'Alpha',target:'mirror',at:now}];
  room=keep(room,'a',now);
  assert.deepEqual(room.pings.map(p=>p.id),['valid']);
});

test('returning expired host cannot preempt already-present inspectors',()=>{
  const room=roomWith(3);room.players[1].lastSeen=later-1;room.players[2].lastSeen=later-1;
  const resumed=keep(room,'a',later);
  assert.equal(resumed.hostId,'b');assert.equal(resumed.players[0].lastSeen,later);assert.equal(room.hostId,'a');
});
test('expired host cannot open a passage by refreshing itself within next',()=>{
  const room=roomWith(3);room.run.phase='reference';room.players[1].lastSeen=later-1;room.players[2].lastSeen=later-1;
  assert.throws(()=>actRoom(room,'a','next',{},later),error=>error.status===403);
});
test('current host is retained when a stale non-host returns',()=>{
  const room=roomWith(3);room.players[0].lastSeen=later-1;
  assert.equal(keep(room,'b',later).hostId,'a');
});
test('returning inspector becomes host when nobody was still present',()=>{
  const room=roomWith(3);assert.equal(keep(room,'c',later).hostId,'c');
});
test('host election uses the lowest already-live slot, not a returning lower slot',()=>{
  const room=roomWith(4);room.players[2].lastSeen=later-1;room.players[3].lastSeen=later-1;
  assert.equal(keep(room,'b',later).hostId,'c');
});
