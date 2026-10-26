import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../src/game/radio-actions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {RadioActionGate}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('radio UI: stop releases pending immediately and an old success cannot clear a new wait',async()=>{
  let pending=false;const errors=[];const gate=new RadioActionGate(value=>{pending=value;});
  const old=deferred(),fresh=deferred();const oldRun=gate.run(()=>old.promise,error=>errors.push(error));
  assert.equal(pending,true);gate.cancel();assert.equal(pending,false);
  const freshRun=gate.run(()=>fresh.promise,error=>errors.push(error));assert.equal(pending,true);
  old.resolve();await oldRun;assert.equal(pending,true,'The newer permission is still waiting');
  fresh.resolve();await freshRun;assert.equal(pending,false);assert.deepEqual(errors,[]);
});

test('radio UI: a retired rejection is silent while a current rejection is reported',async()=>{
  let pending=false;const errors=[];const gate=new RadioActionGate(value=>{pending=value;});
  const old=deferred(),fresh=deferred();const oldRun=gate.run(()=>old.promise,error=>errors.push(error.message));
  gate.cancel();const freshRun=gate.run(()=>fresh.promise,error=>errors.push(error.message));
  old.reject(new Error('Retired permission'));await oldRun;assert.equal(pending,true);assert.deepEqual(errors,[]);
  fresh.reject(new Error('Current permission'));await freshRun;assert.equal(pending,false);assert.deepEqual(errors,['Current permission']);
});

test('radio UI: room replacement or unmount prevents retired callbacks from updating state',async()=>{
  const states=[],errors=[];const gate=new RadioActionGate(value=>states.push(value));
  const old=deferred();const oldRun=gate.run(()=>old.promise,error=>errors.push(error));
  gate.invalidate();old.reject(new Error('Previous room'));await oldRun;
  assert.deepEqual(states,[true]);assert.deepEqual(errors,[]);
  const setup=gate.begin();setup.finish();assert.deepEqual(states,[true,true,false]);
});

test('radio UI: activation starts in the user gesture and a synchronous failure releases pending',async()=>{
  let pending=false,started=false;const errors=[];const gate=new RadioActionGate(value=>{pending=value;});
  const activation=gate.run(()=>{started=true;throw new Error('Audio unavailable');},error=>errors.push(error.message));
  assert.equal(started,true,'Activation must not be delayed behind a config request');await activation;
  assert.equal(pending,false);assert.deepEqual(errors,['Audio unavailable']);
});
