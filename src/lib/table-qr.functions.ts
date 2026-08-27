import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaffAccess, listTableQrCodesForStaff } from "./table-qr.server";

export const getTableQrCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaffAccess(context.supabase, context.userId);
    return listTableQrCodesForStaff();
  });
