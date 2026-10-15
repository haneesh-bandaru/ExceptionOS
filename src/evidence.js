import {randomUUID} from 'node:crypto';
import {clean,now} from './core.js';
export function makeSource(userId,caseId,input){
  if(!['official','supporting'].includes(input.type))throw Object.assign(Error('Invalid source type'),{status:400});
  let url;try{url=new URL(String(input.url||''));}catch{throw Object.assign(Error('Enter a valid source URL'),{status:400});}
  if(url.protocol!=='https:' || url.username || url.password || url.hostname==='localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname))throw Object.assign(Error('A public HTTPS source URL is required'),{status:400});
  const title=clean(input.title,160);if(title.length<3)throw Object.assign(Error('Source title required'),{status:400});
  return {id:randomUUID(),userId,caseId,type:input.type,title,url:url.toString(),notes:clean(input.notes,1500),reviewStatus:'unreviewed',addedAt:now()};
}
export function publicSource(s){return {id:s.id,title:s.title,url:s.url,type:s.type,reviewStatus:s.reviewStatus,notes:s.notes};}
