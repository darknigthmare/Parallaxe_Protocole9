import { createRun, advanceRun, evaluateRun, getPersonalView,migrateRun, type Difficulty, type Run } from './rules';
import {isLevelId,type LevelId,type GameMode} from './levels';

export const PRESENCE_TIMEOUT=45_000;
export const SESSION_TTL=12*60*60*1000;
export const TARGETS=['clock','portrait','door','plant','trolley','light','radio','mirror','exit','chair','ceiling','floor','phone','window','player','train','signal','tracks','bed','monitor','curtain','wheelchair','iv','assignment','luggage','document','newspaper','hourglass','cup','keys','guestbook','glove','weather-photo','team-photo','floor-map','regulations','occupancy','table','fireplace','coat','extinguisher','stars','aged-photo','landing','music-box','bell','vase','witness-door','listening-mannequin','lift','service-radio','vent'];
export type PropTarget='bell'|'vase'|'witness-door'|'listening-mannequin'|'lift'|'service-radio';
export type PropEvent={id:string;target:PropTarget;at:number;sequence:number;actorId:string;x:number;z:number};
export const PROP_ANCHORS:Record<PropTarget,readonly [number,number]>={bell:[1.95,7.95],vase:[-3.30,-4.10],'witness-door':[3.22,11.10],'listening-mannequin':[3.20,-14.00],lift:[-2.45,-15.65],'service-radio':[-3.20,7.35]};
const PROP_WAIT:Record<PropTarget,number>={bell:8000,vase:4000,'witness-door':8000,'listening-mannequin':2000,lift:14000,'service-radio':12000};
export const SIGNAL_TTL=60_000;
export type RadioSignal={id:string;from:string;to:string;fromEpoch:string;toEpoch:string;at:number;description?:{type:'offer'|'answer';sdp:string};candidate?:{candidate:string;sdpMid:string|null;sdpMLineIndex:number|null;usernameFragment?:string|null}|null;reset?:boolean};
export type Pose={x:number;y:number;z:number;yaw:number;pitch:number};
export type Player={namedVoiceConsent?:boolean;id:string;name:string;slot:number;tokenHash:string;lastSeen:number;left:boolean;vote:boolean|null;pose:Pose;radioEnabled:boolean;radioEpoch:string;talking:boolean;radioTalkAt:number};
export type RoomMessage={id:string;senderId:string;name:string;text:string;at:number};
export type RoomPing={id:string;name:string;target:string;at:number};
export type Room={code:string;hostId:string;started:boolean;run:Run;players:Player[];messages:RoomMessage[];pings:RoomPing[];createdAt:number;revision:number;decisionEpoch:number;decisionPaused:boolean;signals:RadioSignal[];propEvents?:PropEvent[]};
export type DecisionRejection={code:'INVALID_DECISION_CONTEXT'|'STALE_DECISION_CONTEXT';message:string};

export class SessionError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status;}
}
export function activePlayers(room:Room,now:number):Player[] {
  return room.players.filter(p=>!p.left&&now-p.lastSeen<PRESENCE_TIMEOUT);
}
/** A queued negotiation belongs to two live, explicitly enabled radio epochs. */
function currentRadioSignals(room:Room,now:number):RadioSignal[] {
  return room.signals.filter(signal=>{
    if(!Number.isFinite(signal.at)||signal.at>now||now-signal.at>=SIGNAL_TTL)return false;
    const from=room.players.find(p=>p.id===signal.from&&!p.left);
    const to=room.players.find(p=>p.id===signal.to&&!p.left);
    return !!from&&!!to&&from.id!==to.id&&from.radioEnabled&&to.radioEnabled
      &&from.radioEpoch!==''&&to.radioEpoch!==''
      &&from.radioEpoch===signal.fromEpoch&&to.radioEpoch===signal.toEpoch
      &&now-from.lastSeen<PRESENCE_TIMEOUT&&now-to.lastSeen<PRESENCE_TIMEOUT;
  });
}

/** Invalidate before refreshing presence, even when every vote is still in flight. */
function invalidateInterruptedBallot(room:Room,now:number):void {
  if(!room.started||room.run.phase!=='inspect'){room.decisionPaused=false;return;}
  const present=room.players.filter(p=>!p.left);
  if(room.decisionPaused||!present.some(p=>now-p.lastSeen>=PRESENCE_TIMEOUT))return;
  room.decisionPaused=true;
  room.decisionEpoch++;
  room.players.forEach(p=>p.vote=null);
  room.messages.push({id:crypto.randomUUID(),senderId:'control',name:'CONTRÔLE',
    text:'La liaison d’un inspecteur a été interrompue. Les diagnostics ont été annulés : comparez de nouveau vos observations au retour de toute l’équipe.',at:now});
  room.messages=room.messages.slice(-40);
}

export function validateName(value:unknown):string {
  if(typeof value!=='string')throw new SessionError('Choisissez un nom d’inspecteur.');
  const name=value.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,24);
  if(!name)throw new SessionError('Choisissez un nom d’inspecteur.');
  return name;
}
export function validateCode(value:unknown):string {
  const code=typeof value==='string'?value.toUpperCase().trim():'';
  if(!/^[A-Z2-9]{6}$/.test(code))throw new SessionError('Le code comporte six lettres ou chiffres.');
  return code;
}
export function cleanPose(value:unknown):Pose {
  if(!value||typeof value!=='object')throw new SessionError('Position invalide.');
  const p=value as Record<string,unknown>;
  const values=['x','y','z','yaw','pitch'].map(k=>p[k]);
  if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new SessionError('Position invalide.');
  return {x:Math.max(-3.8,Math.min(3.8,p.x as number)),y:Math.max(0,Math.min(4,p.y as number)),z:Math.max(-16,Math.min(12,p.z as number)),yaw:(p.yaw as number)%(Math.PI*2),pitch:Math.max(-1.5,Math.min(1.5,p.pitch as number))};
}
export function makePlayer(id:string,name:string,tokenHash:string,slot:number,now:number,namedVoiceConsent=false):Player {
  if(namedVoiceConsent===true&&!/^[A-Za-z0-9 _-]{1,24}$/.test(name))throw new SessionError("Pour l’épellation locale, utilisez un indicatif de 1 à 24 lettres A–Z, chiffres, espaces ou tirets.");
  return {id,name,tokenHash,slot,namedVoiceConsent:namedVoiceConsent===true,lastSeen:now,left:false,vote:null,pose:{x:(slot-1.5)*0.65,y:1.65,z:9,yaw:0,pitch:0},radioEnabled:false,radioEpoch:'',talking:false,radioTalkAt:0};
}
export function createRoom(code:string,host:Player,difficulty:Difficulty,seed:string,now:number,options:{mode?:GameMode;levelId?:LevelId}={}):Room {
  return {code,hostId:host.id,started:false,run:createRun({seed,difficulty,players:2,...options}),players:[host],messages:[],pings:[],createdAt:now,revision:0,decisionEpoch:0,decisionPaused:false,signals:[]};
}
export function upgradeRoom(room:Room):Room {
  return {...room,propEvents:Array.isArray(room.propEvents)?room.propEvents.filter(e=>e&&Object.hasOwn(PROP_ANCHORS,e.target)&&typeof e.id==='string'&&Number.isFinite(e.at)&&Number.isSafeInteger(e.sequence)&&e.sequence>0&&Number.isFinite(e.x)&&Number.isFinite(e.z)).slice(-Object.keys(PROP_ANCHORS).length):[],decisionEpoch:Number.isSafeInteger(room.decisionEpoch)&&room.decisionEpoch>=0?room.decisionEpoch:0,decisionPaused:room.decisionPaused===true,run:{...(migrateRun(room.run)??createRun({seed:`recovered:${room.createdAt}`,mode:'single'})),namedVoiceAllowed:room.players.filter(p=>!p.left).length>=2&&room.players.filter(p=>!p.left).every(p=>p.namedVoiceConsent===true)},signals:Array.isArray(room.signals)?room.signals:[],players:room.players.map(p=>({...p,namedVoiceConsent:p.namedVoiceConsent===true,radioEnabled:p.radioEnabled===true,radioEpoch:typeof p.radioEpoch==='string'?p.radioEpoch:'',talking:p.talking===true,radioTalkAt:p.radioTalkAt??0}))};
}

export function validateSignal(room:Room,actor:Player,payload:Record<string,unknown>,now:number):RadioSignal {
  const signal=payload.signal as Record<string,unknown>|undefined;
  if(!signal||typeof signal!=='object'||Array.isArray(signal))throw new SessionError('Signal radio invalide.');
  const target=room.players.find(p=>p.id===signal.to&&!p.left);
  if(!target||target.id===actor.id)throw new SessionError('Destinataire radio invalide.',403);
  if(!actor.radioEnabled||!target.radioEnabled||signal.epoch!==actor.radioEpoch||signal.toEpoch!==target.radioEpoch)throw new SessionError('La liaison radio a été renouvelée. Réessayez.',409);
  if(now-target.lastSeen>=PRESENCE_TIMEOUT)throw new SessionError('Le destinataire radio est déconnecté.',409);
  const result:RadioSignal={id:crypto.randomUUID(),from:actor.id,to:target.id,fromEpoch:actor.radioEpoch,toEpoch:target.radioEpoch,at:now};
  const count=Number('description'in signal)+Number('candidate'in signal)+Number(signal.reset===true);
  if(count!==1)throw new SessionError('Un seul type de signal est autorisé.');
  if('description'in signal){
    const d=signal.description as {type?:unknown;sdp?:unknown}|null;
    if(!d||!['offer','answer'].includes(String(d.type))||typeof d.sdp!=='string'||d.sdp.length<1||d.sdp.length>16000)throw new SessionError('Description radio invalide.');
    result.description={type:d.type as 'offer'|'answer',sdp:d.sdp};
  }else if('candidate'in signal){
    if(signal.candidate===null)result.candidate=null;
    else{
      const c=signal.candidate as Record<string,unknown>;
      if(!c||typeof c.candidate!=='string'||c.candidate.length>2048||(c.sdpMid!==null&&typeof c.sdpMid!=='string')||(c.sdpMLineIndex!==null&&(!Number.isInteger(c.sdpMLineIndex)||(c.sdpMLineIndex as number)<0||(c.sdpMLineIndex as number)>32)))throw new SessionError('Candidat réseau invalide.');
      result.candidate={candidate:c.candidate,sdpMid:typeof c.sdpMid==='string'?c.sdpMid.slice(0,128):null,sdpMLineIndex:c.sdpMLineIndex as number|null,...(typeof c.usernameFragment==='string'?{usernameFragment:c.usernameFragment.slice(0,128)}:{})};
    }
  }else result.reset=true;
  return result;
}
function scheduleProp(room:Room,actor:Player,target:PropTarget,id:string,now:number):void {
  const existing=room.propEvents?.find(e=>e.target===target);
  if(existing?.id===id)return;
  if(existing&&now<existing.at+PROP_WAIT[target])throw new SessionError('Laissez le geste se terminer avant de recommencer.',429);
  if((existing?.sequence??0)>=1_000_000)throw new SessionError('Limite de gestes atteinte pour ce passage.',429);
  const sequence=(existing?.sequence??0)+1;
  room.propEvents=[...(room.propEvents??[]).filter(e=>e.target!==target),{id,target,at:now+650,sequence,actorId:actor.id,x:actor.pose.x,z:actor.pose.z}];
}
export function joinRoom(room:Room,player:Player):Room {
  if(room.started)throw new SessionError('Cette inspection a déjà commencé. Rejoignez une nouvelle équipe.',409);
  const occupied=room.players.filter(p=>!p.left&&player.lastSeen-p.lastSeen<PRESENCE_TIMEOUT);
  if(occupied.length>=4)throw new SessionError('Cette équipe compte déjà quatre inspecteurs.',409);
  const available=[0,1,2,3].find(slot=>!occupied.some(p=>p.slot===slot))!;
  const next=structuredClone(upgradeRoom(room));
  next.players=next.players.filter(p=>occupied.some(o=>o.id===p.id));
  next.players.push({...player,slot:available});
  if(!next.players.some(p=>p.id===next.hostId))next.hostId=next.players[0].id;
  next.revision++;
  return next;
}
export function authenticate(room:Room,tokenHash:string):Player {
  const player=room.players.find(p=>p.tokenHash===tokenHash);
  if(!player||player.left)throw new SessionError('Votre accès à cette équipe a expiré. Rejoignez une nouvelle session.',401);
  return player;
}
function evaluateConsensus(room:Room,now:number):void {
  if(!room.started||room.run.phase!=='inspect')return;
  const active=activePlayers(room,now);
  // A disconnected partner cannot silently turn cooperation into a solo answer.
  if(active.length<2)return;
  // A missing witness may hold the only evidence. Do not score behind their back.
  if(active.length!==room.players.filter(p=>!p.left).length)return;
  if(active.every(p=>p.vote!==null)&&active.every(p=>p.vote===active[0].vote)){
    room.run=evaluateRun(room.run,active[0].vote!);
    room.decisionEpoch++;
    room.decisionPaused=false;
  }
}
/** Persist the returned room before reporting a decision rejection to the client.
 * Throwing for an obsolete decision would discard timeout cleanup on both backends.
 */
export function actRoom(room:Room,playerId:string,action:string,payload:Record<string,unknown>,now:number,onDecisionRejected?:(rejection:DecisionRejection)=>void):Room {
  const next=structuredClone(upgradeRoom(room));
  // Prune before the heartbeat: reconnection must not revive an obsolete offer.
  next.signals=currentRadioSignals(next,now);
  next.pings=next.pings.filter(p=>p.at<=now&&now-p.at<15_000).slice(-8);
  next.revision++;
  const actor=next.players.find(p=>p.id===playerId&&!p.left);
  if(!actor)throw new SessionError('Inspecteur introuvable.',401);
  invalidateInterruptedBallot(next,now);
  const host=next.players.find(p=>p.id===next.hostId&&!p.left);
  // Elect from witnesses already present, before a returning host refreshes itself.
  if(!host||now-host.lastSeen>=PRESENCE_TIMEOUT)next.hostId=activePlayers(next,now).sort((a,b)=>a.slot-b.slot)[0]?.id??actor.id;
  actor.lastSeen=now;
  if(next.decisionPaused&&!next.players.some(p=>!p.left&&now-p.lastSeen>=PRESENCE_TIMEOUT))next.decisionPaused=false;
  if(action==='start'||action==='next'||action==='vote'||action==='prop'){
    const expected=payload.decisionEpoch;
    if(typeof expected!=='number'||!Number.isSafeInteger(expected)||expected<0){
      onDecisionRejected?.({code:'INVALID_DECISION_CONTEXT',message:'Votre inspection doit être actualisée. Vérifiez le passage affiché avant de confirmer de nouveau.'});
      return next;
    }
    if(expected!==next.decisionEpoch){
      onDecisionRejected?.({code:'STALE_DECISION_CONTEXT',message:'L’inspection ou l’équipe a changé. Comparez de nouveau vos observations avant de confirmer.'});
      return next;
    }
  }
  if(action==='start'){
    if(actor.id!==next.hostId)throw new SessionError('Seul le chef d’équipe lance le protocole.',403);
    if(next.started&&!['won','lost'].includes(next.run.phase))return next;
    const active=activePlayers(next,now).sort((a,b)=>a.slot-b.slot);
    if(active.length<2)throw new SessionError('Deux inspecteurs présents sont nécessaires. Le mode solo reste disponible.',409);
    next.players=active.map((p,slot)=>({...p,slot,vote:null}));
    next.run=createRun({seed:`${next.run.seed}:start:${now}`,difficulty:next.run.difficulty,players:active.length,namedVoiceAllowed:active.every(p=>p.namedVoiceConsent===true),mode:next.run.mode,levelId:next.run.levelId});
    next.started=true;next.propEvents=[];
    next.decisionEpoch++;
    next.decisionPaused=false;
    next.pings=[];
  }else if(action==='next'){
    if(actor.id!==next.hostId)throw new SessionError('Le chef d’équipe ouvre le passage suivant.',403);
    if(!next.started)throw new SessionError('Lancez le protocole avant de continuer.',409);
    if(activePlayers(next,now).length<2)throw new SessionError('En attente du retour d’un second inspecteur.',409);
    if(activePlayers(next,now).length!==next.players.filter(p=>!p.left).length)throw new SessionError('Un inspecteur est déconnecté. Le protocole attend son retour.',409);
    if(next.run.phase==='reference'||next.run.phase==='reveal'){
      const remaining=next.players.filter(p=>!p.left).sort((a,b)=>a.slot-b.slot);
      next.run=advanceRun({...next.run,players:remaining.length,namedVoiceAllowed:remaining.every(p=>p.namedVoiceConsent===true)});next.propEvents=[];
      next.run.observerSlots=next.run.observerSlots.map(index=>remaining[index].slot);
      next.players.forEach(p=>p.vote=null);
      next.decisionEpoch++;
      next.decisionPaused=false;
      next.pings=[];
    }
  }else if(action==='vote'){
    if(typeof payload.vote!=='boolean')throw new SessionError('Le diagnostic doit être « anomalie » ou « conforme ».');
    if(!next.started||next.run.phase!=='inspect')return next;
    // Do not bank a decision while the only witness might be absent.
    const active=activePlayers(next,now);
    if(active.length<2||active.length!==next.players.filter(p=>!p.left).length)return next;
    actor.vote=payload.vote;
  }else if(action==='prop'){
    if(!next.started||next.run.levelId!=='hotel'||!['reference','inspect'].includes(next.run.phase))throw new SessionError('Ce support est indisponible dans ce passage.',409);
    if(typeof payload.target!=='string'||!Object.hasOwn(PROP_ANCHORS,payload.target))throw new SessionError('Support inconnu.');
    if(typeof payload.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,64}$/.test(payload.requestId))throw new SessionError('Identifiant du geste invalide.');
    const target=payload.target as PropTarget,anchor=PROP_ANCHORS[target];
    if(Math.hypot(actor.pose.x-anchor[0],actor.pose.z-anchor[1])>3.6)throw new SessionError('Approchez-vous du support avant de le manipuler.',403);
    if(next.decisionPaused||activePlayers(next,now).length<2)throw new SessionError('Attendez le retour de votre équipe.',409);
    const previous=next.propEvents?.find(e=>e.target===target),id=actor.id+':'+payload.requestId;
    if(previous?.id===id)return next;
    if(!Number.isSafeInteger(payload.expectedSequence)||payload.expectedSequence!==(previous?.sequence??0))throw new SessionError('Le support a déjà été manipulé. Vérifiez son état avant de recommencer.',409);
    if(activePlayers(next,now).length!==next.players.filter(p=>!p.left).length)throw new SessionError('Attendez le retour de votre équipe.',409);
    scheduleProp(next,actor,target,id,now);
  }else if(action==='revoke-named-voice'){
    // Irreversible for this membership: stale packets can never grant permission.
    // Always reset a live observation, regardless of the hidden current case.
    if(actor.namedVoiceConsent!==true)return next;
    actor.namedVoiceConsent=false;next.run.namedVoiceAllowed=false;
    if(next.started&&['reference','inspect'].includes(next.run.phase)){
      next.run={...next.run,phase:'reference',loop:next.run.loop+1,currentAnomalyId:null,observerSlots:[],lastResult:null};
      next.decisionEpoch++;next.propEvents=[];next.pings=[];next.players.forEach(p=>p.vote=null);
      next.messages.push({id:crypto.randomUUID(),senderId:'control',name:'CONTRÔLE',text:'Autorisation d’épellation retirée. Retour à la référence sans pénalité ; aucune indication sur le cas précédent.',at:now});next.messages=next.messages.slice(-40);
    }
  }else if(action==='pose'){
    actor.pose=cleanPose(payload.pose);
  }else if(action==='chat'){
    const text=typeof payload.message==='string'?payload.message.replace(/[\u0000-\u001f]/g,'').trim().slice(0,240):'';
    if(!text)throw new SessionError('Le message est vide.');
    const last=next.messages.filter(m=>m.senderId===actor.id).at(-1);
    if(last&&now-last.at<600)throw new SessionError('Attendez un instant avant de transmettre.',429);
    next.messages.push({id:crypto.randomUUID(),senderId:actor.id,name:actor.name,text,at:now});
    next.messages=next.messages.slice(-40);
    // A text message is a consented signal, never a microphone analysis. Only the
    // public speaker location is shared; head orientation remains private.
    if(next.started&&next.run.levelId==='hotel'&&['reference','inspect'].includes(next.run.phase)){
      const old=next.propEvents?.find(e=>e.target==='listening-mannequin');
      if(!old||now>=old.at+PROP_WAIT['listening-mannequin'])scheduleProp(next,actor,'listening-mannequin',next.messages.at(-1)!.id,now);
    }
  }else if(action==='ping'){
    if(payload.target!==undefined){
      if(typeof payload.target!=='string'||!TARGETS.includes(payload.target))throw new SessionError('Repère inconnu.');
      next.pings.push({id:crypto.randomUUID(),name:actor.name,target:payload.target,at:now});
      next.pings=next.pings.filter(p=>now-p.at<15_000).slice(-8);
    }
  }else if(action==='radio-status'){
    if(typeof payload.enabled!=='boolean')throw new SessionError('État radio invalide.');
    if(payload.enabled){
      if(typeof payload.epoch!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(payload.epoch))throw new SessionError('Identité radio invalide.');
      // Only an explicit activation may replace a session; a retiring PTT packet cannot reclaim it.
      if((!actor.radioEnabled||actor.radioEpoch!==payload.epoch)&&payload.activate!==true)return next;
      if(actor.radioEpoch!==payload.epoch)next.signals=next.signals.filter(s=>s.from!==actor.id&&s.to!==actor.id);
      actor.radioEpoch=payload.epoch;actor.radioEnabled=true;actor.talking=payload.talking===true;actor.radioTalkAt=now;
    }else{if(actor.radioEnabled&&payload.epoch!==actor.radioEpoch)return next;actor.radioEnabled=false;actor.radioEpoch='';actor.talking=false;actor.radioTalkAt=now;next.signals=next.signals.filter(s=>s.from!==actor.id&&s.to!==actor.id);}
  }else if(action==='signal'){
    if(next.signals.filter(s=>s.from===actor.id&&now-s.at<10_000).length>=100)throw new SessionError('La radio négocie encore sa connexion. Réessayez.',429);
    const signal=validateSignal(next,actor,payload,now);
    if(next.signals.length>=192||JSON.stringify(next.signals).length+JSON.stringify(signal).length>128_000)throw new SessionError('La file radio est occupée. Réessayez.',429);
    next.signals.push(signal);
  }else if(action==='signal-ack'){
    if(!Array.isArray(payload.ids)||payload.ids.length>128||payload.ids.some(id=>typeof id!=='string'||id.length>80))throw new SessionError('Accusé radio invalide.');
    const ids=new Set(payload.ids);
    next.signals=next.signals.filter(s=>s.to!==actor.id||!ids.has(s.id));
  }else if(action==='leave'){
    next.decisionEpoch++;
    actor.left=true;actor.vote=null;actor.radioEnabled=false;actor.talking=false;actor.radioEpoch='';
    if(!next.players.some(p=>!p.left&&now-p.lastSeen>=PRESENCE_TIMEOUT))next.decisionPaused=false;
    next.signals=next.signals.filter(s=>s.to!==actor.id&&s.from!==actor.id);
    if(actor.id===next.hostId)next.hostId=activePlayers(next,now).sort((a,b)=>a.slot-b.slot)[0]?.id??'';
    if(next.started&&next.run.phase==='inspect'){
      const remaining=next.players.filter(p=>!p.left);
      next.run.observerSlots=next.run.observerSlots.filter(slot=>remaining.some(p=>p.slot===slot));
      if(next.run.currentAnomalyId&&next.run.observerSlots.length===0&&remaining.length)next.run.observerSlots=[remaining[0].slot];
      // If two original witnesses remain as the final pair, keep one baseline view.
      if(remaining.length>=2&&next.run.observerSlots.length>=remaining.length)next.run.observerSlots=next.run.observerSlots.slice(0,remaining.length-1);
      next.players.forEach(p=>p.vote=null);
      next.messages.push({id:crypto.randomUUID(),senderId:'control',name:'CONTRÔLE',text:'Un inspecteur a quitté l’équipe. Vérifiez de nouveau vos perceptions avant de voter.',at:now});
      next.messages=next.messages.slice(-40);
    }
  }else{
    throw new SessionError('Action inconnue.');
  }
  evaluateConsensus(next,now);
  return next;
}

/** Only this projection may cross the network: no seed, answer, peer effect or token. */
export function projectRoom(room:Room,playerId:string,now:number){
  room=upgradeRoom(room);
  const self=room.players.find(p=>p.id===playerId&&!p.left);
  if(!self)throw new SessionError('Inspecteur introuvable.',401);
  const phase=room.started?room.run.phase:'lobby';
  const last=['reveal','won','lost'].includes(phase)?room.run.lastResult:null;
  const active=activePlayers(room,now);
  const paused=room.started&&(active.length<2||active.length!==room.players.filter(p=>!p.left).length);
  return {
    code:room.code,selfId:playerId,hostId:room.hostId,phase,revision:room.revision,decisionEpoch:room.decisionEpoch,
    streak:room.run.streak,strikes:room.run.strikes,loop:room.run.loop,
    difficulty:room.run.difficulty,correctTotal:room.run.correctTotal,
    mode:room.run.mode,levelId:room.run.levelId,stage:room.run.stage,stageProgress:room.run.stageProgress,schemaVersion:2,
    paused,
    players:room.players.filter(p=>!p.left).map(p=>({id:p.id,name:p.name,namedVoiceConsent:p.namedVoiceConsent===true,slot:p.slot,connected:now-p.lastSeen<PRESENCE_TIMEOUT,vote:paused&&phase==='inspect'?null:p.vote,pose:p.pose,radioEnabled:p.radioEnabled,radioEpoch:p.radioEpoch,talking:p.radioEnabled&&p.talking&&now-p.lastSeen<PRESENCE_TIMEOUT&&p.radioTalkAt<=now&&now-p.radioTalkAt<10_000})),
    view:room.started?getPersonalView(room.run,self.slot):{effects:[],variant:0,phase:'lobby' as const,loop:0,relayCode:'3142',levelId:room.run.levelId,arrowDirection:'left' as const,syncTime:'03:09'},
    radioInbox:currentRadioSignals(room,now).filter(s=>s.to===self.id),
    messages:room.messages,
    pings:room.pings.filter(p=>now-p.at<15_000),
    reveal:last?{correct:last.correct,hasAnomaly:last.hasAnomaly,title:last.title,description:last.description,anomalyId:last.anomalyId,observerNames:room.players.filter(p=>last.observerSlots.includes(p.slot)).map(p=>p.name)}:null,
    propEvents:room.started&&room.run.levelId==='hotel'&&['reference','inspect'].includes(phase)?(room.propEvents??[]).map(e=>({id:e.id,target:e.target,at:e.at,sequence:e.sequence,actorId:e.actorId,x:e.x,z:e.z})):[],
    serverTime:now,
  };
}
export type PublicRoom=ReturnType<typeof projectRoom>;
