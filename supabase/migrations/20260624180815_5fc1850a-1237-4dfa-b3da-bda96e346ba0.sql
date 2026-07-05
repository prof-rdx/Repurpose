
REVOKE EXECUTE ON FUNCTION public.decrement_quota(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_acquire_drain_lock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_quota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_drain_lock() TO service_role;
