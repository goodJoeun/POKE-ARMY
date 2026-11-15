'use client';
import { useEffect, useState } from 'react';
import { useGame, presentNpcs, spotLabel } from '../state/store';
import { BRANCHES, RANKS, TOTAL_DAYS, rankIdxForDay } from '../data/branches';
import { ARCHETYPE_INFO, findSpecies } from '../data/monsters';
import { NPC_SKINS, NPC_ROLES, npcDisplayName, npcRoleTitle } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { memberName } from '../engine/whereabouts';
import { ITEMS } from '../data/items';
import { buildSchedule } from '../data/schedule';
import { fmtTime } from '../data/branches';
import MonsterCanvas from './MonsterCanvas';
import { npcCap } from '../engine/speakers';
import { CLUES } from '../data/story';

type Tab = 'me' | 'people' | 'quests' | 'items' | 'tips' | 'schedule' | 'clues';

export default function Notebook({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('me');
  const sp = findSpecies(s.speciesId);
  const b = BRANCHES[s.branch];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: [Tab, string][] = [['me', '👤 나'], ['people', '🤝 관계'], ['quests', '📋 퀘스트'], ...(s.clues.length > 0 ? [['clues', '🔍 단서'] as [Tab, string]] : []), ['items', '🎒 소지품'], ['schedule', '🗓️ 일과표'], ['tips', '📘 군대 상식']];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="notebook" onClick={(e) => e.stopPropagation()}>
        <div className="nb-tabs">
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
                <p>지각 횟수: {s.lateCount}회</p>
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
              {s.quests.length === 0 && !s.mealCheck && <p className="hud-dim">진행 중인 퀘스트가 없다. 선후임·간부와 대화해 보자.</p>}
              {s.mealCheck && (
                <div className="quest">
                  <b>🍚 식사 집합</b> <span className="hud-dim">({s.mealCheck.asked.length}/{s.mealCheck.targets.length})</span>
                  <div>밥 먹으러 가기 전에 선임들께 "식사하러 가시겠습니까?" 여쭤보고 다 같이 가자.</div>
                  <div className="hud-dim">
                    {s.mealCheck.targets.map((id) => `${s.mealCheck!.asked.includes(id) ? '✅' : '⬜'} ${memberName(s.branch, id)}`).join('  ')}
                  </div>
                </div>
              )}
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
          {tab === 'clues' && (
            <div className="nb-clues">
              <div className="clue-head">
                <div className="clue-stars" title="별 조각">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className={s.stars.includes(n) ? 'on' : ''}>{s.stars.includes(n) ? '★' : '☆'}</span>)}
                  <span className="hud-dim"> 별 조각 {s.stars.length}/7</span>
                </div>
                <div>🌟 인간의 기억 <b>{s.memory}</b>/100 <span className="hud-dim">· 하루마다 흐려진다. 단서와 꿈이 되살린다.</span></div>
                <div className="hud-dim">떡밥 {s.clues.length}/{CLUES.length}</div>
              </div>
              {CLUES.map((c) => s.clues.includes(c.id) ? (
                <div key={c.id} className="clue-card">
                  <div><b>🔍 {c.title}</b> <span className="hud-dim">· {c.place}</span></div>
                  <div className="clue-text">{c.text}</div>
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
