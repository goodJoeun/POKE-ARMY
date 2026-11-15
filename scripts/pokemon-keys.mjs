// 게임에 등장하는 포켓몬 목록 (게임 키 → 전국도감 번호)
// npm run sprites (PokeAPI 다운로드) 와 npm run followers (걷기 시트 복사) 가 함께 쓴다.
// 팔로워 파일 이름은 키를 대문자로 바꾼 것 (예: snorlax → SNORLAX.png)
export const DEX = {
  // 플레이어
  charmander: 4, cyndaquil: 155, torchic: 255, chimchar: 390,
  squirtle: 7, totodile: 158, mudkip: 258, piplup: 393,
  pidgey: 16, starly: 396, fletchling: 661,
  // 육군 NPC
  growlithe: 58, diglett: 50, psyduck: 54, eevee: 133, togepi: 175, arcanine: 59, machamp: 68, charizard: 6,
  // 해군 NPC
  lapras: 131, tentacool: 72, magikarp: 129, marill: 183, horsea: 116, dewgong: 87, slowbro: 80, gyarados: 130,
  // 공군 NPC
  swablu: 333, delibird: 225, zubat: 41, taillow: 276, emolga: 587, swellow: 277, fearow: 22, pidgeot: 18,
  // 경계근무 야생 포켓몬 / 수상한 접근자
  rattata: 19, wingull: 278, meowth: 52, ekans: 23, koffing: 109,
  // 부대 엑스트라 (취사병·PX병·의무병·당직부사관·위병·행정병·다른 분대·군견 등)
  snorlax: 143, pachirisu: 417, chansey: 113, lucario: 448, machop: 66, ponyta: 77, tyrogue: 236,
  porygon: 137, geodude: 74, cubone: 104, smeargle: 235, rockruff: 744,
  kingler: 99, minun: 312, blissey: 242, kingdra: 230, starmie: 121, buizel: 418, carvanha: 318, corsola: 222,
  staraptor: 398, skarmory: 227, doduo: 84, spearow: 21, togetic: 176,
  // 병영식당 배식병 · 1분대 선임 · 2생활관 사람들
  greedent: 820,
  hitmonchan: 107, hitmonlee: 106, houndour: 228, sandshrew: 27,
  seel: 86, krabby: 98, shellder: 90, wooper: 194,
  hoothoot: 163, murkrow: 198, natu: 177, farfetchd: 83,
  // 공군 주인공 추가 · 공군 2분대 상병
  rowlet: 722, noctowl: 164,
  // 메인 스토리: 지라치 · 네이티오(도서관 관리병) · 안농 · 슬리퍼
  jirachi: 385, xatu: 178, unown: 201, hypno: 97,
};
