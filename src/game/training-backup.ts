import {ANOMALY_BY_ID} from './catalog';
import {createRun,migrateRun,type Run} from './rules';
import {LEVEL_ORDER,isLevelId,type LevelId} from './levels';
export const BACKUP_FORMAT='parallaxe-training-backup-v1';
export const BACKUP_LIMIT=65536;
export type Checkpoint={mode:'campaign'|'single';levelId:LevelId;difficulty:'standard'|'relaxed';stage:number;stageProgress:number;streak:number;strikes:number;correctTotal:number};
export type TrainingBackup={format:typeof BACKUP_FORMAT;progress:Checkpoint|null;archives:string[]};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Objet de sauvegarde invalide.');return value as Record<string,unknown>;}
function keys(value:Record<string,unknown>,expected:string[]){if(Object.keys(value).length!==expected.length||Object.keys(value).some(k=>!expected.includes(k)))throw new Error('Format inconnu ou champs inattendus.');}
function int(v:unknown,max=100000):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;}
function checkpoint(value:unknown):Checkpoint{
 const p=object(value);keys(p,['mode','levelId','difficulty','stage','stageProgress','streak','strikes','correctTotal']);
 if((p.mode!=='campaign'&&p.mode!=='single')||!isLevelId(p.levelId)||(p.difficulty!=='standard'&&p.difficulty!=='relaxed'))throw new Error('Lieu ou mode de sauvegarde non reconnu.');
 for(const k of ['stage','stageProgress','streak','strikes','correctTotal'])if(!int(p[k]))throw new Error('Progression invalide.');
 const c=p as unknown as Checkpoint;
 if(c.streak>8||c.correctTotal<c.streak||(c.difficulty==='standard'&&c.strikes>2))throw new Error('Progression terminée ou incohérente.');
 if(c.mode==='campaign'&&(c.stage>2||c.levelId!==LEVEL_ORDER[c.stage]||c.stageProgress>2||c.streak!==c.stage*3+c.stageProgress))throw new Error('Palier de campagne incohérent.');
 if(c.mode==='single'&&(c.stage!==0||c.stageProgress!==c.streak))throw new Error('Série autonome incohérente.');
 return {...c};
}
function archiveIds(value:unknown):string[]{if(!Array.isArray(value)||value.length>120||value.some(id=>typeof id!=='string'||!Object.hasOwn(ANOMALY_BY_ID,id))||new Set(value).size!==value.length)throw new Error('Liste de découvertes invalide.');return [...value];}
/** Checkpoint only: no seed, active case, observers, player name, consent or credentials. */
export function createTrainingBackup(value:unknown,known:readonly string[]):TrainingBackup{
 const run=migrateRun(value);let progress:Checkpoint|null=null;
 if(run&&!['won','lost'].includes(run.phase)){
  const stage=run.mode==='campaign'&&run.pendingLevel?run.stage+1:run.stage;
  const stageProgress=run.pendingLevel?0:run.stageProgress;
  progress=checkpoint({mode:run.mode,levelId:run.mode==='campaign'?LEVEL_ORDER[stage]:run.levelId,difficulty:run.difficulty,stage,stageProgress,streak:run.streak,strikes:run.strikes,correctTotal:run.correctTotal});
 }
 return {format:BACKUP_FORMAT,progress,archives:archiveIds([...new Set(known.filter(id=>!!Object.hasOwn(ANOMALY_BY_ID,id)))])};
}
export function readTrainingBackup(text:string):TrainingBackup{
 if(typeof text!=='string'||(text.length>BACKUP_LIMIT||new TextEncoder().encode(text).byteLength>BACKUP_LIMIT))throw new Error('Fichier trop volumineux (64 Ko maximum).');
 let data:unknown;try{data=JSON.parse(text);}catch{throw new Error('Le fichier n’est pas un JSON valide.');}
 const p=object(data);keys(p,['format','progress','archives']);
 if(p.format!==BACKUP_FORMAT)throw new Error('Ce fichier n’est pas une sauvegarde Parallaxe compatible.');
 return {format:BACKUP_FORMAT,progress:p.progress===null?null:checkpoint(p.progress),archives:archiveIds(p.archives)};
}
export function restoreTrainingBackup(backup:TrainingBackup,seed:string):Run|null{
 const checked=readTrainingBackup(JSON.stringify(backup)),p=checked.progress;
 return p?{...createRun({seed,difficulty:p.difficulty,mode:p.mode,levelId:p.levelId,players:2,namedVoiceAllowed:false}),...p}:null;
}
export type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
/** Two-key write with rollback; write a portable previous checkpoint before replacing anything. */
export function importTrainingBackup(storage:StoragePort,backup:TrainingBackup,seed:string):{run:Run|null;known:string[]}{
 const safe=readTrainingBackup(JSON.stringify(backup));
 const oldRun=storage.getItem('parallaxe-training'),oldKnown=storage.getItem('parallaxe-archives');
 let previousKnown:string[]=[];
 try{const v=oldKnown?JSON.parse(oldKnown):[];if(Array.isArray(v))previousKnown=v.filter(x=>typeof x==='string'&&Object.hasOwn(ANOMALY_BY_ID,x));}catch{}
 const run=restoreTrainingBackup(safe,seed),known=[...new Set([...previousKnown,...safe.archives])];
 // Keep the previous raw local save too: it is not exported and can be restored exactly on a failed write.
 const previous=JSON.stringify({run:oldRun,archives:oldKnown});
 let snapshotWritten=false;
 try{
  storage.setItem('parallaxe-before-import',previous);snapshotWritten=true;
  if(run)storage.setItem('parallaxe-training',JSON.stringify(run));else storage.removeItem('parallaxe-training');
  storage.setItem('parallaxe-archives',JSON.stringify(known));
 }catch{
  if(!snapshotWritten)throw new Error('Import annulé avant toute modification : impossible de conserver la copie précédente.');
  let rollback=true;
  for(const [key,value]of [['parallaxe-training',oldRun],['parallaxe-archives',oldKnown]])try{if(value===null)storage.removeItem(key!);else storage.setItem(key!,value!);}catch{rollback=false;}
  throw new Error(rollback?'Import impossible : stockage plein ou interdit. Ancienne progression conservée.':'Stockage indisponible : récupération automatique incomplète. La copie locale précédente est conservée sous parallaxe-before-import.');
 }
 return {run,known};
}
export function previousTrainingBackup(storage:StoragePort):TrainingBackup|null{
 try{const data=JSON.parse(storage.getItem('parallaxe-before-import')||'null');return data?createTrainingBackup(data.run?JSON.parse(data.run):null,data.archives?JSON.parse(data.archives):[]):null;}catch{return null;}
}
