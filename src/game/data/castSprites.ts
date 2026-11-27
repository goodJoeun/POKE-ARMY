import type { BranchId } from '../types';
import { preloadSprites } from '../engine/sprites';
import { extrasForDay } from './extras';
import { findSpecies } from './monsters';
import { NPC_SKINS } from './npcs';
import { PUZZLES } from './puzzles';
import { PERSONALITY_QUIZ } from './quiz';

/**
 * 🖼️ 곧 화면에 나올 포켓몬의 그림을 미리 받아 둔다.
 * 그림은 그리려는 순간에만 받으므로(engine/sprites.ts), 아무것도 해 두지 않으면 처음 나올 때 임시 그림이 잠깐 비친다.
 * 그래서 군이 정해진 뒤부터 그 군에서 실제로 만날 얼굴만 앞당겨 받는다. 다른 군의 그림 · 쓰지 않는 그림은 받지 않는다.
 */

/** 이야기에만 나오는 얼굴 (슬리퍼 · 팬텀 · 화강돌 · 지라치 · 안농): 주요 인물도 엑스트라도 아니다 */
const STORY_FIGURES = ['hypno', 'gengar', 'spiritomb', 'jirachi', 'unown'];

/** 퍼즐 지문 옆에 서는 포켓몬 (한 마리면 큰 그림, 여럿이면 걷는 그림) */
const PUZZLE_CAST = [...new Set(Object.values(PUZZLES).flatMap((p) => p.cast?.map((c) => c.sprite) ?? []))];

/** 오프닝 문답: 질문마다 꿈이 보여 주는 포켓몬들 (큰 그림) */
export function preloadQuizCast(branch: BranchId) {
  const keys = PERSONALITY_QUIZ.flatMap((q) => q.vision.cast.map((c) => c.sprite ?? (c.npc ? NPC_SKINS[branch][c.npc].look.sprite : undefined)));
  preloadSprites(keys, ['front']);
}

/** 부대: 나 · 주요 인물 · 오늘 부대에 있는 엑스트라 · 퍼즐과 이야기에 나오는 얼굴의 걷는 그림과 초상화 */
export function preloadUnitCast(branch: BranchId, day: number, speciesId: string) {
  const keys = [
    findSpecies(speciesId)?.look.sprite,
    ...Object.values(NPC_SKINS[branch]).map((n) => n.look.sprite),
    ...extrasForDay(branch, day).map((d) => d.sprite),
    ...PUZZLE_CAST,
    ...STORY_FIGURES,
  ];
  // 'follower' = 필드에서 걷는 그림 (시트가 없으면 아이콘), 'front' = 대화 초상화 · 큰 그림
  preloadSprites(keys, ['follower', 'front']);
}
