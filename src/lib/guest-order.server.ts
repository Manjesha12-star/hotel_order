import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CartLine, Order, RestaurantTable } from "./restaurant";

const ORDER_SELECT =
  "id,order_number,table_id,session_id,status,total,notes,created_at,order_items(id,order_id,item_name,unit_price,quantity,special_instructions)";

export type GuestTableAccess = {
  table: RestaurantTable;
};

export type GuestOrdersState = {
  table: RestaurantTable;
  sessionId: string | null;
  orders: Order[];
};

function normalizeQrToken(code: string): string {
  const token = code.trim().toLowerCase();
  if (!/^[a-f0-9]{16,128}$/.test(token)) {
    throw new Error("Scan the QR code printed on your table to order.");
  }
  return token;
}

export async function requireTableFromQr(tableNumber: number, code: string): Promise<RestaurantTable> {
  const token = normalizeQrToken(code);

  const { data: qrRow, error: qrError } = await supabaseAdmin
    .from("table_qr_codes")
    .select("table_id")
    .eq("token", token)
    .maybeSingle();

  if (qrError) throw qrError;
  if (!qrRow) throw new Error("This table QR code is not valid.");

  const { data: table, error: tableError } = await supabaseAdmin
    .from("restaurant_tables")
    .select("id,table_number,seats,status")
    .eq("id", qrRow.table_id)
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!table) throw new Error("This QR code does not match the selected table.");

  return table as RestaurantTable;
}

async function fetchActiveSessionId(tableId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function getOrCreateActiveSession(tableId: string): Promise<string> {
  const existing = await fetchActiveSessionId(tableId);
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("table_sessions")
    .insert({ table_id: tableId, status: "active" })
    .select("id")
    .single();

  if (error) {
    const retry = await fetchActiveSessionId(tableId);
    if (retry) return retry;
    throw error;
  }

  return data.id;
}

export async function validateGuestTableAccess(params: {
  tableNumber: number;
  code: string;
}): Promise<GuestTableAccess> {
  const table = await requireTableFromQr(params.tableNumber, params.code);
  return { table };
}

export async function listGuestOrders(params: {
  tableNumber: number;
  code: string;
}): Promise<GuestOrdersState> {
  const table = await requireTableFromQr(params.tableNumber, params.code);
  const sessionId = await fetchActiveSessionId(table.id);

  if (!sessionId) return { table, sessionId: null, orders: [] };

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
    .order("created_at");

  if (error) throw error;
  return { table, sessionId, orders: (data ?? []) as unknown as Order[] };
}

function normalizeCartLines(lines: CartLine[]): Array<CartLine & { quantity: number }> {
  const byItem = new Map<string, CartLine & { quantity: number }>();

  lines.forEach((line) => {
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(line.quantity))));
    if (!line.itemId || !Number.isFinite(quantity)) return;
    const existing = byItem.get(line.itemId);
    if (existing) {
      byItem.set(line.itemId, { ...existing, quantity: Math.min(50, existing.quantity + quantity) });
      return;
    }
    byItem.set(line.itemId, { ...line, quantity });
  });

  return [...byItem.values()].slice(0, 50);
}

export async function createGuestOrder(params: {
  tableNumber: number;
  code: string;
  lines: CartLine[];
  notes?: string | undefined;
}): Promise<number> {
  const table = await requireTableFromQr(params.tableNumber, params.code);
  const lines = normalizeCartLines(params.lines);

  if (lines.length === 0) throw new Error("Add at least one dish before placing an order.");

  const itemIds = lines.map((line) => line.itemId);
  const { data: menuRows, error: menuError } = await supabaseAdmin
    .from("menu_items")
    .select("id,name,price,is_available")
    .in("id", itemIds);

  if (menuError) throw menuError;

  const menuById = new Map((menuRows ?? []).map((item) => [item.id, item]));
  const orderLines = lines.map((line) => {
    const menuItem = menuById.get(line.itemId);
    if (!menuItem || !menuItem.is_available) {
      throw new Error(`${line.name || "That item"} is no longer available.`);
    }
    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity: line.quantity,
      instructions: line.instructions?.trim().slice(0, 200) || null,
    };
  });

  const sessionId = await getOrCreateActiveSession(table.id);
  const total = orderLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      table_id: table.id,
      session_id: sessionId,
      status: "placed",
      total,
      notes: params.notes?.trim().slice(0, 240) || null,
    })
    .select("id,order_number")
    .single();

  if (orderError) throw orderError;

  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
    orderLines.map((line) => ({
      order_id: order.id,
      menu_item_id: line.menuItemId,
      item_name: line.name,
      unit_price: line.price,
      quantity: line.quantity,
      special_instructions: line.instructions,
    })),
  );

  if (itemsError) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  await supabaseAdmin
    .from("restaurant_tables")
    .update({ status: "occupied" })
    .eq("id", table.id)
    .in("status", ["available", "ready", "cleaning"]);

  return order.order_number;
}

export async function createGuestHelpRequest(params: {
  tableNumber: number;
  code: string;
  kind: "waiter_requests" | "bill_requests";
}): Promise<void> {
  const table = await requireTableFromQr(params.tableNumber, params.code);
  const sessionId = await getOrCreateActiveSession(table.id);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(params.kind)
    .select("id")
    .eq("table_id", table.id)
    .eq("session_id", sessionId)
    .in("status", ["pending", "accepted"])
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) {
    const { error } = await supabaseAdmin
      .from(params.kind)
      .insert({ table_id: table.id, session_id: sessionId, status: "pending" });
    if (error) throw error;
  }

  await supabaseAdmin
    .from("restaurant_tables")
    .update({ status: params.kind === "bill_requests" ? "bill_requested" : "occupied" })
    .eq("id", table.id);
}
