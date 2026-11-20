/** Disposable Chromium process. CDP only uses the two inherited debugging pipes. */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

export async function openQABrowser(){
 const configured=process.env.PARALLAXE_QA_CHROME;
 const candidates=configured?[configured]:['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
 const executable=candidates.find(existsSync);
 if(!executable)throw new Error('Chrome/Chromium unavailable; browser reception not run.');
 const profile=await mkdtemp(join(tmpdir(),'p9-browser-'));
 const started=performance.now();
 const child=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-pipe','--window-size=1280,800','--force-device-scale-factor=1',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+profile,'about:blank'],
  {stdio:['ignore','ignore','pipe','pipe','pipe']});
 const commands=child.stdio[3],responses=child.stdio[4];
 const pending=new Map();
 let stage='browser startup',launchOutput='',sessionId,seq=0,closed=false,transportError=null;
 function disconnect(error){
  if(transportError)return;
  transportError=error;
  for(const task of pending.values()){
   clearTimeout(task.timer);
   task.reject(error);
  }
  pending.clear();
 }
 const exited=new Promise(resolve=>child.once('close',(code,signal)=>{
  disconnect(new Error('Browser exited: '+(signal??code)));
  resolve();
 }));
 child.on('error',disconnect);
 child.stderr.on('data',chunk=>{launchOutput=(launchOutput+String(chunk)).slice(-8192);});
 commands.on('error',disconnect);
 responses.on('error',disconnect);
 responses.on('end',()=>disconnect(new Error('Browser closed its debugging pipe')));

 // CDP frames end with a NUL byte. A screenshot can span many stream chunks.
 // Decode UTF-8 incrementally, and parse only when a complete frame arrives.
 const fragments=[];
 responses.setEncoding('utf8');
 responses.on('data',chunk=>{
  const frames=chunk.split('\0');
  for(let index=0;index<frames.length-1;index++){
   fragments.push(frames[index]);
   let message;
   try{message=JSON.parse(fragments.join(''));}
   catch(error){disconnect(error);return;}
   fragments.length=0;
   const task=pending.get(message.id);
   if(task){
    pending.delete(message.id);
    clearTimeout(task.timer);
    if(message.error)task.reject(new Error('CDP '+JSON.stringify(message.error)));
    else task.resolve(message.result??{});
   }
  }
  if(frames.at(-1))fragments.push(frames.at(-1));
 });

 function call(method,params={},timeout=['Page.captureScreenshot','Runtime.evaluate'].includes(method)?60000:15000){
  if(transportError)return Promise.reject(transportError);
  const id=++seq;
  const browserCommand=method.startsWith('Browser.')||method.startsWith('Target.');
  const frame=JSON.stringify({id,method,params,...(sessionId&&!browserCommand?{sessionId}:{})})+'\0';
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},timeout);
   pending.set(id,{resolve,reject,timer});
   commands.write(frame);
  });
 }
 const close=async()=>{
  if(closed)return;
  closed=true;
  disconnect(new Error('Browser closed'));
  commands.end();
  child.kill('SIGTERM');
  const forceExit=setTimeout(()=>child.kill('SIGKILL'),2000);
  try{await exited;}finally{clearTimeout(forceExit);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
 };
 try{
  // The first command can be written before Chrome is ready. There is one
  // bounded startup, with no port discovery, WebSocket handshake or retry.
  const {targetInfos}=await call('Target.getTargets',{},60000);
  const blank=targetInfos.find(target=>target.type==='page'&&target.url==='about:blank');
  const {targetId}=blank??await call('Target.createTarget',{url:'about:blank'});
  stage='page attachment';
  ({sessionId}=await call('Target.attachToTarget',{targetId,flatten:true}));
  stage='page initialization';
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
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
  return {call,evaluate,waitFor,close,screenshot:async()=>Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,optimizeForSpeed:true})).data,'base64')};
 }catch(error){
  await close();
  throw new Error(`Browser startup failed at ${stage} after ${Math.round(performance.now()-started)}ms: ${error?.message??error} / ${launchOutput}`);
 }
}
