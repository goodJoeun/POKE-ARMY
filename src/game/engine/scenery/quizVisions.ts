import { type Ink, gleam, line, polygon, rect, seeded, sky, wash } from './pixels';

/**
 * 입대 전날 밤 꿈속 성격 분석 퀴즈: 질문마다 그 상황을 보여 주는 장면.
 * 화면 아래쪽은 질문 창이 덮으므로, 알아볼 만한 것들은 위쪽 절반에 모은다.
 * 등장 포켓몬은 그림이 아니라 질문 창 위에 따로 세운다 (Scenes.tsx · QuizCastRow).
 */

/** 꽉 찬 원 (도트) */
function disc(g: Ink, color: string, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    rect(g, color, cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** 나무 바닥: 판자 줄 + 이음매 */
function planks(g: Ink, w: number, h: number, top: number, base: string, seam: string, rand: () => number) {
  rect(g, base, 0, top, w, h - top);
  for (let y = top, row = 0; y < h; row++) {
    const depth = 4 + row * 2;
    rect(g, seam, 0, y, w, 1);
    for (let x = (row * 37) % 53; x < w; x += 53 + Math.floor(rand() * 20)) rect(g, seam, x, y, 1, depth);
    y += depth;
  }
}

/** 창문 틀 (안쪽 그림은 호출한 쪽이 먼저 그린다) */
function windowFrame(g: Ink, x: number, y: number, w: number, h: number, frame: string, light: string) {
  rect(g, frame, x - 4, y - 4, w + 8, 4);
  rect(g, frame, x - 4, y + h, w + 8, 5);
  rect(g, frame, x - 4, y, 4, h);
  rect(g, frame, x + w, y, 4, h);
  rect(g, frame, x + Math.round(w / 2) - 1, y, 3, h);
  rect(g, light, x - 4, y + h, w + 8, 1);
}

/** 1. 친구들과 여행 계획: 오후 햇살이 드는 방, 벽에 붙인 지도와 바다가 보이는 창 */
export function quizTrip(g: Ink, w: number, h: number) {
  const rand = seeded(5101);
  const floorY = Math.round(h * 0.56);
  sky(g, w, h, ['#efd2a8', '#e2b98e', '#c99a72']);
  for (let x = 3; x < w; x += 9) rect(g, '#fff6e214', x, 0, 2, floorY);
  // 바다가 보이는 창
  const ww = Math.round(Math.min(w * 0.36, 150)), wh = Math.round(Math.min(h * 0.3, 92));
  const wx = Math.round(w * 0.58), wy = Math.round(h * 0.08);
  const glass = g.createLinearGradient(0, wy, 0, wy + wh);
  glass.addColorStop(0, '#6ebcf0'); glass.addColorStop(0.55, '#bfe6f6'); glass.addColorStop(1, '#f7e4bc');
  g.fillStyle = glass; g.fillRect(wx, wy, ww, wh);
  const sunX = Math.round(wx + ww * 0.78), sunY = Math.round(wy + wh * 0.26);
  wash(g, sunX, sunY, 20, '#fff6c890');
  disc(g, '#fff3c4', sunX, sunY, 5);
  for (const [cx, cy, cw] of [[0.12, 0.2, 22], [0.42, 0.12, 16], [0.3, 0.36, 12]] as const) {
    rect(g, '#ffffffd0', wx + ww * cx, wy + wh * cy, cw, 3);
    rect(g, '#ffffffd0', wx + ww * cx + 4, wy + wh * cy - 2, cw - 8, 2);
  }
  const seaY = Math.round(wy + wh * 0.62);
  polygon(g, '#4f9a6c', [[wx + ww * 0.08, seaY], [wx + ww * 0.24, seaY - wh * 0.26], [wx + ww * 0.32, seaY - wh * 0.19], [wx + ww * 0.46, seaY]]);
  polygon(g, '#7cbc7c', [[wx + ww * 0.15, seaY], [wx + ww * 0.24, seaY - wh * 0.26], [wx + ww * 0.27, seaY - wh * 0.1], [wx + ww * 0.22, seaY]]);
  rect(g, '#3f8cc6', wx, seaY, ww, wy + wh - seaY);
  for (let i = 0; i < 16; i++) rect(g, '#d8f0ff', wx + rand() * (ww - 6), seaY + 2 + rand() * (wy + wh - seaY - 3), 3 + rand() * 4, 1);
  // 작은 돛단배
  const bx = Math.round(wx + ww * 0.62), by = seaY + 4;
  polygon(g, '#ffffff', [[bx, by - 1], [bx, by - 10], [bx + 6, by - 1]]);
  rect(g, '#8a4a3a', bx - 4, by, 12, 2);
  windowFrame(g, wx, wy, ww, wh, '#8a664a', '#c9a27a');
  // 벽에 핀으로 꽂은 여행 지도 (점선 경로 + 핀)
  const mw = Math.round(Math.min(w * 0.42, 172)), mh = Math.round(Math.min(h * 0.32, 98));
  const mx = Math.round(w * 0.06), my = Math.round(h * 0.07);
  rect(g, '#00000026', mx + 3, my + 3, mw, mh);
  rect(g, '#f3e8ca', mx, my, mw, mh);
  rect(g, '#a6d4e2', mx + 3, my + 3, mw - 6, mh - 6);
  const land = (pts: [number, number][], color: string) => polygon(g, color, pts.map(([u, v]) => [mx + 3 + u * (mw - 6), my + 3 + v * (mh - 6)]));
  land([[0.05, 0.15], [0.3, 0.08], [0.42, 0.3], [0.35, 0.55], [0.18, 0.62], [0.06, 0.4]], '#9cc98a');
  land([[0.5, 0.42], [0.72, 0.3], [0.94, 0.38], [0.9, 0.78], [0.66, 0.9], [0.52, 0.7]], '#b5d48e');
  land([[0.58, 0.06], [0.74, 0.04], [0.78, 0.18], [0.62, 0.2]], '#9cc98a');
  const route: [number, number][] = [[0.2, 0.36], [0.4, 0.5], [0.6, 0.56], [0.78, 0.6]];
  for (let i = 0; i < route.length - 1; i++) {
    const [u0, v0] = route[i], [u1, v1] = route[i + 1];
    const x0 = mx + 3 + u0 * (mw - 6), y0 = my + 3 + v0 * (mh - 6), x1 = mx + 3 + u1 * (mw - 6), y1 = my + 3 + v1 * (mh - 6);
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let k = 0; k < n; k += 2) rect(g, '#d8403a', x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, 2, 2);
  }
  for (const [u, v] of route) {
    const px = Math.round(mx + 3 + u * (mw - 6)), py = Math.round(my + 3 + v * (mh - 6));
    rect(g, '#5a2a2a', px, py - 5, 1, 5);
    disc(g, '#e84a3a', px, py - 6, 2);
  }
  for (const [px, py] of [[mx + 2, my + 2], [mx + mw - 3, my + 2]]) disc(g, '#3a6ad0', px, py, 2);
  // 바닥 · 캐리어 · 배낭
  rect(g, '#7a5038', 0, floorY - 3, w, 3);
  planks(g, w, h, floorY, '#a8744c', '#8a5c3a', rand);
  polygon(g, '#f6d9a024', [[wx - 10, floorY], [wx + ww + 10, floorY], [wx + ww + 60, h], [wx - 40, h]]);
  const sx = Math.round(w * 0.86), sy = floorY - 30;
  rect(g, '#2f5f8f', sx - 2, sy - 6, 3, 6);
  rect(g, '#2f5f8f', sx + 13, sy - 6, 3, 6);
  rect(g, '#2f5f8f', sx - 2, sy - 7, 18, 2);
  rect(g, '#3e7cbc', sx - 8, sy, 30, 30);
  rect(g, '#5a98d4', sx - 8, sy, 30, 2);
  rect(g, '#f2c84a', sx - 4, sy + 7, 8, 6);
  rect(g, '#e8604a', sx + 8, sy + 15, 7, 7);
  rect(g, '#20446a', sx - 6, sy + 29, 4, 3);
  rect(g, '#20446a', sx + 16, sy + 29, 4, 3);
}

/** 2. 조별 과제 · 연락 두절: 새벽 두 시의 스터디룸, 할 일이 빼곡한 화이트보드 */
export function quizProject(g: Ink, w: number, h: number) {
  const rand = seeded(5202);
  const floorY = Math.round(h * 0.58);
  sky(g, w, h, ['#1c2440', '#28324f', '#1a2036']);
  // 화이트보드: 일정표 · 다섯 칸 중 하나는 빨간 X
  const bw = Math.round(Math.min(w * 0.48, 186)), bh = Math.round(Math.min(h * 0.3, 90));
  const bx = Math.round(w * 0.05), by = Math.round(h * 0.07);
  rect(g, '#7c8598', bx - 3, by - 3, bw + 6, bh + 6);
  rect(g, '#cdd4dc', bx, by, bw, bh);
  rect(g, '#e9edf0', bx + 2, by + 2, bw - 4, 2);
  rect(g, '#3a5aa8', bx + 6, by + 8, bw * 0.38, 2);
  const cell = (bw - 18) / 5;
  for (let i = 0; i < 5; i++) {
    const cx = bx + 9 + i * cell;
    rect(g, '#3a5aa8', cx, by + 18, cell - 5, 1);
    rect(g, '#3a5aa8', cx, by + 18, 1, bh * 0.3);
    rect(g, '#3a5aa8', cx + cell - 6, by + 18, 1, bh * 0.3);
    rect(g, '#3a5aa8', cx, by + 18 + bh * 0.3, cell - 5, 1);
    for (let k = 0; k < 3; k++) rect(g, '#5a6a8a', cx + 3, by + 23 + k * 5, (cell - 12) * (0.5 + rand() * 0.5), 1);
    if (i === 3) {
      line(g, '#d83a3a', cx - 1, by + 16, cell - 3, bh * 0.3 + 4, 2);
      line(g, '#d83a3a', cx - 1, by + 20 + bh * 0.3, cell - 3, -bh * 0.3 - 4, 2);
    }
  }
  for (let k = 0; k < 3; k++) rect(g, '#7a8296', bx + 8, by + bh * 0.68 + k * 6, bw * (0.35 + rand() * 0.4), 1);
  rect(g, '#d83a3a', bx + bw - 30, by + bh - 20, 20, 12);
  rect(g, '#cdd4dc', bx + bw - 28, by + bh - 18, 16, 8);
  rect(g, '#d83a3a', bx + bw - 25, by + bh - 16, 2, 4);
  rect(g, '#d83a3a', bx + bw - 20, by + bh - 16, 6, 1);
  rect(g, '#d83a3a', bx + bw - 20, by + bh - 13, 6, 1);
  rect(g, '#5c6478', bx, by + bh + 3, bw, 3);
  for (const [c, x] of [['#d83a3a', 0.2], ['#3a5aa8', 0.26], ['#2a2a2a', 0.32]] as const) rect(g, c, bx + bw * x, by + bh + 1, 8, 2);
  // 포스트잇
  for (let i = 0; i < 4; i++) {
    const nx = bx + bw + 8 + (i % 2) * 14, ny = by + 6 + Math.floor(i / 2) * 15;
    if (nx + 11 > w * 0.6) break;
    rect(g, ['#f2d84a', '#f29ab0', '#9ad87a', '#f2d84a'][i], nx, ny, 11, 11);
    rect(g, '#00000030', nx + 2, ny + 4, 7, 1);
  }
  // 새벽 두 시 시계 · 어두운 창
  const ck = Math.round(Math.min(w * 0.62, w - 80)), cky = Math.round(h * 0.11);
  disc(g, '#4a5470', ck, cky, 10);
  disc(g, '#dfe4ea', ck, cky, 8);
  line(g, '#2a2a3a', ck, cky, 0, -6, 1);
  line(g, '#2a2a3a', ck, cky, 4, -2, 1);
  const ww = Math.round(Math.min(w * 0.26, 104)), wh = Math.round(Math.min(h * 0.3, 90));
  const wx = Math.round(w * 0.7), wy = Math.round(h * 0.07);
  rect(g, '#0c1226', wx, wy, ww, wh);
  for (let i = 0; i < 30; i++) rect(g, '#a8b4d0', wx + rand() * ww, wy + rand() * wh * 0.5, 1, 1);
  disc(g, '#f4ecc4', Math.round(wx + ww * 0.72), Math.round(wy + wh * 0.22), 4);
  rect(g, '#2a3048', wx, wy + wh * 0.62, ww, wh * 0.38);
  for (let i = 0; i < 9; i++) if (rand() > 0.55) rect(g, '#e8c870', wx + 4 + (i % 5) * (ww / 5), wy + wh * 0.68 + Math.floor(i / 5) * 9, 3, 3);
  windowFrame(g, wx, wy, ww, wh, '#3c4660', '#56617e');
  // 책상: 노트북 불빛 · 종이 더미 · 진동하는 휴대폰
  const deskY = Math.round(h * 0.47);
  rect(g, '#141a2c', 0, floorY, w, h - floorY);
  for (let y = floorY + 6; y < h; y += 9) rect(g, '#1c2338', 0, y, w, 1);
  rect(g, '#5a4a40', w * 0.04, deskY, w * 0.92, 4);
  rect(g, '#3a3030', w * 0.04, deskY + 4, w * 0.92, 3);
  rect(g, '#2c2426', w * 0.07, deskY + 7, 4, floorY - deskY - 7);
  rect(g, '#2c2426', w * 0.9, deskY + 7, 4, floorY - deskY - 7);
  const lx = Math.round(w * 0.42);
  wash(g, lx + 14, deskY - 14, 40, '#8ab8ff40');
  polygon(g, '#9aa4b4', [[lx - 4, deskY], [lx + 34, deskY], [lx + 30, deskY - 2], [lx, deskY - 2]]);
  rect(g, '#3a4250', lx + 1, deskY - 24, 28, 22);
  rect(g, '#bcd8ff', lx + 3, deskY - 22, 24, 18);
  for (let k = 0; k < 5; k++) rect(g, '#6a8ac8', lx + 5, deskY - 19 + k * 3, 6 + rand() * 14, 1);
  for (let k = 0; k < 5; k++) rect(g, ['#e8e4d8', '#d8d2c4'][k % 2], w * 0.14 + k, deskY - 3 - k * 2, 26, 2);
  const px = Math.round(w * 0.74);
  rect(g, '#20242e', px, deskY - 3, 14, 3);
  rect(g, '#5a8ad0', px + 2, deskY - 2, 10, 1);
  disc(g, '#f04a4a', px + 13, deskY - 5, 2);
  for (const d of [-1, 1]) rect(g, '#f0f0f080', px + 7 + d * 10, deskY - 6, 1, 3);
  rect(g, '#f2f0e8', w * 0.84, deskY - 9, 7, 9);
  rect(g, '#c84a3a', w * 0.84, deskY - 6, 7, 3);
}

/** 3. 처음 보는 사람들만 있는 자리: 전구 줄이 걸린 파티룸 */
export function quizParty(g: Ink, w: number, h: number) {
  const rand = seeded(5303);
  const floorY = Math.round(h * 0.57);
  sky(g, w, h, ['#4a2c44', '#6a3c52', '#3a2236']);
  for (let i = 0; i < 26; i++) wash(g, rand() * w, rand() * h * 0.5, 6 + rand() * 10, ['#f8c86a30', '#f86aa030', '#6ac8f830'][i % 3]);
  // 삼각 깃발 줄
  const flagY = Math.round(h * 0.05);
  for (let x = 0; x < w; x += 12) {
    const sag = Math.sin((x / w) * Math.PI) * h * 0.04;
    polygon(g, ['#f2d24a', '#4ab8e8', '#e84a6a', '#6ad87a'][(x / 12) % 4], [[x, flagY + sag], [x + 10, flagY + sag], [x + 5, flagY + sag + 9]]);
  }
  line(g, '#f2e6d0', 0, flagY, w, 0, 1);
  // 늘어진 전구 줄 두 가닥
  for (const [y0, drop, seed] of [[h * 0.16, h * 0.08, 0], [h * 0.25, h * 0.06, 3]] as const) {
    for (let x = 0; x <= w; x += 2) rect(g, '#2a1a22', x, y0 + Math.sin((x / w) * Math.PI) * drop, 1, 1);
    for (let i = 1; i < 12; i++) {
      const x = (i / 12) * w, y = y0 + Math.sin((i / 12) * Math.PI) * drop + 3;
      const c = ['#fff0a0', '#ffb070', '#ff8ab0', '#a0e8ff'][(i + seed) % 4];
      wash(g, x, y + 1, 9, c + '70');
      rect(g, c, x - 1, y, 3, 3);
    }
  }
  // 풍선 묶음
  const balloons: [number, number, string][] = [[0.07, 0.3, '#e84a5a'], [0.13, 0.24, '#4aa0e8'], [0.18, 0.32, '#f2c84a']];
  for (const [u, v, c] of balloons) {
    const x = Math.round(w * u), y = Math.round(h * v);
    line(g, '#e8dcc8', x, y + 7, w * 0.12 - x + w * 0.0, h * 0.44 - y - 7, 1);
    disc(g, c, x, y, 7);
    rect(g, '#ffffff90', x - 3, y - 4, 2, 2);
  }
  // 간식 테이블
  const tx = Math.round(w * 0.56), tw = Math.round(Math.min(w * 0.4, 160)), ty = Math.round(h * 0.42);
  rect(g, '#f2ecdc', tx, ty, tw, 5);
  for (let x = tx; x < tx + tw; x += 8) polygon(g, '#f2ecdc', [[x, ty + 5], [x + 8, ty + 5], [x + 4, ty + 12]]);
  rect(g, '#2a1a22', tx + 4, ty + 12, 3, floorY - ty - 12);
  rect(g, '#2a1a22', tx + tw - 7, ty + 12, 3, floorY - ty - 12);
  // 케이크 · 컵 · 과자 접시
  const ck = tx + Math.round(tw * 0.18);
  rect(g, '#f8e0e8', ck, ty - 10, 20, 10);
  rect(g, '#e8607a', ck, ty - 10, 20, 2);
  for (let k = 0; k < 3; k++) { rect(g, '#f2f2f2', ck + 4 + k * 6, ty - 15, 1, 5); rect(g, '#ffd040', ck + 4 + k * 6, ty - 17, 1, 2); }
  for (let k = 0; k < 3; k++) {
    const cx = tx + Math.round(tw * 0.48) + k * 8;
    rect(g, ['#e84a5a', '#4aa0e8', '#6ad87a'][k], cx, ty - 8, 5, 8);
    rect(g, '#ffffff60', cx, ty - 8, 5, 1);
  }
  rect(g, '#e8e0d0', tx + tw * 0.76, ty - 2, 22, 2);
  for (let k = 0; k < 5; k++) rect(g, '#d8a050', tx + tw * 0.76 + 2 + k * 4, ty - 5, 3, 3);
  // 바닥
  rect(g, '#2a1a24', 0, floorY - 2, w, 2);
  planks(g, w, h, floorY, '#5a3a3a', '#4a2e30', rand);
  for (let i = 0; i < 14; i++) rect(g, ['#f2d24a', '#4ab8e8', '#e84a6a', '#6ad87a'][i % 4], rand() * w, floorY + 3 + rand() * (h - floorY - 6), 2, 1);
}

/** 4. 아르바이트 · 화난 손님: 카페 카운터, 메뉴판과 커피 머신 */
export function quizCounter(g: Ink, w: number, h: number) {
  const rand = seeded(5404);
  const counterY = Math.round(h * 0.5);
  sky(g, w, h, ['#d8cdb8', '#cbbda4', '#b8a88c']);
  // 벽 타일
  for (let y = Math.round(h * 0.3); y < counterY; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < w; x += 12) rect(g, '#eae2d2', x + 1, y + 1, 10, 4);
  // 펜던트 조명
  for (const u of [0.2, 0.5, 0.8]) {
    const x = Math.round(w * u);
    rect(g, '#4a3a30', x, 0, 1, h * 0.05);
    polygon(g, '#3a4a3a', [[x - 7, h * 0.05 + 6], [x - 3, h * 0.05], [x + 4, h * 0.05], [x + 8, h * 0.05 + 6]]);
    wash(g, x, h * 0.05 + 8, 22, '#fff0c060');
  }
  // 메뉴판 (칠판)
  const mw = Math.round(Math.min(w * 0.56, 220)), mh = Math.round(Math.min(h * 0.17, 54));
  const mx = Math.round(w / 2 - mw / 2), my = Math.round(h * 0.1);
  rect(g, '#6a4a32', mx - 3, my - 3, mw + 6, mh + 6);
  rect(g, '#2c302c', mx, my, mw, mh);
  const cols = 3, cw = (mw - 12) / cols;
  for (let c = 0; c < cols; c++) {
    const cx = mx + 6 + c * cw;
    // 커피잔 아이콘
    rect(g, '#f2ead8', cx, my + 5, 7, 5);
    rect(g, '#f2ead8', cx + 7, my + 6, 2, 2);
    for (let r = 0; r < 4; r++) {
      const y = my + 14 + r * ((mh - 18) / 4);
      rect(g, '#d8d4c4', cx, y, cw * (0.45 + rand() * 0.25), 1);
      rect(g, '#f2c84a', cx + cw - 12, y, 6, 1);
    }
  }
  // 선반: 컵과 원두 병
  const sy = Math.round(h * 0.33);
  rect(g, '#7a5a3e', w * 0.04, sy, w * 0.92, 3);
  for (let x = w * 0.06; x < w * 0.94; x += 11) {
    if (rand() > 0.5) { rect(g, '#f4f0e6', x, sy - 7, 6, 7); rect(g, '#c8c0b0', x, sy - 2, 6, 1); }
    else { rect(g, '#8a5a3a', x, sy - 10, 6, 10); rect(g, '#d8c8a8', x, sy - 10, 6, 2); }
  }
  // 커피 머신
  const ex = Math.round(w * 0.7), ey = counterY - 26;
  rect(g, '#9aa2aa', ex, ey, 34, 26);
  rect(g, '#c8d0d6', ex, ey, 34, 3);
  rect(g, '#5a6268', ex + 6, ey + 10, 8, 8);
  rect(g, '#5a6268', ex + 20, ey + 10, 8, 8);
  rect(g, '#2a2a2a', ex + 9, ey + 18, 2, 4);
  rect(g, '#2a2a2a', ex + 23, ey + 18, 2, 4);
  for (let k = 0; k < 3; k++) rect(g, '#ffffff50', ex + 10 + k * 2, ey - 4 - k * 2, 1, 3);
  // 카운터 · 계산대 · 팁 병
  rect(g, '#d8b080', 0, counterY, w, 4);
  rect(g, '#8a5a3a', 0, counterY + 4, w, h - counterY - 4);
  for (let x = 8; x < w; x += 16) rect(g, '#7a4e32', x, counterY + 6, 1, h - counterY - 6);
  rect(g, '#6a4028', 0, counterY + 4, w, 2);
  const rx = Math.round(w * 0.16);
  rect(g, '#3a3e48', rx, counterY - 14, 26, 14);
  rect(g, '#8ac89a', rx + 3, counterY - 12, 20, 5);
  rect(g, '#20242a', rx + 16, counterY - 22, 8, 8);
  rect(g, '#6ad0a0', rx + 17, counterY - 21, 6, 5);
  const jx = Math.round(w * 0.32);
  rect(g, '#c8e4ec90', jx, counterY - 11, 9, 11);
  rect(g, '#f2c84a', jx + 2, counterY - 5, 2, 2);
  rect(g, '#6ab06a', jx + 5, counterY - 7, 2, 4);
  // 긴장감: 가장자리가 살짝 붉게
  const tense = g.createRadialGradient(w / 2, h * 0.35, Math.min(w, h) * 0.2, w / 2, h * 0.35, Math.max(w, h) * 0.7);
  tense.addColorStop(0, '#e8404000'); tense.addColorStop(1, '#e8404038');
  g.fillStyle = tense; g.fillRect(0, 0, w, h);
}

/** 5. 주말에 갑자기 시간이 빔: 햇살 좋은 공원 */
export function quizWeekend(g: Ink, w: number, h: number) {
  const rand = seeded(5505);
  const groundY = Math.round(h * 0.48);
  sky(g, w, groundY + 2, ['#5cb4ec', '#94d2f4', '#d4eefa']);
  const sunX = Math.round(w * 0.84), sunY = Math.round(h * 0.1);
  wash(g, sunX, sunY, 26, '#fff8d090');
  disc(g, '#fff6c8', sunX, sunY, 7);
  for (let i = 0; i < 5; i++) {
    const cx = rand() * w * 0.7, cy = h * (0.06 + rand() * 0.18), cw = 18 + rand() * 22;
    rect(g, '#ffffffe0', cx, cy, cw, 4);
    rect(g, '#ffffffe0', cx + 4, cy - 3, cw - 10, 3);
    rect(g, '#dceef8', cx + 2, cy + 4, cw - 4, 1);
  }
  // 먼 도시와 언덕
  for (let x = 0; x < w;) {
    const bw = 8 + Math.floor(rand() * 12), bh = 8 + Math.floor(rand() * 18);
    rect(g, '#a8c8dc', x, groundY - 10 - bh, bw, bh + 10);
    x += bw + 1;
  }
  polygon(g, '#8ccc7a', [[0, groundY - 6], [w * 0.3, groundY - 14], [w * 0.62, groundY - 7], [w, groundY - 16], [w, groundY], [0, groundY]]);
  // 잔디 · 산책길
  rect(g, '#74c062', 0, groundY, w, h - groundY);
  for (let i = 0; i < w * 0.8; i++) rect(g, ['#5aa84e', '#8ad270'][i % 2], rand() * w, groundY + rand() * (h - groundY), 1, 2);
  polygon(g, '#e8d4a4', [[w * 0.44, groundY], [w * 0.52, groundY], [w * 0.72, h], [w * 0.3, h]]);
  polygon(g, '#d8c090', [[w * 0.49, groundY], [w * 0.52, groundY], [w * 0.72, h], [w * 0.62, h]]);
  // 나무
  for (const [u, s] of [[0.08, 1], [0.24, 0.8], [0.9, 1.1]] as const) {
    const x = Math.round(w * u), r = Math.round(14 * s);
    rect(g, '#7a5232', x - 2, groundY - r - 4, 5, r + 6);
    disc(g, '#3e9a4e', x, groundY - r * 2, r);
    disc(g, '#52b05e', x - 3, groundY - r * 2 - 3, Math.round(r * 0.7));
  }
  // 벤치 · 꽃
  const bx = Math.round(w * 0.62), by = groundY + 4;
  rect(g, '#b07040', bx, by - 10, 34, 3);
  rect(g, '#b07040', bx, by - 5, 34, 3);
  rect(g, '#4a4a52', bx + 3, by - 2, 2, 8);
  rect(g, '#4a4a52', bx + 29, by - 2, 2, 8);
  for (let i = 0; i < 22; i++) {
    const fx = rand() * w, fy = groundY + 6 + rand() * (h - groundY - 8);
    rect(g, ['#f2e24a', '#f2f2f2', '#f28ab0'][i % 3], fx, fy, 2, 2);
  }
}

/** 6. "군대 가기 싫다…" 그래도 가야 한다면: 새벽의 훈련소 정문 */
export function quizGate(g: Ink, w: number, h: number) {
  const rand = seeded(5606);
  const groundY = Math.round(h * 0.52);
  sky(g, w, groundY + 2, ['#5a6c9a', '#b89aa8', '#f2c8a0', '#f8e0b8']);
  for (let i = 0; i < 18; i++) gleam(g, rand() * w, rand() * h * 0.12, 0, '#f4ecdc');
  // 겹겹이 산 능선
  for (const [base, color, amp, seed] of [[groundY - 26, '#8a8aa8', 14, 1.3], [groundY - 14, '#6a7a8a', 10, 2.1], [groundY - 4, '#4e6a62', 7, 3.7]] as const) {
    const pts: [number, number][] = [[0, groundY]];
    for (let x = 0; x <= w; x += 6) pts.push([x, base - amp * (0.5 + 0.5 * Math.sin(x / 23 + seed)) - 4 * Math.sin(x / 7 + seed * 2)]);
    pts.push([w, groundY]);
    polygon(g, color, pts);
  }
  // 땅 · 정문으로 이어지는 길
  rect(g, '#7a7a6a', 0, groundY, w, h - groundY);
  for (let i = 0; i < w * 0.5; i++) rect(g, '#6a6a5a', rand() * w, groundY + rand() * (h - groundY), 2, 1);
  polygon(g, '#9a968a', [[w * 0.42, groundY], [w * 0.58, groundY], [w * 0.8, h], [w * 0.2, h]]);
  for (let y = groundY + 6; y < h; y += 10) rect(g, '#e8e0c8', w / 2 - 1, y, 2, 5);
  // 철책
  for (let x = 0; x < w; x += 5) rect(g, '#5a5e5a', x, groundY - 12, 1, 12);
  rect(g, '#5a5e5a', 0, groundY - 12, w, 1);
  rect(g, '#5a5e5a', 0, groundY - 6, w, 1);
  // 정문 기둥 · 현판 · 별
  const gw = Math.round(Math.min(w * 0.44, 170)), gx = Math.round(w / 2 - gw / 2);
  const top = Math.round(h * 0.13), pw = 12;
  for (const x of [gx, gx + gw - pw]) {
    rect(g, '#c8c4b8', x, top, pw, groundY - top);
    rect(g, '#e8e4d8', x, top, 3, groundY - top);
    rect(g, '#8a8678', x + pw - 2, top, 2, groundY - top);
  }
  const sh = Math.round(Math.min(h * 0.1, 28));
  rect(g, '#2a4a32', gx - 6, top - 2, gw + 12, sh);
  rect(g, '#d8c070', gx - 6, top - 2, gw + 12, 2);
  rect(g, '#d8c070', gx - 6, top + sh - 4, gw + 12, 2);
  for (let k = 0; k < 6; k++) rect(g, '#f2ecd8', gx + gw * 0.28 + k * (gw * 0.08), top + sh / 2 - 3, gw * 0.05, 5);
  const stx = Math.round(gx + gw * 0.14), sty = Math.round(top + sh / 2 - 1);
  polygon(g, '#f2d24a', [[stx, sty - 6], [stx + 2, sty - 1], [stx + 7, sty - 1], [stx + 3, sty + 2], [stx + 5, sty + 7], [stx, sty + 4], [stx - 5, sty + 7], [stx - 3, sty + 2], [stx - 7, sty - 1], [stx - 2, sty - 1]]);
  // 위병소 · 국기 게양대
  const hx = Math.round(Math.max(4, gx - 40));
  rect(g, '#b8b4a4', hx, groundY - 24, 26, 24);
  rect(g, '#5a6a5a', hx - 2, groundY - 28, 30, 5);
  rect(g, '#8ab0c8', hx + 5, groundY - 18, 9, 7);
  const fx = Math.round(Math.min(w - 24, gx + gw + 30));
  rect(g, '#d8d8d8', fx, h * 0.08, 2, groundY - h * 0.08);
  rect(g, '#f4f4f0', fx + 2, h * 0.08, 18, 12);
  disc(g, '#d83a3a', fx + 11, Math.round(h * 0.08 + 5), 3);
  rect(g, '#2a4aa0', fx + 8, Math.round(h * 0.08 + 6), 7, 2);
  // 줄지어 들어가는 입영 장정들
  for (let i = 0; i < 6; i++) {
    const t = i / 6, x = w * (0.47 + 0.06 * Math.sin(i)), y = groundY + 2 + t * (h - groundY) * 0.25;
    const s = 3 + t * 3;
    rect(g, '#3a3a44', x - s / 2, y - s * 2.2, s, s * 2.2);
    rect(g, '#2a2a30', x - s / 2, y - s * 3, s, s * 0.9);
  }
  // 새벽빛
  wash(g, w / 2, groundY - 30, Math.max(w, h) * 0.4, '#fff0c818');
}
