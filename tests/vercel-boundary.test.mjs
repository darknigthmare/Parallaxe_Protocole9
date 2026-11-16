/** Real Request/Response handlers and REST adapter; storage/network are doubles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

const root=new URL('../',import.meta.url);
const temporary=await mkdtemp(join(tmpdir(),'p9-vercel-boundary-'));
for(const group of ['game','vercel'])await mkdir(join(temporary,group));
for(const name of ['game/levels','game/catalog','game/rules','game/session','game/radio-config','vercel/session-handler','vercel/supabase-store']){
  const code=stripTypeScriptTypes(await readFile(new URL('src/'+name+'.ts',root),'utf8'))
    .replace(/from '((?:\.\.\/|\.\/)[^']+)'/g,"from '$1.mjs'");
  await writeFile(join(temporary,name+'.mjs'),code);
}
test.after(()=>rm(temporary,{recursive:true,force:true}));
const {createSessionHandlers}=await import(pathToFileURL(join(temporary,'vercel/session-handler.mjs')));
const {createSupabaseSessionStore}=await import(pathToFileURL(join(temporary,'vercel/supabase-store.mjs')));
const settings={url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture',storeToken:'a'.repeat(64)};
const post=raw=>new Request('https://game.invalid/api/session',{method:'POST',body:raw});
function storeDouble(){
  const rows=new Map();let writes=0;
  return {rows,get writes(){return writes;},read:async code=>structuredClone(rows.get(code)??null),
    insert:async row=>{writes++;if(rows.has(row.code))return false;rows.set(row.code,structuredClone(row));return true;},
    compareAndSwap:async(row,version)=>{writes++;if(rows.get(row.code)?.version!==version)return false;rows.set(row.code,structuredClone(row));return true;}};
}
function privateHeaders(response){assert.equal(response.headers.get('Cache-Control'),'no-store, private');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');}

test('REST parsing never includes provider bodies in error messages',async()=>{
  const store=createSupabaseSessionStore({...settings,request:async()=>new Response('PROVIDER_SECRET_DO_NOT_LOG invalid JSON',{status:200})});
  await assert.rejects(()=>store.read('ABC234'),error=>{
    assert.doesNotMatch(error.message,/PROVIDER_S/);
    assert.equal(error.message,'Réponse du stockage de session illisible.');return true;
  });
});
test('REST requests refuse redirects and retain a bounded no-store request',async()=>{
  const store=createSupabaseSessionStore({...settings,request:async(_url,options)=>{
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.ok(options.signal instanceof AbortSignal);assert.equal(options.signal.aborted,false);
    return Response.json(null);
  }});assert.equal(await store.read('ABC234'),null);
});
test('unexpected provider errors are redacted both from HTTP and server logs',async()=>{
  const captured=[],previous=console.error;console.error=(...args)=>captured.push(args.join(' '));
  try{
    const handlers=createSessionHandlers({...storeDouble(),insert:async()=>{throw new Error('TOKEN_PRIVATE_STATE_DO_NOT_LOG');}});
    const response=await handlers.POST(post(JSON.stringify({action:'create',name:'QA Boundary'})));
    assert.equal(response.status,503);privateHeaders(response);
    assert.doesNotMatch(await response.text(),/TOKEN_PRIVATE_STATE_DO_NOT_LOG/);
    assert.doesNotMatch(captured.join('\n'),/TOKEN_PRIVATE_STATE_DO_NOT_LOG/);
  }finally{console.error=previous;}
});
test('the handler enforces the body limit in UTF-8 bytes, not code units',async()=>{
  const raw=JSON.stringify({action:'create',name:'QA Bytes',padding:'é'.repeat(9000)});
  assert.ok(raw.length<16384&&Buffer.byteLength(raw)>16384);
  const store=storeDouble(),response=await createSessionHandlers(store).POST(post(raw));
  assert.equal(response.status,413);privateHeaders(response);assert.equal(store.writes,0);
});
test('malformed JSON, arrays and primitive bodies never reach storage',async()=>{
  for(const raw of ['{','[]','null','7','true','"create"']){
    const store=storeDouble(),response=await createSessionHandlers(store).POST(post(raw));
    assert.equal(response.status,400,raw);privateHeaders(response);assert.equal(store.writes,0);
  }
});
test('private projections keep the new observatory playable without exposing server truth',async()=>{
  const store=storeDouble(),handlers=createSessionHandlers(store);
  const response=await handlers.POST(post(JSON.stringify({action:'create',name:'QA Observatory',mode:'single',levelId:'observatory'})));
  assert.equal(response.status,201);privateHeaders(response);
  const created=await response.json();assert.equal(created.state.levelId,'observatory');
  const persisted=JSON.parse(store.rows.get(created.code).data);
  assert.ok(persisted.run.seed&&persisted.players[0].tokenHash);
  const publicState=JSON.stringify(created.state);
  assert.ok(!publicState.includes(persisted.run.seed));assert.ok(!publicState.includes(persisted.players[0].tokenHash));
  const unauthorized=await handlers.GET(new Request('https://game.invalid/api/session?code='+created.code));
  assert.equal(unauthorized.status,401);privateHeaders(unauthorized);
});
test('expiry is exclusive at the exact TTL boundary',async()=>{
  const store=storeDouble(),handlers=createSessionHandlers(store);
  const created=await (await handlers.POST(post(JSON.stringify({action:'create',name:'QA Expiry'})))).json();
  const now=Date.now(),previous=Date.now;store.rows.get(created.code).expires_at=now;Date.now=()=>now;
  try{
    const response=await handlers.GET(new Request('https://game.invalid/api/session?code='+created.code,{headers:{Authorization:'Bearer '+created.token}}));
    assert.equal(response.status,404);privateHeaders(response);
  }finally{Date.now=previous;}
});
test('unsupported REST rows and write replies are rejected instead of accepted as success',async()=>{
  for(const raw of [true,[],{code:'ABC234',version:-1},{code:'WRONG2',version:0,data:'{}',updated_at:1,expires_at:2}]){
    const store=createSupabaseSessionStore({...settings,request:async()=>Response.json(raw)});
    await assert.rejects(()=>store.read('ABC234'));
  }
  const store=createSupabaseSessionStore({...settings,request:async()=>Response.json('true')});
  await assert.rejects(()=>store.insert({code:'ABC234',version:0,data:'{}',updated_at:1,expires_at:2}));
});
