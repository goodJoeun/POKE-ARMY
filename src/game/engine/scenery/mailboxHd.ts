import { type Ink, pixelText, seeded } from './pixels';
import { type Brush, brush, vignette } from './hd';

/** 왼쪽 끝을 맞춘 픽셀 글씨 (y = 글씨 한가운데). 쓴 폭을 돌려준다 */
function label(g: Ink, text: string, x: number, y: number, color: string, big = false) {
  const family = big ? 'Galmuri14' : 'Galmuri11', px = big ? 15 : 12;
  g.font = `${px}px ${family}, sans-serif`;
  const span = Math.round(g.measureText(text).width);
  pixelText(g, text, x + span / 2, y, color, family, px);
  return span;
}

function textWidth(g: Ink, text: string, big = false) {
  g.font = big ? '15px Galmuri14, sans-serif' : '12px Galmuri11, sans-serif';
  return Math.round(g.measureText(text).width);
}

/** 편지 봉투 아이콘 (16×11) */
function envelope(g: Ink, x: number, y: number, unread: boolean) {
  const px = (c: string, a: number, b: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(x + a, y + b, bw, bh); };
  px(unread ? '#5d6c63' : '#7c8a80', 0, 0, 16, 11);
  px(unread ? '#f3ecc8' : '#d5d6bd', 1, 1, 14, 9);
  for (let i = 0; i < 7; i++) {
    const d = Math.round(i * 0.72);
    px(unread ? '#8b8f76' : '#929a89', 1 + i, 1 + d, 1, 1);
    px(unread ? '#8b8f76' : '#929a89', 14 - i, 1 + d, 1, 1);
  }
  if (unread) px('#b5503f', 12, -2, 5, 5);
}

/** 화살표 모양 마우스 커서 */
function cursor(g: Ink, x: number, y: number) {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 5, 2, 2];
  rows.forEach((n, r) => { g.fillStyle = '#1c2a2c'; g.fillRect(x - 1, y + r - 1, n + 2, 3); });
  rows.forEach((n, r) => { g.fillStyle = '#f6f4e2'; g.fillRect(r > 8 ? x + 3 : x, y + r, r > 8 ? 2 : n, 1); });
}

/**
 * 모니터에 뜬 인터넷 편지함. 글씨는 캔버스 픽셀 그대로 찍으므로 (x0, y0)~(x1, y1)은 캔버스 픽셀이다.
 * 맨 윗줄이 엄마의 편지: 다른 편지는 날짜가 있는데 이 편지만 날짜 칸이 비어 있다.
 * dated면 그 칸이 빛나며 「11:00」이 떠오른다.
 */
function inbox(g: Ink, x0: number, y0: number, x1: number, y1: number, dated: boolean) {
  const px = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(x, y, bw, bh); };
  const span = x1 - x0;
  g.save();
  g.beginPath(); g.rect(x0, y0, span, y1 - y0); g.clip();
  px('#b6c3b0', x0, y0, span, y1 - y0);

  // 제목 줄
  px('#476770', x0, y0, span, 21);
  px('#5f838b', x0, y0, span, 1);
  px('#2f4a52', x0, y0 + 20, span, 1);
  label(g, '받은 편지함', x0 + 8, y0 + 10, '#f1f2dc', true);
  for (let i = 0; i < 3; i++) {
    px('#8fa9a8', x1 - 14 - i * 12, y0 + 6, 9, 9);
    px(i ? '#476770' : '#c56a54', x1 - 13 - i * 12, y0 + 7, 7, 7);
  }

  // 칸 이름
  const hy = y0 + 21, sender = x0 + 28, subject = x0 + 96, cell = 56, dateX = x1 - cell - 6;
  px('#8fa193', x0, hy, span, 15);
  px('#a9b8a8', x0, hy, span, 1);
  px('#6f8177', x0, hy + 14, span, 1);
  label(g, '보낸 사람', sender, hy + 7, '#33474a');
  if (dateX - subject > 40) label(g, '제목', subject, hy + 7, '#33474a');
  label(g, '날짜', dateX + Math.round((cell - textWidth(g, '날짜')) / 2), hy + 7, '#33474a');
  px('#7b8d81', subject - 4, hy + 3, 1, 9);
  px('#7b8d81', dateX - 5, hy + 3, 1, 9);

  // 엄마의 편지
  const ry = hy + 15, rh = 26;
  px(dated ? '#f1dea6' : '#e2cfa0', x0, ry, span, rh);
  px('#f4e6bd', x0, ry, span, 1);
  px('#b9a678', x0, ry + rh - 1, span, 1);
  px('#b5503f', x0, ry, 3, rh);
  envelope(g, x0 + 8, ry + 8, true);
  label(g, '엄마', sender, ry + 13, '#2b3f41', true);
  const room = dateX - subject - 8;
  const title = ['아들, 어디 아프니?', '아들, 어디…', '아들…'].find((t) => textWidth(g, t) <= room);
  if (title) label(g, title, subject, ry + 13, '#5c6658');
  // 날짜 칸
  if (dated) {
    // 빛은 편지 줄에서 아래로만 번진다 (칸 이름 「날짜」는 그대로 읽힌다)
    const light = g.createRadialGradient(dateX + cell / 2, ry + rh / 2, 4, dateX + cell / 2, ry + rh / 2, 50);
    light.addColorStop(0, '#fff6c8c0'); light.addColorStop(1, '#fff6c800');
    g.fillStyle = light; g.fillRect(x0, ry, span, y1 - ry);
  }
  px(dated ? '#c98a34' : '#a8966c', dateX, ry + 3, cell, rh - 6);
  px(dated ? '#fff6cf' : '#efe4bf', dateX + 1, ry + 4, cell - 2, rh - 8);
  if (dated) {
    px('#ffe9a6', dateX + 1, ry + rh - 6, cell - 2, 1);
    pixelText(g, '11:00', dateX + cell / 2, ry + 13, '#9a2f1f', 'Galmuri14', 15);
    // 반짝임: 밝은 바탕에서도 보이게 호박색 십자에 흰 심
    for (const [sx, sy, r] of [[dateX + cell + 1, ry + 3, 4], [dateX - 2, ry + rh - 4, 3], [dateX + cell - 9, ry + rh - 1, 2]]) {
      px('#e9a23e', sx - r, sy, r * 2 + 1, 1);
      px('#e9a23e', sx, sy - r, 1, r * 2 + 1);
      px('#fffbe4', sx - 1, sy, 3, 1);
      px('#fffbe4', sx, sy - 1, 1, 3);
    }
  } else {
    // 비어 있다는 표시: 안쪽 그늘과 옅은 점선
    px('#d6c99f', dateX + 1, ry + 4, cell - 2, 1);
    px('#d6c99f', dateX + 1, ry + 4, 1, rh - 8);
    for (let x = dateX + 8; x < dateX + cell - 8; x += 6) px('#cdbf95', x, ry + 13, 3, 1);
  }

  // 아래쪽 단추 줄: 답장
  const bar = 20, by = y1 - bar;
  // 다른 편지들: 날짜가 다 찍혀 있다 (글씨 대신 줄)
  const rand = seeded(605);
  for (let y = ry + rh, i = 0; y + 17 <= by; y += 17, i++) {
    px(i % 2 ? '#b0beab' : '#bcc8b5', x0, y, span, 17);
    px('#9fae9d', x0, y + 16, span, 1);
    envelope(g, x0 + 8, y + 3, false);
    px('#74857b', sender, y + 6, 22 + Math.floor(rand() * 16), 4);
    px('#8c9a8c', subject, y + 6, Math.max(8, Math.round(room * (0.45 + rand() * 0.5))), 4);
    px('#74857b', dateX + 10, y + 6, 14, 4);
    px('#74857b', dateX + 28, y + 6, 18, 4);
  }
  px('#8fa193', x0, by, span, bar);
  px('#6f8177', x0, by, span, 1);
  const bw = textWidth(g, '답장') + 26, bx = x1 - bw - 6; // 오른쪽 여백은 커서 자리
  px('#5b6f69', bx, by + 3, bw, bar - 5);
  px('#c6d0bd', bx, by + 3, bw - 1, bar - 6);
  px('#aab7a6', bx + 1, by + 4, bw - 2, bar - 7);
  label(g, '답장', bx + 8, by + 10, '#4f605b');
  label(g, '새 편지 1통', x0 + 8, by + 10, '#3f5352');
  cursor(g, dated ? bx + bw - 12 : dateX + cell - 16, dated ? by + 6 : ry + 15);

  // 브라운관 주사선과 테두리 쪽 어둠
  for (let y = y0 + 1; y < y1; y += 3) px('#1d343810', x0, y, span, 1);
  g.restore();
}

/** 브라운관 모니터: 받침 밑이 (0, 0), 유리는 (-130, -184)에서 260×134칸. 켜진 화면은 따로 그린다 */
function crt(B: Brush, on: boolean) {
  // 책상에 진 그림자, 벽에 진 그림자
  B.oval('#2a25207a', 8, 4, 96, 7);
  B.poly('#141f2440', [[150, -196], [186, -186], [186, -20], [150, -14]]);
  // 뒤로 뻗은 몸통 (오른쪽과 위쪽이 살짝 보인다)
  B.poly('#5f645c', [[150, -200], [166, -190], [166, -24], [150, -14]]);
  B.poly('#868778', [[-146, -200], [150, -200], [166, -190], [160, -193], [-140, -204]]);
  for (let y = -176; y < -40; y += 8) B.box('#484f4a', 154, y, 8, 3);
  // 앞면
  B.box('#b9b7a5', -150, -200, 300, 186);
  B.box('#dcd4bc', -150, -200, 300, 3);
  B.box('#cdc8b2', -150, -200, 3, 186);
  B.box('#9c9c8b', 146, -197, 4, 183);
  B.box('#a5a594', -147, -46, 293, 1);
  B.box('#c9c5af', -147, -45, 293, 1);
  B.box('#8a8f83', -150, -20, 300, 6);
  B.box('#70766d', -150, -15, 300, 1);
  // 유리 둘레
  B.box('#8f9284', -138, -192, 276, 150);
  B.box('#737a71', -138, -192, 276, 3);
  B.box('#737a71', -138, -192, 3, 150);
  B.box('#d2ccb6', -135, -45, 273, 3);
  B.box('#c3beaa', 135, -189, 3, 147);
  B.box('#16272b', -133, -187, 266, 140);
  B.box(on ? '#3b5d61' : '#1c2c2e', -130, -184, 260, 134);
  // 둥근 유리의 귀퉁이
  for (const [x, dx] of [[-130, 1], [130, -1]]) for (const [y, dy] of [[-184, 1], [-50, -1]]) {
    B.poly('#16272b', [[x, y], [x + dx * 7, y], [x, y + dy * 7]]);
  }
  if (!on) {
    // 꺼진 화면: 블라인드 틈의 빛이 비스듬히 비친다
    for (let i = 0; i < 6; i++) B.poly('#8fa39a16', [[-120 + i * 3, -170 + i * 14], [-40 + i * 3, -176 + i * 14], [-40 + i * 3, -171 + i * 14], [-120 + i * 3, -165 + i * 14]]);
    B.poly('#ffffff0a', [[40, -184], [84, -184], [20, -50], [-24, -50]]);
  }
  // 아래 턱: 통풍구 · 상표 · 단추 · 전원 불
  for (let x = -134; x < -92; x += 6) { B.box('#70776e', x, -36, 3, 10); B.box('#d6d0ba', x + 3, -36, 1, 10); }
  B.box('#8d9082', -16, -35, 32, 7);
  B.box('#6c7269', -12, -33, 24, 1); B.box('#6c7269', -8, -31, 16, 1);
  for (const x of [84, 98]) { B.box('#8a8d80', x, -36, 10, 8); B.box('#d4cfba', x, -36, 10, 1); B.box('#70766d', x, -29, 10, 1); }
  B.box('#4f5a50', 118, -36, 12, 8);
  B.box(on ? '#b7ee8e' : '#5d6f58', 120, -34, 8, 4);
  if (on) { B.box('#e9ffc9', 121, -34, 3, 1); B.glow('#b7ee8e50', 124, -32, 14); }
  // 목과 받침
  B.box('#7d8479', -42, -14, 84, 10);
  B.box('#969c8e', -42, -14, 30, 10);
  B.box('#5f665f', -42, -14, 84, 2);
  B.poly('#a9ab9a', [[-60, -4], [60, -4], [70, 4], [-70, 4]]);
  B.box('#c8c5b0', -59, -4, 118, 1);
  B.box('#676d66', -70, 4, 140, 3);
}

/** 자판: 윗변 가운데가 (0, 0), 앞으로 갈수록 넓어진다 */
function keyboard(B: Brush, lit: boolean) {
  B.poly('#2d28247a', [[-116, 6], [100, 6], [114, 46], [-132, 46]]);
  B.poly('#a9ab9a', [[-112, 0], [96, 0], [110, 36], [-126, 36]]);
  B.poly('#c9c7b3', [[-112, 0], [96, 0], [97, 2], [-113, 2]]);
  B.poly('#777c72', [[-126, 36], [110, 36], [110, 41], [-126, 41]]);
  B.box('#5c625b', -126, 40, 236, 1);
  for (let row = 0; row < 5; row++) {
    const y = 4 + row * 6, lean = y * 0.39;
    const x0 = -106 - lean, x1 = 90 + lean;
    B.poly('#666d66', [[x0 - 1, y - 1], [x1 + 1, y - 1], [x1 + 3, y + 5], [x0 - 3, y + 5]]);
    const keys = row === 4 ? [2, 2, 2, 10, 2, 2, 2] : row === 0 ? [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] : row === 2 ? [2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.8, 1, 1, 1] : [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.4, 1, 1, 1];
    const total = keys.reduce((a, b) => a + b, 0), unit = (x1 - x0) / total;
    let x = x0;
    keys.forEach((k, i) => {
      const edge = i === 0 || i >= keys.length - 3 || (row === 4 && i !== 3);
      const kw = k * unit - 1.6;
      B.box(edge ? '#9fa294' : '#d9d6c1', x + 0.8, y, kw, 4);
      B.box(edge ? '#b9baa9' : '#f0ecd8', x + 0.8, y, kw, 1);
      x += k * unit;
    });
  }
  if (lit) B.glow('#b9e2c61c', -8, 4, 110);
}

/**
 * 싸지방 (사이버지식정보방) 책상 끝의 낡은 컴퓨터, 저녁 식사 직후 (고해상도).
 * 책상 선은 화면 높이의 55%, 모니터는 화면 가운데. 블라인드는 왼쪽 벽, 옆자리의 프린터는 오른쪽.
 * dated = P-06을 푼 뒤: 엄마의 편지에서 비어 있던 날짜 칸이 빛나며 「11:00」이 떠오른다.
 */
function terminalHd(g: Ink, w: number, h: number, dated: boolean) {
  const rand = seeded(1104);
  const s = Math.min(1.25, h / 440, w / 440);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const desk = Math.round(h * 0.55), cx = Math.round(w / 2);
  const tall = h > w * 1.2;
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
  const P = brush(g, 0, 0, 1); // 캔버스 픽셀 그대로
  const M = brush(g, cx, desk, s); // 모니터와 책상 위 물건

  // ── 벽 ──
  const wall = g.createLinearGradient(0, 0, 0, desk);
  wall.addColorStop(0, '#24343f'); wall.addColorStop(0.6, '#4b5d61'); wall.addColorStop(1, '#5f6f6e');
  g.fillStyle = wall; g.fillRect(0, 0, w, desk);
  for (let i = 0; i < w * 0.9; i++) fill(i % 2 ? '#ffffff07' : '#0000000b', rand() * w, rand() * desk, 2 + rand() * 10, 1);

  // ── 블라인드: 살 틈으로 저녁 햇빛이 새어 들어온다 ──
  const wx = Math.round(w * 0.025), ww = Math.round(w * 0.21), sill = desk - u(34);
  fill('#18262c', wx - u(6), 0, ww + u(12), sill);
  fill('#3a4a4f', wx - u(6), 0, u(2), sill);
  const dusk = g.createLinearGradient(0, 0, 0, sill);
  dusk.addColorStop(0, '#5d6466'); dusk.addColorStop(0.55, '#a98462'); dusk.addColorStop(1, '#d69a62');
  g.fillStyle = dusk; g.fillRect(wx, 0, ww, sill - u(2));
  const pitch = u(14), slat = pitch - Math.max(2, u(4));
  const first = u(16), last = sill - u(7);
  // 벽에 드리운 빛줄기
  for (let y = first; y < last; y += pitch) {
    const x = wx + ww + u(6), y0 = y + slat;
    P.poly('#f0cfa016', [[x, y0], [x + u(52), y0 + u(16)], [x + u(52), y0 + u(16) + pitch - slat + 1], [x, y0 + pitch - slat + 1]]);
    P.poly('#f0cfa010', [[x, y0], [x + u(96), y0 + u(30)], [x + u(96), y0 + u(30) + pitch - slat + 1], [x, y0 + pitch - slat + 1]]);
  }
  for (let y = first; y < last; y += pitch) {
    fill('#8c9890', wx, y, ww, slat);
    fill('#bcc5b6', wx, y, ww, Math.max(1, u(2)));
    fill('#6f7c77', wx, y + slat - Math.max(1, u(3)), ww, Math.max(1, u(3)));
    fill('#e5c59c', wx, y + slat - 1, ww, 1);
    fill('#2a3a3fa0', wx, y + slat, ww, 1);
  }
  // 머리 상자 · 사다리 끈 · 조절 봉 · 아래 막대
  fill('#56646a', wx - u(2), u(4), ww + u(4), u(10));
  fill('#8d9a9a', wx - u(2), u(4), ww + u(4), 1);
  fill('#2b393e', wx - u(2), u(13), ww + u(4), 1);
  for (const k of [0.2, 0.8]) {
    fill('#ded5bb', wx + Math.round(ww * k), u(14), 1, last - u(14));
    fill('#3e4c4c80', wx + Math.round(ww * k) + 1, u(14), 1, last - u(14));
  }
  fill('#56646a', wx - u(1), last - u(2), ww + u(2), u(6));
  fill('#96a3a0', wx - u(1), last - u(2), ww + u(2), 1);
  fill('#c9c3ad', wx + u(8), u(14), Math.max(1, u(2)), Math.round(sill * 0.42));
  fill('#8d8a78', wx + u(8) + Math.max(1, u(2)), u(14), 1, Math.round(sill * 0.42));
  fill('#c9c3ad', wx + u(7), u(14) + Math.round(sill * 0.42), u(4), u(8));
  // 창턱
  fill('#6b777a', wx - u(10), sill, ww + u(20), u(5));
  fill('#a3aca8', wx - u(10), sill, ww + u(20), 1);
  fill('#39474b', wx - u(8), sill + u(5), ww + u(16), u(3));
  P.glow('#f1c48c20', wx + ww, Math.round(sill * 0.6), Math.round(ww * 1.5));

  // ── 책상 뒤 칸막이와 상판 ──
  fill('#3d4a4d', 0, desk - u(14), w, u(14));
  fill('#627071', 0, desk - u(14), w, 1);
  fill('#2b3638', 0, desk - u(3), w, u(3));
  const top = g.createLinearGradient(0, desk, 0, h);
  top.addColorStop(0, '#7f7266'); top.addColorStop(1, '#695e54');
  g.fillStyle = top; g.fillRect(0, desk, w, h - desk);
  fill('#a39483', 0, desk, w, 1);
  for (let i = 0; i < w * 1.6; i++) {
    const y = desk + 2 + rand() ** 0.9 * (h - desk - 2);
    fill(i % 4 ? '#b396772a' : '#4c423a30', rand() * w, y, (6 + rand() * 40) * s, 1);
  }
  // 창에서 온 빛이 책상에도 살짝 눕는다
  P.poly('#f0cfa00d', [[wx, desk + 1], [wx + ww, desk + 1], [wx + ww + u(130), h], [wx + u(40), h]]);

  // ── 벽에 붙은 이용 수칙과 시계 (18:30). 휴대폰처럼 세로가 길면 모니터 위 빈 벽에 건다 ──
  {
    // 종이 폭: 제목 글씨(캔버스 픽셀 그대로)가 붉은 띠 안에 여유 있게 들어가도록
    const nw = Math.max(68, Math.ceil(textWidth(g, '이용 수칙') / s) + 18), mid = nw / 2;
    const nx = tall ? Math.round(w * 0.62 - mid * s) : Math.round(Math.min(cx + 206 * s, w - (nw + 8) * s));
    const ny = Math.round(tall ? desk * 0.42 : desk * 0.25);
    const N = brush(g, nx, ny, s);
    N.box('#17232880', 4, 4, nw, 88);
    N.box('#cbc4a8', 0, 0, nw, 88);
    N.box('#ddd7bd', 0, 0, nw, 1);
    N.box('#a9a38a', nw - 2, 1, 2, 87);
    N.box('#a9a38a', 0, 86, nw, 2);
    N.box('#8a3a30', 5, 6, nw - 10, 16);
    N.box('#a34d40', 5, 6, nw - 10, 1);
    pixelText(g, '이용 수칙', N.X(mid), N.Y(14), '#f1e6cb', 'Galmuri11', 12);
    for (let i = 0; i < 7; i++) {
      const y = 30 + i * 8;
      N.box('#8a3a30', 7, y, 3, 3);
      N.box('#7f7d6e', 14, y, (i % 3 === 2 ? 0.55 : 0.9) * (nw - 22), 2);
      if (i % 3 !== 2) N.box('#9d9a88', 14, y + 3, 30 - i * 2, 1);
    }
    N.box('#d9d2b8', mid - 6, -3, 12, 6); N.box('#b9b39a', mid - 6, 2, 12, 1);
    // 시계: 큰바늘은 6, 작은바늘은 6과 7 사이
    const kx = mid, ky = -30;
    N.oval('#17232870', kx + 3, ky + 3, 15, 15);
    N.oval('#33423f', kx, ky, 15, 15);
    N.oval('#5a6a66', kx, ky, 15, 15, (dx, dy) => dx + dy < -0.9);
    N.oval('#e0d9c0', kx, ky, 12, 12);
    N.oval('#c9c2aa', kx, ky, 12, 12, (dx, dy) => dx + dy > 0.95);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, r = i % 3 ? 10 : 9.4;
      N.box('#4a5653', kx + Math.sin(a) * r - 0.6, ky - Math.cos(a) * r - 0.6, i % 3 ? 1.2 : 2, i % 3 ? 1.2 : 2);
    }
    N.seg('#2b3536', kx, ky, kx, ky + 9, 1.4);
    N.seg('#2b3536', kx, ky, kx - 1.8, ky + 6, 2);
    N.box('#8a3a30', kx - 1, ky - 1, 2, 2);
  }

  // ── 넓은 화면: 옆자리의 꺼진 컴퓨터 ──
  if (w / 2 > 560 * s) {
    const E = brush(g, Math.round(cx + 452 * s), desk, s);
    crt(E, false);
    const K = brush(g, Math.round(cx + 452 * s), desk + u(12), s);
    keyboard(K, false);
  }

  // ── 옆자리의 도트 프린터와 줄줄이 나온 연속 용지 ──
  M.oval('#2a25206a', 228, 2, 62, 6);
  M.box('#3b4546', 172, -8, 106, 8);
  M.box('#85877c', 172, -50, 104, 44);
  M.box('#a5a595', 172, -50, 104, 12);
  M.box('#c2bfaa', 172, -50, 104, 1);
  M.box('#6c7068', 172, -10, 104, 4);
  M.box('#9a9b8b', 172, -38, 2, 28);
  M.box('#2c3637', 180, -46, 74, 6);
  M.box('#4b5656', 180, -41, 74, 1);
  M.box('#5d655f', 258, -34, 14, 22);
  M.box('#b7ee8e', 261, -31, 3, 3);
  M.box('#d8a65a', 267, -31, 3, 3);
  for (const y of [-25, -19]) { M.box('#a9aa9a', 261, y, 9, 4); M.box('#3f4847', 261, y + 4, 9, 1); }
  // 용지: 홈에서 나와 앞으로 넘어간 뒤 책상에 접혀 쌓인다
  const sheet = (x0: number, y0: number, x1: number, y1: number, lean: number, base: string, band: string) => {
    M.poly(base, [[x0, y0], [x1, y0], [x1 + lean, y1], [x0 + lean, y1]]);
    for (let y = y0 + 2, i = 0; y < y1 - 1; y += 4, i++) {
      const k = lean * (y - y0) / (y1 - y0);
      if (i % 2) M.box(band, x0 + k + 6, y, x1 - x0 - 12, 2.4);
      M.box('#5d6462', x0 + k + 2, y, 1.6, 1.6);
      M.box('#5d6462', x1 + k - 3.6, y, 1.6, 1.6);
      if (i % 2 === 0) M.box('#7d8172', x0 + k + 9, y + 0.6, 12 + rand() * 34, 1);
    }
  };
  sheet(184, -44, 250, -4, 0, '#d8d1b5', '#c3ccac');
  M.box('#efe8cf', 184, -44, 66, 1);
  sheet(184, -4, 250, 16, 12, '#c2bca2', '#b0b89a');
  M.box('#e2dbc0', 184, -4, 66, 1);
  M.box('#8f8b78', 196, 16, 66, 2);
  M.box('#b5af96', 198, 18, 66, 2);

  // ── 모니터 ──
  M.glow(dated ? '#e9e6b430' : '#b3dbbd28', 0, -116, 250);
  crt(M, true);
  const x0 = M.X(-126), y0 = M.Y(-180), x1 = M.X(126), y1 = M.Y(-54);
  inbox(g, x0, y0, x1, y1, dated);
  // 유리에 비친 빛
  M.poly('#ffffff0c', [[-122, -180], [-84, -180], [-126, -112], [-126, -150]]);
  if (dated) M.glow('#fff0b02e', 96, -150, 120);
  // 화면 빛이 책상에 고인다
  g.save();
  g.translate(0, desk + u(26)); g.scale(1, 0.3); g.translate(0, -(desk + u(26)));
  M.glow(dated ? '#f1eab82a' : '#bfe6cc26', 0, 26, 230);
  g.restore();

  // ── 싸지방 이용 대장 (클립보드)과 볼펜 ──
  M.poly('#2a25206a', [[-204, 26], [-146, 22], [-138, 74], [-198, 78]]);
  M.poly('#5b4a38', [[-210, 20], [-152, 16], [-144, 68], [-204, 72]]);
  M.poly('#7a6650', [[-210, 20], [-152, 16], [-151.6, 18], [-209.8, 22]]);
  M.poly('#d3c9ab', [[-205, 24], [-155, 20.6], [-148.4, 64], [-200, 67.6]]);
  M.poly('#b9ad8f', [[-200.6, 64.6], [-148.8, 61], [-148.4, 64], [-200, 67.6]]);
  M.poly('#8a3a30', [[-200, 30], [-176, 28.4], [-175.6, 31.4], [-199.6, 33]]);
  for (let i = 0; i < 6; i++) M.seg('#8a8270', -199 + i * 0.6, 38 + i * 4.6, -155 + i * 0.6, 35 + i * 4.6, 0.8);
  M.seg('#9d9480', -184, 36, -180, 64, 0.8);
  M.seg('#9d9480', -168, 35, -164, 63, 0.8);
  M.box('#4d524f', -192, 13, 22, 9);
  M.box('#a9aeaa', -192, 13, 22, 2);
  M.box('#7b807c', -186, 10, 10, 4);
  M.seg('#2c3f55', -140, 30, -128, 70, 2.4);
  M.seg('#5b7896', -140.6, 30, -128.6, 70, 0.9);
  M.seg('#c9c3ad', -128, 70, -127, 73, 1.4);

  // ── 자판 · 마우스 ──
  const K = brush(g, cx - u(8), desk + u(12), s);
  keyboard(K, true);
  // 마우스 줄: 모니터 받침 뒤에서 돌아 나온다
  M.seg('#4a5551', 70, 2, 96, 9, 1.6);
  M.seg('#4a5551', 96, 9, 132, 6, 1.6);
  M.seg('#4a5551', 132, 6, 138, 12, 1.6);
  M.seg('#4a5551', 138, 12, 127, 20, 1.6);
  M.oval('#2a252070', 127, 42, 17, 5);
  M.poly('#aeb09e', [[117, 20], [133, 20], [140, 27], [141, 40], [137, 44], [113, 44], [109, 40], [110, 27]]);
  M.poly('#cfcdb9', [[117, 20], [133, 20], [138, 25], [112, 25]]);
  M.box('#7f867c', 110, 31, 31, 1);
  M.box('#7f867c', 125, 21, 1, 10);
  M.poly('#8d9285', [[109, 40], [141, 40], [137, 44], [113, 44]]);

  // ── 마시다 둔 종이컵 ──
  M.oval('#2a252070', 160, 26, 14, 4);
  M.poly('#d6d0bf', [[146, -6], [168, -6], [165, 26], [149, 26]]);
  M.poly('#b3ad9d', [[162, -6], [168, -6], [165, 26], [160, 26]]);
  M.poly('#8a3a30', [[147, 5], [167, 5], [166.4, 11], [147.6, 11]]);
  M.poly('#6f2e27', [[162, 5], [167, 5], [166.4, 11], [161.6, 11]]);
  M.box('#f1ebdb', 145, -8, 24, 3);
  M.box('#4a3528', 148, -7, 18, 1);
  M.box('#a39d8d', 149, 25, 16, 2);

  vignette(g, w, h, '#0b1418', 0.3);
}

export function mailboxHd(g: Ink, w: number, h: number) { terminalHd(g, w, h, false); }
export function datedMailboxHd(g: Ink, w: number, h: number) { terminalHd(g, w, h, true); }
