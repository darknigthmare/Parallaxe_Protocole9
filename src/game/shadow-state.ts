/** Private observation gate. It consumes only public poses, never hidden answer/roles. */
export type ShadowActor = { id: string; x: number; z: number; yaw?: number; connected?: boolean; talking?: boolean };
export type ShadowView = { phase?: string; loop?: number; levelId?: string; effects?: readonly string[]; contextKey?: string };
export const SHADOW_STATION = { x: 0, z: -3.05, halfWidth: 2.1, halfDepth: 1.3 } as const;
export const SHADOW_SETTLE_SECONDS = 1;
export const TRAINING_WITNESS = { x: .95, z: 3.05, id: 'training-witness-T1' } as const;
export function atShadowStation(actor: Pick<ShadowActor, 'x'|'z'>) {
  return Number.isFinite(actor.x) && Number.isFinite(actor.z)
    && Math.abs(actor.x-SHADOW_STATION.x)<=SHADOW_STATION.halfWidth
    && Math.abs(actor.z-SHADOW_STATION.z)<=SHADOW_STATION.halfDepth;
}
export function createShadowState() {
  let key='', phase='menu', hotel=true, affected=false, quiet=0, active=false;
  let ready=false, reason='inactive', target: {id:string;x:number;z:number}|null=null;
  const prior=new Map<string,ShadowActor>();
  function clear(why:string) { quiet=0;ready=false;reason=why;target=null;prior.clear(); }
  function setView(view:ShadowView) {
    phase=view.phase??phase;hotel=(view.levelId??'hotel')==='hotel';
    const next=`${view.contextKey??''}:${view.levelId??'hotel'}:${view.loop??0}:${['reference','menu','lobby'].includes(phase)?phase:'round'}`;
    if(next!==key){key=next;clear('new-passage');}
    affected=hotel&&phase==='inspect'&&(view.effects??[]).includes('shadow_points');
    if(!hotel||!['reference','inspect'].includes(phase))clear('inactive');
  }
  function update(dt:number,selfId:string,actors:readonly ShadowActor[],enabled=true,shared=false,fresh=true) {
    active=enabled&&hotel&&['reference','inspect'].includes(phase);
    const valid=actors.length>0&&actors.length<=4&&actors.filter(a=>a.id===selfId).length===1
      &&new Set(actors.map(a=>a.id)).size===actors.length
      &&actors.every(a=>typeof a.id==='string'&&a.id.length>0&&a.id.length<=96&&a.connected!==false
        &&Number.isFinite(a.x)&&Number.isFinite(a.z)&&(a.yaw===undefined||Number.isFinite(a.yaw)));
    if(!active||!valid||shared&&!fresh){clear(!active?'inactive':'synchronizing');return;}
    if(!actors.every(atShadowStation)){clear('gather');return;}
    if(shared&&actors.length<2){clear('partner-required');return;}
    let moved=prior.size!==actors.length;
    for(const a of actors){
      const old=prior.get(a.id);
      if(!old||Math.hypot(a.x-old.x,a.z-old.z)>.00001||a.talking===true
        ||Math.abs(Math.atan2(Math.sin((a.yaw??0)-(old.yaw??0)),Math.cos((a.yaw??0)-(old.yaw??0))))>.002)moved=true;
    }
    prior.clear();for(const a of actors)prior.set(a.id,{...a});
    const seconds=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
    quiet=moved?0:Math.min(SHADOW_SETTLE_SECONDS,quiet+seconds);
    ready=quiet>=SHADOW_SETTLE_SECONDS-1e-8;reason=ready?'observing':'settling';
    // Stable public ordering, unrelated to fault, votes or anomaly assignment.
    const peer=[...actors].filter(a=>a.id!==selfId).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)[0];
    target=ready?(peer?{id:peer.id,x:peer.x,z:peer.z}:shared?null:{...TRAINING_WITNESS}):null;
  }
  function snapshot(){return{key,active,ready,reason,quietSeconds:quiet,pointing:active&&ready&&affected&&target!==null,target:target?{...target}:null};}
  return {setView,update,snapshot,interrupt(){active=false;clear('inactive');}};
}
