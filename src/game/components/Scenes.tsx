"use client";
import SceneryCanvas from "./SceneryCanvas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Archetype, BranchId, NpcId } from "../types";
import { useGame, presentNpcs, fmtDelta } from "../state/store";
import { TEXT_SPEED, useSettings } from "../state/settings";
import { hasGuardNight, hasNightDuty } from "../data/schedule";
import {
  BRANCHES,
  RANKS,
  TOTAL_DAYS,
  rankIdxForDay,
  serviceMonth,
} from "../data/branches";
import { ARCHETYPE_INFO, findSpecies } from "../data/monsters";
import { PERSONALITY_QUIZ, type QuizCast } from "../data/quiz";
import type { CapType } from "../engine/drawMonster";
import type { MonsterLook } from "../types";
import { NPC_IDS, NPC_SKINS } from "../data/npcs";
import { npcCap, npcSpeaker } from "../engine/speakers";
import MonsterCanvas from "./MonsterCanvas";
import { endingLines, promotionKeyLines } from "./storyEvents";
import { storyEnding, type StoryEnding } from "../data/story";
import { fixJosa, fmt } from "../engine/text";
/** 단어 뒤에 붙일 조사만 골라 준다: pj('리뷰어', '은(는)') → '는' */
const pj = (w: string, p: string) => fixJosa(w + p).slice(w.length);
import type { Line } from "../types";
import { RankBadge } from "./Hud";
import {
  fadeJingle,
  playJingle,
  playSfx,
  preloadCues,
  queueJingle,
  setBgmMood,
  type BgmMood,
} from "../engine/audio";
import { useLineSound } from "../engine/soundCues";

// ───────── 타이틀 ─────────
export function Title() {
  const s = useGame();
  const [name, setName] = useState("");
  const [hasSave, setHasSave] = useState(false);
  const settingsOpen = useSettings((st) => st.open);
  // 설정에서 저장 데이터를 지운 경우를 반영하기 위해 설정 창이 닫힐 때도 다시 확인
  useEffect(() => setHasSave(s.hasSave()), [s, settingsOpen]);
  return (
    <div className="scene title-scene">
      {/* 타이틀과 부제는 표지 그림(public/cover.webp)에 그려져 있다 */}
      <div className="title-form">
        <input
          placeholder="주인공 이름 (예: 레드)"
          value={name}
          maxLength={8}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") s.newGame(name);
          }}
        />
        <button className="primary big" onClick={() => s.newGame(name)}>
          새 게임
        </button>
        {hasSave && (
          <button className="big" onClick={() => s.load()}>
            이어하기
          </button>
        )}
        <button
          className="big"
          onClick={() => useSettings.getState().openMenu()}
        >
          ⚙️ 설정
        </button>
      </div>
      <div className="title-foot">
        프로토타입 v0.1 · WASD/방향키 이동 · E 상호작용 · Tab 수첩
      </div>
    </div>
  );
}

// ───────── 잠든 뒤 (방 오프닝 다음) ─────────
const INTRO_LINES = [
  "불을 끄고 침대에 누웠다.",
  "스물두 살 {me}은(는) 천장을 보며 중얼거렸다.",
  '"군대 가기 싫다… 군대 가기 싫다… 군대 가기 싫다…"',
  "그렇게 중얼거리다 스르륵 잠이 들었고…",
];

export function Intro() {
  const s = useGame();
  const [i, setI] = useState(0);
  const lines = INTRO_LINES.map((l) => fixJosa(l.replace("{me}", s.name)));
  const next = () => (i < lines.length - 1 ? setI(i + 1) : s.go("quiz"));
  useLineSound(i, lines[i], lines[i].length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "e") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="scene intro-scene" onClick={next}>
      <SceneryCanvas scene="bedtime" />
      <div className="bedtime-caption">
        <div className="intro-text">
          {lines.slice(0, i + 1).map((l, k) => (
            <p key={k} className={k === i ? "fade-in" : "dim"}>
              {l}
            </p>
          ))}
        </div>
        <div className="hud-dim">클릭 또는 Enter</div>
      </div>
    </div>
  );
}

// ───────── 꿈: 수수께끼의 목소리가 묻고 답한다 (성격 분석) ─────────
type DreamLine = { who: "voice" | "narr"; text: string };

// 목소리의 주인은 지라치: 천 년 만에 깬, 장난기 많고 아직 잠이 덜 깬 아이
const REACTIONS: Record<Archetype, string[]> = {
  leader: [
    '"오~ 앞장서는 거 좋아하는구나? 대장 타입!"',
    '"흐음~ 이끄는 쪽이네. 멋있는 척하는 거 아니지? 히히."',
    '"책임지는 거 안 무서워? …오, 진짜네!"',
  ],
  diligent: [
    '"묵묵히 해치우는 타입이구나~ 개미 같아. 칭찬이야!"',
    '"꼼꼼쟁이 발견! 너 엑셀 좋아하지? 그치?"',
    '"끝까지 버티는 거, 그거 은근 대단한 거다?"',
  ],
  social: [
    '"사람 좋아하는구나! 나도 좋아해, 사람!"',
    '"주변이 반짝반짝해지는 대답이네~"',
    '"같이면 버틸 수 있다… 응, 그 말 마음에 들어."',
  ],
};

/** 꿈이 보여 주는 장면의 포켓몬 외형: npc면 고른 군의 그 NPC(모자 포함), 아니면 NPC 외형 중 같은 스프라이트 */
function castLook(
  branch: BranchId,
  c: QuizCast,
): { look: MonsterLook; cap: CapType } | null {
  if (c.npc)
    return { look: NPC_SKINS[branch][c.npc].look, cap: npcCap(branch, c.npc) };
  for (const skins of Object.values(NPC_SKINS)) {
    for (const sk of Object.values(skins))
      if (sk.look.sprite === c.sprite) return { look: sk.look, cap: null };
  }
  const sp = c.sprite ? findSpecies(c.sprite) : undefined;
  return sp ? { look: sp.look, cap: null } : null;
}

/** 질문 창 윗변에 올라선 등장 포켓몬들 (창 높이가 바뀌면 따라 움직인다) */
function QuizCastRow({
  cast,
  branch,
  top,
}: {
  cast: QuizCast[];
  branch: BranchId;
  top: number | null;
}) {
  if (top === null) return null;
  return (
    <div className="quiz-cast" style={{ top }} aria-hidden="true">
      {cast.map((c, i) => {
        const found = castLook(branch, c);
        if (!found) return null;
        const scale = c.scale ?? 1;
        return (
          <div
            key={`${c.sprite ?? c.npc}-${i}`}
            className="quiz-actor"
            style={
              {
                "--s": scale,
                animationDelay: `${i * 0.12}s`,
              } as React.CSSProperties
            }
          >
            {c.emote && (
              <span
                className="quiz-emote"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                {c.emote}
              </span>
            )}
            <MonsterCanvas
              look={found.look}
              size={Math.round(120 * scale)}
              dir={c.dir ?? "down"}
              cap={found.cap}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Quiz() {
  const s = useGame();
  const b = BRANCHES[s.branch];
  const opening: DreamLine[] = [
    { who: "narr", text: "……" },
    { who: "narr", text: "끝없는 어둠 속에서, 희미한 빛 하나가 떠올랐다." },
    {
      who: "voice",
      text: `"히히. 또 그 소리야? '군대 가기 싫다~ 가기 싫다~' 세다가 까먹었잖아, ${s.name}."`,
    },
    {
      who: "voice",
      text: `"걱정 마! 내일 가는 데는 진짜 ${b.name} 맞아. 음… 쬐끔 다른 세계의 ${b.name}이긴 하지만? 헤헤."`,
    },
    {
      who: "voice",
      text: '"그 전에 퀴즈! 몇 개만 물어볼게. 거짓말하면 반짝반짝 다 티 난다~?"',
    },
  ];
  const closing: DreamLine[] = [
    { who: "voice", text: '"끝! 대답 잘했어. 상으로 사탕… 은 없고. 히히."' },
    {
      who: "voice",
      text: '"네 대답에 딱 맞는 모습, 내가 골라 둘게. 기대해도 좋아!"',
    },
    { who: "voice", text: '"…좋아. 너로 정했다!"' },
    {
      who: "voice",
      text: '"눈 뜨면 깜짝 놀랄걸? 하아암… 나 졸려. 잘 다녀와, 신병!"',
    },
    { who: "narr", text: "빛이 점점 커지더니… 눈앞이 새하얘졌다." },
  ];
  const [phase, setPhase] = useState<"opening" | "q" | "react" | "closing">(
    "opening",
  );
  const [idx, setIdx] = useState(0); // opening/closing 줄 번호
  const [qi, setQi] = useState(0);
  const [reaction, setReaction] = useState("");
  const [score, setScore] = useState<Record<Archetype, number>>({
    leader: 0,
    diligent: 0,
    social: 0,
  });
  const [typeMs, typeStep] = TEXT_SPEED[useSettings((st) => st.textSpeed)];
  const q = PERSONALITY_QUIZ[qi];

  const line: DreamLine =
    phase === "opening"
      ? opening[idx]
      : phase === "closing"
        ? closing[idx]
        : phase === "react"
          ? { who: "voice", text: reaction }
          : { who: "voice", text: `"${q.q}"` };

  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (typeMs === 0) {
      setTyped(line.text.length);
      return;
    }
    setTyped(0);
    const iv = setInterval(
      () => setTyped((t) => (t >= line.text.length ? t : t + typeStep)),
      typeMs,
    );
    return () => clearInterval(iv);
  }, [line.text, typeMs, typeStep]);
  const done = typed >= line.text.length;
  // 🔊 빛의 목소리는 높고 맑은 타자 소리 · 질문이 나올 땐 반짝
  useLineSound(`${phase}-${idx}-${qi}`, line.text, typed, {
    spoken: line.who !== "narr",
    voice: line.who === "voice" ? 1.5 : 1,
    cue: phase === "q" ? "sfx_star_twinkle" : undefined,
  });

  const advance = () => {
    if (!done) {
      setTyped(line.text.length);
      return;
    }
    if (phase === "opening") {
      if (idx < opening.length - 1) setIdx(idx + 1);
      else {
        setPhase("q");
        setIdx(0);
      }
    } else if (phase === "react") {
      if (qi < PERSONALITY_QUIZ.length - 1) {
        setQi(qi + 1);
        setPhase("q");
      } else {
        setPhase("closing");
        setIdx(0);
      }
    } else if (phase === "closing") {
      if (idx < closing.length - 1) setIdx(idx + 1);
      else s.finishQuiz(score);
    }
  };
  const pick = (a: Archetype) => {
    if (phase !== "q" || !done) return;
    playSfx("sfx_confirm", 0.6);
    setScore({ ...score, [a]: score[a] + 1 });
    const pool = REACTIONS[a];
    setReaction(pool[qi % pool.length]);
    setPhase("react");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "q") {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.options.length) {
          e.preventDefault();
          pick(q.options[n - 1].type);
          return;
        }
        if (!done && (e.key === "Enter" || e.key === " " || e.key === "e")) {
          e.preventDefault();
          setTyped(line.text.length);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "e") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const bright = phase === "closing" && idx === closing.length - 1;
  // 🎬 질문마다 꿈이 그 상황을 보여 준다: 장면 그림 + 질문 창 위에 올라선 포켓몬들
  const vision = phase === "q" || phase === "react" ? q.vision : null;
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxTop, setBoxTop] = useState<number | null>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !vision) return;
    const measure = () => setBoxTop(box.offsetTop);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [vision]);
  return (
    <div
      className={`scene dream-scene first-dream ${vision ? "vision" : ""} ${bright ? "whiteout" : ""}`}
      onClick={() => phase !== "q" && advance()}
    >
      {vision ? (
        <SceneryCanvas key={vision.scene} scene={vision.scene} />
      ) : (
        <SceneryCanvas scene="dreamWater" />
      )}
      {vision && <div className="quiz-vignette" aria-hidden="true" />}
      {vision && (
        <QuizCastRow
          key={qi}
          cast={vision.cast}
          branch={s.branch}
          top={boxTop}
        />
      )}
      {(phase === "q" || phase === "react") && (
        <div className="dream-progress">
          질문 {qi + 1} / {PERSONALITY_QUIZ.length}
        </div>
      )}
      <div
        className="dream-box"
        ref={boxRef}
        onClick={(e) => {
          if (phase === "q") e.stopPropagation();
        }}
      >
        {line.who === "voice" && <div className="speaker">???</div>}
        <div className={`dialogue-text ${line.who === "narr" ? "narr" : ""}`}>
          {line.text.slice(0, typed)}
          {done && phase !== "q" && <span className="next-indicator">▼</span>}
        </div>
        {phase === "q" && done && (
          <div className="choices">
            {q.options.map((o, k) => (
              <button key={k} className="choice" onClick={() => pick(o.type)}>
                <span className="choice-num">{k + 1}</span> {o.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── 잠에서 깨는 장면: 눈을 뜨면 눈앞에 포켓몬이 있다. 내 모습은 화장실 거울에서 확인한다 (→ MirrorReveal) ─────────
export function Transform() {
  const s = useGame();
  const lines = [
    "……",
    "눈꺼풀 너머로 희미한 빛이 들어온다.",
    "눈을 떴다. 낯선 천장. 꿉꿉한 모포 냄새. 여긴… 내 방이 아니다.",
    "기지개를 켜려고 팔을 쭉 뻗었는데… 이상하다. 팔이 평소만큼 뻗어지지 않는다.",
    "(…뭐지? 몸이 내 몸 같지 않아. 아직 꿈인가?)",
    "…그때, 머리맡으로 그림자가 드리운다. 누군가 나를 내려다보고 있다.",
  ];
  const [stage, setStage] = useState(0);
  const next = () =>
    stage < lines.length - 1 ? setStage(stage + 1) : s.startDay();
  // 🔊 낯선 천장 아래 정적. 그림자가 드리울 때 심장이 뛴다
  useLineSound(stage, lines[stage], lines[stage].length, {
    cue: stage === lines.length - 1 ? "sfx_heartbeat" : undefined,
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "e") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className="scene transform-scene barracks-wake"
      data-stage={stage}
      onClick={next}
    >
      <SceneryCanvas scene="wakingBarracks" />
      <div className="wake-text">
        <p key={stage} className="fade-in">
          {lines[stage]}
        </p>
        <div className="hud-dim">클릭 또는 Enter</div>
      </div>
    </div>
  );
}

// ───────── 화장실 거울: 처음으로 내 모습 전체를 본다 (부대 화면 위에 뜬다) ─────────
export function MirrorReveal({ onDone }: { onDone: () => void }) {
  const s = useGame();
  const sp = findSpecies(s.speciesId)!;
  const b = BRANCHES[s.branch];
  // 0 거울 속 그림자 → 1 모습이 드러난다 → 2 비명 → 3 결과 카드
  const lines = [
    "김 서린 거울 속에, 낯선 그림자가 서 있다.",
    "손등으로 거울을 닦았다. 내가 손을 들자, 거울 속의 그것도 손을 든다.",
    '"으아아아악?!"',
  ];
  const [stage, setStage] = useState(0);
  const last = lines.length;
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = performance.now();
  }, []);
  const next = () => {
    if (performance.now() - openedAt.current < 350) return;
    if (stage < last) setStage(stage + 1);
    else onDone();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "e" ||
        e.key === "E"
      ) {
        e.preventDefault();
        if (!e.repeat) next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // 🔊 거울: 그림자(심장 소리) → 김을 닦는다 → 비명 → "내가… 포켓몬?!"
  useEffect(() => {
    if (stage === 0) playSfx("sfx_heartbeat", 0.9);
    else if (stage === 1) playSfx("sfx_suspicion", 0.9);
    else if (stage === 2) queueJingle("jingle_shock", 7);
    else playSfx("sfx_flash", 0.7);
  }, [stage]);
  const shakeOn = useSettings((st) => st.screenShake);
  return (
    <div
      className={`scene transform-scene mirror-scene ${stage >= 1 ? "stage-2" : "stage-0"} ${stage === 2 && shakeOn ? "shake" : ""}`}
      onClick={() => stage < last && next()}
    >
      <SceneryCanvas scene="washroom" />
      <div
        className={`transform-reveal mirror-frame ${stage === 1 ? "peek" : ""}`}
      >
        {stage >= last && <div className="sparkle" />}
        <MonsterCanvas
          look={sp.look}
          size={220}
          cap={stage >= 1 ? b.cap : null}
          silhouette={stage === 0 ? "#1a1a24" : undefined}
        />
      </div>
      {stage < last && (
        <div className="wake-text">
          <p key={stage} className={`fade-in ${stage === 2 ? "scream" : ""}`}>
            {lines[stage]}
          </p>
          <div className="hud-dim">클릭 또는 Enter</div>
        </div>
      )}
      {stage >= last && (
        <div
          className="transform-info fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mirror-description">
            <h2>"내가… 포켓몬?!"</h2>
            <p>
              <b className="species-name">{sp.name}</b>{" "}
              <span className="bc-type" style={{ background: b.typeColor }}>
                {sp.type} 타입
              </span>
            </p>
            <p>{sp.desc}</p>
            <p>
              성격 분석 결과: <b>{ARCHETYPE_INFO[s.archetype].name}</b> —{" "}
              {ARCHETYPE_INFO[s.archetype].desc}
              <br />
              <span className="perk">
                ✨ {ARCHETYPE_INFO[s.archetype].perk}
              </span>
            </p>
            <p className="hud-dim">
              꿈이 아니다. 머리 위에는 {b.name} 모자까지 얹혀 있다. …분대장이
              3분 준다고 했다. 일단 생활관으로 돌아가자!
            </p>
          </div>
          <button className="primary big" onClick={onDone}>
            ▶ 생활관으로 (Enter)
          </button>
        </div>
      )}
    </div>
  );
}

// ───────── 진급 ─────────
export function Promotion() {
  const s = useGame();
  const rank = rankIdxForDay(s.day);
  const b = BRANCHES[s.branch];
  const cpt = npcSpeaker(s.branch, "cpt", s.day);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [evolved, setEvolved] = useState(false);
  const opts = useMemo(
    () =>
      [
        {
          ok: true,
          text: fixJosa(
            `"${b.salute}! 신고합니다. ${RANKS[rank - 1]} ${s.name}은(는) ${RANKS[rank]}(으)로 진급을 명받았습니다. 이에 신고합니다. ${b.salute}!"`,
          ),
        },
        { ok: false, text: `"저 ${RANKS[rank]} 됐어요! 감사합니다~"` },
        { ok: false, text: `"${b.salute}! 이제 저도 짬 좀 찼습니다!"` },
      ].sort(() => Math.random() - 0.5),
    [b.salute, rank, s.name],
  );
  const [keyLines, setKeyLines] = useState<Line[] | null>(null);
  const answer = (ok: boolean) => {
    if (answered !== null) return;
    playSfx(ok ? "sfx_confirm" : "sfx_wrong", 0.8);
    setAnswered(ok);
    const kl = ok ? promotionKeyLines() : null;
    if (kl) {
      setKeyLines(kl);
      s.storyFlag("archiveKey");
      s.toast("🔑 기록 보관실 열쇠를 받았다. 도서관 안쪽 방으로!", "good");
    }
    s.applyEffects(
      ok
        ? { discipline: 5, affinity: { cpt: 5 } }
        : { discipline: -2, affinity: { cpt: -2 } },
      "진급 신고",
    );
    s.addTip(
      '진급·전입·휴가 등은 지휘관에게 "신고"를 한다. 형식: "경례! 신고합니다. 계급 성명은 ○○부로 ○○을 명받았습니다. 이에 신고합니다. 경례!"',
    );
  };
  if (!evolved) {
    return (
      <Evolution
        name={s.name}
        look={findSpecies(s.speciesId)!.look}
        cap={b.cap}
        from={rank - 1}
        to={rank}
        onDone={() => setEvolved(true)}
      />
    );
  }
  return (
    <div className="scene promo-scene">
      <h2>🎖️ 진급 신고</h2>
      <div className="promo-evo">
        <div>
          축하합니다! {s.name}
          {pj(s.name, "은(는)")} 진화…는 안 했지만, <b>{RANKS[rank - 1]}</b>에서{" "}
          <b>{RANKS[rank]}</b>
          {pj(RANKS[rank], "(으)로")} 진급했다!
        </div>
      </div>
      <div className="promo-badge">
        <RankBadge rankIdx={rank} size={60} />
        <div>
          {RANKS[rank - 1]} → <b>{RANKS[rank]}</b>
        </div>
      </div>
      <div className="promo-cpt">
        {cpt.look && <MonsterCanvas look={cpt.look} size={110} cap={cpt.cap} />}
        <div>
          <div className="speaker">
            {cpt.name} <span className="speaker-sub">{cpt.sub}</span>
          </div>
          <div>
            {answered === null
              ? `${s.name}, 진급 축하한다. 신고해 봐라.`
              : answered
                ? "좋아. 아주 정확한 신고다. 계급에 맞는 책임감을 가져라."
                : "…신고 형식부터 다시 배우자. 그래도 축하한다."}
          </div>
          {keyLines &&
            keyLines.map((l, i) => (
              <div key={i} className={l.who === "narr" ? "hud-dim" : ""}>
                {fmt(l.text, { branch: s.branch, name: s.name, day: s.day })}
              </div>
            ))}
        </div>
      </div>
      {answered === null ? (
        <div className="quiz-options">
          {opts.map((o, i) => (
            <button key={i} className="choice" onClick={() => answer(o.ok)}>
              <span className="choice-num">{i + 1}</span> {o.text}
            </button>
          ))}
        </div>
      ) : (
        <button
          className="primary big"
          onClick={() => {
            s.go("world");
            s.save();
          }}
        >
          새 계급장을 달고 생활관으로 ▶
        </button>
      )}
    </div>
  );
}

/**
 * 진급 = 진화: 클래식 포켓몬 진화 연출… 인 줄 알았는데.
 * "……오잉!? ○○의 모습이……!" → 진화 곡과 함께 하얗게 빛나며 크기가 바뀌는 깜빡임(점점 빨라짐) → 섬광
 * → 모습은 그대로다. "축하합니다! ○○은(는) 진화……는 안 했다." → "대신 ○○(으)로 진급했다!" (계급장만 바뀐다)
 * 깜빡이는 동안 B(Esc/Backspace)를 누르면… 진급은 멈출 수 없다.
 */
const EVO_START = 1.6; // 깜빡임이 시작된다 (진화 곡)
const EVO_FLASH = 8.6; // 섬광: 곡이 뚝 끊긴다
const EVO_SAME = 9.8; // "축하합니다! ○○은(는) 진화……"
const EVO_NOPE = 11.7; // "……는 안 했다."
const EVO_RANK = 13.6; // "대신 ○○(으)로 진급했다!" 팡파르와 함께 계급장이 바뀐다
const EVO_DONE = 14.4; // 여기부터 다음 화면으로 넘길 수 있다
const EVO_END = EVO_FLASH;
const EVO_TOGGLES = (() => {
  const out: number[] = [];
  let x = EVO_START,
    p = 0.62;
  while (x < EVO_END) {
    out.push(x);
    x += p;
    p = Math.max(0.06, p * 0.89);
  }
  return out;
})();
function Evolution({
  name,
  look,
  cap,
  from,
  to,
  onDone,
}: {
  name: string;
  look: Parameters<typeof MonsterCanvas>[0]["look"];
  cap: Parameters<typeof MonsterCanvas>[0]["cap"];
  from: number;
  to: number;
  onDone: () => void;
}) {
  const [t, setT] = useState(0);
  const [cancelTry, setCancelTry] = useState(0);
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = performance.now();
    let raf = 0;
    const loop = () => {
      setT((performance.now() - t0.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const done = t >= EVO_DONE;
  // 🔊 진화 연출 (어나더 레드의 진화 음원): "오잉!?" 곡이 멎고 진화 시작음 → 깜빡이는 동안 진화 곡 → 섬광과 함께 뚝
  //    → 정적 속에 "진화……는 안 했다" → 진화 성공 팡파르와 함께 행진곡이 돌아온다
  const started = t >= EVO_START;
  const flashed = t >= EVO_FLASH;
  const nope = t >= EVO_NOPE;
  const ranked = t >= EVO_RANK;
  useEffect(() => {
    preloadCues(["jingle_evo_start", "jingle_evolution", "jingle_evo_success"]);
    setBgmMood("none");
    void playJingle("jingle_evo_start");
    return () => {
      setBgmMood(null);
      fadeJingle("jingle_evolution", 0.2);
    };
  }, []);
  useEffect(() => {
    if (started) void playJingle("jingle_evolution");
  }, [started]);
  useEffect(() => {
    if (!flashed) return;
    fadeJingle("jingle_evolution", 0.1);
    playSfx("sfx_flash", 1);
  }, [flashed]);
  useEffect(() => {
    if (nope) playSfx("sfx_cancel", 0.9);
  }, [nope]);
  useEffect(() => {
    if (!ranked) return;
    void playJingle("jingle_evo_success");
    setBgmMood(null);
  }, [ranked]);
  const advance = useCallback(() => {
    if (done) {
      onDone();
      return;
    }
    // 첫 멘트와 섬광 뒤의 멘트는 넘길 수 있다 (깜빡이는 동안은 지켜볼 수밖에 없다)
    const next =
      t < EVO_START
        ? EVO_START
        : t < EVO_SAME
          ? null
          : [EVO_NOPE, EVO_RANK, EVO_DONE].find((x) => x > t);
    if (next) t0.current -= (next - t) * 1000;
  }, [done, t, onDone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "e" ||
        e.key === "E"
      ) {
        e.preventDefault();
        advance();
      }
      if (
        (e.key === "Escape" ||
          e.key === "Backspace" ||
          e.key === "b" ||
          e.key === "B") &&
        t >= EVO_START &&
        t < EVO_FLASH
      ) {
        e.preventDefault();
        setCancelTry((c) => c + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, t]);

  const flicking = t >= EVO_START && t < EVO_END;
  const toggles = EVO_TOGGLES.filter((x) => x <= t).length;
  // 빛에 감싸이기 시작 → 깜빡임 동안은 내내 하얀 실루엣, 크기만 번갈아 바뀐다
  const white = t >= EVO_START - 0.5 && t < EVO_FLASH + 0.15;
  const scale = flicking
    ? toggles % 2
      ? 1.2
      : 0.86
    : t >= EVO_FLASH
      ? 1 + Math.max(0, 0.15 - (t - EVO_FLASH) * 0.3)
      : 1;
  const flash = t >= EVO_FLASH ? Math.max(0, 1 - (t - EVO_FLASH) / 0.9) : 0;
  const glow = flicking
    ? Math.min(1, (t - EVO_START) / (EVO_END - EVO_START))
    : ranked
      ? Math.max(0, 0.7 - (t - EVO_RANK) / 2)
      : t >= EVO_FLASH
        ? Math.max(0, 1 - (t - EVO_FLASH) / 1.2)
        : 0;
  // 본가의 진화 멘트 그대로… 인데 끝이 다르다
  const text: string[] =
    t < EVO_START
      ? [`……오잉!? ${name}의 모습이……!`]
      : t < EVO_FLASH
        ? [
            cancelTry > 0
              ? "…진급은 멈출 수 없다! (B 버튼은 군대에서 통하지 않는다)"
              : `……오잉!? ${name}의 모습이……!`,
          ]
        : t < EVO_SAME
          ? ["……!"]
          : t < EVO_NOPE
            ? [fixJosa(`축하합니다! ${name}은(는) 진화……`)]
            : t < EVO_RANK
              ? [fixJosa(`축하합니다! ${name}은(는) 진화……는 안 했다.`)]
              : [
                  fixJosa(`${name}은(는) 진화……는 안 했다.`),
                  fixJosa(
                    `대신 ${RANKS[from]}에서 ${RANKS[to]}(으)로 진급했다!`,
                  ),
                ];
  const shownRank = ranked ? to : from;
  return (
    <div className="evo-scene" onClick={advance}>
      <div className="evo-rays" style={{ opacity: glow }} />
      {flicking &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + t * 1.6;
          const r = 150 - ((t * 90 + i * 37) % 130);
          return (
            <i
              key={i}
              className="evo-spark"
              style={{
                left: `calc(50% + ${Math.cos(a) * r}px)`,
                top: `calc(42% + ${Math.sin(a) * r}px)`,
              }}
            />
          );
        })}
      <div className="evo-mon" style={{ transform: `scale(${scale})` }}>
        <MonsterCanvas
          look={look}
          size={200}
          cap={cap}
          silhouette={white ? "#ffffff" : undefined}
        />
      </div>
      <div className={`evo-rank ${ranked ? "new" : ""}`}>
        <RankBadge rankIdx={shownRank} size={44} />
        <span>{RANKS[shownRank]}</span>
      </div>
      {flash > 0 && <div className="evo-flash" style={{ opacity: flash }} />}
      <div className="evo-text">
        {text.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {(done || t < EVO_START || (t >= EVO_SAME && t < EVO_RANK)) && (
          <span className="next-indicator">▼</span>
        )}
      </div>
    </div>
  );
}

/** 📖 스토리 엔딩 대본 (한 줄씩) */
function StoryEndingView({
  end,
  unanswered,
  onDone,
}: {
  end: StoryEnding;
  unanswered: boolean;
  onDone: () => void;
}) {
  const s = useGame();
  const lines = useMemo(
    () => [
      ...(unanswered
        ? [
            {
              who: "narr" as const,
              text: "정문에서 뒤돌아보자, 구령대 위로 열이틀 동안 보았던 별이 떠 있다.",
            },
          ]
        : []),
      ...endingLines(end),
    ],
    [end, unanswered],
  );
  const [i, setI] = useState(0);
  const next = useCallback(() => {
    if (i < lines.length - 1) setI(i + 1);
    else onDone();
  }, [i, lines.length, onDone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "e" ||
        e.key === "E"
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  const l = lines[i];
  useLineSound(i, l.text, l.text.length, { cue: l.sfx });
  return (
    <div className={`story-ending end-${end}`} onClick={next}>
      <div className="story-ending-line" key={i}>
        {l.who === "me" ? <b>{s.name}　</b> : null}
        {fmt(l.text, { branch: s.branch, name: s.name, day: s.day })}
      </div>
      <div className="night-hint">
        클릭 · Enter ({i + 1}/{lines.length})
      </div>
    </div>
  );
}

// ───────── 하루 결산 ─────────
export function DayEnd() {
  const s = useGame();
  const affDiff = NPC_IDS.map(
    (id) => [id, s.affinity[id] - s.dayStart.affinity[id]] as [NpcId, number],
  ).filter(([, d]) => d !== 0);
  const sign = fmtDelta;
  const nightDuty = hasNightDuty(s.day) || hasGuardNight(s.day);
  // 수면 회복: 불침번 선 날은 덜 회복된다
  const proceed = () => {
    s.applyEffects(
      nightDuty ? { hp: 12 } : { hp: 20, mental: 3 },
      undefined,
      true,
    );
    s.nextDay();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") proceed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="scene dayend-scene">
      <div className="diary">
        <h2>📔 DAY {s.day} 복무 일기</h2>
        <div className="hud-dim">
          {BRANCHES[s.branch].name} 복무 {serviceMonth(s.day, s.branch)}개월차 ·
          전역까지 D-{TOTAL_DAYS - s.day}
        </div>
        <ul className="diary-log">
          {s.dayLog.length === 0 && <li>평범한 하루였다.</li>}
          {s.dayLog.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        {affDiff.length > 0 && (
          <div className="diary-aff">
            {affDiff.map(([id, d]) => (
              <span key={id} className={d > 0 ? "up" : "down"}>
                {NPC_SKINS[s.branch][id].name} {sign(d)}
              </span>
            ))}
          </div>
        )}
        <p className="diary-sleep">
          💤{" "}
          {hasGuardNight(s.day)
            ? "야간 위병소 근무를 마치고, 꽁꽁 언 발로 모포 속에 파고들어 잠들었다."
            : nightDuty
              ? "불침번 근무를 마치고 녹초가 되어 잠들었다."
              : s.patrol || (s.day >= 5 && s.day % 4 === 1)
                ? "야간 순찰 보고를 마치고 곯아떨어졌다."
                : "취침 나팔과 함께 스르륵 잠들었다."}
        </p>
        <button className="primary big" onClick={proceed}>
          {s.day >= TOTAL_DAYS - 1
            ? "내일은 드디어… 전역일! ▶"
            : "다음 날 ▶ (Enter)"}
        </button>
      </div>
    </div>
  );
}

// ───────── 엔딩 ─────────
export function Ending() {
  const s = useGame();
  const b = BRANCHES[s.branch];
  const sp = findSpecies(s.speciesId)!;
  const storyEnd: StoryEnding | null =
    s.clues.length === 0
      ? null
      : s.flags.end_rescue
        ? "rescue"
        : s.flags.end_true
          ? "true"
          : s.flags.end_normal
            ? "normal"
            : s.flags.end_bad
              ? "bad"
              : storyEnding(s);
  const [stage, setStage] = useState(storyEnd ? -1 : 0);
  const present = presentNpcs(Math.min(s.day, TOTAL_DAYS));
  const avgAff = Math.round(
    NPC_IDS.reduce((a, id) => a + s.affinity[id], 0) / NPC_IDS.length,
  );
  const st = s.stats;
  let title = "🎖️ 무사 전역";
  let desc = "큰 사고 없이 무사히 전역했다. 그게 가장 어려운 일이다.";
  if (st.discipline >= 75 && avgAff >= 30) {
    title = "🏅 모범 병사 전역 · 사단장 표창";
    desc = "군기와 인간관계 모두 완벽! 부대의 전설로 남았다.";
  } else if (avgAff >= 35) {
    title = "🤝 인싸 전역 · 생활관의 전설";
    desc = "모두가 아쉬워하는 전역. 위병소 앞까지 배웅 행렬이 이어졌다.";
  } else if (st.skill >= 70) {
    title = "🛠️ 주특기 장인 전역";
    desc = `${b.games.specialty.replace("주특기: ", "")}라면 누구보다 자신 있다.`;
  } else if (st.discipline < 30) {
    title = "😅 아슬아슬 전역";
    desc = "지각과 실수투성이였지만… 어쨌든 전역은 전역이다!";
  }
  const solvedPuzzles = Object.values(s.puzzles).filter((p) => p.solved).length;

  useEffect(() => {
    s.wipe();
  }, [s]);

  // 🔊 엔딩의 곡: 별빛 속 작별(별의 언덕) → 결산(메인 테마) → 훈련소의 아침
  //    진 엔딩은 「같은 날, 같은 별 아래」, 혼자 돌아온 아침엔 동기와 별을 보던 옥상의 곡. 배드 엔딩은 끝까지 「별이 진 뒤」
  const endMood: BgmMood | null =
    storyEnd === "bad"
      ? "bgm_14_bad_ending"
      : stage === -1
        ? "bgm_03_dream_star_hill"
        : stage === 0
          ? "bgm_01_title"
          : storyEnd === "normal"
            ? "bgm_13_rooftop_stars"
            : null;
  useEffect(() => {
    setBgmMood(endMood);
    return () => setBgmMood(null);
  }, [endMood]);
  // 🎺 현실의 아침: 훈련소의 기상나팔
  useEffect(() => {
    if (stage === 1 && storyEnd !== "bad") queueJingle("jingle_reveille", 6);
  }, [stage, storyEnd]);

  if (stage === -1 && storyEnd)
    return (
      <StoryEndingView
        end={storyEnd}
        unanswered={!s.flags.f01}
        onDone={() => setStage(0)}
      />
    );
  // 🌑 배드 엔딩: 부대를 떠나지 못했다 → "전역"이나 현실로 돌아오는 장면 없이, 남은 기록만 보여 주고 끝난다
  if (storyEnd === "bad") {
    return (
      <div className="scene ending-scene">
        <h2>🌑 별이 졌다</h2>
        <MonsterCanvas look={sp.look} size={160} cap={b.cap} />
        <div className="ending-title">영원한 이병</div>
        <p>
          소원은 거둬지지 않았다. 내일 아침에도 기상나팔은 울리고, 아무도
          이상하게 여기지 않는다.
        </p>
        <div className="ending-stats">
          <span>모은 별 조각 {s.stars.length}/7</span>
          <span>기억의 실마리 {s.clues.length}개</span>
          <span>푼 퍼즐 {solvedPuzzles}개</span>
        </div>
        <p className="hud-dim">
          별 조각은 창을 열고, 현실을 붙든 기억은 그 창을 넘게 해 준다.
        </p>
        <p className="hud-dim">— 별이 다시 깨어날 때까지, 천 년. —</p>
        <button className="primary big" onClick={() => s.go("title")}>
          타이틀로
        </button>
      </div>
    );
  }
  if (stage === 0) {
    return (
      <div className="scene ending-scene">
        <h2>
          {storyEnd ? "🎖️ 열이틀의 군 생활, 결산" : "🎊 전역을 명받았습니다!"}
        </h2>
        <MonsterCanvas look={sp.look} size={160} cap={b.cap} />
        <div className="ending-title">{title}</div>
        <p>{desc}</p>
        <div className="ending-stats">
          <span>평균 호감 {avgAff}</span>
          <span>푼 퍼즐 {solvedPuzzles}개</span>
          <span>군대 상식 {s.tips.length}개</span>
        </div>
        <div className="ending-crew">
          {present.map((id) => {
            const sk = NPC_SKINS[s.branch][id];
            return (
              <div key={id} className="crew">
                <MonsterCanvas
                  look={sk.look}
                  size={64}
                  cap={npcCap(s.branch, id)}
                />
                <span>{sk.name}</span>
                <span className="hud-dim">
                  {s.affinity[id] >= 30
                    ? "😭 가지 마!"
                    : s.affinity[id] >= 0
                      ? "👋 잘 가!"
                      : "😐 …"}
                </span>
              </div>
            );
          })}
        </div>
        {storyEnd ? (
          <>
            <p>
              소원이 만든 부대의 정문을 나서며, 마지막으로 경례했다.{" "}
              <b>"{b.salute}!"</b>
            </p>
            <p className="hud-dim">
              꿈속의 열이틀은 이렇게 끝났다. 그리고 현실의 아침이 온다…
            </p>
            <button className="primary big" onClick={() => setStage(1)}>
              아침으로 ☀️
            </button>
          </>
        ) : (
          <>
            <p>
              위병소를 나서며 마지막으로 경례했다. <b>"{b.salute}!"</b>
            </p>
            <p className="hud-dim">
              그날 밤, 사회에서의 첫 잠자리에 누워 눈을 감았다…
            </p>
            <button className="primary big" onClick={() => setStage(1)}>
              잠들기 💤
            </button>
          </>
        )}
      </div>
    );
  }
  // 🌠 스토리 결말을 본 뒤: 앞 장면(훈련소에서 눈을 뜸)에 이어지는 짧은 맺음. 같은 기상 장면을 되풀이하지 않는다
  if (storyEnd) {
    const lost =
      s.branch === "air"
        ? "날개도"
        : s.branch === "navy"
          ? "물갈퀴도"
          : "꼬리 불꽃도";
    return (
      <div className="scene reality-scene">
        <div className="reality-text">
          <p className="fade-in">
            모포를 걷고 손을 내려다본다. 사람의 손이다. 꼬리도, {lost} 없다.
          </p>
          <p className="fade-in d1">
            {sp.name}의 모습은 온데간데없다. 여기는 <b>훈련소</b>, 진짜 입대 첫
            아침이다.
          </p>
          {storyEnd === "true" || storyEnd === "rescue" ? (
            <>
              <p className="fade-in d2">
                옆 침상의 준서가 말없이 주먹을 내민다. 나도 주먹을 맞댄다.
              </p>
              <p className="fade-in d3">
                "야, 관등성명 대는 법은 안 까먹었지?" "…꿈에서 열두 번은 댔다."
              </p>
              <p className="fade-in d4">
                {s.name}
                {pj(s.name, "은(는)")} 피식 웃었다. 이번엔 해낼 수 있을 것 같다.
                둘이서.
              </p>
            </>
          ) : (
            <>
              <p className="fade-in d2">
                비어 있는 옆 침상을 한 번 보고, 전투화 끈을 단단히 묶는다.
              </p>
              <p className="fade-in d3">
                조교가 묻는다. "너, 어디서 군 생활 좀 해 봤냐? 관등성명이 왜
                이렇게 자연스러워?"
              </p>
              <p className="fade-in d4">
                {s.name}
                {pj(s.name, "은(는)")} 피식 웃었다. 이번엔 해낼 수 있을 것 같다.
                그리고 기다릴 것이다.
              </p>
            </>
          )}
          <h2 className="fade-in d5">— 그리고, 진짜 군 생활이 시작된다. —</h2>
          <p className="fade-in d5 hud-dim">
            THE END · 플레이해 주셔서 감사합니다
          </p>
          <button
            className="primary big fade-in d5"
            onClick={() => s.go("title")}
          >
            타이틀로
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="scene reality-scene">
      <div className="reality-text">
        <p className="fade-in">"…야, 일어나. 불침번 교대다."</p>
        <p className="fade-in d1">
          눈을 뜨자 낯선 천장. 모포 냄새. 줄지어 누운 까까머리 훈련병들.
        </p>
        <p className="fade-in d2">
          사람의 손이다. 꼬리도,{" "}
          {s.branch === "air"
            ? "날개도"
            : s.branch === "navy"
              ? "물갈퀴도"
              : "꼬리 불꽃도"}{" "}
          없다. {sp.name}의 모습은 온데간데없다.
        </p>
        <p className="fade-in d3">
          여기는… <b>훈련소 첫날 밤</b>이다.
        </p>
        <p className="fade-in d4">
          옆 침상 훈련병이 속삭였다. "너 아까 잠꼬대로 '{b.salute}!' 외치던데?
          무슨 꿈 꿨냐?"
        </p>
        <p className="fade-in d5">
          {s.name}
          {pj(s.name, "은(는)")} 피식 웃었다. 이번엔 왠지… 해낼 수 있을 것 같다.
        </p>
        <h2 className="fade-in d6">— 그리고, 진짜 군 생활이 시작된다. —</h2>
        <p className="fade-in d6 hud-dim">
          THE END · 플레이해 주셔서 감사합니다
        </p>
        <button
          className="primary big fade-in d6"
          onClick={() => s.go("title")}
        >
          타이틀로
        </button>
      </div>
    </div>
  );
}

export { npcSpeaker };
