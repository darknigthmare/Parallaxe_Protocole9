import type { AcousticVoice } from './acoustic-state';
/** Motion-derived steps and private residuals. Never counts input intent or network errors. */
export type MotionActor={id:string;x:number;z:number;connected?:boolean};
export type FootstepView={phase?:string;loop?:number;levelId?:string;effects?:readonly string[];contextKey?:string};
export function createFootstepState(){
  let key='',phase='menu',level='hotel',affected=false,active=false,time=0,quiet=0,sequence=0;
  let ready=false,suppressed=false;
  const previous=new Map<string,{x:number;z:number;distance:number}>();
  const impacts=new Map<string,{id:string;at:number;x:number;z:number}>();
  function reset(){time=quiet=0;previous.clear();impacts.clear();ready=false;suppressed=false;}
  function setView(view:FootstepView){
    phase=view.phase??phase;level=view.levelId??level;
    const next=`${view.contextKey??''}:${level}:${view.loop??0}:${['reference','menu','lobby'].includes(phase)?phase:'round'}`;
    if(next!==key){key=next;reset();}
    affected=level==='hotel'&&phase==='inspect'&&(view.effects??[]).includes('footsteps_unowned');
    if(!['reference','inspect'].includes(phase))active=false;
  }
  function update(dt:number,actors:readonly MotionActor[],enabled=true,networkFresh=true){
    active=enabled&&['reference','inspect'].includes(phase);
    const seconds=Number.isFinite(dt)?Math.min(.25,Math.max(0,dt)):0;
    const valid=actors.length>0&&actors.length<=4&&new Set(actors.map(a=>a.id)).size===actors.length
      &&actors.every(a=>a.connected!==false&&typeof a.id==='string'&&a.id.length<=96&&Number.isFinite(a.x)&&Number.isFinite(a.z));
    suppressed=!valid||!networkFresh;
    if(!active||suppressed){quiet=0;ready=false;previous.clear();impacts.clear();return;}
    time+=seconds;
    const ids=new Set(actors.map(a=>a.id));let moving=false;
    // Join/leave/unknown pose restarts the common observation window, never evidence.
    if(previous.size!==ids.size||[...previous.keys()].some(id=>!ids.has(id))){quiet=0;ready=false;}
    for(const actor of actors){
      const old=previous.get(actor.id);
      const distance=old?Math.hypot(actor.x-old.x,actor.z-old.z):0;
      if(!old||distance>.00001) moving=true;
      let stride=(old?.distance??0)+distance;
      if(distance>1.5){stride=0;} // teleport/rejoin does not emit a machine-gun burst
      else if(old&&stride>=.68){
        stride%=.68;impacts.set(actor.id,{id:`step-${actor.id}-${++sequence}`,at:time,x:actor.x,z:actor.z});
      }
      previous.set(actor.id,{x:actor.x,z:actor.z,distance:stride});
    }
    for(const id of [...previous.keys()])if(!ids.has(id)){previous.delete(id);impacts.delete(id);}
    for(const [id,impact]of impacts)if(time-impact.at>=.30)impacts.delete(id);
    quiet=moving?0:quiet+seconds;ready=true;
  }
  function snapshot(){
    const residualAge=quiet-3;
    const index=Math.floor((residualAge+1e-8)/.72);
    const beatAge=residualAge-index*.72;
    const audible=affected&&ready&&active&&!suppressed&&residualAge>=-1e-8;
    const voices:AcousticVoice[]=[];
    if(active&&!suppressed){
      for(const impact of impacts.values())voices.push({id:impact.id,kind:'footstep',offset:time-impact.at,loop:false,position:[impact.x,.08,impact.z],gain:.32});
      if(audible&&beatAge>=-1e-8&&beatAge<.30)voices.push({id:`residual-${index}`,kind:'footstep',offset:Math.max(0,beatAge),loop:false,position:[index%2?1.60:-1.60,.07,-5.8-(index%5)*.30],gain:.38});
    }
    // This counter covers only the unowned source; normal player steps are excluded.
    const count=audible?index+1:0;
    const caption=level==='hotel'&&active?(suppressed?'Écoute du couloir — attente de positions synchronisées.':quiet>=3?
      `Couloir — équipe immobile ; ${count} pas résiduel${count>1?'s':''}${count?` depuis le fond ${index%2?'droit':'gauche'}`:''}.`:''):'';
    return{key,active,voices,caption,quietSeconds:quiet,residualCount:count,networkFresh:!suppressed};
  }
  return{setView,update,snapshot};
}
