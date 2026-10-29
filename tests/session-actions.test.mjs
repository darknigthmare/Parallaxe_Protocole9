import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

// Execute the real shared domain; no mocked scoring, network or graphics APIs.
const temp=await mkdtemp(join(tmpdir(),'parallaxe-actions-'));
try{
  for(const name of ['levels','catalog','rules','session']){
    const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
    const output=stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
    await writeFile(join(temp,`${name}.mjs`),output);
  }
}catch(error){await rm(temp,{recursive:true,force:true});throw error;}
test.after(()=>rm(temp,{recursive:true,force:true}));
const {createRoom,joinRoom,makePlayer,actRoom,projectRoom,upgradeRoom,PRESENCE_TIMEOUT}=await import(pathToFileURL(join(temp,'session.mjs')));
const now=1_000;

function lobby(count=2){
  let room=createRoom('ABCDEF',makePlayer('a','Alpha','secret-a',0,now),'standard','private-seed',now);
  for(let slot=1;slot<count;slot++){
    const id=String.fromCharCode(97+slot);
    room=joinRoom(room,makePlayer(id,`Inspecteur ${id}`,`secret-${id}`,slot,now));
  }
  return room;
}
function context(room,extra={}){return {decisionEpoch:room.decisionEpoch,...extra};}
// Only a fresh deliberate action uses this helper. Delayed requests below keep
// the original captured payload and call actRoom directly, without a new epoch.
function fresh(room,id,action,extra={},at=now){
  let rejected;
  const next=actRoom(room,id,action,context(room,extra),at,value=>{rejected=value;});
  assert.equal(rejected,undefined,`fresh ${action} was rejected`);
  return next;
}
function inspecting(count=2){
  let room=fresh(lobby(count),'a','start');
  return fresh(room,'a','next');
}
function finish(room,correct=true){
  const vote=correct?!!room.run.currentAnomalyId:!room.run.currentAnomalyId;
  const payload=context(room,{vote});
  for(const player of room.players.filter(p=>!p.left))room=actRoom(room,player.id,'vote',payload,now);
  return room;
}
function votes(room){return room.players.filter(p=>!p.left).map(p=>p.vote);}
function applyRejected(room,id,action,payload,at=now,code='STALE_DECISION_CONTEXT'){
  const before=structuredClone(room);
  let rejection;
  const next=actRoom(room,id,action,payload,at,value=>{rejection=value;});
  assert.deepEqual(room,before,'the persisted input room must not be mutated');
  assert.equal(rejection?.code,code);
  assert.equal(typeof rejection?.message,'string');
  return next;
}

test('a delayed vote from the previous passage cannot vote in the next inspection',()=>{
  let room=inspecting();
  const delayed=context(room,{vote:false});
  const originalLoop=room.run.loop;
  room=finish(room);room=fresh(room,'a','next');
  assert.equal(room.run.loop,originalLoop+1);
  const before=structuredClone(room.run);
  room=applyRejected(room,'a','vote',delayed);
  assert.deepEqual(votes(room),[null,null]);assert.deepEqual(room.run,before);
});
test('a duplicate next at a sector boundary cannot skip the new location reference',()=>{
  let room=inspecting();
  for(let i=0;i<3;i++){room=finish(room);if(i<2)room=fresh(room,'a','next');}
  assert.equal(room.run.pendingLevel,true);
  const delayed=context(room);
  room=fresh(room,'a','next');
  assert.equal(room.run.levelId,'metro');assert.equal(room.run.phase,'reference');
  const before=structuredClone(room.run);
  room=applyRejected(room,'a','next',delayed);
  assert.deepEqual(room.run,before);
});
test('duplicate ordinary next opens only one passage and reports resynchronization',()=>{
  let room=fresh(lobby(),'a','start');
  const delayed=context(room);
  room=fresh(room,'a','next');const before=structuredClone(room.run);
  room=applyRejected(room,'a','next',delayed);
  assert.deepEqual(room.run,before);assert.equal(room.run.loop,1);
});
test('four decisions captured in one context reach consensus once despite other traffic',()=>{
  let room=inspecting(4);
  const vote=!!room.run.currentAnomalyId;
  const payloads=room.players.map(()=>context(room,{vote}));
  const epoch=room.decisionEpoch;
  for(let slot=0;slot<4;slot++){
    const id=room.players[slot].id;
    room=actRoom(room,id,'ping',{},now+slot);
    room=actRoom(room,id,'pose',{pose:room.players[slot].pose},now+slot);
    let rejected;
    room=actRoom(room,id,'vote',payloads[slot],now+slot,value=>{rejected=value;});
    assert.equal(rejected,undefined);
    if(slot<3){assert.equal(room.decisionEpoch,epoch);assert.equal(room.run.phase,'inspect');}
  }
  assert.equal(room.run.correctTotal,1);assert.equal(room.run.phase,'reveal');
  assert.ok(room.decisionEpoch>epoch);
  room=applyRejected(room,'d','vote',payloads[3],now+5);
  assert.equal(room.run.correctTotal,1);
});
test('changing a vote within the current inspection remains allowed until unanimity',()=>{
  let room=inspecting();
  const epoch=room.decisionEpoch;
  room=fresh(room,'a','vote',{vote:false});room=fresh(room,'b','vote',{vote:true});
  assert.equal(room.decisionEpoch,epoch);assert.equal(room.run.phase,'inspect');
  room=fresh(room,'a','vote',{vote:true});
  assert.equal(room.run.phase,'reveal');assert.ok(room.decisionEpoch>epoch);
});
test('an interruption with no recorded votes invalidates a delayed returning vote',()=>{
  let room=inspecting();
  const delayed=context(room,{vote:true});
  const epoch=room.decisionEpoch;
  const later=now+PRESENCE_TIMEOUT;
  room.players[1].lastSeen=later-1;
  room=applyRejected(room,'a','vote',delayed,later);
  assert.deepEqual(votes(room),[null,null]);assert.ok(room.decisionEpoch>epoch);
  assert.equal(room.players[0].lastSeen,later,'the reconnecting heartbeat must persist');
  assert.equal(room.messages.filter(m=>m.senderId==='control').length,1);
  assert.equal(room.decisionPaused,false,'all witnesses are now back');
  room=fresh(room,'a','vote',{vote:true},later+1);
  assert.deepEqual(votes(room),[true,null]);
});
test('invalidating an interrupted ballot survives a rejected request and prunes stale signaling',()=>{
  let room=inspecting();room=fresh(room,'a','vote',{vote:true});
  const delayed=context(room,{vote:true});
  const later=now+PRESENCE_TIMEOUT;
  room.players[1].lastSeen=later-1;
  room.pings=[{id:'old',name:'Alpha',target:'mirror',at:now}];
  room.signals=[{id:'old',from:'a',to:'b',fromEpoch:'old',toEpoch:'old',at:now}];
  room=applyRejected(room,'a','vote',delayed,later);
  assert.deepEqual(votes(room),[null,null]);assert.equal(room.run.phase,'inspect');
  assert.deepEqual(room.pings,[]);assert.deepEqual(room.signals,[]);
  const restored=upgradeRoom(JSON.parse(JSON.stringify(room)));
  assert.equal(restored.decisionEpoch,room.decisionEpoch);
  assert.deepEqual(votes(restored),[null,null]);
});
test('one gap invalidates once even without votes; a later gap gets a new context',()=>{
  let room=inspecting();const initial=room.decisionEpoch;
  const later=now+PRESENCE_TIMEOUT;
  room=actRoom(room,'a','ping',{},later);
  const pausedEpoch=room.decisionEpoch;
  assert.ok(pausedEpoch>initial);assert.equal(room.decisionPaused,true);
  room=actRoom(room,'a','ping',{},later+1);
  assert.equal(room.decisionEpoch,pausedEpoch);
  assert.equal(room.messages.filter(m=>m.senderId==='control').length,1);
  room=actRoom(room,'b','ping',{},later+2);
  assert.equal(room.decisionEpoch,pausedEpoch);assert.equal(room.decisionPaused,false);
  room=actRoom(room,'a','ping',{},later+PRESENCE_TIMEOUT+2);
  assert.ok(room.decisionEpoch>pausedEpoch);
});
test('a vote one millisecond before the presence deadline remains valid',()=>{
  let room=inspecting();const epoch=room.decisionEpoch;
  room=fresh(room,'a','vote',{vote:true},now+PRESENCE_TIMEOUT-1);
  assert.equal(room.decisionEpoch,epoch);assert.deepEqual(votes(room),[true,null]);
});
test('explicit departure invalidates captured decisions before witness reassignment',()=>{
  let room=inspecting(3);
  room.run.currentAnomalyId='shadow_figure';room.run.observerSlots=[2];
  const delayed=context(room,{vote:true});const epoch=room.decisionEpoch;
  room=actRoom(room,'c','leave',{},now+1);
  assert.ok(room.decisionEpoch>epoch);assert.deepEqual(room.run.observerSlots,[0]);
  room=applyRejected(room,'a','vote',delayed,now+2);
  assert.deepEqual(votes(room),[null,null]);
});
test('restart protects the same loop number from a previous run and duplicate starts',()=>{
  let room=inspecting();const delayedVote=context(room,{vote:true});
  const oldLoop=room.run.loop;
  for(let i=0;i<3;i++){room=finish(room,false);if(i<2)room=fresh(room,'a','next');}
  assert.equal(room.run.phase,'lost');
  const delayedStart=context(room);
  room=fresh(room,'a','start');room=fresh(room,'a','next');
  assert.equal(room.run.loop,oldLoop);
  room=applyRejected(room,'a','vote',delayedVote);
  assert.deepEqual(votes(room),[null,null]);
  room=applyRejected(room,'a','start',delayedStart);
  assert.equal(room.run.phase,'inspect');assert.equal(room.run.loop,oldLoop);
});
test('missing and malformed decision contexts never apply start, next or vote',()=>{
  const values=[undefined,null,-1,1.5,NaN,Infinity,'0',true,{},[],Number.MAX_SAFE_INTEGER+1];
  for(const action of ['start','next','vote'])for(const value of values){
    let room=action==='start'?lobby():action==='next'?fresh(lobby(),'a','start'):inspecting();
    const before=structuredClone(room.run);const wasStarted=room.started;
    room=applyRejected(room,'a',action,{decisionEpoch:value,vote:true},now,'INVALID_DECISION_CONTEXT');
    assert.deepEqual(room.run,before);assert.equal(room.started,wasStarted);
    assert.ok(votes(room).every(v=>v===null));
  }
});
test('a future decision context is rejected without triggering latent consensus',()=>{
  let room=inspecting();
  room.players.forEach(p=>{p.vote=true;});
  const before=structuredClone(room.run);
  room=applyRejected(room,'a','next',{decisionEpoch:(room.decisionEpoch??0)+1});
  assert.deepEqual(room.run,before);assert.equal(room.run.phase,'inspect');
});
test('legacy and malformed stored contexts migrate deterministically without mutating their input',()=>{
  const original=inspecting();
  for(const value of [undefined,null,-1,1.5,NaN,Infinity,'7',true,Number.MAX_SAFE_INTEGER+1]){
    const saved=structuredClone(original);saved.decisionEpoch=value;delete saved.decisionPaused;
    const before=structuredClone(saved);
    const first=upgradeRoom(saved),second=upgradeRoom(saved);
    assert.equal(first.decisionEpoch,0);assert.equal(first.decisionPaused,false);
    assert.deepEqual(first,second);assert.deepEqual(saved,before);
    assert.equal(projectRoom(saved,'a',now).decisionEpoch,0);
  }
});
test('read-only projection exposes only the public context and stays stable between polls',()=>{
  const room=inspecting();const before=structuredClone(room);
  const first=projectRoom(room,'a',now),second=projectRoom(room,'a',now+1);
  assert.ok(Number.isSafeInteger(first.decisionEpoch));
  assert.equal(first.decisionEpoch,second.decisionEpoch);assert.deepEqual(room,before);
  assert.equal('decisionPaused' in first,false);
  const json=JSON.stringify(first);
  for(const secret of ['private-seed','secret-a','secret-b','tokenHash','currentAnomalyId','observerSlots'])assert.ok(!json.includes(secret),secret);
});
test('accepted and rejected decisions leave the previous room object unchanged',()=>{
  const room=inspecting();const before=structuredClone(room);
  const next=fresh(room,'a','vote',{vote:true});
  assert.deepEqual(room,before);assert.notEqual(next,room);assert.equal(next.players[0].vote,true);
  applyRejected(room,'a','vote',{},now,'INVALID_DECISION_CONTEXT');
  assert.deepEqual(room,before);
});
