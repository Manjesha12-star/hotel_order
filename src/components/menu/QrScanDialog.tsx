import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const REGION_ID = "qr-scan-region";

export type ScannedTableCode = {
  table: number;
  code?: string;
};

/** Extract table access details from a scanned QR payload. */
export function parseTableFromScan(text: string): ScannedTableCode | null {
  const trimmed = text.trim();
  if (/^\d{1,3}$/.test(trimmed)) return { table: Number(trimmed) };
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("table");
    const code = url.searchParams.get("code")?.trim();
    if (t && /^\d{1,3}$/.test(t)) {
      return code ? { table: Number(t), code } : { table: Number(t) };
    }
  } catch {
    const m = trimmed.match(/table=(\d{1,3})/i);
    const code = trimmed.match(/code=([a-z0-9]+)/i)?.[1];
    if (m) return code ? { table: Number(m[1]), code } : { table: Number(m[1]) };
  }
  return null;
}

export function QrScanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner as unknown as typeof scannerRef.current;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const scanned = parseTableFromScan(decoded);
            if (scanned === null) {
              setError("That QR code isn't a table code.");
              return;
            }
            scanner.stop().catch(() => {});
            onOpenChange(false);
            navigate({ to: "/menu", search: { table: scanned.table, code: scanned.code } });
          },
          () => {},
        );
      } catch {
        if (!cancelled) setError("Camera unavailable. Allow camera access or pick a table below.");
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      s?.stop()
        .then(() => s.clear())
        .catch(() => {});
    };
  }, [open, navigate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Scan your table QR</DialogTitle>
          <DialogDescription>
            Point your camera at the QR code printed on your table.
          </DialogDescription>
        </DialogHeader>
        <div
          id={REGION_ID}
          className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted"
        />
        {error ? (
          <p className="text-center text-xs text-destructive">{error}</p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Camera className="size-3.5" /> Looking for a table code…
          </p>
        )}
        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
          <X className="size-4" /> Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
