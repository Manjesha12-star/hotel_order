CREATE TABLE public.table_qr_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE UNIQUE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_rotated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.table_qr_codes TO authenticated;
GRANT ALL ON public.table_qr_codes TO service_role;

ALTER TABLE public.table_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read table qr codes"
ON public.table_qr_codes
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "staff insert table qr codes"
ON public.table_qr_codes
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff update table qr codes"
ON public.table_qr_codes
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.table_qr_codes (table_id)
SELECT rt.id
FROM public.restaurant_tables rt
ON CONFLICT (table_id) DO NOTHING;

CREATE TRIGGER trg_table_qr_codes_updated
BEFORE UPDATE ON public.table_qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_table_qr_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.table_qr_codes (table_id)
  VALUES (NEW.id)
  ON CONFLICT (table_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_restaurant_table_created
AFTER INSERT ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.create_table_qr_code();

CREATE OR REPLACE FUNCTION public.validate_table_qr(_table_number integer, _token text)
RETURNS TABLE(id uuid, table_number integer, seats integer, status table_status)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT rt.id, rt.table_number, rt.seats, rt.status
  FROM public.restaurant_tables rt
  JOIN public.table_qr_codes q ON q.table_id = rt.id
  WHERE rt.table_number = _table_number
    AND q.token = _token
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_table_qr(integer, text) TO anon, authenticated;

DROP POLICY IF EXISTS "sessions guest insert" ON public.table_sessions;
DROP POLICY IF EXISTS "sessions public read" ON public.table_sessions;
CREATE POLICY "sessions staff read"
ON public.table_sessions
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "orders guest insert" ON public.orders;
DROP POLICY IF EXISTS "orders public read" ON public.orders;
CREATE POLICY "orders staff read"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "order items guest insert" ON public.order_items;
DROP POLICY IF EXISTS "order items public read" ON public.order_items;
CREATE POLICY "order items staff read"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "waiter guest insert" ON public.waiter_requests;
DROP POLICY IF EXISTS "waiter public read" ON public.waiter_requests;
CREATE POLICY "waiter staff read"
ON public.waiter_requests
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "bill guest insert" ON public.bill_requests;
DROP POLICY IF EXISTS "bill public read" ON public.bill_requests;
CREATE POLICY "bill staff read"
ON public.bill_requests
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));