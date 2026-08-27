import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { BellRing, LayoutGrid, LogOut, QrCode, ReceiptText, TrendingUp, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSessionCard } from "@/components/staff/TableSessionCard";
import { supabase } from "@/integrations/supabase/client";
import { useChime } from "@/lib/useChime";
import { cn } from "@/lib/utils";
import {
  closeTableSession,
  resetTable,
  setTableStatus,
  updateOrderStatus,
  updateRequestStatus,
} from "@/lib/staff";
import {
  clockTime,
  fetchActiveOrders,
  fetchActiveSessions,
  fetchRequests,
  fetchTables,
  formatMoney,
  TABLE_STATUS_LABEL,
  type Order,
  type OrderStatus,
  type TableStatus,
} from "@/lib/restaurant";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Kitchen Dashboard — Saffron House" },
      {
        name: "description",
        content: "Live table orders, waiter calls, bill requests and daily reports for staff.",
      },
      { property: "og:title", content: "Kitchen Dashboard — Saffron House" },
      { property: "og:description", content: "Live dine-in order management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffDashboard,
});

const TABLE_TONE: Record<TableStatus, string> = {
  available: "border-border bg-card",
  occupied: "border-primary/40 bg-primary/5",
  bill_requested: "border-primary bg-primary/10",
  cleaning: "border-warning/50 bg-warning/10",
  ready: "border-success/50 bg-success/10",
};

function StaffDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const chime = useChime();
  const seenOrders = useRef<Set<string> | null>(null);

  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: sessions = [] } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: fetchActiveSessions,
  });
  const { data: orders = [] } = useQuery({ queryKey: ["active-orders"], queryFn: fetchActiveOrders });
  const { data: waiterRequests = [] } = useQuery({
    queryKey: ["waiter-requests"],
    queryFn: () => fetchRequests("waiter_requests"),
  });
  const { data: billRequests = [] } = useQuery({
    queryKey: ["bill-requests"],
    queryFn: () => fetchRequests("bill_requests"),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["active-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["tables"] });
    void queryClient.invalidateQueries({ queryKey: ["waiter-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["bill-requests"] });
  };

  // Realtime: new orders, items, requests and table changes.
  useEffect(() => {
    const channel = supabase
      .channel("staff-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, refreshAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_requests" }, () => {
        chime("request");
        toast("🔔 A table needs assistance");
        refreshAll();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bill_requests" }, () => {
        chime("request");
        toast("💳 Bill requested");
        refreshAll();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notification sound + toast for genuinely new orders.
  useEffect(() => {
    if (orders.length === 0) return;
    if (seenOrders.current === null) {
      seenOrders.current = new Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter((o) => !seenOrders.current!.has(o.id));
    if (fresh.length > 0) {
      fresh.forEach((o) => seenOrders.current!.add(o.id));
      const tableNumber = tables.find((t) => t.id === fresh[0]!.table_id)?.table_number;
      chime("order");
      toast.success(`New order from Table ${tableNumber ?? "?"}`);
    }
  }, [orders, tables, chime]);

  const tableById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const activeCards = useMemo(() => {
    return sessions
      .map((session) => {
        const table = tableById.get(session.table_id);
        if (!table) return null;
        const sessionOrders = orders.filter(
          (o) => o.session_id === session.id && o.status !== "cancelled",
        );
        return {
          session,
          table,
          orders: sessionOrders,
          waiterPending: waiterRequests.some(
            (r) => r.table_id === table.id && r.status !== "completed",
          ),
          billPending: billRequests.some((r) => r.table_id === table.id && r.status !== "completed"),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null && c.orders.length > 0)
      .sort((a, b) => (b.billPending ? 1 : 0) - (a.billPending ? 1 : 0));
  }, [sessions, orders, tableById, waiterRequests, billRequests]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todays = orders.filter(
      (o) => new Date(o.created_at) >= start && o.status !== "cancelled",
    );
    const revenue = todays.reduce((sum, o) => sum + Number(o.total), 0);
    const itemCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    todays.forEach((o) => {
      const hour = new Date(o.created_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      o.order_items.forEach((i) =>
        itemCounts.set(i.item_name, (itemCounts.get(i.item_name) ?? 0) + i.quantity),
      );
    });
    return {
      count: todays.length,
      revenue,
      completed: todays.filter((o) => o.status === "served").length,
      topItems: [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      peakHours: [...hourCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      orders: todays,
    };
  }, [orders]);

  async function guard(action: () => Promise<void>) {
    try {
      await action();
      refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  const advance = (order: Order, status: OrderStatus, tableNumber: number, tableId: string) =>
    guard(async () => {
      await updateOrderStatus(order, status, tableNumber);
      if (status === "accepted") await setTableStatus(tableId, "occupied", tableNumber);
      toast.success(`Order #${String(order.order_number).padStart(3, "0")} → ${status}`);
    });

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sidebar-primary">
              Saffron House
            </p>
            <h1 className="truncate font-display text-2xl font-semibold">Kitchen dashboard</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Link to="/qr-codes">
                <QrCode className="size-4" />
                <span className="hidden sm:inline">Table codes</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="orders" className="mx-auto max-w-6xl px-4">
        <TabsList className="mt-4 grid w-full grid-cols-4 rounded-full bg-muted p-1">
          <TabsTrigger value="orders" className="rounded-full">
            <Utensils className="size-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-full">
            <BellRing className="size-4" />
            <span className="hidden sm:inline">Requests</span>
            {waiterRequests.length + billRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {waiterRequests.length + billRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tables" className="rounded-full">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Tables</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-5">
          {activeCards.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              No active tables. New orders appear here instantly.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeCards.map((card) => (
                <TableSessionCard
                  key={card.session.id}
                  table={card.table}
                  orders={card.orders}
                  waiterPending={card.waiterPending}
                  billPending={card.billPending}
                  onAdvance={(order, status) =>
                    advance(order, status, card.table.table_number, card.table.id)
                  }
                  onResolveWaiter={() =>
                    guard(async () => {
                      const req = waiterRequests.find((r) => r.table_id === card.table.id);
                      if (req)
                        await updateRequestStatus(
                          "waiter_requests",
                          req.id,
                          "completed",
                          card.table.table_number,
                        );
                    })
                  }
                  onResolveBill={() =>
                    guard(async () => {
                      const req = billRequests.find((r) => r.table_id === card.table.id);
                      if (req)
                        await updateRequestStatus(
                          "bill_requests",
                          req.id,
                          "completed",
                          card.table.table_number,
                        );
                    })
                  }
                  onCloseTable={() =>
                    guard(async () => {
                      await closeTableSession({
                        sessionId: card.session.id,
                        tableId: card.table.id,
                        tableNumber: card.table.table_number,
                      });
                      toast.success(`Table ${card.table.table_number} closed and paid`);
                    })
                  }
                  onResetTable={() =>
                    guard(async () => {
                      await resetTable(card.table.id, card.table.table_number);
                      toast.success(`Table ${card.table.table_number} ready for guests`);
                    })
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-5 space-y-3">
          {waiterRequests.length + billRequests.length === 0 && (
            <p className="py-20 text-center text-sm text-muted-foreground">No open requests.</p>
          )}
          {[
            ...waiterRequests.map((r) => ({ ...r, kind: "waiter_requests" as const })),
            ...billRequests.map((r) => ({ ...r, kind: "bill_requests" as const })),
          ]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((req) => {
              const table = tableById.get(req.table_id);
              const isWaiter = req.kind === "waiter_requests";
              return (
                <div
                  key={req.id}
                  className="animate-rise grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {isWaiter ? "🔔" : "💳"} Table {table?.table_number ?? "?"}{" "}
                      {isWaiter ? "needs assistance" : "requested the bill"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {clockTime(req.created_at)} · {req.status}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {req.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() =>
                          guard(() =>
                            updateRequestStatus(
                              req.kind,
                              req.id,
                              "accepted",
                              table?.table_number ?? 0,
                            ),
                          )
                        }
                      >
                        Accept
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() =>
                        guard(async () => {
                          if (req.kind === "bill_requests" && table) {
                            await closeTableSession({
                              sessionId: req.session_id,
                              tableId: table.id,
                              tableNumber: table.table_number,
                            });
                            toast.success(`Table ${table.table_number} closed and paid`);
                            return;
                          }
                          await updateRequestStatus(
                            req.kind,
                            req.id,
                            "completed",
                            table?.table_number ?? 0,
                          );
                        })
                      }
                    >
                      {req.kind === "bill_requests" ? "Paid & close" : "Complete"}
                    </Button>
                  </div>
                </div>
              );
            })}
        </TabsContent>

        <TabsContent value="tables" className="mt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tables.map((t) => {
              const session = sessions.find((s) => s.table_id === t.id);
              const bill = orders
                .filter((o) => o.session_id === session?.id && o.status !== "cancelled")
                .reduce((sum, o) => sum + Number(o.total), 0);
              return (
                <div
                  key={t.id}
                  className={cn("rounded-2xl border p-4 shadow-soft", TABLE_TONE[t.status])}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <h3 className="truncate font-display text-xl font-semibold">
                      Table {t.table_number}
                    </h3>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{t.seats} seats</span>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {TABLE_STATUS_LABEL[t.status]}
                  </p>
                  {bill > 0 && (
                    <p className="mt-2 font-semibold text-primary">{formatMoney(bill)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(["available", "occupied", "cleaning", "ready"] as TableStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => guard(() => setTableStatus(t.id, s, t.table_number))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                          t.status === s
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {TABLE_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Today's orders", value: String(today.count) },
              { label: "Today's revenue", value: formatMoney(today.revenue) },
              { label: "Active tables", value: String(activeCards.length) },
              { label: "Completed orders", value: String(today.completed) },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">Most ordered today</h2>
              {today.topItems.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">No orders yet today.</p>
              )}
              <ul className="mt-3 space-y-2">
                {today.topItems.map(([name, qty]) => (
                  <li key={name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="shrink-0 font-bold text-primary">{qty}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">Peak hours</h2>
              {today.peakHours.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Not enough data yet.</p>
              )}
              <ul className="mt-3 space-y-2">
                {today.peakHours.map(([hour, count]) => (
                  <li key={hour} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-muted-foreground">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round((count / (today.peakHours[0]?.[1] ?? 1)) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ReceiptText className="size-4" /> Today's orders
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {today.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    #{String(o.order_number).padStart(3, "0")} · Table{" "}
                    {tableById.get(o.table_id)?.table_number ?? "?"} · {clockTime(o.created_at)}
                  </span>
                  <span className="shrink-0 font-semibold">{formatMoney(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
