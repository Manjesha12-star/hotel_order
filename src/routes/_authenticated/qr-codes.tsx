import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({
    meta: [
      { title: "Table QR Codes — Saffron House" },
      {
        name: "description",
        content:
          "Generate and print secure QR codes for every dine-in table at Saffron House.",
      },
      { property: "og:title", content: "Table QR Codes — Saffron House" },
      {
        property: "og:description",
        content: "Print secure dine-in ordering QR codes for each restaurant table.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrCodesPage,
});

async function fetchTableQRCodes() {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, qr_code, seats, is_active")
    .eq("is_active", true)
    .order("table_number", { ascending: true });

  if (error) {
    console.error("Error fetching tables:", error);
    return [];
  }
  return data || [];
}

function QrCodesPage() {
  const { data: tables = [] } = useQuery({
    queryKey: ["table-qr-codes"],
    queryFn: fetchTableQRCodes,
  });

  const [origin, setOrigin] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin || tables.length === 0) return;
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        tables.map(async (table) => {
          // Construct URL using standard URL API to prevent encoding glitches
          const targetUrl = new URL(`/table/${table.table_number}`, origin);
          targetUrl.searchParams.set("code", table.qr_code);

          const dataUrl = await QRCode.toDataURL(targetUrl.toString(), {
            width: 512,
            margin: 2, // Increased margin (quiet zone) for reliable phone camera detection
            errorCorrectionLevel: "H", // High error correction level for sharp pattern recognition
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          return [table.id, dataUrl] as const;
        })
      );
      if (!cancelled) setCodes(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, tables]);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/">
              <ChevronLeft className="size-4" /> Back
            </Link>
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => window.print()}>
            <Printer className="size-4" /> Print all
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold">Table QR codes</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground print:hidden">
          Every table has a private code that opens only that table's ordering menu. Print this page,
          cut out each card and place it on the matching table.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3">
          {tables.map((table) => {
            const url = `${origin}/table/${table.table_number}?code=${table.qr_code}`;
            return (
              <div
                key={table.id}
                className="break-inside-avoid rounded-2xl border border-border bg-card p-4 text-center shadow-soft"
              >
                <p className="font-display text-xl font-semibold">Table {table.table_number}</p>
                <p className="text-[11px] text-muted-foreground">{table.seats ?? 4} seats</p>
                <div className="mx-auto mt-3 aspect-square w-full max-w-[190px] overflow-hidden rounded-xl bg-white p-2">
                  {codes[table.id] ? (
                    <img
                      src={codes[table.id]}
                      alt={`Secure QR code for table ${table.table_number}`}
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="size-full animate-pulse rounded-lg bg-muted" />
                  )}
                </div>
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                  Scan to order · Table {table.table_number}
                </p>
                <p className="mt-1 break-all text-[10px] text-muted-foreground/70 print:hidden">
                  {url}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}