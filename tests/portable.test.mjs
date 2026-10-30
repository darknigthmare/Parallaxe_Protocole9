import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,rm,stat,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {isDeepStrictEqual} from 'node:util';

// Exercise the actual compiled deliverable, isolated from all user sessions.
const packageRootIndex=process.argv.indexOf('--package-root');
const usesExtractedPackage=packageRootIndex!==-1;
if(usesExtractedPackage&&!process.argv[packageRootIndex+1])throw new Error('--package-root exige le dossier extrait');
const temporary=usesExtractedPackage?resolve(process.argv[packageRootIndex+1]):await mkdtemp(join(tmpdir(),'parallaxe-portable-'));
if(usesExtractedPackage){
  // A fresh extraction is required; never run QA against existing player sessions.
  try{await stat(join(temporary,'.parallaxe-data'));throw new Error('Utiliser une extraction neuve sans sessions existantes.');}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
let reservation,child;
const fixturePaths=[];
try{
  reservation=createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const port=reservation.address().port;
  await new Promise((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  if(!usesExtractedPackage){
    await mkdir(join(temporary,'scripts'));
    await cp(resolve('scripts/start-local.mjs'),join(temporary,'scripts/start-local.mjs'));
    await cp(resolve('standalone-dist'),join(temporary,'standalone-dist'),{recursive:true});
  }
  // Use unique fixtures so even an explicitly supplied extraction cannot overwrite files.
  const publicFixture=await mkdtemp(join(temporary,'standalone-dist/server-public-'));
  fixturePaths.push(publicFixture);
  await writeFile(join(publicFixture,'accessible.txt'),'PUBLIC PATH FIXTURE',{flag:'wx'});
  const privateFixture=await mkdtemp(join(temporary,'outside-public-'));
  fixturePaths.push(privateFixture);
  await writeFile(join(privateFixture,'private.txt'),'PRIVATE PATH FIXTURE',{flag:'wx'});
  child=spawn(process.execPath,[join(temporary,'scripts/start-local.mjs'),`--port=${port}`],{cwd:temporary,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Portable server startup timed out')),10000);
    child.once('error',reject);child.once('exit',code=>reject(new Error(`Portable server exited ${code}`)));
    child.stdout.on('data',chunk=>{if(chunk.toString().includes('Sur cet ordinateur')){clearTimeout(timer);resolve();}});
  });
  const origin=`http://127.0.0.1:${port}`;
  const get=await fetch(origin);assert.equal(get.status,200);const html=await get.text();assert.match(html,/PARALLAXE/);
  const assetPaths=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]))];
  assert.ok(assetPaths.some(path=>path.endsWith('.js')),'Compiled JavaScript must be referenced');
  assert.ok(assetPaths.some(path=>path.endsWith('.css')),'Compiled CSS must be referenced');
  for(const path of assetPaths){
    const response=await fetch(origin+path);assert.equal(response.status,200,`Public asset ${path}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(resolve(temporary,'standalone-dist',`.${path}`)),`Public asset bytes ${path}`);
  }
  const publicSibling=await fetch(origin+`/${basename(publicFixture)}/accessible.txt`);assert.equal(publicSibling.status,200);assert.equal(await publicSibling.text(),'PUBLIC PATH FIXTURE');
  const normalizedPublic=await fetch(origin+`/x%2f..%2f${basename(publicFixture)}%2faccessible.txt`);assert.equal(normalizedPublic.status,200);assert.equal(await normalizedPublic.text(),'PUBLIC PATH FIXTURE');
  const hiddenPaths=[
    '/server/session.mjs',
    '/server',
    '/server/',
    '/x%2f..%2fserver%2fsession.mjs',
    '/assets%2f..%2fserver%2fcatalog.mjs',
    '/%73erver%2frules.mjs',
    '/x%5c..%5cserver%5csession.mjs',
    '/x%2f..%5cserver%2fsession.mjs',
    '/SERVER/session.mjs',
    '/x%5c..%5cSERVER%5cSESSION.MJS',
  ];
  const pathChecks=[];
  for(const path of hiddenPaths){
    const response=await fetch(origin+path);assert.equal(response.status,404,`Private module path ${path}`);
    assert.deepEqual(await response.json(),{error:'Fichier introuvable.'});
    pathChecks.push({method:'GET',path,status:response.status});
  }
  const hiddenHead=await fetch(origin+'/x%2f..%2fserver%2fsession.mjs',{method:'HEAD'});assert.equal(hiddenHead.status,404);assert.equal((await hiddenHead.arrayBuffer()).byteLength,0);
  pathChecks.push({method:'HEAD',path:'/x%2f..%2fserver%2fsession.mjs',status:hiddenHead.status});
  const outsidePath=`/%2e%2e%2f${basename(privateFixture)}%2fprivate.txt`;
  const outside=await fetch(origin+outsidePath);assert.equal(outside.status,403);assert.deepEqual(await outside.json(),{error:'Accès refusé.'});
  pathChecks.push({method:'GET',path:outsidePath,status:outside.status});
  async function action(body,token,expected){const r=await fetch(`${origin}/api/session`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const data=await r.json();if(expected!==undefined)assert.equal(r.status,expected,JSON.stringify(data));else assert.ok(r.ok,JSON.stringify(data));return data;}
  const host=await action({action:'create',name:'Portable QA Alpha'});
  const beta=await action({action:'join',name:'Portable QA Beta',code:host.code});
  assert.equal(beta.state.players.length,2);
  const missing=await action({action:'start',code:host.code},host.token,409);
  assert.equal(missing.code,'INVALID_DECISION_CONTEXT');assert.equal(missing.state.phase,'lobby');
  const started=await action({action:'start',code:host.code,decisionEpoch:missing.state.decisionEpoch},host.token);assert.equal(started.state.phase,'reference');
  const nextRequest={action:'next',code:host.code,decisionEpoch:started.state.decisionEpoch};
  const first=await action(nextRequest,host.token);assert.equal(first.state.phase,'inspect');
  const repeatedNext=await action(nextRequest,host.token,409);
  assert.equal(repeatedNext.code,'STALE_DECISION_CONTEXT');assert.equal(repeatedNext.state.loop,first.state.loop);assert.equal(repeatedNext.state.phase,'inspect');
  const second=await fetch(`${origin}/api/session?code=${host.code}`,{headers:{Authorization:`Bearer ${beta.token}`}}).then(r=>r.json());
  // Compare complete private projections: relational cases have no visible-effect ID.
  // This includes relayCode, paired arrows, synchronized clocks and future view fields.
  const views=[first.state.view,second.state.view];
  const hasAnomaly=views.some(view=>view.effects.length>0)||views.slice(1).some(view=>!isDeepStrictEqual(view,views[0]));
  const voteRequest={action:'vote',code:host.code,vote:hasAnomaly,decisionEpoch:first.state.decisionEpoch};
  await action(voteRequest,host.token);
  const result=await action({...voteRequest,decisionEpoch:second.state.decisionEpoch},beta.token);
  assert.equal(result.state.phase,'reveal');assert.equal(result.state.streak,1);assert.equal(result.state.reveal.correct,true);
  const following=await action({action:'next',code:host.code,decisionEpoch:result.state.decisionEpoch},host.token);
  const stale=await action(voteRequest,host.token,409);
  assert.equal(stale.code,'STALE_DECISION_CONTEXT');assert.equal(stale.state.loop,following.state.loop);assert.equal(stale.state.streak,1);
  assert.ok(stale.state.players.every(player=>player.vote===null));
  assert.equal((await action({action:'leave',code:host.code},beta.token)).left,true);
  assert.equal((await action({action:'leave',code:host.code},host.token)).left,true);
  // The fourth location uses the same authoritative protocol with a full roster.
  const cabin=await action({action:'create',name:'Chalet QA Alpha',mode:'single',levelId:'cabin'});
  const cabinClients=[cabin];
  for(const name of ['Chalet QA Beta','Chalet QA Gamma','Chalet QA Delta']){
    cabinClients.push(await action({action:'join',name,code:cabin.code}));
  }
  const cabinLobbyResponse=await fetch(`${origin}/api/session?code=${cabin.code}`,{headers:{Authorization:`Bearer ${cabin.token}`}});
  assert.equal(cabinLobbyResponse.status,200);
  const cabinLobby=(await cabinLobbyResponse.json()).state;
  const cabinStart=await action({action:'start',code:cabin.code,decisionEpoch:cabinLobby.decisionEpoch},cabin.token);
  assert.equal(cabinStart.state.levelId,'cabin');
  assert.equal(cabinStart.state.mode,'single');
  assert.equal(cabinStart.state.phase,'reference');
  assert.equal(cabinStart.state.players.length,4);
  let cabinVerdict=cabinStart;
  for(let round=0;round<9;round++){
    const dealt=await action({action:'next',code:cabin.code,decisionEpoch:cabinVerdict.state.decisionEpoch},cabin.token);
    assert.equal(dealt.state.phase,'inspect');
    const projections=[dealt.state];
    for(const client of cabinClients.slice(1)){
      const response=await fetch(`${origin}/api/session?code=${cabin.code}`,{headers:{Authorization:`Bearer ${client.token}`}});
      assert.equal(response.status,200);projections.push((await response.json()).state);
    }
    assert.ok(projections.every(state=>state.levelId==='cabin'&&state.view.levelId==='cabin'&&state.reveal===null));
    const views=projections.map(state=>state.view);
    const anomalous=views.some(view=>view.effects.length>0)||views.slice(1).some(view=>!isDeepStrictEqual(view,views[0]));
    for(const target of ['table','fireplace']){
      const ping=await action({action:'ping',code:cabin.code,target,reading:'PRIVATE CHIMNEY OBSERVATION'},cabin.token);
      assert.equal(ping.state.pings.at(-1).target,target);
      assert.ok(!JSON.stringify(ping).includes('PRIVATE CHIMNEY OBSERVATION'));
    }
    for(const [index,client] of cabinClients.entries()){
      cabinVerdict=await action({action:'vote',code:cabin.code,vote:anomalous,decisionEpoch:projections[index].decisionEpoch},client.token);
    }
    assert.equal(cabinVerdict.state.streak,round+1);
    assert.equal(cabinVerdict.state.reveal.correct,true);
  }
  assert.equal(cabinVerdict.state.phase,'won');
  assert.equal(cabinVerdict.state.levelId,'cabin');
  for(const client of [...cabinClients].reverse())assert.equal((await action({action:'leave',code:cabin.code},client.token)).left,true);
  console.log(JSON.stringify({chalet:{clients:4,diagnoses:9,won:true,privateReadingsProtected:true}}));
  console.log(JSON.stringify({portable:'passed',checks:[
    'precompiled package starts without node_modules',
    'HTML served',
    'compiled JavaScript and CSS bytes served unchanged',
    'similarly named public directory remains accessible',
    'server modules blocked after path normalization',
    'encoded traversal outside public root rejected',
    'two real clients join',
    'missing decision context returns 409 and current private state',
    'reference and inspection start',
    'duplicate next cannot skip a passage',
    'private perceptions determine actual diagnosis',
    'unanimity resolves correctly',
    'old vote rejected after next passage',
    'both leave cleanly',
    'four clients complete nine Chalet diagnoses and win',
    'Chalet pings never broadcast private reading text',
    'all four Chalet clients leave cleanly',
  ],pathProtection:{platform:process.platform,node:process.version,publicAssetCount:assetPaths.length,checks:pathChecks},webgl:'unverified'},null,2));
}finally{
  try{
    if(reservation?.listening)await new Promise((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
    if(child&&!child.killed){child.kill('SIGTERM');await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2500);});}
  }finally{
    if(!usesExtractedPackage)await rm(temporary,{recursive:true,force:true});
    else for(const fixture of fixturePaths)await rm(fixture,{recursive:true,force:true});
  }
}
