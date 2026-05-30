import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AuthForm } from "./AuthForm";
import { ShoppingCart } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 bg-background/10 backdrop-blur-3xl" />
        <div className="relative w-full max-w-md space-y-6 bg-card/95 backdrop-blur-xl rounded-2xl p-8 border shadow-2xl">
          <div className="text-center space-y-3">
            <div
              className="inline-flex items-center justify-center h-14 w-14 rounded-2xl text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              <ShoppingCart className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">VistaarBill</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to manage your shop
            </p>
          </div>
          <AuthForm />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
