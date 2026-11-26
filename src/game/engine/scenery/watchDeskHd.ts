import { type Ink, type Point, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 자정 무렵 지휘통제실의 당직 책상 (고해상도): 근무 신고를 하며 펼쳐 둔 근무 일지를 내려다본다.
 * 책상 안쪽 모서리(벽과 만나는 줄)는 화면 높이의 55%. 그 위 벽에 상황판(지도와 근무표) · 시계 · 서류철 선반,
 * 책상 위에 근무 일지와 켜진 스탠드, 넘겨받을 ㄱ자 손전등, 야전 전화기, 머그컵.
 * 불빛은 스탠드 하나라 오른쪽이 따뜻하고 왼쪽으로 갈수록 어둡다.
 * 모두 책상 안쪽 모서리 한가운데를 원점으로 붙어 있어서, 화면이 넓어지면 블라인드 친 창과 열쇠함이 더 보일 뿐이다.
 */
export function watchDeskHd(g: Ink, w: number, h: number) {
  const rand = seeded(1470);
  const s = Math.min(h / 480, w / 420);
  const cx = Math.round(w / 2), deskY = Math.round(h * 0.55);
  const D = brush(g, cx, deskY, s); // 원점 = 책상 안쪽 모서리 한가운데
  const HZ = 150; // 책상 안쪽 모서리에서 눈높이까지 (설계 칸)
  /** 책상 면 위의 점: x는 안쪽 모서리에서 잰 가로 위치, k는 앞으로 나올수록 커지는 배율 */
  const at = (x: number, k: number, lift = 0): Point => [x * k, HZ * (k - 1) - lift * k];
  const kEnd = 1 + (h - deskY) / s / HZ + 0.05;
  const half = w / 2 / s; // 화면 반폭 (설계 칸)
  const LX = 150, LK = 1.1; // 스탠드 받침이 놓인 곳

  // ── 벽 ──
  const wall = g.createLinearGradient(0, 0, 0, deskY);
  wall.addColorStop(0, '#0f1a21'); wall.addColorStop(0.7, '#22323a'); wall.addColorStop(1, '#1d2b31');
  g.fillStyle = wall; g.fillRect(0, 0, w, deskY);
  for (let i = 0; i < w * 0.5; i++) {
    g.fillStyle = i % 2 ? '#ffffff06' : '#0000000f';
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * deskY), 1 + Math.floor(rand() * 3), 1);
  }
  const RAIL = -46;
  D.fade(['#1d2a30', '#172328'], -half - 2, RAIL, half * 2 + 4, -RAIL);
  D.box('#3f5155', -half - 2, RAIL, half * 2 + 4, 1.5);
  D.box('#121c21', -half - 2, RAIL + 1.5, half * 2 + 4, 1);
  // 세로로 긴 화면: 천장과 꺼진 형광등이 보인다
  const CEIL = -330;
  if (D.Y(CEIL) > 6) {
    const ceil = (x: number, k: number): Point => [x * k, -HZ + (CEIL + HZ) * k];
    const kTop = (deskY / s - HZ) / -(CEIL + HZ) + 0.05;
    g.fillStyle = '#0b1217'; g.fillRect(0, 0, w, D.Y(CEIL));
    for (let k = 1.12; k < kTop; k *= 1.12) D.box('#151f25', -half * 2, ceil(0, k)[1], half * 4, 1 / s);
    for (let x = -half - 40; x < half + 40; x += 50) D.seg('#151f25', x, CEIL, ...ceil(x, kTop), 1 / s);
    D.box('#26343a', -half - 2, CEIL, half * 2 + 4, 3);
    D.box('#40525650', -half - 2, CEIL + 3, half * 2 + 4, 1);
    const ka = 1.3, kb = 1.42;
    if (kb < kTop) {
      D.poly('#1b262c', [ceil(-56, ka), ceil(56, ka), ceil(56, kb), ceil(-56, kb)]);
      D.poly('#2a383e', [ceil(-52, ka + 0.01), ceil(52, ka + 0.01), ceil(52, kb - 0.01), ceil(-52, kb - 0.01)]);
      for (const t of [0.3, 0.7]) D.poly('#3d4e53', [ceil(-50, ka + (kb - ka) * (t - 0.1)), ceil(50, ka + (kb - ka) * (t - 0.1)), ceil(50, ka + (kb - ka) * (t + 0.1)), ceil(-50, ka + (kb - ka) * (t + 0.1))]);
      D.poly('#e0b87030', [ceil(-56, ka), ceil(56, ka), ceil(56, ka + 0.012), ceil(-56, ka + 0.012)]);
    }
  }
  // 스탠드 불빛이 벽에 번진다
  D.glow('#f0c27c2c', LX - 30, -90, 230);
  D.glow('#f0c27c20', LX - 40, -40, 120);

  // ── 왼쪽 빈 벽에 블라인드 친 창 (자리가 있을 때만) ──
  const winX = -Math.max(300, Math.min(half * 0.72, 470));
  if (D.X(winX - 64) > 0) {
    const Wn = brush(g, D.X(winX), deskY, s);
    Wn.box('#0a1116', -62, -196, 124, 140);
    Wn.box('#34474d', -58, -192, 116, 132);
    Wn.box('#566b6c', -58, -192, 116, 1.5);
    Wn.box('#141f25', -52, -186, 104, 120);
    for (let y = -186; y < -66; y += 6) {
      Wn.box('#2e3f46', -52, y, 104, 4.5);
      Wn.box('#45585c', -52, y, 104, 1);
      Wn.box('#8fb2c418', -52, y + 4.5, 104, 1.5); // 날개 사이로 새는 달빛
    }
    Wn.box('#1d2a30', -20, -186, 1, 120); Wn.box('#1d2a30', 20, -186, 1, 120);
    Wn.box('#3b4d52', -62, -60, 124, 4); Wn.box('#6d8080', -62, -60, 124, 1);
    Wn.box('#8a9a98', 46, -186, 1, 70); Wn.box('#b3a689', 45, -116, 3, 5);
  }

  // ── 상황판: 왼쪽은 지형도, 오른쪽은 근무표 (좁은 화면에서는 화면 안으로 조금 밀어 넣는다) ──
  const BL = -214, BR = 92, BT = -190, BB = -56;
  const bx0 = cx + Math.round(Math.max(0, 8 - half - (BL - 6)) * s);
  {
    const D = brush(g, bx0, deskY, s);
    D.box('#0a111788', BL - 3, BT + 3, BR - BL + 6, BB - BT + 6);
    D.box('#1c262a', BL - 6, BT - 6, BR - BL + 12, BB - BT + 12);
    D.box('#6c7a74', BL - 6, BT - 6, BR - BL + 12, 1.5);
    D.box('#8d9a8c', BR + 4.5, BT - 6, 1.5, BB - BT + 12);
    D.box('#4a5652', BL - 6, BT - 4.5, 1.5, BB - BT + 9);
    D.box('#2c3a3b', BL, BT, BR - BL, BB - BT);
    D.box('#00000040', BL, BT, BR - BL, 3);
    // 현판
    D.box('#0a111788', -82, BT - 23, 64, 16);
    D.box('#2a2f31', -84, BT - 25, 64, 16);
    D.box('#8f8466', -84, BT - 25, 64, 1);
    D.box('#5f573f', -84, BT - 10, 64, 1);
    pixelText(g, '상 황 판', D.X(-52), Math.round((D.Y(BT - 24) + D.Y(BT - 10)) / 2), '#d5c79c');
    D.box('#151c1f', -54, BT - 9, 1.5, 3); D.box('#151c1f', -50, BT - 9, 1.5, 3);

    // 지형도: 높이 함수의 등고선을 한 픽셀씩 찍는다
    const ML = BL + 6, MR = -6, MT = BT + 6, MB = BB - 6;
    const hill = (x: number, y: number) =>
      1.15 * Math.exp(-(((x + 160) / 34) ** 2 + ((y + 160) / 26) ** 2))
      + 0.9 * Math.exp(-(((x + 52) / 40) ** 2 + ((y + 86) / 30) ** 2))
      + 0.55 * Math.exp(-(((x + 118) / 22) ** 2 + ((y + 80) / 18) ** 2))
      + 0.35 * Math.exp(-(((x + 20) / 30) ** 2 + ((y + 168) / 20) ** 2))
      + 0.04 * Math.sin(x / 7 + y / 11);
    D.fade(['#73846f', '#68796a'], ML, MT, MR - ML, MB - MT);
    {
      const x0 = D.X(ML), x1 = D.X(MR), y0 = D.Y(MT), y1 = D.Y(MB);
      const lv = (i: number, j: number) => Math.floor(hill((i + 0.5 - bx0) / s, (j + 0.5 - deskY) / s) * 9);
      const thin: number[] = [], bold: number[] = [];
      let prev = new Array(x1 - x0 + 1).fill(0).map((_, k) => lv(x0 + k, y0 - 1));
      for (let j = y0; j < y1; j++) {
        const row = new Array(x1 - x0 + 1);
        for (let i = x0; i <= x1; i++) row[i - x0] = lv(i, j);
        for (let i = x0; i < x1; i++) {
          const a = row[i - x0];
          if (a !== row[i - x0 + 1] || a !== prev[i - x0]) (Math.max(a, row[i - x0 + 1], prev[i - x0]) % 4 === 0 ? bold : thin).push(i, j);
        }
        prev = row;
      }
      g.fillStyle = '#5b6e5e'; for (let i = 0; i < thin.length; i += 2) g.fillRect(thin[i], thin[i + 1], 1, 1);
      g.fillStyle = '#485c4e'; for (let i = 0; i < bold.length; i += 2) g.fillRect(bold[i], bold[i + 1], 1, 1);
    }
    D.clip(ML, MT, MR - ML, MB - MT, () => {
      // 격자 (방안)
      for (let x = ML + 24; x < MR; x += 30) D.box('#4f63564a', x, MT, 1 / s, MB - MT);
      for (let y = MT + 20; y < MB; y += 30) D.box('#4f63564a', ML, y, MR - ML, 1 / s);
      // 골짜기를 따라 흐르는 개울과 도로
      let last: Point | null = null;
      for (let y = MT - 4; y <= MB + 4; y += 3) {
        const t = (y - MT) / (MB - MT), x = -88 - 30 * t + 7 * Math.sin(y / 9);
        if (last) { D.seg('#3d5b5e', last[0], last[1] + 0.6, x, y + 0.6, 2.2); D.seg('#97b8b4', last[0], last[1], x, y, 1.6); }
        last = [x, y];
      }
      for (let x = ML - 4, i = 0; x < MR; x += 4, i++) {
        const y = -112 + 18 * Math.sin((x + 200) / 40) + (x + 120) * 0.12;
        if (i % 3 !== 2) D.box('#a6865e', x, y, 3, 1.4);
      }
      // 부대 위치와 초소: 파란 부대 표지, 빨간 압정, 붉은 그리스 연필로 그린 동그라미
      for (const [x, y] of [[-150, -100], [-64, -152], [-36, -96]] as const) {
        D.box('#1f2f45', x - 6, y - 4, 12, 8); D.box('#d9dfe0', x - 5, y - 3, 10, 6);
        D.seg('#2f4f86', x - 5, y - 3, x + 5, y + 3, 1); D.seg('#2f4f86', x - 5, y + 3, x + 5, y - 3, 1);
      }
      for (const [x, y] of [[-118, -138], [-176, -78], [-28, -128]] as const) {
        D.box('#00000040', x - 1, y + 1, 4, 4);
        D.oval('#b04a3e', x + 1, y + 1, 2.4, 2.4); D.box('#f0b2a0', x, y, 1, 1);
      }
      D.oval('#b8483c', -98, -112, 15, 11, (dx, dy) => dx * dx + dy * dy > 0.78 && Math.atan2(dy, dx) > -2.6);
      D.seg('#b8483c', -80, -122, -66, -134, 1.2); D.seg('#b8483c', -66, -134, -71, -133, 1.2); D.seg('#b8483c', -66, -134, -67, -129, 1.2);
      // 코팅된 지도에 비친 스탠드 빛
      D.poly('#fff2d012', [[MR - 60, MT], [MR - 36, MT], [MR - 94, MB], [MR - 118, MB]]);
      D.poly('#fff2d00c', [[MR - 28, MT], [MR - 20, MT], [MR - 78, MB], [MR - 86, MB]]);
    });
    // 왼쪽(어두운 쪽)으로 갈수록 그늘
    {
      const sh = g.createLinearGradient(D.X(BL), 0, D.X(BR), 0);
      sh.addColorStop(0, '#05090c70'); sh.addColorStop(0.6, '#05090c18'); sh.addColorStop(1, '#05090c00');
      g.fillStyle = sh; g.fillRect(D.X(BL), D.Y(MT), D.X(MR) - D.X(BL), D.Y(MB) - D.Y(MT));
    }
    // 근무표: 끼워 넣은 종이
    const RL = 4, RT = BT + 8, RW = BR - 6 - RL, RH = BB - 8 - RT;
    D.box('#0a0c0e50', RL - 2, RT + 2, RW, RH);
    D.box('#aaa992', RL, RT, RW, RH);
    D.box('#c6c4aa', RL, RT, RW, 1); D.box('#c6c4aa', RL + RW - 1, RT, 1, RH);
    pixelText(g, '근무표', D.X(RL + RW / 2), D.Y(RT + 3) + 7, '#3d4644');
    const gy = (D.Y(RT + 3) + 15 - deskY) / s;
    D.box('#5f706b', RL + 4, gy, RW - 8, 5);
    const rows = 9, rh = (RT + RH - 5 - gy - 5) / rows;
    for (let r = 0; r <= rows; r++) D.box('#7d826f50', RL + 4, gy + 5 + r * rh, RW - 8, 0.8);
    for (const u of [0, 0.36, 0.7, 1]) D.box('#7d826f50', RL + 4 + (RW - 8) * u - (u === 1 ? 0.8 : 0), gy + 5, 0.8, rows * rh);
    for (let r = 0; r < rows; r++) {
      const y = gy + 5 + r * rh + rh / 2 - 0.6;
      D.box('#5d6460', RL + 7, y, 6 + (r % 3) * 2, 1.2);
      if (r < 6) { D.box('#5d6460', RL + 6 + (RW - 8) * 0.36, y, 8 + rand() * 7, 1.2); D.box('#6a706a', RL + 6 + (RW - 8) * 0.7, y, 5 + rand() * 5, 1.2); }
    }
    // 오늘 밤: 내 이름이 들어갈 칸에 자석
    D.box('#c8a24a50', RL + 4.5, gy + 5 + 6 * rh + 0.8, RW - 9, rh - 1);
    D.oval('#00000040', RL + RW - 9, gy + 5 + 6 * rh + rh / 2 + 1, 3, 3);
    D.oval('#c84a3c', RL + RW - 10, gy + 5 + 6 * rh + rh / 2, 3, 3); D.box('#f2a898', RL + RW - 11, gy + 5 + 6 * rh + rh / 2 - 1.5, 1, 1);
  }

  // ── 시계: 자정을 조금 넘겼다 ──
  const CX = 172, CY = -168;
  D.oval('#0a111788', CX - 2, CY + 2, 18, 18);
  D.oval('#2b3134', CX, CY, 18, 18);
  D.oval('#5f6a6a', CX, CY, 18, 18, (dx, dy) => dx * dx + dy * dy > 0.82 && dx + dy < -0.2);
  D.oval('#c9c6b2', CX, CY, 14.5, 14.5);
  D.oval('#e3dfc8', CX, CY, 14.5, 14.5, (dx, dy) => dx > 0.1 && dy > -0.5);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = i % 3 ? 12 : 11;
    D.box('#3a3f3e', CX + Math.sin(a) * r - 0.6, CY - Math.cos(a) * r - 0.6, i % 3 ? 1.2 : 2, i % 3 ? 1.2 : 2);
  }
  D.seg('#262a2a', CX, CY, CX + Math.sin(0.06) * 7.5, CY - Math.cos(0.06) * 7.5, 1.8);
  D.seg('#262a2a', CX, CY, CX + Math.sin(1.15) * 11, CY - Math.cos(1.15) * 11, 1.2);
  D.seg('#b8483c', CX, CY, CX + Math.sin(3.6) * 11, CY - Math.cos(3.6) * 11, 0.8);
  D.oval('#262a2a', CX, CY, 1.4, 1.4);

  // ── 서류철 선반 ──
  const SL = 104, SR = Math.min(372, half + 16), SY = -58;
  for (let x = SL + 2; x < SR - 6;) {
    const bw = 9 + Math.floor(rand() * 4), bh = 30 + Math.floor(rand() * 9), lean = rand() > 0.9 && x > SL + 30;
    const c = ['#3d4f50', '#574c4c', '#4a5846', '#3e4858', '#5a5848'][Math.floor(rand() * 5)];
    if (lean) {
      D.poly(c, [[x, SY], [x + bw, SY], [x + bw + 9, SY - bh + 1], [x + 9, SY - bh - 1]]);
      D.seg('#ffffff1c', x, SY, x + 9, SY - bh - 1, 1);
      x += bw + 10;
      continue;
    }
    D.box(c, x, SY - bh, bw, bh);
    D.box('#ffffff1a', x, SY - bh, 1, bh);
    D.box('#0000003a', x + bw - 1, SY - bh, 1, bh);
    D.box('#b3b29c', x + 2, SY - bh + 5, bw - 4, 8);
    D.box('#6e705f', x + 3, SY - bh + 7, bw - 6, 1); D.box('#6e705f', x + 3, SY - bh + 10, bw - 7, 1);
    D.oval('#151c1f', x + bw / 2, SY - 9, 1.8, 2.4);
    x += bw + 1;
  }
  D.box('#5f625a', SL - 4, SY, SR - SL + 8, 3);
  D.box('#9a9c8c', SL - 4, SY, SR - SL + 8, 1);
  D.box('#2a2e2c', SL - 4, SY + 3, SR - SL + 8, 1.5);
  for (const x of [SL + 10, SR - 16]) D.poly('#3a3e3a', [[x, SY + 4], [x + 6, SY + 4], [x, SY + 14]]);

  // ── 넓은 화면: 오른쪽에 열쇠함 ──
  if (D.X(470) < w) {
    const K = brush(g, D.X(432), deskY, s);
    K.box('#0a111788', -24, -164, 48, 66);
    K.box('#3d4440', -27, -168, 50, 66);
    K.box('#6c736b', -27, -168, 50, 1.5);
    K.box('#262b28', -23, -162, 42, 54);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = -19 + c * 10, y = -158 + r * 17;
      K.box('#8d8f84', x, y, 2, 2);
      if ((r * 4 + c) % 5 !== 3) { K.seg('#b09a5e', x + 1, y + 2, x + 1, y + 8, 1); K.oval('#c7b072', x + 1, y + 10, 2, 2.6); K.box('#d0c8a0', x - 1, y + 13, 4, 3); }
    }
    K.box('#b8b39c', -12, -106, 24, 4);
  }

  // ── 책상 ──
  g.fillStyle = '#614e40'; g.fillRect(0, deskY, w, h - deskY);
  // 나뭇결: 가로로 흐르고, 앞으로 올수록 굵다
  for (let i = 0; i < w * 0.9; i++) {
    const k = 1 + rand() ** 1.2 * (kEnd - 1), x = (rand() * 2 - 1) * half / k * 1.1;
    const [sx, sy] = at(x, k);
    D.box(i % 3 === 0 ? '#3e322c40' : i % 3 === 1 ? '#7a64503a' : '#4a3c3448', sx, sy, (12 + rand() * 50) * k, 1 / s);
  }
  for (const k of [1.32, 1.9]) D.box('#3a2e2830', -half, HZ * (k - 1), half * 2, 1 / s);
  // 앞으로 올수록 스탠드에서 멀어 어둡다
  {
    const fall = g.createLinearGradient(0, deskY, 0, h);
    fall.addColorStop(0, '#0a0d1000'); fall.addColorStop(1, '#0a0d1070');
    g.fillStyle = fall; g.fillRect(0, deskY, w, h - deskY);
  }
  // 벽과 만나는 안쪽 모서리
  D.box('#120f0e', -half - 2, -1, half * 2 + 4, 2);
  D.box('#8a7360', -half - 2, 1, half * 2 + 4, 1 / s);

  // 스탠드 불빛이 책상에 고인다 (타원)
  const pool = (x: number, k: number, r: number, c: string) => {
    const [px, py] = at(x, k), X = D.X(px), Y = D.Y(py), rr = r * s;
    const gr = g.createRadialGradient(X, Y, 0, X, Y, rr);
    gr.addColorStop(0, c); gr.addColorStop(1, c.slice(0, 7) + '00');
    g.save(); g.translate(0, Y); g.scale(1, 0.38); g.translate(0, -Y);
    g.fillStyle = gr; g.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
    g.restore();
  };
  pool(50, 1.3, 280, '#f4c27a44');
  pool(66, 1.26, 140, '#ffd9944c');

  // ── 책상 매트: 초록 펠트 위에 유리 ──
  const mat = (x0: number, x1: number, k0: number, k1: number, c: string) => D.poly(c, [at(x0, k0), at(x1, k0), at(x1, k1), at(x0, k1)]);
  mat(-118, 104, 1.04, 1.66, '#1a2723');
  mat(-116, 102, 1.045, 1.65, '#2b3f37');
  mat(-116, 102, 1.045, 1.052, '#5d766a70');
  mat(102 - 1.2, 102, 1.045, 1.65, '#8fae9c50');
  pool(66, 1.26, 110, '#ffd99428');
  D.poly('#ffffff0a', [at(-20, 1.045), at(8, 1.045), at(-40, 1.65), at(-68, 1.65)]);

  // ── 야전 전화기 (왼쪽 뒤) ──
  {
    const k = 1.06, [px, py] = at(-178, k);
    const T = brush(g, D.X(px), D.Y(py), s * k);
    T.poly('#0b0d0e80', [[-2, 2], [44, 2], [52, 8], [6, 8]]);
    T.box('#3e4636', 0, -24, 44, 26);
    T.box('#56604a', 0, -24, 44, 1.5);
    T.box('#2c3328', 36, -24, 8, 26);
    T.poly('#4a5341', [[0, -24], [44, -24], [40, -30], [4, -30]]);
    T.box('#69725a', 4, -30, 36, 1);
    // 수화기
    T.box('#1b1f1c', 2, -36, 40, 5);
    T.oval('#1b1f1c', 4, -33, 5, 4); T.oval('#1b1f1c', 40, -33, 5, 4);
    T.box('#40463e', 2, -36, 40, 1);
    T.box('#7d6a4c', 10, -16, 12, 6); T.box('#26291f', 26, -16, 6, 6);
    T.seg('#1b1f1c', 44, -10, 52, -4, 1.4); T.seg('#1b1f1c', 52, -4, 58, -6, 1.4);
  }

  // ── 근무 일지 ──
  const K0 = 1.12, K1 = 1.5, PW = 86;
  const lift = (x: number) => 7 * Math.exp(-((x / 13) ** 2)) + 1.5 * Math.exp(-((x / 40) ** 2));
  // 일지가 드리운 그림자 (스탠드는 오른쪽 뒤)
  D.poly('#0b0a0a60', [at(-PW - 6, K0 + 0.03), at(PW - 10, K0 + 0.03), at(PW - 14, K1 + 0.04), at(-PW - 16, K1 + 0.04)]);
  // 겉표지
  D.poly('#22302e', [at(-PW - 3, K0 - 0.012), at(PW + 3, K0 - 0.012), at(PW + 3, K1 + 0.018), at(-PW - 3, K1 + 0.018)]);
  D.poly('#34463f', [at(-PW - 3, K1 + 0.006), at(PW + 3, K1 + 0.006), at(PW + 3, K1 + 0.018), at(-PW - 3, K1 + 0.018)]);
  /** 한 쪽 면: x0~x1 (안쪽 끝이 들린다) */
  const page = (x0: number, x1: number, paper: string, edge: string) => {
    const n = 24, pts: Point[] = [];
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push(at(x, K0, lift(x))); }
    for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; pts.push(at(x, K1, lift(x))); }
    // 책 배: 종이 뭉치의 앞면이 겉표지까지 이어진다 (책등 쪽은 들린 만큼 두껍다)
    const face: Point[] = [];
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; face.push(at(x, K1, lift(x))); }
    for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; face.push(at(x, K1, 0.6)); }
    D.poly(edge, face);
    for (let j = 1; j < 9; j++) {
      D.ridge('#9a8f77', Math.min(x0, x1) * K1, Math.max(x0, x1) * K1, (x) => HZ * (K1 - 1) - Math.max(0.6, lift(x / K1) - j * 1.1) * K1, (x) => HZ * (K1 - 1) - Math.max(0.6, lift(x / K1) - j * 1.1) * K1 + (lift(x / K1) - j * 1.1 > 0.6 ? 1 / s : 0));
    }
    D.poly(paper, pts);
  };
  page(-PW, -1, '#cdbf9f', '#a9a084');
  page(1, PW, '#dccdab', '#b3a98c');
  /** 쪽 위의 가로줄: 깊이 k, x0~x1 */
  const rule = (c: string, x0: number, x1: number, k: number, up = 0) =>
    D.ridge(c, x0 * k, x1 * k, (x) => HZ * (k - 1) - (lift(x / k) + up) * k, (x) => HZ * (k - 1) - (lift(x / k) + up) * k + 1 / s);
  const LINES = 13;
  for (let i = 1; i < LINES; i++) {
    const k = K0 + (K1 - K0) * i / LINES;
    rule('#a49a80', -PW + 4, -4, k);
    rule('#b0a586', 4, PW - 4, k);
  }
  for (const x of [-PW + 18, -36, 18, 50]) D.seg('#a99f86', ...at(x, K0 + 0.02, lift(x)), ...at(x, K1 - 0.01, lift(x)), 1 / s);
  rule('#7f775f', -PW + 4, -4, K0 + (K1 - K0) / LINES, 0.4);
  rule('#857c64', 4, PW - 4, K0 + (K1 - K0) / LINES, 0.4);
  // 손글씨: 왼쪽 쪽은 지난 근무자들 이름으로 가득, 오른쪽은 몇 줄뿐 (다음 줄이 내 차례)
  /** 손글씨: 짧은 획들이 위아래로 조금씩 흔들리며 이어진다 */
  const scrawl = (x0: number, len: number, k: number, c: string) => {
    let x = x0;
    while (x < x0 + len) {
      const n = 1.5 + rand() * 4.5, y = 1.2 + (rand() - 0.5) * 1.4;
      rule(c, x, Math.min(x + n, x0 + len), k, y);
      if (rand() > 0.6) rule(c, x + n * 0.4, x + n * 0.4 + 1 / s, k, y + 1);
      x += n + (rand() > 0.7 ? 2.5 : 0.8);
    }
  };
  for (let i = 1; i < LINES; i++) {
    const k = K0 + (K1 - K0) * (i + 0.5) / LINES;
    if (i < LINES - 1) {
      scrawl(-PW + 6, 7 + rand() * 4, k, '#5a5850');
      scrawl(-PW + 21, 10 + rand() * 14, k, '#4f5157');
      if (rand() > 0.25) scrawl(-33, 10 + rand() * 16, k, '#4c5466');
    }
    if (i < 6) {
      scrawl(6, 7 + rand() * 4, k, '#5a5850');
      scrawl(21, 10 + rand() * 12, k, '#4f5157');
      scrawl(53, 10 + rand() * 12, k, '#4c5466');
    }
  }
  // 내 차례 줄: 막 쓰기 시작한 이름 한 획
  rule('#2a3348', 21, 26, K0 + (K1 - K0) * 6.5 / LINES, 1.2);
  rule('#2a3348', 23, 23 + 1 / s, K0 + (K1 - K0) * 6.5 / LINES, 2.2);
  // 가름끈: 책등에서 앞으로 흘러내린다
  D.seg('#7e2f30', ...at(0.5, K1, 0.6), ...at(-3, K1 + 0.1, 0), 1.8);
  D.seg('#a8494a', ...at(0, K1, 0.6), ...at(-3.5, K1 + 0.1, 0), 0.7);

  // 볼펜: 오른쪽 쪽 위에 비스듬히, 그림자와 함께
  {
    const a = at(28, K0 + 0.2, 0.5), b = at(70, K0 + 0.27, 0.5);
    D.seg('#00000038', a[0] - 3, a[1] + 3, b[0] - 3, b[1] + 3, 2.2);
    D.seg('#2b3446', a[0], a[1], b[0], b[1], 2.4);
    D.seg('#58647c', a[0], a[1] - 0.8, b[0], b[1] - 0.8, 0.8);
    D.seg('#c9ccd2', b[0] - 4, b[1] - 0.3, b[0], b[1], 2.4);
    D.seg('#1a1e26', a[0] - 3, a[1] - 0.3, a[0], a[1], 1.2);
    D.seg('#c9ccd2', b[0] - 9, b[1] - 1.6, b[0] - 2, b[1] - 1.2, 0.8);
  }

  // ── ㄱ자 손전등 (넘겨받을 것) ──
  {
    // 몸통은 옆으로 눕고, 꺾인 머리는 이쪽을 향해 둥근 렌즈가 보인다
    const k = 1.4, [px, py] = at(Math.max(-150, (52 - half) / k), k);
    const F = brush(g, D.X(px), D.Y(py), s * k);
    F.poly('#0b0a0a70', [[-30, 3], [8, -3], [12, 4], [-28, 9]]);
    F.poly('#2c382b', [[-32, -2], [6, -9], [8, -1], [-30, 5]]);
    F.poly('#4a5b47', [[-32, -2], [6, -9], [6.4, -7.4], [-31.6, -0.4]]);
    F.poly('#1d261d', [[-30.6, 3.2], [7.6, -2.8], [8, -1], [-30, 5]]);
    for (const x of [-24, -20, -16]) F.seg('#1b231b', x, -3.6 - (x + 32) * 0.18, x + 1, 2.8 - (x + 32) * 0.18, 0.8);
    F.box('#6a705e', -34, -2.5, 3, 7); F.box('#8c9080', -34, -2.5, 1, 7);
    F.seg('#7d8574', -8, -7, 2, -9, 1.2); F.box('#151b15', -4, -10, 4, 2);
    // 머리
    F.poly('#2c382b', [[4, -14], [18, -16], [20, 2], [6, 4]]);
    F.poly('#4a5b47', [[4, -14], [18, -16], [16, -19], [3, -17]]);
    F.oval('#151b15', 12, -5, 6.2, 7);
    F.oval('#6f725c', 12, -5, 5, 5.8);
    F.oval('#c9c5a4', 12, -5, 3.6, 4.4);
    F.oval('#f2efd8', 10.6, -6.6, 1.2, 1.4);
  }

  // ── 머그컵 ──
  {
    const k = 1.08, [px, py] = at(98, k);
    const M = brush(g, D.X(px), D.Y(py), s * k);
    M.oval('#0b0a0a50', -3, 1, 10, 3);
    M.box('#7b8890', -7, -18, 14, 18);
    M.box('#a9b4b8', -7, -18, 4, 18);
    M.box('#5b666e', 4, -18, 3, 18);
    M.oval('#3a2a22', 0, -18, 7, 2.2);
    M.oval('#c4ccce', 0, -18, 7, 2.2, (dx, dy) => dx * dx + dy * dy > 0.6 && dy < 0);
    M.box('#7b8890', -11, -14, 4, 2); M.box('#7b8890', -11, -14, 2, 9); M.box('#7b8890', -11, -7, 4, 2);
    M.box('#a3423c', -3, -12, 6, 5); M.box('#e1d6b0', -2, -11, 4, 1);
  }

  // ── 스탠드: 받침 · 두 마디 팔 · 갓, 갓 아래로 쏟아지는 빛 ──
  {
    const [bx, by] = at(LX, LK);
    const L = brush(g, D.X(bx), D.Y(by), s * LK);
    const head: Point = [-56, -88], elbow: Point = [14, -66];
    L.oval('#0b0a0a60', -4, 2, 22, 5);
    L.oval('#262b2a', 0, -1, 17, 5);
    L.oval('#4c5654', 0, -2.5, 15, 3.6);
    L.oval('#7c8784', -5, -3.5, 6, 1.2);
    L.box('#262b2a', -3, -12, 6, 10);
    L.seg('#2f3836', 0, -10, elbow[0], elbow[1], 3);
    L.seg('#8c9590', -1.5, -10, elbow[0] - 1.5, elbow[1], 1);
    L.seg('#2f3836', elbow[0], elbow[1], head[0] + 10, head[1] + 2, 3);
    L.seg('#8c9590', elbow[0], elbow[1] - 1.5, head[0] + 10, head[1] + 0.5, 1);
    L.oval('#1d2221', elbow[0], elbow[1], 3.6, 3.6); L.oval('#8c9590', elbow[0] - 1, elbow[1] - 1, 1.2, 1.2);
    L.seg('#596360', 4, -30, elbow[0] + 2, elbow[1] + 10, 0.8);
    // 빛 기둥
    L.poly('#ffd99414', [[head[0] - 20, head[1] + 12], [head[0] + 18, head[1] + 6], [head[0] + 60, 0], [head[0] - 70, 4]]);
    L.glow('#ffe3a070', head[0] - 2, head[1] + 12, 34);
    // 갓
    L.poly('#33403d', [[head[0] - 4, head[1] - 12], [head[0] + 12, head[1] - 4], [head[0] + 18, head[1] + 7], [head[0] - 21, head[1] + 13]]);
    L.poly('#4e5e58', [[head[0] - 4, head[1] - 12], [head[0] + 12, head[1] - 4], [head[0] + 9, head[1] - 1], [head[0] - 7, head[1] - 9]]);
    L.seg('#6f817a', head[0] - 4, head[1] - 12, head[0] - 20, head[1] + 11, 1);
    L.poly('#ffe8b0', [[head[0] - 21, head[1] + 13], [head[0] + 18, head[1] + 7], [head[0] + 17, head[1] + 9.5], [head[0] - 19, head[1] + 15]]);
    L.poly('#fff6da', [[head[0] - 12, head[1] + 12], [head[0] + 8, head[1] + 9], [head[0] + 7, head[1] + 10.5], [head[0] - 11, head[1] + 13.5]]);
    L.box('#1d2221', head[0] + 6, head[1] - 8, 6, 4);
  }

  // 왼쪽 앞은 어둠에 잠긴다
  {
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, '#05080b88'); side.addColorStop(0.45, '#05080b20'); side.addColorStop(0.75, '#05080b00');
    g.fillStyle = side; g.fillRect(0, 0, w, h);
  }

  vignette(g, w, h, '#04060a', 0.55);
}
