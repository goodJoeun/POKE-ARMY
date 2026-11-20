'use client';
import { useEffect, useRef } from 'react';

/** 화면 가운데 크게 뜨는 안내 카드 (새 임무 · 호출 등). Enter / Space / E / 클릭으로 닫는다 */
export interface NoticeInfo {
  icon: string;
  /** 카드 맨 위의 작은 머리말 (예: "새 임무") */
  kicker: string;
  title: string;
  /** 누가 시켰는지 등 한 줄 */
  from?: string;
  lines?: string[];
}

export default function Notice({ info, onClose }: { info: NoticeInfo; onClose: () => void }) {
  // 앞 대화를 넘기던 키 입력이 이어져 곧바로 닫히지 않게, 잠깐 뒤부터 입력을 받는다
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'e' && e.key !== 'E' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.repeat || performance.now() - openedAt.current < 350) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="notice-wrap" onClick={() => performance.now() - openedAt.current > 350 && onClose()}>
      <div className="notice" role="dialog" aria-label={`${info.kicker}: ${info.title}`}>
        <div className="notice-icon">{info.icon}</div>
        <div className="notice-kicker">{info.kicker}</div>
        <div className="notice-title">{info.title}</div>
        {info.from && <div className="notice-from">{info.from}</div>}
        {info.lines?.map((l, i) => <div key={i} className="notice-line">{l}</div>)}
        <div className="notice-foot">Enter · 클릭으로 닫기</div>
      </div>
    </div>
  );
}
