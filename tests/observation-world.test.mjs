/** Actual geometry, transforms and private readings. This suite does NOT certify GPU pixels. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const require=createRequire(import.meta.url),directory=await mkdtemp(join(tmpdir(),'p9-observation-world-'));
const originalDocument=globalThis.document;
globalThis.document={createElement(){const canvas={width:0,height:0};const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});canvas.getContext=()=>context;return canvas;}};
for(const name of ['observation-state','observation-world']) {
 const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
 code=code.replace("from 'three'",`from ${JSON.stringify(pathToFileURL(join(dirname(require.resolve('three')),'three.module.js')).href)}`);
 await writeFile(join(directory,name+'.mjs'),code);
}
const {createObservationWorld}=await import(pathToFileURL(join(directory,'observation-world.mjs')));
test.after(async()=>{globalThis.document=originalDocument;await rm(directory,{recursive:true,force:true});});
const view=(effects=[],extra={})=>({phase:'inspect',loop:1,levelId:'hotel',effects,...extra});
function tick(w,sec,pose={x:-1.8,z:-14.2}){for(let i=0;i<sec*60;i++)w.update(1/60,pose,true);}

test('geometry is finite and all fixed targets have reachable raycast locations',()=>{
 const w=createObservationWorld();try{
  w.root.updateMatrixWorld(true);let triangles=0;
  w.root.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal'])for(const value of o.geometry.attributes[key].array)assert.ok(Number.isFinite(value));triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles>1000&&triangles<25000,`Unexpected geometry budget ${triangles}`);
  for(const target of w.targets.filter(o=>o.userData.inspect.id!=='ceiling')){
   const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
   const origin=new THREE.Vector3(0,1.67,center.z);const dir=center.clone().sub(origin).normalize();
   assert.ok(new THREE.Raycaster(origin,dir,0,5.8).intersectObject(target,true).length,target.userData.inspect.id);
  }
  assert.ok(w.colliders.every(c=>c.x-c.rx>3.0),'No new collision in central route');
 }finally{w.dispose();}
});
test('two private four-star geometries and readings match the original six positions',()=>{
 const w=createObservationWorld();try{
  const stars=Array.from({length:6},(_,i)=>w.root.getObjectByName(`G9 — étoile ${i+1}`));
  w.setView(view([],{starMask:'left'}));assert.deepEqual(stars.map((o,i)=>o.visible?i:-1).filter(i=>i>=0),[0,1,3,4]);assert.equal(w.getReading('stars').lines[0],'4 POINTS LUMINEUX');
  w.setView(view([],{starMask:'right'}));assert.deepEqual(stars.map((o,i)=>o.visible?i:-1).filter(i=>i>=0),[1,2,4,5]);
  w.setView(view([],{phase:'reference',starMask:'left'}));assert.ok(stars.every(o=>o.visible));assert.equal(w.getReading('stars').lines[0],'6 POINTS LUMINEUX');
 }finally{w.dispose();}
});
test('portrait ages only after ten seconds and remains latched across the solo comparison',()=>{
 const w=createObservationWorld();try{
  w.setView(view(['photo_age']));tick(w,9);assert.match(w.getReading('aged-photo').lines.join(' '),/CHEVEUX SOMBRES/);
  tick(w,15);assert.match(w.getReading('aged-photo').lines.join(' '),/CHEVEUX BLANCS/);
  assert.ok(w.root.getObjectByName('P9 — portrait du gardien').userData.age>.99);
  w.setView(view([]));assert.match(w.getReading('aged-photo').lines.join(' '),/SOMBRES/);
  w.setView(view(['photo_age']));assert.match(w.getReading('aged-photo').lines.join(' '),/BLANCS/);
  w.setView(view(['photo_age'],{loop:2}));assert.match(w.getReading('aged-photo').lines.join(' '),/SOMBRES/);
 }finally{w.dispose();}
});
test('the stair shadow swaps material data, not physical rail geometry or collisions',()=>{
 const w=createObservationWorld();try{
  w.setView(view());const projection=w.root.getObjectByName('Palier — projection'),normal=projection.material.map;
  const positions=[];w.root.getObjectByName('Palier de service — rampe et applique').traverse(o=>positions.push(o.position.toArray()));
  const colliders=JSON.stringify(w.colliders);
  w.setView(view(['stair_wrong_shadow']));assert.notEqual(projection.material.map,normal);assert.match(w.getReading('landing').lines[1],/MARCHES/);
  const after=[];w.root.getObjectByName('Palier de service — rampe et applique').traverse(o=>after.push(o.position.toArray()));assert.deepEqual(after,positions);assert.equal(JSON.stringify(w.colliders),colliders);
  w.setView(view());assert.equal(projection.material.map,normal);assert.match(w.getReading('landing').lines[1],/BARRE ET MONTANTS/);
 }finally{w.dispose();}
});
test('inverted rig walks slowly on the ceiling and disappears only for unaffected observers',()=>{
 const w=createObservationWorld();try{
  w.setView(view(['ceiling_walker']));const figure=w.root.getObjectByName('Plafond — marcheur inversé');
  tick(w,1,{x:0,z:5});assert.equal(figure.visible,false);
  tick(w,1,{x:0,z:-4});assert.equal(figure.visible,true);assert.equal(figure.rotation.z,Math.PI);
  const z=figure.position.z;const limb=figure.children[0].children.find(o=>o.isGroup);const before=limb.rotation.x;
  tick(w,1,{x:0,z:-4});assert.ok(Math.abs(figure.position.z-z)<.5);assert.notEqual(limb.rotation.x,before);
  w.setView(view());assert.equal(figure.visible,false);
  w.setView(view(['ceiling_walker']));assert.equal(figure.visible,true);
  w.setView(view(['ceiling_walker'],{phase:'reference'}));assert.equal(figure.visible,false);
 }finally{w.dispose();}
});
test('non-hotel locations hide props and expose no hotel reading',()=>{
 const w=createObservationWorld();try{w.setView(view(['photo_age'],{levelId:'metro'}));assert.equal(w.root.visible,false);assert.equal(w.getReading('aged-photo'),null);}finally{w.dispose();}
});
test('resources are bounded and each attached geometry/material/texture is disposed once',()=>{
 const w=createObservationWorld();const resources=new Set();w.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[o.material].flat():[]){resources.add(m);if(m.map)resources.add(m.map);}});
 const counts=new Map();for(const item of resources)item.addEventListener('dispose',()=>counts.set(item,(counts.get(item)||0)+1));
 for(let i=0;i<30;i++){w.setView(view(['photo_age','stair_wrong_shadow'],{loop:i}));tick(w,24);w.setView(view([],{loop:i,phase:'reference'}));}
 w.dispose();w.dispose();for(const item of resources)assert.equal(counts.get(item),1,item.type);assert.equal(w.root.children.length,0);
});
