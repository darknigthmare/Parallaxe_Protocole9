import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
const dir=await mkdtemp(join(tmpdir(),'p9-spoken-'));
for(const name of ['levels','catalog','rules','session','spoken-bank','spoken-pcm','spoken-timing','spoken-state','acoustic-state','acoustic-pcm','temporal-state']){
 const s=stripTypeScriptTypes(await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8'),{mode:'transform'}).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");await writeFile(join(dir,name+'.mjs'),s);
}
const load=name=>import(pathToFileURL(join(dir,name+'.mjs')));
const {createSpokenState,SPOKEN_ANCHORS,canSpellName}=await load('spoken-state');
const {SPOKEN_DURATIONS,FUTURE_SENTENCE}=await load('spoken-timing');
const {SPOKEN_BANK}=await load('spoken-bank');
const {spokenPCM}=await load('spoken-pcm');
const {createRun,advanceRun,getPersonalView}=await load('rules');
const {createRoom,makePlayer,joinRoom,actRoom,projectRoom}=await load('session');
const {createTemporalState,PROP_TARGETS}=await load('temporal-state');
test.after(()=>rm(dir,{recursive:true,force:true}));
const far={x:0,z:9},near={x:2.2,z:-3.1};
const event={id:'a:receiver-test-001',target:'service-radio',at:0,sequence:1,actorId:'a',x:-2,z:7.35};
function state(effects=[],allowed=false,name='ECHO'){const s=createSpokenState();s.setView({phase:'inspect',loop:1,levelId:'hotel',effects});s.setIdentity(name,allowed);return s;}
function tick(s,n,pose=far,events=[],fps=60,enabled=true,start=0){for(let i=0;i<n*fps;i++)s.update(1/fps,pose,enabled,{now:start+(i+1)/fps,events});}
function team(consents=[false,false]){let r=createRoom('ABCDEF',makePlayer('a','ALPHA','hash-a',0,1000,consents[0]),'standard','spoken',1000,{mode:'single',levelId:'hotel'});r=joinRoom(r,makePlayer('b','BRAVO','hash-b',1,1000,consents[1]));return actRoom(r,'a','start',{decisionEpoch:r.decisionEpoch},1100);}

test('French bank covers the explicit nickname alphabet and future phrase without a network call',()=>{
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'){assert.ok(Object.hasOwn(SPOKEN_BANK,c));assert.ok(SPOKEN_DURATIONS[c]>.05&&SPOKEN_DURATIONS[c]<2);}
 assert.equal(SPOKEN_BANK.future.text,FUTURE_SENTENCE);assert.ok(SPOKEN_DURATIONS.future<5);
 assert.equal(canSpellName('ECHO 09_a'),true);assert.equal(canSpellName('A'.repeat(25)),false);assert.equal(canSpellName('Loïc'),false);assert.equal(canSpellName('<script>'),false);
});
for(const rate of [8000,16000,44100,48000])test(`embedded voice PCM decodes finite, bounded, audible data at ${rate} Hz`,()=>{
 for(const token of ['future','A','Z','0','_']){const data=spokenPCM(token,rate);assert.equal(data.length,Math.ceil(SPOKEN_DURATIONS[token]*rate));let energy=0;for(const v of data){assert.ok(Number.isFinite(v)&&Math.abs(v)<=.721);energy+=v*v;}assert.ok(energy/data.length>.0001);assert.equal(Math.abs(data[0]),0);assert.equal(Math.abs(data.at(-1)),0);}
});
test('decoder rejects unknown tokens and rates rather than falling back to another sound',()=>{
 for(const token of ['not-a-letter','__proto__','constructor'])assert.throws(()=>spokenPCM(token,8000));for(const rate of [0,NaN,7999,200000])assert.throws(()=>spokenPCM('A',rate));
});
test('normal reference is hiss and a fan even with forced effects and prior consent',()=>{
 const s=state(['vent_whisper','radio_future'],true);s.setView({phase:'reference',effects:['vent_whisper','radio_future']});tick(s,3,near,[event]);assert.ok(s.snapshot().voices.every(v=>!v.kind.startsWith('spoken:')));assert.match(s.snapshot().caption,/aucune parole/);
});
test('shared test lamp switches identically for affected and baseline witnesses, speech precedes the action',()=>{
 const a=state(['radio_future']),b=state();
 a.update(0,far,true,{now:2,events:[event]});b.update(0,far,true,{now:2,events:[event]});
 assert.ok(a.snapshot().voices.some(v=>v.kind==='spoken:future'));assert.ok(!b.snapshot().voices.some(v=>v.kind.startsWith('spoken:')));
 assert.equal(a.snapshot().lampLit,true);assert.equal(b.snapshot().lampLit,true);assert.match(a.snapshot().caption,/va s’éteindre/);assert.match(b.snapshot().caption,/aucune parole/);
 for(const t of [6,7,9,11]){a.update(0,far,true,{now:t,events:[event]});b.update(0,far,true,{now:t,events:[event]});assert.equal(a.snapshot().lampLit,b.snapshot().lampLit);assert.equal(a.snapshot().lampLit,t>=9);}
 assert.match(a.snapshot().caption,/rallumée/);
});
test('late receiver clients get the journal but never replay an expired sentence',()=>{
 const s=state(['radio_future']);s.update(0,far,true,{now:11,events:[event]});assert.ok(!s.snapshot().voices.some(v=>v.kind.startsWith('spoken:')));assert.match(s.snapshot().caption,/Journal du relais/);
});
for(const fps of [10,30,60,144])test(`2-metre vent approach and spelling pause at ${fps} frames/s`,()=>{
 const s=state(['vent_whisper'],true,'A0');tick(s,2,far,[],fps);assert.ok(!s.snapshot().voices.some(v=>v.kind.startsWith('spoken:')));
 tick(s,.8,near,[],fps);assert.ok(s.snapshot().spelled.startsWith('A'));assert.ok(!s.snapshot().caption.includes('A0')); const saved=s.snapshot().spelled;tick(s,20,near,[],fps,false);assert.equal(s.snapshot().spelled,saved);assert.equal(s.snapshot().voices.length,0);
 tick(s,.1,near,[],fps,true);assert.ok(s.snapshot().active);tick(s,1,far,[],fps);assert.equal(s.snapshot().spelled,'');
});
test('no consent, invalid names and revoked identity never emit or transcribe the pseudonym',()=>{
 for(const name of ['SECRET','EMAIL@example.com','漢字']){const s=state(['vent_whisper'],false,name);tick(s,4,near);assert.ok(!s.snapshot().voices.some(v=>v.kind.startsWith('spoken:')));assert.ok(!s.snapshot().caption.includes(name));}
 const s=state(['vent_whisper'],true,'SECRET');tick(s,2,near);s.setIdentity('SECRET',false);tick(s,1,near);assert.ok(!s.snapshot().caption.includes('SECRET'));assert.equal(s.snapshot().spelled,'');
});
test('R stops current speech until explicit receiver activation or leaving the vent zone',()=>{
 const s=state(['radio_future','vent_whisper'],true,'A');s.update(0,far,true,{now:2,events:[event]});s.stop();tick(s,.2,far,[event],60,true,2);assert.ok(!s.snapshot().voices.some(v=>v.kind.startsWith('spoken:')));
 const next={...event,id:'a:receiver-test-002',at:12000,sequence:2};s.update(0,far,true,{now:14,events:[next]});assert.ok(s.snapshot().voices.some(v=>v.kind==='spoken:future'));
 tick(s,1,near);s.stop();tick(s,3,near);assert.equal(s.snapshot().spelled,'');tick(s,.1,far);tick(s,1,near);assert.ok(s.snapshot().spelled);
});
test('fresh passage and other locations clear private transcript and voice',()=>{
 const s=state(['vent_whisper'],true);tick(s,2,near);s.setView({phase:'reference',loop:2});assert.equal(s.snapshot().spelled,'');s.setView({levelId:'cabin',phase:'inspect',effects:['radio_future','vent_whisper']});tick(s,2,near,[event]);assert.equal(s.snapshot().caption,'');assert.equal(s.snapshot().voices.length,0);
});
test('named anomaly is excluded by default and can be drawn only with explicit run permission',()=>{
 let found=false;for(let i=0;i<2000;i++){const opts={seed:'name-'+i,mode:'single',levelId:'hotel'};assert.notEqual(advanceRun(createRun(opts)).currentAnomalyId,'vent_whisper');if(advanceRun(createRun({...opts,namedVoiceAllowed:true})).currentAnomalyId==='vent_whisper')found=true;}assert.ok(found);
});
test('one missing team consent excludes the named case; every joining member is checked',()=>{
 assert.equal(team([true,false]).run.namedVoiceAllowed,false);assert.equal(team([true,true]).run.namedVoiceAllowed,true);assert.equal(team().run.namedVoiceAllowed,false);
 assert.throws(()=>makePlayer('a','Loïc','hash',0,0,true));assert.equal(makePlayer('a','Loïc','hash',0,0,false).namedVoiceConsent,false);
});
for(const id of ['vent_whisper','clock_reverse',null])test(`revoking permission restarts reference without score or case leakage (${id})`,()=>{
 let r=team([true,true]);r.run={...r.run,phase:'inspect',loop:4,currentAnomalyId:id,observerSlots:[0],streak:2,stageProgress:2};r.players.forEach(p=>p.vote=true);const epoch=r.decisionEpoch;
 r=actRoom(r,'a','revoke-named-voice',{namedVoiceConsent:true},1500);
 assert.equal(r.run.phase,'reference');assert.equal(r.run.loop,5);assert.equal(r.run.streak,2);assert.equal(r.run.strikes,0);assert.equal(r.run.currentAnomalyId,null);assert.equal(r.run.namedVoiceAllowed,false);assert.equal(r.decisionEpoch,epoch+1);assert.ok(r.players.every(p=>p.vote===null));
 const pub=projectRoom(r,'b',1500);assert.deepEqual(pub.view.effects,[]);assert.ok(!JSON.stringify(pub).includes('hash-a'));assert.equal(pub.players.find(p=>p.id==='a').namedVoiceConsent,false);
 const again=actRoom(r,'a','revoke-named-voice',{},1600);assert.equal(again.decisionEpoch,r.decisionEpoch);assert.equal(again.run.loop,r.run.loop);
 assert.throws(()=>actRoom(r,'a','grant-named-voice',{namedVoiceConsent:true},1600));
});
test('six public props survive synchronization and radio event sends no phrase, identity or private outcome',()=>{
 let r=team();r=actRoom(r,'a','pose',{pose:{x:-2,y:1.67,z:7.35,yaw:0,pitch:0}},1200);
 r=actRoom(r,'a','prop',{target:'service-radio',requestId:'service-radio-00001',expectedSequence:0,decisionEpoch:r.decisionEpoch,phrase:'PRIVATE'},1300);
 const a=projectRoom(r,'a',1300),b=projectRoom(r,'b',1300);assert.deepEqual(a.propEvents,b.propEvents);assert.equal(a.propEvents[0].target,'service-radio');assert.ok(!JSON.stringify(a.propEvents).includes('PRIVATE'));
 const state=createTemporalState();state.setView({phase:'inspect',loop:1,levelId:'hotel'});const ev=PROP_TARGETS.map((target,i)=>({...event,target,id:'test-'+i}));state.sync(ev,1000);assert.equal(state.snapshot().events.length,6);
});
