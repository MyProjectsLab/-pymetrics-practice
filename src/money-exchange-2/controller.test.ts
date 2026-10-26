import {it,expect,beforeEach,afterEach} from 'vitest'
import {Controller} from './controller'
import {initialRoot,transition,validateRoot} from './core'
import type {Root,Command} from './core'
import {Store} from './storage'
import type {Backend} from './storage'
let serial=0
class Memory implements Backend {
 root=initialRoot();holdKind:string|null=null;holdDeliveryKind:string|null=null;deliveries:(()=>void)[]=[];held:(()=>void)[]=[];lostKind:string|null=null;failReads=0;readCount=0;writeCount=0;
 read(signal:AbortSignal){this.readCount++;if(this.failReads){this.failReads--;return Promise.reject(Error('failed read'))}if(signal.aborted)return Promise.reject(Error('aborted'));return Promise.resolve(structuredClone(this.root))}
 change(fn:(r:Root)=>Root,signal:AbortSignal){this.writeCount++;return new Promise<void>((resolve,reject)=>{
  const run=()=>{if(signal.aborted){reject(Error('aborted'));return}try{const next=fn(structuredClone(this.root));const cmd=Object.values(next.outcomes).at(-1)?.command;if(cmd?.kind===this.holdKind){this.held.push(()=>{this.holdKind=null;run()});return}this.root=next;if(cmd?.kind===this.holdDeliveryKind){this.deliveries.push(resolve);return}if(cmd?.kind===this.lostKind){reject(Error('committed but delivery lost'));return}resolve()}catch(e){reject(e)}};run()
 })}
 close(){}
 command(kind:string,extra:Partial<Command>={}){const cmd:Command={kind,requestId:`outside${++serial}`,installationId:this.root.installationId,generation:this.root.generation,ownerId:this.root.lease.ownerId!,leaseEpoch:this.root.lease.epoch,at:performance.now(),...extra};const result=transition(this.root,cmd);expect(result.outcome.accepted).toBe(true);this.root=result.root;validateRoot(this.root)}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))
async function settle(c:Controller){for(let i=0;i<30&&c.view().busy&&!c.view().uncertain;i++)await tick()}
async function setup(){const b=new Memory();const c=new Controller({openStore:()=>Store.open(b),takeOwner:async()=>()=>undefined});await c.open();expect(c.view().stage).toBe('library');return {c,b}}
async function act(c:Controller,kind:string,data={}){expect(c.admit(c.inputToken(),kind,data)).toBe(true);await settle(c)}
async function ready(c:Controller){await act(c,'enter');await act(c,'ready')}
beforeEach(()=>{Object.defineProperty(navigator,'locks',{value:{request:(_n:string,_o:unknown,fn:()=>unknown)=>Promise.resolve().then(fn)},configurable:true});Object.defineProperty(globalThis,'matchMedia',{value:()=>({matches:false}),configurable:true})})
afterEach(()=>{})
for(const first of ['arm','exit'])for(const dest of ['Close','Restart'])it(`controller admitted ${dest}, ${first} commits first`,async()=>{const {c,b}=await setup();await ready(c);const oldToken=c.inputToken();if(first==='exit')b.holdKind='arm';else b.holdDeliveryKind='arm';expect(c.admit(oldToken,'arm')).toBe(true);if(first==='arm')await tick();expect(c.admit(oldToken,dest)).toBe(true);await settle(c);for(const deliver of [...b.held.splice(0),...b.deliveries.splice(0)])deliver();await tick();expect(c.view().stage).toBe(dest==='Close'?'library':'ready');expect(b.root.formCounter).toBe(first==='arm'?1:0);if(first==='arm')expect(b.root.attempts['A1.1'].status).toBe('Incomplete');expect(c.admit(oldToken,'arm')).toBe(false)})
it('old Ready token cannot exit successor',async()=>{const {c,b}=await setup();await ready(c);const old=c.inputToken();await act(c,'arm');expect(c.admit(old,'Close')).toBe(false);await act(c,'Restart');await act(c,'arm');expect(c.admit(old,'Close')).toBe(false);expect(b.root.attempts['A1.2'].status).toBe('Armed')})
for(const first of ['restart','close'])it(`pending Restart then Close ${first} root first`,async()=>{const {c,b}=await setup();await ready(c);await act(c,'arm');if(first==='close')b.holdKind='exit';else b.lostKind='exit';const token=c.inputToken();c.admit(token,'Restart');if(first==='restart')await tick();const closeToken=c.inputToken();b.holdKind=null;c.admit(closeToken,'Close');await settle(c);for(const fn of b.held.splice(0))fn();await tick();expect(c.view().stage).toBe('library');expect(b.root.route.stage).toBe('library')})
it('two failed reads stop automatic recovery and deny new scored input',async()=>{const {c,b}=await setup();await ready(c);b.failReads=2;b.lostKind='arm';const reads=b.readCount;c.admit(c.inputToken(),'arm');await settle(c);expect(c.view().uncertain).toBe(true);expect(b.readCount-reads).toBe(2);expect(c.admit(c.inputToken(),'arm')).toBe(false);expect(b.root.formCounter).toBe(1);c.retry(c.inputToken());await settle(c);expect(c.view().stage).toBe('award_1');expect(b.root.formCounter).toBe(1)})
it('generation loss withdraws old pending presentation',async()=>{const {c,b}=await setup();await ready(c);b.holdKind='arm';c.admit(c.inputToken(),'arm');await tick();b.command('deleteAll');await c.refresh();for(const fn of b.held.splice(0))fn();await tick();expect(c.view().stage).toBe('unavailable');expect(b.root.formCounter).toBe(0)})
it('duplicate activation admits one request and one form',async()=>{const {c,b}=await setup();await ready(c);const token=c.inputToken();expect(c.admit(token,'arm')).toBe(true);expect(c.admit(token,'arm')).toBe(false);await settle(c);expect(b.root.formCounter).toBe(1)})
