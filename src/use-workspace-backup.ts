import { useEffect, useRef, useState } from 'react';
import { useEditor } from './store';
import { clearPdfCache } from './files';
import { backupInfo, deleteBackup, packWorkspace, readBackup, writeBackup } from './workspace-backup';
import type { BackupInfo } from './workspace-backup';
const PREFERENCE='moa-pdf-autosave';
function preference(){try{return localStorage.getItem(PREFERENCE)==='true';}catch{return false;}}
export function useWorkspaceBackup(){
 const {pages,sources,settings,past}=useEditor();
 const [enabled,setEnabled]=useState(preference),[info,setInfo]=useState<BackupInfo|null>(null),[status,setStatus]=useState(''),[ready,setReady]=useState(false),[restoring,setRestoring]=useState(false),[writing,setWriting]=useState(false);
 const generation=useRef(0),queue=useRef<Promise<unknown>>(Promise.resolve()),enabledRef=useRef(enabled);
 function enqueue<T>(operation:()=>Promise<T>):Promise<T>{const result=queue.current.catch(()=>{}).then(operation);queue.current=result.catch(()=>{});return result;}
 useEffect(()=>{let alive=true;void backupInfo().then(value=>{if(alive){setInfo(value);setReady(true);}}).catch(()=>{if(alive){setStatus('이 브라우저에서 기기 저장을 사용할 수 없습니다.');setReady(true);}});return()=>{alive=false;generation.current++;};},[]);
 useEffect(()=>{
  const token=++generation.current;
  if(!ready||!enabled||(!pages.length&&!past.length))return;
  setWriting(true);setStatus('변경 내용을 저장할 예정입니다.');
  const timer=setTimeout(()=>{void enqueue(async()=>{if(token!==generation.current||!enabledRef.current)return;const record=packWorkspace({pages,sources,settings});await writeBackup(record);if(token===generation.current){setInfo(record);setStatus('이 기기에 자동 저장했습니다.');}}).catch(error=>{if(token===generation.current)setStatus(error instanceof Error?error.message:'작업을 저장하지 못했습니다.');}).finally(()=>{if(token===generation.current)setWriting(false);});},900);
  return()=>{clearTimeout(timer);};
 },[pages,sources,settings,enabled,ready,past]);
 function toggle(value:boolean){generation.current++;enabledRef.current=value;setEnabled(value);setWriting(false);setStatus(value?'변경 내용을 이 기기에 저장합니다.':'자동 저장을 껐습니다. 기존 저장본은 아래 버튼으로 삭제할 수 있습니다.');try{localStorage.setItem(PREFERENCE,String(value));}catch{setStatus('자동 저장 선택을 기억하지 못합니다. 이 창에서만 적용됩니다.');}}
 async function removeSaved(){generation.current++;setWriting(false);try{await enqueue(deleteBackup);setInfo(null);setStatus('이 기기에 저장된 작업을 삭제했습니다. 현재 편집 내용은 남아 있습니다.');}catch(error){setStatus(error instanceof Error?error.message:'저장본을 삭제하지 못했습니다.');}}
 async function restore(){if(restoring)return;const before=useEditor.getState();generation.current++;setRestoring(true);try{await enqueue(async()=>{const saved=await readBackup();const live=useEditor.getState();if(live.pages!==before.pages||live.sources!==before.sources||live.settings!==before.settings)throw new Error('편집 내용이 바뀌어 복구를 취소했습니다.');const nextSources={...saved.sources};const urls:string[]=[];try{for(const source of Object.values(nextSources)){if(source.kind==='image'){source.url=URL.createObjectURL(new Blob([source.bytes.slice().buffer as ArrayBuffer],{type:source.mime}));urls.push(source.url);}}}catch(error){urls.forEach(url=>URL.revokeObjectURL(url));throw error;}const current=useEditor.getState();for(const source of Object.values(current.sources))if(source.url)URL.revokeObjectURL(source.url);clearPdfCache();current.restoreWorkspace({pages:saved.pages,sources:nextSources,settings:saved.settings});setStatus('저장한 작업을 복구했습니다. 실행 취소 이력은 새로 시작합니다.');});}catch(error){setStatus(error instanceof Error?error.message:'작업을 복구하지 못했습니다.');}finally{setRestoring(false);}}
 return {enabled,toggle,info,status,restoring,writing,removeSaved,restore,ready};
}
