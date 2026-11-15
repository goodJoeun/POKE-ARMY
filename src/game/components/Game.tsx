'use client';
import { useEffect } from 'react';
import { useGame } from '../state/store';
import World from './World';
import MinigameHost from '../minigames/MinigameHost';
import Toasts from './Toasts';
import Bedroom from './Bedroom';
import SettingsMenu from './SettingsMenu';
import { useSettings } from '../state/settings';
import { runtime } from '../engine/runtime';
import { initSprites } from '../engine/sprites';
import { DayEnd, Ending, Intro, Promotion, Quiz, Title, Transform } from './Scenes';
import Dream from './Dream';
import BgmDirector from './BgmDirector';
import { dreamPending } from '../data/story';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 개발용 디버그 핸들 (콘솔에서 __game.getState() 등)
  (window as unknown as Record<string, unknown>).__game = useGame;
  (window as unknown as Record<string, unknown>).__runtime = runtime;
}

initSprites();

/** 테스터 모드 미션 종료 단축키 */
const isSkipKey = (e: KeyboardEvent) => e.key === 'F9' || e.code === 'Backquote';
/** 테스터 모드에서 미니게임을 끝낼 때 주는 점수 (A등급) */
const TESTER_SCORE = 80;

export default function Game() {
  const scene = useGame((s) => s.scene);
  const day = useGame((s) => s.day);
  const tester = useSettings((s) => s.testerMode);
  // 하루 끝 결산 전에 오늘 밤 꿈(별의 언덕)을 먼저 본다
  const dreaming = useGame((s) => s.scene === 'dayEnd' && dreamPending(s));

  // 🧪 테스터 모드: 진행 중인 미션 즉시 종료
  // - 미니게임: A등급(80점)으로 바로 끝냄
  // - 부대 화면: 점호 의식 / 지각 꾸중 / 현재 일정을 끝내도록 월드에 알림
  useEffect(() => {
    if (!tester) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isSkipKey(e) || e.repeat || useSettings.getState().open) return;
      e.preventDefault();
      e.stopPropagation();
      const st = useGame.getState();
      if (st.scene === 'minigame' && st.minigame) {
        const title = st.minigame.title;
        st.finishMinigame(TESTER_SCORE, '🧪 테스터 모드로 즉시 종료');
        st.toast(`🧪 테스터 모드: "${title}" 종료 (A등급 처리)`, 'info');
        return;
      }
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
      {scene === 'minigame' && <MinigameHost />}
      {scene === 'promotion' && <Promotion />}
      {scene === 'dayEnd' && (dreaming ? <Dream /> : <DayEnd />)}
      {scene === 'ending' && <Ending />}
      {(scene === 'world' || scene === 'promotion' || scene === 'dayEnd') && <Toasts />}
      {/* 설정 버튼: 타이틀·부대(HUD에 있음)·미니게임 진행 중을 제외한 화면 */}
      {scene !== 'title' && scene !== 'world' && scene !== 'minigame' && (
        <button className="gear-btn" title="설정 (Esc)" onClick={() => useSettings.getState().openMenu()}>⚙️</button>
      )}
      {tester && (scene === 'world' || scene === 'minigame') && <div className="tester-badge">🧪 TEST · F9 미션 종료</div>}
      <SettingsMenu />
      <BgmDirector />
    </div>
  );
}
