/** Real avatar meshes and matrices, stubbed 2D canvas. Not a physical GPU benchmark. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
const require=createRequire(import.meta.url),temp=await mkdtemp(join(tmpdir(),'p9-shadow-'));
const oldDocument=globalThis.document;
globalThis.document={createElement(){const c={width:0,height:0};c.getContext=()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});return c;}};
for(const name of ['avatar','shadow-state','body-shadow','shadow-world']){
 let code=ts.transpileModule(await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
 code=code.replace("from 'three'",`from '${pathToFileURL(join(dirname(require.resolve('three')),'three.module.js')).href}'`);
 code=code.replace(/from '(three\/addons\/[^']+)'/g,(_,s)=>`from '${pathToFileURL(require.resolve(s)).href}'`);
 await writeFile(join(temp,name+'.mjs'),code);
}
const {createInspector}=await import(pathToFileURL(join(temp,'avatar.mjs')));
const {createShadowState,atShadowStation}=await import(pathToFileURL(join(temp,'shadow-state.mjs')));
const {createBodyShadow,bodyShadowMatrix,SHADOW_FLOOR_Y}=await import(pathToFileURL(join(temp,'body-shadow.mjs')));
const {createShadowWorld}=await import(pathToFileURL(join(temp,'shadow-world.mjs')));
test.after(async()=>{globalThis.document=oldDocument;await rm(temp,{recursive:true,force:true});});
const a={id:'a',x:-.5,z:-3.05,yaw:0},b={id:'b',x:1.2,z:-3.05,yaw:0};
const view=(effects=['shadow_points'],extra={})=>({effects,phase:'inspect',loop:1,levelId:'hotel',contextKey:'test',...extra});
function settle(s,actors=[a,b],shared=true,hz=60,sec=1.2){for(let i=0;i<Math.ceil(sec*hz);i++)s.update(1/hz,'a',actors,true,shared,true);}
function model(id='a'){const m=createInspector({id,name:'Test '+id,slot:id==='a'?0:1},{local:id==='a',nameplate:false});m.root.position.set(id==='a'?-.5:1.2,0,-3.05);m.root.visible=true;return m;}
test('only affected view extends the shadow after every inspecteur stops at C9',()=>{
 const s=createShadowState();s.setView(view());settle(s);assert.equal(s.snapshot().pointing,true);assert.equal(s.snapshot().target.id,'b');
 s.setView(view([]));assert.equal(s.snapshot().pointing,false);assert.equal(s.snapshot().ready,true);
 s.setView(view());assert.equal(s.snapshot().pointing,true);
});
test('reference, other levels, verdict and new passage never carry an autonomous arm',()=>{
 const s=createShadowState();s.setView(view());settle(s);
 for(const extra of [{phase:'reference'},{levelId:'clinic'},{phase:'result'},{loop:2},{contextKey:'new-room'}]){
  s.setView(view([],extra));assert.equal(s.snapshot().pointing,false);assert.equal(s.snapshot().ready,false);
 }
});
test('gate is frame-rate independent at 10/30/60/144 Hz and requires one full stable second',()=>{
 for(const hz of [10,30,60,144]){
  const s=createShadowState();s.setView(view());settle(s,[a,b],true,hz,.8);assert.equal(s.snapshot().pointing,false);
  settle(s,[a,b],true,hz,.4);assert.equal(s.snapshot().pointing,true,String(hz));
 }
});
test('any received movement including small high-frequency steps resets the observation',()=>{
 const s=createShadowState();s.setView(view());settle(s);
 s.update(1/144,'a',[a,{...b,x:b.x+.00002}],true,true,true);assert.equal(s.snapshot().pointing,false);
 settle(s);s.update(.02,'a',[{...a,yaw:.1},b],true,true,true);assert.equal(s.snapshot().ready,false);
 settle(s);s.update(.02,'a',[a,{...b,talking:true}],true,true,true);assert.equal(s.snapshot().ready,false);
});
test('stale/disconnected/duplicate/nonfinite poses cannot create evidence',()=>{
 for(const [actors,fresh]of [[[a,b],false],[[a,{...b,connected:false}],true],[[a,a],true],[[a,{...b,x:NaN}],true],[[b],true]]){
  const s=createShadowState();s.setView(view());settle(s);s.update(.05,'a',actors,true,true,fresh);
  assert.equal(s.snapshot().pointing,false);assert.equal(s.snapshot().reason,'synchronizing');
 }
});
test('gathering outside the painted station, pause and missing partner use neutral states',()=>{
 const s=createShadowState();s.setView(view());settle(s);
 s.update(.05,'a',[a,{...b,z:9}],true,true,true);assert.equal(s.snapshot().reason,'gather');
 settle(s);s.update(.05,'a',[a,b],false,true,true);assert.equal(s.snapshot().pointing,false);
 settle(s);s.interrupt();assert.equal(s.snapshot().active,false);assert.equal(s.snapshot().pointing,false);
 s.update(.05,'a',[a],true,true,true);assert.equal(s.snapshot().reason,'partner-required');
 assert.equal(atShadowStation({x:100,z:-3}),false);
});
test('solo uses the explicit T1 training stand, never a fictitious connected teammate',()=>{
 const s=createShadowState();s.setView(view());settle(s,[a],false);assert.equal(s.snapshot().target.id,'training-witness-T1');
 s.update(.05,'a',[a],true,true,true);assert.equal(s.snapshot().target,null);
});
test('target uses only public identity ordering and does not depend on roster order or returned mutations',()=>{
 const s=createShadowState();s.setView(view());const c={...b,id:'c',x:1.5};settle(s,[a,c,b]);
 assert.equal(s.snapshot().target.id,'b');s.snapshot().target.id='c';assert.equal(s.snapshot().target.id,'b');
 s.update(.05,'a',[b,a,c],true,true,true);assert.equal(s.snapshot().target.id,'b');
});
test('projection maps arbitrary finite points to one floor and keeps foot anchors fixed',()=>{
 const p=bodyShadowMatrix();
 for(let i=0;i<100;i++){
  const v=new THREE.Vector3(Math.sin(i)*2,i%18/10,Math.cos(i)*4),shadow=v.clone().applyMatrix4(p);
  assert.ok(Math.abs(shadow.y-SHADOW_FLOOR_Y)<1e-10);
  assert.ok(Math.abs(shadow.x-(v.x+.18*(v.y-SHADOW_FLOOR_Y)))<1e-10);
 }
 const foot=new THREE.Vector3(1,SHADOW_FLOOR_Y,-3);assert.ok(foot.clone().applyMatrix4(p).distanceTo(foot)<1e-10);
});
test('normal projection uses the actual shared geometry and every articulated transform, including local head',()=>{
 const m=model(),s=createBodyShadow(m);try{
  m.animate({time:.5,speed:2.3,talking:true,pitch:.3});s.update(null);let sourceMeshes=[];m.root.traverse(o=>{if(o.isMesh&&o!==m.contactShadow)sourceMeshes.push(o);});
  const copies=[];s.root.traverse(o=>{if(o.isMesh)copies.push(o);});assert.equal(copies.length,sourceMeshes.length);
  for(const [i,copy]of copies.entries()){
   const original=sourceMeshes[i];assert.equal(copy.geometry,original.geometry);assert.equal(copy.layers.mask,1);
   const expect=new THREE.Matrix4().multiplyMatrices(bodyShadowMatrix(),original.matrixWorld);
   expect.elements.forEach((v,j)=>assert.ok(Math.abs(copy.matrixWorld.elements[j]-v)<1e-9));
  }
 }finally{s.dispose();m.dispose();}
});
test('only the projected right arm rotates; source joints and root never mutate',()=>{
 const m=model(),s=createBodyShadow(m);try{
  m.animate({time:0,speed:0});const initial=[...m.shoulders,...m.elbows,...m.hands].map(o=>o.quaternion.toArray());
  for(const yaw of [0,.7,Math.PI,-1.3]){
   m.root.rotation.y=yaw;const aim={x:1.2,z:-3.5};s.update(aim);const d=s.direction();
   const actual=new THREE.Vector3().fromArray(d.to).sub(new THREE.Vector3().fromArray(d.from)).normalize();
   const expected=new THREE.Vector3(aim.x-d.from[0],0,aim.z-d.from[2]).normalize();
   assert.ok(actual.dot(expected)>.999,'Projected arm aligns with public teammate position');
   assert.deepEqual([...m.shoulders,...m.elbows,...m.hands].map(o=>o.quaternion.toArray()),initial);
  }
  s.update(null);assert.deepEqual(s.root.getObjectByName('Right shoulder').quaternion.toArray(),m.shoulders[1].quaternion.toArray());
 }finally{s.dispose();m.dispose();}
});
test('projection owns no body geometry and restores source shadow/contact flags on hide/dispose',()=>{
 const m=model(),s=createBodyShadow(m);let disposedGeometries=0;m.root.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposedGeometries++));
 const casting=[];m.root.traverse(o=>{if(o.isMesh)casting.push([o,o.castShadow]);});
 s.update(null);assert.equal(m.contactShadow.visible,false);s.update(null,false);
 assert.equal(m.contactShadow.visible,true);for(const [o,v]of casting)assert.equal(o.castShadow,v);
 s.update({x:1,z:-3});s.dispose();s.dispose();assert.equal(disposedGeometries,0);assert.equal(m.contactShadow.visible,true);m.dispose();
});
test('world is bounded to four model projections, fixed scenery is untouched by A/B',()=>{
 const w=createShadowWorld(),m=model(),n=model('b');try{
  w.setView(view());const before=w.targets[0].position.clone();for(let i=0;i<80;i++)w.update(1/60,'a',[a,b],[m,n],true,true,true);
  assert.equal(w.snapshot().pointing,true);assert.match(w.getReading('body-shadow').lines.join(' '),/BRAS DROIT ÉTENDU/);
  const self=w.root.getObjectByName('C9 — projection du corps a');assert.ok(self);const ncopy=w.root.getObjectByName('C9 — projection du corps b');
  assert.deepEqual(ncopy.getObjectByName('Right shoulder').quaternion.toArray(),n.shoulders[1].quaternion.toArray());
  w.setView(view([]));w.update(.01,'a',[a,b],[m,n],true,true,true);assert.match(w.getReading('body-shadow').lines.join(' '),/PROJECTION : BRAS AU REPOS/);
  assert.ok(before.equals(w.targets[0].position));w.update(.01,'a',[a],[m],true,false,true);assert.equal(w.root.getObjectByName('C9 — projection du corps b'),undefined);
 }finally{w.dispose();m.dispose();n.dispose();}
});
test('reflection mask obeys body visibility and restores even when capture throws',()=>{
 const w=createShadowWorld(),m=model();try{
  w.setView(view());w.update(.05,'a',[a],[m],true,false,true);const projected=w.root.getObjectByName('C9 — projection du corps a');assert.equal(projected.visible,true);
  m.root.visible=false;const restore=w.reflectionMask();assert.equal(projected.visible,false);
  try{throw Error('capture failed');}catch{}finally{restore();}assert.equal(projected.visible,true);m.root.visible=true;
  w.interrupt();assert.equal(projected.visible,false);assert.equal(m.contactShadow.visible,true);
 }finally{w.dispose();m.dispose();}
});
test('replacing an identity and leaving Saint-Clair releases borrowed resources without a ghost',()=>{
 const w=createShadowWorld(),m=model(),replacement=model();try{
  w.setView(view());w.update(.05,'a',[a],[m],true,false,true);const old=w.root.getObjectByName('C9 — projection du corps a');
  w.update(.05,'a',[a],[replacement],true,false,true);assert.notEqual(w.root.getObjectByName(old.name),old);assert.equal(old.parent,null);assert.equal(m.contactShadow.visible,true);
  w.setView(view([],{levelId:'metro'}));assert.equal(w.root.visible,false);assert.equal(replacement.contactShadow.visible,true);assert.equal(w.getReading('body-shadow'),null);
 }finally{w.dispose();m.dispose();replacement.dispose();}
});
