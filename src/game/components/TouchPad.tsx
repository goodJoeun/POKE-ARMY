'use client';

/** 터치 기기용 방향키 + 상호작용 버튼 */
export default function TouchPad({ keys, onAction }: { keys: React.MutableRefObject<Record<string, boolean>>; onAction: () => void }) {
  const bind = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keys.current[k] = true; },
    onPointerUp: () => { keys.current[k] = false; },
    onPointerLeave: () => { keys.current[k] = false; },
    onPointerCancel: () => { keys.current[k] = false; },
  });
  return (
    <div className="touchpad">
      <div className="dpad">
        <button className="up" {...bind('arrowup')}>▲</button>
        <button className="left" {...bind('arrowleft')}>◀</button>
        <button className="right" {...bind('arrowright')}>▶</button>
        <button className="down" {...bind('arrowdown')}>▼</button>
      </div>
      <div className="touch-actions">
        <button className="dash" {...bind('shift')}>달리기</button>
        <button className="action" onPointerDown={(e) => { e.preventDefault(); onAction(); }}>E</button>
      </div>
    </div>
  );
}
