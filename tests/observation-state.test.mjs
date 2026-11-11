import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const dir = await mkdtemp(join(tmpdir(), 'p9-observation-'));
await writeFile(join(dir, 'state.mjs'), stripTypeScriptTypes(await readFile(new URL('../src/game/observation-state.ts', import.meta.url), 'utf8')));
const { createObservationState, starIndices } = await import(pathToFileURL(join(dir, 'state.mjs')));
test.after(() => rm(dir, {recursive:true, force:true}));
const atPhoto = { x:-1.8, z:-14.2 };
const view = (effects=[],extra={}) => ({levelId:'hotel', phase:'inspect', loop:1, effects,...extra});
function tick(state, seconds, pose=atPhoto, fps=60, active=true) {for(let i=0;i<Math.round(seconds*fps);i++)state.update(1/fps,pose,active);}

test('two four-point observations reconstruct exactly the six normal positions',()=>{
 const left=starIndices('left'),right=starIndices('right');
 assert.equal(left.length,4);assert.equal(right.length,4);
 assert.equal(new Set([...left,...right]).size,6);
 assert.equal(left.filter(x=>right.includes(x)).length,2);
 assert.deepEqual(starIndices('all'),[0,1,2,3,4,5]);
});
test('reference ignores masks and effects, ordinary views always contain six stars',()=>{
 const s=createObservationState();s.setView(view(['paired_stars'],{starMask:'right',phase:'reference'}));
 assert.deepEqual(s.snapshot().starIndices,starIndices('all'));
 s.setView(view());assert.deepEqual(s.snapshot().starIndices,starIndices('all'));
 s.setView(view([],{starMask:'left'}));assert.deepEqual(s.snapshot().starIndices,starIndices('left'));
});
for(const fps of [10,30,60,144])test(`portrait threshold, progressive aging and latching at ${fps} fps`,()=>{
 const s=createObservationState();s.setView(view(['photo_age']));
 tick(s,9.9,atPhoto,fps);assert.equal(s.snapshot().photoAge,0);
 tick(s,6.1,atPhoto,fps);assert.ok(Math.abs(s.snapshot().photoAge-.5)<.02);
 tick(s,6,atPhoto,fps);assert.ok(s.snapshot().photoAge>.99);
 tick(s,2,{x:0,z:9},fps);assert.ok(s.snapshot().photoAge>.99);
 s.setView(view(['photo_age']));assert.ok(s.snapshot().photoAge>.99,'polling must not restart animation');
 s.setView(view([]));assert.equal(s.snapshot().photoAge,0);
 s.setView(view(['photo_age']));assert.ok(s.snapshot().photoAge>.99,'solo A/B must preserve aged view');
 s.setView(view(['photo_age'],{loop:2}));assert.equal(s.snapshot().photoAge,0);
});
test('outside portrait zone, paused, hidden, invalid dt/pose and other levels do not age',()=>{
 const s=createObservationState();s.setView(view(['photo_age']));
 tick(s,50,{x:0,z:9});tick(s,50,atPhoto,60,false);s.update(NaN,atPhoto);s.update(-3,atPhoto);s.update(.05,{x:NaN,z:-14});
 assert.equal(s.snapshot().photoAge,0);
 s.setView(view(['photo_age'],{levelId:'cabin'}));tick(s,50);assert.equal(s.snapshot().photoAge,0);
});
test('ceiling figure begins in the second half, persists and resets on next passage',()=>{
 const s=createObservationState();s.setView(view(['ceiling_walker']));
 tick(s,2,{x:0,z:2});assert.equal(s.snapshot().walkerVisible,false);
 tick(s,2,{x:0,z:-4});assert.equal(s.snapshot().walkerVisible,true);assert.ok(s.snapshot().walkerTime>1.9);
 tick(s,1,{x:0,z:2});assert.equal(s.snapshot().walkerVisible,true);
 s.setView(view([],{}));assert.equal(s.snapshot().walkerVisible,false);
 s.setView(view(['ceiling_walker']));assert.equal(s.snapshot().walkerVisible,true);
 s.setView(view(['ceiling_walker'],{loop:2}));assert.equal(s.snapshot().walkerVisible,false);
});
test('all private effects restore reference and are unavailable outside Saint-Clair',()=>{
 const s=createObservationState();s.setView(view(['stair_wrong_shadow','photo_age','ceiling_walker']));tick(s,30);
 assert.equal(s.snapshot().stairShadow,true);
 s.setView(view(['stair_wrong_shadow','photo_age','ceiling_walker'],{phase:'reference'}));
 assert.deepEqual(s.snapshot(),{starIndices:[0,1,2,3,4,5],photoAge:0,stairShadow:false,walkerVisible:false,walkerTime:0});
 s.setView(view(['stair_wrong_shadow'],{levelId:'metro'}));assert.equal(s.snapshot().stairShadow,false);
});
test('reveal freezes rather than advancing a pending transformation',()=>{
 const s=createObservationState();s.setView(view(['photo_age']));tick(s,15);const before=s.snapshot().photoAge;
 s.setView(view(['photo_age'],{phase:'reveal'}));tick(s,15);assert.equal(s.snapshot().photoAge,before);
});
