import type { BranchId } from '../types';
import { MAP_NAMES, getWorld, type MapId } from '../engine/map';
import { BRANCHES } from './branches';
import { npcDisplayName, npcPresent } from './npcs';
import { DUTY_BOARD, ORDERS, type Stage } from './orders';
import { STORY_MISSIONS, missionState } from './story';

/**
 * 🧭 지금 꼭 가야 하는 곳 (호출 · 심부름 · 보고 · 첫날 세면).
 * 가야 할 곳이 있는 동안에는 그쪽으로 가는 문만 열려 있고(다른 문 앞에서는 발이 멈춘다),
 * 상단 안내와 ❗ 표시가 그곳을 가리킨다. 화면이 대신 옮겨 주지 않는다: 내가 직접 걸어간다.
 */
export interface Errand {
  kind: 'mirror' | 'summon' | 'errand' | 'report';
  /** 스토리 미션 ID (mirror 제외) */
  id?: string;
  map: MapId;
  x: number;
  y: number;
  /** 다른 문 앞에서 멈췄을 때 떠올리는 혼잣말 */
  why: string;
  /** 상단 안내 한 줄 */
  hud: string;
}

interface Progress {
  branch: BranchId;
  day: number;
  minute: number;
  clues: string[];
  flags: Record<string, boolean>;
  nightDuty: unknown;
  patrol: unknown;
  rollcall: unknown;
  work: unknown;
  mealCheck: { done: boolean } | null;
}

/** 1일차, 화장실 거울을 보기 전: 내가 무슨 포켓몬이 됐는지 아직 모른다 → 내 모습은 물음표로 보인다 */
export const selfUnseen = (s: { day: number; flags: Record<string, boolean> }) =>
  s.day === 1 && !s.flags.sawSelf && !s.flags.tutorial;
/** 전입 다음 날 아침(1일차): 분대장이 세수하고 오라고 했다 → 1층 화장실 세면대 거울에서 내 모습을 확인한다 */
export const mirrorPending = (s: { day: number; flags: Record<string, boolean> }) =>
  !!s.flags.wokeUp && selfUnseen(s);
/** 거울을 본 뒤: 생활관으로 돌아가면 맞선임이 정신 차리라고 한마디 한다 */
export const wakeTalkPending = (s: { day: number; flags: Record<string, boolean> }) =>
  s.day === 1 && !!s.flags.sawSelf && !s.flags.wakeTalk && !s.flags.tutorial;
/** 생활관에서 맞선임이 기다리는 자리 */
export const WAKE_TALK_AT: [number, number] = [8.5, 4.5];

/** 명령을 받는 자리 (시킨 사람이 전역해 없으면 생활관 당번표 앞) */
export const orderStage = (id: string, day: number): Stage => (npcPresent(ORDERS[id].giver, day) ? ORDERS[id].orderAt : DUTY_BOARD);
/** 보고하는 자리 */
export const reportStage = (id: string, day: number): Stage => (npcPresent(ORDERS[id].giver, day) ? ORDERS[id].reportAt : DUTY_BOARD);

export function errandNow(s: Progress): Errand | null {
  if (s.nightDuty || s.patrol || s.rollcall || s.work) return null;
  const spots = getWorld(s.branch, BRANCHES[s.branch].trainArea).spots;
  if (mirrorPending(s)) {
    const sp = spots.wc1;
    return {
      kind: 'mirror', map: sp.map, x: sp.x + 0.5, y: sp.y + 0.5,
      why: '(…일단 화장실부터. 세수하고 정신 좀 차리자.)',
      hud: '🚿 1층 화장실 세면대에서 세수하고 정신 차리기 (1생활관 → 복도 → 화장실)',
    };
  }
  if (wakeTalkPending(s)) {
    return {
      kind: 'mirror', map: 'room1', x: WAKE_TALK_AT[0], y: WAKE_TALK_AT[1],
      why: '(분대장님이 3분 준다고 했다. 일단 생활관으로 돌아가자.)',
      hud: '🏃 세수 끝 — 1생활관으로 돌아가기',
    };
  }
  if (s.clues.length === 0) return null;
  // 📋 보고: 일을 마쳤으면 시킨 사람에게 돌아가 보고한다
  for (const id of Object.keys(ORDERS)) {
    if (!s.flags[`toReport_${id}`] || s.flags[`report_${id}`]) continue;
    const present = npcPresent(ORDERS[id].giver, s.day);
    const at = reportStage(id, s.day);
    const who = present ? npcDisplayName(s.branch, ORDERS[id].giver, s.day) : '당번표';
    return {
      kind: 'report', id, map: at.map, x: at.giver[0], y: at.giver[1],
      why: present ? `(일을 마쳤으니 ${who}님께 보고부터 하자.)` : '(일을 마쳤으니 생활관 당번표에 적어 두자.)',
      hud: present ? `📋 임무 완료 — ${MAP_NAMES[at.map]}의 ${who}에게 보고하러 가기` : '📋 임무 완료 — 1생활관 당번표에 적으러 가기',
    };
  }
  for (const m of STORY_MISSIONS) {
    const o = ORDERS[m.id];
    if (!o || missionState(m, s) !== 'open') continue;
    // 📢 호출: 부른 사람이 있는 곳으로 간다
    if (s.flags[`summon_${m.id}`] && !s.flags[`order_${m.id}`]) {
      const present = npcPresent(o.giver, s.day);
      const at = orderStage(m.id, s.day);
      const who = present ? npcDisplayName(s.branch, o.giver, s.day) : '';
      return {
        kind: 'summon', id: m.id, map: at.map, x: at.giver[0], y: at.giver[1],
        why: present ? `(${who}님이 부르셨다. 먼저 ${MAP_NAMES[at.map]}에 가 보자.)` : '(당번표에 내 이름이 적혔다고 했다. 먼저 생활관에 가 보자.)',
        hud: present ? `📢 호출 — ${MAP_NAMES[at.map]}의 ${who}에게 가기` : '📢 1생활관 문 옆 당번표 확인하기',
      };
    }
    // 🏃 심부름: 시킨 곳에 닿을 때까지는 곧장 그리로 (식사 집합이 걸려 있으면 밥부터)
    if (o.errand && m.spot && s.flags[`order_${m.id}`] && !s.flags[`at_${m.id}`] && !(s.mealCheck && !s.mealCheck.done)) {
      const sp = spots[m.spot];
      return {
        kind: 'errand', id: m.id, map: sp.map, x: sp.x + 0.5, y: sp.y + 0.5,
        why: `(시킨 일부터 하자. ${MAP_NAMES[sp.map]}에 가야 한다.)`,
        hud: `📋 ${o.brief}`,
      };
    }
  }
  return null;
}
