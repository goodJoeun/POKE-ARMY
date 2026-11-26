'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, presentNpcs, spotLabel } from '../state/store';
import { BRANCHES, RANKS, TOTAL_DAYS, rankIdxForDay } from '../data/branches';
import { ARCHETYPE_INFO, findSpecies } from '../data/monsters';
import { NPC_SKINS, NPC_ROLES, npcDisplayName, npcRoleTitle } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { ITEMS } from '../data/items';
import { buildSchedule } from '../data/schedule';
import { fmtTime } from '../data/branches';
import MonsterCanvas from './MonsterCanvas';
import { npcCap } from '../engine/speakers';
import { CLUES } from '../data/story';
import { PUZZLES } from '../data/puzzles';
import { SUSPICIONS, suspicionLeads, suspicionState } from '../data/suspicions';

type Tab = 'me' | 'people' | 'quests' | 'items' | 'tips' | 'schedule' | 'clues' | 'sus';

export default function Notebook({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('me');
  const sp = findSpecies(s.speciesId);
  const b = BRANCHES[s.branch];
  // 좁은 화면에선 탭이 한 줄로 옆으로 밀린다 → 고른 탭이 가려지지 않게 보이는 자리로 당겨 온다
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('button.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: [Tab, string][] = [['me', '👤 나'], ['people', '🤝 관계'], ['quests', '📋 퀘스트'], ...(s.clues.length > 0 ? [['sus', '❓ 의혹'] as [Tab, string], ['clues', '🔍 기억의 실마리'] as [Tab, string]] : []), ['items', '🎒 소지품'], ['schedule', '🗓️ 일과표'], ['tips', '📘 군대 상식']];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="notebook" onClick={(e) => e.stopPropagation()}>
        <div className="nb-tabs" ref={tabsRef}>
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
          <button className="nb-close" onClick={onClose}>✕</button>
        </div>
        <div className="nb-body">
          {tab === 'me' && sp && (
            <div className="nb-me">
              <MonsterCanvas look={sp.look} size={140} cap={b.cap} />
              <div>
                <h3>{RANKS[rankIdxForDay(s.day)]} {s.name}</h3>
                <p><b>{sp.name}</b> ({sp.type} 타입) — {sp.desc}</p>
                <p>성격: <b>{ARCHETYPE_INFO[s.archetype].name}</b> · {ARCHETYPE_INFO[s.archetype].perk}</p>
                <p>소속: {b.name} {b.unit}</p>
                <p>전역까지: D-{TOTAL_DAYS - s.day} (게임 내 {TOTAL_DAYS}일 = 실제 {b.months}개월)</p>
              </div>
            </div>
          )}
          {tab === 'people' && (
            <div className="nb-people">
              {presentNpcs(s.day).map((id) => {
                const sk = NPC_SKINS[s.branch][id];
                const aff = s.affinity[id];
                return (
                  <div key={id} className="person">
                    <MonsterCanvas look={sk.look} size={64} cap={npcCap(s.branch, id)} animate={false} />
                    <div className="person-info">
                      <div><b>{npcDisplayName(s.branch, id, s.day)}</b> <span className="hud-dim">{npcRoleTitle(s.branch, id)} · {sk.species}</span></div>
                      <div className="hud-dim">{NPC_ROLES[id].personality}</div>
                      <div className="aff-track">
                        <span className="aff-mid" />
                        <span className="aff-fill" style={{ left: aff >= 0 ? '50%' : `${50 + aff / 2}%`, width: `${Math.abs(aff) / 2}%`, background: aff >= 0 ? '#4ab06a' : '#e0584a' }} />
                      </div>
                      <div className="hud-dim">호감도 {aff} {s.talked.includes(id) ? '· 오늘 대화함' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'quests' && (
            <div>
              {s.quests.length === 0 && <p className="hud-dim">진행 중인 퀘스트가 없다. 선후임·간부와 대화해 보자.</p>}
              {s.quests.map((q) => {
                const d = QUESTS[q.id];
                return (
                  <div key={q.id} className="quest">
                    <b>{d.title}</b> <span className="hud-dim">({q.step + 1}/{d.steps.length})</span>
                    <div>{d.desc}</div>
                    <div className="hud-dim">다음: {d.steps[q.step].spot ? `📍 ${spotLabel(s.branch, d.steps[q.step].spot!)}` : `👤 ${NPC_SKINS[s.branch][d.steps[q.step].npc!].name}`}에게 가기</div>
                  </div>
                );
              })}
              {s.doneQuests.length > 0 && <p className="hud-dim">완료: {s.doneQuests.map((id) => QUESTS[id].title).join(', ')}</p>}
            </div>
          )}
          {tab === 'items' && (
            <div className="nb-items">
              {Object.entries(s.inventory).filter(([, n]) => n > 0).length === 0 && <p className="hud-dim">소지품이 없다. 개인정비 시간에 PX를 이용하자.</p>}
              {Object.entries(s.inventory).filter(([, n]) => n > 0).map(([id, n]) => (
                <div key={id} className="item-row">
                  <span>{ITEMS[id].icon} {ITEMS[id].name} ×{n}</span>
                  <span className="hud-dim">{ITEMS[id].desc}</span>
                  <button onClick={() => s.useItem(id)}>먹기</button>
                </div>
              ))}
            </div>
          )}
          {tab === 'schedule' && (
            <div>
              <table className="sched">
                <tbody>
                  <tr><td>06:00</td><td>기상</td></tr>
                  {buildSchedule(s.day, s.branch).map((e, i) => (
                    <tr key={e.id} className={i < s.eventIdx ? 'done' : i === s.eventIdx ? 'now' : ''}>
                      <td>{fmtTime(e.start)}</td><td>{e.label}</td>
                    </tr>
                  ))}
                  {s.day < TOTAL_DAYS && <>
                    <tr><td>12:00</td><td>점심 식사 (자유)</td></tr>
                    <tr><td>17:30</td><td>일과 종료 · 저녁 식사 · 개인정비 (PX/싸지방/체력단련/휴대폰)</td></tr>
                  </>}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'sus' && (
            <div className="nb-clues">
              <div className="clue-head">
                <div>❓ <b>의혹 수첩</b> <span className="hud-dim">· 이 부대의 미심쩍은 점들. 단서를 찾으면 실마리가 붙고, 결정적인 단서로 풀린다.</span></div>
                <div className="hud-dim">풀린 의혹 {SUSPICIONS.filter((d) => suspicionState(d, s) === 'solved').length} / {SUSPICIONS.length}</div>
              </div>
              {SUSPICIONS.map((d) => {
                const st = suspicionState(d, s);
                if (st === 'hidden') return <div key={d.id} className="clue-card locked"><b>❓ ???</b> <span className="hud-dim">· 아직 눈에 띄지 않은 의혹</span></div>;
                return (
                  <div key={d.id} className={`clue-card sus ${st}`}>
                    <div><b>{st === 'solved' ? '✅' : '❓'} {d.title}</b> <span className="hud-dim">· {d.question}</span></div>
                    <ul className="sus-leads">
                      {suspicionLeads(d, s).map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                    {st === 'solved' && <div className="sus-answer">→ {d.answer}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'clues' && (
            <div className="nb-clues">
              <div className="clue-head">
                <div className="clue-stars" title="별 조각">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className={s.stars.includes(n) ? 'on' : ''}>{s.stars.includes(n) ? '★' : '☆'}</span>)}
                  <span className="hud-dim"> 별 조각 {s.stars.length}/7</span>
                </div>
                <div>🌟 인간의 기억 <b>{s.memory}</b>/100 <span className="hud-dim">· 하루마다 흐려진다. 단서와 꿈이 되살린다.</span></div>
                <div className="hud-dim">실마리 {s.clues.length}/{CLUES.length} · 🧩 푼 퍼즐 {Object.values(PUZZLES).filter((p) => s.puzzles[p.id]?.solved).length}/{Object.keys(PUZZLES).length} · 🍬 별사탕 {s.candy}개</div>
              </div>
              {CLUES.map((c) => s.clues.includes(c.id) ? (
                <div key={c.id} className="clue-card">
                  <div><b>🔍 {c.title}</b> <span className="hud-dim">· {c.place}</span></div>
                  <div className="clue-text">{c.text}</div>
                  {c.id === 'C-13' && (s.flags.calledMinhyeok || s.day < TOTAL_DAYS) && (
                    <div className="clue-text">{s.flags.calledMinhyeok
                      ? '이름을 불렀더니 병장님이 명찰 뒷면에 직접 적으셨다. 강민혁.'
                      : '전역 전에 2생활관 병장님을 다시 뵈면, 점호에서 빠진 그 이름을 내가 불러 드리자.'}</div>
                  )}
                </div>
              ) : (
                <div key={c.id} className="clue-card locked"><b>❓ ???</b> <span className="hud-dim">· {c.chapter}장</span></div>
              ))}
            </div>
          )}
          {tab === 'tips' && (
            <div className="tips">
              <div className="dex-eval">
                📖 박사님의 도감 평가 ({s.tips.length}개): {s.tips.length < 5 ? '"아직 시작에 불과하다! 군대 상식을 더 모아 보거라."' : s.tips.length < 15 ? '"오, 꽤 모았구나! 이 기세로 계속 가 보거라."' : s.tips.length < 30 ? '"훌륭하다! 이 정도면 걸어 다니는 군대 상식 도감이구나!"' : '"완벽하다! 너야말로 진정한 군대 마스터다!"'}
              </div>
              {s.tips.length === 0 && <p className="hud-dim">대화와 점호를 통해 군대 상식을 모아보자.</p>}
              {s.tips.map((t, i) => <div key={i} className="tip-item">📘 {t}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
