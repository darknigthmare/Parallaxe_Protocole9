/** Real compiled UI and native keyboard events. The standard controller API is an explicit fixture. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {openQABrowser} from '../scripts/qa-native-browser.mjs';
const root=resolve('standalone-dist'),out=resolve('outputs/browser-menus');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const data=await readFile(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const report={scope:'Compiled game, real Chromium keyboard and focus; simulated standard controller, SwiftShader',checks:[],captures:[],physicalGPU:false,physicalController:false,screenReader:false};
try{
 browser=await openQABrowser();report.build=JSON.parse(await readFile(resolve(root,'build-info.json'),'utf8'));
 await browser.call('Page.addScriptToEvaluateOnNewDocument',{source:"window.__menuqa={errors:[],mic:0,lastKey:null};addEventListener('keydown',e=>{__menuqa.lastKey={key:e.key,shift:e.shiftKey,alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,repeat:e.repeat,trusted:e.isTrusted};},true);addEventListener('error',e=>__menuqa.errors.push(e.message));if(navigator.mediaDevices){const f=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{__menuqa.mic++;return f(...args);};}"});
 const navigation=await browser.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});assert.ok(!navigation.errorText,navigation.errorText);
 await browser.waitFor("document.querySelector('.world-canvas')&&!document.querySelector('.loading-scene')&&!document.querySelector('.graphics-error')",45000);
 report.browser=await browser.call('Browser.getVersion');
 const frame=()=>browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 // CDP modifier flags are Alt=1, Ctrl=2, Meta=4, Shift=8, unlike DOM key codes.
 // Named options and assertions on the received native event prevent false UX failures.
 async function key(key,code,n,{shift=false,repeat=false}={}){
  await browser.evaluate('__menuqa.lastKey=null');
  for(const type of ['keyDown','keyUp'])await browser.call('Input.dispatchKeyEvent',{
   type,key,code,windowsVirtualKeyCode:n,modifiers:shift?8:0,autoRepeat:repeat});
  await frame();
  assert.deepEqual(await browser.evaluate('__menuqa.lastKey'),
   {key,shift,alt:false,ctrl:false,meta:false,repeat,trusted:true},'Native keyboard gesture received by the game');
 }
 async function click(selector,text){
  const point=await browser.evaluate(`(()=>{const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>${text===undefined?'true':`n.textContent.includes(${JSON.stringify(text)})`});if(!n||n.disabled)return null;n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{x,y,hit:n.contains(document.elementFromPoint(x,y))};})()`);
  assert.ok(point?.hit,'Clickable actual control: '+selector+' / '+(text??''));
  for(const type of ['mousePressed','mouseReleased'])await browser.call('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});await frame();
 }
 async function capture(name){const png=await browser.screenshot();assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');await writeFile(resolve(out,name),png);report.captures.push({file:name,bytes:png.length,width:png.readUInt32BE(16),height:png.readUInt32BE(20)});}
 await click('.menu-secondary button','Paramètres');await browser.waitFor("document.querySelector('.modal-settings')?.contains(document.activeElement)");
 assert.equal(await browser.evaluate("document.querySelector('.menu-header').inert"),true);
 await browser.evaluate("document.querySelector('.primary-action').focus()");
 assert.equal(await browser.evaluate("document.querySelector('.modal-settings').contains(document.activeElement)"),true);
 await key('Tab','Tab',9,{shift:true});
 assert.equal(await browser.evaluate("document.querySelector('.modal-settings').contains(document.activeElement)"),true);
 await key('Tab','Tab',9);
 assert.equal(await browser.evaluate("document.activeElement===document.querySelector('.modal-top button')"),true);
 report.checks.push('Settings owns native Tab/Shift+Tab and background controls cannot steal focus');
 await key('Escape','Escape',27);await browser.waitFor("!document.querySelector('.modal-panel')");
 assert.equal(await browser.evaluate("document.activeElement.textContent.includes('Paramètres')"),true);
 assert.equal(await browser.evaluate("document.querySelectorAll('.game-root [inert]').length"),0);
 report.checks.push('Escape closes once, returns to the opening control and restores background interaction');

 await click('.primary-action');await browser.waitFor("document.querySelector('.modal-coop')");
 await browser.evaluate("__menuqa.pad={id:'QA standard',index:2,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[null,null,__menuqa.pad]});");await frame();
 await click('.modal-coop input[maxlength="24"]');
 await browser.evaluate('__menuqa.pad.buttons[0].pressed=true');await browser.waitFor("document.querySelector('.pad-keyboard')?.contains(document.activeElement)");
 await browser.evaluate('__menuqa.pad.buttons[0].pressed=false');await frame();
 assert.equal(await browser.evaluate("document.querySelector('.modal-backdrop').inert"),true);
 await key('Tab','Tab',9,{shift:true});assert.equal(await browser.evaluate("document.activeElement.textContent==='Annuler'"),true);
 await key('Tab','Tab',9);assert.equal(await browser.evaluate("document.activeElement.textContent==='A'"),true);
 await capture('01-clavier-virtuel-focus.png');
 await key('Escape','Escape',27);await browser.waitFor("!document.querySelector('.pad-keyboard')&&document.querySelector('.modal-coop')");
 assert.equal(await browser.evaluate("document.activeElement===document.querySelector('.modal-coop input[maxlength=\"24\"]')"),true);
 report.checks.push('Nested virtual keyboard wraps focus and one Escape returns to the edited field, not the game');
 await browser.evaluate('__menuqa.pad.buttons[0].pressed=true');await browser.waitFor("document.querySelector('.pad-keyboard')");
 await browser.evaluate('__menuqa.pad.buttons[0].pressed=false');await frame();
 await click('.pad-keys button','Z');await click('.pad-key-actions button','Valider le texte');
 await browser.waitFor("!document.querySelector('.pad-keyboard')");
 assert.equal(await browser.evaluate("document.querySelector('.modal-coop input[maxlength=\"24\"]').value"),'InspecteurZ');
 assert.equal(await browser.evaluate("document.activeElement===document.querySelector('.modal-coop input[maxlength=\"24\"]')"),true);
 assert.equal(await browser.evaluate("document.querySelector('.modal-coop')!==null"),true);
 report.checks.push('Virtual-keyboard confirmation updates the controlled field without creating a network room');
 await key('Escape','Escape',27);await browser.waitFor("!document.querySelector('.modal-panel')");
 assert.equal(await browser.evaluate("document.activeElement===document.querySelector('.primary-action')"),true);
 report.checks.push('Closing the parent after nested editing still restores the original menu opener');
 await browser.evaluate('__menuqa.pad=null');await frame();

 await click('.secondary-action');await browser.waitFor("document.querySelector('.modal-start')");await click('.modal-start .solid-button');
 await browser.waitFor("document.querySelector('.in-game')&&!document.querySelector('.modal-panel')");
 await click('.field-actions button[title^="Carnet"]');await browser.waitFor("document.querySelector('.modal-journal')");
 await key('Escape','Escape',27);assert.equal(await browser.evaluate("document.querySelector('.modal-panel')===null"),true);
 await key('Escape','Escape',27);await browser.waitFor("document.querySelector('.modal-pause')");
 await key('Escape','Escape',27,{repeat:true});assert.equal(await browser.evaluate("document.querySelector('.modal-pause')!==null"),true);
 report.checks.push('One Escape closes the in-game journal without reopening Pause; key repeat cannot close a second layer');
 await click('.modal-pause .outline-button','Paramètres');await browser.waitFor("document.querySelector('.modal-settings')");
 await key('Escape','Escape',27);await browser.waitFor("!document.querySelector('.modal-panel')");
 assert.equal(await browser.evaluate("document.querySelectorAll('.game-root [inert]').length"),0);
 report.checks.push('Switching Pause to Settings and closing leaves no inert gameplay controls');

 await browser.evaluate("__menuqa.loss=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');__menuqa.loss.loseContext()");
 await browser.waitFor("document.querySelector('.graphics-error')?.contains(document.activeElement)");
 assert.equal(await browser.evaluate("document.querySelector('.graphics-error').getAttribute('role')"),'alertdialog');
 assert.equal(await browser.evaluate("document.activeElement.tagName"),'SUMMARY');
 await key('Enter','Enter',13);assert.equal(await browser.evaluate("document.querySelector('.graphics-error details').open"),true);
 await key('Tab','Tab',9,{shift:true});assert.equal(await browser.evaluate("document.activeElement.textContent==='Accéder aux menus'"),true);
 await key('Escape','Escape',27);await browser.waitFor("!document.querySelector('.graphics-error')&&document.querySelector('.modal-pause .graphics-notice')");
 await click('.modal-pause .graphics-notice');await browser.waitFor("document.querySelector('.graphics-error')?.contains(document.activeElement)");
 await capture('02-alerte-accessible.png');
 report.checks.push('Graphics warning has named dialog semantics, keyboard-accessible technical details and a reachable reminder within Pause');
 await browser.evaluate('__menuqa.loss.restoreContext()');await browser.waitFor("!document.querySelector('.graphics-error')&&document.querySelector('.modal-pause .solid-button:not([disabled])')",30000);
 await key('Tab','Tab',9);assert.equal(await browser.evaluate("document.querySelector('.modal-pause').contains(document.activeElement)"),true);
 assert.equal(await browser.evaluate('__menuqa.mic'),0);assert.deepEqual(await browser.evaluate('__menuqa.errors'),[]);
 report.checks.push('After context restoration focus remains in Pause; no microphone request or uncaught exception');
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);report.stack=error?.stack;if(browser)try{await writeFile(resolve(out,'failure.png'),await browser.screenshot());}catch{}throw error;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report,null,2));}
