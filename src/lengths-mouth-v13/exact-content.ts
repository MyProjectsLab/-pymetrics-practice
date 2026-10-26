/** Pure supported-data comparison. Equality alone never grants source authority. */
export type ContentMatch = 'equal' | 'different' | 'unsupported'
export function exactSupportedContent(a: unknown, b: unknown): ContentMatch {
  const pathA = new Set<object>(), pathB = new Set<object>()
  const compare = (left: unknown, right: unknown): ContentMatch => {
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
      if (typeof left !== typeof right) return 'different'
      if (!['undefined', 'string', 'number', 'boolean'].includes(typeof left) && left !== null && right !== null) return 'unsupported'
      return Object.is(left, right) ? 'equal' : 'different'
    }
    const array = Array.isArray(left)
    if (array !== Array.isArray(right)) return 'different'
    const leftPrototype = Object.getPrototypeOf(left), rightPrototype = Object.getPrototypeOf(right)
    if (array ? leftPrototype !== Array.prototype || rightPrototype !== Array.prototype :
      ![Object.prototype, null].includes(leftPrototype) || ![Object.prototype, null].includes(rightPrototype)) return 'unsupported'
    if (leftPrototype !== rightPrototype) return 'different'
    if (pathA.has(left) || pathB.has(right)) return 'unsupported'
    pathA.add(left); pathB.add(right)
    try {
      const leftKeys = Reflect.ownKeys(left), rightKeys = Reflect.ownKeys(right)
      if (leftKeys.some(key => typeof key !== 'string') || rightKeys.some(key => typeof key !== 'string')) return 'unsupported'
      if (leftKeys.length !== rightKeys.length) return 'different'
      for (let index = 0; index < leftKeys.length; index++) {
        const key = leftKeys[index]
        if (key !== rightKeys[index]) return 'different'
        const l = Object.getOwnPropertyDescriptor(left, key)!, r = Object.getOwnPropertyDescriptor(right, key)!
        if (!('value' in l) || !('value' in r)) return 'unsupported'
        if (l.enumerable !== r.enumerable) return 'different'
        const result = compare(l.value, r.value)
        if (result !== 'equal') return result
      }
      return 'equal'
    } finally { pathA.delete(left); pathB.delete(right) }
  }
  try { return compare(a, b) } catch { return 'unsupported' }
}
