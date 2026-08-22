import type { Sale, Shop } from "@/lib/pos-store";

/** Rupees -> Indian words (for the "Amount in words" line on the bill) */
function amountInWords(n: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
  const three = (x: number): string =>
    x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x);
  let num = Math.floor(Math.abs(n));
  if (num === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (num) parts.push(three(num));
  const paise = Math.round((Math.abs(n) - Math.floor(Math.abs(n))) * 100);
  return `${parts.join(" ")} Rupees${paise ? " and " + two(paise) + " Paise" : ""} Only`;
}

/** Simple CSS "barcode" derived from the bill id — no extra dependency */
function BarBars({ value }: { value: string }) {
  const seed = value.toUpperCase();
  const bars: number[] = [];
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    bars.push((c % 3) + 1, ((c >> 2) % 3) + 1, ((c >> 4) % 2) + 1);
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 30, justifyContent: "center" }}>
      {bars.map((w, i) => (
        <span
          key={i}
          style={{
            width: w,
            height: "100%",
            background: i % 2 === 0 ? "#000" : "transparent",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Thermal (58mm) grocery bill body — shared by the on-screen preview
 * and the actual printout. Long item lists are supported.
 */
export function ReceiptBody({ sale, shop }: { sale: Sale; shop: Shop }) {
  const qty = sale.items.reduce((s, c) => s + c.quantity, 0);
  const online = sale.paymentMode === "online";
  const saved = Math.max(0, sale.subtotal + sale.tax - sale.total);

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
      {saved > 0 && (
        <div className="text-center text-[10px] font-bold">
          YOU SAVED Rs {saved.toFixed(2)}
        </div>
      )}
      <div className="text-[9px] mt-1">
        In words: {amountInWords(sale.total)}
      </div>

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

      {!online && (
        <div className="text-center text-[9px] mt-1">Paid by CASH</div>
      )}

      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center mt-1">
        <BarBars value={sale.id.slice(0, 10)} />
        <div className="text-[8px] tracking-[2px] mt-[2px]">
          {sale.id.slice(0, 12).toUpperCase()}
        </div>
      </div>

      <div className="text-center text-[10px] mt-2 leading-snug">
        <div className="font-bold text-[11px]">HOW DID WE DO?</div>
        <div className="text-[9px]">
          {shop.phoneNumber
            ? `WhatsApp / Call: ${shop.phoneNumber}`
            : "Apni raay dukaan par batayein"}
        </div>
      </div>

      <div className="text-[9px] mt-2">
        <div>Customer Signature: ____________</div>
      </div>

      <div className="text-center text-[10px] mt-2 leading-snug">
        <div>{shop.footerText || "Dhanyavaad! Phir aayein 🙏"}</div>
        <div className="text-[9px]">Bill sambhal kar rakhein</div>
        <div className="text-[9px]">Exchange 7 din ke andar bill ke saath</div>
        <div className="text-[9px]">Goods once sold ki guarantee dukaan ke niyam ke anusaar</div>
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
