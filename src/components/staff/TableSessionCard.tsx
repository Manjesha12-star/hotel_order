import { useState } from "react";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  Clock,
  Printer,
  ReceiptText,
  RotateCcw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { printDocument } from "@/lib/print";
import {
  clockTime,
  formatMoney,
  nextStatus,
  ORDER_STATUS_LABEL,
  timeAgo,
  type Order,
  type OrderStatus,
  type RestaurantTable,
} from "@/lib/restaurant";

const STATUS_TONE: Record<OrderStatus, string> = {
  placed: "bg-warning/20 text-warning-foreground",
  accepted: "bg-accent/25 text-accent-foreground",
  preparing: "bg-primary/12 text-primary",
  ready: "bg-success/18 text-success",
  served: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/12 text-destructive",
};

const NEXT_LABEL: Record<string, string> = {
  accepted: "Accept",
  preparing: "Start preparing",
  ready: "Mark ready",
  served: "Mark served",
};

export function TableSessionCard({
  table,
  orders,
  waiterPending,
  billPending,
  onAdvance,
  onCloseTable,
  onResetTable,
  onResolveWaiter,
  onResolveBill,
}: {
  table: RestaurantTable;
  orders: Order[];
  waiterPending: boolean;
  billPending: boolean;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onCloseTable: () => void;
  onResetTable: () => void;
  onResolveWaiter: () => void;
  onResolveBill: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const runningBill = sorted.reduce((sum, o) => sum + Number(o.total), 0);
  const openOrders = sorted.filter((o) => o.status !== "served" && o.status !== "cancelled");

  function printKot() {
    const rows = openOrders
      .map(
        (o) => `<div><strong>#${String(o.order_number).padStart(3, "0")}</strong> · ${clockTime(
          o.created_at,
        )}</div><table>${o.order_items
          .map(
            (i) =>
              `<tr><td class="q">${i.quantity}×</td><td>${i.item_name}${
                i.special_instructions ? `<div class="note">${i.special_instructions}</div>` : ""
              }</td></tr>`,
          )
          .join("")}</table><hr/>`,
      )
      .join("");
    printDocument(
      `KOT Table ${table.table_number}`,
      `<h1>KITCHEN ORDER TICKET</h1><div class="sub">Table ${table.table_number} · ${new Date().toLocaleString(
        "en-IN",
      )}</div><hr/>${rows}<div class="foot">Saffron House</div>`,
    );
  }

  function printBill() {
    const rows = sorted
      .flatMap((o) => o.order_items)
      .map(
        (i) =>
          `<tr><td class="q">${i.quantity}×</td><td>${i.item_name}</td><td class="p">${formatMoney(
            i.unit_price * i.quantity,
          )}</td></tr>`,
      )
      .join("");
    printDocument(
      `Bill Table ${table.table_number}`,
      `<h1>SAFFRON HOUSE</h1><div class="sub">Table ${table.table_number} · ${new Date().toLocaleString(
        "en-IN",
      )}</div><hr/><table>${rows}</table><hr/><table><tr><td class="tot">TOTAL</td><td class="p tot">${formatMoney(
        runningBill,
      )}</td></tr></table><div class="foot">Thank you for dining with us</div>`,
    );
  }

  return (
    <article
      className={cn(
        "animate-rise overflow-hidden rounded-3xl border bg-card shadow-soft",
        billPending ? "border-primary" : waiterPending ? "border-accent" : "border-border",
      )}
    >
      <header className="border-b border-border bg-secondary/50 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-2xl font-semibold">
              Table {table.table_number}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {sorted.length} order{sorted.length === 1 ? "" : "s"}
              </span>
              {first && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" /> open {timeAgo(first.created_at)}
                </span>
              )}
              {latest && <span>latest {clockTime(latest.created_at)}</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Running bill</p>
            <p className="font-display text-xl font-semibold text-primary">
              {formatMoney(runningBill)}
            </p>
          </div>
        </div>

        {(waiterPending || billPending) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {waiterPending && (
              <button
                onClick={onResolveWaiter}
                className="animate-attention inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
              >
                <BellRing className="size-3.5" /> Needs assistance · tap when handled
              </button>
            )}
            {billPending && (
              <button
                onClick={onResolveBill}
                className="animate-attention inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <ReceiptText className="size-3.5" /> Bill requested · tap when handled
              </button>
            )}
          </div>
        )}
      </header>

      {!collapsed && (
        <div className="divide-y divide-border">
          {sorted.map((order) => {
            const next = nextStatus(order.status);
            const isNew =
              Date.now() - new Date(order.created_at).getTime() < 90_000 && order.status === "placed";
            return (
              <div key={order.id} className={cn("p-4", isNew && "bg-warning/10")}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      #{String(order.order_number).padStart(3, "0")}
                      {isNew && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold uppercase text-warning-foreground">
                          <Sparkles className="size-3" /> New
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{clockTime(order.created_at)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold",
                      STATUS_TONE[order.status],
                    )}
                  >
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="mt-2 space-y-1">
                  {order.order_items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold">{i.quantity}×</span> {i.item_name}
                        {i.special_instructions && (
                          <span className="block text-xs italic text-muted-foreground">
                            “{i.special_instructions}”
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatMoney(i.unit_price * i.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="mt-2 rounded-lg bg-muted p-2 text-xs italic">{order.notes}</p>
                )}

                {next && (
                  <Button
                    size="sm"
                    className="mt-3 h-10 w-full rounded-full font-bold"
                    onClick={() => onAdvance(order, next)}
                  >
                    {NEXT_LABEL[next] ?? next}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <footer className="flex flex-wrap gap-2 border-t border-border bg-card p-3">
        <Button variant="outline" size="sm" className="rounded-full" onClick={printKot}>
          <Printer className="size-4" /> KOT
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={printBill}>
          <ReceiptText className="size-4" /> Bill
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={onCloseTable}>
          <Wallet className="size-4" /> Paid & close
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onResetTable}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto rounded-full"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {collapsed ? "Expand" : "Collapse"}
        </Button>
      </footer>
    </article>
  );
}
