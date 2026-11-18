/**
 * 두뇌 퍼즐 데이터 (docs/lore/puzzles.md)
 * - 필수 퍼즐(P-xx): 스토리 미션의 "살펴보기" 뒤에 붙는다. 풀어야 단서가 열린다
 * - 한 번에 풀수록 🌟 인간의 기억이 많이 되살아난다. 오답으로 기억이 깎이지는 않는다
 * - 힌트는 3단계. 단계마다 별사탕 1개
 */

/** 새 게임을 시작할 때 갖고 있는 별사탕 (건빵 한 봉지 분량) */
export const CANDY_START = 3;
/** 관문 퍼즐(별 조각)은 기억 보상이 더 크다 */
export const GATE_BONUS = 2;

/** 답을 넣는 방식 */
export type PuzzleInput =
  /** 시각 입력: 시 · 분 */
  | { type: 'time'; hour: number; minute: number }
  /** 여럿 가운데 하나 고르기 */
  | { type: 'choice'; options: string[]; answer: number }
  /** 순서 배열: 두 개를 차례로 눌러 자리를 바꾼다 */
  | {
      type: 'order'; items: OrderItem[]; start: string[]; answer: string[];
      /** books: 책장 · tiles: 가로 타일 · rows: 세로로 쌓인 긴 글 */
      view?: 'books' | 'tiles' | 'rows';
      compose?: 'nametag';
      /** 앞의 몇 칸만 답으로 본다 (나머지는 쓰지 않는 카드) */
      checkFirst?: number;
    }
  /** 사진마다 얼굴 하나씩 짚기. 모든 사진에서 target 칸을 짚어야 정답 */
  | { type: 'photos'; photos: { label: string; faces: string[] }[]; cols: number; target: number }
  /** 글자와 색이 엇갈린 낱말의 "색"을 답한다. rounds문제 중 need개 이상 맞히면 성공, 못 미치면 실패 (다시 풀 수 없다) */
  | { type: 'stroop'; rounds: number; need: number; slowMs: number; fastMs: number }
  /** 한붓그리기: 모든 길을 한 번씩만 지난다. start가 null이면 시작할 곳도 스스로 찾아야 한다 */
  | { type: 'path'; nodes: { id: string; label: string; x: number; y: number }[]; edges: [string, string][]; start: string | null }
  /** 숫자 칸 채우기 (칸마다 정답 하나) */
  | { type: 'numbers'; fields: NumberField[] }
  /**
   * 안농의 원: 맨 위(▼)부터 시계 방향으로 읽는다. 끝에 '!'가 붙은 글자는 뒤집힌 안농.
   * 조작: ← 한 칸 돌리기(맨 앞이 맨 뒤로) · → 반대로 · Space 맨 앞 둘 바꾸기 · (flip이면) F 맨 앞 뒤집기
   */
  | { type: 'ring'; start: string[]; answer: string[]; flip?: boolean; par: number }
  /** 갈림길 미로: 어느 길을 골라도 제자리로 돌아온다. laps바퀴째에 giveUp 선택지가 생기고, 그것이 정답이다 */
  | { type: 'maze'; paths: string[]; forks: number; laps: number; giveUp: string; walk: string[]; back: string }
  /** 칠교 조각 하나를 돌려 창문 틀에 끼운다 (큰 세모 자리 둘 중 어디든) */
  | { type: 'tangram1' }
  /** 칠교 일곱 조각으로 창문을 완성한다. 가진 별 조각 수만큼만 조각이 있다 (모자라면 완성할 수 없다) */
  | { type: 'tangram7' }
  /** 물 붓기: 그릇 둘(caps)을 채우고 · 비우고 · 옮겨 부어 어느 한쪽에 target만큼 남긴다 */
  | { type: 'jugs'; caps: [number, number]; names: [string, string]; unit: string; target: number; par: number }
  /** 주어진 선택지(decoys)는 모두 오답. 빈 줄에 내 이름을 직접 써야 한다 */
  | { type: 'text'; decoys: string[]; decoyReply: string; placeholder: string };

export interface NumberField {
  /** 칸 앞에 붙는 말 */
  label?: string;
  /** 칸 뒤에 붙는 말 (단위) */
  unit?: string;
  max: number;
  answer: number;
}

export interface OrderItem {
  id: string;
  label: string;
  /** 타일 아래 작은 글씨 */
  sub?: string;
  /** 이 단서를 가졌을 때만 보이는 카드 */
  clue?: string;
  color: string;
  /** 정답을 맞히면 드러나는 글자 */
  reveal?: string;
}

/** 플레이어가 낸 답 (입력 방식마다 모양이 다르다) */
export type PuzzleAnswer =
  | { type: 'time'; hour: number; minute: number }
  | { type: 'choice'; index: number }
  | { type: 'order'; ids: string[] }
  | { type: 'numbers'; values: number[] }
  | { type: 'photos'; picks: number[] }
  /** 조작 자체로 끝나는 퍼즐(미로 · 조각 끼우기)을 마쳤다 */
  | { type: 'done' };

/**
 * 부대 곳곳에 숨은 별사탕 (장소 ID → 살펴볼 곳). 장소마다 한 번씩만 주울 수 있다.
 * 기억의 실마리가 열린 뒤(1일차 밤 이후)부터 보인다.
 */
export const CANDY_SPOTS: Record<string, { label: string; text: string }> = {
  bed: { label: '관물대 틈 살펴보기', text: '관물대와 벽 사이 틈에 손을 넣어 봤다. 누가 먹다 흘린 건빵 봉지… 속에 별사탕 하나가 남아 있다.' },
  water1: { label: '정수기 뒤 살펴보기', text: '정수기 뒤 먼지 속에서 뭔가 반짝인다. 별사탕이다. …씻어 먹으면 되겠지.' },
  water2: { label: '정수기 받침대 살펴보기', text: '물받이 옆에 누가 올려 둔 별사탕 하나. 임자가 없어 보인다.' },
  board2: { label: '게시판 압정 통 살펴보기', text: '압정 통을 흔들자 압정 사이에서 별사탕이 굴러 나온다. 누가 여기에 숨겼을까.' },
  laundry2: { label: '건조기 보풀 통 살펴보기', text: '보풀 통을 비우다가 별사탕을 찾았다. 누군가의 주머니에서 빠진 모양이다.' },
  wc2: { label: '세면대 선반 살펴보기', text: '비누 받침 뒤에 별사탕 한 알. 누가 양치하다 두고 간 것 같다.' },
  tv: { label: '소파 틈 살펴보기', text: '소파 쿠션 사이에 손을 넣었다. 리모컨, 동전, 그리고 별사탕.' },
  gym: { label: '아령 거치대 밑 살펴보기', text: '아령 거치대 밑으로 굴러 들어간 별사탕을 꺼냈다. 운동보다 이게 더 힘들다.' },
  cyber: { label: '키보드 밑 살펴보기', text: '키보드를 들어 올리자 과자 부스러기 사이에 별사탕이 하나 있다.' },
  library: { label: '반납함 구석 살펴보기', text: '반납함 구석에 책갈피 대신 끼워 둔 별사탕. 네이티오는 못 본 척한다.' },
};

/** 짬짬이 퍼즐을 풀 때마다 얻는 것 */
export const QUICK_REWARD = { memory: 1, candy: 1 };
/**
 * 짬짬이 퍼즐이 붙는 장소 (장소 ID → 퍼즐). 선택이고, 점심·개인정비 시간에만 풀 수 있다.
 * 풀면 그 장소에서 사라진다.
 */
export const QUICK_SPOTS: Record<string, { puzzle: string; label: string }> = {
  water2: { puzzle: 'Q-01', label: '필터 교체일 계산해 보기' },
  admin: { puzzle: 'Q-02', label: '불침번 근무표 채워 보기' },
  gym: { puzzle: 'Q-05', label: '역기 원판 맞춰 걸기' },
  kitchen: { puzzle: 'Q-06', label: '국 네 국자 덜어 내기' },
  maint: { puzzle: 'Q-07', label: '다음 공구함 번호 맞히기' },
  post: { puzzle: 'Q-09', label: '암구호 규칙 맞히기' },
  px: { puzzle: 'Q-10', label: '회식비 딱 맞춰 쓰기' },
};

export interface PuzzleDef {
  id: string;
  /** 붙어 있는 스토리 미션 */
  mission: string;
  title: string;
  /** 지문 (문단 단위) */
  prompt: string[];
  /** 지문 옆에 그리는 그림 */
  art?: 'mirrorClock' | 'pendulum' | 'digital';
  /** digital 그림에 띄울 숫자 */
  artText?: string;
  /** 제한 시간 (실패가 있는 자리에서만 쓴다) */
  timeLimitMs?: number;
  /** 한 번 틀리면 바로 실패 (실패가 있는 자리에서만 쓴다) */
  oneShot?: boolean;
  /** 지문 아래 쪽지처럼 보여 주는 글 (메모 · 누군가의 말) */
  notes?: string[];
  input: PuzzleInput;
  /** 힌트 3단계: 방향 → 핵심 → 거의 정답 */
  hints: [string, string, string];
  /** 정답을 맞혔을 때 한 줄 */
  solvedText: string;
  /** 별 조각이 걸린 관문 퍼즐 */
  gate?: boolean;
  /** 힌트가 없는 퍼즐. 힌트 자리에 이 문장을 보여 준다 */
  noHints?: string;
}

export const PUZZLES: Record<string, PuzzleDef> = {
  'P-01': {
    id: 'P-01',
    mission: 'M-01',
    title: '첫 번째 조각',
    prompt: [
      '언덕 위에 떠 있는 창문. 틀은 비어 있고, 일곱 조각의 자리가 흐린 선으로 남아 있다.',
      '손에 쥔 별 조각은 큰 세모 모양이다.',
      '조각을 돌려서 맞는 자리에 끼워라.',
    ],
    input: { type: 'tangram1' },
    hints: [
      '큰 세모가 들어갈 자리는 둘이다. 창문의 위쪽과 왼쪽.',
      '세모의 뾰족한 끝이 창문 한가운데를 향해야 한다.',
      '뾰족한 끝이 아래를 보면 위쪽 자리, 오른쪽을 보면 왼쪽 자리에 맞는다.',
    ],
    solvedText: '조각이 끼워지자, 창문 한 귀퉁이에 내 방의 불빛이 비친다.',
    gate: true,
  },
  'P-02': {
    id: 'P-02',
    mission: 'M-02',
    title: '거울 속 시계',
    prompt: [
      '세면대 거울에 등 뒤 벽의 전자시계가 비친다. 거울 속 시계는 아래처럼 보인다.',
      '멀쩡한 시각처럼 보이지만, 거울은 있는 그대로 보여 주지 않는다.',
      '지금은 몇 시 몇 분인가?',
    ],
    art: 'digital',
    artText: '12:50',
    input: { type: 'time', hour: 2, minute: 51 },
    hints: [
      '전자시계의 숫자는 막대로 되어 있다. 거울에 비치면 2와 5는 서로의 모양이 된다. 0 · 1 · 8은 그대로다.',
      '모양만 바뀌는 게 아니다. 숫자의 순서도 좌우로 뒤집힌다. 맨 오른쪽 숫자가 맨 왼쪽에 온다.',
      '거울 속 숫자를 오른쪽부터 읽으면서 2와 5를 바꾼다. 0, 5→2, 2→5, 1.',
    ],
    solvedText: '02시 51분. 거울은 거짓말을 하지 않는다. 뒤집어 보여 줄 뿐이다.',
  },
  'P-03': {
    id: 'P-03',
    mission: 'M-03',
    title: '생일자 명단',
    prompt: [
      '생일자 명단 아래에 종이가 한 장 더 붙어 있다. 물에 번져 이름은 안 보이고 날짜만 읽힌다.',
      '줄은 다섯인데, 행정반 메모에는 넷이라고 적혀 있다. 한 줄은 생일자가 아니다.',
      '생일자가 아닌 줄은 며칠인가?',
    ],
    notes: [
      '행정반 메모 ① "이번 달 생일자는 넷. 셋은 생일이 같은 요일이고, 나머지 한 명은 바로 그 다음 요일이다."',
      '행정반 메모 ② "초는 생일 날짜 수만큼 꽂는다. 네 명 치를 둘씩 묶어 세었더니 하나가 남았다."',
    ],
    input: { type: 'choice', options: ['4일', '11일', '12일', '19일', '25일'], answer: 2 },
    hints: [
      '같은 요일은 7일마다 돌아온다. 다섯 날짜를 7로 나눈 나머지로 두 무리로 갈라 보자.',
      '4 · 11 · 25일이 한 요일, 12 · 19일이 그 다음 요일이다. 뒤 무리에서 하나를 빼야 "셋과 하나"가 된다.',
      '둘씩 묶어 하나가 남았다면 날짜의 합이 홀수다. 12를 뺀 합과 19를 뺀 합 가운데 홀수인 쪽을 고르자.',
    ],
    solvedText: '12일을 빼면 4 · 11 · 25일이 같은 요일, 19일이 그 다음 요일. 합은 59, 홀수다.',
  },
  'P-05': {
    id: 'P-05',
    mission: 'N-01',
    title: '안개 너머',
    prompt: [
      '정문 밖은 온통 하얗다. 발밑의 길이 세 갈래로 갈라진다.',
      '안개를 빠져나갈 길을 찾아라.',
    ],
    input: {
      type: 'maze',
      paths: ['왼쪽 길', '가운데 길', '오른쪽 길'],
      forks: 3,
      laps: 3,
      giveUp: '…나갈 수 없다',
      walk: [
        '안개 속을 걸었다. 발소리가 나지 않는다.',
        '한참을 걸었다. 또 갈림길이다. 아까와 똑같이 생겼다.',
        '멀리 불빛이 보인다. 걸음이 빨라진다.',
      ],
      back: '…초소다. 다시 초소 앞에 서 있다.',
    },
    hints: ['', '', ''],
    noHints: '이 문제에는 힌트가 없다.',
    solvedText: '어느 길로 가도 초소로 돌아온다. 이 안개에는 "너머"가 없다.',
  },
  'P-04': {
    id: 'P-04',
    mission: 'M-04',
    title: '낡은 책 다섯 권',
    prompt: [
      '서가 구석에 책 다섯 권이 뒤죽박죽 꽂혀 있다. 네이티오는 서가 건너편에 앉아, 책 너머로 이쪽을 보며 중얼거린다.',
      '왼쪽과 오른쪽은 모두 네이티오가 앉은 자리에서 본 것이다.',
      '다섯 마디에 모두 맞게, 내 쪽에서 본 왼쪽부터 순서대로 꽂아라.',
    ],
    notes: [
      '① "초록은 끝에 서지 않는다."',
      '② "빨강은 파랑의 바로 왼쪽."',
      '③ "노랑과 검정은 이웃이다."',
      '④ "초록의 양옆은 파랑과 노랑이다."',
      '⑤ "검정은 빨강보다 오른쪽 어딘가."',
    ],
    input: {
      type: 'order',
      items: [
        { id: 'black', label: '검정', color: '#383840', reveal: '천' },
        { id: 'yellow', label: '노랑', color: '#d8a828', reveal: '년' },
        { id: 'green', label: '초록', color: '#3f8f50', reveal: '의' },
        { id: 'blue', label: '파랑', color: '#3868b8', reveal: '소' },
        { id: 'red', label: '빨강', color: '#c84838', reveal: '원' },
      ],
      start: ['blue', 'green', 'red', 'yellow', 'black'],
      answer: ['black', 'yellow', 'green', 'blue', 'red'],
    },
    hints: [
      '먼저 네이티오 쪽에서 본 순서를 구하자. ④에서 파랑 · 초록 · 노랑은 이 순서나 그 반대로 나란히 선다.',
      '②에서 빨강은 파랑 바로 왼쪽이다. 파랑 왼쪽에 초록이 있으면 안 되니, 네이티오 쪽 순서는 빨강 · 파랑 · 초록 · 노랑 · 검정이다.',
      '네이티오는 건너편에 있다. 그의 왼쪽은 나의 오른쪽이다. 구한 순서를 통째로 뒤집어 꽂자.',
    ],
    solvedText: '건너편에서 본 순서를 뒤집자, 책등의 글자가 이어진다. 천 · 년 · 의 · 소 · 원.',
  },
  // ───────── 2장 「이상한 부대」 ─────────
  'P-06': {
    id: 'P-06',
    mission: 'M-05',
    title: '보낸 날짜가 없는 편지',
    prompt: [
      '편지의 날짜 칸이 비어 있다. 나는 이 부대에서 벌써 여러 날을 보냈다.',
      '이 편지는 입대일로부터 며칠째, 몇 시에 쓴 것인가? (입영통지서: 입영 14:00)',
    ],
    notes: [
      '"아들, 어디 아프니? 어젯밤이 네가 집에서 자는 마지막 밤이었는데, 아침에 아무리 깨워도 안 일어나서 병원에 왔어."',
      '"네가 불을 끄고 누운 게 어젯밤 열한 시였지. 의사 선생님이 그러시더라. 그때부터 지금까지 흐른 시간이, 지금부터 입영 시간까지 남은 시간의 꼭 네 배라고."',
    ],
    input: {
      type: 'numbers',
      fields: [
        { label: '입대일로부터', unit: '일째 (당일이면 0)', max: 99, answer: 0 },
        { unit: '시', max: 23, answer: 11 },
      ],
    },
    hints: [
      '"어젯밤이 집에서 자는 마지막 밤"이었다면, 편지를 쓰는 오늘은 무슨 날인가. 내가 여기서 보낸 날 수는 답과 상관이 없다.',
      '어젯밤 11시부터 오늘 오후 2시까지는 모두 15시간이다. 이것을 4 대 1로 나눈다.',
      '지난 시간이 12시간, 남은 시간이 3시간이다. 밤 11시에서 12시간 뒤.',
    ],
    solvedText: '입대일 당일, 오전 11시. 나는 여기서 여러 날을 보냈는데 현실은 아직 그날 오전이다.',
  },
  'P-07': {
    id: 'P-07',
    mission: 'M-06',
    title: '낯선 명찰',
    prompt: [
      '명찰이 해져서 실밥 조각 일곱 개로 흩어졌다. 틀에는 글자 세 칸과 바늘 자국만 남아 있다.',
      '1·2번은 첫 글자, 3·4·5번은 가운데 글자(받침까지), 6·7번은 끝 글자다.',
      '남은 흔적 네 가지로 조각의 자리를 알아내 이름을 되살려라.',
    ],
    notes: [
      '① 바늘 자국: 첫 글자와 끝 글자는 옆으로 나란한 모양, 가운데 글자는 위아래로 쌓인 모양이고 받침이 있다.',
      '② 받침 자리의 실밥은, 자음 조각 넷 가운데 가나다순으로 가장 앞선 것의 색이다.',
      '③ 남은 자음 셋 가운데 가나다순으로 가장 앞선 것이 끝 글자에, 가장 뒤선 것이 가운데 글자에 붙어 있었다.',
      '④ 획이 하나뿐인 모음은 성(姓)에 붙는다.',
    ],
    input: {
      type: 'order',
      view: 'tiles',
      compose: 'nametag',
      items: [
        { id: 'o', label: 'ㅇ', color: '#5a6a4a' },
        { id: 'i', label: 'ㅣ', color: '#5a6a4a' },
        { id: 'j', label: 'ㅈ', color: '#5a6a4a' },
        { id: 'u', label: 'ㅜ', color: '#5a6a4a' },
        { id: 'n', label: 'ㄴ', color: '#5a6a4a' },
        { id: 's', label: 'ㅅ', color: '#5a6a4a' },
        { id: 'eo', label: 'ㅓ', color: '#5a6a4a' },
      ],
      start: ['s', 'u', 'o', 'eo', 'j', 'i', 'n'],
      answer: ['o', 'i', 'j', 'u', 'n', 's', 'eo'],
    },
    hints: [
      '①부터. 위아래로 쌓이는 모음은 ㅜ뿐이니 4번이 ㅜ다. ㅣ와 ㅓ는 2번과 7번에 나뉜다.',
      '자음을 가나다순으로 놓으면 ㄴ · ㅅ · ㅇ · ㅈ. 받침(5번)은 ㄴ, 끝 글자의 첫소리(6번)는 ㅅ, 가운데 글자의 첫소리(3번)는 ㅈ이다.',
      '남은 ㅇ이 1번. 획이 하나인 모음 ㅣ가 성에 붙으니 2번이 ㅣ, 7번이 ㅓ다.',
    ],
    solvedText: '빛바랜 명찰에 이름 석 자가 돌아왔다. 「이준서」',
  },
  'P-08': {
    id: 'P-08',
    mission: 'M-07',
    title: '멈춘 시계',
    prompt: [
      '근무 일지에는 매일 같은 줄이 적혀 있다. 이 시계는 자정마다 꼭 1분씩 멈춘다.',
      '1일차 아침에 시계를 정확히 맞췄다. 그리고 일지 중간에 한 줄이 더 있다.',
      '12일차 아침, 이 시계는 진짜 시간보다 몇 분 늦는가?',
    ],
    notes: ['「00:00 시계 정지 (1분)」 — 매일 밤', '「5일차 18:00 벽시계가 늦어 정시에 다시 맞춤. 당직병」'],
    input: { type: 'numbers', fields: [{ unit: '분', max: 99, answer: 7 }] },
    hints: [
      '5일차 저녁에 시계를 다시 맞췄다. 그 전에 멈춘 시간은 모두 없던 일이 된다.',
      '날 수가 아니라, 다시 맞춘 뒤로 지나간 자정의 수를 세자.',
      '5일차 밤부터 11일차 밤까지. 5, 6, 7, 8, 9, 10, 11.',
    ],
    solvedText: '다시 맞춘 뒤로 자정이 일곱 번. 7분이다.',
  },
  'P-09': {
    id: 'P-09',
    mission: 'D-01',
    title: '추리 정리 1 「우리는 왜?」',
    prompt: [
      '침상 위에 그동안 모은 단서 카드를 모두 펼쳤다. 쓸모없는 카드도 섞여 있다.',
      '아래 네 문장의 빈칸 ①~④에 맞는 카드가 앞의 네 자리에 오도록 놓아라. 5번 자리부터는 쓰지 않는 카드다.',
    ],
    notes: [
      '( ① )을 손에 쥔 밤부터, 이 긴 꿈이 시작됐다.',
      '이곳은 내가 오기 전부터 나를 알고 있었다. 그 증거가 ( ② )이다.',
      '내가 원래 사람이었다는 증거는 ( ③ )뿐이다.',
      '내 몸이 지금 여기에 없다는 증거는 ( ④ )이다.',
    ],
    input: {
      type: 'order',
      view: 'tiles',
      checkFirst: 4,
      items: [
        { id: 'star', label: '별 조각', color: '#b08a20' },
        { id: 'board', label: '생일자 명단', color: '#3f7a50' },
        { id: 'mirror', label: '거울 속의 나', color: '#3868a0' },
        { id: 'letter', label: '날짜 없는 편지', color: '#8a5a48' },
        { id: 'book', label: '별똥별 부대사', color: '#6a5a40', clue: 'C-08' },
        { id: 'fog', label: '안개 너머', color: '#707880', clue: 'C-04' },
      ],
      start: ['book', 'mirror', 'fog', 'star', 'letter', 'board'],
      answer: ['star', 'board', 'mirror', 'letter'],
    },
    hints: [
      '부대사와 안개는 "이 부대가 무엇인가"에 대한 단서다. "나는 누구인가"를 묻는 이 네 문장에는 들어가지 않는다.',
      '나를 "알고 있었다"는 건 내 이름이 미리 적혀 있었다는 뜻이다. 사람의 모습이 "보인" 것은 하나뿐이다.',
      '① 별 조각 ② 생일자 명단 ③ 거울 속의 나 ④ 날짜 없는 편지.',
    ],
    solvedText: '별에 빈 소원이 우리를 여기로 데려왔다.',
    gate: true,
  },
  'P-10': {
    id: 'P-10',
    mission: 'N-02',
    title: '불 꺼진 서가',
    prompt: [
      '어둠 속에 안농 여섯 마리가 둥글게 떠 있다. ▼ 자리부터 시계 방향으로 읽는다.',
      '안농들을 움직여 "별 이 지 기 전 에"를 만들어라.',
    ],
    input: { type: 'ring', start: ['지', '별', '전', '에', '기', '이'], answer: ['별', '이', '지', '기', '전', '에'], par: 11 },
    hints: [
      '원을 돌리는 것만으로는 순서가 바뀌지 않는다. 순서를 바꾸는 건 "맨 앞 둘 바꾸기"뿐이다.',
      '한 글자를 맨 앞에 두고 "바꾸기 → 돌리기"를 되풀이하면, 그 글자만 원을 따라 한 칸씩 옮길 수 있다.',
      '← ← ← 바꾸기 → 바꾸기 → → 바꾸기 → 바꾸기',
    ],
    solvedText: '글자들이 한 줄로 이어진다. 『별이 지기 전에』',
    gate: true,
  },
  'P-11': {
    id: 'P-11',
    mission: 'M-08',
    title: '부치지 못한 편지',
    prompt: [
      '"집에 가고 싶다"고 쓴 편지 여섯 장. 봉투 색이 제각각이고, 해마다 한 장씩 쓰였다.',
      '뒷면의 눌린 자국은 쓴 순서대로 포개야 읽힌다. 봉투에 남은 메모로 순서를 알아내, 가장 오래된 것부터 놓아라.',
    ],
    notes: [
      '① 푸른 봉투보다 먼저 쓰인 편지는 정확히 두 장이다.',
      '② 흰 봉투는 누런 봉투 바로 다음 해에 쓰였다.',
      '③ 붉은 봉투는 회색 봉투보다 먼저, 검은 봉투는 회색 봉투보다 나중에 쓰였다.',
      '④ 붉은 봉투는 맨 처음도, 맨 마지막도 아니다.',
    ],
    input: {
      type: 'order',
      view: 'tiles',
      items: [
        { id: 'tan', label: '누런 봉투', color: '#a8905a', reveal: '도' },
        { id: 'white', label: '흰 봉투', color: '#8a8a90', reveal: '서' },
        { id: 'blue', label: '푸른 봉투', color: '#3868a0', reveal: '관' },
        { id: 'red', label: '붉은 봉투', color: '#a84838', reveal: '안' },
        { id: 'gray', label: '회색 봉투', color: '#606068', reveal: '쪽' },
        { id: 'black', label: '검은 봉투', color: '#2a2a30', reveal: '방' },
      ],
      start: ['blue', 'black', 'tan', 'gray', 'white', 'red'],
      answer: ['tan', 'white', 'blue', 'red', 'gray', 'black'],
    },
    hints: [
      '①에서 푸른 봉투는 세 번째다. 그것부터 놓자.',
      '누런 · 흰 봉투는 붙어 있어야 한다. 남은 자리에서 붙은 두 칸은 (1, 2), (4, 5), (5, 6)뿐이다.',
      '(4, 5)나 (5, 6)이면 붉은 봉투가 맨 처음이 되어 ④에 어긋난다. 누런 · 흰 봉투가 1 · 2번이다.',
    ],
    solvedText: '여섯 장을 순서대로 포개자 눌린 자국이 이어진다. 「도서관 안쪽 방」',
  },
  'P-12': {
    id: 'P-12',
    mission: 'M-09',
    title: '잡음 속의 목소리',
    prompt: [
      '라디오에서 심전도 같은 소리가 되풀이된다. 다이얼 옆에 누군가 메모를 붙여 놓았다.',
      '소리를 숫자로 읽어 주파수를 맞춰라.',
    ],
    notes: [
      '메모 — "긴 것은 다섯, 아주 긴 것은 열. 작은 소리가 큰 소리 앞에 서면, 그만큼 덜어 낸다."',
      '삐  삐―――   (쉼)   삐―  삐  삐   (쉼)   삐  삐―',
    ],
    input: {
      type: 'numbers',
      fields: [
        { max: 9, answer: 9 },
        { unit: '.', max: 9, answer: 7 },
        { unit: 'MHz', max: 9, answer: 4 },
      ],
    },
    hints: [
      '쉼이 두 번이니 숫자는 셋이다. 짧은 소리는 1, 긴 소리는 5, 아주 긴 소리는 10.',
      '작은 소리가 큰 소리 "뒤"에 오면 더하고, "앞"에 오면 뺀다. 가운데 숫자는 5 + 1 + 1.',
      '첫 숫자는 10에서 1을 뺀 것, 끝 숫자는 5에서 1을 뺀 것이다.',
    ],
    solvedText: '97.4. 다이얼이 맞는 순간 잡음이 걷힌다.',
  },
  // ───────── 3장 「떡밥을 따라서」 ─────────
  'P-13': {
    id: 'P-13',
    mission: 'M-10',
    title: '단체 사진',
    prompt: [
      '벽에 해마다 찍은 부대 단체 사진이 걸려 있다. 다섯 장을 골라 나란히 놓았다.',
      '다섯 장 모두에서 "같은 자리"에 서 있는 얼굴은 하나뿐이다. 사진마다 그 얼굴을 짚어라.',
    ],
    input: {
      type: 'photos',
      cols: 4,
      target: 4,
      photos: [
        { label: '10년 전', faces: ['🐶', '🐱', '🐭', '🐹', '🦉', '🐻', '🦊', '🐼', '🐨', '🐯', '🐰', '🦁'] },
        { label: '8년 전', faces: ['🐶', '🐷', '🐸', '🐵', '🦉', '🐔', '🐧', '🐦', '🦆', '🐮', '🐰', '🐼'] },
        { label: '5년 전', faces: ['🐯', '🐱', '🐰', '🐔', '🦉', '🐹', '🐮', '🐨', '🐧', '🦊', '🐸', '🐷'] },
        { label: '2년 전', faces: ['🐶', '🐵', '🐻', '🐦', '🦉', '🐭', '🦁', '🐱', '🐷', '🐮', '🐰', '🐹'] },
        { label: '작년', faces: ['🐶', '🐸', '🐨', '🐧', '🦉', '🐯', '🐼', '🐵', '🐔', '🐭', '🐰', '🦁'] },
      ],
    },
    hints: [
      '다섯 장에 모두 나오는 얼굴은 둘이다. 그중 하나는 한 해에 자리를 옮겼다.',
      '맨 앞줄 왼쪽 끝의 얼굴은 네 장에서 같은 자리지만, 한 장에는 아예 없다.',
      '둘째 줄 왼쪽 끝. 다섯 장 모두 같은 얼굴이 서 있다.',
    ],
    solvedText: '해마다 같은 자리, 같은 얼굴. 계급장만 이병에서 병장으로 바뀌었다.',
  },
  'P-14': {
    id: 'P-14',
    mission: 'N-03',
    title: '똑딱, 똑딱',
    prompt: [
      '진자가 흔들린다. 눈꺼풀이 무겁다. 생각을 멈추면 진다.',
      '낱말이 뜬다. 글자를 읽지 말고, 글자의 "색"을 답하라. 여덟 문제 중 여섯 개.',
    ],
    input: { type: 'stroop', rounds: 8, need: 6, slowMs: 3200, fastMs: 2000 },
    hints: ['', '', ''],
    noHints: '졸음 속이라 힌트를 볼 틈이 없다.',
    solvedText: '끝까지 생각을 놓지 않았다. 진자 소리가 멎는다.',
  },
  'P-15': {
    id: 'P-15',
    mission: 'M-11',
    title: '병장의 일기',
    prompt: [
      '찢어진 일기가 다섯 조각으로 흩어져 있다. 맞닿는 두 조각은 찢긴 모양이 같다.',
      '일기장의 맨 위와 맨 아래는 찢기지 않아 반듯하다. 그런데 조각 하나는 위아래가 뒤집힌 채 놓여 있다.',
      '어느 조각이 뒤집혔는지 가려내, 위에서부터 순서대로 놓아라.',
    ],
    input: {
      type: 'order',
      view: 'rows',
      items: [
        { id: 'ra', label: '"별 조각을 일곱 개 모았다."', sub: '위: 반듯함 · 아래: 물결', color: '#6a5a40' },
        { id: 'na', label: '"마지막 밤, 별이 물었다. 돌아가겠느냐고."', sub: '위: 물결 · 아래: 톱니', color: '#6a5a40' },
        { id: 'ma', label: '"나는 겁이 났다."', sub: '위: 사선 · 아래: 톱니', color: '#6a5a40' },
        { id: 'da', label: '"돌아가면, 다시 가야 하니까."', sub: '위: 사선 · 아래: 둥긂', color: '#6a5a40' },
        { id: 'ga', label: '"그래서 아무 말도 못 했다."', sub: '위: 둥긂 · 아래: 반듯함', color: '#6a5a40' },
      ],
      start: ['da', 'ga', 'ra', 'ma', 'na'],
      answer: ['ra', 'na', 'ma', 'da', 'ga'],
    },
    hints: [
      '위가 반듯한 조각이 처음, 아래가 반듯한 조각이 끝이다. 거기서부터 찢긴 모양을 이어 보자.',
      '둘째 조각의 아래는 톱니인데, 위가 톱니인 조각이 없다. 그리고 위가 사선인 조각이 둘이다. 둘 중 하나가 뒤집혔다.',
      '"나는 겁이 났다" 조각을 뒤집으면 위가 톱니, 아래가 사선이 된다. 그 다음이 "돌아가면, 다시 가야 하니까."',
    ],
    solvedText: '뒤집힌 한 조각을 바로 놓자, 찢긴 자리가 하나로 이어진다.',
    gate: true,
  },
  'P-16': {
    id: 'P-16',
    mission: 'D-02',
    title: '추리 정리 2 「돌아가지 못한 사람들」',
    prompt: [
      '옥상 난간에 단서 카드를 늘어놓았다.',
      '아래 네 문장의 빈칸 ①~④에 맞는 카드가 앞의 네 자리에 오도록 놓아라. 5번 자리부터는 쓰지 않는 카드다.',
    ],
    notes: [
      '돌아갈 수 있는 시간에는 끝이 있다. ( ① )이 그 증거다.',
      '돌아가고 싶어 한 사람은 해마다 있었다. ( ② )를 보면 안다.',
      '그런데도 돌아가지 못한 건, 마지막 밤에 스스로 입을 닫았기 때문이다. ( ③ )에 그렇게 적혀 있다.',
      '그렇게 남은 사람이 어떻게 되는지는 ( ④ )이 보여 준다.',
    ],
    input: {
      type: 'order',
      view: 'tiles',
      checkFirst: 4,
      items: [
        { id: 'clock', label: '멈춘 시계', color: '#3868a0', clue: 'C-07' },
        { id: 'letters', label: '부치지 못한 편지', color: '#8a5a48', clue: 'C-09' },
        { id: 'diary', label: '병장의 일기', color: '#6a5a40', clue: 'C-13' },
        { id: 'photo', label: '단체 사진', color: '#7a4a7a', clue: 'C-12' },
        { id: 'tag', label: '낯선 명찰', color: '#5a6a4a', clue: 'C-06' },
        { id: 'radio', label: '잡음 속의 목소리', color: '#505860', clue: 'C-10' },
      ],
      start: ['diary', 'photo', 'clock', 'tag', 'letters', 'radio'],
      answer: ['clock', 'letters', 'diary', 'photo'],
    },
    hints: [
      '"D-며칠"이 적혀 있던 것이 시간의 증거다.',
      '사진은 "가고 싶어 했다"는 증거가 아니다. "남아서 어떻게 됐는지"를 보여 준다.',
      '① 멈춘 시계 ② 부치지 못한 편지 ③ 병장의 일기 ④ 단체 사진.',
    ],
    solvedText: '길을 못 찾은 게 아니다. 마지막 밤, 겁이 나서 소원을 거두지 못했다. 그리고 해마다 같은 자리에 섰다.',
  },
  'P-17': {
    id: 'P-17',
    mission: 'M-12',
    title: '진자 자국',
    prompt: [
      '둥근 자국이 부대 곳곳으로 이어져 있다. 수첩에 약도를 그리고 자국 열한 줄을 옮겨 적었다.',
      '누군가 이 자국을 한 번도 겹치지 않고 단숨에 그었다. 잠긴 상자는 지나간 자리일 뿐이다.',
      '어디서 시작했는지 찾아, 모든 자국을 한 번씩만 지나 끝까지 따라가라. 장소는 여러 번 지나도 된다.',
    ],
    input: {
      type: 'path',
      start: null,
      nodes: [
        { id: 'box', label: '잠긴 상자', x: 38, y: 150 },
        { id: 'post', label: '위병소', x: 112, y: 100 },
        { id: 'parade', label: '연병장', x: 160, y: 30 },
        { id: 'hq', label: '막사', x: 214, y: 100 },
        { id: 'mess', label: '병영식당', x: 160, y: 172 },
        { id: 'recycle', label: '분리수거장', x: 286, y: 150 },
        { id: 'px', label: 'PX', x: 286, y: 45 },
      ],
      edges: [
        ['box', 'post'], ['box', 'mess'], ['post', 'parade'], ['post', 'hq'], ['post', 'mess'], ['parade', 'hq'],
        ['hq', 'px'], ['hq', 'mess'], ['hq', 'recycle'], ['mess', 'recycle'], ['px', 'recycle'],
      ],
    },
    hints: [
      '장소마다 자국이 몇 줄 닿아 있는지 세어 보자. 지나가는 곳은 들어오고 나가니 늘 짝수다.',
      '줄 수가 홀수인 곳은 두 군데뿐이다. 한 곳이 시작이고 다른 한 곳이 끝이다. 막사와 분리수거장.',
      '막사 → PX → 분리수거장 → 병영식당 → 잠긴 상자 → 위병소 → 연병장 → 막사 → 위병소 → 병영식당 → 막사 → 분리수거장.',
    ],
    solvedText: '자국의 두 끝은 막사와 분리수거장이다. 막사에서 나와, 분리수거장에서 멈췄다.',
    gate: true,
  },
  'P-18': {
    id: 'P-18',
    mission: 'N-04',
    title: '소원을 거둬라',
    prompt: [
      '안농들이 다시 둥글게 모였다. 이번엔 두 마리가 거꾸로 뒤집혀 있다.',
      '모두 바로 세워서 "소 원 을 거 둬 라"를 만들어라.',
    ],
    input: { type: 'ring', start: ['라!', '둬!', '거', '을', '원', '소'], answer: ['소', '원', '을', '거', '둬', '라'], flip: true, par: 15 },
    hints: [
      '뒤집을 수 있는 건 맨 앞(▼ 자리)의 안농뿐이다. 뒤집힌 두 마리는 차례로 맨 앞을 지나가야 한다.',
      '지금 배열은 목표를 거의 거꾸로 놓은 것이다. 한 글자씩 맨 앞에서 "바꾸기 → 돌리기"로 옮겨 가자.',
      '← 바꾸기 ← 뒤집기 바꾸기 → 바꾸기 → → 바꾸기 → 바꾸기 뒤집기 ← 바꾸기',
    ],
    solvedText: '이번엔 끝까지 모였다. 『소원을 거둬라』',
  },
  // ───────── 4장 「별이 지기 전에」 ─────────
  'P-19': {
    id: 'P-19',
    mission: 'M-13',
    title: '잊혀 가는 이름',
    prompt: [
      '그날의 명찰. 이번엔 동기가 자음 조각을 먼저 놓았다. 그런데 기억이 흐려서, 자음 두 개의 자리가 서로 바뀌어 있다.',
      '동기가 잘못 놓은 조각을 바로잡고, 남은 모음 조각 세 개도 제자리에 놓아 주자.',
    ],
    notes: ['동기: "…이건 여기. 이건… 여기였나. 나머지는 모르겠어. 네가 해 줘."'],
    input: {
      type: 'order',
      view: 'tiles',
      compose: 'nametag',
      items: [
        { id: 'o', label: 'ㅇ', color: '#3868a0' },
        { id: 'i', label: 'ㅣ', color: '#5a6a4a' },
        { id: 'j', label: 'ㅈ', color: '#3868a0' },
        { id: 'u', label: 'ㅜ', color: '#5a6a4a' },
        { id: 'n', label: 'ㄴ', color: '#3868a0' },
        { id: 's', label: 'ㅅ', color: '#3868a0' },
        { id: 'eo', label: 'ㅓ', color: '#5a6a4a' },
      ],
      start: ['j', 'eo', 'o', 'i', 'n', 's', 'u'],
      answer: ['o', 'i', 'j', 'u', 'n', 's', 'eo'],
    },
    hints: [
      '파란 조각이 동기가 놓은 자음이다. 넷 중 둘의 자리가 바뀌었다.',
      '그날 같이 맞춘 이름을 떠올리자. 성은 ㅇ으로 시작했다.',
      '이 · 준 · 서.',
    ],
    solvedText: '둘이 나눠 맞춘 이름. 「이준서」',
    gate: true,
  },
  'P-20a': {
    id: 'P-20a',
    mission: 'B-01',
    title: '꿈을 먹는 자 · 1라운드',
    prompt: [
      '진자가 눈앞을 가린다. 숫자를 세지 못하게 하려는 것이다.',
      '불침번은 한 시간씩 선다. 첫 근무자가 22시에 섰다면, 다섯 번째 근무자는 몇 시에 근무를 시작하는가?',
    ],
    art: 'pendulum',
    notes: ['슬리퍼: "숫자 같은 건 세지 마. 양이나 세."'],
    input: { type: 'numbers', fields: [{ unit: '시', max: 23, answer: 2 }] },
    timeLimitMs: 40000,
    hints: ['', '', ''],
    noHints: '진자 소리에 힌트를 볼 틈이 없다.',
    solvedText: '22 · 23 · 0 · 1 · 2. 새벽 두 시다.',
  },
  'P-20b': {
    id: 'P-20b',
    mission: 'B-01',
    title: '꿈을 먹는 자 · 2라운드',
    prompt: [
      '슬리퍼가 달콤한 말 세 마디를 늘어놓는다.',
      '둘은 사실이다. 거짓은 어느 것인가? 기회는 한 번뿐이다.',
    ],
    input: {
      type: 'choice',
      options: [
        '"돌아가면 내일 아침 훈련소야. 새벽 기상, 혹한기, 불침번…"',
        '"여기 남으면 다신 아무 데도 안 가도 돼."',
        '"저 말 없는 병장을 봐. 남기를 잘했다고 생각하잖아."',
      ],
      answer: 2,
    },
    oneShot: true,
    hints: ['', '', ''],
    noHints: '사실을 부정하지 말자. 가기 싫었던 마음도, 돌아가면 힘든 것도 사실이다.',
    solvedText: '남은 사람은 한 번도 "잘했다"고 하지 않았다.',
  },
  'P-20c': {
    id: 'P-20c',
    mission: 'B-01',
    title: '꿈을 먹는 자 · 3라운드',
    prompt: [
      '슬리퍼: "마지막이야. 넌 누구지?"',
      '세 가지 대답이 눈앞에 떠 있다.',
    ],
    input: {
      type: 'text',
      decoys: ['"…이병입니다."', '"…포켓몬입니다."', '"…모르겠습니다."'],
      decoyReply: '입을 떼려는 순간 눈앞이 어두워진다. …아니다. 이건 저 녀석이 준 답이다.',
      placeholder: '(빈 줄에 직접 쓴다)',
    },
    hints: [
      '주어진 대답 가운데에는 답이 없다.',
      '이 꿈에 오기 전, 맨 처음에 내가 스스로 정한 것이 있다.',
      '엄마 목소리가 들린다. "…{me}야. 일어나야지."',
    ],
    solvedText: '내 이름을 내 입으로 말했다. 진자가 멈춘다.',
    gate: true,
  },
  'P-21': {
    id: 'P-21',
    mission: 'F-01',
    title: '마지막 창문',
    prompt: [
      '첫날 밤의 그 창문. 큰 세모 하나는 그때 끼운 자리에 그대로 있다.',
      '모은 별 조각을 모두 끼워 창문을 완성하라.',
    ],
    input: { type: 'tangram7' },
    hints: [
      '같은 모양의 자리에만 들어간다. 세모는 뾰족한 끝의 방향까지 맞아야 한다.',
      '큰 세모는 뾰족한 끝이 창문 한가운데를 향한다. 네모는 어떻게 돌려도 맞는다.',
      '작은 세모 둘은 뾰족한 끝이 왼쪽(3번 자리)과 위(5번 자리)다. 가운데 크기 세모는 직각이 오른쪽 아래다.',
    ],
    solvedText: '창문이 완성된다. 그 너머로 입대 전날 밤의 내 방이 보인다.',
  },
  // ───────── 짬짬이 퍼즐 (선택) ─────────
  'Q-01': {
    id: 'Q-01',
    mission: '2층 정수기',
    title: '필터 교체일',
    prompt: [
      '정수기 점검표에 이렇게 적혀 있다. "필터는 45일마다 교체. 올해 첫 교체일: 1월 20일."',
      '올해 네 번째 교체일은 몇 월 며칠인가? (2월은 28일까지 있다)',
    ],
    input: { type: 'numbers', fields: [{ unit: '월', max: 12, answer: 6 }, { unit: '일', max: 31, answer: 4 }] },
    hints: [
      '첫 교체일에서 45일을 세 번 더하면 네 번째다. 135일 뒤.',
      '두 번째는 3월 6일, 세 번째는 4월 20일이다.',
      '4월은 30일, 5월은 31일까지 있다. 4월 20일에서 45일 뒤.',
    ],
    solvedText: '6월 4일. 점검표에 적어 두었다.',
  },
  'Q-02': {
    id: 'Q-02',
    mission: '행정반',
    title: '불침번 근무표',
    prompt: [
      '오늘 밤 불침번 다섯 자리가 비어 있다. 행정반 메모대로 순서를 채워라.',
    ],
    notes: [
      '① 분대장은 맨 처음에도, 맨 마지막에도 서지 않는다.',
      '② 나는 동기 바로 다음에 선다.',
      '③ 맞선임은 분대장보다 먼저 선다.',
      '④ 후임은 맞선임과 이어서 서지 않는다.',
      '⑤ 후임은 맨 마지막에 서지 않는다.',
    ],
    input: {
      type: 'order',
      view: 'tiles',
      items: [
        { id: 'sgt', label: '분대장', color: '#8a5a48' },
        { id: 'senior', label: '맞선임', color: '#3868a0' },
        { id: 'buddy', label: '동기', color: '#3f7a50' },
        { id: 'me', label: '나', color: '#b08a20' },
        { id: 'junior', label: '후임', color: '#7a4a7a' },
      ],
      start: ['me', 'buddy', 'junior', 'sgt', 'senior'],
      answer: ['senior', 'sgt', 'junior', 'buddy', 'me'],
    },
    hints: [
      '동기와 나는 한 덩어리로 움직인다. 덩어리가 들어갈 자리는 (1,2), (2,3), (3,4), (4,5) 넷이다.',
      '후임은 마지막이 아니고, 분대장도 마지막이 아니다. 맞선임은 분대장보다 앞이다. 마지막에 설 수 있는 사람은 나뿐이다.',
      '동기 · 내가 4 · 5번. 앞의 세 자리에서 맞선임이 분대장보다 앞이고 후임과 붙지 않으려면 맞선임 · 분대장 · 후임 순이다.',
    ],
    solvedText: '맞선임 → 분대장 → 후임 → 동기 → 나. …결국 제일 졸린 시간은 내 차지다.',
  },
  'Q-05': {
    id: 'Q-05',
    mission: '체단실',
    title: '역기 원판',
    prompt: [
      '원판이 여섯 장 있다. 20kg 한 장, 15kg 한 장, 10kg 한 장, 5kg 세 장.',
      '여섯 장을 모두 써서, 봉 양쪽에 세 장씩 걸어 수평을 맞춰야 한다. 20kg과 같은 쪽에 걸리는 두 장은?',
    ],
    input: { type: 'choice', options: ['15kg + 10kg', '10kg + 5kg', '15kg + 5kg', '5kg + 5kg'], answer: 3 },
    hints: [
      '원판을 모두 더하면 60kg이다. 한쪽에 30kg씩 걸려야 한다.',
      '20kg 쪽에는 두 장으로 10kg만 더 걸 수 있다.',
      '10kg 한 장으로는 두 장이 안 된다.',
    ],
    solvedText: '20 + 5 + 5 = 30, 15 + 10 + 5 = 30. 봉이 수평을 잡는다.',
  },
  'Q-06': {
    id: 'Q-06',
    mission: '조리실',
    title: '네 국자',
    prompt: [
      '조리병이 부탁한다. "국을 정확히 네 국자만 덜어 줘. 그릇은 저 둘뿐이야."',
      '5국자들이 그릇과 8국자들이 그릇으로, 어느 한쪽에 정확히 4국자를 남겨라.',
    ],
    input: { type: 'jugs', caps: [5, 8], names: ['작은 그릇', '큰 그릇'], unit: '국자', target: 4, par: 10 },
    hints: [
      '작은 그릇을 채워 큰 그릇에 붓기를 되풀이하자. 두 번째에는 큰 그릇이 차서 작은 그릇에 2가 남는다.',
      '큰 그릇을 비우고 그 2를 옮겨 둔다. 거기에 5를 더하면 7, 큰 그릇에는 1만 더 들어간다.',
      '작은 채움 → 큰 쪽에 붓기 → 작은 채움 → 붓기 → 큰 비움 → 붓기 → 작은 채움 → 붓기 → 작은 채움 → 붓기.',
    ],
    solvedText: '작은 그릇에 정확히 네 국자. 조리병이 엄지를 든다.',
  },
  'Q-07': {
    id: 'Q-07',
    mission: '정비실',
    title: '공구함 번호',
    prompt: [
      '공구함에 번호표가 붙어 있다. 2 · 9 · 4 · 7 · 6 · 5 · 8.',
      '여덟 번째 공구함의 번호표가 떨어져 있다. 몇 번인가?',
    ],
    input: { type: 'numbers', fields: [{ unit: '번', max: 99, answer: 3 }] },
    hints: [
      '이웃한 번호끼리는 규칙이 보이지 않는다. 하나씩 건너뛰어 보자.',
      '첫째 · 셋째 · 다섯째 · 일곱째는 2, 4, 6, 8이다.',
      '둘째 · 넷째 · 여섯째는 9, 7, 5로 줄어든다.',
    ],
    solvedText: '두 줄의 번호가 번갈아 놓여 있었다. 3번.',
  },
  'Q-09': {
    id: 'Q-09',
    mission: '위병소 초소',
    title: '암구호의 규칙',
    prompt: [
      '위병이 심심했는지 문제를 낸다. "지난 암구호들에는 규칙이 있었지. 맞혀 봐."',
      '문어 "강" → 답어 "하나". 문어 "참나무" → 답어 "하나". 문어 "달빛" → 답어 "둘".',
      '문어가 "은하수"라면 답어는?',
    ],
    input: { type: 'choice', options: ['하나', '둘', '셋', '넷'], answer: 0 },
    hints: [
      '글자 수는 아니다. "참나무"는 세 글자인데 답어가 "하나"다.',
      '글자 하나하나를 뜯어 보자. 아래에 무언가 받치고 있는 글자와 그렇지 않은 글자가 있다.',
      '받침이 있는 글자의 수다. "은하수"에는 "은" 하나뿐이다.',
    ],
    solvedText: '받침이 있는 글자의 수, "하나". 위병이 씩 웃는다. (진짜 암구호는 이렇게 쉽지 않다.)',
  },
  'Q-10': {
    id: 'Q-10',
    mission: 'PX',
    title: '분대 회식비',
    prompt: [
      '분대 회식비 10,000원을 맡았다. 네 가지를 모두 하나 이상 사고, 한 푼도 남기지 말아야 한다.',
      '냉동 만두 3,500원 · 컵라면 1,300원 · 건빵 1,200원 · 초코파이 1,000원. 각각 몇 개씩 사야 하는가?',
    ],
    input: {
      type: 'numbers',
      fields: [
        { label: '만두', unit: '개', max: 9, answer: 1 },
        { label: '컵라면', unit: '개', max: 9, answer: 1 },
        { label: '건빵', unit: '개', max: 9, answer: 1 },
        { label: '초코파이', unit: '개', max: 9, answer: 4 },
      ],
    },
    hints: [
      '먼저 네 가지를 하나씩 담자. 얼마가 남는가.',
      '7,000원을 쓰고 3,000원이 남는다.',
      '3,000원을 남김없이 쓰는 방법은 한 가지뿐이다. 1,000원짜리 세 개.',
    ],
    solvedText: '초코파이만 네 개. 정(情)이 넘치는 회식이 되겠다.',
  },
};

export const puzzleDef = (id: string) => PUZZLES[id];

export interface PuzzleProgress {
  solved: boolean;
  /** 틀린 횟수 */
  wrong: number;
  /** 열어 본 힌트 단계 수 (0~3) */
  hints: number;
}
export const NO_PROGRESS: PuzzleProgress = { solved: false, wrong: 0, hints: 0 };

/** 기억 보상: 한 번에 +5, 한 번 틀리면 +4, 그 뒤로는 +3 (더 내려가지 않는다) */
export function puzzleReward(def: PuzzleDef, wrong: number): number {
  // 짬짬이 퍼즐은 몇 번 틀리든 보상이 같다
  if (def.id.startsWith('Q-')) return QUICK_REWARD.memory;
  return Math.max(3, 5 - wrong) + (def.gate ? GATE_BONUS : 0);
}

/** 입력한 답이 맞는지 */
export function checkPuzzle(def: PuzzleDef, answer: PuzzleAnswer): boolean {
  const a = def.input;
  // 12시간제 시계: 8시와 20시는 같은 답으로 본다
  if (a.type === 'time') return answer.type === 'time' && answer.hour % 12 === a.hour % 12 && answer.minute === a.minute;
  if (a.type === 'choice') return answer.type === 'choice' && answer.index === a.answer;
  if (a.type === 'numbers') return answer.type === 'numbers' && a.fields.every((f, i) => answer.values[i] === f.answer);
  if (a.type === 'photos') return answer.type === 'photos' && answer.picks.length === a.photos.length && answer.picks.every((i) => i === a.target);
  if (a.type === 'order') {
    if (answer.type !== 'order') return false;
    if (a.checkFirst) return a.answer.slice(0, a.checkFirst).every((id, i) => answer.ids[i] === id);
    return answer.ids.length === a.answer.length && answer.ids.every((id, i) => id === a.answer[i]);
  }
  // 미로 · 조각 끼우기는 화면에서 조작을 마치면 정답이다
  return answer.type === 'done';
}
