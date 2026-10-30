import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

// Compile the actual dependency-free domain modules, then test their public API.
const temp=await mkdtemp(join(tmpdir(),'parallaxe-domain-'));
for(const name of ['levels','catalog','rules','session']){
  const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
  const output=stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
  await writeFile(join(temp,`${name}.mjs`),output);
}
const {SELECTABLE_LEVELS}=await import(pathToFileURL(join(temp,'levels.mjs')));
const {ANOMALIES}=await import(pathToFileURL(join(temp,'catalog.mjs')));
const {createRun,advanceRun,evaluateRun,getPersonalView,migrateRun}=await import(pathToFileURL(join(temp,'rules.mjs')));
const {createRoom,joinRoom,actRoom:applyRoom,projectRoom,makePlayer,authenticate,cleanPose,PRESENCE_TIMEOUT}=await import(pathToFileURL(join(temp,'session.mjs')));
test.after(async()=>{await rm(temp,{recursive:true,force:true});});

// Ordinary rule scenarios issue a fresh decision from the latest displayed room.
// Captured/replayed decisions are exercised without this helper in session-actions.
function actRoom(room,id,action,payload,at){
  return applyRoom(room,id,action,['start','next','vote'].includes(action)?{decisionEpoch:room.decisionEpoch,...payload}:payload,at);
}

function roomWithTwo(){
  let room=createRoom('ABCDEF',makePlayer('a','Alpha','secret-a',0,1000),'standard','test-seed',1000);
  room=joinRoom(room,makePlayer('b','Bravo','secret-b',1,1000));
  return room;
}

test('96 unique catalog entries have valid location scopes and include relational clues',()=>{
  assert.equal(ANOMALIES.length,96);
  assert.equal(new Set(ANOMALIES.map(a=>a.id)).size,96);
  assert.ok(ANOMALIES.find(a=>a.id==='relay_mismatch'));
  assert.ok(ANOMALIES.every(a=>a.title&&a.baseline&&a.description&&a.cooperation&&a.levels.length>0));
});
test('reference is clean, identical and not scored',()=>{
  const run=createRun({seed:'baseline',players:4});
  assert.equal(run.phase,'reference');
  assert.equal(run.loop,0);
  for(let slot=0;slot<4;slot++){assert.deepEqual(getPersonalView(run,slot).effects,[]);assert.equal(getPersonalView(run,slot).relayCode,'3142');}
  assert.deepEqual(evaluateRun(run,false),run);
});
test('seeded cases are deterministic with both clean and anomalous passages',()=>{
  let a=createRun({seed:'same',mode:'single'}),b=createRun({seed:'same',mode:'single'});
  let anomalies=0,normal=0;
  for(let i=0;i<8;i++){
    a=advanceRun(a);b=advanceRun(b);assert.deepEqual(a,b);
    if(a.currentAnomalyId)anomalies++;else normal++;
    a=evaluateRun(a,!!a.currentAnomalyId);b=evaluateRun(b,!!b.currentAnomalyId);
  }
  assert.ok(anomalies>0);assert.ok(normal>0);
});
test('every anomaly has a witness and a baseline observer for 2–4 players',()=>{
  const seen=new Set();
  for(const levelId of SELECTABLE_LEVELS)for(const players of [2,3,4])for(let seed=0;seed<900;seed++){
    const run=advanceRun(createRun({seed:`coverage-${seed}`,players,mode:'single',levelId}));
    if(!run.currentAnomalyId)continue;
    seen.add(run.currentAnomalyId);
    assert.ok(ANOMALIES.find(a=>a.id===run.currentAnomalyId).levels.includes(levelId));
    assert.ok(run.observerSlots.length>=1&&run.observerSlots.length<players);
    assert.equal(new Set(run.observerSlots).size,run.observerSlots.length);
    if(['relay_mismatch','paired_arrow','paired_clock'].includes(run.currentAnomalyId)){
      const key={relay_mismatch:'relayCode',paired_arrow:'arrowDirection',paired_clock:'syncTime'}[run.currentAnomalyId];
      const codes=Array.from({length:players},(_,s)=>getPersonalView(run,s)[key]);
      assert.equal(new Set(codes).size,2);
      assert.ok(Array.from({length:players},(_,s)=>getPersonalView(run,s).effects.length===0).every(Boolean));
    }else{
      assert.ok(Array.from({length:players},(_,s)=>getPersonalView(run,s).effects).some(e=>e.length===0));
    }
  }
  assert.equal(seen.size,96);
});
test('nine correct consecutive decisions win; repeated calls cannot double-score',()=>{
  let run=createRun({seed:'winning',mode:'single'});
  for(let i=0;i<9;i++){
    run=advanceRun(run);run=evaluateRun(run,!!run.currentAnomalyId);
    const again=evaluateRun(run,!!run.currentAnomalyId);assert.deepEqual(again,run);
  }
  assert.equal(run.phase,'won');assert.equal(run.streak,9);
  assert.equal(advanceRun(run),run);
});
test('campaign changes location only after a clean reference between groups of three correct diagnoses',()=>{
  let run=createRun({seed:'campaign',mode:'campaign'});
  assert.equal(run.levelId,'hotel');assert.equal(run.phase,'reference');
  for(let i=1;i<=9;i++){
    run=advanceRun(run);
    assert.equal(run.phase,'inspect');
    run=evaluateRun(run,!!run.currentAnomalyId);
    assert.equal(run.streak,i);
    if(i===3||i===6){
      assert.equal(run.pendingLevel,true);
      run=advanceRun(run);assert.equal(run.phase,'reference');assert.deepEqual(getPersonalView(run,0).effects,[]);
      assert.equal(run.levelId,i===3?'metro':'clinic');assert.equal(run.stageProgress,0);
    }
  }
  assert.equal(run.phase,'won');assert.equal(run.levelId,'clinic');
});
test('campaign mistakes keep completed location checkpoints and never silently change the current level',()=>{
  let run=createRun({seed:'checkpoint',mode:'campaign'});
  for(let i=0;i<3;i++){run=advanceRun(run);run=evaluateRun(run,!!run.currentAnomalyId);}
  run=advanceRun(run);run=advanceRun(run);run=evaluateRun(run,!!run.currentAnomalyId);
  assert.equal(run.streak,4);run=advanceRun(run);run=evaluateRun(run,!run.currentAnomalyId);
  assert.equal(run.streak,3);assert.equal(run.levelId,'metro');assert.equal(run.stageProgress,0);
});
test('v0.1 saves migrate to single hotel without losing progression, malformed saves are rejected',()=>{
  const old={seed:'v1',difficulty:'standard',players:2,phase:'inspect',loop:4,streak:3,strikes:1,correctTotal:3,currentAnomalyId:'plant_dead',observerSlots:[1],lastResult:null,history:['plant_dead']};
  const migrated=migrateRun(old);assert.equal(migrated.schemaVersion,2);assert.equal(migrated.mode,'single');assert.equal(migrated.levelId,'hotel');assert.equal(migrated.streak,3);assert.deepEqual(getPersonalView(migrated,1).effects,['plant_dead']);
  assert.equal(migrateRun({phase:'invented',seed:1}),null);assert.equal(migrateRun(null),null);
});
test('optional chalet runs preserve save and room identity without extending the campaign',()=>{
  let run=createRun({seed:'cabin-save',mode:'single',levelId:'cabin',players:4});
  assert.equal(run.levelId,'cabin');
  assert.deepEqual(migrateRun(run),run);
  for(let i=0;i<9;i++){
    run=advanceRun(run);
    assert.equal(run.levelId,'cabin');
    assert.equal(run.phase,'inspect');
    run=evaluateRun(run,!!run.currentAnomalyId);
    assert.deepEqual(migrateRun(run),run);
  }
  assert.equal(run.phase,'won');
  assert.equal(createRun({seed:'campaign',mode:'campaign',levelId:'cabin'}).levelId,'hotel');
  let room=createRoom('CHALTT',makePlayer('a','Alpha','secret-a',0,1000),'standard','chalet-room',1000,{mode:'single',levelId:'cabin'});
  room=joinRoom(room,makePlayer('b','Bravo','secret-b',1,1000));
  room=actRoom(room,'a','start',{},1100);
  const publicRoom=projectRoom(room,'b',1100);
  assert.equal(publicRoom.levelId,'cabin');
  assert.equal(publicRoom.view.levelId,'cabin');
  assert.equal(publicRoom.mode,'single');
});
test('a wrong diagnosis resets the streak and third standard error ends the run',()=>{
  let run=advanceRun(createRun({seed:'losing'}));
  run=evaluateRun(run,!!run.currentAnomalyId);assert.equal(run.streak,1);
  for(let i=0;i<3;i++){run=advanceRun(run);run=evaluateRun(run,!run.currentAnomalyId);}
  assert.equal(run.streak,0);assert.equal(run.strikes,3);assert.equal(run.phase,'lost');
});
test('relaxed runs remain playable beyond three mistakes',()=>{
  let run=createRun({seed:'relaxed',difficulty:'relaxed'});
  for(let i=0;i<7;i++){run=advanceRun(run);run=evaluateRun(run,!run.currentAnomalyId);}
  assert.equal(run.phase,'reveal');assert.equal(run.strikes,7);
});
test('private projection never sends the seed, answer, hashes or another observer’s effects before reveal',()=>{
  let room=actRoom(roomWithTwo(),'a','start',{},1100);
  room=actRoom(room,'a','next',{},1200);
  room.run.currentAnomalyId='shadow_figure';room.run.observerSlots=[1];
  const state=projectRoom(room,'a',1200);
  const json=JSON.stringify(state);
  assert.equal(state.reveal,null);assert.deepEqual(state.view.effects,[]);
  for(const secret of ['test-seed','secret-a','secret-b','currentAnomalyId','observerSlots','shadow_figure','tokenHash'])assert.ok(!json.includes(secret),secret);
  assert.deepEqual(projectRoom(room,'b',1200).view.effects,['shadow_figure']);
});
test('inspection pings identify a prop without publishing its private reading or changing the verdict',()=>{
  let room=actRoom(roomWithTwo(),'a','start',{},1100);
  room=actRoom(room,'a','next',{},1200);
  room.run.currentAnomalyId='paired_stamp';room.run.observerSlots=[1];
  const before=structuredClone(room.run);
  const targets=['assignment','luggage','document','newspaper','hourglass','cup','keys','iv','guestbook','glove','weather-photo','team-photo','floor-map','regulations','occupancy','table','fireplace'];
  for(const [index,target] of targets.entries()){
    room=actRoom(room,'b','ping',{target,reading:'private-value-must-not-be-forwarded'},1300+index);
    const state=projectRoom(room,'a',1400+index);
    assert.equal(state.pings.at(-1).target,target);
    assert.ok(!JSON.stringify(state).includes('private-value-must-not-be-forwarded'));
    assert.deepEqual(state.view.effects,[]);
    assert.equal(state.reveal,null);
  }
  assert.deepEqual(room.run,before);
  assert.throws(()=>actRoom(room,'b','ping',{target:'invented-private-object'},1500),/Repère inconnu/);
});
test('team disagreements do not resolve; changing a vote to unanimity resolves exactly once',()=>{
  let room=actRoom(roomWithTwo(),'a','start',{},1100);
  room=actRoom(room,'a','next',{},1200);
  room.run.currentAnomalyId='shadow_figure';room.run.observerSlots=[1];
  room=actRoom(room,'a','vote',{vote:false},1300);
  room=actRoom(room,'b','vote',{vote:true},1400);
  assert.equal(room.run.phase,'inspect');
  room=actRoom(room,'a','vote',{vote:true},1500);
  assert.equal(room.run.phase,'reveal');assert.equal(room.run.streak,1);
  room=actRoom(room,'b','vote',{vote:true},1600);
  assert.equal(room.run.streak,1);
  const reveal=projectRoom(room,'a',1700).reveal;
  assert.equal(reveal.anomalyId,'shadow_figure');assert.deepEqual(reveal.observerNames,['Bravo']);
});
test('authorization, maximum capacity and host-only actions are enforced',()=>{
  let room=roomWithTwo();
  assert.throws(()=>authenticate(room,'wrong'),/accès/);
  assert.throws(()=>actRoom(room,'b','start',{},1200),/chef/);
  room=joinRoom(room,makePlayer('c','Charlie','secret-c',2,1000));
  room=joinRoom(room,makePlayer('d','Delta','secret-d',3,1000));
  assert.throws(()=>joinRoom(room,makePlayer('e','Echo','secret-e',4,1000)),/quatre/);
  assert.equal(room.players.length,4);
});
test('disconnect pauses a two-player verdict and host command migrates on leave',()=>{
  let room=actRoom(roomWithTwo(),'a','start',{},1100);
  room=actRoom(room,'a','next',{},1200);
  room=actRoom(room,'a','vote',{vote:true},1200+PRESENCE_TIMEOUT);
  assert.equal(room.run.phase,'inspect');
  room=actRoom(room,'b','ping',{},1300+PRESENCE_TIMEOUT);
  room=actRoom(room,'a','leave',{},1400+PRESENCE_TIMEOUT);
  assert.equal(room.hostId,'b');
  assert.throws(()=>authenticate(room,'secret-a'),/accès/);
});
test('poses reject non-finite values and clamp transmitted positions to the room',()=>{
  assert.throws(()=>cleanPose({x:NaN,y:1,z:2,yaw:0,pitch:0}),/Position/);
  assert.deepEqual(cleanPose({x:100,y:-3,z:-40,yaw:0,pitch:10}),{x:3.8,y:0,z:-16,yaw:0,pitch:1.5});
});
test('a disconnected sole witness pauses a three-person diagnosis',()=>{
  let room=joinRoom(roomWithTwo(),makePlayer('c','Charlie','secret-c',2,1000));
  room=actRoom(room,'a','start',{},1100);room=actRoom(room,'a','next',{},1200);
  room.run.currentAnomalyId='window_watcher';room.run.observerSlots=[2];
  room=actRoom(room,'a','vote',{vote:false},1200+PRESENCE_TIMEOUT);
  room=actRoom(room,'b','vote',{vote:false},1300+PRESENCE_TIMEOUT);
  assert.equal(room.run.phase,'inspect');assert.equal(room.run.strikes,0);
  assert.equal(projectRoom(room,'a',1300+PRESENCE_TIMEOUT).paused,true);
});
test('explicit departure clears stale votes and preserves an inspectable anomaly in later rounds',()=>{
  let room=joinRoom(roomWithTwo(),makePlayer('c','Charlie','secret-c',2,1000));
  room=actRoom(room,'a','start',{},1100);room=actRoom(room,'a','next',{},1200);
  room.run.currentAnomalyId='shadow_figure';room.run.observerSlots=[1];
  room=actRoom(room,'a','vote',{vote:false},1300);
  room=actRoom(room,'b','leave',{},1400);
  assert.ok(room.run.observerSlots.every(slot=>[0,2].includes(slot)));
  assert.ok(room.players.filter(p=>!p.left).every(p=>p.vote===null));
  room=actRoom(room,'a','vote',{vote:true},1500);room=actRoom(room,'c','vote',{vote:true},1600);
  assert.equal(room.run.streak,1);
  room=actRoom(room,'a','next',{},1700);
  assert.ok(room.run.observerSlots.every(slot=>[0,2].includes(slot)));
});
