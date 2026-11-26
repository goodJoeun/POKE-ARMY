import type { BranchId, MonsterLook, NpcId } from '../types';
import { BRANCHES, RANKS, rankIdxForDay } from '../data/branches';
import { findSpecies } from '../data/monsters';
import { NPC_ROLES, NPC_SKINS, npcDisplayName, npcRoleTitle } from '../data/npcs';
import type { CapType } from './drawMonster';

export interface SpeakerInfo {
  name: string;
  sub: string;
  look: MonsterLook | null;
  cap: CapType;
  /** 아직 거울로 확인하지 못한 내 모습 (초상화를 물음표로) */
  unknown?: boolean;
}

export function npcCap(branch: BranchId, id: NpcId): CapType {
  const base = BRANCHES[branch].cap;
  return NPC_ROLES[id].officer ? (`officer-${base}` as CapType) : base;
}

export function npcSpeaker(branch: BranchId, id: NpcId, day: number): SpeakerInfo {
  const sk = NPC_SKINS[branch][id];
  return {
    name: npcDisplayName(branch, id, day),
    sub: `${npcRoleTitle(branch, id)} · ${sk.species}`,
    look: sk.look,
    cap: npcCap(branch, id),
  };
}

/** unseen: 1일차 거울을 보기 전이라 내가 무슨 포켓몬인지 아직 모른다 */
export function playerSpeaker(branch: BranchId, speciesId: string, name: string, day: number, unseen = false): SpeakerInfo {
  const sp = findSpecies(speciesId);
  return {
    name: `${RANKS[rankIdxForDay(day)]} ${name}`,
    sub: unseen ? '나 · ???' : sp ? `나 · ${sp.name}` : '나',
    look: sp?.look ?? null,
    cap: unseen ? null : BRANCHES[branch].cap,
    unknown: unseen,
  };
}
