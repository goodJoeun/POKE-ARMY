'use client';
/**
 * 사운드: BGM(끊김 없는 루프 + 크로스페이드) · 징글 · 효과음
 * - 파일은 public/audio/*.ogg (목록·사용처는 public/audio/README.md)
 * - 브라우저 정책상 첫 클릭/키 입력 뒤에 소리가 나기 시작한다
 * - 어떤 곡을 틀지는 components/BgmDirector.tsx 가 게임 상태를 보고 정한다
 */
export type BgmId =
  | 'bgm_01_title' | 'bgm_02_bedroom_night' | 'bgm_03_dream_star_hill' | 'bgm_04_barracks_day'
  | 'bgm_05_rollcall_march' | 'bgm_06_messhall_free' | 'bgm_07_training_minigame' | 'bgm_08_night_duty_fog'
  | 'bgm_09_mystery_clues' | 'bgm_10_boss_slipper' | 'bgm_11_ending_same_star';
export type JingleId =
  | 'jingle_clue_found' | 'jingle_star_fragment' | 'jingle_quest_complete' | 'jingle_promotion' | 'jingle_heal'
  | 'jingle_day_end_sleep' | 'jingle_dream_enter' | 'jingle_late_scolded' | 'jingle_minigame_clear' | 'jingle_minigame_fail';
export type SfxId =
  | 'sfx_cursor' | 'sfx_confirm' | 'sfx_cancel' | 'sfx_text_blip' | 'sfx_save' | 'sfx_alert' | 'sfx_bump' | 'sfx_footstep'
  | 'sfx_door' | 'sfx_whistle' | 'sfx_purchase' | 'sfx_pendulum_ticktock' | 'sfx_fog_whiteout' | 'sfx_star_twinkle' | 'sfx_stamina_empty';

const BASE = '/audio/';
const FADE = 0.7; // 곡 전환 크로스페이드(초)
const DUCK = 0.22; // 징글이 울리는 동안 BGM 음량 배율

interface Playing { id: BgmId; src: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number; loop: boolean }

let ctx: AudioContext | null = null;
let bgmBus: GainNode | null = null; // 설정의 BGM 음량
let duckBus: GainNode | null = null; // 징글 중 줄이기
let sfxBus: GainNode | null = null; // 설정의 효과음 음량
let current: Playing | null = null;
let wanted: { id: BgmId; loop: boolean } | null = null;
let bgmVol = 0.6;
let sfxVol = 0.7;
let duckUntil = 0;
const buffers = new Map<string, Promise<AudioBuffer>>();
/** 곡마다 멈춘 위치 — 다시 틀 때 이어서 재생 (장소를 오갈 때 매번 처음부터 나오지 않게) */
const resumeAt: Partial<Record<BgmId, number>> = {};

function load(id: string): Promise<AudioBuffer> {
  let p = buffers.get(id);
  if (!p) {
    p = fetch(`${BASE}${id}.ogg`).then((r) => {
      if (!r.ok) throw new Error(`audio ${id}: ${r.status}`);
      return r.arrayBuffer();
    }).then((a) => ctx!.decodeAudioData(a));
    // 실패하면 5초 뒤에야 다시 시도한다 (파일이 없을 때 계속 요청하지 않게)
    p.catch(() => { window.setTimeout(() => { if (buffers.get(id) === p) buffers.delete(id); }, 5000); });
    buffers.set(id, p);
  }
  return p;
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    bgmBus = ctx.createGain();
    duckBus = ctx.createGain();
    sfxBus = ctx.createGain();
    bgmBus.gain.value = bgmVol;
    sfxBus.gain.value = sfxVol;
    duckBus.connect(bgmBus).connect(ctx.destination);
    sfxBus.connect(ctx.destination);
  }
  return ctx;
}

/** 첫 사용자 입력에서 호출: 오디오를 깨우고, 대기 중이던 곡을 튼다 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  const go = () => { if (wanted) void startBgm(wanted.id, wanted.loop); };
  if (c.state === 'suspended') void c.resume().then(go).catch(() => undefined);
  else go();
}

function stopCurrent(fade = FADE) {
  if (!ctx || !current) return;
  const cur = current;
  current = null;
  const t = ctx.currentTime;
  const dur = cur.src.buffer?.duration ?? 1;
  if (cur.loop) resumeAt[cur.id] = (cur.offset + (t - cur.startedAt)) % dur;
  cur.gain.gain.cancelScheduledValues(t);
  cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
  cur.gain.gain.linearRampToValueAtTime(0, t + fade);
  try { cur.src.stop(t + fade + 0.05); } catch { /* 이미 끝남 */ }
}

async function startBgm(id: BgmId, loop: boolean) {
  const c = ensure();
  if (!c || c.state !== 'running') return;
  if (current?.id === id) return;
  let buf: AudioBuffer;
  try { buf = await load(id); } catch { return; }
  // 불러오는 사이에 다른 곡으로 바뀌었으면 그만둔다
  if (!wanted || wanted.id !== id || current?.id === id) return;
  stopCurrent();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  const gain = c.createGain();
  const t = c.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + FADE);
  src.connect(gain).connect(duckBus!);
  const offset = loop ? (resumeAt[id] ?? 0) % buf.duration : 0;
  src.start(t, offset);
  current = { id, src, gain, startedAt: t, offset, loop };
  if (!loop) src.onended = () => { if (current?.src === src) current = null; };
}

/** BGM 바꾸기. 같은 곡이면 그대로 둔다. null 이면 끈다 */
export function playBgm(id: BgmId | null, loop = true) {
  if (!id) { wanted = null; stopCurrent(); return; }
  if (wanted?.id === id && (current?.id === id || !ctx || ctx.state !== 'running')) { wanted = { id, loop }; return; }
  wanted = { id, loop };
  void startBgm(id, loop);
}

/** 곡을 처음부터 다시 듣게 한다 (새 게임 등) */
export function rewindBgm(id?: BgmId) {
  if (id) delete resumeAt[id];
  else (Object.keys(resumeAt) as BgmId[]).forEach((k) => delete resumeAt[k]);
}

async function oneShot(id: string, bus: GainNode | null, vol = 1): Promise<number> {
  const c = ensure();
  if (!c || c.state !== 'running' || !bus) return 0;
  let buf: AudioBuffer;
  try { buf = await load(id); } catch { return 0; }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(bus);
  src.start();
  return buf.duration;
}

/** 징글: 울리는 동안 BGM을 줄였다가 되돌린다 */
export async function playJingle(id: JingleId) {
  const dur = await oneShot(id, sfxBus, 1);
  if (!dur || !ctx || !duckBus) return;
  const t = ctx.currentTime;
  const end = t + Math.max(0.6, dur - 1.2); // 잔향 끝자락에서 BGM이 돌아온다
  duckUntil = Math.max(duckUntil, end);
  const g = duckBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(DUCK, t + 0.15);
  g.setValueAtTime(DUCK, duckUntil);
  g.linearRampToValueAtTime(1, duckUntil + 0.9);
}

export function playSfx(id: SfxId, vol = 1) { void oneShot(id, sfxBus, vol); }

export function setBgmVolume(v: number) {
  bgmVol = Math.max(0, Math.min(1, v));
  if (ctx && bgmBus) bgmBus.gain.setTargetAtTime(bgmVol, ctx.currentTime, 0.05);
}
export function setSfxVolume(v: number) {
  sfxVol = Math.max(0, Math.min(1, v));
  if (ctx && sfxBus) sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.05);
}

/** 탭이 가려지면 멈추고, 돌아오면 이어서 */
export function setAudioPaused(paused: boolean) {
  if (!ctx) return;
  if (paused && ctx.state === 'running') void ctx.suspend();
  else if (!paused && ctx.state === 'suspended') void ctx.resume();
}

/** 디버그: 지금 무슨 곡이 나오는지 */
export function audioState() {
  return { ctx: ctx?.state ?? 'none', wanted: wanted?.id ?? null, playing: current?.id ?? null, bgmVol, sfxVol };
}
