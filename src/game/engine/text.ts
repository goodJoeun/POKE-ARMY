import type { BranchId, NpcId } from '../types';
import { BRANCHES, FACILITY_NAME, RANKS, STORE_NAME, rankIdxForDay } from '../data/branches';
import { NPC_SKINS, npcDisplayName, npcRoleTitle } from '../data/npcs';

export interface TextCtx {
  branch: BranchId;
  name: string;
  day: number;
}

/**
 * "리뷰어은(는)" 같은 겹친 조사를 앞 글자의 받침에 맞게 하나로 고른다.
 * 은(는) · 이(가) · 을(를) · 과(와) · 와(과) · (으)로. 앞 글자가 한글이 아니면 그대로 둔다.
 */
export function fixJosa(text: string): string {
  return text.replace(/([가-힣])(은\(는\)|는\(은\)|이\(가\)|가\(이\)|을\(를\)|를\(을\)|과\(와\)|와\(과\)|\(으\)로)/g, (_m, ch: string, pat: string) => {
    const jong = (ch.charCodeAt(0) - 0xac00) % 28;
    const has = jong !== 0;
    if (pat === '(으)로') return ch + (has && jong !== 8 ? '으로' : '로');
    const pair: Record<string, [string, string]> = {
      '은(는)': ['은', '는'], '는(은)': ['은', '는'], '이(가)': ['이', '가'], '가(이)': ['이', '가'],
      '을(를)': ['을', '를'], '를(을)': ['을', '를'], '과(와)': ['과', '와'], '와(과)': ['과', '와'],
    };
    const [withB, noB] = pair[pat];
    return ch + (has ? withB : noB);
  });
}

export function fmt(text: string, c: TextCtx): string {
  return fixJosa(fmtRaw(text, c));
}

function fmtRaw(text: string, c: TextCtx): string {
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
