import { useState, useEffect } from "react";
import { useShop } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Volume2, Vibrate, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getVolume,
  setVolume,
  getHapticIntensity,
  setHapticIntensity,
  sfx,
  haptic,
} from "@/lib/juice";

export function ShopSettings() {
  const { shop, setShop } = useShop();
  const [form, setForm] = useState(shop);
  const [volume, setVol] = useState(() => Math.round(getVolume() * 100));
  const [hapticLvl, setHap] = useState(() => Math.round(getHapticIntensity() * 100));
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const savePassword = async () => {
    if (newPw.length < 6) {
      toast.error("Password kam se kam 6 character ka ho");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) toast.error(error.message);
    else {
      setNewPw("");
      toast.success("Password set ho gaya ✅");
    }
  };

  useEffect(() => {
    setForm(shop);
  }, [shop]);

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: "name", label: "Shop Name" },
    { key: "addressLine1", label: "Address Line 1" },
    { key: "addressLine2", label: "Address Line 2" },
    { key: "phoneNumber", label: "Phone Number" },
    { key: "upiId", label: "UPI ID" },
    { key: "footerText", label: "Receipt Footer" },
  ];

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-2xl font-semibold">Shop Settings</h2>
      <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <Button
          onClick={() => {
            setShop(form);
            toast.success("Shop details saved");
          }}
        >
          Save
        </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Account password
        </h3>
        <p className="text-xs text-muted-foreground">
          OTP se login kiya hai aur password set nahi hai? Yahan naya password
          bana lein.
        </p>
        <div className="space-y-1">
          <Label htmlFor="acct-pw">New password</Label>
          <Input
            id="acct-pw"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        <Button onClick={savePassword} disabled={pwLoading}>
          {pwLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Set password
        </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-5">
        <h3 className="text-base font-semibold">Sound & Haptics</h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Sound volume
            </Label>
            <span className="text-sm text-muted-foreground tabular-nums">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => {
              const n = v[0];
              setVol(n);
              setVolume(n / 100);
            }}
            onValueCommit={() => sfx.match(2)}
          />
          <p className="text-xs text-muted-foreground">
            Game sounds ka volume. 0% = mute.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Vibrate className="h-4 w-4 text-primary" />
              Haptic intensity
            </Label>
            <span className="text-sm text-muted-foreground tabular-nums">{hapticLvl}%</span>
          </div>
          <Slider
            value={[hapticLvl]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => {
              const n = v[0];
              setHap(n);
              setHapticIntensity(n / 100);
            }}
            onValueCommit={() => haptic([20, 40, 30])}
          />
          <p className="text-xs text-muted-foreground">
            Phone vibration strength (sirf mobile par kaam karega).
          </p>
        </div>
      </div>
    </div>
  );
}
