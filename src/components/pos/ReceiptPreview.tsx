import { useRef, useState } from "react";
import { Receipt as ReceiptView } from "./Receipt";
import type { Sale, Shop } from "@/lib/pos-store";
import { useSales } from "@/lib/pos-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Download, Loader2, Share2, Check, User, Phone } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  shop: Shop;
};

export function ReceiptPreview({ open, onOpenChange, sale, shop }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [phone, setPhone] = useState(sale?.customerPhone ?? "");
  const [name, setName] = useState(sale?.customerName ?? "");
  const [feedback, setFeedback] = useState(true);
  const { updateSale } = useSales();

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const buildImageBlob = async (): Promise<Blob> => {
    const node = previewRef.current;
    if (!node) throw new Error("Receipt not ready");
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(node, {
      pixelRatio: 2.5,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    if (!blob) throw new Error("Image generation failed");
    return blob;
  };

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const blob = await buildImageBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${sale.id.slice(0, 6)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Image downloaded");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Image failed");
    } finally {
      setDownloading(false);
    }
  };

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return "91" + digits;
    return digits;
  };

  const handleWhatsAppShare = async () => {
    setSharing(true);
    try {
      const blob = await buildImageBlob();
      const filename = `receipt-${sale.id.slice(0, 6)}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      const cleanName = name.trim();
      const itemsList = sale.items
        .slice(0, 8)
        .map(
          (c) =>
            `• ${c.product.name} × ${c.quantity}  —  ₹${(
              c.product.price * c.quantity
            ).toFixed(2)}`,
        )
        .join("\n");
      const moreItems =
        sale.items.length > 8 ? `\n…+${sale.items.length - 8} aur items` : "";

      const greet = cleanName ? `Namaste *${cleanName}* 🙏` : `Namaste 🙏`;
      const feedbackBlock = feedback
        ? `\n━━━━━━━━━━━━━━━\n💬 *Aapka feedback?*\nReply karke 1 se 5 tak rating dein ⭐\nAapki raay humare liye anmol hai!\n`
        : "";

      const msg =
        `${greet}\n\n` +
        `🧾 *${shop.name || "My Shop"}*\n` +
        `🆔 Bill: *#${sale.id.slice(0, 6).toUpperCase()}*\n` +
        `📅 ${new Date(sale.date).toLocaleString("en-IN")}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🛒 *Aapke Items:*\n${itemsList}${moreItems}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 Subtotal: ₹${sale.subtotal.toFixed(2)}\n` +
        `🧮 Tax: ₹${sale.tax.toFixed(2)}\n` +
        `✅ *TOTAL: ₹${sale.total.toFixed(2)}*\n` +
        (shop.upiId ? `\n💳 UPI: ${shop.upiId}\n` : "") +
        `\n🙏 *${shop.footerText || "Dhanyavaad! Phir milenge."}*\n` +
        feedbackBlock +
        `\n_— Bhejke: ${shop.name || "My Shop"}${
          shop.phoneNumber ? " · 📞 " + shop.phoneNumber : ""
        }_`;

      // Persist customer info on the sale
      updateSale(sale.id, {
        customerName: cleanName || undefined,
        customerPhone: phone.trim() || undefined,
      });

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: ShareData & { files?: File[] }) => Promise<void>;
      };

      const num = normalizePhone(phone);

      // Always copy message to clipboard so user can paste as caption
      let copied = false;
      try {
        await navigator.clipboard.writeText(msg);
        copied = true;
      } catch {
        /* ignore */
      }

      // 1) Best path on mobile: native share sheet with the photo as a file +
      //    text pre-filled. User picks WhatsApp → contact → both go together.
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: msg, title: "Bill" });
          toast.success(
            cleanName ? `Bill ${cleanName} ko bhej diya 🎉` : "Bill share ho gaya 🎉",
          );
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
          // fall through to desktop flow
        }
      }

      // 2) Desktop / unsupported: download photo, then open WhatsApp chat
      //    WITHOUT text (wa.me text + image attach ek saath nahi hota — text
      //    bhej deta toh image attach option chhup jata). User photo attach
      //    kare aur clipboard se caption paste kare — dono saath jayenge.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      const waUrl = num ? `https://wa.me/${num}` : `https://wa.me/`;
      window.open(waUrl, "_blank");

      toast.success(
        num
          ? `Photo download ho gayi · ${cleanName || "Customer"} ka WhatsApp chat khula`
          : "Photo download ho gayi · WhatsApp khula",
        {
          description: copied
            ? "📎 Photo attach karein · caption (text) clipboard me hai, paste kar dein"
            : "📎 Photo attach karein · message manually likhein",
          duration: 9000,
        },
      );
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Share failed");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt preview</DialogTitle>
          <DialogDescription>
            WhatsApp pe share karein, print karein ya PDF download karein.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted p-3">
          <div
            ref={previewRef}
            className="bg-white text-black font-mono text-xs mx-auto shadow-lg relative overflow-hidden p-3"
            style={{ width: 280 }}
          >
            <div>
              <div className="text-center">
                <div className="font-bold text-base">{shop.name || "My Shop"}</div>
                {shop.addressLine1 && <div>{shop.addressLine1}</div>}
                {shop.addressLine2 && <div>{shop.addressLine2}</div>}
                {shop.phoneNumber && <div>Ph: {shop.phoneNumber}</div>}
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="flex justify-between text-[10px]">
                <span>{new Date(sale.date).toLocaleString()}</span>
                <span>#{sale.id.slice(0, 6)}</span>
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <table className="w-full text-[11px]">
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
                      <td className="text-left py-0.5">{c.product.name}</td>
                      <td className="text-right">{c.quantity}</td>
                      <td className="text-right">
                        ₹{(c.product.price * c.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-black my-2" />
              <div className="flex justify-between text-[11px]">
                <span>Subtotal</span>
                <span>₹{sale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Tax</span>
                <span>₹{sale.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[12px] mt-1">
                <span>Total</span>
                <span>₹{sale.total.toFixed(2)}</span>
              </div>
              {shop.upiId && (
                <div className="text-center mt-2 text-[10px]">UPI: {shop.upiId}</div>
              )}
              <div className="text-center mt-3 text-[11px]">
                {shop.footerText || "Thank you!"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="wa-name" className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" /> Customer ka naam
            </Label>
            <Input
              id="wa-name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wa-phone" className="text-xs flex items-center gap-1">
              <Phone className="h-3 w-3" /> WhatsApp number (10-digit)
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-md border bg-muted text-sm font-medium">
                +91
              </div>
              <Input
                id="wa-phone"
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <Button onClick={handleWhatsAppShare} disabled={sharing} className="w-full h-11 text-base font-semibold">
            {sharing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            {phone.replace(/\D/g, "").length >= 10 && name.trim()
              ? `Send to ${name.trim()} on WhatsApp`
              : "Send Photo on WhatsApp"}
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={feedback}
              onChange={(e) => setFeedback(e.target.checked)}
              className="h-4 w-4"
            />
            Message me feedback request bhi bhejein
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-row">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDownloadImage} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Photo
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </DialogFooter>

        {/* Hidden printable receipt — uses existing print stylesheet */}
        <div className="hidden">
          <ReceiptView sale={sale} shop={shop} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
