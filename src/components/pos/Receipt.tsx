import type { Sale, Shop } from "@/lib/pos-store";

/**
 * Thermal (58mm) grocery bill body — shared by the on-screen preview
 * and the actual printout. Long item lists are supported.
 */
export function ReceiptBody({ sale, shop }: { sale: Sale; shop: Shop }) {
  const qty = sale.items.reduce((s, c) => s + c.quantity, 0);
  const online = sale.paymentMode === "online";
  return (
    <div className="thermal-receipt">
      <div className="text-center leading-tight">
        <div className="font-bold text-[13px] uppercase tracking-wide">
          {shop.name || "My Shop"}
        </div>
        {shop.addressLine1 && <div className="text-[10px]">{shop.addressLine1}</div>}
        {shop.addressLine2 && <div className="text-[10px]">{shop.addressLine2}</div>}
        {shop.phoneNumber && <div className="text-[10px]">Ph: {shop.phoneNumber}</div>}
        <div className="text-[10px] mt-1">** RETAIL INVOICE **</div>
      </div>

      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px] flex justify-between">
        <span>Bill #{sale.id.slice(0, 6).toUpperCase()}</span>
        <span>{sale.paymentMode ? sale.paymentMode.toUpperCase() : "CASH"}</span>
      </div>
      <div className="text-[10px]">
        {new Date(sale.date).toLocaleString("en-IN")}
      </div>
      {sale.customerName && (
        <div className="text-[10px]">Cust: {sale.customerName}</div>
      )}
      {sale.customerPhone && (
        <div className="text-[10px]">Ph: {sale.customerPhone}</div>
      )}

      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px] flex font-bold">
        <span className="w-[14px]">#</span>
        <span className="flex-1">Item</span>
        <span className="w-[22px] text-right">Qty</span>
        <span className="w-[38px] text-right">Rate</span>
        <span className="w-[44px] text-right">Amt</span>
      </div>
      <div className="border-t border-black my-1" />

      {sale.items.map((c, i) => (
        <div key={c.product.id} className="text-[10px] flex">
          <span className="w-[14px]">{i + 1}</span>
          <span className="flex-1 pr-1 break-words">{c.product.name}</span>
          <span className="w-[22px] text-right">{c.quantity}</span>
          <span className="w-[38px] text-right">{c.product.price.toFixed(2)}</span>
          <span className="w-[44px] text-right">
            {(c.product.price * c.quantity).toFixed(2)}
          </span>
        </div>
      ))}

      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px] flex justify-between">
        <span>Items / Qty</span>
        <span>
          {sale.items.length} / {qty}
        </span>
      </div>
      <div className="text-[10px] flex justify-between">
        <span>Subtotal</span>
        <span>{sale.subtotal.toFixed(2)}</span>
      </div>
      <div className="text-[10px] flex justify-between">
        <span>Tax</span>
        <span>{sale.tax.toFixed(2)}</span>
      </div>
      <div className="border-t border-black my-1" />
      <div className="flex justify-between font-bold text-[12px]">
        <span>TOTAL</span>
        <span>Rs {sale.total.toFixed(2)}</span>
      </div>
      <div className="border-t border-black my-1" />

      {online && sale.qrDataUrl && (
        <div className="text-center mt-1">
          <div className="text-[10px] font-bold">SCAN &amp; PAY Rs {sale.total.toFixed(2)}</div>
          <img
            src={sale.qrDataUrl}
            alt="UPI payment QR"
            style={{ width: 120, height: 120, margin: "3px auto" }}
          />
          {shop.upiId && <div className="text-[9px]">UPI: {shop.upiId}</div>}
          <div className="text-[9px]">GPay · PhonePe · Paytm · BHIM</div>
        </div>
      )}

      {!online && shop.upiId && (
        <div className="text-center text-[9px] mt-1">Paid by CASH</div>
      )}

      <div className="text-center text-[10px] mt-2 leading-snug">
        <div>{shop.footerText || "Dhanyavaad! Phir aayein 🙏"}</div>
        <div className="text-[9px]">Bill sambhal kar rakhein</div>
        <div className="text-[9px]">Exchange 7 din ke andar bill ke saath</div>
        <div className="text-[9px] mt-1">-- VistaarBill --</div>
      </div>
    </div>
  );
}

export function Receipt({ sale, shop }: { sale: Sale; shop: Shop }) {
  return (
    <div className="hidden print:block print:text-black print:bg-white">
      <ReceiptBody sale={sale} shop={shop} />
    </div>
  );
}
