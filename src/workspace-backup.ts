import { DEFAULT_SETTINGS, LIMITS } from './types';
import type { PageItem, Settings, SourceFile } from './types';
export type Workspace = {pages:PageItem[];sources:Record<string,SourceFile>;settings:Settings};
export type BackupInfo={savedAt:number;pageCount:number;bytes:number};
export type BackupRecord=Workspace&BackupInfo&{version:1};
export function packWorkspace(workspace:Workspace,savedAt=Date.now()):BackupRecord {
 const used=new Set(workspace.pages.map(page=>page.sourceId));
 const sources=Object.fromEntries(Object.values(workspace.sources).filter(source=>used.has(source.id)).map(({url:_url,...source})=>[source.id,source]));
 return {version:1,pages:workspace.pages,settings:workspace.settings,sources,savedAt,pageCount:workspace.pages.length,bytes:Object.values(sources).reduce((total,source)=>total+source.bytes.length,0)};
}
function validSettings(value:unknown,partial=false):boolean {
 if(!value||typeof value!=='object')return false;
 const settings=value as Settings;
 const options={paper:['a4','a3','letter','original'],orientation:['auto','portrait','landscape'],fit:['contain','cover'],quality:['original','balanced','small']};
 for(const key of Object.keys(options) as (keyof typeof options)[])if((!partial||key in settings)&&!options[key].includes(settings[key] as never))return false;
 if((!partial||'margin' in settings)&&(!Number.isFinite(settings.margin)||settings.margin<0||settings.margin>30))return false;
 if((!partial||'keepPdfSize' in settings)&&typeof settings.keepPdfSize!=='boolean')return false;
 if((!partial||'pageNumbers' in settings)&&typeof settings.pageNumbers!=='boolean')return false;
 if((!partial||'filename' in settings)&&typeof settings.filename!=='string')return false;
 return true;
}
export function unpackWorkspace(value:unknown):BackupRecord {
 if(!value||typeof value!=='object')throw new Error('저장된 작업을 읽을 수 없습니다.');
 const record=value as BackupRecord;
 if(record.version!==1||!Array.isArray(record.pages)||record.pages.length>LIMITS.pages||!record.sources||!validSettings(record.settings))throw new Error('저장된 작업 형식이 올바르지 않습니다.');
 const ids=new Set<string>();let bytes=0;
 for(const [id,source] of Object.entries(record.sources)){
  if(!source||source.id!==id||typeof source.name!=='string'||!['image','pdf'].includes(source.kind)||!(source.bytes instanceof Uint8Array)||source.bytes.length>LIMITS.fileBytes||!['image/png','image/jpeg','application/pdf'].includes(source.mime))throw new Error('저장된 원본 파일을 읽을 수 없습니다.');
  bytes+=source.bytes.length;
 }
 if(bytes>LIMITS.totalBytes)throw new Error('저장된 작업이 지원 용량을 초과합니다.');
 for(const page of record.pages){
  const source=record.sources[page.sourceId];
  if(!source||page.kind!==source.kind||typeof page.id!=='string'||ids.has(page.id)||!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0||!Number.isInteger(page.sourceIndex)||page.sourceIndex<0||![0,90,180,270].includes(page.rotation)||typeof page.thumbnail!=='string'||!page.thumbnail.startsWith('data:image/'))throw new Error('저장된 페이지를 읽을 수 없습니다.');
  if(page.crop){const c=page.crop;if(![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1.0000001||c.y+c.height>1.0000001)throw new Error('저장된 자르기 영역이 올바르지 않습니다.');}
  if(page.settings&&!validSettings(page.settings,true))throw new Error('저장된 페이지 설정이 올바르지 않습니다.');
  ids.add(page.id);
 }
 return {...record,settings:{...DEFAULT_SETTINGS,...record.settings},pageCount:record.pages.length,bytes};
}
const DB_NAME='moa-pdf-local-work',STORE='workspace';
async function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('이 브라우저에서는 기기 저장을 사용할 수 없습니다.'));return;}const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('기기 저장 공간에 접근할 수 없습니다.'));request.onblocked=()=>reject(new Error('다른 탭을 닫은 후 다시 시도해 주세요.'));});
}
async function readKey(key:string):Promise<unknown>{const db=await openDatabase();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}}
export async function backupInfo():Promise<BackupInfo|null>{return await readKey('info') as BackupInfo|null??null;}
export async function readBackup():Promise<BackupRecord>{return unpackWorkspace(await readKey('current'));}
export async function writeBackup(record:BackupRecord):Promise<void>{const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record,'current');tx.objectStore(STORE).put({savedAt:record.savedAt,pageCount:record.pageCount,bytes:record.bytes},'info');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('저장 공간이 부족하거나 저장할 수 없습니다.'));tx.onabort=()=>reject(new Error('작업 저장이 중단되었습니다.'));});}finally{db.close();}}
export async function deleteBackup():Promise<void>{const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('저장본을 삭제할 수 없습니다.'));tx.onabort=()=>reject(new Error('저장본 삭제가 중단되었습니다.'));});}finally{db.close();}}
