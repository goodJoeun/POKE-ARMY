'use client';
import { useGame, spotLabel, fatigueOf } from '../state/store';
import { BRANCHES, RANKS, SEASON_LABEL, TOTAL_DAYS, fmtMoney, fmtTime, rankIdxForDay, seasonForDay, serviceMonth } from '../data/branches';
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

function Bar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{icon} {label}</span>
      <span className="stat-track">
        <span className="stat-fill" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="stat-val">{Math.round(value)}</span>
    </div>
  );
}

export default function Hud({ onNotebook, fast, onToggleFast }: { onNotebook: () => void; fast: boolean; onToggleFast: () => void }) {
  const s = useGame();
  const b = BRANCHES[s.branch];
  const rank = rankIdxForDay(s.day);
  const ev = s.currentEvent();
  const called = ev && !s.eventBegun && s.minute >= ev.start;
  const fatigue = fatigueOf(s.stats).reasons;
  let objective = '';
  if (ev) {
    if (ev.kind === 'farewell') objective = `🎊 모두에게 작별 인사 후 ${spotLabel(s.branch, 'gate')}으로!`;
    else if (called) objective = `📢 ${ev.label} → ${ev.spot ? spotLabel(s.branch, ev.spot) : ''} (${fmtTime(ev.start + ev.window)}까지)`;
    else objective = `⏭ ${fmtTime(ev.start)} ${ev.label}${ev.spot ? ` @ ${spotLabel(s.branch, ev.spot)}` : ''}`;
  }
  let period = '이동 시간';
  if (isMealTime(s.minute)) period = '식사 시간';
  if (isFreeTimeEvening(s.minute)) period = '개인정비 시간';
  if (s.minute < 6 * 60 + 30) period = '기상';
  if (s.minute >= 21 * 60 + 30) period = '점호/취침';

  return (
    <>
      <div className="hud-top">
        <div className="hud-box">
          <div className="hud-day">DAY {s.day}<span className="hud-dim">/{TOTAL_DAYS}</span></div>
          <div className="hud-dim">복무 {serviceMonth(s.day, s.branch)}개월차 · {SEASON_LABEL[seasonForDay(s.day)]}</div>
        </div>
        <div className="hud-box hud-clock">
          <div className="clock">{fmtTime(s.minute)}</div>
          <div className="hud-dim">{period}{fast ? ' · ⏩x5' : ''}</div>
        </div>
        <div className="hud-box hud-rank">
          <RankBadge rankIdx={rank} />
          <div>
            <div><b>{RANKS[rank]} {s.name}</b></div>
            <div className="hud-dim">{b.name} {b.unit}</div>
          </div>
        </div>
      </div>
      <div className="hud-left">
        <Bar label="체력" value={s.stats.hp} color="#e0584a" icon="❤️" />
        <Bar label="멘탈" value={s.stats.mental} color="#a070e0" icon="🧠" />
        <Bar label="군기" value={s.stats.discipline} color="#3a8fe0" icon="🎖️" />
        <Bar label="숙련" value={s.stats.skill} color="#e0a030" icon="🛠️" />
        <div className="stat money">💰 {fmtMoney(s.stats.money)}</div>
        {fatigue.length > 0 && <div className="fatigue-warn">😫 지침: 훈련 점수 {fatigue.join(', ')}</div>}
      </div>
      {objective && <div className={`hud-objective ${called ? 'urgent' : ''}`}>{objective}</div>}
      <div className="hud-buttons">
        <button onClick={onNotebook}>📒 수첩 <kbd>Tab</kbd></button>
        <button className={fast ? 'on' : ''} onClick={onToggleFast}>⏩ 빨리감기 <kbd>F</kbd></button>
      </div>
    </>
  );
}
