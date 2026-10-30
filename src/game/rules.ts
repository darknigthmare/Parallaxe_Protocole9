import { ANOMALY_BY_ID, anomaliesForLevel } from './catalog';
import { LEVEL_ORDER,isLevelId,type LevelId,type GameMode } from './levels';

export type Difficulty = 'standard' | 'relaxed';
export type Phase = 'reference' | 'inspect' | 'reveal' | 'won' | 'lost';
export type PersonalView = { effects: string[]; variant: number; phase: Phase | 'lobby'; loop: number; relayCode:string;levelId:LevelId;arrowDirection:'left'|'right';syncTime:string };
export type RunResult = {correct:boolean;hasAnomaly:boolean;title:string;description:string;observerSlots:number[];anomalyId:string|null};
export type Run = {
  seed:string;difficulty:Difficulty;players:number;phase:Phase;loop:number;streak:number;
  strikes:number;correctTotal:number;currentAnomalyId:string|null;observerSlots:number[];
  lastResult:RunResult|null;history:string[];
  schemaVersion:2;mode:GameMode;levelId:LevelId;stage:number;stageProgress:number;pendingLevel:boolean;
};

export function hashSeed(seed:string):number {
  let h=2166136261;
  for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619);
  return h>>>0;
}

export function randomFrom(seed:string):()=>number {
  let a=hashSeed(seed);
  return () => { a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; };
}

export function createRun({seed,difficulty='standard',players=2,mode='campaign',levelId='hotel'}:{seed:string;difficulty?:Difficulty;players?:number;mode?:GameMode;levelId?:LevelId}):Run {
  const actualMode=mode==='single'?'single':'campaign';
  return {schemaVersion:2,mode:actualMode,levelId:actualMode==='campaign'?'hotel':isLevelId(levelId)?levelId:'hotel',stage:0,stageProgress:0,pendingLevel:false,seed:String(seed).slice(0,128),difficulty,players:Math.min(4,Math.max(2,Math.floor(players)||2)),phase:'reference',loop:0,streak:0,strikes:0,correctTotal:0,currentAnomalyId:null,observerSlots:[],lastResult:null,history:[]};
}

/** v0.1 saves keep their original single-hotel semantics; malformed saves are rejected. */
export function migrateRun(value:unknown):Run|null {
  if(!value||typeof value!=='object')return null;
  const old=value as Partial<Run>;
  if(typeof old.seed!=='string'||!['reference','inspect','reveal','won','lost'].includes(String(old.phase)))return null;
  const integer=(v:unknown,min:number,max:number,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,Math.floor(v))):fallback;
  const modern=old.schemaVersion===2;
  const mode:GameMode=modern&&old.mode==='campaign'?'campaign':'single';
  const stage=mode==='campaign'?integer(old.stage,0,2):0;
  const levelId=mode==='campaign'?LEVEL_ORDER[stage]:isLevelId(old.levelId)?old.levelId:'hotel';
  const run=createRun({seed:old.seed,difficulty:old.difficulty==='relaxed'?'relaxed':'standard',players:integer(old.players,2,4,2),mode,levelId});
  const streak=integer(old.streak,0,9);
  const id=typeof old.currentAnomalyId==='string'&&ANOMALY_BY_ID[old.currentAnomalyId]?.levels?.includes(levelId)?old.currentAnomalyId:null;
  const last=old.lastResult;
  const lastResult=last&&typeof last.correct==='boolean'&&typeof last.hasAnomaly==='boolean'&&typeof last.title==='string'&&typeof last.description==='string'?{...last,observerSlots:Array.isArray(last.observerSlots)?last.observerSlots.filter(s=>Number.isInteger(s)&&s>=0&&s<4):[],anomalyId:typeof last.anomalyId==='string'&&ANOMALY_BY_ID[last.anomalyId]?last.anomalyId:null}:null;
  return {...run,phase:old.phase as Phase,levelId,stage,streak,stageProgress:mode==='campaign'?integer(old.stageProgress,0,3,Math.max(0,streak-stage*3)):streak,pendingLevel:mode==='campaign'&&stage<2&&old.pendingLevel===true,loop:integer(old.loop,0,100000),strikes:integer(old.strikes,0,100000),correctTotal:integer(old.correctTotal,0,100000),currentAnomalyId:id,observerSlots:Array.isArray(old.observerSlots)?old.observerSlots.filter(s=>Number.isInteger(s)&&s>=0&&s<4):[],lastResult,history:Array.isArray(old.history)?old.history.filter(id=>typeof id==='string'&&ANOMALY_BY_ID[id]).slice(-16):[]};
}

/** The first traversal is always a clean reference; only explicit next deals a case. */
export function advanceRun(run:Run):Run {
  if(run.schemaVersion!==2)run=migrateRun(run)??createRun({seed:'recovered',mode:'single'});
  if(run.phase!=='reference'&&run.phase!=='reveal')return run;
  if(run.phase==='reveal'&&run.pendingLevel){
    const stage=run.stage+1;
    return {...run,stage,stageProgress:0,levelId:LEVEL_ORDER[stage],phase:'reference',pendingLevel:false,currentAnomalyId:null,observerSlots:[],lastResult:null};
  }
  const loop=run.loop+1;
  const rng=randomFrom(`${run.seed}:loop:${loop}`);
  const hasAnomaly=rng()<0.68;
  const pool=anomaliesForLevel(run.levelId).filter(a=>!run.history.slice(-5).includes(a.id));
  const chosen=hasAnomaly?pool[Math.floor(rng()*pool.length)]:null;
  const first=(Math.floor(rng()*run.players)+loop-1)%run.players;
  const observers:number[]=chosen?[first]:[];
  // With 3–4 players, some events have two witnesses, while at least one sees baseline.
  if(chosen&&run.players>2&&rng()<0.35)observers.push((first+1+Math.floor(rng()*(run.players-1)))%run.players);
  return {...run,phase:'inspect',loop,currentAnomalyId:chosen?.id??null,observerSlots:observers,lastResult:null,history:chosen?[...run.history,chosen.id].slice(-16):run.history};
}

export function getPersonalView(run:Run,slot:number):PersonalView {
  if(run.schemaVersion!==2)run=migrateRun(run)??createRun({seed:'recovered',mode:'single'});
  const visible=run.phase!=='reference'&&run.currentAnomalyId!==null&&run.observerSlots.includes(slot);
  const base=run.phase==='reference'?3142:1000+(hashSeed(`${run.seed}:relay:${run.loop}`)%9000);
  const relayCode=String(run.currentAnomalyId==='relay_mismatch'&&visible?1000+((base-1000+73)%9000):base);
  const arrowBase=run.phase==='reference'?0:hashSeed(`${run.seed}:arrow:${run.loop}`)%2;
  const arrowDirection=(run.currentAnomalyId==='paired_arrow'&&visible?1-arrowBase:arrowBase)===0?'left':'right';
  const minutes=run.phase==='reference'?189:hashSeed(`${run.seed}:clock:${run.loop}`)%1440;
  const shownMinutes=run.currentAnomalyId==='paired_clock'&&visible?(minutes+7)%1440:minutes;
  const syncTime=`${String(Math.floor(shownMinutes/60)).padStart(2,'0')}:${String(shownMinutes%60).padStart(2,'0')}`;
  return {effects:visible&&!['relay_mismatch','paired_arrow','paired_clock'].includes(run.currentAnomalyId!)?[run.currentAnomalyId!]:[],variant:run.phase==='reference'?0:hashSeed(`${run.seed}:inspection:${run.loop}`)%16,phase:run.phase,loop:run.loop,relayCode,levelId:run.levelId,arrowDirection,syncTime};
}

/** Evaluates a single final team answer. Never call with an individual unconfirmed vote. */
export function evaluateRun(run:Run,vote:boolean):Run {
  if(run.schemaVersion!==2)run=migrateRun(run)??createRun({seed:'recovered',mode:'single'});
  if(run.phase!=='inspect')return run;
  const hasAnomaly=run.currentAnomalyId!==null;
  const correct=vote===hasAnomaly;
  const streak=correct?run.streak+1:run.mode==='campaign'?run.stage*3:0;
  const stageProgress=correct?run.stageProgress+1:0;
  const strikes=correct?run.strikes:run.strikes+1;
  const anomaly=run.currentAnomalyId?ANOMALY_BY_ID[run.currentAnomalyId]:null;
  const lastResult:RunResult={correct,hasAnomaly,title:anomaly?.title??'Passage conforme',description:anomaly?.description??'Les perceptions sont conformes au passage de référence. Aucune anomalie n’était présente.',observerSlots:[...run.observerSlots],anomalyId:anomaly?.id??null};
  return {...run,streak,strikes,stageProgress,pendingLevel:correct&&run.mode==='campaign'&&stageProgress===3&&run.stage<2,correctTotal:run.correctTotal+(correct?1:0),lastResult,phase:streak>=9?'won':strikes>=3&&run.difficulty==='standard'?'lost':'reveal'};
}

export function getRunSummary(run:Run) {
  return {phase:run.phase,loop:run.loop,streak:run.streak,strikes:run.strikes,correctTotal:run.correctTotal,difficulty:run.difficulty,mode:run.mode,levelId:run.levelId,stage:run.stage,stageProgress:run.stageProgress};
}
