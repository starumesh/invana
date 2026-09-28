import { useEffect, useRef, useState } from "react";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Rear-camera QR scanner. Uses the native BarcodeDetector where available (Chrome/Android)
 * and falls back to a lazily loaded jsQR decoder (iOS Safari, Firefox).
 */
export function QrScanner({ active, onScan }: { active: boolean; onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let last = { text: "", at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      setError(null);
      setStarting(true);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Use Search or Enter pass ID below.");
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(
          denied
            ? "Camera permission was denied. Allow camera access in your browser settings, or use Search / Enter pass ID."
            : "No camera found. Use Search or Enter pass ID below.",
        );
        setStarting(false);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStarting(false);

      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      let lastTick = 0;

      const tick = async (now: number) => {
        if (stopped) return;
        if (now - lastTick > 120 && video.readyState >= 2) {
          lastTick = now;
          let text: string | null = null;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const w = 640;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              text = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          } catch {
            text = null;
          }
          if (text && !(text === last.text && Date.now() - last.at < 3000)) {
            last = { text, at: Date.now() };
            onScanRef.current(text);
          }
        }
        raf = requestAnimationFrame((t) => void tick(t));
      };
      raf = requestAnimationFrame((t) => void tick(t));
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label="Camera viewfinder" />
      <div aria-hidden className="pointer-events-none absolute inset-[14%] rounded-3xl border-4 border-gold-light/80 shadow-[0_0_0_9999px_rgba(28,25,23,0.45)]" />
      {starting && !error ? <p className="absolute inset-x-0 bottom-4 text-center text-sm text-cream/80">Starting camera…</p> : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-cream" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
