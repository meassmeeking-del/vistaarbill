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
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      // Use 80mm thermal-style width, height from canvas ratio
      const widthMm = 80;
      const heightMm = (canvas.height * widthMm) / canvas.width;
      const pdf = new jsPDF({
        unit: "mm",
        format: [widthMm, heightMm],
        orientation: "portrait",
      });
      pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`receipt-${sale.id.slice(0, 6)}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
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
