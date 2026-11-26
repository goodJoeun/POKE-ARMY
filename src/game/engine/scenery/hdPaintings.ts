import { bedtimeHd } from './bedtimeHd';
import { roofHd } from './roofHd';
import { dreamWaterHd } from './dreamWaterHd';
import { paradeHd } from './paradeHd';
import { libraryHd } from './libraryHd';
import { patrolBoardHd } from './patrolBoardHd';
import { watchDeskHd } from './watchDeskHd';
import { washroomHd } from './washroomHd';
import { fogGateHd } from './fogGateHd';
import { emptyDutyHallHd, pendulumHallHd } from './hallsHd';
import { quizTripHd } from './quizTripHd';
import { quizProjectHd } from './quizProjectHd';
import { quizPartyHd } from './quizPartyHd';
import { quizCounterHd } from './quizCounterHd';
import { quizWeekendHd } from './quizWeekendHd';
import { quizGateHd } from './quizGateHd';
import { dreamHillHd } from './hillHd';
import { wakingBarracksHd } from './barracksHd';
import { lightsOutHd } from './lightsOutHd';
import { paperYardHd, unsentLettersHd } from './paperYardHd';
import { archiveHd } from './archiveHd';
import { mailboxHd, datedMailboxHd } from './mailboxHd';
import { radioHd } from './radioHd';

/**
 * 고해상도로 다시 그린 장면 그림 (예전 그림의 두 배 해상도 · 캔버스 크기는 hd.ts 의 hdSize).
 * 키는 SceneryCanvas 의 장면 이름과 같다. 예전 저해상도 그림은 비교용으로 남아 있다 (개발 모드의 __scenery).
 */
export const hdPaintings = {
  bedtime: bedtimeHd, roof: roofHd,
  dreamWater: dreamWaterHd, parade: paradeHd, library: libraryHd, patrolBoard: patrolBoardHd, watchDesk: watchDeskHd, washroom: washroomHd,
  fogGate: fogGateHd, emptyDutyHall: emptyDutyHallHd, pendulumHall: pendulumHallHd,
  quizTrip: quizTripHd, quizProject: quizProjectHd, quizParty: quizPartyHd, quizCounter: quizCounterHd, quizWeekend: quizWeekendHd, quizGate: quizGateHd,
  hill: dreamHillHd, wakingBarracks: wakingBarracksHd, lightsOut: lightsOutHd, paperYard: paperYardHd, unsentLetters: unsentLettersHd,
  archive: archiveHd, mailbox: mailboxHd, datedMailbox: datedMailboxHd, radio: radioHd,
};
