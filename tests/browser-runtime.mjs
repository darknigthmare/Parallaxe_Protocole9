/** Actual compiled UI + software WebGL; not a physical GPU / microphone / pad test. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {openQABrowser} from '../scripts/qa-native-browser.mjs';
const root=resolve('standalone-dist'),out=resolve('outputs/browser-interruptions');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const data=await readFile(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.ogg':'audio/ogg'};
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const report={scope:'Compiled game UI, Chromium and SwiftShader software WebGL',checks:[],physicalGPU:false,physicalMicrophone:false};
try{
 browser=await openQABrowser();
 await browser.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__p9qa={errors:[],microphoneRequests:0,draws:0};for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){const result=original.apply(this,args);__p9qa.draws++;return result;};}window.addEventListener('error',event=>__p9qa.errors.push(event.message));if(navigator.mediaDevices){const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{__p9qa.microphoneRequests++;return original(...args);};}`});
 const navigation=await browser.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});assert.ok(!navigation.errorText,navigation.errorText);
 await browser.waitFor("document.querySelector('.world-canvas')&&!document.querySelector('.loading-scene')&&!document.querySelector('.graphics-error')",45000);
 report.checks.push('compiled game starts with a real software WebGL2 context');
 report.build=JSON.parse(await readFile(resolve(root,'build-info.json'),'utf8'));
 report.browser=await browser.call('Browser.getVersion');
 report.renderer=await browser.evaluate("(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unexposed';})()");
 await browser.evaluate("document.querySelector('.secondary-action').click()");
 await browser.waitFor("document.querySelector('.modal-start .solid-button:not([disabled])')");
 await browser.evaluate("document.querySelector('.modal-start .solid-button').click()");
 await browser.waitFor("document.querySelector('.in-game')&&!document.querySelector('.modal-panel')");
 await browser.waitFor("(()=>{const raw=localStorage.getItem('parallaxe-training');return raw!==null&&JSON.parse(raw).phase==='reference';})()");
 await browser.evaluate("void(__p9qa.checkpoint=localStorage.getItem('parallaxe-training'))");
 report.checks.push('solo reference entered through actual menus');
 const captures=[];
 const capture=async name=>{const start=performance.now();const png=await browser.screenshot();assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),800);await writeFile(resolve(out,name),png);captures.push({file:name,width:1280,height:800,bytes:png.length,captureMs:Math.round(performance.now()-start)});};
 report.captures=captures;
 await capture('01-reference.png');
 await browser.evaluate("__p9qa.extension=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__p9qa.extension)throw Error('Context loss extension unavailable');__p9qa.extension.loseContext()");
 await browser.waitFor("document.querySelector('.graphics-error h2')?.textContent.includes('interrompu')");
 assert.equal(await browser.evaluate("document.querySelector('.modal-pause button.solid-button')?.disabled"),true);
 assert.equal(await browser.evaluate("document.querySelector('.graphics-error')?.contains(document.activeElement)"),true);
 report.checks.push('context loss displays technical warning, disables resume and focuses top overlay');
 await capture('02-context-lost.png');
 await sleep(500);await browser.evaluate('__p9qa.extension.restoreContext()');
 await browser.waitFor("!document.querySelector('.graphics-error')&&document.querySelector('.modal-pause .solid-button:not([disabled])')",30000);
 assert.equal(await browser.evaluate("__p9qa.checkpoint===localStorage.getItem('parallaxe-training')"),true);
 report.checks.push('restoration preserves solo checkpoint and stays paused for explicit resume');
 await browser.evaluate("__p9qa.beforeResume=__p9qa.draws;document.querySelector('.modal-pause .solid-button').click()");
 await browser.waitFor("!document.querySelector('.modal-panel')&&!document.querySelector('.graphics-error')");
 await browser.waitFor('__p9qa.draws>__p9qa.beforeResume',30000);
 assert.equal(await browser.evaluate("document.querySelector('canvas').getContext('webgl2').isContextLost()"),false);
 assert.equal(await browser.evaluate('__p9qa.microphoneRequests'),0);
 assert.deepEqual(await browser.evaluate('__p9qa.errors'),[]);
 report.checks.push('explicit resume issues fresh WebGL drawing calls without microphone requests or uncaught browser errors');
 await capture('03-restored-reference.png');
 assert.equal(await browser.evaluate("document.querySelector('canvas').getContext('webgl2').isContextLost()"),false);
 assert.equal(await browser.evaluate('__p9qa.checkpoint===localStorage.getItem("parallaxe-training")'),true);
 assert.equal(await browser.evaluate('__p9qa.microphoneRequests'),0);
 assert.deepEqual(await browser.evaluate('__p9qa.errors'),[]);
 report.checks.push('all three 1280x800 PNG captures complete and post-capture state remains valid');
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);
 if(browser)try{await writeFile(resolve(out,'failure.png'),await browser.screenshot());}catch{}
 throw error;}
finally{
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 console.log(JSON.stringify(report,null,2));
}
