import type { Sale, Shop } from "@/lib/pos-store";

export function Receipt({ sale, shop }: { sale: Sale; shop: Shop }) {
  return (
    <div className="hidden print:block print:text-black print:bg-white p-4 font-mono text-sm max-w-xs mx-auto">
      <div className="text-center">
        <div className="font-bold text-base">{shop.name || "My Shop"}</div>
        {shop.addressLine1 && <div>{shop.addressLine1}</div>}
        {shop.addressLine2 && <div>{shop.addressLine2}</div>}
        {shop.phoneNumber && <div>Ph: {shop.phoneNumber}</div>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between text-xs">
        <span>{new Date(sale.date).toLocaleString()}</span>
        <span>#{sale.id.slice(0, 6)}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((c) => (
            <tr key={c.product.id}>
              <td className="text-left">{c.product.name}</td>
              <td className="text-right">{c.quantity}</td>
              <td className="text-right">
                ₹{(c.product.price * c.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>₹{sale.subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span>Tax</span>
        <span>₹{sale.tax.toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>₹{sale.total.toFixed(2)}</span>
      </div>
      {shop.upiId && (
        <div className="text-center mt-2 text-xs">UPI: {shop.upiId}</div>
      )}
      <div className="text-center mt-3 text-xs">
        {shop.footerText || "Thank you!"}
      </div>
    </div>
  );
}
