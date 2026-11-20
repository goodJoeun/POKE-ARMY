'use client';
import { useEffect } from 'react';
import { useGame } from '../state/store';
import World from './World';
import Toasts from './Toasts';
import Bedroom from './Bedroom';
import SettingsMenu from './SettingsMenu';
import { useSettings } from '../state/settings';
import { runtime } from '../engine/runtime';
import { initSprites } from '../engine/sprites';
import { DayEnd, Ending, Intro, Promotion, Quiz, Title, Transform } from './Scenes';
import Dream from './Dream';
import BgmDirector from './BgmDirector';
import { STORY_MISSIONS, dreamPending, missionState } from '../data/story';
import { errandNow } from '../data/errands';
import { ORDERS } from '../data/orders';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 개발용 디버그 핸들 (콘솔에서 __game.getState() 등)
  (window as unknown as Record<string, unknown>).__game = useGame;
  (window as unknown as Record<string, unknown>).__runtime = runtime;
  (window as unknown as Record<string, unknown>).__errand = () => errandNow(useGame.getState());
  (window as unknown as Record<string, unknown>).__settings = useSettings;
  (window as unknown as Record<string, unknown>).__storyOpen = () => {
    const st = useGame.getState();
    return st.clues.length === 0 ? [] : STORY_MISSIONS.filter((m) => missionState(m, st) === 'open').map((m) => ({ id: m.id, spot: m.spot, hasOrder: !!ORDERS[m.id], ordered: !!st.flags[`order_${m.id}`] }));
  };
}

initSprites();

/** 테스터 모드 미션 종료 단축키 */
const isSkipKey = (e: KeyboardEvent) => e.key === 'F9' || e.code === 'Backquote';

export default function Game() {
  const scene = useGame((s) => s.scene);
  const day = useGame((s) => s.day);
  const tester = useSettings((s) => s.testerMode);
  // 하루 끝 결산 전에 오늘 밤 꿈(별의 언덕)을 먼저 본다
  const dreaming = useGame((s) => s.scene === 'dayEnd' && dreamPending(s));

  // 🧪 테스터 모드: 진행 중인 미션 즉시 종료
  // - 부대 화면: 점호 의식 / 현재 일정을 끝내도록 월드에 알림
  useEffect(() => {
    if (!tester) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSkipKey(e) || e.repeat || useSettings.getState().open) return;
      e.preventDefault();
      e.stopPropagation();
      const st = useGame.getState();
      if (st.scene === 'world') window.dispatchEvent(new Event('tester-skip'));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tester]);

  return (
    <div className="game-root">
      {scene === 'title' && <Title />}
      {scene === 'home' && <Bedroom />}
      {scene === 'intro' && <Intro />}
      {scene === 'quiz' && <Quiz />}
      {scene === 'transform' && <Transform />}
      {scene === 'world' && <World key={`world-${day}`} />}
      {scene === 'promotion' && <Promotion />}
      {scene === 'dayEnd' && (dreaming ? <Dream /> : <DayEnd />)}
      {scene === 'ending' && <Ending />}
      {(scene === 'world' || scene === 'promotion' || scene === 'dayEnd') && <Toasts />}
      {/* 설정 버튼: 타이틀·부대(HUD에 있음)를 제외한 화면 */}
      {scene !== 'title' && scene !== 'world' && (
        <button className="gear-btn" title="설정 (Esc)" onClick={() => useSettings.getState().openMenu()}>⚙️</button>
      )}
      {tester && scene === 'world' && <div className="tester-badge">🧪 TEST · F9 미션 종료</div>}
      <SettingsMenu />
      <BgmDirector />
    </div>
  );
}
