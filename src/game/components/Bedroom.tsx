'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import type { Dir } from '../engine/drawMonster';
import { PX, SPRITE_H, drawExclaim, drawPixelHuman, drawRoomAnimated, renderRoomStatic } from '../engine/pixelArt';
import DialogueBox, { type DialogueScript } from './DialogueBox';
import Menu, { type MenuOption } from './Menu';
import TouchPad from './TouchPad';
import type { BranchId, Line } from '../types';
import { BRANCHES } from '../data/branches';
import { playSfx } from '../engine/audio';

/**
 * 오프닝: 입대 전날 밤, 주인공의 방 (2D 휴대용 게임기 시절 느낌).
 * - 자유 이동, 가까이 있는 물건을 E/Space로 조사한다.
 * - 그래픽은 도트(타일 16px)로 그린 뒤 정수 배율로 확대한다.
 * - 입영통지서를 확인한 뒤 침대에서 잠들면 꿈(군 선택)으로 넘어간다.
 */

const W = 13;
const H = 10;
const SPEED = 4.2; // 초당 칸 수

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
    '입영 일시: 내일 14:00 / 지참물: 신분증, 통지서, 개인 상비약',
    '……진짜 내일이구나. 그런데 입영 부대가… 어디였더라?',
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
    '채널을 돌리니 옛날 영화가 나온다. 네 명의 소년이 철길을 따라 걷고 있다…',
    '…나도 슬슬 가야겠다. (어디로…?)',
  ),
  console: narr(
    '🎮 아끼던 포켓몬 게임. 전원을 켜자 익숙한 박사님 목소리가 들린다. "포켓몬스터의 세계에 온 것을 환영한다!"',
    '세이브 파일 속 파트너들이 나를 보고 있다.',
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
  const player = useRef({ x: 6.5, y: 5.6, dir: 'down' as Dir, moving: false, walkT: 0 });
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
          '[조작] WASD/방향키로 이동, 물건 가까이에서 E/Space로 조사. 입영통지서를 확인한 뒤 침대에서 잠들자.',
        ),
      },
    });
  }, [setOverlay]);

  const goToSleep = useCallback(() => {
    setOverlay(null);
    sleepingRef.current = true;
    setSleeping(true);
    playSfx('sfx_switch', 0.9); // 딸깍. 불을 껐다
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
    if (o.id === 'notice') {
      // 입영 부대(육·해·공)를 떠올린다 — 어떤 포켓몬이 될지는 아직 모른다
      const chooseMenu = () => setOverlay({
        type: 'menu',
        title: '📜 입영통지서 — 입영 부대',
        subtitle: '통지서의 "입영 부대" 칸을 자세히 들여다본다…',
        options: (['army', 'navy', 'air'] as BranchId[]).map((id) => ({
          label: `${BRANCHES[id].name} — ${BRANCHES[id].noticePlace}`,
          hint: `복무 ${BRANCHES[id].months}개월`,
          onSelect: () => {
            useGame.getState().chooseBranch(id);
            markSeen('notice');
            setOverlay({ type: 'dialogue', script: { lines: narr(...BRANCHES[id].recall, '…좋아, 마음의 준비는 됐다. (거의)') } });
          },
        })),
      });
      if (!seenRef.current.includes('notice')) {
        setOverlay({ type: 'dialogue', script: { lines: TEXTS.notice }, onDone: chooseMenu });
      } else {
        const b = BRANCHES[useGame.getState().branch];
        setOverlay({
          type: 'menu',
          title: '📜 입영통지서',
          subtitle: `입영 부대: ${b.name} · ${b.noticePlace} · 내일 14:00`,
          options: [
            { label: '틀림없다. 확인 끝!', onSelect: () => setOverlay(null) },
            { label: '입영 부대를 다시 확인한다', hint: '군 다시 고르기', onSelect: chooseMenu },
          ],
        });
      }
      return;
    }
    markSeen(o.id);
    setOverlay({ type: 'dialogue', script: { lines: TEXTS[o.id] } });
  }, [setOverlay, goToSleep, markSeen]);

  /** 가까이 있는 물건 (가장 가까운 것) */
  const facing = useCallback((): RoomObj | null => {
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
    const o = facing();
    if (o) inspect(o);
  }, [facing, inspect]);
  const interactRef = useRef(interact);
  interactRef.current = interact;

  // 키 입력 (마운트 시 한 번만 등록 → 대화창보다 먼저 실행되어 같은 키로 재조사되지 않음)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (overlayRef.current || sleepingRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); keys.current = {}; useSettings.getState().openMenu(); return; }
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      keys.current[k] = true;
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

  // 루프: 타일 이동 + 도트 렌더
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const roomStatic = renderRoomStatic(W, H);
    const low = document.createElement('canvas');
    low.width = W * PX; low.height = H * PX;
    const lg = low.getContext('2d')!;

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
        const nx = p.x + (vx / len) * SPEED * dt;
        const ny = p.y + (vy / len) * SPEED * dt;
        if (!blocked(nx, p.y)) p.x = nx;
        if (!blocked(p.x, ny)) p.y = ny;
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
        p.moving = true;
        p.walkT += dt;
      } else { p.moving = false; p.walkT = 0; }

      const near = stop ? null : facing();
      if ((near?.id ?? null) !== (promptRef.current?.id ?? null)) {
        promptRef.current = near;
        setPrompt(near);
      }

      // ── 저해상도 캔버스에 그리기 ──
      lg.imageSmoothingEnabled = false;
      lg.drawImage(roomStatic, 0, 0);
      drawRoomAnimated(lg, t, seenRef.current.includes('notice'));
      const cx = p.x * PX;
      const footY = p.y * PX + 5;
      // 걷는 동안 서기 → 왼발 → 서기 → 오른발 순으로 반복
      const phase = Math.floor(p.walkT * 8) % 4;
      const frame = p.moving ? [1, 0, 2, 0][phase] : 0;
      drawPixelHuman(lg, cx, footY - (frame ? 1 : 0), p.dir, frame);
      if (near) drawExclaim(lg, cx, footY - SPRITE_H);

      // ── 정수 배율로 확대 ──
      const W2 = w * dpr, H2 = h * dpr;
      const scale = Math.max(1, Math.floor(Math.min(W2 / low.width, (H2 - 60 * dpr) / low.height)));
      const ox = Math.floor((W2 - low.width * scale) / 2), oy = Math.floor((H2 - low.height * scale) / 2 + 10 * dpr);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#0e0c12';
      g.fillRect(0, 0, W2, H2);
      g.imageSmoothingEnabled = false;
      g.drawImage(low, ox, oy, low.width * scale, low.height * scale);
      // 밤 분위기 (스탠드 쪽이 밝다)
      const grd = g.createRadialGradient(ox + 2.6 * PX * scale, oy + 2 * PX * scale, 10, ox + 6 * PX * scale, oy + 5 * PX * scale, Math.max(W2, H2) * 0.8);
      grd.addColorStop(0, 'rgba(255,220,150,0)');
      grd.addColorStop(1, 'rgba(10,12,40,0.35)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W2, H2);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [facing]);

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
      <div className="place-sign">{s.name}의 방</div>
      <div className="hud-top">
        <div className="hud-box">
          <div className="hud-day">입대 D-1</div>
          <div className="hud-dim">22:00 · 밤</div>
        </div>
        <div className="hud-box bedroom-todo">
          <div>{seen.includes('notice') ? `✔ 입영통지서 확인 (${BRANCHES[s.branch].name})` : '□ 입영통지서 확인하기'}</div>
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
