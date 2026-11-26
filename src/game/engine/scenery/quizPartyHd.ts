import { type Ink, type Point, pixelText, seeded } from './pixels';
import { type Brush, brush, vignette } from './hd';

/** 두 못 사이에 늘어진 줄의 처짐 (period 칸마다 못, phase = 못 하나의 자리) */
function droop(x: number, period: number, phase: number, depth: number) {
  const t = ((((x - phase) / period) % 1) + 1) % 1;
  return depth * 4 * t * (1 - t);
}

/** 풍선: 그늘 진 몸통 · 왼쪽 위 반사광 · 매듭 (x, y = 몸통 가운데) */
function balloon(B: Brush, x: number, y: number, r: number, [c, dark, lit]: string[]) {
  const ry = r * 1.16;
  B.oval('#1408142c', x + 3, y + 4, r, ry);
  B.oval(dark, x, y, r, ry);
  B.oval(c, x - r * 0.1, y - r * 0.12, r * 0.88, ry * 0.88);
  B.oval(lit, x - r * 0.4, y - r * 0.46, r * 0.3, r * 0.42);
  B.oval('#fffaf0d0', x - r * 0.44, y - r * 0.56, r * 0.1, r * 0.18);
  B.poly(dark, [[x - 2, y + ry + 2.5], [x + 2, y + ry + 2.5], [x, y + ry - 0.5]]);
}

/** 늘어진 끈 (두 점 사이를 옆으로 살짝 휘게) */
function cord(B: Brush, c: string, a: Point, b: Point, bend: number) {
  const n = 8;
  let [px, py] = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t + Math.sin(t * Math.PI) * bend, y = a[1] + (b[1] - a[1]) * t;
    B.seg(c, px, py, x, y, 1);
    [px, py] = [x, y];
  }
}

const BALLOONS: Record<string, string[]> = {
  red: ['#e8485a', '#a8283e', '#ff98a2'],
  blue: ['#4a9ae8', '#2a5eac', '#a8d4ff'],
  yellow: ['#f2c84a', '#bc8a26', '#fff0a8'],
  pink: ['#f07ab0', '#b44a80', '#ffc0dc'],
  teal: ['#3cc0aa', '#1e8478', '#a0f0e0'],
};
const PENNANTS = [['#f2c84a', '#c8962c', '#fff0a0'], ['#4aa8e0', '#2c72b0', '#a8dcff'], ['#e8506a', '#b02c48', '#ff98a8'], ['#5cc888', '#2e9060', '#a8f0c0'], ['#f08a4a', '#c05c2c', '#ffc090']];

/**
 * 꿈속 퀴즈 3. 처음 보는 사람들만 있는 자리 (고해상도): 저녁의 파티룸. 천장 아래로 삼각 깃발 줄과 전구 줄이 늘어지고,
 * 벽 가운데에는 "만나서 반가워요!" 현수막, 왼쪽에는 선물 상자에 묶은 풍선 다발, 오른쪽에는 케이크가 놓인 간식 테이블.
 * 설계 좌표에서 바닥선은 270칸(화면 높이의 57%)이고, 가로 화면에서는 화면 위쪽 끝이 53칸쯤이다.
 * 풍선 · 현수막 · 테이블은 각자의 기준점에 붙어 있어서 화면이 넓어지면 사이가 벌어지고, 그 틈에 옷걸이 · 스피커가 들어선다.
 * 세로 화면에서는 천장까지 빈 벽이 길어서 깃발 줄과 전구 줄을 몇 겹 더 건다.
 * 등장 포켓몬은 질문 창 위(가운데 아래)에 따로 서므로, 가운데 아래는 비워 두고 키 큰 케이크는 테이블 오른쪽 끝에 둔다.
 */
export function quizPartyHd(g: Ink, w: number, h: number) {
  const rand = seeded(5303);
  const s = Math.min(h / 380, w / 400);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const floorY = Math.round(h * 0.57);
  const oy = floorY - 270 * s;
  const W = brush(g, Math.round(w / 2), oy, s); // 가운데: 깃발 줄 · 전구 줄 · 현수막
  const L = brush(g, Math.round(Math.max(w * 0.16, 58 * s)), oy, s); // 풍선과 선물
  const T = brush(g, Math.round(Math.min(w * 0.77, w - 88 * s)), oy, s); // 간식 테이블
  const edge = w / 2 / s + 12; // 화면 양 끝 (W 기준 설계 칸)

  // ── 벽: 자두색 벽지, 아래는 몰딩 두른 징두리 ──
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#2e1834'); wall.addColorStop(0.55, '#4a2a48'); wall.addColorStop(1, '#5e3654');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, floorY);
  const stripe = Math.max(8, Math.round(22 * s));
  for (let x = stripe >> 1; x < w; x += stripe) {
    g.fillStyle = '#f2b8d00a'; g.fillRect(x, 0, Math.max(2, Math.round(stripe * 0.32)), floorY);
    g.fillStyle = '#10061424'; g.fillRect(x - 1, 0, 1, floorY);
  }
  for (let y = W.Y(222) % u(22); y < W.Y(222); y += u(22)) {
    for (let x = (stripe >> 1) + Math.round(stripe * 0.16); x < w; x += stripe) { g.fillStyle = '#f6c8dc14'; g.fillRect(x, y, 1, 1); }
  }
  // 전구 빛이 벽에 번진 자리 · 조명이 벽에 남긴 색 얼룩
  W.glow('#ffb46a2a', 0, 96, 300);
  const spots: [number, number, number, string][] = [
    [-150, 150, 60, '#f86aa01a'], [130, 120, 54, '#6ac8f816'], [-30, 196, 46, '#f8c86a14'], [250, 180, 50, '#f86aa014'], [-300, 110, 56, '#6ac8f814'],
    [-90, 182, 18, '#f86aa026'], [72, 176, 16, '#f8c86a24'], [196, 140, 18, '#6ac8f822'], [-236, 190, 16, '#f8c86a22'], [-404, 170, 18, '#f86aa022'], [380, 132, 18, '#6ac8f822'],
  ];
  for (const [x, y, r, c] of spots) W.glow(c, x, y, r);

  // 징두리: 의자 높이 몰딩 아래로 액자 몰딩
  const railY = W.Y(224);
  g.fillStyle = '#4a2842'; g.fillRect(0, railY, w, floorY - railY);
  for (let x = Math.round(-edge / 60) * 60 - 25; x < edge; x += 60) {
    W.box('#5a344e', x, 233, 50, 1);
    W.box('#5a344e', x, 233, 1, 28);
    W.box('#2a1428', x, 260, 50, 1);
    W.box('#2a1428', x + 49, 233, 1, 28);
  }
  const low = g.createLinearGradient(0, railY, 0, floorY);
  low.addColorStop(0, '#1a0a1800'); low.addColorStop(1, '#1a0a1850');
  g.fillStyle = low; g.fillRect(0, railY, w, floorY - railY);
  g.fillStyle = '#6a3e5a'; g.fillRect(0, railY - u(4), w, u(4));
  g.fillStyle = '#a06a84'; g.fillRect(0, railY - u(4), w, 1);
  g.fillStyle = '#26101e'; g.fillRect(0, railY, w, 1);

  // ── 바닥: 뒤로 갈수록 좁아지는 짙은 마루 널 ──
  for (let y = floorY, row = 0; y < h; row++) {
    const depth = Math.max(4, Math.round((8 + row * 4.5) * s));
    g.fillStyle = row % 2 ? '#48282e' : '#502e36'; g.fillRect(0, y, w, depth);
    g.fillStyle = '#6c4048'; g.fillRect(0, y, w, 1);
    g.fillStyle = '#2a141a'; g.fillRect(0, y + depth - 1, w, 1);
    const plank = Math.round((64 + row * 22) * s);
    for (let x = -((row * 37) % plank); x < w; x += plank) {
      g.fillStyle = '#2a141a'; g.fillRect(x, y + 1, 1, depth - 2);
      g.fillStyle = '#6c404870'; g.fillRect(x + 1, y + 1, 1, depth - 2);
    }
    for (let i = 0; i < w / 32; i++) {
      g.fillStyle = i % 3 ? '#38202640' : '#6a444c48';
      g.fillRect(Math.round(rand() * w), y + 2 + Math.floor(rand() * Math.max(1, depth - 4)), Math.round((8 + rand() * 22) * s), 1);
    }
    y += depth;
  }
  // 걸레받이
  const skirt = u(6);
  g.fillStyle = '#2c1626'; g.fillRect(0, floorY - skirt, w, skirt);
  g.fillStyle = '#6a3e5a'; g.fillRect(0, floorY - skirt, w, 1);
  g.fillStyle = '#12060e'; g.fillRect(0, floorY - 1, w, 1);
  // 바닥에 비친 전구 빛
  W.glow('#ffb46a1c', 0, 300, 220);
  T.glow('#ffc8781c', -30, 290, 90);

  // ── 깃발 줄과 전구 줄: 못마다 처진다. 세로 화면이면 천장까지 빈 벽이 길어서 여러 겹으로 건다 ──
  const flagY = (x: number, base: number, k: number) => base + droop(x, 150, 75 + k * 47, 14);
  const wireY = (x: number, base = 58, k = 0) => base + 28 + droop(x, 230, 115 + k * 83, 24);
  const garland = (base: number, k: number, flags: boolean) => {
    // 삼각 깃발: 왼쪽 반은 위에서 오는 빛을 받고 오른쪽 반은 그늘
    if (flags) for (let x = Math.floor(-edge / 15) * 15; x < edge; x += 15) {
      const t = ((((x - 75 - k * 47) / 150) % 1) + 1) % 1;
      if (t < 0.05 || t > 0.95) continue;
      const [c, dark, lit] = PENNANTS[((Math.round(x / 15 + k * 2) % 5) + 5) % 5];
      const a = x - 6, b = x + 6, ya = flagY(a, base, k), yb = flagY(b, base, k), tip = (ya + yb) / 2 + 17;
      W.poly('#10061430', [[a + 2, ya + 3], [b + 2, yb + 3], [x + 2, tip + 3]]);
      W.poly(c, [[a, ya], [b, yb], [x, tip]]);
      W.poly(dark, [[x, (ya + yb) / 2], [b, yb], [x, tip]]);
      W.poly(lit, [[a, ya], [x, (ya + yb) / 2], [x, (ya + yb) / 2 + 2], [a + 1.5, ya + 1.5]]);
    }
    if (flags) {
      for (let i = 0; i < w; i++) {
        const y = W.Y(flagY((i + 0.5 - W.X(0)) / s, base, k));
        g.fillStyle = '#e8d6c0'; g.fillRect(i, y - 1, 1, 1);
        g.fillStyle = '#8a6a6a'; g.fillRect(i, y, 1, 1);
      }
      for (let x = Math.floor(-edge / 150) * 150 + 75 + k * 47 - 150; x < edge; x += 150) {
        W.oval('#2a141e', x, base - 0.5, 2.2, 2.2);
        W.oval('#d8b890', x - 0.4, base - 1, 1.3, 1.3);
      }
    }
    // 전구 줄: 깃발 줄보다 길게 처진다
    for (let i = 0; i < w; i++) {
      g.fillStyle = '#1c0c16'; g.fillRect(i, W.Y(wireY((i + 0.5 - W.X(0)) / s, base, k)), 1, u(1));
    }
    for (let x = Math.floor(-edge / 230) * 230 + 115 + k * 83 - 230; x < edge; x += 230) W.oval('#2a141e', x, base + 28, 1.8, 1.8);
    const bulbs: [number, number, string, string][] = [];
    for (let x = Math.floor(-edge / 19) * 19 + 9; x < edge; x += 19) {
      const t = ((((x - 115 - k * 83) / 230) % 1) + 1) % 1;
      if (t < 0.04 || t > 0.96) continue;
      const n = ((Math.round((x - 9) / 19 + k) % 4) + 4) % 4;
      bulbs.push([x, wireY(x, base, k), ['#ffe49a', '#ffb070', '#ff9ab8', '#ffe49a'][n], ['#fffbe8', '#ffe8c8', '#ffe4ee', '#fffbe8'][n]]);
    }
    for (const [x, y, c] of bulbs) W.glow(c + '48', x, y + 6, 18);
    for (const [x, y, c, core] of bulbs) {
      W.box('#2a1a1e', x - 1, y, 2.5, 3);
      W.box('#5a4a48', x - 1, y, 1, 3);
      W.oval(c, x + 0.25, y + 6, 2.4, 3.2);
      W.oval(core, x - 0.25, y + 5.2, 1, 1.6);
    }
  };
  const room = 58 - (-oy / s + 5); // 맨 아래 겹(가로 화면의 그 줄)과 화면 위쪽 끝 사이
  const rows = Math.max(0, Math.round(room / 110));
  for (let k = rows; k >= 0; k--) garland(58 - k * (rows ? room / rows : 0), k, k === 0 || k === rows);

  // ── 현수막: "만나서 반가워요!" (글씨 폭에 맞춰 천 길이를 정한다) ──
  const words = '만나서 반가워요!';
  g.font = '15px Galmuri14, sans-serif';
  const bw = Math.max(54, Math.ceil((g.measureText(words).width + 30) / s / 2));
  W.poly('#10061440', [[-bw - 12, 140], [-bw, 140], [-bw, 166], [-bw - 12, 166], [-bw - 6, 153]]);
  W.box('#10061440', -bw + 3, 138, bw * 2, 30);
  for (const side of [-1, 1]) {
    const x0 = side * bw, x1 = side * (bw + 15);
    W.poly('#c84a66', [[x0, 139], [x1, 139], [x1 - side * 7, 150.5], [x1, 162], [x0, 162]]);
    W.poly('#9a3050', [[x0, 155], [x1 - side * 4, 155], [x1, 162], [x0, 162]]);
    W.box('#e8708a', side < 0 ? x1 : x0, 139, 15, 1);
  }
  W.box('#f2e2c4', -bw, 134, bw * 2, 30);
  W.box('#fff4dc', -bw, 134, bw * 2, 1);
  for (let x = -bw + 10; x < bw - 4; x += 18) { W.box('#dcc8a6', x, 135, 2, 29); W.box('#fffaea60', x + 2, 135, 1, 29); }
  W.box('#d8c09a', -bw, 160, bw * 2, 4);
  W.box('#e8607a', -bw, 137, bw * 2, 2);
  W.box('#e8607a', -bw, 158, bw * 2, 2);
  W.box('#b23c5a', -bw, 163, bw * 2, 1);
  pixelText(g, words, W.X(0), W.Y(148), '#a42a4a', 'Galmuri14', 15);
  for (const x of [-bw + 7, bw - 7]) {
    W.box('#f2b83a', x - 0.5, 145, 1, 7);
    W.box('#f2b83a', x - 3, 148, 6, 1);
  }
  // 매단 끈: 전구 줄이 가까우면 거기에 묶고, 멀면(세로 화면) 벽에 박은 못에 건다
  for (const x of [-bw + 6, bw - 6]) {
    const tie = Math.max(wireY(x), 108);
    W.box('#d8c4a8', x - 0.5, tie, 1, 134 - tie);
    if (tie > wireY(x) + 3) { W.oval('#2a141e', x, tie, 1.8, 1.8); W.oval('#d8b890', x - 0.4, tie - 0.5, 1, 1); }
    W.oval('#2a141e', x, 134, 1.6, 1.6);
  }

  // ── 왼쪽: 선물 상자에 묶은 풍선 다발 ──
  L.oval('#12060c60', 6, 271, 40, 4);
  const knotAt: Point = [-3, 216];
  const bunch: [number, number, number, string, number][] = [
    [-4, 106, 15, 'blue', 4], [-31, 122, 14, 'red', -5], [23, 120, 14, 'yellow', 6], [-18, 148, 13, 'teal', -3], [11, 146, 13.5, 'pink', 3],
  ];
  for (const [x, y, r, , bend] of bunch) cord(L, '#e8dcc8b0', [x, y + r * 1.16 + 2.5], knotAt, bend);
  for (const [x, y, r, c] of bunch) balloon(L, x, y, r, BALLOONS[c]);
  // 선물 상자 셋: 큰 상자 위에 작은 상자, 옆에 하나
  const present = (x: number, y: number, bw: number, bh: number, c: string, dark: string, lit: string, ribbon: string, rdark: string) => {
    L.box(c, x, y, bw, bh);
    L.box(dark, x + bw - 4, y, 4, bh);
    L.box(dark, x - 1, y, bw + 2, 4);
    L.box(lit, x - 1, y, bw + 2, 1);
    L.box('#10061430', x, y + 4, bw, 1);
    L.box(ribbon, x + bw / 2 - 2, y, 4, bh);
    L.box(rdark, x + bw / 2 + 1, y, 1, bh);
    L.box(ribbon, x, y + bh / 2, bw, 3);
    L.box(rdark, x, y + bh / 2 + 2, bw, 1);
  };
  present(-24, 236, 38, 34, '#d8485e', '#a8304a', '#ff90a0', '#f2c84a', '#bc8a26');
  present(18, 252, 22, 18, '#3cb08a', '#26806a', '#8ae8c8', '#f07ab0', '#b44a80');
  present(-15, 220, 24, 16, '#4a8ae0', '#2a5eac', '#a8ccff', '#fff2e0', '#c8b8a8');
  // 나비 리본: 풍선 끈이 여기서 모인다
  L.oval('#f6ecdc', -8, 216, 5, 3);
  L.oval('#f6ecdc', 2, 216, 5, 3);
  L.oval('#c8b8a8', -8, 217, 3, 1.5);
  L.oval('#c8b8a8', 2, 217, 3, 1.5);
  L.poly('#e8dcc8', [[-4, 218], [-8, 224], [-5, 224]]);
  L.poly('#e8dcc8', [[-2, 218], [2, 224], [-1, 224]]);
  L.oval('#fffaf0', -3, 216.5, 2, 2);

  // ── 오른쪽: 케이크가 놓인 간식 테이블 ──
  T.oval('#12060c70', 0, 271, 88, 5);
  for (const x of [-70, 64]) { T.box('#2e1820', x, 232, 6, 38); T.box('#5a3a40', x, 232, 1.5, 38); }
  T.box('#12060c60', -72, 232, 144, 4);
  // 식탁보: 윗면 · 주름 진 앞자락 · 물결 단
  const hem = (x: number) => 232 + 3.5 * Math.sqrt(Math.max(0, 1 - ((((x + 80) % 16) + 16) % 16 / 8 - 1) ** 2));
  T.ridge('#ead8c0', -80, 80, () => 206, hem);
  for (let x = -80; x < 80; x += 16) {
    T.ridge('#d2bea2', x + 10, x + 15, () => 208, hem);
    T.ridge('#fff4e2', x + 2, x + 5, () => 208, (xx) => hem(xx) - 2);
  }
  T.ridge('#b89e84', -80, 80, (x) => hem(x) - 2, hem);
  T.box('#e8607a', -80, 208, 160, 2.5);
  T.box('#ff98ac', -80, 208, 160, 1);
  T.poly('#f6e8d2', [[-76, 202], [76, 202], [80, 206], [-80, 206]]);
  T.box('#fffaee', -76, 202, 152, 1);
  T.box('#c8b296', -80, 206, 160, 1.5);
  // 케이크: 받침 접시 위의 이단 케이크, 초 세 개 (키가 커서 현수막과 먼 오른쪽 끝에 둔다)
  const ck = 46;
  T.glow('#ffd08a50', ck, 150, 44);
  T.oval('#c8b8a8', ck, 205, 11, 1.8);
  T.box('#d8ccc0', ck - 2, 197, 4, 8);
  T.oval('#b8a898', ck, 197.5, 27, 2.6);
  T.oval('#f2ece4', ck, 196.5, 27, 2.4);
  const tier = (x0: number, x1: number, y0: number, y1: number) => {
    T.box('#f8e6e8', x0, y0, x1 - x0, y1 - y0);
    T.box('#e8c8cc', x1 - (x1 - x0) * 0.26, y0, (x1 - x0) * 0.26, y1 - y0);
    T.box('#fff6f4', x0, y0, 2, y1 - y0);
    T.box('#f07a98', x0, y0, x1 - x0, 4);
    T.box('#ffb4c8', x0, y0, x1 - x0, 1);
    for (let x = x0 + 2; x < x1 - 2; x += 5) T.oval(x > x1 - (x1 - x0) * 0.3 ? '#c85a78' : '#f07a98', x + 1.5, y0 + 5 + ((x * 7) % 3), 1.6, 2.4);
    T.box('#f07a98', x0, y1 - 2, x1 - x0, 2);
    T.box('#c85a78', x0, y1 - 1, x1 - x0, 1);
  };
  tier(ck - 22, ck + 22, 174, 196);
  tier(ck - 14, ck + 14, 158, 174);
  for (const x of [ck - 19, ck - 9, ck + 9, ck + 17]) { T.oval('#d83040', x, 173, 2, 2); T.box('#ff8a90', x - 1, 172, 1, 1); }
  for (const x of [ck - 7, ck, ck + 7]) {
    T.box('#fff4f0', x - 1, 148, 2.5, 10);
    for (let y = 149; y < 158; y += 3) T.box('#6ab8e8', x - 1, y, 2.5, 1);
    T.box('#3a2a2a', x - 0.5, 146.5, 1, 1.5);
    T.oval('#ffb04a', x, 143.5, 1.8, 3);
    T.oval('#fff4c0', x, 144.5, 0.9, 1.6);
  }
  // 고깔모자 둘
  for (const [x, c, band] of [[-14, '#4aa8e0', '#f2c84a'], [-1, '#e8506a', '#fff2e0']] as [number, string, string][]) {
    T.poly(c, [[x - 6, 204], [x + 6, 204], [x, 184]]);
    for (const y of [190, 196, 202]) {
      const k = (y - 184) / 20;
      T.box(band, x - 6 * k, y, 12 * k, 1.5);
    }
    T.poly('#00000030', [[x + 1, 186], [x + 6, 204], [x + 2, 204]]);
    T.oval('#fff6e8', x, 183.5, 2.6, 2.6);
    T.oval('#d8c8b8', x + 0.8, 184.3, 1.4, 1.4);
  }
  // 종이컵 · 음료수 병
  for (const [x, c] of [[-38, '#e8485a'], [-29, '#4a9ae8'], [-33.5, '#5cc888']] as [number, string][]) {
    const y = x === -33.5 ? 186 : 194;
    if (x === -33.5) T.box('#00000030', x - 3.5, 193, 8, 1);
    T.poly('#fff4e8', [[x - 4, y], [x + 4, y], [x + 3, y + 10], [x - 3, y + 10]]);
    T.poly(c, [[x - 3.6, y + 3], [x + 3.6, y + 3], [x + 3.2, y + 7], [x - 3.2, y + 7]]);
    T.poly('#00000024', [[x + 1.5, y], [x + 4, y], [x + 3, y + 10], [x + 1, y + 10]]);
  }
  const bx = 8;
  T.box('#3a8a5a', bx, 182, 9, 22);
  T.box('#2a6a44', bx + 6, 182, 3, 22);
  T.box('#7ad09a', bx + 1, 182, 1, 22);
  T.poly('#3a8a5a', [[bx, 182], [bx + 9, 182], [bx + 6, 175], [bx + 3, 175]]);
  T.box('#3a8a5a', bx + 3, 170, 3, 6);
  T.box('#e8485a', bx + 2.5, 168, 4, 3);
  T.box('#f6ecdc', bx, 189, 9, 7);
  T.box('#e8485a', bx, 191, 9, 2);
  // 과자 접시
  T.oval('#b8a898', -60, 204, 14, 2.4);
  T.oval('#f2ece4', -60, 203, 14, 2.2);
  for (const [x, y] of [[-66, 200], [-59, 200.5], [-53, 200], [-62.5, 197], [-56, 197.5], [-59.5, 194]]) {
    T.oval('#a86a3a', x, y + 0.6, 3.6, 1.9);
    T.oval('#d8a060', x, y, 3.6, 1.8);
    T.box('#5a3420', x - 1.5, y - 0.5, 1, 1);
    T.box('#5a3420', x + 1, y, 1, 1);
  }

  // ── 바닥: 색종이 · 터뜨린 폭죽 끈 ──
  for (let i = 0; i < w * 0.07; i++) {
    const x = rand() * w, y = floorY + u(3) + rand() ** 1.3 * (h - floorY - u(4));
    const k = 0.6 + (y - floorY) / Math.max(1, h - floorY);
    g.fillStyle = PENNANTS[i % 5][i % 3 === 0 ? 2 : 0] + (i % 4 === 0 ? '' : 'c8');
    if (i % 2) g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(2 * s * k)), Math.max(1, Math.round(s * k)));
    else g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(s * k)), Math.max(1, Math.round(2 * s * k)));
  }
  const curl = (B: Brush, c: string, x0: number, y0: number, len: number, dir: number) => {
    let px = x0, py = y0;
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, x = x0 + dir * len * t + Math.sin(t * Math.PI * 4) * 3, y = y0 + Math.cos(t * Math.PI * 4) * 2.2 + t * 4;
      B.seg(c, px, py, x, y, 1);
      [px, py] = [x, y];
    }
  };
  // 테이블 옆에 떨어진 폭죽
  T.poly('#f2c84a', [[-96, 288], [-86, 283], [-85, 288], [-95, 292]]);
  T.poly('#e8506a', [[-93, 287.5], [-90, 286], [-89.5, 290], [-92.5, 291]]);
  T.poly('#f6ecdc', [[-86, 283], [-84, 282], [-83, 289], [-85, 288]]);
  curl(T, '#4aa8e0', -84, 284, 22, 1);
  curl(T, '#f07ab0', -84, 287, 18, 1);
  curl(L, '#f2c84a', 44, 278, 20, 1);

  // ── 화면이 넓으면: 손님들 외투가 걸린 옷걸이 (풍선과 현수막 사이) ──
  const gapL = L.X(44), gapR = W.X(-66);
  if (gapR - gapL > 96 * s) {
    const R = brush(g, Math.round((gapL + gapR) / 2), oy, s);
    R.oval('#12060c60', 0, 271, 26, 3.5);
    R.box('#3a2228', -2, 122, 4, 146);
    R.box('#6a4448', -2, 122, 1, 146);
    R.oval('#3a2228', 0, 121, 3.5, 2.5);
    for (const d of [-1, 1]) { R.seg('#3a2228', 0, 262, d * 20, 270, 2); R.seg('#3a2228', d * 4, 128, d * 13, 124, 1.5); }
    // 외투 셋: 고리에 걸려 어깨가 처지고 소매가 옆으로 늘어진다. 가운데 것이 맨 앞
    const coat = (x: number, len: number, c: string, dark: string, lit: string) => {
      const y = 130, hemY = y + len;
      R.poly(c, [[x - 4, y], [x + 4, y], [x + 12, y + 9], [x + 16, hemY], [x - 16, hemY], [x - 12, y + 9]]);
      R.poly(dark, [[x + 4, y], [x + 12, y + 9], [x + 16, hemY], [x + 8, hemY], [x + 6, y + 12]]);
      R.poly(lit, [[x - 4, y], [x - 12, y + 9], [x - 16, hemY], [x - 14, hemY], [x - 10, y + 10]]);
      // 소매
      R.poly(dark, [[x - 12, y + 9], [x - 8, y + 12], [x - 9, y + len * 0.68], [x - 14, y + len * 0.68]]);
      R.poly(dark, [[x + 12, y + 9], [x + 8, y + 12], [x + 9, y + len * 0.68], [x + 14, y + len * 0.68]]);
      R.box(lit, x - 14, y + len * 0.68 - 2, 5, 1);
      // 깃과 여밈 · 단추
      R.poly(dark, [[x - 4, y], [x + 4, y], [x + 1, y + 16], [x - 1, y + 16]]);
      R.poly(lit, [[x - 4, y], [x - 1, y + 16], [x - 3, y + 14], [x - 6, y + 3]]);
      R.box(dark, x, y + 16, 1, len - 16);
      for (let k = 0; k < 3; k++) R.box('#e8d8b8', x + 2, y + 21 + k * 9, 1.5, 1.5);
      R.box('#00000030', x - 16, hemY - 2, 32, 2);
    };
    coat(-13, 60, '#5a6a8a', '#38445e', '#8094b4');
    coat(13, 52, '#b88a3a', '#86602a', '#e0b86a');
    coat(0, 70, '#8a3a4a', '#5e2434', '#b8606e');
    // 목도리와 모자
    R.box('#d8cec0', 5, 140, 4, 30);
    R.box('#4aa8e0', 5, 148, 4, 2); R.box('#4aa8e0', 5, 156, 4, 2);
    R.box('#4aa8e0', 5, 168, 4, 2);
    R.oval('#2e2a3a', 0, 119, 16, 3);
    R.poly('#3e3a4e', [[-9, 119], [-8, 108], [8, 108], [9, 119]]);
    R.box('#e8506a', -9, 115, 18, 2.5);
    R.box('#5a566e', -8, 108, 16, 1);
  }

  // ── 화면이 넓으면: 오른쪽 끝에 음악을 트는 스피커 ──
  if (w - T.X(84) > 74 * s) {
    const P = brush(g, Math.round((T.X(84) + w) / 2), oy, s);
    P.oval('#12060c60', 0, 271, 26, 3.5);
    P.box('#1a1018', -20, 186, 40, 84);
    P.box('#2e2028', -20, 186, 40, 2);
    P.box('#3a2a32', -20, 186, 2, 84);
    P.box('#0e080c', 17, 186, 3, 84);
    for (const [y, r] of [[208, 8], [244, 13]]) {
      P.oval('#3a2a32', 0, y, r + 2, r + 2);
      P.oval('#0a0608', 0, y, r, r);
      P.oval('#2a1e24', 0, y, r * 0.55, r * 0.55);
      P.oval('#4a3a42', -r * 0.25, y - r * 0.25, r * 0.18, r * 0.18);
    }
    P.oval('#6af0c8', 13, 192, 1.4, 1.4);
    P.glow('#6af0c850', 13, 192, 8);
    // 흘러나오는 음표
    for (const [x, y, c] of [[-14, 170, '#f2c84a'], [6, 160, '#ff9ab8'], [-4, 146, '#a8dcff']] as [number, number, string][]) {
      P.oval(c, x, y, 2.6, 2);
      P.box(c, x + 1.6, y - 9, 1, 9);
      P.box(c, x + 1.6, y - 9, 4, 1.5);
    }
  }

  vignette(g, w, h, '#12060e', 0.42);
}
