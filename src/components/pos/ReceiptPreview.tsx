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

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const buildPdf = async () => {
      const { default: jsPDF } = await import("jspdf");
      const widthMm = 80;
      const margin = 4;
      const innerWidth = widthMm - margin * 2;
      // estimate height
      const lineH = 4;
      const itemLines = sale.items.length;
      const estHeight =
        32 + // header (logo + name)
        (shop.addressLine1 ? lineH : 0) +
        (shop.addressLine2 ? lineH : 0) +
        (shop.phoneNumber ? lineH : 0) +
        10 + // date row + dividers
        6 + // table header
        itemLines * lineH * 2 +
        28 + // totals + thank you box
        (shop.upiId ? lineH : 0) +
        10; // footer
      const pdf = new jsPDF({
        unit: "mm",
        format: [widthMm, Math.max(estHeight, 60)],
        orientation: "portrait",
      });

      const center = widthMm / 2;

      // Green header band with checkmark
      pdf.setFillColor(16, 145, 80);
      pdf.rect(0, 0, widthMm, 18, "F");
      pdf.setFillColor(255, 255, 255);
      pdf.circle(center, 9, 4.2, "F");
      pdf.setDrawColor(16, 145, 80);
      pdf.setLineWidth(0.6);
      pdf.line(center - 1.8, 9, center - 0.4, 10.6);
      pdf.line(center - 0.4, 10.6, center + 2, 7.6);
      pdf.setLineWidth(0.2);

      let y = 22;

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(20, 20, 20);
      pdf.setFontSize(13);
      pdf.text(shop.name || "My Shop", center, y, { align: "center" });
      y += lineH + 1;

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);
      pdf.setFontSize(8);
      if (shop.addressLine1) {
        pdf.text(shop.addressLine1, center, y, { align: "center" });
        y += lineH;
      }
      if (shop.addressLine2) {
        pdf.text(shop.addressLine2, center, y, { align: "center" });
        y += lineH;
      }
      if (shop.phoneNumber) {
        pdf.text(`Ph: ${shop.phoneNumber}`, center, y, { align: "center" });
        y += lineH;
      }

      y += 1;
      pdf.setLineDashPattern([0.8, 0.8], 0);
      pdf.setDrawColor(160, 160, 160);
      pdf.line(margin, y, widthMm - margin, y);
      pdf.setLineDashPattern([], 0);
      y += 3;

      pdf.setTextColor(20, 20, 20);
      pdf.setFontSize(7);
      pdf.text(new Date(sale.date).toLocaleString(), margin, y);
      pdf.text(`#${sale.id.slice(0, 6)}`, widthMm - margin, y, { align: "right" });
      y += 3;
      pdf.setLineDashPattern([0.8, 0.8], 0);
      pdf.setDrawColor(160, 160, 160);
      pdf.line(margin, y, widthMm - margin, y);
      pdf.setLineDashPattern([], 0);
      y += 3;

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("Item", margin, y);
      pdf.text("Qty", widthMm - margin - 18, y, { align: "right" });
      pdf.text("Total", widthMm - margin, y, { align: "right" });
      y += lineH;
      pdf.setFont("helvetica", "normal");

      for (const c of sale.items) {
        const nameLines = pdf.splitTextToSize(c.product.name, innerWidth - 24);
        pdf.text(nameLines, margin, y);
        pdf.text(String(c.quantity), widthMm - margin - 18, y, { align: "right" });
        pdf.text(
          `Rs.${(c.product.price * c.quantity).toFixed(2)}`,
          widthMm - margin,
          y,
          { align: "right" },
        );
        y += lineH * Math.max(nameLines.length, 1);
      }

      y += 1;
      pdf.setLineDashPattern([0.8, 0.8], 0);
      pdf.setDrawColor(160, 160, 160);
      pdf.line(margin, y, widthMm - margin, y);
      pdf.setLineDashPattern([], 0);
      y += 4;

      pdf.text("Subtotal", margin, y);
      pdf.text(`Rs.${sale.subtotal.toFixed(2)}`, widthMm - margin, y, { align: "right" });
      y += lineH;
      pdf.text("Tax", margin, y);
      pdf.text(`Rs.${sale.tax.toFixed(2)}`, widthMm - margin, y, { align: "right" });
      y += lineH + 1;

      // Total highlight box
      pdf.setFillColor(16, 145, 80);
      pdf.roundedRect(margin, y, widthMm - margin * 2, 8, 1.5, 1.5, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("TOTAL", margin + 2, y + 5.5);
      pdf.text(`Rs.${sale.total.toFixed(2)}`, widthMm - margin - 2, y + 5.5, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(20, 20, 20);
      y += 12;

      if (shop.upiId) {
        pdf.setFontSize(7);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`UPI: ${shop.upiId}`, center, y, { align: "center" });
        y += lineH;
      }
      pdf.setFontSize(8);
      pdf.setTextColor(16, 145, 80);
      pdf.setFont("helvetica", "bold");
      pdf.text(shop.footerText || "Thank you!", center, y, { align: "center" });

      return pdf;
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const pdf = await buildPdf();
      pdf.save(`receipt-${sale.id.slice(0, 6)}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "PDF failed");
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
      const pdf = await buildPdf();
      const blob = pdf.output("blob");
      const filename = `receipt-${sale.id.slice(0, 6)}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      const msg =
        `*${shop.name || "My Shop"}*\n` +
        `Bill #${sale.id.slice(0, 6)}\n` +
        `Total: ₹${sale.total.toFixed(2)}\n\n` +
        `${shop.footerText || "Thank you for shopping with us!"}`;

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

      // Fallback: download PDF + open WhatsApp chat with text
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
      toast.success("PDF downloaded — attach it in WhatsApp chat");
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
            Send on WhatsApp
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-row">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            PDF
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
