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
const require=createRequire(import.meta.url),directory=await mkdtemp(join(tmpdir(),'p9-temporal-world-'));
const originalDocument=globalThis.document;
globalThis.document={createElement(){const canvas={width:0,height:0};const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});canvas.getContext=()=>context;return canvas;}};
for(const name of ['temporal-state','temporal-world']) {
 const source=await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
 code=code.replace("from 'three'",`from ${JSON.stringify(pathToFileURL(join(dirname(require.resolve('three')),'three.module.js')).href)}`);
 await writeFile(join(directory,name+'.mjs'),code);
}
const {createTemporalWorld}=await import(pathToFileURL(join(directory,'temporal-world.mjs')));
test.after(async()=>{globalThis.document=originalDocument;await rm(directory,{recursive:true,force:true});});
const view=(effects=[],extra={})=>({phase:'inspect',loop:1,levelId:'hotel',effects,...extra});
function tick(w,seconds,active=true){for(let i=0;i<seconds*60;i++)w.update(1/60,active);}
const pose={x:1.8,z:-12.6};

test('four props have finite real geometry, reachable inspection targets and constant safe clearances',()=>{
 const w=createTemporalWorld();try{w.root.updateMatrixWorld(true);let triangles=0;
 w.root.traverse(o=>{if(!o.isMesh)return;for(const k of ['position','normal'])for(const v of o.geometry.attributes[k].array)assert.ok(Number.isFinite(v));triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 assert.ok(triangles>1000&&triangles<30000,`bounded geometry: ${triangles}`);assert.equal(w.targets.length,4);
 for(const target of w.targets){const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());const origin=new THREE.Vector3(0,1.67,center.z);assert.ok(new THREE.Raycaster(origin,center.clone().sub(origin).normalize(),0,5).intersectObject(target,true).length,target.name);}
 const before=JSON.stringify(w.colliders);w.setView(view(['flower_afterimage','door_future_shadow','mannequin_turns']));tick(w,12);assert.equal(JSON.stringify(w.colliders),before);assert.ok(w.colliders.every(c=>Math.abs(c.x)-c.rx>2.5));
 }finally{w.dispose();}
});
test('the flower is not parented under the rotating vase and actually remains two seconds behind',()=>{
 const w=createTemporalWorld();try{w.setView(view(['flower_afterimage']));w.update(0,true);w.activate('vase',pose);tick(w,1);
 const vase=w.root.getObjectByName('Vase — pivot'),flower=w.root.getObjectByName('Fleur — pivot indépendant');assert.equal(vase.parent,flower.parent);assert.ok(vase.rotation.y>1.5);assert.equal(flower.rotation.y,0);tick(w,2);assert.equal(vase.rotation.y,flower.rotation.y);
 w.setView(view([],{phase:'reference'}));assert.equal(vase.rotation.y,0);assert.equal(flower.rotation.y,0);
 }finally{w.dispose();}
});
test('controlled door silhouette moves before the real leaf and both return closed',()=>{
 const w=createTemporalWorld();try{w.setView(view(['door_future_shadow']));w.update(0,true);w.activate('witness-door',pose);tick(w,1);
 const door=w.root.getObjectByName('Porte témoin — charnière'),shadow=w.root.getObjectByName('Porte témoin — ombre');assert.equal(door.rotation.y,0);assert.ok(shadow.rotation.y< -1.5);tick(w,6);assert.equal(door.rotation.y,0);assert.equal(shadow.rotation.y,0);
 }finally{w.dispose();}
});
test('a mannequin signal rotates the actual head joint, never its plinth or body',()=>{
 const w=createTemporalWorld();try{w.setView(view(['mannequin_turns']));w.update(0,true);const head=w.root.getObjectByName('Mannequin — tête articulée');const normal=head.parent.rotation.y;w.activate('listening-mannequin',pose);tick(w,1);assert.ok(Math.abs(head.rotation.y)>.2);assert.equal(head.parent.rotation.y,normal);w.setView(view([]));assert.equal(head.rotation.y,0);
 }finally{w.dispose();}
});
test('button contact is animated identically while the bell voice alone is delayed',()=>{
 const a=createTemporalWorld(),b=createTemporalWorld();try{a.setView(view(['bell_after_departure']));b.setView(view());a.update(0,true);b.update(0,true);a.activate('bell',pose);b.activate('bell',pose);tick(a,.1);tick(b,.1);assert.equal(a.root.getObjectByName('Cloche — bouton').position.y,b.root.getObjectByName('Cloche — bouton').position.y);assert.equal(a.snapshot().voices.length,0);assert.equal(b.snapshot().voices.length,1);
 }finally{a.dispose();b.dispose();}
});
test('all new props disappear in other locations and disposal releases every resource once',()=>{
 const w=createTemporalWorld();const resources=new Set();w.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[o.material].flat():[]){resources.add(m);if(m.map)resources.add(m.map);}});const counters=new Map();for(const o of resources)o.addEventListener('dispose',()=>counters.set(o,(counters.get(o)||0)+1));w.setView(view([],{levelId:'metro'}));w.update(1,true);assert.equal(w.root.visible,false);assert.equal(w.snapshot().caption,'');w.dispose();w.dispose();assert.equal(w.root.children.length,0);for(const o of resources)assert.equal(counters.get(o),1);
});
