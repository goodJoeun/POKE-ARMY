import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

/**
 * 꿈속 퀴즈 1. 친구들과 여행 계획 (고해상도): 오후 햇살이 드는 방, 벽에 꽂은 여행 지도와 바다가 보이는 창.
 * 설계 좌표에서 바닥선은 270칸(화면 높이의 56%)이고, 가로 화면에서는 화면 위쪽 끝이 57칸쯤이다.
 * 지도 · 창 · 협탁은 각자의 기준점에 붙어 있어서 화면이 넓어지면 사이가 벌어지고, 그 틈에 달력이나 사진 줄 · 화분 · 서프보드가 들어선다.
 * 등장 포켓몬은 질문 창 위(가운데 아래)에 따로 서므로, 알아볼 것들은 벽 위쪽과 양옆에 둔다.
 */
export function quizTripHd(g: Ink, w: number, h: number) {
  const rand = seeded(5101);
  const s = Math.min(h / 380, w / 400);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const floorY = Math.round(h * 0.56);
  const oy = floorY - 270 * s;
  const narrow = w / s < 430; // 세로 화면: 창을 지도 위로 올려 서로 겹치지 않게 한다
  const M = brush(g, Math.round(w * 0.27), oy, s); // 지도
  const F = brush(g, Math.round(w * (narrow ? 0.7 : 0.74)), oy, s); // 창 아래 바닥: 캐리어 · 배낭 · 햇살
  const V = brush(g, F.X(0), oy - (narrow ? 150 * s : 0), s); // 창
  const T = brush(g, Math.round(Math.max(M.X(-114), 44 * s)), oy, s); // 협탁과 지구본

  // ── 벽: 세로 줄무늬 벽지, 아래는 징두리 널 ──
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#f2d8ae'); wall.addColorStop(0.6, '#e7c296'); wall.addColorStop(1, '#d6aa7e');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, floorY);
  const stripe = Math.max(8, Math.round(20 * s));
  for (let x = stripe >> 1; x < w; x += stripe) {
    g.fillStyle = '#fff6e220'; g.fillRect(x, 0, Math.max(2, Math.round(stripe * 0.4)), floorY);
    g.fillStyle = '#b9865a1e'; g.fillRect(x - 1, 0, 1, floorY);
  }
  V.glow('#fff6d870', 0, 140, 230);
  const railY = M.Y(234);
  g.fillStyle = '#ecd8b4'; g.fillRect(0, railY, w, floorY - railY);
  for (let x = u(6); x < w; x += u(15)) {
    g.fillStyle = '#c8aa80'; g.fillRect(x, railY, 1, floorY - railY);
    g.fillStyle = '#faefd6'; g.fillRect(x + 1, railY, 1, floorY - railY);
  }
  const low = g.createLinearGradient(0, railY, 0, floorY);
  low.addColorStop(0, '#a8744c00'); low.addColorStop(1, '#a8744c3c');
  g.fillStyle = low; g.fillRect(0, railY, w, floorY - railY);
  g.fillStyle = '#f6e8cc'; g.fillRect(0, railY - u(4), w, u(4));
  g.fillStyle = '#fff8e6'; g.fillRect(0, railY - u(4), w, 1);
  g.fillStyle = '#b48e62'; g.fillRect(0, railY, w, 1);
  g.fillStyle = '#b48e6240'; g.fillRect(0, railY + 1, w, u(2));

  // ── 바닥: 뒤로 갈수록 좁아지는 마루 널 ──
  for (let y = floorY, row = 0; y < h; row++) {
    const depth = Math.max(4, Math.round((8 + row * 4.5) * s));
    g.fillStyle = row % 2 ? '#a8744c' : '#b17b51'; g.fillRect(0, y, w, depth);
    g.fillStyle = '#c99466'; g.fillRect(0, y, w, 1);
    g.fillStyle = '#8a5c3a'; g.fillRect(0, y + depth - 1, w, 1);
    const plank = Math.round((64 + row * 22) * s);
    for (let x = -((row * 37) % plank); x < w; x += plank) {
      g.fillStyle = '#8a5c3a'; g.fillRect(x, y + 1, 1, depth - 2);
      g.fillStyle = '#c9946680'; g.fillRect(x + 1, y + 1, 1, depth - 2);
    }
    for (let i = 0; i < w / 30; i++) {
      g.fillStyle = i % 3 ? '#93633e48' : '#cf9c6e50';
      g.fillRect(Math.round(rand() * w), y + 2 + Math.floor(rand() * Math.max(1, depth - 4)), Math.round((8 + rand() * 24) * s), 1);
    }
    y += depth;
  }
  // 걸레받이
  const skirt = u(6);
  g.fillStyle = '#7a5038'; g.fillRect(0, floorY - skirt, w, skirt);
  g.fillStyle = '#a87850'; g.fillRect(0, floorY - skirt, w, 1);
  g.fillStyle = '#5a3824'; g.fillRect(0, floorY - 1, w, 1);

  // 창으로 든 햇살이 바닥에 비스듬히 눕는다 (창살 그림자로 둘로 갈린다)
  const bottom = (h - oy) / s + 2, run = bottom - 271;
  const lean = (x: number) => x - run * (0.86 - x * 0.002);
  for (const [a, b] of [[-70, -4], [4, 70]]) {
    F.poly('#fff0c034', [[a, 271], [b, 271], [lean(b), bottom], [lean(a), bottom]]);
    F.poly('#fff6d820', [[a + 8, 271], [b - 8, 271], [lean(b - 8), bottom], [lean(a + 8), bottom]]);
  }

  // ── 바다가 보이는 창 (유리 83~189칸, 수평선 151칸) ──
  V.box('#9a6c4638', -88, 79, 170, 128);
  V.box('#6a4a34', -82, 73, 164, 126);
  V.box('#8a664a', -80, 75, 160, 122);
  V.box('#c9a27a', -80, 75, 160, 2);
  V.box('#c9a27a', -80, 75, 2, 122);
  V.box('#5e4230', -73, 82, 146, 108);
  V.clip(-72, 83, 144, 106, () => {
    V.fade(['#4fa6e6', '#86caf2', '#c6e8f6', '#f8ecc8'], -72, 83, 144, 69);
    // 해
    V.glow('#fff6c8b0', 40, 106, 44);
    V.oval('#fff6d2', 40, 106, 9, 9);
    V.oval('#fffdf2', 40, 106, 6.5, 6.5);
    // 구름: 아래쪽에 그늘
    for (const [cx, cy, k] of [[-44, 99, 1], [2, 92, 0.75], [-12, 119, 0.6], [58, 130, 0.55]]) {
      V.oval('#d2e6f2', cx, cy + 2.5 * k, 17 * k, 4.5 * k);
      V.oval('#ffffff', cx - 7 * k, cy + 1 * k, 9 * k, 4 * k);
      V.oval('#ffffff', cx + 1 * k, cy - 2 * k, 9 * k, 5.5 * k);
      V.oval('#ffffff', cx + 9 * k, cy + 1 * k, 8 * k, 3.5 * k);
    }
    // 갈매기
    for (const [bx, by] of [[-24, 133], [-9, 127]]) {
      V.seg('#56667a', bx - 3, by - 1.5, bx, by + 1, 1);
      V.seg('#56667a', bx, by + 1, bx + 3, by - 1.5, 1);
    }
    // 먼 곶과 가까운 섬 (해가 있는 오른쪽 비탈이 밝다)
    V.ridge('#9cc4c0', 6, 72, (x) => 151 - 7 * Math.exp(-(((x - 62) / 20) ** 2)) - 3 * Math.exp(-(((x - 34) / 12) ** 2)), () => 151);
    V.poly('#4f9a6c', [[-66, 152], [-54, 140], [-40, 121], [-35, 127], [-27, 124], [-15, 139], [-2, 152]]);
    V.poly('#7cbc7c', [[-40, 121], [-35, 127], [-27, 124], [-15, 139], [-2, 152], [-20, 152], [-31, 138]]);
    V.poly('#3f8460', [[-66, 152], [-54, 140], [-49, 133], [-46, 145], [-36, 152]]);
    V.box('#f0deb0', -60, 150, 58, 2);
    V.box('#f6f2e8', -11, 139, 3, 12);
    V.box('#d8503a', -11, 139, 3, 2);
    // 바다
    V.fade(['#5aaade', '#3f8cc6', '#3074ae'], -72, 152, 144, 38);
    V.box('#cfeaf6', -72, 152, 144, 1);
    for (let i = 0; i < 40; i++) {
      const t = rand();
      V.box(i % 4 ? '#d8f0ffb0' : '#2a69a4a0', -72 + rand() * 140, 154 + t * 34, 3 + t * 9, 1);
    }
    for (let i = 0; i < 70; i++) {
      const t = rand() ** 0.8;
      V.box('#fff6d8', 40 + (rand() - 0.5) * (8 + t * 46) - 1, 153 + t * 35, 1.5 + t * 4, 1);
    }
    // 돛단배
    V.box('#ffffff58', 9, 163, 14, 1);
    V.box('#6a3a2e70', 11, 164, 10, 1);
    V.poly('#8a4a3a', [[8, 158], [26, 158], [23, 163], [11, 163]]);
    V.box('#c98a6a', 8, 158, 18, 1);
    V.box('#5a3a2a', 17, 139, 1, 19);
    V.poly('#ffffff', [[19, 140], [19, 157], [28, 157]]);
    V.poly('#dbe6ee', [[16, 144], [16, 157], [9, 157]]);
    V.box('#d8503a', 18, 137, 4, 2);
    // 유리에 비친 빛
    V.poly('#ffffff16', [[-66, 83], [-44, 83], [-72, 131], [-72, 93]]);
    V.poly('#ffffff10', [[16, 83], [28, 83], [4, 125], [4, 103]]);
  });
  V.box('#8a664a', -3, 83, 6, 106);
  V.box('#c9a27a', -3, 83, 1, 106);
  V.box('#6a4a34', 2, 83, 1, 106);
  V.box('#8a664a', -72, 185, 144, 4);
  V.box('#c9a27a', -72, 185, 144, 1);
  // 창턱
  V.box('#e6c8a0', -90, 197, 180, 4);
  V.box('#fff2d6', -90, 197, 180, 1);
  V.box('#a87e58', -86, 201, 172, 4);
  V.box('#8a5a3048', -86, 205, 172, 3);
  // 창턱의 화분과 불가사리
  for (const [dx, dy] of [[-11, -12], [-6, -20], [1, -23], [7, -18], [12, -11]]) {
    V.seg('#3f8460', -50, 185, -50 + dx, 185 + dy, 3);
    V.seg('#7cbc7c', -49, 184, -49 + dx, 184 + dy, 1);
  }
  V.poly('#c8704a', [[-59, 185], [-41, 185], [-43, 197], [-57, 197]]);
  V.poly('#a85a3a', [[-46, 185], [-41, 185], [-43, 197], [-47, 197]]);
  V.box('#e08c62', -60, 183, 20, 3);
  V.box('#f2ac84', -60, 183, 20, 1);
  V.poly('#ee8e62', [[24, 190], [26, 193.5], [30, 194], [27, 195.5], [28, 197], [24, 196], [20, 197], [21, 195.5], [18, 194], [22, 193.5]]);

  // ── 얇은 커튼: 양옆으로 걷어 두었다 ──
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -110 : 82;
    V.box('#a8744c30', x0 + (side < 0 ? -4 : 4), 71, 28, 150);
    for (let k = 0; k < 4; k++) {
      const fx = x0 + k * 7, len = 150 + (k % 2 ? 3 : 0);
      V.box('#fdf5e2', fx, 67, 2, len);
      V.box('#f3e4c8', fx + 2, 67, 3, len);
      V.box('#dcc6a2', fx + 5, 67, 2, len);
      V.box('#c8ae88', fx, 67 + len, 7, 1);
    }
    // 창 쪽 가장자리는 햇빛을 받는다
    V.box('#fffaf0', side < 0 ? -83 : 82, 67, 1, 150);
    for (let k = 0; k < 4; k++) V.box('#6a4a34', x0 + 2 + k * 7, 63, 3, 5);
  }
  V.box('#8a664a', -116, 62, 232, 3);
  V.box('#c9a27a', -116, 62, 232, 1);
  V.box('#5e4230', -116, 65, 232, 1);
  V.oval('#a87e58', -118, 63.5, 4, 4);
  V.oval('#a87e58', 118, 63.5, 4, 4);

  // ── 벽에 핀으로 꽂은 여행 지도 ──
  const mx = -78, my = 77, mw = 156, mh = 102;
  const at = ([a, b]: Point, dx = 0, dy = 0): Point => [mx + a * mw + dx, my + b * mh + dy];
  const shrink = (pts: Point[], k: number): Point[] => {
    const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
    return pts.map(([a, b]) => [cx + (a - cx) * k - 0.01, cy + (b - cy) * k - 0.02]);
  };
  M.box('#8a5a3038', -81, 76, 170, 115);
  M.box('#f3e8ca', -84, 71, 168, 114);
  M.box('#fffaea', -84, 71, 168, 1);
  M.box('#d9c9a2', -84, 184, 168, 1);
  M.box('#d9c9a2', 83, 71, 1, 114);
  M.box('#8fc3d6', mx - 1, my - 1, mw + 2, mh + 2);
  M.fade(['#b4dcea', '#a6d4e2', '#9acbe0'], mx, my, mw, mh);
  M.clip(mx, my, mw, mh, () => {
    for (let x = 26; x < mw; x += 26) M.box('#8cc4d8', mx + x, my, 0.5, mh);
    for (let y = 25.5; y < mh; y += 25.5) M.box('#8cc4d8', mx, my + y, mw, 0.5);
    const lands: [Point[], string, string][] = [
      [[[0.05, 0.2], [0.12, 0.12], [0.24, 0.08], [0.33, 0.13], [0.38, 0.24], [0.43, 0.33], [0.38, 0.45], [0.36, 0.56], [0.27, 0.6], [0.18, 0.66], [0.11, 0.55], [0.06, 0.42], [0.08, 0.3]], '#9cc98a', '#b3d69a'],
      [[[0.5, 0.46], [0.58, 0.36], [0.7, 0.3], [0.82, 0.33], [0.93, 0.38], [0.96, 0.52], [0.9, 0.66], [0.9, 0.8], [0.78, 0.86], [0.66, 0.92], [0.57, 0.82], [0.52, 0.68], [0.54, 0.56]], '#b5d48e', '#cde2a2'],
      [[[0.58, 0.08], [0.66, 0.04], [0.75, 0.06], [0.79, 0.16], [0.7, 0.21], [0.62, 0.2]], '#9cc98a', '#b3d69a'],
      [[[0.42, 0.74], [0.46, 0.7], [0.5, 0.74], [0.47, 0.79]], '#b5d48e', '#b5d48e'],
    ];
    // 얕은 바다 → 해안 그늘 → 땅 → 안쪽 고지대
    for (const [pts] of lands) for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5], [1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]]) M.poly('#c6e7ec', pts.map((p) => at(p, dx, dy)));
    for (const [pts, base, high] of lands) {
      M.poly('#76a66c', pts.map((p) => at(p, 0, 1.5)));
      M.poly(base, pts.map((p) => at(p)));
      M.poly(high, shrink(pts, 0.62).map((p) => at(p)));
    }
    // 산줄기
    for (const [a, b] of [[0.2, 0.28], [0.26, 0.24], [0.24, 0.36], [0.74, 0.5], [0.8, 0.46], [0.84, 0.56], [0.68, 0.12]] as Point[]) {
      const [x, y] = at([a, b]);
      M.poly('#84ad76', [[x - 4.5, y + 3], [x, y - 4], [x + 4.5, y + 3]]);
      M.poly('#e6efc6', [[x, y - 4], [x + 4.5, y + 3], [x + 1, y + 3]]);
    }
    // 강
    M.seg('#a6d4e2', ...at([0.72, 0.56]), ...at([0.66, 0.72]), 1);
    M.seg('#a6d4e2', ...at([0.66, 0.72]), ...at([0.68, 0.9]), 1);
    // 나침반
    const [cx, cy] = at([0.1, 0.83]);
    M.oval('#f3e8ca', cx, cy, 11, 11);
    M.oval('#a6d4e2', cx, cy, 9.5, 9.5);
    M.poly('#8a9ab4', [[cx - 8, cy], [cx, cy - 2], [cx + 8, cy], [cx, cy + 2]]);
    M.poly('#56667a', [[cx, cy + 9], [cx - 2.5, cy], [cx + 2.5, cy]]);
    M.poly('#d8403a', [[cx, cy - 9], [cx + 2.5, cy], [cx - 2.5, cy]]);
    // 축척 막대와 제목 칸
    for (let i = 0; i < 4; i++) M.box(i % 2 ? '#f3e8ca' : '#56667a', mx + mw - 38 + i * 8, my + mh - 7, 8, 2);
    M.box('#f3e8ca', mx + mw - 34, my + 4, 30, 11);
    M.box('#b8a67e', mx + mw - 30, my + 7, 20, 1);
    M.box('#b8a67e', mx + mw - 30, my + 11, 13, 1);
    // 접었던 자국
    for (const x of [mw / 3, mw * 2 / 3]) { M.box('#ffffff40', mx + x, my, 0.5, mh); M.box('#5a8a9a26', mx + x + 1, my, 0.5, mh); }
    M.box('#ffffff40', mx, my + mh / 2, mw, 0.5);
    M.box('#5a8a9a26', mx, my + mh / 2 + 1, mw, 0.5);
  });
  // 빨간 점선 경로와 핀
  const stops: Point[] = [[0.2, 0.36], [0.35, 0.5], [0.47, 0.6], [0.6, 0.55], [0.8, 0.62]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = at(stops[i]), [x1, y1] = at(stops[i + 1]);
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3.4);
    for (let k = 0; k < n; k += 2) M.box('#d8403a', x0 + (x1 - x0) * k / n - 1, y0 + (y1 - y0) * k / n - 1, 2, 2);
  }
  for (const i of [0, 1, 3, 4]) {
    const [x, y] = at(stops[i]);
    M.seg('#3a524838', x + 1, y, x + 6, y + 2, 1);
    M.box('#5a2a2a', x - 0.5, y - 7, 1, 7);
    M.oval('#e84a3a', x, y - 9, 3.2, 3.2);
    M.oval('#b8302a', x, y - 9, 3.2, 3.2, (dx, dy) => dx - dy < -0.7);
    M.box('#ffc2b4', x + 0.5, y - 11, 1, 1);
  }
  // 종이를 붙든 파란 핀, 말려 올라간 아래 귀퉁이
  for (const x of [-79, 79]) {
    M.oval('#6a4a3040', x + 1, 77, 3, 2);
    M.oval('#3a6ad0', x, 75, 3, 3);
    M.box('#9ab8f6', x, 73, 1, 1);
  }
  M.poly('#e7c296', [[84, 185], [73, 185], [84, 174]]);
  M.poly('#d9c9a2', [[73, 185], [84, 174], [75, 176]]);
  M.poly('#fffaea', [[73, 185], [75, 176], [76, 177], [74, 184]]);
  // 지도 아래에 꽂아 둔 것들: 탑승권 · 메모 · 사진
  M.poly('#8a5a3030', [[-78, 196], [-36, 193], [-34, 211], [-76, 214]]);
  M.poly('#f8f1de', [[-80, 194], [-38, 191], [-36, 209], [-78, 212]]);
  M.poly('#3e7cbc', [[-80, 194], [-38, 191], [-37.6, 195.5], [-79.6, 198.5]]);
  M.poly('#d9c9a2', [[-50, 196.5], [-49, 196.4], [-47.4, 209.6], [-48.4, 209.7]]);
  M.seg('#8a7a5a', -74, 203, -56, 201.7, 1);
  M.seg('#b8a67e', -74, 207, -61, 206, 1);
  M.box('#56667a', -44, 199, 1, 8); M.box('#56667a', -42, 199, 2, 8); M.box('#56667a', -39, 199, 1, 8);
  M.oval('#e84a3a', -59, 193, 2.5, 2.5);
  M.box('#8a5a3030', -26, 195, 18, 18);
  M.box('#f2d24a', -28, 193, 18, 18);
  M.box('#fbe888', -28, 193, 18, 1);
  M.poly('#d4b23a', [[-10, 211], [-16, 211], [-10, 205]]);
  M.box('#8a7430', -25, 198, 11, 1); M.box('#8a7430', -25, 202, 8, 1); M.box('#8a7430', -25, 206, 6, 1);
  M.oval('#3a6ad0', -19, 193, 2.5, 2.5);
  M.poly('#8a5a3030', [[1, 194], [25, 197], [22, 226], [-2, 223]]);
  M.poly('#fbf7ec', [[-1, 192], [23, 195], [20, 224], [-4, 221]]);
  M.poly('#f6b070', [[1.6, 194.6], [20.6, 197], [19.4, 208], [0.4, 205.6]]);
  M.poly('#4f9fd6', [[0.4, 205.6], [19.4, 208], [18.8, 214], [-0.2, 211.6]]);
  M.oval('#fff3c4', 12, 203, 3.5, 3.5);
  M.box('#fff6d8', 6, 210, 8, 1);
  M.oval('#6ad87a', 11, 193, 2.5, 2.5);

  // ── 지도와 창 사이 빈 벽: 넓으면 줄에 건 여행 사진들, 조금 비면 달력 ──
  const gapL = M.X(96), gapR = V.X(-126);
  if (gapR - gapL > 150 * s) {
    const P = brush(g, Math.round((gapL + gapR) / 2), oy, s);
    const sag = (x: number) => 86 + 12 * (1 - (x / 72) ** 2);
    for (let i = P.X(-72); i < P.X(72); i++) {
      g.fillStyle = '#8a664a';
      g.fillRect(i, P.Y(sag((i + 0.5 - P.X(0)) / s)), 1, 1);
    }
    P.oval('#6a4a34', -72, 86, 2.5, 2.5);
    P.oval('#6a4a34', 72, 86, 2.5, 2.5);
    const shots: [string, string, string][] = [['#f6b070', '#e8604a', '#7a4a5a'], ['#86caf2', '#4f9a6c', '#7cbc7c'], ['#bfe6f6', '#3f8cc6', '#f0deb0'], ['#f8d890', '#f29a6a', '#3f8460']];
    shots.forEach(([sky, ground, accent], i) => {
      const x = -57 + i * 38 - 11, y = sag(-57 + i * 38) + 2 + (i % 2);
      P.box('#8a5a3030', x + 2, y + 2, 22, 27);
      P.box('#fbf7ec', x, y, 22, 27);
      P.box('#d9c9a2', x, y + 26, 22, 1);
      P.box(sky, x + 2, y + 2, 18, 17);
      P.box(ground, x + 2, y + 13, 18, 6);
      if (i === 0) P.oval('#fff3c4', x + 11, y + 12, 4, 4, (_dx, dy) => dy < 0.2);
      if (i === 1) { P.poly(accent, [[x + 4, y + 13], [x + 10, y + 5], [x + 16, y + 13]]); P.poly('#ffffff', [[x + 10, y + 5], [x + 12, y + 8], [x + 8, y + 8]]); }
      if (i === 2) { P.box(accent, x + 2, y + 16, 18, 3); P.box('#e84a3a', x + 12, y + 9, 4, 2); P.box('#f6f2e8', x + 13, y + 11, 1, 6); }
      if (i === 3) { P.box(accent, x + 9, y + 8, 2, 9); P.poly(accent, [[x + 4, y + 9], [x + 10, y + 5], [x + 16, y + 9], [x + 10, y + 8]]); }
      P.box('#c9a27a', x + 9, y - 3, 4, 7);
      P.box('#8a664a', x + 9, y, 4, 1);
    });
  } else if (gapR - gapL > 66 * s) {
    // 출발일에 동그라미를 친 달력
    const C = brush(g, Math.round((gapL + gapR) / 2), oy, s);
    C.box('#8a5a3038', -19, 92, 44, 56);
    C.box('#fbf7ec', -22, 88, 44, 56);
    C.box('#d9c9a2', -22, 143, 44, 1);
    C.box('#e8604a', -22, 88, 44, 12);
    C.box('#f6927c', -22, 88, 44, 1);
    C.box('#fbf7ec', -10, 92, 20, 3);
    for (const x of [-13, 11]) { C.box('#6a4a34', x, 84, 2, 7); C.box('#c9a27a', x, 84, 1, 7); }
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      if ((r === 0 && c < 2) || (r === 4 && c > 4)) continue;
      C.box(c === 0 ? '#e8604a' : r < 2 || (r === 2 && c < 4) ? '#c9b9a0' : '#7a6a5a', -18.5 + c * 5.6, 105 + r * 7.4, 3, 3);
    }
    C.oval('#d8403a', -18.5 + 4 * 5.6 + 1.5, 105 + 2 * 7.4 + 1.5, 5, 5, (dx, dy) => dx * dx + dy * dy > 0.5);
    for (let c = 5; c < 7; c++) C.box('#4fb0a8', -18.5 + c * 5.6 - 1, 105 + 2 * 7.4 + 4, 5, 1);
    for (let c = 1; c < 3; c++) C.box('#4fb0a8', -18.5 + c * 5.6 - 1, 105 + 3 * 7.4 + 4, 5, 1);
  }

  // ── 협탁: 지구본 · 여행 책 · 카메라 ──
  T.oval('#5a361e50', -4, 271, 40, 4);
  for (const x of [-27, 23]) { T.box('#8a5c3a', x, 235, 4, 35); T.box('#b07a50', x, 235, 1, 35); }
  T.box('#7a5038', -23, 254, 46, 3);
  T.box('#a87850', -23, 254, 46, 1);
  T.box('#b07a50', -32, 230, 64, 5);
  T.box('#d8a474', -32, 230, 64, 1);
  T.box('#7a5038', -32, 234, 64, 1);
  T.box('#5a361e40', -30, 235, 60, 2);
  // 지구본
  T.poly('#6a4a34', [[-22, 230], [-6, 230], [-9, 225], [-19, 225]]);
  T.box('#8a664a', -19, 225, 10, 1);
  T.box('#8a664a', -15, 220, 2, 5);
  T.oval('#c9a27a', -14, 202, 20, 20, (dx, dy) => dx * dx + dy * dy > 0.8 && dx < 0.25);
  T.oval('#4f9fd6', -14, 202, 16, 16);
  T.oval('#7cbc7c', -14, 202, 16, 16, (dx, dy) => (dx + 0.35) ** 2 * 2.2 + (dy + 0.3) ** 2 < 0.2 || (dx - 0.3) ** 2 + (dy - 0.25) ** 2 * 1.8 < 0.14 || (dx - 0.5) ** 2 * 3 + (dy + 0.55) ** 2 < 0.05);
  T.oval('#2f72ac', -14, 202, 16, 16, (dx, dy) => dx * dx + dy * dy > 0.62 && dy - dx > 0.5);
  T.oval('#bfe6f6', -14, 202, 16, 16, (dx, dy) => (dx - 0.42) ** 2 + (dy + 0.48) ** 2 < 0.05);
  T.box('#8a664a', -15, 183, 2, 3);
  // 포개 놓은 여행 책과 카메라
  for (const [x, y, bw, c] of [[4, 225, 26, '#3e7cbc'], [6, 220, 23, '#f2c84a'], [5, 215, 24, '#e8604a']] as [number, number, number, string][]) {
    T.box(c, x, y, bw, 5);
    T.box('#ffffff50', x, y, bw, 1);
    T.box('#f8f1de', x + bw - 3, y + 1, 3, 3);
    T.box('#00000026', x, y + 4, bw, 1);
  }
  T.box('#3a3f4a', 9, 205, 17, 10);
  T.box('#5a6270', 9, 205, 17, 1);
  T.box('#2a2e36', 12, 202, 6, 3);
  T.box('#d8503a', 22, 203, 3, 2);
  T.oval('#20242c', 18.5, 210.5, 4.5, 4.5);
  T.oval('#6a8ab0', 18.5, 210.5, 2.6, 2.6);
  T.box('#cfe2f4', 19, 208, 1, 1);

  // ── 화면이 넓으면: 왼쪽 끝에 화분 ──
  if (T.X(-40) > 110 * s) {
    const L = brush(g, Math.round(T.X(-40) / 2 - 4 * s), oy, s);
    L.oval('#5a361e50', -2, 271, 30, 4);
    const fronds: [number, number, string][] = [[-34, -62, '#3f8460'], [34, -58, '#3f8460'], [-20, -84, '#4f9a6c'], [22, -88, '#4f9a6c'], [-44, -34, '#4f9a6c'], [42, -30, '#7cbc7c'], [0, -98, '#7cbc7c'], [-8, -70, '#7cbc7c']];
    for (const [dx, dy, c] of fronds) {
      const len = Math.hypot(dx, dy), nx = -dy / len * 7, ny = dx / len * 7;
      L.poly(c, [[0, 238], [dx * 0.5 + nx, 238 + dy * 0.5 + ny], [dx, 238 + dy], [dx * 0.5 - nx, 238 + dy * 0.5 - ny]]);
      L.seg('#2f6a4c', 0, 238, dx * 0.92, 238 + dy * 0.92, 1);
    }
    L.poly('#c8704a', [[-17, 238], [17, 238], [13, 270], [-13, 270]]);
    L.poly('#a85a3a', [[6, 238], [17, 238], [13, 270], [5, 270]]);
    L.box('#e08c62', -19, 235, 38, 5);
    L.box('#f2ac84', -19, 235, 38, 1);
  }

  // ── 캐리어와 배낭: 창 아래 오른쪽에 세워 두었다 ──
  F.oval('#5a361e58', 58, 271, 52, 5);
  // 배낭
  F.poly('#c88a2c', [[16, 270], [14, 240], [19, 228], [41, 228], [46, 240], [46, 270]]);
  F.poly('#e0a23c', [[16, 270], [14, 240], [19, 228], [35, 228], [38, 240], [38, 270]]);
  F.box('#f2c05a', 19, 228, 16, 1);
  F.box('#b07424', 14, 242, 32, 2);
  F.box('#c88a2c', 19, 250, 16, 14);
  F.box('#f2c05a', 19, 250, 16, 1);
  F.box('#8a5a2a', 25, 244, 3, 8);
  F.box('#d8d0c0', 25, 249, 3, 2);
  F.seg('#8a5a2a', 24, 228, 27, 222, 2); F.seg('#8a5a2a', 27, 222, 33, 222, 2); F.seg('#8a5a2a', 33, 222, 36, 228, 2);
  F.oval('#6ab0a0', 30, 224, 15, 5);
  F.oval('#8fd0c0', 28, 222.5, 11, 2);
  F.box('#3f7a70', 21, 219, 2, 10); F.box('#3f7a70', 38, 219, 2, 10);
  // 캐리어
  F.box('#20446a', 52, 264, 7, 6); F.box('#20446a', 85, 264, 7, 6);
  F.box('#16304c', 52, 268, 7, 2); F.box('#16304c', 85, 268, 7, 2);
  F.poly('#3e7cbc', [[49, 214], [52, 210], [92, 210], [95, 214], [95, 262], [92, 265], [52, 265], [49, 262]]);
  F.poly('#5a98d4', [[49, 214], [52, 210], [57, 210], [57, 265], [52, 265], [49, 262]]);
  F.poly('#2f5f8f', [[88, 210], [92, 210], [95, 214], [95, 262], [92, 265], [88, 265]]);
  F.box('#86b8ea', 52, 210, 40, 1);
  for (let y = 219; y < 262; y += 9) { F.box('#2f66a2', 50, y, 44, 1); F.box('#6aa6de', 50, y + 1, 44, 1); }
  F.box('#2a5688', 71, 211, 1, 53);
  // 스티커
  F.box('#f2c84a', 54, 223, 13, 10);
  F.oval('#e8604a', 60.5, 228, 3, 3);
  F.oval('#f6f2e8', 82, 240, 6, 6);
  F.oval('#e8604a', 82, 240, 4.5, 4.5);
  F.poly('#f6f2e8', [[80, 238], [84, 240], [80, 242]]);
  F.box('#f6f2e8', 54, 247, 14, 8);
  F.box('#4fb0a8', 54, 249, 14, 2); F.box('#e8604a', 54, 252, 14, 1);
  // 캐리어 위에 얹어 둔 밀짚모자
  F.oval('#b88a4a', 73, 210, 22, 4.5);
  F.oval('#ecd08a', 73, 208, 22, 4.5);
  F.poly('#ecd08a', [[62, 208], [64, 197], [82, 197], [84, 208]]);
  F.oval('#f6e2a6', 73, 197, 9, 2.5);
  F.poly('#d8503a', [[62.4, 205.5], [63, 201.5], [83, 201.5], [83.6, 205.5]]);
  F.box('#f6e2a6', 56, 206.5, 14, 1);

  // ── 화면이 넓으면: 오른쪽 벽에 기대 둔 서프보드와 비치볼 ──
  if (w - V.X(122) > 120 * s) {
    const B = brush(g, Math.round(Math.min(w - 70 * s, (V.X(122) + w) / 2 + 14 * s)), oy, s);
    B.oval('#a8744c40', -6, 184, 19, 82);
    B.oval('#5a361e50', 8, 271, 44, 4);
    B.oval('#f6ead0', 0, 184, 18, 84);
    B.oval('#dccfae', 0, 184, 18, 84, (dx) => dx > 0.5);
    B.oval('#4fb0a8', 0, 184, 18, 84, (dx) => Math.abs(dx) < 0.14);
    B.oval('#e8604a', 0, 184, 18, 84, (_dx, dy) => dy > 0.36 && dy < 0.46);
    B.oval('#f2c84a', 0, 184, 18, 84, (_dx, dy) => dy > 0.48 && dy < 0.53);
    B.oval('#fffaf0', 0, 184, 18, 84, (dx, dy) => dx < -0.55 && dx > -0.72 && dy < 0.2);
    const wedge = (k: number) => (dx: number, dy: number) => Math.floor((Math.atan2(dy + 0.3, dx + 0.2) + Math.PI) / (Math.PI / 3)) % 3 === k;
    B.oval('#f6f2e8', 36, 256, 14, 14);
    B.oval('#e8604a', 36, 256, 14, 14, wedge(0));
    B.oval('#3e7cbc', 36, 256, 14, 14, wedge(1));
    B.oval('#00000020', 36, 256, 14, 14, (dx, dy) => dx * dx + dy * dy > 0.6 && dy - dx * 0.4 > 0.3);
    B.oval('#ffffffb0', 31, 250, 3, 2);
  }

  vignette(g, w, h, '#5a3018', 0.24);
}
