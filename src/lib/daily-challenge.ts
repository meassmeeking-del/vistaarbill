import { useEffect, useState } from "react";

export type ChallengeTask = {
  id: "snake" | "rps" | "memory";
  label: string;
  target: number;
  reward: number;
  unit: string;
  mode: "gte" | "lte"; // gte: progress >= target; lte: progress <= target (lower is better)
};

const todayKey = () => new Date().toISOString().slice(0, 10);

// Deterministic per-day seed
const seed = (date: string) => {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export function getDailyTasks(): ChallengeTask[] {
  const s = seed(todayKey());
  const snakeTargets = [50, 80, 100, 120, 150];
  const rpsTargets = [3, 4, 5, 6];
  const memTargets = [14, 16, 18, 20];
  return [
    {
      id: "snake",
      label: "Candy Crush score",
      target: snakeTargets[s % snakeTargets.length],
      reward: 20,
      unit: "pts",
      mode: "gte",
    },
    {
      id: "rps",
      label: "RPS wins",
      target: rpsTargets[(s >> 3) % rpsTargets.length],
      reward: 15,
      unit: "wins",
      mode: "gte",
    },
    {
      id: "memory",
      label: "Memory in ≤ moves",
      target: memTargets[(s >> 5) % memTargets.length],
      reward: 25,
      unit: "moves",
      mode: "lte",
    },
  ];
}

type DailyState = {
  date: string;
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
};

const KEY = "pos.dailyChallenge";
const BOOST_KEY = "pos.rewardBoost";

const readState = (): DailyState => {
  if (typeof window === "undefined") return { date: todayKey(), progress: {}, claimed: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DailyState) : null;
    if (!parsed || parsed.date !== todayKey()) {
      return { date: todayKey(), progress: {}, claimed: {} };
    }
    return parsed;
  } catch {
    return { date: todayKey(), progress: {}, claimed: {} };
  }
};

const writeState = (s: DailyState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("pos:daily"));
};

export function recordProgress(id: ChallengeTask["id"], value: number, mode: "max" | "min" | "inc" = "max") {
  const s = readState();
  const cur = s.progress[id];
  let nv = value;
  if (mode === "max") nv = Math.max(cur ?? 0, value);
  else if (mode === "min") nv = cur == null ? value : Math.min(cur, value);
  else if (mode === "inc") nv = (cur ?? 0) + value;
  s.progress[id] = nv;
  writeState(s);
}

export function claimReward(task: ChallengeTask): boolean {
  const s = readState();
  if (s.claimed[task.id]) return false;
  const p = s.progress[task.id] ?? (task.mode === "lte" ? Infinity : 0);
  const ok = task.mode === "gte" ? p >= task.target : p > 0 && p <= task.target;
  if (!ok) return false;
  s.claimed[task.id] = true;
  writeState(s);
  const cur = Number(window.localStorage.getItem(BOOST_KEY) || 0);
  window.localStorage.setItem(BOOST_KEY, String(cur + task.reward));
  window.dispatchEvent(new CustomEvent("pos:daily"));
  return true;
}

export function useDailyChallenge() {
  const [state, setState] = useState<DailyState>(() => readState());
  const [boost, setBoost] = useState<number>(() =>
    typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(BOOST_KEY) || 0),
  );
  useEffect(() => {
    const h = () => {
      setState(readState());
      setBoost(Number(window.localStorage.getItem(BOOST_KEY) || 0));
    };
    window.addEventListener("pos:daily", h);
    return () => window.removeEventListener("pos:daily", h);
  }, []);
  return { state, boost, tasks: getDailyTasks() };
}