UPDATE public.orders o
SET status = 'served'
WHERE o.status NOT IN ('served', 'cancelled')
  AND EXISTS (
    SELECT 1
    FROM public.bill_requests br
    WHERE br.session_id = o.session_id
      AND br.status = 'completed'
  );

UPDATE public.waiter_requests wr
SET status = 'completed', updated_at = now()
WHERE wr.status <> 'completed'
  AND EXISTS (
    SELECT 1
    FROM public.bill_requests br
    WHERE br.session_id = wr.session_id
      AND br.status = 'completed'
  );

UPDATE public.table_sessions s
SET status = 'paid', closed_at = COALESCE(s.closed_at, now())
WHERE s.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.bill_requests br
    WHERE br.session_id = s.id
      AND br.status = 'completed'
  );

UPDATE public.restaurant_tables t
SET status = 'cleaning', updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.table_sessions s
  JOIN public.bill_requests br ON br.session_id = s.id
  WHERE s.table_id = t.id
    AND s.status = 'paid'
    AND br.status = 'completed'
);