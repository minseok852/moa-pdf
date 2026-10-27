import { describe, expect, it } from 'vitest';
import { mixedSettings, patchPageSettings, reorderPages, sizingMode, sizingPatch } from './editor-actions';
import { DEFAULT_SETTINGS } from './types';
import type { PageItem } from './types';
const page=(id:string):PageItem=>({id,sourceId:id,sourceName:id+'.pdf',sourceIndex:0,kind:'pdf',width:300,height:500,rotation:0,thumbnail:''});
const pages=['a','b','c','d','e'].map(page);
const ids=(result:PageItem[])=>result.map(item=>item.id);
describe('page group movement',()=>{
 it('moves selected pages to the end in document order, regardless of selection order',()=>{expect(ids(reorderPages(pages,['d','b'],5))).toEqual(['a','c','e','b','d']);});
 it('moves a noncontiguous selection to the beginning',()=>{expect(ids(reorderPages(pages,['b','d'],0))).toEqual(['b','d','a','c','e']);});
 it('calculates an insertion boundary before removing selected pages',()=>{expect(ids(reorderPages(pages,['b','d'],3))).toEqual(['a','c','b','d','e']);});
 it('moves a single page backward',()=>{expect(ids(reorderPages(pages,['e'],1))).toEqual(['a','e','b','c','d']);});
 it('preserves page identities and crop/rotation metadata during a move',()=>{const source=[{...page('a'),rotation:90,crop:{x:.1,y:.2,width:.5,height:.3}},page('b')];const result=reorderPages(source,['a'],2);expect(result[1]).toBe(source[0]);});
 it('does not create history for an unchanged order or all-page movement',()=>{expect(reorderPages(pages,['b','c'],3)).toBe(pages);expect(reorderPages(pages,pages.map(p=>p.id),0)).toBe(pages);expect(reorderPages(pages,[],0)).toBe(pages);});
 it('clamps the insertion boundary',()=>{expect(ids(reorderPages(pages,['e'],-20))[0]).toBe('e');expect(ids(reorderPages(pages,['a'],100)).at(-1)).toBe('a');});
});
describe('page settings drafts and mixed values',()=>{
 const source=[{...page('a'),settings:{margin:3,paper:'a4' as const}},{...page('b'),settings:{margin:20,paper:'letter' as const}},page('c')];
 it('finds differing effective values without marking common values mixed',()=>{expect(mixedSettings(source.slice(0,2),DEFAULT_SETTINGS)).toEqual(['paper','margin']);});
 it('applies only the touched field to each selected page',()=>{const result=patchPageSettings(source,['a','b'],{orientation:'landscape'});expect(result[0].settings).toEqual({margin:3,paper:'a4',orientation:'landscape'});expect(result[1].settings).toEqual({margin:20,paper:'letter',orientation:'landscape'});expect(result[2]).toBe(source[2]);});
 it('does not mutate the original draft source or create a new object for an empty patch',()=>{patchPageSettings(source,['a'],{margin:10});expect(source[0].settings?.margin).toBe(3);expect(patchPageSettings(source,['a'],{})).toBe(source);});
 it('compares inherited settings with explicit values',()=>{expect(mixedSettings([{...page('a'),settings:{margin:10}},page('b')],DEFAULT_SETTINGS)).not.toContain('margin');});
 it('maps the three sizing choices to actual export settings',()=>{for(const mode of ['images','all','original'] as const){expect(sizingMode({...DEFAULT_SETTINGS,...sizingPatch(mode,'a4')})).toBe(mode);}expect(sizingPatch('all','original')).toEqual({paper:'a4',keepPdfSize:false});});
});
