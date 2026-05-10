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
import { Printer, Download, Loader2 } from "lucide-react";
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

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const widthMm = 80;
      const margin = 4;
      const innerWidth = widthMm - margin * 2;
      // estimate height
      const lineH = 4;
      const itemLines = sale.items.length;
      const estHeight =
        20 + // header
        (shop.addressLine1 ? lineH : 0) +
        (shop.addressLine2 ? lineH : 0) +
        (shop.phoneNumber ? lineH : 0) +
        10 + // date row + dividers
        6 + // table header
        itemLines * lineH * 2 +
        20 + // totals
        (shop.upiId ? lineH : 0) +
        10; // footer
      const pdf = new jsPDF({
        unit: "mm",
        format: [widthMm, Math.max(estHeight, 60)],
        orientation: "portrait",
      });

      let y = margin + 2;
      const center = widthMm / 2;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(shop.name || "My Shop", center, y, { align: "center" });
      y += lineH + 1;

      pdf.setFont("helvetica", "normal");
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
      pdf.line(margin, y, widthMm - margin, y);
      y += 3;

      pdf.setFontSize(7);
      pdf.text(new Date(sale.date).toLocaleString(), margin, y);
      pdf.text(`#${sale.id.slice(0, 6)}`, widthMm - margin, y, { align: "right" });
      y += 3;
      pdf.line(margin, y, widthMm - margin, y);
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
      pdf.line(margin, y, widthMm - margin, y);
      y += 4;

      pdf.text("Subtotal", margin, y);
      pdf.text(`Rs.${sale.subtotal.toFixed(2)}`, widthMm - margin, y, { align: "right" });
      y += lineH;
      pdf.text("Tax", margin, y);
      pdf.text(`Rs.${sale.tax.toFixed(2)}`, widthMm - margin, y, { align: "right" });
      y += lineH;
      pdf.setFont("helvetica", "bold");
      pdf.text("Total", margin, y);
      pdf.text(`Rs.${sale.total.toFixed(2)}`, widthMm - margin, y, { align: "right" });
      pdf.setFont("helvetica", "normal");
      y += lineH + 2;

      if (shop.upiId) {
        pdf.setFontSize(7);
        pdf.text(`UPI: ${shop.upiId}`, center, y, { align: "center" });
        y += lineH;
      }
      pdf.setFontSize(8);
      pdf.text(shop.footerText || "Thank you!", center, y, { align: "center" });

      pdf.save(`receipt-${sale.id.slice(0, 6)}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt preview</DialogTitle>
          <DialogDescription>
            Print karein ya PDF download karein.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-white p-2">
          <div
            ref={previewRef}
            className="bg-white text-black font-mono text-xs p-3 mx-auto"
            style={{ width: 280 }}
          >
            <div className="text-center">
              <div className="font-bold text-sm">{shop.name || "My Shop"}</div>
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
              <div className="text-center mt-2 text-[10px]">UPI: {shop.upiId}</div>
            )}
            <div className="text-center mt-3 text-[10px]">
              {shop.footerText || "Thank you!"}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button onClick={handlePrint}>
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
