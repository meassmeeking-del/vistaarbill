import { useEffect, useState } from "react";

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
};

export type Sale = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
};

const PRODUCTS_KEY = "pos.products";
const SHOP_KEY = "pos.shop";
const SALES_KEY = "pos.sales";

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

export const defaultShop: Shop = {
  name: "My Shop",
  addressLine1: "",
  addressLine2: "",
  phoneNumber: "",
  upiId: "",
  footerText: "Thank you, visit again!",
};

const seedProducts: Product[] = [
  { id: "p1", name: "Coca-Cola 500ml", barcode: "8901234567890", price: 40, stock: 24 },
  { id: "p2", name: "Lays Classic", barcode: "8901234567891", price: 20, stock: 50 },
  { id: "p3", name: "Parle-G Biscuit", barcode: "8901234567892", price: 10, stock: 100 },
];

function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (!detail || detail.key === key) {
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
  return { shop, setShop };
}

export function useSales() {
  const [sales, setSales] = useStored<Sale[]>(SALES_KEY, []);
  const addSale = (s: Sale) => setSales([s, ...sales]);
  const updateSale = (id: string, patch: Partial<Sale>) =>
    setSales(sales.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return { sales, addSale, updateSale };
}
