import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
function compressedEngines():Plugin {
  const middleware=(directory:string)=>(req:any,res:any,next:()=>void)=>{
    const pathname=req.url?.split('?')[0]??'';
    const match=pathname.match(/^\/documents\/office\/2\.7\.2\/soffice\.(wasm|data)\.gz$/);
    if(!match)return next();
    const filename=fileURLToPath(new URL('./'+directory+pathname,import.meta.url));
    if(!existsSync(filename))return next();
    res.setHeader('Content-Encoding','gzip');
    res.setHeader('Content-Type',match[1]==='wasm'?'application/wasm':'application/octet-stream');
    createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
  };
  return {name:'compressed-document-engines',configureServer(server){server.middlewares.use(middleware('public'));},configurePreviewServer(server){server.middlewares.use(middleware('dist'));}};
}
export default defineConfig({plugins:[react(),compressedEngines()],worker:{format:'es'},server:{headers},preview:{headers}});
