import { useEffect, useRef, useState } from "react";

type Obstacle = { x: number; z: number; lane: number };

const LANES = [-1, 0, 1];

export function BallRoadGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    lane: 1, // 0,1,2 -> LANES[lane]
    targetLane: 1,
    ballX: 0,
    ballRot: 0,
    speed: 8,
    distance: 0,
    obstacles: [] as Obstacle[],
    spawnTimer: 0,
    running: false,
  });

  const start = () => {
    stateRef.current = {
      lane: 1,
      targetLane: 1,
      ballX: 0,
      ballRot: 0,
      speed: 8,
      distance: 0,
      obstacles: [],
      spawnTimer: 0,
      running: true,
    };
    setScore(0);
    setGameOver(false);
    setRunning(true);
  };

  const move = (dir: -1 | 1) => {
    const s = stateRef.current;
    s.targetLane = Math.max(0, Math.min(2, s.targetLane + dir));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") move(-1);
      if (e.key === "ArrowRight" || e.key === "d") move(1);
      if ((e.key === " " || e.key === "Enter") && !stateRef.current.running) start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const css = getComputedStyle(document.documentElement);
    const skyTop = `oklch(${css.getPropertyValue("--sky-top").trim() || "0.45 0.12 280"})`;
    const skyBottom = `oklch(${css.getPropertyValue("--sky-bottom").trim() || "0.65 0.15 40"})`;
    const roadColor = `oklch(${css.getPropertyValue("--road").trim() || "0.32 0.02 260"})`;
    const lineColor = `oklch(${css.getPropertyValue("--road-line").trim() || "0.95 0.02 100"})`;
    const ballColor = `oklch(${css.getPropertyValue("--primary").trim() || "0.78 0.18 50"})`;

    const project = (x: number, z: number, w: number, h: number) => {
      // z: 0 (near) to 1 (far)
      const horizon = h * 0.35;
      const scale = 1 / (1 + z * 6);
      const py = horizon + (h - horizon) * (1 - z);
      const px = w / 2 + x * (w * 0.35) * scale;
      return { px, py, scale };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const s = stateRef.current;

      // sky
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.45);

      // ground
      ctx.fillStyle = "oklch(0.35 0.08 145)";
      ctx.fillRect(0, h * 0.35, w, h * 0.65);

      // road (trapezoid)
      const horizon = h * 0.35;
      const roadTopW = w * 0.12;
      const roadBotW = w * 0.95;
      ctx.fillStyle = roadColor;
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTopW / 2, horizon);
      ctx.lineTo(w / 2 + roadTopW / 2, horizon);
      ctx.lineTo(w / 2 + roadBotW / 2, h);
      ctx.lineTo(w / 2 - roadBotW / 2, h);
      ctx.closePath();
      ctx.fill();

      // lane dashed lines (animated)
      if (s.running) s.distance += s.speed * dt;
      const dashes = 14;
      for (let laneEdge of [-1 / 3, 1 / 3]) {
        for (let i = 0; i < dashes; i++) {
          const t = ((i / dashes) + (s.distance * 0.05) % (1 / dashes)) % 1;
          const z = 1 - t;
          const len = 0.04;
          const z2 = Math.max(0, z - len);
          const a = project(laneEdge * 2, z, w, h);
          const b = project(laneEdge * 2, z2, w, h);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = Math.max(1, 6 * a.scale);
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.stroke();
        }
      }

      // update ball lane interpolation
      const targetX = LANES[s.targetLane];
      s.ballX += (targetX - s.ballX) * Math.min(1, dt * 10);
      s.lane = s.targetLane;
      s.ballRot += s.speed * dt * 2;

      // spawn obstacles
      if (s.running) {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          s.spawnTimer = Math.max(0.45, 1.2 - s.distance * 0.002);
          const lane = Math.floor(Math.random() * 3);
          s.obstacles.push({ x: LANES[lane], z: 1, lane });
        }
        // move obstacles closer
        for (const o of s.obstacles) o.z -= s.speed * dt * 0.06;
        s.obstacles = s.obstacles.filter((o) => o.z > -0.05);

        // collision: when obstacle near z ~ 0 and same lane
        for (const o of s.obstacles) {
          if (o.z < 0.05 && o.z > -0.02 && o.lane === s.targetLane && Math.abs(s.ballX - o.x) < 0.5) {
            s.running = false;
            setRunning(false);
            setGameOver(true);
            setBest((b) => Math.max(b, Math.floor(s.distance)));
          }
        }
        // gradually speed up
        s.speed += dt * 0.25;
        setScore(Math.floor(s.distance));
      }

      // draw obstacles (sorted far->near)
      const sorted = [...s.obstacles].sort((a, b) => b.z - a.z);
      for (const o of sorted) {
        if (o.z > 1) continue;
        const p = project(o.x, Math.max(0, o.z), w, h);
        const size = 60 * p.scale;
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(p.px, p.py + size * 0.45, size * 0.6, size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // box obstacle
        ctx.fillStyle = "oklch(0.55 0.18 25)";
        ctx.fillRect(p.px - size * 0.5, p.py - size, size, size);
        ctx.fillStyle = "oklch(0.7 0.18 25)";
        ctx.fillRect(p.px - size * 0.5, p.py - size, size, size * 0.18);
        ctx.strokeStyle = "oklch(0.25 0.05 25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.px - size * 0.5, p.py - size, size, size);
      }

      // draw ball (near z = 0)
      const bp = project(s.ballX, 0, w, h);
      const br = 38;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(bp.px, bp.py + br * 0.2, br * 0.9, br * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // ball gradient
      const bg = ctx.createRadialGradient(bp.px - br * 0.35, bp.py - br * 1.1, br * 0.2, bp.px, bp.py - br * 0.7, br);
      bg.addColorStop(0, "oklch(0.95 0.12 60)");
      bg.addColorStop(1, ballColor);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bp.px, bp.py - br * 0.7, br, 0, Math.PI * 2);
      ctx.fill();
      // rotation stripe
      ctx.save();
      ctx.translate(bp.px, bp.py - br * 0.7);
      ctx.rotate(s.ballRot);
      ctx.strokeStyle = "oklch(0.2 0.05 60)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, br * 0.7, 0, Math.PI);
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">Ball Rolling on the Road — Endless Runner</h1>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-4">
        <div className="rounded-xl bg-black/30 px-4 py-2 backdrop-blur-md">
          <div className="text-xs uppercase tracking-widest opacity-70">Score</div>
          <div className="text-2xl font-bold tabular-nums">{score}</div>
        </div>
        <div className="rounded-xl bg-black/30 px-4 py-2 backdrop-blur-md text-right">
          <div className="text-xs uppercase tracking-widest opacity-70">Best</div>
          <div className="text-2xl font-bold tabular-nums">{best}</div>
        </div>
      </div>

      {/* Touch controls */}
      <div className="absolute inset-x-0 bottom-0 flex select-none gap-3 p-4">
        <button
          onClick={() => move(-1)}
          className="flex-1 rounded-2xl bg-white/10 py-6 text-3xl font-bold backdrop-blur-md active:scale-95 transition-transform"
          aria-label="Move left"
        >
          ◀
        </button>
        <button
          onClick={() => move(1)}
          className="flex-1 rounded-2xl bg-white/10 py-6 text-3xl font-bold backdrop-blur-md active:scale-95 transition-transform"
          aria-label="Move right"
        >
          ▶
        </button>
      </div>

      {(!running || gameOver) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl bg-card/90 p-8 text-center shadow-2xl max-w-sm mx-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              {gameOver ? "Game Over" : "Ball on the Road"}
            </h2>
            <p className="mt-2 text-sm opacity-80">
              {gameOver
                ? `You rolled ${score} meters.`
                : "Dodge the crates. Roll as far as you can."}
            </p>
            <button
              onClick={start}
              className="mt-6 rounded-full bg-primary px-8 py-3 text-lg font-bold text-primary-foreground shadow-lg hover:scale-105 transition-transform"
            >
              {gameOver ? "Play Again" : "Start Rolling"}
            </button>
            <p className="mt-4 text-xs opacity-60">← → arrows or tap buttons</p>
          </div>
        </div>
      )}
    </main>
  );
}