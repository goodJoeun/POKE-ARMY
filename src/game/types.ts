export type BranchId = 'army' | 'navy' | 'air';
export type Archetype = 'leader' | 'diligent' | 'social';
export type NpcId = 'sgt' | 'senior' | 'buddy' | 'junior' | 'junior2' | 'lt' | 'sgm' | 'cpt';
export type SpotId =
  | 'bed' | 'barracks' | 'mess' | 'px' | 'admin' | 'command' | 'tv' | 'cyber' | 'gym'
  | 'parade' | 'train' | 'post' | 'gate'
  // 막사 시설
  | 'maint' | 'library' | 'wc1' | 'wc2' | 'laundry1' | 'laundry2' | 'water1' | 'water2' | 'board1' | 'board2'
  // 식당 조리실 · 야외 구역
  | 'kitchen' | 'court' | 'recycle' | 'ammo'
  // 분리수거장 구석의 이끼 낀 돌탑 (화강돌)
  | 'cairn';
export type GameId =
  | 'env' | 'night' | 'combat' | 'guard' | 'specialty' | 'sandbag';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export type Scene =
  | 'title' | 'home' | 'intro' | 'quiz' | 'transform'
  | 'world' | 'promotion' | 'dayEnd' | 'ending';

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
  /** 🌟 인간의 기억 (메인 스토리) */
  memory?: number;
  /** 🍬 별사탕 (퍼즐 힌트) */
  candy?: number;
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
  /** 완료한 퀘스트 id (연계 퀘스트 조건) */
  done: string[];
  /** 현재 게임 시각(분) */
  minute: number;
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
  /** 의뢰인과 함께 다니는 퀘스트: 진행 중엔 의뢰인이 내 뒤를 따라온다 */
  together?: boolean;
  desc: string;
  steps: QuestStep[];
  reward: Effects;
  /** 받을 수 있는 조건 안내 (퀘스트 창 "받을 수 있는 퀘스트"에서 잠겨 있을 때 표시) */
  hint?: string;
}

export interface ActiveQuest {
  id: string;
  step: number;
}

export type EventKind = 'rollcall_am' | 'rollcall_pm' | 'work' | 'night' | 'farewell' | 'patrol';

export interface ScheduleEvent {
  id: string;
  kind: EventKind;
  label: string;
  /** 일정 시각: 장소에 도착하면 이 시각으로 넘어가 시작한다 */
  start: number;
  end: number;
  spot: SpotId | null;
  game?: GameId;
  auto?: boolean;
}

