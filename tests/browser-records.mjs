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
  // Rotate through the real drag-to-look path, then use the actual interaction key.
  // Coordinates derive from the common entry document, not from a private anomaly.
  const yaw=Math.atan2(1.8,-(11.913-9)),pitch=Math.atan2(-.05,Math.hypot(1.8,11.913-9));
  const start={x:1210,y:400},end={x:1210-yaw/.0022,y:400-pitch/.0022};
  assert.equal(await browser.evaluate(`document.elementFromPoint(${start.x},${start.y})?.classList.contains('world-canvas')`),true);
  await browser.call('Input.dispatchMouseEvent',{type:'mouseMoved',...start});
  await browser.call('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
  await browser.call('Input.dispatchMouseEvent',{type:'mouseMoved',...end,buttons:1});
  await browser.call('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});
  await browser.waitFor(`document.querySelector('.target-label')?.textContent.includes(${JSON.stringify('Consigne '+id)})`);
  await capture(`${index+1}-${levelId}-physical-document.png`);
  for(const type of ['keyDown','keyUp'])await browser.call('Input.dispatchKeyEvent',{type,key:'e',code:'KeyE',windowsVirtualKeyCode:69});
  await browser.waitFor(`document.querySelector('.modal-fieldDocument [data-note-id="${id}"]')`);
  if(levelId==='hotel')await capture('field-document-reader.png');
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
  report.checks.push(`${levelId}: actual menu selection, physical sheet targeted by real drag and interaction key, explicit local copy`);
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
 // Inspect the Blob produced by the actual export button, without changing its contents.
 await click('.menu-secondary button','Paramètres');await browser.waitFor("document.querySelector('.modal-settings')");
 await browser.evaluate("__recordsQA.createURL=URL.createObjectURL;URL.createObjectURL=function(blob){__recordsQA.exported=blob;return __recordsQA.createURL.call(this,blob);};");
 await click('.utility-settings button','Exporter la sauvegarde solo');
 await browser.waitFor('__recordsQA.exported instanceof Blob');
 const exportedText=await browser.evaluate('__recordsQA.exported.text()'),exported=JSON.parse(exportedText);
 await browser.evaluate('URL.createObjectURL=__recordsQA.createURL');
 assert.equal(exported.format,'parallaxe-training-backup-v2');
 assert.deepEqual(exported.fieldNotes,['SC-01','T9-01','AB-01','CH-01','O9-01']);
 assert.doesNotMatch(exportedText,/seed|token|observer|paragraphs|namedVoiceAllowed/);
 report.checks.push('actual export button produces v2 JSON with five note IDs and no hidden state');
 // A disposable local-storage fixture models another device with just one kept note.
 await browser.evaluate("localStorage.setItem('parallaxe-field-notes',JSON.stringify({format:'parallaxe-field-notes-v1',ids:['SC-01']}))");
 await browser.call('Page.reload',{ignoreCache:true});await ready();
 async function importFile(value,name){
  await click('.menu-secondary button','Paramètres');await browser.waitFor("document.querySelector('.modal-settings')");
  const file=join(temp,name);await writeFile(file,JSON.stringify(value));
  const {root:document}=await browser.call('DOM.getDocument');
  const {nodeId}=await browser.call('DOM.querySelector',{nodeId:document.nodeId,selector:'input[aria-label="Importer une sauvegarde solo"]'});
  assert.ok(nodeId);await browser.call('DOM.setFileInputFiles',{nodeId,files:[file]});
  await browser.waitFor("document.querySelector('.backup-preview')");
 }
 await importFile(exported,'notes-v2.json');
 assert.deepEqual(await browser.evaluate("JSON.parse(localStorage.getItem('parallaxe-field-notes')).ids"),['SC-01'],'Preview is read-only');
 // A present preview can still be below the settings fold. Capture its actual viewport.
 await browser.evaluate("document.querySelector('.backup-preview').scrollIntoView({block:'center'})");
 assert.equal(await browser.evaluate("(()=>{const n=document.querySelector('.backup-preview .solid-button'),r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()"),true);
 await capture('backup-notes-preview.png');
 await click('.backup-preview .solid-button');await browser.waitFor("!document.querySelector('.backup-preview')");
 await click('.modal-top .icon-button');await click('.menu-secondary button','Archives');
 await browser.waitFor("document.querySelectorAll('.mission-record-archive [data-note-id]').length===5");
 assert.equal(await browser.evaluate("document.querySelectorAll('.archive-grid .unlocked').length"),0);
 report.checks.push('v2 confirmed import merges notes and immediately refreshes Archives without unlocking anomalies');
 await click('.modal-top .icon-button');
 const {fieldNotes,...legacy}=exported;legacy.format='parallaxe-training-backup-v1';
 await importFile(legacy,'notes-legacy-v1.json');await click('.backup-preview .solid-button');
 await browser.waitFor("!document.querySelector('.backup-preview')");
 assert.deepEqual(await browser.evaluate("JSON.parse(localStorage.getItem('parallaxe-field-notes')).ids"),exported.fieldNotes);
 await click('.modal-top .icon-button');
 report.checks.push('legacy v1 import keeps the five existing notes and requires the same explicit confirmation');
 // Start from a documented local reference checkpoint, then resolve the last case through actual UI.
 // The fixture computes its expected answer outside the page; no oracle ships in the game.
 for(const victory of [true,false]){
  const fixture={...createRun({seed:'records-browser-fixture',mode:victory?'campaign':'single',levelId:victory?'clinic':'cabin'}),levelId:victory?'clinic':'cabin',stage:victory?2:0,stageProgress:victory?2:0,streak:victory?8:0,correctTotal:victory?8:0,strikes:victory?0:2,loop:victory?8:2};
  const caseRun=advanceRun(fixture),hasAnomaly=caseRun.currentAnomalyId!==null,vote= victory?hasAnomaly:!hasAnomaly;
  if(victory)await browser.evaluate("localStorage.setItem('parallaxe-preferences',JSON.stringify({...JSON.parse(localStorage.getItem('parallaxe-preferences')||'{}'),reduceMotion:true}))");
  await browser.evaluate(`localStorage.setItem('parallaxe-training',${JSON.stringify(JSON.stringify(fixture))})`);
  await assertQuiet();await browser.call('Page.reload',{ignoreCache:true});await ready();
  if(victory){
   await browser.call('Emulation.setDeviceMetricsOverride',{width:640,height:420,deviceScaleFactor:1,mobile:false});
   await browser.waitFor('innerWidth===640');
   await click('.resume-link','Reprendre l’inspection');
   await browser.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
   report.checks.push('Saved campaign can be resumed above the footer at 640×420');
  }else{
   await click('.resume-link','Reprendre l’inspection');
  }
  await browser.waitFor("document.querySelector('.in-game')&&!document.querySelector('.modal-panel')");
  await click('.diagnostic-button');await browser.waitFor("JSON.parse(localStorage.getItem('parallaxe-training')).phase==='inspect'");
  await click('.diagnostic-button');await browser.waitFor("document.querySelector('.modal-vote')");
  await click(vote?'.vote-options .vote-danger':'.vote-options button:not(.vote-danger)');
  await browser.waitFor("document.querySelector('.mission-debrief')");
  assert.match(await browser.evaluate("document.querySelector('.mission-debrief').dataset.debriefId"),victory?/campaign-clinic-clear$/:/single-cabin-interrupted$/);
  await browser.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await browser.waitFor('innerWidth===390');
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=390'),true);
  await browser.waitFor("!document.querySelector('.toast')");
  await capture(victory?'7-victory-mobile.png':'8-defeat-mobile.png',390,844);
  assert.equal(await browser.evaluate("!!document.querySelector('.concordance-open')"),victory);
  if(victory){
   const reportBefore=await browser.evaluate("document.querySelector('.mission-debrief').textContent");
   await click('.concordance-open');
   await browser.waitFor("document.querySelector('.concordance-film[data-view=scene][data-playing=false]')");
   assert.equal(await browser.evaluate("document.querySelector('.concordance-film h3').textContent"),'La relève du matin');
   assert.equal(await browser.evaluate("document.querySelector('.concordance-controls button').disabled"),true);
   await capture('concordance-1-aube-mobile.png',390,844);
   await click('.concordance-controls button','Plan suivant');
   await browser.waitFor("document.querySelector('.concordance-film h3')?.textContent==='Trois dépositions'");
   await capture('concordance-2-depositions-mobile.png',390,844);
   await click('.concordance-controls button','Plan suivant');
   await browser.waitFor("document.querySelector('.concordance-film h3')?.textContent==='Un seul itinéraire'");
   await capture('concordance-3-itineraire-mobile.png',390,844);
   assert.equal(await browser.evaluate("document.querySelectorAll('.concordance-controls button')[1].disabled"),true);
   await click('.concordance-controls button','Plan précédent');
   await click('.concordance-controls button','Lecture animée');
   await browser.waitFor("document.querySelector('.concordance-film[data-playing=true]')");
   await browser.waitFor("document.querySelector('.concordance-film h3')?.textContent==='Un seul itinéraire'");
   await browser.waitFor("document.querySelector('.concordance-controls')?.textContent.includes('Revoir la séquence')");
   await browser.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
   await browser.waitFor("innerWidth===1280 && document.querySelector('.concordance-film canvas').clientWidth>500");
   await capture('concordance-3-itineraire-desktop.png');
   await click('.concordance-controls button','Revoir la séquence');
   await browser.waitFor("document.querySelector('.concordance-film h3')?.textContent==='La relève du matin'");
   await click('.modal-concordance .solid-button','Retour au bilan');
   await browser.waitFor("!document.querySelector('.modal-panel')&&document.activeElement===document.querySelector('.concordance-open')");
   await click('.concordance-open');
   await browser.waitFor("document.querySelector('.concordance-film[data-view=scene]')");
   const loss=await browser.evaluate("(()=>{const ext=document.querySelector('.concordance-film canvas').getContext('webgl2').getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;})()");
   assert.ok(loss,'Context loss extension available in test renderer');
   await browser.waitFor("document.querySelector('.concordance-film[data-view=text]')");
   await click('.concordance-controls button','Plan suivant');
   await browser.waitFor("document.querySelector('.concordance-film h3')?.textContent==='Trois dépositions'");
   await click('.modal-concordance .solid-button','Retour au bilan');
   assert.equal(await browser.evaluate("document.querySelector('.mission-debrief').textContent"),reportBefore);
   await browser.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
   await browser.waitFor('innerWidth===390');
   report.checks.push('Concordance: clean campaign, static frames in comfort mode, native controls and captions, animated completion/replay, local context loss, unchanged report and restored focus');
  }

  await browser.evaluate("document.querySelector('.result-panel .solid-button').scrollIntoView({block:'center'})");
  await capture(victory?'9-victory-exit-mobile.png':'10-defeat-exit-mobile.png',390,844);
  await click('.result-panel .solid-button');await browser.waitFor("document.querySelector('.in-menu')&&!document.querySelector('.result-overlay')");
  await browser.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  report.checks.push(`${victory?'Victory':'Defeat'}: resolved from a local reference fixture via actual controls; correct debrief and reachable exit at 390x844`);
 }
 await assertQuiet();
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);if(browser)try{await writeFile(resolve(out,'failure.png'),await browser.screenshot());}catch{}throw error;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));}
