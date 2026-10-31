import { gameBrowser } from './game-browser.helper.mjs'
export const games = [
 ['Stop','/practice/stop','.stop-live'], ['Balloons','/practice/balloons','.balloons-play'],
 ['Keypresses','/practice/keypresses','.keypresses-live'],['Arrows','/arrows.html','fieldset[aria-label="Arrows visual task display"]'],
 ['Lengths','/mouth-v13.html','.mouth-host'],['Digits','/practice/digits','.digits-play'],
 ['Cards','/practice/cards','.cards-board'],['Easy or Hard','/practice/easy-or-hard','.easy-hard-board'],
 ['Towers','/practice/towers','.towers-play'],['Money 1','/money.html','.money-journey'],
 ['Money 2','/money2.html','[data-money-stage]'],['Faces','/faces.html','.question']]
export async function firstPlay(page, game, origin, beforeIntro) {
 const ui=await gameBrowser(page), click=async(name,selector='button',exact=true)=>{await ui.click(name,selector,exact);await page.waitForTimeout(120)}, radio=async name=>click(name,'input[type=radio]',false)
 await page.goto(origin+game[1]);await page.waitForTimeout(350)
 if(beforeIntro)await beforeIntro(page)
 try {
 if(game[0]==='Money 2') {await click('Next');await radio('You $8.00');await click('Check');await click('Start');await page.waitForTimeout(250);const [stage]=await ui.elements('[data-money-stage]');if(!stage||await ui.call(stage,function(){return this.getAttribute('data-money-stage')})!=='award_1')throw Error('Money 2 did not reach its first award');return ui}
 await click('Continue')
 switch(game[0]) {
 case 'Stop':await radio('Press Space once.');await click('Check');await radio('Do nothing.');await click('Check');await click('Test my keyboard');await page.keyboard.press('Space');await page.waitForTimeout(100);await click('Start');break
 case 'Balloons':await radio('Only this balloon');await click('Check answer');await click('Pump');await click('Collect');await click('Start');break
 case 'Keypresses':await radio('Only after GO');await click('Check answer');await click('Test button');await page.keyboard.press('Space');await page.waitForTimeout(150);await click('Start');break
 case 'Arrows':await radio('Follow the four side');await click('Check answers');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);await click('Start practice');break
 case 'Lengths':await radio('Short uses Left');await click('Check answers');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);await click('Start');break
 case 'Digits':await radio('Same digits, same order');await click('Check answer');await page.getByLabel('Try entering 4270 (untimed)').fill('4270');await click('Start');break
 case 'Cards':await radio('A draw can lose money;');await click('Check answers');await click('Start');break
 case 'Easy or Hard':await radio('Easy needs five presses');await click('Check answers');await click('Start');break
 case 'Towers':await radio('Only the top disk');await click('Check answer');await click('Start');break
 case 'Money 1':await radio('$6');await click('Check answer');await click('Start');break
 case 'Faces':await radio('Choose one label; after');await click('Check answers');await click('Start');break
 }
 await page.waitForTimeout(250)
 if(game[0]==='Lengths'&&!(await ui.elements('button','End this attempt',true)).length)throw Error('Lengths did not leave readiness')
 if(game[0]==='Money 1'&&!(await ui.elements('h1','You receive $10',true)).length)throw Error('Money 1 did not reach its first award')
 return ui
 }catch(e){e.snapshot=await ui.snapshot();await ui.close();throw e}
}
