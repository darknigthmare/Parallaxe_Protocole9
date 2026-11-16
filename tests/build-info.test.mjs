import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildIdentity,writeBuildIdentity} from '../scripts/build-info.mjs';
test('build identity exposes only the public allowlist and exact revision',()=>{
  assert.deepEqual(buildIdentity('0.4.1','vercel','A'.repeat(40)),{schema:'parallaxe-build-v1',game:'parallaxe-protocole-9',version:'0.4.1',target:'vercel',commit:'a'.repeat(40)});
});
test('absent or malformed revisions are explicit null, never invented or echoed',()=>{
  for(const value of [undefined,null,{},'token-secret','a'.repeat(39),'a'.repeat(40)+'\n'])assert.equal(buildIdentity('0.4.1','portable',value).commit,null);
});
test('version and distribution target are validated',()=>{
  for(const value of ['',{},'v0.4.1','private-value'])assert.throws(()=>buildIdentity(value,'portable',null));
  for(const target of ['',{},'preview','production'])assert.throws(()=>buildIdentity('0.4.1',target,null));
});
test('the writer produces a bounded JSON file without exporting unrelated environment',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'p9-build-identity-'));
  const prior=process.env.VERCEL_GIT_COMMIT_SHA,secret=process.env.PARALLAXE_TEST_SECRET;
  process.env.VERCEL_GIT_COMMIT_SHA='b'.repeat(40);process.env.PARALLAXE_TEST_SECRET='DO_NOT_PUBLISH';
  try{
    await writeFile(join(folder,'package.json'),JSON.stringify({version:'0.4.1'}));
    const expected=await writeBuildIdentity(folder,folder,'vercel');
    const raw=await readFile(join(folder,'build-info.json'),'utf8');
    assert.deepEqual(JSON.parse(raw),expected);assert.equal(expected.commit,'b'.repeat(40));
    assert.ok(raw.length<500);assert.doesNotMatch(raw,/DO_NOT_PUBLISH|PARALLAXE_TEST_SECRET/);
  }finally{
    prior===undefined?delete process.env.VERCEL_GIT_COMMIT_SHA:process.env.VERCEL_GIT_COMMIT_SHA=prior;
    secret===undefined?delete process.env.PARALLAXE_TEST_SECRET:process.env.PARALLAXE_TEST_SECRET=secret;
    await rm(folder,{recursive:true,force:true});
  }
});

test('built download cleanup removes stale release metadata and ZIPs but keeps design and unrelated assets', async()=>{
  const {mkdir,readdir}=await import('node:fs/promises');
  const {cleanBuiltDownloads}=await import('../scripts/build-info.mjs');
  const root=await mkdtemp(join(tmpdir(),'p9-clean-downloads-'));
  try{
    await cleanBuiltDownloads(root);
    const downloads=join(root,'downloads');await mkdir(downloads);
    const stale=['PARALLAXE_Jeu_PC_LAN_v0.4.1.zip','PARALLAXE_Sources_v0.4.1.zip','PARALLAXE_v0.4.1_COMMIT.txt','PARALLAXE_v0.4.1_manifest.json','PARALLAXE_v0.4.1_SHA256SUMS.txt'];
    const keep=['PARALLAXE_Design_Complet.xlsx','instructions.txt','poster.png'];
    for(const name of [...stale,...keep])await writeFile(join(downloads,name),name);
    await cleanBuiltDownloads(root);await cleanBuiltDownloads(root);
    assert.deepEqual((await readdir(downloads)).sort(),keep.sort());
    for(const name of keep)assert.equal(await readFile(join(downloads,name),'utf8'),name);
  }finally{await rm(root,{recursive:true,force:true});}
});
