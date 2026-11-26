import { type Ink, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 탁상시계 숫자 (3×5) */
const DIGITS: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '7': ['111', '001', '010', '010', '010'],
  ':': ['0', '1', '0', '1', '0'],
};

/**
 * 입대 전날 밤의 내 방 (고해상도): 불을 끄고 누운 뒤, 창으로 달빛만 들어온다.
 * 설계 좌표에서 방은 세로 50~340칸에 놓이고 바닥선이 316이다. 창과 침대 · 책상 · 문은 각자의 기준점에 붙어 있어서
 * 화면이 넓어지면 사이가 벌어질 뿐, 침대나 사람이 늘어나지 않는다.
 */
export function bedtimeHd(g: Ink, w: number, h: number) {
  const rand = seeded(2214);
  const s = Math.min(h / 400, w / 560);
  const floorY = Math.round(h * 0.73);
  const oy = floorY - 316 * s;
  const A = brush(g, Math.round(w * 0.6), oy, s); // 창과 침대
  const D = brush(g, Math.round(Math.max(w * 0.17, 114 * s)), oy, s); // 책상과 선반

  // ── 벽 ──
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#0e1529');
  wall.addColorStop(1, '#232f4b');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, floorY);
  const stripe = Math.max(6, Math.round(18 * s));
  for (let x = stripe >> 1; x < w; x += stripe) {
    g.fillStyle = '#91a2c40d'; g.fillRect(x, 0, 1, floorY);
    g.fillStyle = '#00000018'; g.fillRect(x + 1, 0, 1, floorY);
  }
  A.glow('#7088c426', 0, 130, 230);

  // ── 바닥: 뒤로 갈수록 좁아지는 마루 널 ──
  g.fillStyle = '#161d30';
  g.fillRect(0, floorY, w, h - floorY);
  for (let y = floorY, row = 0; y < h; row++) {
    const depth = Math.max(4, Math.round((9 + row * 5) * s));
    g.fillStyle = row % 2 ? '#1a2238' : '#1e2742'; g.fillRect(0, y, w, depth);
    g.fillStyle = '#2d3957'; g.fillRect(0, y, w, 1);
    g.fillStyle = '#0f1526'; g.fillRect(0, y + depth - 1, w, 1);
    const plank = Math.round((70 + row * 26) * s);
    for (let x = -((row * 37) % plank); x < w; x += plank) {
      g.fillStyle = '#0f1526'; g.fillRect(x, y + 1, 1, depth - 2);
      g.fillStyle = '#2d395750'; g.fillRect(x + 1, y + 1, 1, depth - 2);
    }
    for (let i = 0; i < w / 36; i++) {
      g.fillStyle = '#2f3b5a38';
      g.fillRect(Math.round(rand() * w), y + 2 + Math.floor(rand() * Math.max(1, depth - 4)), Math.round((8 + rand() * 22) * s), 1);
    }
    y += depth;
  }
  // 걸레받이
  const skirt = Math.max(3, Math.round(7 * s));
  g.fillStyle = '#2b3752'; g.fillRect(0, floorY - skirt, w, skirt);
  g.fillStyle = '#56637f'; g.fillRect(0, floorY - skirt, w, 1);
  g.fillStyle = '#0c1222'; g.fillRect(0, floorY - 1, w, 1);

  // 창으로 들어온 달빛이 바닥에 비스듬히 눕는다
  const bottom = (h - oy) / s + 2, run = bottom - 318;
  A.poly('#9db4dc12', [[-92, 318], [92, 318], [92 - run * 0.45, bottom], [-92 - run * 1.1, bottom]]);
  A.poly('#9db4dc12', [[-70, 318], [70, 318], [70 - run * 0.56, bottom], [-70 - run * 0.8, bottom]]);

  // ── 창 ──
  A.box('#0a1020', -98, 56, 196, 160);
  A.box('#313e58', -94, 60, 188, 152);
  A.box('#5f6e89', -94, 60, 188, 2);
  A.box('#5f6e89', -94, 60, 2, 152);
  A.clip(-88, 66, 176, 140, () => {
    A.fade(['#0a1130', '#17235a', '#3a3b7c', '#7d5b8d', '#cb8f87'], -88, 66, 176, 140);
    for (let i = 0; i < 110; i++) {
      const x = -88 + rand() * 176, y = 66 + rand() ** 1.5 * 104;
      g.fillStyle = ['#ffffff', '#cfd8f2', '#9ba7d2', '#f3dcc0', '#7d86b8'][i % 5];
      if (i % 23 === 0) {
        g.fillRect(A.X(x) - 1, A.Y(y), 3, 1);
        g.fillRect(A.X(x), A.Y(y) - 1, 1, 3);
      } else g.fillRect(A.X(x), A.Y(y), 1, 1);
    }
    for (let i = 0; i < 26; i++) {
      const x = -88 + rand() * 150, y = 146 + rand() * 30;
      A.box(i % 3 ? '#6f6396' + '55' : '#e9b3a4' + '44', x, y, 10 + rand() * 30, 1);
    }
    // 초승달
    A.glow('#ffe9b052', 48, 98, 46);
    A.oval('#fff1c9', 48, 98, 13, 13, (dx, dy) => (dx - 0.44) ** 2 + (dy + 0.26) ** 2 > 0.8);
    A.oval('#ffdfa2', 48, 98, 13, 13, (dx, dy) => (dx - 0.44) ** 2 + (dy + 0.26) ** 2 > 0.8 && (dx - 0.3) ** 2 + (dy + 0.18) ** 2 < 0.98);
    // 먼 산, 먼 동네, 가까운 동네
    A.ridge('#3d3b70', -88, 88, (x) => 180 - 5 * Math.sin(x / 23 + 1) - 3 * Math.sin(x / 9), () => 206);
    for (let x = -90; x < 88;) {
      const bw = 10 + Math.floor(rand() * 14), top = 196 - 10 - rand() * 22;
      A.box('#2d2f5e', x, top, bw, 206 - top);
      for (let j = 2; j < bw - 2; j += 4) for (let k = 3; k < 196 - top; k += 6) if (rand() > 0.72) A.box('#d9a67c', x + j, top + k, 2, 2);
      x += bw + (rand() > 0.6 ? 3 : 0);
    }
    for (let x = -92; x < 88;) {
      const bw = 14 + Math.floor(rand() * 18), top = 206 - 8 - rand() * 18;
      A.box('#191e42', x, top, bw, 206 - top);
      A.box('#2a3058', x, top, bw, 1);
      for (let j = 3; j < bw - 3; j += 5) for (let k = 3; k < 204 - top; k += 6) if (rand() > 0.6) A.box('#f6cf8e', x + j, top + k, 2, 2);
      if (rand() > 0.7) A.box('#191e42', x + bw / 2, top - 7, 1, 7);
      x += bw;
    }
    // 유리에 비친 빛
    A.poly('#ffffff0b', [[-84, 66], [-58, 66], [-88, 118], [-88, 92]]);
    A.poly('#ffffff08', [[10, 66], [24, 66], [-4, 118], [-18, 118]]);
  });
  A.box('#313e58', -3, 66, 6, 140);
  A.box('#5f6e89', -3, 66, 1, 140);
  A.box('#313e58', -88, 108, 176, 5);
  A.box('#5f6e89', -88, 108, 176, 1);
  A.box('#141c30', -88, 204, 176, 2);
  // 창턱
  A.box('#b6bfc9', -106, 212, 212, 4);
  A.box('#7d8999', -106, 216, 212, 2);
  A.box('#465369', -102, 218, 204, 5);
  A.box('#0a102070', -102, 223, 204, 3);
  // 창턱의 선인장
  A.oval('#3d6a62', -60, 192, 6, 12);
  A.box('#3d6a62', -72, 190, 8, 4); A.box('#3d6a62', -72, 182, 4, 10);
  A.box('#6c9a89', -62, 182, 1, 18); A.box('#6c9a89', -71, 183, 1, 7);
  A.box('#e3a5b2', -62, 178, 4, 3);
  A.poly('#7d5a58', [[-69, 201], [-51, 201], [-53, 212], [-67, 212]]);
  A.box('#9c736c', -70, 199, 20, 3);

  // ── 커튼: 위에서 넓게 내려와 묶였다가 다시 퍼진다 ──
  for (const side of [-1, 1]) {
    const breadth = (y: number) => y < 152 ? 46 - 32 * ((y - 54) / 98) ** 0.7 : 14 + 12 * ((y - 152) / 68) ** 0.6;
    for (let j = A.Y(54); j < A.Y(220); j++) {
      const y = (j + 0.5 - oy) / s;
      const span = Math.max(3, Math.round(breadth(y) * s));
      const x0 = side < 0 ? A.X(-108) : A.X(108) - span;
      for (let k = 0; k < 5; k++) {
        const a = Math.round(span * k / 5), b = Math.round(span * (k + 1) / 5), n = b - a;
        const lit = Math.max(1, Math.round(n * 0.22)), mid = Math.max(1, Math.round(n * 0.42));
        g.fillStyle = '#8b96b8'; g.fillRect(x0 + a, j, lit, 1);
        g.fillStyle = '#56628a'; g.fillRect(x0 + a + lit, j, mid, 1);
        g.fillStyle = '#3a4567'; g.fillRect(x0 + a + lit + mid, j, Math.max(0, n - lit - mid), 1);
      }
      // 창 쪽 가장자리는 달빛을 받는다
      g.fillStyle = '#b3bdd8'; g.fillRect(side < 0 ? x0 + span - 1 : x0, j, 1, 1);
    }
    A.box('#2a3350', side < 0 ? -108 : 82, 218, 26, 2);
    A.box('#c5ae92', side < 0 ? -109 : 93, 149, 16, 5);
    A.box('#8c775f', side < 0 ? -109 : 93, 153, 16, 1);
  }
  A.box('#9aa3b3', -120, 49, 240, 3);
  A.box('#5a6579', -120, 52, 240, 1);
  A.oval('#c0c7d2', -122, 50.5, 4, 4);
  A.oval('#c0c7d2', 122, 50.5, 4, 4);

  // ── 벽에 걸린 것들: 화면이 넓으면 빈 벽을 채운다 ──
  const gapL = D.X(112), gapR = A.X(-130);
  if (gapR - gapL > 76 * s) {
    const P = brush(g, Math.round((gapL + gapR) / 2), oy, s);
    P.box('#0c1324', -31, 115, 62, 82);
    P.box('#4a566e', -30, 114, 60, 80);
    P.fade(['#22305e', '#5a5388', '#c58c84'], -27, 117, 54, 74);
    P.poly('#2b3158', [[-27, 191], [-27, 168], [-12, 150], [0, 166], [10, 156], [27, 176], [27, 191]]);
    P.poly('#c9cfe0', [[-12, 150], [-8, 156], [-15, 157]]);
    for (let i = 0; i < 14; i++) P.box('#e8ecf6', -25 + rand() * 50, 119 + rand() * 30, 1, 1);
  }
  const doorX = w - 78 * s;
  if (doorX - 62 * s > A.X(186)) {
    const E = brush(g, Math.round(doorX), oy, s);
    E.box('#161d31', -47, 94, 94, 216);
    E.box('#2a3550', -41, 100, 82, 210);
    E.box('#3a4763', -41, 100, 2, 210);
    for (const [y, hh] of [[110, 78], [198, 100]]) {
      E.box('#222c45', -31, y, 62, hh);
      E.box('#34415e', -31, y + hh - 1, 62, 1);
      E.box('#34415e', 30, y, 1, hh);
    }
    E.oval('#b9ab8c', 30, 194, 3.5, 3.5);
    E.box('#aab2be', -64, 196, 8, 12);
    E.box('#7d8796', -61, 200, 2, 4);
  }

  // ── 선반 · 달력 · 책상 ──
  for (let x = -100; x < 26;) {
    const bw = 5 + Math.floor(rand() * 6), bh = 22 + Math.floor(rand() * 17);
    const c = ['#4a5878', '#6a5674', '#53707a', '#7a6a62', '#3f4a6a', '#67708a'][Math.floor(rand() * 6)];
    D.box(c, x, 150 - bh, bw, bh);
    D.box('#ffffff1c', x, 150 - bh, 1, bh);
    D.box('#c9c3b25e', x + 1, 150 - bh + 5, bw - 2, 2);
    x += bw + 1;
  }
  D.poly('#5c6a80', [[28, 150], [34, 150], [45, 122], [39, 120]]);
  // 몬스터볼
  D.oval('#c9cfd7', 60, 141, 8.5, 8.5);
  D.oval('#a84b58', 60, 141, 8.5, 8.5, (_dx, dy) => dy < -0.08);
  D.oval('#cf7480', 57, 137, 3, 2);
  D.box('#1a1f30', 51.5, 140, 17, 2);
  D.oval('#1a1f30', 60, 141, 3.2, 3.2);
  D.oval('#e8ecf0', 60, 141, 1.7, 1.7);
  D.box('#5b687e', -108, 150, 186, 4);
  D.box('#8b97aa', -108, 150, 186, 1);
  D.box('#222b40', -108, 154, 186, 3);
  for (const x of [-92, 58]) D.poly('#394560', [[x, 157], [x + 6, 157], [x, 169]]);
  // 달력: 내일에 빨간 동그라미
  D.box('#0b112055', -99, 170, 36, 48);
  D.box('#c5ccd6', -101, 168, 36, 46);
  D.box('#9a4b55', -101, 168, 36, 9);
  D.box('#e9edf2', -92, 166, 2, 4); D.box('#e9edf2', -76, 166, 2, 4);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) D.box(c === 0 ? '#b0707a' : '#7f8898', -97 + c * 5.4, 182 + r * 6, 2, 2);
  for (const [dx, dy, dw, dh] of [[-1, -2, 4, 1], [-1, 3, 4, 1], [-2, -1, 1, 4], [3, -1, 1, 4]]) D.box('#d84a55', -97 + 3 * 5.4 + dx, 182 + 3 * 6 + dy, dw, dh);

  D.box('#0b102299', -92, 250, 134, 72);
  D.poly('#5b4e58', [[-96, 232], [92, 232], [100, 243], [-104, 243]]);
  D.poly('#6d5f68', [[-96, 232], [92, 232], [94, 235], [-98, 235]]);
  D.box('#44394a', -104, 243, 204, 6);
  D.box('#8a7b84', -104, 243, 204, 1);
  D.box('#261f2e', -102, 249, 200, 2);
  D.box('#362d3e', -98, 251, 6, 73);
  D.box('#52465a', -98, 251, 2, 73);
  D.box('#3a3142', 42, 251, 52, 73);
  D.box('#544760', 42, 251, 2, 73);
  for (const y of [256, 290]) {
    D.box('#4b4052', 47, y, 42, 29);
    D.box('#63566c', 47, y, 42, 1);
    D.box('#2b2434', 47, y + 28, 42, 1);
    D.box('#a39da5', 61, y + 11, 14, 2);
  }
  // 입영통지서
  D.poly('#d2cab7', [[-40, 234], [-6, 234], [-1, 241], [-38, 241]]);
  for (let i = 0; i < 3; i++) D.box('#8f897a', -35 + i, 236 + i * 2, 20 - i * 3, 1);
  D.box('#b5565c', -12, 236, 5, 3);
  // 머그컵
  D.box('#8a99ab', -82, 221, 11, 13);
  D.box('#c3ccd6', -82, 221, 11, 2);
  D.box('#5f6c7e', -73, 223, 2, 11);
  D.box('#8a99ab', -71, 225, 4, 2); D.box('#8a99ab', -69, 225, 2, 7); D.box('#8a99ab', -71, 230, 4, 2);
  // 탁상시계
  D.glow('#7fe0b030', 14, 228, 22);
  D.box('#141a2a', 0, 221, 29, 13);
  D.box('#2c3550', 0, 221, 29, 1);
  let tx = D.X(3);
  for (const ch of '23:47') {
    const rows = DIGITS[ch];
    g.fillStyle = '#8be6b6';
    rows.forEach((bits, r) => [...bits].forEach((b, c) => { if (b === '1') g.fillRect(tx + c, D.Y(225) + r, 1, 1); }));
    tx += rows[0].length + 1;
  }
  // 꺼진 스탠드
  D.box('#2f3a4c', 62, 229, 22, 4);
  D.box('#55627a', 62, 229, 22, 1);
  D.seg('#8d98a6', 73, 229, 66, 204, 2);
  D.seg('#6d7a8b', 66, 204, 80, 188, 2);
  D.oval('#b1bac5', 66, 204, 2.4, 2.4);
  D.poly('#394a5f', [[74, 184], [86, 178], [99, 190], [98, 199], [78, 194]]);
  D.seg('#8fa0b2', 78, 194, 98, 199, 1);
  D.poly('#4d6078', [[74, 184], [86, 178], [89, 181], [77, 187]]);
  // 밀어 넣은 의자
  D.box('#2a2436', -56, 200, 5, 126); D.box('#2a2436', -17, 200, 5, 126);
  D.box('#473f58', -56, 200, 1, 126); D.box('#473f58', -17, 200, 1, 126);
  for (const y of [202, 216, 230]) { D.box('#3a3348', -51, y, 34, 7); D.box('#5c5270', -51, y, 34, 1); }
  D.box('#332c42', -60, 262, 52, 6);
  D.box('#544a66', -60, 262, 52, 1);

  // ── 깔개 ──
  A.oval('#3a3150', 64, 334, 152, 15);
  A.oval('#51446a', 64, 334, 140, 11.5);
  A.oval('#3a3150', 64, 334, 122, 8.5);
  A.oval('#51446a', 64, 334, 114, 7);

  // ── 내일 들고 갈 가방 ──
  A.seg('#27302c', -92, 306, -84, 293, 2); A.seg('#27302c', -84, 293, -66, 293, 2); A.seg('#27302c', -66, 293, -60, 306, 2);
  A.oval('#0a0f1e88', -76, 329, 26, 4);
  A.poly('#3f4d44', [[-98, 308], [-94, 302], [-58, 302], [-54, 308], [-54, 326], [-57, 329], [-95, 329], [-98, 326]]);
  A.box('#5f705f', -94, 302, 36, 2);
  A.box('#2f3a34', -98, 312, 44, 1);
  A.box('#4c5c50', -90, 315, 18, 11);
  A.box('#62735f', -90, 315, 18, 1);
  A.box('#9aa596', -82, 319, 3, 2);

  // ── 침대: 매트리스는 사람 키보다 조금 길 뿐이다 ──
  const bx0 = -34, bx1 = 162;
  A.box('#0a0f1fd0', bx0, 290, bx1 - bx0, 32);
  A.oval('#090e1c90', 64, 328, 108, 6);
  for (const x of [bx0 - 9, bx1 + 4]) { A.box('#352c3c', x, 284, 7, 44); A.box('#584a5c', x, 284, 2, 44); }
  A.poly('#493c4c', [[bx1, 300], [bx1, 230], [bx1 + 3, 224], [bx1 + 10, 224], [bx1 + 13, 230], [bx1 + 13, 300]]);
  A.box('#6f5f70', bx1, 230, 2, 70);
  A.box('#6f5f70', bx1 + 3, 224, 7, 1);
  A.poly('#493c4c', [[bx0 - 11, 300], [bx0 - 11, 256], [bx0 - 8, 251], [bx0 - 2, 251], [bx0, 256], [bx0, 300]]);
  A.box('#6f5f70', bx0 - 8, 251, 6, 1);
  A.box('#6f5f70', bx0 - 2, 256, 2, 26);
  A.box('#41364a', bx0, 282, bx1 - bx0, 10);
  A.box('#685a6e', bx0, 282, bx1 - bx0, 1);
  A.box('#28212f', bx0, 291, bx1 - bx0, 1);
  A.box('#a9b3c1', bx0, 266, bx1 - bx0, 16);
  A.box('#d7dde4', bx0, 266, bx1 - bx0, 2);
  A.box('#8791a5', bx0, 278, bx1 - bx0, 4);
  // 베개
  A.oval('#8f99ad', 139, 264, 27, 7);
  A.oval('#cdd4dc', 138, 260, 27, 8.5);
  A.oval('#eef1f3', 135, 256, 21, 4);
  // 머리: 천장을 보고 누운 옆얼굴 (정수리가 머리판 쪽, 턱이 이불 쪽)
  A.box('#c39a8a', 121, 250, 8, 7);
  A.oval('#27222e', 140, 246, 13.5, 11);
  A.oval('#4b4458', 142, 238, 9, 2.2);
  A.oval('#d9ae9b', 136, 246, 12, 10.2, (dx, dy) => dx * 0.9 + dy * 0.3 < 0.12);
  A.oval('#bd9289', 136, 246, 12, 10.2, (dx, dy) => dx * 0.9 + dy * 0.3 < 0.12 && dy > 0.3);
  A.poly('#d9ae9b', [[127, 238], [130, 233], [133, 238]]);
  A.box('#463039', 133, 242, 4, 1);
  A.box('#463039', 136, 243, 1, 1);
  A.box('#a66f6c', 125, 241, 2, 1);
  A.oval('#e2a39a66', 130, 246, 3, 2);
  A.oval('#c3978c', 140, 249, 2.4, 3.2);
  A.box('#a57f78', 140, 248, 1, 3);

  // 이불: 어깨 · 배 · 세운 무릎 · 발끝이 솟은 능선
  const hump = (x: number, c: number, a: number, wd: number) => a * Math.exp(-(((x - c) / wd) ** 2));
  const top = (x: number) => 265 - hump(x, 106, 14, 14) - hump(x, 78, 8, 22) - hump(x, 34, 17, 13) - hump(x, 4, 5, 12) - hump(x, -19, 12, 6);
  const hem = (x: number) => 288 + 2.5 * Math.sin(x / 8) + 1.5 * Math.sin(x / 3.1);
  const q0 = bx0 + 1, q1 = 123;
  A.ridge('#42557e', q0, q1, top, hem);
  A.ridge('#536a98', q0, q1, top, (x) => top(x) + 10);
  A.ridge('#8ea4c8', q0, q1, top, (x) => top(x) + 2);
  A.ridge('#2f3e62', q0, q1, (x) => hem(x) - 4, hem);
  for (let row = 0, y = 270; y < 290; y += 8, row++) {
    for (let x = q0 + 5 + (row % 2 ? 6 : 0); x < q1 - 4; x += 12) if (y > top(x) + 11 && y < hem(x) - 6) A.box('#6f86b4', x, y, 2, 2);
  }
  for (const x of [98, 76, 56, 24, 6, -12]) {
    A.seg('#33456b', x, top(x) + 5, x - 9, top(x) + 27, 2);
    A.seg('#6078a6', x + 3, top(x) + 5, x - 5, top(x) + 24, 1);
  }
  // 턱 밑까지 끌어올린 이불깃
  A.ridge('#c9d1da', 114, q1, (x) => top(x) - 1, (x) => top(x) + 5);
  A.ridge('#eef1f3', 114, q1, (x) => top(x) - 1, (x) => top(x) + 1);
  A.ridge('#8f9bb0', 114, q1, (x) => top(x) + 4, (x) => top(x) + 5);

  vignette(g, w, h, '#03050c', 0.6);
}
