'use client';
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

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 개발용 디버그 핸들 (콘솔에서 __game.getState() 등)
  (window as unknown as Record<string, unknown>).__game = useGame;
  (window as unknown as Record<string, unknown>).__runtime = runtime;
}

initSprites();

export default function Game() {
  const scene = useGame((s) => s.scene);
  const day = useGame((s) => s.day);
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
      {scene === 'dayEnd' && <DayEnd />}
      {scene === 'ending' && <Ending />}
      {(scene === 'world' || scene === 'promotion' || scene === 'dayEnd') && <Toasts />}
      {/* 설정 버튼: 타이틀·부대(HUD에 있음)·미니게임 진행 중을 제외한 화면 */}
      {scene !== 'title' && scene !== 'world' && scene !== 'minigame' && (
        <button className="gear-btn" title="설정 (Esc)" onClick={() => useSettings.getState().openMenu()}>⚙️</button>
      )}
      <SettingsMenu />
    </div>
  );
}
