REVOKE EXECUTE ON FUNCTION public.increment_usage_chars(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_usage_chars(uuid, bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_job_permanent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fail_job_permanent(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fail_job(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_job(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_jobs(integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;