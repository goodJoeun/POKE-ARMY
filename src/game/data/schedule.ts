import type { BranchId, GameId, ScheduleEvent, SpotId } from '../types';
import { BRANCHES, TOTAL_DAYS } from './branches';

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

/** 점심(~13:00)이 끝나고 오후 일과 집합까지 소화·이동 시간 */
export const PM_WORK_START = 13 * 60 + 30;
/** 저녁 점호(~22:00)가 끝나고 야간 위병소 근무 집합까지 이동 시간 */
export const NIGHT_GUARD_START = 22 * 60 + 15;

/** 불침번(생활관 야간 근무)이 있는 날 */
export function hasNightDuty(day: number) {
  return day % 2 === 0 && day < TOTAL_DAYS;
}
/** 야간 위병소 근무가 있는 날 */
export function hasGuardNight(day: number) {
  return !hasNightDuty(day) && day >= 3 && day % 4 === 3 && day < TOTAL_DAYS;
}

export function buildSchedule(day: number, branch: BranchId): ScheduleEvent[] {
  const b = BRANCHES[branch];
  if (day >= TOTAL_DAYS) {
    return [
      { id: 'rollcall_am', kind: 'rollcall_am', label: '마지막 아침 점호', start: 6 * 60 + 15, end: 8 * 60, spot: 'parade' },
      { id: 'farewell', kind: 'farewell', label: '전역! 인사를 마치고 위병소로', start: 8 * 60, end: 18 * 60, spot: 'gate' },
    ];
  }
  const [am, pm] = ROTATION[(day - 1) % ROTATION.length];
  const events: ScheduleEvent[] = [
    { id: 'rollcall_am', kind: 'rollcall_am', label: '아침 점호', start: 6 * 60 + 15, end: 8 * 60, spot: 'parade' },
    { id: 'work_am', kind: 'work', label: `오전 일과: ${b.games[am]}`, start: 8 * 60 + 30, end: 12 * 60, spot: GAME_SPOT[am], game: am },
    { id: 'work_pm', kind: 'work', label: `오후 일과: ${b.games[pm]}`, start: PM_WORK_START, end: 17 * 60 + 30, spot: GAME_SPOT[pm], game: pm },
    { id: 'rollcall_pm', kind: 'rollcall_pm', label: '저녁 점호', start: 21 * 60 + 30, end: 22 * 60, spot: 'barracks' },
  ];
  if (hasNightDuty(day)) {
    // 불침번: 소등 후 자다가 00:00 이전 근무자가 깨운다 → 00:50 다음 근무자를 깨워 교대
    events.push({ id: 'night', kind: 'night', label: '불침번 근무 (00:00~01:00)', start: 22 * 60, end: 25 * 60, spot: null, game: 'night', auto: true });
  } else if (hasGuardNight(day)) {
    // 야간 위병소 근무: 자다가 사수·부사수가 조용히 깨운다 → 같이 위병소로 → 00:00~02:00 경계근무
    events.push({ id: 'guard_night', kind: 'night', label: '야간 위병소 근무 (00:00~02:00)', start: 22 * 60, end: 26 * 60, spot: null, game: 'guard', auto: true });
  } else if (day >= 5 && day % 4 === 1) {
    // 야간 순찰: 점호 후 막사 1·2층 복도를 돌며 점검하고 당직사관에게 보고
    events.push({ id: 'patrol', kind: 'patrol', label: '야간 순찰 (막사 복도)', start: 22 * 60, end: 23 * 60, spot: null, auto: true });
  }
  return events;
}

/**
 * 일과가 끝난 자리에서 분대장 인솔로 곧장 식당에 가는 끼니 (생활관에 모였다 가는 날과 번갈아 나온다).
 * 1일차 점심은 생활관 집합부터 배우고, 그날 저녁은 일과 장소에서 바로 간다.
 */
export function mealFromWork(day: number, meal: 'lunch' | 'dinner') {
  return (day + (meal === 'dinner' ? 1 : 0)) % 2 === 0;
}

export function isMealTime(min: number) {
  return (min >= 12 * 60 && min < 13 * 60) || (min >= 17 * 60 + 30 && min < 18 * 60 + 30);
}

export function isFreeTimeEvening(min: number) {
  return min >= 17 * 60 + 30 && min < 21 * 60 + 30;
}
