import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManager } from "./ProductManager";
import { Checkout } from "./Checkout";
import { ShopSettings } from "./ShopSettings";
import { SalesHistory } from "./SalesHistory";
import { Toaster } from "@/components/ui/sonner";
import { ShoppingCart, Package, History, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function POSApp() {
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold flex-1 tracking-tight">VistaarBill</h1>
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
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="checkout" className="print:hidden">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="checkout">
              <ShoppingCart className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Checkout</span>
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="sales">
              <History className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
          <div className="mt-6">
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
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}
