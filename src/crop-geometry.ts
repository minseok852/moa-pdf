import type { Rect } from './types';
export type CropHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type CropPoint = { x: number; y: number };
export const FULL_CROP: Rect = { x:0, y:0, width:1, height:1 };
const MIN = 0.00001;
const clamp = (value:number, low:number, high:number) => Math.min(high, Math.max(low, value));
const finite = (value:number, fallback:number) => Number.isFinite(value)?value:fallback;
export function normalizeCrop(rect:Rect):Rect {
 const width=clamp(finite(rect.width,1),MIN,1),height=clamp(finite(rect.height,1),MIN,1);
 return {x:clamp(finite(rect.x,0),0,1-width),y:clamp(finite(rect.y,0),0,1-height),width,height};
}
export function moveCrop(rect:Rect,dx:number,dy:number):Rect {
 return {...rect,x:clamp(rect.x+dx,0,1-rect.width),y:clamp(rect.y+dy,0,1-rect.height)};
}
// A pixel aspect ratio becomes width/height in the normalized image coordinate system.
export function cropRatio(aspect:number|undefined,imageAspect:number) {
 return aspect&&Number.isFinite(aspect)&&aspect>0?aspect/imageAspect:undefined;
}
export function fitCropAspect(rect:Rect,ratio?:number):Rect {
 if(!ratio)return {...rect};
 const width=Math.min(rect.width,rect.height*ratio),height=width/ratio;
 return {x:rect.x+(rect.width-width)/2,y:rect.y+(rect.height-height)/2,width,height};
}
export function resizeCrop(rect:Rect,handle:CropHandle,dx:number,dy:number,ratio?:number):Rect {
 const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s');
 if(!ratio){
  let left=rect.x,right=rect.x+rect.width,top=rect.y,bottom=rect.y+rect.height;
  if(west)left=clamp(left+dx,0,right-MIN);
  if(east)right=clamp(right+dx,left+MIN,1);
  if(north)top=clamp(top+dy,0,bottom-MIN);
  if(south)bottom=clamp(bottom+dy,top+MIN,1);
  return {x:left,y:top,width:right-left,height:bottom-top};
 }
 const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
 if((west||east)&&(north||south)){
  const sx=west?-1:1,sy=north?-1:1,ax=west?rect.x+rect.width:rect.x,ay=north?rect.y+rect.height:rect.y;
  const desired=Math.abs(dx)/rect.width>=Math.abs(dy)/rect.height?rect.width+sx*dx:(rect.height+sy*dy)*ratio;
  const max=Math.min(sx>0?1-ax:ax,(sy>0?1-ay:ay)*ratio);
  const width=clamp(desired,Math.max(MIN,MIN*ratio),max),height=width/ratio;
  return {x:sx<0?ax-width:ax,y:sy<0?ay-height:ay,width,height};
 }
 if(west||east){
  const ax=west?rect.x+rect.width:rect.x,max=Math.min(west?ax:1-ax,2*Math.min(cy,1-cy)*ratio);
  const width=clamp(rect.width+(west?-dx:dx),Math.max(MIN,MIN*ratio),max),height=width/ratio;
  return {x:west?ax-width:ax,y:cy-height/2,width,height};
 }
 const ay=north?rect.y+rect.height:rect.y,max=Math.min(north?ay:1-ay,2*Math.min(cx,1-cx)/ratio);
 const height=clamp(rect.height+(north?-dy:dy),Math.max(MIN,MIN/ratio),max),width=height*ratio;
 return {x:cx-width/2,y:north?ay-height:ay,width,height};
}
export function drawCrop(start:CropPoint,end:CropPoint,ratio?:number):Rect {
 const sx=end.x>=start.x?1:-1,sy=end.y>=start.y?1:-1;
 if(!ratio)return normalizeCrop({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)});
 const max=Math.min(sx>0?1-start.x:start.x,(sy>0?1-start.y:start.y)*ratio);
 const width=clamp(Math.max(Math.abs(end.x-start.x),Math.abs(end.y-start.y)*ratio),Math.max(MIN,MIN*ratio),max),height=width/ratio;
 return {x:sx<0?start.x-width:start.x,y:sy<0?start.y-height:start.y,width,height};
}
export function isFullCrop(rect:Rect) {
 return Math.abs(rect.x)<1e-8&&Math.abs(rect.y)<1e-8&&Math.abs(rect.width-1)<1e-8&&Math.abs(rect.height-1)<1e-8;
}
