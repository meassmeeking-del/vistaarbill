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
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");

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
      toast.error(error.message);
    } else {
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
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          display_name: parsed.data.displayName,
          shop_name: parsed.data.shopName,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created — check your email to confirm");
      setTab("signin");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={onSignIn} className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="si-email">Email</Label>
              <Input
                id="si-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="si-pw">Password</Label>
              <Input
                id="si-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={onSignUp} className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="su-name">Your name</Label>
              <Input
                id="su-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-shop">Shop name (optional)</Label>
              <Input
                id="su-shop"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-email">Email</Label>
              <Input
                id="su-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="su-pw">Password</Label>
              <Input
                id="su-pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
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
