export type Ink = CanvasRenderingContext2D;
export type Point = [number, number];

export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
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
