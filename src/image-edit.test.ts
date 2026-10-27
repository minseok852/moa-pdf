import { describe, expect, it } from 'vitest';
import { imagePrintResolution, rotateRect, rotatedSize, splitCrops, evenCuts, moveCut, pdfFilename, renderSettingsKey } from './image-edit';
import { DEFAULT_SETTINGS } from './types';
import type { PageItem } from './types';
const page:PageItem={id:'page',sourceId:'source',sourceName:'capture.png',sourceIndex:0,kind:'image',width:900,height:20000,thumbnail:'data:image/png;base64,AA',rotation:0,crop:{x:.1,y:.15,width:.7,height:.6}};
const rect={x:.1,y:.2,width:.35,height:.45};
function close(a:typeof rect,b:typeof rect){for(const key of ['x','y','width','height'] as const)expect(a[key]).toBeCloseTo(b[key],10);}
describe('editing in the visible orientation',()=>{
 it.each([0,90,180,270])('maps a crop to the %i-degree view and back without changing the source selection',rotation=>{close(rotateRect(rotateRect(rect,rotation),-rotation),rect);});
 it('maps the top-left quarter to the top-right when rotated clockwise',()=>{close(rotateRect({x:0,y:0,width:.5,height:.5},90),{x:.5,y:0,width:.5,height:.5});expect(rotatedSize(900,20000,90)).toEqual({width:20000,height:900});});
 it.each([0,90,180,270])('splits the currently visible cropped area without gaps for %i degrees',rotation=>{const source={...page,rotation},cuts=[.2,.65],pieces=splitCrops(source,cuts),view=rotateRect(page.crop!,rotation);const displayPieces=pieces.map(piece=>rotateRect(piece,rotation));expect(pieces).toHaveLength(3);displayPieces.forEach((piece,i)=>{expect(piece.x).toBeCloseTo(view.x);expect(piece.width).toBeCloseTo(view.width);expect(piece.y).toBeCloseTo(view.y+view.height*([0,...cuts][i]));});expect(displayPieces.reduce((sum,p)=>sum+p.height,0)).toBeCloseTo(view.height);expect(displayPieces[2].y+displayPieces[2].height).toBeCloseTo(view.y+view.height);});
 it('does not allow a split line to cross its neighbors or leave the image',()=>{expect(moveCut([.2,.5,.8],1,1)[1]).toBeCloseTo(.798);expect(moveCut([.2,.5,.8],1,-1)[1]).toBeCloseTo(.202);expect(evenCuts(4)).toEqual([.25,.5,.75]);expect(()=>splitCrops(page,[.8,.2])).toThrow();});
});
describe('print quality and result names',()=>{
 it('warns for a tiny image enlarged to A4 and keeps a large image above the threshold',()=>{const small={...page,width:100,height:100,crop:undefined},large={...small,width:3000,height:3000};expect(imagePrintResolution(small,DEFAULT_SETTINGS)).toBeLessThan(149);expect(imagePrintResolution(large,DEFAULT_SETTINGS)).toBeGreaterThan(149);});
 it('includes output image downsampling and per-page settings in its estimate',()=>{const large={...page,width:5000,height:5000,crop:undefined};expect(imagePrintResolution(large,{...DEFAULT_SETTINGS,quality:'small'})).toBeLessThan(imagePrintResolution(large,DEFAULT_SETTINGS)!);expect(imagePrintResolution({...large,settings:{paper:'original'}},DEFAULT_SETTINGS)).toBeCloseTo(150);expect(imagePrintResolution({...large,kind:'pdf'},DEFAULT_SETTINGS)).toBeNull();});
 it('keeps the same PDF generation key when only the download name changes',()=>{expect(renderSettingsKey(DEFAULT_SETTINGS)).toBe(renderSettingsKey({...DEFAULT_SETTINGS,filename:'새 이름'}));expect(renderSettingsKey({...DEFAULT_SETTINGS,margin:20})).not.toBe(renderSettingsKey(DEFAULT_SETTINGS));});
 it('normalizes download names without empty names or duplicate PDF suffixes',()=>{expect(pdfFilename(' 제출용.PDF ')).toBe('제출용.pdf');expect(pdfFilename('.pdf')).toBe('모아PDF.pdf');expect(pdfFilename('a/b')).toBe('a_b.pdf');});
});
