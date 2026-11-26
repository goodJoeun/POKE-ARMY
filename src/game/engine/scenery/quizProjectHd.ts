import { type Ink, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 꿈속 퀴즈 2. 조별 과제 · 연락 두절 (고해상도): 새벽 두 시의 스터디룸. 한 칸에 빨간 X가 쳐진 화이트보드,
 * 포스트잇, 두 시를 가리키는 시계, 밤 창, 긴 책상 위의 노트북 불빛.
 * 설계 좌표에서 바닥선은 270칸(화면 높이의 58%)이고, 가로 화면에서는 화면 위쪽 끝이 50칸쯤이다.
 * 화이트보드 · 시계 · 창은 각자의 기준점에 붙어 있어서 화면이 넓어지면 사이가 벌어지고, 그 틈에 게시판 · 선반 · 문 · 화분이 들어선다.
 * 세로 화면에서는 시계와 창을 화이트보드 위로 올려 단다.
 * 등장 포켓몬은 질문 창 위(가운데 아래)에 따로 서므로, 책상 위 물건은 양쪽으로 갈라 놓는다.
 */
export function quizProjectHd(g: Ink, w: number, h: number) {
  const rand = seeded(5202);
  const s = Math.min(h / 380, w / 400);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const floorY = Math.round(h * 0.58);
  const oy = floorY - 270 * s;
  const half = Math.min(w / s * 0.46, 330); // 책상 길이의 절반
  const narrow = w / s < 430; // 세로 화면: 창과 시계를 화이트보드 위로 올려 서로 겹치지 않게 한다
  const B = brush(g, Math.round(w * (narrow ? 0.44 : 0.25)), oy, s); // 화이트보드와 포스트잇
  const V = brush(g, Math.round(w * (narrow ? 0.72 : 0.84)), oy - (narrow ? 150 * s : 0), s); // 밤 창
  const F = brush(g, V.X(0), oy, s); // 창 아래 바닥에 든 달빛
  const C = narrow ? brush(g, Math.round(w * 0.24), oy - 120 * s, s) : brush(g, Math.round((B.X(152) + V.X(-58)) / 2), oy, s); // 시계
  const D = brush(g, Math.round(w / 2), oy, s); // 긴 책상
  const lx = -half * 0.52, ax = half * 0.5; // 노트북 · 스탠드

  // ── 벽: 불 꺼진 스터디룸의 판벽 ──
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#131a32'); wall.addColorStop(1, '#28324f');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, floorY);
  const panel = u(62);
  for (let x = panel >> 1; x < w; x += panel) {
    g.fillStyle = '#0c122660'; g.fillRect(x, 0, 1, floorY);
    g.fillStyle = '#4a567a26'; g.fillRect(x + 1, 0, 1, floorY);
  }
  V.glow('#6a88d020', 0, 124, 170);
  D.glow('#8ab8ff30', lx, 186, 120);
  D.glow('#ffd89024', ax - 14, 190, 90);

  // ── 바닥: 어두운 마루 널 ──
  for (let y = floorY, row = 0; y < h; row++) {
    const depth = Math.max(4, Math.round((8 + row * 4.5) * s));
    g.fillStyle = row % 2 ? '#151b2e' : '#191f35'; g.fillRect(0, y, w, depth);
    g.fillStyle = '#262e48'; g.fillRect(0, y, w, 1);
    g.fillStyle = '#0d1220'; g.fillRect(0, y + depth - 1, w, 1);
    const plank = Math.round((64 + row * 22) * s);
    for (let x = -((row * 37) % plank); x < w; x += plank) {
      g.fillStyle = '#0d1220'; g.fillRect(x, y + 1, 1, depth - 2);
      g.fillStyle = '#262e4860'; g.fillRect(x + 1, y + 1, 1, depth - 2);
    }
    for (let i = 0; i < w / 36; i++) {
      g.fillStyle = '#2a334e40';
      g.fillRect(Math.round(rand() * w), y + 2 + Math.floor(rand() * Math.max(1, depth - 4)), Math.round((8 + rand() * 22) * s), 1);
    }
    y += depth;
  }
  // 걸레받이
  const skirt = u(6);
  g.fillStyle = '#2a3350'; g.fillRect(0, floorY - skirt, w, skirt);
  g.fillStyle = '#4a5678'; g.fillRect(0, floorY - skirt, w, 1);
  g.fillStyle = '#0c1222'; g.fillRect(0, floorY - 1, w, 1);
  // 창으로 든 달빛, 노트북 불빛이 바닥에 떨어진 자리
  const bottom = (h - oy) / s + 2, run = bottom - 271;
  F.poly('#8aa4d812', [[-46, 271], [46, 271], [46 - run * 0.5, bottom], [-46 - run * 1.0, bottom]]);
  F.poly('#8aa4d810', [[-30, 271], [30, 271], [30 - run * 0.58, bottom], [-30 - run * 0.9, bottom]]);

  // ── 화면이 넓으면: 왼쪽 끝에 복도로 나가는 문 ──
  if (B.X(-104) > 110 * s && D.X(-half) > 120 * s) {
    const E = brush(g, Math.round(Math.min(B.X(-104), D.X(-half)) / 2), oy, s);
    E.box('#0e1428', -40, 96, 80, 174);
    E.box('#1f2946', -35, 101, 70, 169);
    E.box('#33405e', -35, 101, 2, 169);
    E.box('#33405e', -35, 101, 70, 1);
    for (const [y, hh] of [[110, 62], [182, 78]]) {
      E.box('#182038', -26, y, 52, hh);
      E.box('#2a3552', -26, y + hh - 1, 52, 1);
      E.box('#2a3552', 25, y, 1, hh);
    }
    E.oval('#9aa4b4', 26, 178, 3, 3);
    // 비상구 유도등만 켜져 있다
    E.glow('#5ae09a30', 0, 84, 40);
    E.box('#0e1428', -17, 78, 34, 12);
    E.box('#3ac880', -16, 79, 32, 10);
    E.box('#d8ffe8', -9, 81, 4, 6); E.box('#d8ffe8', -4, 83, 3, 2); E.box('#d8ffe8', 3, 82, 8, 1); E.box('#d8ffe8', 8, 80, 1, 5);
  }

  // ── 화이트보드: 역할 다섯 칸 중 하나에 빨간 X ──
  B.box('#080c1c70', -97, 62, 200, 108);
  B.box('#565f74', -100, 58, 200, 108);
  B.box('#7c8598', -100, 58, 198, 106);
  B.box('#a4adbe', -100, 58, 198, 1);
  B.box('#a4adbe', -100, 58, 1, 106);
  B.fade(['#dbe1e8', '#c6ced9'], -96, 62, 192, 100);
  B.box('#eef1f4', -96, 62, 192, 1);
  B.box('#aab3c2', -96, 161, 192, 1);
  for (const [x, y, rx, ry] of [[-20, 150, 26, 5], [58, 132, 18, 4], [-62, 141, 14, 3]]) B.oval('#b8c1ce70', x, y, rx, ry);
  B.poly('#ffffff26', [[40, 62], [58, 62], [22, 162], [4, 162]]);
  B.poly('#ffffff18', [[64, 62], [70, 62], [34, 162], [28, 162]]);
  // 제목과 마감
  pixelText(g, '조별 과제', B.X(-68), B.Y(71), '#3a5aa8');
  B.box('#3a5aa8', -93, 78, 52, 1.5);
  B.box('#d83a3a', 60, 64, 33, 15);
  B.box('#d5dbe3', 61.5, 65.5, 30, 12);
  pixelText(g, 'D-1', B.X(76.5), B.Y(71.5), '#d83a3a');
  // 역할 칸
  ['자료', '조사', 'PPT', '발표', '정리'].forEach((label, i) => {
    const x = -93 + i * 38;
    B.box('#3a5aa8', x, 84, 34, 1); B.box('#3a5aa8', x, 121, 34, 1);
    B.box('#3a5aa8', x, 84, 1, 38); B.box('#3a5aa8', x + 33, 84, 1, 38);
    pixelText(g, label, B.X(x + 17), B.Y(92), '#2e3a5c');
    for (let k = 0; k < 2; k++) B.box('#5a6a8a', x + 5, 101 + k * 5, 24 * (0.5 + rand() * 0.5), 1);
    if (i < 2) {
      B.seg('#2f9a5a', x + 20, 114, x + 23, 117, 1.5);
      B.seg('#2f9a5a', x + 23, 117, x + 29, 110, 1.5);
    } else if (i === 2) {
      B.box('#3a5aa8', x + 5, 112, 24, 4);
      B.box('#d5dbe3', x + 6, 113, 22, 2);
      B.box('#6a8ad0', x + 6, 113, 12, 2);
    } else if (i === 4) {
      B.box('#5a6a8a', x + 23, 111, 6, 6);
      B.box('#d0d7e0', x + 24, 112, 4, 4);
    }
    if (i < 4) B.box('#3a5aa8', x + 34.5, 102, 3, 1.5);
    if (i === 3) {
      B.seg('#d83a3a', x - 2, 82, x + 35, 124, 2);
      B.seg('#d83a3a', x + 35, 82, x - 2, 124, 2);
    }
  });
  // 일정 선과 메모
  B.box('#2e3a5c', -93, 131, 150, 1);
  for (let i = 0; i < 6; i++) B.box('#2e3a5c', -93 + i * 30, 129, 1, 5);
  B.poly('#d83a3a', [[53, 126], [59, 126], [56, 131]]);
  for (let k = 0; k < 3; k++) {
    B.box('#3a5aa8', -93, 140 + k * 7, 2, 2);
    B.box('#7a8296', -88, 140.5 + k * 7, 110 * (0.4 + rand() * 0.5), 1);
  }
  pixelText(g, '연락 좀!', B.X(64), B.Y(146), '#d83a3a');
  B.box('#d83a3a', 44, 154, 40, 1);
  B.box('#d83a3a', 48, 156.5, 32, 1);
  // 받침대: 마커와 지우개
  B.box('#8a93a8', -90, 166, 180, 1);
  B.box('#5c6478', -90, 167, 180, 3);
  B.box('#080c1c70', -88, 170, 176, 2);
  for (const [c, cap, x] of [['#d83a3a', '#8a2424', -62], ['#3a5aa8', '#243a70', -46], ['#2a2a34', '#14141c', -30]] as [string, string, number][]) {
    B.box('#e4e8ee', x, 163, 12, 3);
    B.box(c, x + 3, 163, 6, 3);
    B.box(cap, x + 9, 163, 3, 3);
  }
  B.box('#e4e8ee', 30, 164, 18, 2);
  B.box('#3a4258', 30, 160, 18, 4);
  B.box('#56617e', 30, 160, 18, 1);

  // ── 포스트잇 ──
  ['#f2d84a', '#f29ab0', '#9ad87a', '#8ac8f0', '#f2d84a', '#f29ab0'].forEach((c, i) => {
    const x = 110 + (i % 2) * 20 + (i * 7) % 3 - 1, y = 62 + (i >> 1) * 21 + (i * 5) % 4;
    B.box('#080c1c70', x + 1.5, y + 2, 16, 16);
    B.box(c, x, y, 16, 16);
    B.box('#ffffff58', x, y, 16, 1.5);
    B.poly('#00000034', [[x + 16, y + 16], [x + 10, y + 16], [x + 16, y + 10]]);
    B.box('#0000004a', x + 3, y + 5, 10, 1);
    B.box('#0000004a', x + 3, y + 9, 7 - (i % 3), 1);
  });

  // ── 벽시계: 새벽 두 시 ──
  C.oval('#080c1c70', 2, 99, 17, 17);
  C.oval('#39425e', 0, 96, 17, 17);
  C.oval('#5d6988', 0, 96, 17, 17, (dx, dy) => dx + dy < -0.95);
  C.oval('#dfe4ea', 0, 96, 14, 14);
  C.oval('#c3cad6', 0, 96, 14, 14, (dx, dy) => dx * dx + dy * dy > 0.7 && dx + dy > 0.2);
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, r = k % 3 ? 11.5 : 11, d = k % 3 ? 1 : 2;
    C.box(k % 3 ? '#8a93a8' : '#2a2a3a', Math.sin(a) * r - d / 2, 96 - Math.cos(a) * r - d / 2, d, d);
  }
  C.seg('#2a2a3a', 0, 96, 0, 86.5, 1);
  C.seg('#2a2a3a', 0, 96, 5.6, 92.8, 1.5);
  C.oval('#d83a3a', 0, 96, 1.6, 1.6);

  // ── 화면이 넓으면: 빈 벽에 게시판과 선반 ──
  const gap1 = [B.X(152), C.X(-22)], gap2 = [C.X(22), V.X(-62)];
  if (gap1[1] - gap1[0] > 120 * s) {
    const K = brush(g, Math.round((gap1[0] + gap1[1]) / 2), oy, s);
    K.box('#080c1c70', -45, 72, 96, 66);
    K.box('#4a3a34', -48, 68, 96, 66);
    K.box('#6a544a', -48, 68, 96, 1);
    K.box('#7e6850', -44, 72, 88, 58);
    for (let i = 0; i < 70; i++) K.box(i % 2 ? '#6e5a46' : '#8c765c', -44 + rand() * 86, 72 + rand() * 57, 2, 1);
    for (const [x, y, bw, bh, c, pin] of [[-38, 77, 26, 34, '#c6ced9', '#d83a3a'], [-8, 80, 22, 16, '#f29ab0', '#3a5aa8'], [-6, 100, 20, 24, '#b8c1ce', '#f2d84a'], [18, 76, 20, 28, '#c6ced9', '#2f9a5a'], [20, 108, 18, 16, '#9ad87a', '#d83a3a']] as [number, number, number, number, string, string][]) {
      K.box('#00000040', x + 1.5, y + 2, bw, bh);
      K.box(c, x, y, bw, bh);
      for (let yy = y + 6; yy < y + bh - 3; yy += 4) K.box('#00000038', x + 3, yy, (bw - 6) * (0.5 + rand() * 0.5), 1);
      K.oval(pin, x + bw / 2, y + 2, 1.8, 1.8);
    }
  }
  if (gap2[1] - gap2[0] > 120 * s) {
    const S = brush(g, Math.round((gap2[0] + gap2[1]) / 2), oy, s);
    for (let x = -40; x < 22;) {
      const bw = 5 + Math.floor(rand() * 5), bh = 20 + Math.floor(rand() * 14);
      const c = ['#3a4a78', '#5a4a6a', '#3f5a6a', '#6a5a5a', '#2f3c62', '#56617e'][Math.floor(rand() * 6)];
      S.box(c, x, 122 - bh, bw, bh);
      S.box('#ffffff1c', x, 122 - bh, 1, bh);
      S.box('#c9c3b250', x + 1, 122 - bh + 5, bw - 2, 2);
      x += bw + 1;
    }
    S.poly('#4a5678', [[23, 122], [28, 122], [37, 98], [32, 96]]);
    S.box('#56617e', -46, 122, 92, 4);
    S.box('#7c8598', -46, 122, 92, 1);
    S.box('#1a2238', -46, 126, 92, 2);
    for (const x of [-36, 30]) S.poly('#3c4660', [[x, 128], [x + 5, 128], [x, 138]]);
  }

  // ── 밤 창: 달과 잠든 도시 (유리 70~176칸) ──
  V.box('#080c1c70', -54, 66, 114, 124);
  V.box('#262e44', -57, 61, 114, 124);
  V.box('#3c4660', -56, 62, 112, 122);
  V.box('#56617e', -56, 62, 112, 1.5);
  V.box('#56617e', -56, 62, 1.5, 122);
  V.box('#161c30', -49, 69, 98, 108);
  V.clip(-48, 70, 96, 106, () => {
    V.fade(['#060a1a', '#0b1330', '#17214a', '#2c305a'], -48, 70, 96, 106);
    for (let i = 0; i < 70; i++) {
      const x = -48 + rand() * 96, y = 70 + rand() ** 1.4 * 78;
      g.fillStyle = ['#ffffff', '#a8b4d0', '#7f8ab4', '#d8dcf0'][i % 4];
      if (i % 19 === 0) { g.fillRect(V.X(x) - 1, V.Y(y), 3, 1); g.fillRect(V.X(x), V.Y(y) - 1, 1, 3); } else g.fillRect(V.X(x), V.Y(y), 1, 1);
    }
    for (let i = 0; i < 14; i++) V.box('#4a5488' + '40', -48 + rand() * 70, 112 + rand() * 26, 12 + rand() * 26, 1);
    // 달
    V.glow('#f4ecc448', 22, 93, 34);
    V.oval('#f4ecc4', 22, 93, 8.5, 8.5);
    V.oval('#d9cfa4', 22, 93, 8.5, 8.5, (dx, dy) => (dx - 0.35) ** 2 + (dy + 0.3) ** 2 < 0.07 || (dx + 0.3) ** 2 + (dy - 0.25) ** 2 < 0.1 || (dx - 0.2) ** 2 + (dy - 0.55) ** 2 < 0.03);
    V.oval('#fffbe4', 22, 93, 8.5, 8.5, (dx, dy) => dx * dx + dy * dy > 0.72 && dx + dy < -0.5);
    // 먼 건물, 가까운 건물: 불 켜진 창은 몇 개뿐이다
    for (let x = -50; x < 48;) {
      const bw = 8 + Math.floor(rand() * 10), top = 176 - 20 - rand() * 28;
      V.box('#1e2750', x, top, bw, 176 - top);
      V.box('#2a3462', x, top, 1, 176 - top);
      for (let j = 2; j < bw - 2; j += 4) for (let k = 3; k < 170 - top; k += 5) if (rand() > 0.88) V.box('#b89a5c', x + j, top + k, 2, 2);
      x += bw + (rand() > 0.6 ? 2 : 0);
    }
    V.box('#141a3a', -33, 112, 7, 64);
    V.box('#141a3a', -30, 102, 1, 10);
    V.glow('#f04a4a50', -29.5, 102, 7);
    V.box('#f04a4a', -30, 101, 1.5, 1.5);
    for (let x = -50; x < 48;) {
      const bw = 12 + Math.floor(rand() * 14), top = 176 - 8 - rand() * 20;
      V.box('#0f1430', x, top, bw, 176 - top);
      V.box('#1c2448', x, top, bw, 1);
      for (let j = 3; j < bw - 3; j += 5) for (let k = 3; k < 173 - top; k += 6) if (rand() > 0.8) V.box(rand() > 0.3 ? '#e8c870' : '#8ab8ff', x + j, top + k, 2, 2);
      if (rand() > 0.6) V.box('#0f1430', x + bw / 2, top - 6, 1, 6);
      x += bw;
    }
    // 유리에 비친 빛
    V.poly('#ffffff0c', [[-44, 70], [-26, 70], [-48, 118], [-48, 90]]);
    V.poly('#ffffff08', [[12, 70], [22, 70], [2, 118], [2, 96]]);
  });
  V.box('#3c4660', -2.5, 70, 5, 106);
  V.box('#56617e', -2.5, 70, 1, 106);
  V.box('#262e44', 1.5, 70, 1, 106);
  // 걷어 올린 블라인드
  V.box('#4a5470', -49, 69, 98, 9);
  for (const y of [70, 73, 76]) V.box('#6a7696', -49, y, 98, 1);
  V.box('#262e44', -49, 78, 98, 2);
  V.box('#7c8598', 41, 80, 1, 36);
  V.box('#a4adbe', 40, 116, 3, 4);
  // 창턱
  V.box('#56617e', -62, 184, 124, 3);
  V.box('#7c8598', -62, 184, 124, 1);
  V.box('#2a3350', -59, 187, 118, 4);
  V.box('#080c1c70', -59, 191, 118, 2);

  // ── 화면이 넓으면: 오른쪽 끝에 키 큰 화분 ──
  if (w - Math.max(V.X(62), D.X(half)) > 76 * s) {
    const L = brush(g, Math.round((Math.max(V.X(62), D.X(half)) + w) / 2), oy, s);
    L.oval('#060a1870', 0, 271, 26, 4);
    for (const [dx, dy, c] of [[-22, -70, '#24424a'], [20, -78, '#24424a'], [-9, -98, '#2f5a5c'], [8, -108, '#3a6e68'], [-30, -44, '#2f5a5c'], [30, -50, '#3a6e68']] as [number, number, string][]) {
      const len = Math.hypot(dx, dy), nx = -dy / len * 6, ny = dx / len * 6;
      L.poly(c, [[-3, 240], [dx * 0.45 + nx, 240 + dy * 0.45 + ny], [dx, 240 + dy], [dx * 0.45 - nx, 240 + dy * 0.45 - ny], [3, 240]]);
      L.seg('#5a8a80', 0, 240, dx * 0.9, 240 + dy * 0.9, 1);
    }
    L.poly('#3a4258', [[-15, 240], [15, 240], [11, 270], [-11, 270]]);
    L.poly('#2a3046', [[5, 240], [15, 240], [11, 270], [4, 270]]);
    L.box('#56617e', -17, 237, 34, 4);
    L.box('#7c8598', -17, 237, 34, 1);
  }

  // ── 긴 책상 ──
  D.box('#070b1a9c', -half + 8, 216, half * 2 - 16, 54);
  D.box('#060a1870', -half - 2, 270, half * 2 + 4, 4);
  // 책상 밑 휴지통과 구겨 던진 종이
  const bx = -half + 34;
  D.poly('#232c48', [[bx - 11, 242], [bx + 11, 242], [bx + 8, 270], [bx - 8, 270]]);
  D.poly('#2f3a5a', [[bx - 11, 242], [bx - 6, 242], [bx - 4, 270], [bx - 8, 270]]);
  D.oval('#8a8e9c', bx - 3, 240, 5, 4); D.oval('#a4a8b4', bx + 4, 239, 5, 4.5); D.oval('#c3c6ce', bx + 3, 237.5, 3, 2);
  D.box('#3c4868', -half + 22, 241, 24, 2);
  for (const [x, y] of [[bx + 24, 267], [bx - 24, 268], [bx + 40, 273]]) { D.oval('#060a1870', x + 1, y + 3, 5, 1.5); D.oval('#8a8e9c', x, y, 4.5, 3.5); D.oval('#b4b8c4', x - 1, y - 1, 2.5, 1.5); }
  // 다리: 책상이 길면 이음매마다 하나씩 더
  const legs = [-half + 5, half - 11];
  if (half > 200) legs.push(-half * 0.34 - 3, half * 0.34 - 3);
  for (const x of legs) {
    D.box('#2c2426', x, 212, 6, 58);
    D.box('#4a3e40', x, 212, 1.5, 58);
  }
  D.box('#3a3030', -half + 3, 210, half * 2 - 6, 8);
  D.box('#4f4242', -half + 3, 210, half * 2 - 6, 1);
  D.box('#221a1e', -half + 3, 217, half * 2 - 6, 1);
  D.box('#5a4a40', -half, 204, half * 2, 6);
  D.box('#7e6a5c', -half, 204, half * 2, 1.5);
  D.box('#322828', -half, 209, half * 2, 1);
  for (let i = 0; i < half / 6; i++) D.box('#6c5a4e', -half + rand() * (half * 2 - 30), 206 + Math.floor(rand() * 3), 8 + rand() * 22, 1);
  // 불빛을 받는 책상 윗면
  D.box('#a8c4f070', lx - 44, 204, 88, 1.5);
  D.box('#ffe0a070', ax - 52, 204, 66, 1.5);

  // 종이 더미와 펜
  const px = -half * 0.86;
  for (let k = 0; k < 7; k++) {
    D.box(k % 2 ? '#d9d5cb' : '#c5c0b5', px - 16 + (k * 3) % 4, 202 - k * 2, 32, 2);
    D.box('#9a968c', px - 16 + (k * 3) % 4, 203 - k * 2, 32, 1);
  }
  D.box('#e6e3da', px - 14, 188, 32, 2);
  D.box('#8a93a8', px - 10, 188, 18, 1);
  D.seg('#3a5aa8', px - 2, 187, px + 14, 185, 1.5);
  D.box('#d8dce4', px + 13, 184.5, 3, 1.5);
  // 노트북: 문서 옆 대화창에는 답 없는 내 말풍선만 쌓여 있다
  D.poly('#8a94a4', [[lx - 22, 204], [lx + 22, 204], [lx + 19, 200], [lx - 19, 200]]);
  D.box('#c3ccd8', lx - 19, 200, 38, 1);
  D.box('#5a6474', lx - 12, 202, 24, 1);
  D.box('#232936', lx - 19, 174, 38, 26);
  D.box('#4a5262', lx - 19, 174, 38, 1);
  D.box('#bcd8ff', lx - 17, 176, 34, 22);
  D.box('#eef4ff', lx - 16, 177, 20, 20);
  D.box('#6a8ac8', lx - 14, 179, 11, 1.5);
  for (let k = 0; k < 5; k++) D.box('#8aa2d0', lx - 14, 182.5 + k * 2.8, 7 + rand() * 9, 1);
  D.box('#9ab6e6', lx + 5, 177, 11, 20);
  for (let k = 0; k < 4; k++) {
    const bw = 4 + (k * 3) % 4;
    D.box('#f2d84a', lx + 15 - bw, 178.5 + k * 4.6, bw, 3);
    D.box('#fff6c0', lx + 13 - bw, 180 + k * 4.6, 1, 1);
  }
  D.glow('#bcd8ff30', lx, 187, 30);
  // 머그컵
  D.box('#d9d5cb', lx + 32, 193, 10, 11);
  D.box('#f2f0e8', lx + 32, 193, 3, 11);
  D.box('#c84a3a', lx + 32, 197, 10, 3);
  D.box('#3a2a2a', lx + 33, 193, 8, 1);
  D.box('#d9d5cb', lx + 42, 195, 3, 1.5); D.box('#d9d5cb', lx + 44, 195, 1.5, 6); D.box('#d9d5cb', lx + 42, 200, 3, 1.5);
  // 가운데: 포개 놓은 전공 책
  for (const [x, y, bw, c] of [[-26, 198, 40, '#3a4a78'], [-22, 192, 34, '#6a4a5a'], [-24, 187, 36, '#3f5a6a']] as [number, number, number, string][]) {
    D.box(c, x, y, bw, y === 198 ? 6 : 5);
    D.box('#ffffff24', x, y, bw, 1);
    D.box('#c9c3b2', x + bw - 4, y + 1, 4, y === 198 ? 4 : 3);
  }
  // 스탠드와 펼친 공책
  D.poly('#ffe0a016', [[ax - 26, 177], [ax - 8, 171], [ax + 16, 204], [ax - 56, 204]]);
  D.poly('#cfc9b8', [[ax - 46, 204], [ax - 8, 204], [ax - 11, 199], [ax - 43, 199]]);
  D.poly('#e9e4d4', [[ax - 45, 203], [ax - 28, 203], [ax - 28, 199], [ax - 43, 199]]);
  D.poly('#f4efe0', [[ax - 26, 203], [ax - 9, 203], [ax - 11, 199], [ax - 26, 199]]);
  D.box('#8a8474', ax - 41, 200.5, 10, 1); D.box('#8a8474', ax - 24, 200.5, 11, 1); D.box('#8a8474', ax - 24, 202, 7, 1);
  D.seg('#d83a3a', ax - 34, 198, ax - 22, 196.5, 1.5);
  D.box('#2f3a4c', ax - 4, 200, 20, 4);
  D.box('#56627a', ax - 4, 200, 20, 1);
  D.seg('#8d98a6', ax + 6, 200, ax + 12, 177, 2);
  D.seg('#6d7a8b', ax + 12, 177, ax - 4, 164, 2);
  D.oval('#b1bac5', ax + 12, 177, 2.4, 2.4);
  D.poly('#394a5f', [[ax - 4, 160], [ax - 14, 156], [ax - 28, 169], [ax - 26, 177], [ax - 8, 171]]);
  D.poly('#4d6078', [[ax - 4, 160], [ax - 14, 156], [ax - 17, 159], [ax - 7, 163]]);
  D.seg('#fff0c0', ax - 25, 177, ax - 9, 171.5, 1.5);
  D.glow('#ffe9b050', ax - 17, 176, 16);
  // 진동하는 휴대폰: 알림은 오는데 그 사람 답은 없다
  const fx = half * 0.68;
  D.glow('#5a8ad048', fx + 10, 199, 20);
  D.box('#060a1870', fx + 1, 204, 22, 1);
  D.box('#20242e', fx, 202, 22, 2);
  D.box('#3a4050', fx, 202, 22, 0.6);
  D.poly('#20242e', [[fx + 2, 197], [fx + 20, 197], [fx + 22, 202], [fx, 202]]);
  D.poly('#4a78c0', [[fx + 3.5, 197.8], [fx + 18.5, 197.8], [fx + 20, 201.2], [fx + 2, 201.2]]);
  D.poly('#a8c8f8', [[fx + 4, 198.2], [fx + 12, 198.2], [fx + 12.4, 199.4], [fx + 3.6, 199.4]]);
  D.oval('#f04a4a', fx + 20.5, 196.5, 2.6, 2.6);
  D.box('#ffb0b0', fx + 19.5, 195, 1, 1);
  for (const d of [-1, 1]) {
    const x0 = fx + 10.5 + d * 15;
    D.seg('#e8ecf490', x0, 195, x0 + d * 2, 198, 1);
    D.seg('#e8ecf460', x0 + d * 4, 193, x0 + d * 7, 197.5, 1);
  }
  // 식은 커피와 빈 캔
  const cx = half * 0.84;
  D.poly('#d9d5cb', [[cx, 190], [cx + 11, 190], [cx + 9.5, 204], [cx + 1.5, 204]]);
  D.poly('#f2f0e8', [[cx, 190], [cx + 4, 190], [cx + 4.5, 204], [cx + 1.5, 204]]);
  D.poly('#c84a3a', [[cx + 0.4, 194], [cx + 10.6, 194], [cx + 10, 200], [cx + 1, 200]]);
  D.box('#f6f4ee', cx - 1, 188, 13, 2.5);
  D.box('#b8b4aa', cx - 1, 190, 13, 1);
  D.box('#4a6ad0', cx + 17, 191, 7, 13);
  D.box('#7a94e8', cx + 17, 191, 2, 13);
  D.box('#f2d84a', cx + 17, 196, 7, 2);
  D.box('#c3ccd8', cx + 17, 190, 7, 1.5);
  D.poly('#4a6ad0', [[cx + 28, 204], [cx + 28, 198], [cx + 41, 198], [cx + 41, 204]]);
  D.box('#7a94e8', cx + 28, 198, 13, 1.5);
  D.box('#c3ccd8', cx + 40, 198, 1.5, 6);
  D.box('#f2d84a', cx + 33, 198, 2, 6);

  vignette(g, w, h, '#03050c', 0.5);
}
