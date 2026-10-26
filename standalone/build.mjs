import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import {build} from 'vite';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildLocal(){
  console.log('Préparation de l’édition locale…');
  await build({configFile:join(root,'standalone/vite.config.ts')});
  const output=join(root,'standalone-dist/server');await mkdir(output,{recursive:true});
  for(const name of ['levels','catalog','rules','session','radio-config']){
    const source=await readFile(join(root,`src/game/${name}.ts`),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
    await writeFile(join(output,`${name}.mjs`),compiled);
  }
  console.log('Édition locale compilée. Le dossier standalone-dist et scripts/start-local.mjs suffisent avec Node.js 22.13 ou ultérieur.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await buildLocal();
