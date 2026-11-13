import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';

// The real Vercel HTTP adapter and shared domain run here. The REST/database
// service is a CAS double; production persistence is verified separately.
const project=dirname(dirname(fileURLToPath(import.meta.url)));
const temporary=await mkdtemp(join(tmpdir(),'parallaxe-vercel-'));
for(const file of ['src/vercel/supabase-store']){
  const target=join(temporary,`${file}.mjs`);
  await mkdir(dirname(target),{recursive:true});
  const source=stripTypeScriptTypes(await readFile(join(project,`${file}.ts`),'utf8'))
    .replace(/from '(\.[^']+)'/g,"from '$1.mjs'");
  await writeFile(target,source);
}
test.after(()=>rm(temporary,{recursive:true,force:true}));
const {createSupabaseSessionStore}=await import(pathToFileURL(join(temporary,'src/vercel/supabase-store.mjs')));
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/build-vercel.mjs','--server-only'],{cwd:project,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(output)));
});
// Load exactly the CommonJS entry and compiled artifact packaged by Vercel.
// The earlier source-only fixture did not detect native ESM import failures.
const handler=createRequire(import.meta.url)('../api/session.js');
const token='a'.repeat(64),key='sb_publishable_fixture',url='https://fixture.supabase.co';

function rpcDouble({injectConflict=false}={}){
  const rows=new Map(),calls=[];let conflicts=0;
  return {rows,calls,get conflicts(){return conflicts;},request:async(input,options)=>{
    const target=new URL(input);assert.equal(target.origin,url);
    assert.equal(options.headers.apikey,key);
    assert.equal(options.headers.Authorization,undefined,'publishable keys are not bearer JWTs');
    assert.equal(options.cache,'no-store');
    const body=JSON.parse(options.body);assert.equal(body.p_store_token,token);
    calls.push({name:target.pathname,body});
    const name=target.pathname.replace('/rest/v1/rpc/parallaxe_web_','');
    let row=rows.get(body.p_code);
    if(name==='read')return Response.json(row&&row.expires_at>Date.now()?structuredClone(row):null);
    // An unrelated writer wins once between read and CAS. Domain state stays
    // identical, but the request must reload and retain its original intention.
    if(name==='cas'&&injectConflict&&row){
      injectConflict=false;row={...row,version:row.version+1};rows.set(row.code,row);
    }
    const {p_code:code,p_version:version,p_data:data,p_updated_at:updated_at,p_expires_at:expires_at}=body;
    assert.equal(typeof data,'string','RPC persists the existing StoredRoom TEXT format');
    const accepted=name==='insert'?!row:!!row&&row.version===body.p_expected_version&&row.expires_at>Date.now();
    if(name==='cas'){
      assert.equal(version,body.p_expected_version+1);
      if(!accepted)conflicts++;
    }else assert.equal(name,'insert');
    if(accepted)rows.set(code,{code,version,data,updated_at,expires_at});
    return Response.json(accepted);
  }};
}

test('Supabase REST store persists across instances, rejects stale writes and hides provider failures',async()=>{
  const fixture=rpcDouble();const settings={url,publishableKey:key,storeToken:token,request:fixture.request};
  const first=createSupabaseSessionStore(settings),second=createSupabaseSessionStore(settings),now=Date.now();
  const row={code:'ABC234',version:0,data:'{"room":"fixture"}',updated_at:now,expires_at:now+43200000};
  assert.equal(await first.insert(row),true);assert.equal(await second.insert(row),false);
  assert.deepEqual(await second.read(row.code),row);
  assert.equal(await second.compareAndSwap({...row,version:1,data:'{"updated":true}'},0),true);
  assert.equal(await first.compareAndSwap({...row,version:1},0),false);
  assert.equal((await createSupabaseSessionStore(settings).read(row.code)).version,1);
  fixture.rows.get(row.code).expires_at=now-1;
  assert.equal(await second.read(row.code),null);
  const failure=createSupabaseSessionStore({...settings,request:async()=>new Response('provider details and credentials',{status:403})});
  await assert.rejects(()=>failure.read(row.code),error=>!error.message.includes('credentials'));
  assert.throws(()=>createSupabaseSessionStore({...settings,url:'http://fixture.supabase.co'}));
});

test('real Vercel HTTP adapter preserves four-player concurrent campaign and radio signaling (REST CAS double)',async()=>{
  const fixture=rpcDouble({injectConflict:true}),originalFetch=globalThis.fetch;
  const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','PARALLAXE_STORE_TOKEN'];
  const before=names.map(name=>process.env[name]);
  process.env.SUPABASE_URL=url;process.env.SUPABASE_PUBLISHABLE_KEY=key;process.env.PARALLAXE_STORE_TOKEN=token;
  globalThis.fetch=async(input,options)=>new URL(input).origin===url?fixture.request(input,options):originalFetch(input,options);
  const server=createServer(async(request,response)=>{
    if(request.url.endsWith('?parsed=1')){
      let raw='';for await(const chunk of request)raw+=chunk;
      request.body=JSON.parse(raw); // Vercel's documented request.body helper.
    }
    return handler(request,response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await originalFetch(`${origin}/api/session`,{method:'DELETE'})).status,405);
    assert.equal((await originalFetch(`${origin}/api/session`,{method:'POST',body:'x'.repeat(16385)})).status,413);
    const parsed=await originalFetch(`${origin}/api/session?parsed=1`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Parsed request'})});
    assert.equal(parsed.status,201,'preparsed Node request helper remains compatible');
    const output=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['tests/network.integration.mjs'],{
        cwd:project,env:{...process.env,PARALLAXE_TEST_URL:origin,PARALLAXE_TEST_BACKEND:'Vercel adapter with REST CAS double'},stdio:['ignore','pipe','pipe'],
      });
      let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
      child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(new Error(output)));
    });
    assert.match(output,/PASS: concurrent rooms/);
    assert.ok(fixture.conflicts>0,'an intervening writer exercised storage CAS retry');
    assert.ok(fixture.calls.some(call=>call.name.endsWith('_cas')));
  }finally{
    globalThis.fetch=originalFetch;
    names.forEach((name,index)=>before[index]===undefined?delete process.env[name]:process.env[name]=before[index]);
    await new Promise(resolve=>server.close(resolve));
  }
});
