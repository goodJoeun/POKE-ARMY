/**
 * Poké Army 사운드 팩 v3 추가분 — 코드로 합성한 음원 (샘플·사운드폰트 없이 사인파·노이즈·필터만으로 만든다).
 * 브라우저(scripts/audiolab/index.html)와 Node(scripts/audiolab/check.mjs) 양쪽에서 쓴다.
 *
 *   const { TRACKS, render } = AudioLab;
 *   const { L, R, loop } = render('bgm_12_unease');   // Float32Array × 2, 48kHz
 *
 * 곡은 모두 이 게임을 위해 새로 쓴 것이다. (나팔 소리도 실제 군 나팔 신호의 선율이 아니다)
 */
(function (root) {
  const SR = 48000;
  const TAU = Math.PI * 2;

  // ───────── 기본 도구 ─────────
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** 'A4' → 69 */
  function n(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) throw new Error('bad note ' + s);
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  function biquad(type, f0, Q) {
    const w = (TAU * f0) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    let b0, b1, b2;
    const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => {
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    };
  }

  /** 한 곡(또는 효과음)의 작업대: 마른 소리(dry)와 잔향으로 보낼 소리(wet)를 따로 모은다. wrap = 끝에서 넘친 소리를 앞으로 접는다(루프) */
  class Track {
    constructor(sec, wrap) {
      this.len = Math.round(sec * SR);
      this.wrap = !!wrap;
      this.dL = new Float32Array(this.len); this.dR = new Float32Array(this.len);
      this.wL = new Float32Array(this.len); this.wR = new Float32Array(this.len);
    }
    /** fn(t) 로 만든 소리를 t0초부터 dur초 동안 얹는다. pan −1(왼쪽)~1(오른쪽), send = 잔향으로 보내는 양 */
    voice(t0, dur, pan, gain, send, fn) {
      const i0 = Math.round(t0 * SR), cnt = Math.round(dur * SR);
      const a = ((pan + 1) * Math.PI) / 4, gl = Math.cos(a) * gain * 1.4142, gr = Math.sin(a) * gain * 1.4142;
      const len = this.len;
      for (let k = 0; k < cnt; k++) {
        let i = i0 + k;
        if (i >= len) { if (!this.wrap) break; i %= len; }
        else if (i < 0) { if (!this.wrap) continue; i = ((i % len) + len) % len; }
        const v = fn(k / SR);
        const l = v * gl, r = v * gr;
        this.dL[i] += l; this.dR[i] += r;
        if (send) { this.wL[i] += l * send; this.wR[i] += r * send; }
      }
    }
  }

  /** Freeverb 방식 잔향. passes = 2 면 한 바퀴 돌려 꼬리를 앞머리에 이어 붙인다(루프) */
  function reverb(inL, inR, room, damp, passes) {
    const len = inL.length;
    const outL = new Float32Array(len), outR = new Float32Array(len);
    const k = SR / 44100;
    const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AP = [556, 441, 341, 225];
    const fb = room * 0.28 + 0.7, dp = damp * 0.4;
    const mk = (spread) => ({
      combs: COMB.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0, lp: 0 })),
      aps: AP.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0 })),
    });
    const chL = mk(0), chR = mk(23);
    const run = (ch, x) => {
      let out = 0;
      for (const c of ch.combs) {
        const y = c.buf[c.i];
        c.lp = y * (1 - dp) + c.lp * dp;
        c.buf[c.i] = x + c.lp * fb;
        if (++c.i >= c.buf.length) c.i = 0;
        out += y;
      }
      for (const a of ch.aps) {
        const b = a.buf[a.i];
        const y = -out + b;
        a.buf[a.i] = out + b * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        out = y;
      }
      return out;
    };
    for (let p = 0; p < passes; p++) {
      const keep = p === passes - 1;
      for (let i = 0; i < len; i++) {
        const x = (inL[i] + inR[i]) * 0.015;
        const l = run(chL, x), r = run(chR, x);
        if (keep) { outL[i] = l; outR[i] = r; }
      }
    }
    return { L: outL, R: outR };
  }

  function stats(L, R) {
    let peak = 0, sq = 0;
    for (let i = 0; i < L.length; i++) {
      const a = Math.abs(L[i]), b = Math.abs(R[i]);
      if (a > peak) peak = a;
      if (b > peak) peak = b;
      sq += L[i] * L[i] + R[i] * R[i];
    }
    return { peak, rmsDb: 10 * Math.log10(sq / (2 * L.length) + 1e-20) };
  }

  /**
   * 마무리: 잔향을 섞고, 음량을 맞추고, 봉우리를 부드럽게 누른다.
   * o.rmsDb = 목표 평균 음량(곡·징글) / o.peak = 목표 최대값(효과음) / o.fade = 끝을 줄이는 길이(초, 루프가 아닐 때)
   */
  function master(T, o) {
    const len = T.len;
    const L = new Float32Array(len), R = new Float32Array(len);
    const rv = o.wet ? reverb(T.wL, T.wR, o.room == null ? 0.7 : o.room, o.damp == null ? 0.45 : o.damp, T.wrap ? 2 : 1) : null;
    for (let i = 0; i < len; i++) {
      L[i] = T.dL[i] + (rv ? rv.L[i] * o.wet : 0);
      R[i] = T.dR[i] + (rv ? rv.R[i] * o.wet : 0);
    }
    // 직류 성분 제거
    let mL = 0, mR = 0;
    for (let i = 0; i < len; i++) { mL += L[i]; mR += R[i]; }
    mL /= len; mR /= len;
    for (let i = 0; i < len; i++) { L[i] -= mL; R[i] -= mR; }
    if (!T.wrap) {
      const f = Math.round((o.fade == null ? 0.02 : o.fade) * SR);
      for (let i = 0; i < f && i < len; i++) { const g = i / f; L[len - 1 - i] *= g; R[len - 1 - i] *= g; }
      const fi = Math.min(48, len);
      for (let i = 0; i < fi; i++) { const g = i / fi; L[i] *= g; R[i] *= g; }
    }
    const s0 = stats(L, R);
    let gain = o.peak != null ? o.peak / (s0.peak || 1) : Math.pow(10, (o.rmsDb - s0.rmsDb) / 20);
    // 봉우리 누르기: 0.7 위로는 완만하게, 0.97을 넘지 않는다
    const KNEE = 0.7, CEIL = 0.97;
    const lim = (x) => {
      const a = Math.abs(x);
      if (a <= KNEE) return x;
      const y = KNEE + (CEIL - KNEE) * Math.tanh((a - KNEE) / (CEIL - KNEE));
      return x < 0 ? -y : y;
    };
    for (let i = 0; i < len; i++) { L[i] = lim(L[i] * gain); R[i] = lim(R[i] * gain); }
    return { L, R, loop: T.wrap };
  }

  // ───────── 악기 ─────────
  /** 오르골: 맑은 기음 + 금속성 배음이 금방 사라진다 */
  function musicBox(T, t0, m, vel, pan, send) {
    const f = hz(m);
    T.voice(t0, 3.2, pan || 0, (vel || 1) * 0.5, send == null ? 0.35 : send, (t) => {
      const att = t < 0.002 ? t / 0.002 : 1;
      return att * (Math.sin(TAU * f * t) * Math.exp(-t / 0.85)
        + 0.32 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.4)
        + 0.07 * Math.sin(TAU * 3.01 * f * t) * Math.exp(-t / 0.25)
        + 0.18 * Math.sin(TAU * 5.43 * f * t) * Math.exp(-t / 0.09));
    });
  }
  /** 일렉트릭 피아노(FM): 부드러운 종소리 같은 건반 */
  function ePiano(T, t0, m, dur, vel, pan, send) {
    const f = hz(m), rel = 0.4;
    T.voice(t0, dur + rel, pan || 0, (vel || 1) * 0.42, send == null ? 0.3 : send, (t) => {
      const env = (t < 0.006 ? t / 0.006 : 1) * Math.exp(-t / 1.9) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
      const idx = 1.5 * Math.exp(-t / 0.35) + 0.22;
      const w = TAU * f * t;
      return env * (Math.sin(w + idx * Math.sin(w)) + 0.1 * Math.exp(-t / 0.05) * Math.sin(13 * w));
    });
  }
  /** 현악 패드: 살짝 어긋난 세 겹의 소리가 천천히 부풀었다 가라앉는다 */
  function pad(T, t0, m, dur, vel, pan, send, bright) {
    const f = hz(m), att = 0.9, rel = 1.5, br = bright == null ? 1 : bright;
    const det = [-0.0045, 0, 0.005], ph = [0.3, 1.1, 2.2];
    T.voice(t0, dur + rel, pan || 0, (vel || 1) * 0.16, send == null ? 0.5 : send, (t) => {
      let env = t < att ? 0.5 - 0.5 * Math.cos((Math.PI * t) / att) : 1;
      if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - dur) / rel));
      let s = 0;
      for (let d = 0; d < 3; d++) {
        const w = TAU * f * (1 + det[d]) * t + ph[d];
        s += Math.sin(w) + br * (0.5 * Math.sin(2 * w) + 0.28 * Math.sin(3 * w) + 0.15 * Math.sin(4 * w) + 0.08 * Math.sin(5 * w));
      }
      return (env * s * (1 + 0.06 * Math.sin(TAU * 0.31 * t + m))) / 3;
    });
  }
  /** 플루트: 숨소리가 섞인 둥근 소리, 길게 끌면 떨린다 */
  function flute(T, t0, m, dur, vel, pan, send) {
    const f = hz(m), att = 0.07, rel = 0.18;
    const rnd = rng(m * 977 + Math.round(t0 * 1000));
    let ph = 0, lp = 0;
    T.voice(t0, dur + rel, pan || 0, (vel || 1) * 0.34, send == null ? 0.4 : send, (t) => {
      const env = (t < att ? t / att : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
      const vib = 0.004 * Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * Math.sin(TAU * 5.2 * t);
      ph += (TAU * f * (1 + vib)) / SR;
      lp += 0.25 * (rnd() * 2 - 1 - lp);
      return env * (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph) + lp * 0.12);
    });
  }
  /** 나팔: 세게 불수록 밝아지는 금관 소리 */
  function brass(T, t0, m, dur, vel, pan, send, mute) {
    const f = hz(m), att = 0.045, rel = 0.1, soft = mute || 1;
    let ph = 0;
    T.voice(t0, dur + rel, pan || 0, (vel || 1) * 0.3, send == null ? 0.35 : send, (t) => {
      let env = t < att ? t / att : 1 - 0.18 * Math.min(1, (t - att) / 0.25);
      if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel);
      const scoop = t < 0.05 ? -0.012 * (1 - t / 0.05) : 0;
      const vib = 0.003 * Math.min(1, Math.max(0, (t - 0.35) / 0.3)) * Math.sin(TAU * 5.5 * t);
      ph += (TAU * f * (1 + scoop + vib)) / SR;
      const br = (0.3 + 0.7 * env) / soft;
      let s = 0, bk = 1;
      for (let k = 1; k <= 12; k++) {
        if (k * f > 15000) break;
        s += (Math.sin(k * ph) * bk) / Math.pow(k, 1.1);
        bk *= Math.min(0.97, br * 0.9);
      }
      return env * s * 0.7;
    });
  }
  /** 베이스: 둥글고 낮은 받침 */
  function bass(T, t0, m, dur, vel, send) {
    const f = hz(m);
    T.voice(t0, dur + 0.2, 0, (vel || 1) * 0.5, send == null ? 0.08 : send, (t) => {
      const env = (t < 0.012 ? t / 0.012 : 1) * Math.exp(-t / 2.4) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.2) : 1);
      const w = TAU * f * t;
      return env * (Math.sin(w) + 0.25 * Math.sin(2 * w) + 0.08 * Math.sin(3 * w));
    });
  }
  /** 종 · 글로켄슈필 */
  function bell(T, t0, m, vel, pan, send, decay) {
    const f = hz(m), d = decay || 1.6;
    T.voice(t0, d * 3.2, pan || 0, (vel || 1) * 0.4, send == null ? 0.5 : send, (t) => {
      const att = t < 0.002 ? t / 0.002 : 1;
      return att * (Math.sin(TAU * f * t) * Math.exp(-t / d)
        + 0.4 * Math.sin(TAU * 2.76 * f * t) * Math.exp(-t / (d * 0.35))
        + 0.15 * Math.sin(TAU * 4 * f * t) * Math.exp(-t / (d * 0.5))
        + 0.22 * Math.sin(TAU * 5.4 * f * t) * Math.exp(-t / (d * 0.12)));
    });
  }
  /** 걸러 낸 노이즈를 얹는다. env(t) = 크기, flt = 필터 함수 */
  function noise(T, t0, dur, pan, gain, send, seed, flt, env) {
    const r = rng(seed);
    T.voice(t0, dur, pan, gain, send, (t) => flt(r() * 2 - 1) * env(t));
  }

  // ───────── 곡 ─────────
  const TRACKS = {};

  /** bgm_12_unease — 쎄한 기운: 어긋난 오르골 자장가, 낮은 지속음, 유리 같은 불협 (72BPM · A단조 · 8마디) */
  TRACKS.bgm_12_unease = { kind: 'bgm', bitrate: 112000, make() {
    const beat = Math.round((SR * 60) / 72) / SR, bar = beat * 4;
    const T = new Track(bar * 8, true);
    const chords = [
      ['A2', 'E3', 'A3', 'C4'], ['G#2', 'E3', 'B3', 'D4'], ['A2', 'E3', 'A3', 'C4'], ['A2', 'D#3', 'A3', 'C4'],
      ['F2', 'C3', 'A3', 'C4'], ['E2', 'B2', 'G#3', 'B3'], ['A2', 'E3', 'A3', 'C4'], ['E2', 'B2', 'A3', 'B3'],
    ];
    chords.forEach((ch, b) => {
      ch.forEach((nm, i) => pad(T, b * bar, n(nm), bar * 0.96, i === 0 ? 0.9 : 0.6, [-0.5, 0.4, -0.2, 0.5][i], 0.6, 0.45));
      bass(T, b * bar, n(ch[0]) - 12, bar * 0.9, 0.5, 0.15);
    });
    // 오르골 선율 (한 박에 한 음, 쉬는 박은 null)
    const mel = [
      ['A4', 'E5', 'C5', null], ['B4', null, 'G#4', null], ['A4', 'E5', 'C5', null], ['D#5', null, null, null],
      ['F4', 'C5', 'A4', null], ['E4', null, 'G#4', null], ['A4', 'E5', 'C5', 'E5'], ['B4', null, null, null],
    ];
    mel.forEach((row, b) => row.forEach((nm, q) => {
      if (!nm) return;
      const t = b * bar + q * beat;
      musicBox(T, t, n(nm), 0.95, q % 2 ? 0.25 : -0.2, 0.5);
      // 한 박 반 뒤, 한 옥타브 위에서 희미하게 되돌아오는 메아리
      musicBox(T, t + beat * 1.5, n(nm) + 12, 0.2, q % 2 ? -0.6 : 0.6, 0.8);
    }));
    // 유리 같은 불협: 반음으로 맞닿은 높은 종
    [[3, 2], [7, 2]].forEach(([b, q]) => {
      bell(T, b * bar + q * beat, n('B6'), 0.1, -0.7, 0.9, 2.2);
      bell(T, b * bar + q * beat + 0.05, n('C7'), 0.09, 0.7, 0.9, 2.2);
    });
    return master(T, { rmsDb: -17.5, wet: 1.0, room: 0.86, damp: 0.4 });
  } };

  /** bgm_13_rooftop_stars — 옥상의 별: 따뜻한 건반 아르페지오 위에 플루트 선율 (84BPM · D장조 · 16마디) */
  TRACKS.bgm_13_rooftop_stars = { kind: 'bgm', bitrate: 112000, make() {
    const beat = Math.round((SR * 60) / 84) / SR, bar = beat * 4;
    const T = new Track(bar * 16, true);
    // [베이스, 화음 음들]
    const C = {
      D: ['D2', ['D3', 'A3', 'D4', 'F#4']], 'A/C#': ['C#2', ['C#3', 'A3', 'C#4', 'E4']], Bm: ['B1', ['B2', 'F#3', 'B3', 'D4']],
      G: ['G1', ['G2', 'D3', 'G3', 'B3']], 'D/F#': ['F#1', ['F#2', 'D3', 'A3', 'D4']], Em7: ['E2', ['E3', 'B3', 'D4', 'G4']],
      A: ['A1', ['A2', 'E3', 'A3', 'C#4']], 'F#m': ['F#1', ['F#2', 'C#3', 'F#3', 'A3']], Asus: ['A1', ['A2', 'E3', 'G3', 'D4']],
    };
    const prog = ['D', 'A/C#', 'Bm', 'G', 'D/F#', 'G', 'Em7', 'A', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'Asus'];
    prog.forEach((name, b) => {
      const [bs, tones] = C[name];
      const t0 = b * bar;
      bass(T, t0, n(bs) + 12, beat * 1.9, 0.62);
      bass(T, t0 + beat * 2, n(bs) + 12, beat * 1.8, 0.45);
      tones.forEach((nm, i) => pad(T, t0, n(nm) + 12, bar * 0.97, 0.42, [-0.6, 0.5, -0.3, 0.6][i], 0.55, 0.5));
      // 여덟 개의 8분음표: 아래에서 위로 올랐다 내려온다
      const ar = [0, 1, 2, 3, 2, 3, 1, 2];
      ar.forEach((k, e) => ePiano(T, t0 + e * beat * 0.5, n(tones[k]) + 12, beat * 0.9, e === 0 ? 0.7 : 0.48 + (e % 2 ? 0 : 0.06), e % 2 ? 0.3 : -0.3, 0.35));
    });
    // 선율: [음, 박 수]
    const melody = [
      [['F#5', 2], ['A5', 1], ['F#5', 1]], [['E5', 3], ['C#5', 1]], [['D5', 2], ['F#5', 1], ['D5', 1]], [['B4', 4]],
      [['A4', 2], ['D5', 1], ['F#5', 1]], [['G5', 2], ['F#5', 1], ['E5', 1]], [['E5', 2], ['G5', 1], ['E5', 1]], [['C#5', 2], ['E5', 2]],
      [['B5', 2], ['A5', 1], ['G5', 1]], [['A5', 2], ['G5', 1], ['E5', 1]], [['F#5', 2], ['A5', 2]], [['F#5', 3], ['D5', 1]],
      [['B4', 1], ['D5', 1], ['G5', 2]], [['E5', 1], ['F#5', 1], ['E5', 2]], [['D5', 4]], [[null, 1], ['A4', 1], ['C#5', 1], ['E5', 1]],
    ];
    melody.forEach((row, b) => {
      let q = 0;
      row.forEach(([nm, len]) => {
        if (nm) {
          flute(T, b * bar + q * beat, n(nm), len * beat * 0.94, 0.85, 0.08, 0.5);
          // 뒤쪽 여덟 마디는 한 옥타브 위에서 종이 선율을 따라 반짝인다
          if (b >= 8) bell(T, b * bar + q * beat, n(nm) + 12, 0.16, -0.35, 0.7, 1.1);
        }
        q += len;
      });
    });
    // 별이 반짝이는 높은 종 (엇박)
    [[1, 3.5, 'A6'], [3, 2.5, 'D7'], [5, 3.5, 'B6'], [7, 1.5, 'E7'], [11, 3.5, 'F#6'], [15, 0.5, 'A6']].forEach(([b, q, nm], i) =>
      bell(T, b * bar + q * beat, n(nm), 0.12, i % 2 ? 0.7 : -0.7, 0.9, 1.4));
    return master(T, { rmsDb: -15.5, wet: 0.8, room: 0.78, damp: 0.5 });
  } };

  /** bgm_14_bad_ending — 별이 진 뒤: 느린 오르골, 멀리서 들리는 단조의 나팔, 바람 (60BPM · D단조 · 8마디) */
  TRACKS.bgm_14_bad_ending = { kind: 'bgm', bitrate: 112000, make() {
    const beat = 1, bar = 4;
    const T = new Track(bar * 8, true);
    const chords = [
      ['D2', 'A2', 'D3', 'F3'], ['C2', 'A2', 'D3', 'F3'], ['A#1', 'F2', 'D3', 'F3'], ['A1', 'E2', 'C#3', 'E3'],
      ['G1', 'D2', 'A#2', 'D3'], ['A1', 'E2', 'C#3', 'G3'], ['D2', 'A2', 'D3', 'F3'], ['D2', 'A2', 'D3', 'A3'],
    ];
    chords.forEach((ch, b) => {
      ch.forEach((nm, i) => pad(T, b * bar, n(nm) + 12, bar * 0.97, i === 0 ? 0.8 : 0.55, [-0.5, 0.5, -0.25, 0.3][i], 0.6, 0.4));
      bass(T, b * bar, n(ch[0]), bar * 0.9, 0.5, 0.2);
    });
    const mel = [
      [['A5', 2], ['F5', 2]], [['E5', 2], ['D5', 2]], [['D5', 2], ['A#4', 2]], [['A4', 4]],
      [['G4', 1], ['A#4', 1], ['D5', 2]], [['C#5', 2], ['E5', 2]], [['D5', 2], ['A4', 2]], [['D4', 4]],
    ];
    mel.forEach((row, b) => {
      let q = 0;
      row.forEach(([nm, len]) => {
        musicBox(T, b * bar + q * beat, n(nm), 0.9, q % 2 ? 0.2 : -0.15, 0.6);
        q += len;
      });
    });
    // 낮은 종: 넉 마디마다 한 번
    [0, 4].forEach((b) => bell(T, b * bar, n('D3'), 0.5, 0, 0.8, 3.2));
    // 멀리서 들리는 나팔: 기상나팔의 첫머리를 느리게, 단조로 (4·8마디)
    const call = [['A4', 0, 0.45], ['A4', 0.5, 0.45], ['D5', 1, 1.4], ['D5', 2.5, 0.45], ['F5', 3, 0.9]];
    [3, 7].forEach((b) => call.forEach(([nm, q, len]) => brass(T, b * bar + q * beat, n(nm), len * beat, 0.16, 0.5, 2.6, 2.2)));
    // 바람: 루프가 이어지도록 주기를 곡 길이에 맞춘다
    const total = bar * 8;
    const f1 = biquad('bp', 520, 0.9), f2 = biquad('lp', 1400, 0.7);
    const r = rng(77);
    for (let i = 0; i < T.len; i++) f2(f1(r() * 2 - 1)); // 필터 예열
    T.voice(0, total, 0, 0.11, 0.5, (t) => f2(f1(r() * 2 - 1)) * (0.55 + 0.35 * Math.sin((TAU * 2 * t) / total) + 0.1 * Math.sin((TAU * 5 * t) / total + 1)));
    return master(T, { rmsDb: -18, wet: 1.1, room: 0.9, damp: 0.35 });
  } };

  // ───────── 징글 ─────────
  /** jingle_reveille — 기상나팔: 밝고 빠른 나팔 신호 (B♭ · 160BPM) */
  TRACKS.jingle_reveille = { kind: 'jingle', bitrate: 96000, make() {
    const beat = 60 / 160;
    const T = new Track(beat * 15 + 1.6, false);
    const seq = [
      ['F4', 0.5], ['F4', 0.5], ['A#4', 1], ['A#4', 0.5], ['A#4', 0.5], ['D5', 1],
      ['F5', 1], ['D5', 0.5], ['A#4', 0.5], ['D5', 1], ['F4', 1],
      ['A#4', 0.5], ['D5', 0.5], ['F5', 1], ['D5', 0.5], ['F5', 0.5], ['D5', 0.5], ['A#4', 0.5],
      ['A#4', 3],
    ];
    let q = 0;
    seq.forEach(([nm, len]) => {
      const d = len * beat * (len >= 1 ? 0.86 : 0.78);
      brass(T, 0.03 + q * beat, n(nm), d, 1, -0.05, 0.3);
      brass(T, 0.036 + q * beat, n(nm) + 0.06, d, 0.5, 0.3, 0.4); // 살짝 어긋난 두 번째 나팔
      q += len;
    });
    return master(T, { rmsDb: -16, wet: 0.75, room: 0.7, damp: 0.4, fade: 0.5 });
  } };

  /** jingle_lights_out — 취침나팔: 느리게 내려앉는 나팔 (B♭ · 92BPM) */
  TRACKS.jingle_lights_out = { kind: 'jingle', bitrate: 96000, make() {
    const beat = 60 / 92;
    const T = new Track(beat * 12 + 2.4, false);
    const seq = [['F5', 2], ['D5', 1], ['A#4', 2], ['D5', 1], ['A#4', 1], ['F4', 2], ['A#4', 3]];
    let q = 0;
    seq.forEach(([nm, len]) => {
      brass(T, 0.05 + q * beat, n(nm), len * beat * 0.95, 0.8, 0, 0.6, 1.5);
      q += len;
    });
    // 마지막 음 아래에 조용한 받침
    pad(T, 0.05 + 9 * beat, n('A#3'), beat * 3, 0.5, -0.3, 0.6, 0.4);
    pad(T, 0.05 + 9 * beat, n('F3'), beat * 3, 0.5, 0.3, 0.6, 0.4);
    return master(T, { rmsDb: -17, wet: 1.0, room: 0.85, damp: 0.45, fade: 1.2 });
  } };

  /** jingle_shock — 깜짝 놀람: 쿵 하는 저음 + 삼온음 화음 + 떨어지는 소리 */
  TRACKS.jingle_shock = { kind: 'jingle', bitrate: 96000, make() {
    const T = new Track(2.2, false);
    // 쿵
    let ph = 0;
    T.voice(0, 0.7, 0, 0.9, 0.2, (t) => { ph += (TAU * (38 + 60 * Math.exp(-t / 0.05))) / SR; return Math.sin(ph) * Math.exp(-t / 0.16) * (t < 0.003 ? t / 0.003 : 1); });
    noise(T, 0, 0.12, 0, 0.5, 0.3, 5, biquad('lp', 900, 0.7), (t) => Math.exp(-t / 0.025));
    // 삼온음으로 쌓은 화음 (떨면서 사라진다)
    [['E3', -0.4], ['A#3', 0.3], ['E4', -0.2], ['A#4', 0.4], ['D#5', 0]].forEach(([nm, pan], i) => {
      const f = hz(n(nm));
      T.voice(0.01, 1.5, pan, 0.2, 0.7, (t) => {
        const env = (t < 0.008 ? t / 0.008 : 1) * Math.exp(-t / 0.42) * (1 + 0.35 * Math.sin(TAU * 11 * t + i));
        const w = TAU * f * t;
        return env * (Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.33 * Math.sin(3 * w) + 0.2 * Math.sin(4 * w) + 0.12 * Math.sin(5 * w));
      });
    });
    bell(T, 0.01, n('A6'), 0.22, 0.5, 0.8, 0.5);
    // 떨어지는 소리
    let p2 = 0;
    T.voice(0.06, 0.5, -0.2, 0.2, 0.6, (t) => { p2 += (TAU * (1500 * Math.exp(-t / 0.16) + 220)) / SR; return Math.sin(p2) * Math.exp(-t / 0.18); });
    return master(T, { rmsDb: -16, wet: 0.9, room: 0.75, damp: 0.5, fade: 0.5 });
  } };

  // ───────── 효과음 ─────────
  /** sfx_knock — 똑똑 */
  TRACKS.sfx_knock = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.55, false);
    [0, 0.19].forEach((t0, i) => {
      const g = i ? 0.85 : 1;
      T.voice(t0, 0.2, 0, g, 0.3, (t) => (t < 0.001 ? t / 0.001 : 1) * (Math.sin(TAU * 185 * t) * Math.exp(-t / 0.028) + 0.5 * Math.sin(TAU * 430 * t) * Math.exp(-t / 0.014)));
      noise(T, t0, 0.06, 0, g * 0.7, 0.3, 11 + i, biquad('bp', 1300, 1.6), (t) => Math.exp(-t / 0.009));
    });
    return master(T, { peak: 0.75, wet: 0.5, room: 0.3, damp: 0.6, fade: 0.08 });
  } };

  /** sfx_pa_chime — 방송 차임: 딩 · 동 · 댕 · 동 */
  TRACKS.sfx_pa_chime = { kind: 'sfx', bitrate: 80000, make() {
    const T = new Track(2.3, false);
    ['C5', 'E5', 'G5', 'C6'].forEach((nm, i) => bell(T, 0.01 + i * 0.27, n(nm), 0.9, (i - 1.5) * 0.2, 0.4, 0.75));
    return master(T, { peak: 0.72, wet: 0.7, room: 0.6, damp: 0.5, fade: 0.6 });
  } };

  /** sfx_radio_static — 라디오 · TV 잡음: 지지직 + 주파수를 더듬는 휘파람 소리 */
  TRACKS.sfx_radio_static = { kind: 'sfx', bitrate: 80000, make() {
    const T = new Track(1.3, false);
    const r = rng(31);
    let gate = 1, hold = 0;
    const bp = biquad('bp', 2600, 0.6), hp = biquad('hp', 500, 0.7);
    T.voice(0, 1.3, 0, 0.6, 0, (t) => {
      if (--hold <= 0) { hold = 200 + Math.floor(r() * 2400); gate = r() < 0.25 ? 0.15 : 0.6 + r() * 0.4; }
      const env = Math.min(1, t / 0.02) * Math.min(1, (1.3 - t) / 0.25);
      return hp(bp(r() * 2 - 1)) * gate * env * 2.2;
    });
    let ph = 0;
    T.voice(0.05, 1.1, 0.2, 0.09, 0, (t) => {
      const f = 900 + 1500 * Math.sin(Math.min(1, t / 0.5) * Math.PI * 0.5) - 700 * Math.max(0, t - 0.5);
      ph += (TAU * f) / SR;
      return Math.sin(ph) * Math.min(1, t / 0.05) * Math.min(1, (1.1 - t) / 0.2) * (0.6 + 0.4 * Math.sin(TAU * 37 * t));
    });
    return master(T, { peak: 0.6, fade: 0.2 });
  } };

  /** sfx_switch — 딸깍 (스위치 · 손전등) */
  TRACKS.sfx_switch = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.14, false);
    [[0, 2400, 1], [0.05, 1700, 0.7]].forEach(([t0, f, g], i) => {
      noise(T, t0, 0.02, 0, g, 0, 41 + i, biquad('hp', 2500, 0.7), (t) => Math.exp(-t / 0.0025));
      T.voice(t0, 0.05, 0, g * 0.6, 0, (t) => Math.sin(TAU * f * t) * Math.exp(-t / 0.007));
    });
    return master(T, { peak: 0.7, fade: 0.03 });
  } };

  /** sfx_water — 수도꼭지 · 세수: 쏴아 하는 물소리 + 방울 */
  TRACKS.sfx_water = { kind: 'sfx', bitrate: 80000, make() {
    const T = new Track(1.1, false);
    const r = rng(53);
    const bp = biquad('bp', 1900, 0.5), hp = biquad('hp', 700, 0.7);
    let lfo = 0;
    T.voice(0, 1.1, 0, 0.6, 0.2, (t) => {
      lfo += 0.004 * (r() * 2 - 1 - lfo);
      const env = Math.min(1, t / 0.04) * Math.exp(-Math.max(0, t - 0.25) / 0.3);
      return hp(bp(r() * 2 - 1)) * env * (0.7 + 14 * lfo) * 1.8;
    });
    // 물방울: 짧게 솟구치는 소리
    [[0.06, 520], [0.19, 760], [0.31, 610], [0.47, 880], [0.66, 700]].forEach(([t0, f], i) => {
      let ph = 0;
      T.voice(t0, 0.07, i % 2 ? 0.4 : -0.4, 0.3, 0.3, (t) => { ph += (TAU * f * (1 + t * 9)) / SR; return Math.sin(ph) * Math.exp(-t / 0.018); });
    });
    return master(T, { peak: 0.6, wet: 0.5, room: 0.35, damp: 0.3, fade: 0.2 });
  } };

  /** sfx_paper — 종이 넘기는 소리 */
  TRACKS.sfx_paper = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.42, false);
    const r = rng(67);
    const hp = biquad('hp', 2800, 0.7), bp = biquad('bp', 5200, 0.8);
    T.voice(0, 0.42, 0, 0.8, 0, (t) => {
      const sweep = Math.exp(-Math.pow((t - 0.11) / 0.07, 2)) + 0.65 * Math.exp(-Math.pow((t - 0.27) / 0.05, 2));
      const grit = 0.6 + 0.4 * (r() < 0.3 ? 1 : 0);
      return (hp(r() * 2 - 1) * 0.6 + bp(r() * 2 - 1)) * sweep * grit;
    });
    return master(T, { peak: 0.5, fade: 0.06 });
  } };

  /** sfx_tray — 식판 · 수저: 달그락 */
  TRACKS.sfx_tray = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.6, false);
    [[0, 1], [0.11, 0.55]].forEach(([t0, g], h) => {
      [[1180, 0.2], [1870, 0.14], [2630, 0.1], [3540, 0.07], [4410, 0.05], [6200, 0.03]].forEach(([f, d], i) =>
        T.voice(t0, 0.45, h ? 0.3 : -0.2, (g * 0.5) / (1 + i * 0.35), 0.3, (t) => Math.sin(TAU * f * (h ? 1.07 : 1) * t) * Math.exp(-t / d) * (t < 0.001 ? t / 0.001 : 1)));
      noise(T, t0, 0.03, 0, g * 0.5, 0.2, 71 + h, biquad('hp', 3000, 0.7), (t) => Math.exp(-t / 0.004));
    });
    return master(T, { peak: 0.65, wet: 0.5, room: 0.4, damp: 0.3, fade: 0.1 });
  } };

  /** sfx_heartbeat — 두근 */
  TRACKS.sfx_heartbeat = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.9, false);
    [[0, 62, 1], [0.27, 52, 0.7]].forEach(([t0, f, g]) => {
      let ph = 0;
      T.voice(t0, 0.4, 0, g, 0.1, (t) => {
        ph += (TAU * f * (1 + 0.6 * Math.exp(-t / 0.02))) / SR;
        return (Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * Math.exp(-t / 0.075) * (t < 0.004 ? t / 0.004 : 1);
      });
    });
    return master(T, { peak: 0.8, fade: 0.2 });
  } };

  /** sfx_wrong — 틀렸을 때: 낮게 두 번 */
  TRACKS.sfx_wrong = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.36, false);
    [[0, 155, 0.13], [0.16, 124, 0.18]].forEach(([t0, f, d]) => {
      const lp = biquad('lp', 1500, 0.8);
      T.voice(t0, d, 0, 1, 0, (t) => {
        const env = Math.min(1, t / 0.004) * Math.min(1, (d - t) / 0.03);
        const w = TAU * f * t;
        return lp(Math.sin(w) + Math.sin(3 * w) / 3 + Math.sin(5 * w) / 5 + Math.sin(7 * w) / 7 + Math.sin(9 * w) / 9) * env;
      });
    });
    return master(T, { peak: 0.6, fade: 0.03 });
  } };

  /** sfx_item — 물건을 손에 넣었다: 짧게 올라가는 네 음 */
  TRACKS.sfx_item = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.9, false);
    ['E5', 'G#5', 'B5', 'E6'].forEach((nm, i) => bell(T, 0.005 + i * 0.065, n(nm), i === 3 ? 1 : 0.75, (i - 1.5) * 0.25, 0.3, i === 3 ? 0.35 : 0.14));
    return master(T, { peak: 0.72, wet: 0.5, room: 0.5, damp: 0.5, fade: 0.25 });
  } };

  /** sfx_phone — 휴대폰 진동: 드르륵, 드르륵 */
  TRACKS.sfx_phone = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.78, false);
    [0, 0.42].forEach((t0, i) => {
      const lp = biquad('lp', 900, 0.8);
      T.voice(t0, 0.3, 0, 1, 0, (t) => {
        const env = Math.min(1, t / 0.015) * Math.min(1, (0.3 - t) / 0.04);
        const rattle = Math.sin(TAU * 31 * t) > 0 ? 1 : 0.35;
        const w = TAU * 168 * t;
        return lp(Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.35 * Math.sin(3 * w) + 0.25 * Math.sin(5 * w)) * env * rattle;
      });
      noise(T, t0, 0.3, 0, 0.12, 0, 83 + i, biquad('bp', 2200, 1.2), (t) => (Math.sin(TAU * 31 * t) > 0 ? 1 : 0.2) * Math.min(1, (0.3 - t) / 0.04));
    });
    return master(T, { peak: 0.6, fade: 0.05 });
  } };

  /** sfx_flash — 섬광: 하얗게 번쩍이며 퍼지는 빛 */
  TRACKS.sfx_flash = { kind: 'sfx', bitrate: 80000, make() {
    const T = new Track(1.4, false);
    noise(T, 0, 0.5, 0, 0.5, 0.6, 91, biquad('hp', 3500, 0.7), (t) => Math.min(1, t / 0.004) * Math.exp(-t / 0.09));
    ['C6', 'E6', 'G6', 'C7', 'E7'].forEach((nm, i) => bell(T, 0.004 + i * 0.022, n(nm), 0.5, (i - 2) * 0.3, 0.8, 0.3));
    let ph = 0;
    T.voice(0, 0.35, 0, 0.25, 0.6, (t) => { ph += (TAU * (700 + 5200 * Math.min(1, t / 0.22))) / SR; return Math.sin(ph) * Math.min(1, t / 0.02) * Math.exp(-t / 0.12); });
    return master(T, { peak: 0.7, wet: 0.9, room: 0.7, damp: 0.25, fade: 0.5 });
  } };

  /** sfx_evo_pulse — 진화 연출의 깜빡임 한 번 (재생 속도를 올려 가며 쓴다) */
  TRACKS.sfx_evo_pulse = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.26, false);
    [[784, 1], [1176, 0.6], [1568, 0.3]].forEach(([f, g]) => {
      let ph = 0;
      T.voice(0, 0.24, 0, g, 0.3, (t) => { ph += (TAU * f * (1 + 0.25 * Math.min(1, t / 0.12))) / SR; return Math.sin(ph) * Math.min(1, t / 0.006) * Math.exp(-t / 0.055); });
    });
    return master(T, { peak: 0.6, wet: 0.4, room: 0.4, damp: 0.4, fade: 0.06 });
  } };

  /** sfx_suspicion — 쎄한 느낌: 반음으로 맞닿은 낮은 두 음이 울렁이며 부풀었다 사라진다 */
  TRACKS.sfx_suspicion = { kind: 'sfx', bitrate: 80000, make() {
    const T = new Track(1.9, false);
    [['A2', -0.3, 1], ['A#2', 0.3, 0.85], ['E4', 0, 0.3]].forEach(([nm, pan, g]) => {
      const f = hz(n(nm));
      T.voice(0, 1.8, pan, g * 0.5, 0.5, (t) => {
        const env = (t < 0.22 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 0.22) : Math.exp(-(t - 0.22) / 0.5));
        const w = TAU * f * t;
        return env * (Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.3 * Math.sin(3 * w) + 0.15 * Math.sin(4 * w));
      });
    });
    bell(T, 0.2, n('E6'), 0.12, -0.5, 0.9, 0.9);
    bell(T, 0.23, n('F6'), 0.1, 0.5, 0.9, 0.9);
    return master(T, { peak: 0.6, wet: 0.8, room: 0.75, damp: 0.5, fade: 0.5 });
  } };

  /** sfx_door_wood — 나무문: 손잡이가 딸깍 → 경첩이 짧게 삐걱 → 문이 멈추며 나무가 살짝 울린다 */
  TRACKS.sfx_door_wood = { kind: 'sfx', bitrate: 64000, make() {
    const T = new Track(0.72, false);
    // 손잡이
    [[0, 1], [0.032, 0.65]].forEach(([t0, g], i) => {
      noise(T, t0, 0.025, -0.1, g * 0.55, 0.2, 201 + i, biquad('bp', 2300 - i * 500, 1.8), (t) => Math.exp(-t / 0.0035));
      T.voice(t0, 0.05, -0.1, g * 0.35, 0.2, (t) => Math.min(1, t / 0.0006) * (Math.sin(TAU * 310 * t) * Math.exp(-t / 0.012) + 0.5 * Math.sin(TAU * 760 * t) * Math.exp(-t / 0.007)));
    });
    // 경첩: 마찰이 붙었다 미끄러지기를 반복하는 짧은 맥박들이 삐걱 소리가 된다
    const r = rng(207);
    const start = 0.075, span = 0.37;
    for (let at = start; at < start + span;) {
      const u = (at - start) / span;
      const rate = 34 + 78 * Math.sin(Math.PI * Math.min(1, u * 1.05));
      const amp = Math.pow(Math.sin(Math.PI * u), 0.7) * (0.75 + 0.25 * r());
      const pitch = 1 + 0.18 * Math.sin(Math.PI * u);
      T.voice(at, 0.035, 0.12, amp * 0.2, 0.25, (x) => Math.min(1, x / 0.0008) * (
        Math.sin(TAU * 640 * pitch * x) * Math.exp(-x / 0.008)
        + 0.55 * Math.sin(TAU * 1130 * pitch * x) * Math.exp(-x / 0.006)
        + 0.3 * Math.sin(TAU * 1980 * pitch * x) * Math.exp(-x / 0.0035)));
      at += (1 / rate) * (0.88 + 0.24 * r());
    }
    // 문이 멈추는 둔탁한 나무 울림
    T.voice(0.47, 0.16, 0.05, 0.42, 0.35, (x) => Math.min(1, x / 0.002) * (
      Math.sin(TAU * 142 * x) * Math.exp(-x / 0.04)
      + 0.55 * Math.sin(TAU * 318 * x) * Math.exp(-x / 0.024)
      + 0.25 * Math.sin(TAU * 690 * x) * Math.exp(-x / 0.012)));
    noise(T, 0.47, 0.04, 0.05, 0.18, 0.3, 209, biquad('bp', 900, 1), (x) => Math.exp(-x / 0.008));
    return master(T, { peak: 0.7, wet: 0.35, room: 0.28, damp: 0.65, fade: 0.08 });
  } };

  function render(id) {
    const tr = TRACKS[id];
    if (!tr) throw new Error('unknown track ' + id);
    const out = tr.make();
    return Object.assign(out, { id, kind: tr.kind, bitrate: tr.bitrate, sampleRate: SR, stats: stats(out.L, out.R) });
  }

  root.AudioLab = { SR, TRACKS, render, stats };
})(typeof globalThis !== 'undefined' ? globalThis : this);
