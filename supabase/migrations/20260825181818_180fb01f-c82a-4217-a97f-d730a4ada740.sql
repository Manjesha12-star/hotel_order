REVOKE ALL ON FUNCTION public.create_table_qr_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_table_qr(integer, text) FROM PUBLIC, anon, authenticated;