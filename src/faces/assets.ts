import {ITEMS,invariant} from './model'
const assetUrls=import.meta.glob('./assets/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>
export type Loaded={image:HTMLImageElement;url:string}
export async function loadPortrait(index:number):Promise<Loaded>{
  const item=ITEMS[index],src=assetUrls[`./assets/${item.assetId}.png`]
  invariant(src,'Original portrait is missing')
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),5000)
  let blobUrl:string|null=null
  try{
   const response=await fetch(src,{signal:controller.signal});invariant(response.ok,'Portrait unavailable')
   const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
   invariant(hash===item.assetSha256,'Portrait identity changed')
   blobUrl=URL.createObjectURL(new Blob([bytes],{type:'image/png'}))
   const image=new Image();image.src=blobUrl;image.alt=`Portrait ${index+1}`;image.draggable=false
   await Promise.race([image.decode(),new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('Portrait decode timed out')),{once:true}))])
   invariant(image.naturalWidth>0&&image.naturalHeight>0,'Portrait failed to decode')
   return {image,url:blobUrl}
  }catch(e){if(blobUrl)URL.revokeObjectURL(blobUrl);throw e}
  finally{clearTimeout(timer)}
 }
