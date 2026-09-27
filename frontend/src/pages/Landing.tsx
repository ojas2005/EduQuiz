import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, BookOpen, CornerDownRight, ShieldCheck } from 'lucide-react';
import { Brand, Button } from '../components/UI';
export function Landing({ onAuth, onTopic }: { onAuth: (mode: 'signup' | 'login') => void; onTopic: (topic: string) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [topic, setTopic] = useState('');
  return <div className="landing-page">
    <header className="public-header"><a href="#overview" aria-label="EduQuiz home"><Brand/></a><nav aria-label="Public navigation"><a href="#how-it-works">The method</a><Button variant="ghost" onClick={() => onAuth('login')}>Log in</Button><Button variant="dark" onClick={() => onAuth('signup')}>Start learning<ArrowUpRight size={16} aria-hidden="true"/></Button></nav></header>
    <main id="main-content">
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="tiny-rule"/> FOR THE EVER-CURIOUS</div><h1>Less scrolling.<br/>More <span className="serif-italic">understanding.</span></h1><p>That thing you’ve always wanted to learn?<br className="desktop-break"/> Turn it into a series of small, satisfying missions.<br className="desktop-break"/> Learn it. Try it. Make it yours.</p>
          <form className="topic-entry" onSubmit={event => { event.preventDefault(); onTopic(topic.trim()); }}><label className="sr-only" htmlFor="landing-topic">What do you want to learn?</label><input id="landing-topic" value={topic} onChange={event => setTopic(event.target.value)} placeholder="What do you want to learn?" minLength={2} maxLength={300} required/><button type="submit" aria-label="Start a learning path"><ArrowRight size={22}/></button></form>
          <div className="topic-suggestions"><span>A few ideas</span>{['Sentences', 'Python basics', 'Photography'].map(value => <button key={value} onClick={() => setTopic(value)}>{value}<ArrowUpRight size={12} aria-hidden="true"/></button>)}</div>
          <div className="hero-footnote"><ShieldCheck size={16} aria-hidden="true"/><span>Your pace. Your choice of AI. No one-size-fits-all course.</span></div>
        </div>
        <div className="hero-study"><div className="study-label"><span>THE LEARNING LAB</span><span>EST. 2026</span></div><div className="study-sheet"><div className="sheet-top"><span className="sheet-number">01</span><span className="eyebrow">ONE SMALL MISSION<br/>ONE NEW POSSIBILITY</span><BookOpen size={26} aria-hidden="true"/></div><h2>Start with a<br/><em>little curiosity.</em></h2><div className="learning-track"><span className="track-dot done"><Check size={14}/></span><span/><span className="track-dot active">02</span><span/><span className="track-dot">03</span></div><div className="track-labels"><span>Explore</span><span>Try it out</span><span>Make it stick</span></div></div>
          <div className="quiz-preview"><div className="preview-label"><span className="orange-dot"/> TRY A ONE-QUESTION PREVIEW <span>ENGLISH</span></div><h3>“The curious fox jumps.”</h3><p>Which part is the subject?</p><div className="preview-options">{['The curious fox', 'jumps'].map((text, index) => <button key={text} className={choice === index ? index === 0 ? 'correct' : 'incorrect' : ''} aria-pressed={choice === index} onClick={() => setChoice(index)}><span>{index === 0 ? 'A' : 'B'}</span>{text}{choice === index && (index === 0 ? <Check size={17} aria-hidden="true"/> : <span>Try again</span>)}</button>)}</div><div className="preview-feedback" role="status">{choice === null ? <><CornerDownRight size={14} aria-hidden="true"/> Go on. You probably know this one.</> : choice === 0 ? 'Exactly. The subject tells us who or what the sentence is about.' : '“Jumps” tells us what happens. Look for who does the jumping.'}</div></div>
        </div>
      </section>
      <div className="principle-strip"><span>A different way to learn.</span><span>Small missions</span><span>Honest feedback</span><span>A path that adapts</span><span>Progress you can see<ArrowDownMark/></span></div>
      <section id="how-it-works" className="method-section"><div className="method-intro"><span className="eyebrow">THE METHOD / 01—03</span><h2>A course follows a syllabus.<br/><em>Your path follows you.</em></h2><p>You don’t need another open tab. You need a clear next step.</p></div><div className="method-grid">{[
        ['01', 'Follow a question.', 'Tell us what you want to learn. We’ll break it down into a path of lessons and practical tasks.'],
        ['02', 'Put it to the test.', 'Short quizzes check what clicked. Already know a topic? Pass its quiz to skip ahead.'],
        ['03', 'Work on what matters.', 'See your strengths and gaps. Choose a focused mission for the tricky bits, or keep moving.'],
      ].map(([number, title, copy]) => <article key={number}><span className="method-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="landing-cta"><div><span className="eyebrow">ONE GOOD QUESTION CAN CHANGE A LOT</span><h2>What will you learn next?</h2></div><Button variant="dark" onClick={() => onAuth('signup')}>Make a start<ArrowRight size={18} aria-hidden="true"/></Button></section>
    </main><footer className="public-footer"><Brand/><p>Built for understanding. Designed for you.</p><span>OpenAI & Anthropic supported</span></footer>
  </div>;
}
function ArrowDownMark() { return <ArrowRight className="down-arrow" size={16} aria-hidden="true"/>; }
