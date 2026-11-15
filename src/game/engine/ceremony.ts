import type { Dir } from './drawMonster';
import type { MapId } from './map';

/**
 * 점호 의식 연출 상태 (월드 캔버스가 매 프레임 읽는다)
 * - 배우 키: 'me' | NpcId | 'x:<엑스트라 id>'
 */
export type CerPose = 'stand' | 'exercise' | 'anthem' | 'salute' | 'shout';

export interface CerActor {
  map: MapId;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

export interface CerMove {
  a: CerActor;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
  endDir: Dir;
}

export interface CeremonyRt {
  kind: 'am' | 'pm';
  pose: CerPose;
  poseT0: number;
  /** 정렬한 장병 전원 머리 위 말풍선 (경례 구호, 구령 등) */
  bubble: string | null;
  /** 오와 열을 맞춘 장병 (체조·경례 등 동작을 함께 한다) */
  members: string[];
  /** 침상에 걸터앉은 배우 */
  seated: Set<string>;
  moves: CerMove[];
}

/** 점호 진행(React)에서 월드 연출을 조종하는 손잡이 */
export interface CeremonyCtl {
  pose(p: CerPose): void;
  bubble(text: string | null): void;
  move(who: string, tx: number, ty: number, dur: number, endDir: Dir): void;
  stand(who: string): void;
}

/** 점호 진행에 필요한 정보 (월드가 배치하면서 만든다) */
export interface CeremonyInfo {
  kind: 'am' | 'pm';
  /** 당직사관(아침) / 당직사령(저녁) */
  duty: 'lt' | 'sgm' | 'cpt';
  /** 인원 보고를 하는 분대장 */
  leader: 'me' | 'sgt' | 'senior';
  /** 보고 인원 (총원 = 현재원) */
  total: number;
  late: boolean;
  /** 저녁 점호에서 분대장이 서는 자리 / 당직사령·부관이 서는 자리 */
  marks: { leader: [number, number]; duty: [number, number]; aide: [number, number]; door: [number, number]; stage: [number, number] };
}
