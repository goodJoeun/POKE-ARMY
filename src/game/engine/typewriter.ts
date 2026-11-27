'use client';
import { useCallback, useEffect, useState } from 'react';
import { TEXT_SPEED, useSettings } from '../state/settings';

/**
 * 대사 타자 효과 (대화창 · 꿈 · 오프닝 문답이 함께 쓴다). [지금까지 찍힌 글자 수, 한 번에 다 찍기]를 돌려준다.
 * - 진행 상태가 줄(key + 글)에 묶여 있다: 줄이 바뀐 바로 그 렌더에서 0부터 시작하므로,
 *   앞 줄에서 찍어 둔 글자 수만큼 새 줄이 먼저 비쳤다가 다시 찍히는 일이 없다.
 * - 흐른 시간으로 글자 수를 정한다: 화면이 잠깐 버벅여도 다음 프레임에 밀린 만큼 한꺼번에 따라잡는다.
 */
export function useTypewriter(key: string | number, text: string): [number, () => void] {
  const [typeMs, typeStep] = TEXT_SPEED[useSettings((st) => st.textSpeed)];
  const id = `${key}\n${text}`;
  const [state, setState] = useState({ id, n: 0 });
  const typed = typeMs === 0 ? text.length : state.id === id ? Math.min(state.n, text.length) : 0;

  useEffect(() => {
    if (typeMs === 0 || !text) return;
    const len = text.length;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const want = Math.min(len, Math.floor((now - start) / typeMs) * typeStep);
      setState((p) => (p.id === id && p.n >= want ? p : { id, n: want }));
      if (want < len) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // id에 key와 글이 모두 들어 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, typeMs, typeStep]);

  const finish = useCallback(() => setState({ id, n: text.length }), [id, text.length]);
  return [typed, finish];
}
