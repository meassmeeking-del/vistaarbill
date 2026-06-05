import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, X, Send, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Namaste! 👋 Main VistaarBill Assistant hoon. Billing, products, sales ya GST — kuch bhi pucho!",
};

const QUICK = [
  "Naya product kaise add karu?",
  "Aaj ki sales kaise dekhu?",
  "GST kya hota hai?",
];

export function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askAssistant);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, connect nahi ho paya. Phir try karo." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Open AI assistant"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed z-50 right-4 bottom-20 sm:bottom-6 h-14 w-14 rounded-full",
          "flex items-center justify-center text-primary-foreground",
          "shadow-xl transition-transform active:scale-95 hover:scale-105",
          "print:hidden",
        )}
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "var(--shadow-glow), var(--shadow-elegant)",
        }}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-pink-400 animate-ping" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 right-3 left-3 sm:left-auto sm:right-6",
            "bottom-36 sm:bottom-24",
            "w-auto sm:w-[380px] max-h-[70vh]",
            "rounded-2xl border bg-card text-card-foreground shadow-2xl",
            "flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 print:hidden",
          )}
        >
          <div
            className="px-4 py-3 text-primary-foreground flex items-center gap-2"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">AI Assistant</div>
              <div className="text-[10px] text-white/80 leading-tight">Always here to help</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md hover:bg-white/20 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/30">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                    : "mr-auto bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-muted-foreground">Soch raha hoon…</span>
              </div>
            )}
            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-2 border-t flex items-center gap-2 bg-card"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Apna sawaal likho…"
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}