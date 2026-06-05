// Tiny haptics + WebAudio "juice" helpers for games. Zero deps.

export function haptic(pattern: number | number[] = 15) {
  if (typeof navigator === "undefined") return;
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean })
      .vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

let _ctx: AudioContext | null = null;
let _muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_muted) return null;
  if (_ctx) return _ctx;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _ctx = new Ctx();
    return _ctx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean) {
  _muted = m;
}
export function isMuted() {
  return _muted;
}

type ToneOpts = {
  freq?: number;
  endFreq?: number;
  dur?: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
};

export function tone({
  freq = 440,
  endFreq,
  dur = 0.12,
  type = "sine",
  volume = 0.15,
  delay = 0,
}: ToneOpts = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  select: () => tone({ freq: 520, endFreq: 720, dur: 0.06, type: "triangle", volume: 0.08 }),
  swap: () => tone({ freq: 380, endFreq: 560, dur: 0.08, type: "triangle", volume: 0.1 }),
  invalid: () => tone({ freq: 220, endFreq: 140, dur: 0.18, type: "sawtooth", volume: 0.08 }),
  match: (combo = 1) => {
    const base = 540 + Math.min(combo, 6) * 80;
    tone({ freq: base, endFreq: base * 1.6, dur: 0.18, type: "sine", volume: 0.16 });
    tone({ freq: base * 1.25, endFreq: base * 2, dur: 0.14, type: "triangle", volume: 0.1, delay: 0.04 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.18, type: "triangle", volume: 0.15, delay: i * 0.1 }),
    );
  },
};