import type { BranchId, Dialogue, NpcId } from '../types';
import { TOTAL_DAYS } from './branches';
import { isFreeTimeEvening } from './schedule';

/**
 * 텍스트 토큰
 * {S} 경례구호, {me} 플레이어 이름, {myrank} 플레이어 계급, {train} 훈련장, {unit} 부대명,
 * {wild} 부대 야생동물, {n:id} NPC 이름, {r:id} NPC 이름+계급, {t:id} NPC 직책
 */
export const DIALOGUES: Dialogue[] = [
  // ───────── 분대장 (sgt) ─────────
  {
    id: 'sgt_first', npc: 'sgt', once: true, priority: 10,
    when: (c) => c.day === 1,
    lines: [
      { who: 'npc', text: '어이, 신병. 오늘 전입 온 {me} 맞지?' },
      { who: 'npc', text: '나는 이 생활관 분대장 {r:sgt}이다. 관등성명 대봐.' },
    ],
    choices: [
      {
        text: '"{S}! 이병 {me}!"', grade: 'good',
        effects: { affinity: { sgt: 8 }, discipline: 3 },
        reply: [{ who: 'npc', text: '오, 목소리 좋네. 이 정도면 합격이다.' }],
        tip: '관등성명 = 계급 + 성명. 상급자가 부르면 "{S}! 이병 ○○○!" 처럼 경례 구호와 함께 답한다.',
      },
      {
        text: '"안녕하세요~ 저는 {me}입니다!"', grade: 'ok',
        effects: { affinity: { sgt: 1 } },
        reply: [{ who: 'npc', text: '…여기 학교 아니다. 다음부턴 "{S}! 이병 {me}!" 이렇게 해라.' }],
        tip: '관등성명 = 계급 + 성명. 군에서는 경례 구호와 함께 관등성명을 댄다.',
      },
      {
        text: '(긴장해서 고개만 끄덕인다)', grade: 'bad',
        effects: { affinity: { sgt: -4 }, discipline: -2 },
        reply: [{ who: 'npc', text: '…말 못 하는 포켓몬은 아니지? 대답은 크게 한다.' }],
      },
    ],
  },
  {
    id: 'sgt_injury', npc: 'sgt', once: true,
    when: (c) => c.day >= 1,
    lines: [
      { who: 'npc', text: '하나만 확실히 해두자. 훈련하다 다치거나 아프면 어떻게 할래?' },
    ],
    choices: [
      {
        text: '"즉시 분대장님이나 간부님께 보고하겠습니다!"', grade: 'good',
        effects: { affinity: { sgt: 6 }, discipline: 3 },
        reply: [{ who: 'npc', text: '그래. 참다가 큰 사고 나는 게 제일 무섭다. 아프면 무조건 말해.' }],
        tip: '아프거나 다치면 참지 말고 즉시 보고! 의무대 진료는 병사의 권리다.',
      },
      {
        text: '"참을 수 있는 데까지 참겠습니다!"', grade: 'ok',
        effects: { affinity: { sgt: 1 } },
        reply: [{ who: 'npc', text: '그런 근성은 필요 없어. 다치면 바로 말하는 게 진짜 군인이다.' }],
        tip: '아프거나 다치면 참지 말고 즉시 보고! 숨기면 더 큰 사고가 된다.',
      },
      {
        text: '"그냥 전역할 때까지 버티죠 뭐."', grade: 'bad',
        effects: { affinity: { sgt: -3 }, mental: -2 },
        reply: [{ who: 'npc', text: '…너 그러다 진짜 큰일 난다. 절대 그러지 마.' }],
      },
    ],
  },
  {
    id: 'sgt_snack', npc: 'sgt', once: true,
    // PX 심부름은 저녁 개인정비 시간(17:30~21:30)에만 받는다
    when: (c) => c.day >= 2 && c.affinity.sgt >= 5 && isFreeTimeEvening(c.minute),
    lines: [
      { who: 'npc', text: '야, {n:me}. 배 안 고프냐? 내가 쏜다.' },
      { who: 'npc', text: '여기 내 돈이니까 PX 가서 냉동 두 개만 사 와. 하나는 네 거다.' },
    ],
    choices: [
      {
        text: '"감사합니다! 바로 다녀오겠습니다!"', grade: 'good',
        effects: { affinity: { sgt: 3 }, quest: 'q_sgt_px' },
        reply: [{ who: 'npc', text: '뛰지는 말고. 개인정비 시간 끝나기 전에만 와라.' }],
        tip: '선임이 후임 돈으로 물건을 사 오게 하는 건 부조리. 하지만 선임이 자기 돈으로 함께 나눠 먹는 건 OK!',
      },
      {
        text: '"지금은 좀 바빠서요…"', grade: 'ok',
        effects: { affinity: { sgt: -1 } },
        reply: [{ who: 'npc', text: '그래? 그럼 다음에 같이 가자.' }],
      },
    ],
  },
  {
    id: 'sgt_mental', npc: 'sgt', once: true,
    when: (c) => c.day >= 2 && c.affinity.sgt >= 12,
    lines: [
      { who: 'npc', text: '요즘 얼굴이 좀 안 좋다? 나도 이병 땐 매일 밤 천장만 봤어.' },
      { who: 'npc', text: '힘든 거 있으면 말해봐. 분대장이 괜히 있는 거 아니다.' },
    ],
    choices: [
      {
        text: '"사실… 아직 적응이 쉽지 않습니다."', grade: 'good',
        effects: { affinity: { sgt: 8 }, mental: 12 },
        reply: [
          { who: 'npc', text: '당연하지. 포켓몬 몸으로 군대라니, 나라도 멘붕이다.' },
          { who: 'npc', text: '하루씩만 버텨. 그러다 보면 어느새 너도 병장이야.' },
        ],
        tip: '힘든 마음은 혼자 삭이지 말자. 분대장, 간부, 병영생활전문상담관 모두 이야기를 들어줄 수 있다.',
      },
      {
        text: '"전혀 문제없습니다!"', grade: 'ok',
        effects: { affinity: { sgt: 2 } },
        reply: [{ who: 'npc', text: '그래? 그럼 다행이고. 힘들면 언제든 말해.' }],
      },
      {
        text: '"힘든데 분대장님이 어떻게 해주실 건데요?"', grade: 'bad',
        effects: { affinity: { sgt: -6 }, mental: -3 },
        reply: [{ who: 'npc', text: '…그래, 알았다. 말 걸어서 미안하다.' }],
      },
    ],
  },
  {
    id: 'sgt_farewell', npc: 'sgt', once: true, priority: 20,
    when: (c) => c.day === 3,
    lines: [
      { who: 'npc', text: '{n:me}. 나 내일 전역이다.' },
      { who: 'npc', text: '처음 왔을 땐 꼬리에 불붙은 것처럼 허둥대더니, 이제 제법 군인 같네.' },
      { who: 'npc', text: '내가 없어도 {r:senior}이 분대장 할 거다. 잘 따르고.' },
    ],
    choices: [
      {
        text: '"그동안 감사했습니다! {S}!"', grade: 'good',
        effects: { affinity: { sgt: 10 }, mental: 6, discipline: 2 },
        reply: [{ who: 'npc', text: '{S}. …사회에서 보면 밥 한번 사라. 포켓몬 말고 사람으로.' }],
        tip: '선임의 전역은 생활관의 큰 행사. 감사 인사와 함께 보내주는 것이 좋은 전통이다.',
      },
      {
        text: '"부럽습니다… 저도 데려가 주십시오."', grade: 'ok',
        effects: { affinity: { sgt: 4 }, mental: -2 },
        reply: [{ who: 'npc', text: '하하, 국방부 시계는 거꾸로 매달아도 돌아간다. 너도 금방이야.' }],
      },
    ],
  },

  // ───────── 맞선임 (senior) ─────────
  {
    id: 'senior_hi', npc: 'senior', once: true, priority: 5,
    when: (c) => c.day <= 2,
    lines: [
      { who: 'npc', text: '오~ 네가 신병이구나! 난 네 맞선임 {r:senior}.' },
      { who: 'npc', text: '근데 너 포켓몬 되기 전엔 뭐였냐? 혹시 사람?' },
    ],
    choices: [
      {
        text: '"…그걸 어떻게 아셨습니까?"', grade: 'good',
        effects: { affinity: { senior: 6 }, mental: 3 },
        reply: [
          { who: 'npc', text: '푸하하! 농담이었는데 진짜야? 걱정 마, 여기 다 비슷한 사연 있어.' },
          { who: 'npc', text: '나도 원래 사람이었는지 기억이 가물가물하다니까.' },
        ],
      },
      {
        text: '"전입 첫날부터 장난이 심하십니다."', grade: 'ok',
        effects: { affinity: { senior: 1 } },
        reply: [{ who: 'npc', text: '아이고 FM이네~ 재미없다, 너.' }],
      },
    ],
  },
  {
    id: 'senior_laundry', npc: 'senior', once: true, priority: 8,
    when: (c) => c.day >= 2 && c.day <= 5,
    lines: [
      { who: 'npc', text: '야, {n:me}. 내 전투복이랑 양말 좀 빨아놔라.' },
      { who: 'npc', text: '나 오늘 너~무 귀찮거든. 후임이 해주는 게 국룰이지?' },
    ],
    choices: [
      {
        text: '"죄송하지만 개인 빨래는 각자 하는 게 원칙입니다. 세탁기 비는 시간은 알려드리겠습니다."', grade: 'good',
        effects: { affinity: { senior: -2 }, discipline: 6, mental: 3, flag: 'refused_laundry' },
        reply: [
          { who: 'npc', text: '…칫. 너 진짜 FM이구나.' },
          { who: 'npc', text: '알았어 알았어, 내가 할게. 근데 말투는 마음에 든다.' },
        ],
        tip: '병 상호 간 사적인 지시(빨래, 심부름 강요 등)는 "부조리"다. 정중하게 거절해도 된다.',
      },
      {
        text: '"네! 알겠습니다!"', grade: 'ok',
        effects: { affinity: { senior: 3 }, mental: -8, hp: -5 },
        reply: [{ who: 'npc', text: '오~ 착하네. (…뭔가 찝찝한 기분이 든다)' }],
        tip: '병 상호 간 사적인 지시는 부조리다. 한 번 따르면 계속 이어질 수 있으니 정중히 거절하자.',
      },
      {
        text: '(마음의 편지에 적어 소대장에게 제출한다)', grade: 'good',
        effects: { affinity: { senior: -8 }, discipline: 4, flag: 'reported_senior' },
        reply: [{ who: 'narr', text: '그날 저녁, 마음의 편지를 조용히 소대장에게 전달했다.' }],
        tip: '부조리는 "마음의 편지", 간부 면담, 국방헬프콜(1303)로 알릴 수 있다. 신고자는 보호받는다.',
      },
    ],
  },
  {
    id: 'senior_gear', npc: 'senior', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '장비 수입(손질) 할 줄 알아? 내가 특별히 알려준다.' },
      { who: 'npc', text: '장비는 네 몸처럼. 번호도 꼭 외워둬. 점검 때 물어보거든.' },
    ],
    choices: [
      {
        text: '"꼭 배우고 싶습니다! 가르쳐 주십시오."', grade: 'good',
        effects: { affinity: { senior: 6 }, skill: 6 },
        reply: [{ who: 'npc', text: '좋아, 열정 좋고! 여기 이 부분은 이렇게 닦는 거야.' }],
        tip: '"수입" = 손질·정비. 개인 장비 번호는 외워두는 것이 기본이다.',
      },
      {
        text: '"이미 훈련소에서 배웠습니다."', grade: 'ok',
        effects: { affinity: { senior: -1 }, skill: 1 },
        reply: [{ who: 'npc', text: '오, 그래? 그럼 실전에서 보자고.' }],
      },
    ],
  },
  {
    id: 'senior_leave', npc: 'senior', once: true,
    when: (c) => c.day >= 3 && c.affinity.senior >= 5,
    lines: [
      { who: 'npc', text: '{n:me}! 부탁 하나만. 이거 내 휴가 신청서인데 행정반에 좀 내줄래?' },
      { who: 'npc', text: '강요 아니고 진짜 부탁이야. 싫으면 내가 갈게.' },
    ],
    choices: [
      {
        text: '"가는 길이니 제가 내드리겠습니다."', grade: 'good',
        effects: { affinity: { senior: 3 }, quest: 'q_senior_leave' },
        reply: [{ who: 'npc', text: '역시 내 맞후임! 고맙다~' }],
      },
      {
        text: '"직접 내시는 게 좋을 것 같습니다."', grade: 'ok',
        effects: {},
        reply: [{ who: 'npc', text: '그래, 맞는 말이다. 내가 다녀올게.' }],
      },
    ],
  },
  {
    id: 'senior_squadleader', npc: 'senior', once: true, priority: 15,
    when: (c) => c.day >= 4 && c.day <= 5,
    lines: [
      { who: 'npc', text: '{n:sgt} 병장님 전역하시고 내가 분대장 됐다. 실감이 안 나네.' },
      { who: 'npc', text: '근데… 내가 잘할 수 있을까? 솔직히 말해봐.' },
    ],
    choices: [
      {
        text: '"분대장님은 다들 편하게 대해주셔서 잘하실 겁니다."', grade: 'good',
        effects: { affinity: { senior: 8 }, mental: 3 },
        reply: [{ who: 'npc', text: '…야, 감동이다. 너는 내가 꼭 챙긴다.' }],
      },
      {
        text: '"장난만 좀 줄이시면 됩니다."', grade: 'ok',
        effects: { affinity: { senior: 2 } },
        reply: [{ who: 'npc', text: '하하, 팩폭 오지네. 알았다, 노력하마.' }],
      },
    ],
  },
  {
    id: 'senior_farewell', npc: 'senior', once: true, priority: 20,
    when: (c) => c.day === 6,
    lines: [
      { who: 'npc', text: '야, 나 내일 전역이다. 믿기냐?' },
      { who: 'npc', text: '이제 네가 이 생활관 분대장이야. 후임들 잘 챙겨라.' },
    ],
    choices: [
      {
        text: '"분대장님처럼 좋은 선임이 되겠습니다!"', grade: 'good',
        effects: { affinity: { senior: 10 }, discipline: 4, mental: 4 },
        reply: [{ who: 'npc', text: '나처럼은 되지 말고, 나보다 낫게 해라. {S}!' }],
      },
      {
        text: '"이제 장난 안 치셔도 됩니다, 사회에서도 자제하십쇼."', grade: 'ok',
        effects: { affinity: { senior: 5 }, mental: 5 },
        reply: [{ who: 'npc', text: '푸하하! 끝까지 너답다. 잘 있어라~' }],
      },
    ],
  },

  // ───────── 동기 (buddy) ─────────
  {
    id: 'buddy_first', npc: 'buddy', once: true, priority: 10,
    when: (c) => c.day === 1,
    lines: [
      { who: 'npc', text: '너, 너도 오늘 전입이지? 난 {n:buddy}… 같은 날 왔어.' },
      { who: 'npc', text: '나 너무 무서워. 아까 {t:sgm}님이 나 보고 웃었는데 그게 더 무서워…' },
    ],
    choices: [
      {
        text: '"우리 같이 버티자. 동기 좋다는 게 뭐겠어!"', grade: 'good',
        effects: { affinity: { buddy: 10 }, mental: 5 },
        reply: [{ who: 'npc', text: '흑… 고마워. 너 진짜 좋은 포켓몬이다.' }],
        tip: '동기는 군 생활 최고의 버팀목. 같은 날 들어와 같은 날 나간다.',
      },
      {
        text: '"나도 무서운데… 둘이 같이 떨자."', grade: 'ok',
        effects: { affinity: { buddy: 5 }, mental: 1 },
        reply: [{ who: 'npc', text: '푸흡, 그래. 같이 떨자.' }],
      },
      {
        text: '"각자 알아서 하자."', grade: 'bad',
        effects: { affinity: { buddy: -6 } },
        reply: [{ who: 'npc', text: '아… 응. 미안.' }],
      },
    ],
  },
  {
    id: 'buddy_homesick', npc: 'buddy', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '집에 두고 온 강아지가 너무 보고 싶어… 나 지금 포켓몬인데 걔가 날 알아볼까?' },
    ],
    choices: [
      {
        text: '"냄새로 알아볼 거야. 휴가 나가면 제일 먼저 달려올걸?"', grade: 'good',
        effects: { affinity: { buddy: 8 }, mental: 4 },
        reply: [{ who: 'npc', text: '히히, 그렇겠지? 휴가까지 버텨야겠다!' }],
      },
      {
        text: '"오늘 저녁에 휴대폰으로 사진이라도 봐."', grade: 'ok',
        effects: { affinity: { buddy: 4 }, mental: 2 },
        reply: [{ who: 'npc', text: '맞다, 일과 끝나면 폰 쓸 수 있지! 좋은 생각이다.' }],
        tip: '병사들은 일과 이후 정해진 시간에 휴대전화를 사용할 수 있다.',
      },
    ],
  },
  {
    id: 'buddy_password', npc: 'buddy', once: true, priority: 6,
    when: (c) => c.day >= 3,
    lines: [
      { who: 'npc', text: '{n:me}, 나 오늘 경계근무 들어가는데… 암구호를 까먹었어. 살짝만 알려줄래?' },
    ],
    choices: [
      {
        text: '"그건 보안이라 안 돼. 근무 투입 전에 교육 때 다시 확인하자."', grade: 'good',
        effects: { affinity: { buddy: 2 }, discipline: 6 },
        reply: [{ who: 'npc', text: '아… 맞다, 그렇지. 괜히 물어봤다. 고마워!' }],
        tip: '암구호는 군사기밀. 친한 동기라도 사적으로 알려주면 안 된다.',
      },
      {
        text: '(살짝 귓속말로 알려준다)', grade: 'bad',
        effects: { affinity: { buddy: 5 }, discipline: -8 },
        reply: [{ who: 'narr', text: '…지나가던 {r:lt}가 이쪽을 유심히 쳐다본다.' }],
        tip: '암구호 유출은 심각한 보안 위반이다.',
      },
    ],
  },
  {
    id: 'buddy_study', npc: 'buddy', once: true,
    when: (c) => c.day >= 4,
    lines: [
      { who: 'npc', text: '나 전역 전에 자격증 하나 따려고! 같이 싸지방 가서 공부할래?' },
    ],
    choices: [
      {
        text: '"좋아, 지금 가자!"', grade: 'good',
        effects: { affinity: { buddy: 3 }, quest: 'q_buddy_study' },
        reply: [{ who: 'npc', text: '오예! 싸지방에서 만나!' }],
        tip: '군에서도 자기계발 가능! 자격증 응시료 지원, 원격 강좌 등 제도가 있다.',
      },
      {
        text: '"오늘은 좀 쉴래."', grade: 'ok',
        effects: {},
        reply: [{ who: 'npc', text: '그래, 쉬는 것도 중요하지!' }],
      },
    ],
  },
  {
    id: 'buddy_rank_up', npc: 'buddy', once: true,
    when: (c) => c.day >= 7,
    lines: [
      { who: 'npc', text: '우리 벌써 상병이야. 우리 처음 왔을 때 기억나? 둘 다 덜덜 떨었잖아.' },
    ],
    choices: [
      {
        text: '"그때 네가 있어서 버틸 수 있었어."', grade: 'good',
        effects: { affinity: { buddy: 10 }, mental: 6 },
        reply: [{ who: 'npc', text: '…야, 갑자기 그러면 나 운다?' }],
      },
      {
        text: '"넌 아직도 떨잖아."', grade: 'ok',
        effects: { affinity: { buddy: 3 }, mental: 3 },
        reply: [{ who: 'npc', text: '야! …맞는 말이라 반박을 못 하겠네.' }],
      },
    ],
  },

  // ───────── 후임 (junior) ─────────
  {
    id: 'junior_arrive', npc: 'junior', once: true, priority: 12,
    when: (c) => c.day >= 4,
    lines: [
      { who: 'npc', text: '{S}! 이병 {n:junior}! 오늘 전입 왔습니다!' },
      { who: 'npc', text: '선, 선임님이 제 맞선임이라고 들었습니다!' },
    ],
    choices: [
      {
        text: '"반가워. 모르는 거 있으면 편하게 물어봐."', grade: 'good',
        effects: { affinity: { junior: 10 }, mental: 3 },
        reply: [{ who: 'npc', text: '가, 감사합니다! (긴장이 조금 풀린 표정이다)' }],
        tip: '좋은 선임은 군기를 잡는 사람이 아니라 적응을 돕는 사람이다.',
      },
      {
        text: '"군기 바짝 들어라."', grade: 'ok',
        effects: { affinity: { junior: -3 }, discipline: 1 },
        reply: [{ who: 'npc', text: '네, 넵! (잔뜩 얼어붙었다)' }],
        tip: '"군기 잡기"를 명목으로 한 위압적 언행은 부조리가 될 수 있다.',
      },
      {
        text: '(대충 손만 흔든다)', grade: 'bad',
        effects: { affinity: { junior: -6 } },
        reply: [{ who: 'npc', text: '…아, 네.' }],
      },
    ],
  },
  {
    id: 'junior_tour', npc: 'junior', once: true,
    when: (c) => c.day >= 4 && c.affinity.junior >= 0,
    lines: [
      { who: 'npc', text: '선임님, 혹시… PX랑 싸지방이 어디 있는지 알려주실 수 있습니까?' },
    ],
    choices: [
      {
        text: '"따라와. 같이 돌아보자."', grade: 'good',
        effects: { affinity: { junior: 3 }, quest: 'q_junior_tour' },
        reply: [{ who: 'npc', text: '감사합니다!! 바로 따라가겠습니다!' }],
      },
      {
        text: '"표지판 보면 다 나와."', grade: 'bad',
        effects: { affinity: { junior: -4 } },
        reply: [{ who: 'npc', text: '아… 네, 알겠습니다.' }],
      },
    ],
  },
  {
    id: 'junior_struggle', npc: 'junior', once: true,
    when: (c) => c.day >= 5,
    lines: [
      { who: 'npc', text: '선임님… 제가 자꾸 실수해서 다들 저를 싫어하는 것 같습니다.' },
    ],
    choices: [
      {
        text: '"나도 처음엔 매일 실수했어. 내일 같이 연습하자."', grade: 'good',
        effects: { affinity: { junior: 10 }, mental: 3 },
        reply: [{ who: 'npc', text: '선임님도 그러셨습니까? …힘이 납니다!' }],
        tip: '후임의 고민을 들어주는 것만으로도 큰 힘이 된다. 심각하다면 간부에게 연계하자.',
      },
      {
        text: '"실수 좀 줄이면 되지."', grade: 'ok',
        effects: { affinity: { junior: -2 } },
        reply: [{ who: 'npc', text: '…네. 노력하겠습니다.' }],
      },
    ],
  },
  {
    id: 'junior_squad', npc: 'junior', once: true,
    when: (c) => c.day >= 8,
    lines: [
      { who: 'npc', text: '분대장님! 다음 주 휴가 계획 세우는 법 좀 알려주십시오!' },
    ],
    choices: [
      {
        text: '"휴가는 행정반에 미리 신청하고, 복귀 시간 꼭 지키는 거야."', grade: 'good',
        effects: { affinity: { junior: 6 }, discipline: 3 },
        reply: [{ who: 'npc', text: '복귀 시간 엄수! 명심하겠습니다!' }],
        tip: '휴가 복귀 시간은 생명! 늦으면 징계 대상이 될 수 있다.',
      },
      {
        text: '"나가서 일단 치킨부터 먹어."', grade: 'ok',
        effects: { affinity: { junior: 5 }, mental: 2 },
        reply: [{ who: 'npc', text: '그것도 중요한 계획입니다!' }],
      },
    ],
  },

  // ───────── 막내 (junior2) ─────────
  {
    id: 'junior2_arrive', npc: 'junior2', once: true, priority: 12,
    when: (c) => c.day >= 7,
    lines: [
      { who: 'npc', text: '{S}!!! 이병 {n:junior2}!!! 전입을 명받았습니다!!!' },
      { who: 'npc', text: '질문 있습니다! 상병님 계급장은 왜 줄이 세 개입니까?!' },
    ],
    choices: [
      {
        text: '"이병 하나, 일병 둘, 상병 셋, 병장 넷. 줄 수가 계급이야."', grade: 'good',
        effects: { affinity: { junior2: 8 }, discipline: 2 },
        reply: [{ who: 'npc', text: '오오! 그럼 저는 한 줄! 외웠습니다!' }],
        tip: '병사 계급장은 가로 줄 개수로 구분한다. 이병 1줄 ~ 병장 4줄.',
      },
      {
        text: '"…목소리 좀 줄이자."', grade: 'ok',
        effects: { affinity: { junior2: 2 } },
        reply: [{ who: 'npc', text: '(작게) 넵…!!!' }],
      },
    ],
  },
  {
    id: 'junior2_study', npc: 'junior2', once: true,
    when: (c) => c.day >= 8,
    lines: [
      { who: 'npc', text: '선임님! 계급 체계가 너무 헷갈립니다! 같이 외워주실 수 있습니까?' },
    ],
    choices: [
      {
        text: '"침상에서 같이 정리해 보자."', grade: 'good',
        effects: { affinity: { junior2: 3 }, quest: 'q_junior2_rank' },
        reply: [{ who: 'npc', text: '감사합니다! 생활관에서 기다리겠습니다!' }],
      },
      {
        text: '"외우는 건 혼자 하는 거야."', grade: 'bad',
        effects: { affinity: { junior2: -4 } },
        reply: [{ who: 'npc', text: '…넵.' }],
      },
    ],
  },

  // ───────── 소대장 (lt) ─────────
  {
    id: 'lt_first', npc: 'lt', once: true, priority: 10,
    when: (c) => c.day === 1,
    lines: [
      { who: 'npc', text: '{me} 이병, 전입을 환영한다. 소대장 {r:lt}다.' },
      { who: 'npc', text: '포켓몬 몸이라 적응이 쉽지 않겠지만, 힘든 점은 언제든 말해라.' },
    ],
    choices: [
      {
        text: '"{S}! 감사합니다, 소대장님!"', grade: 'good',
        effects: { affinity: { lt: 6 }, discipline: 3 },
        reply: [{ who: 'npc', text: '좋아. 씩씩해서 보기 좋다.' }],
      },
      {
        text: '"넵넵!"', grade: 'ok',
        effects: { affinity: { lt: 1 } },
        reply: [{ who: 'npc', text: '"넵넵"은 메신저에서나 쓰고, 대답은 "네, 알겠습니다"로 하자.' }],
        tip: '간부에게 대답할 땐 "네, 알겠습니다!"처럼 명확하게.',
      },
    ],
  },
  {
    id: 'lt_counsel', npc: 'lt', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '마침 잘 왔다. 신상 면담 좀 하자. 요즘 생활은 어때?' },
    ],
    choices: [
      {
        text: '"솔직히 말씀드리면, 아직 낯설고 힘든 부분이 있습니다."', grade: 'good',
        effects: { affinity: { lt: 6 }, mental: 10 },
        reply: [{ who: 'npc', text: '솔직하게 말해줘서 고맙다. 일과 조정이 필요하면 바로 얘기해.' }],
        tip: '간부 면담은 고민을 공식적으로 이야기할 수 있는 창구다. 솔직할수록 도움을 받기 쉽다.',
      },
      {
        text: '"아무 문제 없습니다!"', grade: 'ok',
        effects: { affinity: { lt: 2 } },
        reply: [{ who: 'npc', text: '그래? 그래도 혹시 모르니 언제든 찾아와.' }],
      },
    ],
  },
  {
    id: 'lt_reported', npc: 'lt', once: true, priority: 30,
    when: (c) => !!c.flags.reported_senior,
    lines: [
      { who: 'npc', text: '{me}, 마음의 편지 잘 읽었다. 용기 내줘서 고맙다.' },
      { who: 'npc', text: '해당 인원과 면담하고 조치했다. 신고자 비밀은 철저히 지킨다.' },
    ],
    effects: { affinity: { lt: 8 }, mental: 6 },
    choices: [
      {
        text: '"감사합니다. 앞으로도 좋은 생활관이 됐으면 합니다."', grade: 'good',
        effects: { discipline: 3 },
        reply: [{ who: 'npc', text: '그래. 그게 우리 모두의 목표다.' }],
        tip: '신고는 고자질이 아니다. 건강한 병영 문화를 만드는 용기 있는 행동이다.',
      },
    ],
  },
  {
    id: 'lt_doc', npc: 'lt', once: true,
    when: (c) => c.day >= 2 && c.affinity.lt >= 4,
    lines: [
      { who: 'npc', text: '{me}, 이 근무표를 {t:sgm}님께 전달해 줄 수 있겠나?' },
    ],
    choices: [
      {
        text: '"네, 알겠습니다! 바로 전달하겠습니다."', grade: 'good',
        effects: { affinity: { lt: 2 }, quest: 'q_lt_doc' },
        reply: [{ who: 'npc', text: '고맙다. {t:sgm}님은 보통 연병장 쪽에 계신다.' }],
      },
      {
        text: '"지금은 개인정비 시간이라… 혹시 급한 일입니까?"', grade: 'ok',
        effects: { affinity: { lt: 1 } },
        reply: [{ who: 'npc', text: '아, 그렇지. 내가 직접 가지. 쉬어라.' }],
        tip: '개인정비 시간은 병사에게 보장된 시간이다. 정중하게 확인하는 것은 문제가 아니다.',
      },
    ],
  },
  {
    id: 'lt_squadleader', npc: 'lt', once: true, priority: 25,
    when: (c) => c.day >= 7,
    lines: [
      { who: 'npc', text: '{me} 상병. 오늘부로 네가 우리 생활관 분대장이다.' },
      { who: 'npc', text: '분대장은 후임들에게 지시할 수 있는 유일한 병사다. 그만큼 책임도 무겁다.' },
    ],
    choices: [
      {
        text: '"명심하겠습니다! 분대원들을 잘 이끌겠습니다."', grade: 'good',
        effects: { affinity: { lt: 6 }, discipline: 6 },
        reply: [{ who: 'npc', text: '믿는다. 모르는 건 언제든 물어봐.' }],
        tip: '병영생활 행동강령상 병 상호 간 명령·지시는 금지지만, 분대장은 분대장 임무 범위 내에서 지시할 수 있다.',
      },
      {
        text: '"그럼 이제 후임들한테 뭐든 시킬 수 있는 겁니까?"', grade: 'bad',
        effects: { affinity: { lt: -6 }, discipline: -4 },
        reply: [{ who: 'npc', text: '…분대장 권한은 임무 범위 안에서만이다. 사적인 지시는 부조리다.' }],
        tip: '분대장이라도 사적인 지시는 부조리다.',
      },
    ],
  },

  // ───────── 행정보급관 / 주임원사 (sgm) ─────────
  {
    id: 'sgm_work', npc: 'sgm', once: true, priority: 4,
    when: (c) => c.day >= 1,
    lines: [
      { who: 'npc', text: '어이~ {me}! 딱 좋은 때 왔다. 우리 작업 좀 하자.' },
      { who: 'npc', text: '2층 체단실 기구들이 엉망이야. 정리 좀 해줄 수 있나?' },
    ],
    choices: [
      {
        text: '"지금이 개인정비 시간이긴 합니다만, 급하시면 돕겠습니다!"', grade: 'good',
        effects: { affinity: { sgm: 4 }, discipline: 2, quest: 'q_sgm_gym' },
        reply: [{ who: 'npc', text: '오, 개념 있네! 금방 끝나. 고맙다.' }],
        tip: '개인정비 시간은 원칙적으로 보장된다. 다만 정중하게 의사를 밝히고 돕는다면 서로 좋다.',
      },
      {
        text: '"네! 알겠습니다!"', grade: 'ok',
        effects: { affinity: { sgm: 6 }, mental: -3, quest: 'q_sgm_gym' },
        reply: [{ who: 'npc', text: '좋아 좋아! 역시 젊은 포켓몬이 최고야.' }],
      },
      {
        text: '"싫은데요."', grade: 'bad',
        effects: { affinity: { sgm: -10 }, discipline: -5 },
        reply: [{ who: 'npc', text: '……(조용히 수첩에 무언가를 적는다)' }],
      },
    ],
  },
  {
    id: 'sgm_uniform', npc: 'sgm', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '{me}, 너 복장 상태가 그게 뭐냐? 털이 삐져나왔잖아.' },
    ],
    choices: [
      {
        text: '"시정하겠습니다!"', grade: 'good',
        effects: { affinity: { sgm: 5 }, discipline: 4 },
        reply: [{ who: 'npc', text: '그래, 그 한마디면 됐다. 포켓몬이라도 복장은 단정하게!' }],
        tip: '"시정하겠습니다" = 지적받은 점을 고치겠다는 군대식 표현.',
      },
      {
        text: '"포켓몬이라 털이 원래 그렇습니다."', grade: 'bad',
        effects: { affinity: { sgm: -5 }, discipline: -2 },
        reply: [{ who: 'npc', text: '핑계는 핑계일 뿐이다~' }],
      },
    ],
  },
  {
    id: 'sgm_snow', npc: 'sgm', once: true,
    when: (c) => c.season === 'winter' || c.season === 'autumn',
    lines: [
      { who: 'npc', text: '{me}, 하늘에서 내리는 게 뭔지 아나?' },
    ],
    choices: [
      {
        text: '"…쓰레기입니까?"', grade: 'good',
        effects: { affinity: { sgm: 8 }, mental: 4 },
        reply: [{ who: 'npc', text: '하하하! 짬 좀 찼네! 낭만은 전역하고 찾자.' }],
        tip: '군대 유머: 눈은 "하늘에서 내리는 쓰레기". 제설 작전은 겨울의 주요 임무다.',
      },
      {
        text: '"낭만입니다!"', grade: 'ok',
        effects: { affinity: { sgm: 2 } },
        reply: [{ who: 'npc', text: '그 낭만, 내일 아침 제설할 때도 유지되나 보자.' }],
      },
    ],
  },
  {
    id: 'sgm_weed', npc: 'sgm', once: true,
    when: (c) => c.season === 'summer' || c.season === 'spring',
    lines: [
      { who: 'npc', text: '여름엔 제초, 겨울엔 제설. 군대는 사계절이 다 작업이지. 안 그래?' },
    ],
    choices: [
      {
        text: '"사계절 내내 부대를 가꾸는 거라고 생각하겠습니다."', grade: 'good',
        effects: { affinity: { sgm: 6 }, discipline: 2 },
        reply: [{ who: 'npc', text: '오~ 마음가짐 좋다. 너 나중에 간부 할래?' }],
      },
      {
        text: '"…쉬는 계절은 없습니까?"', grade: 'ok',
        effects: { affinity: { sgm: 2 }, mental: 1 },
        reply: [{ who: 'npc', text: '있지. 전역.' }],
      },
    ],
  },

  // ───────── 중대장 (cpt) ─────────
  {
    id: 'cpt_talk', npc: 'cpt', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '{me} {myrank}. 부대 생활 적응은 잘 하고 있나?' },
    ],
    choices: [
      {
        text: '"{S}! 네, 선임들과 간부님들 덕분에 잘 적응하고 있습니다!"', grade: 'good',
        effects: { affinity: { cpt: 6 }, discipline: 3 },
        reply: [{ who: 'npc', text: '좋다. 서로 돕는 부대가 강한 부대다.' }],
      },
      {
        text: '"그럭저럭입니다."', grade: 'ok',
        effects: { affinity: { cpt: 1 } },
        reply: [{ who: 'npc', text: '그럭저럭도 괜찮다. 힘들면 지휘계통으로 보고해라.' }],
        tip: '지휘계통: 분대장 → 소대장 → 중대장 순으로 보고하는 것이 원칙이다.',
      },
    ],
  },
  {
    id: 'cpt_award', npc: 'cpt', once: true,
    when: (c) => c.day >= 8,
    lines: [
      { who: 'npc', text: '{me}, 요즘 분대장 역할 잘 하고 있다고 들었다.' },
      { who: 'npc', text: '포상휴가 추천을 고민 중인데, 후보로 누굴 올리면 좋겠나?' },
    ],
    choices: [
      {
        text: '"고생한 후임 {n:junior} 이병을 추천합니다."', grade: 'good',
        effects: { affinity: { cpt: 6, junior: 8 }, discipline: 3 },
        reply: [{ who: 'npc', text: '후임을 먼저 챙기다니, 분대장답군. 검토하겠다.' }],
      },
      {
        text: '"저… 저 말씀이십니까?"', grade: 'ok',
        effects: { affinity: { cpt: 2 }, mental: 4 },
        reply: [{ who: 'npc', text: '하하, 솔직하군. 실적으로 증명해라.' }],
      },
    ],
  },

  // ───────── 장소별 부탁 (막사 시설 · 야외 구역) ─────────
  {
    id: 'sgt_recycle', npc: 'sgt', once: true,
    when: (c) => c.day >= 2,
    lines: [
      { who: 'npc', text: '{n:me}, 오늘 생활관 분리수거 당번이 너다.' },
      { who: 'npc', text: '분리수거장은 병영식당 앞에서 아래쪽 길로 쭉 가면 있다. 페트병 라벨 떼는 거 잊지 말고.' },
    ],
    choices: [
      {
        text: '"알겠습니다! 바로 다녀오겠습니다!"', grade: 'good',
        effects: { affinity: { sgt: 2 }, quest: 'q_sgt_recycle' },
        reply: [{ who: 'npc', text: '그래. 다녀와서 보고해라.' }],
        tip: '분대장은 생활관 청소·당번처럼 분대장 임무 범위 안에서 분대원에게 지시할 수 있다.',
      },
      {
        text: '"분리수거장이 어디인지 잘 모르겠습니다…"', grade: 'ok',
        effects: { affinity: { sgt: 1 }, quest: 'q_sgt_recycle' },
        reply: [{ who: 'npc', text: '모르면 물어보는 게 맞다. 병영식당 앞 아래쪽 길, 표지판 따라가.' }],
      },
    ],
  },
  {
    id: 'sgt_water', npc: 'sgt', once: true,
    when: (c) => c.done.includes('q_sgt_recycle'),
    lines: [
      { who: 'npc', text: '{n:me}, 복도 정수기 점검표 좀 봐 줄래? 1층이랑 2층 둘 다.' },
      { who: 'npc', text: '필터 교체일 지났으면 행보관님께 말씀드려야 하거든.' },
    ],
    choices: [
      { text: '"네! 확인하고 보고드리겠습니다."', grade: 'good', effects: { affinity: { sgt: 2 }, quest: 'q_sgt_water' }, reply: [{ who: 'npc', text: '그래, 부탁한다.' }] },
      { text: '"지금은 일이 좀 있어서요…"', grade: 'ok', effects: { affinity: { sgt: -1 } }, reply: [{ who: 'npc', text: '그래, 그럼 다음에.' }] },
    ],
  },
  {
    id: 'buddy_laundry', npc: 'buddy', once: true,
    when: (c) => c.day >= 2 && isFreeTimeEvening(c.minute),
    lines: [
      { who: 'npc', text: '야… 세탁기 다 돌았는데, 혼자 개기엔 너무 많다.' },
      { who: 'npc', text: '1층 세탁실에서 같이 개 줄 수 있어? 대신 내일 네 빨래도 같이 개 줄게.' },
    ],
    choices: [
      { text: '"그래, 같이 하자!"', grade: 'good', effects: { affinity: { buddy: 2 }, quest: 'q_buddy_laundry' }, reply: [{ who: 'npc', text: '역시 동기밖에 없다!' }], tip: '동기끼리 서로 돕는 건 부조리가 아니라 전우애. 받은 만큼 돌려주면 된다.' },
      { text: '"미안, 나 지금 좀 바빠."', grade: 'ok', effects: { affinity: { buddy: -1 } }, reply: [{ who: 'npc', text: '아냐아냐, 괜찮아. 다음에!' }] },
    ],
  },
  {
    id: 'senior_book', npc: 'senior', once: true,
    when: (c) => c.done.includes('q_senior_leave') && c.affinity.senior >= 3,
    lines: [
      { who: 'npc', text: '{n:me}~ 부탁 하나만 하자. 명령 아니고 부탁!' },
      { who: 'npc', text: '이 책 오늘까지 2층 도서관 반납인데 내가 근무라서… 대신 반납해 주면 초코파이 쏜다.' },
    ],
    choices: [
      { text: '"네, 반납해 드리겠습니다."', grade: 'good', effects: { affinity: { senior: 2 }, quest: 'q_senior_book' }, reply: [{ who: 'npc', text: '역시! 반납 대장에 내 이름 쓰는 것도 잊지 마.' }], tip: '선임의 사적인 부탁은 들어줘도, 정중히 거절해도 된다. 거절했다고 불이익을 주면 그게 부조리다.' },
      { text: '"죄송하지만 저도 오늘 일정이 있어서요."', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '아, 그래? 알았어. 근무 끝나고 내가 갈게.' }], tip: '선임의 사적인 부탁은 들어줘도, 정중히 거절해도 된다. 거절했다고 불이익을 주면 그게 부조리다.' },
    ],
  },
  {
    id: 'senior_maint', npc: 'senior', once: true,
    when: (c) => c.day >= 5,
    lines: [
      { who: 'npc', text: '어제 정비실에서 빌린 공구 반납하러 가는데, 같이 갈래?' },
      { who: 'npc', text: '공구 대장 쓰는 법 알려 줄게. 나 전역하면 네가 해야 하니까.' },
    ],
    choices: [
      { text: '"네! 배워 두겠습니다."', grade: 'good', effects: { affinity: { senior: 2 }, quest: 'q_senior_maint' }, reply: [{ who: 'npc', text: '좋아. 1층 정비실로 가자.' }] },
      { text: '"다음에 알려 주십시오."', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '그래, 아직 시간 있으니까.' }] },
    ],
  },
  {
    id: 'junior_court', npc: 'junior', once: true,
    when: (c) => c.done.includes('q_junior_tour') && isFreeTimeEvening(c.minute),
    lines: [
      { who: 'npc', text: '{myrank}님! 눈이 마주쳤으면 승부입니다! 저녁에 농구 한 판 하시겠습니까?' },
      { who: 'npc', text: '2분대랑 시합이 잡혔는데 한 명이 모자랍니다. 연병장 옆 농구장입니다!' },
    ],
    choices: [
      { text: '"좋지! 가자!"', grade: 'good', effects: { affinity: { junior: 2 }, quest: 'q_junior_court' }, reply: [{ who: 'npc', text: '감사합니다! 먼저 가서 몸 풀고 있겠습니다!' }] },
      { text: '"오늘은 좀 쉴게."', grade: 'ok', effects: { affinity: { junior: -1 } }, reply: [{ who: 'npc', text: '아, 알겠습니다! 다음에 꼭 같이 뛰십시오!' }] },
    ],
  },
  {
    id: 'junior2_board', npc: 'junior2', once: true,
    lines: [
      { who: 'npc', text: '{myrank}님, 질문 있습니다! 이번 달 생일자가 누군지 아십니까?' },
      { who: 'npc', text: '게시판에 붙어 있다던데 어디 있는지 모르겠습니다…' },
    ],
    choices: [
      { text: '"1층 복도 게시판에 있어. 같이 보러 가자."', grade: 'good', effects: { affinity: { junior2: 3 }, quest: 'q_junior2_board' }, reply: [{ who: 'npc', text: '감사합니다! 따라가겠습니다!' }], tip: '복도 게시판에는 경계작전명령서, 식단표, 생일자 같은 공지가 붙는다. 전입 신병이 제일 먼저 볼 곳!' },
      { text: '"직접 찾아봐. 그것도 공부다."', grade: 'bad', effects: { affinity: { junior2: -2 } }, reply: [{ who: 'npc', text: '아… 네, 알겠습니다.' }] },
    ],
  },
  {
    id: 'sgm_kitchen', npc: 'sgm', once: true,
    when: (c) => c.day >= 3,
    lines: [
      { who: 'npc', text: '어이, {n:me}. 오늘 조리실 일손이 모자란다.' },
      { who: 'npc', text: '병영식당 안쪽 조리실 가서 취사 지원 좀 하고 와. 조리병들 고생 많다.' },
    ],
    choices: [
      { text: '"알겠습니다! 다녀오겠습니다."', grade: 'good', effects: { affinity: { sgm: 2 }, quest: 'q_sgm_kitchen' }, reply: [{ who: 'npc', text: '그래. 끝나면 나한테 와라.' }] },
      { text: '"오늘 일과가 많아서…"', grade: 'bad', effects: { affinity: { sgm: -2 } }, reply: [{ who: 'npc', text: '…알았다. 다음엔 꼭 가라.' }] },
    ],
  },
  {
    id: 'lt_ammo', npc: 'lt', once: true,
    when: (c) => c.day >= 3 && c.done.includes('q_lt_doc'),
    lines: [
      { who: 'npc', text: '{n:me}, 부탁 하나 하지. 이 근무 일지로 {ammo} 출입 기록을 확인하고,' },
      { who: 'npc', text: '위병소 근무자에게 전달해 줄 수 있나? 연병장 아래쪽 길로 가면 된다.' },
    ],
    choices: [
      { text: '"네, 확인하고 전달하겠습니다!"', grade: 'good', effects: { affinity: { lt: 2 }, quest: 'q_lt_ammo' }, reply: [{ who: 'npc', text: '고맙다. 보안 문서니까 다른 데 두지 말고.' }], tip: '근무 일지·출입 기록은 보안 문서. 전달할 때도 지정된 사람에게만 직접 건넨다.' },
      { text: '"지금은 어렵습니다."', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '그래, 다른 사람에게 부탁하지.' }] },
    ],
  },

  // ───────── 연계 퀘스트 (체인 3단계) ─────────
  {
    id: 'sgt_handover', npc: 'sgt', once: true,
    when: (c) => c.done.includes('q_sgt_water'),
    lines: [
      { who: 'npc', text: '{n:me}. 나 이제 전역이 얼마 안 남았다.' },
      { who: 'npc', text: '분대 살림 인수인계 노트를 만들려는데… 같이 정리해 줄래? 행정반 서류랑 게시판 공지부터.' },
    ],
    choices: [
      { text: '"네! 꼼꼼하게 정리하겠습니다."', grade: 'good', effects: { affinity: { sgt: 3 }, quest: 'q_sgt_handover' }, reply: [{ who: 'npc', text: '고맙다. 사실 너한테 넘겨주고 싶었다.' }], tip: '인수인계는 업무·장비·인원 현황을 문서로 넘겨주는 것. 말로만 넘기면 반드시 구멍이 생긴다.' },
      { text: '"아직은 좀 이른 것 같습니다…"', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '그런가? 그래도 생각나면 말해라.' }] },
    ],
  },
  {
    id: 'senior_gift', npc: 'senior', once: true,
    when: (c) => c.done.includes('q_senior_book'),
    lines: [
      { who: 'npc', text: '{n:me}~ 나 휴가 나가는데, 조카 선물을 뭘 사야 할지 모르겠어.' },
      { who: 'npc', text: 'PX 같이 가서 골라 줄래? 내 돈으로 사는 거니까 걱정 마!' },
    ],
    choices: [
      { text: '"좋습니다! 같이 골라 드리겠습니다."', grade: 'good', effects: { affinity: { senior: 2 }, quest: 'q_senior_gift' }, reply: [{ who: 'npc', text: '역시 너밖에 없다~' }] },
      { text: '"선물은 직접 고르시는 게…"', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '그것도 맞는 말이네. 혼자 가 볼게~' }] },
    ],
  },
  {
    id: 'buddy_exam', npc: 'buddy', once: true,
    when: (c) => c.done.includes('q_buddy_study'),
    lines: [
      { who: 'npc', text: '야, 우리 공부한 거 아깝잖아. 이번 회차 시험 접수하자!' },
      { who: 'npc', text: '싸지방에서 접수하고, 행정반에 외출 승인 서류도 내야 한대.' },
    ],
    choices: [
      { text: '"좋아, 같이 접수하자!"', grade: 'good', effects: { affinity: { buddy: 2 }, quest: 'q_buddy_exam' }, reply: [{ who: 'npc', text: '좋아! 수험표 뽑으면 사진 찍어 두자.' }], tip: '군 복무 중에도 자격증 시험을 볼 수 있다. 응시료 지원 제도도 있으니 행정반에 문의해 보자.' },
      { text: '"나는 다음 회차에 볼게."', grade: 'ok', effects: { affinity: { buddy: -1 } }, reply: [{ who: 'npc', text: '그래… 그럼 나 먼저 붙고 올게!' }] },
    ],
  },
  {
    id: 'buddy_result', npc: 'buddy', once: true,
    when: (c) => c.done.includes('q_buddy_exam') && c.day >= 6,
    lines: [
      { who: 'npc', text: '오늘… 합격 발표 날이야. 혼자 보기 무서워.' },
      { who: 'npc', text: '싸지방 같이 가 줄 수 있어?' },
    ],
    choices: [
      { text: '"같이 보자. 우리 둘 다 붙었을 거야."', grade: 'good', effects: { affinity: { buddy: 2 }, quest: 'q_buddy_result' }, reply: [{ who: 'npc', text: '…좋아. 하나, 둘, 셋 하면 같이 누르자.' }] },
    ],
  },
  {
    id: 'junior_mentor', npc: 'junior', once: true,
    when: (c) => c.done.includes('q_junior_court'),
    lines: [
      { who: 'npc', text: '{myrank}님, 다음 주 체력검정이 걱정입니다…' },
      { who: 'npc', text: '자세 좀 봐 주실 수 있습니까? 그리고 게시판 보는 법도 아직 헷갈립니다.' },
    ],
    choices: [
      { text: '"그래, 체단실로 가자. 게시판도 같이 보고."', grade: 'good', effects: { affinity: { junior: 3 }, quest: 'q_junior_mentor' }, reply: [{ who: 'npc', text: '감사합니다! 열심히 따라 하겠습니다!' }], tip: '후임을 가르칠 땐 명령이 아니라 시범과 설명으로. 병영생활 행동강령상 지시는 분대장 몫이다.' },
      { text: '"알아서 연습해 봐."', grade: 'bad', effects: { affinity: { junior: -3 } }, reply: [{ who: 'npc', text: '…네, 알겠습니다.' }] },
    ],
  },
  {
    id: 'lt_report', npc: 'lt', once: true,
    when: (c) => c.done.includes('q_lt_ammo'),
    lines: [
      { who: 'npc', text: '{n:me}, 저번 근무 일지 전달 잘 해 줬다.' },
      { who: 'npc', text: '이번 주 근무 결과 보고서를 쓰는데, 기록 정리를 도와줄 수 있겠나?' },
    ],
    choices: [
      { text: '"네, 돕겠습니다!"', grade: 'good', effects: { affinity: { lt: 2 }, quest: 'q_lt_report' }, reply: [{ who: 'npc', text: '좋아. 지휘통제실 기록부터 보자.' }] },
      { text: '"지금은 어렵습니다."', grade: 'ok', effects: {}, reply: [{ who: 'npc', text: '알겠다. 다음에 부탁하지.' }] },
    ],
  },

  // ───────── 메인 스토리 1장 「눈을 떠 보니」 ─────────
  {
    id: 'buddy_human', npc: 'buddy', once: true, priority: 5,
    when: (c) => c.day >= 2 && c.day <= 3 && c.flags.dream_1 && isFreeTimeEvening(c.minute),
    lines: [
      { who: 'npc', text: '야… 너 가끔 사람처럼 말하더라.' },
      { who: 'npc', text: '아까도 "유튜브에서 봤는데"라고 했잖아. 유튜브가 뭐야?' },
    ],
    choices: [
      {
        text: '"…그냥 꿈에서 본 거야."', grade: 'ok', effects: { affinity: { buddy: 1 } },
        reply: [{ who: 'npc', text: '그래? …나도 요즘 이상한 꿈을 꿔. 별이 막 쏟아지는 꿈.' }],
      },
      {
        text: '"너는… 혹시 기억나는 거 없어? 여기 오기 전에."', grade: 'good', effects: { affinity: { buddy: 3 }, memory: 2 },
        reply: [
          { who: 'npc', text: '기억…? 몰라. 생각하려고 하면 머리가 아파.' },
          { who: 'narr', text: '(동기가 머리를 감싸 쥔다.)' },
          { who: 'npc', text: '…근데 왠지, 너랑은 전부터 알던 사이 같아.' },
        ],
      },
    ],
  },
  {
    id: 'sgt_warning', npc: 'sgt', once: true, priority: 6,
    when: (c) => c.day === 3 && c.flags.dream_1 && c.minute >= 17 * 60,
    lines: [
      { who: 'npc', text: '{n:me}. 나 내일이면 없다.' },
      { who: 'npc', text: '…이상한 얘기 하나 해 줄까. 여기 오래 있으면, 원래 뭐였는지 잊어버린다더라.' },
      { who: 'npc', text: '나도 들은 얘기다. 근데 너 보면 자꾸 그 말이 생각나.' },
      { who: 'npc', text: '너는 잊지 마라. 뭐였든 간에.' },
    ],
    effects: { memory: 2 },
  },
];

/** 전역일 작별 인사 */
export const FAREWELL_LINES: Partial<Record<NpcId, string>> = {
  buddy: '우리 같은 날 들어와서 같은 날 나가네. 사회에서도 동기다, 알지?',
  junior: '분대장님 덕분에 버틸 수 있었습니다. 전역 축하드립니다!',
  junior2: '분대장님!!! 전역 축하드립니다!!! 저도 금방 따라가겠습니다!!!',
  lt: '수고 많았다. 네 덕분에 소대 분위기가 많이 좋아졌다.',
  sgm: '이제 작업 안 시킨다~ 사회 나가서도 부지런히 살아라.',
  cpt: '그동안 국가를 위해 수고했다. 자랑스러운 예비역이 되도록.',
};

/** 이미 대화한 경우 / 조건에 맞는 대화가 없을 때 */
export const SMALL_TALK: Partial<Record<NpcId, string[]>> = {
  sgt: ['개인정비 시간엔 푹 쉬어라.', '점호 시간 늦지 마라.', '전역까지… 아 행복하다.'],
  senior: ['심심하다~ 뭐 재밌는 거 없냐?', '오늘 PX 냉동 신상 나왔대.', '분대장님 몰래 낮잠 자고 싶다…', '내가 왜 이렇게 PX를 자주 가냐고 물으신다면~ 대답해 드리는 게 인지상정!', '분대장님한테 또 걸렸다… 오늘도 또 당했다~ (반짝)'],
  buddy: ['우리 오늘도 살아남았다…', '휴가 날짜 세는 중이야.', '밥 맛있었지? 나만 그래?', '으으… 머리가 아파… (왠지 고라파덕처럼 머리를 감싸 쥐고 있다)'],
  junior: ['선임님! 오늘도 잘 부탁드립니다!', '오늘 실수 안 했습니다!', '선임님 존경합니다!'],
  junior2: ['선임님!!! 질문 있습니다!!! …까먹었습니다!!!', '오늘 경례 각도 완벽했습니다!'],
  lt: ['아픈 데는 없지?', '오늘 훈련 수고 많았다.', '보고는 두괄식, 알지?'],
  sgm: ['작업할 거 없나 찾는 중이다~', '복장 단정!', '눈 오면 나 찾아와라. 아니, 내가 찾아간다.'],
  cpt: ['수고가 많다.', '안전이 최우선이다.', '부대의 주인은 너희다.'],
};

/** 군별 잡담 — 전작 오마주 (SMALL_TALK에 더해진다) */
export const SMALL_TALK_BRANCH: Partial<Record<BranchId, Partial<Record<NpcId, string[]>>>> = {
  army: {
    sgt: ['가디는 원래 경찰견 출신이 많다더라. 나도 군견병 갈 뻔했다.', '내가 이등병 땐 말이야… 아니다. 요즘 애들은 좋겠다.'],
    cpt: ['…날개가 있다고 다 나는 건 아니다. 때를 기다려라.', '불꽃이 꺼지면 끝이라고들 하지. 그러니 꼬리 불은 늘 지켜라.'],
    buddy: ['어릴 때 잉어킹을 500원에 산 적이 있어. 사기당한 줄 알았는데, 나중에 갸라도스가 되더라.'],
  },
  navy: {
    // 라프라스: 금요일마다 연결동굴에 나타나던 그 라프라스
    sgt: ['입대 전 취미? 매주 금요일마다 연결동굴에 갔지. 이상하게 금요일만 되면 거기 가고 싶더라.', '사람 태우고 바다 건너는 거, 그거 하나는 자신 있다.', '…요즘 금요일만 되면 동굴 물소리가 그립다.'],
    // 갸라도스: 분노의 호수의 빨간 갸라도스
    cpt: ['…젊을 땐 성질이 불같았지. 분노의 호수에서 혼자 빨갛게 날뛰던 시절도 있었다.', '그때 날 붙잡아 준 녀석이 있었다. 지금은 이렇게 파랗게 철들었지만.', '잉어킹 시절을 잊지 마라. 다들 처음엔 튀어오르기밖에 못 했다.'],
    buddy: ['잉어킹이라고 무시하지 마. 튀어오르기도 계속 하면 언젠간… 뭔가 되겠지.'],
  },
  air: {
    sgt: ['구름 위에서 노래하는 게 꿈이었다. 활주로 소음 때문에 아무도 안 들어 주지만.'],
    cpt: ['마하 2로 나는 기분, 너희도 언젠가 알게 될 거다.', '하늘을 나는 비전머신? 그런 건 없다. 노력이 비전이다.'],
    buddy: ['주뱃은 눈이 없다고? 마음의 눈으로 다 보고 있어.'],
  },
};
/** 주요 인물 잡담 추가분 (세 군 공통) — 전작 오마주 · 일상 */
export const SMALL_TALK_MORE: Partial<Record<NpcId, string[]>> = {
  sgt: ['인사는 크게, 대답은 짧게. 그게 다다.'],
  senior: ['이상한사탕 몇 개 먹으면 병장 되냐? …PX에서 파는 건 그냥 사탕이더라.', '야, 트럭 밑에 뮤 있다는 거 진짜일까? 아니 그냥 궁금해서.'],
  buddy: ['내 이름이… 아, 아니야. 그냥 잠깐 멍했어.'],
  junior: ['선임님, 제 친구 꼬렛은 상위 1% 꼬렛이었습니다! …아, 이 얘기 안 궁금하십니까?', '선임님! 눈이 마주치면 승부라던데, 그럼 경례할 때도 승부입니까?'],
  junior2: ['선임님!!! 풀숲은 위험하다고 하셔서 제초 작업 때 무서웠습니다!!!', '선임님!!! 오늘 경례 몇 점입니까!!!'],
  lt: ['근무 일지 쓸 때 날짜 빼먹지 마라. 요즘 자꾸 빈칸이 보여.', '"이건 네가 쓸 때가 아니다!" …예전에 누가 나한테 그러더라. 무슨 뜻인지는 아직도 모르겠다.'],
  sgm: ['제초는 전설이다. 풀숲엔 뭐가 튀어나올지 몰라.', '자전거? 부대 안에서는 자전거 타면 안 된다. …내리는 것도 허락받고 내려라.'],
  cpt: ['보고는 짧게, 행동은 빠르게.'],
};
/** 엑스트라 잡담 추가분 (세 군 공통, 엑스트라 id) */
export const EXTRA_TALK_MORE: Record<string, string[]> = {
  guard: ['목이 마르다… 시원한 물 한 잔 주면 아무나 통과시켜 줄 것 같다. 농담이다, 신분 확인은 해야지.', '여긴 지나갈 수 없다! …라고 한 번 말해 보고 싶었다.'],
  medic: ['♪ 띠리리리링~ …아, 습관이다. 다 나았다는 소리야.', '맡겨 주신 포켓몬은 모두 건강해졌습니다! …아, 여긴 의무실이었지.'],
  px: ['이상한사탕은 그냥 사탕이에요. 레벨은 안 올라요. 진짜로요.', '오늘의 추천: 초코파이. 정(情)은 포켓몬도 통합니다.'],
  cyber: ['이 PC, 원래 이수재라는 사람 거였대. 가끔 "누군가의 PC"라고 떠.', '도감 등록은 아직 몇 마리 안 됐어. 언젠가 다 채울 거야.'],
  gym: ['운동은 노력치다. 눈엔 안 보여도 쌓인다.', '보이지 않는 능력치가 제일 중요하대.'],
  lounge: ['TV에서 또 잉어킹이 튀어오르기 하더라. 아무 일도 안 일어났어.', '어제 꿈에 달 같은 게 떨어지는 걸 봤어. 피피 인형 같은 게 춤추더라.'],
  runner: ['연병장 한 바퀴 더! 빠르기 노력치는 배신하지 않는다!', '달리다 보면 가끔 풀숲에서 뭔가 튀어나와. 진짜야.'],
  dog: ['(군견이 꼬리를 흔든다. 가디·윈디의 먼 친척 같은 눈빛이다.)', '(왈! …"이 녀석, 너를 좋아하는 것 같다.")'],
  clerk: ['서류에 서명할 땐 꼬리 끝으로. 그게 내 시그니처야.'],
  cook: ['배식 전엔 깨우지 마라. 배식 후에도 깨우지 마라.', '오늘 메뉴? 일단 먹고 생각해.'],
};
/** 같은 사람에게 연달아 같은 말을 하지 않게 (방금 한 말은 빼고 고른다) */
const lastTalk: Record<string, string> = {};
export function pickTalk(key: string, pool: string[]): string {
  if (!pool.length) return '…';
  const cand = pool.length > 1 ? pool.filter((l) => l !== lastTalk[key]) : pool;
  const line = cand[Math.floor(Math.random() * cand.length)];
  lastTalk[key] = line;
  return line;
}
/** 주요 인물 잡담 후보: 공통 + 추가분 + 군별 오마주 */
export function smallTalkPool(branch: BranchId, id: NpcId): string[] {
  return [...(SMALL_TALK[id] ?? []), ...(SMALL_TALK_MORE[id] ?? []), ...(SMALL_TALK_BRANCH[branch]?.[id] ?? [])];
}

export function isLastDay(day: number) {
  return day >= TOTAL_DAYS;
}
