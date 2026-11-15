import type { BranchId, NpcId } from '../types';
import { BRANCHES, FACILITY_NAME, RANKS, STORE_NAME, rankIdxForDay } from '../data/branches';
import { NPC_SKINS, npcDisplayName, npcRoleTitle } from '../data/npcs';

export interface TextCtx {
  branch: BranchId;
  name: string;
  day: number;
}

export function fmt(text: string, c: TextCtx): string {
  const b = BRANCHES[c.branch];
  return text
    .replace(/\{S\}/g, b.salute)
    .replace(/\{me\}/g, c.name)
    .replace(/\{myrank\}/g, RANKS[rankIdxForDay(c.day)])
    .replace(/\{train\}/g, b.trainArea)
    .replace(/\{unit\}/g, b.unit)
    .replace(/\{wild\}/g, b.wildlife)
    .replace(/\{branch\}/g, b.name)
    .replace(/\{ammo\}/g, FACILITY_NAME[c.branch])
    .replace(/\{store\}/g, STORE_NAME[c.branch])
    .replace(/\{([nrt]):(\w+)\}/g, (_m, k: string, id: string) => {
      if (id === 'me') return c.name;
      const nid = id as NpcId;
      if (!NPC_SKINS[c.branch][nid]) return id;
      if (k === 'n') return NPC_SKINS[c.branch][nid].name;
      if (k === 'r') return npcDisplayName(c.branch, nid, c.day);
      return npcRoleTitle(c.branch, nid);
    });
}
