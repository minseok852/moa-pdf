import { describe, expect, it, beforeEach } from 'vitest';
import { packWorkspace, unpackWorkspace } from './workspace-backup';
import { DEFAULT_SETTINGS } from './types';
import { useEditor } from './store';
import type { PageItem, SourceFile } from './types';
const page:PageItem={id:'p',sourceId:'s',sourceName:'image.png',sourceIndex:0,kind:'image',width:1000,height:2000,rotation:90,crop:{x:.1,y:.2,width:.5,height:.6},thumbnail:'data:image/png;base64,AA',settings:{margin:5}};
const source:SourceFile={id:'s',name:'image.png',kind:'image',bytes:new Uint8Array([137,80,78,71]),mime:'image/png',url:'blob:old-session-url'};
const workspace={pages:[page],sources:{s:source,unused:{...source,id:'unused'}},settings:DEFAULT_SETTINGS};
describe('local work recovery data',()=>{
 it('stores source bytes and edits while omitting stale object URLs and unused files',()=>{const saved=packWorkspace(workspace,123);expect(Object.keys(saved.sources)).toEqual(['s']);expect(saved.sources.s.url).toBeUndefined();expect(saved.sources.s.bytes).toEqual(source.bytes);expect(saved.pages[0].crop).toEqual(page.crop);expect(saved.savedAt).toBe(123);expect(saved.bytes).toBe(4);});
 it('round-trips the browser structured-clone format without losing image data or per-page settings',()=>{const restored=unpackWorkspace(structuredClone(packWorkspace(workspace)));expect(restored.sources.s.bytes).toBeInstanceOf(Uint8Array);expect(restored.pages[0].rotation).toBe(90);expect(restored.pages[0].settings).toEqual({margin:5});expect(restored.sources.s.bytes).toEqual(source.bytes);});
 it('rejects pages whose source is absent',()=>{const saved=packWorkspace(workspace);saved.sources={};expect(()=>unpackWorkspace(saved)).toThrow('페이지');});
 it('rejects corrupt crops and settings instead of replacing the current work',()=>{const saved=packWorkspace(workspace);expect(()=>unpackWorkspace({...saved,pages:[{...page,crop:{x:.8,y:0,width:.5,height:1}}]})).toThrow('자르기');expect(()=>unpackWorkspace({...saved,settings:{...DEFAULT_SETTINGS,margin:-10}})).toThrow('형식');});
 it('supports an empty saved workspace after all pages have been removed',()=>{const saved=packWorkspace({...workspace,pages:[]});expect(saved.sources).toEqual({});expect(unpackWorkspace(saved).pageCount).toBe(0);});
});
describe('restoring editor state',()=>{
 beforeEach(()=>useEditor.getState().reset());
 it('restores the original order and settings without retaining an unrelated undo history',()=>{const editor=useEditor.getState();editor.add([{...page,id:'old'}],[source]);editor.restoreWorkspace({pages:[page],sources:{s:source},settings:{...DEFAULT_SETTINGS,filename:'복구'}});const restored=useEditor.getState();expect(restored.pages.map(p=>p.id)).toEqual(['p']);expect(restored.settings.filename).toBe('복구');expect(restored.past).toEqual([]);expect(restored.future).toEqual([]);expect(restored.selected).toEqual([]);});
});
