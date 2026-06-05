import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, RotateCcw, Gamepad2, Target, Sparkles, CheckCircle2, Volume2, VolumeX } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { haptic, sfx, setMuted, isMuted } from "@/lib/juice";
import {
  claimReward,
  recordProgress,
  useDailyChallenge,
  type ChallengeTask,
} from "@/lib/daily-challenge";

/* ===================== Candy Crush Game ===================== */
const CANDIES = ["🍬", "🍫", "🍭", "🍩", "🧁", "🍪"];
const CG_SIZE = 8;
const CG_MOVES = 20;

type Grid = string[][];

const randCandy = () => CANDIES[Math.floor(Math.random() * CANDIES.length)];

const findMatches = (g: Grid): boolean[][] => {
  const m: boolean[][] = Array.from({ length: CG_SIZE }, () => Array(CG_SIZE).fill(false));
  for (let r = 0; r < CG_SIZE; r++) {
    for (let c = 0; c < CG_SIZE - 2; c++) {
      const v = g[r][c];
      if (v && v === g[r][c + 1] && v === g[r][c + 2]) {
        m[r][c] = m[r][c + 1] = m[r][c + 2] = true;
      }
    }
  }
  for (let c = 0; c < CG_SIZE; c++) {
    for (let r = 0; r < CG_SIZE - 2; r++) {
      const v = g[r][c];
      if (v && v === g[r + 1][c] && v === g[r + 2][c]) {
        m[r][c] = m[r + 1][c] = m[r + 2][c] = true;
      }
    }
  }
  return m;
};

const countMatches = (m: boolean[][]) =>
  m.reduce((a, row) => a + row.filter(Boolean).length, 0);

const buildInitialGrid = (): Grid => {
  // Generate a grid with no initial matches
  while (true) {
    const g: Grid = Array.from({ length: CG_SIZE }, () =>
      Array.from({ length: CG_SIZE }, () => randCandy()),
    );
    if (countMatches(findMatches(g)) === 0) return g;
  }
};

const cloneGrid = (g: Grid): Grid => g.map((row) => [...row]);

const collapseGrid = (g: Grid, m: boolean[][]): Grid => {
  const ng = cloneGrid(g);
  for (let c = 0; c < CG_SIZE; c++) {
    const stack: string[] = [];
    for (let r = CG_SIZE - 1; r >= 0; r--) {
      if (!m[r][c]) stack.push(ng[r][c]);
    }
    while (stack.length < CG_SIZE) stack.push(randCandy());
    for (let r = CG_SIZE - 1, i = 0; r >= 0; r--, i++) {
      ng[r][c] = stack[i];
    }
  }
  return ng;
};

function CandyGame() {
  const [grid, setGrid] = useState<Grid>(() => buildInitialGrid());
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(CG_MOVES);
  const [busy, setBusy] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("candy_high") || 0);
  });
  const [matchedCells, setMatchedCells] = useState<boolean[][] | null>(null);
  const [newCells, setNewCells] = useState<boolean[][] | null>(null);
  const [combos, setCombos] = useState<{ id: number; text: string }[]>([]);
  const [sparks, setSparks] = useState<{ id: number; r: number; c: number; dx: number; dy: number }[]>([]);
  const [muted, setMutedState] = useState(() => isMuted());
  const idRef = useRef(0);

  const gameOver = moves <= 0;

  const reset = useCallback(() => {
    setGrid(buildInitialGrid());
    setSelected(null);
    setScore(0);
    setMoves(CG_MOVES);
    setBusy(false);
    setMatchedCells(null);
    setNewCells(null);
    setCombos([]);
    setSparks([]);
  }, []);

  const burstSparks = useCallback((m: boolean[][]) => {
    const next: { id: number; r: number; c: number; dx: number; dy: number }[] = [];
    for (let r = 0; r < CG_SIZE; r++) {
      for (let c = 0; c < CG_SIZE; c++) {
        if (!m[r][c]) continue;
        for (let k = 0; k < 4; k++) {
          const ang = (Math.PI * 2 * k) / 4 + Math.random();
          const dist = 22 + Math.random() * 18;
          next.push({
            id: ++idRef.current,
            r,
            c,
            dx: Math.cos(ang) * dist,
            dy: Math.sin(ang) * dist,
          });
        }
      }
    }
    setSparks((s) => [...s, ...next]);
    setTimeout(() => {
      setSparks((s) => s.filter((x) => !next.find((n) => n.id === x.id)));
    }, 550);
  }, []);

  const cascade = useCallback(
    async (start: Grid) => {
      let cur = start;
      let combo = 0;
      while (true) {
        const m = findMatches(cur);
        const n = countMatches(m);
        if (n === 0) break;
        combo++;
        setMatchedCells(m);
        setGrid(cur);
        sfx.match(combo);
        haptic(combo > 1 ? [12, 30, 18] : 18);
        burstSparks(m);
        if (combo >= 2) {
          const id = ++idRef.current;
          setCombos((cs) => [...cs, { id, text: `Combo x${combo}!` }]);
          setTimeout(() => setCombos((cs) => cs.filter((x) => x.id !== id)), 900);
        }
        await new Promise((res) => setTimeout(res, 380));
        const gained = n * 10 * combo;
        setScore((s) => {
          const ns = s + gained;
          if (ns > highScore) {
            setHighScore(ns);
            window.localStorage.setItem("candy_high", String(ns));
          }
          recordProgress("snake", ns, "max");
          return ns;
        });
        cur = collapseGrid(cur, m);
        setMatchedCells(null);
        setNewCells(m);
        setGrid(cur);
        await new Promise((res) => setTimeout(res, 280));
        setNewCells(null);
      }
    },
    [highScore, burstSparks],
  );

  const trySwap = useCallback(
    async (a: { r: number; c: number }, b: { r: number; c: number }) => {
      const adj = Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
      if (!adj) {
        setSelected(b);
        sfx.select();
        return;
      }
      setBusy(true);
      sfx.swap();
      haptic(10);
      const ng = cloneGrid(grid);
      [ng[a.r][a.c], ng[b.r][b.c]] = [ng[b.r][b.c], ng[a.r][a.c]];
      setGrid(ng);
      await new Promise((res) => setTimeout(res, 180));
      const m = findMatches(ng);
      if (countMatches(m) === 0) {
        // revert
        [ng[a.r][a.c], ng[b.r][b.c]] = [ng[b.r][b.c], ng[a.r][a.c]];
        setGrid([...ng]);
        setSelected(null);
        setBusy(false);
        sfx.invalid();
        haptic([8, 40, 8]);
        return;
      }
      setMoves((mv) => mv - 1);
      await cascade(ng);
      setSelected(null);
      setBusy(false);
      if (moves - 1 <= 0) {
        sfx.win();
        haptic([20, 40, 20, 40, 60]);
      }
    },
    [grid, cascade, moves],
  );

  const onCell = (r: number, c: number) => {
    if (busy || gameOver) return;
    if (!selected) {
      setSelected({ r, c });
      sfx.select();
      haptic(8);
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    void trySwap(selected, { r, c });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-3 text-sm w-full justify-between px-1 max-w-[360px]">
        <span className="font-semibold text-primary">Score: {score}</span>
        <span className="text-foreground">Moves: {moves}</span>
        <span className="text-muted-foreground">Best: {highScore}</span>
        <button
          onClick={toggleMute}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      <div
        className="relative border-2 border-primary/30 rounded-xl overflow-hidden bg-card p-1.5 select-none"
        style={{ width: "min(360px, 92vw)", aspectRatio: "1" }}
      >
        <div
          className="grid w-full h-full gap-1"
          style={{ gridTemplateColumns: `repeat(${CG_SIZE}, 1fr)` }}
        >
          {grid.map((row, r) =>
            row.map((candy, c) => {
              const isSel = selected?.r === r && selected?.c === c;
              const isMatch = matchedCells?.[r]?.[c];
              const isNew = newCells?.[r]?.[c];
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onCell(r, c)}
                  className={`
                    relative candy-cell aspect-square rounded-lg flex items-center justify-center
                    text-[clamp(1.1rem,4vw,1.7rem)] transition-colors duration-150
                    ${isSel ? "bg-primary/30 ring-2 ring-primary candy-selected" : "bg-muted/40 hover:bg-muted/70"}
                    ${isMatch ? "bg-primary/60" : ""}
                    active:scale-90
                  `}
                >
                  <span
                    className={`inline-block ${isMatch ? "candy-pop" : isNew ? "candy-drop" : ""}`}
                  >
                    {candy}
                  </span>
                  {sparks
                    .filter((s) => s.r === r && s.c === c)
                    .map((s) => (
                      <span
                        key={s.id}
                        className="spark"
                        style={
                          {
                            ["--dx" as string]: `${s.dx}px`,
                            ["--dy" as string]: `${s.dy}px`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                </button>
              );
            }),
          )}
        </div>
        {combos.map((cb) => (
          <span key={cb.id} className="combo-pop text-2xl text-primary">
            {cb.text}
          </span>
        ))}
        {gameOver && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 rounded-xl">
            <Trophy className="h-8 w-8 text-primary" />
            <p className="text-xl font-bold text-primary">Sweet!</p>
            <p className="text-sm text-muted-foreground">Final Score: {score}</p>
            <Button size="sm" onClick={reset} className="mt-1">
              <RotateCcw className="h-4 w-4 mr-1" /> Play Again
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-[300px]">
        Tap a candy, then tap an adjacent one to swap. Match 3+ in a row/column to crush!
      </p>
    </div>
  );
}

/* ===================== RPS Game ===================== */
type RPSChoice = "rock" | "paper" | "scissors";

const rpsEmojis: Record<RPSChoice, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

function RPSGame() {
  const [player, setPlayer] = useState<RPSChoice | null>(null);
  const [cpu, setCpu] = useState<RPSChoice | null>(null);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);

  const play = (choice: RPSChoice) => {
    const choices: RPSChoice[] = ["rock", "paper", "scissors"];
    const c = choices[Math.floor(Math.random() * choices.length)];
    setPlayer(choice);
    setCpu(c);
    if (choice === c) {
      setResult("draw");
      setDraws((d) => d + 1);
    } else if (
      (choice === "rock" && c === "scissors") ||
      (choice === "paper" && c === "rock") ||
      (choice === "scissors" && c === "paper")
    ) {
      setResult("win");
      setWins((w) => {
        const nw = w + 1;
        recordProgress("rps", nw, "max");
        return nw;
      });
    } else {
      setResult("lose");
      setLosses((l) => l + 1);
    }
  };

  const reset = () => {
    setPlayer(null);
    setCpu(null);
    setResult(null);
  };

  const resultText = result === "win" ? "You Win!" : result === "lose" ? "You Lose!" : result === "draw" ? "Draw!" : "";
  const resultColor = result === "win" ? "text-green-500" : result === "lose" ? "text-destructive" : "text-primary";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Wins: <b className="text-foreground">{wins}</b></span>
        <span>Losses: <b className="text-foreground">{losses}</b></span>
        <span>Draws: <b className="text-foreground">{draws}</b></span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-5xl mb-1">{player ? rpsEmojis[player] : "❓"}</div>
          <p className="text-xs text-muted-foreground">You</p>
        </div>
        <div className="text-2xl font-bold text-muted-foreground">VS</div>
        <div className="text-center">
          <div className="text-5xl mb-1">{cpu ? rpsEmojis[cpu] : "❓"}</div>
          <p className="text-xs text-muted-foreground">CPU</p>
        </div>
      </div>
      {result && <p className={`text-lg font-bold ${resultColor}`}>{resultText}</p>}
      <div className="flex gap-2">
        {(["rock", "paper", "scissors"] as RPSChoice[]).map((c) => (
          <Button key={c} variant="outline" size="lg" className="flex-col h-16 w-20 gap-0.5 rounded-xl text-xs" onClick={() => play(c)}>
            <span className="text-2xl">{rpsEmojis[c]}</span>
            <span className="capitalize">{c}</span>
          </Button>
        ))}
      </div>
      {result && (
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>
      )}
    </div>
  );
}

/* ===================== Memory Game ===================== */
const EMOJIS = ["🍎", "🍌", "🍇", "🍉", "🍊", "🍓", "🍍", "🥝"];

function MemoryGame() {
  const [cards, setCards] = useState<{ emoji: string; id: number; flipped: boolean; matched: boolean }[]>([]);
  const [flippedIdx, setFlippedIdx] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("memory_best") || 0);
  });
  const [gameWon, setGameWon] = useState(false);

  const init = useCallback(() => {
    const deck = [...EMOJIS, ...EMOJIS]
      .map((emoji, i) => ({ emoji, id: i, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlippedIdx([]);
    setMoves(0);
    setGameWon(false);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const onCardClick = (idx: number) => {
    if (cards[idx].flipped || cards[idx].matched || flippedIdx.length === 2) return;
    const next = [...cards];
    next[idx].flipped = true;
    setCards(next);
    const newFlipped = [...flippedIdx, idx];
    setFlippedIdx(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newFlipped;
      if (next[a].emoji === next[b].emoji) {
        next[a].matched = true;
        next[b].matched = true;
        setCards(next);
        setFlippedIdx([]);
        if (next.every((c) => c.matched)) {
          setGameWon(true);
          setMoves((m) => {
            const final = m + 1;
            if (bestMoves === 0 || final < bestMoves) {
              setBestMoves(final);
              window.localStorage.setItem("memory_best", String(final));
            }
            recordProgress("memory", final, "min");
            return final;
          });
        }
      } else {
        setTimeout(() => {
          next[a].flipped = false;
          next[b].flipped = false;
          setCards([...next]);
          setFlippedIdx([]);
        }, 700);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-sm">
      <div className="flex items-center gap-4 text-sm w-full justify-between px-1">
        <span className="font-semibold text-primary">Moves: {moves}</span>
        <span className="text-muted-foreground">Best: {bestMoves || "—"}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 w-full">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => onCardClick(i)}
            className={`
              aspect-square rounded-xl text-3xl font-bold flex items-center justify-center
              transition-all duration-300 border-2 select-none
              ${card.flipped || card.matched
                ? "bg-card border-primary/40 shadow-sm scale-100"
                : "bg-primary/10 border-primary/20 hover:border-primary/40 hover:scale-105 active:scale-95"
              }
            `}
          >
            {(card.flipped || card.matched) ? card.emoji : ""}
          </button>
        ))}
      </div>
      {gameWon && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-lg font-bold text-green-500 flex items-center gap-1">
            <Trophy className="h-5 w-5" /> You Won in {moves} moves!
          </p>
          <Button size="sm" onClick={init}>
            <RotateCcw className="h-4 w-4 mr-1" /> Play Again
          </Button>
        </div>
      )}
    </div>
  );
}

/* ===================== Game Selector ===================== */
function DailyChallenge() {
  const { state, boost, tasks } = useDailyChallenge();

  const taskStatus = (t: ChallengeTask) => {
    const p = state.progress[t.id] ?? (t.mode === "lte" ? 0 : 0);
    const done = t.mode === "gte" ? p >= t.target : p > 0 && p <= t.target;
    const pct =
      t.mode === "gte"
        ? Math.min(100, Math.round(((p || 0) / t.target) * 100))
        : p > 0
          ? Math.min(100, Math.round((t.target / p) * 100))
          : 0;
    return { p, done, pct, claimed: !!state.claimed[t.id] };
  };

  const onClaim = (t: ChallengeTask) => {
    if (claimReward(t)) {
      toast.success(`+${t.reward} boost claimed!`, { description: t.label });
    } else {
      toast.error("Complete the target first!");
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Daily Challenge
          </CardTitle>
          <div className="flex items-center gap-1 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4" />
            {boost} boost
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Naye challenges roz reset honge. Pura karo, reward lo!
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((t) => {
          const { p, done, pct, claimed } = taskStatus(t);
          return (
            <div key={t.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {t.label}{" "}
                  <span className="text-muted-foreground">
                    ({t.mode === "gte" ? `${p || 0}/${t.target}` : `best ${p || "—"}, target ≤${t.target}`} {t.unit})
                  </span>
                </span>
                {claimed ? (
                  <span className="flex items-center gap-1 text-green-500 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> +{t.reward}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={done ? "default" : "outline"}
                    disabled={!done}
                    className="h-6 px-2 text-xs"
                    onClick={() => onClaim(t)}
                  >
                    Claim +{t.reward}
                  </Button>
                )}
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function Games() {
  const [active, setActive] = useState<"menu" | "snake" | "rps" | "memory">("menu");

  if (active === "menu") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Mini Games</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">Bore ho raha hai? Khelo!</p>
        <DailyChallenge />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => setActive("snake")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🍬 Candy Crush</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Match 3 ya zyada candies ek line me. 20 moves me max score banao!</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => setActive("rps")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">✊ Rock Paper Scissors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Computer ke against khelo. Jeet ka maza lo!</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => setActive("memory")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🧠 Memory Match</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Fruit cards ko match karo. Yaad rakho kahan kya tha!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="w-full flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActive("menu")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-base font-bold">
          {active === "snake" ? "🍬 Candy Crush" : active === "rps" ? "✊ Rock Paper Scissors" : "🧠 Memory Match"}
        </h2>
      </div>
      {active === "snake" && <CandyGame />}
      {active === "rps" && <RPSGame />}
      {active === "memory" && <MemoryGame />}
    </div>
  );
}
