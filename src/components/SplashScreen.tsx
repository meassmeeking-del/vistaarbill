import { useEffect, useState } from "react";
import { ShoppingCart, Sparkles } from "lucide-react";

const SEEN_KEY = "vb:splash:seen";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Show every session open, but only once per tab session
    if (typeof window !== "undefined" && sessionStorage.getItem(SEEN_KEY)) {
      setShow(false);
      return;
    }
    const t1 = setTimeout(() => setFade(true), 1600);
    const t2 = setTimeout(() => {
      setShow(false);
      if (typeof window !== "undefined") sessionStorage.setItem(SEEN_KEY, "1");
    }, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <>
      {children}
      {show && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
            fade ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ background: "var(--gradient-hero)" }}
        >
          {/* Floating sparkles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 14 }).map((_, i) => (
              <Sparkles
                key={i}
                className="absolute text-white/40 splash-float"
                style={{
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 53) % 100}%`,
                  width: 14 + (i % 4) * 6,
                  height: 14 + (i % 4) * 6,
                  animationDelay: `${(i % 6) * 0.25}s`,
                  animationDuration: `${3 + (i % 4)}s`,
                }}
              />
            ))}
          </div>

          {/* Pulsing ring */}
          <div className="absolute h-64 w-64 rounded-full bg-white/10 splash-pulse-ring" />
          <div className="absolute h-44 w-44 rounded-full bg-white/15 splash-pulse-ring [animation-delay:0.3s]" />

          <div className="relative flex flex-col items-center gap-4">
            <div
              className="h-24 w-24 rounded-3xl bg-white/95 flex items-center justify-center shadow-2xl splash-pop"
              style={{ boxShadow: "0 20px 60px -10px rgba(0,0,0,0.4)" }}
            >
              <ShoppingCart className="h-12 w-12 text-primary splash-cart" />
            </div>
            <div className="text-center splash-rise">
              <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
                VistaarBill
              </h1>
              <p className="mt-1 text-sm text-white/85 font-medium">
                Fast • Smart • Simple
              </p>
            </div>
            <div className="mt-4 flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/90 splash-dot" />
              <span className="h-2 w-2 rounded-full bg-white/90 splash-dot [animation-delay:0.15s]" />
              <span className="h-2 w-2 rounded-full bg-white/90 splash-dot [animation-delay:0.3s]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}