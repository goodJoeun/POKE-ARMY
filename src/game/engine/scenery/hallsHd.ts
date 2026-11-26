import { type Ink, type Point, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

/** 두 색을 섞는다 (t = 0 이면 a, 1 이면 b) */
const mix = (a: string, b: string, t: number) => {
  const p = (c: string, i: number) => parseInt(c.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
};

/** 복도의 치수 (끝벽에서의 설계 칸): 반폭 · 천장 · 바닥 · 허리띠 높이. 눈높이가 0이라 바닥이 가깝다 (작은 포켓몬의 눈높이) */
const HW = 62, TOP = -84, BOT = 38, RAIL = 8;
/** 끝벽까지의 거리 (m) */
const FAR = 10;

/**
 * 불 꺼진 막사 복도 (고해상도). 소실점 하나로 모이는 복도 끝에 지휘통제실 문이 있고, 문의 철망 유리만 불이 켜져 있다.
 * 왼쪽 벽은 창, 오른쪽 벽은 생활관 문: 창으로 든 달빛이 오른쪽 벽 아래와 바닥에 비스듬히 눕는다.
 * 소실점은 예전 그림과 같은 자리(가로 49%, 세로 39%)다. 화면이 넓어지면 가까운 벽이 더 보일 뿐이다.
 * mark 를 주면 바닥 왁스에 진자를 끈 듯한 동그란 자국이 남는다.
 */
function corridor(g: Ink, w: number, h: number, mark: boolean) {
  const rand = seeded(1407);
  const s = Math.min(h / 480, w / 340);
  const cx = Math.round(w * 0.49), vanY = Math.round(h * 0.39);
  const C = brush(g, cx, vanY, s);
  // 벽과 바닥이 화면 밖으로 나갈 때까지의 배율
  const K = Math.max(Math.max(cx, w - cx) / (HW * s), (h - vanY) / (BOT * s), vanY / (-TOP * s)) + 0.5;
  /** 복도 안의 한 점 (x = 가운데에서 옆으로, v = 눈높이에서 아래로, z = 나에게서의 거리 m) */
  const P = (x: number, v: number, z: number): Point => { const k = FAR / Math.max(z, FAR / K); return [x * k, v * k]; };
  const shade = (k: number) => Math.min(1, Math.log(k) / Math.log(8));
  /** 깊이에 따라 색이 달라지는 면: 띠로 나눠 칠한다 */
  const surface = (far: string, near: string, quad: (k1: number, k2: number) => Point[]) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const k1 = K ** (i / n), k2 = K ** ((i + 1) / n);
      C.poly(mix(far, near, shade(Math.sqrt(k1 * k2))), quad(k1, k2));
    }
  };
  const wall = (side: number, v1: number, v2: number, far: string, near: string) =>
    surface(far, near, (a, b) => [[side * HW * a, v1 * a], [side * HW * b, v1 * b], [side * HW * b, v2 * b], [side * HW * a, v2 * a]]);
  /** 벽에 붙은 네모 (x 를 HW 보다 크게 주면 벽 속으로 들어간 면) */
  const onWall = (c: string, side: number, z1: number, z2: number, v1: number, v2: number, x = HW) =>
    C.poly(c, [P(side * x, v1, z1), P(side * x, v1, z2), P(side * x, v2, z2), P(side * x, v2, z1)]);
  const onFloor = (c: string, x1: number, x2: number, z1: number, z2: number, v = BOT) =>
    C.poly(c, [P(x1, v, z1), P(x2, v, z1), P(x2, v, z2), P(x1, v, z2)]);

  g.fillStyle = '#10191f';
  g.fillRect(0, 0, w, h);

  // ── 천장 · 바닥 · 두 벽 ──
  surface('#1b2930', '#0f181e', (a, b) => [[-HW * a, TOP * a], [HW * a, TOP * a], [HW * b, TOP * b], [-HW * b, TOP * b]]);
  surface('#2b3b41', '#19252c', (a, b) => [[-HW * a, BOT * a], [HW * a, BOT * a], [HW * b, BOT * b], [-HW * b, BOT * b]]);
  wall(-1, TOP, RAIL, '#2a3a42', '#1a272f');
  wall(-1, RAIL, BOT, '#22323a', '#141f27');
  wall(1, TOP, RAIL, '#36474d', '#25343b');
  wall(1, RAIL, BOT, '#2c3d43', '#1b2930');
  for (const side of [-1, 1]) {
    wall(side, RAIL - 1.6, RAIL, side < 0 ? '#5d6c6a' : '#73817b', side < 0 ? '#34444a' : '#4a5a5c');
    wall(side, RAIL, RAIL + 0.8, '#17252c', '#0f181e');
    wall(side, BOT - 6, BOT, '#17252c', '#0e171d');
    wall(side, BOT - 6.8, BOT - 6, side < 0 ? '#3a4a4f' : '#56666a', side < 0 ? '#24333a' : '#34444a');
    wall(side, TOP, TOP + 1.2, '#131e25', '#0c1419');
  }
  // 벽의 얼룩
  for (let i = 0; i < 150; i++) {
    const side = i % 2 ? 1 : -1, z = FAR / K ** rand(), v = TOP + 4 + rand() * (BOT - TOP - 12), len = (0.02 + rand() * 0.06) * z;
    onWall(i % 3 ? '#0b141a26' : '#9fb0b012', side, z, z - len, v, v + 0.5);
  }

  // ── 천장의 꺼진 형광등 ──
  for (const z of [8.2, 5.6, 3.2, 1.4]) {
    C.poly('#0d161b', [P(-15, TOP, z + 0.62), P(15, TOP, z + 0.62), P(15, TOP, z - 0.62), P(-15, TOP, z - 0.62)]);
    C.poly('#2c3c43', [P(-13, TOP, z + 0.56), P(13, TOP, z + 0.56), P(13, TOP, z - 0.56), P(-13, TOP, z - 0.56)]);
    C.poly('#3d4e53', [P(-10, TOP, z + 0.5), P(-4, TOP, z + 0.5), P(-4, TOP, z - 0.5), P(-10, TOP, z - 0.5)]);
    C.poly('#3d4e53', [P(4, TOP, z + 0.5), P(10, TOP, z + 0.5), P(10, TOP, z - 0.5), P(4, TOP, z - 0.5)]);
    C.poly('#56676a', [P(-13, TOP, z - 0.5), P(13, TOP, z - 0.5), P(13, TOP, z - 0.56), P(-13, TOP, z - 0.56)]);
  }
  for (const x of [-34, 34]) surface('#142027', '#0a1217', (a, b) => [[x * a, TOP * a], [(x + 0.7) * a, TOP * a], [(x + 0.7) * b, TOP * b], [x * b, TOP * b]]);

  // ── 바닥: 왁스 칠한 장판의 이음매 ──
  for (let z = 8.8; z > FAR / K; z -= z > 1.7 ? 1.2 : 0.4) {
    const k = FAR / z;
    C.box('#131d23', -HW * k, BOT * k, HW * 2 * k, 0.14 * k);
    C.box(mix('#3d4d51', '#2a393e', shade(k)), -HW * k, BOT * k + Math.max(1 / s, 0.14 * k), HW * 2 * k, 0.08 * k);
  }
  for (const x of [-22, 22]) surface('#1c292f', '#111a20', (a, b) => [[x * a, BOT * a], [(x + 0.5) * a, BOT * a], [(x + 0.5) * b, BOT * b], [x * b, BOT * b]]);
  for (let i = 0; i < 90; i++) {
    const z = FAR / K ** rand(), x = (rand() * 2 - 1) * (HW - 6), len = 2 + rand() * 7;
    onFloor(i % 3 ? '#6f7f8214' : '#0a121722', x, x + len, z, z - 0.012 * z);
  }

  // ── 왼쪽 벽의 창: 벽 두께만큼 들어가 있고, 유리 너머는 밤 ──
  const DEEP = HW + 6;
  const windows: [number, number][] = [[8.6, 7.5], [6.4, 5.3], [4.2, 3.1], [2.0, 0.9]];
  for (const [z1, z2] of windows) {
    const zn = z2 * DEEP / HW, zm = (z1 + zn) / 2;
    onWall('#111c23', -1, z1 + 0.07, z2 - 0.07, -65, -7);
    onWall('#1b2a32', -1, z1, z2, -62, -10);
    C.poly('#15222a', [P(-HW, -62, z1), P(-DEEP, -62, z1), P(-DEEP, -10, z1), P(-HW, -10, z1)]);
    onWall('#2b4054', -1, z1, zn, -62, -44, DEEP);
    onWall('#344c60', -1, z1, zn, -44, -26, DEEP);
    onWall('#41596a', -1, z1, zn, -26, -10, DEEP);
    // 창밖의 먼 나무 그림자
    for (let i = 0; i < 5; i++) {
      const a = z1 - (z1 - zn) * (i / 5), b = z1 - (z1 - zn) * ((i + 1) / 5);
      onWall('#2a3e4c', -1, a, b, -19 - 5 * rand(), -10, DEEP);
    }
    // 창살과 창틀
    onWall('#7f97a5', -1, z1, zn, -37.4, -36, DEEP);
    onWall('#1d2c35', -1, z1, zn, -36, -34.6, DEEP);
    onWall('#7f97a5', -1, zm + 0.02, zm - 0.02, -62, -10, DEEP);
    onWall('#1d2c35', -1, zm - 0.02, zm - 0.05, -62, -10, DEEP);
    onWall('#a8bfca', -1, z1, zn, -11.6, -10, DEEP);
    onWall('#0e181e', -1, z1, zn, -62, -60.6, DEEP);
    onWall('#5a6c72', -1, z1 + 0.07, z2 - 0.07, -7, -5.6);
  }
  // 달빛: 창마다 바닥에 비스듬한 네모로 눕고, 끝은 오른쪽 벽 걸레받이를 타고 오른다. 창살은 그림자로 남는다
  const zMin = FAR / K;
  for (const [z1, z2] of windows) {
    if (z1 - 0.92 <= zMin) continue;
    const lit = (c: string, a: number, b: number) => {
      C.poly(c, [P(5, BOT, a - 0.5), P(HW, BOT, a - 0.92), P(HW, BOT, Math.max(b - 0.92, zMin)), P(5, BOT, Math.max(b - 0.5, zMin))]);
      onWall(c, 1, a - 0.92, Math.max(b - 0.92, zMin), 26.5, BOT);
    };
    const m = (z1 + z2) / 2;
    lit('#a9c4d42c', z1, m + 0.035);
    lit('#a9c4d42c', m - 0.035, z2);
    C.poly('#0d171d55', [P(40, BOT, z1 - 0.77), P(42, BOT, z1 - 0.77), P(42, BOT, Math.max(z2 - 0.77, zMin)), P(40, BOT, Math.max(z2 - 0.77, zMin))]);
    C.poly('#cfe0e61c', [P(5, BOT, z1 - 0.5), P(8, BOT, z1 - 0.52), P(8, BOT, Math.max(z2 - 0.52, zMin)), P(5, BOT, Math.max(z2 - 0.5, zMin))]);
  }

  // ── 오른쪽 벽의 생활관 문 ──
  const SUNK = HW + 4;
  for (const [z1, z2] of [[8.2, 7.3], [5.9, 5.0], [3.6, 2.7], [1.5, 0.75]]) {
    const zn = z2 * SUNK / HW, t = shade(FAR / z1);
    onWall('#111c22', 1, z1 + 0.09, z2 - 0.09, -53.5, BOT);
    onWall(mix('#55666a', '#3c4c51', t), 1, z1 + 0.09, z2 - 0.09, -53.5, -52.3);
    C.poly('#16232a', [P(HW, -50, z1), P(SUNK, -50, z1), P(SUNK, BOT, z1), P(HW, BOT, z1)]);
    onWall(mix('#24353c', '#18262d', t), 1, z1, zn, -50, BOT, SUNK);
    onWall(mix('#33454b', '#22323a', t), 1, z1, zn, -50, -48.8, SUNK);
    // 문짝의 판과 손잡이, 발판
    const span = z1 - zn;
    onWall('#1a282f', 1, z1 - span * 0.16, zn + span * 0.16, -42, -8, SUNK);
    onWall(mix('#2b3c43', '#1e2d34', t), 1, z1 - span * 0.19, zn + span * 0.19, -40.5, -8, SUNK);
    onWall('#1a282f', 1, z1 - span * 0.16, zn + span * 0.16, 2, 26, SUNK);
    onWall(mix('#2b3c43', '#1e2d34', t), 1, z1 - span * 0.19, zn + span * 0.19, 3.5, 26, SUNK);
    onWall('#3f5055', 1, z1, zn, BOT - 7, BOT, SUNK);
    onWall('#a5a88f', 1, zn + span * 0.14, zn + span * 0.05, -3.6, -2, SUNK);
    onWall('#5f6658', 1, zn + span * 0.14, zn + span * 0.05, -2, -1.2, SUNK);
    // 문 위의 호실 팻말
    onWall('#0f191f', 1, z1 - span * 0.28, z1 - span * 0.74, -63, -56.4);
    onWall(mix('#99a08e', '#6f7a70', t), 1, z1 - span * 0.3, z1 - span * 0.72, -62.4, -57);
    onWall('#3c4844', 1, z1 - span * 0.38, z1 - span * 0.64, -60.4, -59.2);
  }

  // ── 오른쪽 벽의 게시판 ──
  onWall('#101a20', 1, 4.74, 3.96, -55, -19);
  onWall('#4f4f40', 1, 4.7, 4.0, -53, -21);
  onWall('#77765f', 1, 4.7, 4.0, -53, -52);
  for (const [za, zb, va, vb, c] of [[4.64, 4.46, -50, -38, '#99a297'], [4.4, 4.22, -51, -40, '#87928a'], [4.16, 4.04, -49, -36, '#a5a78f'], [4.62, 4.38, -35, -24, '#8a9590'], [4.32, 4.1, -37, -25, '#959a86']] as [number, number, number, number, string][]) {
    onWall(c, 1, za, zb, va, vb);
    onWall('#465250', 1, za - 0.02, zb + 0.02, va + 3, va + 3.6);
    onWall('#465250', 1, za - 0.02, zb + 0.05, va + 6, va + 6.6);
  }
  onWall('#a6504c', 1, 4.55, 4.52, -50.6, -49.4);

  // ── 왼쪽 벽의 소화전과 빨간 표시등 ──
  onWall('#0f191f', -1, 5.12, 4.48, -29, 9);
  onWall('#5f2c31', -1, 5.08, 4.52, -27, 7);
  onWall('#7d3d42', -1, 5.08, 4.52, -27, -25.6);
  onWall('#431e23', -1, 5.08, 4.52, 5.6, 7);
  onWall('#2c4048', -1, 5.0, 4.62, -22, -8);
  onWall('#435a62', -1, 5.0, 4.62, -22, -21);
  onWall('#b5af94', -1, 4.94, 4.7, -2, 1.5);
  {
    const [lx, ly] = P(-HW + 1.5, -36, 4.8), k = FAR / 4.8;
    C.glow('#e0554832', lx, ly, 13 * k);
    C.oval('#7a2a2c', lx, ly, 2.2 * k, 2.6 * k);
    C.oval('#e06a5a', lx + 0.3 * k, ly - 0.3 * k, 1.3 * k, 1.6 * k);
    C.box('#ffc9b0', lx + 0.2 * k, ly - 1.1 * k, 0.6 * k, 0.6 * k);
  }
  // 바닥의 소화기
  {
    const k = FAR / 4.3, x = -(HW - 8) * k, y = BOT * k;
    C.oval('#0a12178c', x, y, 5 * k, 1.1 * k);
    C.box('#632b30', x - 3 * k, y - 15 * k, 6 * k, 15 * k);
    C.box('#42191f', x - 3 * k, y - 15 * k, 1.3 * k, 15 * k);
    C.box('#8c4347', x + 1.4 * k, y - 15 * k, 1.2 * k, 15 * k);
    C.box('#b5af94', x - 1.2 * k, y - 10 * k, 3.4 * k, 3.6 * k);
    C.box('#1a252b', x - 1.4 * k, y - 18.4 * k, 2.8 * k, 3.4 * k);
    C.box('#55656a', x - 1.6 * k, y - 19.6 * k, 5 * k, 1.3 * k);
    C.seg('#141d23', x - 1.4 * k, y - 17 * k, x - 4.4 * k, y - 8 * k, 0.8 * k);
  }

  // ── 끝벽과 지휘통제실 문 ──
  C.box('#39484d', -HW, TOP, HW * 2, RAIL - TOP);
  C.box('#2c3b40', -HW, RAIL, HW * 2, BOT - RAIL);
  C.box('#18252b', -HW, TOP, HW * 2, 2);
  C.box('#6f7d77', -HW, RAIL - 1.6, HW * 2, 1.6);
  C.box('#17252c', -HW, RAIL, HW * 2, 0.9);
  C.box('#17252c', -HW, BOT - 6, HW * 2, 6);
  C.box('#48585b', -HW, BOT - 6.8, HW * 2, 0.9);
  C.box('#1b2a31', -HW, TOP, 1.5, BOT - TOP);
  C.box('#2a3a40', HW - 1.5, TOP, 1.5, BOT - TOP);
  C.glow('#dbd4a530', 0, -28, 74);
  // 문틀과 문짝
  C.box('#131f25', -29, -54, 58, 92);
  C.box('#5a6a66', -29, -54, 58, 1);
  C.box('#44544f', -25, -50, 50, 88);
  C.box('#566761', -25, -50, 1.5, 88);
  C.box('#33423f', 23, -50, 2, 88);
  C.box('#33423f', -20, -6, 40, 1); C.box('#566761', -20, -5, 40, 1);
  C.box('#394945', -19, 2, 38, 22);
  C.box('#2e3d3a', -19, 2, 38, 1); C.box('#2e3d3a', -19, 2, 1, 22);
  C.box('#52635d', -19, 23, 38, 1); C.box('#52635d', 18, 2, 1, 22);
  C.box('#5f706a', -25, 29, 50, 9);
  C.box('#7e8f86', -25, 29, 50, 1);
  C.box('#29383a', 0, -50, 22, 4.5); C.box('#3d4d4e', 0, -50, 22, 1);
  C.seg('#29383a', 4, -46, 16, -53, 1);
  // 철망 유리: 이 복도에서 유일하게 켜진 불
  C.box('#243330', -17, -43, 34, 30);
  C.box('#6f7f74', -17, -43, 34, 1);
  C.fade(['#c3c19c', '#a9ab8e', '#8f937b'], -14.5, -40.5, 29, 25);
  C.clip(-14.5, -40.5, 29, 25, () => {
    for (let i = -5; i < 10; i++) {
      C.seg('#6c766680', -14.5 + i * 6, -40.5, -14.5 + i * 6 + 25, -15.5, 0.6);
      C.seg('#6c766680', -14.5 + i * 6, -40.5, -14.5 + i * 6 - 25, -15.5, 0.6);
    }
    C.box('#e6e2bd', -12, -38, 9, 1); C.box('#e6e2bd', -12, -38, 1, 6);
    // 안쪽에 드리운 블라인드 그림자
    C.box('#7f846f70', -14.5, -22, 29, 6.5);
  });
  // 손잡이와 열쇠 구멍
  C.box('#2a3836', 13, -9, 6, 12);
  C.box('#8d8a72', 14, -8, 4, 10);
  C.box('#d3cba6', 8, -5, 9, 2); C.box('#7b775f', 8, -3, 9, 1);
  C.box('#2a3836', 15.5, -1, 1.2, 2);
  // 문 위의 팻말
  {
    const pw = Math.max(34, Math.round(34 * s)), ph = Math.max(8, Math.round(7.5 * s)), px = C.X(0), py = C.Y(-67);
    g.fillStyle = '#131f25'; g.fillRect(px - pw - 1, py - ph - 1, pw * 2 + 2, ph * 2 + 3);
    g.fillStyle = '#b9b79b'; g.fillRect(px - pw, py - ph, pw * 2, ph * 2);
    g.fillStyle = '#dedcbc'; g.fillRect(px - pw, py - ph, pw * 2, 1);
    g.fillStyle = '#8b8a72'; g.fillRect(px - pw, py + ph - 1, pw * 2, 1);
    pixelText(g, '지휘통제실', px, py, '#27343a');
  }
  // 문 옆: 근무표와 스위치
  C.box('#1b2a30', 36, -37, 20, 27);
  C.box('#7d8a82', 37, -36, 18, 25);
  C.box('#4d6a6c', 37, -36, 18, 4);
  for (let i = 0; i < 5; i++) C.box('#4c5955', 39, -29 + i * 4, 14 - (i * 5) % 4, 1);
  C.box('#a6504c', 51, -29, 2, 2);
  C.box('#1b2a30', -45, -8, 7, 9);
  C.box('#97a096', -44, -7, 5, 7);
  C.box('#5f6a64', -42.5, -5.5, 2, 4);
  C.box('#1b2a30', -52, -40, 12, 16);
  C.box('#52625f', -51, -39, 10, 14);
  C.box('#74857e', -51, -39, 10, 1);
  C.oval('#a34a48', -46, -31, 2.4, 2.4);

  // ── 유리의 불빛이 왁스 바닥에 길게 비친다 ──
  C.clip(-HW * K, BOT, HW * 2 * K, BOT * K, () => {
    C.glow('#d6d0a430', 0, BOT, 60);
    C.glow('#d6d0a41c', 0, BOT + 50, 110);
  });
  for (let i = 0; i < 30; i++) {
    const y = BOT + 2 + i * (2.6 + i * 0.3), half = (11 + i * 0.8) * (0.55 + rand() * 0.45);
    C.box(i < 10 ? '#e4dfb55a' : i < 20 ? '#e4dfb534' : '#e4dfb51c', -half + (rand() - 0.5) * 5, y, half * 2, 1);
  }

  // ── 바닥의 자국: 진자를 끈 듯한 동그라미 ──
  if (mark) {
    const [mx, my] = P(8, BOT, 3.6), rx = 64, ry = 15;
    for (const [grow, ink] of [[1, '#a3a28e'], [0.9, '#7e8478']] as [number, string][]) {
      for (let i = 0; i < 420; i++) {
        const a = i / 420 * Math.PI * 2, near = Math.sin(a) > -0.2;
        if (rand() < (near ? 0.22 : 0.5) || (grow < 1 && rand() < 0.45)) continue;
        const x = mx + Math.cos(a) * rx * grow + (grow < 1 ? 3 : 0), y = my + Math.sin(a) * ry * grow + (grow < 1 ? 1 : 0);
        C.box(near ? ink : ink + '90', x, y, 1.2, near && grow === 1 ? 1.4 : 1);
      }
    }
    C.oval('#0a121730', mx, my + 1, rx - 6, ry - 3, (dx, dy) => dx * dx + dy * dy > 0.7);
    // 끌려 나간 끝자국
    for (let i = 0; i < 16; i++) C.box('#a3a28e' + (i < 8 ? 'c0' : '70'), mx + rx - 3 + i * 1.6, my - 2 - i * 0.55, 1.4, 1);
  }

  return { s, cx, vanY };
}

/** 최면에서 깬 뒤의 빈 복도: 지휘통제실 문은 닫혀 있고, 바닥에 동그란 자국만 남았다 */
export function emptyDutyHallHd(g: Ink, w: number, h: number) {
  corridor(g, w, h, true);
  vignette(g, w, h, '#04080c', 0.58);
}

/**
 * 같은 복도에, 오른쪽 위에서 손 하나가 진자를 늘어뜨리고 들어온다 (당직부관인 척하는 슬리퍼). 얼굴은 화면 밖에 있다.
 * 진자는 예전 그림과 같은 높이(세로 36%)에, 지휘통제실 문 바로 오른쪽에 걸린다.
 */
export function pendulumHallHd(g: Ink, w: number, h: number) {
  const { s, cx, vanY } = corridor(g, w, h, false);
  vignette(g, w, h, '#04080c', 0.58);
  const H = brush(g, cx + Math.round(100 * s), vanY - Math.round(106 * s), s);
  const bob: Point = [-13, 92];

  // 흔들린 자리에 남는 잔상
  for (const [dx, dy, a] of [[-38, -9, '10'], [-21, -3, '1c'], [24, -4, '12']] as [number, number, string][]) {
    H.seg('#d1bc88' + a, 0, 0, bob[0] + dx, bob[1] + dy - 22, 1);
    H.oval('#d9bf85' + a, bob[0] + dx, bob[1] + dy, 21, 21);
  }
  H.glow('#f2c97d4a', bob[0], bob[1], 70);
  H.glow('#fbe2a038', bob[0], bob[1], 34);

  // ── 소매: 화면 오른쪽 위에서 비스듬히 내려온다 ──
  H.poly('#1b1c26', [[19, -68], [47, -31], [640, -476], [600, -530]]);
  H.poly('#272834', [[20, -66], [34, -48], [622, -490], [600, -530]]);
  H.seg('#3d3f4e', 21, -67, 600, -501, 1);
  for (const t of [22, 40, 66]) H.seg('#12131a', 30 + t * 0.8, -58 - t * 0.6, 44 + t * 0.8, -38 - t * 0.6 - 4, 1.4);
  // 소매 끝단과 단추
  H.poly('#4d5360', [[17, -69], [48, -29], [56, -35], [25, -75]]);
  H.poly('#70778a', [[17, -69], [20, -65], [28, -71], [25, -75]]);
  H.seg('#2c303b', 19, -66, 47, -30, 1);
  H.oval('#c9b071', 43, -42, 2.2, 2.2);
  H.box('#f1dfa2', 42, -43.4, 1.2, 1.2);

  // ── 손: 엄지 쪽에서 본 옆모습. 엄지와 검지로 줄을 집고, 나머지 손가락은 말아 쥐었다 ──
  const skin = '#bfa150', lit = '#e2c878', dark = '#8c7338', line = '#4a3b1e';
  const part = (body: Point[], c = skin) => {
    for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]]) H.poly(line, body.map(([x, y]) => [x + dx, y + dy] as Point));
    H.poly(c, body);
  };
  // 손목과 손등
  part([[23, -62], [41, -39], [41, -24], [34, -12], [22, -8], [12, -13], [3, -34], [9, -50]]);
  H.poly(lit, [[23, -62], [29, -54], [14, -36], [8, -24], [3, -34], [9, -50]]);
  // 말아 쥔 손가락들의 마디
  part([[41, -26], [44, -17], [38, -7], [27, -4], [20, -8], [30, -16]], dark);
  H.seg(line, 37, -19, 33, -8, 1);
  H.seg(line, 31, -14, 27, -5, 1);
  H.seg(skin, 40, -22, 43, -17, 1.4);
  // 검지: 한 번 굽어 내려와 줄 끝에 닿는다
  part([[3, -36], [12, -27], [5, -13], [4, 1], [-2, 3], [-6, -14]]);
  H.poly(lit, [[3, -36], [6, -33], [-2, -14], [-1, 1], [-2, 3], [-6, -14]]);
  H.seg(dark, -3, -14, 3, -12, 1);
  // 엄지: 앞에서 검지 끝을 맞잡는다
  part([[18, -27], [30, -19], [14, 1], [5, 5], [1, 2], [8, -9]]);
  H.poly(lit, [[18, -27], [22, -24], [10, -6], [4, 1], [1, 2], [8, -9]]);
  H.box('#f3e3a6', 3, 1, 3.4, 1.6);
  H.seg(dark, 13, -3, 16, -1, 1);

  // ── 줄과 진자: 가운데가 뚫린 놋쇠 원반 ──
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const x = 1 + (bob[0] - 1) * i / n, y = 5 + (bob[1] - 28 - 5) * i / n;
    H.box(i % 2 ? '#e4cf98' : '#7a6a4c', x - 0.8, y, 1.6, 2.6);
  }
  H.box('#6a5a3e', bob[0] - 3, bob[1] - 28, 6, 7);
  H.box('#d8c186', bob[0] - 2, bob[1] - 27, 2, 5);
  H.oval('#3d3324', bob[0], bob[1], 23.5, 23.5);
  H.oval('#8f7648', bob[0], bob[1], 22, 22);
  H.oval('#bfa26a', bob[0], bob[1], 20, 20);
  H.oval('#e3cb8f', bob[0], bob[1], 20, 20, (dx, dy) => dx * 0.8 + dy < -0.42);
  H.oval('#8f7648', bob[0], bob[1], 20, 20, (dx, dy) => dx * 0.8 + dy > 0.86);
  H.oval('#977d4d', bob[0], bob[1], 13.5, 13.5, (dx, dy) => dx * dx + dy * dy > 0.76);
  H.oval('#3d3324', bob[0], bob[1], 7, 7);
  H.oval('#1a2329', bob[0], bob[1], 5.6, 5.6);
  H.oval('#e3cb8f', bob[0], bob[1], 7, 7, (dx, dy) => dx * dx + dy * dy > 0.66 && dx * 0.8 + dy > 0.5);
  H.oval('#fff3c8', bob[0], bob[1], 17.5, 17.5, (dx, dy) => dx * dx + dy * dy > 0.74 && dx < -0.3 && dy < -0.3);
}
