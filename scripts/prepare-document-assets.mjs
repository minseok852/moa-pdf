import './prepare-rust-notices.mjs';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.join(root,'public','documents');
const cache=path.join(root,'.document-cache');
mkdirSync(cache,{recursive:true});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitHash=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
async function download(name,url,digest,git=false){
  const filename=path.join(cache,name);
  const valid=bytes=>(git?gitHash(bytes):sha256(bytes))===digest;
  if(existsSync(filename)){const bytes=readFileSync(filename);if(valid(bytes))return bytes;}
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('Document asset download failed: '+name+' ('+response.status+')');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!valid(bytes))throw new Error('Document asset integrity mismatch: '+name);
  writeFileSync(filename,bytes);return bytes;
}
const manifest=[];
function save(relative,bytes,source){
  const dest=path.join(output,relative);mkdirSync(path.dirname(dest),{recursive:true});
  writeFileSync(dest,bytes);manifest.push({path:relative,size:bytes.length,sha256:sha256(bytes),source});
}
const hwpBase='https://github.com/sanguneo/rhwptopdf/releases/download/v0.2.2/';
for(const [name,hash]of [
  ['rhwptopdf.umd.js','7913400eae742e9f15f320fc377d5961a63216840f290a4c280fbe731ec3c0cd'],
  ['rhwptopdf.umd_bg.wasm','7a3e1e3e3a8d2a5bea64feac7bd8a2b556687a70874003fcf2aa6677e92f83a7']
])save('hwp/0.2.2/'+name,await download(name,hwpBase+name,hash),hwpBase+name);
const fontCommit='f8d157532fbfaeda587e826d4cd5b21a49186f7c';
for(const [family,hash]of [
  ['Sans','b8c11425a25c74dac1b51b28341ff1ef379f2ffa'],
  ['Serif','4e21673ae96c11b39ec2ddb446d44a86189838ef']
]){
  const name='Noto'+family+'KR-Regular.otf';
  const url='https://raw.githubusercontent.com/notofonts/noto-cjk/'+fontCommit+'/'+family+'/SubsetOTF/KR/'+name;
  save('fonts/'+name,await download(name,url,hash,true),url);
}
const office=path.join(root,'node_modules','@matbee','libreoffice-converter');
const metadata=JSON.parse(readFileSync(path.join(office,'package.json'),'utf8'));
if(metadata.version!=='2.7.2')throw new Error('Unexpected LibreOffice converter version');
for(const [name,hash,compress]of [
  ['soffice.wasm','ea3d8f3b69bd1e586a8ea973e0dfa61c758612fcc529dc94ac2e30519f8b4f7b',true],
  ['soffice.data','8f4e98aa67e108e161cecc7906d7ac0dd3941ef9347f999c3b9dbc049f165020',true]
]){
  const bytes=readFileSync(path.join(office,'wasm',name));
  if(sha256(bytes)!==hash)throw new Error('LibreOffice '+name+' integrity mismatch');
  // HTTP Content-Encoding decompresses these without changing any engine code.
  save('office/2.7.2/'+name+'.gz',gzipSync(bytes,{level:6}),'@matbee/libreoffice-converter@2.7.2/wasm/'+name);
}
for(const name of ['soffice.js','soffice.worker.js']){
  const bytes=readFileSync(path.join(office,'wasm',name));
  const expected=name==='soffice.js'?'7c82d3f4a40324227e4377f8c6054dad0816de05':'0bd99a5f11615cb1692c111131f7bad820e94cbb';
  if(gitHash(bytes)!==expected)throw new Error('LibreOffice loader integrity mismatch');
  save('office/2.7.2/'+name,bytes,'https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2/wasm');
}
const worker=readFileSync(path.join(office,'dist','browser.worker.global.js'));
if(sha256(worker)!=='9401aff2213772d7114fe417e3f34eb359905ae3a4e94a735644d926d593e276')throw new Error('LibreOffice worker integrity mismatch');
save('office/2.7.2/browser.worker.global.js',worker,'@matbee/libreoffice-converter@2.7.2/dist/browser.worker.global.js');
const loader=readFileSync(path.join(office,'wasm','soffice.js'),'utf8');
const version=loader.match(/filename:"\/instdir\/program\/versionrc",start:(\d+),end:(\d+)/);
const versionInfo=version?readFileSync(path.join(office,'wasm','soffice.data')).subarray(+version[1],+version[2]).toString():'unavailable';
if(!versionInfo.includes('buildid=d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1'))throw new Error('Unknown LibreOffice source revision');
const licenseURL='https://raw.githubusercontent.com/LibreOffice/core/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1/readlicense_oo/license/license.xml';
writeFileSync(path.join(root,'public','licenses','libreoffice-NOTICES.html'),await download('libreoffice-NOTICES.html',licenseURL,'8fd7da94aa24f11f823637d185a21f7cae30b1a7',true));
writeFileSync(path.join(output,'asset-manifest.json'),JSON.stringify({officeVersion:metadata.version,libreOffice:versionInfo,assets:manifest},null,2)+'\n');
console.log('Prepared local document engines and Korean fonts. LibreOffice version metadata:\n'+versionInfo);
for(const entry of manifest)if(entry.size>=100_000_000)throw new Error('Document asset exceeds static-file size limit: '+entry.path);
