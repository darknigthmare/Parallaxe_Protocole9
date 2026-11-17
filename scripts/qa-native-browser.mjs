/** Disposable, loopback-only CDP harness. No credentials or external services. */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

export async function openQABrowser(){
 const executable=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
 if(!executable)throw new Error('Chrome/Chromium unavailable; browser reception not run.');
 const profile=await mkdtemp(join(tmpdir(),'p9-browser-'));
 const child=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--window-size=1280,800','--force-device-scale-factor=1',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let launchError=null,launchOutput='';
 child.once('error',error=>{launchError=error;});
 child.stderr.on('data',chunk=>{launchOutput=(launchOutput+String(chunk)).slice(-8192);});
 let stage='process startup';const started=performance.now();
 let socket,sessionId,seq=0,closed=false;const pending=new Map();
 const close=async()=>{
  if(closed)return;closed=true;
  for(const task of pending.values()){clearTimeout(task.timer);task.reject(new Error('Browser closed'));}pending.clear();
  socket?.close();child.kill('SIGTERM');await sleep(200);await rm(profile,{recursive:true,force:true}).catch(()=>{});
 };
 try{
  let port,browserPath;
  // One bounded launch, not a retry of a failed scenario. No user profile is accessed.
  const launchDeadline=performance.now()+30000;
  while(performance.now()<launchDeadline){
   if(launchError)throw new Error('Browser launch failed: '+launchError.message);
   if(child.exitCode!==null||child.signalCode!==null)throw new Error('Browser exited before CDP was available: '+(child.exitCode??child.signalCode)+' / '+launchOutput);
   try{const lines=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');
    port=Number(lines[0]);browserPath=lines[1];
    if(Number.isInteger(port)&&port>0&&port<65536&&/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath??''))break;
    port=undefined;
   }catch{}
   await sleep(100);
  }
  if(!port)throw new Error('Browser startup timed out after 30 seconds: '+launchOutput);
  // Use the browser's published socket directly. An extra HTTP /json/list probe
  // could time out independently of a healthy CDP process on a loaded runner.
  stage='browser socket';socket=new WebSocket(`ws://127.0.0.1:${port}${browserPath}`);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('CDP socket timed out')),5000);
   socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP socket failed'));},{once:true});
  });
  socket.addEventListener('message',event=>{
   const message=JSON.parse(event.data),task=pending.get(message.id);if(!task)return;
   pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(new Error('CDP '+JSON.stringify(message.error))):task.resolve(message.result??{});
  });
  // Restored software WebGL may need shader warm-up before a surface capture.
  // Keep ordinary commands strict; never retry a failed capture as a passing test.
  const call=(method,params={})=>new Promise((resolve,reject)=>{
   const timeout=['Page.captureScreenshot','Runtime.evaluate'].includes(method)?60000:15000;
   const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},timeout);
   pending.set(id,{resolve,reject,timer});
   const browserCommand=method.startsWith('Browser.')||method.startsWith('Target.');
   socket.send(JSON.stringify({id,method,params,...(sessionId&&!browserCommand?{sessionId}:{})}));
  });
  const evaluate=async expression=>{
   const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
   if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
   return result.result?.value;
  };
  const waitFor=async(expression,timeout=20000)=>{
   const end=Date.now()+timeout;
   while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await sleep(150);}
   throw new Error('Browser condition timed out: '+expression);
  };
  stage='page attachment';
  const {targetInfos}=await call('Target.getTargets');
  const target=targetInfos.find(x=>x.type==='page'&&x.url==='about:blank');
  if(!target)throw new Error('Disposable browser has no blank page target');
  ({sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true}));
  stage='page initialization';
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  return {call,evaluate,waitFor,close,screenshot:async()=>Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,optimizeForSpeed:true})).data,'base64')};
 }catch(error){const diagnostic=new Error(`Browser startup failed at ${stage} after ${Math.round(performance.now()-started)}ms: ${error?.message??error} / ${launchOutput}`);await close();throw diagnostic;}
}
