import { SPOKEN_DURATIONS, FUTURE_SENTENCE } from './spoken-timing';
import type { AcousticPose, AcousticVoice } from './acoustic-state';
import type { PropEvent, TemporalView } from './temporal-state';
export const SPOKEN_EFFECTS=['radio_future','vent_whisper'] as const;
export const SPOKEN_ANCHORS={radio:[-3.20,1.35,7.35],vent:[3.42,2.55,-3.10]} as const;
export function canSpellName(value:unknown):value is string {return typeof value==='string'&&/^[A-Za-z0-9 _-]{1,24}$/.test(value)&&value.trim().length>0;}
/** A forecast refers to the NORMAL relay lamp action, never future player input.
 * Only self.name is supplied, and only after consent; it is never emitted to peers.
 */
export function createSpokenState(){
  let key='',level='hotel',phase='menu',effects=new Set<string>(),active=false,time=0;
  let name='',consent=false,ventStart:number|null=null,nearVent=false,ventSuppressed=false,radioDismissed='';
  let focus:'radio'|'vent'|null=null,radioEvent:PropEvent|undefined,now=0;
  function setIdentity(value:unknown,allowed:boolean){
    const next=allowed===true&&canSpellName(value)?value:'';
    if(next!==name){name=next;ventStart=null;}
    consent=next!=='';
    if(!consent){ventStart=null;if(focus==='vent')focus=null;}
  }
  function setView(view:TemporalView){
    phase=view.phase??phase;level=view.levelId??level;
    const next=`${view.contextKey??''}:${level}:${view.loop??0}:${['reference','menu','lobby'].includes(phase)?phase:'round'}`;
    if(next!==key){key=next;time=0;ventStart=null;focus=null;radioEvent=undefined;ventSuppressed=false;radioDismissed='';}
    effects=new Set(level==='hotel'&&phase==='inspect'?view.effects??[]:[]);
    if(level!=='hotel'||!['reference','inspect'].includes(phase))active=false;
  }
  function update(dt:number,pose:AcousticPose,enabled:boolean,temporal:{now:number;events:readonly PropEvent[]}){
    active=enabled&&level==='hotel'&&['reference','inspect'].includes(phase);
    now=temporal.now;
    const next=temporal.events.find(e=>e.target==='service-radio');
    if(next?.id!==radioEvent?.id&&next)focus='radio';
    radioEvent=next;
    if(!active)return;
    time+=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
    nearVent=Number.isFinite(pose.x)&&Number.isFinite(pose.z)&&Math.hypot(pose.x-SPOKEN_ANCHORS.vent[0],pose.z-SPOKEN_ANCHORS.vent[2])<=2;
    if(nearVent&&!ventSuppressed){if(ventStart===null)ventStart=time;focus='vent';}else if(!nearVent){ventStart=null;ventSuppressed=false;if(focus==='vent')focus=null;}
  }
  function snapshot(){
    const voices:AcousticVoice[]=[];
    const age=radioEvent?now-radioEvent.at/1000:-1;
    const lampLit=!(age>=6&&age<9);
    let caption='';
    if(active){
      voices.push({id:'vent-fan',kind:'vent-fan',offset:time%2,loop:true,position:SPOKEN_ANCHORS.vent,gain:.18});
      voices.push({id:'receiver-hiss',kind:'receiver-hiss',offset:time%2,loop:true,position:SPOKEN_ANCHORS.radio,gain:.11});
      if(radioEvent&&radioEvent.id!==radioDismissed&&effects.has('radio_future')&&age>=1&&age<1+SPOKEN_DURATIONS.future)
        voices.push({id:`forecast-${radioEvent.id}`,kind:'spoken:future',offset:age-1,loop:false,position:SPOKEN_ANCHORS.radio,gain:.55});
    }
    if(focus==='radio'&&radioEvent){
      const journal=age<0?'Contact partagé en préparation.':age<6?'Bouton de test pressé ; lampe allumée.':age<9?'T+6 s : lampe éteinte.':'T+9 s : lampe rallumée.';
      caption=`Poste radio — ${effects.has('radio_future')&&age>=1?'« '+FUTURE_SENTENCE+' »':'souffle discret, aucune parole.'} Journal du relais : ${journal}`;
    }
    let spelled='';
    if(focus==='vent'){
      caption='Conduit V9 — ventilateur régulier, aucune parole.';
      if(consent&&effects.has('vent_whisper')&&ventStart!==null&&nearVent){
        const letters=[...name.toUpperCase()],duration=letters.reduce((a,c)=>a+SPOKEN_DURATIONS[c]+.18,0);
        const cycle=duration+4,elapsed=Math.max(0,time-ventStart-.5),n=Math.floor(elapsed/cycle),t=elapsed%cycle;
        let start=0;
        for(let i=0;i<letters.length;i++){
          const letter=letters[i],len=SPOKEN_DURATIONS[letter];
          if(time-ventStart>=.5&&t>=start){spelled+=letter===' '?' [espace] ':letter;}
          if(active&&time-ventStart>=.5&&t>=start&&t<start+len)voices.push({id:`vent-letter-${n}-${i}`,kind:`spoken:${letter}`,offset:t-start,loop:false,position:SPOKEN_ANCHORS.vent,gain:.28});
          start+=len+.18;
        }
        caption=`Conduit V9 — murmure épelé : ${spelled||'…'}.`; 
      }
    }
    return {key,active,voices,caption:level==='hotel'&&['reference','inspect'].includes(phase)?caption:'',lampLit,age,spelled};
  }
  return {setView,setIdentity,update,snapshot,stop(){focus=null;ventStart=null;ventSuppressed=true;radioDismissed=radioEvent?.id??'';}};
}
