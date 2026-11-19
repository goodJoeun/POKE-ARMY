import type { Effects, NpcId, QuestDef } from '../types';

export const QUESTS: Record<string, QuestDef> = {
  q_sgt_px: {
    id: 'q_sgt_px',
    hint: '2일차 이후 · 분대장 호감 5↑ · 저녁 개인정비 시간',
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
    hint: '3일차 이후 · 맞선임 호감 5↑',
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
    hint: '4일차 이후 · 일과가 끝난 뒤(17:30~) 동기에게 말 걸기',
    title: '동기와 자격증 공부',
    giver: 'buddy',
    together: true,
    desc: '싸지방(사이버지식정보방)에서 동기와 자격증 공부를 하자.',
    steps: [{ spot: 'cyber', text: '동기와 나란히 앉아 자격증 인강을 들었다. (30분)', minutes: 30 }],
    reward: { affinity: { buddy: 8 }, skill: 6, mental: 3 },
  },
  q_lt_doc: {
    id: 'q_lt_doc',
    hint: '2일차 이후 · 소대장 호감 4↑',
    title: '소대장의 서류 전달',
    giver: 'lt',
    desc: '소대장이 맡긴 근무표를 행정보급관(주임원사)에게 전달하자.',
    steps: [{ npc: 'sgm', text: '서류를 전달했다. "오~ 빠르네! 소대장님께 잘 받았다고 전해라."' }],
    reward: { affinity: { lt: 6, sgm: 5 }, discipline: 3 },
  },
  q_junior_tour: {
    id: 'q_junior_tour',
    hint: '후임 전입 후 (4일차 이후)',
    title: '후임에게 부대 안내',
    giver: 'junior',
    together: true,
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
    hint: '언제든 (행정보급관에게 말 걸기)',
    title: '체단실 정리',
    giver: 'sgm',
    desc: '흐트러진 체단실 기구들을 정리하자.',
    steps: [{ spot: 'gym', text: '아령과 원판을 제자리에 정리했다. 땀이 난다. (30분)', minutes: 30 }],
    reward: { affinity: { sgm: 10 }, hp: -5, discipline: 3 },
  },
  q_junior2_rank: {
    id: 'q_junior2_rank',
    hint: '8일차 이후 (막내 전입 후)',
    title: '막내의 계급장 공부',
    giver: 'junior2',
    together: true,
    desc: '막내와 함께 생활관 침상에서 계급 체계를 복습하자.',
    steps: [{ spot: 'bed', text: '이병부터 대장까지, 계급장을 하나하나 같이 외웠다. (20분)', minutes: 20 }],
    reward: { affinity: { junior2: 12 }, skill: 2, discipline: 2 },
  },

  // ───────── 장소별 부탁 (막사 시설 · 야외 구역) ─────────
  q_sgt_recycle: {
    id: 'q_sgt_recycle',
    hint: '2일차 이후 (분대장은 3일차까지 부대에 있다)',
    title: '생활관 분리수거 당번',
    giver: 'sgt',
    desc: '생활관 쓰레기를 분리수거장(병영식당 아래쪽)에 종류별로 버리고 분대장에게 보고하자.',
    steps: [
      { spot: 'recycle', text: '페트병은 라벨을 떼고, 캔은 찌그러뜨리고, 음식물은 물기를 빼서 종류별로 버렸다. (15분)', minutes: 15 },
      { npc: 'sgt', text: '"수고했다. 분리수거 깔끔하게 하는 것도 실력이다."' },
    ],
    reward: { affinity: { sgt: 6 }, discipline: 3 },
  },
  q_sgt_water: {
    id: 'q_sgt_water',
    hint: '「생활관 분리수거 당번」 완료 (분대장은 3일차까지 부대에 있다)',
    title: '정수기 점검표 확인',
    giver: 'sgt',
    desc: '막사 1층·2층 복도 정수기의 필터 교체일을 확인하고 분대장에게 알려 주자.',
    steps: [
      { spot: 'water1', text: '1층 정수기 점검표: 필터 교체일 이상 없음.', minutes: 5 },
      { spot: 'water2', text: '2층 정수기 점검표: 필터 교체일이 지났다! 메모해 뒀다.', minutes: 5 },
      { npc: 'sgt', text: '"2층 필터가 지났다고? 행보관님께 바로 보고하마. 꼼꼼하네."' },
    ],
    reward: { affinity: { sgt: 5 }, discipline: 3 },
  },
  q_buddy_laundry: {
    id: 'q_buddy_laundry',
    hint: '2일차 이후 · 저녁 개인정비 시간',
    title: '동기와 빨래 개기',
    giver: 'buddy',
    together: true,
    desc: '막사 1층 세탁실에서 동기와 함께 빨래를 개자.',
    steps: [{ spot: 'laundry1', text: '세탁기에서 전투복을 꺼내 동기와 나란히 앉아 각 잡아 갰다. 수다도 한가득. (20분)', minutes: 20 }],
    reward: { affinity: { buddy: 8 }, mental: 4 },
  },
  q_senior_book: {
    id: 'q_senior_book',
    hint: '「휴가 신청서 제출」 완료 · 맞선임 호감 3↑',
    title: '선임의 책 반납 부탁',
    giver: 'senior',
    desc: '근무 때문에 못 가는 맞선임 대신 막사 2층 도서관에 책을 반납하자. (부탁이라 거절해도 된다)',
    steps: [
      { spot: 'library', text: '도서관에 책을 반납하고 반납 대장에 선임 이름을 적었다.', minutes: 10 },
      { npc: 'senior', text: '"땡큐! 약속한 초코파이. 둘이 하나씩 먹자."' },
    ],
    reward: { affinity: { senior: 8 }, mental: 4, hp: 3 },
  },
  q_senior_maint: {
    id: 'q_senior_maint',
    hint: '5일차 이후',
    title: '정비실 공구 반납',
    giver: 'senior',
    together: true,
    desc: '맞선임과 함께 막사 1층 정비실에 빌린 공구를 반납하고 공구 대장 쓰는 법을 배우자.',
    steps: [
      { spot: 'maint', text: '공구함 번호에 맞춰 공구를 반납하고 대장에 기록했다. 선임이 공구 이름을 하나하나 알려 줬다. (15분)', minutes: 15 },
      { npc: 'senior', text: '"이제 공구 대장도 쓸 줄 알지? 다음엔 네가 후임한테 알려 줘."' },
    ],
    reward: { affinity: { senior: 6 }, skill: 3 },
  },
  q_junior_court: {
    id: 'q_junior_court',
    hint: '「후임에게 부대 안내」 완료 · 저녁 개인정비 시간',
    title: '후임과 농구 한 판',
    giver: 'junior',
    together: true,
    desc: '저녁 개인정비 시간에 연병장 옆 농구장에서 후임과 함께 시합을 뛰자.',
    steps: [
      { spot: 'court', text: '2분대와 3대3 농구 시합! 후임의 패스를 받아 결승골을 넣었다. (30분)', minutes: 30 },
      { npc: 'junior', text: '"{myrank}님 슛 진짜 멋있었습니다! 다음 시합도 같이 뛰십시오!"' },
    ],
    reward: { affinity: { junior: 10 }, mental: 6, hp: -5 },
  },
  q_junior2_board: {
    id: 'q_junior2_board',
    hint: '막내 전입 후',
    title: '이번 달 생일자 확인',
    giver: 'junior2',
    together: true,
    desc: '막내와 함께 막사 1층 복도 게시판에서 이번 달 생일자를 확인하자.',
    steps: [
      { spot: 'board1', text: '복도 게시판에서 이번 달 생일자 명단을 확인했다. 옆에 붙은 경계작전명령서도 막내에게 설명해 줬다.', minutes: 5 },
      { npc: 'junior2', text: '"감사합니다! 생일인 분들께 축하 카드 같이 써 주실 수 있습니까?"' },
    ],
    reward: { affinity: { junior2: 8 }, mental: 3 },
  },
  q_sgm_kitchen: {
    id: 'q_sgm_kitchen',
    hint: '3일차 이후',
    title: '조리실 취사 지원',
    giver: 'sgm',
    desc: '병영식당 안쪽 조리실에서 조리병들을 도와 취사 지원을 하자.',
    steps: [
      { spot: 'kitchen', text: '조리병들과 함께 감자 한 박스를 깎고 대형 솥을 닦았다. (30분)', minutes: 30 },
      { npc: 'sgm', text: '"고생했다. 조리병들이 고맙다더라. 이게 전우애다."' },
    ],
    reward: { affinity: { sgm: 8 }, discipline: 2, hp: -4 },
  },
  q_lt_ammo: {
    id: 'q_lt_ammo',
    hint: '3일차 이후 · 「소대장의 서류 전달」 완료',
    title: '근무 일지 전달',
    giver: 'lt',
    desc: '소대장이 맡긴 근무 일지로 위병소 옆 시설의 출입 기록을 확인하고, 위병소 근무자에게 전달하자.',
    steps: [
      { spot: 'ammo', text: '{ammo} 출입 기록과 근무 일지를 대조했다. 이상 없음.', minutes: 10 },
      { spot: 'post', text: '위병소 근무자에게 근무 일지를 전달했다. "수고하십니다! {S}!"', minutes: 5 },
    ],
    reward: { affinity: { lt: 6 }, discipline: 3 },
  },

  // ───────── 연계 퀘스트 (체인의 마지막 단계들) ─────────
  q_sgt_handover: {
    id: 'q_sgt_handover',
    hint: '「정수기 점검표 확인」 완료 (분대장 전역 전, 3일차까지)',
    title: '분대장 인수인계 준비',
    giver: 'sgt',
    together: true,
    desc: '전역을 앞둔 분대장의 인수인계 노트를 함께 정리하자. 행정반 서류와 복도 게시판의 근무 공지를 옮겨 적는다.',
    steps: [
      { spot: 'admin', text: '행정반에서 분대 인원 현황표와 장비 대장 사본을 받아 왔다.', minutes: 10 },
      { spot: 'board1', text: '1층 복도 게시판의 경계작전명령서·근무표를 인수인계 노트에 옮겨 적었다.', minutes: 10 },
      { npc: 'sgt', text: '"…꼼꼼하네. 이제 네가 이어받을 차례다. 잘 부탁한다, {me}."' },
    ],
    reward: { affinity: { sgt: 10 }, discipline: 3, skill: 2 },
  },
  q_senior_gift: {
    id: 'q_senior_gift',
    hint: '「선임의 책 반납 부탁」 완료',
    title: '휴가 선물 고르기',
    giver: 'senior',
    together: true,
    desc: '휴가를 앞둔 맞선임과 함께 PX에서 가족 선물을 고르자. (선임 돈으로 사는 선물이다)',
    steps: [
      { spot: 'px', text: '맞선임과 머리를 맞대고 조카 선물용 과자 세트를 골랐다. (15분)', minutes: 15 },
      { npc: 'senior', text: '"덕분에 선물 해결! 휴가 복귀하면 맛있는 거 사 올게. 약속~"' },
    ],
    reward: { affinity: { senior: 10 }, mental: 5 },
  },
  q_buddy_exam: {
    id: 'q_buddy_exam',
    hint: '「동기와 자격증 공부」 완료 · 일과가 끝난 뒤(17:30~)',
    title: '자격증 시험 접수',
    giver: 'buddy',
    together: true,
    desc: '동기와 함께 싸지방에서 자격증 시험을 접수하고, 행정반에 시험 외출 승인 서류를 내자.',
    steps: [
      { spot: 'cyber', text: '싸지방에서 동기와 나란히 자격증 시험을 접수했다. 수험표 출력 완료!', minutes: 15 },
      { spot: 'admin', text: '행정반에 시험 당일 외출 승인 서류를 제출했다.', minutes: 5 },
      { npc: 'buddy', text: '"접수했다! 이제 진짜 공부만 남았네… 같이 붙자."' },
    ],
    reward: { affinity: { buddy: 6 }, skill: 3 },
  },
  q_buddy_result: {
    id: 'q_buddy_result',
    hint: '「자격증 시험 접수」 완료 · 6일차 이후 · 일과가 끝난 뒤(17:30~)',
    title: '합격 발표',
    giver: 'buddy',
    together: true,
    desc: '드디어 자격증 합격 발표 날. 싸지방에서 결과를 확인하고 도서관에서 다음 목표를 정하자.',
    steps: [
      { spot: 'cyber', text: '두근두근… 결과 조회! 둘 다 합격이다!! 싸지방이 떠나가라 소리 질렀다.', minutes: 10 },
      { spot: 'library', text: '도서관에서 다음에 도전할 자격증 교재를 함께 골랐다.', minutes: 15 },
      { npc: 'buddy', text: '"우리 둘 다 합격이라니… 전역할 때 자격증 두 개씩 들고 나가자!"' },
    ],
    reward: { affinity: { buddy: 10 }, skill: 5, mental: 6 },
  },
  q_junior_mentor: {
    id: 'q_junior_mentor',
    hint: '「후임과 농구 한 판」 완료',
    title: '후임 멘토링',
    giver: 'junior',
    together: true,
    desc: '부대에 적응 중인 후임에게 체력검정 종목과 게시판 공지 보는 법을 알려 주자.',
    steps: [
      { spot: 'gym', text: '체단실에서 팔굽혀펴기·윗몸일으키기 자세를 하나하나 봐 줬다. (20분)', minutes: 20 },
      { spot: 'board2', text: '2층 복도 게시판에서 부대 공지와 근무표 보는 법을 알려 줬다.', minutes: 5 },
      { npc: 'junior', text: '"{myrank}님 덕분에 이제 좀 군인 같습니다! 저도 나중에 후임 생기면 이렇게 하겠습니다!"' },
    ],
    reward: { affinity: { junior: 12 }, discipline: 2 },
  },
  q_lt_report: {
    id: 'q_lt_report',
    hint: '「근무 일지 전달」 완료',
    title: '근무 결과 보고서',
    giver: 'lt',
    desc: '소대장을 도와 이번 주 근무 기록을 정리하고 행정반에 보고서를 제출하자.',
    steps: [
      { spot: 'command', text: '지휘통제실에서 이번 주 경계·불침번 근무 기록을 표로 정리했다.', minutes: 15 },
      { spot: 'admin', text: '행정반에 근무 결과 보고서를 제출했다.', minutes: 5 },
      { npc: 'lt', text: '"깔끔하다. 이 정도면 중대장님께 바로 올려도 되겠어. 고생했다."' },
    ],
    reward: { affinity: { lt: 8 }, discipline: 4, skill: 2 },
  },
};

/** 연계 퀘스트: 앞 퀘스트를 끝내야 다음 퀘스트를 받을 수 있다. 체인을 다 끝내면 보너스 */
export interface QuestChain {
  id: string;
  title: string;
  giver: NpcId;
  desc: string;
  quests: string[];
  bonus: Effects;
}
export const QUEST_CHAINS: QuestChain[] = [
  { id: 'c_sgt', title: '분대장 인수인계', giver: 'sgt', desc: '전역을 앞둔 분대장에게 생활관 살림을 하나씩 배워 이어받는다.', quests: ['q_sgt_recycle', 'q_sgt_water', 'q_sgt_handover'], bonus: { discipline: 5, affinity: { sgt: 6 } } },
  { id: 'c_senior', title: '맞선임의 휴가', giver: 'senior', desc: '휴가를 앞둔 맞선임을 도와 준비를 마친다.', quests: ['q_senior_leave', 'q_senior_book', 'q_senior_gift'], bonus: { mental: 8, affinity: { senior: 6 } } },
  { id: 'c_buddy', title: '동기의 자격증', giver: 'buddy', desc: '동기와 함께 공부하고, 접수하고, 합격한다.', quests: ['q_buddy_study', 'q_buddy_exam', 'q_buddy_result'], bonus: { skill: 6, affinity: { buddy: 6 } } },
  { id: 'c_junior', title: '후임 적응기', giver: 'junior', desc: '전입 온 후임이 부대에 적응하도록 이끌어 준다.', quests: ['q_junior_tour', 'q_junior_court', 'q_junior_mentor'], bonus: { discipline: 3, mental: 4, affinity: { junior: 6 } } },
  { id: 'c_lt', title: '소대장의 근무 관리', giver: 'lt', desc: '소대장을 도와 근무 서류를 챙기고 보고까지 마친다.', quests: ['q_lt_doc', 'q_lt_ammo', 'q_lt_report'], bonus: { discipline: 5, affinity: { lt: 6 } } },
];
export const chainOf = (questId: string) => QUEST_CHAINS.find((c) => c.quests.includes(questId));
