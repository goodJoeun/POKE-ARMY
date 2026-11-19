'use client';
import { useGame, spotLabel, type NightDuty } from '../state/store';
import { memberName } from '../engine/whereabouts';
import { fixJosa } from '../engine/text';
import { useSettings } from '../state/settings';
import { BRANCHES, RANKS, SEASON_LABEL, TOTAL_DAYS, fmtTime, rankIdxForDay, seasonForDay, serviceMonth } from '../data/branches';
import { isFreeTimeEvening, isMealTime } from '../data/schedule';

export function RankBadge({ rankIdx, size = 22 }: { rankIdx: number; size?: number }) {
  return (
    <span className="rank-badge" style={{ height: size, width: size * 0.9 }} title={RANKS[rankIdx]}>
      {Array.from({ length: rankIdx + 1 }).map((_, i) => (
        <span key={i} className="rank-bar" />
      ))}
    </span>
  );
}

/** 야간 근무 중 상단 안내: 지금 단계에서 해야 할 일 */
function nightObjective(nd: NightDuty, branch: Parameters<typeof memberName>[0]): string {
  const watch = nd.kind === 'watch';
  const who = (k: string | null) => (k ? memberName(branch, k) : '근무자');
  switch (nd.phase) {
    case 'sleep': return '💤 취침 중…';
    case 'woken': return watch ? '🔦 불침번 인수인계 중' : '🌙 위병소 근무 준비 중';
    case 'toPost': return `🌙 ${who(nd.partner)}과(와) 함께 ${spotLabel(branch, 'post')}(으)로 → 00:00 교대`;
    case 'shift': return watch ? '🔦 불침번 근무 중 (00:00~01:00)' : '🔦 위병소 경계근무 중 (00:00~02:00)';
    case 'wakeNext': return `🔦 다음 근무자 ${who(nd.next)}을(를) 깨워 교대 (01:00 전까지)`;
    case 'return': return watch
      ? '🛏️ 교대 완료 — 내 침상으로 돌아가 자자'
      : `🛏️ ${who(nd.partner)}과(와) 함께 생활관으로 복귀해 취침`;
  }
}

export default function Hud({ onNotebook, onQuests, onMap, onHome }: { onNotebook: () => void; onQuests: () => void; onMap: () => void; onHome: () => void }) {
  const s = useGame();
  const b = BRANCHES[s.branch];
  const rank = rankIdxForDay(s.day);
  const ev = s.currentEvent();
  // 다음 일정: 시간은 장소에 도착해야 넘어간다 (자유 시간이 30분 넘게 남았으면 장소에서 E로 시작)
  const pending = ev && !s.eventBegun && !ev.auto ? ev : null;
  const freeTime = !!pending && pending.start - s.minute > 30;
  const called = !!pending && !freeTime;
  let objective = '';
  if (s.nightDuty) objective = fixJosa(nightObjective(s.nightDuty, s.branch));
  else if (ev) {
    if (ev.kind === 'farewell') objective = `🎊 모두에게 작별 인사 후 ${spotLabel(s.branch, 'gate')}으로!`;
    else if (ev.kind === 'patrol' && s.patrol) objective = `🔦 야간 순찰 ${s.patrol.done.length}/6 — 막사 1·2층 복도·세탁실·화장실 점검 후 지휘통제실 보고 (23:00까지)`;
    else if (pending && ev.spot && freeTime)
      objective = `🕊️ 자유 시간 — 준비되면 ${spotLabel(s.branch, ev.spot)}에서 ${fmtTime(ev.start)} ${ev.label} 시작 (E)`;
    else if (pending && ev.spot)
      objective = `📍 ${ev.label} → ${spotLabel(s.branch, ev.spot)} (도착하면 ${fmtTime(ev.start)} 시작)`;
  }
  // 🍚 식사는 분대 단위: 분대와 먹고 돌아오기 전에는 다음 일정이 진행되지 않는다
  if (s.mealCheck && !s.mealCheck.done && !s.nightDuty)
    objective = '🍚 식사 시간 — 먼저 1생활관에 들러 분대와 함께 식당으로';
  let period = '이동 시간';
  if (isMealTime(s.minute)) period = '식사 시간';
  if (isFreeTimeEvening(s.minute)) period = '개인정비 시간';
  if (s.minute < 6 * 60 + 30) period = '기상';
  if (s.minute >= 21 * 60 + 30) period = '점호/취침';
  if (s.nightDuty && s.nightDuty.phase !== 'sleep') period = s.nightDuty.kind === 'watch' ? '불침번' : '경계근무';

  return (
    <>
      <div className="hud-top">
        <div className="hud-box">
          <div className="hud-day">DAY {s.day}<span className="hud-dim">/{TOTAL_DAYS}</span></div>
          <div className="hud-dim">복무 {serviceMonth(s.day, s.branch)}개월차 · {SEASON_LABEL[seasonForDay(s.day)]}</div>
        </div>
        <div className="hud-box hud-clock">
          <div className="clock">{fmtTime(s.minute)}</div>
          <div className="hud-dim">{period}</div>
        </div>
        {s.clues.length > 0 && (
          <div className={`hud-box hud-memory ${s.memory <= 30 ? 'low' : ''}`} title="인간의 기억 (0이 되면 배드 엔딩)">
            <div>🌟 기억 <b>{Math.round(s.memory)}</b></div>
            <span className="stat-track"><span className="stat-fill" style={{ width: `${s.memory}%` }} /></span>
          </div>
        )}
        <div className="hud-box hud-rank">
          <RankBadge rankIdx={rank} />
          <div>
            <div><b>{RANKS[rank]} {s.name}</b></div>
            <div className="hud-dim">{b.name} {b.unit}</div>
          </div>
        </div>
      </div>
      {objective && <div className={`hud-objective ${called ? 'urgent' : ''}`}>{objective}</div>}
      <div className="hud-buttons">
        <button onClick={onHome}>🏠 생활관 <kbd>R</kbd></button>
        <button onClick={onMap}>🗺️ 지도 <kbd>M</kbd></button>
        <button onClick={onQuests}>📋 퀘스트 <kbd>Q</kbd></button>
        <button onClick={onNotebook}>📒 수첩 <kbd>Tab</kbd></button>
        <button onClick={() => useSettings.getState().openMenu()}>⚙️ 설정 <kbd>Esc</kbd></button>
      </div>
    </>
  );
}
