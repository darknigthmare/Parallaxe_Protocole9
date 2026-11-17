import assert from 'node:assert/strict';import test from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {stripTypeScriptTypes} from 'node:module';
const temp=await mkdtemp(join(tmpdir(),'p9-backup-'));
for(const name of ['levels','catalog','rules','mission-records','training-backup']){const s=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');await writeFile(join(temp,name+'.mjs'),stripTypeScriptTypes(s).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));}
const {createTrainingBackup,readTrainingBackup,restoreTrainingBackup,importTrainingBackup,previousTrainingBackup}=await import(pathToFileURL(join(temp,'training-backup.mjs')));
const {createRun,advanceRun,evaluateRun}=await import(pathToFileURL(join(temp,'rules.mjs')));
const {ANOMALIES}=await import(pathToFileURL(join(temp,'catalog.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
const discovered=ANOMALIES[0].id;
const backup=()=>createTrainingBackup(createRun({seed:'private-seed'}),[discovered]);
const encode=b=>JSON.stringify(b);
function solved(count,options={}){let run=createRun({seed:'test',...options});for(let i=0;i<count;i++){while(run.phase!=='inspect')run=advanceRun(run);run=evaluateRun(run,run.currentAnomalyId!==null);}return run;}
function storage(run=createRun({seed:'old'}),known=[]){const values=new Map([['parallaxe-training',encode(run)],['parallaxe-archives',encode(known)]]);return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('export has no seed, case, observer, name, credentials or named-voice consent',()=>{const run={...advanceRun(createRun({seed:'secret-seed',namedVoiceAllowed:true})),name:'secret-name',token:'secret-token'};const text=encode(createTrainingBackup(run,[discovered]));for(const s of ['secret','currentAnomalyId','observerSlots','namedVoice','token'])assert.equal(text.includes(s),false);});
test('resume creates a new clean reference with voice off and empty hidden history',()=>{const source=backup(),run=restoreTrainingBackup(source,'new-seed');assert.equal(run.phase,'reference');assert.equal(run.seed,'new-seed');assert.equal(run.currentAnomalyId,null);assert.deepEqual(run.observerSlots,[]);assert.deepEqual(run.history,[]);assert.equal(run.namedVoiceAllowed,false);});
test('campaign checkpoint after sector completion advances to the next reference, without losing the sector',()=>{const run=solved(3),b=createTrainingBackup(run,[]);assert.equal(b.progress.stage,1);assert.equal(b.progress.levelId,'metro');assert.equal(b.progress.streak,3);assert.equal(b.progress.stageProgress,0);assert.equal(restoreTrainingBackup(b,'new').phase,'reference');});
test('partial campaign and autonomous progress survive round-trip without changing mode',()=>{for(const options of [{mode:'campaign'},{mode:'single',levelId:'observatory'},{mode:'single',levelId:'cabin'}]){const run=solved(2,options),b=createTrainingBackup(run,[]),restored=restoreTrainingBackup(readTrainingBackup(encode(b)),'new');assert.equal(restored.streak,2);assert.equal(restored.levelId,run.levelId);assert.equal(restored.mode,run.mode);}});
test('lost and completed inspections export discoveries but no resumable fake progress',()=>{for(const phase of ['won','lost']){assert.equal(createTrainingBackup({...createRun({seed:'a'}),phase},[discovered]).progress,null);}});
test('an old v0.1 save retains autonomous-hotel semantics',()=>{const b=createTrainingBackup({seed:'old',phase:'inspect',streak:2,correctTotal:2},[]);assert.equal(b.progress.mode,'single');assert.equal(b.progress.levelId,'hotel');assert.equal(b.progress.streak,2);});
test('extra object fields, active Run payloads and prototype keys are rejected',()=>{for(const value of [{...backup(),token:'bad'},{...backup(),format:'future-v2'},JSON.parse('{"__proto__":{},"format":"parallaxe-training-backup-v1","progress":null,"archives":[]}'),createRun({seed:'a'})])assert.throws(()=>readTrainingBackup(encode(value)));});
test('oversized payloads, invalid JSON and arrays are rejected',()=>{for(const text of ['{','[]','null',' '.repeat(65537)])assert.throws(()=>readTrainingBackup(text));});
test('unknown, duplicate or excessive discovery IDs are rejected',()=>{for(const archives of [['not-real'],[discovered,discovered],Array(121).fill(discovered),[{}]])assert.throws(()=>readTrainingBackup(encode({...backup(),archives})));});
test('incompatible location or forged campaign checkpoint cannot be imported',()=>{for(const patch of [{stage:1},{levelId:'cabin'},{mode:'weird'},{levelId:'missing'},{stageProgress:3},{streak:5},{correctTotal:-1},{strikes:3},{stageProgress:1.5}])assert.throws(()=>readTrainingBackup(encode({...backup(),progress:{...backup().progress,...patch}})));});
test('single-mode checkpoint cannot contain a campaign stage',()=>{const b=createTrainingBackup(solved(1,{mode:'single',levelId:'hotel'}),[]);assert.throws(()=>readTrainingBackup(encode({...b,progress:{...b.progress,stage:1}})));});
test('relaxed-mode mistakes are retained, never silently made standard',()=>{const run={...createRun({seed:'x',difficulty:'relaxed'}),strikes:10};assert.equal(restoreTrainingBackup(createTrainingBackup(run,[]),'y').strikes,10);});
test('import merges discoveries and keeps a recoverable previous checkpoint',()=>{const s=storage(solved(2),[ANOMALIES[1].id]);const result=importTrainingBackup(s,backup(),'fresh');assert.equal(result.known.length,2);assert.equal(result.run.seed,'fresh');assert.equal(previousTrainingBackup(s).progress.streak,2);assert.equal(JSON.parse(s.getItem('parallaxe-training')).namedVoiceAllowed,false);});
test('failed second write rolls the first save back and leaves discoveries untouched',()=>{const s=storage(solved(2),[discovered]);const old=s.getItem('parallaxe-training'),base=s.setItem;let failed=false;s.setItem=(k,v)=>{if(k==='parallaxe-archives'&&!failed){failed=true;throw new Error('quota');}return base(k,v);};assert.throws(()=>importTrainingBackup(s,backup(),'new'),/Ancienne progression conservée/);assert.equal(s.getItem('parallaxe-training'),old);assert.deepEqual(JSON.parse(s.getItem('parallaxe-archives')),[discovered]);});
test('unavailable storage never reports a successful import',()=>{const s=storage();const old=s.getItem('parallaxe-training');s.setItem=()=>{throw new Error('blocked');};assert.throws(()=>importTrainingBackup(s,backup(),'new'),/Import annulé avant toute modification/);assert.equal(s.getItem('parallaxe-training'),old);assert.equal(s.getItem('parallaxe-before-import'),null);});
test('discovery-only import clears resumable progression only after explicit caller confirmation',()=>{const s=storage(),b={...backup(),progress:null};readTrainingBackup(encode(b));assert.notEqual(s.getItem('parallaxe-training'),null);importTrainingBackup(s,b,'new');assert.equal(s.getItem('parallaxe-training'),null);assert.equal(previousTrainingBackup(s).progress.streak,0);});
test('input objects are never mutated and exported discoveries are deduplicated',()=>{const run=solved(2),text=encode(run),known=[discovered,discovered,'bad'];const b=createTrainingBackup(run,known);assert.equal(encode(run),text);assert.equal(known.length,3);assert.deepEqual(b.archives,[discovered]);});


test('import rejects coerced array modes and difficulties instead of bypassing checkpoint guards',()=>{
  for(const patch of [{mode:['campaign']},{mode:['single']},{difficulty:['standard']},{difficulty:['relaxed']}]){
    assert.throws(()=>readTrainingBackup(encode({...backup(),progress:{...backup().progress,...patch}})),/non reconnu/);
  }
});
test('only own runtime IDs may enter discoveries, never Object prototype properties',()=>{
  for(const id of ['toString','constructor','__proto__','hasOwnProperty']){
    assert.throws(()=>readTrainingBackup(encode({...backup(),archives:[id]})),/découvertes/);
    assert.deepEqual(createTrainingBackup(null,[id,discovered]).archives,[discovered]);
    const store=storage(createRun({seed:'old'}),[id]);
    assert.deepEqual(importTrainingBackup(store,backup(),'fresh').known,[discovered]);
  }
});
test('the 64 KiB parser limit counts UTF-8 bytes, not only code units',()=>{
  const text=JSON.stringify({format:'é'.repeat(40000),progress:null,archives:[]});
  assert.ok(text.length<65536);
  assert.throws(()=>readTrainingBackup(text),/trop volumineux/);
});


test('v2 exports kept note IDs without prose, hidden results or any new personal data',()=>{
 const b=createTrainingBackup(null,[discovered],['O9-01','SC-01']);
 assert.equal(b.format,'parallaxe-training-backup-v2');assert.deepEqual(b.fieldNotes,['SC-01','O9-01']);
 assert.deepEqual(readTrainingBackup(encode(b)),b);assert.deepEqual(Object.keys(b).sort(),['archives','fieldNotes','format','progress']);
 assert.doesNotMatch(encode(b),/paragraphs|source|token|consent|observer|seed/);
});
test('all legacy v1 files still migrate to v2 and keep notes already on the device',()=>{
 const legacy={format:'parallaxe-training-backup-v1',progress:backup().progress,archives:[discovered]};
 const s=storage();s.setItem('parallaxe-field-notes',encode({format:'parallaxe-field-notes-v1',ids:['T9-01']}));
 const b=readTrainingBackup(encode(legacy));assert.deepEqual(b.fieldNotes,[]);
 const result=importTrainingBackup(s,b,'fresh');assert.deepEqual(result.fieldNotes,['T9-01']);
 assert.equal(result.run.namedVoiceAllowed,false);assert.equal(result.run.phase,'reference');
});
test('v2 rejects missing, unknown, repeated, coerced or excessive note IDs before writes',()=>{
 for(const fieldNotes of [undefined,null,'SC-01',[['SC-01']],['SC-01','SC-01'],['constructor'],['toString'],['unknown'],Array(6).fill('SC-01')]){
  const s=storage();const before=[...s.values];
  assert.throws(()=>importTrainingBackup(s,{...backup(),fieldNotes},'fresh'));assert.deepEqual([...s.values],before);
 }
});
test('note import merges in canonical order and its previous snapshot is portable',()=>{
 const s=storage();s.setItem('parallaxe-field-notes',encode({format:'parallaxe-field-notes-v1',ids:['O9-01','SC-01']}));
 const b=createTrainingBackup(null,[],['CH-01','SC-01']);const result=importTrainingBackup(s,b,'fresh');
 assert.deepEqual(result.fieldNotes,['SC-01','CH-01','O9-01']);assert.deepEqual(previousTrainingBackup(s).fieldNotes,['SC-01','O9-01']);
 assert.deepEqual(JSON.parse(s.getItem('parallaxe-field-notes')).ids,result.fieldNotes);
});
test('failure of the third data write rolls back progression, anomaly discoveries and notes exactly',()=>{
 const s=storage(solved(2),[discovered]);s.setItem('parallaxe-field-notes',encode({format:'parallaxe-field-notes-v1',ids:['SC-01']}));
 const before=new Map(s.values),base=s.setItem;let failed=false;
 s.setItem=(key,v)=>{if(key==='parallaxe-field-notes'&&!failed){failed=true;throw Error('quota');}return base(key,v);};
 assert.throws(()=>importTrainingBackup(s,createTrainingBackup(null,[],['CH-01']),'fresh'),/Ancienne progression conservée/);
 for(const [key,v]of before)assert.equal(s.getItem(key),v);assert.deepEqual(previousTrainingBackup(s).fieldNotes,['SC-01']);
});
test('failed rollback of field notes is reported, not presented as atomic success',()=>{
 const s=storage();s.setItem('parallaxe-field-notes',encode({format:'parallaxe-field-notes-v1',ids:['SC-01']}));
 const base=s.setItem;s.setItem=(key,v)=>{if(key==='parallaxe-field-notes')throw Error('denied');return base(key,v);};
 assert.throws(()=>importTrainingBackup(s,backup(),'fresh'),/récupération automatique incomplète/);
 assert.ok(s.getItem('parallaxe-before-import'));
});
test('note read failure aborts before snapshot or writes and does not echo provider details',()=>{
 const s=storage(),base=s.getItem,before=[...s.values];
 s.getItem=key=>{if(key==='parallaxe-field-notes')throw Error('PRIVATE_PROVIDER_DETAIL');return base(key);};
 assert.throws(()=>importTrainingBackup(s,backup(),'fresh'),e=>e.message.includes('avant toute modification')&&!e.message.includes('PRIVATE'));
 assert.deepEqual([...s.values],before);
});
test('pre-v2 recovery snapshots without notes stay recoverable',()=>{
 const s=storage();s.setItem('parallaxe-before-import',encode({run:s.getItem('parallaxe-training'),archives:s.getItem('parallaxe-archives')}));
 const b=previousTrainingBackup(s);assert.equal(b.format,'parallaxe-training-backup-v2');assert.deepEqual(b.fieldNotes,[]);
});
