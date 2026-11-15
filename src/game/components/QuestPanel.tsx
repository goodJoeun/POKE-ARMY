'use client';
import { useEffect, useState } from 'react';
import type { BranchId, Effects } from '../types';
import { useGame, spotLabel, questSlowActive, questOffers, mealGatherMin, PATROL_SPOTS, type QuestOffer } from '../state/store';
import { QUESTS, QUEST_CHAINS, chainOf } from '../data/quests';
import { NPC_SKINS, npcDisplayName } from '../data/npcs';
import { fmtTime } from '../data/branches';
import { fmt } from '../engine/text';
import { memberFullName, memberLook, memberName, npcWhere } from '../engine/whereabouts';
import MonsterCanvas from './MonsterCanvas';
import { CHAPTERS, CLUES, STORY_MISSIONS, missionState, nextStoryMission } from '../data/story';

/** 퀘스트 창 초상화 + 이름 (포켓몬을 몰라도 누군지 알아볼 수 있게) */
function Face({ branch, who, day }: { branch: BranchId; who: string; day: number }) {
  const lk = memberLook(branch, who);
  return (
    <span className="ql-face">
      {lk && <MonsterCanvas look={lk.look} size={46} cap={lk.cap} animate={false} />}
      <span className="ql-face-name">{memberFullName(branch, who, day)}</span>
    </span>
  );
}

/** 보상 요약: "호감 가디 +6 · 군기 +3" */
function rewardText(e: Effects, branch: BranchId): string {
  const parts: string[] = [];
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  if (e.hp) parts.push(`체력 ${sign(e.hp)}`);
  if (e.mental) parts.push(`멘탈 ${sign(e.mental)}`);
  if (e.discipline) parts.push(`군기 ${sign(e.discipline)}`);
  if (e.skill) parts.push(`숙련 ${sign(e.skill)}`);
  for (const [id, v] of Object.entries(e.affinity ?? {})) {
    if (v) parts.push(`${NPC_SKINS[branch][id as keyof typeof NPC_SKINS[BranchId]].name} 호감 ${sign(v)}`);
  }
  return parts.join(' · ');
}

/** 연계 퀘스트 배지: "🔗 분대장 인수인계 2/3" */
function ChainBadge({ questId }: { questId: string }) {
  const ch = chainOf(questId);
  if (!ch) return null;
  return <span className="ql-chain">🔗 {ch.title} {ch.quests.indexOf(questId) + 1}/{ch.quests.length}</span>;
}

/** 퀘스트 한 단계의 목적지 문구 */
function stepTarget(step: { spot?: string; npc?: string }, branch: BranchId, day: number): string {
  if (step.spot) return `📍 ${spotLabel(branch, step.spot as Parameters<typeof spotLabel>[1])}`;
  if (step.npc) {
    const where = npcWhere(branch, step.npc as Parameters<typeof npcWhere>[1]);
    return `👤 ${npcDisplayName(branch, step.npc as Parameters<typeof npcDisplayName>[1], day)}에게 보고 · 📍 ${where ?? '위치 확인 중'}`;
  }
  return '';
}

/** 화면 왼쪽: 진행 중인 퀘스트 요약 (클릭하면 퀘스트 창) */
export function QuestTracker({ onOpen }: { onOpen: () => void }) {
  const s = useGame();
  const slow = questSlowActive(s);
  const mc = s.mealCheck;
  const items: { title: string; next: string; done?: boolean }[] = [];
  const story = s.clues.length > 0 ? nextStoryMission(s) : null;
  if (story) items.push({ title: `📖 ${story.chapter}장 · ${story.title}`, next: story.hint });
  const ate = mc && s.daily.includes(`meal_${mc.meal}`);
  if (mc && !ate) {
    const left = mc.targets.filter((id) => !mc.asked.includes(id));
    const march = mc.marchAt ?? null;
    items.push(mc.status !== 'asking'
      ? (march === null || s.minute < march
        ? { title: '🍚 식사 집합', next: `📍 막사 앞 집합 · ${march !== null ? fmtTime(march) : '곧'} 다 같이 출발` }
        : { title: '🍚 식사', next: '🚶 1생활관이 식당으로 이동 중 — 배식대에서 식판 받고 내 자리(분대 줄)에 앉자', done: true })
      : { title: `🍚 식사 집합 (${mc.asked.length}/${mc.targets.length})`, next: `${left.map((id) => `👤 ${memberName(s.branch, id)} 📍${npcWhere(s.branch, id) ?? '?'}`).join(' / ')} · ${fmtTime(mc.start + mealGatherMin())}까지` });
  }
  if (s.patrol) {
    const left = PATROL_SPOTS.filter((sp) => !s.patrol!.done.includes(sp));
    items.push({
      title: `🔦 야간 순찰 (${s.patrol.done.length}/${PATROL_SPOTS.length})`,
      next: left.length ? `📍 ${spotLabel(s.branch, left[0])} 외 ${left.length - 1}곳 · 23:00까지` : '📍 막사 1층 지휘통제실 당직사관에게 보고',
      done: !left.length,
    });
  }
  for (const q of s.quests) {
    const d = QUESTS[q.id];
    const step = d?.steps[q.step];
    if (!d || !step) continue;
    items.push({ title: `${d.title} (${q.step + 1}/${d.steps.length})`, next: stepTarget(step, s.branch, s.day) });
  }
  const offers = questOffers(s).filter((o) => o.open).length;
  if (!items.length && !offers) return null;
  return (
    <div className="quest-tracker" onClick={onOpen} title="퀘스트 창 열기 (Q)">
      <div className="qt-head">📋 퀘스트 <kbd>Q</kbd>{slow && <span className="qt-slow">🐢 시간 ½</span>}</div>
      {items.slice(0, 4).map((it, i) => (
        <div key={i} className={`qt-item ${it.done ? 'done' : ''}`}>
          <div className="qt-title">{it.title}</div>
          <div className="qt-next">▶ {it.next}</div>
        </div>
      ))}
      {items.length > 4 && <div className="qt-more">외 {items.length - 4}개…</div>}
      {offers > 0 && <div className="qt-offers">📬 받을 수 있는 퀘스트 {offers}개 — 💬 표시된 사람에게 말 걸기</div>}
    </div>
  );
}

/** 퀘스트 창 (Q): 진행 중 퀘스트의 단계·목적지·보상, 완료 목록 */
export function QuestLog({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const ctx = { branch: s.branch, name: s.name, day: s.day };
  const slow = questSlowActive(s);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const mc = s.mealCheck;
  const offers = questOffers(s);
  const openOffers = offers.filter((o) => o.open);
  const hasActive = !!mc || !!s.patrol || s.quests.length > 0;
  const [tab, setTab] = useState<'story' | 'active' | 'offers' | 'chains'>(s.clues.length > 0 && nextStoryMission(s) ? 'story' : hasActive || !openOffers.length ? 'active' : 'offers');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="questlog" onClick={(e) => e.stopPropagation()}>
        <div className="ql-head">
          <div className="menu-title">📋 퀘스트</div>
          <button className="nb-close" onClick={onClose}>✕</button>
        </div>
        <div className="ql-tabs">
          {s.clues.length > 0 && <button className={tab === 'story' ? 'on' : ''} onClick={() => setTab('story')}>📖 스토리</button>}
          <button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>진행 중 ({s.quests.length + (mc ? 1 : 0) + (s.patrol ? 1 : 0)})</button>
          <button className={tab === 'offers' ? 'on' : ''} onClick={() => setTab('offers')}>📬 받을 수 있는 퀘스트 ({openOffers.length})</button>
          <button className={tab === 'chains' ? 'on' : ''} onClick={() => setTab('chains')}>🔗 연계 퀘스트</button>
        </div>
        {tab === 'story' && <StoryTab />}
        {tab === 'offers' && <OffersTab offers={offers} />}
        {tab === 'chains' && <ChainsTab offers={offers} />}
        {tab === 'active' && <div className="ql-body">
          <p className="hud-dim ql-hint">
            {slow ? '🐢 자유 시간에 퀘스트가 진행 중이라 시간이 절반 속도로 흐른다. ' : ''}
            ❗ 표시가 다음 목적지다. 다른 구역이면 길 끝 표지판을 따라가자.
          </p>
          {mc && (
            <div className="quest">
              <b>🍚 식사 집합</b> <span className="hud-dim">({mc.asked.length}/{mc.targets.length}{mc.status === 'asking' ? ` · ${fmtTime(mc.start + mealGatherMin())}까지` : ''})</span>
              <div>밥 먹으러 가기 전에 선임들께 "식사하러 가시겠습니까?" 여쭤보고, 다 모이면 같이 식당으로 간다.</div>
              <div className="ql-faces">{mc.targets.map((id) => <Face key={id} branch={s.branch} who={id} day={s.day} />)}</div>
              {(mc.by ?? 'me') === 'me' && <ul className="ql-steps">
                {mc.targets.map((id) => (
                  <li key={id} className={mc.asked.includes(id) ? 'done' : 'cur'}>
                    {mc.asked.includes(id) ? '✓' : '▶'} {memberFullName(s.branch, id, s.day)}께 여쭤보기{mc.asked.includes(id) ? ' — 막사 앞에서 대기 중' : ` · 📍 ${npcWhere(s.branch, id) ?? '위치 확인 중'}`}
                  </li>
                ))}
              </ul>}
              <div className="hud-dim">
                {mc.by === 'junior' ? `맞후임이 대신 여쭤봤다. 막사 앞에 모여 ${mc.marchAt != null ? fmtTime(mc.marchAt) : ''} 출발.` : mc.by === 'auto' ? '알아서 막사 앞에 모여 다 같이 간다.' : mc.status === 'together' ? '✅ 완료! 다 같이 식당으로.' : mc.status === 'missed' ? '❌ 시간 초과 — 생활관 인원끼리 모여 갔다. (눈치가 보인다)' : '보상: 군기 +2 · 멘탈 +1 · 선임 호감 +2씩'}
              </div>
            </div>
          )}
          {s.patrol && (
            <div className="quest">
              <b>🔦 야간 순찰 (막사 복도)</b> <span className="hud-dim">({s.patrol.done.length}/{PATROL_SPOTS.length} · 23:00까지)</span>
              <div>손전등을 들고 막사 1·2층 복도·세탁실·화장실을 점검한 뒤, 1층 지휘통제실 당직사관에게 보고하자. 장소 가까이 가면 자동으로 점검된다.</div>
              <div className="ql-faces"><span className="ql-face-label">보고</span><Face branch={s.branch} who="lt" day={s.day} /></div>
              <ul className="ql-steps">
                {PATROL_SPOTS.map((sp) => (
                  <li key={sp} className={s.patrol!.done.includes(sp) ? 'done' : 'cur'}>{s.patrol!.done.includes(sp) ? '✓' : '▶'} 📍 {spotLabel(s.branch, sp)}</li>
                ))}
                <li className={s.patrol.done.length >= PATROL_SPOTS.length ? 'cur' : ''}>○ 📍 막사 1층 지휘통제실 — 순찰 결과 보고</li>
              </ul>
              <div className="hud-dim">보상: 군기 +4 · 소대장 호감 +3 (23:00까지 못 마치면 군기 감소)</div>
            </div>
          )}
          {s.quests.length === 0 && !mc && !s.patrol && <p className="hud-dim">진행 중인 퀘스트가 없다. 선후임·간부와 대화하면 부탁을 받을 수 있다.</p>}
          {s.quests.map((q) => {
            const d = QUESTS[q.id];
            if (!d) return null;
            return (
              <div key={q.id} className="quest">
                <b>{d.title}</b> <ChainBadge questId={q.id} /> <span className="hud-dim">({q.step + 1}/{d.steps.length} · 의뢰: {NPC_SKINS[s.branch][d.giver].name})</span>
                <div className="ql-faces">
                  <span className="ql-face-label">의뢰</span><Face branch={s.branch} who={d.giver} day={s.day} />
                  {[...new Set(d.steps.filter((st) => st.npc && st.npc !== d.giver).map((st) => st.npc!))].map((n) => (
                    <span key={n} className="ql-face-wrap"><span className="ql-face-label">보고</span><Face branch={s.branch} who={n} day={s.day} /></span>
                  ))}
                </div>
                <div>{fmt(d.desc, ctx)}</div>
                <ul className="ql-steps">
                  {d.steps.map((st, i) => (
                    <li key={i} className={i < q.step ? 'done' : i === q.step ? 'cur' : ''}>
                      {i < q.step ? '✓' : i === q.step ? '▶' : '○'} {stepTarget(st, s.branch, s.day)}{st.minutes ? ` (${st.minutes}분)` : ''}
                    </li>
                  ))}
                </ul>
                <div className="hud-dim">보상: {rewardText(d.reward, s.branch)}</div>
              </div>
            );
          })}
          {s.doneQuests.length > 0 && (
            <p className="hud-dim">✅ 완료: {s.doneQuests.map((id) => QUESTS[id]?.title).filter(Boolean).join(', ')}</p>
          )}
        </div>}
        <div className="menu-foot">Q / Esc 닫기 · 받을 수 있는 퀘스트는 💬 표시된 사람에게 말을 걸면 "부탁 들어보기"로 바로 받을 수 있다</div>
      </div>
    </div>
  );
}

/** 받을 수 있는 퀘스트: 지금 받을 수 있는 것 → 조건이 남은 것 → 놓친 것 */
function OffersTab({ offers }: { offers: QuestOffer[] }) {
  const s = useGame();
  const ctx = { branch: s.branch, name: s.name, day: s.day };
  const groups: [string, QuestOffer[]][] = [
    ['지금 받을 수 있다', offers.filter((o) => o.open)],
    ['🔒 조건을 채우면 열린다', offers.filter((o) => !o.open && !o.missed)],
    ['놓친 부탁 (거절함)', offers.filter((o) => o.missed)],
  ];
  return (
    <div className="ql-body">
      {offers.length === 0 && <p className="hud-dim">지금은 새로 받을 수 있는 부탁이 없다.</p>}
      {groups.map(([title, list]) => list.length > 0 && (
        <div key={title}>
          <h4 className="ql-group">{title} ({list.length})</h4>
          {list.map((o) => {
            const d = QUESTS[o.questId];
            return (
              <div key={o.questId} className={`quest ${o.open ? 'offer-open' : 'offer-locked'}`}>
                <b>{d.title}</b> <ChainBadge questId={o.questId} />
                <div className="ql-faces">
                  <span className="ql-face-label">의뢰</span><Face branch={s.branch} who={o.giver} day={s.day} />
                  <span className="hud-dim">📍 {npcWhere(s.branch, o.giver) ?? '위치 확인 중'}</span>
                </div>
                <div>{fmt(d.desc, ctx)}</div>
                {!o.open && d.hint && <div className="ql-lock">🔒 조건: {d.hint}</div>}
                <div className="hud-dim">보상: {rewardText(d.reward, s.branch)}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 연계 퀘스트: 체인별 진행 상황 */
function ChainsTab({ offers }: { offers: QuestOffer[] }) {
  const s = useGame();
  return (
    <div className="ql-body">
      <p className="hud-dim ql-hint">앞 퀘스트를 끝내면 같은 사람에게서 다음 퀘스트를 받을 수 있다. 체인을 끝까지 마치면 보너스 보상!</p>
      {QUEST_CHAINS.map((ch) => {
        const doneN = ch.quests.filter((q) => s.doneQuests.includes(q)).length;
        return (
          <div key={ch.id} className="quest">
            <b>🔗 {ch.title}</b> <span className="hud-dim">({doneN}/{ch.quests.length})</span>
            <div className="ql-faces"><Face branch={s.branch} who={ch.giver} day={s.day} /><span className="hud-dim">{ch.desc}</span></div>
            <ul className="ql-steps">
              {ch.quests.map((qid) => {
                const done = s.doneQuests.includes(qid);
                const active = s.quests.some((x) => x.id === qid);
                const offer = offers.find((o) => o.questId === qid);
                const state = done ? ['done', '✓', '완료'] : active ? ['cur', '▶', '진행 중'] : offer?.open ? ['cur', '💬', '지금 받을 수 있음'] : offer?.missed ? ['', '✕', '놓침'] : ['', '🔒', QUESTS[qid].hint ?? '잠김'];
                return <li key={qid} className={state[0]}>{state[1]} {QUESTS[qid].title} — <span className="hud-dim">{state[2]}</span></li>;
              })}
            </ul>
            <div className="hud-dim">체인 보너스: {rewardText(ch.bonus, s.branch)}{doneN === ch.quests.length ? ' ✅ 받음' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

/** 메인 스토리 「별이 지기 전에」: 장별 미션 진행 상황 */
function StoryTab() {
  const s = useGame();
  const cur = CHAPTERS.find((c) => s.day >= c.days[0] && s.day <= c.days[1]) ?? CHAPTERS[0];
  return (
    <div className="ql-body">
      <div className="story-head">
        <b>📖 별이 지기 전에</b>
        <span className="hud-dim"> · 별 조각 {'★'.repeat(s.stars.length)}{'☆'.repeat(7 - s.stars.length)} · 🌟 기억 {s.memory} · 떡밥 {s.clues.length}/{CLUES.length}</span>
      </div>
      <p className="hud-dim ql-hint">별이 지기 전(12일차 밤)까지 부대 곳곳의 떡밥을 모아 인간으로 돌아갈 방법을 찾자. 지도(M)와 화면의 ✨ 표시가 단서가 있는 곳이다.</p>
      {CHAPTERS.map((ch) => {
        const ms = STORY_MISSIONS.filter((m) => m.chapter === ch.n);
        const future = s.day < ch.days[0];
        return (
          <div key={ch.n} className={`quest ${ch.n === cur.n ? 'offer-open' : ''}`}>
            <b>{ch.n}장 「{ch.title}」</b> <span className="hud-dim">({ch.days[0]}~{ch.days[1]}일차)</span>
            {ms.length === 0 ? (
              <div className="hud-dim">{future ? '🔒 아직 열리지 않았다.' : '🔒 다음 업데이트에서 이어집니다.'}</div>
            ) : (
              <ul className="ql-steps">
                {ms.map((m) => {
                  const st = missionState(m, s);
                  return (
                    <li key={m.id} className={st === 'done' ? 'done' : st === 'open' ? 'cur' : ''}>
                      {st === 'done' ? '✓' : st === 'open' ? '▶' : '🔒'} {m.title} — <span className="hud-dim">{st === 'done' ? '단서 획득' : st === 'open' ? m.hint : `${m.from}일차${m.nightFrom ? ' 밤' : ''}부터`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
