'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { drawHuman } from '../engine/drawHuman';
import type { Dir } from '../engine/drawMonster';
import DialogueBox, { type DialogueScript } from './DialogueBox';
import Menu, { type MenuOption } from './Menu';
import TouchPad from './TouchPad';
import type { Line } from '../types';

/**
 * 오프닝: 입대 전날 밤, 주인공의 방.
 * 방 안을 돌아다니며 물건을 조사하고, 입영통지서를 확인한 뒤 침대에서 잠들면 꿈(군 선택)으로 넘어간다.
 */

const T = 32;
const W = 13;
const H = 10;

type ObjId =
  | 'notice' | 'pc' | 'phone' | 'tv' | 'console' | 'bed' | 'mirror' | 'calendar'
  | 'window' | 'shelf' | 'plant' | 'door';

interface RoomObj {
  id: ObjId;
  label: string;
  /** 조사 기준점 (타일 좌표, 실수) */
  at: [number, number];
  radius?: number;
}

// 통과 불가 타일
const SOLID = new Set<string>();
const solid = (x: number, y: number) => SOLID.add(`${x},${y}`);
for (let x = 0; x < W; x++) { solid(x, 0); solid(x, 1); solid(x, H - 1); }
for (let y = 0; y < H; y++) { solid(0, y); solid(W - 1, y); }
[[1, 2], [2, 2], [3, 2], [6, 2], [7, 2], [9, 2], [10, 2], [11, 2], [10, 3], [11, 3], [1, 6], [1, 7], [11, 8]]
  .forEach(([x, y]) => solid(x, y));

const OBJECTS: RoomObj[] = [
  { id: 'notice', label: '책상 위 서류', at: [3.5, 2.5] },
  { id: 'pc', label: '컴퓨터', at: [1.5, 2.5] },
  { id: 'phone', label: '휴대폰', at: [9.5, 2.5] },
  { id: 'tv', label: 'TV', at: [6.5, 2.5] },
  { id: 'console', label: '게임기', at: [7.5, 2.5] },
  { id: 'bed', label: '침대', at: [10.5, 3.2], radius: 1.6 },
  { id: 'mirror', label: '거울', at: [4.5, 1.6] },
  { id: 'calendar', label: '달력', at: [5.5, 1.6] },
  { id: 'window', label: '창문', at: [8.5, 1.6] },
  { id: 'shelf', label: '책장', at: [1.5, 6.9], radius: 1.4 },
  { id: 'plant', label: '화분', at: [11.5, 8.5] },
  { id: 'door', label: '방문', at: [6.5, 9.4] },
];

const narr = (...texts: string[]): Line[] => texts.map((text) => ({ who: 'narr', text }));

const TEXTS: Record<Exclude<ObjId, 'bed'>, Line[]> = {
  notice: narr(
    '📜 입영통지서 — {me} 귀하',
    '입영 일시: 내일 14:00 / 입영 장소: ○○ 신병교육대 / 지참물: 신분증, 통지서, 개인 상비약',
    '……진짜 내일이구나.',
  ),
  pc: narr(
    '유튜브 시청 기록이 빼곡하다.',
    '「전입 신병 생존 가이드」 「선임한테 예쁨받는 법」 「관등성명 제대로 대는 법」 「전투준비태세 10분 컷」…',
    '밀리터리 채널 구독만 30개. 이 정도면 이론은 거의 병장급이다.',
    '…문제는 실전이 내일이라는 것.',
  ),
  phone: narr(
    '📱 단톡방 「우리 아직 젊다」 (안 읽은 메시지 23개)',
    '친구1: 내일 입대 실화냐 ㅋㅋㅋ  /  친구2: 훈련소 가면 편지 쓸게! (안 씀)',
    '친구3: 휴가 나오면 무조건 연락해라. 치킨은 내가 쏜다.',
    '…괜히 코끝이 찡하다.',
  ),
  tv: narr(
    '📺 「오늘 밤 전국에서 유성우가 관측되겠습니다. 별똥별을 보면 소원을 빌어 보세요.」',
    '소원이라… 빌 거면 하나밖에 없지.',
  ),
  console: narr(
    '🎮 아끼던 포켓몬 게임. 세이브 파일 속 파트너들이 나를 보고 있다.',
    '18개월 동안 못 하겠지… 다들 기다려 줘.',
  ),
  mirror: narr(
    '거울 속에 까까머리가 된 내가 있다.',
    '오늘 미용실에서 밀었는데… 아직도 어색하다.',
  ),
  calendar: narr(
    '📅 내일 날짜에 빨간 동그라미. 그리고 큼지막하게 적힌 두 글자.',
    '「입대」',
  ),
  window: narr(
    '창밖으로 별이 쏟아질 듯 반짝인다.',
    '그때, 하늘을 가로지르는 별똥별 하나!',
    '나도 모르게 중얼거렸다. "군대 가기 싫다…"',
  ),
  shelf: narr(
    '밀리터리 잡지 과월호가 한 칸을 꽉 채우고 있다. 그 옆엔 「입대 전에 읽을 책」들.',
    '잡지는 다 읽었고, 책은 한 권도 못 읽었다.',
  ),
  plant: narr(
    '엄마가 키우는 화분. 내가 없는 동안 물 좀 잘 받아먹어라.',
  ),
  door: narr(
    '방문 너머에서 엄마 목소리가 들린다.',
    '엄마: "내일 일찍 나가야 하니까 얼른 자라~! 불 끄고!"',
    '…나가긴 글렀다. 오늘은 방에 있자.',
  ),
};

type Overlay =
  | { type: 'dialogue'; script: DialogueScript; onDone?: () => void }
  | { type: 'menu'; title: string; subtitle?: string; options: MenuOption[] }
  | null;

export default function Bedroom() {
  const s = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const player = useRef({ x: 6.5, y: 5.6, dir: 'down' as Dir, moving: false });
  const [overlay, setOverlayState] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  const [prompt, setPrompt] = useState<RoomObj | null>(null);
  const promptRef = useRef<RoomObj | null>(null);
  const [seen, setSeen] = useState<ObjId[]>([]);
  const seenRef = useRef<ObjId[]>([]);
  const [sleeping, setSleeping] = useState(false);
  const sleepingRef = useRef(false);
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__roomPlayer = player; // 개발용 디버그 핸들
  }

  const setOverlay = useCallback((o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
  }, []);

  const markSeen = useCallback((id: ObjId) => {
    if (seenRef.current.includes(id)) return;
    seenRef.current = [...seenRef.current, id];
    setSeen(seenRef.current);
  }, []);

  // 첫 내레이션
  useEffect(() => {
    setOverlay({
      type: 'dialogue',
      script: {
        lines: narr(
          '입대 하루 전날 밤, 22시.',
          '{me}의 방. 내일이면 이 방도 한동안 안녕이다.',
          '군대 유튜브와 밀리터리 잡지로 단련된 자칭 "준비된 신병". …그래도 가기 싫은 건 싫다.',
          '[조작] WASD/방향키로 이동, E/Space로 조사. 방을 둘러보고, 입영통지서를 확인한 뒤 침대에서 잠들자.',
        ),
      },
    });
  }, [setOverlay]);

  const goToSleep = useCallback(() => {
    setOverlay(null);
    sleepingRef.current = true;
    setSleeping(true);
    setTimeout(() => useGame.getState().go('intro'), 1400);
  }, [setOverlay]);

  const inspect = useCallback((o: RoomObj) => {
    if (o.id === 'bed') {
      if (!seenRef.current.includes('notice')) {
        setOverlay({ type: 'dialogue', script: { lines: narr('아직 잠이 안 온다…', '자기 전에 책상 위 입영통지서를 한 번 더 확인하자.') } });
        return;
      }
      setOverlay({
        type: 'menu',
        title: '🛏️ 침대',
        subtitle: '내일은 입대 날이다. 이제 잘까?',
        options: [
          { label: '불을 끄고 잠든다', hint: '오프닝 종료', onSelect: goToSleep },
          { label: '조금 더 방을 둘러본다', onSelect: () => setOverlay(null) },
        ],
      });
      markSeen('bed');
      return;
    }
    markSeen(o.id);
    setOverlay({ type: 'dialogue', script: { lines: TEXTS[o.id] } });
  }, [setOverlay, goToSleep, markSeen]);

  const findNear = useCallback((): RoomObj | null => {
    const p = player.current;
    let best: RoomObj | null = null;
    let bd = Infinity;
    for (const o of OBJECTS) {
      const d = Math.hypot(p.x - o.at[0], p.y - o.at[1]);
      if (d < (o.radius ?? 1.25) && d < bd) { bd = d; best = o; }
    }
    return best;
  }, []);

  const interact = useCallback(() => {
    if (overlayRef.current || sleepingRef.current) return;
    const o = promptRef.current ?? findNear();
    if (o) inspect(o);
  }, [findNear, inspect]);
  const interactRef = useRef(interact);
  interactRef.current = interact;

  // 키 입력 (마운트 시 한 번만 등록 → 대화창보다 먼저 실행되어 같은 키로 재조사되지 않음)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (overlayRef.current || sleepingRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); keys.current = {}; useSettings.getState().openMenu(); return; }
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'e' || k === ' ' || k === 'enter') interactRef.current();
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // 루프: 이동 + 그리기
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const blocked = (x: number, y: number) => {
      const r = 0.28;
      return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]
        .some(([px, py]) => SOLID.has(`${Math.floor(px)},${Math.floor(py)}`));
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const p = player.current;
      const stop = !!overlayRef.current || sleepingRef.current || useSettings.getState().open;

      let vx = 0, vy = 0;
      if (!stop) {
        const k = keys.current;
        if (k['arrowleft'] || k['a']) vx -= 1;
        if (k['arrowright'] || k['d']) vx += 1;
        if (k['arrowup'] || k['w']) vy -= 1;
        if (k['arrowdown'] || k['s']) vy += 1;
      }
      if (vx || vy) {
        const len = Math.hypot(vx, vy);
        const nx = p.x + (vx / len) * 4.2 * dt;
        const ny = p.y + (vy / len) * 4.2 * dt;
        if (!blocked(nx, p.y)) p.x = nx;
        if (!blocked(p.x, ny)) p.y = ny;
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
        p.moving = true;
      } else p.moving = false;

      const near = stop ? null : findNear();
      if ((near?.id ?? null) !== (promptRef.current?.id ?? null)) {
        promptRef.current = near;
        setPrompt(near);
      }

      // ── 그리기 ──
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#0e0c12';
      g.fillRect(0, 0, w, h);
      const zoom = Math.max(1, Math.min(2.2, Math.min(w / (W * T), (h - 40) / (H * T)) * 0.95));
      const ox = (w - W * T * zoom) / 2, oy = (h - H * T * zoom) / 2 + 10;
      g.save();
      g.translate(ox, oy);
      g.scale(zoom, zoom);
      drawRoom(g, t, seenRef.current);
      drawHuman(g, p.x * T, p.y * T + 12, 44, { dir: p.dir, t, walking: p.moving });
      if (near && !stop) {
        g.fillStyle = '#ffe14a';
        g.font = 'bold 16px sans-serif';
        g.textAlign = 'center';
        g.fillText('!', near.at[0] * T, near.at[1] * T - 18 + Math.sin(t * 5) * 2);
      }
      g.restore();
      // 밤 분위기 (스탠드 조명)
      const lg = g.createRadialGradient(ox + 2.5 * T * zoom, oy + 2.5 * T * zoom, 20, ox + 6 * T * zoom, oy + 5 * T * zoom, Math.max(w, h));
      lg.addColorStop(0, 'rgba(255,220,150,0)');
      lg.addColorStop(1, 'rgba(10,12,40,0.45)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [findNear]);

  const closeOverlay = useCallback(() => {
    const o = overlayRef.current;
    setOverlay(null);
    if (o?.type === 'dialogue' && o.onDone) o.onDone();
  }, [setOverlay]);

  const explorable = OBJECTS.filter((o) => o.id !== 'bed' && o.id !== 'door').length;
  const explored = seen.filter((id) => id !== 'bed' && id !== 'door').length;

  return (
    <div className="world bedroom">
      <div className="world-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <div className="hud-top">
        <div className="hud-box">
          <div className="hud-day">입대 D-1</div>
          <div className="hud-dim">22:00 · {s.name}의 방</div>
        </div>
        <div className="hud-box bedroom-todo">
          <div>{seen.includes('notice') ? '✔' : '□'} 입영통지서 확인하기</div>
          <div>□ 침대에서 잠들기</div>
          <div className="hud-dim">방 둘러보기 {explored}/{explorable}</div>
        </div>
      </div>
      {prompt && !overlay && !sleeping && (
        <div className="prompt" onClick={interact}>
          <kbd>E</kbd> 조사: {prompt.label}
        </div>
      )}
      <TouchPad keys={keys} onAction={interact} />
      {overlay?.type === 'dialogue' && (
        <DialogueBox key={overlay.script.lines[0].text} script={overlay.script} onClose={closeOverlay} />
      )}
      {overlay?.type === 'menu' && <Menu title={overlay.title} subtitle={overlay.subtitle} options={overlay.options} onClose={() => setOverlay(null)} />}
      {sleeping && <div className="sleep-fade"><span>딸깍. 불을 껐다…</span></div>}
    </div>
  );
}

// ───────────── 방 그리기 ─────────────
function drawRoom(g: CanvasRenderingContext2D, t: number, seen: ObjId[]) {
  // 바닥 (마루)
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    g.fillStyle = (x + y) % 2 ? '#c8945a' : '#c08c52';
    g.fillRect(x * T, y * T, T, T);
    g.fillStyle = 'rgba(90,50,20,0.18)';
    g.fillRect(x * T, y * T + T - 2, T, 2);
    if ((x * 7 + y * 3) % 5 === 0) g.fillRect(x * T + 10, y * T + 12, 10, 1);
  }
  // 벽 (벽지)
  g.fillStyle = '#e8e0cc'; g.fillRect(T, 0, (W - 2) * T, 2 * T);
  g.fillStyle = '#d8ccb0';
  for (let x = T; x < (W - 1) * T; x += 16) g.fillRect(x, 0, 2, 2 * T);
  g.fillStyle = '#a07a50'; g.fillRect(T, 2 * T - 6, (W - 2) * T, 6); // 걸레받이
  // 테두리 벽
  g.fillStyle = '#5a4a3e';
  g.fillRect(0, 0, T, H * T); g.fillRect((W - 1) * T, 0, T, H * T);
  g.fillRect(0, (H - 1) * T, W * T, T);
  g.fillStyle = '#6e5c4c'; g.fillRect(0, (H - 1) * T, W * T, 5);

  // 러그
  g.fillStyle = '#7a8ac0'; g.beginPath(); g.roundRect(4.6 * T, 4.6 * T, 3.8 * T, 2.4 * T, 10); g.fill();
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 2; g.beginPath(); g.roundRect(4.8 * T, 4.8 * T, 3.4 * T, 2.0 * T, 8); g.stroke();

  // 거울
  g.fillStyle = '#8a6a4a'; g.fillRect(4 * T + 6, 0.3 * T, T - 12, 1.4 * T);
  g.fillStyle = '#bfe0f0'; g.fillRect(4 * T + 9, 0.3 * T + 3, T - 18, 1.4 * T - 6);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(4 * T + 11, 0.3 * T + 6, 3, 1.4 * T - 16);
  // 달력
  g.fillStyle = '#ffffff'; g.fillRect(5 * T + 4, 0.5 * T, T - 8, T);
  g.fillStyle = '#d03a3a'; g.fillRect(5 * T + 4, 0.5 * T, T - 8, 7);
  g.fillStyle = '#9a9a9a';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) g.fillRect(5 * T + 7 + j * 5, 0.5 * T + 11 + i * 6, 3, 3);
  g.strokeStyle = '#e03a3a'; g.lineWidth = 1.5; g.beginPath(); g.arc(5 * T + 17, 0.5 * T + 18, 4, 0, Math.PI * 2); g.stroke();
  // 창문 + 밤하늘 + 별똥별
  const wx = 8 * T - 6, wy = 0.25 * T, ww = T + 12, wh = 1.3 * T;
  g.fillStyle = '#6a4a30'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  g.fillStyle = '#16204a'; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = '#f2ecc8'; g.beginPath(); g.arc(wx + ww - 9, wy + 9, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) g.fillRect(wx + ((i * 13) % (ww - 4)) + 2, wy + ((i * 17) % (wh - 6)) + 3, 1.5, 1.5);
  const ph = (t * 0.35) % 1;
  if (ph < 0.35) {
    const k = ph / 0.35;
    g.strokeStyle = `rgba(255,250,200,${1 - k})`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(wx + 4 + k * ww, wy + 4 + k * wh * 0.6); g.lineTo(wx + k * ww - 6, wy + k * wh * 0.6 - 2); g.stroke();
  }
  g.fillStyle = '#6a4a30'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh / 2 - 1, ww, 2);

  // 책상 + 컴퓨터 + 입영통지서
  g.fillStyle = '#8a5a3a'; g.fillRect(1 * T, 2 * T + 4, 3 * T, T - 8);
  g.fillStyle = '#6a4228'; g.fillRect(1 * T, 3 * T - 6, 3 * T, 4);
  g.fillStyle = '#2a2e38'; g.fillRect(1 * T + 4, 1.6 * T, T - 6, 0.75 * T);
  g.fillStyle = '#5ac0f2'; g.fillRect(1 * T + 7, 1.6 * T + 3, T - 12, 0.75 * T - 7);
  g.fillStyle = '#3a3e48'; g.fillRect(1.5 * T - 3, 2.35 * T, 6, 4);
  g.fillStyle = '#f2f2ea'; g.save(); g.translate(3.5 * T, 2.45 * T); g.rotate(-0.15); g.fillRect(-9, -7, 18, 13); g.restore();
  g.fillStyle = '#d03a3a'; g.fillRect(3.5 * T - 6, 2.45 * T - 5, 7, 2);
  if (!seen.includes('notice')) {
    const glow = (Math.sin(t * 4) + 1) / 2;
    g.strokeStyle = `rgba(255,225,74,${0.4 + glow * 0.5})`; g.lineWidth = 2;
    g.beginPath(); g.arc(3.5 * T, 2.45 * T, 13 + glow * 3, 0, Math.PI * 2); g.stroke();
  }
  // 스탠드
  g.fillStyle = '#e8d8a0'; g.beginPath(); g.moveTo(2.3 * T, 1.75 * T); g.lineTo(2.75 * T, 1.75 * T); g.lineTo(2.62 * T, 1.5 * T); g.lineTo(2.43 * T, 1.5 * T); g.fill();
  g.fillStyle = '#5a5a5a'; g.fillRect(2.5 * T, 1.75 * T, 2, 0.6 * T);
  // 의자
  g.fillStyle = '#4a4a58'; g.beginPath(); g.roundRect(2 * T + 6, 3 * T + 2, T - 12, T - 10, 5); g.fill();

  // TV 장 + TV + 게임기
  g.fillStyle = '#6a4a30'; g.fillRect(6 * T, 2 * T + 8, 2 * T, T - 12);
  g.fillStyle = '#1a1a20'; g.fillRect(6 * T + 2, 1.35 * T, T + 6, 0.95 * T);
  const flick = 0.75 + Math.sin(t * 9) * 0.05;
  g.fillStyle = `rgba(110,170,230,${flick})`; g.fillRect(6 * T + 5, 1.35 * T + 3, T, 0.95 * T - 7);
  g.fillStyle = '#f2f2f2'; g.fillRect(7.25 * T, 2.2 * T, 14, 6);
  g.fillStyle = '#e04a4a'; g.fillRect(7.25 * T, 2.2 * T, 3, 6);
  g.fillStyle = '#4a7ae0'; g.fillRect(7.25 * T + 11, 2.2 * T, 3, 6);

  // 협탁 + 휴대폰
  g.fillStyle = '#8a5a3a'; g.fillRect(9 * T + 3, 2 * T + 4, T - 6, T - 8);
  g.fillStyle = '#2a2a30'; g.fillRect(9.5 * T - 4, 2.4 * T, 8, 12);
  if (Math.sin(t * 3) > 0.3) { g.fillStyle = '#6af2a0'; g.fillRect(9.5 * T - 2, 2.4 * T + 2, 4, 3); }

  // 침대
  g.fillStyle = '#7a5030'; g.fillRect(10 * T, 2 * T, 2 * T, 2 * T);
  g.fillStyle = '#f2f2ea'; g.fillRect(10 * T + 4, 2 * T + 4, 2 * T - 8, 2 * T - 6);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(10 * T + 8, 2 * T + 6, 2 * T - 16, 14, 5); g.fill();
  g.fillStyle = '#5a8ad0'; g.fillRect(10 * T + 4, 2.75 * T, 2 * T - 8, 1.25 * T - 2);
  g.fillStyle = '#4a7ac0'; g.fillRect(10 * T + 4, 2.75 * T, 2 * T - 8, 4);

  // 책장
  g.fillStyle = '#7a5030'; g.fillRect(1 * T + 2, 6 * T - 6, T - 4, 2 * T + 6);
  const bookCols = ['#d04a4a', '#4a8ad0', '#e8b030', '#5ab05a', '#9a5ad0', '#f28a3a'];
  for (let r = 0; r < 4; r++) {
    g.fillStyle = '#5a3a20'; g.fillRect(1 * T + 2, 6 * T - 6 + r * 17 + 15, T - 4, 2);
    for (let i = 0; i < 4; i++) { g.fillStyle = bookCols[(r * 4 + i) % bookCols.length]; g.fillRect(1 * T + 5 + i * 6, 6 * T - 6 + r * 17 + 2, 5, 13); }
  }
  // 화분
  g.fillStyle = '#b06a3a'; g.fillRect(11 * T + 9, 8 * T + 14, 14, 14);
  g.fillStyle = '#3f9a4a'; g.beginPath(); g.arc(11.5 * T, 8 * T + 10, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5ab05a'; g.beginPath(); g.arc(11.5 * T - 5, 8 * T + 6, 5, 0, Math.PI * 2); g.fill();
  // 방문
  g.fillStyle = '#6a4228'; g.fillRect(6 * T + 1, (H - 1) * T - 2, T - 2, T + 2);
  g.fillStyle = '#8a5a3a'; g.fillRect(6 * T + 4, (H - 1) * T + 2, T - 8, T - 4);
  g.fillStyle = '#f2c230'; g.fillRect(6 * T + T - 10, (H - 1) * T + 14, 3, 3);
}
