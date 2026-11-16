/** Public, allowlisted build identity. Never export environment variables or secrets. */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export function buildIdentity(version,target,commit){
  if(typeof version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version))throw new Error('Invalid build version');
  if(!['vercel','portable'].includes(target))throw new Error('Invalid build target');
  return {schema:'parallaxe-build-v1',game:'parallaxe-protocole-9',version,target,
    commit:typeof commit==='string'&&/^[a-f0-9]{40}$/i.test(commit)?commit.toLowerCase():null};
}
export async function writeBuildIdentity(root,output,target){
  let commit;
  try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch{commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA;}
  const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const identity=buildIdentity(version,target,commit);
  await writeFile(join(output,'build-info.json'),JSON.stringify(identity,null,2)+'\n');
  return identity;
}
