/** Low-level read-only opening primitive. Each source module supplies its own DB constant and validates the returned value. */
export class NativePresenceError extends Error {
  readonly kind: 'missing_database' | 'missing_key' | 'unavailable' | 'corrupt' | 'unsupported' | 'deleted' | 'replaced'
  constructor(kind: 'missing_database' | 'missing_key' | 'unavailable' | 'corrupt' | 'unsupported' | 'deleted' | 'replaced', detail: string) { super(detail); this.kind = kind }
}
// A canceled IDB open cannot itself be canceled. Count it until the browser delivers
// a terminal open event, and never start a third unresolved open for this adapter.
const unresolvedOpens = new Map<string, number>()
export function openExistingNativeDatabase(databaseName: string, signal: AbortSignal): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const pending=unresolvedOpens.get(databaseName)??0
    if(pending>=2){reject(new NativePresenceError('unavailable','Native source open remains unresolved. Reload to check again.'));return}
    unresolvedOpens.set(databaseName,pending+1)
    let request: IDBOpenDBRequest
    try{request=indexedDB.open(databaseName)}catch(error){const left=(unresolvedOpens.get(databaseName)??1)-1;if(left)unresolvedOpens.set(databaseName,left);else unresolvedOpens.delete(databaseName);reject(error);return}
    let settled = false, absent=false
    let delivered=false
    const deliveredOpen=()=>{if(delivered)return;delivered=true;const left=(unresolvedOpens.get(databaseName)??1)-1;if(left)unresolvedOpens.set(databaseName,left);else unresolvedOpens.delete(databaseName)}
    const fail = (reason: Error) => { if (settled) return; settled = true; reject(reason) }
    const abort = () => { try { request.transaction?.abort() } catch { /* no upgrade transaction */ }; fail(new NativePresenceError('unavailable', 'Native source open canceled')) }
    signal.addEventListener('abort', abort, { once: true })
    request.onupgradeneeded = event => { absent=event.oldVersion===0;request.transaction?.abort() }
    request.onblocked = () => fail(new NativePresenceError('unavailable', 'Native source open is blocked'))
    request.onerror = () => {deliveredOpen();signal.removeEventListener('abort',abort);fail(new NativePresenceError(absent?'missing_database':'unavailable', absent?'Native source database is absent':'Native source could not be opened'))}
    request.onsuccess = () => {
      deliveredOpen()
      signal.removeEventListener('abort', abort)
      if (settled || signal.aborted) { request.result.close(); return }
      settled = true; resolve(request.result)
    }
  })
}
export function readExistingNativeKey(database: IDBDatabase, storeName: string, key: IDBValidKey, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    if (!database.objectStoreNames.contains(storeName)) { reject(new NativePresenceError('unsupported', 'Native source store missing')); return }
    const tx = database.transaction(storeName, 'readonly'), store = tx.objectStore(storeName)
    const cursor = store.openCursor(IDBKeyRange.only(key))
    let present = false, observed = false, value: unknown, settled = false
    const fail = (reason: Error) => { if (settled) return; settled = true; reject(reason) }
    const abort = () => { try { tx.abort() } catch { /* already finished */ }; fail(new NativePresenceError('unavailable', 'Native source read canceled')) }
    signal.addEventListener('abort', abort, { once: true })
    cursor.onsuccess = () => { if (settled || signal.aborted) return; observed = true; if (cursor.result) { present = true; value = cursor.result.value } }
    tx.oncomplete = () => { signal.removeEventListener('abort', abort); if (settled) return; settled = true; if (!observed) reject(new NativePresenceError('unavailable', 'Native source read delivery was not confirmed')); else if (present) resolve(value); else reject(new NativePresenceError('missing_key', 'Native source root key is absent')) }
    tx.onerror = () => fail(new NativePresenceError('unavailable', 'Native source read failed'))
    tx.onabort = () => fail(new NativePresenceError('unavailable', 'Native source read was interrupted'))
  })
}

/** Existence only, for sources whose private root must enter a registered native ingress. */
export function requireExistingNativeKey(database: IDBDatabase, storeName: string, key: IDBValidKey, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    if (!database.objectStoreNames.contains(storeName)) { reject(new NativePresenceError('unsupported', 'Native source store missing')); return }
    const tx = database.transaction(storeName, 'readonly'), request = tx.objectStore(storeName).getKey(key)
    let present = false, observed = false, settled = false
    const fail = (reason: Error) => { if (!settled) { settled = true; reject(reason) } }
    const abort = () => { try { tx.abort() } catch { /* settled */ }; fail(new NativePresenceError('unavailable', 'Native source key check canceled')) }
    signal.addEventListener('abort', abort, { once: true })
    request.onsuccess = () => { if (!settled && !signal.aborted) { observed = true; present = request.result !== undefined } }
    tx.oncomplete = () => { signal.removeEventListener('abort', abort); if (settled) return; settled = true; if (!observed) reject(new NativePresenceError('unavailable', 'Native source key delivery was not confirmed')); else if (present) resolve(); else reject(new NativePresenceError('missing_key', 'Native source root key is absent')) }
    tx.onerror = tx.onabort = () => fail(new NativePresenceError('unavailable', 'Native source key check failed'))
  })
}

/** The source supplies its own supported root versions; malformed fields still go to native validation. */
export function requireObservedNativeVersion(value:unknown,field:string,supported:readonly string[]):void{
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const version=(value as Record<string,unknown>)[field]
  if(typeof version==='string'&&!supported.includes(version))throw new NativePresenceError('unsupported','Native source version requires a supported native migration or reader')
 }
}
/** Only a positively observed native validation failure receives corrupt status. */
export function validateObservedNative<T>(validate:()=>T):T {
  try{return validate()}catch(error){if(error instanceof NativePresenceError)throw error;throw new NativePresenceError('corrupt','Native source validation failed')}
}
/** Deliberate new preparation: existing sources use only their retained reader.
 * Initialization is atomic with a genuinely new IDB upgrade, never a falsey-root fallback. */
export async function openNativeForMock<T>(databaseName:string,version:number,initialize:(db:IDBDatabase)=>void,
  retained:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,allowCreate=true):Promise<T>{
 const controller=new AbortController(),abort=()=>controller.abort()
 if(parent?.aborted)controller.abort();parent?.addEventListener('abort',abort,{once:true})
 const timer=setTimeout(abort,2000)
 const canceled=new Promise<never>((_,reject)=>{if(controller.signal.aborted)reject(new NativePresenceError('unavailable','Native source opening retired'));else controller.signal.addEventListener('abort',()=>reject(new NativePresenceError('unavailable','Native source opening retired')),{once:true})})
 try{return await Promise.race([(async()=>{
  try{const opened=await retained(controller.signal);if(controller.signal.aborted){(opened as {close?:()=>void}).close?.();controller.signal.throwIfAborted()}return opened}catch(error){if(!allowCreate||!(error instanceof NativePresenceError)||error.kind!=='missing_database')throw error}
  controller.signal.throwIfAborted()
  await new Promise<void>((resolve,reject)=>{
   const pending=unresolvedOpens.get(databaseName)??0
   if(pending>=2){reject(new NativePresenceError('unavailable','Native source open remains unresolved. Reload to check again.'));return}
   unresolvedOpens.set(databaseName,pending+1)
   let request:IDBOpenDBRequest
   try{request=indexedDB.open(databaseName,version)}catch(error){const count=(unresolvedOpens.get(databaseName)??1)-1;if(count)unresolvedOpens.set(databaseName,count);else unresolvedOpens.delete(databaseName);reject(error);return}
   let ended=false,created=false
   const delivered=()=>{const count=(unresolvedOpens.get(databaseName)??1)-1;if(count)unresolvedOpens.set(databaseName,count);else unresolvedOpens.delete(databaseName)}
   const fail=(error:unknown)=>{if(ended)return;ended=true;reject(error)}
   const cancel=()=>{try{request.transaction?.abort()}catch{/* already committed */}fail(new NativePresenceError('unavailable','New native source opening retired'))}
   controller.signal.addEventListener('abort',cancel,{once:true})
   request.onupgradeneeded=event=>{if(ended||controller.signal.aborted||event.oldVersion!==0){request.transaction?.abort();return}created=true;try{initialize(request.result)}catch(error){request.transaction?.abort();fail(error)}}
   request.onblocked=()=>fail(new NativePresenceError('unavailable','New native source opening blocked'))
   request.onerror=()=>{delivered();controller.signal.removeEventListener('abort',cancel);fail(new NativePresenceError('unavailable','New native source could not be confirmed'))}
   request.onsuccess=()=>{delivered();controller.signal.removeEventListener('abort',cancel);request.result.close();if(ended||controller.signal.aborted)return;ended=true;if(created)resolve();else reject(new NativePresenceError('unavailable','Source appeared during initialization; check again'))}
  })
  controller.signal.throwIfAborted()
  const opened=await retained(controller.signal)
  if(controller.signal.aborted){(opened as {close?:()=>void}).close?.();controller.signal.throwIfAborted()}
  return opened
 })(),canceled])}finally{clearTimeout(timer);parent?.removeEventListener('abort',abort)}
}
