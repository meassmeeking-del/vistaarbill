import { useSales } from "@/lib/pos-store";

export function SalesHistory() {
  const { sales } = useSales();
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Sales History</h2>
        <div className="rounded-lg border bg-card text-card-foreground px-4 py-2 text-sm">
          <span className="text-muted-foreground">Total Revenue: </span>
          <span className="font-bold">₹{totalRevenue.toFixed(2)}</span>
          <span className="text-muted-foreground ml-3">Sales: </span>
          <span className="font-bold">{sales.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {sales.length === 0 && (
          <p className="text-muted-foreground text-sm">No sales yet.</p>
        )}
        {sales.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border bg-card text-card-foreground p-4"
          >
            <div className="flex flex-wrap justify-between text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                #{s.id.slice(0, 8)}
              </span>
              <span className="text-muted-foreground">
                {new Date(s.date).toLocaleString()}
              </span>
            </div>
            <ul className="mt-2 text-sm space-y-1">
              {s.items.map((c) => (
                <li key={c.product.id} className="flex justify-between">
                  <span>
                    {c.product.name} × {c.quantity}
                  </span>
                  <span>₹{(c.product.price * c.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>₹{s.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
