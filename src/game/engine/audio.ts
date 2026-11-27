'use client';
/**
 * 사운드: BGM(끊김 없는 루프 + 크로스페이드) · 징글 · 효과음
 * - 파일은 public/audio/*.ogg (목록·사용처는 public/audio/README.md)
 * - 브라우저 정책상 첫 클릭/키 입력 뒤에 소리가 나기 시작한다
 * - 어떤 곡을 틀지는 components/BgmDirector.tsx 가 게임 상태를 보고 정한다
 * - 장면이 곡을 직접 고를 땐 setBgmMood (대화·퍼즐·연출이 떠 있는 동안만)
 * - 쎄한 효과음(EERIE)이 울리면 BGM이 뚝 끊겼다가 천천히 돌아온다 (hushBgm · holdHush)
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
  | 'jingle_reveille' | 'jingle_lights_out' | 'jingle_shock'
  | 'jingle_evo_start' | 'jingle_evolution' | 'jingle_evo_success';
export type SfxId =
  | 'sfx_cursor' | 'sfx_confirm' | 'sfx_cancel' | 'sfx_text_blip' | 'sfx_save' | 'sfx_alert' | 'sfx_bump' | 'sfx_footstep'
  | 'sfx_door' | 'sfx_door_iron' | 'sfx_whistle' | 'sfx_purchase' | 'sfx_pendulum_ticktock' | 'sfx_fog_whiteout' | 'sfx_star_twinkle' | 'sfx_stamina_empty'
  | 'sfx_knock' | 'sfx_pa_chime' | 'sfx_radio_static' | 'sfx_switch' | 'sfx_water' | 'sfx_paper' | 'sfx_tray'
  | 'sfx_heartbeat' | 'sfx_wrong' | 'sfx_item' | 'sfx_phone' | 'sfx_flash' | 'sfx_evo_pulse' | 'sfx_suspicion';
/** 대사·알림에 붙는 소리: 효과음이거나 징글 */
export type CueId = SfxId | JingleId;
/** 장면이 고르는 곡. 'none' = 음악을 멈춘다 (정적이 어울리는 순간) */
export type BgmMood = BgmId | 'none';

const BASE = '/audio/';
const FADE = 0.7; // 곡 전환 크로스페이드(초)
const DUCK = 0.22; // 징글이 울리는 동안 BGM 음량 배율
/** 디코딩해 둘 BGM 수 (한 곡에 수십 MB라 오래 안 들은 곡은 메모리에서 내린다) */
const KEEP_BGM = 4;

/**
 * 소리별 믹스: 음원 파일은 그대로 두고 재생할 때 다듬는다.
 * - db: 음량 (자주 듣는 소리일수록 작게 · 도트 RPG처럼 BGM 위에 살짝 얹히는 정도)
 * - lp: 이 주파수 위를 깎아 날카로운 소리를 둥글게 (Hz)
 * - hp: 이 주파수 아래를 깎아 파형 치우침(직류)을 없앤다 (Hz, 기본 45)
 * - gap: 같은 소리를 다시 울리기까지 최소 간격 (ms, 기본 45)
 */
interface Mix { db: number; lp?: number; hp?: number; gap?: number }
const MIX: Record<CueId, Mix> = {
  // 메뉴 · 대사
  sfx_text_blip: { db: -4, lp: 3000, hp: 120 },
  sfx_cursor: { db: -9, lp: 4000, hp: 120 },
  sfx_confirm: { db: -8, lp: 4000, hp: 120 },
  sfx_cancel: { db: -8, lp: 3000, hp: 120 },
  sfx_save: { db: -8, lp: 4000, hp: 120 },
  sfx_alert: { db: -10, lp: 3500, hp: 150 },
  sfx_wrong: { db: -8, lp: 1500, hp: 60 },
  sfx_purchase: { db: -7, lp: 4500, hp: 120 },
  sfx_item: { db: -4, lp: 6000 },
  sfx_stamina_empty: { db: -8, lp: 2500, hp: 120 },
  // 이동 · 생활
  sfx_door: { db: -11, lp: 9000, hp: 60, gap: 700 },
  sfx_door_iron: { db: -10, lp: 1000, hp: 60, gap: 700 },
  sfx_footstep: { db: -4, lp: 2500, hp: 80 },
  sfx_bump: { db: -8, lp: 1800, hp: 60, gap: 180 },
  sfx_whistle: { db: -10, lp: 3200, hp: 300, gap: 1200 },
  sfx_knock: { db: -4, lp: 2500, hp: 60 },
  sfx_switch: { db: -6, lp: 5000, hp: 120 },
  sfx_paper: { db: -2, lp: 7000, hp: 200 },
  sfx_tray: { db: -4, lp: 5000, hp: 120 },
  sfx_water: { db: -2, lp: 7000, hp: 120 },
  sfx_phone: { db: -5, lp: 3000 },
  sfx_pa_chime: { db: -5, lp: 5000 },
  sfx_radio_static: { db: -7, lp: 5000, hp: 200, gap: 600 },
  // 연출
  sfx_heartbeat: { db: -2, gap: 500 },
  sfx_suspicion: { db: -2, gap: 500 },
  sfx_pendulum_ticktock: { db: -2, lp: 6000, gap: 500 },
  sfx_star_twinkle: { db: -5, lp: 7000, hp: 200 },
  sfx_fog_whiteout: { db: -5, lp: 7000 },
  sfx_flash: { db: -6, lp: 7000, hp: 120 },
  sfx_evo_pulse: { db: -3, lp: 5000 },
  // 징글
  jingle_clue_found: { db: -4, hp: 30 },
  jingle_star_fragment: { db: -4, hp: 30 },
  jingle_quest_complete: { db: -4, hp: 30 },
  jingle_promotion: { db: -4, hp: 30 },
  jingle_heal: { db: -6, hp: 30 },
  jingle_day_end_sleep: { db: -4, hp: 30 },
  jingle_dream_enter: { db: -4, hp: 30 },
  jingle_late_scolded: { db: -4, hp: 30 },
  jingle_minigame_clear: { db: -4, hp: 30 },
  jingle_minigame_fail: { db: -4, hp: 30 },
  jingle_reveille: { db: -2, hp: 30 },
  jingle_lights_out: { db: 0, hp: 30 },
  jingle_shock: { db: -2, hp: 30 },
  // 진급(진화) 연출: 어나더 레드의 진화 음원
  // (원본 음량이 제각각이라 다른 징글과 비슷하게 맞췄다: 시작음 · 곡은 작게 녹음돼 있고 성공음은 크다)
  jingle_evo_start: { db: 3, hp: 30 },
  jingle_evolution: { db: 3, hp: 30 },
  jingle_evo_success: { db: -8, hp: 30 },
};

/** 쎄한 소리: 울리는 순간 BGM이 뚝 끊긴다 (쎄한 깨달음 · 심장 · 비명 · 진자 · 안개 · 잡음) */
const EERIE = new Set<CueId>(['sfx_suspicion', 'sfx_heartbeat', 'jingle_shock', 'sfx_pendulum_ticktock', 'sfx_fog_whiteout', 'sfx_radio_static']);
export const isEerie = (id: CueId) => EERIE.has(id);

/** 소리 이름과 파일 이름이 다른 경우: 평소 문은 실내 문 여는 소리, 원래의 묵직한 소리는 철문에 쓴다 */
const CUE_FILE: Partial<Record<CueId, string>> = { sfx_door: 'sfx_door_open', sfx_door_iron: 'sfx_door' };

/** 소리 하나의 재생 경로: 소스 → 저역 정리 → 고역 정리 → 음량. 끝의 음량 노드를 돌려준다 */
export function shotChain(c: BaseAudioContext, src: AudioNode, id: CueId, vol = 1): GainNode {
  const m = MIX[id];
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = m.hp ?? 45;
  hp.Q.value = 0.707;
  let tail: AudioNode = src.connect(hp);
  if (m.lp) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = m.lp;
    lp.Q.value = 0.707;
    tail = tail.connect(lp);
  }
  const g = c.createGain();
  g.gain.value = vol * 10 ** (m.db / 20);
  tail.connect(g);
  return g;
}

/**
 * 마스터 리미터 곡선: ±0.8까지는 그대로, 넘치는 부분만 부드럽게 눌러 1.0을 넘지 않게 한다.
 * 앞단에서 절반으로 줄여 넣으므로 입력 ±2.0까지 받는다.
 */
export function limiterCurve(size = 4097): Float32Array<ArrayBuffer> {
  const knee = 0.8;
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const r = ((i / (size - 1)) * 2 - 1) * 2;
    const a = Math.abs(r);
    const out = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
    curve[i] = Math.sign(r) * out;
  }
  return curve;
}

interface Playing { id: BgmId; src: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number; loop: boolean }

let ctx: AudioContext | null = null;
let bgmBus: GainNode | null = null; // 설정의 BGM 음량
let duckBus: GainNode | null = null; // 징글 중 줄이기
let hushBus: GainNode | null = null; // 쎄한 효과음이 울리는 동안 끊기
let sfxBus: GainNode | null = null; // 설정의 효과음 음량
let current: Playing | null = null;
let wanted: { id: BgmId; loop: boolean } | null = null;
let bgmVol = 0.6;
let sfxVol = 0.7;
let duckUntil = 0;
const buffers = new Map<string, Promise<AudioBuffer>>();
/** 곡마다 멈춘 위치 — 다시 틀 때 이어서 재생 (장소를 오갈 때 매번 처음부터 나오지 않게) */
const resumeAt: Partial<Record<BgmId, number>> = {};

/**
 * public/audio에 .m4a 사본도 올려 두었는지. 지금은 .ogg뿐이라 꺼 둔다:
 * 켜 두면 없는 .m4a를 찾는 요청이 파일마다 한 번씩 헛돈다 (OGG를 못 읽는 브라우저에서는 매번).
 */
const HAS_M4A = false;
/** 주소에 붙이는 버전 (next.config.mjs): 음원이 바뀌면 값이 달라져, 오래 캐시해 두어도 새 파일을 받는다 */
const ASSET_Q = process.env.NEXT_PUBLIC_ASSET_V ? `?v=${process.env.NEXT_PUBLIC_ASSET_V}` : '';
/** OGG를 못 읽는 브라우저는 같은 이름의 .m4a를 먼저 찾는다 (한쪽이 실패하면 다른 쪽으로) */
function audioExts(): string[] {
  if (!HAS_M4A) return ['ogg'];
  const canOgg = typeof Audio !== 'undefined' && !!new Audio().canPlayType('audio/ogg; codecs="opus"');
  return canOgg ? ['ogg', 'm4a'] : ['m4a', 'ogg'];
}
async function fetchDecoded(id: string): Promise<AudioBuffer> {
  let last: unknown = new Error(`audio ${id}: not found`);
  for (const ext of audioExts()) {
    try {
      const r = await fetch(`${BASE}${id}.${ext}${ASSET_Q}`);
      if (!r.ok) throw new Error(`audio ${id}.${ext}: ${r.status}`);
      return await ctx!.decodeAudioData(await r.arrayBuffer());
    } catch (e) { last = e; }
  }
  throw last;
}

/** 최근에 튼 BGM만 디코딩해 두고, 그 밖의 곡은 내린다 (다시 틀면 브라우저 캐시에서 금방 읽는다) */
const recentBgm: BgmId[] = [];
function rememberBgm(id: BgmId) {
  const i = recentBgm.indexOf(id);
  if (i >= 0) recentBgm.splice(i, 1);
  recentBgm.push(id);
  while (recentBgm.length > KEEP_BGM) {
    const old = recentBgm.shift()!;
    if (old !== wanted?.id && old !== current?.id) buffers.delete(old);
  }
}

function load(id: string): Promise<AudioBuffer> {
  let p = buffers.get(id);
  if (!p) {
    p = fetchDecoded(id);
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
    hushBus = ctx.createGain();
    sfxBus = ctx.createGain();
    bgmBus.gain.value = bgmVol;
    sfxBus.gain.value = sfxVol;
    // BGM과 효과음이 겹쳐도 깨지지 않게 마지막에 리미터를 지난다
    const limitIn = ctx.createGain();
    limitIn.gain.value = 0.5;
    const limiter = ctx.createWaveShaper();
    limiter.curve = limiterCurve();
    limitIn.connect(limiter).connect(ctx.destination);
    duckBus.connect(hushBus).connect(bgmBus).connect(limitIn);
    sfxBus.connect(limitIn);
  }
  return ctx;
}

/** 자주 쓰는 짧은 소리는 미리 불러 둔다 (처음 울릴 때 한 박자 늦지 않게) */
const PRELOAD: SfxId[] = ['sfx_text_blip', 'sfx_cursor', 'sfx_confirm', 'sfx_cancel', 'sfx_door', 'sfx_alert', 'sfx_bump'];
let preloaded = false;

/** 소리 없는 1샘플: iOS 사파리는 터치 안에서 소리를 하나 틀어야 오디오가 확실히 깨어난다 */
function primeSilence(c: AudioContext) {
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start();
  } catch { /* 무시 */ }
}

/**
 * 화면을 누를 때마다 호출: 오디오를 깨우고, 대기 중이던 곡을 튼다.
 * 첫 입력뿐 아니라 다른 앱에 다녀와서 멈춘 오디오도 여기서 다시 깨운다
 * (iOS 사파리는 돌아온 뒤 터치 안에서만 다시 켜 주기도 한다).
 */
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  const go = () => {
    if (!preloaded) { preloaded = true; for (const id of PRELOAD) void load(CUE_FILE[id] ?? id).catch(() => undefined); }
    if (wanted) void startBgm(wanted.id, wanted.loop);
  };
  if (c.state === 'running') { if (!preloaded) go(); return; }
  // 'suspended'만이 아니다: iOS 사파리는 다른 앱에 다녀오면 'interrupted'가 된다
  primeSilence(c);
  void c.resume().then(() => { go(); checkClock(); }).catch(() => undefined);
}

/**
 * iOS 사파리: 다른 앱에 다녀온 뒤 'running'이라고 하면서 시계가 멈춰 소리가 안 나는 오디오가 있다.
 * 돌아온 뒤 한 번, 시계가 흐르는지 보고 멈췄으면 오디오를 새로 만든다.
 */
let clockTimer = 0;
let clockChecked = false;
function checkClock() {
  const c = ctx;
  if (!c || clockTimer || clockChecked || c.state !== 'running') return;
  const t0 = c.currentTime;
  clockTimer = window.setTimeout(() => {
    clockTimer = 0;
    if (ctx !== c || c.state !== 'running' || document.hidden) return;
    clockChecked = true;
    if (c.currentTime - t0 < 0.1) rebuildAudio();
  }, 600);
}

/** 멈춘 오디오를 버리고 새로 만든다. 디코딩해 둔 곡은 그대로 쓰고, 곡은 멈춘 자리부터 잇는다 */
function rebuildAudio() {
  const old = ctx;
  if (!old) return;
  if (current) {
    const cur = current;
    current = null;
    const dur = cur.src.buffer?.duration ?? 1;
    if (cur.loop) resumeAt[cur.id] = (cur.offset + (old.currentTime - cur.startedAt)) % dur;
    try { cur.src.stop(); } catch { /* 이미 끝남 */ }
  }
  jingleNow = null;
  // 징글·정적 시각은 옛 오디오의 시계 기준이다 → 새 오디오(시계가 0부터)에선 지운다.
  // 쎄한 줄이 떠 있어 붙잡던 정적만 새 오디오에서도 이어 간다
  const held = hushEnd === Infinity;
  duckUntil = 0;
  hushFrom = hushEnd = 0;
  ctx = null;
  bgmBus = duckBus = hushBus = sfxBus = null;
  void old.close().catch(() => undefined);
  const c = ensure();
  if (!c) return;
  if (held) holdHush();
  // 터치 없이 켜지지 않으면 다음 터치(unlockAudio)가 켠다
  void c.resume().then(() => { if (wanted) void startBgm(wanted.id, wanted.loop); }).catch(() => undefined);
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
  rememberBgm(id);
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

// ───────── 쎄한 순간의 정적 ─────────
const HUSH_CUT = 0.12; // 곡이 끊기는 데 걸리는 시간(초)
const HUSH_MIN = 2.4; // 한 번 끊기면 적어도 이만큼은 조용하다
const HUSH_HOLD = 3.6; // 대사 없이 울린 쎄한 소리: 이만큼 뒤에 곡이 돌아오기 시작한다
const HUSH_BACK = 2.8; // 돌아올 땐 천천히 스며든다
let hushFrom = 0; // 지금의 정적이 시작된 시각 (ctx 시간)
let hushEnd = 0; // 곡이 돌아오기 시작하는 시각 (Infinity = 그 줄이 떠 있는 동안 붙잡는 중)
function hushUntil(until: number) {
  if (!ctx || !hushBus) return;
  const t = ctx.currentTime;
  if (t >= hushEnd) { hushFrom = t; note('(hush)'); } // 조용하지 않았다 → 여기서부터 새 정적
  hushEnd = Math.max(until, hushFrom + HUSH_MIN, t + HUSH_CUT + 0.02);
  const g = hushBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0, t + HUSH_CUT);
  if (hushEnd !== Infinity) {
    g.setValueAtTime(0, hushEnd);
    g.linearRampToValueAtTime(1, hushEnd + HUSH_BACK);
  }
}
/** BGM을 뚝 끊는다. 잠시 뒤 천천히 돌아온다 (쎄한 효과음이 울리면 저절로 불린다) */
export function hushBgm(sec = HUSH_HOLD) {
  if (!ctx || hushEnd === Infinity) return;
  hushUntil(Math.max(ctx.currentTime + sec, hushEnd));
}
/** BGM을 끊고, releaseHush 를 부를 때까지 붙잡는다 (쎄한 줄이 화면에 떠 있는 동안) */
export function holdHush() { hushUntil(Infinity); }
/** 붙잡고 있던 정적을 놓는다 → 곡이 천천히 돌아온다 */
export function releaseHush() {
  if (!ctx || hushEnd !== Infinity) return;
  hushEnd = ctx.currentTime + 1; // 아직 조용한 중이다 (정적이 시작된 시각은 그대로)
  hushUntil(ctx.currentTime);
}

/** 곧 울릴 소리를 미리 불러 둔다 (긴 음원이 제 박자에 나오게) */
export function preloadCues(ids: CueId[]) {
  if (!ensure()) return;
  for (const id of ids) void load(CUE_FILE[id] ?? id).catch(() => undefined);
}

interface Shot { id: CueId; dur: number; src: AudioBufferSourceNode; gain: GainNode }
async function oneShot(id: CueId, bus: GainNode | null, vol = 1, rate = 1): Promise<Shot | null> {
  const c = ensure();
  if (!c || c.state !== 'running' || !bus) return null;
  let buf: AudioBuffer;
  try { buf = await load(CUE_FILE[id] ?? id); } catch { return null; }
  const src = c.createBufferSource();
  src.buffer = buf;
  if (rate !== 1) src.playbackRate.value = rate;
  const g = shotChain(c, src, id, vol);
  g.connect(bus);
  const dur = buf.duration / rate;
  // 효과음은 앞뒤를 아주 짧게 다듬어 '틱' 하는 잡음을 없앤다
  if (id.startsWith('sfx_') && dur > 0.012) {
    const t = c.currentTime, v = g.gain.value;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.0015);
    g.gain.setValueAtTime(v, t + dur - 0.004);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.start(t);
  } else {
    src.start();
  }
  note(id);
  return { id, dur, src, gain: g };
}

/** 지금 울리는 징글 (새 징글이 시작되면 앞의 것은 빠르게 줄인다 → 여러 징글이 겹쳐 뭉개지지 않게) */
let jingleNow: Shot | null = null;
/** 징글: 울리는 동안 BGM을 줄였다가 되돌린다 */
export async function playJingle(id: JingleId) {
  if (EERIE.has(id)) hushBgm();
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

/** 지금 울리는 징글이 id면 부드럽게 끝내고 BGM을 되돌린다 (다음 장면이 먼저 시작될 때) */
export function fadeJingle(id: JingleId, sec = 1.2) {
  if (!ctx || !duckBus || jingleNow?.id !== id) return;
  const shot = jingleNow;
  jingleNow = null;
  const t = ctx.currentTime;
  const g = shot.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0, t + sec);
  try { shot.src.stop(t + sec + 0.02); } catch { /* 이미 끝남 */ }
  duckUntil = t;
  const d = duckBus.gain;
  d.cancelScheduledValues(t);
  d.setValueAtTime(d.value, t);
  d.linearRampToValueAtTime(1, t + sec);
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
  shotCount++;
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
  if (now - (lastSfx[id] ?? -1e9) < (MIX[id].gap ?? 45)) return;
  lastSfx[id] = now;
  shotCount++;
  if (EERIE.has(id)) hushBgm();
  void oneShot(id, sfxBus, vol, rate);
}

/** 이번 입력에서 울린 소리 수 */
let shotCount = 0;
/**
 * 버튼을 눌렀을 때의 기본 소리. 그 버튼이 자기 소리(오답 · 취소 · 징글 등)를 냈다면 양보해서
 * 두 소리가 겹쳐 뭉개지지 않게 한다.
 */
export function playClickSound() {
  const before = shotCount;
  window.setTimeout(() => { if (shotCount === before) playSfx('sfx_confirm', 0.6); }, 0);
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
  if (paused) {
    clockChecked = false;
    if (ctx.state === 'running') void ctx.suspend();
    return;
  }
  // 'suspended'만이 아니다: iOS 사파리는 다른 앱에 다녀오면 'interrupted'가 된다.
  // 여기서 안 켜지면(터치가 필요하면) 다음 터치의 unlockAudio가 다시 켠다
  if (ctx.state === 'running') checkClock();
  else if (ctx.state !== 'closed') void ctx.resume().then(checkClock).catch(() => undefined);
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
  const hush = !ctx || ctx.currentTime >= hushEnd + HUSH_BACK ? null : hushEnd === Infinity ? 'held' : ctx.currentTime < hushEnd ? 'silent' : 'returning';
  return { ctx: ctx?.state ?? 'none', wanted: wanted?.id ?? null, playing: current?.id ?? null, mood, hush, bgmGain: hushBus ? +hushBus.gain.value.toFixed(2) : 1, bgmVol, sfxVol };
}
