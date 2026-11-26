export type Ink = CanvasRenderingContext2D;
export type Point = [number, number];

export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** 삽화 캔버스의 그림 해상도: 화면 비율이 달라도 그림 픽셀은 정사각형으로, 휴대폰에서도 폭 210 이상 */
export function artSize(cssW: number, cssH: number) {
  const aspect = cssW / Math.max(1, cssH);
  const w = Math.min(720, Math.max(210, Math.round(240 * aspect)));
  return { w, h: Math.max(1, Math.round(w / aspect)) };
}

export function rect(g: Ink, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function polygon(g: Ink, color: string, points: Point[]) {
  g.fillStyle = color;
  g.beginPath();
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fill();
}

export function line(g: Ink, color: string, x: number, y: number, dx: number, dy: number, width = 1) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  g.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    g.fillRect(Math.round(x + dx * i / steps), Math.round(y + dy * i / steps), width, width);
  }
}

export function wash(g: Ink, x: number, y: number, radius: number, color: string) {
  const light = g.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, color);
  light.addColorStop(1, color.slice(0, 7) + '00');
  g.fillStyle = light;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function sky(g: Ink, w: number, h: number, stops: string[]) {
  const gradient = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
  g.fillStyle = gradient;
  g.fillRect(0, 0, w, g.canvas.height);
}

export function gleam(g: Ink, x: number, y: number, size: number, color: string) {
  rect(g, color, x, y - size, 1, size * 2 + 1);
  rect(g, color, x - size, y, size * 2 + 1, 1);
  rect(g, '#fff2d4', x, y, 1, 1);
}

/**
 * 픽셀 글씨: 도트 글꼴의 한 칸을 그림의 한 픽셀로 찍는다 (cx, cy = 글씨 잉크의 한가운데).
 * 캔버스에 글꼴 크기 그대로 쓰면 브라우저가 가로로 번지게 그려서 (1px 획이 3·8·3처럼 퍼진다)
 * "ㅐ"처럼 1px 간격인 두 획이 붙어 버린다. 그래서 8배로 크게 쓴 뒤 각 칸의 가운데만 읽는다.
 * px는 그 글꼴이 픽셀 격자에 맞게 그려진 크기 (갈무리11 = 12, 갈무리9 = 10, 갈무리14 = 15).
 */
export function pixelText(g: Ink, text: string, cx: number, cy: number, color: string, family = 'Galmuri11', px = 12) {
  const k = 8;
  const c = document.createElement('canvas');
  const m = c.getContext('2d');
  if (!m) return;
  const font = `${px * k}px ${family}, sans-serif`;
  m.font = font;
  const cols = Math.ceil(m.measureText(text).width / k) + 1, rows = px + 4;
  c.width = cols * k; c.height = rows * k;
  m.font = font;
  m.textBaseline = 'alphabetic'; // 도트 글꼴은 기준선에 칸이 맞춰져 있다: 기준선을 칸 경계(위에서 px칸)에 둔다
  m.fillStyle = '#fff';
  m.fillText(text, 0, px * k);
  const d = m.getImageData(0, 0, c.width, c.height).data;
  const ink: [number, number][] = [];
  let x1 = cols, x2 = -1, y1 = rows, y2 = -1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (d[((y * k + k / 2) * c.width + x * k + k / 2) * 4 + 3] > 127) {
        ink.push([x, y]);
        x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
      }
  if (!ink.length) return;
  const x0 = Math.round(cx - (x2 - x1 + 1) / 2) - x1, y0 = Math.round(cy - (y2 - y1 + 1) / 2) - y1;
  g.fillStyle = color;
  for (const [x, y] of ink) g.fillRect(x0 + x, y0 + y, 1, 1);
}
