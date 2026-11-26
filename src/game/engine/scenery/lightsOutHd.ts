import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 배치 (설계 좌표, 세로 480칸 기준): 예전 그림(lightsOut.ts)의 layout을 그대로 두 배 칸으로 옮긴 것.
 * 예전 그림의 폭(ow칸)을 먼저 구해 화면 비율마다 같은 자리에 같은 크기로 놓이게 한다.
 */
function layout(w: number, h: number) {
  const ow = Math.min(720, Math.max(210, 240 * w / Math.max(1, h)));
  const s = w / ow / 2; // 설계 1칸 = 캔버스 s픽셀
  const W = w / s, H = h / s, tall = h > w;
  const p = Math.max(116, Math.min(208, W * (tall ? 0.5 : 0.27))); // 침상 크기의 기준
  const depth = p * 0.7; // 매트리스 깊이 (벽 쪽 모서리 → 앞 모서리)
  const y1 = H * (tall ? 0.58 : 0.68), y0 = y1 - depth;
  const k = 0.3, sk = depth * k; // 내려다보는 각도: 앞 모서리가 왼쪽으로 비껴 보인다
  const hx = Math.max(20, W * 0.08) + sk; // 머리맡 (벽 쪽 모서리)
  const a = p * 0.24, b = depth * 0.4; // 베개의 반폭(침상 길이 방향) · 반깊이(침상 폭 방향)
  const cx = hx + 10 + a, cy = (y0 + y1) / 2 - 2; // 베개 한가운데
  /** 침상 바닥면 위의 점: 베개 한가운데 줄보다 앞으로 올수록 왼쪽으로 비낀다 */
  const S = (x: number, y: number): Point => [x - (y - cy) * k, y];
  return { s, W, H, tall, p, depth, y0, y1, k, sk, hx, a, b, cx, cy, S };
}

/** 베개 앞자락 밑, 별 조각이 빛나는 자리 (캔버스 픽셀 좌표) */
export function lightsOutGlintHd(w: number, h: number): Point {
  const { s, a, b, cx, cy, S } = layout(w, h);
  const [x, y] = S(cx + a * 0.3, cy + b + 2);
  return [Math.round(x * s), Math.round(y * s)];
}

/** 둥근 네모 (|u|^n + |v|^n = 1)의 윤곽: n이 클수록 네모에 가깝다 */
function squircle(n: number, steps = 64): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2, c = Math.cos(t), d = Math.sin(t);
    return [Math.sign(c) * Math.abs(c) ** (2 / n), Math.sign(d) * Math.abs(d) ** (2 / n)] as Point;
  });
}

/**
 * 1일차 소등 직후, 생활관의 내 침상 (고해상도): 철제 머리맡 · 베개 · 홑이불을 접어 내린 모포 · 창으로 드는 달빛.
 * 빛은 오른쪽 위 창의 달빛 하나다. 베개 밑 별 조각의 반짝임은 꿈 화면이 따로 그린다 → lightsOutGlintHd
 */
export function lightsOutHd(g: Ink, w: number, h: number) {
  const rand = seeded(1112);
  const { s, W, H, tall, p, depth, y0, y1, k, sk, hx, a, b, cx, cy, S } = layout(w, h);
  const B = brush(g, 0, 0, s);
  const t = Math.max(8, p * 0.09); // 매트리스 두께
  const yf = y1 + t + p * 0.3; // 침상 다리가 닿는 바닥
  const nearL = hx - sk;
  /** 침상 윗면의 점: 벽 쪽 모서리(y0)에서 잰 x가 앞으로 올수록 왼쪽으로 비낀다 */
  const T = (x: number, y: number): Point => [x - (y - y0) * k, y];
  const onBed = (c: string, pts: Point[]) => B.poly(c, pts.map(([x, y]) => T(x, y)));
  const ceil = tall ? H * 0.07 : 0;

  // ── 벽: 세로 판벽 이음매 ──
  const paint = g.createLinearGradient(0, 0, 0, h);
  paint.addColorStop(0, '#0a0f1d'); paint.addColorStop(0.5, '#111829'); paint.addColorStop(1, '#182036');
  g.fillStyle = paint; g.fillRect(0, 0, w, h);
  for (let x = 9; x < W; x += 18) {
    g.fillStyle = '#8d9ab80c'; g.fillRect(B.X(x), B.Y(ceil), 1, B.Y(y0) - B.Y(ceil));
    g.fillStyle = '#02040a40'; g.fillRect(B.X(x) + 1, B.Y(ceil), 1, B.Y(y0) - B.Y(ceil));
  }
  for (let i = 0; i < W * 0.6; i++) B.box(i % 2 ? '#8d9ab80a' : '#02040a20', rand() * W, ceil + rand() * (y0 - ceil), 1, 4 + rand() * 14);

  // 창의 자리 (벽에 번지는 달빛을 먼저 깐다)
  const ww = Math.min(W * 0.36, 220), wx = W - ww - Math.max(16, W * 0.08);
  const sill = y0 - 32, wh = Math.min(ww * 0.62, sill - H * 0.06), wy = sill - wh;
  B.glow('#7d93c822', wx + ww * 0.55, wy + wh * 0.5, ww * 1.1);

  // 휴대폰 세로 화면: 천장과 꺼진 형광등
  if (tall) {
    B.box('#0b0f1a', 0, 0, W, ceil);
    B.box('#262f44', 0, ceil, W, 1.5);
    B.box('#05080f50', 0, ceil + 1.5, W, 4);
    B.box('#161c2a', W * 0.25, ceil - 4, W * 0.5, 4);
    B.box('#1f2738', W * 0.25, ceil, W * 0.5, 9);
    B.box('#3e475c', W * 0.27, ceil + 4, W * 0.46, 2);
    B.box('#2b3346', W * 0.27, ceil + 6, W * 0.46, 1);
  }

  // ── 창: 산등성이 너머 초승달, 한쪽으로 걷어 둔 커튼 ──
  const N = brush(g, B.X(wx), B.Y(wy), s);
  N.box('#060912', -7, -7, ww + 14, wh + 14);
  N.box('#1c2336', -5, -5, ww + 10, wh + 10);
  N.box('#323c56', -5, -5, ww + 10, 1);
  N.clip(0, 0, ww, wh, () => {
    N.fade(['#0b1330', '#151f48', '#28305c', '#3e3f6c'], 0, 0, ww, wh);
    for (let i = 0; i < ww * 0.8; i++) {
      const x = rand() * ww, y = rand() ** 1.3 * wh * 0.74;
      g.fillStyle = i % 6 ? (i % 2 ? '#8d9cc0' : '#6f7ca6') : '#e3e8f4';
      if (i % 37 === 0) { g.fillRect(N.X(x) - 1, N.Y(y), 3, 1); g.fillRect(N.X(x), N.Y(y) - 1, 1, 3); }
      else g.fillRect(N.X(x), N.Y(y), 1, 1);
    }
    for (let i = 0; i < 12; i++) N.box(i % 3 ? '#4a4f8040' : '#8a86b030', rand() * ww - 10, wh * (0.42 + rand() * 0.24), 12 + rand() * 40, 1);
    // 초승달
    const mx = ww * 0.72, my = wh * 0.3;
    N.glow('#dfe6ff34', mx, my, 34);
    N.oval('#f1ecd2', mx, my, 9, 9, (dx, dy) => (dx - 0.52) ** 2 + (dy + 0.3) ** 2 > 0.62);
    N.oval('#c9c6b4', mx, my, 9, 9, (dx, dy) => (dx - 0.52) ** 2 + (dy + 0.3) ** 2 > 0.62 && dx + dy > 0.35);
    // 먼 능선 · 가까운 능선과 숲, 산 중턱 초소의 불빛
    N.ridge('#252c4f', 0, ww, (x) => wh * 0.7 + Math.sin(x / 30 + 1) * 4 + Math.sin(x / 11) * 1.5, () => wh);
    N.ridge('#3a3f66', 0, ww, (x) => wh * 0.7 + Math.sin(x / 30 + 1) * 4 + Math.sin(x / 11) * 1.5, (x) => wh * 0.7 + Math.sin(x / 30 + 1) * 4 + Math.sin(x / 11) * 1.5 + 1);
    const near = (x: number) => wh * 0.8 + Math.sin((x + wx) / 26) * 5 + Math.sin((x + wx) / 10) * 2;
    for (let x = 0; x < ww; x += 2.5) { const y = near(x) - 2 - rand() * 4; N.box('#131a2e', x, y, 2.5, wh - y); }
    N.ridge('#161d33', 0, ww, near, () => wh);
    N.glow('#f0c27a40', ww * 0.28, wh * 0.73, 6);
    N.box('#f3d08e', ww * 0.28, wh * 0.73, 1.5, 1.5);
    // 유리에 비친 빛
    N.poly('#ffffff09', [[8, 0], [26, 0], [0, wh * 0.5], [0, wh * 0.24]]);
    N.poly('#ffffff07', [[ww * 0.56, 0], [ww * 0.62, 0], [ww * 0.5, wh * 0.4], [ww * 0.5, wh * 0.28]]);
  });
  N.box('#1c2336', ww / 2 - 3, 0, 6, wh);
  N.box('#3d4865', ww / 2 - 3, 0, 1, wh);
  N.box('#1c2336', 0, wh * 0.42 - 2, ww, 4);
  N.box('#3d4865', 0, wh * 0.42 - 2, ww, 1);
  N.box('#2a3348', 0, wh - 2, ww, 2);
  // 창턱: 윗면이 달빛을 받는다
  N.box('#3b465c', -10, wh, ww + 20, 4);
  N.box('#6c7899', -10, wh, ww + 20, 1);
  N.box('#1d2434', -8, wh + 4, ww + 16, 4);
  N.box('#03050b60', -8, wh + 8, ww + 16, 4);
  // 커튼: 위에서 넓게 내려와 가운데서 묶였다가 아래로 다시 퍼진다
  {
    const tie = wh * 0.5, top = -8, end = wh + 8;
    const breadth = (y: number) => y < tie
      ? ww * 0.2 + 8 - (ww * 0.07) * ((y - top) / (tie - top)) ** 0.7
      : ww * 0.13 + 8 + (ww * 0.04) * ((y - tie) / (end - tie)) ** 0.6;
    for (let j = N.Y(top); j < N.Y(end); j++) {
      const y = (j + 0.5 - N.Y(0)) / s, span = Math.max(3, Math.round(breadth(y) * s)), x0 = N.X(-8);
      for (let q = 0; q < 4; q++) {
        const a0 = Math.round(span * q / 4), b0 = Math.round(span * (q + 1) / 4), n = b0 - a0;
        const lit = Math.max(1, Math.round(n * 0.25)), mid = Math.max(1, Math.round(n * 0.4));
        g.fillStyle = '#36405c'; g.fillRect(x0 + a0, j, lit, 1);
        g.fillStyle = '#262e45'; g.fillRect(x0 + a0 + lit, j, mid, 1);
        g.fillStyle = '#1a2034'; g.fillRect(x0 + a0 + lit + mid, j, Math.max(0, n - lit - mid), 1);
      }
      g.fillStyle = '#5b688a'; g.fillRect(x0 + span - 1, j, 1, 1); // 창 쪽 가장자리는 달빛을 받는다
    }
    N.box('#3a4462', -8, tie - 2.5, ww * 0.13 + 8, 4); // 커튼을 묶은 끈
    N.box('#5b688a', -8, tie - 2.5, ww * 0.13 + 8, 1);
    N.box('#141a2b', -8, tie + 1.5, ww * 0.13 + 8, 1);
    N.box('#4a5470', -16, -11, ww + 32, 2);
    N.box('#262d40', -16, -9, ww + 32, 1);
    N.oval('#5a6479', -17, -10, 3, 3);
    N.oval('#5a6479', ww + 17, -10, 3, 3);
  }

  // ── 관물대 맨 윗칸: 각 잡아 갠 전투복 · 방탄모 · 세면백 ──
  const shelfW = Math.min(wx - 24, W * (tall ? 0.48 : 0.36)), shelfY = Math.max(60, y0 * (tall ? 0.6 : 0.46));
  const iu = Math.min(shelfW / 5, 62); // 물건 크기의 기준 (선반이 길어져도 물건은 커지지 않는다)
  {
    const R = brush(g, 0, B.Y(shelfY), s);
    for (const u of [0.15, 0.85]) {
      const x = shelfW * u;
      R.box('#1d2434', x - 2, 6, 4, 20);
      R.seg('#262e40', x + 1, 22, x + 14, 7, 3);
      R.seg('#3a4458', x + 1, 21, x + 13, 7, 1);
    }
    R.box('#03050b60', 0, 6, shelfW + 3, 7);
    R.box('#3b4456', 0, 0, shelfW, 6);
    R.box('#5a6479', 0, 0, shelfW, 1.5);
    R.box('#262e3e', 0, 5, shelfW, 1);
    R.box('#4b5569', shelfW - 2, 0, 2, 6);
    // 전투복: 네 겹으로 각 잡아 갠 무늬 천
    for (const fx of [shelfW * 0.06, shelfW * 0.25]) {
      const fw = iu * 0.8;
      R.box('#03050b50', fx + 3, -2, fw, 2);
      for (let i = 0; i < 4; i++) {
        const fy = -8 * (i + 1), x0 = fx + (i % 2 ? 1 : -0.5), x1 = x0 + fw; // 겹마다 살짝 어긋난다
        R.poly(i % 2 ? '#323c30' : '#38432f', [[x0 + 2, fy], [x1 - 2, fy], [x1, fy + 2.5], [x1, fy + 5.5], [x1 - 2, fy + 8], [x0 + 2, fy + 8], [x0, fy + 5.5], [x0, fy + 2.5]]);
        R.box('#55614b', x0 + 2, fy, fw - 4, 1.5); // 접힌 모서리가 빛을 받는다
        R.box('#4a5541', x0, fy + 2.5, 1.5, 3);
        R.box('#262d25', x1 - 3.5, fy + 1.5, 2.5, 6);
        R.box('#1f251d', x0 + 2, fy + 7, fw - 4, 1);
        for (let j = 0; j < fw / 7; j++) R.box(j % 2 ? '#2a3226' : '#48523d', x0 + 3 + rand() * (fw - 9), fy + 2 + rand() * 4, 2 + rand() * 3, 1.5);
      }
    }
    // 방탄모: 위가 둥글고, 위장포 무늬, 턱끈이 선반 앞으로 늘어진다
    {
      const hcx = shelfW * 0.55, hr = Math.max(12, iu * 0.38);
      R.oval('#262d22', hcx, -3, hr, hr * 0.92, (_dx, dy) => dy < 0);
      R.oval('#323b2c', hcx + hr * 0.06, -3, hr * 0.94, hr * 0.86, (dx, dy) => dy < 0 && dx * 0.5 - dy > 0.45);
      R.oval('#3e4836', hcx + hr * 0.22, -hr * 0.52, hr * 0.5, hr * 0.32);
      R.oval('#59654e', hcx + hr * 0.32, -hr * 0.66, hr * 0.22, hr * 0.1);
      for (const [dx, dy, rx] of [[-0.5, -0.3, 0.16], [-0.1, -0.55, 0.12], [0.45, -0.25, 0.14], [0.05, -0.18, 0.1]]) R.oval('#21271d', hcx + dx * hr, -3 + dy * hr, rx * hr, rx * hr * 0.7);
      R.box('#1d2219', hcx - hr - 3, -4, hr * 2 + 6, 4);
      R.box('#4a5541', hcx - hr - 3, -4, hr * 2 + 6, 1);
      R.seg('#161a13', hcx - hr * 0.55, 0, hcx - hr * 0.5, 13, 1.5);
      R.seg('#161a13', hcx + hr * 0.35, 0, hcx + hr * 0.25, 11, 1.5);
      R.box('#6d7466', hcx - hr * 0.56, 12, 3, 2);
    }
    // 세면백: 지퍼 달린 천 가방
    {
      const bagX = shelfW * 0.75, bagW = iu * 0.9;
      R.poly('#2c3446', [[bagX, 0], [bagX + bagW, 0], [bagX + bagW - 1, -7], [bagX + bagW - 6, -15], [bagX + 6, -16], [bagX + 1, -8]]);
      R.poly('#222838', [[bagX + bagW * 0.68, 0], [bagX + bagW, 0], [bagX + bagW - 1, -7], [bagX + bagW - 6, -15], [bagX + bagW * 0.66, -15.5]]);
      R.poly('#3a4560', [[bagX + 6, -16], [bagX + bagW * 0.5, -16], [bagX + bagW * 0.42, -12], [bagX + 4, -11]]);
      R.seg('#4f5b7a', bagX + 6, -15.5, bagX + bagW - 6, -14.5, 1);
      R.box('#8b95ad', bagX + bagW * 0.3, -15.5, 2, 3.5);
      R.seg('#3a4460', bagX + bagW - 3, -9, bagX + bagW + 3, -6, 1.5);
      R.seg('#3a4460', bagX + bagW + 3, -6, bagX + bagW, -2, 1.5);
    }
  }

  // ── 화면이 넓으면 시계와 창 사이 빈 벽에 게시판이 보인다 ──
  const clockX = tall ? wx + ww / 2 : (shelfW + wx) / 2;
  if (!tall && wx - clockX > 170) {
    const P = brush(g, B.X((clockX + wx) / 2 - 12), B.Y(wy + 12), s);
    P.box('#03050b60', -40, 3, 86, 62);
    P.box('#1b1f2a', -43, 0, 86, 62);
    P.box('#2c3140', -43, 0, 86, 1);
    P.box('#2b2a30', -39, 4, 78, 54);
    for (let i = 0; i < 40; i++) P.box(i % 2 ? '#33313a' : '#25242b', -38 + rand() * 75, 5 + rand() * 51, 2, 1);
    for (const [x, y, pw, ph, c] of [[-34, 9, 24, 32, '#4c5263'], [-6, 8, 20, 15, '#555b6c'], [-4, 27, 26, 25, '#4a5061'], [24, 12, 11, 18, '#5e6576']] as const) {
      P.box('#0a0d1550', x + 1.5, y + 1.5, pw, ph);
      P.box(c, x, y, pw, ph);
      P.box('#6c7385', x, y, pw, 1);
      for (let r = y + 5; r < y + ph - 3; r += 4) P.box('#3a3f4e', x + 3, r, pw - 6 - ((r * 3) % 5), 1);
      P.box('#8a4a4a', x + pw / 2 - 1, y - 1, 2, 2);
    }
    P.box('#7480a2', 42, 0, 1, 62); // 창 쪽 모서리에 닿는 달빛
  }

  // ── 벽시계: 소등 시각 22시 ──
  {
    const C = brush(g, B.X(clockX), B.Y(tall ? wy - 40 : shelfY - 28), s);
    C.oval('#03050b60', 2, 3, 15, 15);
    C.oval('#232a3a', 0, 0, 15, 15);
    C.oval('#3d4659', 0, 0, 15, 15, (dx, dy) => dx - dy > 0.9);
    C.oval('#6f778b', 0, 0, 12, 12);
    C.oval('#8b92a2', 0, 0, 12, 12, (dx, dy) => dx - dy > -0.3);
    C.oval('#9da4b3', 0, 0, 12, 12, (dx, dy) => dx - dy > 0.9);
    for (let i = 0; i < 12; i++) {
      const ang = i * Math.PI / 6, r = 9.6;
      C.box('#3a4152', Math.sin(ang) * r - 0.6, -Math.cos(ang) * r - 0.6, i % 3 ? 1.2 : 1.8, i % 3 ? 1.2 : 1.8);
    }
    C.box('#1c2230', -0.7, -9, 1.6, 9.5);
    C.seg('#1c2230', 0, 0, -5.4, -3.1, 2);
    C.box('#c25a4a', -1, -1, 2, 2);
  }

  // ── 걸레받이와 바닥 ──
  B.box('#222b3d', 0, y0 - 8, W, 8);
  B.box('#38435a', 0, y0 - 8, W, 1);
  B.box('#121722', 0, y0, W, H - y0);
  for (let y = y0 + 3, gap = 5, row = 0; y < H; y += gap, gap += 3, row++) {
    B.box('#1b2232', 0, y, W, 1);
    B.box('#0b0f18', 0, y + 1, W, 1);
    const plank = 90 + row * 34;
    for (let x = -((row * 53) % plank); x < W; x += plank) B.box('#0b0f18', x, y + 2, 1.2, gap - 2);
  }
  for (let i = 0; i < W * 0.5; i++) { const y = y0 + rand() ** 0.8 * (H - y0); B.box('#1d243660', rand() * W, y, 3 + rand() * 12, 1); }

  // 침상 밑 그늘과 다리
  B.box('#080b13', nearL, y1 + t, W - nearL, yf - y1 - t);
  B.fade(['#05070ec0', '#05070e00'], nearL - 6, yf, W - nearL + 6, 16);
  B.box('#2d3445', W * 0.55, y1 + t + 6, 6, yf - y1 - t - 6);
  B.box('#454e62', W * 0.55 + 5, y1 + t + 6, 1, yf - y1 - t - 6);

  // ── 철제 머리맡: 침상 머리 쪽에 선 판. 쇠살 사이로 벽이 비친다 ──
  const hb = p * 0.42;
  B.poly('#05080f50', [[hx, y0 - hb], [hx, y0], [nearL, y1], [nearL, y1 - hb]]);
  for (let i = 1; i < 6; i++) {
    const u = i / 6, x = hx - sk * u, top = y0 - hb + depth * u;
    B.box('#2a3142', x - 2, top + 4, 4, hb - 4);
    B.box('#4f5a70', x + 1, top + 4, 1, hb - 4);
  }
  B.seg('#2b3242', hx, y0 - hb * 0.45, nearL, y1 - hb * 0.45, 4);
  B.seg('#475166', hx, y0 - hb * 0.45 - 1.5, nearL, y1 - hb * 0.45 - 1.5, 1);
  B.seg('#3d465a', hx, y0 - hb + 1, nearL, y1 - hb + 1, 6);
  B.seg('#7a859c', hx, y0 - hb - 1.5, nearL, y1 - hb - 1.5, 1.5);
  B.box('#2b3242', hx - 3, y0 - hb, 6, hb + 4);
  B.box('#4f5a70', hx + 2, y0 - hb, 1, hb + 4);
  B.box('#5a6479', hx - 4, y0 - hb - 3, 8, 3);

  // ── 매트리스: 홑이불 덮인 윗면과 앞쪽 옆면 ──
  B.poly('#47536a', [[hx, y0], [W + 4, y0], [W + 4, y1], [nearL, y1]]);
  B.poly('#3e495e', [[hx, y0], [W + 4, y0], [W + 4, y0 + 6], [hx - 6 * k, y0 + 6]]); // 벽 쪽은 조금 어둡다
  for (let i = 1; i < 4; i++) {
    const y = y0 + depth * i / 4;
    B.box('#4f5c74', T(hx + 8, y)[0], y, W, 1);
  }
  // 홑이불의 잔주름
  for (const [x, y, l] of [[0.35, 0.2, 26], [0.7, 0.75, 20], [1.1, 0.55, 18]]) onBed('#3d475c', [[hx + a * x * 2, y0 + depth * y], [hx + a * x * 2 + l, y0 + depth * y - 1], [hx + a * x * 2 + l, y0 + depth * y]]);
  B.box('#262e3e', nearL, y1, W - nearL, t);
  B.box('#66728b', nearL, y1, W - nearL, 1.5);
  B.box('#1e2533', nearL, y1 + t - 2, W - nearL, 2);
  B.box('#333c4f', nearL, y1 + t, W - nearL, 6);
  B.box('#4f5a70', nearL, y1 + t, W - nearL, 1);
  // 침상 이름표
  B.box('#6c7486', nearL + 18, y1 + t + 1, 22, 4);
  B.box('#3a4152', nearL + 21, y1 + t + 2.5, 14, 1);

  // ── 베개: 침상 폭 방향으로 길게 눕힌 솜베개. 가운데가 부풀고, 달빛 쪽(오른쪽 위)이 밝다 ──
  const [gx, gy] = S(cx + a * 0.3, cy + b + 2);
  B.glow('#ffe2a038', gx, gy + 4, p * 0.36);
  const pillow = (c: string, n: number, sx: number, sy: number, dx: number, dy: number) =>
    B.poly(c, squircle(n).map(([u, v]) => S(cx + dx + u * a * sx, cy + dy + v * b * sy)));
  pillow('#141a28', 4, 1.02, 1, -4, 8); // 홑이불에 드리운 그늘
  pillow('#4f596e', 4, 1, 1, 0, 0); // 앞쪽(내 쪽) 옆면
  pillow('#6a748a', 4, 0.98, 0.93, 0.5, -4.5);
  pillow('#7d879d', 3.4, 0.93, 0.86, 1.5, -6);
  pillow('#8d97ac', 3, 0.82, 0.74, 3, -7.5);
  pillow('#9ba4b8', 2.6, 0.62, 0.5, 6, -10);
  pillow('#a8b1c3', 2.2, 0.3, 0.16, 11, -b * 0.42);
  // 네 귀퉁이에서 가운데로 모이는 주름
  for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [k0, k1] = S(cx + ux * a * 0.8 + 1, cy + uy * b * 0.72 - 4.5), [k2, k3] = S(cx + ux * a * 0.64 + 2, cy + uy * b * 0.56 - 5.5);
    B.seg('#6d778d', k0, k1, k2, k3, 1.5);
    B.seg('#939db1', k0 + 1.5, k1 - 1.5, k2 + 1.5, k3 - 1.5, 1);
  }
  // 앞자락 틈으로 비치는 금빛 (별 조각의 귀퉁이)
  B.poly('#c99a4a', [[gx - 7, gy - 2], [gx + 8, gy - 2], [gx + 2, gy + 2.5]]);
  B.box('#f3d58a', gx - 6, gy - 2, 13, 1.5);
  B.box('#fff4c8', gx - 2, gy - 2, 5, 1.5);

  // ── 모포: 홑이불을 한 뼘 접어 내리고, 앞쪽은 침상 옆으로 늘어진다 ──
  const bx = hx + 2 * a + p * 0.3, fw = Math.max(8, p * 0.07), drop = t * 0.8, hem = y1 + t + drop;
  const front = bx - sk; // 모포가 앞 모서리에 닿는 자리
  B.poly('#20271f', [[front, y1], [W + 4, y1], [W + 4, hem], [front, hem]]);
  for (let x = front + 14; x < W;) { // 늘어진 자락의 세로 주름: 넓고 얕게, 간격은 제각각
    const fwid = 5 + rand() * 7;
    B.poly('#1a2019', [[x, y1 + 4], [x + fwid * 0.6, y1 + 4], [x + fwid, hem], [x - 1, hem]]);
    B.poly('#29322580', [[x + fwid * 0.6, y1 + 4], [x + fwid * 0.9, y1 + 4], [x + fwid * 1.5, hem], [x + fwid, hem]]);
    x += 26 + rand() * 30;
  }
  for (let x = front; x < W; x += 3) B.box('#1a2019', x, hem - (Math.sin(x / 7) > 0.6 ? 1.5 : 0), 3, 3);
  B.box('#030508a0', front, hem + 2, W - front, 3);
  onBed('#323c2f', [[bx, y0 - 1], [W + sk + 4, y0 - 1], [W + sk + 4, y1 + 1], [bx, y1 + 1]]);
  for (let i = 0; i < (W - bx) * 1.6; i++) { // 모직의 결
    const y = y0 + rand() * depth, [x] = T(bx + 4 + rand() * (W + sk - bx), y);
    B.box(i % 3 ? '#3a4535' : '#283125', x, y, 2 + rand() * 6, 1);
  }
  // 모포의 주름: 앞 모서리에서 시작해 벽 쪽으로 가늘어진다. 달빛 반대쪽(왼쪽)이 그늘, 창 쪽이 밝다
  for (const [u, len, bend] of [[0.14, 0.85, 10], [0.42, 0.6, -8], [0.73, 0.95, 12]] as const) {
    const fx = bx + (W - bx) * u, top = y1 - depth * len;
    const ridge = (side: number, wid: number) => {
      const pts: Point[] = [];
      for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push(T(fx + bend * v * v, top + (y1 - top) * v)); }
      for (let i = 12; i >= 0; i--) { const v = i / 12; pts.push(T(fx + bend * v * v + side * wid * v ** 0.7, top + (y1 - top) * v)); }
      return pts;
    };
    B.poly('#2e3829', ridge(-1, 22));
    B.poly('#29322580', ridge(-1, 12));
    B.poly('#252d21', ridge(-1, 5));
    B.poly('#3a4532', ridge(1, 10));
    B.poly('#44503c', ridge(1, 3.5));
    // 앞으로 늘어진 자락까지 이어지는 골
    const [ex] = T(fx + bend, y1);
    B.poly('#181e17', [[ex - 10, y1 + 2], [ex, y1 + 2], [ex + 3, hem], [ex - 13, hem]]);
    B.poly('#2a3326', [[ex, y1 + 2], [ex + 4, y1 + 2], [ex + 8, hem], [ex + 3, hem]]);
  }
  B.box('#4b5743', front, y1, W - front, 2); // 앞 모서리를 넘어가는 둥근 모
  B.box('#2a3328', front, y1 + 2, W - front, 2);
  // 접어 내린 홑이불 띠
  B.poly('#2a3346', [[bx - 4, y0 - 1], [bx, y0 - 1], [bx - sk, y1], [bx - 4 - sk, y1]]); // 접힌 두께가 드리운 그늘
  B.poly('#7e889d', [[bx, y0 - 1], [bx + fw, y0 - 1], [bx + fw - sk, y1], [bx - sk, y1]]);
  B.poly('#959fb2', [[bx, y0 - 1], [bx + fw * 0.45, y0 - 1], [bx + fw * 0.45 - sk, y1], [bx - sk, y1]]);
  B.seg('#c0c8d8', bx, y0 - 1, bx - sk, y1, 1);
  B.seg('#5c6679', bx + fw - 2.5, y0, bx + fw - 2.5 - sk, y1, 1);
  B.seg('#1a2019', bx + fw + 1, y0, bx + fw + 1 - sk, y1, 2);
  B.box('#6c768b', front, y1, fw, hem - y1);
  B.box('#a9b2c4', front, y1, 1.5, hem - y1);
  B.box('#4c5568', front + fw - 2, y1, 2, hem - y1);

  // ── 창으로 드는 달빛: 모포 위에 창틀 모양 그대로 떨어진다 ──
  {
    const lx0 = wx - (y0 - sill) - 12, shift = sk + depth * 0.4;
    const at = (x: number, v: number): Point => [x - shift * v, y0 + depth * v];
    const pane = (u0: number, u1: number, v0: number, v1: number, c: string) =>
      B.poly(c, [at(lx0 + ww * u0, v0), at(lx0 + ww * u1, v0), at(lx0 + ww * u1, v1), at(lx0 + ww * u0, v1)]);
    for (const [u0, u1] of [[0, 0.485], [0.515, 1]]) {
      pane(u0, u1, 0, 0.56, '#b9cdf218');
      pane(u0, u1, 0.6, 1, '#b9cdf218');
      pane(u0 + 0.04, u1 - 0.04, 0.05, 0.5, '#c9dcff0c');
      pane(u0 + 0.04, u1 - 0.04, 0.65, 0.95, '#c9dcff0c');
    }
    const [ex0] = at(lx0, 1), [ex1] = at(lx0 + ww, 1);
    B.poly('#b9cdf20f', [[ex0, y1], [ex0 + ww * 0.485, y1], [ex0 + ww * 0.485 - 3, hem], [ex0 - 3, hem]]);
    B.poly('#b9cdf20f', [[ex0 + ww * 0.515, y1], [ex1, y1], [ex1 - 3, hem], [ex0 + ww * 0.515 - 3, hem]]);
  }

  // ── 침상 앞에 벗어 둔 삼선 슬리퍼 한 켤레 ──
  {
    const sw = Math.max(24, p * 0.15), sy = yf + Math.max(12, p * 0.09);
    for (const [dx, dy] of [[0, 0], [sw + 6, 4]]) {
      const F = brush(g, B.X(nearL + p * 0.35 + dx), B.Y(sy + dy), s);
      F.oval('#03050aa0', sw / 2 + 2, 6, sw / 2 + 3, 3.5);
      F.oval('#0b0f19', sw / 2, 3.2, sw / 2, 4.6);
      F.oval('#1b2233', sw / 2, 1.6, sw / 2 - 0.5, 4);
      F.oval('#222b40', sw / 2 + 2, 1, sw / 2 - 4, 2.4);
      F.poly('#283456', [[1, -2.5], [sw * 0.56, -3.5], [sw * 0.6, 4], [2, 4.5]]);
      F.box('#3a4874', 2, -3.2, sw * 0.52, 1);
      F.box('#1b2440', sw * 0.56, -3, 1.5, 7);
      for (let q = 0; q < 3; q++) F.box('#8b95ad', sw * 0.12 + q * sw * 0.13, -3, 2, 7.2);
    }
  }

  // 앞쪽 머리맡 기둥 (베개 앞)
  B.box('#353d50', nearL - 3, y1 - hb, 6, yf - y1 + hb);
  B.box('#7a859c', nearL + 2, y1 - hb, 1, yf - y1 + hb);
  B.box('#232a38', nearL - 3, y1 - hb, 1.5, yf - y1 + hb);
  B.box('#5a6479', nearL - 4, y1 - hb - 3, 8, 3);
  B.box('#8b95ad', nearL - 4, y1 - hb - 3, 8, 1);

  vignette(g, w, h, '#03050c', 0.55);
}
