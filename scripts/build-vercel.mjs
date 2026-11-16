import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {writeBuildIdentity} from './build-info.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv.includes('--server-only')){
  await build({configFile:resolve(root,'standalone/vite.config.ts')});
  await writeBuildIdentity(root,resolve(root,'standalone-dist'),'vercel');
}
await build({
  configFile:false,root,publicDir:false,
  build:{
    ssr:resolve(root,'src/vercel/entry.ts'),target:'node22',outDir:resolve(root,'build-server'),
    emptyOutDir:true,minify:false,
    rolldownOptions:{output:{format:'cjs',entryFileNames:'session.cjs',codeSplitting:false}},
  },
});
