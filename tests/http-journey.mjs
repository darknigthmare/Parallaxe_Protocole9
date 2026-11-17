/** Complete journeys through the actual HTTP protocol; no Room access or hidden-answer oracle. */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';

export async function verifyHTTPJourney(origin,{mode='campaign',levelId='hotel',players=2,exerciseMistake=false,request=fetch}={}){
  assert.ok([2,3,4].includes(players));
  const clients=[],steps=[];let state,wrongDone=false;
  async function action(payload,token,expected=200){
    const response=await request(origin+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    assert.equal(response.status,expected);assert.equal(response.headers.get('Cache-Control'),'no-store, private');
    return response.json();
  }
  async function view(client){
    const response=await request(origin+'/api/session?code='+clients[0].code,{headers:{Authorization:'Bearer '+client.token},signal:AbortSignal.timeout(10000)});
    assert.equal(response.status,200);const data=await response.json();return data.state;
  }
  const host=await action({action:'create',mode,levelId,name:'Journey Alpha'},undefined,201);clients.push(host);
  try{
    for(let i=1;i<players;i++)clients.push(await action({action:'join',code:host.code,name:'Journey '+i}));
    state=await view(host);
    const send=async(name,payload={},client=host)=>action({action:name,code:host.code,decisionEpoch:state.decisionEpoch,...payload},client.token);
    state=(await send('start')).state;
    const expectedLevels=mode==='campaign'?['hotel','metro','clinic']:[levelId];
    const references=[];
    for(let guard=0;guard<18&&state.phase!=='won';guard++){
      if(state.phase==='reference'){
        references.push(state.levelId);assert.equal(state.streak,mode==='campaign'?references.length*3-3:0);
        const projections=await Promise.all(clients.map(view));
        assert.ok(projections.every(p=>p.view.phase==='reference'&&p.view.effects.length===0));
        assert.ok(projections.every(p=>isDeepStrictEqual(p.view,projections[0].view)),'Reference views agree before clues are introduced');
      }
      state=(await send('next')).state;
      if(state.phase==='reference'){guard--;continue;} // explicit new-sector reference; never skips straight into inspection
      assert.equal(state.phase,'inspect');
      const before=state,projections=await Promise.all(clients.map(view));
      for(const p of projections){
        assert.equal(p.reveal,null);assert.equal(p.levelId,state.levelId);assert.equal(p.view.levelId,state.levelId);
        for(const key of ['seed','currentAnomalyId','observerSlots','tokenHash'])assert.equal(Object.hasOwn(p,key),false,key);
        assert.ok(p.players.every(member=>!Object.hasOwn(member,'tokenHash')));
      }
      const views=projections.map(p=>p.view);
      const anomalous=views.some(v=>v.effects.length>0)||views.some(v=>!isDeepStrictEqual(v,views[0]));
      const wrong=exerciseMistake&&!wrongDone&&(mode==='single'?state.stageProgress===2:state.levelId==='metro'&&state.stageProgress===1);
      const diagnosis=wrong?!anomalous:anomalous;
      // A real disagreement must not resolve. Correct the first vote only after the others have spoken.
      if(steps.length===0){
        await send('vote',{vote:!diagnosis},host);
        for(const client of clients.slice(1)){state=(await send('vote',{vote:diagnosis},client)).state;assert.equal(state.phase,'inspect');}
        state=(await send('vote',{vote:diagnosis},host)).state;
      }else{
        for(let i=0;i<clients.length;i++){
          state=(await send('vote',{vote:diagnosis},clients[i])).state;
          if(i<clients.length-1)assert.equal(state.phase,'inspect','No individual vote can resolve for the whole roster');
        }
      }
      assert.equal(state.reveal.correct,!wrong);
      assert.equal(state.strikes,before.strikes+Number(wrong));
      if(wrong){wrongDone=true;assert.equal(state.streak,mode==='campaign'?state.stage*3:0);assert.equal(state.stageProgress,0);assert.equal(state.levelId,before.levelId);}
      else assert.equal(state.streak,before.streak+1);
      const aftermath=await Promise.all(clients.map(view));
      assert.ok(aftermath.every(p=>p.phase===state.phase&&p.streak===state.streak&&p.decisionEpoch===state.decisionEpoch));
      assert.ok(aftermath.every(p=>isDeepStrictEqual(p.reveal,state.reveal)),'Resolved public explanation agrees across all inspectors');
      steps.push({level:state.levelId,phase:state.phase,loop:state.loop,correct:!wrong,certified:state.streak,errors:state.strikes});
    }
    assert.equal(state.phase,'won');assert.equal(state.streak,9);assert.deepEqual(references,expectedLevels);
    assert.equal(wrongDone,exerciseMistake);assert.equal(state.strikes,Number(exerciseMistake));
    assert.equal(state.correctTotal,steps.filter(s=>s.correct).length);
    return {mode,levelId:mode==='campaign'?'three-sector':levelId,players,references,disagreementBlocked:true,mistakeResetVerified:exerciseMistake,completed:true,steps};
  }finally{
    for(const client of [...clients].reverse())await action({action:'leave',code:host.code},client.token);
  }
}
