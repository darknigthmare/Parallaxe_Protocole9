import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder=dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root:folder,
  publicDir:resolve(folder,'../public'),
  plugins:[react()],
  resolve:{alias:{'@':resolve(folder,'..')}},
  build:{outDir:resolve(folder,'../standalone-dist'),emptyOutDir:true,chunkSizeWarningLimit:900},
});
