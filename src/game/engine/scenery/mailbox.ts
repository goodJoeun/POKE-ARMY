import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

/** CRT at the end of a row of desks, just after the evening meal. */
function terminal(g: Ink, w: number, h: number, dated: boolean) {
  const rand = seeded(1104);
  const desk = Math.round(h * .55), cx = Math.round(w / 2);
  sky(g, w, h, ['#283846', '#627171', '#36474a']);
  // Venetian blinds and the warm stripes they throw across the wall.
  const sill = desk - 17, wx = w * .025, ww = w * .21;
  rect(g, '#26383e', wx - 2, 2, ww + 4, sill);
  for (let y = 5; y < sill - 3; y += 7) {
    rect(g, '#8c9890', wx, y, ww, 5);
    rect(g, '#cfb59c', wx, y + 4, ww, 1);
    polygon(g, '#ebceaa12', [[wx + ww, y + 2], [wx + ww, y + 5], [wx + ww + 37, y + 15], [wx + ww + 37, y + 12]]);
  }
  rect(g, '#465257', wx - 3, sill, ww + 6, 3);
  rect(g, '#444f50', 0, desk - 7, w, 6);
  rect(g, '#786c60', 0, desk - 1, w, h - desk + 1);
  for (let i = 0; i < w; i++) rect(g, '#b396772e', rand() * w, desk + rand() * (h - desk), 3 + rand() * 23, 1);

  // 벽에 붙은 이용 수칙과 시계 (저녁 식사 직후 18:30). 휴대폰처럼 세로가 길면 모니터 위 빈 벽에 건다
  {
    const tall = h > w * 1.2, nw = 34, nh = 44;
    const nx = Math.round(tall ? w * 0.62 - nw / 2 : cx + Math.min(1.1, w / 216, h / 200) * 100);
    const ny = Math.round(tall ? desk * 0.42 : desk * 0.2);
    rect(g, '#1f2b2f', nx + 2, ny + 2, nw, nh);
    rect(g, '#cbc4a8', nx, ny, nw, nh);
    rect(g, '#8a3a30', nx + 3, ny + 3, nw - 6, 5);
    for (let i = 0; i < 7; i++) rect(g, '#7f7d6e', nx + 4, ny + 12 + i * 4, (i % 3 === 2 ? 0.55 : 0.82) * (nw - 8), 1);
    rect(g, '#b9b39a', nx + nw / 2 - 1, ny - 1, 3, 2);
    const kx = nx + nw / 2, ky = ny - 16, r = 7;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r) rect(g, d > (r - 1.5) ** 2 ? '#3b4a4c' : '#d8d1b8', kx + x, ky + y, 1, 1);
    }
    rect(g, '#2b3536', kx, ky, 1, 5);
    line(g, '#2b3536', kx, ky, 1, 3);
  }

  // Keep the envelope and its empty date cell legible on both phones and desktops.
  const scale = Math.min(1.1, w / 216, h / 200);
  g.save();
  g.translate(cx, desk);
  g.scale(scale, scale);
  // Fan-fold paper feeding out of a dot-matrix printer on the next desk.
  rect(g, '#3b4546', 84, -23, 51, 22);
  rect(g, '#85877c', 84, -25, 51, 17);
  rect(g, '#394444', 90, -19, 38, 4);
  rect(g, '#ccc5a8', 92, -17, 33, 15);
  polygon(g, '#b6b299', [[92,-2],[125,-2],[132,8],[98,8]]);
  for (let y = -15; y < -3; y += 3) {
    rect(g, '#606765', 94, y, 1, 1);
    rect(g, '#606765', 122, y, 1, 1);
    rect(g, '#8d917f', 97, y, 10 + rand() * 10, 1);
  }
  line(g, '#d5c5ac', 91, -2, 35, 0);
  // Monitor housing, glass lip and phosphor screen.
  wash(g, 0, -41, 93, '#b3dbbd25');
  polygon(g, '#414c50', [[-73,-84],[71,-84],[81,-76],[81,-10],[70,-4],[-73,-4]]);
  rect(g, '#b9b7a5', -74, -84, 146, 78);
  rect(g, '#d9cfb7', -74, -84, 146, 2);
  rect(g, '#888e83', -74, -9, 146, 4);
  rect(g, '#666f69', -68, -79, 134, 62);
  rect(g, '#253d41', -66, -78, 130, 59);
  rect(g, '#426467', -64, -76, 126, 55);
  rect(g, '#899d92', -20, -5, 41, 6);
  rect(g, '#525e5c', -29, 1, 59, 2);
  for (let x = -64; x < -44; x += 3) rect(g, '#737d74', x, -14, 1, 3);
  rect(g, '#75966d', 57, -14, 4, 2);
  rect(g, '#d4f2aa', 58, -14, 2, 1);
  // The first row is mother's letter. Only its date changes after solving P-06.
  rect(g, '#b6c3b0', -58, -72, 114, 47);
  rect(g, '#476770', -57, -71, 112, 11);
  g.fillStyle = '#eef0d7';
  g.font = '10px Galmuri11, sans-serif';
  g.fillText('받은 편지함', -53, -62);
  rect(g, '#e2cfa0', -56, -57, 110, 13);
  for (let i = 0; i < 3; i++) {
    const y = [-55,-41,-32][i];
    rect(g, '#65746b', -53, y + 1, 9, 6);
    rect(g, '#e5dfba', -52, y + 2, 7, 4);
    line(g, '#89917e', -52, y + 1, 3, 3);
    line(g, '#89917e', -49, y + 4, 4, -3);
    if (i > 0) {
      rect(g, '#819085', -38, y + 3, i === 1 ? 36 : 23, 2);
      rect(g, '#8f9a8a', 26, y + 3, 20, 2);
    }
  }
  g.fillStyle = '#384f51';
  g.fillText('엄마', -39, -47);
  // 날짜 칸: 처음엔 비어 있고, P-06을 풀면 글자가 떠오르며 칸이 빛난다
  if (dated) wash(g, 36, -51, 30, '#fff0b070');
  rect(g, dated ? '#d9a650' : '#bba980', 19, -56, 34, 11);
  rect(g, dated ? '#fff2c2' : '#e9dcb3', 20, -55, 32, 9);
  if (dated) {
    g.fillStyle = '#8a3324'; // rect()가 붓 색을 바꿔 두므로 글씨 색을 다시 정한다
    g.fillText('11:00', 22, -47);
    for (const [sx, sy] of [[52, -58], [18, -46]]) {
      rect(g, '#fff8dc', sx - 2, sy, 5, 1);
      rect(g, '#fff8dc', sx, sy - 2, 1, 5);
    }
  }
  // 싸지방 이용 대장 (클립보드)과 마시다 둔 종이컵
  polygon(g, '#3d3a33', [[-104, 10], [-76, 8], [-72, 34], [-101, 36]]);
  polygon(g, '#b9ad8f', [[-102, 10], [-77, 9], [-74, 33], [-99, 34]]);
  rect(g, '#6b6f6a', -93, 7, 9, 4);
  for (let i = 0; i < 6; i++) line(g, '#8a8270', -98 + i * 0.12, 15 + i * 3, 19, -1);
  rect(g, '#5b6f7e', -82, 13, 1, 18);
  polygon(g, '#d6d0bf', [[72, -2], [82, -2], [81, 12], [73, 12]]);
  rect(g, '#efe9d8', 72, -2, 10, 1);
  rect(g, '#7b3a32', 73, 3, 8, 2);
  rect(g, '#4f4a40', 72, 12, 10, 2);
  // Keyboard and coiled mouse lead pick up the light from the glass.
  polygon(g, '#4a5251', [[-55,6],[43,6],[53,24],[-64,24]]);
  polygon(g, '#a7aa99', [[-55,5],[42,5],[50,21],[-62,21]]);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 16; col++) rect(g, '#697870', -52 + col * 6 - row, 7 + row * 4, 4, 2);
  rect(g, '#728078', -32, 19, 36, 2);
  line(g, '#4f5c56', 61, 9, 4, -5);
  line(g, '#4f5c56', 65, 4, -9, -6);
  polygon(g, '#aeb09e', [[57,9],[64,9],[68,13],[67,19],[55,19],[54,14]]);
  line(g, '#6d7971', 61, 9, 0, 5);
  g.restore();
}

export function mailbox(g: Ink, w: number, h: number) { terminal(g, w, h, false); }
export function datedMailbox(g: Ink, w: number, h: number) { terminal(g, w, h, true); }
