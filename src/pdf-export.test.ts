import { describe, expect, it, beforeEach } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { buildPdf } from './pdf-export';
import { contentSize, paperSize, placement, pdfCropBox, MM } from './layout';
import { DEFAULT_SETTINGS } from './types';
import type { PageItem, SourceFile } from './types';
import { useEditor } from './store';
const item:PageItem={id:'p1',sourceId:'s1',sourceName:'source.pdf',sourceIndex:0,kind:'pdf',width:300,height:500,rotation:0,thumbnail:''};
async function fixture(rotation=0){const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage([300,500]);page.drawText('Original selectable text',{x:20,y:400,size:16,font});page.setRotation(degrees(rotation));const bytes=await doc.save();const source:SourceFile={id:'s1',name:'source.pdf',kind:'pdf',bytes,mime:'application/pdf'};return {s1:source};}
describe('output geometry',()=>{
 it('contains a whole landscape image inside portrait margins',()=>{const paper=paperSize({...DEFAULT_SETTINGS,orientation:'portrait'},{width:1200,height:600});const p=placement({width:1200,height:600},paper,10,'contain');expect(p.width).toBeCloseTo(paper.width-20*MM);expect(p.height).toBeCloseTo(p.width/2);expect(p.left).toBeCloseTo(10*MM);expect(p.bottom).toBeGreaterThan(10*MM);});
 it('covers the entire available area while preserving aspect ratio',()=>{const p=placement({width:1200,height:600},{width:600,height:800},10,'cover');expect(p.width).toBeGreaterThan(600);expect(p.height).toBeCloseTo(800-20*MM);expect(p.width/p.height).toBeCloseTo(2);});
 it('uses the cropped and rotated size for automatic paper orientation',()=>{const size=contentSize({...item,crop:{x:0,y:0,width:1,height:.25},rotation:90});expect(size).toEqual({width:125,height:300});expect(paperSize(DEFAULT_SETTINGS,size).height).toBeGreaterThan(paperSize(DEFAULT_SETTINGS,size).width);});
 it.each([0,90,180,270])('maps a full PDF crop box identically for rotation %i',r=>{const b={x:15,y:20,width:300,height:500};expect(pdfCropBox(b,r,{x:0,y:0,width:1,height:1})).toEqual(b);});
 it('maps a top-half crop for an originally rotated PDF',()=>{expect(pdfCropBox({x:20,y:30,width:300,height:500},90,{x:0,y:0,width:1,height:.5})).toEqual({x:20,y:30,width:150,height:500});});
});
describe('actual PDF generation',()=>{
 it('rejects empty output',async()=>{await expect(buildPdf([],{},DEFAULT_SETTINGS)).rejects.toThrow('페이지');});
 it('copies original page dimensions and applies relative rotation',async()=>{const sources=await fixture(90);const bytes=await buildPdf([{...item,width:500,height:300,rotation:90}],sources,DEFAULT_SETTINGS);const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(1);expect(doc.getPage(0).getRotation().angle).toBe(180);expect(doc.getPage(0).getSize()).toEqual({width:300,height:500});});
 it('normalizes PDF pages to A4 without converting to an image',async()=>{const sources=await fixture();const bytes=await buildPdf([item],sources,{...DEFAULT_SETTINGS,keepPdfSize:false});const doc=await PDFDocument.load(bytes);expect(doc.getPage(0).getWidth()).toBeCloseTo(210*MM);expect(doc.getPage(0).getHeight()).toBeCloseTo(297*MM);const resources=doc.getPage(0).node.Resources();expect(resources?.toString()).toContain('/XObject');expect(doc.getPage(0).node.toString()).not.toContain('/Subtype /Image');});
 it('exports duplicate/source pages in requested order with independent crops',async()=>{const sources=await fixture();const pages=[{...item,id:'a',crop:{x:0,y:0,width:1,height:.5}},{...item,id:'b',rotation:270}];const progress:number[]=[];const bytes=await buildPdf(pages,sources,{...DEFAULT_SETTINGS,pageNumbers:true},n=>progress.push(n));const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBe(2);expect(doc.getPage(0).getCropBox().height).toBe(250);expect(doc.getPage(1).getCropBox().height).toBe(500);expect(doc.getPage(1).getRotation().angle).toBe(270);expect(progress).toEqual([.5,1]);});
 it('keeps individual paper exceptions when global PDF sizing is preserved',async()=>{const sources=await fixture();const bytes=await buildPdf([{...item,settings:{keepPdfSize:false,paper:'letter',orientation:'landscape'}}],sources,DEFAULT_SETTINGS);const doc=await PDFDocument.load(bytes);expect(doc.getPage(0).getSize()).toEqual({width:792,height:612});});
});
describe('editor history',()=>{
 beforeEach(()=>useEditor.getState().reset());
 it('restores deleted pages and settings through undo and redo',()=>{const s=useEditor.getState();s.add([item],[]);s.configure({...DEFAULT_SETTINGS,margin:22});s.commit([]);s.undo();expect(useEditor.getState().pages).toEqual([item]);expect(useEditor.getState().settings.margin).toBe(22);s.undo();expect(useEditor.getState().settings.margin).toBe(10);s.redo();expect(useEditor.getState().settings.margin).toBe(22);});
 it('inserts new files at the selected position',()=>{const s=useEditor.getState();s.add([item],[]);s.add([{...item,id:'inserted'}],[],0);expect(useEditor.getState().pages.map(p=>p.id)).toEqual(['inserted','p1']);});
});
