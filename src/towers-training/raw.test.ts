import { describe, expect, it } from 'vitest'
import { ModelScope } from './authority'
import { compareRaw, exceedsRawBigIntLimit, inspectRaw } from './raw'

describe('bounded native corruption images',()=>{
  it('keeps the exact signed BigInt magnitude boundary without allocating it on module import',async()=>{
    const bits=8n*BigInt(Math.floor(4194304/4))
    const bound=1n<<bits
    for(const value of [0n,1n,-1n,bound-1n,-bound+1n])
      expect(exceedsRawBigIntLimit(value)).toBe(false)
    for(const value of [bound,bound+1n,-bound,-bound-1n])
      expect(exceedsRawBigIntLimit(value)).toBe(true)
    const scope=new ModelScope()
    const scalar=await inspectRaw(-123n,scope)
    expect(compareRaw(scalar,-123n,scope).equal).toBe(true)
    expect(compareRaw(scalar,-124n,scope).equal).toBe(false)
    const boxed=await inspectRaw(Object(123n),scope)
    expect(compareRaw(boxed,Object(123n),scope).equal).toBe(true)
    await expect(inspectRaw(bound,scope)).rejects.toThrow('Raw BigInt byte capacity')
    await expect(inspectRaw(Object(-bound),scope)).rejects.toThrow('Raw BigInt slot capacity')
  })
  it('preserves ordered Map content, cycles and shared graph topology',async()=>{
    const scope=new ModelScope()
    const shared={bad:true},old:Record<string,unknown>={}
    old.left=shared;old.right=shared
    old.map=new Map<unknown,unknown>([['first',shared],['second',old]])
    const image=await inspectRaw(old,scope)
    const same:Record<string,unknown>={}
    const sameShared={bad:true}
    same.left=sameShared;same.right=sameShared
    same.map=new Map<unknown,unknown>([['first',sameShared],['second',same]])
    expect(compareRaw(image,same,scope).equal).toBe(true)
    const split={...same,right:{bad:true}}
    expect(compareRaw(image,split,scope).equal).toBe(false)
    const reordered={...same,map:new Map<unknown,unknown>([['second',same],['first',sameShared]])}
    expect(compareRaw(image,reordered,scope).equal).toBe(false)
  })
  it('distinguishes native scalar slots and full buffer backing',async()=>{
    const scope=new ModelScope()
    const invalidDate=await inspectRaw(new Date(NaN),scope)
    expect(compareRaw(invalidDate,new Date(NaN),scope).equal).toBe(true)
    expect(compareRaw(invalidDate,new Date(0),scope).equal).toBe(false)
    const boxed=await inspectRaw(new Number(-0),scope)
    expect(compareRaw(boxed,new Number(-0),scope).equal).toBe(true)
    expect(compareRaw(boxed,new Number(0),scope).equal).toBe(false)
    const buffer=new ArrayBuffer(8);new Uint8Array(buffer)[7]=91
    const view=await inspectRaw(new Uint8Array(buffer,0,2),scope)
    const changed=new ArrayBuffer(8);new Uint8Array(changed)[7]=90
    expect(compareRaw(view,new Uint8Array(changed,0,2),scope).equal).toBe(false)
  })
  it('compares retained nonenumerable Error cause and stack',async()=>{
    // Vitest installs a custom stack formatter. Native lazy stack access must
    // refuse it; exercise the intrinsic host path with the formatter absent.
    const formatter=Object.getOwnPropertyDescriptor(Error,'prepareStackTrace')
    Object.defineProperty(Error,'prepareStackTrace',{configurable:true,writable:true,value:undefined})
    try{
    const scope=new ModelScope()
    const old=new Error('damaged',{cause:{code:1}})
    const same=structuredClone(old)
    const image=await inspectRaw(same,scope)
    expect(compareRaw(image,structuredClone(same),scope).equal).toBe(true)
    const changed=structuredClone(same) as Error & {cause:{code:number}}
    changed.cause.code=2
    expect(compareRaw(image,changed,scope).equal).toBe(false)
    }finally{
      if(formatter)Object.defineProperty(Error,'prepareStackTrace',formatter)
      else Reflect.deleteProperty(Error,'prepareStackTrace')
    }
  })
})
