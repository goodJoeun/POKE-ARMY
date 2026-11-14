import type { BranchId, GameId, ScheduleEvent, SpotId } from '../types';
import { BRANCHES, TOTAL_DAYS } from './branches';
import { GATHER_MINUTES, useSettings } from '../state/settings';

type WorkGame = Exclude<GameId, 'overlock' | 'night'>;

const ROTATION: [WorkGame, WorkGame][] = [
  ['env', 'combat'],
  ['specialty', 'guard'],
  ['env', 'sandbag'],
  ['specialty', 'env'],
  ['guard', 'combat'],
  ['sandbag', 'specialty'],
];

export const GAME_SPOT: Record<WorkGame, SpotId> = {
  env: 'parade',
  combat: 'barracks',
  specialty: 'train',
  guard: 'post',
  sandbag: 'train',
};

/** 집합 허용 시간(분). 이 시간을 넘기면 지각 — 설정 메뉴에서 조절 */
export function gatherWindow(): number {
  return GATHER_MINUTES[useSettings.getState().gatherWindow];
}

export function hasNightDuty(day: number) {
  return day % 2 === 0 && day < TOTAL_DAYS;
}

export function buildSchedule(day: number, branch: BranchId): ScheduleEvent[] {
  const b = BRANCHES[branch];
  const W = gatherWindow();
  if (day >= TOTAL_DAYS) {
    return [
      { id: 'rollcall_am', kind: 'rollcall_am', label: '마지막 아침 점호', start: 6 * 60 + 15, window: W, end: 8 * 60, spot: 'parade' },
      { id: 'farewell', kind: 'farewell', label: '전역! 인사를 마치고 위병소로', start: 8 * 60, window: 99999, end: 18 * 60, spot: 'gate' },
    ];
  }
  const [am, pm] = ROTATION[(day - 1) % ROTATION.length];
  const events: ScheduleEvent[] = [
    { id: 'rollcall_am', kind: 'rollcall_am', label: '아침 점호', start: 6 * 60 + 15, window: W, end: 8 * 60, spot: 'parade' },
    { id: 'work_am', kind: 'work', label: `오전 일과: ${b.games[am]}`, start: 8 * 60 + 30, window: W, end: 12 * 60, spot: GAME_SPOT[am], game: am },
    { id: 'work_pm', kind: 'work', label: `오후 일과: ${b.games[pm]}`, start: 13 * 60, window: W, end: 17 * 60 + 30, spot: GAME_SPOT[pm], game: pm },
    { id: 'rollcall_pm', kind: 'rollcall_pm', label: '저녁 점호', start: 21 * 60 + 30, window: W, end: 22 * 60, spot: 'barracks' },
  ];
  if (hasNightDuty(day)) {
    events.push({ id: 'night', kind: 'night', label: '불침번 근무', start: 22 * 60, window: 0, end: 23 * 60, spot: null, game: 'night', auto: true });
  }
  return events;
}

export function isMealTime(min: number) {
  return (min >= 12 * 60 && min < 13 * 60) || (min >= 17 * 60 + 30 && min < 18 * 60 + 30);
}

export function isFreeTimeEvening(min: number) {
  return min >= 17 * 60 + 30 && min < 21 * 60 + 30;
}
