import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

// Run only against an authorized local/QA origin, e.g. PARALLAXE_TEST_URL=http://127.0.0.1:4173.
const origin=process.env.PARALLAXE_TEST_URL;
if(!origin)throw new Error('Set PARALLAXE_TEST_URL to the local/QA game origin.');
const endpoint=new URL('/api/session',origin);
const clients=[];
const results=[];
const startedAt=new Date().toISOString();
async function call(body,client,expected=200){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(client?{Authorization:`Bearer ${client.token}`}:{})},body:JSON.stringify(body)});
  const value=await response.json();
  assert.equal(response.status,expected,JSON.stringify(value));
  if(value.state&&client)client.state=value.state;
  return value;
}
// Capture the context of the last observed state; raw call() is used for replay checks.
function decision(action,client,extra={},expected=200){
  return call({action,code:client.code,...extra,decisionEpoch:client.state.decisionEpoch},client,expected);
}
async function state(client){
  const response=await fetch(`${endpoint}?code=${client.code}`,{headers:{Authorization:`Bearer ${client.token}`}});
  const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));client.state=value.state;return value.state;
}
const answerFor=states=>states.some(s=>s.view.effects.length>0)||['relayCode','arrowDirection','syncTime'].some(key=>new Set(states.map(s=>s.view[key])).size>1);
try{
  const host=await call({action:'create',name:'QA Alpha',difficulty:'standard',mode:'campaign'},null,201);clients.push(host);
  const arrivals=await Promise.allSettled(['Bravo','Charlie','Delta'].map(async name=>{
    const client=await call({action:'join',code:host.code,name:`QA ${name}`});
    clients.push(client); // Retain every successful arrival even if another join fails.
    return client;
  }));
  const failedArrival=arrivals.find(result=>result.status==='rejected');
  if(failedArrival)throw failedArrival.reason;
  const joins=arrivals.map(result=>result.value);
  assert.equal((await state(host)).players.length,4);
  results.push({check:'Three concurrent joins retain four unique participants',status:'passed'});
  await call({action:'join',code:host.code,name:'QA Overflow'},null,409);
  await decision('start',joins[0],{},403);
  const forged=await fetch(`${endpoint}?code=${host.code}`,{headers:{Authorization:'Bearer forged-token-with-at-least-thirty-two-characters'}});
  assert.equal(forged.status,401);
  results.push({check:'Room capacity and server-side authorization',status:'passed'});
  for(const client of clients){client.epoch=`qa-radio-${client.selfId}`;await call({action:'radio-status',code:host.code,enabled:true,talking:false,epoch:client.epoch,activate:true},client);}
  const receiver=clients[1];
  await call({action:'signal',code:host.code,signal:{to:receiver.selfId,epoch:host.epoch,toEpoch:receiver.epoch,from:clients[2].selfId,description:{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'}}},host);
  const delivered=(await state(receiver)).radioInbox;assert.equal(delivered.length,1);assert.equal(delivered[0].from,host.selfId);assert.equal((await state(host)).radioInbox.length,0);assert.equal((await state(clients[2])).radioInbox.length,0);
  await call({action:'signal-ack',code:host.code,ids:delivered.map(s=>s.id)},clients[2]);assert.equal((await state(receiver)).radioInbox.length,1);
  await call({action:'signal-ack',code:host.code,ids:delivered.map(s=>s.id)},receiver);assert.equal((await state(receiver)).radioInbox.length,0);
  await call({action:'signal',code:host.code,signal:{to:receiver.selfId,epoch:'stale-radio-session',toEpoch:receiver.epoch,candidate:null}},host,409);
  const configResponse=await fetch(`${endpoint}?code=${host.code}&radioConfig=1`,{headers:{Authorization:`Bearer ${host.token}`}});assert.equal(configResponse.status,200);const config=await configResponse.json();assert.ok(Array.isArray(config.iceServers));assert.ok(config.expiresAt>Date.now());
  for(const client of clients)await call({action:'radio-status',code:host.code,enabled:false,talking:false,epoch:client.epoch},client);
  results.push({check:'Targeted radio signaling authenticates sender, hides other inboxes, rejects stale epochs and protects acknowledgements; authenticated ICE config works',status:'passed'});
  await decision('start',host);
  assert.equal((await state(host)).phase,'reference');
  const referencedLevels=['hotel'];
  for(let round=1;round<=9;round++){
    const nextRequest={action:'next',code:host.code,decisionEpoch:host.state.decisionEpoch};
    await call(nextRequest,host);
    if(round===4||round===7){
      const reference=await Promise.all(clients.map(state));assert.ok(reference.every(s=>s.phase==='reference'&&s.view.effects.length===0));assert.ok(reference.every(s=>s.levelId===(round===4?'metro':'clinic')));referencedLevels.push(reference[0].levelId);
      const replay=await call(nextRequest,host,409);assert.equal(replay.code,'STALE_DECISION_CONTEXT');assert.equal(replay.state.phase,'reference');
      await decision('next',host);
    }
    const states=await Promise.all(clients.map(state));
    assert.ok(states.every(s=>s.phase==='inspect'&&s.reveal===null));
    for(const s of states){assert.ok(!('seed'in s));assert.ok(!JSON.stringify(s).includes('tokenHash'));}
    assert.ok(states.every(s=>s.stage===Math.floor((round-1)/3)));
    const answer=answerFor(states);
    const voteRequest={action:'vote',code:host.code,vote:answer,decisionEpoch:states[0].decisionEpoch};
    await Promise.all(clients.map(client=>decision('vote',client,{vote:answer})));
    const result=await state(host);
    assert.equal(result.streak,round);
    assert.equal(result.phase,round===9?'won':'reveal');
    assert.equal(result.reveal.correct,true);
    const replay=await call(voteRequest,host,409);assert.equal(replay.code,'STALE_DECISION_CONTEXT');assert.equal(replay.state.streak,round);
  }
  results.push({check:'Private per-client projections before each verdict',status:'passed'});
  results.push({check:'Nine concurrent consensus rounds score exactly once and reach victory',status:'passed'});
  assert.deepEqual(referencedLevels,['hotel','metro','clinic']);
  results.push({check:'Campaign crosses hotel, metro and clinic with a clean synchronized reference before each new location',status:'passed'});
  results.push({check:'Stale votes and duplicate next return 409 with current private state; location references cannot be skipped',status:'passed'});
  if(process.env.PARALLAXE_TEST_DISCONNECT==='1'){
    await decision('start',host);await decision('next',host);
    const before=await Promise.all(clients.map(state));
    const answer=answerFor(before);
    console.log('Vérification de reconnexion : expiration réelle des 45 secondes de présence…');
    const interval=setInterval(()=>state(host).catch(()=>{}),5000);
    try{await new Promise(resolve=>setTimeout(resolve,46_000));}finally{clearInterval(interval);}
    const paused=await state(host);assert.equal(paused.paused,true);
    assert.equal(paused.players.filter(p=>p.connected).length,1);
    await decision('vote',host,{vote:answer});
    assert.equal((await state(host)).phase,'inspect');
    for(let i=1;i<clients.length;i++){
      const resumed=await state(clients[i]);assert.equal(resumed.selfId,before[i].selfId);
      assert.deepEqual(resumed.view,before[i].view);
    }
    assert.equal((await state(host)).paused,false);
    await Promise.all(clients.map(client=>decision('vote',client,{vote:answer})));
    assert.equal((await state(host)).streak,1);
    results.push({check:'Real 45 second presence expiry pauses play; same tokens resume same perception and consensus',status:'passed'});
  }
  // Verify leave revokes the same credential; other team members remain usable.
  const departing=clients.at(-1);const left=await call({action:'leave',code:host.code},departing);assert.equal(left.left,true);
  clients.pop(); // A failed departure remains tracked for the finally cleanup.
  const departed=await fetch(`${endpoint}?code=${host.code}`,{headers:{Authorization:`Bearer ${departing.token}`}});assert.equal(departed.status,401);
  assert.equal((await state(host)).players.length,3);
  results.push({check:'Explicit leave succeeds, revokes token, and preserves remaining participants',status:'passed'});
  const report={game:'PARALLAXE — Protocole 9',version:'0.2',startedAt,completedAt:new Date().toISOString(),backend:process.env.PARALLAXE_TEST_BACKEND??'Local Cloudflare D1',players:4,concurrentConsensusRounds:9,referencedLevels,results,limitations:['Game and signaling transport tested via HTTP clients, not four independent rendered browser windows.','This test does not capture a real microphone, measure voice quality, or exercise a deployed TURN relay.','Public internet deployment and cross-network latency not verified by this test.']};
  if(process.env.PARALLAXE_TEST_REPORT){await mkdir(new URL('../docs/',import.meta.url),{recursive:true});await writeFile(process.env.PARALLAXE_TEST_REPORT,JSON.stringify(report,null,2)+'\n');}
  console.log('PASS: concurrent rooms, authorization, private views, nine consensus rounds, victory, departure'+(process.env.PARALLAXE_TEST_DISCONNECT==='1'?', real disconnect/reconnect.':'.'));
}finally{
  for(const client of clients){try{await call({action:'leave',code:client.code},client);}catch(error){console.error('QA cleanup:',error.message);}}
}
