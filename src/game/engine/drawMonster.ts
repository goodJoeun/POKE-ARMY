import type { MonsterLook } from '../types';
import { getDot, getSilhouette, getSprite, getSpriteAnim, getWalkSprite, hasFollower } from './sprites';

/** 어나더 레드 정면/뒷모습 애니메이션 재생 속도 (초당 프레임) */
const ANIM_FPS = 14;

export type Dir = 'down' | 'up' | 'left' | 'right';
export type CapType = 'army' | 'navy' | 'air' | 'officer-army' | 'officer-navy' | 'officer-air' | null;

export interface DrawOpts {
  dir?: Dir;
  t?: number;
  walking?: boolean;
  cap?: CapType;
  sleeping?: boolean;
  shadow?: boolean;
  /** 실루엣 색 (지정 시 이미지를 단색으로) */
  silhouette?: string;
  /** 공식 일러스트 사용 여부 (기본: 사용 안 함 — 도트로 그린다) */
  art?: boolean;
  /**
   * 이 상자 밖으로 그림이 나가지 않게 맞춘다 (초상화 캔버스용, 캔버스 좌표).
   * 스프라이트의 실제 그림 영역(투명 여백 제외)을 재서 상자 안에 들어오도록 줄이고, 발을 baseY에 맞춘다.
   */
  fit?: { left: number; top: number; right: number; bottom: number };
}

/** 스프라이트의 실제 그림 영역 (투명 여백 제외). 이미지마다 한 번만 잰다 */
const boxCache = new WeakMap<CanvasImageSource, { x: number; y: number; w: number; h: number }>();
function contentBox(img: HTMLCanvasElement | HTMLImageElement, sw: number, sh: number) {
  const hit = boxCache.get(img);
  if (hit) return hit;
  let box = { x: 0, y: 0, w: sw, h: sh };
  try {
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const cg = c.getContext('2d')!;
    cg.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh);
    const d = cg.getImageData(0, 0, sw, sh).data;
    let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if (d[(y * sw + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 >= 0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch { /* 읽을 수 없는 이미지면 전체를 그림 영역으로 본다 */ }
  boxCache.set(img, box);
  return box;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 1) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}

/**
 * 몬스터를 (cx, baseY) 발 위치 기준으로 그린다. size = 대략적인 전체 높이(px)
 */
export function drawMonster(g: CanvasRenderingContext2D, look: MonsterLook, cx: number, baseY: number, size: number, o: DrawOpts = {}) {
  const dir = o.dir ?? 'down';
  const t = o.t ?? 0;
  const s = size;
  const bob = o.walking ? Math.abs(Math.sin(t * 12)) * s * 0.05 : Math.sin(t * 2.5) * s * 0.015;

  // 등록된 포켓몬 이미지가 있으면 도트로 그린다
  // - 필드(작은 크기): 2등신 도트 아이콘 (없으면 배틀 스프라이트를 줄인 도트)
  // - 큰 화면(초상화 등): 도트 배틀 스프라이트를 또렷하게 확대
  // - 공식 일러스트는 o.art 로 명시할 때만
  const kind = o.art ? 'art' : dir === 'up' ? 'back' : 'front';
  const field = !o.art && s < 70;
  // 필드: 2등신 아이콘으로 만든 방향별 걷기 스프라이트 (서기 / 왼발 / 서기 / 오른발)
  const walkStep = o.walking ? [1, 0, 2, 0][Math.floor(t * 8) % 4] : 0;
  const walk = field ? getWalkSprite(look.sprite, dir, walkStep) : null;
  const src = walk ?? (field ? getDot(look.sprite, kind) : getSprite(look.sprite, kind));
  if (src) {
    const img = o.silhouette ? getSilhouette(look.sprite!, walk ? `walk-${dir}-${walkStep}` : kind, src, o.silhouette) : src;
    if (o.shadow !== false) ellipse(g, cx, baseY - s * 0.02, s * 0.3, s * 0.06, 'rgba(0,0,0,0.22)');
    // 높이 기준으로 맞추되 너무 넓은 포켓몬(갸라도스 등)은 폭을 제한
    const hMul = kind === 'art' ? 1.0 : walk ? 1.35 : 1.25;
    // 팔로워 시트는 포켓몬끼리 크기 비율이 맞춰져 있으므로 같은 배율로 그린다 (큰 포켓몬은 크게)
    // 큰 화면(초상화·미니게임): 어나더 레드 애니메이션 띠가 있으면 프레임을 넘기며 움직이게
    const anim = !walk && !field && !o.silhouette && kind !== 'art' ? getSpriteAnim(look.sprite, kind) : null;
    const animOn = !!anim && anim.n > 1;
    // 그릴 원본 크기 (애니메이션이면 모든 프레임을 감싸는 상자)
    const srcW = animOn ? anim!.bw : img.width, srcH = animOn ? anim!.bh : img.height;
    let scale = walk && hasFollower(look.sprite)
      ? (s * 1.35) / 40
      : Math.min((s * hMul) / srcH, (s * 1.5) / srcW);
    // 초상화: 실제 그림 영역이 상자 안에 다 들어오게 줄이고, 그림의 발끝을 baseY에 맞춘다
    let offX = 0, offY = 0;
    if (o.fit) {
      const box = animOn ? { x: 0, y: 0, w: srcW, h: srcH } : contentBox(img, srcW, srcH);
      const availW = o.fit.right - o.fit.left, availH = o.fit.bottom - o.fit.top;
      scale = Math.min(scale, availW / box.w, availH / box.h);
      const w0 = srcW * scale, h0 = srcH * scale;
      offX = w0 / 2 - (box.x + box.w / 2) * scale; // 그림 한가운데를 cx에
      offY = h0 - (box.y + box.h) * scale; // 그림 발끝을 baseY에
      const top = baseY - box.h * scale;
      if (top < o.fit.top) offY += o.fit.top - top; // 위가 잘리면 아래로 내린다
      const bottom = baseY + (offY - (h0 - (box.y + box.h) * scale));
      if (bottom > o.fit.bottom) offY -= bottom - o.fit.bottom;
    }
    const w = srcW * scale, h = srcH * scale;
    // 도트는 통통 튀는 걸음 (부드러운 흔들림 대신 2단계)
    const hop = o.walking ? (Math.sin(t * 12) > 0 ? s * 0.06 : 0) : 0;
    g.save();
    g.translate(Math.round(cx), Math.round(baseY - hop));
    // 도트 스프라이트는 왼쪽을 바라보므로 오른쪽으로 걸을 때 뒤집는다
    if (dir === 'right' && kind !== 'art' && !walk) g.scale(-1, 1);
    g.imageSmoothingEnabled = kind === 'art'; // 도트는 확대해도 또렷하게
    const dx = Math.round(-w / 2 + offX), dy = Math.round(-h + offY);
    if (animOn) {
      const f = Math.floor(Math.max(0, t) * ANIM_FPS) % anim!.n;
      g.drawImage(anim!.img, f * anim!.fh + anim!.x0, anim!.y0, anim!.bw, anim!.bh, dx, dy, Math.round(w), Math.round(h));
    } else {
      g.drawImage(img, dx, dy, Math.round(w), Math.round(h));
    }
    g.restore();
    if (o.sleeping) {
      g.fillStyle = '#4a5a8a';
      g.font = `bold ${Math.round(s * 0.18)}px sans-serif`;
      const zz = (t * 0.8) % 1;
      g.globalAlpha = 1 - zz;
      g.fillText('z', cx + s * 0.3, baseY - h - zz * s * 0.3);
      g.globalAlpha = 1;
    }
    return;
  }
  const outline = shade(look.body, -70);
  const lw = Math.max(1, s / 40);

  let rx = s * 0.32, ry = s * 0.3;
  if (look.shape === 'tall') { rx = s * 0.27; ry = s * 0.36; }
  if (look.shape === 'wide') { rx = s * 0.38; ry = s * 0.28; }
  const cy = baseY - ry - s * 0.06 - bob;
  const flip = dir === 'left' ? -1 : 1;
  const side = dir === 'left' || dir === 'right';

  if (o.shadow !== false) ellipse(g, cx, baseY - s * 0.02, rx * 0.9, s * 0.06, 'rgba(0,0,0,0.22)');

  // 꼬리 (뒤)
  const tailX = side ? cx - flip * rx * 0.95 : cx + rx * 0.75;
  const tailY = cy + ry * 0.35;
  const drawTail = () => {
    switch (look.tail) {
      case 'flame': {
        const fl = 1 + Math.sin(t * 10) * 0.12;
        ellipse(g, tailX, tailY - s * 0.08, s * 0.09, s * 0.13 * fl, look.accent);
        ellipse(g, tailX, tailY - s * 0.06, s * 0.05, s * 0.08 * fl, '#ffe14a');
        break;
      }
      case 'fin': {
        g.beginPath();
        g.moveTo(tailX, tailY);
        g.lineTo(tailX + (side ? -flip : 1) * s * 0.18, tailY - s * 0.12);
        g.lineTo(tailX + (side ? -flip : 1) * s * 0.18, tailY + s * 0.1);
        g.closePath();
        g.fillStyle = look.accent; g.fill(); g.strokeStyle = outline; g.lineWidth = lw; g.stroke();
        break;
      }
      case 'leaf':
        ellipse(g, tailX, tailY - s * 0.05, s * 0.06, s * 0.11, look.accent, outline, lw);
        break;
      case 'puff':
        ellipse(g, tailX, tailY - s * 0.02, s * 0.1, s * 0.09, shade(look.body, 20), outline, lw);
        break;
      case 'spike':
        g.beginPath();
        g.moveTo(tailX, tailY - s * 0.05);
        g.lineTo(tailX + (side ? -flip : 1) * s * 0.2, tailY + s * 0.02);
        g.lineTo(tailX, tailY + s * 0.07);
        g.closePath();
        g.fillStyle = look.accent; g.fill(); g.strokeStyle = outline; g.lineWidth = lw; g.stroke();
        break;
    }
  };
  if (dir !== 'up') drawTail();

  // 날개 (뒤쪽)
  if (look.wings) {
    const flap = o.walking ? Math.sin(t * 14) * 0.25 : Math.sin(t * 3) * 0.08;
    for (const sd of side ? [-flip] : [-1, 1]) {
      g.save();
      g.translate(cx + sd * rx * 0.85, cy);
      g.rotate(sd * (0.5 + flap));
      ellipse(g, 0, -s * 0.02, s * 0.1, s * 0.2, shade(look.body, -20), outline, lw);
      g.restore();
    }
  }

  // 발
  const step = o.walking ? Math.sin(t * 12) * s * 0.04 : 0;
  ellipse(g, cx - rx * 0.45, baseY - s * 0.06 + step, s * 0.08, s * 0.05, shade(look.body, -30), outline, lw);
  ellipse(g, cx + rx * 0.45, baseY - s * 0.06 - step, s * 0.08, s * 0.05, shade(look.body, -30), outline, lw);

  // 등껍질 / 숯불 (뒤쪽 디테일)
  if (look.extra === 'shell') {
    const shx = side ? cx - flip * rx * 0.4 : cx;
    ellipse(g, shx, cy - ry * 0.15, rx * 0.85, ry * 0.8, look.accent, shade(look.accent, -60), lw);
    g.strokeStyle = shade(look.accent, -50); g.lineWidth = lw;
    g.beginPath(); g.arc(shx, cy - ry * 0.15, rx * 0.45, 0, Math.PI * 1.6); g.stroke();
  }

  // 귀 (몸 뒤)
  const earY = cy - ry * 0.8;
  const drawEars = () => {
    const ex = rx * 0.55;
    const pairs = side ? [flip * -0.2] : [-1, 1];
    for (const sd of pairs) {
      const x = cx + sd * ex;
      switch (look.ears) {
        case 'round':
          ellipse(g, x, earY, s * 0.08, s * 0.08, look.body, outline, lw);
          ellipse(g, x, earY, s * 0.04, s * 0.04, look.belly);
          break;
        case 'pointy':
          g.beginPath();
          g.moveTo(x - s * 0.07, earY + s * 0.05);
          g.lineTo(x + sd * s * 0.02, earY - s * 0.14);
          g.lineTo(x + s * 0.07, earY + s * 0.05);
          g.closePath(); g.fillStyle = look.body; g.fill(); g.strokeStyle = outline; g.lineWidth = lw; g.stroke();
          break;
        case 'horns':
          g.beginPath();
          g.moveTo(x - s * 0.03, earY + s * 0.04);
          g.lineTo(x + sd * s * 0.04, earY - s * 0.12);
          g.lineTo(x + s * 0.03, earY + s * 0.04);
          g.closePath(); g.fillStyle = '#f2ead6'; g.fill(); g.strokeStyle = outline; g.lineWidth = lw; g.stroke();
          break;
        case 'fin':
          g.beginPath();
          g.moveTo(x - s * 0.06, earY + s * 0.06);
          g.quadraticCurveTo(x + sd * s * 0.1, earY - s * 0.12, x + sd * s * 0.12, earY + s * 0.04);
          g.closePath(); g.fillStyle = look.accent; g.fill(); g.strokeStyle = outline; g.lineWidth = lw; g.stroke();
          break;
        case 'tuft':
          for (let i = -1; i <= 1; i++) ellipse(g, x + i * s * 0.03, earY - s * 0.02 - (i === 0 ? s * 0.03 : 0), s * 0.03, s * 0.07, shade(look.body, 15), outline, lw * 0.7);
          break;
        case 'antler':
          g.strokeStyle = '#8a6a3a'; g.lineWidth = lw * 2.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, earY + s * 0.04); g.lineTo(x + sd * s * 0.06, earY - s * 0.14);
          g.moveTo(x + sd * s * 0.03, earY - s * 0.05); g.lineTo(x + sd * s * 0.12, earY - s * 0.08); g.stroke();
          break;
        case 'feather':
          ellipse(g, x + sd * s * 0.03, earY - s * 0.04, s * 0.04, s * 0.09, look.accent, outline, lw * 0.7);
          break;
      }
    }
  };
  drawEars();

  // 몸
  ellipse(g, cx, cy, rx, ry, look.body, outline, lw * 1.2);
  // 배
  if (dir !== 'up') {
    const bx = side ? cx + flip * rx * 0.25 : cx;
    ellipse(g, bx, cy + ry * 0.3, rx * (side ? 0.5 : 0.62), ry * 0.55, look.belly);
  }
  // 무늬
  if (look.extra === 'spots') {
    for (const [a, b, r] of [[-0.5, -0.3, 0.07], [0.45, -0.1, 0.05], [-0.2, 0.15, 0.04]] as const) {
      ellipse(g, cx + a * rx * (side ? flip : 1), cy + b * ry, s * r, s * r, shade(look.body, -35));
    }
  }
  if (look.extra === 'ember' && dir !== 'down') {
    const fl = 1 + Math.sin(t * 9) * 0.15;
    ellipse(g, cx - flip * rx * 0.2, cy - ry * 0.4, s * 0.1 * fl, s * 0.07 * fl, look.accent);
    ellipse(g, cx - flip * rx * 0.2, cy - ry * 0.45, s * 0.05, s * 0.04, '#ffe14a');
  }
  if (look.extra === 'ember' && dir === 'down') {
    const fl = 1 + Math.sin(t * 9) * 0.15;
    ellipse(g, cx, cy - ry * 0.92, s * 0.07 * fl, s * 0.06 * fl, look.accent);
    ellipse(g, cx, cy - ry * 0.95, s * 0.035, s * 0.03, '#ffe14a');
  }
  if (look.extra === 'tentacles') {
    g.strokeStyle = look.accent; g.lineWidth = lw * 2.2; g.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * rx * 0.35;
      g.beginPath(); g.moveTo(x, cy + ry * 0.8);
      g.quadraticCurveTo(x + Math.sin(t * 4 + i) * s * 0.05, cy + ry * 1.05, x + Math.sin(t * 4 + i) * s * 0.03, baseY - s * 0.02);
      g.stroke();
    }
  }

  if (dir === 'up') {
    drawTail();
  } else {
    // 얼굴
    const fx = side ? cx + flip * rx * 0.35 : cx;
    const fy = cy - ry * 0.12;
    const eyeSep = side ? 0 : rx * 0.36;
    const eyes = side ? [fx + flip * rx * 0.12] : [fx - eyeSep, fx + eyeSep];
    if (look.extra === 'mask' && !side) {
      ellipse(g, fx, fy, rx * 0.65, ry * 0.25, shade(look.body, -40));
    }
    for (const ex of eyes) {
      if (o.sleeping) {
        g.strokeStyle = '#2a2a2a'; g.lineWidth = lw * 1.4;
        g.beginPath(); g.arc(ex, fy, s * 0.04, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
        continue;
      }
      switch (look.eyes) {
        case 'big':
          ellipse(g, ex, fy, s * 0.065, s * 0.075, '#ffffff', '#2a2a2a', lw);
          ellipse(g, ex + flip * s * 0.01, fy + s * 0.01, s * 0.04, s * 0.05, '#2a2a3a');
          ellipse(g, ex - s * 0.012, fy - s * 0.02, s * 0.015, s * 0.015, '#ffffff');
          break;
        case 'sharp':
          g.fillStyle = '#2a2a3a';
          g.beginPath();
          g.moveTo(ex - s * 0.055, fy - s * 0.02 * (ex < cx ? 1 : -1) * (side ? 0 : 1) - s * 0.01);
          g.lineTo(ex + s * 0.055, fy - s * 0.02 * (ex < cx ? -1 : 1) * (side ? 0 : 1) - s * 0.01);
          g.lineTo(ex, fy + s * 0.04);
          g.closePath(); g.fill();
          ellipse(g, ex, fy, s * 0.012, s * 0.012, '#ffffff');
          break;
        case 'sleepy':
          ellipse(g, ex, fy + s * 0.01, s * 0.045, s * 0.025, '#2a2a3a');
          g.fillStyle = look.body; g.fillRect(ex - s * 0.05, fy - s * 0.03, s * 0.1, s * 0.035);
          break;
        default:
          ellipse(g, ex, fy, s * 0.035, s * 0.042, '#2a2a3a');
          ellipse(g, ex - s * 0.01, fy - s * 0.014, s * 0.012, s * 0.012, '#ffffff');
      }
    }
    if (look.extra === 'cheeks' || look.extra === 'mask') {
      const cheekCol = look.extra === 'cheeks' ? 'rgba(255,110,120,0.55)' : 'rgba(0,0,0,0)';
      for (const ex of side ? [fx + flip * rx * 0.05] : [fx - eyeSep * 1.45, fx + eyeSep * 1.45]) {
        ellipse(g, ex, fy + s * 0.07, s * 0.045, s * 0.028, cheekCol);
      }
    }
    // 입
    const my = fy + s * 0.08;
    const mx = side ? fx + flip * rx * 0.3 : fx;
    g.strokeStyle = '#2a2a2a'; g.lineWidth = lw * 1.1; g.lineCap = 'round';
    switch (look.mouth) {
      case 'beak':
        g.beginPath();
        g.moveTo(mx - s * 0.05 * (side ? 0.3 : 1), my - s * 0.025);
        g.lineTo(mx + (side ? flip * s * 0.09 : 0), my + (side ? 0 : s * 0.04));
        g.lineTo(mx + s * 0.05 * (side ? 0.3 : 1), my - s * 0.025);
        g.closePath(); g.fillStyle = look.accent === look.body ? '#f2a030' : '#f2b040'; g.fill(); g.stroke();
        break;
      case 'cat':
        g.beginPath();
        g.arc(mx - s * 0.025, my, s * 0.025, 0, Math.PI);
        g.arc(mx + s * 0.025, my, s * 0.025, 0, Math.PI);
        g.stroke();
        break;
      case 'fang':
        g.beginPath(); g.arc(mx, my - s * 0.01, s * 0.04, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(mx + s * 0.012, my + s * 0.022); g.lineTo(mx + s * 0.026, my + s * 0.022); g.lineTo(mx + s * 0.019, my + s * 0.045); g.closePath(); g.fill();
        break;
      default:
        g.beginPath(); g.arc(mx, my - s * 0.015, s * 0.04, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    }
  }

  // 모자
  if (o.cap) {
    const hy = cy - ry * 0.82;
    const hw = rx * 0.9;
    const officer = o.cap.startsWith('officer');
    const kind = o.cap.replace('officer-', '');
    if (kind === 'navy' && !officer) {
      ellipse(g, cx, hy, hw * 0.95, s * 0.07, '#ffffff', '#9aa0aa', lw);
      ellipse(g, cx, hy + s * 0.025, hw * 0.98, s * 0.03, '#2a3a6a');
    } else {
      const col = kind === 'army' ? '#5a6a3a' : kind === 'navy' ? '#1f2a4a' : '#3a5a8a';
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - hw, hy + s * 0.04);
      g.lineTo(cx - hw * 0.85, hy - s * 0.07);
      g.lineTo(cx + hw * 0.85, hy - s * 0.07);
      g.lineTo(cx + hw, hy + s * 0.04);
      g.closePath(); g.fill();
      g.strokeStyle = shade(col, -40); g.lineWidth = lw; g.stroke();
      if (dir !== 'up') {
        const bx = side ? cx + flip * hw * 0.6 : cx;
        ellipse(g, bx, hy + s * 0.045, side ? hw * 0.6 : hw * 0.85, s * 0.025, shade(col, -25));
      }
      if (officer && dir !== 'up') {
        ellipse(g, side ? cx + flip * hw * 0.3 : cx, hy - s * 0.015, s * 0.03, s * 0.025, '#f2c230');
      }
    }
  }

  if (o.sleeping) {
    g.fillStyle = '#4a5a8a';
    g.font = `bold ${Math.round(s * 0.18)}px sans-serif`;
    const zz = (t * 0.8) % 1;
    g.globalAlpha = 1 - zz;
    g.fillText('z', cx + rx * 0.8, cy - ry - zz * s * 0.3);
    g.globalAlpha = 1;
  }
}

/** 물음표 도트 (8×11). 1일차 화장실 거울을 보기 전, 내 모습 대신 그린다 */
const UNKNOWN_SELF = [
  '..####..',
  '.######.',
  '##....##',
  '......##',
  '.....##.',
  '....##..',
  '...##...',
  '...##...',
  '........',
  '...##...',
  '...##...',
];

/**
 * 아직 거울로 확인하지 못한 내 모습: 포켓몬 대신 물음표를 (cx, baseY) 발 위치 기준으로 그린다.
 * size는 drawMonster와 같은 기준(대략적인 전체 높이)이다.
 */
export function drawUnknownSelf(g: CanvasRenderingContext2D, cx: number, baseY: number, size: number, o: Pick<DrawOpts, 't' | 'walking' | 'shadow' | 'sleeping'> = {}) {
  const t = o.t ?? 0;
  const rows = UNKNOWN_SELF.length, cols = UNKNOWN_SELF[0].length;
  // 외곽선 1칸씩을 더한 높이가 size의 약 85%가 되도록 (정수 픽셀로 또렷하게)
  const p = Math.max(1, Math.round((size * 0.85) / (rows + 2)));
  const hop = o.walking ? (Math.sin(t * 12) > 0 ? size * 0.06 : 0) : Math.round(Math.sin(t * 2.5) * p * 0.5);
  if (o.shadow !== false) ellipse(g, cx, baseY - size * 0.02, size * 0.22, size * 0.05, 'rgba(0,0,0,0.22)');
  const x0 = Math.round(cx - (cols * p) / 2);
  const y0 = Math.round(baseY - hop - (rows + 1) * p);
  const on = (x: number, y: number) => y >= 0 && y < rows && x >= 0 && x < cols && UNKNOWN_SELF[y][x] === '#';
  g.save();
  // 외곽선 → 몸통 순서로 칠한다
  g.fillStyle = '#26263a';
  for (let y = -1; y <= rows; y++) for (let x = -1; x <= cols; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillRect(x0 + x * p, y0 + y * p, p, p);
  }
  g.fillStyle = '#f4f0e2';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (on(x, y)) g.fillRect(x0 + x * p, y0 + y * p, p, p);
  }
  g.restore();
  if (o.sleeping) {
    g.fillStyle = '#4a5a8a';
    g.font = `bold ${Math.round(size * 0.18)}px sans-serif`;
    const zz = (t * 0.8) % 1;
    g.globalAlpha = 1 - zz;
    g.fillText('z', cx + (cols * p) / 2, y0 - zz * size * 0.3);
    g.globalAlpha = 1;
  }
}
