import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, RotateCcw, Gamepad2, Target, Sparkles, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  claimReward,
  recordProgress,
  useDailyChallenge,
  type ChallengeTask,
} from "@/lib/daily-challenge";

/* ===================== Snake Game ===================== */
type Point = { x: number; y: number };
const SNAKE_GRID = 15;
const SNAKE_SPEED = 150;

function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Point>({ x: 3, y: 3 });
  const [dir, setDir] = useState<Point>({ x: 0, y: -1 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("snake_high") || 0);
  });
  const [running, setRunning] = useState(true);
  const dirRef = useRef(dir);
  dirRef.current = dir;

  const randomFood = useCallback((currentSnake: Point[]) => {
    let p: Point;
    do {
      p = { x: Math.floor(Math.random() * SNAKE_GRID), y: Math.floor(Math.random() * SNAKE_GRID) };
    } while (currentSnake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }, []);

  const reset = useCallback(() => {
    const start = [{ x: 7, y: 7 }];
    setSnake(start);
    setFood(randomFood(start));
    setDir({ x: 0, y: -1 });
    setGameOver(false);
    setScore(0);
    setRunning(true);
  }, [randomFood]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const d = dirRef.current;
      switch (e.key) {
        case "ArrowUp":
          if (d.y === 0) setDir({ x: 0, y: -1 });
          break;
        case "ArrowDown":
          if (d.y === 0) setDir({ x: 0, y: 1 });
          break;
        case "ArrowLeft":
          if (d.x === 0) setDir({ x: -1, y: 0 });
          break;
        case "ArrowRight":
          if (d.x === 0) setDir({ x: 1, y: 0 });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!running || gameOver) return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const head = prev[0];
        const next: Point = {
          x: (head.x + dirRef.current.x + SNAKE_GRID) % SNAKE_GRID,
          y: (head.y + dirRef.current.y + SNAKE_GRID) % SNAKE_GRID,
        };
        if (prev.some((s) => s.x === next.x && s.y === next.y)) {
          setGameOver(true);
          setRunning(false);
          return prev;
        }
        const ate = next.x === food.x && next.y === food.y;
        const nextSnake = ate ? [next, ...prev] : [next, ...prev.slice(0, -1)];
        if (ate) {
          setScore((s) => {
            const ns = s + 10;
            if (ns > highScore) {
              setHighScore(ns);
              window.localStorage.setItem("snake_high", String(ns));
            }
            recordProgress("snake", ns, "max");
            return ns;
          });
          setFood(randomFood(nextSnake));
        }
        return nextSnake;
      });
    }, SNAKE_SPEED);
    return () => clearInterval(id);
  }, [running, gameOver, food, highScore, randomFood]);

  const cellSize = "w-[calc(100%/15)] aspect-square";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4 text-sm w-full justify-between px-1">
        <span className="font-semibold text-primary">Score: {score}</span>
        <span className="text-muted-foreground">Best: {highScore}</span>
      </div>
      <div
        className="relative border-2 border-primary/30 rounded-xl overflow-hidden bg-card select-none"
        style={{ width: "min(320px, 90vw)", aspectRatio: "1" }}
      >
        <div className="grid w-full h-full" style={{ gridTemplateColumns: `repeat(${SNAKE_GRID}, 1fr)` }}>
          {Array.from({ length: SNAKE_GRID * SNAKE_GRID }).map((_, i) => {
            const x = i % SNAKE_GRID;
            const y = Math.floor(i / SNAKE_GRID);
            const isSnake = snake.some((s) => s.x === x && s.y === y);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className={`
                  ${cellSize}
                  ${isHead ? "bg-primary rounded-sm" : ""}
                  ${isSnake && !isHead ? "bg-primary/60 rounded-sm" : ""}
                  ${isFood ? "bg-destructive rounded-full scale-75" : ""}
                  ${!isSnake && !isFood ? "bg-muted/30" : ""}
                `}
              />
            );
          })}
        </div>
        {(gameOver || !running) && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            {gameOver && <p className="text-xl font-bold text-destructive">Game Over!</p>}
            <p className="text-sm text-muted-foreground">Score: {score}</p>
            <Button size="sm" onClick={reset} className="mt-1">
              <RotateCcw className="h-4 w-4 mr-1" /> Play Again
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 max-w-[200px] w-full">
        <div />
        <Button size="sm" variant="outline" onClick={() => dir.y === 0 && setDir({ x: 0, y: -1 })}>
          ↑
        </Button>
        <div />
        <Button size="sm" variant="outline" onClick={() => dir.x === 0 && setDir({ x: -1, y: 0 })}>
          ←
        </Button>
        <Button size="sm" variant="outline" onClick={() => dir.y === 0 && setDir({ x: 0, y: 1 })}>
          ↓
        </Button>
        <Button size="sm" variant="outline" onClick={() => dir.x === 0 && setDir({ x: 1, y: 0 })}>
          →
        </Button>
      </div>
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
              <CardTitle className="text-base">🐍 Snake Game</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Classic snake. Eat food, grow long. Arrows ya buttons se control.</p>
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
          {active === "snake" ? "🐍 Snake Game" : active === "rps" ? "✊ Rock Paper Scissors" : "🧠 Memory Match"}
        </h2>
      </div>
      {active === "snake" && <SnakeGame />}
      {active === "rps" && <RPSGame />}
      {active === "memory" && <MemoryGame />}
    </div>
  );
}
