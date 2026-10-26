import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {isDeepStrictEqual} from 'node:util';

// Exercise the actual compiled deliverable, isolated from all user sessions.
const temporary=await mkdtemp(join(tmpdir(),'parallaxe-portable-'));
const reservation=createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
let child;
try{
  await mkdir(join(temporary,'scripts'));
  await cp(resolve('scripts/start-local.mjs'),join(temporary,'scripts/start-local.mjs'));
  await cp(resolve('standalone-dist'),join(temporary,'standalone-dist'),{recursive:true});
  child=spawn(process.execPath,[join(temporary,'scripts/start-local.mjs'),`--port=${port}`],{cwd:temporary,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Portable server startup timed out')),10000);
    child.once('error',reject);child.once('exit',code=>reject(new Error(`Portable server exited ${code}`)));
    child.stdout.on('data',chunk=>{if(chunk.toString().includes('Sur cet ordinateur')){clearTimeout(timer);resolve();}});
  });
  const origin=`http://127.0.0.1:${port}`;
  const get=await fetch(origin);assert.equal(get.status,200);assert.match(await get.text(),/PARALLAXE/);
  const hidden=await fetch(`${origin}/server/session.mjs`);assert.equal(hidden.status,404);
  async function action(body,token){const r=await fetch(`${origin}/api/session`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
  const host=await action({action:'create',name:'Portable QA Alpha'});
  const beta=await action({action:'join',name:'Portable QA Beta',code:host.code});
  assert.equal(beta.state.players.length,2);
  const started=await action({action:'start',code:host.code},host.token);assert.equal(started.state.phase,'reference');
  const first=await action({action:'next',code:host.code},host.token);assert.equal(first.state.phase,'inspect');
  const second=await fetch(`${origin}/api/session?code=${host.code}`,{headers:{Authorization:`Bearer ${beta.token}`}}).then(r=>r.json());
  // Compare complete private projections: relational cases have no visible-effect ID.
  // This includes relayCode, paired arrows, synchronized clocks and future view fields.
  const views=[first.state.view,second.state.view];
  const hasAnomaly=views.some(view=>view.effects.length>0)||views.slice(1).some(view=>!isDeepStrictEqual(view,views[0]));
  await action({action:'vote',code:host.code,vote:hasAnomaly},host.token);
  const result=await action({action:'vote',code:host.code,vote:hasAnomaly},beta.token);
  assert.equal(result.state.phase,'reveal');assert.equal(result.state.streak,1);assert.equal(result.state.reveal.correct,true);
  assert.equal((await action({action:'leave',code:host.code},beta.token)).left,true);
  assert.equal((await action({action:'leave',code:host.code},host.token)).left,true);
  console.log(JSON.stringify({portable:'passed',checks:['precompiled package starts without node_modules','HTML served','server modules not exposed','two real clients join','reference and inspection start','private perceptions determine actual diagnosis','unanimity resolves correctly','both leave cleanly'],webgl:'unverified'},null,2));
}finally{
  if(child&&!child.killed){child.kill('SIGTERM');await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2500);});}
  await rm(temporary,{recursive:true,force:true});
}
