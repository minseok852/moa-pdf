// Independent Moa PDF bootstrap. The MPL-2.0 engine below is redistributed unmodified.
// Exact source and build patches: /licenses/SOURCES.txt
const base=new URL('../documents/office/2.7.2/',self.location.href).href;
const allowed=new Set(['soffice.js','soffice.worker.js','soffice.wasm.gz','soffice.data.gz','browser.worker.global.js'].map(name=>base+name));
function check(url,method='GET'){
  if(method.toUpperCase()!=='GET'||!allowed.has(new URL(url,self.location.href).href))throw new Error('External document resources are disabled');
}
const originalFetch=self.fetch.bind(self);
self.fetch=(input,init)=>{check(typeof input==='string'||input instanceof URL?String(input):input.url,init?.method??(input instanceof Request?input.method:'GET'));return originalFetch(input,init);};
const open=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){check(String(url),method);return open.call(this,method,url,...rest);};
self.WebSocket=class {constructor(){throw new Error('External document resources are disabled');}};
self.EventSource=class {constructor(){throw new Error('External document resources are disabled');}};
importScripts(base+'browser.worker.global.js');
