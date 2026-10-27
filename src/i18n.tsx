import { useSyncExternalStore } from 'react';
import { Languages } from 'lucide-react';
import english from './locales/en.json';
export type Locale='ko'|'en';
export const LOCALE_KEY='moa-pdf-language';
const messages:Record<string,string>=english;
const listeners=new Set<()=>void>();
export function resolveLocale(saved:unknown,languages:readonly string[]):Locale {
 if(saved==='ko'||saved==='en')return saved;
 const preferred=languages.find(language=>/^(ko|en)(-|$)/i.test(language));
 return preferred?.toLowerCase().startsWith('ko')?'ko':'en';
}
function initialLocale():Locale {
 let saved:unknown;try{saved=localStorage.getItem(LOCALE_KEY);}catch{/* Preferences are optional. */}
 return resolveLocale(saved,typeof navigator==='undefined'?['ko']:navigator.languages??[navigator.language]);
}
let locale=initialLocale();
const escapeRegex=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Dynamic status messages stay in Korean in editor state. Resolve their templates at
// render time so existing toasts/errors update when the language is changed.
const patterns=Object.entries(messages).filter(([key])=>/\{\d+\}/.test(key)).sort(([a],[b])=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(([key,value])=>{
 const indices:number[]=[];
 const expression=key.split(/(\{\d+\})/g).map(part=>/^\{\d+\}$/.test(part)?(indices.push(Number(part.slice(1,-1))),'([\\s\\S]*?)'):escapeRegex(part)).join('');
 return {regex:new RegExp('^'+expression+'$'),value,indices};
});
function format(template:string,values:readonly unknown[],language:Locale):string {
 return template.replace(/\{(\d+)(?::([^|{}]+)\|([^{}]+))?\}/g,(_all,index,singular,plural)=>{
  const value=values[Number(index)];
  if(singular!==undefined)return Number(value)===1?singular:plural;
  return typeof value==='string'&&Object.hasOwn(messages,value)?translate(language,value):String(value??'');
 });
}
export function translate(language:Locale,key:string,values?:readonly unknown[]):string {
 if(language==='ko')return values?format(key,values,'ko'):key;
 const exact=messages[key];
 if(exact!==undefined)return format(exact,values??[],language);
 if(values)return format(key,values,language);
 for(const pattern of patterns){const match=key.match(pattern.regex);if(match){const args:string[]=[];pattern.indices.forEach((index,i)=>{args[index]=match[i+1];});return format(pattern.value,args,language);}}
 // File import errors retain their original filename prefix.
 const separator=key.indexOf(': ');
 if(separator>=0){const suffix=key.slice(separator+2);const localized=translate(language,suffix);if(localized!==suffix)return key.slice(0,separator+2)+localized;}
 return key;
}
export function t(key:string,values?:readonly unknown[]):string{return translate(locale,key,values);}
export function getLocale(){return locale;}
function updateMetadata(){if(typeof document==='undefined')return;document.documentElement.lang=locale;document.title=t('모아PDF — 흩어진 페이지를, 하나의 PDF로');document.querySelector('meta[name="description"]')?.setAttribute('content',t('사진과 PDF를 원하는 순서로 모으세요. 페이지 회전, 자르기, 용지 크기 설정부터 PDF 다운로드까지 브라우저에서 완성합니다.'));}
export function setLocale(value:Locale){locale=value;try{localStorage.setItem(LOCALE_KEY,value);}catch{/* Keep switching usable when storage is unavailable. */}updateMetadata();listeners.forEach(listener=>listener());}
export function useLocale(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getLocale,getLocale);}
export function LanguageSelector(){const language=useLocale();return <label className="language-selector"><Languages size={16} aria-hidden="true"/><select aria-label={t('언어')} value={language} onChange={event=>setLocale(event.target.value as Locale)}><option value="ko" lang="ko">한국어</option><option value="en" lang="en">English</option></select></label>;}
if(typeof window!=='undefined'){updateMetadata();window.addEventListener('storage',event=>{if(event.key===LOCALE_KEY){locale=resolveLocale(event.newValue,navigator.languages);updateMetadata();listeners.forEach(listener=>listener());}});}
