'use client';
import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { MAP_ZOOM_MAX, MAP_ZOOM_MIN, clampMapZoom, useSettings, type Settings } from '../state/settings';

interface Option<V> { value: V; label: string }

function Segmented<K extends keyof Settings>({ k, options }: { k: K; options: Option<Settings[K]>[] }) {
  const value = useSettings((s) => s[k]);
  const set = useSettings((s) => s.set);
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={value === o.value ? 'on' : ''} onClick={() => set(k, o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ON_OFF: Option<boolean>[] = [{ value: true, label: '켜기' }, { value: false, label: '끄기' }];

/** 부대 맵 확대 배율: 마우스 휠 / +·- 키와 같은 값 */
function ZoomRow() {
  const zoom = useSettings((s) => s.mapZoom);
  const set = useSettings((s) => s.set);
  const step = (mul: number) => set('mapZoom', clampMapZoom(zoom * mul));
  return (
    <div className="set-row">
      <div><b>맵 확대</b><div className="hud-dim">부대 맵에서 마우스 휠 또는 +/- 키로도 조절</div></div>
      <div className="seg">
        <button onClick={() => step(1 / 1.1)} disabled={zoom <= MAP_ZOOM_MIN}>－ 축소</button>
        <button className="on" onClick={() => set('mapZoom', 1)} title="기본 배율로">{Math.round(zoom * 100)}%</button>
        <button onClick={() => step(1.1)} disabled={zoom >= MAP_ZOOM_MAX}>＋ 확대</button>
      </div>
    </div>
  );
}

/** 음량: 10 단위로 조절, 0이면 끔 */
function VolumeRow({ k, label, hint }: { k: 'bgmVolume' | 'sfxVolume'; label: string; hint: string }) {
  const vol = useSettings((s) => s[k]);
  const set = useSettings((s) => s.set);
  const step = (d: number) => set(k, Math.max(0, Math.min(100, vol + d)));
  return (
    <div className="set-row">
      <div><b>{label}</b><div className="hud-dim">{hint}</div></div>
      <div className="seg">
        <button onClick={() => step(-10)} disabled={vol <= 0}>－</button>
        <button className="on" onClick={() => set(k, vol > 0 ? 0 : 60)} title="누르면 끄기/켜기">{vol > 0 ? `${vol}%` : '끔'}</button>
        <button onClick={() => step(10)} disabled={vol >= 100}>＋</button>
      </div>
    </div>
  );
}

/** 설정 메뉴: 게임 설정 + 저장/새 게임 */
export default function SettingsMenu() {
  const open = useSettings((s) => s.open);
  const close = useSettings((s) => s.closeMenu);
  const resetSettings = useSettings((s) => s.reset);
  const scene = useGame((s) => s.scene);
  const [confirm, setConfirm] = useState<null | 'new' | 'wipe'>(null);
  const [notice, setNotice] = useState('');
  const inGame = scene !== 'title';
  const canSave = scene === 'world' || scene === 'dayEnd' || scene === 'promotion';

  // 열려 있는 동안 다른 키 입력(대화 넘기기, 이동 등)을 막는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (confirm) setConfirm(null); else close(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, confirm, close]);

  useEffect(() => { if (!open) { setConfirm(null); setNotice(''); } }, [open]);

  if (!open) return null;

  const g = useGame.getState();
  const save = () => { g.save(); setNotice('💾 저장했습니다. (다음에 불러오면 그날 아침 침상에서 시작합니다)'); };
  const toTitle = () => { if (canSave) g.save(); close(); g.go('title'); };
  const startNew = () => { g.resetAll(); close(); };
  const wipe = () => { g.wipe(); setConfirm(null); setNotice('🗑️ 저장 데이터를 삭제했습니다.'); };

  return (
    <div className="modal-backdrop settings-backdrop" onClick={close}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <div className="menu-title">⚙️ 설정</div>
          <button className="nb-close" onClick={close}>✕</button>
        </div>

        <div className="settings-body">
          <section>
            <h4>게임 진행</h4>
            <div className="set-row">
              <div><b>🧪 테스터 모드</b><div className="hud-dim">F9 (또는 ` 키)로 진행 중인 미션을 즉시 종료</div></div>
              <Segmented k="testerMode" options={ON_OFF} />
            </div>
          </section>

          <section>
            <h4>소리</h4>
            <VolumeRow k="bgmVolume" label="🎵 배경음악" hint="장면에 맞춰 자동으로 바뀝니다" />
            <VolumeRow k="sfxVolume" label="🔔 효과음" hint="단서·별 조각·진급 등의 징글과 버튼 소리" />
          </section>

          <section>
            <h4>화면 · 대사</h4>
            <ZoomRow />
            <div className="set-row">
              <div><b>대사 속도</b></div>
              <Segmented k="textSpeed" options={[{ value: 'slow', label: '느리게' }, { value: 'normal', label: '보통' }, { value: 'fast', label: '빠르게' }, { value: 'instant', label: '즉시' }]} />
            </div>
            <div className="set-row">
              <div><b>화면 흔들림</b><div className="hud-dim">놀라는 장면 등의 흔들림 연출</div></div>
              <Segmented k="screenShake" options={ON_OFF} />
            </div>
            <div className="set-row">
              <div><b>군대 상식 카드</b><div className="hud-dim">꺼도 수첩의 '군대 상식'에는 모입니다</div></div>
              <Segmented k="showTips" options={ON_OFF} />
            </div>
            <div className="set-row end">
              <button className="link-btn" onClick={resetSettings}>설정 기본값으로</button>
            </div>
          </section>

          <section>
            <h4>게임 데이터</h4>
            {notice && <div className="set-notice">{notice}</div>}
            {confirm === null && (
              <div className="set-actions">
                {inGame && <button disabled={!canSave} onClick={save} title={canSave ? '' : '부대 생활 중에만 저장할 수 있어요'}>💾 지금 저장</button>}
                {inGame && <button onClick={toTitle}>🏠 {canSave ? '저장하고 ' : ''}타이틀로</button>}
                <button className="warn" onClick={() => setConfirm('new')}>🔄 새로 시작</button>
                <button className="danger" onClick={() => setConfirm('wipe')}>🗑️ 저장 데이터 삭제</button>
              </div>
            )}
            {confirm && (
              <div className="set-confirm">
                <div>
                  {confirm === 'new'
                    ? '정말 처음부터 새로 시작할까요? 진행 중인 게임과 저장 데이터가 모두 사라집니다.'
                    : '저장 데이터를 삭제할까요? 지금 진행 중인 화면은 그대로지만, 이어하기는 할 수 없게 됩니다.'}
                </div>
                <div className="set-actions">
                  <button className="danger" onClick={confirm === 'new' ? startNew : wipe}>{confirm === 'new' ? '새로 시작' : '삭제'}</button>
                  <button onClick={() => setConfirm(null)}>취소</button>
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="menu-foot">Esc 닫기 · 설정은 자동 저장됩니다</div>
      </div>
    </div>
  );
}
