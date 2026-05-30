import { useMemo, useState } from "react";
import { useProducts, useShop, useSales, type CartItem, type Sale } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Minus, Plus, Trash2, Receipt, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Receipt as ReceiptView } from "./Receipt";
import { BarcodeScanner } from "./BarcodeScanner";
import { ReceiptPreview } from "./ReceiptPreview";

export function Checkout() {
  const { products, updateProduct, addProduct } = useProducts();
  const { shop } = useShop();
  const { addSale } = useSales();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [taxPct, setTaxPct] = useState("0");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{
    open: boolean;
    barcode: string;
    name: string;
    price: string;
    saveToCatalog: boolean;
  }>({ open: false, barcode: "", name: "", price: "", saveToCatalog: true });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 12);
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q),
    );
  }, [products, search]);

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const existing = cart.find((c) => c.product.id === productId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.product.id === productId ? { ...c, quantity: c.quantity + 1 } : c,
        ),
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const changeQty = (productId: string, delta: number) => {
    setCart(
      cart
        .map((c) =>
          c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeItem = (productId: string) =>
    setCart(cart.filter((c) => c.product.id !== productId));

  const subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const tax = (subtotal * (parseFloat(taxPct) || 0)) / 100;
  const total = subtotal + tax;

  const onScanEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = search.trim();
    if (!q) return;
    const match =
      products.find((p) => p.barcode === q) ||
      products.find((p) => p.name.toLowerCase() === q.toLowerCase());
    if (match) {
      addToCart(match.id);
      setSearch("");
    } else {
      toast.error("No product found");
    }
  };

  const handleScanned = (code: string) => {
    const match = products.find((p) => p.barcode === code);
    if (match) {
      addToCart(match.id);
      toast.success(`Added: ${match.name}`);
    } else {
      setQuickAdd({
        open: true,
        barcode: code,
        name: "",
        price: "",
        saveToCatalog: true,
      });
    }
  };

  const confirmQuickAdd = () => {
    const price = parseFloat(quickAdd.price);
    if (!price || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    const name = quickAdd.name.trim() || `Item ${quickAdd.barcode.slice(-4)}`;
    const product = {
      id: crypto.randomUUID(),
      name,
      barcode: quickAdd.barcode,
      price,
      stock: quickAdd.saveToCatalog ? 1 : 0,
    };
    if (quickAdd.saveToCatalog) {
      addProduct({ name, barcode: quickAdd.barcode, price, stock: 1 });
    }
    setCart((prev) => [...prev, { product, quantity: 1 }]);
    toast.success(`Added: ${name} · ₹${price.toFixed(2)}`);
    setQuickAdd({ open: false, barcode: "", name: "", price: "", saveToCatalog: true });
  };

  const finalizeSale = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      items: cart,
      subtotal,
      tax,
      total,
    };
    addSale(sale);
    cart.forEach((c) =>
      updateProduct(c.product.id, {
        stock: Math.max(0, c.product.stock - c.quantity),
      }),
    );
    setLastSale(sale);
    setCart([]);
    setPreviewOpen(true);
    toast.success("Sale recorded");
  };


  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px] print:hidden mt-4 sm:mt-0">
        <div className="space-y-3">
          <div className="flex gap-2 rounded-xl bg-card border p-2 shadow-sm">
            <Input
              autoFocus
              placeholder="Scan barcode or search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onScanEnter}
              className="border-0 focus-visible:ring-0 shadow-none h-10"
            />
            <Button
              onClick={() => setScannerOpen(true)}
              className="h-10"
              style={{ background: "var(--gradient-primary)" }}
            >
              <ScanLine className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p.id)}
                className="group rounded-xl border bg-card text-card-foreground p-3 text-left hover:border-primary hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                  {p.name}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">₹{p.price.toFixed(2)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      p.stock <= 3 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.stock} left
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                No products. Add items in Products tab.
              </p>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border bg-card text-card-foreground p-4 space-y-3 h-fit shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Cart
            </h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {cart.length} items
            </span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {cart.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Cart is empty</p>
              </div>
            )}
            {cart.map((c) => (
              <div
                key={c.product.id}
                className="flex items-center gap-1 border-b pb-2 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{c.product.price.toFixed(2)} × {c.quantity} = ₹
                    {(c.product.price * c.quantity).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center bg-muted rounded-lg">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(c.product.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-semibold w-5 text-center">{c.quantity}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(c.product.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => removeItem(c.product.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="tax" className="text-xs">
              Tax %
            </Label>
            <Input
              id="tax"
              type="number"
              className="h-8"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
              <span>Total</span>
              <span className="text-primary">₹{total.toFixed(2)}</span>
            </div>
          </div>
          <Button
            className="w-full h-11 text-base font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={finalizeSale}
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
          >
            <Receipt className="mr-2 h-4 w-4" /> Checkout · ₹{total.toFixed(2)}
          </Button>
          {lastSale && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPreviewOpen(true)}
            >
              View Last Receipt
            </Button>
          )}
        </aside>
      </div>

      {lastSale && <ReceiptView sale={lastSale} shop={shop} />}
      <ReceiptPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        sale={lastSale}
        shop={shop}
      />
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanned}
      />
      <Dialog
        open={quickAdd.open}
        onOpenChange={(o) => setQuickAdd((q) => ({ ...q, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New item — enter price</DialogTitle>
            <DialogDescription>
              Barcode <span className="font-mono">{quickAdd.barcode}</span> not in catalog.
              Enter the price to add it to the cart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qa-name">Name (optional)</Label>
              <Input
                id="qa-name"
                placeholder="e.g. Biscuit"
                value={quickAdd.name}
                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qa-price">Price ₹</Label>
              <Input
                id="qa-price"
                type="number"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                value={quickAdd.price}
                onChange={(e) => setQuickAdd({ ...quickAdd, price: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmQuickAdd();
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quickAdd.saveToCatalog}
                onChange={(e) =>
                  setQuickAdd({ ...quickAdd, saveToCatalog: e.target.checked })
                }
              />
              Save to product catalog for next time
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setQuickAdd({
                  open: false,
                  barcode: "",
                  name: "",
                  price: "",
                  saveToCatalog: true,
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={confirmQuickAdd}>Add to cart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
