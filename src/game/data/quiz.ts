import type { Archetype, NpcId } from '../types';
import type { Dir } from '../engine/drawMonster';

/** 질문마다 꿈이 보여 주는 장면 (SceneryCanvas 그림 이름) */
export type QuizVisionScene = 'quizTrip' | 'quizProject' | 'quizParty' | 'quizCounter' | 'quizWeekend' | 'quizGate';

/**
 * 장면에 나오는 포켓몬. sprite는 NPC 외형(NPC_SKINS)에서 찾는다.
 * npc를 주면 플레이어가 고른 군의 그 NPC가 모자를 쓰고 나온다 (내일 만날 얼굴).
 */
export interface QuizCast {
  sprite?: string;
  npc?: NpcId;
  dir?: Dir;
  /** 머리 위 말풍선 (이모지 한두 글자) */
  emote?: string;
  /** 기본 크기 대비 배율 (큰 포켓몬) */
  scale?: number;
}

export interface QuizQuestion {
  q: string;
  options: { text: string; type: Archetype }[];
  vision: { scene: QuizVisionScene; cast: QuizCast[] };
}

/** 변신 전, 꿈속의 목소리가 묻는 성격 분석 질문 */
export const PERSONALITY_QUIZ: QuizQuestion[] = [
  {
    q: '친구들과 여행 계획을 세운다. 당신의 역할은?',
    vision: { scene: 'quizTrip', cast: [{ sprite: 'eevee', dir: 'right', emote: '🗺️' }, { sprite: 'marill', emote: '🎵' }, { sprite: 'swablu', dir: 'left', emote: '✈️' }] },
    options: [
      { text: '"내가 일정 짤게, 따라와!" 총대를 멘다', type: 'leader' },
      { text: '숙소·교통·맛집을 엑셀로 정리한다', type: 'diligent' },
      { text: '단톡방 분위기 담당. 일단 웃기고 본다', type: 'social' },
    ],
  },
  {
    q: '조별 과제에서 한 명이 연락 두절됐다.',
    vision: { scene: 'quizProject', cast: [{ sprite: 'psyduck', dir: 'right', emote: '💦' }, { sprite: 'slowbro', dir: 'left', emote: '💤', scale: 1.1 }] },
    options: [
      { text: '역할을 다시 나누고 마감까지 끌고 간다', type: 'leader' },
      { text: '그 사람 몫까지 조용히 해치운다', type: 'diligent' },
      { text: '"무슨 일 있어?" 일단 연락해서 달래본다', type: 'social' },
    ],
  },
  {
    q: '처음 보는 사람들만 있는 자리에 갔다.',
    vision: { scene: 'quizParty', cast: [{ sprite: 'delibird', dir: 'right', emote: '🎁' }, { sprite: 'zubat', emote: '🎉' }, { sprite: 'tentacool', dir: 'left', emote: '👋' }] },
    options: [
      { text: '자연스럽게 대화를 이끈다', type: 'leader' },
      { text: '분위기를 관찰하며 타이밍을 본다', type: 'diligent' },
      { text: '어느새 다들 내 친구가 되어 있다', type: 'social' },
    ],
  },
  {
    q: '아르바이트 중 손님이 화를 낸다.',
    vision: { scene: 'quizCounter', cast: [{ sprite: 'gyarados', dir: 'left', emote: '💢', scale: 1.3 }] },
    options: [
      { text: '침착하게 상황을 정리하고 해결책을 낸다', type: 'leader' },
      { text: '매뉴얼대로 정확하게 처리한다', type: 'diligent' },
      { text: '웃으며 공감해 화를 누그러뜨린다', type: 'social' },
    ],
  },
  {
    q: '주말에 갑자기 시간이 비었다.',
    vision: { scene: 'quizWeekend', cast: [{ sprite: 'togepi', dir: 'right', emote: '☀️' }, { sprite: 'taillow', dir: 'left', emote: '📱' }] },
    options: [
      { text: '친구들을 불러 모아 번개를 연다', type: 'leader' },
      { text: '밀린 공부나 운동 루틴을 채운다', type: 'diligent' },
      { text: '누가 부르든 일단 나간다', type: 'social' },
    ],
  },
  {
    q: '"군대 가기 싫다…" 그래도 가야 한다면?',
    vision: { scene: 'quizGate', cast: [{ npc: 'sgt', emote: '❗' }, { npc: 'lt', scale: 1.15 }] },
    options: [
      { text: '어차피 갈 거면 제대로 해보자', type: 'leader' },
      { text: '하루하루 계획대로 버티면 된다', type: 'diligent' },
      { text: '좋은 사람들 만나면 괜찮겠지', type: 'social' },
    ],
  },
];
