import type { BranchId, MonsterLook, NpcId } from '../types';
import { BRANCHES, RANKS, TOTAL_DAYS, rankIdxForDay } from './branches';

export interface NpcRoleDef {
  id: NpcId;
  role: string;
  officer: boolean;
  /** 병사: 플레이어보다 며칠(게임 내 일수) 먼저 입대했는지. 음수면 후임 */
  offset: number;
  officerRank?: string;
  personality: string;
}

export const NPC_ROLES: Record<NpcId, NpcRoleDef> = {
  sgt: { id: 'sgt', role: '분대장', officer: false, offset: 9, personality: '엄격하지만 속정 깊은 말년 병장' },
  senior: { id: 'senior', role: '맞선임', officer: false, offset: 6, personality: '장난기 많은 상병' },
  buddy: { id: 'buddy', role: '동기', officer: false, offset: 0, personality: '겁 많지만 착한 동기' },
  junior: { id: 'junior', role: '후임', officer: false, offset: -3, personality: '열정 넘치는 첫 후임' },
  junior2: { id: 'junior2', role: '후임', officer: false, offset: -6, personality: '질문 많은 막내' },
  lt: { id: 'lt', role: '소대장', officer: true, offset: 0, officerRank: '소위', personality: '의욕 넘치는 신임 소위' },
  sgm: { id: 'sgm', role: '행정보급관', officer: true, offset: 0, officerRank: '상사', personality: '작업을 사랑하는 베테랑' },
  cpt: { id: 'cpt', role: '중대장', officer: true, offset: 0, officerRank: '대위', personality: '원칙주의자 지휘관' },
};

export const NPC_IDS: NpcId[] = ['sgt', 'senior', 'buddy', 'junior', 'junior2', 'lt', 'sgm', 'cpt'];
export const SOLDIER_IDS: NpcId[] = ['sgt', 'senior', 'buddy', 'junior', 'junior2'];

interface NpcSkin {
  name: string;
  species: string;
  look: MonsterLook;
}

/**
 * NPC 포켓몬 (IP 사용 협의 완료). name = 포켓몬 이름(호칭), species = 타입 표기
 * 군별로 자유롭게 교체 가능. look.sprite 키는 public/sprites/manifest.json 과 연결된다.
 */
export const NPC_SKINS: Record<BranchId, Record<NpcId, NpcSkin>> = {
  army: {
    sgt: { name: '가디', species: '불꽃 타입', look: { sprite: 'growlithe', body: '#f2903a', belly: '#f8e8c0', accent: '#2a2a2a', shape: 'round', ears: 'pointy', tail: 'puff', eyes: 'dot', mouth: 'smile', extra: 'spots' } },
    senior: { name: '디그다', species: '땅 타입', look: { sprite: 'diglett', body: '#9a6a4a', belly: '#9a6a4a', accent: '#f28aa0', shape: 'tall', ears: 'none', tail: 'none', eyes: 'dot', mouth: 'smile' } },
    buddy: { name: '고라파덕', species: '물 타입', look: { sprite: 'psyduck', body: '#f2d24a', belly: '#f8e88a', accent: '#f2b040', shape: 'round', ears: 'tuft', tail: 'none', eyes: 'big', mouth: 'beak' } },
    junior: { name: '이브이', species: '노말 타입', look: { sprite: 'eevee', body: '#a87a4a', belly: '#f2e2c0', accent: '#f2e2c0', shape: 'round', ears: 'pointy', tail: 'puff', eyes: 'big', mouth: 'cat' } },
    junior2: { name: '토게피', species: '페어리 타입', look: { sprite: 'togepi', body: '#f8f2d8', belly: '#ffffff', accent: '#f2f2ea', shape: 'round', ears: 'tuft', tail: 'none', eyes: 'dot', mouth: 'smile', extra: 'shell' } },
    lt: { name: '윈디', species: '불꽃 타입', look: { sprite: 'arcanine', body: '#f2903a', belly: '#f8e8c0', accent: '#2a2a2a', shape: 'tall', ears: 'pointy', tail: 'puff', eyes: 'sharp', mouth: 'fang', extra: 'spots' } },
    sgm: { name: '괴력몬', species: '격투 타입', look: { sprite: 'machamp', body: '#8a98b0', belly: '#c8d0dc', accent: '#c84a4a', shape: 'wide', ears: 'horns', tail: 'none', eyes: 'sharp', mouth: 'smile' } },
    cpt: { name: '리자몽', species: '불꽃·비행 타입', look: { sprite: 'charizard', body: '#f2843a', belly: '#f8e0a0', accent: '#ff5a2a', shape: 'tall', ears: 'horns', tail: 'flame', wings: true, eyes: 'sharp', mouth: 'fang' } },
  },
  navy: {
    sgt: { name: '라프라스', species: '물·얼음 타입', look: { sprite: 'lapras', body: '#5a9ad8', belly: '#f2ead8', accent: '#9a9aa8', shape: 'wide', ears: 'horns', tail: 'none', eyes: 'sleepy', mouth: 'smile', extra: 'shell' } },
    senior: { name: '왕눈해', species: '물·독 타입', look: { sprite: 'tentacool', body: '#5ab0e8', belly: '#a8dcf8', accent: '#e04a6a', shape: 'round', ears: 'none', tail: 'none', eyes: 'dot', mouth: 'cat', extra: 'tentacles' } },
    buddy: { name: '잉어킹', species: '물 타입', look: { sprite: 'magikarp', body: '#e8603a', belly: '#f8e8c0', accent: '#f2d24a', shape: 'tall', ears: 'fin', tail: 'fin', eyes: 'big', mouth: 'smile' } },
    junior: { name: '마릴', species: '물·페어리 타입', look: { sprite: 'marill', body: '#5aa0e8', belly: '#ffffff', accent: '#5aa0e8', shape: 'round', ears: 'round', tail: 'puff', eyes: 'dot', mouth: 'smile', extra: 'cheeks' } },
    junior2: { name: '쏘드라', species: '물 타입', look: { sprite: 'horsea', body: '#6ab8e8', belly: '#f2e8b0', accent: '#6ab8e8', shape: 'tall', ears: 'fin', tail: 'spike', eyes: 'dot', mouth: 'beak' } },
    lt: { name: '쥬레곤', species: '물·얼음 타입', look: { sprite: 'dewgong', body: '#f2f2f8', belly: '#ffffff', accent: '#c8d0e0', shape: 'wide', ears: 'horns', tail: 'fin', eyes: 'sleepy', mouth: 'smile' } },
    sgm: { name: '야도란', species: '물·에스퍼 타입', look: { sprite: 'slowbro', body: '#f2a0b0', belly: '#f8e0c8', accent: '#9a9aa8', shape: 'wide', ears: 'round', tail: 'spike', eyes: 'sleepy', mouth: 'smile' } },
    cpt: { name: '갸라도스', species: '물·비행 타입', look: { sprite: 'gyarados', body: '#3a78c8', belly: '#f2e2a0', accent: '#f2f2f2', shape: 'tall', ears: 'fin', tail: 'fin', eyes: 'sharp', mouth: 'fang' } },
  },
  air: {
    sgt: { name: '파비코', species: '노말·비행 타입', look: { sprite: 'swablu', body: '#6ac8f0', belly: '#ffffff', accent: '#ffffff', shape: 'round', ears: 'tuft', tail: 'none', wings: true, eyes: 'dot', mouth: 'beak' } },
    senior: { name: '딜리버드', species: '얼음·비행 타입', look: { sprite: 'delibird', body: '#e04a4a', belly: '#ffffff', accent: '#f2f2f2', shape: 'tall', ears: 'none', tail: 'none', wings: true, eyes: 'dot', mouth: 'beak' } },
    buddy: { name: '주뱃', species: '독·비행 타입', look: { sprite: 'zubat', body: '#5a8ad8', belly: '#c890e0', accent: '#c890e0', shape: 'round', ears: 'pointy', tail: 'none', wings: true, eyes: 'sleepy', mouth: 'fang' } },
    junior: { name: '테일로', species: '노말·비행 타입', look: { sprite: 'taillow', body: '#2a3a5a', belly: '#f2f2f2', accent: '#e04a4a', shape: 'round', ears: 'none', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak', extra: 'cheeks' } },
    junior2: { name: '깨비참', species: '노말·비행 타입', look: { sprite: 'spearow', body: '#a87048', belly: '#f2d8b0', accent: '#e05a4a', shape: 'round', ears: 'feather', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' } },
    lt: { name: '스왈로', species: '노말·비행 타입', look: { sprite: 'swellow', body: '#2a3a5a', belly: '#f2f2f2', accent: '#e04a4a', shape: 'tall', ears: 'feather', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' } },
    sgm: { name: '깨비드릴조', species: '노말·비행 타입', look: { sprite: 'fearow', body: '#a0704a', belly: '#f2d8b0', accent: '#e05a4a', shape: 'tall', ears: 'feather', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' } },
    cpt: { name: '피죤투', species: '노말·비행 타입', look: { sprite: 'pidgeot', body: '#b08a5a', belly: '#f2e2c4', accent: '#e04a3a', shape: 'tall', ears: 'feather', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' } },
  },
};

export function npcRoleTitle(branch: BranchId, id: NpcId): string {
  if (id === 'cpt') return BRANCHES[branch].cptTitle;
  if (id === 'sgm') return BRANCHES[branch].sgmTitle;
  return NPC_ROLES[id].role;
}

export function arriveDay(id: NpcId): number {
  const r = NPC_ROLES[id];
  if (r.officer || r.offset >= 0) return 1;
  return 1 - r.offset;
}

export function leaveDay(id: NpcId): number {
  const r = NPC_ROLES[id];
  if (r.officer || r.offset <= 0) return TOTAL_DAYS + 1;
  return TOTAL_DAYS + 1 - r.offset;
}

export function npcPresent(id: NpcId, day: number): boolean {
  return day >= arriveDay(id) && day < leaveDay(id);
}

export function npcRank(id: NpcId, day: number): string {
  const r = NPC_ROLES[id];
  if (r.officer) {
    if (id === 'lt' && day >= 7) return '중위';
    return r.officerRank ?? '';
  }
  return RANKS[rankIdxForDay(day, r.offset)];
}

export function npcDisplayName(branch: BranchId, id: NpcId, day: number): string {
  return `${NPC_SKINS[branch][id].name} ${npcRank(id, day)}`;
}

/** 복도 게시판의 "이번 달 생일자" (하루 ≈ 1.5개월이라 날마다 바뀐다) */
export function birthdayNpcs(day: number): NpcId[] {
  return NPC_IDS.filter((id, i) => npcPresent(id, day) && (i * 7 + day) % 4 === 0);
}

/** 현재 생활관 분대장: 남아 있는 가장 고참 병사. 없으면 플레이어. */
export function currentSquadLeader(day: number): NpcId | 'me' {
  const order: NpcId[] = ['sgt', 'senior'];
  for (const id of order) if (npcPresent(id, day)) return id;
  return 'me';
}
