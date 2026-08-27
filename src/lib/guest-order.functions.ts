import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  createGuestHelpRequest,
  createGuestOrder,
  listGuestOrders,
  validateGuestTableAccess,
} from "./guest-order.server";

export const validateGuestTable = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        tableNumber: z.coerce.number().int().min(1).max(999),
        code: z.string().trim().min(16).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => validateGuestTableAccess(data));

export const fetchGuestOrders = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        tableNumber: z.coerce.number().int().min(1).max(999),
        code: z.string().trim().min(16).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => listGuestOrders(data));

export const placeGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        tableNumber: z.coerce.number().int().min(1).max(999),
        code: z.string().trim().min(16).max(128),
        lines: z
          .array(
            z.object({
              itemId: z.string().uuid(),
              name: z.string().trim().min(1).max(160),
              price: z.coerce.number().nonnegative(),
              quantity: z.coerce.number().int().min(1).max(50),
              instructions: z.string().trim().max(200).optional(),
            }),
          )
          .min(1)
          .max(50),
        notes: z.string().trim().max(240).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => createGuestOrder(data));

export const createGuestRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        tableNumber: z.coerce.number().int().min(1).max(999),
        code: z.string().trim().min(16).max(128),
        kind: z.enum(["waiter_requests", "bill_requests"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => createGuestHelpRequest(data));
