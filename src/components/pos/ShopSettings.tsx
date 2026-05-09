import { useState, useEffect } from "react";
import { useShop } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ShopSettings() {
  const { shop, setShop } = useShop();
  const [form, setForm] = useState(shop);

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
    </div>
  );
}
