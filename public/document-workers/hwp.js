// Moa PDF integration. rhwptopdf itself is loaded unmodified; see /licenses/.
let engine;
self.onmessage=async({data:message})=>{
  try {
    if(message.type==='init'){
      importScripts(message.base+'rhwptopdf.umd.js');
      engine=self.RhwpToPdf;
      await engine({module_or_path:message.base+'rhwptopdf.umd_bg.wasm'});
      for(const font of message.fonts)engine.registerPdfFont(font.data);
      // Conversion is offline after initialization. Document resources never trigger requests.
      self.fetch=()=>Promise.reject(new Error('Network is disabled during document conversion'));
      self.XMLHttpRequest=class {constructor(){throw new Error('Network is disabled during document conversion');}};
      self.postMessage({type:'ready',id:message.id});
    } else if(message.type==='convert'){
      const analysis=engine.analyzeHwp(message.bytes);
      if(!Number.isInteger(analysis.pageCount)||analysis.pageCount<1||analysis.pageCount>message.maxPages)throw new Error('PAGE_LIMIT');
      const data=engine.hwpToPdf(message.bytes);
      self.postMessage({type:'result',id:message.id,data},[data.buffer]);
    }
  }catch(error){self.postMessage({type:'error',id:message.id,error:error instanceof Error?error.message:String(error)});}
};
