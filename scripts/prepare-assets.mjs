import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const pdfRoot=path.join(root,'node_modules','pdfjs-dist');
const pdfPackage=JSON.parse(readFileSync(path.join(pdfRoot,'package.json'),'utf8'));
const assetRoot=path.resolve(root,'public','pdfjs');
// Only remove obsolete generated version directories, never unrelated paths.
if(existsSync(assetRoot))for(const entry of readdirSync(assetRoot,{withFileTypes:true})){
 if(!entry.isDirectory()||!/^\d+\.\d+\.\d+$/.test(entry.name)||entry.name===pdfPackage.version)continue;
 const obsolete=path.resolve(assetRoot,entry.name);
 if(path.dirname(obsolete)!==assetRoot)throw new Error('Unexpected generated asset path');
 rmSync(obsolete,{recursive:true,force:true});
}
const destination=path.join(assetRoot,pdfPackage.version);
mkdirSync(destination,{recursive:true});
for(const directory of ['cmaps','standard_fonts','wasm','iccs'])cpSync(path.join(pdfRoot,directory),path.join(destination,directory),{recursive:true});
cpSync(path.join(pdfRoot,'LICENSE'),path.join(destination,'LICENSE'));
// Include the license text for each production dependency in the published site.
const lock=JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8'));
const notices=['Moa PDF — third-party software notices','Generated from the locked production dependencies.',''];
for(const [relative,entry] of Object.entries(lock.packages)){
 if(!relative||entry.dev||entry.optional)continue;
 const directory=path.join(root,relative);
 if(!existsSync(directory))continue;
 const metadata=JSON.parse(readFileSync(path.join(directory,'package.json'),'utf8'));
 notices.push(`\n=== ${metadata.name} ${metadata.version} (${metadata.license??'see license text'}) ===\n`);
 for(const name of readdirSync(directory).filter(name=>/^(?:licen[cs]e|copying|notice)(?:\.[a-z]+)?$/i.test(name)))notices.push(readFileSync(path.join(directory,name),'utf8'));
}
writeFileSync(path.join(root,'public','third-party-notices.txt'),notices.join('\n'));
console.log(`Prepared PDF.js ${pdfPackage.version} local assets and third-party notices.`);
