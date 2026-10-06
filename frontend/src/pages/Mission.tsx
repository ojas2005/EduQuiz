import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Home, ChevronDown, LockKeyhole, Target, Trophy } from 'lucide-react';
import type { Assessment, Attempt, Course, Result } from '../types';
import { MissionRecap } from '../components/MissionRecap';
import { canonicalAnswers, restoreDraft, shuffledOrder, type Draft } from '../quiz';
import { Alert, Button, Modal, PageHeading, Progress } from '../components/UI';
export function ResultReview({ result, recap, children }: { result: Assessment; recap?: { courseId: string; missionIndex?: number }; children?: React.ReactNode }) {
  return <section className="result-panel content-enter"><div className="result-summary"><div className="result-score"><span>{result.score}</span><small>/100</small></div><div><span className="eyebrow">YOUR CHECK-IN</span><h2>{result.passed ? 'That’s understanding, in action.' : 'Now you know where to focus.'}</h2><p>{result.passed ? 'Keep building on what you know.' : 'A score is a starting point. Take the useful parts with you.'}</p></div></div><div className="result-skills"><div><span className="eyebrow"><Check size={14} aria-hidden="true"/> WORKING WELL</span><p>{result.strengths.join(' · ') || 'Your strengths are still taking shape.'}</p></div><div><span className="eyebrow"><Target size={14} aria-hidden="true"/> NEXT TO PRACTICE</span><p>{result.weaknesses.join(' · ') || 'No gaps found in this quiz.'}</p></div></div>{recap && <div className="result-recap"><MissionRecap {...recap}/><p>Pick a lesson to reread at your own pace.</p></div>}<div className="answer-review"><h3>A closer look at your answers</h3>{result.feedback.map((feedback, index) => <details key={index}><summary><span className={`answer-indicator ${feedback.correct ? 'is-correct' : ''}`}>{feedback.correct ? <Check size={14} aria-hidden="true"/> : index + 1}</span><span>Question {index + 1}<small>{feedback.correct ? 'Correct' : 'Worth reviewing'}</small></span><ChevronDown size={17} aria-hidden="true"/></summary><div>{feedback.prompt && <p><strong>{feedback.prompt}</strong></p>}{feedback.selected_answer && <p><strong>Your answer:</strong> {feedback.selected_answer}</p>}<p><strong>{feedback.correct ? 'Why it works:' : 'Why that choice misses the mark:'}</strong> {feedback.selected_explanation || feedback.explanation}</p>{!feedback.correct && <><p><strong>Correct answer:</strong> {feedback.answer}</p><p><strong>Why it works:</strong> {feedback.correct_explanation || feedback.explanation}</p></>}</div></details>)}</div>{children}</section>;
}
function readDraft(key: string, practice: boolean, count: number, revision: number, ready: boolean): Draft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    return restoreDraft(value, practice, count, revision, ready);
  } catch { /* Storage is optional. */ }
  return restoreDraft(null, practice, count, revision, ready);
}
function TopicComplete({ course, userId, onReview, onHome, onStartTopic, busy }: {
  course: Course; userId: string; onReview: () => void; onHome: () => void;
  onStartTopic: () => Promise<boolean>; busy: boolean;
}) {
  const suggestion = course.suggested_topic;
  const dismissalKey = `eduquiz:suggestion:${userId}:${course.id}`;
  const [open, setOpen] = useState(() => {
    try { return !!course.suggested_topic && !sessionStorage.getItem(dismissalKey); } catch { return !!course.suggested_topic; }
  });
  const [error, setError] = useState(false);
  function dismiss() {
    setOpen(false); setError(false);
    try { sessionStorage.setItem(dismissalKey, 'dismissed'); } catch {}
  }
  return <section className="completion-panel">
    <span className="eyebrow">{course.practice ? 'PRACTICE COMPLETE' : 'TOPIC COMPLETE'}</span>
    <h2>{course.practice ? 'Your practice is saved.' : `You’ve completed ${course.title}.`}</h2>
    <p>Your results are saved. Take a break or choose what comes next.</p>
    <div className="button-row">
      <Button onClick={onHome} disabled={busy}><Home size={17} aria-hidden="true"/>Return to home</Button>
      <Button variant="secondary" onClick={onReview} disabled={busy}>View growth report</Button>
      <MissionRecap courseId={course.id}/>
      {course.suggested_topic && <Button variant="ghost" disabled={busy} onClick={() => setOpen(true)}>Explore next topic<ArrowRight size={17} aria-hidden="true"/></Button>}
    </div>
    {open && suggestion && <Modal title="A good next step?" subtitle="You’ve finished this topic. Continue only if you feel ready." busy={busy} onClose={dismiss}>{close => <>
      <div className="suggested-topic"><span className="eyebrow">SUGGESTED FOR YOU</span><h3>{suggestion.topic}</h3><p>{suggestion.reason}</p></div>
      {error && <Alert error>We couldn’t open the next topic. Check your model connection or quota and try again. Your completed topic is saved.</Alert>}
      <div className="button-row"><Button disabled={busy} onClick={async () => { setError(false); if (!await onStartTopic()) setError(true); }}>{busy ? 'Opening your next topic…' : 'Yes, start this topic'}<ArrowRight size={17} aria-hidden="true"/></Button><Button variant="secondary" disabled={busy} onClick={() => close()}>Not now</Button></div>
      <Button variant="ghost" disabled={busy} onClick={() => close(onHome)}>Return to home</Button>
    </>}</Modal>}
  </section>;
}
export function MissionPage({ course, userId, result, pending, busy, onSubmit, onRefreshQuiz, onDecision, onReview, onNext, onHome, onStartTopic }: {
  course: Course; userId: string; result: Result | null; pending?: Attempt; busy: boolean;
  onSubmit: (data: { mission_index: number; quiz_revision: number; answers: number[]; question_order: number[]; skip: boolean; tasks_completed: boolean }) => Promise<boolean>;
  onRefreshQuiz: () => Promise<Course | null>;
  onDecision: (attemptId: string, remediate: boolean) => void; onReview: () => void; onNext: () => void; onHome: () => void; onStartTopic: () => Promise<boolean>;
}) {
  const key = `eduquiz:draft:${userId}:${course.id}:${course.current}`;
  const questionCount = course.missions[course.current]?.questions?.length || 0;
  const revision = course.missions[course.current]?.quiz_revision ?? 0;
  const ready = !!course.missions[course.current]?.quiz_ready;
  const [draft, setDraft] = useState<Draft>(() => readDraft(key, course.practice, questionCount, revision, ready));
  useEffect(() => {
    const saved = readDraft(key, course.practice, questionCount, revision, ready);
    setDraft(saved);
    try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { /* Storage is optional. */ }
  }, [key]);
  function update(changes: Partial<Draft>) {
    const next = { ...draft, ...changes }; setDraft(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Continue without persistence. */ }
  }
  async function beginQuiz(skip: boolean) {
    if (busy) return;
    let quizMission = course.missions[course.current];
    if (draft.refreshNeeded || !quizMission.quiz_ready) {
      const updated = await onRefreshQuiz();
      if (!updated) return;
      quizMission = updated.missions[updated.current];
    }
    const next = { ...draft, quiz: true, skip, answers: {}, refreshNeeded: false,
      quizRevision: quizMission.quiz_revision ?? 0,
      order: shuffledOrder(quizMission.questions?.length || 0, draft.order) };
    setDraft(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }
  const mission = course.missions[course.current];
  const assessment = result || pending;
  const tasksDone = (mission?.tasks || []).every((_, index) => !!draft.tasks[index]);
  const answered = (mission?.questions || []).filter((_, index) => Number.isInteger(draft.answers[index])).length;
  const decisionPanel = course.pending_attempt && <div className="decision-panel"><span className="eyebrow">CHOOSE YOUR NEXT STEP</span><h3>Spend a little time on the tricky bits?</h3><p>We can add a focused mission for your weak skills before the next topic. It’s your call.</p><div className="button-row"><Button disabled={busy} onClick={() => onDecision(course.pending_attempt!, true)}>Work on these skills<ArrowRight size={17} aria-hidden="true"/></Button><Button disabled={busy} variant="secondary" onClick={() => onDecision(course.pending_attempt!, false)}>Continue to next topic</Button></div></div>;
  return <><a className="back-link" href={course.practice ? '#practice' : '#learning'}><ArrowLeft size={16} aria-hidden="true"/>Back to {course.practice ? 'practice studio' : 'learning shelf'}</a><PageHeading eyebrow={course.practice ? `${course.title} / PRACTICE` : `${course.title} / LEARNING PATH`} title={assessment ? 'A useful moment to reflect.' : course.complete ? 'One more thing you know.' : mission.title}/>
    {assessment ? <ResultReview result={assessment} recap={{ courseId: course.id, missionIndex: assessment.mission_index }}>{!assessment.can_continue ? <div className="decision-panel"><h3>A little more practice before skipping.</h3><p>Skipping needs a score of at least 80%. Return to the lesson and try again when you’re ready.</p><Button onClick={() => { update({ quiz: false, skip: false, answers: {}, refreshNeeded: true }); onNext(); }}>Back to the lesson<ArrowRight size={17} aria-hidden="true"/></Button></div> : decisionPanel || !course.complete && <div className="result-actions"><Button onClick={onNext}>Open next mission<ArrowRight size={17} aria-hidden="true"/></Button></div>}</ResultReview>
      : course.pending_attempt ? <section className="panel">{decisionPanel}</section>
      : course.complete ? null
      : <div className="mission-columns"><article key={draft.quiz ? 'quiz' : 'lesson'} className="lesson-panel content-enter">
        <div className="lesson-meta"><span className="eyebrow">{draft.quiz ? draft.skip ? 'SKIP CHALLENGE' : 'CHECK YOUR UNDERSTANDING' : 'READ. TRY. REFLECT.'}</span><span>{draft.quiz ? `${answered}/${mission.questions?.length || 0} answered` : `${Object.values(draft.tasks).filter(Boolean).length}/${mission.tasks?.length || 0} tasks complete`}</span></div>
        {draft.quiz ? <><Progress value={answered / (mission.questions?.length || 1) * 100} label="Questions answered"/>{draft.skip && <p className="context-note">You need 80% to skip. If you don’t pass, the lesson stays available.</p>}<form onSubmit={async event => { event.preventDefault(); const success = await onSubmit({ mission_index: course.current, quiz_revision: draft.quizRevision, answers: canonicalAnswers(draft.answers, questionCount), question_order: draft.order, skip: draft.skip, tasks_completed: tasksDone }); if (success) { try { sessionStorage.removeItem(key); } catch {} } }}>
          {draft.order.map((index, displayIndex) => { const question = mission.questions![index]; return <fieldset className="quiz-question" key={index}><legend><span>{String(displayIndex + 1).padStart(2, '0')}</span>{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`quiz-option ${draft.answers[index] === optionIndex ? 'selected' : ''}`} key={optionIndex}><input required type="radio" name={`question-${index}`} value={optionIndex} checked={draft.answers[index] === optionIndex} disabled={busy} onChange={() => update({ answers: { ...draft.answers, [index]: optionIndex } })}/><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{draft.answers[index] === optionIndex && <Check size={17} aria-hidden="true"/>}</label>)}</fieldset>; })}
          <div className="lesson-actions"><Button type="submit" disabled={busy || answered !== mission.questions?.length}>{busy ? 'Checking your answers…' : 'Submit answers'}<ArrowRight size={17} aria-hidden="true"/></Button>{!course.practice && <Button variant="ghost" disabled={busy} onClick={() => update({ quiz: false, answers: {}, refreshNeeded: true })}>Back to lesson</Button>}</div></form></>
          : course.practice ? <><h2>A fresh practice set is ready when you are.</h2><p>Returning to an unfinished quiz gives you new scenarios across this mission’s topics.</p><Button disabled={busy} onClick={() => void beginQuiz(false)}>{busy ? 'Preparing new questions…' : 'Start practice quiz'}<ArrowRight size={17} aria-hidden="true"/></Button></>
          : <><h2>{mission.objective}</h2><p className="mission-scope">{mission.difficulty && `${mission.difficulty} · ${mission.importance} concept · `}{questionCount} scenario questions. Every mission topic is covered{mission.quiz_topics?.length ? `: ${mission.quiz_topics.join(', ')}` : ''}. Returning from the lesson brings a fresh set.</p><div className="lesson-text">{mission.lesson?.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><section className="task-section"><span className="eyebrow">PUT THE IDEA TO WORK</span><h3>Your turn.</h3><p>Try each task, then mark it done. The quiz checks your understanding.</p>{mission.tasks?.map((task, index) => <label className={`task-item ${draft.tasks[index] ? 'done' : ''}`} key={index}><input type="checkbox" checked={!!draft.tasks[index]} onChange={event => update({ tasks: { ...draft.tasks, [index]: event.target.checked } })}/><span>{task}</span></label>)}</section><div className="lesson-actions"><Button disabled={busy || !tasksDone} onClick={() => void beginQuiz(false)}>Check my understanding<ArrowRight size={17} aria-hidden="true"/></Button><small>{tasksDone ? 'Ready when you are.' : 'Complete the tasks to unlock the quiz.'}</small></div><button className="text-link skip-challenge" disabled={busy} onClick={() => void beginQuiz(true)}>Already know this? Take the skip challenge<ArrowRight size={15} aria-hidden="true"/></button></>}
      </article><aside className="mission-roadmap"><span className="eyebrow">THE BIGGER PICTURE</span><h2>Your path</h2><p>{course.current} of {course.missions.length} missions covered</p><ol>{course.missions.map((item, index) => <li key={index} className={index === course.current ? 'road-current' : index < course.current ? 'road-done' : ''}><span className="road-index">{index < course.current ? <Check size={15} aria-hidden="true"/> : index === course.current ? index + 1 : <LockKeyhole size={13} aria-hidden="true"/>}</span><div><strong>{item.title}</strong><small>{index < course.current ? 'Covered' : index === course.current ? 'You are here' : 'Coming up'}</small></div></li>)}</ol><div className="roadmap-note"><Trophy size={20} aria-hidden="true"/><p>Understanding takes practice.<br/>You set the pace.</p></div></aside></div>}
    {course.complete && <TopicComplete course={course} userId={userId} onReview={onReview} onHome={onHome} onStartTopic={onStartTopic} busy={busy}/>}
  </>;
}
