export type BranchId = 'army' | 'navy' | 'air';
export type Archetype = 'leader' | 'diligent' | 'social';
export type NpcId = 'sgt' | 'senior' | 'buddy' | 'junior' | 'junior2' | 'lt' | 'sgm' | 'cpt';
export type SpotId =
  | 'bed' | 'barracks' | 'mess' | 'px' | 'admin' | 'command' | 'tv' | 'cyber' | 'gym'
  | 'parade' | 'train' | 'post' | 'gate';
export type GameId =
  | 'env' | 'night' | 'combat' | 'guard' | 'specialty' | 'sandbag' | 'overlock';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export type Scene =
  | 'title' | 'home' | 'intro' | 'quiz' | 'transform'
  | 'world' | 'minigame' | 'promotion' | 'dayEnd' | 'ending';

export interface Stats {
  hp: number;
  mental: number;
  discipline: number;
  skill: number;
  money: number;
}

export interface Effects {
  hp?: number;
  mental?: number;
  discipline?: number;
  skill?: number;
  money?: number;
  affinity?: Partial<Record<NpcId, number>>;
  flag?: string;
  quest?: string;
  item?: string;
}

export interface MonsterLook {
  /** 스프라이트 키 (public/sprites/manifest.json에 등록되면 이미지로 그림) */
  sprite?: string;
  body: string;
  belly: string;
  accent: string;
  shape: 'round' | 'tall' | 'wide';
  ears: 'round' | 'pointy' | 'none' | 'horns' | 'fin' | 'tuft' | 'antler' | 'feather';
  tail: 'flame' | 'fin' | 'none' | 'leaf' | 'puff' | 'spike';
  wings?: boolean;
  eyes: 'dot' | 'big' | 'sleepy' | 'sharp';
  mouth: 'smile' | 'beak' | 'cat' | 'fang';
  extra?: 'shell' | 'spots' | 'tentacles' | 'mask' | 'cheeks' | 'ember';
}

export interface Species {
  id: string;
  name: string;
  type: string;
  desc: string;
  /** 잠에서 깨어 자기 몸을 처음 깨닫는 순간의 묘사 */
  wake: string;
  /** 성격 분석 결과와의 궁합 가중치 */
  weights: Partial<Record<Archetype, number>>;
  look: MonsterLook;
}

export type LineWho = 'npc' | 'me' | 'narr' | NpcId;

export interface Line {
  who: LineWho;
  text: string;
}

export interface Choice {
  text: string;
  grade: 'good' | 'ok' | 'bad';
  effects?: Effects;
  reply: Line[];
  tip?: string;
}

export interface DialogueCtx {
  day: number;
  rankIdx: number;
  affinity: Record<NpcId, number>;
  flags: Record<string, boolean>;
  season: Season;
  branch: BranchId;
  isLastDay: boolean;
}

export interface Dialogue {
  id: string;
  npc: NpcId;
  priority?: number;
  once?: boolean;
  when?: (c: DialogueCtx) => boolean;
  lines: Line[];
  choices?: Choice[];
  effects?: Effects;
}

export interface QuestStep {
  spot?: SpotId;
  npc?: NpcId;
  text: string;
  minutes?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: NpcId;
  desc: string;
  steps: QuestStep[];
  reward: Effects;
}

export interface ActiveQuest {
  id: string;
  step: number;
}

export type EventKind = 'rollcall_am' | 'rollcall_pm' | 'work' | 'night' | 'farewell';

export interface ScheduleEvent {
  id: string;
  kind: EventKind;
  label: string;
  start: number;
  window: number;
  end: number;
  spot: SpotId | null;
  game?: GameId;
  auto?: boolean;
}

export interface MinigameRequest {
  game: GameId;
  title: string;
  eventId?: string;
  returnTo: 'world' | 'dayEnd';
}

export interface MinigameCtx {
  branch: BranchId;
  archetype: Archetype;
  speciesId: string;
  rankIdx: number;
  day: number;
  season: Season;
  /** 숙련도 (0~100) — 기술 재사용 대기시간을 줄여준다 */
  skill: number;
}

export interface MinigameProps {
  ctx: MinigameCtx;
  onFinish: (score: number, summary: string) => void;
}
