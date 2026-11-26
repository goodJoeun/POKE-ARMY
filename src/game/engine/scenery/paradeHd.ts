import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

export type Ellipse = [number, number, number, number]; // 가운데 x, y, 가로 · 세로 반지름 (캔버스 픽셀)

/** 타원 a 가운데 타원 b와 겹치는 부분만 (b가 없으면 a 전체), 줄 단위로 채운다. bottom 아래로는 칠하지 않는다 */
export function lens(g: Ink, c: string, a: Ellipse, b?: Ellipse, bottom = Infinity) {
  const row = ([cx, cy, rx, ry]: Ellipse, y: number) => {
    const v = (y + 0.5 - cy) / ry;
    if (v * v >= 1) return null;
    const d = rx * Math.sqrt(1 - v * v);
    return [cx - d, cx + d];
  };
  g.fillStyle = c;
  for (let y = Math.floor(a[1] - a[3]); y <= Math.min(Math.ceil(a[1] + a[3]), bottom - 1); y++) {
    const A = row(a, y), B = b ? row(b, y) : A;
    if (!A || !B) continue;
    const p = Math.round(Math.max(A[0], B[0])), q = Math.round(Math.min(A[1], B[1]));
    if (q > p) g.fillRect(p, y, q - p, 1);
  }
}

/**
 * 뭉게구름: 둥근 덩이를 겹쳐 쌓고 밑은 평평하게 자른다 (x, y = 왼쪽 밑, 모두 캔버스 픽셀).
 * 덩이마다 해 쪽 윗머리가 밝고 반대쪽 아래가 그늘져서, 앞 덩이가 뒤 덩이 위에 또렷이 겹친다. 밑바닥은 평평하고 어둡다.
 * tones = [그늘, 몸, 볕 받은 쪽, 가장 밝은 곳]. sunSide = 해가 있는 쪽 (-1 왼쪽, 1 오른쪽).
 */
export function cumulus(g: Ink, x: number, y: number, span: number, rise: number, seed: number, tones: string[], sunSide = -1) {
  const rand = seeded(seed);
  x = Math.round(x); y = Math.round(y);
  const st = Math.max(1.15, Math.min(3, span / rise / 6.5)); // 납작한 구름일수록 덩이가 옆으로 퍼진다
  const bell = (t: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
  const lobes: [number, number, number][] = []; // 가운데 x, 가운데 y (밑변 기준), 세로 반지름
  // 뒤에서 앞으로 세 겹: 가운데의 높은 머리 → 어깨 → 밑변에 늘어선 작은 덩이
  const tier = (count: number, from: number, to: number, top: (t: number) => number, size: (t: number) => number) => {
    for (let i = 0; i < count; i++) {
      const t = from + (to - from) * (count === 1 ? 0.5 : (i + 0.2 + rand() * 0.6) / count);
      const r = size(t) * rise * (0.9 + rand() * 0.2), tp = top(t) * rise * (0.92 + rand() * 0.1);
      lobes.push([span * t, -tp + r, r]);
    }
  };
  tier(Math.max(1, Math.round(span / (rise * st * 1.9))), 0.24, 0.76, (t) => 0.7 + 0.3 * bell((t - 0.24) / 0.52), () => 0.42);
  tier(Math.max(2, Math.round(span / (rise * st * 1.05))), 0.1, 0.9, (t) => 0.42 + 0.28 * bell(t), () => 0.3);
  tier(Math.max(3, Math.round(span / (rise * st * 0.48))), 0.03, 0.97, (t) => 0.2 + 0.22 * bell(t), (t) => 0.15 + 0.12 * bell(t));
  const lx = sunSide * 0.45, ly = -0.89; // 빛이 오는 쪽
  const shape = ([cx, cy, r]: [number, number, number], k = 0, shrink = 1): Ellipse =>
    [x + cx + lx * r * st * k, y + cy + ly * r * k, r * st * shrink, r * shrink];
  // 덩이들을 합친 윤곽을 줄마다 칠한다
  const outline = (from: number, grow: number, c: string | CanvasGradient) => {
    g.fillStyle = c;
    for (let yy = Math.floor(from); yy < y; yy++) {
      const runs: number[][] = [];
      for (const [cx, cy, r] of lobes) {
        const v = (yy + 0.5 - y - cy) / (r + grow);
        if (v * v < 1) { const d = (r * st + grow) * Math.sqrt(1 - v * v); runs.push([x + cx - d, x + cx + d]); }
      }
      runs.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < runs.length;) {
        let [a, b] = runs[i++];
        while (i < runs.length && runs[i][0] <= b) b = Math.max(b, runs[i++][1]);
        if (Math.round(b) > Math.round(a)) g.fillRect(Math.round(a), yy, Math.round(b) - Math.round(a), 1);
      }
    }
  };
  outline(y - rise * 1.1, 1, tones[1] + '48'); // 하늘에 녹아드는 가장자리
  for (const l of lobes) {
    const body = shape(l);
    lens(g, tones[0], body, undefined, y);
    lens(g, tones[1], body, shape(l, 0.3), y);
    lens(g, tones[2], body, shape(l, 0.62, 0.94), y);
    if (l[2] > rise * 0.24) lens(g, tones[3], body, shape(l, 0.92, 0.9), y);
  }
  // 아래로 갈수록 그늘이 짙고, 밑바닥은 평평하다
  const shade = g.createLinearGradient(0, y - rise * 0.55, 0, y);
  shade.addColorStop(0, tones[0] + '00'); shade.addColorStop(0.7, tones[0] + '90'); shade.addColorStop(1, tones[0] + 'e0');
  outline(y - rise * 0.55, 0, shade);
  outline(y - Math.max(1, Math.round(rise * 0.05)), 0, '#8ea5b0a0');
}

/**
 * 한낮의 연병장과 구령대 (고해상도). 해는 왼쪽 위에 있어서 그림자가 오른쪽 아래로 눕는다.
 * 구령대는 가로 가운데, 마루 앞단이 화면 높이의 61%다 (예전 그림과 같다). 그 위에 내려앉는 별은 CSS로 따로 얹히고
 * (밑변이 높이 59%), 별빛은 (가로 가운데, 높이 49%)에 SceneryCanvas가 덧칠한다.
 * 확성기 기둥 · 게양대 · 생활관은 각자 화면 가장자리 쪽에 붙어 있어서 화면이 넓어지면 사이가 벌어질 뿐이다.
 */
export function paradeHd(g: Ink, w: number, h: number) {
  const rand = seeded(1088);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const W = w / s; // 설계 칸으로 잰 화면 폭
  const horizon = Math.round(h * 0.51), cx = Math.round(w / 2), stage = Math.round(h * 0.61);
  const yard = Math.min(horizon + u(38), stage - u(20));
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh))); };

  // ── 하늘 ──
  const skyFill = g.createLinearGradient(0, 0, 0, horizon);
  ['#4680a2', '#5f97ae', '#86b3ba', '#bbcec2', '#eee0bd'].forEach((c, i, a) => skyFill.addColorStop(i / (a.length - 1), c));
  g.fillStyle = skyFill;
  g.fillRect(0, 0, w, yard);
  const sun = brush(g, Math.round(w * 0.42), Math.round(h * 0.26), s);
  sun.glow('#fff2b84a', 0, 0, 190);
  const cloudTones = ['#aabfc6', '#e2e1d2', '#f6eed8', '#fffbee'];
  const farTones = ['#b9cbcb', '#e1e2d4', '#efead6', '#f8f3e2']; // 멀수록 대비가 옅다
  const puff = Math.min(1, W / 720);
  cumulus(g, Math.round(-w * 0.07), Math.round(h * 0.2), Math.round(330 * s * puff), 34 * s * puff, 51, cloudTones);
  cumulus(g, Math.round(w * 0.68), Math.round(h * 0.18), Math.round(340 * s * puff), 38 * s * puff, 12, cloudTones);
  cumulus(g, Math.round(w * 0.24), Math.round(h * 0.32), Math.round(200 * s * puff), 15 * s * puff, 44, farTones);
  cumulus(g, Math.round(w * 0.58), Math.round(h * 0.38), Math.round(180 * s * puff), 12 * s * puff, 39, farTones);
  if (W > 1000) {
    cumulus(g, Math.round(w * 0.36), Math.round(h * 0.13), Math.round(170 * s), 16 * s, 27, cloudTones);
    cumulus(g, Math.round(w * 0.04), Math.round(h * 0.4), Math.round(150 * s), 10 * s, 63, farTones);
  }

  // ── 산: 멀수록 옅다. 가까운 능선은 해 쪽(왼쪽) 비탈이 밝다 ──
  const range = (base: number, height: number, color: string, phase: number, lit?: string) => {
    let prev = 0;
    for (let x = -1; x < w; x++) {
      const k = x / s;
      const y = Math.round(base + (Math.sin(k / 78 + phase) + 0.54 * Math.sin(k / 38 - phase) + 0.19 * Math.sin(k / 12 + phase) + 0.07 * Math.sin(k / 4.3)) * height);
      fill(color, x, y, 1, yard - y);
      if (lit && y <= prev) fill(lit, x, y, 1, y < prev ? u(3) : u(1));
      prev = y;
    }
  };
  range(horizon - 34 * s, 9 * s, '#a7bcb3', 0.6);
  range(horizon - 22 * s, 10 * s, '#93aaa2', 3.4, '#a5b9ac');
  range(horizon - 5 * s, 6 * s, '#748e81', 5.2, '#8ba391');
  for (let x = 0; x < w; x += u(3)) {
    const k = x / s, y = horizon - 3 * s + (Math.sin(k / 78 + 5.2) + 0.54 * Math.sin(k / 38 - 5.2)) * 6 * s, t = (2 + rand() * 6) * s;
    fill(rand() > 0.5 ? '#67806f' : '#6d8777', x, y + t, u(2), (4 + rand() * 8) * s);
  }
  const haze = g.createLinearGradient(0, horizon - 40 * s, 0, yard);
  haze.addColorStop(0, '#eee0bd00'); haze.addColorStop(1, '#eee0bd66');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 40 * s, w, yard - horizon + 40 * s);

  // ── 생활관: 방풍림 뒤로 지붕과 위층 창이 보인다 ──
  const dormitory = (x0: number, base: number, width: number) => {
    const B = brush(g, Math.round(x0), base, s), H = 42;
    B.box('#d0cbb6', 0, -H, width, H);
    B.box('#e3ddc7', 0, -H, 4, H);
    B.box('#a9aa98', width - 5, -H, 5, H);
    B.box('#a3a694', 0, -H, width, 3); // 처마 그늘
    B.box('#b9b7a3', 0, -H / 2 - 1, width, 2);
    B.box('#e6e0ca', 0, -H / 2 - 1, width, 1);
    for (let x = 9; x < width - 14; x += 18) {
      for (const y of [-H + 8, -H / 2 + 5]) {
        B.box('#8a9385', x, y, 11, 11);
        B.box('#5b7170', x + 1, y + 1, 9, 9);
        B.box('#6f8683', x + 1, y + 1, 9, 2);
        B.box('#a9b8ac', x + 2, y + 2, 2, 4);
        B.box('#8a9385', x + 5, y + 1, 1, 9);
        B.box('#efe9d3', x - 1, y + 11, 13, 1);
        B.box('#a9aa98', x, y + 12, 12, 1);
      }
      if (rand() > 0.72) B.box('#9aa08f', x + 14, -H + 3, 1, H - 3); // 홈통
    }
    // 지붕
    B.poly('#687674', [[-7, -H], [4, -H - 13], [width - 10, -H - 13], [width + 6, -H]]);
    B.poly('#596866', [[width - 10, -H - 13], [width + 6, -H], [width - 6, -H]]);
    B.poly('#7d8b86', [[-7, -H], [4, -H - 13], [10, -H - 13], [2, -H]]);
    for (let x = 14; x < width - 12; x += 9) B.box('#5d6b69', x, -H - 12, 1, 12);
    B.box('#9ba29a', 4, -H - 13, width - 14, 1);
    B.box('#4f5d5b', -7, -H - 1, width + 13, 1);
    for (let x = 36; x < width - 30; x += 74) { B.box('#77837d', x, -H - 19, 7, 7); B.box('#a8ae9f', x, -H - 19, 7, 1); B.box('#5c6966', x + 5, -H - 18, 2, 6); }
  };
  dormitory(-16 * s, yard - u(2), Math.min(252, W * 0.29 + 16));
  const rightSpan = Math.min(214, W * 0.23 + 10);
  dormitory(w - (rightSpan - 10) * s, yard - u(5), rightSpan);

  // ── 연병장 흙바닥 ──
  const ground = g.createLinearGradient(0, yard, 0, h);
  ground.addColorStop(0, '#d5c6a2'); ground.addColorStop(0.35, '#cbbb96'); ground.addColorStop(1, '#c2b189');
  g.fillStyle = ground;
  g.fillRect(0, yard, w, h - yard);
  // 물기가 남은 자리와 마른 자리
  for (let i = 0; i < 9; i++) {
    const px = rand() * w, py = yard + (0.12 + rand() * 0.85) * (h - yard), r = (60 + rand() * 110) * s;
    const patch = g.createRadialGradient(px, py, 0, px, py, r);
    patch.addColorStop(0, i % 3 ? '#a8997430' : '#f4e6be40'); patch.addColorStop(1, i % 3 ? '#a8997400' : '#f4e6be00');
    g.save(); g.translate(0, py); g.scale(1, 0.24); g.translate(0, -py);
    g.fillStyle = patch; g.fillRect(px - r, py - r, r * 2, r * 2);
    g.restore();
  }
  for (let i = 0; i < w * 7; i++) {
    const y = yard + rand() ** 1.2 * (h - yard), v = (y - yard) / (h - yard);
    fill(i % 3 ? '#998e7240' : '#f7e2b560', rand() * w, y, (1 + rand() * (2 + v * 9)) * s, v > 0.7 && i % 4 === 0 ? 2 : 1);
  }
  // 자갈: 밝은 윗면과 오른쪽 아래의 그림자
  for (let i = 0; i < W / 26; i++) {
    const y = yard + (0.1 + rand() * 0.9) * (h - yard), x = rand() * w, r = Math.max(1, Math.round((0.6 + (y - yard) / (h - yard) * 1.6) * s));
    fill('#958a6e', x + 1, y + 1, r + 1, r);
    fill('#e4d7b4', x, y, r + 1, r);
  }
  // 석회로 그은 선: 구령대 양옆에서 앞으로 벌어진다
  for (const side of [-1, 1]) {
    for (const [from, to, breadth] of [[0.16, 0.85, 2.6], [0.25, 1.03, 1.6]]) {
      for (let y = yard + u(4); y < h; y++) {
        const t = (y - yard) / (h - yard);
        const x = cx + side * w * (from + (to - from) * t), th = Math.max(1, Math.round(breadth * s * (0.7 + t * 2.4)));
        if (x < -th || x > w + th) break;
        if (rand() < 0.07) continue;
        fill('#e9dfbf', x - th / 2, y, th, 1);
        if (rand() < 0.7) fill('#f8f0d6', x - th / 2 + (side < 0 ? 0 : Math.round(th / 2)), y, Math.max(1, th / 2), 1);
        if (rand() < 0.12) fill('#f1e6c780', x - th / 2 - 2 + rand() * (th + 3), y, 2, 1);
      }
    }
  }

  // ── 방풍림: 왼쪽 위에서 볕을 받는 둥근 수관, 사이사이 키 큰 미루나무 ──
  for (let x = -6 * s; x < w + 12 * s;) {
    const tall = rand() > 0.84;
    const ht = tall ? 36 + rand() * 9 : 18 + rand() * 13, rx = tall ? 5.5 + rand() * 1.5 : 8 + rand() * 4.5;
    const T = brush(g, Math.round(x), yard - u(1) - Math.round(rand() * 3 * s), s);
    T.oval('#a2946f80', rx * 0.9, 2.5, rx * 1.5, 2.6);
    T.box('#625f4c', -1.5, -8, 3, 9);
    T.box('#8a8469', -1.5, -8, 1, 9);
    T.oval('#47604e', 0.6, -ht / 2 - 4, rx, ht / 2);
    T.oval('#566f5e', -0.6, -ht / 2 - 5, rx * 0.86, ht / 2 * 0.86);
    // 그늘 쪽(오른쪽 아래)은 한 톤 어둡고, 볕 쪽 어깨에는 잎 뭉치가 부푼다
    T.oval('#4a6351', -0.6, -ht / 2 - 5, rx * 0.86, ht / 2 * 0.86, (dx, dy) => dy * 0.8 + dx * 0.5 > 0.38);
    for (let i = 0; i < 3; i++) {
      const a = -2.75 + i * 0.6 + rand() * 0.25;
      T.oval('#6f8a6c', Math.cos(a) * rx * 0.58, -ht / 2 - 4 + Math.sin(a) * ht * 0.34, rx * 0.3, Math.max(1.4, ht * 0.08));
    }
    T.oval('#859576', -rx * 0.3, -ht * 0.68 - 4, rx * 0.52, ht * 0.2);
    T.oval('#a5b08a', -rx * 0.38, -ht * 0.77 - 4, rx * 0.25, ht * 0.07);
    x += (rx * 1.45 + 2 + rand() * 7) * s;
  }
  // 낮은 산울타리와 연병장 턱
  for (let x = 0; x < w; x++) {
    const k = x / s, top = Math.round(yard - (7 + 1.4 * Math.sin(k / 5.3) + 0.9 * Math.sin(k / 2.1)) * s);
    fill('#4f6955', x, top, 1, yard - top);
    fill(Math.sin(k / 5.3) > 0.2 ? '#86986f' : '#6c8366', x, top, 1, u(1.6));
  }
  fill('#ded5b6', 0, yard - u(2), w, u(3));
  fill('#f5ecd0', 0, yard - u(2), w, 1);
  fill('#9d9172', 0, yard + u(1), w, u(1.5));

  // ── 확성기 기둥: 나팔 둘과 가장자리로 늘어진 전선 ──
  const P = brush(g, Math.round(w * 0.13), yard, s);
  for (let x = 0; x < P.X(0); x++) {
    const y = P.Y(-88) + Math.sin(Math.PI * x / P.X(0)) * 14 * s;
    fill('#5c6e69', x, y, 1, 1);
  }
  P.poly('#a5977d90', [[-3, 4], [3, 2], [50, 15], [46, 18]]);
  P.box('#b8b199', -6, 0, 12, 4); P.box('#dcd4b8', -6, 0, 12, 1); P.box('#8f876f', -6, 3, 12, 1);
  P.box('#56665e', -2, -104, 4, 105);
  P.box('#a5ad96', -2, -104, 1, 105);
  P.box('#3f4e48', 1, -104, 1, 105);
  P.box('#3f4e48', -3, -106, 6, 2);
  P.box('#4b5a54', -13, -95, 26, 3); P.box('#8a988a', -13, -95, 26, 1);
  for (const d of [-1, 1]) {
    P.poly('#63736e', [[d * 3, -100], [d * 9, -101], [d * 23, -109], [d * 23, -85], [d * 9, -93], [d * 3, -94]]);
    P.poly('#7d8c84', [[d * 3, -100], [d * 9, -101], [d * 23, -109], [d * 23, -105], [d * 9, -98], [d * 3, -98]]);
    P.poly('#4b5a56', [[d * 9, -94.5], [d * 23, -88], [d * 23, -85], [d * 9, -93]]);
    P.box('#b4b9a3', d > 0 ? 23 : -25, -110, 2, 26);
    P.box('#dcdfc8', d > 0 ? 23 : -25, -110, 1, 26);
    P.box('#3f4e48', d > 0 ? 2 : -5, -101, 3, 8);
  }
  P.box('#6d7c72', -5, -58, 10, 15); P.box('#9eab9a', -5, -58, 10, 1); P.box('#9eab9a', -5, -58, 1, 15); P.box('#46554e', 4, -57, 1, 14);
  P.box('#46554e', -1, -43, 1, 43);
  P.box('#3f4e48', -2, -52, 4, 1);

  // ── 게양대 ──
  const F = brush(g, Math.round(w * 0.84), yard, s);
  F.poly('#a5977d90', [[-2, 6], [4, 4], [62, 20], [58, 23]]);
  F.box('#a39b82', -11, 1, 23, 5); F.box('#c9c1a6', -11, 1, 23, 1);
  F.box('#bcb59c', -8, -4, 17, 5); F.box('#e2dabf', -8, -4, 17, 1); F.box('#8f876f', 6, -3, 3, 4);
  F.box('#9caa9d', -1, -128, 3, 125);
  F.box('#d7dfce', -1, -128, 1, 125);
  F.box('#6f7f75', 1, -128, 1, 125);
  F.box('#6f7f75', -2, -20, 5, 2);
  F.oval('#c9bd8c', 0.5, -131, 3.2, 3.2);
  F.oval('#f3ebc6', -0.3, -132, 1.6, 1.6);
  const wave = (x: number) => -124 + 2.6 * Math.sin(x / 6.5) * Math.min(1, x / 12) + x * 0.07;
  const drop = (x: number) => 21 - x * 0.05;
  F.ridge('#738e85', 2, 46, wave, (x) => wave(x) + drop(x));
  for (let x = 2; x < 46; x += 1) {
    const slope = Math.cos(x / 6.5);
    if (slope < -0.35) F.ridge('#5d7870', x, x + 1, wave, (q) => wave(q) + drop(q));
    else if (slope > 0.55) F.ridge('#89a297', x, x + 1, wave, (q) => wave(q) + drop(q));
  }
  F.ridge('#b7c1a8', 2, 46, wave, (x) => wave(x) + 1.4);
  F.ridge('#4f6a63', 2, 46, (x) => wave(x) + drop(x) - 1.4, (x) => wave(x) + drop(x));
  F.ridge('#c9d0b6', 2, 46, (x) => wave(x) + drop(x) * 0.42, (x) => wave(x) + drop(x) * 0.58);
  F.box('#e8ebd6', 0, -125, 2, 2); F.box('#e8ebd6', 0, -105, 2, 2);

  // ── 구령대: 돌 기단 위의 나무 마루, 가운데 계단 ──
  const half = Math.min(104, W * 0.2);
  const R = brush(g, cx, stage, s);
  R.poly('#a5977d', [[-half - 8, 26], [half + 6, 24], [half + 48, 42], [-half + 8, 46]]);
  R.poly('#93866c', [[-half - 4, 26], [half + 6, 24], [half + 22, 31], [-half - 2, 32]]);
  // 뒤 난간 (가운데는 비워 둔다)
  for (const d of [-1, 1]) {
    const x0 = d > 0 ? 46 : -(half - 12), x1 = d > 0 ? half - 12 : -46;
    R.box('#455953', x0, -27, x1 - x0, 2); R.box('#8fa093', x0, -27, x1 - x0, 1);
    R.box('#52665e', x0, -20, x1 - x0, 1);
    for (let x = x0; x <= x1 - 2 + 0.5; x += (x1 - x0 - 2) / Math.max(1, Math.round((x1 - x0) / 15))) { R.box('#455953', x, -27, 2, 15); R.box('#7d9085', x, -27, 1, 14); }
  }
  // 마루: 널 이음이 뒤로 모인다
  R.poly('#75857a', [[-half + 9, -13], [half - 9, -13], [half + 3, 0], [-half - 3, 0]]);
  R.poly('#84948a', [[-half + 3, -6], [half - 3, -6], [half + 3, 0], [-half - 3, 0]]);
  for (let x = -half + 6; x < half; x += 13) R.seg('#5f7067', x * (half - 9) / (half + 3), -13, x, 0, 1);
  R.box('#566860', -half + 9, -13, half * 2 - 18, 1);
  // 지휘관 자리의 깔개
  R.poly('#a3ae95', [[-24, -10], [24, -10], [29, -3], [-29, -3]]);
  R.poly('#4f665e', [[-22, -9], [22, -9], [26, -4], [-26, -4]]);
  R.box('#3f524c', -27, -3, 56, 1);
  // 기단 앞면: 돌 쌓기
  R.box('#54635c', -half - 3, 0, half * 2 + 6, 26);
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 7;
    R.box('#445049', -half - 3, y + 6, half * 2 + 6, 1);
    R.box('#62726a', -half - 3, y, half * 2 + 6, 1);
    for (let x = -half - 3 + (row % 2 ? 9 : 19); x < half + 2; x += 20) { R.box('#445049', x, y, 1, 6); R.box('#687870', x + 1, y + 1, 1, 5); }
    for (let i = 0; i < half / 7; i++) R.box(i % 2 ? '#4b5952' : '#5f6f66', -half + rand() * half * 2, y + 1 + rand() * 4, 2 + rand() * 3, 1);
  }
  for (const d of [-1, 1]) { // 모서리 기둥돌
    const x = d > 0 ? half - 6 : -half - 3;
    R.box('#62726a', x, 3, 9, 20); R.box('#7c8b80', x, 3, 1, 20); R.box('#445049', x + 8, 3, 1, 20);
  }
  // 앞면의 별 표지
  for (const d of [-1, 1]) {
    const ex = d * (half + 46) / 2;
    if (half < 84) break;
    R.oval('#46544d', ex, 13.5, 9, 9);
    R.oval('#5d6d64', ex, 13.5, 7.6, 7.6);
    R.poly('#c9bb86', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.6 : 6.4; return [ex + Math.cos(a) * r, 13.8 + Math.sin(a) * r] as Point; }));
  }
  // 갓돌
  R.box('#bac1aa', -half - 5, -1, half * 2 + 10, 4);
  R.box('#e2e5cc', -half - 5, -1, half * 2 + 10, 1);
  R.box('#8e9783', -half - 5, 2, half * 2 + 10, 1);
  R.box('#3c4943', -half - 3, 3, half * 2 + 6, 2);
  R.box('#465049', -half - 5, 23, half * 2 + 10, 4);
  R.box('#75837a', -half - 5, 23, half * 2 + 10, 1);
  // 계단 네 단: 디딤판은 밝고 챌판은 어둡다
  for (let i = 0; i < 4; i++) {
    const y = -1 + i * 8.5, half2 = 28 + i * 4;
    R.box('#2f3a35', -half2 - 3, y, half2 * 2 + 6, 9);
    R.box('#6f786b', -half2, y + 3, half2 * 2, 6);
    R.box('#59635a', -half2, y + 3, half2 * 2, 1);
    R.box('#c5c8ae', -half2 - 1, y, half2 * 2 + 2, 3);
    R.box('#e6e8d0', -half2 - 1, y, half2 * 2 + 2, 1);
    R.box('#8a9280', half2 - 5, y + 3, 5, 6);
  }
  R.box('#93866c', -44, 33, 92, 2);
  // 마이크: 삼발이 · 꺾인 붐대 · 마루를 타고 내려가는 선
  const mx = -half + 24;
  R.seg('#2f3f40', mx, -7, mx - 6, -4, 1); R.seg('#2f3f40', mx, -7, mx + 6, -4, 1); R.seg('#2f3f40', mx, -7, mx, -3, 1);
  R.box('#394d4e', mx - 1, -40, 2, 34); R.box('#7d908c', mx - 1, -40, 1, 34);
  R.box('#2f3f40', mx - 2, -24, 4, 2);
  R.seg('#526261', mx, -40, mx + 13, -47, 1.4);
  R.box('#263435', mx + 12, -51, 7, 5); R.box('#8a9a94', mx + 12, -51, 7, 1); R.box('#5d6e6b', mx + 17, -50, 2, 3);
  for (let i = 0; i < 26; i++) R.box('#2f3f40', mx + 2 + i, -3 - 2.2 * Math.sin(i / 26 * Math.PI) - i * 0.02, 1, 1);

  // ── 낮별이 내려앉은 자리: 마루에 고인 빛과 내려오며 흘린 빛가루 ──
  g.save();
  g.translate(cx, R.Y(-6)); g.scale(1, 0.3);
  const spill = g.createRadialGradient(0, 0, 0, 0, 0, 58 * s);
  spill.addColorStop(0, '#fff1bc90'); spill.addColorStop(1, '#fff1bc00');
  g.fillStyle = spill; g.fillRect(-58 * s, -58 * s, 116 * s, 116 * s);
  g.restore();
  const star = brush(g, cx, Math.round(h * 0.49), s);
  star.glow('#fff1bc8c', 0, 0, 54);
  for (let i = 0; i < 16; i++) {
    const x = cx + (rand() - 0.5) * 46 * s, y = h * 0.47 - i * 7.4 * s - rand() * 4 * s, c = '#fff4cf' + (i < 9 ? '' : ['d0', 'b0', '90', '70', '60', '50', '40'][i - 9]);
    const r = i % 4 === 0 ? u(2) : i % 3 === 0 ? 1 : 0;
    if (r) { fill(c, x - r, y, r * 2 + 1, 1); fill(c, x, y - r, 1, r * 2 + 1); fill('#fffdf0', x, y, 1, 1); }
    else fill(c, x, y, u(1.4), u(1.4));
  }

  vignette(g, w, h, '#1a2a30', 0.24);
}
