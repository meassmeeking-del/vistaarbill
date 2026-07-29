import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, KeyRound } from "lucide-react";
import {
  sendPhoneOtp,
  confirmPhoneOtp,
  checkAccountExists,
  phoneOtpLogin,
  phoneOtpResetPassword,
} from "@/lib/otp.functions";

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
  const [tab, setTab] = useState<"signin" | "signup" | "otp">("signin");
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

  // OTP login / password reset tab
  const [otpMode, setOtpMode] = useState<"login" | "reset">("login");
  const [rPhone, setRPhone] = useState("");
  const [rOtp, setROtp] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rSent, setRSent] = useState(false);
  const [rLoading, setRLoading] = useState(false);

  const onSendOtp = async () => {
    const parsed = signUpSchema.shape.phone.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setOtpLoading(true);
    try {
      const taken = await checkAccountExists({ data: { phone } });
      if (taken.phoneTaken) {
        toast.error(
          "Ye mobile number pehle se registered hai — OTP se login karein",
        );
        setTab("otp");
        setRPhone(phone);
        return;
      }
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

  const onSendResetOtp = async () => {
    if (!/^(\+?\d{10,15})$/.test(rPhone.trim())) {
      toast.error("Valid mobile number daalein");
      return;
    }
    setRLoading(true);
    try {
      const exists = await checkAccountExists({ data: { phone: rPhone } });
      if (!exists.phoneTaken) {
        toast.error("Is number se koi account nahi mila — pehle sign up karein");
        return;
      }
      await sendPhoneOtp({ data: { phone: rPhone } });
      setRSent(true);
      toast.success("OTP bhej diya gaya");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP bhejne me problem");
    } finally {
      setRLoading(false);
    }
  };

  const onOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rOtp.trim().length < 4) {
      toast.error("OTP daalein");
      return;
    }
    setRLoading(true);
    try {
      if (otpMode === "login") {
        const res = await phoneOtpLogin({
          data: { phone: rPhone, code: rOtp },
        });
        const { error } = await supabase.auth.verifyOtp({
          token_hash: res.token_hash,
          type: "magiclink",
        });
        if (error) throw new Error(error.message);
        toast.success("Login ho gaya ✅ Settings me jakar password set karein");
      } else {
        if (rPassword.length < 6) {
          toast.error("Naya password kam se kam 6 character ka ho");
          return;
        }
        await phoneOtpResetPassword({
          data: { phone: rPhone, code: rOtp, password: rPassword },
        });
        toast.success("Password set ho gaya — ab sign in karein");
        setTab("signin");
        setRSent(false);
        setROtp("");
        setRPassword("");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "OTP galat hai";
      toast.error(m.includes("galat") ? "OTP wrong hai ❌" : m);
    } finally {
      setRLoading(false);
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
    try {
      const taken = await checkAccountExists({
        data: { email: parsed.data.email, phone: parsed.data.phone },
      });
      if (taken.emailTaken) {
        setLoading(false);
        toast.error("Ye email pehle se registered hai — sign in karein");
        return;
      }
      if (taken.phoneTaken) {
        setLoading(false);
        toast.error("Ye mobile number pehle se registered hai");
        return;
      }
    } catch {
      /* ignore check failure, signUp will still error out */
    }
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
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "signin" | "signup" | "otp")}
      >
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
          <TabsTrigger value="otp">OTP login</TabsTrigger>
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
            <button
              type="button"
              onClick={() => {
                setOtpMode("reset");
                setTab("otp");
              }}
              className="w-full text-sm text-muted-foreground underline"
            >
              Password bhool gaye? OTP se reset karein
            </button>
          </form>
        </TabsContent>

        <TabsContent value="otp">
          <form onSubmit={onOtpSubmit} className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={otpMode === "login" ? "default" : "outline"}
                onClick={() => setOtpMode("login")}
              >
                <Smartphone className="h-4 w-4 mr-2" /> OTP se login
              </Button>
              <Button
                type="button"
                variant={otpMode === "reset" ? "default" : "outline"}
                onClick={() => setOtpMode("reset")}
              >
                <KeyRound className="h-4 w-4 mr-2" /> Password reset
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="r-phone">Registered mobile number</Label>
              <div className="flex gap-2">
                <Input
                  id="r-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="9876543210"
                  value={rPhone}
                  onChange={(e) => {
                    setRPhone(e.target.value);
                    setRSent(false);
                  }}
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onSendResetOtp}
                  disabled={rLoading || !rPhone}
                >
                  {rLoading && !rSent && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {rSent ? "Resend" : "Send OTP"}
                </Button>
              </div>
            </div>

            {rSent && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="r-otp">OTP</Label>
                  <Input
                    id="r-otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    value={rOtp}
                    onChange={(e) =>
                      setROtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
                {otpMode === "reset" && (
                  <div className="space-y-1">
                    <Label htmlFor="r-pw">New password</Label>
                    <Input
                      id="r-pw"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={rPassword}
                      onChange={(e) => setRPassword(e.target.value)}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={rLoading}>
                  {rLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {otpMode === "login" ? "Login" : "Set new password"}
                </Button>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Jinka password set nahi hai woh OTP se login karke Settings →
              Account me password bana sakte hain.
            </p>
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
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="su-phone" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Mobile number (OTP verify)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="su-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="9876543210"
                  value={phone}
                  disabled={otpVerified}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setOtpSent(false);
                    setOtpVerified(false);
                  }}
                  required
                />
                {!otpVerified && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onSendOtp}
                    disabled={otpLoading || !phone}
                  >
                    {otpLoading && !otpSent && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {otpSent ? "Resend" : "Send OTP"}
                  </Button>
                )}
              </div>

              {otpVerified ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <ShieldCheck className="h-4 w-4" /> Number verified
                </p>
              ) : (
                otpSent && (
                  <div className="flex gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                    <Button
                      type="button"
                      onClick={onVerifyOtp}
                      disabled={otpLoading || otp.length < 4}
                    >
                      {otpLoading && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Verify
                    </Button>
                  </div>
                )
              )}
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
