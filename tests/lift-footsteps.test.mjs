import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import{stripTypeScriptTypes}from'node:module';
const dir=await mkdtemp(join(tmpdir(),'p9-lift-footsteps-'));
for(const name of ['footstep-state','temporal-state','acoustic-state','acoustic-pcm','levels','catalog','rules','session']){let s=stripTypeScriptTypes(await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8'),{mode:'transform'}).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");await writeFile(join(dir,name+'.mjs'),s);}
const {createFootstepState}=await import(pathToFileURL(join(dir,'footstep-state.mjs')));
const {createTemporalState}=await import(pathToFileURL(join(dir,'temporal-state.mjs')));
const {acousticPCM}=await import(pathToFileURL(join(dir,'acoustic-pcm.mjs')));
const {createRoom,joinRoom,makePlayer,actRoom,projectRoom,upgradeRoom}=await import(pathToFileURL(join(dir,'session.mjs')));
test.after(()=>rm(dir,{recursive:true,force:true}));
const view={levelId:'hotel',phase:'inspect',loop:1,contextKey:'test'};
const actors=[{id:'a',x:0,z:0},{id:'b',x:1,z:0}];
function foot(effects=['footsteps_unowned']){const s=createFootstepState();s.setView({...view,effects});s.update(0,actors);return s;}
function tick(s,seconds,fps=60){for(let i=0;i<Math.round(seconds*fps);i++)s.update(1/fps,actors);}
function lift(effects=[]){const s=createTemporalState();s.setView({...view,effects});s.update(0,true);s.activate('lift',{x:-2.4,z:-14});return s;}
function advance(s,seconds,fps=60,active=true){for(let i=0;i<Math.round(seconds*fps);i++)s.update(1/fps,active);}
for(const fps of [10,30,60,144])test(`residual steps start only after 3 s of the observed team standing still (${fps}fps)`,()=>{
 const a=foot(),b=foot([]);tick(a,2.9,fps);assert.equal(a.snapshot().residualCount,0);tick(a,.15,fps);assert.equal(a.snapshot().residualCount,1);assert.equal(a.snapshot().voices[0]?.kind,'footstep');tick(b,7,fps);assert.equal(b.snapshot().residualCount,0);assert.equal(b.snapshot().voices.length,0);
});
test('normal movement produces real steps but cannot contribute to residual counter',()=>{
 const s=foot([]);s.update(.1,[{...actors[0],x:.69},actors[1]]);assert.equal(s.snapshot().voices.length,1);assert.equal(s.snapshot().voices[0].position[0],.69);assert.equal(s.snapshot().residualCount,0);
 s.update(.25,[{...actors[0],x:.69},actors[1]]);s.update(.1,[{...actors[0],x:.69},actors[1]]);assert.equal(s.snapshot().voices.length,0);
});
test('one moving teammate resets the full stillness window; no self-step is counted as evidence',()=>{
 const s=foot();tick(s,4);assert.ok(s.snapshot().residualCount>0);s.update(.1,[actors[0],{...actors[1],z:.02}]);assert.equal(s.snapshot().quietSeconds,0);assert.equal(s.snapshot().residualCount,0);
});
test('lost snapshots and disconnected players are technical interruptions, never anomaly evidence',()=>{
 const s=foot();tick(s,5);s.update(.1,actors,true,false);assert.equal(s.snapshot().voices.length,0);assert.match(s.snapshot().caption,/synchronisées/);s.update(.1,actors);assert.equal(s.snapshot().residualCount,0);
 s.update(.1,[actors[0],{...actors[1],connected:false}]);assert.equal(s.snapshot().voices.length,0);assert.equal(s.snapshot().residualCount,0);
});
test('pause, invalid actors and roster replacement cannot keep a ghost sequence alive',()=>{
 const s=foot();tick(s,4);s.update(.1,actors,false);assert.equal(s.snapshot().voices.length,0);s.update(.1,actors);assert.equal(s.snapshot().quietSeconds,0);
 for(const list of [[],[{id:'bad',x:NaN,z:0}],[actors[0],actors[0]]]){s.update(.1,list);assert.equal(s.snapshot().voices.length,0);}
 s.update(.1,[{...actors[0],id:'new'}]);assert.equal(s.snapshot().residualCount,0);
});
test('solo A/B preserves the instant; reference, room replacement and other levels clear residual evidence',()=>{
 const s=foot();tick(s,5);const count=s.snapshot().residualCount;s.setView({...view,effects:[]});assert.equal(s.snapshot().voices.length,0);s.setView({...view,effects:['footsteps_unowned']});assert.equal(s.snapshot().residualCount,count);
 for(const extra of [{phase:'reference'},{contextKey:'other'},{levelId:'metro'}]){s.setView({...view,...extra,effects:['footsteps_unowned']});s.update(0,actors);assert.equal(s.snapshot().residualCount,0);}
});
test('lift has exactly one normal chime or nine private chimes, without moving the cabin',()=>{
 const a=lift(['elevator_count']),b=lift();let heardA=new Set(),heardB=new Set();
 for(let i=0;i<14*60;i++){for(const [s,heard]of [[a,heardA],[b,heardB]]){s.update(1/60,true);s.snapshot().voices.filter(v=>v.kind==='lift-chime').forEach(v=>heard.add(v.id));}assert.equal(a.snapshot().liftOpening,b.snapshot().liftOpening);}
 assert.equal(heardA.size,9);assert.equal(heardB.size,1);assert.equal(a.snapshot().liftCount,9);assert.equal(b.snapshot().liftCount,1);assert.match(a.snapshot().caption,/09 fixe/);
});
test('passenger remains longer than 10 seconds and a second witness sees the same empty cabin',()=>{
 const a=lift(['visitor_one_frame']),b=lift();advance(a,1.5);assert.equal(a.snapshot().liftVisitor,false);advance(a,1);assert.equal(a.snapshot().liftVisitor,true);
 for(let i=0;i<11*60;i++){a.update(1/60,true);b.update(1/60,true);assert.equal(a.snapshot().liftVisitor,true);assert.equal(b.snapshot().liftVisitor,false);}
 assert.equal(a.snapshot().liftVisitorProgress,1);assert.equal(a.activate('lift',{x:-2.4,z:-14}),false);
});
test('remote lift late arrival reads current doors and count without replaying expired chimes',()=>{
 const s=createTemporalState();s.setView({...view,effects:['elevator_count','visitor_one_frame']});const event={id:'lift-1',target:'lift',at:1650,sequence:1,actorId:'a',x:-2.4,z:-14};
 s.sync([event],13000);s.update(0,true);assert.equal(s.snapshot().liftCount,9);assert.equal(s.snapshot().voices.length,0);assert.equal(s.snapshot().liftOpening,1);assert.equal(s.snapshot().liftVisitor,true);
 s.sync([event],2000);assert.equal(s.snapshot().voices.length,0);
});
test('lift resets between rooms and passages, remains empty in reference, and cannot be replay-spammed',()=>{
 const s=lift(['visitor_one_frame','elevator_count']);advance(s,4);assert.equal(s.snapshot().liftVisitor,true);s.setView({...view,effects:[]});assert.equal(s.snapshot().liftVisitor,false);assert.equal(s.snapshot().liftCount,1);
 s.setView({...view,phase:'reference',effects:['visitor_one_frame','elevator_count']});s.update(0,true);s.activate('lift',{x:0,z:0});advance(s,4);assert.equal(s.snapshot().liftVisitor,false);assert.equal(s.snapshot().liftCount,1);
 s.setView({...view,levelId:'cabin'});s.update(1,true);assert.equal(s.snapshot().voices.length,0);assert.equal(s.activate('lift',{x:0,z:0}),false);
});
test('fifth whitelisted prop survives storage upgrade without dropping the four existing gestures',()=>{
 let r=createRoom('ABCDEF',makePlayer('a','Alpha','secret-a',0,1000),'standard','lift',1000,{mode:'single',levelId:'hotel'});r=joinRoom(r,makePlayer('b','Beta','secret-b',1,1000));r.started=true;r.run={...r.run,phase:'inspect',loop:1,currentAnomalyId:'elevator_count',observerSlots:[0]};
 r.propEvents=['bell','vase','witness-door','listening-mannequin'].map((target,i)=>({id:`prior${i}`,target,at:1000,sequence:1,actorId:'a',x:0,z:0}));r.players[0].pose={x:-2.4,y:1.67,z:-14,yaw:0,pitch:0};
 const request={target:'lift',requestId:'lift-call-000001',expectedSequence:0,decisionEpoch:r.decisionEpoch};r=actRoom(r,'a','prop',request,1200);assert.equal(r.propEvents.length,5);const saved=upgradeRoom(r);assert.equal(saved.propEvents.length,5);
 assert.deepEqual(projectRoom(saved,'a',1300).propEvents,projectRoom(saved,'b',1300).propEvents);const copy=actRoom(saved,'a','prop',request,1400);assert.deepEqual(copy.propEvents,saved.propEvents);
 const s=createTemporalState();s.setView(view);s.sync(saved.propEvents,1300);assert.equal(s.snapshot().events.length,5);
});
for(const kind of ['footstep','lift-chime'])test(`${kind} is original bounded deterministic PCM with a silent tail`,()=>{
 const a=acousticPCM(kind,8000),b=acousticPCM(kind,8000);assert.deepEqual(a,b);assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.45));assert.ok(a.reduce((sum,v)=>sum+v*v,0)>1);assert.ok(Math.abs(a.at(-1))<.002);
});

test('slow motion must not become false stillness at a high refresh rate',()=>{const s=foot();for(let i=0;i<5*144;i++)s.update(1/144,[{...actors[0],x:i*.0001},actors[1]]);assert.equal(s.snapshot().residualCount,0);});

test('a second call closes the open doors progressively, not before the scheduled intent',()=>{const s=lift(['visitor_one_frame']);advance(s,15);assert.equal(s.snapshot().liftOpening,1);const e={id:'lift-2',target:'lift',at:20650,sequence:2,actorId:'a',x:-2.4,z:-14};s.sync([e],20000);assert.equal(s.snapshot().liftOpening,1);s.sync([e],20800);s.update(0,true);assert.ok(s.snapshot().liftOpening>0&&s.snapshot().liftOpening<1);s.sync([e],21200);s.update(0,true);assert.equal(s.snapshot().liftOpening,0);});
