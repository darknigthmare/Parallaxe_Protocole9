import type {IncomingMessage,ServerResponse} from 'node:http';
import {createSessionHandlers} from '../src/vercel/session-handler';
import {createSupabaseSessionStore} from '../src/vercel/supabase-store';

// Preserve the raw stream for the same strict JSON and 16 KiB checks as the
// portable/D1 targets instead of letting the platform consume it first.
export const config={api:{bodyParser:false}};

// This adapter is intentionally separate from the Cloudflare D1 and portable
// Node targets. The browser and authoritative game domain remain unchanged.
export default async function handler(incoming:IncomingMessage,outgoing:ServerResponse){
  const send=async(response:Response)=>{
    outgoing.statusCode=response.status;
    response.headers.forEach((value,key)=>outgoing.setHeader(key,value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  };
  const headers={'Cache-Control':'no-store, private','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
  if(!['GET','POST'].includes(incoming.method||'')){
    return send(Response.json({error:'Méthode non prise en charge.'},{status:405,headers:{...headers,Allow:'GET, POST'}}));
  }
  try{
    const url=process.env.SUPABASE_URL;
    const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
    const storeToken=process.env.PARALLAXE_STORE_TOKEN;
    if(!url||!publishableKey||!storeToken)return send(Response.json({error:'Le service coopératif est temporairement indisponible. Le mode solo reste jouable.'},{status:503,headers}));
    const chunks:Buffer[]=[];let bytes=0;
    if(incoming.method==='POST')for await(const chunk of incoming){
      const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buffer.length;
      if(bytes>16384)return send(Response.json({error:'Transmission trop longue.'},{status:413,headers}));
      chunks.push(buffer);
    }
    const requestHeaders=new Headers();
    for(const [key,value] of Object.entries(incoming.headers)){
      if(value!==undefined)requestHeaders.set(key,Array.isArray(value)?value.join(','):value);
    }
    const request=new Request(new URL(incoming.url||'/api/session','https://parallaxe.invalid'),{
      method:incoming.method,headers:requestHeaders,...(incoming.method==='POST'?{body:Buffer.concat(chunks).toString('utf8')}:{}),
    });
    const handlers=createSessionHandlers(createSupabaseSessionStore({url,publishableKey,storeToken}),{
      PARALLAXE_STUN_URLS:process.env.PARALLAXE_STUN_URLS,
      PARALLAXE_TURN_URLS:process.env.PARALLAXE_TURN_URLS,
      PARALLAXE_TURN_SECRET:process.env.PARALLAXE_TURN_SECRET,
    });
    return send(await handlers[incoming.method as 'GET'|'POST'](request));
  }catch{
    return send(Response.json({error:'La liaison coopérative est interrompue. Réessayez dans un instant.'},{status:503,headers}));
  }
}
