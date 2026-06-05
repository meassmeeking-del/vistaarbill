// Tiny haptics + WebAudio "juice" helpers for games. Zero deps.

const VOL_KEY = "pos:fx:volume";
const HAP_KEY = "pos:fx:haptic";

function readNum(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

let _volume = readNum(VOL_KEY, 1);
let _haptic = readNum(HAP_KEY, 1);
let _ctx: AudioContext | null = null;

export function getVolume() {
  return _volume;
}
export function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VOL_KEY, String(_volume));
  }
}
export function getHapticIntensity() {
  return _haptic;
}
export function setHapticIntensity(v: number) {
  _haptic = Math.max(0, Math.min(1, v));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HAP_KEY, String(_haptic));
  }
}

export function haptic(pattern: number | number[] = 15) {
  if (typeof navigator === "undefined" || _haptic <= 0) return;
  const scaled = Array.isArray(pattern)
    ? pattern.map((n) => Math.max(0, Math.round(n * _haptic)))
    : Math.max(0, Math.round(pattern * _haptic));
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean })
      .vibrate?.(scaled);
  } catch {
    /* ignore */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_volume <= 0) return null;
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
  setVolume(m ? 0 : 1);
}
export function isMuted() {
  return _volume <= 0;
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
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * _volume), t + 0.01);
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