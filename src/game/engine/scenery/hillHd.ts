import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 꼭짓점이 다섯인 별 (반지름 r의 꼭짓점, 안쪽 오목점은 r × k) */
function starPoints(r: number, k = 0.44): Point[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * k : r;
    return [Math.cos(a) * rr, Math.sin(a) * rr] as Point;
  });
}

/** 다각형 안에만 그린다: 줄마다 픽셀에 맞춘 사각형으로 오려서 가장자리가 번지지 않는다 */
function clipPoly(g: Ink, pts: Point[], draw: () => void) {
  const y0 = Math.round(Math.min(...pts.map((q) => q[1]))), y1 = Math.round(Math.max(...pts.map((q) => q[1])));
  g.save();
  g.beginPath();
  for (let y = y0; y < y1; y++) {
    const yc = y + 0.5, xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
      if (b > a) g.rect(a, y, b - a, 1);
    }
  }
  g.clip();
  draw();
  g.restore();
}

/**
 * 언덕 위에 떠 있는 별 모양 창문 (P-01 · P-21의 그 창문): 나무 틀 너머로 입대 전날 밤 내 방의 불빛 · 커튼 · 책상 스탠드가 보인다.
 * 설계 좌표에서 별의 반지름은 50칸.
 */
function homeWindow(g: Ink, x: number, y: number, scale: number) {
  const S = brush(g, x, y, scale);
  const R = 50;
  S.glow('#ffd59b50', 0, 0, 118);
  S.glow('#ffe6b848', 0, 0, 70);
  // 나무 틀: 위를 보는 면은 밝고 아래를 보는 면은 어둡다
  S.poly('#342b49', starPoints(R + 6));
  const outer = starPoints(R + 3), inner = starPoints(R - 1.5);
  S.poly('#b58775', outer);
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10, dx = outer[j][0] - outer[i][0], dy = outer[j][1] - outer[i][1];
    const up = dx / Math.hypot(dx, dy); // 바깥을 향한 면이 위를 보는 정도 (-1 ~ 1)
    S.poly(up > 0.25 ? '#dfb193' : up < -0.25 ? '#8f6660' : '#b58775', [outer[i], outer[j], inner[j], inner[i]]);
  }
  S.poly('#5e424f', inner);
  // 창 너머 내 방: 틀 안쪽으로만 보이게 오려 낸다
  clipPoly(g, starPoints(R - 3.5).map(([px, py]) => [x + px * scale, y + py * scale] as Point), () => {
    S.fade(['#ffe9b6', '#ffd291', '#f4bb80'], -R, -R, R * 2, R + 12);
    S.box('#ffefc4', -12, -R, 16, R + 12);
    S.glow('#fff6d690', 9, -2, 30);
    // 양쪽으로 묶어 둔 커튼
    S.poly('#b96e64', [[-R, -R], [-7, -R], [-10, -24], [-15, -8], [-11, 6], [-9, 30], [-R, 30]]);
    S.poly('#cd8874', [[R, -R], [7, -R], [10, -24], [16, -8], [13, 6], [11, 30], [R, 30]]);
    for (const side of [-1, 1]) {
      for (const k of [17, 24, 32, 41]) S.seg(side < 0 ? '#9c5754' : '#ad6a60', side * k, -R, side * (k + 2), 12, 1.5);
      S.seg(side < 0 ? '#d79582' : '#e6a98f', side * 11, -22, side * 16, -8, 1.5);
      S.box('#f6dba6', side < 0 ? -R : 15, -9, R - 15, 3);
    }
    // 책상과 스탠드, 쌓아 둔 책
    S.box('#a56c5f', -R, 12, R * 2, R);
    S.box('#d39a7c', -R, 12, R * 2, 2);
    S.box('#87564f', -R, 24, R * 2, R);
    for (const dx of [-27, 7]) { // 서랍
      S.box('#744845', dx, 28, 20, 10);
      S.box('#a06c5e', dx, 28, 20, 1);
      S.box('#e0b48a', dx + 8, 32, 4, 1.5);
    }
    S.box('#9a6a58', 9, -2, 2, 12);
    S.box('#7f5548', 5, 10, 10, 2);
    S.poly('#e89d62', [[5, -13], [15, -13], [19, -3], [1, -3]]);
    S.poly('#f6bd80', [[5, -13], [9, -13], [6, -3], [1, -3]]);
    S.box('#fff6d2', 1, -4, 18, 2);
    S.box('#8a5a55', -9, 8, 11, 4); S.box('#7c6a8a', -8, 5, 9, 3); S.box('#c98f76', -9, 2, 10, 3);
    // 창살
    S.box('#805754', -2, -R, 4, R * 2);
    S.box('#b17b64', -2, -R, 1, R * 2);
    S.box('#805754', -R, -18, R * 2, 3);
    S.box('#b17b64', -R, -18, R * 2, 1);
  });
  // 별 끝에 맺힌 빛
  S.box('#ffe4b0', -1, -R - 12, 2, 12);
  S.box('#ffe4b0', -6, -R - 5, 12, 2);
  S.box('#fffbe6', -1, -R - 5, 2, 2);
}

/**
 * 꿈 · 별의 언덕 (고해상도): 해 질 녘 하늘 아래 두 언덕 사이로 오솔길이 내려오고, 하늘에는 별 모양 창문이 떠 있다.
 * 능선 · 오솔길 · 창문의 자리(화면 비율)는 예전 그림과 같다: 빛(지라치)은 화면의 42% · 38% 자리에 따로 얹힌다.
 * day가 지날수록 창문이 작아지고 낮아진다 (집이 멀어진다).
 */
export function dreamHillHd(g: Ink, w: number, h: number, day: number) {
  const rand = seeded(4997);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const horizon = Math.round(h * 0.53);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const P = brush(g, 0, 0, 1); // 캔버스 픽셀 그대로 긋는 붓

  // ── 하늘 ──
  const skyFill = g.createLinearGradient(0, 0, 0, horizon);
  ['#101631', '#252850', '#555080', '#a480a2', '#efb697'].forEach((c, i, a) => skyFill.addColorStop(i / (a.length - 1), c));
  g.fillStyle = skyFill;
  g.fillRect(0, 0, w, h);
  // 은하수: 왼쪽 아래에서 오른쪽 위로 흐르는 옅은 띠
  for (let i = 0; i < w * 8; i++) {
    const x = rand() * w;
    const y = horizon * (0.85 - x / w * 0.9) + (rand() + rand() + rand() - 1.5) * 52 * s + Math.sin(x / (54 * s)) * 10 * s;
    const span = 1 + rand() * 4;
    if (y < 0 || y > horizon * 0.82) continue;
    fill(['#a19aca1c', '#b3a2d620', '#8ebdce18', '#ffffff12'][i % 4], x, y, span, 1);
  }
  // 별
  for (let i = 0; i < w * 1.5; i++) {
    const x = rand() * w, depth = rand() ** 1.3, y = depth * horizon * 0.95;
    const c = ['#f1dac9', '#a7b7ce', '#9fa1bc', '#8884a9', '#ffffff'][Math.floor(rand() * 5)];
    if (i % 37 === 0 && depth < 0.75) {
      const r = u(2);
      fill('#b7cad7', x - r, y, r * 2 + 1, 1); fill('#b7cad7', x, y - r, 1, r * 2 + 1); fill('#fff2d4', x, y, 1, 1);
    } else if (i % 8 === 0 && depth < 0.55) fill(c, x, y, 2, 2);
    else fill(depth > 0.72 ? c + '90' : c, x, y, 1, 1);
  }
  // 해가 넘어간 자리의 잔광
  {
    const r = Math.max(w * 0.5, 260 * s);
    g.save(); g.translate(0, horizon + 20 * s); g.scale(1, 0.26);
    const sun = g.createRadialGradient(w * 0.56, 0, 0, w * 0.56, 0, r);
    sun.addColorStop(0, '#ffe2b470'); sun.addColorStop(1, '#ffe2b400');
    g.fillStyle = sun; g.fillRect(w * 0.56 - r, -r, r * 2, r * 2);
    g.restore();
  }
  // 구름: 낮게 깔린 띠, 아래쪽이 노을빛
  for (let i = 0; i < 22; i++) {
    const x = rand() * w, y = horizon * (0.42 + rand() * 0.54), span = (20 + rand() * 84) * s;
    for (let j = 0; j < 24; j++) {
      const t = rand();
      fill(j % 5 ? '#51496b50' : '#f6c5ab60', x + t * span, y - Math.sin(t * Math.PI) * 7 * s + rand() * 8 * s, (6 + rand() * 28) * s, 1);
    }
  }

  // ── 산: 멀수록 옅다 ──
  const range = (base: number, height: number, color: string, phase: number, lit?: string) => {
    const tops: number[] = [];
    g.fillStyle = color;
    for (let x = 0; x < w; x++) {
      const k = x / s;
      const y = Math.round(base + (Math.sin(k / 78 + phase) + 0.54 * Math.sin(k / 38 - phase) + 0.19 * Math.sin(k / 12 + phase) + 0.06 * Math.sin(k / 4.1)) * height);
      g.fillRect(x, y, 1, h - y);
      tops.push(y);
    }
    if (lit) { g.fillStyle = lit; tops.forEach((y, x) => g.fillRect(x, y, 1, 1)); }
  };
  range(horizon + 6 * s, 14 * s, '#726886', 1, '#9a849a');
  range(horizon + 24 * s, 12 * s, '#575b80', 2, '#676a8e');
  range(horizon + 44 * s, 14 * s, '#414968', 5);
  // 산자락의 안개
  const mist = g.createLinearGradient(0, horizon + 20 * s, 0, horizon + 66 * s);
  mist.addColorStop(0, '#b18aa600'); mist.addColorStop(1, '#b18aa630');
  g.fillStyle = mist; g.fillRect(0, horizon + 20 * s, w, 46 * s);
  // 소나무 숲: 뒷줄은 옅게, 앞줄은 짙게
  const pine = (c: string, x: number, base: number, tall: number) => {
    const tier = Math.max(3, Math.round(tall / 4));
    g.fillStyle = c;
    for (let j = 0; j < tall; j++) {
      const half = Math.round((0.3 + 0.7 * ((j % tier) / tier)) * j * 0.3);
      g.fillRect(Math.round(x - half), Math.round(base - tall + j), half * 2 + 1, 1);
    }
  };
  for (let x = -u(2); x < w; x += u(5)) pine('#465070', x, horizon + 62 * s + 8 * s * Math.sin(x / (70 * s) + 1), (12 + rand() * 12) * s);
  for (let x = -u(4); x < w; x += u(4)) pine('#38435f', x, horizon + 70 * s + 10 * s * Math.sin(x / (76 * s)), (14 + rand() * 18) * s);
  // 세로 화면에선 두 언덕 사이 골짜기가 깊다: 숲이 골짜기 바닥까지 내려온다
  const valley = h * 0.675 + u(4);
  for (let y = horizon + 70 * s + u(10), row = 0; y < valley; y += u(10), row++) {
    for (let x = -u(4); x < w; x += u(4)) pine(row % 2 ? '#313c55' : '#36425c', x, y + u(6) + 4 * s * Math.sin(x / (40 * s) + y), (16 + rand() * 16) * s);
    fill('#8a789a1c', 0, y + u(2), w, u(5)); // 나무 줄 사이에 낀 옅은 안개
  }

  // ── 언덕 ──
  const ground = (x: number) => h * 0.60 + Math.sin(x / w * 6.2 - 1.8) * h * 0.075;
  {
    // 풀밭 위 세 겹의 띠와 능선의 빛: 색마다 한 번에 칠한다
    const cols: number[][] = [];
    for (let x = 0; x < w; x++) {
      const y = Math.round(ground(x));
      cols.push([y, y + u(5) + Math.round(rand() * 2 * s), y + 16 * s + 6 * s * Math.sin(x / (30 * s)) + rand() * 3 * s, y - Math.round(rand() * 2 * s), y - Math.round(rand() * 2 * s)]);
    }
    const layer = (c: string, i: number, tall: (y: number) => number) => {
      g.fillStyle = c;
      cols.forEach((ys, x) => g.fillRect(x, Math.round(ys[i]), 1, tall(Math.round(ys[i]))));
    };
    layer('#5b677a', 0, (y) => h - y);
    layer('#45546a', 1, () => h);
    layer('#2e4358', 2, () => h);
    layer('#817680', 3, () => u(2));
    layer('#a8929c', 4, () => 1);
  }
  const dusk = g.createLinearGradient(0, h * 0.66, 0, h);
  dusk.addColorStop(0, '#14203400'); dusk.addColorStop(1, '#14203470');
  g.fillStyle = dusk; g.fillRect(0, h * 0.66, w, h * 0.34);

  // 오솔길: 고갯마루에서 하늘빛을 받고, 굽이치며 가까워질수록 넓어진다
  const trail = (v: number) => w * (0.67 - 0.24 * v + 0.075 * Math.sin(v * 6));
  const start = Math.floor(ground(w * 0.67));
  const breadth = (v: number) => 2 * s + v * v * w * 0.12;
  for (let y = start; y < h; y++) {
    const t = (y - start) / (h - start), half = breadth(t), cx = trail(t);
    fill(t < 0.05 ? '#a08a9a' : t < 0.14 ? '#7d7386' : '#6f6979', cx - half, y, half * 2, 1);
    fill('#57566b', cx + half * 0.72, y, half * 0.28 + 1, 1);
    fill('#988393', cx - half, y, 1 + half * 0.1 + rand() * half * 0.1, 1);
  }
  for (let i = 0; i < (h - start) * 5; i++) {
    const t = rand() ** 0.6, y = start + t * (h - start), half = breadth(t);
    const x = trail(t) + (rand() * 2 - 1) * half * 0.86;
    if (i % 4 === 0) { // 자갈
      const r = Math.max(1, Math.round(t * 3 * s));
      fill('#a595a2', x, y, r + 1, r); fill('#4c4b60', x, y + r, r + 1, 1);
    } else fill(i % 2 ? '#8a7b8c60' : '#55546970', x, y, Math.min(half, (3 + rand() * 22) * s * (0.3 + t)), 1);
  }
  // 발길에 팬 두 줄
  for (const side of [-0.34, 0.3]) {
    for (let y = start + u(10); y < h; y++) {
      const t = (y - start) / (h - start);
      if (Math.sin(t * 60 + side * 9) > 0.55) continue;
      fill('#5d5a6e80', trail(t) + side * breadth(t), y, Math.max(1, breadth(t) * 0.07), 1);
    }
  }
  // 창문 불빛이 언덕에 내려앉는다
  {
    const far0 = Math.min(1, Math.max(0, (day - 1) / 11));
    const lx = w * 0.75, ly = ground(lx) + 30 * s, r = (190 - far0 * 70) * s;
    g.save(); g.translate(0, ly); g.scale(1, 0.34);
    const warm = g.createRadialGradient(lx, 0, 0, lx, 0, r);
    warm.addColorStop(0, far0 > 0.5 ? '#ffd59b1c' : '#ffd59b2c'); warm.addColorStop(1, '#ffd59b00');
    g.fillStyle = warm; g.fillRect(lx - r, -r, r * 2, r * 2);
    g.restore();
  }

  // ── 풀과 들꽃: 멀리서부터 차례로 심는다. 풀은 한 뿌리에서 서너 잎이 부채꼴로 벌어지고, 바람에 조금 오른쪽으로 눕는다 ──
  const grasses = ['#657981', '#526b75', '#344855', '#81908a', '#29394f'];
  const petals = ['#e7b0a8', '#c59cc8', '#e6c894', '#93baca'];
  const tufts: { x: number; y: number; depth: number; i: number; lean: number; petal: string }[] = [];
  /** 풀잎 하나: 뿌리에서 넓고 끝으로 가늘어지며, 끝으로 갈수록 바람 쪽으로 휜다 */
  const blade = (c: string, x: number, y: number, l: number, lean: number, wid: number) => {
    const n = Math.max(1, Math.round(l)), y0 = Math.round(y);
    g.fillStyle = c;
    let rx = 0, rw = 0, from = 0; // 같은 자리 · 같은 굵기로 이어지는 줄은 한 번에 칠한다
    for (let r = 0; r <= n; r++) {
      const t = r / n, bw = Math.max(1, Math.round(wid * (1 - t))), bx = Math.round(x + lean * l * t * t - bw / 2);
      if (r === n || r === 0 || bx !== rx || bw !== rw) {
        if (r > 0) g.fillRect(rx, y0 - r + 1, rw, r - from);
        rx = bx; rw = bw; from = r;
      }
    }
  };
  for (let i = 0; i < w * 4.2; i++) {
    const x = rand() * w, depth = rand() ** 1.35, y = ground(x) + depth * h * 0.5;
    const lean = 0.1 + rand() * 0.3, petal = petals[Math.floor(rand() * petals.length)];
    const v = (y - start) / (h - start);
    if (v >= 0 && Math.abs(x - trail(v)) < breadth(v) * 0.94 + 1) continue;
    tufts.push({ x, y, depth, i, lean, petal });
  }
  tufts.sort((a, b) => a.y - b.y);
  for (const { x, y, depth, i, lean, petal } of tufts) {
    const len = (2 + depth * 13) * s, thick = depth > 0.62 ? 2 : 1;
    const c = depth < 0.08 ? (i % 2 ? '#81908a' : '#8c8a94') : grasses[i % grasses.length];
    const n = depth < 0.12 ? 1 : depth < 0.35 ? 2 : 3;
    for (let j = 0; j < n; j++) {
      const spread = lean + (j - (n - 1) / 2) * 0.5, l = len * (0.7 + ((i * 7 + j * 3) % 4) * 0.12);
      blade(j === n - 1 ? c : grasses[(i + j * 2) % grasses.length], x + (j - 1) * thick, y, l, spread, thick + depth * 1.5 * s);
    }
    if (thick === 2) blade('#8fa39a', x + lean * len * 0.2, y - len * 0.25, len * 0.6, lean + 0.2, 1);
    if (i % 6) continue;
    const fx = Math.round(x + len * lean), fy = Math.round(y - len);
    if (depth < 0.3) fill(petal, fx - 1, fy, 2, 2);
    else if (depth < 0.62) { fill(petal, fx - 1, fy - 2, 2, 5); fill(petal, fx - 2, fy - 1, 5, 2); fill('#fbe9c2', fx - 1, fy - 1, 2, 2); }
    else {
      const r = u(2.4);
      fill('#00000030', fx - r, fy + r + 1, r * 2 + 2, 1);
      fill(petal, fx - r - 1, fy - 1, r * 2 + 3, 3); fill(petal, fx - 1, fy - r - 1, 3, r * 2 + 3);
      fill(petal, fx - r, fy - r, r * 2 + 1, r * 2 + 1);
      fill('#fff0cf', fx - r, fy - r, r, 1);
      fill('#f6dc9a', fx - 1, fy - 1, 3, 3); fill('#c9955f', fx, fy + 1, 2, 1);
    }
  }
  // 길섶에 키 큰 초롱꽃: 화면 양쪽 가장자리에서 길 쪽으로 기운다
  const bells: { x: number; y: number; stem: number; side: number }[] = [];
  for (let i = 0; i < 38; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side > 0 ? w * rand() * 0.19 : w * (1 - rand() * 0.17);
    bells.push({ x, y: ground(x) + 14 * s + rand() * h * 0.26, stem: 14 + rand() * 28, side });
  }
  bells.sort((a, b) => a.y - b.y);
  for (const [n, { x, y, stem, side }] of bells.entries()) {
    // 가까울수록 크다. 줄기는 길 쪽으로 휘어 끝이 숙고, 종 모양 꽃이 줄기 바깥으로 매달린다
    const near = Math.min(1, (y - ground(x)) / (h * 0.3)), B = brush(g, Math.round(x), Math.round(y), s * (0.6 + 0.55 * near));
    const at = (t: number): Point => [side * 13 * t * t, -stem * t + 7 * t ** 3];
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = at(i / 6), [bx, by] = at((i + 1) / 6);
      B.seg('#3a5058', ax, ay, bx, by, 2);
      B.seg('#5f7a7c', ax + side * 0.5, ay, bx + side * 0.5, by, 1);
    }
    B.poly('#5a767a', [[0, -2], [-side * 9, -10], [-side * 2, -6]]);
    B.poly('#78928b', [[side * 1, -5], [side * 11, -14], [side * 4, -5]]);
    B.seg('#93aba0', side * 2, -5, side * 10, -13, 1);
    const count = 3 + (n % 3);
    for (let j = 0; j < count; j++) {
      const tt = 1 - j * 0.17, [px, py] = at(tt), out = j % 2 ? -1 : 1;
      const r = 1 - j * 0.12, fx = px + side * out * 3.5, fy = py + 2.5;
      B.seg('#5f7a7c', px, py, fx, fy - 1, 1);
      if (j === 0) { // 맨 끝은 아직 덜 핀 봉오리
        B.oval('#7d7698', fx, fy + 2, 2, 3);
        B.oval('#a69cc0', fx - 0.6, fy + 1.4, 1, 1.6);
        continue;
      }
      B.poly('#8a83a8', [[fx - 2.4 * r, fy], [fx + 2.4 * r, fy], [fx + 3.2 * r, fy + 3.6 * r], [fx + 4.6 * r, fy + 6.4 * r], [fx - 4.6 * r, fy + 6.4 * r], [fx - 3.2 * r, fy + 3.6 * r]]);
      B.poly('#b2a3c8', [[fx - 2.4 * r, fy], [fx, fy], [fx - 0.6 * r, fy + 6.4 * r], [fx - 4.6 * r, fy + 6.4 * r], [fx - 3.2 * r, fy + 3.6 * r]]);
      B.box('#5f587e', fx - 4 * r, fy + 5.6 * r, 8 * r, 1.2);
      B.box('#d5b7cd', fx - 4.6 * r, fy + 6.2 * r, 9.2 * r, 1.2);
      B.box('#f1dfc4', fx - 0.5, fy + 7 * r, 1.2, 1.4);
    }
  }
  // 풀밭 위를 떠도는 빛 알갱이
  for (let i = 0; i < 16; i++) {
    const x = rand() * w, y = ground(x) + (0.04 + rand() * 0.3) * h;
    P.glow('#ffe9b038', Math.round(x), Math.round(y), (6 + rand() * 6) * s);
    fill('#fff3cf', x, y, u(1.4), u(1.4));
  }

  // ── 그 창문 ──
  const far = Math.min(1, (day - 1) / 11);
  homeWindow(g, Math.round(w * 0.75), Math.round(h * (0.28 + far * 0.075)), s * (1 - far * 0.46));

  vignette(g, w, h, '#0a0c20', 0.42);
}
