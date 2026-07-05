
-- Atomic quota rollback helper. Uses GREATEST to clamp at zero.
CREATE OR REPLACE FUNCTION public.decrement_quota(p_user uuid, p_month text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usage_monthly
  SET jobs_count = GREATEST(jobs_count - 1, 0),
      updated_at = now()
  WHERE user_id = p_user AND year_month = p_month;
$$;

-- Single-flight guard for drainQueue. Returns true if this caller acquired
-- the lock; the value is released at transaction end.
CREATE OR REPLACE FUNCTION public.try_acquire_drain_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext('drain_queue_singleflight'));
$$;

-- Document the auth-only intent of these tables (RLS on, no policies = locked).
COMMENT ON TABLE public.usage_monthly IS 'Auth-only via security-definer RPCs (check_quota_and_rate_limit, complete_job_and_charge, decrement_quota). RLS enabled with no policies blocks all direct Data API access by design.';
COMMENT ON TABLE public.rate_limits IS 'Auth-only via security-definer RPCs. RLS enabled with no policies blocks all direct Data API access by design.';
