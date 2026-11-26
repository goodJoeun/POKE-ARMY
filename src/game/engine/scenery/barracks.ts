import { type Ink, line, polygon, rect, seeded, sky, wash } from './pixels';

export function wakingBarracks(g: Ink, w: number, h: number) {
  const rand = seeded(1784), wall = Math.round(h * 0.28), floor = Math.round(h * 0.64);
  sky(g, w, h, ['#313e4d', '#697a7c', '#91998a', '#5e6f71']);
  // Looking up from a pillow: the ceiling joists converge towards the far wall.
  polygon(g, '#53646a', [[0, 0], [w, 0], [w, wall + 9], [0, wall]]);
  for (let x = -w; x < w * 2; x += Math.max(40, w * 0.28)) {
    const end = w * 0.54 + (x - w * 0.54) * 0.57;
    polygon(g, '#394b54', [[x, 0], [x + 7, 0], [end + 3, wall + 5], [end, wall + 5]]);
    line(g, '#81908a', x + 7, 0, end - x - 4, wall + 4);
  }
  line(g, '#3c5056', 0, wall, w, 8, 3);
  line(g, '#9da494', 0, wall + 3, w, 8);
  const tubeX = w * 0.57, tubeY = h * 0.12;
  polygon(g, '#34474e', [[tubeX, tubeY], [tubeX + w * 0.22, tubeY + 3], [tubeX + w * 0.24, tubeY + 8], [tubeX + 3, tubeY + 5]]);
  line(g, '#8d9d94', tubeX + 3, tubeY + 2, w * 0.21, 3, 2);
  line(g, '#c5c8aa', tubeX + 5, tubeY + 3, w * 0.20, 3);

  const wx = Math.round(w * 0.055), wy = wall + 10, ww = Math.round(w * 0.36), wh = Math.round((floor - wy) * 0.77);
  rect(g, '#43565b', wx - 3, wy - 3, ww + 6, wh + 7);
  const dawn = g.createLinearGradient(0, wy, 0, wy + wh);
  dawn.addColorStop(0, '#839db0'); dawn.addColorStop(0.55, '#e1b9a4'); dawn.addColorStop(1, '#f5d9b1');
  g.fillStyle = dawn; g.fillRect(wx, wy, ww, wh);
  for (let dx = 0; dx < ww; dx++) {
    const ridge = wh * 0.75 + Math.sin(dx / 14) * 3 + Math.sin(dx / 7) * 1.3;
    rect(g, '#788598', wx + dx, wy + ridge, 1, wh - ridge);
    const trees = wh * 0.90 + Math.sin(dx / 6) * 2 + rand() * 2;
    rect(g, '#576d77', wx + dx, wy + trees, 1, wh - trees);
  }
  wash(g, wx + ww * 0.60, wy + wh * 0.58, wh * 0.4, '#ffdeb357');
  for (const u of [0, 0.34, 0.67, 1]) {
    rect(g, '#566a6c', wx + ww * u - 1, wy, 2, wh);
    rect(g, '#c3bca5', wx + ww * u + 1, wy, 1, wh);
  }
  rect(g, '#72817f', wx, wy + wh * 0.28, ww, 2);
  rect(g, '#cdc3a8', wx - 5, wy + wh, ww + 11, 2);
  rect(g, '#5c6c6b', wx - 5, wy + wh + 2, ww + 11, 3);
  const clockX = w * 0.50, clockY = wy + 9;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const r = dx * dx + dy * dy;
    if (r < 52) rect(g, r < 34 ? '#d6cbb1' : '#4b5a59', clockX + dx, clockY + dy, 1, 1);
  }
  rect(g, '#4f5c59', clockX, clockY - 5, 1, 8);
  line(g, '#5c635f', clockX, clockY, -2, 3);
  const curtain = wx + ww - 10;
  polygon(g, '#849291', [[curtain, wy - 3], [curtain + 12, wy - 3], [curtain + 11, wy + wh + 3], [curtain + 4, wy + wh + 4], [curtain + 8, wy + wh * 0.54]]);
  line(g, '#b5b7a4', curtain + 3, wy, 5, wh * 0.52);
  // Number plates, vents and folded kit on the lockers.
  const lx = Math.round(w * 0.58), ly = wall + 19, lw = Math.max(17, Math.round(w * 0.082));
  for (let i = 0; lx + i * lw < w; i++) {
    const x = lx + i * lw, y = ly + Math.floor(i * 0.6), bottom = floor + 5 + i;
    rect(g, '#3e5258', x, y, lw, bottom - y);
    rect(g, i % 2 ? '#65797a' : '#71817e', x + 2, y + 2, lw - 4, bottom - y - 5);
    rect(g, '#8a9990', x + 2, y + 2, 1, bottom - y - 6);
    rect(g, '#b3b39b', x + lw / 2 - 4, y + 6, 8, 3);
    for (let j = 0; j < 3; j++) rect(g, '#4a6064', x + lw * 0.25, y + 12 + j * 2, lw * 0.5, 1);
    rect(g, '#40565b', x + 4, y + (bottom - y) * 0.57, 3, 6);
    rect(g, '#a7b0a5', x + 4, y + (bottom - y) * 0.57, 1, 4);
    rect(g, '#4c6265', x + lw - 5, y + 11, 2, 3);
    rect(g, '#4c6265', x + lw - 5, bottom - 10, 2, 3);
    if (i % 3 === 0) {
      rect(g, '#a5a68c', x + lw * 0.48, y + 19, 8, 10);
      rect(g, '#c6b797', x + lw * 0.48 + 2, y + 18, 4, 2);
      for (let k = 0; k < 3; k++) rect(g, '#79877c', x + lw * 0.48 + 2, y + 22 + k * 2, 4, 1);
    }
    if (i % 3 !== 1) {
      rect(g, '#495f5d', x + 3, y - 5, lw - 7, 5);
      rect(g, '#829080', x + 5, y - 6, lw - 11, 2);
      rect(g, '#6e7a6b', x + 8, y - 9, lw - 16, 3);
    }
  }
  rect(g, '#526466', 0, floor + 9, w, h - floor);
  for (let i = 0; i < 3; i++) {
    const left = wx + ww * i / 3, y = wy + wh + 6;
    polygon(g, '#ffdfa82a', [[left, y], [left + ww * 0.23, y], [w * 0.47 + i * ww / 3, floor + 26], [w * 0.37 + i * ww / 3, floor + 26]]);
  }
  // The edge of a neighbouring cot sits behind the nearer, crumpled army blanket.
  const bedY = floor - 3;
  polygon(g, '#84918a', [[0, bedY - 4], [w * 0.22, bedY - 4], [w * 0.39, bedY + 9], [0, bedY + 12]]);
  polygon(g, '#bab9a1', [[w * 0.04, bedY - 7], [w * 0.12, bedY - 7], [w * 0.16, bedY - 2], [w * 0.14, bedY], [w * 0.055, bedY + 1], [w * 0.025, bedY - 2]]);
  polygon(g, '#64796f', [[w * 0.14, bedY - 3], [w * 0.22, bedY - 3], [w * 0.37, bedY + 7], [w * 0.20, bedY + 8]]);
  line(g, '#a0a68b', w * 0.16, bedY - 2, w * 0.07, 9, 2);
  rect(g, '#41575c', 0, bedY + 12, w * 0.39, 3);
  rect(g, '#354a50', w * 0.36, bedY + 14, 3, 18);
  // 베개에 누운 채 내려다본 내 모포: 저 끝에 두 발이 솟은 둔덕, 발에서 내 쪽으로 퍼지는 부드러운 주름,
  // 턱밑에는 접어 내린 흰 홑이불. (가는 줄무늬를 늘어놓으면 무엇인지 읽히지 않는다)
  const base = h * 0.8;
  const bump = (x: number, at: number, half: number, tall: number) => {
    const u = (x - at) / half;
    return Math.abs(u) < 1 ? tall * (1 + Math.cos(u * Math.PI)) / 2 : 0;
  };
  const feetL = w * 0.44, feetR = w * 0.56, fw = Math.max(9, w * 0.055), fh = Math.max(7, h * 0.05);
  const quilt = (x: number) => base - bump(x, feetL, fw, fh) - bump(x, feetR, fw, fh * 0.85)
    - bump(x, w * 0.5, w * 0.3, h * 0.025) + Math.sin(x / w * 9) * 1.5;
  const fold = Math.round(h - Math.max(10, h * 0.05)); // 홑이불 접힌 자락의 윗선
  for (let x = 0; x < w; x++) {
    const y = Math.round(quilt(x));
    rect(g, '#a9ab8c', x, y, 1, 1);
    rect(g, '#7f8f80', x, y + 1, 1, 2);
    rect(g, '#63776d', x, y + 3, 1, h - y - 3);
  }
  // 발끝에서 내 쪽으로 퍼지는 주름: 그늘 진 쪽과 빛 받는 쪽을 넓게
  for (const [fx, spread] of [[feetL, -1], [feetL, -0.35], [feetR, 0.4], [feetR, 1.1]] as const) {
    const top = quilt(fx) + 4, endX = fx + spread * w * 0.32;
    polygon(g, '#4f645c88', [[fx - 2, top], [fx + 2, top], [endX + 9, fold], [endX - 6, fold]]);
    polygon(g, '#8a9a8455', [[fx + 2, top], [fx + 4, top + 1], [endX + 16, fold], [endX + 9, fold]]);
  }
  // 창으로 든 아침 볕이 모포 왼쪽 위에 따뜻하게 걸린다
  wash(g, w * 0.3, base + h * 0.04, w * 0.22, '#ffdfa82e');
  for (let i = 0; i < w * 1.2; i++) {
    const x = rand() * w, y = quilt(x) + 4 + rand() * (fold - quilt(x) - 4);
    rect(g, '#b6ba9926', x, y, 2, 1);
  }
  // 턱밑까지 덮은 홑이불의 접힌 자락
  for (let x = 0; x < w; x++) {
    const y = fold + Math.round(Math.sin(x / 23) * 1.5);
    rect(g, '#3f5250', x, y - 2, 1, 2);
    rect(g, '#d2d0b8', x, y, 1, h - y);
    rect(g, '#f0ead4', x, y, 1, 1);
  }
  for (let x = 6; x < w; x += 17) rect(g, '#b4b39c', x, fold + 3, 5, 1);

}
