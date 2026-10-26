import {it,expect,vi} from 'vitest'
import {Store} from './storage'
it('caps never-delivered native opens at two per document',async()=>{
 vi.useFakeTimers();const open=vi.fn(()=>({}));vi.stubGlobal('indexedDB',{open});
 try{for(let i=0;i<2;i++){const pending=Store.open();const failure=expect(pending).rejects.toThrow('Database opening was not confirmed');await vi.advanceTimersByTimeAsync(2001);await failure}
 await expect(Store.open()).rejects.toThrow('opening remains unresolved');expect(open).toHaveBeenCalledTimes(2)}finally{vi.unstubAllGlobals();vi.useRealTimers()}
});
