import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

// Protocol tests from the actual sources. The D1 storage below is a CAS double,
// not Cloudflare D1. The Node fixture has no compiled frontend, browser or GPU.
const project=dirname(dirname(fileURLToPath(import.meta.url)));
const temporary=await mkdtemp(join(tmpdir(),'parallaxe-adapters-'));
const domainDir=join(temporary,'domain');
await mkdir(domainDir);
try{
  for(const name of ['levels','catalog','rules','session','radio-config']){
    const source=await readFile(join(project,'src/game',`${name}.ts`),'utf8');
    const output=stripTypeScriptTypes(source).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
    await writeFile(join(domainDir,`${name}.mjs`),output);
  }
}catch(error){await rm(temporary,{recursive:true,force:true});throw error;}
test.after(()=>rm(temporary,{recursive:true,force:true}));
const domain=await import(pathToFileURL(join(domainDir,'session.mjs')));
const routeSource=stripTypeScriptTypes(await readFile(join(project,'app/api/session/route.ts'),'utf8'))
  .replace("from 'cloudflare:workers'","from './env.mjs'")
  .replace(/from '\.\.\/\.\.\/\.\.\/src\/game\/([^']+)'/g,"from '../domain/$1.mjs'");

class CasStorageDouble{
  rows=new Map();
  updateAttempts=0;
  conflicts=0;
  beforeNextUpdate=null;
  prepare(sql){
    return {bind:(...args)=>({
      first:async()=>{
        assert.match(sql,/^SELECT code,version,data,updated_at,expires_at FROM parallaxe_sessions/);
        const row=this.rows.get(args[0]);
        return row?structuredClone(row):null;
      },
      run:async()=>{
        if(sql.startsWith('DELETE FROM parallaxe_sessions')){
          let removed=0;
          for(const [code,row] of this.rows){
            if(row.expires_at<args[0]&&removed<25){this.rows.delete(code);removed++;}
          }
          return {meta:{changes:removed}};
        }
        if(sql.startsWith('INSERT OR IGNORE INTO parallaxe_sessions')){
          const [code,data,updated_at,expires_at]=args;
          if(this.rows.has(code))return {meta:{changes:0}};
          this.rows.set(code,{code,data,updated_at,expires_at,version:0});
          return {meta:{changes:1}};
        }
        assert.match(sql,/^UPDATE parallaxe_sessions SET data/);
        assert.match(sql,/WHERE code = \? AND version = \?$/);
        this.updateAttempts++;
        const [data,updated_at,expires_at,code,version]=args;
        const before=this.beforeNextUpdate;this.beforeNextUpdate=null;
        if(before)await before(code);
        const row=this.rows.get(code);
        if(!row||row.version!==version){this.conflicts++;return {meta:{changes:0}};}
        this.rows.set(code,{code,data,updated_at,expires_at,version:version+1});
        return {meta:{changes:1}};
      },
    })};
  }
  readRoom(code){return JSON.parse(this.rows.get(code).data);}
  // Test setup / a competing writer. The actual handler must subsequently pass CAS.
  replaceRoom(code,room){
    const row=this.rows.get(code);
    this.rows.set(code,{...row,data:JSON.stringify(room),version:row.version+1});
  }
}

let fixtureNumber=0;
async function d1Fixture(count=2){
  const folder=join(temporary,`d1-${++fixtureNumber}`);
  await mkdir(folder);
  await writeFile(join(folder,'env.mjs'),'export const env = {DB:null};\n');
  await writeFile(join(folder,'route.mjs'),routeSource);
  const {env}=await import(pathToFileURL(join(folder,'env.mjs')));
  const storage=new CasStorageDouble();env.DB=storage;
  const handlers=await import(pathToFileURL(join(folder,'route.mjs')));
  async function post(body,client,expected=200){
    const response=await handlers.POST(new Request('http://fixture.invalid/api/session',{
      method:'POST',headers:{'Content-Type':'application/json',...(client?{Authorization:`Bearer ${client.token}`}:{})},body:JSON.stringify(body),
    }));
    const data=await response.json();
    assert.equal(response.status,expected,data.error??'Unexpected handler status');
    assert.equal(response.headers.get('Cache-Control'),'no-store, private');
    if(data.state&&client)client.state=data.state;
    return data;
  }
  async function get(client){
    const response=await handlers.GET(new Request(`http://fixture.invalid/api/session?code=${client.code}`,{headers:{Authorization:`Bearer ${client.token}`}}));
    const data=await response.json();assert.equal(response.status,200,data.error);
    client.state=data.state;return data.state;
  }
  function decision(action,client,extra={}){
    return post({action,code:client.code,...extra,decisionEpoch:client.state.decisionEpoch},client);
  }
  const host=await post({action:'create',name:'Handler Alpha',mode:'campaign'},null,201);
  const clients=[host];
  for(let i=1;i<count;i++)clients.push(await post({action:'join',code:host.code,name:`Handler ${i}`}));
  await get(host);
  return {storage,post,get,decision,host,clients};
}
const answerFor=states=>states.some(state=>state.view.effects.length>0)
  ||['relayCode','arrowDirection','syncTime'].some(key=>new Set(states.map(state=>state.view[key])).size>1);
async function finishRound(fixture){
  const states=await Promise.all(fixture.clients.map(fixture.get));
  const answer=answerFor(states);
  await Promise.all(fixture.clients.map(client=>fixture.decision('vote',client,{vote:answer})));
  return fixture.get(fixture.host);
}

test('real D1 handlers return 409 with a private current state for missing and stale decisions (CAS storage double)',async()=>{
  const f=await d1Fixture();const {host}=f;
  const before=f.storage.readRoom(host.code).revision;
  const missing=await f.post({action:'start',code:host.code},host,409);
  assert.equal(missing.code,'INVALID_DECISION_CONTEXT');assert.equal(missing.state.phase,'lobby');
  assert.ok(f.storage.readRoom(host.code).revision>before,'rejected request cleanup is persisted');
  await f.decision('start',host);
  const captured={action:'next',code:host.code,decisionEpoch:host.state.decisionEpoch};
  await f.post(captured,host);
  const replay=await f.post(captured,host,409);
  assert.equal(replay.code,'STALE_DECISION_CONTEXT');assert.equal(replay.state.phase,'inspect');
  assert.equal(replay.state.loop,1);assert.equal(replay.state.selfId,host.selfId);
  const stored=f.storage.readRoom(host.code),serialized=JSON.stringify(replay.state);
  assert.ok(!serialized.includes(stored.run.seed));
  for(const key of ['tokenHash','currentAnomalyId','observerSlots','decisionPaused'])assert.ok(!serialized.includes(key));
});
test('real D1 handlers persist interrupted-ballot cleanup before replying 409 (CAS storage double, no timed wait)',async()=>{
  const f=await d1Fixture();const {host}=f;
  await f.decision('start',host);await f.decision('next',host);
  await f.decision('vote',host,{vote:true});
  const captured={action:'vote',code:host.code,vote:true,decisionEpoch:host.state.decisionEpoch};
  const stored=f.storage.readRoom(host.code),at=Date.now();
  const actor=stored.players.find(player=>player.id===host.selfId);
  actor.lastSeen=at-domain.PRESENCE_TIMEOUT-1;
  stored.players.find(player=>player.id!==host.selfId).lastSeen=at;
  stored.pings=[{id:'old',name:'Handler Alpha',target:'mirror',at:actor.lastSeen}];
  stored.signals=[{id:'old',from:host.selfId,to:f.clients[1].selfId,fromEpoch:'expired',toEpoch:'expired',at:actor.lastSeen}];
  f.storage.replaceRoom(host.code,stored);
  const result=await f.post(captured,host,409);
  assert.equal(result.code,'STALE_DECISION_CONTEXT');
  const persisted=f.storage.readRoom(host.code);
  assert.ok(persisted.decisionEpoch>captured.decisionEpoch);
  assert.ok(persisted.players.every(player=>player.vote===null));
  assert.ok(persisted.players.find(player=>player.id===host.selfId).lastSeen>=at);
  assert.deepEqual(persisted.pings,[]);assert.deepEqual(persisted.signals,[]);
  assert.equal(persisted.run.phase,'inspect');assert.equal(result.state.streak,0);
  assert.equal((await f.get(host)).decisionEpoch,persisted.decisionEpoch);
});
test('real D1 CAS retry preserves the original next context and cannot skip a new location reference',async()=>{
  const f=await d1Fixture();const {host}=f;
  await f.decision('start',host);
  for(let round=0;round<3;round++){
    await f.decision('next',host);await finishRound(f);
  }
  assert.equal(host.state.phase,'reveal');assert.equal(host.state.streak,3);
  const captured={action:'next',code:host.code,decisionEpoch:host.state.decisionEpoch};
  const attempts=f.storage.updateAttempts,conflicts=f.storage.conflicts;
  f.storage.beforeNextUpdate=code=>{
    const latest=f.storage.readRoom(code);
    // Another request legitimately wins the first CAS with the same original intention.
    const winner=domain.actRoom(latest,host.selfId,'next',captured,Date.now());
    assert.equal(winner.run.phase,'reference');assert.equal(winner.run.levelId,'metro');
    f.storage.replaceRoom(code,winner);
  };
  const result=await f.post(captured,host,409);
  assert.equal(f.storage.conflicts-conflicts,1);
  assert.equal(f.storage.updateAttempts-attempts,2);
  assert.equal(result.code,'STALE_DECISION_CONTEXT');
  assert.equal(result.state.phase,'reference');assert.equal(result.state.levelId,'metro');assert.equal(result.state.loop,3);
  assert.equal(f.storage.readRoom(host.code).run.phase,'reference');
});
test('four real D1 handler requests with one captured context resolve once through CAS retries (storage double)',async()=>{
  const f=await d1Fixture(4);const {host}=f;
  await f.decision('start',host);await f.decision('next',host);
  const states=await Promise.all(f.clients.map(f.get));const vote=answerFor(states);
  const payloads=f.clients.map(client=>({action:'vote',code:client.code,decisionEpoch:client.state.decisionEpoch,vote}));
  await Promise.all(f.clients.map((client,index)=>f.post(payloads[index],client)));
  const state=await f.get(host);
  assert.equal(state.phase,'reveal');assert.equal(state.streak,1);assert.equal(state.reveal.correct,true);
  const replay=await f.post(payloads[0],host,409);
  assert.equal(replay.code,'STALE_DECISION_CONTEXT');assert.equal(replay.state.streak,1);
});

function trackedProcess(args,options){
  const child=spawn(process.execPath,args,{...options,stdio:['ignore','pipe','pipe']});
  const state={child,output:'',closed:false,completion:null};
  const collect=chunk=>{state.output=(state.output+chunk.toString()).slice(-64_000);};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  state.completion=new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('close',(code,signal)=>{state.closed=true;resolve({code,signal});});
  });
  // A startup error may precede the caller's wait; the original promise remains rejectable.
  state.completion.catch(()=>{});
  return state;
}
async function within(promise,ms,message){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}
  finally{clearTimeout(timer);}
}
async function stopProcess(processState){
  if(!processState||processState.closed||!processState.child.pid)return;
  processState.child.kill('SIGTERM');
  try{await within(processState.completion,3000,'Child process did not stop');}
  catch{processState.child.kill('SIGKILL');await within(processState.completion,2000,'Unable to close test child');}
}
async function waitForServer(processState){
  const ready=new Promise((resolve,reject)=>{
    const onData=()=>{if(processState.output.includes('Sur cet ordinateur')){processState.child.stdout.off('data',onData);resolve();}};
    processState.child.stdout.on('data',onData);onData();
    processState.completion.then(({code})=>reject(new Error(`Source HTTP server exited ${code}: ${processState.output}`)),reject);
  });
  await within(ready,10000,'Source HTTP server startup timed out');
}

test('real Node HTTP server from source passes the four-client campaign protocol suite; frontend is only a test fixture',async()=>{
  const folder=join(temporary,'node-server');
  await mkdir(join(folder,'scripts'),{recursive:true});
  await mkdir(join(folder,'standalone-dist'),{recursive:true});
  await cp(join(project,'scripts/start-local.mjs'),join(folder,'scripts/start-local.mjs'));
  await cp(domainDir,join(folder,'standalone-dist/server'),{recursive:true});
  await writeFile(join(folder,'standalone-dist/index.html'),'<!doctype html><title>PARALLAXE protocol HTTP fixture</title><p>Test fixture only. No compiled game frontend.</p>');
  const reservation=createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const port=reservation.address().port;
  await new Promise((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const origin=`http://127.0.0.1:${port}`;
  const reportPath=join(folder,'network-report.json');
  const env={...process.env,PARALLAXE_TEST_URL:origin,PARALLAXE_TEST_DISCONNECT:'0',PARALLAXE_TEST_REPORT:reportPath,
    PARALLAXE_TEST_BACKEND:'Node HTTP from stripped source; synthetic test index; no compiled frontend or D1 service',
    PARALLAXE_STUN_URLS:'',PARALLAXE_TURN_URLS:'',PARALLAXE_TURN_SECRET:''};
  let server,network;
  try{
    server=trackedProcess([join(folder,'scripts/start-local.mjs'),`--port=${port}`],{cwd:folder,env});
    await waitForServer(server);
    const page=await fetch(origin);assert.equal(page.status,200);assert.match(await page.text(),/protocol HTTP fixture/);
    assert.equal((await fetch(`${origin}/server/session.mjs`)).status,404);
    network=trackedProcess([join(project,'tests/network.integration.mjs')],{cwd:folder,env});
    const completed=await within(network.completion,20000,'Four-client protocol test timed out');
    assert.equal(completed.code,0,network.output);
    assert.match(network.output,/PASS: concurrent rooms/);
    const report=JSON.parse(await readFile(reportPath,'utf8'));
    assert.equal(report.players,4);assert.equal(report.concurrentConsensusRounds,9);
    assert.deepEqual(report.referencedLevels,['hotel','metro','clinic']);
    assert.ok(report.results.every(result=>result.status==='passed'));
    assert.ok(report.results.some(result=>/Stale votes and duplicate next return 409/.test(result.check)));
    assert.match(report.backend,/no compiled frontend or D1 service/);
  }finally{
    try{await stopProcess(network);}finally{await stopProcess(server);}
  }
  const saved=JSON.parse(await readFile(join(folder,'.parallaxe-data/sessions.json'),'utf8'));
  assert.ok(saved.length>0);assert.ok(saved.every(entry=>entry.room.players.every(player=>player.left)),'all protocol test clients must leave');
});
