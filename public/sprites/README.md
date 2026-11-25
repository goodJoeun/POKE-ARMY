# 포켓몬 이미지

실제 포켓몬 이미지는 저장소에 포함하지 않습니다 (저작권: Nintendo / Creatures / GAME FREAK).
클론한 뒤 한 번 아래 명령으로 로컬에 받아 주세요.

```bash
npm run sprites
```

- 출처: [PokeAPI sprites](https://github.com/PokeAPI/sprites) (`scripts/fetch-sprites.mjs`)
- 받는 것: 포켓몬마다 `icon/`(필드용 2등신 도트 아이콘 — 게임이 이걸로 앞·옆·뒷모습과 걷기 2프레임을 자동 생성) · `front/`·`back/`(초상화·연출용 도트 배틀 스프라이트) · `art/`(공식 일러스트, 현재 미사용)
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
| 짬짬이 퍼즐 상황 | munchlax(먹고자), magmar(마그마), caterpie(캐터피), magnemite(코일), klefki(클레피), oddish(뚜벅쵸), doduo(두두), vulpix(식스테일), rapidash(날쌩마), combee(세꿀버리) |

## 필드 걷기 스프라이트 (선택)

4방향 × 걷기 4프레임 팔로워 시트(4x4 칸, 행: 앞·왼쪽·오른쪽·뒤)가 있으면 맵 위 캐릭터가 그 그림으로 걷습니다.
게임에 나오는 포켓몬의 영문 대문자 이름(예: `CHARMANDER.png`)과 같은 파일만 복사합니다.

```bash
npm run followers -- "<...\Graphics\Characters\Followers 폴더 경로>"
```

- `public/sprites/follower/`로 복사되고 `manifest.json`에 `follower` 항목이 추가됩니다 (저장소에는 올리지 않음).
- 시트가 없는 포켓몬은 `icon/`으로 자동 생성한 걷기 그림을 씁니다.

## 배포 (Vercel)

`main`에 푸시하면 Vercel이 자동으로 배포합니다. 이 폴더는 저장소에 없으므로, 빌드 직전(`prebuild`)에
`scripts/sprites-blob.mjs`가 Vercel Blob 비공개 저장소(`poke-army-sprites`)에서 그림 묶음을 받아 풉니다.

그림을 추가·교체했다면 푸시 전에 한 번 올려 주세요 (Vercel CLI 로그인 필요):

```bash
npm run sprites:upload
```
