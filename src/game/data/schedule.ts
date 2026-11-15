import type { BranchId, GameId, ScheduleEvent, SpotId } from '../types';
import { BRANCHES, TOTAL_DAYS } from './branches';
import { GATHER_MINUTES, MS_PER_MINUTE, useSettings } from '../state/settings';

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

/**
 * 시간 속도 보정: 시간이 빨리 흐를수록 같은 거리를 걷는 동안 게임 시간이 더 지나간다.
 * 집합·미션 제한 시간에 곱해서, 실제로 걸을 수 있는 시간을 "보통" 속도 이상으로 보장한다.
 */
export function timeScale(): number {
  return Math.max(1, 1000 / MS_PER_MINUTE[useSettings.getState().timeSpeed]);
}

/** 막사·식당에서 멀리 떨어진 집합 장소 (위병소·훈련장 구역): 이동 여유를 더 준다 */
const FAR_SPOTS = new Set<SpotId>(['train', 'post', 'gate']);
const FAR_EXTRA = 10;

/** 일정별 집합 허용 시간 = (설정값 + 먼 장소 여유) × 시간 속도 보정 */
export function windowFor(spot: SpotId | null): number {
  return Math.ceil((gatherWindow() + (spot && FAR_SPOTS.has(spot) ? FAR_EXTRA : 0)) * timeScale());
}

/** 점심(~13:00)이 끝나고 오후 일과 집합까지 소화·이동 시간 */
export const PM_WORK_START = 13 * 60 + 30;
/** 저녁 점호(~22:00)가 끝나고 야간 위병소 근무 집합까지 이동 시간 */
export const NIGHT_GUARD_START = 22 * 60 + 15;

/** 식사 집합 미션 제한 시간 (식사 시작부터) */
export function mealGatherMinutes(): number {
  // 시간이 빠를수록 늘려 주되, 모여서 식당까지 걸어가 먹을 시간은 남긴다
  return Math.min(30, Math.ceil(25 * timeScale()));
}

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
      { id: 'rollcall_am', kind: 'rollcall_am', label: '마지막 아침 점호', start: 6 * 60 + 15, window: windowFor('parade'), end: 8 * 60, spot: 'parade' },
      { id: 'farewell', kind: 'farewell', label: '전역! 인사를 마치고 위병소로', start: 8 * 60, window: 99999, end: 18 * 60, spot: 'gate' },
    ];
  }
  const [am, pm] = ROTATION[(day - 1) % ROTATION.length];
  const events: ScheduleEvent[] = [
    { id: 'rollcall_am', kind: 'rollcall_am', label: '아침 점호', start: 6 * 60 + 15, window: windowFor('parade'), end: 8 * 60, spot: 'parade' },
    { id: 'work_am', kind: 'work', label: `오전 일과: ${b.games[am]}`, start: 8 * 60 + 30, window: windowFor(GAME_SPOT[am]), end: 12 * 60, spot: GAME_SPOT[am], game: am },
    { id: 'work_pm', kind: 'work', label: `오후 일과: ${b.games[pm]}`, start: PM_WORK_START, window: windowFor(GAME_SPOT[pm]), end: 17 * 60 + 30, spot: GAME_SPOT[pm], game: pm },
    { id: 'rollcall_pm', kind: 'rollcall_pm', label: '저녁 점호', start: 21 * 60 + 30, window: windowFor('barracks'), end: 22 * 60, spot: 'barracks' },
  ];
  if (hasNightDuty(day)) {
    // 불침번: 소등 후 자다가 00:00 이전 근무자가 깨운다 → 00:50 다음 근무자를 깨워 교대
    events.push({ id: 'night', kind: 'night', label: '불침번 근무 (00:00~01:00)', start: 22 * 60, window: 0, end: 25 * 60, spot: null, game: 'night', auto: true });
  } else if (hasGuardNight(day)) {
    // 야간 위병소 근무: 자다가 사수·부사수가 조용히 깨운다 → 같이 위병소로 → 00:00~02:00 경계근무
    events.push({ id: 'guard_night', kind: 'night', label: '야간 위병소 근무 (00:00~02:00)', start: 22 * 60, window: 0, end: 26 * 60, spot: null, game: 'guard', auto: true });
  } else if (day >= 5 && day % 4 === 1) {
    // 야간 순찰: 점호 후 막사 1·2층 복도를 돌며 점검하고 당직사관에게 보고
    events.push({ id: 'patrol', kind: 'patrol', label: '야간 순찰 (막사 복도)', start: 22 * 60, window: 0, end: 23 * 60, spot: null, auto: true });
  }
  return events;
}

export function isMealTime(min: number) {
  return (min >= 12 * 60 && min < 13 * 60) || (min >= 17 * 60 + 30 && min < 18 * 60 + 30);
}

export function isFreeTimeEvening(min: number) {
  return min >= 17 * 60 + 30 && min < 21 * 60 + 30;
}
