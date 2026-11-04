import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),cache=path.join(root,'.document-cache');
mkdirSync(cache,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitHash=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
async function get(name,url,checksum,git=false){
  const filename=path.join(cache,name),hash=git?gitHash:sha;
  if(existsSync(filename)){const bytes=readFileSync(filename);if(hash(bytes)===checksum)return bytes;}
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('License source download failed: '+name+' '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(hash(bytes)!==checksum)throw new Error('License source integrity mismatch: '+name);
  writeFileSync(filename,bytes);return bytes;
}
const lock=await get('rhwptopdf-Cargo.lock','https://raw.githubusercontent.com/sanguneo/rhwptopdf/v0.2.2/Cargo.lock','265b47db2b4b4e6ab3bc7ff3084b780ab6b8b9e8',true);
const packages=lock.toString().split('[[package]]').slice(1).map(block=>{
  const value=key=>block.match(new RegExp('^'+key+' = "([^"]+)"','m'))?.[1];
  return{name:value('name'),version:value('version'),checksum:value('checksum'),source:value('source')};
}).filter(item=>item.source?.startsWith('registry+'));
function entries(gzip){
 const tar=gunzipSync(gzip,{maxOutputLength:64*1024*1024}),files=[];
 for(let offset=0;offset+512<=tar.length;){
  const header=tar.subarray(offset,offset+512);if(header.every(byte=>byte===0))break;
  const string=(start,end)=>header.subarray(start,end).toString().replace(/\0.*$/s,'');
  const name=(string(345,500)?string(345,500)+'/':'')+string(0,100),size=parseInt(string(124,136).trim()||'0',8);
  if(!Number.isSafeInteger(size)||size<0||offset+512+size>tar.length)throw new Error('Malformed crate archive');
  if(header[156]===0||header[156]===48)files.push({name,data:tar.subarray(offset+512,offset+512+size)});
  offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
const accepted=new Set(['MIT','MIT-0','Apache-2.0','LLVM-exception','MPL-2.0','BSD-2-Clause','BSD-3-Clause','ISC','Zlib','BSL-1.0','Unicode-3.0','Unicode-DFS-2016','CC0-1.0','Unlicense','0BSD']);
const results=Array(packages.length),errors=[];let next=0;
await Promise.all(Array.from({length:6},async()=>{
 while(next<packages.length){
  const index=next++,item=packages[index];
  try {
  const url='https://static.crates.io/crates/'+item.name+'/'+item.name+'-'+item.version+'.crate';
  const archive=await get(item.name+'-'+item.version+'.crate',url,item.checksum);
  const source=entries(archive),prefix=item.name+'-'+item.version+'/';
  const cargo=source.find(file=>file.name===prefix+'Cargo.toml')?.data.toString()??'';
  const license=cargo.match(/^license\s*=\s*"([^"]+)"/m)?.[1];
  if(!license||license.replaceAll('/',' OR ').split(/[ ()]+/).filter(token=>token&&!['AND','OR','WITH'].includes(token)).some(token=>!accepted.has(token)))throw new Error('Unreviewed crate license: '+item.name+' '+license);
  const notices=source.filter(file=>/(?:^|\/)(?:licen[cs]e|copying|notice|copyright|authors)(?:[._-][^/]*)?$/i.test(file.name));
  if(!notices.length)throw new Error('Missing crate copyright/license text: '+item.name+' '+item.version);
  results[index]={...item,license,url,notices:notices.map(file=>'--- '+file.name+' ---\n'+file.data.toString('utf8')).join('\n\n')};
  }catch(error){errors.push(String(error));}
 }
}));
if(errors.length){console.error(JSON.stringify({licenseReviewErrors:errors},null,2));throw new Error('Unresolved dependency license review');}
const header='rhwptopdf 0.2.2 — Rust dependency license notices and source locations\nConservative inventory of all registry packages in the upstream Cargo.lock, including build/target-only packages.\nEngine code is unmodified. Each component retains its own license.\nFor MPL-covered dependencies, the exact .crate source archives below are available under their stated licenses.\n\n';
const body=results.map(item=>'=== '+item.name+' '+item.version+' ('+item.license+') ===\nSource Code Form: '+item.url+'\nSHA-256: '+item.checksum+'\n\n'+item.notices).join('\n\n');
writeFileSync(path.join(root,'public','licenses','rhwptopdf-dependencies.txt'),header+body);
writeFileSync(path.join(cache,'rust-license-inventory.json'),JSON.stringify(results.map(({notices,...item})=>item),null,2));
console.log('Prepared copyright, license text and source URLs for '+results.length+' Rust dependencies.');
