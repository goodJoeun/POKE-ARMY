# 포켓몬 이미지

실제 포켓몬 이미지는 저장소에 포함하지 않습니다 (저작권: Nintendo / Creatures / GAME FREAK).
클론한 뒤 한 번 아래 명령으로 로컬에 받아 주세요.

```bash
npm run sprites
```

- 출처: [PokeAPI sprites](https://github.com/PokeAPI/sprites) (`scripts/fetch-sprites.mjs`)
- 받는 것: 포켓몬마다 `front/`(맵 정면 도트) · `back/`(위로 걸을 때 뒷모습) · `art/`(대화 초상화·연출용 공식 일러스트)
- `manifest.json`이 자동 생성되며, 없으면 게임은 캔버스로 그린 근사치 외형으로 동작합니다.
- 라이선스 계약으로 공식 에셋을 받으면 같은 폴더 구조로 교체하고 `manifest.json`만 맞추면 됩니다.

```json
{
  "charmander": { "front": "front/charmander.png", "back": "back/charmander.png", "art": "art/charmander.png" }
}
```

## 키 목록

| 구분 | 키 |
| --- | --- |
| 육군 플레이어 | charmander(파이리), cyndaquil(브케인), torchic(아차모), chimchar(파이숭이) |
| 해군 플레이어 | squirtle(꼬부기), totodile(리아코), mudkip(물짱이), piplup(팽도리) |
| 공군 플레이어 | pidgey(구구), starly(찌르꼬), fletchling(불화살빈) |
| 육군 NPC | growlithe(가디), diglett(디그다), psyduck(고라파덕), eevee(이브이), togepi(토게피), arcanine(윈디), machamp(괴력몬), charizard(리자몽) |
| 해군 NPC | lapras(라프라스), tentacool(왕눈해), magikarp(잉어킹), marill(마릴), horsea(쏘드라), dewgong(쥬레곤), slowbro(야도란), gyarados(갸라도스) |
| 공군 NPC | swablu(파비코), delibird(딜리버드), zubat(주뱃), taillow(테일로), emolga(에몽가), swellow(스왈로), fearow(깨비드릴조), pidgeot(피죤투) |
| 경계근무 | rattata(꼬렛), wingull(갈모매), meowth(나옹) — 야생 / ekans(아보), koffing(또가스) — 수상한 접근자 |
