import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  ChevronLeft,
  CircleCheck,
  ReceiptText,
  Search,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { CartSheet } from "@/components/menu/CartSheet";
import { supabase } from "@/integrations/supabase/client";
import {
  createGuestRequest,
  fetchGuestOrders,
  placeGuestOrder,
  validateGuestTable,
} from "@/lib/guest-order.functions";
import { useCart } from "@/lib/useCart";
import { cn } from "@/lib/utils";
import {
  clockTime,
  fetchCategories,
  fetchMenuItems,
  formatMoney,
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  type MenuItem,
} from "@/lib/restaurant";

const searchSchema = z.object({
  table: z.coerce.number().int().min(1).max(999).catch(1),
  code: z.string().trim().min(16).max(128).optional().catch(undefined),
});

export const Route = createFileRoute("/menu")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Menu — Saffron House" },
      {
        name: "description",
        content:
          "Browse the Saffron House dine-in menu, add dishes to your table order, call a waiter or request the bill.",
      },
      { property: "og:title", content: "Menu — Saffron House" },
      {
        property: "og:description",
        content: "Order from your table at Saffron House — no app, no login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

type DietFilter = "all" | "veg" | "nonveg";

function MenuPage() {
  const { table: tableNumber, code } = Route.useSearch();
  const queryClient = useQueryClient();
  const cart = useCart(tableNumber);
  const validateTable = useServerFn(validateGuestTable);
  const fetchOrders = useServerFn(fetchGuestOrders);
  const placeOrderFn = useServerFn(placeGuestOrder);
  const createRequestFn = useServerFn(createGuestRequest);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  const hasCode = Boolean(code);
  const { data: access, isLoading: tableLoading, isError: tableInvalid } = useQuery({
    queryKey: ["guest-table-access", tableNumber, code],
    queryFn: () => validateTable({ data: { tableNumber, code: code ?? "" } }),
    enabled: hasCode,
    retry: false,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: fetchMenuItems,
  });
  const { data: orderState } = useQuery({
    queryKey: ["guest-orders", tableNumber, code],
    queryFn: () => fetchOrders({ data: { tableNumber, code: code ?? "" } }),
    enabled: hasCode && !tableInvalid,
    refetchInterval: 4000,
    retry: false,
  });

  const table = access?.table ?? orderState?.table ?? null;
  const sessionId = orderState?.sessionId ?? null;
  const orders = orderState?.orders ?? [];

  // Live order status updates for this table's session.
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`guest-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `session_id=eq.${sessionId}` },
        () => queryClient.invalidateQueries({ queryKey: ["guest-orders", tableNumber, code] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient, tableNumber, code]);

  // When staff settle the bill the session closes — clear this table's orders and cart.
  const settledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!table?.id) return;
    const channel = supabase
      .channel(`guest-table-session-${table.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions", filter: `table_id=eq.${table.id}` },
        (payload) => {
          const row = payload.new as { id?: string; status?: string } | null;
          if (row?.status && row.status !== "active" && settledRef.current !== row.id) {
            settledRef.current = row.id ?? null;
            cart.clear();
            queryClient.removeQueries({ queryKey: ["guest-orders", tableNumber, code] });
            toast.success("Bill settled — thank you for dining with us!");
          }
          void queryClient.invalidateQueries({ queryKey: ["guest-orders", tableNumber, code] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id, queryClient, tableNumber, code]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const category = categories.find((c) => c.id === item.category_id);
      if (activeCategory !== "all" && item.category_id !== activeCategory) return false;
      if (diet === "veg" && !item.is_veg) return false;
      if (diet === "nonveg" && item.is_veg) return false;
      if (availableOnly && !item.is_available) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, categories, activeCategory, diet, availableOnly, query]);

  const grouped = useMemo(() => {
    return categories
      .map((c) => ({ category: c, items: filtered.filter((i) => i.category_id === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [categories, filtered]);

  const runningBill = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const qtyOf = (item: MenuItem) => cart.lines.find((l) => l.itemId === item.id)?.quantity ?? 0;

  async function handlePlaceOrder() {
    if (!table) return;
    setPlacing(true);
    try {
      if (!code) throw new Error("Scan your table QR code before ordering.");
      const orderNumber = await placeOrderFn({ data: { tableNumber, code, lines: cart.lines } });
      cart.clear();
      setCartOpen(false);
      toast.success(`Order #${String(orderNumber).padStart(3, "0")} sent to the kitchen`);
      await queryClient.invalidateQueries({ queryKey: ["guest-orders", tableNumber, code] });
    } catch (error) {
      console.error(error);
      toast.error("We couldn't send your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  async function handleRequest(kind: "waiter_requests" | "bill_requests") {
    if (!table) return;
    try {
      if (!code) throw new Error("Scan your table QR code before sending a request.");
      await createRequestFn({ data: { tableNumber, code, kind } });
      toast.success(
        kind === "waiter_requests"
          ? "A waiter is on the way to your table"
          : "Bill requested — a staff member will bring it over",
      );
    } catch (error) {
      console.error(error);
      toast.error("Request failed. Please try again or wave at a staff member.");
    }
  }

  if (!hasCode) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">Scan your table QR code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Orders only open from the QR code printed on your table.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/">Back to scanner</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (tableLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">Checking your table…</p>
      </main>
    );
  }

  if (tableInvalid || !table) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">QR code not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please scan the current QR code printed on your table.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/">Back to scanner</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-3 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="h-10 shrink-0 rounded-full">
              <Link to="/">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                Saffron House
              </p>
              <h1 className="truncate font-display text-2xl font-semibold">Table {tableNumber}</h1>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full"
              onClick={() => handleRequest("waiter_requests")}
            >
              <BellRing className="size-4" />
              Call waiter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full"
              onClick={() => handleRequest("bill_requests")}
            >
              <ReceiptText className="size-4" />
              Request bill
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="menu" className="mx-auto max-w-3xl px-4">
        <TabsList className="mt-4 grid w-full grid-cols-2 rounded-full bg-muted p-1">
          <TabsTrigger value="menu" className="rounded-full">
            <Utensils className="size-4" /> Menu
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-full">
            <ShoppingBag className="size-4" /> My orders
            {orders.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {orders.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes or categories"
              className="h-12 rounded-full border-border bg-card pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { key: "all", label: "All" },
                { key: "veg", label: "Veg" },
                { key: "nonveg", label: "Non-veg" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setDiet(f.key)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                  diet === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setAvailableOnly((v) => !v)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                availableOnly
                  ? "border-success bg-success text-success-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-success/40",
              )}
            >
              <CircleCheck className="mr-1 inline size-3.5" /> Available
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                activeCategory === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-secondary",
              )}
            >
              Everything
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  activeCategory === c.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-secondary",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {itemsLoading && <p className="py-16 text-center text-sm text-muted-foreground">Loading menu…</p>}
          {!itemsLoading && grouped.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nothing matches that search.
            </p>
          )}

          {grouped.map((group) => (
            <section key={group.category.id} className="space-y-3 pt-2">
              <h2 className="font-display text-xl font-semibold">{group.category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={qtyOf(item)}
                    onAdd={() => cart.add(item)}
                    onChange={(q) => cart.setQuantity(item.id, q)}
                  />
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-4">
          {orders.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No orders yet for this table.
            </p>
          )}

          {orders.map((order) => {
            const stepIndex = ORDER_FLOW.indexOf(order.status);
            return (
              <article
                key={order.id}
                className="animate-rise rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">
                      Order #{String(order.order_number).padStart(3, "0")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Placed at {clockTime(order.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/12 px-3 py-1 text-xs font-bold text-primary">
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>

                <div className="mt-3 flex gap-1">
                  {ORDER_FLOW.map((step, i) => (
                    <span
                      key={step}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        i <= stepIndex && order.status !== "cancelled" ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ))}
                </div>

                <ul className="mt-3 space-y-1.5">
                  {order.order_items.map((line) => (
                    <li key={line.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{line.item_name}</span>
                        <span className="text-muted-foreground"> × {line.quantity}</span>
                        {line.special_instructions && (
                          <span className="block text-xs italic text-muted-foreground">
                            “{line.special_instructions}”
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatMoney(line.unit_price * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}

          {orders.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <span className="text-sm font-semibold">Running table bill</span>
              <span className="font-display text-2xl font-semibold text-primary">
                {formatMoney(runningBill)}
              </span>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <Button
              size="lg"
              className="h-14 w-full justify-between rounded-full px-6 text-base font-bold shadow-ember"
              onClick={() => setCartOpen(true)}
            >
              <span>
                {cart.count} item{cart.count > 1 ? "s" : ""} · {formatMoney(cart.total)}
              </span>
              <span className="flex items-center gap-1">
                View cart <ChevronLeft className="size-4 rotate-180" />
              </span>
            </Button>
          </div>
        </div>
      )}

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        lines={cart.lines}
        total={cart.total}
        tableNumber={tableNumber}
        placing={placing}
        onQuantity={cart.setQuantity}
        onInstructions={cart.setInstructions}
        onPlace={handlePlaceOrder}
      />
    </main>
  );
}
