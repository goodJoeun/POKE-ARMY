import { type Ink, type Point, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 두 색을 섞는다 (t = 0 이면 a, 1 이면 b) */
const mix = (a: string, b: string, t: number) => {
  const p = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
};
const hex = (a: number) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, '0');

/** 눈높이 (m) 와 초점 (설계 칸): 땅 위 z m 앞의 점은 지평선에서 EYE * FOCAL / z 칸 아래에 놓인다 */
const EYE = 1.6, FOCAL = 130;
/** 안개 빛깔과, 거리 z m 에서 안개에 묻히는 정도 */
const FOG = '#c3cdce';
const haze = (z: number) => 1 - Math.exp(-Math.max(0, z - 1.4) / 8);
/** 차단기 · 정문 기둥이 선 거리 (m) */
const GATE = 2.05;

/**
 * 화면의 뼈대: 지평선(세로 44%) · 소실점(가로 57%) · 초소 창의 왼쪽 기둥 폭 · 위 셔터 상자 높이 · 창턱.
 * 창턱은 지평선에서 152칸 아래라 가로 화면에서는 세로 76%쯤, 세로로 긴 화면에서는 더 위에 온다 (그 아래는 초소 안).
 */
function frame(w: number, h: number) {
  const s = Math.min(h / 480, w / 420);
  const vx = Math.round(w * 0.57), hz = Math.round(h * 0.44);
  const sill = Math.round(hz + 152 * s);
  const jamb = Math.round(Math.min(w * 0.14, 112 * s));
  const head = Math.round(Math.max(30 * s, h * 0.06));
  /** 오른쪽 정문 기둥의 화면 가로 범위 (안개가 그 뒤로 지나가게) */
  const post = [vx + Math.round(3.0 * FOCAL / GATE * s), vx + Math.round(3.16 * FOCAL / GATE * s)];
  return { s, vx, hz, sill, jamb, head, post };
}

/** 김 한 가닥: 가운데가 두껍고 양 끝이 가는 가로 줄 무더기 (줄마다 1px, 가장자리가 번지지 않는다) */
function wisp(g: Ink, x: number, y: number, len: number, rows: number, alpha: number, color = '#e4eae8', seed = 0) {
  for (let k = 0; k < rows; k++) {
    const t = (k + 0.5) / rows * 2 - 1;
    const half = len / 2 * Math.sqrt(1 - t * t);
    const a = alpha * (0.55 + 0.45 * (1 - Math.abs(t)));
    if (half < 1 || a < 1) continue;
    const dx = Math.sin(k * 1.9 + seed) * len * 0.06;
    g.fillStyle = color + hex(a);
    g.fillRect(Math.round(x - half + dx), Math.round(y + k), Math.round(half * 2), 1);
  }
}

/**
 * 위병소 초소 안에서 내다본 정문 (고해상도). 차단기 너머로 길이 안개 속에 사라지고, 따뜻한 빛은 모두 이쪽에만 있다.
 * 바깥은 눈높이 1.6 m 에서 본 하나의 투시로 그린다: 차단기와 가로등을 단 정문 기둥은 2 m 앞, 울타리는 오른쪽 길섶을 따라 멀어진다.
 * 화면이 넓어지면 길섶과 산이 옆으로 더 보일 뿐이다. 왼쪽 기둥 · 위 셔터 상자 · 창턱은 초소의 창틀이다.
 * 움직이는 김은 gateMistHd 가 이 그림 위에 따로 얹는다.
 */
export function fogGateHd(g: Ink, w: number, h: number) {
  const rand = seeded(2340);
  const { s, vx, hz, sill, jamb, head } = frame(w, h);
  const B = brush(g, vx, hz, s);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => {
    const x0 = Math.round(x), y0 = Math.round(y);
    g.fillStyle = c; g.fillRect(x0, y0, Math.round(x + bw) - x0, Math.round(y + bh) - y0);
  };
  /** 바깥의 한 점 (X = 길 가운데에서 옆으로, Y = 땅에서 위로, z = 창에서의 거리, 모두 m) */
  const pt = (X: number, Y: number, z: number): Point => [X * FOCAL / z, (EYE - Y) * FOCAL / z];
  const far = (c: string, z: number) => mix(c, FOG, haze(z));
  /** 땅 위의 상자: 앞면과, 보이는 옆면 · 윗면 */
  const block = (X1: number, X2: number, Y1: number, Y2: number, z1: number, z2: number, front: string, side: string, top: string) => {
    const zc = (z1 + z2) / 2;
    if (X2 < 0) B.poly(far(side, zc), [pt(X2, Y2, z1), pt(X2, Y2, z2), pt(X2, Y1, z2), pt(X2, Y1, z1)]);
    if (X1 > 0) B.poly(far(side, zc), [pt(X1, Y2, z1), pt(X1, Y2, z2), pt(X1, Y1, z2), pt(X1, Y1, z1)]);
    if (Y2 < EYE) B.poly(far(top, zc), [pt(X1, Y2, z1), pt(X2, Y2, z1), pt(X2, Y2, z2), pt(X1, Y2, z2)]);
    const [ax, ay] = pt(X1, Y2, z1), [bx, by] = pt(X2, Y1, z1);
    B.box(far(front, z1), ax, ay, bx - ax, by - ay);
  };

  // ── 밤하늘: 안개가 부대 불빛을 머금어 지평선 쪽이 희붐하다 ──
  const sky = g.createLinearGradient(0, 0, 0, hz);
  ['#111a29', '#1d2a3d', '#3a4c61', '#7b8e9b', '#b8c4c6'].forEach((c, i, a) => sky.addColorStop(i / (a.length - 1), c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hz + 1);
  // 구름 뒤의 달무리
  B.glow('#cfdbe21c', -190, -250, 190);
  B.glow('#dfe8ec14', -190, -250, 70);
  // 하늘에 길게 걸린 안개 결
  for (let i = 0; i < 40; i++) {
    const y = hz - (12 + rand() ** 1.6 * 150) * s;
    fill(i % 3 ? '#a9b7bd14' : '#d8e0e012', rand() * w - 60 * s, y, (60 + rand() * 220) * s, 1);
  }

  // ── 먼 산: 양옆에서 솟고, 고갯길 한가운데는 안개에 묻힌다 ──
  const ridge = (tall: number, phase: number, c: string, lit: string) => {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - vx) / s, flank = Math.min(1, Math.max(0, (Math.abs(u) - 24) / 230));
      const top = Math.round(hz - flank * (tall + 9 * Math.sin(u / 51 + phase) + 4 * Math.cos(u / 17 + phase * 2)) * s);
      fill(c, x, top, 1, hz - top + 2);
      fill(lit, x, top, 1, 1);
    }
  };
  ridge(40, 0.4, '#8a9ca7', '#94a5ae');
  ridge(24, 2.3, '#73899a', '#7f93a2');
  // 산등성이의 소나무 숲: 가운데로 갈수록 작고 흐리다
  for (let x = -6 * s; x < w; x += (2 + rand() * 3.5) * s) {
    const u = (x - vx) / s, flank = Math.min(1, Math.max(0, (Math.abs(u) - 16) / 260));
    if (flank <= 0.02) continue;
    const tall = Math.round((6 + rand() * 18) * flank * s), base = hz + Math.round((2 + rand() * 3) * s);
    if (tall < 2) continue;
    g.fillStyle = mix('#566d7d', FOG, 0.72 - 0.5 * flank);
    const tier = Math.max(3, Math.round(tall / 3.2));
    for (let k = 0; k < tall; k++) {
      const half = Math.floor(k * 0.2 + (k % tier) * 0.5 * (k / tall + 0.3));
      g.fillRect(Math.round(x) - half, base - tall + k, half * 2 + 1, 1);
    }
  }
  // 지평선에 깔린 두꺼운 안개
  const bank = g.createLinearGradient(0, hz - 34 * s, 0, hz + 8 * s);
  bank.addColorStop(0, FOG + '00'); bank.addColorStop(0.6, FOG + '90'); bank.addColorStop(1, FOG);
  g.fillStyle = bank;
  g.fillRect(0, Math.round(hz - 34 * s), w, Math.round(42 * s));

  // ── 땅: 줄마다 거리를 재서 안개에 묻는다. 길 · 연석 · 차선 · 정지선 · 과속방지턱 ──
  const lane = (y: number, X1: number, X2: number, k: number, c: string) => fill(c, vx + X1 * k, y, (X2 - X1) * k, 1);
  for (let y = hz; y < sill + 24 * s; y++) {
    const D = (y + 0.5 - hz) / s;
    if (D <= 0) continue;
    const z = EYE * FOCAL / D, k = FOCAL / z * s;
    fill(far('#3f5053', z), 0, y, w, 1);
    for (const side of [-1, 1]) lane(y, side < 0 ? -2.78 : 2.6, side < 0 ? -2.6 : 2.78, k, far('#76838a', z));
    lane(y, -2.6, 2.6, k, far('#2b3740', z));
    lane(y, -1.1, 1.1, k, far('#34414a', z));
    for (const side of [-1, 1]) lane(y, side < 0 ? -2.44 : 2.3, side < 0 ? -2.3 : 2.44, k, far('#9ba7a8', z));
    if (z > 2.3 && (z + 0.6) % 6.5 < 2.6) lane(y, -0.07, 0.07, k, far('#a69a62', z));
    if (z > 2.6 && z < 2.78) lane(y, -2.3, 2.3, k, far('#a8b2b1', z));
    if (z > 3.55 && z < 3.82) {
      for (let X = -2.5; X < 2.5; X += 0.5) lane(y, X, X + 0.5, k, far(Math.round(X * 2) % 2 ? '#a88d3e' : '#22282b', z));
      if (z > 3.76) lane(y, -2.5, 2.5, k, far('#c8b67a', z) + '70');
    }
  }
  // 젖은 아스팔트: 잔 알갱이와, 안개빛이 비친 긴 결
  for (let i = 0; i < w * 1.4; i++) {
    const D = 4 + rand() ** 0.7 * 150, z = EYE * FOCAL / D, X = (rand() * 2 - 1) * 2.55;
    if (haze(z) > 0.8) continue;
    fill(i % 3 ? '#5b67701c' : '#11181e30', B.X(X * FOCAL / z), B.Y(D), Math.max(1, Math.round((0.05 + rand() * 0.14) * FOCAL / z * s)), 1);
  }
  for (let i = 0; i < 44; i++) {
    const D = 8 + rand() * 140, z = EYE * FOCAL / D, X = (rand() * 2 - 1) * 1.5;
    fill('#c8d3d4' + hex(26 * (1 - haze(z) * 0.6)), B.X(X * FOCAL / z), B.Y(D), (0.4 + rand() * 1.6) * FOCAL / z * s, 1);
  }
  // 길섶의 마른 풀: 서리 앉은 끝이 희다
  for (let i = 0; i < 360; i++) {
    const D = 3 + rand() ** 0.6 * 160, z = EYE * FOCAL / D, side = rand() > 0.5 ? 1 : -1;
    const X = side * (2.85 + rand() ** 1.4 * 14), f = haze(z);
    if (f > 0.86) continue;
    const [x, y] = pt(X, 0, z), t = (0.06 + rand() * 0.1) * FOCAL / z, lean = (rand() - 0.5) * 0.6;
    const c = mix('#2a3739', FOG, f), tip = mix('#aebcba', FOG, f * 0.7);
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const bx = x + (j - (n - 1) / 2) * t * 0.16, tall = t * (0.55 + rand() * 0.45), dx = (lean + (j - (n - 1) / 2) * 0.22) * tall;
      B.seg(c, bx, y, bx + dx, y - tall, 0.6);
      if (j % 2 === 0) B.box(tip, bx + dx, y - tall, 1 / s, 1 / s);
    }
  }

  // ── 오른쪽 길섶의 철조망 울타리: 먼 기둥은 안개에 묻힌다 ──
  const FX = 5.3, posts = [46, 36, 28.5, 22.5, 17.8, 14, 11, 8.6, 6.7, 5.2, 4, 3.05, 2.35];
  for (let i = 0; i + 1 < posts.length; i++) {
    const z1 = posts[i], z2 = posts[i + 1], c = far('#2f3a40', (z1 + z2) / 2);
    for (const Y of [0.35, 0.75, 1.15, 1.5]) B.seg(c, ...pt(FX, Y, z1), ...pt(FX, Y, z2), 0.5);
    B.seg(c, ...pt(FX + 0.22, 1.82, z1), ...pt(FX + 0.22, 1.82, z2), 0.5);
    // 가시
    for (let j = 1; j < 6; j++) {
      const z = z1 + (z2 - z1) * j / 6;
      if (haze(z) > 0.7) continue;
      const [x, y] = pt(FX, 1.5, z);
      B.box(c, x - 0.6, y - 1.2, 1.4, 2.4);
    }
  }
  for (const z of posts) {
    block(FX - 0.05, FX + 0.05, 0, 1.62, z, z + 0.06, '#2c373d', '#46545b', '#5b686e');
    B.seg(far('#283238', z), ...pt(FX, 1.6, z), ...pt(FX + 0.24, 1.9, z), 0.06 * FOCAL / z);
    const [x, y] = pt(FX - 0.05, 1.62, z);
    B.box(far('#7d8a8e', z), x, y, 0.1 * FOCAL / z, 1 / s);
  }

  // ── 과속방지턱 너머 길 위에 낮게 깔린 김 (움직이지 않는 부분) ──
  for (let i = 0; i < 7; i++) {
    const z = 4.5 + i * 2.6 + rand() * 2, [, y] = pt(0, 0.1 + rand() * 0.3, z);
    wisp(g, vx + (rand() - 0.5) * 300 * s, B.Y(y), (120 + rand() * 260) * s, Math.round((3 + rand() * 4) * s), 34 - i * 2, '#dfe6e4', i);
  }

  // ── 정문 기둥과 가로등: 차단기 끝을 받치고, 머리 위로 등을 내밀었다 ──
  const lampX = 2.12, lampY = 2.86;
  const [hx, hy] = pt(lampX, lampY, GATE), [gx, gy] = pt(lampX, 0, GATE);
  // 등 아래 길에 고인 빛 웅덩이
  {
    const cx = B.X(gx), cy = B.Y(gy), r = 150 * s;
    const pool = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    pool.addColorStop(0, '#f2c27e40'); pool.addColorStop(0.5, '#e0b07a18'); pool.addColorStop(1, '#e0b07a00');
    g.save(); g.translate(0, cy); g.scale(1, 0.24); g.translate(0, -cy);
    g.fillStyle = pool; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
  }
  // 젖은 길에 길게 비친 등불
  for (let i = 0; i < 70; i++) {
    const d = rand() ** 1.3, y = gy + 2 + d * (152 - gy + 8), half = (1.5 + d * 9) * (0.4 + rand() * 0.6);
    B.box(d < 0.35 ? '#ffd9988a' : d < 0.7 ? '#f2c48a5a' : '#e8b98036', hx + (rand() - 0.5) * (3 + d * 10) - half, y, half * 2, 1);
  }
  // 안개 속으로 번지는 불빛과 빛 기둥
  B.poly('#ffdca00e', [[hx - 6, hy + 4], [hx + 6, hy + 4], [hx + 62, gy + 4], [hx - 70, gy + 4]]);
  B.poly('#ffdca00c', [[hx - 4, hy + 4], [hx + 4, hy + 4], [hx + 34, gy], [hx - 40, gy]]);
  B.glow('#ffcf8840', hx, hy + 6, 120);
  B.glow('#ffe2a858', hx, hy + 5, 42);
  // 기둥
  block(3.0, 3.16, 0, 3.02, GATE, GATE + 0.12, '#3c4850', '#5f6461', '#8e9a9e');
  {
    const [x1, y1] = pt(3.0, 3.02, GATE), [x2] = pt(3.16, 0, GATE), [, y2] = pt(3.0, 0, GATE);
    B.box('#2a343a', x2 - 2, y1, 2, y2 - y1);
    B.box('#a39d8c', x1, y1, 1.2, y2 - y1);
    B.box('#4a565d', x1 + 3, y1, 1, y2 - y1);
    // 밑동의 노랑 · 검정 띠
    for (let j = 0; j < 4; j++) {
      const [, ya] = pt(3.0, 0.1 + j * 0.12, GATE);
      B.box(j % 2 ? '#2a2e30' : '#b89a46', x1, ya - 0.12 * FOCAL / GATE, x2 - x1, 0.12 * FOCAL / GATE);
    }
    B.box('#262d32', x1 - 2, y2 - 3, x2 - x1 + 4, 3);
  }
  // 등을 내민 팔과 등갓
  B.seg('#4a565d', ...pt(3.08, 2.98, GATE), ...pt(2.4, 2.98, GATE), 2.4);
  B.seg('#4a565d', ...pt(3.08, 2.72, GATE), ...pt(2.7, 2.96, GATE), 1.6);
  B.seg('#8f9a9c', ...pt(3.08, 3.0, GATE), ...pt(2.4, 3.0, GATE), 0.8);
  B.poly('#3b464d', [[hx - 15, hy - 3], [hx + 15, hy - 3], [hx + 19, hy + 4], [hx - 19, hy + 4]]);
  B.box('#9aa4a4', hx - 15, hy - 3, 30, 1);
  B.box('#1e262b', hx - 19, hy + 4, 38, 1.4);
  B.box('#fff0c4', hx - 13, hy + 5.4, 26, 2.6);
  B.box('#ffd896', hx - 15, hy + 8, 30, 1);

  // ── 차단기: 왼쪽 길섶의 기계함에서 길을 가로질러 정문 기둥의 받침에 걸친다 ──
  // 받침 (기둥 왼쪽 면의 U자 걸이)
  {
    const [x1, y1] = pt(2.88, 1.06, GATE), [x2, y2] = pt(3.0, 0.86, GATE);
    B.box('#2d363b', x1, y1, x2 - x1, y2 - y1);
    B.box('#7a858a', x1, y1, x2 - x1, 1);
  }
  // 모래주머니
  {
    const [x1, y1] = pt(-5.62, 0, 1.72), [x2] = pt(-3.66, 0, 1.72);
    B.box('#141b1e70', x1, y1 - 3, x2 - x1, 5);
  }
  for (let row = 0; row < 4; row++) {
    const z = 1.72, Y = row * 0.15, k = FOCAL / z;
    for (let X = -5.6 + row * 0.2 + (row % 2) * 0.27; X < -3.62 - row * 0.1; X += 0.54) {
      const [x, y] = pt(X, Y + 0.15, z), bw = 0.52 * k, bh = 0.16 * k;
      B.poly('#2c2e24', [[x + 2, y + bh], [x + bw - 2, y + bh], [x + bw, y + bh - 3], [x + bw, y + 3], [x + bw - 3, y], [x + 3, y], [x, y + 3], [x, y + bh - 3]]);
      B.poly('#5d5c45', [[x + 2, y + bh - 2], [x + bw - 3, y + bh - 2], [x + bw - 1.5, y + bh - 4], [x + bw - 1.5, y + 3], [x + bw - 4, y + 1], [x + 3, y + 1], [x + 1, y + 3], [x + 1, y + bh - 4]]);
      B.box('#77765a', x + 4, y + 1.6, bw - 8, 1.6);
      B.box('#45452f', x + bw * 0.5, y + 3, 1, bh - 5);
      B.box('#3a3a2a', x + 3, y + bh - 3, bw - 6, 1);
    }
  }
  // 기계함과 평형추
  block(-3.08, -2.7, 0, 1.06, 1.95, 2.28, '#5f6764', '#8a877b', '#a9aa9e');
  {
    const [x1, y1] = pt(-3.08, 1.06, 1.95), [x2, y2] = pt(-2.7, 0, 1.95);
    B.box('#9ba29a', x1, y1, 1.2, y2 - y1);
    B.box('#4b524f', x2 - 1.6, y1, 1.6, y2 - y1);
    B.box('#565d5a', x1 + 4, y1 + 9, x2 - x1 - 8, 1);
    B.box('#565d5a', x1 + 4, y2 - 16, x2 - x1 - 8, 1);
    for (let j = 0; j < 3; j++) B.box('#3e4542', x1 + 6, y1 + 18 + j * 4, x2 - x1 - 12, 1.4);
    B.box('#b9a24a', x1 + 4, y1 + 40, x2 - x1 - 8, 5);
    for (let j = 0; j < 4; j++) B.poly('#2a2e2c', [[x1 + 5 + j * 5, y1 + 45], [x1 + 8 + j * 5, y1 + 45], [x1 + 11 + j * 5, y1 + 40], [x1 + 8 + j * 5, y1 + 40]]);
    B.box('#2f3532', x1 - 2, y2 - 3, x2 - x1 + 4, 3);
    // 꺼진 경광등
    B.box('#3a3f3d', x1 + 7, y1 - 3, x2 - x1 - 14, 3);
    B.oval('#8e3f3a', (x1 + x2) / 2, y1 - 6, 4.5, 4);
    B.oval('#c26a5e', (x1 + x2) / 2 - 1.2, y1 - 7.2, 1.6, 1.4);
  }
  {
    const z = 2.12, [cx1, cy1] = pt(-3.46, 1.03, z), [cx2, cy2] = pt(-2.84, 0.84, z);
    B.box('#262c2c', cx1, cy1, cx2 - cx1, cy2 - cy1);
    B.box('#545b58', cx1, cy1, cx2 - cx1, 1.2);
    B.box('#3a4140', cx1 + 3, cy1 + 4, cx2 - cx1 - 6, 1);
  }
  // 막대: 빨강 · 흰 띠, 윗변은 등불을 받는다
  {
    const z = 2.1, [ax, ay] = pt(-2.9, 1.0, z), [bx, by] = pt(2.94, 0.9, z), th = by - ay, seg = 0.44 * FOCAL / z;
    B.box('#0b10146a', ax, by + 1, bx - ax, 2.4);
    B.box('#e3ddc8', ax, ay, bx - ax, th);
    for (let x = ax + seg * 0.6, j = 0; x < bx - 2; x += seg, j++) {
      if (j % 2) continue;
      B.poly('#b04b44', [[x, ay], [Math.min(bx, x + seg), ay], [Math.min(bx, x + seg - th * 0.6), by], [x - th * 0.6, by]]);
    }
    B.box('#fff6dc', ax, ay, bx - ax, 1);
    B.box('#f4d9a8', ax + (bx - ax) * 0.55, ay, (bx - ax) * 0.45, 1);
    B.box('#7d7466', ax, by - 1.2, bx - ax, 1.2);
    // 끝의 반사판
    B.box('#d9463e', bx - 5, ay - 1, 5, th + 2);
    B.box('#ffb08e', bx - 4, ay, 1.6, th);
    // 굴대
    B.oval('#3d4442', ax + 2, (ay + by) / 2, 5.5, 5.5);
    B.oval('#a4aba4', ax + 2, (ay + by) / 2, 2.4, 2.4);

    // 가운데 매달린 정지 표지
    const cx = B.X(-0.25 * FOCAL / z), cy = B.Y(by + 0.4 * FOCAL / z);
    const r = Math.max(16, Math.round(19 * s)), c = Math.round(r * 0.42);
    const oct = (d: number): Point[] => [[cx - c + d, cy - r + d], [cx + c - d, cy - r + d], [cx + r - d, cy - c + d], [cx + r - d, cy + c - d], [cx + c - d, cy + r - d], [cx - c + d, cy + r - d], [cx - r + d, cy + c - d], [cx - r + d, cy - c + d]];
    const P = brush(g, 0, 0, 1);
    P.seg('#3d4446', cx - c, B.Y(by), cx - c, cy - r, 1);
    P.seg('#3d4446', cx + c, B.Y(by), cx + c, cy - r, 1);
    P.poly('#0c1116', oct(-1));
    P.poly('#e9e4d4', oct(0));
    P.poly('#b8453f', oct(2));
    P.poly('#cf5a50', [[cx - c + 2, cy - r + 2], [cx + c - 2, cy - r + 2], [cx + r - 2, cy - c + 2], [cx + r - 4, cy - c + 2]]);
    if (r >= 20) pixelText(g, '정지', cx, cy, '#f6efe0', 'Galmuri14', 15);
    else pixelText(g, '정지', cx, cy, '#f6efe0');
  }

  // ── 유리: 차가운 반사와, 아래쪽에 서린 김 ──
  B.clip((jamb - vx) / s, (head - hz) / s, (w - jamb) / s, (sill - head) / s, () => {
    const L = (jamb - vx) / s;
    B.poly('#ffffff07', [[L + 40, -300], [L + 120, -300], [L - 60, 160], [L - 140, 160]]);
    B.poly('#ffffff05', [[L + 170, -300], [L + 196, -300], [L + 16, 160], [L - 10, 160]]);
    const breath = g.createLinearGradient(0, sill - 40 * s, 0, sill);
    breath.addColorStop(0, '#b9c6c800'); breath.addColorStop(1, '#b9c6c838');
    g.fillStyle = breath;
    g.fillRect(jamb, Math.round(sill - 40 * s), w - jamb, Math.round(40 * s));
    // 김 서린 자리의 잔 물방울: 창턱 가까이와 왼쪽 구석에 몰려 있다
    for (let i = 0; i < w * 0.7; i++) {
      const x = jamb + rand() ** 2.4 * (w - jamb), y = sill - rand() ** 3 * 34 * s;
      fill(i % 5 ? '#d5dfde38' : '#f4f8f466', x, y, 1, 1);
    }
  });

  // ── 초소의 창틀: 왼쪽 판자 기둥 ──
  fill('#1d2830', 0, 0, jamb, h);
  const plank = Math.max(6, Math.round(15 * s));
  for (let x = jamb - Math.round(9 * s) - plank, i = 0; x > -plank; x -= plank, i++) {
    fill(i % 2 ? '#212d35' : '#1f2a33', x, 0, plank, h);
    fill('#34434c', x + 1, 0, 1, h);
    fill('#131b22', x + plank - 1, 0, 1, h);
    for (let j = 0; j < 7; j++) fill('#2b3943' + (j % 2 ? '80' : 'c0'), x + 2 + Math.floor(rand() * (plank - 4)), rand() * h, 1, (16 + rand() * 70) * s);
    for (let y = Math.round((40 + i * 23) % 70 * s); y < h; y += Math.round(140 * s)) fill('#5b6870', x + (plank >> 1), y, Math.max(1, Math.round(1.6 * s)), Math.max(1, Math.round(1.6 * s)));
  }
  // 창 쪽 끝의 문설주와 알루미늄 창틀
  fill('#2d3a43', jamb - Math.round(9 * s), 0, Math.round(9 * s), h);
  fill('#4a5862', jamb - Math.round(9 * s), 0, 1, h);
  fill('#6c7a82', jamb - Math.round(4 * s), 0, Math.round(4 * s), h);
  fill('#a9b4b8', jamb - Math.round(4 * s), 0, 1, h);
  fill('#3a464e', jamb - 1, 0, 1, h);
  // 기둥에 걸린 근무 명령서 클립보드
  if (jamb > 50 * s) {
    const C = brush(g, Math.round(jamb / 2 - 4 * s), Math.round(hz - 40 * s), s);
    C.oval('#7d8890', 0, -34, 1.6, 1.6);
    C.seg('#556169', 0, -33, -8, -24, 0.6); C.seg('#556169', 0, -33, 8, -24, 0.6);
    C.box('#0c131955', -15, -21, 33, 50);
    C.box('#6b5a44', -17, -24, 34, 50);
    C.box('#86735a', -17, -24, 34, 1);
    C.box('#c9c8bb', -14, -19, 28, 42);
    C.box('#e0dfd2', -14, -19, 28, 1);
    C.box('#9fa198', -14, 22, 28, 1);
    for (let i = 0; i < 7; i++) C.box(i === 0 ? '#5a6a72' : '#8d918a', -11, -12 + i * 5, i === 0 ? 14 : 20 - (i * 7) % 9, 1.2);
    C.box('#a64b45', 6, -13, 4, 2);
    C.box('#8a9399', -7, -27, 14, 6);
    C.box('#c5ccd0', -7, -27, 14, 1);
    C.box('#4d575d', -3, -22, 6, 2);
  }

  // ── 위: 말아 올린 셔터 상자 ──
  fill('#1a242c', 0, 0, w, head);
  const rib = Math.max(3, Math.round(6 * s));
  for (let y = head - rib * 2, i = 0; y > -rib; y -= rib, i++) {
    fill(i % 2 ? '#222e37' : '#1f2a33', 0, y, w, rib);
    fill('#2f3c46', 0, y, w, 1);
    fill('#121a20', 0, y + rib - 1, w, 1);
  }
  for (let i = 0; i < w / 14; i++) fill('#40342a50', rand() * w, head - rib * 2 + rand() * rib * 2, (4 + rand() * 30) * s, 1);
  // 셔터 끝막대와 손잡이
  fill('#3d4a53', 0, head - rib * 2, w, Math.max(2, Math.round(4 * s)));
  fill('#7d8a91', 0, head - rib * 2, w, 1);
  fill('#0d1318', 0, head - 1, w, 1);
  fill('#6c7a82', jamb, head, w - jamb, Math.max(2, Math.round(3 * s)));
  fill('#a9b4b8', jamb, head + Math.max(2, Math.round(3 * s)) - 1, w - jamb, 1);
  {
    const sx = Math.round(w * 0.5), hw = Math.round(12 * s);
    fill('#2c363d', sx - hw, head - rib * 2 + Math.round(4 * s), hw * 2, Math.round(5 * s));
    fill('#8c979c', sx - hw, head - rib * 2 + Math.round(4 * s), hw * 2, 1);
  }

  // ── 창턱과 그 위의 물건들: 초소 안의 따뜻한 불빛을 받는다 ──
  const S = brush(g, 0, sill, s);
  const lip = Math.round(16 * s);
  fill('#5c5246', 0, sill, w, lip);
  const top = g.createLinearGradient(0, sill, 0, sill + lip);
  top.addColorStop(0, '#3e3a3600'); top.addColorStop(1, '#8a765a50');
  g.fillStyle = top; g.fillRect(0, sill, w, lip);
  fill('#2b2824', 0, sill, w, Math.max(1, Math.round(1.5 * s)));
  for (let i = 0; i < w / 5; i++) fill(i % 3 ? '#6f634f60' : '#463e3460', rand() * w, sill + 2 + rand() * (lip - 3), (6 + rand() * 40) * s, 1);
  fill('#a68e6c', 0, sill + lip, w, Math.max(1, Math.round(1.5 * s)));
  fill('#4a4036', 0, sill + lip + Math.max(1, Math.round(1.5 * s)), w, Math.round(6 * s));
  fill('#1b1714', 0, sill + lip + Math.max(1, Math.round(1.5 * s)) + Math.round(6 * s), w, Math.max(1, Math.round(2 * s)));
  // 초소 안쪽 벽
  const wallTop = sill + lip + Math.round(9 * s);
  fill('#1a2027', 0, wallTop, w, h - wallTop);
  for (let x = 0, i = 0; x < w; x += plank, i++) {
    fill(i % 2 ? '#1c232a' : '#1a2128', x, wallTop, plank, h - wallTop);
    fill('#2a323a', x, wallTop, 1, h - wallTop);
  }
  // 세로로 긴 화면: 창턱 아래 벽이 대사 창 위로 드러나면 근무 수칙 판을 건다
  const room = h * 0.78 - wallTop;
  if (room > 100 * s) {
    const N = brush(g, Math.round(w * 0.5), Math.round(wallTop + room * 0.48), s);
    N.box('#0b0f1370', -56, -34, 118, 76);
    N.box('#30363a', -60, -40, 120, 78);
    N.box('#4a5156', -60, -40, 120, 1);
    N.box('#cfcbb9', -56, -36, 112, 70);
    N.box('#2f5470', -56, -36, 112, 15);
    N.box('#4d7590', -56, -36, 112, 1);
    for (let i = 0; i < 5; i++) {
      N.box('#7b7c72', -48, -12 + i * 9, 5, 2);
      N.box('#9a9a8e', -38, -12 + i * 9, 76 - (i * 17) % 34, 1.6);
    }
    N.box('#a8483f', 40, 22, 9, 9);
    N.box('#cfcbb9', 42, 24, 5, 5);
    pixelText(g, '근무 수칙', N.X(0), N.Y(-28.5), '#eef0e6');
  }
  // 근무일지와 볼펜
  const L = jamb + 18 * s;
  {
    const A = brush(g, Math.round(L), sill, s);
    A.poly('#0d0c0b70', [[2, 14], [86, 14], [90, 10], [6, 10]]);
    A.poly('#2f3d33', [[0, 12], [82, 12], [88, 4], [8, 4]]);
    A.poly('#d9d3bf', [[2, 10], [41, 10], [43, 3], [10, 3]]);
    A.poly('#cfc8b2', [[43, 10], [80, 10], [85, 3], [45, 3]]);
    A.box('#8d8572', 42, 3, 1.4, 7);
    for (let i = 0; i < 3; i++) { A.box('#8a8778', 13 + i * 1.2, 5 + i * 1.6, 24, 0.8); A.box('#8a8778', 47 + i * 1.4, 5 + i * 1.6, 30, 0.8); }
    A.box('#3d5ea0', 18, 3.4, 5, 0.8);
    A.box('#a8483f', 58, 6.6, 4, 0.8);
    A.box('#1d2721', 0, 12, 82, 2);
    A.seg('#2b3a66', 30, 9, 66, 1, 1.4);
    A.seg('#a9b2c4', 30, 8.4, 52, 3.5, 0.6);
    A.box('#c8ccd4', 64, 0.5, 3, 1.6);
  }
  // 각진 군용 손전등
  {
    const F = brush(g, Math.round(L + 104 * s), sill, s);
    F.box('#0d0c0b70', 0, 11, 24, 3);
    // 몸통: 세로 원통, 고무 띠 두 줄
    F.box('#3c4733', 2, -12, 12, 23);
    F.box('#5a6750', 3, -12, 2, 23);
    F.box('#29311f', 12, -12, 2, 23);
    for (const y of [-4, 4]) { F.box('#2b3323', 2, y, 12, 2); F.box('#4d5944', 2, y, 12, 0.8); }
    F.box('#262c20', 0, -10, 2, 14);
    // 직각으로 꺾인 머리와 렌즈 (꺼져 있다)
    F.box('#3c4733', 1, -23, 18, 11);
    F.box('#5a6750', 1, -23, 18, 1.6);
    F.box('#29311f', 1, -13.6, 18, 1.6);
    F.box('#262c20', 18, -24, 4, 13);
    F.box('#9c9a86', 21, -22, 2, 9);
    F.box('#d9d6c2', 21, -21, 1, 3);
    F.box('#6d7860', 6, -20, 5, 3);
    F.box('#a3463f', 7, -19, 3, 1.2);
  }
  // 김이 오르는 철제 컵
  {
    const M = brush(g, Math.round(L + 142 * s), sill, s);
    M.box('#0d0c0b70', -2, 11, 22, 3);
    M.box('#7f8a8c', 0, -10, 16, 22);
    M.box('#b9c2c0', 1, -10, 3, 22);
    M.box('#56605f', 12, -10, 4, 22);
    M.oval('#2a2620', 8, -10, 8, 2);
    M.oval('#c9d0cc', 8, -10, 8, 2, (_dx, dy) => dy < -0.2);
    M.box('#7f8a8c', 16, -6, 6, 2); M.box('#7f8a8c', 20, -6, 2, 11); M.box('#7f8a8c', 16, 3, 6, 2);
    for (let i = 0; i < 10; i++) M.box('#e8e2d6' + hex(70 - i * 6), 5 + Math.sin(i * 0.9) * 3, -14 - i * 2.6, 1.4 + (i % 3 ? 0 : 1), 2);
  }
  // 야전 전화기: 오른쪽 끝에 (길에 비친 등불을 가리면 그 왼쪽으로)
  {
    let px = w - Math.min(w * 0.12, 96 * s);
    if (Math.abs(px - B.X(hx)) < 50 * s) px = B.X(hx) - 70 * s;
    const T = brush(g, Math.round(px), sill, s);
    T.box('#0d0c0b70', -30, 10, 64, 4);
    T.box('#3f4734', -30, -16, 60, 27);
    T.box('#57604a', -30, -16, 60, 2);
    T.box('#2b3124', -30, 9, 60, 2);
    T.box('#2b3124', 24, -16, 6, 27);
    T.box('#4b543f', -26, -11, 22, 15);
    T.box('#2a3024', -26, -11, 22, 1);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) T.box('#20261c', -24 + i * 5, -8 + j * 4, 2, 2);
    T.box('#a7a184', 0, -9, 16, 6);
    T.box('#55503f', 1, -7, 14, 1);
    // 손잡이 크랭크
    T.box('#232820', 30, -6, 4, 4); T.box('#232820', 32, -6, 2, 12); T.oval('#62684f', 33, 7, 2.4, 2.4);
    // 송수화기
    T.poly('#1f241b', [[-28, -22], [26, -22], [30, -17], [-32, -17]]);
    T.box('#373f2e', -26, -24, 50, 3);
    T.box('#4f5842', -26, -24, 50, 1);
    T.oval('#2a3024', -27, -21, 7, 4.5);
    T.oval('#2a3024', 24, -21, 7, 4.5);
    T.oval('#4f5842', -28, -23, 4, 1.4);
    // 꼬인 줄
    for (let i = 0; i < 9; i++) T.oval('#1d2219', -33 - (i % 2), -16 + i * 3, 2.2, 1.6);
  }
  // 초소 안 등불이 창턱과 기둥 안쪽을 데운다
  S.glow('#ffb4661c', jamb / s + 60, 60, 260);
  S.glow('#ffc47a14', jamb / s + 120, 10, 140);
  fill('#ffcf8a24', jamb - Math.round(4 * s), Math.round(sill - 140 * s), 1, Math.round(140 * s));

  vignette(g, w, h, '#05080d', 0.48);
}

/**
 * 차단기 너머의 빈 틈에서만 움직이는 김 (125 ms 마다 그림 위에 다시 얹힌다).
 * 가닥마다 제 속도로 오른쪽으로 흘러가고, 들어오고 나갈 때는 옅어져서 끊기지 않는다.
 * 초소 창틀과 정문 기둥 앞으로는 지나가지 않는다.
 */
export function gateMistHd(g: Ink, w: number, h: number, seconds: number) {
  const { s, vx, hz, sill, jamb, head, post } = frame(w, h);
  g.save();
  g.beginPath();
  g.rect(jamb, head, Math.max(0, post[0] - jamb), sill - head);
  g.rect(post[1], head, Math.max(0, w - post[1]), sill - head);
  g.clip();
  const span = 300 * s;
  for (let i = 0; i < 12; i++) {
    const r = seeded(611 + i * 37);
    const speed = (3 + r() * 5) * s, len = (90 + r() * 170) * s, travel = span * 2 + len;
    const u = ((seconds * speed + r() * travel) % travel) / travel;
    const x = vx - span - len / 2 + u * travel;
    // 반은 지평선의 안개 둑 앞을, 반은 차단기 너머 길 위를 낮게 지나간다
    const y = hz + (i % 2 ? -30 + r() * 30 : 4 + r() * 22) * s;
    const fade = Math.sin(u * Math.PI) ** 1.5;
    wisp(g, x, y, len, Math.max(2, Math.round((2 + r() * 5) * s)), (36 + r() * 40) * fade, i % 3 ? '#edf1ee' : '#f6f4ec', i);
  }
  g.restore();
}
