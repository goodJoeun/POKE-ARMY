import { type Ink, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 거울 유리의 크기 (설계 칸). 유리 한가운데는 화면 가로 50%, 세로 32%: 거울 속 포켓몬(.mirror-frame)이 놓이는 자리다 */
const GLASS_W = 248, GLASS_H = 164;
/** 세면대 윗면이 벽과 만나는 줄 · 앞 모서리 · 바닥이 벽과 만나는 줄 (거울 한가운데에서 아래로) */
const COUNTER = 132, FRONT = 192, FLOOR = 318;
/** 세면기 사이의 간격 */
const PITCH = 300;

/**
 * 막사 세면장의 이른 아침 (고해상도). 김 서린 거울 앞에 서면 유리 속에 내 모습이 뜬다 (모습은 CSS로 따로 얹힌다).
 * 모든 것은 거울 한가운데를 원점으로 놓인다. 화면이 넓어지면 옆 세면기와 선반 · 온수기가 더 보일 뿐, 거울은 늘어나지 않는다.
 * 빛은 왼쪽 미늘창으로 드는 아침 햇살과 거울 위 형광등 두 가지다.
 */
export function washroomHd(g: Ink, w: number, h: number) {
  const rand = seeded(2831);
  const s = Math.min(h / 480, w / 420);
  const M = brush(g, Math.round(w / 2), Math.round(h * 0.32), s);
  const half = w / 2 / s, top = -h * 0.32 / s, bottom = h * 0.68 / s;
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(x, y, bw, bh); };

  // ── 벽 타일: 아래 두 줄은 짙은 청록 ──
  const T = Math.max(8, Math.round(32 * s));
  const tx0 = M.X(0) - (T >> 1), yb = M.Y(COUNTER), dado = yb - T * 2;
  fill('#7b9491', 0, 0, w, dado);
  fill('#4c6a6c', 0, dado, w, h - dado);
  for (let ty = yb - T, row = 0; ty > -T; ty -= T, row++) {
    for (let tx = tx0 - Math.ceil(tx0 / T) * T; tx < w; tx += T) {
      const low = row < 2, r = Math.floor(rand() * 3);
      fill(low ? ['#668787', '#628484', '#6a8a89'][r] : ['#9cafa8', '#a2b3aa', '#98aca6'][r], tx + 1, ty + 1, T - 1, T - 1);
      fill(low ? '#86a5a0' : '#cfd8c6', tx + 1, ty + 1, T - 1, 1);
      fill(low ? '#77979460' : '#bccabd90', tx + 1, ty + 2, 1, T - 2);
      fill(low ? '#56767780' : '#869c9890', tx + 1, ty + T - 1, T - 1, 1);
      fill(low ? '#56767760' : '#869c9870', tx + T - 1, ty + 1, 1, T - 1);
      // 유약에 비친 빛
      const gl = rand();
      if (gl > 0.55) {
        const n = Math.max(2, Math.round((3 + gl * 5) * s));
        for (let i = 0; i < n; i++) fill(low ? '#a9c4bc50' : '#eef2dc70', tx + 3 + n - i, ty + 3 + i, 1, 1);
      }
    }
  }
  // 띠 타일
  fill('#35555a', 0, dado - Math.round(3 * s), w, Math.max(3, Math.round(6 * s)));
  fill('#6f918f', 0, dado - Math.round(3 * s), w, 1);
  fill('#27444a', 0, dado - Math.round(3 * s) + Math.max(3, Math.round(6 * s)) - 1, w, 1);
  // 천장 쪽은 어둡고, 아래로 올수록 밝다
  const dim = g.createLinearGradient(0, 0, 0, yb);
  dim.addColorStop(0, '#1c383e80'); dim.addColorStop(0.5, '#1c383e1a'); dim.addColorStop(1, '#1c383e00');
  g.fillStyle = dim; g.fillRect(0, 0, w, yb);

  // ── 미늘창: 젖빛 유리 살마다 아침 빛이 걸린다 ──
  const winR = -152, winW = Math.max(50, Math.min(140, half - 160));
  const louver = (x1: number, bw: number) => {
    const y1 = -82, bh = 166;
    M.glow('#f2df9e3c', x1 + bw / 2, y1 + bh * 0.4, bw * 1.5 + 60);
    M.box('#3f5a6070', x1 + 3, y1 + 4, bw + 4, bh + 6);
    M.box('#5c7378', x1 - 3, y1 - 3, bw + 6, bh + 6);
    M.box('#c9cdb6', x1 - 1, y1 - 1, bw + 2, bh + 2);
    M.box('#ecedd4', x1 - 1, y1 - 1, bw + 2, 1.5); M.box('#ecedd4', x1 - 1, y1 - 1, 1.5, bh + 2);
    M.box('#8d9d92', x1 - 1, y1 + bh - 0.5, bw + 2, 1.5); M.box('#8d9d92', x1 + bw - 0.5, y1 - 1, 1.5, bh + 2);
    M.box('#46646e', x1 + 5, y1 + 5, bw - 10, bh - 10);
    M.fade(['#6f97a2', '#a9c4bd', '#dcdcb8'], x1 + 9, y1 + 6, bw - 18, bh - 12);
    for (let y = y1 + 7; y + 11 < y1 + bh - 6; y += 14) {
      M.box('#3c5a64', x1 + 9, y + 10, bw - 18, 2.4);
      M.box('#c7d6c2', x1 + 9, y, bw - 18, 10);
      M.box('#fbf6d6', x1 + 9, y, bw - 18, 2.4);
      M.box('#e3e6c8', x1 + 9, y + 2.4, bw - 18, 2.2);
      M.box('#9ab7b1', x1 + 9, y + 7.4, bw - 18, 2.6);
      for (let i = 0; i < bw / 16; i++) M.box('#ffffff50', x1 + 12 + rand() * (bw - 30), y + 3 + rand() * 4, 2 + rand() * 6, 1);
    }
    // 살을 잡는 옆 틀과 손잡이
    for (const x of [x1 + 5, x1 + bw - 9]) { M.box('#93a69d', x, y1 + 5, 4, bh - 10); M.box('#d5dac4', x, y1 + 5, 1, bh - 10); M.box('#5f787a', x + 3, y1 + 5, 1, bh - 10); }
    M.box('#5f787a', x1 + bw - 13, y1 + bh - 44, 3, 26);
    M.box('#d5dac4', x1 + bw - 16, y1 + bh - 24, 8, 7); M.box('#7d928f', x1 + bw - 16, y1 + bh - 18, 8, 1.4);
    // 창턱
    M.box('#dfe1ca', x1 - 7, y1 + bh + 3, bw + 14, 3);
    M.box('#8fa19a', x1 - 7, y1 + bh + 6, bw + 14, 3);
    M.box('#3f5a6070', x1 - 4, y1 + bh + 9, bw + 14, 3);
    // 벽을 비스듬히 쓸고 가는 햇살
    for (let i = 0; i < 4; i++) {
      const y = y1 + 14 + i * 38;
      M.poly('#f8e7b414', [[x1 + bw + 4, y], [x1 + bw + 4, y + 20], [x1 + bw + 150, y + 96], [x1 + bw + 150, y + 62]]);
    }
  };
  if (half > 520) louver(winR - winW - 190 - 140, 140);
  louver(winR - winW, winW);

  // ── 거울 위의 형광등 ──
  M.glow('#fff6d24a', 0, -106, 170);
  M.glow('#fff6d240', 0, -108, 70);
  M.box('#3f5a6070', -86, -112, 176, 9);
  M.box('#566d6e', -88, -120, 176, 12);
  M.box('#8ea19a', -88, -120, 176, 2);
  M.box('#d8d8b6', -78, -113, 156, 7);
  M.box('#fffbe0', -76, -112, 152, 4);
  M.box('#f0e9bb', -76, -108, 152, 1);
  for (const x of [-84, 78]) { M.box('#3f5658', x, -114, 6, 8); M.box('#a9b8ab', x, -114, 6, 1); }

  // ── 거울: 유리는 화면 한가운데(가로)와 세로 32%에 중심이 온다 ──
  const gx = -GLASS_W / 2, gy = -GLASS_H / 2;
  M.box('#2f4a5066', gx - 5, gy - 3, GLASS_W + 16, GLASS_H + 16);
  M.box('#4f6769', gx - 9, gy - 9, GLASS_W + 18, GLASS_H + 18);
  M.box('#c9cdb6', gx - 7, gy - 7, GLASS_W + 14, GLASS_H + 14);
  M.box('#f2f2da', gx - 7, gy - 7, GLASS_W + 14, 2); M.box('#e4e6ce', gx - 7, gy - 7, 2, GLASS_H + 14);
  M.box('#93a396', gx - 7, gy + GLASS_H + 5, GLASS_W + 14, 2); M.box('#a3b2a3', gx + GLASS_W + 5, gy - 7, 2, GLASS_H + 14);
  M.box('#4b6368', gx - 2, gy - 2, GLASS_W + 4, GLASS_H + 4);
  M.clip(gx, gy, GLASS_W, GLASS_H, () => {
    M.fade(['#a3c1b9', '#86a5a6', '#73939b', '#7f9ea0'], gx, gy, GLASS_W, GLASS_H);
    // 유리에 비친 맞은편: 타일 벽과 화장실 칸막이
    for (let x = gx + 14; x < -gx; x += 22) M.box('#5f828a30', x, gy, 1, 62);
    for (let y = gy + 18; y < gy + 62; y += 22) M.box('#5f828a30', gx, y, GLASS_W, 1);
    M.box('#6a8c9250', gx, gy + 62, GLASS_W, 3);
    for (let i = 0; i < 4; i++) {
      const x = gx + 6 + i * 62;
      M.box('#62858c66', x, gy + 70, 56, GLASS_H - 70);
      M.box('#7fa0a266', x, gy + 70, 56, 2);
      M.box('#55777f70', x + 54, gy + 70, 2, GLASS_H - 70);
      M.box('#a9c0b860', x + 44, gy + 118, 5, 2);
    }
    // 천장 등이 비친 줄
    M.box('#f1f4dc55', -92, gy + 9, 96, 3);
    M.box('#f1f4dc2c', -98, gy + 13, 108, 2);
    // 김: 가장자리로 갈수록 짙고, 얼굴이 오는 가운데는 옅다
    const fog = g.createRadialGradient(M.X(0), M.Y(4), 46 * s, M.X(0), M.Y(4), 168 * s);
    fog.addColorStop(0, '#dde8da10'); fog.addColorStop(0.55, '#dde8da66'); fog.addColorStop(1, '#e6eee0d8');
    g.fillStyle = fog;
    g.fillRect(M.X(gx), M.Y(gy), M.X(-gx) - M.X(gx), M.Y(-gy) - M.Y(gy));
    for (let i = 0; i < 340; i++) {
      const a = rand() * Math.PI * 2, r = 0.5 + rand() * 0.5;
      const x = Math.cos(a) * r * GLASS_W * 0.56, y = Math.sin(a) * r * GLASS_H * 0.6;
      M.box(i % 3 ? '#f3f7e85a' : '#5d808850', x, y, 1 + rand() * 2, 1);
    }
    // 물방울이 흘러내린 자국: 김이 걷힌 줄 끝에 방울이 맺혔다
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1, x = side * (GLASS_W / 2 - 5 - rand() ** 1.7 * 86), y = gy + 4 + rand() * (GLASS_H - 50), len = 8 + rand() ** 2 * 52;
      M.box('#5b7f8870', x, y, 1.4, len);
      M.box('#86a5a650', x + 1.4, y + 2, 1, len - 2);
      M.box('#f6f9ea', x - 0.4, y + len, 2.2, 2.2);
      M.box('#49707a', x - 0.4, y + len + 2.2, 2.2, 1);
    }
    for (let x = gx + 6; x < -gx; x += 7 + rand() * 12) {
      const len = 2 + rand() * 7;
      M.box('#f3f7e8b0', x, -gy - len, 1.6, len);
    }
    // 유리의 반사광
    M.poly('#ffffff1c', [[gx + 12, gy], [gx + 46, gy], [gx, gy + 62], [gx, gy + 18]]);
    M.poly('#ffffff12', [[gx + 62, gy], [gx + 74, gy], [gx, gy + 100], [gx, gy + 84]]);
    M.box('#ffffff30', gx, gy, GLASS_W, 1.5);
    M.box('#2f4a5038', gx, gy, 2.5, GLASS_H);
  });

  // ── 수건걸이 ──
  M.box('#3f5a6066', 164, -18, 40, 80);
  M.box('#586f70', 152, -26, 56, 5);
  M.box('#dfe3cd', 152, -26, 56, 1.6);
  for (const x of [152, 204]) { M.box('#445c5e', x, -29, 4, 10); M.box('#b9c6b6', x, -29, 1, 10); }
  M.box('#8da7a7', 159, -24, 40, 80);
  for (const [x, bw, c] of [[159, 5, '#b3c6ba'], [164, 7, '#9db5b0'], [171, 4, '#789497'], [175, 8, '#a5bcb5'], [183, 5, '#829d9f'], [188, 7, '#98b0ad'], [195, 4, '#6f8c90']] as [number, number, string][]) M.box(c, x, -22, bw, 78);
  M.box('#c5d2c2', 159, -24, 40, 3);
  M.box('#d9ddc6', 159, 42, 40, 3); M.box('#5f8087', 159, 46, 40, 2); M.box('#d9ddc6', 159, 49, 40, 1.4);
  M.box('#607d82', 159, 55, 40, 1.4);

  // ── 화면이 넓을 때: 세면바구니 선반과 알림판, 온수기 ──
  if (half > 380) {
    M.box('#3f5a6060', 240, 26, 144, 6);
    for (const x of [252, 362]) M.poly('#5f787a', [[x, 23], [x + 5, 23], [x, 36]]);
    for (const [x, c, d] of [[246, '#6f9aa8', '#527d8c'], [292, '#c08f86', '#9c6f69'], [338, '#8fae8a', '#6d8f6d']] as [number, string, string][]) {
      // 바구니에 꽂힌 것들
      M.box('#e9ecd9', x + 6, -12, 9, 22); M.box(d, x + 7, -16, 7, 5); M.box('#c1cbbd', x + 13, -12, 2, 22);
      M.box('#d8c98f', x + 19, -4, 7, 14); M.box('#f0e6b8', x + 19, -4, 2, 14); M.box('#5f787a', x + 20, -7, 5, 3);
      M.seg('#e9ecd9', x + 30, 8, x + 33, -13, 1.6); M.box(c, x + 31.5, -16, 3.4, 5);
      M.poly(c, [[x, 0], [x + 40, 0], [x + 37, 18], [x + 3, 18]]);
      M.poly(d, [[x + 30, 0], [x + 40, 0], [x + 37, 18], [x + 29, 18]]);
      M.box('#ffffff50', x, 0, 40, 1.6);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) M.box(d, x + 6 + i * 6, 5 + j * 6, 3, 3);
    }
    M.box('#e0e2cb', 236, 18, 148, 2);
    M.box('#aebcae', 236, 20, 148, 3);
    M.box('#6f8686', 236, 23, 148, 1);
    const pw = Math.max(27, Math.round(27 * s)), ph = Math.max(9, Math.round(9 * s)), px = M.X(310), py = M.Y(-62);
    fill('#3f5a6070', px - pw + 2, py - ph + 3, pw * 2, ph * 2);
    fill('#e6e8d2', px - pw, py - ph, pw * 2, ph * 2);
    fill('#4c7f96', px - pw, py - ph, pw * 2, 2);
    fill('#b3bfb0', px - pw, py + ph - 1, pw * 2, 1);
    pixelText(g, '물 절약', px, py + 1, '#3f6a80');
  }
  if (half > 560) {
    const x = 462;
    M.box('#3f5a6070', x + 5, -112, 96, 126);
    M.box('#cfd4c2', x, -118, 92, 124);
    M.box('#eef0dc', x, -118, 92, 2); M.box('#e3e6d0', x, -118, 3, 124);
    M.box('#a3b0a2', x + 80, -118, 12, 124); M.box('#8b9a90', x, 3, 92, 3);
    M.box('#b9c2b2', x + 10, -106, 62, 1); M.box('#b9c2b2', x + 10, -60, 62, 1);
    M.box('#4f676a', x + 30, -36, 34, 16); M.box('#2f4a4e', x + 32, -34, 18, 12);
    M.box('#e9a25e', x + 35, -30, 8, 3); M.box('#d8dcc8', x + 54, -32, 6, 6);
    for (const dx of [22, 62]) { M.box('#93a8a3', x + dx, 6, 6, COUNTER - 6); M.box('#d5dccb', x + dx, 6, 1.6, COUNTER - 6); M.box('#5f787a', x + dx - 2, 6, 10, 4); }
  }

  // ── 세면대 윗면 ──
  const cy = M.Y(COUNTER), fy = M.Y(FRONT);
  const topFill = g.createLinearGradient(0, cy, 0, fy);
  topFill.addColorStop(0, '#a3b5aa'); topFill.addColorStop(0.3, '#b9c8b8'); topFill.addColorStop(1, '#c7d2c0');
  g.fillStyle = topFill; g.fillRect(0, cy, w, fy - cy);
  for (let i = 0; i < w * 0.9; i++) fill(['#8da39c70', '#e6ead670', '#7f979460'][i % 3], Math.floor(rand() * w), cy + 2 + Math.floor(rand() * (fy - cy - 3)), 1 + (i % 5 ? 0 : 1), 1);
  fill('#4f696c', 0, cy - Math.max(1, Math.round(2 * s)), w, Math.max(2, Math.round(3 * s)));
  fill('#87a09b', 0, cy + Math.max(1, Math.round(1 * s)), w, Math.max(1, Math.round(2 * s)));
  // 앞 모서리와 앞판
  const lip = Math.max(2, Math.round(3 * s)), face = Math.max(5, Math.round(12 * s));
  fill('#eceedb', 0, fy, w, lip);
  fill('#9fb2a8', 0, fy + lip, w, face);
  fill('#b3c3b6', 0, fy + lip, w, 1);
  fill('#6c8584', 0, fy + lip + face - Math.max(1, Math.round(2 * s)), w, Math.max(1, Math.round(2 * s)));
  // 미늘창 빛이 윗면에 줄무늬로 떨어진다
  for (let i = 0; i < 5; i++) {
    const x = winR - winW + 16 + i * 22;
    M.poly('#fbeebb38', [[x, COUNTER + 3], [x + 12, COUNTER + 3], [x + 52, FRONT], [x + 34, FRONT]]);
  }

  // ── 세면대 아래: 그늘진 벽, 배관, 바닥 ──
  const under = fy + lip + face, floorY = M.Y(FLOOR);
  const shadeFill = g.createLinearGradient(0, under, 0, under + 70 * s);
  shadeFill.addColorStop(0, '#1f3539'); shadeFill.addColorStop(1, '#3a5458');
  g.fillStyle = shadeFill; g.fillRect(0, under, w, Math.max(0, floorY - under));
  for (let ty = under + T - ((under - yb) % T); ty < floorY; ty += T) fill('#2c464a', 0, ty, w, 1);
  for (let tx = tx0 - Math.ceil(tx0 / T) * T; tx < w; tx += T) fill('#2c464a', tx, under, 1, Math.max(0, floorY - under));
  if (floorY < h) {
    // 바닥 타일: 줄눈이 거울 쪽 소실점으로 모인다
    const vy = M.Y(FLOOR - 250), vx = M.X(0);
    fill('#48605f', 0, floorY, w, h - floorY);
    for (let y = floorY, d = Math.max(3, Math.round(12 * s)), row = 0; y < h; y += d, d = Math.round(d * 1.35) + 1, row++) {
      fill(row % 2 ? '#4d6665' : '#455d5d', 0, y, w, d);
      fill('#344c4e', 0, y, w, 1);
      fill('#5f7a7650', 0, y + 1, w, 1);
    }
    for (let y = floorY; y < h; y++) {
      const t = (y - vy) / (floorY - vy);
      for (let i = -24; i <= 24; i++) {
        const x = Math.round(vx + (i * 52 + 26) * s * t);
        if (x >= 0 && x < w) fill('#344c4e', x, y, 1, 1);
      }
    }
    for (let i = 0; i < 60; i++) {
      const y = floorY + 4 + rand() ** 1.4 * (h - floorY);
      fill('#86a39c38', Math.round(rand() * w), Math.round(y), Math.round((6 + rand() * 30) * s), 1);
    }
    fill('#22383c', 0, floorY - Math.max(2, Math.round(5 * s)), w, Math.max(2, Math.round(5 * s)));
    fill('#3d5759', 0, floorY - Math.max(2, Math.round(5 * s)), w, 1);
    // 배수구
    M.oval('#2b4245', 44, FLOOR + 44, 17, 5);
    M.oval('#9fb3aa', 44, FLOOR + 43, 15, 4.2);
    M.oval('#6f8885', 44, FLOOR + 43.6, 13, 3.4);
    for (const dx of [-8, -4, 0, 4, 8]) M.box('#2b4245', 44 + dx - 0.8, FLOOR + 41, 1.6, 5);
    // 세숫대야
    M.oval('#1f353966', -104, FLOOR + 66, 46, 8);
    M.poly('#8e4f4b', [[-146, FLOOR + 38], [-62, FLOOR + 38], [-72, FLOOR + 64], [-136, FLOOR + 64]]);
    M.poly('#a9645c', [[-146, FLOOR + 38], [-126, FLOOR + 38], [-120, FLOOR + 64], [-136, FLOOR + 64]]);
    M.oval('#c98478', -104, FLOOR + 38, 43, 9);
    M.oval('#7f4543', -104, FLOOR + 39, 38, 6.6);
    M.oval('#9a5852', -104, FLOOR + 41, 30, 4);
    M.oval('#e8b5a4', -104, FLOOR + 38, 43, 9, (dx, dy) => dx * dx + dy * dy > 0.8 && dy < -0.2 && dx < 0.1);
    // 삼선 슬리퍼 한 켤레
    for (const [x, y] of [[104, FLOOR + 62], [146, FLOOR + 70]]) {
      M.oval('#1f353970', x + 2, y + 6, 20, 4);
      M.oval('#1c2a38', x, y + 3, 19, 6.5);
      M.oval('#2f4254', x, y + 1.4, 18, 5.6);
      M.poly('#22364c', [[x - 15, y - 1], [x + 3, y - 9], [x + 12, y - 5], [x - 3, y + 4]]);
      M.poly('#3b5672', [[x - 15, y - 1], [x + 3, y - 9], [x + 5, y - 8], [x - 13, y]]);
      for (const k of [0, 1, 2]) M.seg('#e3e8dc', x - 9 + k * 4.4, y + 0.6, x + 3 + k * 4.4, y - 6.6, 1.2);
    }
  }
  // 받침 다리
  for (let n = -3; n <= 2; n++) {
    const x = n * PITCH + PITCH / 2;
    if (Math.abs(x) > half + 10) continue;
    M.box('#1b2f33', x - 6, FRONT + 15, 12, FLOOR - FRONT - 15);
    M.box('#3c575a', x - 6, FRONT + 15, 2.4, FLOOR - FRONT - 15);
    M.box('#14262a', x + 6, FRONT + 15, 5, FLOOR - FRONT - 15);
  }

  // ── 세면기 · 수도꼭지 · 배관 ──
  for (let n = -2; n <= 2; n++) {
    if (Math.abs(n) * PITCH - 96 > half) continue;
    const B = brush(g, M.X(n * PITCH), M.Y(0), s);
    // 아래 배관: 트랩과 급수 밸브
    B.box('#58726f', -4, FRONT + 15, 8, 40); B.box('#b5c6ba', -3, FRONT + 15, 2, 40);
    B.box('#58726f', -4, FRONT + 47, 28, 8); B.box('#9fb4ab', -4, FRONT + 48, 28, 2);
    B.box('#58726f', 16, FRONT + 30, 8, 25); B.box('#b5c6ba', 17, FRONT + 30, 2, 24);
    B.box('#3f5859', -6, FRONT + 26, 12, 4); B.box('#8ea49d', -6, FRONT + 26, 12, 1);
    B.box('#7f9792', 12, FRONT + 26, 16, 5); B.box('#c3d0c0', 12, FRONT + 26, 16, 1);
    for (const dx of [-34, 40]) {
      B.box('#4d6767', dx, FRONT + 15, 2, 50);
      B.box('#7f9792', dx - 3, FRONT + 62, 8, 9); B.box('#c3d0c0', dx - 3, FRONT + 62, 2, 9);
      B.box(dx < 0 ? '#b0695a' : '#5f8fae', dx - 5, FRONT + 58, 12, 4);
    }
    // 세면기: 윗면에 박힌 흰 도기
    B.oval('#8ea39c', 0, 166.5, 88, 26);
    B.oval('#f1f2e2', 0, 164, 86, 25);
    B.oval('#c9d2c2', 0, 164, 86, 25, (_dx, dy) => dy > 0.62);
    B.oval('#667f82', 0, 165, 77, 19.5);
    B.oval('#8aa2a0', 0, 167, 74, 17.5);
    B.oval('#a9bdb6', 0, 169.5, 68, 14.5);
    B.oval('#c6d3c6', 4, 173, 46, 8.5);
    B.oval('#ffffff', 0, 164, 86, 25, (dx, dy) => dx < -0.42 && dy < -0.1 && dx * dx + dy * dy > 0.87);
    B.box('#4a6367', -5, 151, 10, 2.4); B.box('#9fb3aa', -5, 153.4, 10, 1);
    B.oval('#566f72', 0, 171, 7, 3);
    B.oval('#dfe5d3', 0, 170.4, 5.4, 2.1);
    B.oval('#3d5659', 0, 170.6, 3, 1.1);
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, r = 0.25 + rand() * 0.6;
      B.box('#eef3e4', Math.cos(a) * r * 66, 169 + Math.sin(a) * r * 13, 1.6, 1);
    }
    // 수도꼭지: 왼쪽 창 빛을 받는 크롬
    B.oval('#4f696c70', 10, 139, 22, 3.4);
    B.box('#4a6468', -8, 133, 16, 5); B.box('#e3e8d4', -8, 133, 16, 1.4); B.box('#8ea49d', -8, 134.4, 6, 3.6);
    B.box('#4f696c', -5, 102, 10, 31); B.box('#93aaa5', -4, 102, 5, 31); B.box('#f3f5df', -3.4, 104, 1.6, 28);
    B.box('#4f696c', -5, 98, 27, 8); B.box('#93aaa5', -4, 99, 25, 4); B.box('#f3f5df', -3, 99, 23, 1.4);
    B.box('#4f696c', 13, 104, 9, 13); B.box('#93aaa5', 14, 104, 4, 12); B.box('#dfe6d2', 14.4, 106, 1.4, 9);
    B.box('#3c5557', 12, 116, 11, 3.4); B.box('#a9bdb2', 12, 116, 11, 1);
    for (const dx of [-30, 32]) {
      B.oval('#4f696c70', dx + 4, 138.4, 9, 2);
      B.box('#4a6468', dx - 5, 134, 10, 4); B.box('#dfe6d2', dx - 5, 134, 10, 1);
      B.box('#5d777a', dx - 3, 124, 6, 10); B.box('#b4c6bb', dx - 2, 124, 2, 10);
      B.box('#4a6468', dx - 8, 119, 16, 5.4); B.box('#e3e8d4', dx - 8, 119, 16, 1.6); B.box('#a3b7ae', dx - 8, 120.6, 16, 1.6);
      B.box(dx < 0 ? '#c2705c' : '#5f93b6', dx - 2, 116.6, 4, 2.4);
    }
    if (n === 0) B.box('#eef4e6', 17, 123, 1.6, 3.4);

    // 윗면에 놓인 것들
    if (n === 0) {
      // 비눗갑과 비누
      B.oval('#6f888670', 112, 157, 20, 3.4);
      B.poly('#7fa39f', [[94, 147], [130, 147], [126, 156], [98, 156]]);
      B.box('#a9c7bf', 94, 146, 36, 2);
      B.poly('#eadfc6', [[100, 139], [124, 139], [126, 146], [98, 146]]);
      B.box('#fbf3dc', 100, 139, 24, 2); B.box('#cdbfa3', 98, 145, 28, 1.4);
      // 양치컵과 칫솔
      B.oval('#6f888670', -110, 158, 13, 2.6);
      B.seg('#e9ecd9', -112, 140, -119, 112, 1.8); B.box('#5f93b6', -121.4, 108, 4, 7);
      B.seg('#e9ecd9', -106, 140, -102, 115, 1.8); B.box('#c2705c', -103.6, 111, 4, 7);
      B.poly('#7c9fb0', [[-120, 133], [-100, 133], [-102, 157], [-118, 157]]);
      B.poly('#a9c6cf', [[-120, 133], [-115, 133], [-114, 157], [-118, 157]]);
      B.box('#cfe0de', -120, 132, 20, 2);
      B.box('#5d8194', -104, 135, 2.4, 22);
    } else if (n === 1) {
      // 개어 둔 수건
      B.oval('#6f888670', -118, 160, 30, 3.4);
      B.box('#c9cfbd', -144, 146, 52, 12); B.box('#e9ecd9', -144, 146, 52, 2.4); B.box('#a3b1a5', -144, 152, 52, 1.2);
      B.box('#93a399', -144, 156, 52, 2); B.box('#b0796c', -100, 146, 3, 12);
    } else if (n === -1) {
      // 치약과 면도기
      B.oval('#6f888670', 116, 158, 26, 2.6);
      B.poly('#e6e9d6', [[96, 150], [132, 147], [133, 155], [96, 156]]);
      B.box('#c2705c', 132, 148, 6, 7); B.box('#5f93b6', 104, 150, 14, 4);
      B.seg('#56707a', 140, 160, 158, 148, 2); B.box('#aebfb6', 155, 143, 8, 4);
    }
  }

  vignette(g, w, h, '#122226', 0.3);
}
