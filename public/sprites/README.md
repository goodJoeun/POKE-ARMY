# 포켓몬 스프라이트 (선택)

이 폴더에 라이선스를 확보한 스프라이트 이미지(정면 기준, 투명 배경 PNG 권장)를 넣고
`manifest.json`에 `키: 파일명`을 등록하면, 게임 안에서 해당 포켓몬이 절차적 드로잉 대신 이미지로 그려집니다.

```json
{
  "charmander": "charmander.png",
  "squirtle": "squirtle.png"
}
```

등록하지 않은 포켓몬은 기존 캔버스 드로잉으로 표시됩니다.

## 키 목록

| 구분 | 키 |
| --- | --- |
| 육군 플레이어 | charmander(파이리), cyndaquil(브케인), torchic(아차모), chimchar(파이숭이) |
| 해군 플레이어 | squirtle(꼬부기), totodile(리아코), mudkip(물짱이), piplup(팽도리) |
| 공군 플레이어 | pidgey(구구), starly(찌르꼬), fletchling(불화살빈) |
| 육군 NPC | growlithe(가디), diglett(디그다), psyduck(고라파덕), eevee(이브이), togepi(토게피), arcanine(윈디), machamp(괴력몬), charizard(리자몽) |
| 해군 NPC | lapras(라프라스), tentacool(왕눈해), magikarp(잉어킹), marill(마릴), horsea(쏘드라), dewgong(쥬레곤), slowbro(야도란), gyarados(갸라도스) |
| 공군 NPC | swablu(파비코), delibird(딜리버드), zubat(주뱃), taillow(테일로), emolga(에몽가), swellow(스왈로), fearow(깨비드릴조), pidgeot(피죤투) |
