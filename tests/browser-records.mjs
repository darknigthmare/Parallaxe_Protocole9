/** Actual compiled menus, five scenes and local records. Fixtures are confined to a disposable browser profile. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {openQABrowser} from '../scripts/qa-native-browser.mjs';
const root=resolve('standalone-dist'),out=resolve('outputs/browser-records');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'p9-record-fixture-'));
for(const name of ['levels','catalog','rules'])await writeFile(join(temp,name+'.mjs'),stripTypeScriptTypes(await readFile(resolve('src/game',name+'.ts'),'utf8')).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
const {createRun,advanceRun}=await import(pathToFileURL(join(temp,'rules.mjs')));
const server=createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const data=await readFile(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.ogg':'audio/ogg'};
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const report={scope:'Five actual compiled locations, native menus and local note persistence; software WebGL, not hardware or human QA',checks:[],captures:[],physicalGPU:false,physicalMobile:false};
try{
 browser=await openQABrowser();report.build=JSON.parse(await readFile(resolve(root,'build-info.json'),'utf8'));
 await browser.call('Page.addScriptToEvaluateOnNewDocument',{source:"window.__recordsQA={errors:[],microphoneRequests:0};window.addEventListener('error',e=>__recordsQA.errors.push(e.message));if(navigator.mediaDevices){const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{__recordsQA.microphoneRequests++;return original(...args);};}"});
 const nav=await browser.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});assert.ok(!nav.errorText,nav.errorText);
 const ready=()=>browser.waitFor("document.querySelector('.world-canvas')&&!document.querySelector('.loading-scene')&&!document.querySelector('.graphics-error')",45000);
 await ready();report.browser=await browser.call('Browser.getVersion');
 report.renderer=await browser.evaluate("(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unexposed';})()");
 async function click(selector,text){
  const p=await browser.evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>${text===undefined?'true':`n.textContent.includes(${JSON.stringify(text)})`});if(!n||n.disabled)return null;n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:n.contains(document.elementFromPoint(x,y))};})()`);
  assert.ok(p?.hit,`Reachable control: ${selector} / ${text??''}`);
  for(const type of ['mousePressed','mouseReleased'])await browser.call('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',clickCount:1});
 }
 async function assertQuiet(){assert.equal(await browser.evaluate('__recordsQA.microphoneRequests'),0);assert.deepEqual(await browser.evaluate('__recordsQA.errors'),[]);}
 async function capture(name,width=1280,height=800){
  const png=await browser.screenshot();assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  await writeFile(resolve(out,name),png);report.captures.push({file:name,width,height,bytes:png.length});
 }
 const locations=[['hotel','Saint-Clair','SC-01'],['metro','Terminus 09','T9-01'],['clinic','Aile blanche','AB-01'],['cabin','Chalet','CH-01'],['observatory','Observatoire 09','O9-01']];
 for(const [index,[levelId,label,id]]of locations.entries()){
  await click('.secondary-action');await browser.waitFor("document.querySelector('.modal-start')");
  await click('.mission-modes button','Lieu au choix');await browser.waitFor("document.querySelector('.location-choices button')");await click('.location-choices button',label);
  await click('.modal-start .solid-button');await browser.waitFor("document.querySelector('.in-game')&&!document.querySelector('.modal-panel')");
  await browser.waitFor(`JSON.parse(localStorage.getItem('parallaxe-training')||'null')?.levelId===${JSON.stringify(levelId)}`);
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('parallaxe-field-notes')||'{\"ids\":[]}').ids.length"),index,'Entering a location must not silently collect its note');
  await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
  await capture(`${index+1}-${levelId}-reference.png`);
  await click('.field-actions .icon-button');await browser.waitFor(`document.querySelector('.modal-journal [data-note-id="${id}"]')`);
  assert.equal(await browser.evaluate("!!document.querySelector('.mission-debrief')"),false);
  if(levelId==='metro'){
   await browser.evaluate("window.__recordsQA.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='parallaxe-field-notes')throw new DOMException('quota','QuotaExceededError');return __recordsQA.originalSet.call(this,k,v);};");
   await click('.mission-record button');await browser.waitFor("document.querySelector('.mission-record [role=status]')?.textContent.includes('non conservée')");
   assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('parallaxe-field-notes')).ids.length"),index);
   await browser.evaluate('Storage.prototype.setItem=__recordsQA.originalSet');
   report.checks.push('a real browser storage-write failure does not report success or change stored notes');
  }
  await click('.mission-record button');await browser.waitFor("document.querySelector('.mission-record button')?.disabled");
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('parallaxe-field-notes')).ids.includes(${JSON.stringify(id)})`),true);
  report.checks.push(`${levelId}: actual menu selection, rendered reference, matching dossier and explicit local collection`);
  await click('.modal-top .icon-button');await click('.game-header .icon-button');await browser.waitFor("document.querySelector('.modal-pause')");
  await click('.quit-button');await click('.leave-confirm .danger-button');await browser.waitFor("document.querySelector('.in-menu')&&!document.querySelector('.modal-panel')");
 }
 await assertQuiet();await browser.call('Page.reload',{ignoreCache:true});await ready();
 await click('.menu-secondary button','Archives');await browser.waitFor("document.querySelector('.mission-record-archive')");
 assert.equal(await browser.evaluate("document.querySelectorAll('.mission-record-archive [data-note-id]').length"),5);
 assert.equal(await browser.evaluate("document.querySelectorAll('.archive-grid .unlocked').length"),0,'Field notes do not unlock anomaly spoilers');
 await capture('6-notes-after-reload.png');
 report.checks.push('five notes survive a real page reload while all undiscovered anomaly dossiers stay locked');
 await click('.modal-top .icon-button');
 // Start from a documented local reference checkpoint, then resolve the last case through actual UI.
 // The fixture computes its expected answer outside the page; no oracle ships in the game.
 for(const victory of [true,false]){
  const fixture={...createRun({seed:'records-browser-fixture',mode:victory?'campaign':'single',levelId:victory?'clinic':'cabin'}),levelId:victory?'clinic':'cabin',stage:victory?2:0,stageProgress:victory?2:0,streak:victory?8:0,correctTotal:victory?8:0,strikes:victory?0:2,loop:victory?8:2};
  const caseRun=advanceRun(fixture),hasAnomaly=caseRun.currentAnomalyId!==null,vote= victory?hasAnomaly:!hasAnomaly;
  await browser.evaluate(`localStorage.setItem('parallaxe-training',${JSON.stringify(JSON.stringify(fixture))})`);
  await assertQuiet();await browser.call('Page.reload',{ignoreCache:true});await ready();
  await click('.resume-link','Reprendre l’inspection');await browser.waitFor("document.querySelector('.in-game')&&!document.querySelector('.modal-panel')");
  await click('.diagnostic-button');await browser.waitFor("JSON.parse(localStorage.getItem('parallaxe-training')).phase==='inspect'");
  await click('.diagnostic-button');await browser.waitFor("document.querySelector('.modal-vote')");
  await click(vote?'.vote-options .vote-danger':'.vote-options button:not(.vote-danger)');
  await browser.waitFor("document.querySelector('.mission-debrief')");
  assert.match(await browser.evaluate("document.querySelector('.mission-debrief').dataset.debriefId"),victory?/campaign-clinic-clear$/:/single-cabin-interrupted$/);
  await browser.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await browser.waitFor('innerWidth===390');
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=390'),true);
  await capture(victory?'7-victory-mobile.png':'8-defeat-mobile.png',390,844);
  await click('.result-panel .solid-button');await browser.waitFor("document.querySelector('.in-menu')&&!document.querySelector('.result-overlay')");
  await browser.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  report.checks.push(`${victory?'Victory':'Defeat'}: resolved from a local reference fixture via actual controls; correct debrief and reachable exit at 390x844`);
 }
 await assertQuiet();
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);if(browser)try{await writeFile(resolve(out,'failure.png'),await browser.screenshot());}catch{}throw error;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));}
