import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManager } from "./ProductManager";
import { Checkout } from "./Checkout";
import { ShopSettings } from "./ShopSettings";
import { SalesHistory } from "./SalesHistory";
import { Games } from "./Games";
import { Toaster } from "@/components/ui/sonner";
import { ShoppingCart, Package, History, Settings, LogOut, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useShop, useSales, useProducts } from "@/lib/pos-store";

export function POSApp() {
  const { shop } = useShop();
  const { sales } = useSales();
  const { products } = useProducts();
  const today = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.date).toDateString() === today);
  const todayTotal = todaySales.reduce((s, x) => s + x.total, 0);
  const lowStock = products.filter((p) => p.stock <= 3).length;
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="text-primary-foreground shadow-lg print:hidden"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight tracking-tight truncate">
                {shop?.name || "VistaarBill"}
              </h1>
              <p className="text-xs text-white/80 leading-tight">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Today</div>
              <div className="text-base font-bold">₹{todayTotal.toFixed(0)}</div>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Bills</div>
              <div className="text-base font-bold">{todaySales.length}</div>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Low stock</div>
              <div className="text-base font-bold">{lowStock}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-4 pb-24 sm:pb-6">
        <Tabs defaultValue="checkout" className="print:hidden">
          <TabsList className="hidden sm:grid grid-cols-4 w-full max-w-2xl bg-card border shadow-sm rounded-xl p-1 h-auto">
            <TabsTrigger value="checkout" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <ShoppingCart className="h-4 w-4 mr-2" /> Checkout
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Package className="h-4 w-4 mr-2" /> Products
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <History className="h-4 w-4 mr-2" /> Sales
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Settings className="h-4 w-4 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>
          <div className="sm:mt-6">
            <TabsContent value="checkout">
              <Checkout />
            </TabsContent>
            <TabsContent value="products">
              <ProductManager />
            </TabsContent>
            <TabsContent value="sales">
              <SalesHistory />
            </TabsContent>
            <TabsContent value="settings">
              <ShopSettings />
            </TabsContent>
          </div>

          {/* Mobile bottom nav */}
          <TabsList className="sm:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 bg-card/95 backdrop-blur border-t rounded-none h-16 p-1">
            <TabsTrigger value="checkout" className="flex-col gap-0.5 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-[10px]">Bill</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-col gap-0.5 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <Package className="h-5 w-5" />
              <span className="text-[10px]">Items</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex-col gap-0.5 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <History className="h-5 w-5" />
              <span className="text-[10px]">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-col gap-0.5 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              <Settings className="h-5 w-5" />
              <span className="text-[10px]">Setup</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}
