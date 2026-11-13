import { useState } from "react";
import { Banknote, Minus, Plus, QrCode, Share2, Trash2, UserRound, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReceiptPreview } from "./ReceiptPreview";
import { useSales, useShop, type CartItem, type PaymentMode, type Sale } from "@/lib/pos-store";

export function QuickBill() {
  const { shop } = useShop();
  const { addSale } = useSales();
  const [items, setItems] = useState<CartItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = (subtotal * (Number(taxPercent) || 0)) / 100;
  const total = subtotal + tax;

  const addItem = () => {
    const name = itemName.trim();
    const price = Number(itemPrice);
    const quantity = Number(itemQuantity);
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      toast.error("Product name, valid price aur quantity daalein");
      return;
    }
    const product = { id: crypto.randomUUID(), name, barcode: "", price, stock: 0 };
    setItems((current) => [...current, { product, quantity }]);
    setItemName("");
    setItemPrice("");
    setItemQuantity("1");
  };

  const changeQuantity = (id: string, delta: number) => {
    setItems((current) => current
      .map((item) => item.product.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const createBill = async () => {
    if (items.length === 0) {
      toast.error("Pehle kam se kam ek product add karein");
      return;
    }
    const parsedTax = Number(taxPercent);
    if (!Number.isFinite(parsedTax) || parsedTax < 0) {
      toast.error("Valid tax percentage daalein");
      return;
    }
    if (paymentMode === "online" && !shop.upiId.trim()) {
      toast.error("Online QR ke liye pehle Settings mein UPI ID bharein");
      return;
    }

    let qrDataUrl: string | undefined;
    if (paymentMode === "online") {
      const upiLink = `upi://pay?pa=${encodeURIComponent(shop.upiId.trim())}`
        + `&pn=${encodeURIComponent(shop.name || "Shop")}`
        + `&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Bill payment")}`;
      try {
        const QR = await import("qrcode");
        qrDataUrl = await QR.toDataURL(upiLink, { margin: 1, width: 320 });
      } catch {
        toast.error("Payment QR nahi ban paya");
        return;
      }
    }

    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      items,
      subtotal,
      tax: (subtotal * parsedTax) / 100,
      total: subtotal + (subtotal * parsedTax) / 100,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMode,
      qrDataUrl,
    };
    addSale(sale);
    setLastSale(sale);
    setPreviewOpen(true);
    setItems([]);
    setCustomerName("");
    setCustomerPhone("");
    toast.success("Bill ban gaya — ab WhatsApp par share karein");
  };

  return (
    <>
      <div className="mt-4 space-y-6 sm:mt-0 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-sm font-medium text-primary">Quick Bill</p>
            <h2 className="mt-1 text-2xl font-semibold">Customer ka bill banayein</h2>
          </div>
          <p className="text-sm text-muted-foreground">Catalog ya stock badle bina seedha bill banayein</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-customer-name">Customer name</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="quick-customer-name" className="pl-9" placeholder="Customer ka naam" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-customer-phone">WhatsApp number (optional)</Label>
                <Input id="quick-customer-phone" type="tel" inputMode="tel" placeholder="98765 43210" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Products bought</h3>
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_auto]">
                <div className="space-y-2">
                  <Label htmlFor="quick-item-name">Product</Label>
                  <Input id="quick-item-name" placeholder="Product ka naam" value={itemName} onChange={(event) => setItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addItem(); } }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-item-price">Price (₹)</Label>
                  <Input id="quick-item-price" type="number" min="0.01" step="0.01" placeholder="0.00" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-item-quantity">Quantity</Label>
                  <Input id="quick-item-quantity" type="number" min="1" step="1" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} />
                </div>
                <Button type="button" className="h-10" onClick={addItem} aria-label="Add product">
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            <div className="divide-y border-y">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Product ka naam aur price likhkar Add karein
                </div>
              ) : items.map((item) => (
                <div key={item.product.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">₹{item.product.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Decrease ${item.product.name} quantity`} onClick={() => changeQuantity(item.product.id, -1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Increase ${item.product.name} quantity`} onClick={() => changeQuantity(item.product.id, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-24 text-right font-semibold">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${item.product.name}`} onClick={() => setItems((current) => current.filter((entry) => entry.product.id !== item.product.id))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="h-fit space-y-4 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Bill total</h3>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="quick-tax">Tax %</Label>
              <Input id="quick-tax" className="w-24" type="number" min="0" step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={paymentMode === "cash" ? "default" : "outline"} onClick={() => setPaymentMode("cash")}>
                <Banknote className="mr-1.5 h-4 w-4" /> Cash
              </Button>
              <Button type="button" variant={paymentMode === "online" ? "default" : "outline"} onClick={() => setPaymentMode("online")}>
                <QrCode className="mr-1.5 h-4 w-4" /> Online
              </Button>
            </div>
            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>₹{tax.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
            </div>
            <Button type="button" className="w-full" size="lg" onClick={() => void createBill()}>
              <Share2 className="mr-2 h-4 w-4" /> Create bill & share
            </Button>
            <p className="text-xs text-muted-foreground">
              {paymentMode === "online" ? "Bill mein exact amount ka UPI QR lagega." : "Bill banne ke baad preview se WhatsApp share karein."}
            </p>
          </aside>
        </div>
      </div>

      <ReceiptPreview open={previewOpen} onOpenChange={setPreviewOpen} sale={lastSale} shop={shop} />
    </>
  );
}