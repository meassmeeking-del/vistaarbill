import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { sendPhoneOtp, confirmPhoneOtp } from "@/lib/otp.functions";

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(1, "Name required").max(100),
  shopName: z.string().trim().max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?\d{10,15})$/, "Valid mobile number daalein"),
});

export function AuthForm() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const onSendOtp = async () => {
    const parsed = signUpSchema.shape.phone.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setOtpLoading(true);
    try {
      await sendPhoneOtp({ data: { phone } });
      setOtpSent(true);
      toast.success("OTP bhej diya gaya aapke number par");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP bhejne me problem");
    } finally {
      setOtpLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    setOtpLoading(true);
    try {
      await confirmPhoneOtp({ data: { phone, code: otp } });
      setOtpVerified(true);
      toast.success("Number verify ho gaya ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP galat hai");
    } finally {
      setOtpLoading(false);
    }
  };

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
        msg.includes("user is banned") ||
        (error as { code?: string }).code === "user_banned";
      if (isBanned) {
        setBanned(true);
        toast.error("Your account is banned. Please contact admin.");
      } else {
        setBanned(false);
        toast.error(error.message);
      }
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
      phone,
      shopName: shopName || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!otpVerified) {
      toast.error("Pehle mobile number OTP se verify karein");
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
          phone: parsed.data.phone,
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
          {banned && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-semibold">🚫 You are banned</div>
              <div className="mt-1 text-destructive/90">
                Your account has been banned by the admin. Please contact admin
                to restore access.
                <br />
                <span className="font-medium">Admin:</span>{" "}
                <a
                  href="mailto:rajpandey565758@gmail.com"
                  className="underline"
                >
                  rajpandey565758@gmail.com
                </a>
              </div>
            </div>
          )}
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
