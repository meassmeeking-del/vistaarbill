import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(1, "Name required").max(100),
  shopName: z.string().trim().max(100).optional(),
});

export function AuthForm() {
  const [tab, setTab] = useState<"signin" | "signup" | "reset">("signin");
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      const isBanned =
        msg.includes("banned") ||
        msg.includes("blocked") ||
        msg.includes("disabled") ||
        (error as { code?: string }).code === "user_banned";
      setBanned(isBanned);
      toast.error(isBanned ? "Your account is banned. Please contact admin." : error.message);
    } else {
      setBanned(false);
      toast.success("Signed in");
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({
      email,
      password,
      displayName,
      shopName: shopName || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: parsed.data.displayName,
            shop_name: parsed.data.shopName,
          },
        },
      });
      if (error) throw error;
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error("Ye email pehle se registered hai — sign in karein");
        setTab("signin");
        return;
      }
      if (data.session) {
        toast.success("Account created — aap sign in ho gaye");
      } else {
        toast.success("Account created — email confirm karke sign in karein");
        setTab("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account create nahi hua");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.shape.email.safeParse(resetEmail);
    if (!parsed.success) {
      toast.error("Valid email daalein");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
    toast.success("Reset link email par bhej diya ✅");
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup" | "reset")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          {banned && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-semibold">🚫 You are banned</div>
              <div className="mt-1 text-destructive/90">
                Your account has been banned by the admin. Please contact admin to restore access.
                <br />
                <span className="font-medium">Admin:</span>{" "}
                <a href="mailto:rajpandey565758@gmail.com" className="underline">
                  rajpandey565758@gmail.com
                </a>
              </div>
            </div>
          )}
          <form onSubmit={onSignIn} className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="si-email">Email</Label>
              <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="si-pw">Password</Label>
              <Input id="si-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetSent(false);
                setTab("reset");
              }}
              className="w-full text-sm text-muted-foreground underline"
            >
              Password bhool gaye? Email se reset karein
            </button>
          </form>
        </TabsContent>

        <TabsContent value="reset">
          <form onSubmit={onReset} className="space-y-3 mt-4">
            <div className="text-sm font-semibold">Password reset (Email se)</div>
            <div className="space-y-1">
              <Label htmlFor="r-email">Registered email</Label>
              <Input id="r-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send reset link
            </Button>
            {resetSent && (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-sm text-primary">
                ✅ Reset link {resetEmail} par bheja gaya — email check karein
              </div>
            )}
            <button type="button" onClick={() => setTab("signin")} className="w-full text-sm text-muted-foreground underline">
              Back to sign in
            </button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={onSignUp} className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="su-name">Your name</Label>
              <Input id="su-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-shop">Shop name (optional)</Label>
              <Input id="su-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-email">Email</Label>
              <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-pw">Password</Label>
              <Input id="su-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create account
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
