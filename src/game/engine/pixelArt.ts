/**
 * 오프닝(사람 시절) 방을 위한 도트 그래픽.
 * - 방은 타일 16px 해상도로 그린 뒤 정수 배율로 확대해 또렷한 도트를 유지한다.
 * - 주인공은 14x20 픽셀 스프라이트 (정면/뒷면/옆면 + 걷기 2프레임).
 */
import type { Dir } from './drawMonster';

export const PX = 16; // 저해상도 타일 크기

// ───────────── 주인공 스프라이트 ─────────────
const PALETTE: Record<string, string> = {
  K: '#282028', // 외곽선
  H: '#40302a', // 까까머리
  S: '#f8d0a8', // 피부
  s: '#e0a880', // 피부 그늘
  W: '#f8f8f8', // 후드 끈
  B: '#5878c8', // 후드티
  b: '#3858a0', // 후드티 그늘
  P: '#3c4460', // 바지
  O: '#f0f0f0', // 신발
};

const DOWN = [
  '....KKKKKK....',
  '...KHHHHHHK...',
  '..KHHHHHHHHK..',
  '..KSHHHHHHSK..',
  '..KSSSSSSSSK..',
  '..KSKSSSSKSK..',
  '..KSKSSSSKSK..',
  '..KsSSSSSSsK..',
  '...KSSssSSK...',
  '....KKKKKK....',
  '...KBBWWBBK...',
  '..KBBBWWBBBK..',
  '..KBBBBBBBBK..',
  '..KbBBBBBBbK..',
  '..KSbBBBBbSK..',
  '...KPPPPPPK...',
  '...KPPKKPPK...',
  '...KPPKKPPK...',
  '...KOOKKOOK...',
  '...KKK..KKK...',
];
const DOWN_WALK_LEGS = [
  '...KPPPPPPK...',
  '...KPPKKPPK...',
  '...KOOKKPPK...',
  '...KKKKKOOK...',
  '........KKK...',
];
const UP = [
  '....KKKKKK....',
  '...KHHHHHHK...',
  '..KHHHHHHHHK..',
  '..KHHHHHHHHK..',
  '..KHHHHHHHHK..',
  '..KHHHHHHHHK..',
  '..KHHHHHHHHK..',
  '..KSHHHHHHSK..',
  '...KHHHHHHK...',
  '....KKKKKK....',
  '...KBBBBBBK...',
  '..KBbbbbbbBK..',
  '..KBBBBBBBBK..',
  '..KbBBBBBBbK..',
  '..KSbBBBBbSK..',
  ...DOWN.slice(15),
];
const LEFT = [
  '....KKKKKK....',
  '...KHHHHHHK...',
  '..KHHHHHHHHK..',
  '..KSSHHHHHHK..',
  '..KSSSSHHHHK..',
  '..KSKSSSHHHK..',
  '..KSKSSSSSHK..',
  '.KSSSSSSSSSK..',
  '..KSsSSSSSK...',
  '...KKKKKKK....',
  '....KBBBBK....',
  '...KBBBBBBK...',
  '...KBBBBBBK...',
  '...KBSBBBBK...',
  '...KbbbbbbK...',
  '....KPPPPK....',
  '....KPPPPK....',
  '....KPPPPK....',
  '....KOOOOK....',
  '....KKKKKK....',
];
const LEFT_WALK_LEGS = [
  '....KPPPPK....',
  '...KPPKKPPK...',
  '..KPPK..KPPK..',
  '..KOOK..KOOK..',
  '..KKKK..KKKK..',
];

const mirror = (rows: string[]) => rows.map((r) => r.split('').reverse().join(''));
const withLegs = (body: string[], legs: string[]) => [...body.slice(0, 15), ...legs];

/** dir별 [서기, 걷기A, 걷기B] */
const FRAMES: Record<Dir, string[][]> = {
  down: [DOWN, withLegs(DOWN, DOWN_WALK_LEGS), withLegs(DOWN, mirror(DOWN_WALK_LEGS))],
  up: [UP, withLegs(UP, DOWN_WALK_LEGS), withLegs(UP, mirror(DOWN_WALK_LEGS))],
  left: [LEFT, withLegs(LEFT, LEFT_WALK_LEGS), LEFT],
  right: [mirror(LEFT), mirror(withLegs(LEFT, LEFT_WALK_LEGS)), mirror(LEFT)],
};

export const SPRITE_W = 14;
export const SPRITE_H = 20;
const spriteCache = new Map<string, HTMLCanvasElement>();

function spriteCanvas(dir: Dir, frame: number): HTMLCanvasElement {
  const key = `${dir}${frame}`;
  const c0 = spriteCache.get(key);
  if (c0) return c0;
  const rows = FRAMES[dir][frame];
  const c = document.createElement('canvas');
  c.width = SPRITE_W; c.height = SPRITE_H;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => row.split('').forEach((ch, x) => {
    const col = PALETTE[ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }));
  spriteCache.set(key, c);
  return c;
}

/** (cx, footY) 기준으로 주인공을 그린다. frame: 0 서기, 1·2 걷기 */
export function drawPixelHuman(g: CanvasRenderingContext2D, cx: number, footY: number, dir: Dir, frame: number) {
  // 그림자
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(Math.round(cx - 5), Math.round(footY - 1), 10, 2);
  g.drawImage(spriteCanvas(dir, frame), Math.round(cx - SPRITE_W / 2), Math.round(footY - SPRITE_H));
}

// ───────────── 방 그리기 ─────────────
type G = CanvasRenderingContext2D;
const OUT = '#302828';
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const box = (g: G, x: number, y: number, w: number, h: number, fill: string, out = OUT) => { R(g, x, y, w, h, out); R(g, x + 1, y + 1, w - 2, h - 2, fill); };

/** 움직이지 않는 방 배경 (W x H 타일) */
export function renderRoomStatic(W: number, H: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W * PX; c.height = H * PX;
  const g = c.getContext('2d')!;

  // 마루
  for (let ty = 2; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
    const x = tx * PX, y = ty * PX;
    R(g, x, y, PX, PX, '#d8a868');
    R(g, x, y + 7, PX, 1, '#b88848');
    R(g, x, y + 15, PX, 1, '#b88848');
    R(g, x + ((tx + ty) % 2 ? 4 : 11), y, 1, 7, '#c09050');
    R(g, x + ((tx + ty) % 2 ? 9 : 2), y + 8, 1, 7, '#c09050');
    R(g, x + 2, y + 2, 3, 1, '#e8b878');
  }
  // 벽지 (위 2줄)
  R(g, PX, 0, (W - 2) * PX, 2 * PX, '#f0e6cc');
  for (let x = PX; x < (W - 1) * PX; x += 4) R(g, x, 2, 1, 2 * PX - 6, '#e0d2b0');
  R(g, PX, 0, (W - 2) * PX, 2, '#807060');
  R(g, PX, 2 * PX - 4, (W - 2) * PX, 4, '#a07040');
  R(g, PX, 2 * PX - 4, (W - 2) * PX, 1, '#c08850');
  // 바깥 벽
  R(g, 0, 0, PX, H * PX, '#4a4048'); R(g, (W - 1) * PX, 0, PX, H * PX, '#4a4048');
  R(g, 0, (H - 1) * PX, W * PX, PX, '#4a4048');
  R(g, PX - 1, 0, 1, (H - 1) * PX, '#2a2028'); R(g, (W - 1) * PX, 0, 1, (H - 1) * PX, '#2a2028');
  R(g, PX, (H - 1) * PX, (W - 2) * PX, 1, '#2a2028');

  // 러그
  box(g, 5 * PX + 2, 5 * PX + 2, 3 * PX - 4, 2 * PX - 4, '#6880d0');
  R(g, 5 * PX + 4, 5 * PX + 4, 3 * PX - 8, 1, '#f0f0f8'); R(g, 5 * PX + 4, 7 * PX - 5, 3 * PX - 8, 1, '#f0f0f8');
  R(g, 5 * PX + 4, 5 * PX + 4, 1, 2 * PX - 8, '#f0f0f8'); R(g, 8 * PX - 5, 5 * PX + 4, 1, 2 * PX - 8, '#f0f0f8');
  for (let i = 0; i < 5; i++) R(g, 5 * PX + 10 + i * 6, 6 * PX - 1, 2, 2, '#90a8e8');

  // 거울 (벽, 4,1)
  box(g, 4 * PX + 3, 4, 10, 22, '#a07848');
  R(g, 4 * PX + 5, 6, 6, 18, '#c8e8f8'); R(g, 4 * PX + 6, 7, 1, 10, '#ffffff');
  // 달력 (벽, 5,1)
  box(g, 5 * PX + 3, 6, 11, 14, '#f8f8f8');
  R(g, 5 * PX + 4, 7, 9, 3, '#e04848');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) R(g, 5 * PX + 5 + j * 2, 12 + i * 2, 1, 1, '#909090');
  R(g, 5 * PX + 10, 14, 2, 1, '#e04848'); R(g, 5 * PX + 9, 15, 1, 2, '#e04848'); R(g, 5 * PX + 12, 15, 1, 2, '#e04848'); R(g, 5 * PX + 10, 17, 2, 1, '#e04848');
  // 창문 틀 (벽, 8,1) — 안쪽 밤하늘은 애니메이션에서
  box(g, 8 * PX - 2, 3, 20, 24, '#906040');

  // 책상 (1~3,2) + 의자
  box(g, PX, 2 * PX + 1, 3 * PX, 12, '#a86c40');
  R(g, PX + 1, 2 * PX + 2, 3 * PX - 2, 3, '#c88c58');
  R(g, PX + 2, 3 * PX - 3, 2, 3, OUT); R(g, 4 * PX - 4, 3 * PX - 3, 2, 3, OUT);
  // 모니터 (1,2)
  box(g, PX + 2, 2 * PX - 9, 12, 10, '#404858');
  R(g, PX + 7, 2 * PX + 1, 2, 2, '#404858');
  // 스탠드
  R(g, 2 * PX + 8, 2 * PX - 7, 1, 8, '#606060'); box(g, 2 * PX + 5, 2 * PX - 9, 7, 4, '#f0e0a0');
  // 의자
  box(g, 2 * PX + 3, 3 * PX + 2, 10, 9, '#586070'); R(g, 2 * PX + 4, 3 * PX + 3, 8, 2, '#707a8a');

  // TV장 + TV + 게임기 (6~7,2)
  box(g, 6 * PX, 2 * PX + 4, 2 * PX, 11, '#905c38');
  R(g, 6 * PX + 1, 2 * PX + 5, 2 * PX - 2, 2, '#b07848');
  box(g, 6 * PX + 1, PX + 2, 15, 13, '#303038');
  box(g, 7 * PX + 3, 2 * PX, 10, 5, '#f0f0f0', '#808088');
  R(g, 7 * PX + 4, 2 * PX + 1, 2, 3, '#e04848'); R(g, 7 * PX + 10, 2 * PX + 1, 2, 3, '#4878e0');

  // 협탁 (9,2)
  box(g, 9 * PX + 2, 2 * PX + 2, 12, 13, '#a86c40');
  R(g, 9 * PX + 3, 2 * PX + 3, 10, 2, '#c88c58'); R(g, 9 * PX + 7, 2 * PX + 9, 2, 1, OUT);

  // 침대 (10~11, 2~3)
  box(g, 10 * PX, 2 * PX - 3, 2 * PX, 2 * PX + 3, '#a06838');
  R(g, 10 * PX + 2, 2 * PX - 1, 2 * PX - 4, 2 * PX - 1, '#f8f8f8');
  box(g, 10 * PX + 5, 2 * PX, 2 * PX - 10, 7, '#ffffff', '#b8b8c8');
  R(g, 10 * PX + 2, 2 * PX + 9, 2 * PX - 4, 2 * PX - 11, '#5880d0');
  R(g, 10 * PX + 2, 2 * PX + 9, 2 * PX - 4, 2, '#78a0e8');
  for (let i = 0; i < 4; i++) R(g, 10 * PX + 5 + i * 7, 2 * PX + 15, 3, 1, '#4868b8');

  // 책장 (1, 6~7)
  box(g, PX + 1, 6 * PX - 4, 14, 2 * PX + 4, '#905c38');
  const books = ['#e04848', '#4878e0', '#f0b030', '#58b058', '#9858d0', '#f08838'];
  for (let r = 0; r < 4; r++) {
    R(g, PX + 2, 6 * PX - 3 + r * 9 + 8, 12, 1, '#603818');
    for (let i = 0; i < 4; i++) R(g, PX + 3 + i * 3, 6 * PX - 2 + r * 9, 2, 7, books[(r * 4 + i) % books.length]);
  }

  // 화분 (11,8)
  box(g, 11 * PX + 4, 8 * PX + 8, 8, 7, '#c06838');
  for (const [dx, dy, c] of [[2, 0, '#48a048'], [6, -2, '#58b858'], [10, 1, '#48a048'], [4, 3, '#68c868'], [8, 4, '#58b858']] as const) {
    R(g, 11 * PX + dx, 8 * PX + dy, 4, 4, c);
  }

  // 방문 (6,9) + 발매트
  box(g, 6 * PX + 1, (H - 1) * PX - 1, 14, PX + 1, '#905c38');
  R(g, 6 * PX + 3, (H - 1) * PX + 2, 10, 5, '#a87048'); R(g, 6 * PX + 3, (H - 1) * PX + 9, 10, 5, '#a87048');
  R(g, 6 * PX + 12, (H - 1) * PX + 8, 2, 2, '#f0c030');
  box(g, 6 * PX + 2, (H - 2) * PX + 11, 12, 5, '#c05040');
  return c;
}

/** 깜빡이는 TV, 휴대폰, 별똥별, 입영통지서 반짝임 */
export function drawRoomAnimated(g: G, t: number, noticeRead: boolean) {
  // TV 화면
  const flick = Math.floor(t * 8) % 3;
  R(g, 6 * PX + 3, PX + 4, 11, 9, ['#80b8e8', '#90c8f0', '#78b0e0'][flick]);
  R(g, 6 * PX + 4, PX + 5, 3, 1, '#ffffff');
  // 모니터 화면
  R(g, PX + 4, 2 * PX - 7, 8, 6, '#70c8f0'); R(g, PX + 5, 2 * PX - 6, 4, 1, '#ffffff');
  // 휴대폰
  R(g, 9 * PX + 6, 2 * PX + 2, 4, 6, '#303038');
  if (Math.floor(t * 2) % 2 === 0) R(g, 9 * PX + 7, 2 * PX + 3, 2, 1, '#68f0a0');
  // 입영통지서
  R(g, 3 * PX + 3, 2 * PX + 1, 9, 6, '#f8f8f8'); R(g, 3 * PX + 4, 2 * PX + 2, 4, 1, '#e04848'); R(g, 3 * PX + 4, 2 * PX + 4, 6, 1, '#a0a0a0');
  if (!noticeRead && Math.floor(t * 3) % 2 === 0) {
    for (const [dx, dy] of [[1, -2], [11, -2], [-1, 4], [13, 4], [6, -4]]) R(g, 3 * PX + 2 + dx, 2 * PX + dy, 1, 1, '#ffe048');
  }
  // 창밖 밤하늘 + 별똥별
  const wx = 8 * PX, wy = 5;
  R(g, wx, wy, 16, 20, '#202c60');
  R(g, wx + 11, wy + 2, 3, 3, '#f8f0c0');
  for (const [sx, sy] of [[2, 3], [6, 12], [3, 16], [12, 9], [9, 5]]) {
    R(g, wx + sx, wy + sy, 1, 1, Math.floor(t * 2 + sx) % 3 ? '#ffffff' : '#a0a8d0');
  }
  const ph = (t * 0.3) % 1;
  if (ph < 0.3) {
    const k = ph / 0.3;
    const sx = Math.round(wx + 1 + k * 13), sy = Math.round(wy + 1 + k * 11);
    R(g, sx, sy, 1, 1, '#ffffff'); R(g, sx - 1, sy - 1, 1, 1, '#f8f0a0'); R(g, sx - 2, sy - 2, 1, 1, '#c0b870');
  }
  R(g, wx + 7, wy, 2, 20, '#906040'); R(g, wx, wy + 9, 16, 2, '#906040');
}

/** 머리 위 느낌표 말풍선 */
export function drawExclaim(g: G, cx: number, topY: number) {
  const x = Math.round(cx - 4), y = Math.round(topY - 11);
  box(g, x, y, 9, 10, '#ffffff');
  R(g, x + 4, y + 2, 1, 4, '#e04848'); R(g, x + 4, y + 7, 1, 1, '#e04848');
}
