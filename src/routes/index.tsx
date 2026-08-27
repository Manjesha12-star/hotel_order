import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UtensilsCrossed, LockKeyhole } from "lucide-react";
import { QrScanDialog } from "@/components/menu/QrScanDialog";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saffron House — Dine-in QR Ordering" },
      {
        name: "description",
        content:
          "Scan the QR code on your table at Saffron House to browse the menu, order, call a waiter and request your bill.",
      },
      { property: "og:title", content: "Saffron House — Dine-in QR Ordering" },
      {
        property: "og:description",
        content: "Scan your table QR code and order straight from your seat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      <QrScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <section className="relative overflow-hidden border-b border-border bg-sidebar px-5 py-16 text-sidebar-foreground">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-sidebar-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
            <UtensilsCrossed className="size-3.5" /> Dine-in only
          </p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
            Saffron House
          </h1>
          <p className="mt-4 max-w-lg text-balance-tight text-sm leading-relaxed text-sidebar-foreground/75 sm:text-base">
            Scan the QR code on your table, browse the kitchen's full menu, and order without waiting
            for anyone. Every order stays on your table's running bill until you pay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 rounded-full px-7 font-bold"
              onClick={() => setScanOpen(true)}
            >
              <UtensilsCrossed className="size-5" /> Order now
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Link to="/staff">
                <LockKeyhole className="size-4" /> Staff dashboard
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            ["1", "Scan", "Use the code displayed on your table."],
            ["2", "Order", "Choose dishes and send them to the kitchen."],
            ["3", "Pay", "Request the bill when your table is finished."],
          ].map(([number, title, description]) => (
            <div key={number} className="border-t border-border pt-4">
              <p className="text-xs font-bold text-primary">{number}</p>
              <h2 className="mt-2 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
