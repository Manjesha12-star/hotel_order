import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffSupabase = SupabaseClient<Database>;

export type TableQrCode = {
  id: string;
  tableNumber: number;
  seats: number;
  token: string;
};

export async function assertStaffAccess(supabase: StaffSupabase, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Staff access required.");
}

export async function listTableQrCodesForStaff(): Promise<TableQrCode[]> {
  const { data: tables, error: tableError } = await supabaseAdmin
    .from("restaurant_tables")
    .select("id,table_number,seats")
    .order("table_number");

  if (tableError) throw tableError;

  const tableIds = (tables ?? []).map((table) => table.id);
  if (tableIds.length === 0) return [];

  const { data: existingCodes, error: codesError } = await supabaseAdmin
    .from("table_qr_codes")
    .select("table_id,token")
    .in("table_id", tableIds);

  if (codesError) throw codesError;

  const codeByTable = new Map((existingCodes ?? []).map((code) => [code.table_id, code.token]));
  const missingTableIds = tableIds.filter((tableId) => !codeByTable.has(tableId));

  if (missingTableIds.length > 0) {
    const { data: createdCodes, error: createError } = await supabaseAdmin
      .from("table_qr_codes")
      .insert(missingTableIds.map((table_id) => ({ table_id })))
      .select("table_id,token");

    if (createError) throw createError;
    (createdCodes ?? []).forEach((code) => codeByTable.set(code.table_id, code.token));
  }

  return (tables ?? [])
    .map((table) => {
      const token = codeByTable.get(table.id);
      if (!token) return null;
      return {
        id: table.id,
        tableNumber: table.table_number,
        seats: table.seats,
        token,
      };
    })
    .filter((table): table is TableQrCode => table !== null);
}
