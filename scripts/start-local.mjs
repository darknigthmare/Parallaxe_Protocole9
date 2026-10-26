/** LAN edition: same browser game and authoritative domain rules, no cloud account. */
import {createServer} from 'node:http';
import {createServer as createSecureServer} from 'node:https';
import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {resolve,join,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {networkInterfaces} from 'node:os';
import {createHash,randomBytes,randomUUID} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const option=(name,fallback)=>args.find(a=>a.startsWith(`${name}=`))?.slice(name.length+1)??fallback;
const port=Number(option('--port',process.env.PARALLAXE_PORT??'4174'));
const host=args.includes('--lan')?'0.0.0.0':'127.0.0.1';
const certPath=option('--cert','');const keyPath=option('--key','');
if(Boolean(certPath)!==Boolean(keyPath))throw new Error('HTTPS exige les deux options --cert=chemin et --key=chemin.');
const tls=certPath?{cert:await readFile(resolve(certPath)),key:await readFile(resolve(keyPath))}:null;
const scheme=tls?'https':'http';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port invalide.');
const dataDir=join(root,'.parallaxe-data');
const clientDir=join(root,'standalone-dist');
const domainDir=join(clientDir,'server');
const savePath=join(dataDir,'sessions.json');
await mkdir(dataDir,{recursive:true});
let needsBuild=args.includes('--build');
try{await stat(join(clientDir,'index.html'));await stat(join(domainDir,'session.mjs'));await stat(join(domainDir,'radio-config.mjs'));}catch{needsBuild=true;}
if(needsBuild){
  try{const {buildLocal}=await import('../standalone/build.mjs');await buildLocal();}
  catch(error){throw new Error(`Préparation locale impossible. Exécutez npm install puis npm run local -- --build. ${error.message}`);}
}
const {createRoom,joinRoom,actRoom,authenticate,projectRoom,makePlayer,validateName,validateCode,SessionError,SESSION_TTL,upgradeRoom}=await import(pathToFileURL(join(domainDir,'session.mjs')));
const {makeRadioConfig}=await import(pathToFileURL(join(domainDir,'radio-config.mjs')));

const rooms=new Map();
try{
  const saved=JSON.parse(await readFile(savePath,'utf8'));
  for(const entry of saved)if(entry.expiresAt>Date.now()&&entry.room?.code)rooms.set(entry.room.code,{...entry,room:upgradeRoom(entry.room)});
}catch(error){if(error.code!=='ENOENT')throw new Error('La sauvegarde locale est illisible. Conservez .parallaxe-data/sessions.json avant de la réparer.');}
let saveTimer;let saving=Promise.resolve();
function saveSoon(){
  if(saveTimer)return;
  saveTimer=setTimeout(()=>{saveTimer=null;save();},350);
}
function save(){
  const serialized=JSON.stringify([...rooms.values()].filter(entry=>entry.expiresAt>Date.now()));
  saving=saving.then(async()=>{await writeFile(`${savePath}.tmp`,serialized,{mode:0o600});await rename(`${savePath}.tmp`,savePath);}).catch(error=>console.error('Sauvegarde locale impossible :',error.message));
  return saving;
}
function hash(token){return createHash('sha256').update(token).digest('hex');}
function token(){return randomBytes(32).toString('hex');}
function code(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...randomBytes(6)].map(b=>alphabet[b%alphabet.length]).join('');}
function readRoom(code){const entry=rooms.get(code);if(!entry||entry.expiresAt<Date.now())throw new SessionError('Équipe introuvable ou expirée. Vérifiez le code.',404);return entry.room;}
function put(room){rooms.set(room.code,{room,expiresAt:Date.now()+SESSION_TTL});saveSoon();return room;}
function bearer(request){const value=request.headers.authorization??'';if(!/^Bearer [a-zA-Z0-9-]{32,128}$/.test(value))throw new SessionError('Votre accès à l’équipe est manquant.',401);return hash(value.slice(7));}
function json(response,status,value){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));}
async function body(request){
  let size=0;const chunks=[];
  for await(const chunk of request){size+=chunk.length;if(size>16384)throw new SessionError('Transmission trop longue.',413);chunks.push(chunk);}
  let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new SessionError('Transmission illisible.');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new SessionError('Transmission invalide.');return payload;
}
async function api(request,response,url){
  if(request.method==='GET'){
    const key=validateCode(url.searchParams.get('code'));let room=readRoom(key);const actor=authenticate(room,bearer(request));
    if(url.searchParams.get('radioConfig')==='1')return json(response,200,await makeRadioConfig(process.env,actor.id));
    if(Date.now()-actor.lastSeen>=5000)room=put(actRoom(room,actor.id,'ping',{},Date.now()));
    return json(response,200,{state:projectRoom(room,actor.id,Date.now())});
  }
  if(request.method!=='POST')return json(response,405,{error:'Méthode non prise en charge.'});
  const payload=await body(request);
  if(payload.action==='create'){
    const name=validateName(payload.name);const access=token();let key;
    for(const [existing,entry] of rooms)if(entry.expiresAt<Date.now())rooms.delete(existing);
    do{key=code();}while(rooms.has(key));
    const now=Date.now();const actor=makePlayer(randomUUID(),name,hash(access),0,now);
    const room=put(createRoom(key,actor,payload.difficulty==='relaxed'?'relaxed':'standard',token(),now,{mode:payload.mode==='single'?'single':'campaign',levelId:['hotel','metro','clinic'].includes(payload.levelId)?payload.levelId:'hotel'}));
    return json(response,201,{code:key,token:access,selfId:actor.id,state:projectRoom(room,actor.id,now)});
  }
  const key=validateCode(payload.code);
  if(payload.action==='join'){
    const name=validateName(payload.name);const access=token();const now=Date.now();const actor=makePlayer(randomUUID(),name,hash(access),0,now);
    // No await separates read/mutate/write: the Node event loop serializes mutations.
    const room=put(joinRoom(readRoom(key),actor));
    return json(response,200,{code:key,token:access,selfId:actor.id,state:projectRoom(room,actor.id,now)});
  }
  const room=readRoom(key);const actor=authenticate(room,bearer(request));
  const next=put(actRoom(room,actor.id,payload.action,payload,Date.now()));
  if(payload.action==='leave')return json(response,200,{left:true});
  return json(response,200,{state:projectRoom(next,actor.id,Date.now())});
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip','.pdf':'application/pdf'};
const handler=async(request,response)=>{
  try{
    const url=new URL(request.url,'http://localhost');
    if(url.pathname==='/api/session')return await api(request,response,url);
    if(!['GET','HEAD'].includes(request.method))return json(response,405,{error:'Méthode non prise en charge.'});
    const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    if(path.startsWith('/server/'))return json(response,404,{error:'Fichier introuvable.'});
    const file=resolve(clientDir,`.${path}`);
    if(file!==clientDir&&!file.startsWith(clientDir+sep))return json(response,403,{error:'Accès refusé.'});
    let contents;try{contents=await readFile(file);}catch{return json(response,404,{error:'Fichier introuvable.'});}
    response.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'});
    response.end(request.method==='HEAD'?undefined:contents);
  }catch(error){json(response,error instanceof SessionError?error.status:500,{error:error instanceof SessionError?error.message:'La liaison locale a rencontré une erreur.'});if(!(error instanceof SessionError))console.error(error);}
};
const server=tls?createSecureServer(tls,handler):createServer(handler);
server.listen(port,host,()=>{
  console.log(`\nPARALLAXE — Protocole 9\nSur cet ordinateur : ${scheme}://localhost:${port}`);
  if(host==='0.0.0.0')for(const iface of Object.values(networkInterfaces()))for(const address of iface??[])if(address.family==='IPv4'&&!address.internal)console.log(`Sur le même réseau : ${scheme}://${address.address}:${port}`);
  if(host==='0.0.0.0'&&!tls)console.log('Microphone distant : HTTPS avec un certificat approuvé est requis. Texte et étalonnage restent disponibles.');
  console.log('Créez une équipe, puis transmettez son code aux autres inspecteurs. Ctrl+C pour fermer.\n');
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{clearTimeout(saveTimer);await save();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();});
