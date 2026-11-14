import type { QuestDef } from '../types';

export const QUESTS: Record<string, QuestDef> = {
  q_sgt_px: {
    id: 'q_sgt_px',
    title: '분대장의 냉동 심부름',
    giver: 'sgt',
    desc: '분대장이 준 돈으로 PX에서 냉동식품을 사 와서 같이 먹자.',
    steps: [
      { spot: 'px', text: '분대장이 준 돈으로 냉동 만두 2개를 샀다.' },
      { npc: 'sgt', text: '"오, 왔냐? 하나는 네 거야. 같이 먹자."' },
    ],
    reward: { affinity: { sgt: 10 }, mental: 10, hp: 5 },
  },
  q_senior_leave: {
    id: 'q_senior_leave',
    title: '휴가 신청서 제출',
    giver: 'senior',
    desc: '맞선임의 휴가 신청서를 행정반에 제출하고 알려주자.',
    steps: [
      { spot: 'admin', text: '행정반 서류함에 휴가 신청서를 제출했다.' },
      { npc: 'senior', text: '"땡큐! 휴가 나가면 네 생각 할게. …아마도."' },
    ],
    reward: { affinity: { senior: 10 }, discipline: 2 },
  },
  q_buddy_study: {
    id: 'q_buddy_study',
    title: '동기와 자격증 공부',
    giver: 'buddy',
    desc: '싸지방(사이버지식정보방)에서 동기와 자격증 공부를 하자.',
    steps: [{ spot: 'cyber', text: '동기와 나란히 앉아 자격증 인강을 들었다. (30분)', minutes: 30 }],
    reward: { affinity: { buddy: 8 }, skill: 6, mental: 3 },
  },
  q_lt_doc: {
    id: 'q_lt_doc',
    title: '소대장의 서류 전달',
    giver: 'lt',
    desc: '소대장이 맡긴 근무표를 행정보급관(주임원사)에게 전달하자.',
    steps: [{ npc: 'sgm', text: '서류를 전달했다. "오~ 빠르네! 소대장님께 잘 받았다고 전해라."' }],
    reward: { affinity: { lt: 6, sgm: 5 }, discipline: 3 },
  },
  q_junior_tour: {
    id: 'q_junior_tour',
    title: '후임에게 부대 안내',
    giver: 'junior',
    desc: '전입 온 후임에게 PX와 싸지방 위치를 알려주자.',
    steps: [
      { spot: 'px', text: '후임에게 PX 위치와 운영 시간을 알려줬다.' },
      { spot: 'cyber', text: '싸지방 이용 방법도 알려줬다.' },
      { npc: 'junior', text: '"감사합니다! 이제 혼자서도 갈 수 있습니다!"' },
    ],
    reward: { affinity: { junior: 12 }, mental: 5, discipline: 2 },
  },
  q_sgm_gym: {
    id: 'q_sgm_gym',
    title: '체력단련장 정리',
    giver: 'sgm',
    desc: '흐트러진 체력단련장 기구들을 정리하자.',
    steps: [{ spot: 'gym', text: '아령과 원판을 제자리에 정리했다. 땀이 난다. (30분)', minutes: 30 }],
    reward: { affinity: { sgm: 10 }, hp: -5, discipline: 3 },
  },
  q_junior2_rank: {
    id: 'q_junior2_rank',
    title: '막내의 계급장 공부',
    giver: 'junior2',
    desc: '막내와 함께 생활관 침상에서 계급 체계를 복습하자.',
    steps: [{ spot: 'bed', text: '이병부터 대장까지, 계급장을 하나하나 같이 외웠다. (20분)', minutes: 20 }],
    reward: { affinity: { junior2: 12 }, skill: 2, discipline: 2 },
  },
};
