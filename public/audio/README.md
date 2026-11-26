# Poké Army — 사운드 팩 v2 (3~4세대 스타일)

GBA·DS 시절 느낌의 샘플 악기 편곡(트럼펫·호른·스트링·피아노·플루트·하프·팀파니·드럼 킷 + 홀 리버브). 멜로디는 v1과 같고, 모두 이 게임을 위해 새로 작곡한 곡이에요(원작 게임 곡을 쓰지 않았어요).
악기 음원은 GeneralUser GS 사운드폰트(음악 제작에 자유 이용 가능, 상업 포함)를 썼어요.

- `ogg/` — 게임에 넣을 파일. **BGM은 정확히 한 바퀴 길이로 잘라 두어서** `loop = true`로 틀면 끊김 없이 반복돼요.
- `preview/` — 들어보기용 mp3 (BGM은 2바퀴 + 페이드아웃). mp3는 앞뒤에 짧은 무음이 생겨서 루프용으로는 쓰지 마세요.
- 효과음과 징글은 한 번만 재생하는 파일이에요. 징글도 같은 악기로 다시 편곡했고, 메뉴·대사 같은 UI 효과음은 v1 그대로예요.

## BGM

| 파일 | 장면 | 분위기 | 템포 · 조 |
| --- | --- | --- | --- |
| bgm_01_title | 타이틀 | 트럼펫 주선율 + 호른 화음, 스트링, 하프, 팀파니. 후반에 플루트·글로켄슈필 합류 | 112 · D장조 |
| bgm_02_bedroom_night | 입대 전날 밤 내 방 (오프닝) | 피아노 + 오르골, 잔잔한 스트링, 벽시계 똑딱 | 84 · F장조 |
| bgm_03_dream_star_hill | 꿈속 문답 · 별의 언덕 (지라치) | 플루트 + 첼레스타, 하프 아르페지오, 합창·스트링 패드, 깊은 리버브 | 72 · E장조 |
| bgm_04_barracks_day | 부대 일과 (필드) | 플루트 → 트럼펫 주선율, 클라리넷 화음, 피치카토·기타 반주, 탬버린 | 120 · C장조 |
| bgm_05_rollcall_march | 아침 점호 · 진급 신고 | 트럼펫·브라스 행진곡, 튜바, 스네어 롤, 피콜로 | 126 · B♭장조 |
| bgm_06_messhall_free | 식사 · PX · 개인정비 | 클라리넷 → 비브라폰 스윙, 워킹 베이스, 피아노 컴핑, 라이드 심벌 | 104 · G장조 |
| bgm_07_training_minigame | 미니게임 · 훈련 | 트럼펫·브라스 + 스트링 스타카토, 질주하는 베이스, 팀파니 (3세대 배틀풍) | 150 · E단조 |
| bgm_08_night_duty_fog | 불침번 · 야간 위병소 · 안개 | 클라리넷·오보에 + 첼레스타, 트레몰로 스트링, 하프. 진자 같은 똑딱 소리(슬리퍼 복선) | 76 · A단조 |
| bgm_09_mystery_clues | 단서 조사 · 추리 정리 · 도서관 | 마림바 + 클라리넷 스타카토, 피치카토, 비브라폰 | 100 · D단조 |
| bgm_10_boss_slipper | B-01 꿈을 먹는 자 (보스전) | 트럼펫·트롬본 + 스트링, 하프시코드 진자 음형, 오르간, 팀파니 | 160 · C단조 |
| bgm_11_ending_same_star | 진 엔딩 「같은 날, 같은 별 아래」 | 메인 테마를 피아노로 느리게, 스트링·플루트·호른이 차례로 합류 · **반복 없음**(50초, 끝까지 재생) | 84 · D장조 |

## 징글

| 파일 | 쓰는 곳 |
| --- | --- |
| jingle_clue_found | 단서(C-xx) 발견 |
| jingle_star_fragment | 별 조각(★) 획득 |
| jingle_quest_complete | 퀘스트·심부름 완료 |
| jingle_promotion | 진급 (오버로크 성공 후) |
| jingle_heal | 의무병 체력 회복 · 군견 멘탈 회복 |
| jingle_day_end_sleep | 하루 끝, 침상에서 잠들기 |
| jingle_dream_enter | 꿈(별의 언덕)으로 넘어갈 때 |
| jingle_late_scolded | 지각 · 꾸중 |
| jingle_minigame_clear | 미니게임 A등급 · 클리어 |
| jingle_minigame_fail | 미니게임 실패 |

## 효과음

| 파일 | 쓰는 곳 |
| --- | --- |
| sfx_cursor · sfx_confirm · sfx_cancel | 메뉴 이동 · 선택 · 취소 |
| sfx_text_blip | 대사 글자가 나올 때 (2~3글자마다 한 번 추천) |
| sfx_save | 저장 |
| sfx_alert | ❗ 표시, 퀘스트 목적지 |
| sfx_bump | 벽에 부딪힘 |
| sfx_footstep | 발소리 |
| sfx_door | 문 · 계단 이동 |
| sfx_whistle | 기상 · 집합 호루라기 |
| sfx_purchase | PX/BX 구매 |
| sfx_pendulum_ticktock | 슬리퍼의 진자 소리 · 진자 자국 조사 |
| sfx_fog_whiteout | 정문 밖 안개로 나갔다가 하얘질 때 |
| sfx_star_twinkle | ✨ 표시 근처 · 별 조각 반짝임 |
| sfx_stamina_empty | 달리기 기력 바닥 |

## 웹에서 끊김 없이 루프하기

`<audio loop>`도 대체로 되지만, 가장 깔끔한 건 Web Audio예요.

```ts
const ctx = new AudioContext();
const buf = await ctx.decodeAudioData(await (await fetch('/audio/bgm_04_barracks_day.ogg')).arrayBuffer());
const src = ctx.createBufferSource();
src.buffer = buf;
src.loop = true;
src.connect(ctx.destination);
src.start();
```

Safari 일부 버전은 ogg를 못 읽을 수 있어요. 그럴 땐 `wav/`(원본)을 m4a로 변환해 함께 두면 돼요.

## v3 추가분 (코드로 합성 · `scripts/audiolab/`)

사운드폰트 없이 사인파·노이즈·필터로 합성해 Ogg(Opus)로 인코딩했다. `scripts/audiolab/index.html`을 크로미움에서 열면 다시 만들 수 있다.

- BGM: `bgm_12_unease`(쎄한 장면 · 편지 · 팬텀 · 안개) · `bgm_13_rooftop_stars`(옥상 · 동기 · 말 없는 병장) · `bgm_14_bad_ending`(배드 엔딩)
- 징글: `jingle_reveille`(기상나팔) · `jingle_lights_out`(취침나팔) · `jingle_shock`(깜짝 놀람)
- 효과음: `sfx_knock` · `sfx_pa_chime` · `sfx_radio_static` · `sfx_switch` · `sfx_water` · `sfx_paper` · `sfx_tray` · `sfx_heartbeat` · `sfx_wrong` · `sfx_item` · `sfx_phone` · `sfx_flash` · `sfx_evo_pulse` · `sfx_suspicion` · `sfx_door_wood`(합성한 나무문 · 현재 미사용)

`sfx_door_open`: 평소 문을 오갈 때 쓰는 소리. ElevenLabs로 생성한 음원을 0.85초로 다듬어 Ogg(Opus)로 변환했다. 원래의 `sfx_door`는 철문에 쓴다.

어떤 소리가 언제 나는지는 `src/game/components/BgmDirector.tsx`(상황별 곡 · 징글)와 `src/game/engine/soundCues.ts`(대사 · 알림 문구 → 효과음)에 있다.

## 진급(진화) 연출의 음원 — 직접 만든 소리가 아니다

진급 연출은 본가의 진화 장면을 그대로 흉내 내므로, 이 세 파일만은 포켓몬스터 어나더 레드(Pokémon Essentials 기반 팬 게임)의 `Audio` 폴더에 있는 진화 음원을 그대로 가져왔다. 위의 "원작 게임 곡을 쓰지 않았어요"의 예외다.

| 파일 | 원본 | 쓰는 곳 |
| --- | --- | --- |
| jingle_evo_start | `Audio/ME/Evolution start.ogg` | "……오잉!? ○○의 모습이……!" |
| jingle_evolution | `Audio/BGM/Evolution.ogg` | 하얗게 깜빡이는 동안 (섬광에서 뚝 끊긴다 · 40초 중 앞의 7초쯤만 쓴다) |
| jingle_evo_success | `Audio/ME/Evolution success.ogg` | "대신 ○○(으)로 진급했다!" |

원본 음량이 제각각이라 `engine/audio.ts`의 `MIX`에서 다른 징글과 비슷하게 맞췄다. `jingle_promotion`은 이제 쓰지 않는다.

## 쎄한 효과음과 정적

`sfx_suspicion` · `sfx_heartbeat` · `jingle_shock` · `sfx_pendulum_ticktock` · `sfx_fog_whiteout` · `sfx_radio_static`이 울리면 BGM이 뚝 끊긴다 (`engine/audio.ts`의 `EERIE`). 대사에 붙은 소리면 그 줄이 떠 있는 동안, 걸어 다니다 울린 소리면 3.6초쯤 조용하다가 천천히 돌아온다.
