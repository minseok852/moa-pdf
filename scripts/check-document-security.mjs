import { readFileSync } from 'node:fs';
const packages=JSON.parse(readFileSync(new URL('../.document-cache/rust-license-inventory.json',import.meta.url),'utf8'));
const response=await fetch('https://api.osv.dev/v1/querybatch',{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({queries:packages.map(item=>({package:{name:item.name,ecosystem:'crates.io'},version:item.version}))}),
 signal:AbortSignal.timeout(120000)
});
if(!response.ok)throw new Error('Rust advisory service unavailable: '+response.status);
const report=await response.json();
const affected=report.results.flatMap((item,index)=>(item.vulns??[]).map(vuln=>({package:packages[index].name,version:packages[index].version,id:vuln.id})));
console.log(JSON.stringify({checked:packages.length,affected},null,2));
if(affected.length)process.exitCode=1;
