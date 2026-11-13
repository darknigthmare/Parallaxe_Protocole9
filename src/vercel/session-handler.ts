// Vercel adapter: preserve the existing D1 request protocol and shared game rules.
import { createRoom,joinRoom,actRoom,authenticate,projectRoom,makePlayer,validateName,validateCode,SessionError,SESSION_TTL,upgradeRoom,type Room,type DecisionRejection } from '../game/session';
import type { Difficulty } from '../game/rules';
import {isLevelId} from '../game/levels';
import {makeRadioConfig,type IceSettings} from '../game/radio-config';

export type StoredRoom={code:string;version:number;data:string;updated_at:number;expires_at:number};
export type SessionStore={
  read(code:string):Promise<StoredRoom|null>;
  insert(row:StoredRoom):Promise<boolean>;
  compareAndSwap(row:StoredRoom,expectedVersion:number):Promise<boolean>;
  cleanupExpired?(now:number,limit:number):Promise<void>;
};
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};

async function tokenHash(token:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function secret(){return `${crypto.randomUUID()}${crypto.randomUUID()}`;}
function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(6));return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');}
function accessToken(request:Request){
  const value=request.headers.get('Authorization')??'';
  if(!/^Bearer [a-zA-Z0-9-]{32,128}$/.test(value))throw new SessionError('Votre accès à l’équipe est manquant.',401);
  return value.slice(7);
}
export function createSessionHandlers(store:SessionStore,settings:IceSettings={}){
async function read(code:string):Promise<StoredRoom>{
  const row=await store.read(code);
  if(!row||row.expires_at<Date.now())throw new SessionError('Équipe introuvable ou expirée. Vérifiez le code.',404);
  return row;
}
async function mutate(code:string,apply:(room:Room)=>Room):Promise<Room>{
  // The version predicate serializes simultaneous joins/votes instead of losing writes.
  for(let attempt=0;attempt<12;attempt++){
    const row=await read(code);
    const next=apply(upgradeRoom(JSON.parse(row.data) as Room));
    const now=Date.now();
    const changed=await store.compareAndSwap({code,version:row.version+1,data:JSON.stringify(next),updated_at:now,expires_at:now+SESSION_TTL},row.version);
    if(changed)return next;
  }
  throw new SessionError('Les communications sont occupées. Réessayez dans un instant.',409);
}
function failure(error:unknown):Response {
  if(error instanceof SessionError)return Response.json({error:error.message},{status:error.status,headers});
  console.error('Parallaxe session failed',error instanceof Error?error.message:'Unknown error');
  return Response.json({error:'La liaison coopérative est interrompue. Réessayez ; votre session reste conservée.'},{status:503,headers});
}
async function GET(request:Request){
  try{
    const code=validateCode(new URL(request.url).searchParams.get('code'));
    const hash=await tokenHash(accessToken(request));
    const row=await read(code);
    let room=upgradeRoom(JSON.parse(row.data) as Room);
    let self=authenticate(room,hash);
    const now=Date.now();
    if(new URL(request.url).searchParams.get('radioConfig')==='1')return Response.json(await makeRadioConfig(settings,self.id,now),{headers});
    // A five-second heartbeat is sufficient; ordinary state polls stay read-only.
    if(now-self.lastSeen>=5000){room=await mutate(code,current=>{const actor=authenticate(current,hash);return actRoom(current,actor.id,'ping',{},Date.now());});self=authenticate(room,hash);}
    return Response.json({state:projectRoom(room,self.id,Date.now())},{headers});
  }catch(error){return failure(error);}
}
async function POST(request:Request){
  try{
    if(Number(request.headers.get('Content-Length')??'0')>16384)throw new SessionError('Transmission trop longue.',413);
    const raw=await request.text();
    if(raw.length>16384)throw new SessionError('Transmission trop longue.',413);
    let payload:Record<string,unknown>;
    try{payload=JSON.parse(raw);}catch{throw new SessionError('Transmission illisible.');}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new SessionError('Transmission invalide.');
    const action=payload.action;
    if(action==='create'){
      const name=validateName(payload.name);
      const difficulty:Difficulty=payload.difficulty==='relaxed'?'relaxed':'standard';
      const token=secret();const hash=await tokenHash(token);const now=Date.now();
      const player=makePlayer(crypto.randomUUID(),name,hash,0,now);
      await store.cleanupExpired?.(now,25);
      for(let attempt=0;attempt<6;attempt++){
        const code=makeCode();const room=createRoom(code,player,difficulty,secret(),now,{mode:payload.mode==='single'?'single':'campaign',levelId:isLevelId(payload.levelId)?payload.levelId:'hotel'});
        const inserted=await store.insert({code,version:0,data:JSON.stringify(room),updated_at:now,expires_at:now+SESSION_TTL});
        if(inserted)return Response.json({code,token,selfId:player.id,state:projectRoom(room,player.id,now)},{status:201,headers});
      }
      throw new SessionError('Impossible de créer une équipe pour le moment.',503);
    }
    const code=validateCode(payload.code);
    if(action==='join'){
      const name=validateName(payload.name);
      const token=secret();const hash=await tokenHash(token);const now=Date.now();
      const player=makePlayer(crypto.randomUUID(),name,hash,0,now);
      const room=await mutate(code,current=>joinRoom(current,player));
      return Response.json({code,token,selfId:player.id,state:projectRoom(room,player.id,now)},{headers});
    }
    if(typeof action!=='string')throw new SessionError('Action manquante.');
    const hash=await tokenHash(accessToken(request));
    let selfId='';
    const decision:{rejection:DecisionRejection|null}={rejection:null};
    const room=await mutate(code,current=>{
      // A CAS retry must re-evaluate the original intention, never adopt a newer epoch.
      decision.rejection=null;
      const self=authenticate(current,hash);selfId=self.id;
      return actRoom(current,self.id,action,payload,Date.now(),rejection=>{decision.rejection=rejection;});
    });
    if(decision.rejection)return Response.json({error:decision.rejection.message,code:decision.rejection.code,state:projectRoom(room,selfId,Date.now())},{status:409,headers});
    if(action==='leave')return Response.json({left:true},{headers});
    return Response.json({state:projectRoom(room,selfId,Date.now())},{headers});
  }catch(error){return failure(error);}
}

return {GET,POST};
}
