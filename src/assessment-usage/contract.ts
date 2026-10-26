/** Public event schema. Never pass a journal, native identifier or report object here. */
export const RULES = {
  stop: { family: 'stop_1_3', fields: { correct: [0,80], trials: [80,80], false_alarms: [0,80] } },
  balloons: { family: 'balloons_1', fields: { rounds: [39,39], banked_cents: [0,1_000_000], bursts: [0,39], collections: [0,39], pumps: [0,10_000] } },
  keypresses: { family: 'keypresses_1_0_2', fields: { accepted: [0,40], target: [40,40], target_reached: [0,1] } },
  arrows: { family: 'arrows_1_1', fields: { correct: [0,135], trials: [135,135] } },
  lengths: { family: 'lengths_mouth_1_3', fields: { correct: [0,90], trials: [90,90] } },
  digits: { family: 'digits_1_1', fields: { correct: [0,1_000], trials: [1,1_000], maximum_length: [0,100] } },
  cards: { family: 'cards_1_1', fields: { draws: [80,80], ending_dollars: [-1_000_000,1_000_000], gains_dollars: [0,1_000_000], losses_dollars: [0,1_000_000] } },
  easy_hard: { family: 'easy_hard_1', fields: { attempts: [0,1_000], completed: [0,1_000], hard_choices: [0,1_000], easy_choices: [0,1_000], earned_cents: [0,1_000_000] } },
  towers: { family: 'towers_1', fields: { solved: [1,1], moves: [0,1_000], optimal_moves: [0,1_000] } },
  money_1: { family: 'money_1_1', fields: { exchanges: [1,1] } },
  money_2: { family: 'money_2_1', fields: { exchanges: [2,2] } },
  faces: { family: 'faces_3', fields: { correct: [0,14], trials: [14,14] } },
} as const
export type Task = keyof typeof RULES
export type Outcome = 'completed' | 'invalid' | 'incomplete'
export type Context = 'practice' | 'mock'
export type Metrics<T extends Task> = { [K in keyof typeof RULES[T]['fields']]: number }
export type Summary = Record<string, string | number>
export function project<T extends Task>(task:T, context:Context, outcome:Outcome, metrics?:Metrics<T>): Summary | null {
  if (!Object.hasOwn(RULES,task) || !['practice','mock'].includes(context) || !['completed','invalid','incomplete'].includes(outcome)) return null
  const rule=RULES[task]
  const data:Summary={schema:1,task,family:rule.family,context,outcome}
  if(outcome!=='completed')return metrics===undefined?data:null
  if(!metrics || Object.keys(metrics).length!==Object.keys(rule.fields).length)return null
  for(const [key,bounds] of Object.entries(rule.fields)){
    const value=(metrics as Record<string,number>)[key]
    if(!Number.isSafeInteger(value)||value<bounds[0]||value>bounds[1])return null
    data[key]=value
  }
  // Denominators and subset counts must agree, not just pass independent ranges.
  if(typeof data.correct==='number'&&typeof data.trials==='number'&&data.correct>data.trials)return null
  if(task==='easy_hard' && (Number(data.completed)>Number(data.attempts)||Number(data.hard_choices)+Number(data.easy_choices)>Number(data.attempts)))return null
  if(task==='balloons' && Number(data.bursts)+Number(data.collections)!==39)return null
  return data
}
