import { type Ink, type Point, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 소등 뒤의 2층 복도 (고해상도). 비상구 유도등 하나가 게시판을 비춘다.
 * 게시판 윗변은 화면 높이의 37%에 고정돼 있다. 그 위의 빈 벽(높이 21~42%, 가운데 폭의 절반 남짓)은
 * 공지문에서 떠오른 안농 글자들이 한 줄로 늘어서는 자리라, 어둡고 잔잔하게 비워 둔다.
 * 왼쪽은 생활관 문이 늘어선 옆 복도, 오른쪽은 유도등이 걸린 계단실 문. 모두 게시판 윗변 한가운데를 원점으로 붙어 있어서
 * 화면이 넓어지면 옆 복도의 문과 소화전이 더 보일 뿐, 게시판이 늘어나지 않는다.
 */
export function patrolBoardHd(g: Ink, w: number, h: number) {
  const rand = seeded(2205);
  const s = Math.min(h / 480, w / 420);
  const cx = Math.round(w / 2), top = Math.round(h * 0.37);
  const B = brush(g, cx, top, s); // 원점 = 게시판 윗변 한가운데
  const FLOOR = 172, EYE = 52, CEIL = -165; // 게시판 윗변에서 잰 바닥 · 눈높이 · 천장 (설계 칸)
  const LW = 238, ZB = 400; // 소실점에서 옆 복도 벽까지, 눈에서 안쪽 벽까지
  const vy = top + EYE * s;
  const kAt = (d: number) => ZB / (ZB - d); // 안쪽 벽에서 d칸 앞으로 나온 곳의 배율
  const at = (x: number, y: number, k: number): Point => [x * k, EYE + (y - EYE) * k];
  const floorY = B.Y(FLOOR);

  // ── 천장: 텍스 판의 줄눈과 꺼진 형광등 (세로로 긴 화면에서만 보인다) ──
  g.fillStyle = '#0d151b'; g.fillRect(0, 0, w, B.Y(CEIL));
  const kTop = (EYE + top / s) / (EYE - CEIL) + 0.05;
  if (kTop > 1.1) {
    const ceil = (x: number, k: number): Point => [x * k, EYE + (CEIL - EYE) * k];
    for (let d = 60; kAt(d) < kTop; d += 60) {
      const k = kAt(d);
      B.box('#18232a', -LW * k, ceil(0, k)[1], (LW + w / s) * k, 1 / s);
    }
    for (let x = -LW + 58; x < w / s; x += 60) B.seg('#18232a', x, CEIL, ...ceil(x, kTop), 1 / s);
    // 가로로 걸린 형광등 갓: 아랫면과 두 줄의 꺼진 관, 유도등 쪽 모서리만 초록빛
    const ka = kAt(96), kb = kAt(126);
    if (kb < kTop) {
      B.poly('#1b262c', [ceil(-50, ka), ceil(50, ka), ceil(50, kb), ceil(-50, kb)]);
      B.poly('#28363c', [ceil(-46, kAt(99)), ceil(46, kAt(99)), ceil(46, kAt(123)), ceil(-46, kAt(123))]);
      B.poly('#3d4e53', [ceil(-44, kAt(103)), ceil(44, kAt(103)), ceil(44, kAt(107)), ceil(-44, kAt(107))]);
      B.poly('#3d4e53', [ceil(-44, kAt(115)), ceil(44, kAt(115)), ceil(44, kAt(119)), ceil(-44, kAt(119))]);
      B.poly('#6fa58a38', [ceil(-50, ka), ceil(50, ka), ceil(50, kAt(98)), ceil(-50, kAt(98))]);
    }
  }

  // ── 안쪽 벽 (두 가지 색으로 칠한 벽) ──
  const wall = g.createLinearGradient(0, B.Y(CEIL), 0, floorY);
  wall.addColorStop(0, '#1a272e'); wall.addColorStop(0.55, '#2c3d44'); wall.addColorStop(1, '#25353b');
  g.fillStyle = wall; g.fillRect(0, B.Y(CEIL), w, floorY - B.Y(CEIL));
  const dado = 114;
  B.fade(['#22343a', '#1c2b31'], -w / s, dado, w * 2 / s, FLOOR - dado);
  for (let i = 0; i < w * 0.5; i++) {
    g.fillStyle = i % 2 ? '#ffffff06' : '#0000000f';
    g.fillRect(Math.floor(rand() * w), B.Y(CEIL) + Math.floor(rand() * (floorY - B.Y(CEIL))), 1 + Math.floor(rand() * 3), 1);
  }
  B.box('#4a5d60', -w / s, dado, w * 2 / s, 1.5);
  B.box('#15222a', -w / s, dado + 1.5, w * 2 / s, 1);
  B.box('#1a272d', -w / s, FLOOR - 8, w * 2 / s, 8);
  B.box('#3b4c50', -w / s, FLOOR - 8, w * 2 / s, 1);
  B.box('#0b1318', -w / s, CEIL, w * 2 / s, 2);
  // 천장 밑을 지나는 전선관
  B.box('#1b2930', -w / s, CEIL + 14, w * 2 / s, 5);
  B.box('#3c4d53', -w / s, CEIL + 14, w * 2 / s, 1);
  B.box('#0e171c', -w / s, CEIL + 19, w * 2 / s, 1);
  for (let x = -LW + 40; x * s < w / 2 + 40; x += 120) { B.box('#2a3a40', x, CEIL + 12, 4, 9); B.box('#4d5f64', x, CEIL + 12, 1, 9); }

  // ── 유도등의 초록 불빛이 벽에 번진다 ──
  const EX = Math.min(262, w / 2 / s - 30), EY = -114; // 좁은 화면에서도 유도등은 다 보이게
  B.glow('#78d6a224', EX, EY, 300);
  B.glow('#8fe6b438', EX, EY, 90);

  // ── 바닥: 왁스 칠한 타일, 소실점으로 모인다 ──
  g.fillStyle = '#1d2a31'; g.fillRect(0, floorY, w, h - floorY);
  const kEnd = ((h - top) / s - EYE) / (FLOOR - EYE) + 0.1, TILE = 60;
  const cols = Math.ceil(w / s / TILE) + 2;
  for (let r = 0, d = 0; d < ZB - 20 && kAt(d) < kEnd; r++, d += TILE) {
    const ka = kAt(d), kb = Math.min(kEnd, kAt(d + TILE));
    for (let i = -Math.ceil(LW / TILE); i < cols; i++) {
      const x0 = Math.max(-LW, i * TILE), x1 = (i + 1) * TILE;
      if (x1 <= -LW) continue;
      B.poly((i + r) % 2 ? '#24333b' : '#202e35', [at(x0, FLOOR, ka), at(x1, FLOOR, ka), at(x1, FLOOR, kb), at(x0, FLOOR, kb)]);
    }
    B.box('#141e24', -LW * ka, EYE + (FLOOR - EYE) * ka, (LW + cols * TILE) * ka, 1 / s);
    B.box('#3a4a5038', -LW * ka, EYE + (FLOOR - EYE) * ka + 1 / s, (LW + cols * TILE) * ka, 1 / s);
  }
  for (let i = -Math.floor(LW / TILE); i < cols; i++) B.seg('#141e24', i * TILE, FLOOR, i * TILE * kEnd, EYE + (FLOOR - EYE) * kEnd, 1 / s);
  // 왁스 결: 가로로 끌린 옅은 자국
  for (let i = 0; i < w / 6; i++) {
    const k = 1 + rand() ** 1.3 * (kEnd - 1), x = (rand() * 2 - 1) * w / s / 2 / k;
    B.box(i % 3 ? '#5b6d7414' : '#0f181d22', x * k, EYE + (FLOOR - EYE) * k, (6 + rand() * 26) * k, 1 / s);
  }
  // 유도등과 문의 반사: 바닥에 길게 내려 비친다
  const R0 = FLOOR + 2, R1 = FLOOR + 74;
  B.fade(['#8fe6b430', '#8fe6b400'], EX - 18, R0, 36, R1 - R0);
  B.fade(['#d8f5e040', '#d8f5e000'], EX - 6, R0, 12, (R1 - R0) * 0.7);
  for (let y = R0 + 3; y < R1; y += 5 + rand() * 6) B.box('#a5e6c020', EX - 14 + rand() * 6, y, 14 + rand() * 12, 1 / s);
  B.fade(['#c9c3a612', '#c9c3a600'], -150, R0, 300, 40);
  B.box('#0d151a', -w / s, FLOOR, w * 2 / s, 1.5);

  // ── 계단실 방화문과 그 위의 유도등 ──
  const DL = 214, DR = 306, DT = -90;
  B.box('#111b20', DL - 8, DT - 8, DR - DL + 16, FLOOR - DT + 8);
  B.box('#40525a', DL - 6, DT - 6, DR - DL + 12, FLOOR - DT + 6);
  B.box('#7d9590', DL - 6, DT - 6, DR - DL + 12, 1.5);
  B.box('#5f7774', DL - 6, DT - 6, 1.5, FLOOR - DT + 6);
  B.box('#29383e', DL, DT, DR - DL, FLOOR - DT);
  B.fade(['#3f574f', '#2e3f45', '#263439'], DL, DT, DR - DL, 130);
  B.box('#1f2d33', DR - 6, DT, 6, FLOOR - DT);
  B.box('#4f6862', DL, DT, 1.5, FLOOR - DT);
  // 좁은 철망 유리창
  B.box('#121c22', DL + 16, DT + 22, 18, 66);
  B.fade(['#3f5c5a', '#1f3036'], DL + 17, DT + 23, 16, 64);
  for (let y = DT + 27; y < DT + 88; y += 6) B.box('#5e7c7640', DL + 17, y, 16, 0.6);
  for (let x = DL + 21; x < DL + 33; x += 6) B.box('#5e7c7640', x, DT + 23, 0.6, 64);
  B.poly('#b8e8cc22', [[DL + 17, DT + 30], [DL + 28, DT + 23], [DL + 33, DT + 23], [DL + 17, DT + 40]]);
  // 도어 클로저 · 손잡이 · 발차기판
  B.box('#1b282e', DL + 50, DT + 4, 34, 6); B.box('#6c8580', DL + 50, DT + 4, 34, 1);
  B.seg('#1b282e', DL + 54, DT + 10, DL + 70, DT + 18, 2);
  B.box('#1b282e', DL + 12, 70, 70, 5); B.box('#8fa59c', DL + 12, 70, 70, 1);
  B.box('#16232a', DL + 76, 66, 6, 14);
  B.box('#24343b', DL + 4, FLOOR - 24, DR - DL - 10, 22); B.box('#3f5258', DL + 4, FLOOR - 24, DR - DL - 10, 1);
  // 유도등: 달리는 사람과 화살표
  B.box('#0d171b', EX - 25, EY - 12, 50, 26);
  B.box('#284038', EX - 24, EY - 11, 48, 24);
  B.box('#7fd6a6', EX - 21, EY - 8, 42, 18);
  B.box('#c2f2d6', EX - 21, EY - 8, 42, 1);
  const P = brush(g, B.X(EX - 10), B.Y(EY + 1), s);
  P.oval('#f2fff6', 1, -6, 1.8, 1.8);
  P.seg('#f2fff6', 0, -4, -2, 1, 1.6);
  P.seg('#f2fff6', -2, 1, 2, 6, 1.4); P.seg('#f2fff6', -2, 1, -6, 5, 1.4);
  P.seg('#f2fff6', 0, -3, 4, -1, 1.2); P.seg('#f2fff6', 0, -3, -4, 0, 1.2);
  P.box('#2f6a4c', 6, -6, 1.5, 13); P.box('#2f6a4c', 6, -6, 8, 1.5); P.box('#2f6a4c', 12.5, -6, 1.5, 13);
  B.box('#f2fff6', EX + 8, EY, 9, 2);
  B.poly('#f2fff6', [[EX + 16, EY - 3], [EX + 20, EY + 1], [EX + 16, EY + 5]]);
  B.box('#0d171b', EX - 2, EY - 19, 4, 7);

  // ── 소화전 (넓은 화면에서만) ──
  if (B.X(430) < w) {
    const F = brush(g, B.X(388), B.Y(0), s);
    F.box('#0d151a88', -34, 34, 72, 116);
    F.box('#3d2a2c', -36, 30, 72, 116);
    F.box('#6c4344', -36, 30, 72, 1.5);
    F.box('#55383a', -36, 30, 1.5, 116);
    F.box('#2c1f22', -30, 38, 60, 58);
    F.box('#4c3437', -30, 38, 60, 1);
    F.oval('#5d3a3a', 0, 66, 16, 16); F.oval('#2c1f22', 0, 66, 9, 9); F.oval('#7a5050', -4, 60, 4, 3);
    F.box('#9b8e82', -22, 104, 44, 12);
    F.box('#2c1f22', -16, 108, 32, 1); F.box('#2c1f22', -12, 111, 24, 1);
    F.box('#866', -2, 124, 4, 10);
  }

  // ── 순찰함: 게시판 왼쪽, 순찰 때 서명하는 작은 철함 ──
  const pbx = -204;
  B.box('#0b131888', pbx - 16, 26, 28, 38);
  B.box('#3c4d52', pbx - 13, 22, 26, 38);
  B.box('#6a7f80', pbx - 13, 22, 26, 1.5);
  B.box('#28363c', pbx - 13, 58, 26, 2);
  B.box('#56696b', pbx - 9, 28, 18, 3);
  B.box('#9aa89c', pbx - 6, 36, 12, 8); B.box('#6d7a72', pbx - 4, 39, 8, 1); B.box('#6d7a72', pbx - 4, 41, 6, 1);
  B.seg('#1b262b', pbx + 11, 50, pbx + 16, 74, 0.8);
  B.box('#6d7f84', pbx + 14, 74, 3, 12); B.box('#a4b0aa', pbx + 14, 74, 1, 12);

  // ── 게시판 ──
  const BL = -168, BR = 168, BB = 104;
  B.box('#0a111666', BL - 4, 4, BR - BL + 4, BB + 4);
  B.box('#2a3438', BL - 6, -6, BR - BL + 12, BB + 12);
  B.box('#7f8b86', BL - 6, -6, BR - BL + 12, 1.5);
  B.box('#9fb2a6', BR + 4.5, -6, 1.5, BB + 12);
  B.box('#56625f', BL - 6, -4.5, 1.5, BB + 9);
  B.box('#151d21', BL - 6, BB + 4.5, BR - BL + 12, 1.5);
  // 코르크: 밤이라 어둡고, 유도등 쪽이 조금 밝다
  B.clip(BL, 0, BR - BL, BB, () => {
    B.fade(['#463c35', '#3d342e'], BL, 0, BR - BL, BB);
    const warm = g.createLinearGradient(B.X(BL), 0, B.X(BR), 0);
    warm.addColorStop(0, '#0a0d1050'); warm.addColorStop(0.6, '#0a0d1000'); warm.addColorStop(1, '#7fd6a612');
    g.fillStyle = warm; g.fillRect(B.X(BL), B.Y(0), B.X(BR) - B.X(BL), B.Y(BB) - B.Y(0));
    for (let i = 0; i < (BR - BL) * BB * s * s / 9; i++) {
      g.fillStyle = ['#5a4d4230', '#2b241f40', '#6a5b4c24'][i % 3];
      g.fillRect(B.X(BL + rand() * (BR - BL)), B.Y(rand() * BB), 1 + (i % 4 === 0 ? 1 : 0), 1);
    }
    // 틀이 코르크에 드리운 그림자 (빛은 오른쪽 위에서)
    B.box('#0000002c', BL, 0, BR - BL, 4);
    B.box('#0000002c', BR - 3, 0, 3, BB);
  });

  /** 압정으로 꽂은 종이: 오른쪽 위에서 빛이 와서 그림자는 왼쪽 아래로 */
  const sheet = (x: number, y: number, sw: number, sh: number, paper: string, lit: string, pin: string) => {
    B.box('#0a0c0e55', x - 3, y + 3, sw, sh);
    B.box(paper, x, y, sw, sh);
    B.box(lit, x, y, sw, 1);
    B.box(lit, x + sw - 1, y, 1, sh);
    B.poly('#00000030', [[x + sw - 7, y + sh], [x + sw, y + sh - 7], [x + sw, y + sh]]);
    B.poly(lit, [[x + sw - 7, y + sh], [x + sw - 7, y + sh - 7], [x + sw, y + sh - 7]]);
    B.box('#00000030', x + sw / 2 - 3.5, y + 2, 4, 3);
    B.oval(pin, x + sw / 2, y + 1.5, 2.4, 2.4);
    B.box('#ffffff60', x + sw / 2, y, 1, 1);
  };
  const ink = (x: number, y: number, len: number, c = '#59615f') => B.box(c, x, y, len, 1.2);

  // ① 순찰 근무표
  const RX = -156, RY = 12, RW = 72, RH = 82;
  sheet(RX, RY, RW, RH, '#a6ab9e', '#c3c8b8', '#b4473f');
  pixelText(g, '근무표', B.X(RX + RW / 2), B.Y(RY + 4) + 7, '#3f4a4c');
  const gy = (B.Y(RY + 4) + 15 - top) / s;
  B.box('#5d7173', RX + 5, gy, RW - 10, 6);
  for (let c = 1; c < 4; c++) B.box('#cfd3c4', RX + 5 + (RW - 10) * [0.3, 0.55, 0.78][c - 1], gy + 1, 1, 4);
  const rows = 7, rh = (RY + RH - 6 - gy - 6) / rows;
  for (let r = 0; r <= rows; r++) B.box('#79858244', RX + 5, gy + 6 + r * rh, RW - 10, 0.8);
  for (const u of [0, 0.3, 0.55, 0.78, 1]) B.box('#79858244', RX + 5 + (RW - 10) * u - (u === 1 ? 0.8 : 0), gy + 6, 0.8, rows * rh);
  for (let r = 0; r < rows; r++) {
    const y = gy + 6 + r * rh + rh / 2 - 0.6;
    ink(RX + 8, y, 9 + rand() * 5);
    for (const u of [0.3, 0.55, 0.78]) if (r < 5 || rand() > 0.5) ink(RX + 8 + (RW - 10) * u, y, 4 + rand() * 6, '#646c69');
  }
  // 오늘 밤 줄: 내 이름 칸에 빨간 표시
  B.box('#c4544a40', RX + 5.5, gy + 6 + 5 * rh + 0.8, RW - 11, rh - 1);
  B.box('#b4473f', RX + RW - 12, gy + 6 + 5 * rh + rh / 2 - 2, 4, 1.2);
  B.box('#b4473f', RX + RW - 9, gy + 6 + 5 * rh + rh / 2 - 3.5, 1.2, 4);

  // ② 떼어 간 자리: 덜 바랜 코르크, 빈 압정 구멍, 압정에 걸린 종이 귀퉁이
  B.box('#53483e', -76, 14, 32, 34);
  B.box('#5e5246', -76, 14, 32, 1);
  for (const [x, y] of [[-73, 18], [-47, 19], [-74, 44], [-52, 60], [-64, 74]]) B.box('#1e1915', x, y, 1, 1);
  B.poly('#b1ad98', [[-62, 14], [-54, 14], [-58, 21]]);
  B.oval('#3f78a6', -58, 15.5, 2.2, 2.2);

  // ③ 공지문: 본문 줄에 여섯 군데 빈칸 (안농이 빠져나간 자리)
  const NX = -34, NY = 6, NW = 98, NH = 92;
  sheet(NX, NY, NW, NH, '#c6c2aa', '#dcd8c0', '#3f78a6');
  pixelText(g, '공지사항', B.X(NX + NW / 2), B.Y(NY + 4) + 7, '#3a4244');
  const ty = (B.Y(NY + 4) + 15 - top) / s;
  B.box('#7a8a86', NX + 10, ty, NW - 20, 1);
  const holes = new Set(['1,1', '2,3', '4,0', '5,2', '7,1', '8,3']);
  for (let r = 0; r < 10; r++) {
    const y = ty + 5 + r * ((NY + NH - 14 - ty) / 10);
    if (y > NY + NH - 12) break;
    let x = NX + 8;
    for (let c = 0; c < 4; c++) {
      const len = r === 9 && c > 1 ? 0 : 10 + ((r * 7 + c * 5) % 9);
      if (!len) break;
      if (holes.has(`${r},${c}`)) {
        // 글자가 있던 자리: 잉크 대신 아주 옅은 얼룩만
        B.box('#b5b19a', x + 1, y - 1.5, 6, 4);
        x += 9;
      } else {
        ink(x, y, Math.min(len, NX + NW - 8 - x), '#6c716c');
        x += len + 3;
      }
      if (x > NX + NW - 12) break;
    }
  }
  // 직인 (네모난 빨간 도장)
  const SX = NX + NW - 24, SY = NY + NH - 19;
  B.box('#a8473f90', SX, SY, 11, 11);
  B.box('#c6c2aa', SX + 1.5, SY + 1.5, 8, 8);
  B.box('#a8473f90', SX + 3, SY + 3, 2, 5); B.box('#a8473f90', SX + 6, SY + 3, 2, 2); B.box('#a8473f90', SX + 6, SY + 6, 2, 2);
  ink(SX - 30, SY + 5, 22, '#6c716c');

  // ④ 점호 시간 메모 (푸른 종이)
  sheet(74, 22, 46, 46, '#8f9ea0', '#aebec0', '#d8b04a');
  B.box('#5f7579', 79, 30, 36, 4);
  for (let i = 0; i < 4; i++) ink(79, 39 + i * 6, 18 + (i * 11) % 15, '#56676a');
  B.box('#56676a', 103, 58, 10, 2.5);

  // ⑤ 포스트잇
  B.box('#0a0c0e55', 125, 59, 26, 25);
  B.box('#a39c63', 128, 56, 26, 25);
  B.box('#c5be80', 128, 56, 26, 1.5);
  B.box('#8e8752', 128, 56, 26, 4);
  ink(132, 66, 16, '#5e5a3c'); ink(132, 71, 11, '#5e5a3c');

  // ⑥ 오른쪽 아래 구석의 작은 안내문
  sheet(128, 18, 30, 30, '#a3a89a', '#bcc2b2', '#b4473f');
  B.box('#56695f', 132, 24, 22, 8);
  B.poly('#c3d0bf', [[137, 31], [143, 25], [149, 31]]);
  ink(132, 36, 22); ink(132, 40, 16);

  // ── 옆 복도: 생활관 문들이 원근으로 늘어선다 ──
  const kLeft = cx / (LW * s);
  if (kLeft > 1) {
    const lx = (k: number) => Math.round(cx - LW * k * s);
    /** 옆벽 위의 네모: 깊이 배율 ka~kb, 높이 ya~yb (원점 기준 설계 칸). yb를 생략하면 1픽셀 선 */
    const side = (c: string, ka: number, kb: number, ya: number, yb?: number) => {
      g.fillStyle = c;
      for (let i = Math.max(0, lx(kb)); i < lx(ka); i++) {
        const k = (cx - i - 0.5) / (LW * s), y0 = Math.round(vy + (ya - EYE) * k * s);
        const y1 = yb === undefined ? y0 + 1 : Math.round(vy + (yb - EYE) * k * s);
        if (y1 > y0) g.fillRect(i, y0, 1, y1 - y0);
      }
    };
    const kFar = kLeft + 0.01;
    side('#22333a', 1, kFar, CEIL, dado);
    side('#1a282e', 1, kFar, dado, FLOOR);
    side('#405457', 1, kFar, dado); side('#11191e', 1, kFar, dado + 1.5);
    side('#151f25', 1, kFar, FLOOR - 8, FLOOR);
    side('#33444a', 1, kFar, FLOOR - 8);
    side('#18252b', 1, kFar, CEIL + 14, CEIL + 20);
    side('#384a50', 1, kFar, CEIL + 14);
    // 앞쪽으로 올수록 유도등에서 멀어 어둡다
    const x0 = lx(1);
    const shade = g.createLinearGradient(x0, 0, 0, 0);
    shade.addColorStop(0, '#05090c10'); shade.addColorStop(1, '#05090c90');
    g.fillStyle = shade; g.fillRect(0, 0, x0, h);
    for (const [d0, label] of [[26, 1], [196, 2]] as const) {
      const ka = kAt(d0), kb = kAt(d0 + 96), kf0 = kAt(d0 - 6), kf1 = kAt(d0 + 102);
      if (ka > kFar) continue;
      side('#0f181d', kf0, kf1, DT - 8, FLOOR);
      side('#3a4c50', kf0, kAt(d0 - 2), DT - 6, FLOOR);
      side('#283a40', ka, kb, DT, FLOOR);
      side('#5a6e6e', ka, kAt(d0 + 1.5), DT, FLOOR);
      side('#223238', kAt(d0 + 88), kb, DT, FLOOR);
      // 철망 유리창
      side('#111b20', kAt(d0 + 18), kAt(d0 + 60), DT + 18, DT + 70);
      side('#2e4448', kAt(d0 + 20), kAt(d0 + 58), DT + 20, DT + 68);
      side('#4f6a68', kAt(d0 + 20), kAt(d0 + 24), DT + 20, DT + 68);
      for (let y = DT + 26; y < DT + 68; y += 8) side('#57706c50', kAt(d0 + 20), kAt(d0 + 58), y);
      // 손잡이 · 문패
      side('#8d9c94', kAt(d0 + 76), kAt(d0 + 84), 70, 72);
      side('#151f24', kAt(d0 + 78), kAt(d0 + 82), 72, 80);
      side('#9aa89a', kAt(d0 - 26), kAt(d0 - 10), -30, -18);
      side('#46564f', kAt(d0 - 24), kAt(d0 - 12), -26, -24);
      if (label === 2) side('#46564f', kAt(d0 - 24), kAt(d0 - 16), -22, -20);
      // 문 아래 바닥으로 새는 어둠
      const [fx0, fy0] = at(-LW, FLOOR, ka), [fx1, fy1] = at(-LW, FLOOR, kb);
      B.poly('#0a121655', [[fx0, fy0], [fx1, fy1], [fx1 + 40 * kb, fy1], [fx0 + 30 * ka, fy0]]);
    }
    g.fillStyle = '#0a1115'; g.fillRect(lx(1), 0, 1, floorY);
    g.fillStyle = '#4c5f6260'; g.fillRect(lx(1) + 1, B.Y(CEIL), 1, floorY - B.Y(CEIL));
  }

  vignette(g, w, h, '#03060a', 0.55);
}
