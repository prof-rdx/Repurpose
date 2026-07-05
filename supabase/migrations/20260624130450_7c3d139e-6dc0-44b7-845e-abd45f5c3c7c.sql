
REVOKE EXECUTE ON FUNCTION public.claim_jobs(int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_job(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_quota_and_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_content_job() FROM PUBLIC, anon, authenticated;
