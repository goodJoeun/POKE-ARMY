import type { BranchId, MonsterLook, NpcId } from '../types';
import { BRANCHES } from '../data/branches';
import { NPC_SKINS, npcDisplayName } from '../data/npcs';
import { EXTRAS, extraLook, extraTitleOnDay } from '../data/extras';
import { getWorld, type MapId } from './map';
import { runtime } from './runtime';
import { npcCap } from './speakers';
import type { CapType } from './drawMonster';

/** 군별 맵 표시 이름 (PX/BX, 탄약고/격납고/부두 등) */
export function mapName(branch: BranchId, id: MapId): string {
  return getWorld(branch, BRANCHES[branch].trainArea).maps[id]?.name ?? id;
}

/**
 * 부대원 키: 주요 NPC는 NpcId('sgt'), 엑스트라는 'x:<id>' ('x:sq1')
 * 퀘스트·식사 집합·지도에서 두 종류를 함께 다룬다.
 */
export function isExtraKey(key: string): boolean {
  return key.startsWith('x:');
}

/** 호칭 (짧게): "가디" / "홍수몬" */
export function memberName(branch: BranchId, key: string): string {
  if (isExtraKey(key)) return EXTRAS[branch].find((d) => d.id === key.slice(2))?.name ?? key;
  return NPC_SKINS[branch][key as NpcId]?.name ?? key;
}

/** 호칭 (계급 포함): "가디 병장" / "홍수몬 상병" */
export function memberFullName(branch: BranchId, key: string, day: number): string {
  if (isExtraKey(key)) {
    const d = EXTRAS[branch].find((e) => e.id === key.slice(2));
    if (!d) return key;
    const words = extraTitleOnDay(d, day).split(' ');
    return `${d.name} ${words[words.length - 1]}`;
  }
  return npcDisplayName(branch, key as NpcId, day);
}

/** 생김새 (퀘스트 창 초상화용) */
export function memberLook(branch: BranchId, key: string): { look: MonsterLook; cap: CapType } | null {
  if (isExtraKey(key)) {
    const d = EXTRAS[branch].find((e) => e.id === key.slice(2));
    if (!d) return null;
    const cap = (d.noCap ? null : d.officer ? `officer-${BRANCHES[branch].cap}` : BRANCHES[branch].cap) as CapType;
    return { look: extraLook(d), cap };
  }
  const sk = NPC_SKINS[branch][key as NpcId];
  return sk ? { look: sk.look, cap: npcCap(branch, key as NpcId) } : null;
}

/** 예상 위치: "1생활관" 또는 "막사 1층 → 병영식당 이동 중" */
export function npcWhere(branch: BranchId, key: string): string | null {
  const loc = runtime.npcLoc[key];
  if (!loc) return null;
  const here = mapName(branch, loc.map);
  return loc.dest !== loc.map ? `${here} → ${mapName(branch, loc.dest)} 이동 중` : here;
}
