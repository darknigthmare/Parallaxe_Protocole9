import { env } from 'cloudflare:workers';
import { createRoom,joinRoom,actRoom,authenticate,projectRoom,makePlayer,validateName,validateCode,SessionError,SESSION_TTL,upgradeRoom,type Room } from '../../../src/game/session';
import type { Difficulty } from '../../../src/game/rules';
import {isLevelId} from '../../../src/game/levels';
import {makeRadioConfig,type IceSettings} from '../../../src/game/radio-config';

export const dynamic='force-dynamic';
type StoredRoom={code:string;version:number;data:string;updated_at:number;expires_at:number};
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};

function db():D1Database {
  if(!env.DB)throw new SessionError('Le service coopératif est temporairement indisponible. Le mode solo reste jouable.',503);
  return env.DB;
}
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
async function read(code:string):Promise<StoredRoom>{
  const row=await db().prepare('SELECT code,version,data,updated_at,expires_at FROM parallaxe_sessions WHERE code = ?').bind(code).first<StoredRoom>();
  if(!row||row.expires_at<Date.now())throw new SessionError('Équipe introuvable ou expirée. Vérifiez le code.',404);
  return row;
}
async function mutate(code:string,apply:(room:Room)=>Room):Promise<Room>{
  // The version predicate serializes simultaneous joins/votes instead of losing writes.
  for(let attempt=0;attempt<12;attempt++){
    const row=await read(code);
    const next=apply(upgradeRoom(JSON.parse(row.data) as Room));
    const now=Date.now();
    const result=await db().prepare('UPDATE parallaxe_sessions SET data = ?, version = version + 1, updated_at = ?, expires_at = ? WHERE code = ? AND version = ?').bind(JSON.stringify(next),now,now+SESSION_TTL,code,row.version).run();
    if(result.meta.changes===1)return next;
  }
  throw new SessionError('Les communications sont occupées. Réessayez dans un instant.',409);
}
function failure(error:unknown):Response {
  if(error instanceof SessionError)return Response.json({error:error.message},{status:error.status,headers});
  console.error('Parallaxe session failed',error instanceof Error?error.message:'Unknown error');
  return Response.json({error:'La liaison coopérative est interrompue. Réessayez ; votre session reste conservée.'},{status:503,headers});
}
export async function GET(request:Request){
  try{
    const code=validateCode(new URL(request.url).searchParams.get('code'));
    const hash=await tokenHash(accessToken(request));
    const row=await read(code);
    let room=upgradeRoom(JSON.parse(row.data) as Room);
    let self=authenticate(room,hash);
    const now=Date.now();
    if(new URL(request.url).searchParams.get('radioConfig')==='1')return Response.json(await makeRadioConfig(env as unknown as IceSettings,self.id,now),{headers});
    // A five-second heartbeat is sufficient; ordinary state polls stay read-only.
    if(now-self.lastSeen>=5000){room=await mutate(code,current=>{const actor=authenticate(current,hash);return actRoom(current,actor.id,'ping',{},Date.now());});self=authenticate(room,hash);}
    return Response.json({state:projectRoom(room,self.id,Date.now())},{headers});
  }catch(error){return failure(error);}
}
export async function POST(request:Request){
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
      await db().prepare('DELETE FROM parallaxe_sessions WHERE code IN (SELECT code FROM parallaxe_sessions WHERE expires_at < ? LIMIT 25)').bind(now).run();
      for(let attempt=0;attempt<6;attempt++){
        const code=makeCode();const room=createRoom(code,player,difficulty,secret(),now,{mode:payload.mode==='single'?'single':'campaign',levelId:isLevelId(payload.levelId)?payload.levelId:'hotel'});
        const inserted=await db().prepare('INSERT OR IGNORE INTO parallaxe_sessions (code,version,data,updated_at,expires_at) VALUES (?,0,?,?,?)').bind(code,JSON.stringify(room),now,now+SESSION_TTL).run();
        if(inserted.meta.changes===1)return Response.json({code,token,selfId:player.id,state:projectRoom(room,player.id,now)},{status:201,headers});
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
    const room=await mutate(code,current=>{const self=authenticate(current,hash);selfId=self.id;return actRoom(current,self.id,action,payload,Date.now());});
    if(action==='leave')return Response.json({left:true},{headers});
    return Response.json({state:projectRoom(room,selfId,Date.now())},{headers});
  }catch(error){return failure(error);}
}
