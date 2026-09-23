import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — VistaarBill" },
      { name: "description", content: "Set a new password for your VistaarBill account." },
      { property: "og:title", content: "Reset Password — VistaarBill" },
      { property: "og:description", content: "Set a new password for your VistaarBill account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password kam se kam 6 character ka ho");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Naya password set ho gaya ✅");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-bold">Naya password set karein</h1>
        <div className="space-y-1">
          <Label htmlFor="np">New password</Label>
          <Input id="np" type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>Save password</Button>
      </form>
    </div>
  );
}
