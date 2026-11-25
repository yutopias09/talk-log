// 効果音と振動（ガラスのバー、トーク再生、お祝いで使う）

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
  __tlAudio?: { ctx: AudioContext; out: AudioNode };
  __tlSilent?: HTMLAudioElement;
};

const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1));

function getAudio(): { ctx: AudioContext; out: AudioNode } | null {
  const w = window as AudioWindow;
  const Ctor = window.AudioContext || w.webkitAudioContext;
  if (!Ctor) return null;
  if (!w.__tlAudio) {
    const ctx = new Ctor();
    // スマホの小さいスピーカーでも聞こえるよう少し持ち上げ、割れないようにコンプレッサーを通す
    const gain = ctx.createGain();
    gain.gain.value = 2.4;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.08;
      gain.connect(comp);
      comp.connect(ctx.destination);
    } catch {
      gain.connect(ctx.destination);
    }
    w.__tlAudio = { ctx, out: gain };
  }
  const a = w.__tlAudio;
  if (a.ctx.state !== "running") a.ctx.resume().catch(() => {});
  return a;
}

/** 無音のWAV（iPhoneでマナースイッチONでも効果音が鳴るように、再生中の扱いにするため） */
function silentWavUrl(): string {
  const n = 800;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** 最初のタップで音を使える状態にする（ブラウザは操作の前に音を鳴らせないため） */
export function installAudioUnlock(): void {
  try {
    const unlock = () => {
      try {
        const w = window as AudioWindow;
        if (IS_IOS) {
          try {
            const nav = navigator as Navigator & { audioSession?: { type: string } };
            if (nav.audioSession) nav.audioSession.type = "playback";
          } catch {
            /* ignore */
          }
          if (!w.__tlSilent) {
            const el = new Audio(silentWavUrl());
            el.loop = true;
            el.setAttribute("playsinline", "");
            w.__tlSilent = el;
          }
          w.__tlSilent.play().catch(() => {});
        }
        const a = getAudio();
        if (a) {
          // 無音を一瞬だけ鳴らして、音の出口を開けておく
          const src = a.ctx.createBufferSource();
          src.buffer = a.ctx.createBuffer(1, 1, 22050);
          src.connect(a.ctx.destination);
          src.start(0);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    window.addEventListener("keydown", unlock, { capture: true });
  } catch {
    /* ignore */
  }
}

/** 短い「ポン」という音。既定はミ(E5)。 */
export function playTick(freq = 659.25, duration = 0.05): void {
  try {
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;
    const t0 = ctx.currentTime;
    // 基音(三角波) + 2倍音(サイン)
    const layers: [number, OscillatorType, number][] = [
      [freq, "triangle", 0.2],
      [freq * 2, "sine", 0.08],
    ];
    for (const [f, type, vol] of layers) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = f;
      osc.type = type;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + duration + 0.01);
    }
  } catch {
    /* 音が出せない環境では何もしない */
  }
}

/**
 * 「しゅぽっ」: LINEの送信音のような、丸くて落ち着いたポップ音。
 * high=true で少し高め（右側の人）、fast=true で短め（速い再生向け）。
 */
export function playPop(high: boolean, fast: boolean): void {
  try {
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;
    const t0 = ctx.currentTime;
    const dur = fast ? 0.09 : 0.15;
    // しゅ… : ふわっとした息のようなノイズ
    const len = Math.max(64, Math.floor(ctx.sampleRate * 0.04));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, x * 1.2)) * (1 - x);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = high ? 2600 : 2200;
    bp.Q.value = 0.7;
    const gn = ctx.createGain();
    gn.gain.value = fast ? 0.12 : 0.18;
    src.connect(bp);
    bp.connect(gn);
    gn.connect(out);
    src.start(t0);
    // ぽっ : 下からやさしく持ち上がる丸い音
    const f0 = high ? 400 : 320;
    const f1 = high ? 640 : 510;
    const t1 = t0 + 0.03;
    const tone = (mul: number, peak: number, att: number, len2: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f0 * mul, t1);
      osc.frequency.exponentialRampToValueAtTime(f1 * mul, t1 + dur * 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t1);
      g.gain.linearRampToValueAtTime(peak, t1 + att);
      g.gain.exponentialRampToValueAtTime(0.001, t1 + len2);
      osc.connect(g);
      g.connect(out);
      osc.start(t1);
      osc.stop(t1 + len2 + 0.02);
    };
    tone(1, 0.34, 0.02, dur);
    tone(2, 0.045, 0.015, dur * 0.7);
  } catch {
    /* ignore */
  }
}

/** お祝いの「ド・ミ・ソ」 */
export function playCelebration(): void {
  playTick(660, 0.1);
  setTimeout(() => playTick(880, 0.12), 110);
  setTimeout(() => playTick(1100, 0.16), 230);
  vibrate([40, 30, 40, 30, 80]);
}

export function vibrate(pattern: number | number[] = 7): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 対応していない端末では何もしない */
  }
}
