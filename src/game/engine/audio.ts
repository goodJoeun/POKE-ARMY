'use client';
/**
 * 사운드: BGM(끊김 없는 루프 + 크로스페이드) · 징글 · 효과음
 * - 파일은 public/audio/*.ogg (목록·사용처는 public/audio/README.md)
 * - 브라우저 정책상 첫 클릭/키 입력 뒤에 소리가 나기 시작한다
 * - 어떤 곡을 틀지는 components/BgmDirector.tsx 가 게임 상태를 보고 정한다
 * - 장면이 곡을 직접 고를 땐 setBgmMood (대화·퍼즐·연출이 떠 있는 동안만)
 * - 대사 한 줄 · 알림 한 줄에 어울리는 소리는 engine/soundCues.ts 가 고른다
 */
export type BgmId =
  | 'bgm_01_title' | 'bgm_02_bedroom_night' | 'bgm_03_dream_star_hill' | 'bgm_04_barracks_day'
  | 'bgm_05_rollcall_march' | 'bgm_06_messhall_free' | 'bgm_07_training_minigame' | 'bgm_08_night_duty_fog'
  | 'bgm_09_mystery_clues' | 'bgm_10_boss_slipper' | 'bgm_11_ending_same_star'
  | 'bgm_12_unease' | 'bgm_13_rooftop_stars' | 'bgm_14_bad_ending';
export type JingleId =
  | 'jingle_clue_found' | 'jingle_star_fragment' | 'jingle_quest_complete' | 'jingle_promotion' | 'jingle_heal'
  | 'jingle_day_end_sleep' | 'jingle_dream_enter' | 'jingle_late_scolded' | 'jingle_minigame_clear' | 'jingle_minigame_fail'
  | 'jingle_reveille' | 'jingle_lights_out' | 'jingle_shock';
export type SfxId =
  | 'sfx_cursor' | 'sfx_confirm' | 'sfx_cancel' | 'sfx_text_blip' | 'sfx_save' | 'sfx_alert' | 'sfx_bump' | 'sfx_footstep'
  | 'sfx_door' | 'sfx_whistle' | 'sfx_purchase' | 'sfx_pendulum_ticktock' | 'sfx_fog_whiteout' | 'sfx_star_twinkle' | 'sfx_stamina_empty'
  | 'sfx_knock' | 'sfx_pa_chime' | 'sfx_radio_static' | 'sfx_switch' | 'sfx_water' | 'sfx_paper' | 'sfx_tray'
  | 'sfx_heartbeat' | 'sfx_wrong' | 'sfx_item' | 'sfx_phone' | 'sfx_flash' | 'sfx_evo_pulse' | 'sfx_suspicion';
/** 대사·알림에 붙는 소리: 효과음이거나 징글 */
export type CueId = SfxId | JingleId;
/** 장면이 고르는 곡. 'none' = 음악을 멈춘다 (정적이 어울리는 순간) */
export type BgmMood = BgmId | 'none';

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

/** 자주 쓰는 짧은 소리는 미리 불러 둔다 (처음 울릴 때 한 박자 늦지 않게) */
const PRELOAD: SfxId[] = ['sfx_text_blip', 'sfx_cursor', 'sfx_confirm', 'sfx_cancel', 'sfx_door', 'sfx_alert', 'sfx_bump'];
let preloaded = false;

/** 첫 사용자 입력에서 호출: 오디오를 깨우고, 대기 중이던 곡을 튼다 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  const go = () => {
    if (!preloaded) { preloaded = true; for (const id of PRELOAD) void load(id).catch(() => undefined); }
    if (wanted) void startBgm(wanted.id, wanted.loop);
  };
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
  note(id);
  if (!loop) src.onended = () => { if (current?.src === src) current = null; };
}

/** BGM 바꾸기. 같은 곡이면 그대로 둔다. null 이면 끈다 */
export function playBgm(id: BgmId | null, loop = true) {
  if (!id) {
    if (wanted || current) { wanted = null; stopCurrent(1.1); }
    return;
  }
  if (wanted?.id === id && (current?.id === id || !ctx || ctx.state !== 'running')) { wanted = { id, loop }; return; }
  // 한 번만 재생하는 곡(엔딩)이 끝까지 다 나왔으면 다시 틀지 않는다
  if (wanted?.id === id && !loop && !current) return;
  wanted = { id, loop };
  void startBgm(id, loop);
}

/** 곡을 처음부터 다시 듣게 한다 (새 게임 등) */
export function rewindBgm(id?: BgmId) {
  if (id) delete resumeAt[id];
  else (Object.keys(resumeAt) as BgmId[]).forEach((k) => delete resumeAt[k]);
}

// ───────── 장면이 고르는 곡 ─────────
let mood: BgmMood | null = null;
let moodClearAt = 0;
/**
 * 지금 떠 있는 장면(대화 · 퍼즐 · 연출)에 어울리는 곡을 정한다. null 이면 평소 곡으로 돌아간다.
 * 장면이 잠깐 닫혔다 곧바로 이어질 때 곡이 들썩이지 않게, 돌아가는 건 한 박자 늦춘다.
 */
export function setBgmMood(m: BgmMood | null) {
  if (m) { mood = m; moodClearAt = 0; }
  else if (mood && !moodClearAt) moodClearAt = performance.now() + 450;
}
export function bgmMood(): BgmMood | null {
  if (mood && moodClearAt && performance.now() >= moodClearAt) { mood = null; moodClearAt = 0; }
  return mood;
}

interface Shot { dur: number; src: AudioBufferSourceNode; gain: GainNode }
async function oneShot(id: string, bus: GainNode | null, vol = 1, rate = 1): Promise<Shot | null> {
  const c = ensure();
  if (!c || c.state !== 'running' || !bus) return null;
  let buf: AudioBuffer;
  try { buf = await load(id); } catch { return null; }
  const src = c.createBufferSource();
  src.buffer = buf;
  if (rate !== 1) src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(bus);
  src.start();
  note(id);
  return { dur: buf.duration / rate, src, gain: g };
}

/** 지금 울리는 징글 (새 징글이 시작되면 앞의 것은 빠르게 줄인다 → 여러 징글이 겹쳐 뭉개지지 않게) */
let jingleNow: Shot | null = null;
/** 징글: 울리는 동안 BGM을 줄였다가 되돌린다 */
export async function playJingle(id: JingleId) {
  const shot = await oneShot(id, sfxBus, 1);
  if (!shot || !ctx || !duckBus) return;
  const prev = jingleNow;
  jingleNow = shot;
  shot.src.onended = () => { if (jingleNow === shot) jingleNow = null; };
  if (prev) {
    const t0 = ctx.currentTime;
    prev.gain.gain.setValueAtTime(prev.gain.gain.value, t0);
    prev.gain.gain.linearRampToValueAtTime(0, t0 + 0.18);
    try { prev.src.stop(t0 + 0.2); } catch { /* 이미 끝남 */ }
  }
  const dur = shot.dur;
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

/**
 * 징글 예약: 한꺼번에 겹치면(꿈에서 단서 + 별 조각 등) 가장 중요한 것 하나만 울린다.
 * 앞의 징글이 아직 울리는 중이면, 그보다 덜 중요한 것은 건너뛴다.
 */
let pending: { id: JingleId; prio: number } | null = null;
let pendingTimer = 0;
let ringing = { until: 0, prio: 0 };
export function queueJingle(id: JingleId, prio = 5) {
  if (typeof window === 'undefined') return;
  if (!pending || prio > pending.prio) pending = { id, prio };
  if (pendingTimer) return;
  pendingTimer = window.setTimeout(() => {
    pendingTimer = 0;
    const p = pending;
    pending = null;
    if (!p) return;
    const now = performance.now();
    if (now < ringing.until && p.prio <= ringing.prio) return;
    ringing = { until: now + 2500, prio: p.prio };
    void playJingle(p.id);
  }, 80);
}

/** 같은 효과음이 한 프레임에 여러 번 겹쳐 울리지 않게 */
const lastSfx: Partial<Record<SfxId, number>> = {};
/** 효과음. rate로 높낮이(재생 속도)를 바꿀 수 있다 */
export function playSfx(id: SfxId, vol = 1, rate = 1) {
  if (typeof performance === 'undefined') return;
  const now = performance.now();
  if (now - (lastSfx[id] ?? -1e9) < 45) return;
  lastSfx[id] = now;
  void oneShot(id, sfxBus, vol, rate);
}

/** 효과음이든 징글이든 이름으로 울린다 (대사·알림에 붙는 소리) */
export function playCue(id: CueId, vol = 1) {
  if (id.startsWith('jingle_')) queueJingle(id as JingleId, 3);
  else playSfx(id as SfxId, vol);
}

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

/** 디버그: 최근에 울린 소리 (개발 모드에서 __audio.log()) */
const played: { t: number; id: string }[] = [];
function note(id: string) {
  if (process.env.NODE_ENV !== 'development' || id === 'sfx_text_blip') return;
  played.push({ t: Math.round(performance.now()), id });
  if (played.length > 2000) played.splice(0, played.length - 2000);
}
export function audioLog() { return played; }

/** 디버그: 지금 무슨 곡이 나오는지 */
export function audioState() {
  return { ctx: ctx?.state ?? 'none', wanted: wanted?.id ?? null, playing: current?.id ?? null, mood, bgmVol, sfxVol };
}
