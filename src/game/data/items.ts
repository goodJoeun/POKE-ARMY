import type { Effects } from '../types';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  use: Effects;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  frozen: { id: 'frozen', name: '냉동 만두', icon: '🥟', use: { hp: 12, mental: 10 }, desc: 'PX 국룰. 전자레인지 2분 30초.' },
  soda: { id: 'soda', name: '탄산음료', icon: '🥤', use: { mental: 6 }, desc: '훈련 후 한 캔이면 천국.' },
  chocopie: { id: 'chocopie', name: '초코파이', icon: '🍫', use: { mental: 4 }, desc: '정(情)을 나누는 군대 간식. 선물용으로 최고.' },
  sports: { id: 'sports', name: '이온음료', icon: '🧃', use: { hp: 10 }, desc: '체력 회복에 좋다.' },
  ramen: { id: 'ramen', name: '컵라면', icon: '🍜', use: { hp: 6, mental: 8 }, desc: '불침번 후 먹으면 두 배로 맛있다.' },
  hardtack: { id: 'hardtack', name: '건빵', icon: '🍘', use: { hp: 3, candy: 1 }, desc: '봉지 속에 별사탕이 하나 들어 있다. 별사탕은 퍼즐 힌트를 여는 데 쓴다.' },
  rarecandy: { id: 'rarecandy', name: '이상한사탕', icon: '🍬', use: { skill: 3, mental: 2 }, desc: '먹으면 레벨이… 오르진 않지만 왠지 숙련도가 오른다.' },
};

export const GIFT_AFFINITY = 6;
