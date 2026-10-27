import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { SourceFile } from './types';
const mocks=vi.hoisted(()=>({getDocument:vi.fn(),destroy:vi.fn(async()=>{})}));
vi.mock('pdfjs-dist',()=>({GlobalWorkerOptions:{},getDocument:mocks.getDocument,PasswordResponses:{NEED_PASSWORD:1},version:'6.2.108'}));
import { clearPdfCache, importFile, pdfDocument, releasePdfDocument } from './files';
const source:SourceFile={id:'original',name:'source.pdf',kind:'pdf',mime:'application/pdf',bytes:new Uint8Array([1,2,3])};
beforeEach(async()=>{clearPdfCache();await Promise.resolve();vi.clearAllMocks();vi.stubGlobal('window',{location:{href:'https://moa.example/'}});mocks.getDocument.mockImplementation(()=>({promise:Promise.resolve({numPages:201}),destroy:mocks.destroy}));});
afterEach(()=>{clearPdfCache();vi.unstubAllGlobals();});
describe('safe local file loading',()=>{
 it('can cancel a PDF while its loading promise is still pending',()=>{mocks.getDocument.mockReturnValue({promise:new Promise(()=>{}),destroy:mocks.destroy});void pdfDocument(source);releasePdfDocument(source.id);expect(mocks.destroy).toHaveBeenCalledTimes(1);void pdfDocument(source);expect(mocks.getDocument).toHaveBeenCalledTimes(2);});
 it('releases every loading task when clearing the preview cache',()=>{mocks.getDocument.mockReturnValue({promise:new Promise(()=>{}),destroy:mocks.destroy});void pdfDocument(source);void pdfDocument({...source,id:'second'});clearPdfCache();expect(mocks.destroy).toHaveBeenCalledTimes(2);});
 it('points PDF CMaps, fonts and decoders at the same deployment with a versioned path',async()=>{await pdfDocument(source);const options=mocks.getDocument.mock.calls[0][0];expect(options.cMapUrl).toBe('https://moa.example/pdfjs/6.2.108/cmaps/');expect(options.standardFontDataUrl).toBe('https://moa.example/pdfjs/6.2.108/standard_fonts/');expect(options.wasmUrl).toBe('https://moa.example/pdfjs/6.2.108/wasm/');expect(options.iccUrl).toBe('https://moa.example/pdfjs/6.2.108/iccs/');expect(options.enableXfa).toBe(false);expect(options.data).toEqual(source.bytes);expect(options.data).not.toBe(source.bytes);});
 it('shares a successfully opened PDF rather than copying it for every page preview',async()=>{await pdfDocument(source);await pdfDocument(source);expect(mocks.getDocument).toHaveBeenCalledTimes(1);});
 it('rejects a renamed SVG before creating a browser image or PDF task',async()=>{await expect(importFile(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'not-a-photo.png'))).rejects.toThrow('실제 형식');expect(mocks.getDocument).not.toHaveBeenCalled();});
 it('rejects mismatched PNG/JPEG headers and unsupported extensions',async()=>{await expect(importFile(new File([new Uint8Array([255,216,255,0])],'photo.png'))).rejects.toThrow('실제 형식');await expect(importFile(new File(['text'],'notes.txt'))).rejects.toThrow('PNG');});
 it('releases the document cache when a PDF exceeds the page limit',async()=>{const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();await expect(importFile(new File([bytes.slice().buffer],'too-many.pdf'))).rejects.toThrow('200');await Promise.resolve();expect(mocks.destroy).toHaveBeenCalledTimes(1);});
 it('does not keep an invalid PDF in the loading cache',async()=>{await expect(importFile(new File(['%PDF-broken'],'broken.pdf'))).rejects.toThrow('PDF를 읽을');expect(mocks.getDocument).not.toHaveBeenCalled();});
});
