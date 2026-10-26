import{act,cleanup,fireEvent,render,screen,waitFor}from'@testing-library/react'
import{afterEach,beforeEach,expect,it,vi}from'vitest'
import{ArrowsJourney}from'./Journey'
import{ArrowsStore}from'./storage'
import{RegisterBackend,testProfile}from'./register-test-support'
import type{ArmedAttempt}from'./storage'
import{ArrowsBrowserRun}from'./browser'
import type{ExclusiveArrowsDocument}from'./exclusive-document'
import{readInputReceipt}from'../core/inputCheckReceipt'
vi.mock('../core/inputCheckReceipt',()=>({readInputReceipt:vi.fn(async()=>null),storeNativeKeyProof:vi.fn(async()=>null)}))
const locks=Object.getOwnPropertyDescriptor(navigator,'locks')
beforeEach(()=>{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(_n:string,_o:unknown,work:(v:object)=>unknown)=>Promise.resolve(work({}))}});vi.spyOn(document,'hasFocus').mockReturnValue(true);vi.mocked(readInputReceipt).mockResolvedValue(null)})
afterEach(()=>{cleanup();vi.restoreAllMocks();if(locks)Object.defineProperty(navigator,'locks',locks);else Reflect.deleteProperty(navigator,'locks')})
async function mount(attempts?:readonly ArmedAttempt[]){const backend=new RegisterBackend(),store=new ArrowsStore(backend,backend.root.installationId);vi.spyOn(ArrowsStore,'open').mockResolvedValue(store);if(attempts)vi.spyOn(store,'listAttempts').mockResolvedValue(attempts);const menu=vi.fn();const exclusive={presentationHost:document.createElement('div'),enter:vi.fn(),leave:vi.fn()}as unknown as ExclusiveArrowsDocument;render(<ArrowsJourney onLibrary={menu} exclusive={exclusive}/>);await screen.findByRole('heading',{name:/^Arrows$/});await act(async()=>{});return{store,menu,backend}}
function toSetup(){fireEvent.click(screen.getByRole('button',{name:/^Continue$/}));fireEvent.click(screen.getByLabelText('Follow the four side arrows and use my first eligible response before the deadline'));fireEvent.click(screen.getByRole('button',{name:'Check answers'}))}
function pair(code:string,extra={}){const group=screen.getByRole('group',{name:'Arrows physical key capture'});fireEvent.keyDown(group,{code,...extra});fireEvent.keyUp(group,{code,...extra})}
const start=()=>screen.getByRole('button',{name:/^Start(?: practice)?$/})
it.each([['ArrowLeft','ArrowRight'],['ArrowRight','ArrowLeft']])('checks both directions in either order: %s then %s',async(first,second)=>{await mount();toSetup();expect(screen.getByRole('group',{name:'Arrows physical key capture'})).toHaveFocus();pair(first);expect(start()).toBeDisabled();pair(second);await waitFor(()=>expect(start()).toBeEnabled());expect(screen.getByText('Left: checked · Right: checked')).toBeInTheDocument()})
it('one direction repeated cannot satisfy both',async()=>{await mount();toSetup();pair('ArrowLeft');pair('ArrowLeft');expect(start()).toBeDisabled();expect(screen.getByText('Left: checked · Right: waiting')).toBeInTheDocument()})
it.each([{repeat:true},{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true}])('rejects a repeated or modified pair %j',async extra=>{await mount();toSetup();pair('ArrowLeft',extra);pair('ArrowRight');expect(start()).toBeDisabled()})
it('rejects overlapping chords then accepts separate full pairs',async()=>{await mount();toSetup();const c=screen.getByRole('group',{name:'Arrows physical key capture'});fireEvent.keyDown(c,{code:'ArrowLeft'});fireEvent.keyDown(c,{code:'ArrowRight'});fireEvent.keyUp(c,{code:'ArrowLeft'});fireEvent.keyUp(c,{code:'ArrowRight'});expect(start()).toBeDisabled();pair('ArrowLeft');pair('ArrowRight');await waitFor(()=>expect(start()).toBeEnabled())})
it('Escape cancels and one retry checks both afresh',async()=>{await mount();toSetup();pair('ArrowLeft');fireEvent.keyDown(screen.getByRole('group',{name:'Arrows physical key capture'}),{code:'Escape'});expect(start()).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Check again'}));expect(screen.getByText('Left: waiting · Right: waiting')).toBeInTheDocument();pair('ArrowRight');expect(start()).toBeDisabled();pair('ArrowLeft');await waitFor(()=>expect(start()).toBeEnabled())})
it('tests the actual remapped codes instead of old arrows',async()=>{await mount();toSetup();fireEvent.click(screen.getByRole('button',{name:'Use other keys'}));fireEvent.click(screen.getByRole('button',{name:'Change Left button'}));pair('KeyA');expect(screen.getByRole('heading',{name:'Press A key then Right arrow key.'})).toBeInTheDocument();pair('ArrowLeft');pair('ArrowRight');expect(start()).toBeDisabled();pair('KeyA');await waitFor(()=>expect(start()).toBeEnabled())})
it('Back from setup returns to the rule screen without leaving for the menu',async()=>{const x=await mount();toSetup();pair('ArrowLeft');fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:'Check the rule'})).toBeInTheDocument();expect(x.menu).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:/^Arrows$/})).toBeInTheDocument()})
it('Back follows every example and the actual example-to-quiz origin',async()=>{const x=await mount();fireEvent.click(screen.getByText('Examples and saved results'));fireEvent.click(screen.getByRole('button',{name:'See an example'}));fireEvent.click(screen.getByRole('button',{name:'Next example'}));fireEvent.click(screen.getByRole('button',{name:'Next example'}));fireEvent.click(screen.getByRole('button',{name:'Check understanding'}));fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:'Worked example 3 of 3'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:'Worked example 2 of 3'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:'Worked example 1 of 3'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:/^Arrows$/})).toBeInTheDocument();expect(x.menu).not.toHaveBeenCalled()})
it('a late cached receipt cannot overwrite a fresh restarted check',async()=>{await mount();toSetup();let deliver!:(v:never)=>void;vi.mocked(readInputReceipt).mockImplementationOnce(()=>new Promise(resolve=>{deliver=resolve}));pair('ArrowLeft');pair('ArrowRight');await waitFor(()=>expect(deliver).toBeDefined());fireEvent.click(screen.getByRole('button',{name:'Check again'}));await act(async()=>deliver({}as never));expect(start()).toBeDisabled();expect(screen.getByText('Left: waiting · Right: waiting')).toBeInTheDocument()})
it.each([false,true])('does not expose Back after a failed Start, known arm=%s',async armed=>{if(armed)vi.spyOn(ArrowsBrowserRun.prototype,'armedAttempt').mockReturnValue({}as ArmedAttempt);vi.spyOn(ArrowsBrowserRun.prototype,'begin').mockRejectedValue(Error('injected unconfirmed start'));await mount();toSetup();pair('ArrowLeft');pair('ArrowRight');await waitFor(()=>expect(start()).toBeEnabled());fireEvent.click(start());await screen.findByRole('heading',{name:'Ready for Block 1?'});expect(screen.queryByRole('button',{name:/^Back$/})).not.toBeInTheDocument();expect(screen.getByText(/Start could not be confirmed/)).toBeInTheDocument()})

it('Back from a verified instruction skip returns to its actual guide origin',async()=>{
 const completed={sessionId:'controlled-prior',profile:testProfile,state:{specificationVersion:'arrows_spec_v1_1'},snapshot:{kind:'terminal',review:{status:'complete_headless'}}}as unknown as ArmedAttempt;
 await mount([completed]);fireEvent.click(screen.getByText('Examples and saved results'));fireEvent.click(await screen.findByRole('button',{name:'Skip instructions'}));await screen.findByRole('heading',{name:'Press ← then → on your keyboard.'});fireEvent.click(screen.getByRole('button',{name:/^Back$/}));expect(screen.getByRole('heading',{name:/^Arrows$/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/^Back$/})).not.toBeInTheDocument()
})
it('Back clears a pending key-down so an orphaned release cannot pass after returning',async()=>{
 await mount();toSetup();fireEvent.keyDown(screen.getByRole('group',{name:'Arrows physical key capture'}),{code:'ArrowLeft'});fireEvent.click(screen.getByRole('button',{name:/^Back$/}));fireEvent.click(screen.getByRole('button',{name:'Check answers'}));const c=screen.getByRole('group',{name:'Arrows physical key capture'});fireEvent.keyUp(c,{code:'ArrowLeft'});pair('ArrowRight');expect(start()).toBeDisabled();pair('ArrowLeft');await waitFor(()=>expect(start()).toBeEnabled())
})

it('arriving at setup accepts both arrows on document.body without a click', async () => {
 await mount(); toSetup()
 expect(screen.getByRole('heading', {name:'Press ← then → on your keyboard.'})).toBeInTheDocument()
 for (const code of ['ArrowLeft','ArrowRight']) {
  fireEvent.keyDown(document.body,{code});fireEvent.keyUp(document.body,{code})
  if(code==='ArrowLeft')expect(screen.getByRole('heading',{name:'Good. Now press →.'})).toBeInTheDocument()
 }
 expect(screen.getByRole('heading',{name:'Both keys work.'})).toBeInTheDocument()
 expect(screen.getAllByText('✓ CHECKED')).toHaveLength(2)
 expect(screen.getByRole('button',{name:'Start practice'})).toBeEnabled()
})
it('arrows focused on the mode radio check the keys without changing mode', async () => {
 await mount();toSetup();fireEvent.click(screen.getByRole('button',{name:'Use mouse or touch'}))
 const keyboard=screen.getByRole('radio',{name:'Keyboard'})
 for(const code of ['ArrowLeft','ArrowRight']){
  act(()=>keyboard.focus())
  expect(fireEvent.keyDown(keyboard,{code})).toBe(false)
  fireEvent.keyUp(keyboard,{code})
 }
 expect(keyboard).toBeChecked()
 expect(screen.getByRole('radio',{name:'Mouse, touch or pen buttons'})).not.toBeChecked()
 expect(screen.getAllByText('✓ CHECKED')).toHaveLength(2)
 expect(screen.getByRole('button',{name:'Start practice'})).toBeEnabled()
})
it('Check again refocuses capture even while the same check is active', async () => {
 await mount();toSetup();const retry=screen.getByRole('button',{name:'Check again'})
 act(()=>retry.focus());fireEvent.click(retry)
 await waitFor(()=>expect(screen.getByRole('group',{name:'Arrows physical key capture'})).toHaveFocus())
 pair('ArrowLeft');pair('ArrowRight');expect(start()).toBeEnabled()
})
