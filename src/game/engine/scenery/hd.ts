import type { Ink, Point } from './pixels';

/**
 * 고해상도 삽화용 붓.
 * 그림은 "세로 480칸"을 기준으로 한 설계 좌표로 그리고, 붓이 그걸 실제 캔버스 픽셀로 옮겨 찍는다
 * (ox, oy = 설계 원점이 놓일 캔버스 픽셀, s = 설계 1칸의 픽셀 수).
 * 모든 도형은 픽셀 경계에 맞춰 직접 채워서 가장자리가 번지지 않는다 (캔버스의 path 채우기는 가장자리를 흐리게 만든다).
 */
export function brush(g: Ink, ox: number, oy: number, s: number) {
  const X = (x: number) => Math.round(ox + x * s);
  const Y = (y: number) => Math.round(oy + y * s);
  const px = (c: string, x0: number, y0: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x0, y0, w, h); };

  /** 사각형 */
  const box = (c: string, x: number, y: number, w: number, h: number) => {
    const x0 = X(x), y0 = Y(y);
    px(c, x0, y0, Math.max(1, X(x + w) - x0), Math.max(1, Y(y + h) - y0));
  };

  /** 다각형 (줄 단위로 채운다) */
  const poly = (c: string, pts: Point[]) => {
    const p = pts.map(([x, y]) => [ox + x * s, oy + y * s] as Point);
    const y0 = Math.round(Math.min(...p.map((q) => q[1]))), y1 = Math.round(Math.max(...p.map((q) => q[1])));
    g.fillStyle = c;
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < p.length; i++) {
        const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
        if (b > a) g.fillRect(a, y, b - a, 1);
      }
    }
  };

  /** 타원 (inside 를 주면 그 조건에 맞는 칸만: 초승달 · 반쪽 채우기 등. dx, dy 는 중심에서의 거리를 반지름으로 나눈 값) */
  const oval = (c: string, x: number, y: number, rx: number, ry: number, inside?: (dx: number, dy: number) => boolean) => {
    const cx = ox + x * s, cy = oy + y * s, ax = Math.max(0.5, rx * s), ay = Math.max(0.5, ry * s);
    g.fillStyle = c;
    for (let j = Math.floor(cy - ay); j <= Math.ceil(cy + ay); j++) {
      const v = (j + 0.5 - cy) / ay;
      if (v * v > 1) continue;
      const half = ax * Math.sqrt(1 - v * v);
      const a = Math.round(cx - half), b = Math.round(cx + half);
      if (!inside) { if (b > a) g.fillRect(a, j, b - a, 1); continue; }
      for (let i = a; i < b; i++) if (inside((i + 0.5 - cx) / ax, v)) g.fillRect(i, j, 1, 1);
    }
  };

  /** 선 (굵기 t 칸) */
  const seg = (c: string, x1: number, y1: number, x2: number, y2: number, t = 1) => {
    const ax = ox + x1 * s, ay = oy + y1 * s, bx = ox + x2 * s, by = oy + y2 * s;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    const d = Math.max(1, Math.round(t * s));
    g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(ax + (bx - ax) * i / n - d / 2), Math.round(ay + (by - ay) * i / n - d / 2), d, d);
  };

  /** 세로 기둥들: x마다 위·아래 높이를 함수로 받아 채운다 (이불 능선처럼 굽은 윤곽) */
  const ridge = (c: string, x1: number, x2: number, top: (x: number) => number, bottom: (x: number) => number) => {
    g.fillStyle = c;
    for (let i = X(x1); i < X(x2); i++) {
      const x = (i + 0.5 - ox) / s;
      const a = Y(top(x)), b = Y(bottom(x));
      if (b > a) g.fillRect(i, a, 1, b - a);
    }
  };

  /** 부드러운 빛 번짐 */
  const glow = (c: string, x: number, y: number, r: number) => {
    const cx = X(x), cy = Y(y), rr = r * s;
    const light = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    light.addColorStop(0, c);
    light.addColorStop(1, c.slice(0, 7) + '00');
    g.fillStyle = light;
    g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  };

  /** 세로 그러데이션 사각형 */
  const fade = (stops: string[], x: number, y: number, w: number, h: number) => {
    const x0 = X(x), y0 = Y(y), y1 = Y(y + h);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
    g.fillStyle = gr;
    g.fillRect(x0, y0, X(x + w) - x0, y1 - y0);
  };

  /** 이 사각형 안에만 그린다 */
  const clip = (x: number, y: number, w: number, h: number, draw: () => void) => {
    g.save();
    g.beginPath();
    g.rect(X(x), Y(y), X(x + w) - X(x), Y(y + h) - Y(y));
    g.clip();
    draw();
    g.restore();
  };

  return { X, Y, s, box, poly, oval, seg, ridge, glow, fade, clip };
}
export type Brush = ReturnType<typeof brush>;

/**
 * 고해상도 삽화의 캔버스 크기: 예전 그림(세로 240칸)의 두 배쯤.
 * 그림 한 칸이 화면 픽셀의 정수배가 되게 맞춘다 (배율이 1.7배처럼 어중간하면 칸 크기가 들쭉날쭉해 보인다).
 */
export function hdSize(cssW: number, cssH: number) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const dw = cssW * dpr, dh = cssH * dpr;
  const want = Math.min(1440, Math.max(420, Math.round(480 * cssW / Math.max(1, cssH))));
  const k = Math.max(1, Math.round(dw / want));
  return { w: Math.max(1, Math.round(dw / k)), h: Math.max(1, Math.round(dh / k)) };
}

/** 가장자리를 어둡게 눌러 시선을 가운데로 모은다 */
export function vignette(g: Ink, w: number, h: number, color = '#04060e', strength = 0.55) {
  const r = Math.hypot(w, h) / 2;
  const shade = g.createRadialGradient(w / 2, h * 0.46, r * 0.45, w / 2, h * 0.46, r);
  shade.addColorStop(0, color + '00');
  shade.addColorStop(1, color + Math.round(strength * 255).toString(16).padStart(2, '0'));
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
}
