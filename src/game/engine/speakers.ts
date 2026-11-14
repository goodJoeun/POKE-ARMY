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

export function playerSpeaker(branch: BranchId, speciesId: string, name: string, day: number): SpeakerInfo {
  const sp = findSpecies(speciesId);
  return {
    name: `${RANKS[rankIdxForDay(day)]} ${name}`,
    sub: sp ? `나 · ${sp.name}` : '나',
    look: sp?.look ?? null,
    cap: BRANCHES[branch].cap,
  };
}
