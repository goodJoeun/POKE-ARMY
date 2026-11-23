import type { BranchId, NpcId } from '../types';
import { TOTAL_DAYS } from './branches';
import { NPC_ROLES, npcPresent } from './npcs';
import { extrasForDay } from './extras';

/**
 * 😴 아침 기상: 기상 방송이 나오면 분대 전원이 생활관에서 함께 일어난다 (계급이 낮을수록 칼같이).
 * 다만 짬이 찬 선임은 가끔 못 일어난다. 그런 날엔 내가 침상 옆에 가서 깨워 드려야 분대가 점호에 나갈 수 있다.
 * 날짜 → 그날 못 일어나는 선임 (주요 인물은 NpcId, 엑스트라는 'x:<id>'). 그 사람이 전역해 없으면 그날은 다 같이 일어난다.
 */
export const SLEEPY_SENIOR: Record<number, string> = {
  2: 'sgt', // 말년 병장 분대장
  5: 'senior', // 새로 분대장을 맡은 맞선임
  6: 'x:sq1', // 전역을 앞둔 1분대 선임
};
/** 오늘 늦잠 자는 선임을 깨웠다 (daily 키) · 기상 직후의 안내 장면을 봤다 (daily 키) */
export const WOKE_SENIOR = 'wokeSenior';
export const SLEEPY_SEEN = 'sleepySeen';

interface Morning {
  branch: BranchId;
  day: number;
  daily: string[];
  eventIdx: number;
  eventBegun: boolean;
  rollcall: unknown;
  nightDuty: unknown;
}

/** 지금 침상에서 아직 자고 있는 선임 (없으면 null). 아침 점호가 시작되기 전, 내가 깨우기 전까지만 */
export function sleepySenior(s: Morning): string | null {
  if (s.day <= 1 || s.day >= TOTAL_DAYS) return null;
  // 아침 점호(그날 첫 일정)를 기다리는 동안에만
  if (s.eventIdx !== 0 || s.eventBegun || s.rollcall || s.nightDuty) return null;
  if (s.daily.includes(WOKE_SENIOR)) return null;
  const key = SLEEPY_SENIOR[s.day];
  if (!key) return null;
  if (key.startsWith('x:')) {
    const def = extrasForDay(s.branch, s.day).find((d) => d.id === key.slice(2));
    return def?.squad1Senior ? key : null;
  }
  const role = NPC_ROLES[key as NpcId];
  return role && !role.officer && role.offset > 0 && npcPresent(key as NpcId, s.day) ? key : null;
}
