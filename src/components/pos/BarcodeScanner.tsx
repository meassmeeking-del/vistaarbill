import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 500,
    });
    setError(null);

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        const back = list.find((d) => /back|rear|environment/i.test(d.label));
        const chosen = deviceId || back?.deviceId || list[0]?.deviceId;
        setDeviceId(chosen);
        if (!videoRef.current) return;
        return reader.decodeFromVideoDevice(
          chosen,
          videoRef.current,
          (result, _err, controls) => {
            controlsRef.current = controls;
            if (result) {
              const text = result.getText();
              setLastCode(text);
              controls.stop();
              onDetected(text);
              onOpenChange(false);
            }
          },
        );
      })
      .then((controls) => {
        if (controls) controlsRef.current = controls;
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Camera access failed";
        setError(msg);
        toast.error(msg);
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> Scan Barcode
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary/80 shadow-[0_0_8px_var(--primary)]" />
            </div>
            {devices.length > 1 && (
              <select
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Barcode ko frame ke beech mein laayein. Achhi roshni mein, 10–20cm door se hold karein. Phone steady rakhein.
            </p>
            {lastCode && (
              <p className="text-xs text-center">Last: {lastCode}</p>
            )}
          </div>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
