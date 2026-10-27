import { describe, expect, it } from 'vitest';
import { cropRatio, drawCrop, fitCropAspect, FULL_CROP, isFullCrop, moveCrop, normalizeCrop, resizeCrop } from './crop-geometry';
import type { CropHandle } from './crop-geometry';
import type { Rect } from './types';
const initial:Rect={x:.2,y:.25,width:.5,height:.4};
function inside(rect:Rect){expect(rect.x).toBeGreaterThanOrEqual(-1e-10);expect(rect.y).toBeGreaterThanOrEqual(-1e-10);expect(rect.x+rect.width).toBeLessThanOrEqual(1+1e-10);expect(rect.y+rect.height).toBeLessThanOrEqual(1+1e-10);expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThan(0);}
describe('free selection resizing',()=>{
 it('resizes just the right edge without changing the left edge or height',()=>{const result=resizeCrop(initial,'e',.1,.1);expect(result.x).toBe(initial.x);expect(result.y).toBe(initial.y);expect(result.width).toBeCloseTo(.6,10);expect(result.height).toBe(initial.height);});
 it('lets a corner independently change width and height',()=>{const result=resizeCrop(initial,'nw',-.1,.1);expect(result.x).toBeCloseTo(.1);expect(result.y).toBeCloseTo(.35);expect(result.width).toBeCloseTo(.6);expect(result.height).toBeCloseTo(.3);});
 it('moves the selection without resizing and clamps to the image',()=>{expect(moveCrop(initial,5,-5)).toEqual({x:.5,y:0,width:.5,height:.4});});
 it.each(['n','ne','e','se','s','sw','w','nw'] as CropHandle[])('keeps %s inside the source even when dragged across the opposite edge',handle=>{for(const dx of [-2,0,2])for(const dy of [-2,0,2])inside(resizeCrop(initial,handle,dx,dy));});
 it('creates new selections in all four drag directions',()=>{for(const end of [{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]){const result=drawCrop({x:.5,y:.5},end);inside(result);expect(result.width).toBeCloseTo(.4);expect(result.height).toBeCloseTo(.4);}});
 it('recognizes full selection and normalizes malformed stored crops',()=>{expect(isFullCrop(FULL_CROP)).toBe(true);expect(isFullCrop(initial)).toBe(false);expect(normalizeCrop({x:-10,y:3,width:NaN,height:2})).toEqual(FULL_CROP);});
});
describe('optional aspect lock',()=>{
 it('converts pixel ratios correctly on portrait images',()=>{const ratio=cropRatio(1,.5)!;const result=fitCropAspect(FULL_CROP,ratio);expect(result.width/result.height*.5).toBeCloseTo(1);expect(result.x+result.width/2).toBeCloseTo(.5);expect(result.y+result.height/2).toBeCloseTo(.5);});
 it('does not alter a prior crop when free crop is selected',()=>{expect(fitCropAspect(initial,undefined)).toEqual(initial);expect(cropRatio(undefined,2)).toBeUndefined();});
 it.each(['n','ne','e','se','s','sw','w','nw'] as CropHandle[])('preserves the locked aspect for %s at source boundaries',handle=>{for(const ratio of [.2,1,3]){const rect=fitCropAspect(initial,ratio);for(const dx of [-2,-.1,0,.3,2])for(const dy of [-2,0,.4,2]){const result=resizeCrop(rect,handle,dx,dy,ratio);inside(result);expect(result.width/result.height).toBeCloseTo(ratio,7);}}});
 it('anchors the opposite corner while a locked corner is resized',()=>{const rect=fitCropAspect(initial,1),result=resizeCrop(rect,'nw',-.1,-.2,1);expect(result.x+result.width).toBeCloseTo(rect.x+rect.width);expect(result.y+result.height).toBeCloseTo(rect.y+rect.height);});
 it('keeps a newly drawn locked rectangle inside the image',()=>{for(const end of [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]){const rect=drawCrop({x:.3,y:.6},end,2);inside(rect);expect(rect.width/rect.height).toBeCloseTo(2);}});
});
