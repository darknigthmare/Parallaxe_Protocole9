/** Execute real component callbacks with a deterministic hook/JSX boundary.
 * No browser layout, React commit scheduling or physical controller is certified here. */
import assert from 'node:assert/strict';import test from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const temp=await mkdtemp(join(tmpdir(),'p9-utility-ui-'));
const hooks=`let cells=[],index=0,effects=[],cleanup=[];export function reset(){for(const c of cleanup)c?.();cells=[];index=0;effects=[];cleanup=[];}export function begin(){index=0;}export function flush(){for(const f of effects.splice(0))f();}export function unmount(){for(const c of cleanup)c?.();cleanup=[];}export function useState(v){const n=index++;if(!(n in cells))cells[n]=typeof v==='function'?v():v;return [cells[n],v=>{cells[n]=typeof v==='function'?v(cells[n]):v;}];}export function useRef(v){const n=index++;if(!(n in cells))cells[n]={current:v};return cells[n];}export function useEffect(fn,deps){const n=index++,old=cells[n];if(!old||deps?.some((v,i)=>v!==old[i])){cells[n]=deps;effects.push(()=>{cleanup[n]?.();cleanup[n]=fn();});}}export function h(type,props,...children){return {type,props:{...props,children}};}`;
await writeFile(join(temp,'hooks.mjs'),hooks);
for(const name of ['levels','catalog','rules','training-backup','performance-capture','release-downloads']){let s=(await readFile(new URL(`../src/game/${name}.ts`,import.meta.url),'utf8'));s=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");await writeFile(join(temp,name+'.mjs'),s);}
for(const name of ['training-storage','performance-settings','release-downloads']){let s=ts.transpileModule(await readFile(new URL(`../app/${name}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,jsxFactory:'h'}}).outputText.replace(/from ['"]react['"]/g,"from './hooks.mjs'").replace(/from ['"]@\/src\/game\/([^'"]+)['"]/g,"from './$1.mjs'").replace(/from ['"]\.\/training-storage['"]/g,"from './training-storage.mjs'");await writeFile(join(temp,name==='release-downloads'?'release-downloads-ui.mjs':name+'.mjs'),"import {h} from './hooks.mjs';\n"+s);}
const hook=await import(pathToFileURL(join(temp,'hooks.mjs'))),{TrainingStorage}=await import(pathToFileURL(join(temp,'training-storage.mjs'))),{PerformanceSettings}=await import(pathToFileURL(join(temp,'performance-settings.mjs')));
const {PerformanceCapture}=await import(pathToFileURL(join(temp,'performance-capture.mjs'))),{createTrainingBackup}=await import(pathToFileURL(join(temp,'training-backup.mjs'))),{createRun}=await import(pathToFileURL(join(temp,'rules.mjs')));
const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
test.after(()=>{hook.reset();if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;return rm(temp,{recursive:true,force:true});});
const all=n=>{if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(all);return [n,...all(n.props?.children)];};
const label=n=>[n.props?.children].flat(5).filter(x=>typeof x==='string').join('');
const button=(tree,text)=>all(tree).find(n=>n.type==='button'&&label(n).includes(text));
const input=tree=>all(tree).find(n=>n.type==='input'&&n.props.type==='file');
const settle=async()=>{for(let n=0;n<6;n++)await Promise.resolve();};
function harness(){hook.reset();const values=new Map(),changes=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});let props={saved:null,known:[],active:false,onImported:(...v)=>changes.push(v)};
 const render=(patch={})=>{props={...props,...patch};hook.begin();const t=TrainingStorage(props);hook.flush();return t;};const data=JSON.stringify(createTrainingBackup(createRun({seed:'private'}),[]));return {render,values,changes,data};}
async function choose(h,file){input(h.render()).props.onChange({target:{files:[file]}});await settle();return h.render();}
test('real import handler reads and previews before any storage replacement',async()=>{const h=harness();let tree=await choose(h,{size:100,text:async()=>h.data});assert.equal(h.values.size,0);assert.equal(h.changes.length,0);button(tree,'Confirmer cet import').props.onClick();assert.equal(h.changes.length,1);assert.equal(h.changes[0][0].phase,'reference');assert.equal(h.changes[0][0].namedVoiceAllowed,false);assert.ok(h.values.has('parallaxe-before-import'));});
test('real handler rejects oversized files without reading their contents',async()=>{const h=harness();let reads=0;const tree=await choose(h,{size:65537,text:async()=>{reads++;return h.data;}});assert.equal(reads,0);assert.equal(button(tree,'Confirmer cet import'),undefined);assert.equal(h.values.size,0);});
test('late file reads cannot replace a newer selected file preview',async()=>{const h=harness();let resolve;const old=new Promise(r=>resolve=r);await choose(h,{size:1,text:()=>old});await choose(h,{size:1,text:async()=>'not json'});resolve(h.data);await settle();assert.equal(button(h.render(),'Confirmer cet import'),undefined);assert.equal(h.values.size,0);});
test('starting an inspection invalidates a pending file read and disables import',async()=>{const h=harness();let resolve;await choose(h,{size:1,text:()=>new Promise(r=>resolve=r)});h.render({active:true});resolve(h.data);await settle();const tree=h.render();assert.equal(input(tree).props.disabled,true);assert.equal(button(tree,'Confirmer cet import'),undefined);assert.equal(h.values.size,0);});
test('cancelling a valid preview has no local or network side effect',async()=>{const h=harness();const tree=await choose(h,{size:10,text:async()=>h.data});button(tree,'Annuler').props.onClick();assert.equal(button(h.render(),'Confirmer cet import'),undefined);assert.equal(h.changes.length,0);assert.equal(h.values.size,0);});
test('blocked localStorage accessor is caught by the previous-copy UI',()=>{const h=harness();Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('denied');}});assert.doesNotThrow(()=>button(h.render(),'Récupérer').props.onClick());assert.ok(all(h.render()).some(n=>label(n).includes('stockage local est indisponible')));});
test('real performance panel disables capture outside reference and only exports actual samples',()=>{hook.reset();const capture=new PerformanceCapture();let allowed=false;const render=()=>{hook.begin();const t=PerformanceSettings({capture,allowed});hook.flush();return t;};assert.equal(button(render(),'Préparer').props.disabled,true);assert.equal(button(render(),'Exporter').props.disabled,true);allowed=true;button(render(),'Préparer').props.onClick();assert.equal(capture.recording,true);assert.equal(button(render(),'Préparer').props.disabled,true);button(render(),'Arrêter').props.onClick();assert.equal(capture.recording,false);hook.unmount();});


test('all new UI modules and Game have no TypeScript/JSX syntax diagnostics',async()=>{
  for(const name of ['controller-navigation','training-storage','performance-settings','release-downloads','mission-records','game']){
    const source=await readFile(new URL(`../app/${name}.tsx`,import.meta.url),'utf8');
    const result=ts.transpileModule(source,{fileName:name+'.tsx',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
    const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],name);
  }
});


test('actual downloads panel displays only the matching build and drops responses after unmount',async()=>{
  const {ReleaseDownloads}=await import(pathToFileURL(join(temp,'release-downloads-ui.mjs')));
  const previous=globalThis.fetch;
  const render=()=>{hook.begin();const tree=ReleaseDownloads();hook.flush();return tree;};
  try{
    hook.reset();globalThis.fetch=async()=>Response.json({schema:'parallaxe-build-v1',game:'parallaxe-protocole-9',version:'0.4.1',target:'vercel',commit:'a'.repeat(40)});
    render();for(let i=0;i<30;i++)await Promise.resolve();
    let tree=render();assert.ok(all(tree).some(n=>n.type==='a'&&n.props.href.includes('/archive/'+ 'a'.repeat(40))));
    assert.ok(all(tree).some(n=>label(n).includes('aaaaaaaaaaaa')));hook.reset();
    let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);render();hook.unmount();
    resolve(Response.json({schema:'parallaxe-build-v1',game:'parallaxe-protocole-9',version:'0.4.1',target:'vercel',commit:'b'.repeat(40)}));
    for(let i=0;i<30;i++)await Promise.resolve();
    tree=render();assert.ok(!all(tree).some(n=>n.type==='a'&&n.props.href.includes('/archive/')));
  }finally{hook.reset();globalThis.fetch=previous;}
});
