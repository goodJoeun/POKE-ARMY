'use client';
import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { npcSpeaker } from '../engine/speakers';
import { fmt } from '../engine/text';
import MonsterCanvas from './MonsterCanvas';

export default function RollcallModal() {
  const s = useGame();
  const rc = s.rollcall;
  const [answer, setAnswer] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);

  useEffect(() => { setAnswer(null); }, [rc?.q.q]);

  useEffect(() => {
    if (!rc) return;
    const onKey = (e: KeyboardEvent) => {
      if (answer === null) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= rc.q.options.length) pick(n - 1);
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        s.closeRollcall();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!rc) return null;
  const who = rc.kind === 'rollcall_am' ? 'cpt' : 'lt';
  const sp = npcSpeaker(s.branch, who, s.day);
  const pick = (i: number) => {
    if (answer !== null) return;
    setAnswer(i);
    setCorrect(s.answerRollcall(i));
  };
  const ctx = { branch: s.branch, name: s.name, day: s.day };

  return (
    <div className="modal-backdrop">
      <div className="rollcall">
        <div className="rc-head">
          {sp.look && <MonsterCanvas look={sp.look} size={90} cap={sp.cap} />}
          <div>
            <div className="rc-title">{rc.kind === 'rollcall_am' ? '🌅 아침 점호' : '🌙 저녁 점호'}{rc.late ? ' (지각…)' : ''}</div>
            <div className="speaker">{sp.name} <span className="speaker-sub">{sp.sub}</span></div>
            <div>{rc.kind === 'rollcall_am' ? '인원 및 건강 상태 이상 무. 자, 오늘의 질문이다.' : '취침 전 마지막 점검이다. 하나 물어보지.'}</div>
          </div>
        </div>
        <div className="rc-q">Q. {fmt(rc.q.q, ctx)}</div>
        <div className="rc-options">
          {rc.q.options.map((o, i) => (
            <button
              key={i}
              className={`choice ${answer !== null && i === rc.q.answer ? 'right' : ''} ${answer === i && !correct ? 'wrong' : ''}`}
              onClick={() => pick(i)}
              disabled={answer !== null}
            >
              <span className="choice-num">{i + 1}</span> {o}
            </button>
          ))}
        </div>
        {answer !== null && (
          <div className="rc-result">
            <div className={correct ? 'grade grade-good' : 'grade grade-bad'}>{correct ? '✅ 정답! 군기 +' : '❌ 오답… 군기 -'}</div>
            <div className="tip-title">📘 군대 상식</div>
            <div>{fmt(rc.q.tip, ctx)}</div>
            <button className="primary" onClick={() => s.closeRollcall()}>점호 종료 (Enter)</button>
          </div>
        )}
      </div>
    </div>
  );
}
