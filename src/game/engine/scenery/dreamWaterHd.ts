import { type Ink, type Point, seeded } from './pixels';
import { brush, vignette } from './hd';

const hex = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

/**
 * 꿈속의 바다 (고해상도): 끝없는 밤하늘이 잔잔한 물에 비친다. 목소리의 주인은 아직 빛 하나로만 보인다.
 * 수평선(화면 높이의 51%)과 그 빛의 자리(가로 가운데, 높이 29%)는 예전 그림과 같다.
 * 바위섬은 양쪽 가장자리에 붙어 있어서, 화면이 넓어지면 빛 아래의 물길이 넓어질 뿐이다.
 */
export function dreamWaterHd(g: Ink, w: number, h: number) {
  const rand = seeded(7602);
  const s = Math.min(h / 480, w / 420);
  const u = (v: number) => Math.max(1, Math.round(v * s));
  const horizon = Math.round(h * 0.51), cx = Math.round(w / 2), cy = Math.round(h * 0.29);
  const fill = (c: string, x: number, y: number, bw: number, bh: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh))); };

  // ── 하늘 ──
  const skyFill = g.createLinearGradient(0, 0, 0, horizon);
  ['#080b22', '#0e1330', '#202547', '#39395d', '#5d5676', '#84728f'].forEach((c, i, a) => skyFill.addColorStop(i / (a.length - 1), c));
  g.fillStyle = skyFill;
  g.fillRect(0, 0, w, horizon);

  // 별빛 장막: 빛 위로 휘어 넘어가는 띠. 세로 결이 있고 아랫단이 가장 밝다
  const hemY = (x: number, phase: number, base: number, amp: number) => {
    const k = (x - cx) / s;
    return horizon * (base - Math.sin(k / 135 + phase) * amp) + 8 * s * Math.sin(k / 42 + phase * 2);
  };
  const veil = (phase: number, base: number, amp: number, len: number, alpha: number) => {
    const strand = Math.max(2, Math.round(2 * s));
    let ray = 0;
    for (let x = 0; x < w; x++) {
      if (x % strand === 0) ray = rand();
      const k = (x - cx) / s;
      const fold = 0.5 + 0.5 * Math.sin(k / 6.5 + 2.4 * Math.sin(k / 37 + phase));
      const gap = Math.max(0, Math.min(1, 0.62 + 0.75 * Math.sin(k / 83 + phase * 3.1))); // 군데군데 끊긴다
      const y1 = Math.round(hemY(x, phase, base, amp));
      const run = Math.round(len * s * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(k / 74 + phase))) * (0.5 + 0.3 * fold + 0.3 * ray));
      const a = alpha * gap * (0.3 + 0.4 * fold + 0.3 * ray);
      if (a < 0.01 || run < 2) continue;
      const tail = Math.round(9 * s);
      const gr = g.createLinearGradient(0, y1 - run, 0, y1 + tail);
      const at = run / (run + tail);
      gr.addColorStop(0, '#8795bd00'); gr.addColorStop(at * 0.7, '#8795bd' + hex(a * 0.42)); gr.addColorStop(at, '#a8d2ca' + hex(a)); gr.addColorStop(1, '#a0c7c100');
      g.fillStyle = gr;
      g.fillRect(x, y1 - run, 1, run + tail);
      if (rand() < 0.3 * gap) fill('#cfe6dc' + hex(a * 1.3), x, y1 - 1, 2, 1);
    }
  };
  veil(0.9, 0.34, 0.17, 44, 0.22);
  veil(2.45, 0.5, 0.29, 62, 0.4);

  // 별: 수평선 쪽으로 갈수록 드물고 흐리다
  for (let i = 0; i < w * 2.3; i++) {
    const x = rand() * w, depth = rand() ** 1.25, y = depth * (horizon - 8 * s);
    const c = ['#e9edf8', '#b4bfd2', '#d2c4bd', '#8a8ca9', '#8588a9'][Math.floor(rand() * 5)];
    if (i % 53 === 0) {
      const r = u(2);
      fill(c, x - r, y, r * 2 + 1, 1); fill(c, x, y - r, 1, r * 2 + 1); fill('#ffffff', x, y, 1, 1);
    } else if (i % 11 === 0 && depth < 0.7) fill(c, x, y, 2, 2);
    else fill(depth > 0.78 ? c + '88' : c, x, y, 1, 1);
  }

  // ── 물 ──
  const water = g.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#6f6883'); water.addColorStop(0.08, '#5a587a'); water.addColorStop(0.36, '#363b5f'); water.addColorStop(1, '#101a35');
  g.fillStyle = water;
  g.fillRect(0, horizon, w, h - horizon);

  // 빛이 물 위에 길게 눕는다
  g.save();
  g.beginPath(); g.rect(0, horizon, w, h - horizon); g.clip();
  for (const [kx, ky, r, c] of [[1, 0.2, 170, '#e8cdaa3c'], [0.2, 1, 250, '#e8cdaa2a']] as const) {
    g.save();
    g.translate(cx, horizon); g.scale(kx, ky);
    const pool = g.createRadialGradient(0, 0, 0, 0, 0, r * s);
    pool.addColorStop(0, c); pool.addColorStop(1, c.slice(0, 7) + '00');
    g.fillStyle = pool; g.fillRect(-r * s, -r * s, r * s * 2, r * s * 2);
    g.restore();
  }
  g.restore();

  // 양쪽 가장자리의 바위섬 (윤곽을 먼저 정해 두고, 물에 비친 모습부터 그린다)
  const reach = Math.min(330, w / s * 0.3);
  const L = brush(g, 0, horizon, s), R = brush(g, w, horizon, s);
  const rocks: { B: typeof L; dir: number; x: number; span: number; rise: number; prof: Point[]; pts: Point[] }[] = [];
  for (const [B, dir] of [[L, 1], [R, -1]] as const) {
    for (const [x, span, rise] of [[-18, 84, 22], [48, 46, 10], [84, 72, 15], [146, 34, 6], [170, 50, 9], [218, 26, 4], [262, 44, 6], [300, 22, 3]]) {
      if (x + span > reach) continue;
      // 비스듬히 누운 셰일 판: 바깥쪽이 높고 빛 쪽으로 천천히 낮아지다가 끝이 툭 끊긴다
      const jig = () => 0.86 + rand() * 0.28, peak = 0.26 + rand() * 0.14;
      const prof: Point[] = [[0, 0], [0.08, 0.5 * jig()], [peak, 1], [0.62, 0.74 * jig()], [0.84, 0.5 * jig()], [0.93, 0.2], [1, 0]];
      rocks.push({ B, dir, x, span, rise, prof, pts: prof.map(([t, r]) => [dir * (x + t * span), -r * rise] as Point) });
    }
  }
  for (const { B, pts } of rocks) B.poly('#1d2440c8', pts.map(([x, y]) => [x, 1 - y * 0.6] as Point));

  // 하늘의 장막이 물에 어른거린다
  for (let i = 0; i < w * 0.6; i++) {
    const x = rand() * w, y = horizon + (horizon - hemY(x, 2.45, 0.5, 0.29)) * 0.62 + (rand() - 0.5) * 30 * s;
    if (y < horizon + 5 * s || y > h) continue;
    fill('#a0c7c11e', x, y, (6 + rand() * 24) * s, 1);
  }

  // 잔물결: 가까울수록 줄 사이가 벌어지고 결이 길어진다. 빛 아래로는 윤슬이 한 줄기 내려온다
  for (let d = 1.5 * s; horizon + d < h;) {
    const v = d / (h - horizon), thick = v > 0.6 ? 2 : 1, gapY = (1.3 + v * 7) * s;
    const at = () => Math.round(horizon + d + rand() * gapY);
    const n = Math.round(w / s / (7 + v * 26));
    for (let i = 0; i < n; i++) {
      const x = rand() * w, y = at(), len = (3 + rand() * (5 + v * 50)) * s;
      if (i % 5 < 2) fill('#0b1330' + hex(0.2 + v * 0.25), x, y, len * 0.9, thick);
      else {
        fill('#a39fbb' + hex(0.36 - v * 0.14), x, y, len, thick);
        if (i % 5 === 4) fill('#0b1330' + hex(0.16 + v * 0.2), x + len * 0.15, y + thick, len * 0.8, 1);
      }
    }
    const half = (5 + 96 * v ** 0.85) * s;
    for (let i = 0; i < 10 - v * 4; i++) {
      const off = (rand() + rand() - 1) * half, near = 1 - Math.abs(off) / half;
      if (rand() > 0.25 + near * 0.7) continue;
      const len = (2 + rand() * (3 + v * 26)) * s;
      fill(near > 0.55 ? '#ffeccc' + hex(0.42 + 0.5 * near * (1 - v * 0.6)) : '#d2bcb494', cx + off - len / 2, at(), len, thick);
    }
    d += gapY;
  }
  fill('#f6e2cbb0', cx - 20 * s, horizon, 40 * s, 1);
  fill('#fff4dcd0', cx - 7 * s, horizon, 14 * s, 1);


  // ── 수평선의 안개: 하늘과 물이 거의 맞닿는다 ──
  const haze = g.createLinearGradient(0, horizon - 30 * s, 0, horizon + 12 * s);
  haze.addColorStop(0, '#c9aebb00'); haze.addColorStop(0.72, '#c9aebb50'); haze.addColorStop(1, '#c9aebb00');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 30 * s, w, 42 * s);
  fill('#a898ab', 0, horizon, w, 1);

  // ── 바위섬: 빛(가운데)을 향한 면이 밝다 ──
  for (const { B, dir, x, span, rise, prof, pts } of rocks) {
    const [, , peak, mid, lip, toe, end] = pts;
    const foot = (t: number): Point => [dir * (x + t * span), 0];
    // 높이 r(0~1)에서 윤곽이 놓인 가로 자리 (왼쪽 · 오른쪽)
    const edge = (r: number, from: number, to: number) => {
      for (let i = from; i !== to; i += Math.sign(to - from)) {
        const [t0, r0] = prof[i], [t1, r1] = prof[i + Math.sign(to - from)];
        if ((r0 - r) * (r1 - r) <= 0 && r0 !== r1) return t0 + (t1 - t0) * (r - r0) / (r1 - r0);
      }
      return prof[to][0];
    };
    B.poly('#2a3049', pts);
    B.poly('#3b415b', [lip, toe, end, foot(prof[4][0] - 0.06)]); // 빛 쪽으로 끊긴 단면
    // 셰일 결: 윤곽 안쪽으로만 눕는다
    for (let r = 0.2 + rand() * 0.1; r < 0.9 && rise > 4; r += 2.6 / rise) {
      const a = edge(r, 0, 2) + 0.03, b = edge(r, 6, 2) - 0.2, t0 = a + rand() * Math.max(0, b - a) * 0.5, t1 = t0 + (b - t0) * (0.4 + rand() * 0.6);
      if (t1 - t0 < 0.08) continue;
      B.box(r > 0.55 ? '#3b415b' : '#1f2540', dir > 0 ? x + t0 * span : -(x + t1 * span), -r * rise, (t1 - t0) * span, 1);
    }
    B.seg('#6d6683', pts[1][0], pts[1][1], peak[0], peak[1], 1);
    B.seg('#b9a5b0', peak[0], peak[1], mid[0], mid[1], 1);
    B.seg('#cdb7ba', mid[0], mid[1], lip[0], lip[1], 1);
    B.seg('#8d7f97', lip[0], lip[1], toe[0], toe[1], 1);
    B.box('#b9a7b470', Math.min(pts[0][0], end[0]) - 3, 0, span + 6, 1);
  }
  // 바위 발치를 감는 안개 줄기
  for (let i = 0; i < w / s / 5; i++) {
    const y = horizon - 2 * s - rand() ** 2 * 30 * s;
    fill('#d1b6c12e', rand() * w, y, (8 + rand() * 46) * s, 1);
  }

  // ── 그 빛 ──
  const S = brush(g, cx, cy, s);
  S.glow('#e8cdaa60', 0, 0, 96);
  S.glow('#ffeabdb4', 0, 0, 30);
  // 가는 빛살: 끝으로 갈수록 스러진다
  for (const [dx, dy, len] of [[0, 1, 66], [1, 0, 46]]) {
    const r = Math.round(len * s), ray = g.createLinearGradient(cx - dx * r, cy - dy * r, cx + dx * r, cy + dy * r);
    ray.addColorStop(0, '#fff0cc00'); ray.addColorStop(0.5, '#fff0ccb0'); ray.addColorStop(1, '#fff0cc00');
    g.fillStyle = ray;
    g.fillRect(cx - dx * r, cy - dy * r, dx ? r * 2 : 1, dy ? r * 2 : 1);
  }
  S.poly('#f6dcae', [[0, -27], [1.7, -1.7], [18, 0], [1.7, 1.7], [0, 27], [-1.7, 1.7], [-18, 0], [-1.7, -1.7]]);
  S.poly('#fff4ce', [[0, -15], [1.2, -1.2], [10, 0], [1.2, 1.2], [0, 15], [-1.2, 1.2], [-10, 0], [-1.2, -1.2]]);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) S.seg('#ffe9bc', dx * 2, dy * 2, dx * 6.5, dy * 6.5, 1);
  S.oval('#fffdf3', 0, 0, 3.6, 3.6);
  // 빛 둘레를 떠도는 가루
  for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2, r = 15 + rand() ** 1.4 * 56;
    const x = cx + Math.cos(a) * r * s, y = cy + Math.sin(a) * r * s, c = '#f5d7b7' + hex(0.85 - r / 100);
    if (i % 6 === 0) { fill(c, x - 1, y, 3, 1); fill(c, x, y - 1, 1, 3); }
    else fill(c, x, y, 1, 1);
  }

  vignette(g, w, h, '#03050c', 0.5);
}
