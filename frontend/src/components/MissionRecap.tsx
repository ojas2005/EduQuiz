import { useEffect, useId, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { api } from '../api';
import type { Recap } from '../types';
import { Alert, Button, Loading, Modal } from './UI';

export function MissionRecap({ courseId, missionIndex }: { courseId: string; missionIndex?: number }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="secondary" onClick={() => setOpen(true)}><BookOpen size={17} aria-hidden="true"/>Revisit a mission</Button>
    {open && <RecapDialog key={`${courseId}:${missionIndex}`} courseId={courseId} missionIndex={missionIndex} onClose={() => setOpen(false)}/>}
  </>;
}

function RecapDialog({ courseId, missionIndex, onClose }: { courseId: string; missionIndex?: number; onClose: () => void }) {
  const [data, setData] = useState<Recap | null>(null);
  const [selected, setSelected] = useState<number | undefined>(missionIndex);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const selectId = useId();
  useEffect(() => {
    let active = true;
    setError(''); setData(null);
    api<Recap>(`/courses/${courseId}/recap`).then(value => {
      if (!active) return;
      setData(value);
      setSelected(value.missions.some(m => m.index === missionIndex) ? missionIndex : value.missions[0]?.index);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your recap. Please try again.'); });
    return () => { active = false; };
  }, [courseId, missionIndex, retry]);
  const mission = data?.missions.find(item => item.index === selected);
  return <Modal title="A little refresher." subtitle="Just the lesson. No tasks or quiz, and your progress stays exactly where it is." onClose={onClose}>
    {close => <div className="mission-recap">
      {error ? <><Alert error>{error}</Alert><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button></> : !data ? <Loading label="Opening your lessons…"/> : !data.missions.length ? <p>Your lessons will be available here after your first assessment.</p> : <>
        <label className="recap-picker" htmlFor={selectId}><span>Choose a mission · {data.topic}</span>
          <select id={selectId} value={selected} onChange={event => setSelected(Number(event.target.value))}>
            {data.missions.map(item => <option key={item.index} value={item.index}>{item.index + 1}. {item.title}</option>)}
          </select>
        </label>
        {mission && <article key={mission.index} className="recap-lesson content-enter">
          <span className="eyebrow">MISSION {mission.index + 1} · RECAP</span>
          <h3>{mission.title}</h3><p className="recap-objective">{mission.objective}</p>
          <div className="lesson-text">{mission.lesson.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        </article>}
      </>}
      <div className="recap-actions"><Button onClick={() => close()}>Back to results</Button></div>
    </div>}
  </Modal>;
}
