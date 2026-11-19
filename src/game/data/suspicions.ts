/**
 * 의혹 수첩 (docs/lore/mystery.md)
 * 밝아 보이는 부대의 미심쩍은 점들. 날짜나 단서로 열리고, 단서를 찾을 때마다 실마리가 붙고,
 * 결정적인 단서나 추리 정리로 풀린다. 상태는 저장하지 않고 진행 상황에서 계산한다.
 */

/** 조건: 적힌 것이 모두 맞아야 한다 */
export interface SusCond {
  /** 이 날부터 */
  day?: number;
  /** 이 단서를 찾았을 때 */
  clue?: string;
  /** 이 진행 표시가 켜졌을 때 */
  flag?: string;
}

export interface SuspicionDef {
  id: string;
  title: string;
  /** 수첩에 적는 물음 */
  question: string;
  open: SusCond;
  /** 조건이 맞으면 한 줄씩 붙는 실마리 */
  leads: { when: SusCond; text: string }[];
  solved: SusCond;
  /** 풀렸을 때 적히는 답 */
  answer: string;
}

export const SUSPICIONS: SuspicionDef[] = [
  {
    id: 'S1',
    title: '나는 누구인가',
    question: '나는 왜 포켓몬이 되어 여기 있는 걸까.',
    open: { clue: 'C-01' },
    leads: [
      { when: { clue: 'C-01' }, text: '베개 밑의 별 조각. 쥐자 엄마 목소리가 들렸다.' },
      { when: { clue: 'C-02' }, text: '거울 속에 1초, 사람이 서 있었다.' },
      { when: { clue: 'C-03' }, text: '생일자 명단에 내 이름. 생일 칸에는 "입대일". 이 부대는 내가 올 줄 알고 있었다.' },
      { when: { clue: 'C-05' }, text: '엄마의 편지. 현실의 나는 입대일 아침에 깨어나지 못했다.' },
    ],
    solved: { flag: 'd01' },
    answer: '나는 입대 전날 밤 별에 소원을 빈 사람이다. 포켓몬이 된 건 그 소원 때문이다. 동기도 같은 밤, 같은 별을 봤다.',
  },
  {
    id: 'S2',
    title: '너무 밝은 부대',
    question: '왜 아무도 힘들다고 하지 않을까.',
    open: { clue: 'C-01', day: 2 },
    leads: [
      { when: { day: 2 }, text: '힘든 일과 뒤에도 다들 웃는다. 아침마다 "오늘도 좋은 하루!"' },
      { when: { day: 5 }, text: '힘들다는 말을 꺼내려 하면 졸음이 온다. 자고 나면 무엇이 힘들었는지 잊는다.' },
      { when: { day: 9 }, text: '요즘은 나도 편하다. 생각하지 않아도 하루가 간다. 그게 무섭다.' },
    ],
    solved: { flag: 'b01' },
    answer: '이 부대의 밝음은 누군가 지켜 주는 꿈이라서다. 걱정은 밤마다 먹히고, 아침에는 웃음만 남는다. 편안함의 값은 기억이었다.',
  },
  {
    id: 'S3',
    title: '정문 밖의 안개',
    question: '정문 밖에는 무엇이 있을까.',
    open: { clue: 'C-01', day: 3 },
    leads: [
      { when: { day: 3 }, text: '분대장은 정문을 나가 본 적이 없다고 했다. 나가 본 사람을 만난 사람도 없다.' },
      { when: { clue: 'C-04' }, text: '한 발 나갔는데 다시 초소 앞이었다. 안개 속 목소리: "나가지 않아도 돼."' },
      { when: { clue: 'C-08' }, text: '「별똥별 부대사」: 별이 깨어날 때, 소원은 부대가 된다.' },
    ],
    solved: { flag: 'd03' },
    answer: '안개는 꿈의 끝이다. 이 부대는 소원이 만든 꿈이고, 소원을 거두기 전에는 아무도 나갈 수 없다.',
  },
  {
    id: 'S4',
    title: '사라지는 전역자',
    question: '전역한 사람은 어디로 가는 걸까.',
    open: { clue: 'C-01', day: 4 },
    leads: [
      { when: { day: 4 }, text: '분대장이 전역한 다음 날. 아무도 그의 이름을 꺼내지 않는다. 물어보면 다들 웃으며 "누구?"라고 한다.' },
      { when: { day: 7 }, text: '맞선임도 갔다. 편지는 없다. 오늘 온 막내는 나를 "어디서 본 것 같다"고 한다.' },
      { when: { clue: 'C-09' }, text: '해마다 다른 필체의 "집에 가고 싶다". 아무도 부치지 못했다.' },
      { when: { clue: 'C-16' }, text: '분리수거장 구석의 돌탑. 돌아오지 못한 사람들이 돌이 되어 쌓여 있다. 백여덟 자리에 돌은 백일곱.' },
      { when: { clue: 'C-17' }, text: '탄약고 수불 대장. 2인 1조로 들어갔는데 서명은 하나뿐이다. 군견은 아직 짝을 기다린다.' },
      { when: { clue: 'C-12' }, text: '단체 사진. 해마다 같은 자리에 같은 얼굴의 이병이 서 있다.' },
    ],
    solved: { flag: 'd02' },
    answer: '여기서 "전역"한 사람은 집에 가지 않는다. 안개 속에서 이름을 잃고, 다시 이병이 되어 돌아온다. 소원을 거두지 못한 사람은 그렇게 부대의 일부가 된다.',
  },
  {
    id: 'S5',
    title: '멈추는 시계',
    question: '누가, 무엇까지의 날짜를 세고 있을까.',
    open: { clue: 'C-07' },
    leads: [
      { when: { clue: 'C-07' }, text: '시계는 자정마다 1분씩 멈춘다. 근무 일지 끝에는 낯선 필체의 "D-며칠".' },
      { when: { clue: 'C-11' }, text: '불 꺼진 서가의 글자들: "별이 지기 전에."' },
    ],
    solved: { clue: 'C-13' },
    answer: '날짜를 적은 건 2분대의 말 없는 병장이다. 별이 지는 날까지 남은 날을, 십 년째 다음 사람을 위해 세고 있었다.',
  },
  {
    id: 'S6',
    title: '지워진 이름',
    question: '명찰의 "이준서"는 누구일까.',
    open: { clue: 'C-06' },
    leads: [
      { when: { clue: 'C-06' }, text: '세탁기에서 나온 낡은 명찰. 동기는 모르는 이름이라면서 울었다.' },
      { when: { clue: 'C-10' }, text: '라디오: "같은 날 밤 쓰러진 청년이 또 한 명."' },
      { when: { flag: 'm13' }, text: '동기가 내 이름을 잊었다. 이 부대는 이름부터 가져간다.' },
    ],
    solved: { flag: 'buddyBack' },
    answer: '이준서는 동기의 진짜 이름이다. 이 부대는 이름부터 가져간다. 함께 맞춘 명찰이 그 이름을 돌려줬다.',
  },
  {
    id: 'S7',
    title: '밤의 당직부관',
    question: '밤마다 복도를 도는 똑딱 소리의 주인은 누구일까.',
    open: { flag: 'n03' },
    leads: [
      { when: { flag: 'n03' }, text: '처음 보는 당직부관. "눈을 감으면 편해져." 다음 날, 그런 사람은 없었다고 한다.' },
      { when: { clue: 'C-14' }, text: '잠긴 상자 둘레의 둥근 자국. 누군가 별 조각을 숨기고 있었다.' },
    ],
    solved: { flag: 'd03' },
    answer: '밤마다 나타난 건 간부가 아니다. 진자를 든 무언가가 별 조각을 숨기고, 우리를 재우고 있다.',
  },
];

export type SusState = 'hidden' | 'open' | 'solved';
export interface SusProgress { day: number; clues: string[]; flags: Record<string, boolean> }

const met = (c: SusCond, s: SusProgress) =>
  (c.day === undefined || s.day >= c.day) && (c.clue === undefined || s.clues.includes(c.clue)) && (c.flag === undefined || !!s.flags[c.flag]);

export function suspicionState(d: SuspicionDef, s: SusProgress): SusState {
  if (!met(d.open, s)) return 'hidden';
  return met(d.solved, s) ? 'solved' : 'open';
}
/** 지금까지 붙은 실마리 */
export const suspicionLeads = (d: SuspicionDef, s: SusProgress) => d.leads.filter((l) => met(l.when, s)).map((l) => l.text);
