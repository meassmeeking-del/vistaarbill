import { useRef, useState } from "react";
import { Receipt as ReceiptView } from "./Receipt";
import type { Sale, Shop } from "@/lib/pos-store";
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
import { Printer, Download, Loader2, Share2, Check } from "lucide-react";
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
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState(true);

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

      const feedbackLine = feedback
        ? `\n\nAapka feedback humein zaroor batayein 🙏 — reply karke rating dein (1-5).`
        : "";
      const msg =
        `🧾 *${shop.name || "My Shop"}* — Your Bill\n` +
        `Bill #${sale.id.slice(0, 6)}\n` +
        `Total: ₹${sale.total.toFixed(2)}\n\n` +
        `${shop.footerText || "Thank you for shopping with us!"}` +
        feedbackLine;

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: ShareData & { files?: File[] }) => Promise<void>;
      };

      // Try native share with file first (works on mobile WhatsApp)
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: msg, title: filename });
          toast.success("Shared!");
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
          // fall through to wa.me
        }
      }

      // Fallback: download image + open WhatsApp chat with text
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      const num = normalizePhone(phone);
      const waUrl = num
        ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      toast.success("Image downloaded — attach it in WhatsApp chat");
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

        <div className="rounded-xl bg-gradient-to-b from-emerald-50 to-white p-3">
          <div
            ref={previewRef}
            className="bg-white text-black font-mono text-xs mx-auto shadow-lg relative overflow-hidden"
            style={{ width: 280 }}
          >
            {/* Zig-zag top edge */}
            <div
              className="h-2 bg-emerald-600"
              style={{
                WebkitMaskImage:
                  "radial-gradient(circle at 6px 8px, transparent 4px, black 4.5px)",
                WebkitMaskSize: "12px 8px",
                WebkitMaskRepeat: "repeat-x",
                maskImage:
                  "radial-gradient(circle at 6px 8px, transparent 4px, black 4.5px)",
                maskSize: "12px 8px",
                maskRepeat: "repeat-x",
              }}
            />
            <div className="bg-emerald-600 text-white text-center pb-3 pt-1">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow">
                <Check className="h-6 w-6" strokeWidth={3} />
              </div>
            </div>
            <div className="p-3">
              <div className="text-center">
                <div className="font-bold text-base">{shop.name || "My Shop"}</div>
                {shop.addressLine1 && <div className="text-[10px] text-gray-600">{shop.addressLine1}</div>}
                {shop.addressLine2 && <div className="text-[10px] text-gray-600">{shop.addressLine2}</div>}
                {shop.phoneNumber && <div className="text-[10px] text-gray-600">Ph: {shop.phoneNumber}</div>}
              </div>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>{new Date(sale.date).toLocaleString()}</span>
                <span className="font-semibold">#{sale.id.slice(0, 6)}</span>
              </div>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-semibold">Item</th>
                    <th className="text-right font-semibold">Qty</th>
                    <th className="text-right font-semibold">Total</th>
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
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-600">Subtotal</span>
                <span>₹{sale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-600">Tax</span>
                <span>₹{sale.tax.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex justify-between items-center bg-emerald-600 text-white rounded-lg px-3 py-2">
                <span className="font-bold text-sm">TOTAL</span>
                <span className="font-bold text-base">₹{sale.total.toFixed(2)}</span>
              </div>
              {shop.upiId && (
                <div className="text-center mt-2 text-[10px] text-gray-600">UPI: {shop.upiId}</div>
              )}
              <div className="text-center mt-2 text-[11px] font-semibold text-emerald-700">
                {shop.footerText || "Thank you!"}
              </div>
            </div>
            {/* Zig-zag bottom edge */}
            <div
              className="h-2 bg-white"
              style={{
                WebkitMaskImage:
                  "radial-gradient(circle at 6px 0, transparent 4px, black 4.5px)",
                WebkitMaskSize: "12px 8px",
                WebkitMaskRepeat: "repeat-x",
                maskImage:
                  "radial-gradient(circle at 6px 0, transparent 4px, black 4.5px)",
                maskSize: "12px 8px",
                maskRepeat: "repeat-x",
                background: "white",
                boxShadow: "inset 0 0 0 1000px white",
              }}
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="wa-phone" className="text-xs">
            Customer WhatsApp number (10-digit, optional)
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
          <Button
            onClick={handleWhatsAppShare}
            disabled={sharing}
            className="w-full h-11 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Send Photo on WhatsApp
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={feedback}
              onChange={(e) => setFeedback(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
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
