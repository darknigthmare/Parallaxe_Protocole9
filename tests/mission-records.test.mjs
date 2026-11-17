import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
const temp=await mkdtemp(join(tmpdir(),'p9-field-notes-'));
for(const name of ['levels','mission-records'])await writeFile(join(temp,name+'.mjs'),stripTypeScriptTypes(await readFile(new URL('../src/game/'+name+'.ts',import.meta.url),'utf8')).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
test.after(()=>rm(temp,{recursive:true,force:true}));
const {SELECTABLE_LEVELS}=await import(pathToFileURL(join(temp,'levels.mjs')));
const {MISSION_NOTES,missionNote,missionDebrief,readFieldNotes,keepMissionNote,storedMissionNotes,FIELD_NOTES_KEY,FIELD_NOTES_FORMAT}=await import(pathToFileURL(join(temp,'mission-records.mjs')));
const storage=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const ending={phase:'won',mode:'campaign',levelId:'clinic',stage:2,streak:9,correctTotal:9,strikes:0,loop:9};

test('each of the five actual locations has exactly one unique original note',()=>{
 assert.deepEqual([...MISSION_NOTES.map(n=>n.levelId)].sort(),[...SELECTABLE_LEVELS].sort());
 assert.equal(new Set(MISSION_NOTES.map(n=>n.id)).size,5);
 for(const level of SELECTABLE_LEVELS){const n=missionNote(level);assert.equal(n.levelId,level);assert.equal(n.paragraphs.length,3);assert.ok(n.title&&n.source);assert.ok(n.paragraphs.every(p=>p.length>40&&p.length<360));}
});
test('unknown or prototype-like level values cannot expose a dossier',()=>{
 for(const id of [null,undefined,{},['hotel'],'constructor','__proto__'])assert.equal(missionNote(id),null);
});
test('a note is only kept after explicit collection during a reference or inspection',()=>{
 const s=storage();assert.equal(s.values.size,0);
 assert.deepEqual(keepMissionNote(s,'hotel','reference'),['SC-01']);
 assert.deepEqual(readFieldNotes(s.getItem(FIELD_NOTES_KEY)),['SC-01']);
 assert.deepEqual(keepMissionNote(s,'cabin','inspect'),['SC-01','CH-01']);
});
test('menu, lobby, reveal and terminal phases cannot collect unread notes',()=>{
 for(const phase of ['menu','lobby','reveal','won','lost',[],null]){const s=storage();assert.throws(()=>keepMissionNote(s,'hotel',phase));assert.equal(s.values.size,0);}
});
test('collection is idempotent and canonical irrespective of visit order',()=>{
 const s=storage();for(const level of [...SELECTABLE_LEVELS].reverse())keepMissionNote(s,level,'reference');
 const before=s.getItem(FIELD_NOTES_KEY);keepMissionNote(s,'hotel','reference');assert.equal(s.getItem(FIELD_NOTES_KEY),before);
 assert.deepEqual(readFieldNotes(before),MISSION_NOTES.map(n=>n.id));
});
test('new collection merges records already saved by another browser tab',()=>{
 const s=storage();keepMissionNote(s,'hotel','reference');s.setItem(FIELD_NOTES_KEY,JSON.stringify({format:FIELD_NOTES_FORMAT,ids:['O9-01','SC-01']}));
 assert.deepEqual(keepMissionNote(s,'metro','reference'),['SC-01','T9-01','O9-01']);
});
test('note persistence is bounded and never transports identity, consent or anomaly fields',()=>{
 const s=storage();keepMissionNote(s,'hotel','inspect');const text=s.getItem(FIELD_NOTES_KEY),data=JSON.parse(text);
 assert.deepEqual(Object.keys(data).sort(),['format','ids']);assert.ok(text.length<256);assert.equal(s.values.size,1);
 assert.doesNotMatch(text,/seed|token|name|consent|anomaly/);
});
test('malformed or foreign local data is discarded without throwing',()=>{
 for(const raw of [null,{},'{','null','[]','1',JSON.stringify({format:'other',ids:['SC-01']}),'x'.repeat(4097),JSON.stringify({format:FIELD_NOTES_FORMAT,ids:Array(6).fill('SC-01')})])assert.deepEqual(readFieldNotes(raw),[]);
});
test('unknown and inherited IDs never unlock documents',()=>{
 assert.deepEqual(readFieldNotes(JSON.stringify({format:FIELD_NOTES_FORMAT,ids:['constructor','SC-01','SC-01',{},'__proto__']})),['SC-01']);
 assert.deepEqual(storedMissionNotes(['toString','SC-01']).map(n=>n.id),['SC-01']);
});
test('denied reads and quota errors do not claim successful collection',()=>{
 for(const s of [{getItem(){throw Error('private provider details');},setItem(){}},{getItem(){return null;},setItem(){throw Error('Quota');}}])assert.throws(()=>keepMissionNote(s,'hotel','reference'),e=>e.message.includes('non conservée')&&!e.message.includes('private'));
});
test('before terminal state no counter or private case is consulted for an ending',()=>{
 const input=new Proxy({phase:'inspect'},{get:(o,k)=>{if(k!=='phase')throw Error('Do not read '+String(k));return o[k];}});
 assert.equal(missionDebrief(input),null);
 for(const phase of ['reference','reveal','lobby','menu'])assert.equal(missionDebrief({...ending,phase}),null);
});
test('campaign debrief preserves three-sector fiction and the nine certifications',()=>{
 const d=missionDebrief(ending);assert.match(d.route,/Saint-Clair.*Terminus 09.*Aile blanche/);assert.equal(d.attempts,9);assert.equal(d.validated,9);assert.match(d.paragraphs[0],/trois secteurs/);
});
test('corrected campaign debrief reports observable errors without a secret trust score',()=>{
 const d=missionDebrief({...ending,strikes:1,loop:11,correctTotal:10});assert.equal(d.errors,1);assert.equal(d.validated,10);assert.match(d.id,/recovered$/);assert.match(d.paragraphs[1],/erreurs/);
});
for(const levelId of SELECTABLE_LEVELS)test(`single-location ending stays local to ${levelId}`,()=>{
 const d=missionDebrief({...ending,mode:'single',levelId,stage:0});assert.ok(d);assert.match(d.id,new RegExp(levelId));assert.doesNotMatch(d.route,/→/);assert.match(d.paragraphs[0],/neuf/);
});
test('defeat keeps the whole team non-adversarial and does not imply automatic checkpoint continuation',()=>{
 const d=missionDebrief({...ending,phase:'lost',stage:1,levelId:'metro',streak:3,strikes:3,loop:8,correctTotal:5});
 assert.match(d.paragraphs[0],/1 secteur/);assert.match(d.paragraphs[0],/nouvelle traversée/);assert.match(d.paragraphs[1],/aucun inspecteur coupable/);
});
test('single-location recovery never claims campaign-sector retention',()=>{
 const d=missionDebrief({...ending,mode:'single',levelId:'cabin',stage:0,strikes:1,loop:11,correctTotal:10});assert.doesNotMatch(d.paragraphs[1],/secteurs/);
});
test('bad counters and level types produce no fabricated report',()=>{
 for(const patch of [{strikes:NaN},{loop:Infinity},{correctTotal:-1},{stage:.5},{mode:'future'},{levelId:'__proto__'}])assert.equal(missionDebrief({...ending,...patch}),null);
});
test('ending ignores secret seed, active case and affected-observer information',()=>{
 const d=missionDebrief({...ending,seed:'DO_NOT_READ',currentAnomalyId:'SECRET',observerSlots:[3],namedVoiceAllowed:true});
 assert.deepEqual(d,missionDebrief(ending));assert.doesNotMatch(JSON.stringify(d),/DO_NOT_READ|SECRET|observerSlots|namedVoiceAllowed/);
});
