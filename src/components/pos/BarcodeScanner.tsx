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
import { ScanLine, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  /** Title shown in the scanner dialog header */
  title?: string;
  /** Hint text shown below the camera view */
  hint?: string;
};

export function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
  title = "Scan Barcode",
  hint = "Barcode ko frame ke beech laayein. Andhera ho toh flash on karein.",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

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
      delayBetweenScanAttempts: 16,
      delayBetweenScanSuccess: 200,
    });
    setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("NotSupported: camera ke liye HTTPS aur naya browser chahiye");
        }
        const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId
              ? { ...base, deviceId: { exact: deviceId } }
              : { ...base, facingMode: { ideal: "environment" } },
          });
        } catch (err) {
          if (err instanceof Error && /NotAllowed|Permission/i.test(err.name + err.message)) throw err;
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Labels available only after permission — list devices now (without re-triggering effect)
        BrowserMultiFormatReader.listVideoInputDevices()
          .then((list) => !cancelled && setDevices(list))
          .catch(() => {});

        const track = stream.getVideoTracks()[0];
        const caps =
          (track.getCapabilities?.() as MediaTrackCapabilities & {
            torch?: boolean;
          }) || {};
        setTorchSupported(!!caps.torch);

        if (!videoRef.current) return;
        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result, _err, ctrls) => {
            controlsRef.current = ctrls;
            if (result) {
              const text = result.getText();
              setLastCode(text);
              ctrls.stop();
              onDetected(text);
              onOpenChange(false);
            }
          },
        );
        controlsRef.current = controls;
      } catch (e: unknown) {
        if (cancelled) return;
        const raw = e instanceof Error ? `${e.name} ${e.message}` : "Camera access failed";
        const msg = /permission|notallowed/i.test(raw)
          ? "Camera permission allow karein, phir scanner dobara kholein"
          : /notfound|overconstrained/i.test(raw)
            ? "Is phone par camera nahi mila"
            : /notreadable|trackstart/i.test(raw)
            ? "Camera kisi aur app me chal raha hai — use band karke dobara try karein"
            : /notsupported/i.test(raw)
            ? "Is browser me camera support nahi hai — Chrome me HTTPS link kholein"
            : `Scanner start nahi hua: ${raw}`;
        setError(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTorchOn(false);
      setTorchSupported(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        // @ts-expect-error torch not in standard types
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      toast.error("Flash not supported on this device");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> {title}
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
                autoPlay
              />
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-primary/80 shadow-[0_0_8px_var(--primary)]" />
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-2 hover:bg-black/80"
                  aria-label="Toggle flash"
                >
                  {torchOn ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                </button>
              )}
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
            <p className="text-xs text-muted-foreground text-center">{hint}</p>
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
