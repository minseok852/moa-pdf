import type { PageItem, Rect, Settings } from './types';
import { contentSize, modRotation, paperSize, placement } from './layout';
export function rotatedSize(width:number,height:number,rotation:number){return modRotation(rotation)%180?{width:height,height:width}:{width,height};}
export function rotateRect(rect:Rect,rotation:number):Rect {
 switch(modRotation(rotation)){
  case 90:return {x:1-rect.y-rect.height,y:rect.x,width:rect.height,height:rect.width};
  case 180:return {x:1-rect.x-rect.width,y:1-rect.y-rect.height,width:rect.width,height:rect.height};
  case 270:return {x:rect.y,y:1-rect.x-rect.width,width:rect.height,height:rect.width};
  default:return {...rect};
 }
}
export const evenCuts=(count:number)=>Array.from({length:count-1},(_,i)=>(i+1)/count);
export function moveCut(cuts:number[],index:number,value:number){
 const gap=.002,low=(cuts[index-1]??0)+gap,high=(cuts[index+1]??1)-gap;
 if(!Number.isFinite(value)||index<0||index>=cuts.length)return cuts;
 return cuts.map((cut,i)=>i===index?Math.max(low,Math.min(high,value)):cut);
}
export function splitCrops(page:PageItem,cuts:number[]):Rect[]{
 if(cuts.some((cut,i)=>!Number.isFinite(cut)||cut<=0||cut>=1||(i>0&&cut<=cuts[i-1])))throw new Error('분할선 순서를 확인해 주세요.');
 const visible=rotateRect(page.crop??{x:0,y:0,width:1,height:1},page.rotation),edges=[0,...cuts,1];
 return edges.slice(0,-1).map((start,i)=>rotateRect({...visible,y:visible.y+visible.height*start,height:visible.height*(edges[i+1]-start)},-page.rotation));
}
export function imagePrintResolution(page:PageItem,settings:Settings):number|null {
 if(page.kind!=='image')return null;
 const opts={...settings,...page.settings},size=contentSize(page),paper=paperSize(opts,size,'image');
 const pos=placement(size,paper,opts.paper==='original'?0:opts.margin,opts.fit);
 const limit=settings.quality==='original'?Infinity:settings.quality==='balanced'?2400:1400;
 const scale=Math.min(1,limit/Math.max(size.width,size.height));
 return Math.min(size.width*scale/pos.width,size.height*scale/pos.height)*72;
}
export function pdfFilename(value:string){const base=value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\.pdf$/i,'');return (base||'모아PDF')+'.pdf';}
export function renderSettingsKey({filename:_filename,...settings}:Settings){return JSON.stringify(settings);}
