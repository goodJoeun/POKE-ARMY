import { type Ink, type Point, pixelText, seeded } from './pixels';
import { brush, vignette } from './hd';

const SPINES = ['#515c60', '#645354', '#4f5057', '#665d5c', '#404854', '#5b6868', '#70605b', '#535d67', '#4c4049'];

/**
 * 불 꺼진 도서관의 서가 통로 (고해상도). 안쪽 벽 높은 곳의 아치 창으로 달빛만 들어온다.
 * 소실점은 통로 한가운데 눈높이다. 양쪽 서가는 안쪽 벽에서 화면 가장자리까지 원근으로 뻗어서,
 * 화면이 넓어지면 가까운 칸이 더 보일 뿐 책이 늘어나지 않는다.
 * 안농 글자 여섯이 뜨는 띠(화면 높이의 21~42%, 폭의 가운데 절반 남짓)는 창턱 아래의 빈 벽이라 어둡고 잔잔하다:
 * 창턱은 높이의 19%, 안쪽 벽의 바닥선은 64%에 고정돼 있고, 갓등 · 팻말도 그 띠 밖에 둔다.
 */
export function libraryHd(g: Ink, w: number, h: number) {
  const rand = seeded(2009);
  const s = Math.min(h / 480, w / 420);
  const cx = Math.round(w / 2), floorY = Math.round(h * 0.64);
  const EYE = 96, TOP = EYE - 170; // 눈높이에서 잰 바닥과 서가 꼭대기 (설계 칸)
  const vy = floorY - Math.round(EYE * s);
  const BW = Math.max(160, Math.min(230, 0.2 * w / s)); // 안쪽 벽의 반폭
  const ZB = 520; // 눈에서 안쪽 벽까지의 거리
  const edge = BW * s, kMax = w / 2 / edge + 0.01;
  const kAt = (d: number) => ZB / (ZB - d); // 안쪽 벽에서 d칸 앞으로 나온 곳의 배율
  const dMax = ZB * (1 - 1 / kMax);
  const V = brush(g, cx, vy, s); // 소실점이 원점
  const P = brush(g, 0, 0, 1); // 캔버스 픽셀 그대로
  const at = (x: number, y: number, k: number): Point => [x * k, y * k];

  // ── 안쪽 벽과 옆벽 ──
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#151d2a'); wall.addColorStop(0.6, '#2d3b47'); wall.addColorStop(1, '#242e39');
  g.fillStyle = wall; g.fillRect(0, 0, w, floorY);
  for (let i = 0; i < w * 0.6; i++) {
    g.fillStyle = i % 2 ? '#ffffff07' : '#00000012';
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * floorY), 1 + Math.floor(rand() * 3), 1);
  }
  const side = g.createLinearGradient(0, 0, 0, floorY);
  side.addColorStop(0, '#0c121c'); side.addColorStop(1, '#19212c');
  g.fillStyle = side;
  g.fillRect(0, 0, V.X(-BW), floorY); g.fillRect(V.X(BW), 0, w - V.X(BW), floorY);

  // ── 아치 창: 가운데 큰 창과 양옆의 좁은 창 ──
  const sillY = Math.round(h * 0.19);
  brush(g, cx, sillY, s).glow('#8fb3b430', 0, -40, 130);
  const BAR = '#1b2832';
  const windowAt = (x0: number, R: number, SPRING: number, main: boolean) => {
    const W = brush(g, cx + Math.round(x0 * s), sillY, s); // 원점 = 창턱 한가운데, R = 유리의 반폭, SPRING = 아치가 시작되는 높이
    const arch = (c: string, r: number, keep?: (dx: number, dy: number) => boolean) => {
      W.oval(c, 0, SPRING, r, r, (dx, dy) => dy <= 0 && (!keep || keep(dx, dy)));
      if (!keep) W.box(c, -r, SPRING, r * 2, -SPRING);
    };
    arch('#0b1119', R + 8.5);
    arch('#33434d', R + 7);
    arch('#46585f', R + 7, (dx, dy) => dx * dx + dy * dy > 0.94 && dx < 0.3);
    arch('#18222c', R + 2.5);
    // 창 안쪽 옆면: 달이 오른쪽에 있어서 왼쪽 면이 빛을 받는다
    arch('#86a2a1', R + 2.5, (dx) => dx < -0.2);
    W.box('#86a2a1', -R - 2.5, SPRING, 2.5, -SPRING);
    const gx = W.X(0), gy = W.Y(SPRING), gr = R * s;
    g.save(); g.beginPath();
    for (let j = Math.round(gy - gr); j < W.Y(0); j++) {
      const dy = gy - (j + 0.5), half = dy > 0 ? Math.sqrt(Math.max(0, gr * gr - dy * dy)) : gr;
      const a = Math.round(gx - half), b = Math.round(gx + half);
      if (b > a) g.rect(a, j, b - a, 1);
    }
    g.clip();
    const top = SPRING - R, mid = Math.round(SPRING * 0.52);
    W.fade(['#14233c', '#284560', '#55798a', '#93aea5'], -R, top, R * 2, -top);
    for (let i = 0; i < R; i++) {
      const x = -R + rand() * R * 2, y = top + rand() ** 1.4 * (R + 12);
      g.fillStyle = ['#ffffff', '#dbe6ee', '#a9bfd2', '#f1e8cc'][i % 4];
      if (i % 11 === 5) { g.fillRect(W.X(x) - 1, W.Y(y), 3, 1); g.fillRect(W.X(x), W.Y(y) - 1, 1, 3); } else g.fillRect(W.X(x), W.Y(y), 1, 1);
    }
    for (let i = 0; i < R * 0.4; i++) W.box(i % 3 ? '#c9dccf30' : '#f1ecd03c', -R + rand() * R * 1.5, -32 + rand() * 14, 8 + rand() * 20, 1);
    if (main) {
      // 초승달
      W.glow('#eef2d470', 23, -46, 26);
      W.oval('#f3f1d6', 23, -46, 7, 7, (dx, dy) => (dx + 0.46) ** 2 + (dy + 0.22) ** 2 > 0.82);
      W.oval('#d6d9bd', 23, -46, 7, 7, (dx, dy) => (dx + 0.46) ** 2 + (dy + 0.22) ** 2 > 0.82 && (dx + 0.3) ** 2 + (dy + 0.14) ** 2 < 1);
    }
    // 창밖의 산등성이와 나무 (세 창에 걸쳐 이어진다)
    W.ridge('#4d6f78', -R, R, (x) => -16 - 3.5 * Math.sin((x + x0) / 13 + 1) - 1.5 * Math.sin((x + x0) / 5), () => 0);
    W.ridge('#2c4652', -R, R, (x) => -7 - 6 * Math.abs(Math.sin((x + x0) / 3.4 + 0.6)) * (0.55 + 0.45 * Math.sin((x + x0) / 10)), () => 0);
    W.ridge('#1f333f', -R, R, (x) => -3 - 3.5 * Math.abs(Math.sin((x + x0) / 5.1)), () => 0);
    W.poly('#ffffff0d', [[-R, top], [-R * 0.4, top], [-R, SPRING + R * 0.3]]);
    W.poly('#ffffff09', [[R * 0.1, 0], [R * 0.4, 0], [R, SPRING * 0.7], [R, SPRING]]);
    // 창살: 가운데 기둥과 가로대, 큰 창은 아치 안에 부챗살
    W.box(BAR, -1.5, top, 3, -top);
    W.box(BAR, -R, SPRING - 1.5, R * 2, 3);
    W.box(BAR, -R, mid, R * 2, 2);
    W.box('#3f5a66', -R, SPRING - 1.5, R * 2, 1);
    W.box('#3f5a66', -R, mid, R * 2, 1);
    if (main) {
      for (const x of [-R * 0.5 - 1, R * 0.5 - 1]) W.box(BAR, x, SPRING, 2, -SPRING);
      for (const dx of [-1, 1]) W.seg(BAR, 0, SPRING, dx * R * 0.74, SPRING - R * 0.74, 2);
      W.oval(BAR, 0, SPRING, R * 0.38, R * 0.38, (dx, dy) => dy <= 0 && dx * dx + dy * dy > 0.72);
    }
    g.restore();
    // 창턱 (그림자를 짧게: 바로 아래부터 안농 글자가 뜬다)
    W.box('#0b111a70', -R - 8, 6, R * 2 + 16, 3);
    W.box('#9db3ae', -R - 12, 0, R * 2 + 24, 2);
    W.box('#6d8286', -R - 12, 2, R * 2 + 24, 2);
    W.box('#3d4d57', -R - 9, 4, R * 2 + 18, 3);
    return W;
  };
  windowAt(-82, 15, -36, false);
  windowAt(82, 15, -36, false);
  const W = windowAt(0, 34, -36, true), R = 34;

  // ── 안쪽 벽의 징두리널 · 팻말 · 목록함 ──
  const dado = EYE - 66;
  V.box('#2a2c35', -BW, dado, BW * 2, 66);
  V.box('#5f5c60', -BW, dado, BW * 2, 1.5);
  V.box('#3b3d46', -BW, dado + 1.5, BW * 2, 4);
  V.box('#13171e', -BW, dado + 5.5, BW * 2, 1);
  const panels = Math.floor((BW * 2 - 8) / 46);
  for (let i = 0; i < panels; i++) {
    const x = -panels * 23 + i * 46 + 4;
    V.box('#24262f', x, dado + 13, 38, 42);
    V.box('#171a22', x, dado + 13, 38, 1); V.box('#171a22', x, dado + 13, 1, 42);
    V.box('#3f414b', x, dado + 54, 38, 1); V.box('#3f414b', x + 37, dado + 13, 1, 42);
  }
  V.box('#1b1d25', -BW, EYE - 7, BW * 2, 7);
  V.box('#484a53', -BW, EYE - 7, BW * 2, 1);
  // "정숙" 팻말
  const signX = -BW * 0.54;
  const signY = dado - 32;
  V.box('#0b101888', signX - 23, signY + 2, 48, 22);
  V.box('#7f7355', signX - 25, signY, 50, 22);
  V.box('#b3a57c', signX - 25, signY, 50, 1);
  V.box('#1c242e', signX - 23, signY + 2, 46, 18);
  pixelText(g, '정 숙', V.X(signX), Math.round((V.Y(signY + 2) + V.Y(signY + 20)) / 2), '#c9c2a4');
  // 도서 목록함: 작은 서랍이 줄지어 있다
  const cab = BW * 0.2, cabTop = EYE - 64;
  V.box('#0a0e1690', cab - 10, EYE - 3, 112, 6);
  V.box('#2b2629', cab + 3, EYE - 9, 4, 9); V.box('#2b2629', cab + 89, EYE - 9, 4, 9);
  V.box('#463e41', cab, cabTop, 96, 56);
  V.box('#9aa7a2', cab - 2, cabTop - 3, 100, 2);
  V.box('#6c6462', cab - 2, cabTop - 1, 100, 2);
  V.box('#2e282c', cab, EYE - 9, 96, 1);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const x = cab + 3 + c * 15.3, y = cabTop + 4 + r * 12.6;
    V.box('#5b5053', x, y, 13.5, 10.5);
    V.box('#7b6f6e', x, y, 13.5, 1);
    V.box('#2f292d', x, y + 9.5, 13.5, 1);
    V.box('#b5a98b', x + 3.5, y + 2.5, 6.5, 3);
    V.box('#6b5f4a', x + 5, y + 7, 3.5, 1);
  }
  V.box('#2f292d', cab + 94, cabTop, 2, 56);
  // 그 위의 지구본과 반납된 책
  const gbx = cab + 24, gby = cabTop - 3;
  V.box('#6f6451', gbx - 6, gby - 2, 12, 2);
  V.box('#8f8366', gbx - 1, gby - 6, 2, 4);
  V.oval('#7b7059', gbx, gby - 16, 12.5, 12.5, (dx, dy) => dx * dx + dy * dy > 0.78 && dx > -0.5);
  V.oval('#33505c', gbx, gby - 16, 9.5, 9.5);
  V.oval('#56766c', gbx - 2, gby - 18, 4.5, 3); V.oval('#56766c', gbx + 3, gby - 12, 3, 4); V.oval('#56766c', gbx + 5, gby - 20, 2, 1.5);
  V.oval('#a9c4bf', gbx, gby - 16, 9.5, 9.5, (dx, dy) => dx * dx + dy * dy > 0.72 && dy < -0.25 && dx < 0.5);
  for (const [i, c, len] of [[0, '#5b6868', 30], [1, '#645354', 26], [2, '#535d67', 28]] as const) {
    const x = cab + 58 + i * 1.5, y = cabTop - 3 - (i + 1) * 5;
    V.box(c, x, y, len, 5);
    V.box('#ffffff26', x, y, len, 1);
    V.box('#b9b199', x + len - 2, y + 1, 2, 3);
  }

  // ── 바닥: 소실점으로 모이는 마루 널 ──
  const floor = g.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, '#3d424a'); floor.addColorStop(1, '#252931');
  g.fillStyle = floor; g.fillRect(0, floorY, w, h - floorY);
  const kEnd = (h - vy) / (EYE * s) + 0.1, PLANK = 32, strips = Math.ceil(BW / PLANK) + 1;
  for (let i = -strips; i < strips; i++) {
    const x0 = i * PLANK, x1 = x0 + PLANK;
    V.poly(['#ffffff08', '#00000014', '#ffffff00'][(i + strips * 3) % 3], [at(x0, EYE, 1), at(x1, EYE, 1), at(x1, EYE, kEnd), at(x0, EYE, kEnd)]);
    for (let d = (i * 53 % 90 + 90) % 90 + 14; d < ZB - 40; d += 118) {
      const k = kAt(d);
      if (k > kEnd) break;
      V.box('#1f232b', x0 * k, EYE * k, PLANK * k, 1 / s);
      V.box('#555b6240', x0 * k, EYE * k + 1 / s, PLANK * k, 1 / s);
    }
  }
  // 나뭇결: 널을 따라 길게 흐르는 옅은 결
  for (let i = -strips; i < strips; i++) for (let j = 0; j < 7; j++) {
    const x = i * PLANK + 3 + rand() * (PLANK - 6), d1 = rand() * (ZB - 60), d2 = Math.min(ZB - 30, d1 + 20 + rand() * 70);
    if (kAt(d1) > kEnd) continue;
    V.seg(j % 3 ? '#ffffff07' : '#0000001a', x * kAt(d1), EYE * kAt(d1), x * kAt(d2), EYE * kAt(d2), 1 / s);
  }
  for (let i = -strips; i <= strips; i++) {
    V.seg('#1f232b', i * PLANK, EYE, i * PLANK * kEnd, EYE * kEnd, 1 / s);
    V.seg('#555b6238', i * PLANK + 1 / s, EYE, (i * PLANK) * kEnd + 1 / s, EYE * kEnd, 1 / s);
  }
  V.box('#11151c', -BW, EYE, BW * 2, 1.5);
  V.fade(['#9fbdbb30', '#9fbdbb00'], -34, EYE + 1, 68, 40);
  // 창 모양으로 바닥에 떨어진 달빛
  const k1 = 1.2, k2 = 1.47;
  V.poly('#a3c0bb30', [at(-46, EYE, k1), at(18, EYE, k1), at(8, EYE, 1.4), at(-10, EYE, k2), at(-52, EYE, k2), at(-58, EYE, 1.4)]);
  V.poly('#c5dcd41c', [at(-40, EYE, k1 + 0.03), at(12, EYE, k1 + 0.03), at(-14, EYE, k2 - 0.04), at(-50, EYE, k2 - 0.04)]);
  V.seg('#262b3370', -14 * k1, EYE * k1, -31 * k2, EYE * k2, 2);
  V.seg('#262b3360', -51 * 1.3, EYE * 1.3, 11 * 1.3, EYE * 1.3, 1.5);

  // ── 양쪽 서가 ──
  for (const dir of [-1, 1]) {
    /** 서가 면 위의 네모: 깊이 배율 ka~kb, 눈높이에서 잰 높이 ya~yb. 칸 폭(픽셀)을 돌려준다 */
    const quad = (c: string, ka: number, kb: number, ya: number, yb: number, thick = 0) => {
      const a = Math.max(Math.round(edge * ka), Math.round(edge)), b = Math.min(Math.round(edge * kb), cx + 1);
      g.fillStyle = c;
      for (let i = a; i < b; i++) {
        const k = (i + 0.5) / edge, y0 = Math.round(vy + ya * k * s);
        g.fillRect(dir < 0 ? cx - i - 1 : cx + i, y0, 1, thick || Math.max(1, Math.round(vy + yb * k * s) - y0));
      }
      return b - a;
    };
    const px = 1 / edge; // 화면 한 픽셀에 해당하는 배율 차이
    quad('#161a23', 1, kMax, TOP, EYE);
    for (let r = 0; r < 6; r++) {
      const yb = EYE - 10 - r * 26;
      for (let bay = 0; bay * 96 < dMax; bay++) {
        const pick = seeded(dir * 977 + r * 131 + bay * 17 + 4000);
        const end = bay * 96 + 91 - (pick() > 0.62 ? 16 : 0);
        for (let d = bay * 96 + 5; d < end - 2;) {
          if (pick() > 0.95) { d += 5 + pick() * 9; continue; }
          const t = Math.min(end - d, 3.2 + pick() * 4.4), tall = 12 + pick() * 9.5;
          const c = SPINES[Math.floor(pick() * SPINES.length)], ka = kAt(d), kb = kAt(d + t);
          const n = quad(c, ka, kb, yb - tall, yb), a = pick(), b = pick();
          if (n >= 3) { quad('#ffffff1c', ka, ka + px, yb - tall, yb); quad('#0000003a', kb - px, kb, yb - tall, yb); }
          if (n >= 2) quad('#ffffff22', ka, kb, yb - tall, 0, 1);
          if (n >= 4 && a > 0.35) quad('#a99e87', ka + px, kb - px, yb - 8, yb - 5);
          if (n >= 4 && b > 0.6) quad('#c7b99d70', ka + px, kb - px, yb - tall + 3, yb - tall + 3 + tall * 0.28);
          if (n >= 6 && b < 0.45) { quad('#b9a57a90', ka, kb, yb - tall + 2.5, 0, 1); quad('#b9a57a90', ka, kb, yb - 3, 0, 1); }
          d += t;
        }
        // 칸 끝에 눕혀 쌓은 책
        if (end < bay * 96 + 91) for (let i = 0; i < 2 + Math.floor(pick() * 2); i++) {
          const ka = kAt(end + 1 + pick() * 2), kb = kAt(end + 15);
          quad(SPINES[Math.floor(pick() * SPINES.length)], ka, kb, yb - 4 * (i + 1), yb - 4 * i);
          quad('#ffffff20', ka, kb, yb - 4 * (i + 1), 0, 1);
        }
      }
      // 선반 널: 윗모서리가 달빛을 받는다
      quad(r ? '#5c514d' : '#3d3639', 1, kMax, yb, r ? yb + 3 : EYE);
      quad(r ? '#8d7c6e' : '#6a5e5a', 1, kMax, yb, 0, 1);
      if (r) quad('#241f24', 1, kMax, yb + 3, 0, 1);
    }
    // 칸막이 기둥과 분류 번호판
    for (let d = 0; d < dMax + 4; d += 96) {
      const ka = kAt(Math.max(0, d - 3.5)), kb = kAt(d + 3.5);
      quad('#423d40', ka, kb, TOP, EYE);
      quad('#7b6f69', ka, ka + px, TOP, EYE);
      quad('#2a2529', kb - px, kb, TOP, EYE);
      if (d) { quad('#b0a384', kAt(d - 2.2), kAt(d + 2.2), -9, -3); quad('#6d6450', kAt(d - 1.2), kAt(d + 1.2), -7, 0, 1); }
    }
    // 머릿돌
    quad('#4d4648', 1, kMax, TOP - 5, TOP + 4);
    quad('#93857a', 1, kMax, TOP - 5, 0, 1);
    quad('#2a2529', 1, kMax, TOP + 4, 0, 1);
    // 가까울수록 창에서 멀어 어둡다
    const x0 = cx + dir * Math.round(edge), x1 = dir < 0 ? 0 : w;
    const shade = g.createLinearGradient(x0, 0, x1, 0);
    shade.addColorStop(0, '#070b1300'); shade.addColorStop(0.5, '#070b1340'); shade.addColorStop(1, '#070b1388');
    g.fillStyle = shade; g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), h);
    g.fillStyle = '#0a0f17'; g.fillRect(dir < 0 ? x0 - 1 : x0, 0, 1, V.Y(TOP - 5));
  }

  // ── 공기 중의 달빛 줄기와 먼지 ──
  const beam: Point[] = [[W.X(-R), W.Y(-50)], [W.X(R), W.Y(-50)], [W.X(R), W.Y(0)], [V.X(18 * k1), V.Y(EYE * k1)], [V.X(-10 * k2), V.Y(EYE * k2)], [V.X(-52 * k2), V.Y(EYE * k2)], [W.X(-R), W.Y(0)]];
  P.poly('#a9c8c40b', beam);
  P.poly('#a9c8c409', [[W.X(-R + 10), W.Y(-32)], [W.X(R - 8), W.Y(-32)], [V.X(4 * k1), V.Y(EYE * k1)], [V.X(-44 * k2), V.Y(EYE * k2)]]);
  for (let i = 0; i < 60; i++) {
    const t = rand(), x = cx + (rand() - 0.5 - t * 0.25) * 110 * s, y = W.Y(0) + t * (V.Y(EYE * k2) - W.Y(0));
    if (y > h * 0.2 && y < h * 0.44) continue; // 안농 글자가 뜨는 띠는 비워 둔다
    g.fillStyle = i % 4 ? '#dfe8d436' : '#f4f2dc5a';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // ── 서가에 기대 놓은 사다리 ──
  const kl = Math.min(1.42, kMax - 0.16), dl = ZB * (1 - 1 / kl);
  if (kl > 1.08) {
    const ka = kl, kb = kAt(dl + 24);
    const foot = (k: number): Point => at(BW - 40, EYE, k), head = (k: number): Point => at(BW - 1, TOP - 10, k);
    const along = (k: number, t: number): Point => { const a = foot(k), b = head(k); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    V.poly('#080c1466', [foot(ka), foot(kb), at(BW, EYE, kb), at(BW, EYE, ka)]);
    V.seg('#3b3336', ...foot(ka), ...head(ka), 2.5);
    for (let i = 1; i < 10; i++) {
      const a = along(ka, i / 10.4), b = along(kb, i / 10.4);
      V.seg('#2c2629', a[0], a[1] + 1.5, b[0], b[1] + 1.5, 1.5);
      V.seg('#8f8072', a[0], a[1], b[0], b[1], 1.5);
    }
    V.seg('#5d5049', ...foot(kb), ...head(kb), 3);
    V.seg('#a39483', foot(kb)[0] - 1.5, foot(kb)[1], head(kb)[0] - 1.5, head(kb)[1], 1);
  }

  // ── 통로의 작은 탁자: 펼쳐 둔 책과 꺼진 스탠드 ──
  const kf = kAt(104), kn = kAt(160), TY = EYE - 44, TL = -80, TR = -18;
  V.poly('#080c1480', [at(TL, EYE, kn), at(TR, EYE, kn), at(TR - 10, EYE, kAt(196)), at(TL - 16, EYE, kAt(196))]);
  for (const x of [TL, TR - 3]) { V.box('#25232b', x * kf, (TY + 6) * kf, 3 * kf, (EYE - TY - 6) * kf); }
  V.poly('#3a3336', [at(TR, TY, kf), at(TR, TY, kn), at(TR, TY + 7, kn), at(TR, TY + 7, kf)]);
  V.poly('#8f877a', [at(TL, TY, kf), at(TR, TY, kf), at(TR, TY, kn), at(TL, TY, kn)]);
  V.box('#bcb5a0', TL * kf, TY * kf, (TR - TL) * kf, 1 / s);
  V.box('#5a4e4c', TL * kn, TY * kn, (TR - TL) * kn, 3 * kn);
  V.box('#a2978a', TL * kn, TY * kn, (TR - TL) * kn, 1 / s);
  V.box('#463c3e', (TL + 2) * kn, (TY + 3) * kn, (TR - TL - 4) * kn, 5 * kn);
  for (const x of [TL, TR - 3.5]) {
    V.box('#3a3438', x * kn, (TY + 3) * kn, 3.5 * kn, (EYE - TY - 3) * kn);
    V.box('#5f5557', x * kn, (TY + 3) * kn, 1, (EYE - TY - 3) * kn);
  }
  // 펼친 책: 두 쪽이 가운데에서 살짝 솟는다
  const bk = kAt(118), bn = kAt(150), BX = -56;
  V.poly('#39424c', [at(BX - 17, TY, bk), at(BX + 17, TY, bk), at(BX + 18, TY, bn), at(BX - 18, TY, bn)]);
  V.poly('#c9c3aa', [[(BX - 15) * bk, TY * bk], [BX * bk, TY * bk - 2], [BX * bn, TY * bn - 3], [(BX - 16) * bn, TY * bn - 1]]);
  V.poly('#e3dec6', [[BX * bk, TY * bk - 2], [(BX + 15) * bk, TY * bk], [(BX + 16) * bn, TY * bn - 1], [BX * bn, TY * bn - 3]]);
  V.seg('#8d8672', BX * bk, TY * bk - 2, BX * bn, TY * bn - 3, 1 / s);
  for (let i = 1; i < 4; i++) {
    const k = bk + (bn - bk) * i / 4;
    V.box('#8f897a', (BX - 13) * k, TY * k - 2, 10 * k, 1 / s);
    V.box('#a39d8a', (BX + 3) * k, TY * k - 2, (i === 3 ? 6 : 10) * k, 1 / s);
  }
  // 초록 갓 스탠드 (꺼져 있다)
  const L = brush(g, V.X((TR - 12) * kAt(124)), V.Y(TY * kAt(124)), s * 1.3);
  L.oval('#8f8160', 0, -1, 7, 2.2);
  L.oval('#b9aa7e', -1, -1.6, 4, 1);
  L.box('#8f8160', -1, -15, 2, 14);
  L.box('#c5b688', -1, -15, 1, 14);
  L.poly('#27433f', [[-12, -15], [-9, -22], [9, -22], [12, -15]]);
  L.box('#3f655c', -9, -22, 18, 1.5);
  L.box('#6f9a8a', -8, -21, 6, 1);
  L.box('#a8986c', -12, -15.5, 24, 1.5);
  // 탁자 귀퉁이에 쌓아 둔 책
  for (const [i, c] of [[0, '#645354'], [1, '#404854']] as const) {
    const k = kAt(140);
    V.box(c, (TL + 3 + i) * k, TY * k - (i + 1) * 4, 16 * k, 4);
    V.box('#ffffff26', (TL + 3 + i) * k, TY * k - (i + 1) * 4, 16 * k, 1 / s);
  }

  // ── 불 꺼진 갓등: 창 쪽 가장자리만 달빛을 받는다 ──
  for (const [k, x] of [[1.3, 100], [2.25, 100]] as const) for (const dir of [-1, 1]) {
    if (x * k * s > w / 2 - 12 * k * s) continue;
    const H = brush(g, V.X(dir * x * k), V.Y(-100 * k), s * k);
    H.box('#0d131b', -0.5, -400, 1, 388);
    H.box('#1a232b', -3, -14, 6, 4);
    H.poly('#222b33', [[-4, -10], [4, -10], [15, 0], [-15, 0]]);
    H.seg('#6f888a', -dir * 4, -10, -dir * 14.5, -0.5, 1);
    H.box('#7c8686', -15, 0, 30, 1.5);
    H.oval('#39454c', 0, 2, 4.5, 2);
  }

  vignette(g, w, h, '#03050c', 0.5);
}
