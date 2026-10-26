import { ArrowRight } from 'lucide-react'
import { Wordmark } from '../design/Wordmark'
import { MarketingUsage } from '../discovery/MarketingUsage'
import '../design/tokens.css'
import './landing.css'

const tests = [
  {
    "name": "Stop",
    "description": "Respond to the target. Wait for other shapes.",
    "href": "/practice/stop"
  },
  {
    "name": "Balloons",
    "description": "Make a choice. See how it plays out.",
    "href": "/practice/balloons"
  },
  {
    "name": "Keypresses",
    "description": "Wait for the signal. Find your rhythm.",
    "href": "/practice/keypresses"
  },
  {
    "name": "Arrows",
    "description": "Check the colour. Follow the arrow rule.",
    "href": "/arrows.html"
  },
  {
    "name": "Lengths",
    "description": "Look closely. Spot the difference.",
    "href": "/mouth-v13.html"
  },
  {
    "name": "Digits",
    "description": "Watch a sequence. Recall it in order.",
    "href": "/practice/digits"
  },
  {
    "name": "Cards",
    "description": "Choose a deck. See each gain or loss.",
    "href": "/practice/cards"
  },
  {
    "name": "Easy or Hard",
    "description": "Choose an effort level for a possible reward.",
    "href": "/practice/easy-or-hard"
  },
  {
    "name": "Towers",
    "description": "Move the disks. Match the target.",
    "href": "/practice/towers"
  },
  {
    "name": "Money Exchange 1",
    "description": "Choose a transfer. Review the return.",
    "href": "/money.html"
  },
  {
    "name": "Money Exchange 2",
    "description": "Make or watch money choices. Rate fairness.",
    "href": "/money2.html"
  },
  {
    "name": "Faces",
    "description": "Consider a portrait and its context.",
    "href": "/faces.html"
  }
] as const

export default function Landing() {
 return (<div className="ap-theme tg-landing" id="top"><a className="skip" href="#landing-main">Skip to content</a><div className="wrap"><header className="header"><Wordmark /><nav aria-label="Main navigation"><a href="#games">Practice tests</a><a href="/pymetrics-practice.html#assessment-explained">How it works</a><a href="/pymetrics-practice.html#research">Research</a><a className="nav-start" href="/practice">Start practising <span aria-hidden="true">↗</span></a></nav></header></div><main id="landing-main" tabIndex={-1}><div className="wrap"><section className="hero" aria-labelledby="hero-heading"><div><p className="eyebrow">Free hiring-assessment practice</p><h1 id="hero-heading">Prepare for your<br />{' '}<em>hiring assessment.</em></h1><p className="intro">Free Pymetrics-style practice tests. Learn the rules, try the tasks and review your results.</p><div className="actions"><a className="button" href="/practice">Start free practice <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5"></path></svg></a><a className="secondary" href="#games">See all 12 tests</a></div><p className="small">Free. No sign-up.</p></div><figure className="hero-photo"><img src="/brand/study-library.jpg" width="1200" height="1800" fetchPriority="high" alt="A woman studying beside her laptop in a book-lined room." /></figure></section><div className="facts" aria-label="Practice at a glance"><div className="fact"><strong>12</strong><span>practice tests</span></div><div className="fact"><strong>Free</strong><span>to use</span></div><div className="fact"><strong>No</strong><span>account needed</span></div></div><section className="section about" aria-labelledby="about-heading"><div><p className="eyebrow">Before you begin</p><h2 id="about-heading">What is a Pymetrics assessment?</h2></div><div className="about-copy"><p>Pymetrics uses short tasks to explore how you pay attention and make decisions. Practise similar tasks here before your hiring assessment.</p><div className="text-links"><a href="https://harver.com/gamified-assessments/">Learn more from Harver ↗</a><a href="/pymetrics-practice.html#research">Research behind the tasks →</a></div></div></section><section className="section library" id="games" aria-labelledby="tests-heading"><div className="section-top"><div><p className="eyebrow">Twelve practice tests</p><h2 id="tests-heading">Choose where to start.</h2></div><p>Read the rules.<br />{' '}Try the task. Review your results.</p></div><div className="test-grid">{tests.map(({ name, description, href }, index) => <a className="test ap-game-row" href={href} key={name}><span className="test-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{name}</h3><p>{description}</p></div><ArrowRight aria-hidden="true" /></a>)}</div><div className="library-tail"><span>Ready for the full practice assessment? Try all 12 tasks, with progress saved between them.</span><a href="/mock">Try the full practice assessment →</a></div><p className="training">Separate Advanced Training is available for Stop, Balloons and Towers.</p></section><section className="prepare" aria-labelledby="prepare-heading"><div className="prepare-photo"><img src="/brand/student-preparing-illustrative.webp" width="1536" height="1024" loading="lazy" alt="Illustration of a student preparing on a laptop in a quiet study room." /></div><div className="prepare-copy"><p className="eyebrow">Your next application</p><h2 id="prepare-heading">Start before<br />{' '}the invitation.</h2><p>Applying for a new job or internship? Some employers use Pymetrics assessments. Get familiar with the tasks before test day.</p><a className="button" href="/practice">Start preparing <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5"></path></svg></a></div></section></div><section className="flow-band"><div className="wrap flow"><div><p className="eyebrow">A simple way to prepare</p><h2>One less unknown.</h2></div><div className="steps"><div><span className="step-number">01</span><h3>Learn the task</h3><p>Read the guide.<br />{' '}Try its example.</p></div><div><span className="step-number">02</span><h3>Give it a go</h3><p>Practise at your own starting point.</p></div><div><span className="step-number">03</span><h3>See how you did</h3><p>Review your actions, timing or choices.</p></div></div></div></section><div className="wrap"><section className="help"><div><p className="eyebrow">Understand your assessment</p><h2>Know what to expect.</h2><p>Learn what each task involves and how to prepare. Follow the instructions in your invitation.</p><div className="text-links"><a href="/pymetrics-practice.html#game-skills">The 12 tasks</a><a href="/pymetrics-practice.html#employers">Employer examples</a><a href="/pymetrics-practice.html#research">Research</a><a href="/blackstone-pymetrics.html">Blackstone assessment guide</a></div></div><a href="/pymetrics-practice.html">Read the preparation guide →</a></section></div></main><div className="wrap"><footer className="footer"><div className="footer-top"><Wordmark /><div className="footer-copy"><p>TraitGame is independent of Pymetrics, Harver, JobTestPrep and employers. These are original preparation exercises, not the provider’s assessment or scoring. Results describe your practice here, not your hiring prospects. Always follow your assessment invitation.</p><p>Practice history is stored in this browser when storage is available. There is no account or device sync. Clearing site data removes saved history; temporary runs disappear on close or reload. Deletion controls are in each task’s local history.</p><p>Use a laptop or desktop for timed practice. Each test explains its controls and accessibility requirements before you begin.</p><MarketingUsage /></div></div><div className="footer-links"><span>© 2026 TraitGame</span><a href="/privacy.html">Privacy</a><a href="/THIRD_PARTY_NOTICES.txt">Asset &amp; software credits</a><a href="#top">Back to top ↑</a></div><p className="photo-credits">Library photograph: <a href="https://unsplash.com/photos/woman-studying-with-laptop-and-books-in-library-4lK5xDRq-aE">Rodrigo Rodrigues / WOLF Λ R T / Unsplash</a>. Supporting study image is AI-generated and illustrative.</p></footer></div></div>)
}
