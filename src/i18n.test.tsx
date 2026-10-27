import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { resolveLocale, setLocale, translate } from './i18n';
import english from './locales/en.json';
import App from './App';
import { PagePreviewDialog } from './preview-dialog';
import { SettingsFields } from './settings';
import { ImageViewport } from './image-viewport';
import { useEditor } from './store';
import { DEFAULT_SETTINGS } from './types';
import type { PageItem } from './types';
vi.mock('./files',()=>({importFile:vi.fn(),prepareImage:vi.fn(),renderPdfPage:vi.fn(),clearPdfCache:vi.fn(),releasePdfDocument:vi.fn(),sourcePreview:vi.fn(),readImage:vi.fn()}));
afterEach(()=>{setLocale('ko');useEditor.getState().reset();});
const page:PageItem={id:'p',sourceId:'s',sourceName:'sample.png',kind:'image',sourceIndex:0,width:1200,height:1800,thumbnail:'data:image/png;base64,AA',rotation:90};
describe('language selection and interpolation',()=>{
 it('honors a saved language before browser preferences',()=>{expect(resolveLocale('ko',['en-US'])).toBe('ko');expect(resolveLocale('en',['ko-KR'])).toBe('en');});
 it('uses the first supported browser preference and falls back to English',()=>{expect(resolveLocale(null,['en-US','ko'])).toBe('en');expect(resolveLocale(null,['fr','ko-KR'])).toBe('ko');expect(resolveLocale('invalid',['ja'])).toBe('en');});
 it('handles numbers and singular/plural page labels',()=>{expect(translate('en','{0}쪽',[1])).toBe('1 page');expect(translate('en','{0}쪽',[12])).toBe('12 pages');expect(translate('ko','{0}쪽',[12])).toBe('12쪽');});
 it('translates existing progress, notices and filename-prefixed errors at render time',()=>{expect(translate('en','photo.png 불러오는 중 · 1/3')).toBe('Loading photo.png · 1/3');expect(translate('en','2쪽을 삭제했습니다.')).toBe('Deleted 2 pages.');expect(translate('en','1쪽을 추가했습니다. 남은 파일은 취소했습니다.')).toBe('Added 1 page. Remaining files were cancelled.');expect(translate('en','my {0}.png: 파일을 읽을 수 없습니다.')).toBe('my {0}.png: Unable to read the file.');expect(translate('ko','my {0}.png: 파일을 읽을 수 없습니다.')).toBe('my {0}.png: 파일을 읽을 수 없습니다.');});
 it('keeps unknown content unchanged',()=>{expect(translate('en','a user filename.pdf')).toBe('a user filename.pdf');});
 it('has translations for every literal UI key and keeps interpolation variables',()=>{
  const catalog:Record<string,string>=english;
  const files=import.meta.glob('./*.tsx',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
  for(const [file,code] of Object.entries(files).filter(([name])=>!name.includes('.test.'))){
   const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   function visit(node:ts.Node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))expect(catalog[node.arguments[0].text],`${file}: ${node.arguments[0].text}`).toBeTruthy();ts.forEachChild(node,visit);}visit(source);
  }
  for(const [key,value] of Object.entries(catalog)){expect(value).not.toMatch(/[가-힣]/);const variables=[...key.matchAll(/\{(\d+)\}/g)].map(match=>match[1]);for(const variable of variables)expect(value, key).toMatch(new RegExp('\\{'+variable+'(?:\\}|:)'));}
 });
});
describe('localized editor and inspection screens',()=>{
 it('renders the empty editor fully in English and can switch back without losing work',()=>{
  setLocale('en');const html=renderToStaticMarkup(<App/>);expect(html).toContain('Create PDF');expect(html).toContain('Drop your files here');expect(html).toContain('Autosave work on this device');expect(html.replaceAll('한국어','').replaceAll('모아PDF','')).not.toMatch(/[가-힣]/);
  useEditor.getState().add([{...page,crop:{x:.1,y:.2,width:.5,height:.6}}],[{id:'s',name:'sample.png',kind:'image',mime:'image/png',bytes:new Uint8Array([1]),url:'blob:sample'}]);
  const state=useEditor.getState();const before={pages:state.pages,settings:state.settings,past:state.past};setLocale('ko');expect(renderToStaticMarkup(<App/>)).toContain('내 페이지');expect(useEditor.getState().pages[0].crop).toEqual({x:.1,y:.2,width:.5,height:.6});expect(useEditor.getState().pages).toBe(before.pages);expect(useEditor.getState().settings).toBe(before.settings);expect(useEditor.getState().past).toBe(before.past);
 });
 it('renders all sizing modes in English, including mixed individual values',()=>{setLocale('en');const html=renderToStaticMarkup(<SettingsFields value={DEFAULT_SETTINGS} mixed={['margin','orientation']} modeMixed onChange={()=>{}}/>);expect(html).toContain('Fit photos and PDFs');expect(html).toContain('Mixed');expect(html).not.toMatch(/[가-힣]/);});
 it('offers direct crop, rotate, settings and navigation from a page preview',()=>{setLocale('en');const html=renderToStaticMarkup(<PagePreviewDialog page={page} pages={[page]} sources={{}} settings={DEFAULT_SETTINGS} onClose={()=>{}} onNavigate={()=>{}} onRotate={()=>{}} onCrop={()=>{}} onSettings={()=>{}}/>);expect(html).toContain('Page 1 preview');expect(html).toContain('Crop');expect(html).toContain('Rotate');expect(html).toContain('Page settings');expect(html).toContain('Next page');expect(html).not.toMatch(/[가-힣]/);});
 it('exposes accessible magnifier controls and fits the original aspect ratio',()=>{setLocale('en');const html=renderToStaticMarkup(<ImageViewport width={400} height={200} initialPan>{({width,height})=><span data-ratio={width/height}/>}</ImageViewport>);expect(html).toContain('Zoom in');expect(html).toContain('Zoom out');expect(html).toContain('role="spinbutton"');expect(html).toContain('inputMode="decimal"');expect(html).toContain('aria-valuemin="1"');expect(html).toContain('aria-valuemax="100"');expect(html).toContain('Press Enter to apply');expect(html).toContain('Fit page');expect(html).toContain('Fit width');expect(html).toContain('data-ratio="2"');expect(html).toContain('aria-pressed="true"');expect(html).not.toMatch(/[가-힣]/);});
});
