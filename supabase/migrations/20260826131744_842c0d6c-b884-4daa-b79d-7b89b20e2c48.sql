WITH ranked_active_sessions AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY table_id ORDER BY opened_at DESC, id DESC) AS rank_for_table
  FROM public.table_sessions
  WHERE status = 'active'
)
UPDATE public.table_sessions
SET status = 'closed', closed_at = COALESCE(closed_at, now())
WHERE id IN (
  SELECT id
  FROM ranked_active_sessions
  WHERE rank_for_table > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_one_active_per_table
ON public.table_sessions (table_id)
WHERE status = 'active';

ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_quantity_positive;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0 AND quantity <= 50);

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_total_non_negative;

ALTER TABLE public.orders
ADD CONSTRAINT orders_total_non_negative CHECK (total >= 0);