import type { Dir } from './drawMonster';

export interface HumanOpts {
  dir?: Dir;
  t?: number;
  walking?: boolean;
  shirt?: string;
  pants?: string;
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

/** 입대 전 주인공(사람) — 까까머리 2등신 캐릭터. (cx, baseY) 발 위치 기준 */
export function drawHuman(g: CanvasRenderingContext2D, cx: number, baseY: number, s: number, o: HumanOpts = {}) {
  const dir = o.dir ?? 'down';
  const t = o.t ?? 0;
  const shirt = o.shirt ?? '#5a7aa8';
  const pants = o.pants ?? '#3a3a48';
  const skin = '#f2d2b0';
  const hair = '#2a2420';
  const outline = 'rgba(30,20,20,0.55)';
  const step = o.walking ? Math.sin(t * 12) : 0;
  const bob = o.walking ? Math.abs(Math.sin(t * 12)) * s * 0.03 : 0;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;

  ellipse(g, cx, baseY - s * 0.02, s * 0.2, s * 0.05, 'rgba(0,0,0,0.22)');

  // 다리
  g.fillStyle = pants;
  if (side) {
    g.fillRect(cx - s * 0.06 + step * s * 0.06, baseY - s * 0.26, s * 0.1, s * 0.24);
    g.fillRect(cx - s * 0.04 - step * s * 0.06, baseY - s * 0.26, s * 0.1, s * 0.24);
  } else {
    g.fillRect(cx - s * 0.12, baseY - s * 0.26 - (step > 0 ? step * s * 0.03 : 0), s * 0.1, s * 0.24);
    g.fillRect(cx + s * 0.02, baseY - s * 0.26 + (step < 0 ? step * s * 0.03 : 0), s * 0.1, s * 0.24);
  }
  // 신발
  g.fillStyle = '#f2f2f2';
  if (!side) {
    g.fillRect(cx - s * 0.13, baseY - s * 0.05, s * 0.12, s * 0.05);
    g.fillRect(cx + s * 0.01, baseY - s * 0.05, s * 0.12, s * 0.05);
  } else {
    g.fillRect(cx - s * 0.05 + flip * s * 0.02, baseY - s * 0.05, s * 0.14, s * 0.05);
  }

  const by = baseY - s * 0.26 - bob;
  // 몸통 (후드티)
  g.fillStyle = shirt;
  g.beginPath();
  g.roundRect(cx - s * (side ? 0.14 : 0.17), by - s * 0.3, s * (side ? 0.28 : 0.34), s * 0.32, s * 0.07);
  g.fill();
  g.strokeStyle = outline; g.lineWidth = Math.max(1, s / 40); g.stroke();
  // 팔
  g.fillStyle = shirt;
  if (side) {
    g.fillRect(cx - s * 0.04 - step * s * 0.05, by - s * 0.26, s * 0.08, s * 0.22);
  } else {
    g.fillRect(cx - s * 0.23, by - s * 0.26 + step * s * 0.02, s * 0.07, s * 0.22);
    g.fillRect(cx + s * 0.16, by - s * 0.26 - step * s * 0.02, s * 0.07, s * 0.22);
    ellipse(g, cx - s * 0.195, by - s * 0.03, s * 0.035, s * 0.035, skin);
    ellipse(g, cx + s * 0.195, by - s * 0.03, s * 0.035, s * 0.035, skin);
  }
  if (dir === 'down') {
    // 후드 끈
    g.strokeStyle = '#e8e8f0'; g.lineWidth = Math.max(1, s / 40);
    g.beginPath(); g.moveTo(cx - s * 0.04, by - s * 0.28); g.lineTo(cx - s * 0.04, by - s * 0.16);
    g.moveTo(cx + s * 0.04, by - s * 0.28); g.lineTo(cx + s * 0.04, by - s * 0.16); g.stroke();
  }

  // 머리
  const hy = by - s * 0.48;
  const hr = s * 0.21;
  ellipse(g, cx, hy, hr, hr * 0.98, skin);
  g.strokeStyle = outline; g.lineWidth = Math.max(1, s / 40);
  g.beginPath(); g.ellipse(cx, hy, hr, hr * 0.98, 0, 0, Math.PI * 2); g.stroke();
  // 까까머리 (짧게 깎은 머리)
  g.fillStyle = hair;
  g.globalAlpha = 0.85;
  if (dir === 'up') {
    g.beginPath(); g.ellipse(cx, hy - hr * 0.05, hr * 0.98, hr * 0.92, 0, 0, Math.PI * 2); g.fill();
  } else if (side) {
    g.beginPath(); g.ellipse(cx - flip * hr * 0.15, hy - hr * 0.3, hr * 0.92, hr * 0.7, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx - flip * hr * 0.55, hy - hr * 0.1, hr * 0.45, hr * 0.55, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.ellipse(cx, hy - hr * 0.35, hr * 0.95, hr * 0.62, 0, Math.PI, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // 귀
  if (!side && dir !== 'up') {
    ellipse(g, cx - hr * 0.98, hy + hr * 0.05, hr * 0.14, hr * 0.2, skin);
    ellipse(g, cx + hr * 0.98, hy + hr * 0.05, hr * 0.14, hr * 0.2, skin);
  }
  // 얼굴
  if (dir !== 'up') {
    g.fillStyle = '#2a2420';
    const ey = hy + hr * 0.12;
    if (side) {
      ellipse(g, cx + flip * hr * 0.5, ey, hr * 0.09, hr * 0.12, '#2a2420');
      g.strokeStyle = '#a0604a'; g.lineWidth = Math.max(1, s / 45);
      g.beginPath(); g.moveTo(cx + flip * hr * 0.45, hy + hr * 0.5); g.lineTo(cx + flip * hr * 0.65, hy + hr * 0.48); g.stroke();
    } else {
      ellipse(g, cx - hr * 0.35, ey, hr * 0.09, hr * 0.12, '#2a2420');
      ellipse(g, cx + hr * 0.35, ey, hr * 0.09, hr * 0.12, '#2a2420');
      ellipse(g, cx - hr * 0.55, hy + hr * 0.4, hr * 0.12, hr * 0.07, 'rgba(240,130,120,0.45)');
      ellipse(g, cx + hr * 0.55, hy + hr * 0.4, hr * 0.12, hr * 0.07, 'rgba(240,130,120,0.45)');
      // 시무룩한 입
      g.strokeStyle = '#a0604a'; g.lineWidth = Math.max(1, s / 45);
      g.beginPath(); g.arc(cx, hy + hr * 0.62, hr * 0.15, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
    }
  }
}
