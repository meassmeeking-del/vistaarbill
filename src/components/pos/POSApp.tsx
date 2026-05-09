import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManager } from "./ProductManager";
import { Checkout } from "./Checkout";
import { ShopSettings } from "./ShopSettings";
import { SalesHistory } from "./SalesHistory";
import { Toaster } from "@/components/ui/sonner";
import { ShoppingCart, Package, History, Settings } from "lucide-react";

export function POSApp() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card text-card-foreground print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Mobile POS &amp; Billing</h1>
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
