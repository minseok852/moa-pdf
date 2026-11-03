import { documentFormat, validateDocument } from './document-formats';
import type { DocumentFormat } from './document-formats';
import { LIMITS } from './types';
export type DocumentProgress = (label: string, progress: number) => void;
export type ImportOptions = { signal?: AbortSignal; onProgress?: DocumentProgress };
const sessions = new Map<'hwp'|'office', DocumentSession>();
const cancelled = () => new Error('CANCELLED');
const root = () => new URL(import.meta.env.BASE_URL, window.location.href);
const asset = (path: string) => new URL(path, root()).href;
const fonts = (signal?: AbortSignal) => Promise.all(['NotoSansKR-Regular.otf','NotoSerifKR-Regular.otf'].map(async filename => {
  const response=await fetch(asset('documents/fonts/'+filename),{signal});
  if(!response.ok)throw new Error('문서 변환 글꼴을 불러오지 못했습니다.');
  return {filename,data:new Uint8Array(await response.arrayBuffer())};
}));
type Response = {id?:number;type:string;data?:Uint8Array;error?:string;pageCount?:number;progress?:{percent:number}};
class DocumentSession {
  private worker: Worker;
  private pending = new Map<number,{resolve:(value:Response)=>void;reject:(reason:Error)=>void;cleanup:()=>void}>();
  private id=0;
  private ready: Promise<void> | undefined;
  private closed=false;
  private progress: DocumentProgress | undefined;
  constructor(private engine:'hwp'|'office'){
    this.worker=new Worker(asset('document-workers/'+engine+'.js'));
    this.worker.onmessage=({data}:MessageEvent<Response>)=>{
      if(data.type==='progress'){
        this.progress?.(this.engine==='hwp'?'한글 문서를 PDF로 변환 중':'오피스 문서 변환 엔진 준비 중',Math.max(0,Math.min(.9,(data.progress?.percent??0)/100*.8)));
        return;
      }
      if(data.id===undefined)return;
      const request=this.pending.get(data.id);
      if(!request)return;
      this.pending.delete(data.id);request.cleanup();
      if(data.type==='error')request.reject(new Error(data.error==='PAGE_LIMIT'?'문서는 최대 200쪽까지 변환할 수 있습니다.':'문서 변환에 실패했습니다. 비밀번호·손상 여부를 확인하거나 원래 프로그램에서 PDF로 저장해 주세요.'));
      else request.resolve(data);
    };
    this.worker.onerror=()=>this.dispose(new Error('문서 변환 엔진을 불러오지 못했습니다. 브라우저를 확인하거나 다시 시도해 주세요.'));
    this.worker.onmessageerror=()=>this.dispose(new Error('문서 변환 결과를 읽을 수 없습니다.'));
  }
  private request(type:string,payload:Record<string,unknown>,signal?:AbortSignal):Promise<Response>{
    if(this.closed)return Promise.reject(new Error('문서 변환 엔진이 종료되었습니다.'));
    if(signal?.aborted)return Promise.reject(cancelled());
    return new Promise((resolve,reject)=>{
      const id=++this.id;
      const abort=()=>this.dispose(cancelled());
      const timer=setTimeout(()=>this.dispose(new Error('문서 변환 시간이 초과되었습니다. 작은 파일로 다시 시도해 주세요.')),180000);
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      this.pending.set(id,{resolve,reject,cleanup});
      signal?.addEventListener('abort',abort,{once:true});
      this.worker.postMessage({type,id,...payload});
    });
  }
  async convert(bytes:Uint8Array,format:DocumentFormat,options:ImportOptions):Promise<Uint8Array>{
    this.progress=options.onProgress;
    if(!this.ready)this.ready=(async()=>{
      options.onProgress?.('문서 변환 글꼴 준비 중',.05);
      const fontData=await fonts(options.signal);
      if(options.signal?.aborted)throw cancelled();
      const base=asset('documents/'+this.engine+'/'+(this.engine==='hwp'?'0.2.2':'2.7.2')+'/');
      await this.request('init',this.engine==='hwp'?{base,fonts:fontData}:{
        sofficeJs:base+'soffice.js',sofficeWasm:base+'soffice.wasm.gz',
        sofficeData:base+'soffice.data.gz',sofficeWorkerJs:base+'soffice.worker.js',fonts:fontData,
        enableProgressTracking:false,verbose:false
      },options.signal);
    })();
    await this.ready;
    options.onProgress?.('문서를 PDF로 변환 중',.85);
    const result=await this.request('convert',this.engine==='hwp'?{bytes,maxPages:LIMITS.pages}:{
      inputData:bytes,inputExt:format,outputFormat:'pdf',filterOptions:''
    },options.signal);
    if(!result.data?.length || result.data.length>LIMITS.fileBytes)throw new Error('변환된 PDF가 파일당 40 MB 한도를 초과했거나 비어 있습니다.');
    if(new TextDecoder('latin1').decode(result.data.subarray(0,8)).indexOf('%PDF-')!==0)throw new Error('문서 변환 결과가 올바른 PDF가 아닙니다.');
    return result.data;
  }
  dispose(error=new Error('CANCELLED')){
    if(this.closed)return;this.closed=true;
    this.worker.terminate();
    for(const request of this.pending.values()){request.cleanup();request.reject(error);}
    this.pending.clear();
    if(sessions.get(this.engine)===this)sessions.delete(this.engine);
  }
}
export function disposeDocumentConverters(){for(const session of sessions.values())session.dispose();sessions.clear();}
export async function convertDocument(bytes:Uint8Array,name:string,options:ImportOptions={}):Promise<Uint8Array>{
  const format=documentFormat(name);
  if(!format)throw new Error('지원하지 않는 문서 형식입니다.');
  if(bytes.length>LIMITS.fileBytes)throw new Error('파일당 40 MB를 초과했습니다.');
  validateDocument(bytes,format);
  if(options.signal?.aborted)throw cancelled();
  const engine=format==='hwp'||format==='hwpx'?'hwp':'office';
  if(engine==='office' && (!window.crossOriginIsolated || typeof SharedArrayBuffer==='undefined'))throw new Error('이 브라우저나 배포 환경에서는 오피스 문서를 변환할 수 없습니다. 최신 데스크톱 브라우저를 사용하거나 PDF로 저장해 불러와 주세요.');
  let session=sessions.get(engine);
  if(!session){session=new DocumentSession(engine);sessions.set(engine,session);}
  try{return await session.convert(bytes,format,options);}
  catch(error){session.dispose();if(options.signal?.aborted)throw cancelled();throw error;}
}
