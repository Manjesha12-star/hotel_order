import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus, RequestStatus, TableStatus } from "./restaurant";

export async function logActivity(entry: {
  action: string;
  tableNumber?: number | null;
  orderNumber?: number | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  await supabase.from("activity_logs").insert({
    staff_id: user.id,
    staff_name: profile?.full_name ?? user.email ?? "Staff",
    action: entry.action,
    table_number: entry.tableNumber ?? null,
    order_number: entry.orderNumber ?? null,
  });
}

export async function updateOrderStatus(
  order: { id: string; order_number: number },
  status: OrderStatus,
  tableNumber: number,
) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
  if (error) throw error;
  await logActivity({
    action: `Order marked ${status}`,
    tableNumber,
    orderNumber: order.order_number,
  });
}

export async function setTableStatus(
  tableId: string,
  status: TableStatus,
  tableNumber: number,
) {
  const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", tableId);
  if (error) throw error;
  await logActivity({ action: `Table set to ${status}`, tableNumber });
}

export async function updateRequestStatus(
  kind: "waiter_requests" | "bill_requests",
  id: string,
  status: RequestStatus,
  tableNumber: number,
) {
  const { error } = await supabase.from(kind).update({ status }).eq("id", id);
  if (error) throw error;
  await logActivity({
    action: `${kind === "waiter_requests" ? "Waiter request" : "Bill request"} ${status}`,
    tableNumber,
  });
}

/** Mark the session paid, close open requests and free the table. */
export async function closeTableSession(params: {
  sessionId: string | null;
  tableId: string;
  tableNumber: number;
}) {
  if (params.sessionId) {
    const { error } = await supabase
      .from("table_sessions")
      .update({ status: "paid", closed_at: new Date().toISOString() })
      .eq("id", params.sessionId);
    if (error) throw error;
    // Close out any orders still in flight so the table clears from the board.
    const { error: ordersError } = await supabase
      .from("orders")
      .update({ status: "served" })
      .eq("session_id", params.sessionId)
      .not("status", "in", "(served,cancelled)");
    if (ordersError) throw ordersError;

    const { error: waiterError } = await supabase
      .from("waiter_requests")
      .update({ status: "completed" })
      .eq("session_id", params.sessionId)
      .neq("status", "completed");
    if (waiterError) throw waiterError;

    const { error: billError } = await supabase
      .from("bill_requests")
      .update({ status: "completed" })
      .eq("session_id", params.sessionId)
      .neq("status", "completed");
    if (billError) throw billError;
  }
  const { error: tableError } = await supabase
    .from("restaurant_tables")
    .update({ status: "cleaning" })
    .eq("id", params.tableId);
  if (tableError) throw tableError;
  await logActivity({ action: "Payment completed, table closed", tableNumber: params.tableNumber });
}

export async function resetTable(tableId: string, tableNumber: number) {
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ status: "available" })
    .eq("id", tableId);
  if (error) throw error;
  await logActivity({ action: "Table reset for next guests", tableNumber });
}
