import type { Archetype, BranchId, Species } from '../types';

/**
 * 플레이어가 변신하는 포켓몬 (IP 사용 협의 완료)
 * - look: 스프라이트가 없을 때 쓰는 절차적(캔버스) 외형
 * - look.sprite: public/sprites/manifest.json 에 등록하면 해당 이미지로 대체된다
 * - weights: 성격 분석 결과와의 궁합. 결과 벡터와 가장 잘 맞는(코사인 유사도) 포켓몬이 선택된다
 */
export const PLAYER_SPECIES: Record<BranchId, Species[]> = {
  army: [
    {
      id: 'charmander', name: '파이리', type: '불꽃',
      desc: '꼬리 끝의 불꽃이 꺼지지 않는 한 절대 포기하지 않는다. 앞장서서 책임지는 타입.',
      wake: '주황색 손… 엉덩이 쪽이 뜨끈하다. 돌아보니 꼬리 끝에 불이 활활 붙어 있다?!',
      weights: { leader: 1, diligent: 0.3 },
      look: { sprite: 'charmander', body: '#f2894a', belly: '#f8e3a0', accent: '#ff5a2a', shape: 'tall', ears: 'none', tail: 'flame', eyes: 'big', mouth: 'smile' },
    },
    {
      id: 'cyndaquil', name: '브케인', type: '불꽃',
      desc: '겁이 많아 몸을 웅크리지만, 위기에는 등의 불꽃을 활활 태운다. 묵묵히 해내는 타입.',
      wake: '등이 이상하게 뜨겁다. 돌아보니… 등에서 불꽃이 화르륵 솟구친다?!',
      weights: { diligent: 1 },
      look: { sprite: 'cyndaquil', body: '#2e4e62', belly: '#f2e2a8', accent: '#ff6a2a', shape: 'wide', ears: 'none', tail: 'none', eyes: 'sleepy', mouth: 'smile', extra: 'ember' },
    },
    {
      id: 'torchic', name: '아차모', type: '불꽃',
      desc: '따뜻한 체온으로 곁에 있는 이를 품어주는 병아리 포켓몬. 생활관의 분위기 메이커.',
      wake: '손이… 날개?! 그것도 주황색 솜털 날개?! 입에서 삐약 소리가 절로 나온다.',
      weights: { social: 1 },
      look: { sprite: 'torchic', body: '#f29a3a', belly: '#f8c860', accent: '#f2d24a', shape: 'round', ears: 'tuft', tail: 'none', wings: true, eyes: 'dot', mouth: 'beak' },
    },
    {
      id: 'chimchar', name: '파이숭이', type: '불꽃',
      desc: '엉덩이 불꽃만큼 넘치는 에너지! 앞장서면서 분위기까지 띄우는 타입.',
      wake: '손이 주황색 털로 덮여 있다. 엉덩이에서 불꽃이 탁탁 튄다?!',
      weights: { leader: 0.7, social: 0.7 },
      look: { sprite: 'chimchar', body: '#e8843a', belly: '#f8e0b8', accent: '#ff5a2a', shape: 'tall', ears: 'round', tail: 'flame', eyes: 'big', mouth: 'cat', extra: 'cheeks' },
    },
  ],
  navy: [
    {
      id: 'squirtle', name: '꼬부기', type: '물',
      desc: '등껍질에 숨었다가 물대포를 쏘는 장난꾸러기. 누구와도 금방 친해지는 타입.',
      wake: '등이 묵직하다. 돌아보니… 등껍질?! 꼬리까지 동글동글 말려 있다.',
      weights: { social: 1, leader: 0.3 },
      look: { sprite: 'squirtle', body: '#7ec8e8', belly: '#f2e2a0', accent: '#b07840', shape: 'round', ears: 'none', tail: 'puff', eyes: 'big', mouth: 'smile', extra: 'shell' },
    },
    {
      id: 'totodile', name: '리아코', type: '물',
      desc: '튼튼한 턱으로 뭐든 물고 놓지 않는다. 거침없이 앞장서는 타입.',
      wake: '입이 이상하게 크다. 이빨이… 악어 이빨?! 꼬리에는 빨간 돌기가 줄지어 있다.',
      weights: { leader: 1 },
      look: { sprite: 'totodile', body: '#4a90d8', belly: '#f2e2a0', accent: '#e04a4a', shape: 'tall', ears: 'none', tail: 'spike', eyes: 'dot', mouth: 'fang' },
    },
    {
      id: 'mudkip', name: '물짱이', type: '물',
      desc: '머리 지느러미로 주변을 꼼꼼히 살핀다. 우직하게 끝까지 해내는 타입.',
      wake: '머리 위에서 뭔가 팔랑거린다. 지느러미?! 볼에는 주황색 아가미까지 달려 있다.',
      weights: { diligent: 1 },
      look: { sprite: 'mudkip', body: '#5aaee8', belly: '#d8eef8', accent: '#3a7ac0', shape: 'wide', ears: 'fin', tail: 'fin', eyes: 'dot', mouth: 'smile', extra: 'cheeks' },
    },
    {
      id: 'piplup', name: '팽도리', type: '물',
      desc: '자존심이 세서 실수를 용납하지 않는다. 꼼꼼하면서도 리더십 있는 타입.',
      wake: '손이 납작한 날개가 됐다. 일어나 보니 뒤뚱뒤뚱… 이건 펭귄 걸음이잖아?!',
      weights: { diligent: 0.7, leader: 0.7 },
      look: { sprite: 'piplup', body: '#3a5a9a', belly: '#ffffff', accent: '#f2c230', shape: 'round', ears: 'none', tail: 'none', wings: true, eyes: 'big', mouth: 'beak' },
    },
  ],
  air: [
    {
      id: 'pidgey', name: '구구', type: '노말·비행',
      desc: '얌전하지만 할 일은 확실히 하는 성실한 새 포켓몬. 묵묵히 해내는 타입.',
      wake: '팔 대신 갈색 날개가 퍼덕인다. 코가 있어야 할 자리에… 부리?!',
      weights: { diligent: 1 },
      look: { sprite: 'pidgey', body: '#a0784a', belly: '#f2e2c4', accent: '#e8c890', shape: 'round', ears: 'feather', tail: 'none', wings: true, eyes: 'dot', mouth: 'beak', extra: 'mask' },
    },
    {
      id: 'starly', name: '찌르꼬', type: '노말·비행',
      desc: '늘 무리를 지어 다니며 시끌벅적하다. 어디서든 분위기를 띄우는 타입.',
      wake: '온몸이 회색 깃털로 덮여 있다. 짹짹거리는 이 소리가… 내 목소리라고?!',
      weights: { social: 1 },
      look: { sprite: 'starly', body: '#5a5050', belly: '#f2f2f2', accent: '#f2f2f2', shape: 'round', ears: 'feather', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' },
    },
    {
      id: 'fletchling', name: '불화살빈', type: '노말·비행',
      desc: '눈에 띄지 않을 만큼 빠르게 날아 먼저 움직인다. 편대의 선두를 맡는 타입.',
      wake: '가슴이 주황빛 깃털로 덮여 있다. 작고 날렵한 날개가 저절로 파닥인다?!',
      weights: { leader: 1 },
      look: { sprite: 'fletchling', body: '#e8603a', belly: '#f2b080', accent: '#5a5a60', shape: 'round', ears: 'none', tail: 'none', wings: true, eyes: 'sharp', mouth: 'beak' },
    },
    {
      id: 'rowlet', name: '나몰빼미', type: '풀·비행',
      desc: '소리 없이 날아 주변을 살피는 올빼미 포켓몬. 침착하게 맡은 일을 해내는 타입.',
      wake: '목이… 거의 뒤로 돌아간다?! 가슴엔 나뭇잎 나비넥타이가 달려 있다.',
      weights: { diligent: 0.8, social: 0.5 },
      look: { sprite: 'rowlet', body: '#d8c8a0', belly: '#f2ead8', accent: '#5aa850', shape: 'round', ears: 'none', tail: 'none', wings: true, eyes: 'big', mouth: 'beak' },
    },
    {
      id: 'emolga', name: '에몽가', type: '전기·비행',
      desc: '볼에서 전기를 튀기며 활공하는 하늘다람쥐 포켓몬. 앞장서서 분위기를 끌어올리는 타입.',
      wake: '팔과 다리 사이에 막이 펼쳐진다?! 볼이 찌릿찌릿하다.',
      weights: { social: 0.8, leader: 0.5 },
      look: { sprite: 'emolga', body: '#f2f2f2', belly: '#ffffff', accent: '#2a2a2a', shape: 'round', ears: 'pointy', tail: 'puff', wings: true, eyes: 'big', mouth: 'cat', extra: 'cheeks' },
    },
  ],
};

export const ARCHETYPE_INFO: Record<Archetype, { name: string; desc: string; perk: string }> = {
  leader: {
    name: '리더형',
    desc: '앞장서서 책임지는 타입. 위기 상황에서 빛난다.',
    perk: '군기 상승량 +30%',
  },
  diligent: {
    name: '성실형',
    desc: '맡은 일은 끝까지, 꼼꼼하게 해내는 타입.',
    perk: '숙련도 상승량 +30%',
  },
  social: {
    name: '분위기메이커형',
    desc: '누구와도 금방 친해지는 타입. 생활관의 비타민.',
    perk: '호감도 상승량 +30%',
  },
};

const ARCHETYPES: Archetype[] = ['leader', 'diligent', 'social'];

/** 성격 점수와 가장 잘 맞는 포켓몬 (코사인 유사도) */
export function pickSpecies(branch: BranchId, scores: Record<Archetype, number>): Species {
  const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  const sv = ARCHETYPES.map((a) => scores[a]);
  let best = PLAYER_SPECIES[branch][0];
  let bestSim = -Infinity;
  for (const sp of PLAYER_SPECIES[branch]) {
    const wv = ARCHETYPES.map((a) => sp.weights[a] ?? 0);
    const sim = sv.reduce((acc, x, i) => acc + x * wv[i], 0) / (norm(sv) * norm(wv));
    if (sim > bestSim + 1e-9) { bestSim = sim; best = sp; }
  }
  return best;
}

export function topArchetype(scores: Record<Archetype, number>): Archetype {
  return ARCHETYPES.reduce((x, y) => (scores[y] > scores[x] ? y : x), 'leader');
}

export function findSpecies(id: string): Species | undefined {
  for (const list of Object.values(PLAYER_SPECIES)) {
    const s = list.find((x) => x.id === id);
    if (s) return s;
  }
  return undefined;
}
