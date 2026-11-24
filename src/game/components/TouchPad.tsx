'use client';
import { useEffect, useRef, useState } from 'react';

type Keys = React.MutableRefObject<Record<string, boolean>>;

const DIR_KEYS = { u: 'arrowup', d: 'arrowdown', l: 'arrowleft', r: 'arrowright' } as const;
/** 가운데에서 반지름의 이 비율 안쪽은 '안 누름' */
const DEAD = 0.18;
/** 대각선으로 치는 범위: 45° 방향에서 ±이 각도 안 (나머지는 가까운 상하좌우로 붙인다) */
const DIAG = 17;

/** 패드 가운데에서 본 손가락 위치 → 눌린 방향들 ('', 'u', 'ur', 'r' …) */
function dirsAt(dx: number, dy: number, radius: number): string {
  if (Math.hypot(dx, dy) < radius * DEAD) return '';
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = 오른쪽, 90 = 아래
  const near = Math.round(deg / 45) * 45;
  const diagonal = Math.abs(near % 90) === 45 && Math.abs(deg - near) <= DIAG;
  const a = (((diagonal ? near : Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return ({ 0: 'r', 45: 'dr', 90: 'd', 135: 'dl', 180: 'l', 225: 'ul', 270: 'u', 315: 'ur' } as Record<number, string>)[a] ?? '';
}

/** 키보드 E를 누른 것과 똑같이 알린다 → 상호작용 · 대화 넘기기 · 안내 닫기가 키보드와 같은 길로 처리된다 */
const pressKey = (type: 'keydown' | 'keyup') => window.dispatchEvent(new KeyboardEvent(type, { key: 'e', bubbles: true }));

/**
 * 터치 기기용 조작부.
 * - 방향패드: 판 하나가 손가락을 따라간다. 누른 채 미끄러뜨리면 떼지 않고도 방향이 바뀐다 (대각선 포함)
 * - 확인 버튼(이중 원): 상호작용 · 대화 넘기기
 */
export default function TouchPad({ keys }: { keys: Keys }) {
  const pad = useRef<HTMLDivElement>(null);
  const finger = useRef<number | null>(null);
  const [held, setHeld] = useState('');

  const apply = (dirs: string) => {
    for (const [d, k] of Object.entries(DIR_KEYS)) keys.current[k] = dirs.includes(d);
    setHeld(dirs);
  };
  const track = (x: number, y: number) => {
    const r = pad.current!.getBoundingClientRect();
    apply(dirsAt(x - (r.left + r.width / 2), y - (r.top + r.height / 2), r.width / 2));
  };
  const release = () => { finger.current = null; apply(''); };

  // 손가락이 패드 밖에서 떨어지거나, 대화가 떠서 패드가 가려진 사이에 떨어져도 놓친 것으로 치지 않게
  useEffect(() => {
    const end = (e: PointerEvent) => { if (e.pointerId === finger.current) release(); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keys.current[k] = true; },
    onPointerUp: () => { keys.current[k] = false; },
    onPointerLeave: () => { keys.current[k] = false; },
    onPointerCancel: () => { keys.current[k] = false; },
  });

  return (
    <div className="touchpad">
      <div
        ref={pad}
        className="dpad"
        role="group"
        aria-label="방향패드"
        onPointerDown={(e) => {
          if (finger.current !== null) return;
          e.preventDefault();
          finger.current = e.pointerId;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 이미 떨어진 손가락 */ }
          track(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => { if (e.pointerId === finger.current) track(e.clientX, e.clientY); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <i className={`up ${held.includes('u') ? 'on' : ''}`}>▲</i>
        <i className={`left ${held.includes('l') ? 'on' : ''}`}>◀</i>
        <i className="mid" />
        <i className={`right ${held.includes('r') ? 'on' : ''}`}>▶</i>
        <i className={`down ${held.includes('d') ? 'on' : ''}`}>▼</i>
      </div>
      <div className="touch-actions">
        <button className="dash" {...hold('shift')} onContextMenu={(e) => e.preventDefault()}>달리기</button>
        <button
          className="action"
          aria-label="확인 · 상호작용"
          onPointerDown={(e) => { e.preventDefault(); pressKey('keydown'); }}
          onPointerUp={() => pressKey('keyup')}
          onPointerCancel={() => pressKey('keyup')}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
