import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  price: number;
  stock: number;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type Shop = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phoneNumber: string;
  upiId: string;
  footerText: string;
  smsEnabled: boolean;
  smsDefaultNumber: string;
};

export type PaymentMode = "cash" | "online";

export type Sale = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  paymentMode?: PaymentMode;
  /** UPI QR (data URL) generated for this bill's exact amount — online only */
  qrDataUrl?: string;
};


const PRODUCTS_KEY = "pos.products";
const SHOP_KEY = "pos.shop";
const SALES_KEY = "pos.sales";
const OWNER_KEY = "pos.accountOwner";

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
};

const write = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pos:change", { detail: { key } }));
};

type PosSnapshot = {
  products: Product[];
  sales: Sale[];
  shop: Shop;
};

let activeUserId: string | null = null;
let syncPromise: Promise<void> | null = null;
let lastSyncedAt = 0;
let syncStarted = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let saveQueued = false;

const localSnapshot = (): PosSnapshot => ({
  products: read(PRODUCTS_KEY, seedProducts),
  sales: read(SALES_KEY, []),
  shop: { ...defaultShop, ...read(SHOP_KEY, defaultShop) },
});

const setLocalSnapshot = (snapshot: PosSnapshot, userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(snapshot.products));
  window.localStorage.setItem(SALES_KEY, JSON.stringify(snapshot.sales));
  window.localStorage.setItem(SHOP_KEY, JSON.stringify(snapshot.shop));
  window.localStorage.setItem(OWNER_KEY, userId);
  window.dispatchEvent(new CustomEvent("pos:change", { detail: { key: "*" } }));
};

const clearLocalSnapshot = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PRODUCTS_KEY);
  window.localStorage.removeItem(SALES_KEY);
  window.localStorage.removeItem(SHOP_KEY);
  window.localStorage.removeItem(OWNER_KEY);
  window.dispatchEvent(new CustomEvent("pos:change", { detail: { key: "*" } }));
};

const saveCloudData = () => {
  if (!activeUserId || saveTimer || saveInFlight) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushCloudData();
  }, 450);
};

const flushCloudData = async () => {
  if (!activeUserId) return;
  saveQueued = false;
  saveInFlight = true;
  const userId = activeUserId;
  const snapshot = localSnapshot();
  try {
    const { error } = await supabase.from("pos_data").upsert(
      {
        user_id: userId,
        products: snapshot.products,
        sales: snapshot.sales,
        shop: snapshot.shop,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  } catch (error) {
    console.error("POS data sync failed", error);
  } finally {
    saveInFlight = false;
    if (saveQueued) saveCloudData();
  }
};

const syncAccountData = async (force = false) => {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return;
    const userId = data.user.id;
    const now = Date.now();
    if (!force && activeUserId === userId && now - lastSyncedAt < 3000) return;
    activeUserId = userId;

    const { data: cloudRow, error } = await supabase
      .from("pos_data")
      .select("products, sales, shop")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    if (cloudRow) {
      setLocalSnapshot(
        {
          products: (cloudRow.products as unknown as Product[]) ?? seedProducts,
          sales: (cloudRow.sales as unknown as Sale[]) ?? [],
          shop: { ...defaultShop, ...((cloudRow.shop as unknown as Partial<Shop>) ?? {}) },
        },
        userId,
      );
    } else {
      const previousOwner = typeof window === "undefined" ? null : window.localStorage.getItem(OWNER_KEY);
      const snapshot = previousOwner && previousOwner !== userId
        ? { products: seedProducts, sales: [], shop: defaultShop }
        : localSnapshot();
      setLocalSnapshot(snapshot, userId);
      await supabase.from("pos_data").upsert(
        {
          user_id: userId,
          products: snapshot.products,
          sales: snapshot.sales,
          shop: snapshot.shop,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
    lastSyncedAt = Date.now();
  })()
    .catch((error) => {
      console.error("POS account data could not be loaded", error);
    })
    .finally(() => {
      syncPromise = null;
    });
  return syncPromise;
};

const startAccountSync = () => {
  if (syncStarted || typeof window === "undefined") return;
  syncStarted = true;
  void syncAccountData(true);
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "USER_UPDATED") {
      void syncAccountData(true);
    }
    if (event === "SIGNED_OUT") {
      activeUserId = null;
      lastSyncedAt = 0;
      clearLocalSnapshot();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncAccountData(true);
  });
};

export const defaultShop: Shop = {
  name: "My Shop",
  addressLine1: "",
  addressLine2: "",
  phoneNumber: "",
  upiId: "",
  footerText: "Thank you, visit again!",
  smsEnabled: false,
  smsDefaultNumber: "",
};

const seedProducts: Product[] = [
  { id: "p1", name: "Coca-Cola 500ml", barcode: "8901234567890", price: 40, stock: 24 },
  { id: "p2", name: "Lays Classic", barcode: "8901234567891", price: 20, stock: 50 },
  { id: "p3", name: "Parle-G Biscuit", barcode: "8901234567892", price: 10, stock: 100 },
];

function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    startAccountSync();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (!detail || detail.key === key || detail.key === "*") {
        setState(read(key, fallback));
      }
    };
    window.addEventListener("pos:change", handler);
    return () => window.removeEventListener("pos:change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = (v: T) => {
    write(key, v);
    setState(v);
    saveQueued = true;
    saveCloudData();
  };
  return [state, update];
}

export function useProducts() {
  const [products, setProducts] = useStored<Product[]>(PRODUCTS_KEY, seedProducts);
  const addProduct = (p: Omit<Product, "id">) =>
    setProducts([...products, { ...p, id: crypto.randomUUID() }]);
  const updateProduct = (id: string, patch: Partial<Product>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const deleteProduct = (id: string) => setProducts(products.filter((p) => p.id !== id));
  return { products, addProduct, updateProduct, deleteProduct };
}

export function useShop() {
  const [shop, setShop] = useStored<Shop>(SHOP_KEY, defaultShop);
  // Memoized so the returned object is referentially stable between renders
  // (an unstable object caused effects depending on `shop` to loop forever).
  const merged = useMemo(() => ({ ...defaultShop, ...shop }), [shop]);
  return { shop: merged, setShop };
}

export function useSales() {
  const [sales, setSales] = useStored<Sale[]>(SALES_KEY, []);
  const addSale = (s: Sale) => setSales([s, ...sales]);
  const updateSale = (id: string, patch: Partial<Sale>) =>
    setSales(sales.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return { sales, addSale, updateSale };
}
