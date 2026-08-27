import { supabase } from "@/integrations/supabase/client";

export type SpiceLevel = 0 | 1 | 2 | 3;

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  spice_level: number;
  is_available: boolean;
  is_popular: boolean;
  is_chef_special: boolean;
  sort_order: number;
};

export type OrderStatus = "placed" | "accepted" | "preparing" | "ready" | "served" | "cancelled";
export type TableStatus = "available" | "occupied" | "bill_requested" | "cleaning" | "ready";
export type RequestStatus = "pending" | "accepted" | "completed";

export type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  special_instructions: string | null;
};

export type Order = {
  id: string;
  order_number: number;
  table_id: string;
  session_id: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
};

export type RestaurantTable = {
  id: string;
  table_number: number;
  seats: number;
  status: TableStatus;
};

export const ORDER_FLOW: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "served"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order received",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  bill_requested: "Bill requested",
  cleaning: "Cleaning",
  ready: "Ready",
};

export const SPICE_LABEL = ["No spice", "Mild", "Medium", "Hot"];

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  if (i < 0 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1] ?? null;
}

/* ---------- reads ---------- */

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id,category_id,name,description,price,image_url,is_veg,spice_level,is_available,is_popular,is_chef_special,sort_order",
    )
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export async function fetchTables(): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id,table_number,seats,status")
    .order("table_number");
  if (error) throw error;
  return (data ?? []) as RestaurantTable[];
}

export async function fetchTableByNumber(tableNumber: number): Promise<RestaurantTable | null> {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id,table_number,seats,status")
    .eq("table_number", tableNumber)
    .maybeSingle();
  if (error) throw error;
  return (data as RestaurantTable) ?? null;
}

export async function fetchActiveSession(tableId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

const ORDER_SELECT =
  "id,order_number,table_id,session_id,status,total,notes,created_at,order_items(id,order_id,item_name,unit_price,quantity,special_instructions)";

export async function fetchSessionOrders(sessionId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

export async function fetchActiveOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .neq("status", "cancelled")
    .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

export async function fetchActiveSessions() {
  const { data, error } = await supabase
    .from("table_sessions")
    .select("id,table_id,status,opened_at")
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRequests(kind: "waiter_requests" | "bill_requests") {
  const { data, error } = await supabase
    .from(kind)
    .select("id,table_id,session_id,status,created_at")
    .neq("status", "completed")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/* ---------- guest writes ---------- */

export async function ensureSession(tableId: string): Promise<string> {
  const existing = await fetchActiveSession(tableId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("table_sessions")
    .insert({ table_id: tableId, status: "active" })
    .select("id")
    .single();
  if (error) {
    const retry = await fetchActiveSession(tableId);
    if (retry) return retry;
    throw error;
  }
  return data.id;
}

export type CartLine = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  instructions?: string | undefined;
};

export async function placeOrder(params: {
  tableId: string;
  lines: CartLine[];
  notes?: string;
}): Promise<number> {
  const sessionId = await ensureSession(params.tableId);
  const total = params.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      table_id: params.tableId,
      session_id: sessionId,
      status: "placed",
      total,
      notes: params.notes?.trim() || null,
    })
    .select("id,order_number")
    .single();
  if (error) throw error;

  const { error: itemsError } = await supabase.from("order_items").insert(
    params.lines.map((l) => ({
      order_id: order.id,
      menu_item_id: l.itemId,
      item_name: l.name,
      unit_price: l.price,
      quantity: l.quantity,
      special_instructions: l.instructions?.trim() || null,
    })),
  );
  if (itemsError) throw itemsError;

  return order.order_number;
}

export async function createRequest(
  kind: "waiter_requests" | "bill_requests",
  tableId: string,
): Promise<void> {
  const sessionId = await fetchActiveSession(tableId);
  const { error } = await supabase
    .from(kind)
    .insert({ table_id: tableId, session_id: sessionId, status: "pending" });
  if (error) throw error;
}
