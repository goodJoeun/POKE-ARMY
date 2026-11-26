import { type Ink, type Point, line, polygon, rect, seeded, sky, wash } from './pixels';

/**
 * 1일차 소등 직전, 생활관의 내 침상: 철제 머리맡 · 베개 · 홑이불을 접어 내린 모포 · 창으로 드는 달빛.
 * 베개 밑 별 조각의 반짝임(맥박처럼 커졌다 작아지는 빛)은 꿈 화면이 이 그림 위에 따로 그린다 → lightsOutGlint
 */
function layout(w: number, h: number) {
  const tall = h > w;
  const p = Math.round(Math.max(58, Math.min(104, w * (tall ? 0.5 : 0.27)))); // 침상 크기의 기준 (휴대폰에선 화면 폭에 맞춰 크게)
  const depth = Math.round(p * 0.7); // 매트리스 깊이 (벽 쪽 모서리 → 앞 모서리)
  const y1 = Math.round(h * (tall ? 0.58 : 0.68)), y0 = y1 - depth;
  const sk = Math.round(depth * 0.3); // 내려다보는 각도: 앞 모서리가 왼쪽으로 비껴 보인다
  const hx = Math.round(Math.max(10, w * 0.08)) + sk; // 머리맡 (벽 쪽 모서리)
  // 베개는 침상 폭 방향(벽 → 앞)으로 길게 눕는다: 반폭 a(침상 길이 방향) · 반깊이 b(침상 폭 방향)
  const a = Math.round(p * 0.24), b = Math.round(depth * 0.4);
  const cx = hx + 5 + a, cy = Math.round((y0 + y1) / 2) - 1; // 베개 한가운데
  /** 침상 바닥면 위의 점: 앞으로 올수록 왼쪽으로 비낀다 */
  const S = (x: number, y: number): Point => [x - (y - cy) * sk / depth, y];
  return { tall, p, depth, y0, y1, sk, hx, cx, cy, a, b, S };
}

/** 베개 앞자락 밑, 별 조각이 빛나는 자리 (그림 픽셀 좌표) */
export function lightsOutGlint(w: number, h: number): Point {
  const { cx, cy, a, b, S } = layout(w, h);
  const [x, y] = S(cx + a * 0.3, cy + b + 1);
  return [Math.round(x), Math.round(y)];
}

export function lightsOut(g: Ink, w: number, h: number) {
  const rand = seeded(1112);
  const { tall, p, depth, y0, y1, sk, hx, cx, cy, a, b, S } = layout(w, h);
  const t = Math.max(4, Math.round(p * 0.09)); // 매트리스 두께
  const yf = y1 + t + Math.round(p * 0.3); // 침상 다리가 닿는 바닥

  // 벽: 세로 이음매와 걸레받이
  sky(g, w, h, ['#0a0f1d', '#111829', '#182036']);
  for (let x = 4; x < w; x += 9) rect(g, '#8d9ab80b', x, 0, 1, y0);
  rect(g, '#222b3d', 0, y0 - 4, w, 4);
  rect(g, '#38435a', 0, y0 - 4, w, 1);
  if (tall) {
    const ceil = Math.round(h * 0.07);
    rect(g, '#0b0f1a', 0, 0, w, ceil);
    rect(g, '#262f44', 0, ceil, w, 1);
    rect(g, '#1f2738', w * 0.25, ceil + 1, w * 0.5, 4);
    rect(g, '#3e475c', w * 0.27, ceil + 3, w * 0.46, 1);
  }

  // 창: 산등성이 너머 초승달, 한쪽으로 걷어 둔 커튼
  const ww = Math.round(Math.min(w * 0.36, 110)), wx = Math.round(w - ww - Math.max(8, w * 0.08));
  const sill = y0 - 16, wh = Math.round(Math.min(ww * 0.62, sill - h * 0.06)), wy = sill - wh;
  rect(g, '#080c17', wx - 3, wy - 3, ww + 6, wh + 6);
  const glass = g.createLinearGradient(0, wy, 0, sill);
  glass.addColorStop(0, '#0f1a36'); glass.addColorStop(1, '#3a3d60');
  g.fillStyle = glass; g.fillRect(wx, wy, ww, wh);
  for (let i = 0; i < ww * 0.35; i++) rect(g, i % 4 ? '#8d9cc0' : '#d9dfee', wx + rand() * ww, wy + rand() * wh * 0.7, 1, 1);
  const mx = wx + ww * 0.72, my = wy + wh * 0.3;
  wash(g, mx, my, 16, '#dfe6ff2e');
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    if (x * x + y * y <= 17 && (x - 2) ** 2 + (y + 1) ** 2 > 12) rect(g, '#f1ecd2', mx + x, my + y, 1, 1);
  }
  for (let x = 0; x < ww; x++) {
    const ridge = wh * 0.8 + Math.sin((x + wx) / 13) * 2.5 + Math.sin((x + wx) / 5) * 1;
    rect(g, '#161d33', wx + x, wy + ridge, 1, wh - ridge);
  }
  rect(g, '#2a3348', wx + ww / 2 - 1, wy, 3, wh);
  rect(g, '#56627e', wx + ww / 2 - 1, wy, 1, wh);
  rect(g, '#2a3348', wx, wy + Math.round(wh * 0.42), ww, 2);
  rect(g, '#3b465c', wx - 4, sill, ww + 8, 2);
  rect(g, '#1d2434', wx - 3, sill + 2, ww + 6, 2);
  polygon(g, '#252e45', [[wx - 4, wy - 4], [wx + ww * 0.2, wy - 4], [wx + ww * 0.13, wy + wh * 0.5], [wx + ww * 0.17, sill + 3], [wx - 4, sill + 4]]);
  line(g, '#3b4663', wx + ww * 0.12, wy, -ww * 0.08, wh * 0.9);
  rect(g, '#4a5470', wx - 6, wy - 5, ww + 12, 1);

  // 관물대 맨 윗칸: 각 잡아 갠 전투복 · 방탄모 · 세면백
  const shelfW = Math.round(Math.min(wx - 12, w * (tall ? 0.48 : 0.36))), shelfY = Math.round(Math.max(30, y0 * (tall ? 0.6 : 0.46)));
  for (const u of [0.15, 0.85]) line(g, '#2a3346', shelfW * u, shelfY + 9, 6, -6, 2);
  rect(g, '#3b4456', 0, shelfY, shelfW, 3);
  rect(g, '#5a6479', 0, shelfY, shelfW, 1);
  const unit = shelfW / 5;
  for (const k of [0.3, 1.25]) {
    const fx = Math.round(unit * k), fw = Math.round(unit * 0.8);
    for (let i = 0; i < 4; i++) {
      const fy = shelfY - 4 * (i + 1);
      rect(g, i % 2 ? '#323c30' : '#38432f', fx, fy, fw, 4);
      rect(g, '#55614b', fx, fy, fw, 1);
      rect(g, '#262d25', fx + fw - 1, fy, 1, 4);
    }
  }
  const hcx = Math.round(unit * 2.75), hr = Math.max(6, Math.round(unit * 0.38));
  for (let y = -hr; y <= 0; y++) {
    const half = Math.round(Math.sqrt(hr * hr - y * y));
    rect(g, y < -hr * 0.5 ? '#3a4433' : '#2f3829', hcx - half, shelfY + y - 1, half * 2 + 1, 1);
  }
  rect(g, '#262d22', hcx - hr - 1, shelfY - 2, hr * 2 + 3, 2);
  rect(g, '#5d6a52', hcx - Math.round(hr * 0.5), shelfY - hr, Math.round(hr * 0.6), 1);
  const bagX = Math.round(unit * 3.75), bagW = Math.round(unit * 0.9);
  polygon(g, '#2c3446', [[bagX, shelfY], [bagX + bagW, shelfY], [bagX + bagW - 2, shelfY - 8], [bagX + 2, shelfY - 9]]);
  rect(g, '#4a5470', bagX + 2, shelfY - 9, bagW - 4, 1);

  // 벽시계: 소등 시각 22시
  {
    const ccx = Math.round(tall ? wx + ww / 2 : (shelfW + wx) / 2), ccy = Math.round(tall ? wy - 20 : shelfY - 14), r = 7;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r) rect(g, d > (r - 1.5) ** 2 ? '#2c3446' : '#8b92a2', ccx + x, ccy + y, 1, 1);
    }
    rect(g, '#1c2230', ccx, ccy - 5, 1, 5);
    line(g, '#1c2230', ccx, ccy, -3, -2);
    rect(g, '#c25a4a', ccx, ccy, 1, 1);
  }

  // 바닥과 침상 밑 그늘
  rect(g, '#121722', 0, y0, w, h - y0);
  for (let y = yf + 3, gap = 4; y < h; y += gap, gap += 2) rect(g, '#1a2030', 0, y, w, 1);
  const nearL = hx - sk;
  rect(g, '#090c14', nearL, y1 + t, w - nearL, yf - y1 - t);

  // 철제 머리맡: 침상 머리 쪽에 선 판 (기울어진 머리 모서리 위로 hb만큼). 쇠살 사이로 벽이 비친다
  const hb = Math.round(p * 0.42);
  polygon(g, '#161c29', [[hx, y0 - hb], [hx, y0], [nearL, y1], [nearL, y1 - hb]]);
  for (let i = 1; i < 6; i++) {
    const u = i / 6, x = Math.round(hx - sk * u), top = y0 - hb + depth * u;
    rect(g, '#323a4d', x, top + 3, 2, hb - 3);
    rect(g, '#4a5469', x, top + 3, 1, hb - 3);
  }
  line(g, '#3d465a', hx, y0 - hb, -sk, depth, 3);
  line(g, '#7a859c', hx, y0 - hb, -sk, depth);
  line(g, '#2b3242', hx, y0 - hb * 0.45, -sk, depth, 2);
  rect(g, '#2b3242', hx - 1, y0 - hb, 3, hb + 2);
  rect(g, '#5a6479', hx - 2, y0 - hb - 1, 5, 2);

  // 매트리스: 홑이불 덮인 윗면과 앞쪽 옆면
  polygon(g, '#47536a', [[hx, y0], [w + 2, y0], [w + 2, y1], [nearL, y1]]);
  for (let i = 1; i < 4; i++) {
    const y = y0 + depth * i / 4;
    line(g, '#4e5b73', S(hx + 4, y)[0], y, w, 0);
  }
  rect(g, '#262e3e', nearL, y1, w - nearL, t);
  rect(g, '#66728b', nearL, y1, w - nearL, 1);
  rect(g, '#333c4f', nearL, y1 + t, w - nearL, 3);
  rect(g, '#4f5a70', nearL, y1 + t, w - nearL, 1);
  for (const lx of [nearL + 1, Math.round(w * 0.55)]) rect(g, '#2d3445', lx, y1 + t + 3, 3, yf - y1 - t - 3);

  // 베개 밑에서 새어 나오는 빛 (반짝임 자체는 꿈 화면이 그린다)
  const [gx, gy] = lightsOutGlint(w, h);
  wash(g, gx, gy + 2, p * 0.35, '#ffe2a03a');

  // 베개: 침상 폭 방향으로 길게 눕힌 솜베개
  // 한 픽셀씩 높이를 매겨 칠한다: 가운데가 부풀고 가장자리로 갈수록 꺼진다 (모서리가 둥근 네모 · 2×2 격자 점묘)
  const tones = ['#5e687e', '#6f7990', '#818ba1', '#939db2', '#a4adc0', '#b3bccc'];
  const inPillow = (x: number, y: number) => ((x + (y - cy) * sk / depth - cx) / a) ** 4 + ((y - cy) / b) ** 4 <= 1;
  for (let y = Math.floor(cy - b); y <= cy + b + 3; y++)
    for (let x = Math.floor(cx - a - sk); x <= cx + a + sk + 2; x++)
      if (inPillow(x - 1, y - 3) && !inPillow(x, y)) rect(g, '#1b2130', x, y, 1, 1); // 베개가 홑이불에 드리운 그늘
  for (let y = Math.floor(cy - b); y <= cy + b; y++) {
    const v = (y - cy) / b;
    for (let x = Math.floor(cx - a - sk); x <= cx + a + sk; x++) {
      const u = (x + (y - cy) * sk / depth - cx) / a;
      if (u ** 4 + v ** 4 > 1) continue;
      const z = (1 - Math.abs(u) ** 2.4) * (1 - Math.abs(v) ** 2.4); // 부푼 정도 0~1
      const lit = z * 0.82 + 0.18 * (0.5 - v * 0.35 + u * 0.15); // 위(벽 쪽)가 조금 더 밝다
      const level = lit * (tones.length - 0.01) + ((x + y) % 2 ? 0.25 : -0.25) * (y % 2 ? 1 : 0.5);
      rect(g, tones[Math.max(0, Math.min(tones.length - 1, Math.floor(level)))], x, y, 1, 1);
    }
  }
  // 가운데로 모이는 솔기 주름 (네 귀퉁이에서)
  for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [kx, ky] = S(cx + ux * (a - 4), cy + uy * (b - 4));
    line(g, '#6a748b', kx, ky, -ux * a * 0.22, -uy * b * 0.18);
  }
  // 앞자락 틈으로 비치는 금빛
  line(g, '#f3d58a', gx - 3, gy - 1, 7, 0);
  line(g, '#fff4c8', gx - 1, gy - 1, 3, 0);

  // 모포: 홑이불을 한 뼘 접어 내리고, 앞쪽은 침상 옆으로 늘어진다
  const bx = hx + 2 * a + Math.round(p * 0.3), fw = Math.max(4, Math.round(p * 0.07)), drop = Math.round(t * 0.8);
  polygon(g, '#20271f', [[bx - sk, y1], [w + 2, y1], [w + 2, y1 + t + drop], [bx - sk, y1 + t + drop]]);
  for (let x = bx - sk; x < w; x += 3) rect(g, '#1d241c', x, y1 + t + drop - (Math.sin(x / 7) > 0.6 ? 1 : 0), 2, 2);
  polygon(g, '#323c2f', [[bx, y0 - 1], [w + 2, y0 - 1], [w + 2, y1 + 1], [bx - sk, y1 + 1]]);
  for (let i = 0; i < w * 0.6; i++) {
    const y = y0 + rand() * depth, x = S(bx + 2, y)[0] + rand() * (w - bx);
    rect(g, i % 3 ? '#384334' : '#2b3428', x, y, 2 + rand() * 4, 1);
  }
  rect(g, '#4b5743', bx - sk, y1, w - bx + sk, 1);
  for (const [u, len] of [[0.16, 0.8], [0.43, 0.62], [0.74, 0.9]] as const) {
    const fx = bx + (w - bx) * u, top = y0 + depth * (1 - len) * 0.5, bot = top + depth * len;
    const [ax0] = S(fx, top), [ax1] = S(fx, bot);
    polygon(g, '#29322670', [[ax0, top], [ax0 + 4, top], [ax1 + 7, bot], [ax1 + 1, bot]]);
    polygon(g, '#45513f90', [[ax0 + 4, top + 2], [ax0 + 6, top + 2], [ax1 + 10, bot - 2], [ax1 + 7, bot - 2]]);
  }
  polygon(g, '#7e889d', [[bx - 1, y0 - 1], [bx + fw, y0 - 1], [bx + fw - sk, y1 + t + drop], [bx - 1 - sk, y1 + t + drop]]);
  line(g, '#b1b9ca', bx - 1, y0 - 1, -sk, depth + t + drop);
  line(g, '#1f261e', bx + fw, y0, -sk, depth + t + drop);

  // 창으로 드는 달빛: 모포 위에 창틀 모양 그대로 떨어진다
  const lx0 = wx - (y0 - sill) - 6, shift = sk + Math.round(depth * 0.4);
  polygon(g, '#b9cdf216', [[lx0, y0], [lx0 + ww, y0], [lx0 + ww - shift, y1], [lx0 - shift, y1]]);
  line(g, '#0a0f1a30', lx0 + ww / 2, y0, -shift, depth, 3);
  polygon(g, '#b9cdf20e', [[lx0 - shift, y1], [lx0 + ww - shift, y1], [lx0 + ww - shift - 2, y1 + t + drop], [lx0 - shift - 2, y1 + t + drop]]);

  // 침상 앞에 벗어 둔 삼선 슬리퍼 한 켤레
  {
    const sw = Math.max(10, Math.round(p * 0.13)), sy = yf + Math.max(5, Math.round(p * 0.09));
    for (const [dx, dy] of [[0, 0], [sw + 3, 2]]) {
      const sx = Math.round(nearL + p * 0.35 + dx), y = sy + dy;
      rect(g, '#05070c', sx + 1, y + 4, sw, 2);
      rect(g, '#1b2233', sx, y, sw, 5);
      rect(g, '#2b3550', sx + 1, y, sw - 2, 1);
      rect(g, '#283456', sx + 2, y - 2, Math.round(sw * 0.55), 4);
      for (let k = 0; k < 3; k++) rect(g, '#8b95ad', sx + 3 + k * 2, y - 2, 1, 4);
    }
  }

  // 앞쪽 머리맡 기둥 (베개 앞)
  rect(g, '#353d50', nearL - 1, y1 - hb, 3, yf - y1 + hb);
  rect(g, '#7a859c', nearL - 1, y1 - hb, 1, yf - y1 + hb);
  rect(g, '#5a6479', nearL - 2, y1 - hb - 1, 5, 2);
}
